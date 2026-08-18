import * as pc from 'playcanvas';

export const ImageParticles = pc.createScript('imageParticles');

ImageParticles.attributes.add('imageUrl', { type: 'string', default: './bridge_drawing.png' });
ImageParticles.attributes.add('width', { type: 'number', default: 800 });
ImageParticles.attributes.add('particleDensity', { type: 'number', default: 0.5 });
ImageParticles.attributes.add('particleSize', { type: 'number', default: 1.5 });
ImageParticles.attributes.add('threshold', { type: 'number', default: 50, title: 'Red Threshold' });

ImageParticles.prototype.initialize = function() {
    this.particles = [];
    
    // Material setup (White Glow)
    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color(1, 1, 1); 
    mat.emissive = new pc.Color(1, 1, 1); // Branco puro
    mat.emissiveIntensity = 3.0;
    mat.blendType = pc.BLEND_ADDITIVE; // Brilho aditivo como os outros pirilampos
    mat.opacity = 0.9;
    mat.depthWrite = false;
    mat.useLighting = false;
    mat.update();

    // Setup static batching for performance
    var batchGroupId = null;
    const isLowQuality = typeof window !== 'undefined' && window.actualQuality === 'low';
    
    if (!isLowQuality) {
        try {
            if (this.app.batcher) {
                var bg = this.app.batcher.addGroup('imageParticles', false, 500);
                batchGroupId = bg.id;
            }
        } catch(e) {
            console.warn('[ImageParticles] Batching not available:', e);
        }
    } else {
        console.log('[ImageParticles] Low quality mode: Batching disabled in favor of aggressive Frustum Culling');
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        // Create an offscreen canvas to read pixels
        const canvas = document.createElement('canvas');
        
        // Scale down image based on density to avoid crashing with too many particles
        const targetWidth = Math.min(img.width, 600 * this.particleDensity);
        const scale = targetWidth / img.width;
        const targetHeight = Math.floor(img.height * scale);
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imgData.data;
        
        // World units per pixel
        const unitsPerPixel = this.width / targetWidth;
        
        const validPixels = [];
        
        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x++) {
                const idx = (y * targetWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                
                if (r > this.threshold && r > g * 1.2 && r > b * 1.2) {
                    const px = (x - targetWidth/2) * unitsPerPixel;
                    const py = (targetHeight/2 - y) * unitsPerPixel;
                    validPixels.push({ px, py });
                }
            }
        }
        
        let i = 0;
        const self2 = this;
        
        function createBatch() {
            const batchEnd = Math.min(i + 500, validPixels.length);
            
            for (; i < batchEnd; i++) {
                const p = validPixels[i];
                
                const e = new pc.Entity();
                e.addComponent('render', {
                    type: 'box',
                    castShadows: false,
                    receiveShadows: false
                });
                const size = self2.particleSize * (0.2 + Math.random() * 1.15);
                e.setLocalScale(size, size, size);
                e.render.meshInstances[0].material = mat;
                
                const scatter = 0.5;
                const rx = p.px + (Math.random() - 0.5) * scatter;
                const ry = p.py + (Math.random() - 0.5) * scatter;
                const rz = (Math.random() - 0.5) * scatter;
                
                e.setPosition(rx, ry, rz);
                self2.entity.addChild(e);

                window.pickableParticles = window.pickableParticles || [];
                window.pickableParticles.push(e);
                
                self2.particles.push({
                    entity: e,
                    baseSize: size,
                    pulseSpeed: 1.0 + Math.random() * 2.0,
                    pulsePhase: Math.random() * Math.PI * 2,
                });
            }
            
            if (i < validPixels.length) {
                setTimeout(createBatch, 10);
            } else {
                // Só no fim: agrupar tudo de uma vez (evita reagrupar a cada lote criado)
                if (batchGroupId !== null) {
                    for (const p of self2.particles) {
                        try { p.entity.render.batchGroupId = batchGroupId; } catch (err) {}
                    }
                }
                console.log('[ImageParticles] Done! Created ' + validPixels.length + ' particles (box + batching)');
            }
        }
        
        createBatch();
    };
    img.src = this.imageUrl;
    
    this.time = 0;
    
    // Check quality mode to determine update behavior
    const urlParams = new URLSearchParams(window.location.search);
    const quality = urlParams.get('quality');
    this.isHighQuality = (!quality || quality === 'high');
};

ImageParticles.prototype.update = function(dt) {
    const isLowQuality = typeof window !== 'undefined' && window.actualQuality === 'low';
    
    if (isLowQuality && this.particles && this.particles.length > 0) {
        // Initialize frustum object once
        if (!this.frustum) {
            this.frustum = new pc.Frustum();
        }
        
        // Get camera (cached — a procura na hierarquia é cara por frame)
        if (!this._cameraEntity) this._cameraEntity = this.app.root.findByName('camera');
        const cameraEntity = this._cameraEntity;
        if (cameraEntity && cameraEntity.camera) {
            const camera = cameraEntity.camera;
            this.frustum.setFromMat4(camera.projectionMatrix, camera.viewMatrix);
            
            // Aggressive Frustum Culling: disable completely anything outside FOV
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                // Check if particle position is inside frustum
                const pos = p.entity.getPosition();
                if (this.frustum.containsPoint(pos)) {
                    if (!p.entity.enabled) p.entity.enabled = true;
                } else {
                    if (p.entity.enabled) p.entity.enabled = false;
                }
            }
        }
    }
};
