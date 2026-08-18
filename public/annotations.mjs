import * as pc from 'playcanvas';

export const AnnotationController = pc.createScript('annotationController');

AnnotationController.prototype.initialize = function() {
    this.annotations = [
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
            videoSrc: {
                "Alta Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Dulce.mp4",
                "Baixa Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Dulce.mp4"
            },
            element: null
        },
        {
            position: new pc.Vec3(-67.03, -1.70, -64.40),
            label: "Luna",
            videoSrc: {
                "Alta Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Luna.mp4",
                "Baixa Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Luna.mp4"
            },
            element: null
        },
        {
            position: new pc.Vec3(-85.42, -7.76, -26.34),
            label: "Sofia",
            videoSrc: {
                "Alta Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Sofia.mp4",
                "Baixa Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Sofia.mp4"
            },
            element: null
        },
        {
            position: new pc.Vec3(-38.38, 1.47, -64.20),
            label: "Frei",
            videoSrc: {
                "Alta Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Frei.mp4",
                "Baixa Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Frei.mp4"
            },
            element: null
        },
        {
            position: new pc.Vec3(94.09, 1.82, 31.41),
            label: "Edson",
            videoSrc: {
                "Alta Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Edson.mp4",
                "Baixa Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Edson.mp4"
            },
            element: null
        },
        {
            position: new pc.Vec3(-91.98, -5.48, -53.98),
            label: "Edmilson",
            videoSrc: {
                "Alta Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Edmilson.mp4",
                "Baixa Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Edmilson.mp4"
            },
            element: null
        },
        {
            position: new pc.Vec3(31.12, 4.32, -92.28),
            label: "Carlos",
            videoSrc: {
                "Alta Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Carlos.mp4",
                "Baixa Qualidade": "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Carlos.mp4"
            },
            element: null
        }
    ];

    // Inject CSS for markers and custom player
    const style = document.createElement('style');
    style.textContent = `
        .annotation-marker {
            will-change: transform, opacity;
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
            border-radius: 0;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .marker-dot.is-360 {
            background-color: #ff0000;
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
            border-radius: 3px;
            position: relative;
        }
        .progress-filled {
            height: 100%;
            background: var(--color-accent, #10b981);
            width: 0%;
            border-radius: 3px;
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
            color: var(--color-accent, #10b981);
            transform: scale(1.1);
        }
        .time-display {
            color: white;
            font-size: 0.85rem;
            font-family: var(--font-main, sans-serif);
            font-variant-numeric: tabular-nums;
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
            width: 60px;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            outline: none;
            cursor: pointer;
        }
        .volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--color-accent, #10b981);
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
            background: rgba(18, 18, 28, 0.95);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 8px 0;
            display: none;
            flex-direction: column;
            min-width: 140px;
            z-index: 20;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
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
            color: var(--color-accent, #10b981);
        }
        .quality-btn.active::before {
            content: '✓';
            font-weight: bold;
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
            color: var(--color-accent, #10b981);
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

    this.annotations.forEach(ann => {
        const el = document.createElement('div');
        el.className = 'annotation-marker';
        if (ann.label === "Esvarena") el.classList.add('esvarena-marker');
        if (ann.trailIndex !== undefined) el.dataset.trailIndex = ann.trailIndex;
        
        if (ann.is360) {
            el.innerHTML = `
                <div class="marker-dot is-360">
                    <span style="font-size: 11px; font-weight: 700; color: #fff; font-family: var(--font-main, sans-serif); letter-spacing: -0.5px;">360</span>
                </div>
                <div class="marker-label">${ann.label}</div>
            `;
        } else {
            el.innerHTML = `
                <div class="marker-dot">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            if (ann.is360) {
                if (this.entity.script && this.entity.script.trailController) {
                    this.entity.script.trailController.showPopup360(ann.trailIndex);
                }
            } else {
                this.openVideoModal(ann.videoSrc, ann.label);
            }
        });

        this.container.appendChild(el);
        ann.element = el;
    });
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
        closeBtn.style.color = '#10b981';
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
    const volHighIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
    const volMutedIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
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
    settingsBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
    
    this.qualityMenu = document.createElement('div');
    this.qualityMenu.className = 'quality-menu';
    
    qualityContainer.appendChild(settingsBtn);
    qualityContainer.appendChild(this.qualityMenu);

    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'player-btn';
    fullscreenBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';

    controlsRight.appendChild(qualityContainer);
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
            this.videoPlayer.play();
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

