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
 * navegacao-3d.mjs, no bairro em 3D.
 */

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

// Um local marcado a mais do que isto do caminho mais perto (metros) fica
// "longe" dele, como as casas que ficam para dentro de um quarteirão: o
// fim do percurso diz quanto falta, pela linha a tracejado.
const LOCAL_LONGE_M = 10;

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

/** Um texto com os {nomes} trocados pelos valores. */
export function preencher(texto, valores) {
    return texto.replace(/\{(\w+)\}/g, (_, k) => (valores[k] != null ? valores[k] : ''));
}

/**
 * Um passo das indicações, por palavras, na língua de quem lê.
 *
 * @param {object} p - O passo (de Rede.indicacoes).
 * @param {string} numero - O número da casa.
 * @param {(chave: string, alternativa: string) => string} diz - O texto de
 *     uma chave das línguas (ver idiomas.js).
 * @returns {string} O passo.
 */
export function textoDoPasso(p, numero, diz) {
    // As preposições que mudam com a rua ("na Rua", "no Largo"): na lista
    // das línguas vêm as duas formas, "na|no".
    const masculina = (rua) => /^(Largo|Beco|Caminho|Passeio|P[áa]tio|Terreiro|Adro|Alto|Cais|Jardim|Bairro)\b/i.test(rua);
    const prep = (chave, rua) => {
        const formas = diz(chave, '').split('|');
        return formas[masculina(rua) ? 1 : 0] || formas[0];
    };
    const m = { metros: p.metros, numero };
    const rua = p.rua || '';
    if (p.acao === 'inicio') {
        if (p.origem === 'aqui') return diz('nav.p.aqui', 'Comece onde está.');
        if (rua) return preencher(diz('nav.p.inicioRua', 'Comece {na} {rua}, à entrada do bairro.'), { na: prep('nav.na', rua), rua });
        return diz('nav.p.inicio', 'Comece na entrada do bairro, o quadrado no mapa.');
    }
    if (p.acao === 'chegada' && p.local) {
        // O local marcado (ver Rede.destinoNoSitio): longe das ruas, segue-se
        // a linha a tracejado até ele.
        if (p.longe) return preencher(diz('nav.p.localLonge', 'O local marcado fica a cerca de {metros} m daqui, na direção da linha a tracejado.'), { metros: p.longe });
        const chave = { esquerda: 'nav.p.localEsquerda', direita: 'nav.p.localDireita' }[p.lado] || 'nav.p.localFrente';
        return diz(chave, 'Chegou: o local marcado fica à sua frente.');
    }
    if (p.acao === 'chegada') {
        // Longe da rede: fora da zona do drone (as F), ou dentro dela mas
        // longe das ruas desenhadas (para dentro de um quarteirão).
        if (p.longe && p.fora) return preencher(diz('nav.p.longe', 'A casa {numero} fica a cerca de {metros} m, numa zona que o drone não fotografou: siga a linha a tracejado.'), { numero, metros: p.longe });
        if (p.longe) return preencher(diz('nav.p.longeDentro', 'A casa {numero} fica a cerca de {metros} m daqui, na direção da linha a tracejado.'), { numero, metros: p.longe });
        const chave = { esquerda: 'nav.p.chegadaEsquerda', direita: 'nav.p.chegadaDireita' }[p.lado] || 'nav.p.chegadaFrente';
        return preencher(diz(chave, 'Chegou: a casa {numero} fica à sua frente.'), m);
    }
    const pelaRua = rua ? ' ' + prep('nav.pela', rua) + ' ' + rua : '';
    const paraRua = rua ? ' ' + prep('nav.para', rua) + ' ' + rua : '';
    const chaves = {
        siga: ['nav.p.siga', 'Siga {metros} m{pelaRua}.'],
        esquerda: ['nav.p.esquerda', 'Vire à esquerda{paraRua} e siga {metros} m.'],
        direita: ['nav.p.direita', 'Vire à direita{paraRua} e siga {metros} m.'],
        ligeiraEsquerda: ['nav.p.ligeiraEsquerda', 'Mantenha-se à esquerda{paraRua} e siga {metros} m.'],
        ligeiraDireita: ['nav.p.ligeiraDireita', 'Mantenha-se à direita{paraRua} e siga {metros} m.'],
        volta: ['nav.p.volta', 'Volte para trás e siga {metros} m.']
    }[p.acao] || ['nav.p.siga', 'Siga {metros} m{pelaRua}.'];
    return preencher(diz(chaves[0], chaves[1]), { ...m, pelaRua, paraRua });
}

