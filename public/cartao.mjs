import { Entity, Quat, Vec3, Vec4 } from 'playcanvas';

/**
 * Os óculos de cartão do mapa: o telemóvel numa armação com duas lentes.
 *
 * Os navegadores dos telemóveis já não abrem óculos de realidade virtual
 * (ver vr-cartao.js), e por isso o mapa faz o cartão pelas suas mãos: o
 * ecrã é dividido em dois, com uma câmara para cada olho, um pouco
 * afastadas uma da outra como os olhos estão; e é o sensor de movimento
 * do telemóvel — o mesmo que roda as fotografias — que vira a cabeça. O
 * resto (o suporte que anda, os toques, as poupanças de detalhe) é o do
 * modo VR de sempre, em vr.mjs; isto só trata da imagem e da cabeça.
 *
 * A conta que passa os três ângulos do sensor (alfa, beta, gama) para a
 * rotação da cabeça é a de sempre destas coisas, a mesma do three.js: os
 * três ângulos por esta ordem — à volta (alfa), a inclinar (beta), a
 * rolar (gama, ao contrário) —, depois a virar o telemóvel de deitado
 * para de pé, e por fim a descontar a orientação do ecrã, que dentro da
 * armação está deitado.
 */

// Metade da distância entre os olhos, em metros.
const MEIO_OLHO = 0.032;

// A abertura de cada olho, na vertical, em graus: perto do que as lentes
// do cartão deixam ver.
const ABERTURA_DO_OLHO = 80;

// Quantos pontos do ecrã se desenham por cada ponto, no máximo, dentro
// dos óculos: um. Os telemóveis têm dois ou três pontos por ponto, e
// desenhar tudo isso duas vezes (um olho de cada lado) deixava a imagem
// a andar aos solavancos, muito atrás da cabeça.
const PONTOS_POR_PONTO = 1;

const RAD = Math.PI / 180;

/**
 * Cria os óculos de cartão.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {object} O que se lhes pode pedir: `entrar`, `sair`, `activo`.
 */
