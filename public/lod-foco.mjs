import { Vec3 } from 'playcanvas';

/**
 * Detalhe do mapa gasto no que está no ecrã.
 *
 * O motor reparte o tecto de manchas por uma bola à volta da câmara: um
 * pedaço a cinquenta metros conta o mesmo esteja à frente do nariz ou
 * atrás das costas. Mas só uma fatia dessa bola é que se vê — o resto do
 * detalhe é comprado e nunca chega a ser olhado.
 *
 * Aqui, depois de o motor decidir a qualidade de cada pedaço, o que fica
 * fora da vista desce de nível. O tecto passa a sobrar, o motor alarga
 * sozinho as distâncias para o voltar a encher, e esse detalhe todo cai
 * onde a pessoa está mesmo a olhar.
 *
 * A conta é feita a partir da câmara, e não de um ponto à frente dela.
 * Uma versão anterior media as distâncias a partir do sítio para onde a
 * câmara aponta: o que estava ao pé ficava *atrás* desse ponto e passava a
 * contar como distante, o que enchia de manchas grosseiras o chão em volta
 * de quem passeava. Aqui a distância manda como sempre mandou — só a
 * direção do olhar é que decide o que pode ser sacrificado.
 *
 * Fora do que se vê há ainda um anel de folga, onde os pedaços descem só
 * um degrau em vez de caírem para o mais grosseiro. É esse anel que dá ao
 * mapa tempo de ir buscar o detalhe enquanto se roda a vista.
 */

// Largura do anel de folga à volta do que cabe no ecrã, em graus.
const MARGEM_DE_ROTACAO = 25;

// Quantos graus a câmara tem de rodar para o detalhe ser recalculado.
// De origem o motor só reagia a deslocações; agora que a direção do olhar
// manda no detalhe, a rotação também tem de contar.
const ANGULO_DE_ATUALIZACAO = 2;

// Quantos níveis mais grosseiros podem servir de tapa-buracos enquanto a
// versão nítida ainda está a chegar. Sem isto, virar a cabeça abriria
// vazios momentâneos onde o detalhe novo ainda não carregou.
const NIVEIS_DE_RECURSO = 2;

// Até onde a régua das distâncias pode ser apertada ou esticada para o
// mapa caber no tecto de manchas. São travões de segurança: sem eles, um
// engano nas contas podia encolher o detalhe até não sobrar nada, ou
// esticar a régua até querer o mapa inteiro no detalhe fino.
const ESCALA_MINIMA_DO_TECTO = 0.05;
const ESCALA_MAXIMA_DO_TECTO = 20;

// Quanto o total pode andar longe do tecto sem se mexer na régua. Sem esta
// zona morta, a régua andaria a corrigir-se a cada imagem e via-se o mapa
// a respirar.
const FOLGA_DO_TECTO = 0.08;

const GRAUS = Math.PI / 180;

/**
 * Tira ao tecto de manchas o hábito de comer o nível de detalhe do meio.
 *
 * Quando há tecto de manchas, o motor cumpre-o de duas maneiras. Uma é
 * boa: aperta ou alarga as distâncias a que cada nível começa, e as três
 * faixas — fina, média e grosseira — encolhem ou crescem juntas, mantendo
 * a passagem suave. A outra é gulosa: percorre os pedaços do mapa e vai
 * empurrando cada um, à vez, para o nível seguinte, até as contas
 * fecharem.
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
 * e a avaliação seguinte — uma fracção de segundo depois — já cabe.
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

        if (total <= 0) return;

        // A régua acompanha o tecto nos dois sentidos: aperta quando se
        // passa dele, alarga quando sobra. Alargar é o que faz falta desde
        // que o detalhe deixou de ser gasto fora do ecrã — sem isso
        // ficavam dois quintos do tecto por usar, com o mapa à frente da
        // pessoa mais grosseiro do que podia estar.
        //
        // A raiz cúbica é porque o detalhe cresce com o volume à volta da
        // câmara: para gastar metade, basta encurtar as distâncias a uns
        // quatro quintos. É também ela que amortece a correção, para a
        // régua assentar em vez de andar aos saltos.
        const excesso = total / tecto;
        if (Math.abs(excesso - 1) <= FOLGA_DO_TECTO) return;

        mundoDele._budgetScale = Math.min(
            ESCALA_MAXIMA_DO_TECTO,
            Math.max(
                ESCALA_MINIMA_DO_TECTO,
                mundoDele._budgetScale / Math.pow(excesso, 1 / 3)
            )
        );
    };
    modelo.tectoSuavizado = true;
}

const centroDoNo = new Vec3();

/**
 * Baixa o nível de detalhe de tudo o que fica fora da vista.
 *
 * É chamado logo a seguir à avaliação do motor, com os níveis já
 * escolhidos por distância. Devolve o total corrigido de manchas, porque é
 * por esse número que o motor decide se ainda cabe no tecto — e é por ele
 * caber com folga que o detalhe fino se estica onde interessa.
 *
 * @param {object} instancia - O mapa a tratar.
 * @param {object} camara - A câmara, tal como o motor a passou.
 * @param {number} total - Quantas manchas o motor tinha contado.
 * @param {object} definicoes - Afinações em vigor.
 * @returns {number} Quantas manchas ficam depois de aparar o que não se vê.
 */
