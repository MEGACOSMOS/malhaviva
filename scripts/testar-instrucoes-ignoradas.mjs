/**
 * Prova de "Quem as ignora" (as instruções do bairro, em public/index.html),
 * num Chrome à parte, com perfil limpo: quem anda à vontade ou abre uma
 * anotação fica sem instruções, de vez; quem faz o que elas pedem, quem só
 * falha o gesto, e quem as pediu nos Controlos continua a tê-las.
 *
 * Uso, com o site a correr (`bun run dev`):
 *   bun scripts/testar-instrucoes-ignoradas.mjs
 *   bun scripts/testar-instrucoes-ignoradas.mjs --telemovel
 *
 * Todas as linhas têm de dizer `ok`.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const telemovel = process.argv.includes('--telemovel');
const origem = 'http://localhost:8000';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')].find(existsSync);
const L = telemovel ? 390 : 1280, A = telemovel ? 844 : 760;
const porta = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-ign-'));
const processo = spawn(chrome, [
    `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', `--window-size=${Math.max(L, 500) + 16},${A + 140}`,
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion',
    '--mute-audio', 'about:blank',
], { stdio: 'ignore' });
const limpar = () => { try { processo.kill(); } catch { } setTimeout(() => { try { rmSync(perfil, { recursive: true, force: true }); } catch { } }, 1500); };
process.on('exit', limpar);

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
};
const enviar = (method, params = {}) => new Promise((r) => { const i = ++seq; pendentes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async (expressao) => {
    const r = await enviar('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
};
await enviar('Page.enable');
await enviar('Runtime.enable');
await enviar('Emulation.setDeviceMetricsOverride', { width: L, height: A, deviceScaleFactor: 1, mobile: telemovel });
if (telemovel) {
    await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await enviar('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' });
}
await enviar('Emulation.setFocusEmulationEnabled', { enabled: true });

const resultados = [];
const prova = (nome, ok, detalhe = '') => { resultados.push(ok); console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${ok ? '' : '   ' + detalhe}`); };
const aberta = () => avaliar(`document.getElementById('instrucoes').classList.contains('aberta')`);
const numero = () => avaliar(`document.querySelector('#instrucoes .instrucoes-numero').textContent`);
const guardadas = () => avaliar(`localStorage.getItem('instrucoes') === 'vistas'`);

// Uma visita nova, com as instruções abertas e prontas.
const visita = async (caminho = '/') => {
    await enviar('Page.navigate', { url: origem + '/creditos' });
    await dormir(1200);
    await avaliar(`localStorage.clear(); sessionStorage.clear(); document.cookie = 'instrucoes=; max-age=0; path=/'; 1`);
    await enviar('Page.navigate', { url: origem + caminho });
    const fim = Date.now() + 120000;
    for (;;) {
        await dormir(400);
        if (await aberta().catch(() => false)) break;
        if (Date.now() > fim) throw new Error('as instruções não abriram em 2 minutos');
    }
    await dormir(1600);
};
const passo = async (n, ms = 5000) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) { if ((await numero()).startsWith(n + ' ')) { await dormir(1200); return true; } await dormir(120); }
    return false;
};

const mx = L / 2, my = A * 0.42;
const rato = (type, x, y, extra = {}) => enviar('Input.dispatchMouseEvent', { type, x, y, ...extra });
const arrastar = async (dx, dy = 0, n = 8) => {
    await rato('mouseMoved', mx, my);
    await rato('mousePressed', mx, my, { button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= n; i++) { await rato('mouseMoved', mx + dx * i / n, my + dy * i / n, { button: 'left', buttons: 1 }); await dormir(40); }
    await rato('mouseReleased', mx + dx, my + dy, { button: 'left', buttons: 0, clickCount: 1 });
    await dormir(500);
};
const clicar = async (x = mx, y = my) => {
    await rato('mouseMoved', x, y);
    await rato('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
    await dormir(40);
    await rato('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
    await dormir(2200);
};
const toque = (type, pontos) => enviar('Input.dispatchTouchEvent', { type, touchPoints: pontos.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
const umDedo = async (dx, dy) => {
    await toque('touchStart', [[mx, my]]);
    for (let i = 1; i <= 12; i++) { await toque('touchMove', [[mx + dx * i / 12, my + dy * i / 12]]); await dormir(25); }
    await toque('touchEnd', []);
    await dormir(700);
};
const doisDedos = async (abre, sobe) => {
    await toque('touchStart', [[mx - 50, my]]);
    await toque('touchStart', [[mx - 50, my], [mx + 50, my]]);
    for (let i = 1; i <= 14; i++) { await toque('touchMove', [[mx - 50 - abre * i / 14, my + sobe * i / 14], [mx + 50 + abre * i / 14, my + sobe * i / 14]]); await dormir(25); }
    await toque('touchEnd', []);
    await dormir(700);
};
const abrirMarcador = (seletor) => avaliar(`document.querySelector(${JSON.stringify(seletor)}).click(); 1`);
const fecharJanela = async () => {
    await avaliar(`history.back(); 1`);
    for (let i = 0; i < 20; i++) {
        await dormir(200);
        if (await avaliar(`['video-modal','modal-360'].every(id => { const e = document.getElementById(id); return !e || getComputedStyle(e).display === 'none'; })`)) break;
    }
    await dormir(700);
};
const aVista = () => avaliar(`(() => { const c = document.getElementById('instrucoes'); const s = getComputedStyle(c); return !c.hidden && s.visibility !== 'hidden' && +s.opacity > 0.02; })()`);

if (!telemovel) {
    await visita();
    await arrastar(160); await arrastar(-160);
    prova('olhar à volta duas vezes no passo 1 ainda não as manda embora', await aberta());
    await arrastar(160);
    prova('à terceira vão-se embora, e fica guardado', !(await aberta()) && await guardadas());
    await dormir(600);
    prova('e já não se vêem', !(await aVista()));
    await enviar('Page.navigate', { url: origem + '/' });
    await dormir(12000);
    prova('na visita seguinte não aparecem', !(await aberta()));

    await visita();
    for (let i = 0; i < 4; i++) await arrastar(14, 0, 3);
    prova('cliques que escorregam uns pontos não contam', await aberta(), await numero());

    await visita();
    await enviar('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
    await dormir(4600);
    await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
    prova('andar de tecla sem parar manda-as embora', !(await aberta()));

    await visita();
    for (let i = 0; i < 3; i++) { await rato('mouseWheel', mx, my, { deltaX: 0, deltaY: 100 }); await dormir(1000); }
    prova('afastar três vezes com a roda no passo 1 manda-as embora', !(await aberta()));

    await visita();
    await abrirMarcador('.annotation-marker[data-tipo="testemunho"]');
    await dormir(150);
    prova('abrir um testemunho no passo 1: somem logo, sem se esbaterem por cima dele', !(await aberta()) && !(await aVista()));
    await dormir(800);
    await fecharJanela();
    prova('e fechado o testemunho não voltam', !(await aberta()) && !(await aVista()) && await guardadas());

    await visita();
    await abrirMarcador('.annotation-marker[data-tipo="360"]:not(.marcador-do-ceu)');
    await dormir(500);
    prova('abrir uma rota no passo 1 manda-as embora', !(await aberta()));

    await visita();
    await abrirMarcador('.annotation-marker.marcador-do-ceu');
    await dormir(500);
    prova('abrir uma do céu no passo 1 manda-as embora', !(await aberta()));

    await visita();
    await clicar();
    prova('clicar (o que o passo 1 pede) passa ao passo 2', await passo(2), await numero());
    // Nem todo o clique acerta no bairro: contam os que levam a câmara.
    await avaliar(`window.idas = 0; window.addEventListener('gestoNoBairro', e => { if (e.detail.gesto === 'ir') window.idas++; }); 1`);
    let antesDaTerceira = true;
    for (let i = 0; i < 10 && await avaliar('window.idas') < 3; i++) {
        if (!(await aberta())) antesDaTerceira = false;
        await clicar(mx + (i % 2 ? 260 : -260), my + 60 + 70 * (i % 3));
    }
    prova('continuar a clicar no passo 2 manda-as embora, à terceira e não antes', antesDaTerceira && !(await aberta()), 'idas ' + await avaliar('window.idas'));

    await visita();
    await clicar();
    await passo(2);
    await arrastar(160);
    prova('arrastar passa ao passo 3', await passo(3), await numero());
    await rato('mouseWheel', mx, my, { deltaX: 0, deltaY: -100 });
    prova('a roda passa ao passo 4, e continuam abertas', await passo(4) && await aberta(), await numero());
    await abrirMarcador('.annotation-marker[data-tipo="testemunho"]');
    await dormir(700);
    prova('abrir um testemunho no passo que o convida: esperam escondidas', await aberta() && !(await aVista()));
    await fecharJanela();
    prova('e voltam quando ele fecha, no mesmo passo', await aberta() && await aVista() && (await numero()).startsWith('4 '));
    for (let i = 0; i < 5; i++) await arrastar(i % 2 ? 90 : -90);
    prova('andar à vontade num passo de ler manda-as embora, à quinta', !(await aberta()));

    await visita('/?instrucoes');
    for (let i = 0; i < 6; i++) await arrastar(i % 2 ? 160 : -160);
    prova('pedidas nos Controlos, andar à vontade não as fecha', await aberta());
    await abrirMarcador('.annotation-marker[data-tipo="testemunho"]');
    await dormir(700);
    await fecharJanela();
    prova('nem abrir um testemunho', await aberta() && await aVista());
} else {
    await visita();
    await umDedo(-70, 60);
    prova('mover com um dedo passa ao passo 2', await passo(2), await numero());
    await umDedo(70, -60); await umDedo(-70, 60);
    prova('mover mais duas vezes ainda não as manda embora', await aberta());
    await umDedo(70, -60);
    prova('à terceira vão-se embora, e fica guardado', !(await aberta()) && await guardadas());

    await visita();
    for (let i = 0; i < 4 && !(await numero()).startsWith('2 '); i++) { await umDedo(-70, 60); await passo(2); }
    for (let i = 0; i < 4; i++) await doisDedos(0, i % 2 ? 90 : -90);
    prova('falhar o gesto de dois dedos não as manda embora', await aberta());
    await doisDedos(60, 0);
    prova('e fazê-lo passa ao passo 3', await passo(3), await numero());

    await visita();
    await abrirMarcador('.annotation-marker[data-tipo="testemunho"]');
    await dormir(500);
    prova('abrir um testemunho manda-as embora', !(await aberta()) && await guardadas());
    await fecharJanela();
    prova('e não voltam', !(await aVista()));
}
prova('sem erros na página', erros.length === 0, erros.slice(0, 4).join(' | '));
const falhas = resultados.filter((r) => !r).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} ok`);
limpar();
process.exit(falhas ? 1 : 0);
