import * as pc from 'playcanvas';
import { fontesDeVideo } from './videos.mjs?v=5';
import { criarGestorDeQualidade } from './qualidade-video.mjs?v=8';

export const AnnotationController = pc.createScript('annotationController');

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
        .annotation-marker:hover .marker-label, .annotation-marker.force-hover .marker-label {
            transform: scale(1.15);
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
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
        /* Já visto: o marcador apaga-se em cinzento e deixa passar um
           pouco do bairro por trás, para se perceber de relance o que
           falta ver sem que o que já se viu desapareça. */
        .marker-dot.viewed,
        .marker-dot.is-360.viewed {
            background-color: rgba(138, 143, 152, 0.55);
            color: rgba(255, 255, 255, 0.85);
        }
        .marker-text-360 {
            font-size: 11px;
            font-weight: 700;
            font-family: var(--font-main, sans-serif);
            letter-spacing: -0.5px;
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
        .custom-video-container video {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
        }
        .video-controls {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.9));
            padding: 30px 15px 10px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
            z-index: 10;
        }
        .video-controls.active {
            opacity: 1;
            pointer-events: auto;
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
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.8;
            transition: 0.2s ease;
            padding: 0;
        }
        .player-btn:hover {
            opacity: 1;
            color: #ffffff;
            transform: scale(1.1);
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
            overflow: hidden;
            width: 32px;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .volume-container:hover, .volume-container.active {
            width: 140px;
        }
        .volume-slider-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            opacity: 0;
            transform: translateX(-10px);
            transition: all 0.3s ease;
            pointer-events: none;
        }
        .volume-container:hover .volume-slider-wrapper, .volume-container.active .volume-slider-wrapper {
            opacity: 1;
            transform: translateX(0);
            pointer-events: auto;
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

        /* ---- O palco: o testemunho a dar ao meio, na sua janela grande, e
           o anterior e o seguinte em janelas mais altas e estreitas, de cada
           lado e por fora dela.

           Das janelas dos lados vê-se só um terço da imagem, a tira do meio:
           o resto fica cortado, como se o vídeo continuasse para lá da
           moldura. Em cima de cada uma há uma barra com o nome de quem fala,
           igual à barra do título da janela grande. ---- */
        #video-modal {
            gap: 18px;
            /* Uma folga nas bordas para as janelas dos lados não ficarem
               encostadas ao vidro do ecrã. */
            padding: 0 18px;
        }
        /* A janela do meio leva o espaço todo que puder até mil pontos; as
           dos lados ficam com o que sobrar. Quando o ecrã aperta, encolhem
           todas, mas a do meio continua a ser de longe a maior. */
        .janela-do-player {
            flex: 1 1 auto;
            width: 90%;
            max-width: 1000px;
            min-width: 0;
        }
        .previa {
            display: flex;
            flex-direction: column;
            flex: 0 0 auto;
            align-self: center;
            padding: 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: #08080f;
            cursor: pointer;
            overflow: hidden;
            font-family: inherit;
            transition: border-color 0.25s ease;
        }
        .previa:hover {
            border-color: rgba(255, 255, 255, 0.3);
        }

        /* A barra de cima, para onde o nome se muda quando o rato chega —
           sobe de dentro da imagem e assenta aqui. */
        .previa-barra {
            flex: 0 0 auto;
            padding: 7px 8px;
            background: linear-gradient(to bottom, rgba(255,255,255,0.05), transparent), #05050a;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            overflow: hidden;
        }
        .previa-nome {
            display: block;
            font-size: 0.75rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.6);
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transform: translateY(3px);
            opacity: 0.75;
            transition: transform 0.25s ease, opacity 0.25s ease, color 0.25s ease;
        }
        .previa:hover .previa-nome {
            transform: translateY(0);
            opacity: 1;
            color: #ffffff;
        }

        /* A janela propriamente dita. Um terço de uma imagem de dezasseis
           por nove dá esta forma: dezasseis a dividir por três, por nove. */
        .previa-janela {
            position: relative;
            flex: 1 1 auto;
            aspect-ratio: 16 / 27;
            height: clamp(150px, 38vh, 400px);
            overflow: hidden;
        }
        .previa-janela video {
            width: 100%;
            height: 100%;
            /* "cover" numa moldura três vezes mais estreita corta os lados e
               deixa à vista exactamente o terço do meio, que é onde a pessoa
               costuma estar. */
            object-fit: cover;
            object-position: center;
            opacity: 0.3;
            filter: grayscale(0.5);
            transition: opacity 0.25s ease, filter 0.25s ease, transform 0.25s ease;
            pointer-events: none;
        }
        .previa:hover .previa-janela video {
            opacity: 0.7;
            filter: grayscale(0);
            transform: scale(1.04);
        }
        /* As setas são só o bico, sem cabo. */
        .previa-seta {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: rgba(255, 255, 255, 0.85);
            pointer-events: none;
            transition: transform 0.25s ease;
        }
        .previa:hover .previa-seta {
            transform: translate(-50%, -50%) scale(1.15);
        }

        /* ---- A passagem de uma janela para a outra, como um diapositivo a
           ser empurrado: sai para um lado, entra pelo outro. ---- */
        #video-modal.a-sair > .previa,
        #video-modal.a-sair > .janela-do-player {
            animation: palco-a-sair 0.17s ease-in forwards;
        }
        #video-modal.a-entrar > .previa,
        #video-modal.a-entrar > .janela-do-player {
            animation: palco-a-entrar 0.28s cubic-bezier(0.2, 0.7, 0.3, 1);
        }
        @keyframes palco-a-sair {
            to {
                transform: translateX(calc(var(--sentido, 1) * -70px));
                opacity: 0;
            }
        }
        @keyframes palco-a-entrar {
            from {
                transform: translateX(calc(var(--sentido, 1) * 70px));
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        /* Num ecrã estreito não há lugar de sobra ao lado do player: as
           janelas encostam-se às bordas da imagem e ficam só com a seta. */
        @media (max-width: 900px) {
            #video-modal {
                gap: 0;
            }
            .previa {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                width: 46px;
                height: 92px;
                flex: none;
                border: none;
                background: rgba(5, 5, 10, 0.55);
                z-index: 2100;
            }
            .previa.esquerda { left: 4px; }
            .previa.direita { right: 4px; }
            .previa-barra,
            .previa-janela video { display: none; }
            .previa-janela {
                height: 100%;
                aspect-ratio: auto;
            }
        }

        /* A roda de espera, ao centro, enquanto o vídeo carrega mais imagem. */
        .espera-video {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 30px;
            height: 30px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: espera-a-rodar 1s linear infinite;
            display: none;
            z-index: 4;
        }
        .espera-video.a-esperar {
            display: block;
        }
        @keyframes espera-a-rodar { 100% { transform: translate(-50%, -50%) rotate(360deg); } }

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

        /* O aviso que aparece quando um testemunho acaba e já há outro à
           espera. Cobre o vídeo, diz de quem é o próximo e deixa parar. */
        .proximo-video {
            position: absolute;
            inset: 0;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            background: rgba(5, 5, 10, 0.88);
            z-index: 5;
            text-align: center;
            padding: 20px;
        }
        .proximo-video.visivel {
            display: flex;
        }
        .proximo-etiqueta {
            font-size: 0.75rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.55);
        }
        .proximo-nome {
            font-size: 1.6rem;
            font-weight: 600;
            color: #ffffff;
        }
        .proximo-botoes {
            display: flex;
            gap: 10px;
            margin-top: 4px;
        }
        .proximo-botoes button {
            font-family: inherit;
            font-size: 0.85rem;
            padding: 9px 18px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            color: rgba(255, 255, 255, 0.85);
            cursor: pointer;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .proximo-botoes button:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
        }
        .proximo-botoes .proximo-agora {
            background: #ffffff;
            border-color: #ffffff;
            color: #05050a;
            font-weight: 600;
        }
        .proximo-botoes .proximo-agora:hover {
            background: rgba(255, 255, 255, 0.85);
            color: #05050a;
        }
        .proximo-barra {
            width: 180px;
            max-width: 60%;
            height: 2px;
            background: rgba(255, 255, 255, 0.15);
            overflow: hidden;
        }
        .proximo-barra i {
            display: block;
            height: 100%;
            width: 100%;
            background: #ffffff;
            transform-origin: left center;
            transform: scaleX(0);
        }
        .proximo-barra.a-contar i {
            transition: transform var(--espera) linear;
            transform: scaleX(1);
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

    this.annotations.forEach(ann => {
        const el = document.createElement('div');
        el.className = 'annotation-marker';
        el.dataset.tipo = ann.is360 ? '360' : 'testemunho';
        if (ann.label === "Esvarena") el.classList.add('esvarena-marker');
        if (ann.trailIndex !== undefined) el.dataset.trailIndex = ann.trailIndex;
        
        const annId = ann.is360 ? `360-${ann.trailIndex}` : `video-${ann.video}`;
        const isViewed = this.viewedAnnotations.includes(annId);

        if (ann.is360) {
            // As rotas mostram "360º" e o nome por baixo. A fotografia do
            // alto do bairro dispensa as duas coisas: fica só um olho,
            // pousado no céu, sem legenda a tapar a paisagem.
            const simbolo = ann.isImage
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                   </svg>`
                : '<span class="marker-text-360">360º</span>';
            el.innerHTML = `
                <div class="marker-dot is-360 ${isViewed ? 'viewed' : ''}">
                    ${simbolo}
                </div>
                ${ann.isImage ? '' : `<div class="marker-label">${ann.label}</div>`}
            `;
        } else {
            el.innerHTML = `
                <div class="marker-dot ${isViewed ? 'viewed' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="22"></line>
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
            this.marcarComoVisto(annId);

            if (ann.is360) {
                if (ann.isImage) {
                    this.openImage360(ann.imagePath, ann.label);
                } else if (this.entity.script && this.entity.script.trailController) {
                    this.entity.script.trailController.showPopup360(ann.trailIndex);
                }
            } else {
                this.openVideoModal(ann.video, ann.label);
            }
        });

        this.container.appendChild(el);
        ann.element = el;
    });
};

