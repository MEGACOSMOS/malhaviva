/**
 * Faz o ícone do site — o do separador do navegador — com as iniciais do
 * projecto: o "M" de MALHA, na letra cheia, e o "V" de VIVA, na letra de
 * fio, tirados do próprio logótipo (`public/logotipo.js`).
 *
 * Não tem fundo: as letras ficam por cima da cor do separador, e por isso
 * há duas — escuras (a cor do fundo do site) para o navegador em modo
 * claro, e brancas para o navegador em modo escuro. Quem escolhe uma ou
 * outra é `public/icone.js`.
 *
 * O fio do "V" é fino de mais para se ver num ícone de 16 pontos: aqui
 * leva um contorno da mesma cor, que o engrossa sem lhe mudar a forma. E
 * o "V" é acertado ao tamanho do "M" — a mesma altura e a mesma largura,
 * contorno incluído —, porque com o contorno, e mais largo do que o "M"
 * como é no logótipo, parecia maior do que ele.
 *
 * Escreve em `public/`:
 *   favicon.svg            o ícone em desenho, que muda de cor sozinho ao
 *                          abrir a página (é o que fica sem icone.js)
 *   favicon-escuro.svg     letras escuras, para o navegador em modo claro
 *   favicon-claro.svg      letras brancas, para o navegador em modo escuro
 *   favicon.ico            letras escuras, 16, 32 e 48 pontos, para os
 *                          navegadores que não lêem desenhos (e para quem
 *                          o pede sem a página dizer onde está)
 *   favicon-claro.ico      o mesmo, com letras brancas
 *   apple-touch-icon.png   180 pontos, para o ecrã principal do iPhone —
 *                          este com o fundo escuro do site, porque o
 *                          iPhone pinta de preto o que for transparente
 *
 * Para o passar a imagens abre um Chrome à parte, sem janela, e desenha-o
 * lá. Corre-se de novo se o logótipo mudar:
 *
 *   bun scripts/fazer-icone.mjs
 *
 * Se o Chrome não for encontrado, diz-se onde está com CHROME=caminho.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const publico = join(raiz, 'public');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const r = (n) => Math.round(n * 1000) / 1000;

// ---- O desenho ----

// As letras do logótipo, tal como lá estão.
const logotipo = readFileSync(join(publico, 'logotipo.js'), 'utf8');
const desenho = logotipo.match(/var DESENHO = '([^']+)'/)[1];
const pedacos = desenho.split('Z').filter((p) => p.trim()).map((p) => p.trim() + 'Z');

/** Onde começa um pedaço do desenho, da esquerda: o x do primeiro ponto. */
const inicioDe = (pedaco) => Number(pedaco.match(/^M\s*([\d.]+)/)[1]);

// O "M" é o primeiro pedaço do logótipo; o "V" é o primeiro de VIVA, que
// começa depois dos 440 (o fim de MALHA).
const letraM = pedacos[0];
const letraV = pedacos.find((p) => inicioDe(p) > 440);

// As medidas das duas letras no logótipo (de x0 a x1, e de y0 a y1).
const M = { x0: 0, x1: 78.42, y0: 3.05, y1: 121.25 };
const V = { x0: 455.87, x1: 543.19, y0: 3.05, y1: 123.4 };

const ESCURO = '#05050a';  // a cor do fundo do site
const CLARO = '#ffffff';
const FIO_DO_V = 9;        // o contorno que engrossa o fio do "V"
const ENTRE_LETRAS = 18;   // o espaço entre as duas

/**
 * Muda os números de um desenho: cada x por fx(x), e cada y por fy(y).
 * Os desenhos do logótipo só usam ordens absolutas: M, L e Q levam pares
 * x y, H só x, e V só y.
 */
function mexer(d, fx, fy) {
    let ordem = '';
    let i = 0;
    return d.replace(/([MLHVQZ])|(-?[\d.]+)/g, (_, letra, numero) => {
        if (letra) {
            ordem = letra;
            i = 0;
            return letra;
        }
        const v = Number(numero);
        const novo = ordem === 'H' ? fx(v) : ordem === 'V' ? fy(v) : i % 2 === 0 ? fx(v) : fy(v);
        i++;
        return String(r(novo));
    });
}

// O "V" é acertado para que, com o contorno, ocupe a mesma caixa do "M":
// do cimo à base dele, e da mesma largura. Fica com as pontas direitas,
// como no logótipo.
const alturaM = M.y1 - M.y0;
const larguraM = M.x1 - M.x0;
const meioFio = FIO_DO_V / 2;
const escalaX = (larguraM - FIO_DO_V) / (V.x1 - V.x0);
const escalaY = (alturaM - FIO_DO_V) / (V.y1 - V.y0);
const inicioV = M.x1 + ENTRE_LETRAS + meioFio;
const desenhoV = mexer(letraV,
    (x) => inicioV + escalaX * (x - V.x0),
    (y) => M.y0 + meioFio + escalaY * (y - V.y0));
const largura = 2 * larguraM + ENTRE_LETRAS;

/**
 * As duas letras, com o canto de cima à esquerda em (x, y).
 *
 * @param {number} x
 * @param {number} y
 * @param {string} cor - A cor das letras (ou currentColor).
 */
