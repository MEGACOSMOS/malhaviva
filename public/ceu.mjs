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
    tamanhoDaCupula: 833.5,
    alturaDaCupula: 0.1,
    // A cúpula não tem de ficar centrada na origem do mapa: a panorâmica
    // foi tirada de um ponto concreto do bairro, e é sobre esse ponto que
    // ela assenta melhor. Estas duas medidas deslocam-na no plano.
    deslocamentoX: -0.07,
    deslocamentoZ: -0.01
};

// De quantos em quantos metros se mede o relevo do bairro. Oito metros
// chegam bem: isto e o chao por baixo e a volta do modelo, nao o modelo.
const PASSO_DO_RELEVO = 8;

// Ao longo de quantos metros, para la da ultima casa, o relevo se desvanece
// ate ao nivel de fora. Sem esta descida havia um degrau na borda.
const DESCIDA_DAS_BORDAS = 120;

// Em quantas fatias se divide a superficie: a volta e do centro para fora.
// Do centro para fora as fatias sao desiguais de proposito - juntas ao pe,
// largas ao longe, que e onde a fotografia ja nao tem pormenor nenhum.
const FATIAS_A_VOLTA = 128;
const FATIAS_ATE_AO_FIM = 72;

/**
 * Mede o relevo do bairro a partir do proprio modelo.
 *
 * A arvore de zonas do modelo diz onde ha terreno e entre que alturas.
 * Guardando a altura mais baixa de cada zona fica-se com o chao por baixo
 * das casas, que e o que interessa para assentar a fotografia.
 *
 * @param {object} app - A aplicacao 3D.
 * @returns {Promise<object|null>} A grelha de alturas, ou nada se falhar.
 */
async function medirRelevo(app) {
    try {
        const elemento = document.getElementById('splat-scene');
        const meta = await (await fetch(elemento.getAttribute('src'))).json();
        const mapa = app.root.findByName('gsplat-scene');
        if (!meta || !meta.tree || !mapa) return null;

        const zonas = [];
        (function recolher(no) {
            if (!no.children || no.children.length === 0) {
                if (no.bound) zonas.push(no.bound);
                return;
            }
            no.children.forEach(recolher);
        })(meta.tree);
        if (!zonas.length) return null;

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

        const folga = Math.ceil(DESCIDA_DAS_BORDAS / PASSO_DO_RELEVO) + 2;
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

        // As celulas sem terreno herdam a altura das vizinhas, e depois
        // tudo e alisado: o que se quer e uma cama, nao um recorte.
        espalhar(alturas, temTerreno, colunas, linhas);
        for (let i = 0; i < 3; i++) alisar(alturas, colunas, linhas);

        return { alturas, colunas, linhas, origemX, origemZ, passo: PASSO_DO_RELEVO };
    } catch (e) {
        console.warn('Ceu: nao foi possivel medir o relevo do bairro.', e);
        return null;
    }
}

/**
 * Da altura as celulas vazias, copiando das vizinhas ate nao sobrar nenhuma.
 *
 * @param {Float32Array} alturas - Grelha de alturas.
 * @param {Uint8Array} temTerreno - Que celulas tem terreno.
 * @param {number} colunas - Largura da grelha.
 * @param {number} linhas - Altura da grelha.
 */
