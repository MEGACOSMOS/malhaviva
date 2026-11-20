# Prepara os dois conjuntos no mesmo referencial (EPSG:3763, metros)
import numpy as np, json
from rasterio.warp import transform
from matplotlib.path import Path
from caminhos import *
P = MODELO_PLY
cab = open(P, 'rb').read(8000)
off = cab.find(b'end_header\n') + len(b'end_header\n')
linhas = cab[:off].split(b'\n')
n = int([l for l in linhas if l.startswith(b'element vertex')][0].split()[-1])
nprop = sum(1 for l in linhas if l.startswith(b'property'))
# colunas: x y z (0:3), rot_0..3 (3:7), scale_0..2 em log (7:10), opacity em logit (10), f_dc_0..2 (11:14)
a = np.memmap(P, dtype='<f4', mode='r', offset=off, shape=(n, nprop))
reg = json.load(open(REGISTO))
m = json.load(open(MASCARA))
s = reg['s']; R = np.array(reg['R']); t = np.array(reg['t'])
M = np.stack([m['E'], m['N']], 1)
XY = ((M - t) / s) @ R
poly = Path(XY)
x = np.array(a[:, 0]); y = np.array(a[:, 1])
dentro = poly.contains_points(np.stack([x, y], 1))
idx = np.nonzero(dentro)[0]
b = np.array(a[idx])
sc = np.exp(b[:, 7:10]); op = 1 / (1 + np.exp(-b[:, 10]))
print('splats no bairro', len(idx))
# normal = eixo da escala mais pequena (quaternião rot_0..3 = w,x,y,z)
q = b[:, 3:7]; q = q / np.linalg.norm(q, axis=1, keepdims=True)
w, qx, qy, qz = q.T
Rm = np.stack([
    np.stack([1-2*(qy*qy+qz*qz), 2*(qx*qy-qz*w), 2*(qx*qz+qy*w)], 1),
    np.stack([2*(qx*qy+qz*w), 1-2*(qx*qx+qz*qz), 2*(qy*qz-qx*w)], 1),
    np.stack([2*(qx*qz-qy*w), 2*(qy*qz+qx*w), 1-2*(qx*qx+qy*qy)], 1)], 1)  # linhas
k = np.argmin(sc, 1)
nrm = Rm[np.arange(len(k)), :, k]
# para EPSG:3763
Mx = (s * (R @ b[:, :2].T)).T + t
lon, lat = transform('EPSG:3857', 'EPSG:4326', Mx[:, 0], Mx[:, 1])
E, N = transform('EPSG:4326', 'EPSG:3763', lon, lat)
E = np.array(E); N = np.array(N)
# rotação local ENU -> 3763 (pequena): estimar pelo eixo x
lon2, lat2 = transform('EPSG:3857', 'EPSG:4326', [Mx[0, 0], Mx[0, 0] + s * R[0, 0]], [Mx[0, 1], Mx[0, 1] + s * R[1, 0]])
E2, N2 = transform('EPSG:4326', 'EPSG:3763', lon2, lat2)
print('passo de 1 m em X ->', np.diff(E2), np.diff(N2))
np.savez(r'modelo.npz', E=E, N=N, z=b[:, 2], X=b[:, 0], Y=b[:, 1], smax=sc.max(1), smin=sc.min(1), op=op,
         nz=nrm[:, 2], cor=b[:, 11:14])
ME, MN = transform('EPSG:4326', 'EPSG:3763', *transform('EPSG:3857', 'EPSG:4326', m['E'], m['N']))
xx = np.array(ME); yy = np.array(MN)
area = 0.5 * abs(np.dot(xx, np.roll(yy, 1)) - np.dot(yy, np.roll(xx, 1)))
np.save('mascara3763.npy', np.stack([xx, yy], 1))
print('área m2', area, 'splats/m2', len(idx) / area, 'confiantes', ((op > 0.5) & (sc.max(1) < 0.25)).sum() / area)