function letras(x, y, cor) {
    return `<g fill="${cor}" transform="translate(${r(x - M.x0)} ${r(y - M.y0)})">` +
        `<path d="${letraM}"/>` +
        `<path d="${desenhoV}" stroke="${cor}" stroke-width="${FIO_DO_V}"/>` +
        `</g>`;
}

/**
 * O ícone num quadrado, com as letras ao meio.
 *
 * @param {object} o
 * @param {number} o.folga - O espaço de cada lado das letras.
 * @param {string} [o.cor] - A cor das letras; sem ela, mudam com o modo
 *     do navegador.
 * @param {string} [o.fundo] - A cor do fundo; sem ela, não há fundo.
 */
function icone({ folga, cor, fundo }) {
    const lado = r(largura + 2 * folga);
    const estilo = cor ? '' :
        `<style>svg{color:${ESCURO}}@media (prefers-color-scheme:dark){svg{color:${CLARO}}}</style>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}">` + estilo +
        (fundo ? `<rect width="${lado}" height="${lado}" fill="${fundo}"/>` : '') +
        letras(folga, (lado - alturaM) / 2, cor || 'currentColor') +
        `</svg>\n`;
}

// No separador as letras vão quase de beira a beira: sem fundo, não há
// quadrado nenhum a mostrar a folga. No iPhone, o ícone é um quadrado de
// cantos redondos, e as letras afastam-se deles.
const separador = { folga: 4 };
const iphone = { folga: 28, cor: CLARO, fundo: ESCURO };

const desenhos = {
    'favicon.svg': icone(separador),
    'favicon-escuro.svg': icone({ ...separador, cor: ESCURO }),
    'favicon-claro.svg': icone({ ...separador, cor: CLARO }),
};
for (const [nome, svg] of Object.entries(desenhos)) {
    writeFileSync(join(publico, nome), svg);
    console.log(nome);
}

// ---- As imagens, num Chrome à parte ----

function acharChrome() {
    const candidatos = [
        process.env.CHROME,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
    ];
    return candidatos.find((c) => c && existsSync(c));
}

const chrome = acharChrome();
if (!chrome) { console.error('Chrome não encontrado. Diz onde está com CHROME=caminho.'); process.exit(2); }
const porta = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-icone-'));
const processo = spawn(chrome, [
    '--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });
function arrumar() {
    try { processo.kill(); } catch { /* já saiu */ }
    setTimeout(() => { try { rmSync(perfil, { recursive: true, force: true }); } catch { /* ainda aberto */ } }, 1500);
}
process.on('exit', arrumar);

let alvos;
for (let i = 0; i < 60 && !alvos; i++) {
    try { alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json(); } catch { await dormir(500); }
}
if (!alvos) { console.error('O Chrome não abriu.'); process.exit(2); }
const ws = new WebSocket(alvos.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let seq = 0;
const pendentes = new Map();
ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d); pendentes.delete(d.id); }
};
const enviar = (method, params = {}) => new Promise((r) => { const i = ++seq; pendentes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

/** Um desenho num PNG de n por n pontos, desenhado pelo Chrome a esse tamanho. */
async function png(svg, n) {
    const comTamanho = svg.replace('<svg ', `<svg width="${n}" height="${n}" `);
    const resposta = await enviar('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
            const img = new Image();
            img.src = URL.createObjectURL(new Blob([${JSON.stringify(comTamanho)}], { type: 'image/svg+xml' }));
            await img.decode();
            const tela = document.createElement('canvas');
            tela.width = tela.height = ${n};
            tela.getContext('2d').drawImage(img, 0, 0, ${n}, ${n});
            return tela.toDataURL('image/png').split(',')[1];
        })()`,
    });
    if (resposta.result.exceptionDetails) throw new Error(JSON.stringify(resposta.result.exceptionDetails));
    return Buffer.from(resposta.result.result.value, 'base64');
}

/** Um .ico: uma lista de PNGs com um índice à frente. */
async function ico(svg) {
    const tamanhos = [16, 32, 48];
    const imagens = [];
    for (const n of tamanhos) imagens.push(await png(svg, n));
    const cabeca = Buffer.alloc(6 + 16 * imagens.length);
    cabeca.writeUInt16LE(0, 0);
    cabeca.writeUInt16LE(1, 2);
    cabeca.writeUInt16LE(imagens.length, 4);
    let onde = cabeca.length;
    imagens.forEach((dados, i) => {
        const e = 6 + 16 * i;
        cabeca.writeUInt8(tamanhos[i] % 256, e);
        cabeca.writeUInt8(tamanhos[i] % 256, e + 1);
        cabeca.writeUInt16LE(1, e + 4);
        cabeca.writeUInt16LE(32, e + 6);
        cabeca.writeUInt32LE(dados.length, e + 8);
        cabeca.writeUInt32LE(onde, e + 12);
        onde += dados.length;
    });
    return Buffer.concat([cabeca, ...imagens]);
}

writeFileSync(join(publico, 'favicon.ico'), await ico(desenhos['favicon-escuro.svg']));
console.log('favicon.ico');
writeFileSync(join(publico, 'favicon-claro.ico'), await ico(desenhos['favicon-claro.svg']));
console.log('favicon-claro.ico');
writeFileSync(join(publico, 'apple-touch-icon.png'), await png(icone(iphone), 180));
console.log('apple-touch-icon.png');

arrumar();
process.exit(0);
