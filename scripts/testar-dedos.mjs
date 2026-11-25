/**
 * Prova dos gestos de dois dedos no telemóvel (ver `DoisDedos` e
 * MARCADORES_DO_BAIRRO, em public/camera-controls.mjs), num Chrome à parte,
 * com perfil limpo, à vista, a fazer de telemóvel: rodar com os dois dedos,
 * com um deles parado, depressa, devagar, a começar por subir sem querer,
 * depois de uma pinça; a pinça e o arrastar que não rodam; inclinar; e os
 * dedos em cima dos marcadores e das miniaturas — que mexem no bairro, sem
 * deixar de abrir com um toque.
 *
 * Uso, com o site a correr (`bun run dev`):
 *   node scripts/testar-dedos.mjs                      # as provas
 *   node scripts/testar-dedos.mjs https://malhaviva.pt  # outro endereço
 *
 * Todas as linhas têm de dizer `ok`.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const origem = (args.find((a) => a.startsWith('http')) || 'http://localhost:8000').replace(/\/$/, '');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')].find(existsSync);
const L = 393, A = 830;
const porta = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-dedos-'));
const processo = spawn(chrome, [
    `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=700,1000',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion',
    'about:blank',
], { stdio: 'ignore' });

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
const acabar = async (codigo) => {
    // Fechar um Chrome a meio de descarregar o bairro deita abaixo o servidor
    // de testes: primeiro sai-se da página.
    await enviar('Page.navigate', { url: 'about:blank' });
    await dormir(2500);
    try { processo.kill(); } catch { }
    await dormir(800);
    try { rmSync(perfil, { recursive: true, force: true }); } catch { }
    process.exit(codigo);
};

await enviar('Page.enable');
await enviar('Runtime.enable');
await enviar('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36', platform: 'Android' });
await enviar('Emulation.setDeviceMetricsOverride', { width: L, height: A, deviceScaleFactor: 2, mobile: true });
await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
await enviar('Page.navigate', { url: origem + '/creditos' });
await dormir(1500);
await avaliar(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('instrucoes','vistas'); localStorage.setItem('quality','low'); 1`);
await enviar('Page.navigate', { url: origem + '/' });
const inicio = Date.now();
for (;;) {
    await dormir(1000);
    const pronto = await avaliar(`!!(window.arranque && window.arranque.estado().marcos.bairro) && document.getElementById('loading-overlay').classList.contains('hidden')`).catch(() => false);
    if (pronto) break;
    if (Date.now() - inicio > 120000) { console.log('O bairro não abriu em 2 minutos'); await acabar(1); }
}
console.log(`bairro aberto em ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
await dormir(3000);

await avaliar(`(async () => {
    const pc = await import('playcanvas');
    const app = document.querySelector('pc-app').app;
    const cam = app.root.findByName('camera');
    window.__t = {
        pc, app, cam, ctl: cam.script.cameraControls, gestos: [], marcados: 0,
        pose() { const p = cam.getPosition(); const c = this.ctl._pose.angles; return { x: p.x, y: p.y, z: p.z, inclinacao: c.x, rumo: c.y }; },
        proj(p) { cam.camera._viewMatDirty = true; const s = cam.camera.worldToScreen(new pc.Vec3(p[0], p[1], p[2])); return [s.x, s.y]; },
        async ponto(x, y) { const p = await this.ctl._lerPonto(x, y); return p ? [p.x, p.y, p.z] : null; },
        por(px, py, pz, inc, rum) {
            const R = Math.PI / 180, p = inc * R, y = rum * R;
            const pos = new pc.Vec3(px, py, pz);
            const f = new pc.Vec3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
            this.ctl.recenter(pos, pos.clone().add(f.mulScalar(200)));
            return 1;
        },
        // O que está aberto por cima do bairro (um vídeo, uma paragem).
        aberta() {
            return ['video-modal', 'modal-360', 'timelapse-modal', 'mapa-modal', 'local-painel'].filter((id) => {
                const e = document.getElementById(id);
                if (!e) return false;
                const c = getComputedStyle(e);
                return c.display !== 'none' && c.visibility !== 'hidden' && parseFloat(c.opacity) > 0.05 && e.getBoundingClientRect().height > 40;
            }).join(',');
        }
    };
    window.addEventListener('gestoNoBairro', (e) => window.__t.gestos.push(e.detail.gesto));
    window.addEventListener('premirNoBairro', () => window.__t.marcados++);
    return 1;
})()`);

const resultados = [];
const prova = (nome, ok, detalhe = '') => { resultados.push(ok); console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '   ' + detalhe : ''}`); };
const pose = async () => JSON.parse(await avaliar('JSON.stringify(window.__t.pose())'));
const proj = async (p) => JSON.parse(await avaliar(`JSON.stringify(window.__t.proj(${JSON.stringify(p)}))`));
const ponto = async (x, y) => {
    for (let i = 0; i < 6; i++) {
        const r = JSON.parse(await avaliar(`window.__t.ponto(${x}, ${y}).then(JSON.stringify)`));
        if (r) return r;
        await dormir(150);
    }
    throw new Error('sem leitura em ' + x + ',' + y);
};
// Uma vista do bairro de cima, inclinada, ou a de abertura.
const vista = async (inc = -50) => {
    const R = Math.PI / 180, d = 65;
    await avaliar(`window.__t.por(0, ${(-3 + Math.sin(-inc * R) * d).toFixed(2)}, ${(20 + Math.cos(inc * R) * d).toFixed(2)}, ${inc}, 0)`);
    await dormir(700);
};
const abertura = async () => {
    await avaliar('window.__t.por(-88.74, 62.03, 294.91, -19.4, -19.7)');
    await dormir(1800);
};

const toque = (type, pontos) => enviar('Input.dispatchTouchEvent', { type, touchPoints: pontos.map((p, i) => ({ x: p[0], y: p[1], id: p[2] || i + 1, radiusX: 5, radiusY: 5, force: 1 })) });
const G = Math.PI / 180;
const suave = (k) => { k = Math.min(1, Math.max(0, k)); return k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k); };

/**
 * Faz um gesto de dois dedos.
 *
 * @param {(k: number) => number[][]} onde - Os dois dedos, de zero a um.
 * @param {number} duracao - Em milissegundos.
 * @param {object} [como] - Quanto esperar entre os dois pousarem, e se se
 * demora antes de largar.
 */
