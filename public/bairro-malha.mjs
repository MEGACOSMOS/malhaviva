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
 * Como foi feita: scripts/malha/LEIA-ME.md.
 */
import { Asset, CULLFACE_NONE, Entity, Layer, WasmModule } from 'playcanvas';

const PASTA = 'malha/';

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
 * Começa a trazer a malha e pendura-a no lugar do bairro.
 *
 * @param {object} app - A aplicação 3D.
 * @param {object} [opcoes]
 * @param {number} [opcoes.anisotropia] - Nitidez do chão visto de lado.
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

    return { pronto, primeira, medir, raiz };
}
