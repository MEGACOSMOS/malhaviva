/**
 * Afinador de fluidez do modo Automático.
 *
 * Olha para o tempo que cada imagem demora a ser desenhada e, quando o
 * bairro anda aos solavancos, tira-lhe pormenor até voltar a correr bem; se
 * há folga de sobra, devolve-o aos poucos.
 *
 * A primeira versão apontava a 30 imagens por segundo e corrigia à volta
 * dessa média, e era justamente por isso que andava tantas vezes abaixo
 * dos 30: apontar ao limite é passar metade do tempo do lado de lá dele.
 * Esta faz quatro coisas diferentes:
 *
 *  1. Não olha para a média, olha para as imagens lentas. Uma média de 30
 *     pode ser trinta imagens certinhas ou metade a voar e metade a arrastar
 *     — e só a segunda se sente. Conta-se que parte das imagens demorou mais
 *     do que 34 milésimos de segundo, e é essa parte que tem de ficar perto
 *     de zero. Um soluço isolado (uma imagem a meio de um carregamento)
 *     não chega para mexer em nada.
 *
 *  2. Reage depressa a sério e devagar a pouco. Se mais de metade das
 *     imagens do último segundo foram lentas, desce logo, e desce mais de um
 *     degrau quando o aperto é grande. Um aperto ligeiro, esse, só mexe ao
 *     fim de quatro segundos de provas.
 *
 *  3. Só volta a subir com folga a sério: nada de imagens lentas e perto
 *     dos 60 por segundo, seguidos durante seis segundos. Se logo a seguir a
 *     subir for preciso voltar a descer, o degrau ficou demasiado ambicioso
 *     e a espera para o tentar outra vez duplica. É isto que acaba com o
 *     vaivém à beira dos 30.
 *
 *  4. Lembra-se do pior sítio onde esteve. Uma vista leve, a seguir a uma
 *     pesada, dava folga para subir muito — e a vista pesada seguinte
 *     apanhava-o lá em cima. Por isso, depois de cada descida por aperto,
 *     só se sobe até duas casas acima do degrau onde se aterrou, e esse
 *     limite só se alarga devagar, uma casa por cada 40 segundos sem apertos.
 *
 *  5. Tem mais do que uma alavanca. O pormenor do bairro não é o único
 *     custo — em ecrãs grandes o que mais pesa é o número de pontos a pintar
 *     —, por isso os degraus mexem também na densidade da imagem.
 *
 * Este ficheiro não toca no motor nem na página: recebe o tempo de cada
 * imagem e devolve, por `aplicar`, o degrau em que se deve estar. Assim
 * pode ser provado sem placa gráfica (ver `scripts/testar-fluidez.mjs`).
 */

// Cada medição dura este tempo, em milissegundos.
const JANELA = 500;

// Uma imagem que demora mais do que isto (menos de 30 por segundo) é lenta.
// Num ecrã de 60 imagens por segundo, as imagens saem em múltiplos de 16,7:
// 33,3 (a 30 por segundo certinhos) passa; 50 já não.
const IMAGEM_LENTA = 34;

// Um intervalo maior do que este não é lentidão: é o separador que esteve
// escondido, ou a janela parada. Não conta.
const PAUSA = 1000;

// Quantas imagens lentas, no mínimo, para se falar em aperto. Uma ou duas
// são soluços, e soluços não se curam com menos pormenor.
const MINIMO_DE_LENTAS = 3;

// Os três graus de aperto: que parte das imagens foi lenta, e em quantas
// medições seguidas (a meio segundo cada uma). Quanto pior, mais depressa.
//
// O leve só vale perto dos 30: com a média bem acima disso, uma imagem
// lenta aqui e ali é um soluço (um pedaço do bairro a chegar), não peso, e
// tirar pormenor por causa dele só estragava a imagem sem nada ganhar — o
// contador de imagens por segundo nem lhe chegaria a mexer.
const URGENTE = { janelas: 2, parte: 0.5 };
const GRAVE = { janelas: 4, parte: 0.15 };
const LEVE = { janelas: 8, parte: 0.02, mediaMaxima: 45 };

