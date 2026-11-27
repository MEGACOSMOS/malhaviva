/**
 * O índice de um ficheiro de vídeo: onde está cada imagem-chave, no tempo e
 * nos bytes.
 *
 * Um ficheiro .mp4 guarda, numa caixa chamada `moov`, a lista de todas as
 * imagens do filme: quanto tempo dura cada uma, quantos bytes ocupa e em
 * que ponto do ficheiro está. Algumas dessas imagens são imagens-chave —
 * imagens inteiras, que se desenham sozinhas; as outras só guardam o que
 * mudou desde a anterior. Um filme só pode começar a ser mostrado numa
 * imagem-chave: para mostrar uma imagem do meio, o navegador tem de ir à
 * imagem-chave anterior e desenhar todas as que vêm a seguir até lá chegar.
 * Nos nossos vídeos há uma imagem-chave a cada 2 segundos nos mais novos, e
 * a cada 10 nos mais antigos — e são 10 segundos de imagem a descarregar e a
 * desenhar antes de a primeira se ver.
 *
 * É por isso que a troca de qualidade (ver `qualidade-video.mjs`) se faz
 * sempre numa imagem-chave da versão nova: lá, a versão nova arranca de
 * imediato, sem ter de ir buscar e desenhar nada para trás. E é também por
 * este índice que se sabe que bytes descarregar de antemão para a troca ser
 * instantânea, e quanto pesam os próximos segundos de cada versão.
 *
 * Os ficheiros mais antigos têm o `moov` no fim (a lista só foi escrita
 * depois do filme); os mais novos têm-no no princípio. Aqui lê-se onde quer
 * que esteja: primeiro os primeiros bytes, que dizem o que vem a seguir, e
 * depois só a caixa do índice.
 */

const LER_PRINCIPIO = 64 * 1024;

/**
 * Pede um pedaço de um ficheiro.
 *
 * @param {string} url - O endereço.
 * @param {number} inicio - O primeiro byte.
 * @param {number} fim - O último byte (incluído).
 * @param {AbortSignal} [sinal] - Para desistir a meio.
 * @returns {Promise<{dados: DataView, total: number}>} Os bytes, e o
 *   tamanho do ficheiro inteiro quando o servidor o diz.
 */
async function pedaco(url, inicio, fim, sinal) {
    const resposta = await fetch(url, { headers: { Range: `bytes=${inicio}-${fim}` }, signal: sinal });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados = new DataView(await resposta.arrayBuffer());
    return { dados, resposta };
}

/** Lê o tipo de quatro letras de uma caixa. */
function tipoEm(d, o) {
    return String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3));
}

/**
 * As caixas que estão dentro de um pedaço, uma a seguir à outra.
 *
 * @param {DataView} d - Os bytes.
 * @param {number} de - Onde começa a primeira.
 * @param {number} ate - Onde acaba a última.
 * @returns {{tipo: string, inicio: number, corpo: number, fim: number}[]}
 */
function caixas(d, de, ate) {
    const lista = [];
    let o = de;
    while (o + 8 <= ate) {
        let tamanho = d.getUint32(o);
        const tipo = tipoEm(d, o + 4);
        let corpo = o + 8;
        if (tamanho === 1) {
            tamanho = Number(d.getBigUint64(o + 8));
            corpo = o + 16;
        } else if (tamanho === 0) {
            tamanho = ate - o;
        }
        if (tamanho < 8) break;
        lista.push({ tipo, inicio: o, corpo, fim: o + tamanho });
        o += tamanho;
    }
    return lista;
}

function dentro(d, caixa, tipo) {
    return caixas(d, caixa.corpo, caixa.fim).find(c => c.tipo === tipo) || null;
}

function caminho(d, caixa, tipos) {
    let c = caixa;
    for (const t of tipos) {
        c = c && dentro(d, c, t);
        if (!c) return null;
    }
    return c;
}

/**
 * Lê a lista de imagens de uma pista (vídeo ou som).
 *
 * @returns {object|null} Tempos de apresentação (em segundos), posições e
 *   tamanhos em bytes de cada imagem, e as imagens-chave.
 */
