/**
 * O comando de jogo, e as teclas que faltavam ao teclado.
 *
 * O mapa já andava com os dois sticks — isso vem do próprio motor. O que
 * faltava era o resto do site: escolher um marcador e abri-lo, mexer nos
 * menus, mandar no vídeo, fechar o que está aberto. Sem isso, quem pegasse
 * num comando andava pelo bairro mas tinha de largá-lo para tudo o resto.
 *
 * O teclado tinha o mesmo buraco, e por isso entra pela mesma porta: as
 * teclas mandam nas mesmas acções que os botões, acendem os mesmos sinais
 * e obedecem ao mesmo sítio onde se está. Duas maquinarias para o mesmo
 * trabalho seriam dois sítios onde corrigir cada engano.
 *
 * A ideia aqui é não duplicar nada. O site já sabe responder a cliques e a
 * teclas — a janela do vídeo, por exemplo, já anda com o espaço e com as
 * setas. Por isso o comando não fala com as entranhas de ninguém: carrega
 * nos botões que já lá estão e manda as teclas que já são ouvidas. Se
 * amanhã aparecer um botão novo num menu, o comando alcança-o sem que se
 * lhe toque.
 *
 * O que muda conforme o sítio é o significado de cada botão. Com o mapa à
 * vista, a cruz direccional passa de marcador em marcador; com um menu
 * aberto, sobe e desce pelas linhas dele; com o vídeo a dar, salta cinco
 * segundos para trás e para a frente. É sempre a mesma cruz — muda o que
 * está à frente dela.
 *
 * Há sempre um sinal à vista de onde se está: o marcador escolhido acende
 * como se o rato estivesse em cima dele, e as linhas dos menus ganham um
 * risco à volta. Sem isso, carregar em A às cegas seria adivinhar.
 */

// Os números dos botões são os do comando dito padrão, que é como os
// navegadores apresentam qualquer comando de marca conhecida. O nome da
// Xbox vem primeiro, o da PlayStation a seguir.
const BOTAO = {
    A: 0,            // A / Cruz
    B: 1,            // B / Círculo
    X: 2,            // X / Quadrado
    Y: 3,            // Y / Triângulo
    LB: 4,           // LB / L1
    RB: 5,           // RB / R1
    LT: 6,           // LT / L2
    RT: 7,           // RT / R2
    SELECT: 8,       // Ver / Share
    START: 9,        // Menu / Options
    CIMA: 12,
    BAIXO: 13,
    ESQUERDA: 14,
    DIREITA: 15
};

// A partir de que ponto um gatilho conta como carregado, e a partir de que
// ponto um stick conta como empurrado. Os gatilhos ficam raramente a zero
// em repouso, e os sticks ainda menos: sem esta folga o comando andava
// sozinho.
const LIMIAR_DO_GATILHO = 0.12;
const LIMIAR_DO_STICK = 0.5;

// Quanto tempo a cruz direccional espera antes de começar a repetir, e de
// quanto em quanto tempo repete depois disso. São os tempos de um teclado:
// uma pancada seca dá um passo, mantida a dedo dá uma fila deles.
const ESPERA_ATE_REPETIR = 0.45;
const INTERVALO_DA_REPETICAO = 0.12;

// A classe que marca o que está escolhido. O desenho dela vive no
// index.html, ao pé do resto do aspecto do site.
const CLASSE_DO_FOCO = 'comando-foco';

// Os marcadores do mapa já sabem acender-se: é a mesma classe que o site
// usa quando o rato pára em cima de um deles.
const CLASSE_DO_MARCADOR = 'force-hover';

/**
 * Diz se um elemento está mesmo à vista.
 *
 * Não chega perguntar se existe: o site esconde coisas de três maneiras
 * diferentes — tirando-as do desenho, tornando-as transparentes e
 * mandando-as para fora do ecrã — e um botão escondido não pode ser
 * escolhido.
 *
 * @param {Element} el - O elemento a testar.
 * @returns {boolean} Verdadeiro se estiver visível e alcançável.
 */
function estaAVista(el) {
    if (!el || !el.isConnected) return false;
    if (el.disabled) return false;
    const caixa = el.getBoundingClientRect();
    if (caixa.width < 1 || caixa.height < 1) return false;
    if (caixa.bottom < 0 || caixa.right < 0) return false;
    if (caixa.top > window.innerHeight || caixa.left > window.innerWidth) return false;
    const estilo = window.getComputedStyle(el);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') return false;
    if (parseFloat(estilo.opacity) < 0.05) return false;
    return true;
}

