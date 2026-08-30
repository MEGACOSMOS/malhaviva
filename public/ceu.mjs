import { EnvLighting, Mesh, PIXELFORMAT_RGBA8, PRIMITIVE_TRIANGLES, Quat, Texture, Vec3 } from 'playcanvas';
import { AJUSTES_PADRAO, LARGURA_FINAL, LARGURA_RAPIDA, tratarFotografia } from './ceu-fotografia.mjs?v=4';

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
 *
 * A taça do motor tem o fundo chato, e era daí que vinha o deslizamento: a
 * fotografia foi tirada de um ponto só, e o chão dela é atirado desse ponto
 * contra o fundo da taça. Se o fundo é um disco liso e o bairro é uma
 * encosta que desce quarenta metros até ao rio, a imagem do chão cai vinte
 * ou trinta metros ao lado do chão verdadeiro — e basta a câmara andar dois
 * passos para essa diferença se ver a escorregar. Por isso o fundo da taça
 * deixou de ser liso e passou a ter o feitio do próprio modelo: sobe onde o
 * bairro sobe e desce onde ele desce, e a imagem fica colada onde deve.
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
const CHAVE = 'ceu-olho-de-aguia-v11';

const PADRAO = {
    ligado: true,
    rotacao: 296,
    brilho: 1,
    cupula: true,
    tamanhoDaCupula: 857.6,
    alturaDaCupula: 0.1,
    // A cúpula não tem de ficar centrada na origem do mapa: a panorâmica
    // foi tirada de um ponto concreto do bairro, e é sobre esse ponto que
    // ela assenta melhor. Estas duas medidas deslocam-na no plano.
    deslocamentoX: -0.06,
    deslocamentoZ: 0,
    // Quanto se sobe o chão da fotografia em relação ao chão medido no
    // modelo. A medição apanha o ponto mais fundo de cada canto do bairro,
    // e o modelo tem sempre um pé de sujidade por baixo das ruas: pondo o
    // percurso a pé lado a lado com a medição, o passeio verdadeiro anda
    // cinco metros e picos acima dela, do princípio ao fim do bairro. É
    // essa diferença que aqui se repõe — e que se pode acertar à mão.
    deslocamentoY: 5.3
};

// De quantos em quantos metros se mede o chão do bairro. Oito metros
// chegam bem: isto é a cama por baixo das casas, não as casas.
const PASSO_DO_RELEVO = 8;

// Quantos metros de terreno se medem para lá da última casa. Serve para a
// fotografia ter onde assentar quando o modelo acaba antes da taça.
const FOLGA_DO_RELEVO = 200;

// Em quantas fatias se divide o fundo da taça: à volta, e do centro para
// fora. Com estes números cada retalho fica com seis a vinte metros — mais
// miúdo do que a própria medição do terreno, que é de oito em oito.
const FATIAS_A_VOLTA = 160;
const ANEIS_DO_CHAO = 72;

// Ao longo de quantos metros, mesmo antes da borda, o chão medido se
// desvanece até à altura em que a parede da taça começa. Sem este remate
// ficava um degrau onde um acaba e a outra principia — e é a última coisa
// que se vê antes do horizonte, onde o terreno já não tem parallax nenhum.
const REMATE_DA_BORDA = 60;

// As proporções da taça do motor, que a nossa tem de respeitar ponto por
// ponto para a paisagem por cima do horizonte não se mexer um milímetro:
// uma esfera de meio metro, com a metade de baixo achatada a trinta por
// cento, cortada num chão liso dentro de noventa e cinco centésimos do
// raio, e tudo subido um décimo.
const BANDAS_DE_LATITUDE = 50;
const RAIO_DO_CHAO = 0.95;
const ACHATAMENTO = 0.3;
const FUNDO = 0.1;

/**
 * Mede o chão do bairro a partir do próprio modelo.
 *
 * O modelo vem dividido numa árvore de zonas, e cada zona traz a caixa que
 * a encerra. A tampa de baixo dessas caixas, apanhada em coluna, é o chão:
 * onde há uma casa, a caixa mais funda da coluna desce até ao passeio; onde
 * há encosta, desce com ela.
 *
 * O que sai é uma grelha de alturas em metros do mundo, com folga larga à
 * volta, para a fotografia ter onde assentar mesmo depois de a última casa
 * do modelo acabar.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {Promise<object|null>} A grelha de alturas, ou nada se falhar.
 */
