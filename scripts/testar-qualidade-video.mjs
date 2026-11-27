/**
 * Prova da escolha automática da qualidade dos vídeos
 * (`public/qualidade-video.mjs`).
 *
 * Uma escolha que escolhe mal não dá erro nenhum: só deixa o vídeo pior, em
 * silêncio — aos saltos de nitidez, com o som a falhar em cada troca, ou
 * parado à espera de mais filme. Isto abre um Chrome verdadeiro, à parte,
 * com um perfil limpo e sem som, finge ligações de vários feitios (rápida,
 * justa, a oscilar, lenta, a cair de repente) e conta, para um testemunho e
 * para uma rota 360º:
 *
 *   - quantas vezes a qualidade muda, e porquê;
 *   - quanto tempo o filme fica parado (imagem e som) em cada troca;
 *   - quantas vezes e quanto tempo o filme pára à espera de mais filme;
 *   - em que qualidade se esteve, e quantos megas se gastaram.
 *
 * O testemunho é visto num palco do tamanho da janela, como o do mapa (o
 * mapa inteiro não faz falta para isto e levava minutos a abrir); a rota é
 * vista na página verdadeira das rotas.
 *
 * Uso, com o site a correr (`bun run dev`):
 *   bun scripts/testar-qualidade-video.mjs                  # todos os casos, com o código de agora
 *   bun scripts/testar-qualidade-video.mjs --versao=0d1f8ad # o mesmo, com o código de um commit
 *   bun scripts/testar-qualidade-video.mjs --so=oscilante,queda --minutos=2
 *   bun scripts/testar-qualidade-video.mjs --so=memoria     # a segunda visita começa logo bem
 *   --json=ficheiro.json guarda tudo o que foi medido
 *
 * Com `--versao`, todas as páginas e ficheiros do site são servidos tal como
 * estavam nesse commit (lidos do git), para comparar o antes e o depois na
 * mesma máquina e com a mesma rede fingida. Os vídeos vêm sempre da nuvem.
 * Os testemunhos e as rotas correm ao mesmo tempo, cada um no seu Chrome.
 *
 * Nunca correr contra o site publicado: conta visitas nas estatísticas.
 *
 * Se o Chrome não for encontrado, diz-se onde está com CHROME=caminho.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcao = (nome, omissao) => {
    const a = args.find((x) => x.startsWith(`--${nome}=`));
    return a ? a.slice(nome.length + 3) : omissao;
};
const origem = (args.find((a) => a.startsWith('http')) || 'http://localhost:8000').replace(/\/$/, '');
const versao = opcao('versao', null);
const minutos = parseFloat(opcao('minutos', '3'));
const so = opcao('so', null);
const ficheiroJson = opcao('json', null);
const soUm = opcao('video', null); // 'entrevista' ou 'rota'
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

if (/malhaviva\.pt/.test(origem)) {
    console.error('Isto não corre contra o site publicado: contava visitas nas estatísticas.');
    process.exit(2);
}

// --- Os casos ----------------------------------------------------------------
//
// Cada perfil é uma lista de [segundo, Mbps]: a partir desse segundo a
// ligação passa a dar esses megabits por segundo. Os números de cada caso
// foram escolhidos a olhar para o que cada versão pesa a sério (ver
// `public/videos.mjs`): a Luna em 1440p pede 8,2 Mbps, em 1080p 1,9; a rota
// A em 1440p pede 18,8, em 1080p 6,6, em 720p 2,3 e em 480p 0,7.

function onda(alta, baixa, meio, total) {
    const p = [];
    for (let t = 0; t < total; t += 2 * meio) p.push([t, alta], [t + meio, baixa]);
    return p;
}

// Uma ligação "de casa" que vai e vem: muda a cada 3 s, à volta de um valor
// médio, sempre com a mesma sequência (para o antes e o depois verem a mesma).
function ruido(media, total, semente) {
    let s = semente;
    const aleatorio = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const p = [];
    for (let t = 0; t < total; t += 3) {
        const fator = Math.exp((aleatorio() - 0.5) * 1.6); // de ~0,45x a ~2,2x
        p.push([t, +(media * fator).toFixed(2)]);
    }
    return p;
}

const TOTAL = Math.round(minutos * 60);
const CENARIOS = [
    {
        nome: 'rapida', titulo: 'Ligação rápida e estável (40 Mbps)',
        entrevista: [[0, 40]], rota: [[0, 40]]
    },
    {
        nome: 'justa', titulo: 'Estável, a meio caminho entre duas qualidades',
        entrevista: [[0, 10]], rota: [[0, 10]]
    },
    {
        nome: 'oscilante', titulo: 'A oscilar: 15 s boa, 15 s fraca',
        entrevista: onda(12, 3, 15, TOTAL), rota: onda(28, 7, 15, TOTAL)
    },
    {
        nome: 'ruidosa', titulo: 'Instável: muda a cada 3 s, à volta de um valor médio',
        entrevista: ruido(9, TOTAL, 7), rota: ruido(16, TOTAL, 11)
    },
    {
        nome: 'lenta', titulo: 'Lenta e estável',
        entrevista: [[0, 1.2]], rota: [[0, 1.6]]
    },
    {
        nome: 'queda', titulo: 'Rápida, e aos 60 s de repente lenta',
        entrevista: [[0, 40], [60, 1.2]], rota: [[0, 40], [60, 1.6]]
    },
    {
        // Duas visitas seguidas ao mesmo vídeo, sem apagar a memória do
        // site entre elas: a segunda devia começar logo na qualidade certa.
        nome: 'memoria', titulo: 'Segunda visita com a mesma ligação (25 Mbps)',
        entrevista: [[0, 25]], rota: [[0, 25]], repetir: true, duracao: 75
    }
];

const VIDEOS = {
    entrevista: {
        nome: 'Luna',
        pagina: '/__teste-qualidade?nome=Luna',
        seletor: '#filme'
    },
    rota: {
        nome: 'Esvarena - 360 - A',
        pagina: '/video360?nome=' + encodeURIComponent('Esvarena - 360 - A'),
        seletor: '#video360'
    }
};

// O palco dos testemunhos, como o do mapa: o filme a encher a janela, com
// o gestor da qualidade ligado da mesma maneira que em `annotations.mjs`.
const PALCO = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Teste da qualidade</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}
#moldura{position:fixed;inset:0}#moldura video{width:100%;height:100%;display:block}</style>
<script src="/legendas.js"></script></head><body>
<div id="moldura"><video id="filme" playsinline crossorigin="anonymous"></video><div id="legenda"></div></div>
<script type="module">
import { fontesDeVideo } from '/videos.mjs';
import { criarGestorDeQualidade } from '/qualidade-video.mjs';
const nome = new URLSearchParams(location.search).get('nome') || 'Luna';
const video = document.getElementById('filme');
const moldura = document.getElementById('moldura');
if (window.Legendas) window.Legendas.ligar(video, document.getElementById('legenda')).mostrar(nome);
const gestor = criarGestorDeQualidade({ video, fontes: fontesDeVideo(nome), nome, moldura });
window.gestorDeQualidade = gestor;
void moldura.clientHeight;
gestor.arrancar();
video.play().catch((e) => console.log('play', e && e.name));
</script></body></html>`;

// O que se mede dentro da página: cada troca de endereço do filme, cada
// evento do filme, e de 50 em 50 ms o relógio do filme e a reserva.
const INSTRUMENTO = `(() => {
    if (window.__qv) return;
    // As instruções da primeira rota param o filme até alguém as fechar:
    // aqui fazem de conta que já foram vistas.
    try { localStorage.setItem('instrucoes360-praticar', 'vistas'); } catch (e) { /* segue */ }
    const t0 = performance.now();
    const qv = window.__qv = { eventos: [], amostras: [], diag: [] };
    const agora = () => +((performance.now() - t0) / 1000).toFixed(3);
    const papel = (v) => (v.dataset && v.dataset.papel) || v.id || 'video';
    const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        configurable: true, enumerable: true,
        get() { return desc.get.call(this); },
        set(v) {
            qv.eventos.push({ t: agora(), tipo: 'src', papel: papel(this), url: String(v), em: this.currentTime });
            return desc.set.call(this, v);
        }
    });
    ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'playing', 'waiting', 'stalled',
     'seeking', 'seeked', 'pause', 'play', 'ended', 'error', 'emptied'].forEach((ev) => {
        document.addEventListener(ev, (e) => {
            const v = e.target;
            if (!(v instanceof HTMLMediaElement)) return;
            qv.eventos.push({ t: agora(), tipo: ev, papel: papel(v), ct: +v.currentTime.toFixed(3), rs: v.readyState, ns: v.networkState });
        }, true);
    });
    let n = 0;
    setInterval(() => {
        const v = document.querySelector(window.__qvSeletor || 'video');
        if (!v) return;
        const t = v.currentTime;
        let reserva = 0;
        for (let i = 0; i < v.buffered.length; i++) {
            if (v.buffered.start(i) <= t + 0.05 && t <= v.buffered.end(i)) reserva = v.buffered.end(i) - t;
        }
        const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null;
        qv.amostras.push([agora(), +t.toFixed(3), v.paused ? 1 : 0, v.readyState, v.networkState, +reserva.toFixed(2),
            q ? q.totalVideoFrames : -1, q ? q.droppedVideoFrames : -1, v.ended ? 1 : 0]);
        if (++n % 20 === 0 && window.gestorDeQualidade) {
            try { qv.diag.push([agora(), JSON.parse(JSON.stringify(window.gestorDeQualidade.diagnostico))]); } catch (e) { /* segue */ }
        }
    }, 50);
})();`;

// --- O site tal como estava num commit -----------------------------------------

const TIPOS = {
    html: 'text/html; charset=utf-8', mjs: 'text/javascript; charset=utf-8', js: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', jpg: 'image/jpeg',
    jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', vtt: 'text/vtt; charset=utf-8', ico: 'image/x-icon',
    woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', wasm: 'application/wasm', glb: 'model/gltf-binary'
};
const doCommit = new Map();
function ficheiroDoCommit(caminho) {
    if (doCommit.has(caminho)) return doCommit.get(caminho);
    let conteudo = null;
    // O que não é ficheiro (as contas das estatísticas, por exemplo) vai ao
    // servidor de cá, como sempre.
    const candidatos = caminho.startsWith('/api/') ? []
        : [caminho, caminho + '.html', caminho.replace(/\/$/, '') + '/index.html'];
    for (const c of candidatos) {
        try {
            conteudo = {
                dados: execFileSync('git', ['show', `${versao}:public/${c.replace(/^\//, '')}`],
                    { cwd: RAIZ, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] }),
                nome: c
            };
            break;
        } catch { /* não está lá com este nome */ }
    }
    doCommit.set(caminho, conteudo);
    return conteudo;
}

