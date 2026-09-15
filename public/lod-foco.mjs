import { math } from 'playcanvas';

/**
 * Detalhe do mapa concentrado no meio da vista.
 *
 * O motor escolhe o nível de detalhe de cada pedaço do bairro pela
 * distância à câmara, como se a nitidez fosse uma bola à volta dela: um
 * pedaço a cinquenta metros conta o mesmo esteja no meio do ecrã, num
 * canto, debaixo dos pés ou atrás das costas. Só uma fatia dessa bola é
 * que se vê, e a fatia que se olha mesmo — o meio do ecrã — não tem
 * direito a mais do que os cantos.
 *
 * Aqui a bola passa a ser um balão alongado no sentido do olhar: ao
 * meio da vista o detalhe fino vai ao dobro da distância, para os lados
 * e para cima e para baixo encolhe, e para trás das costas quase não vai.
 * A conta continua a partir da câmara, e não de um ponto à frente dela
 * — foi assim que uma versão antiga deixou o chão em volta de quem
 * passeava cheio de manchas grosseiras. O que está perto fica sempre
 * nítido; o que muda é até onde a nitidez chega em cada direcção.
 *
 * O balão custa as mesmas manchas que a bola custava: em cada vista
 * conta-se quanto a bola gastaria, e o balão é encolhido ou esticado até
 * gastar isso mesmo — o detalhe que se poupa nos cantos, atrás das costas
 * e fora do ecrã é o que paga a distância a mais ao meio. Nos níveis com
 * tecto de manchas, o tecto continua a mandar; só a forma é que muda.
 *
 * Três cuidados mantêm a mudança barata:
 *
 *  - o que fica fora do ecrã — para lá de uma folga de alguns graus —
 *    desce um nível, e não mais: quando a vista roda e o pedaço entra
 *    no ecrã, é um degrau só a subir;
 *  - um pedaço à beira da fronteira entre dois níveis não anda a saltar
 *    de um para o outro a cada pequeno abanão da câmara — só muda quando
 *    passa a fronteira com alguma folga;
 *  - a rodar a vista sem sair do sítio, o detalhe é reavaliado no máximo
 *    umas três vezes por segundo, para o mapa não estar sempre a ser
 *    reconstruído a meio de um arrasto. Andar continua a reavaliar como
 *    sempre reavaliou.
 */

// Quantas vezes mais longe chega o detalhe fino ao meio da vista.
const ALCANCE_A_FRENTE = 2;

// Quanto encolhe para os lados (e para cima e para baixo). Um valor de
// 0.55 é um pouco menos de metade: os cantos do ecrã perdem um quarto do
// alcance, e o que está mesmo de lado perde quase metade.
const APERTO_LATERAL = 0.55;

// Quanto encolhe para trás das costas.
const PESO_ATRAS = 2.5;

// Folga, em graus, à volta do que cabe no ecrã. Dentro dela nada muda;
// para lá dela o pedaço desce um nível.
const MARGEM_FORA_DO_ECRA = 15;

// Quanto um pedaço tem de passar da fronteira entre dois níveis, em
// fracção da distância, para trocar de nível.
const HISTERESE = 0.05;

// Quantos graus a câmara tem de rodar para o detalhe ser recalculado.
// De origem o motor só reagia a deslocações; agora que a direcção do
// olhar manda no detalhe, a rotação também tem de contar.
const ANGULO_DE_ATUALIZACAO = 3;

// A rodar sem andar, quanto tempo passa no mínimo entre duas
// reavaliações, em milissegundos.
const INTERVALO_ENTRE_ROTACOES = 300;

// Quantos níveis mais grosseiros podem servir de tapa-buracos enquanto a
// versão nítida ainda está a chegar. Sem isto, virar a cabeça abriria
// vazios momentâneos onde o detalhe novo ainda não carregou.
const NIVEIS_DE_RECURSO = 2;

