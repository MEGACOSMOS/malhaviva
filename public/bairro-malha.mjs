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
    PIXELFORMAT_R8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE,
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, WORKBUFFER_UPDATE_ONCE
} from 'playcanvas';

const PASTA = 'malha/';

// Bairro misto: o lado de cada quadrado da grelha que diz onde já há
// manchas, em metros.
const CELULA = 1;

// Quanto cada pedaço de manchas alarga para lá da caixa dele na grelha, em
// metros: entre dois pedaços vizinhos há às vezes uma frincha, e por ela via-se
// a malha. Pouco: para lá da caixa já não há manchas dele, e onde a malha sai
// sem manchas por cima fica preto.
const ALARGAMENTO = 0.25;

// Um pedaço chegado ainda é arrumado e ordenado ao longo de umas quantas
// imagens antes de aparecer: tirada a malha logo, ficava um buraco preto
// nesse instante. Por isso a malha só lhe sai de baixo quando o motor diz
// que já desenha tudo o que tem (ver `mundoEmDia`), e nunca antes de um
// instante mínimo; se o motor não o disser, ao fim de um instante máximo.
// Em milissegundos.
const ESPERA_MINIMA_AO_ENTRAR = 120;
const ESPERA_MAXIMA_AO_ENTRAR = 1500;

// De quanto em quanto tempo, no máximo, se refaz a grelha quando entram
// pedaços. Quando sai algum, refaz-se logo: aí cada instante de atraso é um
// buraco preto.
const INTERVALO_DA_GRELHA = 120;

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
 * Se o motor já desenha tudo o que tem: cada mudança nos pedaços faz uma
 * versão nova do bairro, e ela só aparece depois de ordenada. Enquanto a
 * versão desenhada não for a última, há pedaços chegados que ainda não se
 * veem. `null` se o motor não o disser.
 *
 * @param {object} mundo - O gestor que desenha as manchas.
 * @returns {boolean|null}
 */
function mundoEmDia(mundo) {
    if (typeof mundo.currentVersion !== 'number' || typeof mundo.lastWorldStateVersion !== 'number') return null;
    return mundo.currentVersion === mundo.lastWorldStateVersion;
}

/**
 * Bairro misto: vigia que pedaços das manchas estão desenhados e mantém
 * uma grelha, vista de cima, com os quadrados onde estão. A malha e as
 * árvores dela não se pintam nesses quadrados.
 *
 * Um quadrado só conta quando todos os pedaços que lhe passam por cima
 * estão desenhados: numa coluna com um pedaço desenhado e outro não (um
 * telhado e o chão por baixo, na fronteira do anel), a malha fica, e por
 * cima dela as manchas que houver. E só conta depois de o pedaço estar
 * mesmo no ecrã (ver `ESPERA_MINIMA_AO_ENTRAR`); ao sair, deixa de contar
 * logo. Assim nunca há buraco: onde as manchas ainda não chegaram, ou já se
 * foram, está a malha.
 *
 * @param {object} app - A aplicação 3D.
 * @param {function(object): void} aoMudar - Chamada com a grelha nova
 *     (`{textura, parametros}`) sempre que ela muda.
 * @returns {{textura: Texture, parametros: Float32Array}} A grelha de agora.
 */
