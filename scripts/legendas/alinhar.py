"""Force-align the corrected Portuguese transcripts (dados/pt/<nome>.txt,
lines "start-end|text") to the audio with wav2vec2 (WhisperX), then cut the
words into subtitle cues and write dados/cues/<nome>.json:
  [{"start": s, "end": e, "text": "..."}]   (text without line breaks)

Cue rules (common Portuguese/Netflix-style subtitling norms):
  - at most 2 lines x 42 characters (84 per cue)
  - at most 7 s per cue, at least ~1 s on screen
  - reading speed aimed at <= 17 characters per second
  - cut at sentence ends first, then commas/colons/pauses; never after an
    article, preposition or conjunction
"""
import json
import os
import re
import sys

import torch
_LIB = os.path.join(os.path.dirname(torch.__file__), 'lib')
os.add_dll_directory(_LIB)
os.environ['PATH'] = _LIB + os.pathsep + os.environ['PATH']

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from transcrever import PASTA, ler_audio  # noqa: E402

PT = os.path.join(PASTA, 'pt')
CUES = os.path.join(PASTA, 'cues')
os.makedirs(CUES, exist_ok=True)

MAX_LINHA = 42
MAX_CUE = 2 * MAX_LINHA
MAX_DUR = 8.0
MIN_DUR = 1.0
CPS = 17.0
FOLGA = 0.084          # minimum gap between cues (2 frames at 24 fps)
DEMORA = 0.3           # how long a cue lingers after the last word

# Words a line or a cue must not end on.
FRACAS = set('''a o as os um uma uns umas de do da dos das em no na nos nas num numa
por pelo pela pelos pelas para pra com sem e ou mas que se nem como quando porque
ao à aos às lhe me te nos vos o meu minha teu tua seu sua nosso nossa vosso vossa
este esta esse essa aquele aquela muito muita mais tão até sobre entre
neste nesta nestes nestas nesse nessa nesses nessas naquele naquela deste desta desse dessa daquele daquela
é são foi era está estão
algum alguma alguns algumas todo toda todos todas cada outro outra outros outras vários várias pouco pouca menos'''.split())


def ler(nome):
    segs = []
    for linha in open(os.path.join(PT, nome + '.txt'), encoding='utf-8'):
        linha = linha.strip()
        if not linha:
            continue
        tempos, texto = linha.split('|', 1)
        a, b = (float(x) for x in tempos.split('-'))
        segs.append({'start': a, 'end': b, 'text': texto.strip()})
    return segs


def norm(w):
    return re.sub(r'[^\wÀ-ÿ]', '', w).lower()


def janelas(nome, dur):
    """Windows for the aligner, one per sentence group, placed by matching the
    corrected words against the timed words of the ASR runs (not by the
    hand-written line times, which can cut a spoken phrase in two)."""
    import difflib
    texto = ' '.join(s['text'] for s in ler(nome))
    frases = [f for f in re.split(r'(?<=[.?!…»])\s+', texto) if f.strip()]
    meus = []
    for k, f in enumerate(frases):
        for w in f.split():
            meus.append((norm(w), k))
    ref = []
    for etq in ('fw', 'nv'):
        dados = json.load(open(os.path.join(PASTA, 'out', f'{nome}.{etq}.json'), encoding='utf-8'))
        ws = [(norm(w['word']), w['start'], w['end']) for s in dados['segments'] for w in s['words']]
        ref.append(ws)
    tempos = [None] * len(meus)
    for ws in ref:  # fw first; nv fills what fw missed
        sm = difflib.SequenceMatcher(a=[m[0] for m in meus], b=[w[0] for w in ws], autojunk=False)
        for bloco in sm.get_matching_blocks():
            for d in range(bloco.size):
                i = bloco.a + d
                if tempos[i] is None:
                    tempos[i] = (ws[bloco.b + d][1], ws[bloco.b + d][2])
    # per sentence: first/last matched time
    lim = []
    for k in range(len(frases)):
        ts = [tempos[i] for i, m in enumerate(meus) if m[1] == k and tempos[i]]
        lim.append((ts[0][0], ts[-1][1]) if ts else None)
    # sentences with no match get the gap between neighbours
    for k in range(len(lim)):
        if lim[k] is None:
            a = next((lim[j][1] for j in range(k - 1, -1, -1) if lim[j]), 0.0)
            b = next((lim[j][0] for j in range(k + 1, len(lim)) if lim[j]), dur)
            lim[k] = (a, b)
    # group sentences into windows of up to ~30 s, split at the widest gaps
    grupos = []
    for k, f in enumerate(frases):
        if grupos and lim[k][1] - grupos[-1]['start'] < 30:
            grupos[-1]['text'] += ' ' + f
            grupos[-1]['end'] = max(grupos[-1]['end'], lim[k][1])
        else:
            grupos.append({'start': lim[k][0], 'end': lim[k][1], 'text': f})
    for i, g in enumerate(grupos):
        antes = (grupos[i - 1]['end'] + g['start']) / 2 if i else 0.0
        depois = (g['end'] + grupos[i + 1]['start']) / 2 if i + 1 < len(grupos) else dur
        g['start'] = max(0.0, antes, g['start'] - 1.0) if i else max(0.0, g['start'] - 1.0)
        g['end'] = min(dur, depois, g['end'] + 1.0) if i + 1 < len(grupos) else min(dur, g['end'] + 1.0)
    return grupos


