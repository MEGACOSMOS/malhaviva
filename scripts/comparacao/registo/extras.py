# Pré-visualização (JPG com escala e norte), contorno da área (GeoJSON) e cópia do processo.
import os, sys, json, math, shutil, numpy as np
import rasterio
from rasterio.enums import Resampling
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS = None

AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA = sys.argv[1]
TIF = os.path.join(PASTA, sys.argv[2] + ".tif")
FONTE = os.path.join(AQUI, "..", "..", "..", "public", "fonts", "LiberationMono-Regular.ttf")
FONTE_B = FONTE.replace("Regular", "Bold")
R = 6378137.0
FATOR = 4

with rasterio.open(TIF) as d:
    h, w = d.height // FATOR, d.width // FATOR
    rgb = d.read(out_shape=(3, h, w), resampling=Resampling.average)
    m = d.read_masks(1, out_shape=(h, w), resampling=Resampling.nearest)
    tr = d.transform
    lat = math.degrees(2 * math.atan(math.exp((tr.f - d.height * abs(tr.e) / 2) / R)) - math.pi / 2)
    cm = abs(tr.a) * math.cos(math.radians(lat)) * 100 * FATOR
rgb = np.moveaxis(rgb, 0, 2)
rgb[m == 0] = 255

# recortar ao que tem imagem, com folga
ys, xs = np.nonzero(m)
f = 60
y0, y1 = max(0, ys.min() - f), min(h, ys.max() + f)
x0, x1 = max(0, xs.min() - f), min(w, xs.max() + f)
mapa = Image.fromarray(rgb[y0:y1, x0:x1])
mw, mh = mapa.size

MARG = 220
BAIXO = 520
fol = Image.new("RGB", (mw + 2 * MARG, mh + MARG + BAIXO), (255, 255, 255))
fol.paste(mapa, (MARG, MARG))
dr = ImageDraw.Draw(fol)
tinta = (34, 34, 34)
fT = ImageFont.truetype(FONTE_B, 110)
fS = ImageFont.truetype(FONTE, 62)
fP = ImageFont.truetype(FONTE, 54)

yb = MARG + mh + 110
dr.text((MARG, yb), "Bairro de Penajóia · ortofotomapa", font=fT, fill=tinta)
dr.text((MARG, yb + 160), "Voo de drone de 15 de fevereiro de 2026 · %s cm por píxel no original · EPSG:3857" % ("%.1f" % (cm / FATOR)).replace(".", ","), font=fS, fill=tinta)
dr.text((MARG, yb + 250), "Malha Viva", font=fS, fill=(110, 110, 110))

# escala: 100 m
px100 = 100 / (cm / 100)
xs0 = fol.width - MARG - px100
ys0 = yb + 70
dr.rectangle((xs0, ys0, xs0 + px100 / 2, ys0 + 28), fill=tinta)
dr.rectangle((xs0 + px100 / 2, ys0, xs0 + px100, ys0 + 28), outline=tinta, width=6)
for i, t in enumerate(["0", "50", "100 m"]):
    tx = xs0 + i * px100 / 2
    bb = dr.textbbox((0, 0), t, font=fP)
    dr.text((tx - (bb[2] - bb[0]) / 2 if i < 2 else tx - (bb[2] - bb[0]) + 30, ys0 + 50), t, font=fP, fill=tinta)

# norte
cx, cy = fol.width - MARG - 90, MARG + 200
dr.polygon([(cx, cy - 150), (cx - 60, cy + 40), (cx, cy), (cx + 60, cy + 40)], fill=tinta)
bb = dr.textbbox((0, 0), "N", font=fT)
dr.text((cx - (bb[2] - bb[0]) / 2, cy + 50), "N", font=fT, fill=tinta)

saida = os.path.join(PASTA, sys.argv[2].replace("(2,5 cm)", "").strip() + " - pré-visualização.jpg")
fol.save(saida, quality=90, optimize=True, progressive=True)
print(saida, fol.size, "%.1f cm/px" % cm)

# contorno da área, em graus (WGS84), para o QGIS
msk = json.load(open(os.path.join(AQUI, "mascara.json")))
E, N = np.array(msk["E"]), np.array(msk["N"])
lon = np.degrees(E / R)
la = np.degrees(2 * np.arctan(np.exp(N / R)) - np.pi / 2)
anel = [[round(a, 7), round(b, 7)] for a, b in zip(lon, la)]
anel.append(anel[0])
gj = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {
    "nome": "Área do ortofotomapa", "voo": "2026-02-15", "resolucao_cm": round(cm / FATOR, 2)},
    "geometry": {"type": "Polygon", "coordinates": [anel]}}]}
json.dump(gj, open(os.path.join(PASTA, "Área do ortofotomapa.geojson"), "w", encoding="utf8"), ensure_ascii=False)

# processo (para refazer)
proc = os.path.join(PASTA, "processo")
os.makedirs(proc, exist_ok=True)
for f_ in ["preparar.py", "render.py", "registar.py", "mascara.py", "ortofoto.py", "extras.py", "registo.json", "mascara.json"]:
    shutil.copy2(os.path.join(AQUI, f_), proc)
print("ok")
