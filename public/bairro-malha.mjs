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
    PIXELFORMAT_RGBA8, PIXELFORMAT_RG8, PIXELFORMAT_R32U, PIXELFORMAT_RG32U,
    FILTER_LINEAR, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE,
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL,
    Mesh, MeshInstance, IndexBuffer, BoundingBox, Picker,
    PRIMITIVE_TRIANGLES, BUFFER_STATIC, INDEXFORMAT_UINT32
} from 'playcanvas';

const PASTA = 'malha/';

// Bairro misto: o lado de cada quadrado da grelha que diz quanto das
// manchas está à vista em cada sítio, em metros. Com 1 metro, refazer a grelha
// a cada imagem pesava no processador; com 2 são quatro vezes menos quadrados,
// e as orlas das transições ficam esbatidas em dois metros em vez de um.
const CELULA = 2;

// Quanto cada pedaço de manchas alarga para lá da caixa dele na grelha, em
// metros: entre dois pedaços vizinhos há às vezes uma frincha, e por ela via-se
// a malha. Pouco: para lá da caixa já não há manchas dele, e onde a malha sai
// sem manchas por cima fica preto.
const ALARGAMENTO = 0.25;

// Quanto demora uma zona a passar de manchas a malha, ou de malha a
// manchas: as manchas desvanecem-se por cima da malha, ou aparecem aos
// poucos por cima dela. Em milissegundos.
const TEMPO_DE_DESVANECER = 500;

// Na faixa de passagem, cada mancha mede-se com a câmara de agora e com a de
// há pouco, até `TEMPO_DE_DESVANECER` atrás, guardada tantas vezes quantas
// aqui se diz (ver `acompanharOOlhar`).
const PASSOS_DO_RASTO = 8;

// Um nível chegado a uma zona só aparece no ecrã quando o motor refaz a
// lista do que desenha e a ordena, umas imagens depois: começado logo, o
// aparecer gastava-se com ele ainda invisível. Por isso só começa quando a
// zona, nesse nível, já está na lista que o motor desenha (ver
// `oQueSeDesenha`); se o motor não o disser, ao fim deste tempo, em
// milissegundos.
const ESPERA_MAXIMA_AO_ENTRAR = 1500;

// Bairro misto: a malha é cortada em zonas deste lado, em metros, e cada uma
// só se desenha quando há nela algum sítio onde as manchas não a tapam (ver
// `criarZonasDaMalha`). Mais pequenas apagavam-se mais vezes, mas eram mais
// coisas para a placa desenhar uma a uma.
const LADO_DA_ZONA = 40;

// O que uma zona alarga para lá dos seus triângulos, em metros, ao ver se está
// tapada: a grelha é lida esbatida entre quadrados vizinhos.
const FOLGA_DA_ZONA = 1.5 * CELULA;

// O azul da grelha (de 0 a 255) a partir do qual a malha não se pinta em ponto
// nenhum: o programa dela apaga-a acima de 0,99 (ver `ensinarAGrelha`).
const AZUL_QUE_TAPA = 253;

/**
 * Bairro misto: quais zonas da malha se desenham.
 *
 * Onde as manchas estão inteiras a malha já não se pintava (ver
 * `ensinarAGrelha`), mas a placa tinha na mesma de passar por ela, ponto a
 * ponto, e por baixo de tudo: no Alto isso custava uns 12 % de cada imagem
 * sem se ver nada. Agora cada zona sabe quantos quadrados da grelha que lhe
 * tocam ainda não estão tapados, e só se desenha com algum. A conta segue a
 * grelha quadrado a quadrado, no mesmo instante em que ela muda: uma zona onde
 * as manchas começam a desvanecer acende-se nessa mesma imagem, e as
 * transições ficam como eram.
 *
 * @returns {object} `juntar(zonas)`, `grelhaNova(grelha|null)`,
 *     `celula(q, tapada)`, `aplicar()` e `todasAVista(sim)`.
 */
function criarZonasDaMalha() {
    const zonas = [];
    let grelha = null;
    // Para cada quadrado da grelha, as zonas a que ele toca (ver `mapear`).
    let inicio = null;
    let lista = null;
    let todas = false;

    function mapear() {
        inicio = null;
        lista = null;
        if (!grelha || !zonas.length) return;
        const { colunas, linhas, dados, parametros } = grelha;
        const ox = parametros[0], oz = parametros[1];
        const quadrado = (v, o, n) => Math.max(0, Math.min(n - 1, Math.floor((v - o) / CELULA)));
        const total = colunas * linhas;
        const conta = new Uint32Array(total + 1);
        for (const z of zonas) {
            z.c0 = quadrado(z.x0, ox, colunas); z.c1 = quadrado(z.x1, ox, colunas);
            z.j0 = quadrado(z.z0, oz, linhas); z.j1 = quadrado(z.z1, oz, linhas);
            for (let j = z.j0; j <= z.j1; j++) {
                for (let c = z.c0; c <= z.c1; c++) conta[j * colunas + c + 1]++;
            }
        }
        for (let q = 0; q < total; q++) conta[q + 1] += conta[q];
        const cheio = conta.slice(0, total);
        lista = new Uint32Array(conta[total]);
        zonas.forEach((z, k) => {
            z.descobertos = 0;
            for (let j = z.j0; j <= z.j1; j++) {
                for (let c = z.c0; c <= z.c1; c++) {
                    const q = j * colunas + c;
                    lista[cheio[q]++] = k;
                    if (dados[q * 4 + 2] < AZUL_QUE_TAPA) z.descobertos++;
                }
            }
        });
        inicio = conta;
    }

    return {
        juntar(novas) {
            for (const z of novas) zonas.push(z);
            mapear();
        },
        grelhaNova(nova) {
            grelha = nova;
            mapear();
        },
        // Um quadrado da grelha ficou tapado (ou deixou de estar).
        celula(q, tapada) {
            if (!inicio) return;
            const d = tapada ? -1 : 1;
            for (let k = inicio[q]; k < inicio[q + 1]; k++) zonas[lista[k]].descobertos += d;
        },
        aplicar() {
            for (const z of zonas) {
                const ver = todas || !inicio || z.descobertos > 0;
                if (z.mi.visible !== ver) z.mi.visible = ver;
            }
        },
        // O leitor de sítios (onde se carregou) lê a malha toda, como antes.
        todasAVista(sim) {
            todas = sim;
            this.aplicar();
        },
        // Para as provas: as zonas e a grelha que elas seguem.
        diagnostico() {
            return { zonas, grelha };
        }
    };
}

/**
 * Corta as peças da malha em zonas de `LADO_DA_ZONA` metros de lado.
 *
 * Cada triângulo vai para a zona onde fica o meio dele. As zonas de uma peça
 * partilham a geometria dela e uma lista só, arrumada zona a zona; cada uma é
 * uma fatia dessa lista, com a caixa dos seus triângulos (a placa também não
 * desenha as que ficam fora do ecrã).
 *
 * @param {object} dispositivo - A placa gráfica.
 * @param {MeshInstance[]} pecas - As peças, como vêm do ficheiro.
 * @returns {{mi: MeshInstance, x0: number, x1: number, z0: number, z1: number, descobertos: number}[]}
 *     As zonas, com a caixa de cada uma vista de cima, em coordenadas da cena.
 */