def alinhar(nome, modelo, meta, device):
    import whisperx
    audio = ler_audio(os.path.join(PASTA, nome + '_480p.mp4'))
    dur = len(audio) / 16000
    segs = janelas(nome, dur)
    r = whisperx.align(segs, modelo, meta, audio, device, return_char_alignments=False)
    palavras = []
    for s in r['segments']:
        ws = s.get('words', [])
        for w in ws:
            palavras.append({'w': w['word'], 's': w.get('start'), 'e': w.get('end'), 'seg': s['start']})
    # Words wav2vec2 cannot time (digits, acronyms) get times by interpolation.
    for i, p in enumerate(palavras):
        if p['s'] is None:
            ant = next((palavras[j] for j in range(i - 1, -1, -1) if palavras[j]['s'] is not None), None)
            seg = next((palavras[j] for j in range(i + 1, len(palavras)) if palavras[j]['s'] is not None), None)
            a = ant['e'] if ant else (seg['s'] - 0.4 if seg else 0)
            b = seg['s'] if seg else a + 0.4
            p['s'], p['e'] = a, max(a + 0.05, b)
    aparar(palavras, audio)
    return palavras, dur


def aparar(palavras, audio):
    """wav2vec2 tends to hand the silence after a sentence (or a filler
    left out of the text) to the nearest word. A word much longer than its
    letters need is trimmed to where the voice actually is, by energy."""
    import numpy as np
    passo = 160  # 10 ms
    n = len(audio) // passo
    energia = np.sqrt((audio[:n * passo].reshape(n, passo) ** 2).mean(axis=1) + 1e-12)
    fala = np.percentile(energia, 90)
    limiar = max(np.percentile(energia, 20) * 2.0, fala * 0.08)
    for w in palavras:
        letras = len(re.sub(r'[^\wÀ-ÿ]', '', w['w'])) or 1
        teto = 0.11 * letras + 0.35
        if w['e'] - w['s'] <= teto:
            continue
        a, b = int(w['s'] * 100), int(w['e'] * 100)
        voz = np.where(energia[a:b] > limiar)[0]
        if len(voz) == 0:
            continue
        # the word is the first voiced stretch (gaps < 150 ms joined): what
        # comes after it is the silence or noise the aligner swallowed
        trechos, ini, ant = [], voz[0], voz[0]
        for v in voz[1:]:
            if v - ant > 15:
                trechos.append((ini, ant))
                ini = v
            ant = v
        trechos.append((ini, ant))
        bons = [t for t in trechos if t[1] - t[0] >= 12] or trechos
        ini, fim = bons[0]
        novo_s = (a + ini) / 100
        novo_e = (a + fim + 1) / 100 + 0.05
        if novo_e - novo_s >= 0.15:
            w['s'], w['e'] = max(w['s'], novo_s - 0.03), min(w['e'], max(novo_e, novo_s + 0.15))


def fim_de_frase(w):
    return bool(re.search(r'[.?!…»]["»)]*$', w)) and not w.endswith('...') or w.endswith('?') or w.endswith('!')


def custo_corte(palavras, j):
    """Cost of ending a cue after word j (lower is better)."""
    w = palavras[j]['w']
    limpa = re.sub(r'[^\wÀ-ÿ]', '', w).lower()
    pausa = palavras[j + 1]['s'] - palavras[j]['e'] if j + 1 < len(palavras) else 9
    if re.search(r'[.?!]["»]?$', w) and not w.endswith('...'):
        c = 0
    elif w.endswith('...') or w.endswith('…'):
        c = 1
    elif re.search(r'[,;:—]["»]?$', w):
        c = 3
    else:
        c = 12
    if pausa > 0.6:
        c -= 2
    elif pausa > 0.3:
        c -= 1
    if limpa in FRACAS and not re.search(r'[.?!,;:]$', w):
        c += 15
    return c