function lerPista(d, trak) {
    const hdlr = caminho(d, trak, ['mdia', 'hdlr']);
    if (!hdlr) return null;
    const genero = tipoEm(d, hdlr.corpo + 8);
    const mdhd = caminho(d, trak, ['mdia', 'mdhd']);
    const versaoMdhd = d.getUint8(mdhd.corpo);
    const escala = versaoMdhd === 1 ? d.getUint32(mdhd.corpo + 20) : d.getUint32(mdhd.corpo + 12);

    // O desvio da lista de edição: o filme pode começar a contar um pouco
    // depois do princípio da pista (é o que o codificador faz para as
    // imagens que se desenham fora de ordem).
    let desvio = 0;
    const elst = caminho(d, trak, ['edts', 'elst']);
    if (elst) {
        const versaoElst = d.getUint8(elst.corpo);
        const n = d.getUint32(elst.corpo + 4);
        let o = elst.corpo + 8;
        for (let i = 0; i < n; i++) {
            const mediaTime = versaoElst === 1 ? Number(d.getBigInt64(o + 8)) : d.getInt32(o + 4);
            if (mediaTime >= 0) { desvio = mediaTime; break; }
            o += versaoElst === 1 ? 20 : 12;
        }
    }

    const stbl = caminho(d, trak, ['mdia', 'minf', 'stbl']);
    const buscar = t => dentro(d, stbl, t);

    // Quanto dura cada imagem.
    const stts = buscar('stts');
    const duracoes = [];
    {
        const n = d.getUint32(stts.corpo + 4);
        let o = stts.corpo + 8;
        for (let i = 0; i < n; i++) {
            const quantas = d.getUint32(o);
            const delta = d.getUint32(o + 4);
            for (let k = 0; k < quantas; k++) duracoes.push(delta);
            o += 8;
        }
    }
    const total = duracoes.length;

    // O atraso de apresentação de cada imagem (só existe com imagens fora
    // de ordem).
    const atrasos = new Int32Array(total);
    const ctts = buscar('ctts');
    if (ctts) {
        const versaoCtts = d.getUint8(ctts.corpo);
        const n = d.getUint32(ctts.corpo + 4);
        let o = ctts.corpo + 8;
        let i = 0;
        for (let e = 0; e < n && i < total; e++) {
            const quantas = d.getUint32(o);
            const atraso = versaoCtts === 1 ? d.getInt32(o + 4) : d.getUint32(o + 4);
            for (let k = 0; k < quantas && i < total; k++) atrasos[i++] = atraso;
            o += 8;
        }
    }

    // Os tamanhos.
    const stsz = buscar('stsz');
    const tamanhos = new Uint32Array(total);
    {
        const fixo = d.getUint32(stsz.corpo + 4);
        const n = d.getUint32(stsz.corpo + 8);
        for (let i = 0; i < Math.min(n, total); i++) {
            tamanhos[i] = fixo || d.getUint32(stsz.corpo + 12 + i * 4);
        }
    }

    // Onde começa cada pedaço do ficheiro, e quantas imagens leva cada um.
    const stco = buscar('stco');
    const co64 = buscar('co64');
    const inicios = [];
    if (stco) {
        const n = d.getUint32(stco.corpo + 4);
        for (let i = 0; i < n; i++) inicios.push(d.getUint32(stco.corpo + 8 + i * 4));
    } else if (co64) {
        const n = d.getUint32(co64.corpo + 4);
        for (let i = 0; i < n; i++) inicios.push(Number(d.getBigUint64(co64.corpo + 8 + i * 8)));
    }
    const stsc = buscar('stsc');
    const regras = [];
    {
        const n = d.getUint32(stsc.corpo + 4);
        for (let i = 0; i < n; i++) {
            const o = stsc.corpo + 8 + i * 12;
            regras.push({ primeiro: d.getUint32(o), porPedaco: d.getUint32(o + 4) });
        }
    }
    const posicoes = new Float64Array(total);
    {
        let amostra = 0;
        for (let r = 0; r < regras.length; r++) {
            const ultimoPedaco = r + 1 < regras.length ? regras[r + 1].primeiro - 1 : inicios.length;
            for (let p = regras[r].primeiro; p <= ultimoPedaco && amostra < total; p++) {
                let o = inicios[p - 1];
                for (let k = 0; k < regras[r].porPedaco && amostra < total; k++) {
                    posicoes[amostra] = o;
                    o += tamanhos[amostra];
                    amostra++;
                }
            }
        }
    }

    // O tempo de apresentação de cada imagem, já em segundos do filme, e o
    // tempo em que ela tem de estar descodificada (que vai sempre a subir,
    // como a posição no ficheiro).
    const tempos = new Float64Array(total);
    const descodificacao = new Float64Array(total);
    {
        let dts = 0;
        for (let i = 0; i < total; i++) {
            tempos[i] = (dts + atrasos[i] - desvio) / escala;
            descodificacao[i] = (dts - desvio) / escala;
            dts += duracoes[i];
        }
    }

    // As imagens-chave. Sem a lista, todas o são (é o caso do som).
    const stss = buscar('stss');
    let chaves;
    if (stss) {
        const n = d.getUint32(stss.corpo + 4);
        chaves = new Uint32Array(n);
        for (let i = 0; i < n; i++) chaves[i] = d.getUint32(stss.corpo + 8 + i * 4) - 1;
    } else {
        chaves = null;
    }

    return { genero, escala, tempos, descodificacao, posicoes, tamanhos, chaves };
}

