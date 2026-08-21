import { Asset, EnvLighting, Mesh, PRIMITIVE_TRIANGLES, Quat, Vec3 } from 'playcanvas';

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
 * A outra é a muralha: a fotografia encosta a uma parede redonda em volta
 * do bairro, que lá em cima fecha em cúpula. Assim a metade de baixo da
 * fotografia — a que estica sem remédio, por ter sido tirada de um ponto
 * só — fica arrumada atrás do modelo, e o chão continua a ser o do bairro.
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
    tamanhoDaCupula: 833.5,
    alturaDaCupula: 0.1,
    // Onde a muralha acaba e a cúpula começa, e até onde desce por baixo
    // do bairro. A muralha tem de subir acima do ponto de vista da
    // fotografia, senão o horizonte dela cairia já na parte curva.
    alturaDaMuralha: 120,
    profundidadeDaMuralha: 120,
    // A cúpula não tem de ficar centrada na origem do mapa: a panorâmica
    // foi tirada de um ponto concreto do bairro, e é sobre esse ponto que
    // ela assenta melhor. Estas duas medidas deslocam-na no plano.
    deslocamentoX: -0.07,
    deslocamentoZ: -0.01
};

// Em quantas fatias se divide a volta. Cento e vinte e oito dão uma
// muralha redonda o suficiente para ninguém lhe ver os cantos.
const FATIAS_A_VOLTA = 128;

// Em quantos degraus a cúpula sobe, do cimo da muralha até ao topo.
const DEGRAUS_DA_CUPULA = 24;

/**
 * Constroi a superficie onde a fotografia assenta: uma muralha a toda a
 * volta do bairro que, lá em cima, fecha numa cúpula.
 *
 * A razão de ser desta forma é o esticão do terreno. Numa cúpula de fundo
 * assente no chão, a metade de baixo da fotografia — que foi tirada de um
 * ponto só — tem de ser espalhada por todo o terreno em volta, e estica
 * sem remédio. Numa muralha, essa metade cai atrás do modelo, encostada,
 * e o que sobra à vista é a faixa junto ao horizonte, que é a única parte
 * da fotografia que ali faz sentido. O chão fica por conta do bairro, que
 * é quem o tem a sério.
 *
 * Não há fundo nenhum: por baixo está o modelo, e a muralha desce abaixo
 * dele o suficiente para não se ver por onde acaba.
 *
 * @param {object} dispositivo - O dispositivo grafico.
 * @param {number} raio - A que distancia fica a muralha, em metros.
 * @param {number} base - Onde comeca a muralha, em metros (abaixo de zero).
 * @param {number} altura - Onde acaba a muralha e comeca a cupula.
 * @returns {object} A malha pronta a desenhar.
 */
