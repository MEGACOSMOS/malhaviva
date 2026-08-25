import { Vec3 } from 'playcanvas';

/**
 * Detalhe do mapa centrado no que a câmara está a ver.
 *
 * De origem, o motor decide a qualidade de cada pedaço do bairro pela
 * distância à *posição* da câmara: quem está mesmo por baixo dos nossos pés
 * fica nítido, mesmo que estejamos a olhar para o horizonte. Aqui a conta
 * passa a ser feita a partir do ponto para onde a câmara aponta — o centro
 * do ecrã — que é aquilo que a pessoa está de facto a ver.
 *
 * Esse ponto é onde a linha de visão toca o chão. Quando se olha para o
 * horizonte (ou para cima) esse toque acontece a quilómetros de distância,
 * por isso existem limites: o ponto de atenção nunca se afasta mais do que
 * ALCANCE_MAXIMO metros da câmara, nem mais do que a altura a que a câmara
 * voa. Assim, apontar para o outro extremo do bairro não obriga o
 * computador a carregar detalhe que ninguém distingue, e quem anda pela rua
 * mantém nítidas as casas que tem mesmo à frente.
 */

// Até que distância à frente da câmara o ponto de atenção pode ir, em metros.
// Está afinado a cada nível de qualidade: quanto mais fraco o equipamento,
// mais perto se mantém o detalhe fino.
const ALCANCE_MAXIMO = {
    high: 250,
    med: 150,
    low: 80
};

// Altura do chão do bairro, em metros. É contra este plano que se calcula
// para onde a câmara está a olhar.
const ALTURA_DO_CHAO = 0;

// A quem está rente ao chão, o que interessa é o que tem mesmo à frente;
// a quem está no ar, interessa o terreno mais distante. O ponto de atenção
// nunca se afasta mais do que a altura da câmara vezes este fator...
const FATOR_DA_ALTURA = 3;

// ...nem fica mais perto do que isto, para nunca colar à ponta do nariz.
const ALCANCE_MINIMO = 30;

// Quantos graus a câmara tem de rodar para o detalhe ser recalculado.
// De origem o motor só reagia a deslocações; agora que a direção do olhar
// manda no detalhe, a rotação também tem de contar.
const ANGULO_DE_ATUALIZACAO = 2;

// Quantos níveis mais grosseiros podem servir de tapa-buracos enquanto a
// versão nítida ainda está a chegar. Sem isto, virar a cabeça abriria
// vazios momentâneos onde o detalhe novo ainda não carregou.
const NIVEIS_DE_RECURSO = 2;

// Até onde a régua das distâncias pode ser apertada para caber no tecto de
// pontos. É um travão de segurança: sem ele, um engano nas contas podia
// encolher o detalhe até não sobrar nada.
const ESCALA_MINIMA_DO_TECTO = 0.05;

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
 * Liga o detalhe centrado na vista.
 *
 * @param {object} app - A aplicação 3D.
 * @param {object} [opcoes] - Afinações opcionais.
 * @returns {object} Definições que podem ser alteradas a qualquer momento.
 */
export function ligarLodNoCentroDaVista(app, opcoes = {}) {
    const definicoes = {
        alcanceMaximo: opcoes.alcanceMaximo ??
            ALCANCE_MAXIMO[window.actualQuality] ?? ALCANCE_MAXIMO.med,
        alturaDoChao: opcoes.alturaDoChao ?? ALTURA_DO_CHAO,
        ativo: true
    };

    // Sem isto o detalhe só seria recalculado ao andar, e olhar em volta
    // parado deixaria o mapa com a nitidez do sítio anterior.
    if (app.scene && app.scene.gsplat) {
        const atual = app.scene.gsplat.lodUpdateAngle || 0;
        app.scene.gsplat.lodUpdateAngle = Math.max(atual, ANGULO_DE_ATUALIZACAO);

        const recurso = app.scene.gsplat.lodUnderfillLimit || 0;
        app.scene.gsplat.lodUnderfillLimit = Math.max(recurso, NIVEIS_DE_RECURSO);
    }

    // Câmara de faz-de-conta: tem a mesma direção e a mesma abertura da
    // câmara real, mas está pousada no ponto para onde se está a olhar.
    const posicaoDeFoco = new Vec3();
    const cameraDeFoco = {
        camera: null,
        forward: null,
        getPosition() {
            return posicaoDeFoco;
        }
    };

    const calcularFoco = (cameraReal) => {
        if (!definicoes.ativo || !cameraReal || !cameraReal.camera) {
            return cameraReal;
        }

        const posicao = cameraReal.getPosition();
        const frente = cameraReal.forward;

        // Até onde o ponto de atenção pode ir: nunca além do alcance
        // máximo, e para quem anda rente ao chão nem sequer tão longe —
        // aí o que conta são as casas logo em frente.
        const altura = Math.max(0, posicao.y - definicoes.alturaDoChao);
        const limite = Math.min(
            definicoes.alcanceMaximo,
            Math.max(ALCANCE_MINIMO, altura * FATOR_DA_ALTURA)
        );

        // A olhar para baixo, o ponto assenta onde a vista toca o terreno;
        // a olhar para o horizonte ou para cima, fica no limite.
        let distancia = limite;
        if (frente.y < -1e-4) {
            const ateAoChao = (posicao.y - definicoes.alturaDoChao) / -frente.y;
            if (ateAoChao < distancia) {
                distancia = ateAoChao;
            }
        }
        if (!(distancia > 0)) {
            distancia = 0;
        }

        posicaoDeFoco.set(
            posicao.x + frente.x * distancia,
            posicao.y + frente.y * distancia,
            posicao.z + frente.z * distancia
        );

        cameraDeFoco.camera = cameraReal.camera;
        cameraDeFoco.forward = frente;
        return cameraDeFoco;
    };

    // O motor só expõe estas contas lá por dentro, por isso a troca é feita
    // assim que existe um mapa carregado: a partir daí, sempre que ele
    // pergunta "que qualidade dou a este pedaço?", recebe o ponto de atenção
    // em vez da posição da câmara.
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
                        const modelo = Object.getPrototypeOf(instancia);
                        if (!modelo || typeof modelo.evaluateNodeLods !== 'function') continue;
                        if (modelo.lodNoCentroDaVista) return true;

                        const original = modelo.evaluateNodeLods;
                        modelo.evaluateNodeLods = function (cameraReal, ...resto) {
                            return original.call(this, calcularFoco(cameraReal), ...resto);
                        };
                        modelo.lodNoCentroDaVista = true;
                        return true;
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
