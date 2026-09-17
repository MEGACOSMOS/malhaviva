import { fontesDeVideo } from './videos.mjs?v=7';

/**
 * A coluna de vídeos do lado esquerdo.
 *
 * Quando o ecrã está deitado (mais largo do que alto) sobra espaço à
 * esquerda do bairro, e nele fica uma coluna com os testemunhos: uma
 * janela pequena com o primeiro instante de cada vídeo e o nome por
 * baixo. Carregar numa é o mesmo que carregar no marcador dessa pessoa
 * no mapa — abre o mesmo vídeo, fica marcado como visto da mesma maneira
 * (cinzento, e a caixinha de "voltar" no último que se viu). Ao alto,
 * num telemóvel de pé, a coluna não existe: não há largura para ela.
 *
 * A coluna nasce com o cabeçalho e desaparece dentro dos óculos de
 * cartão, como o resto da interface.
 */

const CSS = `
    #videos-ao-lado {
        position: fixed;
        left: 24px;
        top: 88px;
        /* Pára acima do manípulo, que vive no canto de baixo à esquerda. */
        bottom: 290px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: 112px;
        overflow-y: auto;
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
    body:not(.com-manipulo) #videos-ao-lado {
        bottom: 100px;
    }
    /* Só deitado: ao alto não há largura para uma coluna ao lado. */
    @media (orientation: portrait) {
        #videos-ao-lado { display: none; }
    }
    body.em-cartao #videos-ao-lado {
        display: none;
    }
    #videos-ao-lado .video-ao-lado {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 0;
        margin: 0;
        border: none;
        background: none;
        color: #ffffff;
        font-family: inherit;
        cursor: pointer;
        text-align: center;
    }
    #videos-ao-lado .video-ao-lado:focus {
        outline: none;
    }
    #videos-ao-lado .video-ao-lado:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.95);
        outline-offset: 3px;
    }
    #videos-ao-lado .video-ao-lado-janela {
        position: relative;
        width: 112px;
        height: 63px;
        background: #05050a;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        overflow: hidden;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
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
       o marcador leva no mapa. */
    #videos-ao-lado .video-ao-lado.ultimo .video-ao-lado-janela::after {
        content: "";
        position: absolute;
        top: 0;
        right: 0;
        width: 16px;
        height: 16px;
        background-color: #05050a;
        background-repeat: no-repeat;
        background-position: center;
        background-size: 10px 10px;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3' stroke-linecap='square' stroke-linejoin='miter'><polyline points='9 14 4 9 9 4'/><path d='M4 9h11a5 5 0 0 1 0 10h-3'/></svg>");
    }
    #videos-ao-lado .video-ao-lado-nome {
        font-size: 0.78rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    }
    @media (hover: hover) {
        #videos-ao-lado .video-ao-lado:hover .video-ao-lado-janela {
            transform: scale(1.08);
        }
    }
    /* Num telemóvel deitado há pouca altura: a coluna encosta mais ao
       cabeçalho e pára em cima do manípulo, e as janelas são mais
       pequenas. */
    @media (hover: none) and (pointer: coarse) and (orientation: landscape) {
        #videos-ao-lado,
        body:not(.com-manipulo) #videos-ao-lado {
            left: 16px;
            top: 64px;
            bottom: 140px;
            width: 88px;
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

    /** O visto e o último visto, copiados dos marcadores do mapa. */
    function copiarOVisto() {
        for (const { ann, botao } of entradas) {
            const ponto = ann.element && ann.element.querySelector('.marker-dot');
            botao.classList.toggle('visto', !!ponto && ponto.classList.contains('viewed'));
            botao.classList.toggle('ultimo', !!ponto && ponto.classList.contains('last-viewed'));
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
