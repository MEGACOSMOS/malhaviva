/**
 * Prova do guarda do arranque (o primeiro bloco de `public/index.html`).
 *
 * O guarda repara sozinho o Chrome que ficou preso a arrancar, mandando-o a
 * `/limpar`, que apaga a cache do site. Reparar de mais é tão mau como
 * reparar de menos: já aconteceu um visitante com a ligação lenta carregar
 * em F5 e ser mandado limpar a cache a cada vez, sem o site chegar a guardar
 * nada. Isto abre um Chrome verdadeiro, à parte, com um perfil limpo, e
 * confere que o guarda repara quando deve e só quando deve.
 *
 * Uso, com o site a correr (`bun run dev`):
 *   bun scripts/testar-arranque.mjs                        # os testes rápidos
 *   bun scripts/testar-arranque.mjs --completo             # + o do código que nunca chega (~1 min)
 *   bun scripts/testar-arranque.mjs http://localhost:8000  # outro endereço
 *
 * Se o Chrome não for encontrado, diz-se onde está com CHROME=caminho.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const completo = args.includes('--completo');
const origem = (args.find((a) => a.startsWith('http')) || 'http://localhost:8000').replace(/\/$/, '');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function acharChrome() {
    const candidatos = [
        process.env.CHROME,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
    ];
    return candidatos.find((c) => c && existsSync(c));
}

const chrome = acharChrome();
if (!chrome) { console.error('Chrome não encontrado. Diz onde está com CHROME=caminho.'); process.exit(2); }
try { await fetch(origem + '/', { signal: AbortSignal.timeout(4000) }); }
catch { console.error(`O site não responde em ${origem}. Arranca-o primeiro (bun run dev).`); process.exit(2); }

const porta = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-teste-'));
const processo = spawn(chrome, [
    `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,800',
    // O separador tem de contar como "à vista": o guarda só conta o tempo à vista.
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion',
    'about:blank',
], { stdio: 'ignore' });

function arrumar() {
    try { processo.kill(); } catch { /* já saiu */ }
    setTimeout(() => { try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Chrome ainda o tem aberto */ } }, 1500);
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
let idas = []; // as páginas a que o separador foi parar, por ordem
ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d); pendentes.delete(d.id); return; }
    if (d.method === 'Page.frameNavigated' && !d.params.frame.parentId) idas.push(new URL(d.params.frame.url).pathname);
};
const enviar = (method, params = {}) => new Promise((r) => { const i = ++seq; pendentes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async (expressao) => (await enviar('Runtime.evaluate', { expression: expressao })).result?.result?.value;
await enviar('Page.enable'); await enviar('Runtime.enable'); await enviar('Network.enable');

const SONDA = `JSON.stringify({
    bairro: !!(window.arranque && window.arranque.estado().marcos.bairro),
    codigo: !!(window.arranque && window.arranque.estado().marcos.modulo),
    espera: (() => { const o = document.getElementById('loading-overlay'); return !!o && !o.classList.contains('hidden'); })()
})`;

/**
 * Uma visita ao bairro, a partir de um estado conhecido.
 * @param {object} o
 * @param {string} [o.marca] - JS que prepara a memória do site (a visita "anterior").
 * @param {boolean} [o.manterBolinhos] - não apagar os bolinhos (a memória de "já reparei").
 * @param {number} [o.kbps] - ligação lenta, sem cache.
 * @param {number} [o.f5] - quantas vezes recarregar durante o arranque.
 * @param {string} [o.bloquear] - endereço (com *) que nunca chega.
 * @param {number} o.espera - ms a esperar no fim.
 */
async function visitar(o) {
    if (!o.manterBolinhos) await enviar('Network.clearBrowserCookies');
    await enviar('Network.setBlockedURLs', { urls: o.bloquear ? [o.bloquear] : [] });
    await enviar('Network.setCacheDisabled', { cacheDisabled: false });
    await enviar('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await enviar('Page.navigate', { url: origem + '/creditos' });
    await dormir(2000);
    await avaliar(`sessionStorage.clear(); localStorage.clear(); ${o.marca || ''}; 1`);
    if (o.kbps) {
        await enviar('Network.setCacheDisabled', { cacheDisabled: true });
        await enviar('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: o.kbps * 128, uploadThroughput: 64000 });
    }
    idas = [];
    await enviar('Page.navigate', { url: origem + '/' });
    for (let i = 0; i < (o.f5 || 0); i++) { await dormir(2500); await enviar('Page.reload'); }
    // Com `ateOBairro`, sai logo que o bairro aparece (a rede a sério, depois
    // de uma limpeza, demora mais do que um tempo fixo que sirva ao localhost).
    const fim = Date.now() + o.espera;
    let estado;
    do {
        await dormir(o.ateOBairro ? 500 : o.espera);
        estado = JSON.parse((await avaliar(SONDA)) || '{}');
    } while (o.ateOBairro && !estado.bairro && Date.now() < fim);
    if (o.ateOBairro && estado.bairro) {
        // O ecrã de espera sai um instante depois de o bairro aparecer.
        await dormir(2000);
        estado = JSON.parse((await avaliar(SONDA)) || '{}');
    }
    return { limpezas: idas.filter((p) => p === '/limpar').length, ...estado };
}

const marcaPresa = (visto) => `localStorage.setItem('arranque-pendente', JSON.stringify({ quando: Date.now() - 90000, vivo: Date.now() - 60000, fase: 'pagina', visto: ${visto} }))`;
const resultados = [];
const prova = (nome, condicao, detalhe) => {
    resultados.push(condicao);
    console.log(`${condicao ? '  ok  ' : ' FALHA'}  ${nome}${condicao ? '' : '   -> ' + detalhe}`);
};

console.log(`A provar o guarda do arranque em ${origem}, num Chrome à parte com perfil limpo\n`);

let r = await visitar({ kbps: 1600, f5: 3, espera: 4000 });
prova('F5 seguido, com ligação lenta, não limpa a cache nenhuma vez', r.limpezas === 0, `${r.limpezas} limpezas`);

r = await visitar({ marca: marcaPresa(3), espera: 30000, ateOBairro: true });
prova('visita anterior interrompida cedo (3 s à vista) não leva a limpeza', r.limpezas === 0 && r.bairro, JSON.stringify(r));

r = await visitar({ marca: `localStorage.setItem('arranque-pendente', JSON.stringify({ quando: Date.now() - 60000, fase: 'pagina' }))`, espera: 30000, ateOBairro: true });
prova('marca no formato antigo (sem os segundos à vista) não leva a limpeza', r.limpezas === 0 && r.bairro, JSON.stringify(r));

r = await visitar({ marca: marcaPresa(20), espera: 30000, ateOBairro: true });
prova('visita anterior mesmo presa (20 s à vista) leva uma limpeza, e o bairro arranca', r.limpezas === 1 && r.bairro && !r.espera, JSON.stringify(r));

r = await visitar({ marca: marcaPresa(20), manterBolinhos: true, espera: 30000, ateOBairro: true });
prova('e logo a seguir (dentro de meia hora) não leva outra', r.limpezas === 0 && r.bairro, JSON.stringify(r));

if (completo) {
    console.log('\n  (o teste do código que nunca chega demora cerca de um minuto)');
    r = await visitar({ bloquear: '*/motor/playcanvas-*', espera: 45000 });
    prova('código do site que nunca chega: repara uma vez aos 30 s e não entra em ciclo', r.limpezas === 1 && !r.codigo, JSON.stringify(r));
}

const falhas = resultados.filter((x) => !x).length;
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
ws.close();
arrumar();
setTimeout(() => process.exit(falhas ? 1 : 0), 300);
