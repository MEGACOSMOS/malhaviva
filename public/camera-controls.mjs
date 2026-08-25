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
    PROJECTION_PERSPECTIVE,
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
        this._pose.look(position, focus);
        this._controller.attach(this._pose, false);
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

        // update state
        this._state.axis.add(tmpV1.set(
            (key[keyCode.D] - key[keyCode.A]) + (key[keyCode.RIGHT] - key[keyCode.LEFT]),
            0, // Q and E keys disabled: (key[keyCode.E] - key[keyCode.Q]),
            (key[keyCode.W] - key[keyCode.S]) + (key[keyCode.UP] - key[keyCode.DOWN])
        ));
        for (let i = 0; i < this._state.mouse.length; i++) {
            this._state.mouse[i] += button[i];
        }
        this._state.shift += key[keyCode.SHIFT];
        this._state.ctrl += key[keyCode.CTRL];
        this._state.touches += count[0];

        // FPS: Always Fly Mode
        this._setMode('fly');

        const orbit = +(this._mode === 'orbit');
        const fly = +(this._mode === 'fly');
        const double = +(this._state.touches > 1);
        const desktopPan = +(this._state.shift || this._state.mouse[1]);
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

        // desktop move
        const keyMove = this._state.axis.clone().normalize();
        
        const panMove = screenToWorld(this._camera, mouse[0], mouse[1], this._pose.distance);
        const v = tmpV1.set(0, 0, 0); // Reuse v for rotate below
        v.add(panMove.mulScalar(orbit * desktopPan * +this.enablePan));
        
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

        // Apply continuous zoom
        if (double === 1 && activePinch !== 0) {
            this._targetFov += activePinch * 0.2; // Inverted zoom direction
            this._targetFov = Math.max(15, Math.min(this._initialFov, this._targetFov));
        }

        // Apply slide directly to keyMove for WASD mapping
        if (double === 1 && (activeTouchX !== 0 || activeTouchY !== 0)) {
            keyMove.x -= activeTouchX * 0.10; // Inverted X
            keyMove.z += activeTouchY * 0.10; // Inverted Z
        }

        // Interpolação suave (lerp)
        if (Math.abs(this._targetFov - this._camera.fov) > 0.1) {
            this._camera.fov = math.lerp(this._camera.fov, this._targetFov, 12.0 * dt);
        } else {
            this._camera.fov = this._targetFov;
        }

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
                let baseDist = 350;
                if (isLow) baseDist = 70;
                else if (isMed) baseDist = 110;
                
                this._splatGsplat.lodBaseDistance = baseDist * fovRatio;
            }
        }

        // desktop rotate (Drag to Look)
        v.set(0, 0, 0);
        
        if (!this._smoothRotateVelocity) {
            this._smoothRotateVelocity = new Vec3(0, 0, 0);
        }
        
        // Target rotation based on mouse input with slight speed reduction (0.8)
        const targetRotate = tmpV2.set(mouse[0] * 0.8, mouse[1] * 0.8, 0).mulScalar(rotateDeltaMult);
        
        // Apply ease in and out (inertia)
        this._smoothRotateVelocity.lerp(this._smoothRotateVelocity, targetRotate, 5.0 * dt);
        
        v.add(this._smoothRotateVelocity);
        deltas.rotate.append([v.x, v.y, v.z]);


        // mobile rotate (1-finger drag -> Look around)
        v.set(0, 0, 0);
        const touchRotate = tmpV2.set(touch[0], touch[1], 0);
        // Multiply by (1 - double) so it only activates when exactly 1 finger is down.
        v.add(touchRotate.mulScalar((1 - double) * rotateDeltaMult));
        deltas.rotate.append([v.x, v.y, v.z]);

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
            // NO ATTACH HERE!
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

        // Ground Collision Limit
        if (this._pose.position.y < 1.0) {
            this._pose.position.y = 1.0;
            if (this._mode === 'orbit') {
                const focus = this._pose.getFocus(tmpV2).clone();
                this._pose.look(this._pose.position, focus);
                this._controller.attach(this._pose, false);
            }
        }

        // Ceiling Collision Limit (Max Y)
        const MAX_Y = 63.28;
        if (this._pose.position.y > MAX_Y) {
            this._pose.position.y = MAX_Y;
            if (this._mode === 'orbit') {
                const focus = this._pose.getFocus(tmpV2).clone();
                this._pose.look(this._pose.position, focus);
                this._controller.attach(this._pose, false);
            }
        }

        let isAtBoundary = false;
        const EDGE_EPS = 0.01;

        if (this._playArea) {
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
        } else if (this.maxDistance > 0 && this._pose.position.length() >= this.maxDistance - EDGE_EPS) {
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

        this._camera.entity.setPosition(this._pose.position);
        this._camera.entity.setEulerAngles(this._pose.angles);
        
        this._lastValidPos.copy(this._pose.position);
        this._lastValidAngles.copy(this._pose.angles);
    }
}

export { CameraControls };