// Até onde a régua das distâncias pode ser apertada para caber no tecto
// de pontos. É um travão de segurança: sem ele, um engano nas contas
// podia encolher o detalhe até não sobrar nada.
const ESCALA_MINIMA_DO_TECTO = 0.05;

// Sem tecto de manchas, quanto o balão pode ser encolhido (para não custar
// mais do que a bola) ou esticado (para gastar o que a bola gastava fora
// do ecrã), e em quantas voltas de bissecção se acerta o tamanho.
const ENCOLHIMENTO_MAXIMO = 16;
const ENCOLHIMENTO_MINIMO = 0.5;
const VOLTAS_DA_BISSECCAO = 12;

// A abertura de referência do motor: as distâncias são medidas como se a
// câmara tivesse sempre esta abertura, para o zoom não mudar o detalhe.
const REF_TAN_HALF_FOV = Math.tan(22.5 * math.DEG_TO_RAD);

// Quantas gavetas de distância o repartidor do tecto usa.
const NUM_BUCKETS = 64;

/**
 * Tira ao tecto de pontos o hábito de comer o nível de detalhe do meio.
 *
 * Quando há tecto de pontos (níveis Médio e Baixo), o motor cumpre-o de
 * duas maneiras. Uma é boa: aperta ou alarga as distâncias a que cada
 * nível começa, e as três faixas — fina, média e grosseira — encolhem ou
 * crescem juntas, mantendo a passagem suave. A outra é gulosa: percorre os
 * pedaços do mapa e vai empurrando cada um, à vez, para o nível seguinte,
 * até as contas fecharem.
 *
 * A segunda estraga o degradé, e é por isso que se via o mapa saltar do
 * detalhe fino para o mais grosseiro sem nada pelo meio: numa vista larga,
 * a faixa média chegava a ficar reduzida a uma tira de nove metros, com
 * dezoito pedaços apenas. Acontece que empurrar pedaços um a um não
 * distingue o que está a dois passos do que está a duzentos metros — só
 * conta manchas.
 *
 * Aqui a segunda maneira é substituída pela primeira: quando se passa do
 * tecto, em vez de se empurrarem pedaços soltos, aperta-se a régua toda,
 * e a avaliação seguinte — uma fracção de segundo depois — já cabe. Nas
 * mesmas vistas, a faixa média volta a ter centenas de pedaços espalhados
 * por uma centena de metros, e continua a caber no tecto.
 *
 * @param {object} mundo - O gestor interno de mapas do motor.
 */
function corrigirRepartidorDoTecto(mundo) {
    const repartidor = mundo && mundo._budgetBalancer;
    if (!repartidor) return;

    repartidor.mundoDoTecto = mundo;

    const modelo = Object.getPrototypeOf(repartidor);
    if (!modelo || typeof modelo.balance !== 'function' || modelo.tectoSuavizado) return;

    modelo.balance = function (instancias, tecto) {
        const mundoDele = this.mundoDoTecto;
        if (!mundoDele || !(tecto > 0)) return;

        let total = 0;
        for (const [, instancia] of instancias) {
            const nos = instancia.octree.nodes;
            const infos = instancia.nodeInfos;
            for (let i = 0; i < nos.length; i++) {
                const nivel = infos[i].optimalLod;
                if (nivel < 0) continue;
                const lod = nos[i].lods[nivel];
                if (lod && lod.count) total += lod.count;
            }
        }

        // Dentro do tecto não se mexe: o degradé fica como a régua o deixou.
        if (total <= tecto) return;

        // Acima do tecto, encolhe-se a régua. A raiz cúbica é porque o
        // detalhe cresce com o volume à volta do ponto de atenção: para
        // gastar metade, basta encurtar as distâncias a uns quatro quintos.
        const excesso = total / tecto;
        mundoDele._budgetScale = Math.max(
            ESCALA_MINIMA_DO_TECTO,
            mundoDele._budgetScale / Math.pow(excesso, 1 / 3)
        );
    };
    modelo.tectoSuavizado = true;
}