/**
 * O endereço curto de uma casa: /d31, ou /d31-2 para o segundo sítio de um
 * número repetido no levantamento (ver src/index.ts, que serve o bairro
 * nele).
 */
export const ENDERECO_CURTO = /^\/([A-Za-z]?\d{1,4}(?:\.\d{1,2})?)(?:-([1-9]))?\/?$/;

/**
 * A casa que um endereço pede: o curto (/d31, /d31-2) e, por via das
 * dúvidas, os de antes (/?casa=D31&sitio=2, /casa/D31/2), que o servidor
 * já leva ao curto.
 *
 * @param {Location} onde - O endereço da página.
 * @returns {{numero: string, sitio: number}|null}
 */
export function casaPedida(onde) {
    const m = ENDERECO_CURTO.exec(onde.pathname) || /^\/casa\/([^/]+)(?:\/(\d+))?\/?$/.exec(onde.pathname);
    const p = new URLSearchParams(onde.search);
    const numero = normalizar(m ? decodeURIComponent(m[1]) : (p.get('casa') || ''));
    if (!numero) return null;
    return { numero, sitio: Math.max(1, parseInt(m ? m[2] : p.get('sitio'), 10) || 1) };
}

/**
 * O endereço de uma casa, o que se partilha: /d31, ou /d31-2 para o
 * segundo sítio.
 */
export function enderecoDaCasa(numero, sitio, sitios) {
    return '/' + encodeURIComponent(String(numero).toLowerCase()) + (sitios > 1 && sitio > 1 ? '-' + sitio : '');
}

/**
 * O endereço de um local marcado (carregar sem largar num sítio do bairro):
 * /@38.670908,-9.181921 — a latitude e a longitude, como as do Google Maps,
 * com seis casas decimais (um palmo). Abre o bairro com o local marcado no
 * sítio (ver src/index.ts).
 */
export const ENDERECO_DO_LOCAL = /^\/@(-?\d{1,2}(?:\.\d{1,8})?),(-?\d{1,3}(?:\.\d{1,8})?)\/?$/;

/**
 * O local que um endereço pede (/@38.670908,-9.181921), ou nada. Há quem
 * mande a vírgula e a arroba escritas em código (%2C, %40): também contam.
 *
 * @param {Location} onde - O endereço da página.
 * @returns {{lat: number, lon: number}|null}
 */
export function localPedido(onde) {
    let caminho = onde.pathname;
    try { caminho = decodeURIComponent(caminho); } catch (e) { /* fica como veio */ }
    const m = ENDERECO_DO_LOCAL.exec(caminho);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
    return { lat, lon };
}

/** O endereço de um local marcado: /@38.670908,-9.181921. */
export function enderecoDoLocal(lat, lon) {
    return '/@' + lat.toFixed(6) + ',' + lon.toFixed(6);
}

/**
 * Um traçado sem cantos nem tremuras: os pontos (no plano em metros),
 * refeitos de meio em meio metro, passam por uma média que pesa os vizinhos
 * até 'sigma' metros para cada lado (uma curva de Gauss). As pontas não saem
 * do sítio e, perto delas, a média vai-se desligando aos poucos — o
 * princípio e o fim do percurso ficam onde são.
 *
 * @param {number[][]} xy - Os pontos.
 * @param {number} sigma - Quanto alisar, em metros.
 * @returns {number[][]} Os pontos alisados.
 */
