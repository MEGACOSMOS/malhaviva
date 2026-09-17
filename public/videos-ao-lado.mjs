import { fontesDeVideo, previaDe, olharInicialDe, ABERTURA_INICIAL } from './videos.mjs?v=7';
import { carregarPrevia360 } from './previa-360.mjs?v=1';

/**
 * A roleta de vídeos do lado esquerdo.
 *
 * Quando o ecrã está deitado (mais largo do que alto) sobra espaço à
 * esquerda do bairro, e nele fica uma coluna com os testemunhos e as
 * rotas 360º: uma janela pequena com o primeiro instante de cada vídeo,
 * com o contorno fino dos menus do site, e o nome por baixo. A coluna
 * roda sozinha, devagarinho, e não tem fim: quando o último passa, volta
 * o primeiro — uma roleta. A roda do rato (ou o dedo) puxa-a para onde
 * se quiser, e enquanto o rato está em cima dela pára, para se poder
 * carregar numa janela sem ela fugir.
 *
 * Cada janela é o marcador dessa pessoa ou rota noutra roupa: carregar
 * nela abre o mesmo vídeo, fica cinzenta quando já se viu e leva a
 * caixinha de "voltar" no último que se viu; e quando o rato pára numa
 * janela acende-se o marcador no mapa, e ao contrário, com o mesmo salto
 * de tamanho. Ao alto, num telemóvel de pé, a coluna não existe: não há
 * largura para ela.
 *
 * Para a roleta não ter fim, a lista é posta várias vezes seguidas e a
 * coluna anda sempre pela cópia do meio: quando chega ao fim dessa cópia
 * salta, sem se ver, para o mesmo ponto da cópia anterior.
 */

// A que velocidade a roleta roda sozinha, em pontos por segundo: quase
// nada — uma janela leva perto de vinte segundos a passar.
const VELOCIDADE = 6;

// A janela de cada vídeo, em pontos, no computador e num telemóvel
// deitado.
const JANELA = { largura: 112, altura: 63 };
const JANELA_PEQUENA = { largura: 88, altura: 50 };

// Folga de cada lado da coluna, para o salto de tamanho ao passar o rato
// não ficar cortado.
const FOLGA = 12;

// As letras das rotas 360º, pela ordem dos trilhos (como no mapa).
const LETRAS_DAS_ROTAS = ['A', 'B', 'C'];

const CSS = `
    #videos-ao-lado {
        position: fixed;
        left: ${24 - FOLGA}px;
        top: 88px;
        bottom: 24px;
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
        padding: 8px 0;
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
        border: 1px solid rgba(255, 255, 255, 0.15);
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
    }
`;

