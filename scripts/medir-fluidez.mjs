/**
 * Mede as imagens por segundo do bairro num Chrome verdadeiro, à parte.
 *
 * Abre o site num Chrome com perfil limpo (a placa gráfica a sério, e um
 * separador à vista, que é o que faz o navegador desenhar), espera pelo
 * bairro e leva a câmara por um percurso sempre igual — pontos de vista
 * perto do chão e por cima, a andar e a rodar —, enquanto regista o tempo
 * de cada imagem e o degrau em que o modo Automático está. No fim conta
 * quantos segundos ficaram abaixo das 30 imagens.
 *
 * Serve para comparar duas versões do afinador de fluidez no mesmo
 * computador: corre-se antes e depois da alteração.
 *
 *   bun scripts/medir-fluidez.mjs                         # localhost:8000, 110 s
 *   bun scripts/medir-fluidez.mjs https://malhaviva.pt    # o site publicado
 *   bun scripts/medir-fluidez.mjs --segundos=60           # percurso mais curto
 *   bun scripts/medir-fluidez.mjs --qualidade=high        # fixa o nível (sem Automático)
 *   bun scripts/medir-fluidez.mjs --aparelho=medio        # finge um computador de 4 núcleos (nível Médio)
 *   bun scripts/medir-fluidez.mjs --aparelho=telemovel    # finge um telemóvel (nível Baixo)
 *   bun scripts/medir-fluidez.mjs --carga=45              # junta um peso artificial, que de início custa 45 ms
 *                                                         # por imagem e encolhe com o pormenor, o tecto de manchas e
 *                                                         # a densidade (prova que os botões do afinador funcionam)
 *
 * Se o Chrome não for encontrado, diz-se onde está com CHROME=caminho.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const valorDe = (nome, omissao) => {
    const a = args.find((x) => x.startsWith('--' + nome + '='));
    return a ? a.split('=')[1] : omissao;
};
const origem = (args.find((a) => a.startsWith('http')) || 'http://localhost:8000').replace(/\/$/, '');
const SEGUNDOS = Number(valorDe('segundos', 110));
const QUALIDADE = valorDe('qualidade', 'auto');
const APARELHO = valorDe('aparelho', 'este');
const CARGA = Number(valorDe('carga', 0));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

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
try { await fetch(origem + '/', { signal: AbortSignal.timeout(4000) }); }
catch { console.error(`O site não responde em ${origem}.`); process.exit(2); }

const porta = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-fluidez-'));
const processo = spawn(chrome, [
    `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,800', '--window-position=40,40',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion',
    'about:blank',
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
if (!alvos) { console.error('O Chrome não abriu.'); arrumar(); process.exit(2); }

const ws = new WebSocket(alvos.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let seq = 0;
const pendentes = new Map();
ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d); pendentes.delete(d.id); }
};
const enviar = (method, params = {}) => new Promise((r) => { const i = ++seq; pendentes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async (expressao, esperar = false) => {
    const r = await enviar('Runtime.evaluate', { expression: expressao, awaitPromise: esperar, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails));
    return r.result?.result?.value;
};
await enviar('Page.enable'); await enviar('Runtime.enable');

// Os outros níveis do modo Automático decidem-se pelo aparelho: finge-se um.
if (APARELHO === 'medio') {
    await enviar('Emulation.setHardwareConcurrencyOverride', { hardwareConcurrency: 4 });
} else if (APARELHO === 'telemovel') {
    await enviar('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36' });
    await enviar('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true });
    await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}

console.log(`A medir ${origem} (${QUALIDADE === 'auto' ? 'Automático' : 'nível ' + QUALIDADE}, aparelho: ${APARELHO}), ${SEGUNDOS} s de percurso, num Chrome à parte\n`);

// Prepara a memória do site e abre o bairro.
await enviar('Page.navigate', { url: origem + '/creditos' });
await dormir(1500);
await avaliar(`localStorage.clear(); sessionStorage.clear(); ${QUALIDADE === 'auto' ? '' : `localStorage.setItem('quality', '${QUALIDADE}');`} 1`);
await enviar('Page.navigate', { url: origem + '/' });

// Espera que o ecrã de espera saia: é a altura em que o afinador arranca.
const inicioDaEspera = Date.now();
let pronto = false;
while (Date.now() - inicioDaEspera < 120000) {
    await dormir(500);
    try {
        pronto = await avaliar(`(() => { const o = document.getElementById('loading-overlay'); return !!o && o.classList.contains('hidden') && !!document.querySelector('pc-app')?.app; })()`);
    } catch { pronto = false; }
    if (pronto) break;
}
if (!pronto) { console.error('O bairro não chegou a abrir.'); arrumar(); process.exit(2); }
console.log(`Bairro aberto ao fim de ${((Date.now() - inicioDaEspera) / 1000).toFixed(0)} s.`);

// O que o navegador diz do ecrã e da placa gráfica.
console.log('Ecrã:', await avaliar(`JSON.stringify({ dpr: devicePixelRatio, janela: innerWidth + 'x' + innerHeight, nucleos: navigator.hardwareConcurrency, nivel: window.actualQuality, motor: document.querySelector('pc-app').app.graphicsDevice.deviceType })`));

// O registo de imagens, o relógio por segundo e o percurso.
await avaliar(`(() => {
    const app = document.querySelector('pc-app').app;
    const f = window.__f = { t0: performance.now(), dts: [], seg: [] };
    let ultimo = 0;
    (function laco(t) {
        requestAnimationFrame(laco);
        if (ultimo) f.dts.push([Math.round((t - f.t0) * 10) / 10, Math.round((t - ultimo) * 10) / 10]);
        ultimo = t;
    })(performance.now());
    setInterval(() => {
        const gs = app.scene.gsplat;
        const d = window.afinadorDeFluidez ? window.afinadorDeFluidez.diagnostico : null;
        f.seg.push({
            s: Math.round((performance.now() - f.t0) / 1000),
            dist: Math.round((window.distanciaDoDetalhe || 0) * 10) / 10,
            dens: Math.round(app.graphicsDevice.maxPixelRatio * 100) / 100,
            orc: gs.splatBudget,
            idx: d ? d.indice : null,
            lentas: d ? d.parteLenta : null
        });
    }, 1000);
    return 1;
})()`);

if (CARGA) {
    await avaliar(`(() => {
        const app = document.querySelector('pc-app').app;
        const gs = app.scene.gsplat;
        const dist0 = window.distanciaDoDetalhe, orc0 = gs.splatBudget, dens0 = app.graphicsDevice.maxPixelRatio;
        app.on('update', () => {
            const manchas = orc0 > 0 ? Math.pow(gs.splatBudget / orc0, 0.8) : Math.pow(window.distanciaDoDetalhe / dist0, 2.5);
            const pontos = Math.pow(app.graphicsDevice.maxPixelRatio / dens0, 2);
            const ms = ${CARGA} * (0.15 + 0.85 * manchas * (0.5 + 0.5 * pontos));
            const fim = performance.now() + ms;
            while (performance.now() < fim) { /* peso artificial */ }
        });
        return 1;
    })()`);
    console.log(`Carga artificial: ${CARGA} ms por imagem no degrau de partida.`);
}

const percurso = `(async () => {
    const pc = await import('playcanvas');
    const app = document.querySelector('pc-app').app;
    const ctl = app.root.findByName('camera').script.cameraControls;
    // [x, y, z, rumo em graus, inclinação]: perto do chão e por cima.
    const pontos = [
        [0, 6, 0, 30, 0], [60, 8, -40, 200, 0], [-80, 30, 60, 90, -0.2], [120, 6, 100, 270, 0],
        [-150, 8, -120, 45, 0], [30, 40, 150, 180, -0.3], [-40, 5, -60, 0, 0], [90, 10, -150, 120, 0],
        [-120, 6, 20, 300, 0], [0, 60, 200, 200, -0.4], [150, 6, 0, 90, 0], [-60, 20, -200, 10, -0.1]
    ];
    const t0 = performance.now();
    while ((performance.now() - t0) / 1000 < ${SEGUNDOS}) {
        const s = (performance.now() - t0) / 1000;
        const p = pontos[Math.floor(s / 7) % pontos.length];
        const dentro = s % 7;
        const rumo = (p[3] + dentro * 12) * Math.PI / 180;
        const dx = Math.sin(rumo), dz = Math.cos(rumo);
        const pos = new pc.Vec3(p[0] + dx * dentro * 3, p[1], p[2] + dz * dentro * 3);
        const foco = new pc.Vec3(pos.x + dx * 30, p[1] + 30 * p[4], pos.z + dz * 30);
        ctl.recenter(pos, foco);
        await new Promise((r) => setTimeout(r, 250));
    }
    return 'fim';
})()`;
await avaliar(percurso, true);
await dormir(500);

const dados = JSON.parse(await avaliar('JSON.stringify(window.__f)'));
const diag = await avaliar('window.afinadorDeFluidez ? JSON.stringify(window.afinadorDeFluidez.diagnostico) : null');

// --- Contas -----------------------------------------------------------
const porSegundo = [];
for (const [t, dt] of dados.dts) {
    const s = Math.floor(t / 1000);
    (porSegundo[s] = porSegundo[s] || []).push(dt);
}
const fps = porSegundo.map((a) => (a ? a.length : 0));
const util = fps.slice(1, SEGUNDOS);
const ordenados = util.slice().sort((a, b) => a - b);
const todas = dados.dts.map((x) => x[1]).filter((x) => x < 1000);
const lentas = todas.filter((x) => x > 35).length;
const parte = (limite) => (util.filter((x) => x < limite).length / util.length * 100).toFixed(0) + '%';

console.log('\nLinha do tempo (a cada 5 s):  fps médio / pior segundo   distância do detalhe · densidade · degrau');
for (let s = 0; s < util.length; s += 5) {
    const fatia = util.slice(s, s + 5);
    const media = fatia.reduce((a, b) => a + b, 0) / fatia.length;
    const estado = dados.seg.find((x) => x.s === s + 1) || {};
    console.log(
        `  ${String(s).padStart(3)} s   ${media.toFixed(0).padStart(3)} / ${String(Math.min(...fatia)).padStart(3)}     ` +
        `${String(estado.dist).padStart(6)} m · ${estado.dens} · ${estado.idx === null || estado.idx === undefined ? '-' : estado.idx}` +
        (estado.orc ? ` · tecto ${Math.round(estado.orc / 1000)}k` : '')
    );
}

console.log('\nResumo');
console.log(`  segundos abaixo de 30 imagens: ${parte(30)}   abaixo de 25: ${parte(25)}   abaixo de 20: ${parte(20)}`);
console.log(`  imagens por segundo — média ${(util.reduce((a, b) => a + b, 0) / util.length).toFixed(0)}, ` +
    `pior 5% dos segundos ${ordenados[Math.floor(ordenados.length * 0.05)]}, pior ${ordenados[0]}`);
console.log(`  imagens lentas (mais de 35 ms): ${(lentas / todas.length * 100).toFixed(1)}%`);
if (diag) {
    const d = JSON.parse(diag);
    console.log(`  degraus mudados: ${d.diario.length}; degrau final ${d.indice} de ${d.degraus - 1}`);
    const zero = dados.t0;
    for (const m of d.diario) {
        console.log(`    ${((m.instante - zero) / 1000).toFixed(1).padStart(6)} s  ${m.de} -> ${m.para}  ${m.motivo}`);
    }
}

ws.close();
arrumar();
setTimeout(() => process.exit(0), 300);
