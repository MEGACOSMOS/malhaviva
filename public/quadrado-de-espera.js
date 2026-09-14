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
 * anda sozinho, sem relógio nenhum a empurrá-lo, sempre ao mesmo ritmo:
 * o andar dele não conta nada, diz só que se está à espera. Quando há
 * uma conta a dizer — quanto do bairro já chegou — ela escreve-se no
 * meio do quadrado, no vazio que os doze deixam, em número.
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

    // A luz de fundo dos quadrados por onde o rasto não vai: quase
    // apagados, para o rasto se ver.
    var FUNDO = 0.08;

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
     * O tamanho dos quadrados, a folga entre eles, a cor e o tamanho da
     * letra do meio podem ser mudados de fora, com as variáveis `--lado`,
     * `--folga`, `--cor` e `--letra` postas no próprio quadrado.
     */
    function vestir() {
        if (document.getElementById('quadrado-de-espera-estilo')) return;
        var estilo = document.createElement('style');
        estilo.id = 'quadrado-de-espera-estilo';
        estilo.textContent =
            '.' + CLASSE + ' {' +
            '  --lado: 10px; --folga: 4px; --cor: #ffffff; --letra: 10px;' +
            '  display: grid;' +
            '  grid-template-columns: repeat(4, var(--lado));' +
            '  grid-template-rows: repeat(4, var(--lado));' +
            '  gap: var(--folga);' +
            '}' +
            '.' + CLASSE + ' span {' +
            '  background: var(--cor);' +
            '  opacity: ' + FUNDO + ';' +
            '  animation: quadrado-de-espera-rasto ' + VOLTA_MS + 'ms steps(1, end) infinite;' +
            '}' +
            // O número do meio, no vazio que os doze quadrados deixam.
            '.' + CLASSE + ' .centro {' +
            '  grid-area: 2 / 2 / 4 / 4;' +
            '  display: flex; align-items: center; justify-content: center;' +
            '  overflow: hidden;' +
            '  color: var(--cor);' +
            '  font-size: var(--letra); font-weight: 600; line-height: 1;' +
            '  letter-spacing: -0.02em; font-variant-numeric: tabular-nums;' +
            '}' +
            // O rasto, visto de um quadrado só: acende de todo quando a
            // cabeça lhe chega, apaga-se em três passos e fica à luz de
            // fundo o resto da volta.
            '@keyframes quadrado-de-espera-rasto {' +
            '  0% { opacity: 1; }' +
            '  8.3333% { opacity: 0.6; }' +
            '  16.6667% { opacity: 0.35; }' +
            '  25% { opacity: 0.18; }' +
            '  33.3333%, 100% { opacity: ' + FUNDO + '; }' +
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
     * @param {object} [opcoes] - `centro: true` para haver um sítio no meio
     *     onde escrever um número.
     * @returns {object} O que se lhe pode pedir: `escrever`, com o texto a
     *     pôr no meio — vazio para não haver nada.
     */
    function fazer(el, opcoes) {
        vestir();
        el.classList.add(CLASSE);
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

        var centro = null;
        if (opcoes && opcoes.centro) {
            centro = document.createElement('div');
            centro.className = 'centro';
            el.appendChild(centro);
        }

        return {
            escrever: function (texto) {
                if (centro) centro.textContent = texto || '';
            }
        };
    }

    window.QuadradoDeEspera = { fazer: fazer, vestir: vestir };

    // A roupa vai para a página assim que este ficheiro é lido, para
    // qualquer quadrado que já esteja escrito nela nascer vestido.
    if (document.head) vestir();
})();