function espalhar(alturas, temTerreno, colunas, linhas) {
    const sabido = Uint8Array.from(temTerreno);
    for (let volta = 0; volta < 80; volta++) {
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
 * Passa uma mao de alisamento pela grelha de alturas.
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
 * A altura do relevo num ponto qualquer do plano.
 *
 * @param {object} relevo - A grelha devolvida por medirRelevo.
 * @param {number} x - Coordenada X, em metros.
 * @param {number} z - Coordenada Z, em metros.
 * @returns {number} A altura, em metros.
 */
function alturaEm(relevo, x, z) {
    const { alturas, colunas, linhas, origemX, origemZ, passo } = relevo;
    const fi = (x - origemX) / passo;
    const fj = (z - origemZ) / passo;
    if (fi < 0 || fj < 0 || fi >= colunas - 1 || fj >= linhas - 1) return 0;

    const i = Math.floor(fi), j = Math.floor(fj);
    const tx = fi - i, tz = fj - j;
    const k = j * colunas + i;
    const a = alturas[k], b = alturas[k + 1];
    const c = alturas[k + colunas], d = alturas[k + colunas + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/**
 * Constroi a superficie onde a fotografia assenta.
 *
 * Em vez de uma cupula de fundo liso, o chao desta superficie segue o
 * relevo do bairro: sobe onde o bairro sobe, desce onde desce, e vai-se
 * desvanecendo ate ao nivel de fora a medida que se afasta. A partir do
 * anel do horizonte sobe uma parede e fecha-se por cima, para o ceu nao
 * ficar com buracos.
 *
 * @param {object} dispositivo - O dispositivo grafico.
 * @param {object|null} relevo - A grelha de alturas, se existir.
 * @param {number} raio - Ate onde chega o chao, em metros.
 * @param {number} alturaDaVista - Altura do ponto de vista, em metros.
 * @returns {object} A malha pronta a desenhar.
 */
function criarSuperficie(dispositivo, relevo, raio, alturaDaVista) {
    const pontos = [];
    const triangulos = [];

    const alturaNoPonto = (x, z, r) => {
        if (!relevo) return 0;
        // Longe do bairro o relevo deixa de fazer sentido e assenta.
        const excesso = Math.max(0, r - raio * 0.35);
        const peso = Math.max(0, 1 - excesso / DESCIDA_DAS_BORDAS);
        return alturaEm(relevo, x, z) * peso;
    };

    pontos.push(0, alturaNoPonto(0, 0, 0), 0);
    for (let anel = 1; anel <= FATIAS_ATE_AO_FIM; anel++) {
        const t = anel / FATIAS_ATE_AO_FIM;
        const r = raio * t * t;
        for (let a = 0; a < FATIAS_A_VOLTA; a++) {
            const ang = a / FATIAS_A_VOLTA * Math.PI * 2;
            const x = Math.cos(ang) * r;
            const z = Math.sin(ang) * r;
            pontos.push(x, alturaNoPonto(x, z, r), z);
        }
    }

    const indiceDoAnel = (anel) => 1 + (anel - 1) * FATIAS_A_VOLTA;

    for (let a = 0; a < FATIAS_A_VOLTA; a++) {
        const b = (a + 1) % FATIAS_A_VOLTA;
        triangulos.push(0, indiceDoAnel(1) + b, indiceDoAnel(1) + a);
    }
    for (let anel = 1; anel < FATIAS_ATE_AO_FIM; anel++) {
        const dentro = indiceDoAnel(anel);
        const fora = indiceDoAnel(anel + 1);
        for (let a = 0; a < FATIAS_A_VOLTA; a++) {
            const b = (a + 1) % FATIAS_A_VOLTA;
            triangulos.push(dentro + a, fora + b, fora + a);
            triangulos.push(dentro + a, dentro + b, fora + b);
        }
    }

    const alturaDoTecto = alturaDaVista + raio;
    const baseDaParede = pontos.length / 3;
    for (let a = 0; a < FATIAS_A_VOLTA; a++) {
        const ang = a / FATIAS_A_VOLTA * Math.PI * 2;
        pontos.push(Math.cos(ang) * raio, alturaDoTecto, Math.sin(ang) * raio);
    }
    const ultimoAnel = indiceDoAnel(FATIAS_ATE_AO_FIM);
    for (let a = 0; a < FATIAS_A_VOLTA; a++) {
        const b = (a + 1) % FATIAS_A_VOLTA;
        triangulos.push(ultimoAnel + a, baseDaParede + b, baseDaParede + a);
        triangulos.push(ultimoAnel + a, ultimoAnel + b, baseDaParede + b);
    }

    const tecto = pontos.length / 3;
    pontos.push(0, alturaDoTecto, 0);
    for (let a = 0; a < FATIAS_A_VOLTA; a++) {
        const b = (a + 1) % FATIAS_A_VOLTA;
        triangulos.push(tecto, baseDaParede + a, baseDaParede + b);
    }

    // O céu é visto por dentro, e o motor desenha-o a esconder as faces
    // viradas para fora. Os triângulos são construídos acima virados para
    // cima, que é como se pensa neles; aqui viram-se todos do avesso, de
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
    let relevo = null;
    let superficie = null;
    let raioDaSuperficie = 0;

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
        // Quando o motor refaz o céu, leva a nossa malha com ele — fica um
        // objecto vazio, sem os pontos lá dentro. Vale a pena reparar
        // nisso antes de a tentar usar outra vez.
        const desfeita = superficie && !superficie.vertexBuffer;
        if (!superficie || desfeita || raio !== raioDaSuperficie) {
            superficie = criarSuperficie(
                app.graphicsDevice,
                relevo,
                raio,
                definicoes.tamanhoDaCupula * ALTURA_DA_VISTA
            );
            raioDaSuperficie = raio;
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

    // O relevo demora um instante a ser medido; quando chega, a superfície
    // é refeita com ele e o céu passa a acompanhar o terreno.
    medirRelevo(app).then((medido) => {
        if (!medido) return;
        relevo = medido;
        superficie = null;
        aplicar();
    });

    return {
        definicoes,
        afinar,
        aplicar,
        /** Até que distância, em metros, chega o chão da fotografia. */
        get raioDoChao() {
            return definicoes.tamanhoDaCupula * RAIO_DO_CHAO;
        },

        /** Se o chão da fotografia já está a seguir o relevo do bairro. */
        get segueORelevo() {
            return !!relevo;
        },
        /** Volta a pôr tudo como veio de fábrica. */
        reiniciar() {
            Object.assign(definicoes, PADRAO);
            if (!cubo) carregar().then(aplicar);
            else aplicar();
        }
    };
}