async function medirRelevo(app) {
    try {
        const elemento = document.getElementById('splat-scene');
        const mapa = app.root.findByName('gsplat-scene');
        if (!elemento || !mapa) return null;
        const meta = await (await fetch(elemento.getAttribute('src'))).json();
        if (!meta || !meta.tree) return null;

        const zonas = [];
        (function recolher(no) {
            if (!no.children || no.children.length === 0) {
                if (no.bound) zonas.push(no.bound);
                return;
            }
            no.children.forEach(recolher);
        })(meta.tree);
        if (!zonas.length) return null;

        // O mapa está rodado, por isso cada caixa é convertida para
        // coordenadas do mundo antes de se lhe olhar para a tampa de baixo.
        app.root.syncHierarchy();
        const matriz = mapa.getWorldTransform();
        const canto = new Vec3();

        const caixas = [];
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const b of zonas) {
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity;
            for (let i = 0; i < 8; i++) {
                canto.set(
                    i & 1 ? b.max[0] : b.min[0],
                    i & 2 ? b.max[1] : b.min[1],
                    i & 4 ? b.max[2] : b.min[2]
                );
                matriz.transformPoint(canto, canto);
                x0 = Math.min(x0, canto.x); x1 = Math.max(x1, canto.x);
                z0 = Math.min(z0, canto.z); z1 = Math.max(z1, canto.z);
                y0 = Math.min(y0, canto.y);
            }
            caixas.push({ x0, x1, z0, z1, y: y0 });
            minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
            minZ = Math.min(minZ, z0); maxZ = Math.max(maxZ, z1);
        }

        const folga = Math.ceil(FOLGA_DO_RELEVO / PASSO_DO_RELEVO);
        const colunas = Math.ceil((maxX - minX) / PASSO_DO_RELEVO) + folga * 2;
        const linhas = Math.ceil((maxZ - minZ) / PASSO_DO_RELEVO) + folga * 2;
        const origemX = minX - folga * PASSO_DO_RELEVO;
        const origemZ = minZ - folga * PASSO_DO_RELEVO;

        const alturas = new Float32Array(colunas * linhas);
        const temTerreno = new Uint8Array(colunas * linhas);

        for (const c of caixas) {
            const a = Math.max(0, Math.floor((c.x0 - origemX) / PASSO_DO_RELEVO));
            const b2 = Math.min(colunas - 1, Math.floor((c.x1 - origemX) / PASSO_DO_RELEVO));
            const d = Math.max(0, Math.floor((c.z0 - origemZ) / PASSO_DO_RELEVO));
            const e = Math.min(linhas - 1, Math.floor((c.z1 - origemZ) / PASSO_DO_RELEVO));
            for (let j = d; j <= e; j++) {
                for (let i = a; i <= b2; i++) {
                    const k = j * colunas + i;
                    if (!temTerreno[k] || c.y < alturas[k]) alturas[k] = c.y;
                    temTerreno[k] = 1;
                }
            }
        }

        // As células sem terreno herdam a altura das vizinhas — assim a
        // encosta continua para lá do modelo em vez de cair a pique — e
        // depois tudo é alisado: o que se quer é uma cama, não um recorte.
        espalhar(alturas, temTerreno, colunas, linhas);
        for (let i = 0; i < 3; i++) alisar(alturas, colunas, linhas);

        return { alturas, colunas, linhas, origemX, origemZ, passo: PASSO_DO_RELEVO };
    } catch (e) {
        console.warn('Céu: não foi possível medir o chão do bairro.', e);
        return null;
    }
}

/**
 * Dá altura às células vazias, copiando das vizinhas até não sobrar nenhuma.
 *
 * @param {Float32Array} alturas - Grelha de alturas.
 * @param {Uint8Array} temTerreno - Que células têm terreno.
 * @param {number} colunas - Largura da grelha.
 * @param {number} linhas - Altura da grelha.
 */
function espalhar(alturas, temTerreno, colunas, linhas) {
    const sabido = Uint8Array.from(temTerreno);
    for (let volta = 0; volta < 200; volta++) {
        let mudou = false;
        const antes = Uint8Array.from(sabido);
        for (let j = 0; j < linhas; j++) {
            for (let i = 0; i < colunas; i++) {
                const k = j * colunas + i;
                if (antes[k]) continue;
                let soma = 0, contados = 0;
                for (let dj = -1; dj <= 1; dj++) {
                    for (let di = -1; di <= 1; di++) {
                        const i2 = i + di, j2 = j + dj;
                        if (i2 < 0 || j2 < 0 || i2 >= colunas || j2 >= linhas) continue;
                        const k2 = j2 * colunas + i2;
                        if (!antes[k2]) continue;
                        soma += alturas[k2];
                        contados++;
                    }
                }
                if (contados) {
                    alturas[k] = soma / contados;
                    sabido[k] = 1;
                    mudou = true;
                }
            }
        }
        if (!mudou) break;
    }
}

/**
 * Passa uma mão de alisamento pela grelha de alturas.
 *
 * @param {Float32Array} alturas - Grelha de alturas.
 * @param {number} colunas - Largura da grelha.
 * @param {number} linhas - Altura da grelha.
 */
