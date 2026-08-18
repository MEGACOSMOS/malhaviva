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
    this.app.root.addChild(this.cursor);

    this.mousePos = new pc.Vec2();
    this.isMouseMoved = false;

    // Enable GSplat ID tracking for picking
    if (this.app.scene.gsplat) {
        this.app.scene.gsplat.enableIds = true;
    }
    
    // Create Picker with Depth Support (true)
    const canvas = this.app.graphicsDevice.canvas;
    this.pickScale = 0.5; // Half resolution for performance
    this.picker = new pc.Picker(this.app, canvas.clientWidth * this.pickScale, canvas.clientHeight * this.pickScale, true);

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

CameraCoordinates.prototype.update = function(dt) {
    if (!this.entity.camera || !this.cursor) return;

    // --- Update Camera Info UI ---
    if (this.camX && this.camY && this.camZ && this.camPitch && this.camYaw) {
        const pos = this.entity.getPosition();
        const rot = this.entity.getEulerAngles();
        this.camX.textContent = pos.x.toFixed(2);
        this.camY.textContent = pos.y.toFixed(2);
        this.camZ.textContent = pos.z.toFixed(2);
        this.camPitch.textContent = rot.x.toFixed(1) + '°';
        this.camYaw.textContent = rot.y.toFixed(1) + '°';
    }

    if (!this.isMouseMoved || this.picking) return;

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
    
    // --- 1. Manual Raycast against Fireflies ---
    const camera = this.entity.camera;
    camera.screenToWorld(x, y, camera.nearClip, this.ray.origin);
    camera.screenToWorld(x, y, camera.farClip, this.ray.direction);
    this.ray.direction.sub(this.ray.origin).normalize();

    let hitParticle = false;
    let closestDist = Infinity;
    
    if (window.pickableParticles) {
        const oc = new pc.Vec3();
        for (let i = 0; i < window.pickableParticles.length; i++) {
            const e = window.pickableParticles[i];
            if (!e || !e.enabled || !e.parent) continue; // Check if valid and in hierarchy
            
            const center = e.getPosition();
            const radius = e.getLocalScale().x * 3.0; // Larger hitbox (3x) for easy picking

            oc.sub2(this.ray.origin, center);
            const b = oc.dot(this.ray.direction);
            const c = oc.dot(oc) - radius * radius;
            const discriminant = b * b - c;

            if (discriminant > 0) {
                const t = -b - Math.sqrt(discriminant);
                if (t > 0 && t < closestDist) {
                    closestDist = t;
                    this.hitPosition.copy(this.ray.direction).mulScalar(t).add(this.ray.origin);
                    hitParticle = true;
                }
            }
        }
    }

    if (hitParticle) {
        this.picking = false;
        this.cursor.setPosition(this.hitPosition);
        if (this.coordX && this.coordY && this.coordZ) {
            this.coordX.textContent = this.hitPosition.x.toFixed(2);
            this.coordY.textContent = this.hitPosition.y.toFixed(2);
            this.coordZ.textContent = this.hitPosition.z.toFixed(2);
        }
        return; // Found a firefly, skip depth picker
    }

    // --- 2. Fallback to Depth Picker (Gaussian Splat) ---
    // Prepare picker (renders depth buffer)
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