function pouparOQueNaoSeVe(instancia, camara, total, definicoes) {
    const componente = camara && camara.camera;
    const octree = instancia.octree;
    if (!componente || !octree) return total;

    const nivelMaximo = Math.min(
        octree.lodLevels - 1,
        instancia.rangeMax ?? (octree.lodLevels - 1)
    );
    if (nivelMaximo <= 0) return total;

    // O cone que envolve o rectângulo do ecrã: metade da abertura na
    // vertical e na horizontal, juntas pelo teorema de Pitágoras. Tudo o
    // que caiba dentro deste cone pode estar à vista.
    let tanV = Math.tan(componente.fov * 0.5 * GRAUS);
    if (componente.horizontalFov) tanV /= componente.aspectRatio;
    const tanH = tanV * componente.aspectRatio;
    const meioCone = Math.atan(Math.sqrt(tanV * tanV + tanH * tanH));
    const folga = meioCone + definicoes.margemGraus * GRAUS;

    const matriz = instancia.placement.node.getWorldTransform();
    const escala = matriz.getScale().x;
    const olho = camara.getPosition();
    const frente = camara.forward;

    const nos = octree.nodes;
    const infos = instancia.nodeInfos;

    for (let i = 0; i < nos.length; i++) {
        const nivel = infos[i].optimalLod;
        if (nivel < 0 || nivel >= nivelMaximo) continue;

        const caixa = nos[i].bounds;
        matriz.transformPoint(caixa.center, centroDoNo);
        const raio = caixa.halfExtents.length() * escala;

        const dx = centroDoNo.x - olho.x;
        const dy = centroDoNo.y - olho.y;
        const dz = centroDoNo.z - olho.z;
        const distancia = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Com a câmara dentro do pedaço não há fora nem dentro da vista:
        // fica como está.
        if (distancia <= raio) continue;

        // Ângulo entre o olhar e o pedaço, descontando o tamanho do
        // pedaço: um quarteirão largo entra na conta pela ponta que
        // aparece no ecrã, e não pelo meio.
        const cosseno = (dx * frente.x + dy * frente.y + dz * frente.z) / distancia;
        const angulo = Math.acos(Math.min(1, Math.max(-1, cosseno))) -
            Math.asin(Math.min(1, raio / distancia));
        if (angulo <= meioCone) continue;

        // No anel de folga desce um degrau só; para lá dele cai logo para
        // o mais grosseiro.
        const novo = angulo <= folga ? Math.min(nivelMaximo, nivel + 1) : nivelMaximo;
        if (novo === nivel) continue;

        const antes = nos[i].lods[nivel];
        const depois = nos[i].lods[novo];
        total += (depois && depois.count ? depois.count : 0) -
            (antes && antes.count ? antes.count : 0);
        infos[i].optimalLod = novo;
    }

    return total;
}

/**
 * Enxerta a poupança na avaliação de níveis do motor.
 *
 * @param {object} instancia - Um mapa carregado.
 * @param {object} definicoes - Afinações em vigor.
 * @returns {boolean} Verdadeiro se ficou ligado.
 */
function ligarPoupanca(instancia, definicoes) {
    const modelo = Object.getPrototypeOf(instancia);
    if (!modelo || typeof modelo.evaluateOptimalLods !== 'function') return false;
    if (modelo.detalheNoQueSeVe) return true;

    const original = modelo.evaluateOptimalLods;
    modelo.evaluateOptimalLods = function (camara, ...resto) {
        const total = original.call(this, camara, ...resto);
        if (!definicoes.ativo) return total;
        try {
            return pouparOQueNaoSeVe(this, camara, total, definicoes);
        } catch (e) {
            // Uma conta falhada não pode deixar o mapa sem níveis: fica o
            // que o motor tinha decidido.
            return total;
        }
    };
    modelo.detalheNoQueSeVe = true;
    return true;
}

/**
 * Liga o detalhe centrado no que se vê.
 *
 * @param {object} app - A aplicação 3D.
 * @param {object} [opcoes] - Afinações opcionais.
 * @returns {object} Definições que podem ser alteradas a qualquer momento.
 */
export function ligarDetalheNoQueSeVe(app, opcoes = {}) {
    const definicoes = {
        ativo: opcoes.ativo ?? true,
        margemGraus: opcoes.margemGraus ?? MARGEM_DE_ROTACAO
    };

    // Sem isto o detalhe só seria recalculado ao andar, e olhar em volta
    // parado deixaria o mapa com a nitidez do sítio anterior.
    if (app.scene && app.scene.gsplat) {
        const atual = app.scene.gsplat.lodUpdateAngle || 0;
        app.scene.gsplat.lodUpdateAngle = Math.max(atual, ANGULO_DE_ATUALIZACAO);

        const recurso = app.scene.gsplat.lodUnderfillLimit || 0;
        app.scene.gsplat.lodUnderfillLimit = Math.max(recurso, NIVEIS_DE_RECURSO);
    }

    // O motor só expõe estas contas lá por dentro, por isso a ligação é
    // feita assim que existe um mapa carregado.
    const tentarLigar = () => {
        const director = app.renderer && app.renderer.gsplatDirector;
        if (!director || !director.camerasMap) return false;

        for (const dadosCamera of director.camerasMap.values()) {
            if (!dadosCamera || !dadosCamera.layersMap) continue;
            for (const dadosCamada of dadosCamera.layersMap.values()) {
                const gestores = [dadosCamada.gsplatManager, dadosCamada.gsplatManagerShadow];
                for (const gestor of gestores) {
                    const mundo = gestor && gestor.world;
                    const instancias = mundo && mundo._octreeInstances;
                    if (!instancias || instancias.size === 0) continue;

                    corrigirRepartidorDoTecto(mundo);

                    for (const instancia of instancias.values()) {
                        if (ligarPoupanca(instancia, definicoes)) return true;
                    }
                }
            }
        }
        return false;
    };

    if (!tentarLigar()) {
        const aoAtualizar = () => {
            if (tentarLigar()) app.off('update', aoAtualizar);
        };
        app.on('update', aoAtualizar);
    }

    return definicoes;
}
