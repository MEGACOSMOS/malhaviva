/**
 * Tratamento da fotografia do céu: luz, cor e desfoque.
 *
 * É a mesma conta que se fazia de antemão, num guião, para deixar a
 * imagem pronta no ficheiro. Passa a ser feita aqui para poder ser
 * comandada a olho, com o bairro à frente: quem afina vê logo o resultado
 * em vez de ter de adivinhar números.
 *
 * O trabalho é feito uma vez por cada mexida, não a cada imagem
 * desenhada. Enquanto se arrasta um cursor trabalha-se numa versão
 * pequena da fotografia, que é instantânea; quando a mão pára, refaz-se
 * em tamanho grande. Assim o custo aparece onde não incomoda.
 *
 * Sobre a ordem das contas, que não é indiferente:
 *
 *  - A exposição é feita em luz linear. Aumentar o brilho aí é uma
 *    multiplicação honesta; somá-lo já em espaço de ecrã levantaria os
 *    pretos e lavaria a imagem.
 *  - A gama e o contraste vêm depois, em espaço de ecrã, que é onde o
 *    olho os mede.
 *  - A cor é a última, porque uma fotografia é sempre bem mais colorida
 *    do que uma reconstrução em manchas — e é essa diferença, mais do que
 *    o brilho, que denuncia onde uma acaba e a outra começa.
 */

export const AJUSTES_PADRAO = {
    // Quanto da paisagem se vê. A um, a fotografia aparece por inteiro; a
    // zero, dá lugar ao fundo do bairro e é como se não estivesse lá. Pelo
    // meio, esbate-se — serve para a paisagem deixar de competir com o
    // bairro sem ter de se desligar de vez.
    opacidade: 1,
    // Até que distância do drone, em metros, a fotografia deixa de ter chão.
    // Mais perto do que isto está tudo apagado; daqui até ao horizonte vai
    // esbatendo. A zero não se apaga nada e o chão volta todo.
    apagarChao: 390,
    exposicao: 1,
    gama: 1,
    contraste: 0,
    saturacao: 0.36,
    desfoqueCeu: 0,
    desfoqueHorizonte: 0,
    desfoqueFundo: 0
};

// Largura da fotografia enquanto se arrasta um cursor, e depois de a mão
// parar. A pequena é para ser instantânea; a grande é a que fica.
// A cor do fundo do bairro (o mesmo #05050a do ecrã de espera). É para
// aqui que a paisagem se esbate quando se lhe baixa a opacidade — assim,
// a zero, o resultado é igual a não haver paisagem nenhuma.
export const FUNDO = [5, 5, 10];

// A que altura do chão a panorâmica foi tirada, em metros. É uma medida da
// própria fotografia, e não uma afinação: serve para poder falar do chão
// dela em metros — que é como se olha para o bairro — em vez de em graus
// abaixo do horizonte, que é como a imagem está arrumada. Um ponto do chão
// a tantos metros do drone cai tantos graus abaixo do horizonte quantos a
// conta disser.
const ALTURA_DA_VISTA = 86;

export const LARGURA_RAPIDA = 1024;
export const LARGURA_FINAL = 4096;

/**
 * Converte de espaço de ecrã para luz linear.
 *
 * @param {number} x - Valor entre 0 e 1.
 * @returns {number} O mesmo valor em luz linear.
 */
