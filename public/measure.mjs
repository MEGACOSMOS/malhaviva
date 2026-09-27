import * as pc from 'playcanvas';

export const MeasureController = pc.createScript('measureController');

MeasureController.prototype.initialize = function() {
    this.points = [];
    
    // Configurações do traçado
    this.dashColor = new pc.Color().fromString('#00ffff'); // CYANO
    this.dashLength = 0.4;
    this.dashGap = 0.2;
    this.dashWidth = 0.15;
    this.dashThickness = 0.05;
    this.verticalOffset = 0.15;
    this.measureMode = false;
    
    this.measureRoot = new pc.Entity('measure-root');
    this.app.root.addChild(this.measureRoot);

    this.renderData = [];
    this.rebuildMeasurement();

    if (this.app.mouse) {
        this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
    }
    if (this.app.touch) {
        this.app.touch.on(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
    }

    this.setupUI();
};

MeasureController.prototype.rebuildMeasurement = function() {
    const children = this.measureRoot.children.slice();
    children.forEach(c => c.destroy());
    
    let batchGroupId = this._batchGroupId ?? null;
    if (batchGroupId === null && this.app.batcher) {
        try {
            batchGroupId = this.app.batcher.addGroup('measurements', false, 100).id;
            this._batchGroupId = batchGroupId;
        } catch (e) {
            console.warn('[Measure] Batching indisponível:', e);
        }
    }

    const tmpLook = new pc.Vec3();

    const material = new pc.StandardMaterial();
    material.diffuse = this.dashColor;
    material.emissive = this.dashColor;
    material.emissiveIntensity = 1.5;
    material.blendType = pc.BLEND_NONE;
    material.opacity = 1.0;
    material.depthTest = true;
    material.depthWrite = true;
    material.update();

    if (this.points.length < 2) {
        if (this.app.batcher && batchGroupId !== null) this.app.batcher.markGroupDirty(batchGroupId);
        return;
    }
    
    let totalLength = 0;
    const pathData = [];

    for (let i = 0; i < this.points.length - 1; i++) {
        const p1 = this.points[i];
        const p2 = this.points[i + 1];
        
        const dir = new pc.Vec3().sub2(p2, p1);
        const dist = dir.length();
        if (dist === 0) continue;
        dir.normalize();
        
        pathData.push({ p1: p1, p2: p2, dir: dir, dist: dist, startLen: totalLength });
        totalLength += dist;
    }
    
    const step = this.dashLength + this.dashGap;
    for (let d = 0; d < totalLength; d += step) {
        let seg = pathData.find(s => d >= s.startLen && d < s.startLen + s.dist);
        if (!seg) continue;
        
        const localDist = d - seg.startLen;
        let dashCenterDist = localDist + this.dashLength / 2;
        
        const centerPos = new pc.Vec3().copy(seg.dir).mulScalar(dashCenterDist).add(seg.p1);
        centerPos.y += this.verticalOffset;
        
        const dash = new pc.Entity('measure-dash');
        dash.addComponent('render', {
            type: 'box',
            material: material,
            castShadows: false,
            receiveShadows: false
        });
        this.measureRoot.addChild(dash);
        dash.setPosition(centerPos);
        dash.lookAt(tmpLook.copy(centerPos).add(seg.dir));
        dash.rotateLocal(90, 0, 0);
        dash.setLocalScale(this.dashWidth, this.dashLength, this.dashThickness);

        if (batchGroupId !== null) {
            dash.render.batchGroupId = batchGroupId;
        }
    }

    if (this.app.batcher && batchGroupId !== null) {
        this.app.batcher.markGroupDirty(batchGroupId);
    }
};

MeasureController.prototype.cliqueEmUI = function(e) {
    const alvo = e && e.event && e.event.target;
    return !!(alvo && alvo.closest && alvo.closest('#header, #definicoes-menu, #idioma-menu, #dev-menu, #filter-panel, #camera-stuck-popup, #measure-ui, #trail-edit-ui, .annotation-marker, #video-modal, #modal-360'));
};

MeasureController.prototype.onMouseDown = function(e) {
    if (e.button !== pc.MOUSEBUTTON_LEFT) return;
    if (this.cliqueEmUI(e)) return;
    this.handleInteraction(e.x, e.y);
};

MeasureController.prototype.onTouchStart = function(e) {
    if (this.cliqueEmUI(e)) return;
    if (e.touches.length > 0) {
        this.handleInteraction(e.touches[0].x, e.touches[0].y);
    }
};

MeasureController.prototype.handleInteraction = function(x, y) {
    if (!this.measureMode) return;
    
    const cameraEntity = this.app.root.findByName('camera');
    if (cameraEntity && cameraEntity.script && cameraEntity.script.cameraCoordinates) {
        const cursor = cameraEntity.script.cameraCoordinates.cursor;
        if (cursor) {
            const newPos = cursor.getPosition().clone();
            const isDuplicate = this.points.length > 0 && this.points[this.points.length - 1].distance(newPos) < 0.5;
            if (!isDuplicate && (newPos.length() > 0.1 || this.points.length === 0)) {
                 this.points.push(newPos);
                 this.rebuildMeasurement();
                 this.updateUI();
            }
        }
    }
};

MeasureController.prototype.setupUI = function() {
    this.ui = document.createElement('div');
    this.ui.id = 'measure-ui';
    this.ui.style.position = 'fixed';
    this.ui.style.bottom = '24px';
    this.ui.style.left = '50%';
    this.ui.style.transform = 'translateX(-50%)';
    this.ui.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent), #05050a';
    this.ui.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    this.ui.style.padding = '10px 14px';
    this.ui.style.display = 'none';
    this.ui.style.flexDirection = 'column';
    this.ui.style.alignItems = 'flex-start';
    this.ui.style.gap = '8px';
    this.ui.style.zIndex = '1000';
    this.ui.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
    this.ui.style.fontFamily = "'Liberation Mono', 'Courier New', monospace";
    
    this.ui.innerHTML = `
        <div style="color: #ffffff; font-weight: 600; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;">
            <div style="width: 6px; height: 6px; background: #00ffff; border-radius: 50%;"></div>
            Medição de Distância
        </div>
        <div style="color: rgba(255,255,255,0.7); font-size: 0.7rem;">Clica no mapa para medir.</div>
        <div id="measure-output" style="width: 100%; min-width: 200px; background: rgba(0,0,0,0.5); color: #00ffff; border: 1px solid rgba(255,255,255,0.15); padding: 8px; font-size: 1rem; font-weight: bold; text-align: center;">0.000 m</div>
        <textarea id="measure-code-output" readonly style="width: 100%; height: 60px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 6px; font-family: monospace; font-size: 0.7rem; resize: none;"></textarea>
        <div style="display: flex; gap: 8px; width: 100%;">
            <button id="measure-undo-btn" style="flex: 1; background: transparent; color: white; border: 1px solid rgba(255,255,255,0.15); padding: 4px 8px; cursor: pointer; font-size: 0.75rem; transition: background 0.2s;">Desfazer</button>
            <button id="measure-clear-btn" style="flex: 1; background: transparent; color: #ff4444; border: 1px solid rgba(255,0,0,0.3); padding: 4px 8px; cursor: pointer; font-size: 0.75rem; transition: background 0.2s;">Limpar</button>
            <button id="measure-copy-btn" style="flex: 1; background: #ffffff; color: #05050a; border: none; padding: 4px 8px; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: opacity 0.2s;">Copiar</button>
        </div>
    `;
    document.body.appendChild(this.ui);

    // This listener handles the checkbox change. We must ensure the checkbox exists in index.html.
    const devMeasureMode = document.getElementById('dev-measure-mode');
    if (devMeasureMode) {
        devMeasureMode.addEventListener('change', (e) => {
            this.measureMode = e.target.checked;
            if (this.measureMode) {
                this.ui.style.display = 'flex';
                this.updateUI();
            } else {
                this.ui.style.display = 'none';
            }
        });
    } else {
        // Retry binding in case DOM isn't fully ready or checkbox is dynamically loaded
        setTimeout(() => {
            const retryDevMeasure = document.getElementById('dev-measure-mode');
            if (retryDevMeasure) {
                retryDevMeasure.addEventListener('change', (e) => {
                    this.measureMode = e.target.checked;
                    if (this.measureMode) {
                        this.ui.style.display = 'flex';
                        this.updateUI();
                    } else {
                        this.ui.style.display = 'none';
                    }
                });
            }
        }, 1000);
    }

    this.ui.querySelector('#measure-undo-btn').addEventListener('click', () => {
        this.points.pop();
        this.rebuildMeasurement();
        this.updateUI();
    });

    this.ui.querySelector('#measure-clear-btn').addEventListener('click', () => {
        this.points = [];
        this.rebuildMeasurement();
        this.updateUI();
    });

    this.ui.querySelector('#measure-copy-btn').addEventListener('click', () => {
        const textarea = this.ui.querySelector('#measure-code-output');
        textarea.select();
        document.execCommand('copy');
        const btn = this.ui.querySelector('#measure-copy-btn');
        const originalText = btn.innerText;
        btn.innerText = 'Copiado!';
        setTimeout(() => { btn.innerText = originalText; }, 2000);
    });
};

MeasureController.prototype.updateUI = function() {
    if (!this.measureMode) return;
    const output = this.ui.querySelector('#measure-output');
    if (!output) return;

    let totalDist = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
        totalDist += this.points[i].distance(this.points[i+1]);
    }
    
    output.innerText = totalDist.toFixed(3) + ' m';

    const textarea = this.ui.querySelector('#measure-code-output');
    if (textarea) {
        let code = '    [\n';
        for (const p of this.points) {
            code += `        new pc.Vec3(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}),\n`;
        }
        code += '    ]';
        textarea.value = code;
        textarea.scrollTop = textarea.scrollHeight;
    }
};
