/**
 * A navegação no Bairro de Penajóia: a rede de caminhos, as casas, e as
 * contas de um percurso até uma delas.
 *
 * A rede (public/navegacao/rede.json) é feita por
 * scripts/navegacao/reconhecer.py. As ruas do bairro são as que foram
 * desenhadas à mão sobre o ortofotomapa do voo de drone de 15-02-2026 (ver
 * scripts/navegacao/ruas.py); os telhados das casas são reconhecidos no
 * ortofotomapa e nas alturas do mesmo voo; os números das casas vêm do
 * levantamento feito no bairro (só o número e o sítio de cada uma); as
 * estradas de fora do bairro, do OpenStreetMap.
 *
 * Aqui não se mexe na página: são só contas. Quem desenha é
 * navegacao.html.
 */

// Os quadrados do ortofotomapa (ver scripts/navegacao/mosaicos.py).
export const ORTOFOTO = {
    endereco: '/navegacao/ortofoto/{z}/{x}/{y}.webp',
    indice: '/navegacao/ortofoto/indice.json'
};

export const REDE = '/navegacao/rede.json';

// Quanto se anda a pé num minuto, num bairro de subidas e becos.
export const METROS_POR_MINUTO = 70;

// Os tipos de troço, pela ordem de rede.json.
export const ESTRADA = 0;
export const RUA = 1;
export const BECO = 2;
export const LIGACAO = 3;

// As ligações das ruas desenhadas às estradas (do fim da rua ao meio da
// estrada) contam um pouco mais: o percurso não as usa como atalho.
const CUSTO_DA_LIGACAO = 1.3;

// O que conta como virar: o ângulo entre por onde se vinha e por onde se
// vai, medido em 8 metros de cada lado do cruzamento (para os cruzamentos
// tortos de um bairro destes não parecerem dois). Seguir pelo caminho mais
// a direito só se diz se ele dobrar mais do que SEGUIR_DOBRA_GRAUS; onde
// outro caminho é mais a direito, diz-se a partir de ESCOLHA_GRAUS ("mantenha-
// -se à esquerda"). Daí para cima é virar, e de 150 graus para cima é voltar.
const SEGUIR_DOBRA_GRAUS = 45;
const ESCOLHA_GRAUS = 10;
const VIRAR_FRANCO_GRAUS = 60;
const DAR_A_VOLTA_GRAUS = 150;
const RUMO_M = 8;
const JUNTAR_M = 6;

/**
 * O número de uma casa escrito de maneira a poder comparar-se: "d 31",
 * "D-31" e "nº D31" dão todos "D31".
 *
 * @param {string} texto - O que a pessoa escreveu.
 * @returns {string} O número normalizado.
 */
export function normalizar(texto) {
    return String(texto || '')
        .toUpperCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/^\s*(CASA|N\s*[.ºO°]?)\s*(?=[A-Z]?\d)/, '')
        .replace(/,/g, '.')
        .replace(/[^A-Z0-9.]/g, '');
}

/**
 * A ordem das casas numa lista: A1, A2, …, A10, B1… (e não A1, A10, A2).
 */
export function ordemDoNumero(a, b) {
    const partes = (n) => {
        const m = /^([A-Z]*)(\d+)(?:\.(\d+))?/.exec(n);
        return m ? [m[1] || '~', +m[2], +(m[3] || 0)] : ['~', 0, 0];
    };
    const pa = partes(a);
    const pb = partes(b);
    if (pa[0] !== pb[0]) return pa[0] < pb[0] ? -1 : 1;
    return pa[1] - pb[1] || pa[2] - pb[2] || (a < b ? -1 : a > b ? 1 : 0);
}

/** Um monte (fila com prioridade), para o caminho mais curto. */
class Monte {
    constructor() {
        this.chaves = [];
        this.valores = [];
    }

    get tamanho() {
        return this.chaves.length;
    }

    por(chave, valor) {
        const c = this.chaves;
        const v = this.valores;
        let i = c.length;
        c.push(chave);
        v.push(valor);
        while (i > 0) {
            const pai = (i - 1) >> 1;
            if (c[pai] <= chave) break;
            c[i] = c[pai];
            v[i] = v[pai];
            i = pai;
        }
        c[i] = chave;
        v[i] = valor;
    }

