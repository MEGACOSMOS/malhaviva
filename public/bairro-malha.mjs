/**
 * O bairro em malha poligonal — o que se vê no telemóvel e nos aparelhos
 * fracos, em vez do bairro de manchas.
 *
 * As manchas (o "gaussian splat") pintam cada ponto do ecrã muitas vezes,
 * com transparências por cima de transparências, e é isso que pesa a um
 * telemóvel. A malha é o mesmo voo do drone, processado da mesma vez, mas
 * guardado como superfícies com fotografia por cima: cada ponto do ecrã é
 * pintado uma vez só.
 *
 * Está no mesmo sítio do bairro de manchas, ao centímetro, e acaba onde
 * ele acaba (o contorno foi tirado das próprias manchas do site). Vem em
 * peças, uma por cada imagem de textura, arrumadas por zonas do bairro:
 * o que fica fora da vista não se desenha. Como fica pendurada da mesma
 * entidade que as manchas ("gsplat-scene"), tudo o que esconde ou mostra o
 * bairro — ao abrir um vídeo 360º, por exemplo — esconde e mostra a malha.
 *
 * As árvores não vêm na malha: uma copa não tem pele, e numa malha vira uma
 * bolha. Foram-lhe tiradas as copas, e as árvores vêm em manchas — tiradas
 * do splat do site, só elas, num nível de pormenor leve — desenhadas por
 * cima da malha.
 *
 * No nível Médio o bairro é misto: as manchas ficam nos dois primeiros
 * anéis de detalhe, à volta de quem olha (o fino e o do meio), e a malha faz
 * o terceiro, o de longe (ver `aneisDeManchas` em lod-foco.mjs). A malha
 * esconde-se onde as manchas já estão desenhadas, e só aí — ver
 * `vigiarAsManchas`.
 *
 * Como foi feita: scripts/malha/LEIA-ME.md.
 */