export function criarCartao(app) {
    let activo = false;
    let camara = null;
    let cabeca = null;
    let olhoDireito = null;
    let guardado = null;
    let sensor = null;       // os últimos ângulos do sensor
    let aoSair = null;       // quem avisar quando se sai
    let acertouAVolta = false;

    const qY = new Quat();
    const qX = new Quat();
    const qZ = new Quat();
    const qDeitado = new Quat().setFromAxisAngle(Vec3.RIGHT, -90);
    const qEcra = new Quat();
    const alvo = new Quat();

    /**
     * A rotação da cabeça a partir dos ângulos do sensor.
     *
     * @param {number} alfa - À volta, em graus.
     * @param {number} beta - A inclinar, em graus.
     * @param {number} gama - A rolar, em graus.
     * @param {number} ecra - A orientação do ecrã, em graus.
     * @param {Quat} saida - Onde pôr a rotação.
     */
    function rotacaoDaCabeca(alfa, beta, gama, ecra, saida) {
        qY.setFromAxisAngle(Vec3.UP, alfa);
        qX.setFromAxisAngle(Vec3.RIGHT, beta);
        qZ.setFromAxisAngle(Vec3.BACK, -gama);
        qEcra.setFromAxisAngle(Vec3.BACK, -ecra);
        saida.copy(qY).mul(qX).mul(qZ).mul(qDeitado).mul(qEcra);
    }

    const aoRodarOTelemovel = (e) => {
        if (e.alpha === null || e.alpha === undefined) return;
        sensor = { alfa: e.alpha, beta: e.beta || 0, gama: e.gamma || 0 };
        // A cabeça vira logo aqui, com a leitura acabada de chegar, e não
        // só na imagem seguinte: o sensor fala mais vezes por segundo do
        // que a imagem se desenha, e assim nunca se fica com uma leitura
        // velha.
        virarACabeca();
    };

    /**
     * A orientação do ecrã, em graus.
     *
     * @returns {number} 0, 90, 180 ou 270.
     */
    function orientacaoDoEcra() {
        if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
        return typeof window.orientation === 'number' ? window.orientation : 0;
    }

    /**
     * A cabeça segue o sensor, sem demora: a última leitura é a rotação.
     */
    function virarACabeca() {
        if (!activo || !sensor || !cabeca) return;
        rotacaoDaCabeca(sensor.alfa, sensor.beta, sensor.gama, orientacaoDoEcra(), alvo);

        // Na primeira leitura, o suporte roda para a pessoa continuar a
        // olhar para onde olhava antes de pôr os óculos: o sensor conta a
        // volta a partir de onde o telemóvel estava, e não do bairro.
        if (!acertouAVolta) {
            acertouAVolta = true;
            cabeca.setLocalRotation(alvo);
            const frente = cabeca.forward;
            const voltaDaCabeca = Math.atan2(-frente.x, -frente.z) / RAD;
            const suporte = cabeca.parent;
            if (suporte) {
                const voltaQueSeQuer = guardado.voltaAntes;
                const eul = suporte.getEulerAngles();
                suporte.setEulerAngles(0, eul.y + (voltaQueSeQuer - voltaDaCabeca), 0);
            }
            return;
        }
        cabeca.setLocalRotation(alvo);
    }

    /**
     * A cada imagem, por garantia: se o sensor não falou desde a última,
     * a cabeça fica onde está.
     */
    function passo() {
        virarACabeca();
    }

    /**
     * Entra nos óculos de cartão.
     *
     * @param {Entity} suporte - O suporte que anda pelo bairro (de vr.mjs).
     * @param {Entity} camaraDoMapa - A câmara do mapa, já dentro do suporte.
     * @param {number} voltaAntes - Para onde se olhava antes, em graus.
     * @param {Function} quandoSair - Quem avisar quando se sai (a pessoa
     *     pode sair pelo botão ou ao sair do ecrã inteiro).
     * @returns {Promise<string>} 'entrou' ou o que correu mal.
     */
    async function entrar(suporte, camaraDoMapa, voltaAntes, quandoSair) {
        if (activo) return 'entrou';
        camara = camaraDoMapa;
        aoSair = quandoSair;
        guardado = {
            rect: camara.camera.rect.clone(),
            fov: camara.camera.fov,
            horizontalFov: camara.camera.horizontalFov,
            pontosPorPonto: app.graphicsDevice.maxPixelRatio,
            voltaAntes
        };
        // Desenhar mais leve: um ponto por ponto, no máximo.
        try {
            app.graphicsDevice.maxPixelRatio = Math.min(app.graphicsDevice.maxPixelRatio, PONTOS_POR_PONTO);
            if (app.resizeCanvas) app.resizeCanvas();
        } catch (e) { /* fica como está */ }

        // A cabeça, entre o suporte e a câmara: o suporte anda, a cabeça
        // roda com o sensor, e cada olho fica um pouco para o seu lado.
        cabeca = new Entity('cabeca-do-cartao');
        suporte.addChild(cabeca);
        camara.reparent(cabeca);
        camara.setLocalPosition(-MEIO_OLHO, 0, 0);
        camara.setLocalEulerAngles(0, 0, 0);
        camara.camera.rect = new Vec4(0, 0, 0.5, 1);
        camara.camera.fov = ABERTURA_DO_OLHO;
        camara.camera.horizontalFov = false;

        olhoDireito = new Entity('olho-direito');
        olhoDireito.addComponent('camera', {
            rect: new Vec4(0.5, 0, 0.5, 1),
            fov: ABERTURA_DO_OLHO,
            horizontalFov: false,
            nearClip: camara.camera.nearClip,
            farClip: camara.camera.farClip,
            clearColor: camara.camera.clearColor.clone(),
            layers: camara.camera.layers.slice(),
            priority: camara.camera.priority + 1,
            toneMapping: camara.camera.toneMapping,
            gammaCorrection: camara.camera.gammaCorrection
        });
        cabeca.addChild(olhoDireito);
        olhoDireito.setLocalPosition(MEIO_OLHO, 0, 0);

        sensor = null;
        acertouAVolta = false;
        window.addEventListener('deviceorientation', aoRodarOTelemovel, true);
        app.on('update', passo);
        document.body.classList.add('em-cartao');
        activo = true;

        // Ecrã inteiro e deitado, como a armação pede. Se o navegador não
        // deixar, fica-se na mesma: o ecrã dividido continua a servir.
        try {
            const raiz = document.documentElement;
            if (!document.fullscreenElement && raiz.requestFullscreen) await raiz.requestFullscreen();
        } catch (e) { /* sem ecrã inteiro */ }
        try {
            if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
        } catch (e) { /* sem tranca */ }
        document.addEventListener('fullscreenchange', aoMudarOEcraInteiro);
        return 'entrou';
    }

    const aoMudarOEcraInteiro = () => {
        // Saiu do ecrã inteiro (o botão de recuar do telemóvel, por
        // exemplo): saem-se também dos óculos.
        if (activo && !document.fullscreenElement) sair();
    };

    /**
     * Sai dos óculos de cartão e devolve a câmara como estava.
     */
    function sair() {
        if (!activo) return;
        activo = false;
        document.removeEventListener('fullscreenchange', aoMudarOEcraInteiro);
        window.removeEventListener('deviceorientation', aoRodarOTelemovel, true);
        app.off('update', passo);
        document.body.classList.remove('em-cartao');

        if (olhoDireito) { olhoDireito.destroy(); olhoDireito = null; }
        if (camara && cabeca) {
            const suporte = cabeca.parent;
            if (suporte) camara.reparent(suporte);
            camara.setLocalPosition(0, 0, 0);
            camara.setLocalEulerAngles(0, 0, 0);
            camara.camera.rect = guardado.rect;
            camara.camera.fov = guardado.fov;
            camara.camera.horizontalFov = guardado.horizontalFov;
        }
        if (cabeca) { cabeca.destroy(); cabeca = null; }
        try {
            if (guardado && guardado.pontosPorPonto !== undefined) {
                app.graphicsDevice.maxPixelRatio = guardado.pontosPorPonto;
                if (app.resizeCanvas) app.resizeCanvas();
            }
        } catch (e) { /* fica como está */ }
        try {
            if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
        } catch (e) { /* sem tranca */ }
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        const avisar = aoSair;
        aoSair = null;
        if (avisar) avisar();
    }

    return {
        entrar,
        sair,
        get activo() { return activo; }
    };
}