function dividirEmZonas(dispositivo, pecas) {
    const zonas = [];
    const v = new Vec3();
    for (const mi of pecas) {
        const mesh = mi.mesh;
        const ib = mesh && mesh.indexBuffer && mesh.indexBuffer[0];
        const prim = mesh && mesh.primitive && mesh.primitive[0];
        const posicoes = [];
        if (ib && ib.storage && prim && prim.type === PRIMITIVE_TRIANGLES && prim.indexed) mesh.getPositions(posicoes);
        if (!posicoes.length) {
            // Uma peça que não se deixa ler fica inteira, sempre à vista.
            zonas.push({ mi, x0: -1e9, x1: 1e9, z0: -1e9, z1: 1e9, descobertos: 1 });
            continue;
        }
        const W = mi.node.getWorldTransform();
        const nv = posicoes.length / 3;
        const wx = new Float32Array(nv), wz = new Float32Array(nv);
        for (let i = 0; i < nv; i++) {
            v.set(posicoes[i * 3], posicoes[i * 3 + 1], posicoes[i * 3 + 2]);
            W.transformPoint(v, v);
            wx[i] = v.x;
            wz[i] = v.z;
        }
        const Tipo = ib.format === INDEXFORMAT_UINT32 ? Uint32Array : Uint16Array;
        const todos = new Tipo(ib.storage);
        const indices = todos.subarray(prim.base, prim.base + prim.count);
        const triangulos = Math.floor(indices.length / 3);
        // A zona de cada triângulo.
        let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < nv; i++) {
            if (wx[i] < minX) minX = wx[i]; if (wx[i] > maxX) maxX = wx[i];
            if (wz[i] < minZ) minZ = wz[i]; if (wz[i] > maxZ) maxZ = wz[i];
        }
        const kx0 = Math.floor(minX / LADO_DA_ZONA), kz0 = Math.floor(minZ / LADO_DA_ZONA);
        const nkx = Math.floor(maxX / LADO_DA_ZONA) - kx0 + 1;
        const nkz = Math.floor(maxZ / LADO_DA_ZONA) - kz0 + 1;
        const deQual = new Uint32Array(triangulos);
        const conta = new Uint32Array(nkx * nkz + 1);
        for (let t = 0; t < triangulos; t++) {
            const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
            const kx = Math.floor((wx[a] + wx[b] + wx[c]) / 3 / LADO_DA_ZONA) - kx0;
            const kz = Math.floor((wz[a] + wz[b] + wz[c]) / 3 / LADO_DA_ZONA) - kz0;
            const k = Math.min(nkz - 1, Math.max(0, kz)) * nkx + Math.min(nkx - 1, Math.max(0, kx));
            deQual[t] = k;
            conta[k + 1]++;
        }
        for (let k = 0; k < nkx * nkz; k++) conta[k + 1] += conta[k];
        const arrumados = new Tipo(triangulos * 3);
        const cheio = conta.slice(0, nkx * nkz);
        for (let t = 0; t < triangulos; t++) {
            const o = cheio[deQual[t]]++ * 3;
            arrumados[o] = indices[t * 3];
            arrumados[o + 1] = indices[t * 3 + 1];
            arrumados[o + 2] = indices[t * 3 + 2];
        }
        const lista = new IndexBuffer(dispositivo, ib.format, arrumados.length, BUFFER_STATIC, arrumados.buffer);
        for (let k = 0; k < nkx * nkz; k++) {
            const de = conta[k], ate = conta[k + 1];
            if (ate === de) continue;
            let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
            const lmin = [Infinity, Infinity, Infinity], lmax = [-Infinity, -Infinity, -Infinity];
            for (let i = de * 3; i < ate * 3; i++) {
                const p = arrumados[i];
                if (wx[p] < x0) x0 = wx[p]; if (wx[p] > x1) x1 = wx[p];
                if (wz[p] < z0) z0 = wz[p]; if (wz[p] > z1) z1 = wz[p];
                for (let e = 0; e < 3; e++) {
                    const s = posicoes[p * 3 + e];
                    if (s < lmin[e]) lmin[e] = s; if (s > lmax[e]) lmax[e] = s;
                }
            }
            const parte = new Mesh(dispositivo);
            parte.vertexBuffer = mesh.vertexBuffer;
            parte.indexBuffer[0] = lista;
            parte.primitive[0] = { type: PRIMITIVE_TRIANGLES, base: de * 3, baseVertex: 0, count: (ate - de) * 3, indexed: true };
            parte.aabb = new BoundingBox(
                new Vec3((lmin[0] + lmax[0]) / 2, (lmin[1] + lmax[1]) / 2, (lmin[2] + lmax[2]) / 2),
                new Vec3((lmax[0] - lmin[0]) / 2, (lmax[1] - lmin[1]) / 2, (lmax[2] - lmin[2]) / 2)
            );
            const zona = new MeshInstance(parte, mi.material, mi.node);
            zonas.push({
                mi: zona,
                x0: x0 - FOLGA_DA_ZONA, x1: x1 + FOLGA_DA_ZONA, z0: z0 - FOLGA_DA_ZONA, z1: z1 + FOLGA_DA_ZONA,
                descobertos: 1
            });
        }
        // A peça inteira sai de cena, mas a geometria fica: é das zonas.
        mesh.incRefCount();
    }
    return zonas;
}

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
 * Bairro misto: deixa uma zona ter dois níveis de manchas desenhados ao
 * mesmo tempo — o principal, que o motor escolhe, e um segundo — e mexe
 * neles só na vez do motor.
 *
 *  - O motor larga o nível antigo de uma zona no instante em que o novo
 *    está pronto. Aqui, quando ele o vai largar e a zona continua com outro
 *    nível desenhado, o antigo fica guardado em `nodeInfo.aDesvanecer`
 *    (ficheiro → nível), e quem o larga a sério é o `vigiarAsManchas`,
 *    quando ele acabar de se desvanecer. Se a zona voltar a esse nível
 *    antes disso, ele deixa de estar a desvanecer-se.
 *  - O segundo nível de uma zona que toca a faixa de passagem (ver
 *    `segundoNivel` em lod-foco.mjs) é pedido aqui, porque o motor só pede
 *    um nível por zona.
 *  - Juntar ou largar um nível muda a lista do que o motor desenha. Feito
 *    fora da vez dele, o motor ficava umas dez imagens a desenhar com a
 *    lista desacertada, e a zona inteira ficava preta. Por isso as duas
 *    coisas ficam numa fila e só se fazem quando ele próprio se atualiza:
 *    aí a lista nova é feita logo.
 *
 * Lê e muda contas que o motor guarda lá por dentro, como o lod-foco.mjs.
 *
 * @param {object} instancia - O mapa (a instância da octree do motor).
 * @returns {{largar: function(number, number, number): void,
 *     juntar: function(number, number, number): void}|null} Põem na fila
 *     largar ou juntar o nível (ficheiro, zona, nível); `null` se o motor
 *     não deixar.
 */