    tirar() {
        const c = this.chaves;
        const v = this.valores;
        const topo = [c[0], v[0]];
        const chave = c.pop();
        const valor = v.pop();
        if (c.length) {
            let i = 0;
            for (;;) {
                let filho = 2 * i + 1;
                if (filho >= c.length) break;
                if (filho + 1 < c.length && c[filho + 1] < c[filho]) filho++;
                if (c[filho] >= chave) break;
                c[i] = c[filho];
                v[i] = v[filho];
                i = filho;
            }
            c[i] = chave;
            v[i] = valor;
        }
        return topo;
    }
}

/** A diferença entre dois rumos, em graus, de -180 a 180 (positivo: para a esquerda). */
function viragem(depois, antes) {
    let d = (depois - antes) * 180 / Math.PI;
    while (d > 180) d -= 360;
    while (d <= -180) d += 360;
    return d;
}

/**
 * Os metros arredondados como se dizem a quem vai a andar: ao metro até
 * dez, de cinco em cinco até cem, de dez em dez daí para cima.
 */
export function arredondar(metros) {
    if (metros < 10) return Math.max(1, Math.round(metros));
    if (metros < 100) return Math.round(metros / 5) * 5;
    return Math.round(metros / 10) * 10;
}

export class Rede {
    /**
     * @param {object} dados - O conteúdo de rede.json.
     */
    constructor(dados) {
        this.tipos = dados.tipos;
        this.nomes = dados.nomes || [];
        this.nos = dados.nos;
        // Um plano em metros à volta do bairro: a esta escala a Terra é
        // plana, e as contas ficam simples.
        let somaLat = 0;
        for (const p of this.nos) somaLat += p[0];
        this.lat0 = somaLat / this.nos.length;
        this.lon0 = this.nos[0][1];
        this.kx = 111320 * Math.cos(this.lat0 * Math.PI / 180);
        this.ky = 110574;

        this.vizinhos = this.nos.map(() => []);
        this.trocos = dados.trocos.map(([a, b, , largura, tipo, meio, nome], i) => {
            const pontos = [this.nos[a], ...meio, this.nos[b]];
            const xy = pontos.map((p) => this.plano(p));
            const acum = [0];
            for (let k = 1; k < xy.length; k++) {
                acum.push(acum[k - 1] + Math.hypot(xy[k][0] - xy[k - 1][0], xy[k][1] - xy[k - 1][1]));
            }
            const troco = {
                i, a, b, largura, tipo, pontos, xy, acum,
                comprimento: acum[acum.length - 1],
                nome: nome == null ? '' : this.nomes[nome]
            };
            if (a !== b) {
                this.vizinhos[a].push(troco);
                this.vizinhos[b].push(troco);
            }
            return troco;
        });

        // As casas, por número. Um número pode estar em mais de um sítio
        // (há uns poucos repetidos no levantamento).
        this.casas = new Map();
        for (const c of dados.casas) {
            if (!this.casas.has(c.n)) this.casas.set(c.n, []);
            this.casas.get(c.n).push(c);
        }
        this.numeros = [...this.casas.keys()].sort(ordemDoNumero);
    }

    /** Um ponto [lat, lon] no plano em metros. */
    plano(p) {
        return [(p[1] - this.lon0) * this.kx, (p[0] - this.lat0) * this.ky];
    }

    /** Um ponto do plano em [lat, lon]. */
    geo(q) {
        return [q[1] / this.ky + this.lat0, q[0] / this.kx + this.lon0];
    }

    /** Quantos troços chegam a um nó: três ou mais é um cruzamento. */
    grau(no) {
        return this.vizinhos[no].length;
    }

    /**
     * Os números que começam pelo que se escreveu, o igual primeiro.
     *
     * @param {string} texto - O que a pessoa escreveu.
     * @param {number} [quantos] - No máximo, quantos.
     * @returns {string[]} Os números.
     */
    procurar(texto, quantos = 8) {
        const q = normalizar(texto);
        if (!q) return [];
        const iguais = this.casas.has(q) ? [q] : [];
        const comecam = this.numeros.filter((n) => n !== q && n.startsWith(q));
        return iguais.concat(comecam).slice(0, quantos);
    }

