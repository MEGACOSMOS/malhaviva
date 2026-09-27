import * as pc from 'playcanvas';

export const MapScale = pc.createScript('mapScale');

MapScale.prototype.initialize = function() {
    this.scaleElement = document.getElementById('map-scale');
    if (!this.scaleElement) return;

    this.textElement = this.scaleElement.querySelector('span');
    this.timer = 0;
};

MapScale.prototype.raycastToPlane = function(x, y) {
    const camera = this.entity.camera;
    const rayOrigin = camera.screenToWorld(x, y, camera.nearClip);
    const rayDir = camera.screenToWorld(x, y, camera.farClip).sub(rayOrigin).normalize();
    
    // Intersectar com o plano y=0 (nível aproximado do terreno para efeitos de escala)
    if (rayDir.y !== 0) {
        const t = -rayOrigin.y / rayDir.y;
        if (t > 0) {
            return new pc.Vec3().copy(rayDir).mulScalar(t).add(rayOrigin);
        }
    }
    return null;
}

MapScale.prototype.update = function(dt) {
    if (!this.scaleElement) return;

    // Atualiza a 10 FPS para não pesar
    this.timer += dt;
    if (this.timer < 0.1) return;
    this.timer = 0;

    const camera = this.entity.camera;
    const altitude = Math.max(0.1, this.entity.getPosition().y);
    const fovRad = camera.fov * pc.math.DEG_TO_RAD;
    
    // A largura visível (em metros) no plano do chão, assumindo que a câmara olhasse para baixo
    const viewHeight = 2 * altitude * Math.tan(fovRad / 2);
    const viewWidth = viewHeight * camera.aspectRatio;
    
    const screenWidth = window.innerWidth;
    const distPorPixel = viewWidth / screenWidth;
    
    const dist100px = distPorPixel * 100;

    if (dist100px > 0) {
        const distanciaAlvo = distPorPixel * 80; // Aponta para barras com cerca de 80 pixels
        
        const mag = Math.pow(10, Math.floor(Math.log10(distanciaAlvo)));
        let mantissa = distanciaAlvo / mag;
        
        let niceMantissa = 1;
        if (mantissa >= 5) niceMantissa = 5;
        else if (mantissa >= 2) niceMantissa = 2;
        
        let niceDistance = niceMantissa * mag;
        niceDistance = parseFloat(niceDistance.toPrecision(4)); 
        
        const widthPixels = niceDistance / distPorPixel;
        
        this.scaleElement.style.width = widthPixels.toFixed(0) + 'px';
        if (this.textElement) {
            if (niceDistance >= 1000) {
                this.textElement.innerText = (niceDistance / 1000) + ' km';
            } else {
                this.textElement.innerText = niceDistance + ' m';
            }
        }
        this.scaleElement.style.display = 'flex';
    } else {
        this.scaleElement.style.display = 'none';
    }
};
