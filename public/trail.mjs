import * as pc from 'playcanvas';

export const TrailController = pc.createScript('trailController');

TrailController.prototype.initialize = function() {
    // --- CONFIGURATION ---
    this.routes = [
        [
            new pc.Vec3(-102.35, -14.56, 57.67),
            new pc.Vec3(-104.19, -15.11, 46.45),
            new pc.Vec3(-105.16, -14.74, 45.92),
            new pc.Vec3(-106.40, -15.04, 43.11),
            new pc.Vec3(-109.29, -15.38, 37.46),
            new pc.Vec3(-111.96, -15.54, 31.98),
            new pc.Vec3(-114.50, -15.81, 26.61),
            new pc.Vec3(-117.33, -15.61, 20.91),
            new pc.Vec3(-120.81, -15.81, 14.05),
            new pc.Vec3(-123.20, -15.63, 9.18),
            new pc.Vec3(-125.39, -15.66, 4.07),
            new pc.Vec3(-127.43, -15.62, -0.56),
            new pc.Vec3(-128.99, -15.55, -4.83),
            new pc.Vec3(-130.51, -15.49, -9.55),
            new pc.Vec3(-131.28, -14.92, -12.85),
            new pc.Vec3(-132.08, -14.32, -16.59),
            new pc.Vec3(-132.11, -13.57, -23.28),
            new pc.Vec3(-128.29, -12.44, -32.44),
            new pc.Vec3(-126.63, -11.74, -36.59),
            new pc.Vec3(-125.65, -11.04, -42.35),
            new pc.Vec3(-126.88, -10.51, -48.99),
            new pc.Vec3(-128.66, -10.01, -56.49),
            new pc.Vec3(-129.22, -9.93, -59.56),
            new pc.Vec3(-129.64, -10.15, -63.19),
            new pc.Vec3(-129.73, -9.75, -65.42),
            new pc.Vec3(-128.46, -9.68, -64.77),
            new pc.Vec3(-127.64, -9.85, -61.90),
            new pc.Vec3(-127.38, -9.69, -59.15),
            new pc.Vec3(-127.38, -10.14, -55.74),
            new pc.Vec3(-126.48, -9.96, -51.66),
            new pc.Vec3(-125.59, -10.35, -48.85),
            new pc.Vec3(-123.51, -10.69, -43.98),
            new pc.Vec3(-119.75, -9.90, -44.84),
            new pc.Vec3(-115.64, -8.99, -46.20),
            new pc.Vec3(-113.07, -7.74, -47.06),
            new pc.Vec3(-110.54, -6.71, -47.89),
            new pc.Vec3(-104.41, -7.24, -50.13),
            new pc.Vec3(-96.79, -4.87, -51.98),
            new pc.Vec3(-94.05, -5.15, -53.42),
            new pc.Vec3(-90.01, -5.85, -54.98),
            new pc.Vec3(-88.90, -6.15, -51.03),
            new pc.Vec3(-87.94, -5.84, -48.06),
            new pc.Vec3(-87.75, -6.06, -45.13),
            new pc.Vec3(-88.12, -6.85, -43.48),
            new pc.Vec3(-88.97, -7.06, -40.80),
            new pc.Vec3(-85.91, -6.66, -34.38),
            new pc.Vec3(-82.70, -7.65, -26.95),
            new pc.Vec3(-79.22, -8.10, -20.89),
            new pc.Vec3(-77.28, -8.49, -16.83),
            new pc.Vec3(-75.26, -8.33, -11.99),
            new pc.Vec3(-74.04, -8.97, -9.00),
            new pc.Vec3(-72.10, -9.28, -4.73),
            new pc.Vec3(-70.40, -10.27, 0.44),
            new pc.Vec3(-69.15, -9.69, 4.76),
            new pc.Vec3(-63.66, -9.79, 24.02),
            new pc.Vec3(-60.85, -9.48, 31.33),
            new pc.Vec3(-61.97, -9.86, 34.15),
            new pc.Vec3(-64.72, -10.05, 37.13),
            new pc.Vec3(-67.08, -10.31, 38.04),
            new pc.Vec3(-71.75, -11.03, 39.92),
            new pc.Vec3(-75.78, -11.14, 40.81),
            new pc.Vec3(-79.73, -11.66, 42.56),
            new pc.Vec3(-84.11, -12.33, 44.04),
            new pc.Vec3(-88.62, -13.15, 45.63),
            new pc.Vec3(-91.00, -13.41, 46.73),
            new pc.Vec3(-95.44, -13.90, 49.22),
            new pc.Vec3(-97.75, -14.47, 51.17),
            new pc.Vec3(-100.18, -14.84, 53.53),
            new pc.Vec3(-100.99, -14.91, 55.70),
            new pc.Vec3(-102.97, -15.06, 57.79)
        ],
        [
            new pc.Vec3(-45.47, -7.72, 24.39),
            new pc.Vec3(-41.32, -7.41, 21.06),
            new pc.Vec3(-41.98, -7.26, 16.28),
            new pc.Vec3(-44.98, -6.71, 7.93),
            new pc.Vec3(-48.45, -6.73, -1.97),
            new pc.Vec3(-50.31, -6.59, -8.42),
            new pc.Vec3(-54.93, -5.70, -21.87),
            new pc.Vec3(-31.53, 0.14, -30.74),
            new pc.Vec3(-31.29, -0.44, -41.80),
            new pc.Vec3(-35.25, 1.24, -63.14),
            new pc.Vec3(-28.45, 1.88, -68.76),
            new pc.Vec3(-28.80, 1.72, -71.50),
            new pc.Vec3(-34.48, 1.43, -70.91),
            new pc.Vec3(-36.19, 1.29, -57.96),
            new pc.Vec3(-32.31, -0.50, -40.42),
            new pc.Vec3(-28.75, -1.54, -27.23),
            new pc.Vec3(-26.81, -2.28, -15.00),
            new pc.Vec3(-24.98, -2.76, -5.79),
            new pc.Vec3(-25.26, -3.62, 3.07),
            new pc.Vec3(-30.26, -5.27, 11.24),
            new pc.Vec3(-36.35, -6.83, 17.91),
            new pc.Vec3(-39.51, -6.84, 20.43)
        ],
        [
            new pc.Vec3(123.61, -2.25, 93.37),
            new pc.Vec3(122.37, -1.95, 85.86),
            new pc.Vec3(116.13, -1.99, 74.57),
            new pc.Vec3(106.43, -2.07, 61.66),
            new pc.Vec3(96.87, -1.48, 47.82),
            new pc.Vec3(87.24, -0.77, 33.60),
            new pc.Vec3(80.88, 0.14, 21.45),
            new pc.Vec3(72.05, 0.87, 2.31),
            new pc.Vec3(65.60, 1.26, -5.00),
            new pc.Vec3(60.32, 2.22, -12.43),
            new pc.Vec3(57.28, 2.62, -14.92),
            new pc.Vec3(54.74, 2.89, -14.61),
            new pc.Vec3(51.27, 3.45, -12.23),
            new pc.Vec3(42.17, 3.41, -6.06),
            new pc.Vec3(31.58, 2.87, 6.19),
            new pc.Vec3(19.53, 3.15, 22.71),
            new pc.Vec3(18.91, 2.85, 26.44),
            new pc.Vec3(21.28, 3.98, 29.46),
            new pc.Vec3(34.14, 2.70, 47.08),
            new pc.Vec3(39.78, 2.28, 56.65),
            new pc.Vec3(38.28, 2.50, 60.28),
            new pc.Vec3(37.92, 2.25, 64.60),
            new pc.Vec3(38.00, 1.88, 67.99),
            new pc.Vec3(38.41, 1.57, 71.74),
            new pc.Vec3(38.43, 1.35, 75.98),
            new pc.Vec3(40.10, 1.41, 77.76),
            new pc.Vec3(43.90, 1.40, 79.06),
            new pc.Vec3(55.00, 1.25, 82.99),
            new pc.Vec3(61.37, 0.95, 85.06),
            new pc.Vec3(66.49, 0.85, 88.71),
            new pc.Vec3(68.58, 0.90, 91.09),
            new pc.Vec3(69.37, 0.42, 94.69)
        ]
    ];
    this.editPoints = [];
    
    this.dashColor = new pc.Color().fromString('#ff0000'); // RED
    this.dashLength = 2.0;
    this.dashGap = 1.5;
    this.dashWidth = 0.8;
    this.dashThickness = 0.1;
    this.clickDistanceThreshold = 3.0;
    this.verticalOffset = 0.5; // Offset to prevent clipping into the ground
    this.editMode = false;
    this.hovered = false;
    
    // --- RENDER TRAIL ---
    this.trailRoot = new pc.Entity('trail-root');
    this.app.root.addChild(this.trailRoot);
    
    this.trailRenderData = [];

    this.rebuildTrail();

    // --- INTERACTION ---
    this.ray = new pc.Ray();
    if (this.app.mouse) {
        this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
        this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    }
    if (this.app.touch) {
        this.app.touch.on(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
        this.app.touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
    }

    // UI Setup
    this.setupPopup360();
    this.setupEditModeUI();
    this.setupCursorAnnotation();
};

TrailController.prototype.rebuildTrail = function() {
    if (this.trailRenderData) {
        for (const trail of this.trailRenderData) {
            for (const el of trail.glowElements) {
                if (el.parentNode) el.parentNode.removeChild(el);
            }
        }
    }
    const children = this.trailRoot.children.slice();
    children.forEach(c => c.destroy());
    
    this.trailRenderData = [];

    const allPaths = [...this.routes];
    if (this.editPoints.length > 0) {
        allPaths.push(this.editPoints);
    }

    // Agrupa todos os tracinhos num punhado de desenhos em vez de centenas.
    // O grupo é criado uma única vez e reutilizado em reconstruções.
    let batchGroupId = this._batchGroupId ?? null;
    if (batchGroupId === null && this.app.batcher) {
        try {
            batchGroupId = this.app.batcher.addGroup('trails', false, 100).id;
            this._batchGroupId = batchGroupId;
        } catch (e) {
            console.warn('[Trail] Batching indisponível:', e);
        }
    }

    const tmpLook = new pc.Vec3();

    for (const pts of allPaths) {
        const material = new pc.StandardMaterial();
        material.diffuse = this.dashColor;
        material.emissive = this.dashColor;
        material.emissiveIntensity = 1.0;
        material.blendType = pc.BLEND_NONE;
        material.opacity = 1.0;
        material.depthWrite = true;
        material.depthTest = true;
        material.update();
        
        const trail = {
            material: material,
            glowElements: [],
            dashCenters: [],
            pivots: [],
            segments: [],
            chunks: [],          // esferas envolventes para descartar zonas sem as testar
            boundsCenter: new pc.Vec3(),
            boundsRadius: 0,
            isHovered: false
        };
        if (pts.length < 2) continue;
        
        let totalLength = 0;
        const pathData = [];

        // Generate smooth points using Catmull-Rom Spline
        const smoothPoints = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = i === 0 ? pts[0] : pts[i - 1];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = i === pts.length - 2 ? pts[pts.length - 1] : pts[i + 2];
            
            const dist = p1.distance(p2);
            // Dynamic steps based on distance: more steps for longer segments
            const steps = Math.max(4, Math.floor(dist * 2.0));
            
            for (let j = 0; j < steps; j++) {
                const t = j / steps;
                smoothPoints.push(this.getCatmullRomPoint(t, p0, p1, p2, p3));
            }
        }
        smoothPoints.push(pts[pts.length - 1].clone());

        for (let i = 0; i < smoothPoints.length - 1; i++) {
            const p1 = smoothPoints[i];
            const p2 = smoothPoints[i + 1];
            
            trail.segments.push({ a: p1.clone(), b: p2.clone() });

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
            
            // Um tracinho = uma entidade (a rotação do trilho e a do molde
            // são combinadas em vez de usar uma entidade-pai extra)
            const dash = new pc.Entity('dash');
            dash.addComponent('render', {
                type: 'box',
                material: material,
                castShadows: false,
                receiveShadows: false
            });
            this.trailRoot.addChild(dash);
            dash.setPosition(centerPos);
            dash.lookAt(tmpLook.copy(centerPos).add(seg.dir));
            dash.rotateLocal(90, 0, 0);
            dash.setLocalScale(this.dashWidth, this.dashLength, this.dashThickness);

            if (batchGroupId !== null) {
                dash.render.batchGroupId = batchGroupId;
            }

            trail.pivots.push(dash);
            trail.dashCenters.push(centerPos.clone());

        }

        this.buildTrailBounds(trail);
        this.trailRenderData.push(trail);
    }

    if (batchGroupId !== null && this.app.batcher) {
        this.app.batcher.markGroupDirty(batchGroupId);
    }
};

