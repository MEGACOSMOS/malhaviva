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
            imagePath: "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/HDRi%20-%20Preenchimento%20Generativo.exr",
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
        .marker-dot.viewed {
            background-color: #ffffff;
            color: #10b981;
        }
        .marker-dot.is-360.viewed {
            background-color: #ffffff;
            color: #ff0000;
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
            el.innerHTML = `
                <div class="marker-dot is-360 ${isViewed ? 'viewed' : ''}">
                    <span class="marker-text-360">360º</span>
                </div>
                <div class="marker-label">${ann.label}</div>
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
            // Mark as viewed
            if (!this.viewedAnnotations.includes(annId)) {
                this.viewedAnnotations.push(annId);
                try {
                    localStorage.setItem('viewedAnnotations', JSON.stringify(this.viewedAnnotations));
                } catch (e) {
                    console.warn("Could not save viewed annotations", e);
                }
                const dot = el.querySelector('.marker-dot');
                if (dot) dot.classList.add('viewed');
            }

            if (ann.is360) {
                if (ann.isImage) {
                    this.openImage360(ann.imagePath);
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

AnnotationController.prototype.openImage360 = function(imagePath) {
    if (!this.imageModal) {
        this.imageModal = document.createElement('div');
        this.imageModal.style.position = 'fixed';
        this.imageModal.style.top = '0';
        this.imageModal.style.left = '0';
        this.imageModal.style.width = '100vw';
        this.imageModal.style.height = '100vh';
        this.imageModal.style.backgroundColor = '#000000';
        this.imageModal.style.zIndex = '3000';
        this.imageModal.style.display = 'none';

        // Close button
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '20px';
        closeBtn.style.right = '20px';
        closeBtn.style.color = '#ffffff';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.zIndex = '3010';
        closeBtn.style.width = '44px';
        closeBtn.style.height = '44px';
        closeBtn.style.display = 'flex';
        closeBtn.style.alignItems = 'center';
        closeBtn.style.justifyContent = 'center';
        closeBtn.style.background = 'rgba(0,0,0,0.5)';
        closeBtn.style.borderRadius = '50%';
        closeBtn.style.transition = 'background 0.2s, transform 0.2s';
        
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(0,0,0,0.8)'; closeBtn.style.transform = 'scale(1.1)'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(0,0,0,0.5)'; closeBtn.style.transform = 'scale(1)'; });

        closeBtn.addEventListener('click', () => {
            this.imageModal.style.display = 'none';
            // Clear iframe to stop resources
            Array.from(this.imageModal.children).forEach(child => {
                if (child !== closeBtn) this.imageModal.removeChild(child);
            });
            const gsplat = this.app.root.findByName('gsplat-scene');
            if (gsplat) gsplat.enabled = true;
        });

        this.imageModal.appendChild(closeBtn);
        document.body.appendChild(this.imageModal);
    }

    const iframe = document.createElement('iframe');
    iframe.src = '/image360.html?src=' + encodeURIComponent(imagePath);
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    this.imageModal.appendChild(iframe);

    this.imageModal.style.display = 'block';

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

    controlsLeft.appendChild(playPauseBtn);
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
    vrBtn.title = 'Ver com óculos';
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

    videoWrapper.appendChild(this.videoPlayer);
    videoWrapper.appendChild(bigPlayBtn);
    videoWrapper.appendChild(controls);

    content.appendChild(header);
    content.appendChild(videoWrapper);
    this.modal.appendChild(content);
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
    this.videoPlayer.addEventListener('click', togglePlay);

    this.videoPlayer.addEventListener('timeupdate', () => {
        const percent = (this.videoPlayer.currentTime / this.videoPlayer.duration) * 100;
        progressFilled.style.width = `${percent}%`;
        timeDisplay.innerText = `${formatTime(this.videoPlayer.currentTime)} / ${formatTime(this.videoPlayer.duration)}`;
    });

    this.videoPlayer.addEventListener('loadedmetadata', () => {
        timeDisplay.innerText = `${formatTime(this.videoPlayer.currentTime)} / ${formatTime(this.videoPlayer.duration)}`;
    });

    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        this.videoPlayer.currentTime = pos * this.videoPlayer.duration;
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
            if (loadingText) loadingText.innerText = "A restaurar ambiente 3D…";
            overlay.classList.remove('hidden');
        }

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
                        if (loadingText) loadingText.innerText = "A carregar modelo 3D…";
                    }, 800);
                }
            }, 800);
            
        }, 300);
    };

    closeBtn.addEventListener('click', closeModal);
    this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) closeModal();
    });

    // Store references for the openVideoModal function
    this.videoSources = null;
};

AnnotationController.prototype.openVideoModal = function(nome, title) {
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
        <div class="settings-title">Qualidade</div>
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
