# O que foi construído ou demolido entre jul 2024 (LiDAR) e fev 2026 (drone); cobertura e densidade.
import numpy as np, json
from scipy import ndimage
from matplotlib.path import Path
from caminhos import *
L = np.load(LAZ_BAIRRO); lx, ly, lz, lc = L['x'], L['y'], L['z'], L['c']
z = np.load('mudanca.npz'); DL, DM, d, cs = z['DL'], z['DM'], z['d'], float(z['cs']); x0, y0 = float(z['x0']), float(z['y0'])
H, W = DL.shape
masc = np.load('mascara3763.npy')
gx, gy = np.meshgrid(x0 + cs * (np.arange(W) + .5), y0 + cs * (np.arange(H) + .5))
dentro = Path(masc).contains_points(np.stack([gx.ravel(), gy.ravel()], 1)).reshape(H, W)
def grelha(sel, f):
    ix = ((lx[sel] - x0) / cs).astype(int); iy = ((ly[sel] - y0) / cs).astype(int)
    a = np.zeros((H, W), bool); a[iy, ix] = True; return a
chao = grelha(lc == 2, None); predio = grelha(lc == 6, None); arv = grelha(np.isin(lc, [4, 5]), None)
predio = ndimage.binary_closing(predio, iterations=1)
nov = (d > 2.0) & ~predio & ~ndimage.binary_dilation(arv, iterations=2) & dentro
nov = ndimage.binary_opening(nov, iterations=2)
lab, n = ndimage.label(nov); ar = ndimage.sum(np.ones_like(d), lab, np.arange(1, n + 1)) * cs * cs
grandes = np.nonzero(ar >= 10)[0] + 1
novo = np.isin(lab, grandes)
dem = (d < -2.0) & predio & dentro
dem = ndimage.binary_opening(dem, iterations=2)
lab2, n2 = ndimage.label(dem); ar2 = ndimage.sum(np.ones_like(d), lab2, np.arange(1, n2 + 1)) * cs * cs
grandes2 = np.nonzero(ar2 >= 10)[0] + 1
demol = np.isin(lab2, grandes2)
area_predio_2024 = (predio & dentro).sum() * cs * cs
out = dict(construido_m2=float(novo.sum() * cs * cs), construido_manchas=int(len(grandes)),
           demolido_m2=float(demol.sum() * cs * cs), demolido_manchas=int(len(grandes2)),
           area_predios_2024_m2=float(area_predio_2024), area_bairro_m2=float(dentro.sum() * cs * cs),
           cobertura_lidar=float(np.isfinite(DL)[dentro].mean()), cobertura_modelo=float(np.isfinite(DM)[dentro].mean()))
print(out)
json.dump(out, open('atualidade.json', 'w'), indent=1)
np.savez('atualidade.npz', novo=novo, demol=demol, predio=predio & dentro, dentro=dentro)
