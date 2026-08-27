/**
 * A tinta do cabeçalho segue o que está por baixo dela.
 *
 * Como a barra de estado de um telemóvel Android: sobre um fundo escuro os
 * ícones são brancos, sobre um fundo claro são pretos. Aqui o fundo é o
 * próprio bairro, que muda a cada passo — o céu por cima dos telhados é
 * quase branco, a sombra das ruas é quase preta — por isso não há maneira
 * de decidir de antemão: tem de se ir ver.
 *
 * E é isso que este ficheiro faz. De fração em fração de segundo copia uma
 * tira fininha da imagem do bairro, a que fica mesmo por trás do cabeçalho,
 * mede o brilho debaixo de cada ícone e escolhe a tinta que se vê melhor.
 * Cada ícone decide por si: com o sol de um lado e a sombra do outro, uns
 * ficam pretos e outros brancos.
 */
(function () {
    'use strict';

    // A tira lida é minúscula de propósito: chega para saber se o que está
    // por baixo é claro ou escuro, e não custa quase nada a ler.
    var COLUNAS = 192;
    var LINHAS = 4;

    // Dois limites, e não um, com uma folga no meio: assim a tinta não anda
    // a piscar quando o fundo fica mesmo em cima da fronteira.
    var PASSA_A_PRETO = 0.58;
    var VOLTA_A_BRANCO = 0.42;

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
        var elementos = document.querySelectorAll('#header .adaptavel');
        if (!tela || !pincel || elementos.length === 0) {
            return;
        }

        var caixaDaTela = tela.getBoundingClientRect();
        if (!caixaDaTela.width || !caixaDaTela.height || !tela.width) {
            return;
        }

        // A faixa do ecrã onde os ícones vivem, do mais alto ao mais baixo.
        var topo = Infinity;
        var base = -Infinity;
        elementos.forEach(function (el) {
            var caixa = el.getBoundingClientRect();
            if (caixa.width === 0) {
                return;
            }
            if (caixa.top < topo) topo = caixa.top;
            if (caixa.bottom > base) base = caixa.bottom;
        });
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

            var soma = 0;
            var contados = 0;
            for (var linha = 0; linha < LINHAS; linha++) {
                for (var coluna = primeira; coluna <= ultima; coluna++) {
                    var i = (linha * COLUNAS + coluna) * 4;
                    // O verde pesa mais do que o azul porque é assim que o
                    // olho vê: um verde e um azul da mesma medida não
                    // parecem igualmente claros.
                    soma += (0.2126 * dados[i] + 0.7152 * dados[i + 1] + 0.0722 * dados[i + 2]) / 255;
                    contados++;
                }
            }
            if (!contados) {
                return;
            }

            var brilho = soma / contados;
            var estaPreto = el.classList.contains('sobre-claro');
            if (!estaPreto && brilho > PASSA_A_PRETO) {
                el.classList.add('sobre-claro');
            } else if (estaPreto && brilho < VOLTA_A_BRANCO) {
                el.classList.remove('sobre-claro');
            }
        });
    }

    // Deixado à vista para se poder pedir uma medição à mão e ver o que
    // ela decidiu, sem ter de esperar pela volta seguinte.
    window.ContrasteDoCabecalho = { medir: medir };

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

    var ultimaVez = 0;
    var ultimaMedicao = 0;
    function aCadaImagem(agora) {
        if (agora - ultimaVez >= INTERVALO) {
            ultimaVez = agora;
            if (camaraMexeu() || agora - ultimaMedicao >= DESCANSO) {
                ultimaMedicao = agora;
                medir();
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
