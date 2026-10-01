/**
 * Prova que o bairro abre quando o Chrome o pré-carrega em segundo plano.
 *
 * Quando alguém começa a escrever "malhaviva.pt" na barra do Chrome, o
 * Chrome adivinha para onde a pessoa vai e carrega essa página escondida,
 * para a mostrar mais depressa (o "prerender"). O motor 3D do bairro, a
 * arrancar numa página escondida assim, deixava o separador preso para
 * sempre: o círculo a rodar, a página escura e "Página sem resposta". O
 * servidor evita-o recusando esse pré-carregamento (`src/index.ts`); este
 * teste confere que, seja por essa recusa ou por a página aguentar, no fim
 * o bairro aparece.
 *
 * Como: abre um Chrome verdadeiro, à parte e com perfil limpo — SEM controlo
 * remoto, porque ligar o Chrome a um controlo desliga o pré-carregamento —
 * numa página de teste que lhe pede o pré-carregamento do bairro, espera uns
 * segundos e abre-o. A página do bairro leva um pequeno relatório por cima
 * (só neste teste, nunca no site) que diz o que lhe acontece.
 *
 * Uso, com o site a correr (`bun run dev`):
 *   bun scripts/testar-prerender.mjs                        # o site local
 *   bun scripts/testar-prerender.mjs https://malhaviva.pt   # o site publicado
 *
 * Se o Chrome não for encontrado, diz-se onde está com CHROME=caminho.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origem = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8000').replace(/\/$/, '');
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
try { await fetch(origem + '/', { signal: AbortSignal.timeout(6000) }); }
catch { console.error(`O site não responde em ${origem}. Arranca-o primeiro (bun run dev).`); process.exit(2); }

// O que a página de teste e a do bairro contam, por ordem.
const eventos = [];
let prerenderPediu = null; // o pedido de pré-carregamento chegou ao servidor? e com que resposta?
const nota = (m) => eventos.push(m);

const RELATORIO = `<script>(function(){
  var L=function(m){try{navigator.sendBeacon('/__log?'+encodeURIComponent(m));}catch(e){}};
  L('bairro:init prerendering='+document.prerendering);
  document.addEventListener('prerenderingchange',function(){L('bairro:activada');});
  window.addEventListener('load',function(){L('bairro:load');});
  var ver=function(){var o=document.getElementById('loading-overlay');
    L('bairro:estado overlay='+(o?(o.classList.contains('hidden')?'sai':'visivel'):'sem')+' bairro='+!!(window.arranque&&window.arranque.estado().marcos.bairro)+' prerendering='+document.prerendering);};
  setTimeout(ver,6000); setTimeout(ver,12000); setTimeout(ver,18000);
})();</script>`;

const TESTE = `<!doctype html><meta charset=utf-8><title>teste</title>
<script type="speculationrules">{"prerender":[{"source":"list","urls":["/"],"eagerness":"immediate"}]}</script>
<body style="font:16px sans-serif;background:#222;color:#eee"><p>Teste: a pré-carregar o bairro em segundo plano&hellip;</p>
<script>
navigator.sendBeacon('/__log?'+encodeURIComponent('teste:aberta'));
setTimeout(function(){navigator.sendBeacon('/__log?'+encodeURIComponent('teste:a-abrir-o-bairro')); location.href='/';}, 8000);
</script>`;

const servidor = Bun.serve({
    port: 0,
    async fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === '/__log') { nota(decodeURIComponent(u.search.slice(1))); return new Response(null, { status: 204 }); }
        if (u.pathname === '/__teste') return new Response(TESTE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
        const finalidade = req.headers.get('sec-purpose') || '';
        const cima = await fetch(origem + u.pathname + u.search, {
            headers: { 'accept-encoding': 'identity', 'sec-purpose': finalidade, purpose: req.headers.get('purpose') || '' },
            redirect: 'manual',
        });
        if (u.pathname === '/' && finalidade.includes('prerender')) prerenderPediu = cima.status;
        const h = new Headers(cima.headers);
        h.delete('content-encoding'); h.delete('content-length'); h.delete('transfer-encoding');
        if (u.pathname === '/' && (h.get('content-type') || '').includes('text/html')) {
            const html = (await cima.text()).replace('<head>', '<head>' + RELATORIO);
            return new Response(html, { status: cima.status, headers: h });
        }
        return new Response(cima.body, { status: cima.status, headers: h });
    },
});

const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-prerender-'));
const processo = spawn(chrome, [
    `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,800',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-features=CalculateNativeWinOcclusion',
    `http://localhost:${servidor.port}/__teste`,
], { stdio: 'ignore' });

function arrumar() {
    try { processo.kill(); } catch { /* já saiu */ }
    try { servidor.stop(true); } catch { /* já parou */ }
    setTimeout(() => { try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Chrome ainda o tem */ } }, 2000);
}
process.on('exit', arrumar);

console.log(`A provar o pré-carregamento de ${origem} num Chrome à parte, com perfil limpo (cerca de 35 s)\n`);
// Espera até o bairro aparecer depois de aberto, ou até ao limite.
const limite = Date.now() + 45000;
let abriu = false;
const apareceu = () => {
    const i = eventos.indexOf('teste:a-abrir-o-bairro');
    if (i < 0) return false;
    abriu = true;
    return eventos.slice(i).some((e) => /^bairro:estado overlay=sai bairro=true prerendering=false/.test(e));
};
while (Date.now() < limite && !apareceu()) await dormir(500);
const ok = apareceu();

const recusou = prerenderPediu !== null && prerenderPediu >= 400;
console.log(`  ${prerenderPediu === null ? 'o Chrome não chegou a pedir o pré-carregamento' : recusou ? `o servidor recusou o pré-carregamento (HTTP ${prerenderPediu})` : `o servidor aceitou o pré-carregamento (HTTP ${prerenderPediu})`}`);
console.log(`  ${abriu ? 'a página de teste abriu o bairro' : 'a página de teste nunca chegou a abrir o bairro'}`);
console.log(`  ${ok ? ' ok ' : 'FALHA'}  depois de aberto, o ecrã de espera sai e o bairro aparece`);
if (!ok) console.log('\nO que o Chrome contou, por ordem:\n  ' + eventos.join('\n  '));
console.log(ok ? '\nTudo certo.' : '\nO bairro não abriu depois de pré-carregado: o separador ficaria preso.');
arrumar();
setTimeout(() => process.exit(ok ? 0 : 1), 300);
