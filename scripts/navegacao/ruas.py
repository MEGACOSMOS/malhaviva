# As ruas do bairro, desenhadas à mão sobre o ortofotomapa.
#
# As ruas por onde a navegação leva quem vem de fora são as que estão
# desenhadas no Illustrator, em "SIG/Traçado de Ruas/Malha Viva - Ruas.ai":
# linhas por cima da pré-visualização do ortofotomapa ("Ortofotomapa
# Penajóia 2026-02-15 - pré-visualização.jpg"), posta na prancheta tal e
# qual, um ponto do Illustrator por cada ponto da imagem. Aqui as linhas são
# lidas do ficheiro e passadas a longitude e latitude, com a mesma conta com
# que a pré-visualização foi feita (Imagens/Ortofotomapa/processo/extras.py):
# o ortofotomapa a um quarto (12,8 cm de Mercator por ponto), recortado ao
# que tem imagem com 60 pontos de folga, e 220 pontos de margem à volta.
#
#     python -P scripts/navegacao/ruas.py
#
# Grava scripts/navegacao/ruas-desenhadas.geojson (abre no QGIS), que é o
# que reconhecer.py lê. Volta a correr-se sempre que o desenho mudar.
import json, math, os, sys
import numpy as np
import fitz
import rasterio
from rasterio.enums import Resampling

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import AQUI, ORTOFOTO, RUAS_AI, geograficas

SAIDA = os.path.join(AQUI, "ruas-desenhadas.geojson")
# A pré-visualização (ver extras.py).
FATOR = 4
FOLGA = 60
MARGEM = 220
BAIXO = 520
# Cada curva do desenho passa a pontos de 10 em 10 cm, mais ou menos.
PASSO_PT = 1.0


def bezier(p0, p1, p2, p3):
    """Os pontos de uma curva de Bézier cúbica, um por cada PASSO_PT."""
    P = np.array([p0, p1, p2, p3], float)
    corda = np.hypot(*np.diff(P, axis=0).T).sum()
    t = np.linspace(0, 1, max(2, int(math.ceil(corda / PASSO_PT)) + 1))[:, None]
    return ((1 - t) ** 3) * P[0] + 3 * ((1 - t) ** 2) * t * P[1] + 3 * (1 - t) * t * t * P[2] + t ** 3 * P[3]


def main():
    doc = fitz.open(RUAS_AI)
    pagina = doc[0]
    imagens = pagina.get_image_info()
    if len(imagens) != 1 or [round(v) for v in imagens[0]["bbox"]] != [0, 0, round(pagina.rect.width), round(pagina.rect.height)]:
        sys.exit("A pré-visualização do ortofotomapa já não ocupa a prancheta inteira: a conta deixa de bater.")

    with rasterio.open(ORTOFOTO) as d:
        t = d.transform
        h, w = d.height // FATOR, d.width // FATOR
        m = d.read_masks(1, out_shape=(h, w), resampling=Resampling.nearest)
    ys, xs = np.nonzero(m)
    x0, y0 = max(0, xs.min() - FOLGA), max(0, ys.min() - FOLGA)
    x1, y1 = min(w, xs.max() + FOLGA), min(h, ys.max() + FOLGA)
    tamanho = (x1 - x0 + 2 * MARGEM, y1 - y0 + MARGEM + BAIXO)
    if tamanho != (round(pagina.rect.width), round(pagina.rect.height)):
        sys.exit("A prancheta (%d x %d) não tem o tamanho da pré-visualização (%d x %d): a conta deixa de bater." % (
            pagina.rect.width, pagina.rect.height, *tamanho))
    p = t.a * FATOR

    def geo(x, y):
        lon, lat = geograficas(t.c + (x - MARGEM + x0) * p, t.f - (y - MARGEM + y0) * p)
        return [round(lon, 7), round(lat, 7)]

    linhas = []
    for desenho in pagina.get_drawings():
        atual = []
        for item in desenho["items"]:
            if item[0] == "c":
                pts = bezier(*[(q.x, q.y) for q in item[1:5]])
            elif item[0] == "l":
                pts = np.array([(item[1].x, item[1].y), (item[2].x, item[2].y)])
            else:
                continue
            if atual and np.hypot(*(np.array(atual[-1]) - pts[0])) < 1e-3:
                atual.extend(pts[1:].tolist())
            else:
                if len(atual) > 1:
                    linhas.append(atual)
                atual = pts.tolist()
        if len(atual) > 1:
            linhas.append(atual)

    feicoes = [{"type": "Feature", "properties": {"id": i},
                "geometry": {"type": "LineString", "coordinates": [geo(x, y) for x, y in l]}}
               for i, l in enumerate(linhas)]
    with open(SAIDA, "w", encoding="utf8") as f:
        json.dump({"type": "FeatureCollection",
                   "fonte": "Desenhado à mão sobre o ortofotomapa (SIG/Traçado de Ruas/Malha Viva - Ruas.ai)",
                   "features": feicoes}, f, ensure_ascii=False, separators=(",", ":"))
    total = sum(np.hypot(*np.diff(np.array(l), axis=0).T).sum() for l in linhas) * p * 0.78
    print("%d ruas, cerca de %.0f m -> %s" % (len(linhas), total, SAIDA))


if __name__ == "__main__":
    main()
