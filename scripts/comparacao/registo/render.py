# Desenha o bairro visto a pique (projeção ortográfica) a partir das manchas
# preparadas por preparar.py. Frame do PLY: x = leste, y = norte, z = cima.
# Cada píxel (col, lin) cobre [x0 + col*res, x0 + (col+1)*res] × [y1 - (lin+1)*res, y1 - lin*res].
#
#   python render.py --res 0.05 --ss 2 --bounds x0 x1 y0 y1 --cor sh --out ficheiro.npy
#
# Grava RGBA float (pré-multiplicado não; cor já dividida pelo alfa) em uint8 .npy
import argparse, os, time, numpy as np
from numba import njit, prange

AQUI = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(AQUI, "dados")


@njit(cache=True)
def contar(tx0, tx1, ty0, ty1, ntx, nt):
    cnt = np.zeros(nt + 1, np.int64)
    for i in range(tx0.shape[0]):
        for ty in range(ty0[i], ty1[i] + 1):
            for tx in range(tx0[i], tx1[i] + 1):
                cnt[ty * ntx + tx + 1] += 1
    for t in range(nt):
        cnt[t + 1] += cnt[t]
    return cnt


@njit(cache=True)
def preencher(tx0, tx1, ty0, ty1, ntx, starts, idx):
    pos = starts[:-1].copy()
    for i in range(tx0.shape[0]):           # já vêm de cima para baixo
        for ty in range(ty0[i], ty1[i] + 1):
            for tx in range(tx0[i], tx1[i] + 1):
                t = ty * ntx + tx
                idx[pos[t]] = i
                pos[t] += 1


