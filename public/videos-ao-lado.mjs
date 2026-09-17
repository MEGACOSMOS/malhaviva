import { fontesDeVideo, previaDe, olharInicialDe, ABERTURA_INICIAL } from './videos.mjs?v=7';
import { carregarPrevia360 } from './previa-360.mjs?v=1';

/**
 * A coluna de vídeos do lado esquerdo.
 *
 * Quando o ecrã está deitado (mais largo do que alto) sobra espaço à
 * esquerda do bairro, e nele fica uma coluna com os testemunhos e as
 * rotas 360º, cada colecção com o seu título por cima, encostado ao lado
 * esquerdo das janelas: uma janela pequena com o primeiro instante de
 * cada vídeo, com o contorno fino dos menus do site, e o nome por baixo.
 * A roda do rato (ou o dedo) desliza a coluna quando não cabe toda.
 *
 * Cada janela é o marcador dessa pessoa ou rota noutra roupa: carregar
 * nela abre o mesmo vídeo, fica cinzenta quando já se viu e leva a
 * caixinha de "voltar" no último que se viu; e quando o rato pára numa
 * janela acende-se o marcador no mapa (e, nas rotas, o trilho no chão),
 * e ao contrário, com o mesmo salto de tamanho. Ao alto, num telemóvel
 * de pé, a coluna não existe: não há largura para ela.
 *
 * A lista é a das anotações do mapa (annotations.mjs), tal e qual: um
 * testemunho novo ou uma rota nova acrescentados lá aparecem aqui sem
 * mais nada, com tudo o que os outros têm — o nome vem de lá, a imagem
 * vem do vídeo, o visto e o aceso vêm do marcador. Só as fotografias 360º
 * (o Olho de Águia) ficam de fora: não são vídeos.
 */

// A janela de cada vídeo, em pontos, no computador e num telemóvel
// deitado.
const JANELA = { largura: 112, altura: 63 };
const JANELA_PEQUENA = { largura: 88, altura: 50 };

// Folga de cada lado da coluna, para o salto de tamanho ao passar o rato
// não ficar cortado.
const FOLGA = 12;

// As letras das rotas 360º, pela ordem dos trilhos (como no mapa), para
// quando o controlador dos marcadores não souber dizer o nome do vídeo.
const LETRAS_DAS_ROTAS = ['A', 'B', 'C'];

// Uma imagem do primeiro instante toda preta (um vídeo que começa do
// escuro) não serve de janela: procura-se mais à frente, de meio em meio
// segundo, até aqui.
const CLARIDADE_MINIMA = 6;
const PASSO_A_PROCURAR = 0.5;
const ATE_ONDE_PROCURAR = 6;

