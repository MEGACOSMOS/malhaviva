# Passa as alturas da DGT (voo LiDAR de julho de 2024, MDS = superfície,
# MDT = terreno, 50 cm, EPSG:3763) para uma grelha em coordenadas da cena
# do site (x leste, z sul, metros), e mede a mesma coisa no modelo do drone
# (gs_optimizado.ply), para acertar a altura de uma com a outra.
#
# Cena <-> geo: cena (x, z) -> (X, Y) = (x, -z) -> Mercator = s·R·[X, Y] + t
# (registo.json do ortofotomapa).
import glob, json, math, os
import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.warp import transform as tr
from scipy.ndimage import map_coordinates

BASE = r"E:/Malha Viva - trabalho/edificios"
REG = r"G:/Outros computadores/O meu portátil/Malha Viva/Imagens/Ortofotomapa/processo/registo.json"
E = 750.0      # metros para cada lado da origem
PASSO = 0.5    # metros por célula

reg = json.load(open(REG, encoding="utf8"))
s = reg["s"]; R = np.array(reg["R"]); t = np.array(reg["t"])
RT = 6378137.0


def cena_para_lonlat(x, z):
    X = np.stack([x.ravel(), -z.ravel()])
    m = s * (R @ X) + t[:, None]
    lon = np.degrees(m[0] / RT)
    lat = np.degrees(2 * np.arctan(np.exp(m[1] / RT)) - math.pi / 2)
    return lon.reshape(x.shape), lat.reshape(x.shape)


def mosaico(padrao):
    fs = [rasterio.open(f) for f in sorted(glob.glob(os.path.join(BASE, "dgt/tif", padrao)))]
    arr, aff = merge(fs, nodata=-999)
    return arr[0], aff


n = int(2 * E / PASSO)
c = (np.arange(n) + 0.5) * PASSO - E
xx, zz = np.meshgrid(c, c)            # linhas = z, colunas = x
lon, lat = cena_para_lonlat(xx, zz)
ex, ny = tr("EPSG:4326", "EPSG:3763", lon.ravel(), lat.ravel())
ex = np.asarray(ex).reshape(xx.shape); ny = np.asarray(ny).reshape(xx.shape)

for nome, padrao in (("mds", "MDS-*.tif"), ("mdt", "MDT-*.tif")):
    a, aff = mosaico(padrao)
    col = (ex - aff.c) / aff.a - 0.5
    lin = (ny - aff.f) / aff.e - 0.5
    a = a.astype(np.float32)
    v = map_coordinates(a, [lin, col], order=1, cval=-999, mode="constant")
    # células perto de "sem dados" ficam sem dados
    vn = map_coordinates((a <= -998).astype(np.float32), [lin, col], order=1, cval=1, mode="constant")
    v[vn > 0.01] = np.nan
    np.save(os.path.join(BASE, f"{nome}.npy"), v.astype(np.float32))
    print(nome, np.nanmin(v), np.nanmax(v), np.isnan(v).mean())

json.dump({"E": E, "passo": PASSO, "n": n,
           "nota": "linha i = z = (i+0.5)*passo - E; coluna j = x = (j+0.5)*passo - E"},
          open(os.path.join(BASE, "grelha.json"), "w"))
