import { EnvLighting, Mesh, PIXELFORMAT_RGBA8, PRIMITIVE_TRIANGLES, Quat, Texture, Vec3 } from 'playcanvas';
import { AJUSTES_PADRAO, LARGURA_FINAL, LARGURA_RAPIDA, tratarFotografia } from './ceu-fotografia.mjs?v=4';

/**
 * O céu do bairro: a panorâmica do Olho de Águia à volta do mapa.
 *
 * A fotografia é uma panorâmica esférica tirada por cima do bairro — vê-se
 * o rio, a ponte e a cidade ao fundo. Posta como céu, o mapa deixa de
 * flutuar no preto e passa a estar no sítio onde de facto está.
 *
 * O motor não sabe desenhar directamente uma panorâmica esticada como
 * esta: precisa dela arrumada nas seis faces de um cubo à volta do
 * observador. Essa arrumação é feita uma vez, no arranque, e o tamanho das
 * faces acompanha o nível de qualidade — num telemóvel guardar seis faces
 * grandes gastaria memória que faz falta ao bairro.
 *
 * Há duas maneiras de o pendurar. "Infinito" é o céu de sempre: por muito
 * que se ande, fica sempre à mesma distância, como o horizonte verdadeiro.
 * "Cúpula" assenta a panorâmica numa taça em volta do mapa, o que põe a
 * paisagem à distância certa em vez de a deixar no infinito.
 *
 * A taça do motor tem o fundo chato, e era daí que vinha o deslizamento: a
 * fotografia é atirada de um ponto só — o sítio de onde o drone a tirou —
 * e o chão dela ia bater contra esse disco liso, que não é o chão a sério.
 * Aqui tira-se-lhe o chão: a metade de baixo da taça deixa de ser cortada
 * num disco e é esticada para baixo, como um poço, até se fechar num ponto
 * lá no fundo. O chão da fotografia cai então por baixo do bairro, longe,
 * onde não tem parallax que se veja — e quem faz de chão é o bairro, que é
 * quem o tem a sério.
 *
 * O que não se pode é abrir-lhe um buraco em vez do chão. A fotografia é
 * atirada em todas as direcções e precisa de encontrar taça em todas elas;
 * onde não houvesse taça não haveria imagem, e a paisagem aparecia cortada
 * a meio, com o nada por baixo da linha do horizonte. Por isso o poço
 * fecha-se sempre — só que muito mais fundo do que se chega a olhar.
 */

// A fotografia já vem tratada: a luz, a cor e o contraste foram assados
// nela de uma vez por todas, a partir do original em vírgula flutuante
// (ver scripts/assar-ceu.py). Assim não há contas a fazer a cada visita,
// não há bandas de tanto esticar 256 tons, e o que passava do branco em
// vez de chapar ficou com desenho. O editor aqui em baixo continua a
// servir para experimentar por cima — mas o que ele mostrar já é acerto
// sobre acerto.
const IMAGEM = '/ceu-olho-de-aguia.jpg';

// Tamanho de cada face do cubo, conforme o nível de qualidade. São seis
// faces, por isso o custo em memória é seis vezes o quadrado destes
// números — daí a diferença entre níveis.
const TAMANHO_DAS_FACES = {
    high: 1024,
    med: 512,
    low: 256
};

// Onde ficam guardadas as afinações, para sobreviverem a um recarregar.
// O número no fim muda sempre que os valores de fábrica mudam: assim o que
// ficou guardado de uma afinação antiga não volta a ser aplicado por cima
// de uma fotografia que já a traz embutida.
const CHAVE = 'ceu-olho-de-aguia-v12';