// --- A ligação fingida -------------------------------------------------------------
//
// O Chrome tem um travão de rede próprio (Network.emulateNetworkConditions),
// mas não serve aqui: uma mudança de velocidade só vale para os pedidos
// seguintes, e o que já estava a descarregar — o filme, que é um pedido só
// do princípio ao fim — passa a ir à velocidade toda da ligação verdadeira.
// Por isso o Chrome vai à nuvem por um cano nosso (um proxy), que deixa
// passar os bytes ao ritmo que o caso pede, a cada instante, e com o atraso
// de uma ligação verdadeira. Só deixa passar a nuvem dos vídeos.

const NUVEM = 'pub-0a409b596f304409941ca1f88f3b593b.r2.dev';

function criarCano() {
    const estado = { bytesPorSegundo: 5e6, atraso: 30, bytes: 0 };
    const tuneis = new Set();
    const servidor = net.createServer((cliente) => {
        let cabeca = Buffer.alloc(0);
        const aoChegar = (d) => {
            cabeca = Buffer.concat([cabeca, d]);
            const fim = cabeca.indexOf('\r\n\r\n');
            if (fim < 0) return;
            cliente.removeListener('data', aoChegar);
            const m = /^CONNECT ([^:\s]+):(\d+)/.exec(cabeca.slice(0, cabeca.indexOf('\r\n')).toString());
            if (!m || m[1] !== NUVEM) { cliente.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
            const resto = cabeca.slice(fim + 4);
            const remoto = net.connect(+m[2], m[1], () => {
                cliente.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                if (resto.length) remoto.write(resto);
                cliente.pipe(remoto);
            });
            const tunel = { cliente, remoto, pedacos: [], emFila: 0 };
            tuneis.add(tunel);
            remoto.on('data', (bytes) => {
                tunel.pedacos.push({ bytes, quando: Date.now() + estado.atraso });
                tunel.emFila += bytes.length;
                if (tunel.emFila > 512 * 1024) remoto.pause();
            });
            const fechar = () => {
                tuneis.delete(tunel);
                cliente.destroy();
                remoto.destroy();
            };
            remoto.on('close', fechar);
            remoto.on('error', fechar);
            cliente.on('close', fechar);
            cliente.on('error', fechar);
        };
        cliente.on('data', aoChegar);
        cliente.on('error', () => cliente.destroy());
    });
    // Os bytes saem às fatias, de poucos em poucos milissegundos, a dividir
    // o ritmo pelos túneis abertos.
    let antes = Date.now();
    let credito = 0;
    const relogio = setInterval(() => {
        const t = Date.now();
        credito = Math.min(credito + estado.bytesPorSegundo * (t - antes) / 1000, estado.bytesPorSegundo * 0.05);
        antes = t;
        let mexeu = true;
        while (credito >= 1 && mexeu) {
            mexeu = false;
            for (const tunel of tuneis) {
                const p = tunel.pedacos[0];
                if (!p || p.quando > t) continue;
                // O Chrome não está a ler (o navegador já tem filme que
                // chegue e parou de descarregar): não se lhe empurra mais nada,
                // como numa ligação verdadeira.
                if (tunel.cliente.writableLength > 64 * 1024) continue;
                const n = Math.min(p.bytes.length, Math.floor(credito), 16384);
                if (n <= 0) break;
                tunel.cliente.write(p.bytes.subarray(0, n));
                credito -= n;
                estado.bytes += n;
                tunel.emFila -= n;
                if (n === p.bytes.length) tunel.pedacos.shift();
                else p.bytes = p.bytes.subarray(n);
                if (tunel.emFila < 128 * 1024 && tunel.remoto.isPaused()) tunel.remoto.resume();
                mexeu = true;
                if (credito < 1) break;
            }
        }
    }, 4);
    return {
        ouvir: () => new Promise((r) => servidor.listen(0, '127.0.0.1', () => r(servidor.address().port))),
        /** Daqui em diante, `mbps` megabits por segundo, com `atraso` ms de demora. */
        definir(mbps, atraso) {
            estado.bytesPorSegundo = mbps * 1e6 / 8;
            estado.atraso = atraso;
        },
        get megas() { return estado.bytes / 1e6; },
        /** Fecha as ligações abertas, para o caso seguinte começar do zero. */
        cortar() { for (const tunel of tuneis) { tunel.cliente.destroy(); tunel.remoto.destroy(); } tuneis.clear(); },
        fechar() { clearInterval(relogio); this.cortar(); servidor.close(); }
    };
}

// --- O Chrome --------------------------------------------------------------------

function acharChrome() {
    const candidatos = [
        process.env.CHROME,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium'
    ];
    return candidatos.find((c) => c && existsSync(c));
}

const chrome = acharChrome();
if (!chrome) { console.error('Chrome não encontrado. Diz onde está com CHROME=caminho.'); process.exit(2); }
try { await fetch(origem + '/favicon.svg', { signal: AbortSignal.timeout(4000) }); }
catch { console.error(`O site não responde em ${origem}. Arranca-o primeiro (bun run dev).`); process.exit(2); }

const abertos = [];
function arrumarTudo() {
    for (const a of abertos) {
        try { a.processo.kill(); } catch { /* já saiu */ }
        try { a.cano.fechar(); } catch { /* já fechado */ }
        setTimeout(() => { try { rmSync(a.perfil, { recursive: true, force: true }); } catch { /* ainda aberto */ } }, 1500);
    }
}
process.on('exit', arrumarTudo);
process.on('SIGINT', () => process.exit(130));

async function abrirChrome(posicao) {
    const porta = 9300 + Math.floor(Math.random() * 600);
    const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-qualidade-'));
    const cano = criarCano();
    const portaDoCano = await cano.ouvir();
    const processo = spawn(chrome, [
        `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
        '--no-first-run', '--no-default-browser-check', '--window-size=1000,640', `--window-position=${posicao},0`,
        '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion',
        // O filme arranca com som sem ninguém carregar em nada (como num
        // visitante que já lá esteve), mas o som não sai pelas colunas.
        '--autoplay-policy=no-user-gesture-required', '--mute-audio',
        // A nuvem pelo cano; o site de cá vai direito (o Chrome nunca passa
        // o localhost por um proxy).
        `--proxy-server=http://127.0.0.1:${portaDoCano}`,
        '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings',
        'about:blank'
    ], { stdio: 'ignore' });
    abertos.push({ processo, perfil, cano });
    let versaoChrome;
    for (let i = 0; i < 60 && !versaoChrome; i++) {
        try { versaoChrome = await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json(); } catch { await dormir(500); }
    }
    if (!versaoChrome) throw new Error('O Chrome não abriu.');
    return { porta, cano };
}

/** Uma ligação a um separador, com pedidos e eventos. */
async function ligar(url) {
    const ws = new WebSocket(url);
    await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
    let seq = 0;
    const pendentes = new Map();
    const ouvintes = new Map();
    ws.onmessage = (m) => {
        const d = JSON.parse(m.data);
        if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d); pendentes.delete(d.id); return; }
        const fs = ouvintes.get(d.method);
        if (fs) fs.forEach((f) => f(d.params));
    };
    const enviar = (method, params = {}) => new Promise((r) => {
        const i = ++seq;
        pendentes.set(i, r);
        ws.send(JSON.stringify({ id: i, method, params }));
    });
    return {
        enviar,
        ouvir: (metodo, f) => { if (!ouvintes.has(metodo)) ouvintes.set(metodo, []); ouvintes.get(metodo).push(f); },
        avaliar: async (expressao) => {
            const r = await enviar('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true });
            return r.result && r.result.result ? r.result.result.value : undefined;
        },
        fechar: () => ws.close()
    };
}

