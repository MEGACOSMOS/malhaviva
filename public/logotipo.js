/**
 * O logótipo do Malha Viva.
 *
 * "MALHA" na letra cheia e "VIVA" na letra de fio, as duas fontes feitas
 * para o projecto. Quem visita não as tem no computador, por isso o
 * logótipo não vai escrito: vai desenhado, letra a letra, já passado a
 * contorno (por `scripts/fazer-logotipo.py`, a partir do ficheiro do
 * logótipo). Vive aqui, num sítio só, e as páginas põem-no onde faz
 * falta: no cabeçalho, no lugar do nome, e nos ecrãs de espera que
 * enchem o ecrã, onde nasce apagado e se vai acendendo da esquerda para
 * a direita à medida que o que se espera vai chegando.
 *
 * A cor é a do texto à volta: o logótipo pinta-se com a cor de quem o
 * leva, e assim é branco no fundo escuro do site sem ter de o dizer.
 *
 * Isto é um ficheiro comum, e não um módulo, para ser lido pelas páginas
 * do mesmo modo que o quadrado de espera: antes de a página se desenhar,
 * para o logótipo já nascer com a sua roupa.
 */
(function () {
    'use strict';

    // <desenho> (escrito por scripts/fazer-logotipo.py)
    var LARGURA = 780.62;
    var ALTURA = 123.4;
    var DESENHO = 'M42.01 84.85 63.29 3.05H78.42V121.25H0V3.05H15.13L36.4 84.85ZM119.11 3.05H134.24V121.25H97.83ZM139.85 121.25V3.05H154.98L176.25 121.25ZM192.86 121.25V3.05H208L229.23 84.85H259.37V121.25ZM268.81 121.25V3.05H283.94L298.66 43.95H311.77L326.44 3.05H341.57V121.25H326.44L311.77 80.35H298.66L283.94 121.25ZM377.4 3.05H392.53V121.25H356.13ZM398.14 121.25V3.05H413.27L434.54 121.25ZM539.31 119.03 539.39 3.05H543.19L543.06 123.4L540.96 123.15Q540.26 123.02 539.06 122.86Q536.67 122.45 533.99 121.87Q525.5 120.01 517.3 116.96Q505.79 112.72 496.56 106.74Q484.97 99.24 477.63 89.38Q470.17 79.36 465.35 68.69Q461.14 59.33 458.88 49.27Q457.02 41.02 456.36 31.62Q456.11 27.91 455.99 23.58Q455.91 20.78 455.87 16.2V10.14V3.05H459.66V10.14V16.16Q459.7 20.7 459.78 23.5Q459.87 27.71 460.15 31.33Q460.77 40.44 462.59 48.44Q464.77 58.13 468.81 67.12Q473.43 77.43 480.69 87.16Q487.61 96.43 498.62 103.56Q507.48 109.34 518.62 113.42Q526.53 116.35 534.82 118.16Q537.17 118.7 539.31 119.03ZM568.46 121.25H564.67V3.05H568.46ZM672.81 119.03 672.89 3.05H676.68L676.56 123.4L674.46 123.15Q673.76 123.02 672.56 122.86Q670.17 122.45 667.49 121.87Q659 120.01 650.79 116.96Q639.29 112.72 630.05 106.74Q618.47 99.24 611.13 89.38Q603.67 79.36 598.85 68.69Q594.64 59.33 592.37 49.27Q590.52 41.02 589.86 31.62Q589.61 27.91 589.49 23.58Q589.4 20.78 589.36 16.2V10.14V3.05H593.16V10.14V16.16Q593.2 20.7 593.28 23.5Q593.36 27.71 593.65 31.33Q594.27 40.44 596.08 48.44Q598.27 58.13 602.31 67.12Q606.93 77.43 614.18 87.16Q621.11 96.43 632.12 103.56Q640.98 109.34 652.11 113.42Q660.03 116.35 668.31 118.16Q670.66 118.7 672.81 119.03ZM700.14 44.36 702 121.21 698.2 121.29 696.31 42.05 780.62 0 780.58 121.25H776.83L776.87 6.1Z';
    // </desenho>

    // A luz do logótipo por acender, nos ecrãs de espera: o bastante para
    // se ler o desenho todo desde o princípio, longe da luz inteira.
    var APAGADO = 0.2;

    // Quanto leva a varredura a chegar aonde se pediu. As contas de quanto
    // já chegou vêm aos pedaços; isto só lhes tira o salto seco, sem as
    // deixar para trás.
    var ANDAR_MS = 200;

    // Quando o tamanho do ficheiro não vem dito, a luz anda pelo que já
    // chegou, a abrandar: este tanto acende metade do que falta.
    var MEIO_CAMINHO_BYTES = 500000;

    function svg() {
        return '<svg class="logotipo" viewBox="0 0 ' + LARGURA + ' ' + ALTURA + '" ' +
            'aria-hidden="true" focusable="false">' +
            '<path fill="currentColor" d="' + DESENHO + '"/></svg>';
    }

    /**
     * Põe na página a roupa do logótipo, uma vez só.
     *
     * O logótipo guarda sempre o seu feitio: quem o põe diz só a largura
     * ou só a altura.
     */
    function vestir() {
        if (document.getElementById('logotipo-estilo')) return;
        var estilo = document.createElement('style');
        estilo.id = 'logotipo-estilo';
        estilo.textContent =
            '.logotipo {' +
            '  display: block;' +
            '  aspect-ratio: ' + LARGURA + ' / ' + ALTURA + ';' +
            '}' +
            // No ecrã de espera há dois logótipos, um em cima do outro: o
            // apagado, sempre todo à vista, e o aceso, que se vê só por
            // uma janela que vai abrindo da esquerda para a direita.
            '.logotipo-de-espera {' +
            '  --feito: 0;' +
            '  position: relative;' +
            '  display: block;' +
            '  aspect-ratio: ' + LARGURA + ' / ' + ALTURA + ';' +
            '}' +
            '.logotipo-de-espera > span,' +
            '.logotipo-de-espera .aceso {' +
            '  position: absolute;' +
            '  inset: 0;' +
            '}' +
            '.logotipo-de-espera .logotipo {' +
            '  width: 100%;' +
            '  height: 100%;' +
            '}' +
            '.logotipo-de-espera .apagado {' +
            '  opacity: ' + APAGADO + ';' +
            '}' +
            // A janela anda para a direita e o logótipo aceso, lá dentro,
            // anda o mesmo tanto para a esquerda: fica parado no sítio, e
            // o que se mexe é só a borda da janela. As duas deslocações
            // são feitas pela placa gráfica, à parte do trabalho da
            // página — a varredura não encrava quando o bairro está a ser
            // arrumado.
            '.logotipo-de-espera .janela {' +
            '  overflow: hidden;' +
            '  transform: translateX(calc((var(--feito) - 1) * 100%));' +
            '}' +
            '.logotipo-de-espera .aceso {' +
            '  transform: translateX(calc((1 - var(--feito)) * 100%));' +
            '}' +
            '.logotipo-de-espera .janela,' +
            '.logotipo-de-espera .aceso {' +
            '  transition: transform ' + ANDAR_MS + 'ms ease-out;' +
            '  will-change: transform;' +
            '}' +
            // Ao recomeçar, a luz volta ao princípio de uma vez, sem se ver
            // a varredura a andar para trás.
            '.logotipo-de-espera.de-uma-vez .janela,' +
            '.logotipo-de-espera.de-uma-vez .aceso {' +
            '  transition: none;' +
            '}';
        document.head.appendChild(estilo);
    }

    /**
     * Desenha o logótipo dentro de um elemento, no lugar do que lá estava.
     *
     * O desenho fica escondido de quem lê a página por leitor de ecrã:
     * quem o põe dá ao elemento o nome a dizer.
     *
     * @param {Element} el - Onde pôr o logótipo.
     */
    function desenhar(el) {
        vestir();
        el.innerHTML = svg();
    }

    /**
     * Faz de um elemento o logótipo de um ecrã de espera.
     *
     * @param {Element} el - O elemento; a página diz-lhe a largura.
     * @returns {object} O que se lhe pode pedir: `progresso`, com quanto
     *     do que se espera já chegou, de zero a um; `pronto`, para o
     *     acender todo; `recomecar`, para o apagar de novo; e `trazer`,
     *     para ir buscar um ficheiro acendendo-o à medida que chega.
     */
    function deEspera(el) {
        vestir();
        el.classList.add('logotipo-de-espera');
        el.innerHTML = '<span class="apagado">' + svg() + '</span>' +
            '<span class="janela"><span class="aceso">' + svg() + '</span></span>';

        var feito = 0;

        // A luz só anda para a frente: uma conta atrasada não a apaga.
        function progresso(fraccao) {
            var f = Math.max(0, Math.min(1, fraccao || 0));
            if (f <= feito) return;
            feito = f;
            el.style.setProperty('--feito', f);
        }

        function recomecar() {
            feito = 0;
            el.classList.add('de-uma-vez');
            el.style.setProperty('--feito', 0);
            // Lê-se o tamanho para o navegador assentar já o recomeço, sem
            // varredura; só depois volta a haver.
            void el.offsetWidth;
            el.classList.remove('de-uma-vez');
        }

        /**
         * Vai buscar um ficheiro e acende o logótipo à medida que ele
         * chega.
         *
         * Devolve um endereço para o ficheiro já trazido, que se dá a uma
         * imagem como outro qualquer — sem o ir buscar segunda vez. Se o
         * pedido falhar, devolve o endereço de origem: a página pede-o do
         * modo de sempre, e se falhar de vez é ela que o diz.
         *
         * @param {string} endereco - O ficheiro.
         * @returns {Promise<string>} O endereço a usar.
         */
        function trazer(endereco) {
            return new Promise(function (resolver) {
                var pedido = new XMLHttpRequest();
                try {
                    pedido.open('GET', endereco);
                    pedido.responseType = 'blob';
                } catch (e) {
                    resolver(endereco);
                    return;
                }
                pedido.onprogress = function (e) {
                    progresso(e.lengthComputable && e.total > 0
                        ? e.loaded / e.total
                        : e.loaded / (e.loaded + MEIO_CAMINHO_BYTES));
                };
                pedido.onload = function () {
                    if (pedido.status >= 200 && pedido.status < 300 && pedido.response) {
                        progresso(1);
                        resolver(URL.createObjectURL(pedido.response));
                    } else {
                        resolver(endereco);
                    }
                };
                pedido.onerror = pedido.onabort = function () { resolver(endereco); };
                pedido.send();
            });
        }

        return {
            progresso: progresso,
            pronto: function () { progresso(1); },
            recomecar: recomecar,
            trazer: trazer
        };
    }

    window.Logotipo = { desenhar: desenhar, deEspera: deEspera, vestir: vestir };

    if (document.head) vestir();
})();