async function gesto(onde, duracao, { entre = 30, demora = 120, atraso = 0 } = {}) {
    const [a, b] = onde(0);
    await toque('touchStart', [[a[0], a[1], 1]]);
    await dormir(entre);
    await toque('touchStart', [[a[0], a[1], 1], [b[0], b[1], 2]]);
    await dormir(atraso);
    const t0 = performance.now();
    for (;;) {
        const k = Math.min(1, (performance.now() - t0) / duracao);
        const [p, q] = onde(k);
        await toque('touchMove', [[p[0], p[1], 1], [q[0], q[1], 2]]);
        if (k >= 1) break;
        await dormir(8);
    }
    await dormir(demora);
    await toque('touchEnd', []);
    await dormir(500);
}
// Dois dedos a rodar: `apoio` é onde está o eixo (0: o primeiro dedo parado,
// 0,5: no meio dos dois, 1: o segundo parado).
const aRodar = ({ x = L / 2, y = 480, d = 170, de = 0, graus = 30, apoio = 0.5, sobe = 0 } = {}) => (k) => {
    const a = (de + graus * suave(k)) * G, e0 = de * G;
    const s = -sobe * Math.min(1, k * 3);
    const ex = x + (apoio - 0.5) * d * Math.cos(e0), ey = y + (apoio - 0.5) * d * Math.sin(e0) + s;
    return [[ex - apoio * d * Math.cos(a), ey - apoio * d * Math.sin(a)], [ex + (1 - apoio) * d * Math.cos(a), ey + (1 - apoio) * d * Math.sin(a)]];
};

