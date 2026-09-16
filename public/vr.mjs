import { Entity, Vec3, XRTYPE_VR, XRSPACE_LOCALFLOOR } from 'playcanvas';
import { criarCartao } from './cartao.mjs?v=1';

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
 * A segunda é que em VR a cabeça manda na câmara. Os comandos de sempre
 * são desligados e a câmara passa a viajar dentro de um suporte — como uma
 * pessoa dentro de um carrinho: a cabeça olha à vontade, e é o carrinho
 * que se desloca com os comandos.
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

// Tecto de pontos do mapa enquanto se está em VR.
const TECTO_DE_PONTOS_VR = 700000;

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

// Nos óculos de cartão não há comandos: anda-se com um toque no ecrã (o
// botão do cartão), que põe a andar para onde se olha; outro toque pára.
// Um toque conta se for curto e sem arrastar — o resto é o dedo a
// acertar o telemóvel na armação.
const TOQUE_CURTO_MS = 400;
const TOQUE_SEM_ARRASTAR_PX = 24;

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

        g.splatBudget = Math.min(g.splatBudget || Infinity, TECTO_DE_PONTOS_VR);
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

        // As etiquetas dos testemunhos são feitas de HTML, e dentro dos
        // óculos o HTML não existe. Continuavam a ser recalculadas a cada
        // imagem sem ninguém as ver: desligam-se enquanto durar a visita.
        guardado.anotacoes = camara.script && camara.script.annotationController;
        if (guardado.anotacoes) guardado.anotacoes.enabled = false;

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
        return true;
    }

    /**
     * Desmonta o suporte e devolve a câmara ao sítio de onde veio.
     */
    function desmontarSuporte() {
        if (!camara) return;
        camara.reparent(guardado.pai || app.root);
        camara.setPosition(guardado.posicao);
        camara.setRotation(guardado.rotacao);
        if (guardado.anotacoes) guardado.anotacoes.enabled = true;
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
        // Um salto no relógio — uma imagem que demorou, os óculos a voltar do
        // descanso — não pode virar um salto no bairro. Trava-se o passo à
        // mesma medida com que a câmara do rato já se trava.
        dt = Math.min(dt, 0.1);
        const fontes = (app.xr.input && app.xr.input.inputSources) || [];

        let andarX = 0, andarZ = 0, rodar = 0, rapido = false;
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

        // Sem comandos a mandar, vale o toque: a andar para a frente.
        if (andarX === 0 && andarZ === 0 && aAndarPeloToque) andarZ = -1;
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

    // O toque no ecrã dentro dos óculos de cartão.
    let aAndarPeloToque = false;
    let toqueComecou = null;
    const aoPousarODedo = (e) => {
        if (!emOculos()) return;
        // O botão de sair dos óculos de cartão não é um toque para andar.
        if (e.target && e.target.closest && e.target.closest('#cartao-sair')) return;
        toqueComecou = { x: e.clientX, y: e.clientY, quando: performance.now() };
    };
    const aoLevantarODedo = (e) => {
        if (!emOculos() || !toqueComecou) return;
        const curto = performance.now() - toqueComecou.quando < TOQUE_CURTO_MS;
        const parado = Math.hypot(e.clientX - toqueComecou.x, e.clientY - toqueComecou.y) < TOQUE_SEM_ARRASTAR_PX;
        toqueComecou = null;
        if (curto && parado) aAndarPeloToque = !aAndarPeloToque;
    };
    // O botão dos comandos a sério que não têm manípulo (o "select" do
    // WebXR) faz o mesmo que o toque.
    const aoSeleccionar = () => { if (emOculos()) aAndarPeloToque = !aAndarPeloToque; };

    function ouvirOToque() {
        aAndarPeloToque = false;
        toqueComecou = null;
        // Só depois de o toque que abriu os óculos ter acabado.
        setTimeout(() => {
            if (!emOculos()) return;
            document.addEventListener('pointerdown', aoPousarODedo, true);
            document.addEventListener('pointerup', aoLevantarODedo, true);
            if (app.xr.input && app.xr.input.on) app.xr.input.on('select', aoSeleccionar);
        }, 500);
    }

    function deixarDeOuvirOToque() {
        aAndarPeloToque = false;
        toqueComecou = null;
        document.removeEventListener('pointerdown', aoPousarODedo, true);
        document.removeEventListener('pointerup', aoLevantarODedo, true);
        if (app.xr.input && app.xr.input.off) app.xr.input.off('select', aoSeleccionar);
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
            if (!montarSuporte()) return 'Não consegui preparar a câmara para VR.';
            aplicarDefinicoesDeVR();
            const voltaAntes = suporte.getEulerAngles().y;
            const resposta = await cartao.entrar(suporte, camara, voltaAntes, () => terminar());
            if (resposta !== 'entrou') {
                desmontarSuporte();
                reporDefinicoes();
                return resposta;
            }
            aConduzir = (dt) => conduzir(dt);
            app.on('update', aConduzir);
            ouvirOToque();
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
                    ouvirOToque();
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
        deixarDeOuvirOToque();
        desmontarSuporte();
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
