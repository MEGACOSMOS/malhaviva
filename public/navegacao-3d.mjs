/**
 * A navegação no bairro em 3D: o percurso até uma casa desenhado por cima
 * do bairro de Gaussian splats, com o número da casa por cima do telhado e
 * a entrada marcada, e a câmara a ir até um sítio de onde se vê tudo.
 *
 * O percurso é o mesmo da página da navegação (navegacao.html), com as
 * mesmas contas (navegacao.mjs): aqui só muda o desenho. As ruas e as casas
 * vêm em graus (latitude e longitude); a cena do site tem os seus eixos — x
 * para leste, z para sul, y para cima, em metros. A passagem é a do registo
 * do ortofotomapa, e o chão do bairro na cena (a altura de cada ponto) vem
 * em navegacao/chao.bin; os dois são feitos por
 * scripts/navegacao/reconhecer.py.
 *
 * A linha é desenhada como a pirâmide de onde se carrega (ver
 * camera-controls.mjs): na última camada, por cima de tudo. O bairro de
 * splats é pintado depois das coisas sólidas e tapava-a; assim vê-se
 * sempre, mesmo por baixo de um beiral.
 */
import { Color, Entity, Mesh, MeshInstance, StandardMaterial, Vec3, BLEND_NORMAL, CULLFACE_NONE } from 'playcanvas';
import { alisar, arredondar, preencher, METROS_POR_MINUTO } from './navegacao.mjs?v=6';