    /**
     * O sítio da rede mais perto de um ponto qualquer.
     *
     * @param {number} lat
     * @param {number} lon
     * @returns {{troco: object, ao: number, distancia: number, ponto: number[]}}
     *     O troço, a distância desde o princípio dele, quão longe fica o
     *     ponto, e o sítio na rede.
     */
    maisPerto(lat, lon) {
        const p = this.plano([lat, lon]);
        let melhor = null;
        for (const t of this.trocos) {
            if (t.a === t.b) continue;
            for (let k = 0; k < t.xy.length - 1; k++) {
                const a = t.xy[k];
                const b = t.xy[k + 1];
                const dx = b[0] - a[0];
                const dy = b[1] - a[1];
                const L2 = dx * dx + dy * dy;
                const u = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
                const q = [a[0] + u * dx, a[1] + u * dy];
                const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
                if (!melhor || d < melhor.distancia) {
                    melhor = { troco: t, ao: t.acum[k] + u * Math.sqrt(L2), distancia: d, xy: q };
                }
            }
        }
        if (melhor) melhor.ponto = this.geo(melhor.xy);
        return melhor;
    }

    custo(t) {
        return t.comprimento * (t.tipo === LIGACAO ? CUSTO_DA_LIGACAO : 1);
    }

    /**
     * Por onde se entra no bairro para chegar a uma casa: o sítio de uma
     * estrada pública que fica mais perto dela, a andar.
     *
     * @param {number} destino - O nó da casa.
     * @returns {{no: number, rua: string}|null} O nó e o nome da estrada.
     */
    entradaPara(destino) {
        const dist = new Float64Array(this.nos.length).fill(Infinity);
        const monte = new Monte();
        dist[destino] = 0;
        monte.por(0, destino);
        while (monte.tamanho) {
            const [d, n] = monte.tirar();
            if (d > dist[n]) continue;
            const estradas = this.vizinhos[n].filter((t) => t.tipo === ESTRADA);
            if (estradas.length) {
                const comNome = estradas.find((t) => t.nome);
                return { no: n, rua: comNome ? comNome.nome : '' };
            }
            for (const t of this.vizinhos[n]) {
                const m = t.a === n ? t.b : t.a;
                const nd = d + this.custo(t);
                if (nd < dist[m]) {
                    dist[m] = nd;
                    monte.por(nd, m);
                }
            }
        }
        return null;
    }

    /**
     * Os pontos de um troço entre duas distâncias desde o princípio dele,
     * pela ordem pedida (de 'de' para 'ate').
     */
    trecho(t, de, ate) {
        const ponto = (s) => {
            s = Math.max(0, Math.min(t.comprimento, s));
            let k = 1;
            while (k < t.acum.length - 1 && t.acum[k] < s) k++;
            const a = t.xy[k - 1];
            const b = t.xy[k];
            const L = t.acum[k] - t.acum[k - 1];
            const u = L ? (s - t.acum[k - 1]) / L : 0;
            return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
        };
        const lo = Math.min(de, ate);
        const hi = Math.max(de, ate);
        const pts = [ponto(lo)];
        for (let k = 0; k < t.acum.length; k++) {
            if (t.acum[k] > lo && t.acum[k] < hi) pts.push(t.xy[k]);
        }
        pts.push(ponto(hi));
        return de <= ate ? pts : pts.reverse();
    }

