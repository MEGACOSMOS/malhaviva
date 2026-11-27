import { alturaDe, debitoDe, eOriginal, e360 } from './videos.mjs?v=10';
import { lerIndice } from './indice-mp4.mjs?v=1';

/**
 * Escolha automática da qualidade dos vídeos.
 *
 * A ideia é a mesma dos grandes serviços de vídeo: em vez de obrigar a
 * pessoa a adivinhar que versão a sua ligação aguenta, o player decide
 * sozinho e vai corrigindo enquanto o vídeo corre. Mas uma troca custa: é
 * um instante de imagem parada e de som calado, e uma nitidez que muda a
 * meio de uma frase. Por isso a regra de ouro é trocar só quando é mesmo
 * preciso — e, quando se troca, fazê-lo de maneira a quase não se dar por
 * isso.
 *
 * Quando se troca
 *
 *  - Desce-se de imediato só quando o filme ia parar: a reserva de segundos
 *    já descarregados acaba antes de a versão mais leve estar pronta, ou o
 *    filme parou mesmo à espera. Aí vai-se logo para a versão que a
 *    ligação aguenta, e não degrau a degrau.
 *  - Desce-se com calma quando a ligação, medida com tempo, deixou de chegar
 *    para a versão actual e a reserva está a encolher — antes de faltar.
 *  - Sobe-se só com a reserva cheia (o navegador até deixou de descarregar,
 *    por já ter que chegue), com a ligação a dar pelo menos 1,4 vezes o que
 *    a versão de cima pede, e isso a manter-se uns segundos. E nunca acima
 *    do que o ecrã consegue mostrar.
 *  - Entre a fasquia de subir e a de descer há um intervalo onde se fica
 *    quieto, para não andar aos saltos entre duas versões; há um tempo
 *    mínimo entre trocas, e para subir espera-se muito mais do que para
 *    descer. Uma versão de onde foi preciso descer fica de castigo: só se
 *    volta a tentar passado um minuto, e o dobro de cada vez que falhe.
 *
 * Como se mede
 *
 *  - A ligação: pela própria descarga do filme, só nos momentos em que o
 *    navegador está mesmo a descarregar, com duas médias — uma que
 *    esquece depressa, outra devagar —, valendo a mais baixa. Uma medição
 *    sozinha nunca decide nada.
 *  - O peso de cada versão: pelo tamanho real dos ficheiros, que se pergunta
 *    à nuvem (há testemunhos em que a mesma qualidade pesa o triplo de
 *    outros), e, para a versão para onde se vai, pelo peso real dos segundos
 *    que vêm a seguir.
 *  - A reserva: quantos segundos estão descarregados à frente, e se está a
 *    crescer ou a encolher.
 *
 * Como se troca
 *
 * Um filme só pode começar numa imagem-chave (ver `indice-mp4.mjs`). A
 * troca é marcada para uma imagem-chave da versão nova, de preferência num
 * momento em que ninguém está a falar (pelas legendas), e os bytes de que a
 * versão nova precisa para arrancar ali são descarregados de antemão.
 * Quando o filme lá chega, muda-se de ficheiro: a versão nova arranca da
 * memória do navegador, sem esperar pela rede. Fica à vista a última imagem
 * da versão antiga até a nova aparecer, e o som desce e volta a subir num
 * instante — sem ecrã preto, sem saltar para trás nem para a frente. A
 * descarga feita de antemão serve também de ensaio: se a ligação não a
 * aguentar com folga, não se sobe.
 *
 * O que se aprende da ligação fica guardado no navegador: o vídeo seguinte,
 * e a visita seguinte, começam logo na qualidade que ela aguenta.
 *
 * Quem escolher uma versão à mão manda sempre: a partir daí o automático
 * cala-se, até voltar a ser ligado.
 *
 * Para provar que tudo isto se porta bem: `bun scripts/testar-qualidade-video.mjs`.
 */

// --- A ligação ---------------------------------------------------------------

// As duas médias da ligação: quantos segundos de descarga levam a esquecer
// metade do que sabiam.
const MEIA_VIDA_RAPIDA = 3;
const MEIA_VIDA_LENTA = 15;

// Segundos de descarga medida antes de a estimativa valer alguma coisa.
const MEDIDA_MINIMA = 1;

// Uma medição tão rápida que só pode ter vindo da memória do navegador.
const RAPIDO_DE_MAIS = 1000; // Mbps

// --- Quando trocar -----------------------------------------------------------

// Para subir, a ligação tem de dar esta folga sobre o que a versão de cima
// pede. Para descer, tem de ficar abaixo desta folga sobre a versão actual
// (e a reserva tem de estar a encolher). O intervalo entre as duas é onde
// se fica quieto.
const FOLGA_PARA_SUBIR = 1.4;
const FOLGA_PARA_FICAR = 1.05;
// Ao descer, escolhe-se a versão que cabe com esta folga.
const FOLGA_AO_DESCER = 1.25;
// A primeira escolha: com o que o navegador diz da ligação, a mesma folga de
// subir; com o que se mediu antes, um pouco menos.
const FOLGA_NA_PRIMEIRA = 1.4;
const FOLGA_NA_PRIMEIRA_LEMBRADA = 1.3;

// Segundos de reserva a partir dos quais se pode pensar em subir (ou o
// navegador deixou de descarregar por já ter que chegue).
const RESERVA_PARA_SUBIR = 10;

// Tempos, em milissegundos. Subir é muito mais lento do que descer: uma
// paragem incomoda muito mais do que uma imagem menos nítida durante mais
// uns segundos.
const TEMPO_A_ASSENTAR = 6000;   // depois de arrancar, trocar ou saltar: só emergências
const ESPERA_PARA_SUBIR = 30000; // desde a última troca
const ESPERA_PARA_DESCER = 12000;
const CONFIRMAR_SUBIDA = 6000;   // as condições para subir têm de se manter isto
const CONFIRMAR_DESCIDA = 4000;
const CASTIGO = 60000;           // uma versão de onde se desceu: espera antes de a tentar
const CASTIGO_MAXIMO = 10 * 60000;
const ESPERA_ENTRE_ENSAIOS = 45000;
const ARRANQUE_LENTO = 2500;     // sem imagem ao fim disto, e a ligação não chega: desce-se já

// Perto do fim não vale a pena subir: só se gastava a recarregar o resto.
const PERTO_DO_FIM = 40;

// Folga, em segundos, entre o momento em que a versão nova fica pronta e
// aquele em que a reserva acabaria. Abaixo disso, desce-se já.
const MARGEM_DE_EMERGENCIA = 2.5;

// --- Como trocar ---------------------------------------------------------------

// Quantos segundos da versão nova se descarregam de antemão a partir do
// ponto da troca. E, do princípio do ficheiro, o que o navegador lê
// sempre que abre um.
const SEGUNDOS_PREPARADOS = 4;
const SEGUNDOS_PREPARADOS_COM_PRESSA = 2;
const SEGUNDOS_DO_PRINCIPIO = 0.6;
// O navegador lê os vídeos aos bocados de 32 KB: o que se descarrega de
// antemão começa no princípio de um bocado, para ele o achar todo.
const BOCADO = 32 * 1024;
// A janela de tempo, a contar de agora, onde se procura o ponto da troca.
const JANELA_PARA_SUBIR = [8, 20];
const JANELA_PARA_DESCER = [3, 20];
// Um silêncio: nenhuma legenda desde um pouco antes até um pouco depois.
const SILENCIO_ANTES = 0.12;
const SILENCIO_DEPOIS = 0.25;

// O som desce e volta a subir à volta da troca, em vez de cortar a direito.
const DESCER_O_SOM = 0.1; // segundos
const SUBIR_O_SOM = 0.18;
// A troca faz-se com a imagem anterior à imagem-chave já à vista.
const UMA_IMAGEM = 0.06;

// --- Outras coisas ---------------------------------------------------------------

const INTERVALO_DE_ANALISE = 500;

// Nas rotas vê-se de cada vez pouco mais do que um quarto da imagem
// na horizontal; a imagem tem de ser bastante maior do que o ecrã para se
// ver nítida.
const FATOR_PANORAMICO = 2.5;

// Uma versão só é descartada por ser grande de mais para o ecrã se for
// mesmo bem maior — mais vale sobrar nitidez do que faltar.
const TOLERANCIA_DO_ECRA = 1.3;