/**
 * Agrupa os segmentos em blocos com esfera envolvente. Ao passar o rato, um
 * bloco inteiro pode ser descartado com um teste barato, em vez de se medir
 * a distância a cada um dos seus segmentos.
 */
TrailController.prototype.buildTrailBounds = function(trail) {
    const CHUNK = 24;
    trail.chunks = [];

    const segs = trail.segments;
    if (segs.length === 0) return;

    for (let s = 0; s < segs.length; s += CHUNK) {
        const end = Math.min(s + CHUNK, segs.length);
        const center = new pc.Vec3();
        for (let k = s; k < end; k++) center.add(segs[k].a);
        center.add(segs[end - 1].b);
        center.mulScalar(1 / (end - s + 1));

        let radius = 0;
        for (let k = s; k < end; k++) {
            radius = Math.max(radius, center.distance(segs[k].a), center.distance(segs[k].b));
        }
        trail.chunks.push({ start: s, end: end, center: center, radius: radius });
    }

    // Esfera envolvente de toda a trilha, para rejeitar a trilha inteira de uma vez
    const all = new pc.Vec3();
    for (const c of trail.chunks) all.add(c.center);
    all.mulScalar(1 / trail.chunks.length);
    let r = 0;
    for (const c of trail.chunks) r = Math.max(r, all.distance(c.center) + c.radius);
    trail.boundsCenter = all;
    trail.boundsRadius = r;
};