// Quanto se alisa a linha, em metros (como na página da navegação).
const ALISAR_M = 4;
// A linha fica um nada acima do chão, com esta largura (o branco) e este
// contorno escuro à volta, em metros.
const ACIMA_DO_CHAO = 0.35;
const LARGURA = 1.6;
const LARGURA_DO_CONTORNO = 2.6;
// Do fim da linha até à casa, a tracejado: um traço deste comprimento e
// desta largura (mais o contorno) a cada PASSO_DOS_TRACOS metros.
const TRACO = 1.1;
const LARGURA_DO_TRACO = 0.6;
const CONTORNO_DO_TRACO = 1.1;
const PASSO_DOS_TRACOS = 2.6;
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
const BRANCO = [255, 255, 255, 255];
const ESCURO = [5, 5, 10, 255];

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
 *     (`enquadrar`), ir ver um passo de perto (`verPasso`) e renomear os
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

    // ---- O desenho ----
    //
    // Uma fita deitada no chão, que segue os pontos: o contorno escuro
    // primeiro e o branco por cima, com as pontas redondas. Tudo numa malha
    // só, desenhada pela ordem dos triângulos.
    const material = new StandardMaterial();
    material.useLighting = false;
    material.diffuse = new Color(0, 0, 0);
    material.emissive = new Color(1, 1, 1);
    material.emissiveVertexColor = true;
    material.cull = CULLFACE_NONE;
    material.depthTest = false;
    material.depthWrite = false;
    material.blendType = BLEND_NORMAL;
    material.update();
    const camada = app.scene.layers.getLayerByName('UI') || app.scene.layers.getLayerByName('World');
    let entidade = null;

    const fita = (pontos, largura, cor, posicoes, cores, indices) => {
        const n = pontos.length;
        if (n < 2) return;
        const meia = largura / 2;
        const base = posicoes.length / 3;
        for (let i = 0; i < n; i++) {
            const a = pontos[Math.max(0, i - 1)];
            const b = pontos[Math.min(n - 1, i + 1)];
            const L = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
            const dx = (b[0] - a[0]) / L;
            const dz = (b[2] - a[2]) / L;
            const p = pontos[i];
            posicoes.push(p[0] - dz * meia, p[1], p[2] + dx * meia, p[0] + dz * meia, p[1], p[2] - dx * meia);
            cores.push(...cor, ...cor);
        }
        for (let i = 0; i < n - 1; i++) {
            const k = base + 2 * i;
            indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
        // As pontas: meio círculo em cada uma.
        for (const [i, vizinho] of [[0, 1], [n - 1, n - 2]]) {
            const p = pontos[i];
            const q = pontos[vizinho];
            const fora = Math.atan2(p[2] - q[2], p[0] - q[0]);
            const centro = posicoes.length / 3;
            posicoes.push(p[0], p[1], p[2]);
            cores.push(...cor);
            const passos = 8;
            for (let k = 0; k <= passos; k++) {
                const angulo = fora - Math.PI / 2 + Math.PI * k / passos;
                posicoes.push(p[0] + Math.cos(angulo) * meia, p[1], p[2] + Math.sin(angulo) * meia);
                cores.push(...cor);
                if (k > 0) indices.push(centro, centro + k, centro + k + 1);
            }
        }
    };

    const tirarDesenho = () => {
        if (!entidade) return;
        const malha = entidade.render.meshInstances[0].mesh;
        entidade.destroy();
        malha.destroy();
        entidade = null;
    };
    const desenhar = (linha, tracos) => {
        tirarDesenho();
        const posicoes = [];
        const cores = [];
        const indices = [];
        for (const traco of tracos) fita(traco, CONTORNO_DO_TRACO, ESCURO, posicoes, cores, indices);
        fita(linha, LARGURA_DO_CONTORNO, ESCURO, posicoes, cores, indices);
        for (const traco of tracos) fita(traco, LARGURA_DO_TRACO, BRANCO, posicoes, cores, indices);
        fita(linha, LARGURA, BRANCO, posicoes, cores, indices);
        if (!indices.length) return;
        const malha = new Mesh(app.graphicsDevice);
        malha.setPositions(posicoes);
        malha.setColors32(cores);
        malha.setIndices(indices);
        malha.update();
        entidade = new Entity('percurso-ate-a-casa');
        entidade.addComponent('render', {
            meshInstances: [new MeshInstance(malha, material)],
            layers: camada ? [camada.id] : undefined,
            castShadows: false,
            receiveShadows: false
        });
        app.root.addChild(entidade);
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
    // 1, com uma margem; e a abertura da câmara.
    const zonaLivre = () => {
        const tela = app.graphicsDevice.canvas;
        const largura = Math.max(1, tela.clientWidth);
        const altura = Math.max(1, tela.clientHeight);
        const f = opcoes.folgas ? opcoes.folgas() : { esquerda: 0, cima: 0, direita: 0, baixo: 0 };
        const tanV = Math.tan((camara.camera.fov || 60) * Math.PI / 360);
        return {
            tanV,
            tanH: tanV * largura / altura,
            xMin: -1 + 2 * (f.esquerda + 28) / largura,
            xMax: 1 - 2 * (f.direita + 28) / largura,
            yMin: -1 + 2 * (f.baixo + 28) / altura,
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
     * Quando nem um pedaço do fim do percurso cabe: do mais alto que a
     * câmara pode ir, com a casa no meio da zona livre do ecrã.
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
     * Leva a câmara até onde se vê o percurso todo, a olhar da entrada para
     * a casa — como quem vai entrar no bairro. Num ecrã pequeno, um
     * percurso muito comprido pode não caber: mostra-se então o fim dele, o
     * mais comprido que couber, com a casa (a entrada é numa estrada, e lá
     * chega-se pelo mapa da navegação).
     */
    const enquadrar = () => {
        const c = controlos();
        if (!atual || !c || typeof c.viajar !== 'function') return;
        const { linha, acum, alvo } = atual;
        const direcao = (de) => {
            let dx = alvo[0] - de[0];
            let dz = alvo[2] - de[2];
            if (Math.hypot(dx, dz) < 1) {
                dx = camara.forward.x;
                dz = camara.forward.z;
            }
            const n = Math.hypot(dx, dz) || 1;
            return [dx / n, dz / n];
        };
        let vista = cameraQueMostra(linha.concat([alvo]), direcao(linha[0]));
        const total = acum[acum.length - 1];
        for (let parte = 0.15; !vista && parte < 0.95; parte += 0.15) {
            const k = acum.findIndex((d) => d >= total * parte);
            if (k < 0 || k >= linha.length - 1) break;
            vista = cameraQueMostra(linha.slice(k).concat([alvo]), direcao(linha[k]));
            if (vista) vista.desde = k;
        }
        if (!vista) vista = cameraDeRecurso(alvo, direcao(linha[Math.max(0, linha.length - 8)]));
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

    // ---- Os marcadores: o número da casa e a entrada ----
    //
    // Como os dos testemunhos (ver annotations.mjs): elementos da página,
    // postos a cada imagem no sítio do ecrã onde cai o ponto do bairro.
    // Carregar num leva a câmara a vê-lo de perto. Para quem não vê o ecrã
    // têm um nome que diz o que são, são botões na fila do Tab, e saem dela
    // (aria-hidden, tabindex -1) quando ficam fora da vista — as regras de
    // AGENTS.md para tudo o que se põe no mapa.
    const camadaDosMarcadores = document.createElement('div');
    camadaDosMarcadores.id = 'percurso-3d';
    document.body.appendChild(camadaDosMarcadores);
    const marcadores = [];
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
        camadaDosMarcadores.appendChild(el);
        const marcador = { el, rotulo, ponto: new Vec3(ponto[0], ponto[1], ponto[2]), visto: false };
        marcadores.push(marcador);
        return marcador;
    };
    const nomearMarcadores = () => {
        if (!atual) return;
        const numero = atual.casa.n;
        const [entrada, destino] = marcadores;
        if (entrada) {
            entrada.el.setAttribute('aria-label', preencher(diz('nav.marcadorEntrada', 'Entrada do bairro, onde começa o percurso até à casa {numero}'), { numero }));
            entrada.rotulo.textContent = diz('nav.entrada', 'Entrada');
        }
        if (destino) {
            destino.el.setAttribute('aria-label', preencher(diz('nav.marcadorCasa', 'Casa {numero}, onde acaba o percurso'), { numero }));
        }
    };
    const tirarMarcadores = () => {
        for (const m of marcadores.splice(0)) m.el.remove();
    };
    const noEcra = new Vec3();
    const direcao = new Vec3();
    // Antes de cada imagem ser desenhada, com a câmara já no sítio dela (a
    // vista da câmara só é refeita nessa altura).
    app.on('prerender', () => {
        if (!marcadores.length) return;
        const tela = app.graphicsDevice.canvas;
        const largura = tela.clientWidth;
        const altura = tela.clientHeight;
        const posicao = camara.getPosition();
        const frente = camara.forward;
        for (const m of marcadores) {
            camara.camera.worldToScreen(m.ponto, noEcra);
            direcao.sub2(m.ponto, posicao);
            const ve = frente.dot(direcao) > 0.5 &&
                noEcra.x > -40 && noEcra.x < largura + 40 && noEcra.y > -40 && noEcra.y < altura + 40;
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
            if (ve) m.el.style.transform = 'translate3d(' + noEcra.x.toFixed(1) + 'px, ' + noEcra.y.toFixed(1) + 'px, 0)';
        }
    });

    /**
     * Mostra o percurso até uma casa, da entrada do bairro mais perto dela:
     * a linha, os marcadores, e a câmara a ir até onde se vê tudo.
     *
     * @param {object} casa - A casa (de rede.json).
     * @returns {object|null} O percurso: `passos` (as indicações, ver
     *     Rede.indicacoes, cada uma com `desde`), `metros`, `minutos` e
     *     `entrada` (o sítio da entrada, [lat, lon]).
     */
    const mostrar = (casa) => {
        const ent = rede.entradaPara(casa.no);
        const origem = { no: ent ? ent.no : casa.no };
        const perc = rede.caminho(origem, casa.no);
        if (!perc) return null;
        const passos = rede.indicacoes(perc, casa, { tipo: 'entrada', rua: ent ? ent.rua : '' });
        // Onde começa cada passo, em metros desde a entrada.
        let andado = 0;
        for (const p of passos) {
            p.desde = andado;
            if (p.acao !== 'inicio' && p.acao !== 'chegada') andado += p.metros || 0;
        }

        // A linha, alisada como na página da navegação; as contas são as
        // do traçado de origem.
        const linha = alisar(perc.pontos.map(naCena), ALISAR_M).map((q) => noChao(q, ACIMA_DO_CHAO));
        const acum = [0];
        for (let i = 1; i < linha.length; i++) {
            acum.push(acum[i - 1] + Math.hypot(linha[i][0] - linha[i - 1][0], linha[i][2] - linha[i - 1][2]));
        }
        const [cx, cz] = naCena(casa.ponto);
        const telhado = casa.alto != null ? casa.alto + ACIMA_DO_TELHADO : chaoEm(cx, cz) + ACIMA_DO_CHAO_SEM_TELHADO;
        const alvo = [cx, telhado, cz];
        // Do fim da linha ao meio do telhado, a tracejado (só se a casa
        // não ficar mesmo ao pé).
        const tracos = [];
        const fim = linha[linha.length - 1];
        const falta = Math.hypot(cx - fim[0], cz - fim[2]);
        if (falta > 3) {
            for (let d = 1.6; d + TRACO <= falta - 1; d += PASSO_DOS_TRACOS) {
                tracos.push([d, d + TRACO].map((k) => noChao([fim[0] + (cx - fim[0]) * k / falta, fim[2] + (cz - fim[2]) * k / falta], ACIMA_DO_CHAO)));
            }
        }
        desenhar(linha, tracos);

        const porta = naCena(casa.porta);
        const total = perc.comprimento + Math.hypot(porta[0] - fim[0], porta[1] - fim[2]);
        atual = {
            casa,
            passos,
            linha,
            acum,
            alvo,
            comprimento: perc.comprimento,
            metros: arredondar(total),
            minutos: Math.max(1, Math.round(total / METROS_POR_MINUTO)),
            entrada: perc.pontos[0]
        };

        tirarMarcadores();
        fazerMarcador('inicio-3d', '', linha[0], () => verPasso(passos[0]));
        fazerMarcador('destino-3d', casa.n, alvo, verCasa);
        nomearMarcadores();

        enquadrar();
        return atual;
    };

    /** Tira o percurso e os marcadores. */
    const limpar = () => {
        tirarDesenho();
        tirarMarcadores();
        atual = null;
    };

    return { mostrar, limpar, enquadrar, verPasso, mudarLingua: nomearMarcadores, atual: () => atual };
}