// A memória do navegador: o que se aprendeu da ligação.
const CHAVE_DA_MEMORIA = 'qualidade-dos-videos';
const MEMORIA_FRESCA = 6 * 3600 * 1000;
const MEMORIA_VALIDA = 30 * 24 * 3600 * 1000;
const GUARDAR_DE_TANTO_EM_TANTO = 10000;

// O estado da descarga (networkState) do elemento de vídeo.
const A_DESCARREGAR = 2;
const SEM_DESCARREGAR = 1;

// Se o navegador conta o que já descarregou em bytes passados a segundos à
// razão do peso médio do ficheiro (o Chrome, o Edge, o Opera, o Samsung —
// todos os feitos a partir do Chromium, menos no iPhone, onde são Safari por
// dentro). Ver `faixaActual`.
const CONTA_EM_BYTES = (() => {
    try {
        const dados = navigator.userAgentData;
        if (dados && Array.isArray(dados.brands)) return dados.brands.some(b => /Chromium/i.test(b.brand));
    } catch (e) { /* segue */ }
    const ua = navigator.userAgent || '';
    return /Chrome\/\d/.test(ua) && !/iPhone|iPad|iPod/.test(ua);
})();

const agora = () => performance.now();

// --- A média da ligação ---------------------------------------------------------

/**
 * Uma média que vai esquecendo: cada medição pesa conforme o tempo que
 * durou, e o que se sabia perde metade do peso a cada `meiaVida` segundos
 * de medições novas.
 */
function criarMedia(meiaVida) {
    const alfa = Math.pow(0.5, 1 / meiaVida);
    let valor = 0;
    let peso = 0;
    return {
        juntar(mbps, segundos) {
            const a = Math.pow(alfa, segundos);
            valor = mbps * (1 - a) + valor * a;
            peso += segundos;
        },
        /** O valor, corrigido de a média começar no zero. */
        get valor() {
            return peso ? valor / (1 - Math.pow(alfa, peso)) : 0;
        },
        /** Começa num valor já conhecido, como se medido durante `segundos`. */
        semear(mbps, segundos) {
            peso = segundos;
            valor = mbps * (1 - Math.pow(alfa, segundos));
        }
    };
}

// A ligação é a mesma para todos os vídeos da mesma página: o que um
// aprendeu, o seguinte já sabe.
const ligacao = {
    rapida: criarMedia(MEIA_VIDA_RAPIDA),
    lenta: criarMedia(MEIA_VIDA_LENTA),
    medida: 0,
    // As últimas medições, para saber o que a ligação deu agora mesmo.
    recentes: [],
    juntar(mbps, segundos) {
        if (!(mbps > 0) || !(segundos > 0) || mbps > RAPIDO_DE_MAIS) return;
        this.rapida.juntar(mbps, segundos);
        this.lenta.juntar(mbps, segundos);
        this.medida += segundos;
        this.recentes.push([agora(), mbps, segundos]);
        while (this.recentes.length > 40) this.recentes.shift();
    },
    /** A estimativa que conta: a mais baixa das duas médias. */
    get valor() {
        return this.medida < MEDIDA_MINIMA ? 0 : Math.min(this.rapida.valor, this.lenta.valor);
    },
    /** A medição mais baixa dos últimos segundos (0 se nada foi medido). */
    pior(segundos) {
        const desde = agora() - segundos * 1000;
        let menor = 0;
        this.recentes.forEach(([t, mbps]) => {
            if (t >= desde && (!menor || mbps < menor)) menor = mbps;
        });
        return menor;
    },
    /** O que a ligação deu nos últimos segundos (0 se nada foi medido). */
    agora(segundos) {
        const desde = agora() - segundos * 1000;
        let bits = 0;
        let tempo = 0;
        this.recentes.forEach(([t, mbps, s]) => {
            if (t >= desde) { bits += mbps * s; tempo += s; }
        });
        return tempo >= 0.5 ? bits / tempo : 0;
    }
};

function lerMemoria() {
    try {
        const m = JSON.parse(localStorage.getItem(CHAVE_DA_MEMORIA) || 'null');
        return m && typeof m === 'object' ? m : null;
    } catch (e) {
        return null;
    }
}

function guardarMemoria(m) {
    try {
        localStorage.setItem(CHAVE_DA_MEMORIA, JSON.stringify(m));
    } catch (e) {
        // Sem memória no navegador: cada visita aprende de novo.
    }
}

// Na primeira vez que a página precisa, a média começa no que a memória diz
// — com mais desconfiança se for antiga.
let ligacaoLembrada = null;
function lembrarLigacao() {
    if (ligacaoLembrada !== null) return ligacaoLembrada;
    ligacaoLembrada = 0;
    const m = lerMemoria();
    if (m && m.mbps > 0 && m.quando > 0) {
        const idade = Date.now() - m.quando;
        if (idade >= 0 && idade < MEMORIA_VALIDA) {
            ligacaoLembrada = idade < MEMORIA_FRESCA ? m.mbps : m.mbps * 0.6;
            ligacao.rapida.semear(ligacaoLembrada, 2);
            ligacao.lenta.semear(ligacaoLembrada, 2);
            ligacao.medida = MEDIDA_MINIMA;
        }
    }
    return ligacaoLembrada;
}

// O tamanho e o índice de cada ficheiro, para os vídeos que se voltam a
// abrir na mesma página não os pedirem outra vez.
const tamanhosConhecidos = new Map();
const indicesConhecidos = new Map();

// --- O gestor -------------------------------------------------------------------

/**
 * Cria o gestor de qualidade de um vídeo.
 *
 * @param {object} opcoes - Configuração.
 * @param {HTMLVideoElement} opcoes.video - O elemento de vídeo.
 * @param {Object<string, string>} opcoes.fontes - Resolução → endereço.
 * @param {string} opcoes.nome - Nome do vídeo.
 * @param {HTMLElement} [opcoes.moldura] - A caixa onde o vídeo é mostrado.
 * @param {Function} [opcoes.aoMudar] - Chamada sempre que algo muda.
 * @param {number} [opcoes.limiteDeTextura] - Maior imagem que a placa
 *   gráfica consegue usar, em pontos (só interessa nas rotas).
 * @returns {object} O gestor.
 */
