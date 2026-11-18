/**
 * Prova do local marcado (ver "O local marcado", em public/index.html, e
 * navegacao-3d.mjs), num Chrome à parte, com perfil limpo e à vista:
 * carregar sem largar com o rato, com o dedo e com o botão direito; o que
 * não pode marcar (um arrasto, um clique, o céu); o alfinete no sítio onde
 * se carregou e com nome para quem não vê o ecrã; as direções até lá e o
 * voltar delas; a ligação copiada; o histórico (voltar atrás); a ligação
 * aberta noutra visita, com o alfinete à altura do telhado; o telemóvel.
 *
 * Uso, com o site a correr (`bun run dev`):
 *   bun scripts/testar-local.mjs                       # as provas
 *   bun scripts/testar-local.mjs --fotos=C:\pasta      # e fotografias
 *   bun scripts/testar-local.mjs https://malhaviva.pt  # outro endereço
 *
 * Todas as linhas têm de dizer `ok`.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const origem = (args.find((a) => a.startsWith('http')) || 'http://localhost:8000').replace(/\/$/, '');
const fotos = args.some((a) => a.startsWith('--fotos'));
const PASTA = (args.find((a) => a.startsWith('--fotos=')) || '').slice(8) || tmpdir();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')].find(existsSync);
const L = 1280, A = 760;
const porta = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-local-'));
const processo = spawn(chrome, [
    `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', `--window-size=${L + 16},${A + 140}`,
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

await enviar('Page.enable');
await enviar('Page.navigate', { url: origem + '/favicon.svg' });
await dormir(800);
await enviar('Runtime.enable');
await enviar('Emulation.setDeviceMetricsOverride', { width: L, height: A, deviceScaleFactor: 1, mobile: false });
await enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
await enviar('Browser.grantPermissions', { origin: origem, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
await enviar('Page.navigate', { url: origem + '/creditos' });
await dormir(1500);
await avaliar(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('instrucoes','vistas'); 1`);

const resultados = [];
const prova = (nome, ok, detalhe = '') => { resultados.push(ok); console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '   ' + detalhe : ''}`); };
const foto = async (nome) => {
    if (!fotos) return;
    const r = await enviar('Page.captureScreenshot', { format: 'jpeg', quality: 75 });
    writeFileSync(join(PASTA, 'local-' + nome + '.jpg'), Buffer.from(r.result.data, 'base64'));
};

async function abrirBairro(caminho = '/') {
    await enviar('Page.navigate', { url: origem + caminho });
    const inicio = Date.now();
    for (;;) {
        await dormir(1000);
        const pronto = await avaliar(`!!(window.arranque && window.arranque.estado().marcos.bairro) && document.getElementById('loading-overlay').classList.contains('hidden')`).catch(() => false);
        if (pronto) break;
        if (Date.now() - inicio > 120000) { console.log('O bairro não abriu em 2 minutos'); process.exit(1); }
    }
    await dormir(2500);
    await avaliar(`(async () => {
        const pc = await import('playcanvas');
        const app = document.querySelector('pc-app').app;
        const cam = app.root.findByName('camera');
        window.__t = {
            pc, app, cam, ctl: cam.script.cameraControls,
            proj(p) { cam.camera._viewMatDirty = true; const s = cam.camera.worldToScreen(new pc.Vec3(p[0], p[1], p[2])); return [s.x, s.y]; },
            pose() { const p = cam.getPosition(); const c = this.ctl._pose.angles; return { x: p.x, y: p.y, z: p.z, inclinacao: c.x, rumo: c.y }; },
            async ponto(x, y) { const p = await this.ctl._lerPonto(x, y); return p ? [p.x, p.y, p.z] : null; },
            avisos: []
        };
        window.addEventListener('premirNoBairro', (e) => window.__t.avisos.push(e.detail));
        return 1;
    })()`);
    return Date.now() - inicio;
}

const pose = async () => JSON.parse(await avaliar('JSON.stringify(window.__t.pose())'));
// A vista de abertura: (-88.74, 62.03, 294.91), inclinação -19.4, rumo -19.7.
const voltarAoInicio = async () => {
    await avaliar(`(() => {
        const t = window.__t; const R = Math.PI / 180;
        const p = -19.4 * R, y = -19.7 * R;
        const pos = new t.pc.Vec3(-88.74, 62.03, 294.91);
        const frente = new t.pc.Vec3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
        t.ctl.recenter(pos, pos.clone().add(frente.mulScalar(200)));
        return 1;
    })()`);
    await dormir(800);
};
// Os telhados das casas do levantamento que se vêem da câmara: o número, o
// sítio na cena e onde ficam no ecrã (a passagem dos graus para a cena é a
// de navegacao-3d.mjs).
const telhadosAVista = async () => JSON.parse(await avaliar(`(async () => {
    const rede = await (await fetch('/navegacao/rede.json')).json();
    const { s, R, t } = rede.cena.registo;
    const RT = 6378137;
    const naCena = ([lat, lon]) => {
        const E = RT * lon * Math.PI / 180;
        const N = RT * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        const a = (E - t[0]) / s, b = (N - t[1]) / s;
        return [R[0][0] * a + R[1][0] * b, -(R[0][1] * a + R[1][1] * b)];
    };
    const saida = [];
    for (const c of rede.casas) {
        if (c.alto == null) continue;
        const [x, z] = naCena(c.ponto);
        const [sx, sy] = window.__t.proj([x, c.alto, z]);
        if (sx > 420 && sx < 1200 && sy > 200 && sy < 680) saida.push({ n: c.n, x, z, alto: c.alto, sx: Math.round(sx), sy: Math.round(sy) });
    }
    return JSON.stringify(saida);
})()`));
const ponto = async (x, y) => {
    for (let i = 0; i < 6; i++) {
        const r = JSON.parse(await avaliar(`window.__t.ponto(${x}, ${y}).then(JSON.stringify)`));
        if (r) return r;
        await dormir(150);
    }
    return null;
};
const rato = (type, x, y, extra = {}) => enviar('Input.dispatchMouseEvent', { type, x, y, ...extra });
const umaImagem = () => avaliar('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))');
async function segurar(x, y, ms = 750, botao = 'left') {
    const buttons = botao === 'left' ? 1 : 2;
    await rato('mouseMoved', x, y);
    await rato('mousePressed', x, y, { button: botao, buttons, clickCount: 1 });
    const fim = Date.now() + ms;
    while (Date.now() < fim) await umaImagem();
    await rato('mouseReleased', x, y, { button: botao, buttons: 0, clickCount: 1 });
    await dormir(400);
}
const estado = async () => JSON.parse(await avaliar(`JSON.stringify((() => {
    const painel = document.getElementById('local-painel');
    const alfinetes = [...document.querySelectorAll('.local-3d')];
    const a = alfinetes[0];
    const m = a ? /translate3d\\(([-\\d.]+)px, ([-\\d.]+)px/.exec(a.style.transform) : null;
    return {
        painel: !painel.hidden,
        titulo: document.getElementById('local-titulo').textContent,
        perto: document.getElementById('local-perto').textContent,
        coordenadas: document.getElementById('local-coordenadas').textContent,
        partilhar: document.getElementById('local-partilhar-texto').textContent,
        alfinetes: alfinetes.length,
        alfinete: a ? { role: a.getAttribute('role'), nome: a.getAttribute('aria-label'), tab: a.getAttribute('tabindex'), escondido: a.getAttribute('aria-hidden'), fora: a.classList.contains('fora'), x: m ? +m[1] : null, y: m ? +m[2] : null } : null,
        percurso: !document.getElementById('percurso-painel').hidden,
        destino: document.getElementById('percurso-casa').textContent,
        passos: [...document.querySelectorAll('#percurso-passos li')].map((li) => li.textContent.trim()),
        // A fita branca do percurso (a do que falta andar, a quarta) e os
        // pontinhos até ao local (a quinta).
        linha: [...document.querySelectorAll('#percurso-3d .percurso-traco > path')].slice(3, 5).map((p) => p.getAttribute('d') || '').join(''),
        endereco: location.pathname,
        estadoDoHistorico: history.state,
        tituloDaPagina: document.title,
        foco: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null,
        comLocal: document.body.classList.contains('com-local'),
        aNavegar: document.body.classList.contains('a-navegar')
    };
})())`));
const esperar = async (condicao, ms = 6000) => {
    const fim = Date.now() + ms;
    let e = await estado();
    while (!condicao(e) && Date.now() < fim) { await dormir(150); e = await estado(); }
    return e;
};
const carregar = async (id) => {
    const caixa = JSON.parse(await avaliar(`JSON.stringify(document.getElementById('${id}').getBoundingClientRect())`));
    const x = caixa.x + caixa.width / 2;
    const y = caixa.y + caixa.height / 2;
    await rato('mouseMoved', x, y);
    await rato('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
    await rato('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
    await dormir(400);
};

// ── 0. O bairro
const demora = await abrirBairro('/');
console.log(`bairro aberto em ${(demora / 1000).toFixed(1)} s`);

// Sítios do bairro debaixo do rato, para as provas; e o telhado de uma
// casa (o sítio lido no ecrã tem de cair nela, e não na rua ao lado).
const amostrar = async () => {
    const saida = [];
    for (const [x, y] of [[560, 470], [640, 470], [720, 470], [600, 520], [680, 520], [760, 520], [520, 560], [640, 560], [800, 560], [700, 440]]) {
        const p = await ponto(x, y);
        if (p) saida.push({ x, y, p });
    }
    return saida;
};
let amostras = await amostrar();
let alto = null;
for (const c of (await telhadosAVista()).slice(0, 40)) {
    const p = await ponto(c.sx, c.sy);
    if (p && Math.hypot(p[0] - c.x, p[2] - c.z) < 2 && p[1] > c.alto - 2) {
        alto = { x: c.sx, y: c.sy, p, casa: c.n };
        break;
    }
}
prova('há sítios do bairro debaixo do rato para as provas, e um telhado', amostras.length >= 5 && !!alto,
    `${amostras.length} sítios; telhado da casa ${alto && alto.casa} a y=${alto && alto.p[1].toFixed(1)}, no ecrã em (${alto && alto.x}, ${alto && alto.y})`);

// ── 1. Rato: carregar sem largar marca o sítio, sem mexer na câmara
let p0 = await pose();
await segurar(alto.x, alto.y);
let e = await esperar((s) => s.painel && s.alfinete && !s.alfinete.fora);
let p1 = await pose();
prova('rato: carregar sem largar abre o painel do local', e.painel && e.titulo === 'Local marcado', e.titulo);
prova('rato: a câmara não se mexeu', Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z) < 0.01 && Math.abs(p1.rumo - p0.rumo) < 0.01,
    `andou ${Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z).toFixed(3)} m`);
prova('o alfinete fica onde se carregou', e.alfinete && Math.hypot(e.alfinete.x - alto.x, e.alfinete.y - alto.y) < 6,
    e.alfinete ? `alfinete em (${e.alfinete.x.toFixed(0)}, ${e.alfinete.y.toFixed(0)}), rato em (${alto.x}, ${alto.y})` : 'sem alfinete');
prova('o alfinete é um botão com nome, na fila do Tab (AGENTS.md)', e.alfinete && e.alfinete.role === 'button' && /Local marcado/.test(e.alfinete.nome) && e.alfinete.tab === '0' && e.alfinete.escondido === null,
    e.alfinete ? `${e.alfinete.role} · ${e.alfinete.nome} · tabindex ${e.alfinete.tab}` : '');
prova('o endereço é o do local, /@lat,lon, e o histórico tem o passo dele', /^\/@38\.\d{6},-9\.\d{6}$/.test(e.endereco) && e.estadoDoHistorico && e.estadoDoHistorico['malhaviva-local'] === true,
    e.endereco);
prova('o painel diz as coordenadas, e o separador o local', e.coordenadas === e.endereco.slice(2).replace(',', ', ') && /^Local marcado/.test(e.tituloDaPagina), `${e.coordenadas} · ${e.tituloDaPagina}`);
prova('o foco vai para o painel', e.foco === 'local-titulo', e.foco);
prova('o painel diz ao pé de que casa fica', e.perto === 'Perto da casa ' + alto.casa, e.perto);
const primeiro = e;
const pontoDoTelhado = alto.p;
await foto('1-painel');

// ── 2. Partilhar, no computador: a ligação vai para a área de transferência
await carregar('local-partilhar');
e = await estado();
const copiada = await avaliar('navigator.clipboard.readText()').catch(() => '');
prova('partilhar: copia a ligação pública do local', copiada === 'https://malhaviva.pt' + primeiro.endereco, copiada);
prova('partilhar: o botão diz que copiou', e.partilhar === 'Link copiado', e.partilhar);
await dormir(2300);
e = await estado();
prova('… e volta a dizer Partilhar', e.partilhar === 'Partilhar', e.partilhar);

// ── 3. Direções: o percurso até ao local, no painel do percurso
await carregar('local-direcoes');
e = await esperar((s) => s.percurso && s.passos.length > 1, 8000);
prova('direções: abre o percurso até ao local marcado', e.percurso && !e.painel && e.destino === 'Local marcado', `${e.destino} · ${e.passos.length} passos`);
prova('direções: o último passo fala do local marcado', /local marcado/.test(e.passos[e.passos.length - 1] || ''), e.passos[e.passos.length - 1]);
prova('direções: a linha do percurso está desenhada', e.linha.length > 50, `${e.linha.length} caracteres`);
prova('direções: o alfinete é o fim do percurso', e.alfinete && /onde acaba o percurso/.test(e.alfinete.nome), e.alfinete && e.alfinete.nome);
prova('direções: o endereço continua o do local', e.endereco === primeiro.endereco, e.endereco);
await dormir(2200);
await foto('3-direcoes');

// ── 4. Voltar (no painel do percurso): volta ao painel do local
await carregar('percurso-voltar');
e = await esperar((s) => s.painel && !s.percurso);
prova('voltar das direções: o painel do local volta, com o alfinete', e.painel && !e.percurso && e.alfinetes === 1 && e.endereco === primeiro.endereco, `${e.endereco}`);
prova('… e o alfinete deixa de ser o fim do percurso', e.alfinete && !/onde acaba/.test(e.alfinete.nome), e.alfinete && e.alfinete.nome);

// ── 5. O histórico: direções, voltar atrás (volta ao local), voltar atrás (sai)
await carregar('local-direcoes');
await esperar((s) => s.percurso);
await avaliar('history.back(), 1');
e = await esperar((s) => s.painel && !s.percurso);
prova('voltar atrás das direções: o painel do local volta', e.painel && !e.percurso && e.endereco === primeiro.endereco, e.endereco);
await avaliar('history.back(), 1');
e = await esperar((s) => !s.painel && !s.alfinetes);
prova('voltar atrás do local: sai o alfinete e o painel, e o endereço volta a ser o do bairro', !e.painel && !e.alfinetes && e.endereco === '/' && !e.comLocal, `${e.endereco} · ${e.tituloDaPagina}`);
await avaliar('history.forward(), 1');
e = await esperar((s) => s.painel && s.alfinetes === 1);
prova('avançar: o local volta, no mesmo sítio', e.painel && e.endereco === primeiro.endereco, e.endereco);

// ── 6. Fechar (o X) e o Escape
await carregar('local-fechar');
e = await esperar((s) => !s.painel && !s.alfinetes);
prova('o X fecha o local', !e.painel && !e.alfinetes && e.endereco === '/', e.endereco);
await segurar(amostras[1].x, amostras[1].y);
await esperar((s) => s.painel);
await enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
e = await esperar((s) => !s.painel);
prova('o Escape fecha o local', !e.painel && !e.alfinetes, '');

// ── 7. O que não marca: um clique, um arrasto parado no fim, o céu
p0 = await pose();
await rato('mousePressed', amostras[2].x, amostras[2].y, { button: 'left', buttons: 1, clickCount: 1 });
await rato('mouseReleased', amostras[2].x, amostras[2].y, { button: 'left', buttons: 0, clickCount: 1 });
await dormir(900);
e = await estado();
prova('um clique não marca', !e.painel && !e.alfinetes, '');
await rato('mouseMoved', 640, 520);
await rato('mousePressed', 640, 520, { button: 'left', buttons: 1, clickCount: 1 });
for (let i = 1; i <= 10; i++) { await rato('mouseMoved', 640 - 4 * i, 520, { button: 'left', buttons: 1 }); await dormir(16); }
let fim = Date.now() + 800;
while (Date.now() < fim) await umaImagem();
await rato('mouseReleased', 600, 520, { button: 'left', buttons: 0, clickCount: 1 });
await dormir(500);
e = await estado();
p1 = await pose();
prova('um arrasto que pára e fica não marca (e arrastou)', !e.painel && !e.alfinetes && Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.5, `a câmara andou ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);
await segurar(640, 40);
e = await estado();
prova('carregar sem largar no céu não marca', !e.painel && !e.alfinetes, '');

// ── 8. O botão direito, sem arrastar, marca; a arrastar, roda e não marca
p0 = await pose();
await rato('mouseMoved', 700, 500);
await rato('mousePressed', 700, 500, { button: 'right', buttons: 2, clickCount: 1 });
for (let i = 1; i <= 12; i++) { await rato('mouseMoved', 700 + 8 * i, 500, { button: 'right', buttons: 2 }); await dormir(16); }
await rato('mouseReleased', 796, 500, { button: 'right', buttons: 0, clickCount: 1 });
await dormir(500);
e = await estado();
p1 = await pose();
prova('o botão direito a arrastar roda, e não marca', !e.painel && Math.abs(p1.rumo - p0.rumo) > 5, `rumo ${p0.rumo.toFixed(1)} → ${p1.rumo.toFixed(1)}`);
const direito = amostras[3];
const pDireito = await ponto(direito.x, direito.y);
await rato('mouseMoved', direito.x, direito.y);
await rato('mousePressed', direito.x, direito.y, { button: 'right', buttons: 2, clickCount: 1 });
await dormir(80);
await rato('mouseReleased', direito.x, direito.y, { button: 'right', buttons: 0, clickCount: 1 });
e = await esperar((s) => s.painel && s.alfinete && !s.alfinete.fora);
prova('o botão direito, sem arrastar, marca o sítio', e.painel && e.alfinete && Math.hypot(e.alfinete.x - direito.x, e.alfinete.y - direito.y) < 6,
    e.alfinete ? `alfinete em (${e.alfinete.x.toFixed(0)}, ${e.alfinete.y.toFixed(0)})` : '');
// (O botão direito a arrastar rodou a vista: volta-se à de abertura, e os
// sítios do ecrã lêem-se de novo.)
await voltarAoInicio();
amostras = await amostrar();

// ── 9. Carregar sem largar noutro sítio, com o local aberto: muda-o, no mesmo passo do histórico
const antes = e.endereco;
const comprimento = await avaliar('history.length');
await segurar(amostras[4].x, amostras[4].y);
e = await esperar((s) => s.painel && s.endereco !== antes);
const comprimentoDepois = await avaliar('history.length');
prova('outro sítio com o local aberto: o local muda, sem passo novo no histórico', e.endereco !== antes && e.alfinetes === 1 && comprimentoDepois === comprimento, `${antes} → ${e.endereco}`);

// ── 10. Com o percurso de uma casa à vista, carregar sem largar marca o local no lugar dele
await carregar('local-fechar');
await esperar((s) => !s.painel);
await avaliar(`(() => { const c = document.getElementById('pesquisa-numero'); c.focus(); c.value = 'D31'; c.dispatchEvent(new Event('input')); return 1; })()`);
await dormir(800);
await enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
e = await esperar((s) => s.percurso && s.passos.length > 1, 10000);
prova('(a casa D31 abre o percurso dela)', e.percurso && /D31/.test(e.destino), e.destino);
await dormir(2500);
const sitioComCasa = await (async () => { for (const s of amostras) { const q = await ponto(s.x, s.y); if (q) return s; } return null; })();
// A câmara foi para o percurso: procura-se um sítio do bairro no meio do ecrã.
let livre = null;
for (const [x, y] of [[800, 400], [900, 450], [760, 520], [1000, 500], [700, 600]]) { if (await ponto(x, y)) { livre = [x, y]; break; } }
await segurar(livre[0], livre[1]);
e = await esperar((s) => s.painel && !s.percurso);
prova('com o percurso de uma casa à vista, carregar sem largar marca o local no lugar dele', e.painel && !e.percurso && e.alfinetes === 1 && /^\/@/.test(e.endereco) && !e.aNavegar,
    `${e.endereco} · percurso ${e.percurso}`);
await avaliar('history.back(), 1');
e = await esperar((s) => !s.painel);
prova('… e voltar atrás vai ao bairro (o percurso da casa já saiu)', !e.painel && !e.percurso && e.endereco === '/', e.endereco);

// ── 11. Uma língua nova
await avaliar(`window.Idiomas.definir('en'), 1`);
await segurar(livre[0], livre[1]);
e = await esperar((s) => s.painel);
prova('em inglês: "Dropped pin", com o nome dito em inglês', e.titulo === 'Dropped pin' && /^Dropped pin/.test(e.alfinete && e.alfinete.nome), `${e.titulo} · ${e.alfinete && e.alfinete.nome}`);
await avaliar(`window.Idiomas.definir('pt'), 1`);
await dormir(300);
e = await estado();
prova('… e de volta ao português', e.titulo === 'Local marcado' && /^Local marcado/.test(e.tituloDaPagina), `${e.titulo} · ${e.tituloDaPagina}`);
await carregar('local-fechar');

// ── 12. A ligação, aberta noutra visita: o local no sítio, à altura do telhado
await abrirBairro(primeiro.endereco);
e = await esperar((s) => s.painel && s.alfinete && !s.alfinete.fora, 12000);
const estadoDaLigacao = await avaliar('JSON.stringify(history.state)');
const altura = JSON.parse(estadoDaLigacao || 'null');
prova('a ligação abre o bairro com o local marcado', e.painel && e.alfinetes === 1 && e.endereco === primeiro.endereco && e.coordenadas === primeiro.coordenadas, `${e.endereco}`);
prova('o alfinete da ligação fica à altura do que lá está (o telhado)', altura && Number.isFinite(altura.y) && Math.abs(altura.y - pontoDoTelhado[1]) < 1.2,
    `y=${altura && altura.y != null ? altura.y.toFixed(2) : altura && altura.y} (carregou-se a y=${pontoDoTelhado[1].toFixed(2)})`);
const naVista = e.alfinete && e.alfinete.x > 344 + 20 && e.alfinete.x < L - 20 && e.alfinete.y > 90 && e.alfinete.y < A - 40;
prova('a câmara mostra o local, fora do painel', naVista, e.alfinete ? `alfinete em (${e.alfinete.x.toFixed(0)}, ${e.alfinete.y.toFixed(0)})` : '');
const instrucoes = await avaliar(`!!document.querySelector('#instrucoes.aberta')`);
prova('quem chega pela ligação não recebe as instruções', !instrucoes, '');
await foto('12-ligacao');
await carregar('local-fechar');
e = await esperar((s) => !s.painel);
prova('fechar o local da ligação deixa o bairro em /', !e.painel && e.endereco === '/', e.endereco);

// Uma ligação para fora do bairro não marca nada.
await abrirBairro('/@38.736946,-9.142685');
e = await estado();
prova('uma ligação para um sítio fora do bairro abre só o bairro', !e.painel && !e.alfinetes && e.endereco === '/', e.endereco);

// ── 13. Dedos (telemóvel): tocar sem largar marca; o painel fica em baixo sem tapar o alfinete
await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await abrirBairro('/');
const toque = (type, pontos) => enviar('Input.dispatchTouchEvent', { type, touchPoints: pontos.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
let embaixo = null;
for (const [x, y] of [[195, 700], [150, 720], [240, 690], [195, 650], [195, 600]]) { if (await ponto(x, y)) { embaixo = [x, y]; break; } }
await toque('touchStart', [embaixo]);
fim = Date.now() + 800;
while (Date.now() < fim) await umaImagem();
await toque('touchEnd', []);
e = await esperar((s) => s.painel && s.alfinete && !s.alfinete.fora);
await dormir(1200);
e = await estado();
const caixa = JSON.parse(await avaliar(`JSON.stringify(document.getElementById('local-painel').getBoundingClientRect())`));
prova('dedo: tocar sem largar abre o painel do local, em baixo', e.painel && caixa.bottom >= 843 && caixa.left === 0 && caixa.width === 390, `painel de ${caixa.top.toFixed(0)} a ${caixa.bottom.toFixed(0)}`);
prova('dedo: o painel não tapa o alfinete (a câmara chega-se)', e.alfinete && e.alfinete.y < caixa.top - 10, e.alfinete ? `alfinete a y=${e.alfinete.y.toFixed(0)}, painel a y=${caixa.top.toFixed(0)}` : '');
const escondidos = await avaliar(`['map-scale', 'partilhar-btn', 'legenda-mapa'].map((id) => { const el = document.getElementById(id); return el ? getComputedStyle(el).display : 'none'; }).join(',')`);
prova('dedo: a escala, a legenda e o botão de partilhar o site saem do fundo', escondidos.split(',').every((d) => d === 'none'), escondidos);
await foto('13-telemovel');
await toque('touchStart', [[120, 400], [270, 400]]);
for (let i = 1; i <= 5; i++) { await toque('touchMove', [[120 - i, 400], [270 + i, 400]]); await dormir(16); }
fim = Date.now() + 800;
while (Date.now() < fim) await umaImagem();
await toque('touchEnd', []);
await dormir(400);
const avisos = await avaliar('window.__t.avisos.length');
prova('dois dedos parados não marcam', avisos === 1, `${avisos} avisos`);

prova('sem erros na consola', erros.length === 0, erros.slice(0, 5).join(' | '));
const falhas = resultados.filter(r => !r).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} ok`);
arrumar();
process.exit(falhas ? 1 : 0);