// Para subir: nenhuma imagem lenta e, pelo menos, tantas imagens por
// segundo. Num ecrã de 60 é "quase sempre ao ritmo do ecrã". Com o dobro
// disto sobra tanto que a espera para subir se corta a metade: o risco de
// a seguir ser preciso descer é pequeno, e o pormenor perdido recupera-se
// mais depressa.
const FPS_DE_FOLGA = 52;
const FPS_DE_MUITA_FOLGA = 100;

// Tempo a deixar assentar depois de cada mudança, em milissegundos. Descer
// sente-se logo; subir obriga o bairro a ir buscar pormenor novo, e essas
// primeiras imagens saem sempre mais lentas — por isso se espera mais.
const ASSENTAR_DEPOIS_DE_DESCER = 1000;
const ASSENTAR_DEPOIS_DE_SUBIR = 3000;
const ASSENTAR_DEPOIS_DE_PAUSA = 2000;
const ASSENTAR_NO_ARRANQUE = 1000;

// Quanto tempo de folga seguida é preciso para subir um degrau. Duplica
// (até ao máximo) sempre que um degrau acabado de subir tem de ser
// desfeito, e volta ao princípio depois de um bom bocado sem descer.
const ESPERA_PARA_SUBIR = 6000;
const ESPERA_MAXIMA_PARA_SUBIR = 60000;
const SE_DESCE_LOGO_DEPOIS_DE_SUBIR = 25000;
const SOSSEGO_PARA_ESQUECER = 90000;

// O limite de subida: depois de uma descida, só se sobe até tantas casas
// acima do degrau onde se aterrou, e o limite alarga uma casa por cada
// tanto tempo sem descer.
const FOLGA_DO_LIMITE = 2;
const ESPERA_PARA_ALARGAR_O_LIMITE = 40000;

// Quantas mudanças ficam guardadas no diário (para diagnóstico).
const TAMANHO_DO_DIARIO = 40;

/**
 * Faz a escada de degraus: do mais leve para o de partida, e depois, se
 * houver folga para isso, os que dão ainda mais pormenor.
 *
 * Os degraus de poupança mexem num só botão de cada vez, alternando, para
 * cada passo custar pouco na imagem: primeiro um pouco de pormenor, depois
 * um pouco de densidade, e assim por diante.
 *
 * @param {object} [opcoes] - Configuração.
 * @param {boolean} [opcoes.comSubida] - Se há degraus acima da partida.
 * @param {number} [opcoes.tetoDoDetalhe] - O maior pormenor, como múltiplo
 *   do de partida.
 * @returns {{degraus: object[], partida: number}} A escada e o índice da
 *   partida.
 */
export function construirEscada(opcoes) {
    const { comSubida = false, tetoDoDetalhe = 2.6 } = opcoes || {};

    // [pormenor, densidade], ambos como múltiplos do valor de partida.
    const poupanca = [
        [0.50, 0.55],
        [0.50, 0.65],
        [0.60, 0.65],
        [0.60, 0.75],
        [0.70, 0.75],
        [0.70, 0.85],
        [0.80, 0.85],
        [0.80, 0.92],
        [0.90, 0.92],
        [0.90, 1.00]
    ];
    const subida = comSubida
        ? [1.25, 1.6, 2.0, 2.6].filter(d => d <= tetoDoDetalhe).map(d => [d, 1])
        : [];

    const todos = poupanca.concat([[1, 1]], subida);
    return {
        degraus: todos.map(([detalhe, densidade]) => ({ detalhe, densidade })),
        partida: poupanca.length
    };
}

/**
 * Cria o afinador.
 *
 * @param {object} opcoes - Configuração.
 * @param {object[]} opcoes.degraus - Os degraus, do mais leve ao mais
 *   pesado (ver `construirEscada`).
 * @param {number} opcoes.partida - Índice do degrau em que se começa.
 * @param {Function} opcoes.aplicar - Chamada com `(degrau, indice, motivo)`
 *   sempre que se muda de degrau.
 * @param {Function} [opcoes.parado] - Devolve verdadeiro quando não se deve
 *   medir (óculos de VR, por exemplo).
 * @returns {object} O afinador: `quadro(agora)` a chamar a cada imagem
 *   desenhada, e `diagnostico` para espreitar o que ele sabe.
 */
