import * as pc from 'playcanvas';

export const CameraCoordinates = pc.createScript('cameraCoordinates');

CameraCoordinates.prototype.initialize = function() {
    this.coordX = document.getElementById('coord-x');
    this.coordY = document.getElementById('coord-y');
    this.coordZ = document.getElementById('coord-z');
    
    // Camera UI elements
    this.camX = document.getElementById('cam-x');
    this.camY = document.getElementById('cam-y');
    this.camZ = document.getElementById('cam-z');
    this.camPitch = document.getElementById('cam-pitch');
    this.camYaw = document.getElementById('cam-yaw');

    // Create a 3D cursor (a flat red cylinder/disc)
    this.cursor = new pc.Entity('splat-cursor');
    this.cursor.addComponent('render', {
        type: 'cylinder',
        castShadows: false
    });
    this.cursor.setLocalScale(2, 0.2, 2);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(1, 0, 0);
    material.emissive = new pc.Color(1, 0, 0);
    material.blendType = pc.BLEND_ADDITIVE;
    material.opacity = 0.6;
    material.depthWrite = false;
    material.update();

    this.cursor.render.meshInstances[0].material = material;
    this.cursor.enabled = false; // hidden until a dev mode needs it
    this.app.root.addChild(this.cursor);

    this.mousePos = new pc.Vec2();
    this.isMouseMoved = false;

    // Picking (GPU depth picker + raycasts) re-renders the scene on every mouse
    // move, so it stays fully off unless a dev tool that needs it is enabled:
    // "Posição do Cursor" or "Modo Edição de Trilha".
    this.pickingActive = false;
    this.cameraInfoActive = false;
    this.pickScale = 0.5; // Half resolution for performance
    this.picker = null;   // created lazily on first activation

    const devCursorToggle = document.getElementById('dev-cursor-coord');
    const devTrailToggle = document.getElementById('dev-trail-edit');
    const devCameraToggle = document.getElementById('dev-camera-coord');

    const refreshPicking = () => {
        const active = !!((devCursorToggle && devCursorToggle.checked) ||
                          (devTrailToggle && devTrailToggle.checked));
        this.setPickingActive(active);
    };
    if (devCursorToggle) devCursorToggle.addEventListener('change', refreshPicking);
    if (devTrailToggle) devTrailToggle.addEventListener('change', refreshPicking);
    if (devCameraToggle) {
        this.cameraInfoActive = devCameraToggle.checked;
        devCameraToggle.addEventListener('change', () => {
            this.cameraInfoActive = devCameraToggle.checked;
        });
    }
    refreshPicking();

    const onMouseMove = (e) => {
        this.mousePos.set(e.x, e.y);
        this.isMouseMoved = true;
    };
    
    if (this.app.mouse) {
        this.app.mouse.on(pc.EVENT_MOUSEMOVE, onMouseMove, this);
    }
    if (this.app.touch) {
        this.app.touch.on(pc.EVENT_TOUCHMOVE, (e) => {
            if (e.touches.length > 0) {
                this.mousePos.set(e.touches[0].x, e.touches[0].y);
                this.isMouseMoved = true;
            }
        }, this);
    }
    
    this.picking = false;
    this.ray = new pc.Ray();
    this.hitPosition = new pc.Vec3();
};

CameraCoordinates.prototype.setPickingActive = function(active) {
    if (active === this.pickingActive) return;
    this.pickingActive = active;
    this.cursor.enabled = active;

    // GSplat ID tracking adds per-frame cost, so it only runs while picking is on
    if (this.app.scene.gsplat) {
        this.app.scene.gsplat.enableIds = active;
    }

    if (active && !this.picker) {
        const canvas = this.app.graphicsDevice.canvas;
        this.picker = new pc.Picker(this.app, canvas.clientWidth * this.pickScale, canvas.clientHeight * this.pickScale, true);
    }
};

CameraCoordinates.prototype.update = function(dt) {
    if (!this.entity.camera || !this.cursor) return;

    // --- Update Camera Info UI (only while the dev panel is visible) ---
    if (this.cameraInfoActive && this.camX && this.camY && this.camZ && this.camPitch && this.camYaw) {
        const pos = this.entity.getPosition();
        const rot = this.entity.getEulerAngles();
        this.camX.textContent = pos.x.toFixed(2);
        this.camY.textContent = pos.y.toFixed(2);
        this.camZ.textContent = pos.z.toFixed(2);
        this.camPitch.textContent = rot.x.toFixed(1) + '°';
        this.camYaw.textContent = rot.y.toFixed(1) + '°';
    }

    if (!this.pickingActive || !this.picker || !this.isMouseMoved || this.picking) return;

    const canvas = this.app.graphicsDevice.canvas;
    const w = Math.floor(canvas.clientWidth * this.pickScale);
    const h = Math.floor(canvas.clientHeight * this.pickScale);
    
    if (this.picker.width !== w || this.picker.height !== h) {
        this.picker.resize(w, h);
    }

    this.picking = true;
    this.isMouseMoved = false;

    const x = this.mousePos.x;
    const y = this.mousePos.y;
    
    // O sítio onde se carregou sai da profundidade que o mapa desenha.
    // (Havia antes uma primeira tentativa, à mão, contra os pontos da ponte
    // desenhada; saiu com ela.)
    this.picker.prepare(this.entity.camera, this.app.scene);
    
    if (this.picker.getWorldPointAsync) {
        const scaledX = Math.floor(x * this.pickScale);
        const scaledY = Math.floor(y * this.pickScale);
        
        this.picker.getWorldPointAsync(scaledX, scaledY).then((worldPoint) => {
            this.picking = false;
            if (worldPoint) {
                this.cursor.setPosition(worldPoint);
                if (this.coordX && this.coordY && this.coordZ) {
                    this.coordX.textContent = worldPoint.x.toFixed(2);
                    this.coordY.textContent = worldPoint.y.toFixed(2);
                    this.coordZ.textContent = worldPoint.z.toFixed(2);
                }
            } else {
                this.fallbackPlaneIntersection(x, y);
            }
        }).catch(() => {
            this.picking = false;
            this.fallbackPlaneIntersection(x, y);
        });
    } else {
        this.picking = false;
        this.fallbackPlaneIntersection(x, y);
    }
};

CameraCoordinates.prototype.fallbackPlaneIntersection = function(x, y) {
    const camera = this.entity.camera;
    camera.screenToWorld(x, y, camera.nearClip, this.ray.origin);
    camera.screenToWorld(x, y, camera.farClip, this.ray.direction);
    this.ray.direction.sub(this.ray.origin).normalize();

    if (Math.abs(this.ray.direction.y) > 0.001) {
        const t = -this.ray.origin.y / this.ray.direction.y;
        if (t > 0) {
            this.hitPosition.copy(this.ray.direction).mulScalar(t).add(this.ray.origin);
            this.cursor.setPosition(this.hitPosition);
            if (this.coordX && this.coordY && this.coordZ) {
                this.coordX.textContent = this.hitPosition.x.toFixed(2);
                this.coordY.textContent = this.hitPosition.y.toFixed(2);
                this.coordZ.textContent = this.hitPosition.z.toFixed(2);
            }
        }
    }
};
