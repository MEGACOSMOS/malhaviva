import * as pc from 'playcanvas';

export const GroundFireflies = pc.createScript('groundFireflies');

GroundFireflies.attributes.add('jsonUrl', { type: 'string', default: './ground_fireflies.json' });
GroundFireflies.attributes.add('particleSize', { type: 'number', default: 1.5 });

GroundFireflies.prototype.initialize = function() {
    this.time = 0;
    this.pointEntities = [];
    
    var self = this;

    var xhr = new XMLHttpRequest();
    // O URL já traz versão (?v=N) vinda do index.html, por isso o ficheiro pode ser cacheado
    xhr.open('GET', this.jsonUrl, true);
    xhr.onload = function() {
        if (xhr.status !== 200) {
            console.error('[FullSplat] Failed to load JSON, status:', xhr.status);
            return;
        }
        
        var data;
        try {
            data = JSON.parse(xhr.responseText);
        } catch(e) {
            console.error('[FullSplat] Failed to parse JSON:', e);
            return;
        }
        
        console.log('[FullSplat] Loaded ' + data.length + ' points');
        
        // Material
        var mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(1, 1, 1);
        mat.emissive = new pc.Color(1, 1, 1);
        mat.emissiveIntensity = 3.0;
        mat.blendType = pc.BLEND_ADDITIVE;
        mat.opacity = 0.8;
        mat.depthWrite = false;
        mat.useLighting = false;
        mat.update();

        // Merge every particle into a handful of draw calls. Cheap enough for
        // any quality level, so the per-frame culling below is only a fallback
        // for when batching is unavailable.
        var batchGroupId = null;
        try {
            if (self.app.batcher) {
                var bg = self.app.batcher.addGroup('fireflies', false, 500);
                batchGroupId = bg.id;
            }
        } catch(e) {
            console.warn('[FullSplat] Batching not available, falling back:', e);
        }
        self._batched = batchGroupId !== null;

        // Use all points (spatial grid already limited the count)
        var maxPts = data.length;
        var stride = 1;
        var count = 0;
        
        // Create points in small batches to avoid freezing
        var i = 0;
        
        function createBatch() {
            var batchEnd = Math.min(i + 500, data.length);
            
            for (; i < batchEnd && count < maxPts; i += stride) {
                var pt = data[i];
                if (!pt || pt.length < 3) continue;
                
                var x = pt[0], y = pt[1], z = pt[2];
                if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
                
                var e = new pc.Entity();
                e.addComponent('render', {
                    type: 'box',
                    castShadows: false,
                    receiveShadows: false
                });
                
                var size = self.particleSize * (0.2 + Math.random() * 1.15); // Max is ~1.35 (half of previous max)
                e.setLocalScale(size, size, size);
                e.render.meshInstances[0].material = mat;
                e.setLocalPosition(x, y, z);
                self.entity.addChild(e);

                window.pickableParticles = window.pickableParticles || [];
                window.pickableParticles.push(e);
                
                self.pointEntities.push({
                    entity: e,
                    baseSize: size,
                    pulseSpeed: 1.0 + Math.random() * 2.0,
                    pulsePhase: Math.random() * Math.PI * 2
                });
                
                count++;
            }
            
            if (i < data.length && count < maxPts) {
                setTimeout(createBatch, 10); // yield to browser
            } else {
                // Só no fim: agrupar tudo de uma vez (evita reagrupar a cada lote criado)
                if (batchGroupId !== null) {
                    for (const p of self.pointEntities) {
                        try { p.entity.render.batchGroupId = batchGroupId; } catch (err) {}
                    }
                }
                console.log('[FullSplat] Done! Created ' + count + ' particles (box geometry + batching)');
            }
        }
        
        createBatch();
    };
    
    xhr.onerror = function() {
        console.error('[FullSplat] XHR error loading JSON');
    };
    
    xhr.send();
};

GroundFireflies.prototype.update = function(dt) {
    // Batched particles are already cheap; only cull by hand without batching
    if (!this._batched && this.pointEntities && this.pointEntities.length > 0) {
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
            for (let i = 0; i < this.pointEntities.length; i++) {
                const p = this.pointEntities[i];
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
