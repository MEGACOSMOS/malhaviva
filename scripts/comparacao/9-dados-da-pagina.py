# As imagens do "Lado a lado" da página malhaviva.pt/comparacao:
#   drone_foto.jpg   o ortofotomapa do drone a 25 cm, na grelha do MDS da DGT;
#   detalhe_N.jpg    o mesmo a 5 cm (8 cm no último), em quatro zonas;
#   dgt_relevo.jpg   o MDS oficial de 50 cm da DGT, sombreado com luz de noroeste;
#   meta.json        a grelha (EPSG:3763, 50 cm), o contorno da zona do drone
#                    e onde ficam os detalhes.
# Precisa de mascara3763.npy (de 2-modelo.py).
import numpy as np, json, os, rasterio
from rasterio.merge import merge
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin
from PIL import Image
from caminhos import *

os.makedirs(SAIDA_PAGINA, exist_ok=True)
masc = np.load('mascara3763.npy')
x0 = np.floor(masc[:, 0].min() / 0.5) * 0.5 - 5; x1 = np.ceil(masc[:, 0].max() / 0.5) * 0.5 + 5
y0 = np.floor(masc[:, 1].min() / 0.5) * 0.5 - 5; y1 = np.ceil(masc[:, 1].max() / 0.5) * 0.5 + 5

# o MDS oficial, recortado à volta do bairro
fontes = [rasterio.open(lidar_raster('MDS', n)) for n in QUADRICULAS]
a, tr = merge(fontes, bounds=(x0, y0, x1, y1)); MDS = a[0].astype(float)
MDS[(MDS < -100) | (MDS == fontes[0].nodata)] = np.nan
H, W = MDS.shape; cs = tr.a; gx0 = tr.c; gy1 = tr.f
print('grelha', W, 'x', H, 'células de', cs, 'm')

# relevo sombreado: luz de noroeste (azimute 315°) a 45° de altura
z = np.where(np.isfinite(MDS), MDS, np.nanmedian(MDS)); gy, gx = np.gradient(z, cs)
az, al = np.radians(315), np.radians(45); declive = np.arctan(np.hypot(gx, gy)); aspeto = np.arctan2(-gx, gy)
luz = np.clip(np.sin(al) * np.cos(declive) + np.cos(al) * np.sin(declive) * np.cos(az - aspeto), 0, 1)
Image.fromarray((40 + luz * 215).astype(np.uint8)).save(SAIDA_PAGINA + 'dgt_relevo.jpg', quality=82)

# o ortofotomapa do drone, passado de EPSG:3857 para a mesma grelha (média dos píxeis)
O = rasterio.open(ORTOFOTO)
def ortofoto(ox, oy, res, n_x, n_y):
    dst = np.zeros((3, n_y, n_x), np.uint8)
    for b in range(3):
        reproject(rasterio.band(O, b + 1), dst[b], dst_transform=from_origin(ox, oy, res, res),
                  dst_crs='EPSG:3763', resampling=Resampling.average)
    rgb = np.moveaxis(dst, 0, -1).copy(); rgb[rgb.sum(2) == 0] = [24, 24, 24]
    return Image.fromarray(rgb)
ortofoto(gx0, gy1, cs / 2, W * 2, H * 2).save(SAIDA_PAGINA + 'drone_foto.jpg', quality=80)

# os detalhes: (centro E, centro N, lado em m, píxel em m)
ZONAS = [(-91423.3, -110115.9, 80, 0.05), (-91403.3, -110158.9, 80, 0.05),
         (-91363.8, -110318.9, 80, 0.05), (-91300, -110250, 160, 0.08)]
detalhe = []
for k, (E, N, L, res) in enumerate(ZONAS):
    n = int(L / res); nome = f'detalhe_{k + 1}.jpg'
    ortofoto(E - L / 2, N + L / 2, res, n, n).save(SAIDA_PAGINA + nome, quality=82)
    detalhe.append(dict(f=nome, x0=E - L / 2, y1=N + L / 2, L=L))

json.dump(dict(W=W, H=H, x0=gx0, y1=gy1, cs=cs, masc=np.round(masc, 2).tolist(), detalhe=detalhe),
          open(SAIDA_PAGINA + 'meta.json', 'w'), separators=(',', ':'))
print('escrito em', SAIDA_PAGINA)