import {
    Asset, CULLFACE_NONE, Entity, Layer, WasmModule, Texture, Vec3,
    PIXELFORMAT_RGBA8, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE,
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from 'playcanvas';

const PASTA = 'malha/';

// Bairro misto: o lado de cada quadrado da grelha que diz quanto das
// manchas está à vista em cada sítio, em metros.
const CELULA = 1;

// Quanto cada pedaço de manchas alarga para lá da caixa dele na grelha, em
// metros: entre dois pedaços vizinhos há às vezes uma frincha, e por ela via-se
// a malha. Pouco: para lá da caixa já não há manchas dele, e onde a malha sai
// sem manchas por cima fica preto.
const ALARGAMENTO = 0.25;

// Quanto demora uma zona a passar de manchas a malha, ou de malha a
// manchas: as manchas desvanecem-se por cima da malha, ou aparecem aos
// poucos por cima dela. Em milissegundos.
const TEMPO_DE_DESVANECER = 600;

// Um nível chegado a uma zona só aparece no ecrã quando o motor refaz a
// lista do que desenha e a ordena, umas imagens depois: começado logo, o
// aparecer gastava-se com ele ainda invisível. Por isso só começa quando a
// zona, nesse nível, já está na lista que o motor desenha (ver
// `oQueSeDesenha`); se o motor não o disser, ao fim deste tempo, em
// milissegundos.
const ESPERA_MAXIMA_AO_ENTRAR = 1500;

/**
 * A camada da malha, logo a seguir à cúpula do céu.
 *
 * A cúpula é desenhada à distância a que está e tem o fundo chato, à
 * altura do chão da cena — e o chão do bairro fica quase todo abaixo
 * dele. Desenhada antes da cúpula, como tudo o que está na camada de
 * sempre, a malha ficava tapada pelo fundo da taça. As manchas e os
 * prédios à volta (edificios.mjs) são desenhados depois dela pela mesma
 * razão; a malha também.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {Layer} A camada.
 */
function criarCamada(app) {
    const camadas = app.scene.layers;
    let camada = camadas.getLayerByName('BairroMalha');
    if (camada) return camada;
    camada = new Layer({ name: 'BairroMalha' });
    const ceu = camadas.getLayerByName('Skybox');
    const depoisDoCeu = ceu ? camadas.getOpaqueIndex(ceu) + 1 : camadas.layerList.length;
    camadas.insertOpaque(camada, depoisDoCeu);
    // Todas as câmaras que desenham o mundo passam a desenhar também esta
    // camada (a do mapa e a dos óculos de VR, que é a mesma). Confere-se
    // antes de cada imagem, e não só agora: a câmara do mapa ainda está a
    // nascer quando a malha começa a chegar, e há quem lhe reescreva as
    // camadas depois.
    const mundo = camadas.getLayerByName('World');
    app.on('prerender', () => {
        const camaras = app.systems.camera && app.systems.camera.cameras;
        if (!camaras) return;
        for (let i = 0; i < camaras.length; i++) {
            const camara = camaras[i];
            const lista = camara.layers;
            if (mundo && lista.indexOf(mundo.id) === -1) continue;
            if (lista.indexOf(camada.id) === -1) camara.layers = lista.concat([camada.id]);
        }
    });
    return camada;
}

/**
 * O mapa de manchas do bairro tal como o motor o está a usar para a câmara
 * do mapa, ou `null` se ainda não há.
 *
 * Lê contas que o motor guarda lá por dentro, como o lod-foco.mjs e o
 * carga-do-bairro.mjs. Se um dia o motor as guardar de outra maneira, não
 * se acha mapa nenhum — e a malha fica inteira por baixo das manchas, que é
 * o bairro de antes, sem buracos.
 *
 * @param {object} app - A aplicação 3D.
 * @param {object} camara - A entidade da câmara do mapa.
 * @returns {{instancia: object, mundo: object}|null} A instância do mapa e
 *     o gestor que a desenha.
 */
function mapaDasManchas(app, camara) {
    const director = app.renderer && app.renderer.gsplatDirector;
    const camera = camara && camara.camera && camara.camera.camera;
    if (!director || !director.camerasMap || !camera) return null;
    const dados = director.camerasMap.get(camera);
    if (!dados || !dados.layersMap) return null;
    for (const dadosCamada of dados.layersMap.values()) {
        const mundo = dadosCamada.gsplatManager && dadosCamada.gsplatManager.world;
        if (!mundo || !mundo._octreeInstances) continue;
        for (const instancia of mundo._octreeInstances.values()) {
            if (instancia.octree && instancia.octree.nodeBoundsMinMax && instancia.nodeInfos) return { instancia, mundo };
        }
    }
    return null;
}

/**
 * As zonas, e o nível de cada uma, que estão na lista que o motor desenha
 * agora — a versão do bairro já ordenada, que é a que está no ecrã. Cada
 * uma vem como zona × 4 + nível. `null` se o motor não o disser.
 *
 * @param {object} mundo - O gestor que desenha as manchas.
 * @param {Set<number>} conjunto - Onde as pôr (é esvaziado antes).
 * @returns {Set<number>|null}
 */
function oQueSeDesenha(mundo, conjunto) {
    if (!mundo || typeof mundo.getState !== 'function') return null;
    const estado = mundo.getState(mundo.currentVersion);
    if (!estado || !estado.splats) return null;
    conjunto.clear();
    for (const pedaco of estado.splats) {
        if (!pedaco.nodeInfos || !pedaco.intervalNodeIndices) continue;
        const nivel = pedaco.lodIndex > 0 ? pedaco.lodIndex : 0;
        for (const zona of pedaco.intervalNodeIndices) conjunto.add(zona * 4 + nivel);
    }
    return conjunto;
}

/**
 * Bairro misto: deixa uma zona que troca de nível de manchas (do fino para
 * o do meio, ou ao contrário) com os dois níveis desenhados ao mesmo tempo
 * durante a troca, para um se desvanecer enquanto o outro aparece.
 *
 * O motor larga o nível antigo de uma zona no instante em que o novo está
 * pronto. Aqui, quando ele o vai largar e a zona continua com outro nível
 * desenhado, o antigo fica guardado em `nodeInfo.aDesvanecer` (ficheiro →
 * nível), e quem o larga a sério é o `vigiarAsManchas`, quando ele acabar
 * de se desvanecer. Se a zona voltar a esse nível antes disso, ele deixa
 * de estar a desvanecer-se.
 *
 * Lê e muda contas que o motor guarda lá por dentro, como o lod-foco.mjs.
 *
 * @param {object} instancia - O mapa (a instância da octree do motor).
 * @returns {function(number, number): void|null} Larga de vez o nível
 *     guardado de um ficheiro numa zona; `null` se o motor não deixar.
 */
function guardarNivelAntigo(instancia) {
    const modelo = Object.getPrototypeOf(instancia);
    if (!modelo || typeof modelo.decrementFileRef !== 'function' || typeof modelo.incrementFileRef !== 'function') return null;
    if (!modelo.largarDeVez) {
        const largarDeOrigem = modelo.decrementFileRef;
        const juntarDeOrigem = modelo.incrementFileRef;
        modelo.decrementFileRef = function (fileIndex, nodeIndex) {
            const info = this.nodeInfos && this.nodeInfos[nodeIndex];
            const p = fileIndex >= 0 && this.filePlacements ? this.filePlacements[fileIndex] : null;
            if (this.trocasSuaves && info && p && p.resource && p.intervals.has(nodeIndex)) {
                // Fica, se a zona tiver outro nível já desenhado.
                let outro = false;
                for (let f = 0; f < this.filePlacements.length && !outro; f++) {
                    const q = this.filePlacements[f];
                    if (f !== fileIndex && q && q.resource && q.intervals.has(nodeIndex)) outro = true;
                }
                if (outro) {
                    const lods = this.octree.nodes[nodeIndex].lods;
                    let nivel = 0;
                    for (let l = 0; l < lods.length; l++) if (lods[l].fileIndex === fileIndex) nivel = l;
                    (info.aDesvanecer || (info.aDesvanecer = new Map())).set(fileIndex, nivel);
                    return;
                }
            }
            return largarDeOrigem.call(this, fileIndex, nodeIndex);
        };
        modelo.incrementFileRef = function (fileIndex, nodeIndex, lodIndex) {
            const info = this.nodeInfos && this.nodeInfos[nodeIndex];
            if (info && info.aDesvanecer) info.aDesvanecer.delete(fileIndex);
            if (this.aLargar && this.aLargar.length) {
                this.aLargar = this.aLargar.filter(([f, n]) => f !== fileIndex || n !== nodeIndex);
            }
            return juntarDeOrigem.call(this, fileIndex, nodeIndex, lodIndex);
        };
        // Largar um nível muda a lista do que o motor desenha. Feito fora
        // da vez dele, o motor ficava umas dez imagens a desenhar com a
        // lista desacertada, e a zona inteira ficava preta. Por isso só se
        // larga quando ele próprio se atualiza: aí a lista nova é feita logo.
        const atualizarDeOrigem = modelo.update;
        if (typeof atualizarDeOrigem === 'function') {
            modelo.update = function (...argumentos) {
                if (this.aLargar && this.aLargar.length) {
                    const lista = this.aLargar;
                    this.aLargar = [];
                    for (const [f, n] of lista) largarDeOrigem.call(this, f, n);
                }
                return atualizarDeOrigem.apply(this, argumentos);
            };
        }
        modelo.largarDeVez = largarDeOrigem;
    }
    if (!instancia.aLargar) instancia.aLargar = [];
    // Um motor sem a sua própria atualização (outra versão): larga-se logo.
    if (typeof modelo.update !== 'function') {
        return (fileIndex, nodeIndex) => modelo.largarDeVez.call(instancia, fileIndex, nodeIndex);
    }
    return (fileIndex, nodeIndex) => { instancia.aLargar.push([fileIndex, nodeIndex]); };
}

// Os lugares próprios dos níveis a desvanecer-se (ver `separarLugares`):
// números bem acima dos que o motor dá, para nunca se encontrarem.
let proximoLugar = 2 ** 30;

/**
 * Bairro misto: dá ao nível que se está a desvanecer numa zona um lugar seu
 * na memória gráfica do motor.
 *
 * O motor arruma as manchas por zona: cada zona tem um número, e é por ele
 * que encontra o lugar onde estão as manchas dela. Só conta com um nível de
 * cada vez; com os dois desenhados (ver `guardarNivelAntigo`), disputavam o
 * mesmo lugar, e ao largar o antigo o novo ficava sem sítio umas imagens —
 * a zona ficava preta. Aqui, ao montar a lista do que desenha, o nível que
 * não é o atual da zona recebe um número seu.
 *
 * @param {object} mundo - O gestor que desenha as manchas.
 * @returns {boolean} Verdadeiro se ficou ligado.
 */
function separarLugares(mundo) {
    const estados = mundo && mundo._worldStates;
    if (!estados) return false;
    let exemplo = null;
    for (const estado of estados.values()) {
        if (estado && estado.splats && estado.splats.length) { exemplo = estado.splats[0]; break; }
    }
    const modelo = exemplo && Object.getPrototypeOf(exemplo);
    if (!modelo || typeof modelo.updateIntervals !== 'function') return false;
    if (modelo.lugaresSeparados) return true;
    const montarDeOrigem = modelo.updateIntervals;
    modelo.updateIntervals = function (intervals) {
        const resultado = montarDeOrigem.call(this, intervals);
        const zonas = this.intervalNodeIndices;
        if (this.nodeInfos && zonas && zonas.length) {
            for (let j = 0; j < zonas.length; j++) {
                const info = this.nodeInfos[zonas[j]];
                if (info && info.aDesvanecer && info.aDesvanecer.size && info.currentLod !== this.lodIndex) {
                    if (!info.lugarDoAntigo) info.lugarDoAntigo = proximoLugar++;
                    this.intervalAllocIds[j] = info.lugarDoAntigo;
                }
            }
        }
        return resultado;
    };
    modelo.lugaresSeparados = true;
    return true;
}

/**
 * Bairro misto: na cópia das manchas para a memória do motor, cada mancha
 * do bairro passa a levar, no azul, o nível de onde vem (ver
 * `marcarAsManchas`). O motor sabe o nível de cada ficheiro que copia; aqui
 * diz-se-o ao programa da cópia.
 *
 * @param {object} mundo - O gestor que desenha as manchas.
 * @returns {boolean} Verdadeiro se ficou ligado.
 */
function dizerONivelNaCopia(mundo) {
    const buffer = mundo && mundo._workBuffer;
    const passo = buffer && (buffer.renderPass || buffer.colorRenderPass);
    const modelo = passo && Object.getPrototypeOf(passo);
    if (!modelo || typeof modelo.renderSplat !== 'function') return false;
    if (modelo.nivelNaCopia) return true;
    const copiarDeOrigem = modelo.renderSplat;
    modelo.renderSplat = function (splatInfo, ...resto) {
        if (this.device && splatInfo) {
            this.device.scope.resolve('uNivelDoBairro').setValue(splatInfo.lodIndex > 0 ? splatInfo.lodIndex : 0);
        }
        return copiarDeOrigem.call(this, splatInfo, ...resto);
    };
    modelo.nivelNaCopia = true;
    return true;
}

/**
 * Bairro misto: vigia os pedaços das manchas e mantém uma grelha, vista de
 * cima, que diz em cada quadrado quanto das manchas está à vista, de zero a
 * um, em três partes:
 *
 *  - vermelho: as manchas do nível fino;
 *  - verde: as do nível do meio;
 *  - azul: as manchas todas — a malha só se apaga onde ele está cheio, e as
 *    árvores em manchas da malha aparecem na medida contrária.
 *
 * Cada pedaço tem o seu "à vista", que anda aos poucos (`TEMPO_DE_DESVANECER`):
 *
 *  - de malha para manchas, sobe quando o motor já o desenha;
 *  - de manchas para malha, desce primeiro, e só depois o lod-foco.mjs o
 *    deixa sair (ver `segurarNaPassagem`);
 *  - de um nível de manchas para o outro, os dois ficam desenhados (ver
 *    `guardarNivelAntigo`): o novo aparece enquanto o antigo se desvanece,
 *    com os dois um nada sobrepostos a meio, para não se ver o fundo.
 *
 * Num quadrado onde há um pedaço que não está à vista (um telhado e o chão
 * por baixo, na fronteira de um anel), fica a malha; onde não há pedaço
 * nenhum, também. Assim nunca há buraco preto.
 *
 * @param {object} app - A aplicação 3D.
 * @param {function(object): void} aoMudar - Chamada com a grelha nova
 *     (`{textura, parametros}`) quando ela passa a ser outra.
 * @param {function(object, object): void} aoAcharMapa - Chamada com o mapa
 *     e o gestor quando o mapa aparece (ou passa a ser outro).
 * @returns {{textura: Texture, parametros: Float32Array}} A grelha de agora.
 */
function vigiarAsManchas(app, aoMudar, aoAcharMapa) {
    const camara = app.root.findByName('camera');
    const dispositivo = app.graphicsDevice;

    const criarTextura = (largura, altura, nome) => new Texture(dispositivo, {
        name: nome,
        width: largura,
        height: altura,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        // Entre dois quadrados, o meio-termo: as orlas de cada zona ficam
        // esbatidas num metro, em vez de aos degraus.
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });

    // Antes de haver mapa, um quadrado só, vazio: a malha inteira.
    const vazia = criarTextura(1, 1, 'bairroMistoVazio');
    vazia.lock().set(new Uint8Array([0, 0, 0, 0]));
    vazia.unlock();
    // origem X, origem Z, 1 / largura e 1 / altura da grelha, em metros.
    let atual = { textura: vazia, parametros: new Float32Array([0, 0, 1, 1]) };

    let instancia = null;
    let mundo = null;
    let largar = null;
    let lugaresProntos = false;
    let grelha = null;
    let antes = 0;
    // Por pedaço: o nível que o motor desenha e quanto se vê dele; o nível
    // que se está a desvanecer e quanto se vê dele (e quanto se via ao
    // começar); quanto já andou a troca; desde quando o nível de agora está
    // no motor; e quanto se vê de cada nível e de tudo, para a grelha.
    let nivelVisto, vNovo, nivelAntigo, vAntigo, vAntigoInicio, progresso;
    let desde, v0, v1, vT;
    // O que o motor desenha, refeito só quando a versão no ecrã muda.
    const desenhados = new Set();
    let versaoVista = -1;
    let sabeOQueDesenha = false;

    // A caixa de cada pedaço, vista de cima, em quadrados da grelha, e, para
    // cada quadrado, os pedaços que lhe passam por cima: os da caixa justa
    // contam para o "menos à vista"; os que só lá chegam pela caixa
    // alargada contam só para tapar frinchas.
    function medirGrelha(mapa) {
        const nos = mapa.octree.nodes.length;
        const caixas = mapa.octree.nodeBoundsMinMax;
        const matriz = mapa.placement.node.getWorldTransform();
        const canto = new Vec3();
        const planta = new Float32Array(nos * 4);
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < nos; i++) {
            const b = i * 6;
            let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
            for (let k = 0; k < 8; k++) {
                canto.set(
                    caixas[b + (k & 1 ? 3 : 0)],
                    caixas[b + (k & 2 ? 4 : 1)],
                    caixas[b + (k & 4 ? 5 : 2)]
                );
                matriz.transformPoint(canto, canto);
                if (canto.x < x0) x0 = canto.x;
                if (canto.x > x1) x1 = canto.x;
                if (canto.z < z0) z0 = canto.z;
                if (canto.z > z1) z1 = canto.z;
            }
            planta[i * 4] = x0; planta[i * 4 + 1] = x1;
            planta[i * 4 + 2] = z0; planta[i * 4 + 3] = z1;
            if (x0 < minX) minX = x0;
            if (x1 > maxX) maxX = x1;
            if (z0 < minZ) minZ = z0;
            if (z1 > maxZ) maxZ = z1;
        }
        const folga = 2 * CELULA + ALARGAMENTO;
        const origemX = minX - folga;
        const origemZ = minZ - folga;
        const colunas = Math.ceil((maxX - minX + 2 * folga) / CELULA);
        const linhas = Math.ceil((maxZ - minZ + 2 * folga) / CELULA);
        const quadrado = (v, origem, limite) => Math.max(0, Math.min(limite - 1, Math.floor((v - origem) / CELULA)));
        const alargada = new Int32Array(nos * 4);
        const justa = new Int32Array(nos * 4);
        for (let i = 0; i < nos; i++) {
            const x0 = planta[i * 4], x1 = planta[i * 4 + 1];
            const z0 = planta[i * 4 + 2], z1 = planta[i * 4 + 3];
            alargada[i * 4] = quadrado(x0 - ALARGAMENTO, origemX, colunas);
            alargada[i * 4 + 1] = quadrado(x1 + ALARGAMENTO, origemX, colunas);
            alargada[i * 4 + 2] = quadrado(z0 - ALARGAMENTO, origemZ, linhas);
            alargada[i * 4 + 3] = quadrado(z1 + ALARGAMENTO, origemZ, linhas);
            justa[i * 4] = quadrado(x0, origemX, colunas);
            justa[i * 4 + 1] = quadrado(x1, origemX, colunas);
            justa[i * 4 + 2] = quadrado(z0, origemZ, linhas);
            justa[i * 4 + 3] = quadrado(z1, origemZ, linhas);
        }

        // Os pedaços de cada quadrado, todos seguidos numa lista só: o
        // quadrado q tem os de inicio[q] a inicio[q + 1]. Cada um vem como
        // pedaço * 2, mais um se o quadrado está na caixa justa dele.
        const total = colunas * linhas;
        const inicio = new Uint32Array(total + 1);
        for (let i = 0; i < nos; i++) {
            for (let j = alargada[i * 4 + 2]; j <= alargada[i * 4 + 3]; j++) {
                for (let c = alargada[i * 4]; c <= alargada[i * 4 + 1]; c++) inicio[j * colunas + c + 1]++;
            }
        }
        for (let q = 0; q < total; q++) inicio[q + 1] += inicio[q];
        const pedacos = new Uint32Array(inicio[total]);
        const cheio = inicio.slice(0, total);
        for (let i = 0; i < nos; i++) {
            const ji0 = justa[i * 4 + 2], ji1 = justa[i * 4 + 3];
            const ci0 = justa[i * 4], ci1 = justa[i * 4 + 1];
            for (let j = alargada[i * 4 + 2]; j <= alargada[i * 4 + 3]; j++) {
                for (let c = alargada[i * 4]; c <= alargada[i * 4 + 1]; c++) {
                    const naJusta = j >= ji0 && j <= ji1 && c >= ci0 && c <= ci1 ? 1 : 0;
                    pedacos[cheio[j * colunas + c]++] = i * 2 + naJusta;
                }
            }
        }

        const textura = criarTextura(colunas, linhas, 'bairroMisto');
        return {
            nos, colunas, linhas, alargada, inicio, pedacos, textura,
            dados: new Uint8Array(total * 4),
            parametros: new Float32Array([origemX, origemZ, 1 / (colunas * CELULA), 1 / (linhas * CELULA)])
        };
    }

    // Um quadrado: de cada nível e de tudo, o mais à vista dos pedaços que lá
    // chegam, mas nunca mais do que o menos à vista dos que lá estão de facto
    // (caixa justa).
    function refazerQuadrado(q) {
        const { inicio, pedacos, dados } = grelha;
        let m0 = 0, m1 = 0, mT = 0, menor = 1;
        for (let k = inicio[q]; k < inicio[q + 1]; k++) {
            const e = pedacos[k];
            const i = e >> 1;
            if (v0[i] > m0) m0 = v0[i];
            if (v1[i] > m1) m1 = v1[i];
            if (vT[i] > mT) mT = vT[i];
            if ((e & 1) && vT[i] < menor) menor = vT[i];
        }
        const o = q * 4;
        dados[o] = Math.round(255 * Math.min(m0, menor));
        dados[o + 1] = Math.round(255 * Math.min(m1, menor));
        dados[o + 2] = Math.round(255 * Math.min(mT, menor));
    }

    function refazerQuadrados(i) {
        const { colunas, alargada } = grelha;
        for (let j = alargada[i * 4 + 2]; j <= alargada[i * 4 + 3]; j++) {
            for (let c = alargada[i * 4]; c <= alargada[i * 4 + 1]; c++) refazerQuadrado(j * colunas + c);
        }
    }

    function enviarGrelha() {
        grelha.textura.lock().set(grelha.dados);
        grelha.textura.unlock();
    }

    // Larga de vez os níveis que acabaram de se desvanecer numa zona.
    function largarAntigos(i, info) {
        if (info.aDesvanecer && info.aDesvanecer.size) {
            if (largar) info.aDesvanecer.forEach((nivel, ficheiro) => largar(ficheiro, i));
            info.aDesvanecer.clear();
        }
        nivelAntigo[i] = -1;
        vAntigo[i] = 0;
        vAntigoInicio[i] = 0;
    }

    app.on('prerender', () => {
        const achado = mapaDasManchas(app, camara);
        const mapa = achado ? achado.instancia : null;
        mundo = achado ? achado.mundo : null;
        if (mapa !== instancia) {
            instancia = mapa;
            if (grelha) grelha.textura.destroy();
            grelha = mapa ? medirGrelha(mapa) : null;
            if (grelha) {
                const n = grelha.nos;
                nivelVisto = new Int8Array(n).fill(-1);
                nivelAntigo = new Int8Array(n).fill(-1);
                vNovo = new Float32Array(n);
                vAntigo = new Float32Array(n);
                vAntigoInicio = new Float32Array(n);
                progresso = new Float32Array(n);
                desde = new Float64Array(n);
                versaoVista = -1;
                v0 = new Float32Array(n);
                v1 = new Float32Array(n);
                vT = new Float32Array(n);
                largar = guardarNivelAntigo(mapa);
                dizerONivelNaCopia(mundo);
                enviarGrelha();
                atual = { textura: grelha.textura, parametros: grelha.parametros };
                if (aoAcharMapa) aoAcharMapa(mapa, mundo);
            } else {
                atual = { textura: vazia, parametros: new Float32Array([0, 0, 1, 1]) };
            }
            aoMudar(atual);
        }

        const agora = performance.now();
        // Com o separador escondido o tempo passa sem imagens: não se
        // salta o desvanecer de uma vez ao voltar.
        const passo = Math.min(agora - antes, 100) / TEMPO_DE_DESVANECER;
        antes = agora;
        if (!grelha) return;

        // Os dois níveis de uma zona só ficam desenhados juntos quando cada
        // um pode ter o seu lugar (ver `separarLugares`); até lá, e num
        // motor que não o deixe, a troca entre níveis de manchas é seca.
        if (!lugaresProntos) lugaresProntos = separarLugares(mundo);
        instancia.trocasSuaves = lugaresProntos && !!largar;

        if (mundo && mundo.currentVersion !== versaoVista) {
            versaoVista = mundo.currentVersion;
            sabeOQueDesenha = oQueSeDesenha(mundo, desenhados) !== null;
        }
        const infos = instancia.nodeInfos;
        let mudou = false;
        let reavaliar = false;
        for (let i = 0; i < grelha.nos; i++) {
            const info = infos[i];
            if (!info) continue;
            const nivel = info.currentLod;
            const comAntigo = !!(info.aDesvanecer && info.aDesvanecer.size);

            if (nivel < 0) {
                // Já não está no motor: a malha fica sozinha.
                vNovo[i] = 0;
                nivelVisto[i] = -1;
                desde[i] = 0;
                if (comAntigo || nivelAntigo[i] >= 0) largarAntigos(i, info);
            } else {
                if (nivel !== nivelVisto[i]) {
                    if (comAntigo && nivelVisto[i] >= 0) {
                        // Troca de nível de manchas: o que se via passa a
                        // ser o antigo, a desvanecer-se, e o novo começa do
                        // zero.
                        nivelAntigo[i] = nivelVisto[i];
                        vAntigo[i] = Math.max(vAntigo[i], vNovo[i]);
                        vAntigoInicio[i] = vAntigo[i];
                        vNovo[i] = 0;
                        progresso[i] = 0;
                    }
                    nivelVisto[i] = nivel;
                    desde[i] = agora;
                }
                // Já no ecrã: a zona, neste nível, está na lista que o motor
                // desenha agora.
                const espera = agora - desde[i];
                const jaSeVe = sabeOQueDesenha
                    ? desenhados.has(i * 4 + nivel) || espera >= ESPERA_MAXIMA_AO_ENTRAR
                    : espera >= ESPERA_MAXIMA_AO_ENTRAR / 4;

                if (comAntigo && nivelAntigo[i] >= 0) {
                    if (info.aSair) {
                        // A meio de uma troca, a zona vai para a malha: os
                        // dois desvanecem-se.
                        vNovo[i] = Math.max(0, vNovo[i] - passo);
                        vAntigo[i] = Math.max(0, vAntigo[i] - passo);
                        if (vAntigo[i] <= 0) largarAntigos(i, info);
                    } else if (jaSeVe) {
                        // O novo aparece nos primeiros 60 % da troca, o
                        // antigo some-se nos últimos 60 %: a meio estão os
                        // dois quase inteiros, e o fundo não se vê.
                        progresso[i] = Math.min(1, progresso[i] + passo);
                        const p = progresso[i];
                        vNovo[i] = Math.max(vNovo[i], Math.min(1, p / 0.6));
                        vAntigo[i] = vAntigoInicio[i] * Math.min(1, (1 - p) / 0.6);
                        if (p >= 1) largarAntigos(i, info);
                    }
                } else {
                    if (comAntigo) largarAntigos(i, info);
                    const alvo = !info.aSair && (jaSeVe || vNovo[i] > 0) ? 1 : 0;
                    if (vNovo[i] < alvo) vNovo[i] = Math.min(alvo, vNovo[i] + passo);
                    else if (vNovo[i] > alvo) vNovo[i] = Math.max(alvo, vNovo[i] - passo);
                }
            }

            const vista = Math.max(vNovo[i], vAntigo[i]);
            info.vista = vista;
            if (info.aSair && vista <= 0.01) reavaliar = true;

            let a0 = 0, a1 = 0;
            if (nivelVisto[i] === 0) a0 = vNovo[i]; else if (nivelVisto[i] >= 1) a1 = vNovo[i];
            if (nivelAntigo[i] === 0) a0 = Math.max(a0, vAntigo[i]); else if (nivelAntigo[i] >= 1) a1 = Math.max(a1, vAntigo[i]);
            const aT = Math.min(1, a0 + a1);
            if (a0 !== v0[i] || a1 !== v1[i] || aT !== vT[i]) {
                v0[i] = a0;
                v1[i] = a1;
                vT[i] = aT;
                refazerQuadrados(i);
                mudou = true;
            }
        }
        if (mudou) enviarGrelha();
        // Um pedaço que acabou de se desvanecer já pode trocar de nível: o
        // motor reavalia sem esperar que a câmara se mexa.
        if (reavaliar && 'needsLodUpdate' in instancia) instancia.needsLodUpdate = true;
    });

    return atual;
}

