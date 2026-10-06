"""Write the WebVTT files: dados/cues/<nome>.json (pt timing + text) and
dados/tr/<nome>.txt ("i|en|es") -> <site>/public/legendas/<nome>/{pt,en,es}.vtt

Each cue is broken into at most two lines of at most 42 characters, at the
best place: after punctuation, never after an article/preposition, with the
lines as even as possible (the bottom one may be a little longer).
Prints every cue that breaks a rule, so it can be fixed by hand.
"""
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
CUES = os.path.join(AQUI, 'dados', 'cues')
TR = os.path.join(AQUI, 'dados', 'tr')
SITE = sys.argv[1]  # .../public/legendas

MAX_LINHA = 42
FRACAS = {
    'pt': set('''a o as os um uma uns umas de do da dos das em no na nos nas num numa por pelo pela pelos pelas
para com sem e ou mas que se nem como ao à aos às lhe me te o meu minha teu tua seu sua nosso nossa
este esta esse essa aquele aquela muito muita mais tão até sobre entre é são'''.split()),
    'en': set('''a an the of to in on at for with and or but that if as by from my your our their his her its
this these those is are was were be very more so not no'''.split()),
    'es': set('''el la los las un una unos unas de del al a en con por para y o pero que si como su sus mi mis tu tus
nuestro nuestra nuestros nuestras este esta ese esa lo le les se me te nos os muy más es son'''.split()),
}


# Words a second line reads well starting with: conjunctions, prepositions.
INICIOS = {
    'pt': set('para e que porque mas ou se quando como com sem de do da em no na por pelo pela onde nem até'.split()),
    'en': set('and but or because so that to for with without when if where who which of in on at by from'.split()),
    'es': set('y pero o porque que para con sin cuando como si de del en por donde ni hasta'.split()),
}


def quebrar(texto, lingua):
    if len(texto) <= MAX_LINHA:
        return [texto]
    palavras = texto.split(' ')
    melhor, escolha = None, None
    for k in range(1, len(palavras)):
        a = ' '.join(palavras[:k])
        b = ' '.join(palavras[k:])
        if len(a) > MAX_LINHA or len(b) > MAX_LINHA:
            continue
        ultima = palavras[k - 1]
        custo = abs(len(a) - len(b)) * 0.15
        if palavras[k].lower().strip('«"¿¡') in INICIOS[lingua]:
            custo -= 1.5
        if len(a) > len(b):
            custo += 1.0           # prefer a bottom-heavy pair
        if re.search(r'[.?!]["»]?$', ultima):
            custo -= 6
        elif re.search(r'[,;:—]["»]?$', ultima):
            custo -= 4
        if re.sub(r'[^\wÀ-ÿ\']', '', ultima).lower() in FRACAS[lingua] and not re.search(r'[.?!,;:]$', ultima):
            custo += 8
        if melhor is None or custo < melhor:
            melhor, escolha = custo, [a, b]
    return escolha or [texto]  # caller reports it


def tempo(s):
    h = int(s // 3600)
    m = int(s % 3600 // 60)
    return f'{h:02d}:{m:02d}:{s % 60:06.3f}'


def main():
    problemas = 0
    nomes = sorted(f[:-5] for f in os.listdir(CUES) if f.endswith('.json') and 'palavras' not in f)
    for nome in nomes:
        cues = json.load(open(os.path.join(CUES, nome + '.json'), encoding='utf-8'))
        textos = {'pt': [c['text'] for c in cues], 'en': [None] * len(cues), 'es': [None] * len(cues)}
        ajustes = json.load(open(os.path.join(AQUI, 'dados', 'ajustes_pt.json'), encoding='utf-8')).get(nome, {})
        for i, t in ajustes.items():
            textos['pt'][int(i)] = t
        for linha in open(os.path.join(TR, nome + '.txt'), encoding='utf-8'):
            linha = linha.rstrip('\n')
            if not linha.strip():
                continue
            i, en, es = linha.split('|')
            textos['en'][int(i)] = en.strip()
            textos['es'][int(i)] = es.strip()
        faltam = [i for i in range(len(cues)) if textos['en'][i] is None or textos['es'][i] is None]
        if faltam:
            print('FALTA TRADUÇÃO', nome, faltam)
            problemas += 1
            continue
        pasta = os.path.join(SITE, nome)
        os.makedirs(pasta, exist_ok=True)
        for lingua in ('pt', 'en', 'es'):
            saida = ['WEBVTT', '']
            for i, c in enumerate(cues):
                t = textos[lingua][i]
                linhas = quebrar(t, lingua)
                dur = c['end'] - c['start']
                vel = len(t) / dur
                if any(len(l) > MAX_LINHA for l in linhas) or len(linhas) > 2:
                    print(f'COMPRIDA {nome} {lingua} {i} ({len(t)}): {t}')
                    problemas += 1
                elif vel > 21 and lingua != 'pt':
                    print(f'RAPIDA   {nome} {lingua} {i} {vel:.1f} c/s {dur:.1f}s: {t}')
                saida.append(str(i + 1))
                saida.append(f"{tempo(c['start'])} --> {tempo(c['end'])}")
                saida.extend(linhas)
                saida.append('')
            with open(os.path.join(pasta, lingua + '.vtt'), 'w', encoding='utf-8', newline='\n') as f:
                f.write('\n'.join(saida))
    print('problemas:', problemas)


if __name__ == '__main__':
    main()