function mexerNosNiveis(instancia) {
    const modelo = Object.getPrototypeOf(instancia);
    if (!modelo || typeof modelo.decrementFileRef !== 'function' ||
        typeof modelo.incrementFileRef !== 'function' || typeof modelo.update !== 'function') return null;
    if (!modelo.niveisNaVezDoMotor) {
        const largarDeOrigem = modelo.decrementFileRef;
        const juntarDeOrigem = modelo.incrementFileRef;
        const atualizarDeOrigem = modelo.update;
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
                    (info.aDesvanecer || (info.aDesvanecer = new Map())).set(fileIndex, p.lodIndex > 0 ? p.lodIndex : 0);
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
        modelo.update = function (...argumentos) {
            if (this.aJuntar && this.aJuntar.length) {
                const lista = this.aJuntar;
                this.aJuntar = [];
                for (const [f, n, nivel] of lista) {
                    const info = this.nodeInfos[n];
                    const p = this.filePlacements[f];
                    // Só se ainda for preciso, e se ainda lá não estiver.
                    if (!info || info.segundoAtivo !== nivel || info.currentLod === nivel) continue;
                    if (p && p.intervals.has(n)) continue;
                    if (info.aDesvanecer) info.aDesvanecer.delete(f);
                    juntarDeOrigem.call(this, f, n, nivel);
                }
            }
            if (this.aLargar && this.aLargar.length) {
                const lista = this.aLargar;
                this.aLargar = [];
                for (const [f, n, nivel] of lista) {
                    const info = this.nodeInfos[n];
                    // Se entretanto passou a ser o nível principal, fica.
                    // Ou se voltou a ser pedido, como segundo, entretanto.
                    if (info && (info.currentLod === nivel || info.segundoAtivo === nivel)) continue;
                    // Ou se o motor o tem a caminho, para ser o principal:
                    // sem ele, o que está à vista seria largado por nada.
                    const aCaminho = this.pendingDecrements && this.pendingDecrements.get(n);
                    if (aCaminho && aCaminho.newFileIndex === f) continue;
                    if (this.pendingVisibleAdds && this.pendingVisibleAdds.get(n) === f) continue;
                    largarDeOrigem.call(this, f, n);
                }
            }
            return atualizarDeOrigem.apply(this, argumentos);
        };
        modelo.niveisNaVezDoMotor = true;
    }
    if (!instancia.aLargar) instancia.aLargar = [];
    if (!instancia.aJuntar) instancia.aJuntar = [];
    return {
        largar: (fileIndex, nodeIndex, nivel) => { instancia.aLargar.push([fileIndex, nodeIndex, nivel]); },
        juntar: (fileIndex, nodeIndex, nivel) => { instancia.aJuntar.push([fileIndex, nodeIndex, nivel]); }
    };
}

// Os lugares próprios do nível do meio de cada zona (ver `separarLugares`):
// números bem acima dos que o motor dá, para nunca se encontrarem.
let proximoLugar = 2 ** 30;

/**
 * Bairro misto: dá a cada nível de cada zona o seu lugar na memória gráfica
 * do motor.
 *
 * O motor arruma as manchas por zona: cada zona tem um número, e é por ele
 * que encontra o lugar onde estão as manchas dela. Só conta com um nível de
 * cada vez; com dois desenhados, disputavam o mesmo lugar, e ao largar um
 * o outro ficava sem sítio umas imagens — a zona ficava preta. Aqui, ao
 * montar a lista do que desenha, o nível do meio de cada zona recebe um
 * número seu, que guarda sempre: trocar de principal não obriga a copiar
 * nada outra vez.
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
        if (this.nodeInfos && zonas && zonas.length && this.lodIndex > 0) {
            for (let j = 0; j < zonas.length; j++) {
                const info = this.nodeInfos[zonas[j]];
                if (!info) continue;
                if (!info.lugarDoMeio) info.lugarDoMeio = proximoLugar++;
                this.intervalAllocIds[j] = info.lugarDoMeio;
            }
        }
        return resultado;
    };
    modelo.lugaresSeparados = true;
    return true;
}

// O mapa de agora, e, por ficheiro de manchas, onde começa cada pedaço.
let octreeDaCopia = null;
const iniciosPorFicheiro = new WeakMap();

/**
 * Onde começa cada pedaço dentro de um ficheiro de manchas: uma tabela, por
 * ordem, de (primeira mancha, pedaço + 1). É por ela que cada mancha, ao ser
 * copiada, sabe de que pedaço é (ver `marcarAsManchas`).
 *
 * @param {object} device - A placa gráfica.
 * @param {object} splatInfo - O ficheiro, tal como o motor o vai copiar.
 * @returns {{textura: Texture, quantos: number}} A tabela.
 */