const PADRAO = {
    ligado: true,
    rotacao: 296,
    brilho: 1,
    cupula: true,
    tamanhoDaCupula: 857.6,
    alturaDaCupula: 0.1,
    // A cúpula não tem de ficar centrada na origem do mapa: a panorâmica
    // foi tirada de um ponto concreto do bairro, e é sobre esse ponto que
    // ela assenta melhor. Estas duas medidas deslocam-na no plano.
    deslocamentoX: -0.06,
    deslocamentoZ: 0,
    // A que profundidade, em metros, a taça se fecha lá em baixo. É este
    // número que manda no chão: a zero a taça fica rasa, com o fundo à
    // altura a que o disco estava, e o chão da fotografia volta a bater
    // contra ele; a oitenta e cinco e oito fica a curva que a esfera do
    // motor teria se ninguém lha tivesse cortado; daqui para baixo abre em
    // poço e o chão da fotografia vai-se enterrando por baixo do bairro.
    //
    // Quatrocentos foi escolhido a olho, pela vista de abertura: o ponto
    // onde o poço fecha é o nadir da panorâmica — o ponto cego debaixo do
    // drone, que na fotografia já vem esborratado — e a esta profundidade
    // ele cai por baixo do que a vista de abertura mostra. Mais raso,
    // sobe-lhe ao enquadramento; muito mais fundo, aproxima-se da vertical
    // e aparece a quem pique a olhar mesmo para baixo, de fora do bairro.
    fundoDaCupula: 400
};

// A taça do motor, para a metade de cima ficar exactamente onde estava:
// uma esfera de meio metro, subida um décimo, com estas mesmas bandas.
const BANDAS_DE_LATITUDE = 50;
const FATIAS_A_VOLTA = 50;
const FUNDO = 0.1;

// Em quantos anéis se divide a metade de baixo. São mais do que os do
// motor de propósito: esticada em poço, essa metade fica muito mais alta
// do que era, e com poucos anéis via-se-lhe a facetagem.
const ANEIS_DO_POCO = 100;

/**
 * Talha a taça do céu sem chão: cúpula por cima, poço por baixo.
 *
 * A metade de cima é ponto por ponto a que o motor faz — as mesmas bandas,
 * a mesma esfera — para nada do que já estava afinado se mexer. A metade
 * de baixo, em vez de ser achatada e cortada num disco, é esticada até à
 * profundidade pedida e fecha-se sozinha num ponto, lá no fundo. Como as
 * duas metades se encontram na barriga da taça, onde ambas são verticais,
 * a junta não se vê: não há esquina nem risco a meio da paisagem.
 *
 * As contas ficam em medidas da própria taça, que é como o motor a quer —
 * ela é depois esticada pelo tamanho escolhido e posta no sítio.
 *
 * @param {number} tamanho - O tamanho da taça, em metros.
 * @param {number} profundidade - Onde o poço se fecha, em metros abaixo da taça.
 * @returns {object} Os pontos e os triângulos da taça.
 */
