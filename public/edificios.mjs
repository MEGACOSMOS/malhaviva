import {
    Color, Entity, Layer, Mesh, MeshInstance, StandardMaterial,
    PRIMITIVE_TRIANGLES, DITHER_BAYER8, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from 'playcanvas';

/**
 * Os prédios à volta do bairro, em blocos simples.
 *
 * O bairro em manchas acaba onde o voo do drone acabou, e para lá dele o
 * mapa ficava às escuras até à fotografia do céu — o bairro parecia uma
 * ilha. À volta dele há uma cidade: os prédios de Almada, o hospital, as
 * escolas. Ficam aqui como uma maquete: volumes lisos, cor de betão
 * claro, sem pormenor, para se perceber onde o bairro está sem competirem
 * com ele.
 *
 * Os volumes foram medidos, não adivinhados (ver scripts/edificios):
 *  - a altura de cada telhado e do chão à volta vêm do voo LiDAR de 2024
 *    da Direção-Geral do Território, que mede a superfície do país com
 *    laser a cada meio metro;
 *  - as plantas vêm do OpenStreetMap, e as que lá faltam do próprio
 *    LiDAR.
 * Um prédio com partes de alturas diferentes fica em degraus.
 *
 * O ficheiro traz os vértices já na posição do mapa e a cor já sombreada
 * (paredes viradas ao sol mais claras, pé das paredes mais escuro, e um
 * esbatimento para o fundo à medida que se afastam). Aqui é só pô-los no
 * motor: um desenho só, sem luzes, sem contas a cada imagem.
 *
 * São desenhados por cima da cúpula do céu, numa camada que vem logo a
 * seguir a ela. A cúpula tem 430 metros de raio e é desenhada à distância
 * a que está: prédios mais longe do que isso ficariam tapados por ela, e
 * com o fundo dela, que é chato, também os que assentam abaixo dele. O
 * bairro em manchas é desenhado depois, por cima, e respeita-os: o que
 * fica atrás de um prédio não se vê.
 *
 * Só são trazidos depois de o bairro estar à vista, para não roubarem um
 * byte ao arranque — e só se estiverem ligados: quem os desligou nas
 * definições não os descarrega, a não ser que os volte a ligar.
 */

const PASTA = '/edificios/';
const VERSAO = 2;

// Até onde, em metros, um prédio perto da câmara ainda se desfaz: a esta
// distância está inteiro, a menos de dois terços dela já sumiu.
const DISTANCIA_A_QUE_SOMEM = 170;

/**
 * Liga os prédios ao mapa.
 *
 * @param {object} app - A aplicação 3D.
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.ligado=true] - Se aparecem logo (a caixa
 *   "Edifícios" das definições).
 * @returns {object} Comandos: `ligado(sim)` para os mostrar ou esconder.
 */
export function ligarEdificios(app, { ligado: ligadoAoInicio = true } = {}) {
    let entidade = null;
    let mostrar = !!ligadoAoInicio;
    let aCaminho = null;

    function quandoOBairroEstiverAVista() {
        const ecra = document.getElementById('loading-overlay');
        if (!ecra || ecra.classList.contains('hidden')) return Promise.resolve();
        return new Promise((resolve) => {
            const vigia = new MutationObserver(() => {
                if (ecra.classList.contains('hidden')) {
                    vigia.disconnect();
                    resolve();
                }
            });
            vigia.observe(ecra, { attributes: true, attributeFilter: ['class'] });
        });
    }

    function criarCamada() {
        const camadas = app.scene.layers;
        let camada = camadas.getLayerByName('Edificios');
        if (camada) return camada;
        camada = new Layer({ name: 'Edificios' });
        const ceu = camadas.getLayerByName('Skybox');
        const depoisDoCeu = ceu ? camadas.getOpaqueIndex(ceu) + 1 : camadas.layerList.length;
        camadas.insertOpaque(camada, depoisDoCeu);
        // Todas as câmaras que desenham o mundo passam a desenhar também
        // esta camada (a do mapa e a dos óculos de VR, que é a mesma).
        const mundo = camadas.getLayerByName('World');
        app.root.findComponents('camera').forEach((camara) => {
            if (mundo && camara.layers.indexOf(mundo.id) === -1) return;
            if (camara.layers.indexOf(camada.id) === -1) {
                camara.layers = camara.layers.concat([camada.id]);
            }
        });
        return camada;
    }

    async function carregar() {
        const [meta, dados] = await Promise.all([
            fetch(PASTA + 'edificios.json?v=' + VERSAO).then((r) => {
                if (!r.ok) throw new Error('edificios.json ' + r.status);
                return r.json();
            }),
            fetch(PASTA + 'edificios.bin?v=' + VERSAO).then((r) => {
                if (!r.ok) throw new Error('edificios.bin ' + r.status);
                return r.arrayBuffer();
            })
        ]);

        const nv = meta.vertices;
        const ni = meta.triangulos * 3;
        // Posições guardadas em 16 bits por eixo (2–3 cm de passo nos
        // 1,5 km que cobrem), e desfeitas aqui.
        const q = new Uint16Array(dados, 0, nv * 3);
        const posicoes = new Float32Array(nv * 3);
        const [mx, my, mz] = meta.minimo;
        const [ex, ey, ez] = meta.escala;
        for (let i = 0; i < nv; i++) {
            posicoes[i * 3] = mx + q[i * 3] * ex;
            posicoes[i * 3 + 1] = my + q[i * 3 + 1] * ey;
            posicoes[i * 3 + 2] = mz + q[i * 3 + 2] * ez;
        }
        const cores = new Uint8Array(dados, nv * 6, nv * 4);
        const inicio = nv * 10;
        const indices = meta.indices32 ?
            new Uint32Array(dados.slice(inicio, inicio + ni * 4)) :
            new Uint16Array(dados.slice(inicio, inicio + ni * 2));

        const malha = new Mesh(app.graphicsDevice);
        malha.setPositions(posicoes);
        malha.setColors32(cores);
        malha.setIndices(indices);
        malha.update(PRIMITIVE_TRIANGLES);

        // Sem luz: a sombra já vem na cor de cada vértice.
        const material = new StandardMaterial();
        material.name = 'edificios';
        material.useLighting = false;
        material.useSkybox = false;
        material.useFog = false;
        material.useTonemap = false;
        material.diffuse = new Color(0, 0, 0);
        material.emissive = new Color(1, 1, 1);
        material.emissiveVertexColor = true;
        material.vertexColorGamma = true;
        // Perto da câmara, os prédios desfazem-se em pontinhos até sumirem:
        // a câmara de abertura fica mesmo por cima dos prédios a sul do
        // bairro, e quem anda pela orla passa rente a outros. A maquete
        // nunca se pode pôr à frente do bairro. Pontinhos, e não
        // transparência a sério, para não ser preciso ordenar nada.
        material.opacityDither = DITHER_BAYER8;
        material.getShaderChunks(SHADERLANGUAGE_GLSL).set('opacityPS', `
uniform float material_opacity;
uniform float material_alphaDitherScale;
uniform vec4 uEdificiosPerto;
void getOpacity() {
    float d = distance(vPositionW, uEdificiosPerto.xyz);
    dAlpha = material_opacity * smoothstep(uEdificiosPerto.w * 0.65, uEdificiosPerto.w, d);
}`);
        material.getShaderChunks(SHADERLANGUAGE_WGSL).set('opacityPS', `
uniform material_opacity: f32;
uniform material_alphaDitherScale: f32;
uniform uEdificiosPerto: vec4f;
fn getOpacity() {
    let d = distance(vPositionW, uniform.uEdificiosPerto.xyz);
    dAlpha = uniform.material_opacity * smoothstep(uniform.uEdificiosPerto.w * 0.65, uniform.uEdificiosPerto.w, d);
}`);
        material.shaderChunksVersion = '2.8';
        material.update();

        const camara = app.root.findByName('camera');
        const perto = new Float32Array([0, 0, 0, DISTANCIA_A_QUE_SOMEM]);
        app.on('prerender', () => {
            if (!camara || !entidade || !entidade.enabled) return;
            const p = camara.getPosition();
            perto[0] = p.x; perto[1] = p.y; perto[2] = p.z;
            material.setParameter('uEdificiosPerto', perto);
        });

        const camada = criarCamada();
        entidade = new Entity('edificios');
        entidade.addComponent('render', {
            meshInstances: [new MeshInstance(malha, material)],
            layers: [camada.id],
            castShadows: false,
            receiveShadows: false
        });
        entidade.enabled = mostrar;
        app.root.addChild(entidade);
    }

    /** Traz os prédios, uma vez só; se falhar, tenta-se de novo ao religar. */
    function trazer() {
        if (aCaminho) return;
        aCaminho = quandoOBairroEstiverAVista()
            .then(carregar)
            .catch((e) => {
                aCaminho = null;
                console.warn('Prédios à volta do bairro: não foi possível pô-los no mapa.', e);
            });
    }

    if (mostrar) trazer();

    return {
        ligado(sim) {
            mostrar = !!sim;
            if (entidade) entidade.enabled = mostrar;
            else if (mostrar) trazer();
        },
        get entidade() {
            return entidade;
        }
    };
}
