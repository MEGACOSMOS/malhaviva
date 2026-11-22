import {
    math,
    FlyController,
    FocusController,
    GamepadSource,
    KeyboardMouseSource,
    OrbitController,
    Picker,
    Pose,
    Script,
    Vec2,
    Vec3
} from 'playcanvas';

/** @import { CameraComponent, InputController } from 'playcanvas' */

/**
 * O comando de jogo, para browsers que não sabem o que isso é.
 *
 * O GamepadSource do motor pergunta `navigator.getGamepads()` sem ver
 * primeiro se a pergunta existe. Num browser sem comandos (algumas vistas
 * de dentro de aplicações, browsers com a privacidade apertada, o WebKit
 * de testes) isso dá erro em cada imagem, e o erro pára o resto da
 * câmara: o bairro aparece, mas os marcadores dos testemunhos e das rotas
 * nunca chegam a ser postos. Aqui, sem comandos, o comando simplesmente
 * não mexe.
 */
class ComandoDeJogo extends GamepadSource {
    read() {
        if (typeof navigator.getGamepads === 'function') return super.read();
        return Object.getPrototypeOf(GamepadSource.prototype).read.call(this);
    }
}

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();

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
 * Um ângulo em graus, trazido para entre -180 e 180.
 *
 * @param {number} graus - O ângulo.
 * @returns {number} O mesmo ângulo, entre -180 e 180.
 */
const entreMeiaVolta = (graus) => {
    let a = graus % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
};

// ─── Navegar como no Google Maps ───
//
// O bairro mexe-se como o mapa do Google Maps, no computador e no
// telemóvel.
//
// Com o rato: arrastar agarra o chão e puxa-o — o sítio onde se carregou
// fica debaixo do rato até se largar, e largado com balanço o bairro ainda
// desliza um pouco; a roda aproxima e afasta, em direcção ao que está
// debaixo do rato; Ctrl (ou Shift) e arrastar, ou arrastar com o botão
// direito, roda o bairro (para os lados) e inclina-o (para cima e para
// baixo) à volta do meio do ecrã; o duplo clique aproxima e traz esse sítio
// para o meio. Um clique sozinho não mexe no bairro: os cliques são dos
// marcadores. Carregar sem largar (meio segundo, parado), ou carregar e
// largar o botão direito sem arrastar, marca o sítio — o local marcado, com
// as direções até lá e a partilha (ver `marcarAoPremir`).
//
// Com os dedos: um dedo arrasta; dois dedos aproximam e afastam (a pinça),
// rodam (a rodar um à volta do outro) e arrastam, tudo ao mesmo tempo; dois
// dedos a subir ou a descer juntos inclinam; dois toques aproximam; dois
// dedos a tocar ao mesmo tempo afastam; dois toques com o segundo a ficar
// e a arrastar aproximam (para baixo) e afastam (para cima); e um dedo
// parado no mesmo sítio, sem largar, marca-o.
//
// O teclado é o de sempre (a pedido de quem fez o site): as setas e o
// W A S D andam pelo chão, mais depressa com o Shift e mais devagar com o
// Ctrl, e com o Alt as setas olham à volta sem sair do sítio. Do Google
// Maps ficou só o + e o −, que aproximam e afastam.

// Quanto o rato ou o dedo podem mexer, entre carregar e largar, para ainda
// contar como clique ou toque (pontos de ecrã), e quanto pode durar
// (milissegundos).
const CLIQUE_MEXIDA_RATO = 6;
const CLIQUE_MEXIDA_DEDO = 12;
const CLIQUE_DURACAO_MAXIMA = 450;

// Dois cliques (ou dois toques) contam como duplos com menos disto entre o
// primeiro largar e o segundo carregar, e a menos disto um do outro.
const DUPLO_INTERVALO = 320;
const DUPLO_DISTANCIA = 30;

// Dois dedos a tocar e a largar em menos disto, sem mexer, afastam.
const TOQUE_DE_DOIS_DEDOS = 300;

// Carregar sem largar, como no Google Maps: o rato (o botão esquerdo) ou um
// dedo parados num sítio do bairro durante isto (milissegundos) marcam esse
// sítio — o local marcado, com as direções até lá e a partilha (ver "O local
// marcado", no index.html). Parados quer dizer sem nunca se afastarem do
// sítio onde pousaram mais do que um clique ou um toque deixam
// (CLIQUE_MEXIDA_RATO, CLIQUE_MEXIDA_DEDO). No computador, o botão direito
// carregado e largado sem arrastar marca também, como lá. A meio do tempo
// (PREMIR_AVISO) avisa-se de que pode vir um, para a página ir buscando o
// que precisa para o mostrar.
const PREMIR_DURACAO = 500;
const PREMIR_AVISO = 150;

// O arrasto só começa a mexer no bairro depois de o rato ou o dedo andarem
// isto (pontos de ecrã): assim um clique com a mão a tremer não arrasta.
const ARRASTO_MINIMO_RATO = 3;
const ARRASTO_MINIMO_DEDO = 6;

// Até onde, pelo chão, pode ir o sítio agarrado quando o rato ou o dedo
// vão para perto do horizonte (metros): dali para cima o bairro deixa de
// andar, em vez de dar saltos de centenas de metros.
const ALCANCE_DO_ARRASTO = 350;

// Os sítios lidos à placa gráfica mais longe do que isto, pelo chão, são a
// paisagem ao fundo ou o céu, e não servem para agarrar (metros).
const LONGE_DE_MAIS = 450;

// O balanço depois de largar um arrasto: quanto tempo leva a perder a
// força (segundos, a constante de tempo), a velocidade abaixo da qual
// pára e a mais alta com que pode sair (metros por segundo). Só há
// balanço se o rato ou o dedo ainda andavam há menos de BALANCO_PARADO
// milissegundos: quem pára antes de largar não quer que o bairro fuja.
const BALANCO_TEMPO = 0.35;
const BALANCO_MINIMO = 0.8;
const BALANCO_MAXIMO = 260;
const BALANCO_PARADO = 70;

// A roda do rato: cada ponto de roda multiplica a distância ao sítio
// debaixo do rato por e^(pontos × isto). Num rato, cada passo da roda são
// cem pontos, e um passo aproxima para três quartos da distância. A pinça
// de um teclado tátil chega com o Ctrl e aos bocadinhos.
const ZOOM_DA_RODA = 0.0029;
const ZOOM_DA_PINCA_TATIL = 0.012;
// O + e o − do teclado, e o duplo clique (que também traz o sítio para o
// meio): quanto fica da distância.
const ZOOM_DAS_TECLAS = 0.7;
const ZOOM_DO_DUPLO = 0.5;
// Dois toques com o segundo a arrastar: cada ponto de ecrã para baixo
// multiplica a distância por e^(-isto).
const ZOOM_DE_UM_DEDO = 0.008;
// Quão depressa o zoom da roda e das teclas chega onde foi pedido
// (segundos, a constante de tempo).
const ZOOM_SUAVIDADE = 0.09;

// Rodar e inclinar com o rato (graus por ponto de ecrã), com dois dedos a
// subir ou a descer (graus por ponto), e com o stick direito do comando
// (graus por segundo, com o stick todo inclinado).
const RODAR_COM_O_RATO = 0.35;
const INCLINAR_COM_O_RATO = 0.3;
const INCLINAR_COM_OS_DEDOS = 0.35;
const RODAR_COM_AS_TECLAS = 70;
const INCLINAR_COM_AS_TECLAS = 40;
// Dois dedos só começam a rodar o bairro depois de rodarem isto um à volta
// do outro (graus): uma pinça nunca é perfeitamente direita.
const RODAR_COM_OS_DEDOS_A_PARTIR_DE = 15;

// Quanto a câmara pode olhar para baixo (a pique) e quanto pode ir para o
// horizonte, em graus. Como no Google Maps, não se olha para o céu.
const INCLINACAO_MINIMA = -89.5;
const INCLINACAO_MAXIMA = -10;

// A altura mínima a que a câmara anda (metros, no sistema do mapa), e o
// mais perto que o zoom chega do sítio para onde se aproxima.
const ALTURA_MINIMA = 15;
const PERTO_MINIMO = 4;

// Os limites não são paredes. Chegando-se a um, o gesto rende cada vez
// menos, e o limite alcança-se devagar, sem batida (ver `andarAteAoLimite`):
// nos últimos ZONA_DA_INCLINACAO graus antes da vista a pique e do
// horizonte, nos últimos ZONA_DA_ALTURA metros antes da altura mínima ou do
// tecto, e nos últimos ZONA_DE_PERTO metros antes do sítio para onde se
// aproxima.
const ZONA_DA_INCLINACAO = 8;
const ZONA_DA_ALTURA = 8;
const ZONA_DE_PERTO = 6;

// A viagem do duplo clique: quanto demora (segundos), e quanto mais
// demora até à distância em que deixa de crescer (metros).
const VIAGEM_DURACAO_MINIMA = 0.55;
const VIAGEM_DURACAO_EXTRA = 0.35;
const VIAGEM_DISTANCIA_LONGA = 150;

// A que altura fica o chão do bairro, para quando a placa gráfica ainda não
// disse o que está debaixo do rato (em metros, no sistema do mapa). Cada
// leitura acerta esta conta.
const ALTURA_DO_CHAO = -3;

// Até onde um sítio pode estar para lá da beira do terreno e ainda contar
// como bairro (em metros). Mais longe é o céu ou a paisagem ao fundo, e aí
// o duplo clique só aproxima, sem lá ir.
const FOLGA_FORA_DO_TERRENO = 25;

/**
 * Começa devagar, anda, e acaba devagar (a curva cúbica de entrada e
 * saída).
 *
 * @param {number} t - De zero a um.
 * @returns {number} De zero a um.
 */
const entradaESaida = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Quanto se anda, de facto, em direcção a um limite.
 *
 * Até à zona antes do limite anda-se tudo o que se pede. Dentro dela a
 * velocidade é proporcional ao que falta: quanto mais perto, mais devagar,
 * e o limite alcança-se a abrandar, sem batida. A conta é a exacta desse
 * abrandamento, e por isso dá o mesmo com passos grandes ou pequenos — com
 * o rato depressa ou devagar, com muitas imagens por segundo ou poucas.
 * Para longe do limite anda-se sempre tudo.
 *
 * @param {number} passo - Quanto se pede (positivo é em direcção ao limite).
 * @param {number} falta - Quanto falta até ao limite.
 * @param {number} zona - O tamanho da zona em que se abranda.
 * @returns {number} Quanto se anda.
 */
