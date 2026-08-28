import {
    math,
    DualGestureSource,
    FlyController,
    FocusController,
    GamepadSource,
    InputFrame,
    KeyboardMouseSource,
    MultiTouchSource,
    OrbitController,
    Pose,
    Script,
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
 * How low the camera may come down.
 */
const MIN_HEIGHT = 1;

/**
 * How high the camera may climb: the height the opening view sits at.
 */
const MAX_HEIGHT = 63.28;

/**
 * Looking towards the horizon, the ground under the pointer runs off to
 * infinity. Grabbing a spot that far away would fling the map across the
 * screen, so reach is capped at this many times the camera's height.
 */
const MAX_REACH = 12;

/**
 * Which way the camera faces, as a unit vector, given its angles.
 *
 * @param {number} pitch - The pitch, in degrees. Negative looks down.
 * @param {number} yaw - The yaw, in degrees.
 * @param {Vec3} out - The vector to write into.
 * @returns {Vec3} - The direction the camera faces.
 * @private
 */
const forwardFromAngles = (pitch, yaw, out) => {
    const cx = Math.cos(pitch * math.DEG_TO_RAD);
    const sx = Math.sin(pitch * math.DEG_TO_RAD);
    const sy = Math.sin(yaw * math.DEG_TO_RAD);
    const cy = Math.cos(yaw * math.DEG_TO_RAD);
    return out.set(-cx * sy, sx, -cx * cy);
};

const tmpV3 = new Vec3();
const tmpDir = new Vec3();
const tmpPivot = new Vec3();
const tmpHit = new Vec3();
const tmpRayO = new Vec3();
const tmpRayD = new Vec3();
const tmpAxis = new Vec3();
const tmpTarget = new Vec3();

/**
 * @enum {string}
 */
// eslint-disable-next-line no-unused-vars
const MobileInputLayout = {
    JOYSTICK_JOYSTICK: 'joystick-joystick',
    JOYSTICK_TOUCH: 'joystick-touch',
    TOUCH_JOYSTICK: 'touch-joystick',
    TOUCH_TOUCH: 'touch-touch'
};

/**
 * Drives the camera the way an online map does.
 *
 * The left button drags the ground: whatever spot was grabbed stays under the
 * pointer. Holding Ctrl (or using the right or middle button) turns and tilts
 * the view around whatever sits in the middle of the screen. The wheel dives
 * towards the pointer, a double click dives one step, and the + and - keys
 * zoom on the middle of the view. The arrow keys and W A S D slide the map
 * about; with Ctrl held they turn and tilt it instead.
 *
 * On a touch screen one finger drags the map, two fingers pinch to zoom and a
 * two finger drag turns and tilts. A gamepad slides with the left stick and
 * turns with the right one.
 *
 * The view never tips up far enough to show the sky, and the camera stays
 * between a floor and a ceiling, so the map is always underneath. Use
 * {@link CameraControls#focus}, {@link CameraControls#look} and
 * {@link CameraControls#reset} to frame a point of interest programmatically.
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
    _pitchRange = new Vec2(-89.9, -15);

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
    _state = {
        axis: new Vec3(),
        shift: 0,
        ctrl: 0,
        mouse: [0, 0, 0],
        touches: 0
    };

    /**
     * The height of the ground. The map is dragged, turned and zoomed against
     * a flat plane at this height, the way a paper map lies on a table.
     *
     * @attribute
     * @title Ground Height
     * @type {number}
     */
    groundHeight = -6;

    /**
     * The last place the pointer was seen, in canvas pixels. Dragging the
     * ground needs to know where the pointer is, not only how far it moved.
     *
     * @type {number}
     * @private
     */
    _pointerX = 0;

    /** @type {number} @private */
    _pointerY = 0;

    /** @type {boolean} @private */
    _pointerSeen = false;

    /**
     * How far the wheel has turned since the last frame, in pixels. Browsers
     * report scrolling in pixels, lines or pages, so it is brought to one
     * scale here instead of trusting the raw number.
     *
     * @type {number}
     * @private
     */
    _wheelDelta = 0;

    /**
     * Every finger currently on the canvas, so the middle of a two finger
     * pinch can be found.
     *
     * @type {Map<number, {x: number, y: number}>}
     * @private
     */
    _pointers = new Map();

    /** @type {{x: number, y: number}} @private */
    _middle = { x: 0, y: 0 };

    /**
     * The spot of ground being held under the pointer. Null when nothing is
     * being dragged.
     *
     * @type {Vec3|null}
     * @private
     */
    _grabPoint = null;

    /**
     * How fast the ground was travelling when it was let go, so the map keeps
     * gliding for a moment.
     *
     * @type {Vec3}
     * @private
     */
    _grabVelocity = new Vec3();

    /**
     * Zoom still left to travel. The camera eats into it a little each frame,
     * so a turn of the wheel glides instead of jumping.
     *
     * @type {Vec3}
     * @private
     */
    _pendingZoom = new Vec3();

    /** @type {Vec3} @private */
    _keyVelocity = new Vec3();

    /** @type {string} @private */
    _cursorShape = '';

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
     * How strongly a pinch zooms. One means the ground keeps pace with the
     * fingers; higher exaggerates it.
     *
     * @attribute
     * @title Zoom
     * @type {number}
     */
    zoomPinchSens = 1;

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
        return cupula ? Math.max(MIN_HEIGHT, cupula.chao) : MIN_HEIGHT;
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
        return cupula ? cupula.topo - this.margemDaCupula : MAX_HEIGHT;
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
     * How far the view may tilt, in degrees. Negative looks down at the
     * ground. Like a map, it never tips up far enough to show the sky.
     *
     * @attribute
     * @title Pitch Range
     * @type {Vec2}
     * @default [-89.9, -15]
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

        // Dragging the ground needs to know where the pointer is, and the
        // engine's input only reports how far it moved. These listeners sit on
        // the window so a drag that wanders off the canvas keeps working.
        this._onPointerTrack = (e) => {
            const rect = this.app.graphicsDevice.canvas.getBoundingClientRect();
            this._pointerX = e.clientX - rect.left;
            this._pointerY = e.clientY - rect.top;
            this._pointerSeen = true;
            if (e.pointerType !== 'mouse') {
                this._pointers.set(e.pointerId, { x: this._pointerX, y: this._pointerY });
            }
        };
        this._onPointerDrop = (e) => {
            this._pointers.delete(e.pointerId);
        };

        // Two clicks in the same spot dive in one step, as on a map.
        this._onDoubleClick = (e) => {
            const rect = this.app.graphicsDevice.canvas.getBoundingClientRect();
            this._queueZoom(0.5, e.clientX - rect.left, e.clientY - rect.top);
        };

        // The + and - keys zoom on the middle of the view.
        this._onZoomKey = (e) => {
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
                return;
            }
            const canvas = this.app.graphicsDevice.canvas;
            const x = canvas.clientWidth * 0.5;
            const y = canvas.clientHeight * 0.5;
            if (e.key === '+' || e.key === '=') {
                this._queueZoom(1 / 1.5, x, y);
            } else if (e.key === '-' || e.key === '_') {
                this._queueZoom(1.5, x, y);
            }
        };

        this._onWheel = (e) => {
            const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1);
            this._wheelDelta += e.deltaY * unit;
        };
        this.app.graphicsDevice.canvas.addEventListener('wheel', this._onWheel, { passive: true });

        window.addEventListener('pointerdown', this._onPointerTrack, true);
        window.addEventListener('pointermove', this._onPointerTrack, true);
        window.addEventListener('pointerup', this._onPointerDrop, true);
        window.addEventListener('pointercancel', this._onPointerDrop, true);
        window.addEventListener('keydown', this._onZoomKey);
        this.app.graphicsDevice.canvas.addEventListener('dblclick', this._onDoubleClick);

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
            this._wheelDelta = 0;
            this._stopMotion();
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
        window.removeEventListener('pointerdown', this._onPointerTrack, true);
        window.removeEventListener('pointermove', this._onPointerTrack, true);
        window.removeEventListener('pointerup', this._onPointerDrop, true);
        window.removeEventListener('pointercancel', this._onPointerDrop, true);
        window.removeEventListener('keydown', this._onZoomKey);
        this.app.graphicsDevice.canvas.removeEventListener('dblclick', this._onDoubleClick);
        this.app.graphicsDevice.canvas.removeEventListener('wheel', this._onWheel);

        this._desktopInput.destroy();
        this._orbitMobileInput.destroy();
        this._flyMobileInput.destroy();
        this._gamepadInput.destroy();

        this._flyController.destroy();
        this._orbitController.destroy();
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
        this._setMode('focus');
        this._stopMotion();
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
        this._setMode('focus');
        this._stopMotion();
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
        this._setMode('focus');
        this._stopMotion();
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
        this._boundsArmed = false;
        this._entryLimit = null;
        this._lastInsideValid = false;
        this._stopMotion();
        this._pose.look(position, focus);
        this._controller.attach(this._pose, false);
    }

    /**
     * Drops whatever the camera was still carrying: the glide left over from a
     * drag, the zoom still on its way, the drift of a held key.
     *
     * @private
     */
    _stopMotion() {
        this._grabPoint = null;
        this._grabVelocity.set(0, 0, 0);
        this._pendingZoom.set(0, 0, 0);
        this._keyVelocity.set(0, 0, 0);
    }

    /**
     * How far ahead the ground is, straight down the middle of the view. The
     * rest of the code asks the pose for this, so it is kept up to date.
     *
     * @private
     */
    _syncDistance() {
        const height = Math.max(0.01, this._pose.position.y - this.groundHeight);
        const drop = -Math.sin(this._pose.angles.x * math.DEG_TO_RAD);
        this._pose.distance = drop > 0.001 ?
            Math.min(height / drop, height * MAX_REACH) : height * MAX_REACH;
    }

    /**
     * The spot of ground sitting under a point of the screen.
     *
     * @param {number} sx - Screen x, in canvas pixels.
     * @param {number} sy - Screen y, in canvas pixels.
     * @param {Vec3} out - The vector to write into.
     * @returns {Vec3} - A point on the ground plane.
     * @private
     */
    _groundPoint(sx, sy, out) {
        const camera = this._camera;
        camera.screenToWorld(sx, sy, camera.nearClip, tmpRayO);
        camera.screenToWorld(sx, sy, camera.farClip, tmpRayD);
        tmpRayD.sub(tmpRayO).normalize();

        const ground = this.groundHeight;
        const reach = Math.max(0.01, tmpRayO.y - ground) * MAX_REACH;
        const travel = tmpRayD.y < -0.0001 ?
            Math.min((ground - tmpRayO.y) / tmpRayD.y, reach) : reach;

        out.copy(tmpRayD).mulScalar(travel).add(tmpRayO);
        out.y = ground;
        return out;
    }

    /**
     * Books a move towards a spot on the ground — or away from it, for zooming
     * out. The spot stays where it is on screen while the camera closes in.
     *
     * @param {number} factor - Below 1 comes closer, above 1 pulls back.
     * @param {number} sx - Screen x, in canvas pixels.
     * @param {number} sy - Screen y, in canvas pixels.
     * @param {boolean} [now] - Spend it straight away, for a pinch that has to
     * keep up with the fingers.
     * @private
     */
    _queueZoom(factor, sx, sy, now = false) {
        const ground = this.groundHeight;
        const from = tmpV1.copy(this._pose.position).add(this._pendingZoom);
        const height = from.y - ground;
        if (height <= 0.01) {
            return;
        }

        // O chão e o tecto — os da cúpula, quando ela existe — decidem
        // quanto da volta da roda pode mesmo ser gasto.
        const scale = math.clamp(factor,
            (this._alturaMinima() - ground) / height,
            (this._alturaMaxima() - ground) / height);
        if (Math.abs(scale - 1) < 0.0005) {
            return;
        }

        const anchor = this._groundPoint(sx, sy, tmpHit);
        tmpV3.copy(from).sub(anchor).mulScalar(scale).add(anchor);
        this._pendingZoom.add(tmpV3).sub(from);

        if (now) {
            this._pose.position.add(this._pendingZoom);
            this._pendingZoom.set(0, 0, 0);
        }
    }

    /**
     * How far apart the fingers are, in canvas pixels.
     *
     * @returns {number} - The spread, or zero without two fingers down.
     * @private
     */
    _fingerSpread() {
        const spots = [];
        this._pointers.forEach((p) => spots.push(p));
        if (spots.length < 2) {
            return 0;
        }
        const dx = spots[0].x - spots[1].x;
        const dy = spots[0].y - spots[1].y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * The middle of the fingers on screen, for a pinch to zoom on.
     *
     * @returns {{x: number, y: number}} - A point in canvas pixels.
     * @private
     */
    _pinchCentre() {
        let x = 0;
        let y = 0;
        let count = 0;
        this._pointers.forEach((p) => {
            x += p.x;
            y += p.y;
            count++;
        });
        const canvas = this.app.graphicsDevice.canvas;
        this._middle.x = count > 0 ? x / count : canvas.clientWidth * 0.5;
        this._middle.y = count > 0 ? y / count : canvas.clientHeight * 0.5;
        return this._middle;
    }

    /**
     * Moves the camera the way a map moves.
     *
     * Drag with the left button and the ground follows the pointer. Hold Ctrl
     * (or use the right button) and the view turns and tilts around whatever
     * is in the middle of the screen. The wheel dives towards the pointer. On
     * a screen, one finger drags and two fingers pinch to zoom or twist.
     *
     * @param {number} dt - The time delta.
     * @param {number[]} mouse - How far the mouse moved while held down.
     * @param {number[]} touch - How far the fingers moved.
     * @param {number[]} pinch - How much the fingers came together.
     * @param {number[]} leftStick - The left stick of the gamepad.
     * @param {number[]} rightStick - The right stick of the gamepad.
     * @private
     */
    _navigate(dt, mouse, touch, pinch, leftStick, rightStick) {
        const pos = this._pose.position;
        const angles = this._pose.angles;
        const ground = this.groundHeight;

        const left = this._state.mouse[0] > 0;
        const middle = this._state.mouse[1] > 0;
        const right = this._state.mouse[2] > 0;
        const ctrl = this._state.ctrl > 0;
        const fingers = this._state.touches;

        const turning = middle || right || (left && ctrl);
        const dragging = (left && !turning) || fingers === 1;

        // Two fingers do one thing at a time: either a pinch or a drag. A
        // small wobble should not count as either.
        let slideX = 0;
        let slideY = 0;
        let squeeze = 0;
        if (fingers > 1) {
            if (!this._twoFingerGesture) {
                this._accumulatedSlide = (this._accumulatedSlide || 0) +
                    Math.sqrt(touch[0] * touch[0] + touch[1] * touch[1]);
                this._accumulatedPinch = (this._accumulatedPinch || 0) + Math.abs(pinch[0]);

                if (this._accumulatedPinch > 25 && this._accumulatedPinch > this._accumulatedSlide) {
                    this._twoFingerGesture = 'pinch';
                } else if (this._accumulatedSlide > 20) {
                    this._twoFingerGesture = 'slide';
                }
            }
            if (this._twoFingerGesture === 'pinch') {
                squeeze = pinch[0];
            } else if (this._twoFingerGesture === 'slide') {
                slideX = touch[0];
                slideY = touch[1];
            }
        } else {
            this._twoFingerGesture = null;
            this._accumulatedSlide = 0;
            this._accumulatedPinch = 0;
        }

        // ---- turn and tilt ----
        let yaw = 0;
        let pitch = 0;
        if (turning) {
            yaw -= mouse[0] * this.rotateSpeed;
            pitch -= mouse[1] * this.rotateSpeed;
        }
        yaw -= slideX * this.rotateSpeed;
        pitch -= slideY * this.rotateSpeed;

        const turnStep = this.rotateSpeed * this.rotateJoystickSens * 60 * dt;
        if (ctrl) {
            yaw -= this._state.axis.x * turnStep;
            pitch += this._state.axis.z * turnStep;
        }
        yaw -= rightStick[0] * turnStep;
        pitch -= rightStick[1] * turnStep;

        if (yaw !== 0 || pitch !== 0) {
            // Whatever sits in the middle of the view stays put: the camera is
            // the one that swings around it.
            const facing = forwardFromAngles(angles.x, angles.y, tmpDir);
            const reach = Math.max(0.01, pos.y - ground) * MAX_REACH;
            const travel = facing.y < -0.0001 ?
                Math.min((ground - pos.y) / facing.y, reach) : reach;
            const pivot = tmpPivot.copy(facing).mulScalar(travel).add(pos);

            angles.y = (angles.y + yaw) % 360;
            angles.x = math.clamp(angles.x + pitch, this._pitchRange.x, this._pitchRange.y);

            // Tilting towards straight down lifts the camera, so it comes in
            // closer instead of going through the ceiling.
            const after = forwardFromAngles(angles.x, angles.y, tmpDir);
            const drop = Math.max(0.0001, -after.y);
            const low = (this._alturaMinima() - pivot.y) / drop;
            const high = (this._alturaMaxima() - pivot.y) / drop;
            const dist = high > low ? math.clamp(travel, low, high) : travel;

            pos.copy(pivot).sub(after.mulScalar(dist));
            this._grabPoint = null;
            this._grabVelocity.set(0, 0, 0);
        }

        // ---- zoom ----
        if (this._wheelDelta !== 0) {
            const canvas = this.app.graphicsDevice.canvas;
            const turn = math.clamp(this._wheelDelta, -400, 400);
            this._wheelDelta = 0;
            this._queueZoom(
                Math.exp(math.clamp(turn * this.zoomSpeed * 5, -1.2, 1.2)),
                this._pointerSeen ? this._pointerX : canvas.clientWidth * 0.5,
                this._pointerSeen ? this._pointerY : canvas.clientHeight * 0.5
            );
        }
        if (squeeze !== 0) {
            // Fingers spread twice as wide bring the ground twice as close,
            // so the map keeps pace with the hands holding it.
            const spread = this._fingerSpread();
            if (spread > 1) {
                const centre = this._pinchCentre();
                this._queueZoom(
                    Math.pow(math.clamp(1 + squeeze / spread, 0.2, 5), this.zoomPinchSens),
                    centre.x, centre.y, true
                );
            }
        }
        if (this._pendingZoom.lengthSq() > 0.000001) {
            tmpV1.copy(this._pendingZoom).mulScalar(damp(this.zoomDamping, dt));
            pos.add(tmpV1);
            this._pendingZoom.sub(tmpV1);
        } else {
            this._pendingZoom.set(0, 0, 0);
        }

        // ---- drag the ground ----
        if (dragging && this.enablePan) {
            const hit = this._groundPoint(this._pointerX, this._pointerY, tmpHit);
            if (this._grabPoint) {
                // Every frame the camera moves so the spot it grabbed lands
                // back under the pointer. Held against an edge the map simply
                // stops, and picks up again on the way back.
                let dx = this._grabPoint.x - hit.x;
                let dz = this._grabPoint.z - hit.z;
                const step = Math.sqrt(dx * dx + dz * dz);
                const limit = Math.max(1, pos.y - ground) * 2;
                if (step > limit) {
                    dx *= limit / step;
                    dz *= limit / step;
                }
                pos.x += dx;
                pos.z += dz;

                if (dt > 0.0001) {
                    // Kept in check so a flick of the wrist throws the map a
                    // little way, not clean off the far side of the world.
                    tmpV2.set(dx / dt, 0, dz / dt);
                    const fastest = Math.max(4, (pos.y - ground) * 3);
                    if (tmpV2.length() > fastest) {
                        tmpV2.normalize().mulScalar(fastest);
                    }
                    this._grabVelocity.lerp(this._grabVelocity, tmpV2, 0.35);
                }
            } else {
                this._grabPoint = new Vec3().copy(hit);
                this._grabVelocity.set(0, 0, 0);
            }
        } else {
            this._grabPoint = null;
            if (this._grabVelocity.lengthSq() > 0.0004) {
                // A short glide after the map is let go.
                pos.x += this._grabVelocity.x * dt;
                pos.z += this._grabVelocity.z * dt;
                this._grabVelocity.mulScalar(Math.pow(0.0005, dt));
            } else {
                this._grabVelocity.set(0, 0, 0);
            }
        }

        // ---- arrow keys and gamepad stick ----
        const axis = tmpAxis.set(0, 0, 0);
        if (!ctrl) {
            axis.add(this._state.axis);
        }
        axis.x += leftStick[0];
        axis.z -= leftStick[1];
        axis.y = 0;

        const target = tmpTarget.set(0, 0, 0);
        if (axis.lengthSq() > 0.0001) {
            axis.normalize();
            const rad = angles.y * math.DEG_TO_RAD;
            const sy = Math.sin(rad);
            const cy = Math.cos(rad);

            // Down low the map crawls, high up it sweeps: the same press of a
            // key covers the same slice of what is on screen.
            const height = Math.max(1, pos.y - ground);
            const speed = this.moveSpeed * (this._state.shift > 0 ? 2 : 1) *
                dt * math.clamp(height / 60, 0.12, 1.5);

            target.set(
                (cy * axis.x - sy * axis.z) * speed,
                0,
                (-sy * axis.x - cy * axis.z) * speed
            );
            this._grabVelocity.set(0, 0, 0);
        }
        this._keyVelocity.lerp(this._keyVelocity, target, math.clamp(8 * dt, 0, 1));
        pos.x += this._keyVelocity.x;
        pos.z += this._keyVelocity.z;

        // ---- the pointer shows the map can be grabbed ----
        const shape = (dragging || turning) ? 'grabbing' : 'grab';
        if (shape !== this._cursorShape) {
            this._cursorShape = shape;
            this.app.graphicsDevice.canvas.style.cursor = shape;
        }
    }

    /**
     * Keeps the camera over the mapped ground, between the floor and the
     * ceiling, and tells the page when it runs into the edge.
     *
     * @private
     */
    _applyLimits() {
        const pos = this._pose.position;
        const angles = this._pose.angles;

        // Never roll over the top.
        let pitch = angles.x;
        while (pitch > 180) {
            pitch -= 360;
        }
        while (pitch < -180) {
            pitch += 360;
        }
        angles.x = math.clamp(pitch, this._pitchRange.x, this._pitchRange.y);

        if (!this.travagem) {
            // Sem travagem não há fim do mundo: nada a apertar e nada a
            // avisar. Se o aviso estava no ecrã, sai.
            if (this._wasAtBoundary) {
                this._wasAtBoundary = false;
                window.dispatchEvent(new CustomEvent('cameraBoundaryLeft'));
            }
            return;
        }

        // Chão e tecto: os da cúpula, quando ela existe.
        const baixo = this._alturaMinima();
        const alto = this._alturaMaxima();
        pos.y = math.clamp(pos.y, baixo, Math.max(baixo, alto));

        let isAtBoundary = false;
        const EDGE_EPS = 0.01;

        const cupula = this._medidasDaCupula();
        if (cupula) {
            // A parede da taça é o fim do mundo visível: passar dela seria
            // sair da fotografia e ver o céu pelo lado de fora.
            const dx = pos.x - cupula.centroX;
            const dz = pos.z - cupula.centroZ;
            const distancia = Math.sqrt(dx * dx + dz * dz);
            const parede = Math.max(1, this._paredeA(cupula, pos.y) - this.margemDaCupula);

            if (distancia > parede) {
                isAtBoundary = true;
                const encolher = parede / distancia;
                pos.x = cupula.centroX + dx * encolher;
                pos.z = cupula.centroZ + dz * encolher;
            } else if (distancia > parede - EDGE_EPS) {
                isAtBoundary = true;
            }
        } else if (this._playArea) {
            const area = this._playArea;

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
            }
        } else if (this.maxDistance > 0 && pos.length() >= this.maxDistance - EDGE_EPS) {
            // Fallback until the map footprint is known
            isAtBoundary = true;
            if (pos.length() > this.maxDistance) {
                pos.normalize().mulScalar(this.maxDistance);
            }
        }

        if (isAtBoundary !== this._wasAtBoundary) {
            this._wasAtBoundary = isAtBoundary;
            window.dispatchEvent(new CustomEvent(isAtBoundary ?
                'cameraBoundaryHit' : 'cameraBoundaryLeft'));
        }
    }

    /**
     * The model swaps in finer detail as the camera comes down. How close it
     * has to be depends on the graphics setting.
     *
     * Estes valores mandam mesmo (reescrevem a cada imagem os que ficam
     * definidos no arranque da pagina) e tem de acompanhar os do index.html.
     *
     * @private
     */
    _updateDetail() {
        if (!this._splatGsplat) {
            const splatEl = document.querySelector('pc-entity[name="gsplat-scene"]');
            if (splatEl && splatEl.entity && splatEl.entity.gsplat) {
                this._splatGsplat = splatEl.entity.gsplat;
            }
        }
        if (!this._splatGsplat) {
            return;
        }

        const quality = typeof window !== 'undefined' ? window.actualQuality : null;
        let baseDist = 150;
        if (quality === 'low') {
            baseDist = 70;
        } else if (quality === 'med') {
            baseDist = 110;
        }
        this._splatGsplat.lodBaseDistance = baseDist;
    }

    /**
     * @param {number} dt - The time delta.
     */
    update(dt) {
        dt = Math.min(dt, 0.1);
        const { keyCode } = KeyboardMouseSource;

        const { key, button, mouse, wheel } = this._desktopInput.read();
        const { touch, pinch, count } = this._orbitMobileInput.read();
        const { leftStick, rightStick } = this._gamepadInput.read();
        this._flyMobileInput.read();

        // apply dead zone to gamepad sticks
        applyDeadZone(leftStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);
        applyDeadZone(rightStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);

        // update state
        this._state.axis.add(tmpV1.set(
            (key[keyCode.D] - key[keyCode.A]) + (key[keyCode.RIGHT] - key[keyCode.LEFT]),
            0,
            (key[keyCode.W] - key[keyCode.S]) + (key[keyCode.UP] - key[keyCode.DOWN])
        ));
        for (let i = 0; i < this._state.mouse.length; i++) {
            this._state.mouse[i] += button[i];
        }
        this._state.shift += key[keyCode.SHIFT];
        this._state.ctrl += key[keyCode.CTRL];
        this._state.touches += count[0];

        // inside the headset the head drives the camera
        if (this.app.xr?.active) {
            frame.read();
            return;
        }

        if (this._mode === 'focus') {
            // A flight to a viewpoint, running on its own. Any touch of the
            // controls hands the camera back.
            this._pose.copy(this._controller.update(frame, dt));
            const nudged = wheel[0] !== 0 || this._state.touches > 0 ||
                this._state.axis.lengthSq() > 0 || this._state.mouse[0] > 0 ||
                this._state.mouse[1] > 0 || this._state.mouse[2] > 0;
            if (nudged || this._focusController.complete()) {
                this._setMode('orbit');
            }
        } else {
            this._setMode('orbit');
            frame.read();
            this._navigate(dt, mouse, touch, pinch, leftStick, rightStick);
        }

        this._applyLimits();
        this._syncDistance();
        this._updateDetail();

        this._camera.entity.setPosition(this._pose.position);
        this._camera.entity.setEulerAngles(this._pose.angles);

        if (this._mode !== 'focus') {
            this._controller.attach(this._pose, false);
        }
    }
}

export { CameraControls };
