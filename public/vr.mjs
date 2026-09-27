import { Entity, Vec3, XRTYPE_VR, XRSPACE_LOCALFLOOR } from 'playcanvas';
import { criarCartao } from './cartao.mjs?v=3';
import { criarMarcadoresVR } from './marcadores-vr.mjs?v=3';

/**
 * Modo VR: o bairro visto de dentro, com óculos.
 *
 * Há duas coisas a saber antes de perceber o resto.
 *
 * A primeira é que os óculos precisam do motor de desenho antigo. O site
 * usa o novo (WebGPU), que é mais rápido, mas quase nenhum visor o aceita
 * ainda para imagem estereoscópica. Por isso, ao entrar em VR, a página
 * recarrega-se a pedir o motor antigo — e, como os navegadores só deixam
 * abrir os óculos a partir de um toque da pessoa, do outro lado aparece um
 * convite para tocar uma segunda vez. Onde o motor novo já sirva, entra-se
 * directamente, sem recarregar nada.
 *
 * A segunda é que, com óculos a sério, a cabeça manda na câmara. Os
 * comandos de sempre são desligados e a câmara passa a viajar dentro de
 * um suporte — como uma pessoa dentro de um carrinho: a cabeça olha à
 * vontade, e é o carrinho que se desloca com os comandos.
 *
 * Os óculos de cartão (o telemóvel numa armação) são outra coisa, e mais
 * simples: são o próprio mapa, tal e qual, com os comandos de sempre, só
 * que visto por dois olhos e com a cabeça a virar com o telemóvel. Disso
 * trata cartao.mjs; aqui só se lhe juntam as placas dos marcadores e as
 * poupanças de desenho.
 *
 * Sobre o esforço pedido ao equipamento: desenhar duas imagens setenta e
 * duas vezes por segundo custa muito mais do que uma imagem a sessenta.
 * Por isso o modo VR entra com as suas próprias definições — menos pontos
 * no mapa, imagem um pouco mais pequena, e as poupanças de nitidez fora do
 * centro do olhar — e devolve tudo ao que estava à saída.
 */

// Quanto se desenha, em relação ao que o visor pediria. Abaixo de 1 a
// imagem perde nitidez mas ganha fluidez, que em VR conta muito mais.
const ESCALA_DA_IMAGEM = 0.8;

// Tecto de pontos do mapa enquanto se está em VR — e mais baixo ainda
// nos óculos de cartão, que são um telemóvel a desenhar duas vezes.
const TECTO_DE_PONTOS_VR = 700000;
const TECTO_DE_PONTOS_CARTAO = 350000;

// Poupanças de nitidez: manchas minúsculas e manchas que quase não
// contribuem para a cor são deitadas fora, e fora do centro do olhar essa
// exigência sobe. É o mesmo princípio do nível Baixo, com a mão mais
// pesada — em VR ninguém repara no que está pelo canto do olho.
const MINIMO_DE_PONTOS = 3;
const MINIMO_DE_CONTRIBUICAO = 6;
const FOVEACAO = 14;
const CENTRO_DA_FOVEACAO = 0.35;

// A que velocidade se anda, em metros por segundo, e de quantos graus
// roda cada toque lateral. A rotação é aos saltos de propósito: rodar
// devagar dentro de uns óculos embrulha o estômago.
const VELOCIDADE = 12;
const VELOCIDADE_RAPIDA = 40;
const GRAUS_POR_SALTO = 30;

// Abaixo desta inclinação o manípulo é considerado parado.
const ZONA_MORTA = 0.25;

// Altura a que os olhos ficam acima do chão do suporte, em metros. Serve
// para entrar em VR à altura a que se estava a ver o mapa.
const ALTURA_DOS_OLHOS = 1.6;

// Nunca se desce abaixo disto, para não acabar com a cabeça dentro do chão.
const ALTURA_MINIMA = 1.5;

// Dentro dos óculos os comandos de sempre continuam a servir: as teclas
// (W, A, S, D e as setas; o Shift acelera), um comando de jogo ligado ao
// aparelho (o manípulo esquerdo anda, o direito roda aos saltos) e o
// rato ou o dedo a arrastar de lado, que rodam o suporte — quantos graus
// por cada ponto de ecrã arrastado.
const GRAUS_POR_PONTO_ARRASTADO = 0.3;

