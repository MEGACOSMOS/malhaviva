"""Passo 1 — o contorno do bairro, tirado das manchas que o site mostra.

Lê o nível 0 do splat do site (public/splat/0_*), passa as manchas para a
cena, conta-as numa grelha de meio metro e tira o contorno de fora da zona
onde há manchas. Esse contorno é o "corte externo" que a malha vai ter.
Escreve contorno_enu.json (no referencial do MipMap) e contorno.png (para
ver) na pasta de trabalho.
"""
import json, glob, os
import numpy as np, cv2
from PIL import Image
from shapely.geometry import Polygon
from comum import PUBLICO, TRABALHO

pontos = []
for d in sorted(glob.glob(os.path.join(PUBLICO, "splat", "0_*"))):
    m = json.load(open(os.path.join(d, "meta.json")))
    lo = np.asarray(Image.open(os.path.join(d, "means_l.webp")).convert("RGB")).reshape(-1, 3).astype(np.uint32)
    up = np.asarray(Image.open(os.path.join(d, "means_u.webp")).convert("RGB")).reshape(-1, 3).astype(np.uint32)
    alfa = np.asarray(Image.open(os.path.join(d, "sh0.webp")).convert("RGBA")).reshape(-1, 4)[:, 3]
    n = m["count"]
    # SOG v2: 16 bits por eixo (alto | baixo), em escala logarítmica.
    q = ((up << 8) | lo)[:n].astype(np.float64) / 65535
    mn, mx = np.array(m["means"]["mins"]), np.array(m["means"]["maxs"])
    v = mn + (mx - mn) * q
    v = np.sign(v) * (np.exp(np.abs(v)) - 1)
    # A entidade do splat está rodada 180° em X: cena = (x, -y, -z).
    pontos.append(np.stack([v[:, 0], -v[:, 1], -v[:, 2], alfa[:n] / 255.0], 1).astype(np.float32))
p = np.concatenate(pontos)
print("manchas", len(p))

R = 0.5
x0, z0 = np.floor(p[:, 0].min()) - 10, np.floor(p[:, 2].min()) - 10
W = int((p[:, 0].max() - x0 + 10) / R); H = int((p[:, 2].max() - z0 + 10) / R)
ok = p[:, 3] > 0.3
c = np.zeros((H, W), np.int32)
np.add.at(c, (((p[ok, 2] - z0) / R).astype(int), ((p[ok, 0] - x0) / R).astype(int)), 1)

m = (c >= 2).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
_, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
m = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
cnt = max(cs, key=cv2.contourArea)[:, 0, :].astype(float)
X = x0 + (cnt[:, 0] + 0.5) * R; Z = z0 + (cnt[:, 1] + 0.5) * R
# cena (x, z) -> ENU (leste = x, norte = -z)
poly = Polygon(np.stack([X, -Z], 1)).buffer(0.25).simplify(0.3)
print("área %.0f m², %d vértices" % (poly.area, len(poly.exterior.coords)))
json.dump([list(q) for q in poly.exterior.coords], open(os.path.join(TRABALHO, "contorno_enu.json"), "w"))

vis = cv2.cvtColor((np.clip(np.log1p(c) / 6, 0, 1) * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
xy = np.stack([(np.array(poly.exterior.xy[0]) - x0) / R, (-np.array(poly.exterior.xy[1]) - z0) / R], 1).astype(np.int32)
cv2.polylines(vis, [xy], True, (0, 0, 255), 1)
cv2.imwrite(os.path.join(TRABALHO, "contorno.png"), vis)
