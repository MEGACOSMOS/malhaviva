/**
 * A rede de segurança do site.
 *
 * Ninguém deve ficar a olhar para um ecrã preto sem saber porquê. Isto é
 * o aviso que se mostra quando alguma coisa demora ou falha ao arrancar —
 * uma linha a dizer o que se passa, outra a dizer o que pode ser, e uma
 * tecla para tentar de novo — e o relógio que decide quando o mostrar.
 * É o mesmo em todo o lado: no bairro, nas rotas e nas fotografias 360º,
 * por isso vive aqui, num sítio só.
 *
 * A tecla de tentar de novo não se limita a recarregar: vai primeiro
 * buscar ao servidor, de fresco, a página e o código que ela já tinha
 * pedido, saltando por cima do que o navegador guardou. É o que resolve
 * o caso de uma versão antiga da página, guardada no navegador, misturada
 * com pedaços novos.
 *
 * Isto é um ficheiro comum, e não um módulo, de propósito: é lido antes
 * de tudo o resto e não depende de nada — nem das línguas, que se não
 * tiverem chegado deixam o aviso em português.
 *
 * O que fica ao dispor das páginas, em `window.RedeDeSeguranca`:
 *  - `montarAviso(chave, textoPt, caixa)`: monta o aviso dentro de `caixa`.
 *  - `recarregarDeFresco()`: o que a tecla faz.
 *  - `vigiar({...})`: o relógio (ver a função).
 */