/**
 * Uma visita: um separador novo, a memória do site e a cache apagadas (a
 * não ser que se peça para as manter), a ligação fingida segundo o perfil.
 */
async function visitar({ porta, cano, tipo, cenario, manterMemoria, duracao }) {
    const video = VIDEOS[tipo];
    const perfil = cenario[tipo];
    cano.cortar();
    const megasAntes = cano.megas;
    const novo = await (await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await ligar(novo.webSocketDebuggerUrl);
    const { enviar, ouvir, avaliar } = cdp;

    // Primeiro uma página pequena do site: o separador muda de processo ao
    // sair de about:blank, e o que se liga antes perde-se.
    await enviar('Page.enable');
    await enviar('Page.navigate', { url: origem + '/favicon.svg' });
    await dormir(800);
    await enviar('Page.enable');
    await enviar('Runtime.enable');
    await enviar('Network.enable', { maxTotalBufferSize: 1024 * 1024, maxResourceBufferSize: 1024 * 64 });
    if (!manterMemoria) {
        await enviar('Network.clearBrowserCache');
        await enviar('Storage.clearDataForOrigin', { origin: origem, storageTypes: 'all' });
    }
    await enviar('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 2, mobile: false });
    // O que o Chrome diz da ligação: o que ela era ao abrir a página, com o
    // tecto de 10 Mbps que o Chrome verdadeiro põe (nunca diz mais do que isso).
    const diz = Math.round(Math.min(10, perfil[0][1]) * 40) / 40;
    const ligacaoDita = `try { if (navigator.connection) Object.defineProperty(navigator.connection, 'downlink', { get: () => ${diz}, configurable: true }); } catch (e) { /* segue */ }`;
    await enviar('Page.addScriptToEvaluateOnNewDocument', { source: `window.__qvSeletor = ${JSON.stringify(video.seletor)};` + ligacaoDita + INSTRUMENTO });

    // O palco do teste, e com --versao o site do commit.
    await enviar('Fetch.enable', { patterns: [{ urlPattern: origem + '/*', requestStage: 'Request' }] });
    ouvir('Fetch.requestPaused', async (p) => {
        const u = new URL(p.request.url);
        let corpo = null;
        let tipoDoCorpo = 'text/html; charset=utf-8';
        if (u.pathname === '/__teste-qualidade') {
            corpo = Buffer.from(PALCO);
        } else if (versao) {
            const f = ficheiroDoCommit(decodeURIComponent(u.pathname));
            if (f) {
                corpo = f.dados;
                tipoDoCorpo = TIPOS[(f.nome.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
            }
        }
        if (!corpo) { enviar('Fetch.continueRequest', { requestId: p.requestId }); return; }
        enviar('Fetch.fulfillRequest', {
            requestId: p.requestId, responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: tipoDoCorpo }, { name: 'Cache-Control', value: 'no-store' }],
            body: corpo.toString('base64')
        });
    });

    // Os erros da página: um erro no código da troca não pode passar calado.
    const erros = [];
    ouvir('Runtime.exceptionThrown', (p) => {
        const d = p.exceptionDetails || {};
        erros.push(((d.exception && d.exception.description) || d.text || 'erro').split(/\r?\n/)[0]);
    });
    ouvir('Runtime.consoleAPICalled', (p) => {
        if (p.type === 'error') erros.push((p.args || []).map((a) => a.value || a.description || '').join(' ').split(/\r?\n/)[0]);
    });

    // Os megas que vêm da nuvem, contados à chegada.
    const urlDe = new Map();
    const megas = { filme: 0, outros: 0 };
    ouvir('Network.requestWillBeSent', (p) => urlDe.set(p.requestId, p.request.url));
    ouvir('Network.dataReceived', (p) => {
        const url = urlDe.get(p.requestId) || '';
        if (!/r2\.dev/.test(url)) return;
        megas[/\.mp4/.test(url) ? 'filme' : 'outros'] += (p.encodedDataLength || 0) / 1e6;
    });

    const rede = (mbps) => cano.definir(mbps, mbps < 2 ? 80 : 30);
    rede(perfil[0][1]);
    await enviar('Page.navigate', { url: origem + video.pagina });

    // O que passou pelo cano, segundo a segundo: a prova de que a ligação
    // fingida foi a que o caso pedia.
    const trafego = [];
    const inicio = Date.now();
    let passo = 0;
    let proximaMarca = 0;
    while ((Date.now() - inicio) / 1000 < duracao) {
        const t = (Date.now() - inicio) / 1000;
        while (passo + 1 < perfil.length && perfil[passo + 1][0] <= t) {
            passo++;
            rede(perfil[passo][1]);
        }
        if (t >= proximaMarca) {
            trafego.push([+t.toFixed(1), +(cano.megas - megasAntes).toFixed(3), perfil[passo][1]]);
            proximaMarca += 1;
        }
        await dormir(100);
    }
    const dados = await avaliar('window.__qv ? { eventos: __qv.eventos, amostras: __qv.amostras, diag: __qv.diag, historico: window.gestorDeQualidade && window.gestorDeQualidade.historico ? JSON.parse(JSON.stringify(window.gestorDeQualidade.historico)) : null } : null');
    await enviar('Fetch.disable');
    cdp.fechar();
    try { await fetch(`http://127.0.0.1:${porta}/json/close/${novo.id}`); } catch { /* já fechou */ }
    megas.cano = cano.megas - megasAntes;
    return { dados, megas, perfil, duracao, trafego, erros };
}

// --- As contas ---------------------------------------------------------------------

const alturaDoEndereco = (url) => {
    const m = /_(\d+)p\.mp4/.exec(decodeURIComponent(url || ''));
    return m ? +m[1] : (url ? 'original' : null);
};

function analisar(r, tipo) {
    if (!r.dados) return { erro: 'a página não respondeu' };
    const { eventos, amostras } = r.dados;
    const principal = VIDEOS[tipo].seletor.slice(1);
    const meus = eventos.filter((e) => e.papel === principal);
    const trocasDeEndereco = meus.filter((e) => e.tipo === 'src' && e.url);
    // O filme começa a andar quando o relógio dele anda pela primeira vez
    // (o aviso "a dar" chega às vezes um segundo ou dois antes).
    const primeiroPlaying = meus.find((e) => e.tipo === 'playing');
    const primeiraAmostraAAndar = amostras.find((a, i) => i > 0 && !a[2] && a[1] > amostras[i - 1][1] && a[1] < amostras[i - 1][1] + 1);
    if (!primeiroPlaying || !primeiraAmostraAAndar) return { erro: 'o filme nunca andou', trocasDeEndereco: trocasDeEndereco.length };
    const t0 = Math.max(primeiroPlaying.t, primeiraAmostraAAndar[0]);
    const tFim = amostras.length ? amostras[amostras.length - 1][0] : t0;

    // Os pedaços em que o relógio do filme não andou, com o filme a dar.
    const congelados = [];
    let atual = null;
    for (let i = 1; i < amostras.length; i++) {
        const [w0, m0] = amostras[i - 1];
        const [w1, m1, , , , , , , acabou] = amostras[i];
        if (w1 <= t0 || acabou) continue;
        const dw = w1 - w0;
        let dm = m1 - m0;
        if (Math.abs(dm) > 2) dm = 0; // um salto (a troca pôs o relógio a zero e voltou)
        const perdido = dw - Math.max(0, dm);
        if (dm < 0.5 * dw) {
            if (!atual) atual = { de: w0, ate: w1, perdido: 0 };
            atual.ate = w1;
            atual.perdido += perdido;
        } else if (atual) {
            congelados.push(atual);
            atual = null;
        }
    }
    if (atual) congelados.push(atual);

    const trocas = trocasDeEndereco.slice(1).filter((e) => e.t >= t0 - 0.01);
    const trocasAntes = trocasDeEndereco.slice(1).filter((e) => e.t < t0 - 0.01);
    const buracos = [];
    const paragens = [];
    for (const c of congelados) {
        if (c.perdido < 0.12) continue;
        const troca = trocas.find((e) => e.t >= c.de - 0.3 && e.t <= c.ate);
        if (troca) buracos.push({ t: +troca.t.toFixed(1), segundos: +c.perdido.toFixed(2) });
        else paragens.push({ t: +c.de.toFixed(1), segundos: +c.perdido.toFixed(2) });
    }
    // Uma troca cujo filme não chegou a parar não deixa buraco nenhum.
    const buracoDe = (e) => {
        const b = buracos.find((x) => Math.abs(x.t - e.t) < 0.5);
        return b ? b.segundos : 0;
    };

    // O tempo em cada qualidade, desde que o filme começou a andar.
    const tempos = {};
    let alturaAtual = alturaDoEndereco(trocasDeEndereco.filter((e) => e.t <= t0).pop()?.url);
    let desde = t0;
    for (const e of trocas) {
        tempos[alturaAtual] = (tempos[alturaAtual] || 0) + (e.t - desde);
        alturaAtual = alturaDoEndereco(e.url);
        desde = e.t;
    }
    tempos[alturaAtual] = (tempos[alturaAtual] || 0) + (tFim - desde);
    const minutosAVer = (tFim - t0) / 60;
    let somaAltura = 0;
    let somaTempo = 0;
    Object.entries(tempos).forEach(([h, s]) => { if (+h) { somaAltura += +h * s; somaTempo += s; } });

    const historico = r.dados.historico || [];
    const razaoDe = (e) => {
        const h = historico.filter((x) => x.tipo === 'troca' && Math.abs(x.t - e.t) < 1.5).pop();
        return h ? h.razao : null;
    };

    return {
        arranque: +t0.toFixed(1),
        primeira: alturaDoEndereco(trocasDeEndereco[0]?.url),
        trocasAntesDeAndar: trocasAntes.length,
        trocas: trocas.map((e, i) => ({
            t: +e.t.toFixed(1),
            de: alturaDoEndereco((i ? trocas[i - 1] : trocasDeEndereco.filter((x) => x.t <= t0).pop())?.url),
            para: alturaDoEndereco(e.url),
            buraco: buracoDe(e),
            razao: razaoDe(e)
        })),
        trocasPorMinuto: +(trocas.length / Math.max(minutosAVer, 0.01)).toFixed(2),
        buracoTotal: +buracos.reduce((s, b) => s + b.segundos, 0).toFixed(2),
        paragens,
        segundosParado: +paragens.reduce((s, p) => s + p.segundos, 0).toFixed(1),
        tempos: Object.fromEntries(Object.entries(tempos).map(([h, s]) => [h, Math.round(s)])),
        alturaMedia: somaTempo ? Math.round(somaAltura / somaTempo) : 0,
        megas: +(r.megas.cano || r.megas.filme).toFixed(1),
        erros: r.erros || [],
        minutosAVer: +minutosAVer.toFixed(2)
    };
}

// --- O programa ----------------------------------------------------------------------

const escolhidos = CENARIOS.filter((c) => !so || so.split(',').includes(c.nome));
const tipos = soUm ? [soUm] : ['entrevista', 'rota'];
console.log(`A provar a qualidade automática em ${origem}${versao ? ` com o site do commit ${versao}` : ' com o código de agora'}`);
console.log(`${escolhidos.length} casos x ${tipos.length} vídeos, ${minutos} min cada (${tipos.join(' e ')} ao mesmo tempo)\n`);

const resultados = {};
async function trabalhador(tipo, indice) {
    const { porta, cano } = await abrirChrome(indice * 520);
    for (const cenario of escolhidos) {
        const duracao = cenario.duracao || TOTAL;
        const visitas = cenario.repetir ? 2 : 1;
        for (let v = 0; v < visitas; v++) {
            const r = await visitar({ porta, cano, tipo, cenario, manterMemoria: v > 0, duracao });
            const chave = cenario.nome + (visitas > 1 ? `-${v + 1}` : '');
            const a = analisar(r, tipo);
            resultados[tipo] = resultados[tipo] || {};
            resultados[tipo][chave] = { analise: a, bruto: r };
            const resumo = a.erro ? a.erro : `${a.trocas.length} trocas (${a.trocasPorMinuto}/min), ` +
                `parado ${a.segundosParado} s em ${a.paragens.length} paragens, buracos nas trocas ${a.buracoTotal} s, ` +
                `começou em ${a.primeira}, média ${a.alturaMedia}p, ${a.megas} MB` +
                (a.erros.length ? `, ${a.erros.length} ERROS: ${a.erros.slice(0, 3).join(' | ')}` : '');
            console.log(`  [${tipo}] ${chave}: ${resumo}`);
        }
    }
}

await Promise.all(tipos.map((t, i) => trabalhador(t, i)));

console.log('\nResumo');
for (const tipo of tipos) {
    console.log(`\n  ${tipo === 'entrevista' ? 'Testemunho (Luna)' : 'Rota 360º (A)'}`);
    console.log('  caso            trocas  /min  paragens  parado(s)  buracos(s)  1.ª   média   MB');
    for (const [chave, { analise: a }] of Object.entries(resultados[tipo] || {})) {
        if (a.erro) { console.log(`  ${chave.padEnd(15)} ${a.erro}`); continue; }
        console.log(`  ${chave.padEnd(15)} ${String(a.trocas.length).padStart(6)}  ${a.trocasPorMinuto.toFixed(2).padStart(4)}  ` +
            `${String(a.paragens.length).padStart(8)}  ${a.segundosParado.toFixed(1).padStart(9)}  ${a.buracoTotal.toFixed(2).padStart(10)}  ` +
            `${String(a.primeira).padStart(4)}  ${String(a.alturaMedia).padStart(5)}p  ${a.megas.toFixed(0).padStart(4)}`);
        a.trocas.forEach((x) => console.log(`        ${String(x.t).padStart(6)} s  ${x.de} -> ${x.para}` +
            `${x.buraco ? `, parado ${x.buraco} s` : ''}${x.razao ? `  (${x.razao})` : ''}`));
    }
}

if (ficheiroJson) {
    writeFileSync(ficheiroJson, JSON.stringify({ versao: versao || 'trabalho', minutos, resultados }, null, 1));
    console.log(`\nGuardado em ${ficheiroJson}`);
}
arrumarTudo();
setTimeout(() => process.exit(0), 300);
