/**
 * Contagem de pontos: malhaviva.pt/?pontos
 *
 * Um painel que mostra, enquanto se anda pelo bairro, quantas elipsoides
 * (as "manchas" do Gaussian Splat) o modelo tem e quantas a placa gráfica
 * está a desenhar naquele momento. Serve para quem quiser confirmar com os
 * próprios olhos os números do projeto — um júri, por exemplo — sem
 * programas nem ficheiros: basta a ligação.
 *
 * Só nasce quando o endereço traz `?pontos`. Sem isso, este ficheiro nem é
 * pedido.
 *
 * O que mostra:
 *  - quantas elipsoides o modelo tem no pormenor máximo, e nas duas versões
 *    mais leves que o site usa ao longe (lido do próprio `lod-meta.json`
 *    que o site está a carregar, por isso muda com o modo gráfico);
 *  - quantas estão a ser desenhadas agora, e o máximo da visita;
 *  - o limite que o modo gráfico põe a esse número (no Médio são 1 200 000
 *    de cada vez; no Alto e no Máximo não há limite).
 *
 * E deixa fazer duas coisas: pintar cada elipsoide pela versão de onde vem
 * (pormenor máximo perto, versões leves longe), e tirar o limite do modo
 * gráfico para se ver o número subir.
 */

const FORMATO = { pt: 'pt-PT', kea: 'pt-PT', en: 'en-GB', es: 'es-ES' };

const diz = (chave) => (window.Idiomas ? window.Idiomas.t(chave) : chave);
const lingua = () => (window.Idiomas ? window.Idiomas.atual() : 'pt');
const numero = (n) => Math.round(n).toLocaleString(FORMATO[lingua()] || 'pt-PT');

function estilos() {
    if (document.getElementById('contagem-estilos')) return;
    const s = document.createElement('style');
    s.id = 'contagem-estilos';
    s.textContent = `
    #contagem-de-pontos {
        position: fixed; z-index: 60;
        left: max(16px, env(safe-area-inset-left, 0px));
        top: calc(env(safe-area-inset-top, 0px) + 96px);
        width: 300px; max-width: calc(100vw - 32px);
        background: rgba(18, 18, 28, 0.92); color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px;
        font-family: var(--font-main, 'Liberation Mono', monospace); font-size: 12px; line-height: 1.45;
        padding: 12px 14px 14px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(6px);
    }
    #contagem-de-pontos h2 { margin: 0 0 10px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; padding-right: 28px }
    #contagem-de-pontos .linha { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; padding: 5px 0; border-top: 1px solid rgba(255,255,255,.08) }
    #contagem-de-pontos .linha span { color: rgba(255,255,255,.7) }
    #contagem-de-pontos output, #contagem-de-pontos b { font-variant-numeric: tabular-nums; font-weight: 700; text-align: right }
    #contagem-de-pontos .grande output { font-size: 20px; color: #ffd400 }
    #contagem-de-pontos .barra { height: 4px; background: rgba(255,255,255,.12); border-radius: 2px; margin: 2px 0 6px; overflow: hidden }
    #contagem-de-pontos .barra i { display: block; height: 100%; width: 0; background: #ffd400; transition: width .25s }
    #contagem-de-pontos label { display: flex; gap: 8px; align-items: center; margin-top: 10px; cursor: pointer }
    #contagem-de-pontos input { accent-color: #ffd400; width: 16px; height: 16px; margin: 0 }
    #contagem-de-pontos p { margin: 10px 0 0; color: rgba(255,255,255,.65) }
    #contagem-de-pontos ul.cores { list-style: none; margin: 6px 0 0 24px; padding: 0; display: grid; gap: 2px }
    #contagem-de-pontos ul.cores li { display: flex; gap: 8px; align-items: center }
    #contagem-de-pontos ul.cores i { width: 10px; height: 10px; border-radius: 2px; flex: none }
    #contagem-de-pontos .fechar { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border: 0; border-radius: 6px;
        background: transparent; color: #fff; font: inherit; font-size: 16px; cursor: pointer }
    #contagem-de-pontos .fechar:hover { background: rgba(255,255,255,.1) }
    #contagem-de-pontos :focus-visible { outline: 2px solid #ffd400; outline-offset: 2px }
    @media (prefers-reduced-motion: reduce) { #contagem-de-pontos .barra i { transition: none } }
    `;
    document.head.appendChild(s);
}

