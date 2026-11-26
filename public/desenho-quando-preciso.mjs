/**
 * O bairro só se desenha quando há o que mudar no ecrã.
 *
 * De origem o motor desenha uma imagem nova a cada volta do ecrã — 60, 144
 * por segundo —, mesmo com a câmara parada e mesmo com um testemunho ou uma
 * 360° abertos por cima, a tapar a janela toda. Isso aquecia o portátil,
 * gastava a bateria, e tirava a placa gráfica aos vídeos.
 *
 * Aqui decide-se, a cada volta, se vale a pena desenhar:
 *
 *  - com uma janela que tapa o ecrã todo (o vídeo de um testemunho, as 360°),
 *    não se desenha nada; quando ela começa a fechar (fica transparente),
 *    volta-se a desenhar, para o bairro estar lá por trás;
 *  - desenha-se enquanto alguém mexe (rato, dedo, teclas, roda, a janela a
 *    mudar de tamanho; o comando de jogo mexe a câmara, e isso conta) e um bocado depois (`PAUSA_DEPOIS_DE_PARAR`);
 *  - desenha-se enquanto a câmara anda, e enquanto o bairro não está assente
 *    — a chegar da internet, a meio de uma transição entre níveis, com uma
 *    reavaliação marcada (ver `ocupado`, dado por quem liga isto);
 *  - nos óculos de VR desenha-se sempre.
 *
 * O resto do site continua a correr como sempre (os marcadores, as contas):
 * só o desenho do bairro fica parado, e a última imagem fica no ecrã.
 */

// Quanto tempo se continua a desenhar depois de tudo parar, em milissegundos:
// a ordem das manchas da última posição ainda está a chegar, e há animações
// curtas que acabam depois de a câmara parar (o quadrado de onde se carregou).
const PAUSA_DEPOIS_DE_PARAR = 1500;

// As janelas que tapam o ecrã todo.
const JANELAS_QUE_TAPAM = ['video-modal', 'modal-360'];

/**
 * @param {object} app - A aplicação 3D.
 * @param {object} opcoes
 * @param {function(): boolean} opcoes.ocupado - Diz se o bairro ainda está a
 *     mudar sozinho (a chegar, a assentar), e por isso tem de se desenhar.
 * @returns {{emPausa: function(): boolean, acordar: function(): void}}
 */
export function ligarDesenhoQuandoPreciso(app, opcoes) {
    let ultimaAtividade = performance.now();
    let emPausa = false;
    const acordar = () => {
        ultimaAtividade = performance.now();
        app.renderNextFrame = true;
    };
    const eventos = ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup',
        'touchstart', 'touchmove', 'touchend', 'resize', 'focus'];
    eventos.forEach((ev) => window.addEventListener(ev, acordar, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', acordar);

    const camara = app.root.findByName('camera');
    const antes = new Float32Array(17);

    // Uma janela das que tapam tudo, aberta e já opaca.
    const tapado = () => JANELAS_QUE_TAPAM.some((id) => {
        const el = document.getElementById(id);
        return !!el && el.style.display !== 'none' && el.style.display !== '' && el.style.opacity === '1';
    });

    app.autoRender = false;
    app.on('update', () => {
        const agora = performance.now();
        // A câmara mexeu-se? (posição, rotação, abertura)
        if (camara) {
            const m = camara.getWorldTransform().data;
            let mexeu = false;
            for (let i = 0; i < 16; i++) {
                if (Math.abs(m[i] - antes[i]) > 1e-5) { mexeu = true; antes[i] = m[i]; }
            }
            const fov = camara.camera ? camara.camera.fov : 0;
            if (fov !== antes[16]) { mexeu = true; antes[16] = fov; }
            if (mexeu) ultimaAtividade = agora;
        }
        let desenhar;
        if (app.xr && app.xr.active) desenhar = true;
        else if (tapado()) desenhar = false;
        else {
            desenhar = agora - ultimaAtividade < PAUSA_DEPOIS_DE_PARAR;
            if (!desenhar) {
                try { desenhar = !!opcoes.ocupado(); } catch (e) { desenhar = true; }
                if (desenhar) ultimaAtividade = agora;
            }
        }
        emPausa = !desenhar;
        if (desenhar) app.renderNextFrame = true;
    });

    return { emPausa: () => emPausa, acordar };
}
