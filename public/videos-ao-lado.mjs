import { fontesDeVideo } from './videos.mjs?v=7';

/**
 * A coluna de vídeos do lado esquerdo.
 *
 * Quando o ecrã está deitado (mais largo do que alto) sobra espaço à
 * esquerda do bairro, e nele fica uma coluna com os testemunhos: uma
 * caixa pequena, com a moldura dos menus do site, com o primeiro
 * instante de cada vídeo e o nome por baixo. Cada caixa é o marcador
 * dessa pessoa noutra roupa: carregar nela abre o mesmo vídeo, fica
 * cinzenta quando já se viu e leva a caixinha de "voltar" no último que
 * se viu; e quando o rato pára numa caixa acende-se o marcador no mapa,
 * e ao contrário, com o mesmo salto de tamanho. Ao alto, num telemóvel
 * de pé, a coluna não existe: não há largura para ela.
 *
 * A coluna nasce com o cabeçalho e desaparece dentro dos óculos de
 * cartão, como o resto da interface.
 */

const CSS = `
    #videos-ao-lado {
        position: fixed;
        left: 24px;
        top: 88px;
        bottom: 24px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 14px;
        /* A largura da caixa (a janela e a moldura) mais a folga. */
        width: 150px;
        /* Folga para o salto de tamanho ao passar o rato não ficar
           cortado pelas bordas da coluna. */
        padding: 8px 12px;
        margin-left: -12px;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-width: none;
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
    /* A caixa de cada testemunho: a moldura dos menus do site. */
    #videos-ao-lado .video-ao-lado {
        position: relative;
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 6px;
        margin: 0;
        background: linear-gradient(to bottom, rgba(255,255,255,0.05), transparent), #05050a;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 0;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        color: #ffffff;
        font-family: inherit;
        cursor: pointer;
        text-align: center;
        /* O mesmo salto de tamanho dos marcadores do mapa, na caixa toda. */
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
    #videos-ao-lado .video-ao-lado-janela {
        width: 112px;
        height: 63px;
        background: #05050a;
    }
    #videos-ao-lado .video-ao-lado-janela video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity 0.4s ease;
    }
    #videos-ao-lado .video-ao-lado-janela video.pronto {
        opacity: 1;
    }
    /* Já visto: esbate-se em cinzento, como o marcador no mapa. */
    #videos-ao-lado .video-ao-lado.visto .video-ao-lado-janela video {
        filter: grayscale(1);
        opacity: 0.55;
    }
    /* O último que se viu: a mesma caixinha com a seta de "voltar" que
       o marcador leva no mapa, no mesmo canto — tal e qual. */
    #videos-ao-lado .video-ao-lado.ultimo::after {
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
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    /* Num telemóvel deitado há pouca altura: a coluna encosta mais ao
       cabeçalho e pára em cima do manípulo, e as janelas são mais
       pequenas. */
    @media (hover: none) and (pointer: coarse) and (orientation: landscape) {
        #videos-ao-lado {
            left: 16px;
            top: 64px;
            /* Pára em cima do manípulo, que aqui vive no canto de baixo
               à esquerda. */
            bottom: 140px;
            width: 126px;
            gap: 10px;
        }
        #videos-ao-lado .video-ao-lado-janela {
            width: 88px;
            height: 50px;
        }
        #videos-ao-lado .video-ao-lado-nome {
            font-size: 0.7rem;
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
    coluna.setAttribute('data-i18n-aria', 'def.testemunhos');
    coluna.setAttribute('aria-label', 'Testemunhos');

    const entradas = [];
    for (const ann of controlador.annotations) {
        if (ann.is360 || !ann.video) continue;

        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'video-ao-lado';

        const janela = document.createElement('div');
        janela.className = 'video-ao-lado-janela';
        const filme = document.createElement('video');
        filme.muted = true;
        filme.playsInline = true;
        filme.preload = 'metadata';
        filme.setAttribute('aria-hidden', 'true');
        filme.tabIndex = -1;
        const fontes = fontesDeVideo(ann.video);
        const leve = fontes['480p'] || fontes['720p'] || Object.values(fontes)[0];
        if (leve) {
            // O "#t=0.001" pede ao navegador a imagem do primeiro instante,
            // senão a janela ficava preta.
            filme.src = leve + '#t=0.001';
            const pronto = () => filme.classList.add('pronto');
            filme.addEventListener('loadeddata', pronto, { once: true });
        }
        janela.appendChild(filme);

        const nome = document.createElement('div');
        nome.className = 'video-ao-lado-nome';
        nome.textContent = ann.label;

        botao.appendChild(janela);
        botao.appendChild(nome);
        // Carregar aqui é carregar no marcador: o mesmo vídeo, o mesmo
        // "visto".
        botao.addEventListener('click', () => {
            if (ann.element) ann.element.click();
        });
        // O rato em cima da caixa acende o marcador no mapa (a mesma
        // classe com que o comando de jogo o acende), e o rato em cima
        // do marcador acende a caixa.
        botao.addEventListener('mouseenter', () => {
            if (ann.element) ann.element.classList.add('force-hover');
        });
        botao.addEventListener('mouseleave', () => {
            if (ann.element) ann.element.classList.remove('force-hover');
        });
        if (ann.element) {
            ann.element.addEventListener('mouseenter', () => botao.classList.add('realce'));
            ann.element.addEventListener('mouseleave', () => botao.classList.remove('realce'));
        }
        coluna.appendChild(botao);
        entradas.push({ ann, botao });
    }
    if (entradas.length === 0) return;
    document.body.appendChild(coluna);

    /** Os nomes por que se dão a conhecer, na língua do momento. */
    function nomear() {
        for (const { ann, botao } of entradas) {
            const nome = controlador.nomeAcessivel ? controlador.nomeAcessivel(ann) : ann.label;
            botao.setAttribute('aria-label', nome);
            botao.title = nome;
        }
        if (window.Idiomas && window.Idiomas.t) {
            const titulo = window.Idiomas.t('def.testemunhos');
            if (titulo) coluna.setAttribute('aria-label', titulo);
        }
    }
    nomear();
    window.addEventListener('idiomamudou', nomear);

    /** O visto, o último visto e o aceso, copiados dos marcadores do mapa. */
    function copiarOVisto() {
        for (const { ann, botao } of entradas) {
            const ponto = ann.element && ann.element.querySelector('.marker-dot');
            botao.classList.toggle('visto', !!ponto && ponto.classList.contains('viewed'));
            botao.classList.toggle('ultimo', !!ponto && ponto.classList.contains('last-viewed'));
            // O comando de jogo acende o marcador por esta classe; a caixa
            // acende com ele (e apaga-se quando ele se apaga).
            if (ann.element && ann.element.classList.contains('force-hover')) botao.classList.add('realce');
            else if (!botao.matches(':hover')) botao.classList.remove('realce');
        }
    }
    copiarOVisto();
    const recipiente = document.getElementById('annotations-container');
    if (recipiente) {
        new MutationObserver(copiarOVisto).observe(recipiente, {
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    // Nasce com o cabeçalho.
    const cabecalho = document.getElementById('header');
    const acompanhar = () => coluna.classList.toggle('visivel', !!cabecalho && cabecalho.classList.contains('visible'));
    acompanhar();
    if (cabecalho) {
        new MutationObserver(acompanhar).observe(cabecalho, { attributes: true, attributeFilter: ['class'] });
    }
}