/**
 * Ensina a um material da malha a não se pintar onde a grelha diz que as
 * manchas estão inteiramente à vista (o azul cheio). Onde estão só em
 * parte (a aparecer, a desvanecer, ou na orla esbatida de uma zona), a
 * malha fica por baixo.
 *
 * @param {object} material - Um material da malha.
 */
function ensinarAGrelha(material) {
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('litUserDeclarationPS', `
uniform sampler2D uBairroMisto;
uniform vec4 uBairroMistoGrelha;
`);
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('litUserMainStartPS', `
    if (texture(uBairroMisto, (vPositionW.xz - uBairroMistoGrelha.xy) * uBairroMistoGrelha.zw).b > 0.99) {
        discard;
    }
`);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('litUserDeclarationPS', `
var uBairroMisto: texture_2d<f32>;
var uBairroMistoSampler: sampler;
uniform uBairroMistoGrelha: vec4f;
`);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('litUserMainStartPS', `
    if (textureSampleLevel(uBairroMisto, uBairroMistoSampler, (vPositionW.xz - uniform.uBairroMistoGrelha.xy) * uniform.uBairroMistoGrelha.zw, 0.0).b > 0.99) {
        discard;
    }
`);
    material.shaderChunksVersion = '2.21';
}

/**
 * Uma marca no azul de cada mancha, posta quando as manchas são copiadas
 * para a memória do motor: o azul passa a ser marca + 0,02 + 0,96 × azul, e
 * a marca diz de onde a mancha vem — 0 o nível fino do bairro, 1 o nível
 * do meio, 2 as árvores da malha. As manchas são todas desenhadas juntas,
 * com o mesmo programa (ver `ensinarAGrelhaAsManchas`), e é por esta marca
 * que ele as distingue. O motor guarda cada cor entre zero e quatro, por
 * isso a marca cabe, com folga de sobra para os arredondamentos.
 *
 * @param {object} componente - Um componente de manchas.
 * @param {string|null} marca - A marca, como número (`'2.0'`), ou `null`
 *     para usar o nível de cada ficheiro (`uNivelDoBairro`, ver
 *     `dizerONivelNaCopia`).
 */
