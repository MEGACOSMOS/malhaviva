/**
 * Prova dos modos de qualidade (Baixo, Médio, Alto) e da escolha automática,
 * num Chrome à parte com a placa gráfica a sério.
 *
 * Confere que cada modo abre como deve, que se passa de um para outro sem
 * recarregar quando se pode, que a escolha automática sobe com folga e desce
 * com um peso artificial, que o que se mediu fica para a visita seguinte, que
 * as escolhas antigas (`auto` e `max`) ainda se entendem, e que uma queda da
 * placa gráfica passa para o modo mais leve.
 *
 *     bun scripts/testar-modos.mjs [http://localhost:8000] [--fotos=pasta]
 *
 * Todas as linhas têm de dizer `ok`. O Chrome abre sem janela, para o teste
 * correr também com o ecrã desligado. Se não for encontrado: CHROME=caminho.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const origem = (args.find((a) => a.startsWith('http')) || 'http://localhost:8000').replace(/\/$/, '');
const fotos = (args.find((a) => a.startsWith('--fotos=')) || '').slice(8);
if (fotos) mkdirSync(fotos, { recursive: true });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = [
    process.env.CHROME,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome'
].find((c) => c && existsSync(c));
if (!chrome) { console.error('Chrome não encontrado. Diz onde está com CHROME=caminho.'); process.exit(2); }

const porta = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-modos-'));
const processo = spawn(chrome, [
    `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--headless=new', '--use-angle=d3d11', '--ignore-gpu-blocklist',
    '--no-first-run', '--no-default-browser-check', '--window-size=1300,900',
    'about:blank'
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
const ws = new WebSocket(alvos.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let seq = 0;
let cargas = 0;
const pendentes = new Map();
const erros = [];
ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d); pendentes.delete(d.id); return; }
    if (d.method === 'Page.frameNavigated' && !d.params.frame.parentId) cargas++;
    if (d.method === 'Runtime.exceptionThrown') erros.push('EXC ' + JSON.stringify(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails).slice(0, 400));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
        erros.push(d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    }
};
const enviar = (method, params = {}) => new Promise((r) => { const i = ++seq; pendentes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async (expressao) => {
    const r = await enviar('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) return 'ERRO: ' + JSON.stringify(r.result.exceptionDetails.exception?.description).slice(0, 300);
    return r.result?.result?.value;
};
await enviar('Runtime.enable');
await enviar('Page.enable');
const computador = () => enviar('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await computador();

let falhas = 0;
function verificar(descricao, condicao, detalhe) {
    if (!condicao) falhas++;
    console.log((condicao ? 'ok     ' : 'FALHA  ') + descricao + (condicao ? '' : '  (' + JSON.stringify(detalhe) + ')'));
}
async function esperar(expressao, segundos) {
    for (let i = 0; i < segundos * 2; i++) {
        if (await avaliar(expressao) === true) return true;
        await dormir(500);
    }
    return false;
}
const aberto = `(() => { const o = document.getElementById('loading-overlay'); return !!o && o.classList.contains('hidden') && !!document.querySelector('pc-app')?.app; })()`;
async function abrir(preparar) {
    await enviar('Page.navigate', { url: origem + '/creditos' });
    await dormir(1200);
    await avaliar(`localStorage.setItem('instrucoes-vistas', '1'); ${preparar || ''}; 1`);
    await enviar('Page.navigate', { url: origem + '/' });
    await dormir(1500);
    return esperar(aberto, 90);
}
const estado = async () => JSON.parse(await avaliar(`(() => {
    const app = document.querySelector('pc-app').app;
    const cam = app.root.findByName('camera');
    let inst = null;
    const dados = app.renderer.gsplatDirector && app.renderer.gsplatDirector.camerasMap.get(cam.camera.camera);
    if (dados) for (const l of dados.layersMap.values()) { const w = l.gsplatManager && l.gsplatManager.world; if (w && w._octreeInstances) for (const i of w._octreeInstances.values()) inst = i; }
    let finos = 0, meios = 0;
    if (inst) inst.nodeInfos.forEach((n) => { if (n.currentLod === 0) finos++; else if (n.currentLod === 1) meios++; });
    return JSON.stringify({
        modo: window.actualQuality, misto: !!window.bairroMisto, malha: !!window.bairroEmMalha,
        automatica: document.getElementById('qualidade-automatica').checked,
        marcado: (document.querySelector('input[name=quality]:checked') || {}).value || null,
        botoes: [...document.querySelectorAll('input[name=quality]')].map((i) => i.value).join(' '),
        guardada: localStorage.getItem('quality'), medida: JSON.parse(localStorage.getItem('qualidade-medida') || 'null'),
        distancia: Math.round(window.distanciaDoDetalhe || 0), densidade: app.graphicsDevice.maxPixelRatio, finos, meios
    });
})()`));
const carregar = (id) => avaliar(`document.getElementById('${id}').click(); 1`);
const por = (x, y, z, fx, fy, fz) => avaliar(`(async () => { const pc = await import('playcanvas'); const c = document.querySelector('pc-app').app.root.findByName('camera').script.cameraControls; c._initialY = 1e9; c.recenter(new pc.Vec3(${x},${y},${z}), new pc.Vec3(${fx},${fy},${fz})); return 1; })()`);
async function foto(nome) {
    if (!fotos) return;
    const r = await enviar('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    writeFileSync(join(fotos, nome + '.jpg'), Buffer.from(r.result.data, 'base64'));
}
const pesar = (ms) => avaliar(`(() => { window.__peso = ${ms}; if (!window.__pesado) { window.__pesado = true; document.querySelector('pc-app').app.on('update', () => { const f = performance.now() + (window.__peso || 0); while (performance.now() < f) { /* peso */ } }); } return 1; })()`);

// --- Aparelho novo, escolha automática ----------------------------------
verificar('abre num aparelho novo', await abrir('localStorage.removeItem("quality"); localStorage.removeItem("qualidade-medida")'));
let e = await estado();
verificar('só há três modos no menu: Alto, Médio e Baixo', e.botoes === 'high med low', e.botoes);
verificar('um aparelho novo abre no Médio, com a escolha automática ligada', e.modo === 'med' && e.automatica && e.marcado === 'med' && e.misto, e);
await por(-30, 25, 70, 10, 0, 10);
let antes = cargas;
verificar('com folga, sobe sozinho ao Alto', await esperar(`window.actualQuality === 'high'`, 180), await estado());
verificar('o pormenor cresce até à distância do Alto', await esperar(`window.distanciaDoDetalhe === 600`, 20), await estado());
await dormir(12000);
e = await estado();
verificar('sobe sem recarregar a página, e o menu acompanha', cargas === antes && e.marcado === 'high' && e.automatica, e);
verificar('no Alto há muito mais pedaços finos', e.finos > 400, e);
verificar('o Alto fica guardado para a visita seguinte', e.medida && e.medida.modo === 'high' && e.guardada === null, e);
await foto('alto');
await carregar('definicoes-btn');
await dormir(500);
await foto('menu');
verificar('a visita seguinte abre logo no Alto', await abrir() && (await estado()).modo === 'high', await estado());

// --- À mão ----------------------------------------------------------------
antes = cargas;
await por(-30, 25, 70, 10, 0, 10);
await carregar('radio-med');
await dormir(500);
e = await estado();
verificar('escolher o Médio: sem recarregar, e desliga a escolha automática', cargas === antes && e.modo === 'med' && !e.automatica && e.guardada === 'med' && e.distancia === 100, e);
await dormir(15000);
e = await estado();
verificar('à mão, não muda sozinho', e.modo === 'med' && e.distancia === 100, e);
await foto('medio');
await carregar('radio-low');
await dormir(2000);
verificar('escolher o Baixo: abre na malha, como no telemóvel', await esperar(aberto, 60) && cargas === antes + 1, cargas - antes);
e = await estado();
verificar('no Baixo não há manchas do bairro', e.malha && !e.misto && e.modo === 'low' && e.marcado === 'low' && !e.automatica, e);
await por(-30, 25, 70, 10, 0, 10);
await dormir(3000);
await foto('baixo');
await carregar('qualidade-automatica');
await dormir(2000);
verificar('ligar a escolha automática no Baixo: volta ao Médio', await esperar(aberto, 60), null);
e = await estado();
verificar('... e o menu diz que é o site que escolhe', e.modo === 'med' && e.automatica && e.misto, e);

// --- Desce com peso -------------------------------------------------------
await abrir('localStorage.removeItem("quality"); localStorage.removeItem("qualidade-medida")');
await por(-30, 25, 70, 10, 0, 10);
await dormir(6000);
antes = cargas;
await pesar(70);
verificar('com um peso de 70 ms por imagem, desce ao Baixo sozinho', await esperar(`window.actualQuality === 'low'`, 30), await estado());
await pesar(0);
await dormir(6000);
e = await estado();
verificar('desce sem recarregar, e todas as manchas passam a malha', cargas === antes && e.finos === 0 && e.meios === 0 && e.marcado === 'low' && e.automatica, e);
await foto('baixo-sem-recarregar');
verificar('não volta a subir logo a seguir', !(await esperar(`window.actualQuality !== 'low'`, 25)), await estado());
verificar('a visita seguinte abre no Baixo', await abrir() && (await estado()).malha, await estado());

// --- Um modo que caiu duas vezes fica de parte ------------------------------
await abrir('localStorage.removeItem("quality"); localStorage.setItem("qualidade-medida", JSON.stringify({ modo: "high", quando: Date.now(), quedas: { high: [Date.now(), Date.now()] } }))');
verificar('com duas quedas recentes do Alto, abre no Médio', (await estado()).modo === 'med', await estado());
await por(-30, 25, 70, 10, 0, 10);
verificar('... e não o volta a tentar', !(await esperar(`window.actualQuality === 'high'`, 25)), await estado());

// --- Escolhas antigas ---------------------------------------------------
await abrir('localStorage.removeItem("qualidade-medida"); localStorage.setItem("quality", "max")');
e = await estado();
verificar('quem tinha o Máximo abre no Alto, escolhido à mão', e.modo === 'high' && !e.automatica && e.marcado === 'high', e);
await abrir('localStorage.setItem("quality", "auto")');
e = await estado();
verificar('quem tinha o Automático fica com a escolha automática', e.modo === 'med' && e.automatica, e);

// --- A placa gráfica cai --------------------------------------------------
await abrir('localStorage.removeItem("qualidade-medida"); localStorage.setItem("quality", "high")');
await avaliar(`document.querySelector('pc-app').app.graphicsDevice.gl.getExtension('WEBGL_lose_context').loseContext(); 1`);
await dormir(4000);
verificar('a placa cai no Alto: volta a abrir', await esperar(aberto, 60), null);
e = await estado();
verificar('... no Médio, com a escolha automática', e.modo === 'med' && e.automatica && e.guardada === null, e);
await avaliar(`document.querySelector('pc-app').app.graphicsDevice.gl.getExtension('WEBGL_lose_context').loseContext(); 1`);
await dormir(4000);
await esperar(aberto, 60);
e = await estado();
verificar('a placa cai no Médio: abre no Baixo', e.modo === 'low' && e.malha && (await avaliar('!window.modoDePoupanca')), e);
await avaliar(`document.querySelector('pc-app').app.graphicsDevice.gl.getExtension('WEBGL_lose_context').loseContext(); 1`);
await dormir(4000);
await esperar(aberto, 60);
e = await estado();
verificar('a placa cai no Baixo: modo de poupança, sem modo marcado', (await avaliar('window.modoDePoupanca')) === true && e.marcado === null, e);
await avaliar('sessionStorage.clear(); 1');

// --- Telemóvel ------------------------------------------------------------
await enviar('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36' });
await enviar('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true });
await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await abrir('localStorage.removeItem("quality"); localStorage.removeItem("qualidade-medida")');
e = await estado();
verificar('no telemóvel abre no Baixo, com a escolha automática', e.modo === 'low' && e.malha && e.automatica, e);
await dormir(20000);
e = await estado();
verificar('... e nunca guarda que pode subir', !e.medida || e.medida.modo === 'low', e);

const aSerio = erros.filter((x) => !/registry already|CONTEXT_LOST|context lost|Failed to load resource/i.test(x));
verificar('sem erros na consola', aSerio.length === 0, aSerio.slice(0, 4));
console.log(falhas ? `\n${falhas} com falha.` : '\nTudo certo.');
await enviar('Page.navigate', { url: 'about:blank' });
arrumar();
setTimeout(() => process.exit(falhas ? 1 : 0), 500);