/**
 * A rodar a vista sem andar, deixa passar no máximo uma reavaliação do
 * detalhe a cada intervalo. Andar, ou mudar o zoom, continua a reavaliar
 * logo, como de origem.
 *
 * @param {object} mundo - O gestor interno de mapas do motor.
 * @param {object} definicoes - Afinações em vigor.
 */
function travarReavaliacoesPorRotacao(mundo, definicoes) {
    const modelo = Object.getPrototypeOf(mundo);
    if (!modelo || typeof modelo.testCameraMovedForLod !== 'function' || modelo.rotacaoTravada) return;

    const original = modelo.testCameraMovedForLod;
    modelo.testCameraMovedForLod = function (camera) {
        if (!original.call(this, camera)) return false;

        const limiar = this._scene.gsplat.lodUpdateDistance;
        const andou = this._lastLodCameraPos.distance(camera.getPosition()) > limiar;
        const aberturaDeAntes = this._lastLodCameraFov;
        const abertura = camera.camera.fov;
        const mudouZoom = aberturaDeAntes < 0 || Math.abs(abertura - aberturaDeAntes) > aberturaDeAntes * 0.02;

        const agora = performance.now();
        if (!andou && !mudouZoom) {
            const ultima = this.ultimaReavaliacaoPorRotacao || 0;
            if (agora - ultima < definicoes.intervaloEntreRotacoes) return false;
        }
        this.ultimaReavaliacaoPorRotacao = agora;
        return true;
    };
    modelo.rotacaoTravada = true;
}

/**
 * O nível que a régua dá a uma distância.
 *
 * @param {number} distancia - A distância, já corrigida pela abertura.
 * @param {number} maxLod - O nível mais grosseiro que existe.
 * @param {number} lodBaseDistance - Até onde vai o detalhe fino.
 * @param {Float32Array|null} minDistBuf - A que distância começa cada nível.
 * @returns {number} O nível.
 */
function nivelPorDistancia(distancia, maxLod, lodBaseDistance, minDistBuf) {
    if (maxLod === 0 || distancia < lodBaseDistance) return 0;
    let nivel = maxLod;
    while (nivel > 1 && distancia < minDistBuf[nivel]) nivel--;
    return nivel;
}

/**
 * Escolhe o nível de detalhe de cada pedaço do mapa.
 *
 * Faz o mesmo que a conta de origem do motor — a mesma régua de
 * distâncias, a mesma correcção pela abertura da câmara, as mesmas
 * gavetas para o repartidor do tecto —, com quatro diferenças:
 *
 *  - o detalhe fino é dado pelo balão em vez da bola. Os níveis do meio
 *    e grosseiro continuam a ser dados pela bola, como sempre: o balão
 *    só decide onde vai o fino, que é o que se nota;
 *  - sem tecto de manchas, o balão é encolhido o que for preciso para
 *    não custar mais manchas do que a bola custaria nesta mesma vista;
 *  - o que está fora do ecrã desce um nível;
 *  - um pedaço à beira de uma fronteira só troca de nível quando a passa
 *    com folga.
 *
 * @param {object} instancia - O mapa (a instância da octree do motor).
 * @param {object} cameraNode - A entidade da câmara.
 * @param {number} maxLod - O nível mais grosseiro que existe.
 * @param {number} lodBaseDistance - Até onde vai o detalhe fino.
 * @param {number} lodMultiplier - Quantas vezes mais longe vai cada nível seguinte.
 * @param {number} rangeMin - Nível mais fino permitido.
 * @param {number} rangeMax - Nível mais grosseiro permitido.
 * @param {object} params - As definições de mapas da cena.
 * @param {number} uniformScale2 - A escala do mapa no mundo.
 * @param {boolean} accumulateSplats - Se deve devolver o total de manchas.
 * @param {number} globalMaxDistanceForBuckets - Alcance para as gavetas do tecto.
 * @param {object} definicoes - Afinações em vigor.
 * @returns {number} O total de manchas nos níveis escolhidos, se pedido.
 */