/**
 * Abre uma fotografia 360º na mesma janela dos vídeos.
 *
 * Antes esta janela era um ecrã preto de ponta a ponta com uma cruz a
 * flutuar a um canto; agora tem a moldura, a barra de cima com o nome e a
 * mesma entrada dos vídeos das pessoas, para ser a mesma casa.
 *
 * @param {string} caminho - Onde está a fotografia.
 * @param {string} [titulo] - Nome a mostrar na barra de cima.
 */
AnnotationController.prototype.openImage360 = function(caminho, titulo) {
    if (!this.imageModal) {
        this.imageModal = document.createElement('div');
        this.imageModal.id = 'image-modal';
        this.imageModal.style.position = 'fixed';
        this.imageModal.style.top = '0';
        this.imageModal.style.left = '0';
        this.imageModal.style.width = '100%';
        this.imageModal.style.height = '100%';
        this.imageModal.style.backgroundColor = '#05050a';
        this.imageModal.style.display = 'none';
        this.imageModal.style.alignItems = 'center';
        this.imageModal.style.justifyContent = 'center';
        this.imageModal.style.zIndex = '3000';
        this.imageModal.style.opacity = '0';
        this.imageModal.style.transition = 'opacity 0.3s ease';

        const content = document.createElement('div');
        content.style.position = 'relative';
        content.style.width = '90%';
        content.style.maxWidth = '1000px';
        content.style.backgroundColor = '#05050a';
        content.style.borderRadius = '0';
        content.style.overflow = 'hidden';
        content.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';
        content.style.border = '1px solid rgba(255,255,255,0.1)';
        content.style.transform = 'scale(0.95)';
        content.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        this.imageModalContent = content;

        const header = document.createElement('div');
        header.style.padding = '16px 24px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        header.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)';

        this.imageModalTitle = document.createElement('div');
        this.imageModalTitle.style.color = '#fff';
        this.imageModalTitle.style.fontWeight = '600';
        this.imageModalTitle.style.fontSize = '1.1rem';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = '#fff';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.opacity = '0.6';
        closeBtn.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        closeBtn.style.display = 'flex';
        closeBtn.style.alignItems = 'center';
        closeBtn.style.justifyContent = 'center';
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.opacity = '1';
            closeBtn.style.transform = 'scale(1.1)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.opacity = '0.6';
            closeBtn.style.transform = 'scale(1)';
        });

        closeBtn.addEventListener('click', () => {
            this.imageModal.style.opacity = '0';
            this.imageModalContent.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.imageModal.style.display = 'none';
                this.imageFrame.innerHTML = '';
                const gsplat = this.app.root.findByName('gsplat-scene');
                if (gsplat) gsplat.enabled = true;
            }, 300);
        });

        header.appendChild(this.imageModalTitle);
        header.appendChild(closeBtn);

        this.imageFrame = document.createElement('div');
        this.imageFrame.style.width = '100%';
        this.imageFrame.style.aspectRatio = '16 / 9';
        this.imageFrame.style.backgroundColor = '#000';

        content.appendChild(header);
        content.appendChild(this.imageFrame);
        this.imageModal.appendChild(content);
        document.body.appendChild(this.imageModal);
    }

    this.imageModalTitle.textContent = titulo ||
        (window.Idiomas ? window.Idiomas.t('foto.titulo') : 'Fotografia 360º');
    this.imageFrame.innerHTML = '<iframe src="/image360.html?src=' + encodeURIComponent(caminho) +
        '" style="width: 100%; height: 100%; border: none; background: #000; display: block;" allow="xr-spatial-tracking; fullscreen" allowfullscreen></iframe>';

    this.imageModal.style.display = 'flex';
    setTimeout(() => {
        this.imageModal.style.opacity = '1';
        this.imageModalContent.style.transform = 'scale(1)';
    }, 10);

    const gsplat = this.app.root.findByName('gsplat-scene');
    if (gsplat) gsplat.enabled = false;
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
    content.className = 'janela-do-player';
    content.style.position = 'relative';
    content.style.backgroundColor = '#05050a';
    content.style.borderRadius = '0';
    content.style.overflow = 'hidden';
    content.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';
    content.style.border = '1px solid rgba(255,255,255,0.1)';
    content.style.transform = 'scale(0.95)';
    content.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    this.modalContent = content;

    const header = document.createElement('div');
    header.style.padding = '16px 24px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    header.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)';
    
    this.modalTitle = document.createElement('div');
    this.modalTitle.style.color = '#fff';
    this.modalTitle.style.fontWeight = '600';
    this.modalTitle.style.fontSize = '1.1rem';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#fff';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.opacity = '0.6';
    closeBtn.style.transition = 'opacity 0.2s ease, transform 0.2s ease, color 0.2s ease';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.opacity = '1';
        closeBtn.style.transform = 'scale(1.1)';
        closeBtn.style.color = '#ffffff';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.opacity = '0.6';
        closeBtn.style.transform = 'scale(1)';
        closeBtn.style.color = '#fff';
    });
    
    header.appendChild(this.modalTitle);
    header.appendChild(closeBtn);

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
    volumeSlider.max = '3';
    volumeSlider.step = '0.05';
    volumeSlider.value = '1';

    const volumePercentage = document.createElement('div');
    volumePercentage.className = 'volume-percentage';
    volumePercentage.innerText = '100%';

    volumeSliderWrapper.appendChild(volumeSlider);
    volumeSliderWrapper.appendChild(volumePercentage);
    
    volumeContainer.appendChild(volumeBtn);
    volumeContainer.appendChild(volumeSliderWrapper);

    // Recuar e avançar dez segundos, como no tocador das rotas 360º.
    const recuarBtn = document.createElement('button');
    recuarBtn.className = 'player-btn';
    recuarBtn.setAttribute('data-i18n-title', 'v360.recuar');
    recuarBtn.title = (window.Idiomas ? window.Idiomas.t('v360.recuar') : 'Recuar 10 segundos');
    recuarBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="11 19 2 12 11 5"></polyline><polyline points="21 19 12 12 21 5"></polyline></svg>';

    const avancarBtn = document.createElement('button');
    avancarBtn.className = 'player-btn';
    avancarBtn.setAttribute('data-i18n-title', 'v360.avancar');
    avancarBtn.title = (window.Idiomas ? window.Idiomas.t('v360.avancar') : 'Avançar 10 segundos');
    avancarBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="13 19 22 12 13 5"></polyline><polyline points="3 19 12 12 3 5"></polyline></svg>';

    playPauseBtn.setAttribute('data-i18n-title', 'v360.tocar');
    playPauseBtn.title = (window.Idiomas ? window.Idiomas.t('v360.tocar') : 'Tocar / Pausar');

    controlsLeft.appendChild(recuarBtn);
    controlsLeft.appendChild(playPauseBtn);
    controlsLeft.appendChild(avancarBtn);
    controlsLeft.appendChild(volumeContainer);
    controlsLeft.appendChild(timeDisplay);

    // Right controls
    const controlsRight = document.createElement('div');
    controlsRight.className = 'controls-right';

    const qualityContainer = document.createElement('div');
    qualityContainer.style.position = 'relative';

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'player-btn';
    settingsBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
    
    this.qualityMenu = document.createElement('div');
    this.qualityMenu.className = 'quality-menu';
    
    qualityContainer.appendChild(settingsBtn);
    qualityContainer.appendChild(this.qualityMenu);

    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'player-btn';
    fullscreenBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M8 3H3v5m18 0V3h-5m0 18h5v-5M3 16v5h5"></path></svg>';

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

    controls.appendChild(progressContainer);
    controls.appendChild(controlsMain);

    // Quando um testemunho acaba, o seguinte que ainda não foi visto
    // entra sozinho. Este aviso dá tempo de travar antes disso.
    const proximo = document.createElement('div');
    proximo.className = 'proximo-video';
    proximo.innerHTML = `
        <div class="proximo-etiqueta"></div>
        <div class="proximo-nome"></div>
        <div class="proximo-botoes">
            <button type="button" class="proximo-agora"></button>
            <button type="button" class="proximo-parar"></button>
        </div>
        <div class="proximo-barra"><i></i></div>
    `;
    this.avisoDoProximo = proximo;
    videoWrapper.appendChild(proximo);

    // A roda que aparece quando o vídeo fica à espera de mais imagem.
    const espera = document.createElement('div');
    espera.className = 'espera-video';
    videoWrapper.appendChild(espera);

    // Os dois sinais que piscam ao saltar dez segundos com duplo clique.
    const setaDupla = (paraTras) => paraTras
        ? '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="11 19 2 12 11 5"></polyline><polyline points="21 19 12 12 21 5"></polyline></svg>'
        : '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="13 19 22 12 13 5"></polyline><polyline points="3 19 12 12 3 5"></polyline></svg>';

    const sinalEsquerda = document.createElement('div');
    sinalEsquerda.className = 'salto-sinal esquerda';
    sinalEsquerda.innerHTML = setaDupla(true) + '<span>10 s</span>';
    const sinalDireita = document.createElement('div');
    sinalDireita.className = 'salto-sinal direita';
    sinalDireita.innerHTML = setaDupla(false) + '<span>10 s</span>';
    videoWrapper.appendChild(sinalEsquerda);
    videoWrapper.appendChild(sinalDireita);

    videoWrapper.appendChild(this.videoPlayer);
    videoWrapper.appendChild(bigPlayBtn);
    videoWrapper.appendChild(controls);

    // O palco: o testemunho a dar ao meio, e uma janela do anterior e do
    // seguinte de cada lado, para se ver quem vem a caminho.
    const criarPrevia = (lado, bico, sentido) => {
        const previa = document.createElement('button');
        previa.type = 'button';
        previa.className = 'previa ' + lado;

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
        const seta = document.createElement('div');
        seta.className = 'previa-seta';
        seta.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="' + bico + '"></polyline></svg>';
        janela.appendChild(seta);
        previa.appendChild(janela);

        previa.addEventListener('click', () => {
            const escolhido = previa.dataset.video;
            const ann = this.annotations.find(a => a.video === escolhido);
            if (ann) this.openVideoModal(ann.video, ann.label, sentido);
        });
        return previa;
    };

    this.previaEsquerda = criarPrevia('esquerda', '15 18 9 12 15 6', -1);
    this.previaDireita = criarPrevia('direita', '9 18 15 12 9 6', 1);

    content.appendChild(header);
    content.appendChild(videoWrapper);

    // As janelas dos lados ficam por fora do player, e não dentro dele: a
    // do meio fica com o tamanho todo que sempre teve, e as outras duas
    // pousam ao lado, no escuro.
    this.modal.appendChild(this.previaEsquerda);
    this.modal.appendChild(content);
    this.modal.appendChild(this.previaDireita);
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

    // ---- Saltar dez segundos ----
    const SALTO = 10;
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
    document.addEventListener('keydown', (e) => {
        if (this.modal.style.display === 'none') return;
        if (e.target && /^(?:INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        const tecla = e.key.toLowerCase();
        if (tecla === ' ' || tecla === 'k') {
            e.preventDefault();
            togglePlay();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            saltar(-5);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            saltar(5);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            volumeSlider.value = Math.min(3, parseFloat(volumeSlider.value) + 0.1);
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

    // Auto-hide controls logic
    let controlsTimeout;
    const showControls = () => {
        controls.classList.add('active');
        videoWrapper.classList.remove('hide-cursor');
        clearTimeout(controlsTimeout);
        
        controlsTimeout = setTimeout(() => {
            if (!this.videoPlayer.paused) {
                controls.classList.remove('active');
                this.qualityMenu.classList.remove('show');
                if (videoWrapper.matches(':hover') || document.fullscreenElement) {
                    videoWrapper.classList.add('hide-cursor');
                }
            }
        }, 5000);
    };

    const hideControlsImmediate = () => {
        if (!this.videoPlayer.paused) {
            controls.classList.remove('active');
            this.qualityMenu.classList.remove('show');
        }
    };

    videoWrapper.addEventListener('mousemove', showControls);
    videoWrapper.addEventListener('click', showControls);
    videoWrapper.addEventListener('mouseleave', hideControlsImmediate);
    
    // Always show controls when paused
    this.videoPlayer.addEventListener('pause', () => {
        clearTimeout(controlsTimeout);
        controls.classList.add('active');
        videoWrapper.classList.remove('hide-cursor');
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
            videoWrapper.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!fullscreenBtn) return;
        if (document.fullscreenElement === videoWrapper) {
            fullscreenBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 9h6V3 M21 9h-6V3 M21 15h-6v6 M3 15h6v6"></path></svg>';
        } else {
            fullscreenBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M8 3H3v5m18 0V3h-5m0 18h5v-5M3 16v5h5"></path></svg>';
        }
    });

    const closeModal = () => {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay ? overlay.querySelector('.loading-text') : null;
        
        if (overlay) {
            // Make overlay appear instantly without fade-in
            overlay.style.transition = 'none';
            if (loadingText) loadingText.innerText = (window.Idiomas ? window.Idiomas.t('carga.restaurar') : 'A restaurar ambiente 3D…');
            overlay.classList.remove('hidden');
        }

        this.esconderProximo();
        this.modal.style.opacity = '0';
        this.modalContent.style.transform = 'scale(0.95)';
        
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
            
            // Wait for 3D scene to re-render, then hide loading overlay
            setTimeout(() => {
                if (overlay) {
                    // Restore transition so it fades out smoothly
                    overlay.style.transition = '';
                    overlay.classList.add('hidden');
                    // Reset text after fade out
                    setTimeout(() => {
                        if (loadingText) loadingText.innerText = (window.Idiomas ? window.Idiomas.t('carga.modelo') : 'A carregar modelo 3D…');
                    }, 800);
                }
            }, 800);
            
        }, 300);
    };

    closeBtn.addEventListener('click', closeModal);
    this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) closeModal();
    });

    // O fecho do modal fica à mão para o aviso do próximo testemunho o
    // poder usar.
    this.fecharModal = closeModal;

    // Um testemunho que chega ao fim conta como visto, e o seguinte que
    // ainda ninguém viu entra a seguir.
    this.videoPlayer.addEventListener('ended', () => {
        if (!this.videoNome) return;
        this.marcarComoVisto('video-' + this.videoNome);
        this.mostrarProximo(this.proximoPorVer(this.videoNome));
    });

    // Store references for the openVideoModal function
    this.videoSources = null;
};