function vigiarAsManchas(app, aoMudar) {
    const camara = app.root.findByName('camera');
    const dispositivo = app.graphicsDevice;

    const criarTextura = (largura, altura, nome) => new Texture(dispositivo, {
        name: nome,
        width: largura,
        height: altura,
        format: PIXELFORMAT_R8,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });

    // Antes de haver mapa, um quadrado só, vazio: a malha inteira.
    const vazia = criarTextura(1, 1, 'bairroMistoVazio');
    vazia.lock().set(new Uint8Array([0]));
    vazia.unlock();
    // origem X, origem Z, 1 / largura e 1 / altura da grelha, em metros.
    let atual = { textura: vazia, parametros: new Float32Array([0, 0, 1, 1]) };

    let instancia = null;
    let mundo = null;
    let grelha = null;
    let desde = null;
    let quadroDesde = null;
    let cobre = null;
    let tapa = null;
    let sujo = false;
    let ultimaGrelha = 0;
    let quadro = 0;

    // A caixa de cada pedaço, vista de cima, em quadrados da grelha: a
    // alargada (onde ele conta como desenhado) e a justa (onde, não estando
    // desenhado, impede o quadrado de contar).
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
        const textura = criarTextura(colunas, linhas, 'bairroMisto');
        return {
            nos, colunas, linhas, alargada, justa, textura,
            dados: new Uint8Array(colunas * linhas),
            parametros: new Float32Array([origemX, origemZ, 1 / (colunas * CELULA), 1 / (linhas * CELULA)])
        };
    }

    function pintar(caixa, i, valor) {
        const { colunas, dados } = grelha;
        const i0 = caixa[i * 4], i1 = caixa[i * 4 + 1];
        const j0 = caixa[i * 4 + 2], j1 = caixa[i * 4 + 3];
        for (let j = j0; j <= j1; j++) {
            dados.fill(valor, j * colunas + i0, j * colunas + i1 + 1);
        }
    }

    function refazerGrelha() {
        grelha.dados.fill(0);
        for (let i = 0; i < grelha.nos; i++) if (cobre[i]) pintar(grelha.alargada, i, 255);
        for (let i = 0; i < grelha.nos; i++) if (tapa[i]) pintar(grelha.justa, i, 0);
        grelha.textura.lock().set(grelha.dados);
        grelha.textura.unlock();
    }

    app.on('prerender', () => {
        quadro++;
        const achado = mapaDasManchas(app, camara);
        const mapa = achado ? achado.instancia : null;
        mundo = achado ? achado.mundo : null;
        if (mapa !== instancia) {
            instancia = mapa;
            if (grelha) grelha.textura.destroy();
            grelha = mapa ? medirGrelha(mapa) : null;
            if (grelha) {
                desde = new Float64Array(grelha.nos);
                quadroDesde = new Uint32Array(grelha.nos);
                cobre = new Uint8Array(grelha.nos);
                tapa = new Uint8Array(grelha.nos).fill(1);
                refazerGrelha();
                atual = { textura: grelha.textura, parametros: grelha.parametros };
            } else {
                atual = { textura: vazia, parametros: new Float32Array([0, 0, 1, 1]) };
            }
            aoMudar(atual);
        }
        if (!grelha) return;

        const agora = performance.now();
        const emDia = mundoEmDia(mundo);
        const infos = instancia.nodeInfos;
        let saiu = false;
        for (let i = 0; i < grelha.nos; i++) {
            const desenhado = !!infos[i] && infos[i].currentLod >= 0;
            if (!desenhado) {
                desde[i] = 0;
            } else if (!desde[i]) {
                desde[i] = agora;
                quadroDesde[i] = quadro;
            }
            // Já no ecrã: o motor está em dia desde uma imagem depois de o
            // pedaço ter chegado (a versão com ele já foi feita e ordenada).
            const espera = agora - desde[i];
            const jaSeVe = emDia === null
                ? espera >= ESPERA_MAXIMA_AO_ENTRAR / 4
                : (emDia && quadro > quadroDesde[i] + 1) || espera >= ESPERA_MAXIMA_AO_ENTRAR;
            const passaACobrir = desenhado && espera >= ESPERA_MINIMA_AO_ENTRAR && jaSeVe ? 1 : 0;
            const passaATapar = desenhado ? 0 : 1;
            if (passaACobrir !== cobre[i] || passaATapar !== tapa[i]) {
                if (passaATapar && !tapa[i]) saiu = true;
                cobre[i] = passaACobrir;
                tapa[i] = passaATapar;
                sujo = true;
            }
        }
        if (sujo && (saiu || agora - ultimaGrelha >= INTERVALO_DA_GRELHA)) {
            sujo = false;
            ultimaGrelha = agora;
            refazerGrelha();
            aoMudar(atual);
        }
    });

    return atual;
}

