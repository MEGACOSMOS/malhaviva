"""Hand fixes after the first VTT check: Portuguese cue texts that do not fit
two lines of 42 (kept in dados/ajustes_pt.json, applied by gerar_vtt.py
so the timing stays put) and shorter translations where the first ones were
too long or too fast to read."""
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
TR = os.path.join(AQUI, 'dados', 'tr')

PT = {
    'Carlos': {
        16: 'Queremos pedir melhores condições, e estamos prontos para colaborar.',
        34: 'Mas, infelizmente, quem pensa nisso não consegue ter aquela tranquilidade,',
        46: 'Às vezes, a pessoa até adoece da cabeça, por causa desta situação.',
    },
    'Edmilson': {
        23: 'fazer a estrada como deve ser, porque está cheia de lama por cima.',
        46: 'Não arranjam solução. O que queremos... Se nos permitem... O que querem?',
    },
    'Edson': {32: 'Não podemos viver num sítio encurralado. Parece que somos presos ou animais.'},
    'Esvarena - 360 - B': {
        31: 'pessoas sem nada para fazer, que largaram os países para vir.',
        34: 'quando pediram visto de trabalho, visto de estudante, visto para a bolsa,',
    },
    'Frei': {3: 'sem cuidado com o que se comunica e diz, tende a passar a imagem'},
    'Sofia': {12: 'Deitar e não dormir, porque não sei que dia é que vêm mandar abaixo.'},
}