/**
 * Um comando ligado, ou nada se não houver nenhum.
 *
 * @returns {Gamepad|null} O primeiro comando com botões.
 */
function comandoLigado() {
    if (!navigator.getGamepads) return null;
    const todos = navigator.getGamepads();
    for (let i = 0; i < todos.length; i++) {
        const c = todos[i];
        if (c && c.connected && c.buttons && c.buttons.length) return c;
    }
    return null;
}

/**
 * Liga o comando de jogo ao site inteiro.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {object} Uma maneira de o desligar, e o estado para quem quiser ver.
 */
export function ligarComando(app) {
    // O que estava carregado na imagem anterior, para se saber o que é uma
    // pancada nova e o que é um dedo que ficou pousado.
    let antes = [];
    // Há quanto tempo cada direcção está a ser mantida, para a repetição.
    const mantido = {};
    // Onde está o foco em cada sítio. Guardado por contexto, para quem sai
    // de um menu e volta a ele encontrar a linha onde estava.
    const foco = { mapa: 0, menu: 0 };
    let ultimoContexto = '';

    // No mapa, com o comando na mão, o marcador escolhido é o que está
    // mais perto do meio do ecrã: vira-se a vista e a escolha acompanha,
    // como uma mira. A cruz direccional ainda passa de marcador em
    // marcador; depois de a usar, a mira fica quieta um instante, para a
    // escolha à mão não ser logo desfeita.
    const MIRA_SUSPENSA_MS = 1500;
    let miraSuspensaAte = 0;
    // As setas que estão carregadas com o Alt em baixo. Servem para virar a
    // cabeça nas paragens 360º, e têm de ser sabidas a cada imagem: uma
    // tecla carregada é uma coisa que dura, não um aviso que passa.
    const setasDeOlhar = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
    // E as letras que fazem o mesmo sem Alt nenhum: o W, A, S e D, olhados
    // pelo lugar da tecla para serem as mesmas quatro em qualquer teclado.
    // Só valem numa paragem 360º — no bairro são as que fazem andar.
    const letrasDeOlhar = { KeyA: false, KeyD: false, KeyW: false, KeyS: false };
    // Quanto vale um toque só numa dessas letras, em segundos de tecla
    // segurada: chega para se notar, e não passa disso.
    const TOQUE_DE_OLHAR = 0.08;
    let alvoAceso = null;
    let camaraDesligadaPorNos = false;
    let velocidadeDeBase = null;

    /**
     * Os comandos da câmara, quando já existirem.
     *
     * @returns {object|null} O guião da câmara.
     */
    function camara() {
        const ent = app.root.findByName('camera');
        return (ent && ent.script && ent.script.cameraControls) || null;
    }

    /**
     * Onde é que estamos: que janela ou menu está à frente de tudo.
     *
     * A ordem importa. Uma janela de vídeo aberta tapa o mapa, e um menu
     * aberto tapa o mapa também; quem manda é o que está por cima.
     *
     * @returns {string} O nome do contexto.
     */
    function contexto() {
        if (janelaAberta('video-modal')) return 'video';
        if (janelaAberta('modal-360')) return 'palco360';
        if (menuAberto()) return 'menu';
        return 'mapa';
    }

    /**
     * Se uma das janelas grandes está aberta.
     *
     * Repare-se que aqui não se pergunta pela transparência, como se
     * pergunta a um botão. Estas janelas abrem a esbater-se, de zero até
     * um, e durante essa meia dúzia de imagens estão abertas na mesma —
     * quem pergunta se estão só quer saber quem manda no comando.
     *
     * @param {string} id - O nome da janela.
     * @returns {boolean} Se está aberta.
     */
    function janelaAberta(id) {
        const el = document.getElementById(id);
        return !!el && el.isConnected && el.style.display !== 'none' &&
            window.getComputedStyle(el).display !== 'none';
    }

    /**
     * O menu que estiver aberto, se algum estiver.
     *
     * @returns {Element|null} O menu.
     */
    function menuAberto() {
        const nomes = ['definicoes-menu', 'idioma-menu', 'dev-menu'];
        for (const nome of nomes) {
            const el = document.getElementById(nome);
            if (el && el.classList.contains('open')) return el;
        }
        return null;
    }

    /**
     * As linhas de um menu por onde se pode andar, pela ordem em que se
     * vêem.
     *
     * @param {Element} menu - O menu aberto.
     * @returns {Element[]} O que lá dentro se pode escolher.
     */
    function linhasDoMenu(menu) {
        const tudo = menu.querySelectorAll(
            'input[type="radio"], input[type="checkbox"], input[type="range"], button, a[href]'
        );
        return Array.from(tudo).filter(estaAVista);
    }

    /**
     * Os marcadores do bairro que estão à vista, da esquerda para a
     * direita.
     *
     * A ordem é a do ecrã e não a da lista: quem carrega para a direita
     * espera ir para o marcador que vê à direita, não para o seguinte de
     * uma lista que ninguém lhe mostrou.
     *
     * @returns {Element[]} Os marcadores.
     */
    function marcadoresAVista() {
        const caixa = document.getElementById('annotations-container');
        if (!caixa) return [];
        return Array.from(caixa.querySelectorAll('.annotation-marker'))
            .filter(estaAVista)
            .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    }

    /**
     * O marcador do bairro mais perto do meio do ecrã, de entre os que
     * estão à vista.
     *
     * @returns {Element|null} O marcador, ou nada se não há nenhum à vista.
     */
    function marcadorMaisPertoDoMeio() {
        const meioX = window.innerWidth / 2;
        const meioY = window.innerHeight / 2;
        let melhor = null;
        let menor = Infinity;
        for (const marcador of marcadoresAVista()) {
            const ponto = marcador.querySelector('.marker-dot') || marcador;
            const r = ponto.getBoundingClientRect();
            const dx = r.left + r.width / 2 - meioX;
            const dy = r.top + r.height / 2 - meioY;
            const d = dx * dx + dy * dy;
            if (d < menor) { menor = d; melhor = marcador; }
        }
        return melhor;
    }

    /**
     * O que se pode escolher, aqui e agora.
     *
     * @param {string} onde - O contexto.
     * @returns {Element[]} A lista por onde a cruz anda.
     */
    function alvos(onde) {
        if (onde === 'menu') {
            const menu = menuAberto();
            return menu ? linhasDoMenu(menu) : [];
        }
        if (onde === 'mapa') return marcadoresAVista();
        return [];
    }

    /**
     * Acende o que está escolhido e apaga o que deixou de estar.
     *
     * @param {Element|null} el - O novo escolhido.
     */
    function acender(el) {
        if (alvoAceso === el) return;
        if (alvoAceso) {
            alvoAceso.classList.remove(CLASSE_DO_FOCO, CLASSE_DO_MARCADOR);
        }
        alvoAceso = el || null;
        if (alvoAceso) {
            const marcador = alvoAceso.classList.contains('annotation-marker');
            alvoAceso.classList.add(marcador ? CLASSE_DO_MARCADOR : CLASSE_DO_FOCO);
            if (!marcador && alvoAceso.scrollIntoView) {
                alvoAceso.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    /**
     * Manda uma tecla ao site, como se alguém lhe tivesse carregado.
     *
     * É assim que o comando fala com a janela do vídeo: ela já ouve o
     * espaço e as setas, e não vale a pena ensinar-lhe outra língua.
     *
     * @param {string} tecla - O nome da tecla.
     */
    function mandarTecla(tecla) {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: tecla,
            bubbles: true,
            cancelable: true
        }));
    }

    /**
     * Carrega num botão do site, se ele lá estiver e estiver à vista.
     *
     * @param {string} selector - Onde procurá-lo.
     * @param {Element} [dentro] - Onde procurar, se não for a página toda.
     * @returns {boolean} Se chegou a carregar nalguma coisa.
     */
    function carregarEm(selector, dentro) {
        const el = (dentro || document).querySelector(selector);
        if (!el || !estaAVista(el)) return false;
        el.click();
        return true;
    }

    /**
     * Faz o que um botão do comando manda fazer, aqui e agora.
     *
     * @param {Element|null} el - O que está escolhido.
     */
    function activar(el) {
        if (!el) return;
        if (el.tagName === 'INPUT' && el.type === 'range') return;
        el.click();
    }

    /**
     * Mexe num cursor de menu para um lado ou para o outro.
     *
     * @param {Element} el - O cursor.
     * @param {number} sentido - Menos um para a esquerda, um para a direita.
     */
    function empurrarCursor(el, sentido) {
        const passo = parseFloat(el.step) || 1;
        const min = parseFloat(el.min);
        const max = parseFloat(el.max);
        let valor = parseFloat(el.value) + passo * sentido * 4;
        if (isFinite(min)) valor = Math.max(min, valor);
        if (isFinite(max)) valor = Math.min(max, valor);
        el.value = valor;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * Enquanto uma janela ou um menu estiver aberto, o mapa não anda.
     *
     * Os sticks são lidos pelo motor esteja o que estiver à frente, e sem
     * isto a câmara passeava-se por trás da janela do vídeo enquanto se
     * mexia nos comandos dele.
     *
     * @param {boolean} livre - Se o mapa pode andar.
     */
    function deixarAndarOMapa(livre) {
        const c = camara();
        if (!c) return;
        if (!livre && c.enabled) {
            c.enabled = false;
            camaraDesligadaPorNos = true;
        } else if (livre && camaraDesligadaPorNos) {
            c.enabled = true;
            camaraDesligadaPorNos = false;
        }
    }

    /**
     * Os gatilhos mandam na velocidade: o direito acelera, o esquerdo
     * abranda, e a meio caminho dão meia velocidade. São analógicos, e
     * seria pena tratá-los como interruptores.
     *
     * @param {Gamepad} pad - O comando.
     */
    function afinarVelocidade(pad) {
        const c = camara();
        if (!c) return;
        if (velocidadeDeBase === null) velocidadeDeBase = c.moveSpeed;
        const acelera = valorDoBotao(pad, BOTAO.RT);
        const abranda = valorDoBotao(pad, BOTAO.LT);
        let v = velocidadeDeBase;
        if (acelera > LIMIAR_DO_GATILHO) {
            v = velocidadeDeBase + (c.moveFastSpeed - velocidadeDeBase) * acelera;
        } else if (abranda > LIMIAR_DO_GATILHO) {
            v = velocidadeDeBase + (c.moveSlowSpeed - velocidadeDeBase) * abranda;
        }
        c.moveSpeed = v;
    }

    /**
     * Quanto está carregado um botão, de zero a um.
     *
     * @param {Gamepad} pad - O comando.
     * @param {number} n - O número do botão.
     * @returns {number} O quanto.
     */
    function valorDoBotao(pad, n) {
        const b = pad.buttons[n];
        if (!b) return 0;
        return typeof b === 'object' ? b.value : b;
    }

    /**
     * Se um botão está carregado agora.
     *
     * @param {Gamepad} pad - O comando.
     * @param {number} n - O número do botão.
     * @returns {boolean} Se sim.
     */
    function carregado(pad, n) {
        const b = pad.buttons[n];
        if (!b) return false;
        return typeof b === 'object' ? b.pressed : b > LIMIAR_DO_GATILHO;
    }

    /**
     * Se um botão acabou de ser carregado nesta imagem.
     *
     * @param {Gamepad} pad - O comando.
     * @param {number} n - O número do botão.
     * @returns {boolean} Se sim.
     */
    function bateuAgora(pad, n) {
        return carregado(pad, n) && !antes[n];
    }

    /**
     * A cruz direccional, com repetição: uma pancada dá um passo, o dedo
     * pousado dá uma fila deles. O stick esquerdo faz o mesmo quando não
     * está a andar pelo mapa.
     *
     * @param {Gamepad} pad - O comando.
     * @param {number} n - O número do botão.
     * @param {number} dt - O tempo desde a imagem anterior.
     * @param {number} [eixo] - Um eixo do stick que valha pelo mesmo.
     * @returns {boolean} Se deve dar um passo nesta imagem.
     */
    function passoDaCruz(pad, n, dt, eixo) {
        const activo = carregado(pad, n) || (eixo !== undefined && eixo);
        if (!activo) {
            mantido[n] = 0;
            return false;
        }
        const antesDisto = mantido[n] || 0;
        mantido[n] = antesDisto + dt;
        if (antesDisto === 0) return true;
        if (antesDisto < ESPERA_ATE_REPETIR) return false;
        const passosAntes = Math.floor((antesDisto - ESPERA_ATE_REPETIR) / INTERVALO_DA_REPETICAO);
        const passosAgora = Math.floor((mantido[n] - ESPERA_ATE_REPETIR) / INTERVALO_DA_REPETICAO);
        return passosAgora > passosAntes;
    }

    /**
     * Anda com o foco para a frente ou para trás, dando a volta nas pontas.
     *
     * @param {string} onde - O contexto.
     * @param {number} sentido - Menos um para trás, um para a frente.
     */
    function andarComOFoco(onde, sentido) {
        const lista = alvos(onde);
        if (!lista.length) return;
        const chave = onde === 'menu' ? 'menu' : 'mapa';
        let i = lista.indexOf(alvoAceso);
        if (i < 0) i = Math.min(foco[chave] || 0, lista.length - 1) - (sentido > 0 ? 1 : 0);
        i = (i + sentido + lista.length * 2) % lista.length;
        foco[chave] = i;
        acender(lista[i]);
    }

    /**
     * Uma imagem de trabalho do comando.
     *
     * @param {number} dt - O tempo desde a imagem anterior.
     */
    function passo(dt) {
        // Isto vale haja comando ou não: com uma janela ou um menu aberto,
        // o mapa não anda. Não é só pelos sticks — as setas do teclado
        // fazem o mesmo, e sem isto andavam a passear a câmara por trás da
        // janela do vídeo enquanto se escolhia uma linha do menu.
        const onde = contexto();
        deixarAndarOMapa(onde === 'mapa');

        // Ao mudar de sítio, o foco antigo já não quer dizer nada.
        if (onde !== ultimoContexto) {
            ultimoContexto = onde;
            acender(null);
        }

        const pad = comandoLigado();
        if (!pad) {
            antes = [];
            // Sem comando ligado, as setas com o Alt continuam a ter de
            // virar a cabeça de quem está numa paragem 360º.
            if (onde === 'palco360' && (olharX() || olharY())) {
                const so = janelaDoPalco(document.getElementById('modal-360'));
                if (so) so.olhar(olharX(), olharY(), dt);
            }
            return;
        }
        if (onde === 'mapa') afinarVelocidade(pad);

        // O stick esquerdo faz as vezes da cruz onde ele não serve para
        // andar — nos menus e nas janelas.
        const eixoX = onde === 'mapa' ? 0 : (pad.axes[0] || 0);
        const eixoY = onde === 'mapa' ? 0 : (pad.axes[1] || 0);
        const paraCima = passoDaCruz(pad, BOTAO.CIMA, dt, eixoY < -LIMIAR_DO_STICK);
        const paraBaixo = passoDaCruz(pad, BOTAO.BAIXO, dt, eixoY > LIMIAR_DO_STICK);
        const paraEsquerda = passoDaCruz(pad, BOTAO.ESQUERDA, dt, eixoX < -LIMIAR_DO_STICK);
        const paraDireita = passoDaCruz(pad, BOTAO.DIREITA, dt, eixoX > LIMIAR_DO_STICK);

        if (onde === 'mapa') {
            if (paraEsquerda || paraCima) { andarComOFoco(onde, -1); miraSuspensaAte = performance.now() + MIRA_SUSPENSA_MS; }
            if (paraDireita || paraBaixo) { andarComOFoco(onde, 1); miraSuspensaAte = performance.now() + MIRA_SUSPENSA_MS; }
            // A mira: o marcador mais perto do meio do ecrã fica escolhido.
            if (performance.now() >= miraSuspensaAte) acender(marcadorMaisPertoDoMeio());
            if (bateuAgora(pad, BOTAO.A)) activar(alvoAceso);
            // Com o cartão das instruções aberto, o B fecha-o, como a cruz
            // do canto dele. Sem cartão, larga o marcador escolhido.
            if (bateuAgora(pad, BOTAO.B) && !carregarEm('#instrucoes.aberta .menu-fechar')) acender(null);
            if (bateuAgora(pad, BOTAO.X)) carregarEm('#recenter-btn');
            if (bateuAgora(pad, BOTAO.Y)) carregarEm('#fullscreen-main-btn');
            if (bateuAgora(pad, BOTAO.START)) carregarEm('#definicoes-btn');
            if (bateuAgora(pad, BOTAO.SELECT)) carregarEm('#idioma-btn');
            return;
        }

        if (onde === 'menu') {
            if (paraCima) andarComOFoco(onde, -1);
            if (paraBaixo) andarComOFoco(onde, 1);
            const cursor = alvoAceso && alvoAceso.tagName === 'INPUT' &&
                alvoAceso.type === 'range' ? alvoAceso : null;
            if (cursor && paraEsquerda) empurrarCursor(cursor, -1);
            if (cursor && paraDireita) empurrarCursor(cursor, 1);
            if (bateuAgora(pad, BOTAO.A)) activar(alvoAceso);
            if (bateuAgora(pad, BOTAO.B) || bateuAgora(pad, BOTAO.START)) {
                const menu = menuAberto();
                if (menu) menu.classList.remove('open');
                acender(null);
            }
            return;
        }

        // Daqui para baixo é uma janela aberta — o vídeo ou o palco das
        // paragens 360º. Fecham-se as duas da mesma maneira, e as setas
        // dos lados são as mesmas.
        const janela = document.getElementById(onde === 'video' ? 'video-modal' : 'modal-360');

        if (bateuAgora(pad, BOTAO.B)) {
            // Se a rota 360º tiver as instruções abertas lá dentro, o B
            // fecha-as primeiro, e o filme segue; a janela fecha-se com o
            // B seguinte.
            const dentro = janelaDoPalco(janela);
            const fechouInstrucoes = !!dentro && typeof dentro.fecharInstrucoes === 'function' &&
                dentro.fecharInstrucoes();
            if (!fechouInstrucoes) carregarEm('.fechar-palco-btn', janela);
            return;
        }
        if (bateuAgora(pad, BOTAO.LB)) carregarEm('.seta-do-palco.esquerda', janela);
        if (bateuAgora(pad, BOTAO.RB)) carregarEm('.seta-do-palco.direita', janela);

        if (onde === 'video') {
            if (bateuAgora(pad, BOTAO.A)) mandarTecla(' ');
            if (bateuAgora(pad, BOTAO.X)) mandarTecla('m');
            if (bateuAgora(pad, BOTAO.Y)) mandarTecla('f');
            if (paraEsquerda) mandarTecla('ArrowLeft');
            if (paraDireita) mandarTecla('ArrowRight');
            if (paraCima) mandarTecla('ArrowUp');
            if (paraBaixo) mandarTecla('ArrowDown');
            return;
        }

        // Uma paragem 360º é uma página dentro de uma moldura, e o
        // navegador não mostra o comando a quem está lá dentro: um comando
        // só aparece a uma página depois de alguém lhe ter tocado, e
        // ninguém toca dentro da moldura. Quem o vê somos nós, aqui fora —
        // por isso é daqui que se lhe vira a cabeça e se lhe carrega nos
        // botões, por duas portas que a página de dentro deixa abertas.
        const dentro = janelaDoPalco(janela);
        if (!dentro) return;

        dentro.olhar(
            (pad.axes[2] || 0) + olharX(),
            (pad.axes[3] || 0) + olharY(),
            dt
        );
        if (bateuAgora(pad, BOTAO.A)) dentro.botao('tocar');
        if (bateuAgora(pad, BOTAO.X)) dentro.botao('volume-btn');
        if (bateuAgora(pad, BOTAO.Y)) dentro.botao('fullscreen-btn');
        if (paraEsquerda) dentro.botao('recuar-btn');
        if (paraDireita) dentro.botao('avancar-btn');
    }

    /**
     * Passa uma tecla do filme para dentro da moldura da paragem 360º.
     *
     * O espaço, o M, os números: são teclas da página de dentro, mas o
     * navegador só as entrega a quem tem o foco, e quem abriu a paragem
     * com um clique no mapa tem o foco cá fora. Sem isto, carregava-se
     * no espaço e o filme não parava. Não vão por aqui as teclas que se
     * seguram — o W, A, S e D — porque uma tecla mandada de fora nunca se
     * larga; essas vão a cada imagem, pelo olhar. Nem o espaço e o Enter
     * quando o foco está num botão do palco, que aí são desse botão.
     *
     * @param {KeyboardEvent} e - A tecla carregada.
     * @param {Element} janela - O palco das paragens.
     */
    function passarTeclaParaDentro(e, janela) {
        if (!e.isTrusted || e.key === 'Tab' || e.code in letrasDeOlhar) return;
        const comFoco = document.activeElement;
        const numBotao = comFoco && /^(?:BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(comFoco.tagName);
        if (numBotao && (e.key === ' ' || e.key === 'Enter')) return;
        const dentro = janelaDoPalco(janela);
        if (!dentro || typeof dentro.tecla !== 'function') return;
        dentro.tecla({ key: e.key, code: e.code, shiftKey: e.shiftKey });
        if (e.key === ' ') e.preventDefault();
    }

    /**
     * As portas da página que está dentro da moldura da paragem 360º.
     *
     * A página é nossa e vem do mesmo sítio, por isso pode ser alcançada;
     * mas pode ainda não ter acabado de nascer, e nesse caso não há portas
     * nenhumas — espera-se pela imagem seguinte.
     *
     * @param {Element} palco - A janela do palco.
     * @returns {object|null} As portas, ou nada.
     */
    function janelaDoPalco(palco) {
        const moldura = palco && palco.querySelector('iframe');
        if (!moldura) return null;
        try {
            const porta = moldura.contentWindow && moldura.contentWindow.comandoDaJanela;
            return (porta && typeof porta.olhar === 'function') ? porta : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Guarda o que está carregado, para a imagem seguinte saber o que é
     * novo.
     *
     * @param {Gamepad|null} pad - O comando.
     */
    function guardarOEstado(pad) {
        if (!pad) { antes = []; return; }
        antes = pad.buttons.map(b => (typeof b === 'object' ? b.pressed : b > LIMIAR_DO_GATILHO));
    }

    const aCadaImagem = (dt) => {
        try {
            passo(dt);
            guardarOEstado(comandoLigado());
        } catch (e) {
            // Um comando que se desliga a meio, uma janela que fecha entre
            // duas linhas: nada disto merece parar o bairro.
        }
    };

    app.on('update', aCadaImagem);

    /**
     * Quanto as setas com Alt estão a pedir para o lado, de menos um a um.
     *
     * @returns {number} O pedido.
     */
    function olharX() {
        return ((setasDeOlhar.ArrowRight || letrasDeOlhar.KeyD) ? 1 : 0) -
            ((setasDeOlhar.ArrowLeft || letrasDeOlhar.KeyA) ? 1 : 0);
    }

    /**
     * Quanto as setas com Alt estão a pedir para cima e para baixo.
     *
     * O sinal é o do stick de um comando — para cima é negativo — porque
     * é pelo mesmo cano que isto vai sair.
     *
     * @returns {number} O pedido.
     */
    function olharY() {
        return ((setasDeOlhar.ArrowDown || letrasDeOlhar.KeyS) ? 1 : 0) -
            ((setasDeOlhar.ArrowUp || letrasDeOlhar.KeyW) ? 1 : 0);
    }

    /**
     * Toma nota das setas que estão carregadas com o Alt em baixo, e das
     * letras de olhar carregadas numa paragem 360º.
     *
     * @param {KeyboardEvent} e - A tecla.
     * @param {boolean} carregada - Se está a ser carregada ou largada.
     */
    function anotarSetaDeOlhar(e, carregada) {
        // O lugar da tecla — ou, se o teclado não o disser, a letra.
        const lugar = e.code || (e.key && e.key.length === 1 ? 'Key' + e.key.toUpperCase() : '');
        if (lugar in letrasDeOlhar) {
            const vale = carregada && !e.altKey && !e.ctrlKey && !e.metaKey &&
                contexto() === 'palco360';
            // Um toque só dá logo um empurrão: assim a tecla responde mesmo
            // que seja largada antes de a imagem seguinte a ver.
            if (vale && !letrasDeOlhar[lugar] && !e.repeat) {
                const so = janelaDoPalco(document.getElementById('modal-360'));
                if (so) {
                    so.olhar(
                        (lugar === 'KeyD' ? 1 : 0) - (lugar === 'KeyA' ? 1 : 0),
                        (lugar === 'KeyS' ? 1 : 0) - (lugar === 'KeyW' ? 1 : 0),
                        TOQUE_DE_OLHAR
                    );
                }
            }
            letrasDeOlhar[lugar] = vale;
        }
        if (!(e.key in setasDeOlhar)) return;
        setasDeOlhar[e.key] = carregada && e.altKey;
        if (!e.altKey) {
            for (const k in setasDeOlhar) setasDeOlhar[k] = false;
        }
    }

    /**
     * As teclas que faltavam ao site.
     *
     * O teclado já andava pelo bairro — isso é da câmara — e já mandava no
     * vídeo. O que não fazia era alcançar o resto: escolher um marcador,
     * andar por um menu, fechar o que estivesse aberto. Como o comando de
     * jogo já sabe fazer tudo isso, o teclado entra pela mesma porta em vez
     * de levar uma maquinaria sua: as mesmas acções, os mesmos sinais à
     * vista, um sítio só para as corrigir.
     *
     * @param {KeyboardEvent} e - A tecla carregada.
     */
    function aoCarregarNumaTecla(e) {
        anotarSetaDeOlhar(e, true);
        if (e.ctrlKey || e.metaKey) return;
        // Quem está a escrever num campo está a escrever, não a comandar.
        const alvo = e.target;
        if (alvo && /^(?:INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) &&
            !(alvo.type === 'radio' || alvo.type === 'checkbox')) {
            return;
        }

        const onde = contexto();

        // O Escape fecha o que estiver aberto, de fora para dentro, que é
        // o que ele faz em qualquer sítio.
        if (e.key === 'Escape') {
            if (onde === 'video' || onde === 'palco360') {
                const janela = document.getElementById(
                    onde === 'video' ? 'video-modal' : 'modal-360');
                if (carregarEm('.fechar-palco-btn', janela)) e.preventDefault();
                return;
            }
            const menu = menuAberto();
            if (menu) {
                menu.classList.remove('open');
                acender(null);
                e.preventDefault();
                return;
            }
            if (alvoAceso) {
                acender(null);
                e.preventDefault();
            }
            // E larga também o marcador em que o Tab tenha parado.
            const comFoco = document.activeElement;
            if (comFoco && comFoco.classList &&
                comFoco.classList.contains('annotation-marker')) {
                comFoco.blur();
                e.preventDefault();
            }
            return;
        }

        // O anterior e o seguinte do palco, seja o dos testemunhos ou o das
        // paragens: as setas dos lados, que são as mesmas em que o comando
        // carrega e as mesmas que se vêem desenhadas de cada lado da
        // janela. Quem quiser saltar dentro do filme tem o J e o L.
        if (onde === 'video' || onde === 'palco360') {
            if (e.altKey) return;
            const janela = document.getElementById(
                onde === 'video' ? 'video-modal' : 'modal-360');
            // Numa paragem avulsa não há setas dos lados, e as do teclado
            // vão para dentro: no timelapse passam à fotografia do lado.
            if (e.key === 'ArrowLeft') {
                if (carregarEm('.seta-do-palco.esquerda', janela)) e.preventDefault();
                else if (onde === 'palco360') passarTeclaParaDentro(e, janela);
            } else if (e.key === 'ArrowRight') {
                if (carregarEm('.seta-do-palco.direita', janela)) e.preventDefault();
                else if (onde === 'palco360') passarTeclaParaDentro(e, janela);
            } else if (onde === 'palco360') {
                passarTeclaParaDentro(e, janela);
            }
            return;
        }

        // Dentro de um menu, as setas andam pelas linhas e o Enter escolhe.
        if (onde === 'menu') {
            const menu = menuAberto();
            if (e.key === 'ArrowUp') { andarComOFoco(onde, -1); e.preventDefault(); }
            else if (e.key === 'ArrowDown') { andarComOFoco(onde, 1); e.preventDefault(); }
            else if (e.key === 'Enter' || e.key === ' ') {
                if (alvoAceso) { activar(alvoAceso); e.preventDefault(); }
            } else if (alvoAceso && alvoAceso.tagName === 'INPUT' && alvoAceso.type === 'range') {
                if (e.key === 'ArrowLeft') { empurrarCursor(alvoAceso, -1); e.preventDefault(); }
                else if (e.key === 'ArrowRight') { empurrarCursor(alvoAceso, 1); e.preventDefault(); }
            }
            if (menu) { /* o menu continua aberto */ }
            return;
        }

        // No bairro não há aqui nada a fazer com o Tab nem com o Enter.
        //
        // Houve, durante um tempo: os marcadores eram caixas soltas, o Tab
        // do navegador não lhes chegava, e era este ficheiro que o desviava
        // para andar por eles. Desde que passaram a ser botões a sério — com
        // papel, com nome e ao alcance do Tab — quem faz isso é o próprio
        // navegador, e fá-lo melhor: a mesma tecla passa também pelos botões
        // do cabeçalho, que dantes ficavam de fora.
        //
        // O comando de jogo continua com a cruz direccional, que é outra
        // coisa e não mexe no foco do navegador.
    }

    const aoLargarUmaTecla = (e) => anotarSetaDeOlhar(e, false);
    const aoSairDaJanela = () => {
        for (const k in setasDeOlhar) setasDeOlhar[k] = false;
        for (const k in letrasDeOlhar) letrasDeOlhar[k] = false;
    };
    document.addEventListener('keydown', aoCarregarNumaTecla);
    document.addEventListener('keyup', aoLargarUmaTecla);
    window.addEventListener('blur', aoSairDaJanela);

    return {
        /** Onde o comando julga que estamos. */
        get contexto() {
            return contexto();
        },
        /** Se há algum comando ligado. */
        get ligado() {
            return !!comandoLigado();
        },
        /** Desliga tudo e deixa a página como estava. */
        desligar() {
            app.off('update', aCadaImagem);
            document.removeEventListener('keydown', aoCarregarNumaTecla);
            document.removeEventListener('keyup', aoLargarUmaTecla);
            window.removeEventListener('blur', aoSairDaJanela);
            acender(null);
            deixarAndarOMapa(true);
            const c = camara();
            if (c && velocidadeDeBase !== null) c.moveSpeed = velocidadeDeBase;
        }
    };
}