function alisar(alturas, colunas, linhas) {
    const copia = Float32Array.from(alturas);
    for (let j = 1; j < linhas - 1; j++) {
        for (let i = 1; i < colunas - 1; i++) {
            const k = j * colunas + i;
            alturas[k] = (
                copia[k] * 4 +
                copia[k - 1] + copia[k + 1] +
                copia[k - colunas] + copia[k + colunas]
            ) / 8;
        }
    }
}

/**
 * A altura do chão num ponto qualquer do plano, em metros do mundo.
 *
 * Fora da grelha vale a altura da borda: o terreno continua para lá do que
 * foi medido, e continuá-lo a direito é menos errado do que deixá-lo cair.
 *
 * @param {object} relevo - A grelha devolvida por medirRelevo.
 * @param {number} x - Coordenada X, em metros.
 * @param {number} z - Coordenada Z, em metros.
 * @returns {number} A altura, em metros.
 */
function alturaEm(relevo, x, z) {
    const { alturas, colunas, linhas, origemX, origemZ, passo } = relevo;
    let fi = (x - origemX) / passo;
    let fj = (z - origemZ) / passo;
    fi = Math.min(Math.max(fi, 0), colunas - 1.0001);
    fj = Math.min(Math.max(fj, 0), linhas - 1.0001);

    const i = Math.floor(fi), j = Math.floor(fj);
    const tx = fi - i, tz = fj - j;
    const k = j * colunas + i;
    const a = alturas[k], b = alturas[k + 1];
    const c = alturas[k + colunas], d = alturas[k + colunas + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/**
 * Suaviza um valor de zero a um, para os remates não terem esquinas.
 *
 * @param {number} t - Quanto do caminho já foi feito.
 * @returns {number} O mesmo caminho, sem solavancos nas pontas.
 */
function suavizar(t) {
    const s = Math.min(Math.max(t, 0), 1);
    return s * s * (3 - 2 * s);
}

/**
 * Talha a taça do céu com o fundo pelo feitio do bairro.
 *
 * Do horizonte para cima é ponto por ponto a taça que o motor faz — a mesma
 * esfera de meio metro, as mesmas bandas — para nada do que já estava
 * afinado se mexer. Do horizonte para dentro é que muda: em vez do disco
 * liso, o fundo acompanha o chão medido no modelo.
 *
 * As contas ficam todas em medidas da própria taça, que é como o motor a
 * quer: ela é depois esticada pelo tamanho escolhido e posta no sítio. Por
 * isso cada altura em metros é dividida por esse tamanho antes de entrar.
 *
 * @param {object} relevo - A grelha de alturas do bairro.
 * @param {object} forma - Tamanho, centro e altura da taça, e o acerto à mão.
 * @returns {object} Os pontos e os triângulos da taça.
 */
function talharCupula(relevo, forma) {
    const { tamanho, centroX, centroZ, base, levantar } = forma;
    const aneis = [];

    // A taça do motor, tal e qual, até onde ela começa a ser chão liso.
    for (let banda = 0; banda <= BANDAS_DE_LATITUDE; banda++) {
        const angulo = banda * Math.PI / BANDAS_DE_LATITUDE;
        const raio = Math.sin(angulo);
        const y = Math.cos(angulo);
        if (y < 0 && raio * raio < RAIO_DO_CHAO * RAIO_DO_CHAO) break;
        const achatado = y < 0 ? y * ACHATAMENTO : y;
        aneis.push({ raio, altura: (achatado + FUNDO) * 0.5, terreno: false });
    }

    // Onde a parede da taça acaba e o nosso chão principia.
    const borda = aneis[aneis.length - 1];
    const remate = REMATE_DA_BORDA / (tamanho * 0.5);

    for (let anel = 1; anel <= ANEIS_DO_CHAO; anel++) {
        aneis.push({
            raio: borda.raio * (1 - anel / ANEIS_DO_CHAO),
            altura: borda.altura,
            terreno: true
        });
    }

    const larguraDoAnel = FATIAS_A_VOLTA + 1;
    const pontos = new Float32Array(aneis.length * larguraDoAnel * 3);
    let p = 0;
    for (const anel of aneis) {
        // Junto à borda o chão medido desvanece-se até à altura a que a
        // parede da taça principia, senão ficava ali um degrau de trinta
        // metros — e é o sítio onde o terreno menos se mexe com a câmara.
        const peso = anel.terreno ? suavizar((borda.raio - anel.raio) / remate) : 0;
        for (let volta = 0; volta <= FATIAS_A_VOLTA; volta++) {
            const angulo = volta * 2 * Math.PI / FATIAS_A_VOLTA - Math.PI / 2;
            const x = Math.cos(angulo) * anel.raio * 0.5;
            const z = Math.sin(angulo) * anel.raio * 0.5;
            let y = anel.altura;
            if (anel.terreno) {
                const chao = alturaEm(relevo, centroX + tamanho * x, centroZ + tamanho * z);
                const medido = (chao + levantar - base) / tamanho;
                y = medido * peso + borda.altura * (1 - peso);
            }
            pontos[p++] = x;
            pontos[p++] = y;
            pontos[p++] = z;
        }
    }

    // Os triângulos são cosidos como o motor cose os da esfera dele: assim
    // ficam virados para o mesmo lado, e o motor, que desenha o céu por
    // dentro e esconde o que está virado para fora, aceita-os sem mais.
    const triangulos = new Uint16Array((aneis.length - 1) * FATIAS_A_VOLTA * 6);
    let t = 0;
    for (let anel = 0; anel < aneis.length - 1; anel++) {
        for (let volta = 0; volta < FATIAS_A_VOLTA; volta++) {
            const primeiro = anel * larguraDoAnel + volta;
            const segundo = primeiro + larguraDoAnel;
            triangulos[t++] = primeiro + 1;
            triangulos[t++] = segundo;
            triangulos[t++] = primeiro;
            triangulos[t++] = primeiro + 1;
            triangulos[t++] = segundo + 1;
            triangulos[t++] = segundo;
        }
    }

    return { pontos, triangulos };
}

/**
 * Passa os pontos talhados a uma malha que o motor saiba desenhar.
 *
 * @param {object} dispositivo - O dispositivo gráfico.
 * @param {object} feitio - Os pontos e os triângulos.
 * @returns {object} A malha pronta a desenhar.
 */
function construirMalha(dispositivo, feitio) {
    const malha = new Mesh(dispositivo);
    malha.setPositions(feitio.pontos);
    malha.setIndices(feitio.triangulos);
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
    definicoes.ajustes = Object.assign({}, AJUSTES_PADRAO, definicoes.ajustes || {});
    let cubo = null;
    let fotografia = null;
    let aTrazer = null;
    let temporizador = null;
    let relevo = null;
    let feitio = null;
    let malha = null;
    let talhadas = {};

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
     * Põe a nossa taça no lugar da que o motor faz de origem.
     *
     * Isto é confirmado a cada imagem, e não só quando se mexe nos
     * comandos, porque o motor refaz o céu por sua conta — ao trocar a
     * fotografia, o brilho ou o tipo — e leva a nossa taça com ele, que
     * fica um objecto vazio, sem pontos lá dentro. A confirmação é uma
     * comparação e não custa nada; talhar de novo só acontece quando as
     * medidas mudam mesmo.
     *
     * @param {object} cena - A cena 3D.
     */
    function assentarNoBairro(cena) {
        if (!relevo || !definicoes.cupula) return;
        const desenho = cena.sky && cena.sky.skyMesh && cena.sky.skyMesh.meshInstance;
        if (!desenho) return;

        const tamanho = definicoes.tamanhoDaCupula;
        const centroX = definicoes.deslocamentoX;
        const centroZ = definicoes.deslocamentoZ;
        const base = definicoes.alturaDaCupula;
        const levantar = definicoes.deslocamentoY;

        if (!feitio || tamanho !== talhadas.tamanho || centroX !== talhadas.centroX ||
            centroZ !== talhadas.centroZ || base !== talhadas.base ||
            levantar !== talhadas.levantar) {
            talhadas = { tamanho, centroX, centroZ, base, levantar };
            feitio = talharCupula(relevo, talhadas);
            malha = null;
        }
        if (!malha || !malha.vertexBuffer) {
            malha = construirMalha(app.graphicsDevice, feitio);
        }
        if (desenho.mesh !== malha) {
            const anterior = desenho.mesh;
            desenho.mesh = malha;
            // A taça que estava — a do motor, ou uma nossa já ultrapassada —
            // fica sem ninguém a segurá-la; é altura de a largar.
            if (anterior && anterior.refCount === 0 && anterior.vertexBuffer) {
                anterior.destroy();
            }
        }
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
                assentarNoBairro(cena);
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

    // A vigia que repõe a taça sempre que o motor a deita fora. Fica
    // registada depois da do próprio motor, e por isso corre a seguir.
    app.scene.on('prerender', () => {
        if (!definicoes.ligado || !definicoes.cupula || !cubo) return;
        assentarNoBairro(app.scene);
    });

    // O chão do bairro demora um instante a ser medido; quando chega, a
    // taça é talhada com ele e a fotografia deixa de escorregar.
    medirRelevo(app).then((medido) => {
        if (!medido) return;
        relevo = medido;
        feitio = null;
        aplicar();
    });

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
        /** Se o chão do céu já tomou o feitio do bairro. */
        get segueOBairro() {
            return !!relevo;
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