/** A última imagem de uma pista que cabe inteira até um byte (-1 se nenhuma). */
function ultimaAte(p, byte) {
    let baixo = 0;
    let alto = p.posicoes.length - 1;
    let achada = -1;
    while (baixo <= alto) {
        const meio = (baixo + alto) >> 1;
        if (p.posicoes[meio] + p.tamanhos[meio] <= byte) { achada = meio; baixo = meio + 1; } else { alto = meio - 1; }
    }
    return achada;
}

/** A imagem de uma pista que se está a mostrar num momento. */
function imagemEm(p, t) {
    let baixo = 0;
    let alto = p.descodificacao.length - 1;
    let achada = 0;
    while (baixo <= alto) {
        const meio = (baixo + alto) >> 1;
        if (p.descodificacao[meio] <= t) { achada = meio; baixo = meio + 1; } else { alto = meio - 1; }
    }
    return achada;
}

/**
 * Vai buscar e lê o índice de um ficheiro de vídeo.
 *
 * @param {string} url - O endereço do ficheiro.
 * @param {AbortSignal} [sinal] - Para desistir a meio.
 * @returns {Promise<object>} O índice (ver {@link criarIndice}).
 */
export async function lerIndice(url, sinal) {
    // As caixas de cima, uma a seguir à outra: ftyp, free, e depois o
    // filme (mdat) e o índice (moov), por uma ordem ou pela outra. Do filme
    // só se lê o cabeçalho, que diz quanto tem, para se saltar por cima.
    let { dados } = await pedaco(url, 0, LER_PRINCIPIO - 1, sinal);
    let base = 0;
    let o = 0;
    for (let voltas = 0; voltas < 16; voltas++) {
        if (o + 16 > base + dados.byteLength) {
            ({ dados } = await pedaco(url, o, o + 15, sinal));
            base = o;
        }
        const aqui = o - base;
        let tamanho = dados.getUint32(aqui);
        const tipo = tipoEm(dados, aqui + 4);
        if (tamanho === 1) tamanho = Number(dados.getBigUint64(aqui + 8));
        if (tamanho < 8) break;
        if (tipo === 'moov') {
            const inteira = o + tamanho <= base + dados.byteLength
                ? new DataView(dados.buffer, dados.byteOffset + aqui, tamanho)
                : (await pedaco(url, o, o + tamanho - 1, sinal)).dados;
            return criarIndice(inteira, o, tamanho);
        }
        o += tamanho;
    }
    throw new Error('índice não encontrado');
}