/**
 * Prepara o modo VR.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {object} Comandos do modo VR.
 */
export function criarModoVR(app) {
    const guardado = {};
    let suporte = null;
    let camara = null;
    let aRodar = false;

    // Os óculos de cartão do telemóvel: o ecrã dividido em dois e o sensor
    // de movimento a virar a cabeça, feitos pelo próprio mapa (cartao.mjs).
    const cartao = criarCartao(app);

    // Os marcadores do bairro, como placas, dentro dos óculos.
    const marcadores = criarMarcadoresVR(app);

    /** Se se está dentro de uns óculos, sejam a sério ou de cartão. */
    const emOculos = () => !!(app.xr.active || cartao.activo);

    /**
     * Se este aparelho tem óculos ligados e o navegador os deixa usar.
     *
     * @returns {Promise<boolean>} Verdadeiro se der para entrar em VR.
     */
    async function disponivel() {
        // No telemóvel há sempre os óculos de cartão (ver vr-cartao.js).
        if (window.VRCartao && window.VRCartao.pronto) {
            try {
                if (await window.VRCartao.pronto) return true;
            } catch (e) { /* segue pelo caminho de sempre */ }
        }
        if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
        try {
            return await navigator.xr.isSessionSupported('immersive-vr');
        } catch (e) {
            return false;
        }
    }

    /**
     * Se o motor de desenho actual serve para os óculos.
     *
     * @returns {boolean} Verdadeiro se não for preciso recarregar a página.
     */
    function motorServeParaVR() {
        const dispositivo = app.graphicsDevice;
        if (!dispositivo || !dispositivo.isWebGPU) return true;
        return typeof window.XRGPUBinding !== 'undefined';
    }

    /**
     * Recarrega a página a pedir o motor de desenho que os óculos aceitam.
     */
    function recarregarParaVR() {
        const endereco = new URL(window.location.href);
        endereco.searchParams.set('vr', '1');
        window.location.href = endereco.toString();
    }

    /**
     * Guarda as definições de imagem e põe as de VR.
     */
    function aplicarDefinicoesDeVR() {
        const g = app.scene && app.scene.gsplat;
        if (!g) return;
        guardado.tecto = g.splatBudget;
        guardado.minimoDePontos = g.minPixelSize;
        guardado.minimoDeContribuicao = g.minContribution;
        guardado.foveacao = g.foveationStrength;
        guardado.centro = g.foveationCenter;

        g.splatBudget = Math.min(g.splatBudget || Infinity, window.vrPorCartao ? TECTO_DE_PONTOS_CARTAO : TECTO_DE_PONTOS_VR);
        g.minPixelSize = Math.max(g.minPixelSize, MINIMO_DE_PONTOS);
        g.minContribution = Math.max(g.minContribution, MINIMO_DE_CONTRIBUICAO);
        g.foveationCenter = CENTRO_DA_FOVEACAO;
        g.foveationStrength = Math.max(g.foveationStrength, FOVEACAO);
    }

    /**
     * Devolve as definições de imagem ao que estavam.
     */
    function reporDefinicoes() {
        const g = app.scene && app.scene.gsplat;
        if (!g || guardado.tecto === undefined) return;
        g.splatBudget = guardado.tecto;
        g.minPixelSize = guardado.minimoDePontos;
        g.minContribution = guardado.minimoDeContribuicao;
        g.foveationStrength = guardado.foveacao;
        g.foveationCenter = guardado.centro;
    }

    /**
     * Põe a câmara dentro de um suporte, no sítio onde a pessoa estava a
     * ver o mapa. A cabeça passa a mandar na direcção do olhar; o suporte
     * é que se desloca.
     */
    function montarSuporte() {
        camara = app.root.findByName('camera');
        if (!camara) return false;

        guardado.pai = camara.parent;
        guardado.posicao = camara.getPosition().clone();
        guardado.rotacao = camara.getRotation().clone();
        guardado.controlos = camara.script && camara.script.cameraControls;
        if (guardado.controlos) guardado.controlos.enabled = false;

        suporte = new Entity('suporte-vr');
        app.root.addChild(suporte);
        suporte.setPosition(
            guardado.posicao.x,
            Math.max(ALTURA_MINIMA, guardado.posicao.y) - ALTURA_DOS_OLHOS,
            guardado.posicao.z
        );
        // Mantém-se a direcção para onde se estava a olhar, mas de pé:
        // inclinar o mundo dentro dos óculos dá enjoo.
        suporte.setEulerAngles(0, camara.getEulerAngles().y, 0);

        camara.reparent(suporte);
        camara.setLocalPosition(0, 0, 0);
        camara.setLocalEulerAngles(0, 0, 0);

        porAsPlacas();
        return true;
    }

    /**
     * As etiquetas dos testemunhos são feitas de HTML, e dentro dos óculos
     * o HTML não existe. Desligam-se enquanto durar a visita (continuavam
     * a ser recalculadas a cada imagem sem ninguém as ver) e no seu lugar
     * entram as placas no próprio bairro, com os nomes e o já visto do
     * mapa.
     */
    function porAsPlacas() {
        guardado.anotacoes = camara.script && camara.script.annotationController;
        if (guardado.anotacoes) guardado.anotacoes.enabled = false;
        const controlador = guardado.anotacoes;
        if (controlador && controlador.annotations) {
            const vistos = controlador.viewedAnnotations || [];
            marcadores.mostrar(
                controlador.annotations,
                (ann) => ann.is360 && controlador.nomeDaParagem360 ? controlador.nomeDaParagem360(ann) : (ann.label || ''),
                (ann) => controlador.idDaAnotacao ? vistos.includes(controlador.idDaAnotacao(ann)) : false
            );
        }
    }

    /**
     * Tira as placas e devolve as etiquetas de HTML.
     */
    function tirarAsPlacas() {
        marcadores.esconder();
        if (guardado.anotacoes) {
            guardado.anotacoes.enabled = true;
            guardado.anotacoes = null;
        }
    }

    /**
     * Desmonta o suporte e devolve a câmara ao sítio de onde veio.
     */
    function desmontarSuporte() {
        tirarAsPlacas();
        if (!camara || !suporte) return;
        camara.reparent(guardado.pai || app.root);
        camara.setPosition(guardado.posicao);
        camara.setRotation(guardado.rotacao);
        if (guardado.controlos) {
            guardado.controlos.enabled = true;
            // O controlador guarda a sua própria ideia de onde está a
            // câmara; sem isto, saltava de volta para o sítio antigo.
            if (guardado.controlos.recenter) {
                const frente = camara.forward.clone().mulScalar(20).add(guardado.posicao);
                guardado.controlos.recenter(guardado.posicao, frente);
            }
        }
        if (suporte) {
            suporte.destroy();
            suporte = null;
        }
    }

    /**
     * Andar e rodar com os comandos, a cada imagem.
     *
     * @param {number} dt - Tempo desde a imagem anterior, em segundos.
     */
    function conduzir(dt) {
        if (!emOculos() || !suporte || !camara) return;
        marcadores.virarPara(camara.getPosition());
        // Um salto no relógio — uma imagem que demorou, os óculos a voltar do
        // descanso — não pode virar um salto no bairro. Trava-se o passo à
        // mesma medida com que a câmara do rato já se trava.
        dt = Math.min(dt, 0.1);
        const fontes = (app.xr.input && app.xr.input.inputSources) || [];

        let andarX = 0, andarZ = 0, rodar = 0, rapido = false;

        // As teclas.
        if (teclas.frente) andarZ -= 1;
        if (teclas.tras) andarZ += 1;
        if (teclas.esquerda) andarX -= 1;
        if (teclas.direita) andarX += 1;
        if (teclas.rapido) rapido = true;

        // Um comando de jogo ligado ao aparelho (não aos óculos).
        const comandos = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const comando of comandos) {
            if (!comando || !comando.connected || !comando.axes) continue;
            const x = comando.axes[0] || 0;
            const y = comando.axes[1] || 0;
            const rx = comando.axes[2] || 0;
            if (Math.abs(x) > ZONA_MORTA) andarX += x;
            if (Math.abs(y) > ZONA_MORTA) andarZ += y;
            if (Math.abs(rx) > ZONA_MORTA) rodar = rx;
            if (comando.buttons && comando.buttons[10] && comando.buttons[10].pressed) rapido = true;
        }

        // O rato, ou o dedo, a arrastar de lado: roda o suporte, e não aos
        // saltos — a mão que arrasta já sabe quanto está a rodar.
        if (arrasto.pendente !== 0) {
            suporte.rotateLocal(0, -arrasto.pendente * GRAUS_POR_PONTO_ARRASTADO, 0);
            arrasto.pendente = 0;
        }

        for (const fonte of fontes) {
            const comando = fonte.gamepad;
            if (!comando || !comando.axes) continue;
            // Os manípulos aparecem nos eixos 2 e 3 na maioria dos
            // comandos; os 0 e 1 servem os que só têm superfície táctil.
            const x = comando.axes[2] ?? comando.axes[0] ?? 0;
            const y = comando.axes[3] ?? comando.axes[1] ?? 0;
            const esquerdo = fonte.handedness !== 'right';
            if (esquerdo) {
                if (Math.abs(x) > ZONA_MORTA) andarX += x;
                if (Math.abs(y) > ZONA_MORTA) andarZ += y;
                if (comando.buttons && comando.buttons[1] && comando.buttons[1].pressed) rapido = true;
            } else if (Math.abs(x) > ZONA_MORTA) {
                rodar = x;
            }
        }

        if (rodar !== 0) {
            if (!aRodar) {
                suporte.rotateLocal(0, rodar > 0 ? -GRAUS_POR_SALTO : GRAUS_POR_SALTO, 0);
                aRodar = true;
            }
        } else {
            aRodar = false;
        }

        if (andarX === 0 && andarZ === 0) return;

        // Anda-se para onde se está a olhar, mas sempre à altura a que se
        // está: olhar para o chão não deve enterrar a pessoa nele.
        const frente = camara.forward.clone();
        frente.y = 0;
        if (frente.length() < 1e-3) return;
        frente.normalize();
        const lado = new Vec3(-frente.z, 0, frente.x);

        const velocidade = (rapido ? VELOCIDADE_RAPIDA : VELOCIDADE) * dt;
        const passo = new Vec3(
            (frente.x * -andarZ + lado.x * andarX) * velocidade,
            0,
            (frente.z * -andarZ + lado.z * andarX) * velocidade
        );
        suporte.translate(passo);
    }

    let aConduzir = null;

    // ---- Os comandos de sempre, dentro dos óculos ----
    const teclas = { frente: false, tras: false, esquerda: false, direita: false, rapido: false };
    const arrasto = { activo: false, x: 0, pendente: 0 };

    const aoCarregarNaTecla = (e, emBaixo) => {
        if (!emOculos()) return;
        if (e.target && /^(?:INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        const tecla = e.key.toLowerCase();
        if (tecla === 'w' || e.key === 'ArrowUp') teclas.frente = emBaixo;
        else if (tecla === 's' || e.key === 'ArrowDown') teclas.tras = emBaixo;
        else if (tecla === 'a' || e.key === 'ArrowLeft') teclas.esquerda = emBaixo;
        else if (tecla === 'd' || e.key === 'ArrowRight') teclas.direita = emBaixo;
        else if (e.key === 'Shift') teclas.rapido = emBaixo;
        else return;
        e.preventDefault();
    };
    const aoBaixarTecla = (e) => aoCarregarNaTecla(e, true);
    const aoLevantarTecla = (e) => aoCarregarNaTecla(e, false);

    const aoPousar = (e) => {
        if (!emOculos()) return;
        if (e.target && e.target.closest && e.target.closest('#cartao-sair')) return;
        arrasto.activo = true;
        arrasto.x = e.clientX;
    };
    const aoArrastar = (e) => {
        if (!arrasto.activo) return;
        arrasto.pendente += e.clientX - arrasto.x;
        arrasto.x = e.clientX;
    };
    const aoLargar = () => { arrasto.activo = false; };

    function ligarOsComandosDeSempre() {
        for (const chave of Object.keys(teclas)) teclas[chave] = false;
        arrasto.activo = false;
        arrasto.pendente = 0;
        window.addEventListener('keydown', aoBaixarTecla, true);
        window.addEventListener('keyup', aoLevantarTecla, true);
        window.addEventListener('pointerdown', aoPousar, true);
        window.addEventListener('pointermove', aoArrastar, true);
        window.addEventListener('pointerup', aoLargar, true);
        window.addEventListener('pointercancel', aoLargar, true);
    }

    function desligarOsComandosDeSempre() {
        window.removeEventListener('keydown', aoBaixarTecla, true);
        window.removeEventListener('keyup', aoLevantarTecla, true);
        window.removeEventListener('pointerdown', aoPousar, true);
        window.removeEventListener('pointermove', aoArrastar, true);
        window.removeEventListener('pointerup', aoLargar, true);
        window.removeEventListener('pointercancel', aoLargar, true);
        for (const chave of Object.keys(teclas)) teclas[chave] = false;
        arrasto.activo = false;
        arrasto.pendente = 0;
    }

    /**
     * Abre os óculos.
     *
     * @returns {Promise<string>} O que aconteceu: 'entrou', 'a recarregar'
     *   ou uma mensagem de erro.
     */
    async function entrar() {
        if (emOculos()) return 'entrou';
        if (!await disponivel()) return 'Este aparelho não tem óculos de realidade virtual ligados.';

        // Os óculos de cartão são feitos pelo próprio mapa: não precisam
        // do motor antigo nem de recarregar a página.
        if (window.vrPorCartao) {
            camara = app.root.findByName('camera');
            if (!camara || !camara.camera) return 'Não consegui preparar a câmara para VR.';
            porAsPlacas();
            aplicarDefinicoesDeVR();
            const resposta = await cartao.entrar(camara, () => terminar());
            if (resposta !== 'entrou') {
                tirarAsPlacas();
                reporDefinicoes();
                return resposta;
            }
            // Só as placas a virarem-se para quem olha: o andar e o rodar
            // são os do mapa, que continua a mandar na câmara.
            aConduzir = () => marcadores.virarPara(camara.getPosition());
            app.on('update', aConduzir);
            return 'entrou';
        }

        if (!motorServeParaVR()) {
            recarregarParaVR();
            return 'a recarregar';
        }

        const componente = app.root.findByName('camera');
        if (!componente || !componente.camera) return 'Não encontrei a câmara do mapa.';

        if (!montarSuporte()) return 'Não consegui preparar a câmara para VR.';
        aplicarDefinicoesDeVR();

        return new Promise((resolve) => {
            app.xr.start(componente.camera, XRTYPE_VR, XRSPACE_LOCALFLOOR, {
                framebufferScaleFactor: ESCALA_DA_IMAGEM,
                callback: (erro) => {
                    if (erro) {
                        desmontarSuporte();
                        reporDefinicoes();
                        resolve('Não foi possível abrir os óculos: ' + erro.message);
                        return;
                    }
                    // Ajuda do próprio visor: desenha com menos detalhe nas
                    // bordas da lente, onde o olho não vê nítido.
                    try {
                        app.xr.fixedFoveation = 3;
                    } catch (e) { /* nem todos os visores têm */ }

                    aConduzir = (dt) => conduzir(dt);
                    app.on('update', aConduzir);
                    ligarOsComandosDeSempre();
                    resolve('entrou');
                }
            });
        });
    }

    /**
     * Fecha os óculos e devolve tudo ao que estava.
     */
    function sair() {
        if (cartao.activo) { cartao.sair(); return; }
        if (app.xr.active) app.xr.end();
    }

    /**
     * Arruma tudo ao sair dos óculos, sejam quais forem.
     */
    function terminar() {
        if (aConduzir) {
            app.off('update', aConduzir);
            aConduzir = null;
        }
        desligarOsComandosDeSempre();
        if (suporte) desmontarSuporte();
        else tirarAsPlacas();
        reporDefinicoes();
    }

    app.xr.on('end', () => {
        terminar();

        // Tira a marca do endereço: quem sair dos óculos e mais tarde
        // recarregar a página volta ao motor de desenho rápido, sem ter de
        // saber que existe tal coisa.
        try {
            const endereco = new URL(window.location.href);
            if (endereco.searchParams.has('vr')) {
                endereco.searchParams.delete('vr');
                window.history.replaceState({}, '', endereco.toString());
            }
        } catch (e) { /* endereços estranhos não valem um erro */ }
    });

    return {
        disponivel,
        entrar,
        sair,
        get activo() {
            return emOculos();
        },
        /** Se a página foi recarregada de propósito para entrar em VR. */
        get pedidoPendente() {
            return !!window.modoVRpedido;
        }
    };
}
