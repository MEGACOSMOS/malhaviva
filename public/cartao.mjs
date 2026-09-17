import { Entity, Quat, Vec3, Vec4 } from 'playcanvas';

/**
 * Os óculos de cartão do mapa: o telemóvel numa armação com duas lentes.
 *
 * Os navegadores dos telemóveis já não abrem óculos de realidade virtual
 * (ver vr-cartao.js), e por isso o mapa faz o cartão pelas suas mãos. E
 * fá-lo da maneira mais simples que há: os óculos são o próprio mapa,
 * tal e qual, visto por dois olhos. A câmara continua a ser a de sempre,
 * a andar e a rodar com os comandos de sempre (as teclas, o rato ou o
 * dedo, o comando de jogo, o manípulo); por cima disso, e só por cima,
 * a cabeça vira com o sensor de movimento do telemóvel — o mesmo que roda
 * as fotografias — e cada olho fica um pouco para o seu lado. Ao sair,
 * tira-se a cabeça e os olhos e a câmara fica exactamente onde a pessoa
 * a deixou.
 *
 * A cabeça conta a partir de onde o telemóvel estava quando se entrou:
 * nesse instante vê-se o que se via no mapa, e virar o telemóvel para a
 * esquerda vira a vista para a esquerda, a partir daí.
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
    let olhos = [];
    let guardado = null;
    let sensor = null;       // os últimos ângulos do sensor
    let aoSair = null;       // quem avisar quando se sai
    let referencia = null;   // a rotação do telemóvel quando se entrou, invertida

    const qY = new Quat();
    const qX = new Quat();
    const qZ = new Quat();
    const qDeitado = new Quat().setFromAxisAngle(Vec3.RIGHT, -90);
    const qEcra = new Quat();
    const lida = new Quat();
    const relativa = new Quat();

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
     * A cabeça segue o sensor, sem demora: a última leitura, descontada a
     * de quando se entrou, é a rotação da cabeça em cima da câmara.
     */
    function virarACabeca() {
        if (!activo || !sensor || !cabeca) return;
        rotacaoDaCabeca(sensor.alfa, sensor.beta, sensor.gama, orientacaoDoEcra(), lida);
        if (!referencia) referencia = new Quat().copy(lida).invert();
        relativa.copy(referencia).mul(lida);
        cabeca.setLocalRotation(relativa);
    }

    /**
     * A cada imagem, por garantia: se o sensor não falou desde a última,
     * a cabeça fica onde está.
     */
    function passo() {
        virarACabeca();
    }

    /**
     * Faz um olho: uma câmara igual à do mapa, a ver metade do ecrã.
     *
     * @param {string} nome - O nome do olho.
     * @param {number} lado - -1 para o esquerdo, 1 para o direito.
     * @returns {Entity} O olho.
     */
    function fazerOlho(nome, lado) {
        const olho = new Entity(nome);
        olho.addComponent('camera', {
            rect: new Vec4(lado < 0 ? 0 : 0.5, 0, 0.5, 1),
            fov: ABERTURA_DO_OLHO,
            horizontalFov: false,
            nearClip: camara.camera.nearClip,
            farClip: camara.camera.farClip,
            clearColor: camara.camera.clearColor.clone(),
            layers: camara.camera.layers.slice(),
            priority: camara.camera.priority + (lado < 0 ? 1 : 2),
            toneMapping: camara.camera.toneMapping,
            gammaCorrection: camara.camera.gammaCorrection
        });
        cabeca.addChild(olho);
        olho.setLocalPosition(lado * MEIO_OLHO, 0, 0);
        return olho;
    }

    /**
     * Entra nos óculos de cartão.
     *
     * @param {Entity} camaraDoMapa - A câmara do mapa, que fica a mandar.
     * @param {Function} quandoSair - Quem avisar quando se sai (a pessoa
     *     pode sair pelo botão ou ao sair do ecrã inteiro).
     * @returns {Promise<string>} 'entrou' ou o que correu mal.
     */
    async function entrar(camaraDoMapa, quandoSair) {
        if (activo) return 'entrou';
        camara = camaraDoMapa;
        aoSair = quandoSair;
        guardado = {
            pontosPorPonto: app.graphicsDevice.maxPixelRatio
        };
        // Desenhar mais leve: um ponto por ponto, no máximo.
        try {
            app.graphicsDevice.maxPixelRatio = Math.min(app.graphicsDevice.maxPixelRatio, PONTOS_POR_PONTO);
            if (app.resizeCanvas) app.resizeCanvas();
        } catch (e) { /* fica como está */ }

        // A cabeça, pendurada na câmara do mapa: a câmara anda e roda com
        // os comandos, a cabeça roda com o sensor por cima disso, e cada
        // olho fica um pouco para o seu lado. A câmara do mapa deixa de
        // desenhar — desenham os olhos — mas continua a ser ela a mandar.
        cabeca = new Entity('cabeca-do-cartao');
        camara.addChild(cabeca);
        cabeca.setLocalPosition(0, 0, 0);
        cabeca.setLocalEulerAngles(0, 0, 0);
        olhos = [fazerOlho('olho-esquerdo', -1), fazerOlho('olho-direito', 1)];
        camara.camera.enabled = false;

        sensor = null;
        referencia = null;
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
     * Sai dos óculos de cartão: tira a cabeça e os olhos, e a câmara do
     * mapa volta a desenhar de onde ficou.
     */
    function sair() {
        if (!activo) return;
        activo = false;
        document.removeEventListener('fullscreenchange', aoMudarOEcraInteiro);
        window.removeEventListener('deviceorientation', aoRodarOTelemovel, true);
        app.off('update', passo);
        document.body.classList.remove('em-cartao');

        for (const olho of olhos) olho.destroy();
        olhos = [];
        if (cabeca) { cabeca.destroy(); cabeca = null; }
        if (camara) camara.camera.enabled = true;
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