export function criarGestorDeQualidade(opcoes) {
    const { video, fontes, nome, moldura, aoMudar, limiteDeTextura } = opcoes;
    const tipo = e360(nome) ? 'rota360' : 'entrevista';

    // Da mais leve para a mais nítida. O original fica de fora: é pesado
    // de mais para entrar sozinho, só por escolha de quem está a ver.
    const escada = Object.keys(fontes)
        .filter(r => !eOriginal(nome, r))
        .sort((a, b) => alturaDe(nome, a) - alturaDe(nome, b));

    const estado = {
        modo: 'auto',
        resolucao: null,
        ultimaMudanca: 0,
        assentaAte: 0,
        jaAndou: false,
        // Desde quando se mantêm as condições para subir ou para descer.
        subirDesde: 0,
        descerDesde: 0,
        instanteDaParagem: 0,
        // Desde quando o filme está parado à espera de mais filme (0 se não está).
        esperaDesde: 0,
        ultimoEnsaio: -Infinity,
        ultimoCheio: -Infinity,
        // Quando se desceu de cada versão, para a castigar.
        falhas: {},
        // A troca marcada, se houver, e se está a acontecer.
        troca: null,
        aTrocar: false,
        // Até onde vai o que se descarregou de antemão para a última troca.
        deAntemaoAte: null
    };

    const tamanhos = {};
    const indices = {};
    const historico = [];
    const amostras = []; // [instante, reserva, estado da descarga]
    let anterior = null;
    let relogio = null;
    let parado = false;
    let falas = null;
    let ultimaGravacao = 0;
    let ultimoVolumeEscrito = null;
    // A troca de ficheiro em curso (cada uma tem o seu número) e a imagem
    // que a tapa. Uma troca que começa antes de a anterior acabar fica com
    // a capa dela, que já mostra a última imagem boa.
    let numeroDaTroca = 0;
    let capaAtual = null;

    const registar = (o) => {
        historico.push(Object.assign({ t: +(agora() / 1000).toFixed(2) }, o));
        if (historico.length > 200) historico.shift();
    };

    // --- O peso de cada versão --------------------------------------------------

    function duracao() {
        return isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    }

    /**
     * Quantos megabits por segundo pesa uma versão: pelo tamanho real do
     * ficheiro, quando já se sabe; senão, pela tabela.
     */
    function pesoDe(r) {
        const d = duracao();
        if (tamanhos[r] && d) return tamanhos[r] * 8 / d / 1e6;
        return debitoDe(nome, r);
    }

    /** O peso dos próximos segundos de uma versão, se o índice dela já veio. */
    function pesoAFrente(r, de, segundos) {
        const indice = indices[r] && indices[r].pronto;
        const media = pesoDe(r);
        if (!indice) return media;
        const fim = Math.min(duracao() || de + segundos, de + segundos);
        const m = fim > de + 2 ? indice.mbpsEntre(de, fim) : 0;
        return m > 0 ? Math.max(m, media * 0.6) : media;
    }

    function bytesPorSegundo(r) {
        return pesoDe(r) * 1e6 / 8;
    }

    // Os tamanhos chegam com um pedido pequeníssimo a cada ficheiro.
    function conhecerTamanhos() {
        escada.forEach((r) => {
            const url = fontes[r];
            if (tamanhosConhecidos.has(url)) { tamanhos[r] = tamanhosConhecidos.get(url); return; }
            fetch(url, { method: 'HEAD' }).then((resposta) => {
                const n = parseInt(resposta.headers.get('content-length'), 10);
                if (n > 0) {
                    tamanhos[r] = n;
                    tamanhosConhecidos.set(url, n);
                }
            }).catch(() => { /* fica a tabela */ });
        });
    }

    function indiceDe(r) {
        const url = fontes[r];
        // Um índice que não veio só se volta a pedir passado um minuto.
        if (indices[r] && indices[r].falhou && agora() - indices[r].falhou > 60000) delete indices[r];
        if (!indices[r]) {
            let pedido = indicesConhecidos.get(url);
            if (!pedido || (pedido.falhou && agora() - pedido.falhou > 60000)) {
                pedido = { pronto: null, promessa: null, falhou: 0 };
                // O da versão que está a dar lê-se por um endereço só dele (a
                // nuvem dá o mesmo ficheiro): ler bocados de um ficheiro
                // enquanto o próprio filme o está a descarregar faz o Chrome
                // deitar fora a cópia que estava a guardar, e a visita
                // seguinte tinha de o descarregar outra vez. O das outras
                // versões lê-se pelo endereço de sempre, para o navegador o
                // ter já guardado quando se trocar para lá.
                const aDar = r === estado.resolucao;
                pedido.promessa = lerIndice(aDar ? url + (url.includes('?') ? '&' : '?') + 'indice=1' : url).then((i) => {
                    pedido.pronto = i;
                    return i;
                }).catch(() => {
                    // Sem índice, a troca faz-se como antigamente: pode demorar.
                    pedido.falhou = agora();
                    return null;
                });
                indicesConhecidos.set(url, pedido);
            }
            indices[r] = pedido;
        }
        return indices[r].promessa;
    }

    /**
     * Com a ligação folgada (o navegador parou de descarregar por já ter
     * reserva), vai-se buscando o índice das outras versões, um de cada
     * vez: primeiro o da de baixo, que é para onde se desce à pressa se a
     * ligação cair — e aí já não há tempo nem ligação para o ir buscar —,
     * depois o da de cima, depois os outros. Cada um são uns cem a duzentos
     * KB.
     */
    function adiantarIndices() {
        if (Object.values(indices).some(p => !p.pronto && !p.falhou)) return; // um de cada vez
        const lugar = escada.indexOf(estado.resolucao);
        const ordem = [lugar - 1, lugar + 1, lugar - 2, lugar + 2, lugar - 3, lugar + 3]
            .filter(i => i >= 0 && i < escada.length)
            .map(i => escada[i]);
        const seguinte = ordem.find(r => !indices[r]);
        if (seguinte) indiceDe(seguinte);
    }

    // --- Limites que não dependem da ligação ------------------------------------

    /**
     * A versão mais nítida que faz sentido para o tamanho actual do player.
     *
     * @returns {number} Altura máxima útil, em pontos.
     */
    function limiteDoEcra() {
        const caixa = moldura || video;
        const pontos = window.devicePixelRatio || 1;
        const alto = caixa.clientHeight || window.innerHeight;
        if (e360(nome)) return alto * pontos * FATOR_PANORAMICO * TOLERANCIA_DO_ECRA;
        // Numa janela mais estreita do que o filme, o que manda é a largura.
        const largo = caixa.clientWidth || window.innerWidth;
        const proporcao = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
        return Math.min(alto, largo / proporcao) * pontos * TOLERANCIA_DO_ECRA;
    }

    /**
     * Tecto imposto pelo aparelho e pelas preferências do site: o modo de
     * poupança de dados, a qualidade escolhida nas definições e, nas rotas
     * 360º, o que a placa gráfica aguenta.
     *
     * @returns {number} Altura máxima permitida, em pontos.
     */
    function limiteDoAparelho() {
        const ligacaoDoNavegador = navigator.connection;
        if (ligacaoDoNavegador && ligacaoDoNavegador.saveData) return 480;

        let tecto = 1440;
        let escolhaDoSite = null;
        try {
            escolhaDoSite = localStorage.getItem('quality');
        } catch (e) {
            escolhaDoSite = null;
        }
        if (escolhaDoSite === 'low') tecto = 720;
        else if (escolhaDoSite === 'med') tecto = 1080;

        // Uma rota é aberta como uma imagem única à volta do
        // observador: se a placa gráfica não a conseguir guardar inteira,
        // aparece preta. Mais vale nem oferecer essa versão.
        if (e360(nome) && limiteDeTextura) {
            const cabe = escada.filter(r => alturaDe(nome, r) * 2 <= limiteDeTextura);
            const maior = cabe.length ? alturaDe(nome, cabe[cabe.length - 1]) : 480;
            tecto = Math.min(tecto, maior);
        }
        return tecto;
    }

    /** As versões que o aparelho e as preferências permitem. */
    function aguentadas() {
        const tecto = limiteDoAparelho();
        const lista = escada.filter(r => alturaDe(nome, r) <= tecto);
        return lista.length ? lista : [escada[0]];
    }

    /**
     * As versões para onde se pode ir: as que o aparelho permite e o ecrã
     * consegue mostrar. O ecrã só conta para o que se escolhe de novo: um
     * player que ficou mais pequeno não é razão para trocar a versão que
     * já está a dar.
     *
     * @returns {string[]} Resoluções, da mais leve para a mais nítida.
     */
    function permitidas() {
        const tectoEcra = limiteDoEcra();
        const lista = aguentadas().filter(r => alturaDe(nome, r) <= tectoEcra);
        return lista.length ? lista : [escada[0]];
    }

    /**
     * A melhor versão que uma ligação aguenta com uma dada folga.
     *
     * @param {number} mbps - A ligação.
     * @param {number} folga - Quantas vezes o peso da versão tem de caber nela.
     * @param {string[]} [lista] - As versões onde escolher.
     * @returns {string} A resolução.
     */
    function melhorPara(mbps, folga, lista = permitidas()) {
        let escolha = lista[0];
        lista.forEach((r) => {
            if (pesoDe(r) * folga <= mbps) escolha = r;
        });
        return escolha;
    }

    /**
     * Para uma troca já, sem tempo de a preparar: a versão mais nítida que
     * arranca em menos de dois segundos com a ligação de agora, e que a
     * ligação aguente. Arrancar a meio do intervalo entre duas imagens-chave
     * obriga a descarregar tudo desde a anterior — e nas rotas esse intervalo
     * chega aos dez segundos: numa versão pesada, com a ligação fraca, eram
     * dezenas de segundos de imagem parada.
     */
    function maisRapidaAArrancar(candidatas, mbps) {
        const t = video.currentTime;
        let escolha = candidatas[0];
        candidatas.forEach((r) => {
            const indice = indices[r] && indices[r].pronto;
            const atras = indice ? Math.max(0, t - indice.chaveAntesDe(t)) : 10;
            const bytes = (indice ? 0 : 200 * 1024) + (atras + 1.5) * pesoDe(r) * 1e6 / 8;
            const segundos = mbps > 0 ? bytes * 8 / (mbps * 1e6) : Infinity;
            if (segundos <= 2 && pesoDe(r) * FOLGA_PARA_SUBIR <= mbps) escolha = r;
        });
        return escolha;
    }

    /**
     * Uma descida que já não pode esperar pelo momento certo: troca-se já,
     * para a versão até `para` que arranque mais depressa.
     */
    function descerJa(para, razao) {
        const candidatas = escada.filter(r => alturaDe(nome, r) <= alturaDe(nome, para));
        const deAgora = ligacao.agora(3) || ligacao.rapida.valor;
        const prudente = [deAgora, ligacao.valor, ligacao.pior(2)].filter(x => x > 0).reduce((a, b) => Math.min(a, b), Infinity);
        trocarJa(maisRapidaAArrancar(candidatas, isFinite(prudente) ? prudente : 0), razao);
    }

    /**
     * Numa descida com pressa, a versão escolhida só serve se o índice dela
     * já cá estiver (ir buscá-lo com a ligação fraca leva segundos que não
     * há): senão, a mais alta abaixo dela que o tenha.
     */
    function comIndice(alvo, candidatas) {
        if (indices[alvo] && indices[alvo].pronto) return alvo;
        const abaixoDoAlvo = candidatas.slice(0, candidatas.indexOf(alvo) + 1).reverse();
        return abaixoDoAlvo.find(r => indices[r] && indices[r].pronto) || alvo;
    }

    function estaCastigada(r) {
        const f = estado.falhas[r];
        if (!f) return false;
        const espera = Math.min(CASTIGO_MAXIMO, CASTIGO * Math.pow(2, f.vezes - 1));
        return agora() - f.quando < espera;
    }

    function castigar(r) {
        const f = estado.falhas[r] || { vezes: 0, quando: 0 };
        // Uma falha antiga já não conta para dobrar o castigo.
        if (agora() - f.quando > 30 * 60000) f.vezes = 0;
        f.vezes++;
        f.quando = agora();
        estado.falhas[r] = f;
    }

    // --- Medir ------------------------------------------------------------------

    /**
     * A parte já descarregada que contém o ponto actual, tal como o
     * navegador a diz: [início, fim], em segundos.
     *
     * No Chrome (e nos navegadores feitos a partir dele) esses segundos não
     * são do filme: o que está descarregado é contado em bytes e passado a
     * segundos como se o filme pesasse o mesmo do princípio ao fim. Num
     * filme que pesa mais numas partes do que noutras, isso erra por muitos
     * segundos — numa rota, o Chrome chega a dizer que tem 5 segundos de
     * reserva quando tem 17. Com o tamanho e o índice do ficheiro, procura-se
     * a parte pelo byte onde o filme vai, e não pelo segundo.
     */
    function faixaActual() {
        const t = video.currentTime;
        const conta = contaEmBytes();
        if (conta) {
            const aqui = conta.indice.byteNoTempo(t);
            for (let i = 0; i < video.buffered.length; i++) {
                const de = video.buffered.start(i);
                const ate = video.buffered.end(i);
                if (de * conta.bytesPorSegundo <= aqui + 2 * BOCADO && ate * conta.bytesPorSegundo >= aqui) return [de, ate];
            }
        }
        for (let i = 0; i < video.buffered.length; i++) {
            if (video.buffered.start(i) <= t + 0.1 && t <= video.buffered.end(i)) {
                return [video.buffered.start(i), video.buffered.end(i)];
            }
        }
        return [t, t];
    }

    /** Se os segundos do navegador são bytes disfarçados, e como os desfazer. */
    function contaEmBytes() {
        if (!CONTA_EM_BYTES) return null;
        const pedido = indices[estado.resolucao];
        const indice = pedido && pedido.pronto;
        const total = tamanhos[estado.resolucao];
        const d = duracao();
        if (!indice || !total || !d) return null;
        return { indice, bytesPorSegundo: total / d };
    }

    /**
     * Quantos segundos do filme estão descarregados à frente do ponto actual.
     *
     * No Chrome, aos bytes passados a segundos junta-se, na mesma lista, o
     * bocadinho que o leitor já tirou do ficheiro, esse em segundos a sério
     * — e quando os dois se colam não se sabe qual dos dois manda no fim.
     * Com o navegador parado por já ter que chegue, o fim é sempre dos
     * bytes (ele tem muitos à frente), e a conta pelo índice é a certa. A
     * descarregar, conta-se o mais baixo dos dois: mais vale julgar a
     * reserva um pouco mais curta do que ela é do que contar com segundos
     * que ainda não chegaram.
     */
    function reserva() {
        const t = video.currentTime;
        const fim = faixaActual()[1];
        const bruta = Math.max(0, fim - t);
        const conta = contaEmBytes();
        if (!conta) return bruta;
        const certa = Math.max(0, conta.indice.tempoAteAoByte(fim * conta.bytesPorSegundo) - t);
        return video.networkState === SEM_DESCARREGAR ? certa : Math.min(bruta, certa);
    }

    /**
     * Mede a ligação pela própria descarga do filme: entre duas olhadelas
     * com o navegador a descarregar o tempo todo, quantos bytes chegaram.
     * Com o navegador parado (por já ter reserva que chegue), não há nada
     * para medir — e isso também diz alguma coisa: que a ligação chega.
     */
    function medirDescarga() {
        const t = agora();
        const fim = faixaActual()[1];
        const ns = video.networkState;
        const atual = { t, fim, ns, resolucao: estado.resolucao };
        // Logo depois de uma troca preparada, o filme vem da memória do
        // navegador (foi descarregado de antemão), e isso não diz nada da
        // ligação: só se mede depois de o filme passar o que lá estava.
        const deAntemao = estado.deAntemaoAte;
        if (deAntemao && deAntemao.resolucao === estado.resolucao) {
            const conta = contaEmBytes();
            const passou = conta ? fim * conta.bytesPorSegundo > deAntemao.byte : fim > deAntemao.tempo;
            if (!passou) { anterior = atual; return; }
            estado.deAntemaoAte = null;
        }
        // Só conta a descarga a meio de uma corrida: no primeiro meio segundo
        // depois de o navegador voltar a descarregar chega de rajada o que
        // ficou à espera pelo caminho (no próprio computador, no router), e
        // a ligação pareceria muito mais rápida do que é.
        atual.aCorrer = ns === A_DESCARREGAR && !!anterior && anterior.ns === A_DESCARREGAR;
        if (anterior && anterior.aCorrer && anterior.resolucao === atual.resolucao && !estado.aTrocar && !video.seeking &&
            ns === A_DESCARREGAR && fim > anterior.fim) {
            const segundos = (t - anterior.t) / 1000;
            if (segundos > 0.2 && segundos < 3) {
                const bytes = (fim - anterior.fim) * bytesPorSegundo(estado.resolucao);
                ligacao.juntar(bytes * 8 / segundos / 1e6, segundos);
            }
        }
        anterior = atual;
    }

    /**
     * Para onde vai a reserva: segundos ganhos (ou perdidos) por segundo,
     * nos últimos segundos.
     */
    function ritmoDaReserva(segundos) {
        const desde = agora() - segundos * 1000;
        const recentes = amostras.filter(a => a[0] >= desde);
        if (recentes.length < 4) return null;
        let sx = 0;
        let sy = 0;
        let sxx = 0;
        let sxy = 0;
        recentes.forEach(([x, y]) => {
            const xs = x / 1000;
            sx += xs; sy += y; sxx += xs * xs; sxy += xs * y;
        });
        const n = recentes.length;
        return (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx);
    }

    /** Se o navegador parou de descarregar, por já ter reserva, nos últimos segundos. */
    function cheioHaPouco(segundos) {
        return agora() - estado.ultimoCheio < segundos * 1000;
    }

    // --- Os silêncios -------------------------------------------------------------

    function carregarFalas() {
        const leg = window.Legendas;
        if (!leg || typeof leg.falas !== 'function') return;
        leg.falas(nome).then((lista) => { falas = Array.isArray(lista) ? lista : null; }).catch(() => {});
    }

    /** Se num momento ninguém está a falar (pelas legendas). */
    function emSilencio(t) {
        if (!falas || !falas.length) return false;
        const de = t - SILENCIO_ANTES;
        const ate = t + SILENCIO_DEPOIS;
        return !falas.some(f => f.inicio < ate && f.fim > de);
    }

    // --- Mudar de ficheiro ---------------------------------------------------------

    /**
     * Passa o vídeo para outra versão, no ponto onde está, de imediato.
     * É o que se faz ao arrancar, quando alguém escolhe à mão, e quando já
     * nem há tempo para preparar a troca.
     */
    function trocarJa(resolucao, razao) {
        if (!fontes[resolucao] || resolucao === estado.resolucao) return;
        if (estado.troca) estado.troca.desmarcar('troca imediata');
        if (!estado.resolucao) {
            estado.resolucao = resolucao;
            estado.ultimaMudanca = agora();
            estado.assentaAte = agora() + TEMPO_A_ASSENTAR;
            video.src = fontes[resolucao];
            registar({ tipo: 'inicio', para: resolucao, razao });
            if (aoMudar) aoMudar(estado.resolucao, estado.modo);
            return;
        }
        mudarDeFicheiro(resolucao, video.currentTime, razao, video.volume);
    }

    /**
     * Muda o ficheiro do filme e volta ao mesmo ponto. Enquanto a versão
     * nova não mostra a primeira imagem, fica à vista a última da antiga.
     *
     * @param {string} resolucao - A versão nova.
     * @param {number} momento - O ponto do filme onde a nova começa.
     * @param {string} razao - Porquê (fica no histórico).
     * @param {number} volume - O volume a repor no fim.
     */
    function mudarDeFicheiro(resolucao, momento, razao, volume, deAntemao) {
        const esta = ++numeroDaTroca;
        const de = estado.resolucao;
        const estavaAPausa = video.paused;
        const velocidade = video.playbackRate;
        if (!capaAtual) capaAtual = taparComAUltimaImagem();
        estado.aTrocar = true;
        video.dataset.trocaDeVersao = '1';
        video.dispatchEvent(new CustomEvent('trocadeversao', { detail: { fase: 'comeca', de, para: resolucao } }));

        estado.resolucao = resolucao;
        estado.ultimaMudanca = agora();
        estado.assentaAte = agora() + TEMPO_A_ASSENTAR;
        estado.subirDesde = 0;
        estado.descerDesde = 0;
        amostras.length = 0;
        anterior = null;
        estado.deAntemaoAte = deAntemao ? { resolucao, byte: deAntemao.ateAoByte, tempo: deAntemao.ateAoTempo } : null;
        registar({ tipo: 'troca', de, para: resolucao, razao, em: +momento.toFixed(2) });

        if (!estavaAPausa) {
            video.volume = 0;
            ultimoVolumeEscrito = 0;
        }
        video.src = fontes[resolucao];
        video.addEventListener('loadedmetadata', () => {
            if (parado) return;
            video.currentTime = momento;
            video.playbackRate = velocidade;
            if (!estavaAPausa) video.play().catch(() => { /* outra troca, ou fechou-se */ });
        }, { once: true });

        // A troca dá a vez ao player (o tempo escrito, o quadrado de espera,
        // as legendas) quando a imagem nova aparece — ou, se ela tardar, ao
        // fim de um segundo e meio: daí em diante é espera a sério, e o
        // player mostra-a como sempre.
        let solta = false;
        const soltar = () => {
            if (solta) return;
            solta = true;
            clearTimeout(soltarJa);
            // Uma troca que outra veio substituir já não manda em nada.
            if (esta !== numeroDaTroca) return;
            estado.aTrocar = false;
            delete video.dataset.trocaDeVersao;
            video.dispatchEvent(new CustomEvent('trocadeversao', { detail: { fase: 'acabou', de, para: resolucao } }));
        };
        const soltarJa = setTimeout(soltar, 1500);
        let acabou = false;
        const acabar = () => {
            if (acabou) return;
            acabou = true;
            clearTimeout(desistir);
            if (esta !== numeroDaTroca) return;
            soltar();
            if (capaAtual) { capaAtual.remove(); capaAtual = null; }
            if (!estavaAPausa) subirOSom(volume);
        };
        // Se a imagem nova tardar muito (a ligação caiu), a capa sai na mesma.
        const desistir = setTimeout(acabar, 8000);
        quandoMostrarImagemDe(momento, acabar);
        if (aoMudar) aoMudar(estado.resolucao, estado.modo);
    }

    /** Chama `depois` quando o filme mostrar a imagem de um momento. */
    function quandoMostrarImagemDe(momento, depois) {
        let feito = false;
        const uma = () => {
            if (feito) return;
            feito = true;
            depois();
        };
        if (typeof video.requestVideoFrameCallback === 'function') {
            const ver = (instante, info) => {
                if (parado || feito) return;
                if (info && info.mediaTime >= momento - 0.05 && video.readyState >= 2) uma();
                else video.requestVideoFrameCallback(ver);
            };
            video.requestVideoFrameCallback(ver);
        }
        // Sem o aviso de cada imagem (ou com a página escondida, onde ele não
        // vem), basta o filme ter imagem e estar no sítio.
        const vigia = setInterval(() => {
            if (parado || feito) { clearInterval(vigia); return; }
            if (video.readyState >= 3 && !video.seeking && video.currentTime >= momento - 0.05 &&
                (document.hidden || typeof video.requestVideoFrameCallback !== 'function')) {
                clearInterval(vigia);
                uma();
            }
        }, 50);
        setTimeout(() => clearInterval(vigia), 9000);
    }

    /**
     * Põe por cima do filme a imagem que está à vista, para a troca não
     * passar por um ecrã preto. Nas rotas não é preciso: a esfera guarda
     * sozinha a última imagem até chegar a seguinte.
     */
    function taparComAUltimaImagem() {
        if (e360(nome) || !video.videoWidth || !video.offsetWidth || !video.parentNode || video.readyState < 2) return null;
        try {
            const tela = document.createElement('canvas');
            const escala = Math.min(1, 1920 / video.videoWidth);
            tela.width = Math.round(video.videoWidth * escala);
            tela.height = Math.round(video.videoHeight * escala);
            tela.getContext('2d').drawImage(video, 0, 0, tela.width, tela.height);
            tela.className = 'capa-da-troca';
            tela.setAttribute('aria-hidden', 'true');
            Object.assign(tela.style, {
                position: 'absolute',
                left: video.offsetLeft + 'px',
                top: video.offsetTop + 'px',
                width: video.offsetWidth + 'px',
                height: video.offsetHeight + 'px',
                objectFit: getComputedStyle(video).objectFit || 'contain',
                pointerEvents: 'none',
                zIndex: '2'
            });
            video.insertAdjacentElement('afterend', tela);
            return tela;
        } catch (e) {
            // Um filme de outra casa sem licença para ser copiado: sem capa.
            return null;
        }
    }

    /** O som volta devagarinho ao volume que tinha. */
    function subirOSom(alvo) {
        const passos = 6;
        let passo = 0;
        const subir = setInterval(() => {
            // Se entretanto alguém mexeu no volume, manda quem mexeu.
            if (parado || video.volume !== ultimoVolumeEscrito) { clearInterval(subir); return; }
            passo++;
            video.volume = Math.min(1, Math.max(0, alvo * passo / passos));
            ultimoVolumeEscrito = video.volume;
            if (passo >= passos) clearInterval(subir);
        }, SUBIR_O_SOM * 1000 / passos);
    }

    /** O som desce até ao silêncio, a caminho da troca. Devolve o volume de antes. */
    function descerOSom() {
        const inicial = video.volume;
        const passos = 5;
        let passo = 0;
        ultimoVolumeEscrito = inicial;
        const descer = setInterval(() => {
            if (parado || estado.aTrocar || video.volume !== ultimoVolumeEscrito) { clearInterval(descer); return; }
            passo++;
            video.volume = Math.max(0, inicial * (1 - passo / passos));
            ultimoVolumeEscrito = video.volume;
            if (passo >= passos) clearInterval(descer);
        }, DESCER_O_SOM * 1000 / passos);
        return inicial;
    }

    // --- Preparar uma troca -------------------------------------------------------

    /**
     * Descarrega de antemão, para a memória do navegador, os bytes de que
     * uma versão precisa para arrancar num momento: o índice, o princípio do
     * ficheiro (que o navegador lê sempre ao abrir um) e os segundos a
     * seguir ao momento. Mede a ligação pelo caminho.
     *
     * @returns {Promise<{mbps: number, segundos: number, bytes: number}>}
     */
    async function descarregarDeAntemao(r, momento, segundos, sinal, aoMedir) {
        const indice = await indiceDe(r);
        if (!indice) throw new Error('sem índice');
        const alinhar = n => Math.max(0, Math.floor(n / BOCADO) * BOCADO - BOCADO);
        const faixas = [{ inicio: alinhar(indice.moov.inicio), fim: indice.moov.fim }];
        const principio = indice.bytesEntre(0, SEGUNDOS_DO_PRINCIPIO);
        if (principio) faixas.push({ inicio: 0, fim: principio.fim });
        const filme = indice.bytesEntre(indice.chaveAntesDe(momento), momento + segundos);
        if (!filme) throw new Error('fora do filme');
        faixas.push({ inicio: alinhar(filme.inicio), fim: filme.fim, medir: true });

        let medido = null;
        for (const f of faixas) {
            const comeco = agora();
            const resposta = await fetch(fontes[r], { headers: { Range: `bytes=${f.inicio}-${f.fim}` }, signal: sinal });
            if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status}`);
            const leitor = resposta.body.getReader();
            let bytes = 0;
            for (;;) {
                const { done, value } = await leitor.read();
                if (done) break;
                bytes += value.byteLength;
                const s = (agora() - comeco) / 1000;
                if (f.medir && aoMedir && s > 0.6 && bytes > 256 * 1024) aoMedir(bytes * 8 / s / 1e6, s);
            }
            if (f.medir) {
                const s = (agora() - comeco) / 1000;
                medido = { mbps: s > 0 ? bytes * 8 / s / 1e6 : 0, segundos: s, bytes, ateAoByte: f.fim, ateAoTempo: momento + segundos };
            }
        }
        return medido;
    }

    /**
     * Escolhe o momento da troca: uma imagem-chave da versão nova dentro de
     * uma janela de tempo — de preferência num silêncio.
     */
    function escolherMomento(indice, de, ate, preferirSilencio) {
        const chaves = indice ? indice.chaves.filter(c => c >= de && c <= ate) : [];
        if (!chaves.length) return null;
        if (preferirSilencio) {
            const calada = chaves.find(c => emSilencio(c));
            if (calada !== undefined) return { momento: calada, silencio: true };
        }
        return { momento: chaves[0], silencio: emSilencio(chaves[0]) };
    }

    /**
     * Marca uma troca: escolhe o momento, descarrega de antemão, e muda de
     * ficheiro quando o filme lá chegar.
     *
     * @param {string} para - A versão nova.
     * @param {string} razao - Porquê (fica no histórico).
     * @param {object} o - `pressa` (a reserva vai acabar) e `ensaio` (uma
     *   subida: só se faz se a ligação aguentar a descarga com folga).
     */
    async function marcarTroca(para, razao, o) {
        if (estado.troca || estado.aTrocar) return;
        const pressa = !!o.pressa;
        const controlo = new AbortController();
        const troca = { para, razao, pressa, ensaio: !!o.ensaio, controlo, momento: null, pronta: false };
        estado.troca = troca;
        if (o.ensaio) estado.ultimoEnsaio = agora();
        registar({ tipo: 'marcada', para, razao });
        let parcial = null;
        troca.desmarcar = (porque) => {
            if (estado.troca !== troca) return;
            estado.troca = null;
            controlo.abort();
            if (parcial) ligacao.juntar(parcial.mbps, Math.min(parcial.segundos, 4));
            registar({ tipo: 'desmarcada', para, razao: porque });
        };

        try {
            const indice = await Promise.race([
                indiceDe(para),
                new Promise(r => setTimeout(() => r(null), pressa ? 2500 : 8000))
            ]);
            if (estado.troca !== troca) return;
            const t = video.currentTime;
            const resta = reserva();
            let de;
            let ate;
            if (o.ensaio) {
                // A subir há tempo: a reserva está cheia e vai-se enchendo.
                de = t + JANELA_PARA_SUBIR[0];
                ate = t + JANELA_PARA_SUBIR[1];
            } else {
                // A descer, o ponto da troca tem de estar dentro do que a
                // versão de agora já tem descarregado: até lá, continua ela.
                // Com pressa, o ponto fica depois do tempo que a preparação
                // deve levar (com folga), ou chegava-se lá sem ela feita.
                const antes = pressa && o.preparar > 0 ? Math.max(0.8, o.preparar * 1.3) : JANELA_PARA_DESCER[0];
                ate = t + Math.min(JANELA_PARA_DESCER[1], Math.max(0, resta - 1));
                de = Math.min(ate, t + Math.min(antes, Math.max(0.8, resta * 0.6)));
            }
            const escolha = indice ? escolherMomento(indice, de, ate, !pressa) : null;
            if (!escolha) {
                if (o.ensaio) { troca.desmarcar('sem imagem-chave a tempo'); return; }
                // Sem imagem-chave a tempo: troca-se já, onde se estiver.
                estado.troca = null;
                descerJa(para, razao + ', sem imagem-chave a tempo');
                return;
            }
            troca.momento = escolha.momento;
            troca.silencio = escolha.silencio;

            // O ensaio: se a ligação não descarregar com folga, desiste-se.
            const preciso = pesoAFrente(para, escolha.momento, 30) * FOLGA_PARA_SUBIR;
            let medido = null;
            try {
                medido = await descarregarDeAntemao(para, escolha.momento,
                    pressa ? SEGUNDOS_PREPARADOS_COM_PRESSA : SEGUNDOS_PREPARADOS, controlo.signal, (mbps, s) => {
                        parcial = { mbps, segundos: s };
                        if (troca.ensaio && s > 1.5 && mbps < preciso * 0.5) troca.desmarcar('ensaio: a ligação não chega');
                    });
                parcial = null;
            } catch (e) {
                if (estado.troca !== troca) return;
                if (troca.ensaio) { troca.desmarcar('ensaio falhou'); return; }
                // A descer, troca-se na mesma: só demora mais um pouco.
            }
            if (estado.troca !== troca) return;
            if (medido && medido.bytes > 200 * 1024) {
                // Um ensaio rápido também conta: uns megas que chegam num instante
                // dizem tanto da ligação como uma descarga longa.
                ligacao.juntar(medido.mbps, Math.max(MEDIDA_MINIMA, Math.min(medido.segundos, 4)));
            }
            if (troca.ensaio) {
                const passou = !!medido && medido.mbps >= preciso;
                registar({ tipo: 'ensaio', para, mbps: medido ? +medido.mbps.toFixed(1) : 0, preciso: +preciso.toFixed(1), passou });
                if (!passou) { troca.desmarcar('ensaio: a ligação não chega'); return; }
            }
            if (video.currentTime > troca.momento - 0.15) {
                // O momento passou enquanto se preparava.
                if (troca.ensaio) { troca.desmarcar('o momento passou'); return; }
                estado.troca = null;
                descerJa(para, razao + ', o momento passou');
                return;
            }
            troca.pronta = true;
            troca.deAntemao = medido;
            esperarPeloMomento(troca);
        } catch (e) {
            troca.desmarcar('erro: ' + (e && e.message));
        }
    }

    /** Fica a ver o filme até ao momento marcado, e troca lá. */
    function esperarPeloMomento(troca) {
        let somADescer = false;
        let volume = video.volume;
        let ultimaImagem = null;
        const ver = () => {
            if (estado.troca !== troca || parado) return false;
            // Escondida, a página só olha para o relógio de segundo a segundo,
            // e a troca chegaria tarde: desmarca-se (há-de voltar a decidir-se).
            if (document.hidden && !troca.pressa) { troca.desmarcar('página escondida'); return false; }
            const t = ultimaImagem !== null ? Math.max(ultimaImagem, video.currentTime - 0.04) : video.currentTime;
            if (!somADescer && !video.paused && t >= troca.momento - UMA_IMAGEM - DESCER_O_SOM) {
                somADescer = true;
                volume = descerOSom();
            }
            if (t >= troca.momento - UMA_IMAGEM) {
                estado.troca = null;
                mudarDeFicheiro(troca.para, troca.momento,
                    troca.razao + (troca.silencio ? ', num silêncio' : ''), volume, troca.deAntemao);
                return false;
            }
            return true;
        };
        if (typeof video.requestVideoFrameCallback === 'function') {
            const cadaImagem = (instante, info) => {
                ultimaImagem = info ? info.mediaTime : null;
                if (ver()) video.requestVideoFrameCallback(cadaImagem);
            };
            video.requestVideoFrameCallback(cadaImagem);
        }
        const vigia = setInterval(() => {
            if (!ver()) clearInterval(vigia);
        }, 15);
    }

    // --- Decidir --------------------------------------------------------------

    /**
     * Olha para o estado do vídeo e, se for caso disso, marca uma troca.
     */
    function analisar() {
        if (parado || !estado.resolucao) return;
        const t = agora();
        const resta = reserva();
        const ns = video.networkState;
        if (!estado.aTrocar && !video.seeking) {
            amostras.push([t, resta, ns]);
            if (ns === SEM_DESCARREGAR && resta >= 4) estado.ultimoCheio = t;
        }
        while (amostras.length && amostras[0][0] < t - 20000) amostras.shift();
        if (!estado.jaAndou && !video.paused && video.readyState >= 3 && video.currentTime > 0.2) estado.jaAndou = true;
        medirDescarga();
        guardarDeTantoEmTanto();
        // O índice da versão que está a dar faz falta para contar a reserva
        // a sério (ver faixaActual). Pede-se quando a reserva já está
        // folgada: logo no arranque, com a ligação fraca, os cem ou duzentos
        // KB dele eram tirados ao próprio filme, que parava.
        if (estado.jaAndou && !indices[estado.resolucao] && !estado.aTrocar &&
            (cheioHaPouco(3) || resta >= 8)) indiceDe(estado.resolucao);

        if (estado.modo !== 'auto' || estado.aTrocar || video.seeking || video.ended) return;
        // Escondida, a página não desenha nem descarrega como devia: o que
        // se visse agora não diria nada da ligação.
        if (document.hidden) { estado.subirDesde = 0; estado.descerDesde = 0; return; }

        const atual = estado.resolucao;
        const todas = aguentadas();
        const posicao = todas.indexOf(atual);
        const estimativa = ligacao.valor;
        const deAgora = ligacao.agora(3) || ligacao.rapida.valor;
        const peso = pesoDe(atual);
        const abaixo = posicao > 0 ? todas.slice(0, posicao) : [];

        // Antes de a primeira imagem aparecer: se está a demorar porque a
        // versão escolhida é pesada de mais para a ligação, desce-se já —
        // ainda ninguém viu nada.
        if (!estado.jaAndou) {
            if (abaixo.length && t - estado.ultimaMudanca > ARRANQUE_LENTO && video.readyState < 3 &&
                deAgora > 0 && deAgora < peso * FOLGA_PARA_FICAR) {
                trocarJa(melhorPara(deAgora, FOLGA_AO_DESCER, abaixo), 'arranque lento');
            }
            return;
        }
        if (video.paused) return;

        // Uma versão acima do que as preferências agora permitem (o modo de
        // poupança de dados, por exemplo): desce-se, com calma.
        if (posicao === -1) {
            if (!estado.troca && t >= estado.assentaAte) marcarTroca(todas[todas.length - 1], 'preferências do aparelho', {});
            return;
        }

        const cheio = cheioHaPouco(3);
        if (cheio && !estado.troca) adiantarIndices();
        // O que a versão actual pede nos segundos que vêm aí e, com o
        // navegador a descarregar sem parar, quanto a reserva perde por
        // segundo: se a ligação só traz um décimo do que o filme gasta, perde
        // nove décimos de segundo a cada segundo.
        const pede = pesoAFrente(atual, video.currentTime, 20);
        const gasta = !cheio && deAgora > 0 ? Math.max(0, 1 - deAgora / pede) : 0;
        const ateAcabar = gasta > 0.02 ? resta / gasta : Infinity;

        // Uma subida marcada que deixou de fazer sentido.
        if (estado.troca && estado.troca.ensaio && resta < 4 && !cheio) {
            estado.troca.desmarcar('a reserva encolheu');
        }

        // Uma descida à pressa que ainda não está pronta quando a reserva
        // acaba: troca-se já, para onde se estiver — o filme ia parar de
        // qualquer maneira, e assim pára menos.
        if (estado.troca && estado.troca.pressa && !estado.troca.pronta && resta < 1) {
            const { para } = estado.troca;
            descerJa(para, 'a reserva acabou antes de a troca estar pronta');
            return;
        }

        // --- Emergência: o filme vai parar, ou parou. ---
        if (abaixo.length && !(estado.troca && estado.troca.pressa)) {
            const assentado = t >= estado.assentaAte;
            const paragemRecente = estado.instanteDaParagem > estado.assentaAte && t - estado.instanteDaParagem < 3000;
            // Ainda a assentar (logo a seguir a arrancar, a trocar ou a saltar),
            // a reserva é pequena por natureza e a ligação mal foi medida: só
            // conta o filme parado a sério, há mais de dois segundos e meio.
            const paradoHaMuito = !assentado && estado.esperaDesde > 0 && t - estado.esperaDesde > 2500 && video.readyState < 3;
            const naoChega = !deAgora || deAgora < pede * FOLGA_PARA_FICAR;
            // Para onde: a versão que a ligação aguenta com folga larga —
            // pelo mais baixo do que ela deu agora e do que vem dando —, de
            // uma vez só: descer aos degraus era parar em cada um.
            // (Numa queda a média dos últimos segundos ainda traz o que veio
            // antes dela; a medição mais baixa desses segundos já não.)
            const prudente = [deAgora, estimativa, ligacao.pior(2)].filter(x => x > 0).reduce((a, b) => Math.min(a, b), Infinity);
            const alvo = comIndice(melhorPara(isFinite(prudente) ? prudente : 0, FOLGA_PARA_SUBIR, abaixo), abaixo);
            // O tempo de preparar a versão mais leve: o índice e uns segundos
            // de filme, a dividir a ligação com o filme que está a dar.
            const preparar = isFinite(prudente) && prudente > 0
                ? 1 + (SEGUNDOS_PREPARADOS_COM_PRESSA + 1) * pesoDe(alvo) / (prudente * 0.5)
                : 4;
            // Com folga para o preparar duas vezes: a medição do tempo de
            // preparar é otimista quando a ligação já está a falhar.
            const vaiParar = ateAcabar < 2 * preparar + MARGEM_DE_EMERGENCIA;
            if (naoChega && ((assentado && (paragemRecente || vaiParar)) || paradoHaMuito)) {
                if (estado.troca) estado.troca.desmarcar('emergência');
                registar({
                    tipo: 'emergencia', para: alvo, reserva: +resta.toFixed(1),
                    ligacaoAgora: +(deAgora || 0).toFixed(2), pede: +pede.toFixed(2),
                    ateAcabar: isFinite(ateAcabar) ? +ateAcabar.toFixed(1) : null,
                    parou: paragemRecente || paradoHaMuito
                });
                castigar(atual);
                if (paragemRecente || paradoHaMuito || resta < 1.5) {
                    trocarJa(maisRapidaAArrancar(abaixo, isFinite(prudente) ? prudente : 0), paragemRecente || paradoHaMuito ? 'o filme parou' : 'a reserva ia acabar');
                } else {
                    marcarTroca(alvo, 'a reserva ia acabar', { pressa: true, preparar });
                }
                return;
            }
        }

        if (t < estado.assentaAte || estado.troca) return;

        // --- Descer com calma: a ligação, medida com tempo, já não chega. ---
        // (O navegador a descarregar sem parar há oito segundos, e mesmo
        // assim a ligação abaixo do que o filme pede: a reserva vai-se gastando.)
        const encolhe = !cheioHaPouco(8) && estimativa > 0 && estimativa < pede * FOLGA_PARA_FICAR;
        if (abaixo.length && encolhe && t - estado.ultimaMudanca > ESPERA_PARA_DESCER) {
            if (!estado.descerDesde) estado.descerDesde = t;
            if (t - estado.descerDesde >= CONFIRMAR_DESCIDA) {
                estado.descerDesde = 0;
                castigar(atual);
                marcarTroca(melhorPara(estimativa, FOLGA_AO_DESCER, abaixo),
                    `a ligação (${estimativa.toFixed(1)} Mbps) já não chega`, {});
                return;
            }
        } else {
            estado.descerDesde = 0;
        }

        // --- Subir: reserva cheia, ligação de sobra, sem pressas. ---
        const lista = permitidas();
        const lugar = lista.indexOf(atual);
        const acima = lugar === -1 ? [] : lista.slice(lugar + 1).filter(r => !estaCastigada(r));
        const pertoDoFim = duracao() > 0 && duracao() - video.currentTime < PERTO_DO_FIM;
        const saudavel = cheioHaPouco(8) || (resta >= RESERVA_PARA_SUBIR && gasta === 0);
        if (!acima.length || pertoDoFim || !saudavel ||
            t - estado.ultimaMudanca < ESPERA_PARA_SUBIR || t - estado.ultimoEnsaio < ESPERA_ENTRE_ENSAIOS) {
            estado.subirDesde = 0;
            return;
        }
        // A versão mais alta que a ligação conhecida aguenta com folga.
        let alvo = null;
        acima.forEach((r) => {
            if (estimativa > 0 && pesoAFrente(r, video.currentTime, 30) * FOLGA_PARA_SUBIR <= estimativa) alvo = r;
        });
        // Com a ligação ainda por medir (o navegador encheu a reserva tão
        // depressa que não houve o que medir), ensaia-se a mais alta que o
        // ecrã permite: se o ensaio passar é uma troca só, em vez de subir
        // degrau a degrau; se não passar, desiste-se cedo e a ligação fica
        // medida.
        if (!alvo && cheioHaPouco(8) && !(estimativa > 0)) alvo = acima[acima.length - 1];
        if (!alvo) { estado.subirDesde = 0; return; }
        if (!estado.subirDesde) estado.subirDesde = t;
        if (t - estado.subirDesde < CONFIRMAR_SUBIDA) return;
        estado.subirDesde = 0;
        marcarTroca(alvo, estimativa > 0 ? `a ligação (${estimativa.toFixed(1)} Mbps) sobra` : 'reserva cheia, a ensaiar', { ensaio: true });
    }

    function aoEsperar() {
        if (!estado.esperaDesde && estado.jaAndou) estado.esperaDesde = agora();
        // Uma espera logo a seguir a um salto, ou durante uma troca, é
        // normal: o filme está só a carregar o sítio novo.
        if (estado.aTrocar || video.seeking || !estado.jaAndou) return;
        estado.instanteDaParagem = agora();
    }

    function aoTocar() {
        estado.esperaDesde = 0;
    }

    function aoSaltar() {
        if (estado.aTrocar) return;
        // Quem salta para outro sítio do filme muda tudo: a reserva começa
        // do zero, e o ponto marcado para trocar pode ter ficado para trás.
        if (estado.troca) estado.troca.desmarcar('salto no filme');
        estado.assentaAte = agora() + TEMPO_A_ASSENTAR;
        amostras.length = 0;
        anterior = null;
    }

    function guardarDeTantoEmTanto(forcar) {
        const t = agora();
        if (!forcar && t - ultimaGravacao < GUARDAR_DE_TANTO_EM_TANTO) return;
        ultimaGravacao = t;
        const valor = ligacao.valor;
        if (!(valor > 0) || ligacao.medida < 2) return;
        const m = lerMemoria() || {};
        m.v = 1;
        m.mbps = +valor.toFixed(2);
        m.quando = Date.now();
        // A última qualidade que correu bem (vinte segundos sem parar), por
        // tipo de vídeo: serve para quem quiser saber o que aconteceu.
        m.ultima = m.ultima || {};
        if (estado.resolucao && t - estado.ultimaMudanca > 20000 &&
            (!estado.instanteDaParagem || t - estado.instanteDaParagem > 20000)) {
            m.ultima[tipo] = alturaDe(nome, estado.resolucao);
        }
        guardarMemoria(m);
    }

    // --- O que o player usa -------------------------------------------------------

    const gestor = {
        /** Arranca: escolhe a primeira versão e começa a acompanhar. */
        arrancar() {
            // A primeira escolha sai do que se aprendeu antes neste
            // navegador (com este ou com outro vídeo, nesta ou noutra
            // visita); na primeira de todas, do que o navegador diz da
            // ligação. Uma medição só, a seguir, não manda trocar: corrige-se
            // com calma, como sempre.
            const lembrada = lembrarLigacao() > 0 || ligacao.medida >= MEDIDA_MINIMA;
            let mbps = ligacao.valor;
            if (!(mbps > 0)) {
                const doNavegador = navigator.connection;
                mbps = doNavegador && doNavegador.downlink > 0 ? doNavegador.downlink : (e360(nome) ? 6 : 3);
            }
            const inicial = melhorPara(mbps, lembrada ? FOLGA_NA_PRIMEIRA_LEMBRADA : FOLGA_NA_PRIMEIRA);
            trocarJa(inicial, `primeira escolha, ligação ${mbps.toFixed(1)} Mbps${lembrada ? ' (lembrada)' : ''}`);
            video.addEventListener('waiting', aoEsperar);
            video.addEventListener('playing', aoTocar);
            video.addEventListener('seeking', aoSaltar);
            relogio = setInterval(analisar, INTERVALO_DE_ANALISE);
            conhecerTamanhos();
            carregarFalas();
            return estado.resolucao;
        },

        /** Fixa uma versão à mão; o automático deixa de mandar. */
        fixar(resolucao) {
            estado.modo = 'manual';
            if (estado.troca) estado.troca.desmarcar('escolha à mão');
            if (resolucao === estado.resolucao) {
                if (aoMudar) aoMudar(estado.resolucao, estado.modo);
                return;
            }
            trocarJa(resolucao, 'escolha à mão');
        },

        /**
         * Devolve a decisão ao automático. Não se troca logo: a partir de
         * agora decide-se como sempre, com calma.
         */
        automatico() {
            estado.modo = 'auto';
            estado.subirDesde = 0;
            estado.descerDesde = 0;
            if (aoMudar) aoMudar(estado.resolucao, estado.modo);
        },

        /** A versão que está a tocar. */
        get resolucao() {
            return estado.resolucao;
        },

        /** 'auto' ou 'manual'. */
        get modo() {
            return estado.modo;
        },

        /** As versões que o aparelho e o ecrã permitem neste momento. */
        get permitidas() {
            return permitidas();
        },

        /** O que aconteceu: trocas, ensaios e porquês (para diagnóstico). */
        get historico() {
            return historico.slice();
        },

        /** Retrato do que o gestor sabe — serve para diagnóstico. */
        get diagnostico() {
            const ritmo = ritmoDaReserva(6);
            return {
                modo: estado.modo,
                resolucao: estado.resolucao,
                ligacaoMbps: +ligacao.valor.toFixed(2),
                ligacaoAgoraMbps: +ligacao.agora(3).toFixed(2),
                medidaSegundos: +ligacao.medida.toFixed(1),
                pesoMbps: estado.resolucao ? +pesoDe(estado.resolucao).toFixed(2) : 0,
                reserva: +reserva().toFixed(1),
                ritmo: ritmo === null ? null : +ritmo.toFixed(3),
                cheio: cheioHaPouco(3),
                trocaMarcada: estado.troca
                    ? { para: estado.troca.para, momento: estado.troca.momento, pronta: estado.troca.pronta }
                    : null,
                permitidas: permitidas(),
                limiteDoEcra: Math.round(limiteDoEcra()),
                limiteDoAparelho: limiteDoAparelho(),
                castigadas: Object.keys(estado.falhas).filter(estaCastigada)
            };
        },

        /** Pára de acompanhar (ao fechar o player). */
        parar() {
            guardarDeTantoEmTanto(true);
            parado = true;
            if (estado.troca) estado.troca.desmarcar('o player fechou');
            if (relogio) clearInterval(relogio);
            relogio = null;
            if (estado.aTrocar) {
                estado.aTrocar = false;
                delete video.dataset.trocaDeVersao;
            }
            if (capaAtual) { capaAtual.remove(); capaAtual = null; }
            video.removeEventListener('waiting', aoEsperar);
            video.removeEventListener('playing', aoTocar);
            video.removeEventListener('seeking', aoSaltar);
        }
    };

    return gestor;
}

/**
 * A maior imagem que a placa gráfica deste aparelho consegue usar.
 * Serve para não oferecer rotas que ela não conseguiria mostrar.
 *
 * @returns {number} Lado máximo em pontos, ou 0 se não se souber.
 */
export function limiteDeTexturaDoAparelho() {
    try {
        const tela = document.createElement('canvas');
        const gl = tela.getContext('webgl2') || tela.getContext('webgl');
        if (!gl) return 0;
        const limite = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
        const perder = gl.getExtension('WEBGL_lose_context');
        if (perder) perder.loseContext();
        return limite;
    } catch (e) {
        return 0;
    }
}
