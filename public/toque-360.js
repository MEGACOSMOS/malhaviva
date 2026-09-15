/* O dedo olha para todos os lados.
 *
 * De origem, o A-Frame só deixa o dedo virar a vista para a esquerda e
 * para a direita; olhar para cima e para baixo ficava entregue ao sensor
 * de movimento do telemóvel — que nas rotas está desligado, para a
 * imagem não fugir a cada abano do aparelho. Ficava-se sem maneira de
 * ver o céu ou o chão.
 *
 * Aqui o arrastar com um dedo passa a puxar a vista nos dois sentidos,
 * com o mesmo peso em ambos: um dedo que atravessa o ecrã de lado a lado
 * dá meia volta, tanto na horizontal como na vertical. Com dois dedos
 * não se olha — esses são para aproximar e afastar.
 *
 * Tem de correr logo a seguir ao A-Frame e antes de a cena nascer, porque
 * é na nascença que cada câmara guarda a sua cópia destes gestos. */
(function () {
    if (!window.AFRAME || !AFRAME.components['look-controls']) return;

    var modelo = AFRAME.components['look-controls'].Component.prototype;
    if (modelo.dedoOlhaParaTodosOsLados) return;

    var MEIA_VOLTA_VERTICAL = Math.PI / 2;

    modelo.onTouchMove = function (evt) {
        if (!this.touchStarted || !this.data.touchEnabled) return;
        var toque = evt.touches[0];
        if (!toque) return;

        // Com dois dedos não se roda: só se acompanha o primeiro, para a
        // vista não dar um salto quando o segundo dedo se levanta.
        if (evt.touches.length !== 1) {
            this.touchStart = { x: toque.pageX, y: toque.pageY };
            return;
        }

        var tela = this.el.sceneEl.canvas;
        var largura = (tela && tela.clientWidth) || window.innerWidth || 1;
        var escala = Math.PI / largura;
        var sentido = this.data.reverseTouchDrag ? 1 : -1;

        var dx = toque.pageX - this.touchStart.x;
        var dy = toque.pageY - this.touchStart.y;

        this.yawObject.rotation.y -= dx * escala * sentido;

        var inclinacao = this.pitchObject;
        inclinacao.rotation.x -= dy * escala * sentido;
        inclinacao.rotation.x = Math.max(-MEIA_VOLTA_VERTICAL, Math.min(MEIA_VOLTA_VERTICAL, inclinacao.rotation.x));

        this.touchStart = { x: toque.pageX, y: toque.pageY };
    };

    modelo.dedoOlhaParaTodosOsLados = true;
})();