function paraLinear(x) {
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/**
 * Converte de luz linear para espaço de ecrã.
 *
 * @param {number} x - Valor em luz linear.
 * @returns {number} O mesmo valor entre 0 e 1.
 */
function paraEcra(x) {
    const v = Math.min(Math.max(x, 0), 1);
    return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/**
 * Diz se os ajustes deixam a fotografia exactamente como está.
 *
 * Desde que a luz e a cor passaram a vir assadas na própria imagem, o
 * caminho normal é este: não há nada a fazer. Vale a pena sabê-lo, porque
 * assim a fotografia entra directamente, sem passar por uma tela de oito
 * milhões de pontos só para sair de lá igual.
 *
 * @param {object} ajustes - Os ajustes a testar.
 * @returns {boolean} Verdadeiro se não houver nada a fazer.
 */
export function ajustesNeutros(ajustes) {
    const a = Object.assign({}, AJUSTES_PADRAO, ajustes);
    return Math.abs(a.opacidade - 1) < 1e-4 &&
        Math.abs(a.exposicao - 1) < 1e-4 &&
        Math.abs(a.gama - 1) < 1e-4 &&
        a.contraste <= 1e-4 &&
        Math.abs(a.saturacao - 1) < 1e-4 &&
        a.desfoqueCeu < 1 && a.desfoqueHorizonte < 1 && a.desfoqueFundo < 1;
}

/**
 * Tabela com o destino de cada um dos 256 tons.
 *
 * Fazer as contas uma vez por tom, e não uma vez por ponto da imagem, é o
 * que permite tratar oito milhões de pontos num instante.
 *
 * @param {object} a - Os ajustes.
 * @returns {Uint8Array} O tom de saída para cada tom de entrada.
 */
function construirTabela(a) {
    const tabela = new Uint8Array(256);
    const k = a.contraste;
    const tanhMeio = k > 1e-4 ? Math.tanh(k / 2) : 1;
    for (let i = 0; i < 256; i++) {
        let x = paraEcra(paraLinear(i / 255) * a.exposicao);
        if (Math.abs(a.gama - 1) > 1e-4) x = Math.pow(x, 1 / a.gama);
        if (k > 1e-4) x = 0.5 + Math.tanh(k * (x - 0.5)) / tanhMeio * 0.5;
        tabela[i] = Math.min(255, Math.max(0, Math.round(x * 255)));
    }
    return tabela;
}

/**
 * Desfoca uma faixa de linhas, dando a volta nas pontas.
 *
 * Numa panorâmica a ponta esquerda encosta à direita; desfocar sem contar
 * com isso deixaria uma costura à vista. Três passagens de média móvel
 * fazem as vezes de um desfoque gaussiano, e custam o mesmo seja qual for
 * o raio, porque cada linha é percorrida com uma soma corrente.
 *
 * @param {Uint8ClampedArray} dados - Os pontos da imagem.
 * @param {number} largura - Largura da imagem.
 * @param {number} altura - Altura da imagem.
 * @param {Float32Array} raios - Raio do desfoque em cada linha.
 */
function desfocar(dados, largura, altura, raios) {
    const linha = new Float32Array(largura * 3);
    const saida = new Float32Array(largura * 3);

    for (let y = 0; y < altura; y++) {
        const raio = Math.round(raios[y]);
        if (raio < 1) continue;

        const base = y * largura * 4;
        for (let x = 0; x < largura; x++) {
            linha[x * 3] = dados[base + x * 4];
            linha[x * 3 + 1] = dados[base + x * 4 + 1];
            linha[x * 3 + 2] = dados[base + x * 4 + 2];
        }

        for (let passagem = 0; passagem < 3; passagem++) {
            const janela = raio * 2 + 1;
            for (let c = 0; c < 3; c++) {
                let soma = 0;
                for (let i = -raio; i <= raio; i++) {
                    soma += linha[(((i % largura) + largura) % largura) * 3 + c];
                }
                for (let x = 0; x < largura; x++) {
                    saida[x * 3 + c] = soma / janela;
                    const sai = (((x - raio) % largura) + largura) % largura;
                    const entra = (((x + raio + 1) % largura) + largura) % largura;
                    soma += linha[entra * 3 + c] - linha[sai * 3 + c];
                }
            }
            linha.set(saida);
        }

        for (let x = 0; x < largura; x++) {
            dados[base + x * 4] = linha[x * 3];
            dados[base + x * 4 + 1] = linha[x * 3 + 1];
            dados[base + x * 4 + 2] = linha[x * 3 + 2];
        }
    }
}

/**
 * Passagem suave entre dois limites.
 *
 * @param {number} a - Onde começa.
 * @param {number} b - Onde acaba.
 * @param {number} x - O ponto a avaliar.
 * @returns {number} Entre 0 e 1.
 */
function suave(a, b, x) {
    const t = Math.min(Math.max((x - a) / Math.max(b - a, 1e-6), 0), 1);
    return t * t * (3 - 2 * t);
}

/**
 * Apaga o chão da fotografia, esbatendo-o até ao fundo do bairro.
 *
 * Uma panorâmica destas cobre o mundo todo de uma vez: a linha do meio da
 * imagem é o horizonte, a de cima é o zénite e a de baixo é o ponto mesmo
 * debaixo do drone. Tudo o que está abaixo do meio é, portanto, chão — e
 * quanto mais abaixo, mais perto do drone esse chão estava.
 *
 * O número que manda é dado em metros, que é como se olha para o bairro:
 * dentro dessa distância o chão vai-se todo, e daí até ao horizonte — que
 * é a linha onde a taça do céu assenta no chão — esbate-se.
 *
 * É esse chão que aqui se apaga, de baixo para cima, até à mesma cor de
 * fundo a que a opacidade já esbatia a paisagem toda. Assim, sem tocar na
 * forma da taça, o fundo dela deixa de ter o que mostrar: o que era o
 * chão da fotografia passa a ser o fundo do bairro, e quem faz de chão
 * passa a ser o modelo. A paisagem ao longe fica — essa está logo abaixo
 * do horizonte, e a estas distâncias já não escorrega com a câmara.
 *
 * O trabalho é feito com um traço de pincel só, com um gradiente, e não
 * ponto a ponto: não custa nada mesmo na fotografia grande.
 *
 * @param {CanvasRenderingContext2D} pincel - O pincel da tela.
 * @param {number} largura - Largura da tela.
 * @param {number} altura - Altura da tela.
 * @param {number} metros - Distância dentro da qual o chão é apagado.
 */
function apagarOChao(pincel, largura, altura, metros) {
    if (!(metros > 0)) return;

    // A imagem vai de noventa graus acima a noventa abaixo, de alto a
    // baixo: cada grau vale uma fatia de cento e oitenta avos da altura.
    // E um ponto do chão a tantos metros do drone está tantos graus abaixo
    // do horizonte — quanto mais perto, mais fundo na imagem.
    const linhaDe = (m) => {
        const graus = Math.atan2(ALTURA_DA_VISTA, Math.max(m, 1e-3)) * 180 / Math.PI;
        return (0.5 + Math.min(graus, 90) / 180) * altura;
    };
    // O esbatimento arranca na aresta da taça, e não a uma distância
    // qualquer: a cúpula pousa no chão exactamente à altura do horizonte,
    // que é a linha do meio da imagem. Começá-lo mais abaixo deixava, logo
    // à saída da aresta, um fio de chão da fotografia por apagar — fino
    // porque ali cabe o mundo inteiro entre o horizonte e essa distância,
    // mas bem visível, por ser o único sítio onde a fotografia ainda punha
    // chão. Agora não há fio nenhum: da aresta para baixo o chão já está a
    // desaparecer.
    const comeca = altura / 2;
    const acaba = linhaDe(metros);

    const gradiente = pincel.createLinearGradient(0, comeca, 0, acaba);
    // O esbatimento é feito em degraus suaves, e não a direito: assim
    // arranca do nada junto à aresta, sem uma dobra a marcar onde começou.
    const PASSOS = 16;
    for (let i = 0; i <= PASSOS; i++) {
        const t = i / PASSOS;
        gradiente.addColorStop(t, `rgba(${FUNDO[0]}, ${FUNDO[1]}, ${FUNDO[2]}, ${suave(0, 1, t)})`);
    }
    // Um traço só, da aresta até ao fundo da imagem: o gradiente acaba
    // onde acaba e daí para baixo o pincel continua com a última cor, que
    // é o fundo cheio. Antes eram dois traços — o gradiente até à linha
    // onde o chão se apaga de vez, e um bloco liso daí para baixo — e a
    // linha onde se encontravam raramente calha num ponto inteiro da
    // imagem: nesse ponto cada traço pintava só a sua parte, e o que
    // sobrava entre os dois era um fio da fotografia por apagar. Visto da
    // taça, esse fio era um risco a dar a volta toda à base do domo.
    pincel.fillStyle = gradiente;
    pincel.fillRect(0, comeca, largura, altura - comeca);
}

/**
 * Trata a fotografia e devolve-a pronta a virar céu.
 *
 * @param {HTMLImageElement} original - A fotografia como veio.
 * @param {object} ajustes - Os ajustes a aplicar.
 * @param {number} largura - Largura de trabalho.
 * @returns {HTMLCanvasElement} A fotografia tratada.
 */
export function tratarFotografia(original, ajustes, largura) {
    const a = Object.assign({}, AJUSTES_PADRAO, ajustes);
    const altura = Math.round(largura / 2);

    // A fotografia é sempre copiada para uma tela, mesmo quando não há nada
    // a acertar. Não é desperdício: passá-la directamente à placa gráfica
    // deixava a textura vazia — o céu ficava preto. A cópia é o que garante
    // que a imagem chega lá inteira, e custa um instante.
    const neutro = ajustesNeutros(a);
    const tela = document.createElement('canvas');
    tela.width = largura;
    tela.height = altura;
    const pincel = tela.getContext('2d', neutro ? undefined : { willReadFrequently: true });
    pincel.drawImage(original, 0, 0, largura, altura);

    // Sem acertos por fazer — que é o caso desde que a luz e a cor passaram
    // a vir assadas na própria imagem — fica-se por aqui, sem tocar num
    // único dos oito milhões de pontos.
    if (neutro) {
        apagarOChao(pincel, largura, altura, a.apagarChao);
        return tela;
    }

    const imagem = pincel.getImageData(0, 0, largura, altura);
    const dados = imagem.data;
    const tabela = construirTabela(a);
    const sat = a.saturacao;
    const op = Math.min(Math.max(a.opacidade, 0), 1);
    const esbater = Math.abs(op - 1) > 1e-4;

    for (let i = 0; i < dados.length; i += 4) {
        let r = tabela[dados[i]];
        let g = tabela[dados[i + 1]];
        let b = tabela[dados[i + 2]];
        if (Math.abs(sat - 1) > 1e-4) {
            const cinzento = 0.299 * r + 0.587 * g + 0.114 * b;
            r = cinzento + (r - cinzento) * sat;
            g = cinzento + (g - cinzento) * sat;
            b = cinzento + (b - cinzento) * sat;
        }
        if (esbater) {
            r = r * op + FUNDO[0] * (1 - op);
            g = g * op + FUNDO[1] * (1 - op);
            b = b * op + FUNDO[2] * (1 - op);
        }
        dados[i] = r;
        dados[i + 1] = g;
        dados[i + 2] = b;
    }

    // O desfoque cresce à medida que se desce: em cima quase nada, junto ao
    // horizonte um pouco, no fundo bastante. É no fundo que a fotografia
    // estica sem remédio, por ter sido tirada de um ponto só.
    const escala = largura / LARGURA_FINAL;
    const raios = new Float32Array(altura);
    let algumDesfoque = false;
    for (let y = 0; y < altura; y++) {
        const v = y / (altura - 1);
        const r = (
            a.desfoqueCeu +
            (a.desfoqueHorizonte - a.desfoqueCeu) * suave(0.40, 0.52, v) +
            (a.desfoqueFundo - a.desfoqueHorizonte) * suave(0.55, 0.95, v)
        ) * escala;
        raios[y] = Math.max(0, r);
        if (raios[y] >= 1) algumDesfoque = true;
    }
    if (algumDesfoque) desfocar(dados, largura, altura, raios);

    pincel.putImageData(imagem, 0, 0);

    // O chão é apagado no fim, e não antes: assim não passa pela tabela de
    // tons nem pelo desfoque, e a cor de fundo sai exactamente a que é.
    apagarOChao(pincel, largura, altura, a.apagarChao);
    return tela;
}