function marcarAsManchas(componente, marca) {
    const glsl = `
${marca === null ? 'uniform float uNivelDoBairro;' : ''}
void modifySplatCenter(inout vec3 center) {}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
void modifySplatColor(vec3 center, inout vec4 color) {
    color.b = ${marca === null ? 'min(uNivelDoBairro, 1.0)' : marca} + 0.02 + clamp(color.b, 0.0, 1.0) * 0.96;
}`;
    const wgsl = `
${marca === null ? 'uniform uNivelDoBairro: f32;' : ''}
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    (*color).b = ${marca === null ? 'min(uniform.uNivelDoBairro, 1.0)' : marca} + 0.02 + clamp((*color).b, 0.0, 1.0) * 0.96;
}`;
    componente.setWorkBufferModifier({ glsl, wgsl });
}

/**
 * Ensina às manchas, no momento de as desenhar (a cada imagem, e por isso
 * o desvanecer anda sem refazer nada), a lerem a grelha: cada nível do
 * bairro aparece na medida da sua parte dela, e as árvores da malha na
 * medida contrária à das manchas todas. A marca no azul (ver
 * `marcarAsManchas`) é tirada aqui, e a cor volta a ser a de origem.
 *
 * @param {object} material - O material de todas as manchas da cena.
 */
