import { Asset, EnvLighting, Quat, Vec3 } from 'playcanvas';

/**
 * O céu do bairro: a panorâmica do Olho de Águia à volta do mapa.
 *
 * A fotografia é uma panorâmica esférica tirada por cima do bairro — vê-se
 * o rio, a ponte e a cidade ao fundo. Posta como céu, o mapa deixa de
 * flutuar no preto e passa a estar no sítio onde de facto está.
 *
 * O motor não sabe desenhar directamente uma panorâmica esticada como
 * esta: precisa dela arrumada nas seis faces de um cubo à volta do
 * observador. Essa arrumação é feita uma vez, no arranque, e o tamanho das
 * faces acompanha o nível de qualidade — num telemóvel guardar seis faces
 * grandes gastaria memória que faz falta ao bairro.
 *
 * Há duas maneiras de o pendurar. "Infinito" é o céu de sempre: por muito
 * que se ande, fica sempre à mesma distância, como o horizonte verdadeiro.
 * "Cúpula" assenta a panorâmica numa taça em volta do mapa, o que faz o
 * chão da fotografia encontrar-se com o chão do bairro — fica mais certo
 * quando se anda pelas ruas, e mais estranho quando se sobe muito.
 */

const IMAGEM = '/ceu-olho-de-aguia.jpg';

// Tamanho de cada face do cubo, conforme o nível de qualidade. São seis
// faces, por isso o custo em memória é seis vezes o quadrado destes
// números — daí a diferença entre níveis.
const TAMANHO_DAS_FACES = {
    high: 1024,
    med: 512,
    low: 256
};

// Onde ficam guardadas as afinações, para sobreviverem a um recarregar.
const CHAVE = 'ceu-olho-de-aguia';

// A cúpula do motor tem proporções fixas, e é isso que manda em tudo o
// resto: o ponto de onde a fotografia foi tirada fica sempre a um vigésimo
// do tamanho da cúpula, e o chão dela estende-se até metade desse tamanho.
//
// Daí a regra simples: dizendo a que altura a fotografia foi tirada, o
// tamanho da cúpula sai por conta — vinte vezes essa altura — e o chão da
// fotografia encaixa no chão do bairro. Se os dois números não baterem
// certo, o terreno à volta estica, que é exactamente o defeito que se vê.
const ALTURA_DA_VISTA = 0.05;
const RAIO_DO_CHAO = 0.5;

const PADRAO = {
    ligado: true,
    rotacao: 291,
    brilho: 1,
    cupula: true,
    // A que altura, em metros, foi tirada a panorâmica. A marca do Olho de
    // Águia está a 150 metros, que é o ponto de partida natural.
    alturaDaFotografia: 150,
    alturaDaCupula: 0.1,
    // A cúpula não tem de ficar centrada na origem do mapa: a panorâmica
    // foi tirada de um ponto concreto do bairro, e é sobre esse ponto que
    // ela assenta melhor. Estas duas medidas deslocam-na no plano.
    deslocamentoX: -0.07,
    deslocamentoZ: -0.01
};

/**
 * Põe a panorâmica como céu e devolve os comandos para a afinar.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {object} Comandos do céu.
 */