TrailController.prototype.getCatmullRomPoint = function(t, p0, p1, p2, p3) {
    const t2 = t * t;
    const t3 = t2 * t;
    
    const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    const z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
    
    return new pc.Vec3(x, y, z);
};

TrailController.prototype.distRaySegment = function(rayOrigin, rayDir, p1, p2) {
    if (!this._tmpV) {
        this._tmpV = new pc.Vec3();
        this._tmpW = new pc.Vec3();
        this._tmpDP = new pc.Vec3();
        this._tmpUsc = new pc.Vec3();
        this._tmpVtc = new pc.Vec3();
    }
    const u = rayDir;
    const v = this._tmpV.sub2(p2, p1);
    const w = this._tmpW.sub2(rayOrigin, p1);

    const a = u.dot(u); 
    const b = u.dot(v);
    const c = v.dot(v);
    const d = u.dot(w);
    const e = v.dot(w);

    const D = a * c - b * b;
    let sc, sN, sD = D;
    let tc, tN, tD = D;

    if (D < 0.0001) {
        sN = 0.0;
        sD = 1.0;
        tN = e;
        tD = c;
    } else {
        sN = (b * e - c * d);
        tN = (a * e - b * d);
        if (sN < 0.0) {
            sN = 0.0;
            tN = e;
            tD = c;
        }
    }

    if (tN < 0.0) {
        tN = 0.0;
        if (-d < 0.0) sN = 0.0;
        else if (-d > a) sN = sD;
        else {
            sN = -d;
            sD = a;
        }
    } else if (tN > tD) {
        tN = tD;
        if ((-d + b) < 0.0) sN = 0;
        else if ((-d + b) > a) sN = sD;
        else {
            sN = (-d + b);
            sD = a;
        }
    }

    sc = (Math.abs(sN) < 0.0001 ? 0.0 : sN / sD);
    tc = (Math.abs(tN) < 0.0001 ? 0.0 : tN / tD);

    this._tmpUsc.copy(u).mulScalar(sc);
    this._tmpVtc.copy(v).mulScalar(tc);
    this._tmpDP.copy(w).add(this._tmpUsc).sub(this._tmpVtc);
    return this._tmpDP.length();
};

