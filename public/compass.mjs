import * as pc from 'playcanvas';

export const CompassController = pc.createScript('compassController');

// O desvio em graus para alinhar o mapa com a orientação do Google Maps da Imagem 1
CompassController.prototype.NORTH_OFFSET = 3.5;

CompassController.prototype.initialize = function() {
    this.compassNeedle = document.getElementById('compass-needle');
    // Ângulo mostrado, sem saltos: cresce/decresce continuamente para lá
    // de ±180º, para que a transição CSS nunca dê a volta pelo lado errado.
    this.shownRotation = null;
};

CompassController.prototype.update = function(dt) {
    if (!this.compassNeedle) return;

    // O yaw NÃO pode vir de getEulerAngles().y: a decomposição de Euler do
    // PlayCanvas devolve o Y só entre -90º e 90º (o resto passa para X e Z),
    // e a agulha nunca conseguia apontar para baixo.
    // O vetor "direita" da câmara é sempre horizontal (não há roll) e não
    // degenera mesmo a olhar a pique para baixo: right = (cos yaw, 0, -sin yaw).
    const right = this.entity.right;
    const yaw = Math.atan2(-right.z, right.x) * pc.math.RAD_TO_DEG;

    const target = yaw - this.NORTH_OFFSET;

    if (this.shownRotation === null) {
        this.shownRotation = target;
    } else {
        // Caminho mais curto entre o ângulo mostrado e o novo (-180..180).
        const delta = ((target - this.shownRotation) % 360 + 540) % 360 - 180;
        this.shownRotation += delta;
    }

    this.compassNeedle.style.transform = `rotate(${this.shownRotation}deg)`;
};
