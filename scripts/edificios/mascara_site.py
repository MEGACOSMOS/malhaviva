# Reproduz, como o site faz em aplicarLimitesDoMapa(), a zona onde o
# bairro em manchas é visível e o seu desvanecimento junto à borda
# (grelha de 4 m, 90 m de esbatimento). Guarda o valor de 0 a 1 na
# grelha de 0,5 m das alturas.
import json
import numpy as np
from scipy.ndimage import binary_fill_holes, distance_transform_edt, map_coordinates

BASE = r"E:/Malha Viva - trabalho/edificios"
META = r"G:/Outros computadores/O meu portátil/Malha Viva/Site/Malha Viva/malhaviva/public/splat/lod-meta.json"
CEL = 4.0; LARG = 90.0
meta = json.load(open(META))
folhas = []
def rec(no):
    if not no.get("children"):
        if "bound" in no: folhas.append(no["bound"])
        return
    for f in no["children"]: rec(f)
rec(meta["tree"])
# entidade rodada 180° em X: (x, y, z) -> (x, -y, -z)
pl = []
for b in folhas:
    x0, x1 = b["min"][0], b["max"][0]
    z0, z1 = -b["max"][2], -b["min"][2]
    pl.append((x0, x1, z0, z1))
pl = np.array(pl)
minX, maxX = pl[:, 0].min(), pl[:, 1].max(); minZ, maxZ = pl[:, 2].min(), pl[:, 3].max()
folga = int(np.ceil(160 / CEL)) + 2
col = int(np.ceil((maxX - minX) / CEL)) + 2 * folga
lin = int(np.ceil((maxZ - minZ) / CEL)) + 2 * folga
oX = minX - folga * CEL; oZ = minZ - folga * CEL
ter = np.zeros((lin, col), bool)
for x0, x1, z0, z1 in pl:
    a = int((x0 - oX) // CEL); b = int((x1 - oX) // CEL)
    c = int((z0 - oZ) // CEL); d = int((z1 - oZ) // CEL)
    ter[c:d + 1, a:b + 1] = True
ter = binary_fill_holes(ter)
dentro = distance_transform_edt(ter)   # em células (o site usa chanfro 1/√2, quase igual)
vis = np.clip(dentro * CEL / LARG, 0, 1)
vis = vis * vis * (3 - 2 * vis)        # smoothstep, como no programa gráfico

g = json.load(open(BASE + "/grelha.json"))
n, P, E = g["n"], g["passo"], g["E"]
c = (np.arange(n) + 0.5) * P - E
xx, zz = np.meshgrid(c, c)
# o site amostra a textura com filtro linear, centro dos texels em (k+0.5)
v = map_coordinates(vis.astype(np.float32), [(zz - oZ) / CEL - 0.5, (xx - oX) / CEL - 0.5], order=1, cval=0)
np.save(BASE + "/visivel.npy", v.astype(np.float32))
print("folhas", len(folhas), "extensão x", minX, maxX, "z", minZ, maxZ)