export function ligarCeu(app) {
    const definicoes = Object.assign({}, PADRAO, lerGuardado());
    let cubo = null;
    let aCarregar = null;

    /**
     * Lê as afinações guardadas na visita anterior.
     *
     * @returns {object} O que estiver guardado, ou nada.
     */
    function lerGuardado() {
        let guardado;
        try {
            guardado = JSON.parse(localStorage.getItem(CHAVE) || '{}');
        } catch (e) {
            return {};
        }
        // Antes afinava-se o tamanho da cúpula à mão; agora afina-se a
        // altura da fotografia, que é a mesma coisa vista pelo lado que se
        // percebe. Quem tinha o número antigo guardado não o perde.
        if (guardado.tamanhoDaCupula !== undefined && guardado.alturaDaFotografia === undefined) {
            guardado.alturaDaFotografia = guardado.tamanhoDaCupula * ALTURA_DA_VISTA;
            delete guardado.tamanhoDaCupula;
        }
        return guardado;
    }

    /**
     * Guarda as afinações para a próxima visita.
     */
    function guardar() {
        try {
            localStorage.setItem(CHAVE, JSON.stringify(definicoes));
        } catch (e) { /* sem espaço ou sem permissão: não é grave */ }
    }

    /**
     * Traz a panorâmica e arruma-a nas seis faces do cubo do céu.
     *
     * @returns {Promise<object|null>} O cubo do céu, ou nada se falhar.
     */
    function carregar() {
        if (cubo) return Promise.resolve(cubo);
        if (aCarregar) return aCarregar;

        aCarregar = new Promise((resolve) => {
            const asset = new Asset('ceu-olho-de-aguia', 'texture', { url: IMAGEM });
            asset.once('load', () => {
                const tamanho = TAMANHO_DAS_FACES[window.actualQuality] || TAMANHO_DAS_FACES.med;
                try {
                    cubo = EnvLighting.generateSkyboxCubemap(asset.resource, tamanho);
                    resolve(cubo);
                } catch (e) {
                    console.warn('Céu: não foi possível preparar a panorâmica.', e);
                    resolve(null);
                }
            });
            asset.once('error', (erro) => {
                console.warn('Céu: não foi possível trazer a panorâmica.', erro);
                resolve(null);
            });
            app.assets.add(asset);
            app.assets.load(asset);
        });
        return aCarregar;
    }

    /**
     * Escreve as afinações actuais na cena.
     */
    function aplicar() {
        const cena = app.scene;
        if (!cena) return;

        if (!definicoes.ligado) {
            cena.skybox = null;
            return;
        }
        if (!cubo) return;

        cena.skybox = cubo;
        cena.skyboxIntensity = definicoes.brilho;
        cena.skyboxRotation = new Quat().setFromEulerAngles(0, definicoes.rotacao, 0);

        if (cena.sky) {
            cena.sky.type = definicoes.cupula ? 'dome' : 'infinite';
            if (definicoes.cupula) {
                const tamanho = definicoes.alturaDaFotografia / ALTURA_DA_VISTA;
                cena.sky.node.setLocalScale(tamanho, tamanho, tamanho);
                cena.sky.node.setLocalPosition(
                    definicoes.deslocamentoX,
                    definicoes.alturaDaCupula,
                    definicoes.deslocamentoZ
                );
                // O ponto de onde a fotografia é projectada. Conta-se em
                // medidas da própria cúpula, não em metros do mapa: o motor
                // multiplica-o pelo tamanho e pela posição dela. Escrevê-lo
                // em metros — como estava — atirava a projecção para dezenas
                // de metros ao lado, e era daí que vinha boa parte do
                // esticão do terreno em volta.
                cena.sky.center = new Vec3(0, ALTURA_DA_VISTA, 0);
            }
        }
        guardar();
    }

    /**
     * Muda uma afinação e mostra logo o resultado.
     *
     * @param {string} campo - Nome da afinação.
     * @param {number|boolean} valor - Novo valor.
     */
    function afinar(campo, valor) {
        definicoes[campo] = valor;
        if (campo === 'ligado' && valor && !cubo) {
            carregar().then(aplicar);
            return;
        }
        aplicar();
    }

    if (definicoes.ligado) {
        carregar().then(aplicar);
    }

    return {
        definicoes,
        afinar,
        aplicar,
        /** Até que distância, em metros, chega o chão da fotografia. */
        get raioDoChao() {
            return definicoes.alturaDaFotografia / ALTURA_DA_VISTA * RAIO_DO_CHAO;
        },
        /** Volta a pôr tudo como veio de fábrica. */
        reiniciar() {
            Object.assign(definicoes, PADRAO);
            if (!cubo) carregar().then(aplicar);
            else aplicar();
        }
    };
}
