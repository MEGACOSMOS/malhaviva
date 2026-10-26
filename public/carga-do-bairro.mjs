/**
 * Quanto do bairro já chegou.
 *
 * O ecrã de espera do bairro só sai quando estão cá todos os pedaços do
 * mapa que se veem do sítio de partida (ver `esperarPeloBairro` no
 * index.html). Esses pedaços são quase tudo o que a página traz ao abrir
 * — umas cinco dezenas de megas, contra um só do motor —, e é pelo que
 * deles já chegou que o logótipo do ecrã de espera se acende.
 *
 * O que já chegou, diz o motor: cada pedaço vem em cinco imagens, e o
 * motor avisa, à medida que elas vão chegando, quanto de cada uma já cá
 * está.
 *
 * O que vai ser preciso é mais difícil, porque o motor não pede tudo de
 * uma vez. Para cada zona do bairro decide o nível de detalhe que ela
 * merece, mas começa pelo mais grosseiro — para haver logo alguma coisa
 * no ecrã — e vai descendo um nível de cada vez até ao certo. Contar só o
 * que já foi pedido punha a luz a correr para o fim com os pedaços
 * grosseiros e a ficar parada à espera dos finos. Por isso conta-se aqui
 * o caminho inteiro que falta a cada zona, do nível que ela já tem até
 * ao que merece, tal como o motor o vai percorrer. Um pedaço que já veio
 * conta sempre — também o grosseiro que o motor larga quando chega o fino
 * —, porque foi trazido.
 *
 * Os pedaços pesam-se pelo número de manchas que levam: cada mancha ocupa
 * entre 11,9 e 13,1 bytes, em todos os pedaços dos dois bairros (o inteiro
 * e o aligeirado), e assim o peso de um pedaço sabe-se antes de ele
 * começar a chegar.
 *
 * Isto lê contas que o motor guarda lá por dentro, como o detalhe no meio
 * da vista (ver lod-foco.mjs). Se um dia o motor as guardar de outra
 * maneira, a conta diz que não sabe — e a luz espera pelo fim, sem
 * inventar.
 */

/**
 * Os mapas do bairro tal como o motor os está a usar: um por cada cena
 * de manchas, com o nível de detalhe que cada zona merece.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {object[]} As instâncias dos mapas.
 */
function mapasEmUso(app) {
    const mapas = [];
    const director = app.renderer && app.renderer.gsplatDirector;
    if (!director || !director.camerasMap) return mapas;
    for (const dadosCamera of director.camerasMap.values()) {
        if (!dadosCamera.layersMap) continue;
        for (const dadosCamada of dadosCamera.layersMap.values()) {
            const mundo = dadosCamada.gsplatManager && dadosCamada.gsplatManager.world;
            if (!mundo || !mundo._octreeInstances) continue;
            for (const instancia of mundo._octreeInstances.values()) mapas.push(instancia);
        }
    }
    return mapas;
}

/**
 * Começa a ouvir o motor e devolve a conta de quanto do bairro já chegou.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {{medir: function(): (number|null), recomecar: function()}}
 *     `medir` dá a fracção que já chegou, de zero a um, ou `null` se o
 *     motor ainda não decidiu o que vai pedir; `recomecar` esquece o que
 *     foi trazido antes, para quando o ecrã de espera volta.
 */
export function medirACargaDoBairro(app) {
    const eBocado = (asset) => !!asset &&
        asset.type === 'gsplat' &&
        !!asset.file && typeof asset.file.url === 'string' &&
        !asset.file.url.endsWith('lod-meta.json');

    // Quanto de cada pedaço já chegou, de zero a um, como o motor o diz.
    const chegou = new Map();
    // Os pedaços que o motor pediu desde que o ecrã de espera apareceu.
    let trazidos = new Set();

    const ouvir = (asset) => {
        if (!eBocado(asset)) return;
        const endereco = asset.file.url;
        asset.on('progress', (veio, total) => {
            if (total > 0) chegou.set(endereco, Math.min(1, veio / total));
        });
        asset.on('load', () => chegou.set(endereco, 1));
    };
    app.assets.list().forEach(ouvir);
    app.assets.on('add', ouvir);

    // Quantas manchas leva cada pedaço de um mapa, contadas uma vez.
    const manchasDoMapa = new WeakMap();
    const pesos = (octree) => {
        let contas = manchasDoMapa.get(octree);
        if (contas) return contas;
        const manchas = new Map();
        const indice = new Map();
        octree.files.forEach((ficheiro, i) => { manchas.set(ficheiro.url, 0); indice.set(ficheiro.url, i); });
        for (const no of octree.nodes) {
            for (const nivel of no.lods) {
                if (nivel.fileIndex < 0) continue;
                const endereco = octree.files[nivel.fileIndex].url;
                manchas.set(endereco, manchas.get(endereco) + nivel.count);
            }
        }
        contas = { manchas, indice };
        manchasDoMapa.set(octree, contas);
        return contas;
    };

    function medir() {
        const mapas = mapasEmUso(app);
        let decidido = false;
        let total = 0;
        let veio = 0;

        for (const mapa of mapas) {
            const octree = mapa.octree;
            const infos = mapa.nodeInfos;
            if (!octree || !octree.nodes || !octree.files || !infos ||
                typeof octree.getFileResource !== 'function') continue;
            const { manchas, indice } = pesos(octree);
            const maisGrosso = octree.lodLevels - 1;
            const recurso = (app.scene.gsplat && app.scene.gsplat.lodUnderfillLimit) || 0;

            // Os pedaços que ainda faltam: para cada zona, os níveis entre
            // o que ela merece e o mais fino que já cá tem (ou, sem nenhum,
            // o mais grosseiro que o motor lhe dá enquanto espera).
            const precisos = new Set();
            for (let i = 0; i < octree.nodes.length; i++) {
                const merece = infos[i] ? infos[i].optimalLod : -1;
                if (!(merece >= 0)) continue;
                decidido = true;
                const niveis = octree.nodes[i].lods;
                const ultimo = Math.min(maisGrosso, merece + recurso);
                let jaTem = -1;
                for (let n = merece; n <= ultimo; n++) {
                    const fi = niveis[n] ? niveis[n].fileIndex : -1;
                    if (fi >= 0 && octree.getFileResource(fi)) { jaTem = n; break; }
                }
                const ate = jaTem === -1 ? ultimo : jaTem - 1;
                for (let n = merece; n <= ate; n++) {
                    const fi = niveis[n] ? niveis[n].fileIndex : -1;
                    if (fi >= 0) precisos.add(octree.files[fi].url);
                }
            }

            // E os que já foram pedidos, cheguem ou não a ficar.
            for (const asset of app.assets.list()) {
                if (eBocado(asset) && indice.has(asset.file.url)) trazidos.add(asset.file.url);
            }

            for (const endereco of new Set([...precisos, ...trazidos])) {
                if (!indice.has(endereco)) continue;
                const peso = manchas.get(endereco) || 0;
                const asset = app.assets.getByUrl(endereco);
                let parte = chegou.get(endereco) || 0;
                if (asset && asset.loaded) parte = 1;
                // Um pedaço que se volta a precisar depois de largado vem
                // outra vez desde o princípio.
                else if (precisos.has(endereco) && !asset) parte = 0;
                total += peso;
                veio += peso * parte;
            }
        }

        if (!decidido) return null;
        // Com tudo o que é preciso já cá, não falta nada.
        if (total <= 0) return 1;
        return veio / total;
    }

    function recomecar() {
        trazidos = new Set();
    }

    return { medir, recomecar };
}