TrailController.prototype.onMouseDown = function(e) {
    if (e.button !== pc.MOUSEBUTTON_LEFT) return;
    if (e.event && e.event.target && e.event.target.closest) {
        if (e.event.target.closest('#trail-edit-ui')) return;
        if (e.event.target.closest('.annotation-marker')) return;
    }
    this.handleInteraction(e.x, e.y);
};

TrailController.prototype.onTouchStart = function(e) {
    if (e.event && e.event.target && e.event.target.closest) {
        if (e.event.target.closest('#trail-edit-ui')) return;
        if (e.event.target.closest('.annotation-marker')) return;
    }
    if (e.touches.length > 0) {
        this.handleInteraction(e.touches[0].x, e.touches[0].y);
    }
};

TrailController.prototype.onMouseMove = function(e) {
    if (this.editMode) return;
    
    if (this.cursorAnnotation && e.event) {
        this.cursorAnnotation.style.left = e.event.clientX + 'px';
        this.cursorAnnotation.style.top = e.event.clientY + 'px';
    }

    if (e.event && e.event.target && e.event.target.closest && e.event.target.closest('.annotation-marker')) {
        const marker = e.event.target.closest('.annotation-marker');
        const isEsvarena = marker.classList.contains('esvarena-marker');
        const trailIndex = marker.dataset.trailIndex;
        for (let i = 0; i < this.trailRenderData.length; i++) {
            let shouldHover = false;
            if (isEsvarena) {
                shouldHover = trailIndex !== undefined ? (i === parseInt(trailIndex)) : true;
            }
            this.setTrailHoverState(this.trailRenderData[i], shouldHover);
        }
        this.updateGlobalCursor(false, []);
        this._hoverPending = false;
        return;
    }
    this.queueHoverCheck(e.x, e.y);
};