@njit(parallel=True, fastmath=True, cache=True)
def rasterizar(starts, idx, ntx, nty, T, W, H, u, v, ca, cb, cc, op, col, rad, out, alpha):
    nt = ntx * nty
    for t in prange(nt):
        tx = t % ntx
        ty = t // ntx
        px0 = tx * T
        py0 = ty * T
        px1 = min(W, px0 + T)
        py1 = min(H, py0 + T)
        C = np.zeros((T, T, 4), np.float32)
        Tr = np.ones((T, T), np.float32)
        vivos = (px1 - px0) * (py1 - py0)
        for k in range(starts[t], starts[t + 1]):
            if vivos == 0:
                break
            i = idx[k]
            r = rad[i]
            ax0 = max(px0, int(u[i] - r))
            ax1 = min(px1, int(u[i] + r) + 1)
            ay0 = max(py0, int(v[i] - r))
            ay1 = min(py1, int(v[i] + r) + 1)
            o = op[i]
            for py in range(ay0, ay1):
                dy = py + 0.5 - v[i]
                for px in range(ax0, ax1):
                    tr = Tr[py - py0, px - px0]
                    if tr < 1e-4:
                        continue
                    dx = px + 0.5 - u[i]
                    pw = -0.5 * (ca[i] * dx * dx + cc[i] * dy * dy) - cb[i] * dx * dy
                    if pw > 0.0:
                        continue
                    a = o * np.exp(pw)
                    if a > 0.99:
                        a = 0.99
                    if a < 1.0 / 255.0:
                        continue
                    w = tr * a
                    C[py - py0, px - px0, 0] += w * col[i, 0]
                    C[py - py0, px - px0, 1] += w * col[i, 1]
                    C[py - py0, px - px0, 2] += w * col[i, 2]
                    C[py - py0, px - px0, 3] += w * col[i, 3]
                    nt_ = tr * (1.0 - a)
                    Tr[py - py0, px - px0] = nt_
                    if nt_ < 1e-4:
                        vivos -= 1
        for py in range(py0, py1):
            for px in range(px0, px1):
                for c in range(4):
                    out[py, px, c] = C[py - py0, px - px0, c]
                alpha[py, px] = 1.0 - Tr[py - py0, px - px0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--res", type=float, required=True)          # metros por píxel final
    ap.add_argument("--ss", type=int, default=1)                 # sobre-amostragem
    ap.add_argument("--bounds", type=float, nargs=4, required=True)  # x0 x1 y0 y1
    ap.add_argument("--cor", default="sh")
    ap.add_argument("--banda", type=int, default=4096)           # altura da faixa (px internos)
    ap.add_argument("--out", required=True)
    ap.add_argument("--registo", default=None)                    # registo.json -> desenha em EPSG:3857
    a = ap.parse_args()

    t0 = time.time()
    x0, x1, y0, y1 = a.bounds
    rs = a.res / a.ss
    Wf = int(round((x1 - x0) / a.res))
    Hf = int(round((y1 - y0) / a.res))
    W, H = Wf * a.ss, Hf * a.ss

    pos = np.load(os.path.join(D, "pos.npy"), mmap_mode="r")
    op = np.load(os.path.join(D, "op.npy"))
    keep = op >= 1.0 / 255.0
    z = np.asarray(pos[:, 2])
    ordem = np.argsort(-z[keep], kind="stable")
    sel = np.nonzero(keep)[0][ordem]
    del z, ordem, keep
    op = op[sel]
    X = np.asarray(pos[:, 0])[sel].astype(np.float64)
    Y = np.asarray(pos[:, 1])[sel].astype(np.float64)
    cov = np.load(os.path.join(D, "cov.npy"), mmap_mode="r")
    Sxx = np.asarray(cov[:, 0])[sel].astype(np.float64)
    Sxy = np.asarray(cov[:, 1])[sel].astype(np.float64)
    Syy = np.asarray(cov[:, 2])[sel].astype(np.float64)
    trm = 0.5 * (Sxx + Syy)
    sig_m = np.sqrt(trm + np.sqrt(np.maximum(trm * trm - (Sxx * Syy - Sxy * Sxy), 0))).astype(np.float32)  # sigma maior, em metros do modelo
    del trm
    if a.registo:
        import json
        rj = json.load(open(a.registo))
        sc, Rm, tt = rj["s"], np.array(rj["R"]), np.array(rj["t"])
        X, Y = sc * (Rm[0, 0] * X + Rm[0, 1] * Y) + tt[0], sc * (Rm[1, 0] * X + Rm[1, 1] * Y) + tt[1]
        # Σ' = s² R Σ Rᵀ
        r00, r01, r10, r11 = Rm[0, 0], Rm[0, 1], Rm[1, 0], Rm[1, 1]
        nxx = r00 * r00 * Sxx + 2 * r00 * r01 * Sxy + r01 * r01 * Syy
        nxy = r00 * r10 * Sxx + (r00 * r11 + r01 * r10) * Sxy + r01 * r11 * Syy
        nyy = r10 * r10 * Sxx + 2 * r10 * r11 * Sxy + r11 * r11 * Syy
        Sxx, Sxy, Syy = sc * sc * nxx, sc * sc * nxy, sc * sc * nyy
        del nxx, nxy, nyy
    u = ((X - x0) / rs).astype(np.float32)
    v = ((y1 - Y) / rs).astype(np.float32)
    del X, Y
    A = Sxx / rs**2 + 0.3
    B = -Sxy / rs**2           # o eixo das linhas aponta para sul
    Cc = Syy / rs**2 + 0.3
    del Sxx, Sxy, Syy
    det = A * Cc - B * B
    ca = (Cc / det).astype(np.float32)
    cb = (-B / det).astype(np.float32)
    cc = (A / det).astype(np.float32)
    tr = 0.5 * (A + Cc)
    lmax = tr + np.sqrt(np.maximum(tr * tr - det, 0))
    # raio até onde a mancha ainda passa de 1/255 (com teto de 3 sigma)
    k = np.sqrt(np.clip(2 * np.log(np.maximum(op * 255.0, 1.0)), 0, 9.0))
    rad = np.ceil(k * np.sqrt(lmax)).astype(np.float32)
    del A, B, Cc, det, tr, lmax, k
    col = np.load(os.path.join(D, "cor_%s.npy" % a.cor), mmap_mode="r")
    col = np.concatenate([np.asarray(col)[sel].astype(np.float32), sig_m[:, None]], axis=1)
    del sig_m
    del sel
    vis = (u + rad >= 0) & (u - rad < W) & (v + rad >= 0) & (v - rad < H) & (rad > 0)
    u, v, ca, cb, cc, op, col, rad = [x[vis] for x in (u, v, ca, cb, cc, op, col, rad)]
    print("manchas", u.shape[0], "imagem", Wf, "x", Hf, "interna", W, "x", H, "%.1fs" % (time.time() - t0), flush=True)

    final = np.zeros((Hf, Wf, 4), np.uint8)
    sigma = np.zeros((Hf, Wf), np.float16)
    T = 128
    ss = a.ss
    banda = (a.banda // ss) * ss
    for b0 in range(0, H, banda):
        b1 = min(H, b0 + banda)
        m = (v + rad >= b0) & (v - rad < b1)
        bu, bv = u[m], v[m] - b0
        br = rad[m]
        Hb = b1 - b0
        ntx = (W + T - 1) // T
        nty = (Hb + T - 1) // T
        tx0 = np.clip(((bu - br) // T).astype(np.int64), 0, ntx - 1)
        tx1 = np.clip(((bu + br) // T).astype(np.int64), 0, ntx - 1)
        ty0 = np.clip(((bv - br) // T).astype(np.int64), 0, nty - 1)
        ty1 = np.clip(((bv + br) // T).astype(np.int64), 0, nty - 1)
        starts = contar(tx0, tx1, ty0, ty1, ntx, ntx * nty)
        idx = np.empty(starts[-1], np.int64)
        preencher(tx0, tx1, ty0, ty1, ntx, starts, idx)
        out = np.zeros((Hb, W, 4), np.float32)
        alpha = np.zeros((Hb, W), np.float32)
        rasterizar(starts, idx, ntx, nty, T, W, Hb, bu, bv, ca[m], cb[m], cc[m], op[m],
                   np.ascontiguousarray(col[m]), br, out, alpha)
        del idx, starts
        # média ss×ss (cor pré-multiplicada) e passagem a 8 bits sem pré-multiplicar
        hb = Hb // ss
        out = out.reshape(hb, ss, Wf, ss, 4).mean(axis=(1, 3))
        alpha = alpha.reshape(hb, ss, Wf, ss).mean(axis=(1, 3))
        rgb = out / np.maximum(alpha, 1e-6)[..., None]
        f0 = b0 // ss
        final[f0:f0 + hb, :, :3] = np.clip(rgb[..., :3] * 255 + 0.5, 0, 255).astype(np.uint8)
        sigma[f0:f0 + hb] = rgb[..., 3]
        final[f0:f0 + hb, :, 3] = np.clip(alpha * 255 + 0.5, 0, 255).astype(np.uint8)
        del out, alpha, rgb
        print("faixa", b0, "-", b1, "de", H, "%.1fs" % (time.time() - t0), flush=True)
    np.save(a.out, final)
    np.save(a.out.replace('.npy', '_sigma.npy'), sigma)
    print("ok %.1fs" % (time.time() - t0))


if __name__ == "__main__":
    main()