// ── 1. Rodar
for (const [nome, opcoes, duracao, como] of [
    ['os dois dedos, lado a lado, 25º', { graus: 25 }, 450],
    ['os dois dedos, um por cima do outro, −25º', { de: 90, graus: -25 }, 450],
    ['um dedo parado e o outro a subir à volta, −25º', { apoio: 0, graus: -25, x: 190 }, 450],
    ['o outro dedo parado, 25º', { apoio: 1, graus: 25, x: 200 }, 450],
    ['uma volta pequena, 15º', { graus: 15 }, 400],
    ['devagar, 30º em dois segundos', { graus: 30 }, 2000],
    ['depressa, 40º em 130 ms, largada em andamento', { graus: 40 }, 130, { demora: 0 }],
    ['dedos juntos (70 pontos), 35º', { d: 70, graus: 35 }, 450],
    ['a começar por subir 16 pontos, 30º', { graus: 30, sobe: 16 }, 500],
    ['a começar por descer 16 pontos, −30º', { graus: -30, sobe: -16 }, 500],
    ['uma volta grande, 110º', { graus: 110, d: 200 }, 900]
]) {
    await vista();
    const p0 = await pose();
    await gesto(aRodar(opcoes), duracao, como);
    const p1 = await pose();
    const rodou = p1.rumo - p0.rumo;
    prova(`rodar: ${nome}`, rodou / opcoes.graus > 0.75 && rodou / opcoes.graus < 1.15,
        `rodou ${rodou.toFixed(1)}º; inclinou ${(p1.inclinacao - p0.inclinacao).toFixed(1)}º`);
}

// O sítio que estava entre os dedos fica entre os dedos, e o que estava
// debaixo de cada um fica debaixo dele (visto a pique, onde não há
// perspetiva).
await vista(-85);
const entreOsDedos = await ponto(196, 450);
const debaixoDoDedo = await ponto(116, 450);
await gesto(aRodar({ x: 196, y: 450, d: 160, graus: 60 }), 800);
const fim = aRodar({ x: 196, y: 450, d: 160, graus: 60 })(1);
let onde = await proj(entreOsDedos);
prova('rodar: o sítio entre os dedos fica entre os dedos', Math.hypot(onde[0] - 196, onde[1] - 450) < 8, `a ${Math.hypot(onde[0] - 196, onde[1] - 450).toFixed(1)} pontos`);
onde = await proj(debaixoDoDedo);
prova('rodar: o sítio debaixo do dedo fica debaixo do dedo', Math.hypot(onde[0] - fim[0][0], onde[1] - fim[0][1]) < 16, `a ${Math.hypot(onde[0] - fim[0][0], onde[1] - fim[0][1]).toFixed(1)} pontos`);

// ── 2. Depois de uma pinça, sem levantar os dedos
await vista();
let p0 = await pose();
await gesto((k) => {
    const d = 100 + 70 * suave(k / 0.45), a = (4 * suave(k / 0.45) + 28 * suave((k - 0.5) / 0.5)) * G;
    return [[L / 2 - d / 2 * Math.cos(a), 480 - d / 2 * Math.sin(a)], [L / 2 + d / 2 * Math.cos(a), 480 + d / 2 * Math.sin(a)]];
}, 1100);
let p1 = await pose();
prova('rodar a seguir a uma pinça, sem levantar os dedos (28º)', p1.rumo - p0.rumo > 20, `rodou ${(p1.rumo - p0.rumo).toFixed(1)}º`);