const CSS = `
    #videos-ao-lado {
        position: fixed;
        left: ${24 - FOLGA}px;
        /* A meio da altura do ecrã, e com pouco mais de metade dela. A
           coluna sobe o que a faixa lhe dá de folga em cima (ver .faixa):
           assim o primeiro título fica onde ficava, já fora da ponta
           esbatida, e o esbatimento acontece por cima dele. */
        top: calc(22% - 32px);
        bottom: 22%;
        z-index: 100;
        width: ${JANELA.largura + 2 + FOLGA * 2}px;
        padding: 0 ${FOLGA}px;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-width: none;
        /* As pontas esbatem-se: as janelas entram e saem a desvanecer. */
        -webkit-mask-image: linear-gradient(to bottom, transparent, #000 40px, #000 calc(100% - 40px), transparent);
        mask-image: linear-gradient(to bottom, transparent, #000 40px, #000 calc(100% - 40px), transparent);
        opacity: 0;
        transform: translateX(-8px);
        pointer-events: none;
        transition: opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s;
    }
    #videos-ao-lado::-webkit-scrollbar {
        display: none;
    }
    #videos-ao-lado.visivel {
        opacity: 1;
        transform: none;
        pointer-events: auto;
    }
    /* Só deitado: ao alto não há largura para uma coluna ao lado. */
    @media (orientation: portrait) {
        #videos-ao-lado { display: none; }
    }
    body.em-cartao #videos-ao-lado {
        display: none;
    }
    #videos-ao-lado .faixa {
        display: flex;
        flex-direction: column;
        gap: 14px;
        /* Em cima, a folga é a ponta esbatida inteira: o primeiro título
           nasce logo a seguir a ela, bem legível. */
        padding: 40px 0 8px;
    }
    /* O título de cada colecção, encostado ao lado esquerdo das janelas,
       com um fio por baixo da largura delas. */
    #videos-ao-lado .video-ao-lado-separador {
        flex: none;
        width: ${JANELA.largura + 2}px;
        margin: 6px 0 -2px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        color: var(--color-text-muted, rgba(255, 255, 255, 0.7));
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    }
    #videos-ao-lado .video-ao-lado-separador:first-child {
        margin-top: 0;
    }
    #videos-ao-lado .video-ao-lado {
        position: relative;
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 0;
        margin: 0;
        border: none;
        background: none;
        color: #ffffff;
        font-family: inherit;
        cursor: pointer;
        text-align: center;
        /* O mesmo salto de tamanho dos marcadores do mapa, na janela e no
           nome. */
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #videos-ao-lado .video-ao-lado:hover,
    #videos-ao-lado .video-ao-lado.realce,
    #videos-ao-lado .video-ao-lado:focus-visible {
        transform: scale(1.15);
        z-index: 1;
    }
    #videos-ao-lado .video-ao-lado:focus {
        outline: none;
    }
    #videos-ao-lado .video-ao-lado:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.95);
        outline-offset: 3px;
    }
    /* A janela: o contorno fino dos menus do site à volta da imagem. */
    #videos-ao-lado .video-ao-lado-janela {
        position: relative;
        width: ${JANELA.largura}px;
        height: ${JANELA.altura}px;
        background: #05050a;
        border: 2.5px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    }
    #videos-ao-lado .video-ao-lado-janela canvas {
        display: block;
        width: 100%;
        height: 100%;
        opacity: 0;
        transition: opacity 0.4s ease;
    }
    #videos-ao-lado .video-ao-lado-janela canvas.pronto {
        opacity: 1;
    }
    /* Já visto: esbate-se em cinzento, como o marcador no mapa. */
    #videos-ao-lado .video-ao-lado.visto .video-ao-lado-janela canvas {
        filter: grayscale(1);
        opacity: 0.55;
    }
    /* O último que se viu: a mesma caixinha com a seta de "voltar" que
       o marcador leva no mapa, no mesmo canto — tal e qual. */
    #videos-ao-lado .video-ao-lado.ultimo .video-ao-lado-janela::after {
        content: "";
        position: absolute;
        top: -6px;
        right: -6px;
        width: 16px;
        height: 16px;
        background: #05050a url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='square' stroke-linejoin='miter'><polyline points='5 7 20 7 20 19 4 19'/><polyline points='9 3 5 7 9 11'/></svg>") center / 11px 11px no-repeat;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }
    #videos-ao-lado .video-ao-lado-nome {
        max-width: ${JANELA.largura}px;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    }
    /* Num telemóvel deitado há pouca altura: a coluna encosta mais ao
       cabeçalho e pára em cima do manípulo, e as janelas são mais
       pequenas. */
    @media (hover: none) and (pointer: coarse) and (orientation: landscape) {
        #videos-ao-lado {
            left: ${16 - FOLGA}px;
            top: 64px;
            bottom: 140px;
            width: ${JANELA_PEQUENA.largura + 2 + FOLGA * 2}px;
        }
        #videos-ao-lado .faixa {
            gap: 10px;
        }
        #videos-ao-lado .video-ao-lado-janela {
            width: ${JANELA_PEQUENA.largura}px;
            height: ${JANELA_PEQUENA.altura}px;
        }
        #videos-ao-lado .video-ao-lado-nome {
            max-width: ${JANELA_PEQUENA.largura}px;
            font-size: 0.7rem;
        }
        #videos-ao-lado .video-ao-lado-separador {
            width: ${JANELA_PEQUENA.largura + 2}px;
            font-size: 0.62rem;
        }
    }
`;

/**
 * Liga a coluna de vídeos ao mapa.
 *
 * @param {object} app - A aplicação 3D.
 */