/**
 * Um rato pode enviar centenas de eventos por segundo. Guardamos apenas a
 * última posição e testamos uma só vez por imagem desenhada.
 */
TrailController.prototype.queueHoverCheck = function(x, y) {
    this._hoverX = x;
    this._hoverY = y;
    this._hoverPending = true;
};

TrailController.prototype.onTouchMove = function(e) {
    if (this.editMode) return;
    if (e.event && e.event.target && e.event.target.closest && e.event.target.closest('.annotation-marker')) {
        const isEsvarena = e.event.target.closest('.esvarena-marker') !== null;
        for (const trail of this.trailRenderData) this.setTrailHoverState(trail, isEsvarena);
        this.updateGlobalCursor(false);
        return;
    }
    if (e.touches.length > 0) {
        this.queueHoverCheck(e.touches[0].x, e.touches[0].y);
    }
};

/**
 * Distância do raio a um ponto — teste barato usado para rejeitar blocos
 * inteiros antes de se medir segmento a segmento.
 */
TrailController.prototype.distRayPoint = function(rayOrigin, rayDir, point) {
    if (!this._tmpRP) this._tmpRP = new pc.Vec3();
    const oc = this._tmpRP.sub2(point, rayOrigin);
    const t = oc.dot(rayDir);
    if (t <= 0) return oc.length();
    return Math.sqrt(Math.max(0, oc.lengthSq() - t * t));
};

/**
 * Devolve true se o raio passa suficientemente perto da trilha para contar
 * como toque. Descarta primeiro a trilha inteira, depois bloco a bloco, e só
 * mede os segmentos dos blocos que sobrevivem.
 */
TrailController.prototype.rayHitsTrail = function(trail, camPos) {
    if (trail.segments.length === 0) return false;

    const origin = this.ray.origin;
    const dir = this.ray.direction;

    // Margem de tolerância: cresce com a distância à câmara, tal como antes.
    const thresholdAt = (dist) => Math.max(this.clickDistanceThreshold, dist * 0.03);

    // 1) Rejeitar a trilha inteira
    const trailCamDist = camPos.distance(trail.boundsCenter) + trail.boundsRadius;
    if (this.distRayPoint(origin, dir, trail.boundsCenter) > trail.boundsRadius + thresholdAt(trailCamDist)) {
        return false;
    }

    // 2) Percorrer apenas os blocos que o raio atravessa
    for (let c = 0; c < trail.chunks.length; c++) {
        const chunk = trail.chunks[c];
        const chunkCamDist = camPos.distance(chunk.center) + chunk.radius;
        const tol = thresholdAt(chunkCamDist);

        if (this.distRayPoint(origin, dir, chunk.center) > chunk.radius + tol) continue;

        for (let k = chunk.start; k < chunk.end; k++) {
            const seg = trail.segments[k];
            const dist = this.distRaySegment(origin, dir, seg.a, seg.b);
            if (dist < thresholdAt(camPos.distance(seg.a))) return true;
        }
    }

    return false;
};