/**
 * Liga a roleta de vídeos ao mapa.
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

    // ---- O que há para ver: os testemunhos primeiro, as rotas depois ----
    // Cada entrada guarda a imagem do primeiro instante numa tela própria,
    // de onde se copia para cada janela (a lista é posta várias vezes).
    const entradas = [];
    for (const ann of controlador.annotations) {
        if (ann.is360 || !ann.video) continue;
        entradas.push({ ann, nome: ann.label, imagem: null, janelas: [], acesoNoMapa: false });
    }
    for (const ann of controlador.annotations) {
        if (!ann.is360 || ann.isImage) continue;
        const letra = LETRAS_DAS_ROTAS[ann.trailIndex] || LETRAS_DAS_ROTAS[0];
        entradas.push({ ann, nome: ann.label + ' ' + letra, imagem: null, janelas: [], acesoNoMapa: false });
    }
    if (entradas.length === 0) return;

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
    for (const entrada of entradas) {
        const { ann } = entrada;
        if (ann.is360) {
            const video = controlador.videoDaRota360 ? controlador.videoDaRota360(ann) : ('Esvarena - 360 - ' + (LETRAS_DAS_ROTAS[ann.trailIndex] || 'A'));
            const tela = document.createElement('canvas');
            carregarPrevia360(tela, previaDe(video), olharInicialDe(video), ABERTURA_INICIAL, LARGURA_DA_IMAGEM, ALTURA_DA_IMAGEM)
                .then(() => { entrada.imagem = tela; pintar(entrada); })
                .catch(() => { /* sem prévia: a janela fica escura */ });
        } else {
            const fontes = fontesDeVideo(ann.video);
            const leve = fontes['480p'] || fontes['720p'] || Object.values(fontes)[0];
            if (!leve) continue;
            const filme = document.createElement('video');
            filme.muted = true;
            filme.playsInline = true;
            filme.preload = 'metadata';
            filme.crossOrigin = 'anonymous';
            const guardarOInstante = () => {
                if (filme.readyState < 2 || entrada.imagem) return;
                const tela = document.createElement('canvas');
                tela.width = LARGURA_DA_IMAGEM;
                tela.height = ALTURA_DA_IMAGEM;
                // A imagem inteira, cortada ao centro para caber na janela.
                const escala = Math.max(LARGURA_DA_IMAGEM / filme.videoWidth, ALTURA_DA_IMAGEM / filme.videoHeight);
                const w = filme.videoWidth * escala;
                const h = filme.videoHeight * escala;
                tela.getContext('2d').drawImage(filme, (LARGURA_DA_IMAGEM - w) / 2, (ALTURA_DA_IMAGEM - h) / 2, w, h);
                entrada.imagem = tela;
                pintar(entrada);
                // Com a imagem guardada, o vídeo já não faz falta.
                filme.removeAttribute('src');
                filme.load();
            };
            filme.addEventListener('loadeddata', guardarOInstante);
            filme.addEventListener('seeked', guardarOInstante);
            // O "#t=0.001" pede ao navegador a imagem do primeiro instante.
            filme.src = leve + '#t=0.001';
            filme.load();
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
        // classe com que o comando de jogo o acende).
        botao.addEventListener('mouseenter', () => {
            if (ann.element) ann.element.classList.add('force-hover');
        });
        botao.addEventListener('mouseleave', () => {
            if (ann.element) ann.element.classList.remove('force-hover');
        });
        return botao;
    }

    /**
     * Quantas vezes a lista tem de ser posta para a coluna nunca mostrar
     * uma ponta: a cópia do meio mais uma de cada lado, e mais as que
     * forem precisas se a coluna for mais alta do que uma lista.
     */
    let copias = 0;
    let alturaDaLista = 0;
    const quantasPrecisas = () => (alturaDaLista > 0 ? Math.max(3, Math.ceil(coluna.clientHeight / alturaDaLista) + 2) : 3);
    function encher() {
        const precisas = quantasPrecisas();
        if (precisas === copias) return;
        copias = precisas;
        faixa.innerHTML = '';
        for (const entrada of entradas) entrada.janelas = [];
        for (let c = 0; c < copias; c++) {
            for (const entrada of entradas) faixa.appendChild(fazerJanela(entrada));
        }
        for (const entrada of entradas) pintar(entrada);
        nomear();
        copiarDosMarcadores();
        // A altura de uma lista: do primeiro da primeira cópia ao primeiro
        // da segunda.
        alturaDaLista = faixa.children[entradas.length].offsetTop - faixa.children[0].offsetTop;
        coluna.scrollTop = alturaDaLista;
        // Medida a lista, pode ser que afinal façam falta mais cópias.
        if (quantasPrecisas() !== copias) encher();
    }

    /** Os nomes por que se dão a conhecer, na língua do momento. */
    function nomear() {
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
    if (window.ResizeObserver) new ResizeObserver(encher).observe(coluna);

    // ---- A roleta ----
    // A cada imagem a coluna desce um bocadinho; a roda do rato mexe-a
    // por si (é uma coluna que desliza, como qualquer outra), e enquanto
    // o rato está em cima dela fica parada.
    let parada = false;
    coluna.addEventListener('mouseenter', () => { parada = true; });
    coluna.addEventListener('mouseleave', () => { parada = false; });
    let resto = 0;
    let antes = 0;
    function passo(agora) {
        requestAnimationFrame(passo);
        const dt = Math.min(0.1, (agora - antes) / 1000);
        antes = agora;
        if (coluna.clientHeight === 0 || alturaDaLista <= 0) return;
        let posicao = coluna.scrollTop;
        if (!parada && coluna.classList.contains('visivel')) {
            posicao += resto + VELOCIDADE * dt;
        }
        // Anda sempre pela cópia do meio: passada uma lista para qualquer
        // dos lados, salta uma lista para trás — não se vê.
        if (posicao >= alturaDaLista * 2) posicao -= alturaDaLista;
        else if (posicao < alturaDaLista) posicao += alturaDaLista;
        coluna.scrollTop = posicao;
        // O que o navegador arredondou fica guardado para a imagem seguinte.
        resto = posicao - coluna.scrollTop;
        if (Math.abs(resto) > 1) resto = 0;
    }
    requestAnimationFrame((t) => { antes = t; passo(t); });

    // Nasce com o cabeçalho.
    const cabecalho = document.getElementById('header');
    const acompanhar = () => coluna.classList.toggle('visivel', !!cabecalho && cabecalho.classList.contains('visible'));
    acompanhar();
    if (cabecalho) {
        new MutationObserver(acompanhar).observe(cabecalho, { attributes: true, attributeFilter: ['class'] });
    }
}