function avaliarNiveis(instancia, cameraNode, maxLod, lodBaseDistance, lodMultiplier, rangeMin, rangeMax, params, uniformScale2, accumulateSplats, globalMaxDistanceForBuckets, definicoes) {
    const camera = cameraNode.camera;
    let tanHalfVFov = Math.tan(camera.fov * 0.5 * math.DEG_TO_RAD);
    if (camera.horizontalFov) {
        tanHalfVFov /= camera.aspectRatio;
    }
    const tanHalfHFov = tanHalfVFov * camera.aspectRatio;
    const fovScale = Math.min(tanHalfVFov, tanHalfHFov) / REF_TAN_HALF_FOV;

    // O cone que envolve o rectângulo do ecrã, mais a folga: tudo o que
    // fique fora dele desce um nível.
    const meioCone = Math.atan(Math.sqrt(tanHalfVFov * tanHalfVFov + tanHalfHFov * tanHalfHFov));
    const foraDoEcra = meioCone + definicoes.margemForaDoEcra * math.DEG_TO_RAD;

    // Tudo em coordenadas do mapa, como faz o motor.
    const transformacao = instancia.placement.node.getWorldTransform();
    const inversa = instancia._inversaDoFoco || (instancia._inversaDoFoco = transformacao.clone());
    inversa.copy(transformacao).invert();
    const posicaoLocal = instancia._posicaoDoFoco || (instancia._posicaoDoFoco = cameraNode.getPosition().clone());
    inversa.transformPoint(cameraNode.getPosition(), posicaoLocal);
    const frenteLocal = instancia._frenteDoFoco || (instancia._frenteDoFoco = cameraNode.forward.clone());
    inversa.transformVector(cameraNode.forward, frenteLocal).normalize();

    const px = posicaoLocal.x, py = posicaoLocal.y, pz = posicaoLocal.z;
    const fwx = frenteLocal.x, fwy = frenteLocal.y, fwz = frenteLocal.z;

    const nodes = instancia.octree.nodes;
    const nodeInfos = instancia.nodeInfos;
    const boundsFlat = instancia.octree.nodeBoundsMinMax;
    const total = nodes.length;

    // A régua: a que distância começa cada nível.
    let minDistBuf = null;
    if (maxLod >= 1) {
        minDistBuf = instancia._ensureLodMinDistThresholds(maxLod, lodBaseDistance, lodMultiplier);
    }
    const bucketScale = globalMaxDistanceForBuckets > 0 ? NUM_BUCKETS / Math.sqrt(globalMaxDistanceForBuckets) : 0;

    const alcance = definicoes.alcanceAFrente;
    const aperto = definicoes.apertoLateral;
    const atras = definicoes.pesoAtras;
    const histerese = definicoes.histerese;
    const invAlcance2 = 1 / (alcance * alcance);
    const invAperto2 = 1 / (aperto * aperto);
    const atras2 = atras * atras;

    // Sem tecto de manchas é o balão que tem de se conter: nunca custa
    // mais do que a bola custaria nesta mesma vista. Com tecto, é o tecto
    // que manda, e o balão só decide a forma.
    const conterNoAntigo = definicoes.conterNoAntigo && !(params && params.splatBudget > 0);

    // Memória de trabalho, guardada no mapa para não nascer a cada vez:
    // a distância no balão, o nível que a bola dá (só conta a partir do
    // nível do meio) e se o pedaço está fora do ecrã.
    let memoria = instancia._memoriaDoFoco;
    if (!memoria || memoria.noBalao.length < total) {
        memoria = instancia._memoriaDoFoco = {
            noBalao: new Float32Array(total),
            naBola: new Float32Array(total),
            nivelDaBola: new Uint8Array(total),
            foraDoEcra: new Uint8Array(total)
        };
    }
    const { noBalao, naBola, nivelDaBola, foraDoEcra: fora } = memoria;

    // Primeira passagem: as distâncias de cada pedaço, e — se for preciso
    // conter — quanto custaria a bola.
    let custoDaBola = 0;
    for (let nodeIndex = 0; nodeIndex < total; nodeIndex++) {
        const b = nodeIndex * 6;
        const minX = boundsFlat[b], minY = boundsFlat[b + 1], minZ = boundsFlat[b + 2];
        const maxX = boundsFlat[b + 3], maxY = boundsFlat[b + 4], maxZ = boundsFlat[b + 5];

        // O ponto do pedaço mais perto da câmara: é a distância a ele que
        // diz quão grandes as manchas ficam no ecrã.
        let qx = px;
        if (qx < minX) qx = minX; else if (qx > maxX) qx = maxX;
        let qy = py;
        if (qy < minY) qy = minY; else if (qy > maxY) qy = maxY;
        let qz = pz;
        if (qz < minZ) qz = minZ; else if (qz > maxZ) qz = maxZ;
        const dx = qx - px, dy = qy - py, dz = qz - pz;
        const dist2 = dx * dx + dy * dy + dz * dz;
        const bola = Math.sqrt(dist2) * fovScale;

        // O balão: a parte da distância que vai no sentido do olhar conta
        // menos (ou mais, atrás das costas), a parte de lado conta mais.
        const aoLongo = dx * fwx + dy * fwy + dz * fwz;
        const aoLongo2 = aoLongo * aoLongo;
        let deLado2 = dist2 - aoLongo2;
        if (deLado2 < 0) deLado2 = 0;
        const balao = Math.sqrt(
            (aoLongo >= 0 ? aoLongo2 * invAlcance2 : aoLongo2 * atras2) +
            deLado2 * invAperto2
        ) * fovScale;

        noBalao[nodeIndex] = balao;
        naBola[nodeIndex] = bola;
        let nivelBola = nivelPorDistancia(bola, maxLod, lodBaseDistance, minDistBuf);
        if (nivelBola < rangeMin) nivelBola = rangeMin; else if (nivelBola > rangeMax) nivelBola = rangeMax;
        nivelDaBola[nodeIndex] = nivelBola;

        // Fora do ecrã? O ângulo é medido ao meio do pedaço, descontando o
        // tamanho dele: um quarteirão largo entra na conta pela ponta que
        // aparece no ecrã.
        let estaFora = 0;
        const cx = (minX + maxX) * 0.5 - px;
        const cy = (minY + maxY) * 0.5 - py;
        const cz = (minZ + maxZ) * 0.5 - pz;
        const dc = Math.sqrt(cx * cx + cy * cy + cz * cz);
        const ex = maxX - minX, ey = maxY - minY, ez = maxZ - minZ;
        const raio = 0.5 * Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (dc > raio) {
            let cosseno = (cx * fwx + cy * fwy + cz * fwz) / dc;
            if (cosseno > 1) cosseno = 1; else if (cosseno < -1) cosseno = -1;
            if (Math.acos(cosseno) - Math.asin(raio / dc) > foraDoEcra) estaFora = 1;
        }
        fora[nodeIndex] = estaFora;

        if (conterNoAntigo && maxLod >= 1) {
            custoDaBola += nodes[nodeIndex].lods[nivelBola].count;
        }
    }

    // O nível de um pedaço para um dado encolhimento do balão: o fino é
    // do balão, do meio para cima é da bola; à beira de uma fronteira
    // fica-se no nível em que se está (a fronteira do fino é a do balão,
    // as outras são as da bola); fora do ecrã, e da folga à volta dele,
    // desce-se um nível. É a mesma conta que decide o custo e que decide
    // o nível final, para a conta bater certo.
    const nivelDoPedaco = (nodeIndex, encolhimento) => {
        if (maxLod === 0) return 0;
        const balao = noBalao[nodeIndex] * encolhimento;
        const nivelBola = nivelDaBola[nodeIndex];
        let nivel = balao < lodBaseDistance && rangeMin === 0 ? 0 : (nivelBola > 0 ? nivelBola : 1);

        const currentLod = nodeInfos[nodeIndex].currentLod;
        if (histerese > 0 && currentLod >= 0 && currentLod !== nivel &&
            (currentLod === nivel + 1 || currentLod === nivel - 1)) {
            const fronteira = currentLod > nivel ? currentLod : nivel;
            const limiar = minDistBuf[fronteira];
            const distancia = fronteira === 1 ? balao : naBola[nodeIndex];
            if (Math.abs(distancia - limiar) < limiar * histerese) {
                nivel = currentLod;
            }
        }

        if (fora[nodeIndex] && nivel < maxLod) nivel++;

        if (nivel < rangeMin) nivel = rangeMin;
        if (nivel > rangeMax) nivel = rangeMax;
        return nivel;
    };

    // Quanto custa o balão com um dado encolhimento: é este número que se
    // compara com o custo da bola.
    const custoDoBalaoCom = (encolhimento) => {
        let custo = 0;
        for (let nodeIndex = 0; nodeIndex < total; nodeIndex++) {
            custo += nodes[nodeIndex].lods[nivelDoPedaco(nodeIndex, encolhimento)].count;
        }
        return custo;
    };

    // O balão é encolhido ou esticado até custar o que a bola custava:
    // as distâncias dele esticam-se (encolhe) ou encurtam-se (estica) até
    // a conta bater certo. A procura é por bissecção: cada tentativa é
    // uma passagem barata pelos pedaços.
    let encolhimento = 1;
    let custoDoBalao = 0;
    if (conterNoAntigo && maxLod >= 1) {
        let baixo = ENCOLHIMENTO_MINIMO;
        let alto = ENCOLHIMENTO_MAXIMO;
        if (custoDoBalaoCom(baixo) <= custoDaBola) {
            alto = baixo;
        } else {
            for (let volta = 0; volta < VOLTAS_DA_BISSECCAO; volta++) {
                const meio = (baixo + alto) * 0.5;
                if (custoDoBalaoCom(meio) <= custoDaBola) alto = meio; else baixo = meio;
            }
        }
        encolhimento = alto;
        custoDoBalao = custoDoBalaoCom(encolhimento);
    }
    instancia.focoDiagnostico = {
        custoDaBola,
        custoDoBalao,
        encolhimento,
        contido: conterNoAntigo
    };

    // Segunda passagem: o nível de cada pedaço.
    let totalSplats = 0;
    for (let nodeIndex = 0; nodeIndex < total; nodeIndex++) {
        const nodeInfo = nodeInfos[nodeIndex];
        const optimalLodIndex = nivelDoPedaco(nodeIndex, encolhimento);
        nodeInfo.optimalLod = optimalLodIndex;
        nodeInfo.worldDistance = noBalao[nodeIndex] * encolhimento * uniformScale2;
        if (bucketScale > 0 && optimalLodIndex >= 0) {
            const bucket = Math.sqrt(nodeInfo.worldDistance) * bucketScale >>> 0;
            nodeInfo.budgetBucket = bucket < NUM_BUCKETS ? bucket : NUM_BUCKETS - 1;
        }
        if (accumulateSplats) {
            const lod = nodes[nodeIndex].lods[optimalLodIndex];
            if (lod && lod.count) {
                totalSplats += lod.count;
            }
        }
    }
    return totalSplats;
}

