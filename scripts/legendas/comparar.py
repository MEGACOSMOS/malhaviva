"""Side-by-side view of all hypotheses, on the timeline of the large-v3+VAD
run (fw). Words of the other runs are placed by their midpoint; words that
fall outside every fw segment are shown as GAP lines (speech fw dropped)."""
import json
import os
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dados', 'out')
OUTRAS = ['wx', 'v2', 'tb', 'nv']


def palavras(dados):
    ps = []
    for s in dados['segments']:
        for w in s.get('words', []):
            if 'start' in w and 'end' in w and w['start'] is not None:
                ps.append(((w['start'] + w['end']) / 2, w['word'].strip(), w.get('p', w.get('score', 1))))
    return ps


def main(nome):
    base = json.load(open(os.path.join(OUT, nome + '.fw.json'), encoding='utf-8'))['segments']
    outras = {k: palavras(json.load(open(os.path.join(OUT, f'{nome}.{k}.json'), encoding='utf-8'))) for k in OUTRAS}
    janelas = [(s['start'], s['end']) for s in base]
    linhas = []

    def dentro(t):
        return any(a - 0.3 <= t <= b + 0.3 for a, b in janelas)

    # gaps: words of other runs outside all fw windows, grouped
    lacunas = {}
    for k, ps in outras.items():
        for t, w, p in ps:
            if not dentro(t):
                lacunas.setdefault(k, []).append((t, w))

    for i, s in enumerate(base):
        a, b = s['start'], s['end']
        fracas = [w['word'].strip() for w in s['words'] if w['p'] < 0.5]
        linhas.append(f"[{a:7.2f}-{b:7.2f}] FW: {s['text'].strip()}")
        if fracas:
            linhas.append(f"{'':17s}?? {' '.join(fracas)}")
        for k, ps in outras.items():
            txt = ' '.join(w for t, w, p in ps if a - 0.3 <= t <= b + 0.3)
            if txt.replace(',', '').replace('.', '').lower() != s['text'].strip().replace(',', '').replace('.', '').lower():
                linhas.append(f"{'':17s}{k}: {txt}")
        linhas.append('')
    for k, ws in lacunas.items():
        grupos = []
        for t, w in ws:
            if grupos and t - grupos[-1][-1][0] < 2:
                grupos[-1].append((t, w))
            else:
                grupos.append([(t, w)])
        for g in grupos:
            linhas.append(f"GAP {k} [{g[0][0]:7.2f}-{g[-1][0]:7.2f}]: {' '.join(w for t, w in g)}")
    texto = '\n'.join(linhas)
    with open(os.path.join(OUT, nome + '.comparar.txt'), 'w', encoding='utf-8') as f:
        f.write(texto)
    return texto


if __name__ == '__main__':
    for n in sys.argv[1:]:
        main(n)
