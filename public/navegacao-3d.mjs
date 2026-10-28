/**
 * A navegação no bairro em 3D: o percurso até uma casa por cima do bairro
 * de Gaussian splats — a linha pelas ruas, o número da casa por cima do
 * telhado, a entrada (ou, com a localização ligada, quem está a ver)
 * marcada — e a câmara a ir até um sítio de onde se vê tudo.
 *
 * As contas do percurso são as de navegacao.mjs; aqui só se desenha. As
 * ruas e as casas vêm em graus (latitude e longitude); a cena do site tem
 * os seus eixos — x para leste, z para sul, y para cima, em metros. A
 * passagem é a do registo do ortofotomapa, e o chão do bairro na cena (a
 * altura de cada ponto) vem em navegacao/chao.bin; os dois são feitos por
 * scripts/navegacao/reconhecer.py.
 *
 * A linha é desenhada no ecrã, por cima do bairro e de tudo, com a mesma
 * grossura perto e longe — a dos mapas de navegação: 6 pontos de branco
 * num contorno escuro de 10. A cada imagem, os pontos do caminho são postos
 * no sítio do ecrã onde caem, como os marcadores. (Pintada no chão do
 * bairro, engrossava ao pé da câmara e sumia ao longe.)
 */
import { Vec3 } from 'playcanvas';
import { alisar, arredondar, preencher, METROS_POR_MINUTO } from './navegacao.mjs?v=7';

// Quanto se alisa a linha, em metros (as contas são as do traçado de
// origem).
const ALISAR_M = 4;
// A linha passa um nada acima do chão.
const ACIMA_DO_CHAO = 0.35;
// A linha no ecrã, em pontos: o branco e o contorno escuro à volta; e os
// pontinhos até à casa (e até ao caminho, de onde se está), com o seu
// contorno e o espaço entre eles.
const LINHA = 6;
const CONTORNO = 10;
const PONTO = 4;
const CONTORNO_DO_PONTO = 7;
const ENTRE_PONTOS = 10;
const BRANCO = '#ffffff';
const ESCURO = '#05050a';
const OPACIDADE_DO_ESCURO = 0.85;
// O que fica a menos disto à frente da câmara, em metros, não se desenha:
// está atrás dela, ou mesmo em cima.
const PERTO_DE_MAIS = 0.5;
// O número da casa fica esta altura acima do telhado; sem telhado medido,
// esta acima do chão.
const ACIMA_DO_TELHADO = 1.5;
const ACIMA_DO_CHAO_SEM_TELHADO = 6;
// A câmara: quanto demora a ir; entre que inclinações (graus a olhar para
// baixo) e que desvios do rumo da entrada para a casa escolhe a que mostra
// o percurso todo de mais perto; e a que altura mínima fica acima do chão
// por baixo dela.
const DURACAO_DA_VIAGEM = 1.8;
const INCLINACOES = [35, 42, 50, 58, 66, 74];
const DESVIOS = [0, -20, 20, -40, 40];
const ALTURA_MINIMA = 18;
// Quando o percurso não cabe todo, de cima, a esta inclinação.
const INCLINACAO_DE_RECURSO = 60;
// A linha de vista da câmara até ao percurso passa pelo menos esta altura
// acima do chão — que um morro não fique à frente.
const ACIMA_DO_MORRO = 1.5;
// De perto (um passo das indicações, a casa, a entrada): a esta distância
// e com esta inclinação.
const DE_PERTO = 38;
const INCLINACAO_DE_PERTO = 42;
// Onde está quem vê, com a localização ligada: a mais do que
// LONGE_DO_BAIRRO_M do caminho mais perto, está fora do bairro, e o
// percurso começa na entrada; mais perto, começa onde a pessoa está, a
// pontinhos até ao caminho se ele ficar a mais de FORA_DA_REDE_M.
const LONGE_DO_BAIRRO_M = 400;
const FORA_DA_REDE_M = 12;

const RAIO_DA_TERRA = 6378137;

/**
 * Prepara a navegação no bairro em 3D: lê o chão do bairro (só quando for
 * preciso pela primeira vez — não pesa no arranque).
 *
 * @param {object} app - A aplicação 3D (PlayCanvas).
 * @param {object} opcoes - O que a página dá: `rede` (a Rede, já lida),
 *     `camara` (a entidade da câmara), `diz` (os textos das línguas) e
 *     `folgas` (o que tapa o ecrã: {esquerda, cima, direita, baixo}, em
 *     pontos).
 * @returns {Promise<object>} O que se lhe pode pedir: mostrar o percurso
 *     até uma casa (`mostrar`), tirá-lo (`limpar`), voltar a enquadrá-lo
 *     (`enquadrar`), ir ver um passo de perto (`verPasso`), pôr e tirar o
 *     sítio de quem vê (`mostrarVoce`, `tirarVoce`) e renomear os
 *     marcadores numa língua nova (`mudarLingua`).
 */
