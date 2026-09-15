import * as pc from 'playcanvas';
import { fontesDeVideo } from './videos.mjs?v=5';
import { criarGestorDeQualidade } from './qualidade-video.mjs?v=8';

export const AnnotationController = pc.createScript('annotationController');

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
        .marker-dot.last-viewed {
            box-shadow: 0 0 0 4px #ffffff;
            z-index: 10;
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
        .custom-video-container.hide-cursor {
            cursor: none;
        }
        .custom-video-container.hide-cursor * {
            cursor: none !important;
        }
        .fechar-fullscreen-btn {
            position: absolute;
            top: 24px;
            right: 24px;
            z-index: 2500;
            opacity: 0;
            pointer-events: none;
            width: 40px;
            height: 40px;
            border-radius: 0;
            border: 1px solid rgba(255, 255, 255, 0.15);
            background: #05050a;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            cursor: pointer;
            transition: opacity 0.3s ease, background 0.15s ease, transform 0.2s ease;
        }
        .fechar-fullscreen-btn:hover {
            background: rgba(255, 255, 255, 0.05);
            transform: scale(1.05);
        }
        .moldura-do-player:fullscreen .fechar-fullscreen-btn {
            opacity: 1;
            pointer-events: auto;
        }
        .moldura-do-player:fullscreen .custom-video-container.hide-cursor .fechar-fullscreen-btn {
            opacity: 0;
            pointer-events: none;
        }
        .custom-video-container video {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
        }
        /* ---- A barra dos comandos ----

           Vive por baixo da imagem, e não por cima dela: nada do que se
           carrega tapa o que se está a ver, e deixa de ser preciso esperar
           que a barra se esconda sozinha para o vídeo ficar limpo.

           Traz o mesmo véu de luz da barra do nome, virado ao contrário —
           as duas fecham a janela, uma em cima e outra em baixo. */
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

        /* A imagem e a barra são uma peça só, e é essa peça que vai a ecrã
           inteiro: assim os comandos vão juntos em vez de ficarem para
           trás na janela. */
        .moldura-do-player {
            display: flex;
            flex-direction: column;
            background: #05050a;
            overflow: hidden;
        }
        .moldura-do-player:fullscreen {
            width: 100vw;
            height: 100vh;
        }
        .moldura-do-player:fullscreen .custom-video-container {
            flex: 1 1 auto;
            aspect-ratio: auto;
            min-height: 0;
        }
        .moldura-do-player:fullscreen .video-controls {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(to top, rgba(255,255,255,0.05), transparent), #05050a;
            transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 100;
        }
        .moldura-do-player:fullscreen .custom-video-container.hide-cursor + .video-controls {
            transform: translateY(100%);
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
            border: 1px solid rgba(255, 255, 255, 0.15);
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

           Três janelas iguais, lado a lado numa tira: o testemunho a dar ao
           meio e o anterior e o seguinte de cada lado. A tira é mais larga
           do que o ecrã, por isso as dos lados ficam cortadas pela borda —
           espreitam, como nos carrosséis de há uns anos. São janelas do
           mesmo feitio da do meio (barra do nome em cima, imagem, barra dos
           controlos em baixo), só que mais pequenas e apagadas.

           Todas as medidas saem daqui, e não de números espalhados pelo
           meio: mudar uma destas linhas muda o palco todo. ---- */
        #video-modal,
        #modal-360 {
            --janela-largura: min(62vw, 1000px);
            /* O intervalo entre janelas tem de dar para a seta caber lá
               dentro com folga. */
            --janela-espaco: 110px;
            --previa-escala: 0.88;
            --previa-opacidade: 0.5;
            --passagem: 0.45s cubic-bezier(0.25, 0.9, 0.3, 1);
            overflow: hidden;
        }

        .carrossel {
            display: flex;
            align-items: center;
            gap: var(--janela-espaco);
            transition: transform var(--passagem);
            will-change: transform;
        }

        /* A cruz, na ponta do ecrã. */
        .fechar-do-palco {
            position: absolute;
            top: 18px;
            right: 18px;
            z-index: 2200;
        }

        /* As setas, só o bico e sem cabo, pousadas no intervalo entre a
           janela do meio e a de cada lado. O sítio sai da conta das mesmas
           medidas do palco, e não de números à parte. */
        .seta-do-palco {
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 2150;
            width: 100px;
            height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: none;
            background: transparent;
            color: rgba(255, 255, 255, 0.55);
            cursor: pointer;
            transition: color var(--passagem), transform var(--passagem);
        }
        .seta-do-palco:hover {
            color: #ffffff;
            transform: translate(-50%, -50%) scale(1.18);
        }
        /* Já não há nada de novo para o lado de lá: a seta dá lugar a uma
           cruz, e quem carregar nela sai para o mapa.

           O apagado é dado à cruz inteira, e não à cor de cada traço: com
           a cor meio transparente, o sítio onde os dois se cruzam ficava
           mais claro do que o resto e a cruz parecia dois riscos pousados
           um por cima do outro. */
        .seta-do-palco.a-sair {
            color: #ffffff;
            opacity: 0.55;
            transition: opacity var(--passagem), transform var(--passagem);
        }
        .seta-do-palco.a-sair:hover {
            opacity: 1;
        }

        /* Com a colecção toda vista não há nada de novo à espera do lado
           direito, e a janela que espreitava de lá sai da frente. Fica a
           ocupar o lugar dela, para a janela do meio não escorregar do
           centro do ecrã. */
        .previa.sem-seguinte {
            visibility: hidden;
        }
        .seta-do-palco.esquerda {
            left: calc(50% - var(--janela-largura) / 2 - var(--janela-espaco) / 2);
        }
        .seta-do-palco.direita {
            left: calc(50% + var(--janela-largura) / 2 + var(--janela-espaco) / 2);
        }

        .janela-do-palco {
            flex: 0 0 auto;
            width: var(--janela-largura);
            background: #05050a;
            border: 1px solid rgba(255, 255, 255, 0.1);
            overflow: hidden;
        }

        .previa {
            padding: 0;
            font-family: inherit;
            cursor: pointer;
            /* A altura é a mesma da janela do meio, medida nela: senão a
               janela que desliza para o centro assentava um pouco acima ou
               abaixo do sítio onde a do meio começa. */
            height: var(--altura-janela, auto);
            display: flex;
            flex-direction: column;
            text-align: left;
            transform: scale(var(--previa-escala));
            opacity: var(--previa-opacidade);
            transition: transform var(--passagem), opacity var(--passagem);
        }

        /* A barra de cima, igual à da janela grande, para onde o nome se
           mudou. Com o rato em cima sobe os últimos passos e acende. */
        .previa-barra {
            padding: 16px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            background: linear-gradient(to bottom, rgba(255,255,255,0.05), transparent);
            min-height: 56px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
        }
        .previa-nome {
            display: block;
            font-size: 1.1rem;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.7);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            opacity: 0.8;
        }

        .previa-janela {
            position: relative;
            flex: 1 1 auto;
            min-height: 0;
            background: #000;
            overflow: hidden;
        }
        .previa-janela video,
        .previa-janela img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            pointer-events: none;
        }

        /* A janela para a página da paragem 360º. A imagem lá dentro é
           16:9 como a dos testemunhos, e a barra dos comandos vem a
           seguir — daí a altura ser a conta dos dois. A altura da barra é
           medida na própria página, porque muda com o tamanho do ecrã e
           não é a mesma na fotografia e nas rotas. */
        .moldura-360 {
            position: relative;
            width: 100%;
            height: 0;
            padding-bottom: calc(56.25% + var(--altura-controlos, 0px));
            background: #000;
        }
        .moldura-360 iframe {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            border: none;
            background: #000;
            display: block;
        }

        /* O rodapé, vazio: é o lugar que a barra dos comandos ocupa na
           janela do meio. Sem ele, a janela que desliza para o centro
           assentava mais alta do que a que estava lá. A altura vem medida
           da barra verdadeira, e não escrita à mão. */
        .previa-rodape {
            flex: 0 0 auto;
            height: var(--altura-controlos, 0px);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            background: linear-gradient(to top, rgba(255,255,255,0.05), transparent);
        }


        /* ---- A passagem de uma janela para a outra: a tira desliza um
           lugar, a que vinha de lado cresce e acende, a do meio encolhe e
           apaga-se. ---- */
        .carrossel.sem-passagem,
        .carrossel.sem-passagem .previa,
        .carrossel.sem-passagem .janela-do-player {
            transition: none;
        }
        .carrossel.a-deslizar .previa.entra {
            transform: scale(1);
            opacity: 1;
        }
        .carrossel.a-deslizar .janela-do-player {
            transform: scale(var(--previa-escala));
            opacity: var(--previa-opacidade);
        }
        /* A janela do meio nasce um pouco encolhida e assenta ao abrir. */
        .janela-do-player {
            transform: scale(0.95);
            transition: transform var(--passagem), opacity var(--passagem);
        }
        .janela-do-player.aberta {
            transform: scale(1);
        }

        /* A fotografia do alto do bairro abre de lado a lado: a janela do
           meio toma o ecrã todo, com a barra do nome em cima e a imagem a
           encher o resto. Não há janelas dos lados nem setas — é uma
           paragem avulsa — e o contorno de luz também não faz falta. */
        #modal-360.inteira {
            --janela-largura: 100vw;
            --janela-espaco: 0px;
        }
        #modal-360.inteira .janela-do-palco.janela-do-player {
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            border: none;
        }
        #modal-360.inteira .janela-do-palco.janela-do-player::after {
            display: none;
        }
        #modal-360.inteira .moldura-360 {
            flex: 1 1 auto;
            height: auto;
            padding-bottom: 0;
        }
        /* Sem barras: a barra do nome deixa de ocupar lugar e fica a
           pairar sobre a fotografia, transparente, só com a cruz; os
           comandos, dentro da página da fotografia, fazem o mesmo em
           baixo (ver image360.html). A fotografia vai de alto a baixo. */
        #modal-360.inteira .barra-do-nome-360 {
            position: absolute !important;
            top: 0;
            left: 0;
            right: 0;
            z-index: 5;
            background: transparent !important;
            border-bottom: none !important;
            pointer-events: none;
        }
        #modal-360.inteira .barra-do-nome-360 button {
            pointer-events: auto;
        }

        /* Num ecrã estreito não sobra nada para espreitar: as janelas dos
           lados encolhem para uma seta pousada na borda da imagem. */
        @media (max-width: 900px) {
            #video-modal,
            #modal-360 {
                --janela-largura: 100vw;
                --janela-espaco: 0px;
            }
            .janela-do-palco {
                border-radius: 0;
                border-left: none;
                border-right: none;
            }
            /* O meio da imagem não é o meio da janela: há uma barra com o
               nome em cima e outra com os comandos em baixo, e não têm a
               mesma altura. Esta conta desce as setas e as janelas dos
               lados até ao meio da imagem, seja qual for a altura das
               barras. */
            .previa,
            .seta-do-palco {
                margin-top: calc((var(--altura-barra-nome, 0px) - var(--altura-controlos, 0px)) / 2);
            }
            .previa {
                position: absolute;
                top: 50%;
                width: 50px;
                height: 70px;
                transform: translateY(-50%);
                opacity: 1;
                border: none;
                background: transparent;
                z-index: 2100;
            }
            .previa.esquerda { left: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; }
            .previa.direita { right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0; }
            .previa-barra,
            .previa-rodape,
            .previa-janela { display: none; }
            .carrossel.a-deslizar .previa.entra,
            .carrossel.a-deslizar .janela-do-player {
                transform: none;
                opacity: 1;
            }
            
            .seta-do-palco {
                width: 50px;
                height: 70px;
                transform: translateY(-50%);
            }
            .seta-do-palco:hover {
                transform: translateY(-50%) scale(1.18);
            }
            .seta-do-palco.esquerda { left: 0; right: auto; }
            .seta-do-palco.direita { right: 0; left: auto; }

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
            border: 1px solid rgba(255, 255, 255, 0.15);
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
            border: 1px solid rgba(255,255,255,0.15);
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
           Um fio de um ponto a toda a volta, de um só tom — o mais escuro do
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
            padding: 1px;
            background: linear-gradient(rgba(255,255,255,0.3), rgba(255,255,255,0.3)), #05050a;
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
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
            // As rotas mostram quatro setas, uma para cada lado, postas em
            // cruz grega: é o antigo ícone dos controlos, para mostrar que ali
            // se pode olhar e andar à volta. O nome vai por baixo. A
            // fotografia do alto do bairro dispensa as duas coisas: fica só
            // um olho, pousado no céu, sem legenda a tapar a paisagem.
            const simbolo = ann.isImage
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                   </svg>`
                : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
                        <polyline points="8.5 5.5 12 2 15.5 5.5"></polyline>
                        <polyline points="8.5 18.5 12 22 15.5 18.5"></polyline>
                        <polyline points="5.5 8.5 2 12 5.5 15.5"></polyline>
                        <polyline points="18.5 8.5 22 12 18.5 15.5"></polyline>
                        <line x1="12" y1="3" x2="12" y2="21"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
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
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
                        <line x1="6" y1="6" x2="6" y2="18"></line>
                        <line x1="10" y1="9" x2="10" y2="15"></line>
                        <line x1="14" y1="3" x2="14" y2="21"></line>
                        <line x1="18" y1="5" x2="18" y2="19"></line>
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
    return '/video360.html?nome=' + encodeURIComponent(this.videoDaRota360(ann));
};

/**
 * Cria o grupo de botões do cabeçalho: o interruptor da reprodução
 * automática e o botão de fechar.
 *
 * @param {Function} fecharCallback - O que fazer ao carregar na cruz.
 * @param {boolean} [comAutomatico] - Se o interruptor "Auto" faz falta.
 *   No palco das paragens 360º não faz: as rotas arrancam sempre
 *   sozinhas e a fotografia do alto do bairro não anda, por isso o
 *   interruptor não mandava em nada.
 */
AnnotationController.prototype.criarBotoesDeTopo = function(fecharCallback, comAutomatico = true) {
    const rightGroup = document.createElement('div');
    rightGroup.style.display = 'flex';
    rightGroup.style.alignItems = 'center';
    rightGroup.style.gap = '16px';

    if (!comAutomatico) {
        const soFechar = document.createElement('button');
        soFechar.className = 'fechar-palco-btn';
        soFechar.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        soFechar.setAttribute('aria-label', 'Fechar');
        soFechar.title = 'Fechar';
        soFechar.addEventListener('click', fecharCallback);
        rightGroup.appendChild(soFechar);
        return rightGroup;
    }

    const autoPlayContainer = document.createElement('label');
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
    let isAutoPlay = localStorage.getItem('autoplay-videos') === 'true';
    
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
        localStorage.setItem('autoplay-videos', isAutoPlay ? 'true' : 'false');
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
 * Monta o palco das paragens 360º: a tira das três janelas, as setas nos
 * intervalos e a cruz ao canto do ecrã.
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
    content.style.position = 'relative';
    content.style.backgroundColor = '#05050a';
    content.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';

    const header = document.createElement('div');
    header.className = 'barra-do-nome-360';
    header.style.padding = '16px 24px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    header.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)';
    header.style.minHeight = '56px';
    header.style.boxSizing = 'border-box';

    const titulo = document.createElement('div');
    titulo.style.color = '#fff';
    titulo.style.fontWeight = '600';
    titulo.style.fontSize = '1.1rem';
    header.appendChild(titulo);
    header.appendChild(this.criarBotoesDeTopo(() => this.fecharPalco360(), false));

    const moldura = document.createElement('div');
    moldura.className = 'moldura-360';

    content.appendChild(header);
    content.appendChild(moldura);

    // As janelas dos lados. Numa paragem há duas coisas possíveis a
    // espreitar: a fotografia do alto, que é um ficheiro de imagem, ou o
    // primeiro instante de uma rota, que é um vídeo. Cabem as duas na
    // janela, e mostra-se a que for da vez.
    const criarPrevia = (lado, sentido) => {
        const previa = document.createElement('button');
        previa.type = 'button';
        previa.className = 'janela-do-palco previa ' + lado;

        const barra = document.createElement('div');
        barra.className = 'previa-barra';
        const nome = document.createElement('span');
        nome.className = 'previa-nome';
        barra.appendChild(nome);
        previa.appendChild(barra);

        const janela = document.createElement('div');
        janela.className = 'previa-janela';
        const filme = document.createElement('video');
        filme.muted = true;
        filme.playsInline = true;
        filme.preload = 'metadata';
        filme.crossOrigin = 'anonymous';
        const foto = document.createElement('img');
        foto.alt = '';
        janela.appendChild(filme);
        janela.appendChild(foto);
        previa.appendChild(janela);

        const rodape = document.createElement('div');
        rodape.className = 'previa-rodape';
        previa.appendChild(rodape);

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

    const carrossel = document.createElement('div');
    carrossel.className = 'carrossel';
    carrossel.appendChild(esquerda);
    carrossel.appendChild(content);
    carrossel.appendChild(direita);
    
    modal.appendChild(carrossel);
    modal.appendChild(setaEsquerda);
    modal.appendChild(setaDireita);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) this.fecharPalco360();
    });
    document.body.appendChild(modal);

    this.palco360 = {
        modal,
        tira: carrossel,
        meio: content,
        esquerda,
        direita,
        setaEsquerda,
        setaDireita,
        barraDoNome: header,
        titulo,
        moldura
    };

    // Com o ecrã a mudar de tamanho, as três janelas voltam a ficar do
    // mesmo feitio.
    window.addEventListener('resize', () => {
        if (modal.style.display !== 'none') this.medirComandos360();
    });
};

/**
 * Abre uma paragem 360º no palco.
 *
 * Com o palco já aberto e um sentido dado, a troca faz-se com a tira a
 * deslizar um lugar, como nos testemunhos.
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
    if (jaAberto && sentido && !palco.aDeslizar) {
        this.deslizarPalco(palco, sentido, () => this.mostrarParagem360(ann));
        return;
    }
    this.mostrarParagem360(ann);
};

/**
 * Passa à paragem do lado.
 *
 * A lista dá a volta: depois da última vem a primeira, para nunca ficar
 * um lado vazio.
 *
 * @param {number} sentido - -1 para a anterior, 1 para a seguinte.
 */
AnnotationController.prototype.saltarParagem360 = function(sentido) {
    const lista = this.paragens360();
    const onde = lista.indexOf(this.paragem360);
    if (onde < 0 || lista.length < 2) {
        return;
    }
    this.abrirParagem360(lista[(onde + sentido + lista.length) % lista.length], sentido);
};

/**
 * Põe uma paragem na janela do meio e as vizinhas nas dos lados.
 *
 * @param {object} ann - A paragem a mostrar.
 */
AnnotationController.prototype.mostrarParagem360 = function(ann) {
    const palco = this.palco360;
    this.paragem360 = ann;
    // Se esta paragem ainda faltava, é preciso sabê-lo antes de a marcar:
    // é o que diz se é ela que fecha a colecção.
    const annId = this.idDaAnotacao(ann);
    const faltava = !this.viewedAnnotations.includes(annId);
    this.marcarComoVisto(annId);

    palco.titulo.textContent = this.nomeDaParagem360(ann);
    palco.moldura.innerHTML = '<iframe src="' + this.enderecoDaParagem360(ann) +
        '" allow="xr-spatial-tracking; fullscreen; autoplay" allowfullscreen></iframe>';
    const janela = palco.moldura.querySelector('iframe');
    janela.addEventListener('load', () => {
        this.medirComandos360();
        // O foco entra na janela mal ela nasce: é lá dentro que as teclas
        // do filme moram — o espaço, o W, A, S, D, os números — e as que
        // são do mapa, o Escape e as setas dos lados, sabem voltar cá fora.
        // Sem isto o foco ficava no marcador, atrás da janela, e o espaço
        // voltava a abrir a paragem que já estava aberta. Sem deslocar
        // nada: a dar o foco, o navegador puxa a janela para a vista, e
        // com a tira a meio de um deslize arrastava o palco todo para o
        // lado — e deixava-o lá.
        janela.focus({ preventScroll: true });
    });

    const lista = this.paragens360();
    const onde = lista.indexOf(ann);
    const avulso = onde < 0;
    
    palco.esquerda.style.visibility = avulso ? 'hidden' : '';
    palco.direita.style.visibility = avulso ? 'hidden' : '';
    palco.setaEsquerda.style.visibility = avulso ? 'hidden' : '';
    palco.setaDireita.style.visibility = avulso ? 'hidden' : '';
    // A fotografia do alto do bairro enche o ecrã todo.
    palco.modal.classList.toggle('inteira', !!ann.isImage);

    if (!avulso) {
        this.registarFechoDaColeccao(annId, lista, faltava);
    }
    const noFim = avulso ? true : this.noFimDaFila(lista, onde);
    this.arrumarLadoDireito(palco.setaDireita, palco.direita, noFim);

    if (!avulso && lista.length > 1) {
        this.encherPrevia360(palco.esquerda, lista[(onde - 1 + lista.length) % lista.length]);
        if (!noFim) {
            this.encherPrevia360(palco.direita, lista[(onde + 1) % lista.length]);
        }
    }

    abrirDeRepente(palco.modal);
    this.medirPalco(palco);

    // Obrigar o navegador a refazer as contas antes de mandar assentar,
    // senão a janela nasce já no sítio e não se vê entrada nenhuma.
    void palco.modal.offsetWidth;
    palco.meio.classList.add('aberta');

    apagarOBairroPorTras(this.app);
};

/**
 * Enche uma das janelas dos lados com uma paragem.
 *
 * Da fotografia mostra-se a própria imagem; de uma rota, o primeiro
 * instante da versão mais leve que exista — não é para ser vista, é para
 * se saber o que vem a seguir.
 *
 * @param {HTMLElement} previa - A janela do lado.
 * @param {object} ann - A paragem a mostrar.
 */
AnnotationController.prototype.encherPrevia360 = function(previa, ann) {
    if (!previa || !ann) {
        return;
    }
    const nome = this.nomeDaParagem360(ann);
    previa.querySelector('.previa-nome').textContent = nome;
    previa.title = nome;

    const filme = previa.querySelector('.previa-janela video');
    const foto = previa.querySelector('.previa-janela img');

    if (ann.isImage) {
        filme.style.display = 'none';
        filme.removeAttribute('src');
        foto.style.display = '';
        if (foto.getAttribute('src') !== ann.imagePath) {
            foto.setAttribute('src', ann.imagePath);
        }
        return;
    }

    foto.style.display = 'none';
    foto.removeAttribute('src');
    filme.style.display = '';

    const fontes = fontesDeVideo(this.videoDaRota360(ann));
    const leve = fontes['480p'] || fontes['720p'] || Object.values(fontes)[0];
    if (!leve) {
        return;
    }
    // O "#t=0.001" pede ao navegador a imagem do primeiro instante, senão
    // a janela ficava preta.
    const desejado = leve + '#t=0.001';
    if (filme.getAttribute('src') !== desejado) {
        filme.setAttribute('src', desejado);
        filme.load();
    }
};

/**
 * Mede a barra dos comandos que vive dentro da janela da paragem.
 *
 * A barra é desenhada na outra página, e a altura dela muda com o tamanho
 * do ecrã e com o que a paragem é — uma fotografia tem menos botões do
 * que uma rota. Sem esta medida, a imagem 360º ficaria mais baixa do que
 * a dos testemunhos: a barra roubava-lhe o espaço em vez de vir a seguir.
 */
AnnotationController.prototype.medirComandos360 = function() {
    const palco = this.palco360;
    if (!palco) {
        return;
    }
    const janela = palco.moldura.querySelector('iframe');
    let barra = null;
    try {
        barra = janela && janela.contentDocument &&
            janela.contentDocument.querySelector('.video-controls');
    } catch (e) { /* outra origem: fica a altura de omissão */ }
    if (barra && barra.offsetHeight > 0) {
        palco.modal.style.setProperty('--altura-controlos', barra.offsetHeight + 'px');
    }
    this.medirPalco(palco);
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
    content.style.position = 'relative';
    content.style.backgroundColor = '#05050a';
    content.style.borderRadius = '0';
    content.style.overflow = 'hidden';
    content.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';
    content.style.border = '1px solid rgba(255,255,255,0.1)';
    this.modalContent = content;

    const header = document.createElement('div');
    header.style.padding = '16px 24px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    header.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)';
    header.style.minHeight = '56px';
    header.style.boxSizing = 'border-box';
    
    this.modalTitle = document.createElement('div');
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
    fullscreenBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter"><path d="M8 3H3v5m18 0V3h-5m0 18h5v-5M3 16v5h5"></path></svg>';

    const vrBtn = document.createElement('button');
    vrBtn.className = 'player-btn';
    vrBtn.title = (window.Idiomas ? window.Idiomas.t('video.oculos') : 'Ver com óculos');
    vrBtn.setAttribute('data-i18n-title', 'video.oculos');
    vrBtn.style.display = 'none';
    vrBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-2.5a2 2 0 0 1-1.7-1l-.9-1.4a1.2 1.2 0 0 0-2 0l-.9 1.4a2 2 0 0 1-1.7 1H6a3 3 0 0 1-3-3z"></path></svg>';

    // Só aparece a quem tenha óculos ligados.
    if (navigator.xr && navigator.xr.isSessionSupported) {
        navigator.xr.isSessionSupported('immersive-vr')
            .then((tem) => { if (tem) vrBtn.style.display = ''; })
            .catch(() => {});
    }

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
    videoWrapper.appendChild(bigPlayBtn);

    const fsCloseBtn = document.createElement('button');
    fsCloseBtn.className = 'fechar-fullscreen-btn';
    fsCloseBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    fsCloseBtn.title = 'Fechar e voltar ao mapa';
    fsCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        closeModal();
    });
    videoWrapper.appendChild(fsCloseBtn);

    // A imagem e a barra dos comandos, uma peça só. É esta peça que vai a
    // ecrã inteiro, para os comandos irem com ela.
    const moldura = document.createElement('div');
    moldura.className = 'moldura-do-player';
    moldura.appendChild(videoWrapper);
    moldura.appendChild(controls);

    // O palco: o testemunho a dar ao meio, e uma janela do anterior e do
    // seguinte de cada lado, para se ver quem vem a caminho.
    const criarPrevia = (lado, sentido) => {
        const previa = document.createElement('button');
        previa.type = 'button';
        previa.className = 'janela-do-palco previa ' + lado;

        const barra = document.createElement('div');
        barra.className = 'previa-barra';
        const nome = document.createElement('span');
        nome.className = 'previa-nome';
        barra.appendChild(nome);
        previa.appendChild(barra);

        const janela = document.createElement('div');
        janela.className = 'previa-janela';
        const filme = document.createElement('video');
        filme.muted = true;
        filme.playsInline = true;
        filme.preload = 'metadata';
        filme.crossOrigin = 'anonymous';
        janela.appendChild(filme);
        previa.appendChild(janela);

        const rodape = document.createElement('div');
        rodape.className = 'previa-rodape';
        previa.appendChild(rodape);



        previa.addEventListener('click', () => {
            const escolhido = previa.dataset.video;
            const ann = this.annotations.find(a => a.video === escolhido);
            if (ann) this.openVideoModal(ann.video, ann.label, sentido);
        });
        return previa;
    };

    this.previaEsquerda = criarPrevia('esquerda', -1);
    this.previaDireita = criarPrevia('direita', 1);

    // As setas vivem no intervalo entre as janelas, e não por cima delas.
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
            // Vista a colecção toda, esta seta já é a cruz de saída.
            if (seta.classList.contains('a-sair')) {
                if (this.fecharModal) this.fecharModal();
                return;
            }
            const vizinha = sentido < 0 ? this.previaEsquerda : this.previaDireita;
            const ann = this.annotations.find(a => a.video === vizinha.dataset.video);
            if (ann) this.openVideoModal(ann.video, ann.label, sentido);
        });
        return seta;
    };
    this.setaEsquerda = criarSeta('esquerda', BICO_ESQUERDA, -1);
    this.setaDireita = criarSeta('direita', BICO_DIREITA, 1);

    content.appendChild(header);
    content.appendChild(moldura);

    // As três janelas vivem numa tira, e é a tira que desliza quando se
    // muda de testemunho. Ela é mais larga do que o ecrã de propósito: as
    // dos lados ficam cortadas pela borda, a espreitar.
    const carrossel = document.createElement('div');
    carrossel.className = 'carrossel';
    carrossel.appendChild(this.previaEsquerda);
    carrossel.appendChild(content);
    carrossel.appendChild(this.previaDireita);
    // O palco dos testemunhos, arrumado como o das paragens 360º: é o
    // mesmo desenho, e por isso as passagens são feitas pelo mesmo sítio.
    this.palcoDosTestemunhos = {
        modal: this.modal,
        tira: carrossel,
        meio: content,
        esquerda: this.previaEsquerda,
        direita: this.previaDireita,
        barra: controls,
        barraDoNome: header
    };
    this.modal.appendChild(carrossel);
    this.modal.appendChild(this.setaEsquerda);
    this.modal.appendChild(this.setaDireita);
    document.body.appendChild(this.modal);

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
    let cliqueSozinho = null;
    this.videoPlayer.addEventListener('click', () => {
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

    // A barra está fora da imagem e não tapa nada, por isso fica sempre
    // à vista. O que continua a sumir-se é o rato: parado em cima do
    // vídeo, ao fim de uns segundos sai da frente.
    let ratoParado;
    const showControls = () => {
        videoWrapper.classList.remove('hide-cursor');
        clearTimeout(ratoParado);

        ratoParado = setTimeout(() => {
            if (!this.videoPlayer.paused &&
                (videoWrapper.matches(':hover') || document.fullscreenElement)) {
                videoWrapper.classList.add('hide-cursor');
            }
        }, 5000);
    };

    const mostrarRato = () => {
        clearTimeout(ratoParado);
        videoWrapper.classList.remove('hide-cursor');
    };

    videoWrapper.addEventListener('mousemove', showControls);
    videoWrapper.addEventListener('click', showControls);
    videoWrapper.addEventListener('mouseleave', mostrarRato);
    this.videoPlayer.addEventListener('pause', mostrarRato);
    
    // Quando transita de um vídeo para o outro em fullscreen, o play
    // automático esconde logo a barra para não ficar visível.
    this.videoPlayer.addEventListener('play', () => {
        if (document.fullscreenElement) {
            videoWrapper.classList.add('hide-cursor');
        }
    });

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.qualityMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        this.qualityMenu.classList.remove('show');
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            moldura.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!fullscreenBtn) return;
        if (document.fullscreenElement === moldura) {
            fullscreenBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 9h6V3 M21 9h-6V3 M21 15h-6v6 M3 15h6v6"></path></svg>';
        } else {
            fullscreenBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter"><path d="M8 3H3v5m18 0V3h-5m0 18h5v-5M3 16v5h5"></path></svg>';
        }
    });

    const closeModal = () => {
        const overlay = avisarQueOBairroVolta();

        if (this.videoNome) {
            this.marcarComoUltima('video-' + this.videoNome);
            
            const ann = this.annotations.find(a => a.video === this.videoNome);
            if (ann && this.entity.script && this.entity.script.cameraControls) {
                const posAtual = this.entity.getPosition();
                const dirAtual = new pc.Vec3().sub2(posAtual, ann.position);
                const angulo = Math.atan2(dirAtual.z, dirAtual.x);
                // Menos longe: 60 a 90 unidades (máximo de 90)
                const dist = 60 + Math.random() * 30;
                const posX = ann.position.x + Math.cos(angulo) * dist;
                const posZ = ann.position.z + Math.sin(angulo) * dist;
                const posY = ann.position.y + 25 + Math.random() * 25;
                const novaPos = new pc.Vec3(posX, Math.max(1, posY), posZ);
                
                // Enquadramento da regra dos terços (interseção inferior esquerda/direita)
                const UP = new pc.Vec3(0, 1, 0);
                const forward = new pc.Vec3().sub2(ann.position, novaPos).normalize();
                const right = new pc.Vec3().cross(forward, UP).normalize();
                const up = new pc.Vec3().cross(right, forward).normalize();
                
                // Para a anotação ficar no terço de baixo, o foco tem de estar acima
                const shiftY = 0.14 * dist;
                // Para ficar num dos lados, o foco tem de estar no lado oposto
                const sinalX = Math.random() < 0.5 ? -1 : 1;
                const shiftX = 0.25 * dist * sinalX;
                
                const focus = new pc.Vec3().copy(ann.position);
                focus.add(up.mulScalar(shiftY));
                focus.add(right.mulScalar(shiftX));
                
                this.entity.script.cameraControls.recenter(novaPos, focus);
            }
        }

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

    this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) closeModal();
    });

    // Com o ecrã a mudar de tamanho, as três janelas têm de voltar a
    // ficar do mesmo feitio.
    window.addEventListener('resize', () => {
        if (this.modal.style.display !== 'none') this.medirPalco(this.palcoDosTestemunhos);
    });

    // O fecho do modal fica à mão para as setas do palco o poderem usar.
    this.fecharModal = closeModal;

    // Um testemunho que chega ao fim conta como visto, e o seguinte que
    // ainda ninguém viu entra a seguir. Se era o último, não há mais nada
    // a mostrar: a janela fecha-se e devolve o bairro.
    this.videoPlayer.addEventListener('ended', () => {
        if (!this.videoNome) return;
        // Como nas paragens 360º, é preciso saber se este ainda faltava
        // antes de o marcar: é o que diz se é ele que fecha a colecção.
        const annId = 'video-' + this.videoNome;
        const faltava = !this.viewedAnnotations.includes(annId);
        this.marcarComoVisto(annId);

        const lista = this.annotations.filter(ann => !ann.is360 && ann.video);
        const onde = lista.findIndex(ann => ann.video === this.videoNome);
        this.registarFechoDaColeccao(annId, lista, faltava);
        if (onde >= 0) {
            const isAutoPlay = localStorage.getItem('autoplay-videos') === 'true';
            if (isAutoPlay) {
                if (this.noFimDaFila(lista, onde)) {
                    closeModal();
                } else {
                    const ann = lista[(onde + 1) % lista.length];
                    this.openVideoModal(ann.video, ann.label, 1);
                }
            }
        }
    });

    // Store references for the openVideoModal function
    this.videoSources = null;
};

/**
 * Mede a janela do meio e passa a altura dela às dos lados.
 *
 * As três têm de ter o mesmo feitio, senão a que desliza para o centro
 * assenta um pouco acima ou abaixo do sítio onde a do meio começa — e
 * vê-se o salto. A conta é feita na própria janela, e não escrita à mão.
 */
AnnotationController.prototype.medirPalco = function(palco) {
    if (!palco || !palco.modal || !palco.meio) {
        return;
    }
    // Primeiro a barra dos comandos, que é o rodapé que as janelas dos
    // lados vão copiar; depois a janela inteira. Nas paragens 360º não há
    // barra nenhuma a medir: os comandos vivem dentro da janela.
    if (palco.barra) {
        const barra = palco.barra.offsetHeight;
        if (barra > 0) {
            palco.modal.style.setProperty('--altura-controlos', barra + 'px');
        }
    }
    if (palco.barraDoNome) {
        const nome = palco.barraDoNome.offsetHeight;
        if (nome > 0) {
            palco.modal.style.setProperty('--altura-barra-nome', nome + 'px');
        }
    }
    const altura = palco.meio.offsetHeight;
    if (altura > 0) {
        palco.modal.style.setProperty('--altura-janela', altura + 'px');
    }
};

/**
 * Põe nas janelas dos lados o testemunho anterior e o seguinte.
 *
 * A lista dá a volta: depois do último vem o primeiro, para nunca ficar um
 * lado vazio.
 *
 * @param {string} nomeAtual - O testemunho que está a dar.
 */
AnnotationController.prototype.atualizarPalco = function(nomeAtual, sentido, oldCenterFrame) {
    const lista = this.annotations.filter(ann => !ann.is360 && ann.video);
    const onde = lista.findIndex(ann => ann.video === nomeAtual);
    // Ao mudar de testemunho, a nota de quem fechou a colecção só se
    // mantém se for este mesmo; senão larga-se, e a seta volta.
    if (onde >= 0) {
        this.registarFechoDaColeccao(this.idDaAnotacao(lista[onde]), lista, false);
    }
    const noFim = this.noFimDaFila(lista, onde);
    this.arrumarLadoDireito(this.setaDireita, this.previaDireita, noFim);

    if (onde < 0 || lista.length < 2) {
        return;
    }
    
    const annEsq = lista[(onde - 1 + lista.length) % lista.length];
    const annDir = lista[(onde + 1) % lista.length];

    let posterEsq = null;
    let posterDir = null;

    if (sentido === 1) {
        posterEsq = oldCenterFrame;
    } else if (sentido === -1) {
        posterDir = oldCenterFrame;
    }

    this.encherPrevia(this.previaEsquerda, annEsq, posterEsq);
    // No fim da fila a janela da direita está fora da vista: não vale a
    // pena ir buscar o vídeo que ela mostraria.
    if (!noFim) {
        this.encherPrevia(this.previaDireita, annDir, posterDir);
    }
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
    previa.querySelector('.previa-nome').textContent = ann.label;
    previa.title = ann.label;

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
 * Arruma o lado direito do palco: ou a seta e a janela do que vem a
 * seguir, ou a cruz de saída.
 *
 * A cruz é do fim da fila, e não da colecção: só aparece a quem esteja na
 * última paragem de uma colecção já vista de ponta a ponta. Quem voltar
 * atrás sai do fim, e a seta e a janela do lado voltam com ele — dali
 * ainda há para onde ir.
 *
 * @param {HTMLElement} seta - A seta da direita.
 * @param {HTMLElement} previa - A janela do lado direito.
 * @param {boolean} noFimDaFila - Se se está na última paragem e já se viu tudo.
 */
AnnotationController.prototype.arrumarLadoDireito = function(seta, previa, noFimDaFila) {
    if (previa) {
        previa.classList.toggle('sem-seguinte', noFimDaFila);
    }
    if (!seta) {
        return;
    }
    seta.classList.toggle('a-sair', noFimDaFila);
    seta.innerHTML = noFimDaFila ? DESENHO_DA_CRUZ : desenhoDaSeta(BICO_DIREITA);
    const chave = noFimDaFila ? 'palco.sair' : 'palco.seguinte';
    seta.setAttribute('data-i18n-title', chave);
    seta.title = window.Idiomas ? window.Idiomas.t(chave) : '';
};

/**
 * Se se está na última paragem de uma colecção já vista de ponta a ponta.
 *
 * É esta a única situação em que a seta da direita dá lugar à cruz: dali
 * para a frente a lista dava a volta e voltava ao princípio, e não há
 * nada de novo do lado de lá.
 *
 * @param {object[]} lista - As paragens da colecção, pela ordem delas.
 * @param {number} onde - Em qual delas se está.
 * @returns {boolean} Verdadeiro se for o fim da fila.
 */
AnnotationController.prototype.noFimDaFila = function(lista, onde) {
    if (!this.coleccaoVista(lista)) {
        return false;
    }

    // Na última paragem da lista há sempre fim de fila: dali para a frente
    // a lista dá a volta e volta ao princípio.
    if (onde === lista.length - 1) {
        return true;
    }

    // Fora dela, a cruz só aparece na paragem que fechou a colecção, e só
    // enquanto se está nela. Quem chega ao fim pelo meio da lista merece a
    // cruz ali mesmo, sem ter de ir até à última; mas quem lá voltar mais
    // tarde, dando a volta, ainda tem para onde ir e a seta tem de voltar.
    return this.idDaAnotacao(lista[onde]) === this.fechouAColeccao;
};

/**
 * Toma nota da paragem que acabou de fechar a colecção, ou larga a nota
 * quando se sai dela.
 *
 * Isto existe por causa de um engano fácil de fazer: perguntar qual foi a
 * última anotação a ser marcada como vista. Essa lista deixa de mudar
 * quando já se viu tudo, e a resposta fica congelada para sempre — a
 * paragem onde se completou a colecção passava a ostentar a cruz de saída
 * em todas as visitas seguintes, mesmo quando ainda havia lista adiante.
 *
 * @param {string} annId - A anotação que se está a ver.
 * @param {object[]} lista - As anotações da colecção a que ela pertence.
 * @param {boolean} faltavaAntes - Se ela ainda não tinha sido vista.
 */
AnnotationController.prototype.registarFechoDaColeccao = function(annId, lista, faltavaAntes) {
    if (faltavaAntes && this.coleccaoVista(lista)) {
        this.fechouAColeccao = annId;
    } else if (this.fechouAColeccao !== annId) {
        this.fechouAColeccao = null;
    }
};

/**
 * O testemunho seguinte que ainda ninguém viu.
 *
 * As rotas 360º ficam de fora: abrem noutra janela, com outro tocador, e
 * não se encadeiam com as entrevistas.
 *
 * @param {string} nomeAtual - O que está a dar agora, para não se repetir.
 * @returns {object|null} A anotação seguinte, ou nada se já foram todas.
 */
AnnotationController.prototype.proximoPorVer = function(nomeAtual) {
    return this.annotations.find(ann =>
        !ann.is360 && ann.video && ann.video !== nomeAtual &&
        !this.viewedAnnotations.includes(this.idDaAnotacao(ann))
    ) || null;
};

/**
 * Abre um testemunho na janela grande.
 *
 * Com a janela já aberta e um sentido dado, a troca faz-se com o
 * diapositivo a ser empurrado: as três janelas saem por um lado e as novas
 * entram pelo outro.
 *
 * @param {string} nome - O vídeo a abrir.
 * @param {string} title - O nome a mostrar na barra de cima.
 * @param {number} [sentido] - -1 para o anterior, 1 para o seguinte.
 */
AnnotationController.prototype.openVideoModal = function(nome, title, sentido) {
    const palco = this.palcoDosTestemunhos;
    const jaAberta = this.modal.style.display !== 'none';
    if (jaAberta && sentido && !palco.aDeslizar) {
        let oldCenterFrame = null;
        if (this.videoPlayer.readyState >= 2 && this.videoPlayer.videoWidth) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = this.videoPlayer.videoWidth;
                canvas.height = this.videoPlayer.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this.videoPlayer, 0, 0, canvas.width, canvas.height);
                oldCenterFrame = canvas.toDataURL();
            } catch(e) {}
        }
        this.deslizarPalco(palco, sentido, () => this.abrirTestemunho(nome, title, sentido, oldCenterFrame));
        return;
    }
    this.abrirTestemunho(nome, title);
};

/**
 * A passagem de uma janela para a outra, como um diapositivo empurrado.
 *
 * Serve os dois palcos: o dos testemunhos e o das paragens 360º.
 *
 * @param {object} palco - A tira, a janela do meio e as dos lados.
 * @param {number} sentido - -1 para a esquerda, 1 para a direita.
 * @param {Function} trocar - O que fazer no instante em que se troca.
 */
AnnotationController.prototype.deslizarPalco = function(palco, sentido, trocar) {
    const tira = palco.tira;
    const entra = sentido > 0 ? palco.direita : palco.esquerda;
    if (!tira || !entra) {
        trocar();
        return;
    }

    palco.aDeslizar = true;

    // O passo é medido no próprio palco, e não escrito à mão: assim
    // acompanha o tamanho do ecrã sem ninguém lhe tocar.
    const largura = palco.meio.offsetWidth;
    const espaco = parseFloat(getComputedStyle(tira).gap) || 0;
    const passo = largura + espaco;

    entra.classList.add('entra');
    tira.classList.add('a-deslizar');
    tira.style.transform = 'translateX(' + (-sentido * passo) + 'px)';

    const demora = (parseFloat(getComputedStyle(tira).transitionDuration) || 0.45) * 1000;

    setTimeout(() => {
        // Chegada: troca-se o que está nas janelas e põe-se a tira no
        // sítio outra vez, tudo no mesmo instante e sem animação, para a
        // volta ao lugar não se ver.
        tira.classList.add('sem-passagem');
        tira.classList.remove('a-deslizar');
        entra.classList.remove('entra');
        tira.style.transform = 'none';
        trocar();

        void tira.offsetWidth;
        tira.classList.remove('sem-passagem');
        palco.aDeslizar = false;
    }, demora);
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
    this.atualizarPalco(nome, sentido, oldCenterFrame);

    abrirDeRepente(this.modal);
    this.medirPalco(this.palcoDosTestemunhos);

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