/**
 * Enxerta a conta do balão num mapa carregado (na classe dele, por isso
 * chega fazê-lo uma vez).
 *
 * @param {object} instancia - Um mapa (a instância da octree do motor).
 * @param {object} definicoes - Afinações em vigor.
 * @returns {boolean} Verdadeiro se a conta ficou ligada.
 */
function ligarNaInstancia(instancia, definicoes) {
    const modelo = Object.getPrototypeOf(instancia);
    if (!modelo || typeof modelo.evaluateNodeLods !== 'function') return false;
    if (modelo.lodNoCentroDaVista) return true;

    // Para se saber, a olhar para as definições, se se chegou a tempo da
    // primeira avaliação ou se a bola ainda chegou a mandar uma vez.
    const infos = instancia.nodeInfos;
    definicoes.chegouTarde = !!(infos && infos.length && infos[0].optimalLod >= 0);

    const original = modelo.evaluateNodeLods;
    modelo.evaluateNodeLods = function (cameraNode, maxLod, lodBaseDistance, lodMultiplier, rangeMin, rangeMax, params, uniformScale2, accumulateSplats = true, globalMaxDistanceForBuckets = 0) {
        if (!definicoes.ativo || !cameraNode || !cameraNode.camera || !this.octree || !this.octree.nodeBoundsMinMax) {
            return original.call(this, cameraNode, maxLod, lodBaseDistance, lodMultiplier, rangeMin, rangeMax, params, uniformScale2, accumulateSplats, globalMaxDistanceForBuckets);
        }
        try {
            return avaliarNiveis(this, cameraNode, maxLod, lodBaseDistance, lodMultiplier, rangeMin, rangeMax, params, uniformScale2, accumulateSplats, globalMaxDistanceForBuckets, definicoes);
        } catch (e) {
            // Uma conta falhada não pode deixar o mapa sem níveis: fica a
            // conta de origem.
            return original.call(this, cameraNode, maxLod, lodBaseDistance, lodMultiplier, rangeMin, rangeMax, params, uniformScale2, accumulateSplats, globalMaxDistanceForBuckets);
        }
    };
    modelo.lodNoCentroDaVista = true;
    return true;
}

