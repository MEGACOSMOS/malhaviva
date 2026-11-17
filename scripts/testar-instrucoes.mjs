/**
 * Prova das instruções (ver "As instruções", em public/index.html), num
 * Chrome à parte, com perfil limpo: abrem na primeira visita, cada gesto
 * feito no bairro passa ao passo seguinte, os passos com foco encontram as
 * peças (marcadores, céu, pesquisa, controlos e bússola), e a cruz do fim
 * fecha e fica lembrada. Com `--telemovel`, o mesmo num ecrã de telemóvel
 * com dedos.
 *
 * Uso, com o site a correr (`bun run dev`):
 *   bun scripts/testar-instrucoes.mjs
 *   bun scripts/testar-instrucoes.mjs --telemovel
 *   bun scripts/testar-instrucoes.mjs --fotos=C:\pasta
 *
 * Todas as linhas têm de dizer `ok`.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const telemovel = args.includes('--telemovel');
const origem = 'http://localhost:8000';
const PASTA = (args.find((a) => a.startsWith('--fotos=')) || '').slice(8) || tmpdir();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')].find(existsSync);
const L = telemovel ? 390 : 1280, A = telemovel ? 844 : 760;
const porta = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-ins-'));
const processo = spawn(chrome, [
    `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', `--window-size=${Math.max(L, 500) + 16},${A + 140}`,
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion',
    'about:blank',
], { stdio: 'ignore' });
const arrumar = () => { try { processo.kill(); } catch { } setTimeout(() => { try { rmSync(perfil, { recursive: true, force: true }); } catch { } }, 1500); };
process.on('exit', arrumar);

let alvos;
for (let i = 0; i < 60 && !alvos; i++) { try { alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json(); } catch { await dormir(500); } }
const ws = new WebSocket(alvos.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let seq = 0;
const pendentes = new Map();
const erros = [];
ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d); pendentes.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') erros.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') erros.push(d.params.args.map(a => a.value || a.description).join(' '));
};
const enviar = (method, params = {}) => new Promise((r) => { const i = ++seq; pendentes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async (expressao) => {
    const r = await enviar('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
};
const foto = async (nome) => {
    const r = await enviar('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
    writeFileSync(join(PASTA, nome + '.jpg'), Buffer.from(r.result.data, 'base64'));
};

await enviar('Page.enable');
await enviar('Page.navigate', { url: origem + '/favicon.svg' });
await dormir(800);
await enviar('Runtime.enable');
await enviar('Emulation.setDeviceMetricsOverride', { width: L, height: A, deviceScaleFactor: telemovel ? 2 : 1, mobile: telemovel });
if (telemovel) {
    await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await enviar('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    await enviar('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' });
}
await enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
await enviar('Page.navigate', { url: origem + '/creditos' });
await dormir(1500);
await avaliar(`localStorage.clear(); sessionStorage.clear(); 1`);
await enviar('Page.navigate', { url: origem + '/' });
const inicio = Date.now();
for (;;) {
    await dormir(700);
    const aberta = await avaliar(`document.getElementById('instrucoes').classList.contains('aberta')`).catch(() => false);
    if (aberta) break;
    if (Date.now() - inicio > 120000) { console.log('As instruções não abriram em 2 minutos'); process.exit(1); }
}
console.log(`instruções abertas ${((Date.now() - inicio) / 1000).toFixed(1)} s depois de abrir a página`);
await dormir(1200);

const resultados = [];
const prova = (nome, ok, detalhe = '') => { resultados.push(ok); console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '   ' + detalhe : ''}`); };
const estado = async () => JSON.parse(await avaliar(`JSON.stringify((() => {
    const c = document.querySelector('#instrucoes .instrucoes-cartao');
    const r = c.getBoundingClientRect();
    return {
        numero: c.querySelector('.instrucoes-numero').textContent,
        titulo: c.querySelector('.instrucoes-nome').textContent,
        texto: c.querySelector('.instrucoes-texto').textContent,
        feito: c.classList.contains('feito'),
        foco: document.getElementById('instrucoes').classList.contains('com-foco'),
        buracos: document.querySelectorAll('#instrucoes .ins-buracos rect').length,
        poste: document.querySelector('#instrucoes .ins-poste').getAttribute('visibility'),
        cartao: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        gesto: [...document.querySelectorAll('#instrucoes .ins-gesto.ativo')].map(d => d.dataset.gesto).join(',')
    };
})())`));
const esperarPasso = async (n, ms = 4000) => {
    const fim = Date.now() + ms;
    let e;
    do { e = await estado(); if (e.numero.startsWith(n + ' ')) return e; await dormir(150); } while (Date.now() < fim);
    return e;
};
const rato = (type, x, y, extra = {}) => enviar('Input.dispatchMouseEvent', { type, x, y, ...extra });
const toque = (type, pontos) => enviar('Input.dispatchTouchEvent', { type, touchPoints: pontos.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
const carregar = async (seletor) => {
    const c = JSON.parse(await avaliar(`JSON.stringify(document.querySelector(${JSON.stringify(seletor)}).getBoundingClientRect())`));
    const x = c.x + c.width / 2, y = c.y + c.height / 2;
    if (telemovel) { await toque('touchStart', [[x, y]]); await dormir(40); await toque('touchEnd', []); }
    else { await rato('mouseMoved', x, y); await rato('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 }); await rato('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 }); }
};

let e = await estado();
prova('passo 1: mover, com o desenho do gesto', e.numero.startsWith('1 ') && e.gesto === 'mover' && !e.foco, JSON.stringify(e));
await foto((telemovel ? 'tel-' : '') + 'ins-1');
// Arrastar o bairro.
const meioX = L / 2, meioY = A * 0.55;
if (telemovel) {
    await toque('touchStart', [[meioX, meioY]]);
    for (let i = 1; i <= 15; i++) { await toque('touchMove', [[meioX - 6 * i, meioY - 3 * i]]); await dormir(16); }
    await toque('touchEnd', []);
} else {
    await rato('mouseMoved', meioX, meioY);
    await rato('mousePressed', meioX, meioY, { button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 15; i++) { await rato('mouseMoved', meioX - 8 * i, meioY - 3 * i, { button: 'left', buttons: 1 }); await dormir(16); }
    await rato('mouseReleased', meioX - 120, meioY - 45, { button: 'left', buttons: 0, clickCount: 1 });
}
await dormir(300);
e = await estado();
prova('mover o bairro marca o passo como feito', e.feito, JSON.stringify(e));
e = await esperarPasso(2);
prova('e passa sozinho ao passo 2 (aproximar)', e.numero.startsWith('2 ') && e.gesto === 'zoom', JSON.stringify(e));
await dormir(400);
await foto((telemovel ? 'tel-' : '') + 'ins-2');
if (telemovel) {
    await toque('touchStart', [[meioX - 40, meioY], [meioX + 40, meioY]]);
    for (let i = 1; i <= 15; i++) { await toque('touchMove', [[meioX - 40 - 4 * i, meioY], [meioX + 40 + 4 * i, meioY]]); await dormir(16); }
    await toque('touchEnd', []);
} else {
    await rato('mouseWheel', meioX, meioY, { deltaX: 0, deltaY: -100 });
}
e = await esperarPasso(3);
prova('aproximar passa ao passo 3 (rodar e inclinar)', e.numero.startsWith('3 ') && e.gesto === 'rodar', JSON.stringify(e));
await dormir(500);
await foto((telemovel ? 'tel-' : '') + 'ins-3');
if (telemovel) {
    await toque('touchStart', [[meioX - 60, meioY], [meioX + 60, meioY]]);
    for (let i = 1; i <= 25; i++) {
        const ang = i * 1.6 * Math.PI / 180;
        await toque('touchMove', [[meioX - 60 * Math.cos(ang), meioY - 60 * Math.sin(ang)], [meioX + 60 * Math.cos(ang), meioY + 60 * Math.sin(ang)]]);
        await dormir(16);
    }
    await toque('touchEnd', []);
} else {
    await rato('mouseMoved', meioX, meioY);
    await rato('mousePressed', meioX, meioY, { button: 'left', buttons: 1, clickCount: 1, modifiers: 2 });
    for (let i = 1; i <= 15; i++) { await rato('mouseMoved', meioX + 6 * i, meioY, { button: 'left', buttons: 1, modifiers: 2 }); await dormir(16); }
    await rato('mouseReleased', meioX + 90, meioY, { button: 'left', buttons: 0, clickCount: 1, modifiers: 2 });
}
e = await esperarPasso(4);
await dormir(500);
e = await estado();
prova('rodar passa ao passo 4 (testemunhos e rotas), com foco', e.numero.startsWith('4 ') && e.foco && e.buracos >= 1, JSON.stringify(e));
await foto((telemovel ? 'tel-' : '') + 'ins-4');
await carregar('#instrucoes .instrucoes-seta.direita');
await dormir(700);
e = await estado();
prova('passo 5: o céu, com foco nas três peças', e.numero.startsWith('5 ') && e.foco, JSON.stringify(e));
await foto((telemovel ? 'tel-' : '') + 'ins-5');
await carregar('#instrucoes .instrucoes-seta.direita');
await dormir(700);
e = await estado();
prova('passo 6: a pesquisa, com foco', e.numero.startsWith('6 ') && e.foco && e.buracos === 1, JSON.stringify(e));
await foto((telemovel ? 'tel-' : '') + 'ins-6');
await carregar('#instrucoes .instrucoes-seta.direita');
await dormir(700);
e = await estado();
prova('passo 7: o resto (controlos e bússola)', e.numero.startsWith('7 ') && e.foco && e.buracos >= 1, JSON.stringify(e));
await foto((telemovel ? 'tel-' : '') + 'ins-7');
await carregar('#instrucoes .instrucoes-seta.direita');
await dormir(700);
const fechou = await avaliar(`!document.getElementById('instrucoes').classList.contains('aberta') && localStorage.getItem('instrucoes') === 'vistas'`);
prova('a cruz do último passo fecha e fica lembrado', fechou);
prova('sem erros na consola', erros.length === 0, erros.slice(0, 5).join(' | '));
const falhas = resultados.filter(r => !r).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} ok`);
arrumar();
process.exit(falhas ? 1 : 0);