    /**
     * O caminho mais curto até uma casa.
     *
     * @param {object} origem - {no} para partir de um nó (a entrada), ou
     *     {troco, ao} para partir de um sítio a meio de um troço (onde a
     *     pessoa está).
     * @param {number} destino - O nó da casa.
     * @returns {object|null} O percurso: os pontos (xy no plano e [lat, lon]),
     *     a distância acumulada em cada ponto, o comprimento, e os nós por
     *     onde passa, cada um com a distância a que fica do princípio.
     */
    caminho(origem, destino) {
        const N = this.nos.length;
        const dist = new Float64Array(N).fill(Infinity);
        const veio = new Array(N).fill(null);
        const monte = new Monte();
        if (origem.no != null) {
            dist[origem.no] = 0;
            monte.por(0, origem.no);
        } else {
            const t = origem.troco;
            const fator = t.tipo === LIGACAO ? CUSTO_DA_LIGACAO : 1;
            const pontas = [[t.a, origem.ao * fator], [t.b, (t.comprimento - origem.ao) * fator]];
            for (const [n, d] of pontas) {
                if (d < dist[n]) {
                    dist[n] = d;
                    veio[n] = { troco: t, inicio: true };
                    monte.por(d, n);
                }
            }
        }
        while (monte.tamanho) {
            const [d, n] = monte.tirar();
            if (d > dist[n]) continue;
            if (n === destino) break;
            for (const t of this.vizinhos[n]) {
                const m = t.a === n ? t.b : t.a;
                const nd = d + this.custo(t);
                if (nd < dist[m]) {
                    dist[m] = nd;
                    veio[m] = { troco: t, de: n };
                    monte.por(nd, m);
                }
            }
        }
        if (!Number.isFinite(dist[destino])) return null;

        // Do fim para o princípio, peça a peça.
        const pecas = [];
        let n = destino;
        while (veio[n]) {
            const v = veio[n];
            pecas.push({ troco: v.troco, para: n, de: v.de, inicio: !!v.inicio });
            if (v.inicio) break;
            n = v.de;
        }
        pecas.reverse();

        const xy = [];
        const nos = [];
        const nomes = [];
        const juntar = (pts, nome) => {
            for (const q of pts) {
                const ult = xy[xy.length - 1];
                if (ult && Math.hypot(q[0] - ult[0], q[1] - ult[1]) < 0.01) continue;
                xy.push(q);
                nomes.push(nome);
            }
        };
        if (origem.no != null) {
            xy.push(this.plano(this.nos[origem.no]));
            nomes.push('');
        }
        for (const p of pecas) {
            const t = p.troco;
            let pts;
            if (p.inicio) {
                pts = this.trecho(t, origem.ao, p.para === t.a ? 0 : t.comprimento);
            } else {
                pts = p.de === t.a ? t.xy : [...t.xy].reverse();
            }
            juntar(pts, t.nome);
            nos.push({ no: p.para, indice: xy.length - 1, entra: t });
        }
        for (let k = 0; k < nos.length - 1; k++) nos[k].sai = pecas[k + 1].troco;
        if (!xy.length) {
            xy.push(this.plano(this.nos[destino]));
            nomes.push('');
        }
        const acum = [0];
        for (let k = 1; k < xy.length; k++) {
            acum.push(acum[k - 1] + Math.hypot(xy[k][0] - xy[k - 1][0], xy[k][1] - xy[k - 1][1]));
        }
        return {
            xy,
            acum,
            nomes,
            comprimento: acum[acum.length - 1],
            pontos: xy.map((q) => this.geo(q)),
            nos: nos.map(({ no, indice, entra, sai }) => ({ no, s: acum[indice], entra, sai }))
        };
    }

    /** Para onde sai um troço de um dos seus nós (o rumo dos primeiros metros). */
    rumoDoTroco(t, no) {
        const pts = t.a === no ? t.xy : [...t.xy].reverse();
        const a = pts[0];
        let b = pts[pts.length - 1];
        let andado = 0;
        for (let k = 1; k < pts.length; k++) {
            andado += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
            if (andado >= RUMO_M) {
                b = pts[k];
                break;
            }
        }
        return Math.atan2(b[1] - a[1], b[0] - a[0]);
    }

