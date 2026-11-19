/**
 * Prova das contas da página das estatísticas (ver public/contar.js,
 * src/contas.ts e public/estatisticas.html), num Chrome à parte, com perfil
 * limpo e à vista:
 *
 *  - as visitas: abrir o site conta uma; andar de página em página,
 *    recarregar, uma página dentro de uma moldura e a própria página das
 *    estatísticas não contam; voltar depois de meia hora conta outra; um
 *    navegador onde se escolheu "não contar" não conta;
 *  - as partilhas: copiar a ligação de uma casa, a de um local marcado e a
 *    do site (o botão do cabeçalho), cada uma no seu lugar;
 *  - os percursos: com a localização a andar (fingida pelo Chrome), um
 *    percurso conta como começado quando a seta aparece, não conta como
 *    feito a meio, e conta quando se chega perto da casa; terminar e voltar
 *    a iniciar não conta outra vez;
 *  - a página das estatísticas mostra os números que o servidor tem.
 *
 * Só corre contra o site local: no site publicado, as provas somavam-se às
 * contas a sério.
 *
 * Uso, com o site a correr (`bun run dev`):
 *   bun scripts/testar-estatisticas.mjs
 *   bun scripts/testar-estatisticas.mjs --fotos=C:\pasta   # e fotografias da página
 *
 * Todas as linhas têm de dizer `ok`.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const origem = (args.find((a) => a.startsWith('http')) || 'http://localhost:8000').replace(/\/$/, '');
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem)) {
    console.log('Isto só corre contra o site local: no site publicado, as provas somavam-se às contas a sério.');
    process.exit(1);
}
const fotos = args.some((a) => a.startsWith('--fotos'));
const PASTA = (args.find((a) => a.startsWith('--fotos=')) || '').slice(8) || tmpdir();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')].find(existsSync);
const L = 1280, A = 800;
const porta = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'malhaviva-contas-'));
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

const resultados = [];
const prova = (nome, ok, detalhe = '') => { resultados.push(ok); console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '   ' + detalhe : ''}`); };
const foto = async (nome) => {
    if (!fotos) return;
    const r = await enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(join(PASTA, 'estatisticas-' + nome + '.png'), Buffer.from(r.result.data, 'base64'));
};

// As contas, lidas ao servidor; e quanto cada uma subiu desde a última vez.
const ler = async () => (await (await fetch(origem + '/api/estatisticas')).json()).totais;
let antes = await ler();
const subiu = async (esperar = 1200) => {
    await dormir(esperar);
    const agora = await ler();
    const diferenca = {};
    for (const k of Object.keys(agora)) if (agora[k] !== antes[k]) diferenca[k] = agora[k] - antes[k];
    antes = agora;
    return diferenca;
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

await enviar('Page.enable');
await enviar('Runtime.enable');
await enviar('Emulation.setDeviceMetricsOverride', { width: L, height: A, deviceScaleFactor: 1, mobile: false });
await enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
await enviar('Browser.grantPermissions', { origin: origem, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite', 'geolocation'] });

const ir = async (caminho, espera = 1500) => { await enviar('Page.navigate', { url: origem + caminho }); await dormir(espera); };
async function abrirBairro(caminho) {
    await enviar('Page.navigate', { url: origem + caminho });
    const inicio = Date.now();
    for (;;) {
        await dormir(1000);
        const pronto = await avaliar(`!!(window.arranque && window.arranque.estado().marcos.bairro) && document.getElementById('loading-overlay').classList.contains('hidden')`).catch(() => false);
        if (pronto) break;
        if (Date.now() - inicio > 120000) { console.log('O bairro não abriu em 2 minutos'); process.exit(1); }
    }
    await dormir(2500);
}
const carregar = async (id) => {
    const caixa = JSON.parse(await avaliar(`JSON.stringify(document.getElementById('${id}').getBoundingClientRect())`));
    const x = caixa.x + caixa.width / 2, y = caixa.y + caixa.height / 2;
    await enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await dormir(300);
};
const esperarQue = async (expressao, ms = 15000) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) { if (await avaliar(expressao).catch(() => false)) return true; await dormir(250); }
    return false;
};

// ---- As visitas ----
console.log('As visitas');
await ir('/creditos');
const robo = await avaliar('navigator.webdriver');
prova('este Chrome não se diz comandado (senão nada contava)', robo === false, `navigator.webdriver = ${robo}`);
await avaliar(`localStorage.setItem('instrucoes', 'vistas'); 1`);
prova('abrir o site conta uma visita', igual(await subiu(), { visita: 1 }));
await ir('/controlos');
prova('ir a outra página não conta outra', igual(await subiu(), {}));
await avaliar('location.reload(), 1');
await dormir(1500);
prova('recarregar não conta outra', igual(await subiu(), {}));
await avaliar(`new Promise((r) => { const f = document.createElement('iframe'); f.src = '/creditos'; f.onload = () => setTimeout(r, 600, 1); document.body.appendChild(f); })`);
prova('uma página dentro de uma moldura não conta', igual(await subiu(), {}));
await ir('/estatisticas');
await avaliar(`localStorage.setItem('contas.ultimaVez', String(Date.now() - 31 * 60 * 1000)); 1`);
await avaliar('location.reload(), 1');
await dormir(1500);
prova('a página das estatísticas não conta como visita', igual(await subiu(), {}));
await ir('/creditos');
prova('voltar depois de meia hora conta outra', igual(await subiu(), { visita: 1 }));
await avaliar(`localStorage.setItem('contas.naoContar', 'sim'); localStorage.setItem('contas.ultimaVez', '0'); 1`);
await ir('/controlos');
prova('um navegador que escolheu não contar não conta', igual(await subiu(), {}));
await avaliar(`localStorage.removeItem('contas.naoContar'); 1`);

// ---- As partilhas ----
console.log('As partilhas');
await abrirBairro('/d31');
const comPainel = await esperarQue(`!document.getElementById('percurso-painel').hidden && /D31/.test(document.getElementById('percurso-casa').textContent) && document.querySelectorAll('#percurso-passos li').length > 1`, 30000);
prova('a ligação de uma casa abre o percurso', comPainel);
prova('abrir o bairro pela ligação de uma casa é a mesma visita', igual(await subiu(), {}));
await carregar('percurso-copiar');
const copiado = await avaliar(`document.getElementById('percurso-copiar-texto').textContent`);
prova('copiar a ligação da casa conta uma partilha de casa', igual(await subiu(), { 'partilha.casa': 1 }), copiado);
await carregar('partilhar-btn');
await dormir(400);
await avaliar(`document.querySelector('#partilhar-menu [data-rede="copiar"]').click(), 1`);
prova('copiar a ligação do site, no cabeçalho, conta uma partilha do site', igual(await subiu(), { 'partilha.site': 1 }));
await avaliar(`document.querySelector('#partilhar-menu [data-rede="whatsapp"]').addEventListener('click', (e) => e.preventDefault(), { once: true }); document.querySelector('#partilhar-menu [data-rede="whatsapp"]').click(), 1`);
prova('mandar o site por uma rede também conta', igual(await subiu(), { 'partilha.site': 1 }));
await avaliar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })), 1`);

// ---- Os percursos ----
//
// D31 (o primeiro sítio, a sul): porta em 38.6704036, -9.1831371. Começa-se
// na porta da B10, uns 200 m a norte e a leste, dentro do bairro.
console.log('Os percursos');
const posicao = (lat, lon) => enviar('Emulation.setGeolocationOverride', { latitude: lat, longitude: lon, accuracy: 5 });
await posicao(38.6719154, -9.1817389);
await carregar('percurso-iniciar');
const comSeta = await esperarQue(`!!document.querySelector('.seta-3d')`, 15000);
await dormir(1500);
prova('com a localização ligada, a seta aparece no caminho', comSeta);
prova('o percurso conta como começado (e ainda não como feito)', igual(await subiu(), { 'percurso.iniciado': 1 }));
// A meio do caminho em linha recta: fora do caminho, ou nele, ainda falta
// muito.
await posicao((38.6719154 + 38.6704036) / 2, (-9.1817389 + -9.1831371) / 2);
await dormir(2500);
const faltaAMeio = await avaliar(`document.getElementById('guia-resto').textContent`);
prova('a meio, não conta como feito', igual(await subiu(), {}), faltaAMeio);
await posicao(38.6704100, -9.1831200);
await dormir(2500);
const faltaNoFim = await avaliar(`document.getElementById('guia-resto').textContent`);
prova('perto da casa, conta como feito', igual(await subiu(), { 'percurso.feito': 1 }), faltaNoFim);
await carregar('percurso-terminar');
await dormir(800);
await posicao(38.6719154, -9.1817389);
await carregar('percurso-iniciar');
await dormir(3000);
await posicao(38.6704100, -9.1831200);
await dormir(3000);
prova('terminar e voltar a fazer o mesmo percurso não conta outra vez', igual(await subiu(), {}));
await carregar('percurso-terminar');

// ---- O local marcado ----
console.log('O local marcado');
await abrirBairro('/@38.670908,-9.181921');
const comLocal = await esperarQue(`!document.getElementById('local-painel').hidden`, 20000);
prova('a ligação de um local abre o local marcado', comLocal);
await dormir(800);
await carregar('local-partilhar');
prova('copiar a ligação do local conta uma partilha de local', igual(await subiu(), { 'partilha.local': 1 }));

// ---- A página ----
console.log('A página das estatísticas');
const servidor = await ler();
await ir('/estatisticas', 2500);
const mostra = JSON.parse(await avaliar(`JSON.stringify({
    percursos: document.getElementById('valor-percursos').textContent,
    partilhas: document.getElementById('valor-partilhas').textContent,
    visitas: document.getElementById('valor-visitas').textContent,
    desde: document.getElementById('desde').textContent,
    barras: document.querySelectorAll('#grafico svg path').length,
    nome: document.getElementById('grafico').getAttribute('aria-label')
})`));
prova('mostra os percursos feitos do servidor', mostra.percursos === String(servidor['percurso.feito']), mostra.percursos);
prova('mostra as partilhas de casas e de locais', mostra.partilhas === String(servidor['partilha.casa'] + servidor['partilha.local']), mostra.partilhas);
prova('mostra as visitas', mostra.visitas === String(servidor.visita), mostra.visitas);
prova('diz desde quando conta', /^A contar desde \d+ de \w+ de \d{4}\.$/.test(mostra.desde), mostra.desde);
prova('o gráfico tem a barra de hoje, e um nome para quem não o vê', mostra.barras >= 1 && /^Gráfico de visitas/.test(mostra.nome || ''));
await foto('computador');
await avaliar(`document.getElementById('grafico').focus(), 1`);
await dormir(300);
const dica = await avaliar(`document.getElementById('dica').classList.contains('visivel') && document.getElementById('dica-valor').textContent + ' · ' + document.getElementById('dica-dia').textContent`);
prova('com o teclado, o gráfico diz o número de hoje', typeof dica === 'string' && dica.startsWith(String(servidor.visita) + ' · Visitas · hoje'), String(dica));
await foto('dica');
for (const [lingua, titulo] of [['en', 'Statistics'], ['es', 'Estadísticas'], ['kea', 'Statístikas'], ['pt', 'Estatísticas']]) {
    await avaliar(`window.Idiomas.definir('${lingua}'), 1`);
    await dormir(200);
    const escrito = await avaliar(`document.querySelector('h1').textContent + ' | ' + document.getElementById('desde').textContent + ' | ' + document.getElementById('contexto-visitas').textContent`);
    prova(`em ${lingua}`, escrito.startsWith(titulo + ' | ') && !/\{|undefined/.test(escrito), escrito);
}
await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await dormir(800);
const largura = await avaliar(`document.documentElement.scrollWidth`);
prova('no telemóvel, nada sai para o lado (nem com a caixa do número aberta)', largura <= 390, `${largura} px`);
await avaliar(`document.getElementById('grafico').blur(); document.getElementById('tabela').open = true; 1`);
await dormir(300);
const tabela = JSON.parse(await avaliar(`JSON.stringify((() => { const r = document.getElementById('tabela-rolo'); return { dentro: r.scrollWidth, caixa: r.clientWidth }; })())`));
prova('no telemóvel, a tabela dia a dia cabe sem andar para o lado', tabela.dentro <= tabela.caixa, `${tabela.dentro} em ${tabela.caixa} px`);
await foto('telemovel');

prova('sem erros na consola', erros.length === 0, erros.slice(0, 3).join(' | '));
const falhas = resultados.filter((r) => !r).length;
console.log(falhas ? `\n${falhas} provas falharam` : `\nTodas as ${resultados.length} provas passaram`);
process.exit(falhas ? 1 : 0);
