# Ortofotomapa final: desenha o bairro a pique em EPSG:3857, faixa a faixa,
# e grava um GeoTIFF (JPEG YCbCr + máscara interna + pirâmides) com o GDAL.
#
#   python ortofoto.py <pasta de saída> <nome base> [cm por píxel] [sobre-amostragem]
import os, sys, json, time, math, numpy as np, cv2
import rasterio
from rasterio.transform import from_origin
from rasterio.windows import Window
from rasterio.enums import Resampling
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import contar, preencher, rasterizar

AQUI = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(AQUI, "dados")
PASTA, NOME = sys.argv[1], sys.argv[2]
CM = float(sys.argv[3]) if len(sys.argv) > 3 else 2.5
SS = int(sys.argv[4]) if len(sys.argv) > 4 else 2
R_T = 6378137.0

t0 = time.time()
reg = json.load(open(os.path.join(AQUI, "registo.json")))
msk = json.load(open(os.path.join(AQUI, "mascara.json")))
PE, PN = np.array(msk["E"]), np.array(msk["N"])
lat_c = math.degrees(2 * math.atan(math.exp(PN.mean() / R_T)) - math.pi / 2)
k = math.cos(math.radians(lat_c))
p = round(CM / 100 / k, 4)                  # tamanho do píxel em metros de Mercator
passo = p * 200
E0 = math.floor((PE.min() - 3.2) / passo) * passo
E1 = math.ceil((PE.max() + 3.2) / passo) * passo
N0 = math.floor((PN.min() - 3.2) / passo) * passo
N1 = math.ceil((PN.max() + 3.2) / passo) * passo
Wf, Hf = int(round((E1 - E0) / p)), int(round((N1 - N0) / p))
rs = p / SS
W = Wf * SS
print("píxel %.4f m Mercator = %.2f cm no chão; %d x %d; lat %.5f" % (p, p * k * 100, Wf, Hf, lat_c), flush=True)

# ---- manchas, já em coordenadas de Mercator ----
pos = np.load(os.path.join(D, "pos.npy"), mmap_mode="r")
op = np.load(os.path.join(D, "op.npy"))
keep = op >= 1.0 / 255.0
ordem = np.argsort(-np.asarray(pos[:, 2])[keep], kind="stable")      # de cima para baixo
sel = np.nonzero(keep)[0][ordem]
del ordem, keep
op = op[sel]
X = np.asarray(pos[:, 0])[sel].astype(np.float64)
Y = np.asarray(pos[:, 1])[sel].astype(np.float64)
cov = np.load(os.path.join(D, "cov.npy"), mmap_mode="r")
Sxx = np.asarray(cov[:, 0])[sel].astype(np.float64)
Sxy = np.asarray(cov[:, 1])[sel].astype(np.float64)
Syy = np.asarray(cov[:, 2])[sel].astype(np.float64)
s, Rm, t = reg["s"], np.array(reg["R"]), np.array(reg["t"])
r00, r01, r10, r11 = Rm[0, 0], Rm[0, 1], Rm[1, 0], Rm[1, 1]
E = s * (r00 * X + r01 * Y) + t[0]
N = s * (r10 * X + r11 * Y) + t[1]
del X, Y
nxx = s * s * (r00 * r00 * Sxx + 2 * r00 * r01 * Sxy + r01 * r01 * Syy)
nxy = s * s * (r00 * r10 * Sxx + (r00 * r11 + r01 * r10) * Sxy + r01 * r11 * Syy)
nyy = s * s * (r10 * r10 * Sxx + 2 * r10 * r11 * Sxy + r11 * r11 * Syy)
del Sxx, Sxy, Syy
u = ((E - E0) / rs).astype(np.float32)
v = ((N1 - N) / rs).astype(np.float32)
del E, N
A = nxx / rs**2 + 0.3
B = -nxy / rs**2
C = nyy / rs**2 + 0.3
del nxx, nxy, nyy
det = A * C - B * B
ca = (C / det).astype(np.float32); cb = (-B / det).astype(np.float32); cc = (A / det).astype(np.float32)
tr = 0.5 * (A + C)
lmax = tr + np.sqrt(np.maximum(tr * tr - det, 0))
kk = np.sqrt(np.clip(2 * np.log(np.maximum(op * 255.0, 1.0)), 0, 9.0))
rad = np.ceil(kk * np.sqrt(lmax)).astype(np.float32)
del A, B, C, det, tr, lmax, kk
col = np.asarray(np.load(os.path.join(D, "cor_sh.npy"), mmap_mode="r"))[sel].astype(np.float32)
col = np.concatenate([col, np.zeros((col.shape[0], 1), np.float32)], axis=1)   # 4.º canal não usado aqui
del sel
H = Hf * SS
vis = (u + rad >= 0) & (u - rad < W) & (v + rad >= 0) & (v - rad < H) & (rad > 0)
u, v, ca, cb, cc, op, col, rad = [x[vis] for x in (u, v, ca, cb, cc, op, col, rad)]
del vis
print("manchas %d (%.0fs)" % (u.shape[0], time.time() - t0), flush=True)