const andarAteAoLimite = (passo, falta, zona) => {
    if (!(passo > 0)) {
        return passo;
    }
    if (!(falta > 0)) {
        return 0;
    }
    let andado = 0;
    if (falta > zona) {
        const livre = Math.min(passo, falta - zona);
        andado += livre;
        passo -= livre;
        falta -= livre;
    }
    if (passo > 0) {
        andado += falta * (1 - Math.exp(-passo / zona));
    }
    return andado;
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
     * @type {GamepadSource}
     * @private
     */
    _gamepadInput = new ComandoDeJogo();

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
     * O que as setas estão a pedir, somado à parte do WASD.
     *
     * Fica à parte porque as setas têm dois trabalhos — andar, ou rodar e
     * inclinar com o Shift ou o Alt em baixo — e só assim se lhes pode dar
     * um ou outro sem partir a soma.
     *
     * @type {Vec3}
     * @private
     */
    _setas = new Vec3();

    /**
     * A viagem em curso — a do duplo clique, até ao sítio apontado, ou uma
     * das da navegação (ver `viajar`) —, ou nada.
     *
     * @type {{de: Vec3, para: Vec3, inclinacao0: number, inclinacao1: number,
     *         rumo0: number, rumo1: number, t: number, duracao: number}|null}
     * @private
     */
    _viagem = null;

    /**
     * O leitor de profundidade que diz que sítio do bairro está debaixo do
     * rato ou do dedo. Nasce no primeiro gesto.
     *
     * @type {Picker|null}
     * @private
     */
    _leitorDoSitio = null;

    /**
     * Os gestos do rato e dos dedos em cima do bairro (ver
     * `_escutarGestos`): os ponteiros carregados, o gesto em curso e o que
     * ele agarrou.
     *
     * @private
     */
    _gestos = {
        // Os ponteiros (o rato, ou cada dedo) carregados na tela, pela
        // ordem em que pousaram.
        ponteiros: new Map(),
        // O gesto em curso: 'mover', 'rodar', 'dois', 'segundoToque',
        // 'zoomDedo', ou nada. Cada gesto novo tem um número novo, para as
        // leituras à placa gráfica que cheguem tarde saberem se ainda são
        // dele.
        modo: null,
        numero: 0,
        // O ponteiro que manda num gesto de um só.
        principal: null,
        // Já andou o bastante para mexer no bairro.
        arrastou: false,
        // O sítio agarrado (fica debaixo do rato, do dedo ou do meio dos
        // dois dedos) e até onde pode ir, pelo chão.
        ancora: new Vec3(),
        alcance: ALCANCE_DO_ARRASTO,
        // A altura do sítio à volta do qual se roda e inclina (o do meio
        // do ecrã).
        alturaDoPivo: ALTURA_DO_CHAO,
        // Por onde a câmara andou nos últimos instantes do arrasto, para o
        // balanço ao largar, e quando o ponteiro se mexeu pela última vez.
        rasto: [],
        ultimoMovimento: 0,
        // Rodar e inclinar com o rato: onde estava o rato no instante
        // anterior, e quanto já andou para cada lado (para se saber que
        // gesto foi).
        ultX: 0,
        ultY: 0,
        somaX: 0,
        somaY: 0,
        // Dois dedos: como estavam ao pousar e no instante anterior, o que
        // o gesto é ('mapa' ou 'inclinar', decidido nos primeiros pontos), e
        // quanto já rodaram um à volta do outro.
        t0Dois: 0,
        dist0: 0,
        decidido: null,
        ultMeioX: 0,
        ultMeioY: 0,
        ultDist: 0,
        ultAngulo: 0,
        giroAcumulado: 0,
        aRodar: false,
        // O último clique e o último toque, para se saber se o seguinte
        // faz um duplo.
        ultimoClique: null,
        ultimoToque: null,
        // Se o ponteiro que manda pode ainda fazer um carregar sem largar
        // (ver PREMIR_DURACAO), e se já se avisou de que pode vir um.
        premir: false,
        premirAvisado: false,
        // Mexeu-se no bairro desde a última imagem (é pegar na câmara: ver
        // 'mexeu').
        pegou: false
    };

    /**
     * Se carregar sem largar num sítio do bairro (ou carregar e largar o
     * botão direito, sem arrastar) marca esse sítio. É a página que o liga,
     * quando tem com que mostrar o local marcado (ver "O local marcado", no
     * index.html), e que o desliga enquanto não faz sentido (a guiar até a
     * um sítio). Desligado, carregar sem largar é só um arrasto que não
     * andou.
     *
     * Marcar diz-se à página com o aviso 'premirNoBairro', na janela, com o
     * sítio (x, y, z no bairro) e o ponto do ecrã onde se carregou; um
     * instante antes, ainda com o rato ou o dedo em baixo, vem
     * 'aPremirNoBairro', sem sítio.
     *
     * @type {boolean}
     */
    marcarAoPremir = false;

    /**
     * O zoom a deslizar (roda, teclas, toques), ou nada: o sítio para onde
     * se aproxima, quanto falta (em logaritmo da distância) e, para a
     * roda, onde está o rato.
     *
     * @type {{ancora: Vec3, falta: number, x: number|null, y: number|null, quando: number}|null}
     * @private
     */
    _zoomAnimado = null;

    /**
     * A volta a deslizar até ao norte (ver `virarParaNorte`), em graus que
     * faltam, ou nada.
     *
     * @type {number|null}
     * @private
     */
    _giroAnimado = null;

    /**
     * O balanço depois de largar um arrasto: a velocidade, em metros por
     * segundo, ou nada.
     *
     * @type {Vec3|null}
     * @private
     */
    _balanco = null;

    /**
     * A velocidade a que as teclas (e o stick do comando) rodam e
     * inclinam, a acompanhar a tecla com suavidade.
     *
     * @type {Vec2}
     * @private
     */
    _giroDasTeclas = new Vec2();

    /**
     * Quanto falta olhar com o Alt e as setas (graus de rumo e de
     * inclinação): cada imagem com as teclas em baixo pede mais, e a vista
     * vai atrás, com suavidade.
     *
     * @type {Vec2}
     * @private
     */
    _olharPorFazer = new Vec2();

    /**
     * A altura do chão do bairro, como a última leitura à placa gráfica a
     * deu: é o chão que se agarra enquanto a leitura de um gesto novo não
     * chega.
     *
     * @type {number}
     * @private
     */
    _alturaDoChao = ALTURA_DO_CHAO;

    /**
     * A altura do sítio no meio do ecrã, à volta do qual se roda e
     * inclina (ver `_pedirAlturaDoPivo`).
     *
     * @type {number|undefined}
     * @private
     */
    _alturaDoPivo = undefined;

    /**
     * Quanto o tecto ou a altura mínima mudaram a distância da câmara ao
     * meio do ecrã, enquanto se inclinava (ver `_rodarEInclinar`): negativo
     * se o tecto a aproximou, positivo se o chão a afastou. Inclinando no
     * outro sentido, desfaz-se. Arrastar o bairro e rodá-lo não o mudam;
     * aproximar ou afastar com a roda, a pinça ou as teclas, as viagens e o
     * recentrar dão-lhe uma distância nova, e ele volta a zero.
     *
     * @type {number}
     * @private
     */
    _desvio = 0;

    /**
     * Se as teclas (ou o stick) já estavam a rodar na imagem anterior:
     * ao começar, pergunta-se a altura do meio do ecrã.
     *
     * @type {boolean}
     * @private
     */
    _aRodarDeTecla = false;

    /**
     * Quando se avisou, por nome, que cada gesto foi feito (ver
     * `_avisarGesto`).
     *
     * @private
     */
    _gestosAvisados = {};

    _state = {
        axis: new Vec3(),
        shift: 0,
        ctrl: 0
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

        // O teclado e o comando de jogo vêm pelo motor. O rato e os dedos
        // são ouvidos à parte, para se saber sempre onde estão no ecrã (ver
        // `_escutarGestos`); do que o motor diz deles só fica o travar do
        // menu do botão direito e do deslizar da página com a roda.
        this._desktopInput.attach(this.app.graphicsDevice.canvas);
        this._gamepadInput.attach(this.app.graphicsDevice.canvas);
        this._escutarGestos(this.app.graphicsDevice.canvas);

        // pose
        const startPos = this._camera.entity.getPosition();
        const startTarget = new Vec3().copy(this._camera.entity.forward).mulScalar(200).add(startPos);
        this._pose.look(startPos, startTarget);

        // mode
        this._setMode('fly');

        // Desligada (com uma janela ou um menu à frente, ou nos óculos), a
        // câmara esquece o que vinha a meio: teclas, gestos, balanços.
        this.on('state', () => {
            this._desktopInput.read();
            this._gamepadInput.read();
            this._largarTudo();
        });

        // destroy
        this.on('destroy', this._destroy, this);
    }

    /**
     * @private
     */
    _destroy() {
        this._desktopInput.destroy();
        this._gamepadInput.destroy();

        this._flyController.destroy();
        this._orbitController.destroy();

        if (this._largarGestos) {
            this._largarGestos();
        }
    }

    /**
     * Ouve o rato, os dedos, a roda e as teclas + e − em cima do bairro
     * (ver "Navegar como no Google Maps", no princípio do ficheiro).
     *
     * Aqui só se toma nota de onde estão os ponteiros e de que gesto
     * começou; o bairro mexe-se a cada imagem, em `update`, com a última
     * posição de cada ponteiro (ver `_aplicarGestos`). Os marcadores e os
     * menus estão por cima do bairro e ficam-lhe com o rato: aqui só chega
     * o que é do bairro.
     *
     * @param {HTMLCanvasElement} tela - A tela onde o bairro é desenhado.
     * @private
     */
    _escutarGestos(tela) {
        const g = this._gestos;
        const naTela = (e) => {
            const caixa = tela.getBoundingClientRect();
            return [e.clientX - caixa.left, e.clientY - caixa.top];
        };

        // A mão aberta por cima do bairro, como no Google Maps; fechada
        // enquanto o agarra.
        tela.style.cursor = 'grab';

        const aoPousar = (e) => {
            if (!this._podeMexer()) {
                return;
            }
            const rato = e.pointerType === 'mouse';
            // Um rato de cada vez; dedos, contam os dois primeiros.
            if (rato ? g.ponteiros.size > 0 : g.ponteiros.size >= 2) {
                return;
            }
            // O botão do meio não abre o deslizar automático do navegador.
            if (rato && e.button === 1) {
                e.preventDefault();
            }
            const [x, y] = naTela(e);
            const agora = performance.now();
            const ponteiro = { id: e.pointerId, tipo: e.pointerType, x, y, x0: x, y0: y, t0: agora };
            g.ponteiros.set(e.pointerId, ponteiro);
            try {
                tela.setPointerCapture(e.pointerId);
            } catch (erro) { /* segue sem: os gestos só contam em cima da tela */ }

            // Pegar no bairro pára o que estava a andar sozinho.
            this._balanco = null;
            this._zoomAnimado = null;
            this._giroAnimado = null;

            if (rato) {
                const rodar = e.button === 1 || e.button === 2 ||
                    (e.button === 0 && (e.ctrlKey || e.metaKey || e.shiftKey));
                if (rodar) {
                    this._comecarARodar(ponteiro);
                } else if (e.button === 0) {
                    this._comecarAMover(ponteiro);
                } else {
                    g.ponteiros.delete(e.pointerId);
                }
                return;
            }
            if (g.ponteiros.size === 2) {
                this._comecarDoisDedos();
                return;
            }
            const antes = g.ultimoToque;
            if (antes && agora - antes.t < DUPLO_INTERVALO &&
                    Math.hypot(x - antes.x, y - antes.y) < DUPLO_DISTANCIA) {
                this._comecarSegundoToque(ponteiro);
            } else {
                this._comecarAMover(ponteiro);
            }
        };

        const aoMexer = (e) => {
            const ponteiro = g.ponteiros.get(e.pointerId);
            if (!ponteiro) {
                return;
            }
            const [x, y] = naTela(e);
            if (x !== ponteiro.x || y !== ponteiro.y) {
                ponteiro.x = x;
                ponteiro.y = y;
                g.ultimoMovimento = performance.now();
            }
            // Afastou-se do sítio onde pousou mais do que um clique deixa:
            // já não é um carregar sem largar, nem que volte para trás.
            if (g.premir && ponteiro.id === g.principal) {
                const limite = ponteiro.tipo === 'mouse' ? CLIQUE_MEXIDA_RATO : CLIQUE_MEXIDA_DEDO;
                if (Math.hypot(x - ponteiro.x0, y - ponteiro.y0) > limite) {
                    g.premir = false;
                }
            }
        };

        /**
         * Um ponteiro saiu: o rato largou-se, o dedo levantou-se — ou o
         * navegador ficou com ele (`desistiu`), e aí não conta como clique
         * nem como toque.
         *
         * @param {PointerEvent} e - O aviso.
         * @param {boolean} desistiu - Se o navegador tirou o ponteiro.
         */
        const aoLargar = (e, desistiu) => {
            const ponteiro = g.ponteiros.get(e.pointerId);
            if (!ponteiro) {
                return;
            }
            if (!desistiu) {
                const [x, y] = naTela(e);
                ponteiro.x = x;
                ponteiro.y = y;
            }
            g.ponteiros.delete(e.pointerId);
            try {
                if (tela.hasPointerCapture(e.pointerId)) {
                    tela.releasePointerCapture(e.pointerId);
                }
            } catch (erro) { /* já não o tinha */ }
            const agora = performance.now();
            const mexida = Math.hypot(ponteiro.x - ponteiro.x0, ponteiro.y - ponteiro.y0);
            const depressa = agora - ponteiro.t0 <= CLIQUE_DURACAO_MAXIMA;

            if (ponteiro.tipo === 'mouse') {
                const arrastou = g.arrastou;
                const modo = g.modo;
                this._acabarGesto(!desistiu);
                // Largar depois de um carregar sem largar não é clique.
                if (modo === 'premido') {
                    g.ultimoClique = null;
                    return;
                }
                // O botão direito carregado e largado sem arrastar: como no
                // Google Maps no computador, marca o sítio.
                if (!desistiu && e.button === 2 && modo === 'rodar' && !arrastou &&
                        mexida <= CLIQUE_MEXIDA_RATO && this.marcarAoPremir && this._podeApontar()) {
                    g.ultimoClique = null;
                    this._marcarSitio(ponteiro.x, ponteiro.y);
                    return;
                }
                const clique = !desistiu && e.button === 0 && !arrastou && depressa &&
                    mexida <= CLIQUE_MEXIDA_RATO &&
                    !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
                if (!clique) {
                    g.ultimoClique = null;
                    return;
                }
                const antes = g.ultimoClique;
                if (antes && agora - antes.t < DUPLO_INTERVALO + 130 &&
                        Math.hypot(ponteiro.x - antes.x, ponteiro.y - antes.y) < DUPLO_DISTANCIA) {
                    g.ultimoClique = null;
                    this._duploNoBairro(ponteiro.x, ponteiro.y);
                } else {
                    g.ultimoClique = { t: agora, x: ponteiro.x, y: ponteiro.y };
                }
                return;
            }

            // Os dedos. Largar depois de um carregar sem largar não é toque.
            if (g.modo === 'premido') {
                g.ultimoToque = null;
                this._acabarGesto(false);
                return;
            }
            if (g.modo === 'dois') {
                // Os dois a tocar e a largar sem mexer: afastar.
                if (!desistiu && !g.decidido && agora - g.t0Dois <= TOQUE_DE_DOIS_DEDOS) {
                    this._toqueDeDoisDedos();
                }
                g.ultimoToque = null;
                const resta = g.ponteiros.values().next().value;
                if (resta) {
                    // Fica um dedo: continua a arrastar com ele.
                    this._comecarAMover(resta, true);
                } else {
                    this._acabarGesto(false);
                }
                return;
            }
            if (g.modo === 'segundoToque') {
                if (!desistiu && depressa && mexida <= CLIQUE_MEXIDA_DEDO) {
                    this._duploNoBairro(ponteiro.x, ponteiro.y);
                }
                g.ultimoToque = null;
                this._acabarGesto(false);
                return;
            }
            if (g.modo === 'zoomDedo') {
                g.ultimoToque = null;
                this._acabarGesto(false);
                return;
            }
            const toque = !desistiu && !g.restoDeDois && !g.arrastou && depressa &&
                mexida <= CLIQUE_MEXIDA_DEDO;
            this._acabarGesto(!desistiu);
            g.ultimoToque = toque ? { t: agora, x: ponteiro.x, y: ponteiro.y } : null;
        };
        const aoLevantar = e => aoLargar(e, false);
        const aoPerder = e => aoLargar(e, true);

        const aoRodarARoda = (e) => {
            if (!this._podeMexer()) {
                return;
            }
            e.preventDefault();
            let pontos = e.deltaY;
            if (e.deltaMode === 1) {
                pontos *= 33;
            } else if (e.deltaMode === 2) {
                pontos *= 800;
            }
            if (!pontos) {
                return;
            }
            // Cada passo da roda vale um passo de zoom, seja qual for o
            // rato: o Chrome conta-o como 100 pontos num, 120 ou 150 noutro.
            // Os bocadinhos de um teclado tátil passam como vêm.
            if (!e.ctrlKey) {
                pontos = Math.sign(pontos) * Math.min(Math.abs(pontos), 100);
            }
            const [x, y] = naTela(e);
            this._zoomNoPonto(x, y, pontos * (e.ctrlKey ? ZOOM_DA_PINCA_TATIL : ZOOM_DA_RODA));
        };

        // O + e o − aproximam e afastam, em direcção ao meio do ecrã. Com o
        // Ctrl são do navegador (o tamanho da página), e dentro de uma
        // caixa de escrever são letras.
        const editavel = alvo => !!alvo && (alvo.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName || ''));
        const aoCarregarNaTecla = (e) => {
            if (!this._podeMexer() || e.ctrlKey || e.metaKey || e.altKey || editavel(e.target) ||
                    this._janelaAFrente()) {
                return;
            }
            let fator = 0;
            if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
                fator = ZOOM_DAS_TECLAS;
            } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
                fator = 1 / ZOOM_DAS_TECLAS;
            }
            if (!fator) {
                return;
            }
            e.preventDefault();
            this._zoomNoMeio(Math.log(fator));
        };

        // Quem sai da janela a meio de um gesto não o larga cá dentro.
        const aoSairDaJanela = () => this._largarTudo();

        tela.addEventListener('pointerdown', aoPousar);
        tela.addEventListener('pointermove', aoMexer);
        tela.addEventListener('pointerup', aoLevantar);
        tela.addEventListener('pointercancel', aoPerder);
        tela.addEventListener('lostpointercapture', aoPerder);
        tela.addEventListener('wheel', aoRodarARoda, { passive: false });
        window.addEventListener('keydown', aoCarregarNaTecla);
        window.addEventListener('blur', aoSairDaJanela);

        this._largarGestos = () => {
            tela.removeEventListener('pointerdown', aoPousar);
            tela.removeEventListener('pointermove', aoMexer);
            tela.removeEventListener('pointerup', aoLevantar);
            tela.removeEventListener('pointercancel', aoPerder);
            tela.removeEventListener('lostpointercapture', aoPerder);
            tela.removeEventListener('wheel', aoRodarARoda);
            window.removeEventListener('keydown', aoCarregarNaTecla);
            window.removeEventListener('blur', aoSairDaJanela);
        };
    }

    /**
     * Se neste momento o bairro se pode mexer à mão: não com os óculos
     * postos (os de VR ou os de cartão), nem com a câmara desligada.
     *
     * @returns {boolean} Se pode.
     * @private
     */
    _podeMexer() {
        if (!this.enabled || this.app.xr?.active) {
            return false;
        }
        return !(typeof document !== 'undefined' && document.body.classList.contains('em-cartao'));
    }

    /**
     * Se há uma janela à frente do bairro (um vídeo, uma paragem 360º):
     * aí as teclas são dela.
     *
     * @returns {boolean} Se há.
     * @private
     */
    _janelaAFrente() {
        if (typeof document === 'undefined') {
            return false;
        }
        return ['video-modal', 'modal-360'].some((id) => {
            const el = document.getElementById(id);
            return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
        });
    }

    /**
     * Se, neste momento, o duplo clique leva a algum lado: com a ferramenta
     * de medir ligada no menu de desenvolvedor, os cliques são dela.
     *
     * @returns {boolean} Se leva.
     * @private
     */
    _podeApontar() {
        if (!this._podeMexer()) {
            return false;
        }
        if (typeof document !== 'undefined') {
            const medir = document.getElementById('dev-measure-mode');
            if (medir && medir.checked) {
                return false;
            }
        }
        return true;
    }

    /**
     * Diz a quem queira ouvir que um gesto foi feito — as instruções do
     * site esperam por cada um para passar ao seguinte (ver
     * "As instruções", no index.html). Os nomes são 'mover', 'aproximar',
     * 'rodar' e 'inclinar'. O mesmo gesto, repetido seguido, só se diz de
     * tempos a tempos.
     *
     * @param {string} nome - O gesto.
     * @private
     */
    _avisarGesto(nome) {
        const agora = performance.now();
        const antes = this._gestosAvisados[nome];
        if (antes !== undefined && agora - antes < 400) {
            return;
        }
        this._gestosAvisados[nome] = agora;
        this.fire('gesto', nome);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gestoNoBairro', { detail: { gesto: nome } }));
        }
    }

    /**
     * Começa a arrastar o bairro com um ponteiro (o rato, ou um dedo).
     *
     * @param {object} ponteiro - O ponteiro.
     * @param {boolean} [restoDeDois] - É o dedo que ficou de um gesto de
     * dois: continua a arrastar logo, sem esperar que ande, e não conta
     * como toque.
     * @private
     */
    _comecarAMover(ponteiro, restoDeDois = false) {
        const g = this._gestos;
        const alturaAgarrada = g.ancora.y;
        g.modo = 'mover';
        g.numero++;
        g.principal = ponteiro.id;
        g.arrastou = restoDeDois;
        g.restoDeDois = restoDeDois;
        g.rasto.length = 0;
        // Parado aqui o bastante, marca o sítio (ver `_vigiarPremir`). O
        // dedo que fica de um gesto de dois já não.
        g.premir = !restoDeDois;
        g.premirAvisado = false;
        if (restoDeDois) {
            // Agarra o chão debaixo do dedo que ficou, à altura do que os
            // dois agarravam: sem leitura nova, sem salto.
            this._agarrar(ponteiro.x, ponteiro.y, alturaAgarrada, false);
        } else {
            this._agarrar(ponteiro.x, ponteiro.y, null, true);
        }
        if (ponteiro.tipo === 'mouse') {
            this.app.graphicsDevice.canvas.style.cursor = 'grabbing';
        }
    }

    /**
     * Começa a rodar e a inclinar o bairro com o rato (Ctrl, Shift, ou o
     * botão direito ou do meio).
     *
     * @param {object} ponteiro - O rato.
     * @private
     */
    _comecarARodar(ponteiro) {
        const g = this._gestos;
        g.modo = 'rodar';
        g.numero++;
        g.principal = ponteiro.id;
        g.arrastou = false;
        g.premir = false;
        g.ultX = ponteiro.x;
        g.ultY = ponteiro.y;
        g.somaX = 0;
        g.somaY = 0;
        this._pedirAlturaDoPivo();
        this.app.graphicsDevice.canvas.style.cursor = 'grabbing';
    }

    /**
     * Pousou o segundo dedo: começa o gesto de dois dedos. O que ele é —
     * pinça, rodar e arrastar ao mesmo tempo, ou inclinar — decide-se nos
     * primeiros pontos que os dedos andarem (ver `_aplicarGestos`).
     *
     * @private
     */
    _comecarDoisDedos() {
        const g = this._gestos;
        const [a, b] = g.ponteiros.values();
        g.modo = 'dois';
        g.numero++;
        g.principal = null;
        g.arrastou = false;
        g.restoDeDois = false;
        g.premir = false;
        g.t0Dois = performance.now();
        a.x0 = a.x;
        a.y0 = a.y;
        b.x0 = b.x;
        b.y0 = b.y;
        const meioX = (a.x + b.x) / 2;
        const meioY = (a.y + b.y) / 2;
        g.dist0 = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        g.ultDist = g.dist0;
        g.ultAngulo = Math.atan2(b.y - a.y, b.x - a.x);
        g.ultMeioX = meioX;
        g.ultMeioY = meioY;
        g.decidido = null;
        g.giroAcumulado = 0;
        g.aRodar = false;
        g.ultimoToque = null;
        this._agarrar(meioX, meioY, null, true);
        this._pedirAlturaDoPivo();
    }

    /**
     * O dedo pousou logo a seguir a um toque, no mesmo sítio: são dois
     * toques. Se largar já, aproxima; se ficar e arrastar, é o zoom de um
     * dedo só.
     *
     * @param {object} ponteiro - O dedo.
     * @private
     */
    _comecarSegundoToque(ponteiro) {
        const g = this._gestos;
        g.modo = 'segundoToque';
        g.numero++;
        g.principal = ponteiro.id;
        g.arrastou = false;
        g.restoDeDois = false;
        g.premir = false;
        g.ultY = ponteiro.y;
        this._agarrar(ponteiro.x, ponteiro.y, null, true);
    }

    /**
     * Acaba o gesto em curso. Se era um arrasto largado com balanço, o
     * bairro ainda desliza um pouco, e vai parando.
     *
     * @param {boolean} comBalanco - Se pode haver balanço.
     * @private
     */
    _acabarGesto(comBalanco) {
        const g = this._gestos;
        if (comBalanco && g.modo === 'mover' && g.arrastou) {
            const agora = performance.now();
            const rasto = g.rasto.filter(r => agora - r.t <= 100);
            if (rasto.length >= 2 && agora - g.ultimoMovimento <= BALANCO_PARADO) {
                const a = rasto[0];
                const b = rasto[rasto.length - 1];
                const segundos = (b.t - a.t) / 1000;
                if (segundos > 0.01) {
                    const velocidade = new Vec3((b.x - a.x) / segundos, 0, (b.z - a.z) / segundos);
                    const rapidez = velocidade.length();
                    if (rapidez > BALANCO_MINIMO * 2) {
                        if (rapidez > BALANCO_MAXIMO) {
                            velocidade.mulScalar(BALANCO_MAXIMO / rapidez);
                        }
                        this._balanco = velocidade;
                    }
                }
            }
        }
        g.modo = null;
        g.numero++;
        g.principal = null;
        g.arrastou = false;
        g.restoDeDois = false;
        g.premir = false;
        g.rasto.length = 0;
        if (this.app && this.app.graphicsDevice && this.app.graphicsDevice.canvas) {
            this.app.graphicsDevice.canvas.style.cursor = 'grab';
        }
    }

    /**
     * Esquece tudo o que vinha a meio: os gestos, os balanços, as teclas a
     * rodar.
     *
     * @private
     */
    _largarTudo() {
        const g = this._gestos;
        g.ponteiros.clear();
        this._acabarGesto(false);
        g.ultimoClique = null;
        g.ultimoToque = null;
        this._balanco = null;
        this._zoomAnimado = null;
        this._giroAnimado = null;
        this._giroDasTeclas.set(0, 0);
        this._olharPorFazer.set(0, 0);
        if (this._smoothMoveVelocity) {
            this._smoothMoveVelocity.set(0, 0, 0);
        }
    }

    /**
     * Agarra o sítio que está num ponto do ecrã, para o gesto em curso.
     *
     * Na hora, o sítio é onde o raio desse ponto bate no chão, à altura
     * dada (ou à do chão, como a última leitura o deu). Pedindo-se `ler`,
     * pergunta-se depois à placa gráfica o que lá está de facto — um
     * telhado, a rua, a encosta —, e quando ela responder (uma ou duas
     * imagens depois) o sítio agarrado passa a ser, no mesmo raio que o
     * ponteiro faz nesse instante, o que está a essa altura: o bairro não
     * salta, e o que se agarrou fica colado ao dedo.
     *
     * @param {number} px - Na tela, da esquerda.
     * @param {number} py - Na tela, de cima.
     * @param {number|null} altura - A altura do chão a agarrar, ou nada.
     * @param {boolean} ler - Se se pergunta à placa gráfica.
     * @private
     */
    _agarrar(px, py, altura, ler) {
        const g = this._gestos;
        const camara = this._pose.position;
        const h = Math.min(altura !== null && altura !== undefined ? altura : this._alturaDoChao, camara.y - 2);
        this._noPlano(this._raio(px, py, tmpV1), h, ALCANCE_DO_ARRASTO, g.ancora);
        g.alcance = Math.max(ALCANCE_DO_ARRASTO,
            1.25 * Math.hypot(g.ancora.x - camara.x, g.ancora.z - camara.z));
        if (!ler) {
            return;
        }
        const numero = g.numero;
        this._lerPonto(px, py).then((ponto) => {
            if (!ponto || g.numero !== numero || !g.modo) {
                return;
            }
            this._alturaDoChao = ponto.y;
            const onde = this._ondeAgarra();
            if (!onde) {
                return;
            }
            const agora = this._pose.position;
            this._noPlano(this._raio(onde[0], onde[1], tmpV1), Math.min(ponto.y, agora.y - 2),
                ALCANCE_DO_ARRASTO, g.ancora);
            g.alcance = Math.max(ALCANCE_DO_ARRASTO,
                1.25 * Math.hypot(g.ancora.x - agora.x, g.ancora.z - agora.z));
        });
    }

    /**
     * O ponto do ecrã que segura o sítio agarrado, neste instante: o
     * ponteiro, num gesto de um; o meio dos dois dedos, num de dois; o
     * sítio do segundo toque, no zoom de um dedo.
     *
     * @returns {number[]|null} O ponto, na tela.
     * @private
     */
    _ondeAgarra() {
        const g = this._gestos;
        if (g.modo === 'dois') {
            const [a, b] = g.ponteiros.values();
            return a && b ? [(a.x + b.x) / 2, (a.y + b.y) / 2] : null;
        }
        const p = g.ponteiros.get(g.principal);
        if (!p) {
            return null;
        }
        return (g.modo === 'segundoToque' || g.modo === 'zoomDedo') ? [p.x0, p.y0] : [p.x, p.y];
    }

    /**
     * Pergunta à placa gráfica a altura do que está no meio do ecrã: é à
     * volta dele que se roda e inclina. Até a resposta chegar, vale a do
     * chão.
     *
     * @private
     */
    _pedirAlturaDoPivo() {
        const tela = this.app.graphicsDevice.canvas;
        if (this._alturaDoPivo === undefined) {
            this._alturaDoPivo = this._alturaDoChao;
        }
        this._lerPonto((tela.clientWidth || 2) / 2, (tela.clientHeight || 2) / 2).then((ponto) => {
            if (ponto) {
                this._alturaDoPivo = ponto.y;
                this._alturaDoChao = ponto.y;
            }
        });
    }

    /**
     * O sítio do bairro que está num ponto do ecrã, lido à placa gráfica,
     * ou nada — se ali só houver céu, a paisagem muito ao fundo, ou se a
     * placa não o souber dizer.
     *
     * @param {number} px - Na tela, da esquerda.
     * @param {number} py - Na tela, de cima.
     * @returns {Promise<Vec3|null>} O sítio.
     * @private
     */
    _lerPonto(px, py, tentativas = 3) {
        const ler = this._prepararLeitura();
        if (!ler) {
            return Promise.resolve(null);
        }
        return ler(px, py).then((ponto) => {
            if (!ponto || !isFinite(ponto.x) || !isFinite(ponto.y) || !isFinite(ponto.z)) {
                // Logo a seguir a um salto da câmara o bairro ainda se está a
                // arrumar para a vista nova, e a leitura sai vazia: tenta-se
                // de novo um instante depois.
                if (tentativas > 1) {
                    return new Promise(r => setTimeout(r, 60)).then(() => this._lerPonto(px, py, tentativas - 1));
                }
                return null;
            }
            const camara = this._pose.position;
            if (ponto.y > camara.y - 1) {
                return null;
            }
            if (Math.hypot(ponto.x - camara.x, ponto.z - camara.z) > LONGE_DE_MAIS) {
                return null;
            }
            return ponto;
        }).catch(() => null);
    }

    /**
     * Manda a placa gráfica desenhar o bairro para o leitor de
     * profundidade, e devolve com que se lê, depois, o sítio que está em
     * cada ponto do ecrã. Ou nada, se a placa não o souber fazer.
     *
     * A um quarto da resolução chega para acertar num sítio, e poupa a
     * placa gráfica.
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

        try {
            if (!this._leitorDoSitio) {
                this._leitorDoSitio = new Picker(this.app, largura, altura, true);
            } else if (this._leitorDoSitio.width !== largura || this._leitorDoSitio.height !== altura) {
                this._leitorDoSitio.resize(largura, altura);
            }
            this._leitorDoSitio.prepare(this._camera, this.app.scene);
        } catch (e) {
            return null;
        }

        const leitor = this._leitorDoSitio;
        return (px, py) => {
            const x = math.clamp(Math.floor(px * ESCALA), 0, largura - 1);
            const y = math.clamp(Math.floor(py * ESCALA), 0, altura - 1);
            return leitor.getWorldPointAsync(x, y).then(ponto => (ponto ? ponto.clone() : null));
        };
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
     * O raio que sai da câmara por um ponto do ecrã, contado a partir de
     * onde a câmara está agora (e não de onde estava na imagem anterior:
     * dentro de uma imagem ela pode já ter andado).
     *
     * @param {number} px - Na tela, da esquerda.
     * @param {number} py - Na tela, de cima.
     * @param {Vec3} out - Onde pôr a direcção do raio.
     * @returns {Vec3} A direcção, de comprimento um.
     * @private
     */
    _raio(px, py, out) {
        const tela = this.app.graphicsDevice.canvas;
        const largura = tela.clientWidth || 1;
        const altura = tela.clientHeight || 1;
        const aspecto = largura / altura;
        const abertura = (this._camera.fov || 60) * 0.5 * math.DEG_TO_RAD;
        const meiaAltura = this._camera.horizontalFov ? Math.tan(abertura) / aspecto : Math.tan(abertura);
        const meiaLargura = meiaAltura * aspecto;
        const nx = (2 * px / largura - 1) * meiaLargura;
        const ny = (1 - 2 * py / altura) * meiaAltura;
        const p = this._pose.angles.x * math.DEG_TO_RAD;
        const r = this._pose.angles.y * math.DEG_TO_RAD;
        const cp = Math.cos(p);
        const sp = Math.sin(p);
        const cr = Math.cos(r);
        const sr = Math.sin(r);
        // A frente, a direita e o cima da câmara.
        return out.set(
            -sr * cp + cr * nx + sr * sp * ny,
            sp + cp * ny,
            -cr * cp - sr * nx + cr * sp * ny
        ).normalize();
    }

    /**
     * Onde um raio da câmara bate num chão plano, à altura dada — mas
     * nunca mais longe, pelo chão, do que `alcance` (perto do horizonte o
     * raio iria bater muito longe, ou nunca).
     *
     * @param {Vec3} direcao - A direcção do raio.
     * @param {number} altura - A altura do chão.
     * @param {number} alcance - Até onde, pelo chão.
     * @param {Vec3} out - Onde pôr o sítio.
     * @returns {Vec3} O sítio.
     * @private
     */
    _noPlano(direcao, altura, alcance, out) {
        const c = this._pose.position;
        let t = direcao.y < -1e-6 ? (altura - c.y) / direcao.y : Infinity;
        if (!(t > 0)) {
            t = Infinity;
        }
        const pelaHorizontal = Math.hypot(direcao.x, direcao.z);
        if (pelaHorizontal > 1e-6) {
            t = Math.min(t, alcance / pelaHorizontal);
        }
        if (!isFinite(t)) {
            t = Math.max(0, c.y - altura);
        }
        return out.set(c.x + direcao.x * t, c.y + direcao.y * t, c.z + direcao.z * t);
    }

    /**
     * O sítio no meio do ecrã, à altura dada: é à volta dele que se roda e
     * inclina.
     *
     * @param {number} altura - A altura do chão lá.
     * @param {Vec3} out - Onde pôr o sítio.
     * @returns {Vec3} O sítio.
     * @private
     */
    _pivoDoMeio(altura, out) {
        const p = this._pose.angles.x * math.DEG_TO_RAD;
        const r = this._pose.angles.y * math.DEG_TO_RAD;
        const frente = tmpV4.set(-Math.sin(r) * Math.cos(p), Math.sin(p), -Math.cos(r) * Math.cos(p));
        return this._noPlano(frente, Math.min(altura, this._pose.position.y - 2), ALCANCE_DO_ARRASTO, out);
    }

    /**
     * Arrasta a câmara pelo chão até o sítio agarrado ficar debaixo do
     * ponto do ecrã dado.
     *
     * @param {number} px - Na tela, da esquerda.
     * @param {number} py - Na tela, de cima.
     * @param {Vec3} ancora - O sítio agarrado.
     * @param {number} alcance - Até onde, pelo chão, pode ir.
     * @private
     */
    _arrastarAte(px, py, ancora, alcance) {
        const onde = this._noPlano(this._raio(px, py, tmpV1), ancora.y, alcance, tmpV2);
        this._pose.position.x += ancora.x - onde.x;
        this._pose.position.z += ancora.z - onde.z;
    }

    /**
     * Aproxima a câmara de um sítio (ou afasta-a dele), pela linha que os
     * une: o sítio fica no mesmo ponto do ecrã. Não desce abaixo da altura
     * mínima, não sobe acima do tecto e não chega mais perto do que
     * PERTO_MINIMO — e chega a esses limites a abrandar, sem batida (ver
     * `andarAteAoLimite`). Contra a parede do céu, pára.
     *
     * @param {Vec3} ancora - O sítio.
     * @param {number} fator - Quanto fica da distância (menos de um
     * aproxima, mais de um afasta).
     * @returns {number} O fator que se aplicou de facto (um, se nada).
     * @private
     */
    _aproximar(ancora, fator) {
        if (!(fator > 0) || Math.abs(fator - 1) < 1e-6) {
            return 1;
        }
        const pos = this._pose.position;
        const dx = pos.x - ancora.x;
        const dy = pos.y - ancora.y;
        const dz = pos.z - ancora.z;
        const distancia = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distancia < 1e-3) {
            return 1;
        }
        const tecto = this._tectoAgora();
        // A câmara anda pela linha até ao sítio (aproximar) ou para trás
        // dela (afastar); por cada metro que anda, sobe ou desce `inclina`.
        const inclina = dy / distancia;
        const aproximar = fator < 1;
        let anda = distancia * Math.abs(1 - fator);
        if (aproximar) {
            anda = andarAteAoLimite(anda, distancia - PERTO_MINIMO, ZONA_DE_PERTO);
        }
        // Aproximar de um sítio mais baixo, ou afastar de um mais alto,
        // desce; o contrário sobe.
        const desce = aproximar ? inclina > 1e-3 : inclina < -1e-3;
        const sobe = aproximar ? inclina < -1e-3 : inclina > 1e-3;
        const porMetro = Math.abs(inclina);
        if (desce) {
            const descida = andarAteAoLimite(anda * porMetro, pos.y - ALTURA_MINIMA, ZONA_DA_ALTURA);
            anda = Math.min(anda, descida / porMetro);
        } else if (sobe) {
            const subida = andarAteAoLimite(anda * porMetro, tecto - pos.y, ZONA_DA_ALTURA);
            anda = Math.min(anda, subida / porMetro);
        }
        const f = aproximar ? 1 - anda / distancia : 1 + anda / distancia;
        if (!(Math.abs(f - 1) > 1e-6)) {
            return 1;
        }
        const nx = ancora.x + dx * f;
        const ny = ancora.y + dy * f;
        const nz = ancora.z + dz * f;
        if (f > 1 && !this.podeEstar(nx, ny, nz)) {
            return 1;
        }
        pos.set(nx, ny, nz);
        // A distância nova é a que se escolheu: o que o tecto ou o chão
        // tinham mudado ao inclinar já não se desfaz.
        this._desvio = 0;
        return f;
    }

    /**
     * Roda a câmara à volta da vertical que passa por um sítio: a câmara
     * anda à volta dele e vira-se o mesmo tanto, e o sítio fica no mesmo
     * ponto do ecrã.
     *
     * @param {Vec3} pivo - O sítio.
     * @param {number} graus - Quanto (mais é para a esquerda).
     * @private
     */
    _rodarAVoltaDe(pivo, graus) {
        if (!graus) {
            return;
        }
        const r = graus * math.DEG_TO_RAD;
        const c = Math.cos(r);
        const s = Math.sin(r);
        const pos = this._pose.position;
        const ox = pos.x - pivo.x;
        const oz = pos.z - pivo.z;
        pos.x = pivo.x + ox * c + oz * s;
        pos.z = pivo.z - ox * s + oz * c;
        this._pose.angles.y += graus;
    }

    /**
     * Roda e inclina o bairro à volta do sítio que está no meio do ecrã,
     * como no Google Maps: rodar anda à volta dele; inclinar muda o ângulo
     * à mesma distância dele.
     *
     * Só que a câmara não passa do tecto nem da altura mínima. Chegando a um
     * deles desliza por ele, e o meio continua no meio: no tecto (a caminho
     * da vista de cima) aproxima-se do meio, à mesma altura; no chão (a
     * caminho do horizonte) afasta-se dele. Chega-se a esses limites a
     * abrandar, e a inclinação abranda nos últimos graus antes da vista a
     * pique e do horizonte (ver `andarAteAoLimite`).
     *
     * O que um limite mudou na distância desfaz-se ao voltar para trás. A
     * câmara lembra-se da distância a que estava (ver `_desvio`) e,
     * inclinando no outro sentido, volta primeiro a ela, à mesma altura: a
     * aproximação do tecto desfaz-se, e a câmara já não desce mais perto do
     * que estava até ficar a apertar contra o chão. Inclinar para lá e para
     * cá deixa-a onde estava.
     *
     * @param {number} grausRumo - Quanto rodar (mais é para a esquerda).
     * @param {number} grausInclinacao - Quanto inclinar (mais é para o
     * horizonte, menos para a vista de cima).
     * @private
     */
    _rodarEInclinar(grausRumo, grausInclinacao) {
        if (this._alturaDoPivo === undefined) {
            this._alturaDoPivo = this._alturaDoChao;
        }
        const pivo = this._pivoDoMeio(this._alturaDoPivo, tmpV3);
        if (grausRumo) {
            this._rodarAVoltaDe(pivo, grausRumo);
        }
        if (!grausInclinacao) {
            return;
        }
        const pos = this._pose.position;
        const angulos = this._pose.angles;
        const distancia = pos.distance(pivo);
        if (distancia < 1e-3) {
            return;
        }
        const antes = entreMeiaVolta(angulos.x);
        const depois = grausInclinacao > 0
            ? antes + andarAteAoLimite(grausInclinacao, INCLINACAO_MAXIMA - antes, ZONA_DA_INCLINACAO)
            : antes - andarAteAoLimite(-grausInclinacao, antes - INCLINACAO_MINIMA, ZONA_DA_INCLINACAO);
        let d = distancia;
        const seno = Math.sin(-depois * math.DEG_TO_RAD);
        if (seno > 1e-3) {
            // A distância a que a câmara estaria sem os limites, e a que a
            // deixa à mesma altura com a inclinação nova.
            const nominal = Math.max(PERTO_MINIMO, distancia - this._desvio);
            const aMesmaAltura = (pos.y - pivo.y) / seno;
            if (this._desvio < -1e-3 && depois > antes) {
                // Aproximada pelo tecto, e a voltar para o horizonte:
                // afasta-se outra vez, à mesma altura, até onde estava.
                d = Math.min(nominal, Math.max(distancia, aMesmaAltura));
            } else if (this._desvio > 1e-3 && depois < antes) {
                // Afastada pelo chão, e a voltar para a vista de cima:
                // aproxima-se outra vez, à mesma altura, até onde estava.
                d = Math.max(nominal, Math.min(distancia, aMesmaAltura));
            } else {
                // À mesma distância do meio ia para `alturaPedida`. Perto do
                // tecto sobe cada vez menos, e perto do chão desce cada vez
                // menos — e a distância acerta-se para o meio ficar no meio.
                const alturaPedida = pivo.y + distancia * seno;
                const altura = alturaPedida >= pos.y
                    ? pos.y + andarAteAoLimite(alturaPedida - pos.y, this._tectoAgora() - pos.y, ZONA_DA_ALTURA)
                    : pos.y - andarAteAoLimite(pos.y - alturaPedida, pos.y - ALTURA_MINIMA, ZONA_DA_ALTURA);
                d = Math.max(PERTO_MINIMO, (altura - pivo.y) / seno);
            }
            this._desvio = d - nominal;
        }
        angulos.x = depois;
        const p = depois * math.DEG_TO_RAD;
        const r = angulos.y * math.DEG_TO_RAD;
        pos.set(
            pivo.x + Math.sin(r) * Math.cos(p) * d,
            pivo.y - Math.sin(p) * d,
            pivo.z + Math.cos(r) * Math.cos(p) * d
        );
    }

    /**
     * Começa (ou continua) o zoom a deslizar em direcção a um ponto do
     * ecrã — o da roda do rato. Rodadas seguidas no mesmo sítio somam-se.
     * Um ponto acima do horizonte não é sítio nenhum: aí aproxima-se do
     * meio do ecrã.
     *
     * @param {number} x - Na tela, da esquerda.
     * @param {number} y - Na tela, de cima.
     * @param {number} logaritmo - Quanto, em logaritmo da distância
     * (negativo aproxima).
     * @private
     */
    _zoomNoPonto(x, y, logaritmo) {
        const direcao = this._raio(x, y, tmpV1);
        if (direcao.y > -0.03) {
            this._zoomNoMeio(logaritmo);
            return;
        }
        const agora = performance.now();
        const z = this._zoomAnimado;
        this._gestos.pegou = true;
        this._avisarGesto('aproximar');
        if (z && z.x !== null && Math.hypot(z.x - x, z.y - y) < 6 && agora - z.quando < 600) {
            z.falta += logaritmo;
            z.quando = agora;
            return;
        }
        const camara = this._pose.position;
        const ancora = this._noPlano(direcao, Math.min(this._alturaDoChao, camara.y - 2), ALCANCE_DO_ARRASTO, new Vec3());
        const novo = { ancora, falta: (z ? z.falta : 0) + logaritmo, x, y, quando: agora };
        this._zoomAnimado = novo;
        this._lerPonto(x, y).then((ponto) => {
            if (!ponto || this._zoomAnimado !== novo) {
                return;
            }
            this._alturaDoChao = ponto.y;
            // O sítio passa a ser o que está mesmo debaixo do rato, no raio
            // que ele faz agora — o mesmo de antes, que o zoom não o tira de
            // lá.
            this._noPlano(this._raio(x, y, tmpV1), Math.min(ponto.y, this._pose.position.y - 2),
                ALCANCE_DO_ARRASTO, novo.ancora);
        });
    }

    /**
     * Começa (ou continua) o zoom a deslizar em direcção ao meio do ecrã —
     * o das teclas + e −, e o dos dois dedos a tocar.
     *
     * @param {number} logaritmo - Quanto, em logaritmo da distância
     * (negativo aproxima).
     * @private
     */
    _zoomNoMeio(logaritmo) {
        if (this._alturaDoPivo === undefined) {
            this._alturaDoPivo = this._alturaDoChao;
        }
        const z = this._zoomAnimado;
        this._gestos.pegou = true;
        this._avisarGesto('aproximar');
        if (z && z.x === null) {
            z.falta += logaritmo;
            z.quando = performance.now();
            return;
        }
        const ancora = this._pivoDoMeio(this._alturaDoPivo, new Vec3());
        this._zoomAnimado = { ancora, falta: (z ? z.falta : 0) + logaritmo, x: null, y: null, quando: performance.now() };
        this._pedirAlturaDoPivo();
    }

    /**
     * Dois cliques, ou dois toques, num sítio: como no Google Maps,
     * aproxima e traz esse sítio para o meio do ecrã. Fora do bairro (o
     * céu, a paisagem ao fundo) só aproxima.
     *
     * @param {number} x - Na tela, da esquerda.
     * @param {number} y - Na tela, de cima.
     * @private
     */
    _duploNoBairro(x, y) {
        if (!this._podeApontar()) {
            return;
        }
        this._avisarGesto('aproximar');
        this._lerPonto(x, y).then((ponto) => {
            const sitio = this._sitioValido(ponto);
            if (sitio) {
                this._alturaDoChao = sitio.y;
                this._aproximarDe(sitio);
            } else {
                this._zoomNoPonto(x, y, Math.log(ZOOM_DO_DUPLO));
            }
        });
    }

    /**
     * Carregar sem largar: o rato ou o dedo de um arrasto que ficou parado
     * no sítio onde pousou, PREMIR_DURACAO depois de pousar, marca esse
     * sítio. A meio do tempo avisa-se de que pode vir um ('aPremirNoBairro').
     *
     * @private
     */
    _vigiarPremir() {
        const g = this._gestos;
        if (!g.premir || g.modo !== 'mover' || !this.marcarAoPremir) {
            return;
        }
        const p = g.ponteiros.get(g.principal);
        if (!p || !this._podeApontar()) {
            return;
        }
        const tempo = performance.now() - p.t0;
        if (!g.premirAvisado && tempo >= PREMIR_AVISO) {
            g.premirAvisado = true;
            this._avisarPremir('aPremirNoBairro', p.x, p.y, null);
        }
        if (tempo < PREMIR_DURACAO) {
            return;
        }
        // O gesto acaba aqui: até largar, o ponteiro já não mexe no bairro,
        // e largá-lo não é clique, nem toque, nem dá balanço. (Se o arrasto
        // chegou a andar uns pontos, o sítio debaixo dele é o mesmo: era o
        // que estava agarrado.)
        g.premir = false;
        g.modo = 'premido';
        g.numero++;
        g.arrastou = false;
        g.rasto.length = 0;
        g.ultimoClique = null;
        g.ultimoToque = null;
        this._balanco = null;
        this._marcarSitio(p.x, p.y);
    }

    /**
     * Marca o sítio do bairro que está num ponto do ecrã: lê-o à placa
     * gráfica e, se for bairro (e não o céu, ou a paisagem ao fundo), diz-o
     * à página ('premirNoBairro').
     *
     * @param {number} x - Na tela, da esquerda.
     * @param {number} y - Na tela, de cima.
     * @private
     */
    _marcarSitio(x, y) {
        this._lerPonto(x, y).then((ponto) => {
            const sitio = this._sitioValido(ponto);
            if (sitio) {
                this._avisarPremir('premirNoBairro', x, y, sitio);
            }
        });
    }

    /**
     * Diz à página, na janela, que se carregou sem largar (ou que pode vir
     * a ser).
     *
     * @param {string} nome - 'premirNoBairro' ou 'aPremirNoBairro'.
     * @param {number} x - Na tela, da esquerda.
     * @param {number} y - Na tela, de cima.
     * @param {Vec3|null} sitio - O sítio do bairro, ou nada.
     * @private
     */
    _avisarPremir(nome, x, y, sitio) {
        if (typeof window === 'undefined') {
            return;
        }
        const tela = this.app.graphicsDevice.canvas.getBoundingClientRect();
        window.dispatchEvent(new CustomEvent(nome, {
            detail: {
                x: x + tela.left,
                y: y + tela.top,
                sitio: sitio ? { x: sitio.x, y: sitio.y, z: sitio.z } : null
            }
        }));
    }

    /**
     * Dois dedos a tocar ao mesmo tempo: como no Google Maps, afasta.
     *
     * @private
     */
    _toqueDeDoisDedos() {
        this._zoomNoMeio(-Math.log(ZOOM_DO_DUPLO));
    }

    /**
     * Leva a câmara, a deslizar, até ter o sítio no meio do ecrã, a metade
     * da distância — virada para o mesmo lado e tão inclinada como estava.
     * Não desce abaixo da altura mínima nem sobe acima do tecto.
     *
     * @param {Vec3} sitio - O sítio.
     * @private
     */
    _aproximarDe(sitio) {
        this.fire('mexeu');
        this._desvio = 0;
        const posicao = this._pose.position;
        const angulos = this._pose.angles;
        const p = entreMeiaVolta(angulos.x) * math.DEG_TO_RAD;
        const r = angulos.y * math.DEG_TO_RAD;
        const frente = new Vec3(-Math.sin(r) * Math.cos(p), Math.sin(p), -Math.cos(r) * Math.cos(p));
        const desce = -frente.y;
        let distancia = Math.max(PERTO_MINIMO, posicao.distance(sitio) * ZOOM_DO_DUPLO);
        if (desce > 0.01) {
            distancia = Math.max(distancia, (ALTURA_MINIMA - sitio.y) / desce);
            const tecto = this._tectoAgora();
            if (sitio.y + distancia * desce > tecto) {
                distancia = Math.max(PERTO_MINIMO, (tecto - sitio.y) / desce);
            }
        }
        const para = new Vec3(
            sitio.x - frente.x * distancia,
            sitio.y - frente.y * distancia,
            sitio.z - frente.z * distancia
        );
        const percurso = posicao.distance(para);
        if (percurso < 0.05) {
            return;
        }
        const inclinacao = entreMeiaVolta(angulos.x);
        this._viagem = {
            de: posicao.clone(),
            para,
            sitio: sitio.clone(),
            inclinacao0: inclinacao,
            inclinacao1: inclinacao,
            rumo0: angulos.y,
            rumo1: angulos.y,
            t: 0,
            duracao: VIAGEM_DURACAO_MINIMA + VIAGEM_DURACAO_EXTRA * Math.min(percurso / VIAGEM_DISTANCIA_LONGA, 1)
        };
    }

    /**
     * Vira o bairro para o norte, a deslizar, à volta do meio do ecrã —
     * como a bússola do Google Maps. A inclinação não muda.
     *
     * @param {number} [rumo] - O rumo em que o norte fica para cima no
     * ecrã (a bússola sabe qual é: ver compass.mjs).
     */
    virarParaNorte(rumo = 0) {
        const falta = entreMeiaVolta(rumo - this._pose.angles.y);
        if (Math.abs(falta) < 0.05) {
            return;
        }
        this._viagem = null;
        this._pedirAlturaDoPivo();
        this._giroAnimado = falta;
        this.fire('mexeu');
        this._avisarGesto('rodar');
    }

    /**
     * O sítio do bairro que está num ponto do ecrã, lido à placa gráfica
     * (ver `_lerPonto`), para quem precise de saber o que ali se vê — o
     * local marcado que chega por uma ligação acerta assim a altura a que
     * fica (ver navegacao-3d.mjs).
     *
     * @param {number} x - Na tela, da esquerda.
     * @param {number} y - Na tela, de cima.
     * @returns {Promise<Vec3|null>} O sítio, ou nada.
     */
    lerPonto(x, y) {
        return this._lerPonto(x, y);
    }

    /**
     * Mexe no bairro conforme os gestos que estão a ser feitos, com a
     * última posição de cada ponteiro.
     *
     * @private
     */
    _aplicarGestos() {
        const g = this._gestos;
        if (!g.modo) {
            return;
        }

        if (g.modo === 'mover') {
            const p = g.ponteiros.get(g.principal);
            if (!p) {
                return;
            }
            if (!g.arrastou) {
                const limiar = p.tipo === 'mouse' ? ARRASTO_MINIMO_RATO : ARRASTO_MINIMO_DEDO;
                if (Math.hypot(p.x - p.x0, p.y - p.y0) < limiar) {
                    return;
                }
                g.arrastou = true;
            }
            const pos = this._pose.position;
            const antesX = pos.x;
            const antesZ = pos.z;
            this._arrastarAte(p.x, p.y, g.ancora, g.alcance);
            if (Math.abs(pos.x - antesX) + Math.abs(pos.z - antesZ) > 1e-6) {
                g.pegou = true;
                this._avisarGesto('mover');
            }
            const agora = performance.now();
            g.rasto.push({ t: agora, x: pos.x, z: pos.z });
            while (g.rasto.length > 2 && agora - g.rasto[0].t > 150) {
                g.rasto.shift();
            }
            return;
        }

        if (g.modo === 'rodar') {
            const p = g.ponteiros.get(g.principal);
            if (!p) {
                return;
            }
            const dx = p.x - g.ultX;
            const dy = p.y - g.ultY;
            g.ultX = p.x;
            g.ultY = p.y;
            if (!g.arrastou) {
                if (Math.hypot(p.x - p.x0, p.y - p.y0) < ARRASTO_MINIMO_RATO) {
                    return;
                }
                g.arrastou = true;
            }
            if (!dx && !dy) {
                return;
            }
            g.somaX += Math.abs(dx);
            g.somaY += Math.abs(dy);
            this._rodarEInclinar(-dx * RODAR_COM_O_RATO, -dy * INCLINAR_COM_O_RATO);
            g.pegou = true;
            if (g.somaX > 20) {
                this._avisarGesto('rodar');
            }
            if (g.somaY > 20) {
                this._avisarGesto('inclinar');
            }
            return;
        }

        if (g.modo === 'segundoToque' || g.modo === 'zoomDedo') {
            const p = g.ponteiros.get(g.principal);
            if (!p) {
                return;
            }
            if (g.modo === 'segundoToque') {
                if (Math.hypot(p.x - p.x0, p.y - p.y0) < CLIQUE_MEXIDA_DEDO) {
                    return;
                }
                g.modo = 'zoomDedo';
                g.ultY = p.y;
                return;
            }
            const dy = p.y - g.ultY;
            g.ultY = p.y;
            if (dy) {
                this._aproximar(g.ancora, Math.exp(-dy * ZOOM_DE_UM_DEDO));
                g.pegou = true;
                this._avisarGesto('aproximar');
            }
            return;
        }

        if (g.modo === 'dois') {
            const [a, b] = g.ponteiros.values();
            if (!a || !b) {
                return;
            }
            const meioX = (a.x + b.x) / 2;
            const meioY = (a.y + b.y) / 2;
            const distancia = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
            const angulo = Math.atan2(b.y - a.y, b.x - a.x);

            if (!g.decidido) {
                const ax = a.x - a.x0;
                const ay = a.y - a.y0;
                const bx = b.x - b.x0;
                const by = b.y - b.y0;
                const ma = Math.hypot(ax, ay);
                const mb = Math.hypot(bx, by);
                if (Math.max(ma, mb) < 8 && Math.abs(distancia - g.dist0) < 8) {
                    // Ainda não se sabe o que é: espera-se mais um pouco.
                    g.ultMeioX = meioX;
                    g.ultMeioY = meioY;
                    g.ultDist = distancia;
                    g.ultAngulo = angulo;
                    return;
                }
                // Inclinar: os dois dedos lado a lado, a subir ou a descer
                // juntos, sem se afastarem um do outro.
                const aoAlto = (vx, vy) => Math.abs(vy) > 1.5 * Math.abs(vx);
                const ladoALado = Math.abs(b.y0 - a.y0) < Math.abs(b.x0 - a.x0);
                const juntos = ay * by > 0;
                const pinca = Math.abs(distancia - g.dist0) / g.dist0;
                g.decidido = (ma > 4 && mb > 4 && aoAlto(ax, ay) && aoAlto(bx, by) &&
                    juntos && ladoALado && pinca < 0.15) ? 'inclinar' : 'mapa';
            }

            if (g.decidido === 'inclinar') {
                const dy = meioY - g.ultMeioY;
                if (dy) {
                    this._rodarEInclinar(0, -dy * INCLINAR_COM_OS_DEDOS);
                    g.pegou = true;
                    this._avisarGesto('inclinar');
                }
            } else {
                // A pinça: o sítio entre os dedos fica onde está, e o resto
                // aproxima-se ou afasta-se dele.
                const fator = g.ultDist / distancia;
                if (Math.abs(fator - 1) > 1e-4) {
                    this._aproximar(g.ancora, fator);
                    g.pegou = true;
                    if (Math.abs(distancia - g.dist0) > 24) {
                        this._avisarGesto('aproximar');
                    }
                }
                // Rodar: os dedos a rodar um à volta do outro rodam o
                // bairro com eles, depois de passarem do limiar.
                let volta = angulo - g.ultAngulo;
                while (volta > Math.PI) volta -= 2 * Math.PI;
                while (volta < -Math.PI) volta += 2 * Math.PI;
                const graus = volta * math.RAD_TO_DEG;
                if (!g.aRodar) {
                    g.giroAcumulado += graus;
                    if (Math.abs(g.giroAcumulado) >= RODAR_COM_OS_DEDOS_A_PARTIR_DE) {
                        g.aRodar = true;
                    }
                } else if (graus) {
                    this._rodarAVoltaDe(g.ancora, graus);
                    g.pegou = true;
                    this._avisarGesto('rodar');
                }
                // E o sítio agarrado vai com o meio dos dedos.
                const pos = this._pose.position;
                const antesX = pos.x;
                const antesZ = pos.z;
                this._arrastarAte(meioX, meioY, g.ancora, g.alcance);
                if (Math.abs(pos.x - antesX) + Math.abs(pos.z - antesZ) > 1e-6) {
                    g.pegou = true;
                    if (Math.hypot(meioX - (a.x0 + b.x0) / 2, meioY - (a.y0 + b.y0) / 2) > 24) {
                        this._avisarGesto('mover');
                    }
                }
            }
            g.ultMeioX = meioX;
            g.ultMeioY = meioY;
            g.ultDist = distancia;
            g.ultAngulo = angulo;
        }
    }

    /**
     * O zoom a deslizar: anda a cada imagem uma parte do que falta, e
     * acaba devagar.
     *
     * @param {number} dt - O tempo desta imagem, em segundos.
     * @private
     */
    _aplicarZoomAnimado(dt) {
        const z = this._zoomAnimado;
        if (!z) {
            return;
        }
        let passo = z.falta * (1 - Math.exp(-dt / ZOOM_SUAVIDADE));
        if (Math.abs(z.falta) < 0.002) {
            passo = z.falta;
        }
        const pedido = Math.exp(passo);
        const feito = this._aproximar(z.ancora, pedido);
        z.falta -= passo;
        // Encostado a um limite, ou contra a parede do céu, já não anda
        // nada: o resto fica por fazer. (Perto de um limite anda menos do
        // que se pede, a abrandar — e isso não o pára: ver `_aproximar`.)
        if (feito === 1 && Math.abs(passo) > 1e-6) {
            z.falta = 0;
        }
        if (Math.abs(z.falta) < 1e-6) {
            this._zoomAnimado = null;
        }
    }

    /**
     * A volta a deslizar até ao norte (ver `virarParaNorte`).
     *
     * @param {number} dt - O tempo desta imagem, em segundos.
     * @private
     */
    _aplicarGiro(dt) {
        if (this._giroAnimado === null) {
            return;
        }
        let passo = this._giroAnimado * (1 - Math.exp(-dt / 0.15));
        if (Math.abs(this._giroAnimado) < 0.05) {
            passo = this._giroAnimado;
        }
        this._giroAnimado -= passo;
        this._rodarEInclinar(passo, 0);
        if (Math.abs(this._giroAnimado) < 1e-4) {
            this._giroAnimado = null;
        }
    }

    /**
     * O balanço depois de largar um arrasto: o bairro continua a deslizar
     * e vai parando.
     *
     * @param {number} dt - O tempo desta imagem, em segundos.
     * @private
     */
    _aplicarBalanco(dt) {
        const v = this._balanco;
        if (!v) {
            return;
        }
        this._pose.position.x += v.x * dt;
        this._pose.position.z += v.z * dt;
        v.mulScalar(Math.exp(-dt / BALANCO_TEMPO));
        if (v.length() < BALANCO_MINIMO) {
            this._balanco = null;
        }
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
     * Olha para um ponto, à mesma distância a que se está dele (ou à de
     * abertura), vindo do lado de onde se olha agora.
     *
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    focus(focus, resetZoom = false) {
        const zoomDist = resetZoom ?
            this._startZoomDist : this._pose.position.distance(focus);
        const position = tmpV1.copy(this._camera.entity.forward)
        .mulScalar(-zoomDist)
        .add(focus);
        this.recenter(position, focus);
    }

    /**
     * Vira-se para um ponto, sem sair do sítio (ou à distância de
     * abertura dele).
     *
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    look(focus, resetZoom = false) {
        const position = resetZoom ?
            tmpV1.copy(this._pose.position)
            .sub(focus)
            .normalize()
            .mulScalar(this._startZoomDist)
            .add(focus) : this._pose.position.clone();
        this.recenter(position, focus);
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {Vec3} position - The start point.
     */
    reset(focus, position) {
        this.recenter(position, focus);
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
        this._largarTudo();
        this._desvio = 0;
        this._boundsArmed = false;
        this._entryLimit = null;
        this._lastInsideValid = false;
        this._pose.look(position, focus);
        this._controller.attach(this._pose, false);
    }

    /**
     * Leva a câmara, a deslizar, até um sítio e uma maneira de olhar — a
     * mesma viagem de quando se carrega num ponto do bairro (a curva que
     * começa e acaba devagar), mas para onde se quiser e virada para onde
     * se quiser. Usa-a a navegação, para mostrar o percurso até uma casa
     * (ver navegacao-3d.mjs). Como no `recenter`, os limites do terreno
     * desarmam-se, para a câmara poder ficar fora do bairro a olhar para
     * ele; voltam a armar-se quando ela entrar.
     *
     * @param {Vec3} posicao - Para onde vai a câmara.
     * @param {number} inclinacao - Quanto olha para baixo (graus negativos)
     * ou para cima.
     * @param {number} rumo - Para onde olha, em graus (o mesmo ângulo da
     * câmara à volta da vertical).
     * @param {number} [duracao] - Quanto demora, em segundos.
     * @param {boolean} [aVelocidadeCerta] - Sem começar nem acabar devagar:
     * para viagens que se seguem umas às outras sem parar, como as da
     * câmara a seguir quem anda.
     */
    viajar(posicao, inclinacao, rumo, duracao = 1.6, aVelocidadeCerta = false) {
        this._boundsArmed = false;
        this._entryLimit = null;
        this._lastInsideValid = false;
        this._desvio = 0;
        const angulos = this._pose.angles;
        let inclinacao0 = angulos.x;
        while (inclinacao0 > 180) inclinacao0 -= 360;
        while (inclinacao0 < -180) inclinacao0 += 360;
        // Vira-se pelo lado mais curto.
        let rumo1 = rumo;
        while (rumo1 - angulos.y > 180) rumo1 -= 360;
        while (rumo1 - angulos.y < -180) rumo1 += 360;
        this._setMode('fly');
        this._viagem = {
            de: this._pose.position.clone(),
            para: posicao.clone(),
            sitio: null,
            inclinacao0,
            inclinacao1: math.clamp(inclinacao, -89, 89),
            rumo0: angulos.y,
            rumo1,
            t: 0,
            duracao: Math.max(0.1, duracao),
            aVelocidadeCerta
        };
    }

    /**
     * Onde a câmara está e para onde olha, na forma que `viajar` recebe —
     * para se lá poder voltar depois (a navegação volta à vista de antes
     * da pesquisa).
     *
     * @returns {{posicao: Vec3, inclinacao: number, rumo: number}} A vista.
     */
    vista() {
        let inclinacao = this._pose.angles.x;
        while (inclinacao > 180) inclinacao -= 360;
        while (inclinacao < -180) inclinacao += 360;
        return { posicao: this._pose.position.clone(), inclinacao, rumo: this._pose.angles.y };
    }

    /**
     * A altura mais alta a que a câmara pode andar (a da vista de abertura).
     *
     * @returns {number} A altura, ou Infinity se ainda não se sabe.
     */
    alturaMaxima() {
        return this._initialY !== undefined ? this._initialY : Infinity;
    }

    /**
     * Um tecto mais alto do que o de sempre, enquanto for preciso.
     *
     * A navegação mostra, ao escolher uma casa, o caminho todo até ela; num
     * telemóvel ao alto, um caminho comprido só cabe visto de mais alto do
     * que a vista de abertura. Enquanto o caminho está à vista, o tecto fica
     * aqui; quando sai (ver `soltarOTecto`), vai descendo atrás da câmara, e
     * ela nunca é puxada para baixo de repente.
     *
     * @type {number|null}
     * @private
     */
    _tectoAlto = null;

    /**
     * Se o tecto alto já foi largado, e desce agora com a câmara.
     *
     * @type {boolean}
     * @private
     */
    _tectoASoltar = false;

    /**
     * Sobe o tecto da câmara até esta altura (nunca acima da abóbada do
     * céu), até se pedir `soltarOTecto`.
     *
     * @param {number} altura - A altura que a câmara pode atingir.
     */
    subirOTecto(altura) {
        if (!(altura > this.alturaMaxima())) return;
        this._tectoAlto = Math.max(altura, this._tectoASoltar ? 0 : (this._tectoAlto || 0));
        this._tectoASoltar = false;
    }

    /**
     * Larga o tecto alto: a partir daqui ele desce atrás da câmara, até
     * voltar ao de sempre.
     */
    soltarOTecto() {
        if (this._tectoAlto !== null) this._tectoASoltar = true;
    }

    /**
     * A altura mais alta a que a câmara pode estar agora: a de sempre, ou a
     * do tecto alto enquanto ele durar.
     *
     * @returns {number} A altura.
     * @private
     */
    _tectoAgora() {
        const deSempre = this.alturaMaxima();
        if (this._tectoAlto === null) return deSempre;
        if (this._tectoASoltar) {
            this._tectoAlto = Math.min(this._tectoAlto, Math.max(this._pose.position.y, deSempre));
            if (this._tectoAlto <= deSempre + 0.01) {
                this._tectoAlto = null;
                this._tectoASoltar = false;
                return deSempre;
            }
        }
        return Math.max(deSempre, this._tectoAlto);
    }

    /**
     * Se a câmara pode estar ali sem ser empurrada: abaixo do tecto (o
     * de sempre, ou o que se pede) e dentro das paredes da taça do céu.
     *
     * @param {number} x - Onde, no bairro.
     * @param {number} y - A altura.
     * @param {number} z - Onde, no bairro.
     * @param {number} [tecto] - O tecto a contar; o de agora, se não se der.
     * @returns {boolean} Se pode.
     */
    podeEstar(x, y, z, tecto) {
        if (y > (tecto !== undefined ? tecto : this._tectoAgora()) + 0.01) return false;
        if (!this.travagem) return true;
        const cupula = this._medidasDaCupula();
        if (!cupula) return true;
        if (y > cupula.topo - this.margemDaCupula) return false;
        const parede = Math.max(1, this._paredeA(cupula, y) - this.margemDaCupula);
        return Math.hypot(x - cupula.centroX, z - cupula.centroZ) <= parede - 0.5;
    }

    /**
     * A altura mais alta que o tecto alto pode ter: a do alto da taça do
     * céu, com a folga das paredes.
     *
     * @returns {number} A altura.
     */
    tectoPossivel() {
        const cupula = this.travagem ? this._medidasDaCupula() : null;
        return cupula ? cupula.topo - this.margemDaCupula : Infinity;
    }

    /**
     * @param {number} dt - The time delta.
     */
    update(dt) {
        dt = Math.min(dt, 0.1);
        const { keyCode } = KeyboardMouseSource;

        // O teclado e o comando de jogo vêm do motor; o rato, os dedos e a
        // roda são ouvidos à parte (ver `_escutarGestos`), e o que o motor
        // diz deles deita-se fora.
        const { key } = this._desktopInput.read();
        const { leftStick, rightStick } = this._gamepadInput.read();
        applyDeadZone(leftStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);
        applyDeadZone(rightStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);

        // As teclas carregadas.
        //
        // O motor não diz que teclas estão em baixo: diz o que mudou desde
        // a imagem anterior — mais um ao carregar, menos um ao largar — e é
        // somando isso que se sabe o que está a ser premido. Uma soma
        // dessas tem de ficar sempre completa: travá-la a meio, só na
        // metade de carregar, deixava o largar por descontar e a câmara
        // ficava com um empurrão fantasma para sempre. Somam-se as setas à
        // parte do WASD, e o Shift (ou o Alt) só decide para onde é que a
        // das setas vai.
        this._state.axis.add(tmpV1.set(
            key[keyCode.D] - key[keyCode.A],
            0,
            key[keyCode.W] - key[keyCode.S]
        ));
        this._setas.add(tmpV1.set(
            key[keyCode.RIGHT] - key[keyCode.LEFT],
            0,
            key[keyCode.UP] - key[keyCode.DOWN]
        ));
        this._state.shift += key[keyCode.SHIFT];
        this._state.ctrl += key[keyCode.CTRL];

        if (this._initialY === undefined) {
            this._initialY = this._camera.entity.getPosition().y;
        }

        // Nos óculos de VR é o corpo de quem os tem postos que manda.
        if (this.app.xr?.active) {
            return;
        }

        // Com o Alt em baixo, as setas deixam de andar: passam a olhar à
        // volta, sem sair do sítio. O WASD anda na mesma, para se poder
        // andar e olhar ao mesmo tempo. (É o teclado de sempre: ficou assim
        // a pedido de quem fez o site, depois de os gestos do rato e dos
        // dedos passarem a ser os do Google Maps.)
        const aOlhar = altCarregado();

        // Quem pega nos comandos fica com a câmara: um gesto, uma tecla de
        // andar ou de rodar, um stick do comando param a viagem onde ela
        // vai. E diz-se a quem esteja a levar a câmara (a navegação, quando
        // ela segue a seta de quem anda: ver navegacao-3d.mjs), para a
        // largar.
        const g = this._gestos;
        const teclas = this._state.axis.lengthSq() > 0 || this._setas.lengthSq() > 0;
        const sticks = leftStick[0] !== 0 || leftStick[1] !== 0 ||
            rightStick[0] !== 0 || rightStick[1] !== 0;

        // 1. Os gestos do rato e dos dedos (e o carregar sem largar, que
        //    acaba o gesto em que vinha).
        this._vigiarPremir();
        this._aplicarGestos();
        // 2. O zoom e a volta a deslizar, e o balanço de um arrasto largado.
        this._aplicarZoomAnimado(dt);
        this._aplicarGiro(dt);
        if (!g.modo) {
            this._aplicarBalanco(dt);
        }

        if (g.pegou || teclas || sticks) {
            g.pegou = false;
            this._viagem = null;
            this.fire('mexeu');
        }

        // 3. Andar com as teclas e com o stick esquerdo, pelo chão, para o
        //    lado para onde a vista está virada, à velocidade de sempre:
        //    mais depressa com o Shift, mais devagar com o Ctrl.
        const andar = tmpV3.copy(this._state.axis);
        if (!aOlhar) {
            andar.add(this._setas);
        }
        if (andar.lengthSq() > 1) {
            andar.normalize();
        }
        // O stick vem multiplicado pela conta da zona morta e chega a
        // passar dos dois — limitado a um, anda à velocidade das teclas.
        if (leftStick[0] !== 0 || leftStick[1] !== 0) {
            andar.x += leftStick[0];
            andar.z -= leftStick[1];
            const passo = Math.hypot(andar.x, andar.z);
            if (passo > 1) {
                andar.x /= passo;
                andar.z /= passo;
            }
        }
        if (!this._smoothMoveVelocity) {
            this._smoothMoveVelocity = new Vec3();
        }
        const rumo = this._pose.angles.y * math.DEG_TO_RAD;
        const frenteX = -Math.sin(rumo);
        const frenteZ = -Math.cos(rumo);
        const direitaX = Math.cos(rumo);
        const direitaZ = -Math.sin(rumo);
        const rapidez = this._state.shift > 0 ? this.moveFastSpeed :
            this._state.ctrl > 0 ? this.moveSlowSpeed : this.moveSpeed;
        const alvo = tmpV4.set(
            (frenteX * andar.z + direitaX * andar.x) * rapidez,
            0,
            (frenteZ * andar.z + direitaZ * andar.x) * rapidez
        );
        // Arranca e trava com suavidade.
        this._smoothMoveVelocity.lerp(this._smoothMoveVelocity, alvo, Math.min(1, 5 * dt));
        if (this._smoothMoveVelocity.lengthSq() > 1e-8) {
            this._pose.position.x += this._smoothMoveVelocity.x * dt;
            this._pose.position.z += this._smoothMoveVelocity.z * dt;
        } else {
            this._smoothMoveVelocity.set(0, 0, 0);
        }
        if (andar.lengthSq() > 0) {
            this._avisarGesto('mover');
        }

        // 4. Olhar à volta com o Alt e as setas, sem sair do sítio, como
        //    sempre: para a direita vira-se para a direita, para cima olha
        //    mais para cima. Cada imagem pede mais um bocado de volta, e a
        //    vista vai atrás do que foi pedido com a suavidade de sempre
        //    (a do comando de voo do motor, que era quem fazia isto).
        const olhar = this.rotateSpeed * this.rotateJoystickSens * 60 * dt;
        if (aOlhar && (this._setas.x || this._setas.z)) {
            this._olharPorFazer.x -= this._setas.x * olhar;
            this._olharPorFazer.y += this._setas.z * olhar;
            // A volta muda o sítio do meio do ecrã: o que o tecto ou o chão
            // tinham mudado ao inclinar já não se desfaz.
            this._desvio = 0;
            if (this._setas.x) {
                this._avisarGesto('rodar');
            }
            if (this._setas.z) {
                this._avisarGesto('inclinar');
            }
        }
        if (Math.abs(this._olharPorFazer.x) > 1e-4 || Math.abs(this._olharPorFazer.y) > 1e-4) {
            const k = damp(0.98, dt);
            const rumoAgora = this._olharPorFazer.x * k;
            const inclinacaoAgora = this._olharPorFazer.y * k;
            this._pose.angles.y += rumoAgora;
            this._pose.angles.x += inclinacaoAgora;
            this._olharPorFazer.x -= rumoAgora;
            this._olharPorFazer.y -= inclinacaoAgora;
        } else {
            this._olharPorFazer.set(0, 0);
        }

        // E rodar e inclinar com o stick direito, à volta do meio do ecrã:
        // para a direita roda para a direita, para cima inclina para o
        // horizonte.
        let rodar = -rightStick[0];
        let inclinar = -rightStick[1];
        rodar = math.clamp(rodar, -1, 1);
        inclinar = math.clamp(inclinar, -1, 1);
        if ((rodar || inclinar) && !this._aRodarDeTecla) {
            this._aRodarDeTecla = true;
            this._pedirAlturaDoPivo();
        } else if (!rodar && !inclinar) {
            this._aRodarDeTecla = false;
        }
        const ritmo = Math.min(1, 8 * dt);
        this._giroDasTeclas.x = math.lerp(this._giroDasTeclas.x, rodar * RODAR_COM_AS_TECLAS, ritmo);
        this._giroDasTeclas.y = math.lerp(this._giroDasTeclas.y, inclinar * INCLINAR_COM_AS_TECLAS, ritmo);
        if (Math.abs(this._giroDasTeclas.x) > 0.01 || Math.abs(this._giroDasTeclas.y) > 0.01) {
            this._rodarEInclinar(this._giroDasTeclas.x * dt, this._giroDasTeclas.y * dt);
        } else {
            this._giroDasTeclas.set(0, 0);
        }
        if (rodar) {
            this._avisarGesto('rodar');
        }
        if (inclinar) {
            this._avisarGesto('inclinar');
        }

        // 5. A viagem: a do duplo clique, ou uma da navegação. A cada
        //    imagem a câmara é posta no ponto da viagem que o relógio
        //    manda, pela curva que começa e acaba devagar.
        if (this._viagem) {
            const viagem = this._viagem;
            viagem.t = Math.min(1, viagem.t + dt / viagem.duracao);
            const k = viagem.aVelocidadeCerta ? viagem.t : entradaESaida(viagem.t);
            this._pose.position.lerp(viagem.de, viagem.para, k);
            this._pose.angles.set(
                math.lerp(viagem.inclinacao0, viagem.inclinacao1, k),
                math.lerp(viagem.rumo0, viagem.rumo1, k),
                0
            );
            if (this._smoothMoveVelocity) {
                this._smoothMoveVelocity.set(0, 0, 0);
            }
            if (viagem.t >= 1) {
                this._viagem = null;
            }
        }

        // 6. Os limites.
        //
        // A inclinação: entre a vista a pique e um pouco acima do
        // horizonte nunca — como no Google Maps, não se olha para o céu.
        this._pose.angles.x = math.clamp(entreMeiaVolta(this._pose.angles.x), INCLINACAO_MINIMA, INCLINACAO_MAXIMA);
        this._pose.angles.z = 0;

        // Chão e tecto: os da cúpula do céu, e só com a travagem ligada.
        const baixo = this._alturaMinima();
        const alto = this._alturaMaxima();
        if (this._pose.position.y < baixo) {
            this._pose.position.y = baixo;
        }
        if (this._pose.position.y > alto) {
            this._pose.position.y = alto;
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
                // O balanço morre contra a parede.
                this._balanco = null;
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
                this._balanco = null;
                this._lastInsideX = pos.x;
                this._lastInsideZ = pos.z;
            }
        } else if (this.travagem && this.maxDistance > 0 &&
                this._pose.position.length() >= this.maxDistance - EDGE_EPS) {
            // Fallback until the map footprint is known
            isAtBoundary = true;
            if (this._pose.position.length() > this.maxDistance) {
                this._pose.position.normalize().mulScalar(this.maxDistance);
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

        // A altura: nunca abaixo da mínima (furava o bairro), e nunca acima
        // do tecto — o da vista de abertura, ou o tecto alto da navegação,
        // enquanto ele durar (ver `subirOTecto`).
        if (this._pose.position.y < ALTURA_MINIMA) {
            this._pose.position.y = ALTURA_MINIMA;
        }
        const tecto = this._tectoAgora();
        if (this._pose.position.y > tecto) {
            this._pose.position.y = tecto;
        }

        // 7. O detalhe do bairro.
        //
        // A abertura da câmara fica sempre a de origem; e a distância do
        // detalhe fino é reescrita a cada imagem, a partir da que o
        // index.html decidiu (e que no modo Automático o afinador de
        // fluidez vai mexendo).
        if (!this._initialFov) {
            this._initialFov = this._camera.fov || 60;
        }
        this._camera.fov = this._initialFov;
        if (!this._splatGsplat && typeof document !== 'undefined') {
            const splatEl = document.querySelector('pc-entity[name="gsplat-scene"]');
            if (splatEl && splatEl.entity && splatEl.entity.gsplat) {
                this._splatGsplat = splatEl.entity.gsplat;
            }
        }
        if (this._splatGsplat) {
            const nivel = typeof window !== 'undefined' ? window.actualQuality : null;
            // Estes valores têm de acompanhar os do index.html.
            let distanciaDoDetalhe = nivel === 'low' ? 70 : nivel === 'med' ? 110 : 150;
            if (typeof window !== 'undefined' && window.distanciaDoDetalhe > 0) {
                distanciaDoDetalhe = window.distanciaDoDetalhe;
            }
            this._splatGsplat.lodBaseDistance = distanciaDoDetalhe;
        }

        this._camera.entity.setPosition(this._pose.position);
        this._camera.entity.setEulerAngles(this._pose.angles);

        // A câmara mudou de sítio: as contas do ecrã (worldToScreen) têm de
        // ser já as desta imagem. O motor só as dá por velhas mesmo antes
        // de desenhar, e quem as usasse a seguir a esta atualização — os
        // marcadores das anotações, o cursor das instruções — punha-se
        // onde o bairro estava na imagem anterior, e escorregava sempre
        // que a vista andava.
        const lente = this._camera.camera;
        if (lente) {
            lente._viewMatDirty = true;
            lente._viewProjMatDirty = true;
        }
    }
}

export { CameraControls };
