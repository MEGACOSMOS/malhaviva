# -*- coding: utf-8 -*-
"""
Passa o logótipo do Malha Viva de letras escritas a desenho, e guarda esse
desenho em `public/logotipo.js`, de onde o site o tira.

    python scripts/fazer-logotipo.py
    python scripts/fazer-logotipo.py "caminho/para/Malha Viva - Logo.svg"

O logótipo sai do Illustrator como texto: "MALHA" na fonte Malha Viva e
"VIVA" na Malha Viva 2, as duas feitas para o projecto e que não estão
instaladas no computador de quem visita o site. Escrito assim, o
navegador trocava-as por outra letra qualquer. Este programa lê o SVG,
compõe cada palavra com a sua fonte — com os mesmos acertos de espaço
entre letras que o Illustrator usa — e escreve o contorno de cada letra,
já no sítio, como um desenho só. O desenho fica cortado rente à tinta,
sem margens, para o site o poder alinhar pelo que se vê.

Volta a correr-se se o logótipo ou as fontes mudarem. As fontes são lidas
da pasta `Fonte` ao lado do logótipo.

Precisa de `pip install fonttools uharfbuzz`.
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

LOGOTIPO = Path(r"C:/Users/malve/Videos/Malha Viva/Imagens/Logos/Malha Viva/Malha Viva - Logo.svg")
DESTINO = Path(__file__).resolve().parent.parent / "public" / "logotipo.js"

# O nome de cada fonte, tal como o Illustrator o escreve, e o ficheiro dela.
FONTES = {
    "MalhaViva-Regular": "MalhaViva-Regular.ttf",
    "MalhaViva2-Regular": "MalhaViva2-Regular.ttf",
}

SVG = "{http://www.w3.org/2000/svg}"


def numero(v):
    """Um número com duas casas, sem zeros nem ponto a mais."""
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def estilos(raiz):
    """As classes do SVG, cada uma com as suas regras ("font-size", ...)."""
    texto = "".join(e.text or "" for e in raiz.iter(SVG + "style"))
    classes = {}
    for nome, corpo in re.findall(r"\.([\w-]+)\s*\{([^}]*)\}", texto):
        regras = dict(
            (k.strip(), v.strip())
            for k, v in (r.split(":", 1) for r in corpo.split(";") if ":" in r)
        )
        classes[nome] = regras
    return classes


def regra(classes, elementos, nome):
    """A regra mais de dentro que diga `nome`, das classes dos elementos."""
    for el in reversed(elementos):
        for c in (el.get("class") or "").split():
            if nome in classes.get(c, {}):
                return classes[c][nome]
    return None


def main():
    logotipo = Path(sys.argv[1]) if len(sys.argv) > 1 else LOGOTIPO
    pasta_fontes = logotipo.parent / "1" / "Fonte"
    raiz = ET.parse(logotipo).getroot()
    classes = estilos(raiz)

    # As letras, cada uma com o seu desenho e onde fica.
    letras = []
    for texto in raiz.iter(SVG + "text"):
        tx, ty = map(float, re.search(r"translate\(([-\d.]+)[ ,]+([-\d.]+)\)", texto.get("transform")).groups())
        for parte in texto.iter(SVG + "tspan"):
            familia = regra(classes, [texto, parte], "font-family").split(",")[0].strip().strip("'\"")
            tamanho = float(regra(classes, [texto, parte], "font-size").replace("px", ""))
            caminho = pasta_fontes / FONTES[familia]
            fonte = TTFont(caminho)
            escala = tamanho / fonte["head"].unitsPerEm
            ordem = fonte.getGlyphOrder()
            desenhos = fonte.getGlyphSet()

            buf = hb.Buffer()
            buf.add_str(parte.text)
            buf.guess_segment_properties()
            hb.shape(hb.Font(hb.Face(hb.Blob.from_file_path(str(caminho)))), buf)

            x = 0
            for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
                origem = tx + float(parte.get("x", 0)) + (x + pos.x_offset) * escala
                base = ty + float(parte.get("y", 0)) - pos.y_offset * escala
                letras.append((desenhos[ordem[info.codepoint]], (escala, 0, 0, -escala, origem, base)))
                x += pos.x_advance

    # A caixa da tinta, para cortar rente.
    caixa = [float("inf"), float("inf"), float("-inf"), float("-inf")]
    for desenho, t in letras:
        bp = BoundsPen(None)
        desenho.draw(TransformPen(bp, t))
        if bp.bounds:
            caixa = [min(caixa[0], bp.bounds[0]), min(caixa[1], bp.bounds[1]),
                     max(caixa[2], bp.bounds[2]), max(caixa[3], bp.bounds[3])]

    partes = []
    for desenho, t in letras:
        pen = SVGPathPen(None, ntos=numero)
        desenho.draw(TransformPen(pen, (t[0], 0, 0, t[3], t[4] - caixa[0], t[5] - caixa[1])))
        partes.append(pen.getCommands())

    largura = numero(caixa[2] - caixa[0])
    altura = numero(caixa[3] - caixa[1])
    bloco = (
        "    // <desenho> (escrito por scripts/fazer-logotipo.py)\n"
        "    var LARGURA = %s;\n"
        "    var ALTURA = %s;\n"
        "    var DESENHO = '%s';\n"
        "    // </desenho>" % (largura, altura, "".join(partes))
    )
    js = DESTINO.read_text(encoding="utf-8")
    novo, trocas = re.subn(r"    // <desenho>.*?// </desenho>", lambda _: bloco, js, flags=re.S)
    if trocas != 1:
        sys.exit("Não encontrei o lugar do desenho em " + str(DESTINO))
    DESTINO.write_text(novo, encoding="utf-8", newline="\n")
    print("Logótipo com %s × %s, %d letras, guardado em %s" % (largura, altura, len(letras), DESTINO))


if __name__ == "__main__":
    main()