AnnotationController.prototype.openVideoModal = function(sources, title) {
    this.modalTitle.textContent = title;
    
    // Store current sources dict
    this.videoSources = typeof sources === 'string' ? { "Default": sources } : sources;
    
    // Build Quality Menu
    this.qualityMenu.innerHTML = '';
    const qualities = Object.keys(this.videoSources);
    
    // Detect tier to set default quality
    let savedQuality = localStorage.getItem('quality') || 'auto';
    if (savedQuality === 'auto') {
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
        const isTouch = (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
        if (isMobileUA || (isSmallScreen && isTouch)) {
            savedQuality = 'low';
        } else {
            const cores = navigator.hardwareConcurrency || 4;
            savedQuality = cores <= 6 ? 'med' : 'high';
        }
    }

    // Default select based on device performance
    let selectedQuality;
    if (savedQuality === 'low' || savedQuality === 'med') {
        selectedQuality = qualities.find(q => q.toLowerCase().includes('baixa')) || qualities[qualities.length - 1];
    } else {
        selectedQuality = qualities.find(q => q.toLowerCase().includes('alta')) || qualities[0];
    }
    
    qualities.forEach(quality => {
        const btn = document.createElement('button');
        btn.className = 'quality-btn';
        if (quality === selectedQuality) btn.classList.add('active');
        btn.innerText = quality;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedQuality === quality) return;
            
            // Update active state
            Array.from(this.qualityMenu.children).forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            selectedQuality = quality;
            
            // Switch Source seamlessly
            const currentTime = this.videoPlayer.currentTime;
            const isPaused = this.videoPlayer.paused;
            
            this.videoPlayer.src = this.videoSources[quality];
            this.videoPlayer.currentTime = currentTime;
            if (!isPaused) {
                this.videoPlayer.play().catch(e => console.log(e));
            }
            this.qualityMenu.classList.remove('show');
        });
        this.qualityMenu.appendChild(btn);
    });
    
    // Set initial source
    this.videoPlayer.src = this.videoSources[selectedQuality];
    
    this.modal.style.display = 'flex';
    requestAnimationFrame(() => {
        this.modal.style.opacity = '1';
        this.modalContent.style.transform = 'scale(1)';
    });
    
    this.videoPlayer.play().catch(e => console.log('Autoplay prevented:', e));

    const gsplat = this.app.root.findByName('gsplat-scene');
    if (gsplat) gsplat.enabled = false;
};

// Markers shrink with distance so a far one never reads as bigger than a near
// one. The curve is a smooth falloff between MARKER_SCALE_MIN and _MAX with no
// clamping anywhere, so the size never jumps as the camera moves.
const MARKER_SCALE_MIN = 0.45;
const MARKER_SCALE_MAX = 1.6;
const MARKER_SCALE_FALLOFF = 70;

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
            // Scale sits between the two translates so the marker grows and
            // shrinks about its own centre and stays pinned to its position.
            const distance = dir.length();
            const scale = MARKER_SCALE_MIN + (MARKER_SCALE_MAX - MARKER_SCALE_MIN) *
                (MARKER_SCALE_FALLOFF / (MARKER_SCALE_FALLOFF + distance));

            // Use translate3d to stay on the GPU compositor layer (no layout/reflow)
            el.style.transform = `translate3d(${screenPos.x}px, ${screenPos.y}px, 0) scale(${scale.toFixed(3)}) translate(-50%, -50%)`;
        }
    }
};