export function alisar(xy, sigma) {
    const acum = [0];
    for (let i = 1; i < xy.length; i++) {
        acum.push(acum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
    }
    const total = acum[acum.length - 1];
    if (xy.length < 3 || total < 2 || sigma <= 0) return xy.map((p) => [p[0], p[1]]);
    const n = Math.max(3, Math.round(total / 0.5) + 1);
    const passo = total / (n - 1);
    const pts = [];
    for (let j = 0, k = 1; j < n; j++) {
        const s = passo * j;
        while (k < acum.length - 1 && acum[k] < s) k++;
        const L = acum[k] - acum[k - 1];
        const u = L ? (s - acum[k - 1]) / L : 0;
        pts.push([xy[k - 1][0] + (xy[k][0] - xy[k - 1][0]) * u, xy[k - 1][1] + (xy[k][1] - xy[k - 1][1]) * u]);
    }
    const sigmaEmPontos = Math.min(sigma, total / 4) / passo;
    const raio = Math.ceil(3 * sigmaEmPontos);
    const pesos = [];
    for (let d = -raio; d <= raio; d++) pesos.push(Math.exp(-0.5 * (d / sigmaEmPontos) ** 2));
    const liso = pts.map((p, j) => {
        let sx = 0;
        let sy = 0;
        let sw = 0;
        for (let d = -raio; d <= raio; d++) {
            const q = pts[Math.min(n - 1, Math.max(0, j + d))];
            const w = pesos[d + raio];
            sx += q[0] * w;
            sy += q[1] * w;
            sw += w;
        }
        const s = j * passo;
        const peso = Math.min(1, Math.min(s, total - s) / (2 * sigma));
        return [p[0] + (sx / sw - p[0]) * peso, p[1] + (sy / sw - p[1]) * peso];
    });
    liso[0] = [xy[0][0], xy[0][1]];
    liso[n - 1] = [xy[xy.length - 1][0], xy[xy.length - 1][1]];
    return liso;
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
        // A passagem dos graus para a cena do bairro em 3D, e o chão dela
        // (ver navegacao-3d.mjs).
        this.cena = dados.cena || null;
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
     * Os nós de onde se parte de um sítio da rede, cada um com o que custa
     * lá chegar: o próprio nó, se for um nó (o de uma casa); se for um
     * sítio a meio de um troço ({troco, ao}: o de um local marcado, ou o de
     * quem está a ver), as duas pontas desse troço.
     *
     * @param {number|{troco: object, ao: number}} sitio - O sítio.
     * @returns {number[][]} Os pares [nó, custo].
     */
    pontasDe(sitio) {
        if (typeof sitio === 'number') return [[sitio, 0]];
        const t = sitio.troco;
        const fator = t.tipo === LIGACAO ? CUSTO_DA_LIGACAO : 1;
        return [[t.a, sitio.ao * fator], [t.b, (t.comprimento - sitio.ao) * fator]];
    }

    /**
     * O destino de um percurso até um sítio qualquer do bairro — o local
     * marcado (carregar sem largar no mapa): o mesmo feitio de uma casa de
     * rede.json, para o percurso e as indicações o tratarem como a uma, mas
     * a acabar a meio do troço mais perto, e não num nó.
     *
     * @param {number} lat
     * @param {number} lon
     * @returns {object|null} O destino: `tipo: 'local'`, `ponto` e `porta`
     *     (o próprio sítio), `naRede` (o sítio mais perto na rede: {troco,
     *     ao}) e `longe` (quantos metros fica dela, se ficar longe).
     */
    destinoNoSitio(lat, lon) {
        const perto = this.maisPerto(lat, lon);
        if (!perto) return null;
        return {
            tipo: 'local',
            ponto: [lat, lon],
            porta: [lat, lon],
            naRede: { troco: perto.troco, ao: perto.ao },
            longe: perto.distancia > LOCAL_LONGE_M ? perto.distancia : 0,
            alto: null
        };
    }

    /**
     * A casa do levantamento mais perto de um sítio, se ficar a menos de
     * `ate` metros: é o que diz ao pé de quê fica um local marcado.
     *
     * @param {number} lat
     * @param {number} lon
     * @param {number} ate - Até quantos metros.
     * @returns {{casa: object, distancia: number}|null}
     */
    casaPerto(lat, lon, ate) {
        const p = this.plano([lat, lon]);
        let melhor = null;
        for (const casas of this.casas.values()) {
            for (const casa of casas) {
                const q = this.plano(casa.ponto);
                const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
                if (d <= ate && (!melhor || d < melhor.distancia)) melhor = { casa, distancia: d };
            }
        }
        return melhor;
    }

    /**
     * Por onde se entra no bairro para chegar a uma casa (ou a um local
     * marcado): o sítio de uma estrada pública que fica mais perto dela, a
     * andar. Um local marcado numa estrada é a sua própria entrada.
     *
     * @param {number|{troco: object, ao: number}} destino - O nó da casa,
     *     ou o sítio da rede de um local marcado.
     * @returns {{no: number, rua: string}|{sitio: object, rua: string}|null}
     *     O nó (ou, numa estrada, o próprio sítio) e o nome da estrada.
     */
    entradaPara(destino) {
        if (typeof destino !== 'number' && destino.troco.tipo === ESTRADA) {
            return { sitio: destino, rua: destino.troco.nome || '' };
        }
        const dist = new Float64Array(this.nos.length).fill(Infinity);
        const monte = new Monte();
        for (const [n, d] of this.pontasDe(destino)) {
            if (d < dist[n]) {
                dist[n] = d;
                monte.por(d, n);
            }
        }
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
     * O caminho mais curto até uma casa, ou até um local marcado.
     *
     * @param {object} origem - {no} para partir de um nó (a entrada), ou
     *     {troco, ao} para partir de um sítio a meio de um troço (onde a
     *     pessoa está, ou uma entrada que é o próprio local, numa estrada).
     * @param {number|{troco: object, ao: number}} destino - O nó da casa,
     *     ou o sítio da rede de um local marcado, a meio de um troço.
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
            for (const [n, d] of this.pontasDe(origem)) {
                if (d < dist[n]) {
                    dist[n] = d;
                    veio[n] = { troco: origem.troco, inicio: true };
                    monte.por(d, n);
                }
            }
        }
        const paraUmNo = typeof destino === 'number';
        while (monte.tamanho) {
            const [d, n] = monte.tirar();
            if (d > dist[n]) continue;
            if (paraUmNo && n === destino) break;
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

        // Onde acaba: num nó (uma casa); ou a meio de um troço (um local
        // marcado), entrando nele por uma das pontas — ou, partindo do
        // mesmo troço, por ele mesmo, sem passar por nó nenhum.
        let ultimo = null;
        let direto = false;
        let n = destino;
        if (paraUmNo) {
            if (!Number.isFinite(dist[destino])) return null;
        } else {
            const t = destino.troco;
            const fator = t.tipo === LIGACAO ? CUSTO_DA_LIGACAO : 1;
            const pelaA = dist[t.a] + destino.ao * fator;
            const pelaB = dist[t.b] + (t.comprimento - destino.ao) * fator;
            const peloTroco = origem.troco === t ? Math.abs(origem.ao - destino.ao) * fator : Infinity;
            const melhor = Math.min(pelaA, pelaB, peloTroco);
            if (!Number.isFinite(melhor)) return null;
            direto = melhor === peloTroco;
            n = pelaA <= pelaB ? t.a : t.b;
            ultimo = t;
        }
        // O nó por onde se entra no troço do local marcado.
        const entraNoUltimo = n;

        // Do fim para o princípio, peça a peça.
        const pecas = [];
        while (!direto && veio[n]) {
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
        if (ultimo && direto) {
            // Do sítio de partida ao local, pelo troço onde ficam os dois.
            juntar(this.trecho(ultimo, origem.ao, destino.ao), ultimo.nome);
        } else if (ultimo) {
            // Do nó por onde se entra no troço até ao local, a meio dele.
            if (nos.length) nos[nos.length - 1].sai = ultimo;
            juntar(this.trecho(ultimo, entraNoUltimo === ultimo.a ? 0 : ultimo.comprimento, destino.ao), ultimo.nome);
        }
        if (!xy.length) {
            xy.push(paraUmNo ? this.plano(this.nos[destino]) : this.trecho(destino.troco, destino.ao, destino.ao)[0]);
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
     * @param {object} casa - A casa (de rede.json), ou o local marcado (ver
     *     destinoNoSitio).
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
        passos.push({ acao: 'chegada', lado, longe: casa.longe ? arredondar(casa.longe) : 0, fora: !!casa.fora, local: casa.tipo === 'local' });
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