export async function prepararNavegacao3D(app, opcoes) {
    const { rede, camara } = opcoes;
    const { registo, chao } = rede.cena;
    const resposta = await fetch(chao.ficheiro);
    if (!resposta.ok) throw new Error(chao.ficheiro + ': ' + resposta.status);
    const alturas = new Int16Array(await resposta.arrayBuffer());
    const diz = (chave, alternativa) => opcoes.diz(chave, alternativa);

    // ---- Dos graus para a cena ----
    const { s, R, t } = registo;
    const naCena = ([lat, lon]) => {
        const E = RAIO_DA_TERRA * lon * Math.PI / 180;
        const N = RAIO_DA_TERRA * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        const a = (E - t[0]) / s;
        const b = (N - t[1]) / s;
        return [R[0][0] * a + R[1][0] * b, -(R[0][1] * a + R[1][1] * b)];
    };
    // A altura do chão (o y da cena) num ponto x, z: entre os quatro
    // pontos da grelha à volta; fora dela, o da beira.
    const chaoEm = (x, z) => {
        const i = Math.min(chao.colunas - 1.001, Math.max(0, (x - chao.x0) / chao.passo));
        const j = Math.min(chao.linhas - 1.001, Math.max(0, (z - chao.z0) / chao.passo));
        const i0 = Math.floor(i);
        const j0 = Math.floor(j);
        const fi = i - i0;
        const fj = j - j0;
        const h = (jj, ii) => alturas[jj * chao.colunas + ii] * chao.escala + chao.base;
        return (h(j0, i0) * (1 - fi) + h(j0, i0 + 1) * fi) * (1 - fj) +
            (h(j0 + 1, i0) * (1 - fi) + h(j0 + 1, i0 + 1) * fi) * fj;
    };
    const noChao = ([x, z], acima) => [x, chaoEm(x, z) + acima, z];
    // Uma linha a direito pelo chão, de metro a metro (para os pontinhos
    // subirem e descerem com ele).
    const peloChao = (de, ate) => {
        const n = Math.max(1, Math.ceil(Math.hypot(ate[0] - de[0], ate[1] - de[1])));
        const pontos = [];
        for (let k = 0; k <= n; k++) {
            pontos.push(noChao([de[0] + (ate[0] - de[0]) * k / n, de[1] + (ate[1] - de[1]) * k / n], ACIMA_DO_CHAO));
        }
        return pontos;
    };

    // ---- A câmara ----
    const controlos = () => camara.script && camara.script.cameraControls;
    const tecto = () => {
        const c = controlos();
        return Math.min((c ? c.alturaMaxima() : Infinity) - 0.5, 400);
    };
    // Se de um sítio se vê outro sem um morro pelo meio. Só conta o chão, e
    // até três quartos do caminho: as casas não tapam o percurso, que é
    // desenhado por cima de tudo.
    const veDali = (de, para) => {
        const dx = para[0] - de[0];
        const dy = para[1] - de[1];
        const dz = para[2] - de[2];
        const passos = Math.ceil(Math.hypot(dx, dz) / 4);
        for (let k = 1; k < passos * 0.75; k++) {
            const u = k / passos;
            if (de[1] + dy * u < chaoEm(de[0] + dx * u, de[2] + dz * u) + ACIMA_DO_MORRO) return false;
        }
        return true;
    };
    // Para onde olha a câmara (o rumo, em graus) a partir de uma direção no
    // chão, com a convenção dela: o rumo 0 olha para -z.
    const rumoDe = (ux, uz) => Math.atan2(-ux, -uz) * 180 / Math.PI;
    const ponto3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    // Os eixos de uma câmara que olha na direção u (no chão) com uma
    // inclinação: a frente, a direita e o cima.
    const eixos = (u, graus) => {
        const th = graus * Math.PI / 180;
        const frente = [u[0] * Math.cos(th), -Math.sin(th), u[1] * Math.cos(th)];
        const direita = [-u[1], 0, u[0]];
        const cima = [
            -direita[2] * frente[1],
            direita[2] * frente[0] - direita[0] * frente[2],
            direita[0] * frente[1]
        ];
        return { frente, direita, cima };
    };

    // A parte do ecrã que fica livre (sem o painel e o cabeçalho), de -1 a
    // 1, com uma margem para os nomes dos marcadores caberem; e a abertura
    // da câmara.
    const zonaLivre = () => {
        const tela = app.graphicsDevice.canvas;
        const largura = Math.max(1, tela.clientWidth);
        const altura = Math.max(1, tela.clientHeight);
        const f = opcoes.folgas ? opcoes.folgas() : { esquerda: 0, cima: 0, direita: 0, baixo: 0 };
        const tanV = Math.tan((camara.camera.fov || 60) * Math.PI / 360);
        return {
            tanV,
            tanH: tanV * largura / altura,
            xMin: -1 + 2 * (f.esquerda + 44) / largura,
            xMax: 1 - 2 * (f.direita + 44) / largura,
            yMin: -1 + 2 * (f.baixo + 32) / altura,
            yMax: 1 - 2 * (f.cima + 40) / altura
        };
    };

    /**
     * A câmara mais à frente, virada de uma certa maneira, de onde se vêem
     * os pontos todos dentro da zona livre do ecrã — sem passar da altura
     * máxima, nem ficar a menos de ALTURA_MINIMA do chão.
     *
     * Cada lado da zona livre é um plano que passa pela câmara; um ponto
     * vê-se se ficar do lado de dentro dos quatro. Com a câmara virada
     * sempre da mesma maneira, isso dá, para cada lado, um limite a onde ela
     * pode estar (n·c ≤ m), e as alturas dão mais dois. O sítio mais à
     * frente que respeita os seis está num canto, onde três deles se
     * encontram: vêem-se os cantos todos e fica-se com o melhor.
     *
     * @returns {number[]|null} A posição, ou nada se não houver nenhuma.
     */
    const maisAFrente = (pontos, e, z, piso, limite) => {
        const { frente, direita, cima } = e;
        const normais = [
            direita.map((v, i) => v - z.xMin * z.tanH * frente[i]),
            direita.map((v, i) => z.xMax * z.tanH * frente[i] - v),
            cima.map((v, i) => v - z.yMin * z.tanV * frente[i]),
            cima.map((v, i) => z.yMax * z.tanV * frente[i] - v)
        ];
        const limites = normais.map((n) => Math.min(...pontos.map((p) => ponto3(n, p))));
        normais.push([0, 1, 0], [0, -1, 0]);
        limites.push(limite, -piso);
        let melhor = null;
        let melhorFrente = -Infinity;
        for (let a = 0; a < 6; a++) {
            for (let b = a + 1; b < 6; b++) {
                for (let c = b + 1; c < 6; c++) {
                    const [n1, n2, n3] = [normais[a], normais[b], normais[c]];
                    // Os três planos encontram-se num ponto (regra de Cramer).
                    const det = n1[0] * (n2[1] * n3[2] - n2[2] * n3[1]) -
                        n1[1] * (n2[0] * n3[2] - n2[2] * n3[0]) +
                        n1[2] * (n2[0] * n3[1] - n2[1] * n3[0]);
                    if (Math.abs(det) < 1e-9) continue;
                    const [m1, m2, m3] = [limites[a], limites[b], limites[c]];
                    const x = (m1 * (n2[1] * n3[2] - n2[2] * n3[1]) - n1[1] * (m2 * n3[2] - n2[2] * m3) + n1[2] * (m2 * n3[1] - n2[1] * m3)) / det;
                    const y = (n1[0] * (m2 * n3[2] - n2[2] * m3) - m1 * (n2[0] * n3[2] - n2[2] * n3[0]) + n1[2] * (n2[0] * m3 - m2 * n3[0])) / det;
                    const zz = (n1[0] * (n2[1] * m3 - m2 * n3[1]) - n1[1] * (n2[0] * m3 - m2 * n3[0]) + m1 * (n2[0] * n3[1] - n2[1] * n3[0])) / det;
                    const q = [x, y, zz];
                    if (!normais.every((n, i) => ponto3(n, q) <= limites[i] + 1e-6)) continue;
                    const quanto = ponto3(frente, q);
                    if (quanto > melhorFrente) {
                        melhorFrente = quanto;
                        melhor = q;
                    }
                }
            }
        }
        return melhor;
    };

    // Onde caem os pontos no ecrã, de -1 a 1, vistos de q com os eixos e;
    // e o retângulo que os contém (nada, se algum ficar para trás).
    const noRetangulo = (pontos, q, e, z) => {
        const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
        for (const p of pontos) {
            const v = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
            const fundo = ponto3(v, e.frente);
            if (fundo < 0.5) return null;
            const x = ponto3(v, e.direita) / (fundo * z.tanH);
            const y = ponto3(v, e.cima) / (fundo * z.tanV);
            r.x0 = Math.min(r.x0, x);
            r.x1 = Math.max(r.x1, x);
            r.y0 = Math.min(r.y0, y);
            r.y1 = Math.max(r.y1, y);
        }
        return r;
    };
    const dentro = (r, z) => !!r && r.x0 >= z.xMin - 1e-3 && r.x1 <= z.xMax + 1e-3 && r.y0 >= z.yMin - 1e-3 && r.y1 <= z.yMax + 1e-3;
    const direcaoDoRumo = (rumo) => [-Math.sin(rumo * Math.PI / 180), -Math.cos(rumo * Math.PI / 180)];

    /**
     * A câmara que mostra o percurso todo o mais de perto possível: olha
     * da entrada para a casa, ou ao longo do percurso (num ecrã ao alto,
     * estreito, é o que o deixa caber), ou um pouco de lado; inclinada entre
     * INCLINACOES; e com tudo dentro da parte do ecrã que o painel e o
     * cabeçalho não tapam, ao meio dela.
     *
     * @returns {{posicao: number[], inclinacao: number, rumo: number}|null}
     */
    const cameraQueMostra = (pontos, u) => {
        const z = zonaLivre();
        if (z.xMax - z.xMin < 0.2 || z.yMax - z.yMin < 0.2) return null;
        const passo = Math.max(1, Math.floor(pontos.length / 60));
        const amostra = pontos.filter((_, i) => i % passo === 0).concat([pontos[pontos.length - 1]]);
        const centro = [0, 1, 2].map((i) => amostra.reduce((soma, p) => soma + p[i], 0) / amostra.length);
        const limite = tecto();
        const pisoDoPercurso = Math.min(...amostra.map((p) => p[1])) + ALTURA_MINIMA;

        // Os rumos a experimentar: o da entrada para a casa, o comprido do
        // percurso (o eixo para onde ele mais se estende), e uns desvios.
        let sxx = 0;
        let szz = 0;
        let sxz = 0;
        for (const p of amostra) {
            const dx = p[0] - centro[0];
            const dz = p[2] - centro[2];
            sxx += dx * dx;
            szz += dz * dz;
            sxz += dx * dz;
        }
        const eixo = 0.5 * Math.atan2(2 * sxz, sxx - szz);
        let aoComprido = [Math.cos(eixo), Math.sin(eixo)];
        if (aoComprido[0] * u[0] + aoComprido[1] * u[1] < 0) aoComprido = [-aoComprido[0], -aoComprido[1]];
        const anguloDe = (d) => Math.atan2(d[1], d[0]);
        const rumos = DESVIOS.map((desvio) => ({ a: anguloDe(u) + desvio * Math.PI / 180, desvio: Math.abs(desvio) }));
        const diferenca = anguloDe(aoComprido) - anguloDe(u);
        const doEixo = Math.abs(Math.atan2(Math.sin(diferenca), Math.cos(diferenca))) * 180 / Math.PI;
        if (doEixo > 10) {
            for (const desvio of [0, -20, 20]) {
                rumos.push({ a: anguloDe(aoComprido) + desvio * Math.PI / 180, desvio: doEixo + Math.abs(desvio) / 2 });
            }
        }

        let melhor = null;
        for (const { a, desvio } of rumos) {
            const ud = [Math.cos(a), Math.sin(a)];
            for (const graus of INCLINACOES) {
                const e = eixos(ud, graus);
                // O chão por baixo da câmara não se sabe antes de saber onde
                // ela fica: tenta-se, e sobe-se o piso se for preciso.
                let piso = pisoDoPercurso;
                let q = null;
                for (let k = 0; k < 4; k++) {
                    q = maisAFrente(amostra, e, z, piso, limite);
                    if (!q) break;
                    const precisa = chaoEm(q[0], q[2]) + ALTURA_MINIMA;
                    if (q[1] >= precisa - 0.1) break;
                    piso = precisa;
                    q = null;
                }
                if (!q || !veDali(q, centro) || !veDali(q, amostra[amostra.length - 1])) continue;
                // De todas as que cabem, a mais perto do percurso, com algum
                // gosto por olhar da entrada para a casa e por não ficar a
                // pique por cima dele.
                const nota = Math.hypot(q[0] - centro[0], q[1] - centro[1], q[2] - centro[2]) *
                    (1 + 0.005 * desvio) * (1 + 0.012 * Math.max(0, graus - 50));
                if (!melhor || nota < melhor.nota) {
                    melhor = { nota, posicao: q, inclinacao: -graus, rumo: rumoDe(ud[0], ud[1]) };
                }
            }
        }
        if (!melhor) return null;

        // O percurso fica encostado a um lado da zona livre (a câmara mais à
        // frente é a que lhe toca): roda-se um nada, para ficar ao meio.
        let { inclinacao, rumo } = melhor;
        const angulo = (v, tan) => Math.atan(v * tan) * 180 / Math.PI;
        for (let k = 0; k < 3; k++) {
            const r = noRetangulo(amostra, melhor.posicao, eixos(direcaoDoRumo(rumo), -inclinacao), z);
            if (!r) break;
            const acima = angulo((r.y0 + r.y1) / 2, z.tanV) - angulo((z.yMin + z.yMax) / 2, z.tanV);
            const aDireita = angulo((r.x0 + r.x1) / 2, z.tanH) - angulo((z.xMin + z.xMax) / 2, z.tanH);
            inclinacao = Math.max(-80, Math.min(-25, inclinacao + acima));
            rumo -= aDireita / Math.max(0.3, Math.cos(inclinacao * Math.PI / 180));
        }
        if (dentro(noRetangulo(amostra, melhor.posicao, eixos(direcaoDoRumo(rumo), -inclinacao), z), z)) {
            melhor.inclinacao = inclinacao;
            melhor.rumo = rumo;
        }
        return melhor;
    };

    /**
     * Quando nem um pedaço do percurso cabe: do mais alto que a câmara pode
     * ir, com um sítio (a casa, ou quem está a ver) no meio da zona livre do
     * ecrã.
     */
    const cameraDeRecurso = (alvo, u) => {
        const z = zonaLivre();
        const e = eixos(u, INCLINACAO_DE_RECURSO);
        const xc = (z.xMin + z.xMax) / 2;
        const yc = (z.yMin + z.yMax) / 2;
        const d = [0, 1, 2].map((i) => e.frente[i] + xc * z.tanH * e.direita[i] + yc * z.tanV * e.cima[i]);
        const y = Math.max(tecto(), alvo[1] + ALTURA_MINIMA);
        const t = (y - alvo[1]) / Math.max(0.05, -d[1]);
        return { posicao: [alvo[0] - t * d[0], y, alvo[2] - t * d[2]], inclinacao: -INCLINACAO_DE_RECURSO, rumo: rumoDe(u[0], u[1]) };
    };

    // ---- O percurso ----
    let atual = null;

    /**
     * Leva a câmara até onde se vê o percurso todo, a olhar do princípio
     * para a casa — como quem vai entrar no bairro. Num ecrã pequeno, um
     * percurso muito comprido pode não caber: mostra-se então o pedaço mais
     * comprido que couber. Da entrada, é o fim, com a casa (a entrada é numa
     * estrada, e lá chega-se com o "Como chegar à entrada"); de onde a
     * pessoa está, com a localização ligada, é o princípio, com ela — é por
     * aí que ela vai começar a andar.
     */
    const enquadrar = () => {
        const c = controlos();
        if (!atual || !c || typeof c.viajar !== 'function') return;
        const { linha, acum, alvo, aqui, daqui } = atual;
        const direcao = (de, para) => {
            let dx = para[0] - de[0];
            let dz = para[2] - de[2];
            if (Math.hypot(dx, dz) < 1) {
                dx = camara.forward.x;
                dz = camara.forward.z;
            }
            const n = Math.hypot(dx, dz) || 1;
            return [dx / n, dz / n];
        };
        // De onde a pessoa está, quando é daí que o percurso começa.
        const comeco = aqui ? [aqui].concat(linha) : linha;
        let vista = cameraQueMostra(comeco.concat([alvo]), direcao(comeco[0], alvo));
        const total = acum[acum.length - 1];
        for (let parte = 0.15; !vista && parte < 0.95; parte += 0.15) {
            if (daqui) {
                const k = acum.findIndex((d) => d >= total * (1 - parte));
                if (k < 2) break;
                const pedaco = comeco.slice(0, k + 1 + comeco.length - linha.length);
                vista = cameraQueMostra(pedaco, direcao(pedaco[0], pedaco[pedaco.length - 1]));
                if (vista) vista.ate = k;
            } else {
                const k = acum.findIndex((d) => d >= total * parte);
                if (k < 0 || k >= linha.length - 1) break;
                vista = cameraQueMostra(linha.slice(k).concat([alvo]), direcao(linha[k], alvo));
                if (vista) vista.desde = k;
            }
        }
        if (!vista) {
            const onde = daqui ? comeco[0] : alvo;
            const de = daqui ? comeco[0] : linha[Math.max(0, linha.length - 8)];
            const para = daqui ? linha[Math.min(linha.length - 1, 8)] : alvo;
            vista = cameraDeRecurso(onde, direcao(de, para));
        }
        atual.vista = vista;
        c.viajar(new Vec3(vista.posicao[0], vista.posicao[1], vista.posicao[2]), vista.inclinacao, vista.rumo, DURACAO_DA_VIAGEM);
    };

    /**
     * Leva a câmara a ver um sítio de perto, a olhar numa direção.
     *
     * @param {number[]} ponto - O sítio, na cena.
     * @param {number[]} u - Para onde se olha, no chão (x, z), de comprimento 1.
     */
    const verDePerto = (ponto, u) => {
        const c = controlos();
        if (!c || typeof c.viajar !== 'function') return;
        const th = INCLINACAO_DE_PERTO * Math.PI / 180;
        let recuo = DE_PERTO * Math.cos(th);
        let cy = Math.min(tecto(), ponto[1] + DE_PERTO * Math.sin(th));
        // Mais acima e mais a pique se um morro ou uma casa taparem a vista.
        for (let k = 0; k < 6; k++) {
            if (veDali([ponto[0] - u[0] * recuo, cy, ponto[2] - u[1] * recuo], ponto)) break;
            cy = Math.min(tecto(), cy + 6);
            recuo *= 0.85;
        }
        const posicao = new Vec3(ponto[0] - u[0] * recuo, cy, ponto[2] - u[1] * recuo);
        const inclinacao = -Math.atan2(cy - ponto[1], Math.max(1, recuo)) * 180 / Math.PI;
        c.viajar(posicao, inclinacao, rumoDe(u[0], u[1]), 1.4);
    };

    // O ponto da linha a uma distância do princípio, e para onde ela vai ali
    // (dos 4 metros antes aos 8 metros depois).
    const naLinha = (distancia) => {
        const { linha, acum } = atual;
        const d = Math.max(0, Math.min(acum[acum.length - 1], distancia));
        let k = 1;
        while (k < acum.length - 1 && acum[k] < d) k++;
        const a = linha[k - 1];
        const b = linha[k] || a;
        const L = acum[k] - acum[k - 1];
        const f = L ? (d - acum[k - 1]) / L : 0;
        const ponto = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        let ka = k;
        while (ka > 1 && acum[ka - 1] > d - 4) ka--;
        let kb = k;
        while (kb < acum.length - 1 && acum[kb] < d + 8) kb++;
        let ux = linha[kb][0] - linha[ka - 1][0];
        let uz = linha[kb][2] - linha[ka - 1][2];
        if (Math.hypot(ux, uz) < 0.01) {
            ux = camara.forward.x;
            uz = camara.forward.z;
        }
        const m = Math.hypot(ux, uz) || 1;
        return { ponto, u: [ux / m, uz / m] };
    };

    /** Vai ver a casa de perto, a chegar pelo fim do percurso. */
    const verCasa = () => {
        if (!atual) return;
        const { linha, alvo } = atual;
        const fim = linha[linha.length - 1];
        let u = [alvo[0] - fim[0], alvo[2] - fim[2]];
        const n = Math.hypot(u[0], u[1]);
        u = n < 3 ? naLinha(Infinity).u : [u[0] / n, u[1] / n];
        verDePerto(alvo, u);
    };

    /**
     * Vai ver de perto um passo das indicações.
     *
     * @param {object} passo - O passo (com `desde`, os metros do princípio
     *     do percurso até onde ele começa).
     */
    const verPasso = (passo) => {
        if (!atual) return;
        if (passo.acao === 'chegada') {
            verCasa();
            return;
        }
        // A linha alisada é um nada mais curta do que o traçado de onde
        // saiu: o sítio do passo vai na mesma proporção.
        const proporcao = atual.acum[atual.acum.length - 1] / Math.max(1, atual.comprimento);
        const { ponto, u } = naLinha((passo.desde || 0) * proporcao);
        verDePerto(ponto, u);
    };

    // ---- O desenho: a linha e os marcadores ----
    //
    // Tudo numa camada da página por cima do bairro: a linha num desenho
    // (svg) do tamanho do ecrã, e os marcadores — o número da casa, a
    // entrada, quem está a ver — como os dos testemunhos (ver
    // annotations.mjs). Carregar num marcador leva a câmara a vê-lo de
    // perto. Para quem não vê o ecrã têm um nome que diz o que são, são
    // botões na fila do Tab, e saem dela (aria-hidden, tabindex -1) quando
    // ficam fora da vista — as regras de AGENTS.md para tudo o que se põe no
    // mapa.
    const camada = document.createElement('div');
    camada.id = 'percurso-3d';
    document.body.appendChild(camada);
    const SVG = 'http://www.w3.org/2000/svg';
    const desenho = document.createElementNS(SVG, 'svg');
    desenho.setAttribute('class', 'percurso-traco');
    desenho.setAttribute('aria-hidden', 'true');
    camada.appendChild(desenho);
    const traco = (largura, cor, opacidade, pontinhos) => {
        const p = document.createElementNS(SVG, 'path');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', cor);
        p.setAttribute('stroke-width', largura);
        p.setAttribute('stroke-opacity', opacidade);
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        if (pontinhos) p.setAttribute('stroke-dasharray', '0.1 ' + ENTRE_PONTOS);
        desenho.appendChild(p);
        return p;
    };
    // Os contornos primeiro, por baixo dos dois brancos.
    const tracos = {
        linha: [traco(CONTORNO, ESCURO, OPACIDADE_DO_ESCURO, false), traco(LINHA, BRANCO, 1, false)],
        pontinhos: [traco(CONTORNO_DO_PONTO, ESCURO, OPACIDADE_DO_ESCURO, true), traco(PONTO, BRANCO, 1, true)]
    };
    desenho.insertBefore(tracos.pontinhos[0], tracos.linha[1]);
    const escritos = { linha: '', pontinhos: '' };
    const escrever = (qual, d) => {
        if (escritos[qual] === d) return;
        escritos[qual] = d;
        for (const p of tracos[qual]) p.setAttribute('d', d);
    };

    // Do bairro para o ecrã, com a vista e a perspetiva que a câmara tem
    // nesta imagem (o motor refá-las antes de cada uma).
    const ecra = { largura: 1, altura: 1, vista: null, perspetiva: null };
    const prepararEcra = () => {
        const tela = app.graphicsDevice.canvas;
        ecra.largura = tela.clientWidth;
        ecra.altura = tela.clientHeight;
        ecra.vista = camara.camera.viewMatrix.data;
        ecra.perspetiva = camara.camera.projectionMatrix.data;
    };
    // Um ponto do bairro visto da câmara: [x, y, quanto está à frente dela].
    const naCamara = (q) => {
        const v = ecra.vista;
        return [
            v[0] * q[0] + v[4] * q[1] + v[8] * q[2] + v[12],
            v[1] * q[0] + v[5] * q[1] + v[9] * q[2] + v[13],
            -(v[2] * q[0] + v[6] * q[1] + v[10] * q[2] + v[14])
        ];
    };
    // Um ponto à frente da câmara, no ecrã, em pontos.
    const noEcra = (c) => {
        const p = ecra.perspetiva;
        const z = -c[2];
        const x = p[0] * c[0] + p[4] * c[1] + p[8] * z + p[12];
        const y = p[1] * c[0] + p[5] * c[1] + p[9] * z + p[13];
        const w = p[3] * c[0] + p[7] * c[1] + p[11] * z + p[15];
        return [(x / w + 1) * 0.5 * ecra.largura, (1 - y / w) * 0.5 * ecra.altura];
    };
    // Uma linha do bairro como caminho no ecrã (o "d" de um path), cortada
    // onde passa para trás da câmara.
    const caminhoNoEcra = (pontos) => {
        let d = '';
        let ultimo = null;
        const por = (c, novo) => {
            const s = noEcra(c);
            // Pontos a menos de um ponto do anterior não se notam.
            if (!novo && Math.abs(s[0] - ultimo[0]) < 1 && Math.abs(s[1] - ultimo[1]) < 1) return;
            d += (novo ? 'M' : 'L') + s[0].toFixed(1) + ' ' + s[1].toFixed(1);
            ultimo = s;
        };
        let antes = null;
        for (const q of pontos) {
            const c = naCamara(q);
            const aFrente = c[2] >= PERTO_DE_MAIS;
            if (antes && (antes[2] >= PERTO_DE_MAIS) !== aFrente) {
                // Onde a linha atravessa o plano à frente da câmara.
                const k = (antes[2] - PERTO_DE_MAIS) / (antes[2] - c[2]);
                por([antes[0] + (c[0] - antes[0]) * k, antes[1] + (c[1] - antes[1]) * k, PERTO_DE_MAIS], aFrente);
            }
            if (aFrente) por(c, !antes);
            antes = c;
        }
        return d;
    };

    const fazerMarcador = (classe, texto, ponto, acao) => {
        const el = document.createElement('div');
        el.className = classe + ' fora';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '-1');
        el.setAttribute('aria-hidden', 'true');
        const rotulo = document.createElement('span');
        rotulo.setAttribute('aria-hidden', 'true');
        rotulo.textContent = texto;
        el.appendChild(rotulo);
        el.addEventListener('click', acao);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                acao();
            }
        });
        camada.appendChild(el);
        return { el, rotulo, ponto, visto: false };
    };
    // Os do percurso (a entrada, se ele começar nela, e a casa), e o de
    // quem está a ver, que fica enquanto a localização estiver ligada.
    let marcadores = { entrada: null, casa: null };
    let voce = null;
    const nomear = () => {
        const numero = atual ? atual.casa.n : '';
        if (marcadores.entrada) {
            marcadores.entrada.el.setAttribute('aria-label', preencher(diz('nav.marcadorEntrada', 'Entrada do bairro, onde começa o percurso até à casa {numero}'), { numero }));
            marcadores.entrada.rotulo.textContent = diz('nav.entrada', 'Entrada');
        }
        if (marcadores.casa) {
            marcadores.casa.el.setAttribute('aria-label', preencher(diz('nav.marcadorCasa', 'Casa {numero}, onde acaba o percurso'), { numero }));
        }
        if (voce) {
            voce.el.setAttribute('aria-label', diz('nav.marcadorVoce', 'Está aqui: o sítio onde está agora'));
            voce.rotulo.textContent = diz('nav.voce', 'Está aqui');
        }
    };
    const tirarMarcadores = () => {
        for (const m of Object.values(marcadores)) if (m) m.el.remove();
        marcadores = { entrada: null, casa: null };
    };

    // Antes de cada imagem ser desenhada, com a câmara já no sítio dela.
    app.on('prerender', () => {
        const todos = [marcadores.entrada, marcadores.casa, voce].filter(Boolean);
        if (!atual && !todos.length) return;
        prepararEcra();
        escrever('linha', atual ? caminhoNoEcra(atual.linha) : '');
        escrever('pontinhos', atual ? atual.pontinhos.map(caminhoNoEcra).join('') : '');
        for (const m of todos) {
            const c = naCamara(m.ponto);
            const s = c[2] > 1 ? noEcra(c) : null;
            const ve = !!s && s[0] > -40 && s[0] < ecra.largura + 40 && s[1] > -40 && s[1] < ecra.altura + 40;
            if (ve !== m.visto) {
                m.visto = ve;
                m.el.classList.toggle('fora', !ve);
                if (ve) {
                    m.el.removeAttribute('aria-hidden');
                    m.el.setAttribute('tabindex', '0');
                } else {
                    // Um marcador que não se vê não está no mapa, e por isso
                    // também não pode estar na fila do Tab.
                    m.el.setAttribute('aria-hidden', 'true');
                    m.el.setAttribute('tabindex', '-1');
                    if (m.el === document.activeElement) m.el.blur();
                }
            }
            if (ve) m.el.style.transform = 'translate3d(' + s[0].toFixed(1) + 'px, ' + s[1].toFixed(1) + 'px, 0)';
        }
    });

    // Para onde a câmara está a olhar, no chão.
    const frenteDaCamara = () => {
        const f = camara.forward;
        const n = Math.hypot(f.x, f.z) || 1;
        return [f.x / n, f.z / n];
    };

    /**
     * Põe no bairro o sítio de quem está a ver (com a localização ligada),
     * se for no bairro ou perto dele.
     *
     * @param {number} lat
     * @param {number} lon
     * @returns {boolean} Se ficou no bairro (se não, não se mostra).
     */
    const mostrarVoce = (lat, lon) => {
        const perto = rede.maisPerto(lat, lon);
        if (!perto || perto.distancia > LONGE_DO_BAIRRO_M) {
            tirarVoce();
            return false;
        }
        const ponto = noChao(naCena([lat, lon]), 1);
        if (voce) voce.ponto = ponto;
        else voce = fazerMarcador('voce-3d', '', ponto, () => verDePerto(voce.ponto, frenteDaCamara()));
        nomear();
        return true;
    };
    const tirarVoce = () => {
        if (voce) voce.el.remove();
        voce = null;
    };

    /**
     * Mostra o percurso até uma casa: de onde quem vê está, se se souber e
     * for perto; senão, da entrada do bairro mais perto dela. A linha, os
     * marcadores, e a câmara a ir até onde se vê tudo.
     *
     * @param {object} casa - A casa (de rede.json).
     * @param {object} [como] - `aqui` ({lat, lon}: onde a pessoa está) e
     *     `enquadrar` (se a câmara vai até ao percurso; sim, se não se
     *     disser).
     * @returns {object|null} O percurso: `passos` (as indicações, ver
     *     Rede.indicacoes, cada uma com `desde`), `metros`, `minutos`,
     *     `entrada` (o sítio da entrada, [lat, lon], se começar nela) e
     *     `longe` (se a pessoa está longe de mais para começar onde está).
     */
    const mostrar = (casa, { aqui = null, enquadrar: mover = true } = {}) => {
        let origem = null;
        let inicio = null;
        let ligacao = null;
        let longe = false;
        if (aqui) {
            const perto = rede.maisPerto(aqui.lat, aqui.lon);
            if (perto && perto.distancia <= LONGE_DO_BAIRRO_M) {
                origem = { troco: perto.troco, ao: perto.ao };
                inicio = { tipo: 'aqui' };
                if (perto.distancia > FORA_DA_REDE_M) ligacao = [naCena([aqui.lat, aqui.lon]), naCena(perto.ponto)];
            } else {
                longe = true;
            }
        }
        if (!origem) {
            const ent = rede.entradaPara(casa.no);
            origem = { no: ent ? ent.no : casa.no };
            inicio = { tipo: 'entrada', rua: ent ? ent.rua : '' };
        }
        const perc = rede.caminho(origem, casa.no);
        if (!perc) return null;
        const passos = rede.indicacoes(perc, casa, inicio);
        // Onde começa cada passo, em metros desde o princípio.
        let andado = 0;
        for (const p of passos) {
            p.desde = andado;
            if (p.acao !== 'inicio' && p.acao !== 'chegada') andado += p.metros || 0;
        }

        const linha = alisar(perc.pontos.map(naCena), ALISAR_M).map((q) => noChao(q, ACIMA_DO_CHAO));
        const acum = [0];
        for (let i = 1; i < linha.length; i++) {
            acum.push(acum[i - 1] + Math.hypot(linha[i][0] - linha[i - 1][0], linha[i][2] - linha[i - 1][2]));
        }
        const [cx, cz] = naCena(casa.ponto);
        const telhado = casa.alto != null ? casa.alto + ACIMA_DO_TELHADO : chaoEm(cx, cz) + ACIMA_DO_CHAO_SEM_TELHADO;
        const alvo = [cx, telhado, cz];
        // A pontinhos: do fim da linha ao meio da casa (se ela não ficar
        // mesmo ao pé), e de onde a pessoa está até ao caminho.
        const fim = linha[linha.length - 1];
        const pontinhos = [];
        if (Math.hypot(cx - fim[0], cz - fim[2]) > 3) pontinhos.push(peloChao([fim[0], fim[2]], [cx, cz]));
        if (ligacao) pontinhos.push(peloChao(ligacao[0], ligacao[1]));

        const porta = naCena(casa.porta);
        const total = perc.comprimento + Math.hypot(porta[0] - fim[0], porta[1] - fim[2]);
        atual = {
            casa,
            passos,
            linha,
            acum,
            alvo,
            pontinhos,
            comprimento: perc.comprimento,
            metros: arredondar(total),
            minutos: Math.max(1, Math.round(total / METROS_POR_MINUTO)),
            entrada: inicio.tipo === 'entrada' ? perc.pontos[0] : null,
            daqui: inicio.tipo === 'aqui',
            longe,
            // De onde a pessoa está, quando o percurso começa aí: entra no
            // enquadramento.
            aqui: ligacao ? noChao(ligacao[0], 1) : null
        };

        tirarMarcadores();
        if (inicio.tipo === 'entrada') marcadores.entrada = fazerMarcador('inicio-3d', '', linha[0], () => verPasso(passos[0]));
        marcadores.casa = fazerMarcador('destino-3d', casa.n, alvo, verCasa);
        nomear();

        if (mover) enquadrar();
        return atual;
    };

    /** Tira o percurso e os seus marcadores. */
    const limpar = () => {
        tirarMarcadores();
        atual = null;
        escrever('linha', '');
        escrever('pontinhos', '');
    };

    return { mostrar, limpar, enquadrar, verPasso, mostrarVoce, tirarVoce, mudarLingua: nomear, atual: () => atual };
}