/**
 * Prepara um gestor de mapas do motor: o repartidor do tecto, o travão
 * das rotações, e a conta do balão nos mapas que ele já tenha — ou, se
 * ainda não tem nenhum, mal o primeiro lhe chegue, antes da primeira
 * avaliação. É isso que evita pedir ao servidor os pedaços finos da bola
 * para logo a seguir os trocar pelos do balão.
 *
 * @param {object} mundo - O gestor interno de mapas do motor.
 * @param {object} definicoes - Afinações em vigor.
 * @returns {boolean} Verdadeiro se a conta do balão já está ligada.
 */
function prepararMundo(mundo, definicoes) {
    if (!mundo) return false;
    corrigirRepartidorDoTecto(mundo);
    travarReavaliacoesPorRotacao(mundo, definicoes);

    const modelo = Object.getPrototypeOf(mundo);
    if (modelo && typeof modelo.reconcile === 'function' && !modelo.focoPreparado) {
        const original = modelo.reconcile;
        modelo.reconcile = function (...argumentos) {
            const resultado = original.apply(this, argumentos);
            if (!definicoes.ligado && this._octreeInstances) {
                for (const instancia of this._octreeInstances.values()) {
                    if (ligarNaInstancia(instancia, definicoes)) {
                        definicoes.ligado = true;
                        break;
                    }
                }
            }
            return resultado;
        };
        modelo.focoPreparado = true;
    }

    if (!definicoes.ligado && mundo._octreeInstances) {
        for (const instancia of mundo._octreeInstances.values()) {
            if (ligarNaInstancia(instancia, definicoes)) {
                definicoes.ligado = true;
                break;
            }
        }
    }
    return !!definicoes.ligado;
}

