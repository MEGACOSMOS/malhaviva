import {
    math,
    BLEND_NORMAL,
    Color,
    CULLFACE_NONE,
    DualGestureSource,
    Entity,
    FlyController,
    FocusController,
    GamepadSource,
    InputFrame,
    KeyboardMouseSource,
    Mesh,
    MeshInstance,
    MultiTouchSource,
    OrbitController,
    Picker,
    Pose,
    PROJECTION_PERSPECTIVE,
    Quat,
    Script,
    StandardMaterial,
    Vec2,
    Vec3
} from 'playcanvas';

/** @import { CameraComponent, InputController } from 'playcanvas' */

/**
 * @typedef {object} CameraControlsState
 * @property {Vec3} axis - The axis.
 * @property {number} shift - The shift.
 * @property {number} ctrl - The ctrl.
 * @property {number[]} mouse - The mouse.
 * @property {number} touches - The touches.
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();
const tmpQ2 = new Quat();

/**
 * Se a tecla Alt está a ser carregada.
 *
 * O motor conhece o Shift e o Ctrl, mas não o Alt — e é o Alt que aqui
 * faz as setas deixarem de andar e passarem a olhar. Fica portanto por
 * nossa conta, numa escuta só, posta à primeira vez que alguém precise
 * dela.
 *
 * De caminho trava o que o navegador faria com Alt e uma seta, que é ir
 * para a página anterior ou seguinte. Sem isso, quem tentasse olhar para
 * a esquerda saía do bairro.
 *
 * @returns {boolean} Se o Alt está em baixo.
 */