function ensinarAGrelhaAsManchas(material) {
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('gsplatModifyVS', `
uniform sampler2D uBairroMisto;
uniform vec4 uBairroMistoGrelha;
void modifySplatCenter(inout vec3 center) {}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
void modifySplatColor(vec3 center, inout vec4 color) {
    vec4 f = textureLod(uBairroMisto, (center.xz - uBairroMistoGrelha.xy) * uBairroMistoGrelha.zw, 0.0);
    float marca = floor(color.b);
    color.b = clamp((color.b - marca - 0.02) / 0.96, 0.0, 1.0);
    if (marca > 1.5) {
        color.a *= 1.0 - f.b;
    } else if (marca > 0.5) {
        color.a *= f.g;
    } else {
        color.a *= f.r;
    }
}`);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('gsplatModifyVS', `
var uBairroMisto: texture_2d<f32>;
var uBairroMistoSampler: sampler;
uniform uBairroMistoGrelha: vec4f;
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    let f = textureSampleLevel(uBairroMisto, uBairroMistoSampler, (center.xz - uniform.uBairroMistoGrelha.xy) * uniform.uBairroMistoGrelha.zw, 0.0);
    let marca = floor((*color).b);
    (*color).b = clamp(((*color).b - marca - 0.02) / 0.96, 0.0, 1.0);
    if (marca > 1.5) {
        (*color).a = (*color).a * (1.0 - f.b);
    } else if (marca > 0.5) {
        (*color).a = (*color).a * f.g;
    } else {
        (*color).a = (*color).a * f.r;
    }
}`);
    material.update();
}

