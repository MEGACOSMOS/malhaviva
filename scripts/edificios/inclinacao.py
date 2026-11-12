# Ajusta y_cena = a*alt_DGT + b*x + c*z + d nas células de chão aberto,
# para levar as alturas da DGT para o "cima" do modelo do drone.
import json
import numpy as np

BASE = r"E:/Malha Viva - trabalho/edificios"
dsm = np.load(BASE + "/drone_dsm.npy"); mds = np.load(BASE + "/mds.npy"); mdt = np.load(BASE + "/mdt.npy")
mds = np.roll(mds, -1, 0); mdt = np.roll(mdt, -1, 0)   # deslocamento achado em alinhar.py (0,5 m)
n = dsm.shape[0]; P = 0.5; E = 750
c = (np.arange(n) + 0.5) * P - E
xx, zz = np.meshgrid(c, c)
chao = ((mds - mdt) < 0.2) & np.isfinite(dsm) & np.isfinite(mds) & (np.hypot(xx, zz) < 320)
# o drone, no chão aberto, pode ter manchas soltas por cima: fica-se com o que bate
for volta in range(4):
    A = np.vstack([mdt[chao], xx[chao], zz[chao], np.ones(chao.sum())]).T
    sol, *_ = np.linalg.lstsq(A, dsm[chao], rcond=None)
    res = dsm[chao] - A @ sol
    mad = np.median(np.abs(res - np.median(res)))
    print(volta, "a=%.4f b=%.5f c=%.5f d=%.3f" % tuple(sol), "resíduo mediano abs %.3f" % mad, chao.sum())
    manter = np.abs(res - np.median(res)) < 3 * 1.4826 * mad
    idx = np.flatnonzero(chao.ravel())
    chao.ravel()[idx[~manter]] = False

# Também sem escala (a = 1), que é o mais seguro longe do bairro
A = np.vstack([xx[chao], zz[chao], np.ones(chao.sum())]).T
sol1, *_ = np.linalg.lstsq(A, dsm[chao] - mdt[chao], rcond=None)
res1 = dsm[chao] - mdt[chao] - A @ sol1
print("a=1: b=%.5f c=%.5f d=%.3f" % tuple(sol1), "resíduo mediano abs %.3f" % np.median(np.abs(res1)))
inc = math_deg = np.degrees(np.arctan(np.hypot(sol1[0], sol1[1])))
print("inclinação %.2f graus" % inc)
json.dump({"a": float(sol[0]), "b": float(sol[1]), "c": float(sol[2]), "d": float(sol[3]),
           "a1": {"b": float(sol1[0]), "c": float(sol1[1]), "d": float(sol1[2])},
           "deslocamento_linhas": -1},
          open(BASE + "/altura.json", "w"), indent=1)