function montar() {
    const p = document.createElement('section');
    p.id = 'contagem-de-pontos';
    p.setAttribute('data-i18n-aria', 'pontos.titulo');
    p.innerHTML = `
        <h2 data-i18n="pontos.titulo">Contagem de pontos</h2>
        <button type="button" class="fechar" data-i18n-aria="pontos.fechar" data-i18n-title="pontos.fechar">×</button>
        <div class="linha"><span data-i18n="pontos.modelo">No modelo, pormenor máximo</span><b data-v="modelo">—</b></div>
        <div class="linha"><span data-i18n="pontos.niveis">Versões leves, para longe</span><b data-v="niveis">—</b></div>
        <div class="linha grande"><span data-i18n="pontos.agora">Desenhados agora</span><output data-v="agora">—</output></div>
        <div class="barra" aria-hidden="true"><i data-v="barra"></i></div>
        <div class="linha"><span data-i18n="pontos.maximo">Máximo nesta visita</span><b data-v="maximo">—</b></div>
        <div class="linha"><span data-i18n="pontos.tecto">Limite do modo gráfico</span><b data-v="tecto">—</b></div>
        <label><input type="checkbox" id="contagem-cores"> <span data-i18n="pontos.cores">Colorir por versão</span></label>
        <ul class="cores" hidden>
            <li><i style="background:#f00"></i><span data-i18n="pontos.lod0">Pormenor máximo</span></li>
            <li><i style="background:#0f0"></i><span data-i18n="pontos.lod1">Versão leve</span></li>
            <li><i style="background:#00f"></i><span data-i18n="pontos.lod2">Versão mais leve</span></li>
        </ul>
        <label><input type="checkbox" id="contagem-tudo"> <span data-i18n="pontos.tudo">Desenhar todos, sem limite</span></label>
        <p data-i18n="pontos.ajuda">Aproxime-se de uma casa: o número sobe, porque o pormenor máximo carrega perto da câmara.</p>
    `;
    document.body.appendChild(p);
    if (window.Idiomas) window.Idiomas.aplicar(p);
    return p;
}

/**
 * Liga o painel ao motor.
 *
 * @param {import('playcanvas').AppBase} app - A aplicação do bairro.
 */
export async function ligarContagemDePontos(app) {
    if (document.getElementById('contagem-de-pontos')) return;
    estilos();
    const painel = montar();
    const v = (nome) => painel.querySelector(`[data-v="${nome}"]`);
    const params = app.scene && app.scene.gsplat;

    // O que o modelo tem: o mesmo ficheiro que o site está a usar.
    let total = 0;
    let counts = [];
    try {
        const src = document.getElementById('splat-scene').getAttribute('src');
        const meta = await (await fetch(src)).json();
        counts = Array.isArray(meta.counts) ? meta.counts : [meta.count];
        total = counts[0] || 0;
    } catch (e) { /* sem o ficheiro, fica o traço */ }

    let maximo = 0;
    let tectoOriginal = params ? params.splatBudget : 0;

    const escrever = () => {
        if (total) v('modelo').textContent = numero(total);
        if (counts.length > 1) v('niveis').textContent = counts.slice(1).map(numero).join(' · ');
        const agora = (app.stats && app.stats.frame && app.stats.frame.gsplats) || 0;
        if (agora > maximo) maximo = agora;
        v('agora').textContent = numero(agora);
        v('maximo').textContent = numero(maximo);
        v('barra').style.width = total ? Math.min(100, (agora / total) * 100).toFixed(1) + '%' : '0';
        const tecto = params ? params.splatBudget : 0;
        v('tecto').textContent = tecto ? numero(tecto) : diz('pontos.semTecto');
        // Tirar o limite só se oferece onde há limite (Médio e Baixo).
        tudo.closest('label').hidden = !tecto && !tudo.checked;
    };

    const cores = painel.querySelector('#contagem-cores');
    const legenda = painel.querySelector('ul.cores');
    cores.addEventListener('change', () => {
        if (params) params.colorizeLod = cores.checked;
        legenda.hidden = !cores.checked;
    });

    const tudo = painel.querySelector('#contagem-tudo');
    tudo.addEventListener('change', () => {
        if (!params) return;
        if (tudo.checked) { tectoOriginal = params.splatBudget; params.splatBudget = 0; }
        else params.splatBudget = tectoOriginal;
    });

    const relogio = setInterval(escrever, 250);
    escrever();

    const aoMudarALingua = () => { window.Idiomas.aplicar(painel); escrever(); };
    window.addEventListener('idiomamudou', aoMudarALingua);

    painel.querySelector('.fechar').addEventListener('click', () => {
        clearInterval(relogio);
        window.removeEventListener('idiomamudou', aoMudarALingua);
        if (params) {
            params.colorizeLod = false;
            if (tudo.checked) params.splatBudget = tectoOriginal;
        }
        painel.remove();
    });
}