export function criarAfinadorDeFluidez(opcoes) {
    const { degraus, aplicar } = opcoes;
    const parado = opcoes.parado || (() => false);
    const ultimoDegrau = degraus.length - 1;

    let indice = Math.max(0, Math.min(ultimoDegrau, opcoes.partida));

    // Medição.
    let ultimo = 0;
    let janela = novaJanela();
    let historico = [];          // medições fechadas desde a última mudança

    // Decisão.
    let assentaAte = 0;
    let calmaDesde = 0;
    let esperaParaSubir = ESPERA_PARA_SUBIR;
    let ultimaSubida = -Infinity;
    let ultimaDescida = -Infinity;
    let limite = ultimoDegrau;   // o degrau mais alto a que se deixa subir
    let limiteAlargadoEm = 0;
    let voltouDePausa = false;
    let arrancou = false;
    let ultimoFps = 0;
    let ultimaParteLenta = 0;
    let folgaRecente = 0;        // as imagens por segundo, com o tempo, nas medições folgadas
    const diario = [];

    function novaJanela() {
        return { imagens: 0, lentas: 0, tempo: 0 };
    }

    /**
     * Junta as últimas medições numa só.
     *
     * @param {number} quantas - Quantas medições juntar.
     * @returns {object|null} As imagens, as lentas e o tempo — ou nada, se
     *   ainda não há medições que cheguem.
     */
    function juntar(quantas) {
        if (historico.length < quantas) return null;
        const total = { imagens: 0, lentas: 0, tempo: 0 };
        for (let i = historico.length - quantas; i < historico.length; i++) {
            total.imagens += historico[i].imagens;
            total.lentas += historico[i].lentas;
            total.tempo += historico[i].tempo;
        }
        return total;
    }

    function aperta(grau) {
        const m = juntar(grau.janelas);
        if (!m || m.lentas < MINIMO_DE_LENTAS || m.lentas / m.imagens < grau.parte) return false;
        return !grau.mediaMaxima || m.imagens * 1000 / m.tempo < grau.mediaMaxima;
    }

    /**
     * Muda de degrau e deixa o bairro assentar antes de voltar a julgar.
     */
    function mudarPara(novo, agora, espera, motivo) {
        diario.push({ instante: Math.round(agora), de: indice, para: novo, motivo });
        if (diario.length > TAMANHO_DO_DIARIO) diario.shift();
        indice = novo;
        historico = [];
        calmaDesde = 0;
        assentaAte = agora + espera;
        aplicar(degraus[indice], indice, motivo);
    }

    function descer(agora, passos, motivo) {
        const novo = Math.max(0, indice - passos);
        if (novo === indice) return;

        // Descer pouco depois de ter subido quer dizer que aquele degrau
        // não se aguenta: a próxima tentativa fica mais longe.
        if (agora - ultimaSubida < SE_DESCE_LOGO_DEPOIS_DE_SUBIR) {
            esperaParaSubir = Math.min(ESPERA_MAXIMA_PARA_SUBIR, esperaParaSubir * 2);
        }
        ultimaDescida = agora;
        limite = Math.min(limite, novo + FOLGA_DO_LIMITE);
        mudarPara(novo, agora, ASSENTAR_DEPOIS_DE_DESCER, motivo);
    }

    function subir(agora) {
        // Um bom bocado sem descer: o que se aprendeu a perder já não vale.
        if (agora - ultimaDescida > SOSSEGO_PARA_ESQUECER) esperaParaSubir = ESPERA_PARA_SUBIR;
        ultimaSubida = agora;
        mudarPara(indice + 1, agora, ASSENTAR_DEPOIS_DE_SUBIR, 'folga');
    }

    /**
     * Fecha uma medição e decide o que fazer com ela.
     *
     * @param {number} agora - O instante, em milissegundos.
     */
    function fechar(agora) {
        const medicao = janela;
        janela = novaJanela();

        ultimoFps = medicao.imagens * 1000 / medicao.tempo;
        ultimaParteLenta = medicao.lentas / medicao.imagens;

        // Durante o assentar, as imagens são as da mudança e não as do
        // degrau novo: não se guardam, para não enganarem.
        if (agora < assentaAte) return;
        historico.push(medicao);
        if (historico.length > URGENTE.janelas + LEVE.janelas) historico.shift();

        if (limite < ultimoDegrau &&
            agora - Math.max(ultimaDescida, limiteAlargadoEm) >= ESPERA_PARA_ALARGAR_O_LIMITE) {
            limite++;
            limiteAlargadoEm = agora;
        }

        // Do pior para o melhor: o aperto grande não espera pelo pequeno.
        if (aperta(URGENTE)) {
            const m = juntar(URGENTE.janelas);
            const fps = m.imagens * 1000 / m.tempo;
            descer(agora, fps < 12 ? 3 : (fps < 20 ? 2 : 1), 'urgente');
            return;
        }
        if (aperta(GRAVE)) {
            descer(agora, 1, 'grave');
            return;
        }
        if (aperta(LEVE)) {
            descer(agora, 1, 'leve');
            return;
        }

        // Folga: nenhuma imagem lenta e o ecrã quase ao ritmo máximo.
        const folgada = medicao.lentas === 0 && ultimoFps >= FPS_DE_FOLGA;
        if (!folgada) {
            calmaDesde = 0;
            return;
        }
        if (!calmaDesde) {
            calmaDesde = agora - JANELA;
            folgaRecente = ultimoFps;
        }
        // Basta a pior das medições folgadas para decidir se a folga é muita.
        folgaRecente = Math.min(folgaRecente, ultimoFps);
        const espera = folgaRecente >= FPS_DE_MUITA_FOLGA ? esperaParaSubir / 2 : esperaParaSubir;
        if (indice < limite && agora - calmaDesde >= espera) subir(agora);
    }

    /**
     * A chamar a cada imagem desenhada.
     *
     * @param {number} agora - O instante dessa imagem, em milissegundos
     *   (o que o `requestAnimationFrame` dá).
     */
    function quadro(agora) {
        if (parado()) {
            ultimo = 0;
            janela = novaJanela();
            historico = [];
            calmaDesde = 0;
            voltouDePausa = true;
            return;
        }
        if (!ultimo) {
            ultimo = agora;
            const espera = arrancou ? ASSENTAR_DEPOIS_DE_PAUSA : ASSENTAR_NO_ARRANQUE;
            arrancou = true;
            assentaAte = Math.max(assentaAte, agora + espera);
            // Quem mexeu no ecrã entretanto (os óculos de cartão repõem a
            // densidade de antes) deixou o motor fora do degrau em que
            // se está: repõe-se.
            if (voltouDePausa) {
                voltouDePausa = false;
                aplicar(degraus[indice], indice, 'retomar');
            }
            return;
        }

        const intervalo = agora - ultimo;
        ultimo = agora;

        if (intervalo > PAUSA) {
            janela = novaJanela();
            historico = [];
            calmaDesde = 0;
            assentaAte = agora + ASSENTAR_DEPOIS_DE_PAUSA;
            return;
        }

        janela.imagens++;
        janela.tempo += intervalo;
        if (intervalo > IMAGEM_LENTA) janela.lentas++;
        if (janela.tempo >= JANELA) fechar(agora);
    }

    return {
        quadro,

        /** O degrau em que se está. */
        get indice() {
            return indice;
        },

        /** Retrato do que o afinador sabe — serve para diagnóstico. */
        get diagnostico() {
            return {
                indice,
                degrau: degraus[indice],
                degraus: degraus.length,
                fps: Math.round(ultimoFps),
                parteLenta: Number(ultimaParteLenta.toFixed(2)),
                esperaParaSubir,
                limite,
                medicoes: historico.length,
                diario: diario.slice()
            };
        }
    };
}