/**
 * Prepara o que já existe do lado do motor, e deixa armadilhas para o
 * que ainda vai nascer: o motor só cria o gestor de mapas quando o
 * primeiro mapa chega, e avalia-o logo nessa mesma imagem. Para o balão
 * mandar desde a primeira avaliação, cada peça do motor que nasce pelo
 * caminho — os dados da câmara, os da camada, o gestor — é apanhada à
 * nascença e preparada antes de o motor a usar.
 *
 * @param {object} app - A aplicação 3D.
 * @param {object} definicoes - Afinações em vigor.
 * @returns {boolean} Verdadeiro se a conta do balão já está ligada.
 */
function prepararDirector(app, definicoes) {
    const director = app.renderer && app.renderer.gsplatDirector;
    if (!director) return false;

    const prepararCamada = (dadosCamada) => {
        if (!dadosCamada) return;
        const gestores = [dadosCamada.gsplatManager, dadosCamada.gsplatManagerShadow];
        for (const gestor of gestores) {
            if (gestor && gestor.world) prepararMundo(gestor.world, definicoes);
        }
    };

    const prepararDadosDaCamara = (dadosCamera) => {
        if (!dadosCamera) return;
        const modelo = Object.getPrototypeOf(dadosCamera);
        if (modelo && typeof modelo.getLayerData === 'function' && !modelo.focoPreparado) {
            const original = modelo.getLayerData;
            modelo.getLayerData = function (...argumentos) {
                const dadosCamada = original.apply(this, argumentos);
                prepararCamada(dadosCamada);
                return dadosCamada;
            };
            modelo.focoPreparado = true;
        }
        if (dadosCamera.layersMap) {
            for (const dadosCamada of dadosCamera.layersMap.values()) prepararCamada(dadosCamada);
        }
    };

    const modelo = Object.getPrototypeOf(director);
    if (modelo && typeof modelo.getCameraData === 'function' && !modelo.focoPreparado) {
        const original = modelo.getCameraData;
        modelo.getCameraData = function (...argumentos) {
            const dadosCamera = original.apply(this, argumentos);
            prepararDadosDaCamara(dadosCamera);
            return dadosCamera;
        };
        modelo.focoPreparado = true;
    }
    if (director.camerasMap) {
        for (const dadosCamera of director.camerasMap.values()) prepararDadosDaCamara(dadosCamera);
    }
    return !!definicoes.ligado;
}

