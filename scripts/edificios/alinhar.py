# Procura o deslocamento horizontal (e o desvio de altura) que melhor
# encaixa a superfície da DGT na do drone.
import numpy as np, cv2

BASE = r"E:/Malha Viva - trabalho/edificios"
dsm = np.load(BASE + "/drone_dsm.npy"); mds = np.load(BASE + "/mds.npy"); mdt = np.load(BASE + "/mdt.npy")
n = dsm.shape[0]
# só a zona onde o drone é bom: perto do centro
P = 0.5; E = 750
c = (np.arange(n) + 0.5) * P - E
xx, zz = np.meshgrid(c, c)
zona = (np.hypot(xx, zz) < 300)

melhor = None
for di in range(-8, 9):
    for dj in range(-8, 9):
        m = np.roll(np.roll(mds, di, 0), dj, 1)
        v = zona & np.isfinite(dsm) & np.isfinite(m)
        d = dsm[v] - m[v]
        med = np.median(d)
        err = np.median(np.abs(d - med))
        if melhor is None or err < melhor[0]:
            melhor = (err, di, dj, med)
print("melhor: erro %.3f  desloc linhas(z) %d  colunas(x) %d  (x0.5 m)  desvio %.3f" % melhor)
err, di, dj, med = melhor
m = np.roll(np.roll(mds, di, 0), dj, 1)
v = zona & np.isfinite(dsm) & np.isfinite(m)
d = dsm - m - med
d[~v] = np.nan
img = np.clip((np.nan_to_num(d, nan=0) + 5) / 10 * 255, 0, 255).astype(np.uint8)
img = cv2.applyColorMap(img, cv2.COLORMAP_JET); img[~v] = 0
cv2.imwrite(BASE + "/dif_drone_dgt.jpg", cv2.resize(img[300:2700:2, 300:2700:2], None, fx=0.8, fy=0.8))
