import { alturaDe, debitoDe, eOriginal, e360 } from './videos.mjs?v=7';

/**
 * Escolha automática da qualidade dos vídeos.
 *
 * A ideia é a mesma dos grandes serviços de vídeo: em vez de obrigar a
 * pessoa a adivinhar que versão a sua ligação aguenta, o player decide
 * sozinho e vai corrigindo enquanto o vídeo corre.
 *
 * A decisão junta quatro coisas:
 *
 *  1. O tamanho do player no ecrã. Pôr uma versão de 1440p numa janela
 *     pequena gasta dados sem se ver diferença nenhuma. Nas rotas 360º a
 *     conta é outra: só se vê um pedaço da imagem de cada vez, por isso é
 *     preciso bastante mais do que o ecrã mostra.
 *  2. O que a ligação aguenta. Ao princípio pergunta-se ao navegador,
 *     que dá uma ideia grosseira; logo a seguir mede-se a sério, pedindo
 *     um pedaço de vídeo e cronometrando a chegada.
 *  3. Como está a correr. Se o vídeo pára para carregar, ou se a reserva
 *     de segundos adiantados encolhe, desce-se de versão de imediato. Se
 *     a reserva está folgada e sobra ligação, sobe-se — mas com calma,
 *     para a imagem não andar aos saltos entre qualidades.
 *  4. O que o aparelho consegue mostrar. Nas rotas 360º há placas
 *     gráficas que não conseguem sequer abrir a imagem de 8K.
 *
 * Quem escolher uma versão à mão manda sempre: a partir daí o automático
 * cala-se, até voltar a ser ligado.
 */

// De cada vez que se mede a ligação, só se conta com esta fatia. O resto
// é folga para os altos e baixos normais de uma ligação.
const MARGEM_DE_SEGURANCA = 0.7;

// Segundos de vídeo já descarregados a partir dos quais se considera que
// há reserva à vontade — e abaixo dos quais se considera aperto.
const RESERVA_FOLGADA = 15;
const RESERVA_APERTADA = 5;

// Para subir de versão exige-se esta folga sobre o que a versão seguinte
// precisa, confirmada em várias medições seguidas.
const FOLGA_PARA_SUBIR = 1.4;
const MEDICOES_PARA_SUBIR = 3;

// Tempos mínimos entre mudanças, em milissegundos. Subir é mais lento do
// que descer: uma paragem incomoda muito mais do que uma imagem menos
// nítida durante mais uns segundos.
const ESPERA_PARA_SUBIR = 15000;
const ESPERA_PARA_DESCER = 8000;

// Depois de trocar de versão o vídeo recomeça a encher a reserva do zero.
// Durante este tempo não se tiram conclusões.
const TEMPO_A_ASSENTAR = 6000;

// De quanto em quanto tempo se olha para o estado do vídeo.
const INTERVALO_DE_ANALISE = 2000;

// A ligação é medida com uma sondagem: pede-se um pedaço da versão que se
// está a pensar usar e cronometra-se. É a única maneira de saber a
// velocidade a sério — os navegadores travam de propósito o
// descarregamento dos vídeos assim que têm reserva suficiente, e por isso
// olhar só para a reserva mostraria sempre uma ligação mais lenta do que
// é. O pedaço pedido é o mesmo que seria preciso a seguir, por isso quase
// nada se perde.
const TAMANHO_DA_SONDAGEM = 2 * 1024 * 1024;
const TAMANHO_DA_PRIMEIRA_SONDAGEM = 1024 * 1024;
const ESPERA_ENTRE_SONDAGENS = 25000;

// Valor que o navegador dá quando deixou de descarregar o vídeo por já ter
// reserva que chegue. É nesses momentos que a ligação está livre e a
// medição sai limpa, sem estar a disputar espaço com o próprio vídeo.
const SEM_DESCARREGAR = 1;