(function () {
    'use strict';

    var t = function (chave, senao) {
        return (window.Idiomas && window.Idiomas.t(chave)) || senao;
    };

    // A roupa do aviso, uma vez por página. Os nomes são só deste
    // ficheiro, para não se pisarem com os das páginas.
    var estilo = document.createElement('style');
    estilo.textContent = [
        '.rede-aviso { display: flex; flex-direction: column; align-items: center; gap: 8px;',
        '  max-width: 420px; padding: 0 16px; text-align: center; font-family: inherit; }',
        '.rede-titulo { font-size: 0.95rem; font-weight: 600; letter-spacing: -0.01em; color: #ffffff; }',
        '.rede-sub { font-size: 0.82rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 14px; }',
        /* A tecla é uma tecla, como as do rodapé do bairro: só o traço e a letra. */
        '.rede-tecla { background: transparent; color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.25);',
        '  padding: 9px 18px; border-radius: 0; font-size: 0.72rem; font-weight: 600; text-transform: uppercase;',
        '  letter-spacing: 0.08em; font-family: inherit; cursor: pointer;',
        '  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s; }',
        '.rede-tecla:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.45); }',
        '.rede-tecla:active { transform: scale(0.97); }'
    ].join('\n');
    (document.head || document.documentElement).appendChild(estilo);

    /**
     * Volta a pedir ao servidor a página e o código que ela já foi buscar,
     * saltando por cima do que o navegador tem guardado, e só depois
     * recarrega. Os motores em `motor/` ficam de fora: têm a versão no
     * nome e nunca mudam. Se algum pedido ficar pendurado, recarrega-se
     * na mesma ao fim de uns segundos.
     */
    function recarregarDeFresco() {
        var urls = [window.location.href];
        try {
            performance.getEntriesByType('resource').forEach(function (r) {
                var u = r.name;
                if (u.indexOf(window.location.origin + '/') === 0 &&
                    /\.m?js(\?|$)/.test(u) &&
                    u.indexOf('/motor/') === -1) urls.push(u);
            });
        } catch (e) { /* sem lista: vai só a página */ }

        var pedidos = [];
        urls.forEach(function (u) {
            try {
                pedidos.push(fetch(u, { cache: 'reload', credentials: 'same-origin' }).catch(function () {}));
            } catch (e) { /* sem fetch: recarrega-se na mesma */ }
        });
        var limite = new Promise(function (resolve) { setTimeout(resolve, 4000); });
        var recarregar = function () { window.location.reload(); };
        Promise.race([Promise.all(pedidos), limite]).then(recarregar, recarregar);
    }

    /**
     * Monta o aviso dentro de uma caixa: a linha do que se passa, a do que
     * pode ser, e a tecla. As chaves das línguas ficam nos elementos, para
     * o aviso mudar de língua com o resto da página.
     *
     * @param {string} chave - A chave, nas línguas, da primeira linha.
     * @param {string} textoPt - A mesma em português, para o caso de as
     * línguas não terem chegado.
     * @param {Element} caixa - Onde montar. Fica com o papel de aviso
     * para o leitor de ecrã o ler quando aparece.
     */
    function montarAviso(chave, textoPt, caixa) {
        var titulo = document.createElement('div');
        titulo.className = 'rede-titulo';
        titulo.setAttribute('data-i18n', chave);
        titulo.textContent = t(chave, textoPt);

        var sub = document.createElement('div');
        sub.className = 'rede-sub';
        sub.setAttribute('data-i18n', 'arranque.sub');
        sub.textContent = t('arranque.sub', 'Pode ser a ligação à internet. Se continuar assim, tenta de novo.');

        var tecla = document.createElement('button');
        tecla.type = 'button';
        tecla.className = 'rede-tecla';
        tecla.setAttribute('data-i18n', 'gpu.botao');
        tecla.textContent = t('gpu.botao', 'Tentar de novo');
        tecla.addEventListener('click', recarregarDeFresco);

        caixa.classList.add('rede-aviso');
        caixa.setAttribute('role', 'status');
        caixa.appendChild(titulo);
        caixa.appendChild(sub);
        caixa.appendChild(tecla);
    }

    /**
     * O relógio: conta os segundos em que a página está à vista e, se ao
     * fim da espera a página ainda não estiver pronta, mostra o aviso.
     * Escondida, a página não desenha nem descarrega grande coisa, e
     * contar esse tempo era acusar a ligação de uma demora que não foi
     * dela.
     *
     * @param {object} o
     * @param {number} o.espera - Segundos à vista antes de se dizer algo.
     * @param {function(): boolean} o.pronto - Se a página já tem o que
     * mostrar. Mal seja verdade, o relógio pára e o aviso, se lá estiver,
     * sai.
     * @param {function(): (Element|null)} o.caixa - Onde montar o aviso
     * quando for a altura. É chamada só nessa altura, porque o sítio
     * certo pode depender do que a página estiver a mostrar.
     * @param {function(): boolean} [o.parado] - Se a página está à espera
     * de um toque da pessoa (um botão de tocar, por exemplo). Esse tempo
     * não é demora de ninguém, e não se conta.
     * @param {string} [o.chave] - A primeira linha do aviso da demora.
     * @param {string} [o.textoPt] - A mesma em português.
     * @param {function()} [o.aoAvisar] - Chamada quando o aviso aparece,
     * para a página avisar quem a tiver tapada.
     * @returns {{avisar: function(string, string), calar: function(), parar: function()}}
     * `avisar(chave, textoPt)` mostra já um aviso, para quando a página
     * sabe logo que falhou; `calar()` tira-o; `parar()` desliga o relógio.
     */
    function vigiar(o) {
        var decorrido = 0;
        var aviso = null;
        var relogio = null;

        function calar() {
            if (aviso && aviso.parentNode) aviso.parentNode.removeChild(aviso);
            aviso = null;
        }

        function parar() {
            clearInterval(relogio);
            relogio = null;
        }

        function avisar(chave, textoPt) {
            // Com um aviso já à vista, muda-se-lhe só a primeira linha:
            // é o caso de a demora passar a falha de vez.
            if (aviso) {
                var titulo = aviso.querySelector('.rede-titulo');
                if (titulo) {
                    titulo.setAttribute('data-i18n', chave);
                    titulo.textContent = t(chave, textoPt);
                }
                return;
            }
            var caixa = o.caixa();
            if (!caixa) return;
            aviso = document.createElement('div');
            montarAviso(chave, textoPt, aviso);
            caixa.appendChild(aviso);
            if (o.aoAvisar) o.aoAvisar();
        }

        function ver() {
            if (o.pronto()) { calar(); parar(); return; }
            if (document.hidden) return;
            if (o.parado && o.parado()) return;
            decorrido++;
            // Uma vez só: se entretanto a página disse que falhou de vez,
            // o relógio não lhe volta a pôr "está a demorar" por cima.
            if (decorrido >= o.espera && !aviso) {
                avisar(o.chave || 'arranque.demora', o.textoPt || 'Está a demorar mais do que o costume.');
            }
        }

        relogio = setInterval(ver, 1000);
        return { avisar: avisar, calar: calar, parar: parar };
    }

    window.RedeDeSeguranca = {
        montarAviso: montarAviso,
        recarregarDeFresco: recarregarDeFresco,
        vigiar: vigiar
    };
})();
