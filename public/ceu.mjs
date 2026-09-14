import { EnvLighting, PIXELFORMAT_RGBA8, Quat, Texture, Vec3 } from 'playcanvas';
import { AJUSTES_PADRAO, LARGURA_FINAL, LARGURA_RAPIDA, tratarFotografia } from './ceu-fotografia.mjs?v=6';

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
 * "Cúpula" assenta a panorâmica numa taça em volta do mapa, o que põe a
 * paisagem à distância certa em vez de a deixar no infinito.
 *
 * A taça do motor é a do motor: uma esfera com o fundo chato. Esse fundo
 * chato era o que fazia o chão da fotografia escorregar — ela é atirada de
 * um ponto só, o sítio de onde o drone a tirou, e ia bater contra um disco
 * liso que não é o chão a sério. Aqui não se lhe mexe na forma: o chão é
 * tirado da própria fotografia, que se apaga a partir de uns graus abaixo
 * do horizonte (ver ceu-fotografia.mjs). Onde ela se apaga fica o fundo do
 * bairro, e quem faz de chão passa a ser o bairro, que é quem o tem a
 * sério. A paisagem ao longe, essa, fica — é a que faz falta e é a que não
 * escorrega.
 */

// A fotografia já vem tratada: a luz, a cor e o contraste foram assados
// nela de uma vez por todas, a partir do original em vírgula flutuante
// (ver scripts/assar-ceu.py). Assim não há contas a fazer a cada visita,
// não há bandas de tanto esticar 256 tons, e o que passava do branco em
// vez de chapar ficou com desenho. O editor aqui em baixo continua a
// servir para experimentar por cima — mas o que ele mostrar já é acerto
// sobre acerto.
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
// O número no fim muda sempre que os valores de fábrica mudam: assim o que
// ficou guardado de uma afinação antiga não volta a ser aplicado por cima
// de uma fotografia que já a traz embutida.
const CHAVE = 'ceu-olho-de-aguia-v15';

const PADRAO = {
    ligado: true,
    rotacao: 296,
    brilho: 0.8,
    cupula: true,
    tamanhoDaCupula: 857.6,
    alturaDaCupula: 0.1,
    // A cúpula não tem de ficar centrada na origem do mapa: a panorâmica
    // foi tirada de um ponto concreto do bairro, e é sobre esse ponto que
    // ela assenta melhor. Estas duas medidas deslocam-na no plano.
    deslocamentoX: -0.06,
    deslocamentoZ: 0
};

/**
 * Põe a panorâmica como céu e devolve os comandos para a afinar.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {object} Comandos do céu.
 */