/**
 * Lê a caixa do índice já descarregada.
 *
 * @param {DataView} d - Os bytes da caixa `moov`, a começar no princípio dela.
 * @param {number} inicioDoMoov - Onde a caixa começa no ficheiro.
 * @param {number} tamanhoDoMoov - Quantos bytes tem.
 * @returns {object} O índice.
 */
export function criarIndice(d, inicioDoMoov, tamanhoDoMoov) {
    const raiz = caixas(d, 0, d.byteLength).find(c => c.tipo === 'moov');
    const pistas = caixas(d, raiz.corpo, raiz.fim).filter(c => c.tipo === 'trak').map(t => lerPista(d, t)).filter(Boolean);
    const video = pistas.find(p => p.genero === 'vide');
    const som = pistas.find(p => p.genero === 'soun');
    if (!video) throw new Error('sem imagem');

    // As imagens-chave por ordem de tempo de apresentação.
    const chaves = Array.from(video.chaves || video.tempos.keys(), i => ({
        tempo: Math.max(0, video.tempos[i]),
        posicao: video.posicoes[i]
    })).sort((a, b) => a.tempo - b.tempo);

    const fimDoFilme = Math.max(...[video, som].filter(Boolean).map(p => {
        const ultimo = p.tempos.length - 1;
        return p.posicoes[ultimo] + p.tamanhos[ultimo];
    }));

    /**
     * O primeiro byte e o último que é preciso ler para ver de um momento a
     * outro, contando com a imagem e com o som.
     */
    const bytesEntre = (de, ate) => {
        let menor = Infinity;
        let maior = 0;
        for (const p of [video, som]) {
            if (!p) continue;
            for (let i = 0; i < p.tempos.length; i++) {
                const t = p.tempos[i];
                if (t >= de - 0.25 && t <= ate) {
                    if (p.posicoes[i] < menor) menor = p.posicoes[i];
                    const fim = p.posicoes[i] + p.tamanhos[i];
                    if (fim > maior) maior = fim;
                }
            }
        }
        return menor === Infinity ? null : { inicio: menor, fim: maior - 1 };
    };

    return {
        /** Os momentos (em segundos) em que há imagem-chave. */
        chaves: chaves.map(c => c.tempo),

        /** A primeira imagem-chave a partir de um momento. */
        chaveDepoisDe(t) {
            for (const c of chaves) if (c.tempo >= t) return c.tempo;
            return null;
        },

        /** A última imagem-chave até um momento. */
        chaveAntesDe(t) {
            let achada = 0;
            for (const c of chaves) {
                if (c.tempo > t) break;
                achada = c.tempo;
            }
            return achada;
        },

        bytesEntre,

        /** Quantos megabits por segundo pesam os segundos entre dois momentos. */
        mbpsEntre(de, ate) {
            const b = bytesEntre(de, ate);
            if (!b || ate <= de) return 0;
            return (b.fim - b.inicio + 1) * 8 / (ate - de) / 1e6;
        },

        /**
         * Até que momento do filme se pode ver, tendo descarregados os bytes
         * do ficheiro até `byte` (contando com a imagem e com o som).
         */
        tempoAteAoByte(byte) {
            let menor = Infinity;
            for (const p of [video, som]) {
                if (!p || !p.posicoes.length) continue;
                const k = ultimaAte(p, byte);
                const t = k < 0 ? 0
                    : (k + 1 < p.descodificacao.length ? p.descodificacao[k + 1] : p.tempos[k] + 0.04);
                if (t < menor) menor = t;
            }
            return menor === Infinity ? 0 : Math.max(0, menor);
        },

        /** Em que byte do ficheiro estão a imagem e o som de um momento. */
        byteNoTempo(t) {
            let menor = Infinity;
            for (const p of [video, som]) {
                if (!p || !p.posicoes.length) continue;
                const k = imagemEm(p, t);
                if (p.posicoes[k] < menor) menor = p.posicoes[k];
            }
            return menor === Infinity ? 0 : menor;
        },

        /** Onde está o próprio índice, que o navegador também vai ler. */
        moov: { inicio: inicioDoMoov, fim: inicioDoMoov + tamanhoDoMoov - 1 },
        fimDoFilme
    };
}
