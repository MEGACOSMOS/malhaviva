# Arestas dos telhados: nitidez (largura do degrau), posição (exatidão horizontal) e fachadas.
# Em cada aresta, os pontos de uma faixa de 1,5 m ao longo dela são postos em função da distância
# à aresta e ajusta-se um degrau suavizado z = chão + h·(1 − Φ((n − μ)/σ)).
import numpy as np, json, rasterio
from rasterio.merge import merge
from scipy import ndimage
from scipy.spatial import cKDTree
from scipy.optimize import least_squares
from scipy.special import ndtr
from caminhos import *
rng = np.random.default_rng(2)
L = np.load(LAZ_BAIRRO); lx, ly, lz, lc = L['x'], L['y'], L['z'], L['c']
keep = lc != 7; lx, ly, lz, lc = lx[keep], ly[keep], lz[keep], lc[keep]
Mo = np.load('modelo.npz'); op = Mo['op']; k = op > 0.5
mE, mN = Mo['E'][k], Mo['N'][k]
sol = np.mean(json.load(open('vertical.json'))['solucoes'], 0)
E0, N0 = np.median(L['x']), np.median(L['y'])
mz = sol[0] * Mo['z'][k] + sol[1] * (mE - E0) + sol[2] * (mN - N0) + sol[3]
# MDS oficial de 50 cm, como pontos nos centros dos píxeis
srcs = [rasterio.open(lidar_raster('MDS', n)) for n in QUADRICULAS]
arr, tr = merge(srcs); a = arr[0].astype(float); nod = srcs[0].nodata
rr, cc = np.nonzero(np.isfinite(a) & (a != nod) & (a > -100))
rx, ry = tr * (cc + 0.5, rr + 0.5); rz = a[rr, cc]
sel = (rx > lx.min()) & (rx < lx.max()) & (ry > ly.min()) & (ry < ly.max())
rx, ry, rz = np.asarray(rx)[sel], np.asarray(ry)[sel], rz[sel]
fontes = {'modelo': (mE, mN, mz), 'lidar': (lx, ly, lz), 'mds50': (rx, ry, rz)}
arv = {n_: cKDTree(np.stack([v[0], v[1]], 1)) for n_, v in fontes.items()}
# máscara de prédios do LiDAR (classe 6) numa grelha de 0,5 m
zm_ = np.load('mudanca.npz'); x0, y0, cs = float(zm_['x0']), float(zm_['y0']), float(zm_['cs']); mud = zm_['mud']
H, W = mud.shape
b = lc == 6
ix = ((lx[b] - x0) / cs).astype(int); iy = ((ly[b] - y0) / cs).astype(int)
pr = np.zeros((H, W), bool); pr[iy, ix] = True
pr = ndimage.binary_closing(pr, iterations=2); pr = ndimage.binary_fill_holes(pr)
pr = ndimage.binary_opening(pr, iterations=2)
borda = pr & ~ndimage.binary_erosion(pr)
sm = ndimage.gaussian_filter(pr.astype(float), 2.0)
gyy, gxx = np.gradient(sm)
# coerência da direção (aresta direita) com o tensor de estrutura
Jxx = ndimage.gaussian_filter(gxx * gxx, 3); Jyy = ndimage.gaussian_filter(gyy * gyy, 3); Jxy = ndimage.gaussian_filter(gxx * gyy, 3)
coer = np.sqrt((Jxx - Jyy)**2 + 4 * Jxy**2) / (Jxx + Jyy + 1e-12)
perto_mud = ndimage.binary_dilation(mud, iterations=2)
ok = borda & (coer > 0.7) & ~perto_mud
iy_, ix_ = np.nonzero(ok)
# uma aresta por célula de 3 m
cx = (x0 + (ix_ + .5) * cs); cy = (y0 + (iy_ + .5) * cs)
ch = np.floor(cx / 2).astype(np.int64) * 10**7 + np.floor(cy / 2).astype(np.int64)
o = rng.permutation(len(ch)); _, pri = np.unique(ch[o], return_index=True); pick = o[pri]
cx, cy = cx[pick], cy[pick]
gx_, gy_ = gxx[iy_[pick], ix_[pick]], gyy[iy_[pick], ix_[pick]]
nn = -np.stack([gx_, gy_], 1); nn /= np.linalg.norm(nn, axis=1, keepdims=True)  # para fora do prédio
print('arestas candidatas', len(cx))
def degrau(p, n):
    g, h, mu, s = p
    return g + h * (1 - ndtr((n - mu) / s))