function criarSuperficie(dispositivo, raio, base, altura) {
    const pontos = [];
    const triangulos = [];

    /**
     * Põe um anel de pontos à volta, a uma dada altura e distância.
     *
     * @param {number} r - Distancia ao eixo.
     * @param {number} y - Altura.
     * @returns {number} O indice do primeiro ponto do anel.
     */
    const anel = (r, y) => {
        const primeiro = pontos.length / 3;
        for (let a = 0; a < FATIAS_A_VOLTA; a++) {
            const ang = a / FATIAS_A_VOLTA * Math.PI * 2;
            pontos.push(Math.cos(ang) * r, y, Math.sin(ang) * r);
        }
        return primeiro;
    };

    /**
     * Cose dois anéis um ao outro.
     *
     * @param {number} baixo - Indice do primeiro ponto do anel de baixo.
     * @param {number} cima - Indice do primeiro ponto do anel de cima.
     */
    const coser = (baixo, cima) => {
        for (let a = 0; a < FATIAS_A_VOLTA; a++) {
            const b = (a + 1) % FATIAS_A_VOLTA;
            triangulos.push(baixo + a, cima + b, cima + a);
            triangulos.push(baixo + a, baixo + b, cima + b);
        }
    };

    // A muralha: direita, do fundo até onde começa a cúpula. Sendo recta,
    // dois anéis chegam — o que se vê entre eles é exacto na mesma.
    const fundo = anel(raio, base);
    const cimo = anel(raio, altura);
    coser(fundo, cimo);

    // A cúpula: a partir do cimo da muralha, a curvar até fechar.
    let anterior = cimo;
    for (let d = 1; d <= DEGRAUS_DA_CUPULA; d++) {
        const t = d / DEGRAUS_DA_CUPULA * Math.PI / 2;
        const seguinte = anel(raio * Math.cos(t), altura + raio * Math.sin(t));
        coser(anterior, seguinte);
        anterior = seguinte;
    }

    // O último anel é já quase um ponto; fecha-se com um remate no topo.
    const topo = pontos.length / 3;
    pontos.push(0, altura + raio, 0);
    for (let a = 0; a < FATIAS_A_VOLTA; a++) {
        const b = (a + 1) % FATIAS_A_VOLTA;
        triangulos.push(topo, anterior + a, anterior + b);
    }

    // O céu é visto por dentro, e o motor desenha-o a esconder as faces
    // viradas para fora. Os triângulos são construídos acima virados para
    // fora, que é como se pensa neles; aqui viram-se todos do avesso, de
    // uma vez, para o motor os aceitar.
    for (let i = 0; i < triangulos.length; i += 3) {
        const meio = triangulos[i + 1];
        triangulos[i + 1] = triangulos[i + 2];
        triangulos[i + 2] = meio;
    }

    const malha = new Mesh(dispositivo);
    malha.setPositions(pontos);
    malha.setIndices(triangulos);
    malha.update(PRIMITIVE_TRIANGLES);
    return malha;
}

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
    let superficie = null;
    let formaDaSuperficie = '';

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
        // Houve uma versão que guardava a altura da fotografia em vez do
        // tamanho; converte-se de volta para não se perder a afinação.
        if (guardado.alturaDaFotografia !== undefined && guardado.tamanhoDaCupula === undefined) {
            guardado.tamanhoDaCupula = guardado.alturaDaFotografia / ALTURA_DA_VISTA;
            delete guardado.alturaDaFotografia;
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
                // A malha do céu é feita por nós, em metros do mapa, por
                // isso o suporte dela fica à escala de um para um: o que
                // desloca a fotografia é o ponto de projecção, não a malha.
                cena.sky.node.setLocalScale(1, 1, 1);
                cena.sky.node.setLocalPosition(0, definicoes.alturaDaCupula, 0);

                // De onde a fotografia é projectada: o sítio de onde foi
                // tirada. Como o suporte está a um para um, estes são
                // metros do mapa como quaisquer outros.
                cena.sky.center = new Vec3(
                    definicoes.deslocamentoX,
                    definicoes.tamanhoDaCupula * ALTURA_DA_VISTA,
                    definicoes.deslocamentoZ
                );

                aplicarSuperficie(cena);
            }
        }
        guardar();
    }

    /**
     * Constrói a superfície, se ainda não existir com este alcance, e
     * põe-na no lugar da cúpula que o motor faz de origem.
     *
     * Isto é confirmado a cada imagem, e não só quando se mexe nos
     * comandos, porque o motor refaz o céu por sua conta — ao mudar a
     * imagem, o brilho ou o tipo — e leva a nossa superfície com ele. A
     * confirmação é uma comparação, não custa nada; refazer só acontece
     * quando é mesmo preciso.
     *
     * @param {object} cena - A cena 3D.
     */
    function aplicarSuperficie(cena) {
        const raio = definicoes.tamanhoDaCupula * RAIO_DO_CHAO;
        const base = -Math.abs(definicoes.profundidadeDaMuralha);
        const altura = definicoes.alturaDaMuralha;
        const forma = raio + '|' + base + '|' + altura;

        // Quando o motor refaz o céu, leva a nossa malha com ele — fica um
        // objecto vazio, sem os pontos lá dentro. Vale a pena reparar
        // nisso antes de a tentar usar outra vez.
        const desfeita = superficie && !superficie.vertexBuffer;
        if (!superficie || desfeita || forma !== formaDaSuperficie) {
            superficie = criarSuperficie(app.graphicsDevice, raio, base, altura);
            formaDaSuperficie = forma;
        }
        const desenho = cena.sky.skyMesh && cena.sky.skyMesh.meshInstance;
        if (desenho && desenho.mesh !== superficie) {
            desenho.mesh = superficie;
        }
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

    // A vigia que repõe a superfície sempre que o motor a deita fora. Fica
    // registada depois da do próprio motor, e por isso corre a seguir.
    app.scene.on('prerender', () => {
        if (!definicoes.ligado || !definicoes.cupula || !cubo) return;
        const cena = app.scene;
        if (!cena.sky || !cena.sky.skyMesh || !cena.sky.skyMesh.meshInstance) return;
        aplicarSuperficie(cena);
    });

    return {
        definicoes,
        afinar,
        aplicar,
        /** A que distância fica a muralha, em metros. */
        get raioDoChao() {
            return definicoes.tamanhoDaCupula * RAIO_DO_CHAO;
        },
        /** Volta a pôr tudo como veio de fábrica. */
        reiniciar() {
            Object.assign(definicoes, PADRAO);
            if (!cubo) carregar().then(aplicar);
            else aplicar();
        }
    };
}
