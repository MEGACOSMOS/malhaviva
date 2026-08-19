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
                    const instancias = gestor && gestor.world && gestor.world._octreeInstances;
                    if (!instancias || instancias.size === 0) continue;

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