export function ligarCeu(app) {
    const definicoes = Object.assign({}, PADRAO, lerGuardado());
    definicoes.ajustes = Object.assign({}, AJUSTES_PADRAO, definicoes.ajustes || {});
    let cubo = null;
    let fotografia = null;
    let aTrazer = null;
    let temporizador = null;

    /**
     * Lê as afinações guardadas na visita anterior.
     *
     * @returns {object} O que estiver guardado, ou nada.
     */
    function lerGuardado() {
        try {
            return JSON.parse(localStorage.getItem(CHAVE) || '{}');
        } catch (e) {
            return {};
        }
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
     * Traz a fotografia do servidor, uma vez só.
     *
     * @returns {Promise<HTMLImageElement|null>} A fotografia, ou nada.
     */
    function trazerFotografia() {
        if (fotografia) return Promise.resolve(fotografia);
        if (aTrazer) return aTrazer;
        aTrazer = new Promise((resolve) => {
            const imagem = new Image();
            imagem.onload = () => { fotografia = imagem; resolve(imagem); };
            imagem.onerror = () => {
                console.warn('Céu: não foi possível trazer a fotografia.');
                resolve(null);
            };
            imagem.src = IMAGEM;
        });
        return aTrazer;
    }

    /**
     * Arruma a fotografia nas seis faces do cubo do céu, já tratada.
     *
     * @param {number} [largura] - Largura de trabalho da fotografia.
     * @returns {Promise<object|null>} O cubo do céu, ou nada se falhar.
     */
    async function construirCubo(largura) {
        const imagem = await trazerFotografia();
        if (!imagem) return null;
        try {
            const fonte = tratarFotografia(imagem, definicoes.ajustes, largura || LARGURA_FINAL);
            // A textura tem de ser feita exactamente como o motor a fazia
            // quando carregava a fotografia sozinho. Parece detalhe, mas
            // não é: mexer na projecção ou nos mipmaps muda a maneira como
            // a imagem é enrolada no cubo, e a paisagem acaba noutro sítio
            // do horizonte.
            const plana = new Texture(app.graphicsDevice, {
                name: 'ceu-tratado',
                width: fonte.width,
                height: fonte.height,
                format: PIXELFORMAT_RGBA8,
                mipmaps: true
            });
            plana.setSource(fonte);

            const faces = TAMANHO_DAS_FACES[window.actualQuality] || TAMANHO_DAS_FACES.med;
            const novo = EnvLighting.generateSkyboxCubemap(plana, faces);
            plana.destroy();
            if (cubo) cubo.destroy();
            cubo = novo;
            return cubo;
        } catch (e) {
            console.warn('Céu: não foi possível preparar a fotografia.', e);
            return null;
        }
    }

    /**
     * Refaz o céu depois de se mexer nos ajustes da fotografia.
     *
     * Enquanto a mão anda no cursor trabalha-se em pequeno, que é
     * instantâneo; mal ela pára, refaz-se em tamanho grande.
     */
    function refazerFotografia() {
        construirCubo(LARGURA_RAPIDA).then(aplicar);
        clearTimeout(temporizador);
        temporizador = setTimeout(() => {
            construirCubo(LARGURA_FINAL).then(aplicar);
        }, 450);
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
                const t = definicoes.tamanhoDaCupula;
                const x = definicoes.deslocamentoX;
                const z = definicoes.deslocamentoZ;
                cena.sky.node.setLocalScale(t, t, t);
                cena.sky.node.setLocalPosition(x, definicoes.alturaDaCupula, z);
                // O centro tem de acompanhar a cúpula, senão a projecção
                // fica a olhar para um sítio onde ela já não está.
                cena.sky.center = new Vec3(x, definicoes.alturaDaCupula, z);
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
            construirCubo(LARGURA_FINAL).then(aplicar);
            return;
        }
        aplicar();
    }

    /**
     * Muda um ajuste da própria fotografia — luz, cor ou desfoque — e
     * mostra logo o resultado.
     *
     * @param {string} campo - Nome do ajuste.
     * @param {number} valor - Novo valor.
     */
    function afinarFotografia(campo, valor) {
        definicoes.ajustes[campo] = valor;
        guardar();
        refazerFotografia();
    }

    if (definicoes.ligado) {
        construirCubo(LARGURA_FINAL).then(aplicar);
    }

    return {
        definicoes,
        afinar,
        afinarFotografia,
        aplicar,

        /**
         * Onde ficam as paredes da cúpula, em metros do mundo.
         *
         * O motor desenha a cúpula a partir de uma esfera de meio metro:
         * corta-lhe a metade de baixo num chão chato, sobe tudo um décimo e
         * só depois multiplica pelo tamanho que aqui se escolhe. Daí saírem
         * estes três números: o chão fica a zero, a barriga mais larga a
         * cinco centésimos do tamanho, e o alto da abóbada a cinquenta e
         * cinco centésimos.
         *
         * Serve à câmara para saber até onde pode andar: as paredes da taça
         * são o fim do mundo visível, e passar delas seria sair da fotografia.
         *
         * @returns {object|null} As medidas, ou nada se não houver cúpula.
         */
        limites() {
            if (!definicoes.ligado || !definicoes.cupula) {
                return null;
            }
            const tamanho = definicoes.tamanhoDaCupula;
            const base = definicoes.alturaDaCupula;
            return {
                centroX: definicoes.deslocamentoX,
                centroZ: definicoes.deslocamentoZ,
                raio: tamanho * 0.5,
                chao: base,
                barriga: base + tamanho * 0.05,
                topo: base + tamanho * 0.55
            };
        },
        /** Volta a pôr tudo como veio de fábrica. */
        reiniciar() {
            Object.assign(definicoes, PADRAO);
            definicoes.ajustes = Object.assign({}, AJUSTES_PADRAO);
            guardar();
            refazerFotografia();
        },
        /** Volta a pôr só a fotografia como veio da máquina. */
        reiniciarFotografia() {
            definicoes.ajustes = Object.assign({}, AJUSTES_PADRAO);
            guardar();
            refazerFotografia();
        }
    };
}