TrailController.prototype.checkHover = function(x, y) {
    if (!this.entity.camera || !this.trailRenderData) return;

    this.entity.camera.screenToWorld(x, y, this.entity.camera.nearClip, this.ray.origin);
    this.entity.camera.screenToWorld(x, y, this.entity.camera.farClip, this.ray.direction);
    this.ray.direction.sub(this.ray.origin).normalize();

    const camPos = this.entity.getPosition();
    let anyHovered = false;
    const hoveredTrailIndices = [];

    for (let i = 0; i < this.trailRenderData.length; i++) {
        const trail = this.trailRenderData[i];
        const isHovered = this.rayHitsTrail(trail, camPos);

        if (isHovered) {
            anyHovered = true;
            hoveredTrailIndices.push(i);
        }
        this.setTrailHoverState(trail, isHovered);
    }

    this.updateGlobalCursor(anyHovered, hoveredTrailIndices);
};

TrailController.prototype.setTrailHoverState = function(trail, isHovered) {
    if (isHovered !== trail.isHovered) {
        trail.isHovered = isHovered;

        trail.material.depthTest = !trail.isHovered;
        trail.material.blendType = trail.isHovered ? pc.BLEND_ADDITIVE : pc.BLEND_NONE;
        trail.material.emissiveIntensity = trail.isHovered ? 4.5 : 1.0;
        trail.material.update();
        
        for (const el of trail.glowElements) {
            el.style.opacity = trail.isHovered ? '1' : '0';
        }
    }
};

TrailController.prototype.updateGlobalCursor = function(anyHovered, hoveredTrailIndices = []) {
    document.body.style.cursor = anyHovered ? 'pointer' : 'default';

    const esvarenaMarkers = document.querySelectorAll('.esvarena-marker');
    esvarenaMarkers.forEach(marker => {
        const trailIndex = marker.dataset.trailIndex;
        if (trailIndex !== undefined) {
            if (hoveredTrailIndices.includes(parseInt(trailIndex))) {
                marker.classList.add('force-hover');
            } else {
                marker.classList.remove('force-hover');
            }
        } else {
            if (anyHovered) {
                marker.classList.add('force-hover');
            } else {
                marker.classList.remove('force-hover');
            }
        }
    });

    if (this.cursorAnnotation) {
        if (anyHovered) {
            this.cursorAnnotation.style.display = 'flex';
            void this.cursorAnnotation.offsetWidth;
            this.cursorAnnotation.style.opacity = '1';
            this.cursorAnnotation.style.transform = 'translate(-50%, -120%) scale(1)';
        } else {
            this.cursorAnnotation.style.opacity = '0';
            this.cursorAnnotation.style.transform = 'translate(-50%, -120%) scale(0.5)';
            setTimeout(() => {
                if (!this.trailRenderData.some(t => t.isHovered) && this.cursorAnnotation) {
                    this.cursorAnnotation.style.display = 'none';
                }
            }, 300);
        }
    }
};

TrailController.prototype.postUpdate = function(dt) {
    if (!this._hoverPending) return;
    this._hoverPending = false;
    this.checkHover(this._hoverX, this._hoverY);
};

TrailController.prototype.handleInteraction = function(x, y) {
    if (this.editMode) {
        // Edit Mode: Add point to trail
        const cameraEntity = this.app.root.findByName('camera');
        if (cameraEntity && cameraEntity.script && cameraEntity.script.cameraCoordinates) {
            const cursor = cameraEntity.script.cameraCoordinates.cursor;
            if (cursor) {
                const newPos = cursor.getPosition().clone();
                // Prevent duplicates or points that are too close
                const isDuplicate = this.editPoints.length > 0 && this.editPoints[this.editPoints.length - 1].distance(newPos) < 0.5;
                if (!isDuplicate && (newPos.length() > 0.1 || this.editPoints.length === 0)) {
                     this.editPoints.push(newPos);
                     this.rebuildTrail();
                     this.updateEditCodeUI();
                }
            }
        }
        return;
    }

    // Normal Mode: Check if trail was clicked
    if (!this.entity.camera || !this.trailRenderData) return;
    
    this.entity.camera.screenToWorld(x, y, this.entity.camera.nearClip, this.ray.origin);
    this.entity.camera.screenToWorld(x, y, this.entity.camera.farClip, this.ray.direction);
    this.ray.direction.sub(this.ray.origin).normalize();

    const camPos = this.entity.getPosition();
    let clickedTrailIndex = -1;
    for (let i = 0; i < this.trailRenderData.length; i++) {
        if (this.rayHitsTrail(this.trailRenderData[i], camPos)) {
            clickedTrailIndex = i;
            break;
        }
    }

    if (clickedTrailIndex !== -1) {
        this.showPopup360(clickedTrailIndex);
    }
};


