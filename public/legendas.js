/**
 * As legendas dos vídeos.
 *
 * Cada vídeo com fala tem uma legenda em português, inglês e espanhol,
 * guardada em `/legendas/<nome do vídeo>/<língua>.vtt` (o formato de
 * legendas da web: blocos de tempo e texto, que se corrigem num editor de
 * texto qualquer). A legenda que se vê é a da língua escolhida no site, e
 * troca sozinha quando se troca de língua.
 *
 * O desenho não é o do navegador. O leitor das rotas 360º mostra o filme
 * colado numa esfera, dentro de uma tela 3D, onde o navegador não sabe
 * pôr legendas; por isso as duas peças fazem igual — o texto vai numa
 * caixa nossa, por cima da imagem, com o desenho do site.
 *
 * Ligar e desligar é um botão na barra de cada leitor (e a tecla C). A
 * escolha fica guardada no navegador e vale para todos os vídeos, também
 * para os que estão abertos noutra moldura da mesma página.
 *
 * Isto é um ficheiro comum, e não um módulo, para ser lido pelo mapa e
 * pela página das rotas do mesmo modo que o ficheiro das línguas.
 */
(function () {
    'use strict';

    // Muda quando as legendas forem refeitas, para os navegadores não
    // ficarem com as antigas guardadas.
    var VERSAO = 1;

    var CHAVE = 'legendas';
    // As línguas em que há legendas. Em Kriolu vê-se a portuguesa: quem
    // fala Kriolu cá lê português, e uma tradução para Kriolu fica para
    // quando houver quem a reveja. Uma língua nova é só juntá-la aqui,
    // com os ficheiros ao pé dos outros.
    var LINGUAS = ['pt', 'en', 'es'];

    // O desenho do botão: um ecrã com duas letras C, de traço quadrado como
    // os outros ícones. Desligadas, leva um risco por cima.
    var ICONE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">' +
        '<rect x="2" y="5" width="20" height="14"></rect>' +
        '<polyline points="10.5 9.5 6.5 9.5 6.5 14.5 10.5 14.5"></polyline>' +
        '<polyline points="17.5 9.5 13.5 9.5 13.5 14.5 17.5 14.5"></polyline>' +
        '<line class="risco-das-legendas" x1="3" y1="21" x2="21" y2="3"></line>' +
        '</svg>';

    /** Se as legendas estão ligadas. Começam ligadas. */
    function ligadas() {
        try { return localStorage.getItem(CHAVE) !== 'desligadas'; } catch (e) { return true; }
    }

    function guardar(sim) {
        try { localStorage.setItem(CHAVE, sim ? 'ligadas' : 'desligadas'); } catch (e) { /* fica só nesta página */ }
    }

    function linguaDoSite() {
        var l = window.Idiomas && typeof window.Idiomas.atual === 'function' ? window.Idiomas.atual() : 'pt';
        return LINGUAS.indexOf(l) >= 0 ? l : 'pt';
    }

    function t(chave, alternativa) {
        return (window.Idiomas && window.Idiomas.t(chave)) || alternativa;
    }

    /**
     * Lê um ficheiro de legendas: cada bloco é um tempo de entrada, um de
     * saída e uma ou duas linhas de texto.
     *
     * @param {string} texto - O ficheiro.
     * @returns {{inicio: number, fim: number, texto: string}[]} Os blocos, por ordem.
     */
    function lerVTT(texto) {
        var segundos = function (marca) {
            var partes = marca.trim().split(':');
            var s = 0;
            for (var i = 0; i < partes.length; i++) s = s * 60 + parseFloat(partes[i].replace(',', '.'));
            return s;
        };
        var blocos = [];
        texto.replace(/\r/g, '').split(/\n{2,}/).forEach(function (bloco) {
            var linhas = bloco.split('\n');
            for (var i = 0; i < linhas.length; i++) {
                var m = linhas[i].match(/^\s*([\d:.,]+)\s+-->\s+([\d:.,]+)/);
                if (!m) continue;
                var corpo = linhas.slice(i + 1).join('\n').trim();
                if (corpo) blocos.push({ inicio: segundos(m[1]), fim: segundos(m[2]), texto: corpo });
                break;
            }
        });
        blocos.sort(function (a, b) { return a.inicio - b.inicio; });
        return blocos;
    }

    // As legendas já descarregadas, por endereço, para trocar de língua ou
    // voltar a um vídeo sem as pedir outra vez.
    var guardadas = {};

    function buscar(nome, lingua) {
        var endereco = '/legendas/' + encodeURIComponent(nome) + '/' + lingua + '.vtt?v=' + VERSAO;
        if (!guardadas[endereco]) {
            guardadas[endereco] = fetch(endereco)
                .then(function (r) { return r.ok ? r.text() : null; })
                .then(function (texto) { return texto ? lerVTT(texto) : null; })
                .catch(function () { return null; });
        }
        return guardadas[endereco];
    }

    // Todos os leitores desta página, para os acertar quando se liga,
    // desliga ou troca de língua.
    var leitores = [];

    /**
     * Um leitor de legendas preso a um vídeo.
     *
     * @param {HTMLVideoElement} video - O filme.
     * @param {HTMLElement} caixa - Onde o texto aparece, por cima da imagem.
     * @param {HTMLButtonElement} [botao] - O botão de ligar e desligar.
     */
    function Leitor(video, caixa, botao) {
        this.video = video;
        this.caixa = caixa;
        this.botao = botao || null;
        this.nome = null;
        this.blocos = null;
        this.atual = null;
        this.pedido = 0;
        this.aCorrer = false;

        caixa.classList.add('legenda-do-video');
        caixa.setAttribute('aria-hidden', 'true');

        var self = this;
        var acertar = function () { self.acertar(); };
        ['timeupdate', 'seeked', 'seeking', 'pause', 'loadedmetadata', 'emptied'].forEach(function (ev) {
            video.addEventListener(ev, acertar);
        });
        video.addEventListener('play', function () { self.correr(); });

        if (this.botao) {
            this.botao.innerHTML = ICONE;
            this.botao.addEventListener('click', function (e) {
                e.stopPropagation();
                alternar();
            });
        }
        this.pintarBotao();
        leitores.push(this);
    }

    /**
     * Mostra as legendas de um vídeo, ou nenhumas.
     *
     * @param {string|null} nome - O nome do vídeo, como na lista dos vídeos.
     */
    Leitor.prototype.mostrar = function (nome) {
        this.nome = nome || null;
        this.carregar();
    };

    Leitor.prototype.carregar = function () {
        var self = this;
        var pedido = ++this.pedido;
        this.blocos = null;
        this.escrever(null);
        if (!this.nome) { this.pintarBotao(); return; }
        var lingua = linguaDoSite();
        buscar(this.nome, lingua).then(function (blocos) {
            // Sem a legenda nesta língua, vai a portuguesa.
            return blocos || (lingua === 'pt' ? null : buscar(self.nome, 'pt'));
        }).then(function (blocos) {
            if (pedido !== self.pedido) return;
            self.blocos = blocos;
            self.pintarBotao();
            self.acertar();
        });
    };

    /** Escreve o bloco que corresponde ao instante do filme. */
    Leitor.prototype.acertar = function () {
        if (!this.blocos || !ligadas()) { this.escrever(null); return; }
        var agora = this.video.currentTime;
        var achado = null;
        // Procura pelo meio: os blocos estão por ordem de entrada.
        var baixo = 0;
        var alto = this.blocos.length - 1;
        while (baixo <= alto) {
            var meio = (baixo + alto) >> 1;
            if (this.blocos[meio].inicio <= agora) { achado = meio; baixo = meio + 1; } else { alto = meio - 1; }
        }
        var bloco = achado !== null && agora < this.blocos[achado].fim ? this.blocos[achado] : null;
        this.escrever(bloco);
    };

    Leitor.prototype.escrever = function (bloco) {
        if (bloco === this.atual) return;
        this.atual = bloco;
        var caixa = this.caixa;
        while (caixa.firstChild) caixa.removeChild(caixa.firstChild);
        if (!bloco) { caixa.classList.remove('com-texto'); return; }
        // Cada linha numa faixa sua, com o fundo escuro só à volta das
        // letras, como nas legendas de cinema.
        bloco.texto.split('\n').forEach(function (linha) {
            var faixa = document.createElement('span');
            faixa.textContent = linha;
            caixa.appendChild(faixa);
        });
        caixa.classList.add('com-texto');
    };

    /**
     * Enquanto o filme anda, acerta-se a cada imagem: o aviso de tempo do
     * vídeo só chega umas quatro vezes por segundo, e as legendas
     * entravam atrasadas até um quarto de segundo.
     */
    Leitor.prototype.correr = function () {
        if (this.aCorrer) return;
        this.aCorrer = true;
        var self = this;
        var passo = function () {
            self.acertar();
            if (!self.video.paused && !self.video.ended) requestAnimationFrame(passo);
            else self.aCorrer = false;
        };
        requestAnimationFrame(passo);
    };

    Leitor.prototype.pintarBotao = function () {
        if (!this.botao) return;
        var sim = ligadas();
        // Sem legendas para este vídeo, o botão não aparece.
        this.botao.style.display = this.blocos ? '' : 'none';
        this.botao.classList.toggle('legendas-desligadas', !sim);
        this.botao.setAttribute('aria-pressed', sim ? 'true' : 'false');
        var nome = t('video.legendas', 'Legendas');
        this.botao.title = nome;
        this.botao.setAttribute('aria-label', nome);
    };

    function acertarTodos() {
        leitores.forEach(function (l) { l.pintarBotao(); l.atual = undefined; l.acertar(); });
    }

    /** Liga as legendas se estão desligadas, e desliga-as se estão ligadas. */
    function alternar() {
        guardar(!ligadas());
        acertarTodos();
    }

    // Trocou-se de língua: cada leitor vai buscar a legenda nova.
    window.addEventListener('idiomamudou', function () {
        leitores.forEach(function (l) { l.carregar(); });
    });
    // Ligadas ou desligadas noutra página, ou noutra moldura desta.
    window.addEventListener('storage', function (e) {
        if (e.key === CHAVE) acertarTodos();
    });

    window.Legendas = {
        /**
         * Prende as legendas a um vídeo.
         *
         * @param {HTMLVideoElement} video - O filme.
         * @param {HTMLElement} caixa - Onde o texto aparece.
         * @param {HTMLButtonElement} [botao] - O botão de ligar e desligar.
         * @returns {Leitor} O leitor; `mostrar(nome)` escolhe o vídeo.
         */
        ligar: function (video, caixa, botao) {
            return new Leitor(video, caixa, botao);
        },
        alternar: alternar,
        ligadas: ligadas
    };
})();
