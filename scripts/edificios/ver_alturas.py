# Vista de cima: altura acima do chão (DGT), contornos do OpenStreetMap,
# borda do bairro em manchas (onde começa e acaba o esbatimento) e cúpula.
import json, math
import numpy as np, cv2

BASE = r"E:/Malha Viva - trabalho/edificios"
exec(open(BASE + "/osm_cena.py", encoding="utf8").read())   # define carregar_osm()
mds = np.load(BASE + "/mds.npy"); mdt = np.load(BASE + "/mdt.npy"); vis = np.load(BASE + "/visivel.npy")
nd = mds - mdt
n = nd.shape[0]; P = 0.5; E = 750
k = 2  # reduzir para 1 m por píxel
img = np.clip(np.nan_to_num(nd[::k, ::k]) / 30 * 255, 0, 255).astype(np.uint8)
img = cv2.applyColorMap(img, cv2.COLORMAP_VIRIDIS)
img[np.isnan(nd[::k, ::k])] = (40, 0, 40)
def p(x, z):
    return (int((x + E) / (P * k)), int((z + E) / (P * k)))
cv2.circle(img, p(0, 0), int(428.8 / (P * k)), (255, 255, 255), 1)
for nivel, cor in ((0.02, (0, 0, 255)), (0.98, (0, 128, 255))):
    m = (vis[::k, ::k] > nivel).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(img, cs, -1, cor, 2)
for e, pts in carregar_osm():
    cv2.polylines(img, [np.array([p(x, z) for x, z in pts])], True, (255, 255, 255), 1)
for kk in range(-700, 701, 100):
    cv2.putText(img, str(kk), p(kk, -735), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    cv2.putText(img, str(kk), p(-745, kk), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
cv2.imwrite(BASE + "/ver_alturas.jpg", img)