def cortar(palavras):
    n = len(palavras)
    INF = float('inf')
    melhor = [INF] * (n + 1)
    volta = [0] * (n + 1)
    melhor[0] = 0
    for j in range(1, n + 1):
        for i in range(j - 1, -1, -1):
            texto = ' '.join(p['w'] for p in palavras[i:j])
            if len(texto) > MAX_CUE:
                break
            dur = palavras[j - 1]['e'] - palavras[i]['s']
            if dur > MAX_DUR and j - i > 1:
                break
            # running a cue across a long silence is avoided, unless the
            # silence falls mid-phrase (the speaker searching for a word)
            longas = [k for k in range(i, j - 1) if palavras[k + 1]['s'] - palavras[k]['e'] > 1.5]
            if any(re.search(r'[.?!,;:…]["»]?$', palavras[k]['w']) for k in longas):
                continue
            c_pausa = 2 * len(longas)
            c = custo_corte(palavras, j - 1) if j < n else 0
            c += c_pausa
            # a cue that closes one sentence and then runs into the next
            # without finishing it reads badly
            meio = ' '.join(p['w'] for p in palavras[i:j - 1])
            if re.search(r'[.?!]["»]?(\s|$)', meio) and custo_corte(palavras, j - 1) > 1 and j < n:
                c += 6
            # prefer cues of comfortable length; short fragments cost
            if len(texto) < 20:
                c += 3
            vel = len(texto) / max(dur + DEMORA, 0.5)
            if vel > CPS:
                c += (vel - CPS) * 0.6
            c += 1.0  # each cue has a cost: avoid needless fragmentation
            if melhor[i] + c < melhor[j]:
                melhor[j] = melhor[i] + c
                volta[j] = i
    cortes = []
    j = n
    while j > 0:
        cortes.append((volta[j], j))
        j = volta[j]
    return cortes[::-1]


def cues_de(nome, palavras, dur):
    cues = []
    for i, j in cortar(palavras):
        cues.append({'start': palavras[i]['s'], 'end': palavras[j - 1]['e'],
                     'text': ' '.join(p['w'] for p in palavras[i:j])})
    # A cue too short to read merges with a neighbour when they fit together.
    k = 0
    while k < len(cues):
        c = cues[k]
        curta = (c['end'] - c['start']) < 0.9 or len(c['text']) / max(c['end'] - c['start'] + DEMORA, 0.3) > 20
        if curta:
            opcoes = []
            if k + 1 < len(cues):
                t = c['text'] + ' ' + cues[k + 1]['text']
                if len(t) <= MAX_CUE and cues[k + 1]['end'] - c['start'] <= MAX_DUR:
                    opcoes.append((len(t), k, k + 1))
            if k > 0:
                t = cues[k - 1]['text'] + ' ' + c['text']
                if len(t) <= MAX_CUE and c['end'] - cues[k - 1]['start'] <= MAX_DUR:
                    opcoes.append((len(t), k - 1, k))
            if opcoes:
                _, a1, b1 = min(opcoes)
                cues[a1] = {'start': cues[a1]['start'], 'end': cues[b1]['end'],
                            'text': cues[a1]['text'] + ' ' + cues[b1]['text']}
                del cues[b1]
                k = max(0, a1)
                continue
        k += 1
    # timing: lead-in, linger, minimum duration, gaps
    for k, c in enumerate(cues):
        c['start'] = max(0.0, c['start'] - 0.05)
    # A fast cue may start a little earlier, in the silence before it.
    for k, c in enumerate(cues):
        prev_fim = cues[k - 1]['end'] + DEMORA + FOLGA if k else 0.0
        precisa = len(c['text']) / CPS - (c['end'] + DEMORA - c['start'])
        if precisa > 0:
            c['start'] = max(prev_fim, c['start'] - min(precisa, 0.5))
    for k, c in enumerate(cues):
        prox = cues[k + 1]['start'] if k + 1 < len(cues) else dur
        alvo = max(c['end'] + DEMORA, c['start'] + MIN_DUR, c['start'] + len(c['text']) / CPS)
        c['end'] = min(alvo, prox - FOLGA, c['start'] + MAX_DUR)
        c['end'] = max(c['end'], min(c['start'] + 0.6, prox - FOLGA))
        c['start'] = round(c['start'], 3)
        c['end'] = round(c['end'], 3)
    return cues


def main():
    import whisperx
    device = 'cuda'
    modelo, meta = whisperx.load_align_model(language_code='pt', device=device)
    nomes = sys.argv[1:] or [f[:-4] for f in sorted(os.listdir(PT)) if f.endswith('.txt')]
    for nome in nomes:
        palavras, dur = alinhar(nome, modelo, meta, device)
        cues = cues_de(nome, palavras, dur)
        with open(os.path.join(CUES, nome + '.json'), 'w', encoding='utf-8') as f:
            json.dump(cues, f, ensure_ascii=False, indent=1)
        with open(os.path.join(CUES, nome + '.palavras.json'), 'w', encoding='utf-8') as f:
            json.dump(palavras, f, ensure_ascii=False)
        rapidas = sum(1 for c in cues if len(c['text']) / (c['end'] - c['start']) > 20)
        print(nome, len(palavras), 'palavras', len(cues), 'legendas', rapidas, 'rapidas', flush=True)


if __name__ == '__main__':
    main()