export function ligarVideosAoLado(app) {
    // Os marcadores podem ainda não ter nascido quando o mapa arranca:
    // espera-se por eles, imagem a imagem.
    const camara = app.root.findByName('camera');
    const controlador = camara && camara.script && camara.script.annotationController;
    if (!controlador || !controlador.annotations) {
        app.once('update', () => ligarVideosAoLado(app));
        return;
    }

    const estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    const coluna = document.createElement('nav');
    coluna.id = 'videos-ao-lado';
    coluna.setAttribute('aria-label', 'Vídeos');
    const faixa = document.createElement('div');
    faixa.className = 'faixa';
    coluna.appendChild(faixa);

    const trilhos = camara.script.trailController || null;

    /**
     * O nome do vídeo de uma rota 360º, pelo controlador dos marcadores
     * (é ele que sabe), ou pela letra do trilho se ele não souber.
     */
    const videoDaRota = (ann) => (controlador.videoDaRota360 ? controlador.videoDaRota360(ann) :
        ('Esvarena - 360 - ' + (LETRAS_DAS_ROTAS[ann.trailIndex] || LETRAS_DAS_ROTAS[0])));

    // ---- O que há para ver: os testemunhos primeiro, as rotas depois ----
    // Tudo vem da lista de anotações do mapa. Cada entrada guarda a
    // imagem do primeiro instante numa tela própria, de onde se copia
    // para cada janela (a lista é posta várias vezes).
    const eTestemunho = (ann) => !ann.is360 && !!ann.video;
    const eRota = (ann) => !!ann.is360 && !ann.isImage;
    const entradas = [];
    for (const ann of controlador.annotations) {
        if (eTestemunho(ann)) entradas.push({ ann, coleccao: 'testemunhos', nome: ann.label, imagem: null, janelas: [], acesoNoMapa: false });
    }
    for (const ann of controlador.annotations) {
        // O nome curto: o sítio e a letra da rota ("Esvarena B").
        if (eRota(ann)) entradas.push({ ann, coleccao: 'rotas', nome: ann.label + ' ' + videoDaRota(ann).slice(-1), imagem: null, janelas: [], acesoNoMapa: false });
    }
    if (entradas.length === 0) return;

    // As colecções, pela ordem em que aparecem, com o título de cada uma
    // (a mesma palavra que as definições usam para elas).
    const COLECCOES = [
        { id: 'testemunhos', chave: 'def.testemunhos', titulo: 'Testemunhos' },
        { id: 'rotas', chave: 'def.rotas360', titulo: 'Rotas 360º' }
    ];

    /**
     * Copia a imagem de uma entrada para todas as suas janelas.
     *
     * @param {object} entrada - A entrada.
     */
    function pintar(entrada) {
        if (!entrada.imagem) return;
        for (const tela of entrada.janelas) {
            tela.width = entrada.imagem.width;
            tela.height = entrada.imagem.height;
            tela.getContext('2d').drawImage(entrada.imagem, 0, 0);
            tela.classList.add('pronto');
        }
    }

    // As imagens: dos testemunhos, o primeiro instante do vídeo leve; das
    // rotas, a fotografia 360º vista com a câmara com que o player começa.
    const LARGURA_DA_IMAGEM = JANELA.largura * 2;
    const ALTURA_DA_IMAGEM = JANELA.altura * 2;
    /**
     * Se uma tela está praticamente toda preta — uma imagem que ainda não
     * chegou, ou um vídeo que começa do escuro. Numa tela que o navegador
     * não deixa ler (vídeo sem licença de origem) dá-se por boa.
     *
     * @param {HTMLCanvasElement} tela - A tela.
     * @returns {boolean} Se está preta.
     */
    function estaPreta(tela) {
        try {
            const amostra = document.createElement('canvas');
            amostra.width = 16;
            amostra.height = 9;
            const c = amostra.getContext('2d', { willReadFrequently: true });
            c.drawImage(tela, 0, 0, 16, 9);
            const p = c.getImageData(0, 0, 16, 9).data;
            let soma = 0;
            for (let i = 0; i < p.length; i += 4) soma += Math.max(p[i], p[i + 1], p[i + 2]);
            return soma / (p.length / 4) < CLARIDADE_MINIMA;
        } catch (e) {
            return false;
        }
    }

    /**
     * Vai buscar a imagem do primeiro instante de um testemunho: abre-se
     * o vídeo leve, espera-se por uma imagem a sério (e não por um preto
     * antes de a imagem chegar) e guarda-se numa tela. Se o navegador não
     * deixar ler o vídeo com licença de origem, tenta-se sem ela.
     *
     * @param {object} entrada - A entrada.
     * @param {string} endereco - O vídeo leve.
     * @param {boolean} comLicenca - Se se pede a licença de origem.
     */
    function irBuscarOInstante(entrada, endereco, comLicenca) {
        const filme = document.createElement('video');
        filme.muted = true;
        filme.playsInline = true;
        filme.preload = 'auto';
        if (comLicenca) filme.crossOrigin = 'anonymous';
        let aProcurar = 0;
        let arrumado = false;

        const arrumar = () => {
            if (arrumado) return;
            arrumado = true;
            filme.removeAttribute('src');
            filme.load();
        };
        const tentar = () => {
            if (entrada.imagem || arrumado) return;
            if (filme.readyState < 2 || !filme.videoWidth) return;
            const tela = document.createElement('canvas');
            tela.width = LARGURA_DA_IMAGEM;
            tela.height = ALTURA_DA_IMAGEM;
            // A imagem inteira, cortada ao centro para caber na janela.
            const escala = Math.max(LARGURA_DA_IMAGEM / filme.videoWidth, ALTURA_DA_IMAGEM / filme.videoHeight);
            const w = filme.videoWidth * escala;
            const h = filme.videoHeight * escala;
            tela.getContext('2d').drawImage(filme, (LARGURA_DA_IMAGEM - w) / 2, (ALTURA_DA_IMAGEM - h) / 2, w, h);
            if (estaPreta(tela)) {
                // Ainda escuro: mais à frente, até um certo ponto.
                if (aProcurar < ATE_ONDE_PROCURAR) {
                    aProcurar += PASSO_A_PROCURAR;
                    filme.currentTime = aProcurar;
                } else {
                    entrada.imagem = tela;
                    pintar(entrada);
                    arrumar();
                }
                return;
            }
            entrada.imagem = tela;
            pintar(entrada);
            // Com a imagem guardada, o vídeo já não faz falta.
            arrumar();
        };
        filme.addEventListener('loadeddata', tentar);
        filme.addEventListener('seeked', tentar);
        filme.addEventListener('canplay', tentar);
        // Onde o navegador sabe dizer quando uma imagem foi mesmo
        // desenhada, é o aviso mais seguro.
        if (typeof filme.requestVideoFrameCallback === 'function') {
            const aoDesenhar = () => {
                tentar();
                if (!entrada.imagem && !arrumado) filme.requestVideoFrameCallback(aoDesenhar);
            };
            filme.requestVideoFrameCallback(aoDesenhar);
        }
        filme.addEventListener('error', () => {
            if (entrada.imagem || arrumado) return;
            arrumado = true;
            if (comLicenca) irBuscarOInstante(entrada, endereco, false);
        });
        // O "#t=0.001" pede ao navegador a imagem do primeiro instante.
        filme.src = endereco + '#t=0.001';
        filme.load();
    }

    for (const entrada of entradas) {
        const { ann } = entrada;
        if (ann.is360) {
            const video = videoDaRota(ann);
            const tela = document.createElement('canvas');
            carregarPrevia360(tela, previaDe(video), olharInicialDe(video), ABERTURA_INICIAL, LARGURA_DA_IMAGEM, ALTURA_DA_IMAGEM)
                .then(() => { entrada.imagem = tela; pintar(entrada); })
                .catch((e) => console.warn('Coluna de vídeos: sem a prévia da rota.', e));
        } else {
            const fontes = fontesDeVideo(ann.video);
            const leve = fontes['480p'] || fontes['720p'] || Object.values(fontes)[0];
            if (!leve) continue;
            irBuscarOInstante(entrada, leve, true);
        }
    }

    // ---- As janelas, uma lista atrás da outra ----

    /**
     * Faz uma janela para uma entrada.
     *
     * @param {object} entrada - A entrada.
     * @returns {HTMLButtonElement} O botão com a janela e o nome.
     */
    function fazerJanela(entrada) {
        const { ann } = entrada;
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'video-ao-lado';
        // A rota a que pertence, para o controlador dos trilhos saber qual
        // acender quando o rato aqui pára.
        if (ann.trailIndex !== undefined) botao.dataset.trailIndex = ann.trailIndex;

        const janela = document.createElement('div');
        janela.className = 'video-ao-lado-janela';
        const tela = document.createElement('canvas');
        tela.setAttribute('aria-hidden', 'true');
        janela.appendChild(tela);
        entrada.janelas.push(tela);

        const nome = document.createElement('div');
        nome.className = 'video-ao-lado-nome';
        nome.textContent = entrada.nome;

        botao.appendChild(janela);
        botao.appendChild(nome);
        // Carregar aqui é carregar no marcador: o mesmo vídeo, o mesmo
        // "visto".
        botao.addEventListener('click', () => {
            if (ann.element) ann.element.click();
        });
        // O rato em cima da janela acende o marcador no mapa (a mesma
        // classe com que o comando de jogo o acende) e, numa rota, o
        // trilho no chão — como quando o rato pára no próprio marcador.
        botao.addEventListener('mouseenter', () => {
            if (ann.element) ann.element.classList.add('force-hover');
            acenderOTrilho(ann, true);
        });
        botao.addEventListener('mouseleave', () => {
            if (ann.element) ann.element.classList.remove('force-hover');
            acenderOTrilho(ann, false);
        });
        return botao;
    }

    /**
     * Acende ou apaga o trilho de uma rota no chão do bairro.
     *
     * @param {object} ann - A anotação (só as rotas têm trilho).
     * @param {boolean} aceso - Se acende.
     */
    function acenderOTrilho(ann, aceso) {
        if (!trilhos || !trilhos.trailRenderData || ann.trailIndex === undefined) return;
        if (trilhos._trailsVisible === false) return;
        const trilho = trilhos.trailRenderData[ann.trailIndex];
        if (trilho && trilhos.setTrailHoverState) trilhos.setTrailHoverState(trilho, aceso);
    }

    /**
     * Põe as janelas na coluna, colecção a colecção, cada uma com o seu
     * título por cima.
     */
    const separadores = [];
    function encher() {
        faixa.innerHTML = '';
        for (const entrada of entradas) entrada.janelas = [];
        for (const coleccao of COLECCOES) {
            const suas = entradas.filter((entrada) => entrada.coleccao === coleccao.id);
            if (suas.length === 0) continue;
            const separador = document.createElement('div');
            separador.className = 'video-ao-lado-separador';
            separador.dataset.chave = coleccao.chave;
            separador.textContent = coleccao.titulo;
            faixa.appendChild(separador);
            separadores.push(separador);
            for (const entrada of suas) faixa.appendChild(fazerJanela(entrada));
        }
        for (const entrada of entradas) pintar(entrada);
        nomear();
        copiarDosMarcadores();
    }

    /** Os nomes por que se dão a conhecer, na língua do momento. */
    function nomear() {
        for (const separador of separadores) {
            const titulo = window.Idiomas && window.Idiomas.t ? window.Idiomas.t(separador.dataset.chave) : '';
            if (titulo) separador.textContent = titulo;
        }
        for (const entrada of entradas) {
            const nome = controlador.nomeAcessivel ? controlador.nomeAcessivel(entrada.ann) : entrada.nome;
            for (const tela of entrada.janelas) {
                const botao = tela.closest('button');
                botao.setAttribute('aria-label', nome);
                botao.title = nome;
            }
        }
    }
    window.addEventListener('idiomamudou', nomear);

    /**
     * O visto, o último visto e o aceso, copiados dos marcadores do mapa
     * para todas as janelas de cada entrada.
     */
    function copiarDosMarcadores() {
        for (const entrada of entradas) {
            const { ann } = entrada;
            const ponto = ann.element && ann.element.querySelector('.marker-dot');
            const visto = !!ponto && ponto.classList.contains('viewed');
            const ultimo = !!ponto && ponto.classList.contains('last-viewed');
            // Acende com o rato em cima do marcador, ou quando o comando
            // de jogo o escolhe (a classe com que ele o acende).
            const aceso = entrada.acesoNoMapa || !!(ann.element && ann.element.classList.contains('force-hover'));
            for (const tela of entrada.janelas) {
                const botao = tela.closest('button');
                botao.classList.toggle('visto', visto);
                botao.classList.toggle('ultimo', ultimo);
                botao.classList.toggle('realce', aceso && !botao.matches(':hover'));
            }
        }
    }
    const recipiente = document.getElementById('annotations-container');
    if (recipiente) {
        new MutationObserver(copiarDosMarcadores).observe(recipiente, {
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }
    // O rato em cima do marcador acende as janelas dessa entrada.
    for (const entrada of entradas) {
        if (!entrada.ann.element) continue;
        entrada.ann.element.addEventListener('mouseenter', () => { entrada.acesoNoMapa = true; copiarDosMarcadores(); });
        entrada.ann.element.addEventListener('mouseleave', () => { entrada.acesoNoMapa = false; copiarDosMarcadores(); });
    }

    document.body.appendChild(coluna);
    encher();

    // Nasce com o cabeçalho.
    const cabecalho = document.getElementById('header');
    const acompanhar = () => coluna.classList.toggle('visivel', !!cabecalho && cabecalho.classList.contains('visible'));
    acompanhar();
    if (cabecalho) {
        new MutationObserver(acompanhar).observe(cabecalho, { attributes: true, attributeFilter: ['class'] });
    }
}
