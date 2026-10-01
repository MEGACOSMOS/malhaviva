/**
 * Prova do afinador de fluidez (public/fluidez.mjs), sem placa gráfica.
 *
 * Simula um ecrã que desenha imagens a um ritmo fixo (60 por segundo, com
 * as imagens a saírem em múltiplos de 16,7 milésimos de segundo, como num
 * navegador a sério) e um bairro cujo custo por imagem depende do degrau em
 * que o afinador o põe. Corre o afinador antigo e o novo nos mesmos
 * cenários e conta quantos segundos ficaram abaixo das 30 imagens.
 *
 *     bun scripts/testar-fluidez.mjs
 *
 * Todas as linhas da segunda parte têm de dizer `ok`.
 */

import { criarAfinadorDeFluidez, construirEscada } from '../public/fluidez.mjs';

// --- Números repetíveis ------------------------------------------------

function semente(n) {
    let a = n >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function gauss(rnd) {
    return Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
}

// --- O afinador antigo, tal como estava no index.html -------------------

function criarAntigo({ aplicar }) {
    const ALVO = 30;
    const MINIMO = 0.5;
    const MAXIMO = 2.6;
    let detalhe = 1;
    let imagens = 0;
    let inicio = 0;
    let espera = 0;
    let media = 0;
    return {
        quadro(agora) {
            if (!inicio) { inicio = agora; imagens = 0; return; }
            imagens++;
            if (agora - inicio < 1000) return;
            const fps = imagens * 1000 / (agora - inicio);
            inicio = agora;
            imagens = 0;
            media = media ? media * 0.6 + fps * 0.4 : fps;
            if (espera > 0) { espera--; return; }
            let fator = 1;
            if (media < ALVO * 0.8) fator = 0.8;
            else if (media < ALVO - 2) fator = 0.92;
            else if (media > ALVO * 1.5) fator = 1.1;
            else if (media > ALVO + 5) fator = 1.04;
            if (fator === 1) return;
            const depois = Math.min(MAXIMO, Math.max(MINIMO, detalhe * fator));
            if (Math.abs(depois - detalhe) < 0.01) return;
            detalhe = depois;
            espera = 2;
            aplicar({ detalhe, densidade: 1 });
        }
    };
}

// --- O ecrã e o bairro -------------------------------------------------

/**
 * Custo de uma imagem, em milissegundos, para um degrau.
 *
 * Uma parte é fixa; do resto, metade cresce com o número de manchas e a
 * outra metade com as manchas vezes os pontos pintados.
 */
function custoDe(custoNaPartida, { detalhe, densidade }) {
    const FIXO = 0.15;
    const manchas = Math.pow(detalhe, 2.5);
    return custoNaPartida * (FIXO + (1 - FIXO) * (0.5 * manchas + 0.5 * manchas * densidade * densidade));
}

/**
 * Corre um cenário.
 *
 * @param {object} c - O cenário.
 * @param {string} qual - 'antigo' ou 'novo'.
 * @returns {object} Os resultados.
 */
function correr(c, qual) {
    const rnd = semente(c.semente || 1);
    const intervaloDoEcra = 1000 / (c.hz || 60);
    const duracao = (c.duracao || 180) * 1000;

    let degrau = { detalhe: 1, densidade: 1 };
    let mudancas = 0;

    // Mexer no pormenor obriga o bairro a ser reavaliado e a ir buscar
    // pedaços novos: uma imagem a arrastar-se e uma imagem ou outra mais
    // pesada durante um instante. Mexer na densidade custa só o recriar do
    // ecrã. Sem isto, andar sempre a mexer parecia de graça.
    let aoMudar = null;
    const aplicar = (d) => {
        aoMudar = { detalhe: d.detalhe !== degrau.detalhe };
        degrau = d;
        mudancas++;
    };
    let transitorioAte = 0;

    let afinador;
    if (qual === 'antigo') {
        afinador = criarAntigo({ aplicar });
    } else {
        const escada = construirEscada({ comSubida: c.comSubida !== false });
        degrau = escada.degraus[escada.partida];
        afinador = criarAfinadorDeFluidez({
            degraus: escada.degraus,
            partida: escada.partida,
            aplicar: (d) => aplicar(d)
        });
    }

    let t = 5000;
    const inicio = t;
    const porSegundo = [];           // imagens por cada segundo inteiro
    let somaDetalhe = 0;
    let somaDensidade = 0;
    let amostras = 0;
    let ultimoSoluco = 0;

    while (t - inicio < duracao) {
        const decorrido = (t - inicio) / 1000;
        const base = typeof c.custo === 'function' ? c.custo(decorrido) : c.custo;
        let custo = custoDe(base, degrau);
        custo *= Math.max(0.5, 1 + (c.ruido || 0.05) * gauss(rnd));
        if (c.picos && rnd() < c.picos.chance) custo *= c.picos.fator;
        if (c.solucos && decorrido - ultimoSoluco >= c.solucos.cada) {
            custo += c.solucos.ms;
            ultimoSoluco = decorrido;
        }
        if (aoMudar) {
            if (aoMudar.detalhe) {
                custo += 80;
                transitorioAte = decorrido + 1.5;
            } else {
                custo += 30;
            }
            aoMudar = null;
        }
        if (decorrido < transitorioAte) custo += 10;

        // O ecrã só mostra imagens nos seus ritmos: a imagem sai no
        // primeiro tique depois de estar pronta.
        const intervalo = Math.max(intervaloDoEcra, Math.ceil(custo / intervaloDoEcra - 1e-9) * intervaloDoEcra);
        t += intervalo;
        afinador.quadro(t);

        const segundo = Math.floor((t - inicio) / 1000);
        porSegundo[segundo] = (porSegundo[segundo] || 0) + 1;
        if (decorrido >= (c.ignorar || 10)) {
            somaDetalhe += degrau.detalhe * intervalo;
            somaDensidade += degrau.densidade * intervalo;
            amostras += intervalo;
        }
    }

    const dePois = porSegundo.slice(c.ignorar || 10, porSegundo.length - 1);
    const abaixo = (limite) => dePois.filter(f => f < limite).length / dePois.length;
    const ordenado = dePois.slice().sort((a, b) => a - b);
    return {
        abaixoDe30: abaixo(29.5),
        abaixoDe27: abaixo(27),
        pior: ordenado[Math.floor(ordenado.length * 0.05)],
        fps: dePois.reduce((a, b) => a + b, 0) / dePois.length,
        detalhe: somaDetalhe / amostras,
        densidade: somaDensidade / amostras,
        mudancas,
        degrauFinal: degrau,
        diagnostico: qual === 'novo' ? afinador.diagnostico : null
    };
}

/**
 * Corre o cenário com várias sementes e faz a média: uma só corrida pode
 * ter sorte ou azar, e o que interessa é o que acontece em geral.
 */
const SEMENTES = 8;
function correrVarias(c, qual) {
    const corridas = [];
    for (let i = 1; i <= SEMENTES; i++) corridas.push(correr(Object.assign({}, c, { semente: i }), qual));
    const media = (campo) => corridas.reduce((a, r) => a + r[campo], 0) / corridas.length;
    return {
        abaixoDe30: media('abaixoDe30'),
        abaixoDe27: media('abaixoDe27'),
        pior: media('pior'),
        fps: media('fps'),
        detalhe: media('detalhe'),
        densidade: media('densidade'),
        mudancas: Math.round(media('mudancas')),
        piorCorrida: Math.max(...corridas.map(r => r.abaixoDe30)),
        degrauFinal: {
            detalhe: corridas.reduce((a, r) => a + r.degrauFinal.detalhe, 0) / corridas.length,
            densidade: corridas.reduce((a, r) => a + r.degrauFinal.densidade, 0) / corridas.length
        },
        diagnostico: corridas[0].diagnostico,
        corridas
    };
}

// --- Os cenários -------------------------------------------------------

const CENARIOS = [
    { nome: 'Folga de sobra (6 ms)', custo: 6 },
    { nome: 'Confortável (14 ms)', custo: 14 },
    { nome: 'Ao limite dos 30 (28 ms)', custo: 28 },
    { nome: 'Pesado (40 ms)', custo: 40 },
    { nome: 'Muito pesado (70 ms)', custo: 70 },
    { nome: 'Pesado e irregular', custo: 36, ruido: 0.12, picos: { chance: 0.04, fator: 1.6 } },
    { nome: 'Leve, com soluços de 250 ms', custo: 10, solucos: { cada: 2.5, ms: 250 } },
    { nome: 'Ecrã de 30 Hz, leve', custo: 10, hz: 30 },
    { nome: 'Ecrã de 30 Hz, pesado', custo: 40, hz: 30 },
    { nome: 'Ecrã de 144 Hz, leve', custo: 5, hz: 144 },
    {
        nome: 'Bairro denso a meio (leve→pesado→leve)',
        duracao: 240,
        custo: (s) => (s >= 80 && s < 160 ? 55 : 12),
        ruido: 0.08
    },
    {
        nome: 'A passear (de leve a denso, sem parar)',
        duracao: 240,
        custo: (s) => Math.max(8, 14 + 26 * (0.5 + 0.5 * Math.sin(2 * Math.PI * s / 23)) + 8 * Math.sin(2 * Math.PI * s / 7.3)),
        ruido: 0.1,
        picos: { chance: 0.02, fator: 1.5 }
    },
    {
        nome: 'Sem degraus acima da partida, pesado',
        custo: 45,
        comSubida: false
    }
];

function pct(x) {
    return (x * 100).toFixed(0).padStart(3) + '%';
}

function linha(c, qual, r) {
    return [
        c.nome.padEnd(40),
        qual.padEnd(6),
        pct(r.abaixoDe30),
        pct(r.abaixoDe27),
        String(Math.round(r.pior)).padStart(3),
        r.fps.toFixed(0).padStart(4),
        r.detalhe.toFixed(2).padStart(7),
        r.densidade.toFixed(2).padStart(7),
        String(r.mudancas).padStart(5)
    ].join('  ');
}

console.log('Segundos abaixo de 30 imagens por segundo, por cenário (depois dos primeiros 10 s)\n');
console.log([
    'Cenário'.padEnd(40), 'Quem'.padEnd(6), '<30', '<27', 'pior', 'fps', 'detalhe', 'densid.', 'mudan.'
].join('  '));

const resultados = {};
for (const c of CENARIOS) {
    const antigo = correrVarias(c, 'antigo');
    const novo = correrVarias(c, 'novo');
    resultados[c.nome] = { antigo, novo };
    console.log(linha(c, 'antigo', antigo));
    console.log(linha(c, 'novo', novo));
}

// --- Verificações --------------------------------------------------------

console.log('\nVerificações\n');
let falhas = 0;
function verificar(descricao, condicao, detalhe) {
    if (!condicao) falhas++;
    console.log((condicao ? 'ok     ' : 'FALHA  ') + descricao + (detalhe ? '  (' + detalhe + ')' : ''));
}
const n = (nome) => resultados[nome].novo;
const a = (nome) => resultados[nome].antigo;

for (const nome of ['Ao limite dos 30 (28 ms)', 'Pesado (40 ms)', 'Muito pesado (70 ms)', 'Pesado e irregular']) {
    verificar(
        nome + ': o novo fica abaixo de 30 em menos de 5% dos segundos',
        n(nome).abaixoDe30 < 0.05,
        'novo ' + pct(n(nome).abaixoDe30) + ', antigo ' + pct(a(nome).abaixoDe30)
    );
}

const passeio = 'A passear (de leve a denso, sem parar)';
verificar(
    'A passear: o novo fica abaixo de 30 em menos de 5% dos segundos',
    n(passeio).abaixoDe30 < 0.05,
    'novo ' + pct(n(passeio).abaixoDe30) + ', antigo ' + pct(a(passeio).abaixoDe30)
);
verificar(
    'A passear: o novo fica abaixo de 30 pelo menos cinco vezes menos do que o antigo',
    n(passeio).abaixoDe30 <= a(passeio).abaixoDe30 / 5,
    'novo ' + pct(n(passeio).abaixoDe30) + ', antigo ' + pct(a(passeio).abaixoDe30)
);
verificar(
    'A passear: muda de degrau bem menos vezes do que o antigo',
    n(passeio).mudancas * 3 <= a(passeio).mudancas,
    'novo ' + n(passeio).mudancas + ', antigo ' + a(passeio).mudancas
);

verificar(
    'Folga de sobra: sobe até ao pormenor máximo e não passa de uma imagem lenta rara',
    n('Folga de sobra (6 ms)').abaixoDe30 === 0 && n('Folga de sobra (6 ms)').degrauFinal.detalhe > 1.5,
    'detalhe final ' + n('Folga de sobra (6 ms)').degrauFinal.detalhe.toFixed(2)
);

verificar(
    'Confortável: nunca desce de partida',
    n('Confortável (14 ms)').detalhe >= 1 && n('Confortável (14 ms)').densidade >= 1,
    'detalhe médio ' + n('Confortável (14 ms)').detalhe.toFixed(2)
);

verificar(
    'Soluços isolados de 250 ms não tiram pormenor a ninguém',
    n('Leve, com soluços de 250 ms').detalhe >= 1 && n('Leve, com soluços de 250 ms').densidade >= 1,
    'detalhe médio ' + n('Leve, com soluços de 250 ms').detalhe.toFixed(2)
);

verificar(
    'Ecrã de 30 Hz, leve: não tira pormenor só por o ecrã ser lento',
    n('Ecrã de 30 Hz, leve').detalhe >= 1 && n('Ecrã de 30 Hz, leve').densidade >= 1,
    'detalhe médio ' + n('Ecrã de 30 Hz, leve').detalhe.toFixed(2)
);

verificar(
    'Ecrã de 30 Hz, pesado: acaba a 30 e sem imagens lentas',
    n('Ecrã de 30 Hz, pesado').abaixoDe30 < 0.05,
    'abaixo de 30: ' + pct(n('Ecrã de 30 Hz, pesado').abaixoDe30)
);

verificar(
    'Ecrã de 144 Hz, leve: sem imagens lentas',
    n('Ecrã de 144 Hz, leve').abaixoDe30 === 0
);

const denso = n('Bairro denso a meio (leve→pesado→leve)');
verificar(
    'Bairro denso: no fim está de volta, em média, perto do pormenor de partida',
    denso.degrauFinal.detalhe >= 0.85 && denso.degrauFinal.densidade >= 0.85,
    'detalhe ' + denso.degrauFinal.detalhe.toFixed(2) + ', densidade ' + denso.degrauFinal.densidade.toFixed(2)
);
verificar(
    'Bairro denso: abaixo de 30 em menos de 8% dos segundos',
    denso.abaixoDe30 < 0.08,
    'novo ' + pct(denso.abaixoDe30) + ', antigo ' +
        pct(a('Bairro denso a meio (leve→pesado→leve)').abaixoDe30)
);

verificar(
    'Pesado e muito pesado: não fica a mudar de degrau sem parar',
    n('Pesado (40 ms)').mudancas <= 25 && n('Muito pesado (70 ms)').mudancas <= 25,
    'mudanças ' + n('Pesado (40 ms)').mudancas + ' e ' + n('Muito pesado (70 ms)').mudancas
);

verificar(
    'Folga de sobra: não fica a mudar de degrau sem parar',
    n('Folga de sobra (6 ms)').mudancas <= 10,
    'mudanças ' + n('Folga de sobra (6 ms)').mudancas
);

// Os dois botões trabalham: com um bairro tão pesado que só o pormenor não
// chega, a densidade também tem de descer.
verificar(
    'Muito pesado: também desce a densidade, e não só o pormenor',
    n('Muito pesado (70 ms)').degrauFinal.densidade < 1,
    'densidade final ' + n('Muito pesado (70 ms)').degrauFinal.densidade.toFixed(2)
);

console.log(falhas ? '\n' + falhas + ' verificação(ões) falhou(aram).' : '\nTudo ok.');
process.exit(falhas ? 1 : 0);
