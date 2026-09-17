import { basisInitialize, WasmModule, Vec3, Color, Vec4, Quat, Vec2, createGraphicsDevice, AppOptions, Keyboard, Mouse, ElementInput, AnimComponentSystem, AnimationComponentSystem, AudioListenerComponentSystem, ButtonComponentSystem, CameraComponentSystem, CollisionComponentSystem, ElementComponentSystem, GSplatComponentSystem, JointComponentSystem, LayoutChildComponentSystem, LayoutGroupComponentSystem, LightComponentSystem, ModelComponentSystem, ParticleSystemComponentSystem, RenderComponentSystem, RigidBodyComponentSystem, ScreenComponentSystem, ScriptComponentSystem, ScrollbarComponentSystem, ScrollViewComponentSystem, SoundComponentSystem, SpriteComponentSystem, ZoneComponentSystem, AnimClipHandler, AnimationHandler, AnimStateGraphHandler, AudioHandler, BinaryHandler, CssHandler, ContainerHandler, CubemapHandler, FolderHandler, FontHandler, GSplatHandler, HierarchyHandler, HtmlHandler, JsonHandler, MaterialHandler, ModelHandler, RenderHandler, ScriptHandler, SceneHandler, ShaderHandler, SpriteHandler, TemplateHandler, TextHandler, TextureAtlasHandler, TextureHandler, SoundManager, Lightmapper, BatchManager, XrManager, AppBase, FILLMODE_NONE, RESOLUTION_AUTO, Picker, MeshInstance, Entity, Asset, SPRITE_RENDERMODE_SIMPLE, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, BUTTON_TRANSITION_MODE_TINT, BUTTON_TRANSITION_MODE_SPRITE_CHANGE, TONEMAP_NONE, PROJECTION_PERSPECTIVE, GAMMA_SRGB, GAMMA_NONE, XRTYPE_VR, TONEMAP_LINEAR, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_NEUTRAL, PROJECTION_ORTHOGRAPHIC, ORIENTATION_HORIZONTAL, FITTING_NONE, FITTING_STRETCH, FITTING_SHRINK, FITTING_BOTH, ORIENTATION_VERTICAL, SHADOW_PCF3_32F, SHADOW_PCF1_16F, SHADOW_PCF1_32F, SHADOW_PCF3_16F, SHADOW_PCF5_16F, SHADOW_PCF5_32F, SHADOW_VSM_16F, SHADOW_VSM_32F, SHADOW_PCSS_32F, StandardMaterial, BLEND_NONE, CULLFACE_BACK, FRESNEL_SCHLICK, SPECOCC_AO, BLEND_NORMAL, BLEND_ADDITIVE, BLEND_ADDITIVEALPHA, BLEND_PREMULTIPLIED, BLEND_MULTIPLICATIVE, BLEND_MULTIPLICATIVE2X, BLEND_SCREEN, BLEND_MIN, BLEND_MAX, BLEND_SUBTRACTIVE, CULLFACE_NONE, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, FRESNEL_NONE, SPECOCC_NONE, SPECOCC_GLOSSDEPENDENT, SCALEMODE_NONE, SCALEMODE_BLEND, SCROLL_MODE_BOUNCE, SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED, SCROLLBAR_VISIBILITY_SHOW_ALWAYS, SCROLL_MODE_CLAMP, SCROLL_MODE_INFINITE, EnvLighting, LAYERID_SKYBOX } from 'playcanvas';

/**
 * Base class for all PlayCanvas Web Components that initialize asynchronously.
 *
 * @fires {CustomEvent} ready - Fired when the element is fully initialized — once per readiness
 * cycle, so an element that is torn down and re-initialized (for example by removing and
 * re-inserting it) fires it again. Bubbles and is composed.
 */
class AsyncElement extends HTMLElement {
    _readyPromise;
    _readyResolve;
    _readyResolved = false;
    /** @ignore */
    constructor() {
        super();
        this._readyPromise = new Promise((resolve) => {
            this._readyResolve = resolve;
        });
    }
    /**
     * The nearest ancestor `<pc-app>` element, or `null` if this element has no `<pc-app>`
     * ancestor. The search starts at the parent, so an element never resolves to itself.
     * @returns The closest app element, or `null`.
     */
    get closestApp() {
        return this.parentElement?.closest('pc-app') ?? null;
    }
    /**
     * The nearest ancestor element that fronts an entity — `<pc-entity>` or `<pc-node>` — or
     * `null` if this element has no such ancestor. The search starts at the parent, so an element
     * never resolves to itself.
     * @returns The closest entity-fronting element, or `null`.
     */
    get closestEntity() {
        return this.parentElement?.closest('pc-entity, pc-node') ?? null;
    }
    /**
     * Called when the element is fully initialized and ready. Subclasses should call this when
     * they're ready. Resolves the ready promise and dispatches a bubbling, composed `ready`
     * event. Signals at most once per readiness cycle: a repeat call before {@link _resetReady}
     * has re-armed the promise does nothing.
     */
    _onReady() {
        if (this._readyResolved)
            return;
        this._readyResolved = true;
        this._readyResolve();
        this.dispatchEvent(new CustomEvent('ready', { bubbles: true, composed: true }));
    }
    /**
     * Returns the ready promise to its pending state. Subclasses should call this when the
     * resource their readiness announced is torn down (typically from `disconnectedCallback`),
     * so that a later re-initialization can signal readiness again. Does nothing while the
     * promise is still pending — an in-flight waiter carries over to the next readiness cycle
     * rather than being stranded on a promise nothing will ever resolve.
     */
    _resetReady() {
        if (!this._readyResolved)
            return;
        this._readyResolved = false;
        this._readyPromise = new Promise((resolve) => {
            this._readyResolve = resolve;
        });
    }
    /**
     * Returns a promise that resolves with this element when it's ready. This is the low-level
     * primitive underlying {@link whenReady}, which is the recommended way to wait for elements.
     *
     * Readiness tracks the element's current lifecycle: once a ready element is torn down (for
     * example by removing it from the document), this returns a fresh promise that resolves when
     * the element is next ready. A promise obtained earlier stays resolved — call this again
     * after re-inserting an element rather than reusing a promise from before its removal.
     * @returns A promise that resolves with this element when it's ready.
     */
    ready() {
        return this._readyPromise.then(() => this);
    }
}
async function whenReady(target) {
    let element;
    if (typeof target === 'string') {
        if (document.readyState === 'loading') {
            await new Promise((resolve) => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }
        try {
            element = document.querySelector(target);
        }
        catch {
            throw new Error(`whenReady: '${target}' is not a valid CSS selector`);
        }
        if (!element) {
            throw new Error(`whenReady: no element found matching '${target}'`);
        }
    }
    else {
        element = target;
    }
    if (!(element instanceof AsyncElement)) {
        const description = element instanceof Element ? `<${element.tagName.toLowerCase()}>` : String(target);
        throw new Error(`whenReady: ${description} does not initialize asynchronously`);
    }
    await element.ready();
    return element;
}

/**
 * The ModuleElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-module/ | `<pc-module>`}
 * elements. The ModuleElement interface also inherits the properties and methods of the
 * {@link AsyncElement} interface.
 *
 * The attributes are read once, when the module starts loading - on the element's first
 * connection, or earlier if a containing `<pc-app>` boots first and collects it - so changing
 * them later has no effect. The element becomes ready once the module has loaded. WebAssembly
 * modules configure engine-global state that never unloads, so readiness is not re-armed by
 * removing the element, and a re-inserted element does not load again.
 *
 * A `<pc-module>` without a `name` warns and never becomes ready; a containing `<pc-app>` still
 * boots.
 *
 * @attribute {string} name - The name of the WebAssembly module to configure, e.g. `Basis` or
 * `Ammo`.
 * @attribute {string} glue - The URL of the module's glue script.
 * @attribute {string} wasm - The URL of the module's WebAssembly binary.
 * @attribute {string} fallback - The URL of the module's asm.js fallback script, used when
 * WebAssembly is unavailable.
 */
class ModuleElement extends AsyncElement {
    _loadPromise = null;
    connectedCallback() {
        this._getLoadPromise();
    }
    async _loadModule() {
        const name = this.getAttribute('name');
        if (!name) {
            console.warn("pc-module requires a 'name' attribute - no module was configured");
            return;
        }
        const config = {
            glueUrl: this.getAttribute('glue') ?? undefined,
            wasmUrl: this.getAttribute('wasm') ?? undefined,
            fallbackUrl: this.getAttribute('fallback') ?? undefined
        };
        if (name === 'Basis') {
            basisInitialize(config);
        }
        else {
            WasmModule.setConfig(name, config);
            await new Promise((resolve) => {
                WasmModule.getInstance(name, () => resolve());
            });
        }
        this._onReady();
    }
    /**
     * Returns the promise that settles when the module has loaded, starting the load if it has
     * not already started - a containing `<pc-app>` boots in document order, so it may collect
     * this element before the element's own connectedCallback has run. A missing `name` resolves
     * the promise without configuring anything, so a misconfigured module never blocks the app.
     *
     * @returns The load promise.
     * @internal
     */
    _getLoadPromise() {
        if (!this._loadPromise) {
            this._loadPromise = this._loadModule();
        }
        return this._loadPromise;
    }
}
customElements.define('pc-module', ModuleElement);

/** Covers the 0.2s opacity transition; jsdom never fires transitionend, so removal is timed. */
const REMOVAL_DELAY_MS = 250;
/**
 * The slim progress bar `<pc-app>` shows while it boots and preloads. An implementation detail of
 * AppElement rather than a custom element, so its shape can change without a breaking change.
 *
 * All styling is inline, so the library injects no stylesheet. The colors and height resolve CSS
 * custom properties — `--pc-loading-bar-color`, `--pc-loading-bar-background` and
 * `--pc-loading-bar-height` — so a page can theme the bar from `pc-app` or `:root`.
 * @internal
 */
class LoadingBar {
    _track;
    _fill;
    _sweep = null;
    _removal = null;
    /**
     * Creates the bar and appends it to `parent`, starting in the indeterminate state.
     * @param parent - The element to append the bar to.
     */
    constructor(parent) {
        this._track = document.createElement('div');
        this._track.setAttribute('role', 'progressbar');
        this._track.setAttribute('aria-label', 'Loading');
        this._track.setAttribute('aria-valuemin', '0');
        this._track.setAttribute('aria-valuemax', '100');
        // Anchored to the pc-app element, which the library's base styles make a positioned box
        this._track.style.cssText = [
            'position: absolute',
            'top: 0',
            'left: 0',
            'width: 100%',
            'height: var(--pc-loading-bar-height, 3px)',
            'background: var(--pc-loading-bar-background, rgba(0, 0, 0, 0.1))',
            'z-index: 10000',
            'pointer-events: none',
            'opacity: 1',
            'transition: opacity 0.2s ease'
        ].join('; ');
        this._fill = document.createElement('div');
        this._fill.style.cssText = [
            'width: 100%',
            'height: 100%',
            'transform-origin: left center',
            'transform: scaleX(0)',
            'background: var(--pc-loading-bar-color, #f60)',
            'transition: transform 0.2s ease'
        ].join('; ');
        this._track.appendChild(this._fill);
        parent.appendChild(this._track);
        // Indeterminate sweep until the first progress() call reports a real total. No
        // aria-valuenow is set, which is what marks a progressbar indeterminate. jsdom has no Web
        // Animations API, so the guard degrades to a static bar there rather than crashing boot.
        if (typeof this._fill.animate === 'function') {
            this._sweep = this._fill.animate([{ transform: 'scaleX(0.25) translateX(-100%)' }, { transform: 'scaleX(0.25) translateX(500%)' }], {
                duration: 1000,
                iterations: Infinity,
                easing: 'ease-in-out'
            });
        }
    }
    /**
     * Reflects preload progress, switching the bar from indeterminate to determinate on the first
     * call.
     * @param loaded - The number of assets that have finished loading.
     * @param total - The number of assets being preloaded.
     */
    progress(loaded, total) {
        if (this._sweep) {
            this._sweep.cancel();
            this._sweep = null;
        }
        const fraction = total === 0 ? 1 : loaded / total;
        this._track.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
        this._fill.style.transform = `scaleX(${fraction})`;
    }
    /**
     * Fills the bar, fades it out and removes it. Idempotent.
     */
    complete() {
        if (this._removal !== null) {
            return;
        }
        if (this._sweep) {
            this._sweep.cancel();
            this._sweep = null;
        }
        this._track.setAttribute('aria-valuenow', '100');
        this._fill.style.transform = 'scaleX(1)';
        this._track.style.opacity = '0';
        this._removal = setTimeout(() => this._track.remove(), REMOVAL_DELAY_MS);
    }
    /**
     * Removes the bar immediately, cancelling any pending fade. Idempotent.
     */
    destroy() {
        if (this._sweep) {
            this._sweep.cancel();
            this._sweep = null;
        }
        if (this._removal !== null) {
            clearTimeout(this._removal);
            this._removal = null;
        }
        this._track.remove();
    }
}

/**
 * The CSS color keywords, lowercase name to hex value. Read by `parseColor` to accept color
 * names as attribute values.
 * @internal
 */
const CSS_COLORS = {
    aliceblue: '#f0f8ff',
    antiquewhite: '#faebd7',
    aqua: '#00ffff',
    aquamarine: '#7fffd4',
    azure: '#f0ffff',
    beige: '#f5f5dc',
    bisque: '#ffe4c4',
    black: '#000000',
    blanchedalmond: '#ffebcd',
    blue: '#0000ff',
    blueviolet: '#8a2be2',
    brown: '#a52a2a',
    burlywood: '#deb887',
    cadetblue: '#5f9ea0',
    chartreuse: '#7fff00',
    chocolate: '#d2691e',
    coral: '#ff7f50',
    cornflowerblue: '#6495ed',
    cornsilk: '#fff8dc',
    crimson: '#dc143c',
    cyan: '#00ffff',
    darkblue: '#00008b',
    darkcyan: '#008b8b',
    darkgoldenrod: '#b8860b',
    darkgray: '#a9a9a9',
    darkgreen: '#006400',
    darkgrey: '#a9a9a9',
    darkkhaki: '#bdb76b',
    darkmagenta: '#8b008b',
    darkolivegreen: '#556b2f',
    darkorange: '#ff8c00',
    darkorchid: '#9932cc',
    darkred: '#8b0000',
    darksalmon: '#e9967a',
    darkseagreen: '#8fbc8f',
    darkslateblue: '#483d8b',
    darkslategray: '#2f4f4f',
    darkslategrey: '#2f4f4f',
    darkturquoise: '#00ced1',
    darkviolet: '#9400d3',
    deeppink: '#ff1493',
    deepskyblue: '#00bfff',
    dimgray: '#696969',
    dimgrey: '#696969',
    dodgerblue: '#1e90ff',
    firebrick: '#b22222',
    floralwhite: '#fffaf0',
    forestgreen: '#228b22',
    fuchsia: '#ff00ff',
    gainsboro: '#dcdcdc',
    ghostwhite: '#f8f8ff',
    gold: '#ffd700',
    goldenrod: '#daa520',
    gray: '#808080',
    green: '#008000',
    greenyellow: '#adff2f',
    grey: '#808080',
    honeydew: '#f0fff0',
    hotpink: '#ff69b4',
    indianred: '#cd5c5c',
    indigo: '#4b0082',
    ivory: '#fffff0',
    khaki: '#f0e68c',
    lavender: '#e6e6fa',
    lavenderblush: '#fff0f5',
    lawngreen: '#7cfc00',
    lemonchiffon: '#fffacd',
    lightblue: '#add8e6',
    lightcoral: '#f08080',
    lightcyan: '#e0ffff',
    lightgoldenrodyellow: '#fafad2',
    lightgray: '#d3d3d3',
    lightgreen: '#90ee90',
    lightgrey: '#d3d3d3',
    lightpink: '#ffb6c1',
    lightsalmon: '#ffa07a',
    lightseagreen: '#20b2aa',
    lightskyblue: '#87cefa',
    lightslategray: '#778899',
    lightslategrey: '#778899',
    lightsteelblue: '#b0c4de',
    lightyellow: '#ffffe0',
    lime: '#00ff00',
    limegreen: '#32cd32',
    linen: '#faf0e6',
    magenta: '#ff00ff',
    maroon: '#800000',
    mediumaquamarine: '#66cdaa',
    mediumblue: '#0000cd',
    mediumorchid: '#ba55d3',
    mediumpurple: '#9370db',
    mediumseagreen: '#3cb371',
    mediumslateblue: '#7b68ee',
    mediumspringgreen: '#00fa9a',
    mediumturquoise: '#48d1cc',
    mediumvioletred: '#c71585',
    midnightblue: '#191970',
    mintcream: '#f5fffa',
    mistyrose: '#ffe4e1',
    moccasin: '#ffe4b5',
    navajowhite: '#ffdead',
    navy: '#000080',
    oldlace: '#fdf5e6',
    olive: '#808000',
    olivedrab: '#6b8e23',
    orange: '#ffa500',
    orangered: '#ff4500',
    orchid: '#da70d6',
    palegoldenrod: '#eee8aa',
    palegreen: '#98fb98',
    paleturquoise: '#afeeee',
    palevioletred: '#db7093',
    papayawhip: '#ffefd5',
    peachpuff: '#ffdab9',
    peru: '#cd853f',
    pink: '#ffc0cb',
    plum: '#dda0dd',
    powderblue: '#b0e0e6',
    purple: '#800080',
    rebeccapurple: '#663399',
    red: '#ff0000',
    rosybrown: '#bc8f8f',
    royalblue: '#4169e1',
    saddlebrown: '#8b4513',
    salmon: '#fa8072',
    sandybrown: '#f4a460',
    seagreen: '#2e8b57',
    seashell: '#fff5ee',
    sienna: '#a0522d',
    silver: '#c0c0c0',
    skyblue: '#87ceeb',
    slateblue: '#6a5acd',
    slategray: '#708090',
    slategrey: '#708090',
    snow: '#fffafa',
    springgreen: '#00ff7f',
    steelblue: '#4682b4',
    tan: '#d2b48c',
    teal: '#008080',
    thistle: '#d8bfd8',
    tomato: '#ff6347',
    turquoise: '#40e0d0',
    violet: '#ee82ee',
    wheat: '#f5deb3',
    white: '#ffffff',
    whitesmoke: '#f5f5f5',
    yellow: '#ffff00',
    yellowgreen: '#9acd32'
};

/**
 * Converts HTML attribute values into the values the engine expects. Every element's
 * `attributeChangedCallback` funnels through this module.
 *
 * The parsers share one contract:
 *
 * - A `null` value means the attribute is absent or was removed, and yields the supplied default.
 * - A malformed value yields the same default and logs exactly one `console.warn` naming the
 *   attribute, so misuse is reported rather than thrown — nothing here throws or rejects.
 * - A math-type default is cloned on the way out, which is what makes it safe to pass the engine's
 *   shared frozen constants (`Vec3.ZERO`, `Color.WHITE`) as defaults.
 * - `parseBool` and `parseTags` take no attribute name, because every value is valid for them and
 *   so they never warn.
 *
 * `getEntity` is the exception: it resolves a reference to a live entity rather than parsing a
 * literal, and returns `null` instead of falling back to a default.
 */
/**
 * Splits an attribute value into exactly `count` numeric components. Returns `null` when the
 * value does not consist of exactly `count` whitespace-separated finite numbers.
 *
 * @param value - The value to split.
 * @param count - The required number of components.
 * @returns The parsed components, or `null`.
 * @internal
 */
const parseComponents = (value, count) => {
    const components = value.trim().split(/\s+/).map(Number);
    if (components.length !== count || components.some((component) => !Number.isFinite(component))) {
        return null;
    }
    return components;
};
/**
 * Clones a math-type default so parsed results never alias the caller's default instance. This
 * is what makes it safe to pass the engine's shared frozen constants (e.g. `Vec3.ZERO`,
 * `Color.WHITE`) as defaults.
 *
 * @param value - The default value to clone (`null` is passed through).
 * @returns The cloned value.
 */
const cloneDefault = (value) => {
    return (value === null ? null : value.clone());
};
/**
 * Parse a boolean attribute value. The same rules apply to every boolean attribute:
 *
 * - Attribute absent (or removed): the supplied default is used.
 * - Attribute set to the string 'false': `false`.
 * - Attribute present with any other value, including the empty string of a bare boolean
 *   attribute (e.g. `<pc-light cast-shadows>`): `true`.
 *
 * @param value - The attribute value to parse (`null` when the attribute is absent).
 * @param defaultValue - The value to use when the attribute is absent or removed.
 * @returns The parsed boolean.
 * @internal
 */
const parseBool = (value, defaultValue) => {
    return value === null ? defaultValue : value !== 'false';
};
/**
 * Parse a color attribute value. The expected format is a CSS color name (e.g. 'rebeccapurple'),
 * a hex color (e.g. '#ff0000' or '#f00'), or 3 or 4 space-separated numbers in the range 0 to 1
 * (e.g. '1 0.5 0.5' or '1 0.5 0.5 0.5'). Returns `defaultValue` (cloned, when it is a color)
 * when the attribute is absent (`null`), or when the value is malformed — the latter also logs
 * a warning.
 *
 * @param value - The attribute value to parse (`null` when the attribute is absent).
 * @param defaultValue - The value to use when the attribute is absent or invalid.
 * @param attribute - The attribute name, used in the warning message.
 * @returns The parsed Color object.
 * @internal
 */
const parseColor = (value, defaultValue, attribute) => {
    if (value === null) {
        return cloneDefault(defaultValue);
    }
    // A CSS color name (e.g. 'rebeccapurple')
    const hexColor = CSS_COLORS[value.toLowerCase()];
    if (hexColor) {
        return new Color().fromString(hexColor);
    }
    // A hex color (e.g. '#ff0000'), expanding short forms (e.g. '#f00') for Color.fromString
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
        let hex = value.slice(1);
        if (hex.length === 3 || hex.length === 4) {
            hex = hex
                .split('')
                .map((char) => char + char)
                .join('');
        }
        return new Color().fromString(`#${hex}`);
    }
    // 3 or 4 space-separated components (e.g. '1 0.5 0.5')
    const components = parseComponents(value, 4) ?? parseComponents(value, 3);
    if (components) {
        return new Color(components);
    }
    console.warn(`Invalid value '${value}' for attribute '${attribute}'. Expected a CSS color name, a hex color or 3 or 4 space-separated numbers. Using '${defaultValue}'.`);
    return cloneDefault(defaultValue);
};
/**
 * Resolves an enum attribute value against its set of valid names. Returns the value when it is
 * one of the valid names. Returns `defaultValue` when the attribute is absent (`null`), or when
 * the value is invalid — the latter also logs a warning listing the valid names.
 *
 * @param value - The attribute value to parse (`null` when the attribute is absent).
 * @param valid - The valid names: an array, or a map whose keys are the valid names. Only the keys
 * are read, so the map's value type is unconstrained - engine enums are mostly numeric constants,
 * but some (e.g. `SCALEMODE_BLEND`) are strings.
 * @param defaultValue - The value to use when the attribute is absent or invalid.
 * @param attribute - The attribute name, used in the warning message.
 * @returns The resolved enum name.
 * @internal
 */
const parseEnum = (value, valid, defaultValue, attribute) => {
    if (value === null) {
        return defaultValue;
    }
    const names = Array.isArray(valid) ? valid : [...valid.keys()];
    if (names.includes(value)) {
        return value;
    }
    console.warn(`Invalid value '${value}' for attribute '${attribute}'. Valid values: ${names.join(', ')}. Using '${defaultValue}'.`);
    return defaultValue;
};
/**
 * Parses a number attribute value. Returns the parsed number when the value is a finite number.
 * Returns `defaultValue` when the attribute is absent (`null`), or when the value is not a
 * finite number — the latter also logs a warning.
 *
 * @param value - The attribute value to parse (`null` when the attribute is absent).
 * @param defaultValue - The value to use when the attribute is absent or invalid.
 * @param attribute - The attribute name, used in the warning message.
 * @returns The parsed number.
 * @internal
 */
const parseNumber = (value, defaultValue, attribute) => {
    if (value === null) {
        return defaultValue;
    }
    const number = value.trim() === '' ? NaN : Number(value);
    if (!Number.isFinite(number)) {
        console.warn(`Invalid value '${value}' for attribute '${attribute}'. Expected a finite number. Using '${defaultValue}'.`);
        return defaultValue;
    }
    return number;
};
/**
 * Parse an Euler-angles attribute value into a quaternion. The expected format is 3
 * space-separated angles in degrees (e.g. '0 90 0'). Returns `defaultValue` (cloned, when it is
 * a quaternion) when the attribute is absent (`null`), or when the value is malformed — the
 * latter also logs a warning.
 *
 * @param value - The attribute value to parse (`null` when the attribute is absent).
 * @param defaultValue - The value to use when the attribute is absent or invalid.
 * @param attribute - The attribute name, used in the warning message.
 * @returns The parsed Quat object.
 * @internal
 */
const parseQuat = (value, defaultValue, attribute) => {
    if (value === null) {
        return cloneDefault(defaultValue);
    }
    const components = parseComponents(value, 3);
    if (!components) {
        console.warn(`Invalid value '${value}' for attribute '${attribute}'. Expected 3 space-separated numbers. Using '${defaultValue}'.`);
        return cloneDefault(defaultValue);
    }
    return new Quat().setFromEulerAngles(components[0], components[1], components[2]);
};
/**
 * Parse a tags attribute value. The expected format is a comma-separated list of tag names
 * (e.g. 'enemy, flying'). Surrounding whitespace is trimmed from each name and empty names are
 * discarded, so a trailing comma or a doubled separator does not produce a blank tag. Returns a
 * copy of `defaultValue` when the attribute is absent or removed (`null`).
 *
 * Every value is valid, so this never warns.
 *
 * @param value - The attribute value to parse (`null` when the attribute is absent).
 * @param defaultValue - The value to use when the attribute is absent or removed.
 * @returns The parsed tag names.
 * @internal
 */
const parseTags = (value, defaultValue = []) => {
    if (value === null) {
        // Copied for the same reason cloneDefault exists: a parsed result must never alias the
        // caller's default, or a later mutation would write back through it.
        return [...defaultValue];
    }
    return value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== '');
};
/**
 * Parse a Vec2 attribute value. The expected format is 2 space-separated numbers (e.g. '1 2').
 * Returns `defaultValue` (cloned, when it is a vector) when the attribute is absent (`null`),
 * or when the value is malformed — the latter also logs a warning.
 *
 * @param value - The attribute value to parse (`null` when the attribute is absent).
 * @param defaultValue - The value to use when the attribute is absent or invalid.
 * @param attribute - The attribute name, used in the warning message.
 * @returns The parsed Vec2 object.
 * @internal
 */
const parseVec2 = (value, defaultValue, attribute) => {
    if (value === null) {
        return cloneDefault(defaultValue);
    }
    const components = parseComponents(value, 2);
    if (!components) {
        console.warn(`Invalid value '${value}' for attribute '${attribute}'. Expected 2 space-separated numbers. Using '${defaultValue}'.`);
        return cloneDefault(defaultValue);
    }
    return new Vec2(components);
};
/**
 * Parse a Vec3 attribute value. The expected format is 3 space-separated numbers (e.g. '1 2 3').
 * Returns `defaultValue` (cloned, when it is a vector) when the attribute is absent (`null`),
 * or when the value is malformed — the latter also logs a warning.
 *
 * @param value - The attribute value to parse (`null` when the attribute is absent).
 * @param defaultValue - The value to use when the attribute is absent or invalid.
 * @param attribute - The attribute name, used in the warning message.
 * @returns The parsed Vec3 object.
 * @internal
 */
const parseVec3 = (value, defaultValue, attribute) => {
    if (value === null) {
        return cloneDefault(defaultValue);
    }
    const components = parseComponents(value, 3);
    if (!components) {
        console.warn(`Invalid value '${value}' for attribute '${attribute}'. Expected 3 space-separated numbers. Using '${defaultValue}'.`);
        return cloneDefault(defaultValue);
    }
    return new Vec3(components);
};
/**
 * Parse a Vec4 attribute value. The expected format is 4 space-separated numbers
 * (e.g. '1 2 3 4'). Returns `defaultValue` (cloned, when it is a vector) when the attribute is
 * absent (`null`), or when the value is malformed — the latter also logs a warning.
 *
 * @param value - The attribute value to parse (`null` when the attribute is absent).
 * @param defaultValue - The value to use when the attribute is absent or invalid.
 * @param attribute - The attribute name, used in the warning message.
 * @returns The parsed Vec4 object.
 * @internal
 */
const parseVec4 = (value, defaultValue, attribute) => {
    if (value === null) {
        return cloneDefault(defaultValue);
    }
    const components = parseComponents(value, 4);
    if (!components) {
        console.warn(`Invalid value '${value}' for attribute '${attribute}'. Expected 4 space-separated numbers. Using '${defaultValue}'.`);
        return cloneDefault(defaultValue);
    }
    return new Vec4(components);
};
/**
 * Resolves a reference string to the {@link Entity} backing a `<pc-entity>` element. The reference
 * can be a CSS selector (e.g. `#my-id`, `pc-entity[name="Foo"]`), a bare element id, or a bare
 * entity name. Returns `null` if no matching element (or backing entity) is found.
 *
 * @param ref - The reference string to resolve.
 * @returns The resolved entity, or `null`.
 * @internal
 */
const getEntity = (ref) => {
    if (!ref) {
        return null;
    }
    let element = null;
    // Try the reference as a CSS selector. An invalid selector (e.g. a bare name containing
    // spaces) throws, in which case we fall back to id/name lookups below.
    try {
        element = document.querySelector(ref);
    }
    catch {
        element = null;
    }
    if (!element) {
        element = document.getElementById(ref) ?? document.querySelector(`pc-entity[name="${ref}"]`);
    }
    return element?.entity ?? null;
};

/** The pointer event types the application synthesizes on `<pc-entity>` elements via picking. */
const pointerEventTypes = ['pointermove', 'pointerdown', 'pointerup', 'pointerenter', 'pointerleave'];
/**
 * Gives `pc-app` the sizing contract of a replaced element (`<video>`, `<img>`): a block-level
 * box that the page's CSS sizes, defaulting to the canvas's own 300x150 intrinsic size, with the
 * canvas and loading bar anchored to it. `:where()` keeps every declaration at zero specificity,
 * so any page rule - however plain - overrides these defaults.
 */
const ensureBaseStyles = () => {
    const id = 'pc-app-styles';
    if (document.getElementById(id)) {
        return;
    }
    const style = document.createElement('style');
    style.id = id;
    style.textContent = ':where(pc-app) { display: block; position: relative; width: 300px; height: 150px; }';
    document.head.appendChild(style);
};
/**
 * The AppElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-app/ | `<pc-app>`} elements.
 * The AppElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * The element is sized like a replaced element such as `<video>`: a block-level box that the
 * page's CSS controls, 300x150 by default. The application's canvas always fills the element,
 * and the drawing buffer resolution follows the element's size (capped by `max-pixel-ratio`),
 * tracked live via a ResizeObserver — so the element can be embedded at any size, resized by
 * its container, or made fullscreen with ordinary CSS such as `width: 100vw; height: 100dvh`.
 *
 * @fires {ProgressEvent} progress - Fired while the application preloads its assets. `loaded` and
 * `total` are asset counts, not bytes, and an asset that fails to load still counts as loaded.
 * Fired at least once per boot, and the final event always has `loaded` equal to `total`. Does
 * not bubble.
 *
 * @fires {ErrorEvent} error - Fired when the application cannot boot because no graphics device
 * could be created (for example, a browser with WebGL disabled). `message` names the requested
 * backends and `error` holds the underlying failure. The element never becomes ready
 * and `app` stays `null` — listen for this event to show a fallback UI. Removing the element and
 * re-inserting it retries the boot with its current attributes. Does not bubble.
 */
class AppElement extends AsyncElement {
    /**
     * The canvas element.
     */
    _canvas = null;
    _alpha = true;
    _backend = 'webgpu';
    _antialias = true;
    _depthBuffer = true;
    _stencilBuffer = true;
    _maxPixelRatio = Infinity;
    _loadingBar = true;
    /**
     * Set once the graphics options above have been handed to `createGraphicsDevice`, after which
     * writing any of them changes nothing. Guards the warning in {@link _warnIfBooted}, and is
     * cleared on disconnect so a re-connected element boots from its current attributes.
     */
    _optionsLocked = false;
    _bar = null;
    /**
     * Whether the application has created its initial entity hierarchy. Read by EntityElement to
     * decide whether a newly connected element must create its entity itself or leave it to the
     * boot sweep.
     * @internal
     */
    _hierarchyReady = false;
    /**
     * Incremented on every connect and disconnect. Boot captures the value on entry and abandons
     * itself wherever it resumes from an await if the value has moved on — so a boot whose
     * element was removed cannot complete against a torn-down element, and a boot whose element
     * was removed and re-inserted (which starts a boot of its own) cannot race the newer one.
     */
    _bootGeneration = 0;
    /**
     * The elements backing this application's entities, keyed by the entity itself. Registered
     * by EntityElement at creation (and NodeElement at binding) and removed when an entity is
     * destroyed or unbound, this joins engine scene nodes back to their owning elements by
     * identity - never by name.
     */
    _entityElements = new Map();
    _picker = null;
    _hasPointerListeners = {
        pointerenter: false,
        pointerleave: false,
        pointerdown: false,
        pointerup: false,
        pointermove: false
    };
    _hoveredEntity = null;
    // Identifies the newest in-flight hover pick, so out-of-order results can be discarded
    _pickToken = 0;
    _pointerHandlers = {
        pointermove: null,
        pointerdown: null,
        pointerup: null
    };
    _app = null;
    _loadProgress = 0;
    /**
     * Tracks the element's box so the drawing buffer and picker follow it. Created per boot once
     * the application exists, and disconnected on teardown. `null` where ResizeObserver is
     * unavailable (jsdom), where the boot-time resolution set is the only sizing that happens.
     */
    _resizeObserver = null;
    /**
     * The PlayCanvas application instance. `null` until the element is ready, and again once it
     * has been removed from the document — await {@link whenReady} or the element's `ready()`
     * promise before accessing it.
     * @returns The application instance, or `null`.
     */
    get app() {
        return this._app;
    }
    /**
     * The asset preload progress of the application, as a fraction from 0 to 1. It is 0 until
     * preloading begins (and again once the element has been removed from the document), and 1
     * once preloading has finished — including when there was nothing to preload. Read this to
     * initialize a loading UI; subsequent updates arrive via the `progress` event.
     * @returns The preload progress.
     */
    get loadProgress() {
        return this._loadProgress;
    }
    /**
     * Creates a new AppElement instance.
     *
     * @ignore
     */
    constructor() {
        super();
        // Track pointer listeners being added to and removed from descendant entities.
        // Registered once here rather than on every boot - the handlers no-op while there is no
        // canvas, and a re-booted element must not stack a second set.
        pointerEventTypes.forEach((type) => {
            this.addEventListener(`${type}:connect`, () => this._onPointerListenerAdded(type));
            this.addEventListener(`${type}:disconnect`, () => this._onPointerListenerRemoved(type));
        });
    }
    async connectedCallback() {
        const generation = ++this._bootGeneration;
        // Installed before the loading bar is created: the bar anchors to this element, which
        // these styles make a positioned block box
        ensureBaseStyles();
        // Created before the first await, so the bar is visible while modules and the graphics
        // device are created, and exists before any disconnect could need to clean it up
        if (this._loadingBar && !this._bar) {
            this._bar = new LoadingBar(this);
        }
        // Upgrade the subtree before reading anything out of it. A subtree cloned from a
        // <template> arrives entirely unupgraded - template content lives in an inert document,
        // where custom element definitions are never looked up - and appending the clone upgrades
        // its elements in tree order, this one before its descendants. The module query below would
        // otherwise find plain HTMLElements with no _getLoadPromise to call, and the boot would die
        // there, leaving the element permanently unready: no canvas, no entities, no application.
        //
        // Upgrading is the fix here rather than skipping whatever has not upgraded, because a
        // <pc-module> is the one child that nothing else ever builds on its own behalf - skipping
        // it would drop the wasm module the app asked for, silently and only for cloned apps.
        // Upgrading runs each descendant's connectedCallback synchronously, a few lines earlier
        // than the parser's path runs them but into the same state they see there: no application
        // yet and _hierarchyReady false, so they defer to the sweeps below. A descendant that
        // disconnects this element from there is caught by the generation check after the await,
        // as any other disconnect is. An already-upgraded subtree - every other insertion path -
        // is left completely untouched.
        customElements.upgrade(this);
        // Get all pc-module elements that are direct children of the pc-app element
        const moduleElements = this.querySelectorAll(':scope > pc-module');
        // Wait for all modules to load
        await Promise.all(Array.from(moduleElements).map((module) => module._getLoadPromise()));
        // The element may have been removed while the modules loaded. Nothing beyond the loading
        // bar exists yet, and disconnectedCallback has already destroyed that.
        if (generation !== this._bootGeneration) {
            return;
        }
        // Create and append the canvas, filling the element's content box - the page sizes the
        // element, and everything else follows. touch-action: none keeps touch drags driving the
        // engine's input handlers instead of scrolling the page.
        this._canvas = document.createElement('canvas');
        this._canvas.style.cssText = 'display: block; width: 100%; height: 100%; touch-action: none;';
        this.appendChild(this._canvas);
        // Configure device types based on backend selection
        const backendToDeviceTypes = {
            webgpu: ['webgpu', 'webgl2'], // fallback to webgl2 if webgpu not available
            webgl2: ['webgl2'],
            null: ['null']
        };
        const deviceTypes = backendToDeviceTypes[this._backend] || [];
        this._optionsLocked = true;
        // createGraphicsDevice appends its final null-device fallback to the array in place, so
        // the requested list is captured now for the failure message.
        const requested = deviceTypes.join(', ');
        let device;
        try {
            device = await createGraphicsDevice(this._canvas, {
                // @ts-ignore - alpha needs to be documented
                alpha: this._alpha,
                antialias: this._antialias,
                depth: this._depthBuffer,
                deviceTypes: deviceTypes,
                stencil: this._stencilBuffer
            });
        }
        catch (error) {
            // The element may have been removed while device creation was failing. The teardown
            // has already cleaned up, and the failure belongs to a boot that no longer owns the
            // element.
            if (generation !== this._bootGeneration) {
                return;
            }
            // Return the element to its pre-boot state - no dead canvas, no loading bar stuck at
            // zero - before announcing the failure. Readiness deliberately stays pending: nothing
            // it would announce (the app, the entity hierarchy) exists, so a device-less element
            // joins the documented never-ready cases and the failure surfaces through the error
            // event instead.
            if (this._canvas && this.contains(this._canvas)) {
                this.removeChild(this._canvas);
            }
            this._canvas = null;
            this._bar?.destroy();
            this._bar = null;
            const reason = error instanceof Error ? error.message : String(error);
            const message = `pc-app failed to create a graphics device (${requested}) - ${reason}`;
            console.error(message, error);
            this.dispatchEvent(new ErrorEvent('error', { message, error }));
            return;
        }
        // The element may have been removed while the device was created. disconnectedCallback
        // has already cleaned up the canvas; the device was created inside the await, so it is
        // this boot's to release.
        if (generation !== this._bootGeneration) {
            device.destroy();
            return;
        }
        // Assigned rather than resolved to a number here: the engine caps against the live
        // window.devicePixelRatio on every resize, so an uncapped Infinity keeps following the
        // display when a window moves between monitors of differing density.
        device.maxPixelRatio = this._maxPixelRatio;
        const createOptions = new AppOptions();
        createOptions.graphicsDevice = device;
        createOptions.keyboard = new Keyboard(window);
        createOptions.mouse = new Mouse(this._canvas);
        createOptions.elementInput = new ElementInput(this._canvas, {
            useMouse: true,
            useTouch: true
        });
        createOptions.componentSystems = [
            AnimComponentSystem,
            AnimationComponentSystem,
            AudioListenerComponentSystem,
            ButtonComponentSystem,
            CameraComponentSystem,
            CollisionComponentSystem,
            ElementComponentSystem,
            GSplatComponentSystem,
            JointComponentSystem,
            LayoutChildComponentSystem,
            LayoutGroupComponentSystem,
            LightComponentSystem,
            ModelComponentSystem,
            ParticleSystemComponentSystem,
            RenderComponentSystem,
            RigidBodyComponentSystem,
            ScreenComponentSystem,
            ScriptComponentSystem,
            ScrollbarComponentSystem,
            ScrollViewComponentSystem,
            SoundComponentSystem,
            SpriteComponentSystem,
            ZoneComponentSystem
        ];
        createOptions.resourceHandlers = [
            AnimClipHandler,
            AnimationHandler,
            AnimStateGraphHandler,
            AudioHandler,
            BinaryHandler,
            CssHandler,
            ContainerHandler,
            CubemapHandler,
            FolderHandler,
            FontHandler,
            GSplatHandler,
            HierarchyHandler,
            HtmlHandler,
            JsonHandler,
            MaterialHandler,
            ModelHandler,
            RenderHandler,
            ScriptHandler,
            SceneHandler,
            ShaderHandler,
            SpriteHandler,
            TemplateHandler,
            TextHandler,
            TextureAtlasHandler,
            TextureHandler
        ];
        createOptions.soundManager = new SoundManager();
        createOptions.lightmapper = Lightmapper;
        createOptions.batchManager = BatchManager;
        createOptions.xr = XrManager;
        const app = new AppBase(this._canvas);
        this._app = app;
        app.init(createOptions);
        // FILLMODE_NONE leaves the canvas's CSS sizing alone (the engine's other fill modes
        // stamp window-derived pixel sizes onto it); RESOLUTION_AUTO sizes the drawing buffer
        // from the canvas's client size
        app.setCanvasFillMode(FILLMODE_NONE);
        app.setCanvasResolution(RESOLUTION_AUTO);
        this._pickerCreate();
        // Track the element's box rather than the window: containers resize without any window
        // event (splitter drags, flex reflow, animations). Guarded because jsdom has no
        // ResizeObserver - there, the resolution set above is the only sizing that happens.
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this._syncCanvasSize());
            this._resizeObserver.observe(this);
        }
        // Get all pc-asset elements that are direct children of the pc-app element
        const assetElements = this.querySelectorAll(':scope > pc-asset');
        for (const assetElement of Array.from(assetElements)) {
            assetElement._createAsset();
            const asset = assetElement.asset;
            if (asset) {
                app.assets.add(asset);
                // Adding a fileless asset (one built purely from data, such as a sprite)
                // completes it synchronously, dispatching the element's load event - whose
                // listeners may have removed this element. Stop before the next addition
                // reaches the destroyed registry, and before orphan entities are created.
                if (generation !== this._bootGeneration) {
                    return;
                }
            }
        }
        // Get all pc-material elements that are direct children of the pc-app element
        const materialElements = this.querySelectorAll(':scope > pc-material');
        Array.from(materialElements).forEach((materialElement) => {
            materialElement._createMaterial();
        });
        // Create all entities
        const entityElements = this.querySelectorAll('pc-entity');
        Array.from(entityElements).forEach((entityElement) => {
            entityElement._createEntity(app);
        });
        // Build hierarchy
        entityElements.forEach((entityElement) => {
            entityElement._buildHierarchy(app);
        });
        // Building the hierarchy dispatched each entity's ready event synchronously, and a
        // listener may have removed the element. The sweep itself degrades safely - destroying
        // the application nulls every element's entity, so the remaining builds no-op - but the
        // teardown's reset must not be overwritten here.
        if (generation !== this._bootGeneration) {
            return;
        }
        this._hierarchyReady = true;
        // Forward the engine's preload lifecycle as DOM ProgressEvents on this element. The
        // listener must be attached before preload() is called: an asset that is already loaded
        // ticks synchronously inside it.
        const total = app.assets.list({ preload: true }).length;
        let loaded = 0;
        const onPreloadProgress = () => {
            loaded += 1;
            this._loadProgress = loaded / total;
            this._bar?.progress(loaded, total);
            this.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded, total }));
        };
        app.on('preload:progress', onPreloadProgress);
        this._loadProgress = total === 0 ? 1 : 0;
        this._bar?.progress(0, total);
        this.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 0, total }));
        // The progress dispatch above ran listeners synchronously, and one may have removed the
        // element. The application is already destroyed - it must not be asked to preload.
        if (generation !== this._bootGeneration) {
            return;
        }
        // Load assets before starting the application
        app.preload(() => {
            // The element may have been removed while assets loaded. The application is already
            // destroyed, so it must not be started — and readiness must not be signaled for a
            // boot that no longer owns the element.
            if (generation !== this._bootGeneration) {
                return;
            }
            // Scope the counter to this preload pass, so a later app.preload() call by user code
            // cannot push `loaded` past `total`
            app.off('preload:progress', onPreloadProgress);
            this._loadProgress = 1;
            // Start the application
            app.start();
            // Dismiss the bar only once a frame has actually rendered; ready fires before the
            // first rAF tick
            app.once('frameend', () => this._bar?.complete());
            this._onReady();
        });
    }
    disconnectedCallback() {
        // Invalidate any boot still in flight, so it abandons itself when it next resumes
        // instead of completing against a torn-down element.
        this._bootGeneration++;
        this._optionsLocked = false;
        this._pickerDestroy();
        // Clean up the application. Destroying it destroys every entity, whose destroy hooks
        // unregister them - clear() covers any entity the engine no longer reached.
        if (this._app) {
            this._app.destroy();
            this._app = null;
        }
        this._entityElements.clear();
        this._loadProgress = 0;
        this._bar?.destroy();
        this._bar = null;
        // Return the element to its pre-boot state, so re-inserting it boots afresh: descendants
        // must neither see a hierarchy that no longer exists nor resume against a readiness that
        // no longer holds.
        this._hierarchyReady = false;
        this._resetReady();
        // Stop tracking the element's size
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        // Remove the canvas
        if (this._canvas && this.contains(this._canvas)) {
            this.removeChild(this._canvas);
            this._canvas = null;
        }
    }
    /**
     * Syncs the drawing buffer and the picker to the canvas's current CSS size. The picker must
     * track the buffer, or picks would land at stale coordinates after a resize. Skipped while
     * an XR session presents - the session owns the buffer size.
     */
    _syncCanvasSize() {
        if (!this.app || this.app.xr?.active) {
            return;
        }
        this.app.updateCanvasSize();
        const { width, height } = this.app.graphicsDevice;
        this._picker?.resize(width, height);
    }
    _pickerCreate() {
        const { width, height } = this.app.graphicsDevice;
        this._picker = new Picker(this.app, width, height);
        // Create bound handlers but don't attach them yet. The handlers pick asynchronously, so
        // each is wrapped to discard the promise - a listener must not return one, and nothing
        // awaits the result.
        const listener = (handler) => {
            return (event) => {
                handler.call(this, event);
            };
        };
        this._pointerHandlers.pointermove = listener(this._onPointerMove);
        this._pointerHandlers.pointerdown = listener(this._onPointerDown);
        this._pointerHandlers.pointerup = listener(this._onPointerUp);
        // Attach canvas handlers for listeners registered before this boot (e.g. handlers
        // created from onpointer* attributes when their elements were first upgraded, or
        // listeners carried over from before a re-boot)
        pointerEventTypes.forEach((type) => {
            const anyListeners = Array.from(this.querySelectorAll('pc-entity, pc-node')).some((entity) => entity._hasListeners(type));
            if (anyListeners) {
                this._onPointerListenerAdded(type);
            }
        });
    }
    _pickerDestroy() {
        if (this._canvas) {
            Object.entries(this._pointerHandlers).forEach(([type, handler]) => {
                if (handler) {
                    this._canvas.removeEventListener(type, handler);
                }
            });
        }
        this._picker = null;
        this._hoveredEntity = null;
        this._pointerHandlers = {
            pointermove: null,
            pointerdown: null,
            pointerup: null
        };
        this._hasPointerListeners = {
            pointerenter: false,
            pointerleave: false,
            pointerdown: false,
            pointerup: false,
            pointermove: false
        };
    }
    /**
     * Registers the element that fronts an entity. Called by EntityElement when it creates its
     * entity, and by NodeElement when it binds one.
     *
     * @param entity - The entity.
     * @param element - The element that fronts it.
     * @internal
     */
    _registerEntityElement(entity, element) {
        this._entityElements.set(entity, element);
    }
    /**
     * Removes the registration for a destroyed entity. Called by EntityElement.
     *
     * @param entity - The entity.
     * @internal
     */
    _unregisterEntityElement(entity) {
        this._entityElements.delete(entity);
    }
    /**
     * Returns the `<pc-entity>` or `<pc-node>` element whose backing entity is `entity`, or
     * `null` if the entity is not fronted by an element of this application - for example, an
     * unbound node inside a model's instantiated hierarchy, or an entity created through the
     * engine API.
     *
     * @param entity - The entity to look up.
     * @returns The element fronting the entity, or `null`.
     */
    elementFromEntity(entity) {
        return this._entityElements.get(entity) ?? null;
    }
    /**
     * Resolves the element that owns a picked node: the nearest node up the parent chain -
     * starting with the node itself - that is fronted by a `<pc-entity>` or `<pc-node>` of this
     * application. A hit inside a model's instantiated hierarchy therefore resolves to the
     * nearest bound `<pc-node>`, or failing that the element hosting the model.
     *
     * @param node - The picked node, or `null`.
     * @returns The owning element, or `null`.
     */
    _elementFromNode(node) {
        while (node !== null) {
            const element = this._entityElements.get(node);
            if (element) {
                return element;
            }
            node = node.parent;
        }
        return null;
    }
    /**
     * Like {@link _elementFromNode}, but skips elements without a listener for `type`, so a hit
     * on an unlistened child still reaches a listening ancestor.
     *
     * @param node - The picked node, or `null`.
     * @param type - The pointer event type a listener is required for.
     * @returns The nearest listening element, or `null`.
     */
    _elementWithListener(node, type) {
        while (node !== null) {
            const element = this._entityElements.get(node);
            if (element?._hasListeners(type)) {
                return element;
            }
            node = node.parent;
        }
        return null;
    }
    /**
     * Converts a pointer event's client coordinates into drawing-buffer coordinates - the space
     * the pick buffer and the camera viewports are laid out in. When the canvas has no CSS box
     * to map through (jsdom; a hidden canvas receives no pointer events in a browser), the
     * client coordinates are passed through unmapped and `mapped` is false, so callers know the
     * coordinates correspond to no real geometry.
     *
     * @param event - The pointer event to convert.
     * @param canvas - The canvas the event was dispatched on.
     * @returns The buffer-space coordinates, and whether they were actually mapped.
     */
    _getPickerCoordinates(event, canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        if (canvasRect.width === 0 || canvasRect.height === 0) {
            return { x: event.clientX, y: event.clientY, mapped: false };
        }
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;
        return {
            x: (event.clientX - canvasRect.left) * scaleX,
            y: (event.clientY - canvasRect.top) * scaleY,
            mapped: true
        };
    }
    /**
     * Whether a camera's viewport contains the point. A camera renders into its normalized
     * `rect`, whose origin is the bottom-left of the canvas while buffer coordinates run from
     * the top-left - so the vertical test flips, as the engine's ElementInput flips it for UI
     * input. The right and bottom edges are exclusive: a viewport rasterizes the half-open
     * pixel range [left, right) x [top, bottom), so a coordinate on a shared edge belongs to
     * the viewport whose first pixel it is - never to the one it just left, whose pick buffer
     * holds nothing there.
     *
     * @param camera - The camera to test.
     * @param x - The x coordinate, in buffer space.
     * @param y - The y coordinate, in buffer space.
     * @param canvas - The canvas the coordinates are relative to.
     * @returns Whether the camera's viewport contains the point.
     */
    _cameraContains(camera, x, y, canvas) {
        const rect = camera.rect;
        const left = rect.x * canvas.width;
        const bottom = (1 - rect.y) * canvas.height;
        const top = bottom - rect.w * canvas.height;
        return x >= left && x < left + rect.z * canvas.width && y >= top && y < bottom;
    }
    /**
     * Picks the scene under the pointer and returns the graph node that was hit, or `null`.
     *
     * The camera is resolved the way the engine's ElementInput resolves it for UI input:
     * enabled cameras are tried topmost-first (they render in ascending `priority` order),
     * skipping cameras that render to a texture and cameras whose viewport `rect` does not
     * contain the pointer. A camera that picks nothing ends the search if it clears the color
     * buffer - its background visually owns the pixel - and otherwise cedes to the cameras
     * beneath it, so an overlay camera only intercepts picks where it actually drew something.
     * The pick buffer is prepared per camera, so each camera picks from its own layers.
     *
     * The read back is asynchronous because the synchronous {@link Picker.getSelection} is not
     * supported on WebGPU, where it returns an empty selection rather than failing - which
     * silently disabled every `onpointer*` handler once WebGPU became the resolved backend. The
     * async variant works on both backends and does not block the main thread on a GPU read.
     *
     * @param event - The pointer event to pick under.
     * @returns The graph node under the pointer, or `null` if nothing was hit.
     */
    async _pickNode(event) {
        const app = this.app;
        const picker = this._picker;
        const canvas = this._canvas;
        if (!app || !picker || !canvas)
            return null;
        const { x, y, mapped } = this._getPickerCoordinates(event, canvas);
        // Walked from the end: the array is sorted by ascending priority, so the last camera
        // renders last and sits on top. Read through .at() because a pick handler may remove
        // cameras while an earlier iteration's read back is in flight.
        const cameras = app.systems.camera?.cameras ?? [];
        for (let i = cameras.length - 1; i >= 0; i--) {
            const camera = cameras.at(i);
            // A camera rendering to a texture is not on the canvas.
            if (!camera || camera.renderTarget)
                continue;
            // Coordinates that could not be mapped cannot be tested for containment.
            if (mapped && !this._cameraContains(camera, x, y, canvas))
                continue;
            picker.prepare(camera, app.scene);
            const selection = await picker.getSelectionAsync(x, y);
            // The element may have disconnected while the read back was in flight.
            if (!this._picker || !this.app)
                return null;
            if (selection.length > 0) {
                const item = selection[0];
                return item instanceof MeshInstance ? item.node : item.entity;
            }
            // Nothing hit. A camera that clears the color buffer paints its background over
            // everything beneath it, so the miss is final; one that does not is an overlay
            // that the cameras beneath show through, so they get their turn.
            if (camera.clearColorBuffer)
                return null;
        }
        return null;
    }
    async _onPointerMove(event) {
        if (!this._picker || !this.app)
            return;
        // Moves arrive faster than a pick resolves, so results can land out of order. Only the
        // newest pick may update the hover state - an older one describes a pointer position the
        // user has already left.
        const token = ++this._pickToken;
        const node = await this._pickNode(event);
        if (token !== this._pickToken || !this._picker)
            return;
        // The hovered element is the nearest one up the node's parent chain, listening or not -
        // dispatch is gated per event type below
        const newHoverEntity = this._elementFromNode(node);
        // Handle enter/leave events
        if (this._hoveredEntity !== newHoverEntity) {
            if (this._hoveredEntity && this._hoveredEntity._hasListeners('pointerleave')) {
                this._hoveredEntity.dispatchEvent(new PointerEvent('pointerleave', event));
            }
            if (newHoverEntity && newHoverEntity._hasListeners('pointerenter')) {
                newHoverEntity.dispatchEvent(new PointerEvent('pointerenter', event));
            }
        }
        // Update hover state
        this._hoveredEntity = newHoverEntity;
        // Handle pointermove event
        if (newHoverEntity && newHoverEntity._hasListeners('pointermove')) {
            newHoverEntity.dispatchEvent(new PointerEvent('pointermove', event));
        }
    }
    async _onPointerDown(event) {
        if (!this._picker || !this.app)
            return;
        const node = await this._pickNode(event);
        if (!this._picker)
            return; // the element disconnected while the pick was in flight
        const entityElement = this._elementWithListener(node, 'pointerdown');
        if (entityElement) {
            entityElement.dispatchEvent(new PointerEvent('pointerdown', event));
        }
    }
    async _onPointerUp(event) {
        if (!this._picker || !this.app)
            return;
        const node = await this._pickNode(event);
        if (!this._picker)
            return; // the element disconnected while the pick was in flight
        const entityElement = this._elementWithListener(node, 'pointerup');
        if (entityElement) {
            entityElement.dispatchEvent(new PointerEvent('pointerup', event));
        }
    }
    _onPointerListenerAdded(type) {
        if (!this._hasPointerListeners[type] && this._canvas) {
            this._hasPointerListeners[type] = true;
            // For enter/leave events, we need the move handler
            const handler = type === 'pointerenter' || type === 'pointerleave'
                ? this._pointerHandlers.pointermove
                : this._pointerHandlers[type];
            if (handler) {
                this._canvas.addEventListener(type === 'pointerenter' || type === 'pointerleave' ? 'pointermove' : type, handler);
            }
        }
    }
    _onPointerListenerRemoved(type) {
        const hasListeners = Array.from(this.querySelectorAll('pc-entity, pc-node')).some((entity) => entity._hasListeners(type));
        if (!hasListeners && this._canvas) {
            this._hasPointerListeners[type] = false;
            const handler = type === 'pointerenter' || type === 'pointerleave'
                ? this._pointerHandlers.pointermove
                : this._pointerHandlers[type];
            if (handler) {
                this._canvas.removeEventListener(type === 'pointerenter' || type === 'pointerleave' ? 'pointermove' : type, handler);
            }
        }
    }
    /**
     * Warns that a graphics option was written too late to have any effect. These options are read
     * once, when the element connects and creates its graphics device, so a later write updates
     * only the element's own property - silently, without this.
     *
     * @param name - The name of the option, as its attribute.
     */
    _warnIfBooted(name) {
        if (this._optionsLocked) {
            console.warn(`Attribute '${name}' on <pc-app> is only read when the application boots, so this change has no effect. Set it before the element is connected, or remove and re-insert the element to reboot with the new value.`);
        }
    }
    /**
     * Sets whether the frame buffer has an alpha channel, which is what lets the page show through
     * wherever the scene has not drawn. Read only when the application boots.
     * @param value - The alpha flag.
     */
    set alpha(value) {
        this._warnIfBooted('alpha');
        this._alpha = value;
    }
    /**
     * Gets whether the frame buffer has an alpha channel.
     * @returns The alpha flag.
     */
    get alpha() {
        return this._alpha;
    }
    /**
     * Sets whether the frame buffer is anti-aliased. Read only when the application boots.
     * @param value - The antialias flag.
     */
    set antialias(value) {
        this._warnIfBooted('antialias');
        this._antialias = value;
    }
    /**
     * Gets whether the frame buffer is anti-aliased.
     * @returns The antialias flag.
     */
    get antialias() {
        return this._antialias;
    }
    /**
     * Sets the graphics backend. Defaults to 'webgpu', which falls back to 'webgl2' if WebGPU
     * is not supported by the browser. Read only when the application boots.
     * @param value - The graphics backend ('webgpu', 'webgl2', or 'null').
     */
    set backend(value) {
        this._warnIfBooted('backend');
        this._backend = value;
    }
    /**
     * Gets the graphics backend.
     * @returns The graphics backend.
     */
    get backend() {
        return this._backend;
    }
    /**
     * Sets whether the frame buffer has a depth buffer, which the renderer needs to resolve which
     * surface is nearest the camera. Read only when the application boots.
     * @param value - The depth buffer flag.
     */
    set depthBuffer(value) {
        this._warnIfBooted('depth-buffer');
        this._depthBuffer = value;
    }
    /**
     * Gets whether the frame buffer has a depth buffer.
     * @returns The depth buffer flag.
     */
    get depthBuffer() {
        return this._depthBuffer;
    }
    /**
     * Sets whether the application shows its built-in loading bar while it boots and preloads its
     * assets. Enabled by default; setting `false` removes the bar immediately, while setting
     * `true` has no effect until the element is next connected. The bar can be themed with the
     * CSS custom properties `--pc-loading-bar-color`, `--pc-loading-bar-background` and
     * `--pc-loading-bar-height`.
     * @param value - The loading bar flag.
     */
    set loadingBar(value) {
        this._loadingBar = value;
        if (!value && this._bar) {
            this._bar.destroy();
            this._bar = null;
        }
    }
    /**
     * Gets whether the application shows its built-in loading bar while it boots and preloads
     * its assets.
     * @returns The loading bar flag.
     */
    get loadingBar() {
        return this._loadingBar;
    }
    /**
     * Sets the cap on the pixel ratio the application renders at. The canvas is sized by the
     * smaller of this value and the display's own device pixel ratio, so the default of `Infinity`
     * renders at full physical resolution, `1` renders at CSS resolution, and an intermediate
     * value such as `2` keeps a dense display sharp without paying for every one of its pixels.
     * Must be greater than 0. Unlike the other graphics options, this applies immediately.
     * @param value - The maximum pixel ratio.
     */
    set maxPixelRatio(value) {
        this._maxPixelRatio = value;
        if (this.app) {
            this.app.graphicsDevice.maxPixelRatio = value;
            this._syncCanvasSize();
        }
    }
    /**
     * Gets the cap on the pixel ratio the application renders at.
     * @returns The maximum pixel ratio.
     */
    get maxPixelRatio() {
        return this._maxPixelRatio;
    }
    /**
     * Sets whether the frame buffer has a stencil buffer, which stencil-based effects and UI
     * masking need. Read only when the application boots.
     * @param value - The stencil buffer flag.
     */
    set stencilBuffer(value) {
        this._warnIfBooted('stencil-buffer');
        this._stencilBuffer = value;
    }
    /**
     * Gets whether the frame buffer has a stencil buffer.
     * @returns The stencil buffer flag.
     */
    get stencilBuffer() {
        return this._stencilBuffer;
    }
    static get observedAttributes() {
        return ['alpha', 'antialias', 'backend', 'depth-buffer', 'loading-bar', 'max-pixel-ratio', 'stencil-buffer'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'alpha':
                this.alpha = parseBool(newValue, true);
                break;
            case 'antialias':
                this.antialias = parseBool(newValue, true);
                break;
            case 'backend':
                this.backend = parseEnum(newValue, ['webgpu', 'webgl2', 'null'], 'webgpu', name);
                break;
            case 'depth-buffer':
                this.depthBuffer = parseBool(newValue, true);
                break;
            case 'loading-bar':
                this.loadingBar = parseBool(newValue, true);
                break;
            case 'max-pixel-ratio':
                this.maxPixelRatio = parseNumber(newValue, Infinity, name);
                break;
            case 'stencil-buffer':
                this.stencilBuffer = parseBool(newValue, true);
                break;
        }
    }
}
customElements.define('pc-app', AppElement);

/**
 * The attribute names of the inline `onpointer*` event handlers, shared by every element that
 * fronts an engine entity. Spread into `observedAttributes` by subclasses.
 * @internal
 */
const POINTER_ATTRIBUTES = [
    'onpointerenter',
    'onpointerleave',
    'onpointerdown',
    'onpointerup',
    'onpointermove'
];
/**
 * The base class for elements that front an engine {@link Entity}: `<pc-entity>`, which creates
 * one, and `<pc-node>`, which binds to one inside a model's instantiated hierarchy. It carries
 * what both need — the `entity` contract, registration with the owning application (which joins
 * picked scene nodes back to elements by identity, never by name), and the pointer listener
 * bookkeeping that lets the application lazily attach its canvas handlers.
 */
class EntityBaseElement extends AsyncElement {
    _entity = null;
    /**
     * The application element this entity is registered with, cached at registration time so the
     * entity can be unregistered even once this element has left the DOM.
     */
    _appElement = null;
    /**
     * The pointer event listeners for the entity.
     */
    _listeners = {};
    /**
     * The event types for which an inline `onpointer*` attribute is currently present.
     */
    _inlineHandlerTypes = new Set();
    /**
     * The PlayCanvas entity instance. `null` until the element is ready, and again once the
     * entity is gone — await {@link whenReady} or the element's `ready()` promise before
     * accessing it.
     * @returns The entity instance, or `null`.
     */
    get entity() {
        return this._entity;
    }
    /**
     * Registers `entity` as this element's backing entity with the owning application, which
     * joins engine nodes back to elements by identity (never by name).
     *
     * @param entity - The entity to register.
     */
    _registerEntity(entity) {
        this._appElement = this.closestApp;
        this._appElement?._registerEntityElement(entity, this);
    }
    /**
     * Removes the registration for `entity`.
     *
     * @param entity - The entity to unregister.
     */
    _unregisterEntity(entity) {
        this._appElement?._unregisterEntityElement(entity);
        this._appElement = null;
    }
    /**
     * Tracks whether an inline `onpointer*` attribute is present. The browser itself compiles and
     * runs these attributes — they are standard `GlobalEventHandlers`, so setting one replaces
     * the previous handler and removing it removes the handler, exactly like `onclick` on any
     * HTML element. But because they bypass {@link addEventListener}, the connect/disconnect
     * bookkeeping that lets the application lazily attach its canvas pointer handlers must be
     * kept in sync here.
     *
     * @param name - The attribute name (e.g. 'onpointerdown').
     * @param value - The attribute value, or `null` when the attribute has been removed.
     */
    _updateInlineHandler(name, value) {
        const type = name.substring(2);
        const had = this._inlineHandlerTypes.has(type);
        const has = value !== null;
        if (has && !had) {
            this._inlineHandlerTypes.add(type);
            this.dispatchEvent(new CustomEvent(`${type}:connect`, { bubbles: true }));
        }
        else if (!has && had) {
            this._inlineHandlerTypes.delete(type);
            this.dispatchEvent(new CustomEvent(`${type}:disconnect`, { bubbles: true }));
        }
    }
    addEventListener(type, listener, options) {
        if (!this._listeners[type]) {
            this._listeners[type] = [];
        }
        this._listeners[type].push(listener);
        super.addEventListener(type, listener, options);
        if (type.startsWith('pointer')) {
            this.dispatchEvent(new CustomEvent(`${type}:connect`, { bubbles: true }));
        }
    }
    removeEventListener(type, listener, options) {
        if (this._listeners[type]) {
            this._listeners[type] = this._listeners[type].filter((l) => l !== listener);
        }
        super.removeEventListener(type, listener, options);
        if (type.startsWith('pointer')) {
            this.dispatchEvent(new CustomEvent(`${type}:disconnect`, { bubbles: true }));
        }
    }
    /**
     * Whether the element has a listener for an event type, registered either with
     * {@link addEventListener} or with the matching inline `onpointer*` attribute. Read by the
     * containing `<pc-app>` element to gate pointer event synthesis.
     *
     * @param type - The event type.
     * @returns Whether a listener is registered.
     * @internal
     */
    _hasListeners(type) {
        return Boolean(this._listeners[type]?.length) || this._inlineHandlerTypes.has(type);
    }
}

/**
 * Creates and parents the entities of every descendant `<pc-entity>` of `root`, in two passes so
 * that no parent's existence depends on document order. Called wherever a subtree could not build
 * itself: an element inserted into an application that is already running, and a `<pc-node>` whose
 * children waited for it to bind.
 *
 * Descendants that are not yet custom elements are skipped, because there is nothing useful to do
 * for them and reaching for `_createEntity` would throw. A subtree cloned from a `<template>`
 * arrives entirely unupgraded — template content lives in an inert document, where custom element
 * definitions are never looked up — and appending the clone upgrades its elements in tree order,
 * an element before its descendants. So a sweep from an element's own `connectedCallback` sees
 * plain `HTMLElement`s below it. Each becomes an `EntityElement` moments later and its own
 * `connectedCallback` creates and parents it, by which time the ancestor it parents under has its
 * entity — the same guarantee tree order gives this sweep.
 *
 * @param root - The element whose descendant entities to build.
 * @param app - The application to create the entities in.
 * @internal
 */
const buildDescendantEntities = (root, app) => {
    const children = Array.from(root.querySelectorAll('pc-entity')).filter((child) => child instanceof EntityElement);
    children.forEach((child) => child._createEntity(app));
    children.forEach((child) => child._buildHierarchy(app));
};
/**
 * The EntityElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-entity/ | `<pc-entity>`} elements.
 * The EntityElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * The pointer events below are dispatched by the containing `<pc-app>` element when the pointer
 * intersects this entity's geometry. They are only generated while the entity has a listener for
 * them, registered either with {@link addEventListener} or with the matching inline `onpointer*`
 * attribute.
 *
 * @attribute {string} onpointerenter - Script to run when the pointer moves onto the entity.
 * @attribute {string} onpointerleave - Script to run when the pointer moves off the entity.
 * @attribute {string} onpointermove - Script to run when the pointer moves over the entity.
 * @attribute {string} onpointerdown - Script to run when a pointer button is pressed over the
 * entity.
 * @attribute {string} onpointerup - Script to run when a pointer button is released over the
 * entity.
 * @fires {PointerEvent} pointerenter - Fired when the pointer moves onto the entity.
 * @fires {PointerEvent} pointerleave - Fired when the pointer moves off the entity.
 * @fires {PointerEvent} pointermove - Fired when the pointer moves over the entity.
 * @fires {PointerEvent} pointerdown - Fired when a pointer button is pressed over the entity.
 * @fires {PointerEvent} pointerup - Fired when a pointer button is released over the entity.
 */
class EntityElement extends EntityBaseElement {
    /**
     * Whether the entity is enabled.
     */
    _enabled = true;
    /**
     * The name of the entity.
     */
    _name = 'Untitled';
    /**
     * The position of the entity.
     */
    _position = new Vec3();
    /**
     * The rotation of the entity.
     */
    _rotation = new Vec3();
    /**
     * The scale of the entity.
     */
    _scale = new Vec3(1, 1, 1);
    /**
     * The tags of the entity.
     */
    _tags = [];
    /**
     * Whether the hierarchy has been built for this entity.
     */
    _built = false;
    /**
     * Creates the backing entity. Called by the containing `<pc-app>` element during its boot
     * sweep, and on connection for elements inserted while the application is already running.
     *
     * @param app - The application to create the entity in.
     * @internal
     */
    _createEntity(app) {
        // Guard against double creation. When a subtree is inserted at runtime (e.g. cloning a
        // `<template>`), an ancestor's connectedCallback eagerly creates descendant entities; the
        // descendants' own connectedCallbacks would otherwise create them a second time.
        if (this._entity) {
            return;
        }
        // Seed from the cached fields rather than re-reading the attributes. Every observed
        // attribute is routed through its property setter by attributeChangedCallback, so the field
        // already holds the parsed attribute value - and it also holds anything assigned through the
        // property API before the app booted, which reading the attribute back would discard.
        const entity = new Entity(this._name, app);
        this._entity = entity;
        entity.enabled = this._enabled;
        entity.setLocalPosition(this._position);
        entity.setLocalEulerAngles(this._rotation);
        entity.setLocalScale(this._scale);
        if (this._tags.length > 0) {
            entity.tags.add(this._tags);
        }
        // Register with the owning application and hook the entity's destruction. The engine
        // fires 'destroy' for every entity in a destroyed subtree, so the element learns of its
        // entity's death no matter who causes it: this element, an ancestor, the whole
        // application, or a user script calling entity.destroy().
        this._registerEntity(entity);
        entity.once('destroy', this._onEntityDestroy, this);
    }
    /**
     * Handles the destruction of the backing entity. Resets the element so a later re-insertion
     * starts clean: `_built` must be cleared alongside `_entity`, or _buildHierarchy would bail
     * and a re-created entity would never be parented. Readiness is re-armed for the same
     * reason — with the entity gone, a resolved ready promise would resume its awaiters against
     * a null `entity`.
     *
     * @param entity - The entity that was destroyed.
     */
    _onEntityDestroy(entity) {
        this._unregisterEntity(entity);
        this._entity = null;
        this._built = false;
        this._resetReady();
    }
    /**
     * Parents the backing entity: under the entity of the nearest ancestor `<pc-entity>` or
     * `<pc-node>` when there is one, and under the application root otherwise. Called by the
     * containing `<pc-app>` element once a sweep has created every entity, so a parent's
     * existence never depends on document order.
     *
     * @param app - The application whose root adopts parentless entities.
     * @internal
     */
    _buildHierarchy(app) {
        if (!this.entity || this._built)
            return;
        const closestEntity = this.closestEntity;
        // A host element without an entity is an unresolved `<pc-node>`: building now would
        // mis-anchor this entity to the application root while the host is still resolving.
        // Stay unbuilt - the host drives this subtree itself once it binds.
        if (closestEntity && !closestEntity.entity) {
            return;
        }
        this._built = true;
        if (closestEntity?.entity) {
            closestEntity.entity.addChild(this.entity);
        }
        else {
            app.root.addChild(this.entity);
        }
        this._onReady();
    }
    connectedCallback() {
        // Wait for app to be ready
        const closestApp = this.closestApp;
        if (!closestApp) {
            // An entity outside an application is inert and never becomes ready, so awaiting it
            // hangs. Warn rather than fail silently, naming the parent it requires, as every other
            // misplaced element does.
            const name = this.getAttribute('name');
            const label = name ? ` '${name}'` : '';
            console.warn(`pc-entity${label} must be a descendant of pc-app - entity not created`);
            return;
        }
        // If app is already running, create entity immediately
        if (closestApp._hierarchyReady) {
            const app = closestApp.app;
            this._createEntity(app);
            this._buildHierarchy(app);
            // Handle any child entities that might exist
            buildDescendantEntities(this, app);
        }
    }
    disconnectedCallback() {
        // Destroying the entity destroys its whole subtree, and the engine fires 'destroy' for
        // every entity in it - so _onEntityDestroy resets this element AND every descendant
        // element before the descendants' own disconnectedCallbacks run. Their entities are null
        // by then, making this call a no-op for them.
        this._entity?.destroy();
    }
    /**
     * Sets the enabled state of the entity.
     * @param value - Whether the entity is enabled.
     */
    set enabled(value) {
        this._enabled = value;
        if (this.entity) {
            this.entity.enabled = value;
        }
    }
    /**
     * Gets the enabled state of the entity.
     * @returns Whether the entity is enabled.
     */
    get enabled() {
        return this._enabled;
    }
    /**
     * Sets the name of the entity.
     * @param value - The name of the entity.
     */
    set name(value) {
        this._name = value;
        if (this.entity) {
            this.entity.name = value;
        }
    }
    /**
     * Gets the name of the entity.
     * @returns The name of the entity.
     */
    get name() {
        return this._name;
    }
    /**
     * Sets the position of the entity.
     * @param value - The position of the entity.
     */
    set position(value) {
        this._position = value;
        if (this.entity) {
            this.entity.setLocalPosition(this._position);
        }
    }
    /**
     * Gets the position of the entity.
     * @returns The position of the entity.
     */
    get position() {
        return this._position;
    }
    /**
     * Sets the rotation of the entity.
     * @param value - The rotation of the entity.
     */
    set rotation(value) {
        this._rotation = value;
        if (this.entity) {
            this.entity.setLocalEulerAngles(this._rotation);
        }
    }
    /**
     * Gets the rotation of the entity.
     * @returns The rotation of the entity.
     */
    get rotation() {
        return this._rotation;
    }
    /**
     * Sets the scale of the entity.
     * @param value - The scale of the entity.
     */
    set scale(value) {
        this._scale = value;
        if (this.entity) {
            this.entity.setLocalScale(this._scale);
        }
    }
    /**
     * Gets the scale of the entity.
     * @returns The scale of the entity.
     */
    get scale() {
        return this._scale;
    }
    /**
     * Sets the tags of the entity.
     * @param value - The tags of the entity.
     */
    set tags(value) {
        this._tags = value;
        if (this.entity) {
            this.entity.tags.clear();
            this.entity.tags.add(this._tags);
        }
    }
    /**
     * Gets the tags of the entity.
     * @returns The tags of the entity.
     */
    get tags() {
        return this._tags;
    }
    static get observedAttributes() {
        return ['enabled', 'name', 'position', 'rotation', 'scale', 'tags', ...POINTER_ATTRIBUTES];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'enabled':
                this.enabled = parseBool(newValue, true);
                break;
            case 'name':
                this.name = newValue ?? 'Untitled';
                break;
            case 'position':
                this.position = parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'rotation':
                this.rotation = parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'scale':
                this.scale = parseVec3(newValue, Vec3.ONE, name);
                break;
            case 'tags':
                this.tags = parseTags(newValue);
                break;
            case 'onpointerenter':
            case 'onpointerleave':
            case 'onpointerdown':
            case 'onpointerup':
            case 'onpointermove':
                this._updateInlineHandler(name, newValue);
                break;
        }
    }
}
customElements.define('pc-entity', EntityElement);

// This file is part of meshoptimizer library and is distributed under the terms of MIT License.
// Copyright (C) 2016-2022, by Arseny Kapoulkine (arseny.kapoulkine@gmail.com)
var MeshoptDecoder = (function() {

	// Built with clang version 14.0.4
	// Built from meshoptimizer 0.18
	var wasm_base = "b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuikqbeeedddillviebeoweuec:q;iekr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbol79IV9Rbrq:P8Yqdbk;3sezu8Jjjjjbcj;eb9Rgv8Kjjjjbc9:hodnadcefal0mbcuhoaiRbbc:Ge9hmbavaialfgrad9Radz1jjjbhwcj;abad9UhoaicefhldnadTmbaoc;WFbGgocjdaocjd6EhDcbhqinaqae9pmeaDaeaq9RaqaDfae6Egkcsfgocl4cifcd4hxdndndndnaoc9WGgmTmbcbhPcehsawcjdfhzalhHinaraH9Rax6midnaraHaxfgl9RcK6mbczhoinawcj;cbfaogifgoc9WfhOdndndndndnaHaic9WfgAco4fRbbaAci4coG4ciGPlbedibkaO9cb83ibaOcwf9cb83ibxikaOalRblalRbbgAco4gCaCciSgCE86bbaocGfalclfaCfgORbbaAcl4ciGgCaCciSgCE86bbaocVfaOaCfgORbbaAcd4ciGgCaCciSgCE86bbaoc7faOaCfgORbbaAciGgAaAciSgAE86bbaoctfaOaAfgARbbalRbegOco4gCaCciSgCE86bbaoc91faAaCfgARbbaOcl4ciGgCaCciSgCE86bbaoc4faAaCfgARbbaOcd4ciGgCaCciSgCE86bbaoc93faAaCfgARbbaOciGgOaOciSgOE86bbaoc94faAaOfgARbbalRbdgOco4gCaCciSgCE86bbaoc95faAaCfgARbbaOcl4ciGgCaCciSgCE86bbaoc96faAaCfgARbbaOcd4ciGgCaCciSgCE86bbaoc97faAaCfgARbbaOciGgOaOciSgOE86bbaoc98faAaOfgORbbalRbiglco4gAaAciSgAE86bbaoc99faOaAfgORbbalcl4ciGgAaAciSgAE86bbaoc9:faOaAfgORbbalcd4ciGgAaAciSgAE86bbaocufaOaAfgoRbbalciGglalciSglE86bbaoalfhlxdkaOalRbwalRbbgAcl4gCaCcsSgCE86bbaocGfalcwfaCfgORbbaAcsGgAaAcsSgAE86bbaocVfaOaAfgORbbalRbegAcl4gCaCcsSgCE86bbaoc7faOaCfgORbbaAcsGgAaAcsSgAE86bbaoctfaOaAfgORbbalRbdgAcl4gCaCcsSgCE86bbaoc91faOaCfgORbbaAcsGgAaAcsSgAE86bbaoc4faOaAfgORbbalRbigAcl4gCaCcsSgCE86bbaoc93faOaCfgORbbaAcsGgAaAcsSgAE86bbaoc94faOaAfgORbbalRblgAcl4gCaCcsSgCE86bbaoc95faOaCfgORbbaAcsGgAaAcsSgAE86bbaoc96faOaAfgORbbalRbvgAcl4gCaCcsSgCE86bbaoc97faOaCfgORbbaAcsGgAaAcsSgAE86bbaoc98faOaAfgORbbalRbogAcl4gCaCcsSgCE86bbaoc99faOaCfgORbbaAcsGgAaAcsSgAE86bbaoc9:faOaAfgORbbalRbrglcl4gAaAcsSgAE86bbaocufaOaAfgoRbbalcsGglalcsSglE86bbaoalfhlxekaOal8Pbb83bbaOcwfalcwf8Pbb83bbalczfhlkdnaiam9pmbaiczfhoaral9RcL0mekkaiam6mialTmidnakTmbawaPfRbbhOcbhoazhiinaiawcj;cbfaofRbbgAce4cbaAceG9R7aOfgO86bbaiadfhiaocefgoak9hmbkkazcefhzaPcefgPad6hsalhHaPad9hmexvkkcbhlasceGmdxikalaxad2fhCdnakTmbcbhHcehsawcjdfhminaral9Rax6mialTmdalaxfhlawaHfRbbhOcbhoamhiinaiawcj;cbfaofRbbgAce4cbaAceG9R7aOfgO86bbaiadfhiaocefgoak9hmbkamcefhmaHcefgHad6hsaHad9hmbkaChlxikcbhocehsinaral9Rax6mdalTmealaxfhlaocefgoad6hsadao9hmbkaChlxdkcbhlasceGTmekc9:hoxikabaqad2fawcjdfakad2z1jjjb8Aawawcjdfakcufad2fadz1jjjb8Aakaqfhqalmbkc9:hoxekcbc99aral9Radcaadca0ESEhokavcj;ebf8Kjjjjbaok;yzeHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:jjjjb8AavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhodnaeTmbcmcsaDceSEhkcbhxcbhmcbhDcbhicbhlindnaoaq9nmbc9:hoxikdndnawRbbgrc;Ve0mbavc;abfalarcl4cu7fcsGcitfgPydlhsaPydbhzdnarcsGgPak9pmbavaiarcu7fcsGcdtfydbaxaPEhraPThPdndnadcd9hmbabaDcetfgHaz87ebaHcdfas87ebaHclfar87ebxekabaDcdtfgHazBdbaHclfasBdbaHcwfarBdbkaxaPfhxavc;abfalcitfgHarBdbaHasBdlavaicdtfarBdbavc;abfalcefcsGglcitfgHazBdbaHarBdlaiaPfhialcefhlxdkdndnaPcsSmbamaPfaPc987fcefhmxekaocefhrao8SbbgPcFeGhHdndnaPcu9mmbarhoxekaocvfhoaHcFbGhHcrhPdninar8SbbgOcFbGaPtaHVhHaOcu9kmearcefhraPcrfgPc8J9hmbxdkkarcefhokaHce4cbaHceG9R7amfhmkdndnadcd9hmbabaDcetfgraz87ebarcdfas87ebarclfam87ebxekabaDcdtfgrazBdbarclfasBdbarcwfamBdbkavc;abfalcitfgramBdbarasBdlavaicdtfamBdbavc;abfalcefcsGglcitfgrazBdbaramBdlaicefhialcefhlxekdnarcpe0mbaxcefgOavaiaqarcsGfRbbgPcl49RcsGcdtfydbaPcz6gHEhravaiaP9RcsGcdtfydbaOaHfgsaPcsGgOEhPaOThOdndnadcd9hmbabaDcetfgzax87ebazcdfar87ebazclfaP87ebxekabaDcdtfgzaxBdbazclfarBdbazcwfaPBdbkavaicdtfaxBdbavc;abfalcitfgzarBdbazaxBdlavaicefgicsGcdtfarBdbavc;abfalcefcsGcitfgzaPBdbazarBdlavaiaHfcsGgicdtfaPBdbavc;abfalcdfcsGglcitfgraxBdbaraPBdlalcefhlaiaOfhiasaOfhxxekaxcbaoRbbgzEgAarc;:eSgrfhsazcsGhCazcl4hXdndnazcs0mbascefhOxekashOavaiaX9RcsGcdtfydbhskdndnaCmbaOcefhxxekaOhxavaiaz9RcsGcdtfydbhOkdndnarTmbaocefhrxekaocdfhrao8SbegHcFeGhPdnaHcu9kmbaocofhAaPcFbGhPcrhodninar8SbbgHcFbGaotaPVhPaHcu9kmearcefhraocrfgoc8J9hmbkaAhrxekarcefhrkaPce4cbaPceG9R7amfgmhAkdndnaXcsSmbarhPxekarcefhPar8SbbgocFeGhHdnaocu9kmbarcvfhsaHcFbGhHcrhodninaP8SbbgrcFbGaotaHVhHarcu9kmeaPcefhPaocrfgoc8J9hmbkashPxekaPcefhPkaHce4cbaHceG9R7amfgmhskdndnaCcsSmbaPhoxekaPcefhoaP8SbbgrcFeGhHdnarcu9kmbaPcvfhOaHcFbGhHcrhrdninao8SbbgPcFbGartaHVhHaPcu9kmeaocefhoarcrfgrc8J9hmbkaOhoxekaocefhokaHce4cbaHceG9R7amfgmhOkdndnadcd9hmbabaDcetfgraA87ebarcdfas87ebarclfaO87ebxekabaDcdtfgraABdbarclfasBdbarcwfaOBdbkavc;abfalcitfgrasBdbaraABdlavaicdtfaABdbavc;abfalcefcsGcitfgraOBdbarasBdlavaicefgicsGcdtfasBdbavc;abfalcdfcsGcitfgraABdbaraOBdlavaiazcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhialcifhlkawcefhwalcsGhlaicsGhiaDcifgDae6mbkkcbc99aoaqSEhokavc;aef8Kjjjjbaok:llevu8Jjjjjbcz9Rhvc9:hodnaecvfal0mbcuhoaiRbbc;:eGc;qe9hmbav9cb83iwaicefhraialfc98fhwdnaeTmbdnadcdSmbcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcdtfaicd4cbaice4ceG9R7avcwfaiceGcdtVgoydbfglBdbaoalBdbaDcefgDae9hmbxdkkcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcetfaicd4cbaice4ceG9R7avcwfaiceGcdtVgoydbfgl87ebaoalBdbaDcefgDae9hmbkkcbc99arawSEhokaok:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk;siliui99iue99dnaeTmbcbhiabhlindndnJ;Zl81Zalcof8UebgvciV:Y:vgoal8Ueb:YNgrJb;:FSNJbbbZJbbb:;arJbbbb9GEMgw:lJbbb9p9DTmbaw:OhDxekcjjjj94hDkalclf8Uebhqalcdf8UebhkabavcefciGaiVcetfaD87ebdndnaoak:YNgwJb;:FSNJbbbZJbbb:;awJbbbb9GEMgx:lJbbb9p9DTmbax:Ohkxekcjjjj94hkkabavcdfciGaiVcetfak87ebdndnaoaq:YNgoJb;:FSNJbbbZJbbb:;aoJbbbb9GEMgx:lJbbb9p9DTmbax:Ohqxekcjjjj94hqkabavcufciGaiVcetfaq87ebdndnJbbjZararN:tawawN:taoaoN:tgrJbbbbarJbbbb9GE:rJb;:FSNJbbbZMgr:lJbbb9p9DTmbar:Ohqxekcjjjj94hqkabavciGaiVcetfaq87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2geTmbinababydbgdcwtcw91:Yadce91cjjj;8ifcjjj98G::NUdbabclfhbaecufgembkkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaiczfhiaeczfheadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkkkebcjwklz9Kbb";
	var wasm_simd = "b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuikqbbebeedddilve9Weeeviebeoweuec:q;Aekr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbwl79IV9RbDq;t9tqlbzik9:evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaec:q:yjjbfai86bbaecitc:q1jjbfab8Piw83ibaecefgecjd9hmbkk;h8JlHud97euo978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnadcefal0mbcuhoaiRbbc:Ge9hmbavaialfgrad9Rad;8qbbcj;abad9UhoaicefhldnadTmbaoc;WFbGgocjdaocjd6EhwcbhDinaDae9pmeawaeaD9RaDawfae6Egqcsfgoc9WGgkci2hxakcethmaocl4cifcd4hPabaDad2fhscbhzdnincehHalhOcbhAdninaraO9RaP6miavcj;cbfaAak2fhCaOaPfhlcbhidnakc;ab6mbaral9Rc;Gb6mbcbhoinaCaofhidndndndndnaOaoco4fRbbgXciGPlbedibkaipxbbbbbbbbbbbbbbbbpklbxikaialpbblalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbalclfaYpQbfaKc:q:yjjbfRbbfhlxdkaialpbbwalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbalcwfaYpQbfaKc:q:yjjbfRbbfhlxekaialpbbbpklbalczfhlkdndndndndnaXcd4ciGPlbedibkaipxbbbbbbbbbbbbbbbbpklzxikaialpbblalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklzalclfaYpQbfaKc:q:yjjbfRbbfhlxdkaialpbbwalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklzalcwfaYpQbfaKc:q:yjjbfRbbfhlxekaialpbbbpklzalczfhlkdndndndndnaXcl4ciGPlbedibkaipxbbbbbbbbbbbbbbbbpklaxikaialpbblalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklaalclfaYpQbfaKc:q:yjjbfRbbfhlxdkaialpbbwalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklaalcwfaYpQbfaKc:q:yjjbfRbbfhlxekaialpbbbpklaalczfhlkdndndndndnaXco4Plbedibkaipxbbbbbbbbbbbbbbbbpkl8WxikaialpbblalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibaXc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkl8WalclfaYpQbfaXc:q:yjjbfRbbfhlxdkaialpbbwalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibaXc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkl8WalcwfaYpQbfaXc:q:yjjbfRbbfhlxekaialpbbbpkl8Walczfhlkaoc;abfhiaocjefak0meaihoaral9Rc;Fb0mbkkdndnaiak9pmbaici4hoinaral9RcK6mdaCaifhXdndndndndnaOaico4fRbbaocoG4ciGPlbedibkaXpxbbbbbbbbbbbbbbbbpklbxikaXalpbblalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbalclfaYpQbfaKc:q:yjjbfRbbfhlxdkaXalpbbwalpbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbalcwfaYpQbfaKc:q:yjjbfRbbfhlxekaXalpbbbpklbalczfhlkaocdfhoaiczfgiak6mbkkalTmbaAci6hHalhOaAcefgohAaoclSmdxekkcbhlaHceGmdkdnakTmbavcjdfazfhiavazfpbdbhYcbhXinaiavcj;cbfaXfgopblbgLcep9TaLpxeeeeeeeeeeeeeeeegQp9op9Hp9rgLaoakfpblbg8Acep9Ta8AaQp9op9Hp9rg8ApmbzeHdOiAlCvXoQrLgEaoamfpblbg3cep9Ta3aQp9op9Hp9rg3aoaxfpblbg5cep9Ta5aQp9op9Hp9rg5pmbzeHdOiAlCvXoQrLg8EpmbezHdiOAlvCXorQLgQaQpmbedibedibedibediaYp9UgYp9AdbbaiadfgoaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaoadfgoaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaoadfgoaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaoadfgoaYaEa8EpmwDKYqk8AExm35Ps8E8FgQaQpmbedibedibedibedip9UgYp9AdbbaoadfgoaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaoadfgoaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaoadfgoaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaoadfgoaYaLa8ApmwKDYq8AkEx3m5P8Es8FgLa3a5pmwKDYq8AkEx3m5P8Es8Fg8ApmbezHdiOAlvCXorQLgQaQpmbedibedibedibedip9UgYp9AdbbaoadfgoaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaoadfgoaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaoadfgoaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaoadfgoaYaLa8ApmwDKYqk8AExm35Ps8E8FgQaQpmbedibedibedibedip9UgYp9AdbbaoadfgoaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaoadfgoaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaoadfgoaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaoadfhiaXczfgXak6mbkkazclfgzad6mbkasavcjdfaqad2;8qbbavavcjdfaqcufad2fad;8qbbaqaDfhDc9:hoalmexikkc9:hoxekcbc99aral9Radcaadca0ESEhokavcj;kbf8Kjjjjbaokwbz:bjjjbk;uzeHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhodnaeTmbcmcsaDceSEhkcbhxcbhmcbhDcbhicbhlindnaoaq9nmbc9:hoxikdndnawRbbgrc;Ve0mbavc;abfalarcl4cu7fcsGcitfgPydlhsaPydbhzdnarcsGgPak9pmbavaiarcu7fcsGcdtfydbaxaPEhraPThPdndnadcd9hmbabaDcetfgHaz87ebaHcdfas87ebaHclfar87ebxekabaDcdtfgHazBdbaHclfasBdbaHcwfarBdbkaxaPfhxavc;abfalcitfgHarBdbaHasBdlavaicdtfarBdbavc;abfalcefcsGglcitfgHazBdbaHarBdlaiaPfhialcefhlxdkdndnaPcsSmbamaPfaPc987fcefhmxekaocefhrao8SbbgPcFeGhHdndnaPcu9mmbarhoxekaocvfhoaHcFbGhHcrhPdninar8SbbgOcFbGaPtaHVhHaOcu9kmearcefhraPcrfgPc8J9hmbxdkkarcefhokaHce4cbaHceG9R7amfhmkdndnadcd9hmbabaDcetfgraz87ebarcdfas87ebarclfam87ebxekabaDcdtfgrazBdbarclfasBdbarcwfamBdbkavc;abfalcitfgramBdbarasBdlavaicdtfamBdbavc;abfalcefcsGglcitfgrazBdbaramBdlaicefhialcefhlxekdnarcpe0mbaxcefgOavaiaqarcsGfRbbgPcl49RcsGcdtfydbaPcz6gHEhravaiaP9RcsGcdtfydbaOaHfgsaPcsGgOEhPaOThOdndnadcd9hmbabaDcetfgzax87ebazcdfar87ebazclfaP87ebxekabaDcdtfgzaxBdbazclfarBdbazcwfaPBdbkavaicdtfaxBdbavc;abfalcitfgzarBdbazaxBdlavaicefgicsGcdtfarBdbavc;abfalcefcsGcitfgzaPBdbazarBdlavaiaHfcsGgicdtfaPBdbavc;abfalcdfcsGglcitfgraxBdbaraPBdlalcefhlaiaOfhiasaOfhxxekaxcbaoRbbgzEgAarc;:eSgrfhsazcsGhCazcl4hXdndnazcs0mbascefhOxekashOavaiaX9RcsGcdtfydbhskdndnaCmbaOcefhxxekaOhxavaiaz9RcsGcdtfydbhOkdndnarTmbaocefhrxekaocdfhrao8SbegHcFeGhPdnaHcu9kmbaocofhAaPcFbGhPcrhodninar8SbbgHcFbGaotaPVhPaHcu9kmearcefhraocrfgoc8J9hmbkaAhrxekarcefhrkaPce4cbaPceG9R7amfgmhAkdndnaXcsSmbarhPxekarcefhPar8SbbgocFeGhHdnaocu9kmbarcvfhsaHcFbGhHcrhodninaP8SbbgrcFbGaotaHVhHarcu9kmeaPcefhPaocrfgoc8J9hmbkashPxekaPcefhPkaHce4cbaHceG9R7amfgmhskdndnaCcsSmbaPhoxekaPcefhoaP8SbbgrcFeGhHdnarcu9kmbaPcvfhOaHcFbGhHcrhrdninao8SbbgPcFbGartaHVhHaPcu9kmeaocefhoarcrfgrc8J9hmbkaOhoxekaocefhokaHce4cbaHceG9R7amfgmhOkdndnadcd9hmbabaDcetfgraA87ebarcdfas87ebarclfaO87ebxekabaDcdtfgraABdbarclfasBdbarcwfaOBdbkavc;abfalcitfgrasBdbaraABdlavaicdtfaABdbavc;abfalcefcsGcitfgraOBdbarasBdlavaicefgicsGcdtfasBdbavc;abfalcdfcsGcitfgraABdbaraOBdlavaiazcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhialcifhlkawcefhwalcsGhlaicsGhiaDcifgDae6mbkkcbc99aoaqSEhokavc;aef8Kjjjjbaok:llevu8Jjjjjbcz9Rhvc9:hodnaecvfal0mbcuhoaiRbbc;:eGc;qe9hmbav9cb83iwaicefhraialfc98fhwdnaeTmbdnadcdSmbcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcdtfaicd4cbaice4ceG9R7avcwfaiceGcdtVgoydbfglBdbaoalBdbaDcefgDae9hmbxdkkcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcetfaicd4cbaice4ceG9R7avcwfaiceGcdtVgoydbfgl87ebaoalBdbaDcefgDae9hmbkkcbc99arawSEhokaok:EPliuo97eue978Jjjjjbca9Rhidndnadcl9hmbdnaec98GglTmbcbhvabhdinadadpbbbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbadczfhdavclfgval6mbkkalae9pmeaiaeciGgvcdtgdVcbczad9R;8kbaiabalcdtfglad;8qbbdnavTmbaiaipblbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpklbkalaiad;8qbbskdnaec98GgxTmbcbhvabhdinadczfglalpbbbgopxbbbbbbFFbbbbbbFFgkp9oadpbbbgDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eaDaopmbediwDqkzHOAKY8AEgoczp:Sep;6egrp;Geaoczp:Reczp:Sep;6egwp;Gep;Kep;Legopxb;:FSb;:FSb;:FSb;:FSawaopxbbbbbbbbbbbbbbbbp:2egqawpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegwawp;Meaoaop;Mearaqaramp9op9rp;Kegoaop;Mep;Kep;Kep;Jep;Negrp;Mepxbbn0bbn0bbn0bbn0gqp;Keczp:Reawarp;Meaqp;KepxFFbbFFbbFFbbFFbbp9op9qgwaoarp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogopmwDKYqk8AExm35Ps8E8Fp9qpkbbadaDakp9oawaopmbezHdiOAlvCXorQLp9qpkbbadcafhdavclfgvax6mbkkaxae9pmbaiaeciGgvcitgdfcbcaad9R;8kbaiabaxcitfglad;8qbbdnavTmbaiaipblzgopxbbbbbbFFbbbbbbFFgkp9oaipblbgDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eaDaopmbediwDqkzHOAKY8AEgoczp:Sep;6egrp;Geaoczp:Reczp:Sep;6egwp;Gep;Kep;Legopxb;:FSb;:FSb;:FSb;:FSawaopxbbbbbbbbbbbbbbbbp:2egqawpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegwawp;Meaoaop;Mearaqaramp9op9rp;Kegoaop;Mep;Kep;Kep;Jep;Negrp;Mepxbbn0bbn0bbn0bbn0gqp;Keczp:Reawarp;Meaqp;KepxFFbbFFbbFFbbFFbbp9op9qgwaoarp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogopmwDKYqk8AExm35Ps8E8Fp9qpklzaiaDakp9oawaopmbezHdiOAlvCXorQLp9qpklbkalaiad;8qbbkk;4wllue97euv978Jjjjjbc8W9Rhidnaec98GglTmbcbhvabhoinaiaopbbbgraoczfgwpbbbgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklbaopxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaqakp;Mearp;Keczp:ReaDakp;Mearp;Keamp9op9qgkpmbezHdiOAlvCXorQLgrp5baipblbpEb:T:j83ibaocwfarp5eaipblbpEe:T:j83ibawaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblbpEd:T:j83ibaocKfakp5eaipblbpEi:T:j83ibaocafhoavclfgval6mbkkdnalae9pmbaiaeciGgvcitgofcbcaao9R;8kbaiabalcitfgwao;8qbbdnavTmbaiaipblbgraipblzgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklaaipxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaqakp;Mearp;Keczp:ReaDakp;Mearp;Keamp9op9qgkpmbezHdiOAlvCXorQLgrp5baipblapEb:T:j83ibaiarp5eaipblapEe:T:j83iwaiaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblapEd:T:j83izaiakp5eaipblapEi:T:j83iKkawaiao;8qbbkk:Pddiue978Jjjjjbc;ab9Rhidnadcd4ae2glc98GgvTmbcbhdabheinaeaepbbbgocwp:Recwp:Sep;6eaocep:SepxbbjZbbjZbbjZbbjZp:UepxbbjFbbjFbbjFbbjFp9op;Mepkbbaeczfheadclfgdav6mbkkdnaval9pmbaialciGgdcdtgeVcbc;abae9R;8kbaiabavcdtfgvae;8qbbdnadTmbaiaipblbgocwp:Recwp:Sep;6eaocep:SepxbbjZbbjZbbjZbbjZp:UepxbbjFbbjFbbjFbbjFp9op;Mepklbkavaiae;8qbbkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkkebcjwklz9Tbb";

	var detector = new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]);
	var wasmpack = new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);

	if (typeof WebAssembly !== 'object') {
		return {
			supported: false,
		};
	}

	var wasm = WebAssembly.validate(detector) ? wasm_simd : wasm_base;

	var instance;

	var ready =
		WebAssembly.instantiate(unpack(wasm), {})
		.then(function(result) {
			instance = result.instance;
			instance.exports.__wasm_call_ctors();
		});

	function unpack(data) {
		var result = new Uint8Array(data.length);
		for (var i = 0; i < data.length; ++i) {
			var ch = data.charCodeAt(i);
			result[i] = ch > 96 ? ch - 97 : ch > 64 ? ch - 39 : ch + 4;
		}
		var write = 0;
		for (var i = 0; i < data.length; ++i) {
			result[write++] = (result[i] < 60) ? wasmpack[result[i]] : (result[i] - 60) * 64 + result[++i];
		}
		return result.buffer.slice(0, write);
	}

	function decode(fun, target, count, size, source, filter) {
		var sbrk = instance.exports.sbrk;
		var count4 = (count + 3) & -4;
		var tp = sbrk(count4 * size);
		var sp = sbrk(source.length);
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(source, sp);
		var res = fun(tp, count, size, sp, source.length);
		if (res == 0 && filter) {
			filter(tp, count4, size);
		}
		target.set(heap.subarray(tp, tp + count * size));
		sbrk(tp - sbrk(0));
		if (res != 0) {
			throw new Error("Malformed buffer data: " + res);
		}
	}

	var filters = {
		NONE: "",
		OCTAHEDRAL: "meshopt_decodeFilterOct",
		QUATERNION: "meshopt_decodeFilterQuat",
		EXPONENTIAL: "meshopt_decodeFilterExp",
	};

	var decoders = {
		ATTRIBUTES: "meshopt_decodeVertexBuffer",
		TRIANGLES: "meshopt_decodeIndexBuffer",
		INDICES: "meshopt_decodeIndexSequence",
	};

	var workers = [];
	var requestId = 0;

	function createWorker(url) {
		var worker = {
			object: new Worker(url),
			pending: 0,
			requests: {}
		};

		worker.object.onmessage = function(event) {
			var data = event.data;

			worker.pending -= data.count;
			worker.requests[data.id][data.action](data.value);

			delete worker.requests[data.id];
		};

		return worker;
	}

	function initWorkers(count) {
		var source =
			"var instance; var ready = WebAssembly.instantiate(new Uint8Array([" + new Uint8Array(unpack(wasm)) + "]), {})" +
			".then(function(result) { instance = result.instance; instance.exports.__wasm_call_ctors(); });" +
			"self.onmessage = workerProcess;" +
			decode.toString() + workerProcess.toString();

		var blob = new Blob([source], {type: 'text/javascript'});
		var url = URL.createObjectURL(blob);

		for (var i = 0; i < count; ++i) {
			workers[i] = createWorker(url);
		}

		URL.revokeObjectURL(url);
	}

	function decodeWorker(count, size, source, mode, filter) {
		var worker = workers[0];

		for (var i = 1; i < workers.length; ++i) {
			if (workers[i].pending < worker.pending) {
				worker = workers[i];
			}
		}

		return new Promise(function (resolve, reject) {
			var data = new Uint8Array(source);
			var id = requestId++;

			worker.pending += count;
			worker.requests[id] = { resolve: resolve, reject: reject };
			worker.object.postMessage({ id: id, count: count, size: size, source: data, mode: mode, filter: filter }, [ data.buffer ]);
		});
	}

	function workerProcess(event) {
		ready.then(function() {
			var data = event.data;
			try {
				var target = new Uint8Array(data.count * data.size);
				decode(instance.exports[data.mode], target, data.count, data.size, data.source, instance.exports[data.filter]);
				self.postMessage({ id: data.id, count: data.count, action: "resolve", value: target }, [ target.buffer ]);
			} catch (error) {
				self.postMessage({ id: data.id, count: data.count, action: "reject", value: error });
			}
		});
	}

	return {
		ready: ready,
		supported: true,
		useWorkers: function(count) {
			initWorkers(count);
		},
		decodeVertexBuffer: function(target, count, size, source, filter) {
			decode(instance.exports.meshopt_decodeVertexBuffer, target, count, size, source, instance.exports[filters[filter]]);
		},
		decodeIndexBuffer: function(target, count, size, source) {
			decode(instance.exports.meshopt_decodeIndexBuffer, target, count, size, source);
		},
		decodeIndexSequence: function(target, count, size, source) {
			decode(instance.exports.meshopt_decodeIndexSequence, target, count, size, source);
		},
		decodeGltfBuffer: function(target, count, size, source, mode, filter) {
			decode(instance.exports[decoders[mode]], target, count, size, source, instance.exports[filters[filter]]);
		},
		decodeGltfBufferAsync: function(count, size, source, mode, filter) {
			if (workers.length > 0) {
				return decodeWorker(count, size, source, decoders[mode], filters[filter]);
			}

			return ready.then(function() {
				var target = new Uint8Array(count * size);
				decode(instance.exports[decoders[mode]], target, count, size, source, instance.exports[filters[filter]]);
				return target;
			});
		}
	};
})();

const renderModes = new Map([
    ['simple', SPRITE_RENDERMODE_SIMPLE],
    ['sliced', SPRITE_RENDERMODE_SLICED],
    ['tiled', SPRITE_RENDERMODE_TILED]
]);
const addressModes = new Map([
    ['repeat', ADDRESS_REPEAT],
    ['clamp', ADDRESS_CLAMP_TO_EDGE],
    ['mirror', ADDRESS_MIRRORED_REPEAT]
]);
const minFilterModes = new Map([
    ['nearest', FILTER_NEAREST],
    ['linear', FILTER_LINEAR],
    ['nearest-mip-nearest', FILTER_NEAREST_MIPMAP_NEAREST],
    ['linear-mip-nearest', FILTER_LINEAR_MIPMAP_NEAREST],
    ['nearest-mip-linear', FILTER_NEAREST_MIPMAP_LINEAR],
    ['linear-mip-linear', FILTER_LINEAR_MIPMAP_LINEAR]
]);
const magFilterModes = new Map([
    ['nearest', FILTER_NEAREST],
    ['linear', FILTER_LINEAR]
]);
// The engine's texture JSON spells the filter names with underscores ('linear_mip_linear'); the
// attribute values are kebab-case like every other enum attribute in this library. The address
// mode names contain no dashes, so for them the rename is the identity.
const toTextureJson = (name) => name.replace(/-/g, '_');
// Engine Texture constructor defaults, restored on a loaded texture when a texture option
// attribute is removed.
const textureOptionDefaults = {
    addressU: ADDRESS_REPEAT,
    addressV: ADDRESS_REPEAT,
    anisotropy: 1,
    flipY: false,
    magFilter: FILTER_LINEAR,
    minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
    mipmaps: true,
    srgb: false
};
// Attributes that only apply to certain asset types, used to warn when one is set on an asset of
// any other type (where it would otherwise be silently ignored).
const typeScopedAttributes = [
    [
        ['address-u', 'address-v', 'anisotropy', 'flip-y', 'mag-filter', 'min-filter', 'mipmaps', 'srgb'],
        ['texture', 'textureatlas']
    ],
    [['atlas', 'frame-keys', 'pixels-per-unit', 'render-mode'], ['sprite']]
];
const extToType = new Map([
    ['bin', 'binary'],
    ['css', 'css'],
    ['frag', 'shader'],
    ['glb', 'container'],
    ['glsl', 'shader'],
    ['gltf', 'container'],
    ['hdr', 'texture'],
    ['html', 'html'],
    ['jpg', 'texture'],
    ['js', 'script'],
    ['json', 'json'],
    ['ktx2', 'texture'],
    ['mp3', 'audio'],
    ['mjs', 'script'],
    ['ply', 'gsplat'],
    ['png', 'texture'],
    ['sog', 'gsplat'],
    ['txt', 'text'],
    ['vert', 'shader'],
    ['webp', 'texture']
]);
// provide buffer view callback so we can handle models compressed with MeshOptimizer
// https://github.com/zeux/meshoptimizer
const processBufferView = (gltfBuffer, buffers, continuation) => {
    if (gltfBuffer.extensions && gltfBuffer.extensions.EXT_meshopt_compression) {
        const extensionDef = gltfBuffer.extensions.EXT_meshopt_compression;
        Promise.all([MeshoptDecoder.ready, buffers[extensionDef.buffer]]).then((promiseResult) => {
            const buffer = promiseResult[1];
            const byteOffset = extensionDef.byteOffset || 0;
            const byteLength = extensionDef.byteLength || 0;
            const count = extensionDef.count;
            const stride = extensionDef.byteStride;
            const result = new Uint8Array(count * stride);
            const source = new Uint8Array(buffer.buffer, buffer.byteOffset + byteOffset, byteLength);
            MeshoptDecoder.decodeGltfBuffer(result, count, stride, source, extensionDef.mode, extensionDef.filter);
            continuation(null, result);
        });
    }
    else {
        continuation(null, null);
    }
};
/**
 * The AssetElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-asset/ | `<pc-asset>`} elements.
 * The AssetElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * The element becomes ready once the containing application has started and the asset is in the
 * state declared by the markup: loaded for preloaded assets (even if loading failed — check the
 * asset's `resource`), or registered and awaiting a load for `lazy` assets. Elements inserted
 * while the application is running are created and registered on insertion, and begin loading
 * immediately unless `lazy`. A `pc-asset` must be a direct child of `pc-app` — elements placed
 * elsewhere, or with an unsupported asset type, never become ready.
 *
 * A `lazy` asset loads on first use: the first time any element resolves it by `id` — a model,
 * a material map, a sky, a script `asset:` reference — or when the `lazy` attribute is removed,
 * whichever comes first. Until then it stays registered and unloaded.
 *
 * For `texture` and `textureatlas` assets, the texture options (`address-u`, `address-v`,
 * `min-filter`, `mag-filter`, `anisotropy`, `mipmaps`, `srgb`, `flip-y`) apply when the texture is
 * created and — like `lazy` — are observed: changing one updates a texture that has already
 * loaded, and removing one restores the engine default. Changing `srgb` or `mipmaps` on a loaded
 * texture recreates the underlying GPU resource, so prefer declaring those up front. Each option
 * overrides the matching key in the `data` JSON; options left unset write nothing, leaving the
 * engine's per-format defaults in force.
 *
 * Apart from `lazy` and the texture options, these attributes are read once when the asset is
 * created, so changing them later has no effect.
 *
 * @attribute {string} id - The identifier used to reference the asset from other elements.
 * @attribute {string} src - The URL of the asset to load.
 * @attribute {string} type - The asset type. Inferred from the `src` file extension when omitted.
 * @attribute {string} data - Additional asset data, as a JSON object.
 * @attribute {string} atlas - For a `sprite` asset, the `id` of the texture atlas asset it uses.
 * The atlas must be declared before the sprite.
 * @attribute {string} frame-keys - For a `sprite` asset, the atlas frame keys it uses, separated
 * by spaces or commas.
 * @attribute {number} pixels-per-unit - For a `sprite` asset, the number of pixels per world unit.
 * @attribute {'simple' | 'sliced' | 'tiled'} render-mode - For a `sprite` asset, how the sprite is
 * rendered when resized.
 *
 * @fires {Event} load - Fired each time the asset finishes loading, including a `lazy` asset
 * loaded later and any subsequent reloads. Does not bubble — listen on this element, or use a
 * capture-phase listener on an ancestor to observe every asset.
 * @fires {ErrorEvent} error - Fired when the asset fails to load, with the engine's error in
 * `message`. Does not bubble. The element still becomes ready — readiness means the load settled,
 * not that it succeeded.
 */
class AssetElement extends AsyncElement {
    _addressU = null;
    _addressV = null;
    _anisotropy = null;
    _flipY = null;
    _lazy = false;
    _magFilter = null;
    _minFilter = null;
    _mipmaps = null;
    _srgb = null;
    /**
     * The asset that is loaded. Available once the element is ready — await
     * {@link whenReady} or the element's `ready()` promise before accessing it.
     */
    asset = null;
    async connectedCallback() {
        const appElement = this.closestApp;
        if (!appElement)
            return;
        // Assets must be direct children of pc-app (matches the boot query ':scope > pc-asset')
        if (this.parentElement !== appElement) {
            console.warn(`pc-asset '${this.getAttribute('id') ?? this.getAttribute('src')}' must be a direct child of pc-app - asset not created`);
            return;
        }
        await appElement.ready();
        // The element may have been removed or re-parented while waiting for the app
        if (!this.isConnected || this.parentElement !== appElement)
            return;
        // Assets present at startup are created by AppElement's boot; this branch handles
        // elements inserted (or re-inserted) after the app is already running
        if (!this.asset) {
            const app = appElement.app;
            if (!app)
                return; // pc-app is re-connecting; its own boot will create this asset
            this._createAsset();
            if (this.asset) {
                app.assets.add(this.asset); // add() auto-loads when preload is true
                if (!this.lazy) {
                    app.assets.load(this.asset);
                }
            }
        }
        // Never ready if _createAsset failed (unsupported asset type)
        if (this.asset) {
            this._onReady();
        }
    }
    disconnectedCallback() {
        this._destroyAsset();
        // Re-arm readiness so a re-inserted element announces the asset it creates then
        this._resetReady();
    }
    _onAssetLoad() {
        this.dispatchEvent(new Event('load'));
    }
    _onAssetError(err) {
        this.dispatchEvent(new ErrorEvent('error', {
            message: err instanceof Error ? err.message : String(err)
        }));
    }
    /**
     * Creates the asset from the element's attributes. Called by the containing `<pc-app>`
     * element during its boot sweep, and on connection for elements inserted while the
     * application is already running.
     *
     * @internal
     */
    _createAsset() {
        const id = this.getAttribute('id') || '';
        const src = this.getAttribute('src') || '';
        let type = this.getAttribute('type');
        // If no type is specified, try to infer it from the file extension.
        if (!type) {
            const ext = src.split('.').pop();
            type = extToType.get(ext || '') ?? null;
        }
        if (!type) {
            console.warn(`Unsupported asset type: ${src}`);
            return;
        }
        // Attributes scoped to other asset types have no effect here - say so rather than
        // failing silently.
        const inapplicable = typeScopedAttributes
            .filter(([, types]) => !types.includes(type))
            .flatMap(([attributes]) => attributes)
            .filter((attribute) => this.hasAttribute(attribute));
        if (inapplicable.length > 0) {
            console.warn(`pc-asset '${id || src}' has attributes that do not apply to asset type '${type}' and are ignored: ${inapplicable.join(', ')}`);
        }
        // Optional inline asset data, used by data-driven assets such as texture atlases (frame
        // definitions) and sprites (atlas reference, frame keys, etc.).
        const data = this._buildData(type);
        if (type === 'container') {
            this.asset = new Asset(id, type, { url: src }, undefined, {
                // @ts-ignore TODO no definition in pc
                bufferView: {
                    processAsync: processBufferView.bind(this)
                }
            });
        }
        else if (type === 'sprite') {
            // Sprite assets have no file of their own; their data references a texture atlas asset.
            // @ts-ignore
            this.asset = new Asset(id, type, null, data);
        }
        else {
            // @ts-ignore
            this.asset = new Asset(id, type, src ? { url: src } : null, data);
        }
        this.asset.preload = !this._lazy;
        // Forward the engine asset's load outcome as DOM events on this element, like <img>.
        // Attached before the asset joins the registry, which is what starts a preloaded load.
        this.asset.on('load', this._onAssetLoad, this);
        this.asset.on('error', this._onAssetError, this);
    }
    /**
     * Builds the `data` object for the asset from an optional inline `data` attribute (JSON), the
     * texture option attributes (for `texture` and `textureatlas` assets), and the sprite
     * convenience attributes (`atlas`, `frame-keys`, `pixels-per-unit`, `render-mode`). An
     * attribute overrides the matching `data` JSON key. Returns `undefined` when there is no data
     * to apply.
     * @param type - The resolved asset type.
     * @returns The asset data, or `undefined`.
     */
    _buildData(type) {
        let data;
        const dataAttr = this.getAttribute('data');
        if (dataAttr) {
            try {
                data = JSON.parse(dataAttr);
            }
            catch (e) {
                console.warn(`Invalid 'data' JSON on pc-asset: ${dataAttr}`);
            }
        }
        if (type === 'texture' || type === 'textureatlas') {
            data = data ?? {};
            // Only options the user actually set are written: the engine reads these keys with
            // hasOwnProperty semantics, and an absent key leaves its per-format default (an HDR's
            // 'rgbe' type, a KTX2's transcoded format) in force.
            if (this._addressU !== null) {
                data.addressu = this._addressU;
            }
            if (this._addressV !== null) {
                data.addressv = this._addressV;
            }
            if (this._anisotropy !== null) {
                data.anisotropy = this._anisotropy;
            }
            if (this._flipY !== null) {
                // 'flipY' is the one camelCase key in the engine's texture JSON
                data.flipY = this._flipY;
            }
            if (this._magFilter !== null) {
                data.magfilter = toTextureJson(this._magFilter);
            }
            if (this._minFilter !== null) {
                data.minfilter = toTextureJson(this._minFilter);
            }
            if (this._mipmaps !== null) {
                data.mipmaps = this._mipmaps;
            }
            if (this._srgb !== null) {
                data.srgb = this._srgb;
            }
        }
        if (type === 'sprite') {
            data = data ?? {};
            // Resolve the referenced texture atlas to its (numeric) asset id. The atlas must be
            // declared before the sprite so its asset already exists in the registry. Resolved
            // with get, not useAsset: creation-time wiring is not a use, and the engine's
            // sprite handler loads the atlas when the sprite itself loads.
            const atlas = this.getAttribute('atlas') ?? data.textureAtlasAsset;
            if (typeof atlas === 'string') {
                const atlasAsset = AssetElement.get(atlas);
                if (atlasAsset) {
                    data.textureAtlasAsset = atlasAsset.id;
                }
                else {
                    console.warn(`pc-asset sprite '${this.getAttribute('id')}' could not find atlas '${atlas}'`);
                }
            }
            const frameKeys = this.getAttribute('frame-keys');
            if (frameKeys !== null) {
                data.frameKeys = frameKeys.split(/[\s,]+/).filter(Boolean);
            }
            const pixelsPerUnit = this.getAttribute('pixels-per-unit');
            if (pixelsPerUnit !== null) {
                data.pixelsPerUnit = parseNumber(pixelsPerUnit, 1, 'pixels-per-unit');
            }
            const renderMode = this.getAttribute('render-mode');
            if (renderMode !== null) {
                data.renderMode = renderModes.get(parseEnum(renderMode, renderModes, 'simple', 'render-mode'));
            }
            // Apply engine defaults for any values not supplied.
            data.renderMode = data.renderMode ?? SPRITE_RENDERMODE_SIMPLE;
            data.pixelsPerUnit = data.pixelsPerUnit ?? 1;
            data.frameKeys = data.frameKeys ?? [];
        }
        return data;
    }
    /**
     * Returns the engine texture behind this asset, when there is one: the resource itself for a
     * `texture` asset, the atlas's texture for a `textureatlas` asset, `null` otherwise
     * (including before the asset has loaded).
     * @returns The texture, or `null`.
     */
    _texture() {
        const asset = this.asset;
        if (!asset?.resource)
            return null;
        if (asset.type === 'texture')
            return asset.resource;
        if (asset.type === 'textureatlas')
            return asset.resource.texture ?? null;
        return null;
    }
    /**
     * Writes one texture option through to the created asset, if any. The engine-JSON key is
     * written into `asset.data`, mutated in place - replacing the whole object would make the
     * registry re-patch every key, and a re-patched `srgb` or `mipmaps` recreates the texture
     * even when unchanged. The in-place key is what a not-yet-started load reads at texture
     * construction, and what any later reload reads. When the texture already exists, the
     * corresponding property is assigned directly; `null` (attribute removed) deletes the key
     * and restores the engine default. Assets of any other type are left untouched.
     *
     * @param key - The engine texture JSON key in `asset.data`.
     * @param property - The Texture property to assign.
     * @param dataValue - The engine-JSON value for `asset.data`, or `null` to delete the key.
     * @param textureValue - The value for the Texture property, or `null` for the engine default.
     */
    _applyTextureOption(key, property, dataValue, textureValue) {
        const asset = this.asset;
        if (!asset || (asset.type !== 'texture' && asset.type !== 'textureatlas'))
            return;
        const data = asset.data;
        if (dataValue === null) {
            delete data[key];
        }
        else {
            data[key] = dataValue;
        }
        const texture = this._texture();
        if (texture) {
            // Every option here is a number- or boolean-valued Texture property; the
            // value/property pairing is fixed by the callers, which TypeScript cannot see
            // through the union.
            texture[property] =
                textureValue ?? textureOptionDefaults[property];
        }
    }
    _destroyAsset() {
        if (this.asset) {
            // A caller that keeps the Asset alive must not dispatch on a removed element
            this.asset.off('load', this._onAssetLoad, this);
            this.asset.off('error', this._onAssetError, this);
            // Deregister first so unload() can still notify the registry
            this.asset.registry?.remove(this.asset);
            this.asset.unload();
            this.asset = null;
        }
    }
    /**
     * Sets the texture's horizontal (U) address mode: how texture coordinates outside the 0 to 1
     * range sample the texture. Applies to `texture` and `textureatlas` assets, both when the
     * texture is created and after it has loaded.
     * @param value - The address mode, or `null` to use the engine default of 'repeat'.
     */
    set addressU(value) {
        this._addressU = value;
        const constant = value === null ? null : (addressModes.get(value) ?? ADDRESS_REPEAT);
        this._applyTextureOption('addressu', 'addressU', value, constant);
    }
    /**
     * Gets the texture's horizontal (U) address mode.
     * @returns The address mode, or `null` when unset.
     */
    get addressU() {
        return this._addressU;
    }
    /**
     * Sets the texture's vertical (V) address mode: how texture coordinates outside the 0 to 1
     * range sample the texture. Applies to `texture` and `textureatlas` assets, both when the
     * texture is created and after it has loaded.
     * @param value - The address mode, or `null` to use the engine default of 'repeat'.
     */
    set addressV(value) {
        this._addressV = value;
        const constant = value === null ? null : (addressModes.get(value) ?? ADDRESS_REPEAT);
        this._applyTextureOption('addressv', 'addressV', value, constant);
    }
    /**
     * Gets the texture's vertical (V) address mode.
     * @returns The address mode, or `null` when unset.
     */
    get addressV() {
        return this._addressV;
    }
    /**
     * Sets the texture's maximum anisotropic filtering level, which improves quality at oblique
     * viewing angles. Applies to `texture` and `textureatlas` assets, both when the texture is
     * created and after it has loaded.
     * @param value - The anisotropy level, or `null` to use the engine default of 1.
     */
    set anisotropy(value) {
        this._anisotropy = value;
        this._applyTextureOption('anisotropy', 'anisotropy', value, value);
    }
    /**
     * Gets the texture's maximum anisotropic filtering level.
     * @returns The anisotropy level, or `null` when unset.
     */
    get anisotropy() {
        return this._anisotropy;
    }
    /**
     * Sets whether the texture's image data is flipped vertically at upload. Applies to `texture`
     * and `textureatlas` assets, both when the texture is created and after it has loaded.
     * @param value - The flip flag, or `null` to use the engine default of `false`.
     */
    set flipY(value) {
        this._flipY = value;
        this._applyTextureOption('flipY', 'flipY', value, value);
    }
    /**
     * Gets whether the texture's image data is flipped vertically at upload.
     * @returns The flip flag, or `null` when unset.
     */
    get flipY() {
        return this._flipY;
    }
    /**
     * Sets whether the asset should be loaded lazily. A lazy asset is registered without being
     * loaded; it loads on first use - the first time any element resolves it by `id` - or when
     * this flag is cleared on a registered asset, whichever comes first.
     * @param value - The lazy loading flag.
     */
    set lazy(value) {
        this._lazy = value;
        if (this.asset) {
            this.asset.preload = !value;
            if (!value) {
                this.asset.registry?.load(this.asset);
            }
        }
    }
    /**
     * Gets whether the asset should be loaded lazily.
     * @returns The lazy loading flag.
     */
    get lazy() {
        return this._lazy;
    }
    /**
     * Sets the texture's magnification filter, used when the texture is displayed larger than its
     * source size. Applies to `texture` and `textureatlas` assets, both when the texture is
     * created and after it has loaded.
     * @param value - The filter, or `null` to use the engine default of 'linear'.
     */
    set magFilter(value) {
        this._magFilter = value;
        const json = value === null ? null : toTextureJson(value);
        const constant = value === null ? null : (magFilterModes.get(value) ?? FILTER_LINEAR);
        this._applyTextureOption('magfilter', 'magFilter', json, constant);
    }
    /**
     * Gets the texture's magnification filter.
     * @returns The filter, or `null` when unset.
     */
    get magFilter() {
        return this._magFilter;
    }
    /**
     * Sets the texture's minification filter, used when the texture is displayed smaller than its
     * source size. The mip variants blend within (and, for the second `linear`, between) mipmap
     * levels. Applies to `texture` and `textureatlas` assets, both when the texture is created
     * and after it has loaded.
     * @param value - The filter, or `null` to use the engine default of 'linear-mip-linear'.
     */
    set minFilter(value) {
        this._minFilter = value;
        const json = value === null ? null : toTextureJson(value);
        const constant = value === null ? null : (minFilterModes.get(value) ?? FILTER_LINEAR_MIPMAP_LINEAR);
        this._applyTextureOption('minfilter', 'minFilter', json, constant);
    }
    /**
     * Gets the texture's minification filter.
     * @returns The filter, or `null` when unset.
     */
    get minFilter() {
        return this._minFilter;
    }
    /**
     * Sets whether the texture generates and uses mipmaps. Changing this on a loaded texture
     * recreates the underlying GPU resource, so prefer declaring it up front. Applies to
     * `texture` and `textureatlas` assets.
     * @param value - The mipmaps flag, or `null` to use the engine default of `true`.
     */
    set mipmaps(value) {
        this._mipmaps = value;
        this._applyTextureOption('mipmaps', 'mipmaps', value, value);
    }
    /**
     * Gets whether the texture generates and uses mipmaps.
     * @returns The mipmaps flag, or `null` when unset.
     */
    get mipmaps() {
        return this._mipmaps;
    }
    /**
     * Sets whether the texture holds sRGB (gamma-encoded) color data, enabling hardware gamma
     * decode. Free when set before the texture loads; changing it on a loaded texture recreates
     * the underlying GPU resource. Applies to `texture` and `textureatlas` assets.
     * @param value - The sRGB flag, or `null` to use the engine default of `false`.
     */
    set srgb(value) {
        this._srgb = value;
        this._applyTextureOption('srgb', 'srgb', value, value);
    }
    /**
     * Gets whether the texture holds sRGB (gamma-encoded) color data.
     * @returns The sRGB flag, or `null` when unset.
     */
    get srgb() {
        return this._srgb;
    }
    /**
     * Returns the {@link Asset} created by the `<pc-asset>` element with the given `id`, or
     * `undefined` if there is no such element or its asset has not been created yet.
     *
     * @param id - The `id` of the `<pc-asset>` element.
     * @returns The asset, or `undefined`.
     */
    static get(id) {
        const assetElement = document.querySelector(`pc-asset[id="${id}"]`);
        return assetElement?.asset;
    }
    static get observedAttributes() {
        return [
            'address-u',
            'address-v',
            'anisotropy',
            'flip-y',
            'lazy',
            'mag-filter',
            'min-filter',
            'mipmaps',
            'srgb'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        // Each texture option keeps its parse* call as the branch's first assignment (the CEM
        // manifest derives the attribute's type and default from it - a ternary would degrade
        // both to plain string) and treats a removed attribute (null) as a reset to unset,
        // which restores the engine default on a loaded texture.
        switch (name) {
            case 'address-u':
                if (newValue !== null) {
                    this.addressU = parseEnum(newValue, addressModes, 'repeat', name);
                }
                else {
                    this.addressU = null;
                }
                break;
            case 'address-v':
                if (newValue !== null) {
                    this.addressV = parseEnum(newValue, addressModes, 'repeat', name);
                }
                else {
                    this.addressV = null;
                }
                break;
            case 'anisotropy':
                if (newValue !== null) {
                    this.anisotropy = parseNumber(newValue, 1, name);
                }
                else {
                    this.anisotropy = null;
                }
                break;
            case 'flip-y':
                if (newValue !== null) {
                    this.flipY = parseBool(newValue, false);
                }
                else {
                    this.flipY = null;
                }
                break;
            case 'lazy':
                this.lazy = parseBool(newValue, false);
                break;
            case 'mag-filter':
                if (newValue !== null) {
                    this.magFilter = parseEnum(newValue, magFilterModes, 'linear', name);
                }
                else {
                    this.magFilter = null;
                }
                break;
            case 'min-filter':
                if (newValue !== null) {
                    this.minFilter = parseEnum(newValue, minFilterModes, 'linear-mip-linear', name);
                }
                else {
                    this.minFilter = null;
                }
                break;
            case 'mipmaps':
                if (newValue !== null) {
                    this.mipmaps = parseBool(newValue, true);
                }
                else {
                    this.mipmaps = null;
                }
                break;
            case 'srgb':
                if (newValue !== null) {
                    this.srgb = parseBool(newValue, false);
                }
                else {
                    this.srgb = null;
                }
                break;
        }
    }
}
customElements.define('pc-asset', AssetElement);
/**
 * Resolves an asset reference for use: {@link AssetElement.get}, plus starting the load of a
 * registered asset that has not begun one - a `lazy` asset. Every element that consumes assets
 * resolves its references here, which is what makes `lazy` mean load on first use without any
 * consumer having to remember the load. The load is asynchronous - callers observe the asset's
 * `load` event for the resource.
 *
 * @param id - The `id` of the `<pc-asset>` element.
 * @returns The asset, or `undefined`.
 * @internal
 */
const useAsset = (id) => {
    const asset = AssetElement.get(id);
    // load() ignores an asset that is already loaded or loading, so repeated resolution
    // costs nothing.
    if (asset) {
        asset.registry?.load(asset);
    }
    return asset;
};

/**
 * Represents a component in the PlayCanvas engine.
 *
 * @category Components
 */
class ComponentElement extends AsyncElement {
    _componentName;
    _enabled = true;
    _component = null;
    _appElement = null;
    /**
     * The element hosting this component, held so the host's readiness cycles can be observed
     * even after `closestEntity` would no longer resolve (during teardown).
     */
    _hostElement = null;
    /**
     * The listener re-applying this component when the host's readiness cycles. Held for
     * removal on disconnect.
     */
    _hostReadyListener = null;
    /**
     * Incremented on every connect and disconnect. connectedCallback captures the value on entry
     * and abandons itself wherever it resumes from an await if the value has moved on — so a
     * callback whose element was removed cannot act on a torn-down tree, and one whose element
     * was removed and re-inserted (which runs a callback of its own) cannot add the component a
     * second time.
     */
    _connectionGeneration = 0;
    /**
     * Creates a new ComponentElement instance.
     *
     * @param componentName - The name of the component.
     * @ignore
     */
    constructor(componentName) {
        super();
        this._componentName = componentName;
    }
    /**
     * Returns the data the component is created with. Overridden by subclasses to supply the
     * initial values of their cached properties.
     *
     * @returns The initial component data.
     */
    getInitialComponentData() {
        return {};
    }
    /**
     * Creates the component on the host's current entity, removing it first from a previous
     * entity that is still alive (a retargeted `<pc-node>` moves its decorations with it). When
     * the entity already has a component of this type — a glTF node arriving with its authored
     * `render` component, say — warns and leaves `component` null. The element-level warning is
     * load-bearing: the engine's own duplicate-addComponent warning is Debug-stripped from
     * production builds, which would otherwise leave a silent null.
     */
    _applyComponent() {
        const entity = this._hostElement?.entity ?? null;
        if (this._component && this._component.entity === entity) {
            return;
        }
        // A retarget leaves the previous component on a still-live entity - remove it so the
        // decoration follows the element, or vanishes with a dissolved binding. A destroyed
        // entity took its components with it.
        const previous = this._component;
        if (previous?.entity && previous.entity.c[this._componentName] === previous) {
            previous.entity.removeComponent(this._componentName);
        }
        this._component = null;
        if (!entity) {
            return;
        }
        if (entity.c[this._componentName]) {
            const label = this.id ? ` '${this.id}'` : '';
            console.warn(`${this.tagName.toLowerCase()}${label} - '${entity.name}' already has a '${this._componentName}' component - component not added`);
            return;
        }
        this._component = entity.addComponent(this._componentName, this.getInitialComponentData());
    }
    async _addComponent() {
        const generation = this._connectionGeneration;
        const entityElement = this.closestEntity;
        if (!entityElement) {
            // A component can only exist on an entity, so an element placed outside one is inert.
            // It still becomes ready (with a null `component`), so warn rather than fail silently
            const label = this.id ? ` '${this.id}'` : '';
            console.warn(`${this.tagName.toLowerCase()}${label} must be a descendant of pc-entity - component not added`);
            return;
        }
        await entityElement.ready();
        // The element may have been removed, or removed and re-inserted, while the entity became
        // ready — the component belongs to the connection that owns the current generation.
        if (generation !== this._connectionGeneration) {
            return;
        }
        this._hostElement = entityElement;
        this._applyComponent();
        // Re-apply when the host's readiness cycles without this element disconnecting: a
        // `<pc-node>` rebinding after its model reloads or retargets, or a re-created entity.
        // The 'ready' event bubbles, so events from descendants pass through this host - only
        // the host's own cycles count. Readiness is cycled here too, so decorations one level
        // down re-apply the same way.
        this._hostReadyListener = (event) => {
            if (event.target !== this._hostElement) {
                return;
            }
            if (generation !== this._connectionGeneration) {
                return;
            }
            this._hostCycled();
        };
        entityElement.addEventListener('ready', this._hostReadyListener);
    }
    /**
     * Re-evaluates this component against the host's current entity: applied to a new entity,
     * moved from a still-live old one, or removed when the host no longer fronts an entity at
     * all. Readiness follows - it cycles with a re-application and stays unresolved while the
     * host is unbound. Called by the host-ready listener, and directly by a `<pc-node>`
     * dissolving its binding: the one transition that fires no ready event to ride.
     *
     * @internal
     */
    _hostCycled() {
        this._resetReady();
        this._applyComponent();
        if (this._hostElement?.entity) {
            this.initComponent();
            this._onReady();
        }
    }
    /**
     * Configures the newly added component. Overridden by subclasses whose setup goes beyond
     * the initial data — child-element handling, asset resolution and the like.
     */
    initComponent() {
        // optional hook
    }
    async connectedCallback() {
        const generation = ++this._connectionGeneration;
        this._appElement = this.closestApp ?? null;
        await this._appElement?.ready();
        // The element may have been removed, or removed and re-inserted, while the application
        // became ready. A re-insertion runs a connectedCallback of its own, so a stale resume
        // must not add the component alongside it.
        if (generation !== this._connectionGeneration) {
            return;
        }
        await this._addComponent();
        if (generation !== this._connectionGeneration) {
            return;
        }
        this.initComponent();
        this._onReady();
    }
    disconnectedCallback() {
        // Invalidate any connectedCallback still suspended on an await
        this._connectionGeneration++;
        if (this._hostElement && this._hostReadyListener) {
            this._hostElement.removeEventListener('ready', this._hostReadyListener);
        }
        this._hostElement = null;
        this._hostReadyListener = null;
        // Remove the component when the element is disconnected. Skip this when the owning
        // application has already been destroyed — removing a <pc-app> disconnects it before
        // its children, taking the component systems with it.
        if (this._appElement?.app && this._component?.entity) {
            this._component.entity.removeComponent(this._componentName);
        }
        this._component = null;
        this._appElement = null;
        this._resetReady();
    }
    /**
     * The PlayCanvas component instance. `null` until the element is ready, and also for an
     * element that is not a descendant of a `<pc-entity>` — await {@link whenReady} or the
     * element's `ready()` promise before accessing it.
     * @returns The component instance, or `null`.
     */
    get component() {
        return this._component;
    }
    /**
     * Sets the enabled state of the component.
     * @param value - The enabled state of the component.
     */
    set enabled(value) {
        this._enabled = value;
        if (this.component) {
            this.component.enabled = value;
        }
    }
    /**
     * Gets the enabled state of the component.
     * @returns The enabled state of the component.
     */
    get enabled() {
        return this._enabled;
    }
    static get observedAttributes() {
        return ['enabled'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'enabled':
                this.enabled = parseBool(newValue, true);
                break;
        }
    }
}

/**
 * The ListenerComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-listener/ | `<pc-listener>`} elements.
 * The ListenerComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class ListenerComponentElement extends ComponentElement {
    /** @ignore */
    constructor() {
        super('audiolistener');
    }
    /**
     * Gets the underlying PlayCanvas audio listener component.
     * @returns The audio listener component.
     */
    get component() {
        return super.component;
    }
}
customElements.define('pc-listener', ListenerComponentElement);

const transitionModes = new Map([
    ['tint', BUTTON_TRANSITION_MODE_TINT],
    ['sprite', BUTTON_TRANSITION_MODE_SPRITE_CHANGE]
]);
/**
 * The ButtonComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-button/ | `<pc-button>`} elements.
 * The ButtonComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class ButtonComponentElement extends ComponentElement {
    _active = true;
    _image = '';
    _hitPadding = new Vec4(0, 0, 0, 0);
    _transitionMode = 'tint';
    _hoverTint = new Color(1, 1, 1, 1);
    _pressedTint = new Color(1, 1, 1, 1);
    _inactiveTint = new Color(1, 1, 1, 1);
    _fadeDuration = 0;
    _hoverSpriteAsset = '';
    _hoverSpriteFrame = 0;
    _pressedSpriteAsset = '';
    _pressedSpriteFrame = 0;
    _inactiveSpriteAsset = '';
    _inactiveSpriteFrame = 0;
    /** @ignore */
    constructor() {
        super('button');
    }
    getInitialComponentData() {
        const data = {
            active: this._active,
            hitPadding: this._hitPadding,
            transitionMode: transitionModes.get(this._transitionMode),
            hoverTint: this._hoverTint,
            pressedTint: this._pressedTint,
            inactiveTint: this._inactiveTint,
            fadeDuration: this._fadeDuration,
            hoverSpriteFrame: this._hoverSpriteFrame,
            pressedSpriteFrame: this._pressedSpriteFrame,
            inactiveSpriteFrame: this._inactiveSpriteFrame
        };
        // The image entity defaults to the button's own entity (which carries the image element)
        // when no explicit reference is provided.
        const imageEntity = this._image ? getEntity(this._image) : this.closestEntity?.entity;
        if (imageEntity) {
            data.imageEntity = imageEntity;
        }
        const hoverSpriteAsset = useAsset(this._hoverSpriteAsset);
        if (hoverSpriteAsset) {
            data.hoverSpriteAsset = hoverSpriteAsset.id;
        }
        const pressedSpriteAsset = useAsset(this._pressedSpriteAsset);
        if (pressedSpriteAsset) {
            data.pressedSpriteAsset = pressedSpriteAsset.id;
        }
        const inactiveSpriteAsset = useAsset(this._inactiveSpriteAsset);
        if (inactiveSpriteAsset) {
            data.inactiveSpriteAsset = inactiveSpriteAsset.id;
        }
        return data;
    }
    /**
     * Gets the underlying PlayCanvas button component.
     * @returns The button component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets whether the button is active and responds to input.
     * @param value - Whether the button is active.
     */
    set active(value) {
        this._active = value;
        if (this.component) {
            this.component.active = value;
        }
    }
    /**
     * Gets whether the button is active.
     * @returns Whether the button is active.
     */
    get active() {
        return this._active;
    }
    /**
     * Sets the reference (CSS selector, element id or entity name) to the `<pc-entity>` whose image
     * element is used for visual transitions. Defaults to the button's own entity.
     * @param value - The image entity reference.
     */
    set image(value) {
        this._image = value;
        const entity = getEntity(value);
        if (this.component && entity) {
            this.component.imageEntity = entity;
        }
    }
    /**
     * Gets the reference to the `<pc-entity>` whose image element is used for visual transitions.
     * @returns The image entity reference.
     */
    get image() {
        return this._image;
    }
    /**
     * Sets the padding used to expand the button's hit area, as a Vec4 (left, bottom, right, top).
     * @param value - The hit padding.
     */
    set hitPadding(value) {
        this._hitPadding = value;
        if (this.component) {
            this.component.hitPadding = value;
        }
    }
    /**
     * Gets the padding used to expand the button's hit area.
     * @returns The hit padding.
     */
    get hitPadding() {
        return this._hitPadding;
    }
    /**
     * Sets how the button reacts to being hovered/pressed. Can be `tint` or `sprite`. Defaults to
     * `tint`.
     * @param value - The transition mode.
     */
    set transitionMode(value) {
        this._transitionMode = value;
        if (this.component) {
            this.component.transitionMode = transitionModes.get(value) ?? BUTTON_TRANSITION_MODE_TINT;
        }
    }
    /**
     * Gets how the button reacts to being hovered/pressed.
     * @returns The transition mode.
     */
    get transitionMode() {
        return this._transitionMode;
    }
    /**
     * Sets the tint color applied to the image entity when the button is hovered (tint transition
     * mode).
     * @param value - The hover tint.
     */
    set hoverTint(value) {
        this._hoverTint = value;
        if (this.component) {
            this.component.hoverTint = value;
        }
    }
    /**
     * Gets the hover tint color.
     * @returns The hover tint.
     */
    get hoverTint() {
        return this._hoverTint;
    }
    /**
     * Sets the tint color applied to the image entity when the button is pressed (tint transition
     * mode).
     * @param value - The pressed tint.
     */
    set pressedTint(value) {
        this._pressedTint = value;
        if (this.component) {
            this.component.pressedTint = value;
        }
    }
    /**
     * Gets the pressed tint color.
     * @returns The pressed tint.
     */
    get pressedTint() {
        return this._pressedTint;
    }
    /**
     * Sets the tint color applied to the image entity when the button is inactive (tint transition
     * mode).
     * @param value - The inactive tint.
     */
    set inactiveTint(value) {
        this._inactiveTint = value;
        if (this.component) {
            this.component.inactiveTint = value;
        }
    }
    /**
     * Gets the inactive tint color.
     * @returns The inactive tint.
     */
    get inactiveTint() {
        return this._inactiveTint;
    }
    /**
     * Sets the duration (in milliseconds) over which tint transitions are applied.
     * @param value - The fade duration.
     */
    set fadeDuration(value) {
        this._fadeDuration = value;
        if (this.component) {
            this.component.fadeDuration = value;
        }
    }
    /**
     * Gets the duration over which tint transitions are applied.
     * @returns The fade duration.
     */
    get fadeDuration() {
        return this._fadeDuration;
    }
    /**
     * Sets the id of the `pc-asset` sprite shown when the button is hovered (sprite transition
     * mode).
     * @param value - The hover sprite asset id.
     */
    set hoverSpriteAsset(value) {
        this._hoverSpriteAsset = value;
        const asset = useAsset(value);
        if (this.component && asset) {
            this.component.hoverSpriteAsset = asset.id;
        }
    }
    /**
     * Gets the id of the `pc-asset` sprite shown when the button is hovered.
     * @returns The hover sprite asset id.
     */
    get hoverSpriteAsset() {
        return this._hoverSpriteAsset;
    }
    /**
     * Sets the frame of the hover sprite to show.
     * @param value - The hover sprite frame.
     */
    set hoverSpriteFrame(value) {
        this._hoverSpriteFrame = value;
        if (this.component) {
            this.component.hoverSpriteFrame = value;
        }
    }
    /**
     * Gets the frame of the hover sprite to show.
     * @returns The hover sprite frame.
     */
    get hoverSpriteFrame() {
        return this._hoverSpriteFrame;
    }
    /**
     * Sets the id of the `pc-asset` sprite shown when the button is pressed (sprite transition
     * mode).
     * @param value - The pressed sprite asset id.
     */
    set pressedSpriteAsset(value) {
        this._pressedSpriteAsset = value;
        const asset = useAsset(value);
        if (this.component && asset) {
            this.component.pressedSpriteAsset = asset.id;
        }
    }
    /**
     * Gets the id of the `pc-asset` sprite shown when the button is pressed.
     * @returns The pressed sprite asset id.
     */
    get pressedSpriteAsset() {
        return this._pressedSpriteAsset;
    }
    /**
     * Sets the frame of the pressed sprite to show.
     * @param value - The pressed sprite frame.
     */
    set pressedSpriteFrame(value) {
        this._pressedSpriteFrame = value;
        if (this.component) {
            this.component.pressedSpriteFrame = value;
        }
    }
    /**
     * Gets the frame of the pressed sprite to show.
     * @returns The pressed sprite frame.
     */
    get pressedSpriteFrame() {
        return this._pressedSpriteFrame;
    }
    /**
     * Sets the id of the `pc-asset` sprite shown when the button is inactive (sprite transition
     * mode).
     * @param value - The inactive sprite asset id.
     */
    set inactiveSpriteAsset(value) {
        this._inactiveSpriteAsset = value;
        const asset = useAsset(value);
        if (this.component && asset) {
            this.component.inactiveSpriteAsset = asset.id;
        }
    }
    /**
     * Gets the id of the `pc-asset` sprite shown when the button is inactive.
     * @returns The inactive sprite asset id.
     */
    get inactiveSpriteAsset() {
        return this._inactiveSpriteAsset;
    }
    /**
     * Sets the frame of the inactive sprite to show.
     * @param value - The inactive sprite frame.
     */
    set inactiveSpriteFrame(value) {
        this._inactiveSpriteFrame = value;
        if (this.component) {
            this.component.inactiveSpriteFrame = value;
        }
    }
    /**
     * Gets the frame of the inactive sprite to show.
     * @returns The inactive sprite frame.
     */
    get inactiveSpriteFrame() {
        return this._inactiveSpriteFrame;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'active',
            'image',
            'hit-padding',
            'transition-mode',
            'hover-tint',
            'pressed-tint',
            'inactive-tint',
            'fade-duration',
            'hover-sprite-asset',
            'hover-sprite-frame',
            'pressed-sprite-asset',
            'pressed-sprite-frame',
            'inactive-sprite-asset',
            'inactive-sprite-frame'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'active':
                this.active = parseBool(newValue, true);
                break;
            case 'image':
                this.image = newValue ?? '';
                break;
            case 'hit-padding':
                this.hitPadding = parseVec4(newValue, Vec4.ZERO, name);
                break;
            case 'transition-mode':
                this.transitionMode = parseEnum(newValue, transitionModes, 'tint', name);
                break;
            case 'hover-tint':
                this.hoverTint = parseColor(newValue, Color.WHITE, name);
                break;
            case 'pressed-tint':
                this.pressedTint = parseColor(newValue, Color.WHITE, name);
                break;
            case 'inactive-tint':
                this.inactiveTint = parseColor(newValue, Color.WHITE, name);
                break;
            case 'fade-duration':
                this.fadeDuration = parseNumber(newValue, 0, name);
                break;
            case 'hover-sprite-asset':
                this.hoverSpriteAsset = newValue ?? '';
                break;
            case 'hover-sprite-frame':
                this.hoverSpriteFrame = parseNumber(newValue, 0, name);
                break;
            case 'pressed-sprite-asset':
                this.pressedSpriteAsset = newValue ?? '';
                break;
            case 'pressed-sprite-frame':
                this.pressedSpriteFrame = parseNumber(newValue, 0, name);
                break;
            case 'inactive-sprite-asset':
                this.inactiveSpriteAsset = newValue ?? '';
                break;
            case 'inactive-sprite-frame':
                this.inactiveSpriteFrame = parseNumber(newValue, 0, name);
                break;
        }
    }
}
customElements.define('pc-button', ButtonComponentElement);

const projections = new Map([
    ['perspective', PROJECTION_PERSPECTIVE],
    ['orthographic', PROJECTION_ORTHOGRAPHIC]
]);
const tonemaps = new Map([
    ['none', TONEMAP_NONE],
    ['linear', TONEMAP_LINEAR],
    ['filmic', TONEMAP_FILMIC],
    ['hejl', TONEMAP_HEJL],
    ['aces', TONEMAP_ACES],
    ['aces2', TONEMAP_ACES2],
    ['neutral', TONEMAP_NEUTRAL]
]);
/**
 * The CameraComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-camera/ | `<pc-camera>`} elements.
 * The CameraComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class CameraComponentElement extends ComponentElement {
    _clearColor = new Color(0.75, 0.75, 0.75, 1);
    _clearColorBuffer = true;
    _clearDepthBuffer = true;
    _clearStencilBuffer = false;
    _cullFaces = true;
    _farClip = 1000;
    _flipFaces = false;
    _fov = 45;
    _frustumCulling = true;
    _gamma = 'srgb';
    _horizontalFov = false;
    _nearClip = 0.1;
    _projection = 'perspective';
    _orthoHeight = 10;
    _priority = 0;
    _rect = new Vec4(0, 0, 1, 1);
    _scissorRect = new Vec4(0, 0, 1, 1);
    _tonemap = 'none';
    /** @ignore */
    constructor() {
        super('camera');
    }
    getInitialComponentData() {
        return {
            clearColor: this._clearColor,
            clearColorBuffer: this._clearColorBuffer,
            clearDepthBuffer: this._clearDepthBuffer,
            clearStencilBuffer: this._clearStencilBuffer,
            cullFaces: this._cullFaces,
            farClip: this._farClip,
            flipFaces: this._flipFaces,
            fov: this._fov,
            frustumCulling: this._frustumCulling,
            gammaCorrection: this._gamma === 'srgb' ? GAMMA_SRGB : GAMMA_NONE,
            horizontalFov: this._horizontalFov,
            nearClip: this._nearClip,
            projection: projections.get(this._projection) ?? PROJECTION_PERSPECTIVE,
            orthoHeight: this._orthoHeight,
            priority: this._priority,
            rect: this._rect,
            scissorRect: this._scissorRect,
            toneMapping: tonemaps.get(this._tonemap) ?? TONEMAP_NONE
        };
    }
    get xrAvailable() {
        const xrManager = this.component?.system.app.xr;
        return xrManager && xrManager.supported && xrManager.isAvailable(XRTYPE_VR);
    }
    /**
     * Starts the camera in XR mode.
     * @param type - The type of XR mode to start.
     * @param space - The space to start the camera in.
     */
    startXr(type, space) {
        if (this.component && this.xrAvailable) {
            this.component.startXr(type, space, {
                callback: (err) => {
                    if (err)
                        console.error(`WebXR Immersive VR failed to start: ${err.message}`);
                }
            });
        }
    }
    /**
     * Ends the camera's XR mode.
     */
    endXr() {
        if (this.component) {
            this.component.endXr();
        }
    }
    /**
     * Gets the underlying PlayCanvas camera component.
     * @returns The camera component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets the clear color of the camera.
     * @param value - The clear color.
     */
    set clearColor(value) {
        this._clearColor = value;
        if (this.component) {
            this.component.clearColor = value;
        }
    }
    /**
     * Gets the clear color of the camera.
     * @returns The clear color.
     */
    get clearColor() {
        return this._clearColor;
    }
    /**
     * Sets the clear color buffer of the camera.
     * @param value - The clear color buffer.
     */
    set clearColorBuffer(value) {
        this._clearColorBuffer = value;
        if (this.component) {
            this.component.clearColorBuffer = value;
        }
    }
    /**
     * Gets the clear color buffer of the camera.
     * @returns The clear color buffer.
     */
    get clearColorBuffer() {
        return this._clearColorBuffer;
    }
    /**
     * Sets the clear depth buffer of the camera.
     * @param value - The clear depth buffer.
     */
    set clearDepthBuffer(value) {
        this._clearDepthBuffer = value;
        if (this.component) {
            this.component.clearDepthBuffer = value;
        }
    }
    /**
     * Gets the clear depth buffer of the camera.
     * @returns The clear depth buffer.
     */
    get clearDepthBuffer() {
        return this._clearDepthBuffer;
    }
    /**
     * Sets the clear stencil buffer of the camera.
     * @param value - The clear stencil buffer.
     */
    set clearStencilBuffer(value) {
        this._clearStencilBuffer = value;
        if (this.component) {
            this.component.clearStencilBuffer = value;
        }
    }
    /**
     * Gets the clear stencil buffer of the camera.
     * @returns The clear stencil buffer.
     */
    get clearStencilBuffer() {
        return this._clearStencilBuffer;
    }
    /**
     * Sets the cull faces of the camera.
     * @param value - The cull faces.
     */
    set cullFaces(value) {
        this._cullFaces = value;
        if (this.component) {
            this.component.cullFaces = value;
        }
    }
    /**
     * Gets the cull faces of the camera.
     * @returns The cull faces.
     */
    get cullFaces() {
        return this._cullFaces;
    }
    /**
     * Sets the far clip distance of the camera.
     * @param value - The far clip distance.
     */
    set farClip(value) {
        this._farClip = value;
        if (this.component) {
            this.component.farClip = value;
        }
    }
    /**
     * Gets the far clip distance of the camera.
     * @returns The far clip distance.
     */
    get farClip() {
        return this._farClip;
    }
    /**
     * Sets the flip faces of the camera.
     * @param value - The flip faces.
     */
    set flipFaces(value) {
        this._flipFaces = value;
        if (this.component) {
            this.component.flipFaces = value;
        }
    }
    /**
     * Gets the flip faces of the camera.
     * @returns The flip faces.
     */
    get flipFaces() {
        return this._flipFaces;
    }
    /**
     * Sets the field of view of the camera.
     * @param value - The field of view.
     */
    set fov(value) {
        this._fov = value;
        if (this.component) {
            this.component.fov = value;
        }
    }
    /**
     * Gets the field of view of the camera.
     * @returns The field of view.
     */
    get fov() {
        return this._fov;
    }
    /**
     * Sets the frustum culling of the camera.
     * @param value - The frustum culling.
     */
    set frustumCulling(value) {
        this._frustumCulling = value;
        if (this.component) {
            this.component.frustumCulling = value;
        }
    }
    /**
     * Gets the frustum culling of the camera.
     * @returns The frustum culling.
     */
    get frustumCulling() {
        return this._frustumCulling;
    }
    /**
     * Sets the gamma correction of the camera.
     * @param value - The gamma correction.
     */
    set gamma(value) {
        this._gamma = value;
        if (this.component) {
            this.component.gammaCorrection = value === 'srgb' ? GAMMA_SRGB : GAMMA_NONE;
        }
    }
    /**
     * Gets the gamma correction of the camera.
     * @returns The gamma correction.
     */
    get gamma() {
        return this._gamma;
    }
    /**
     * Sets whether the camera's field of view (fov) is horizontal or vertical. Defaults to false
     * (meaning it is vertical be default).
     * @param value - Whether the camera's field of view is horizontal.
     */
    set horizontalFov(value) {
        this._horizontalFov = value;
        if (this.component) {
            this.component.horizontalFov = value;
        }
    }
    /**
     * Gets whether the camera's field of view (fov) is horizontal or vertical.
     * @returns Whether the camera's field of view is horizontal.
     */
    get horizontalFov() {
        return this._horizontalFov;
    }
    /**
     * Sets the near clip distance of the camera.
     * @param value - The near clip distance.
     */
    set nearClip(value) {
        this._nearClip = value;
        if (this.component) {
            this.component.nearClip = value;
        }
    }
    /**
     * Gets the near clip distance of the camera.
     * @returns The near clip distance.
     */
    get nearClip() {
        return this._nearClip;
    }
    /**
     * Sets the orthographic height of the camera.
     * @param value - The orthographic height.
     */
    set orthoHeight(value) {
        this._orthoHeight = value;
        if (this.component) {
            this.component.orthoHeight = value;
        }
    }
    /**
     * Gets the orthographic height of the camera.
     * @returns The orthographic height.
     */
    get orthoHeight() {
        return this._orthoHeight;
    }
    /**
     * Sets the priority of the camera.
     * @param value - The priority.
     */
    set priority(value) {
        this._priority = value;
        if (this.component) {
            this.component.priority = value;
        }
    }
    /**
     * Gets the priority of the camera.
     * @returns The priority.
     */
    get priority() {
        return this._priority;
    }
    /**
     * Sets the projection of the camera. Use `orthoHeight` to size an orthographic projection.
     * @param value - The projection ('perspective' or 'orthographic').
     */
    set projection(value) {
        this._projection = value;
        if (this.component) {
            this.component.projection = projections.get(value) ?? PROJECTION_PERSPECTIVE;
        }
    }
    /**
     * Gets the projection of the camera.
     * @returns The projection.
     */
    get projection() {
        return this._projection;
    }
    /**
     * Sets the rect of the camera.
     * @param value - The rect.
     */
    set rect(value) {
        this._rect = value;
        if (this.component) {
            this.component.rect = value;
        }
    }
    /**
     * Gets the rect of the camera.
     * @returns The rect.
     */
    get rect() {
        return this._rect;
    }
    /**
     * Sets the scissor rect of the camera.
     * @param value - The scissor rect.
     */
    set scissorRect(value) {
        this._scissorRect = value;
        if (this.component) {
            this.component.scissorRect = value;
        }
    }
    /**
     * Gets the scissor rect of the camera.
     * @returns The scissor rect.
     */
    get scissorRect() {
        return this._scissorRect;
    }
    /**
     * Sets the tone mapping of the camera.
     * @param value - The tone mapping.
     */
    set tonemap(value) {
        this._tonemap = value;
        if (this.component) {
            this.component.toneMapping = tonemaps.get(value) ?? TONEMAP_NONE;
        }
    }
    /**
     * Gets the tone mapping of the camera.
     * @returns The tone mapping.
     */
    get tonemap() {
        return this._tonemap;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'clear-color',
            'clear-color-buffer',
            'clear-depth-buffer',
            'clear-stencil-buffer',
            'cull-faces',
            'far-clip',
            'flip-faces',
            'fov',
            'frustum-culling',
            'gamma',
            'horizontal-fov',
            'near-clip',
            'ortho-height',
            'priority',
            'projection',
            'rect',
            'scissor-rect',
            'tonemap'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'clear-color':
                this.clearColor = parseColor(newValue, new Color(0.75, 0.75, 0.75, 1), name);
                break;
            case 'clear-color-buffer':
                this.clearColorBuffer = parseBool(newValue, true);
                break;
            case 'clear-depth-buffer':
                this.clearDepthBuffer = parseBool(newValue, true);
                break;
            case 'clear-stencil-buffer':
                this.clearStencilBuffer = parseBool(newValue, false);
                break;
            case 'cull-faces':
                this.cullFaces = parseBool(newValue, true);
                break;
            case 'far-clip':
                this.farClip = parseNumber(newValue, 1000, name);
                break;
            case 'flip-faces':
                this.flipFaces = parseBool(newValue, false);
                break;
            case 'fov':
                this.fov = parseNumber(newValue, 45, name);
                break;
            case 'frustum-culling':
                this.frustumCulling = parseBool(newValue, true);
                break;
            case 'gamma':
                this.gamma = parseEnum(newValue, ['linear', 'srgb'], 'srgb', name);
                break;
            case 'horizontal-fov':
                this.horizontalFov = parseBool(newValue, false);
                break;
            case 'near-clip':
                this.nearClip = parseNumber(newValue, 0.1, name);
                break;
            case 'ortho-height':
                this.orthoHeight = parseNumber(newValue, 10, name);
                break;
            case 'priority':
                this.priority = parseNumber(newValue, 0, name);
                break;
            case 'projection':
                this.projection = parseEnum(newValue, projections, 'perspective', name);
                break;
            case 'rect':
                this.rect = parseVec4(newValue, new Vec4(0, 0, 1, 1), name);
                break;
            case 'scissor-rect':
                this.scissorRect = parseVec4(newValue, new Vec4(0, 0, 1, 1), name);
                break;
            case 'tonemap':
                this.tonemap = parseEnum(newValue, tonemaps, 'none', name);
                break;
        }
    }
}
customElements.define('pc-camera', CameraComponentElement);

/**
 * The CollisionComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-collision/ | `<pc-collision>`} elements.
 * The CollisionComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * For `type="mesh"`, the collision geometry defaults to the host entity's own render component
 * (its render asset) — a collider matching the visible mesh, which is what a mesh collider on a
 * glTF node means. The default resolves each time the component applies, so a `pc-node` that
 * retargets or rebinds picks up the new node's geometry. An entity with no asset-backed render
 * component warns, and the collider has no shape.
 *
 * @category Components
 */
class CollisionComponentElement extends ComponentElement {
    _angularOffset = new Quat();
    _axis = 1;
    _convexHull = false;
    _halfExtents = new Vec3(0.5, 0.5, 0.5);
    _height = 2;
    _linearOffset = new Vec3();
    _radius = 0.5;
    _type = 'box';
    /** @ignore */
    constructor() {
        super('collision');
    }
    getInitialComponentData() {
        return {
            axis: this._axis,
            angularOffset: this._angularOffset,
            convexHull: this._convexHull,
            halfExtents: this._halfExtents,
            height: this._height,
            linearOffset: this._linearOffset,
            radius: this._radius,
            type: this._type
        };
    }
    initComponent() {
        this._applyMeshGeometryDefault();
    }
    /**
     * Defaults a mesh collider's geometry to the host entity's own render component. The
     * engine's mesh collider only works with explicitly supplied geometry, and the element has
     * no attribute to supply it - so the host's visible geometry, the meaning a mesh collider
     * on a glTF node carries, fills the gap. Runs on every application (so a rebound `pc-node`
     * recomputes it) and on a runtime switch to `type="mesh"`; an explicitly assigned
     * `renderAsset` is never overwritten.
     */
    _applyMeshGeometryDefault() {
        const component = this.component;
        if (!component || this._type !== 'mesh' || component.renderAsset !== null) {
            return;
        }
        const asset = component.entity.render?.asset ?? null;
        if (asset === null) {
            console.warn(`pc-collision type="mesh" on '${component.entity.name}' found no asset-backed render component to take geometry from - collider has no shape`);
            return;
        }
        component.renderAsset = asset;
    }
    /**
     * Gets the underlying PlayCanvas collision component.
     * @returns The collision component.
     */
    get component() {
        return super.component;
    }
    set angularOffset(value) {
        this._angularOffset = value;
        if (this.component) {
            this.component.angularOffset = value;
        }
    }
    get angularOffset() {
        return this._angularOffset;
    }
    set axis(value) {
        this._axis = value;
        if (this.component) {
            this.component.axis = value;
        }
    }
    get axis() {
        return this._axis;
    }
    set convexHull(value) {
        this._convexHull = value;
        if (this.component) {
            this.component.convexHull = value;
        }
    }
    get convexHull() {
        return this._convexHull;
    }
    set halfExtents(value) {
        this._halfExtents = value;
        if (this.component) {
            this.component.halfExtents = value;
        }
    }
    get halfExtents() {
        return this._halfExtents;
    }
    set height(value) {
        this._height = value;
        if (this.component) {
            this.component.height = value;
        }
    }
    get height() {
        return this._height;
    }
    set linearOffset(value) {
        this._linearOffset = value;
        if (this.component) {
            this.component.linearOffset = value;
        }
    }
    get linearOffset() {
        return this._linearOffset;
    }
    set radius(value) {
        this._radius = value;
        if (this.component) {
            this.component.radius = value;
        }
    }
    get radius() {
        return this._radius;
    }
    set type(value) {
        this._type = value;
        if (this.component) {
            this.component.type = value;
            this._applyMeshGeometryDefault();
        }
    }
    get type() {
        return this._type;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'angular-offset',
            'axis',
            'convex-hull',
            'half-extents',
            'height',
            'linear-offset',
            'radius',
            'type'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'angular-offset':
                this.angularOffset = parseQuat(newValue, Quat.IDENTITY, name);
                break;
            case 'axis':
                this.axis = parseNumber(newValue, 1, name);
                break;
            case 'convex-hull':
                this.convexHull = parseBool(newValue, false);
                break;
            case 'half-extents':
                this.halfExtents = parseVec3(newValue, new Vec3(0.5, 0.5, 0.5), name);
                break;
            case 'height':
                this.height = parseNumber(newValue, 2, name);
                break;
            case 'linear-offset':
                this.linearOffset = parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'radius':
                this.radius = parseNumber(newValue, 0.5, name);
                break;
            case 'type':
                this.type = parseEnum(newValue, ['box', 'capsule', 'compound', 'cone', 'cylinder', 'mesh', 'sphere'], 'box', name);
                break;
        }
    }
}
customElements.define('pc-collision', CollisionComponentElement);

/**
 * The ElementComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-element/ | `<pc-element>`} elements.
 * The ElementComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class ElementComponentElement extends ComponentElement {
    _anchor = new Vec4(0.5, 0.5, 0.5, 0.5);
    _autoWidth = true;
    _autoHeight = true;
    _autoFitWidth = false;
    _autoFitHeight = false;
    _color = new Color(1, 1, 1, 1);
    _enableMarkup = false;
    _fontAsset = '';
    _fontSize = 32;
    _maxFontSize = 32;
    _minFontSize = 8;
    _height = 0;
    _lineHeight = 32;
    _margin = null;
    _mask = false;
    _opacity = 1;
    _pivot = new Vec2(0.5, 0.5);
    _pixelsPerUnit = null;
    _spriteAsset = '';
    _spriteFrame = 0;
    _text = '';
    _textureAsset = '';
    _type = 'group';
    _useInput = false;
    _width = 0;
    _wrapLines = false;
    /** @ignore */
    constructor() {
        super('element');
    }
    initComponent() {
        const component = this.component;
        if (!component) {
            return;
        }
        // Text elements render through their own material; enable fog on it so 3D text respects
        // scene fog. Image/group elements have no text material, so guard the access.
        if (component._text?._material) {
            component._text._material.useFog = true;
        }
        // The engine establishes element masking in ElementComponent._onInsert, which fires when an
        // entity is inserted into the hierarchy. Web-components inserts the entity first and adds
        // the element component afterwards, so that pass is missed. Re-dirty the mask state here so
        // masks (e.g. a scroll view viewport) correctly clip this element and any added at runtime.
        component._dirtifyMask?.();
    }
    getInitialComponentData() {
        const data = {
            anchor: this._anchor,
            autoWidth: this._autoWidth,
            autoHeight: this._autoHeight,
            autoFitWidth: this._autoFitWidth,
            autoFitHeight: this._autoFitHeight,
            color: this._color,
            enableMarkup: this._enableMarkup,
            fontSize: this._fontSize,
            maxFontSize: this._maxFontSize,
            minFontSize: this._minFontSize,
            height: this._height,
            lineHeight: this._lineHeight,
            mask: this._mask,
            opacity: this._opacity,
            pivot: this._pivot,
            spriteFrame: this._spriteFrame,
            type: this._type,
            text: this._text,
            useInput: this._useInput,
            width: this._width,
            wrapLines: this._wrapLines
        };
        // Asset references are resolved from `<pc-asset>` element ids to engine asset ids. They are
        // only included when they resolve, so image/group elements (with no font) don't error.
        const fontAsset = useAsset(this._fontAsset);
        if (fontAsset) {
            data.fontAsset = fontAsset.id;
        }
        const spriteAsset = useAsset(this._spriteAsset);
        if (spriteAsset) {
            data.spriteAsset = spriteAsset.id;
        }
        const textureAsset = useAsset(this._textureAsset);
        if (textureAsset) {
            data.textureAsset = textureAsset.id;
        }
        // Margin is only applied when explicitly set. For stretched (split) anchors it governs the
        // element size; for point anchors width/height take over (handled by the engine).
        if (this._margin) {
            data.margin = this._margin;
        }
        if (this._pixelsPerUnit !== null) {
            data.pixelsPerUnit = this._pixelsPerUnit;
        }
        return data;
    }
    /**
     * Gets the underlying PlayCanvas element component.
     * @returns The element component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets the anchor of the element component.
     * @param value - The anchor.
     */
    set anchor(value) {
        this._anchor = value;
        if (this.component) {
            this.component.anchor = value;
        }
    }
    /**
     * Gets the anchor of the element component.
     * @returns The anchor.
     */
    get anchor() {
        return this._anchor;
    }
    /**
     * Sets whether the element component should automatically adjust its width to the text content
     * (text elements only).
     * @param value - Whether to automatically adjust the width.
     */
    set autoWidth(value) {
        this._autoWidth = value;
        if (this.component) {
            this.component.autoWidth = value;
        }
    }
    /**
     * Gets whether the element component should automatically adjust its width.
     * @returns Whether to automatically adjust the width.
     */
    get autoWidth() {
        return this._autoWidth;
    }
    /**
     * Sets whether the element component should automatically adjust its height to the text content
     * (text elements only).
     * @param value - Whether to automatically adjust the height.
     */
    set autoHeight(value) {
        this._autoHeight = value;
        if (this.component) {
            this.component.autoHeight = value;
        }
    }
    /**
     * Gets whether the element component should automatically adjust its height.
     * @returns Whether to automatically adjust the height.
     */
    get autoHeight() {
        return this._autoHeight;
    }
    /**
     * Sets the color of the element component.
     * @param value - The color.
     */
    set color(value) {
        this._color = value;
        if (this.component) {
            this.component.color = value;
        }
    }
    /**
     * Gets the color of the element component.
     * @returns The color.
     */
    get color() {
        return this._color;
    }
    /**
     * Sets whether the element component should use markup.
     * @param value - Whether to enable markup.
     */
    set enableMarkup(value) {
        this._enableMarkup = value;
        if (this.component) {
            this.component.enableMarkup = value;
        }
    }
    /**
     * Gets whether the element component should use markup.
     * @returns Whether markup is enabled.
     */
    get enableMarkup() {
        return this._enableMarkup;
    }
    /**
     * Sets the id of the `pc-asset` to use for the font (text elements).
     * @param value - The font asset ID.
     */
    set fontAsset(value) {
        this._fontAsset = value;
        const asset = useAsset(value);
        if (this.component && asset) {
            this.component.fontAsset = asset.id;
        }
    }
    /**
     * Gets the id of the `pc-asset` to use for the font.
     * @returns The font asset ID.
     */
    get fontAsset() {
        return this._fontAsset;
    }
    /**
     * Sets the font size of the element component.
     * @param value - The font size.
     */
    set fontSize(value) {
        this._fontSize = value;
        if (this.component) {
            this.component.fontSize = value;
        }
    }
    /**
     * Gets the font size of the element component.
     * @returns The font size.
     */
    get fontSize() {
        return this._fontSize;
    }
    /**
     * Sets the height of the element component.
     * @param value - The height.
     */
    set height(value) {
        this._height = value;
        if (this.component) {
            this.component.height = value;
        }
    }
    /**
     * Gets the height of the element component.
     * @returns The height.
     */
    get height() {
        return this._height;
    }
    /**
     * Sets the line height of the element component.
     * @param value - The line height.
     */
    set lineHeight(value) {
        this._lineHeight = value;
        if (this.component) {
            this.component.lineHeight = value;
        }
    }
    /**
     * Gets the line height of the element component.
     * @returns The line height.
     */
    get lineHeight() {
        return this._lineHeight;
    }
    /**
     * Sets the margin of the element component (used to inset the element from stretched anchors).
     * @param value - The margin as a Vec4 (left, bottom, right, top).
     */
    set margin(value) {
        this._margin = value;
        if (this.component && value) {
            this.component.margin = value;
        }
    }
    /**
     * Gets the margin of the element component.
     * @returns The margin.
     */
    get margin() {
        return this._margin;
    }
    /**
     * Sets whether the element component is a mask, clipping its descendants to its bounds (image
     * elements only).
     * @param value - Whether the element is a mask.
     */
    set mask(value) {
        this._mask = value;
        if (this.component) {
            this.component.mask = value;
        }
    }
    /**
     * Gets whether the element component is a mask.
     * @returns Whether the element is a mask.
     */
    get mask() {
        return this._mask;
    }
    /**
     * Sets the opacity of the element component.
     * @param value - The opacity (0 to 1).
     */
    set opacity(value) {
        this._opacity = value;
        if (this.component) {
            this.component.opacity = value;
        }
    }
    /**
     * Gets the opacity of the element component.
     * @returns The opacity.
     */
    get opacity() {
        return this._opacity;
    }
    /**
     * Sets the pivot of the element component.
     * @param value - The pivot.
     */
    set pivot(value) {
        this._pivot = value;
        if (this.component) {
            this.component.pivot = value;
        }
    }
    /**
     * Gets the pivot of the element component.
     * @returns The pivot.
     */
    get pivot() {
        return this._pivot;
    }
    /**
     * Sets the number of pixels per unit to use when rendering a sprite (image elements only).
     * @param value - The pixels per unit.
     */
    set pixelsPerUnit(value) {
        this._pixelsPerUnit = value;
        if (this.component && value !== null) {
            this.component.pixelsPerUnit = value;
        }
    }
    /**
     * Gets the number of pixels per unit used when rendering a sprite.
     * @returns The pixels per unit.
     */
    get pixelsPerUnit() {
        return this._pixelsPerUnit;
    }
    /**
     * Sets the id of the `pc-asset` to use for the sprite (image elements only).
     * @param value - The sprite asset ID.
     */
    set spriteAsset(value) {
        this._spriteAsset = value;
        const asset = useAsset(value);
        if (this.component && asset) {
            this.component.spriteAsset = asset.id;
        }
    }
    /**
     * Gets the id of the `pc-asset` to use for the sprite.
     * @returns The sprite asset ID.
     */
    get spriteAsset() {
        return this._spriteAsset;
    }
    /**
     * Sets the frame of the sprite to render (image elements only).
     * @param value - The sprite frame index.
     */
    set spriteFrame(value) {
        this._spriteFrame = value;
        if (this.component) {
            this.component.spriteFrame = value;
        }
    }
    /**
     * Gets the frame of the sprite to render.
     * @returns The sprite frame index.
     */
    get spriteFrame() {
        return this._spriteFrame;
    }
    /**
     * Sets the text of the element component.
     * @param value - The text.
     */
    set text(value) {
        this._text = value;
        if (this.component) {
            this.component.text = value;
        }
    }
    /**
     * Gets the text of the element component.
     * @returns The text.
     */
    get text() {
        return this._text;
    }
    /**
     * Sets the id of the `pc-asset` to use for the texture (image elements only).
     * @param value - The texture asset ID.
     */
    set textureAsset(value) {
        this._textureAsset = value;
        const asset = useAsset(value);
        if (this.component && asset) {
            this.component.textureAsset = asset.id;
        }
    }
    /**
     * Gets the id of the `pc-asset` to use for the texture.
     * @returns The texture asset ID.
     */
    get textureAsset() {
        return this._textureAsset;
    }
    /**
     * Sets the type of the element component.
     * @param value - The type.
     */
    set type(value) {
        this._type = value;
        if (this.component) {
            this.component.type = value;
        }
    }
    /**
     * Gets the type of the element component.
     * @returns The type.
     */
    get type() {
        return this._type;
    }
    /**
     * Sets whether the element component accepts input events (required for buttons and scrolling).
     * @param value - Whether the element accepts input.
     */
    set useInput(value) {
        this._useInput = value;
        if (this.component) {
            this.component.useInput = value;
        }
    }
    /**
     * Gets whether the element component accepts input events.
     * @returns Whether the element accepts input.
     */
    get useInput() {
        return this._useInput;
    }
    /**
     * Sets the width of the element component.
     * @param value - The width.
     */
    set width(value) {
        this._width = value;
        if (this.component) {
            this.component.width = value;
        }
    }
    /**
     * Gets the width of the element component.
     * @returns The width.
     */
    get width() {
        return this._width;
    }
    /**
     * Sets whether the element component should wrap lines.
     * @param value - Whether to wrap lines.
     */
    set wrapLines(value) {
        this._wrapLines = value;
        if (this.component) {
            this.component.wrapLines = value;
        }
    }
    /**
     * Gets whether the element component should wrap lines.
     * @returns Whether to wrap lines.
     */
    get wrapLines() {
        return this._wrapLines;
    }
    /**
     * Sets whether a text element should automatically reduce its font size (down to `min-font-size`)
     * so the text fits within the element's width. Requires `auto-width` to be `false`.
     * @param value - Whether to auto-fit the width.
     */
    set autoFitWidth(value) {
        this._autoFitWidth = value;
        if (this.component) {
            this.component.autoFitWidth = value;
        }
    }
    /**
     * Gets whether a text element automatically reduces its font size to fit its width.
     * @returns Whether the width is auto-fit.
     */
    get autoFitWidth() {
        return this._autoFitWidth;
    }
    /**
     * Sets whether a text element should automatically reduce its font size (down to `min-font-size`)
     * so the text fits within the element's height. Requires `auto-height` to be `false`.
     * @param value - Whether to auto-fit the height.
     */
    set autoFitHeight(value) {
        this._autoFitHeight = value;
        if (this.component) {
            this.component.autoFitHeight = value;
        }
    }
    /**
     * Gets whether a text element automatically reduces its font size to fit its height.
     * @returns Whether the height is auto-fit.
     */
    get autoFitHeight() {
        return this._autoFitHeight;
    }
    /**
     * Sets the smallest font size a text element may use when auto-fitting.
     * @param value - The minimum font size.
     */
    set minFontSize(value) {
        this._minFontSize = value;
        if (this.component) {
            this.component.minFontSize = value;
        }
    }
    /**
     * Gets the smallest font size a text element may use when auto-fitting.
     * @returns The minimum font size.
     */
    get minFontSize() {
        return this._minFontSize;
    }
    /**
     * Sets the largest font size a text element may use when auto-fitting.
     * @param value - The maximum font size.
     */
    set maxFontSize(value) {
        this._maxFontSize = value;
        if (this.component) {
            this.component.maxFontSize = value;
        }
    }
    /**
     * Gets the largest font size a text element may use when auto-fitting.
     * @returns The maximum font size.
     */
    get maxFontSize() {
        return this._maxFontSize;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'anchor',
            'auto-width',
            'auto-height',
            'auto-fit-width',
            'auto-fit-height',
            'color',
            'enable-markup',
            'font-asset',
            'font-size',
            'max-font-size',
            'min-font-size',
            'height',
            'line-height',
            'margin',
            'mask',
            'opacity',
            'pivot',
            'pixels-per-unit',
            'sprite-asset',
            'sprite-frame',
            'text',
            'texture-asset',
            'type',
            'use-input',
            'width',
            'wrap-lines'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'anchor':
                this.anchor = parseVec4(newValue, new Vec4(0.5, 0.5, 0.5, 0.5), name);
                break;
            case 'auto-width':
                this.autoWidth = parseBool(newValue, true);
                break;
            case 'auto-height':
                this.autoHeight = parseBool(newValue, true);
                break;
            case 'auto-fit-width':
                this.autoFitWidth = parseBool(newValue, false);
                break;
            case 'auto-fit-height':
                this.autoFitHeight = parseBool(newValue, false);
                break;
            case 'color':
                this.color = parseColor(newValue, Color.WHITE, name);
                break;
            case 'enable-markup':
                this.enableMarkup = parseBool(newValue, false);
                break;
            case 'font-asset':
                this.fontAsset = newValue ?? '';
                break;
            case 'font-size':
                this.fontSize = parseNumber(newValue, 32, name);
                break;
            case 'max-font-size':
                this.maxFontSize = parseNumber(newValue, 32, name);
                break;
            case 'min-font-size':
                this.minFontSize = parseNumber(newValue, 8, name);
                break;
            case 'height':
                this.height = parseNumber(newValue, 0, name);
                break;
            case 'line-height':
                this.lineHeight = parseNumber(newValue, 32, name);
                break;
            case 'margin':
                this.margin = parseVec4(newValue, null, name);
                break;
            case 'mask':
                this.mask = parseBool(newValue, false);
                break;
            case 'opacity':
                this.opacity = parseNumber(newValue, 1, name);
                break;
            case 'pivot':
                this.pivot = parseVec2(newValue, new Vec2(0.5, 0.5), name);
                break;
            case 'pixels-per-unit':
                this.pixelsPerUnit = parseNumber(newValue, null, name);
                break;
            case 'sprite-asset':
                this.spriteAsset = newValue ?? '';
                break;
            case 'sprite-frame':
                this.spriteFrame = parseNumber(newValue, 0, name);
                break;
            case 'text':
                this.text = newValue ?? '';
                break;
            case 'texture-asset':
                this.textureAsset = newValue ?? '';
                break;
            case 'type':
                this.type = parseEnum(newValue, ['group', 'image', 'text'], 'group', name);
                break;
            case 'use-input':
                this.useInput = parseBool(newValue, false);
                break;
            case 'width':
                this.width = parseNumber(newValue, 0, name);
                break;
            case 'wrap-lines':
                this.wrapLines = parseBool(newValue, false);
                break;
        }
    }
}
customElements.define('pc-element', ElementComponentElement);

/**
 * The JointComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-joint/ | `<pc-joint>`} elements.
 * The JointComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * The entity holding the joint is not itself constrained. Its world transform defines the joint
 * frame — the anchor point and axes the constraint operates about — with the local X axis as the
 * primary axis: a hinge rotates about it, a slider translates along it and a ball joint twists
 * about it. The constrained bodies are referenced by `entity-a` and `entity-b`, both of which need
 * a rigid body component; leaving `entity-b` empty constrains `entity-a` to a fixed point in world
 * space. The underlying engine component is in alpha, so its API may change.
 *
 * @fires {CustomEvent} break - Fired when the impulse on the joint exceeds `break-impulse` and the
 * constraint breaks. A broken joint no longer constrains its bodies; calling `refreshFrames()` on
 * the underlying component re-attaches it. Bubbles and is composed.
 *
 * @category Components
 */
class JointComponentElement extends ComponentElement {
    /**
     * The spring damping of the joint per angular axis.
     */
    _angularDamping = new Vec3(1, 1, 1);
    /**
     * The rest angle of the joint's angular springs.
     */
    _angularEquilibrium = new Vec3();
    /**
     * The rotation limits of the joint about its X axis.
     */
    _angularLimitsX = new Vec2();
    /**
     * The rotation limits of the joint about its Y axis.
     */
    _angularLimitsY = new Vec2();
    /**
     * The rotation limits of the joint about its Z axis.
     */
    _angularLimitsZ = new Vec2();
    /**
     * The rotational degree of freedom of the joint about its X axis.
     */
    _angularMotionX = 'locked';
    /**
     * The rotational degree of freedom of the joint about its Y axis.
     */
    _angularMotionY = 'locked';
    /**
     * The rotational degree of freedom of the joint about its Z axis.
     */
    _angularMotionZ = 'locked';
    /**
     * The spring stiffness of the joint per angular axis.
     */
    _angularStiffness = new Vec3();
    /**
     * The impulse above which the joint breaks.
     */
    _breakImpulse = Infinity;
    /**
     * Whether collision is enabled between the constrained bodies.
     */
    _enableCollision = false;
    /**
     * Whether the joint's limits are enforced.
     */
    _enableLimits = false;
    /**
     * The reference to the entity providing the first constrained body.
     */
    _entityA = '';
    /**
     * The reference to the entity providing the second constrained body.
     */
    _entityB = '';
    /**
     * The rotation or travel limits of the joint.
     */
    _limits = new Vec2(-45, 45);
    /**
     * The spring damping of the joint per linear axis.
     */
    _linearDamping = new Vec3(1, 1, 1);
    /**
     * The rest point of the joint's linear springs.
     */
    _linearEquilibrium = new Vec3();
    /**
     * The translation limits of the joint along its X axis.
     */
    _linearLimitsX = new Vec2();
    /**
     * The translation limits of the joint along its Y axis.
     */
    _linearLimitsY = new Vec2();
    /**
     * The translation limits of the joint along its Z axis.
     */
    _linearLimitsZ = new Vec2();
    /**
     * The linear degree of freedom of the joint along its X axis.
     */
    _linearMotionX = 'locked';
    /**
     * The linear degree of freedom of the joint along its Y axis.
     */
    _linearMotionY = 'locked';
    /**
     * The linear degree of freedom of the joint along its Z axis.
     */
    _linearMotionZ = 'locked';
    /**
     * The spring stiffness of the joint per linear axis.
     */
    _linearStiffness = new Vec3();
    /**
     * The maximum torque or force of the joint's motor.
     */
    _maxMotorForce = 0;
    /**
     * The target speed of the joint's motor.
     */
    _motorSpeed = 0;
    /**
     * The maximum swing of the joint around the joint frame's Y axis.
     */
    _swingLimitY = 45;
    /**
     * The maximum swing of the joint around the joint frame's Z axis.
     */
    _swingLimitZ = 45;
    /**
     * The maximum twist of the joint about its primary axis.
     */
    _twistLimit = 20;
    /**
     * The type of the joint.
     */
    _type = 'fixed';
    /** @ignore */
    constructor() {
        super('joint');
    }
    getInitialComponentData() {
        return {
            angularDamping: this._angularDamping,
            angularEquilibrium: this._angularEquilibrium,
            angularLimitsX: this._angularLimitsX,
            angularLimitsY: this._angularLimitsY,
            angularLimitsZ: this._angularLimitsZ,
            angularMotionX: this._angularMotionX,
            angularMotionY: this._angularMotionY,
            angularMotionZ: this._angularMotionZ,
            angularStiffness: this._angularStiffness,
            breakImpulse: this._breakImpulse,
            enableCollision: this._enableCollision,
            enableLimits: this._enableLimits,
            entityA: getEntity(this._entityA),
            entityB: getEntity(this._entityB),
            limits: this._limits,
            linearDamping: this._linearDamping,
            linearEquilibrium: this._linearEquilibrium,
            linearLimitsX: this._linearLimitsX,
            linearLimitsY: this._linearLimitsY,
            linearLimitsZ: this._linearLimitsZ,
            linearMotionX: this._linearMotionX,
            linearMotionY: this._linearMotionY,
            linearMotionZ: this._linearMotionZ,
            linearStiffness: this._linearStiffness,
            maxMotorForce: this._maxMotorForce,
            motorSpeed: this._motorSpeed,
            swingLimitY: this._swingLimitY,
            swingLimitZ: this._swingLimitZ,
            twistLimit: this._twistLimit,
            type: this._type
        };
    }
    _onBreak() {
        this.dispatchEvent(new CustomEvent('break', { bubbles: true, composed: true }));
    }
    initComponent() {
        const component = this.component;
        if (!component) {
            return;
        }
        // A host readiness cycle can re-run this against the same surviving component instance,
        // so the off/on pair keeps the subscription single either way. Component removal destroys
        // the instance and its listeners with it, so there is no disconnect-side teardown.
        component.off('break', this._onBreak, this);
        component.on('break', this._onBreak, this);
    }
    /**
     * Gets the underlying PlayCanvas joint component.
     * @returns The joint component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets the spring damping of a 6dof joint per angular axis, used on axes with a non-zero
     * angular-stiffness.
     * @param value - The angular spring damping.
     */
    set angularDamping(value) {
        this._angularDamping = value;
        if (this.component) {
            this.component.angularDamping = value;
        }
    }
    /**
     * Gets the spring damping of the joint per angular axis.
     * @returns The angular spring damping.
     */
    get angularDamping() {
        return this._angularDamping;
    }
    /**
     * Sets the rest angle of a 6dof joint's angular springs in degrees per axis, used on axes with
     * a non-zero angular-stiffness.
     * @param value - The angular spring rest angles.
     */
    set angularEquilibrium(value) {
        this._angularEquilibrium = value;
        if (this.component) {
            this.component.angularEquilibrium = value;
        }
    }
    /**
     * Gets the rest angle of the joint's angular springs.
     * @returns The angular spring rest angles.
     */
    get angularEquilibrium() {
        return this._angularEquilibrium;
    }
    /**
     * Sets the lower and upper rotation limit of a 6dof joint about its X axis in degrees, used
     * when angular-motion-x is limited.
     * @param value - The X axis rotation limits.
     */
    set angularLimitsX(value) {
        this._angularLimitsX = value;
        if (this.component) {
            this.component.angularLimitsX = value;
        }
    }
    /**
     * Gets the rotation limits of the joint about its X axis.
     * @returns The X axis rotation limits.
     */
    get angularLimitsX() {
        return this._angularLimitsX;
    }
    /**
     * Sets the lower and upper rotation limit of a 6dof joint about its Y axis in degrees, used
     * when angular-motion-y is limited.
     * @param value - The Y axis rotation limits.
     */
    set angularLimitsY(value) {
        this._angularLimitsY = value;
        if (this.component) {
            this.component.angularLimitsY = value;
        }
    }
    /**
     * Gets the rotation limits of the joint about its Y axis.
     * @returns The Y axis rotation limits.
     */
    get angularLimitsY() {
        return this._angularLimitsY;
    }
    /**
     * Sets the lower and upper rotation limit of a 6dof joint about its Z axis in degrees, used
     * when angular-motion-z is limited.
     * @param value - The Z axis rotation limits.
     */
    set angularLimitsZ(value) {
        this._angularLimitsZ = value;
        if (this.component) {
            this.component.angularLimitsZ = value;
        }
    }
    /**
     * Gets the rotation limits of the joint about its Z axis.
     * @returns The Z axis rotation limits.
     */
    get angularLimitsZ() {
        return this._angularLimitsZ;
    }
    /**
     * Sets how a 6dof joint constrains rotation about its X axis. Can be `locked`, `limited` or
     * `free`. Defaults to `locked`.
     * @param value - The X axis rotational degree of freedom.
     */
    set angularMotionX(value) {
        this._angularMotionX = value;
        if (this.component) {
            this.component.angularMotionX = value;
        }
    }
    /**
     * Gets how the joint constrains rotation about its X axis.
     * @returns The X axis rotational degree of freedom.
     */
    get angularMotionX() {
        return this._angularMotionX;
    }
    /**
     * Sets how a 6dof joint constrains rotation about its Y axis. Can be `locked`, `limited` or
     * `free`. Defaults to `locked`.
     * @param value - The Y axis rotational degree of freedom.
     */
    set angularMotionY(value) {
        this._angularMotionY = value;
        if (this.component) {
            this.component.angularMotionY = value;
        }
    }
    /**
     * Gets how the joint constrains rotation about its Y axis.
     * @returns The Y axis rotational degree of freedom.
     */
    get angularMotionY() {
        return this._angularMotionY;
    }
    /**
     * Sets how a 6dof joint constrains rotation about its Z axis. Can be `locked`, `limited` or
     * `free`. Defaults to `locked`.
     * @param value - The Z axis rotational degree of freedom.
     */
    set angularMotionZ(value) {
        this._angularMotionZ = value;
        if (this.component) {
            this.component.angularMotionZ = value;
        }
    }
    /**
     * Gets how the joint constrains rotation about its Z axis.
     * @returns The Z axis rotational degree of freedom.
     */
    get angularMotionZ() {
        return this._angularMotionZ;
    }
    /**
     * Sets the spring stiffness of a 6dof joint per angular axis, where 0 disables the spring on
     * that axis.
     * @param value - The angular spring stiffness.
     */
    set angularStiffness(value) {
        this._angularStiffness = value;
        if (this.component) {
            this.component.angularStiffness = value;
        }
    }
    /**
     * Gets the spring stiffness of the joint per angular axis.
     * @returns The angular spring stiffness.
     */
    get angularStiffness() {
        return this._angularStiffness;
    }
    /**
     * Sets the impulse in newton seconds above which the joint breaks. Defaults to `Infinity`,
     * which makes the joint unbreakable.
     * @param value - The break impulse.
     */
    set breakImpulse(value) {
        this._breakImpulse = value;
        if (this.component) {
            this.component.breakImpulse = value;
        }
    }
    /**
     * Gets the impulse above which the joint breaks.
     * @returns The break impulse.
     */
    get breakImpulse() {
        return this._breakImpulse;
    }
    /**
     * Sets whether collision is enabled between the two constrained bodies.
     * @param value - Whether collision is enabled.
     */
    set enableCollision(value) {
        this._enableCollision = value;
        if (this.component) {
            this.component.enableCollision = value;
        }
    }
    /**
     * Gets whether collision is enabled between the two constrained bodies.
     * @returns Whether collision is enabled.
     */
    get enableCollision() {
        return this._enableCollision;
    }
    /**
     * Sets whether the limits of a hinge, slider or ball joint are enforced.
     * @param value - Whether the limits are enforced.
     */
    set enableLimits(value) {
        this._enableLimits = value;
        if (this.component) {
            this.component.enableLimits = value;
        }
    }
    /**
     * Gets whether the limits of the joint are enforced.
     * @returns Whether the limits are enforced.
     */
    get enableLimits() {
        return this._enableLimits;
    }
    /**
     * Sets the reference (CSS selector, element id or entity name) to the `<pc-entity>` providing
     * the first constrained body. The reference resolves when it is set, so an entity created
     * later is picked up by setting the attribute again.
     * @param value - The first body's entity reference.
     */
    set entityA(value) {
        this._entityA = value;
        if (this.component) {
            this.component.entityA = getEntity(value);
        }
    }
    /**
     * Gets the reference to the `<pc-entity>` providing the first constrained body.
     * @returns The first body's entity reference.
     */
    get entityA() {
        return this._entityA;
    }
    /**
     * Sets the reference (CSS selector, element id or entity name) to the `<pc-entity>` providing
     * the second constrained body, or empty to constrain the first body to a fixed point in world
     * space. The reference resolves when it is set, so an entity created later is picked up by
     * setting the attribute again.
     * @param value - The second body's entity reference.
     */
    set entityB(value) {
        this._entityB = value;
        if (this.component) {
            this.component.entityB = getEntity(value);
        }
    }
    /**
     * Gets the reference to the `<pc-entity>` providing the second constrained body.
     * @returns The second body's entity reference.
     */
    get entityB() {
        return this._entityB;
    }
    /**
     * Sets the lower and upper limit of a hinge joint's rotation in degrees, or a slider joint's
     * travel in meters, applied when enable-limits is set.
     * @param value - The rotation or travel limits.
     */
    set limits(value) {
        this._limits = value;
        if (this.component) {
            this.component.limits = value;
        }
    }
    /**
     * Gets the rotation or travel limits of the joint.
     * @returns The rotation or travel limits.
     */
    get limits() {
        return this._limits;
    }
    /**
     * Sets the spring damping of a 6dof joint per linear axis, used on axes with a non-zero
     * linear-stiffness.
     * @param value - The linear spring damping.
     */
    set linearDamping(value) {
        this._linearDamping = value;
        if (this.component) {
            this.component.linearDamping = value;
        }
    }
    /**
     * Gets the spring damping of the joint per linear axis.
     * @returns The linear spring damping.
     */
    get linearDamping() {
        return this._linearDamping;
    }
    /**
     * Sets the rest point of a 6dof joint's linear springs in meters per axis, used on axes with a
     * non-zero linear-stiffness.
     * @param value - The linear spring rest points.
     */
    set linearEquilibrium(value) {
        this._linearEquilibrium = value;
        if (this.component) {
            this.component.linearEquilibrium = value;
        }
    }
    /**
     * Gets the rest point of the joint's linear springs.
     * @returns The linear spring rest points.
     */
    get linearEquilibrium() {
        return this._linearEquilibrium;
    }
    /**
     * Sets the lower and upper translation limit of a 6dof joint along its X axis in meters, used
     * when linear-motion-x is limited.
     * @param value - The X axis translation limits.
     */
    set linearLimitsX(value) {
        this._linearLimitsX = value;
        if (this.component) {
            this.component.linearLimitsX = value;
        }
    }
    /**
     * Gets the translation limits of the joint along its X axis.
     * @returns The X axis translation limits.
     */
    get linearLimitsX() {
        return this._linearLimitsX;
    }
    /**
     * Sets the lower and upper translation limit of a 6dof joint along its Y axis in meters, used
     * when linear-motion-y is limited.
     * @param value - The Y axis translation limits.
     */
    set linearLimitsY(value) {
        this._linearLimitsY = value;
        if (this.component) {
            this.component.linearLimitsY = value;
        }
    }
    /**
     * Gets the translation limits of the joint along its Y axis.
     * @returns The Y axis translation limits.
     */
    get linearLimitsY() {
        return this._linearLimitsY;
    }
    /**
     * Sets the lower and upper translation limit of a 6dof joint along its Z axis in meters, used
     * when linear-motion-z is limited.
     * @param value - The Z axis translation limits.
     */
    set linearLimitsZ(value) {
        this._linearLimitsZ = value;
        if (this.component) {
            this.component.linearLimitsZ = value;
        }
    }
    /**
     * Gets the translation limits of the joint along its Z axis.
     * @returns The Z axis translation limits.
     */
    get linearLimitsZ() {
        return this._linearLimitsZ;
    }
    /**
     * Sets how a 6dof joint constrains translation along its X axis. Can be `locked`, `limited` or
     * `free`. Defaults to `locked`.
     * @param value - The X axis linear degree of freedom.
     */
    set linearMotionX(value) {
        this._linearMotionX = value;
        if (this.component) {
            this.component.linearMotionX = value;
        }
    }
    /**
     * Gets how the joint constrains translation along its X axis.
     * @returns The X axis linear degree of freedom.
     */
    get linearMotionX() {
        return this._linearMotionX;
    }
    /**
     * Sets how a 6dof joint constrains translation along its Y axis. Can be `locked`, `limited` or
     * `free`. Defaults to `locked`.
     * @param value - The Y axis linear degree of freedom.
     */
    set linearMotionY(value) {
        this._linearMotionY = value;
        if (this.component) {
            this.component.linearMotionY = value;
        }
    }
    /**
     * Gets how the joint constrains translation along its Y axis.
     * @returns The Y axis linear degree of freedom.
     */
    get linearMotionY() {
        return this._linearMotionY;
    }
    /**
     * Sets how a 6dof joint constrains translation along its Z axis. Can be `locked`, `limited` or
     * `free`. Defaults to `locked`.
     * @param value - The Z axis linear degree of freedom.
     */
    set linearMotionZ(value) {
        this._linearMotionZ = value;
        if (this.component) {
            this.component.linearMotionZ = value;
        }
    }
    /**
     * Gets how the joint constrains translation along its Z axis.
     * @returns The Z axis linear degree of freedom.
     */
    get linearMotionZ() {
        return this._linearMotionZ;
    }
    /**
     * Sets the spring stiffness of a 6dof joint per linear axis, where 0 disables the spring on
     * that axis.
     * @param value - The linear spring stiffness.
     */
    set linearStiffness(value) {
        this._linearStiffness = value;
        if (this.component) {
            this.component.linearStiffness = value;
        }
    }
    /**
     * Gets the spring stiffness of the joint per linear axis.
     * @returns The linear spring stiffness.
     */
    get linearStiffness() {
        return this._linearStiffness;
    }
    /**
     * Sets the maximum torque in newton meters of a hinge joint's motor, or the maximum force in
     * newtons of a slider joint's motor, where 0 disables the motor.
     * @param value - The maximum motor torque or force.
     */
    set maxMotorForce(value) {
        this._maxMotorForce = value;
        if (this.component) {
            this.component.maxMotorForce = value;
        }
    }
    /**
     * Gets the maximum torque or force of the joint's motor.
     * @returns The maximum motor torque or force.
     */
    get maxMotorForce() {
        return this._maxMotorForce;
    }
    /**
     * Sets the target speed of a hinge joint's motor in degrees per second, or a slider joint's
     * motor in meters per second, active while max-motor-force is greater than 0.
     * @param value - The motor's target speed.
     */
    set motorSpeed(value) {
        this._motorSpeed = value;
        if (this.component) {
            this.component.motorSpeed = value;
        }
    }
    /**
     * Gets the target speed of the joint's motor.
     * @returns The motor's target speed.
     */
    get motorSpeed() {
        return this._motorSpeed;
    }
    /**
     * Sets the maximum swing of a ball joint around the joint frame's Y axis in degrees, applied
     * when enable-limits is set.
     * @param value - The Y axis swing limit.
     */
    set swingLimitY(value) {
        this._swingLimitY = value;
        if (this.component) {
            this.component.swingLimitY = value;
        }
    }
    /**
     * Gets the maximum swing of the joint around the joint frame's Y axis.
     * @returns The Y axis swing limit.
     */
    get swingLimitY() {
        return this._swingLimitY;
    }
    /**
     * Sets the maximum swing of a ball joint around the joint frame's Z axis in degrees, applied
     * when enable-limits is set.
     * @param value - The Z axis swing limit.
     */
    set swingLimitZ(value) {
        this._swingLimitZ = value;
        if (this.component) {
            this.component.swingLimitZ = value;
        }
    }
    /**
     * Gets the maximum swing of the joint around the joint frame's Z axis.
     * @returns The Z axis swing limit.
     */
    get swingLimitZ() {
        return this._swingLimitZ;
    }
    /**
     * Sets the maximum twist of a ball joint about its primary axis in degrees, applied when
     * enable-limits is set.
     * @param value - The twist limit.
     */
    set twistLimit(value) {
        this._twistLimit = value;
        if (this.component) {
            this.component.twistLimit = value;
        }
    }
    /**
     * Gets the maximum twist of the joint about its primary axis.
     * @returns The twist limit.
     */
    get twistLimit() {
        return this._twistLimit;
    }
    /**
     * Sets the type of the joint. Can be `fixed`, `ball`, `hinge`, `slider` or `6dof`. Defaults to
     * `fixed`.
     * @param value - The joint type.
     */
    set type(value) {
        this._type = value;
        if (this.component) {
            this.component.type = value;
        }
    }
    /**
     * Gets the type of the joint.
     * @returns The joint type.
     */
    get type() {
        return this._type;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'angular-damping',
            'angular-equilibrium',
            'angular-limits-x',
            'angular-limits-y',
            'angular-limits-z',
            'angular-motion-x',
            'angular-motion-y',
            'angular-motion-z',
            'angular-stiffness',
            'break-impulse',
            'enable-collision',
            'enable-limits',
            'entity-a',
            'entity-b',
            'limits',
            'linear-damping',
            'linear-equilibrium',
            'linear-limits-x',
            'linear-limits-y',
            'linear-limits-z',
            'linear-motion-x',
            'linear-motion-y',
            'linear-motion-z',
            'linear-stiffness',
            'max-motor-force',
            'motor-speed',
            'swing-limit-y',
            'swing-limit-z',
            'twist-limit',
            'type'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'angular-damping':
                this.angularDamping = parseVec3(newValue, Vec3.ONE, name);
                break;
            case 'angular-equilibrium':
                this.angularEquilibrium = parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'angular-limits-x':
                this.angularLimitsX = parseVec2(newValue, Vec2.ZERO, name);
                break;
            case 'angular-limits-y':
                this.angularLimitsY = parseVec2(newValue, Vec2.ZERO, name);
                break;
            case 'angular-limits-z':
                this.angularLimitsZ = parseVec2(newValue, Vec2.ZERO, name);
                break;
            case 'angular-motion-x':
                this.angularMotionX = parseEnum(newValue, ['locked', 'limited', 'free'], 'locked', name);
                break;
            case 'angular-motion-y':
                this.angularMotionY = parseEnum(newValue, ['locked', 'limited', 'free'], 'locked', name);
                break;
            case 'angular-motion-z':
                this.angularMotionZ = parseEnum(newValue, ['locked', 'limited', 'free'], 'locked', name);
                break;
            case 'angular-stiffness':
                this.angularStiffness = parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'break-impulse':
                this.breakImpulse = parseNumber(newValue, Infinity, name);
                break;
            case 'enable-collision':
                this.enableCollision = parseBool(newValue, false);
                break;
            case 'enable-limits':
                this.enableLimits = parseBool(newValue, false);
                break;
            case 'entity-a':
                this.entityA = newValue ?? '';
                break;
            case 'entity-b':
                this.entityB = newValue ?? '';
                break;
            case 'limits':
                this.limits = parseVec2(newValue, new Vec2(-45, 45), name);
                break;
            case 'linear-damping':
                this.linearDamping = parseVec3(newValue, Vec3.ONE, name);
                break;
            case 'linear-equilibrium':
                this.linearEquilibrium = parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'linear-limits-x':
                this.linearLimitsX = parseVec2(newValue, Vec2.ZERO, name);
                break;
            case 'linear-limits-y':
                this.linearLimitsY = parseVec2(newValue, Vec2.ZERO, name);
                break;
            case 'linear-limits-z':
                this.linearLimitsZ = parseVec2(newValue, Vec2.ZERO, name);
                break;
            case 'linear-motion-x':
                this.linearMotionX = parseEnum(newValue, ['locked', 'limited', 'free'], 'locked', name);
                break;
            case 'linear-motion-y':
                this.linearMotionY = parseEnum(newValue, ['locked', 'limited', 'free'], 'locked', name);
                break;
            case 'linear-motion-z':
                this.linearMotionZ = parseEnum(newValue, ['locked', 'limited', 'free'], 'locked', name);
                break;
            case 'linear-stiffness':
                this.linearStiffness = parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'max-motor-force':
                this.maxMotorForce = parseNumber(newValue, 0, name);
                break;
            case 'motor-speed':
                this.motorSpeed = parseNumber(newValue, 0, name);
                break;
            case 'swing-limit-y':
                this.swingLimitY = parseNumber(newValue, 45, name);
                break;
            case 'swing-limit-z':
                this.swingLimitZ = parseNumber(newValue, 45, name);
                break;
            case 'twist-limit':
                this.twistLimit = parseNumber(newValue, 20, name);
                break;
            case 'type':
                this.type = parseEnum(newValue, ['fixed', 'ball', 'hinge', 'slider', '6dof'], 'fixed', name);
                break;
        }
    }
}
customElements.define('pc-joint', JointComponentElement);

/**
 * The LayoutChildComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-layoutchild/ | `<pc-layoutchild>`} elements.
 * The LayoutChildComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class LayoutChildComponentElement extends ComponentElement {
    _minWidth = 0;
    _minHeight = 0;
    _maxWidth = null;
    _maxHeight = null;
    _fitWidthProportion = 0;
    _fitHeightProportion = 0;
    _excludeFromLayout = false;
    /** @ignore */
    constructor() {
        super('layoutchild');
    }
    getInitialComponentData() {
        return {
            minWidth: this._minWidth,
            minHeight: this._minHeight,
            maxWidth: this._maxWidth,
            maxHeight: this._maxHeight,
            fitWidthProportion: this._fitWidthProportion,
            fitHeightProportion: this._fitHeightProportion,
            excludeFromLayout: this._excludeFromLayout
        };
    }
    /**
     * Gets the underlying PlayCanvas layout child component.
     * @returns The layout child component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets the minimum width the element should be laid out with.
     * @param value - The minimum width.
     */
    set minWidth(value) {
        this._minWidth = value;
        if (this.component) {
            this.component.minWidth = value;
        }
    }
    /**
     * Gets the minimum width the element should be laid out with.
     * @returns The minimum width.
     */
    get minWidth() {
        return this._minWidth;
    }
    /**
     * Sets the minimum height the element should be laid out with.
     * @param value - The minimum height.
     */
    set minHeight(value) {
        this._minHeight = value;
        if (this.component) {
            this.component.minHeight = value;
        }
    }
    /**
     * Gets the minimum height the element should be laid out with.
     * @returns The minimum height.
     */
    get minHeight() {
        return this._minHeight;
    }
    /**
     * Sets the maximum width the element should be laid out with (or `null` for no limit).
     * @param value - The maximum width.
     */
    set maxWidth(value) {
        this._maxWidth = value;
        if (this.component) {
            this.component.maxWidth = value;
        }
    }
    /**
     * Gets the maximum width the element should be laid out with.
     * @returns The maximum width.
     */
    get maxWidth() {
        return this._maxWidth;
    }
    /**
     * Sets the maximum height the element should be laid out with (or `null` for no limit).
     * @param value - The maximum height.
     */
    set maxHeight(value) {
        this._maxHeight = value;
        if (this.component) {
            this.component.maxHeight = value;
        }
    }
    /**
     * Gets the maximum height the element should be laid out with.
     * @returns The maximum height.
     */
    get maxHeight() {
        return this._maxHeight;
    }
    /**
     * Sets the proportion of the container's spare width this element should take (when the layout
     * group's `width-fitting` is set to stretch or shrink).
     * @param value - The fit width proportion.
     */
    set fitWidthProportion(value) {
        this._fitWidthProportion = value;
        if (this.component) {
            this.component.fitWidthProportion = value;
        }
    }
    /**
     * Gets the proportion of the container's spare width this element should take.
     * @returns The fit width proportion.
     */
    get fitWidthProportion() {
        return this._fitWidthProportion;
    }
    /**
     * Sets the proportion of the container's spare height this element should take (when the layout
     * group's `height-fitting` is set to stretch or shrink).
     * @param value - The fit height proportion.
     */
    set fitHeightProportion(value) {
        this._fitHeightProportion = value;
        if (this.component) {
            this.component.fitHeightProportion = value;
        }
    }
    /**
     * Gets the proportion of the container's spare height this element should take.
     * @returns The fit height proportion.
     */
    get fitHeightProportion() {
        return this._fitHeightProportion;
    }
    /**
     * Sets whether the element should be excluded from the layout (and thus not take up space).
     * @param value - Whether to exclude the element from layout.
     */
    set excludeFromLayout(value) {
        this._excludeFromLayout = value;
        if (this.component) {
            this.component.excludeFromLayout = value;
        }
    }
    /**
     * Gets whether the element is excluded from the layout.
     * @returns Whether the element is excluded from layout.
     */
    get excludeFromLayout() {
        return this._excludeFromLayout;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'min-width',
            'min-height',
            'max-width',
            'max-height',
            'fit-width-proportion',
            'fit-height-proportion',
            'exclude-from-layout'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'min-width':
                this.minWidth = parseNumber(newValue, 0, name);
                break;
            case 'min-height':
                this.minHeight = parseNumber(newValue, 0, name);
                break;
            case 'max-width':
                this.maxWidth = parseNumber(newValue, null, name);
                break;
            case 'max-height':
                this.maxHeight = parseNumber(newValue, null, name);
                break;
            case 'fit-width-proportion':
                this.fitWidthProportion = parseNumber(newValue, 0, name);
                break;
            case 'fit-height-proportion':
                this.fitHeightProportion = parseNumber(newValue, 0, name);
                break;
            case 'exclude-from-layout':
                this.excludeFromLayout = parseBool(newValue, false);
                break;
        }
    }
}
customElements.define('pc-layoutchild', LayoutChildComponentElement);

const orientations$1 = new Map([
    ['horizontal', ORIENTATION_HORIZONTAL],
    ['vertical', ORIENTATION_VERTICAL]
]);
const fittings = new Map([
    ['none', FITTING_NONE],
    ['stretch', FITTING_STRETCH],
    ['shrink', FITTING_SHRINK],
    ['both', FITTING_BOTH]
]);
/**
 * The LayoutGroupComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-layoutgroup/ | `<pc-layoutgroup>`} elements.
 * The LayoutGroupComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class LayoutGroupComponentElement extends ComponentElement {
    _orientation = 'horizontal';
    _reverseX = false;
    _reverseY = false;
    _alignment = new Vec2(0, 1);
    _padding = new Vec4(0, 0, 0, 0);
    _spacing = new Vec2(0, 0);
    _widthFitting = 'none';
    _heightFitting = 'none';
    _wrap = false;
    /** @ignore */
    constructor() {
        super('layoutgroup');
    }
    getInitialComponentData() {
        return {
            orientation: orientations$1.get(this._orientation),
            reverseX: this._reverseX,
            reverseY: this._reverseY,
            alignment: this._alignment,
            padding: this._padding,
            spacing: this._spacing,
            widthFitting: fittings.get(this._widthFitting),
            heightFitting: fittings.get(this._heightFitting),
            wrap: this._wrap
        };
    }
    /**
     * Gets the underlying PlayCanvas layout group component.
     * @returns The layout group component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets the orientation of the layout group. Can be `horizontal` or `vertical`. Defaults to
     * `horizontal`.
     * @param value - The orientation.
     */
    set orientation(value) {
        this._orientation = value;
        if (this.component) {
            this.component.orientation = orientations$1.get(value) ?? ORIENTATION_HORIZONTAL;
        }
    }
    /**
     * Gets the orientation of the layout group.
     * @returns The orientation.
     */
    get orientation() {
        return this._orientation;
    }
    /**
     * Sets whether the order of children is reversed along the horizontal axis.
     * @param value - Whether to reverse the horizontal order.
     */
    set reverseX(value) {
        this._reverseX = value;
        if (this.component) {
            this.component.reverseX = value;
        }
    }
    /**
     * Gets whether the order of children is reversed along the horizontal axis.
     * @returns Whether the horizontal order is reversed.
     */
    get reverseX() {
        return this._reverseX;
    }
    /**
     * Sets whether the order of children is reversed along the vertical axis.
     * @param value - Whether to reverse the vertical order.
     */
    set reverseY(value) {
        this._reverseY = value;
        if (this.component) {
            this.component.reverseY = value;
        }
    }
    /**
     * Gets whether the order of children is reversed along the vertical axis.
     * @returns Whether the vertical order is reversed.
     */
    get reverseY() {
        return this._reverseY;
    }
    /**
     * Sets the horizontal and vertical alignment of the child elements (each component 0 to 1).
     * @param value - The alignment.
     */
    set alignment(value) {
        this._alignment = value;
        if (this.component) {
            this.component.alignment = value;
        }
    }
    /**
     * Gets the alignment of the child elements.
     * @returns The alignment.
     */
    get alignment() {
        return this._alignment;
    }
    /**
     * Sets the padding around the layout group, as a Vec4 (left, bottom, right, top).
     * @param value - The padding.
     */
    set padding(value) {
        this._padding = value;
        if (this.component) {
            this.component.padding = value;
        }
    }
    /**
     * Gets the padding around the layout group.
     * @returns The padding.
     */
    get padding() {
        return this._padding;
    }
    /**
     * Sets the spacing between child elements, as a Vec2 (x, y).
     * @param value - The spacing.
     */
    set spacing(value) {
        this._spacing = value;
        if (this.component) {
            this.component.spacing = value;
        }
    }
    /**
     * Gets the spacing between child elements.
     * @returns The spacing.
     */
    get spacing() {
        return this._spacing;
    }
    /**
     * Sets the fitting mode along the horizontal axis. Can be `none`, `stretch`, `shrink` or
     * `both`. Defaults to `none`.
     * @param value - The width fitting mode.
     */
    set widthFitting(value) {
        this._widthFitting = value;
        if (this.component) {
            this.component.widthFitting = fittings.get(value) ?? FITTING_NONE;
        }
    }
    /**
     * Gets the fitting mode along the horizontal axis.
     * @returns The width fitting mode.
     */
    get widthFitting() {
        return this._widthFitting;
    }
    /**
     * Sets the fitting mode along the vertical axis. Can be `none`, `stretch`, `shrink` or
     * `both`. Defaults to `none`.
     * @param value - The height fitting mode.
     */
    set heightFitting(value) {
        this._heightFitting = value;
        if (this.component) {
            this.component.heightFitting = fittings.get(value) ?? FITTING_NONE;
        }
    }
    /**
     * Gets the fitting mode along the vertical axis.
     * @returns The height fitting mode.
     */
    get heightFitting() {
        return this._heightFitting;
    }
    /**
     * Sets whether children wrap onto a new line/column when they overflow the group.
     * @param value - Whether to wrap children.
     */
    set wrap(value) {
        this._wrap = value;
        if (this.component) {
            this.component.wrap = value;
        }
    }
    /**
     * Gets whether children wrap onto a new line/column when they overflow the group.
     * @returns Whether children wrap.
     */
    get wrap() {
        return this._wrap;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'orientation',
            'reverse-x',
            'reverse-y',
            'alignment',
            'padding',
            'spacing',
            'width-fitting',
            'height-fitting',
            'wrap'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'orientation':
                this.orientation = parseEnum(newValue, orientations$1, 'horizontal', name);
                break;
            case 'reverse-x':
                this.reverseX = parseBool(newValue, false);
                break;
            case 'reverse-y':
                this.reverseY = parseBool(newValue, false);
                break;
            case 'alignment':
                this.alignment = parseVec2(newValue, new Vec2(0, 1), name);
                break;
            case 'padding':
                this.padding = parseVec4(newValue, Vec4.ZERO, name);
                break;
            case 'spacing':
                this.spacing = parseVec2(newValue, Vec2.ZERO, name);
                break;
            case 'width-fitting':
                this.widthFitting = parseEnum(newValue, fittings, 'none', name);
                break;
            case 'height-fitting':
                this.heightFitting = parseEnum(newValue, fittings, 'none', name);
                break;
            case 'wrap':
                this.wrap = parseBool(newValue, false);
                break;
        }
    }
}
customElements.define('pc-layoutgroup', LayoutGroupComponentElement);

const shadowTypes = new Map([
    ['pcf1-16f', SHADOW_PCF1_16F],
    ['pcf1-32f', SHADOW_PCF1_32F],
    ['pcf3-16f', SHADOW_PCF3_16F],
    ['pcf3-32f', SHADOW_PCF3_32F],
    ['pcf5-16f', SHADOW_PCF5_16F],
    ['pcf5-32f', SHADOW_PCF5_32F],
    ['vsm-16f', SHADOW_VSM_16F],
    ['vsm-32f', SHADOW_VSM_32F],
    ['pcss-32f', SHADOW_PCSS_32F]
]);
/**
 * The LightComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-light/ | `<pc-light>`} elements.
 * The LightComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class LightComponentElement extends ComponentElement {
    _castShadows = false;
    _color = new Color(1, 1, 1);
    _innerConeAngle = 40;
    _intensity = 1;
    _normalOffsetBias = 0.05;
    _outerConeAngle = 45;
    _range = 10;
    _shadowBias = 0.2;
    _shadowDistance = 16;
    _shadowIntensity = 1;
    _shadowResolution = 1024;
    _shadowType = 'pcf3-32f';
    _type = 'directional';
    _vsmBias = 0.01;
    _vsmBlurSize = 11;
    _penumbraSize = 1;
    _penumbraFalloff = 1;
    _shadowSamples = 16;
    _shadowBlockerSamples = 16;
    /** @ignore */
    constructor() {
        super('light');
    }
    getInitialComponentData() {
        return {
            castShadows: this._castShadows,
            color: this._color,
            innerConeAngle: this._innerConeAngle,
            intensity: this._intensity,
            normalOffsetBias: this._normalOffsetBias,
            outerConeAngle: this._outerConeAngle,
            penumbraFalloff: this._penumbraFalloff,
            penumbraSize: this._penumbraSize,
            range: this._range,
            shadowBias: this._shadowBias,
            shadowBlockerSamples: this._shadowBlockerSamples,
            shadowDistance: this._shadowDistance,
            shadowIntensity: this._shadowIntensity,
            shadowResolution: this._shadowResolution,
            shadowSamples: this._shadowSamples,
            shadowType: shadowTypes.get(this._shadowType),
            type: this._type,
            vsmBias: this._vsmBias,
            vsmBlurSize: this._vsmBlurSize
        };
    }
    /**
     * Gets the underlying PlayCanvas light component.
     * @returns The light component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets the cast shadows flag of the light.
     * @param value - The cast shadows flag.
     */
    set castShadows(value) {
        this._castShadows = value;
        if (this.component) {
            this.component.castShadows = value;
        }
    }
    /**
     * Gets the cast shadows flag of the light.
     * @returns The cast shadows flag.
     */
    get castShadows() {
        return this._castShadows;
    }
    /**
     * Sets the color of the light.
     * @param value - The color.
     */
    set color(value) {
        this._color = value;
        if (this.component) {
            this.component.color = value;
        }
    }
    /**
     * Gets the color of the light.
     * @returns The color.
     */
    get color() {
        return this._color;
    }
    /**
     * Sets the inner cone angle of the light.
     * @param value - The inner cone angle.
     */
    set innerConeAngle(value) {
        this._innerConeAngle = value;
        if (this.component) {
            this.component.innerConeAngle = value;
        }
    }
    /**
     * Gets the inner cone angle of the light.
     * @returns The inner cone angle.
     */
    get innerConeAngle() {
        return this._innerConeAngle;
    }
    /**
     * Sets the intensity of the light.
     * @param value - The intensity.
     */
    set intensity(value) {
        this._intensity = value;
        if (this.component) {
            this.component.intensity = value;
        }
    }
    /**
     * Gets the intensity of the light.
     * @returns The intensity.
     */
    get intensity() {
        return this._intensity;
    }
    /**
     * Sets the normal offset bias of the light.
     * @param value - The normal offset bias.
     */
    set normalOffsetBias(value) {
        this._normalOffsetBias = value;
        if (this.component) {
            this.component.normalOffsetBias = value;
        }
    }
    /**
     * Gets the normal offset bias of the light.
     * @returns The normal offset bias.
     */
    get normalOffsetBias() {
        return this._normalOffsetBias;
    }
    /**
     * Sets the outer cone angle of the light.
     * @param value - The outer cone angle.
     */
    set outerConeAngle(value) {
        this._outerConeAngle = value;
        if (this.component) {
            this.component.outerConeAngle = value;
        }
    }
    /**
     * Gets the outer cone angle of the light.
     * @returns The outer cone angle.
     */
    get outerConeAngle() {
        return this._outerConeAngle;
    }
    /**
     * Sets the range of the light.
     * @param value - The range.
     */
    set range(value) {
        this._range = value;
        if (this.component) {
            this.component.range = value;
        }
    }
    /**
     * Gets the range of the light.
     * @returns The range.
     */
    get range() {
        return this._range;
    }
    /**
     * Sets the shadow bias of the light.
     * @param value - The shadow bias.
     */
    set shadowBias(value) {
        this._shadowBias = value;
        if (this.component) {
            this.component.shadowBias = value;
        }
    }
    /**
     * Gets the shadow bias of the light.
     * @returns The shadow bias.
     */
    get shadowBias() {
        return this._shadowBias;
    }
    /**
     * Sets the shadow distance of the light.
     * @param value - The shadow distance.
     */
    set shadowDistance(value) {
        this._shadowDistance = value;
        if (this.component) {
            this.component.shadowDistance = value;
        }
    }
    /**
     * Gets the shadow distance of the light.
     * @returns The shadow distance.
     */
    get shadowDistance() {
        return this._shadowDistance;
    }
    /**
     * Sets the shadow intensity of the light.
     * @param value - The shadow intensity.
     */
    set shadowIntensity(value) {
        this._shadowIntensity = value;
        if (this.component) {
            this.component.shadowIntensity = value;
        }
    }
    /**
     * Gets the shadow intensity of the light.
     * @returns The shadow intensity.
     */
    get shadowIntensity() {
        return this._shadowIntensity;
    }
    /**
     * Sets the shadow resolution of the light.
     * @param value - The shadow resolution.
     */
    set shadowResolution(value) {
        this._shadowResolution = value;
        if (this.component) {
            this.component.shadowResolution = value;
        }
    }
    /**
     * Gets the shadow resolution of the light.
     * @returns The shadow resolution.
     */
    get shadowResolution() {
        return this._shadowResolution;
    }
    /**
     * Sets the shadow type of the light.
     * @param value - The shadow type. Can be:
     *
     * - `pcf1-16f` - 1-tap percentage-closer filtered shadow map with 16-bit depth.
     * - `pcf1-32f` - 1-tap percentage-closer filtered shadow map with 32-bit depth.
     * - `pcf3-16f` - 3-tap percentage-closer filtered shadow map with 16-bit depth.
     * - `pcf3-32f` - 3-tap percentage-closer filtered shadow map with 32-bit depth.
     * - `pcf5-16f` - 5-tap percentage-closer filtered shadow map with 16-bit depth.
     * - `pcf5-32f` - 5-tap percentage-closer filtered shadow map with 32-bit depth.
     * - `vsm-16f` - Variance shadow map with 16-bit depth.
     * - `vsm-32f` - Variance shadow map with 32-bit depth.
     * - `pcss-32f` - Percentage-closer soft shadow with 32-bit depth.
     */
    set shadowType(value) {
        this._shadowType = value;
        if (this.component) {
            this.component.shadowType = shadowTypes.get(value) ?? SHADOW_PCF3_32F;
        }
    }
    /**
     * Gets the shadow type of the light.
     * @returns The shadow type.
     */
    get shadowType() {
        return this._shadowType;
    }
    /**
     * Sets the type of the light. Can be `directional`, `omni` or `spot`. Defaults to
     * `directional`.
     * @param value - The type.
     */
    set type(value) {
        this._type = value;
        if (this.component) {
            this.component.type = value;
        }
    }
    /**
     * Gets the type of the light.
     * @returns The type.
     */
    get type() {
        return this._type;
    }
    /**
     * Sets the VSM bias of the light.
     * @param value - The VSM bias.
     */
    set vsmBias(value) {
        this._vsmBias = value;
        if (this.component) {
            this.component.vsmBias = value;
        }
    }
    /**
     * Gets the VSM bias of the light.
     * @returns The VSM bias.
     */
    get vsmBias() {
        return this._vsmBias;
    }
    /**
     * Sets the VSM blur size of the light. Minimum is 1, maximum is 25. Default is 11.
     * @param value - The VSM blur size.
     */
    set vsmBlurSize(value) {
        this._vsmBlurSize = value;
        if (this.component) {
            this.component.vsmBlurSize = value;
        }
    }
    /**
     * Gets the VSM blur size of the light.
     * @returns The VSM blur size.
     */
    get vsmBlurSize() {
        return this._vsmBlurSize;
    }
    /**
     * Sets the penumbra size of the light. Used for PCSS shadows.
     * @param value - The penumbra size.
     */
    set penumbraSize(value) {
        this._penumbraSize = value;
        if (this.component) {
            this.component.penumbraSize = value;
        }
    }
    /**
     * Gets the penumbra size of the light.
     * @returns The penumbra size.
     */
    get penumbraSize() {
        return this._penumbraSize;
    }
    /**
     * Sets the penumbra falloff of the light. Used for PCSS shadows.
     * @param value - The penumbra falloff.
     */
    set penumbraFalloff(value) {
        this._penumbraFalloff = value;
        if (this.component) {
            this.component.penumbraFalloff = value;
        }
    }
    /**
     * Gets the penumbra falloff of the light.
     * @returns The penumbra falloff.
     */
    get penumbraFalloff() {
        return this._penumbraFalloff;
    }
    /**
     * Sets the number of shadow samples. Used for PCSS shadows.
     * @param value - The number of shadow samples.
     */
    set shadowSamples(value) {
        this._shadowSamples = value;
        if (this.component) {
            this.component.shadowSamples = value;
        }
    }
    /**
     * Gets the number of shadow samples.
     * @returns The number of shadow samples.
     */
    get shadowSamples() {
        return this._shadowSamples;
    }
    /**
     * Sets the number of shadow blocker samples. Used for PCSS shadows.
     * @param value - The number of shadow blocker samples.
     */
    set shadowBlockerSamples(value) {
        this._shadowBlockerSamples = value;
        if (this.component) {
            this.component.shadowBlockerSamples = value;
        }
    }
    /**
     * Gets the number of shadow blocker samples.
     * @returns The number of shadow blocker samples.
     */
    get shadowBlockerSamples() {
        return this._shadowBlockerSamples;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'color',
            'cast-shadows',
            'intensity',
            'inner-cone-angle',
            'normal-offset-bias',
            'outer-cone-angle',
            'penumbra-falloff',
            'penumbra-size',
            'range',
            'shadow-bias',
            'shadow-blocker-samples',
            'shadow-distance',
            'shadow-intensity',
            'shadow-resolution',
            'shadow-samples',
            'shadow-type',
            'type',
            'vsm-bias',
            'vsm-blur-size'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'color':
                this.color = parseColor(newValue, Color.WHITE, name);
                break;
            case 'cast-shadows':
                this.castShadows = parseBool(newValue, false);
                break;
            case 'inner-cone-angle':
                this.innerConeAngle = parseNumber(newValue, 40, name);
                break;
            case 'intensity':
                this.intensity = parseNumber(newValue, 1, name);
                break;
            case 'normal-offset-bias':
                this.normalOffsetBias = parseNumber(newValue, 0.05, name);
                break;
            case 'outer-cone-angle':
                this.outerConeAngle = parseNumber(newValue, 45, name);
                break;
            case 'penumbra-falloff':
                this.penumbraFalloff = parseNumber(newValue, 1, name);
                break;
            case 'penumbra-size':
                this.penumbraSize = parseNumber(newValue, 1, name);
                break;
            case 'range':
                this.range = parseNumber(newValue, 10, name);
                break;
            case 'shadow-bias':
                this.shadowBias = parseNumber(newValue, 0.2, name);
                break;
            case 'shadow-distance':
                this.shadowDistance = parseNumber(newValue, 16, name);
                break;
            case 'shadow-blocker-samples':
                this.shadowBlockerSamples = parseNumber(newValue, 16, name);
                break;
            case 'shadow-resolution':
                this.shadowResolution = parseNumber(newValue, 1024, name);
                break;
            case 'shadow-intensity':
                this.shadowIntensity = parseNumber(newValue, 1, name);
                break;
            case 'shadow-samples':
                this.shadowSamples = parseNumber(newValue, 16, name);
                break;
            case 'shadow-type':
                this.shadowType = parseEnum(newValue, shadowTypes, 'pcf3-32f', name);
                break;
            case 'type':
                this.type = parseEnum(newValue, ['directional', 'omni', 'spot'], 'directional', name);
                break;
            case 'vsm-bias':
                this.vsmBias = parseNumber(newValue, 0.01, name);
                break;
            case 'vsm-blur-size':
                this.vsmBlurSize = parseNumber(newValue, 11, name);
                break;
        }
    }
}
customElements.define('pc-light', LightComponentElement);

/**
 * The ParticleSystemComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-particles/ | `<pc-particles>`} elements.
 * The ParticleSystemComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class ParticleSystemComponentElement extends ComponentElement {
    _asset = '';
    /** @ignore */
    constructor() {
        super('particlesystem');
    }
    getInitialComponentData() {
        const asset = useAsset(this._asset);
        // A lazy config has no resource yet - _loadAsset applies it once the load completes
        if (!asset || !asset.resource) {
            return {};
        }
        if (asset.resource.colorMapAsset) {
            const id = asset.resource.colorMapAsset;
            const colorMapAsset = useAsset(id)?.id;
            if (colorMapAsset) {
                asset.resource.colorMapAsset = colorMapAsset;
            }
        }
        return asset.resource;
    }
    /**
     * Gets the underlying PlayCanvas particle system component.
     * @returns The particle system component.
     */
    get component() {
        return super.component;
    }
    applyConfig(resource) {
        if (!this.component) {
            return;
        }
        // Set all the config properties on the component
        for (const key in resource) {
            if (Object.hasOwn(resource, key)) {
                this.component[key] = resource[key];
            }
        }
    }
    async _loadAsset() {
        await this.closestApp?.ready();
        const asset = useAsset(this._asset);
        if (!asset) {
            return;
        }
        if (asset.loaded) {
            this.applyConfig(asset.resource);
        }
        else {
            asset.once('load', () => {
                this.applyConfig(asset.resource);
            });
        }
    }
    /**
     * Sets the id of the `pc-asset` to use for the model.
     * @param value - The asset ID.
     */
    set asset(value) {
        this._asset = value;
        if (this.isConnected) {
            this._loadAsset();
        }
    }
    /**
     * Gets the id of the `pc-asset` to use for the model.
     * @returns The asset ID.
     */
    get asset() {
        return this._asset;
    }
    // Control methods
    /**
     * Starts playing the particle system
     */
    play() {
        if (this.component) {
            this.component.play();
        }
    }
    /**
     * Pauses the particle system
     */
    pause() {
        if (this.component) {
            this.component.pause();
        }
    }
    /**
     * Resets the particle system
     */
    reset() {
        if (this.component) {
            this.component.reset();
        }
    }
    /**
     * Stops the particle system
     */
    stop() {
        if (this.component) {
            this.component.stop();
        }
    }
    static get observedAttributes() {
        return [...super.observedAttributes, 'asset'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'asset':
                this.asset = newValue ?? '';
                break;
        }
    }
}
customElements.define('pc-particles', ParticleSystemComponentElement);

const blendTypes = new Map([
    ['none', BLEND_NONE],
    ['normal', BLEND_NORMAL],
    ['additive', BLEND_ADDITIVE],
    ['additive-alpha', BLEND_ADDITIVEALPHA],
    ['premultiplied', BLEND_PREMULTIPLIED],
    ['multiplicative', BLEND_MULTIPLICATIVE],
    ['multiplicative-2x', BLEND_MULTIPLICATIVE2X],
    ['screen', BLEND_SCREEN],
    ['min', BLEND_MIN],
    ['max', BLEND_MAX],
    ['subtractive', BLEND_SUBTRACTIVE]
]);
const cullModes = new Map([
    ['none', CULLFACE_NONE],
    ['back', CULLFACE_BACK],
    ['front', CULLFACE_FRONT],
    ['front-and-back', CULLFACE_FRONTANDBACK]
]);
const fresnelModels = new Map([
    ['none', FRESNEL_NONE],
    ['schlick', FRESNEL_SCHLICK]
]);
const occludeSpeculars = new Map([
    ['none', SPECOCC_NONE],
    ['ao', SPECOCC_AO],
    ['gloss-dependent', SPECOCC_GLOSSDEPENDENT]
]);
const opacityDithers = ['none', 'bayer8', 'bluenoise', 'ignnoise'];
const colorChannels = ['r', 'g', 'b', 'a', 'rgb'];
const scalarChannels = ['r', 'g', 'b', 'a'];
/**
 * The attributes that contradict a `roughness-*` attribute: each one carries the opposite
 * interpretation of a value the aliases also write. The `gloss-map-*` modifiers are deliberately
 * absent - they only configure the shared slot (tiling, offset, channel and so on) and carry no
 * interpretation of their own, so they are the supported way to configure a `roughness-map`.
 */
const glossConflicts = ['gloss', 'gloss-invert', 'gloss-map'];
/** The aliases those attributes contradict. */
const roughnessAliases = ['roughness', 'roughness-map'];
/**
 * The MaterialElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-material/ | `<pc-material>`} elements.
 * The MaterialElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * A `pc-material` must be a direct child of `pc-app` — elements placed elsewhere log a warning
 * and never create a material. Elements inserted while the application is already running are
 * created on insertion.
 *
 * The element is metal/rough by default: unlike a bare `StandardMaterial` it enables the metalness
 * workflow, which is what the `metalness-*` attributes assume and what glTF means by PBR. It also
 * defaults `metalness` to 0 rather than the engine's 1, because those two defaults have to be
 * chosen together - the engine's 1 is unreachable under its own `useMetalness` of false, and with
 * the workflow on it would make every material fully metallic, so `<pc-material diffuse="crimson">`
 * would render as dark tinted reflections of an environment that may not exist rather than as a
 * crimson surface. `metalness="1"` remains one attribute away.
 *
 * The `roughness` and `roughness-map` attributes are aliases for `gloss` and `gloss-map` that
 * additionally invert the gloss channel; do not mix the two families on one element.
 *
 * The two aliases are documented here rather than on an accessor, because they resolve to the
 * `gloss` properties and would otherwise inherit gloss's description - which reads inverted.
 *
 * @attribute {number} roughness - The roughness of the material, from 0 (shiny) to 1 (rough). An
 * alias for `gloss` that also inverts it, so do not combine it with the `gloss` attributes.
 * @attribute {string} roughness-map - The id of the `pc-asset` to use as the roughness map. An
 * alias for `gloss-map` that also inverts the gloss channel, so do not combine it with the `gloss`
 * attributes.
 */
class MaterialElement extends HTMLElement {
    _alphaTest = 0;
    _alphaToCoverage = false;
    _aoIntensity = 1;
    _aoMap = '';
    _aoMapChannel = 'g';
    _aoMapOffset = new Vec2(0, 0);
    _aoMapRotation = 0;
    _aoMapTiling = new Vec2(1, 1);
    _aoMapUv = 0;
    _blendType = 'none';
    _bumpiness = 1;
    _cull = 'back';
    _depthBias = 0;
    _depthTest = true;
    _depthWrite = true;
    _diffuse = new Color(1, 1, 1);
    _diffuseMap = '';
    _diffuseMapChannel = 'rgb';
    _diffuseMapOffset = new Vec2(0, 0);
    _diffuseMapRotation = 0;
    _diffuseMapTiling = new Vec2(1, 1);
    _diffuseMapUv = 0;
    _emissive = new Color(0, 0, 0);
    _emissiveIntensity = 1;
    _emissiveMap = '';
    _emissiveMapChannel = 'rgb';
    _emissiveMapOffset = new Vec2(0, 0);
    _emissiveMapRotation = 0;
    _emissiveMapTiling = new Vec2(1, 1);
    _emissiveMapUv = 0;
    _enableGGXSpecular = false;
    _fresnelModel = 'schlick';
    _gloss = 0.25;
    _glossInvert = false;
    _glossMap = '';
    _glossMapChannel = 'g';
    _glossMapOffset = new Vec2(0, 0);
    _glossMapRotation = 0;
    _glossMapTiling = new Vec2(1, 1);
    _glossMapUv = 0;
    _heightMap = '';
    _heightMapChannel = 'g';
    _heightMapFactor = 1;
    _heightMapOffset = new Vec2(0, 0);
    _heightMapRotation = 0;
    _heightMapTiling = new Vec2(1, 1);
    _heightMapUv = 0;
    _metalness = 0;
    _metalnessMap = '';
    _metalnessMapChannel = 'g';
    _metalnessMapOffset = new Vec2(0, 0);
    _metalnessMapRotation = 0;
    _metalnessMapTiling = new Vec2(1, 1);
    _metalnessMapUv = 0;
    _name = 'Untitled';
    _normalMap = '';
    _normalMapOffset = new Vec2(0, 0);
    _normalMapRotation = 0;
    _normalMapTiling = new Vec2(1, 1);
    _normalMapUv = 0;
    _occludeDirect = false;
    _occludeSpecular = 'ao';
    _opacity = 1;
    _opacityDither = 'none';
    _opacityFadesSpecular = true;
    _opacityMap = '';
    _opacityMapChannel = 'a';
    _opacityMapOffset = new Vec2(0, 0);
    _opacityMapRotation = 0;
    _opacityMapTiling = new Vec2(1, 1);
    _opacityMapUv = 0;
    _slopeDepthBias = 0;
    _specular = new Color(0, 0, 0);
    _specularityFactor = 1;
    _twoSidedLighting = false;
    _useFog = true;
    _useLighting = true;
    // Diverges from the engine default of false - see the class docblock and _createMaterial()
    _useMetalness = true;
    _useMetalnessSpecularColor = false;
    _useSkybox = true;
    _useTonemap = true;
    /**
     * Pending `load` handlers, one per texture slot. A slot's handler is torn down when the slot is
     * reassigned or the element disconnects, so a late-arriving asset can never write a texture the
     * element no longer wants.
     */
    _mapHandles = new Map();
    _updateScheduled = false;
    _glossConflictWarned = false;
    /**
     * The material. `null` until the containing application has created it — an element present
     * at startup has its material once the application is ready.
     */
    material = null;
    async connectedCallback() {
        const appElement = this.parentElement?.closest('pc-app') ?? null;
        // Materials must be direct children of pc-app (matches the boot query ':scope > pc-material')
        if (!appElement || this.parentElement !== appElement) {
            console.warn(`pc-material '${this.id}' must be a direct child of pc-app - material not created`);
            return;
        }
        await appElement.ready();
        // The element may have been removed or re-parented while waiting for the app
        if (!this.isConnected || this.parentElement !== appElement)
            return;
        // Materials present at startup are created by AppElement's boot; this branch handles
        // elements inserted (or re-inserted) after the app is already running
        if (!this.material) {
            if (!appElement.app)
                return; // pc-app is re-connecting; its own boot will create this
            this._createMaterial();
        }
    }
    /**
     * Creates the material from the element's cached properties. Called by the containing
     * `<pc-app>` element during its boot sweep, and on connection for elements inserted while
     * the application is already running.
     *
     * @internal
     */
    _createMaterial() {
        const material = new StandardMaterial();
        this.material = material;
        material.alphaTest = this._alphaTest;
        material.alphaToCoverage = this._alphaToCoverage;
        material.aoIntensity = this._aoIntensity;
        material.aoMapChannel = this._aoMapChannel;
        material.aoMapOffset = this._aoMapOffset;
        material.aoMapRotation = this._aoMapRotation;
        material.aoMapTiling = this._aoMapTiling;
        material.aoMapUv = this._aoMapUv;
        material.blendType = blendTypes.get(this._blendType) ?? BLEND_NONE;
        material.bumpiness = this._bumpiness;
        material.cull = cullModes.get(this._cull) ?? CULLFACE_BACK;
        material.depthBias = this._depthBias;
        material.depthTest = this._depthTest;
        material.depthWrite = this._depthWrite;
        material.diffuse = this._diffuse;
        material.diffuseMapChannel = this._diffuseMapChannel;
        material.diffuseMapOffset = this._diffuseMapOffset;
        material.diffuseMapRotation = this._diffuseMapRotation;
        material.diffuseMapTiling = this._diffuseMapTiling;
        material.diffuseMapUv = this._diffuseMapUv;
        material.emissive = this._emissive;
        material.emissiveIntensity = this._emissiveIntensity;
        material.emissiveMapChannel = this._emissiveMapChannel;
        material.emissiveMapOffset = this._emissiveMapOffset;
        material.emissiveMapRotation = this._emissiveMapRotation;
        material.emissiveMapTiling = this._emissiveMapTiling;
        material.emissiveMapUv = this._emissiveMapUv;
        material.enableGGXSpecular = this._enableGGXSpecular;
        material.fresnelModel = fresnelModels.get(this._fresnelModel) ?? FRESNEL_SCHLICK;
        material.gloss = this._gloss;
        material.glossInvert = this._glossInvert;
        material.glossMapChannel = this._glossMapChannel;
        material.glossMapOffset = this._glossMapOffset;
        material.glossMapRotation = this._glossMapRotation;
        material.glossMapTiling = this._glossMapTiling;
        material.glossMapUv = this._glossMapUv;
        material.heightMapChannel = this._heightMapChannel;
        material.heightMapFactor = this._heightMapFactor;
        material.heightMapOffset = this._heightMapOffset;
        material.heightMapRotation = this._heightMapRotation;
        material.heightMapTiling = this._heightMapTiling;
        material.heightMapUv = this._heightMapUv;
        material.metalness = this._metalness;
        material.metalnessMapChannel = this._metalnessMapChannel;
        material.metalnessMapOffset = this._metalnessMapOffset;
        material.metalnessMapRotation = this._metalnessMapRotation;
        material.metalnessMapTiling = this._metalnessMapTiling;
        material.metalnessMapUv = this._metalnessMapUv;
        material.name = this._name;
        material.normalMapOffset = this._normalMapOffset;
        material.normalMapRotation = this._normalMapRotation;
        material.normalMapTiling = this._normalMapTiling;
        material.normalMapUv = this._normalMapUv;
        // @ts-ignore the engine's generated .d.ts types occludeDirect as a number, but its own
        // JSDoc documents it as a boolean and its runtime default is `false`
        material.occludeDirect = this._occludeDirect;
        material.occludeSpecular = occludeSpeculars.get(this._occludeSpecular) ?? SPECOCC_AO;
        material.opacity = this._opacity;
        material.opacityDither = this._opacityDither;
        material.opacityFadesSpecular = this._opacityFadesSpecular;
        material.opacityMapChannel = this._opacityMapChannel;
        material.opacityMapOffset = this._opacityMapOffset;
        material.opacityMapRotation = this._opacityMapRotation;
        material.opacityMapTiling = this._opacityMapTiling;
        material.opacityMapUv = this._opacityMapUv;
        material.slopeDepthBias = this._slopeDepthBias;
        material.specular = this._specular;
        material.specularityFactor = this._specularityFactor;
        material.twoSidedLighting = this._twoSidedLighting;
        material.useFog = this._useFog;
        material.useLighting = this._useLighting;
        // The engine defaults to the older specular/gloss workflow, in which metalnessMap is never
        // sampled at all - useMetalness drives the LIT_METALNESS define. This element defaults the
        // other way, so that `metalness-map` does what its name says.
        material.useMetalness = this._useMetalness;
        material.useMetalnessSpecularColor = this._useMetalnessSpecularColor;
        material.useSkybox = this._useSkybox;
        material.useTonemap = this._useTonemap;
        // Texture slots resolve a pc-asset id, which may not have loaded yet
        this.aoMap = this._aoMap;
        this.diffuseMap = this._diffuseMap;
        this.emissiveMap = this._emissiveMap;
        this.glossMap = this._glossMap;
        this.heightMap = this._heightMap;
        this.metalnessMap = this._metalnessMap;
        this.normalMap = this._normalMap;
        this.opacityMap = this._opacityMap;
        material.update();
    }
    disconnectedCallback() {
        for (const handle of this._mapHandles.values()) {
            handle.off();
        }
        this._mapHandles.clear();
        if (this.material) {
            this.material.destroy();
            this.material = null;
        }
    }
    /**
     * Coalesces `material.update()` across a burst of attribute or property writes, so that setting
     * a dozen attributes in one parse costs one update rather than a dozen.
     */
    _scheduleUpdate() {
        if (this._updateScheduled)
            return;
        this._updateScheduled = true;
        queueMicrotask(() => {
            this._updateScheduled = false;
            this.material?.update();
        });
    }
    /**
     * Warns when a `roughness-*` attribute is combined with one that carries the opposite
     * interpretation of the same value. They write the same engine properties but disagree about
     * whether the channel is inverted, so the result would depend on attribute order rather than
     * on intent.
     *
     * Called from both families rather than only from the roughness branches, because the two
     * orderings are equally wrong and only one of them would otherwise be caught. The conflict is
     * a property of the element rather than of any one write - and an upgrading element already
     * has all of its attributes, so every branch would otherwise report the same clash - so the
     * warning latches and reports once per episode, clearing when the clash is resolved.
     */
    _warnGlossConflict() {
        const quote = (names) => `'${names.join("', '")}'`;
        const roughness = roughnessAliases.filter((name) => this.hasAttribute(name));
        const gloss = glossConflicts.filter((name) => this.hasAttribute(name));
        if (roughness.length === 0 || gloss.length === 0) {
            this._glossConflictWarned = false;
            return;
        }
        if (this._glossConflictWarned)
            return;
        this._glossConflictWarned = true;
        console.warn(`pc-material '${this.id}' sets both ${quote(roughness)} and ${quote(gloss)} - ` +
            'the roughness-* attributes invert gloss, so the two families contradict each other. Use one or the other.');
    }
    /**
     * Points a texture slot at the resource of a `pc-asset`, waiting for the asset to load when it
     * has not already. An empty id clears the slot.
     *
     * @param id - The id of the `pc-asset`, or an empty string to clear the slot.
     * @param slot - The material property to write.
     */
    _setMap(id, slot) {
        // Drop any load still pending for this slot - its texture is no longer the one we want
        this._mapHandles.get(slot)?.off();
        this._mapHandles.delete(slot);
        if (!this.material)
            return;
        if (!id) {
            this.material[slot] = null;
            this._scheduleUpdate();
            return;
        }
        const asset = useAsset(id);
        if (!asset)
            return;
        if (asset.loaded) {
            this._applyMap(slot, asset.resource);
            return;
        }
        this._mapHandles.set(slot, asset.once('load', () => {
            this._mapHandles.delete(slot);
            this._applyMap(slot, asset.resource);
        }));
    }
    /**
     * @param slot - The material property to write.
     * @param texture - The loaded texture, applied with its sampler state untouched - anisotropy
     * and friends belong to the `pc-asset`'s texture options.
     */
    _applyMap(slot, texture) {
        if (!this.material)
            return;
        this.material[slot] = texture;
        this._scheduleUpdate();
    }
    /**
     * Sets the alpha test reference value. Fragments with an opacity below this value are discarded.
     * @param value - The alpha test reference value.
     */
    set alphaTest(value) {
        this._alphaTest = value;
        if (this.material) {
            this.material.alphaTest = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the alpha test reference value.
     * @returns The alpha test reference value.
     */
    get alphaTest() {
        return this._alphaTest;
    }
    /**
     * Sets whether to use alpha to coverage, which resolves transparency using multisampling.
     * @param value - The alpha to coverage flag.
     */
    set alphaToCoverage(value) {
        this._alphaToCoverage = value;
        if (this.material) {
            this.material.alphaToCoverage = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether to use alpha to coverage.
     * @returns The alpha to coverage flag.
     */
    get alphaToCoverage() {
        return this._alphaToCoverage;
    }
    /**
     * Sets the strength of the ambient occlusion map, from 0 to 1.
     * @param value - The ambient occlusion intensity.
     */
    set aoIntensity(value) {
        this._aoIntensity = value;
        if (this.material) {
            this.material.aoIntensity = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the strength of the ambient occlusion map.
     * @returns The ambient occlusion intensity.
     */
    get aoIntensity() {
        return this._aoIntensity;
    }
    /**
     * Sets the id of the `pc-asset` to use as the ambient occlusion map.
     * @param value - The asset id.
     */
    set aoMap(value) {
        this._aoMap = value;
        this._setMap(value, 'aoMap');
    }
    /**
     * Gets the id of the `pc-asset` used as the ambient occlusion map.
     * @returns The asset id.
     */
    get aoMap() {
        return this._aoMap;
    }
    /**
     * Sets the color channel of the ambient occlusion map to sample.
     * @param value - The channel.
     */
    set aoMapChannel(value) {
        this._aoMapChannel = value;
        if (this.material) {
            this.material.aoMapChannel = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the color channel of the ambient occlusion map to sample.
     * @returns The channel.
     */
    get aoMapChannel() {
        return this._aoMapChannel;
    }
    /**
     * Sets the 2D offset of the ambient occlusion map.
     * @param value - The offset.
     */
    set aoMapOffset(value) {
        this._aoMapOffset = value;
        if (this.material) {
            this.material.aoMapOffset = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D offset of the ambient occlusion map.
     * @returns The offset.
     */
    get aoMapOffset() {
        return this._aoMapOffset;
    }
    /**
     * Sets the 2D rotation of the ambient occlusion map, in degrees.
     * @param value - The rotation.
     */
    set aoMapRotation(value) {
        this._aoMapRotation = value;
        if (this.material) {
            this.material.aoMapRotation = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D rotation of the ambient occlusion map.
     * @returns The rotation.
     */
    get aoMapRotation() {
        return this._aoMapRotation;
    }
    /**
     * Sets the 2D tiling of the ambient occlusion map.
     * @param value - The tiling.
     */
    set aoMapTiling(value) {
        this._aoMapTiling = value;
        if (this.material) {
            this.material.aoMapTiling = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D tiling of the ambient occlusion map.
     * @returns The tiling.
     */
    get aoMapTiling() {
        return this._aoMapTiling;
    }
    /**
     * Sets the UV channel the ambient occlusion map samples.
     * @param value - The UV channel.
     */
    set aoMapUv(value) {
        this._aoMapUv = value;
        if (this.material) {
            this.material.aoMapUv = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the UV channel the ambient occlusion map samples.
     * @returns The UV channel.
     */
    get aoMapUv() {
        return this._aoMapUv;
    }
    /**
     * Sets how the material is blended with the scene behind it.
     * @param value - The blend type.
     */
    set blendType(value) {
        this._blendType = value;
        if (this.material) {
            this.material.blendType = blendTypes.get(value) ?? BLEND_NONE;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets how the material is blended with the scene behind it.
     * @returns The blend type.
     */
    get blendType() {
        return this._blendType;
    }
    /**
     * Sets the strength of the normal map, where 0 is flat and 1 is the map's full effect.
     * @param value - The bumpiness.
     */
    set bumpiness(value) {
        this._bumpiness = value;
        if (this.material) {
            this.material.bumpiness = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the strength of the normal map.
     * @returns The bumpiness.
     */
    get bumpiness() {
        return this._bumpiness;
    }
    /**
     * Sets which faces of a mesh are culled.
     * @param value - The cull mode.
     */
    set cull(value) {
        this._cull = value;
        if (this.material) {
            this.material.cull = cullModes.get(value) ?? CULLFACE_BACK;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets which faces of a mesh are culled.
     * @returns The cull mode.
     */
    get cull() {
        return this._cull;
    }
    /**
     * Sets the offset applied to the depth of a fragment, used to resolve z-fighting.
     * @param value - The depth bias.
     */
    set depthBias(value) {
        this._depthBias = value;
        if (this.material) {
            this.material.depthBias = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the offset applied to the depth of a fragment.
     * @returns The depth bias.
     */
    get depthBias() {
        return this._depthBias;
    }
    /**
     * Sets whether fragments are tested against the depth buffer.
     * @param value - The depth test flag.
     */
    set depthTest(value) {
        this._depthTest = value;
        if (this.material) {
            this.material.depthTest = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether fragments are tested against the depth buffer.
     * @returns The depth test flag.
     */
    get depthTest() {
        return this._depthTest;
    }
    /**
     * Sets whether fragments write to the depth buffer.
     * @param value - The depth write flag.
     */
    set depthWrite(value) {
        this._depthWrite = value;
        if (this.material) {
            this.material.depthWrite = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether fragments write to the depth buffer.
     * @returns The depth write flag.
     */
    get depthWrite() {
        return this._depthWrite;
    }
    /**
     * Sets the diffuse color of the material. With the metalness workflow this doubles as the
     * specular color where the surface is metallic.
     * @param value - The diffuse color.
     */
    set diffuse(value) {
        this._diffuse = value;
        if (this.material) {
            this.material.diffuse = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the diffuse color of the material.
     * @returns The diffuse color.
     */
    get diffuse() {
        return this._diffuse;
    }
    /**
     * Sets the id of the `pc-asset` to use as the diffuse map.
     * @param value - The asset id.
     */
    set diffuseMap(value) {
        this._diffuseMap = value;
        this._setMap(value, 'diffuseMap');
    }
    /**
     * Gets the id of the `pc-asset` used as the diffuse map.
     * @returns The asset id.
     */
    get diffuseMap() {
        return this._diffuseMap;
    }
    /**
     * Sets the color channels of the diffuse map to sample.
     * @param value - The channels.
     */
    set diffuseMapChannel(value) {
        this._diffuseMapChannel = value;
        if (this.material) {
            this.material.diffuseMapChannel = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the color channels of the diffuse map to sample.
     * @returns The channels.
     */
    get diffuseMapChannel() {
        return this._diffuseMapChannel;
    }
    /**
     * Sets the 2D offset of the diffuse map.
     * @param value - The offset.
     */
    set diffuseMapOffset(value) {
        this._diffuseMapOffset = value;
        if (this.material) {
            this.material.diffuseMapOffset = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D offset of the diffuse map.
     * @returns The offset.
     */
    get diffuseMapOffset() {
        return this._diffuseMapOffset;
    }
    /**
     * Sets the 2D rotation of the diffuse map, in degrees.
     * @param value - The rotation.
     */
    set diffuseMapRotation(value) {
        this._diffuseMapRotation = value;
        if (this.material) {
            this.material.diffuseMapRotation = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D rotation of the diffuse map.
     * @returns The rotation.
     */
    get diffuseMapRotation() {
        return this._diffuseMapRotation;
    }
    /**
     * Sets the 2D tiling of the diffuse map.
     * @param value - The tiling.
     */
    set diffuseMapTiling(value) {
        this._diffuseMapTiling = value;
        if (this.material) {
            this.material.diffuseMapTiling = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D tiling of the diffuse map.
     * @returns The tiling.
     */
    get diffuseMapTiling() {
        return this._diffuseMapTiling;
    }
    /**
     * Sets the UV channel the diffuse map samples.
     * @param value - The UV channel.
     */
    set diffuseMapUv(value) {
        this._diffuseMapUv = value;
        if (this.material) {
            this.material.diffuseMapUv = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the UV channel the diffuse map samples.
     * @returns The UV channel.
     */
    get diffuseMapUv() {
        return this._diffuseMapUv;
    }
    /**
     * Sets the emissive color of the material, which is added to the lit result.
     * @param value - The emissive color.
     */
    set emissive(value) {
        this._emissive = value;
        if (this.material) {
            this.material.emissive = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the emissive color of the material.
     * @returns The emissive color.
     */
    get emissive() {
        return this._emissive;
    }
    /**
     * Sets the multiplier applied to the emissive color and map.
     * @param value - The emissive intensity.
     */
    set emissiveIntensity(value) {
        this._emissiveIntensity = value;
        if (this.material) {
            this.material.emissiveIntensity = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the multiplier applied to the emissive color and map.
     * @returns The emissive intensity.
     */
    get emissiveIntensity() {
        return this._emissiveIntensity;
    }
    /**
     * Sets the id of the `pc-asset` to use as the emissive map.
     * @param value - The asset id.
     */
    set emissiveMap(value) {
        this._emissiveMap = value;
        this._setMap(value, 'emissiveMap');
    }
    /**
     * Gets the id of the `pc-asset` used as the emissive map.
     * @returns The asset id.
     */
    get emissiveMap() {
        return this._emissiveMap;
    }
    /**
     * Sets the color channels of the emissive map to sample.
     * @param value - The channels.
     */
    set emissiveMapChannel(value) {
        this._emissiveMapChannel = value;
        if (this.material) {
            this.material.emissiveMapChannel = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the color channels of the emissive map to sample.
     * @returns The channels.
     */
    get emissiveMapChannel() {
        return this._emissiveMapChannel;
    }
    /**
     * Sets the 2D offset of the emissive map.
     * @param value - The offset.
     */
    set emissiveMapOffset(value) {
        this._emissiveMapOffset = value;
        if (this.material) {
            this.material.emissiveMapOffset = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D offset of the emissive map.
     * @returns The offset.
     */
    get emissiveMapOffset() {
        return this._emissiveMapOffset;
    }
    /**
     * Sets the 2D rotation of the emissive map, in degrees.
     * @param value - The rotation.
     */
    set emissiveMapRotation(value) {
        this._emissiveMapRotation = value;
        if (this.material) {
            this.material.emissiveMapRotation = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D rotation of the emissive map.
     * @returns The rotation.
     */
    get emissiveMapRotation() {
        return this._emissiveMapRotation;
    }
    /**
     * Sets the 2D tiling of the emissive map.
     * @param value - The tiling.
     */
    set emissiveMapTiling(value) {
        this._emissiveMapTiling = value;
        if (this.material) {
            this.material.emissiveMapTiling = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D tiling of the emissive map.
     * @returns The tiling.
     */
    get emissiveMapTiling() {
        return this._emissiveMapTiling;
    }
    /**
     * Sets the UV channel the emissive map samples.
     * @param value - The UV channel.
     */
    set emissiveMapUv(value) {
        this._emissiveMapUv = value;
        if (this.material) {
            this.material.emissiveMapUv = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the UV channel the emissive map samples.
     * @returns The UV channel.
     */
    get emissiveMapUv() {
        return this._emissiveMapUv;
    }
    /**
     * Sets whether to use the GGX specular model, which supports anisotropy.
     * @param value - The GGX specular flag.
     */
    set enableGGXSpecular(value) {
        this._enableGGXSpecular = value;
        if (this.material) {
            this.material.enableGGXSpecular = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether to use the GGX specular model.
     * @returns The GGX specular flag.
     */
    get enableGGXSpecular() {
        return this._enableGGXSpecular;
    }
    /**
     * Sets the Fresnel model used for specular reflections at grazing angles.
     * @param value - The Fresnel model.
     */
    set fresnelModel(value) {
        this._fresnelModel = value;
        if (this.material) {
            this.material.fresnelModel = fresnelModels.get(value) ?? FRESNEL_SCHLICK;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the Fresnel model used for specular reflections at grazing angles.
     * @returns The Fresnel model.
     */
    get fresnelModel() {
        return this._fresnelModel;
    }
    /**
     * Sets the glossiness of the material, from 0 (rough) to 1 (shiny). See also `roughness`.
     * @param value - The gloss.
     */
    set gloss(value) {
        this._gloss = value;
        if (this.material) {
            this.material.gloss = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the glossiness of the material.
     * @returns The gloss.
     */
    get gloss() {
        return this._gloss;
    }
    /**
     * Sets whether the gloss value and map are inverted, which makes the material treat them as
     * roughness. Setting `roughness` or `roughness-map` enables this automatically.
     * @param value - The gloss invert flag.
     */
    set glossInvert(value) {
        this._glossInvert = value;
        if (this.material) {
            this.material.glossInvert = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether the gloss value and map are inverted.
     * @returns The gloss invert flag.
     */
    get glossInvert() {
        return this._glossInvert;
    }
    /**
     * Sets the id of the `pc-asset` to use as the gloss map. See also `roughnessMap`.
     * @param value - The asset id.
     */
    set glossMap(value) {
        this._glossMap = value;
        this._setMap(value, 'glossMap');
    }
    /**
     * Gets the id of the `pc-asset` used as the gloss map.
     * @returns The asset id.
     */
    get glossMap() {
        return this._glossMap;
    }
    /**
     * Sets the color channel of the gloss map to sample.
     * @param value - The channel.
     */
    set glossMapChannel(value) {
        this._glossMapChannel = value;
        if (this.material) {
            this.material.glossMapChannel = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the color channel of the gloss map to sample.
     * @returns The channel.
     */
    get glossMapChannel() {
        return this._glossMapChannel;
    }
    /**
     * Sets the 2D offset of the gloss map.
     * @param value - The offset.
     */
    set glossMapOffset(value) {
        this._glossMapOffset = value;
        if (this.material) {
            this.material.glossMapOffset = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D offset of the gloss map.
     * @returns The offset.
     */
    get glossMapOffset() {
        return this._glossMapOffset;
    }
    /**
     * Sets the 2D rotation of the gloss map, in degrees.
     * @param value - The rotation.
     */
    set glossMapRotation(value) {
        this._glossMapRotation = value;
        if (this.material) {
            this.material.glossMapRotation = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D rotation of the gloss map.
     * @returns The rotation.
     */
    get glossMapRotation() {
        return this._glossMapRotation;
    }
    /**
     * Sets the 2D tiling of the gloss map.
     * @param value - The tiling.
     */
    set glossMapTiling(value) {
        this._glossMapTiling = value;
        if (this.material) {
            this.material.glossMapTiling = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D tiling of the gloss map.
     * @returns The tiling.
     */
    get glossMapTiling() {
        return this._glossMapTiling;
    }
    /**
     * Sets the UV channel the gloss map samples.
     * @param value - The UV channel.
     */
    set glossMapUv(value) {
        this._glossMapUv = value;
        if (this.material) {
            this.material.glossMapUv = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the UV channel the gloss map samples.
     * @returns The UV channel.
     */
    get glossMapUv() {
        return this._glossMapUv;
    }
    /**
     * Sets the id of the `pc-asset` to use as the height map, which drives parallax mapping.
     * @param value - The asset id.
     */
    set heightMap(value) {
        this._heightMap = value;
        this._setMap(value, 'heightMap');
    }
    /**
     * Gets the id of the `pc-asset` used as the height map.
     * @returns The asset id.
     */
    get heightMap() {
        return this._heightMap;
    }
    /**
     * Sets the color channel of the height map to sample.
     * @param value - The channel.
     */
    set heightMapChannel(value) {
        this._heightMapChannel = value;
        if (this.material) {
            this.material.heightMapChannel = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the color channel of the height map to sample.
     * @returns The channel.
     */
    get heightMapChannel() {
        return this._heightMapChannel;
    }
    /**
     * Sets the strength of the parallax effect driven by the height map.
     * @param value - The height map factor.
     */
    set heightMapFactor(value) {
        this._heightMapFactor = value;
        if (this.material) {
            this.material.heightMapFactor = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the strength of the parallax effect driven by the height map.
     * @returns The height map factor.
     */
    get heightMapFactor() {
        return this._heightMapFactor;
    }
    /**
     * Sets the 2D offset of the height map.
     * @param value - The offset.
     */
    set heightMapOffset(value) {
        this._heightMapOffset = value;
        if (this.material) {
            this.material.heightMapOffset = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D offset of the height map.
     * @returns The offset.
     */
    get heightMapOffset() {
        return this._heightMapOffset;
    }
    /**
     * Sets the 2D rotation of the height map, in degrees.
     * @param value - The rotation.
     */
    set heightMapRotation(value) {
        this._heightMapRotation = value;
        if (this.material) {
            this.material.heightMapRotation = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D rotation of the height map.
     * @returns The rotation.
     */
    get heightMapRotation() {
        return this._heightMapRotation;
    }
    /**
     * Sets the 2D tiling of the height map.
     * @param value - The tiling.
     */
    set heightMapTiling(value) {
        this._heightMapTiling = value;
        if (this.material) {
            this.material.heightMapTiling = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D tiling of the height map.
     * @returns The tiling.
     */
    get heightMapTiling() {
        return this._heightMapTiling;
    }
    /**
     * Sets the UV channel the height map samples.
     * @param value - The UV channel.
     */
    set heightMapUv(value) {
        this._heightMapUv = value;
        if (this.material) {
            this.material.heightMapUv = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the UV channel the height map samples.
     * @returns The UV channel.
     */
    get heightMapUv() {
        return this._heightMapUv;
    }
    /**
     * Sets how metallic the surface is, from 0 (dielectric) to 1 (metal).
     * @param value - The metalness.
     */
    set metalness(value) {
        this._metalness = value;
        if (this.material) {
            this.material.metalness = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets how metallic the surface is.
     * @returns The metalness.
     */
    get metalness() {
        return this._metalness;
    }
    /**
     * Sets the id of the `pc-asset` to use as the metalness map.
     * @param value - The asset id.
     */
    set metalnessMap(value) {
        this._metalnessMap = value;
        this._setMap(value, 'metalnessMap');
    }
    /**
     * Gets the id of the `pc-asset` used as the metalness map.
     * @returns The asset id.
     */
    get metalnessMap() {
        return this._metalnessMap;
    }
    /**
     * Sets the color channel of the metalness map to sample.
     * @param value - The channel.
     */
    set metalnessMapChannel(value) {
        this._metalnessMapChannel = value;
        if (this.material) {
            this.material.metalnessMapChannel = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the color channel of the metalness map to sample.
     * @returns The channel.
     */
    get metalnessMapChannel() {
        return this._metalnessMapChannel;
    }
    /**
     * Sets the 2D offset of the metalness map.
     * @param value - The offset.
     */
    set metalnessMapOffset(value) {
        this._metalnessMapOffset = value;
        if (this.material) {
            this.material.metalnessMapOffset = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D offset of the metalness map.
     * @returns The offset.
     */
    get metalnessMapOffset() {
        return this._metalnessMapOffset;
    }
    /**
     * Sets the 2D rotation of the metalness map, in degrees.
     * @param value - The rotation.
     */
    set metalnessMapRotation(value) {
        this._metalnessMapRotation = value;
        if (this.material) {
            this.material.metalnessMapRotation = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D rotation of the metalness map.
     * @returns The rotation.
     */
    get metalnessMapRotation() {
        return this._metalnessMapRotation;
    }
    /**
     * Sets the 2D tiling of the metalness map.
     * @param value - The tiling.
     */
    set metalnessMapTiling(value) {
        this._metalnessMapTiling = value;
        if (this.material) {
            this.material.metalnessMapTiling = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D tiling of the metalness map.
     * @returns The tiling.
     */
    get metalnessMapTiling() {
        return this._metalnessMapTiling;
    }
    /**
     * Sets the UV channel the metalness map samples.
     * @param value - The UV channel.
     */
    set metalnessMapUv(value) {
        this._metalnessMapUv = value;
        if (this.material) {
            this.material.metalnessMapUv = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the UV channel the metalness map samples.
     * @returns The UV channel.
     */
    get metalnessMapUv() {
        return this._metalnessMapUv;
    }
    /**
     * Sets the name of the material.
     * @param value - The material name.
     */
    set name(value) {
        this._name = value;
        if (this.material) {
            // A label rather than shader state, so no update() is scheduled
            this.material.name = value;
        }
    }
    /**
     * Gets the name of the material - the label shown wherever materials surface by name, such
     * as profilers, GPU captures and the assignments `pc-model.hierarchy()` reports. Purely a
     * label: element references resolve through `id`.
     * @returns The material name.
     */
    get name() {
        return this._name;
    }
    /**
     * Sets the id of the `pc-asset` to use as the normal map.
     * @param value - The asset id.
     */
    set normalMap(value) {
        this._normalMap = value;
        this._setMap(value, 'normalMap');
    }
    /**
     * Gets the id of the `pc-asset` used as the normal map.
     * @returns The asset id.
     */
    get normalMap() {
        return this._normalMap;
    }
    /**
     * Sets the 2D offset of the normal map.
     * @param value - The offset.
     */
    set normalMapOffset(value) {
        this._normalMapOffset = value;
        if (this.material) {
            this.material.normalMapOffset = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D offset of the normal map.
     * @returns The offset.
     */
    get normalMapOffset() {
        return this._normalMapOffset;
    }
    /**
     * Sets the 2D rotation of the normal map, in degrees.
     * @param value - The rotation.
     */
    set normalMapRotation(value) {
        this._normalMapRotation = value;
        if (this.material) {
            this.material.normalMapRotation = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D rotation of the normal map.
     * @returns The rotation.
     */
    get normalMapRotation() {
        return this._normalMapRotation;
    }
    /**
     * Sets the 2D tiling of the normal map.
     * @param value - The tiling.
     */
    set normalMapTiling(value) {
        this._normalMapTiling = value;
        if (this.material) {
            this.material.normalMapTiling = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D tiling of the normal map.
     * @returns The tiling.
     */
    get normalMapTiling() {
        return this._normalMapTiling;
    }
    /**
     * Sets the UV channel the normal map samples.
     * @param value - The UV channel.
     */
    set normalMapUv(value) {
        this._normalMapUv = value;
        if (this.material) {
            this.material.normalMapUv = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the UV channel the normal map samples.
     * @returns The UV channel.
     */
    get normalMapUv() {
        return this._normalMapUv;
    }
    /**
     * Sets whether ambient occlusion also attenuates direct lighting.
     * @param value - The occlude direct flag.
     */
    set occludeDirect(value) {
        this._occludeDirect = value;
        if (this.material) {
            // @ts-ignore see _createMaterial() - the engine mistypes occludeDirect as a number
            this.material.occludeDirect = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether ambient occlusion also attenuates direct lighting.
     * @returns The occlude direct flag.
     */
    get occludeDirect() {
        return this._occludeDirect;
    }
    /**
     * Sets how specular reflections are occluded.
     * @param value - The specular occlusion mode.
     */
    set occludeSpecular(value) {
        this._occludeSpecular = value;
        if (this.material) {
            this.material.occludeSpecular = occludeSpeculars.get(value) ?? SPECOCC_AO;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets how specular reflections are occluded.
     * @returns The specular occlusion mode.
     */
    get occludeSpecular() {
        return this._occludeSpecular;
    }
    /**
     * Sets the opacity of the material, from 0 (transparent) to 1 (opaque), which requires a
     * `blend-type` other than `none` to have any visible effect.
     * @param value - The opacity.
     */
    set opacity(value) {
        this._opacity = value;
        if (this.material) {
            this.material.opacity = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the opacity of the material, which requires a `blend-type` other than `none` to have
     * any visible effect.
     * @returns The opacity.
     */
    get opacity() {
        return this._opacity;
    }
    /**
     * Sets the dithering used to render opacity, which approximates transparency without blending.
     * @param value - The dither mode.
     */
    set opacityDither(value) {
        this._opacityDither = value;
        if (this.material) {
            this.material.opacityDither = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the dithering used to render opacity.
     * @returns The dither mode.
     */
    get opacityDither() {
        return this._opacityDither;
    }
    /**
     * Sets whether specular highlights fade out as the material becomes transparent.
     * @param value - The opacity fades specular flag.
     */
    set opacityFadesSpecular(value) {
        this._opacityFadesSpecular = value;
        if (this.material) {
            this.material.opacityFadesSpecular = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether specular highlights fade out as the material becomes transparent.
     * @returns The opacity fades specular flag.
     */
    get opacityFadesSpecular() {
        return this._opacityFadesSpecular;
    }
    /**
     * Sets the id of the `pc-asset` to use as the opacity map.
     * @param value - The asset id.
     */
    set opacityMap(value) {
        this._opacityMap = value;
        this._setMap(value, 'opacityMap');
    }
    /**
     * Gets the id of the `pc-asset` used as the opacity map.
     * @returns The asset id.
     */
    get opacityMap() {
        return this._opacityMap;
    }
    /**
     * Sets the color channel of the opacity map to sample.
     * @param value - The channel.
     */
    set opacityMapChannel(value) {
        this._opacityMapChannel = value;
        if (this.material) {
            this.material.opacityMapChannel = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the color channel of the opacity map to sample.
     * @returns The channel.
     */
    get opacityMapChannel() {
        return this._opacityMapChannel;
    }
    /**
     * Sets the 2D offset of the opacity map.
     * @param value - The offset.
     */
    set opacityMapOffset(value) {
        this._opacityMapOffset = value;
        if (this.material) {
            this.material.opacityMapOffset = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D offset of the opacity map.
     * @returns The offset.
     */
    get opacityMapOffset() {
        return this._opacityMapOffset;
    }
    /**
     * Sets the 2D rotation of the opacity map, in degrees.
     * @param value - The rotation.
     */
    set opacityMapRotation(value) {
        this._opacityMapRotation = value;
        if (this.material) {
            this.material.opacityMapRotation = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D rotation of the opacity map.
     * @returns The rotation.
     */
    get opacityMapRotation() {
        return this._opacityMapRotation;
    }
    /**
     * Sets the 2D tiling of the opacity map.
     * @param value - The tiling.
     */
    set opacityMapTiling(value) {
        this._opacityMapTiling = value;
        if (this.material) {
            this.material.opacityMapTiling = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the 2D tiling of the opacity map.
     * @returns The tiling.
     */
    get opacityMapTiling() {
        return this._opacityMapTiling;
    }
    /**
     * Sets the UV channel the opacity map samples.
     * @param value - The UV channel.
     */
    set opacityMapUv(value) {
        this._opacityMapUv = value;
        if (this.material) {
            this.material.opacityMapUv = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the UV channel the opacity map samples.
     * @returns The UV channel.
     */
    get opacityMapUv() {
        return this._opacityMapUv;
    }
    /**
     * Sets the roughness of the material, from 0 (shiny) to 1 (rough). This is an alias for `gloss`
     * that also inverts the gloss channel, so do not combine it with the `gloss` attributes.
     * @param value - The roughness.
     */
    set roughness(value) {
        this.gloss = value;
        this.glossInvert = true;
    }
    /**
     * Gets the roughness of the material.
     * @returns The roughness.
     */
    get roughness() {
        return this._gloss;
    }
    /**
     * Sets the id of the `pc-asset` to use as the roughness map. This is an alias for `glossMap`
     * that also inverts the gloss channel, so do not combine it with the `gloss` attributes.
     * @param value - The asset id.
     */
    set roughnessMap(value) {
        this.glossMap = value;
        this.glossInvert = true;
    }
    /**
     * Gets the id of the `pc-asset` used as the roughness map.
     * @returns The asset id.
     */
    get roughnessMap() {
        return this._glossMap;
    }
    /**
     * Sets the depth offset applied in proportion to a surface's slope, used to resolve z-fighting.
     * @param value - The slope depth bias.
     */
    set slopeDepthBias(value) {
        this._slopeDepthBias = value;
        if (this.material) {
            this.material.slopeDepthBias = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the depth offset applied in proportion to a surface's slope.
     * @returns The slope depth bias.
     */
    get slopeDepthBias() {
        return this._slopeDepthBias;
    }
    /**
     * Sets the specular color of the material, which applies only when the metalness workflow is
     * disabled or `use-metalness-specular-color` is enabled.
     * @param value - The specular color.
     */
    set specular(value) {
        this._specular = value;
        if (this.material) {
            this.material.specular = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the specular color of the material, which applies only when the metalness workflow is
     * disabled or `use-metalness-specular-color` is enabled.
     * @returns The specular color.
     */
    get specular() {
        return this._specular;
    }
    /**
     * Sets the strength of specular reflections at direct angles, from 0 to 1, which applies only
     * when `use-metalness-specular-color` is enabled.
     * @param value - The specularity factor.
     */
    set specularityFactor(value) {
        this._specularityFactor = value;
        if (this.material) {
            this.material.specularityFactor = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets the strength of specular reflections at direct angles, which applies only when
     * `use-metalness-specular-color` is enabled.
     * @returns The specularity factor.
     */
    get specularityFactor() {
        return this._specularityFactor;
    }
    /**
     * Sets whether back faces are lit as though their normals were flipped.
     * @param value - The two sided lighting flag.
     */
    set twoSidedLighting(value) {
        this._twoSidedLighting = value;
        if (this.material) {
            this.material.twoSidedLighting = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether back faces are lit as though their normals were flipped.
     * @returns The two sided lighting flag.
     */
    get twoSidedLighting() {
        return this._twoSidedLighting;
    }
    /**
     * Sets whether the material is affected by scene fog.
     * @param value - The use fog flag.
     */
    set useFog(value) {
        this._useFog = value;
        if (this.material) {
            this.material.useFog = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether the material is affected by scene fog.
     * @returns The use fog flag.
     */
    get useFog() {
        return this._useFog;
    }
    /**
     * Sets whether the material is affected by scene lights. When disabled the material renders
     * unlit, using the diffuse color and map alone.
     * @param value - The use lighting flag.
     */
    set useLighting(value) {
        this._useLighting = value;
        if (this.material) {
            this.material.useLighting = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether the material is affected by scene lights.
     * @returns The use lighting flag.
     */
    get useLighting() {
        return this._useLighting;
    }
    /**
     * Sets whether to use the metalness workflow rather than the older specular workflow. Unlike a
     * bare `StandardMaterial` this defaults to `true`, because the `metalness-*` attributes have no
     * effect without it.
     * @param value - The use metalness flag.
     */
    set useMetalness(value) {
        this._useMetalness = value;
        if (this.material) {
            this.material.useMetalness = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether to use the metalness workflow.
     * @returns The use metalness flag.
     */
    get useMetalness() {
        return this._useMetalness;
    }
    /**
     * Sets whether the specular color tints reflections while the metalness workflow is in use.
     * @param value - The use metalness specular color flag.
     */
    set useMetalnessSpecularColor(value) {
        this._useMetalnessSpecularColor = value;
        if (this.material) {
            this.material.useMetalnessSpecularColor = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether the specular color tints reflections while the metalness workflow is in use.
     * @returns The use metalness specular color flag.
     */
    get useMetalnessSpecularColor() {
        return this._useMetalnessSpecularColor;
    }
    /**
     * Sets whether the material is lit by the scene's skybox.
     * @param value - The use skybox flag.
     */
    set useSkybox(value) {
        this._useSkybox = value;
        if (this.material) {
            this.material.useSkybox = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether the material is lit by the scene's skybox.
     * @returns The use skybox flag.
     */
    get useSkybox() {
        return this._useSkybox;
    }
    /**
     * Sets whether the camera's tone mapping is applied to the material.
     * @param value - The use tonemap flag.
     */
    set useTonemap(value) {
        this._useTonemap = value;
        if (this.material) {
            this.material.useTonemap = value;
            this._scheduleUpdate();
        }
    }
    /**
     * Gets whether the camera's tone mapping is applied to the material.
     * @returns The use tonemap flag.
     */
    get useTonemap() {
        return this._useTonemap;
    }
    /**
     * Returns the {@link StandardMaterial} created by the `<pc-material>` element with the given
     * `id`, or `undefined` if there is no such element or its material has not been created yet.
     *
     * @param id - The `id` of the `<pc-material>` element.
     * @returns The material, or `undefined`.
     */
    static get(id) {
        const materialElement = document.querySelector(`pc-material[id="${id}"]`);
        return materialElement?.material;
    }
    static get observedAttributes() {
        return [
            'alpha-test',
            'alpha-to-coverage',
            'ao-intensity',
            'ao-map',
            'ao-map-channel',
            'ao-map-offset',
            'ao-map-rotation',
            'ao-map-tiling',
            'ao-map-uv',
            'blend-type',
            'bumpiness',
            'cull',
            'depth-bias',
            'depth-test',
            'depth-write',
            'diffuse',
            'diffuse-map',
            'diffuse-map-channel',
            'diffuse-map-offset',
            'diffuse-map-rotation',
            'diffuse-map-tiling',
            'diffuse-map-uv',
            'emissive',
            'emissive-intensity',
            'emissive-map',
            'emissive-map-channel',
            'emissive-map-offset',
            'emissive-map-rotation',
            'emissive-map-tiling',
            'emissive-map-uv',
            'enable-ggx-specular',
            'fresnel-model',
            'gloss',
            'gloss-invert',
            'gloss-map',
            'gloss-map-channel',
            'gloss-map-offset',
            'gloss-map-rotation',
            'gloss-map-tiling',
            'gloss-map-uv',
            'height-map',
            'height-map-channel',
            'height-map-factor',
            'height-map-offset',
            'height-map-rotation',
            'height-map-tiling',
            'height-map-uv',
            'metalness',
            'metalness-map',
            'metalness-map-channel',
            'metalness-map-offset',
            'metalness-map-rotation',
            'metalness-map-tiling',
            'metalness-map-uv',
            'name',
            'normal-map',
            'normal-map-offset',
            'normal-map-rotation',
            'normal-map-tiling',
            'normal-map-uv',
            'occlude-direct',
            'occlude-specular',
            'opacity',
            'opacity-dither',
            'opacity-fades-specular',
            'opacity-map',
            'opacity-map-channel',
            'opacity-map-offset',
            'opacity-map-rotation',
            'opacity-map-tiling',
            'opacity-map-uv',
            'roughness',
            'roughness-map',
            'slope-depth-bias',
            'specular',
            'specularity-factor',
            'two-sided-lighting',
            'use-fog',
            'use-lighting',
            'use-metalness',
            'use-metalness-specular-color',
            'use-skybox',
            'use-tonemap'
        ];
    }
    // newValue is null when an attribute is removed, which several branches below rely on. The
    // other elements still declare it as `string`; widening those surfaces 21 real removal bugs of
    // the #309 shape, which is its own change rather than a signature tweak.
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'alpha-test':
                this.alphaTest = parseNumber(newValue, 0, name);
                break;
            case 'alpha-to-coverage':
                this.alphaToCoverage = parseBool(newValue, false);
                break;
            case 'ao-intensity':
                this.aoIntensity = parseNumber(newValue, 1, name);
                break;
            case 'ao-map':
                this.aoMap = newValue ?? '';
                break;
            case 'ao-map-channel':
                this.aoMapChannel = parseEnum(newValue, scalarChannels, 'g', name);
                break;
            case 'ao-map-offset':
                this.aoMapOffset = parseVec2(newValue, new Vec2(0, 0), name);
                break;
            case 'ao-map-rotation':
                this.aoMapRotation = parseNumber(newValue, 0, name);
                break;
            case 'ao-map-tiling':
                this.aoMapTiling = parseVec2(newValue, new Vec2(1, 1), name);
                break;
            case 'ao-map-uv':
                this.aoMapUv = parseNumber(newValue, 0, name);
                break;
            case 'blend-type':
                this.blendType = parseEnum(newValue, blendTypes, 'none', name);
                break;
            case 'bumpiness':
                this.bumpiness = parseNumber(newValue, 1, name);
                break;
            case 'cull':
                this.cull = parseEnum(newValue, cullModes, 'back', name);
                break;
            case 'depth-bias':
                this.depthBias = parseNumber(newValue, 0, name);
                break;
            case 'depth-test':
                this.depthTest = parseBool(newValue, true);
                break;
            case 'depth-write':
                this.depthWrite = parseBool(newValue, true);
                break;
            case 'diffuse':
                this.diffuse = parseColor(newValue, new Color(1, 1, 1), name);
                break;
            case 'diffuse-map':
                this.diffuseMap = newValue ?? '';
                break;
            case 'diffuse-map-channel':
                this.diffuseMapChannel = parseEnum(newValue, colorChannels, 'rgb', name);
                break;
            case 'diffuse-map-offset':
                this.diffuseMapOffset = parseVec2(newValue, new Vec2(0, 0), name);
                break;
            case 'diffuse-map-rotation':
                this.diffuseMapRotation = parseNumber(newValue, 0, name);
                break;
            case 'diffuse-map-tiling':
                this.diffuseMapTiling = parseVec2(newValue, new Vec2(1, 1), name);
                break;
            case 'diffuse-map-uv':
                this.diffuseMapUv = parseNumber(newValue, 0, name);
                break;
            case 'emissive':
                this.emissive = parseColor(newValue, new Color(0, 0, 0), name);
                break;
            case 'emissive-intensity':
                this.emissiveIntensity = parseNumber(newValue, 1, name);
                break;
            case 'emissive-map':
                this.emissiveMap = newValue ?? '';
                break;
            case 'emissive-map-channel':
                this.emissiveMapChannel = parseEnum(newValue, colorChannels, 'rgb', name);
                break;
            case 'emissive-map-offset':
                this.emissiveMapOffset = parseVec2(newValue, new Vec2(0, 0), name);
                break;
            case 'emissive-map-rotation':
                this.emissiveMapRotation = parseNumber(newValue, 0, name);
                break;
            case 'emissive-map-tiling':
                this.emissiveMapTiling = parseVec2(newValue, new Vec2(1, 1), name);
                break;
            case 'emissive-map-uv':
                this.emissiveMapUv = parseNumber(newValue, 0, name);
                break;
            case 'enable-ggx-specular':
                this.enableGGXSpecular = parseBool(newValue, false);
                break;
            case 'fresnel-model':
                this.fresnelModel = parseEnum(newValue, fresnelModels, 'schlick', name);
                break;
            case 'gloss':
                this.gloss = parseNumber(newValue, 0.25, name);
                this._warnGlossConflict();
                break;
            case 'gloss-invert':
                this.glossInvert = parseBool(newValue, false);
                this._warnGlossConflict();
                break;
            case 'gloss-map':
                this.glossMap = newValue ?? '';
                this._warnGlossConflict();
                break;
            case 'gloss-map-channel':
                this.glossMapChannel = parseEnum(newValue, scalarChannels, 'g', name);
                break;
            case 'gloss-map-offset':
                this.glossMapOffset = parseVec2(newValue, new Vec2(0, 0), name);
                break;
            case 'gloss-map-rotation':
                this.glossMapRotation = parseNumber(newValue, 0, name);
                break;
            case 'gloss-map-tiling':
                this.glossMapTiling = parseVec2(newValue, new Vec2(1, 1), name);
                break;
            case 'gloss-map-uv':
                this.glossMapUv = parseNumber(newValue, 0, name);
                break;
            case 'height-map':
                this.heightMap = newValue ?? '';
                break;
            case 'height-map-channel':
                this.heightMapChannel = parseEnum(newValue, scalarChannels, 'g', name);
                break;
            case 'height-map-factor':
                this.heightMapFactor = parseNumber(newValue, 1, name);
                break;
            case 'height-map-offset':
                this.heightMapOffset = parseVec2(newValue, new Vec2(0, 0), name);
                break;
            case 'height-map-rotation':
                this.heightMapRotation = parseNumber(newValue, 0, name);
                break;
            case 'height-map-tiling':
                this.heightMapTiling = parseVec2(newValue, new Vec2(1, 1), name);
                break;
            case 'height-map-uv':
                this.heightMapUv = parseNumber(newValue, 0, name);
                break;
            case 'metalness':
                this.metalness = parseNumber(newValue, 0, name);
                break;
            case 'metalness-map':
                this.metalnessMap = newValue ?? '';
                break;
            case 'metalness-map-channel':
                this.metalnessMapChannel = parseEnum(newValue, scalarChannels, 'g', name);
                break;
            case 'metalness-map-offset':
                this.metalnessMapOffset = parseVec2(newValue, new Vec2(0, 0), name);
                break;
            case 'metalness-map-rotation':
                this.metalnessMapRotation = parseNumber(newValue, 0, name);
                break;
            case 'metalness-map-tiling':
                this.metalnessMapTiling = parseVec2(newValue, new Vec2(1, 1), name);
                break;
            case 'metalness-map-uv':
                this.metalnessMapUv = parseNumber(newValue, 0, name);
                break;
            case 'name':
                this.name = newValue ?? 'Untitled';
                break;
            case 'normal-map':
                this.normalMap = newValue ?? '';
                break;
            case 'normal-map-offset':
                this.normalMapOffset = parseVec2(newValue, new Vec2(0, 0), name);
                break;
            case 'normal-map-rotation':
                this.normalMapRotation = parseNumber(newValue, 0, name);
                break;
            case 'normal-map-tiling':
                this.normalMapTiling = parseVec2(newValue, new Vec2(1, 1), name);
                break;
            case 'normal-map-uv':
                this.normalMapUv = parseNumber(newValue, 0, name);
                break;
            case 'occlude-direct':
                this.occludeDirect = parseBool(newValue, false);
                break;
            case 'occlude-specular':
                this.occludeSpecular = parseEnum(newValue, occludeSpeculars, 'ao', name);
                break;
            case 'opacity':
                this.opacity = parseNumber(newValue, 1, name);
                break;
            case 'opacity-dither':
                this.opacityDither = parseEnum(newValue, opacityDithers, 'none', name);
                break;
            case 'opacity-fades-specular':
                this.opacityFadesSpecular = parseBool(newValue, true);
                break;
            case 'opacity-map':
                this.opacityMap = newValue ?? '';
                break;
            case 'opacity-map-channel':
                this.opacityMapChannel = parseEnum(newValue, scalarChannels, 'a', name);
                break;
            case 'opacity-map-offset':
                this.opacityMapOffset = parseVec2(newValue, new Vec2(0, 0), name);
                break;
            case 'opacity-map-rotation':
                this.opacityMapRotation = parseNumber(newValue, 0, name);
                break;
            case 'opacity-map-tiling':
                this.opacityMapTiling = parseVec2(newValue, new Vec2(1, 1), name);
                break;
            case 'opacity-map-uv':
                this.opacityMapUv = parseNumber(newValue, 0, name);
                break;
            case 'roughness':
                // Aliases gloss, and inverts it so the value reads as roughness. Removing the
                // attribute restores the engine's uninverted interpretation.
                this.gloss = parseNumber(newValue, 0.25, name);
                this.glossInvert = newValue !== null;
                this._warnGlossConflict();
                break;
            case 'roughness-map':
                this.glossMap = newValue ?? '';
                this.glossInvert = newValue !== null;
                this._warnGlossConflict();
                break;
            case 'slope-depth-bias':
                this.slopeDepthBias = parseNumber(newValue, 0, name);
                break;
            case 'specular':
                this.specular = parseColor(newValue, new Color(0, 0, 0), name);
                break;
            case 'specularity-factor':
                this.specularityFactor = parseNumber(newValue, 1, name);
                break;
            case 'two-sided-lighting':
                this.twoSidedLighting = parseBool(newValue, false);
                break;
            case 'use-fog':
                this.useFog = parseBool(newValue, true);
                break;
            case 'use-lighting':
                this.useLighting = parseBool(newValue, true);
                break;
            case 'use-metalness':
                this.useMetalness = parseBool(newValue, true);
                break;
            case 'use-metalness-specular-color':
                this.useMetalnessSpecularColor = parseBool(newValue, false);
                break;
            case 'use-skybox':
                this.useSkybox = parseBool(newValue, true);
                break;
            case 'use-tonemap':
                this.useTonemap = parseBool(newValue, true);
                break;
        }
    }
}
customElements.define('pc-material', MaterialElement);

/**
 * The RenderComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-render/ | `<pc-render>`} elements.
 * The RenderComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * This element renders one of the engine's built-in primitives, selected with `type` (defaulting
 * to `box`). It does not cover the engine's `asset` render type, since there is no way to supply
 * a render asset here — use `pc-model` for glTF content instead.
 *
 * @category Components
 */
class RenderComponentElement extends ComponentElement {
    _castShadows = true;
    _material = '';
    _receiveShadows = true;
    _type = 'box';
    /** @ignore */
    constructor() {
        super('render');
    }
    getInitialComponentData() {
        return {
            type: this._type,
            castShadows: this._castShadows,
            material: MaterialElement.get(this._material),
            receiveShadows: this._receiveShadows
        };
    }
    /**
     * Gets the underlying PlayCanvas render component.
     * @returns The render component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets the type of the render component.
     * @param value - The type.
     */
    set type(value) {
        this._type = value;
        if (this.component) {
            this.component.type = value;
        }
    }
    /**
     * Gets the type of the render component.
     * @returns The type.
     */
    get type() {
        return this._type;
    }
    /**
     * Sets the cast shadows flag of the render component.
     * @param value - The cast shadows flag.
     */
    set castShadows(value) {
        this._castShadows = value;
        if (this.component) {
            this.component.castShadows = value;
        }
    }
    /**
     * Gets the cast shadows flag of the render component.
     * @returns The cast shadows flag.
     */
    get castShadows() {
        return this._castShadows;
    }
    /**
     * Sets the material of the render component.
     * @param value - The id of the material asset to use.
     */
    set material(value) {
        this._material = value;
        const material = MaterialElement.get(value);
        // Guarded like every other reference attribute in the library. Assigning an unresolved
        // lookup used to write `undefined` straight through to every mesh instance, and the
        // engine's MeshInstance setter takes that literally - it clears the material and skips
        // the ref/transparency/key bookkeeping, leaving the mesh with no material at all.
        if (this.component && material) {
            this.component.material = material;
        }
    }
    /**
     * Gets the id of the material asset used by the render component.
     * @returns The id of the material asset.
     */
    get material() {
        return this._material;
    }
    /**
     * Sets the receive shadows flag of the render component.
     * @param value - The receive shadows flag.
     */
    set receiveShadows(value) {
        this._receiveShadows = value;
        if (this.component) {
            this.component.receiveShadows = value;
        }
    }
    /**
     * Gets the receive shadows flag of the render component.
     * @returns The receive shadows flag.
     */
    get receiveShadows() {
        return this._receiveShadows;
    }
    static get observedAttributes() {
        return [...super.observedAttributes, 'cast-shadows', 'material', 'receive-shadows', 'type'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'cast-shadows':
                this.castShadows = parseBool(newValue, true);
                break;
            case 'material':
                this.material = newValue ?? '';
                break;
            case 'receive-shadows':
                this.receiveShadows = parseBool(newValue, true);
                break;
            case 'type':
                this.type = parseEnum(newValue, ['box', 'capsule', 'cone', 'cylinder', 'plane', 'sphere'], 'box', name);
                break;
        }
    }
}
customElements.define('pc-render', RenderComponentElement);

/**
 * The RigidBodyComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-rigidbody/ | `<pc-rigidbody>`} elements.
 * The RigidBodyComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class RigidBodyComponentElement extends ComponentElement {
    /**
     * The angular damping of the rigidbody.
     */
    _angularDamping = 0;
    /**
     * The angular factor of the rigidbody.
     */
    _angularFactor = new Vec3(1, 1, 1);
    /**
     * The friction of the rigidbody.
     */
    _friction = 0.5;
    /**
     * The linear damping of the rigidbody.
     */
    _linearDamping = 0;
    /**
     * The linear factor of the rigidbody.
     */
    _linearFactor = new Vec3(1, 1, 1);
    /**
     * The mass of the rigidbody.
     */
    _mass = 1;
    /**
     * The restitution of the rigidbody.
     */
    _restitution = 0;
    /**
     * The rolling friction of the rigidbody.
     */
    _rollingFriction = 0;
    /**
     * The type of the rigidbody.
     */
    _type = 'static';
    /** @ignore */
    constructor() {
        super('rigidbody');
    }
    getInitialComponentData() {
        return {
            angularDamping: this._angularDamping,
            angularFactor: this._angularFactor,
            friction: this._friction,
            linearDamping: this._linearDamping,
            linearFactor: this._linearFactor,
            mass: this._mass,
            restitution: this._restitution,
            rollingFriction: this._rollingFriction,
            type: this._type
        };
    }
    /**
     * Gets the underlying PlayCanvas rigidbody component.
     * @returns The rigidbody component.
     */
    get component() {
        return super.component;
    }
    set angularDamping(value) {
        this._angularDamping = value;
        if (this.component) {
            this.component.angularDamping = value;
        }
    }
    get angularDamping() {
        return this._angularDamping;
    }
    set angularFactor(value) {
        this._angularFactor = value;
        if (this.component) {
            this.component.angularFactor = value;
        }
    }
    get angularFactor() {
        return this._angularFactor;
    }
    set friction(value) {
        this._friction = value;
        if (this.component) {
            this.component.friction = value;
        }
    }
    get friction() {
        return this._friction;
    }
    set linearDamping(value) {
        this._linearDamping = value;
        if (this.component) {
            this.component.linearDamping = value;
        }
    }
    get linearDamping() {
        return this._linearDamping;
    }
    set linearFactor(value) {
        this._linearFactor = value;
        if (this.component) {
            this.component.linearFactor = value;
        }
    }
    get linearFactor() {
        return this._linearFactor;
    }
    set mass(value) {
        this._mass = value;
        if (this.component) {
            this.component.mass = value;
        }
    }
    get mass() {
        return this._mass;
    }
    set restitution(value) {
        this._restitution = value;
        if (this.component) {
            this.component.restitution = value;
        }
    }
    get restitution() {
        return this._restitution;
    }
    set rollingFriction(value) {
        this._rollingFriction = value;
        if (this.component) {
            this.component.rollingFriction = value;
        }
    }
    get rollingFriction() {
        return this._rollingFriction;
    }
    set type(value) {
        this._type = value;
        if (this.component) {
            this.component.type = value;
        }
    }
    get type() {
        return this._type;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'angular-damping',
            'angular-factor',
            'friction',
            'linear-damping',
            'linear-factor',
            'mass',
            'restitution',
            'rolling-friction',
            'type'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'angular-damping':
                this.angularDamping = parseNumber(newValue, 0, name);
                break;
            case 'angular-factor':
                this.angularFactor = parseVec3(newValue, Vec3.ONE, name);
                break;
            case 'friction':
                this.friction = parseNumber(newValue, 0.5, name);
                break;
            case 'linear-damping':
                this.linearDamping = parseNumber(newValue, 0, name);
                break;
            case 'linear-factor':
                this.linearFactor = parseVec3(newValue, Vec3.ONE, name);
                break;
            case 'mass':
                this.mass = parseNumber(newValue, 1, name);
                break;
            case 'restitution':
                this.restitution = parseNumber(newValue, 0, name);
                break;
            case 'rolling-friction':
                this.rollingFriction = parseNumber(newValue, 0, name);
                break;
            case 'type':
                this.type = parseEnum(newValue, ['static', 'dynamic', 'kinematic'], 'static', name);
                break;
        }
    }
}
customElements.define('pc-rigidbody', RigidBodyComponentElement);

// The engine's SCALEMODE_* constants are the strings 'none' and 'blend', so this map happens to be
// an identity. It is still the right shape: it supplies parseEnum's valid-name list, it is what the
// manifest generator reads the enum values from, and it keeps the attribute vocabulary independent
// of constants the engine is free to change.
const scaleModes = new Map([
    ['none', SCALEMODE_NONE],
    ['blend', SCALEMODE_BLEND]
]);
/**
 * The ScreenComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-screen/ | `<pc-screen>`} elements.
 * The ScreenComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class ScreenComponentElement extends ComponentElement {
    _screenSpace = false;
    _resolution = new Vec2(640, 320);
    _referenceResolution = new Vec2(640, 320);
    _priority = 0;
    _scaleMode = 'none';
    _scaleBlend = 0.5;
    /** @ignore */
    constructor() {
        super('screen');
    }
    getInitialComponentData() {
        return {
            priority: this._priority,
            referenceResolution: this._referenceResolution,
            resolution: this._resolution,
            scaleBlend: this._scaleBlend,
            scaleMode: scaleModes.get(this._scaleMode) ?? SCALEMODE_NONE,
            screenSpace: this._screenSpace
        };
    }
    /**
     * Gets the underlying PlayCanvas screen component.
     * @returns The screen component.
     */
    get component() {
        return super.component;
    }
    set priority(value) {
        this._priority = value;
        if (this.component) {
            this.component.priority = this._priority;
        }
    }
    get priority() {
        return this._priority;
    }
    set referenceResolution(value) {
        this._referenceResolution = value;
        if (this.component) {
            this.component.referenceResolution = this._referenceResolution;
        }
    }
    get referenceResolution() {
        return this._referenceResolution;
    }
    set resolution(value) {
        this._resolution = value;
        if (this.component) {
            this.component.resolution = this._resolution;
        }
    }
    get resolution() {
        return this._resolution;
    }
    /**
     * Sets how the screen's `resolution` and `referenceResolution` are weighted against each other
     * when `scaleMode` is `blend`, from 0 (follow the resolution) to 1 (follow the reference
     * resolution). Ignored while `scaleMode` is `none`.
     * @param value - The scale blend factor.
     */
    set scaleBlend(value) {
        this._scaleBlend = value;
        if (this.component) {
            this.component.scaleBlend = this._scaleBlend;
        }
    }
    /**
     * Gets how the screen's resolutions are weighted against each other.
     * @returns The scale blend factor.
     */
    get scaleBlend() {
        return this._scaleBlend;
    }
    /**
     * Sets how the screen scales its contents. `none` renders at `resolution` and ignores
     * `referenceResolution`; `blend` scales between the two, weighted by `scaleBlend`, which is what
     * keeps a UI laid out at one resolution usable at another. Requires `screenSpace` - the engine
     * forces `none` on a world-space screen, which does not support scaling.
     * @param value - The scale mode ('none' or 'blend').
     */
    set scaleMode(value) {
        this._scaleMode = value;
        if (this.component) {
            this.component.scaleMode = scaleModes.get(value) ?? SCALEMODE_NONE;
        }
    }
    /**
     * Gets how the screen scales its contents.
     * @returns The scale mode.
     */
    get scaleMode() {
        return this._scaleMode;
    }
    set screenSpace(value) {
        this._screenSpace = value;
        if (this.component) {
            this.component.screenSpace = this._screenSpace;
        }
    }
    get screenSpace() {
        return this._screenSpace;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'screen-space',
            'resolution',
            'reference-resolution',
            'priority',
            'scale-blend',
            'scale-mode'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'priority':
                this.priority = parseNumber(newValue, 0, name);
                break;
            case 'reference-resolution':
                this.referenceResolution = parseVec2(newValue, new Vec2(640, 320), name);
                break;
            case 'resolution':
                this.resolution = parseVec2(newValue, new Vec2(640, 320), name);
                break;
            case 'scale-blend':
                this.scaleBlend = parseNumber(newValue, 0.5, name);
                break;
            case 'scale-mode':
                this.scaleMode = parseEnum(newValue, scaleModes, 'none', name);
                break;
            case 'screen-space':
                this.screenSpace = parseBool(newValue, false);
                break;
        }
    }
}
customElements.define('pc-screen', ScreenComponentElement);

const orientations = new Map([
    ['horizontal', ORIENTATION_HORIZONTAL],
    ['vertical', ORIENTATION_VERTICAL]
]);
/**
 * The ScrollbarComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-scrollbar/ | `<pc-scrollbar>`} elements.
 * The ScrollbarComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class ScrollbarComponentElement extends ComponentElement {
    _orientation = 'horizontal';
    _value = 0;
    _handleSize = 0.5;
    _handle = '';
    /** @ignore */
    constructor() {
        super('scrollbar');
    }
    getInitialComponentData() {
        const data = {
            orientation: orientations.get(this._orientation),
            value: this._value,
            handleSize: this._handleSize
        };
        const handle = getEntity(this._handle);
        if (handle) {
            data.handleEntity = handle;
        }
        return data;
    }
    /**
     * Gets the underlying PlayCanvas scrollbar component.
     * @returns The scrollbar component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets the orientation of the scrollbar. Can be `horizontal` or `vertical`. Defaults to
     * `horizontal`.
     * @param value - The orientation.
     */
    set orientation(value) {
        this._orientation = value;
        if (this.component) {
            this.component.orientation = orientations.get(value) ?? ORIENTATION_HORIZONTAL;
        }
    }
    /**
     * Gets the orientation of the scrollbar.
     * @returns The orientation.
     */
    get orientation() {
        return this._orientation;
    }
    /**
     * Sets the current position value of the scrollbar, in the range 0 to 1.
     * @param value - The scrollbar value.
     */
    set value(value) {
        this._value = value;
        if (this.component) {
            this.component.value = value;
        }
    }
    /**
     * Gets the current position value of the scrollbar.
     * @returns The scrollbar value.
     */
    get value() {
        return this._value;
    }
    /**
     * Sets the size of the handle relative to the size of the track, in the range 0 to 1.
     * @param value - The handle size.
     */
    set handleSize(value) {
        this._handleSize = value;
        if (this.component) {
            this.component.handleSize = value;
        }
    }
    /**
     * Gets the size of the handle relative to the size of the track.
     * @returns The handle size.
     */
    get handleSize() {
        return this._handleSize;
    }
    /**
     * Sets the reference (CSS selector, element id or entity name) to the `<pc-entity>` used as the
     * scrollbar handle.
     * @param value - The handle entity reference.
     */
    set handle(value) {
        this._handle = value;
        const entity = getEntity(value);
        if (this.component && entity) {
            this.component.handleEntity = entity;
        }
    }
    /**
     * Gets the reference to the `<pc-entity>` used as the scrollbar handle.
     * @returns The handle entity reference.
     */
    get handle() {
        return this._handle;
    }
    static get observedAttributes() {
        return [...super.observedAttributes, 'orientation', 'value', 'handle-size', 'handle'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'orientation':
                this.orientation = parseEnum(newValue, orientations, 'horizontal', name);
                break;
            case 'value':
                this.value = parseNumber(newValue, 0, name);
                break;
            case 'handle-size':
                this.handleSize = parseNumber(newValue, 0.5, name);
                break;
            case 'handle':
                this.handle = newValue ?? '';
                break;
        }
    }
}
customElements.define('pc-scrollbar', ScrollbarComponentElement);

const scrollModes = new Map([
    ['clamp', SCROLL_MODE_CLAMP],
    ['bounce', SCROLL_MODE_BOUNCE],
    ['infinite', SCROLL_MODE_INFINITE]
]);
const visibilities = new Map([
    ['always', SCROLLBAR_VISIBILITY_SHOW_ALWAYS],
    ['when-required', SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED]
]);
/**
 * The ScrollViewComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-scrollview/ | `<pc-scrollview>`} elements.
 * The ScrollViewComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class ScrollViewComponentElement extends ComponentElement {
    _horizontal = true;
    _vertical = true;
    _scrollMode = 'bounce';
    _bounceAmount = 0.1;
    _friction = 0.05;
    _useMouseWheel = true;
    _mouseWheelSensitivity = new Vec2(1, 1);
    _horizontalScrollbarVisibility = 'when-required';
    _verticalScrollbarVisibility = 'when-required';
    _viewport = '';
    _content = '';
    _horizontalScrollbar = '';
    _verticalScrollbar = '';
    /** @ignore */
    constructor() {
        super('scrollview');
    }
    getInitialComponentData() {
        const data = {
            horizontal: this._horizontal,
            vertical: this._vertical,
            scrollMode: scrollModes.get(this._scrollMode),
            bounceAmount: this._bounceAmount,
            friction: this._friction,
            useMouseWheel: this._useMouseWheel,
            mouseWheelSensitivity: this._mouseWheelSensitivity,
            horizontalScrollbarVisibility: visibilities.get(this._horizontalScrollbarVisibility),
            verticalScrollbarVisibility: visibilities.get(this._verticalScrollbarVisibility)
        };
        const viewport = getEntity(this._viewport);
        if (viewport) {
            data.viewportEntity = viewport;
        }
        const content = getEntity(this._content);
        if (content) {
            data.contentEntity = content;
        }
        const horizontalScrollbar = getEntity(this._horizontalScrollbar);
        if (horizontalScrollbar) {
            data.horizontalScrollbarEntity = horizontalScrollbar;
        }
        const verticalScrollbar = getEntity(this._verticalScrollbar);
        if (verticalScrollbar) {
            data.verticalScrollbarEntity = verticalScrollbar;
        }
        return data;
    }
    /**
     * Gets the underlying PlayCanvas scroll view component.
     * @returns The scroll view component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets whether scrolling along the horizontal axis is enabled. This is a toggle, unlike the
     * `orientation` of a `<pc-scrollbar>`, for which `horizontal` is one of the accepted values.
     * @param value - Whether horizontal scrolling is enabled.
     */
    set horizontal(value) {
        this._horizontal = value;
        if (this.component) {
            this.component.horizontal = value;
        }
    }
    /**
     * Gets whether scrolling along the horizontal axis is enabled.
     * @returns Whether horizontal scrolling is enabled.
     */
    get horizontal() {
        return this._horizontal;
    }
    /**
     * Sets whether scrolling along the vertical axis is enabled. This is a toggle, unlike the
     * `orientation` of a `<pc-scrollbar>`, for which `vertical` is one of the accepted values.
     * @param value - Whether vertical scrolling is enabled.
     */
    set vertical(value) {
        this._vertical = value;
        if (this.component) {
            this.component.vertical = value;
        }
    }
    /**
     * Gets whether scrolling along the vertical axis is enabled.
     * @returns Whether vertical scrolling is enabled.
     */
    get vertical() {
        return this._vertical;
    }
    /**
     * Sets how the scroll view should behave when the content is scrolled beyond its bounds. Can be
     * `clamp`, `bounce` or `infinite`. Defaults to `bounce`.
     * @param value - The scroll mode.
     */
    set scrollMode(value) {
        this._scrollMode = value;
        if (this.component) {
            this.component.scrollMode = scrollModes.get(value) ?? SCROLL_MODE_BOUNCE;
        }
    }
    /**
     * Gets how the scroll view behaves when the content is scrolled beyond its bounds.
     * @returns The scroll mode.
     */
    get scrollMode() {
        return this._scrollMode;
    }
    /**
     * Sets how far the content is allowed to bounce beyond its bounds when `scroll-mode` is
     * `bounce`, in the range 0 to 1.
     * @param value - The bounce amount.
     */
    set bounceAmount(value) {
        this._bounceAmount = value;
        if (this.component) {
            this.component.bounceAmount = value;
        }
    }
    /**
     * Gets the bounce amount.
     * @returns The bounce amount.
     */
    get bounceAmount() {
        return this._bounceAmount;
    }
    /**
     * Sets how freely the content moves once thrown, in the range 0 (no friction) to 1.
     * @param value - The friction.
     */
    set friction(value) {
        this._friction = value;
        if (this.component) {
            this.component.friction = value;
        }
    }
    /**
     * Gets the friction.
     * @returns The friction.
     */
    get friction() {
        return this._friction;
    }
    /**
     * Sets whether the scroll view responds to mouse wheel events.
     * @param value - Whether to use the mouse wheel.
     */
    set useMouseWheel(value) {
        this._useMouseWheel = value;
        if (this.component) {
            this.component.useMouseWheel = value;
        }
    }
    /**
     * Gets whether the scroll view responds to mouse wheel events.
     * @returns Whether the mouse wheel is used.
     */
    get useMouseWheel() {
        return this._useMouseWheel;
    }
    /**
     * Sets the mouse wheel sensitivity as a Vec2 (horizontal, vertical). A value of 0 on an axis
     * disables mouse wheel scrolling for that axis.
     * @param value - The mouse wheel sensitivity.
     */
    set mouseWheelSensitivity(value) {
        this._mouseWheelSensitivity = value;
        if (this.component) {
            this.component.mouseWheelSensitivity = value;
        }
    }
    /**
     * Gets the mouse wheel sensitivity.
     * @returns The mouse wheel sensitivity.
     */
    get mouseWheelSensitivity() {
        return this._mouseWheelSensitivity;
    }
    /**
     * Sets the visibility of the horizontal scrollbar. Can be `always` or `when-required`.
     * Defaults to `when-required`.
     * @param value - The horizontal scrollbar visibility.
     */
    set horizontalScrollbarVisibility(value) {
        this._horizontalScrollbarVisibility = value;
        if (this.component) {
            this.component.horizontalScrollbarVisibility =
                visibilities.get(value) ?? SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED;
        }
    }
    /**
     * Gets the visibility of the horizontal scrollbar.
     * @returns The horizontal scrollbar visibility.
     */
    get horizontalScrollbarVisibility() {
        return this._horizontalScrollbarVisibility;
    }
    /**
     * Sets the visibility of the vertical scrollbar. Can be `always` or `when-required`.
     * Defaults to `when-required`.
     * @param value - The vertical scrollbar visibility.
     */
    set verticalScrollbarVisibility(value) {
        this._verticalScrollbarVisibility = value;
        if (this.component) {
            this.component.verticalScrollbarVisibility =
                visibilities.get(value) ?? SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED;
        }
    }
    /**
     * Gets the visibility of the vertical scrollbar.
     * @returns The vertical scrollbar visibility.
     */
    get verticalScrollbarVisibility() {
        return this._verticalScrollbarVisibility;
    }
    /**
     * Sets the reference (CSS selector, element id or entity name) to the `<pc-entity>` used as the
     * viewport, which clips the content to the scroll view's bounds.
     * @param value - The viewport entity reference.
     */
    set viewport(value) {
        this._viewport = value;
        const entity = getEntity(value);
        if (this.component && entity) {
            this.component.viewportEntity = entity;
        }
    }
    /**
     * Gets the reference to the `<pc-entity>` used as the viewport.
     * @returns The viewport entity reference.
     */
    get viewport() {
        return this._viewport;
    }
    /**
     * Sets the reference (CSS selector, element id or entity name) to the `<pc-entity>` used as the
     * content, which is moved as the scroll view is scrolled.
     * @param value - The content entity reference.
     */
    set content(value) {
        this._content = value;
        const entity = getEntity(value);
        if (this.component && entity) {
            this.component.contentEntity = entity;
        }
    }
    /**
     * Gets the reference to the `<pc-entity>` used as the content.
     * @returns The content entity reference.
     */
    get content() {
        return this._content;
    }
    /**
     * Sets the reference (CSS selector, element id or entity name) to the `<pc-entity>` containing
     * the horizontal `<pc-scrollbar>`.
     * @param value - The horizontal scrollbar entity reference.
     */
    set horizontalScrollbar(value) {
        this._horizontalScrollbar = value;
        const entity = getEntity(value);
        if (this.component && entity) {
            this.component.horizontalScrollbarEntity = entity;
        }
    }
    /**
     * Gets the reference to the `<pc-entity>` containing the horizontal scrollbar.
     * @returns The horizontal scrollbar entity reference.
     */
    get horizontalScrollbar() {
        return this._horizontalScrollbar;
    }
    /**
     * Sets the reference (CSS selector, element id or entity name) to the `<pc-entity>` containing
     * the vertical `<pc-scrollbar>`.
     * @param value - The vertical scrollbar entity reference.
     */
    set verticalScrollbar(value) {
        this._verticalScrollbar = value;
        const entity = getEntity(value);
        if (this.component && entity) {
            this.component.verticalScrollbarEntity = entity;
        }
    }
    /**
     * Gets the reference to the `<pc-entity>` containing the vertical scrollbar.
     * @returns The vertical scrollbar entity reference.
     */
    get verticalScrollbar() {
        return this._verticalScrollbar;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'horizontal',
            'vertical',
            'scroll-mode',
            'bounce-amount',
            'friction',
            'use-mouse-wheel',
            'mouse-wheel-sensitivity',
            'horizontal-scrollbar-visibility',
            'vertical-scrollbar-visibility',
            'viewport',
            'content',
            'horizontal-scrollbar',
            'vertical-scrollbar'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'horizontal':
                this.horizontal = parseBool(newValue, true);
                break;
            case 'vertical':
                this.vertical = parseBool(newValue, true);
                break;
            case 'scroll-mode':
                this.scrollMode = parseEnum(newValue, scrollModes, 'bounce', name);
                break;
            case 'bounce-amount':
                this.bounceAmount = parseNumber(newValue, 0.1, name);
                break;
            case 'friction':
                this.friction = parseNumber(newValue, 0.05, name);
                break;
            case 'use-mouse-wheel':
                this.useMouseWheel = parseBool(newValue, true);
                break;
            case 'mouse-wheel-sensitivity':
                this.mouseWheelSensitivity = parseVec2(newValue, Vec2.ONE, name);
                break;
            case 'horizontal-scrollbar-visibility':
                this.horizontalScrollbarVisibility = parseEnum(newValue, visibilities, 'when-required', name);
                break;
            case 'vertical-scrollbar-visibility':
                this.verticalScrollbarVisibility = parseEnum(newValue, visibilities, 'when-required', name);
                break;
            case 'viewport':
                this.viewport = newValue ?? '';
                break;
            case 'content':
                this.content = newValue ?? '';
                break;
            case 'horizontal-scrollbar':
                this.horizontalScrollbar = newValue ?? '';
                break;
            case 'vertical-scrollbar':
                this.verticalScrollbar = newValue ?? '';
                break;
        }
    }
}
customElements.define('pc-scrollview', ScrollViewComponentElement);

/**
 * The ScriptElement interface provides properties and methods for manipulating
 * `<pc-script>` elements. The ScriptElement interface also inherits the properties and
 * methods of the {@link AsyncElement} interface.
 *
 * Script attributes can be supplied through two channels:
 *
 * - **Per-property attributes**: any non-reserved attribute on the element maps to the script
 *   attribute of the same name (kebab-case to camelCase, e.g. `focus-point` → `focusPoint`).
 *   Values are parsed according to the type of the attribute's current value — initially the
 *   script's declared default (numbers, booleans, strings, Vec2/3/4, Color, Quat as Euler
 *   angles) — and the `asset:`/`entity:`/`vec2:`/`vec3:`/`vec4:`/`color:` prefixes may be used
 *   to be explicit.
 * - **The `attributes` JSON attribute**: an object supporting nested structures and attribute
 *   names that collide with reserved HTML attribute names (e.g. `title`).
 *
 * When both specify the same attribute, the per-property attribute wins — at creation and
 * whenever either channel changes at runtime. The element's own `name` and `enabled`
 * attributes configure the element itself and are not script attributes.
 *
 * Changing `name` on a live element destroys the old-name script instance and creates the
 * new-name one, re-applying both attribute channels to it.
 *
 * The element becomes ready once its script instance has been created by the parent
 * `<pc-scripts>` element.
 *
 * @fires {CustomEvent} scriptattributeschange - Fired when the script's attributes change. The
 * `detail` carries the new `attributes` object. Bubbles.
 * @fires {CustomEvent} scriptenablechange - Fired when the script's enabled state changes. The
 * `detail` carries the new `enabled` state. Bubbles.
 * @fires {CustomEvent} scriptnamechange - Fired when the script is renamed on a live element. The
 * `detail` carries `oldName` and `newName`. Bubbles.
 */
class ScriptElement extends AsyncElement {
    _attributes = {};
    _enabled = true;
    /**
     * The Script instance created for this element by its parent `<pc-scripts>` element.
     * @internal
     */
    _script = null;
    /**
     * Sets the attributes of the script as an object. Values are converted with the same rules
     * as the `attributes` attribute: `asset:`/`entity:` references and `vec2:`/`vec3:`/`vec4:`/
     * `color:` prefixed strings are resolved, and a plain numeric array is converted to the
     * type of the attribute it targets when that attribute currently holds a Vec2, Vec3, Vec4
     * or Color.
     * @param value - The attributes of the script.
     */
    set scriptAttributes(value) {
        this._attributes = value ?? {};
        this.dispatchEvent(new CustomEvent('scriptattributeschange', {
            detail: { attributes: this._attributes },
            bubbles: true
        }));
    }
    /**
     * Gets the attributes of the script.
     * @returns The attributes of the script.
     */
    get scriptAttributes() {
        return this._attributes;
    }
    /**
     * Sets the enabled state of the script.
     * @param value - The enabled state of the script.
     */
    set enabled(value) {
        this._enabled = value;
        this.dispatchEvent(new CustomEvent('scriptenablechange', {
            detail: { enabled: value },
            bubbles: true
        }));
    }
    /**
     * Gets the enabled state of the script.
     * @returns The enabled state of the script.
     */
    get enabled() {
        return this._enabled;
    }
    /**
     * Sets the name of the script to create. The `name` attribute is the single source of truth
     * (it is what the parent `<pc-scripts>` element reads when creating the instance), so the
     * property writes through to it — assigning before insertion works as expected:
     *
     * ```js
     * const script = document.createElement('pc-script');
     * script.name = 'rotate';
     * scriptsElement.appendChild(script);
     * await script.ready();
     * ```
     * @param value - The name.
     */
    set name(value) {
        this.setAttribute('name', value);
    }
    /**
     * Gets the name of the script.
     * @returns The name.
     */
    get name() {
        return this.getAttribute('name') ?? '';
    }
    /**
     * Gets the {@link Script} instance created for this element. Returns `null` until the
     * instance exists — await {@link whenReady} or the element's `ready()` promise before
     * accessing it.
     * @returns The script instance, or `null`.
     */
    get script() {
        return this._script;
    }
    connectedCallback() {
        // Script instances are created by the parent pc-scripts element, so an element placed
        // anywhere else is inert and never becomes ready - warn rather than hang silently
        if (this.parentElement?.tagName !== 'PC-SCRIPTS') {
            console.warn(`pc-script '${this.getAttribute('name')}' must be a direct child of pc-scripts - script not created`);
        }
    }
    disconnectedCallback() {
        // Re-arm readiness so a re-inserted element announces the instance created for it then.
        // `_script` is deliberately NOT cleared here: the parent's mutation observer processes
        // this removal afterwards and reads it to establish which engine script this element
        // owned - the parent is what clears it.
        this._resetReady();
    }
    /**
     * Called by the parent `<pc-scripts>` element when the script instance has been created.
     * Creation can happen more than once per connection (a runtime `name` change recreates the
     * instance), but `_onReady` signals readiness at most once per cycle.
     * @internal
     */
    _onScriptCreated() {
        this._onReady();
    }
    static get observedAttributes() {
        return ['attributes', 'enabled', 'name'];
    }
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'attributes':
                if (newValue === null) {
                    this.scriptAttributes = {};
                    break;
                }
                try {
                    this.scriptAttributes = JSON.parse(newValue);
                }
                catch (error) {
                    console.warn(`Invalid 'attributes' JSON on pc-script '${this.getAttribute('name')}': ${error.message}`);
                }
                break;
            case 'enabled':
                this.enabled = parseBool(newValue, true);
                break;
            case 'name':
                // The first set is handled by the parent's creation paths (the boot query and
                // the added-node mutation), so only a genuine rename is signalled here. Note
                // that setAttribute fires this callback even when the value is unchanged.
                if (oldValue !== null && oldValue !== newValue) {
                    this.dispatchEvent(new CustomEvent('scriptnamechange', {
                        detail: { oldName: oldValue, newName: newValue },
                        bubbles: true
                    }));
                }
                break;
        }
    }
}
customElements.define('pc-script', ScriptElement);

/**
 * Attributes on `pc-script` that never map to script attributes: the element's own API (derived
 * from its observed attributes) plus reserved and global HTML attribute names.
 */
const RESERVED_ATTRIBUTES = new Set([
    ...ScriptElement.observedAttributes,
    'accesskey',
    'autocapitalize',
    'autofocus',
    'class',
    'contenteditable',
    'dir',
    'draggable',
    'exportparts',
    'hidden',
    'id',
    'inert',
    'is',
    'itemid',
    'itemprop',
    'itemref',
    'itemscope',
    'itemtype',
    'lang',
    'nonce',
    'part',
    'popover',
    'role',
    'slot',
    'spellcheck',
    'style',
    'tabindex',
    'title',
    'translate'
]);
/**
 * Checks whether a `pc-script` attribute name is reserved (and so never maps to a script
 * attribute). Reserved names are the element's own API, global HTML attribute names, `data-*`
 * and `aria-*` attributes, names starting with `_` (framework-stamped attributes), and real
 * inline event handler names (`onclick` etc. — detected via the platform, so script attributes
 * that merely start with 'on', like `once`, still map).
 * @param name - The attribute name.
 * @returns Whether the attribute name is reserved.
 */
const isReservedAttribute = (name) => {
    return (RESERVED_ATTRIBUTES.has(name) ||
        name.startsWith('data-') ||
        name.startsWith('aria-') ||
        name.startsWith('_') ||
        (name.startsWith('on') && name in HTMLElement.prototype));
};
/**
 * Script API members that per-property attributes must never overwrite: the engine bindings and
 * the (optional, so possibly undefined) lifecycle methods.
 */
const SCRIPT_API_MEMBERS = new Set([
    'app',
    'entity',
    'destroy',
    'initialize',
    'postInitialize',
    'postUpdate',
    'swap',
    'update'
]);
/**
 * Converts a kebab-case attribute name to the camelCase script attribute name.
 * @param name - The attribute name.
 * @returns The camelCase name.
 */
const kebabToCamel = (name) => {
    return name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
};
/**
 * Converts a camelCase script attribute name to its kebab-case attribute spelling.
 * @param name - The camelCase name.
 * @returns The kebab-case name.
 */
const camelToKebab = (name) => {
    return name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
};
/**
 * Resolves an `asset:` prefix to the Asset created by the `pc-asset` element with that id.
 * @param rest - The asset id.
 * @param raw - The raw value, returned unchanged when the id does not resolve.
 * @returns The asset, or `raw`.
 */
const assetConversion = (rest, raw) => {
    const asset = useAsset(rest);
    if (asset) {
        return asset;
    }
    console.warn(`Unable to resolve '${raw}' in script attributes - no pc-asset found with id '${rest}'.`);
    return raw;
};
/**
 * Resolves an `entity:` prefix to the Entity backing a `pc-entity` element. The reference can be a
 * CSS selector, an element id or an entity name.
 * @param rest - The entity reference.
 * @param raw - The raw value, returned unchanged when the reference does not resolve.
 * @returns The entity, or `raw`.
 */
const entityConversion = (rest, raw) => {
    const entity = getEntity(rest);
    if (entity) {
        return entity;
    }
    console.warn(`Unable to resolve '${raw}' in script attributes - no pc-entity found matching '${rest}'.`);
    return raw;
};
/**
 * Builds the conversion for a `vec2:`/`vec3:`/`vec4:` prefix.
 * @param length - The number of components the prefix carries.
 * @param Ctor - The vector type to construct.
 * @returns The conversion.
 */
const vectorConversion = (length, Ctor) => {
    return (rest, raw) => {
        const components = parseComponents(rest, length);
        if (components) {
            return new Ctor(components);
        }
        console.warn(`Invalid script attribute value '${raw}'. Expected ${length} space-separated numbers after 'vec${length}:'.`);
        return raw;
    };
};
/**
 * Converts a `color:` prefix to a Color, accepting 3 or 4 components.
 * @param rest - The space-separated components.
 * @param raw - The raw value, returned unchanged when the components do not parse.
 * @returns The color, or `raw`.
 */
const colorConversion = (rest, raw) => {
    const components = parseComponents(rest, 4) ?? parseComponents(rest, 3);
    if (components) {
        return new Color(components);
    }
    console.warn(`Invalid script attribute value '${raw}'. Expected 3 or 4 space-separated numbers after 'color:'.`);
    return raw;
};
/**
 * The conversion prefixes recognized in script attribute values, mapped to the conversion each
 * performs. These keys are the single source of truth for the prefix vocabulary: they drive both
 * the conversion in `convertAttributes` and the has-a-prefix test in `setScriptProperty`, so a
 * prefix added here is automatically known to both.
 */
const CONVERSIONS = new Map([
    ['asset', assetConversion],
    ['entity', entityConversion],
    ['vec2', vectorConversion(2, Vec2)],
    ['vec3', vectorConversion(3, Vec3)],
    ['vec4', vectorConversion(4, Vec4)],
    ['color', colorConversion]
]);
/**
 * Matches a value against the conversion prefixes. A prefix is the text before the first colon,
 * so a value whose remainder itself contains colons (`asset:a:b`) still resolves, and a value
 * with an unrecognized prefix (`https://...`) or no colon does not match.
 * @param value - The value to inspect.
 * @returns The matching converter and the text after the prefix, or `null` if the value carries
 * no recognized prefix.
 */
const matchConversion = (value) => {
    const index = value.indexOf(':');
    if (index <= 0) {
        return null;
    }
    const convert = CONVERSIONS.get(value.slice(0, index));
    return convert ? { convert, rest: value.slice(index + 1) } : null;
};
/**
 * Finds a script property whose name matches `key` case-insensitively (but not exactly). Used
 * to suggest the kebab-case spelling when a camelCase attribute has been lowercased by the HTML
 * parser (e.g. `focusPoint` arriving as 'focuspoint').
 * @param script - The script instance to search.
 * @param key - The lowercased key that failed to match.
 * @returns The matching property name, or `null`.
 */
const findCaseMatch = (script, key) => {
    const names = new Set(Object.keys(script));
    for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(script))) {
        names.add(name);
    }
    for (const name of names) {
        if (name !== key && name.toLowerCase() === key.toLowerCase()) {
            return name;
        }
    }
    return null;
};
/**
 * The ScriptComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-scripts/ | `<pc-scripts>`} elements.
 * The ScriptComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class ScriptComponentElement extends ComponentElement {
    observer;
    /** @ignore */
    constructor() {
        super('script');
        // Create mutation observer to watch for child script elements
        this.observer = new MutationObserver(this.handleMutations.bind(this));
        // Listen for script attribute, enable and name changes
        this.addEventListener('scriptattributeschange', this.handleScriptAttributesChange.bind(this));
        this.addEventListener('scriptenablechange', this.handleScriptEnableChange.bind(this));
        this.addEventListener('scriptnamechange', this.handleScriptNameChange.bind(this));
    }
    connectedCallback() {
        // (Re-)observe on every connection - disconnectedCallback disconnects the observer.
        // Attribute changes on child pc-script elements are watched here too: per-property
        // script attributes are not statically known, so they cannot use observedAttributes.
        this.observer.observe(this, { childList: true, subtree: true, attributes: true });
        return super.connectedCallback();
    }
    initComponent() {
        // Handle initial script elements
        this.querySelectorAll(':scope > pc-script').forEach((scriptElement) => {
            this.createScript(scriptElement);
        });
    }
    /**
     * Recursively converts raw attribute data into proper PlayCanvas types. Supported conversions:
     * - "asset:id" → the Asset created by the `pc-asset` element with that id
     * - "entity:ref" → the Entity backing a `pc-entity` element. The reference can be a CSS
     *   selector, an element id or an entity name.
     * - "vec2:1 2" → new Vec2(1, 2)
     * - "vec3:1 2 3" → new Vec3(1, 2, 3)
     * - "vec4:1 2 3 4" → new Vec4(1, 2, 3, 4)
     * - "color:1 0.5 0.5 1" → new Color(1, 0.5, 0.5, 1)
     *
     * A prefixed string that fails to resolve or parse logs a warning and is left as the raw
     * string.
     * @param item - The item to convert.
     * @returns The converted item.
     */
    convertAttributes(item) {
        if (typeof item === 'string') {
            const match = matchConversion(item);
            return match ? match.convert(match.rest, item) : item;
        }
        if (Array.isArray(item)) {
            return item.map((element) => this.convertAttributes(element));
        }
        if (item && typeof item === 'object') {
            const result = {};
            for (const key in item) {
                result[key] = this.convertAttributes(item[key]);
            }
            return result;
        }
        return item;
    }
    /**
     * Recursively merge properties from source into target. When the target value is a Vec2,
     * Vec3, Vec4 or Color and the source value is a plain numeric array, the array is converted
     * to the target's type — so script attributes with math-typed defaults can be written as
     * plain JSON arrays (e.g. `"focusPoint": [0, 1.75, 0]`).
     * @param target - The target object to merge into.
     * @param source - The source object to merge from.
     * @returns The merged object.
     */
    mergeDeep(target, source) {
        for (const key in source) {
            const value = source[key];
            const current = target[key];
            if (this.isMathType(current) && Array.isArray(value)) {
                const converted = this.arrayToMathType(current, value, key);
                if (converted) {
                    target[key] = converted;
                }
                continue;
            }
            // Only recurse into plain objects. Class instances (Vec3, Color, Asset, Entity...)
            // are leaf values assigned whole, so accessor-typed script attributes receive them
            // through their setters instead of having a getter's returned copy mutated.
            if (value &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                Object.getPrototypeOf(value) === Object.prototype) {
                if (!current || typeof current !== 'object') {
                    target[key] = {};
                }
                this.mergeDeep(target[key], value);
            }
            else {
                target[key] = value;
            }
        }
        return target;
    }
    /**
     * Checks whether a value is one of the math types that plain numeric arrays convert to.
     * @param value - The value to check.
     * @returns Whether the value is a math type.
     */
    isMathType(value) {
        return (value instanceof Vec2 ||
            value instanceof Vec3 ||
            value instanceof Vec4 ||
            value instanceof Color ||
            value instanceof Quat);
    }
    /**
     * Converts a plain numeric array to the math type of `current`. A 3-element array targeting
     * a Quat is interpreted as Euler angles in degrees, mirroring the `parseQuat` attribute
     * grammar. Returns `null` (and logs a warning) when the array's length or contents don't
     * match the type.
     * @param current - The current (typed) value of the property.
     * @param value - The incoming array.
     * @param key - The property name, used in the warning message.
     * @returns The converted value, or `null`.
     */
    arrayToMathType(current, value, key) {
        if (value.every((component) => typeof component === 'number' && Number.isFinite(component))) {
            if (current instanceof Vec2 && value.length === 2)
                return new Vec2(value);
            if (current instanceof Vec3 && value.length === 3)
                return new Vec3(value);
            if (current instanceof Vec4 && value.length === 4)
                return new Vec4(value);
            if (current instanceof Color && (value.length === 3 || value.length === 4))
                return new Color(value);
            if (current instanceof Quat && value.length === 3)
                return new Quat().setFromEulerAngles(value[0], value[1], value[2]);
        }
        console.warn(`Cannot convert script attribute '${key}' array [${value}] to ${current.constructor.name}. Keeping the current value.`);
        return null;
    }
    /**
     * Update script attributes by merging converted values into the script. `enabled` is always
     * excluded (it is configured through the element's `enabled` attribute, not the JSON blob),
     * as are any keys in `exclude` — used to keep per-property attributes authoritative over
     * the blob without writing a property twice.
     * @param script - The script to update.
     * @param attributes - The attributes to merge into the script.
     * @param exclude - Keys to strip from the merge.
     */
    applyAttributes(script, attributes, exclude) {
        const converted = this.convertAttributes(attributes);
        if (converted && typeof converted === 'object') {
            delete converted.enabled;
            if (exclude) {
                for (const key of exclude) {
                    delete converted[key];
                }
            }
        }
        this.mergeDeep(script, converted);
    }
    /**
     * Returns the camelCase keys of the per-property attributes present on a `pc-script`
     * element.
     * @param scriptElement - The `pc-script` element.
     * @returns The camelCase keys.
     */
    inlineKeys(scriptElement) {
        const keys = new Set();
        for (const attr of Array.from(scriptElement.attributes)) {
            if (!isReservedAttribute(attr.name)) {
                keys.add(kebabToCamel(attr.name));
            }
        }
        return keys;
    }
    /**
     * Resolves the script instance owned by a `pc-script` element. Returns `null` when the
     * element has no created script, or when its name resolves to a script created by a
     * different element (e.g. a duplicate-named sibling).
     * @param scriptElement - The `pc-script` element.
     * @returns The owned script, or `null`.
     */
    scriptFor(scriptElement) {
        const name = scriptElement.getAttribute('name');
        if (!name || !this.component)
            return null;
        const script = this.component.get(name);
        return script && script === scriptElement._script ? script : null;
    }
    handleScriptAttributesChange(event) {
        const scriptElement = event.target;
        const script = this.scriptFor(scriptElement);
        if (script) {
            // Per-property attributes stay authoritative: keys they pin are excluded here
            this.applyAttributes(script, event.detail.attributes, this.inlineKeys(scriptElement));
        }
    }
    handleScriptEnableChange(event) {
        const scriptElement = event.target;
        // Apply any queued per-property changes first, so that initialize() (fired by the
        // engine on first effective enable) sees every attribute value set this tick
        this.handleMutations(this.observer.takeRecords());
        const script = this.scriptFor(scriptElement);
        if (script) {
            script.enabled = event.detail.enabled;
        }
    }
    /**
     * Handles a runtime `name` change on a child `pc-script`, swapping the engine script instance
     * to match. Without this the element would keep pointing at the old-name instance: the old
     * script would go on running while every subsequent update (attribute changes, enable
     * changes, destruction on removal) resolved the new name and silently no-opped.
     *
     * The new instance is built by the normal creation path, so both attribute channels are
     * re-applied to it and the declared enabled state is restored.
     * @param event - The name change event.
     */
    handleScriptNameChange(event) {
        const scriptElement = event.target;
        // Only direct children are managed, matching initComponent's ':scope > pc-script'
        // contract - the event bubbles, so a deeper pc-script must not be created here
        if (scriptElement.parentElement !== this)
            return;
        // Before the component exists there is nothing to swap: initComponent creates from
        // whatever the name is by then
        if (!this.component)
            return;
        // Only tear down the old-name script if this element actually owns it - a duplicate-named
        // element whose own create() failed must not take down the live script on rename
        const { oldName } = event.detail;
        if (oldName && scriptElement._script && this.component.get(oldName) === scriptElement._script) {
            this.destroyScript(oldName);
        }
        scriptElement._script = null;
        this.createScript(scriptElement);
    }
    /**
     * Creates the script instance for a `pc-script` element. The instance is created disabled,
     * the element's converted attributes are merged over the instance's defaults (which is what
     * allows plain numeric arrays to be typed against those defaults), and only then is the
     * declared enabled state applied — so `initialize()` runs with every attribute in place.
     * @param scriptElement - The `pc-script` element to create the script instance for.
     * @returns The created script, or `null`.
     */
    createScript(scriptElement) {
        const name = scriptElement.getAttribute('name');
        if (!name || !this.component)
            return null;
        const script = this.component.create(name, { enabled: false });
        if (!script)
            return null;
        scriptElement._script = script;
        // The JSON blob first with per-property-shadowed keys stripped, then the per-property
        // attributes: each property is written exactly once and individual attributes win
        this.applyAttributes(script, scriptElement.scriptAttributes, this.inlineKeys(scriptElement));
        this.applyInlineAttributes(script, scriptElement);
        script.enabled = scriptElement.enabled;
        scriptElement._onScriptCreated();
        return script;
    }
    /**
     * Applies the per-property attributes present on a `pc-script` element — any attribute that
     * is not part of the element's own API or a reserved HTML attribute name. These are applied
     * after the `attributes` JSON, so an individual attribute always takes precedence over the
     * blob.
     * @param script - The script to apply the attributes to.
     * @param scriptElement - The `pc-script` element holding the attributes.
     */
    applyInlineAttributes(script, scriptElement) {
        const scriptName = scriptElement.getAttribute('name') ?? '';
        for (const attr of Array.from(scriptElement.attributes)) {
            if (!isReservedAttribute(attr.name)) {
                this.setScriptProperty(script, scriptName, attr.name, attr.value);
            }
        }
    }
    /**
     * Applies a single per-property attribute change to the script of a `pc-script` element.
     * When the attribute has been removed, the value from the `attributes` JSON (if any) takes
     * effect again.
     * @param scriptElement - The `pc-script` element whose attribute changed.
     * @param attributeName - The name of the changed attribute.
     */
    applyScriptProperty(scriptElement, attributeName) {
        const script = this.scriptFor(scriptElement);
        if (!script)
            return;
        const value = scriptElement.getAttribute(attributeName);
        if (value === null) {
            const key = kebabToCamel(attributeName);
            const fallback = scriptElement.scriptAttributes[key];
            if (fallback !== undefined) {
                this.applyAttributes(script, { [key]: fallback });
            }
            return;
        }
        this.setScriptProperty(script, scriptElement.getAttribute('name') ?? '', attributeName, value);
    }
    /**
     * Applies one attribute string to a script property. A string-typed attribute takes the
     * value verbatim (so literals like 'color:red' are never hijacked by prefix conversion).
     * Otherwise, explicit prefixes (`asset:`, `entity:`, `vec2:`, `vec3:`, `vec4:`, `color:`)
     * carry their own type, and unprefixed values are parsed according to the type of the
     * attribute's current value. The Script API itself (methods, `entity`, `app`) is never
     * overwritten, invalid values keep the current value, and exceptions thrown by user
     * getters/setters are contained so one bad attribute cannot abort the rest of a batch.
     * @param script - The script to apply the value to.
     * @param scriptName - The script name, used in warning messages.
     * @param attributeName - The (kebab-case) element attribute name.
     * @param value - The attribute value.
     */
    setScriptProperty(script, scriptName, attributeName, value) {
        const key = kebabToCamel(attributeName);
        try {
            const current = script[key];
            if (typeof current === 'function' || SCRIPT_API_MEMBERS.has(key)) {
                console.warn(`Ignoring attribute '${attributeName}' on pc-script '${scriptName}' - '${key}' is part of the Script API.`);
                return;
            }
            if (typeof current === 'string') {
                script[key] = value;
            }
            else if (matchConversion(value)) {
                const converted = this.convertAttributes(value);
                // A prefix that failed to resolve or parse comes back as the raw string
                // (convertAttributes already warned) - never clobber a typed value with it
                if (converted !== value || current === undefined || current === null) {
                    script[key] = converted;
                }
            }
            else if (typeof current === 'number') {
                script[key] = parseNumber(value, current, attributeName);
            }
            else if (typeof current === 'boolean') {
                script[key] = parseBool(value, current);
            }
            else if (current instanceof Vec2) {
                script[key] = parseVec2(value, current, attributeName);
            }
            else if (current instanceof Vec3) {
                script[key] = parseVec3(value, current, attributeName);
            }
            else if (current instanceof Vec4) {
                script[key] = parseVec4(value, current, attributeName);
            }
            else if (current instanceof Color) {
                script[key] = parseColor(value, current, attributeName);
            }
            else if (current instanceof Quat) {
                script[key] = parseQuat(value, current, attributeName);
            }
            else {
                const match = findCaseMatch(script, key);
                if (match) {
                    console.warn(`Script '${scriptName}' has no attribute '${key}' - did you mean '${camelToKebab(match)}'? Attribute names are kebab-case.`);
                    return;
                }
                console.warn(`Script '${scriptName}' has no typed attribute '${key}' - assigning the raw string from '${attributeName}'.`);
                script[key] = value;
            }
        }
        catch (error) {
            console.warn(`Error applying attribute '${attributeName}' to script '${scriptName}': ${error.message}`);
        }
    }
    destroyScript(name) {
        if (!this.component)
            return;
        this.component.destroy(name);
    }
    handleMutations(mutations) {
        for (const mutation of mutations) {
            // Handle per-property attribute changes on child pc-script elements
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                if (target instanceof ScriptElement &&
                    target.parentElement === this &&
                    mutation.attributeName &&
                    !isReservedAttribute(mutation.attributeName)) {
                    this.applyScriptProperty(target, mutation.attributeName);
                }
                continue;
            }
            // Only direct children are managed - the observer watches the subtree for attribute
            // changes, but deeper childList records must not create or destroy scripts
            // (matching initComponent's ':scope > pc-script' contract)
            if (mutation.target !== this) {
                continue;
            }
            // Handle removed nodes first, so that replacing a pc-script with a same-named one
            // destroys the old script before the replacement is created. Only destroy a script
            // this element actually owns - a duplicate-named element whose own create() failed
            // must not take down the live script on removal.
            mutation.removedNodes.forEach((node) => {
                if (node instanceof ScriptElement) {
                    const scriptName = node.getAttribute('name');
                    if (scriptName &&
                        node._script &&
                        this.component &&
                        this.component.get(scriptName) === node._script) {
                        this.destroyScript(scriptName);
                    }
                    node._script = null;
                }
            });
            // Handle added nodes
            mutation.addedNodes.forEach((node) => {
                if (node instanceof ScriptElement) {
                    this.createScript(node);
                }
            });
        }
    }
    disconnectedCallback() {
        this.observer.disconnect();
        super.disconnectedCallback?.();
    }
    /**
     * Gets the underlying PlayCanvas script component.
     * @returns The script component.
     */
    get component() {
        return super.component;
    }
}
customElements.define('pc-scripts', ScriptComponentElement);

/**
 * The SoundComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-sounds/ | `<pc-sounds>`} elements.
 * The SoundComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class SoundComponentElement extends ComponentElement {
    _distanceModel = 'linear';
    _maxDistance = 10000;
    _pitch = 1;
    _positional = false;
    _refDistance = 1;
    _rollOffFactor = 1;
    _volume = 1;
    /** @ignore */
    constructor() {
        super('sound');
    }
    getInitialComponentData() {
        return {
            distanceModel: this._distanceModel,
            maxDistance: this._maxDistance,
            pitch: this._pitch,
            positional: this._positional,
            refDistance: this._refDistance,
            rollOffFactor: this._rollOffFactor,
            volume: this._volume
        };
    }
    /**
     * Gets the underlying PlayCanvas sound component.
     * @returns The sound component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets which algorithm to use to reduce the volume of the sound as it moves away from the listener.
     * @param value - The distance model.
     */
    set distanceModel(value) {
        this._distanceModel = value;
        if (this.component) {
            this.component.distanceModel = value;
        }
    }
    /**
     * Gets which algorithm to use to reduce the volume of the sound as it moves away from the listener.
     * @returns The distance model.
     */
    get distanceModel() {
        return this._distanceModel;
    }
    /**
     * Sets the maximum distance from the listener at which audio falloff stops.
     * @param value - The max distance.
     */
    set maxDistance(value) {
        this._maxDistance = value;
        if (this.component) {
            this.component.maxDistance = value;
        }
    }
    /**
     * Gets the maximum distance from the listener at which audio falloff stops.
     * @returns The max distance.
     */
    get maxDistance() {
        return this._maxDistance;
    }
    /**
     * Sets the pitch of the sound.
     * @param value - The pitch.
     */
    set pitch(value) {
        this._pitch = value;
        if (this.component) {
            this.component.pitch = value;
        }
    }
    /**
     * Gets the pitch of the sound.
     * @returns The pitch.
     */
    get pitch() {
        return this._pitch;
    }
    /**
     * Sets the positional flag of the sound.
     * @param value - The positional flag.
     */
    set positional(value) {
        this._positional = value;
        if (this.component) {
            this.component.positional = value;
        }
    }
    /**
     * Gets the positional flag of the sound.
     * @returns The positional flag.
     */
    get positional() {
        return this._positional;
    }
    /**
     * Sets the reference distance for reducing volume as the sound source moves further from the listener. Defaults to 1.
     * @param value - The ref distance.
     */
    set refDistance(value) {
        this._refDistance = value;
        if (this.component) {
            this.component.refDistance = value;
        }
    }
    /**
     * Gets the reference distance for reducing volume as the sound source moves further from the listener.
     * @returns The ref distance.
     */
    get refDistance() {
        return this._refDistance;
    }
    /**
     * Sets the factor used in the falloff equation. Defaults to 1.
     * @param value - The roll-off factor.
     */
    set rollOffFactor(value) {
        this._rollOffFactor = value;
        if (this.component) {
            this.component.rollOffFactor = value;
        }
    }
    /**
     * Gets the factor used in the falloff equation.
     * @returns The roll-off factor.
     */
    get rollOffFactor() {
        return this._rollOffFactor;
    }
    /**
     * Sets the volume of the sound.
     * @param value - The volume.
     */
    set volume(value) {
        this._volume = value;
        if (this.component) {
            this.component.volume = value;
        }
    }
    /**
     * Gets the volume of the sound.
     * @returns The volume.
     */
    get volume() {
        return this._volume;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'distance-model',
            'max-distance',
            'pitch',
            'positional',
            'ref-distance',
            'roll-off-factor',
            'volume'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'distance-model':
                this.distanceModel = parseEnum(newValue, ['exponential', 'inverse', 'linear'], 'linear', name);
                break;
            case 'max-distance':
                this.maxDistance = parseNumber(newValue, 10000, name);
                break;
            case 'pitch':
                this.pitch = parseNumber(newValue, 1, name);
                break;
            case 'positional':
                this.positional = parseBool(newValue, false);
                break;
            case 'ref-distance':
                this.refDistance = parseNumber(newValue, 1, name);
                break;
            case 'roll-off-factor':
                this.rollOffFactor = parseNumber(newValue, 1, name);
                break;
            case 'volume':
                this.volume = parseNumber(newValue, 1, name);
                break;
        }
    }
}
customElements.define('pc-sounds', SoundComponentElement);

/**
 * The SoundSlotElement interface provides properties and methods for manipulating
 * `<pc-sound>` elements. The SoundSlotElement interface also inherits the properties and
 * methods of the {@link AsyncElement} interface.
 */
class SoundSlotElement extends AsyncElement {
    _asset = '';
    _autoPlay = false;
    _duration = null;
    _loop = false;
    _name = '';
    _overlap = false;
    _pitch = 1;
    _startTime = 0;
    _volume = 1;
    /**
     * The `<pc-sounds>` this slot was added to, captured at connect time.
     *
     * `disconnectedCallback` cannot rediscover it: by the time the element is disconnected its
     * `parentElement` is already `null`, so a lookup would both fail to find the component and
     * emit a misleading "must be a direct child" warning for what is an ordinary removal.
     */
    _soundElement = null;
    /**
     * Incremented on every connect and disconnect, and captured by connectedCallback on entry —
     * a resume from an await abandons itself if the value has moved on, so a stale callback can
     * neither act on a torn-down tree nor add its slot alongside a re-inserted element's own
     * callback.
     */
    _connectionGeneration = 0;
    /**
     * The sound slot.
     */
    soundSlot = null;
    async connectedCallback() {
        const generation = ++this._connectionGeneration;
        const soundElement = this.soundElement;
        await soundElement?.ready();
        // The element may have been removed (perhaps re-inserted, which runs a callback of its
        // own), or its parent torn down, while we were waiting. A <pc-app> disconnects before
        // its children, so by the time we resume the component can already be gone - see the
        // matching guard in disconnectedCallback below.
        const component = soundElement?.component;
        if (generation !== this._connectionGeneration || !component) {
            return;
        }
        const options = {
            autoPlay: this._autoPlay,
            loop: this._loop,
            overlap: this._overlap,
            pitch: this._pitch,
            startTime: this._startTime,
            volume: this._volume
        };
        if (this._duration) {
            options.duration = this._duration;
        }
        this._soundElement = soundElement;
        this.soundSlot = component.addSlot(this._name, options);
        this.asset = this._asset;
        if (this._autoPlay) {
            this.soundSlot.play();
        }
        this._onReady();
    }
    disconnectedCallback() {
        // Invalidate any connectedCallback still suspended on an await
        this._connectionGeneration++;
        // Uses the cached parent rather than a fresh lookup, since parentElement is already null
        // by now. The component itself is null if the parent <pc-sound> (or the whole <pc-app>) is
        // being torn down — parents disconnect first and have already removed the component.
        this._soundElement?.component?.removeSlot(this._name);
        this._soundElement = null;
        this.soundSlot = null;
        this._resetReady();
    }
    get soundElement() {
        const soundElement = this.parentElement;
        if (!(soundElement instanceof SoundComponentElement)) {
            console.warn('pc-sound must be a direct child of a pc-sounds element');
            return null;
        }
        return soundElement;
    }
    /**
     * Sets the id of the `pc-asset` to use for the sound slot.
     * @param value - The asset.
     */
    set asset(value) {
        this._asset = value;
        if (this.soundSlot) {
            const id = useAsset(value)?.id;
            if (id) {
                this.soundSlot.asset = id;
            }
        }
    }
    /**
     * Gets the id of the `pc-asset` to use for the sound slot.
     * @returns The asset.
     */
    get asset() {
        return this._asset;
    }
    /**
     * Sets the auto play flag of the sound slot.
     * @param value - The auto play flag.
     */
    set autoPlay(value) {
        this._autoPlay = value;
        if (this.soundSlot) {
            this.soundSlot.autoPlay = value;
        }
    }
    /**
     * Gets the auto play flag of the sound slot.
     * @returns The auto play flag.
     */
    get autoPlay() {
        return this._autoPlay;
    }
    /**
     * Sets the duration of the sound slot, in seconds (or `null` to play the whole clip).
     * @param value - The duration.
     */
    set duration(value) {
        this._duration = value;
        if (this.soundSlot && value !== null) {
            this.soundSlot.duration = value;
        }
    }
    /**
     * Gets the duration of the sound slot.
     * @returns The duration.
     */
    get duration() {
        return this._duration;
    }
    /**
     * Sets the loop flag of the sound slot.
     * @param value - The loop flag.
     */
    set loop(value) {
        this._loop = value;
        if (this.soundSlot) {
            this.soundSlot.loop = value;
        }
    }
    /**
     * Gets the loop flag of the sound slot.
     * @returns The loop flag.
     */
    get loop() {
        return this._loop;
    }
    /**
     * Sets the name of the sound slot.
     * @param value - The name.
     */
    set name(value) {
        this._name = value;
        if (this.soundSlot) {
            this.soundSlot.name = value;
        }
    }
    /**
     * Gets the name of the sound slot.
     * @returns The name.
     */
    get name() {
        return this._name;
    }
    /**
     * Sets the overlap flag of the sound slot.
     * @param value - The overlap flag.
     */
    set overlap(value) {
        this._overlap = value;
        if (this.soundSlot) {
            this.soundSlot.overlap = value;
        }
    }
    /**
     * Gets the overlap flag of the sound slot.
     * @returns The overlap flag.
     */
    get overlap() {
        return this._overlap;
    }
    /**
     * Sets the pitch of the sound slot.
     * @param value - The pitch.
     */
    set pitch(value) {
        this._pitch = value;
        if (this.soundSlot) {
            this.soundSlot.pitch = value;
        }
    }
    /**
     * Gets the pitch of the sound slot.
     * @returns The pitch.
     */
    get pitch() {
        return this._pitch;
    }
    /**
     * Sets the start time of the sound slot.
     * @param value - The start time.
     */
    set startTime(value) {
        this._startTime = value;
        if (this.soundSlot) {
            this.soundSlot.startTime = value;
        }
    }
    /**
     * Gets the start time of the sound slot.
     * @returns The start time.
     */
    get startTime() {
        return this._startTime;
    }
    /**
     * Sets the volume of the sound slot.
     * @param value - The volume.
     */
    set volume(value) {
        this._volume = value;
        if (this.soundSlot) {
            this.soundSlot.volume = value;
        }
    }
    /**
     * Gets the volume of the sound slot.
     * @returns The volume.
     */
    get volume() {
        return this._volume;
    }
    static get observedAttributes() {
        return ['asset', 'auto-play', 'duration', 'loop', 'name', 'overlap', 'pitch', 'start-time', 'volume'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'asset':
                this.asset = newValue ?? '';
                break;
            case 'auto-play':
                this.autoPlay = parseBool(newValue, false);
                break;
            case 'duration':
                this.duration = parseNumber(newValue, null, name);
                break;
            case 'loop':
                this.loop = parseBool(newValue, false);
                break;
            case 'name':
                this.name = newValue ?? '';
                break;
            case 'overlap':
                this.overlap = parseBool(newValue, false);
                break;
            case 'pitch':
                this.pitch = parseNumber(newValue, 1, name);
                break;
            case 'start-time':
                this.startTime = parseNumber(newValue, 0, name);
                break;
            case 'volume':
                this.volume = parseNumber(newValue, 1, name);
                break;
        }
    }
}
customElements.define('pc-sound', SoundSlotElement);

/**
 * The GSplatComponentElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-gsplat/ | `<pc-gsplat>`} elements.
 * The GSplatComponentElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * @category Components
 */
class GSplatComponentElement extends ComponentElement {
    _asset = '';
    _castShadows = false;
    _lodBaseDistance = 5;
    _lodMultiplier = 3;
    _lodRangeMin = 0;
    _lodRangeMax = 99;
    /** @ignore */
    constructor() {
        super('gsplat');
    }
    getInitialComponentData() {
        return {
            asset: useAsset(this._asset),
            castShadows: this._castShadows,
            lodBaseDistance: this._lodBaseDistance,
            lodMultiplier: this._lodMultiplier,
            lodRangeMin: this._lodRangeMin,
            lodRangeMax: this._lodRangeMax
        };
    }
    /**
     * Gets the underlying PlayCanvas gsplat component.
     * @returns The gsplat component.
     */
    get component() {
        return super.component;
    }
    /**
     * Sets id of the `pc-asset` to use for the splat.
     * @param value - The asset ID.
     */
    set asset(value) {
        this._asset = value;
        const asset = useAsset(value);
        if (this.component && asset) {
            this.component.asset = asset;
        }
    }
    /**
     * Gets the id of the `pc-asset` to use for the splat.
     * @returns The asset ID.
     */
    get asset() {
        return this._asset;
    }
    /**
     * Sets whether the splat casts shadows.
     * @param value - Whether the splat casts shadows.
     */
    set castShadows(value) {
        this._castShadows = value;
        if (this.component) {
            this.component.castShadows = value;
        }
    }
    /**
     * Gets whether the splat casts shadows.
     * @returns Whether the splat casts shadows.
     */
    get castShadows() {
        return this._castShadows;
    }
    /**
     * Sets the base distance for the first LOD transition (LOD 0 to LOD 1). Splats closer than
     * this distance use the highest quality LOD. Each subsequent LOD level transitions at a
     * progressively larger distance, controlled by {@link lodMultiplier}. Clamped to a minimum of
     * 0.1. Defaults to 5. Only affects assets that contain LOD levels (e.g. `.lod-meta.json`).
     * @param value - The LOD base distance.
     */
    set lodBaseDistance(value) {
        this._lodBaseDistance = value;
        if (this.component) {
            this.component.lodBaseDistance = value;
        }
    }
    /**
     * Gets the base distance for the first LOD transition.
     * @returns The LOD base distance.
     */
    get lodBaseDistance() {
        return this._lodBaseDistance;
    }
    /**
     * Sets the multiplier between successive LOD distance thresholds. Each LOD level transitions
     * at this factor times the previous level's distance, creating a geometric progression. Lower
     * values keep higher quality at distance; higher values switch to coarser LODs sooner. Clamped
     * to a minimum of 1.2. Defaults to 3. Only affects assets that contain LOD levels (e.g.
     * `.lod-meta.json`).
     * @param value - The LOD multiplier.
     */
    set lodMultiplier(value) {
        this._lodMultiplier = value;
        if (this.component) {
            this.component.lodMultiplier = value;
        }
    }
    /**
     * Gets the multiplier between successive LOD distance thresholds.
     * @returns The LOD multiplier.
     */
    get lodMultiplier() {
        return this._lodMultiplier;
    }
    /**
     * Sets the minimum allowed LOD index (inclusive). The LOD selected by distance is clamped so it
     * never goes finer (lower index) than this value. Raising it avoids downloading the highest
     * quality (largest) LOD files. Defaults to 0. Only affects assets that contain LOD levels (e.g.
     * `.lod-meta.json`).
     * @param value - The minimum LOD index.
     */
    set lodRangeMin(value) {
        this._lodRangeMin = value;
        if (this.component) {
            this.component.lodRangeMin = value;
        }
    }
    /**
     * Gets the minimum allowed LOD index.
     * @returns The minimum LOD index.
     */
    get lodRangeMin() {
        return this._lodRangeMin;
    }
    /**
     * Sets the maximum allowed LOD index (inclusive). The LOD selected by distance is clamped so it
     * never goes coarser (higher index) than this value. The default of 99 effectively means "no
     * cap". Defaults to 99. Only affects assets that contain LOD levels (e.g. `.lod-meta.json`).
     * @param value - The maximum LOD index.
     */
    set lodRangeMax(value) {
        this._lodRangeMax = value;
        if (this.component) {
            this.component.lodRangeMax = value;
        }
    }
    /**
     * Gets the maximum allowed LOD index.
     * @returns The maximum LOD index.
     */
    get lodRangeMax() {
        return this._lodRangeMax;
    }
    static get observedAttributes() {
        return [
            ...super.observedAttributes,
            'asset',
            'cast-shadows',
            'lod-base-distance',
            'lod-multiplier',
            'lod-range-min',
            'lod-range-max'
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        super.attributeChangedCallback(name, _oldValue, newValue);
        switch (name) {
            case 'asset':
                this.asset = newValue ?? '';
                break;
            case 'cast-shadows':
                this.castShadows = parseBool(newValue, false);
                break;
            case 'lod-base-distance':
                this.lodBaseDistance = parseNumber(newValue, 5, name);
                break;
            case 'lod-multiplier':
                this.lodMultiplier = parseNumber(newValue, 3, name);
                break;
            case 'lod-range-min':
                this.lodRangeMin = parseNumber(newValue, 0, name);
                break;
            case 'lod-range-max':
                this.lodRangeMax = parseNumber(newValue, 99, name);
                break;
        }
    }
}
customElements.define('pc-gsplat', GSplatComponentElement);

/**
 * Formats one line of the printable hierarchy: the node's name, an `[index]` marker when the
 * name is shared by several nodes in the model, the attached component types, and the material
 * names of a render component.
 *
 * @param node - The node to format.
 * @param counts - The number of nodes bearing each name.
 * @returns The formatted line.
 */
const formatNode = (node, counts) => {
    const index = (counts.get(node.name) ?? 0) > 1 ? ` [${node.index}]` : '';
    const components = node.components.length > 0 ? ` (${node.components.join(', ')})` : '';
    // Braces rather than brackets: `[N]` already means a match index on this line
    const materials = node.materials.length > 0 ? ` {${node.materials.map((slot) => slot.name ?? 'null').join(', ')}}` : '';
    return `${node.name}${index}${components}${materials}`;
};
/**
 * Formats the printable form of a hierarchy subtree.
 *
 * @param root - The subtree root.
 * @param counts - The number of nodes bearing each name.
 * @returns The tree, one line per node.
 */
const formatHierarchy = (root, counts) => {
    const lines = [formatNode(root, counts)];
    const walk = (node, prefix) => {
        node.children.forEach((child, i) => {
            const last = i === node.children.length - 1;
            lines.push(`${prefix}${last ? '└─ ' : '├─ '}${formatNode(child, counts)}`);
            walk(child, `${prefix}${last ? '   ' : '│  '}`);
        });
    };
    walk(root, '');
    return lines.join('\n');
};
/**
 * The ModelElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-model/ | `<pc-model>`} elements.
 * The ModelElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * The element becomes ready once its container asset has loaded and the instantiated hierarchy has
 * been added to the scene — `entity` is non-null by then. A failed load also settles readiness,
 * with `entity` remaining `null`: readiness means the load settled, not that it succeeded — listen
 * for `error`, or check `entity`, to tell the outcomes apart. Changing `asset` re-arms readiness
 * and instantiates anew, so a `ready()` obtained after the change resolves against the new
 * hierarchy. A `pc-model` outside a `pc-app`, or referencing an unknown asset id, warns and never
 * becomes ready.
 *
 * @fires {Event} load - Fired each time a container asset finishes instantiating, including
 * re-instantiation after `asset` changes. Does not bubble — listen on this element, or use a
 * capture-phase listener on an ancestor.
 * @fires {ErrorEvent} error - Fired when the container asset fails to load, with the engine's
 * error in `message`. Does not bubble. The element still becomes ready — readiness means the load
 * settled, not that it succeeded.
 */
class ModelElement extends AsyncElement {
    _asset = '';
    _entity = null;
    /**
     * Incremented on every new load and on disconnect, and captured by a load when it starts. A
     * load that resumes from an await or a load callback abandons itself if the value has moved
     * on, so a superseded load can neither instantiate a second entity nor parent one that has
     * since been destroyed.
     */
    _loadGeneration = 0;
    /**
     * The pending asset subscriptions of the current load, if it is waiting for its asset. Held
     * so that whatever supersedes the load can detach the handlers from the asset, rather than
     * leave them registered until the asset settles (or forever, if it never does).
     */
    _loadHandle = null;
    _errorHandle = null;
    /**
     * The root entity of the instantiated model. `null` until the container asset has loaded
     * and been instantiated, and again once the element has been removed from the document.
     * @returns The model's root entity, or `null`.
     */
    get entity() {
        return this._entity;
    }
    /**
     * Returns a snapshot of the instantiated node tree, or `null` while there is none (the
     * container asset has not loaded, or the element has left the document). One call grounds a
     * session — a browser console, a test, an agent — in the vocabulary `pc-node` binding
     * resolves against: the instantiated names ({@link HierarchyNode.name}), paths, match
     * indices, attached component types and the material assignments of render components
     * ({@link HierarchyNode.materials}). `String(...)` of the result, or of any node in it,
     * is the printable form.
     *
     * The snapshot is plain data, computed afresh each call: it does not follow later changes
     * to the hierarchy, and mutating it changes nothing.
     *
     * @returns The root of the instantiated node tree, or `null`.
     */
    hierarchy() {
        const root = this._entity;
        if (!root) {
            return null;
        }
        // Ordinals are assigned in the traversal resolution searches — pre-order depth-first
        // from the model root, the root itself included — so each node's index is exactly what
        // a pc-node's index attribute selects. Once the walk completes, the map holds the total
        // count per name, which is what the printable form reads to annotate only shared names.
        const ordinals = new Map();
        const describe = (entity, pathBelowRoot) => {
            const index = ordinals.get(entity.name) ?? 0;
            ordinals.set(entity.name, index + 1);
            const node = {
                name: entity.name,
                // The root has no path below itself; its own name stands in, as it does for
                // the path a pc-node bound to the root reports.
                path: pathBelowRoot || entity.name,
                index,
                // A plain GraphNode grafted into the hierarchy has no component storage
                components: Object.keys(entity.c ?? {}).sort(),
                materials: (entity.render?.meshInstances ?? []).map((meshInstance, slot) => ({
                    index: slot,
                    name: meshInstance.material?.name ?? null
                })),
                children: entity.children.map((child) => describe(child, pathBelowRoot ? `${pathBelowRoot}/${child.name}` : child.name))
            };
            // Non-enumerable, keeping the snapshot plain data under JSON.stringify, spreads and
            // key enumeration. Deferred to call time, by which the ordinal map holds its totals.
            Object.defineProperty(node, 'toString', {
                enumerable: false,
                value: () => formatHierarchy(node, ordinals)
            });
            return node;
        };
        return describe(root, '');
    }
    connectedCallback() {
        // A model outside an application is inert and never becomes ready, so awaiting it hangs.
        // Warn rather than fail silently, naming the parent it requires, as every other misplaced
        // element does.
        if (!this.closestApp) {
            const label = this._asset ? ` '${this._asset}'` : '';
            console.warn(`pc-model${label} must be a descendant of pc-app - model not created`);
            return;
        }
        this._loadModel();
    }
    disconnectedCallback() {
        this._loadGeneration++;
        this._detachLoadHandlers();
        this._unloadModel();
        this._resetReady();
    }
    _detachLoadHandlers() {
        this._loadHandle?.off();
        this._loadHandle = null;
        this._errorHandle?.off();
        this._errorHandle = null;
    }
    /**
     * Resolves readiness and dispatches the `load` event. Called once the instantiated hierarchy
     * has been parented — readiness means "in the scene graph", matching `pc-entity`, so a ready
     * model's entity always has world transforms.
     */
    _announceLoad() {
        this._onReady();
        this.dispatchEvent(new Event('load'));
    }
    _instantiate(container) {
        const generation = this._loadGeneration;
        const entity = container.instantiateRenderEntity();
        this._entity = entity;
        // @ts-ignore
        if (container.animations.length > 0) {
            entity.addComponent('anim');
            // @ts-ignore
            entity.anim.assignAnimation('animation', container.animations[0].resource);
        }
        // The parent's readiness re-arms when it is torn down, so these can resume in a later
        // connection cycle. The entity is captured above and the generation re-checked, so a
        // stale resume cannot parent an entity a newer cycle has already destroyed.
        const parentEntityElement = this.closestEntity;
        if (parentEntityElement) {
            parentEntityElement.ready().then(() => {
                if (generation !== this._loadGeneration) {
                    return;
                }
                parentEntityElement.entity.addChild(entity);
                this._announceLoad();
            });
        }
        else {
            const appElement = this.closestApp;
            if (appElement) {
                appElement.ready().then(() => {
                    if (generation !== this._loadGeneration) {
                        return;
                    }
                    appElement.app.root.addChild(entity);
                    this._announceLoad();
                });
            }
        }
    }
    async _loadModel() {
        this._unloadModel();
        // Supersede any load already in flight - only the newest load may instantiate
        const generation = ++this._loadGeneration;
        this._detachLoadHandlers();
        // Re-arm readiness so a waiter obtained after an asset change resolves against the new
        // hierarchy. A no-op on first connection, where readiness is still pending.
        this._resetReady();
        const appElement = this.closestApp;
        if (!appElement) {
            // Outside pc-app; connectedCallback already warned. Reached through the asset setter.
            return;
        }
        await appElement.ready();
        // The element may have been removed, or another load started, while we waited
        if (generation !== this._loadGeneration) {
            return;
        }
        const asset = useAsset(this._asset);
        if (!asset) {
            // An empty id is a legitimate transient (the asset may be assigned later); a
            // non-empty one that resolves to nothing is a dead end - say so rather than staying
            // silently pending.
            if (this._asset) {
                console.warn(`pc-model could not find asset '${this._asset}' - model not created`);
            }
            return;
        }
        if (asset.loaded) {
            this._instantiate(asset.resource);
        }
        else {
            // The generation is re-checked even though a superseded handler is detached: the
            // detach relies on how the engine's event emitter treats removal, while the check
            // holds on its own. Whichever of load/error fires first detaches the other.
            this._loadHandle = asset.once('load', () => {
                this._detachLoadHandlers();
                if (generation !== this._loadGeneration) {
                    return;
                }
                this._instantiate(asset.resource);
            });
            this._errorHandle = asset.once('error', (err) => {
                this._detachLoadHandlers();
                if (generation !== this._loadGeneration) {
                    return;
                }
                // A failed load settles readiness with a null entity, mirroring pc-asset:
                // readiness means the load settled, not that it succeeded.
                this.dispatchEvent(new ErrorEvent('error', {
                    message: err instanceof Error ? err.message : String(err)
                }));
                this._onReady();
            });
        }
    }
    _unloadModel() {
        this._entity?.destroy();
        this._entity = null;
    }
    /**
     * Sets the id of the `pc-asset` to use for the model.
     * @param value - The asset ID.
     */
    set asset(value) {
        this._asset = value;
        if (this.isConnected) {
            this._loadModel();
        }
    }
    /**
     * Gets the id of the `pc-asset` to use for the model.
     * @returns The asset ID.
     */
    get asset() {
        return this._asset;
    }
    static get observedAttributes() {
        return ['asset'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'asset':
                this.asset = newValue ?? '';
                break;
        }
    }
}
customElements.define('pc-model', ModelElement);

/**
 * Parses one mapping into its valid rules, warning for each entry that is not one: an unknown
 * or missing selector prefix, an empty `name:` value, an `index:` value that is not a
 * non-negative integer, or a replacement id that is not a non-empty string. An invalid rule
 * behaves exactly as if absent from the mapping.
 *
 * @param overrides - The mapping to parse.
 * @param label - The element description for warnings.
 * @returns The valid rules.
 */
const parseMaterialRules = (overrides, label) => {
    const rules = [];
    for (const [selector, id] of Object.entries(overrides)) {
        if (typeof id !== 'string' || id === '') {
            console.warn(`${label} material-overrides '${selector}' needs a pc-material id - rule ignored`);
        }
        else if (selector.startsWith('name:')) {
            // The text after the prefix is the selector value, exactly as written - a material
            // name may legitimately begin or end with whitespace
            const name = selector.slice('name:'.length);
            if (name === '') {
                console.warn(`${label} material-overrides 'name:' selector is empty - rule ignored`);
            }
            else {
                rules.push({ kind: 'name', name, id });
            }
        }
        else if (selector.startsWith('index:')) {
            // Whitespace around the number is tolerated; Number('') is 0, so blank means NaN
            const text = selector.slice('index:'.length).trim();
            const index = text === '' ? NaN : Number(text);
            if (!Number.isInteger(index) || index < 0) {
                console.warn(`${label} material-overrides '${selector}' is not a non-negative integer index - rule ignored`);
            }
            else {
                rules.push({ kind: 'index', index, id });
            }
        }
        else {
            console.warn(`${label} material-overrides '${selector}' has no 'name:' or 'index:' prefix - rule ignored`);
        }
    }
    return rules;
};
/**
 * Parses the material-overrides attribute text. Anything but a JSON object — malformed JSON, an
 * array, a primitive — warns and yields `null`, the absent mapping: a stale mapping must not
 * survive an attribute value the DOM no longer represents.
 *
 * @param text - The attribute text.
 * @param label - The element description for warnings.
 * @returns The mapping, or `null`.
 */
const parseMaterialOverridesAttribute = (text, label) => {
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (error) {
        console.warn(`${label} material-overrides is not valid JSON - treated as absent: ${error.message}`);
        return null;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn(`${label} material-overrides must be a JSON object - treated as absent`);
        return null;
    }
    return parsed;
};
/**
 * Computes the Levenshtein distance between two strings, for near-miss suggestions in the
 * resolution warnings.
 *
 * @param a - The first string.
 * @param b - The second string.
 * @returns The edit distance.
 */
const levenshtein = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let previous = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const current = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
            previous = current;
        }
    }
    return row[b.length];
};
/**
 * The NodeElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-node/ | `<pc-node>`}
 * elements. The NodeElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 *
 * A `pc-node` is an override element: where `pc-entity` creates an entity, `pc-node` binds to a
 * node a `pc-model` loaded and declares overrides against the authored asset — components to
 * add, properties to change, content to attach. Attributes present apply as overrides; attributes
 * absent leave authored values untouched, and removing an attribute (or assigning `null` to the
 * matching property) restores the authored value.
 *
 * `name` selects among the host model's nodes (first match in depth-first order), nesting a
 * `pc-node` inside another scopes the search to that subtree, and `index` picks among identically
 * named matches. When `name` matches more than one node and no `index` is given, the element
 * warns and binds nothing.
 *
 * The element becomes ready once bound, and never while unresolved — a missing or ambiguous
 * name warns and records the failure in `state`, readiness stays unresolved, and descendants
 * wait with it.
 *
 * The pointer events below are dispatched by the containing `<pc-app>` element when the pointer
 * intersects the bound node's geometry, exactly as for `<pc-entity>`.
 *
 * @attribute {string} name - The name of the node to bind, resolved within the nearest ancestor
 * `pc-model` (or `pc-node`) once it has instantiated.
 * @attribute {number} index - Which match to bind when `name` matches more than one node,
 * 0-based in depth-first order. Optional for a unique match; required for an ambiguous one.
 * @attribute {boolean} enabled - Overrides the node's enabled state.
 * @attribute {string} position - Overrides the node's local position, as an "x y z" triple.
 * @attribute {string} rotation - Overrides the node's local rotation (Euler angles), as an
 * "x y z" triple.
 * @attribute {string} scale - Overrides the node's local scale, as an "x y z" triple.
 * @attribute {string} tags - Overrides the node's tags, separated by spaces or commas.
 * @attribute {string} material-overrides - Overrides material assignments on the bound node's
 * render component, as a JSON object from selector to `pc-material` id — for example
 * `{"name:CarPaint": "candy-red", "index:7": "smoked-glass"}`. A `name:X` key selects every mesh
 * instance whose baseline material is named `X`; an `index:N` key selects mesh instance `N` and
 * wins over a name rule for the same instance. Assignments no rule matches keep their baseline
 * materials, and removing the attribute restores all of them. Use `pc-model.hierarchy()` to
 * discover the names and indices a node offers.
 * @attribute {string} onpointerenter - Script to run when the pointer moves onto the node.
 * @attribute {string} onpointerleave - Script to run when the pointer moves off the node.
 * @attribute {string} onpointermove - Script to run when the pointer moves over the node.
 * @attribute {string} onpointerdown - Script to run when a pointer button is pressed over the
 * node.
 * @attribute {string} onpointerup - Script to run when a pointer button is released over the
 * node.
 * @fires {PointerEvent} pointerenter - Fired when the pointer moves onto the node.
 * @fires {PointerEvent} pointerleave - Fired when the pointer moves off the node.
 * @fires {PointerEvent} pointermove - Fired when the pointer moves over the node.
 * @fires {PointerEvent} pointerdown - Fired when a pointer button is pressed over the node.
 * @fires {PointerEvent} pointerup - Fired when a pointer button is released over the node.
 */
class NodeElement extends EntityBaseElement {
    _name = '';
    _index = null;
    _state = 'pending';
    _path = null;
    /**
     * The element whose entity roots this element's search: the nearest ancestor `pc-node`, or
     * failing that the nearest ancestor `pc-model`. Resolved on connection.
     */
    _host = null;
    /**
     * The listener following the host's binding cycles. Both host kinds announce each cycle
     * with a `ready` event — `pc-model` on every instantiation, `pc-node` on every bind.
     */
    _hostListener = null;
    /**
     * The subscription to the bound entity's destruction, detached on unbind so a retargeted
     * element cannot be reset by the eventual death of a node it no longer fronts.
     */
    _destroyHandle = null;
    /** The authored values displaced by this element's overrides, captured per property. */
    _authored = {};
    /**
     * The model-authored render component of the bound node, recorded at bind — before child
     * decorations build — so a render component added later by a child `pc-render` can never
     * become the override target. `null` when the bound node has none.
     */
    _authoredRender = null;
    /**
     * The baseline assignments displaced by the material overrides, captured for every mesh
     * instance when the first non-empty mapping applies and released when the mapping goes
     * absent (restoring them) or the binding dissolves.
     */
    _baseline = null;
    // Override values. `null` means "no override": the authored value stays in force.
    _enabled = null;
    _position = null;
    _rotation = null;
    _scale = null;
    _tags = null;
    _materialOverrides = null;
    /**
     * The binding state: `pending` until the host instantiates and `name` resolves, `bound`
     * once decorated, `missing`/`ambiguous`/`duplicate` when resolution failed (each also
     * warns). Useful for asserting a document's bindings programmatically.
     * @returns The binding state.
     */
    get state() {
        return this._state;
    }
    /**
     * The path of the bound node below the search root, `/`-separated, or `null` while not
     * bound.
     * @returns The bound node's path, or `null`.
     */
    get path() {
        return this._path;
    }
    connectedCallback() {
        const host = (this.parentElement?.closest('pc-model, pc-node') ?? null);
        if (!host) {
            const label = this._name ? ` '${this._name}'` : '';
            console.warn(`pc-node${label} must be a descendant of pc-model - node not bound`);
            return;
        }
        this._host = host;
        // Follow the host's binding cycles. `ready` bubbles, so cycles of elements nested under
        // the host pass through it - only the host's own count.
        this._hostListener = (event) => {
            if (event.target !== this._host) {
                return;
            }
            this._rebind();
        };
        host.addEventListener('ready', this._hostListener);
        // The host may already be instantiated (an element inserted after load binds immediately)
        this._rebind();
    }
    disconnectedCallback() {
        if (this._host && this._hostListener) {
            this._host.removeEventListener('ready', this._hostListener);
        }
        this._host = null;
        this._hostListener = null;
        // Removal reverts: the model owns the node, so the entity is left as authored. Children
        // clean up through their own disconnect behavior.
        this._unbind();
        this._state = 'pending';
    }
    /**
     * Re-resolves the binding against the host's current hierarchy: on connection, on a `name`
     * or `index` change, and on every host cycle (a model [re]instantiating, an enclosing
     * `pc-node` [re]binding). When re-resolution yields the entity already bound, the binding
     * is retained untouched — a redundant edit must not flicker overrides through a revert.
     */
    _rebind() {
        const hostEntity = this._host?.entity ?? null;
        if (!hostEntity || !this._name) {
            // Host not instantiated (or nothing to look up yet): return to pending. An assigned
            // name arriving later, or the host's next cycle, resolves it.
            this._unbind();
            this._state = 'pending';
            return;
        }
        const target = this._resolve(hostEntity);
        if (target && target === this._entity) {
            this._path = this._pathOf(target, hostEntity);
            return;
        }
        this._unbind();
        if (!target) {
            // _resolve warned and set the failure state
            return;
        }
        this._bind(target, hostEntity);
    }
    /**
     * Resolves `name` (and `index`) to an entity under `hostEntity`, warning and recording the
     * failure state when it cannot.
     *
     * @param hostEntity - The root of the search.
     * @returns The resolved entity, or `null`.
     */
    _resolve(hostEntity) {
        const matches = hostEntity.find((node) => node.name === this._name);
        if (matches.length === 0) {
            const closest = this._closestName(hostEntity);
            const hint = closest ? ` - closest match: '${closest}'` : '';
            console.warn(`pc-node '${this._name}' not found in ${this._describeHost()}${hint}`);
            this._state = 'missing';
            return null;
        }
        let target;
        if (this._index !== null) {
            if (this._index >= matches.length) {
                console.warn(`pc-node '${this._name}' index ${this._index} is out of range - ${matches.length} match(es) in ${this._describeHost()}`);
                this._state = 'missing';
                return null;
            }
            target = matches[this._index];
        }
        else if (matches.length > 1) {
            // Ambiguity binds nothing: a fallback guess performs side effects on the wrong
            // scene node, and would go wrong silently when a re-export introduces a duplicate
            // name. The candidates tell the author exactly what to write.
            const candidates = matches.map((m, i) => `[${i}] ${this._pathOf(m, hostEntity)}`).join(', ');
            console.warn(`pc-node '${this._name}' is ambiguous in ${this._describeHost()} - specify index: ${candidates}`);
            this._state = 'ambiguous';
            return null;
        }
        else {
            target = matches[0];
        }
        const owner = this.closestApp?.elementFromEntity(target);
        if (owner && owner !== this) {
            console.warn(`pc-node '${this._name}' resolves to a node already bound by another element - element ignored`);
            this._state = 'duplicate';
            return null;
        }
        return target;
    }
    /**
     * Binds `target`: registers it (making it a pick target), hooks its destruction, applies
     * this element's overrides, announces readiness and builds the deferred child subtree.
     *
     * @param target - The entity to bind.
     * @param hostEntity - The search root, for the path.
     */
    _bind(target, hostEntity) {
        this._entity = target;
        this._registerEntity(target);
        this._destroyHandle = target.once('destroy', this._onEntityDestroy, this);
        this._state = 'bound';
        this._path = this._pathOf(target, hostEntity);
        this._authoredRender = target.render ?? null;
        this._applyOverrides();
        this._onReady();
        this._buildChildren();
    }
    /**
     * Dissolves the current binding, restoring every authored value this element's overrides
     * displaced and removing the decorations this binding hosts: attachment entities are
     * destroyed (re-created against the next binding) and component decorations are removed
     * from the abandoned node. Both sweeps are scoped by `closestEntity`, so a still-bound
     * nested `pc-node` keeps its own decorations. Safe to call in any state.
     */
    _unbind() {
        const entity = this._entity;
        if (!entity) {
            return;
        }
        this._revertOverrides();
        // Attachment points anchor to the bound node, so they cannot outlive the binding. Each
        // destroyed entity resets its element, which the next _buildChildren re-creates.
        this.querySelectorAll('pc-entity').forEach((child) => {
            if (child.closestEntity === this) {
                child.entity?.destroy();
            }
        });
        this._destroyHandle?.off();
        this._destroyHandle = null;
        this._unregisterEntity(entity);
        this._entity = null;
        this._path = null;
        this._authored = {};
        this._authoredRender = null;
        // Component decorations come off through the same hook the host-ready cycle uses. A
        // dissolve that never rebinds fires no ready event, so the sweep is explicit - after
        // `_entity` is cleared, so the hook sees a host without an entity.
        this.querySelectorAll('*').forEach((child) => {
            if (child instanceof ComponentElement && child.closestEntity === this) {
                child._hostCycled();
            }
        });
        this._resetReady();
    }
    /**
     * Handles the destruction of the bound entity - its model unloading, reloading, or a script
     * destroying it. There is nothing to revert on a destroyed entity; the element returns to
     * pending and the host's next cycle re-resolves it.
     */
    _onEntityDestroy(entity) {
        this._destroyHandle = null;
        this._unregisterEntity(entity);
        this._entity = null;
        this._path = null;
        this._authored = {};
        this._authoredRender = null;
        // The mesh instances died with the entity - the capture is dropped, not restored
        this._baseline = null;
        this._state = 'pending';
        this._resetReady();
    }
    /**
     * Creates and parents the entities of child `pc-entity` elements - the attachment points.
     * Mirrors the runtime-insertion path in EntityElement.connectedCallback: children were
     * deferred while this host was unresolved (or reset when a previous binding dissolved), and
     * build here once it binds.
     */
    _buildChildren() {
        const app = this.closestApp?.app;
        if (!app) {
            return;
        }
        buildDescendantEntities(this, app);
    }
    /**
     * Applies every override that is explicitly set, capturing the authored value it displaces.
     */
    _applyOverrides() {
        if (this._enabled !== null) {
            this.enabled = this._enabled;
        }
        if (this._position !== null) {
            this.position = this._position;
        }
        if (this._rotation !== null) {
            this.rotation = this._rotation;
        }
        if (this._scale !== null) {
            this.scale = this._scale;
        }
        if (this._tags !== null) {
            this.tags = this._tags;
        }
        if (this._materialOverrides !== null) {
            this._applyMaterialOverrides();
        }
    }
    /**
     * Restores every authored value this element's overrides displaced. The override values
     * themselves are kept - they re-apply on the next binding.
     */
    _revertOverrides() {
        const entity = this._entity;
        const authored = this._authored;
        if (authored.enabled !== undefined) {
            entity.enabled = authored.enabled;
        }
        if (authored.position) {
            entity.setLocalPosition(authored.position);
        }
        if (authored.rotation) {
            entity.setLocalRotation(authored.rotation);
        }
        if (authored.scale) {
            entity.setLocalScale(authored.scale);
        }
        if (authored.tags) {
            entity.tags.clear();
            entity.tags.add(authored.tags);
        }
        this._authored = {};
        this._restoreBaseline();
    }
    /**
     * Applies the material mapping to the authored render component: parse the mapping's valid
     * rules, capture the baseline on first application, then recompute every assignment from
     * that baseline - name rules write over it, index rules write over them, so `index:` wins -
     * and assign whatever changed. An absent mapping, or one with no valid rules, restores the
     * baseline instead. Called while bound, from `_applyOverrides` and the property setter.
     */
    _applyMaterialOverrides() {
        const label = `pc-node '${this._name}'`;
        const rules = this._materialOverrides ? parseMaterialRules(this._materialOverrides, label) : [];
        if (rules.length === 0) {
            this._restoreBaseline();
            return;
        }
        if (!this._baseline) {
            if (!this._authoredRender) {
                console.warn(`${label} is bound to a node without an authored render component - material-overrides ignored`);
                return;
            }
            this._baseline = this._authoredRender.meshInstances.map((meshInstance) => ({
                meshInstance,
                material: meshInstance.material ?? null,
                name: meshInstance.material?.name ?? null
            }));
        }
        const baseline = this._baseline;
        /** Resolves a replacement id, warning when it does not resolve. */
        const resolveReplacement = (id) => {
            const material = MaterialElement.get(id);
            if (!material) {
                console.warn(`${label} material-overrides could not resolve pc-material '${id}' - rule ignored`);
            }
            return material ?? null;
        };
        // Recompute the whole list from the baseline: name rules write over it, index rules
        // write over them. Recomputing makes mapping edits order-independent, and a rule whose
        // replacement does not resolve simply leaves the layer below it in force.
        const resolved = baseline.map((assignment) => assignment.material);
        for (const rule of rules) {
            if (rule.kind !== 'name') {
                continue;
            }
            const material = resolveReplacement(rule.id);
            if (!material) {
                continue;
            }
            let matched = false;
            baseline.forEach((assignment, index) => {
                if (assignment.name === rule.name) {
                    resolved[index] = material;
                    matched = true;
                }
            });
            if (!matched) {
                const names = baseline.map((assignment) => `'${assignment.name}'`).join(', ');
                console.warn(`${label} material-overrides 'name:${rule.name}' matches no assignment - ` +
                    `baseline names: ${names || '(none)'}`);
            }
        }
        for (const rule of rules) {
            if (rule.kind !== 'index') {
                continue;
            }
            if (rule.index >= baseline.length) {
                console.warn(`${label} material-overrides 'index:${rule.index}' is out of range - ` +
                    `${baseline.length} assignment(s)`);
                continue;
            }
            const material = resolveReplacement(rule.id);
            if (material) {
                resolved[rule.index] = material;
            }
        }
        baseline.forEach((assignment, index) => {
            // The engine setter rebuilds material and shader state even for a redundant write,
            // so only actual changes are assigned
            if (assignment.meshInstance.material !== resolved[index]) {
                assignment.meshInstance.material = resolved[index];
            }
        });
    }
    /**
     * Restores every baseline assignment the material overrides displaced and releases the
     * capture, so the next non-empty mapping captures afresh. Safe to call without a capture.
     */
    _restoreBaseline() {
        const baseline = this._baseline;
        if (!baseline) {
            return;
        }
        this._baseline = null;
        for (const assignment of baseline) {
            if (assignment.meshInstance.material !== assignment.material) {
                assignment.meshInstance.material = assignment.material;
            }
        }
    }
    /**
     * Renders the path of `node` below `root`, for the `path` property and the resolution
     * warnings.
     *
     * @param node - The node to describe.
     * @param root - The search root.
     * @returns The `/`-separated path.
     */
    _pathOf(node, root) {
        const parts = [];
        for (let current = node; current && current !== root; current = current.parent) {
            parts.unshift(current.name);
        }
        return parts.join('/') || node.name;
    }
    /**
     * Describes the search root for warnings: the model's asset id, or the enclosing node's
     * name.
     * @returns The description.
     */
    _describeHost() {
        if (this._host instanceof ModelElement) {
            return `model '${this._host.asset}'`;
        }
        return `pc-node '${this._host?.name ?? ''}' subtree`;
    }
    /**
     * Finds the node name nearest to the missing `name`, for the miss warning. The names are
     * already in hand from resolution, so the suggestion is nearly free.
     *
     * @param hostEntity - The root of the search.
     * @returns The closest name within an edit distance of 2, or `null`.
     */
    _closestName(hostEntity) {
        let best = null;
        let bestDistance = 3;
        hostEntity.find((node) => {
            const distance = levenshtein(this._name, node.name);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = node.name;
            }
            return false;
        });
        return best;
    }
    /**
     * Sets the name of the node to bind. A change retargets: the current binding's overrides
     * revert and the new name resolves afresh. `name` on a `pc-node` is never a rename of the
     * authored node - it is only ever a reference.
     * @param value - The node name.
     */
    set name(value) {
        this._name = value;
        if (this.isConnected && this._host) {
            this._rebind();
        }
    }
    /**
     * Gets the name of the node to bind.
     * @returns The node name.
     */
    get name() {
        return this._name;
    }
    /**
     * Sets which match to bind when `name` matches more than one node, 0-based in depth-first
     * order. A change retargets, like `name`. `null` means unset - required when the name is
     * ambiguous, optional otherwise.
     * @param value - The match index, or `null`.
     */
    set index(value) {
        this._index = value;
        if (this.isConnected && this._host) {
            this._rebind();
        }
    }
    /**
     * Gets which match to bind.
     * @returns The match index, or `null` when unset.
     */
    get index() {
        return this._index;
    }
    /**
     * Sets the enabled override. `null` clears it, restoring the authored state.
     * @param value - The enabled state, or `null`.
     */
    set enabled(value) {
        this._enabled = value;
        const entity = this._state === 'bound' ? this._entity : null;
        if (!entity) {
            return;
        }
        if (value !== null) {
            this._authored.enabled ??= entity.enabled;
            entity.enabled = value;
        }
        else if (this._authored.enabled !== undefined) {
            entity.enabled = this._authored.enabled;
            delete this._authored.enabled;
        }
    }
    /**
     * Gets the enabled override.
     * @returns The enabled state, or `null` while no override is set.
     */
    get enabled() {
        return this._enabled;
    }
    /**
     * Sets the local position override. `null` clears it, restoring the authored position.
     * @param value - The position, or `null`.
     */
    set position(value) {
        this._position = value;
        const entity = this._state === 'bound' ? this._entity : null;
        if (!entity) {
            return;
        }
        if (value !== null) {
            this._authored.position ??= entity.getLocalPosition().clone();
            entity.setLocalPosition(value);
        }
        else if (this._authored.position) {
            entity.setLocalPosition(this._authored.position);
            delete this._authored.position;
        }
    }
    /**
     * Gets the local position override.
     * @returns The position, or `null` while no override is set.
     */
    get position() {
        return this._position;
    }
    /**
     * Sets the local rotation override, as Euler angles in degrees. `null` clears it, restoring
     * the authored rotation.
     * @param value - The rotation, or `null`.
     */
    set rotation(value) {
        this._rotation = value;
        const entity = this._state === 'bound' ? this._entity : null;
        if (!entity) {
            return;
        }
        if (value !== null) {
            // The authored rotation is cached as a quaternion: it restores exactly, where a
            // round trip through Euler angles need not.
            this._authored.rotation ??= entity.getLocalRotation().clone();
            entity.setLocalEulerAngles(value);
        }
        else if (this._authored.rotation) {
            entity.setLocalRotation(this._authored.rotation);
            delete this._authored.rotation;
        }
    }
    /**
     * Gets the local rotation override.
     * @returns The rotation, or `null` while no override is set.
     */
    get rotation() {
        return this._rotation;
    }
    /**
     * Sets the local scale override. `null` clears it, restoring the authored scale.
     * @param value - The scale, or `null`.
     */
    set scale(value) {
        this._scale = value;
        const entity = this._state === 'bound' ? this._entity : null;
        if (!entity) {
            return;
        }
        if (value !== null) {
            this._authored.scale ??= entity.getLocalScale().clone();
            entity.setLocalScale(value);
        }
        else if (this._authored.scale) {
            entity.setLocalScale(this._authored.scale);
            delete this._authored.scale;
        }
    }
    /**
     * Gets the local scale override.
     * @returns The scale, or `null` while no override is set.
     */
    get scale() {
        return this._scale;
    }
    /**
     * Sets the tags override. `null` clears it, restoring the authored tags.
     * @param value - The tags, or `null`.
     */
    set tags(value) {
        this._tags = value;
        const entity = this._state === 'bound' ? this._entity : null;
        if (!entity) {
            return;
        }
        if (value !== null) {
            this._authored.tags ??= entity.tags.list().slice();
            entity.tags.clear();
            entity.tags.add(value);
        }
        else if (this._authored.tags) {
            entity.tags.clear();
            entity.tags.add(this._authored.tags);
            delete this._authored.tags;
        }
    }
    /**
     * Gets the tags override.
     * @returns The tags, or `null` while no override is set.
     */
    get tags() {
        return this._tags;
    }
    /**
     * Sets the material overrides: a sparse mapping from selector to `pc-material` id, applied
     * to the bound node's authored render component. A `name:X` key selects every mesh instance
     * whose baseline material is named `X`; an `index:N` key selects mesh instance `N` and wins
     * over a name rule for the same instance. Assignments no rule matches keep their baseline
     * materials. `null` clears the mapping, restoring every baseline assignment.
     * @param value - The mapping, or `null`.
     */
    set materialOverrides(value) {
        // Copied and frozen: later caller mutation of the passed object must not silently
        // disagree with the mapping the element applied
        this._materialOverrides = value === null ? null : Object.freeze({ ...value });
        if (this._state === 'bound') {
            this._applyMaterialOverrides();
        }
    }
    /**
     * Gets the material overrides.
     * @returns The mapping, or `null` while no override is set.
     */
    get materialOverrides() {
        return this._materialOverrides;
    }
    static get observedAttributes() {
        return [
            'enabled',
            'index',
            'material-overrides',
            'name',
            'position',
            'rotation',
            'scale',
            'tags',
            ...POINTER_ATTRIBUTES
        ];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'enabled':
                this.enabled = newValue === null ? null : parseBool(newValue, true);
                break;
            case 'index':
                if (newValue === null) {
                    this.index = null;
                }
                else {
                    // Number('') is 0, which would make index="" silently mean the first match
                    const index = newValue.trim() === '' ? NaN : Number(newValue);
                    if (!Number.isInteger(index) || index < 0) {
                        // Invalid values are treated as absent: under ambiguity that means
                        // unbound, the fail-safe direction.
                        console.warn(`pc-node index '${newValue}' is not a non-negative integer - treated as absent`);
                        this.index = null;
                    }
                    else {
                        this.index = index;
                    }
                }
                break;
            case 'material-overrides':
                this.materialOverrides =
                    newValue === null ? null : parseMaterialOverridesAttribute(newValue, `pc-node '${this._name}'`);
                break;
            case 'name':
                this.name = newValue ?? '';
                break;
            case 'position':
                this.position = newValue === null ? null : parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'rotation':
                this.rotation = newValue === null ? null : parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'scale':
                this.scale = newValue === null ? null : parseVec3(newValue, Vec3.ONE, name);
                break;
            case 'tags':
                this.tags = newValue === null ? null : parseTags(newValue);
                break;
            case 'onpointerenter':
            case 'onpointerleave':
            case 'onpointerdown':
            case 'onpointerup':
            case 'onpointermove':
                this._updateInlineHandler(name, newValue);
                break;
        }
    }
}
customElements.define('pc-node', NodeElement);

/**
 * The SceneElement interface provides properties and methods for manipulating
 * {@link https://developer.playcanvas.com/user-manual/web-components/tags/pc-scene/ | `<pc-scene>`} elements.
 * The SceneElement interface also inherits the properties and methods of the
 * {@link HTMLElement} interface.
 */
class SceneElement extends AsyncElement {
    /**
     * The fog type of the scene.
     */
    _fog = 'none';
    /**
     * The color of the fog.
     */
    _fogColor = new Color(1, 1, 1);
    /**
     * The density of the fog.
     */
    _fogDensity = 0;
    /**
     * The start distance of the fog.
     */
    _fogStart = 0;
    /**
     * The end distance of the fog.
     */
    _fogEnd = 1000;
    /**
     * The gravity of the scene.
     */
    _gravity = new Vec3(0, -9.81, 0);
    _scene = null;
    /**
     * The PlayCanvas scene instance. `null` until the element is ready — await
     * {@link whenReady} or the element's `ready()` promise before accessing it.
     * @returns The scene instance, or `null`.
     */
    get scene() {
        return this._scene;
    }
    async connectedCallback() {
        const appElement = this.closestApp;
        if (!appElement) {
            console.warn('pc-scene must be a descendant of pc-app - scene settings not applied');
            return;
        }
        await appElement.ready();
        // The element may have been removed or re-parented while waiting for the app. Matches the
        // guard in AssetElement and MaterialElement, but compares closestApp rather than
        // parentElement because pc-scene resolves its app by ancestor rather than direct child.
        // Without this, a scene re-parented mid-await would take its Scene from the app it started
        // under while _applyGravity resolved the app it ended up under, splitting the two.
        if (!this.isConnected || this.closestApp !== appElement) {
            return;
        }
        // The application is gone if the tree was torn down while we awaited readiness. There is
        // nothing to configure and nothing the author can act on, so this stays silent.
        const app = appElement.app;
        if (!app) {
            return;
        }
        this._scene = app.scene;
        this._updateSceneSettings();
        this._onReady();
    }
    disconnectedCallback() {
        // The scene belongs to the application, and removing this element - or the <pc-app>
        // above it, which disconnects first - parts the two. Re-arm readiness so a re-inserted
        // element announces the scene it acquires then, not the one it lost here.
        this._scene = null;
        this._resetReady();
    }
    _updateSceneSettings() {
        if (this._scene) {
            this._scene.fog.type = this._fog;
            this._scene.fog.color = this._fogColor;
            this._scene.fog.density = this._fogDensity;
            this._scene.fog.start = this._fogStart;
            this._scene.fog.end = this._fogEnd;
            this._applyGravity(this._gravity);
        }
    }
    /**
     * Applies gravity to the rigid body system. Resolved through `closestApp` rather than
     * `parentElement` so that a `<pc-scene>` nested inside a wrapper element behaves the same as
     * a direct child, matching how `connectedCallback` resolves the application.
     *
     * @param value - The gravity to apply.
     */
    _applyGravity(value) {
        this.closestApp?.app?.systems.rigidbody?.gravity.copy(value);
    }
    /**
     * Sets the fog type of the scene. Can be `none`, `linear`, `exp` or `exp2`. Defaults to
     * `none`.
     * @param value - The fog type.
     */
    set fog(value) {
        this._fog = value;
        if (this.scene) {
            this.scene.fog.type = value;
        }
    }
    /**
     * Gets the fog type of the scene.
     * @returns The fog type.
     */
    get fog() {
        return this._fog;
    }
    /**
     * Sets the fog color of the scene.
     * @param value - The fog color.
     */
    set fogColor(value) {
        this._fogColor = value;
        if (this.scene) {
            this.scene.fog.color = value;
        }
    }
    /**
     * Gets the fog color of the scene.
     * @returns The fog color.
     */
    get fogColor() {
        return this._fogColor;
    }
    /**
     * Sets the fog density of the scene.
     * @param value - The fog density.
     */
    set fogDensity(value) {
        this._fogDensity = value;
        if (this.scene) {
            this.scene.fog.density = value;
        }
    }
    /**
     * Gets the fog density of the scene.
     * @returns The fog density.
     */
    get fogDensity() {
        return this._fogDensity;
    }
    /**
     * Sets the fog start distance of the scene.
     * @param value - The fog start distance.
     */
    set fogStart(value) {
        this._fogStart = value;
        if (this.scene) {
            this.scene.fog.start = value;
        }
    }
    /**
     * Gets the fog start distance of the scene.
     * @returns The fog start distance.
     */
    get fogStart() {
        return this._fogStart;
    }
    /**
     * Sets the fog end distance of the scene.
     * @param value - The fog end distance.
     */
    set fogEnd(value) {
        this._fogEnd = value;
        if (this.scene) {
            this.scene.fog.end = value;
        }
    }
    /**
     * Gets the fog end distance of the scene.
     * @returns The fog end distance.
     */
    get fogEnd() {
        return this._fogEnd;
    }
    /**
     * Sets the gravity of the scene.
     * @param value - The gravity.
     */
    set gravity(value) {
        this._gravity = value;
        if (this._scene) {
            this._applyGravity(value);
        }
    }
    /**
     * Gets the gravity of the scene.
     * @returns The gravity.
     */
    get gravity() {
        return this._gravity;
    }
    static get observedAttributes() {
        return ['fog', 'fog-color', 'fog-density', 'fog-start', 'fog-end', 'gravity'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'fog':
                this.fog = parseEnum(newValue, ['none', 'linear', 'exp', 'exp2'], 'none', name);
                break;
            case 'fog-color':
                this.fogColor = parseColor(newValue, Color.WHITE, name);
                break;
            case 'fog-density':
                this.fogDensity = parseNumber(newValue, 0, name);
                break;
            case 'fog-start':
                this.fogStart = parseNumber(newValue, 0, name);
                break;
            case 'fog-end':
                this.fogEnd = parseNumber(newValue, 1000, name);
                break;
            case 'gravity':
                this.gravity = parseVec3(newValue, new Vec3(0, -9.81, 0), name);
                break;
            // ... handle other attributes as well
        }
    }
}
customElements.define('pc-scene', SceneElement);

/**
 * The SkyElement interface provides properties and methods for manipulating
 * `<pc-sky>` elements. The SkyElement interface also inherits the properties and
 * methods of the {@link HTMLElement} interface.
 */
class SkyElement extends AsyncElement {
    _asset = '';
    _center = new Vec3(0, 0.01, 0);
    _intensity = 1;
    _rotation = new Vec3();
    _mipLevel = 0;
    _lighting = false;
    _scale = new Vec3(100, 100, 100);
    _type = 'infinite';
    _scene = null;
    _appElement = null;
    /**
     * Incremented on every new load and on disconnect, and captured by a load when it starts. A
     * load that resumes from an await or a load callback abandons itself if the value has moved
     * on, so a superseded load cannot generate a skybox for a scene it no longer configures.
     */
    _loadGeneration = 0;
    /**
     * The pending asset-load subscription of the current load, if it is waiting for its asset.
     * Held so that whatever supersedes the load can detach the handler from the asset, rather
     * than leave it registered until the asset loads (or forever, if it never does).
     */
    _loadHandle = null;
    connectedCallback() {
        this._loadSkybox();
        this._onReady();
    }
    disconnectedCallback() {
        this._loadGeneration++;
        this._detachLoadHandler();
        this._unloadSkybox();
        this._appElement = null;
        this._resetReady();
    }
    _detachLoadHandler() {
        this._loadHandle?.off();
        this._loadHandle = null;
    }
    _generateSkybox(asset) {
        if (!this._scene)
            return;
        const source = asset.resource;
        const skybox = EnvLighting.generateSkyboxCubemap(source);
        // This element owns what it generated (see _unloadSkybox) - replacing a skybox from an
        // earlier load must release it, not orphan it on the GPU
        this._scene.skybox?.destroy();
        this._scene.skybox = skybox;
        if (this._lighting) {
            const lighting = EnvLighting.generateLightingSource(source);
            const envAtlas = EnvLighting.generateAtlas(lighting);
            // The lighting source is an intermediate: the atlas is rendered from it and it is
            // not needed afterwards
            lighting.destroy();
            this._scene.envAtlas?.destroy();
            this._scene.envAtlas = envAtlas;
        }
        const layer = this._scene.layers.getLayerById(LAYERID_SKYBOX);
        if (layer) {
            layer.enabled = this._type !== 'none';
        }
        this._scene.sky.type = this._type;
        this._scene.sky.node.setLocalScale(this._scale);
        this._scene.sky.center = this._center;
        this._scene.skyboxIntensity = this._intensity;
        this._scene.skyboxMip = this._mipLevel;
    }
    async _loadSkybox() {
        // Supersede any load already in flight - only the newest load may generate the skybox
        const generation = ++this._loadGeneration;
        this._detachLoadHandler();
        const appElement = await this.closestApp?.ready();
        // The element may have been removed, or another load started, while we waited
        if (generation !== this._loadGeneration) {
            return;
        }
        const app = appElement?.app;
        if (!appElement || !app) {
            return;
        }
        this._appElement = appElement;
        const asset = useAsset(this._asset);
        if (!asset) {
            return;
        }
        this._scene = app.scene;
        if (asset.loaded) {
            this._generateSkybox(asset);
        }
        else {
            // The generation is re-checked even though a superseded handler is detached: the
            // detach relies on how the engine's event emitter treats removal, while the check
            // holds on its own.
            this._loadHandle = asset.once('load', () => {
                this._loadHandle = null;
                if (generation !== this._loadGeneration) {
                    return;
                }
                this._generateSkybox(asset);
            });
        }
    }
    _unloadSkybox() {
        const scene = this._scene;
        if (!scene)
            return;
        this._scene = null;
        // If the owning application has already been destroyed (removing a <pc-app>
        // disconnects it before its children), the scene, graphics device and skybox
        // textures have all been destroyed along with it — nothing left to clean up.
        if (!this._appElement?.app)
            return;
        scene.skybox?.destroy();
        // @ts-ignore
        scene.skybox = null;
        scene.envAtlas?.destroy();
        // @ts-ignore
        scene.envAtlas = null;
    }
    /**
     * Sets the id of the `pc-asset` to use for the skybox.
     * @param value - The asset ID.
     */
    set asset(value) {
        this._asset = value;
        if (this.isConnected) {
            this._loadSkybox();
        }
    }
    /**
     * Gets the id of the `pc-asset` to use for the skybox.
     * @returns The asset ID.
     */
    get asset() {
        return this._asset;
    }
    /**
     * Sets the center of the skybox.
     * @param value - The center.
     */
    set center(value) {
        this._center = value;
        if (this._scene) {
            this._scene.sky.center = this._center;
        }
    }
    /**
     * Gets the center of the skybox.
     * @returns The center.
     */
    get center() {
        return this._center;
    }
    /**
     * Sets the intensity of the skybox.
     * @param value - The intensity.
     */
    set intensity(value) {
        this._intensity = value;
        if (this._scene) {
            this._scene.skyboxIntensity = this._intensity;
        }
    }
    /**
     * Gets the intensity of the skybox.
     * @returns The intensity.
     */
    get intensity() {
        return this._intensity;
    }
    /**
     * Sets whether the skybox is used as a light source.
     * @param value - Whether to use lighting.
     */
    set lighting(value) {
        this._lighting = value;
    }
    /**
     * Gets whether the skybox is used as a light source.
     * @returns Whether to use lighting.
     */
    get lighting() {
        return this._lighting;
    }
    /**
     * Sets the mip level of the skybox, where 0 is the sharpest. Raising it selects a blurrier mip,
     * which is how a skybox is softened without blurring the texture itself.
     * @param value - The mip level.
     */
    set mipLevel(value) {
        this._mipLevel = value;
        if (this._scene) {
            this._scene.skyboxMip = this._mipLevel;
        }
    }
    /**
     * Gets the mip level of the skybox.
     * @returns The mip level.
     */
    get mipLevel() {
        return this._mipLevel;
    }
    /**
     * Sets the Euler rotation of the skybox.
     * @param value - The rotation.
     */
    set rotation(value) {
        this._rotation = value;
        if (this._scene) {
            this._scene.skyboxRotation = new Quat().setFromEulerAngles(value);
        }
    }
    /**
     * Gets the Euler rotation of the skybox.
     * @returns The rotation.
     */
    get rotation() {
        return this._rotation;
    }
    /**
     * Sets the scale of the skybox.
     * @param value - The scale.
     */
    set scale(value) {
        this._scale = value;
        if (this._scene) {
            this._scene.sky.node.setLocalScale(this._scale);
        }
    }
    /**
     * Gets the scale of the skybox.
     * @returns The scale.
     */
    get scale() {
        return this._scale;
    }
    /**
     * Sets the type of the skybox.
     * @param value - The type.
     */
    set type(value) {
        this._type = value;
        if (this._scene) {
            this._scene.sky.type = this._type;
            const layer = this._scene.layers.getLayerById(LAYERID_SKYBOX);
            if (layer) {
                layer.enabled = this._type !== 'none';
            }
        }
    }
    /**
     * Gets the type of the skybox.
     * @returns The type.
     */
    get type() {
        return this._type;
    }
    static get observedAttributes() {
        return ['asset', 'center', 'intensity', 'lighting', 'mip-level', 'rotation', 'scale', 'type'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'asset':
                this.asset = newValue ?? '';
                break;
            case 'center':
                this.center = parseVec3(newValue, new Vec3(0, 0.01, 0), name);
                break;
            case 'intensity':
                this.intensity = parseNumber(newValue, 1, name);
                break;
            case 'lighting':
                this.lighting = parseBool(newValue, false);
                break;
            case 'mip-level':
                this.mipLevel = parseNumber(newValue, 0, name);
                break;
            case 'rotation':
                this.rotation = parseVec3(newValue, Vec3.ZERO, name);
                break;
            case 'scale':
                this.scale = parseVec3(newValue, new Vec3(100, 100, 100), name);
                break;
            case 'type':
                this.type = parseEnum(newValue, ['box', 'dome', 'infinite', 'none'], 'infinite', name);
                break;
        }
    }
}
customElements.define('pc-sky', SkyElement);

export { AppElement, AssetElement, AsyncElement, ButtonComponentElement, CameraComponentElement, CollisionComponentElement, ComponentElement, ElementComponentElement, EntityBaseElement, EntityElement, GSplatComponentElement, JointComponentElement, LayoutChildComponentElement, LayoutGroupComponentElement, LightComponentElement, ListenerComponentElement, MaterialElement, ModelElement, ModuleElement, NodeElement, ParticleSystemComponentElement, RenderComponentElement, RigidBodyComponentElement, SceneElement, ScreenComponentElement, ScriptComponentElement, ScriptElement, ScrollViewComponentElement, ScrollbarComponentElement, SkyElement, SoundComponentElement, SoundSlotElement, whenReady };