TrailController.prototype.setupPopup360 = function() {
    this.popup = document.createElement('div');
    this.popup.style.position = 'fixed';
    this.popup.style.top = '0';
    this.popup.style.left = '0';
    this.popup.style.width = '100%';
    this.popup.style.height = '100%';
    this.popup.style.backgroundColor = '#000000';
    this.popup.style.display = 'none';
    this.popup.style.alignItems = 'center';
    this.popup.style.justifyContent = 'center';
    this.popup.style.zIndex = '2000';
    this.popup.style.opacity = '0';
    this.popup.style.transition = 'opacity 0.3s ease';

    const content = document.createElement('div');
    content.style.position = 'relative';
    content.style.width = '90%';
    content.style.maxWidth = '1000px';
    content.style.aspectRatio = '16 / 9';
    content.style.backgroundColor = '#000000';
    content.style.borderRadius = '12px';
    content.style.overflow = 'hidden';
    content.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';
    content.style.border = '1px solid rgba(255,255,255,0.1)';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'center';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '16px';
    closeBtn.style.right = '16px';
    closeBtn.style.background = 'rgba(0,0,0,0.5)';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#fff';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '8px';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.zIndex = '10';
    closeBtn.style.transition = 'background 0.2s ease';
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255,0,0,0.8)');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'rgba(0,0,0,0.5)');
    
    closeBtn.addEventListener('click', () => {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay ? overlay.querySelector('.loading-text') : null;
        
        if (overlay) {
            overlay.style.transition = 'none';
            if (loadingText) loadingText.innerText = "A restaurar ambiente 3D…";
            overlay.classList.remove('hidden');
        }

        this.popup.style.opacity = '0';
        setTimeout(() => { 
            this.popup.style.display = 'none'; 
            const container = this.popup.querySelector('#trail-video-container');
            if (container) container.innerHTML = '';
            
            const gsplat = this.app.root.findByName('gsplat-scene');
            if (gsplat) gsplat.enabled = true;
            
            setTimeout(() => {
                if (overlay) {
                    overlay.style.transition = '';
                    overlay.classList.add('hidden');
                    setTimeout(() => {
                        if (loadingText) loadingText.innerText = "A carregar modelo 3D…";
                    }, 800);
                }
            }, 800);
        }, 300);
    });

    content.innerHTML = `
        <div id="trail-video-container" style="width: 100%; height: 100%;"></div>
    `;
    
    content.appendChild(closeBtn);
    this.popup.appendChild(content);
    document.body.appendChild(this.popup);
};

TrailController.prototype.setupCursorAnnotation = function() {
    this.cursorAnnotation = document.createElement('div');
    this.cursorAnnotation.style.position = 'fixed';
    this.cursorAnnotation.style.pointerEvents = 'none';
    this.cursorAnnotation.style.zIndex = '1500';
    this.cursorAnnotation.style.display = 'none';
    this.cursorAnnotation.style.flexDirection = 'column';
    this.cursorAnnotation.style.alignItems = 'center';
    this.cursorAnnotation.style.gap = '6px';
    this.cursorAnnotation.style.transform = 'translate(-50%, -120%) scale(0.5)';
    this.cursorAnnotation.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
    this.cursorAnnotation.style.opacity = '0';
    
    this.cursorAnnotation.innerHTML = `
        <div class="marker-label" style="margin-top: 0;">Rota 360º</div>
    `;
    
    document.body.appendChild(this.cursorAnnotation);
};

TrailController.prototype.showPopup360 = function(trailIndex) {
    const container = this.popup.querySelector('#trail-video-container');
    if (container) {
        let src = "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Esvarena - 360 - A.mp4";
        if (trailIndex === 1 || trailIndex === '1') {
            src = "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Esvarena - 360 - B.mp4";
        } else if (trailIndex === 2 || trailIndex === '2') {
            src = "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/Esvarena - 360 - C.mp4";
        }
        container.innerHTML = `<iframe src="/video360.html?src=${encodeURIComponent(src)}" style="width: 100%; height: 100%; border: none; background: #000;" allow="xr-spatial-tracking; fullscreen; autoplay"></iframe>`;
    }
    this.popup.style.display = 'flex';
    setTimeout(() => {
        this.popup.style.opacity = '1';
    }, 10);
    
    const gsplat = this.app.root.findByName('gsplat-scene');
    if (gsplat) gsplat.enabled = false;
};

