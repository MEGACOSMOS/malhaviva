# Superfície do modelo do drone na mesma grelha (cena: x, y cima, z sul)
# e comparação com a superfície da DGT, para acertar a altura das duas.
import json, os
import numpy as np

BASE = r"E:/Malha Viva - trabalho/edificios"
PLY = BASE + "/ply/gs_optimizado.ply"
g = json.load(open(BASE + "/grelha.json"))
E, P, n = g["E"], g["passo"], g["n"]

with open(PLY, "rb") as f:
    head = f.read(8000)
off = head.find(b"end_header\n") + len(b"end_header\n")
props = [l.split()[-1].decode() for l in head[:off].split(b"\n") if l.startswith(b"property")]
nv = int([l for l in head[:off].split(b"\n") if l.startswith(b"element vertex")][0].split()[-1])
ix = {p: i for i, p in enumerate(props)}
mm = np.memmap(PLY, dtype=np.float32, mode="r", offset=off, shape=(nv, len(props)))

dsm = np.full(n * n, -np.inf, np.float32)
cont = np.zeros(n * n, np.int32)
CH = 2_000_000
for a in range(0, nv, CH):
    d = np.array(mm[a:a + CH])
    op = 1 / (1 + np.exp(-d[:, ix["opacity"]]))
    sc = np.exp(d[:, [ix["scale_0"], ix["scale_1"], ix["scale_2"]]]).max(1)
    ok = (op > 0.5) & (sc < 0.4)
    x = d[ok, ix["x"]]; y = -d[ok, ix["y"]]; z = -d[ok, ix["z"]]
    j = np.floor((x + E) / P).astype(np.int64); i = np.floor((z + E) / P).astype(np.int64)
    dentro = (i >= 0) & (i < n) & (j >= 0) & (j < n)
    k = i[dentro] * n + j[dentro]
    np.maximum.at(dsm, k, y[dentro])
    np.add.at(cont, k, 1)
    print(a, flush=True)
dsm[cont < 3] = np.nan
dsm = dsm.reshape(n, n)
np.save(BASE + "/drone_dsm.npy", dsm)

mds = np.load(BASE + "/mds.npy"); mdt = np.load(BASE + "/mdt.npy")
chao = (mds - mdt) < 0.3          # terreno aberto (estradas, campos rasos)
v = chao & np.isfinite(dsm) & np.isfinite(mds)
dif = dsm[v] - mds[v]
print("células de chão comuns:", v.sum())
print("drone - DGT: mediana %.3f  p25 %.3f  p75 %.3f" % tuple(np.percentile(dif, [50, 25, 75])))
# escala vertical: regressão robusta em altura
A = np.vstack([mds[v], np.ones(v.sum())]).T
sol = np.linalg.lstsq(A, dsm[v], rcond=None)[0]
print("ajuste dsm = %.4f * mds + %.3f" % tuple(sol))
