import * as pc from 'playcanvas';
import { fontesDeVideo, previaDe, olharInicialDe, ABERTURA_INICIAL } from './videos.mjs?v=7';
import { criarGestorDeQualidade } from './qualidade-video.mjs?v=9';
import { carregarPrevia360 } from './previa-360.mjs?v=1';

export const AnnotationController = pc.createScript('annotationController');

/**
 * Faz o que está dentro de uma ou mais barras surgir a esbater, de novo
 * a cada vez.
 *
 * A animação vive na roupa (`a-surgir`); tirá-la e voltar a pô-la, com
 * uma medição pelo meio para o navegador dar pela mudança, recomeça-a.
 *
 * @param {{demora: string, soBotoes: boolean}} como - Quanto esperar antes
 *     de esbater ('0.45s', '0s'), e se o nome fica de fora (só os botões).
 * @param {...HTMLElement} barras - As barras a fazer surgir.
 */
function fazerSurgir(como, ...barras) {
    for (const barra of barras) {
        if (!barra) continue;
        barra.classList.remove('a-surgir');
        void barra.offsetWidth;
        barra.style.setProperty('--demora-a-surgir', como.demora);
        barra.classList.toggle('so-botoes', !!como.soBotoes);
        barra.classList.add('a-surgir');
    }
}

/**
 * Avisa que o bairro está a voltar.
 *
 * Fechar um vídeo é acender outra vez as manchas 3D, e isso demora um
 * instante. Sem este aviso ficava um ecrã preto pelo meio, como se a
 * página tivesse encravado.
 *
 * @returns {HTMLElement|null} O aviso, para depois se poder arrumar.
 */
function avisarQueOBairroVolta() {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        return null;
    }
    const letreiro = overlay.querySelector('.loading-text');
    // Sem desvanecer: o aviso tem de estar no ecrã já a seguir ao clique.
    overlay.style.transition = 'none';
    if (letreiro) {
        letreiro.innerText = (window.Idiomas ? window.Idiomas.t('carga.restaurar') : 'A restaurar ambiente 3D…');
    }
    overlay.classList.remove('hidden');
    return overlay;
}

/**
 * Arruma o aviso, depois de dar tempo ao bairro para se desenhar.
 *
 * @param {HTMLElement|null} overlay - O aviso que estava no ecrã.
 */
function arrumarAvisoDoBairro(overlay) {
    if (!overlay) {
        return;
    }
    setTimeout(() => {
        overlay.style.transition = '';
        overlay.classList.add('hidden');
        setTimeout(() => {
            const letreiro = overlay.querySelector('.loading-text');
            if (letreiro) {
                letreiro.innerText = (window.Idiomas ? window.Idiomas.t('carga.modelo') : 'A carregar modelo 3D…');
            }
        }, 800);
    }, 800);
}

/**
 * Põe uma janela grande no ecrã de uma vez, sem desvanecer.
 *
 * A janela nasce sobre o bairro no instante do clique, já opaca: é ela
 * que tapa o apagar do mapa, feito logo a seguir para poupar a placa
 * gráfica. Com o desvanecer de antes via-se o bairro a sumir por trás de
 * uma janela ainda transparente. O desvanecer fica só para o fechar, e a
 * janela do meio continua a assentar como assentava.
 *
 * @param {HTMLElement} modal - A janela a abrir.
 */
function abrirDeRepente(modal) {
    modal.style.transition = 'none';
    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.style.opacity = '1';
    void modal.offsetWidth;
    modal.style.transition = 'opacity 0.3s ease';
}

/**
 * Apaga o bairro por trás de uma janela aberta, para poupar a placa
 * gráfica — mas só depois de a janela estar mesmo no ecrã, para o apagar
 * nunca se ver.
 *
 * @param {object} app - A aplicação 3D.
 */
function apagarOBairroPorTras(app) {
    setTimeout(() => {
        const gsplat = app.root.findByName('gsplat-scene');
        if (gsplat) gsplat.enabled = false;
    }, 100);
}

// Quanto tempo as peças por cima do vídeo ficam à vista depois de o rato
// parar.
const PECAS_A_VER_MS = 3000;

/**
 * As peças que pairam por cima do vídeo — a barra do nome, a dos comandos,
 * e as setas com as imagens dos lados — aparecem quando o rato mexe e
 * somem-se sozinhas quando ele pára.
 *
 * O vídeo enche a janela toda, e estas peças tapavam-no. Por isso só vêm
 * quando o rato mexe, quando se toca no ecrã, ou quando se chega a uma
 * delas pelo teclado; e vão-se uns segundos depois. Enquanto o rato
 * estiver pousado numa delas, o foco do teclado lá dentro, ou o menu das
 * resoluções aberto, ficam. Arrastar a vista de uma rota não conta como
 * mexer: quem arrasta está a olhar à volta, e as peças só estorvavam.
 *
 * O que está à vista diz-se com a roupa `comandos-a-ver` no palco.
 *
 * @param {HTMLElement} modal - O palco.
 * @param {Function} [aoMudar] - Chamada com `true` ou `false` sempre que as
 *     peças aparecem ou se somem.
 * @returns {{mostrar: Function, esconder: Function}} As duas mãos.
 */
function pecasQueSeEscondem(modal, aoMudar) {
    let relogio = null;
    let ultimoX = null;
    let ultimoY = null;

    // O que segura as peças no ecrã.
    const seguras = () => {
        if (modal.querySelector('.lado-do-palco > :hover, .barra-do-nome > :hover, ' +
            '.barra-do-nome-360 > :hover, .video-controls:hover, .quality-menu.show')) {
            return true;
        }
        const foco = document.activeElement;
        return !!foco && foco.tagName !== 'IFRAME' && modal.contains(foco) &&
            foco.matches(':focus-visible');
    };

    const esconder = () => {
        clearTimeout(relogio);
        if (!modal.classList.contains('comandos-a-ver')) return;
        modal.classList.remove('comandos-a-ver');
        if (aoMudar) aoMudar(false);
    };

    const armar = () => {
        clearTimeout(relogio);
        relogio = setTimeout(() => {
            if (seguras()) armar();
            else esconder();
        }, PECAS_A_VER_MS);
    };

    const mostrar = () => {
        if (modal.style.display === 'none') return;
        if (!modal.classList.contains('comandos-a-ver')) {
            modal.classList.add('comandos-a-ver');
            if (aoMudar) aoMudar(true);
        }
        armar();
    };

    modal.addEventListener('pointermove', (e) => {
        // Só conta o rato que andou mesmo: o navegador também avisa de
        // movimentos quando é o que está por baixo dele que muda.
        if (e.screenX === ultimoX && e.screenY === ultimoY) return;
        ultimoX = e.screenX;
        ultimoY = e.screenY;
        if (e.pointerType === 'mouse' && e.buttons) return;
        mostrar();
    });
    modal.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') mostrar();
    });
    // Quem anda de tecla e chega a uma das peças tem de a ver.
    modal.addEventListener('focusin', (e) => {
        const alvo = e.target;
        if (alvo && alvo.tagName !== 'IFRAME' && alvo.matches(':focus-visible')) mostrar();
    });

    return { mostrar, esconder };
}

// Os dois desenhos do botão do ecrã inteiro: os quatro cantos a abrir, e
// os quatro cantos a fechar.
const ICONE_ECRA_INTEIRO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter"><path d="M8 3H3v5m18 0V3h-5m0 18h5v-5M3 16v5h5"></path></svg>';
const ICONE_SAIR_DO_ECRA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 9h6V3 M21 9h-6V3 M21 15h-6v6 M3 15h6v6"></path></svg>';

/**
 * Se o navegador está em ecrã inteiro — seja pelo palco, seja pelo mapa.
 *
 * @returns {boolean} Se está.
 */
function emEcraInteiro() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/**
 * Põe o palco em ecrã inteiro, ou tira-o de lá.
 *
 * O palco já enche a janela do navegador; em ecrã inteiro enche o ecrã
 * todo, sem as barras do navegador à volta. Vai o palco inteiro, e não só
 * o vídeo, para as setas dos lados e a cruz de fechar irem com ele.
 *
 * @param {HTMLElement} modal - O palco.
 */
function alternarEcraInteiro(modal) {
    try {
        let pedido;
        if (emEcraInteiro()) {
            pedido = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            const entrar = modal.requestFullscreen || modal.webkitRequestFullscreen;
            pedido = entrar && entrar.call(modal);
        }
        if (pedido && pedido.catch) pedido.catch(() => {});
    } catch (e) { /* navegador sem ecrã inteiro: fica a janela do navegador */ }
}

/**
 * Tira o palco do ecrã inteiro, ao fechar. Se quem está em ecrã inteiro é
 * o mapa, e não o palco, fica tudo como estava.
 *
 * @param {HTMLElement} modal - O palco.
 */
function sairDoEcraInteiroDo(modal) {
    if ((document.fullscreenElement || document.webkitFullscreenElement) !== modal) return;
    try {
        const pedido = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        if (pedido && pedido.catch) pedido.catch(() => {});
    } catch (e) { /* já tinha saído */ }
}