/**
 * Ensina a um material da malha a não se pintar onde a grelha das
 * manchas diz que elas já estão.
 *
 * @param {object} material - Um material da malha.
 */
function ensinarAGrelha(material) {
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('litUserDeclarationPS', `
uniform sampler2D uBairroMisto;
uniform vec4 uBairroMistoGrelha;
`);
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set('litUserMainStartPS', `
    if (texture(uBairroMisto, (vPositionW.xz - uBairroMistoGrelha.xy) * uBairroMistoGrelha.zw).r > 0.5) {
        discard;
    }
`);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('litUserDeclarationPS', `
var uBairroMisto: texture_2d<f32>;
var uBairroMistoSampler: sampler;
uniform uBairroMistoGrelha: vec4f;
`);
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set('litUserMainStartPS', `
    if (textureSampleLevel(uBairroMisto, uBairroMistoSampler, (vPositionW.xz - uniform.uBairroMistoGrelha.xy) * uniform.uBairroMistoGrelha.zw, 0.0).r > 0.5) {
        discard;
    }
`);
    material.shaderChunksVersion = '2.21';
}

/**
 * O mesmo, para as árvores em manchas da malha: onde as manchas do bairro
 * já estão, as árvores são as delas, e estas apagam-se. A conta é feita
 * quando as manchas das árvores são arrumadas para desenhar, e por isso é
 * refeita (`WORKBUFFER_UPDATE_ONCE`) sempre que a grelha muda.
 *
 * @param {object} componente - O componente de manchas das árvores.
 */
function ensinarAGrelhaAsArvores(componente) {
    const glsl = `
uniform sampler2D uBairroMisto;
uniform vec4 uBairroMistoGrelha;
void modifySplatCenter(inout vec3 center) {}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
void modifySplatColor(vec3 center, inout vec4 color) {
    if (texture(uBairroMisto, (center.xz - uBairroMistoGrelha.xy) * uBairroMistoGrelha.zw).r > 0.5) color.a = 0.0;
}`;
    const wgsl = `
var uBairroMisto: texture_2d<f32>;
var uBairroMistoSampler: sampler;
uniform uBairroMistoGrelha: vec4f;
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    if (textureSampleLevel(uBairroMisto, uBairroMistoSampler, (center.xz - uniform.uBairroMistoGrelha.xy) * uniform.uBairroMistoGrelha.zw, 0.0).r > 0.5) {
        (*color).a = 0.0;
    }
}`;
    componente.setWorkBufferModifier({ glsl, wgsl });
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

    // Bairro misto: a grelha de onde as manchas já estão, entregue a cada
    // material da malha e às árvores, e de novo sempre que muda.
    const misto = !!opcoes.misto;
    const materiaisMistos = new Set();
    let arvoresMistas = null;
    let grelhaDasManchas = null;
    const darAGrelha = (alvo) => {
        alvo.setParameter('uBairroMisto', grelhaDasManchas.textura);
        alvo.setParameter('uBairroMistoGrelha', grelhaDasManchas.parametros);
    };
    if (misto) {
        grelhaDasManchas = vigiarAsManchas(app, (grelha) => {
            grelhaDasManchas = grelha;
            materiaisMistos.forEach(darAGrelha);
            if (arvoresMistas) {
                darAGrelha(arvoresMistas);
                arvoresMistas.workBufferUpdate = WORKBUFFER_UPDATE_ONCE;
            }
        });
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
                if (misto) {
                    ensinarAGrelhaAsArvores(arvores.gsplat);
                    arvoresMistas = arvores.gsplat;
                    darAGrelha(arvoresMistas);
                }
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
