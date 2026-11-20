# Área com reconstrução nítida: onde as manchas que se veem de cima são pequenas.
# Lê a vista georreferenciada de baixa resolução (geo_064*.npy) e grava a máscara
# como polígono em coordenadas EPSG:3857 (mascara.json), para aplicar a qualquer resolução.
import numpy as np, cv2, json, sys
LIM = float(sys.argv[1]) if len(sys.argv) > 1 else 0.45     # metros
RES = 0.64
x0, x1, y0, y1 = map(float, open('bounds_full.txt').read().split())
a = np.load('geo_064.npy'); sg = np.load('geo_064_sigma.npy').astype(np.float32)
al = a[..., 3] / 255.0
ls = np.where(al > 0.3, np.log(np.maximum(sg, 1e-3)), np.log(20.0)).astype(np.float32)
ls = cv2.GaussianBlur(ls, (0, 0), 8 / RES)           # ~8 m
m = (ls < np.log(LIM)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
m = (lab == k).astype(np.uint8)
# tapar buracos interiores
cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
m = np.zeros_like(m); cv2.drawContours(m, cs, -1, 1, -1)
# fechar reentrâncias (até ~30 m) só onde a reconstrução ainda é aceitável (< 1,5 m)
solta = (ls < np.log(1.5)).astype(np.uint8)
d = int(round(30 / RES)) | 1
fech = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (d, d)))
m = np.maximum(m, fech & solta)
# contorno liso
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
m = np.zeros_like(m); cv2.drawContours(m, [max(cs, key=cv2.contourArea)], -1, 1, -1)
cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
c = max(cs, key=cv2.contourArea)
c = cv2.approxPolyDP(c, 1.0, True)[:, 0, :].astype(np.float64)
E = x0 + (c[:, 0] + 0.5) * RES
N = y1 - (c[:, 1] + 0.5) * RES
area_merc = cv2.contourArea(c.astype(np.float32)) * RES * RES
lat = np.degrees(2 * np.arctan(np.exp(N.mean() / 6378137)) - np.pi / 2)
k_ = np.cos(np.radians(lat))
print('vertices', len(c), 'area %.1f ha (chão)' % (area_merc * k_ * k_ / 1e4), 'lat %.5f' % lat)
print('extensao E %.1f..%.1f N %.1f..%.1f' % (E.min(), E.max(), N.min(), N.max()))
json.dump(dict(E=E.tolist(), N=N.tolist(), lim=LIM), open('mascara.json', 'w'))
# pré-visualização
rgb = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2BGR)
cv2.polylines(rgb, [c.astype(np.int32).reshape(-1, 1, 2)], True, (0, 255, 255), 2)
cv2.imwrite('mascara_previa.jpg', rgb)