/**
 * Põe nas janelas dos lados o testemunho anterior e o seguinte.
 *
 * A lista dá a volta: depois do último vem o primeiro, para nunca ficar um
 * lado vazio.
 *
 * @param {string} nomeAtual - O testemunho que está a dar.
 */
AnnotationController.prototype.atualizarPalco = function(nomeAtual) {
    const lista = this.annotations.filter(ann => !ann.is360 && ann.video);
    const onde = lista.findIndex(ann => ann.video === nomeAtual);
    if (onde < 0 || lista.length < 2) {
        return;
    }
    this.encherPrevia(this.previaEsquerda, lista[(onde - 1 + lista.length) % lista.length]);
    this.encherPrevia(this.previaDireita, lista[(onde + 1) % lista.length]);
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
AnnotationController.prototype.encherPrevia = function(previa, ann) {
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
    // O "#t=1" pede ao navegador a imagem do primeiro segundo, senão a
    // janela ficava preta até alguém carregar nela.
    const desejado = leve + '#t=1';
    const filme = previa.querySelector('.previa-janela video');
    if (filme.getAttribute('src') !== desejado) {
        filme.setAttribute('src', desejado);
        filme.load();
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
 * Passa ao testemunho seguinte — ou, se já foram todos vistos, diz isso
 * mesmo e oferece fechar.
 *
 * Não há pergunta pelo meio: um testemunho que acaba dá lugar ao
 * seguinte como num alinhamento, e quem não quiser fecha a janela.
 *
 * @param {object|null} ann - A anotação seguinte, ou nada.
 */
AnnotationController.prototype.mostrarProximo = function(ann) {
    if (ann) {
        this.esconderProximo();
        this.openVideoModal(ann.video, ann.label, 1);
        return;
    }

    const aviso = this.avisoDoProximo;
    if (!aviso) {
        return;
    }
    const dizer = (chave, omissao) => (window.Idiomas ? window.Idiomas.t(chave) : omissao);
    aviso.querySelector('.proximo-etiqueta').textContent = '';
    aviso.querySelector('.proximo-nome').textContent =
        dizer('proximo.fim', 'Já viu todos os testemunhos.');
    aviso.querySelector('.proximo-agora').style.display = 'none';
    const parar = aviso.querySelector('.proximo-parar');
    parar.textContent = dizer('proximo.fechar', 'Fechar');
    parar.onclick = () => {
        this.esconderProximo();
        if (this.fecharModal) this.fecharModal();
    };
    aviso.querySelector('.proximo-barra').classList.remove('a-contar');
    aviso.classList.add('visivel');
};

/**
 * Arruma o aviso do próximo testemunho.
 */
AnnotationController.prototype.esconderProximo = function() {
    const aviso = this.avisoDoProximo;
    if (!aviso) {
        return;
    }
    aviso.classList.remove('visivel');
    const barra = aviso.querySelector('.proximo-barra');
    if (barra) barra.classList.remove('a-contar');
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
    const jaAberta = this.modal.style.display !== 'none';
    if (jaAberta && sentido && !this.aDeslizar) {
        this.deslizar(sentido, () => this.abrirTestemunho(nome, title));
        return;
    }
    this.abrirTestemunho(nome, title);
};

/**
 * A passagem de uma janela para a outra, como um diapositivo empurrado.
 *
 * @param {number} sentido - -1 para a esquerda, 1 para a direita.
 * @param {Function} trocar - O que fazer no instante em que se troca.
 */
AnnotationController.prototype.deslizar = function(sentido, trocar) {
    const palco = this.modal;
    this.aDeslizar = true;
    palco.style.setProperty('--sentido', String(sentido));
    palco.classList.remove('a-entrar');
    palco.classList.add('a-sair');

    setTimeout(() => {
        trocar();
        palco.classList.remove('a-sair');
        // Obrigar o navegador a refazer as contas aqui, senão ele não dá
        // pela troca de animação e a segunda nem chega a correr. É feito
        // à força, e não à espera da imagem seguinte: numa janela que
        // esteja em segundo plano essa imagem podia nunca chegar, e a
        // passagem ficava a meio para sempre.
        void palco.offsetWidth;
        palco.classList.add('a-entrar');
        setTimeout(() => {
            palco.classList.remove('a-entrar');
            this.aDeslizar = false;
        }, 300);
    }, 170);
};

AnnotationController.prototype.abrirTestemunho = function(nome, title) {
    this.esconderProximo();
    this.marcarComoVisto('video-' + nome);
    this.modalTitle.textContent = title;
    this.videoNome = nome;

    const fontes = fontesDeVideo(nome);
    this.videoSources = fontes;

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
    this.atualizarPalco(nome);

    this.modal.style.display = 'flex';

    // Só com o player já visível é que se sabe o tamanho que vai ter, e a
    // escolha da versão depende disso. Ler a altura obriga o navegador a
    // fazer as contas do tamanho já a seguir, sem esperar pela animação.
    void this.videoWrapper.clientHeight;
    this.gestorDeQualidade.arrancar();
    this.videoPlayer.play().catch(e => console.log('Autoplay prevented:', e));

    requestAnimationFrame(() => {
        this.modal.style.opacity = '1';
        this.modalContent.style.transform = 'scale(1)';
    });

    const gsplat = this.app.root.findByName('gsplat-scene');
    if (gsplat) gsplat.enabled = false;
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
                ann._visible = false;
            }
        } else {
            if (ann._visible !== true) {
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
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