function talharCupula(tamanho, profundidade) {
    // De quanto se estica a metade de baixo para o fundo do poço ir ter à
    // profundidade pedida. O motor esticava-a a três décimos, o que num
    // tamanho de 857,6 dá 85,8 metros de fundo — só que depois lhe cortava
    // um disco liso por dentro, e era esse disco o chão que aqui sai.
    const estica = FUNDO + profundidade / (tamanho * 0.5);

    const aneis = [];
    for (let banda = 0; banda <= BANDAS_DE_LATITUDE / 2; banda++) {
        const angulo = banda * Math.PI / BANDAS_DE_LATITUDE;
        aneis.push({
            raio: Math.sin(angulo),
            altura: (Math.cos(angulo) + FUNDO) * 0.5
        });
    }
    for (let anel = 1; anel <= ANEIS_DO_POCO; anel++) {
        const angulo = Math.PI / 2 + anel * (Math.PI / 2) / ANEIS_DO_POCO;
        aneis.push({
            raio: Math.sin(angulo),
            altura: (Math.cos(angulo) * estica + FUNDO) * 0.5
        });
    }

    const larguraDoAnel = FATIAS_A_VOLTA + 1;
    const pontos = new Float32Array(aneis.length * larguraDoAnel * 3);
    let p = 0;
    for (const anel of aneis) {
        for (let volta = 0; volta <= FATIAS_A_VOLTA; volta++) {
            const angulo = volta * 2 * Math.PI / FATIAS_A_VOLTA - Math.PI / 2;
            pontos[p++] = Math.cos(angulo) * anel.raio * 0.5;
            pontos[p++] = anel.altura;
            pontos[p++] = Math.sin(angulo) * anel.raio * 0.5;
        }
    }

    // Os triângulos são cosidos como o motor cose os da esfera dele: assim
    // ficam virados para o mesmo lado, e o motor, que desenha o céu por
    // dentro e esconde o que está virado para fora, aceita-os sem mais.
    const triangulos = new Uint16Array((aneis.length - 1) * FATIAS_A_VOLTA * 6);
    let t = 0;
    for (let anel = 0; anel < aneis.length - 1; anel++) {
        for (let volta = 0; volta < FATIAS_A_VOLTA; volta++) {
            const primeiro = anel * larguraDoAnel + volta;
            const segundo = primeiro + larguraDoAnel;
            triangulos[t++] = primeiro + 1;
            triangulos[t++] = segundo;
            triangulos[t++] = primeiro;
            triangulos[t++] = primeiro + 1;
            triangulos[t++] = segundo + 1;
            triangulos[t++] = segundo;
        }
    }

    return { pontos, triangulos };
}

/**
 * Passa os pontos talhados a uma malha que o motor saiba desenhar.
 *
 * @param {object} dispositivo - O dispositivo gráfico.
 * @param {object} feitio - Os pontos e os triângulos.
 * @returns {object} A malha pronta a desenhar.
 */
function construirMalha(dispositivo, feitio) {
    const malha = new Mesh(dispositivo);
    malha.setPositions(feitio.pontos);
    malha.setIndices(feitio.triangulos);
    malha.update(PRIMITIVE_TRIANGLES);
    return malha;
}

/**
 * Põe a panorâmica como céu e devolve os comandos para a afinar.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {object} Comandos do céu.
 */