// Nas rotas 360º vê-se de cada vez pouco mais do que um quarto da imagem
// na horizontal; a imagem tem de ser bastante maior do que o ecrã para se
// ver nítida.
const FATOR_PANORAMICO = 2.5;

// Uma versão só é descartada por ser grande de mais para o ecrã se for
// mesmo bem maior — mais vale sobrar nitidez do que faltar.
const TOLERANCIA_DO_ECRA = 1.3;

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
 *   gráfica consegue usar, em pontos (só interessa nas rotas 360º).
 * @returns {object} O gestor.
 */
export function criarGestorDeQualidade(opcoes) {
    const { video, fontes, nome, moldura, aoMudar, limiteDeTextura } = opcoes;

    // Da mais leve para a mais nítida. O original fica de fora: é pesado
    // de mais para entrar sozinho, só por escolha de quem está a ver.
    const escada = Object.keys(fontes)
        .filter(r => !eOriginal(nome, r))
        .sort((a, b) => alturaDe(nome, a) - alturaDe(nome, b));

    const estado = {
        modo: 'auto',
        resolucao: null,
        debitoMedidoMbps: 0,
        // A medição é feita desde que a versão actual começou a carregar,
        // e não de dois em dois segundos: assim continua válida depois de
        // o ficheiro acabar de descarregar, quando já não há nada a
        // chegar mas a ligação continua a ser boa.
        marcoSegundos: null,
        marcoInstante: 0,
        ultimaMudanca: 0,
        assentaAte: 0,
        medicoesBoas: 0,
        instanteDaParagem: 0,
        sondagensFeitas: 0,
        aSondar: false,
        ultimaSondagem: 0
    };

    let relogio = null;

    // --- Limites que não dependem da ligação -----------------------------

    /**
     * A versão mais nítida que faz sentido para o tamanho actual do player.
     *
     * @returns {number} Altura máxima útil, em pontos.
     */
    function limiteDoEcra() {
        const caixa = moldura || video;
        const altura = (caixa.clientHeight || window.innerHeight) *
            (window.devicePixelRatio || 1);
        const util = e360(nome) ? altura * FATOR_PANORAMICO : altura;
        return util * TOLERANCIA_DO_ECRA;
    }

    /**
     * Tecto imposto pelo aparelho e pelas preferências do site: o modo de
     * poupança de dados, a qualidade escolhida nas definições e, nas rotas
     * 360º, o que a placa gráfica aguenta.
     *
     * @returns {number} Altura máxima permitida, em pontos.
     */
    function limiteDoAparelho() {
        const ligacao = navigator.connection;
        if (ligacao && ligacao.saveData) return 480;

        let tecto = 1440;
        let escolhaDoSite = null;
        try {
            escolhaDoSite = localStorage.getItem('quality');
        } catch (e) {
            escolhaDoSite = null;
        }
        if (escolhaDoSite === 'low') tecto = 720;
        else if (escolhaDoSite === 'med') tecto = 1080;

        // Uma rota 360º é aberta como uma imagem única à volta do
        // observador: se a placa gráfica não a conseguir guardar inteira,
        // aparece preta. Mais vale nem oferecer essa versão.
        if (e360(nome) && limiteDeTextura) {
            const cabe = escada.filter(r => alturaDe(nome, r) * 2 <= limiteDeTextura);
            const maior = cabe.length ? alturaDe(nome, cabe[cabe.length - 1]) : 480;
            tecto = Math.min(tecto, maior);
        }
        return tecto;
    }

    /**
     * As versões que o aparelho e o ecrã permitem, da mais leve para a
     * mais nítida. Nunca fica vazia: em último caso sobra a mais leve.
     *
     * @returns {string[]} Resoluções permitidas.
     */
    function permitidas() {
        const tectoEcra = limiteDoEcra();
        const tectoAparelho = limiteDoAparelho();
        const lista = escada.filter((r) => {
            const altura = alturaDe(nome, r);
            return altura <= tectoAparelho && altura <= tectoEcra;
        });
        return lista.length ? lista : [escada[0]];
    }

    /**
     * A melhor versão que o débito disponível aguenta.
     *
     * @param {number} debitoMbps - Megabits por segundo disponíveis.
     * @returns {string} A resolução a usar.
     */
    function melhorPara(debitoMbps) {
        const lista = permitidas();
        const orcamento = debitoMbps * MARGEM_DE_SEGURANCA;
        let escolha = lista[0];
        lista.forEach((r) => {
            if (debitoDe(nome, r) <= orcamento) escolha = r;
        });
        return escolha;
    }

    /**
     * Primeira estimativa da ligação, antes de haver medições próprias.
     *
     * @returns {number} Megabits por segundo.
     */
    function debitoInicial() {
        const ligacao = navigator.connection;
        if (ligacao && ligacao.downlink > 0) return ligacao.downlink;

        // Sem informação do navegador, parte-se de um valor modesto: é
        // preferível começar leve e subir do que começar pesado e parar.
        return e360(nome) ? 6 : 3;
    }

    // --- Trocar de versão -------------------------------------------------

    /**
     * Passa o vídeo para outra versão sem perder o sítio onde ia.
     *
     * @param {string} resolucao - A versão a passar a usar.
     */
    function trocarPara(resolucao) {
        if (!fontes[resolucao] || resolucao === estado.resolucao) return;

        const momento = video.currentTime;
        const estavaAPausa = video.paused;
        const arrancarDoZero = !estado.resolucao;

        estado.resolucao = resolucao;
        estado.ultimaMudanca = Date.now();
        estado.assentaAte = Date.now() + TEMPO_A_ASSENTAR;
        estado.marcoSegundos = null;
        estado.medicoesBoas = 0;

        video.src = fontes[resolucao];
        if (!arrancarDoZero) {
            video.addEventListener('loadedmetadata', () => {
                video.currentTime = momento;
                if (!estavaAPausa) {
                    video.play().catch(e => console.log(e));
                }
            }, { once: true });
        }

        if (aoMudar) aoMudar(estado.resolucao, estado.modo);
    }

    // --- Medir e corrigir --------------------------------------------------

    /**
     * Quantos segundos de vídeo já estão descarregados à frente do ponto
     * que está a ser visto.
     *
     * @returns {number} Segundos de reserva.
     */
    function reserva() {
        const t = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
            if (video.buffered.start(i) <= t && t <= video.buffered.end(i)) {
                return video.buffered.end(i) - t;
            }
        }
        return 0;
    }

    /**
     * Até que segundo do vídeo já está descarregado.
     *
     * @returns {number} O fim da parte já descarregada, em segundos.
     */
    function fimDescarregado() {
        const t = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
            if (video.buffered.start(i) <= t && t <= video.buffered.end(i)) {
                return video.buffered.end(i);
            }
        }
        return t;
    }

    /**
     * Mede a ligação pela própria reprodução: conta quantos segundos de
     * vídeo chegaram por cada segundo de relógio desde que esta versão
     * começou. Se em 10 segundos chegaram 60 de vídeo, a ligação traz seis
     * vezes o que a versão precisa.
     *
     * A medição pára quando o ficheiro acaba de descarregar — daí em
     * diante não chega mais nada, mas o que se mediu continua a valer.
     */
    function medirLigacao(agora) {
        const fim = fimDescarregado();

        if (estado.marcoSegundos === null) {
            estado.marcoSegundos = fim;
            estado.marcoInstante = agora;
            return;
        }

        const decorrido = (agora - estado.marcoInstante) / 1000;
        if (decorrido < 1) return;

        const chegaram = fim - estado.marcoSegundos;
        if (chegaram <= 0) return;

        const debitoAgora = debitoDe(nome, estado.resolucao) * (chegaram / decorrido);
        estado.debitoMedidoMbps = Math.max(estado.debitoMedidoMbps, debitoAgora);
    }

    /**
     * Mede a ligação a sério: pede um pedaço de uma versão e cronometra a
     * chegada. Como o pedaço pedido é o que corresponde ao ponto onde o
     * vídeo vai, fica adiantado trabalho caso se mude mesmo para ela.
     *
     * @param {string} candidata - Versão a usar como amostra.
     * @param {number} tamanho - Quantos bytes pedir.
     * @returns {Promise<void>} Termina quando a medição estiver feita.
     */
    async function sondarLigacao(candidata, tamanho) {
        if (estado.aSondar || !fontes[candidata]) return;
        const ligacao = navigator.connection;
        if (ligacao && ligacao.saveData) return;

        estado.aSondar = true;
        try {
            const bytesPorSegundo = debitoDe(nome, candidata) * 1e6 / 8;
            const inicio = Math.max(0, Math.floor(bytesPorSegundo * video.currentTime));
            const relogioInicial = performance.now();
            const resposta = await fetch(fontes[candidata], {
                headers: { Range: `bytes=${inicio}-${inicio + tamanho - 1}` },
                // Sem isto, um pedaço já guardado no navegador responderia
                // num instante e daria a ideia de uma ligação muito mais
                // rápida do que a verdadeira.
                cache: 'no-store'
            });
            const dados = await resposta.arrayBuffer();
            const segundos = (performance.now() - relogioInicial) / 1000;

            // Uma resposta instantânea veio da memória do navegador e não
            // diz nada sobre a ligação.
            if (segundos > 0.15 && dados.byteLength > 200000) {
                const mbps = dados.byteLength * 8 / segundos / 1e6;
                estado.debitoMedidoMbps = estado.sondagensFeitas
                    ? estado.debitoMedidoMbps * 0.4 + mbps * 0.6
                    : mbps;
                estado.sondagensFeitas++;
            }
        } catch (e) {
            // Sem rede, ou pedido recusado: fica-se pelo que já se sabia.
        }
        estado.aSondar = false;
        estado.ultimaSondagem = Date.now();
    }

    /**
     * Olha para o estado do vídeo e, se for caso disso, muda de versão.
     */
    function analisar() {
        if (estado.modo !== 'auto' || video.paused || !estado.resolucao) return;

        const agora = Date.now();
        const reservaAgora = reserva();
        if (!estado.sondagensFeitas) medirLigacao(agora);

        if (agora < estado.assentaAte) return;

        const lista = permitidas();
        const posicao = lista.indexOf(estado.resolucao);

        // Uma paragem só conta se aconteceu depois de a versão assentar:
        // ao arrancar, o vídeo pára sempre uns instantes à espera dos
        // primeiros dados e isso não quer dizer nada.
        const paragemRecente = estado.instanteDaParagem > estado.assentaAte &&
            agora - estado.instanteDaParagem < 10000;
        const aperto = paragemRecente || reservaAgora < RESERVA_APERTADA;

        // Descer: o vídeo está a sofrer.
        if (aperto && posicao > 0 && agora - estado.ultimaMudanca > ESPERA_PARA_DESCER) {
            estado.instanteDaParagem = 0;
            // Esquece o que mediu antes: a ligação acabou de mostrar que
            // não era o que parecia, e tem de o provar outra vez para
            // poder voltar a subir.
            estado.debitoMedidoMbps = debitoDe(nome, lista[posicao - 1]);
            trocarPara(lista[posicao - 1]);
            return;
        }

        // A versão actual pode ter deixado de ser permitida — por exemplo
        // ao sair do ecrã inteiro, quando o player volta a ser pequeno.
        if (posicao === -1) {
            trocarPara(lista[lista.length - 1]);
            return;
        }

        // Perto do fim não vale a pena mexer: só se perdia tempo a
        // recarregar o que resta.
        if (video.duration && video.duration - video.currentTime < 30) return;

        // Subir: só com reserva folgada, ligação de sobra e sem pressas.
        const seguinte = lista[posicao + 1];
        if (!seguinte) {
            estado.medicoesBoas = 0;
            return;
        }

        // Antes de decidir, mede-se a ligação outra vez — mas só com
        // reserva de sobra e com o vídeo a descansar, para a medição não
        // disputar espaço com ele nem lhe roubar dados.
        if (reservaAgora > RESERVA_FOLGADA &&
            video.networkState === SEM_DESCARREGAR &&
            agora - estado.ultimaSondagem > ESPERA_ENTRE_SONDAGENS) {
            sondarLigacao(seguinte, TAMANHO_DA_SONDAGEM);
        }
        const chega = estado.debitoMedidoMbps >=
            debitoDe(nome, seguinte) * FOLGA_PARA_SUBIR;
        if (chega && reservaAgora > RESERVA_FOLGADA) {
            estado.medicoesBoas++;
        } else {
            estado.medicoesBoas = 0;
        }
        if (estado.medicoesBoas >= MEDICOES_PARA_SUBIR &&
            agora - estado.ultimaMudanca > ESPERA_PARA_SUBIR) {
            trocarPara(seguinte);
        }
    }

    function aoParar() {
        estado.instanteDaParagem = Date.now();
    }

    // --- O que o player usa -------------------------------------------------

    const gestor = {
        /** Arranca: escolhe a primeira versão e começa a acompanhar. */
        arrancar() {
            // A primeira escolha sai do que o navegador diz da ligação,
            // que é pouco fiável, por isso mede-se logo a sério e corrige-se
            // nos primeiros segundos, antes de a pessoa reparar.
            trocarPara(melhorPara(debitoInicial()));
            video.addEventListener('waiting', aoParar);
            video.addEventListener('stalled', aoParar);
            relogio = setInterval(analisar, INTERVALO_DE_ANALISE);

            const lista = permitidas();
            const amostra = lista[Math.min(lista.length - 1, lista.indexOf(estado.resolucao) + 1)];
            sondarLigacao(amostra, TAMANHO_DA_PRIMEIRA_SONDAGEM).then(() => {
                if (estado.modo !== 'auto' || !estado.sondagensFeitas) return;
                const desejada = melhorPara(estado.debitoMedidoMbps);
                if (desejada !== estado.resolucao) trocarPara(desejada);
            });

            return estado.resolucao;
        },

        /** Fixa uma versão à mão; o automático deixa de mandar. */
        fixar(resolucao) {
            estado.modo = 'manual';
            if (resolucao === estado.resolucao) {
                if (aoMudar) aoMudar(estado.resolucao, estado.modo);
                return;
            }
            trocarPara(resolucao);
        },

        /** Devolve a decisão ao automático. */
        automatico() {
            estado.modo = 'auto';
            estado.medicoesBoas = 0;
            const desejada = melhorPara(estado.debitoMedidoMbps || debitoInicial());
            if (desejada !== estado.resolucao) {
                trocarPara(desejada);
            } else if (aoMudar) {
                aoMudar(estado.resolucao, estado.modo);
            }
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

        /** Retrato do que o gestor sabe — serve para diagnóstico. */
        get diagnostico() {
            return Object.assign({}, estado, {
                permitidas: permitidas(),
                limiteDoEcra: Math.round(limiteDoEcra()),
                limiteDoAparelho: limiteDoAparelho(),
                reserva: Math.round(reserva())
            });
        },

        /** Pára de acompanhar (ao fechar o player). */
        parar() {
            if (relogio) clearInterval(relogio);
            relogio = null;
            video.removeEventListener('waiting', aoParar);
            video.removeEventListener('stalled', aoParar);
        }
    };

    return gestor;
}

/**
 * A maior imagem que a placa gráfica deste aparelho consegue usar.
 * Serve para não oferecer rotas 360º que ela não conseguiria mostrar.
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
