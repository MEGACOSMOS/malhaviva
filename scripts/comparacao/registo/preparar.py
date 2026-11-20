# Lê o PLY completo do bairro e guarda, para cada mancha, só o que a vista
# a pique precisa: posição, covariância projetada no plano horizontal,
# opacidade e cor (DC e com os harmónicos esféricos avaliados a olhar para baixo).
import sys, os, numpy as np

PLY = os.environ.get("MALHAVIVA_PLY", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dados", "gs_full.ply"))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados")
os.makedirs(OUT, exist_ok=True)

with open(PLY, "rb") as f:
    head = f.read(8000)
off = head.find(b"end_header\n") + len(b"end_header\n")
props = [l.split()[-1].decode() for l in head[:off].split(b"\n") if l.startswith(b"property")]
n = int([l for l in head[:off].split(b"\n") if l.startswith(b"element vertex")][0].split()[-1])
P = len(props)
ix = {p: i for i, p in enumerate(props)}
mm = np.memmap(PLY, dtype=np.float32, mode="r", offset=off, shape=(n, P))
print(n, P)

C0 = 0.28209479177387814
C1 = 0.4886025119029199
C2_2 = 0.31539156525252005
C3_3 = 0.3731763325901154

pos = np.lib.format.open_memmap(os.path.join(OUT, "pos.npy"), "w+", np.float32, (n, 3))
cov = np.lib.format.open_memmap(os.path.join(OUT, "cov.npy"), "w+", np.float32, (n, 3))   # sxx, sxy, syy (frame do PLY: x leste, y norte, z cima)
op = np.lib.format.open_memmap(os.path.join(OUT, "op.npy"), "w+", np.float32, (n,))
cdc = np.lib.format.open_memmap(os.path.join(OUT, "cor_dc.npy"), "w+", np.float32, (n, 3))
csh = np.lib.format.open_memmap(os.path.join(OUT, "cor_sh.npy"), "w+", np.float32, (n, 3))

CH = 1_000_000
for a in range(0, n, CH):
    b = min(n, a + CH)
    d = np.array(mm[a:b])
    pos[a:b] = d[:, [ix["x"], ix["y"], ix["z"]]]
    q = d[:, [ix["rot_0"], ix["rot_1"], ix["rot_2"], ix["rot_3"]]].astype(np.float64)
    q /= np.linalg.norm(q, axis=1, keepdims=True) + 1e-12
    w, x, y, z = q.T
    R = np.empty((b - a, 3, 3))
    R[:, 0, 0] = 1 - 2 * (y * y + z * z); R[:, 0, 1] = 2 * (x * y - w * z); R[:, 0, 2] = 2 * (x * z + w * y)
    R[:, 1, 0] = 2 * (x * y + w * z); R[:, 1, 1] = 1 - 2 * (x * x + z * z); R[:, 1, 2] = 2 * (y * z - w * x)
    R[:, 2, 0] = 2 * (x * z - w * y); R[:, 2, 1] = 2 * (y * z + w * x); R[:, 2, 2] = 1 - 2 * (x * x + y * y)
    s = np.exp(d[:, [ix["scale_0"], ix["scale_1"], ix["scale_2"]]].astype(np.float64))
    M = R * s[:, None, :]
    S = M @ M.transpose(0, 2, 1)
    cov[a:b, 0] = S[:, 0, 0]; cov[a:b, 1] = S[:, 0, 1]; cov[a:b, 2] = S[:, 1, 1]
    op[a:b] = 1 / (1 + np.exp(-d[:, ix["opacity"]]))
    dc = d[:, [ix["f_dc_0"], ix["f_dc_1"], ix["f_dc_2"]]]
    base = 0.5 + C0 * dc
    cdc[a:b] = np.clip(base, 0, None)
    # f_rest: 15 coeficientes por canal, canal a canal. Direção de vista = -z do PLY (a pique, de cima).
    sh = np.stack([d[:, ix["f_rest_0"] + 15 * c: ix["f_rest_0"] + 15 * c + 15] for c in range(3)], axis=2)  # (n,15,3)
    # índices 0..14 = coeficientes 1..15; com x=y=0, z=-1 só sobram:
    # grau 1: C1*z*sh2 = -C1*sh2; grau 2: C2[2]*(2zz-xx-yy)*sh6 = 2*C2[2]*sh6;
    # grau 3: C3[3]*z*(2zz-3xx-3yy)*sh12 = -2*C3[3]*sh12
    add = -C1 * sh[:, 1] + 2 * C2_2 * sh[:, 5] - 2 * C3_3 * sh[:, 11]
    csh[a:b] = np.clip(base + add, 0, None)
    print(a, flush=True)

for arr in (pos, cov, op, cdc, csh):
    arr.flush()
print("ok")
