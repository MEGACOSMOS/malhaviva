/**
 * Prova da navegação à moda do Google Maps (ver "Navegar como no Google
 * Maps", em public/camera-controls.mjs), num Chrome à parte, com perfil
 * limpo e à vista: arrastar (com e sem balanço), a roda, Ctrl e o botão
 * direito a rodar e inclinar, o clique que não mexe, o duplo clique, as
 * teclas, a bússola e os gestos dos dedos (um a arrastar, pinça, rodar,
 * inclinar, dois toques, dois dedos a tocar). Cada prova mede onde fica o
 * sítio agarrado no ecrã, e não só se a câmara andou.
 *
 * Uso, com o site a correr (`bun run dev`):
 *   bun scripts/testar-gestos.mjs                      # as provas
 *   bun scripts/testar-gestos.mjs --fotos=C:\pasta     # e fotografias
 *   bun scripts/testar-gestos.mjs https://malhaviva.pt  # outro endereço
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
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-gestos-'));
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
await enviar('Page.navigate', { url: origem + '/creditos' });
await dormir(1500);
await avaliar(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('instrucoes','vistas'); 1`);
await enviar('Page.navigate', { url: origem + '/' });
const inicio = Date.now();
for (;;) {
    await dormir(1000);
    const pronto = await avaliar(`!!(window.arranque && window.arranque.estado().marcos.bairro) && document.getElementById('loading-overlay').classList.contains('hidden')`).catch(() => false);
    if (pronto) break;
    if (Date.now() - inicio > 120000) { console.log('O bairro não abriu em 2 minutos'); process.exit(1); }
}
console.log(`bairro aberto em ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
await dormir(3000);

await avaliar(`(async () => {
    const pc = await import('playcanvas');
    const app = document.querySelector('pc-app').app;
    const cam = app.root.findByName('camera');
    window.__t = {
        pc, app, cam, ctl: cam.script.cameraControls,
        proj(p) { cam.camera._viewMatDirty = true; const s = cam.camera.worldToScreen(new pc.Vec3(p[0], p[1], p[2])); return [s.x, s.y]; },
        pose() { const p = cam.getPosition(); const c = this.ctl._pose.angles; return { x: p.x, y: p.y, z: p.z, inclinacao: c.x, rumo: c.y }; },
        async ponto(x, y) { const p = await this.ctl._lerPonto(x, y); return p ? [p.x, p.y, p.z] : null; },
        alturaDoPivo() { const c = this.ctl; return c._alturaDoPivo === undefined ? c._alturaDoChao : c._alturaDoPivo; },
        gestos: []
    };
    window.addEventListener('gestoNoBairro', (e) => window.__t.gestos.push(e.detail.gesto));
    return 1;
})()`);

async function voltarAoInicioDiag() {
    const r = await avaliar(`(async () => {
        const t = window.__t;
        const ler = t.ctl._prepararLeitura();
        const saida = [];
        const pos = t.cam.getPosition();
        for (const [x, y] of [[640,380],[820,470],[640,520],[500,520],[640,600],[300,600],[1000,600],[640,700],[640,250]]) {
            const p = await ler(x, y);
            saida.push([x, y, p ? [p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1), Math.hypot(p.x-pos.x, p.z-pos.z).toFixed(0)] : null]);
        }
        return JSON.stringify({ camara: [pos.x.toFixed(1), pos.y.toFixed(1), pos.z.toFixed(1)], saida });
    })()`);
    console.log(r);
    process.exit(0);
}
const resultados = [];
const prova = (nome, ok, detalhe = '') => { resultados.push(ok); console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '   ' + detalhe : ''}`); };
const pose = async () => JSON.parse(await avaliar('JSON.stringify(window.__t.pose())'));
const ponto = async (x, y) => {
    for (let i = 0; i < 6; i++) {
        const r = JSON.parse(await avaliar(`window.__t.ponto(${x}, ${y}).then(JSON.stringify)`));
        if (r) return r;
        await dormir(150);
    }
    throw new Error('sem leitura em ' + x + ',' + y);
};
const proj = async (p) => JSON.parse(await avaliar(`JSON.stringify(window.__t.proj(${JSON.stringify(p)}))`));
const voltarAoInicio = async () => {
    // A vista de abertura: (-88.74, 62.03, 294.91), inclinação -19.4, rumo -19.7.
    await avaliar(`(() => {
        const t = window.__t; const R = Math.PI / 180;
        const p = -19.4 * R, y = -19.7 * R;
        const pos = new t.pc.Vec3(-88.74, 62.03, 294.91);
        const frente = new t.pc.Vec3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
        t.ctl.recenter(pos, pos.clone().add(frente.mulScalar(200)));
        return 1;
    })()`);
    await dormir(600);
};
const foto = async (nome) => {
    if (!fotos) return;
    const r = await enviar('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    writeFileSync(join(PASTA, nome + '.jpg'), Buffer.from(r.result.data, 'base64'));
};
const rato = (type, x, y, extra = {}) => enviar('Input.dispatchMouseEvent', { type, x, y, ...extra });
async function arrastar(ax, ay, bx, by, { botao = 'left', modificadores = 0, passos = 24, parar = 220 } = {}) {
    const buttons = botao === 'left' ? 1 : botao === 'right' ? 2 : 4;
    await rato('mouseMoved', ax, ay, { modifiers: modificadores });
    await rato('mousePressed', ax, ay, { button: botao, buttons, clickCount: 1, modifiers: modificadores });
    for (let i = 1; i <= passos; i++) {
        const t = i / passos;
        await rato('mouseMoved', ax + (bx - ax) * t, ay + (by - ay) * t, { button: botao, buttons, modifiers: modificadores });
        await dormir(16);
    }
    await dormir(parar);
    await rato('mouseReleased', bx, by, { button: botao, buttons: 0, clickCount: 1, modifiers: modificadores });
    await dormir(300);
}

// ── 1. Arrastar com o rato: o sítio agarrado fica debaixo do rato
await voltarAoInicio();
let p0 = await pose();
const ax = 640, ay = 520, bx = 420, by = 430;
const agarrado = await ponto(ax, ay);
await arrastar(ax, ay, bx, by);
let p1 = await pose();
let onde = await proj(agarrado);
prova('arrastar: o sítio agarrado acaba debaixo do rato', Math.hypot(onde[0] - bx, onde[1] - by) < 8,
    `ficou em (${onde.map(v => v.toFixed(0))}) — rato em (${bx},${by}); a câmara andou ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);
prova('arrastar: a câmara não sobe nem desce, nem roda', Math.abs(p1.y - p0.y) < 0.01 && Math.abs(p1.rumo - p0.rumo) < 0.01 && Math.abs(p1.inclinacao - p0.inclinacao) < 0.01,
    `dy=${(p1.y - p0.y).toFixed(3)} drumo=${(p1.rumo - p0.rumo).toFixed(3)}`);
await foto('1-arrastar');

// ── 2. Balanço: largar em andamento faz deslizar
await voltarAoInicio();
p0 = await pose();
await arrastar(640, 520, 500, 520, { passos: 8, parar: 0 });
const pLargar = await pose();
await dormir(900);
p1 = await pose();
prova('balanço: largado em andamento, o bairro ainda desliza', Math.hypot(p1.x - pLargar.x, p1.z - pLargar.z) > 1,
    `deslizou ${Math.hypot(p1.x - pLargar.x, p1.z - pLargar.z).toFixed(1)} m depois de largar`);
await voltarAoInicio();
await arrastar(640, 520, 500, 520, { passos: 8, parar: 250 });
const pParado = await pose();
await dormir(700);
p1 = await pose();
prova('balanço: parado antes de largar, não desliza', Math.hypot(p1.x - pParado.x, p1.z - pParado.z) < 0.05,
    `deslizou ${Math.hypot(p1.x - pParado.x, p1.z - pParado.z).toFixed(2)} m`);

// ── 3. A roda aproxima em direcção ao rato
await voltarAoInicio();
// Primeiro desce um pouco (na vista de abertura a câmara está no tecto: afastar não dá).
const cx = 820, cy = 470;
const debaixo = await ponto(cx, cy);
p0 = await pose();
const d0 = Math.hypot(p0.x - debaixo[0], p0.y - debaixo[1], p0.z - debaixo[2]);
// A leitura à placa gráfica é feita a um quarto da resolução: o sítio lido
// pode estar um ou dois pontos ao lado do rato, e o zoom aumenta esse desvio.
const desvio0 = (() => 0)();
const ondeAntes = await proj(debaixo);
for (let i = 0; i < 3; i++) { await rato('mouseWheel', cx, cy, { deltaX: 0, deltaY: -100 }); await dormir(60); }
await dormir(900);
p1 = await pose();
onde = await proj(debaixo);
const d1 = Math.hypot(p1.x - debaixo[0], p1.y - debaixo[1], p1.z - debaixo[2]);
prova('roda: aproxima (3 passos ≈ 0,42 da distância)', d1 / d0 < 0.52 && d1 / d0 > 0.3, `distância ${d0.toFixed(1)} → ${d1.toFixed(1)} m (×${(d1 / d0).toFixed(2)})`);
prova('roda: o sítio debaixo do rato fica debaixo do rato', Math.hypot(onde[0] - cx, onde[1] - cy) <= Math.hypot(ondeAntes[0] - cx, ondeAntes[1] - cy) * d0 / d1 + 2, `ficou em (${onde.map(v => v.toFixed(0))}); antes em (${ondeAntes.map(v => v.toFixed(0))})`);
await foto('3-roda');
for (let i = 0; i < 2; i++) { await rato('mouseWheel', cx, cy, { deltaX: 0, deltaY: 100 }); await dormir(60); }
await dormir(900);
const p2 = await pose();
prova('roda para trás: afasta', Math.hypot(p2.x - debaixo[0], p2.y - debaixo[1], p2.z - debaixo[2]) > d1 * 1.5, `${d1.toFixed(1)} → ${Math.hypot(p2.x - debaixo[0], p2.y - debaixo[1], p2.z - debaixo[2]).toFixed(1)} m`);
for (let i = 0; i < 12; i++) { await rato('mouseWheel', cx, cy, { deltaX: 0, deltaY: 100 }); await dormir(40); }
await dormir(1200);
const p3 = await pose();
const tecto = await avaliar('window.__t.ctl._tectoAgora()');
prova('roda para trás: nunca acima do tecto', p3.y <= tecto + 0.02, `y=${p3.y.toFixed(2)} tecto=${tecto.toFixed(2)}`);
for (let i = 0; i < 25; i++) { await rato('mouseWheel', cx, cy, { deltaX: 0, deltaY: -100 }); await dormir(30); }
await dormir(1500);
const p4 = await pose();
prova('roda: nunca abaixo da altura mínima', p4.y >= 14.98, `y=${p4.y.toFixed(2)}`);

// ── 4. Ctrl + arrastar: roda e inclina à volta do meio
await voltarAoInicio();
const meio = await ponto(L / 2, A / 2);
p0 = await pose();
await arrastar(640, 380, 790, 380, { modificadores: 2 });
p1 = await pose();
onde = await proj(meio);
prova('Ctrl + arrastar para a direita: roda (rumo desce)', p1.rumo < p0.rumo - 20, `rumo ${p0.rumo.toFixed(1)} → ${p1.rumo.toFixed(1)}`);
prova('Ctrl + arrastar: o meio fica no meio', Math.hypot(onde[0] - L / 2, onde[1] - A / 2) < 6, `ficou em (${onde.map(v => v.toFixed(0))})`);
await foto('4-rodar');
p0 = p1;
await arrastar(640, 380, 640, 300, { modificadores: 2 });
p1 = await pose();
onde = await proj(meio);
prova('Ctrl + arrastar para cima: inclina para o horizonte', p1.inclinacao > p0.inclinacao + 5 || p1.inclinacao >= -10.01, `inclinação ${p0.inclinacao.toFixed(1)} → ${p1.inclinacao.toFixed(1)}`);
prova('inclinar: o meio fica no meio', Math.hypot(onde[0] - L / 2, onde[1] - A / 2) < 6, `ficou em (${onde.map(v => v.toFixed(0))})`);
await arrastar(640, 300, 640, 760, { modificadores: 2, passos: 30 });
p1 = await pose();
prova('Ctrl + arrastar para baixo: vista de cima, sem passar do tecto', p1.inclinacao < -60 && p1.y <= tecto + 0.02, `inclinação ${p1.inclinacao.toFixed(1)}, y=${p1.y.toFixed(1)}`);
await foto('4-de-cima');

// ── 4b. Os limites abrandam, sem batida
// Depois de cada passo do rato espera-se que o motor desenhe, para cada
// passo contar o que fez.
const umaImagem = () => avaliar('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))');
// O maior salto de velocidade entre dois passos seguidos, em fracção da
// velocidade mais alta: perto de zero é suave; perto de um é uma parede (a
// velocidade toda num passo e nada no seguinte).
const maiorSalto = (passos) => {
    const livre = Math.max(...passos.map(Math.abs)) || 1;
    let salto = 0;
    for (let i = 1; i < passos.length; i++) salto = Math.max(salto, Math.abs(passos[i] - passos[i - 1]) / livre);
    return { salto, ultimo: Math.abs(passos[passos.length - 1]) / livre };
};
async function arrastarAPassos(dy, passos, modificadores) {
    const inclinacoes = [];
    const alturas = [];
    let y = A / 2;
    await rato('mouseMoved', L / 2, y);
    await rato('mousePressed', L / 2, y, { button: 'left', buttons: 1, clickCount: 1, modifiers: modificadores });
    for (let i = 0; i < passos; i++) {
        y += dy;
        await rato('mouseMoved', L / 2, y, { button: 'left', buttons: 1, modifiers: modificadores });
        await umaImagem();
        const p = await pose();
        inclinacoes.push(p.inclinacao);
        alturas.push(p.y);
    }
    await rato('mouseReleased', L / 2, y, { button: 'left', buttons: 0, clickCount: 1, modifiers: modificadores });
    await dormir(300);
    return { inclinacoes, alturas };
}
const diferencas = v => v.slice(1).map((x, i) => x - v[i]);

// A distância da câmara ao meio do ecrã, pelo raio do meio, até à altura do
// sítio à volta do qual se roda (a mesma altura para todas as contas).
const distanciaAoMeio = (y, inclinacao, h) => (y - h) / Math.sin(-inclinacao * Math.PI / 180);

// Inclinar para o horizonte com o Ctrl, já perto do chão: a câmara chega à
// altura mínima a abrandar, e desliza por ele para trás, sem parar.
await voltarAoInicio();
for (let i = 0; i < 4; i++) { await rato('mouseWheel', L / 2, A / 2, { deltaX: 0, deltaY: -100 }); await dormir(60); }
await dormir(1200);
let inicioDoChao = await pose();
let g = await arrastarAPassos(-3, 70, 2);
let s = maiorSalto(diferencas(g.inclinacoes));
let hPivo = await avaliar('window.__t.alturaDoPivo()');
let dAntes = distanciaAoMeio(inicioDoChao.y, inicioDoChao.inclinacao, hPivo);
let dMaior = Math.max(...g.alturas.map((y, i) => distanciaAoMeio(y, g.inclinacoes[i], hPivo)));
prova('Ctrl + arrastar para cima até ao chão: desliza para trás por ele, a abrandar, sem batida',
    s.salto < 0.35 && s.ultimo < 0.15 && Math.min(...g.alturas) >= 14.99 && dMaior > dAntes * 1.1,
    `maior salto ${(s.salto * 100).toFixed(0)} % da velocidade, último passo ${(s.ultimo * 100).toFixed(0)} %, mais baixo ${Math.min(...g.alturas).toFixed(2)} m, distância ao meio ${dAntes.toFixed(0)} → ${dMaior.toFixed(0)} m`);

// …e inclinando de volta até ao ângulo do princípio, a câmara volta à
// distância a que estava: o que o chão a afastou desfaz-se.
let p = await pose();
let y0 = A / 2;
await rato('mouseMoved', L / 2, y0);
await rato('mousePressed', L / 2, y0, { button: 'left', buttons: 1, clickCount: 1, modifiers: 2 });
for (let i = 0; i < 120 && p.inclinacao > inicioDoChao.inclinacao + 0.05; i++) {
    y0 += 1;
    await rato('mouseMoved', L / 2, y0, { button: 'left', buttons: 1, modifiers: 2 });
    await umaImagem();
    p = await pose();
}
await rato('mouseReleased', L / 2, y0, { button: 'left', buttons: 0, clickCount: 1, modifiers: 2 });
await dormir(300);
hPivo = await avaliar('window.__t.alturaDoPivo()');
dAntes = distanciaAoMeio(inicioDoChao.y, inicioDoChao.inclinacao, hPivo);
let dDepois = distanciaAoMeio(p.y, p.inclinacao, hPivo);
prova('… e ao voltar ao mesmo ângulo, volta à mesma distância', Math.abs(dDepois - dAntes) / dAntes < 0.02,
    `distância ao meio ${dAntes.toFixed(1)} → ${dDepois.toFixed(1)} m (inclinação ${inicioDoChao.inclinacao.toFixed(1)} → ${p.inclinacao.toFixed(1)})`);

// No tecto: inclinar para a vista de cima aproxima a câmara do meio (ela não
// pode subir); inclinando de volta até ao ângulo do princípio, afasta-se
// outra vez até onde estava — e não fica a descer mais perto do que
// estava, a apertar contra o chão.
await voltarAoInicio();
const inicioDoTecto = await pose();
g = await arrastarAPassos(3, 25, 2);
hPivo = await avaliar('window.__t.alturaDoPivo()');
const dMenor = Math.min(...g.alturas.map((y, i) => distanciaAoMeio(y, g.inclinacoes[i], hPivo)));
p = await pose();
y0 = A / 2;
await rato('mouseMoved', L / 2, y0);
await rato('mousePressed', L / 2, y0, { button: 'left', buttons: 1, clickCount: 1, modifiers: 2 });
for (let i = 0; i < 120 && p.inclinacao < inicioDoTecto.inclinacao - 0.05; i++) {
    y0 -= 1;
    await rato('mouseMoved', L / 2, y0, { button: 'left', buttons: 1, modifiers: 2 });
    await umaImagem();
    p = await pose();
}
await rato('mouseReleased', L / 2, y0, { button: 'left', buttons: 0, clickCount: 1, modifiers: 2 });
await dormir(300);
hPivo = await avaliar('window.__t.alturaDoPivo()');
dAntes = distanciaAoMeio(inicioDoTecto.y, inicioDoTecto.inclinacao, hPivo);
dDepois = distanciaAoMeio(p.y, p.inclinacao, hPivo);
prova('Ctrl para a vista de cima no tecto aproxima; de volta ao mesmo ângulo, desfaz a aproximação',
    dMenor < dAntes * 0.9 && Math.abs(dDepois - dAntes) / dAntes < 0.02 && Math.abs(p.y - inicioDoTecto.y) < 1,
    `distância ao meio ${dAntes.toFixed(1)} → ${dMenor.toFixed(1)} (no tecto) → ${dDepois.toFixed(1)} m; altura ${inicioDoTecto.y.toFixed(1)} → ${p.y.toFixed(1)} m`);

// Inclinar para a vista de cima com o Ctrl, abaixo do tecto: a câmara sobe, e
// tem de chegar ao tecto a abrandar.
await voltarAoInicio();
for (let i = 0; i < 2; i++) { await rato('mouseWheel', L / 2, A / 2, { deltaX: 0, deltaY: -100 }); await dormir(60); }
await dormir(1200);
g = await arrastarAPassos(3, 70, 2);
s = maiorSalto(diferencas(g.alturas));
prova('Ctrl + arrastar para baixo até ao tecto: a subida abranda, sem batida', s.salto < 0.35 && Math.max(...g.alturas) <= tecto + 0.02,
    `maior salto ${(s.salto * 100).toFixed(0)} % da velocidade de subida, mais alto ${Math.max(...g.alturas).toFixed(2)} m (tecto ${tecto.toFixed(2)})`);

// A roda até à altura mínima: a descida abranda antes de lá chegar.
await voltarAoInicio();
await avaliar(`(() => { window.__alturas = []; window.__t.app.on('postrender', () => window.__alturas.push(window.__t.cam.getPosition().y)); return 1; })()`);
for (let i = 0; i < 14; i++) { await rato('mouseWheel', L / 2, A / 2, { deltaX: 0, deltaY: -100 }); await dormir(40); }
await dormir(2500);
const alturasDaRoda = JSON.parse(await avaliar('JSON.stringify(window.__alturas)'));
const descidas = diferencas(alturasDaRoda).filter(d => d < -1e-4);
s = maiorSalto(descidas);
prova('roda até à altura mínima: a descida abranda, sem batida', s.ultimo < 0.1 && Math.min(...alturasDaRoda) >= 14.99,
    `último passo ${(s.ultimo * 100).toFixed(0)} % da velocidade, mais baixo ${Math.min(...alturasDaRoda).toFixed(2)} m`);

// ── 5. Botão direito também roda
await voltarAoInicio();
p0 = await pose();
await arrastar(640, 380, 500, 380, { botao: 'right' });
p1 = await pose();
prova('botão direito + arrastar para a esquerda: roda (rumo sobe)', p1.rumo > p0.rumo + 20, `rumo ${p0.rumo.toFixed(1)} → ${p1.rumo.toFixed(1)}`);

// ── 6. Um clique não mexe; duplo clique aproxima e centra
await voltarAoInicio();
p0 = await pose();
await rato('mouseMoved', 700, 500);
await rato('mousePressed', 700, 500, { button: 'left', buttons: 1, clickCount: 1 });
await rato('mouseReleased', 700, 500, { button: 'left', buttons: 0, clickCount: 1 });
await dormir(1200);
p1 = await pose();
prova('um clique sozinho não mexe no bairro', Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z) < 0.01, '');
const alvoDuplo = await ponto(500, 520);
await rato('mousePressed', 500, 520, { button: 'left', buttons: 1, clickCount: 1 });
await rato('mouseReleased', 500, 520, { button: 'left', buttons: 0, clickCount: 1 });
await dormir(90);
await rato('mousePressed', 500, 520, { button: 'left', buttons: 1, clickCount: 2 });
await rato('mouseReleased', 500, 520, { button: 'left', buttons: 0, clickCount: 2 });
await dormir(1500);
p1 = await pose();
onde = await proj(alvoDuplo);
const dd0 = Math.hypot(p0.x - alvoDuplo[0], p0.y - alvoDuplo[1], p0.z - alvoDuplo[2]);
const dd1 = Math.hypot(p1.x - alvoDuplo[0], p1.y - alvoDuplo[1], p1.z - alvoDuplo[2]);
prova('duplo clique: o sítio vem para o meio do ecrã', Math.hypot(onde[0] - L / 2, onde[1] - A / 2) < 10, `ficou em (${onde.map(v => v.toFixed(0))})`);
prova('duplo clique: aproxima', dd1 < dd0 * 0.75, `${dd0.toFixed(1)} → ${dd1.toFixed(1)} m`);
await foto('6-duplo');

// ── 7. Teclado: setas andam, Shift+setas rodam, + e − aproximam
const tecla = async (key, code, vk, ms = 400, modifiers = 0) => {
    await enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, modifiers });
    await dormir(ms);
    await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
    await dormir(600);
};
await voltarAoInicio();
p0 = await pose();
await tecla('ArrowUp', 'ArrowUp', 38, 500);
p1 = await pose();
prova('seta para cima: anda para a frente, à mesma altura', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 3 && Math.abs(p1.y - p0.y) < 0.01, `andou ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);
p0 = p1;
await enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 8 });
await tecla('ArrowRight', 'ArrowRight', 39, 500, 8);
await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 0 });
await dormir(300);
p1 = await pose();
prova('Shift + seta para a direita: roda para a direita', p1.rumo < p0.rumo - 10, `rumo ${p0.rumo.toFixed(1)} → ${p1.rumo.toFixed(1)}`);
p0 = await pose();
const centro = await ponto(L / 2, A / 2);
await enviar('Input.dispatchKeyEvent', { type: 'keyDown', key: '+', code: 'Equal', windowsVirtualKeyCode: 187, text: '+' });
await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: '+', code: 'Equal', windowsVirtualKeyCode: 187 });
await dormir(800);
p1 = await pose();
const dc0 = Math.hypot(p0.x - centro[0], p0.y - centro[1], p0.z - centro[2]);
const dc1 = Math.hypot(p1.x - centro[0], p1.y - centro[1], p1.z - centro[2]);
prova('tecla +: aproxima do meio', dc1 < dc0 * 0.85, `${dc0.toFixed(1)} → ${dc1.toFixed(1)} m`);

// ── 8. Bússola: carregar vira para norte
await voltarAoInicio();
const temBussola = await avaliar(`!!document.getElementById('compass-container') && getComputedStyle(document.getElementById('compass-container')).pointerEvents !== 'none'`);
if (temBussola) {
    const caixa = JSON.parse(await avaliar(`JSON.stringify(document.getElementById('compass-container').getBoundingClientRect())`));
    await rato('mouseMoved', caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await rato('mousePressed', caixa.x + caixa.width / 2, caixa.y + caixa.height / 2, { button: 'left', buttons: 1, clickCount: 1 });
    await rato('mouseReleased', caixa.x + caixa.width / 2, caixa.y + caixa.height / 2, { button: 'left', buttons: 0, clickCount: 1 });
    await dormir(1500);
    p1 = await pose();
    const norte = await avaliar(`window.__t.cam.script.compassController.NORTH_OFFSET`);
    prova('bússola: vira para norte', Math.abs(((p1.rumo - norte) % 360 + 540) % 360 - 180) < 1, `rumo ${p1.rumo.toFixed(1)} (norte = ${norte})`);

    // A agulha vai com a câmara na mesma imagem: rodando o bairro com o
    // Ctrl, o ângulo que se vê na agulha (o desenhado, a meio de qualquer
    // transição) é o da câmara nesse instante.
    await voltarAoInicio();
    const diferencaDaAgulha = `(() => {
        const m = getComputedStyle(document.getElementById('compass-needle')).transform;
        const v = m.startsWith('matrix(') ? m.slice(7, -1).split(',').map(Number) : [1, 0];
        const agulha = Math.atan2(v[1], v[0]) * 180 / Math.PI;
        const r = window.__t.cam.right;
        const rumo = Math.atan2(-r.z, r.x) * 180 / Math.PI;
        const d = ((agulha - (rumo - window.__t.cam.script.compassController.NORTH_OFFSET)) % 360 + 540) % 360 - 180;
        return Math.abs(d);
    })()`;
    let atraso = 0;
    await rato('mouseMoved', L / 2, A / 2);
    await rato('mousePressed', L / 2, A / 2, { button: 'left', buttons: 1, clickCount: 1, modifiers: 2 });
    for (let i = 1; i <= 30; i++) {
        await rato('mouseMoved', L / 2 + 10 * i, A / 2, { button: 'left', buttons: 1, modifiers: 2 });
        await umaImagem();
        atraso = Math.max(atraso, await avaliar(diferencaDaAgulha));
    }
    await rato('mouseReleased', L / 2 + 300, A / 2, { button: 'left', buttons: 0, clickCount: 1, modifiers: 2 });
    await dormir(300);
    prova('bússola: a agulha vai com a câmara, sem atraso', atraso < 0.5, `maior diferença ${atraso.toFixed(2)}º`);
}

// ── 9. Dedos
await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const toque = (type, pontos) => enviar('Input.dispatchTouchEvent', { type, touchPoints: pontos.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
await voltarAoInicio();
p0 = await pose();
const agarradoDedo = await ponto(640, 500);
await toque('touchStart', [[640, 500]]);
for (let i = 1; i <= 20; i++) { await toque('touchMove', [[640 - 10 * i, 500 - 4 * i]]); await dormir(16); }
await dormir(250);
await toque('touchEnd', []);
await dormir(300);
onde = await proj(agarradoDedo);
prova('um dedo: arrasta, com o sítio debaixo do dedo', Math.hypot(onde[0] - 440, onde[1] - 420) < 10, `ficou em (${onde.map(v => v.toFixed(0))})`);

await voltarAoInicio();
const meioDedos = await ponto(640, 450);
p0 = await pose();
await toque('touchStart', [[560, 450], [720, 450]]);
for (let i = 1; i <= 20; i++) { await toque('touchMove', [[560 - 4 * i, 450], [720 + 4 * i, 450]]); await dormir(16); }
await dormir(200);
await toque('touchEnd', []);
await dormir(300);
p1 = await pose();
onde = await proj(meioDedos);
const dm0 = Math.hypot(p0.x - meioDedos[0], p0.y - meioDedos[1], p0.z - meioDedos[2]);
const dm1 = Math.hypot(p1.x - meioDedos[0], p1.y - meioDedos[1], p1.z - meioDedos[2]);
prova('pinça a abrir: aproxima (160 → 320 px ≈ metade)', dm1 / dm0 < 0.6 && dm1 / dm0 > 0.4, `${dm0.toFixed(1)} → ${dm1.toFixed(1)} m`);
prova('pinça: o sítio entre os dedos fica entre os dedos', Math.hypot(onde[0] - 640, onde[1] - 450) < 10, `ficou em (${onde.map(v => v.toFixed(0))})`);

await voltarAoInicio();
p0 = await pose();
await toque('touchStart', [[560, 450], [720, 450]]);
for (let i = 1; i <= 30; i++) {
    const ang = i * 2 * Math.PI / 180;
    await toque('touchMove', [[640 - 80 * Math.cos(ang), 450 - 80 * Math.sin(ang)], [640 + 80 * Math.cos(ang), 450 + 80 * Math.sin(ang)]]);
    await dormir(16);
}
await dormir(200);
await toque('touchEnd', []);
await dormir(300);
p1 = await pose();
prova('dois dedos a rodar no sentido do relógio: o bairro roda com eles', p1.rumo > p0.rumo + 20, `rumo ${p0.rumo.toFixed(1)} → ${p1.rumo.toFixed(1)}`);

await voltarAoInicio();
p0 = await pose();
await toque('touchStart', [[560, 500], [720, 500]]);
for (let i = 1; i <= 20; i++) { await toque('touchMove', [[560, 500 - 5 * i], [720, 500 - 5 * i]]); await dormir(16); }
await dormir(200);
await toque('touchEnd', []);
await dormir(300);
p1 = await pose();
prova('dois dedos a subir juntos: inclinam para o horizonte', p1.inclinacao > p0.inclinacao + 5 || p1.inclinacao >= -10.01, `inclinação ${p0.inclinacao.toFixed(1)} → ${p1.inclinacao.toFixed(1)}`);
await toque('touchStart', [[560, 420], [720, 420]]);
for (let i = 1; i <= 30; i++) { await toque('touchMove', [[560, 420 + 8 * i], [720, 420 + 8 * i]]); await dormir(16); }
await dormir(200);
await toque('touchEnd', []);
await dormir(300);
const p5 = await pose();
prova('dois dedos a descer juntos: vista de cima', p5.inclinacao < p1.inclinacao - 20, `inclinação ${p1.inclinacao.toFixed(1)} → ${p5.inclinacao.toFixed(1)}`);

await voltarAoInicio();
p0 = await pose();
const alvoToque = await ponto(520, 520);
await toque('touchStart', [[520, 520]]); await dormir(40); await toque('touchEnd', []);
await dormir(100);
await toque('touchStart', [[522, 521]]); await dormir(40); await toque('touchEnd', []);
await dormir(1500);
onde = await proj(alvoToque);
prova('dois toques: o sítio vem para o meio', Math.hypot(onde[0] - L / 2, onde[1] - A / 2) < 12, `ficou em (${onde.map(v => v.toFixed(0))})`);
p0 = await pose();
await toque('touchStart', [[600, 400], [700, 400]]); await dormir(60); await toque('touchEnd', []);
await dormir(1000);
p1 = await pose();
prova('dois dedos a tocar: afasta', p1.y > p0.y + 1, `y ${p0.y.toFixed(1)} → ${p1.y.toFixed(1)}`);

const gestos = JSON.parse(await avaliar('JSON.stringify([...new Set(window.__t.gestos)])'));
prova('os gestos são avisados (mover, aproximar, rodar, inclinar)', ['mover', 'aproximar', 'rodar', 'inclinar'].every(n => gestos.includes(n)), gestos.join(', '));
prova('sem erros na consola', erros.length === 0, erros.slice(0, 5).join(' | '));

const falhas = resultados.filter(r => !r).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} ok`);
arrumar();
process.exit(falhas ? 1 : 0);