let altEmBaixo = false;
let altEscutado = false;
function altCarregado() {
    if (!altEscutado && typeof window !== 'undefined') {
        altEscutado = true;
        const SETAS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        window.addEventListener('keydown', (e) => {
            altEmBaixo = e.altKey || e.key === 'Alt';
            // O Alt sozinho, no Windows, chama o menu do navegador — e a
            // janela perde o foco, o que apagaria já a seguir a nota de que
            // ele está em baixo. Travando-o aqui, ele fica para nós.
            if (e.key === 'Alt' || (e.altKey && SETAS.indexOf(e.key) >= 0)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            altEmBaixo = e.altKey;
        });
        // Quem sai da janela com o Alt em baixo não o larga cá dentro: sem
        // isto, as setas ficavam a olhar para sempre.
        window.addEventListener('blur', () => { altEmBaixo = false; });
    }
    return altEmBaixo;
}

const pose = new Pose();

const frame = new InputFrame({
    move: [0, 0, 0],
    rotate: [0, 0, 0]
});

/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 * @ignore
 */
export const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

/**
 * @param {number[]} stick - The stick
 * @param {number} low - The low dead zone
 * @param {number} high - The high dead zone
 */
const applyDeadZone = (stick, low, high) => {
    const mag = Math.sqrt(stick[0] * stick[0] + stick[1] * stick[1]);
    if (mag < low) {
        stick.fill(0);
        return;
    }
    const scale = (mag - low) / (high - low);
    stick[0] *= scale / mag;
    stick[1] *= scale / mag;
};

/**
 * Converts screen space mouse deltas to world space pan vector.
 *
 * @param {CameraComponent} camera - The camera component.
 * @param {number} dx - The mouse delta x value.
 * @param {number} dy - The mouse delta y value.
 * @param {number} dz - The world space zoom delta value.
 * @param {Vec3} [out] - The output vector to store the pan result.
 * @returns {Vec3} - The pan vector in world space.
 * @private
 */
const screenToWorld = (camera, dx, dy, dz, out = new Vec3()) => {
    const { system, fov, aspectRatio, horizontalFov, projection, orthoHeight } = camera;
    const { width, height } = system.app.graphicsDevice.clientRect;

    // normalize deltas to device coord space
    out.set(
        -(dx / width) * 2,
        (dy / height) * 2,
        0
    );

    // calculate half size of the view frustum at the current distance
    const halfSize = tmpV2.set(0, 0, 0);
    if (projection === PROJECTION_PERSPECTIVE) {
        const halfSlice = dz * Math.tan(0.5 * fov * math.DEG_TO_RAD);
        if (horizontalFov) {
            halfSize.set(
                halfSlice,
                halfSlice / aspectRatio,
                0
            );
        } else {
            halfSize.set(
                halfSlice * aspectRatio,
                halfSlice,
                0
            );
        }
    } else {
        halfSize.set(
            orthoHeight * aspectRatio,
            orthoHeight,
            0
        );
    }

    // scale by device coord space
    out.mul(halfSize);

    return out;
};

/**
 * @enum {string}
 */
// eslint-disable-next-line no-unused-vars
// Quão depressa a vista apanha o dedo no telemóvel: mais baixo, mais
// acentuados o arranque e a travagem. O caminho todo é sempre o do dedo.
const SUAVIDADE_DO_DEDO = 12.0;

// ─── Aceleração do dedo ───
// Um arrasto lento fica colado ao dedo, para apontar com precisão. Um
// arrasto rápido — o dedo a varrer o ecrã — vira a vista mais do que o
// dedo andou, para dar a volta ao bairro sem arrastar várias vezes. A
// aceleração não espera que o dedo já vá depressa: vê também o quanto a
// velocidade está a crescer e adianta-se, para o varrimento ganhar
// alcance desde o início. As velocidades estão em ecrãs por segundo.
const ACEL_LENTO = 0.8;        // até aqui, colado ao dedo
const ACEL_RAPIDO = 3.5;       // a partir daqui, a aceleração toda
const ACEL_MAXIMA = 2.5;       // quantas vezes mais vira um varrimento
const ACEL_ANTECIPACAO = 0.1;  // segundos que se olha para a frente
const ACEL_SUBIDA = 0.05;      // a aceleração entra depressa...
const ACEL_DESCIDA = 0.15;     // ...e sai com calma, sem solavancos

// ─── Apontar e ir ───
// Um clique (ou um toque) num sítio do bairro leva a câmara até lá: sem
// descer, sem se virar e sem se inclinar, desliza pelo chão na direcção
// dele — à mesma altura e a olhar como olhava — e fica muito mais perto.
// Nunca recua. Com o rato, uma pirâmide branca de bico para baixo, pousada
// sobre um quadrado deitado no chão, mostra antes do clique o sítio aonde
// ele leva. A viagem demora mais ou menos o mesmo, perto ou longe — e por
// isso, quanto mais longe o sítio, mais depressa se anda. Começa devagar e
// acaba devagar.

// Quanto o rato ou o dedo podem mexer, entre carregar e largar, para ainda
// contar como clique e não como arrasto (pontos de ecrã).
const CLIQUE_MEXIDA_RATO = 6;
const CLIQUE_MEXIDA_DEDO = 12;
// Quanto tempo pode durar um clique, em milissegundos. Mais do que isto é
// alguém a segurar o bairro, não a apontar.
const CLIQUE_DURACAO_MAXIMA = 450;

// A duração da viagem, em segundos: a mais curta, e quanto se lhe soma até
// à distância em que deixa de crescer (em metros). Assim uma viagem de dez
// metros anda a uns dez metros por segundo e uma de duzentos a mais de cem.
const VIAGEM_DURACAO_MINIMA = 0.9;
const VIAGEM_DURACAO_EXTRA = 0.6;
const VIAGEM_DISTANCIA_LONGA = 150;

// Quanto se aproxima do sítio em cada clique: do que faltava andar pelo
// chão até ele, fica a faltar só esta fracção.
const VIAGEM_APROXIMACAO = 0.3;

// A câmara não se inclina, e por isso, ao aproximar-se, o sítio desce no
// ecrã. Não chega tão perto que ele fique mais do que isto abaixo do meio
// da vista, em graus: assim nunca sai pelo fundo do ecrã.
const VIAGEM_ABAIXO_DO_MEIO = 20;

// A pirâmide que mostra o sítio: a altura com que se vê no ecrã, em pontos
// (é do mesmo tamanho perto ou longe), e de quanto em quanto tempo se
// pergunta outra vez à placa gráfica que sítio está debaixo do rato, em
// milissegundos.
const PIRAMIDE_PONTOS = 26;
const PIRAMIDE_LEITURA_MS = 80;
// A que altura, em graus, a pirâmide parece estar a ser vista, por muito
// que a câmara olhe para baixo (ver `_atualizarPiramide`).
const PIRAMIDE_ELEVACAO = 25;
// As cores das faces, do verde dos testemunhos: a de cima mais clara, as
// dos lados alternadas, para se perceber que é uma pirâmide e não um
// triângulo.
const PIRAMIDE_CORES = {
    topo: [255, 255, 255],
    clara: [225, 225, 225],
    escura: [160, 160, 160]
};
// O quadrado deitado no chão por baixo da pirâmide: o lado, em relação à
// altura da pirâmide, e a grossura do contorno, em relação ao lado.
const QUADRADO_LADO = 1.3;
const QUADRADO_TRACO = 0.08;
// Para o quadrado se deitar como o chão — numa encosta, num telhado —
// pergunta-se também pelos sítios a esta distância do rato, em pontos de
// ecrã, para a direita e para baixo. Um chão mais inclinado do que
// QUADRADO_INCLINACAO_MAXIMA graus é uma parede ou um engano, e aí o
// quadrado fica deitado a direito.
const QUADRADO_VIZINHOS = 24;
const QUADRADO_INCLINACAO_MAXIMA = 40;

// A que altura fica o chão do bairro, para quando a placa gráfica não diz
// onde se carregou (em metros, no sistema do mapa).
const ALTURA_DO_CHAO = -3;

// Até onde um sítio pode estar para lá da beira do terreno e ainda contar
// como bairro (em metros). Mais longe é o céu ou a paisagem ao fundo, e aí
// o clique não leva a lado nenhum.
const FOLGA_FORA_DO_TERRENO = 25;

/**
 * Começa devagar, anda, e acaba devagar (a curva cúbica de entrada e
 * saída).
 *
 * @param {number} t - De zero a um.
 * @returns {number} De zero a um.
 */
const entradaESaida = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const MobileInputLayout = {
    JOYSTICK_JOYSTICK: 'joystick-joystick',
    JOYSTICK_TOUCH: 'joystick-touch',
    TOUCH_JOYSTICK: 'touch-joystick',
    TOUCH_TOUCH: 'touch-touch'
};

/**
 * Provides orbit, fly and pan camera controls, driven by mouse, touch and gamepad input. Movement
 * and rotation are smoothed with configurable damping, and pitch, yaw and zoom distance can be
 * constrained to ranges. Orbit and fly modes can be toggled individually with
 * {@link CameraControls#enableOrbit} and {@link CameraControls#enableFly}. Use
 * {@link CameraControls#focus}, {@link CameraControls#look} and {@link CameraControls#reset} to
 * frame a point of interest programmatically.
 *
 * Attach the script to an entity with a {@link CameraComponent}.
 *
 * @example
 * cameraEntity.addComponent('script');
 * cameraEntity.script.create(CameraControls, {
 *     properties: {
 *         focusPoint: new Vec3(0, 1, 0),
 *         enableFly: false
 *     }
 * });
 * @category Controllers
 */
class CameraControls extends Script {
    static scriptName = 'cameraControls';

    /**
     * @type {CameraComponent}
     * @private
     */
    // @ts-ignore
    _camera;

    /**
     * @type {boolean}
     * @private
     */
    _enableOrbit = true;

    /**
     * @type {boolean}
     * @private
     */
    _enableFly = true;

    /**
     * @type {number}
     * @private
     */
    _startZoomDist = 0;

    /**
     * @type {Vec2}
     * @private
     */
    _pitchRange = new Vec2(-360, 360);

    /**
     * @type {Vec2}
     * @private
     */
    _yawRange = new Vec2(-360, 360);

    /**
     * @type {Vec2}
     * @private
     */
    _zoomRange = new Vec2(0.01, 0);

    /**
     * @type {KeyboardMouseSource}
     * @private
     */
    _desktopInput = new KeyboardMouseSource();

    /**
     * @type {MultiTouchSource}
     * @private
     */
    _orbitMobileInput = new MultiTouchSource();

    /**
     * @type {DualGestureSource}
     * @private
     */
    _flyMobileInput = new DualGestureSource();

    /**
     * @type {GamepadSource}
     * @private
     */
    _gamepadInput = new GamepadSource();

    /**
     * @type {FlyController}
     * @private
     */
    _flyController = new FlyController();

    /**
     * @type {OrbitController}
     * @private
     */
    _orbitController = new OrbitController();

    /**
     * @type {FocusController}
     * @private
     */
    _focusController = new FocusController();

    /**
     * @type {InputController}
     * @private
     */
    // @ts-ignore
    _controller;

    /**
     * @type {Pose}
     * @private
     */
    _pose = new Pose();

    /**
     * @type {'orbit' | 'fly' | 'focus'}
     * @private
     */
    // @ts-ignore
    _mode;

    /**
     * @type {CameraControlsState}
     * @private
     */
    /**
     * O que as setas estão a pedir, somado à parte do WASD.
     *
     * Fica à parte porque as setas têm dois trabalhos — andar, ou olhar
     * com o Alt em baixo — e só assim se lhes pode dar um ou outro sem
     * partir a soma.
     *
     * @type {Vec3}
     * @private
     */
    _setas = new Vec3();

    /**
     * A viagem em curso, de um clique no bairro até ao sítio apontado, ou
     * nada. Ver `_irAte`.
     *
     * @type {{de: Vec3, para: Vec3, inclinacao0: number, inclinacao1: number,
     *         rumo0: number, rumo1: number, t: number, duracao: number}|null}
     * @private
     */
    _viagem = null;

    /**
     * O leitor de profundidade que diz em que sítio do bairro se carregou.
     * Nasce no primeiro clique.
     *
     * @type {Picker|null}
     * @private
     */
    _leitorDoSitio = null;

    /**
     * A pirâmide branca que mostra o sítio aonde o clique leva, e o que se
     * sabe do rato para a pôr lá. Nasce na primeira vez que faz falta.
     *
     * @type {{entidade: Entity, material: StandardMaterial}|null}
     * @private
     */
    _piramide = null;

    /**
     * @private
     */
    _apontar = {
        // Onde está o rato, na tela, e se está em cima dela.
        x: 0,
        y: 0,
        dentro: false,
        // Com um botão em baixo o rato está a arrastar, não a apontar.
        aArrastar: false,
        // Mexeu-se desde a última pergunta à placa gráfica.
        mexeu: false,
        aLer: false,
        ultimaLeitura: 0,
        // O sítio debaixo do rato, ou nada (céu, fora do bairro), e para
        // onde aponta o chão lá — e para onde aponta o quadrado, que vai
        // atrás dele devagar.
        sitio: null,
        chao: new Vec3(0, 1, 0),
        chaoDoQuadrado: new Vec3(0, 1, 0),
        // Onde a pirâmide está desenhada, e quanto se vê (de zero a um).
        onde: new Vec3(),
        opacidade: 0,
        tempo: 0,
        // Onde a câmara estava na última pergunta: se ela andar, o sítio
        // debaixo do rato muda, mesmo com o rato parado.
        camara: new Vec3(),
        angulos: new Vec3()
    };

    _state = {
        axis: new Vec3(),
        shift: 0,
        ctrl: 0,
        mouse: [0, 0, 0],
        touches: 0
    };

    /**
     * Enable fly camera controls.
     *
     * @attribute
     * @title Enable Fly
     * @type {boolean}
     * @default true
     */
    set enableFly(enable) {
        this._enableFly = enable;

        if (!this._enableFly && this._mode === 'fly') {
            this._setMode('orbit');
        }
    }

    get enableFly() {
        return this._enableFly;
    }

    /**
     * Enable orbit camera controls.
     *
     * @attribute
     * @title Enable Orbit
     * @type {boolean}
     * @default true
     */
    set enableOrbit(enable) {
        this._enableOrbit = enable;

        if (!this._enableOrbit && this._mode === 'orbit') {
            this._setMode('fly');
        }
    }

    get enableOrbit() {
        return this._enableOrbit;
    }

    /**
     * Enable panning.
     *
     * @attribute
     * @title Enable Panning
     * @type {boolean}
     */
    enablePan = true;

    /**
     * The focus damping. A higher value means more damping. A value of 0 means no damping.
     * The damping is applied to the orbit mode.
     *
     * @attribute
     * @title Focus Damping
     * @type {number}
     * @default 0.98
     */
    set focusDamping(damping) {
        this._focusController.focusDamping = damping;
    }

    get focusDamping() {
        return this._focusController.focusDamping;
    }

    /**
     * The focus point.
     *
     * @attribute
     * @title Focus Point
     * @type {Vec3}
     * @default [0, 0, 0]
     */
    set focusPoint(point) {
        const position = this._camera.entity.getPosition();
        this._startZoomDist = position.distance(point);
        this._controller.attach(this._pose.look(position, point), false);
    }

    get focusPoint() {
        return this._pose.getFocus(tmpV1);
    }

    /**
     * The move damping. In the range 0 to 1, where a value of 0 means no damping and 1 means full
     * damping. The damping is applied to the fly mode and the orbit mode when panning.
     *
     * @attribute
     * @title Move Damping
     * @type {number}
     * @default 0.98
     */
    set moveDamping(damping) {
        this._flyController.moveDamping = damping;
    }

    get moveDamping() {
        return this._flyController.moveDamping;
    }

    /**
     * The fly move speed relative to the scene size.
     *
     * @attribute
     * @title Move Speed
     * @type {number}
     */
    moveSpeed = 10;

    /**
     * The fast fly move speed relative to the scene size.
     *
     * @attribute
     * @title Move Fast Speed
     * @type {number}
     */
    moveFastSpeed = 20;

    /**
     * The slow fly move speed relative to the scene size.
     *
     * @attribute
     * @title Move Slow Speed
     * @type {number}
     */
    moveSlowSpeed = 5;

    /**
     * The rotate damping. In the range 0 to 1, where a value of 0 means no damping and 1 means full
     * damping. The damping is applied to both the fly and orbit modes.
     *
     * @attribute
     * @title Rotate Damping
     * @type {number}
     * @default 0.98
     */
    set rotateDamping(damping) {
        this._flyController.rotateDamping = damping;
        this._orbitController.rotateDamping = damping;
    }

    get rotateDamping() {
        return this._orbitController.rotateDamping;
    }

    /**
     * The rotation speed.
     *
     * @attribute
     * @title Rotate Speed
     * @type {number}
     */
    rotateSpeed = 0.2;

    /**
     * The rotation joystick sensitivity.
     *
     * @attribute
     * @title Rotate Joystick Sensitivity
     * @type {number}
     */
    rotateJoystickSens = 2;

    /**
     * The zoom damping. In the range 0 to 1, where a value of 0 means no damping and 1 means full
     * damping. The damping is applied to the orbit mode.
     *
     * @attribute
     * @title Zoom Damping
     * @type {number}
     * @default 0.98
     */
    set zoomDamping(damping) {
        this._orbitController.zoomDamping = damping;
    }

    get zoomDamping() {
        return this._orbitController.zoomDamping;
    }

    /**
     * The touch zoom pinch sensitivity.
     *
     * @attribute
     * @title Zoom
     * @type {number}
     */
    zoomPinchSens = 5;

    /**
     * The zoom range.
     *
     * @attribute
     * @title Zoom Range
     * @type {Vec2}
     * @default [0.01, 0]
     */
    set zoomRange(range) {
        this._zoomRange.x = range.x;
        this._zoomRange.y = range.y <= range.x ? Infinity : range.y;
        this._orbitController.zoomRange = this._zoomRange;
    }

    get zoomRange() {
        return this._zoomRange;
    }

    /**
     * The maximum distance from the origin.
     *
     * @attribute
     * @title Max Distance
     * @type {number}
     */
    maxDistance = 800;

    /**
     * Where the camera is allowed to be, horizontally. Follows the shape of the
     * mapped terrain rather than a rectangle around it. While unset, the older
     * spherical `maxDistance` limit is used instead.
     *
     * @type {{contains: (x: number, z: number) => boolean,
     *         distanceTo: (x: number, z: number) => number}|null}
     */
    _playArea = null;

    /**
     * The play area proper only engages once the camera has reached it. Until
     * then the camera is held at whatever distance it opened at, so a start
     * position outside the terrain keeps working without letting the camera
     * drift off into empty space.
     *
     * @type {boolean}
     */
    _boundsArmed = false;

    /**
     * How far from the terrain the camera may sit before it first arrives.
     * Measured from the opening viewpoint. Null until the first frame.
     *
     * @type {number|null}
     * @private
     */
    _entryLimit = null;

    /** @type {number} @private */
    _lastInsideX = 0;

    /** @type {number} @private */
    _lastInsideZ = 0;

    /** @type {boolean} @private */
    _lastInsideValid = false;

    /**
     * A cúpula do céu, que é quem manda nos limites quando existe.
     *
     * @type {{limites: () => object|null}|null}
     * @private
     */
    _cupula = null;

    /**
     * A folga entre a câmara e a parede da cúpula, em metros. Encostar
     * mesmo à parede punha a fotografia do céu à distância de um palmo, e
     * vê-se-lhe o grão.
     *
     * @type {number}
     */
    margemDaCupula = 10;

    /**
     * Se a câmara é travada quando chega ao fim do mundo.
     *
     * Desligada: não há parede, tecto nem chão — anda-se para onde se
     * quiser, incluindo por baixo do terreno e para lá do céu. As medidas
     * da cúpula continuam a ser lidas e as contas continuam todas de pé;
     * basta voltar a pôr isto verdadeiro para o mundo ter fim outra vez.
     *
     * @attribute
     * @title Travagem
     * @type {boolean}
     */
    travagem = false;

    /**
     * Diz à câmara onde estão as paredes da cúpula.
     *
     * @param {{limites: () => object|null}} ceu - O céu do bairro.
     */
    setCupula(ceu) {
        this._cupula = ceu || null;
    }

    /**
     * As medidas da cúpula neste instante, ou nada se ela estiver
     * desligada — nesse caso valem os limites antigos, os do terreno.
     *
     * @returns {object|null} As medidas.
     * @private
     */
    _medidasDaCupula() {
        // A página diz-lhe qual é o céu mal ele nasce; se por alguma razão
        // isso ainda não aconteceu, procura-o onde ele está sempre.
        const ceu = this._cupula ||
            (typeof window !== 'undefined' ? window.ceu : null);
        if (!ceu || typeof ceu.limites !== 'function') {
            return null;
        }
        try {
            return ceu.limites();
        } catch (e) {
            return null;
        }
    }

    /**
     * Até onde a câmara pode descer.
     *
     * @returns {number} A altura mínima.
     * @private
     */
    _alturaMinima() {
        if (!this.travagem) {
            return -Infinity;
        }
        const cupula = this._medidasDaCupula();
        // A folga vale para as paredes e para a abóbada, onde encostar
        // deixaria a fotografia à distância de um palmo. No chão não: aí o
        // que se quer é poder descer até às ruas como sempre se desceu.
        return cupula ? Math.max(1, cupula.chao) : 1;
    }

    /**
     * Até onde a câmara pode subir.
     *
     * @returns {number} A altura máxima.
     * @private
     */
    _alturaMaxima() {
        if (!this.travagem) {
            return Infinity;
        }
        const cupula = this._medidasDaCupula();
        return cupula ? cupula.topo - this.margemDaCupula : 63.28;
    }

    /**
     * A que distância do eixo da cúpula está a parede, à altura dada.
     *
     * Abaixo da barriga a parede sobe a direito; acima dela é uma abóbada,
     * e vai-se fechando até ao alto.
     *
     * @param {object} cupula - As medidas da cúpula.
     * @param {number} altura - A altura a que se está.
     * @returns {number} O raio da parede a essa altura.
     * @private
     */
    _paredeA(cupula, altura) {
        const acima = altura - cupula.barriga;
        if (acima <= 0) {
            return cupula.raio;
        }
        const sobra = cupula.raio * cupula.raio - acima * acima;
        return sobra > 0 ? Math.sqrt(sobra) : 0;
    }

    /**
     * Restricts the camera to the shape of the mapped terrain.
     *
     * @param {{contains: (x: number, z: number) => boolean,
     *          distanceTo: (x: number, z: number) => number}} area - Play area.
     */
    setPlayArea(area) {
        this._playArea = area;
        this._boundsArmed = false;
        this._entryLimit = null;
        this._lastInsideValid = false;
    }

    /**
     * @param {number} x - World X.
     * @param {number} z - World Z.
     * @returns {boolean} Whether the camera may stand here.
     * @private
     */
    _positionAllowed(x, z) {
        if (this._boundsArmed) {
            return this._playArea.contains(x, z);
        }
        return this._playArea.distanceTo(x, z) <= this._entryLimit;
    }

    /**
     * The zoom speed relative to the scene size.
     *
     * @attribute
     * @title Zoom Speed
     * @type {number}
     */
    zoomSpeed = 0.0006;

    /**
     * The pitch range. In the range -360 to 360 degrees. The pitch range is applied to the fly mode
     * and the orbit mode.
     *
     * @attribute
     * @title Pitch Range
     * @type {Vec2}
     * @default [-360, 360]
     */
    set pitchRange(range) {
        this._pitchRange.x = math.clamp(range.x, -360, 360);
        this._pitchRange.y = math.clamp(range.y, -360, 360);
        this._flyController.pitchRange = this._pitchRange;
        this._orbitController.pitchRange = this._pitchRange;
    }

    get pitchRange() {
        return this._pitchRange;
    }

    /**
     * The yaw range. In the range -360 to 360 degrees. The pitch range is applied to the fly mode
     * and the orbit mode.
     *
     * @attribute
     * @title Yaw Range
     * @type {Vec2}
     * @default [-360, 360]
     */
    set yawRange(range) {
        this._yawRange.x = math.clamp(range.x, -360, 360);
        this._yawRange.y = math.clamp(range.y, -360, 360);
        this._flyController.yawRange = this._yawRange;
        this._orbitController.yawRange = this._yawRange;
    }

    get yawRange() {
        return this._yawRange;
    }

    /**
     * The joystick event name for the UI position for the base and stick elements.
     * The event name is appended with the side: 'left' or 'right'.
     *
     * @attribute
     * @title Joystick Base Event Name
     * @type {string}
     */
    joystickEventName = 'joystick';

    /**
     * The layout of the mobile input. The layout can be one of the following:
     *
     * - `joystick-joystick`: Two virtual joysticks.
     * - `joystick-touch`: One virtual joystick and one touch.
     * - `touch-joystick`: One touch and one virtual joystick.
     * - `touch-touch`: Two touches.
     *
     * Default is `joystick-touch`.
     *
     * @attribute
     * @title Use Virtual Gamepad
     * @type {MobileInputLayout}
     * @default joystick-touch
     */
    set mobileInputLayout(layout) {
        if (!/(?:joystick|touch)-(?:joystick|touch)/.test(layout)) {
            console.warn(`CameraControls: invalid mobile input layout: ${layout}`);
            return;
        }
        this._flyMobileInput.layout = layout;
    }

    get mobileInputLayout() {
        return this._flyMobileInput.layout;
    }

    /**
     * The gamepad dead zone.
     *
     * @attribute
     * @title Gamepad Dead Zone
     * @type {Vec2}
     */
    gamepadDeadZone = new Vec2(0.3, 0.6);

    constructor({ app, entity, ...args }) {
        super({ app, entity, ...args });
        if (!this.entity.camera) {
            console.error('CameraControls: camera component not found');
            return;
        }
        this._camera = this.entity.camera;

        // set orbit controller defaults
        this._orbitController.zoomRange = new Vec2(0.01, Infinity);

        // attach input
        this._desktopInput.attach(this.app.graphicsDevice.canvas);
        this._orbitMobileInput.attach(this.app.graphicsDevice.canvas);
        this._flyMobileInput.attach(this.app.graphicsDevice.canvas);
        this._gamepadInput.attach(this.app.graphicsDevice.canvas);

        // Apontar e ir: um clique no bairro leva a câmara até lá.
        this._escutarCliques(this.app.graphicsDevice.canvas);

        // Native wheel event for FOV Zoom - Attaching to window with capture to bypass engine suppression
        if (typeof window !== 'undefined') {
            window.addEventListener('wheel', (e) => {
                if (!this._initialFov) {
                    this._initialFov = this._camera?.fov || 60;
                    this._targetFov = this._initialFov;
                }
                
                const delta = Math.sign(e.deltaY);
                if (delta !== 0) {
                    // e.deltaY > 0 is scroll down (zoom out / increase FOV)
                    // e.deltaY < 0 is scroll up (zoom in / decrease FOV)
                    this._targetFov += delta * 5; 
                    this._targetFov = Math.max(15, Math.min(this._initialFov, this._targetFov));
                }
            }, { passive: true, capture: true });
        }

        // expose ui events
        this._flyMobileInput.on('joystick:position:left', ([bx, by, sx, sy]) => {
            if (this._mode !== 'fly') {
                return;
            }
            this.app.fire(`${this.joystickEventName}:left`, bx, by, sx, sy);
        });
        this._flyMobileInput.on('joystick:position:right', ([bx, by, sx, sy]) => {
            if (this._mode !== 'fly') {
                return;
            }
            this.app.fire(`${this.joystickEventName}:right`, bx, by, sx, sy);
        });

        // pose
        const startPos = this._camera.entity.getPosition();
        const startTarget = new Vec3().copy(this._camera.entity.forward).mulScalar(200).add(startPos);
        this._pose.look(startPos, startTarget);

        // mode
        this._setMode('orbit');

        // state
        this.on('state', () => {
            // discard inputs
            this._desktopInput.read();
            this._orbitMobileInput.read();
            this._flyMobileInput.read();
            this._gamepadInput.read();
        });

        // destroy
        this.on('destroy', this._destroy, this);
    }

    /**
     * @private
     */
    _destroy() {
        this._desktopInput.destroy();
        this._orbitMobileInput.destroy();
        this._flyMobileInput.destroy();
        this._gamepadInput.destroy();

        this._flyController.destroy();
        this._orbitController.destroy();

        if (this._largarCliques) {
            this._largarCliques();
        }
    }

    /**
     * Ouve o rato e os dedos em cima do bairro.
     *
     * O rato a passar por cima diz onde pôr a pirâmide. Um clique leva a
     * câmara: conta como clique o que se larga depressa e quase no mesmo
     * sítio em que se carregou, com o botão esquerdo, sem Ctrl, Shift nem
     * Alt, e com um dedo só do princípio ao fim — dois dedos são pinça ou
     * deslize, nunca um clique. Os marcadores e os menus estão por cima do
     * bairro e ficam-lhe com o rato; aqui só chega o que é do bairro, e o
     * rato que passa para cima deles sai do bairro (e a pirâmide some).
     *
     * @param {HTMLCanvasElement} tela - A tela onde o bairro é desenhado.
     * @private
     */
    _escutarCliques(tela) {
        /** @type {Map<number, {x: number, y: number, t: number}>} */
        const pousados = new Map();
        let variosDedos = false;
        const apontar = this._apontar;

        // Só o rato aponta: um dedo não passa por cima de nada sem tocar.
        const aoMexer = (e) => {
            if (e.pointerType !== 'mouse') {
                return;
            }
            const caixa = tela.getBoundingClientRect();
            apontar.x = e.clientX - caixa.left;
            apontar.y = e.clientY - caixa.top;
            apontar.dentro = true;
            apontar.aArrastar = e.buttons !== 0;
            apontar.mexeu = true;
        };

        const aoPousar = (e) => {
            if (pousados.size === 0) {
                variosDedos = false;
            }
            pousados.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
            if (pousados.size > 1) {
                variosDedos = true;
            }
            if (e.pointerType === 'mouse') {
                apontar.aArrastar = true;
            }
        };

        const aoLargar = (e) => {
            if (e.pointerType === 'mouse') {
                aoMexer(e);
                apontar.aArrastar = false;
            }
            const inicio = pousados.get(e.pointerId);
            pousados.delete(e.pointerId);
            if (!inicio || variosDedos) {
                return;
            }
            if (e.pointerType === 'mouse' && e.button !== 0) {
                return;
            }
            if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) {
                return;
            }
            const mexida = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
            const limite = e.pointerType === 'mouse' ? CLIQUE_MEXIDA_RATO : CLIQUE_MEXIDA_DEDO;
            if (mexida > limite || performance.now() - inicio.t > CLIQUE_DURACAO_MAXIMA) {
                return;
            }
            this._cliqueNoBairro(e.clientX, e.clientY);
        };

        // O navegador tirou o dedo ao site (para rolar, para um gesto dele):
        // o que ia a meio já não é um clique.
        const aoDesistir = (e) => {
            pousados.delete(e.pointerId);
            variosDedos = true;
            if (e.pointerType === 'mouse') {
                apontar.aArrastar = false;
            }
        };

        const aoSair = (e) => {
            if (e.pointerType === 'mouse') {
                apontar.dentro = false;
            }
        };

        tela.addEventListener('pointerdown', aoPousar);
        tela.addEventListener('pointerup', aoLargar);
        tela.addEventListener('pointercancel', aoDesistir);
        tela.addEventListener('pointermove', aoMexer);
        tela.addEventListener('pointerleave', aoSair);

        this._largarCliques = () => {
            tela.removeEventListener('pointerdown', aoPousar);
            tela.removeEventListener('pointerup', aoLargar);
            tela.removeEventListener('pointercancel', aoDesistir);
            tela.removeEventListener('pointermove', aoMexer);
            tela.removeEventListener('pointerleave', aoSair);
        };
    }

    /**
     * Se, neste momento, apontar para o bairro leva a algum lado.
     *
     * Não se vai a lado nenhum com os óculos postos, nem com as
     * ferramentas de medir ou de desenhar trilhos ligadas no menu de
     * desenvolvedor — aí o clique é delas.
     *
     * @returns {boolean} Se leva.
     * @private
     */
    _podeApontar() {
        if (!this.enabled || this.app.xr?.active) {
            return false;
        }
        if (typeof document !== 'undefined') {
            if (document.body.classList.contains('em-cartao')) {
                return false;
            }
            const medir = document.getElementById('dev-measure-mode');
            const trilhos = document.getElementById('dev-trail-edit');
            if ((medir && medir.checked) || (trilhos && trilhos.checked)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Carregou-se num ponto do bairro: descobre-se que sítio é, e vai-se lá.
     *
     * @param {number} x - Onde se carregou, em pontos da janela.
     * @param {number} y - Onde se carregou, em pontos da janela.
     * @private
     */
    _cliqueNoBairro(x, y) {
        if (!this._podeApontar()) {
            return;
        }
        const caixa = this.app.graphicsDevice.canvas.getBoundingClientRect();
        this._sitioEm(x - caixa.left, y - caixa.top).then((sitio) => {
            if (sitio) {
                this._irAte(sitio);
            }
        });
    }

    /**
     * O sítio do bairro que está num ponto do ecrã, ou nada se ali só
     * houver céu.
     *
     * Pergunta-se à placa gráfica a que distância está o que ela desenhou
     * nesse ponto — é a maneira de acertar no telhado, na rua ou na encosta
     * que lá está de facto. A pirâmide sai de cena enquanto se pergunta,
     * para não ser ela a resposta. Se a placa não souber, vale o chão do
     * bairro, um plano à altura de ALTURA_DO_CHAO.
     *
     * @param {number} px - Na tela, da esquerda.
     * @param {number} py - Na tela, de cima.
     * @returns {Promise<Vec3|null>} O sítio.
     * @private
     */
    _sitioEm(px, py) {
        const noChao = () => this._sitioValido(this._sitioNoChao(px, py));
        const ler = this._prepararLeitura();
        if (!ler) {
            return Promise.resolve(noChao());
        }
        return ler(px, py)
        .then(ponto => (ponto ? this._sitioValido(ponto) : noChao()))
        .catch(() => noChao());
    }

    /**
     * Manda a placa gráfica desenhar o bairro para o leitor de
     * profundidade, e devolve com que se lê, depois, o sítio que está em
     * cada ponto do ecrã — tantos pontos quantos se quiser, desta mesma
     * vez. Ou nada, se a placa não o souber fazer.
     *
     * A um quarto da resolução chega para acertar num sítio, e poupa a
     * placa gráfica. A pirâmide e o quadrado saem de cena enquanto se
     * desenha, para não serem eles a resposta.
     *
     * @returns {((px: number, py: number) => Promise<Vec3|null>)|null} O
     * leitor.
     * @private
     */
    _prepararLeitura() {
        const tela = this.app.graphicsDevice.canvas;
        const ESCALA = 0.25;
        const largura = Math.max(1, Math.floor(tela.clientWidth * ESCALA));
        const altura = Math.max(1, Math.floor(tela.clientHeight * ESCALA));
        const marcas = this._piramide ?
            [this._piramide.entidade, this._piramide.quadrado].filter(e => e.enabled) : [];

        try {
            if (!this._leitorDoSitio) {
                this._leitorDoSitio = new Picker(this.app, largura, altura, true);
            } else if (this._leitorDoSitio.width !== largura || this._leitorDoSitio.height !== altura) {
                this._leitorDoSitio.resize(largura, altura);
            }
            marcas.forEach((e) => { e.enabled = false; });
            this._leitorDoSitio.prepare(this._camera, this.app.scene);
        } catch (e) {
            return null;
        } finally {
            marcas.forEach((e) => { e.enabled = true; });
        }

        const leitor = this._leitorDoSitio;
        return (px, py) => {
            const x = math.clamp(Math.floor(px * ESCALA), 0, largura - 1);
            const y = math.clamp(Math.floor(py * ESCALA), 0, altura - 1);
            return leitor.getWorldPointAsync(x, y).then(ponto => (ponto ? ponto.clone() : null));
        };
    }

    /**
     * Como `_sitioEm`, e também para que lado está virado o chão nesse
     * sítio: pergunta-se pelos pontos um pouco à direita e um pouco abaixo,
     * e o chão é o plano que passa pelos três. Se algum faltar, ou o chão
     * sair mais inclinado do que QUADRADO_INCLINACAO_MAXIMA, fica a direito.
     *
     * @param {number} px - Na tela, da esquerda.
     * @param {number} py - Na tela, de cima.
     * @returns {Promise<{sitio: Vec3|null, chao: Vec3}>} O sítio, e para
     * onde aponta o chão lá (para cima, se não se souber).
     * @private
     */
    _sitioEChaoEm(px, py) {
        const aDireito = () => new Vec3(0, 1, 0);
        const noChao = () => ({ sitio: this._sitioValido(this._sitioNoChao(px, py)), chao: aDireito() });
        const ler = this._prepararLeitura();
        if (!ler) {
            return Promise.resolve(noChao());
        }
        return Promise.all([
            ler(px, py),
            ler(px + QUADRADO_VIZINHOS, py),
            ler(px, py + QUADRADO_VIZINHOS)
        ]).then(([meio, direita, baixo]) => {
            if (!meio) {
                return noChao();
            }
            let chao = aDireito();
            if (direita && baixo) {
                const lado = new Vec3().sub2(direita, meio);
                const fundo = new Vec3().sub2(baixo, meio);
                const normal = new Vec3().cross(lado, fundo);
                if (normal.y < 0) {
                    normal.mulScalar(-1);
                }
                if (normal.length() > 1e-6) {
                    normal.normalize();
                    if (Math.acos(math.clamp(normal.y, -1, 1)) * math.RAD_TO_DEG <= QUADRADO_INCLINACAO_MAXIMA) {
                        chao = normal;
                    }
                }
            }
            return { sitio: this._sitioValido(meio), chao };
        }).catch(() => noChao());
    }

    /**
     * Onde o raio que sai da câmara por um ponto do ecrã bate no chão do
     * bairro, ou nada se o raio for para o céu.
     *
     * @param {number} px - Na tela, da esquerda.
     * @param {number} py - Na tela, de cima.
     * @returns {Vec3|null} O sítio.
     * @private
     */
    _sitioNoChao(px, py) {
        const origem = this._camera.screenToWorld(px, py, this._camera.nearClip, new Vec3());
        const direcao = this._camera.screenToWorld(px, py, this._camera.farClip, new Vec3()).sub(origem).normalize();
        if (direcao.y > -0.01) {
            return null;
        }
        const t = (ALTURA_DO_CHAO - origem.y) / direcao.y;
        return t > 0 ? origem.add(direcao.mulScalar(t)) : null;
    }

    /**
     * Deixa passar só os sítios que são bairro: o céu e a paisagem ao
     * fundo também são desenhados, mas não são sítio aonde se vá.
     *
     * @param {Vec3|null} sitio - O sítio.
     * @returns {Vec3|null} O mesmo sítio, ou nada.
     * @private
     */
    _sitioValido(sitio) {
        if (!sitio) {
            return null;
        }
        const camara = this._pose.position;
        if (sitio.y >= camara.y) {
            return null;
        }
        if (this._playArea && typeof this._playArea.distanceTo === 'function') {
            const fora = this._playArea.contains(sitio.x, sitio.z) ? 0 : this._playArea.distanceTo(sitio.x, sitio.z);
            if (!(fora <= FOLGA_FORA_DO_TERRENO)) {
                return null;
            }
        }
        return sitio;
    }

    /**
     * Põe a câmara a caminho de um sítio do bairro.
     *
     * A câmara não desce, não se vira e não se inclina: fica à mesma
     * altura e a olhar como olhava, e desliza pelo chão na direcção do
     * sítio — de lado, o bastante para o ter à frente, e para a frente até
     * só faltar VIAGEM_APROXIMACAO do caminho. Nunca recua: com o sítio já
     * perto, só desliza de lado. E não chega tão perto que o sítio fique
     * mais de VIAGEM_ABAIXO_DO_MEIO graus abaixo do meio da vista.
     *
     * @param {Vec3} sitio - Para onde ir.
     * @private
     */
    _irAte(sitio) {
        const posicao = this._pose.position;
        const angulos = this._pose.angles;

        let inclinacao = angulos.x;
        while (inclinacao > 180) inclinacao -= 360;
        while (inclinacao < -180) inclinacao += 360;

        // Para onde se olha continua igual; o que conta é quanto o sítio
        // está à frente, nessa direcção, pelo chão.
        const rumo = angulos.y * math.DEG_TO_RAD;
        const frenteX = -Math.sin(rumo);
        const frenteZ = -Math.cos(rumo);
        const aFrente = (sitio.x - posicao.x) * frenteX + (sitio.z - posicao.z) * frenteZ;
        const desnivel = Math.max(0.5, posicao.y - sitio.y);

        // Fica a faltar só uma fracção do caminho — mas não tão perto que
        // o sítio escorregue para o fundo do ecrã, e nunca para trás.
        const olharMaisBaixo = Math.min(89, Math.max(0, -inclinacao) + VIAGEM_ABAIXO_DO_MEIO);
        const pertoDeMais = desnivel / Math.tan(olharMaisBaixo * math.DEG_TO_RAD);
        const fica = Math.max(0, Math.min(aFrente, Math.max(aFrente * VIAGEM_APROXIMACAO, pertoDeMais)));
        const para = new Vec3(sitio.x - frenteX * fica, posicao.y, sitio.z - frenteZ * fica);

        const percurso = posicao.distance(para);
        if (percurso < 0.05) {
            return;
        }

        // Quanto mais longe, mais tempo — mas a crescer muito menos do que
        // a distância: é isso que faz andar mais depressa quando se aponta
        // para longe.
        const duracao = VIAGEM_DURACAO_MINIMA +
            VIAGEM_DURACAO_EXTRA * Math.min(percurso / VIAGEM_DISTANCIA_LONGA, 1);

        this._viagem = {
            de: posicao.clone(),
            para,
            sitio: sitio.clone(),
            inclinacao0: inclinacao,
            inclinacao1: inclinacao,
            rumo0: angulos.y,
            rumo1: angulos.y,
            t: 0,
            duracao
        };
    }

    /**
     * Faz a pirâmide: quatro faces de lado, que se juntam num bico em
     * baixo, e o quadrado de cima. Tem um metro de alto e o bico no ponto
     * (0, 0, 0) — é escalada e posta no sítio a cada imagem.
     *
     * É desenhada por cima de tudo, na última camada que o motor desenha
     * (a das coisas de ecrã): numa camada anterior, o bairro era pintado
     * depois dela e tapava-a.
     *
     * @private
     */
    _fazerPiramide() {
        const L = 0.42;
        const cantos = [[-L, 1, -L], [L, 1, -L], [L, 1, L], [-L, 1, L]];
        const posicoes = [];
        const cores = [];
        const indices = [];
        const juntar = (ponto, cor) => {
            posicoes.push(ponto[0], ponto[1], ponto[2]);
            cores.push(cor[0], cor[1], cor[2], 255);
            return posicoes.length / 3 - 1;
        };
        for (let i = 0; i < 4; i++) {
            const cor = i % 2 ? PIRAMIDE_CORES.escura : PIRAMIDE_CORES.clara;
            const a = juntar([0, 0, 0], cor);
            const b = juntar(cantos[i], cor);
            const c = juntar(cantos[(i + 1) % 4], cor);
            indices.push(a, c, b);
        }
        const topo = cantos.map(canto => juntar(canto, PIRAMIDE_CORES.topo));
        indices.push(topo[0], topo[1], topo[2], topo[0], topo[2], topo[3]);

        const malha = new Mesh(this.app.graphicsDevice);
        malha.setPositions(posicoes);
        malha.setColors32(cores);
        malha.setIndices(indices);
        malha.update();

        const material = new StandardMaterial();
        material.useLighting = false;
        material.diffuse = new Color(0, 0, 0);
        material.emissive = new Color(1, 1, 1);
        material.emissiveVertexColor = true;
        material.cull = CULLFACE_NONE;
        material.depthTest = false;
        material.depthWrite = false;
        material.blendType = BLEND_NORMAL;
        material.opacity = 0;
        material.update();

        const entidade = new Entity('destino-do-clique');
        const camada = this.app.scene.layers.getLayerByName('UI') ||
            this.app.scene.layers.getLayerByName('World');
        entidade.addComponent('render', {
            meshInstances: [new MeshInstance(malha, material)],
            layers: camada ? [camada.id] : undefined,
            castShadows: false,
            receiveShadows: false
        });
        entidade.enabled = false;
        this.app.root.addChild(entidade);

        // O quadrado deitado no chão: só o contorno, branco, com um metro
        // de lado e o meio no ponto (0, 0, 0). Aparece e some com a
        // pirâmide, pelo mesmo material.
        const fora = 0.5;
        const dentro = 0.5 - QUADRADO_TRACO;
        const cantosDeFora = [[-fora, -fora], [fora, -fora], [fora, fora], [-fora, fora]];
        const cantosDeDentro = [[-dentro, -dentro], [dentro, -dentro], [dentro, dentro], [-dentro, dentro]];
        const posicoesDoQuadrado = [];
        const coresDoQuadrado = [];
        [...cantosDeFora, ...cantosDeDentro].forEach(([x, z]) => {
            posicoesDoQuadrado.push(x, 0, z);
            coresDoQuadrado.push(255, 255, 255, 255);
        });
        const indicesDoQuadrado = [];
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            indicesDoQuadrado.push(i, j, 4 + j, i, 4 + j, 4 + i);
        }
        const malhaDoQuadrado = new Mesh(this.app.graphicsDevice);
        malhaDoQuadrado.setPositions(posicoesDoQuadrado);
        malhaDoQuadrado.setColors32(coresDoQuadrado);
        malhaDoQuadrado.setIndices(indicesDoQuadrado);
        malhaDoQuadrado.update();

        const quadrado = new Entity('chao-do-clique');
        quadrado.addComponent('render', {
            meshInstances: [new MeshInstance(malhaDoQuadrado, material)],
            layers: camada ? [camada.id] : undefined,
            castShadows: false,
            receiveShadows: false
        });
        quadrado.enabled = false;
        this.app.root.addChild(quadrado);

        this._piramide = { entidade, quadrado, material, opacidade: -1 };
    }

    /**
     * A pirâmide e o quadrado a cada imagem: onde estão, quanto se vêem, e
     * o balanço.
     *
     * Durante uma viagem ficam pousados no sítio para onde se vai. Fora
     * disso, seguem o rato — quando ele está em cima do bairro, sem estar
     * a arrastar — e deslizam de um sítio para o outro em vez de saltar. De
     * PIRAMIDE_LEITURA_MS em PIRAMIDE_LEITURA_MS pergunta-se à placa
     * gráfica o que está debaixo do rato, se o rato ou a câmara se tiverem
     * mexido. Aparecem e somem a esbater-se. A pirâmide balança um nada no
     * ar, a rodar devagar, para se ver que está viva; o quadrado fica
     * deitado no chão, inclinado como ele, e com os lados alinhados com a
     * vista.
     *
     * @param {number} dt - O tempo desde a imagem anterior.
     * @private
     */
    _atualizarPiramide(dt) {
        const apontar = this._apontar;
        let alvo = null;

        if (this._viagem && this._viagem.sitio) {
            alvo = this._viagem.sitio;
        } else if (apontar.dentro && !apontar.aArrastar && this._mode === 'fly' && this._podeApontar()) {
            const camara = this._camera.entity;
            const andou = camara.getPosition().distance(apontar.camara) > 0.01 ||
                camara.getEulerAngles().distance(apontar.angulos) > 0.05;
            const agora = performance.now();
            if (!apontar.aLer && (apontar.mexeu || andou) && agora - apontar.ultimaLeitura > PIRAMIDE_LEITURA_MS) {
                apontar.aLer = true;
                apontar.mexeu = false;
                apontar.ultimaLeitura = agora;
                apontar.camara.copy(camara.getPosition());
                apontar.angulos.copy(camara.getEulerAngles());
                this._sitioEChaoEm(apontar.x, apontar.y).then(({ sitio, chao }) => {
                    apontar.sitio = sitio;
                    apontar.chao.copy(chao);
                    apontar.aLer = false;
                });
            }
            alvo = apontar.sitio;
        }

        if (!this._piramide) {
            if (!alvo) {
                return;
            }
            this._fazerPiramide();
        }
        const { entidade, quadrado, material } = this._piramide;

        // Aparecer e sumir, a esbater.
        apontar.opacidade = math.lerp(apontar.opacidade, alvo ? 1 : 0, Math.min(1, 12 * dt));
        if (!alvo && apontar.opacidade < 0.02) {
            apontar.opacidade = 0;
            entidade.enabled = false;
            quadrado.enabled = false;
            return;
        }
        if (Math.abs(this._piramide.opacidade - apontar.opacidade) > 0.01) {
            this._piramide.opacidade = apontar.opacidade;
            material.opacity = apontar.opacidade;
            material.update();
        }

        // Onde: a deslizar para o sítio novo; a nascer, já lá.
        if (alvo) {
            if (!entidade.enabled || apontar.opacidade < 0.1) {
                apontar.onde.copy(alvo);
                apontar.chaoDoQuadrado.copy(apontar.chao);
            } else {
                apontar.onde.lerp(apontar.onde, alvo, Math.min(1, 18 * dt));
                apontar.chaoDoQuadrado.lerp(apontar.chaoDoQuadrado, apontar.chao, Math.min(1, 10 * dt)).normalize();
            }
        }
        entidade.enabled = true;
        quadrado.enabled = true;

        // Do mesmo tamanho no ecrã, perto ou longe.
        const tela = this.app.graphicsDevice.canvas;
        const distancia = this._camera.entity.getPosition().distance(apontar.onde);
        const tamanho = distancia * 2 * Math.tan(this._camera.fov * 0.5 * math.DEG_TO_RAD) *
            PIRAMIDE_PONTOS / Math.max(1, tela.clientHeight);

        apontar.tempo += dt;
        const balanco = tamanho * (0.2 + 0.12 * Math.sin(apontar.tempo * 4));
        entidade.setPosition(apontar.onde.x, apontar.onde.y + balanco, apontar.onde.z);
        entidade.setLocalScale(tamanho, tamanho, tamanho);

        // A rodar devagar sobre si. Com a câmara a olhar muito para baixo,
        // a pirâmide deita-se um pouco para longe dela: vista de cima era só
        // o quadrado do topo, e assim vê-se sempre como se estivesse a
        // PIRAMIDE_ELEVACAO graus de altura — com o bico no sítio na mesma.
        const descida = -this._pose.angles.x;
        const deitar = Math.max(0, descida - PIRAMIDE_ELEVACAO);
        tmpQ1.setFromAxisAngle(Vec3.UP, this._pose.angles.y);
        tmpQ2.setFromAxisAngle(Vec3.RIGHT, -deitar);
        tmpQ1.mul(tmpQ2);
        tmpQ2.setFromAxisAngle(Vec3.UP, apontar.tempo * 45);
        tmpQ1.mul(tmpQ2);
        entidade.setRotation(tmpQ1);

        // O quadrado, deitado no chão debaixo do bico: primeiro virado como
        // a vista, depois inclinado como o chão. Fica um nada acima dele,
        // para não se misturar com a terra.
        const chao = apontar.chaoDoQuadrado;
        tmpQ1.setFromDirections(Vec3.UP, chao);
        tmpQ2.setFromAxisAngle(Vec3.UP, this._pose.angles.y);
        tmpQ1.mul(tmpQ2);
        quadrado.setRotation(tmpQ1);
        const folga = tamanho * 0.03;
        quadrado.setPosition(apontar.onde.x + chao.x * folga, apontar.onde.y + chao.y * folga, apontar.onde.z + chao.z * folga);
        const lado = tamanho * QUADRADO_LADO;
        quadrado.setLocalScale(lado, lado, lado);
    }

    /**
     * @param {'orbit' | 'fly' | 'focus'} mode - The mode to set.
     * @private
     */
    _setMode(mode) {
        // override mode depending on enabled features
        switch (true) {
            case this.enableFly && !this.enableOrbit: {
                mode = 'fly';
                break;
            }
            case !this.enableFly && this.enableOrbit: {
                mode = 'orbit';
                break;
            }
            case !this.enableFly && !this.enableOrbit: {
                console.warn('CameraControls: both fly and orbit modes are disabled');
                return;
            }
        }

        // check if mode is the same
        if (this._mode === mode) {
            return;
        }
        this._mode = mode;

        // detach old controller
        if (this._controller) {
            this._controller.detach();
        }

        // attach new controller
        switch (this._mode) {
            case 'orbit': {
                this._controller = this._orbitController;
                break;
            }
            case 'fly': {
                this._controller = this._flyController;
                break;
            }
            case 'focus': {
                this._controller = this._focusController;
                break;
            }
        }
        this._controller.attach(this._pose, false);
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    focus(focus, resetZoom = false) {
        this._viagem = null;
        this._setMode('focus');
        const zoomDist = resetZoom ?
            this._startZoomDist : this._camera.entity.getPosition().distance(focus);
        const position = tmpV1.copy(this._camera.entity.forward)
        .mulScalar(-zoomDist)
        .add(focus);
        this._controller.attach(pose.look(position, focus));
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    look(focus, resetZoom = false) {
        this._viagem = null;
        this._setMode('focus');
        const position = resetZoom ?
            tmpV1.copy(this._camera.entity.getPosition())
            .sub(focus)
            .normalize()
            .mulScalar(this._startZoomDist)
            .add(focus) : this._camera.entity.getPosition();
        this._controller.attach(pose.look(position, focus));
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {Vec3} position - The start point.
     */
    reset(focus, position) {
        this._viagem = null;
        this._setMode('focus');
        this._controller.attach(pose.look(position, focus));
    }

    /**
     * Places the camera at a known viewpoint looking at `focus`, whichever
     * control mode is active. Used to get out of a corner of the map.
     *
     * The play area is disarmed so the viewpoint can sit outside the mapped
     * terrain, exactly as the opening view does; it re-engages as soon as the
     * camera flies back in.
     *
     * @param {Vec3} position - Where to put the camera.
     * @param {Vec3} focus - The point to look towards.
     */
    recenter(position, focus) {
        this._viagem = null;
        this._boundsArmed = false;
        this._entryLimit = null;
        this._lastInsideValid = false;
        this._pose.look(position, focus);
        this._controller.attach(this._pose, false);
    }

    /**
     * Quantas vezes o arrasto de um dedo vira a vista neste instante: 1
     * num arrasto lento, até ACEL_MAXIMA num varrimento. Mede a velocidade
     * do dedo e o quanto ela está a crescer, e com as duas prevê a
     * velocidade daqui a nada — é por essa que se decide.
     *
     * @param {number[]} toque - O que o dedo andou nesta imagem, em pontos.
     * @param {number} umDedo - 1 com um dedo no ecrã, 0 com dois.
     * @param {number} medidaDaTela - O tamanho do ecrã, em pontos.
     * @param {number} dt - O tempo desta imagem, em segundos.
     * @returns {number} O ganho.
     * @private
     */
    _acelerarDedo(toque, umDedo, medidaDaTela, dt) {
        const passo = Math.max(dt, 1e-3);
        // Sem o dedo, a aceleração vai-se embora com a mesma calma: a vista
        // acaba o varrimento ao mesmo ritmo e, se outro varrimento vier logo
        // a seguir, já começa embalado.
        if (this._state.touches !== 1 || !umDedo) {
            this._velDedo = 0;
            this._tendDedo = 0;
            const ganho = this._ganhoDedo || 1;
            this._ganhoDedo = ganho + (1 - ganho) * (1 - Math.exp(-passo / ACEL_DESCIDA));
            return this._ganhoDedo;
        }
        const filtro = 1 - Math.exp(-passo / 0.06);
        const velAgora = Math.hypot(toque[0], toque[1]) / medidaDaTela / passo;
        const velAntes = this._velDedo || 0;
        this._velDedo = velAntes + (velAgora - velAntes) * filtro;
        const tendAgora = (this._velDedo - velAntes) / passo;
        this._tendDedo = (this._tendDedo || 0) + (tendAgora - (this._tendDedo || 0)) * filtro;
        // Só se antecipa o acelerar: o travar já se vê na velocidade.
        const prevista = this._velDedo + Math.max(0, this._tendDedo) * ACEL_ANTECIPACAO;
        let t = math.clamp((prevista - ACEL_LENTO) / (ACEL_RAPIDO - ACEL_LENTO), 0, 1);
        t = t * t * (3 - 2 * t);
        const alvo = 1 + (ACEL_MAXIMA - 1) * t;
        const ganho = this._ganhoDedo || 1;
        const demora = alvo > ganho ? ACEL_SUBIDA : ACEL_DESCIDA;
        this._ganhoDedo = ganho + (alvo - ganho) * (1 - Math.exp(-passo / demora));
        return this._ganhoDedo;
    }

    /**
     * @param {number} dt - The time delta.
     */
    update(dt) {
        dt = Math.min(dt, 0.1);
        const { keyCode } = KeyboardMouseSource;

        const { key, button, mouse, wheel } = this._desktopInput.read();
        const { touch, pinch, count } = this._orbitMobileInput.read();
        const { leftInput, rightInput } = this._flyMobileInput.read();
        const { leftStick, rightStick } = this._gamepadInput.read();

        // apply dead zone to gamepad sticks
        applyDeadZone(leftStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);
        applyDeadZone(rightStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);

        // Com o Alt em baixo, as setas deixam de andar: passam a olhar, e
        // é isso que dá a volta à vista a quem não tem rato. O WASD anda
        // na mesma, para se poder andar e olhar ao mesmo tempo.
        const aOlhar = altCarregado() ? 1 : 0;

        // As setas têm conta à parte, e não se lhes trava a soma.
        //
        // O motor não diz que teclas estão em baixo: diz o que mudou desde
        // a imagem anterior — mais um ao carregar, menos um ao largar — e é
        // somando isso que se sabe o que está a ser premido. Uma soma
        // dessas tem de ficar sempre completa: travá-la a meio, só na
        // metade de carregar, deixava o largar por descontar e a câmara
        // ficava com um empurrão fantasma para sempre. Somam-se as duas,
        // portanto, e o Alt só decide para onde é que a das setas vai.
        this._state.axis.add(tmpV1.set(
            key[keyCode.D] - key[keyCode.A],
            0, // Q and E keys disabled: (key[keyCode.E] - key[keyCode.Q]),
            key[keyCode.W] - key[keyCode.S]
        ));
        this._setas.add(tmpV1.set(
            key[keyCode.RIGHT] - key[keyCode.LEFT],
            0,
            key[keyCode.UP] - key[keyCode.DOWN]
        ));
        for (let i = 0; i < this._state.mouse.length; i++) {
            this._state.mouse[i] += button[i];
        }
        this._state.shift += key[keyCode.SHIFT];
        this._state.ctrl += key[keyCode.CTRL];
        this._state.touches += count[0];

        // Quem pega nos comandos a meio de uma viagem fica com a câmara:
        // uma tecla de andar, a roda, um arrasto com o rato ou com o dedo,
        // uma pinça ou um stick do comando param a viagem onde ela vai.
        if (this._viagem) {
            const botaoEmBaixo = this._state.mouse.some(b => b > 0);
            const pegou = this._state.axis.lengthSq() > 0 ||
                this._setas.lengthSq() > 0 ||
                wheel[0] !== 0 ||
                pinch[0] !== 0 ||
                (botaoEmBaixo && (mouse[0] !== 0 || mouse[1] !== 0)) ||
                touch[0] !== 0 || touch[1] !== 0 ||
                leftStick[0] !== 0 || leftStick[1] !== 0 ||
                rightStick[0] !== 0 || rightStick[1] !== 0;
            if (pegou) {
                this._viagem = null;
            }
        }

        // FPS: Always Fly Mode
        this._setMode('fly');

        const orbit = +(this._mode === 'orbit');
        const fly = +(this._mode === 'fly');
        const double = +(this._state.touches > 1);
        const desktopPan = +(this._state.shift || this._state.mouse[1]);
        // Com o Ctrl em baixo, arrastar com o rato não roda a vista: agarra o
        // bairro e puxa-o, e a câmara anda na horizontal com ele.
        const ctrlArrasto = this._state.ctrl > 0 && this._state.mouse[0] > 0;
        const mobileJoystick = +(this._flyMobileInput.layout.endsWith('joystick'));

        // rate-based multipliers (keyboard, gamepad, virtual joystick)
        const moveMult = (this._state.shift ? this.moveFastSpeed : this._state.ctrl ?
            this.moveSlowSpeed : this.moveSpeed) * dt;
        const rotateJoystickMult = this.rotateSpeed * this.rotateJoystickSens * 60 * dt;

        // delta-based multipliers (mouse, touch, wheel)
        const rotateDeltaMult = this.rotateSpeed;
        const zoomDeltaMult = this.zoomSpeed;
        const zoomTouchDeltaMult = this.zoomSpeed * this.zoomPinchSens;

        const { deltas } = frame;

        // O que anda é o WASD mais, se o Alt não estiver em baixo, as setas.
        const keyMove = this._state.axis.clone();
        if (!aOlhar) {
            keyMove.add(this._setas);
        }
        keyMove.normalize();
        
        const panMove = screenToWorld(this._camera, mouse[0], mouse[1], this._pose.distance);
        const v = tmpV1.set(0, 0, 0); // Reuse v for rotate below
        v.add(panMove.mulScalar(orbit * desktopPan * +this.enablePan));
        
        if (this._initialY === undefined) {
            this._initialY = this._camera.entity.getPosition().y;
        }

        // FPS FOV Zoom (Mobile Pinch) and WASD Slide
        if (!this._initialFov) {
            this._initialFov = this._camera.fov || 60;
            this._targetFov = this._initialFov;
        }

        // Gesture Mutual Exclusion
        let activePinch = pinch[0];
        let activeTouchX = touch[0];
        let activeTouchY = touch[1];

        if (double === 1) {
            const slideMag = Math.sqrt(touch[0] * touch[0] + touch[1] * touch[1]);
            const pinchMag = Math.abs(pinch[0]);
            
            if (!this._twoFingerGesture) {
                this._accumulatedSlide = (this._accumulatedSlide || 0) + slideMag;
                this._accumulatedPinch = (this._accumulatedPinch || 0) + pinchMag;
                
                // Independent higher thresholds to ignore micro-displacements (wiggles)
                // Anchor zoom produces 2x pinch compared to slide.
                if (this._accumulatedPinch > 25 && this._accumulatedPinch > this._accumulatedSlide) {
                    this._twoFingerGesture = 'pinch';
                } else if (this._accumulatedSlide > 20) {
                    this._twoFingerGesture = 'slide';
                }
            }
            
            if (this._twoFingerGesture === 'slide') {
                activePinch = 0;
            } else if (this._twoFingerGesture === 'pinch') {
                activeTouchX = 0;
                activeTouchY = 0;
            } else {
                // Not enough movement yet to decide, suppress both to avoid jitter
                activePinch = 0;
                activeTouchX = 0;
                activeTouchY = 0;
            }
        } else {
            this._twoFingerGesture = null;
            this._accumulatedSlide = 0;
            this._accumulatedPinch = 0;
        }

        // Apply continuous zoom as camera movement instead of FOV
        if (!this._zoomOffset) this._zoomOffset = 0;
        
        if (wheel && wheel[0] !== 0) {
            // Sensibilidade muito mais reduzida: de 15.0 para 3.0
            this._zoomOffset += Math.sign(wheel[0]) * -3.0;
        }
        if (double === 1 && activePinch !== 0) {
            this._zoomOffset += activePinch * -0.1;
        }

        // Suaviza os deltas de toque para um pan (arrasto) suave, com metade da duração anterior.
        // Acontece sempre para que o abrandamento (ease out) continue mesmo depois de largar.
        if (!this._smoothTouchPan) this._smoothTouchPan = new Vec2(0, 0);
        const targetPanX = (double === 1) ? activeTouchX : 0;
        const targetPanY = (double === 1) ? activeTouchY : 0;
        this._smoothTouchPan.x = math.lerp(this._smoothTouchPan.x, targetPanX, 5.0 * dt);
        this._smoothTouchPan.y = math.lerp(this._smoothTouchPan.y, targetPanY, 5.0 * dt);

        // Dois dedos a deslizar andam com a câmara, pelo mesmo sítio que
        // as teclas: para o lado para onde os dedos vão, e para a frente
        // quando sobem.
        if (Math.abs(this._smoothTouchPan.x) > 0.001 || Math.abs(this._smoothTouchPan.y) > 0.001) {
            keyMove.x += this._smoothTouchPan.x * 0.10;
            keyMove.z += this._smoothTouchPan.y * 0.10; // Inverted Z
        }

        // O stick esquerdo entra pelo mesmo sítio que as teclas, e não pelo
        // do motor.
        //
        // Mais abaixo, no bloco do movimento à moda dos jogos, a posição
        // que o motor calculou é deitada fora e refeita à mão a partir
        // deste keyMove. Enquanto o stick só falasse ao motor, o que ele
        // dissesse morria ali: a vista rodava com o stick direito, mas a
        // câmara nunca saía do sítio com o esquerdo.
        //
        // O comprimento é limitado a um porque o stick vem multiplicado
        // pela conta da zona morta e chega a passar dos dois — sem isto,
        // andava-se com o comando ao dobro da velocidade das teclas.
        if (leftStick[0] !== 0 || leftStick[1] !== 0) {
            keyMove.x += leftStick[0];
            keyMove.z -= leftStick[1];
            const passo = Math.sqrt(keyMove.x * keyMove.x + keyMove.z * keyMove.z);
            if (passo > 1) {
                keyMove.x /= passo;
                keyMove.z /= passo;
            }
        }

        // Fix FOV to initial
        this._camera.fov = this._initialFov || 60;

        // Dynamic LOD based on FOV (Zooming in increases LOD quality)
        if (this._initialFov && this._camera) {
            const fovRatio = this._initialFov / this._camera.fov; 
            
            if (!this._splatGsplat) {
                const splatEl = document.querySelector('pc-entity[name="gsplat-scene"]');
                if (splatEl && splatEl.entity && splatEl.entity.gsplat) {
                    this._splatGsplat = splatEl.entity.gsplat;
                }
            }
            
            if (this._splatGsplat) {
                const isLow = typeof window !== 'undefined' && window.actualQuality === 'low';
                const isMed = typeof window !== 'undefined' && window.actualQuality === 'med';
                
                // Estes valores mandam mesmo (reescrevem a cada imagem os que
                // ficam definidos no arranque da pagina) e tem de acompanhar
                // os do index.html.
                let baseDist = 150;
                if (isLow) baseDist = 70;
                else if (isMed) baseDist = 110;
                // Quando o index.html ja a decidiu (e no modo Automatico a
                // vai mexendo conforme a fluidez), manda a dele.
                if (typeof window !== 'undefined' && window.distanciaDoDetalhe > 0) {
                    baseDist = window.distanciaDoDetalhe;
                }
                
                this._splatGsplat.lodBaseDistance = baseDist * fovRatio;
            }
        }

        // desktop rotate (Drag to Look)
        v.set(0, 0, 0);
        
        // Target rotation based on mouse input (reduced multiplier to 0.4 for better tracking and slower speed)
        const targetRotate = tmpV2.set(-mouse[0] * 0.4, -mouse[1] * 0.4, 0).mulScalar(ctrlArrasto ? 0 : rotateDeltaMult);
        
        v.add(targetRotate);
        deltas.rotate.append([v.x, v.y, v.z]);


        // Um dedo no ecrã arrasta o bairro: o ponto que se agarra acaba
        // debaixo do dedo. Cada ponto do ecrã que o dedo anda vale os graus
        // que esse ponto ocupa na abertura da câmara, por isso ao aproximar
        // o dedo abranda com ela. O filtro dá o arranque e a travagem
        // suaves, mas a soma do caminho é a mesma: chega ao sítio do dedo.
        // Suavizamos o input (low-pass filter) para garantir
        // uma animação de ease in e ease out agradável.
        if (!this._smoothTouchRotate) this._smoothTouchRotate = new Vec2(0, 0);
        const telaDoDedo = this.app.graphicsDevice.canvas;
        const medidaDaTela = (this._camera.horizontalFov ? telaDoDedo.clientWidth : telaDoDedo.clientHeight) || 1;
        const grausPorPonto = (this._camera.fov || 60) / medidaDaTela;
        const ganhoDoDedo = this._acelerarDedo(touch, 1 - double, medidaDaTela, dt);
        const targetRotX = -(1 - double) * touch[0] * ganhoDoDedo;
        const targetRotY = -(1 - double) * touch[1] * ganhoDoDedo;
        // Num varrimento a vista também apanha o dedo mais depressa.
        const intensidade = (ganhoDoDedo - 1) / (ACEL_MAXIMA - 1);
        const ritmo = Math.min(1, SUAVIDADE_DO_DEDO * (1 + intensidade) * dt);
        this._smoothTouchRotate.x = math.lerp(this._smoothTouchRotate.x, targetRotX, ritmo);
        this._smoothTouchRotate.y = math.lerp(this._smoothTouchRotate.y, targetRotY, ritmo);

        v.set(0, 0, 0);
        const touchRotate = tmpV2.set(this._smoothTouchRotate.x, this._smoothTouchRotate.y, 0);
        v.add(touchRotate.mulScalar(grausPorPonto));
        deltas.rotate.append([v.x, v.y, v.z]);

        // A vista segue o dedo com o mesmo amortecimento do rato,
        // garantindo um movimento mais uniforme e com uma animação 
        // de ease in e out natural e suave.

        // gamepad move
        v.set(0, 0, 0);
        const stickMove = tmpV2.set(leftStick[0], 0, -leftStick[1]);
        v.add(stickMove.mulScalar(fly * moveMult));
        deltas.move.append([v.x, v.y, v.z]);

        // gamepad rotate
        v.set(0, 0, 0);
        const stickRotate = tmpV2.set(rightStick[0], rightStick[1], 0);
        v.add(stickRotate.mulScalar(fly * rotateJoystickMult));
        deltas.rotate.append([v.x, v.y, v.z]);

        // As setas a olhar, com o Alt em baixo. Entram pelo mesmo sítio que
        // o stick direito do comando, e à mesma velocidade: é a mesma
        // volta, dada por outra mão.
        if (aOlhar) {
            v.set(0, 0, 0);
            const setaOlhar = tmpV2.set(this._setas.x, -this._setas.z, 0);
            v.add(setaOlhar.mulScalar(fly * rotateJoystickMult));
            deltas.rotate.append([v.x, v.y, v.z]);
        }

        // check if XR is active for frame discard
        if (this.app.xr?.active) {
            frame.read();
            return;
        }

        // check focus end
        if (this._mode === 'focus') {
            const focusInterrupt = deltas.move.length() + deltas.rotate.length() > 0;
            const focusComplete = this._focusController.complete();
            if (focusInterrupt || focusComplete) {
                this._setMode('orbit');
            }
        }

        if (!this._lastValidPos) {
            this._lastValidPos = this._camera.entity.getPosition().clone();
            this._lastValidAngles = this._camera.entity.getEulerAngles().clone();
        }

        const oldPosX = this._lastValidPos.x;
        const oldPosY = this._lastValidPos.y;
        const oldPosZ = this._lastValidPos.z;
        const oldPitch = this._lastValidAngles.x;
        const oldYaw = this._lastValidAngles.y;
        const oldRoll = this._lastValidAngles.z;

        // Save the manual position we maintained from the last frame
        const currentPos = this._pose.position.clone();
        
        // update controller by consuming frame
        this._pose.copy(this._controller.update(frame, dt));
        
        // --- FPS WASD MANUAL XZ MOVEMENT ---
        if (this._mode === 'fly') {
            // Restore our manual position (ignoring the controller's unaware position entirely!)
            this._pose.position.copy(currentPos);
            
            if (!this._smoothMoveVelocity) {
                this._smoothMoveVelocity = new Vec3(0, 0, 0);
            }

            const yaw = this._pose.angles.y * math.DEG_TO_RAD;
            const flatForwardX = -Math.sin(yaw);
            const flatForwardZ = -Math.cos(yaw);
            const flatRightX = Math.cos(yaw);
            const flatRightZ = -Math.sin(yaw);
            
            // Target movement based on input
            let moveX = flatForwardX * keyMove.z + flatRightX * keyMove.x;
            let moveZ = flatForwardZ * keyMove.z + flatRightZ * keyMove.x;
            
            const targetVec = tmpV1.set(moveX, 0, moveZ);
            if (targetVec.length() > 0.0001) {
                targetVec.mulScalar(fly * moveMult);
            } else {
                targetVec.set(0, 0, 0);
            }
            
            // Apply ease in and out (inertia)
            this._smoothMoveVelocity.lerp(this._smoothMoveVelocity, targetVec, 5.0 * dt);

            if (this._smoothMoveVelocity.length() > 0.00001) {
                this._pose.position.add(this._smoothMoveVelocity);
            }

            // Ctrl + arrastar: o bairro segue o rato. Cada ponto de ecrã que
            // o rato anda vale, em metros, o que um ponto de ecrã vale no
            // chão à altura a que a câmara está — assim o que está debaixo
            // do cursor fica debaixo do cursor, seja de perto ou de longe.
            if (ctrlArrasto && (mouse[0] !== 0 || mouse[1] !== 0)) {
                const altura = Math.max(3, this._pose.position.y);
                const tela = this.app.graphicsDevice.canvas;
                const alturaDaTela = (tela && tela.clientHeight) || 1;
                const metrosPorPonto = 2 * altura * Math.tan(this._camera.fov * 0.5 * math.DEG_TO_RAD) / alturaDaTela;
                const lado = -mouse[0] * metrosPorPonto;
                const frente = mouse[1] * metrosPorPonto;
                this._pose.position.x += flatRightX * lado + flatForwardX * frente;
                this._pose.position.z += flatRightZ * lado + flatForwardZ * frente;
            }
            // NO ATTACH HERE!
        }

        // --- Apontar e ir: a viagem até ao sítio do clique ---
        // A cada imagem a câmara é posta no ponto da viagem que o relógio
        // manda, pela curva que começa e acaba devagar; e o comando de voo
        // fica a saber onde ela está, para, ao chegar, continuar dali sem
        // dar um salto para trás.
        if (this._viagem && this._mode === 'fly') {
            const viagem = this._viagem;
            viagem.t = Math.min(1, viagem.t + dt / viagem.duracao);
            const k = entradaESaida(viagem.t);
            this._pose.position.lerp(viagem.de, viagem.para, k);
            this._pose.angles.set(
                math.lerp(viagem.inclinacao0, viagem.inclinacao1, k),
                math.lerp(viagem.rumo0, viagem.rumo1, k),
                0
            );
            this._controller.attach(this._pose, false);
            if (this._smoothMoveVelocity) {
                this._smoothMoveVelocity.set(0, 0, 0);
            }
            if (viagem.t >= 1) {
                this._viagem = null;
            }
        }

        // --- HARD CLAMP PITCH TO PREVENT FLIPPING ---
        let currentPitch = this._pose.angles.x;
        while (currentPitch > 180) currentPitch -= 360;
        while (currentPitch < -180) currentPitch += 360;

        if (currentPitch < -89.5 || currentPitch > 89.5) {
            const targetPitch = Math.max(-89.5, Math.min(89.5, currentPitch));
            this._pose.angles.x = targetPitch;
            
            if (this._mode === 'orbit') {
                const focus = this._pose.getFocus(tmpV2).clone();
                const dist = this._pose.position.distance(focus);
                
                // Recalculate position based on the clamped pitch
                const ex = targetPitch * math.DEG_TO_RAD;
                const ey = this._pose.angles.y * math.DEG_TO_RAD;
                
                const cx = Math.cos(ex);
                const sx = Math.sin(ex);
                const cy = Math.cos(ey);
                const sy = Math.sin(ey);
                
                this._pose.position.set(
                    focus.x + (cx * sy) * dist,
                    focus.y + (-sx) * dist,
                    focus.z + (cx * cy) * dist
                );
                
                // Re-sync controller so it doesn't bounce back
                this._controller.attach(this._pose, false);
            }
        }
        
        const rawPosX = this._pose.position.x;
        const rawPosY = this._pose.position.y;
        const rawPosZ = this._pose.position.z;
        const rawPitch = this._pose.angles.x;
        const rawYaw = this._pose.angles.y;
        const rawRoll = this._pose.angles.z;
        
        // Aplica o movimento do zoom (aproximar/afastar) antes dos limites de chão e teto
        if (this._zoomOffset && Math.abs(this._zoomOffset) > 0.001) {
            let moveThisFrame = math.lerp(0, this._zoomOffset, 12.0 * dt);
            
            const pitch = this._pose.angles.x * math.DEG_TO_RAD;
            const yaw = this._pose.angles.y * math.DEG_TO_RAD;
            // Vetor em direção ao centro do ecrã (forward)
            const trueForwardX = -Math.sin(yaw) * Math.cos(pitch);
            const trueForwardY = Math.sin(pitch);
            const trueForwardZ = -Math.cos(yaw) * Math.cos(pitch);
            
            const nextY = this._pose.position.y + trueForwardY * moveThisFrame;
            const MIN_ALTITUDE = 15.0;
            const MAX_ALTITUDE = this._initialY !== undefined ? this._initialY : Infinity;
            
            // Impede deslizar pelo chão ou teto quando forçamos o zoom contra eles
            if (nextY < MIN_ALTITUDE || nextY > MAX_ALTITUDE) {
                if (Math.abs(trueForwardY) > 0.0001) {
                    const limite = nextY < MIN_ALTITUDE ? MIN_ALTITUDE : MAX_ALTITUDE;
                    moveThisFrame = (limite - this._pose.position.y) / trueForwardY;
                } else {
                    moveThisFrame = 0;
                }
                this._zoomOffset = 0; // Trava o momento instantaneamente
            } else {
                this._zoomOffset -= moveThisFrame;
            }
            
            this._pose.position.x += trueForwardX * moveThisFrame;
            this._pose.position.y += trueForwardY * moveThisFrame;
            this._pose.position.z += trueForwardZ * moveThisFrame;
            
            // Atualizar o controlador para não ressaltar
            if (this._mode === 'orbit') {
                const focus = this._pose.getFocus(tmpV2).clone();
                this._pose.look(this._pose.position, focus);
                this._controller.attach(this._pose, false);
            }
        }

        // Chão e tecto: os da cúpula do céu, e só com a travagem ligada.
        const baixo = this._alturaMinima();
        const alto = this._alturaMaxima();
        if (this._pose.position.y < baixo) {
            this._pose.position.y = baixo;
            if (this._mode === 'orbit') {
                const focus = this._pose.getFocus(tmpV2).clone();
                this._pose.look(this._pose.position, focus);
                this._controller.attach(this._pose, false);
            }
        }
        if (this._pose.position.y > alto) {
            this._pose.position.y = alto;
            if (this._mode === 'orbit') {
                const focus = this._pose.getFocus(tmpV2).clone();
                this._pose.look(this._pose.position, focus);
                this._controller.attach(this._pose, false);
            }
        }

        let isAtBoundary = false;
        const EDGE_EPS = 0.01;

        const cupula = this.travagem ? this._medidasDaCupula() : null;
        if (cupula) {
            // A parede da taça é o fim do mundo visível: passar dela seria
            // sair da fotografia e ver o céu pelo lado de fora.
            const pos = this._pose.position;
            const dx = pos.x - cupula.centroX;
            const dz = pos.z - cupula.centroZ;
            const distancia = Math.sqrt(dx * dx + dz * dz);
            const parede = Math.max(1, this._paredeA(cupula, pos.y) - this.margemDaCupula);

            if (distancia > parede) {
                isAtBoundary = true;
                const encolher = parede / distancia;
                pos.x = cupula.centroX + dx * encolher;
                pos.z = cupula.centroZ + dz * encolher;
                if (this._mode === 'orbit') {
                    const focus = this._pose.getFocus(tmpV2).clone();
                    this._pose.look(pos, focus);
                    this._controller.attach(this._pose, false);
                }
            } else if (distancia > parede - EDGE_EPS) {
                isAtBoundary = true;
            }
        } else if (this.travagem && this._playArea) {
            const area = this._playArea;
            const pos = this._pose.position;

            // Opening frame: remember how far out the view starts, so the
            // camera can hold that viewpoint yet never retreat beyond it.
            if (this._entryLimit === null) {
                const startDistance = area.distanceTo(pos.x, pos.z);
                this._entryLimit = isFinite(startDistance) ? startDistance : 0;
            }

            // Once the camera reaches the terrain, the tighter limit takes over
            // for good.
            if (!this._boundsArmed && area.contains(pos.x, pos.z)) {
                this._boundsArmed = true;
            }

            if (this._positionAllowed(pos.x, pos.z)) {
                this._lastInsideX = pos.x;
                this._lastInsideZ = pos.z;
                this._lastInsideValid = true;
            } else if (this._lastInsideValid) {
                // Give back only the axis that left the area, so the camera
                // slides along the edge instead of stopping dead.
                if (this._positionAllowed(pos.x, this._lastInsideZ)) {
                    pos.z = this._lastInsideZ;
                } else if (this._positionAllowed(this._lastInsideX, pos.z)) {
                    pos.x = this._lastInsideX;
                } else {
                    pos.x = this._lastInsideX;
                    pos.z = this._lastInsideZ;
                }

                isAtBoundary = true;
                this._lastInsideX = pos.x;
                this._lastInsideZ = pos.z;

                if (this._mode === 'orbit') {
                    const focus = this._pose.getFocus(tmpV2).clone();
                    this._pose.look(this._pose.position, focus);
                    this._controller.attach(this._pose, false);
                }
            }
        } else if (this.travagem && this.maxDistance > 0 &&
                this._pose.position.length() >= this.maxDistance - EDGE_EPS) {
            // Fallback until the map footprint is known
            isAtBoundary = true;
            if (this._pose.position.length() > this.maxDistance) {
                this._pose.position.normalize().mulScalar(this.maxDistance);
                if (this._mode === 'orbit') {
                    const focus = this._pose.getFocus(tmpV2).clone();
                    this._pose.look(this._pose.position, focus);
                    this._controller.attach(this._pose, false);
                }
            }
        }

        if (isAtBoundary !== this._wasAtBoundary) {
            this._wasAtBoundary = isAtBoundary;
            if (isAtBoundary) {
                window.dispatchEvent(new CustomEvent('cameraBoundaryHit'));
            } else {
                window.dispatchEvent(new CustomEvent('cameraBoundaryLeft'));
            }
        }

        // --- GLOBAL ALTITUDE LIMITS ---
        // Impede que a câmara fure o chão (trespassar o gaussian) 
        // e repõe o teto de altitude original da câmara.
        const MIN_ALTITUDE = 15.0;
        if (this._pose.position.y < MIN_ALTITUDE) {
            this._pose.position.y = MIN_ALTITUDE;
        }
        if (this._initialY !== undefined && this._pose.position.y > this._initialY) {
            this._pose.position.y = this._initialY;
        }

        this._camera.entity.setPosition(this._pose.position);
        this._camera.entity.setEulerAngles(this._pose.angles);
        
        this._lastValidPos.copy(this._pose.position);
        this._lastValidAngles.copy(this._pose.angles);

        this._atualizarPiramide(dt);
    }
}

export { CameraControls };
