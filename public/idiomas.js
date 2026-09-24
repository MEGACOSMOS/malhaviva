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
            'cab.cartao': 'Óculos de cartão',
            'cab.sairCartao': 'Sair dos óculos',
            'cab.ecra': 'Ecrã Inteiro',

            'def.qualidade': 'Qualidade Gráfica',
            'def.auto': 'Automático (Recomendado)',
            'def.alto': 'Alto (Detalhe Máximo)',
            'def.medio': 'Médio (Equilibrado)',
            'def.baixo': 'Baixo (Mais Performance)',
            'def.anotacoes': 'Anotações',
            'def.testemunhos': 'Testemunhos',
            'def.rotas360': 'Rotas 360º',
            'def.interface': 'Interface',
            'def.paisagem': 'Paisagem',
            'leg.titulo': 'Legenda do mapa',

            'ins.titulo': 'Como navegar',
            'ins.fechar': 'Fechar as instruções',
            'ins.passo': 'Passo {n} de {total}',
            'ins.rever': 'Rever as instruções',
            'ins.irTitulo': 'Ir até um sítio',
            'ins.irRato': 'Clica num sítio do bairro e a câmara leva-te até lá.',
            'ins.irToque': 'Toca num sítio do bairro e a câmara leva-te até lá.',
            'ins.olharTitulo': 'Olhar à volta',
            'ins.olharRato': 'Arrasta com o rato para rodar a vista.',
            'ins.olharToque': 'Arrasta com um dedo para rodar a vista.',
            'ins.zoomTitulo': 'Aproximar e afastar',
            'ins.zoomRato': 'Usa a roda do rato.',
            'ins.zoomToque': 'Afasta ou junta dois dedos.',
            'ins.tecladoTitulo': 'Andar com o teclado',
            'ins.teclado': 'As teclas W A S D ou as setas levam-te pelo bairro.',
            'ins.historiasTitulo': 'Ver as histórias',
            'ins.historias': 'Os marcadores abrem os testemunhos e as rotas 360º.',

            'idm.titulo': 'Idioma',
            'mapa.testemunhoDe': 'Testemunho de {nome}',
            'mapa.fotografia360': 'fotografia 360º',

            'carga.modelo': 'A carregar modelo 3D…',
            'carga.restaurar': 'A restaurar ambiente 3D…',
            'gpu.aTentar': 'O aparelho ficou sem memória gráfica. A tentar de novo com menos detalhe…',
            'gpu.desistiu': 'Este aparelho não consegue mostrar o bairro em 3D.',
            'gpu.botao': 'Tentar de novo',
            'arranque.demora': 'Está a demorar mais do que o costume.',
            'arranque.bairro': 'O bairro está a demorar a chegar.',
            'arranque.sub': 'Pode ser a ligação à internet. Se continuar assim, tenta de novo.',

            'limite.titulo': 'Chegaste ao limite do mapa.',
            'limite.sub': 'Não há terreno para lá desta zona.',
            'limite.botao': 'Recentrar Câmara',

            'cab.menu': 'Menu',

            'par.botao': 'Partilhar',
            'par.titulo': 'Partilhar',
            'par.texto': 'Explora o Bairro de Penajóia em 3D — Malha Viva',
            'par.email': 'E-mail',
            'par.copiar': 'Copiar ligação',
            'par.copiado': 'Ligação copiada',
            'par.mais': 'Mais opções…',
            'par.fechar': 'Fechar',

            'video.qualidade': 'Qualidade',
            'video.resolucao': 'Resolução',
            'video.oculos': 'Ver com óculos',

            'foto.titulo': 'Fotografia 360º',
            'foto.carregar': 'A carregar fotografia 360º…',
            'foto.erro': 'Não foi possível carregar a fotografia 360º.',
            'visor.erro': 'Não foi possível abrir o visor 360º.',
            'video.erro': 'Não foi possível carregar o vídeo.',
            'foto.ecra': 'Ecrã inteiro',
            'foto.aproximar': 'Aproximar',
            'foto.afastar': 'Afastar',

            'rota.titulo': 'Rota 360º',
            'palco.anterior': 'Anterior',
            'palco.seguinte': 'Seguinte',
            'palco.sair': 'Sair',
            'v360.tocar': 'Tocar / Pausar',
            'v360.recuar': 'Recuar 5 segundos',
            'v360.avancar': 'Avançar 5 segundos',
            'v360.recentrar': 'Endireitar a vista',
            'v360.ecra': 'Ecrã inteiro',
            'v360.ajudaTitulo': 'Isto é um vídeo 360º',
            'v360.ajudaOlhar': 'Arraste com o rato para olhar em volta — a imagem dá a volta toda. As teclas W, A, S e D fazem o mesmo.',
            'v360.ajudaOlharToque': 'Arraste o dedo para olhar em volta — a imagem dá a volta toda.',
            'v360.ajudaPausa': 'Clique na imagem para pausar, ou use a barra em baixo. Espaço, setas, M e F também funcionam.',
            'v360.ajudaPausaToque': 'Toque na imagem para pausar, ou use a barra em baixo.',
            'v360.ajudaOculos': 'Com óculos ligados, o botão dos óculos põe-no lá dentro — e só aí a vista segue o movimento da cabeça.',
            'v360.ajudaEntendi': 'Entendi',

            'ctl.voltar': 'Voltar ao Mapa',
            'ctl.verMais': 'Mostrar mais',
            'ctl.verMenos': 'Mostrar menos',
            'ctl.titulo': 'Controlos do Mapa',
            'ctl.sub': 'Guia completo para navegar pela reconstrução 3D do Bairro de Penajóia.',
            'ctl.rato': 'Rato',
            'ctl.teclado': 'Teclado',
            'ctl.tecladoDesc': 'Dá para tudo sem rato. No bairro as setas andam, como o WASD; com o Alt em baixo passam a olhar à volta. Nas paragens 360º o WASD vira a cabeça. Com uma janela aberta, as setas dos lados passam ao testemunho ou à paragem do lado, como as setas desenhadas de cada lado dela.',
            'ctl.tecAltSetas': 'Alt + setas',
            'ctl.tecEspaco': 'Espaço',
            'ctl.tecEndireitar': 'Endireitar a vista',
            'ctl.tecIrA': 'Ir a um ponto do filme',
            'ctl.tecInicioFim': 'Início / fim do filme',
            'ctl.toque': 'Ecrã Tátil',
            'ctl.gamepad': 'Comando',
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
            'ctl.olhar': 'Olhar à volta',
            'ctl.zoomVista': 'Aproximar visão (Zoom)',
            'ctl.avancarRecuar': 'Avançar / Recuar',
            'ctl.lateralmente': 'Mover lateralmente',
            'ctl.movimentoRapido': 'Movimento rápido',
            'ctl.movimentoLento': 'Movimento lento',
            'ctl.rodarCamara': 'Rodar a câmara',
            'ctl.panDoisDedos': 'Mover lateralmente (Pan)',
            'ctl.gamepadDesc': 'Liga um comando (Xbox, PlayStation, etc.) e carrega num botão qualquer para o acordar. Daqui em diante dá para tudo: andar pelo bairro, abrir os testemunhos, mexer nos menus e mandar no vídeo, sem tocar no rato.',
            'ctl.deslocar': 'Deslocar',
            'ctl.stickEsq': 'Stick Esquerdo',
            'ctl.stickDir': 'Stick Direito',
            'ctl.gpNomes': 'Os nomes dos botões são os da Xbox. Num comando da PlayStation, A é o X, B é o círculo, X é o quadrado, Y é o triângulo, Start é Options e Select é Share.',
            'ctl.gpNoBairro': 'No bairro',
            'ctl.gpNosMenus': 'Nos menus',
            'ctl.gpNoVideo': 'Na janela do vídeo',
            'ctl.gpNas360': 'Nas paragens 360º',
            'ctl.gpCruzLados': 'Cruz ← →',
            'ctl.gpCruzCima': 'Cruz ↑ ↓',
            'ctl.gpDepressa': 'Andar depressa',
            'ctl.gpDevagar': 'Andar devagar',
            'ctl.gpEscolher': 'Escolher um marcador',
            'ctl.gpAbrir': 'Abrir o marcador',
            'ctl.gpLargar': 'Largar a escolha',
            'ctl.gpRecentrar': 'Recentrar, no aviso de limite',
            'ctl.gpEcra': 'Ecrã inteiro',
            'ctl.gpDefinicoes': 'Abrir as definições',
            'ctl.gpIdioma': 'Abrir o idioma',
            'ctl.gpSubirDescer': 'Subir e descer',
            'ctl.gpCursor': 'Mexer num cursor',
            'ctl.gpConfirmar': 'Escolher',
            'ctl.gpFechar': 'Fechar',
            'ctl.gpTocar': 'Tocar / pausar',
            'ctl.gpSaltar': 'Saltar 5 segundos',
            'ctl.gpVolume': 'Volume',
            'ctl.gpSilenciar': 'Silenciar',
            'ctl.gpAnteriorSeguinte': 'Testemunho anterior / seguinte',
            'ctl.gpVirar': 'Virar a cabeça',
            'ctl.gpParagem': 'Paragem anterior / seguinte',
            'ctl.abrirVideo': 'Abrir testemunho em vídeo',
            'ctl.clicar': 'Clicar',
            'ctl.numMarcador': 'num marcador',
            'ctl.irAte': 'Ir até um sítio',
            'ctl.noSitio': 'num sítio do bairro',
            'ctl.tocar': 'Tocar',
            'ctl.fecharVideo': 'Fechar vídeo',
            'ctl.ouClicarFora': 'ou clicar fora',
            'ctl.mudarQualidade': 'Alterar qualidade gráfica',
            'ctl.noCabecalho': 'no cabeçalho',
            'ctl.dicaPerfTitulo': 'Performance:',
            'ctl.dicaPerf': 'Se o visualizador estiver lento num computador antigo, muda a qualidade gráfica para Baixa no ícone ⚙ do cabeçalho. Em mobile, a qualidade é ajustada automaticamente.',
            'ctl.dicaPerdidoTitulo': 'Perdido?',
            'ctl.dicaPerdido': 'Se a câmara atingir o limite da simulação, aparecerá um botão para recentrar automaticamente.',
            'ctl.descricao': 'Guia completo dos controlos do visualizador 3D Malha Viva. Aprende a navegar com rato, teclado, toque e comando.'
        },

        en: {
            'cab.controlos': 'Controls',
            'cab.definicoes': 'Settings',
            'cab.idioma': 'Language',
            'cab.vr': 'VR Mode',
            'cab.cartao': 'Cardboard headset',
            'cab.sairCartao': 'Leave the headset',
            'cab.ecra': 'Fullscreen',

            'def.qualidade': 'Graphics Quality',
            'def.auto': 'Automatic (Recommended)',
            'def.alto': 'High (Maximum Detail)',
            'def.medio': 'Medium (Balanced)',
            'def.baixo': 'Low (Best Performance)',
            'def.anotacoes': 'Markers',
            'def.testemunhos': 'Testimonies',
            'def.rotas360': '360º Routes',
            'def.interface': 'Interface',
            'def.paisagem': 'Landscape',
            'leg.titulo': 'Map legend',

            'ins.titulo': 'How to get around',
            'ins.fechar': 'Close the instructions',
            'ins.passo': 'Step {n} of {total}',
            'ins.rever': 'See the instructions again',
            'ins.irTitulo': 'Go to a place',
            'ins.irRato': 'Click a spot in the neighbourhood and the camera takes you there.',
            'ins.irToque': 'Tap a spot in the neighbourhood and the camera takes you there.',
            'ins.olharTitulo': 'Look around',
            'ins.olharRato': 'Drag with the mouse to turn the view.',
            'ins.olharToque': 'Drag with one finger to turn the view.',
            'ins.zoomTitulo': 'Zoom in and out',
            'ins.zoomRato': 'Use the mouse wheel.',
            'ins.zoomToque': 'Spread or pinch two fingers.',
            'ins.tecladoTitulo': 'Walk with the keyboard',
            'ins.teclado': 'The W A S D keys or the arrows take you around the neighbourhood.',
            'ins.historiasTitulo': 'See the stories',
            'ins.historias': 'The markers open the testimonies and the 360º routes.',

            'idm.titulo': 'Language',
            'mapa.testemunhoDe': 'Testimony from {nome}',
            'mapa.fotografia360': '360º photograph',

            'carga.modelo': 'Loading 3D model…',
            'carga.restaurar': 'Restoring 3D environment…',
            'gpu.aTentar': 'The device ran out of graphics memory. Trying again with less detail…',
            'gpu.desistiu': 'This device cannot display the neighbourhood in 3D.',
            'gpu.botao': 'Try again',
            'arranque.demora': 'This is taking longer than usual.',
            'arranque.bairro': 'The neighbourhood is taking a while to arrive.',
            'arranque.sub': 'It may be the internet connection. If it stays like this, try again.',

            'limite.titulo': 'You have reached the edge of the map.',
            'limite.sub': 'There is no ground beyond this area.',
            'limite.botao': 'Recentre Camera',

            'cab.menu': 'Menu',

            'par.botao': 'Share',
            'par.titulo': 'Share',
            'par.texto': 'Explore the Penajóia neighbourhood in 3D — Malha Viva',
            'par.email': 'E-mail',
            'par.copiar': 'Copy link',
            'par.copiado': 'Link copied',
            'par.mais': 'More options…',
            'par.fechar': 'Close',

            'video.qualidade': 'Quality',
            'video.resolucao': 'Resolution',
            'video.oculos': 'View with headset',

            'foto.titulo': '360º Photo',
            'foto.carregar': 'Loading 360º photo…',
            'foto.erro': 'The 360º photo could not be loaded.',
            'visor.erro': 'The 360º viewer could not be opened.',
            'video.erro': 'The video could not be loaded.',
            'foto.ecra': 'Fullscreen',
            'foto.aproximar': 'Zoom in',
            'foto.afastar': 'Zoom out',

            'rota.titulo': '360º Route',
            'palco.anterior': 'Previous',
            'palco.seguinte': 'Next',
            'palco.sair': 'Leave',
            'v360.tocar': 'Play / Pause',
            'v360.recuar': 'Back 5 seconds',
            'v360.avancar': 'Forward 5 seconds',
            'v360.recentrar': 'Straighten the view',
            'v360.ecra': 'Fullscreen',
            'v360.ajudaTitulo': 'This is a 360º video',
            'v360.ajudaOlhar': 'Drag with the mouse to look around — the image wraps all the way round you. The W, A, S and D keys do the same.',
            'v360.ajudaOlharToque': 'Drag your finger to look around — the image wraps all the way round you.',
            'v360.ajudaPausa': 'Click the image to pause, or use the bar below. Space, arrows, M and F work too.',
            'v360.ajudaPausaToque': 'Tap the image to pause, or use the bar below.',
            'v360.ajudaOculos': 'With a headset connected, the headset button takes you inside — and only there does the view follow your head.',
            'v360.ajudaEntendi': 'Got it',

            'ctl.voltar': 'Back to Map',
            'ctl.verMais': 'Show more',
            'ctl.verMenos': 'Show less',
            'ctl.titulo': 'Map Controls',
            'ctl.sub': 'A complete guide to navigating the 3D reconstruction of the Penajóia neighbourhood.',
            'ctl.rato': 'Mouse',
            'ctl.teclado': 'Keyboard',
            'ctl.tecladoDesc': 'Everything works without a mouse. In the neighbourhood the arrows move, like WASD; hold Alt and they look around instead. In the 360º stops, WASD turns your head. With a window open, the side arrows move to the testimony or stop beside it, like the arrows drawn on either side of it.',
            'ctl.tecAltSetas': 'Alt + arrows',
            'ctl.tecEspaco': 'Space',
            'ctl.tecEndireitar': 'Straighten the view',
            'ctl.tecIrA': 'Jump to a point in the film',
            'ctl.tecInicioFim': 'Start / end of the film',
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
            'ctl.olhar': 'Look around',
            'ctl.zoomVista': 'Zoom the view',
            'ctl.avancarRecuar': 'Forward / Back',
            'ctl.lateralmente': 'Move sideways',
            'ctl.movimentoRapido': 'Fast movement',
            'ctl.movimentoLento': 'Slow movement',
            'ctl.rodarCamara': 'Turn the camera',
            'ctl.panDoisDedos': 'Move sideways (Pan)',
            'ctl.gamepadDesc': 'Plug in a controller (Xbox, PlayStation, etc.) and press any button to wake it. From there it does everything: walking the neighbourhood, opening the testimonies, working the menus and running the video, without touching the mouse.',
            'ctl.deslocar': 'Move',
            'ctl.stickEsq': 'Left Stick',
            'ctl.stickDir': 'Right Stick',
            'ctl.gpNomes': 'The button names are the Xbox ones. On a PlayStation controller, A is Cross, B is Circle, X is Square, Y is Triangle, Start is Options and Select is Share.',
            'ctl.gpNoBairro': 'In the neighbourhood',
            'ctl.gpNosMenus': 'In the menus',
            'ctl.gpNoVideo': 'In the video window',
            'ctl.gpNas360': 'In the 360º stops',
            'ctl.gpCruzLados': 'D-pad ← →',
            'ctl.gpCruzCima': 'D-pad ↑ ↓',
            'ctl.gpDepressa': 'Move fast',
            'ctl.gpDevagar': 'Move slowly',
            'ctl.gpEscolher': 'Pick a marker',
            'ctl.gpAbrir': 'Open the marker',
            'ctl.gpLargar': 'Drop the selection',
            'ctl.gpRecentrar': 'Recentre, on the edge warning',
            'ctl.gpEcra': 'Fullscreen',
            'ctl.gpDefinicoes': 'Open settings',
            'ctl.gpIdioma': 'Open language',
            'ctl.gpSubirDescer': 'Move up and down',
            'ctl.gpCursor': 'Move a slider',
            'ctl.gpConfirmar': 'Choose',
            'ctl.gpFechar': 'Close',
            'ctl.gpTocar': 'Play / pause',
            'ctl.gpSaltar': 'Skip 5 seconds',
            'ctl.gpVolume': 'Volume',
            'ctl.gpSilenciar': 'Mute',
            'ctl.gpAnteriorSeguinte': 'Previous / next testimony',
            'ctl.gpVirar': 'Turn your head',
            'ctl.gpParagem': 'Previous / next stop',
            'ctl.abrirVideo': 'Open a video testimony',
            'ctl.clicar': 'Click',
            'ctl.numMarcador': 'on a marker',
            'ctl.irAte': 'Go to a place',
            'ctl.noSitio': 'on a spot in the neighbourhood',
            'ctl.tocar': 'Tap',
            'ctl.fecharVideo': 'Close video',
            'ctl.ouClicarFora': 'or click outside',
            'ctl.mudarQualidade': 'Change graphics quality',
            'ctl.noCabecalho': 'in the header',
            'ctl.dicaPerfTitulo': 'Performance:',
            'ctl.dicaPerf': 'If the viewer runs slowly on an older computer, switch the graphics quality to Low using the ⚙ icon in the header. On mobile, the quality is set automatically.',
            'ctl.dicaPerdidoTitulo': 'Lost?',
            'ctl.dicaPerdido': 'If the camera reaches the edge of the simulation, a button appears to recentre it automatically.',
            'ctl.descricao': 'Complete guide to the controls of the Malha Viva 3D viewer. Learn to navigate with mouse, keyboard, touch and gamepad.'
        },

        es: {
            'cab.controlos': 'Controles',
            'cab.definicoes': 'Ajustes',
            'cab.idioma': 'Idioma',
            'cab.vr': 'Modo RV',
            'cab.cartao': 'Gafas de cartón',
            'cab.sairCartao': 'Salir de las gafas',
            'cab.ecra': 'Pantalla completa',

            'def.qualidade': 'Calidad Gráfica',
            'def.auto': 'Automático (Recomendado)',
            'def.alto': 'Alto (Detalle Máximo)',
            'def.medio': 'Medio (Equilibrado)',
            'def.baixo': 'Bajo (Más Rendimiento)',
            'def.anotacoes': 'Marcadores',
            'def.testemunhos': 'Testimonios',
            'def.rotas360': 'Rutas 360º',
            'def.interface': 'Interfaz',
            'def.paisagem': 'Paisaje',
            'leg.titulo': 'Leyenda del mapa',

            'ins.titulo': 'Cómo navegar',
            'ins.fechar': 'Cerrar las instrucciones',
            'ins.passo': 'Paso {n} de {total}',
            'ins.rever': 'Volver a ver las instrucciones',
            'ins.irTitulo': 'Ir a un sitio',
            'ins.irRato': 'Haz clic en un punto del barrio y la cámara te lleva hasta allí.',
            'ins.irToque': 'Toca un punto del barrio y la cámara te lleva hasta allí.',
            'ins.olharTitulo': 'Mirar alrededor',
            'ins.olharRato': 'Arrastra con el ratón para girar la vista.',
            'ins.olharToque': 'Arrastra con un dedo para girar la vista.',
            'ins.zoomTitulo': 'Acercar y alejar',
            'ins.zoomRato': 'Usa la rueda del ratón.',
            'ins.zoomToque': 'Separa o junta dos dedos.',
            'ins.tecladoTitulo': 'Andar con el teclado',
            'ins.teclado': 'Las teclas W A S D o las flechas te llevan por el barrio.',
            'ins.historiasTitulo': 'Ver las historias',
            'ins.historias': 'Los marcadores abren los testimonios y las rutas 360º.',

            'idm.titulo': 'Idioma',
            'mapa.testemunhoDe': 'Testimonio de {nome}',
            'mapa.fotografia360': 'fotografía 360º',

            'carga.modelo': 'Cargando modelo 3D…',
            'carga.restaurar': 'Restaurando entorno 3D…',
            'gpu.aTentar': 'El dispositivo se quedó sin memoria gráfica. Intentando de nuevo con menos detalle…',
            'gpu.desistiu': 'Este dispositivo no puede mostrar el barrio en 3D.',
            'gpu.botao': 'Intentar de nuevo',
            'arranque.demora': 'Está tardando más de lo habitual.',
            'arranque.bairro': 'El barrio está tardando en llegar.',
            'arranque.sub': 'Puede ser la conexión a internet. Si sigue así, inténtalo de nuevo.',

            'limite.titulo': 'Has llegado al límite del mapa.',
            'limite.sub': 'No hay terreno más allá de esta zona.',
            'limite.botao': 'Recentrar Cámara',

            'cab.menu': 'Menú',

            'par.botao': 'Compartir',
            'par.titulo': 'Compartir',
            'par.texto': 'Explora el barrio de Penajóia en 3D — Malha Viva',
            'par.email': 'Correo',
            'par.copiar': 'Copiar enlace',
            'par.copiado': 'Enlace copiado',
            'par.mais': 'Más opciones…',
            'par.fechar': 'Cerrar',

            'video.qualidade': 'Calidad',
            'video.resolucao': 'Resolución',
            'video.oculos': 'Ver con gafas',

            'foto.titulo': 'Fotografía 360º',
            'foto.carregar': 'Cargando fotografía 360º…',
            'foto.erro': 'No se ha podido cargar la fotografía 360º.',
            'visor.erro': 'No se ha podido abrir el visor 360º.',
            'video.erro': 'No se ha podido cargar el vídeo.',
            'foto.ecra': 'Pantalla completa',
            'foto.aproximar': 'Acercar',
            'foto.afastar': 'Alejar',

            'rota.titulo': 'Ruta 360º',
            'palco.anterior': 'Anterior',
            'palco.seguinte': 'Siguiente',
            'palco.sair': 'Salir',
            'v360.tocar': 'Reproducir / Pausar',
            'v360.recuar': 'Retroceder 5 segundos',
            'v360.avancar': 'Avanzar 5 segundos',
            'v360.recentrar': 'Enderezar la vista',
            'v360.ecra': 'Pantalla completa',
            'v360.ajudaTitulo': 'Esto es un vídeo 360º',
            'v360.ajudaOlhar': 'Arrastra con el ratón para mirar alrededor: la imagen te rodea por completo. Las teclas W, A, S y D hacen lo mismo.',
            'v360.ajudaOlharToque': 'Arrastra el dedo para mirar alrededor: la imagen te rodea por completo.',
            'v360.ajudaPausa': 'Haz clic en la imagen para pausar, o usa la barra de abajo. Espacio, flechas, M y F también funcionan.',
            'v360.ajudaPausaToque': 'Toca la imagen para pausar, o usa la barra de abajo.',
            'v360.ajudaOculos': 'Con gafas conectadas, el botón de las gafas te mete dentro, y solo ahí la vista sigue el movimiento de la cabeza.',
            'v360.ajudaEntendi': 'Entendido',

            'ctl.voltar': 'Volver al Mapa',
            'ctl.verMais': 'Mostrar más',
            'ctl.verMenos': 'Mostrar menos',
            'ctl.titulo': 'Controles del Mapa',
            'ctl.sub': 'Guía completa para navegar por la reconstrucción 3D del Barrio de Penajóia.',
            'ctl.rato': 'Ratón',
            'ctl.teclado': 'Teclado',
            'ctl.tecladoDesc': 'Sirve para todo sin ratón. En el barrio las flechas se mueven, como WASD; con Alt pulsado pasan a mirar alrededor. En las paradas 360º, WASD gira la cabeza. Con una ventana abierta, las flechas laterales pasan al testimonio o a la parada de al lado, como las flechas dibujadas a cada lado.',
            'ctl.tecAltSetas': 'Alt + flechas',
            'ctl.tecEspaco': 'Espacio',
            'ctl.tecEndireitar': 'Enderezar la vista',
            'ctl.tecIrA': 'Ir a un punto de la película',
            'ctl.tecInicioFim': 'Inicio / fin de la película',
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
            'ctl.olhar': 'Mirar alrededor',
            'ctl.zoomVista': 'Acercar la vista (Zoom)',
            'ctl.avancarRecuar': 'Avanzar / Retroceder',
            'ctl.lateralmente': 'Moverse lateralmente',
            'ctl.movimentoRapido': 'Movimiento rápido',
            'ctl.movimentoLento': 'Movimiento lento',
            'ctl.rodarCamara': 'Girar la cámara',
            'ctl.panDoisDedos': 'Moverse lateralmente (Pan)',
            'ctl.gamepadDesc': 'Conecta un mando (Xbox, PlayStation, etc.) y pulsa cualquier botón para despertarlo. A partir de ahí sirve para todo: recorrer el barrio, abrir los testimonios, moverte por los menús y manejar el vídeo, sin tocar el ratón.',
            'ctl.deslocar': 'Desplazar',
            'ctl.stickEsq': 'Stick Izquierdo',
            'ctl.stickDir': 'Stick Derecho',
            'ctl.gpNomes': 'Los nombres de los botones son los de Xbox. En un mando de PlayStation, A es la X, B es el círculo, X es el cuadrado, Y es el triángulo, Start es Options y Select es Share.',
            'ctl.gpNoBairro': 'En el barrio',
            'ctl.gpNosMenus': 'En los menús',
            'ctl.gpNoVideo': 'En la ventana del vídeo',
            'ctl.gpNas360': 'En las paradas 360º',
            'ctl.gpCruzLados': 'Cruceta ← →',
            'ctl.gpCruzCima': 'Cruceta ↑ ↓',
            'ctl.gpDepressa': 'Moverse deprisa',
            'ctl.gpDevagar': 'Moverse despacio',
            'ctl.gpEscolher': 'Elegir un marcador',
            'ctl.gpAbrir': 'Abrir el marcador',
            'ctl.gpLargar': 'Soltar la selección',
            'ctl.gpRecentrar': 'Recentrar, en el aviso de límite',
            'ctl.gpEcra': 'Pantalla completa',
            'ctl.gpDefinicoes': 'Abrir los ajustes',
            'ctl.gpIdioma': 'Abrir el idioma',
            'ctl.gpSubirDescer': 'Subir y bajar',
            'ctl.gpCursor': 'Mover un deslizador',
            'ctl.gpConfirmar': 'Elegir',
            'ctl.gpFechar': 'Cerrar',
            'ctl.gpTocar': 'Reproducir / pausar',
            'ctl.gpSaltar': 'Saltar 5 segundos',
            'ctl.gpVolume': 'Volumen',
            'ctl.gpSilenciar': 'Silenciar',
            'ctl.gpAnteriorSeguinte': 'Testimonio anterior / siguiente',
            'ctl.gpVirar': 'Girar la cabeza',
            'ctl.gpParagem': 'Parada anterior / siguiente',
            'ctl.abrirVideo': 'Abrir testimonio en vídeo',
            'ctl.clicar': 'Hacer clic',
            'ctl.numMarcador': 'en un marcador',
            'ctl.irAte': 'Ir a un sitio',
            'ctl.noSitio': 'en un punto del barrio',
            'ctl.tocar': 'Tocar',
            'ctl.fecharVideo': 'Cerrar vídeo',
            'ctl.ouClicarFora': 'o hacer clic fuera',
            'ctl.mudarQualidade': 'Cambiar la calidad gráfica',
            'ctl.noCabecalho': 'en la cabecera',
            'ctl.dicaPerfTitulo': 'Rendimiento:',
            'ctl.dicaPerf': 'Si el visor va lento en un ordenador antiguo, cambia la calidad gráfica a Baja en el icono ⚙ de la cabecera. En el móvil, la calidad se ajusta automáticamente.',
            'ctl.dicaPerdidoTitulo': '¿Perdido?',
            'ctl.dicaPerdido': 'Si la cámara llega al límite de la simulación, aparecerá un botón para recentrarla automáticamente.',
            'ctl.descricao': 'Guía completa de los controles del visor 3D Malha Viva. Aprende a navegar con ratón, teclado, tacto y mando.'
        },

        kea: {
            'cab.controlos': 'Kontrolus',
            'cab.definicoes': 'Definisons',
            'cab.idioma': 'Lingua',
            'cab.vr': 'Modu VR',
            'cab.cartao': 'Óklus di karton',
            'cab.sairCartao': 'Sai di óklus',
            'cab.ecra': 'Ekran interu',

            'def.qualidade': 'Kualidadi di imajen',
            'def.auto': 'Automátiku (Rekumendadu)',
            'def.alto': 'Altu (Máximu detalhi)',
            'def.medio': 'Médiu (Ekilibradu)',
            'def.baixo': 'Baxu (Más rapidez)',
            'def.anotacoes': 'Markadoris',
            'def.testemunhos': 'Tistimunhus',
            'def.rotas360': 'Rotas 360º',
            'def.interface': 'Interfasi',
            'def.paisagem': 'Paizajen',
            'leg.titulo': 'Legenda di mapa',

            'ins.titulo': 'Modi ki bu ta navega',
            'ins.fechar': 'Fitxa instruson',
            'ins.passo': 'Pasu {n} di {total}',
            'ins.rever': 'Torna odja instruson',
            'ins.irTitulo': 'Bai pa un lugar',
            'ins.irRato': 'Klika na un lugar di bairu i kámara ta leba-bu la.',
            'ins.irToque': 'Toka na un lugar di bairu i kámara ta leba-bu la.',
            'ins.olharTitulo': 'Odja na roda',
            'ins.olharRato': 'Rasta ku ratu pa roda vista.',
            'ins.olharToque': 'Rasta ku un dedu pa roda vista.',
            'ins.zoomTitulo': 'Xiga pertu i lonji',
            'ins.zoomRato': 'Uza roda di ratu.',
            'ins.zoomToque': 'Abri o fitxa dos dedu.',
            'ins.tecladoTitulo': 'Anda ku tekladu',
            'ins.teclado': 'Teklas W A S D o setas ta leba-bu pa bairu.',
            'ins.historiasTitulo': 'Odja stórias',
            'ins.historias': 'Markadoris ta abri tistimunhus i rotas 360º.',

            'idm.titulo': 'Lingua',
            'mapa.testemunhoDe': 'Tistimunhu di {nome}',
            'mapa.fotografia360': 'fotografia 360º',

            'carga.modelo': 'Ta karega modelu 3D…',
            'carga.restaurar': 'Ta restaura anbienti 3D…',
            'gpu.aTentar': 'Aparelhu fika sen memória gráfika. Ta tenta di novu ku ménus detalhi…',
            'gpu.desistiu': 'Es aparelhu ka konsigi mostra bairu na 3D.',
            'gpu.botao': 'Tenta di novu',
            'arranque.demora': 'Sta ta dura más ki kustuma.',
            'arranque.bairro': 'Bairu sta ta dura pa txiga.',
            'arranque.sub': 'Pode ser ligason di internet. Si kontinua asi, tenta di novu.',

            'limite.titulo': 'Bu txiga na fin di mapa.',
            'limite.sub': 'Ka ten txon pa la di es zona.',
            'limite.botao': 'Volta pa sentru',

            'cab.menu': 'Menu',

            'par.botao': 'Partilha',
            'par.titulo': 'Partilha',
            'par.texto': 'Splora Bairru di Penajóia na 3D — Malha Viva',
            'par.email': 'E-mail',
            'par.copiar': 'Kopia link',
            'par.copiado': 'Link kopiadu',
            'par.mais': 'Más opson…',
            'par.fechar': 'Fitxa',

            'video.qualidade': 'Kualidadi',
            'video.resolucao': 'Ruzoluson',
            'video.oculos': 'Odja ku óklus',

            'foto.titulo': 'Fotografia 360º',
            'foto.carregar': 'Ta karega fotografia 360º…',
            'foto.erro': 'Ka konsigi karega fotografia 360º.',
            'visor.erro': 'Ka konsigi abri vizor 360º.',
            'video.erro': 'Ka konsigi karega vídiu.',
            'foto.ecra': 'Ekran interu',
            'foto.aproximar': 'Xiga más pértu',
            'foto.afastar': 'Fasta',

            'rota.titulo': 'Rota 360º',
            'palco.anterior': 'Anterior',
            'palco.seguinte': 'A sigi',
            'palco.sair': 'Sai',
            'v360.tocar': 'Toka / Para',
            'v360.recuar': 'Volta 5 sigundu',
            'v360.avancar': 'Bai 5 sigundu',
            'v360.recentrar': 'Indreta vista',
            'v360.ecra': 'Ekran interu',
            'v360.ajudaTitulo': 'Es e un vídiu 360º',
            'v360.ajudaOlhar': 'Rasta ku ratu pa odja na roda — imajen ta da volta interu. Teklas W, A, S i D ta faze mesmu kuza.',
            'v360.ajudaOlharToque': 'Rasta ku dedu pa odja na roda — imajen ta da volta interu.',
            'v360.ajudaPausa': 'Klika na imajen pa para, ô uza barra la baxu. Spasu, setas, M i F ta funsiona tanbe.',
            'v360.ajudaPausaToque': 'Toka na imajen pa para, ô uza barra la baxu.',
            'v360.ajudaOculos': 'Ku óklus ligadu, buton di óklus ta pô-u la dentu — i so la ki vista ta sigi movimentu di kabesa.',
            'v360.ajudaEntendi': 'N intendi',

            'ctl.voltar': 'Volta pa Mapa',
            'ctl.verMais': 'Mostra más',
            'ctl.verMenos': 'Mostra ménus',
            'ctl.titulo': 'Kontrolus di Mapa',
            'ctl.sub': 'Gia kompletu pa navega na rekonstruson 3D di Bairu di Penajóia.',
            'ctl.rato': 'Ratu',
            'ctl.teclado': 'Tekladu',
            'ctl.tecladoDesc': 'Ta da pa tudu sen ratu. Na bairu kes seta ta anda, sima WASD; ku Alt primidu es ta pasa pa djobe à volta. Na paragen 360º, WASD ta vira kabesa. Ku un janela abertu, kes seta di ladu ta pasa pa tistimunhu ô paragen di ladu, sima kes seta dizenhadu na kada ladu del.',
            'ctl.tecAltSetas': 'Alt + seta',
            'ctl.tecEspaco': 'Espasu',
            'ctl.tecEndireitar': 'Indireita vista',
            'ctl.tecIrA': 'Bai pa un pontu di filmi',
            'ctl.tecInicioFim': 'Inísiu / fin di filmi',
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
            'ctl.olhar': 'Odja na roda',
            'ctl.zoomVista': 'Xiga pertu (Zoom)',
            'ctl.avancarRecuar': 'Bai pa frenti / pa tras',
            'ctl.lateralmente': 'Move pa ladu',
            'ctl.movimentoRapido': 'Movimentu rápidu',
            'ctl.movimentoLento': 'Movimentu lentu',
            'ctl.rodarCamara': 'Roda kámara',
            'ctl.panDoisDedos': 'Move pa ladu (Pan)',
            'ctl.gamepadDesc': 'Liga un komandu (Xbox, PlayStation, etc.) i primi kalker botan pa el korda. Di li pa frenti el ta fazi tudu: anda na bairu, abri kes tistimunhu, meksi na menus i manda na video, sen toka na ratu.',
            'ctl.deslocar': 'Move',
            'ctl.stickEsq': 'Stick Skerdu',
            'ctl.stickDir': 'Stick Direitu',
            'ctl.gpNomes': 'Nomi di kes botan e di Xbox. Na un komandu di PlayStation, A e X, B e sirkulu, X e kuadradu, Y e triangulu, Start e Options i Select e Share.',
            'ctl.gpNoBairro': 'Na bairu',
            'ctl.gpNosMenus': 'Na menus',
            'ctl.gpNoVideo': 'Na janela di video',
            'ctl.gpNas360': 'Na paragen 360º',
            'ctl.gpCruzLados': 'Kruz ← →',
            'ctl.gpCruzCima': 'Kruz ↑ ↓',
            'ctl.gpDepressa': 'Anda dipresa',
            'ctl.gpDevagar': 'Anda divagar',
            'ctl.gpEscolher': 'Skolhe un markador',
            'ctl.gpAbrir': 'Abri markador',
            'ctl.gpLargar': 'Larga skolha',
            'ctl.gpRecentrar': 'Rekentra, na avizu di limiti',
            'ctl.gpEcra': 'Ekran interu',
            'ctl.gpDefinicoes': 'Abri difinison',
            'ctl.gpIdioma': 'Abri lingua',
            'ctl.gpSubirDescer': 'Subi i dixi',
            'ctl.gpCursor': 'Meksi na un kursor',
            'ctl.gpConfirmar': 'Skolhe',
            'ctl.gpFechar': 'Fitxa',
            'ctl.gpTocar': 'Toka / para',
            'ctl.gpSaltar': 'Salta 5 sigundu',
            'ctl.gpVolume': 'Volumi',
            'ctl.gpSilenciar': 'Silensia',
            'ctl.gpAnteriorSeguinte': 'Tistimunhu anterior / siginti',
            'ctl.gpVirar': 'Vira kabesa',
            'ctl.gpParagem': 'Paragen anterior / siginti',
            'ctl.abrirVideo': 'Abri tistimunhu na vídiu',
            'ctl.clicar': 'Klika',
            'ctl.numMarcador': 'na un markador',
            'ctl.irAte': 'Bai pa un lugar',
            'ctl.noSitio': 'na un lugar di bairu',
            'ctl.tocar': 'Toka',
            'ctl.fecharVideo': 'Fitxa vídiu',
            'ctl.ouClicarFora': 'ô klika pa fora',
            'ctl.mudarQualidade': 'Muda kualidadi di imajen',
            'ctl.noCabecalho': 'na kabesa di pájina',
            'ctl.dicaPerfTitulo': 'Rapidez:',
            'ctl.dicaPerf': 'Si vizualizador sta lentu na un komputador bedju, muda kualidadi di imajen pa Baxu na íkoni ⚙ na kabesa di pájina. Na telemóvel, kualidadi ta ajusta si própi.',
            'ctl.dicaPerdidoTitulo': 'Bu perde?',
            'ctl.dicaPerdido': 'Si kámara txiga na limiti di simulason, un buton ta parse pa rekoloka-l otomatikamenti.',
            'ctl.descricao': 'Gia kompletu di kontrolus di vizualizador 3D Malha Viva. Prende navega ku ratu, tekladu, toki i komandu.'
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
