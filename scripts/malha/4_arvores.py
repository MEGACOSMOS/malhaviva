"""Passo 4 — as árvores, em manchas.

Uma copa de árvore não tem pele: numa malha vira uma bolha. Aqui as árvores
saem da malha (o passo 5 tira-lhe as copas) e passam a ser manchas, tiradas
do splat do próprio site, que é onde elas ficam bem.

Onde há árvores, numa grelha de meio metro:
  - altura acima do chão maior do que 1,5 m — o cimo é o da malha, o chão é
    o cimo "aberto" com um disco de 30 m (tira tudo o que é mais estreito do
    que isso: casas e árvores) e esbatido;
  - e verde — índice 2G−R−B das manchas do cimo, normalizado, acima de 0,03.
Limpa-se o que fica (aberto 1 m, fechado 2,5 m, nada abaixo de 4 m²) e
alarga-se 1,5 m, para apanhar a orla da copa.

As manchas vêm do nível 1 do splat do site (public/splat/1_*, cerca de um
décimo do nível mais fino): as de dentro da zona, do chão (−0,5 m) até 1,5 m
acima do cimo, sem as soltas maiores do que 1,5 m. Com o nível 0 (argumento
0) as árvores ficam quase iguais ao bairro no computador, mas são dez vezes
mais manchas — de mais para um telemóvel.

Uso: python 4_arvores.py <versão> [nível do splat] [G]
Escreve public/malha/<versão>/arvores/ (SOG) e <trabalho>/arvores/arvores.npz
(a zona das árvores, para o passo 5).
"""
import glob, json, os, sys, pickle
import numpy as np, cv2
from PIL import Image
from comum import PUBLICO, TRABALHO, ALTURA_DA_CENA
from sog import escrever_sog

VERSAO = sys.argv[1]
NIVEL = sys.argv[2] if len(sys.argv) > 2 else "1"
G = float(sys.argv[3]) if len(sys.argv) > 3 else 2.5
PASTA = os.path.join(TRABALHO, "arvores"); os.makedirs(PASTA, exist_ok=True)
R = 0.5; X0, Z0 = -290.0, -400.0; W, H = int(590 / R), int(700 / R)


def ler_nivel(nivel):
    """Todas as manchas de um nível do splat do site, nas coordenadas dele."""
    pos, esc, cor, alfa, quat = [], [], [], [], []
    for d in sorted(glob.glob(os.path.join(PUBLICO, "splat", nivel + "_*"))):
        m = json.load(open(os.path.join(d, "meta.json"))); n = m["count"]
        img = lambda f: np.asarray(Image.open(os.path.join(d, f)).convert("RGBA")).reshape(-1, 4)[:n]
        lo, up = img("means_l.webp")[:, :3].astype(np.uint32), img("means_u.webp")[:, :3].astype(np.uint32)
        q = ((up << 8) | lo).astype(np.float64) / 65535
        mn, mx = np.array(m["means"]["mins"]), np.array(m["means"]["maxs"])
        v = mn + (mx - mn) * q
        pos.append((np.sign(v) * (np.exp(np.abs(v)) - 1)).astype(np.float32))
        esc.append(np.array(m["scales"]["codebook"], np.float32)[img("scales.webp")[:, :3]])
        s0 = img("sh0.webp")
        cor.append(np.array(m["sh0"]["codebook"], np.float32)[s0[:, :3]]); alfa.append(s0[:, 3].copy())
        quat.append(img("quats.webp").copy())
    return {"pos": np.concatenate(pos), "esc": np.concatenate(esc), "sh0": np.concatenate(cor),
            "alfa": np.concatenate(alfa), "quat": np.concatenate(quat)}


def celulas(pos):
    """Célula da grelha de cada mancha (cena = x, −y, −z do splat) e se está dentro."""
    i = ((pos[:, 0] - X0) / R).astype(int); j = ((-pos[:, 2] - Z0) / R).astype(int)
    return i, j, (i >= 0) & (i < W) & (j >= 0) & (j < H)


