/**
 * As línguas do site.
 *
 * Todo o texto que a pessoa lê está aqui, numa lista por língua. As páginas
 * não escrevem texto à mão: marcam cada sítio com `data-i18n="chave"` (para
 * o texto) ou `data-i18n-title="chave"` (para a etiqueta que aparece quando
 * o rato pára em cima), e esta lista é que decide o que lá vai parar.
 *
 * Os nomes das pessoas — Dulce, Luna, Sofia, Frei, Edson, Edmilson, Carlos —
 * e os nomes de sítios como Esvarena ou Olho de Águia nunca são traduzidos:
 * são nomes próprios e ficam como estão em qualquer língua.
 *
 * Isto é um ficheiro comum, e não um módulo, de propósito: assim é lido
 * antes de a página se desenhar e o texto já nasce na língua certa, sem
 * aquele piscar em que se vê primeiro o português.
 */
(function () {
    'use strict';

    // As línguas oferecidas, pela ordem em que aparecem no menu. O nome de
    // cada uma está escrito na própria língua, como é costume.
    var IDIOMAS = [
        { codigo: 'pt', nome: 'Português' },
        { codigo: 'en', nome: 'English' },
        { codigo: 'es', nome: 'Español' },
        { codigo: 'kea', nome: 'Kriolu' }
    ];

    var TEXTOS = {
        pt: {
            'cab.controlos': 'Controlos',
            'cab.definicoes': 'Definições',
            'cab.idioma': 'Idioma',
            'cab.vr': 'Modo VR',
            'cab.ecra': 'Ecrã Inteiro',

            'def.qualidade': 'Qualidade Gráfica',
            'def.auto': 'Automático (Recomendado)',
            'def.alto': 'Alto (Detalhe Máximo)',
            'def.medio': 'Médio (Equilibrado)',
            'def.baixo': 'Baixo (Mais Performance)',
            'def.anotacoes': 'Anotações',
            'def.testemunhos': 'Testemunhos',
            'def.rotas360': 'Rotas 360º',
            'def.cenario': 'Cenário',
            'def.paisagem': 'Paisagem',

            'idm.titulo': 'Idioma',

            'carga.modelo': 'A carregar modelo 3D…',
            'carga.restaurar': 'A restaurar ambiente 3D…',

            'limite.titulo': 'Chegaste ao limite do mapa.',
            'limite.sub': 'Não há terreno para lá desta zona.',
            'limite.botao': 'Recentrar Câmara',

            'video.qualidade': 'Qualidade',
            'video.resolucao': 'Resolução',
            'video.oculos': 'Ver com óculos',

            'foto.titulo': 'Fotografia 360º',
            'foto.carregar': 'A carregar fotografia 360º…',
            'foto.erro': 'Não foi possível carregar a fotografia 360º.',
            'foto.ecra': 'Ecrã inteiro',

            'rota.titulo': 'Rota 360º',
            'proximo.aSeguir': 'A seguir',
            'proximo.agora': 'Ver agora',
            'proximo.ficar': 'Ficar aqui',
            'proximo.fim': 'Já viu todos os testemunhos.',
            'proximo.fechar': 'Fechar',
            'v360.tocar': 'Tocar / Pausar',
            'v360.recuar': 'Recuar 10 segundos',
            'v360.avancar': 'Avançar 10 segundos',
            'v360.recentrar': 'Endireitar a vista',
            'v360.ecra': 'Ecrã inteiro',
            'v360.ajudaTitulo': 'Isto é um vídeo 360º',
            'v360.ajudaOlhar': 'Arraste com o rato para olhar em volta — a imagem dá a volta toda.',
            'v360.ajudaOlharToque': 'Arraste o dedo para olhar em volta — a imagem dá a volta toda.',
            'v360.ajudaPausa': 'Clique na imagem para pausar, ou use a barra em baixo. Espaço, setas, M e F também funcionam.',
            'v360.ajudaPausaToque': 'Toque na imagem para pausar, ou use a barra em baixo.',
            'v360.ajudaOculos': 'Com óculos ligados, o botão dos óculos põe-no lá dentro — e só aí a vista segue o movimento da cabeça.',
            'v360.ajudaEntendi': 'Entendi',

            'ctl.voltar': 'Voltar ao Mapa',
            'ctl.titulo': 'Controlos do Mapa',
            'ctl.sub': 'Guia completo para navegar pela reconstrução 3D do Bairro de Penajóia.',
            'ctl.rato': 'Rato',
            'ctl.teclado': 'Teclado',
            'ctl.toque': 'Ecrã Tátil',
            'ctl.gamepad': 'Gamepad',
            'ctl.interacoes': 'Interações',
            'ctl.dicas': 'Dicas',
            'ctl.arrastarBairro': 'Arrastar o bairro',
            'ctl.rodar': 'Rodar e inclinar',
            'ctl.zoom': 'Aproximar / afastar',
            'ctl.zoomPonto': 'Aproximar num sítio',
            'ctl.esquerdo': 'Esquerdo',
            'ctl.direito': 'Direito',
            'ctl.maisArrastar': '+ arrastar',
            'ctl.ou': 'ou',
            'ctl.scrollNota': 'sobre o ponto que quiseres',
            'ctl.duploClique': 'Duplo clique',
            'ctl.deslocarBairro': 'Deslocar o bairro',
            'ctl.maisSetas': '+ setas',
            'ctl.maisDepressa': 'Deslocar mais depressa',
            'ctl.teclaMovimento': '+ tecla de movimento',
            'ctl.umDedo': '1 dedo',
            'ctl.doisDedos': '2 dedos',
            'ctl.arrastarGesto': 'arrastar',
            'ctl.pinca': 'pinça',
            'ctl.gamepadDesc': 'Liga um comando (Xbox, PlayStation, etc.) para andar pelo mapa sem rato.',
            'ctl.deslocar': 'Deslocar',
            'ctl.stickEsq': 'Stick Esquerdo',
            'ctl.stickDir': 'Stick Direito',
            'ctl.abrirVideo': 'Abrir testemunho em vídeo',
            'ctl.clicar': 'Clicar',
            'ctl.numMarcador': 'num marcador',
            'ctl.fecharVideo': 'Fechar vídeo',
            'ctl.ouClicarFora': 'ou clicar fora',
            'ctl.mudarQualidade': 'Alterar qualidade gráfica',
            'ctl.noCabecalho': 'no cabeçalho',
            'ctl.dicaPerfTitulo': 'Performance:',
            'ctl.dicaPerf': 'Se o visualizador estiver lento num computador antigo, muda a qualidade gráfica para Baixa no ícone ⚙ do cabeçalho. Em mobile, a qualidade é ajustada automaticamente.',
            'ctl.dicaPerdidoTitulo': 'Perdido?',
            'ctl.dicaPerdido': 'Se chegares à borda do mapa aparece um botão para voltar à vista de abertura. A vista nunca sobe acima do horizonte: o bairro fica sempre por baixo, como num mapa.',
            'ctl.descricao': 'Guia dos controlos do visualizador 3D Malha Viva. Navega como num mapa: arrasta com o rato, aproxima com o scroll, roda com Ctrl.'
        },

        en: {
            'cab.controlos': 'Controls',
            'cab.definicoes': 'Settings',
            'cab.idioma': 'Language',
            'cab.vr': 'VR Mode',
            'cab.ecra': 'Fullscreen',

            'def.qualidade': 'Graphics Quality',
            'def.auto': 'Automatic (Recommended)',
            'def.alto': 'High (Maximum Detail)',
            'def.medio': 'Medium (Balanced)',
            'def.baixo': 'Low (Best Performance)',
            'def.anotacoes': 'Markers',
            'def.testemunhos': 'Testimonies',
            'def.rotas360': '360º Routes',
            'def.cenario': 'Scenery',
            'def.paisagem': 'Landscape',

            'idm.titulo': 'Language',

            'carga.modelo': 'Loading 3D model…',
            'carga.restaurar': 'Restoring 3D environment…',

            'limite.titulo': 'You have reached the edge of the map.',
            'limite.sub': 'There is no ground beyond this area.',
            'limite.botao': 'Recentre Camera',

            'video.qualidade': 'Quality',
            'video.resolucao': 'Resolution',
            'video.oculos': 'View with headset',

            'foto.titulo': '360º Photo',
            'foto.carregar': 'Loading 360º photo…',
            'foto.erro': 'The 360º photo could not be loaded.',
            'foto.ecra': 'Fullscreen',

            'rota.titulo': '360º Route',
            'proximo.aSeguir': 'Up next',
            'proximo.agora': 'Watch now',
            'proximo.ficar': 'Stay here',
            'proximo.fim': 'You have watched every testimony.',
            'proximo.fechar': 'Close',
            'v360.tocar': 'Play / Pause',
            'v360.recuar': 'Back 10 seconds',
            'v360.avancar': 'Forward 10 seconds',
            'v360.recentrar': 'Straighten the view',
            'v360.ecra': 'Fullscreen',
            'v360.ajudaTitulo': 'This is a 360º video',
            'v360.ajudaOlhar': 'Drag with the mouse to look around — the image wraps all the way round you.',
            'v360.ajudaOlharToque': 'Drag your finger to look around — the image wraps all the way round you.',
            'v360.ajudaPausa': 'Click the image to pause, or use the bar below. Space, arrows, M and F work too.',
            'v360.ajudaPausaToque': 'Tap the image to pause, or use the bar below.',
            'v360.ajudaOculos': 'With a headset connected, the headset button takes you inside — and only there does the view follow your head.',
            'v360.ajudaEntendi': 'Got it',

            'ctl.voltar': 'Back to Map',
            'ctl.titulo': 'Map Controls',
            'ctl.sub': 'A complete guide to navigating the 3D reconstruction of the Penajóia neighbourhood.',
            'ctl.rato': 'Mouse',
            'ctl.teclado': 'Keyboard',
            'ctl.toque': 'Touchscreen',
            'ctl.gamepad': 'Gamepad',
            'ctl.interacoes': 'Interactions',
            'ctl.dicas': 'Tips',
            'ctl.arrastarBairro': 'Drag the neighbourhood',
            'ctl.rodar': 'Turn and tilt',
            'ctl.zoom': 'Zoom in / out',
            'ctl.zoomPonto': 'Zoom in on a spot',
            'ctl.esquerdo': 'Left',
            'ctl.direito': 'Right',
            'ctl.maisArrastar': '+ drag',
            'ctl.ou': 'or',
            'ctl.scrollNota': 'over whatever you want',
            'ctl.duploClique': 'Double click',
            'ctl.deslocarBairro': 'Move the neighbourhood',
            'ctl.maisSetas': '+ arrow keys',
            'ctl.maisDepressa': 'Move faster',
            'ctl.teclaMovimento': '+ movement key',
            'ctl.umDedo': '1 finger',
            'ctl.doisDedos': '2 fingers',
            'ctl.arrastarGesto': 'drag',
            'ctl.pinca': 'pinch',
            'ctl.gamepadDesc': 'Plug in a controller (Xbox, PlayStation, etc.) to move around the map without a mouse.',
            'ctl.deslocar': 'Move',
            'ctl.stickEsq': 'Left Stick',
            'ctl.stickDir': 'Right Stick',
            'ctl.abrirVideo': 'Open a video testimony',
            'ctl.clicar': 'Click',
            'ctl.numMarcador': 'on a marker',
            'ctl.fecharVideo': 'Close video',
            'ctl.ouClicarFora': 'or click outside',
            'ctl.mudarQualidade': 'Change graphics quality',
            'ctl.noCabecalho': 'in the header',
            'ctl.dicaPerfTitulo': 'Performance:',
            'ctl.dicaPerf': 'If the viewer runs slowly on an older computer, switch the graphics quality to Low using the ⚙ icon in the header. On mobile, the quality is set automatically.',
            'ctl.dicaPerdidoTitulo': 'Lost?',
            'ctl.dicaPerdido': 'If you reach the edge of the map, a button appears to take you back to the opening view. The view never rises above the horizon: the neighbourhood always stays below you, as on a map.',
            'ctl.descricao': 'Guide to the controls of the Malha Viva 3D viewer. Navigate as you would a map: drag with the mouse, zoom with the wheel, turn with Ctrl.'
        },

        es: {
            'cab.controlos': 'Controles',
            'cab.definicoes': 'Ajustes',
            'cab.idioma': 'Idioma',
            'cab.vr': 'Modo RV',
            'cab.ecra': 'Pantalla completa',

            'def.qualidade': 'Calidad Gráfica',
            'def.auto': 'Automático (Recomendado)',
            'def.alto': 'Alto (Detalle Máximo)',
            'def.medio': 'Medio (Equilibrado)',
            'def.baixo': 'Bajo (Más Rendimiento)',
            'def.anotacoes': 'Marcadores',
            'def.testemunhos': 'Testimonios',
            'def.rotas360': 'Rutas 360º',
            'def.cenario': 'Escenario',
            'def.paisagem': 'Paisaje',

            'idm.titulo': 'Idioma',

            'carga.modelo': 'Cargando modelo 3D…',
            'carga.restaurar': 'Restaurando entorno 3D…',

            'limite.titulo': 'Has llegado al límite del mapa.',
            'limite.sub': 'No hay terreno más allá de esta zona.',
            'limite.botao': 'Recentrar Cámara',

            'video.qualidade': 'Calidad',
            'video.resolucao': 'Resolución',
            'video.oculos': 'Ver con gafas',

            'foto.titulo': 'Fotografía 360º',
            'foto.carregar': 'Cargando fotografía 360º…',
            'foto.erro': 'No se ha podido cargar la fotografía 360º.',
            'foto.ecra': 'Pantalla completa',

            'rota.titulo': 'Ruta 360º',
            'proximo.aSeguir': 'A continuación',
            'proximo.agora': 'Ver ahora',
            'proximo.ficar': 'Quedarme aquí',
            'proximo.fim': 'Ya has visto todos los testimonios.',
            'proximo.fechar': 'Cerrar',
            'v360.tocar': 'Reproducir / Pausar',
            'v360.recuar': 'Retroceder 10 segundos',
            'v360.avancar': 'Avanzar 10 segundos',
            'v360.recentrar': 'Enderezar la vista',
            'v360.ecra': 'Pantalla completa',
            'v360.ajudaTitulo': 'Esto es un vídeo 360º',
            'v360.ajudaOlhar': 'Arrastra con el ratón para mirar alrededor: la imagen te rodea por completo.',
            'v360.ajudaOlharToque': 'Arrastra el dedo para mirar alrededor: la imagen te rodea por completo.',
            'v360.ajudaPausa': 'Haz clic en la imagen para pausar, o usa la barra de abajo. Espacio, flechas, M y F también funcionan.',
            'v360.ajudaPausaToque': 'Toca la imagen para pausar, o usa la barra de abajo.',
            'v360.ajudaOculos': 'Con gafas conectadas, el botón de las gafas te mete dentro, y solo ahí la vista sigue el movimiento de la cabeza.',
            'v360.ajudaEntendi': 'Entendido',

            'ctl.voltar': 'Volver al Mapa',
            'ctl.titulo': 'Controles del Mapa',
            'ctl.sub': 'Guía completa para navegar por la reconstrucción 3D del Barrio de Penajóia.',
            'ctl.rato': 'Ratón',
            'ctl.teclado': 'Teclado',
            'ctl.toque': 'Pantalla Táctil',
            'ctl.gamepad': 'Mando',
            'ctl.interacoes': 'Interacciones',
            'ctl.dicas': 'Consejos',
            'ctl.arrastarBairro': 'Arrastrar el barrio',
            'ctl.rodar': 'Girar e inclinar',
            'ctl.zoom': 'Acercar / alejar',
            'ctl.zoomPonto': 'Acercar a un punto',
            'ctl.esquerdo': 'Izquierdo',
            'ctl.direito': 'Derecho',
            'ctl.maisArrastar': '+ arrastrar',
            'ctl.ou': 'o',
            'ctl.scrollNota': 'sobre el punto que quieras',
            'ctl.duploClique': 'Doble clic',
            'ctl.deslocarBairro': 'Desplazar el barrio',
            'ctl.maisSetas': '+ flechas',
            'ctl.maisDepressa': 'Desplazar más rápido',
            'ctl.teclaMovimento': '+ tecla de movimiento',
            'ctl.umDedo': '1 dedo',
            'ctl.doisDedos': '2 dedos',
            'ctl.arrastarGesto': 'arrastrar',
            'ctl.pinca': 'pellizcar',
            'ctl.gamepadDesc': 'Conecta un mando (Xbox, PlayStation, etc.) para moverte por el mapa sin ratón.',
            'ctl.deslocar': 'Desplazar',
            'ctl.stickEsq': 'Stick Izquierdo',
            'ctl.stickDir': 'Stick Derecho',
            'ctl.abrirVideo': 'Abrir testimonio en vídeo',
            'ctl.clicar': 'Hacer clic',
            'ctl.numMarcador': 'en un marcador',
            'ctl.fecharVideo': 'Cerrar vídeo',
            'ctl.ouClicarFora': 'o hacer clic fuera',
            'ctl.mudarQualidade': 'Cambiar la calidad gráfica',
            'ctl.noCabecalho': 'en la cabecera',
            'ctl.dicaPerfTitulo': 'Rendimiento:',
            'ctl.dicaPerf': 'Si el visor va lento en un ordenador antiguo, cambia la calidad gráfica a Baja en el icono ⚙ de la cabecera. En el móvil, la calidad se ajusta automáticamente.',
            'ctl.dicaPerdidoTitulo': '¿Perdido?',
            'ctl.dicaPerdido': 'Si llegas al borde del mapa aparece un botón para volver a la vista inicial. La vista nunca sube por encima del horizonte: el barrio queda siempre por debajo, como en un mapa.',
            'ctl.descricao': 'Guía de los controles del visor 3D Malha Viva. Navega como en un mapa: arrastra con el ratón, acerca con la rueda, gira con Ctrl.'
        },

        kea: {
            'cab.controlos': 'Kontrolus',
            'cab.definicoes': 'Definisons',
            'cab.idioma': 'Lingua',
            'cab.vr': 'Modu VR',
            'cab.ecra': 'Ekran interu',

            'def.qualidade': 'Kualidadi di imajen',
            'def.auto': 'Automátiku (Rekumendadu)',
            'def.alto': 'Altu (Máximu detalhi)',
            'def.medio': 'Médiu (Ekilibradu)',
            'def.baixo': 'Baxu (Más rapidez)',
            'def.anotacoes': 'Markadoris',
            'def.testemunhos': 'Tistimunhus',
            'def.rotas360': 'Rotas 360º',
            'def.cenario': 'Senáriu',
            'def.paisagem': 'Paizajen',

            'idm.titulo': 'Lingua',

            'carga.modelo': 'Ta karega modelu 3D…',
            'carga.restaurar': 'Ta restaura anbienti 3D…',

            'limite.titulo': 'Bu txiga na fin di mapa.',
            'limite.sub': 'Ka ten txon pa la di es zona.',
            'limite.botao': 'Volta pa sentru',

            'video.qualidade': 'Kualidadi',
            'video.resolucao': 'Ruzoluson',
            'video.oculos': 'Odja ku óklus',

            'foto.titulo': 'Fotografia 360º',
            'foto.carregar': 'Ta karega fotografia 360º…',
            'foto.erro': 'Ka konsigi karega fotografia 360º.',
            'foto.ecra': 'Ekran interu',

            'rota.titulo': 'Rota 360º',
            'proximo.aSeguir': 'A sigi',
            'proximo.agora': 'Odja gosi',
            'proximo.ficar': 'Fika li',
            'proximo.fim': 'Bu ja odja tudu tistimunhu.',
            'proximo.fechar': 'Fitxa',
            'v360.tocar': 'Toka / Para',
            'v360.recuar': 'Volta 10 sigundu',
            'v360.avancar': 'Bai 10 sigundu',
            'v360.recentrar': 'Indreta vista',
            'v360.ecra': 'Ekran interu',
            'v360.ajudaTitulo': 'Es e un vídiu 360º',
            'v360.ajudaOlhar': 'Rasta ku ratu pa odja na roda — imajen ta da volta interu.',
            'v360.ajudaOlharToque': 'Rasta ku dedu pa odja na roda — imajen ta da volta interu.',
            'v360.ajudaPausa': 'Klika na imajen pa para, ô uza barra la baxu. Spasu, setas, M i F ta funsiona tanbe.',
            'v360.ajudaPausaToque': 'Toka na imajen pa para, ô uza barra la baxu.',
            'v360.ajudaOculos': 'Ku óklus ligadu, buton di óklus ta pô-u la dentu — i so la ki vista ta sigi movimentu di kabesa.',
            'v360.ajudaEntendi': 'N intendi',

            'ctl.voltar': 'Volta pa Mapa',
            'ctl.titulo': 'Kontrolus di Mapa',
            'ctl.sub': 'Gia kompletu pa navega na rekonstruson 3D di Bairu di Penajóia.',
            'ctl.rato': 'Ratu',
            'ctl.teclado': 'Tekladu',
            'ctl.toque': 'Ekran tátil',
            'ctl.gamepad': 'Komandu',
            'ctl.interacoes': 'Interasons',
            'ctl.dicas': 'Dikas',
            'ctl.arrastarBairro': 'Rasta bairu',
            'ctl.rodar': 'Roda i inklina',
            'ctl.zoom': 'Xiga pertu / lonji',
            'ctl.zoomPonto': 'Xiga pertu di un lugar',
            'ctl.esquerdo': 'Skerdu',
            'ctl.direito': 'Direitu',
            'ctl.maisArrastar': '+ rasta',
            'ctl.ou': 'ô',
            'ctl.scrollNota': 'riba di pontu ki bu kre',
            'ctl.duploClique': 'Duplu kliki',
            'ctl.deslocarBairro': 'Move bairu',
            'ctl.maisSetas': '+ setas',
            'ctl.maisDepressa': 'Move más rápidu',
            'ctl.teclaMovimento': '+ tekla di movimentu',
            'ctl.umDedo': '1 dedu',
            'ctl.doisDedos': '2 dedu',
            'ctl.arrastarGesto': 'rasta',
            'ctl.pinca': 'pinsa',
            'ctl.gamepadDesc': 'Liga un komandu (Xbox, PlayStation, etc.) pa anda na mapa sen ratu.',
            'ctl.deslocar': 'Move',
            'ctl.stickEsq': 'Stick Skerdu',
            'ctl.stickDir': 'Stick Direitu',
            'ctl.abrirVideo': 'Abri tistimunhu na vídiu',
            'ctl.clicar': 'Klika',
            'ctl.numMarcador': 'na un markador',
            'ctl.fecharVideo': 'Fitxa vídiu',
            'ctl.ouClicarFora': 'ô klika pa fora',
            'ctl.mudarQualidade': 'Muda kualidadi di imajen',
            'ctl.noCabecalho': 'na kabesa di pájina',
            'ctl.dicaPerfTitulo': 'Rapidez:',
            'ctl.dicaPerf': 'Si vizualizador sta lentu na un komputador bedju, muda kualidadi di imajen pa Baxu na íkoni ⚙ na kabesa di pájina. Na telemóvel, kualidadi ta ajusta si própi.',
            'ctl.dicaPerdidoTitulo': 'Bu perde?',
            'ctl.dicaPerdido': 'Si bu txiga na borda di mapa, un buton ta parse pa volta pa vista di kumesu. Vista nunka ta subi riba di orizonti: bairu ta fika senpri di baxu, sima na un mapa.',
            'ctl.descricao': 'Gia di kontrolus di vizualizador 3D Malha Viva. Navega sima na un mapa: rasta ku ratu, xiga pertu ku roda, roda ku Ctrl.'
        }
    };

    var GUARDADO = 'idioma';
    var atual = 'pt';

    /**
     * Qual a língua a usar quando ainda ninguém escolheu: a do navegador,
     * se for uma das nossas; senão, português.
     *
     * @returns {string} O código da língua.
     */
    function adivinhar() {
        var lista = (navigator.languages || [navigator.language || 'pt']);
        for (var i = 0; i < lista.length; i++) {
            var codigo = String(lista[i] || '').toLowerCase();
            if (codigo.indexOf('pt') === 0) return 'pt';
            if (codigo.indexOf('en') === 0) return 'en';
            if (codigo.indexOf('es') === 0) return 'es';
            if (codigo.indexOf('kea') === 0 || codigo.indexOf('cv') > -1) return 'kea';
        }
        return 'pt';
    }

    try {
        var escolhido = localStorage.getItem(GUARDADO);
        atual = TEXTOS[escolhido] ? escolhido : adivinhar();
    } catch (e) {
        atual = 'pt';
    }

    /**
     * O texto de uma chave na língua em vigor. Sem tradução feita, devolve
     * o português — mais vale uma palavra a mais em português do que um
     * espaço vazio.
     *
     * @param {string} chave - O nome do texto.
     * @returns {string} O texto a mostrar.
     */
    function t(chave) {
        var tabela = TEXTOS[atual] || TEXTOS.pt;
        if (typeof tabela[chave] === 'string') return tabela[chave];
        if (typeof TEXTOS.pt[chave] === 'string') return TEXTOS.pt[chave];
        return '';
    }

    /**
     * Escreve na página, ou num pedaço dela, todos os textos marcados.
     *
     * @param {Element|Document} [raiz] - Onde procurar. A página toda, se
     * não se disser nada.
     */
    function aplicar(raiz) {
        var onde = raiz || document;
        if (!onde.querySelectorAll) return;

        onde.querySelectorAll('[data-i18n]').forEach(function (el) {
            var texto = t(el.getAttribute('data-i18n'));
            if (texto) el.textContent = texto;
        });
        onde.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            var texto = t(el.getAttribute('data-i18n-title'));
            if (texto) el.setAttribute('title', texto);
        });
        onde.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
            var texto = t(el.getAttribute('data-i18n-aria'));
            if (texto) el.setAttribute('aria-label', texto);
        });

        if (onde === document) {
            document.documentElement.setAttribute('lang', atual === 'kea' ? 'kea' : atual);
        }
    }

    /**
     * Passa o site para outra língua. O texto muda logo, sem recarregar.
     *
     * @param {string} codigo - O código da língua.
     */
    function definir(codigo) {
        if (!TEXTOS[codigo] || codigo === atual) return;
        atual = codigo;
        try { localStorage.setItem(GUARDADO, codigo); } catch (e) { /* sem memória, paciência */ }
        aplicar(document);
        window.dispatchEvent(new CustomEvent('idiomamudou', { detail: { idioma: codigo } }));
    }

    window.Idiomas = {
        IDIOMAS: IDIOMAS,
        atual: function () { return atual; },
        t: t,
        aplicar: aplicar,
        definir: definir
    };

    // A página é traduzida assim que estiver montada, e outra vez se algum
    // pedaço nascer depois (é a própria página que volta a chamar).
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { aplicar(document); });
    } else {
        aplicar(document);
    }
})();