# ---- GeoTIFF ----
os.makedirs(PASTA, exist_ok=True)
tif = os.path.join(PASTA, NOME + ".tif")
perfil = dict(driver="GTiff", width=Wf, height=Hf, count=3, dtype="uint8", crs="EPSG:3857",
              transform=from_origin(E0, N1, p, p), tiled=True, blockxsize=512, blockysize=512,
              compress="JPEG", photometric="YCBCR", jpeg_quality=90, interleave="pixel", BIGTIFF="IF_SAFER")
poli = np.stack([(PE - E0) / p, (N1 - PN) / p], axis=1)

FAIXA = 512                        # linhas finais por faixa (= um bloco do TIFF)
T = 128
with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True, GDAL_NUM_THREADS="ALL_CPUS"):
    with rasterio.open(tif, "w", **perfil) as dst:
        dst.update_tags(TIFFTAG_IMAGEDESCRIPTION="Ortofotomapa do Bairro de Penajóia (Malha Viva), voo de drone de 15-02-2026, desenhado a pique a partir do modelo 3D",
                        TIFFTAG_DATETIME="2026:02:15 14:10:54", TIFFTAG_SOFTWARE="Malha Viva")
        for f0 in range(0, Hf, FAIXA):
            f1 = min(Hf, f0 + FAIXA)
            b0, b1 = f0 * SS, f1 * SS
            m = (v + rad >= b0) & (v - rad < b1)
            bu, bv, br = u[m], v[m] - b0, rad[m]
            Hb = b1 - b0
            ntx, nty = (W + T - 1) // T, (Hb + T - 1) // T
            tx0 = np.clip(((bu - br) // T).astype(np.int64), 0, ntx - 1)
            tx1 = np.clip(((bu + br) // T).astype(np.int64), 0, ntx - 1)
            ty0 = np.clip(((bv - br) // T).astype(np.int64), 0, nty - 1)
            ty1 = np.clip(((bv + br) // T).astype(np.int64), 0, nty - 1)
            starts = contar(tx0, tx1, ty0, ty1, ntx, ntx * nty)
            idx = np.empty(starts[-1], np.int64)
            preencher(tx0, tx1, ty0, ty1, ntx, starts, idx)
            del tx0, tx1, ty0, ty1
            out = np.zeros((Hb, W, 4), np.float32)
            alpha = np.zeros((Hb, W), np.float32)
            rasterizar(starts, idx, ntx, nty, T, W, Hb, bu, bv, ca[m], cb[m], cc[m], op[m],
                       np.ascontiguousarray(col[m]), br, out, alpha)
            del idx, starts, m, bu, bv, br
            hb = f1 - f0
            out = out[..., :3].reshape(hb, SS, Wf, SS, 3).mean(axis=(1, 3))
            alpha = alpha.reshape(hb, SS, Wf, SS).mean(axis=(1, 3))
            rgb = np.clip(out / np.maximum(alpha, 1e-6)[..., None] * 255 + 0.5, 0, 255).astype(np.uint8)
            del out
            dentro = np.zeros((hb, Wf), np.uint8)
            pts = poli - np.array([0, f0])
            cv2.fillPoly(dentro, [np.round(pts * 16).astype(np.int32).reshape(-1, 1, 2)], 1, lineType=cv2.LINE_8, shift=4)
            mascara = ((alpha >= 0.5) & (dentro > 0)).astype(np.uint8) * 255
            rgb[mascara == 0] = 255                   # fora: branco (escondido pela máscara)
            dst.write(np.moveaxis(rgb, 2, 0), window=Window(0, f0, Wf, hb))
            dst.write_mask(mascara, window=Window(0, f0, Wf, hb))
            del rgb, alpha, mascara, dentro
            print("faixa %d/%d (%.0fs)" % (f1, Hf, time.time() - t0), flush=True)
    del u, v, ca, cb, cc, op, col, rad
    print("a fazer pirâmides (%.0fs)" % (time.time() - t0), flush=True)
    with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True, COMPRESS_OVERVIEW="JPEG", PHOTOMETRIC_OVERVIEW="YCBCR",
                      JPEG_QUALITY_OVERVIEW=88, INTERLEAVE_OVERVIEW="PIXEL", GDAL_NUM_THREADS="ALL_CPUS"):
        with rasterio.open(tif, "r+") as dst:
            niveis = []
            f = 2
            while max(Wf, Hf) / f >= 256:
                niveis.append(f); f *= 2
            dst.build_overviews(niveis, Resampling.average)
print("ok %s (%.0fs)" % (tif, time.time() - t0))
json.dump(dict(E0=E0, N1=N1, p=p, W=Wf, H=Hf, lat=lat_c, cm=p * k * 100), open(os.path.join(AQUI, "grelha_%s.json" % str(CM).replace('.', '_')), "w"))
