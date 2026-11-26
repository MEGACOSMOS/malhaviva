/**
 * Até onde vai o pormenor fino, afinado pela fluidez, dentro do Alto e do Médio.
 *
 * O objetivo são 30 imagens por segundo. Abaixo disso a distância encolhe, até
 * ao mínimo do modo (80 m no Médio, 200 m no Alto); com folga a sério — 40 ou
 * mais imagens por segundo, sem nenhuma lenta, duas medições seguidas — alarga,
 * sem máximo, e mais depressa quando a folga é muita. Entre 30 e 40 fica onde
 * está: é a margem que impede o vaivém.
 *
 * Quando alargar já não acrescenta nada (o bairro todo à vista já está no
 * pormenor fino), deixa de alargar até a vista mudar (ver `custo`).
 *
 * Depois de cada mudança, e enquanto o bairro estiver a chegar ou a assentar,
 * não se mede: as imagens dessas alturas não são as da distância nova.
 *
 * Este ficheiro não toca no motor: recebe o tempo de cada imagem e diz, por
 * `aplicar`, a distância a pôr.
 */

const JANELA = 1000;          // cada medição, em milissegundos
const IMAGEM_LENTA = 34;      // menos de 30 por segundo
const PAUSA = 4000;           // um intervalo maior é a janela que esteve parada
const ALVO = 30;              // abaixo disto, encolhe
const FOLGA = 40;             // a partir disto, sem imagens lentas, alarga
const MUITA_FOLGA = 55;       // e alarga mais depressa (num ecrã de 60, já é o tecto: não se vê a folga toda)
const ENCOLHER = 0.8;
const ALARGAR = 1.1;
const ALARGAR_DEPRESSA = 1.25;
const ASSENTAR_DEPOIS_DE_ENCOLHER = 1500;
const ASSENTAR_DEPOIS_DE_ALARGAR = 2000;
const VOLTAR_A_TENTAR = 20000; // cheio: ao fim disto tenta-se alargar outra vez

/**
 * @param {object} o
 * @param {number} o.minimo - A distância mínima, em metros.
 * @param {number} o.partida - Com que distância se começa.
 * @param {function(number): void} o.aplicar - Põe a distância.
 * @param {function(): boolean} [o.parado] - Não se mede (separador escondido, desenho em pausa).
 * @param {function(): boolean} [o.ocupado] - O bairro a chegar ou a assentar.
 * @param {function(): number} [o.custo] - Quantas manchas há agora em jogo.
 * @returns {object} `quadro(agora)`, `por(minimo, partida)`, `distancia`,
 *     `noMinimo`, `lento`, `diagnostico`.
 */
export function criarAfinadorDaDistancia(o) {
    const parado = o.parado || (() => false);
    const ocupado = o.ocupado || (() => false);
    const custo = o.custo || (() => 0);
    let minimo = o.minimo;
    let distancia = Math.max(o.minimo, o.partida);
    let janela = { imagens: 0, lentas: 0, tempo: 0 };
    let ultimo = 0;
    let assentaAte = 0;
    let boas = 0;
    let lento = false;
    let ultimoFps = 0;
    // Para saber se alargar acrescentou alguma coisa.
    let custoAntes = -1;
    let cheioDesde = 0;
    const diario = [];

    function mudar(nova, agora, espera, motivo) {
        if (Math.abs(nova - distancia) < 0.01) return;
        diario.push({ instante: Math.round(agora), de: Math.round(distancia), para: Math.round(nova), motivo });
        if (diario.length > 30) diario.shift();
        distancia = nova;
        assentaAte = agora + espera;
        boas = 0;
        o.aplicar(distancia);
    }

    function fechar(agora) {
        const m = janela;
        janela = { imagens: 0, lentas: 0, tempo: 0 };
        if (!m.imagens) return;
        ultimoFps = m.imagens * 1000 / m.tempo;
        if (agora < assentaAte || ocupado()) {
            boas = 0;
            return;
        }
        // Alargou-se há pouco: acrescentou alguma coisa?
        if (custoAntes >= 0) {
            const agoraCusta = custo();
            if (agoraCusta <= custoAntes * 1.01) cheioDesde = agora;
            custoAntes = -1;
        }
        if (ultimoFps < ALVO || m.lentas / m.imagens > 0.25) {
            lento = true;
            cheioDesde = 0;
            if (distancia > minimo) mudar(Math.max(minimo, distancia * ENCOLHER), agora, ASSENTAR_DEPOIS_DE_ENCOLHER, 'lento');
            return;
        }
        lento = false;
        if (ultimoFps >= FOLGA && m.lentas === 0) {
            boas++;
            if (cheioDesde && agora - cheioDesde < VOLTAR_A_TENTAR) return;
            if (boas >= 2) {
                cheioDesde = 0;
                custoAntes = custo();
                mudar(distancia * (ultimoFps >= MUITA_FOLGA ? ALARGAR_DEPRESSA : ALARGAR), agora, ASSENTAR_DEPOIS_DE_ALARGAR, 'folga');
            }
        } else {
            boas = 0;
        }
    }

    return {
        /** A chamar a cada imagem. */
        quadro(agora) {
            if (parado()) {
                ultimo = 0;
                return;
            }
            if (!ultimo) {
                ultimo = agora;
                janela = { imagens: 0, lentas: 0, tempo: 0 };
                return;
            }
            const intervalo = agora - ultimo;
            ultimo = agora;
            if (intervalo > PAUSA) {
                janela = { imagens: 0, lentas: 0, tempo: 0 };
                assentaAte = Math.max(assentaAte, agora + ASSENTAR_DEPOIS_DE_ENCOLHER);
                return;
            }
            janela.imagens++;
            janela.tempo += intervalo;
            if (intervalo > IMAGEM_LENTA) janela.lentas++;
            if (janela.tempo >= JANELA) fechar(agora);
        },
        /** Outro modo: outro mínimo, e recomeça na distância dele. */
        por(novoMinimo, partida) {
            minimo = novoMinimo;
            distancia = Math.max(novoMinimo, partida);
            janela = { imagens: 0, lentas: 0, tempo: 0 };
            ultimo = 0;
            boas = 0;
            lento = false;
            custoAntes = -1;
            cheioDesde = 0;
            assentaAte = performance.now() + ASSENTAR_DEPOIS_DE_ALARGAR;
        },
        get distancia() { return distancia; },
        get noMinimo() { return distancia <= minimo * 1.001; },
        get lento() { return lento; },
        get diagnostico() {
            return { distancia: Math.round(distancia), minimo, fps: Math.round(ultimoFps), lento, cheio: !!cheioDesde, diario: diario.slice() };
        }
    };
}
