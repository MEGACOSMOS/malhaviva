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

// O que pesa uma mancha, em média, em bytes (ver acima: entre 11,9 e 13,1).
const BYTES_POR_MANCHA = 12.5;

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
 * @returns {{medir: function(): (number|null), recomecar: function(), trazerTudo: function()}}
 *     `medir` dá a fracção que já chegou, de zero a um, ou `null` se o
 *     motor ainda não decidiu o que vai pedir; `recomecar` esquece o que
 *     foi trazido antes, para quando o ecrã de espera volta; `trazerTudo`
 *     traz o bairro inteiro de uma vez (o modo Alto).
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
        const conta = contar();
        if (!conta) return null;
        // Com tudo o que é preciso já cá, não falta nada.
        if (conta.total <= 0) return 1;
        return conta.veio / conta.total;
    }

    // O mesmo em bytes (contados pelas manchas), para o bairro misto, que
    // soma a esta conta a da malha: `null` se o motor ainda não decidiu.
    function medirBytes() {
        const conta = contar();
        if (!conta) return null;
        return { veio: conta.veio * BYTES_POR_MANCHA, total: conta.total * BYTES_POR_MANCHA };
    }

    function contar() {
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
            // No bairro misto pode não haver pedaço nenhum que mereça
            // manchas (vê-se tudo de longe, em malha): mesmo assim o motor
            // já decidiu, se a conta do balão já correu (lod-foco.mjs).
            if (mapa.focoDiagnostico) decidido = true;
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
            // Com o bairro inteiro pedido, é preciso tudo o que ainda não veio.
            if (tudo) {
                octree.files.forEach((ficheiro, i) => {
                    if (tudo.serve(ficheiro) && !octree.getFileResource(i)) precisos.add(ficheiro.url);
                });
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
        return { veio, total };
    }

    function recomecar() {
        trazidos = new Set();
    }

    // O bairro inteiro, se foi pedido (ver `trazerTudo`).
    let tudo = null;

    /**
     * Traz o bairro inteiro de uma vez — todos os pedaços dos níveis que se
     * usam — e segura-o na memória: depois disso não falta vir mais nada,
     * ande-se por onde se andar, e passa-se do Médio ao Alto e do Alto ao
     * Médio sem esperar.
     *
     * O motor larga cada pedaço que deixa de usar, ao fim de um instante.
     * Aqui conta-se como mais um a usá-los (é a conta dele, a das
     * referências de cada ficheiro), e por isso ficam.
     *
     * Pedido outra vez enquanto vale, é o mesmo.
     *
     * @param {object} [opcoes]
     * @param {number} [opcoes.niveis] - Quantos níveis, a contar do mais fino.
     * @param {number} [opcoes.aoMesmoTempo] - Quantos pedaços se trazem ao
     *     mesmo tempo. O motor traz dois; com mais aproveita-se a ligação
     *     toda, mas a câmara fica aos soluços: é para quando há um ecrã de
     *     espera por cima.
     * @returns {{pronto: function(): boolean, medir: function(): (number|null),
     *     serve: function(object): boolean, soltar: function(): void}}
     *     `pronto` diz se já cá está tudo (um pedaço que falhou de vez não
     *     conta: no lugar dele fica o que houver); `medir` a fracção do que
     *     faltava que já veio, ou `null` se ainda não se sabe; `soltar`
     *     desiste e larga o que não está a ser usado.
     */
    function trazerTudo({ niveis = 2, aoMesmoTempo = 2 } = {}) {
        if (tudo) {
            tudo.apressar(aoMesmoTempo);
            return tudo;
        }
        let octree = null;
        let presos = [];
        let faltavam = null;
        let quadro = 0;
        let limiteDeOrigem = 2;
        let limite = aoMesmoTempo;
        const serve = (ficheiro) => ficheiro.lodLevel >= 0 && ficheiro.lodLevel < niveis;

        const falhou = (i) => !!(octree.assetLoader && octree.assetLoader.hasFailed &&
            octree.assetLoader.hasFailed(octree.files[i].url));
        const pronto = () => !!octree && presos.every((i) => octree.getFileResource(i) || falhou(i));

        const porLimite = (n) => {
            const quemTraz = octree && octree.assetLoader;
            if (!quemTraz || !('maxConcurrentLoads' in quemTraz)) return;
            quemTraz.maxConcurrentLoads = n;
            if (typeof quemTraz._processQueue === 'function') quemTraz._processQueue();
        };

        const passo = () => {
            if (!octree) {
                const mapa = mapasEmUso(app).find((m) => m.octree && m.octree.files &&
                    typeof m.octree.incRefCount === 'function' &&
                    typeof m.octree.ensureFileResource === 'function');
                if (!mapa) return;
                octree = mapa.octree;
                const { manchas } = pesos(octree);
                faltavam = new Map();
                octree.files.forEach((ficheiro, i) => {
                    if (!serve(ficheiro)) return;
                    if (!octree.getFileResource(i)) faltavam.set(ficheiro.url, manchas.get(ficheiro.url) || 0);
                    octree.incRefCount(i);
                    presos.push(i);
                });
                if (octree.assetLoader && octree.assetLoader.maxConcurrentLoads > 0) {
                    limiteDeOrigem = octree.assetLoader.maxConcurrentLoads;
                }
                porLimite(Math.max(limite, limiteDeOrigem));
            }
            // De dez em dez imagens, como o motor faz: pede o que falta, e
            // arruma o que chegou.
            if (quadro++ % 10) return;
            let falta = false;
            for (const i of presos) {
                if (octree.getFileResource(i) || falhou(i)) continue;
                falta = true;
                octree.ensureFileResource(i);
            }
            if (!falta) {
                app.off('update', passo);
                porLimite(limiteDeOrigem);
            }
        };
        app.on('update', passo);

        function medirOQueFaltava() {
            if (!faltavam) return null;
            let total = 0;
            let veio = 0;
            for (const [endereco, peso] of faltavam) {
                const asset = app.assets.getByUrl(endereco);
                const i = pesos(octree).indice.get(endereco);
                const parte = octree.getFileResource(i) || falhou(i) || (asset && asset.loaded)
                    ? 1 : (chegou.get(endereco) || 0);
                total += peso;
                veio += peso * parte;
            }
            return total > 0 ? veio / total : 1;
        }

        tudo = {
            serve,
            pronto,
            medir: medirOQueFaltava,
            apressar(n) {
                limite = Math.max(limite, n);
                if (octree && !pronto()) porLimite(Math.max(limite, limiteDeOrigem));
            },
            soltar() {
                app.off('update', passo);
                if (octree) {
                    porLimite(limiteDeOrigem);
                    presos.forEach((i) => octree.decRefCount(i, octree.cooldownTicks));
                }
                presos = [];
                tudo = null;
            }
        };
        return tudo;
    }

    return { medir, medirBytes, recomecar, trazerTudo };
}
