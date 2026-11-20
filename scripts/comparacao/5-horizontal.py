# Exatidão horizontal: em quadrados de 32 m, quanto é preciso deslocar a superfície do modelo
# para coincidir com a do LiDAR (correlação de fase das arestas, com precisão abaixo do píxel).
import numpy as np, cv2, json
from scipy import ndimage
from caminhos import *
z = np.load('mudanca.npz'); DL, DM, mud, cs = z['DL'], z['DM'], z['mud'], float(z['cs'])
x0, y0 = float(z['x0']), float(z['y0'])
def arestas(D):
    a = np.where(np.isfinite(D), D, np.nan)
    m = np.isfinite(a); fill = ndimage.distance_transform_edt(~m, return_distances=False, return_indices=True)
    a = a[tuple(fill)]
    gx = ndimage.sobel(a, 1); gy = ndimage.sobel(a, 0)
    return np.hypot(gx, gy)
GL, GM = arestas(DL), arestas(DM)
valido = np.isfinite(DL) & np.isfinite(DM) & ~ndimage.binary_dilation(mud, iterations=2)
T = 64  # 32 m
win = cv2.createHanningWindow((T, T), cv2.CV_64F)
res = []
H, W = DL.shape
for i in range(0, H - T, T // 2):
    for j in range(0, W - T, T // 2):
        v = valido[i:i + T, j:j + T]
        if v.mean() < 0.6: continue
        a = np.clip(GL[i:i + T, j:j + T], 0, 20) * v; b = np.clip(GM[i:i + T, j:j + T], 0, 20) * v
        if a.std() < 1: continue
        (dx, dy), resp = cv2.phaseCorrelate(b.astype(np.float64), a.astype(np.float64), win)
        if resp < 0.15 or abs(dx) > 6 or abs(dy) > 6: continue
        res.append((x0 + (j + T / 2) * cs, y0 + (i + T / 2) * cs, dx * cs, dy * cs, resp))
r = np.array(res)
print('quadrados', len(r))
# convenção: (dx, dy) = quanto o modelo tem de andar para coincidir com o LiDAR (leste, norte)
dE = r[:, 2]; dN = r[:, 3]   # linhas crescem para norte porque y0 é o mínimo
def ic(f, n=2000):
    rng = np.random.default_rng(3); return np.percentile([f(rng.integers(0, len(r), len(r))) for _ in range(n)], [2.5, 97.5]).tolist()
out = dict(n=len(r), media_E=dE.mean(), media_N=dN.mean(), mediana_E=np.median(dE), mediana_N=np.median(dN),
           dp_E=dE.std(ddof=1), dp_N=dN.std(ddof=1),
           rmse_E=np.sqrt(np.mean(dE**2)), rmse_N=np.sqrt(np.mean(dN**2)),
           rmse_r=np.sqrt(np.mean(dE**2 + dN**2)), rmse_r_ic=ic(lambda k: np.sqrt(np.mean(dE[k]**2 + dN[k]**2))),
           desvio_medio=float(np.hypot(dE.mean(), dN.mean())),
           p95_r=np.percentile(np.hypot(dE, dN), 95), mediana_r=np.median(np.hypot(dE, dN)))
print({k: (np.round(v, 3) if not isinstance(v, list) else np.round(v, 3).tolist()) for k, v in out.items()})
json.dump(out, open('horizontal.json', 'w'), indent=1, default=float)
np.save('horizontal_quadrados.npy', r)