function iniciosDoFicheiro(device, splatInfo) {
    let feito = iniciosPorFicheiro.get(splatInfo.resource);
    if (feito) return feito;
    const lista = [];
    const nivel = splatInfo.lodIndex > 0 ? splatInfo.lodIndex : 0;
    const zona = splatInfo.intervalNodeIndices[0];
    const ficheiro = octreeDaCopia && zona !== undefined && octreeDaCopia.nodes[zona].lods[nivel]
        ? octreeDaCopia.nodes[zona].lods[nivel].fileIndex : -1;
    if (ficheiro >= 0) {
        for (let n = 0; n < octreeDaCopia.nodes.length; n++) {
            const lod = octreeDaCopia.nodes[n].lods[nivel];
            if (lod && lod.fileIndex === ficheiro && lod.count > 0) lista.push([lod.offset, n + 1]);
        }
    }
    lista.sort((a, b) => a[0] - b[0]);
    const textura = new Texture(device, {
        name: 'bairroInicios', width: Math.max(1, lista.length), height: 1,
        format: PIXELFORMAT_RG32U, mipmaps: false,
        minFilter: FILTER_NEAREST, magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE, addressV: ADDRESS_CLAMP_TO_EDGE
    });
    const dados = textura.lock();
    dados.fill(0);
    lista.forEach((par, k) => { dados[k * 2] = par[0]; dados[k * 2 + 1] = par[1]; });
    textura.unlock();
    feito = { textura, quantos: lista.length };
    iniciosPorFicheiro.set(splatInfo.resource, feito);
    return feito;
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
function dizerONivelNaCopia(mundo, octree) {
    octreeDaCopia = octree;
    const buffer = mundo && mundo._workBuffer;
    const passo = buffer && (buffer.renderPass || buffer.colorRenderPass);
    const modelo = passo && Object.getPrototypeOf(passo);
    if (!modelo || typeof modelo.renderSplat !== 'function') return false;
    if (modelo.nivelNaCopia) return true;
    const copiarDeOrigem = modelo.renderSplat;
    modelo.renderSplat = function (splatInfo, ...resto) {
        if (this.device && splatInfo) {
            this.device.scope.resolve('uNivelDoBairro').setValue(splatInfo.lodIndex > 0 ? splatInfo.lodIndex : 0);
            if (splatInfo.octreeNodes) {
                const inicios = iniciosDoFicheiro(this.device, splatInfo);
                this.device.scope.resolve('uInicios').setValue(inicios.textura);
                this.device.scope.resolve('uQuantosInicios').setValue(inicios.quantos);
            }
        }
        return copiarDeOrigem.call(this, splatInfo, ...resto);
    };
    modelo.nivelNaCopia = true;
    return true;
}

/**
 * Bairro misto: vigia os pedaços das manchas e mantém uma grelha, vista de
 * cima, que diz em cada quadrado quanto de cada nível está à vista, de zero
 * a um:
 *
 *  - vermelho: as manchas do nível fino, no pedaço que mais as tem;
 *  - verde: as do nível do meio, no pedaço que mais as tem;
 *  - azul: as manchas todas — a malha só se apaga onde ele está cheio, e as
 *    árvores em manchas da malha aparecem na medida contrária.
 *
 * E uma segunda grelha com o mesmo, mas no pedaço que menos as tem: é a
 * que diz se um nível pode dar lugar ao outro. Num quadrado partilhado por
 * um pedaço só com o fino e outro só com o do meio, nenhum dos dois o pode
 * fazer — senão as manchas de cada um apagavam-se a contar com as do outro,
 * que ali não são as suas, e via-se uma frincha escura.
 *
 * Cada nível de cada pedaço tem o seu "à vista", que anda aos poucos
 * (`TEMPO_DE_DESVANECER`): sobe quando o pedaço o quer e o motor já o
 * desenha; desce quando já não o quer — mas só depois de o outro nível que
 * ele quer estar inteiro, para nunca se ver o fundo pelo meio. Um nível que
 * acabou de descer é largado. Um pedaço que vai para a malha desce os dois,
 * e só depois o lod-foco.mjs o deixa sair (ver `segurarNaPassagem`).
 *
 * Onde estão os dois, quem decide quanto se vê de cada um é a distância de
 * cada mancha à fronteira, na faixa de passagem (ver
 * `ensinarAGrelhaAsManchas`); esta grelha diz só quais estão lá.
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
 * @param {object|null} [zonasDaMalha] - As zonas da malha (ver
 *     `criarZonasDaMalha`), que seguem a grelha quadrado a quadrado.
 * @returns {{textura: Texture, parametros: Float32Array}} A grelha de agora.
 */
function vigiarAsManchas(app, aoMudar, aoAcharMapa, zonasDaMalha = null) {
    const camara = app.root.findByName('camera');
    const dispositivo = app.graphicsDevice;

    const criarTextura = (largura, altura, nome, formato = PIXELFORMAT_RGBA8) => new Texture(dispositivo, {
        name: nome,
        width: largura,
        height: altura,
        format: formato,
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
    const vaziaMenor = criarTextura(1, 1, 'bairroMistoMenorVazio', PIXELFORMAT_RG8);
    vaziaMenor.lock().set(new Uint8Array([0, 0]));
    vaziaMenor.unlock();
    // origem X, origem Z, 1 / largura e 1 / altura da grelha, em metros.
    // Quanto se vê de cada pedaço, em cada nível: um ponto por pedaço, 64 por
    // linha. A grelha sozinha junta os pedaços vizinhos num quadrado só, e as
    // manchas de um que acabou de chegar, na orla, apareciam logo inteiras
    // por o vizinho já lá estar. Os outros dois números dizem, para o fino e
    // para o do meio, se o pedaço está parado e por dentro: inteiro, e com
    // todos os quadrados à volta inteiros nesse nível e sem o outro. Aí as
    // manchas dele não precisam da grelha para nada, e saltam a conta (ver
    // `ensinarAGrelhaAsManchas` e `verPorDentro`).
    const criarPedacos = (n) => new Texture(dispositivo, {
        name: 'bairroPedacos', width: 64, height: Math.max(1, Math.ceil((n + 1) / 64)),
        format: PIXELFORMAT_RGBA8, mipmaps: false,
        minFilter: FILTER_NEAREST, magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE, addressV: ADDRESS_CLAMP_TO_EDGE
    });
    let pedacosVistos = null;
    const pedacosVazios = criarPedacos(0);
    pedacosVazios.lock().fill(0);
    pedacosVazios.unlock();
    const semGrelha = () => ({ textura: vazia, texturaMenor: vaziaMenor, pedacos: pedacosVazios, parametros: new Float32Array([0, 0, 1, 1]) });
    let atual = semGrelha();

    let instancia = null;
    let mundo = null;
    let niveis = null;
    let lugaresProntos = false;
    let grelha = null;
    let antes = 0;
    // Por pedaço: quanto se vê do nível fino e do meio, desde quando cada
    // um está no motor, e o que a grelha tem dele (fino, meio, tudo).
    let v0, v1, desde, g0, g1, gT;
    // Níveis largados de que a lista do motor ainda fala (ela chega umas
    // imagens atrasada), e quando cada zona pediu o segundo nível.
    let atrasado, pedidoEm;
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
        const texturaMenor = criarTextura(colunas, linhas, 'bairroMistoMenor', PIXELFORMAT_RG8);
        return {
            nos, colunas, linhas, alargada, inicio, pedacos, textura, texturaMenor,
            dados: new Uint8Array(total * 4),
            dadosMenor: new Uint8Array(total * 2),
            parametros: new Float32Array([origemX, origemZ, 1 / (colunas * CELULA), 1 / (linhas * CELULA)])
        };
    }

    // Um quadrado: de cada nível e de tudo, o mais à vista dos pedaços que lá
    // chegam, mas nunca mais do que o menos à vista dos que lá estão de facto
    // (caixa justa).
    function refazerQuadrado(q) {
        if (!quadradoMudou[q]) { quadradoMudou[q] = 1; quadradosMudados.push(q); }
        const { inicio, pedacos, dados, dadosMenor } = grelha;
        let m0 = 0, m1 = 0, mT = 0, menor = 1, n0 = 1, n1 = 1, algum = false;
        for (let k = inicio[q]; k < inicio[q + 1]; k++) {
            const e = pedacos[k];
            const i = e >> 1;
            if (g0[i] > m0) m0 = g0[i];
            if (g1[i] > m1) m1 = g1[i];
            if (gT[i] > mT) mT = gT[i];
            if (e & 1) {
                algum = true;
                if (gT[i] < menor) menor = gT[i];
                if (g0[i] < n0) n0 = g0[i];
                if (g1[i] < n1) n1 = g1[i];
            }
        }
        if (!algum) { n0 = 0; n1 = 0; }
        const o = q * 4;
        dados[o] = Math.round(255 * Math.min(m0, menor));
        dados[o + 1] = Math.round(255 * Math.min(m1, menor));
        const azul = Math.round(255 * Math.min(mT, menor));
        if (zonasDaMalha && (dados[o + 2] >= AZUL_QUE_TAPA) !== (azul >= AZUL_QUE_TAPA)) {
            zonasDaMalha.celula(q, azul >= AZUL_QUE_TAPA);
        }
        dados[o + 2] = azul;
        dadosMenor[q * 2] = Math.round(255 * n0);
        dadosMenor[q * 2 + 1] = Math.round(255 * n1);
    }

    // Os quadrados refeitos nesta imagem, e os pedaços que é preciso ver de
    // novo se estão parados e por dentro (ver `verPorDentro`).
    let quadradoMudou = new Uint8Array(0);
    const quadradosMudados = [];
    let porVer = new Uint8Array(0);

    /**
     * Para cada pedaço tocado pelo que mudou nesta imagem, se está parado e
     * por dentro em cada nível: o nível inteiro, e todos os quadrados da caixa
     * dele (e um à volta, que a grelha lê-se esbatida) inteiros nesse nível e
     * sem nada do outro. Fica escrito no 3.º e 4.º número do pedaço.
     *
     * @returns {boolean} Se alguma marca mudou.
     */
    function verPorDentro() {
        if (!quadradosMudados.length || !grelha) return false;
        const { colunas, linhas, inicio, pedacos, alargada, dados, dadosMenor } = grelha;
        const lista = [];
        for (const q of quadradosMudados) {
            quadradoMudou[q] = 0;
            const c = q % colunas, j = (q - c) / colunas;
            for (let dj = -1; dj <= 1; dj++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const jj = j + dj, cc = c + dc;
                    if (jj < 0 || cc < 0 || jj >= linhas || cc >= colunas) continue;
                    const qq = jj * colunas + cc;
                    for (let k = inicio[qq]; k < inicio[qq + 1]; k++) {
                        const i = pedacos[k] >> 1;
                        if (!porVer[i]) { porVer[i] = 1; lista.push(i); }
                    }
                }
            }
        }
        quadradosMudados.length = 0;
        let mudouAlguma = false;
        for (const i of lista) {
            porVer[i] = 0;
            const c0 = Math.max(0, alargada[i * 4] - 1), c1 = Math.min(colunas - 1, alargada[i * 4 + 1] + 1);
            const j0 = Math.max(0, alargada[i * 4 + 2] - 1), j1 = Math.min(linhas - 1, alargada[i * 4 + 3] + 1);
            for (let nivel = 0; nivel < 2; nivel++) {
                let dentro = (nivel ? v1[i] : v0[i]) >= 1;
                for (let jj = j0; jj <= j1 && dentro; jj++) {
                    for (let cc = c0; cc <= c1; cc++) {
                        const qq = jj * colunas + cc;
                        if (dados[qq * 4 + nivel] !== 255 || dadosMenor[qq * 2 + (1 - nivel)] !== 0) { dentro = false; break; }
                    }
                }
                const o = (i + 1) * 4 + 2 + nivel;
                const valor = dentro ? 255 : 0;
                if (pedacosVistos[o] !== valor) { pedacosVistos[o] = valor; mudouAlguma = true; }
            }
        }
        return mudouAlguma;
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
        grelha.texturaMenor.lock().set(grelha.dadosMenor);
        grelha.texturaMenor.unlock();
        grelha.texturaPedacos.lock().set(pedacosVistos);
        grelha.texturaPedacos.unlock();
    }

    // Se um pedaço tem um nível guardado a desvanecer-se (ver `mexerNosNiveis`).
    function aDesvanecer(info, nivel) {
        if (!info.aDesvanecer || !info.aDesvanecer.size) return false;
        for (const n of info.aDesvanecer.values()) if (n === nivel) return true;
        return false;
    }

    app.on('prerender', () => {
        const achado = mapaDasManchas(app, camara);
        const mapa = achado ? achado.instancia : null;
        mundo = achado ? achado.mundo : null;
        if (mapa !== instancia) {
            instancia = mapa;
            if (grelha) {
                grelha.textura.destroy();
                grelha.texturaMenor.destroy();
                grelha.texturaPedacos.destroy();
            }
            grelha = mapa ? medirGrelha(mapa) : null;
            if (grelha) {
                const n = grelha.nos;
                v0 = new Float32Array(n);
                v1 = new Float32Array(n);
                desde = new Float64Array(n * 2);
                atrasado = new Uint8Array(n * 2);
                pedidoEm = new Float64Array(n);
                g0 = new Float32Array(n);
                g1 = new Float32Array(n);
                gT = new Float32Array(n);
                versaoVista = -1;
                niveis = mexerNosNiveis(mapa);
                grelha.texturaPedacos = criarPedacos(n);
                pedacosVistos = new Uint8Array(64 * grelha.texturaPedacos.height * 4);
                porVer = new Uint8Array(n);
                quadradosMudados.length = 0;
                if (quadradoMudou.length !== grelha.colunas * grelha.linhas) quadradoMudou = new Uint8Array(grelha.colunas * grelha.linhas);
                else quadradoMudou.fill(0);
                dizerONivelNaCopia(mundo, mapa.octree);
                enviarGrelha();
                atual = { textura: grelha.textura, texturaMenor: grelha.texturaMenor, pedacos: grelha.texturaPedacos, parametros: grelha.parametros };
                if (aoAcharMapa) aoAcharMapa(mapa, mundo);
            } else {
                atual = semGrelha();
            }
            if (zonasDaMalha) zonasDaMalha.grelhaNova(grelha);
            aoMudar(atual);
        }

        const agora = performance.now();
        // Com o separador escondido o tempo passa sem imagens: não se
        // salta o desvanecer de uma vez ao voltar.
        const passo = Math.min(agora - antes, 100) / TEMPO_DE_DESVANECER;
        antes = agora;
        if (!grelha) {
            if (zonasDaMalha) zonasDaMalha.aplicar();
            return;
        }

        // Dois níveis numa zona só quando cada um pode ter o seu lugar (ver
        // `separarLugares`); até lá, e num motor que não o deixe, cada zona
        // tem um nível só, e a troca entre eles é seca.
        if (!lugaresProntos) lugaresProntos = separarLugares(mundo);
        const doisNiveis = lugaresProntos && !!niveis;
        instancia.trocasSuaves = doisNiveis;

        if (mundo && mundo.currentVersion !== versaoVista) {
            versaoVista = mundo.currentVersion;
            sabeOQueDesenha = oQueSeDesenha(mundo, desenhados) !== null;
        }
        const infos = instancia.nodeInfos;
        const nos = instancia.octree.nodes;
        let mudou = false;
        let reavaliar = false;
        for (let i = 0; i < grelha.nos; i++) {
            const info = infos[i];
            if (!info) continue;
            const principal = info.currentLod;
            const lods = nos[i].lods;

            // O segundo nível que passou a ser o principal já não é segundo.
            if (info.segundoAtivo >= 0 && info.segundoAtivo === principal) info.segundoAtivo = -1;
            const segundo = doisNiveis && info.segundoNivel >= 0 && info.segundoNivel !== principal && principal >= 0
                ? info.segundoNivel : -1;
            if (segundo >= 0 && info.segundoAtivo !== segundo) {
                if (aDesvanecer(info, segundo)) {
                    // Estava a desvanecer-se e voltou a ser preciso: fica,
                    // como segundo.
                    info.aDesvanecer.forEach((n, f) => { if (n === segundo) info.aDesvanecer.delete(f); });
                    info.segundoAtivo = segundo;
                } else if (info.segundoAtivo < 0 && lods[segundo] && lods[segundo].fileIndex >= 0) {
                    info.segundoAtivo = segundo;
                    pedidoEm[i] = agora;
                    niveis.juntar(lods[segundo].fileIndex, i, segundo);
                }
            }
            // O segundo nível que devia estar no motor e não está (o motor
            // largou-o por conta dele) pede-se outra vez.
            if (niveis && info.segundoAtivo >= 0 && agora - pedidoEm[i] > 300) {
                pedidoEm[i] = agora;
                const f = lods[info.segundoAtivo].fileIndex;
                const p = instancia.filePlacements[f];
                if (!p || !p.intervals.has(i)) niveis.juntar(f, i, info.segundoAtivo);
            }

            for (let nivel = 0; nivel < 2; nivel++) {
                const guardado = aDesvanecer(info, nivel);
                const tem = principal === nivel || info.segundoAtivo === nivel || guardado;
                const quer = !info.aSair && (principal === nivel || segundo === nivel);
                const k = i * 2 + nivel;
                let v = nivel ? v1[i] : v0[i];
                if (!tem) {
                    v = 0;
                    desde[k] = 0;
                    atrasado[k] = desenhados.has(i * 4 + nivel) ? 1 : 0;
                } else {
                    if (!desde[k]) desde[k] = agora;
                    const espera = agora - desde[k];
                    const naLista = desenhados.has(i * 4 + nivel);
                    if (atrasado[k] && (!naLista || espera > 1000)) atrasado[k] = 0;
                    if (quer) {
                        // Sobe quando já está no ecrã: a zona, neste nível,
                        // está na lista que o motor desenha agora. Espera-se
                        // o que for preciso: um nível que ainda vem da
                        // internet, dado por visto antes de chegar, surgia
                        // depois de repente.
                        const seVe = sabeOQueDesenha
                            ? naLista && !atrasado[k]
                            : espera >= ESPERA_MAXIMA_AO_ENTRAR / 4;
                        if (seVe) v = Math.min(1, v + passo);
                    } else {
                        // Desce só quando o outro, se for preciso, já está
                        // inteiro. (Descer os dois ao mesmo tempo deixava-os,
                        // a meio, ambos meio transparentes: via-se a malha por
                        // baixo, e a zona clareava ou escurecia.)
                        const outro = 1 - nivel;
                        const outroPreciso = !info.aSair && (principal === outro || segundo === outro);
                        const outroInteiro = (outro ? v1[i] : v0[i]) >= 0.999;
                        if (!outroPreciso || outroInteiro) v = Math.max(0, v - passo);
                        if (v <= 0 && niveis) {
                            // Desceu de todo: larga-se, na vez do motor.
                            if (guardado) {
                                info.aDesvanecer.forEach((n, f) => {
                                    if (n === nivel) { niveis.largar(f, i, nivel); info.aDesvanecer.delete(f); }
                                });
                            }
                            if (info.segundoAtivo === nivel) {
                                if (lods[nivel] && lods[nivel].fileIndex >= 0) niveis.largar(lods[nivel].fileIndex, i, nivel);
                                info.segundoAtivo = -1;
                            }
                        }
                    }
                }
                if (nivel) v1[i] = v; else v0[i] = v;
            }

            const vista = Math.max(v0[i], v1[i]);
            info.vista = vista;
            if (info.aSair && vista <= 0.01) reavaliar = true;

            if (v0[i] !== g0[i] || v1[i] !== g1[i] || vista !== gT[i]) {
                g0[i] = v0[i];
                g1[i] = v1[i];
                gT[i] = vista;
                pedacosVistos[(i + 1) * 4] = Math.round(255 * v0[i]);
                pedacosVistos[(i + 1) * 4 + 1] = Math.round(255 * v1[i]);
                refazerQuadrados(i);
                mudou = true;
            }
        }
        if (verPorDentro()) mudou = true;
        if (mudou) enviarGrelha();
        // As zonas da malha que se desenham nesta imagem: a grelha acabou de
        // ser refeita, e é ela que a malha vai ler.
        if (zonasDaMalha) zonasDaMalha.aplicar();
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
 * malha fica por baixo, e a partir de 0,6 vai-se apagando ponto a ponto: ela
 * tapa as manchas que lhe ficam por trás, e apagada de uma vez elas surgiam
 * todas no mesmo instante.
 *
 * @param {object} material - Um material da malha.
 */
function ensinarAGrelha(material) {
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('litUserDeclarationPS', `
uniform sampler2D uBairroMisto;
uniform vec4 uBairroMistoGrelha;
`);
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('litUserMainStartPS', `
    if (texture(uBairroMisto, (vPositionW.xz - uBairroMistoGrelha.xy) * uBairroMistoGrelha.zw).b > mix(0.6, 0.99, fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))))) {
        discard;
    }
`);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('litUserDeclarationPS', `
var uBairroMisto: texture_2d<f32>;
var uBairroMistoSampler: sampler;
uniform uBairroMistoGrelha: vec4f;
`);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('litUserMainStartPS', `
    if (textureSampleLevel(uBairroMisto, uBairroMistoSampler, (vPositionW.xz - uniform.uBairroMistoGrelha.xy) * uniform.uBairroMistoGrelha.zw, 0.0).b > mix(0.6, 0.99, fract(52.9829189 * fract(dot(floor(pcPosition.xy), vec2f(0.06711056, 0.00583715)))))) {
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
${marca === null ? `uniform float uNivelDoBairro;
uniform highp usampler2D uInicios;
uniform int uQuantosInicios;
uint pedacoDaMancha() {
    int baixo = 0;
    int alto = uQuantosInicios;
    for (int k = 0; k < 16 && baixo < alto; k++) {
        int meio = (baixo + alto) / 2;
        if (texelFetch(uInicios, ivec2(meio, 0), 0).r <= splat.index) baixo = meio + 1; else alto = meio;
    }
    return baixo > 0 ? texelFetch(uInicios, ivec2(baixo - 1, 0), 0).g : 0u;
}` : 'uint pedacoDaMancha() { return 0u; }'}
void modifySplatCenter(inout vec3 center) {}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
void modifySplatColor(vec3 center, inout vec4 color) {
    color.b = ${marca === null ? 'min(uNivelDoBairro, 1.0)' : marca} + 0.02 + clamp(color.b, 0.0, 1.0) * 0.96;
    writeBairroPedaco(uvec4(pedacoDaMancha(), 0u, 0u, 0u));
}`;
    const wgsl = `
${marca === null ? `uniform uNivelDoBairro: f32;
var uInicios: texture_2d<u32>;
uniform uQuantosInicios: i32;
fn pedacoDaMancha() -> u32 {
    var baixo: i32 = 0;
    var alto: i32 = uniform.uQuantosInicios;
    for (var k: i32 = 0; k < 16 && baixo < alto; k++) {
        let meio = (baixo + alto) / 2;
        if (textureLoad(uInicios, vec2i(meio, 0), 0).r <= splat.index) { baixo = meio + 1; } else { alto = meio; }
    }
    if (baixo > 0) { return textureLoad(uInicios, vec2i(baixo - 1, 0), 0).g; }
    return 0u;
}` : 'fn pedacoDaMancha() -> u32 { return 0u; }'}
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    (*color).b = ${marca === null ? 'min(uniform.uNivelDoBairro, 1.0)' : marca} + 0.02 + clamp((*color).b, 0.0, 1.0) * 0.96;
    writeBairroPedaco(vec4u(pedacoDaMancha(), 0u, 0u, 0u));
}`;
    componente.setWorkBufferModifier({ glsl, wgsl });
}

/**
 * Ensina às manchas, no momento de as desenhar (a cada imagem), quanto se
 * vê de cada uma.
 *
 * Na faixa de passagem entre o fino e o do meio (ver `FAIXA_DE_PASSAGEM` em
 * lod-foco.mjs), cada mancha mede a sua distância no balão — a mesma conta
 * que o lod-foco.mjs faz aos pedaços, com a câmara de agora — e passa de um
 * nível para o outro conforme ela: perto do começo da faixa vê-se o fino,
 * perto do fim o do meio, e a meio os dois um nada sobrepostos, para não
 * se ver o fundo. Faz essa conta com a câmara de agora e com a do último
 * segundo (ver `acompanharOOlhar`), e fica com a média: um movimento brusco
 * da câmara leva a fronteira de uma vez para outro sítio, e sem isto as zonas
 * por onde ela passava trocavam de nível de repente.
 *
 * Por cima disso, as grelhas (ver `vigiarAsManchas`) dizem que níveis estão
 * lá e quanto: um nível só dá lugar ao outro onde todos os pedaços do
 * quadrado têm o outro; onde só está um, ele vê-se inteiro; onde nenhum
 * está, a malha fica. As árvores da malha (marcadas, ver `marcarAsManchas`) aparecem na
 * medida contrária à das manchas todas. A marca no azul é tirada aqui, e a
 * cor volta a ser a de origem.
 *
 * @param {object} material - O material de todas as manchas da cena.
 */
function ensinarAGrelhaAsManchas(material) {
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('gsplatModifyVS', `
uniform sampler2D uBairroMisto;
uniform sampler2D uBairroMenor;
uniform highp sampler2D uBairroPedacos;
uniform vec4 uBairroMistoGrelha;
uniform vec4 uBairroOlhos[${PASSOS_DO_RASTO + 1}];
uniform vec4 uBairroFrentes[${PASSOS_DO_RASTO + 1}];
uniform vec4 uBairroRasto;
uniform vec4 uBairroBalao;
void modifySplatCenter(inout vec3 center) {}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
void modifySplatColor(vec3 center, inout vec4 color) {
    vec2 uv = (center.xz - uBairroMistoGrelha.xy) * uBairroMistoGrelha.zw;
    float marca = floor(color.b);
    color.b = clamp((color.b - marca - 0.02) / 0.96, 0.0, 1.0);
    if (marca > 1.5) {
        color.a *= 1.0 - textureLod(uBairroMisto, uv, 0.0).b;
        return;
    }
    int pedaco = int(loadBairroPedaco().r);
    vec4 meu4 = pedaco > 0 ? texelFetch(uBairroPedacos, ivec2(pedaco % 64, pedaco / 64), 0) : vec4(1.0, 1.0, 0.0, 0.0);
    // Pedaço parado e por dentro, neste nível: a grelha dava 1, e nada muda.
    if ((marca > 0.5 ? meu4.a : meu4.b) > 0.5) return;
    vec4 f = textureLod(uBairroMisto, uv, 0.0);
    vec2 menor = textureLod(uBairroMenor, uv, 0.0).rg;
    f.rg = min(f.rg, meu4.rg);
    // Onde só há um nível, a faixa não conta: escusa-se a conta.
    float outro = marca > 0.5 ? menor.r : menor.g;
    float w0 = 1.0;
    float w1 = 1.0;
    if (outro > 0.0) {
        w0 = 0.0;
        w1 = 0.0;
        int quantos = int(uBairroRasto.y);
        for (int k = 0; k < quantos; k++) {
            vec3 d = center - uBairroOlhos[k].xyz;
            float aoLongo = dot(d, uBairroFrentes[k].xyz);
            float deLado2 = max(dot(d, d) - aoLongo * aoLongo, 0.0);
            float frente = aoLongo >= 0.0 ? aoLongo * uBairroBalao.x : -aoLongo * uBairroBalao.z;
            float balao = sqrt(frente * frente + deLado2 * uBairroBalao.y * uBairroBalao.y) * uBairroOlhos[k].w;
            float t = smoothstep(uBairroRasto.x * (1.0 - uBairroBalao.w), uBairroRasto.x * (1.0 + uBairroBalao.w), balao);
            w0 += uBairroFrentes[k].w * clamp((1.0 - t) / 0.6, 0.0, 1.0);
            w1 += uBairroFrentes[k].w * clamp(t / 0.6, 0.0, 1.0);
        }
    }
    if (marca > 0.5) {
        color.a *= f.g * (1.0 - menor.r * (1.0 - w1));
    } else {
        color.a *= f.r * (1.0 - menor.g * (1.0 - w0));
    }
}`);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('gsplatModifyVS', `
var uBairroMisto: texture_2d<f32>;
var uBairroMistoSampler: sampler;
var uBairroMenor: texture_2d<f32>;
var uBairroMenorSampler: sampler;
var uBairroPedacos: texture_2d<f32>;
uniform uBairroMistoGrelha: vec4f;
uniform uBairroOlhos: array<vec4f, ${PASSOS_DO_RASTO + 1}>;
uniform uBairroFrentes: array<vec4f, ${PASSOS_DO_RASTO + 1}>;
uniform uBairroRasto: vec4f;
uniform uBairroBalao: vec4f;
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    let uv = (center.xz - uniform.uBairroMistoGrelha.xy) * uniform.uBairroMistoGrelha.zw;
    let marca = floor((*color).b);
    (*color).b = clamp(((*color).b - marca - 0.02) / 0.96, 0.0, 1.0);
    if (marca > 1.5) {
        (*color).a = (*color).a * (1.0 - textureSampleLevel(uBairroMisto, uBairroMistoSampler, uv, 0.0).b);
        return;
    }
    let pedaco = i32(loadBairroPedaco().r);
    var meu4 = vec4f(1.0, 1.0, 0.0, 0.0);
    if (pedaco > 0) { meu4 = textureLoad(uBairroPedacos, vec2i(pedaco % 64, pedaco / 64), 0); }
    if (select(meu4.b, meu4.a, marca > 0.5) > 0.5) { return; }
    var f = textureSampleLevel(uBairroMisto, uBairroMistoSampler, uv, 0.0);
    let menor = textureSampleLevel(uBairroMenor, uBairroMenorSampler, uv, 0.0).rg;
    f.r = min(f.r, meu4.r);
    f.g = min(f.g, meu4.g);
    let outro = select(menor.g, menor.r, marca > 0.5);
    var w0: f32 = 1.0;
    var w1: f32 = 1.0;
    if (outro > 0.0) {
        w0 = 0.0;
        w1 = 0.0;
        let quantos = i32(uniform.uBairroRasto.y);
        for (var k: i32 = 0; k < quantos; k++) {
            let d = center - uniform.uBairroOlhos[k].xyz;
            let aoLongo = dot(d, uniform.uBairroFrentes[k].xyz);
            let deLado2 = max(dot(d, d) - aoLongo * aoLongo, 0.0);
            let frente = select(-aoLongo * uniform.uBairroBalao.z, aoLongo * uniform.uBairroBalao.x, aoLongo >= 0.0);
            let balao = sqrt(frente * frente + deLado2 * uniform.uBairroBalao.y * uniform.uBairroBalao.y) * uniform.uBairroOlhos[k].w;
            let t = smoothstep(uniform.uBairroRasto.x * (1.0 - uniform.uBairroBalao.w), uniform.uBairroRasto.x * (1.0 + uniform.uBairroBalao.w), balao);
            w0 = w0 + uniform.uBairroFrentes[k].w * clamp((1.0 - t) / 0.6, 0.0, 1.0);
            w1 = w1 + uniform.uBairroFrentes[k].w * clamp(t / 0.6, 0.0, 1.0);
        }
    }
    if (marca > 0.5) {
        (*color).a = (*color).a * f.g * (1.0 - menor.r * (1.0 - w1));
    } else {
        (*color).a = (*color).a * f.r * (1.0 - menor.g * (1.0 - w0));
    }
}`);
    material.update();
}

/**
 * Bairro misto: o que as manchas precisam de saber da câmara, a cada
 * imagem, para a faixa de passagem (ver `ensinarAGrelhaAsManchas`): onde
 * esteve e para onde olhou no último meio segundo, quanto pesa cada um desses
 * momentos, e a forma do balão e a largura da faixa — as mesmas do
 * lod-foco.mjs.
 *
 * O rasto é guardado `PASSOS_DO_RASTO` vezes por `TEMPO_DE_DESVANECER`. A
 * câmara de agora entra aos poucos, do peso zero ao inteiro, enquanto o
 * momento mais antigo sai, do inteiro ao zero; quando ela fica inteira é
 * guardada, e começa outra. Assim, por mais brusco que seja o movimento, o
 * peso de cada nível muda sempre a direito ao longo de meio segundo. Com a
 * câmara parada os momentos são todos iguais e juntam-se num só, que é o que
 * se paga a desenhar.
 *
 * @param {object} app - A aplicação 3D.
 * @param {object|null} bairro - A entidade do bairro de manchas.
 * @returns {{olhos: Float32Array, frentes: Float32Array, rasto: Float32Array, balao: Float32Array}}
 *     Os valores, refeitos antes de cada imagem: onde (e a abertura), para
 *     onde (e o peso), a distância do fino com quantos momentos contam, e a
 *     forma do balão.
 */
function acompanharOOlhar(app, bairro) {
    const olhos = new Float32Array((PASSOS_DO_RASTO + 1) * 4);
    const frentes = new Float32Array((PASSOS_DO_RASTO + 1) * 4);
    const rasto = new Float32Array([150, 1, 0, 0]);
    const balao = new Float32Array([0.5, 1 / 0.55, 2.5, 0.2]);
    frentes[2] = -1;
    frentes[3] = 1;
    olhos[3] = 1;
    const camara = app.root.findByName('camera');
    const REF = Math.tan(22.5 * Math.PI / 180);
    const PASSO = TEMPO_DE_DESVANECER / PASSOS_DO_RASTO;

    // Os momentos guardados, do mais antigo ao mais novo, cada um com onde
    // (3), a abertura e para onde (3); e há quanto tempo foi o último.
    let momentos = null;
    let fase = 0;
    let antes = 0;
    const iguais = (a, b) => {
        for (let k = 0; k < 3; k++) if (Math.abs(a[k] - b[k]) > 0.02) return false;
        if (Math.abs(a[3] - b[3]) > 0.0005) return false;
        for (let k = 4; k < 7; k++) if (Math.abs(a[k] - b[k]) > 0.0005) return false;
        return true;
    };

    app.on('prerender', () => {
        const cam = camara && camara.camera;
        if (!cam) return;
        const p = camara.getPosition();
        const fw = camara.forward;
        let tanV = Math.tan(cam.fov * 0.5 * Math.PI / 180);
        if (cam.horizontalFov) tanV /= cam.aspectRatio;
        const tanH = tanV * cam.aspectRatio;
        const agora = [p.x, p.y, p.z, Math.min(tanV, tanH) / REF, fw.x, fw.y, fw.z];

        const relogio = performance.now();
        // Uma imagem que demorou muito (ou o separador escondido) não gasta
        // a passagem toda de uma vez.
        if (!momentos) momentos = new Array(PASSOS_DO_RASTO).fill(agora);
        else fase += Math.min(relogio - antes, 100) / PASSO;
        antes = relogio;
        while (fase >= 1) {
            momentos.shift();
            momentos.push(agora);
            fase -= 1;
        }

        // Os pesos, somando os momentos iguais seguidos.
        let quantos = 0;
        let anterior = null;
        for (let k = 0; k <= PASSOS_DO_RASTO; k++) {
            const m = k < PASSOS_DO_RASTO ? momentos[k] : agora;
            const peso = (k === 0 ? 1 - fase : k === PASSOS_DO_RASTO ? fase : 1) / PASSOS_DO_RASTO;
            if (peso <= 0) continue;
            if (anterior && iguais(anterior, m)) {
                frentes[(quantos - 1) * 4 + 3] += peso;
                continue;
            }
            const o = quantos * 4;
            olhos[o] = m[0]; olhos[o + 1] = m[1]; olhos[o + 2] = m[2]; olhos[o + 3] = m[3];
            frentes[o] = m[4]; frentes[o + 1] = m[5]; frentes[o + 2] = m[6]; frentes[o + 3] = peso;
            anterior = m;
            quantos++;
        }
        rasto[1] = quantos;

        const g = bairro && bairro.gsplat;
        if (g && g.lodBaseDistance > 0) rasto[0] = g.lodBaseDistance;
        const d = window.lodFoco;
        if (d) {
            balao[0] = 1 / d.alcanceAFrente;
            balao[1] = 1 / d.apertoLateral;
            balao[2] = d.pesoAtras;
            balao[3] = d.faixa || 0;
        }
    });
    return { olhos, frentes, rasto, balao };
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
    // Bairro misto: a malha em zonas, e só as que se veem se desenham.
    const zonasDaMalha = misto ? criarZonasDaMalha() : null;
    if (zonasDaMalha) {
        // O leitor de sítios (o que diz onde se carregou, ver as câmaras)
        // desenha o bairro à parte, de uma vez, no momento em que é chamado: lê a
        // malha toda, como sempre leu.
        const prepararDeOrigem = Picker.prototype.prepare;
        Picker.prototype.prepare = function (...args) {
            zonasDaMalha.todasAVista(true);
            try {
                return prepararDeOrigem.apply(this, args);
            } finally {
                zonasDaMalha.todasAVista(false);
            }
        };
    }
    const darAGrelha = (alvo) => {
        alvo.setParameter('uBairroMisto', grelhaDasManchas.textura);
        alvo.setParameter('uBairroMenor', grelhaDasManchas.texturaMenor);
        alvo.setParameter('uBairroPedacos', grelhaDasManchas.pedacos);
        alvo.setParameter('uBairroMistoGrelha', grelhaDasManchas.parametros);
    };
    if (misto) {
        // As manchas ordenadas pela distância à câmara, e não pela
        // profundidade: assim a ordem não muda ao rodar. De outro modo, num
        // movimento brusco de lado, o que entrava no ecrã vinha mal ordenado
        // e acertava-se de repente um instante depois.
        app.scene.gsplat.radialSorting = true;
        // Um número a mais por mancha: de que pedaço ela é.
        app.scene.gsplat.format.addExtraStreams([{ name: 'bairroPedaco', format: PIXELFORMAT_R32U }]);
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
        }, zonasDaMalha);
        if (materialDasManchas) {
            darAGrelha(materialDasManchas);
            // A câmara do último meio segundo, para a faixa de passagem entre o
            // fino e o do meio: os valores mudam no sítio a cada imagem.
            const olhar = acompanharOOlhar(app, bairro);
            materialDasManchas.setParameter('uBairroOlhos[0]', olhar.olhos);
            materialDasManchas.setParameter('uBairroFrentes[0]', olhar.frentes);
            materialDasManchas.setParameter('uBairroRasto', olhar.rasto);
            materialDasManchas.setParameter('uBairroBalao', olhar.balao);
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
                // Bairro misto: a peça em zonas, cada uma desenhada só onde se vê
                // (ver `criarZonasDaMalha`). Já pendurada, para as contas da
                // posição serem as do sítio onde fica.
                if (zonasDaMalha) {
                    entidade.findComponents('render').forEach((render) => {
                        const zonas = dividirEmZonas(app.graphicsDevice, render.meshInstances.slice());
                        render.meshInstances = zonas.map((z) => z.mi);
                        zonasDaMalha.juntar(zonas);
                    });
                    zonasDaMalha.aplicar();
                }
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

    return { pronto, primeira, medir, medirBytes, raiz, zonas: zonasDaMalha };
}