    /**
     * As indicações de um percurso, passo a passo: por onde começar, onde
     * virar e quanto andar, e de que lado fica a casa ao chegar.
     *
     * @param {object} percurso - O que caminho() devolveu.
     * @param {object} casa - A casa (de rede.json).
     * @param {object} inicio - {tipo: 'entrada'|'aqui', rua}.
     * @returns {object[]} Os passos: {acao, metros, rua, lado, longe}.
     */
    indicacoes(percurso, casa, inicio) {
        const { xy, acum, comprimento: total } = percurso;
        const pontoEm = (s) => {
            s = Math.max(0, Math.min(total, s));
            let k = 1;
            while (k < acum.length - 1 && acum[k] < s) k++;
            const a = xy[k - 1] || xy[0];
            const b = xy[k] || xy[0];
            const L = (acum[k] || 0) - (acum[k - 1] || 0);
            const u = L ? (s - acum[k - 1]) / L : 0;
            return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
        };
        const rumo = (s0, s1) => {
            const a = pontoEm(s0);
            const b = pontoEm(s1);
            return Math.atan2(b[1] - a[1], b[0] - a[0]);
        };
        const nomeEm = (s) => {
            let k = 1;
            while (k < acum.length - 1 && acum[k] <= s) k++;
            return percurso.nomes[k] || '';
        };

        // Onde se vira: só nos cruzamentos, e só onde há por onde errar —
        // seguir pelo caminho mais a direito, ou pela rua mais larga (quem
        // anda segue a rua principal sem pensar nisso), não se diz, mesmo que
        // curve um pouco. Os cruzamentos muito juntos contam como um.
        const largura = (t) => (t.tipo === ESTRADA ? Math.max(t.largura, 8) : t.largura);
        const eventos = [];
        for (const { no, s, entra, sai } of percurso.nos) {
            if (s < 2 || s > total - 2 || !sai || this.grau(no) < 3) continue;
            const antes = rumo(s - RUMO_M, s);
            const angulo = viragem(rumo(s, s + RUMO_M), antes);
            const alternativas = this.vizinhos[no].filter((t) => t !== entra && t !== sai);
            const outros = alternativas.map((t) => Math.abs(viragem(this.rumoDoTroco(t, no), antes)));
            const maisDireito = !outros.length || Math.abs(angulo) <= Math.min(...outros) + 5;
            const maisLargo = !alternativas.length || largura(sai) >= 0.8 * Math.max(...alternativas.map(largura));
            if ((maisDireito || maisLargo) && Math.abs(angulo) < SEGUIR_DOBRA_GRAUS) continue;
            const ultimo = eventos[eventos.length - 1];
            if (ultimo && s - ultimo.s1 < JUNTAR_M) {
                ultimo.s1 = s;
                ultimo.angulo = viragem(rumo(s, s + RUMO_M), rumo(ultimo.s0 - RUMO_M, ultimo.s0));
                ultimo.maisDireito = ultimo.maisDireito && maisDireito;
            } else {
                eventos.push({ s0: s, s1: s, angulo, maisDireito });
            }
        }
        const viragens = eventos.filter((e) => Math.abs(e.angulo) >= (e.maisDireito ? SEGUIR_DOBRA_GRAUS : ESCOLHA_GRAUS)).map((e) => {
            const a = Math.abs(e.angulo);
            const lado = e.angulo > 0 ? 'Esquerda' : 'Direita';
            const acao = a >= DAR_A_VOLTA_GRAUS ? 'volta'
                : a >= VIRAR_FRANCO_GRAUS ? lado.toLowerCase()
                    : 'ligeira' + lado;
            return { s0: e.s0, s1: e.s1, acao };
        });
        // E onde se passa para uma estrada com nome, sem virar.
        for (const { s } of percurso.nos) {
            if (s < 2 || s > total - 2) continue;
            const antes = nomeEm(s - 1);
            const depois = nomeEm(s + 1);
            if (depois && depois !== antes && !viragens.some((v) => Math.abs(v.s0 - s) < JUNTAR_M)) {
                viragens.push({ s0: s, s1: s, acao: 'siga' });
            }
        }
        viragens.sort((a, b) => a.s0 - b.s0);

        const passos = [{ acao: 'inicio', origem: inicio.tipo, rua: inicio.rua || '' }];
        let atual = { acao: 'siga', desde: 0, rua: nomeEm(0.5) };
        for (const v of viragens) {
            atual.metros = v.s0 - atual.desde;
            if (atual.metros >= 1 || atual.acao !== 'siga') passos.push(atual);
            atual = { acao: v.acao, desde: v.s1, rua: nomeEm(v.s1 + 0.5) };
        }
        atual.metros = total - atual.desde;
        if (atual.metros >= 1 || atual.acao !== 'siga') passos.push(atual);
        // Uma estrada só se nomeia quando se entra nela: no passo seguinte
        // pela mesma, já não. E a da entrada já vai dita no primeiro passo.
        if (passos[1] && passos[1].rua && passos[1].rua === passos[0].rua) passos[1].rua = '';
        for (let i = 2; i < passos.length; i++) {
            if (passos[i].rua && passos[i].rua === passos[i - 1].rua && passos[i].acao === 'siga') {
                passos[i - 1].metros += passos[i].metros;
                passos.splice(i, 1);
                i--;
            }
        }
        for (const p of passos) {
            if (p.metros != null) p.metros = arredondar(p.metros);
        }

        // De que lado fica a casa, a quem chega pelo último troço.
        const fim = xy[xy.length - 1];
        const porta = this.plano(casa.porta);
        let lado = 'frente';
        if (total > 1 && Math.hypot(porta[0] - fim[0], porta[1] - fim[1]) > 1) {
            const a = viragem(Math.atan2(porta[1] - fim[1], porta[0] - fim[0]), rumo(total - RUMO_M, total));
            if (Math.abs(a) >= 25 && Math.abs(a) <= 155) lado = a > 0 ? 'esquerda' : 'direita';
        }
        passos.push({ acao: 'chegada', lado, longe: casa.longe ? arredondar(casa.longe) : 0, fora: !!casa.fora });
        return passos;
    }
}

/**
 * Lê a rede.
 *
 * @returns {Promise<Rede>}
 */
export async function carregarRede() {
    const resposta = await fetch(REDE);
    if (!resposta.ok) throw new Error('rede.json: ' + resposta.status);
    return new Rede(await resposta.json());
}
