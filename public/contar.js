/**
 * As contas do site, do lado de quem o visita.
 *
 * A página das estatísticas (malhaviva.pt/estatisticas) diz quantas
 * visitas o site teve, quantas vezes se partilhou a ligação de uma casa ou
 * de um local marcado, e quantos percursos do modo navegação se fizeram.
 * Quem as guarda é o servidor (src/contas.ts); quem as manda é isto.
 *
 * Só se manda "mais um" — uma visita, uma partilha, um percurso —, e nada
 * sobre quem visita: nem quem é, nem onde está, nem que casa procurou.
 *
 * Uma visita é abrir o site. Andar de página em página, recarregar, ou
 * voltar antes de passar meia hora sem lá estar, é a mesma visita (o
 * navegador lembra-se da última vez, cá dentro, e não a manda a ninguém).
 * As páginas que abrem dentro do bairro — os testemunhos, as paragens 360º,
 * o timelapse, o mapa dos bairros — não contam à parte: são a visita ao
 * bairro.
 *
 * Não contam os navegadores comandados por programas (os robôs que correm
 * o código das páginas dizem-no, em `navigator.webdriver`), nem um
 * navegador onde se escolheu, na página das estatísticas, não contar —
 * para quem faz o site não somar as suas próprias visitas.
 *
 * Isto é um ficheiro comum, e não um módulo, para ser lido do mesmo modo
 * por todas as páginas, como o ficheiro das línguas.
 */
(function () {
    'use strict';

    var ENDERECO = '/api/contar';
    var MEIA_HORA = 30 * 60 * 1000;
    // A última vez que este navegador esteve no site (um número de
    // milissegundos), e se não se conta.
    var ULTIMA = 'contas.ultimaVez';
    var NAO_CONTAR = 'contas.naoContar';

    function ler(chave) {
        try { return localStorage.getItem(chave); } catch (e) { /* sem memória */ }
        try { return sessionStorage.getItem(chave); } catch (e) { /* nem esta */ }
        return null;
    }
    function guardar(chave, valor) {
        try { localStorage.setItem(chave, valor); return; } catch (e) { /* sem memória */ }
        try { sessionStorage.setItem(chave, valor); } catch (e) { /* nem esta */ }
    }
    function esquecer(chave) {
        try { localStorage.removeItem(chave); } catch (e) { /* sem memória */ }
        try { sessionStorage.removeItem(chave); } catch (e) { /* nem esta */ }
    }

    function aContar() {
        return navigator.webdriver !== true && ler(NAO_CONTAR) !== 'sim';
    }

    /**
     * Manda mais um. Vai pelo `sendBeacon`, que o navegador entrega mesmo
     * que a página se feche logo a seguir, e não espera resposta nenhuma.
     */
    function mandar(tipo, qual) {
        if (!aContar()) return;
        var corpo = JSON.stringify({ tipo: tipo, qual: qual || '' });
        try {
            if (navigator.sendBeacon && navigator.sendBeacon(ENDERECO, new Blob([corpo], { type: 'text/plain' }))) return;
        } catch (e) { /* vai pela outra porta */ }
        try {
            fetch(ENDERECO, { method: 'POST', body: corpo, keepalive: true, headers: { 'Content-Type': 'text/plain' } })
                .catch(function () { /* fica por contar */ });
        } catch (e) { /* fica por contar */ }
    }

    // ---- A visita ----
    //
    // Conta-se ao abrir a página, se a última vez foi há mais de meia hora
    // (ou nunca); e, enquanto a página está à vista, a última vez vai
    // andando com o relógio, para quem passa horas no bairro e depois vai
    // aos créditos não contar duas.
    // A página das estatísticas lê isto com `data-sem-visita`: abri-la
    // para ver as contas não é visitar o site.
    var numaMoldura = false;
    try { numaMoldura = window.top !== window; } catch (e) { numaMoldura = true; }
    var semVisita = !!(document.currentScript && document.currentScript.hasAttribute('data-sem-visita'));

    function agora() { return String(Date.now()); }

    if (!numaMoldura && !semVisita) {
        var ultima = Number(ler(ULTIMA)) || 0;
        guardar(ULTIMA, agora());
        if (Date.now() - ultima > MEIA_HORA) mandar('visita');

        setInterval(function () {
            if (!document.hidden) guardar(ULTIMA, agora());
        }, 60 * 1000);
        document.addEventListener('visibilitychange', function () {
            guardar(ULTIMA, agora());
        });
        window.addEventListener('pagehide', function () {
            guardar(ULTIMA, agora());
        });
    }

    /**
     * O que as páginas usam:
     *
     *   Contador.partilha('casa' | 'local' | 'site') - partilhou-se uma ligação;
     *   Contador.percurso('iniciado' | 'feito')      - um percurso do modo navegação;
     *   Contador.ligacaoDe(endereco)                 - de que é uma ligação do site;
     *   Contador.aContar() / Contador.naoContar(sim) - se este navegador conta.
     */
    window.Contador = {
        partilha: function (qual) { mandar('partilha', qual); },
        percurso: function (qual) { mandar('percurso', qual); },
        /**
         * A ligação de uma casa (malhaviva.pt/d31), de um local marcado
         * (malhaviva.pt/@38.67,-9.18), ou do site. São os endereços que o
         * servidor reconhece (ver `casaDoEnderecoCurto` e `localDoEndereco`
         * em src/index.ts).
         */
        ligacaoDe: function (endereco) {
            var caminho = '/';
            try { caminho = decodeURIComponent(new URL(endereco, location.href).pathname); } catch (e) { /* fica o do site */ }
            if (/^\/[A-Za-z]?\d{1,4}(?:\.\d{1,2})?(?:-[1-9])?\/?$/.test(caminho) || /^\/casa\//.test(caminho)) return 'casa';
            if (/^\/@-?\d/.test(caminho)) return 'local';
            return 'site';
        },
        aContar: aContar,
        naoContar: function (sim) {
            if (sim) guardar(NAO_CONTAR, 'sim');
            else esquecer(NAO_CONTAR);
        }
    };
})();
