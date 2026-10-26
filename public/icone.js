/**
 * O ícone do separador acompanha o modo do navegador: claro (letras
 * brancas) com o navegador em modo escuro, e escuro com ele em modo claro.
 *
 * O favicon.svg já escolhe a cor sozinho, por dentro, mas só quando a
 * página abre: o Chrome só o volta a desenhar ao recarregar, e o Safari
 * nem lhe liga. Por isso aqui troca-se o ícone por um já com a cor certa,
 * logo ao abrir e de cada vez que o modo do navegador mudar. Os ícones
 * fazem-se com `scripts/fazer-icone.mjs`.
 */
(function () {
    'use strict';

    if (!window.matchMedia) return;
    var escuro = window.matchMedia('(prefers-color-scheme: dark)');

    function acertar() {
        var claro = escuro.matches;
        var desenho = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
        var ico = document.querySelector('link[rel="icon"][sizes]');
        if (desenho) desenho.href = claro ? '/favicon-claro.svg' : '/favicon-escuro.svg';
        if (ico) ico.href = claro ? '/favicon-claro.ico' : '/favicon.ico';
    }

    acertar();
    if (escuro.addEventListener) escuro.addEventListener('change', acertar);
    else if (escuro.addListener) escuro.addListener(acertar);
})();
