# Máscara de edifícios: o que tem altura acima do chão e é liso (telhado),
# separado das árvores (altas mas rugosas). Junta os contornos do
# OpenStreetMap, que são mais limpos, aos edifícios que lá faltam.
import json
import numpy as np, cv2
from scipy import ndimage as ndi
from shapely.geometry import Polygon
from shapely.validation import make_valid

BASE = r"E:/Malha Viva - trabalho/edificios"
exec(open(BASE + "/osm_cena.py", encoding="utf8").read())
mds = np.roll(np.load(BASE + "/mds.npy"), -1, 0)
mdt = np.roll(np.load(BASE + "/mdt.npy"), -1, 0)
vis = np.load(BASE + "/visivel.npy")
n = mds.shape[0]; P = 0.5; E = 750.0
valido = np.isfinite(mds) & np.isfinite(mdt)
nd = np.where(valido, mds - mdt, 0).astype(np.float32)
h = np.where(valido, mds, np.nanmedian(mds)).astype(np.float32)

# Rugosidade: resíduo de um plano local (janela 5x5 = 2,5 m)
def caixa(a, k=5):
    return cv2.boxFilter(a, -1, (k, k), normalize=True, borderType=cv2.BORDER_REFLECT)
yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
# plano local por mínimos quadrados com coordenadas relativas: usa derivadas
gx = cv2.Sobel(h, cv2.CV_32F, 1, 0, ksize=3) / 8
gy = cv2.Sobel(h, cv2.CV_32F, 0, 1, ksize=3) / 8
# variação das inclinações = curvatura; telhados planos ou de duas águas têm pouca
var_g = (caixa(gx * gx) - caixa(gx) ** 2) + (caixa(gy * gy) - caixa(gy) ** 2)
rug = np.sqrt(np.maximum(var_g, 0))
np.save(BASE + "/rugosidade.npy", rug.astype(np.float32))

alto = nd > 2.2
liso = rug < 0.35
m = alto & liso & valido
m = ndi.binary_opening(m, structure=np.ones((3, 3)))
m = ndi.binary_closing(m, structure=np.ones((3, 3)))
m = ndi.binary_fill_holes(m)
lab, nl = ndi.label(m)
area = ndi.sum(np.ones_like(nd), lab, index=np.arange(1, nl + 1)) * P * P
# fração lisa e altura mediana por componente (árvores sobrevivem em manchas pequenas)
fr_liso = ndi.mean(liso.astype(np.float32), lab, index=np.arange(1, nl + 1))
manter = np.zeros(nl + 1, bool)
manter[1:] = (area >= 25)
m = manter[lab]
np.save(BASE + "/mascara_lidar.npy", m)

# OSM rasterizado
def px(x, z):
    return ((x + E) / P - 0.5, (z + E) / P - 0.5)
osm = np.zeros((n, n), np.uint8)
for e, pts in carregar_osm():
    if e.get("tags", {}).get("building") in ("roof", "carport"):
        continue
    q = np.array([px(x, z) for x, z in pts], np.float32)
    cv2.fillPoly(osm, [np.round(q * 4).astype(np.int32)], 1, lineType=cv2.LINE_8, shift=2)
np.save(BASE + "/mascara_osm.npy", osm.astype(bool))

k = 2
img = np.zeros((n // k, n // k, 3), np.uint8)
img[..., 1] = (m[::k, ::k] * 200).astype(np.uint8)
img[..., 2] = (osm[::k, ::k] * 200).astype(np.uint8)
arv = alto & ~liso & valido
img[..., 0] = (arv[::k, ::k] * 120).astype(np.uint8)
for nivel in (0.02, 0.5):
    cs, _ = cv2.findContours((vis[::k, ::k] > nivel).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(img, cs, -1, (255, 255, 255), 1)
cv2.imwrite(BASE + "/ver_mascara.jpg", img)
print("componentes lidar", int(manter.sum()), "células lidar", int(m.sum()), "osm", int(osm.sum()))