// ── 3. O que não é rodar
await vista();
p0 = await pose();
await gesto((k) => {
    const d = 90 + 160 * suave(k), a = (20 + 8 * suave(k)) * G;
    return [[L / 2 - d / 2 * Math.cos(a), 480 - d / 2 * Math.sin(a)], [L / 2 + d / 2 * Math.cos(a), 480 + d / 2 * Math.sin(a)]];
}, 450);
p1 = await pose();
prova('pinça torcida 8º: aproxima e não roda', Math.abs(p1.rumo - p0.rumo) < 0.5 && p1.y < p0.y - 5, `rodou ${(p1.rumo - p0.rumo).toFixed(1)}º; altura ${p0.y.toFixed(0)} → ${p1.y.toFixed(0)} m`);
await vista();
p0 = await pose();
await gesto((k) => [[70 + 110 * suave(k), 480], [210 + 110 * suave(k), 480 + 6 * suave(k)]], 450);
p1 = await pose();
prova('dois dedos a arrastar para o lado: anda e não roda', Math.abs(p1.rumo - p0.rumo) < 0.5 && Math.hypot(p1.x - p0.x, p1.z - p0.z) > 3, `rodou ${(p1.rumo - p0.rumo).toFixed(1)}º; andou ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);
for (const [nome, sinal] of [['subir', -1], ['descer', 1]]) {
    await vista();
    p0 = await pose();
    // Um dedo arranca um nada antes do outro, e vão um bocadinho de lado.
    await gesto((k) => [[110 + 8 * k, 480 + sinal * 100 * suave(k + 0.04)], [260 + 8 * k, 486 + sinal * 100 * suave(k - 0.04)]], 400);
    p1 = await pose();
    prova(`dois dedos a ${nome} juntos: inclinam e não rodam`, -sinal * (p1.inclinacao - p0.inclinacao) > 12 && Math.abs(p1.rumo - p0.rumo) < 0.5, `inclinou ${(p1.inclinacao - p0.inclinacao).toFixed(1)}º; rodou ${(p1.rumo - p0.rumo).toFixed(1)}º`);
}
await vista(-30);
p0 = await pose();
await toque('touchStart', [[130, 480], [250, 480]]); await dormir(60); await toque('touchEnd', []);
await dormir(1000);
p1 = await pose();
prova('dois dedos a tocar: afastam', p1.y > p0.y + 1 && Math.abs(p1.rumo - p0.rumo) < 0.1, `altura ${p0.y.toFixed(1)} → ${p1.y.toFixed(1)} m`);

// ── 4. Em cima dos marcadores
// Um marcador bem dentro do ecrã, e um ponto dele onde se carregue de facto.
const marcador = async (miniatura) => JSON.parse(await avaliar(`(() => {
    for (const m of document.querySelectorAll('.annotation-marker[data-tipo="testemunho"]')) {
        const alvo = m.querySelector(${JSON.stringify(miniatura ? '.miniatura' : '.marker-dot')});
        if (!alvo || getComputedStyle(alvo).opacity < 0.9 || (${miniatura} && m.classList.contains('miniatura-recolhida'))) continue;
        const r = alvo.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        if (x < 40 || x > innerWidth - 40 || y < 190 || y > innerHeight - 250 || r.width < 12) continue;
        const e = document.elementFromPoint(x, y);
        if (e && e.closest('.annotation-marker') === m) return JSON.stringify({ x, y, nome: m.getAttribute('aria-label') });
    }
    return 'null';
})()`));
for (const miniatura of [false, true]) {
    const peca = miniatura ? 'numa miniatura' : 'num marcador';
    await abertura();
    let m = await marcador(miniatura);
    if (!m) { prova(`há onde carregar ${peca}`, false); continue; }
    p0 = await pose();
    // O dedo do marcador fica parado, e o outro roda à volta dele.
    await gesto((k) => {
        const a = (90 + 30 * suave(k)) * G;
        return [[m.x, m.y], [m.x + 170 * Math.cos(a), m.y + 170 * Math.sin(a)]];
    }, 500);
    p1 = await pose();
    prova(`um dedo ${peca}, o outro a rodar (30º): roda`, p1.rumo - p0.rumo > 22, `rodou ${(p1.rumo - p0.rumo).toFixed(1)}º (${m.nome})`);
    prova('… e não abre nada', await avaliar('window.__t.aberta()') === '', await avaliar('window.__t.aberta()'));

    await abertura();
    m = await marcador(miniatura);
    p0 = await pose();
    await gesto((k) => {
        const a = (60 - 30 * suave(k)) * G;
        return [[m.x, m.y], [m.x + 150 * Math.cos(a), m.y + 150 * Math.sin(a)]].reverse();
    }, 500);
    p1 = await pose();
    prova(`o segundo dedo a pousar ${peca} (−30º): roda`, p1.rumo - p0.rumo < -22, `rodou ${(p1.rumo - p0.rumo).toFixed(1)}º`);

    await abertura();
    m = await marcador(miniatura);
    p0 = await pose();
    await toque('touchStart', [[m.x, m.y]]);
    for (let i = 1; i <= 20; i++) { await toque('touchMove', [[m.x + 3 * i, m.y + 5 * i]]); await dormir(16); }
    await dormir(250);
    await toque('touchEnd', []);
    await dormir(500);
    p1 = await pose();
    prova(`arrastar a partir de ${miniatura ? 'uma miniatura' : 'um marcador'}: anda`, Math.hypot(p1.x - p0.x, p1.z - p0.z) > 5, `andou ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);
    prova('… e não abre nada', await avaliar('window.__t.aberta()') === '', await avaliar('window.__t.aberta()'));

    // Carregar sem largar num marcador não marca o sítio por baixo dele.
    await abertura();
    m = await marcador(miniatura);
    await avaliar('window.__t.marcados = 0');
    await toque('touchStart', [[m.x, m.y]]);
    await dormir(800);
    await toque('touchMove', [[m.x + 40, m.y + 40]]);
    await toque('touchEnd', []);
    await dormir(400);
    prova(`um dedo parado ${peca}: não marca o sítio`, await avaliar('window.__t.marcados') === 0);

    // Um toque, com o dedo a tremer um nada, abre-o como sempre.
    await abertura();
    m = await marcador(miniatura);
    p0 = await pose();
    await toque('touchStart', [[m.x, m.y]]);
    await dormir(40);
    await toque('touchMove', [[m.x + 3, m.y + 2]]);
    await dormir(40);
    await toque('touchEnd', []);
    await dormir(1500);
    p1 = await pose();
    const aberta = await avaliar('window.__t.aberta()');
    prova(`um toque ${peca}: abre`, aberta.includes('video-modal') && Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.01, aberta || 'nada aberto');
    // Fecha-se, para a prova seguinte. (E esquece-se que foi visto: um
    // testemunho visto já não mostra a miniatura.)
    await avaliar(`localStorage.removeItem('viewedAnnotations'); history.back(); 1`);
    await dormir(1500);
}

// ── 5. No bairro, o de sempre
await vista();
await avaliar('window.__t.marcados = 0');
await toque('touchStart', [[200, 500]]); await dormir(750); await toque('touchEnd', []);
await dormir(400);
prova('um dedo parado no bairro: marca o sítio', await avaliar('window.__t.marcados') === 1);
await avaliar('history.back()').catch(() => { });
await dormir(800);
const gestos = JSON.parse(await avaliar('JSON.stringify([...new Set(window.__t.gestos)])'));
prova('os gestos são avisados (mover, aproximar, rodar, inclinar)', ['mover', 'aproximar', 'rodar', 'inclinar'].every(n => gestos.includes(n)), gestos.join(', '));
prova('sem erros na consola', erros.length === 0, erros.slice(0, 5).join(' | ').slice(0, 600));

const falhas = resultados.filter(r => !r).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} ok`);
await acabar(falhas ? 1 : 0);