# --- o cimo (DSM), da malha recortada ---
out = pickle.load(open(os.path.join(TRABALHO, "recorte_%g.pkl" % G), "rb"))
rng = np.random.default_rng(0); pts = []
for o in out:
    T = o["P"][o["F"]]
    for _ in range(3):
        r = rng.random((len(T), 2)); m = r.sum(1) > 1; r[m] = 1 - r[m]
        pts.append(T[:, 0] + r[:, :1] * (T[:, 1] - T[:, 0]) + r[:, 1:] * (T[:, 2] - T[:, 0]))
    pts.append(T.reshape(-1, 3))
P = np.concatenate(pts)
x, y, z = P[:, 0], P[:, 2] + ALTURA_DA_CENA, -P[:, 1]
i = ((x - X0) / R).astype(int); j = ((z - Z0) / R).astype(int)
dsm = np.full(W * H, -np.inf, np.float32); np.maximum.at(dsm, j * W + i, y.astype(np.float32)); dsm = dsm.reshape(H, W)
tem = np.isfinite(dsm)

# --- o chão (DTM): o cimo aberto com um disco de 30 m ---
base = np.where(tem, dsm, 200).astype(np.float32)
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61))
dtm = cv2.GaussianBlur(cv2.dilate(cv2.erode(base, k), k), (0, 0), 6)
ndsm = np.where(tem, dsm - dtm, 0)

# --- a cor do cimo, pelas manchas mais finas ---
fino = ler_nivel("0")
fi, fj, fok = celulas(fino["pos"])
fok &= fino["alfa"] > 128
idx = np.where(fok)[0]
topo = dsm[fj[idx], fi[idx]]
idx = idx[np.isfinite(topo) & (-fino["pos"][idx, 1] >= topo - 1.2)]
c = np.clip(0.5 + 0.2820948 * fino["sh0"][idx], 0, 1)
kk = fj[idx] * W + fi[idx]
soma = np.zeros((W * H, 3)); np.add.at(soma, kk, c); n = np.bincount(kk, minlength=W * H)
media = (soma / np.maximum(n, 1)[:, None]).reshape(H, W, 3)
exg = (2 * media[:, :, 1] - media[:, :, 0] - media[:, :, 2]) / (media.sum(2) + 1e-6)
del fino

# --- a zona das árvores ---
arv = ((ndsm > 1.5) & (exg > 0.03)).astype(np.uint8)
arv = cv2.morphologyEx(arv, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
arv = cv2.morphologyEx(arv, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
nl, lab, st, _ = cv2.connectedComponentsWithStats(arv, 8)
fica = np.zeros(nl, bool); fica[1:] = st[1:, cv2.CC_STAT_AREA] >= 16
arv = fica[lab]
largo = cv2.dilate(arv.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))).astype(bool)
np.savez(os.path.join(PASTA, "arvores.npz"), arv=arv, largo=largo, dtm=dtm, dsm=dsm, X0=X0, Z0=Z0, R=R)
print("árvores: %.0f m² (com a orla, %.0f m²)" % (arv.sum() * R * R, largo.sum() * R * R))
vis = (np.clip(media, 0, 1)[:, :, ::-1] * 255).astype(np.uint8)
cont, _ = cv2.findContours(arv.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
cv2.drawContours(vis, cont, -1, (255, 0, 255), 1)
cv2.imwrite(os.path.join(PASTA, "arvores.png"), vis)

# --- as manchas das árvores ---
s = ler_nivel(NIVEL)
si, sj, sok = celulas(s["pos"])
sel = np.zeros(len(s["pos"]), bool)
a, b = si[sok], sj[sok]
cimo = np.where(np.isfinite(dsm[b, a]), dsm[b, a], dtm[b, a] + 30)
sy = -s["pos"][sok, 1]
sel[sok] = largo[b, a] & (sy > dtm[b, a] - 0.5) & (sy < cimo + 1.5) & (np.exp(s["esc"][sok].max(1)) < 1.5)
k = np.where(sel)[0]
bytes_ = escrever_sog(os.path.join(PUBLICO, "malha", VERSAO, "arvores"),
                      s["pos"][k], s["esc"][k], s["sh0"][k], s["alfa"][k], s["quat"][k])
print("manchas das árvores:", len(k), "— %.2f MB" % (bytes_ / 1e6))
