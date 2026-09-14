/**
 * O quadrado de espera do site.
 *
 * Onde outros sites põem uma roda a girar, este põe um quadrado feito de
 * quadrados: doze à volta de um vazio, e um rasto de luz a dar-lhes a
 * volta no sentido dos ponteiros do relógio — a cabeça acesa de todo e
 * três quadrados a apagarem-se atrás dela. É o mesmo desenho em todo o
 * lado: no ecrã de espera do bairro, nas rotas e fotografias 360º e no
 * tocador dos testemunhos, por isso vive aqui, num sítio só.
 *
 * O rasto é desenhado pelo próprio navegador, com uma animação por
 * quadrado — cada um começa um passo depois do anterior — e por isso
 * anda sozinho, sem relógio nenhum a empurrá-lo — e anda mesmo quando a
 * página está ocupada a arrumar o bairro: é o navegador quem lhe muda a
 * luz, à parte do trabalho da página, e por isso o rasto não pára quando
 * ela pára. O que o código pode mudar é a luz de fundo dos quadrados por
 * baixo do rasto, que no ecrã de espera do bairro sobe à medida que o
 * mapa vai chegando, e o momento em que o rasto pára e o quadrado acende
 * todo.
 *
 * Isto é um ficheiro comum, e não um módulo, para ser lido pelas páginas
 * do mesmo modo que o ficheiro das línguas: antes de a página se
 * desenhar, para o quadrado já nascer com a sua roupa.
 */
(function () {
    'use strict';

    var CLASSE = 'quadrado-de-espera';

    // Quanto tempo a cabeça do rasto fica em cada quadrado, e a volta
    // inteira aos doze.
    var PASSO_MS = 90;
    var VOLTA_MS = PASSO_MS * 12;

    // A luz de fundo, do quase apagado do princípio até à meia luz de
    // quando já falta pouco.
    var FUNDO_MINIMO = 0.08;
    var FUNDO_MAXIMO = 0.35;

    // Os doze lugares à volta, pela ordem em que a luz lhes dá a volta:
    // a começar no canto de cima à esquerda e a andar no sentido dos
    // ponteiros do relógio. Linha e coluna, contadas a partir de um.
    var LUGARES = [
        [1, 1], [1, 2], [1, 3], [1, 4],
        [2, 4], [3, 4], [4, 4],
        [4, 3], [4, 2], [4, 1],
        [3, 1], [2, 1]
    ];

    /**
     * Põe na página a roupa do quadrado, uma vez só.
     *
     * O tamanho dos quadrados, a folga entre eles e a cor podem ser
     * mudados de fora, com as variáveis `--lado`, `--folga` e `--cor`
     * postas no próprio quadrado.
     */
    function vestir() {
        if (document.getElementById('quadrado-de-espera-estilo')) return;
        var estilo = document.createElement('style');
        estilo.id = 'quadrado-de-espera-estilo';
        estilo.textContent =
            '.' + CLASSE + ' {' +
            '  --lado: 10px; --folga: 4px; --cor: #ffffff; --fundo: ' + FUNDO_MINIMO + ';' +
            '  display: grid;' +
            '  grid-template-columns: repeat(4, var(--lado));' +
            '  grid-template-rows: repeat(4, var(--lado));' +
            '  gap: var(--folga);' +
            '}' +
            '.' + CLASSE + ' span {' +
            '  background: var(--cor);' +
            '  opacity: var(--fundo);' +
            '  animation: quadrado-de-espera-rasto ' + VOLTA_MS + 'ms steps(1, end) infinite;' +
            // Cada quadrado fica com a sua própria camada desde o início,
            // para a luz dele ser mudada fora do fio principal da página:
            // é o que deixa o rasto andar enquanto o bairro é arrumado.
            '  will-change: opacity;' +
            '}' +
            // Pronto: o rasto pára e o quadrado acende todo.
            '.' + CLASSE + '.pronto span {' +
            '  animation: none;' +
            '  opacity: 1;' +
            '}' +
            // O rasto, visto de um quadrado só: acende de todo quando a
            // cabeça lhe chega, apaga-se em três passos e fica à luz de
            // fundo o resto da volta. Nunca mais escuro do que o fundo:
            // quando o fundo já vai alto, a cauda desaparece nele.
            '@keyframes quadrado-de-espera-rasto {' +
            '  0% { opacity: 1; }' +
            '  8.3333% { opacity: max(0.6, var(--fundo)); }' +
            '  16.6667% { opacity: max(0.35, var(--fundo)); }' +
            '  25% { opacity: max(0.18, var(--fundo)); }' +
            '  33.3333%, 100% { opacity: var(--fundo); }' +
            '}';
        document.head.appendChild(estilo);
    }

    /**
     * Faz de um elemento um quadrado de espera.
     *
     * Enche-o com os doze quadrados e põe cada um a começar a sua
     * animação um passo depois do anterior — é isso que faz o rasto
     * andar à volta. O elemento é só desenho: fica escondido de quem lê
     * a página por leitor de ecrã.
     *
     * @param {Element} el - O elemento que passa a ser o quadrado.
     * @returns {object} As três coisas que se lhe podem pedir: `luz`, com
     *     quanto do que se espera já chegou, de zero a um; `pronto`, para
     *     acender tudo e parar; `recomecar`, para voltar ao princípio.
     */
    function fazer(el) {
        vestir();
        el.classList.add(CLASSE);
        el.classList.remove('pronto');
        el.setAttribute('aria-hidden', 'true');
        el.textContent = '';
        for (var i = 0; i < LUGARES.length; i++) {
            var q = document.createElement('span');
            q.style.gridArea = LUGARES[i][0] + ' / ' + LUGARES[i][1];
            // Atrasos negativos: todos os quadrados já vão a meio da sua
            // volta quando aparecem, e o primeiro é o que está aceso.
            q.style.animationDelay = ((i - LUGARES.length) * PASSO_MS) + 'ms';
            el.appendChild(q);
        }

        return {
            luz: function (fraccao) {
                var f = Math.max(0, Math.min(1, fraccao || 0));
                el.style.setProperty('--fundo', FUNDO_MINIMO + (FUNDO_MAXIMO - FUNDO_MINIMO) * f);
            },
            pronto: function () {
                el.classList.add('pronto');
            },
            recomecar: function () {
                el.classList.remove('pronto');
                el.style.setProperty('--fundo', FUNDO_MINIMO);
            }
        };
    }

    window.QuadradoDeEspera = { fazer: fazer, vestir: vestir };

    // A roupa vai para a página assim que este ficheiro é lido, para
    // qualquer quadrado que já esteja escrito nela nascer vestido.
    if (document.head) vestir();
})();
