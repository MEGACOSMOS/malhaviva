/**
 * Faz o ícone do site — o quadradinho do separador do navegador — com as
 * iniciais do projecto: o "M" de MALHA, na letra cheia, e o "V" de VIVA,
 * na letra de fio, tirados do próprio logótipo (`public/logotipo.js`),
 * brancos num quadrado da cor do fundo do site.
 *
 * O fio do "V" é fino de mais para se ver num ícone de 16 pontos: aqui
 * leva um contorno da mesma cor, que o engrossa sem lhe mudar a forma.
 *
 * Escreve em `public/`:
 *   favicon.svg            o ícone em desenho, para os navegadores que o lêem
 *   favicon.ico            16, 32 e 48 pontos, para os outros (e para quem
 *                          o pede sem a página dizer onde está)
 *   apple-touch-icon.png   180 pontos, para o ecrã principal do iPhone
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

const FIO_DO_V = 9;        // o contorno que engrossa o fio do "V"
const ENTRE_LETRAS = 18;   // o espaço entre as duas
const LADO = 220;          // o quadrado, com pouca folga à volta das letras

const meioFio = FIO_DO_V / 2;
const puxarV = V.x0 - (M.x1 + ENTRE_LETRAS + meioFio);
const largura = V.x1 - puxarV + meioFio - M.x0;
const topo = Math.min(M.y0, V.y0 - meioFio);
const fundo = Math.max(M.y1, V.y1 + meioFio);
const dx = (LADO - largura) / 2 - M.x0;
const dy = (LADO - (fundo - topo)) / 2 - topo;
const r = (n) => Math.round(n * 100) / 100;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO} ${LADO}">` +
    `<rect width="${LADO}" height="${LADO}" fill="#05050a"/>` +
    `<g fill="#fff" transform="translate(${r(dx)} ${r(dy)})">` +
    `<path d="${letraM}"/>` +
    `<path d="${letraV}" transform="translate(${r(-puxarV)} 0)" stroke="#fff" stroke-width="${FIO_DO_V}" stroke-linejoin="round"/>` +
    `</g></svg>\n`;
writeFileSync(join(publico, 'favicon.svg'), svg);
console.log('favicon.svg');

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

/** O ícone num PNG de n por n pontos, desenhado pelo Chrome a esse tamanho. */
async function png(n) {
    const comTamanho = svg.replace('<svg ', `<svg width="${n}" height="${n}" `);
    const r = await enviar('Runtime.evaluate', {
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
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return Buffer.from(r.result.result.value, 'base64');
}

// O .ico é uma lista de PNGs com um índice à frente.
const tamanhos = [16, 32, 48];
const imagens = [];
for (const n of tamanhos) imagens.push(await png(n));
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
writeFileSync(join(publico, 'favicon.ico'), Buffer.concat([cabeca, ...imagens]));
console.log('favicon.ico');

writeFileSync(join(publico, 'apple-touch-icon.png'), await png(180));
console.log('apple-touch-icon.png');

arrumar();
process.exit(0);
