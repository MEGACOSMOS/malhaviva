"""
A fotografia de satélite do lote F, para a navegação no bairro em 3D.

As casas F1 a F10 ficam fora da zona que o drone fotografou: no bairro
em 3D, onde elas estão, não há bairro. Quando alguém procura uma casa do
lote F, navegacao-3d.mjs pousa no chão, ali, esta fotografia — a World
Imagery da Esri (Vantor), a mesma do Mapa dos Bairros —, plana, à altura
das portas das casas F, e tira-a quando o percurso sai.

Lê as casas F de public/navegacao/rede.json, junta os mosaicos de
satélite à volta delas (com MARGEM_M de folga), esbate as beiras para a
fotografia se fundir com o bairro, e escreve:

    public/navegacao/lote-f.webp   a fotografia (com as beiras transparentes)
    public/navegacao/lote-f.json   onde ela fica, em graus, e a largura da
                                   beira esbatida, em metros

    python -P scripts/navegacao/lote-f.py
"""
import io
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
REDE = RAIZ / 'public' / 'navegacao' / 'rede.json'
SAIDA = RAIZ / 'public' / 'navegacao'

MOSAICO = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
# O mais perto que há fotografia nítida nesta zona (ver mapa-dos-bairros.mjs).
ZOOM = 19
# A folga à volta das casas, em metros, e a largura da beira que se esbate.
MARGEM_M = 32
BEIRA_M = 14
RAIO_DA_TERRA = 6378137


def para_mercator(lat, lon):
    x = RAIO_DA_TERRA * math.radians(lon)
    y = RAIO_DA_TERRA * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def para_graus(x, y):
    return math.degrees(2 * math.atan(math.exp(y / RAIO_DA_TERRA)) - math.pi / 2), math.degrees(x / RAIO_DA_TERRA)


def main():
    rede = json.loads(REDE.read_text(encoding='utf-8'))
    pontos = [p for c in rede['casas'] if c['n'].startswith('F') for p in (c['ponto'], c['porta'])]
    lats = [p[0] for p in pontos]
    lons = [p[1] for p in pontos]
    # A margem em metros no chão é maior em Mercator (1 / cos da latitude).
    escala = 1 / math.cos(math.radians(sum(lats) / len(lats)))
    x0, y0 = para_mercator(min(lats), min(lons))
    x1, y1 = para_mercator(max(lats), max(lons))
    m = MARGEM_M * escala
    x0, y0, x1, y1 = x0 - m, y0 - m, x1 + m, y1 + m

    # Os mosaicos que cobrem o rectângulo.
    lado = 2 * math.pi * RAIO_DA_TERRA
    n = 2 ** ZOOM
    px = lambda x: (x + lado / 2) / lado * n * 256
    py = lambda y: (lado / 2 - y) / lado * n * 256
    c0, c1 = int(px(x0) // 256), int(px(x1) // 256)
    l0, l1 = int(py(y1) // 256), int(py(y0) // 256)
    junto = Image.new('RGB', ((c1 - c0 + 1) * 256, (l1 - l0 + 1) * 256))
    for linha in range(l0, l1 + 1):
        for coluna in range(c0, c1 + 1):
            pedido = urllib.request.Request(MOSAICO.format(z=ZOOM, y=linha, x=coluna), headers={'User-Agent': 'Malha Viva'})
            with urllib.request.urlopen(pedido) as r:
                junto.paste(Image.open(io.BytesIO(r.read())).convert('RGB'), ((coluna - c0) * 256, (linha - l0) * 256))

    # Corta-se ao rectângulo, em pontos inteiros (e acerta-se o rectângulo
    # aos pontos cortados).
    a, b = round(px(x0)) - c0 * 256, round(py(y1)) - l0 * 256
    c, d = round(px(x1)) - c0 * 256, round(py(y0)) - l0 * 256
    foto = np.asarray(junto.crop((a, b, c, d)))
    por_ponto = lado / (n * 256)
    x0 = (a + c0 * 256) * por_ponto - lado / 2
    x1 = (c + c0 * 256) * por_ponto - lado / 2
    y1 = lado / 2 - (b + l0 * 256) * por_ponto
    y0 = lado / 2 - (d + l0 * 256) * por_ponto

    # As beiras esbatem-se, devagar no princípio e no fim.
    altura, largura = foto.shape[:2]
    beira = BEIRA_M * escala / por_ponto
    dx = np.minimum(np.arange(largura) + 0.5, largura - 0.5 - np.arange(largura)) / beira
    dy = np.minimum(np.arange(altura) + 0.5, altura - 0.5 - np.arange(altura)) / beira
    t = np.clip(np.minimum(dx[None, :], dy[:, None]), 0, 1)
    alfa = (t * t * (3 - 2 * t) * 255).round().astype(np.uint8)
    Image.fromarray(np.dstack([foto, alfa]), 'RGBA').save(SAIDA / 'lote-f.webp', quality=88, method=6)

    norte, oeste = para_graus(x0, y1)
    sul, este = para_graus(x1, y0)
    (SAIDA / 'lote-f.json').write_text(json.dumps({
        'imagem': '/navegacao/lote-f.webp',
        'norte': round(norte, 7), 'sul': round(sul, 7), 'oeste': round(oeste, 7), 'este': round(este, 7),
        'beira': BEIRA_M,
        'creditos': 'Esri · Vantor'
    }, indent=1) + '\n', encoding='utf-8')
    print(f'{largura}×{altura} pontos, {(x1 - x0) / escala:.0f} × {(y1 - y0) / escala:.0f} m')


if __name__ == '__main__':
    main()
