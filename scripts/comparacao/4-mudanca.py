# Zonas que mudaram entre o voo LiDAR (jul 2024) e o voo do drone (fev 2026):
# manchas com mais de 8 m² onde a superfície subiu ou desceu mais de 1 m.
import numpy as np, json
from scipy import ndimage
from caminhos import *
L = np.load(LAZ_BAIRRO); lx, ly, lz = L['x'], L['y'], L['z']
Mo = np.load('modelo.npz'); mE, mN, mz, op = Mo['E'], Mo['N'], Mo['z'], Mo['op']
sol = np.mean(json.load(open('vertical.json'))['solucoes'], 0)
E0, N0 = np.median(lx), np.median(ly)
k = op > 0.5
zc = sol[0] * mz[k] + sol[1] * (mE[k] - E0) + sol[2] * (mN[k] - N0) + sol[3]
cs = 0.5
x0, y0 = lx.min() - 5, ly.min() - 5
W = int((lx.max() + 5 - x0) / cs); H = int((ly.max() + 5 - y0) / cs)
def dsm(x, y, z, q=None):
    ix = ((x - x0) / cs).astype(int); iy = ((y - y0) / cs).astype(int)
    ok = (ix >= 0) & (ix < W) & (iy >= 0) & (iy < H)
    lin = iy[ok] * W + ix[ok]; zz = z[ok]
    o = np.argsort(zz); out = np.full(H * W, np.nan); out[lin[o]] = zz[o]
    return out.reshape(H, W)
DL = dsm(lx, ly, lz)
DM = dsm(mE[k], mN[k], zc)
# o modelo tem manchas soltas no ar: tirar com mediana 3x3
def med3(a):
    b = np.where(np.isfinite(a), a, -9999.)
    m = ndimage.median_filter(b, 3); m[m < -9000] = np.nan; return m
DLm, DMm = med3(DL), med3(DM)
d = DMm - DLm
mud = np.abs(d) > 1.0
mud = ndimage.binary_opening(mud, iterations=1)
lab, nl = ndimage.label(mud)
area = ndimage.sum(np.ones_like(d), lab, np.arange(1, nl + 1)) * cs * cs
grande = np.isin(lab, np.nonzero(area > 8)[0] + 1)
grande = ndimage.binary_dilation(grande, iterations=2)
subiu = grande & (d > 0); desceu = grande & (d < 0)
print('células mudadas (ha)', grande.sum() * cs * cs / 1e4, 'subiu', subiu.sum() * cs * cs / 1e4, 'desceu', desceu.sum() * cs * cs / 1e4)
np.savez('mudanca.npz', mud=grande, d=d, x0=x0, y0=y0, cs=cs, DL=DLm, DM=DMm)
