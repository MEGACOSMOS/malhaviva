
        // Wait for the PlayCanvas app to be ready, then hide the loading overlay
        const overlay = document.getElementById('loading-overlay');
        const header = document.getElementById('header');



        // Use a timeout-based approach to detect when the scene starts rendering
        let checkInterval;
        let attempts = 0;

        // Quality Management
        function detectTier() {
            const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
            const isTouch = (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
            
            const isMobile = isMobileUA || (isSmallScreen && isTouch);
            if (isMobile) return 'low';
            
            const cores = navigator.hardwareConcurrency || 4;
            if (cores <= 6) return 'med';
            
            return 'high';
        }

        let savedQuality = localStorage.getItem('quality') || 'auto';

        const actualQuality = savedQuality === 'auto' ? detectTier() : savedQuality;
        const isHigh = actualQuality === 'high';
        const isMed = actualQuality === 'med';
        const isLow = actualQuality === 'low';
        
        // Setup initial UI states
        document.getElementById('radio-auto').checked = (savedQuality === 'auto');
        document.getElementById('radio-high').checked = (savedQuality === 'high');
        document.getElementById('radio-med').checked = (savedQuality === 'med');
        document.getElementById('radio-low').checked = (savedQuality === 'low');
        
        // Setup initial PlayCanvas attributes before initialization
        const pcAppEl = document.getElementById('main-app');
        if (!isHigh) {
            pcAppEl.setAttribute('antialias', 'false');
            pcAppEl.setAttribute('high-resolution', 'false');
            
            // Carrega o Splat específico e optimizado para performance (Médio e Baixo)
            const splatAsset = document.getElementById('splat-scene');
            if (splatAsset) {
                splatAsset.setAttribute('src', 'splat_perf/lod-meta.json');
            }
        }

        function showUI() {
            overlay.classList.add('hidden');
            header.classList.add('visible');
            document.getElementById('coordinates-info').classList.add('visible');
            
            // Adjust SOG LOD settings and apply performance budgets
            try {
                const pcApp = document.querySelector('pc-app');
                const app = pcApp && pcApp.app;

                // --- Reduce rendering resolution on mobile (Nível Baixo) ---
                if (isLow && app && app.graphicsDevice) {
                    app.graphicsDevice.maxPixelRatio = 1;
                    
                    // Remove ALL fireflies to maximize performance in Low mode
                    if (app.root) {
                        ['imagePlane', 'groundFireflies'].forEach(name => {
                            const e = app.root.findByName(name);
                            if (e) e.destroy();
                        });
                    }
                }

                // --- 3D Fog removed (may cause LOD issues with GSplat) ---

                // --- Adjust far clip based on quality, but keep it huge for the background elements ---
                if (isLow || isMed) {
                    const cameraEntity = app && app.root && app.root.findByName('camera');
                    if (cameraEntity && cameraEntity.camera) {
                        cameraEntity.camera.farClip = isLow ? 10000 : 25000;
                    }
                }

                // --- Per-asset LOD tuning ---
                const splatEl = document.querySelector('pc-entity[name="gsplat-scene"]');
                if (splatEl && splatEl.entity && splatEl.entity.gsplat) {
                    if (isHigh) {
                        splatEl.entity.gsplat.lodBaseDistance = 300; 
                        splatEl.entity.gsplat.lodMultiplier = 3; 
                    } else if (isMed) {
                        splatEl.entity.gsplat.lodBaseDistance = 100; 
                        splatEl.entity.gsplat.lodMultiplier = 3; 
                        // Sem limite duro de memoria no nível Médio
                    } else { // isLow
                        splatEl.entity.gsplat.lodBaseDistance = 100; 
                        splatEl.entity.gsplat.lodMultiplier = 1.7; 
                        splatEl.entity.gsplat.splatBudget = 3000000; 
                    }
                }
            } catch(e) {
                console.warn("Performance setup error:", e);
            }
        }

        function setQuality(mode) {
            if (mode === savedQuality) return;
            localStorage.setItem('quality', mode);
            // Reload the page to recreate the WebGL context with new antialias settings
            window.location.reload();
        }

        // Settings Menu Logic
        const settingsBtn = document.getElementById('settings-btn');
        const settingsMenu = document.getElementById('settings-menu');
        const qualityInputs = document.querySelectorAll('input[name="quality"]');

        settingsBtn.addEventListener('click', () => {
            settingsMenu.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
                settingsMenu.classList.remove('open');
            }
        });

        qualityInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                setQuality(e.target.value);
            });
        });

        // Check if the pc-app element has initialized
        checkInterval = setInterval(() => {
            attempts++;
            const pcApp = document.querySelector('pc-app');

            // Check if the app has started (canvas exists and is rendering)
            if (pcApp && pcApp.querySelector('canvas')) {
                clearInterval(checkInterval);
                // Give a bit more time for the first chunks to load
                setTimeout(showUI, 2000);
            }

            // Safety timeout after 15 seconds
            if (attempts > 150) {
                clearInterval(checkInterval);
                showUI();
            }
        }, 100);



        // Camera Boundary Popup Logic
        const stuckPopup = document.getElementById('camera-stuck-popup');
        const recenterBtn = document.getElementById('recenter-btn');

        window.addEventListener('cameraBoundaryHit', () => {
            stuckPopup.classList.add('visible');
        });

        window.addEventListener('cameraBoundaryLeft', () => {
            stuckPopup.classList.remove('visible');
        });

        recenterBtn.addEventListener('click', () => {
            stuckPopup.classList.remove('visible');
            const pcApp = document.querySelector('pc-app');
            if (pcApp && pcApp.app) {
                const cameraEntity = pcApp.app.root.findByName('camera');
                if (cameraEntity && cameraEntity.script && cameraEntity.script.cameraControls) {
                    const startPos = cameraEntity.getPosition().clone().set(-168.13, 49.94, 141.22);
                    const origin = cameraEntity.getPosition().clone().set(0, 0, 0);
                    cameraEntity.script.cameraControls.reset(origin, startPos);
                }
            }
        });

        // Application custom scripts
        if (window.pc) {
            const CameraInfoTracker = pc.createScript('cameraInfoTracker');
            CameraInfoTracker.prototype.initialize = function() {
                this.camX = document.getElementById('cam-x');
                this.camY = document.getElementById('cam-y');
                this.camZ = document.getElementById('cam-z');
                this.camTilt = document.getElementById('cam-tilt');
            };
            CameraInfoTracker.prototype.update = function() {
                if (!this.entity || !this.camX) return;
                const pos = this.entity.getPosition();
                const rot = this.entity.getEulerAngles();
                
                this.camX.textContent = pos.x.toFixed(2);
                this.camY.textContent = pos.y.toFixed(2);
                this.camZ.textContent = pos.z.toFixed(2);
                this.camTilt.textContent = Math.round(rot.x) + '°';
            };
        }

        // Filter Panel Logic
    (function() {
        const filterBtn = document.getElementById('filter-btn');
        const filterPanel = document.getElementById('filter-panel');
        const pcAppEl = document.querySelector('pc-app');

        const sliders = {
            saturate:   { el: document.getElementById('filter-saturate'),   valEl: document.getElementById('val-saturate'),   unit: '%', def: 90 },
            brightness: { el: document.getElementById('filter-brightness'), valEl: document.getElementById('val-brightness'), unit: '%', def: 100 },
            contrast:   { el: document.getElementById('filter-contrast'),   valEl: document.getElementById('val-contrast'),   unit: '%', def: 100 },
            hue:        { el: document.getElementById('filter-hue'),        valEl: document.getElementById('val-hue'),        unit: '°', def: 0 },
            sepia:      { el: document.getElementById('filter-sepia'),      valEl: document.getElementById('val-sepia'),      unit: '%', def: 0 },
        };

        function buildFilter() {
            const s = sliders.saturate.el.value;
            const b = sliders.brightness.el.value;
            const c = sliders.contrast.el.value;
            const h = sliders.hue.el.value;
            const sp = sliders.sepia.el.value;
            return `saturate(${s}%) brightness(${b}%) contrast(${c}%) hue-rotate(${h}deg) sepia(${sp}%)`;
        }

        function applyFilter() {
            if (pcAppEl) pcAppEl.style.filter = buildFilter();
        }

        function updateLabels() {
            for (const key in sliders) {
                const s = sliders[key];
                s.valEl.textContent = s.el.value + s.unit;
            }
        }

        // Live preview on slider input
        for (const key in sliders) {
            sliders[key].el.addEventListener('input', () => {
                updateLabels();
                applyFilter();
            });
        }

        // Toggle panel
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterPanel.classList.toggle('visible');
            // Close settings menu if open
            const settingsMenu = document.getElementById('settings-menu');
            if (settingsMenu) settingsMenu.classList.add('hidden');
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!filterPanel.contains(e.target) && e.target !== filterBtn && !filterBtn.contains(e.target)) {
                filterPanel.classList.remove('visible');
            }
        });

        // Reset button
        document.getElementById('filter-reset').addEventListener('click', () => {
            for (const key in sliders) {
                sliders[key].el.value = sliders[key].def;
            }
            updateLabels();
            if (pcAppEl) pcAppEl.style.filter = 'none';
        });

        // Apply button (close panel and keep filter)
        document.getElementById('filter-apply').addEventListener('click', () => {
            applyFilter();
            filterPanel.classList.remove('visible');
        });

        // Camera Info Tab Logic
        const camTab = document.getElementById('camera-info-tab');
        const camToggle = document.getElementById('camera-info-toggle');
        camToggle.addEventListener('click', () => {
            camTab.classList.toggle('open');
            const icon = camToggle.querySelector('svg path');
            if (camTab.classList.contains('open')) {
                icon.setAttribute('d', 'M15 18l-6-6 6-6');
            } else {
                icon.setAttribute('d', 'M9 18l6-6-6-6');
            }
        });
    })();
    