/**
 * Começa a trazer a malha e pendura-a no lugar do bairro.
 *
 * @param {object} app - A aplicação 3D.
 * @param {object} [opcoes]
 * @param {number} [opcoes.anisotropia] - Nitidez do chão visto de lado.
 * @param {boolean} [opcoes.misto] - Bairro misto (nível Médio): a malha só
 *     se pinta onde as manchas não estão.
 * @returns {{pronto: Promise<void>, medir: function(): (number|null), primeira: Promise<void>}}
 *     `pronto` cumpre-se com todas as peças no ecrã; `primeira` com a
 *     primeira; `medir` dá a fracção dos bytes que já chegaram, ou `null`
 *     enquanto o índice não chegou.
 */
export function ligarBairroEmMalha(app, opcoes = {}) {
    // A geometria vem comprimida (Draco): o descodificador mora em /motor.
    WasmModule.setConfig('DracoDecoderModule', {
        glueUrl: '/motor/draco-2.21.4/draco.wasm.js',
        wasmUrl: '/motor/draco-2.21.4/draco.wasm.wasm',
        fallbackUrl: '/motor/draco-2.21.4/draco.js'
    });
    // As texturas vêm em KTX2 (Basis): o transcodificador passa-as, já no
    // aparelho, ao formato comprimido que a placa gráfica dele entende
    // (ETC no Android, ASTC no iPhone, DXT nos computadores), e é assim
    // comprimidas que ficam na memória gráfica.
    WasmModule.setConfig('BASIS', {
        glueUrl: '/motor/basis-2.21.4/basis.wasm.js',
        wasmUrl: '/motor/basis-2.21.4/basis.wasm.wasm',
        fallbackUrl: '/motor/basis-2.21.4/basis.js',
        numWorkers: 2
    });

    const bairro = app.root.findByName('gsplat-scene');
    const raiz = new Entity('bairro-malha');
    // A malha vem já em coordenadas da cena; a entidade do bairro está
    // virada ao contrário (as manchas vêm de cabeça para baixo), e esta
    // volta desfaz essa volta.
    raiz.setLocalEulerAngles(180, 0, 0);
    (bairro || app.root).addChild(raiz);
    const camada = criarCamada(app);

    // Bairro misto: a grelha de quanto das manchas está à vista, entregue a
    // cada material da malha e ao material de todas as manchas da cena, e
    // de novo quando passa a ser outra (o conteúdo dela muda a cada imagem
    // sem ser preciso entregá-la outra vez).
    const misto = !!opcoes.misto;
    const materiaisMistos = new Set();
    const materialDasManchas = misto && app.scene.gsplat && app.scene.gsplat.material;
    let grelhaDasManchas = null;
    const darAGrelha = (alvo) => {
        alvo.setParameter('uBairroMisto', grelhaDasManchas.textura);
        alvo.setParameter('uBairroMistoGrelha', grelhaDasManchas.parametros);
    };
    if (misto) {
        grelhaDasManchas = vigiarAsManchas(app, (grelha) => {
            grelhaDasManchas = grelha;
            materiaisMistos.forEach(darAGrelha);
            if (materialDasManchas) {
                darAGrelha(materialDasManchas);
                materialDasManchas.update();
            }
        }, () => {
            // As manchas do bairro levam a marca do nível de onde vêm: só
            // agora, que a cópia já sabe dizer-lho (ver `dizerONivelNaCopia`).
            if (bairro && bairro.gsplat) marcarAsManchas(bairro.gsplat, null);
        });
        if (materialDasManchas) {
            darAGrelha(materialDasManchas);
            ensinarAGrelhaAsManchas(materialDasManchas);
        }
    }

    // Bytes de cada peça: os que já chegaram e os que vão chegar.
    const chegou = new Map();
    let total = 0;
    let indiceLido = false;

    let avisarPrimeira;
    const primeira = new Promise((r) => { avisarPrimeira = r; });

    // Numa rede de telemóvel um pedido perde-se de vez em quando: tenta-se
    // outra vez, com uma pausa cada vez maior, antes de desistir dele.
    const TENTATIVAS = 4;
    const pausa = (tentativa) => new Promise((r) => setTimeout(r, 800 * Math.pow(2, tentativa)));

    function lerIndice(tentativa = 0) {
        return fetch(PASTA + 'malha.json')
            .then((r) => {
                if (!r.ok) throw new Error('malha.json ' + r.status);
                return r.json();
            })
            .catch((erro) => {
                if (tentativa + 1 >= TENTATIVAS) throw erro;
                return pausa(tentativa).then(() => lerIndice(tentativa + 1));
            });
    }

    const pronto = lerIndice().then((indice) => {
        const todas = indice.arvores ? indice.pecas.concat([indice.arvores]) : indice.pecas;
        total = todas.reduce((s, p) => s + p.bytes, 0);
        todas.forEach((p) => chegou.set(p.ficheiro, 0));
        indiceLido = true;
        const pedidos = indice.pecas.map((p) => trazer(p));
        if (indice.arvores) pedidos.push(trazerArvores(indice.arvores));
        return Promise.all(pedidos);
    });

    // As árvores, em manchas, por cima da malha sem copas. As manchas estão
    // nas coordenadas do splat do bairro, por isso ficam penduradas da
    // entidade dele tal como ela está (virada).
    function trazerArvores(peca, tentativa = 0) {
        return new Promise((resolve) => {
            const asset = new Asset('bairro-malha-arvores', 'gsplat', { url: PASTA + peca.ficheiro });
            asset.once('load', () => {
                chegou.set(peca.ficheiro, peca.bytes);
                const arvores = new Entity('bairro-malha-arvores');
                arvores.addComponent('gsplat', { asset });
                if (misto) marcarAsManchas(arvores.gsplat, '2.0');
                (bairro || app.root).addChild(arvores);
                resolve();
            });
            asset.once('error', (erro) => {
                app.assets.remove(asset);
                if (tentativa + 1 < TENTATIVAS) {
                    pausa(tentativa).then(() => trazerArvores(peca, tentativa + 1)).then(resolve);
                    return;
                }
                console.warn('As árvores do bairro em malha não chegaram:', erro);
                chegou.set(peca.ficheiro, peca.bytes);
                resolve();
            });
            app.assets.add(asset);
            app.assets.load(asset);
        });
    }

    function trazer(peca, tentativa = 0) {
        return new Promise((resolve) => {
            const asset = new Asset('bairro-malha-' + peca.ficheiro, 'container', { url: PASTA + peca.ficheiro });
            asset.on('progress', (veio) => chegou.set(peca.ficheiro, Math.min(veio, peca.bytes)));
            asset.once('load', () => {
                chegou.set(peca.ficheiro, peca.bytes);
                const entidade = asset.resource.instantiateRenderEntity({ castShadows: false, receiveShadows: false });
                entidade.findComponents('render').forEach((render) => { render.layers = [camada.id]; });
                afinarMateriais(entidade);
                raiz.addChild(entidade);
                avisarPrimeira();
                resolve();
            });
            asset.once('error', (erro) => {
                app.assets.remove(asset);
                chegou.set(peca.ficheiro, 0);
                if (tentativa + 1 < TENTATIVAS) {
                    pausa(tentativa).then(() => trazer(peca, tentativa + 1)).then(resolve);
                    return;
                }
                console.warn('Peça do bairro em malha que não chegou:', peca.ficheiro, erro);
                chegou.set(peca.ficheiro, peca.bytes);
                resolve();
            });
            app.assets.add(asset);
            app.assets.load(asset);
        });
    }

    function afinarMateriais(entidade) {
        const anisotropia = Math.min(opcoes.anisotropia || 1, app.graphicsDevice.maxAnisotropy || 1);
        entidade.findComponents('render').forEach((render) => {
            render.meshInstances.forEach((mi) => {
                const m = mi.material;
                // A fotografia já traz a luz do dia em que o drone voou:
                // nada de sombras nem brilhos por cima.
                m.useLighting = false;
                m.useSkybox = false;
                m.useFog = false;
                // As duas faces: onde a malha dobra (à volta das copas
                // baixadas, nas orlas) vê-se às vezes o verso, e sem isto
                // o verso não se pinta — ficava uma frincha preta.
                m.cull = CULLFACE_NONE;
                const textura = m.emissiveMap || m.diffuseMap;
                if (textura && anisotropia > 1) textura.anisotropy = anisotropia;
                if (misto && !materiaisMistos.has(m)) {
                    ensinarAGrelha(m);
                    darAGrelha(m);
                    materiaisMistos.add(m);
                }
                m.update();
            });
        });
    }

    function medir() {
        if (!indiceLido) return null;
        if (total <= 0) return 1;
        let veio = 0;
        chegou.forEach((v) => { veio += v; });
        return Math.min(1, veio / total);
    }

    // Os bytes em si, para o bairro misto juntar a conta da malha à das
    // manchas (ver medirACargaDoBairro).
    function medirBytes() {
        if (!indiceLido) return null;
        let veio = 0;
        chegou.forEach((v) => { veio += v; });
        return { veio: Math.min(veio, total), total };
    }

    return { pronto, primeira, medir, medirBytes, raiz };
}
