/**
 * Prova da escolha automática do modo (public/escolha-de-qualidade.mjs), sem
 * placa gráfica.
 *
 * Simula um ecrã (as imagens saem em múltiplos do ritmo dele) e aparelhos de
 * várias forças, em que cada modo custa tantos milésimos de segundo por
 * imagem, e vê em que modo a escolha acaba e quantas vezes mudou.
 *
 *     bun scripts/testar-escolha.mjs
 *
 * Todas as linhas têm de dizer `ok`.
 */
import { criarEscolhaDeModo } from '../public/escolha-de-qualidade.mjs';

const MODOS = ['low', 'med', 'high'];

function semente(n) {
    let a = n >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * @param {object} c - O cenário: `custo` dá os milésimos por imagem, de um
 *     modo e de um instante (em segundos).
 * @param {number} s - A semente.
 */
function correr(c, s) {
    const rnd = semente(s);
    const ritmo = 1000 / (c.hz || 60);
    const quedas = {};
    let modo = c.partida || 'med';
    let chegaAte = 0;
    let mudancas = 0;
    let t = 1000;
    const inicio = t;
    const escolha = criarEscolhaDeModo({
        modos: MODOS,
        partida: modo,
        aplicar: (m) => {
            mudancas++;
            // Subir obriga a ir buscar pormenor: uns segundos a chegar.
            if (MODOS.indexOf(m) > MODOS.indexOf(modo)) chegaAte = t + (c.chegada ?? 8) * 1000;
            modo = m;
        },
        aoCair: (m, vezes) => { quedas[m] = (quedas[m] || 0) + vezes; },
        postoDeParte: (m) => (quedas[m] || 0) >= 2,
        ocupado: () => t < chegaAte,
        parado: () => !!(c.parado && c.parado((t - inicio) / 1000))
    });
    let lentos = 0, segundos = 0, k = 0, marca = t;
    const duracao = (c.duracao || 240) * 1000;
    while (t - inicio < duracao) {
        const agora = (t - inicio) / 1000;
        let custo = c.custo(modo, agora) * (1 + 0.1 * (rnd() - 0.5));
        // A chegar, uma imagem em cada dez arrasta-se.
        if (t < chegaAte && rnd() < 0.1) custo += 60;
        if (c.solucos && rnd() < 0.004) custo += c.solucos;
        const passo = Math.max(ritmo, Math.ceil(custo / ritmo - 1e-9) * ritmo);
        t += passo;
        k++;
        escolha.quadro(t);
        if (t - marca >= 1000) {
            segundos++;
            if (k * 1000 / (t - marca) < 29.5) lentos++;
            k = 0;
            marca = t;
        }
    }
    return { modo, mudancas, lentos: lentos / segundos, quedas, diario: escolha.diagnostico.diario };
}

const fixo = (low, med, high) => (m) => ({ low, med, high })[m];
const CENARIOS = [
    { nome: 'Computador forte: sobe ao Alto e fica', custo: fixo(2, 4, 7), fim: 'high', maximo: 1 },
    { nome: 'Computador forte, ecrã de 144: sobe ao Alto', hz: 144, custo: fixo(2, 4, 7), fim: 'high', maximo: 1 },
    { nome: 'Computador médio: fica no Médio (tenta o Alto uma vez)', custo: fixo(4, 12, 45), fim: 'med', maximo: 2 },
    { nome: 'O Médio a 40 por segundo: não sobe nem desce', custo: fixo(6, 24, 60), fim: 'med', maximo: 0 },
    { nome: 'Computador fraco: desce ao Baixo e fica', custo: fixo(10, 50, 120), fim: 'low', maximo: 1, lentos: 0.05 },
    { nome: 'Muito fraco, imagens de dois segundos: desce ao Baixo', custo: fixo(30, 2000, 4000), fim: 'low', maximo: 1 },
    { nome: 'Abre no Alto e arrasta-se: desce dois modos', partida: 'high', custo: fixo(10, 60, 200), fim: 'low', maximo: 2 },
    { nome: 'Fraco até no Baixo: fica no Baixo', custo: fixo(60, 150, 300), fim: 'low', maximo: 1 },
    { nome: 'Soluços soltos de 250 ms: não fazem descer', custo: fixo(3, 8, 10), solucos: 250, minimo: 'med', maximo: 1 },
    {
        nome: 'Vistas leves e pesadas, só o Médio aguenta: sem vaivém', duracao: 900,
        custo: (m, s) => fixo(4, s % 60 < 40 ? 6 : 22, s % 60 < 40 ? 8 : 60)(m), fim: 'med', maximo: 4, lentos: 0.06
    },
    {
        nome: 'Um aperto passageiro de 20 s: desce e volta', duracao: 900, partida: 'high',
        custo: (m, s) => fixo(3, 6, s > 60 && s < 80 ? 60 : 9)(m), fim: 'high', maximo: 2
    },
    {
        nome: 'Separador escondido a meio: não conta', partida: 'high', parado: (s) => s > 30 && s < 120,
        custo: (m, s) => fixo(3, 6, s > 30 && s < 120 ? 500 : 9)(m), fim: 'high', maximo: 0
    },
    { nome: 'Ligação lenta (40 s a chegar): não desce por isso', chegada: 40, custo: fixo(3, 6, 9), fim: 'high', maximo: 1 }
];

let falhas = 0;
for (const c of CENARIOS) {
    const rs = [1, 2, 3, 4, 5, 6].map((s) => correr(c, s));
    const ok = rs.every((r) =>
        (!c.fim || r.modo === c.fim) &&
        (!c.minimo || MODOS.indexOf(r.modo) >= MODOS.indexOf(c.minimo)) &&
        r.mudancas <= c.maximo &&
        (c.lentos === undefined || r.lentos <= c.lentos));
    if (!ok) falhas++;
    const r = rs.find((x) => (c.fim && x.modo !== c.fim) || x.mudancas > c.maximo) || rs[0];
    console.log(`${ok ? 'ok   ' : 'FALHA'}  ${c.nome}  (${rs.map((x) => x.modo).join(' ')}; mudanças ${rs.map((x) => x.mudancas).join(' ')}; abaixo de 30: ${(Math.max(...rs.map((x) => x.lentos)) * 100).toFixed(0)}%)`);
    if (!ok) console.log('       ' + r.diario.map((d) => `${((d.instante - 1000) / 1000).toFixed(0)}s ${d.de}>${d.para} ${d.motivo}`).join(', '));
}
console.log(falhas ? `\n${falhas} com falha.` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
