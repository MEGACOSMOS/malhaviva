/**
 * Prova dos modos de qualidade (Baixo, Médio, Alto) e da escolha automática,
 * num Chrome à parte com a placa gráfica a sério.
 *
 * Confere que cada modo abre como deve; que entre o Médio e o Alto, nos dois
 * sentidos, há o ecrã de espera da abertura, e que quando ele sai está tudo
 * carregado, ande-se por onde se andar;
 * que a escolha automática sobe com folga e desce com um peso artificial, sem
 * interromper ninguém; que mal se escolhe à mão o site deixa de escolher; que o
 * que se mediu fica para a visita seguinte; que as escolhas antigas (`auto` e
 * `max`) ainda se entendem; e que uma queda da placa gráfica desce um modo.
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
    return esperar(aberto, 240);
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
        automatica: !window.qualidade.escolhida(),
        aChegar: (() => { let n = 0; if (dados) for (const l of dados.layersMap.values()) { const w = l.gsplatManager && l.gsplatManager.world; if (w) n += w.pendingLoadCount; } return n; })(),
        ficheiros: inst ? inst.octree.files.filter((f, i) => f.lodLevel < 2 && inst.octree.getFileResource(i)).length + '/' + inst.octree.files.filter((f) => f.lodLevel >= 0 && f.lodLevel < 2).length : null,
        porAcertar: inst ? inst.nodeInfos.filter((n) => n.currentLod !== n.optimalLod || (n.currentLod >= 0 && !(n.vista >= 0.99))).length : 0,
        marcado: (document.querySelector('input[name=quality]:checked') || {}).value || null,
        botoes: [...document.querySelectorAll('input[name=quality]')].map((i) => i.value).join(' '),
        guardada: localStorage.getItem('quality'), medida: JSON.parse(localStorage.getItem('qualidade-medida') || 'null'),
        distancia: Math.round(window.distanciaDoDetalhe || 0), densidade: app.graphicsDevice.maxPixelRatio, finos, meios
    });
})()`));
const carregar = (id) => avaliar(`document.getElementById('${id}').click(); 1`);
// Um clique a sério, com o rato, no sítio do ecrã onde a coisa está.
const clicar = async (seletor) => {
    const c = JSON.parse(await avaliar(`(() => { const r = document.querySelector('${seletor}').getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()`));
    await enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
    await enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    await enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    await dormir(400);
};
const por = (x, y, z, fx, fy, fz) => avaliar(`(async () => { const pc = await import('playcanvas'); const c = document.querySelector('pc-app').app.root.findByName('camera').script.cameraControls; c._initialY = 1e9; c.recenter(new pc.Vec3(${x},${y},${z}), new pc.Vec3(${fx},${fy},${fz})); return 1; })()`);
async function foto(nome) {
    if (!fotos) return;
    const r = await enviar('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    writeFileSync(join(fotos, nome + '.jpg'), Buffer.from(r.result.data, 'base64'));
}
const pesar = (ms) => avaliar(`(() => { window.__peso = ${ms}; if (!window.__pesado) { window.__pesado = true; document.querySelector('pc-app').app.on('update', () => { const f = performance.now() + (window.__peso || 0); while (performance.now() < f) { /* peso */ } }); } return 1; })()`);

const ecraPosto = `!document.getElementById('loading-overlay').classList.contains('hidden')`;
const ecraFora = `document.getElementById('loading-overlay').classList.contains('hidden')`;
// O ecrã de espera tal como na abertura do site: o logótipo, sem o quadrado.
const ecraDaAbertura = `(() => { const o = document.getElementById('loading-overlay'); const alto = (s) => o.querySelector(s).getBoundingClientRect().height; return !o.classList.contains('hidden') && o.dataset.momento === 'abertura' && alto('.loading-logotipo') > 10 && alto('.loading-square') === 0 && getComputedStyle(o).opacity === '1' && o.querySelector('.loading-text').textContent === window.Idiomas.t('carga.modelo') && !o.querySelector('button'); })()`;
const rede = (mbit) => enviar('Network.emulateNetworkConditions', { offline: mbit === 0, latency: mbit === null ? 0 : 30, downloadThroughput: mbit ? mbit * 125000 : -1, uploadThroughput: mbit ? 1e6 : -1 });
await enviar('Network.enable');
// Passeia pelo bairro e diz quantas vezes alguma coisa teve de vir da rede.
const passear = async () => {
    let vezes = 0;
    for (const [x, z, fx, fz] of [[-150, -120, -60, -60], [120, 60, 40, 0], [0, 180, 0, 60], [-40, -200, 0, -100], [60, -60, 130, -120]]) {
        await por(x, 18, z, fx, 0, fz);
        for (let k = 0; k < 6; k++) { await dormir(250); if ((await estado()).aChegar > 0) vezes++; }
    }
    return vezes;
};
// No Alto o resto do bairro vem por trás, depois de abrir.
const inteiro = () => esperar(`window.distanciaDoDetalhe === 300 && (() => { for (const m of window.lodFoco.mapasMistos) { if (m.pending.size) return false; for (const n of m.nodeInfos) if (n.currentLod !== n.optimalLod || (n.currentLod >= 0 && !(n.vista >= 0.99))) return false; } return true; })()`, 240);
const limpo = 'localStorage.removeItem("quality"); localStorage.removeItem("qualidade-medida")';

// --- Aparelho novo, escolha automática ----------------------------------
verificar('abre num aparelho novo', await abrir(limpo));
let e = await estado();
verificar('só há três modos no menu: Alto, Médio e Baixo', e.botoes === 'high med low' && await avaliar(`!document.getElementById('qualidade-automatica')`), e.botoes);
verificar('um aparelho novo abre no Médio, escolhido pelo site', e.modo === 'med' && e.automatica && e.marcado === 'med' && e.misto, e);
await por(-30, 25, 70, 10, 0, 10);
let antes = cargas;
await avaliar(`window.__ecra = 0; new MutationObserver(() => { if (${ecraPosto}) window.__ecra++; }).observe(document.getElementById('loading-overlay'), { attributes: true, attributeFilter: ['class'] }); 1`);
verificar('com folga, sobe sozinho ao Alto', await esperar(`window.actualQuality === 'high'`, 240), await estado());
e = await estado();
verificar('... só depois de cá estar tudo', e.aChegar === 0 && e.ficheiros.split('/')[0] === e.ficheiros.split('/')[1] && e.distancia === 300, e);
await dormir(5000);
e = await estado();
verificar('... sem recarregar e sem ecrã de espera, e o menu acompanha', cargas === antes && e.marcado === 'high' && e.automatica && await avaliar('window.__ecra === 0'), e);
verificar('no Alto há muito mais pedaços finos', e.finos > 400 && e.porAcertar === 0, e);
verificar('o Alto fica guardado para a visita seguinte', e.medida && e.medida.modo === 'high' && e.guardada === null, e);
await foto('alto');
await clicar('#definicoes-btn');
await dormir(800);
await foto('menu');
verificar('a visita seguinte abre logo no Alto', await abrir() && (await estado()).modo === 'high', await estado());
e = await estado();
verificar('... e o resto do bairro chega por trás', await inteiro(), e);
// O motor só reavalia de dez em dez imagens, e a distância acabou de mudar.
await dormir(2000);
e = await estado();
verificar('... até estar tudo carregado', e.aChegar === 0 && e.porAcertar === 0 && e.distancia === 300 && e.finos > 400, e);

// --- Do Médio para o Alto, à mão, com o rato e a câmara parada -----------
await abrir(limpo + '; localStorage.setItem("quality", "med")');
await dormir(2000);
antes = cargas;
e = await estado();
const finosNoMedio = e.finos;
verificar('aberto no Médio, escolhido à mão', e.modo === 'med' && !e.automatica && e.distancia === 100, e);
await por(-30, 25, 70, 10, 0, 10);
await dormir(3000);
await clicar('#definicoes-btn');
const lugar = await avaliar(`document.querySelector('pc-app').app.root.findByName('camera').getPosition().toString()`);
await clicar('#radio-high');
await dormir(300);
verificar('escolher o Alto põe o ecrã de espera da abertura, e fecha o menu', await avaliar(`${ecraDaAbertura} && !document.getElementById('definicoes-menu').classList.contains('open')`), await avaliar(`document.getElementById('loading-overlay').outerHTML.slice(0, 200)`));
await dormir(900);
await foto('ecra-do-alto');
verificar('... e sai quando o bairro está pronto', await esperar(ecraFora, 240), await estado());
e = await estado();
verificar('quando sai, o que se vê está pronto', e.modo === 'high' && e.distancia >= 150 && e.porAcertar === 0, e);
verificar('... e o resto chega por trás', await inteiro(), await estado());
// O motor só reavalia de dez em dez imagens, e a distância acabou de mudar.
await dormir(2000);
e = await estado();
verificar('... até estar tudo disponível: nada a chegar, tudo no nível certo', e.modo === 'high' && e.distancia === 300 && e.aChegar === 0 && e.porAcertar === 0 && e.finos > finosNoMedio + 250 && cargas === antes, e);
verificar('... todos os pedaços, do bairro inteiro', e.ficheiros.split('/')[0] === e.ficheiros.split('/')[1], e.ficheiros);
verificar('... e a escolha fica guardada', e.guardada === 'high' && e.marcado === 'high', e);
verificar('... no mesmo sítio onde se estava', await avaliar(`document.querySelector('pc-app').app.root.findByName('camera').getPosition().toString()`) === lugar, lugar);
await dormir(1200);
verificar('passear pelo bairro no Alto não traz mais nada', await passear() === 0, await estado());
await clicar('#definicoes-btn');
await clicar('#radio-med');
await dormir(300);
verificar('do Alto para o Médio, o mesmo ecrã de espera', await avaliar(ecraDaAbertura), null);
await foto('ecra-do-medio');
verificar('... que sai com o bairro assente', await esperar(ecraFora, 30), await estado());
e = await estado();
verificar('... no Médio, com o detalhe encolhido', e.modo === 'med' && e.distancia === 100 && e.marcado === 'med' && e.porAcertar === 0 && e.aChegar === 0 && cargas === antes, e);
await dormir(1200);
verificar('passear no Médio também já não traz mais nada', await passear() === 0, await estado());
await clicar('#definicoes-btn');
await clicar('#radio-high');
await dormir(300);
verificar('voltar ao Alto, com tudo cá, tem o mesmo ecrã', await avaliar(ecraDaAbertura), null);
verificar('... por pouco tempo', await esperar(ecraFora, 15) && (await estado()).modo === 'high', await estado());

// --- Uma ligação lenta, e uma que se cala ------------------------------------
await rede(12);
await abrir('localStorage.setItem("quality", "med")');
await enviar('Network.setCacheDisabled', { cacheDisabled: true });
await clicar('#definicoes-btn');
await clicar('#radio-high');
await dormir(5000);
verificar('com a ligação lenta, o ecrã de espera fica', await avaliar(ecraDaAbertura), null);
await foto('ecra-do-alto-a-meio');
await rede(0);
verificar('se a ligação se calar, desiste de esperar', await esperar(ecraFora, 60), await estado());
await rede(null);
await enviar('Network.setCacheDisabled', { cacheDisabled: false });

// --- À mão, e para ficar ------------------------------------------------
await abrir(limpo);
await clicar('#definicoes-btn');
await clicar('#radio-med');
e = await estado();
verificar('carregar no modo que o site já tem posto também é escolher', !e.automatica && e.guardada === 'med' && e.modo === 'med', e);
await por(-30, 25, 70, 10, 0, 10);
await dormir(25000);
e = await estado();
verificar('depois de escolher à mão, com folga não sobe', e.modo === 'med' && e.distancia === 100, e);
await foto('medio');
await pesar(120);
await dormir(20000);
e = await estado();
verificar('... e com peso não desce', e.modo === 'med' && !e.automatica, e);
await pesar(0);
antes = cargas;
await carregar('radio-low');
await dormir(2000);
verificar('escolher o Baixo: abre na malha, como no telemóvel', await esperar(aberto, 60) && cargas === antes + 1, cargas - antes);
e = await estado();
verificar('no Baixo não há manchas do bairro', e.malha && !e.misto && e.modo === 'low' && e.marcado === 'low' && !e.automatica, e);
await por(-30, 25, 70, 10, 0, 10);
await dormir(3000);
await foto('baixo');
await carregar('radio-high');
await dormir(2000);
verificar('do Baixo para o Alto: abre de novo', await esperar(aberto, 240), null);
e = await estado();
verificar('... já no Alto', e.modo === 'high' && e.distancia >= 150, e);
verificar('... e o resto chega por trás', await inteiro(), await estado());
// O motor só reavalia de dez em dez imagens, e a distância acabou de mudar.
await dormir(2000);
e = await estado();
verificar('... até estar tudo carregado', e.modo === 'high' && e.misto && e.aChegar === 0 && e.porAcertar === 0 && e.distancia === 300 && !e.automatica, e);

// --- Desce com peso -------------------------------------------------------
await abrir(limpo);
await por(-30, 25, 70, 10, 0, 10);
await dormir(6000);
antes = cargas;
await pesar(70);
verificar('sem escolha à mão, com um peso de 70 ms por imagem desce ao Baixo', await esperar(`window.actualQuality === 'low'`, 30), await estado());
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
verificar('quem tinha o Automático fica com a escolha do site', e.modo === 'med' && e.automatica, e);

// --- A placa gráfica cai --------------------------------------------------
const cair = () => avaliar(`document.querySelector('pc-app').app.graphicsDevice.gl.getExtension('WEBGL_lose_context').loseContext(); 1`);
await abrir('localStorage.removeItem("qualidade-medida"); localStorage.setItem("quality", "high")');
await cair();
await dormir(4000);
verificar('a placa cai no Alto escolhido à mão: volta a abrir', await esperar(aberto, 60), null);
e = await estado();
verificar('... no Médio, ainda à mão', e.modo === 'med' && !e.automatica && e.guardada === 'med', e);
await cair();
await dormir(4000);
await esperar(aberto, 60);
e = await estado();
verificar('a placa cai no Médio: abre no Baixo, ainda à mão', e.modo === 'low' && e.malha && e.guardada === 'low' && (await avaliar('!window.modoDePoupanca')), e);
await cair();
await dormir(4000);
await esperar(aberto, 60);
e = await estado();
verificar('a placa cai no Baixo: modo de poupança, sem modo marcado', (await avaliar('window.modoDePoupanca')) === true && e.marcado === null, e);
await avaliar('sessionStorage.clear(); 1');
await abrir('localStorage.removeItem("quality"); localStorage.setItem("qualidade-medida", JSON.stringify({ modo: "high", quando: Date.now(), quedas: {} }))');
await cair();
await dormir(4000);
await esperar(aberto, 60);
e = await estado();
verificar('a placa cai no Alto escolhido pelo site: abre no Médio, e o Alto fica de parte', e.modo === 'med' && e.automatica && e.medida.quedas.high.length === 2, e);

// --- Telemóvel ------------------------------------------------------------
await enviar('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36' });
await enviar('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true });
await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await abrir(limpo);
e = await estado();
verificar('no telemóvel abre no Baixo, escolhido pelo site', e.modo === 'low' && e.malha && e.automatica, e);
await dormir(20000);
e = await estado();
verificar('... e nunca guarda que pode subir', !e.medida || e.medida.modo === 'low', e);

const aSerio = erros.filter((x) => !/registry already|CONTEXT_LOST|context lost|clientWaitSync|Failed to load resource|ERR_INTERNET_DISCONNECTED|Error loading|Failed to fetch/i.test(x));
verificar('sem erros na consola', aSerio.length === 0, aSerio.slice(0, 4));
console.log(falhas ? `\n${falhas} com falha.` : '\nTudo certo.');
await enviar('Page.navigate', { url: 'about:blank' });
arrumar();
setTimeout(() => process.exit(falhas ? 1 : 0), 500);
