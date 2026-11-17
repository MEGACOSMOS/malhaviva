import * as pc from 'playcanvas';

export const CompassController = pc.createScript('compassController');

// O desvio em graus para alinhar o mapa com a orientação do Google Maps da Imagem 1
CompassController.prototype.NORTH_OFFSET = 3.5;

CompassController.prototype.initialize = function() {
    this.compassNeedle = document.getElementById('compass-needle');
    // O ângulo que a agulha tem agora, para só se lhe mexer quando muda.
    this.shownRotation = null;
};

/**
 * Vira a agulha com a câmara, a cada imagem.
 *
 * Corre depois dos comandos da câmara (vem a seguir a eles na lista dos
 * guiões da câmara, no index.html), por isso lê a câmara já no sítio desta
 * imagem — e a agulha vai com ela, sem transição nenhuma por cima: uma
 * transição deixava-a sempre um pouco atrás quando se roda o bairro.
 */
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
    if (this.shownRotation !== null && Math.abs(target - this.shownRotation) < 0.01) return;
    this.shownRotation = target;
    this.compassNeedle.style.transform = `rotate(${target.toFixed(2)}deg)`;
};