# (nome, índice, língua) -> texto
TRAD = {
    ('Carlos', 0, 'en'): 'Today, as I see it today, my wish is to stay there in the neighbourhood,',
    ('Carlos', 1, 'en'): 'for basic conditions so we can stay there,',
    ('Carlos', 1, 'es'): 'que haya condiciones mínimas para quedarnos ahí,',
    ('Carlos', 3, 'en'): 'Because some think we came to build',
    ('Carlos', 5, 'en'): "Or it's some who don't know us, or don't live among us.",
    ('Carlos', 5, 'es'): 'O son algunos que no nos conocen ni conviven con nosotros.',
    ('Carlos', 13, 'en'): "Sometimes there isn't a drop of water from the tap, and if you try later,",
    ('Carlos', 16, 'en'): "We want to ask for better conditions, and we're ready to cooperate.",
    ('Carlos', 16, 'es'): 'Queremos pedir mejores condiciones, y estamos dispuestos a colaborar.',
    ('Carlos', 23, 'en'): 'Apartment blocks use better foundations than ours,',
    ('Carlos', 23, 'es'): 'Los edificios usan cimientos mejores que los nuestros,',
    ('Carlos', 25, 'en'): "We build one level, for a metal roof, which isn't that heavy.",
    ('Carlos', 25, 'es'): 'Solo hacemos una planta, para poner chapa, que no pesa tanto.',
    ('Carlos', 27, 'en'): 'Instead of bricks or blocks on top, a metal roof goes straight on.',
    ('Carlos', 28, 'es'): 'Porque eso es lo que nos permite ir mucho más allá.',
    ('Carlos', 29, 'en'): "We're given time under pressure, in fear.",
    ('Carlos', 29, 'es'): 'Nos dan el tiempo con presión, con miedo.',
    ('Carlos', 34, 'en'): "But sadly, if you're worrying about that, you can't have that peace of mind,",
    ('Carlos', 38, 'en'): "You stay put, they come, knock it down, and you're left with the debt,",
    ('Carlos', 39, 'en'): "and still no house. It's a lot. People there are ill because of it.",
    ('Carlos', 41, 'en'): 'smashes the roof, smashes the door, and leaves.',
    ('Carlos', 46, 'en'): 'Sometimes people even get ill in the head, because of this situation.',
    ('Carlos', 46, 'es'): 'A veces, la persona hasta enferma de la cabeza, por esta situación.',
    ('Edmilson', 0, 'es'): 'No permitimos a nuestros amigos, ni a la gente que viene aquí a construir,',
    ('Edmilson', 3, 'en'): "It's left without conditions. And if a fire breaks out,",
    ('Edmilson', 16, 'es'): 'con puerta y ventana bien pintaditas, la casa pintadita, queda bien y luce.',
    ('Edmilson', 23, 'en'): "to make the road properly, because it's covered in mud.",
    ('Edmilson', 23, 'es'): 'hacer la carretera como debe ser, porque está llena de barro.',
    ('Edmilson', 25, 'en'): 'Tomorrow the machine comes, another day it comes.',
    ('Edmilson', 26, 'en'): 'We live with that fear: "Do I invest, and then they tear it down?"',
    ('Edmilson', 32, 'en'): "That's why, I don't know if you can see: it's all starting to look like this,",
    ('Edmilson', 33, 'en'): "they're adding insulation, so it looks nice. That's how we want it.",
    ('Edmilson', 33, 'es'): 'están poniendo aislante, para que quede bonito. Así lo queremos.',
    ('Edmilson', 34, 'en'): 'We want a peaceful neighbourhood. We want police here in the neighbourhood.',
    ('Edmilson', 46, 'en'): "They don't find a solution. All we want... If they let us... What do they want?",
    ('Edmilson', 46, 'es'): 'No encuentran solución. Lo que queremos... Si nos dejan... ¿Qué quieren?',
    ('Edmilson', 61, 'en'): "They don't even cover the rent.",
    ('Edmilson', 64, 'en'): 'or your travel pass, or feed your child, or pay for their school.',
    ('Edmilson', 78, 'es'): 'Y ahora sube el alquiler,',
    ('Edmilson', 79, 'es'): 'sube la luz, sube el agua, el combustible, sube todo.',
    ('Edson', 0, 'es'): 'Lo que hace el IHRU en el barrio: la semana pasada,',
    ('Edson', 12, 'en'): "so there's no more building, or fencing in the neighbourhood itself.",
    ('Edson', 16, 'en'): 'There are many children, elderly people, people with health problems,',
    ('Edson', 23, 'en'): "That can't happen, because to fence us in, decent people",
    ('Edson', 32, 'en'): "We can't live cornered like this. It's like we're prisoners or animals.",
    ('Edson', 32, 'es'): 'No podemos vivir acorralados. Parece que somos presos o animales.',
    ('Esvarena - 360 - A', 2, 'en'): "vice-president of Penajóia's Residents' Association.",
    ('Esvarena - 360 - A', 2, 'es'): 'vicepresidenta de la Asociación de Vecinos de Penajóia.',
    ('Esvarena - 360 - A', 3, 'en'): 'Penajóia is land owned by the IHRU (state housing), where we built our homes.',
    ('Esvarena - 360 - A', 3, 'es'): 'Penajóia es un terreno del IHRU, donde construimos nuestras casas.',
    ('Esvarena - 360 - A', 7, 'en'): 'People often say we invaded, did this and that, but in fact,',
    ('Esvarena - 360 - A', 36, 'es'): 'Así no se puede.',
    ('Esvarena - 360 - B', 6, 'en'): 'These are people who left their countries with the promise',
    ('Esvarena - 360 - B', 18, 'en'): 'The Council says it\'s the IHRU, because the land belongs to the IHRU.',
    ('Esvarena - 360 - B', 19, 'en'): "We're stuck in this back-and-forth. Now they ask: how will we pay for water?",
    ('Esvarena - 360 - B', 31, 'en'): 'people with nothing to do, who left their countries to come here.',
    ('Esvarena - 360 - B', 31, 'es'): 'gente sin nada que hacer, que dejó sus países para venir.',
    ('Esvarena - 360 - B', 43, 'en'): "We just want the IHRU and the Council to decide; it's both their problem.",
    ('Esvarena - 360 - B', 43, 'es'): 'Queremos que el IHRU y el Ayuntamiento se decidan, el problema es de ambos.',
    ('Esvarena - 360 - B', 44, 'en'): 'They must decide.',
    ('Esvarena - 360 - B', 44, 'es'): 'Deben decidirse.',
    ('Esvarena - 360 - C', 2, 'en'): 'We have an association: the Penajóia Neighbourhood Community Association,',
    ('Esvarena - 360 - C', 2, 'es'): 'Tenemos una asociación: la Asociación Comunitaria del Barrio Penajóia,',
    ('Esvarena - 360 - C', 5, 'es'): 'Es decir, un trabajo que el Ayuntamiento, el IHRU, debería haber hecho,',
    ('Esvarena - 360 - C', 6, 'en'): "we've already done, which is organising the streets...",
    ('Esvarena - 360 - C', 13, 'en'): "Because they're two completely different things:",
    ('Esvarena - 360 - C', 43, 'en'): "It's a lie when they say we don't want to pay for water or electricity.",
    ('Esvarena - 360 - C', 49, 'en'): 'illegal water and power hook-ups.',
    ('Frei', 0, 'es'): 'Como decía, la prensa, por el espacio que ocupa y su dimensión,',
    ('Frei', 3, 'en'): "careless about what's said, it tends to give the impression",
    ('Frei', 3, 'es'): 'sin cuidado con lo que se dice, tiende a dar la imagen',
    ('Luna', 12, 'es'): 'Trabajamos tantísimo para acabar en una chabola, en una casa hecha a mano.',
    ('Luna', 14, 'en'): "It's good because we built Portugal's buildings:",
    ('Luna', 14, 'es'): 'Es buena porque hicimos los edificios de Portugal:',
    ('Luna', 15, 'en'): 'the men from here build them.',
    ('Luna', 15, 'es'): 'los hacen los hombres de aquí.',
    ('Luna', 16, 'en'): 'Of course, for ourselves, we build a good house.',
    ('Luna', 16, 'es'): 'Claro, para nosotros hacemos una buena casa.',
    ('Luna', 25, 'en'): 'Work, tomorrow will be better."',
    ('Luna', 30, 'en'): 'You only do what you must.',
    ('Luna', 42, 'en'): "it's all beautiful.",
    ('Luna', 44, 'en'): 'Like, they give something horrible a beautiful name,',
    ('Luna', 47, 'en'): 'because they push people into poverty. From childhood, they put it in our heads.',
    ('Luna', 47, 'es'): 'porque nos meten en la pobreza. Desde niños nos la meten en la cabeza.',
    ('Sofia', 7, 'en'): 'Live on the street with family?',
    ('Sofia', 12, 'en'): "Lying awake, because I don't know what day they'll tear it down.",
}

with open(os.path.join(AQUI, 'dados', 'ajustes_pt.json'), 'w', encoding='utf-8') as f:
    json.dump(PT, f, ensure_ascii=False, indent=1)

porficheiro = {}
for (nome, i, lingua), texto in TRAD.items():
    porficheiro.setdefault(nome, []).append((i, lingua, texto))
for nome, lista in porficheiro.items():
    p = os.path.join(TR, nome + '.txt')
    linhas = open(p, encoding='utf-8').read().rstrip('\n').split('\n')
    mapa = {int(l.split('|')[0]): l.split('|') for l in linhas}
    for i, lingua, texto in lista:
        mapa[i][1 if lingua == 'en' else 2] = texto
    with open(p, 'w', encoding='utf-8') as f:
        f.write('\n'.join('|'.join(mapa[k]) for k in sorted(mapa)) + '\n')
print('ok', len(TRAD), 'traduções,', sum(len(v) for v in PT.values()), 'legendas pt')