TrailController.prototype.setupEditModeUI = function() {
    // Container for edit mode controls
    this.editUI = document.createElement('div');
    this.editUI.id = 'trail-edit-ui';
    this.editUI.style.position = 'fixed';
    this.editUI.style.bottom = '24px';
    this.editUI.style.left = '50%';
    this.editUI.style.transform = 'translateX(-50%)';
    this.editUI.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent), #05050a';
    this.editUI.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    this.editUI.style.borderRadius = '0px';
    this.editUI.style.padding = '16px';
    this.editUI.style.display = 'none';
    this.editUI.style.flexDirection = 'column';
    this.editUI.style.alignItems = 'flex-start';
    this.editUI.style.gap = '12px';
    this.editUI.style.zIndex = '1000';
    this.editUI.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
    this.editUI.style.fontFamily = "'Inter', -apple-system, sans-serif";
    
    this.editUI.innerHTML = `
        <div style="color: #ffffff; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
            <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%; animation: pulse-ring 1.5s infinite;"></div>
            Modo de Edição de Trilha
        </div>
        <div style="color: rgba(255,255,255,0.7); font-size: 0.8rem;">Clica no mapa para adicionar pontos.</div>
        <textarea id="trail-code-output" readonly style="width: 100%; height: 80px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 8px; font-family: monospace; font-size: 0.75rem; resize: none;"></textarea>
        <div style="display: flex; gap: 10px; width: 100%;">
            <button id="trail-undo-btn" style="flex: 1; background: transparent; color: white; border: 1px solid rgba(255,255,255,0.15); padding: 8px; cursor: pointer; font-size: 0.8rem; transition: background 0.2s;">Desfazer</button>
            <button id="trail-clear-btn" style="flex: 1; background: transparent; color: #ff4444; border: 1px solid rgba(255,0,0,0.3); padding: 8px; cursor: pointer; font-size: 0.8rem; transition: background 0.2s;">Limpar</button>
            <button id="trail-copy-btn" style="flex: 1; background: #ffffff; color: #05050a; border: none; padding: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: opacity 0.2s;">Copiar</button>
        </div>
    `;
    document.body.appendChild(this.editUI);

    // Edit Toggle Checkbox in Dev Menu
    const devTrailEdit = document.getElementById('dev-trail-edit');
    if (devTrailEdit) {
        devTrailEdit.addEventListener('change', (e) => {
            this.editMode = e.target.checked;
            if (this.editMode) {
                this.editUI.style.display = 'flex';
                this.updateEditCodeUI();
            } else {
                this.editUI.style.display = 'none';
            }
        });
    }

    // Button Logic
    this.editUI.querySelector('#trail-undo-btn').addEventListener('click', () => {
        this.editPoints.pop();
        this.rebuildTrail();
        this.updateEditCodeUI();
    });

    this.editUI.querySelector('#trail-clear-btn').addEventListener('click', () => {
        this.editPoints = [];
        this.rebuildTrail();
        this.updateEditCodeUI();
    });

    this.editUI.querySelector('#trail-copy-btn').addEventListener('click', () => {
        const textarea = this.editUI.querySelector('#trail-code-output');
        textarea.select();
        document.execCommand('copy');
        const btn = this.editUI.querySelector('#trail-copy-btn');
        const originalText = btn.innerText;
        btn.innerText = 'Copiado!';
        setTimeout(() => { btn.innerText = originalText; }, 2000);
    });
};

TrailController.prototype.updateEditCodeUI = function() {
    if (!this.editMode) return;
    const textarea = this.editUI.querySelector('#trail-code-output');
    if (!textarea) return;

    let code = '    [\n';
    for (const p of this.editPoints) {
        code += `        new pc.Vec3(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}),\n`;
    }
    code += '    ]';
    textarea.value = code;
    textarea.scrollTop = textarea.scrollHeight;
};
