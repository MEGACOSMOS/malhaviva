/**
 * O avesso de cada ícone do cabeçalho — e do botão de partilhar, no
 * canto de baixo — segue o que está por baixo dele.
 *
 * Os ícones são brancos. Quando um é escolhido — o rato em cima, ou o
 * menu dele aberto — toma a cor inversa da que tem por trás: o negativo
 * do céu, dos telhados, da sombra da rua. Como o fundo é o próprio
 * bairro, que muda a cada passo, não há maneira de decidir de antemão:
 * tem de se ir ver.
 *
 * E é isso que este ficheiro faz. De fração em fração de segundo copia uma
 * tira fininha da imagem do bairro, a que fica mesmo por trás dos ícones,
 * mede a cor média debaixo de cada um e escreve-lhe o avesso. Cada ícone
 * decide por si: com o sol de um lado e a sombra do outro, cada um tem o
 * seu. Um fundo a meio caminho — cinzento — teria um avesso igual a si
 * próprio, e aí o avesso é o branco ou o preto, o que se vir melhor.
 */
(function () {
    'use strict';

    // A tira lida é minúscula de propósito: chega para saber se o que está
    // por baixo é claro ou escuro, e não custa quase nada a ler.
    var COLUNAS = 192;
    var LINHAS = 4;

    // Um fundo com brilho entre estes dois é cinzento: o negativo dele não
    // se distinguiria dele, e aí vale o branco ou o preto.
    var CINZENTO_DE = 0.36;
    var CINZENTO_ATE = 0.64;

    // De quanto em quanto tempo se vai ver, em milésimos de segundo.
    var INTERVALO = 200;

    // Com o mapa parado o fundo é sempre o mesmo, e medi-lo outra vez é
    // trabalho deitado fora: cada medição custa milissegundo e meio, e a
    // ler sem parar dava um por cento do tempo todo. Parado, vai-se ver uma
    // vez por segundo — o suficiente para apanhar o céu a ligar-se ou o
    // detalhe a chegar.
    var DESCANSO = 1000;

    var amostra = document.createElement('canvas');
    amostra.width = COLUNAS;
    amostra.height = LINHAS;
    var pincel = amostra.getContext('2d', { willReadFrequently: true });

    /**
     * A tela onde o bairro é desenhado.
     *
     * @returns {HTMLCanvasElement|null} A tela, ou nada se ainda não existe.
     */
    function telaDoBairro() {
        var app = document.querySelector('pc-app');
        return app ? app.querySelector('canvas') : null;
    }

    /**
     * Mede o brilho por trás de cada ícone e escolhe-lhe a tinta.
     */
    function medir() {
        var tela = telaDoBairro();
        var elementos = document.querySelectorAll('#header .adaptavel, #partilhar-btn.adaptavel');
        if (!tela || !pincel || elementos.length === 0) {
            return;
        }

        var caixaDaTela = tela.getBoundingClientRect();
        if (!caixaDaTela.width || !caixaDaTela.height || !tela.width) {
            return;
        }

        // Os ícones vivem em faixas do ecrã: os do cabeçalho numa, em
        // cima; o de partilhar noutra, em baixo. Cada faixa é lida à
        // parte — ler uma tira do ecrã inteiro, esmagada em quatro
        // linhas, misturava o céu com as ruas e não dizia nada de nenhum.
        // Ícones vizinhos — quase encostados, como os da coluna do
        // telemóvel — juntam-se na mesma faixa, para não se ler o ecrã
        // uma vez por cada um. A coluna fechada não se mede: não se vê.
        var FOLGA = 8;
        var cabecalho = document.getElementById('header');
        var gaveta = document.getElementById('acoes-do-cabecalho');
        var gavetaFechada = window.matchMedia('(max-width: 640px)').matches &&
            !(cabecalho && cabecalho.classList.contains('gaveta-aberta'));

        var faixas = [];
        elementos.forEach(function (el) {
            if (gavetaFechada && gaveta && gaveta.contains(el)) {
                return;
            }
            var caixa = el.getBoundingClientRect();
            // Sem tamanho, ou fora do ecrã, não há nada a medir.
            if (caixa.width === 0 || caixa.left >= caixaDaTela.right || caixa.top >= caixaDaTela.bottom) {
                return;
            }
            var faixa = null;
            for (var f = 0; f < faixas.length; f++) {
                if (caixa.top <= faixas[f].base + FOLGA && caixa.bottom >= faixas[f].topo - FOLGA) {
                    faixa = faixas[f];
                    break;
                }
            }
            if (faixa) {
                if (caixa.top < faixa.topo) faixa.topo = caixa.top;
                if (caixa.bottom > faixa.base) faixa.base = caixa.bottom;
                faixa.elementos.push(el);
            } else {
                faixas.push({ topo: caixa.top, base: caixa.bottom, elementos: [el] });
            }
        });

        faixas.forEach(function (faixa) {
            medirFaixa(tela, caixaDaTela, faixa.topo, faixa.base, faixa.elementos);
        });
    }

    /**
     * Mede o brilho por trás de uma faixa de ícones e escolhe-lhes a tinta.
     *
     * @param {HTMLCanvasElement} tela - A tela do bairro.
     * @param {DOMRect} caixaDaTela - Onde a tela está no ecrã.
     * @param {number} topo - O cimo da faixa, no ecrã.
     * @param {number} base - O fundo da faixa, no ecrã.
     * @param {Element[]} elementos - Os ícones que vivem nessa faixa.
     */
    function medirFaixa(tela, caixaDaTela, topo, base, elementos) {
        if (!isFinite(topo) || base <= topo) {
            return;
        }

        // Do ecrã para os pontos da tela, que numa ecrã de grão fino são
        // mais do que os pontos de desenho.
        var escala = tela.width / caixaDaTela.width;
        var deY = Math.max(0, Math.round((topo - caixaDaTela.top) * escala));
        var altura = Math.round((base - topo) * escala);
        altura = Math.min(tela.height - deY, Math.max(1, altura));
        if (altura <= 0) {
            return;
        }

        var dados;
        try {
            pincel.drawImage(tela, 0, deY, tela.width, altura, 0, 0, COLUNAS, LINHAS);
            dados = pincel.getImageData(0, 0, COLUNAS, LINHAS).data;
        } catch (e) {
            // Sem leitura possível fica tudo como está — branco, que é o
            // que sempre foi.
            return;
        }

        elementos.forEach(function (el) {
            var caixa = el.getBoundingClientRect();
            if (caixa.width === 0) {
                return;
            }

            var primeira = Math.floor((caixa.left - caixaDaTela.left) / caixaDaTela.width * COLUNAS);
            var ultima = Math.ceil((caixa.right - caixaDaTela.left) / caixaDaTela.width * COLUNAS);
            primeira = Math.max(0, Math.min(COLUNAS - 1, primeira));
            ultima = Math.max(primeira, Math.min(COLUNAS - 1, ultima));

            var r = 0, g = 0, b = 0;
            var contados = 0;
            for (var linha = 0; linha < LINHAS; linha++) {
                for (var coluna = primeira; coluna <= ultima; coluna++) {
                    var i = (linha * COLUNAS + coluna) * 4;
                    r += dados[i];
                    g += dados[i + 1];
                    b += dados[i + 2];
                    contados++;
                }
            }
            if (!contados) {
                return;
            }
            r /= contados;
            g /= contados;
            b /= contados;

            // O verde pesa mais do que o azul porque é assim que o olho
            // vê: um verde e um azul da mesma medida não parecem igualmente
            // claros.
            var brilho = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            var avesso;
            if (brilho > CINZENTO_DE && brilho < CINZENTO_ATE) {
                avesso = brilho < 0.5 ? '#ffffff' : '#05050a';
            } else {
                avesso = 'rgb(' + Math.round(255 - r) + ', ' + Math.round(255 - g) + ', ' + Math.round(255 - b) + ')';
            }
            if (el.style.getPropertyValue('--avesso') !== avesso) {
                el.style.setProperty('--avesso', avesso);
            }
        });
    }

    // Deixado à vista para se poder pedir uma medição à mão e ver o que
    // ela decidiu, sem ter de esperar pela volta seguinte.
    window.ContrasteDoCabecalho = { medir: medir, pedir: function () { pedirMedicao(); } };

    /**
     * Se a câmara saiu do sítio desde a última vez que se olhou.
     *
     * As contas são feitas em metros e graus inteiros: um tremor de
     * milésimos não conta como ter-se mexido.
     *
     * @returns {boolean} Verdadeiro se há vista nova para medir.
     */
    var ondeEstava = '';
    function camaraMexeu() {
        var pagina = document.querySelector('pc-app');
        var app = pagina && pagina.app;
        var camara = app && app.root && app.root.findByName('camera');
        if (!camara) {
            return true;
        }
        var sitio = camara.getPosition();
        var olhar = camara.getEulerAngles();
        var agora = [
            Math.round(sitio.x), Math.round(sitio.y), Math.round(sitio.z),
            Math.round(olhar.x), Math.round(olhar.y)
        ].join(',');
        if (agora === ondeEstava) {
            return false;
        }
        ondeEstava = agora;
        return true;
    }

    /**
     * Mede no fim da imagem que o motor está a desenhar, e não entre imagens.
     *
     * Com o motor de desenho novo (WebGPU) a tela só se deixa ler enquanto
     * a imagem está a ser feita: entre duas imagens vem tudo a preto, e
     * medir aí era decidir às escuras — os ícones ficavam sempre com o
     * avesso de preto, fosse o que fosse que tivessem por baixo. Por isso a
     * medição é pedida aqui e feita pelo motor, mal acaba de desenhar.
     * Enquanto o motor não acordou, mede-se logo, que é o que há.
     */
    var pedida = false;
    var motorLigado = null;
    function pedirMedicao() {
        var pagina = document.querySelector('pc-app');
        var app = pagina && pagina.app;
        if (app && motorLigado !== app && typeof app.on === 'function') {
            motorLigado = app;
            app.on('frameend', function () {
                if (pedida) {
                    pedida = false;
                    medir();
                }
            });
        }
        if (motorLigado) {
            pedida = true;
        } else {
            medir();
        }
    }

    var ultimaVez = 0;
    var ultimaMedicao = 0;
    function aCadaImagem(agora) {
        if (agora - ultimaVez >= INTERVALO) {
            ultimaVez = agora;
            if (camaraMexeu() || agora - ultimaMedicao >= DESCANSO) {
                ultimaMedicao = agora;
                pedirMedicao();
            }
        }
        requestAnimationFrame(aCadaImagem);
    }

    function arrancar() {
        requestAnimationFrame(aCadaImagem);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();