/**
 * Liga o detalhe concentrado no meio da vista.
 *
 * @param {object} app - A aplicação 3D.
 * @param {object} [opcoes] - Afinações opcionais.
 * @returns {object} Definições que podem ser alteradas a qualquer momento.
 */
export function ligarLodNoCentroDaVista(app, opcoes = {}) {
    const definicoes = {
        ativo: opcoes.ativo ?? true,
        alcanceAFrente: opcoes.alcanceAFrente ?? ALCANCE_A_FRENTE,
        apertoLateral: opcoes.apertoLateral ?? APERTO_LATERAL,
        pesoAtras: opcoes.pesoAtras ?? PESO_ATRAS,
        margemForaDoEcra: opcoes.margemForaDoEcra ?? MARGEM_FORA_DO_ECRA,
        histerese: opcoes.histerese ?? HISTERESE,
        intervaloEntreRotacoes: opcoes.intervaloEntreRotacoes ?? INTERVALO_ENTRE_ROTACOES,
        conterNoAntigo: opcoes.conterNoAntigo ?? true,
        ligado: false
    };

    // Sem isto o detalhe só seria recalculado ao andar, e olhar em volta
    // parado deixaria o mapa com a nitidez do sítio anterior.
    if (app.scene && app.scene.gsplat) {
        const atual = app.scene.gsplat.lodUpdateAngle || 0;
        app.scene.gsplat.lodUpdateAngle = Math.max(atual, ANGULO_DE_ATUALIZACAO);

        const recurso = app.scene.gsplat.lodUnderfillLimit || 0;
        app.scene.gsplat.lodUnderfillLimit = Math.max(recurso, NIVEIS_DE_RECURSO);
    }

    // O motor só expõe estas contas lá por dentro. As armadilhas apanham
    // o gestor de mapas à nascença; e, se por alguma razão não apanharem,
    // vai-se lá ver a cada imagem até haver um mapa carregado.
    if (!prepararDirector(app, definicoes)) {
        const aoAtualizar = () => {
            if (prepararDirector(app, definicoes)) app.off('update', aoAtualizar);
        };
        app.on('update', aoAtualizar);
    }

    return definicoes;
}