export function ligarCeu(app) {
    const definicoes = Object.assign({}, PADRAO, lerGuardado());
    definicoes.ajustes = Object.assign({}, AJUSTES_PADRAO, definicoes.ajustes || {});
    let cubo = null;
    let fotografia = null;
    let aTrazer = null;
    let temporizador = null;
    let feitio = null;
    let malha = null;
    let talhadas = {};

    /**
     * Lê as afinações guardadas na visita anterior.
     *
     * @returns {object} O que estiver guardado, ou nada.
     */
    function lerGuardado() {
        try {
            return JSON.parse(localStorage.getItem(CHAVE) || '{}');
        } catch (e) {
            return {};
        }
    }

    /**
     * Guarda as afinações para a próxima visita.
     */
    function guardar() {
        try {
            localStorage.setItem(CHAVE, JSON.stringify(definicoes));
        } catch (e) { /* sem espaço ou sem permissão: não é grave */ }
    }

    /**
     * Traz a fotografia do servidor, uma vez só.
     *
     * @returns {Promise<HTMLImageElement|null>} A fotografia, ou nada.
     */
    function trazerFotografia() {
        if (fotografia) return Promise.resolve(fotografia);
        if (aTrazer) return aTrazer;
        aTrazer = new Promise((resolve) => {
            const imagem = new Image();
            imagem.onload = () => { fotografia = imagem; resolve(imagem); };
            imagem.onerror = () => {
                console.warn('Céu: não foi possível trazer a fotografia.');
                resolve(null);
            };
            imagem.src = IMAGEM;
        });
        return aTrazer;
    }

    /**
     * Arruma a fotografia nas seis faces do cubo do céu, já tratada.
     *
     * @param {number} [largura] - Largura de trabalho da fotografia.
     * @returns {Promise<object|null>} O cubo do céu, ou nada se falhar.
     */
    async function construirCubo(largura) {
        const imagem = await trazerFotografia();
        if (!imagem) return null;
        try {
            const fonte = tratarFotografia(imagem, definicoes.ajustes, largura || LARGURA_FINAL);
            // A textura tem de ser feita exactamente como o motor a fazia
            // quando carregava a fotografia sozinho. Parece detalhe, mas
            // não é: mexer na projecção ou nos mipmaps muda a maneira como
            // a imagem é enrolada no cubo, e a paisagem acaba noutro sítio
            // do horizonte.
            const plana = new Texture(app.graphicsDevice, {
                name: 'ceu-tratado',
                width: fonte.width,
                height: fonte.height,
                format: PIXELFORMAT_RGBA8,
                mipmaps: true
            });
            plana.setSource(fonte);

            const faces = TAMANHO_DAS_FACES[window.actualQuality] || TAMANHO_DAS_FACES.med;
            const novo = EnvLighting.generateSkyboxCubemap(plana, faces);
            plana.destroy();
            if (cubo) cubo.destroy();
            cubo = novo;
            return cubo;
        } catch (e) {
            console.warn('Céu: não foi possível preparar a fotografia.', e);
            return null;
        }
    }

    /**
     * Refaz o céu depois de se mexer nos ajustes da fotografia.
     *
     * Enquanto a mão anda no cursor trabalha-se em pequeno, que é
     * instantâneo; mal ela pára, refaz-se em tamanho grande.
     */
    function refazerFotografia() {
        construirCubo(LARGURA_RAPIDA).then(aplicar);
        clearTimeout(temporizador);
        temporizador = setTimeout(() => {
            construirCubo(LARGURA_FINAL).then(aplicar);
        }, 450);
    }

    /**
     * Põe a nossa taça no lugar da que o motor faz de origem.
     *
     * Isto é confirmado a cada imagem, e não só quando se mexe nos
     * comandos, porque o motor refaz o céu por sua conta — ao trocar a
     * fotografia, o brilho ou o tipo — e leva a nossa taça com ele, que
     * fica um objecto vazio, sem pontos lá dentro. A confirmação é uma
     * comparação e não custa nada; talhar de novo só acontece quando as
     * medidas mudam mesmo.
     *
     * @param {object} cena - A cena 3D.
     */
    function tirarOChao(cena) {
        if (!definicoes.cupula) return;
        const desenho = cena.sky && cena.sky.skyMesh && cena.sky.skyMesh.meshInstance;
        if (!desenho) return;

        const tamanho = definicoes.tamanhoDaCupula;
        const profundidade = definicoes.fundoDaCupula;

        if (!feitio || tamanho !== talhadas.tamanho || profundidade !== talhadas.profundidade) {
            talhadas = { tamanho, profundidade };
            feitio = talharCupula(tamanho, profundidade);
            malha = null;
        }
        if (!malha || !malha.vertexBuffer) {
            malha = construirMalha(app.graphicsDevice, feitio);
        }
        if (desenho.mesh !== malha) {
            const anterior = desenho.mesh;
            desenho.mesh = malha;
            // A taça que estava — a do motor, ou uma nossa já ultrapassada —
            // fica sem ninguém a segurá-la; é altura de a largar.
            if (anterior && anterior.refCount === 0 && anterior.vertexBuffer) {
                anterior.destroy();
            }
        }
    }

    /**
     * Escreve as afinações actuais na cena.
     */
    function aplicar() {
        const cena = app.scene;
        if (!cena) return;

        if (!definicoes.ligado) {
            cena.skybox = null;
            return;
        }
        if (!cubo) return;

        cena.skybox = cubo;
        cena.skyboxIntensity = definicoes.brilho;
        cena.skyboxRotation = new Quat().setFromEulerAngles(0, definicoes.rotacao, 0);

        if (cena.sky) {
            cena.sky.type = definicoes.cupula ? 'dome' : 'infinite';
            if (definicoes.cupula) {
                const t = definicoes.tamanhoDaCupula;
                const x = definicoes.deslocamentoX;
                const z = definicoes.deslocamentoZ;
                cena.sky.node.setLocalScale(t, t, t);
                cena.sky.node.setLocalPosition(x, definicoes.alturaDaCupula, z);
                // O centro tem de acompanhar a cúpula, senão a projecção
                // fica a olhar para um sítio onde ela já não está.
                cena.sky.center = new Vec3(x, definicoes.alturaDaCupula, z);
                tirarOChao(cena);
            }
        }
        guardar();
    }

    /**
     * Muda uma afinação e mostra logo o resultado.
     *
     * @param {string} campo - Nome da afinação.
     * @param {number|boolean} valor - Novo valor.
     */
    function afinar(campo, valor) {
        definicoes[campo] = valor;
        if (campo === 'ligado' && valor && !cubo) {
            construirCubo(LARGURA_FINAL).then(aplicar);
            return;
        }
        aplicar();
    }

    /**
     * Muda um ajuste da própria fotografia — luz, cor ou desfoque — e
     * mostra logo o resultado.
     *
     * @param {string} campo - Nome do ajuste.
     * @param {number} valor - Novo valor.
     */
    function afinarFotografia(campo, valor) {
        definicoes.ajustes[campo] = valor;
        guardar();
        refazerFotografia();
    }

    if (definicoes.ligado) {
        construirCubo(LARGURA_FINAL).then(aplicar);
    }

    // A vigia que repõe a taça sempre que o motor a deita fora. Fica
    // registada depois da do próprio motor, e por isso corre a seguir.
    app.scene.on('prerender', () => {
        if (!definicoes.ligado || !definicoes.cupula || !cubo) return;
        tirarOChao(app.scene);
    });

    return {
        definicoes,
        afinar,
        afinarFotografia,
        aplicar,

        /**
         * Onde ficam as paredes da cúpula, em metros do mundo.
         *
         * O motor desenha a cúpula a partir de uma esfera de meio metro:
         * sobe-a um décimo e só depois a multiplica pelo tamanho que aqui
         * se escolhe. Daí saírem estes números: a barriga mais larga fica a
         * cinco centésimos do tamanho, e o alto da abóbada a cinquenta e
         * cinco centésimos.
         *
         * Serve à câmara para saber até onde pode andar: as paredes da taça
         * são o fim do mundo visível, e passar delas seria sair da
         * fotografia. Em baixo já não há chão nenhum — a taça abre em poço —
         * mas o número continua a ser dado, que é onde ela dantes assentava
         * e é o que trava a câmara de descer para lá do bairro.
         *
         * @returns {object|null} As medidas, ou nada se não houver cúpula.
         */
        limites() {
            if (!definicoes.ligado || !definicoes.cupula) {
                return null;
            }
            const tamanho = definicoes.tamanhoDaCupula;
            const base = definicoes.alturaDaCupula;
            return {
                centroX: definicoes.deslocamentoX,
                centroZ: definicoes.deslocamentoZ,
                raio: tamanho * 0.5,
                chao: base,
                barriga: base + tamanho * 0.05,
                topo: base + tamanho * 0.55
            };
        },
        /** Volta a pôr tudo como veio de fábrica. */
        reiniciar() {
            Object.assign(definicoes, PADRAO);
            definicoes.ajustes = Object.assign({}, AJUSTES_PADRAO);
            guardar();
            refazerFotografia();
        },
        /** Volta a pôr só a fotografia como veio da máquina. */
        reiniciarFotografia() {
            definicoes.ajustes = Object.assign({}, AJUSTES_PADRAO);
            guardar();
            refazerFotografia();
        }
    };
}