AnnotationController.prototype.initialize = function() {
    this.annotations = [
        {
            position: new pc.Vec3(0, 150, 0),
            label: "Olho de Águia",
            is360: true,
            isImage: true,
            // A mesma panorâmica que envolve o bairro, já preparada para
            // a web. Antes apontava para o ficheiro original, num formato
            // que o navegador não sabe abrir sozinho e com muitos megabytes
            // pelo meio — a janela abria vazia.
            imagePath: "/ceu-olho-de-aguia.jpg",
            element: null
        },
        {
            position: new pc.Vec3(-102.35, -14.56, 57.67),
            label: "Esvarena",
            is360: true,
            trailIndex: 0,
            element: null
        },
        {
            position: new pc.Vec3(-45.06, -7.05, 23.97),
            label: "Esvarena",
            is360: true,
            trailIndex: 1,
            element: null
        },
        {
            position: new pc.Vec3(123.70, -1.62, 92.95),
            label: "Esvarena",
            is360: true,
            trailIndex: 2,
            element: null
        },
        {
            position: new pc.Vec3(36.16, 2.49, 50.48),
            label: "Dulce",
            video: "Dulce",
            element: null
        },
        {
            position: new pc.Vec3(-67.03, -1.70, -64.40),
            label: "Luna",
            video: "Luna",
            element: null
        },
        {
            position: new pc.Vec3(-85.42, -7.76, -26.34),
            label: "Sofia",
            video: "Sofia",
            element: null
        },
        {
            position: new pc.Vec3(-38.38, 1.47, -64.20),
            label: "Frei",
            video: "Frei",
            element: null
        },
        {
            position: new pc.Vec3(94.09, 1.82, 31.41),
            label: "Edson",
            video: "Edson",
            element: null
        },
        {
            position: new pc.Vec3(-91.98, -5.48, -53.98),
            label: "Edmilson",
            video: "Edmilson",
            element: null
        },
        {
            position: new pc.Vec3(31.12, 4.32, -92.28),
            label: "Carlos",
            video: "Carlos",
            element: null
        }
    ];

    // Inject CSS for markers and custom player
    const style = document.createElement('style');
    style.textContent = `
        .annotation-marker {
            will-change: transform, opacity;
            /* Transformar a partir do canto: sem isto o navegador usa o centro
               do bloco e a posição volta a depender do tamanho. */
            transform-origin: 0 0;
            /* O ícone fica centrado sobre a etiqueta, para o marcador poder
               ser ancorado pelo ícone e não pelo conjunto. */
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .annotation-marker:hover .marker-dot, .annotation-marker.force-hover .marker-dot,
        .annotation-marker:focus-visible .marker-dot,
        .annotation-marker:hover .marker-label, .annotation-marker.force-hover .marker-label,
        .annotation-marker:focus-visible .marker-label {
            transform: scale(1.15);
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        /* Quem chega ao marcador pela tecla Tab tem de ver onde está. Acende
           como se o rato lá estivesse, e leva um risco por cima — só o
           acender não chega sobre uma fotografia cheia de contrastes. */
        .annotation-marker:focus {
            outline: none;
        }
        .annotation-marker:focus-visible {
            outline: 2px solid rgba(255, 255, 255, 0.95);
            outline-offset: 3px;
        }
        .marker-dot, .marker-label {
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .marker-dot {
            width: 32px;
            height: 32px;
            background-color: #10b981;
            color: #fff;
            border-radius: 0;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .marker-dot.is-360 {
            background-color: #ff0000;
            color: #ffffff;
        }
        /* A fotografia do alto do bairro, pousada no céu, leva a cor do
           fundo do site em vez do vermelho das rotas. */
        .marker-dot.is-360.is-foto {
            background-color: #05050a;
        }
        /* Já visto: o marcador apaga-se em cinzento e deixa passar um
           pouco do bairro por trás, para se perceber de relance o que
           falta ver sem que o que já se viu desapareça. */
        .marker-dot.viewed,
        .marker-dot.is-360.viewed {
            background-color: #8a8f98;
            color: #ffffff;
        }
        /* O último que se viu: uma caixinha da cor do fundo do site no
           canto de cima à direita do marcador, com o sinal de "voltar"
           (uma seta que dá a volta), para se saber por onde se ficou. */
        .marker-dot.last-viewed {
            z-index: 10;
        }
        .marker-dot.last-viewed::after {
            content: "";
            position: absolute;
            top: -6px;
            right: -6px;
            width: 16px;
            height: 16px;
            background: #05050a url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='square' stroke-linejoin='miter'><polyline points='5 7 20 7 20 19 4 19'/><polyline points='9 3 5 7 9 11'/></svg>") center / 11px 11px no-repeat;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
        }
        .marker-label {
            background-color: #05050a;
            color: #fff;
            padding: 5px 12px;
            border-radius: 0;
            font-size: 0.75rem;
            font-weight: 600;
            white-space: nowrap;
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            margin-top: 2px;
        }
        @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
        }

        /* Custom Video Player CSS */
        .custom-video-container {
            position: relative;
            width: 100%;
            aspect-ratio: 16 / 9;
            background: #000;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        /* Com o vídeo a andar e as peças escondidas, o rato também sai da
           frente. */
        #video-modal:not(.comandos-a-ver) .custom-video-container:not(.paused),
        #video-modal:not(.comandos-a-ver) .custom-video-container:not(.paused) * {
            cursor: none !important;
        }
        .custom-video-container video {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
        }
        /* ---- A barra dos comandos ----

           Traz o mesmo véu de luz da página das rotas. No palco fica por
           cima do fundo da imagem, recolhida, e sobe quando o rato mexe
           (ver "O leitor dos testemunhos", mais abaixo). */
        .video-controls {
            position: relative;
            background: linear-gradient(to top, rgba(255,255,255,0.05), transparent);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding: 16px 24px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 10;
        }
        /* O que está dentro das barras — o nome e os botões em cima, o
           tempo e os botões em baixo — surge a esbater de cada vez que a
           janela abre. As barras em si estão lá desde o princípio: é a
           mesma regra da página da rota, e assim, se o navegador estiver
           ocupado e atrasar a animação, o que espera é o que está dentro,
           nunca uma barra escura. A animação é entregue à placa gráfica
           (will-change), para correr lisa. Em ecrã inteiro a barra dos
           botões tem o seu próprio deslize, e não isto. */
        @keyframes botoes-a-surgir {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .video-controls.a-surgir > *,
        .barra-do-nome.a-surgir > *,
        .barra-do-nome-360.a-surgir > * {
            /* Ao abrir, só depois de a janela ter assentado (ela nasce
               um pouco encolhida e leva a passagem a abrir): a esbater ao
               mesmo tempo que a janela nascia, o esbatimento perdia-se
               dentro da entrada dela e não se via — é assim que se vê nas
               rotas 360, onde os botões chegam depois de a janela estar
               aberta. Ao passar de um vídeo para o outro a janela já lá
               está, e esbate-se logo (a demora vem de quem chama). */
            animation: botoes-a-surgir 0.5s ease-out both;
            animation-delay: var(--demora-a-surgir, 0.45s);
            will-change: opacity;
        }
        /* Ao passar de uma paragem 360º para a outra o nome não se esbate:
           vem do cinzento da janela do lado para o branco do meio, e
           esbater do escuro por cima estragava essa passagem. Só os botões
           surgem. */
        .barra-do-nome-360.a-surgir.so-botoes > .nome-do-video {
            animation: none;
        }

        .progress-container {
            width: 100%;
            height: 6px;
            background: rgba(255,255,255,0.2);
            cursor: pointer;
            border-radius: 0;
            position: relative;
        }
        .progress-filled {
            height: 100%;
            background: #ffffff;
            width: 0%;
            border-radius: 0;
            pointer-events: none;
            position: relative;
        }
        /* Um quadrado pousado na ponta do que já se viu, para se saber de
           relance em que sítio do vídeo se vai. */
        .progress-filled::after {
            content: '';
            position: absolute;
            right: 0;
            top: 50%;
            transform: translate(50%, -50%);
            width: 12px;
            height: 12px;
            background: #ffffff;
        }

        /* O tempo fica logo por cima da barra do tempo, encostado ao mesmo
           lado por onde ela começa. */
        .tempo-e-barra {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .controls-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .controls-left, .controls-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .player-btn {
            background: transparent;
            border: 2.5px solid rgba(255, 255, 255, 0.15);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 1;
            transition: background 0.15s ease, transform 0.2s ease;
            padding: 8px;
            border-radius: 0;
        }
        .player-btn:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #ffffff;
            transform: scale(1.05);
        }
        .time-display {
            color: rgba(255,255,255,0.9);
            font-size: 0.85rem;
            font-family: var(--font-main, sans-serif);
            font-variant-numeric: tabular-nums;
            font-weight: 500;
        }

        /* Volume Slider */
        .volume-container {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .volume-slider-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .volume-slider {
            -webkit-appearance: none;
            width: 80px;
            height: 4px;
            background: rgba(255,255,255,0.2);
            border-radius: 0;
            outline: none;
            cursor: pointer;
        }
        .volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 0;
            background: #ffffff;
            cursor: pointer;
            transition: transform 0.1s;
        }
        .volume-slider::-webkit-slider-thumb:hover {
            transform: scale(1.3);
        }
        .volume-percentage {
            color: white;
            font-size: 0.75rem;
            min-width: 32px;
            font-variant-numeric: tabular-nums;
        }

        /* Quality Menu */
        .quality-menu {
            position: absolute;
            bottom: 50px;
            right: 15px;
            background: linear-gradient(to bottom, rgba(255,255,255,0.05), transparent), #05050a;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 0;
            padding: 16px;
            display: none;
            flex-direction: column;
            width: 260px;
            z-index: 20;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            font-family: var(--font-main, sans-serif);
        }
        .quality-menu.show { display: flex; }
        .quality-btn {
            background: none;
            border: none;
            color: #ddd;
            padding: 10px 20px;
            text-align: left;
            cursor: pointer;
            font-size: 0.85rem;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .quality-btn:hover, .quality-btn.active {
            background: rgba(255,255,255,0.1);
            color: #ffffff;
            font-weight: 600;
        }
        .big-play-btn {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.6);
            border-radius: 50%;
            width: 70px; height: 70px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            color: white;
            opacity: 0;
            transition: opacity 0.2s, transform 0.2s;
            pointer-events: none;
        }
        .custom-video-container.paused .big-play-btn {
            opacity: 1;
            pointer-events: auto;
        }
        .custom-video-container.paused .big-play-btn:hover {
            transform: translate(-50%, -50%) scale(1.1);
            color: #ffffff;
        }

        /* ---- O palco ----

           O vídeo enche a janela do navegador de ponta a ponta, como se
           estivesse em ecrã inteiro. O resto fica por cima dele e só
           aparece quando o rato mexe: a barra do nome em cima, os comandos
           em baixo e, de cada lado, a imagem do anterior e do seguinte com
           a seta que leva lá. Com o rato parado, somem-se ao fim de uns
           segundos e fica só o vídeo (ver pecasQueSeEscondem).

           Todas as medidas saem daqui, e não de números espalhados pelo
           meio: mudar uma destas linhas muda o palco todo. ---- */
        #video-modal,
        #modal-360 {
            /* O véu das barras que pairam por cima do vídeo: escuro junto
               à borda do ecrã, e a desfazer-se para dentro, para o vídeo
               se ver por trás e as letras se lerem sobre um céu claro. */
            --veu-forte: rgba(5, 5, 10, 0.8);
            --veu-medio: rgba(5, 5, 10, 0.45);
            --veu-nenhum: rgba(5, 5, 10, 0);
            /* O surgir e o sumir das peças por cima do vídeo. */
            --a-surgir: 0.35s ease;
            /* O deslize da barra dos comandos, o mesmo da página da rota. */
            --deslize-da-barra: 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            --passagem: 0.45s cubic-bezier(0.25, 0.9, 0.3, 1);
            overflow: hidden;
        }

        /* A janela do meio é a janela do navegador toda. */
        .janela-do-palco.janela-do-player {
            position: relative;
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            background: #05050a;
            overflow: hidden;
        }
        /* Sem o fio à volta: já não há janela a contornar, só o ecrã. */
        .janela-do-palco.janela-do-player::after {
            display: none;
        }

        /* A barra do nome paira sobre o alto do vídeo, com um véu escuro
           que se desfaz para baixo, para o nome se ler sobre um céu claro.
           O véu não apanha o rato: só o que está escrito nele. */
        .barra-do-nome,
        .barra-do-nome-360 {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 5;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box;
            padding: 16px 24px 40px;
            background: linear-gradient(to bottom, var(--veu-forte), var(--veu-medio) 55%, var(--veu-nenhum));
            pointer-events: none;
            opacity: 0;
            transition: opacity var(--a-surgir);
        }
        .comandos-a-ver .barra-do-nome,
        .comandos-a-ver .barra-do-nome-360 {
            opacity: 1;
        }
        .comandos-a-ver .barra-do-nome > *,
        .comandos-a-ver .barra-do-nome-360 > * {
            pointer-events: auto;
        }

        /* ---- Os lados ----
           De cada lado, junto à borda, a seta que leva ao anterior ou ao
           seguinte, dentro do mesmo leitor. Ocupam a altura toda, com um
           véu escuro a partir da borda para a seta se ver sobre um céu
           claro; o véu não apanha o rato — só a seta, e só quando está à
           vista.

           Escondidos, os lados só se esbatem, e é o lado inteiro que se
           esbate, e não a seta: as teclas e o comando de jogo carregam na
           seta mesmo com ela escondida, e só carregam no que não esteja
           apagado (ver comando.mjs). */
        .lado-do-palco {
            position: absolute;
            top: 0;
            bottom: 0;
            z-index: 2150;
            display: flex;
            align-items: center;
            gap: 4px;
            pointer-events: none;
            opacity: 0;
            transition: opacity var(--a-surgir);
        }
        .lado-do-palco.esquerda {
            left: 0;
            padding: 0 24px 0 16px;
            background: linear-gradient(to right, rgba(5, 5, 10, 0.55), rgba(5, 5, 10, 0));
        }
        .lado-do-palco.direita {
            right: 0;
            padding: 0 16px 0 24px;
            background: linear-gradient(to left, rgba(5, 5, 10, 0.55), rgba(5, 5, 10, 0));
        }
        .comandos-a-ver .lado-do-palco {
            opacity: 1;
        }
        .comandos-a-ver .lado-do-palco > * {
            pointer-events: auto;
        }

        /* As setas, só o bico e sem cabo, com uma sombra curta para se
           verem sobre um céu claro. */
        .seta-do-palco {
            flex: 0 0 auto;
            width: 80px;
            height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: none;
            background: transparent;
            color: rgba(255, 255, 255, 0.8);
            cursor: pointer;
            filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
            transition: color var(--passagem), transform var(--passagem);
        }
        .seta-do-palco:hover {
            color: #ffffff;
            transform: scale(1.18);
        }
        /* Já não há nada de novo para o lado de lá: a seta dá lugar a uma
           cruz, e quem carregar nela sai para o mapa.

           O apagado é dado à cruz inteira, e não à cor de cada traço: com
           a cor meio transparente, o sítio onde os dois se cruzam ficava
           mais claro do que o resto e a cruz parecia dois riscos pousados
           um por cima do outro. */
        .seta-do-palco.a-sair {
            color: #ffffff;
            opacity: 0.7;
            transition: opacity var(--passagem), transform var(--passagem);
        }
        .seta-do-palco.a-sair:hover {
            opacity: 1;
        }

        /* A imagem do primeiro instante do anterior e do seguinte não se
           mostra ao lado da seta. Fica na página, escondida, porque é dela
           que a janela do meio copia a primeira imagem ao trocar de vídeo,
           para não nascer preta (ver tapar360EnquantoChega e
           abrirTestemunho). */
        .previa {
            display: none;
        }

        /* ---- O leitor dos testemunhos ----
           A imagem enche a janela toda. A barra dos comandos fica por cima
           do fundo dela, recolhida, e sobe com as outras peças. */
        #video-modal .moldura-do-player {
            position: relative;
            flex: 1 1 auto;
            min-height: 0;
            display: flex;
            flex-direction: column;
            background: #05050a;
            overflow: hidden;
        }
        #video-modal .custom-video-container {
            flex: 1 1 auto;
            min-height: 0;
            aspect-ratio: auto;
        }
        /* Sem tarja: o mesmo véu da barra do nome, virado ao contrário, e
           com folga por cima para se desfazer antes do tempo escrito. */
        #video-modal .video-controls {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding-top: 40px;
            background: linear-gradient(to top, var(--veu-forte), var(--veu-medio) 60%, var(--veu-nenhum));
            border-top: none;
            transform: translateY(100%);
            transition: transform var(--deslize-da-barra);
            z-index: 100;
        }
        #video-modal.comandos-a-ver .video-controls {
            transform: none;
        }

        /* ---- A janela da paragem 360º ----
           Uma janela para a página da rota (ou da fotografia), a encher o
           ecrã todo. A barra dos comandos vive lá dentro e faz o mesmo que
           a dos testemunhos: fica recolhida ao fundo e sobe com as outras
           peças — é o palco que lhe diz quando (ver video360.html). */
        .moldura-360 {
            position: relative;
            flex: 1 1 auto;
            min-height: 0;
            background: #000;
            overflow: hidden;
        }
        .moldura-360 iframe {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            border: none;
            /* Sem cor própria: até a página de lá pintar, vê-se o que está
               por baixo — o rodapé de reserva — em vez de um preto. */
            background: transparent;
            display: block;
        }
        /* A barra dos comandos de reserva: veste-se como a da página da
           rota e fica no sítio dela, a subir e a descer com as outras
           peças, até a de lá chegar e assentar por cima sem se dar por
           isso. A altura é medida na página de lá. */
        .moldura-360 .rodape-do-meio {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: var(--altura-controlos, 0px);
            box-sizing: border-box;
            background: linear-gradient(to top, var(--veu-forte), var(--veu-medio) 60%, var(--veu-nenhum));
            pointer-events: none;
            transform: translateY(100%);
            transition: transform var(--deslize-da-barra);
        }
        #modal-360.comandos-a-ver .rodape-do-meio {
            transform: none;
        }
        /* Enquanto a imagem parada tapa a janela, a reserva fica por cima
           dela — e numa troca de rota fica quieta no sítio enquanto as
           imagens deslizam por baixo. */
        .moldura-360:has(.previa-do-meio) .rodape-do-meio {
            z-index: 3;
        }

        /* A imagem do primeiro instante, por cima da janela enquanto a
           página da rota ainda está a chegar: é a mesma que a imagem do
           lado mostrava, e sai quando o filme de lá anda. */
        .moldura-360 .previa-do-meio {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 2;
            overflow: hidden;
        }
        .moldura-360 .previa-do-meio canvas {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        /* O quadrado de espera, por cima da imagem parada, enquanto a
           página da rota carrega. */
        .moldura-360 .previa-do-meio .espera-video {
            display: grid;
            animation: botoes-a-surgir 0.25s ease-out both;
        }

        /* ---- A troca de testemunho dentro do leitor, como um carrossel
           de diapositivos: a última imagem do vídeo que se deixa sai por um
           lado, e o vídeo novo entra pelo outro. O leitor fica parado. ---- */
        .imagem-de-antes {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
            pointer-events: none;
            z-index: 3;
            visibility: hidden;
        }
        .imagem-de-antes.a-ver {
            visibility: visible;
        }
        .custom-video-container.pronto-a-deslizar video {
            transform: translateX(calc(var(--sentido-da-troca, 1) * 100%));
        }
        .custom-video-container.a-deslizar video,
        .custom-video-container.a-deslizar .imagem-de-antes {
            transition: transform var(--passagem);
        }
        .custom-video-container.a-deslizar .imagem-de-antes {
            transform: translateX(calc(var(--sentido-da-troca, 1) * -100%));
        }

        /* ---- A troca de rota dentro da janela, como nos testemunhos: a
           rota que se deixa sai por um lado, calada, e a imagem do primeiro
           instante da nova entra pelo outro. A janela fica parada. ---- */
        .moldura-360 .a-sair {
            transition: transform var(--passagem);
            transform: translateX(calc(var(--sentido-da-troca, 1) * -100%));
        }
        .moldura-360 .previa-do-meio.pronta-a-entrar {
            transform: translateX(calc(var(--sentido-da-troca, 1) * 100%));
        }
        .moldura-360 .previa-do-meio.a-entrar {
            transition: transform var(--passagem);
        }

        /* A janela do meio nasce um pouco encolhida e assenta ao abrir. */
        .janela-do-player {
            transform: scale(0.95);
            transition: transform var(--passagem), opacity var(--passagem);
        }
        .janela-do-player.aberta {
            transform: scale(1);
        }

        /* A fotografia do alto do bairro é uma paragem avulsa: não há nada
           dos lados. A barra do nome fica sempre à vista, sem véu, só com
           a cruz; os comandos, dentro da página da fotografia, pairam no
           canto de baixo (ver image360.html). */
        #modal-360.inteira .barra-do-nome-360 {
            background: transparent;
            opacity: 1;
        }
        #modal-360.inteira .barra-do-nome-360 button {
            pointer-events: auto;
        }
        /* A fotografia não anda nem acaba: o "Auto" não mandava em nada. */
        #modal-360.inteira .interruptor-auto {
            display: none !important;
        }

        /* Num ecrã estreito a seta de cada lado encosta-se mais à borda, e
           encolhe. */
        @media (max-width: 900px) {
            .lado-do-palco.esquerda {
                padding: 0 0 0 4px;
            }
            .lado-do-palco.direita {
                padding: 0 4px 0 0;
            }
            .seta-do-palco {
                width: 56px;
                height: 80px;
            }
            .seta-do-palco svg {
                width: 56px;
                height: 56px;
            }
            .barra-do-nome,
            .barra-do-nome-360 {
                padding: 12px 16px 32px;
            }

            .video-controls {
                padding: 12px 12px 14px;
            }
            .controls-left, .controls-right {
                gap: 8px;
            }
            .player-btn svg {
                width: 18px;
                height: 18px;
            }
            .time-display {
                font-size: 0.75rem;
            }
            .volume-container {
                display: none; /* Em mobile, o controlo é feito com os botões físicos */
            }
        }

        /* O quadrado de espera do site, ao centro, enquanto o vídeo carrega
           mais imagem — um pouco mais pequeno por estar em cima dela. */
        .espera-video {
            --lado: 8px;
            --folga: 3px;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: none;
            z-index: 4;
        }
        .espera-video.a-esperar {
            display: grid;
        }

        /* O sinal que pisca de cada lado quando se dá um duplo clique para
           saltar dez segundos. */
        .salto-sinal {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            color: #fff;
            opacity: 0;
            pointer-events: none;
            z-index: 4;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .salto-sinal.esquerda { left: 12%; }
        .salto-sinal.direita { right: 12%; }
        .salto-sinal.a-piscar {
            animation: salto-a-piscar 0.6s ease-out;
        }
        @keyframes salto-a-piscar {
            0% { opacity: 0; transform: translateY(-50%) scale(0.8); }
            30% { opacity: 1; transform: translateY(-50%) scale(1); }
            100% { opacity: 0; transform: translateY(-50%) scale(1.05); }
        }
        .idioma {
            position: relative;
        }
        .idioma-botao {
            display: flex;
            align-items: center;
            gap: 8px;
            background: transparent;
            border: 2.5px solid rgba(255, 255, 255, 0.15);
            border-radius: 0;
            color: #fff;
            padding: 8px 16px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .idioma-botao:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
        }
        .idioma-menu-modal {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            background: linear-gradient(to bottom, rgba(255,255,255,0.05), transparent), #05050a;
            border: 2.5px solid rgba(255,255,255,0.15);
            border-radius: 0;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 220px;
            z-index: 2300;
            opacity: 0;
            pointer-events: none;
            transform: translateY(-10px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .idioma-menu-modal.open {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
        .idioma-menu-modal .menu-fechar {
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            padding: 4px;
            transition: color 0.2s, transform 0.2s;
        }
        .idioma-menu-modal .menu-fechar:hover {
            color: #fff;
            transform: scale(1.1);
        }
        .fechar-palco-btn {
            background: none;
            border: none;
            color: #fff;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.2s ease, transform 0.2s ease;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .fechar-palco-btn:hover {
            opacity: 1;
            transform: scale(1.1);
        }
        /* ─── Contornos ───
           Um fio de dois pontos e meio a toda a volta, de um só tom — o mais escuro do
           degradé que aqui houve — pousado sobre o fundo escuro do site. */
        .janela-do-palco, .previa, .quality-menu {
            /* Sem rebordo nenhum, nem invisível: ficaria por fora do fio,
               com o fundo escuro a ver-se por baixo dele. */
            border: 0 !important;
        }
        .janela-do-palco, .previa {
            position: relative;
        }
        .janela-do-palco::after, .previa::after, .quality-menu::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            /* Um rebordo a sério, e não um recorte: o navegador acerta-o aos
               pontos do ecrã, e fica com a mesma grossura dos quatro lados.
               A cor é a do branco a 30% sobre o fundo escuro do site. */
            border: 2.5px solid #505054;
            pointer-events: none;
            z-index: 10;
        }
    `;
    document.head.appendChild(style);

    this.container = document.createElement('div');
    this.container.id = 'annotations-container';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.overflow = 'hidden';
    this.container.style.zIndex = '10'; // Create a stacking context to prevent annotations from overlapping UI
    document.body.appendChild(this.container);

    this.setupModal();

    // Load viewed annotations
    let viewedAnnotations = [];
    try {
        const stored = localStorage.getItem('viewedAnnotations');
        if (stored) viewedAnnotations = JSON.parse(stored);
    } catch (e) {
        console.warn("Could not load viewed annotations", e);
    }
    this.viewedAnnotations = viewedAnnotations;

    // Quem volta ao bairro com tudo já visto encontra-o todo apagado, e um
    // bairro todo cinzento não aponta caminho nenhum a ninguém. A memória
    // do que se viu serve para guiar quem anda a meio; chegado ao fim,
    // deixa de ter serventia e limpa-se. Quem volta encontra o bairro como
    // o viu da primeira vez.
    if (this.coleccaoVista(this.annotations)) {
        this.viewedAnnotations = [];
        try {
            localStorage.removeItem('viewedAnnotations');
        } catch (e) { /* sem memória no navegador: já estava tudo limpo */ }
    }

    this.annotations.forEach(ann => {
        const el = document.createElement('div');
        el.className = 'annotation-marker';
        // Para quem vê, isto é um ponto desenhado por cima do bairro. Para
        // quem não vê, tem de ser o que de facto é: um botão, com nome, ao
        // alcance da tecla Tab. O nome é posto mais abaixo, de uma vez para
        // todos, por ele mudar com a língua.
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.dataset.tipo = ann.is360 ? '360' : 'testemunho';
        if (ann.label === "Esvarena") el.classList.add('esvarena-marker');
        if (ann.trailIndex !== undefined) el.dataset.trailIndex = ann.trailIndex;

        const annId = ann.is360 ? `360-${ann.trailIndex}` : `video-${ann.video}`;
        const isViewed = this.viewedAnnotations.includes(annId);

        if (ann.is360) {
            // As rotas mostram uma moldura panorâmica: a imagem com a borda
            // de cima e a de baixo a dobrar para o meio, como quem a vê de
            // dentro enquanto ela dá a volta. Lá dentro, uma paisagem: duas
            // montanhas, a pequena à frente da grande, e o sol. Só linhas
            // direitas, de cantos vivos, e a dobra com a inclinação das
            // riscas da claquete dos créditos. O mesmo desenho está na
            // legenda, nas instruções e nas placas dos óculos. O nome vai
            // por baixo. A fotografia do alto do bairro dispensa as duas
            // coisas: fica só um olho, pousado no céu.
            //
            // Os três desenhos (testemunho, rota e olho) têm as mesmas
            // medidas: 24 pontos no quadrado de 32, com 20 de largura lá
            // dentro e o mesmo traço — nenhum parece maior nem mais grosso.
            const simbolo = ann.isImage
                ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
                        <path d="M2 12s3.64-6.36 10-6.36 10 6.36 10 6.36-3.64 6.36-10 6.36-10-6.36-10-6.36Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                   </svg>`
                : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
                        <polygon points="2 4, 12 6.67, 22 4, 22 20, 12 17.33, 2 20"></polygon>
                        <polyline points="5.4 18.7, 8.8 12.6, 11.3 17"></polyline>
                        <polyline points="11.3 15.6, 14.2 10.4, 18.9 18.8"></polyline>
                        <circle cx="6" cy="8.8" r="1"></circle>
                   </svg>`;
            el.innerHTML = `
                <div class="marker-dot is-360 ${ann.isImage ? 'is-foto' : ''} ${isViewed ? 'viewed' : ''}">
                    ${simbolo}
                </div>
                ${ann.isImage ? '' : `<div class="marker-label">${ann.label}</div>`}
            `;
        } else {
            el.innerHTML = `
                <div class="marker-dot ${isViewed ? 'viewed' : ''}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
                        <polygon points="2 4 22 4 22 16 12 16 7 21 7 16 2 16"></polygon>
                        <line x1="7" y1="8" x2="17" y2="8"></line>
                        <line x1="7" y1="12" x2="12" y2="12"></line>
                    </svg>
                </div>
                <div class="marker-label">${ann.label}</div>
            `;
        }

        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = '0';
        el.style.opacity = '0';
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'center';
        el.style.gap = '6px';

        el.addEventListener('click', () => {
            if (this.viewedAnnotations.includes(annId)) {
                this.viewedAnnotations = this.viewedAnnotations.filter(id => {
                    const a = this.annotations.find(x => this.idDaAnotacao(x) === id);
                    return a ? a.is360 !== ann.is360 : true;
                });

                try {
                    localStorage.setItem('viewedAnnotations', JSON.stringify(this.viewedAnnotations));
                } catch (e) {}

                this.annotations.forEach(a => {
                    if (a.is360 === ann.is360 && a.element) {
                        const dot = a.element.querySelector('.marker-dot');
                        if (dot) dot.classList.remove('viewed', 'last-viewed');
                    }
                });
            }

            this.marcarComoVisto(annId);

            if (ann.is360) {
                this.abrirParagem360(ann);
            } else {
                this.openVideoModal(ann.video, ann.label);
            }
        });

        // Um botão de verdade abre-se com o Enter e com o espaço. Uma caixa
        // com um clique agarrado, não — tem de se lhe ensinar. Com uma
        // janela aberta por cima, o marcador está atrás dela e a tecla é
        // da janela, não dele.
        el.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (this.janelaAberta()) return;
            e.preventDefault();
            el.click();
        });

        this.container.appendChild(el);
        ann.element = el;
    });

    this.baptizarMarcadores();
    window.addEventListener('idiomamudou', () => this.baptizarMarcadores());
};

/**
 * Se há uma janela grande aberta por cima do bairro — a dos testemunhos
 * ou o palco das paragens 360º.
 *
 * @returns {boolean} Se sim.
 */
AnnotationController.prototype.janelaAberta = function() {
    const aberta = (janela) => !!janela && janela.style.display !== 'none' &&
        janela.style.display !== '';
    return aberta(this.modal) || aberta(this.palco360 && this.palco360.modal);
};

/* ---- O palco das paragens 360º ----

   A fotografia do alto do bairro e as três rotas são, para quem vê, a
   mesma coisa: uma imagem que dá a volta toda a quem está no meio dela.
   Por isso partilham o palco dos testemunhos — a tira de três janelas,
   com a anterior e a seguinte a espreitar de cada lado — e passa-se de
   uma para a outra sem ter de voltar ao mapa.

   A janela do meio é uma janela para outra página: a das fotografias ou a
   das rotas, conforme a paragem. Os comandos de cada uma vivem lá
   dentro. ---- */

// As três rotas são o mesmo sítio percorrido três vezes; a letra é o que
// as distingue, tanto no nome do ficheiro como na barra de cima.
const LETRAS_DAS_ROTAS = ['A', 'B', 'C'];

/**
 * Se o interruptor "Auto" (o que acaba passa sozinho ao seguinte) está
 * ligado. Com os cookies do site bloqueados no navegador, ler a memória dá
 * erro: aí fica desligado, como vem de origem.
 *
 * @returns {boolean} Se está ligado.
 */
function autoLigado() {
    try {
        return localStorage.getItem('autoplay-videos') === 'true';
    } catch (e) {
        return false;
    }
}

/**
 * Guarda o interruptor "Auto" para a próxima visita, se houver memória.
 *
 * @param {boolean} ligado - Se fica ligado.
 */
function guardarAuto(ligado) {
    try {
        localStorage.setItem('autoplay-videos', ligado ? 'true' : 'false');
    } catch (e) { /* sem memória: vale só para esta visita */ }
}

// Os bicos das setas do palco, e a cruz que toma o lugar da seta da
// direita quando já não há nada de novo para o lado de lá.
const BICO_ESQUERDA = '15 18 9 12 15 6';
const BICO_DIREITA = '9 18 15 12 9 6';

/**
 * O desenho de uma seta do palco.
 *
 * @param {string} bico - Os pontos do bico.
 * @returns {string} O desenho.
 */
function desenhoDaSeta(bico) {
    return '<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="' + bico + '"></polyline></svg>';
}

// A cruz é desenhada do mesmo tamanho do bico de uma seta, para tomar o
// lugar dela sem o canto do ecrã dar um salto.
const DESENHO_DA_CRUZ = '<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M7 7L17 17M17 7L7 17"></path></svg>';

/**
 * As paragens 360º, pela ordem em que estão na lista das anotações.
 *
 * @returns {object[]} A fotografia do alto e as três rotas.
 */
AnnotationController.prototype.paragens360 = function() {
    return this.annotations.filter(ann => ann.is360 && ann.label !== "Olho de Águia");
};

/**
 * O nome de uma paragem, tal como se lê na barra de cima.
 *
 * @param {object} ann - A paragem.
 * @returns {string} O nome a mostrar.
 */
/**
 * O nome por que um marcador se dá a conhecer a quem não o vê.
 *
 * O que está desenhado no mapa — um microfone, um olho, a palavra 360º —
 * não diz nada a um leitor de ecrã. Este é o nome que ele lê em voz alta,
 * e por isso tem de dizer as duas coisas: de quem é e o que é. "Dulce"
 * sozinho não chega; "Testemunho de Dulce" chega.
 *
 * @param {object} ann - A anotação.
 * @returns {string} O nome, na língua em vigor.
 */
AnnotationController.prototype.nomeAcessivel = function(ann) {
    const diz = (chave, alternativa) =>
        (window.Idiomas && window.Idiomas.t(chave)) || alternativa;

    // Sem etiqueta não há nome possível, e mais vale dizer que não há do
    // que devolver "Testemunho de undefined" — que passaria despercebido a
    // olho e seria lido em voz alta a quem depende dele.
    if (!ann.label) {
        return '';
    }

    if (ann.is360) {
        if (ann.isImage) {
            return ann.label + ' — ' + diz('mapa.fotografia360', 'fotografia 360º');
        }
        return this.nomeDaParagem360(ann);
    }
    return diz('mapa.testemunhoDe', 'Testemunho de {nome}').replace('{nome}', ann.label);
};

/**
 * Escreve nos marcadores o nome por que se dão a conhecer.
 *
 * Feito à parte por ser preciso duas vezes: quando os marcadores nascem, e
 * outra vez sempre que se troca de língua — senão um leitor de ecrã
 * continuava a dizer "Testemunho de" a quem escolheu inglês.
 */
AnnotationController.prototype.baptizarMarcadores = function() {
    this.annotations.forEach((ann) => {
        if (!ann.element) {
            return;
        }
        const nome = this.nomeAcessivel(ann);

        // Uma anotação sem nome é uma anotação que ninguém que não veja o
        // ecrã consegue abrir. Isso não pode passar em silêncio: quem
        // acrescentar um tipo de anotação novo e se esquecer de o ensinar a
        // nomeAcessivel fica a saber aqui, e não daqui a um ano por um
        // visitante que não conseguiu entrar.
        if (!nome || !nome.trim() || /undefined|null|\{nome\}/.test(nome)) {
            console.error(
                'Anotação sem nome para quem não vê o ecrã. Toda a anotação ' +
                'precisa de um nome em nomeAcessivel() — ver AGENTS.md.',
                ann
            );
            return;
        }

        ann.element.setAttribute('aria-label', nome);
    });
};

AnnotationController.prototype.nomeDaParagem360 = function(ann) {
    // "Esvarena" e "Olho de Águia" são nomes de sítios: ficam iguais em
    // qualquer língua. O que se traduz é só "Rota 360º".
    if (ann.isImage && ann.label === "Olho de Águia") {
        return "";
    }
    if (ann.isImage) {
        return ann.label;
    }
    const letra = LETRAS_DAS_ROTAS[ann.trailIndex] || LETRAS_DAS_ROTAS[0];
    return ann.label + ' — ' +
        (window.Idiomas ? window.Idiomas.t('rota.titulo') : 'Rota 360º') + ' ' + letra;
};

/**
 * O nome do ficheiro de vídeo de uma rota.
 *
 * @param {object} ann - A rota.
 * @returns {string} O nome do vídeo.
 */
AnnotationController.prototype.videoDaRota360 = function(ann) {
    return 'Esvarena - 360 - ' + (LETRAS_DAS_ROTAS[ann.trailIndex] || LETRAS_DAS_ROTAS[0]);
};

/**
 * A página que mostra uma paragem.
 *
 * @param {object} ann - A paragem.
 * @returns {string} O endereço a pôr na janela do meio.
 */
AnnotationController.prototype.enderecoDaParagem360 = function(ann) {
    if (ann.isImage) {
        // A fotografia abre de lado a lado, sem barras: a página é avisada
        // para pôr os comandos a pairar sobre a imagem.
        return '/image360.html?src=' + encodeURIComponent(ann.imagePath) + '&inteira=1';
    }
    // "sequencia": a rota não recomeça ao chegar ao fim, avisa cá fora
    // (ver seguirDepoisDaRota360), como os testemunhos. "inteira": a rota
    // enche o ecrã, e a barra dos comandos recolhe-se por cima dela e sobe
    // quando o palco lho diz.
    return '/video360.html?nome=' + encodeURIComponent(this.videoDaRota360(ann)) + '&sequencia=1&inteira=1';
};

/**
 * Uma rota que chega ao fim conta como vista e, com o "Auto" ligado, a
 * seguinte entra sozinha — para o lado por onde se andou, ou para a
 * direita se ainda não se andou. No fim do percurso não há mais nada a
 * mostrar: o palco fecha-se e devolve o bairro. Com o "Auto" desligado a
 * rota fica parada no fim, à espera. É o mesmo que os testemunhos fazem.
 */
AnnotationController.prototype.seguirDepoisDaRota360 = function() {
    const palco = this.palco360;
    const ann = this.paragem360;
    if (!palco || !ann || palco.modal.style.display === 'none') {
        return;
    }
    this.marcarComoVisto(this.idDaAnotacao(ann));
    if (!autoLigado()) {
        return;
    }
    const lista = this.paragens360();
    if (lista.indexOf(ann) < 0 || lista.length < 2) {
        this.fecharPalco360();
        return;
    }
    const p = this.percurso360;
    const sentido = p && p.sentido ? p.sentido : 1;
    const onde = this.andarNoPercurso(p, lista.length, sentido);
    if (onde === null) {
        this.fecharPalco360();
        return;
    }
    this.abrirParagem360(lista[onde], sentido);
};

/**
 * Cria o grupo de botões do cabeçalho: o interruptor da reprodução
 * automática e o botão de fechar.
 *
 * O interruptor é o mesmo nos testemunhos e nas rotas 360º, e lembra-se
 * de um para o outro: ligado, o que acaba passa sozinho ao seguinte.
 *
 * @param {Function} fecharCallback - O que fazer ao carregar na cruz.
 */
AnnotationController.prototype.criarBotoesDeTopo = function(fecharCallback) {
    const rightGroup = document.createElement('div');
    rightGroup.style.display = 'flex';
    rightGroup.style.alignItems = 'center';
    rightGroup.style.gap = '16px';

    const autoPlayContainer = document.createElement('label');
    autoPlayContainer.className = 'interruptor-auto';
    autoPlayContainer.style.display = 'flex';
    autoPlayContainer.style.alignItems = 'center';
    autoPlayContainer.style.gap = '8px';
    autoPlayContainer.style.cursor = 'pointer';
    autoPlayContainer.title = window.Idiomas ? window.Idiomas.t('v360.autoplay') || 'Reprodução automática' : 'Reprodução automática';

    const autoPlayLabel = document.createElement('span');
    autoPlayLabel.textContent = 'Auto';
    autoPlayLabel.style.fontSize = '12px';
    autoPlayLabel.style.fontWeight = 'bold';
    autoPlayLabel.style.textTransform = 'uppercase';
    autoPlayLabel.style.color = 'rgba(255,255,255,0.7)';

    const switchEl = document.createElement('div');
    switchEl.style.width = '24px';
    switchEl.style.height = '14px';
    switchEl.style.backgroundColor = 'rgba(255,255,255,0.2)';
    switchEl.style.position = 'relative';
    switchEl.style.transition = 'background-color 0.2s';

    const pointer = document.createElement('div');
    pointer.style.width = '10px';
    pointer.style.height = '10px';
    pointer.style.backgroundColor = 'white';
    pointer.style.position = 'absolute';
    pointer.style.top = '2px';
    pointer.style.left = '2px';
    pointer.style.transition = 'left 0.2s';

    switchEl.appendChild(pointer);

    // Por definição, a reprodução automática deve estar desativada
    let isAutoPlay = autoLigado();

    const updateSwitchVisuals = () => {
        if (isAutoPlay) {
            switchEl.style.backgroundColor = 'rgba(255,255,255,0.6)';
            pointer.style.left = '12px';
        } else {
            switchEl.style.backgroundColor = 'rgba(255,255,255,0.2)';
            pointer.style.left = '2px';
        }
    };
    updateSwitchVisuals();

    autoPlayContainer.addEventListener('click', (e) => {
        e.preventDefault();
        isAutoPlay = !isAutoPlay;
        guardarAuto(isAutoPlay);
        updateSwitchVisuals();
    });

    autoPlayContainer.appendChild(autoPlayLabel);
    autoPlayContainer.appendChild(switchEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'fechar-palco-btn';
    closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.setAttribute('aria-label', 'Fechar');
    closeBtn.title = 'Fechar';
    closeBtn.addEventListener('click', fecharCallback);

    rightGroup.appendChild(autoPlayContainer);
    rightGroup.appendChild(closeBtn);

    return rightGroup;
};

/**
 * Monta o palco das paragens 360º: a janela da paragem a encher o ecrã, a
 * barra do nome por cima dela, e de cada lado a imagem da vizinha com a
 * seta que leva lá.
 */
AnnotationController.prototype.setupPalco360 = function() {
    const modal = document.createElement('div');
    modal.id = 'modal-360';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = '#05050a';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2000';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.3s ease';

    const content = document.createElement('div');
    content.className = 'janela-do-palco janela-do-player';

    const header = document.createElement('div');
    header.className = 'barra-do-nome-360';

    const titulo = document.createElement('div');
    titulo.className = 'nome-do-video';
    titulo.style.color = '#fff';
    titulo.style.fontWeight = '600';
    titulo.style.fontSize = '1.1rem';
    header.appendChild(titulo);
    header.appendChild(this.criarBotoesDeTopo(() => this.fecharPalco360()));

    const moldura = document.createElement('div');
    moldura.className = 'moldura-360';

    content.appendChild(header);
    content.appendChild(moldura);

    // De cada lado, a imagem da paragem vizinha — escondida: é dela que a
    // janela do meio copia a primeira imagem ao trocar, para não nascer
    // preta (ver tapar360EnquantoChega). Numa paragem há duas coisas
    // possíveis: a fotografia do alto, que é um ficheiro de imagem, ou o
    // primeiro instante de uma rota, que é uma fotografia a dar a volta
    // toda, vista pela mesma câmara com que a rota começa (ver
    // previa-360.mjs). Cabem as duas na janela, e usa-se a que for da vez.
    const criarPrevia = (lado, sentido) => {
        const previa = document.createElement('button');
        previa.type = 'button';
        previa.className = 'previa ' + lado;

        const janela = document.createElement('div');
        janela.className = 'previa-janela';
        const tela = document.createElement('canvas');
        tela.setAttribute('aria-hidden', 'true');
        const foto = document.createElement('img');
        foto.alt = '';
        janela.appendChild(tela);
        janela.appendChild(foto);
        previa.appendChild(janela);

        previa.addEventListener('click', () => this.saltarParagem360(sentido));
        return previa;
    };

    const esquerda = criarPrevia('esquerda', -1);
    const direita = criarPrevia('direita', 1);

    const criarSeta = (lado, bico, sentido) => {
        const seta = document.createElement('button');
        seta.type = 'button';
        seta.className = 'seta-do-palco ' + lado;
        seta.innerHTML = desenhoDaSeta(bico);
        const chave = sentido < 0 ? 'palco.anterior' : 'palco.seguinte';
        seta.setAttribute('data-i18n-title', chave);
        seta.title = window.Idiomas ? window.Idiomas.t(chave) : '';
        seta.addEventListener('click', (e) => {
            e.stopPropagation();
            // Vistas todas as paragens, esta seta já é a cruz de saída.
            if (seta.classList.contains('a-sair')) {
                this.fecharPalco360();
                return;
            }
            this.saltarParagem360(sentido);
        });
        return seta;
    };
    const setaEsquerda = criarSeta('esquerda', BICO_ESQUERDA, -1);
    const setaDireita = criarSeta('direita', BICO_DIREITA, 1);

    // Os lados: a seta, junto à borda, e a imagem escondida.
    const ladoEsquerdo = document.createElement('div');
    ladoEsquerdo.className = 'lado-do-palco esquerda';
    ladoEsquerdo.appendChild(esquerda);
    ladoEsquerdo.appendChild(setaEsquerda);
    const ladoDireito = document.createElement('div');
    ladoDireito.className = 'lado-do-palco direita';
    ladoDireito.appendChild(setaDireita);
    ladoDireito.appendChild(direita);

    modal.appendChild(content);
    modal.appendChild(ladoEsquerdo);
    modal.appendChild(ladoDireito);
    document.body.appendChild(modal);

    // As peças por cima da paragem aparecem com o rato e somem-se
    // sozinhas. A barra dos comandos, que vive dentro da página da
    // paragem, vai com elas: diz-se-lhe de cada vez que mudam.
    const pecas = pecasQueSeEscondem(modal, (aVer) => {
        this.avisarJanela360({ malhaViva: 'comandos360', aVer });
    });

    this.palco360 = {
        modal,
        meio: content,
        esquerda,
        direita,
        setaEsquerda,
        setaDireita,
        ladoEsquerdo,
        ladoDireito,
        barraDoNome: header,
        titulo,
        moldura,
        pecas
    };

    // Com o ecrã a mudar de tamanho, a barra dos comandos de lá também
    // muda, e a de reserva tem de ir atrás.
    window.addEventListener('resize', () => {
        if (modal.style.display !== 'none') this.medirComandos360();
    });

    // O que a página da paragem conta cá para fora. Só conta o que vem da
    // janela do meio: uma que esteja a sair não manda nada.
    window.addEventListener('message', (e) => {
        if (!e.data || typeof e.data.malhaViva !== 'string') return;
        const janela = this.janelaDoMeio360();
        if (!janela || e.source !== janela.contentWindow) return;
        if (e.data.malhaViva === 'filme360Acabou') {
            // O filme chegou ao fim.
            if (!this.palco360.aTrocar) this.seguirDepoisDaRota360();
        } else if (e.data.malhaViva === 'rato360') {
            // O rato mexeu lá dentro — ou começou a arrastar a vista, e
            // aí as peças saem da frente.
            if (e.data.gesto === 'arrasta') pecas.esconder();
            else pecas.mostrar();
        }
    });

    // O botão do ecrã inteiro vive lá dentro, e leva o palco todo a ecrã
    // inteiro (ver video360.html); muda de desenho com ele.
    document.addEventListener('fullscreenchange', () => {
        this.avisarJanela360({ malhaViva: 'ecraInteiro360', dentro: emEcraInteiro() });
    });
};

/**
 * Manda um recado à página da paragem que está na janela do meio.
 *
 * @param {object} recado - O recado.
 */
AnnotationController.prototype.avisarJanela360 = function(recado) {
    const janela = this.janelaDoMeio360();
    if (janela && janela.contentWindow) {
        janela.contentWindow.postMessage(recado, window.location.origin);
    }
};

/**
 * Abre uma paragem 360º no palco.
 *
 * Com o palco já aberto e um sentido dado, a janela fica onde está e é só
 * a rota lá dentro que troca (ver {@link trocarNaJanela360}), como nos
 * testemunhos.
 *
 * @param {object} ann - A paragem a abrir.
 * @param {number} [sentido] - -1 para a anterior, 1 para a seguinte.
 */
AnnotationController.prototype.abrirParagem360 = function(ann, sentido) {
    if (!ann) {
        return;
    }
    if (!this.palco360) {
        this.setupPalco360();
    }
    const palco = this.palco360;
    const jaAberto = palco.modal.style.display !== 'none';
    if (jaAberto && sentido) {
        this.trocarNaJanela360(ann, sentido);
        return;
    }
    this.arrumarTrocaNaJanela360();
    this.mostrarParagem360(ann);
};

/**
 * A janela da página da paragem que está a dar — e não a de uma que esteja
 * a sair a deslizar.
 *
 * @returns {HTMLIFrameElement|null} A janela, se já existir.
 */
AnnotationController.prototype.janelaDoMeio360 = function() {
    return this.palco360 ? this.palco360.moldura.querySelector('iframe:not(.a-sair)') : null;
};

/**
 * Troca a rota dentro da janela que já está aberta.
 *
 * A janela não se mexe: é a imagem lá dentro que desliza, como num
 * carrossel de diapositivos. A rota que se deixa cala-se e sai por um
 * lado, a imagem do primeiro instante da nova entra pelo outro — e a
 * página dela nasce por baixo, como ao abrir. As imagens dos lados
 * deslizam no mesmo sentido e voltam já com as vizinhas novas.
 *
 * @param {object} ann - A paragem a abrir.
 * @param {number} sentido - -1 para a anterior, 1 para a seguinte.
 */
AnnotationController.prototype.trocarNaJanela360 = function(ann, sentido) {
    const palco = this.palco360;
    this.arrumarTrocaNaJanela360();
    palco.aTrocar = true;
    palco.modal.style.setProperty('--sentido-da-troca', sentido);

    // O que está na janela sai: a página da rota, calada já, e a imagem
    // parada que ainda a tapasse.
    palco.moldura.querySelectorAll('iframe, .previa-do-meio').forEach((el) => {
        if (el.tagName === 'IFRAME') {
            try {
                const filme = el.contentDocument && el.contentDocument.getElementById('video360');
                if (filme) filme.pause();
            } catch (e) { /* outra origem: sai a tocar, mas sai já */ }
        }
        el.classList.add('a-sair');
    });

    this.mostrarParagem360(ann, sentido);

    // A imagem da nova fica à espera do lado de onde vem, e desliza.
    const entra = palco.moldura.querySelector('.previa-do-meio:not(.a-sair)');
    if (entra) {
        entra.classList.add('pronta-a-entrar');
        void entra.offsetWidth;
        entra.classList.remove('pronta-a-entrar');
        entra.classList.add('a-entrar');
    }
    const demora = (parseFloat(getComputedStyle(palco.modal).getPropertyValue('--passagem')) || 0.45) * 1000;
    palco.esperaDaTroca = setTimeout(() => this.arrumarTrocaNaJanela360(), demora + 50);
};

/**
 * Acaba a troca dentro da janela: tira de lá o que estava a sair.
 */
AnnotationController.prototype.arrumarTrocaNaJanela360 = function() {
    const palco = this.palco360;
    if (!palco) {
        return;
    }
    clearTimeout(palco.esperaDaTroca);
    palco.moldura.querySelectorAll('.a-sair').forEach(el => el.remove());
    palco.moldura.querySelectorAll('.a-entrar').forEach(el => el.classList.remove('a-entrar'));
    palco.aTrocar = false;
};

/**
 * Passa à paragem do lado, pelo percurso da visita (ver
 * {@link andarNoPercurso}).
 *
 * @param {number} sentido - -1 para a esquerda, 1 para a direita.
 */
AnnotationController.prototype.saltarParagem360 = function(sentido) {
    const lista = this.paragens360();
    if (lista.indexOf(this.paragem360) < 0 || lista.length < 2) {
        return;
    }
    const onde = this.andarNoPercurso(this.percurso360, lista.length, sentido);
    if (onde === null) {
        return;
    }
    this.abrirParagem360(lista[onde], sentido);
};

/**
 * Põe uma paragem na janela do meio e as vizinhas nas dos lados.
 *
 * @param {object} ann - A paragem a mostrar.
 * @param {number} [sentido] - Ao trocar dentro da janela aberta, o lado
 *     para onde se passou (ver {@link trocarNaJanela360}).
 */
AnnotationController.prototype.mostrarParagem360 = function(ann, sentido) {
    const palco = this.palco360;
    this.paragem360 = ann;
    this.marcarComoVisto(this.idDaAnotacao(ann));

    // O que está na barra do nome surge a esbater: ao abrir, depois de a
    // janela assentar; ao trocar de rota na janela, logo — o nome também,
    // que é o mesmo sítio com outra rota.
    const aAbrir = palco.modal.style.display === 'none';
    const aTrocar = !aAbrir && !!sentido;
    palco.titulo.textContent = this.nomeDaParagem360(ann);
    fazerSurgir({ demora: aAbrir ? '0.45s' : '0s' }, palco.barraDoNome);
    // A altura da barra dos comandos da página de lá só se mede quando
    // ela carrega; até lá vale a última medida do mesmo tipo de paragem
    // (lembrada de visita para visita), para a barra de reserva, que é
    // desenhada com essa altura, estar à vista desde o princípio.
    const alturaLembrada = this.alturaLembradaDosComandos360(ann);
    if (alturaLembrada) {
        palco.modal.style.setProperty('--altura-controlos', alturaLembrada + 'px');
    }
    // Ao trocar, o que lá estava fica a sair a deslizar; ao abrir, a
    // janela começa vazia.
    if (!aTrocar) {
        palco.moldura.innerHTML = '';
    }
    // O rodapé de reserva e a imagem parada, que surgem com a barra do
    // nome. A página da rota só é criada meio segundo depois: montar a
    // cena dela ocupa o navegador, e criada logo travava estas animações
    // a meio — as barras ficavam escuras enquanto o quadrado de espera
    // rodava.
    if (!palco.moldura.querySelector('.rodape-do-meio')) {
        const rodape = document.createElement('div');
        rodape.className = 'rodape-do-meio';
        rodape.setAttribute('aria-hidden', 'true');
        palco.moldura.appendChild(rodape);
    }
    this.tapar360EnquantoChega(ann);

    clearTimeout(this.esperaDaJanela360);
    this.esperaDaJanela360 = setTimeout(() => {
        if (this.paragem360 !== ann || palco.modal.style.display === 'none') return;
        const janela = document.createElement('iframe');
        janela.src = this.enderecoDaParagem360(ann);
        janela.setAttribute('allow', 'xr-spatial-tracking; fullscreen; autoplay');
        janela.setAttribute('allowfullscreen', '');
        janela.addEventListener('load', () => {
            this.medirComandos360();
            // A página de lá fica a saber como estão as coisas cá fora: se
            // as peças estão à vista (a barra dela vai com elas) e se se
            // está em ecrã inteiro (o botão dela muda de desenho).
            if (janela.contentWindow) {
                janela.contentWindow.postMessage({
                    malhaViva: 'comandos360',
                    aVer: palco.modal.classList.contains('comandos-a-ver')
                }, window.location.origin);
                janela.contentWindow.postMessage({
                    malhaViva: 'ecraInteiro360',
                    dentro: emEcraInteiro()
                }, window.location.origin);
            }
            // O foco entra na janela mal ela nasce: é lá dentro que as
            // teclas do filme moram — o espaço, o W, A, S, D, os números —
            // e as que são do mapa, o Escape e as setas dos lados, sabem
            // voltar cá fora. Sem isto o foco ficava no marcador, atrás
            // da janela, e o espaço voltava a abrir a paragem que já
            // estava aberta. Sem deslocar nada: a dar o foco, o navegador
            // puxa a janela para a vista, e com uma imagem a meio de um
            // deslize arrastava o palco todo para o lado — e deixava-o lá.
            janela.focus({ preventScroll: true });
        });
        // Por cima do rodapé de reserva, por baixo da imagem parada.
        palco.moldura.insertBefore(janela, palco.moldura.querySelector('.previa-do-meio:not(.a-sair)'));
    }, 500);

    const lista = this.paragens360();
    const onde = lista.indexOf(ann);
    const avulso = onde < 0;

    // Uma paragem avulsa — a fotografia do alto do bairro — não tem nada
    // dos lados.
    palco.ladoEsquerdo.style.display = avulso ? 'none' : '';
    palco.ladoDireito.style.display = avulso ? 'none' : '';
    palco.modal.classList.toggle('inteira', !!ann.isImage);

    // Ao abrir começa um percurso novo a partir daqui; ao passar de
    // paragem o percurso já andou (ver saltarParagem360).
    if (aAbrir || !this.percurso360) {
        this.percurso360 = this.comecarPercurso(onde);
    }
    // As setas — ou a cruz, no fim do percurso — e as imagens escondidas
    // das vizinhas novas. A imagem do meio já foi copiada da vizinha antes
    // de ela mudar (ver tapar360EnquantoChega).
    if (!avulso && lista.length >= 2) {
        const lados = this.ladosDoPercurso(this.percurso360, lista);
        this.arrumarLado(palco.setaEsquerda, palco.esquerda, BICO_ESQUERDA, lados.esquerda.cruz);
        this.arrumarLado(palco.setaDireita, palco.direita, BICO_DIREITA, lados.direita.cruz);
        if (lados.esquerda.ann) this.encherPrevia360(palco.esquerda, lados.esquerda.ann);
        if (lados.direita.ann) this.encherPrevia360(palco.direita, lados.direita.ann);
    }

    abrirDeRepente(palco.modal);
    // As peças vêm à vista ao abrir e a cada troca de paragem — mesmo
    // quando a troca é feita de tecla ou sozinha, no fim de uma rota —,
    // para se ver onde se está e o que vem a seguir.
    palco.pecas.mostrar();

    // Obrigar o navegador a refazer as contas antes de mandar assentar,
    // senão a janela nasce já no sítio e não se vê entrada nenhuma.
    void palco.modal.offsetWidth;
    palco.meio.classList.add('aberta');

    apagarOBairroPorTras(this.app);
};

/**
 * Tapa a janela do meio com o primeiro instante da rota enquanto a
 * página dela ainda está a chegar.
 *
 * Sem isto via-se preto entre o deslize e a página de lá ter imagem. A
 * imagem é a mesma que a janela do lado já tinha desenhado — copia-se de
 * lá quando lá está, e desenha-se de novo quando a rota abre vinda do
 * mapa. Sai quando a página de lá avisa que tem a sua própria imagem
 * posta, ou, se o aviso não vier, pouco depois de ela carregar.
 *
 * @param {object} ann - A paragem que vai para o meio.
 * @param {HTMLIFrameElement} janela - A janela da página da rota.
 */
AnnotationController.prototype.tapar360EnquantoChega = function(ann) {
    if (!ann || ann.isImage) {
        return;
    }
    const palco = this.palco360;
    const video = this.videoDaRota360(ann);
    const tapa = document.createElement('div');
    tapa.className = 'previa-do-meio';
    tapa.setAttribute('aria-hidden', 'true');
    const tela = document.createElement('canvas');
    tapa.appendChild(tela);
    // O quadrado de espera por cima, para se ver que a rota está a
    // carregar: a página de lá tem o seu, mas fica por baixo disto.
    const espera = document.createElement('div');
    espera.className = 'espera-video';
    if (window.QuadradoDeEspera) window.QuadradoDeEspera.fazer(espera);
    tapa.appendChild(espera);
    palco.moldura.appendChild(tapa);

    // A imagem é desenhada do feitio do ecrã, que é o da janela: é assim
    // exactamente o que a rota vai mostrar ao começar. Se a imagem do lado
    // já a tinha, copia-se logo de lá, para a janela não chegar preta — a
    // do lado é mais larga do que qualquer ecrã, e cortada ao feitio dele
    // é a mesma vista (ver encherPrevia360) — e a nítida, do tamanho do
    // ecrã, vem por cima dela logo a seguir.
    const jaDesenhada = [palco.esquerda, palco.direita]
        .map(lado => lado && lado.querySelector('.previa-janela canvas'))
        .find(t => t && t.dataset.video === video && t.width > 0);
    if (jaDesenhada) {
        tela.width = jaDesenhada.width;
        tela.height = jaDesenhada.height;
        tela.getContext('2d').drawImage(jaDesenhada, 0, 0);
    }
    const larguraDoEcra = window.innerWidth || 1280;
    const alturaDoEcra = window.innerHeight || 720;
    const largura = Math.min(1600, larguraDoEcra);
    const nitida = document.createElement('canvas');
    carregarPrevia360(nitida, previaDe(video), olharInicialDe(video), ABERTURA_INICIAL,
        largura, largura * alturaDoEcra / larguraDoEcra)
        .then(() => {
            if (!tapa.isConnected) return;
            tela.width = nitida.width;
            tela.height = nitida.height;
            tela.getContext('2d').drawImage(nitida, 0, 0);
        })
        .catch(() => { /* sem imagem, fica o preto de sempre, com o quadrado */ });

    let saiu = false;
    const sair = () => {
        if (saiu) return;
        saiu = true;
        window.removeEventListener('message', aoAviso);
        tapa.remove();
    };
    // Sai quando o filme anda, e não antes: até lá é esta imagem, com o
    // quadrado de espera, que está à vista — a mesma que a página de lá
    // mostra por baixo — e assim nunca se ouve o filme com a imagem
    // parada por cima, nem se vê o preto de a cena ainda estar a nascer.
    const aoAviso = (e) => {
        const janela = this.janelaDoMeio360();
        if (!janela || e.source !== janela.contentWindow || !e.data) return;
        if (e.data.malhaViva === 'filme360aAndar' || e.data.malhaViva === 'botao360aEspera' ||
            e.data.malhaViva === 'aviso360') {
            sair();
        }
    };
    // O aviso é que manda; o relógio é só para o caso de ele não vir.
    window.addEventListener('message', aoAviso);
    setTimeout(sair, 30000);
};

/**
 * Enche uma das janelas dos lados com uma paragem.
 *
 * Da fotografia mostra-se a própria imagem; de uma rota, o primeiro
 * instante, visto de onde a rota começa a ser vista — é exactamente o
 * que vai estar no meio quando se passar para lá, e é por isso que a
 * passagem se faz sem salto.
 *
 * @param {HTMLElement} previa - A janela do lado.
 * @param {object} ann - A paragem a mostrar.
 */
AnnotationController.prototype.encherPrevia360 = function(previa, ann) {
    if (!previa || !ann) {
        return;
    }
    const nome = this.nomeDaParagem360(ann);
    previa.title = nome;
    // A imagem do lado não tem o nome escrito à vista: quem não vê o ecrã
    // ouve qual é a paragem que ela abre.
    previa.setAttribute('aria-label', this.nomeAcessivel(ann));

    const tela = previa.querySelector('.previa-janela canvas');
    const foto = previa.querySelector('.previa-janela img');

    if (ann.isImage) {
        tela.style.display = 'none';
        tela.dataset.video = '';
        foto.style.display = '';
        if (foto.getAttribute('src') !== ann.imagePath) {
            foto.setAttribute('src', ann.imagePath);
        }
        return;
    }

    foto.style.display = 'none';
    foto.removeAttribute('src');
    tela.style.display = '';

    const video = this.videoDaRota360(ann);
    if (tela.dataset.video === video) {
        return;
    }
    tela.dataset.video = video;
    // Desenha-se mais larga do que qualquer ecrã (2,4 para 1), e a roupa
    // corta-lhe os lados ao feitio da janela: com a mesma abertura de alto
    // a baixo, uma vista mais estreita é só o meio de uma mais larga. É
    // por isso que esta imagem serve à janela do meio tal como está,
    // venha o ecrã com o feitio que vier (ver tapar360EnquantoChega).
    carregarPrevia360(tela, previaDe(video), olharInicialDe(video), ABERTURA_INICIAL, 960, 400)
        .catch((erro) => console.warn(erro.message));
};

/**
 * Mede a barra dos comandos que vive dentro da janela da paragem.
 *
 * A barra é desenhada na outra página, e a altura dela muda com o tamanho
 * do ecrã e com o que a paragem é — uma fotografia tem menos botões do
 * que uma rota. A barra de reserva, cá fora, tem de ter a mesma altura,
 * para a de lá lhe assentar em cima sem se dar por isso.
 */
AnnotationController.prototype.medirComandos360 = function() {
    const palco = this.palco360;
    if (!palco) {
        return;
    }
    const janela = this.janelaDoMeio360();
    let barra = null;
    try {
        barra = janela && janela.contentDocument &&
            janela.contentDocument.querySelector('.video-controls');
    } catch (e) { /* outra origem: fica a altura de omissão */ }
    if (barra && barra.offsetHeight > 0) {
        palco.modal.style.setProperty('--altura-controlos', barra.offsetHeight + 'px');
        this.lembrarAlturaDosComandos360(this.paragem360, barra.offsetHeight);
    }
};

/**
 * A chave com que se lembra a altura da barra dos comandos de uma
 * paragem: o tipo dela (a barra da fotografia tem menos botões) e a
 * largura do ecrã (num ecrã estreito a barra é mais apertada).
 *
 * @param {object} ann - A paragem.
 * @returns {string} A chave.
 */
AnnotationController.prototype.chaveDaAlturaDosComandos360 = function(ann) {
    return (ann && ann.isImage ? 'foto' : 'rota') + (window.innerWidth <= 900 ? '_estreito' : '_largo');
};

/**
 * A altura da barra dos comandos de uma paragem, tal como foi medida da
 * última vez — nesta visita ou numa anterior. Sem medida nenhuma, vale a
 * altura de sempre da barra das rotas.
 *
 * @param {object} ann - A paragem.
 * @returns {number} A altura, em pontos; zero se não se souber.
 */
AnnotationController.prototype.alturaLembradaDosComandos360 = function(ann) {
    if (!this.alturaDosComandos360) {
        this.alturaDosComandos360 = {};
        try {
            Object.assign(this.alturaDosComandos360, JSON.parse(localStorage.getItem('altura-comandos-360') || '{}'));
        } catch (e) { /* sem memória: mede-se de novo */ }
    }
    const chave = this.chaveDaAlturaDosComandos360(ann);
    if (this.alturaDosComandos360[chave]) return this.alturaDosComandos360[chave];
    // Sem medida, a altura de sempre da barra das rotas: acerta na maior
    // parte dos ecrãs, e onde não acertar a medida corrige-a de seguida.
    return ann && ann.isImage ? 0 : 105;
};

/**
 * Guarda a altura medida da barra dos comandos de uma paragem, para a
 * próxima vez — e para a próxima visita.
 *
 * @param {object} ann - A paragem.
 * @param {number} altura - A altura medida, em pontos.
 */
AnnotationController.prototype.lembrarAlturaDosComandos360 = function(ann, altura) {
    if (!this.alturaDosComandos360) this.alturaDosComandos360 = {};
    this.alturaDosComandos360[this.chaveDaAlturaDosComandos360(ann)] = altura;
    try {
        localStorage.setItem('altura-comandos-360', JSON.stringify(this.alturaDosComandos360));
    } catch (e) { /* sem memória: fica só para esta visita */ }
};

/**
 * Fecha o palco das paragens e devolve o bairro a quem estava a ver.
 */
AnnotationController.prototype.fecharPalco360 = function() {
    const palco = this.palco360;
    if (!palco) {
        return;
    }
    const overlay = avisarQueOBairroVolta();
    if (this.paragem360) {
        this.marcarComoUltima(this.idDaAnotacao(this.paragem360));
    }
    // Uma página da rota que ainda estivesse para nascer já não nasce, e
    // uma troca que estivesse a meio acaba já.
    clearTimeout(this.esperaDaJanela360);
    this.arrumarTrocaNaJanela360();
    sairDoEcraInteiroDo(palco.modal);
    palco.pecas.esconder();

    palco.modal.style.opacity = '0';
    palco.meio.classList.remove('aberta');
    setTimeout(() => {
        palco.modal.style.display = 'none';
        palco.modal.classList.remove('inteira');
        palco.moldura.innerHTML = '';
        const gsplat = this.app.root.findByName('gsplat-scene');
        if (gsplat) gsplat.enabled = true;
        arrumarAvisoDoBairro(overlay);
        // O foco volta ao marcador da paragem que se fechou, para quem
        // anda de tecla não ficar perdido no meio da página.
        const marcador = this.paragem360 && this.paragem360.element;
        if (marcador && marcador.getAttribute('tabindex') !== '-1') {
            marcador.focus({ preventScroll: true });
        }
    }, 300);
};


AnnotationController.prototype.setupModal = function() {
    this.modal = document.createElement('div');
    this.modal.id = 'video-modal';
    this.modal.style.position = 'fixed';
    this.modal.style.top = '0';
    this.modal.style.left = '0';
    this.modal.style.width = '100%';
    this.modal.style.height = '100%';
    this.modal.style.backgroundColor = '#05050a';
    this.modal.style.display = 'none';
    this.modal.style.alignItems = 'center';
    this.modal.style.justifyContent = 'center';
    this.modal.style.zIndex = '2000';
    this.modal.style.opacity = '0';
    this.modal.style.transition = 'opacity 0.3s ease';

    const content = document.createElement('div');
    content.className = 'janela-do-palco janela-do-player';
    this.modalContent = content;

    const header = document.createElement('div');
    header.className = 'barra-do-nome';
    this.barraDoNome = header;

    this.modalTitle = document.createElement('div');
    this.modalTitle.className = 'nome-do-video';
    this.modalTitle.style.color = '#fff';
    this.modalTitle.style.fontWeight = '600';
    this.modalTitle.style.fontSize = '1.1rem';

    header.appendChild(this.modalTitle);
    header.appendChild(this.criarBotoesDeTopo(() => closeModal()));

    // Custom Video Player UI
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'custom-video-container paused';
    this.videoWrapper = videoWrapper;

    this.videoPlayer = document.createElement('video');
    this.videoPlayer.style.width = '100%';
    this.videoPlayer.style.height = '100%';
    this.videoPlayer.playsInline = true;
    this.videoPlayer.setAttribute('decoding', 'async'); // Optimize decoding performance for low-end devices
    this.videoPlayer.crossOrigin = "anonymous"; // Necessário para Web Audio API com URLs externos

    // Big Play Button
    const bigPlayBtn = document.createElement('div');
    bigPlayBtn.className = 'big-play-btn';
    bigPlayBtn.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';

    // Controls
    const controls = document.createElement('div');
    controls.className = 'video-controls';

    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressFilled = document.createElement('div');
    progressFilled.className = 'progress-filled';
    progressContainer.appendChild(progressFilled);
    this.progressFilled = progressFilled;

    // Control buttons
    const controlsMain = document.createElement('div');
    controlsMain.className = 'controls-main';

    // Left controls
    const controlsLeft = document.createElement('div');
    controlsLeft.className = 'controls-left';

    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'player-btn';
    const playIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    const pauseIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    playPauseBtn.innerHTML = playIcon;

    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';
    timeDisplay.innerText = '0:00 / 0:00';
    this.timeDisplay = timeDisplay;

    // Volume Control
    const volumeContainer = document.createElement('div');
    volumeContainer.className = 'volume-container';

    const volumeBtn = document.createElement('button');
    volumeBtn.className = 'player-btn';
    const volHighIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
    const volMutedIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
    volumeBtn.innerHTML = volHighIcon;

    const volumeSliderWrapper = document.createElement('div');
    volumeSliderWrapper.className = 'volume-slider-wrapper';

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.className = 'volume-slider';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.05';
    volumeSlider.value = '1';

    const volumePercentage = document.createElement('div');
    volumePercentage.className = 'volume-percentage';
    volumePercentage.innerText = '100%';

    volumeSliderWrapper.appendChild(volumeSlider);
    volumeSliderWrapper.appendChild(volumePercentage);

    volumeContainer.appendChild(volumeBtn);
    volumeContainer.appendChild(volumeSliderWrapper);

    // Recuar e avançar cinco segundos, como no tocador das rotas 360º.
    const recuarBtn = document.createElement('button');
    recuarBtn.className = 'player-btn';
    recuarBtn.setAttribute('data-i18n-title', 'v360.recuar');
    recuarBtn.title = (window.Idiomas ? window.Idiomas.t('v360.recuar') : 'Recuar 5 segundos');
    recuarBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="11 18 5 12 11 6"></polyline><polyline points="19 18 13 12 19 6"></polyline></svg>';

    const avancarBtn = document.createElement('button');
    avancarBtn.className = 'player-btn';
    avancarBtn.setAttribute('data-i18n-title', 'v360.avancar');
    avancarBtn.title = (window.Idiomas ? window.Idiomas.t('v360.avancar') : 'Avançar 5 segundos');
    avancarBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="5 18 11 12 5 6"></polyline><polyline points="13 18 19 12 13 6"></polyline></svg>';

    playPauseBtn.setAttribute('data-i18n-title', 'v360.tocar');
    playPauseBtn.title = (window.Idiomas ? window.Idiomas.t('v360.tocar') : 'Tocar / Pausar');

    controlsLeft.appendChild(recuarBtn);
    controlsLeft.appendChild(playPauseBtn);
    controlsLeft.appendChild(avancarBtn);
    controlsLeft.appendChild(volumeContainer);

    // Right controls
    const controlsRight = document.createElement('div');
    controlsRight.className = 'controls-right';

    const qualityContainer = document.createElement('div');
    qualityContainer.style.position = 'relative';

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'player-btn';
    settingsBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><circle cx="12" cy="12" r="3"></circle><path d="M10.08 4.85L10.07 1.58L13.93 1.58L13.92 4.85A7.4 7.4 0 0 1 17.23 6.77L20.06 5.12L21.99 8.46L19.15 10.08A7.4 7.4 0 0 1 19.15 13.92L21.99 15.54L20.06 18.88L17.23 17.23A7.4 7.4 0 0 1 13.92 19.15L13.93 22.42L10.07 22.42L10.08 19.15A7.4 7.4 0 0 1 6.77 17.23L3.94 18.88L2.01 15.54L4.85 13.92A7.4 7.4 0 0 1 4.85 10.08L2.01 8.46L3.94 5.12L6.77 6.77A7.4 7.4 0 0 1 10.08 4.85Z"></path></svg>';

    this.qualityMenu = document.createElement('div');
    this.qualityMenu.className = 'quality-menu';

    qualityContainer.appendChild(settingsBtn);
    qualityContainer.appendChild(this.qualityMenu);

    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'player-btn';
    fullscreenBtn.setAttribute('data-i18n-title', 'v360.ecra');
    fullscreenBtn.title = (window.Idiomas ? window.Idiomas.t('v360.ecra') : 'Ecrã inteiro');
    fullscreenBtn.innerHTML = ICONE_ECRA_INTEIRO;

    const vrBtn = document.createElement('button');
    vrBtn.className = 'player-btn';
    vrBtn.title = (window.Idiomas ? window.Idiomas.t('video.oculos') : 'Ver com óculos');
    vrBtn.setAttribute('data-i18n-title', 'video.oculos');
    vrBtn.style.display = 'none';
    vrBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M2 5h20v14h-6l-2-4h-4l-2 4H2z"></path><rect x="5" y="9" width="4" height="4"></rect><rect x="15" y="9" width="4" height="4"></rect></svg>';

    // Só aparece a quem tenha óculos — a sério, ou de cartão no telemóvel
    // (ver vr-cartao.js), que chegam um pouco depois de a página abrir.
    const haOculos = window.VRCartao && window.VRCartao.pronto
        ? window.VRCartao.pronto
        : (navigator.xr && navigator.xr.isSessionSupported
            ? navigator.xr.isSessionSupported('immersive-vr').catch(() => false)
            : Promise.resolve(false));
    haOculos.then((tem) => { if (tem) vrBtn.style.display = ''; });

    // Uma entrevista dentro dos óculos vê-se como num cinema vazio: um
    // ecrã grande à frente, com o vídeo a continuar de onde ia. Quem trata
    // disso é a mesma página que já mostra as rotas 360º, aqui em modo de
    // ecrã plano.
    vrBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.videoNome) return;
        const momento = Math.max(0, Math.floor(this.videoPlayer.currentTime));
        this.videoPlayer.pause();
        this.abrirCinemaVR(videoWrapper, this.videoNome, momento);
    });

    controlsRight.appendChild(qualityContainer);
    controlsRight.appendChild(vrBtn);
    controlsRight.appendChild(fullscreenBtn);

    controlsMain.appendChild(controlsLeft);
    controlsMain.appendChild(controlsRight);

    // O tempo vive logo por cima da barra, e não no meio dos botões:
    // assim começa onde a barra começa e lê-se sem procurar.
    const tempoEBarra = document.createElement('div');
    tempoEBarra.className = 'tempo-e-barra';
    tempoEBarra.appendChild(timeDisplay);
    tempoEBarra.appendChild(progressContainer);

    controls.appendChild(tempoEBarra);
    controls.appendChild(controlsMain);

    // O quadrado que aparece quando o vídeo fica à espera de mais imagem.
    const espera = document.createElement('div');
    espera.className = 'espera-video';
    if (window.QuadradoDeEspera) window.QuadradoDeEspera.fazer(espera);
    videoWrapper.appendChild(espera);

    // Os dois sinais que piscam ao saltar cinco segundos com duplo clique.
    const setaDupla = (paraTras) => paraTras
        ? '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="11 18 5 12 11 6"></polyline><polyline points="19 18 13 12 19 6"></polyline></svg>'
        : '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="5 18 11 12 5 6"></polyline><polyline points="13 18 19 12 13 6"></polyline></svg>';

    const sinalEsquerda = document.createElement('div');
    sinalEsquerda.className = 'salto-sinal esquerda';
    sinalEsquerda.innerHTML = setaDupla(true) + '<span>5 s</span>';
    const sinalDireita = document.createElement('div');
    sinalDireita.className = 'salto-sinal direita';
    sinalDireita.innerHTML = setaDupla(false) + '<span>5 s</span>';
    videoWrapper.appendChild(sinalEsquerda);
    videoWrapper.appendChild(sinalDireita);

    videoWrapper.appendChild(this.videoPlayer);

    // Ao trocar de testemunho, a última imagem do que se deixou fica aqui
    // por cima e esbate-se para o novo (ver trocarNoLeitor).
    this.imagemDeAntes = document.createElement('canvas');
    this.imagemDeAntes.className = 'imagem-de-antes';
    this.imagemDeAntes.setAttribute('aria-hidden', 'true');
    videoWrapper.appendChild(this.imagemDeAntes);

    videoWrapper.appendChild(bigPlayBtn);

    // A imagem e a barra dos comandos, uma peça só.
    const moldura = document.createElement('div');
    moldura.className = 'moldura-do-player';
    moldura.appendChild(videoWrapper);
    moldura.appendChild(controls);
    this.barraDosComandos = controls;

    // De cada lado, o primeiro instante do anterior e do seguinte —
    // escondido: é dele que o leitor copia a primeira imagem ao trocar de
    // testemunho, para não piscar em preto (ver abrirTestemunho).
    const criarPrevia = (lado, sentido) => {
        const previa = document.createElement('button');
        previa.type = 'button';
        previa.className = 'previa ' + lado;

        const janela = document.createElement('div');
        janela.className = 'previa-janela';
        const filme = document.createElement('video');
        filme.muted = true;
        filme.playsInline = true;
        filme.preload = 'metadata';
        filme.crossOrigin = 'anonymous';
        janela.appendChild(filme);
        previa.appendChild(janela);

        // Carregar na imagem é o mesmo que carregar na seta desse lado:
        // o percurso anda um passo, e o vídeo troca dentro do leitor.
        previa.addEventListener('click', () => {
            if (this.aTrocarDeTestemunho) return;
            const ann = this.testemunhoAoLado(sentido);
            if (ann) this.openVideoModal(ann.video, ann.label, sentido);
        });
        return previa;
    };

    this.previaEsquerda = criarPrevia('esquerda', -1);
    this.previaDireita = criarPrevia('direita', 1);

    // A seta de cada lado, junto à borda.
    const criarSeta = (lado, bico, sentido) => {
        const seta = document.createElement('button');
        seta.type = 'button';
        seta.className = 'seta-do-palco ' + lado;
        seta.innerHTML = desenhoDaSeta(bico);
        const chave = sentido < 0 ? 'palco.anterior' : 'palco.seguinte';
        seta.setAttribute('data-i18n-title', chave);
        seta.title = window.Idiomas ? window.Idiomas.t(chave) : '';
        seta.addEventListener('click', (e) => {
            e.stopPropagation();
            // No fim do percurso, esta seta já é a cruz de saída.
            if (seta.classList.contains('a-sair')) {
                if (this.fecharModal) this.fecharModal();
                return;
            }
            if (this.aTrocarDeTestemunho) return;
            const ann = this.testemunhoAoLado(sentido);
            if (ann) this.openVideoModal(ann.video, ann.label, sentido);
        });
        return seta;
    };
    this.setaEsquerda = criarSeta('esquerda', BICO_ESQUERDA, -1);
    this.setaDireita = criarSeta('direita', BICO_DIREITA, 1);

    content.appendChild(header);
    content.appendChild(moldura);

    // O leitor enche o ecrã; de cada lado, por cima dele, a seta para o
    // anterior e para o seguinte — o mesmo desenho do palco das paragens
    // 360º.
    const ladoEsquerdo = document.createElement('div');
    ladoEsquerdo.className = 'lado-do-palco esquerda';
    ladoEsquerdo.appendChild(this.previaEsquerda);
    ladoEsquerdo.appendChild(this.setaEsquerda);
    const ladoDireito = document.createElement('div');
    ladoDireito.className = 'lado-do-palco direita';
    ladoDireito.appendChild(this.setaDireita);
    ladoDireito.appendChild(this.previaDireita);

    this.modal.appendChild(content);
    this.modal.appendChild(ladoEsquerdo);
    this.modal.appendChild(ladoDireito);
    document.body.appendChild(this.modal);

    // As peças por cima do testemunho — as duas barras e os lados —
    // aparecem com o rato e somem-se sozinhas.
    this.pecasDoTestemunho = pecasQueSeEscondem(this.modal);

    // --- Player Logic ---
    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const togglePlay = () => {
        if (this.videoPlayer.paused) {
            // Se entretanto a versão do vídeo trocar, este pedido é
            // cancelado pelo navegador — não é um erro que interesse.
            this.videoPlayer.play().catch(() => {});
        } else {
            this.videoPlayer.pause();
        }
    };

    // Web Audio API for >100% Volume
    let audioCtx;
    let gainNode;
    let mediaSource;
    let isMuted = false;
    let currentVolume = 1;

    const initAudio = () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            mediaSource = audioCtx.createMediaElementSource(this.videoPlayer);
            gainNode = audioCtx.createGain();
            mediaSource.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            gainNode.gain.value = currentVolume;
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    };

    volumeSlider.addEventListener('input', (e) => {
        currentVolume = parseFloat(e.target.value);
        if (gainNode) gainNode.gain.value = currentVolume;
        volumePercentage.innerText = Math.round(currentVolume * 100) + '%';

        if (currentVolume === 0) {
            volumeBtn.innerHTML = volMutedIcon;
            isMuted = true;
        } else {
            volumeBtn.innerHTML = volHighIcon;
            isMuted = false;
        }
    });

    volumeBtn.addEventListener('click', () => {
        if (isMuted) {
            currentVolume = parseFloat(volumeSlider.value) || 1;
            if (currentVolume === 0) {
                currentVolume = 1; 
                volumeSlider.value = 1;
            }
            if (gainNode) gainNode.gain.value = currentVolume;
            volumePercentage.innerText = Math.round(currentVolume * 100) + '%';
            volumeBtn.innerHTML = volHighIcon;
            isMuted = false;
        } else {
            if (gainNode) gainNode.gain.value = 0;
            volumePercentage.innerText = '0%';
            volumeBtn.innerHTML = volMutedIcon;
            isMuted = true;
        }
    });

    this.videoPlayer.addEventListener('play', () => {
        playPauseBtn.innerHTML = pauseIcon;
        videoWrapper.classList.remove('paused');
        initAudio(); // Required to start AudioContext on user interaction
    });

    this.videoPlayer.addEventListener('pause', () => {
        playPauseBtn.innerHTML = playIcon;
        videoWrapper.classList.add('paused');
    });

    playPauseBtn.addEventListener('click', togglePlay);
    bigPlayBtn.addEventListener('click', togglePlay);
    // O clique único espera um instante antes de pausar: se vier um
    // segundo atrás dele, o que se queria era saltar e não pausar.
    //
    // Num ecrã de toque, com as peças escondidas, o primeiro toque na
    // imagem só as traz à vista, e não pára o vídeo — é o que qualquer
    // leitor de telemóvel faz. Vê-se isso ao pousar o dedo, antes de o
    // toque as mostrar.
    let cliqueSozinho = null;
    let toqueParaVer = false;
    this.videoPlayer.addEventListener('pointerdown', (e) => {
        toqueParaVer = e.pointerType !== 'mouse' && !this.modal.classList.contains('comandos-a-ver');
    });
    this.videoPlayer.addEventListener('click', () => {
        if (toqueParaVer) {
            toqueParaVer = false;
            return;
        }
        clearTimeout(cliqueSozinho);
        cliqueSozinho = setTimeout(togglePlay, 260);
    });

    this.videoPlayer.addEventListener('timeupdate', () => {
        const percent = (this.videoPlayer.currentTime / this.videoPlayer.duration) * 100;
        progressFilled.style.width = `${percent}%`;
        timeDisplay.innerText = `${formatTime(this.videoPlayer.currentTime)} / ${formatTime(this.videoPlayer.duration)}`;
    });

    this.videoPlayer.addEventListener('loadedmetadata', () => {
        timeDisplay.innerText = `${formatTime(this.videoPlayer.currentTime)} / ${formatTime(this.videoPlayer.duration)}`;
    });

    // ---- Procurar um sítio na barra do tempo ----
    // Antes só se podia clicar num ponto; agora arrasta-se por ela fora,
    // que é como toda a gente espera procurar um sítio no vídeo.
    let aArrastarTempo = false;
    const tempoNaBarra = (clientX) => {
        const rect = progressContainer.getBoundingClientRect();
        const parte = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        if (isFinite(this.videoPlayer.duration)) {
            this.videoPlayer.currentTime = parte * this.videoPlayer.duration;
            progressFilled.style.width = (parte * 100) + '%';
        }
    };
    progressContainer.addEventListener('pointerdown', (e) => {
        aArrastarTempo = true;
        progressContainer.setPointerCapture(e.pointerId);
        tempoNaBarra(e.clientX);
    });
    progressContainer.addEventListener('pointermove', (e) => {
        if (aArrastarTempo) tempoNaBarra(e.clientX);
    });
    const largarBarra = () => { aArrastarTempo = false; };
    progressContainer.addEventListener('pointerup', largarBarra);
    progressContainer.addEventListener('pointercancel', largarBarra);

    // ---- Saltar cinco segundos ----
    const SALTO = 5;
    const saltar = (segundos) => {
        if (!isFinite(this.videoPlayer.duration)) return;
        this.videoPlayer.currentTime = Math.min(
            Math.max(0, this.videoPlayer.currentTime + segundos),
            this.videoPlayer.duration
        );
        const sinal = segundos < 0 ? sinalEsquerda : sinalDireita;
        sinal.classList.remove('a-piscar');
        void sinal.offsetWidth;
        sinal.classList.add('a-piscar');
        showControls();
    };
    recuarBtn.addEventListener('click', (e) => { e.stopPropagation(); saltar(-SALTO); });
    avancarBtn.addEventListener('click', (e) => { e.stopPropagation(); saltar(SALTO); });

    // Duplo clique de um dos lados da imagem: para trás do lado esquerdo,
    // para a frente do direito, como em qualquer tocador de telemóvel.
    this.videoPlayer.addEventListener('dblclick', (e) => {
        e.preventDefault();
        clearTimeout(cliqueSozinho);
        const rect = this.videoPlayer.getBoundingClientRect();
        const meio = rect.left + rect.width / 2;
        saltar(e.clientX < meio ? -SALTO : SALTO);
    });

    // ---- À espera de mais imagem ----
    this.videoPlayer.addEventListener('waiting', () => espera.classList.add('a-esperar'));
    this.videoPlayer.addEventListener('stalled', () => espera.classList.add('a-esperar'));
    ['playing', 'canplay', 'pause', 'seeked'].forEach((quando) => {
        this.videoPlayer.addEventListener(quando, () => espera.classList.remove('a-esperar'));
    });

    // ---- Teclas ----
    // Só valem com a janela do vídeo aberta, para não roubarem as teclas
    // ao mapa que está por trás.
    //
    // As setas dos lados não estão aqui: passaram a mudar de testemunho, o
    // que é o que as setas desenhadas de cada lado da janela fazem, e é
    // tratado com o resto dos comandos. Saltar dentro do filme fica no J e
    // no L, ao lado do K que já tocava e parava.
    document.addEventListener('keydown', (e) => {
        if (this.modal.style.display === 'none') return;
        if (e.target && /^(?:INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const tecla = e.key.toLowerCase();
        if (tecla === ' ' || tecla === 'k') {
            e.preventDefault();
            togglePlay();
        } else if (tecla === 'j') {
            e.preventDefault();
            saltar(-5);
        } else if (tecla === 'l') {
            e.preventDefault();
            saltar(5);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            volumeSlider.value = Math.min(1, parseFloat(volumeSlider.value) + 0.1);
            volumeSlider.dispatchEvent(new Event('input'));
            showControls();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 0.1);
            volumeSlider.dispatchEvent(new Event('input'));
            showControls();
        } else if (tecla === 'm') {
            volumeBtn.click();
        } else if (tecla === 'f') {
            fullscreenBtn.click();
        }
    });

    // Saltar e mexer no volume de tecla também trazem as peças à vista,
    // como o rato: vê-se o tempo e o volume a mudar.
    const showControls = () => this.pecasDoTestemunho.mostrar();

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.qualityMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        this.qualityMenu.classList.remove('show');
    });

    // O palco já enche a janela do navegador; este botão leva-o ao ecrã
    // inteiro, com as setas e a cruz de fechar.
    fullscreenBtn.addEventListener('click', () => alternarEcraInteiro(this.modal));

    document.addEventListener('fullscreenchange', () => {
        fullscreenBtn.innerHTML = emEcraInteiro() ? ICONE_SAIR_DO_ECRA : ICONE_ECRA_INTEIRO;
    });

    const closeModal = () => {
        const overlay = avisarQueOBairroVolta();

        if (this.videoNome) {
            this.marcarComoUltima('video-' + this.videoNome);
        }

        sairDoEcraInteiroDo(this.modal);
        this.pecasDoTestemunho.esconder();
        this.modal.style.opacity = '0';
        this.modalContent.classList.remove('aberta');

        setTimeout(() => {
            this.modal.style.display = 'none';
            this.fecharCinemaVR();
            if (this.gestorDeQualidade) {
                this.gestorDeQualidade.parar();
                this.gestorDeQualidade = null;
            }
            this.videoPlayer.pause();
            this.videoPlayer.src = ''; 
            const gsplat = this.app.root.findByName('gsplat-scene');
            if (gsplat) gsplat.enabled = true;

            arrumarAvisoDoBairro(overlay);
        }, 300);
    };

    // O fecho do modal fica à mão para as setas do palco o poderem usar.
    this.fecharModal = closeModal;

    // Um testemunho que chega ao fim conta como visto, e o seguinte que
    // ainda ninguém viu entra a seguir. Se era o último, não há mais nada
    // a mostrar: a janela fecha-se e devolve o bairro.
    this.videoPlayer.addEventListener('ended', () => {
        if (!this.videoNome) return;
        this.marcarComoVisto('video-' + this.videoNome);

        const lista = this.annotations.filter(ann => !ann.is360 && ann.video);
        const onde = lista.findIndex(ann => ann.video === this.videoNome);
        if (onde >= 0) {
            if (autoLigado()) {
                // Segue para a frente no percurso — para o lado por onde
                // se andou, ou para a direita se ainda não se andou. No
                // fim dele, fecha.
                const p = this.percursoTestemunhos;
                const sentido = p && p.sentido ? p.sentido : 1;
                const ann = this.testemunhoAoLado(sentido);
                if (ann) {
                    this.openVideoModal(ann.video, ann.label, sentido);
                } else {
                    closeModal();
                }
            }
        }
    });

    // Store references for the openVideoModal function
    this.videoSources = null;
};

/**
 * Põe nas janelas dos lados o que o percurso tem de cada lado do
 * testemunho que está a dar (ver {@link ladosDoPercurso}).
 *
 * @param {string} nomeAtual - O testemunho que está a dar.
 * @param {number} [sentido] - O lado para onde se acabou de passar.
 * @param {string} [oldCenterFrame] - A imagem de onde se vinha, para a
 *     janela do lado de onde se veio não nascer preta.
 */
AnnotationController.prototype.atualizarPalco = function(nomeAtual, sentido, oldCenterFrame) {
    const lista = this.annotations.filter(ann => !ann.is360 && ann.video);
    const onde = lista.findIndex(ann => ann.video === nomeAtual);
    if (onde < 0 || lista.length < 2) {
        return;
    }
    // Ao abrir começa um percurso novo a partir daqui; ao passar de
    // testemunho o percurso já andou (ver testemunhoAoLado).
    if (!sentido || !this.percursoTestemunhos) {
        this.percursoTestemunhos = this.comecarPercurso(onde);
    }
    const lados = this.ladosDoPercurso(this.percursoTestemunhos, lista);
    this.arrumarLado(this.setaEsquerda, this.previaEsquerda, BICO_ESQUERDA, lados.esquerda.cruz);
    this.arrumarLado(this.setaDireita, this.previaDireita, BICO_DIREITA, lados.direita.cruz);

    // A janela do lado de onde se veio fica com a imagem de onde se vinha.
    const posterEsq = sentido === 1 ? oldCenterFrame : null;
    const posterDir = sentido === -1 ? oldCenterFrame : null;
    if (lados.esquerda.ann) this.encherPrevia(this.previaEsquerda, lados.esquerda.ann, posterEsq);
    if (lados.direita.ann) this.encherPrevia(this.previaDireita, lados.direita.ann, posterDir);
};

/**
 * O testemunho que está de um dos lados no percurso, andando para lá.
 *
 * Anda mesmo no percurso: chamar isto é passar para esse lado. Devolve
 * nada no fim do percurso, onde a seta já é a cruz.
 *
 * @param {number} sentido - -1 para a esquerda, 1 para a direita.
 * @returns {object|null} O testemunho desse lado, ou nada.
 */
AnnotationController.prototype.testemunhoAoLado = function(sentido) {
    const lista = this.annotations.filter(ann => !ann.is360 && ann.video);
    if (!this.percursoTestemunhos || lista.length < 2) {
        return null;
    }
    const onde = this.andarNoPercurso(this.percursoTestemunhos, lista.length, sentido);
    return onde === null ? null : lista[onde];
};

/**
 * Enche uma das janelas dos lados com o primeiro instante de um vídeo.
 *
 * Vai buscar a versão mais leve que exista, e pede só o suficiente para
 * mostrar uma imagem parada: não é para ser visto, é para se saber quem é.
 *
 * @param {HTMLElement} previa - A janela.
 * @param {object} ann - A anotação a mostrar.
 */
AnnotationController.prototype.encherPrevia = function(previa, ann, posterDataUrl) {
    if (!previa || !ann) {
        return;
    }
    previa.dataset.video = ann.video;
    // Nome de pessoa: fica como está em qualquer língua.
    previa.title = ann.label;
    // A imagem do lado não tem o nome escrito à vista: quem não vê o ecrã
    // ouve de quem é o testemunho que ela abre.
    previa.setAttribute('aria-label', this.nomeAcessivel(ann));

    const fontes = fontesDeVideo(ann.video);
    const leve = fontes['480p'] || fontes['720p'] || Object.values(fontes)[0];
    if (!leve) {
        return;
    }
    // O "#t=0.001" pede ao navegador a imagem do primeiro instante, senão a
    // janela ficava preta até alguém carregar nela.
    const desejado = leve + '#t=0.001';
    const filme = previa.querySelector('.previa-janela video');
    if (filme.getAttribute('src') !== desejado) {
        filme.removeAttribute('poster');

        if (posterDataUrl) {
            filme.poster = posterDataUrl;
            filme.style.opacity = '1';
            filme.style.transition = 'none';
        } else {
            // Se for um vídeo novo sem poster da transição, começa transparente
            // para não piscar preto e depois desvanece suavemente.
            filme.style.opacity = '0';
            filme.style.transition = 'none';
        }

        filme.setAttribute('src', desejado);
        filme.load();

        if (!posterDataUrl) {
            const onLoaded = () => {
                filme.removeEventListener('loadeddata', onLoaded);
                filme.removeEventListener('error', onLoaded);
                filme.style.transition = 'opacity 0.4s ease';
                filme.style.opacity = '1';
                setTimeout(() => { filme.style.transition = ''; }, 450);
            };
            filme.addEventListener('loadeddata', onLoaded);
            filme.addEventListener('error', onLoaded);
        }
    }
};

/**
 * O nome com que uma anotação é lembrada de uma visita para a outra.
 *
 * @param {object} ann - A anotação.
 * @returns {string} O nome dela na memória do navegador.
 */
AnnotationController.prototype.idDaAnotacao = function(ann) {
    return ann.is360 ? `360-${ann.trailIndex}` : `video-${ann.video}`;
};

/**
 * Deixa uma anotação assinalada como vista — no ponto do mapa e na
 * memória do navegador, para continuar apagada da próxima vez que se entre.
 *
 * @param {string} annId - O nome da anotação.
 */
AnnotationController.prototype.marcarComoVisto = function(annId) {
    if (!annId || this.viewedAnnotations.includes(annId)) {
        return;
    }
    this.viewedAnnotations.push(annId);
    try {
        localStorage.setItem('viewedAnnotations', JSON.stringify(this.viewedAnnotations));
    } catch (e) {
        console.warn("Could not save viewed annotations", e);
    }
    const ann = this.annotations.find(a => this.idDaAnotacao(a) === annId);
    const ponto = ann && ann.element && ann.element.querySelector('.marker-dot');
    if (ponto) ponto.classList.add('viewed');
};

/**
 * Destaca a última anotação de onde o utilizador saiu, com um contorno branco.
 *
 * @param {string} annId - O nome da anotação.
 */
AnnotationController.prototype.marcarComoUltima = function(annId) {
    this.annotations.forEach(a => {
        const dot = a.element && a.element.querySelector('.marker-dot');
        if (dot) dot.classList.remove('last-viewed');
    });
    if (annId) {
        const ann = this.annotations.find(a => this.idDaAnotacao(a) === annId);
        const ponto = ann && ann.element && ann.element.querySelector('.marker-dot');
        if (ponto) ponto.classList.add('last-viewed');
    }
};

/**
 * Se já foram vistas todas as paragens de uma colecção.
 *
 * @param {object[]} lista - As paragens da colecção.
 * @returns {boolean} Verdadeiro se não faltar nenhuma.
 */
AnnotationController.prototype.coleccaoVista = function(lista) {
    return lista.length > 0 &&
        lista.every(ann => this.viewedAnnotations.includes(this.idDaAnotacao(ann)));
};

/**
 * Arruma um dos lados do palco: ou a seta e a janela do que está desse
 * lado, ou a cruz de saída.
 *
 * @param {HTMLElement} seta - A seta desse lado.
 * @param {HTMLElement} previa - A janela desse lado.
 * @param {string} bico - O desenho da seta desse lado.
 * @param {boolean} cruz - Se esse lado é o fim do percurso.
 */
AnnotationController.prototype.arrumarLado = function(seta, previa, bico, cruz) {
    if (previa) {
        previa.classList.toggle('sem-seguinte', cruz);
    }
    if (!seta) {
        return;
    }
    seta.classList.toggle('a-sair', cruz);
    seta.innerHTML = cruz ? DESENHO_DA_CRUZ : desenhoDaSeta(bico);
    const chave = cruz ? 'palco.sair' : (bico === BICO_ESQUERDA ? 'palco.anterior' : 'palco.seguinte');
    seta.setAttribute('data-i18n-title', chave);
    seta.title = window.Idiomas ? window.Idiomas.t(chave) : '';
};

/**
 * O percurso de uma visita: por onde se entrou, para que lado se foi, e
 * a quantos passos se está.
 *
 * A lista das paragens (ou dos testemunhos) dá a volta, mas quem a
 * percorre não anda em círculo: entra num ponto e escolhe um lado com o
 * primeiro passo. Dali em diante o percurso é uma linha — para a frente
 * até à última que falta, para trás até ao ponto por onde se entrou —, e
 * nas duas pontas a seta dá lugar à cruz de saída. Andar para trás refaz
 * o caminho pela mesma ordem, e acaba no primeiro que se viu.
 *
 * @param {number} inicio - Onde se entrou, na lista.
 * @returns {{inicio: number, sentido: number, passo: number}} O percurso.
 */
AnnotationController.prototype.comecarPercurso = function(inicio) {
    return { inicio: Math.max(0, inicio), sentido: 0, passo: 0 };
};

/**
 * Dá um passo no percurso para um dos lados.
 *
 * O primeiro passo decide o lado do percurso. Para a frente anda-se até
 * ao fim da lista; para trás, até ao ponto de entrada. Fora disso não
 * há passo a dar: é onde está a cruz.
 *
 * @param {object} percurso - O percurso da visita.
 * @param {number} total - Quantas paragens tem a lista.
 * @param {number} sentido - -1 para a esquerda, 1 para a direita.
 * @returns {number|null} Onde se fica, na lista; ou nada, se não há passo.
 */
AnnotationController.prototype.andarNoPercurso = function(percurso, total, sentido) {
    if (!percurso || total < 2 || !sentido) {
        return null;
    }
    if (percurso.sentido === 0) {
        percurso.sentido = sentido;
        percurso.passo = 1;
    } else if (sentido === percurso.sentido) {
        if (percurso.passo >= total - 1) return null;
        percurso.passo++;
    } else {
        if (percurso.passo <= 0) return null;
        percurso.passo--;
    }
    return this.lugarNoPercurso(percurso, total, percurso.passo);
};

/**
 * Onde cai, na lista, um passo do percurso.
 *
 * @param {object} percurso - O percurso da visita.
 * @param {number} total - Quantas paragens tem a lista.
 * @param {number} passo - O passo, a contar do ponto de entrada.
 * @returns {number} O lugar na lista.
 */
AnnotationController.prototype.lugarNoPercurso = function(percurso, total, passo) {
    const sentido = percurso.sentido || 1;
    return ((percurso.inicio + sentido * passo) % total + total) % total;
};

/**
 * O que está de cada lado no percurso: a paragem que vem, ou a cruz.
 *
 * Antes do primeiro passo há uma paragem de cada lado. Depois, para a
 * frente vem a seguinte — ou a cruz, na última — e para trás vem a
 * anterior — ou a cruz, no ponto por onde se entrou.
 *
 * @param {object} percurso - O percurso da visita.
 * @param {object[]} lista - As paragens, pela ordem delas.
 * @returns {{esquerda: {cruz: boolean, ann: object|null}, direita: {cruz: boolean, ann: object|null}}}
 */
AnnotationController.prototype.ladosDoPercurso = function(percurso, lista) {
    const total = lista.length;
    const lado = (sentido) => {
        if (total < 2) return { cruz: true, ann: null };
        if (percurso.sentido === 0) {
            return { cruz: false, ann: lista[((percurso.inicio + sentido) % total + total) % total] };
        }
        if (sentido === percurso.sentido) {
            const cruz = percurso.passo >= total - 1;
            return { cruz, ann: cruz ? null : lista[this.lugarNoPercurso(percurso, total, percurso.passo + 1)] };
        }
        const cruz = percurso.passo <= 0;
        return { cruz, ann: cruz ? null : lista[this.lugarNoPercurso(percurso, total, percurso.passo - 1)] };
    };
    return { esquerda: lado(-1), direita: lado(1) };
};

/**
 * Abre um testemunho na janela grande.
 *
 * Com a janela já aberta e um sentido dado, o leitor fica onde está e é
 * só o vídeo lá dentro que troca (ver {@link trocarNoLeitor}).
 *
 * @param {string} nome - O vídeo a abrir.
 * @param {string} title - O nome a mostrar na barra de cima.
 * @param {number} [sentido] - -1 para o anterior, 1 para o seguinte.
 */
AnnotationController.prototype.openVideoModal = function(nome, title, sentido) {
    const jaAberta = this.modal.style.display !== 'none';
    if (jaAberta && sentido) {
        this.trocarNoLeitor(nome, title, sentido);
        return;
    }
    this.abrirTestemunho(nome, title);
};

/**
 * Troca o testemunho dentro do leitor que já está aberto.
 *
 * O leitor não se mexe: é a imagem lá dentro que desliza, como num
 * carrossel de diapositivos. A última imagem do vídeo que se deixa sai por
 * um lado e o novo entra pelo outro, e as imagens dos lados deslizam no
 * mesmo sentido e voltam já com os vizinhos novos.
 *
 * @param {string} nome - O vídeo a abrir.
 * @param {string} title - O nome a mostrar na barra de cima.
 * @param {number} sentido - -1 para o anterior, 1 para o seguinte.
 */
AnnotationController.prototype.trocarNoLeitor = function(nome, title, sentido) {
    this.arrumarImagemDeAntes();
    this.aTrocarDeTestemunho = true;
    this.modal.style.setProperty('--sentido-da-troca', sentido);

    // A última imagem do vídeo que se deixa, a encher o leitor; e uma cópia
    // mais pequena para a imagem do lado de onde se veio, que é leve de
    // fazer e não atrasa o deslize.
    const antes = this.imagemDeAntes;
    const filme = this.videoPlayer;
    let imagemDeOndeSeVinha = null;
    if (filme.readyState >= 2 && filme.videoWidth) {
        const largura = Math.min(1280, filme.videoWidth);
        antes.width = largura;
        antes.height = Math.round(largura * filme.videoHeight / filme.videoWidth);
        antes.getContext('2d').drawImage(filme, 0, 0, antes.width, antes.height);
        antes.classList.add('a-ver');
        try {
            const pequena = document.createElement('canvas');
            pequena.width = Math.min(640, antes.width);
            pequena.height = Math.round(pequena.width * antes.height / antes.width);
            pequena.getContext('2d').drawImage(antes, 0, 0, pequena.width, pequena.height);
            imagemDeOndeSeVinha = pequena.toDataURL('image/jpeg', 0.85);
        } catch (e) { /* vídeo de outra casa: fica sem imagem do lado */ }
    }

    // O vídeo novo fica à espera do lado de onde vem, fora da vista.
    const moldura = this.videoWrapper;
    moldura.classList.add('pronto-a-deslizar');

    this.abrirTestemunho(nome, title, sentido, imagemDeOndeSeVinha);

    // E desliza: o de antes sai, o novo entra. Acaba quando o deslize
    // acaba de facto — o arranque do vídeo novo pode atrasar-lhe o começo.
    void moldura.offsetWidth;
    moldura.classList.remove('pronto-a-deslizar');
    moldura.classList.add('a-deslizar');
    this.aoAcabarDeDeslizar = (e) => {
        if (e && (e.target !== filme || e.propertyName !== 'transform')) return;
        this.arrumarImagemDeAntes();
    };
    filme.addEventListener('transitionend', this.aoAcabarDeDeslizar);
    this.esperaDoDeslize = setTimeout(this.aoAcabarDeDeslizar, 1500);
};

/**
 * Acaba o deslize dentro do leitor e tira de lá a imagem do testemunho
 * de antes.
 */
AnnotationController.prototype.arrumarImagemDeAntes = function() {
    clearTimeout(this.esperaDoDeslize);
    if (this.aoAcabarDeDeslizar) {
        this.videoPlayer.removeEventListener('transitionend', this.aoAcabarDeDeslizar);
        this.aoAcabarDeDeslizar = null;
    }
    this.aTrocarDeTestemunho = false;
    if (this.videoWrapper) {
        this.videoWrapper.classList.remove('pronto-a-deslizar', 'a-deslizar');
    }
    if (this.imagemDeAntes) {
        this.imagemDeAntes.classList.remove('a-ver');
    }
};

AnnotationController.prototype.abrirTestemunho = function(nome, title, sentido, oldCenterFrame) {
    this.marcarComoVisto('video-' + nome);
    this.modalTitle.textContent = title;
    this.videoNome = nome;

    if (this.progressFilled) this.progressFilled.style.width = '0%';
    if (this.timeDisplay) this.timeDisplay.innerText = '0:00 / 0:00';

    const fontes = fontesDeVideo(nome);
    this.videoSources = fontes;

    // Evita a piscada em preto antes do vídeo começar, copiando a imagem da pré-visualização.
    this.videoPlayer.removeAttribute('poster');
    const previas = [this.previaEsquerda, this.previaDireita];
    for (const previa of previas) {
        if (previa && previa.dataset.video === nome) {
            const filme = previa.querySelector('video');
            if (filme && filme.readyState >= 2 && filme.videoWidth) {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = filme.videoWidth;
                    canvas.height = filme.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(filme, 0, 0, canvas.width, canvas.height);
                    this.videoPlayer.poster = canvas.toDataURL();
                } catch (e) {
                    console.log('Poster falhou:', e);
                }
            }
            break;
        }
    }

    if (this.gestorDeQualidade) this.gestorDeQualidade.parar();

    // Quem decide a qualidade é o gestor: começa pelo que a ligação
    // aguenta e vai corrigindo enquanto o vídeo corre.
    this.gestorDeQualidade = criarGestorDeQualidade({
        video: this.videoPlayer,
        fontes,
        nome,
        moldura: this.videoWrapper,
        aoMudar: (resolucao, modo) => this.marcarQualidadeEscolhida(resolucao, modo)
    });

    this.desenharMenuDeQualidade(fontes);

    // As setas e as imagens escondidas dos vizinhos novos. A imagem do
    // leitor já foi copiada do vizinho antes de ele mudar (mais acima).
    if (!sentido) this.arrumarImagemDeAntes();
    this.atualizarPalco(nome, sentido, oldCenterFrame);

    abrirDeRepente(this.modal);
    // As peças vêm à vista ao abrir e a cada troca de testemunho — mesmo
    // quando a troca é feita de tecla ou sozinha, no fim de um —, para se
    // ver quem está a falar e quem vem a seguir.
    this.pecasDoTestemunho.mostrar();

    // Só com o player já visível é que se sabe o tamanho que vai ter, e a
    // escolha da versão depende disso. Ler a altura obriga o navegador a
    // fazer as contas do tamanho já a seguir, sem esperar pela animação.
    void this.videoWrapper.clientHeight;
    this.gestorDeQualidade.arrancar();
    this.videoPlayer.play().catch(e => console.log('Autoplay prevented:', e));

    // Obrigar o navegador a refazer as contas antes de mandar assentar,
    // senão ele não dá pela mudança e a janela nasce já no sítio, sem
    // entrada nenhuma. À força, e não à espera da imagem seguinte: numa
    // janela em segundo plano essa imagem pode nunca chegar.
    void this.modal.offsetWidth;
    this.modalContent.classList.add('aberta');
    // O que está nas duas barras surge a esbater: ao abrir, depois de a
    // janela assentar; ao trocar de testemunho no leitor, logo — o nome
    // também, que é o mesmo sítio com outra pessoa.
    fazerSurgir({ demora: sentido ? '0s' : '0.45s' }, this.barraDoNome, this.barraDosComandos);

    apagarOBairroPorTras(this.app);
};

/**
 * Troca o vídeo por uma sala de cinema virtual, onde ele se vê num ecrã
 * grande com os óculos postos.
 *
 * A sala é a mesma página que mostra as rotas 360º, aqui posta em modo de
 * ecrã plano. Fica dentro da mesma janela, e o botão de fechar de sempre
 * devolve tudo ao sítio.
 *
 * @param {HTMLElement} moldura - A caixa onde o vídeo estava.
 * @param {string} nome - Nome do vídeo.
 * @param {number} momento - Segundo em que o vídeo ia.
 */
AnnotationController.prototype.abrirCinemaVR = function(moldura, nome, momento) {
    if (this.cinemaVR) return;

    const endereco = '/video360.html?nome=' + encodeURIComponent(nome) +
        '&plano=1&vr=1&t=' + momento;

    const janela = document.createElement('iframe');
    janela.src = endereco;
    janela.setAttribute('allow', 'xr-spatial-tracking; fullscreen; autoplay');
    janela.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;background:#000;z-index:5;';

    moldura.appendChild(janela);
    this.cinemaVR = janela;
};

/**
 * Fecha a sala de cinema virtual, se estiver aberta.
 */
AnnotationController.prototype.fecharCinemaVR = function() {
    if (!this.cinemaVR) return;
    this.cinemaVR.remove();
    this.cinemaVR = null;
};

/**
 * Constrói o menu de qualidade: primeiro o automático, depois cada versão
 * para quem quiser mandar à mão.
 *
 * @param {Object<string, string>} fontes - Resolução → endereço.
 */
AnnotationController.prototype.desenharMenuDeQualidade = function(fontes) {
    this.qualityMenu.innerHTML = `
        <div class="settings-title" data-i18n="video.qualidade">Qualidade</div>
        <div class="settings-options"></div>
    `;
    const optionsContainer = this.qualityMenu.querySelector('.settings-options');

    const criarOpcao = (texto, aoClicar) => {
        const label = document.createElement('label');
        label.className = 'settings-radio';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'video-quality';

        const span = document.createElement('span');
        span.innerText = texto;

        label.appendChild(input);
        label.appendChild(span);

        input.addEventListener('change', () => {
            if (input.checked) {
                aoClicar();
                setTimeout(() => this.qualityMenu.classList.remove('show'), 150);
            }
        });

        optionsContainer.appendChild(label);
        return input;
    };

    this.botaoAutomatico = criarOpcao('Automático', () => this.gestorDeQualidade.automatico());
    this.botaoAutomatico.dataset.modo = 'auto';
    this.botoesResolucao = [];

    Object.keys(fontes).forEach((resolucao) => {
        const btn = criarOpcao(resolucao, () => this.gestorDeQualidade.fixar(resolucao));
        btn.dataset.resolucao = resolucao;
        this.botoesResolucao.push(btn);
    });
};

/**
 * Actualiza o menu para mostrar o que está a tocar. No automático, a
 * primeira linha diz também que versão está a ser usada neste momento.
 *
 * @param {string} resolucao - A versão em uso.
 * @param {string} modo - 'auto' ou 'manual'.
 */
AnnotationController.prototype.marcarQualidadeEscolhida = function(resolucao, modo) {
    if (!this.qualityMenu) return;

    if (this.botaoAutomatico) {
        this.botaoAutomatico.nextSibling.innerText = modo === 'auto' ?
            `Automático · ${resolucao}` : 'Automático';
        if (modo === 'auto') this.botaoAutomatico.checked = true;
    }

    if (this.botoesResolucao) {
        this.botoesResolucao.forEach((btn) => {
            if (modo !== 'auto' && btn.dataset.resolucao === resolucao) {
                btn.checked = true;
            }
        });
    }
};

// Markers shrink with distance so a far one never reads as bigger than a near
// one. The curve is a smooth falloff between MARKER_SCALE_MIN and _MAX with no
// clamping anywhere, so the size never jumps as the camera moves.
const MARKER_SCALE_MIN = 0.34;
const MARKER_SCALE_MAX = 2.3;
const MARKER_SCALE_FALLOFF = 75;

// Metade da altura do ícone (.marker-dot tem 32px): é por aqui que o marcador
// se agarra ao ponto do mapa.
const MARKER_DOT_HALF = 16;

AnnotationController.prototype.update = function(dt) {
    const camera = this.entity.camera;
    if (!camera) return;

    // Reuse pre-allocated vectors (avoid GC pressure)
    if (!this._screenPos) {
        this._screenPos = new pc.Vec3();
        this._dir = new pc.Vec3();
        // Enable GPU-accelerated compositing on all markers
        this.annotations.forEach(ann => {
            if (ann.element) {
                ann.element.style.willChange = 'transform, opacity';
                ann.element.style.left = '0';
                ann.element.style.top = '0';
                ann._visible = false;
            }
        });
    }

    const screenPos = this._screenPos;
    const dir = this._dir;
    const cameraPos = this.entity.getPosition();
    const cameraForward = this.entity.forward;

    for (let i = 0; i < this.annotations.length; i++) {
        const ann = this.annotations[i];
        const el = ann.element;
        if (!el) continue;

        camera.worldToScreen(ann.position, screenPos);

        // Check if behind camera
        dir.sub2(ann.position, cameraPos);
        const dot = cameraForward.dot(dir);

        if (dot < 0 || screenPos.z < 0) {
            if (ann._visible !== false) {
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
                // Um marcador que ficou para trás da câmara não está no mapa,
                // e por isso também não pode estar na fila do Tab: quem anda
                // de tecla acabava a carregar em coisas que não vê.
                el.setAttribute('aria-hidden', 'true');
                el.setAttribute('tabindex', '-1');
                if (el === document.activeElement) el.blur();
                ann._visible = false;
            }
        } else {
            if (ann._visible !== true) {
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
                el.removeAttribute('aria-hidden');
                el.setAttribute('tabindex', '0');
                ann._visible = true;
            }
            // O marcador é ancorado pelo centro do ícone, e não pelo centro do
            // conjunto ícone + etiqueta. Assim o ponto no mapa não se desloca
            // quando o marcador muda de tamanho com a distância.
            const distance = dir.length();
            const scale = MARKER_SCALE_MIN + (MARKER_SCALE_MAX - MARKER_SCALE_MIN) *
                (MARKER_SCALE_FALLOFF / (MARKER_SCALE_FALLOFF + distance));

            // Use translate3d to stay on the GPU compositor layer (no layout/reflow)
            el.style.transform = `translate3d(${screenPos.x}px, ${screenPos.y}px, 0) scale(${scale.toFixed(3)}) translate(-50%, ${-MARKER_DOT_HALF}px)`;

            // Set z-index based on distance so closer annotations appear on top
            el.style.zIndex = Math.max(1, Math.round(10000 - distance * 10));
        }
    }
};