def ajusta(n, z):
    if len(n) < 25 or (n < -0.8).sum() < 8 or (n > 0.8).sum() < 8: return None
    g0 = np.percentile(z[n > 0.8], 20); r0 = np.percentile(z[n < -0.8], 80)
    if r0 - g0 < 1.5: return None
    res = least_squares(lambda p: degrau(p, n) - z, [g0, r0 - g0, 0.0, 0.15], loss='soft_l1', f_scale=0.15,
                        bounds=([-1e4, 0.5, -1.8, 0.003], [1e4, 50, 1.8, 1.5]))
    if not res.success: return None
    return res.x
out = []
for i in range(len(cx)):
    c = np.array([cx[i], cy[i]]); nv = nn[i]; tv = np.array([-nv[1], nv[0]])
    linha = {}
    for nome, (X, Y, Z) in fontes.items():
        v = arv[nome].query_ball_point(c, 2.7)
        if not v: break
        v = np.array(v); d = np.stack([X[v], Y[v]], 1) - c
        n = d @ nv; t = d @ tv
        s_ = (np.abs(t) < 0.75) & (np.abs(n) < 2.5)
        p = ajusta(n[s_], Z[v][s_])
        if p is None: break
        g, h, mu, sg = p
        # fachada: pontos a menos de 30 cm do plano da parede, entre 0,5 m acima do chão e 0,5 m abaixo do beiral
        fz = (np.abs(t) < 0.75) & (np.abs(n - mu) < 0.3) & (Z[v] > g + 0.5) & (Z[v] < g + h - 0.5)
        # o degrau visto de cima: sem os pontos a meia altura (paredes), só telhado e chão
        zz = Z[v][s_]; fora = (zz < g + 0.25 * h) | (zz > g + 0.75 * h)
        p2 = ajusta(n[s_][fora], zz[fora])
        if p2 is None: break
        linha[nome] = dict(g=g, h=h, mu=mu, s=sg, mu2=p2[2], s2=p2[3], fach=fz.sum() / (1.5 * max(h - 1.0, 0.1)), npts=int(s_.sum()))
    else:
        out.append(dict(x=cx[i], y=cy[i], nx=nv[0], ny=nv[1], **{f'{a_}_{b_}': v_ for a_, d_ in linha.items() for b_, v_ in d_.items()}))
print('arestas com ajuste nas três fontes', len(out))
chaves = sorted(out[0].keys())
T = {c_: np.array([r[c_] for r in out], float) for c_ in chaves}
T['mesmo'] = ((np.abs(T['modelo_h'] - T['lidar_h']) < 0.5) & (np.abs(T['modelo_g'] - T['lidar_g']) < 0.5) & (T['lidar_h'] > 2.0)).astype(float)
np.savez('arestas.npz', **T)
print('mesmo prédio', int(T['mesmo'].sum()))
# Pontos na fachada por m² de parede, nas paredes que existem nos dois voos
m = T['mesmo'] > 0
for fonte in ('modelo', 'lidar', 'mds50'):
    f = T[f'{fonte}_fach'][m]
    print(f'{fonte}: pontos por m² de parede, mediana {np.median(f):.1f}, média {np.mean(f):.1f} ({int(m.sum())} paredes)')
