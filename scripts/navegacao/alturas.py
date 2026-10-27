# As alturas do bairro, vistas a pique, na grelha do ortofotomapa.
#
# O ortofotomapa é uma fotografia: diz a cor de cada sítio, mas não se é um
# telhado ou o chão. Um telhado de chapa vermelha e um beco de terra batida
# podem ter quase a mesma cor; o que os separa é a altura. Por isso o
# reconhecimento lê também as alturas do mesmo levantamento — o modelo 3D
# de onde o ortofotomapa foi desenhado (gs_full.ply, o voo de drone de
# 15-02-2026), já em metros, com o x a leste, o y a norte e o z para cima.
#
# Cada mancha do modelo é desenhada vista de cima, como no ortofotomapa (ver
# Imagens/Ortofotomapa/processo/ortofoto.py), mas em vez da cor guarda-se a
# altura: a de cima de todas que já tapa o chão ("superfície") e a média
# das que se veem, pesada pelo que cada uma tapa ("media").
#
#     python -P scripts/navegacao/alturas.py
#
# Grava na pasta de rascunho: superficie.npy e media.npy (metros, float32) e
# cobertura.npy (0-255, quanto o modelo tapa cada ponto). Demora uns
# minutos e lê os 4 GB do modelo de uma ponta à outra.
import json, os, sys, time
import numpy as np
from numba import njit, prange

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import PLY, REGISTO, RASCUNHO, grelha


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
def desenhar(starts, idx, ntx, nty, T, W, H, u, v, ca, cb, cc, op, z, rad, media, superficie, alpha):
    for t in prange(ntx * nty):
        tx = t % ntx
        ty = t // ntx
        px0 = tx * T
        py0 = ty * T
        px1 = min(W, px0 + T)
        py1 = min(H, py0 + T)
        Z = np.zeros((T, T), np.float32)
        S = np.full((T, T), np.nan, np.float32)
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
                    Z[py - py0, px - px0] += tr * a * z[i]
                    novo = tr * (1.0 - a)
                    # A superfície é a da mancha que faz o que está por
                    # cima passar a tapar mais de metade.
                    if tr >= 0.5 and novo < 0.5:
                        S[py - py0, px - px0] = z[i]
                    Tr[py - py0, px - px0] = novo
                    if novo < 1e-4:
                        vivos -= 1
        for py in range(py0, py1):
            for px in range(px0, px1):
                a = 1.0 - Tr[py - py0, px - px0]
                alpha[py, px] = a
                media[py, px] = Z[py - py0, px - px0] / a if a > 1e-6 else np.nan
                superficie[py, px] = S[py - py0, px - px0]


def main():
    t0 = time.time()
    E0, N1, p, W, H = grelha()
    reg = json.load(open(REGISTO))
    s, Rm, tt = reg["s"], np.array(reg["R"]), np.array(reg["t"])
    r00, r01, r10, r11 = Rm[0, 0], Rm[0, 1], Rm[1, 0], Rm[1, 1]
    print("grelha %d x %d, %.3f m de Mercator por ponto" % (W, H, p), flush=True)

    with open(PLY, "rb") as f:
        cabeca = f.read(8000)
    fim = cabeca.find(b"end_header\n") + len(b"end_header\n")
    linhas = cabeca[:fim].split(b"\n")
    props = [l.split()[-1].decode() for l in linhas if l.startswith(b"property")]
    n = int([l for l in linhas if l.startswith(b"element vertex")][0].split()[-1])
    ix = {q: i for i, q in enumerate(props)}
    mm = np.memmap(PLY, dtype=np.float32, mode="r", offset=fim, shape=(n, len(props)))
    print("%d manchas" % n, flush=True)

    # Por mancha, só o que o desenho a pique precisa, já na grelha.
    campos = ("u", "v", "z", "op", "ca", "cb", "cc", "rad")
    arr = {c: np.lib.format.open_memmap(os.path.join(RASCUNHO, "m_%s.npy" % c), "w+", np.float32, (n,)) for c in campos}
    usadas = 0
    BLOCO = 1_000_000
    for a in range(0, n, BLOCO):
        b = min(n, a + BLOCO)
        d = np.array(mm[a:b])
        op = 1 / (1 + np.exp(-d[:, ix["opacity"]].astype(np.float64)))
        q = d[:, [ix["rot_0"], ix["rot_1"], ix["rot_2"], ix["rot_3"]]].astype(np.float64)
        q /= np.linalg.norm(q, axis=1, keepdims=True) + 1e-12
        w, x, y, zq = q.T
        sc = np.exp(d[:, [ix["scale_0"], ix["scale_1"], ix["scale_2"]]].astype(np.float64))
        # As duas primeiras linhas da rotação, vezes a escala: chegam para a
        # covariância no plano horizontal.
        R0 = np.stack([1 - 2 * (y * y + zq * zq), 2 * (x * y - w * zq), 2 * (x * zq + w * y)], 1) * sc
        R1 = np.stack([2 * (x * y + w * zq), 1 - 2 * (x * x + zq * zq), 2 * (y * zq - w * x)], 1) * sc
        Sxx, Sxy, Syy = (R0 * R0).sum(1), (R0 * R1).sum(1), (R1 * R1).sum(1)
        X = d[:, ix["x"]].astype(np.float64)
        Y = d[:, ix["y"]].astype(np.float64)
        E = s * (r00 * X + r01 * Y) + tt[0]
        N = s * (r10 * X + r11 * Y) + tt[1]
        nxx = s * s * (r00 * r00 * Sxx + 2 * r00 * r01 * Sxy + r01 * r01 * Syy)
        nxy = s * s * (r00 * r10 * Sxx + (r00 * r11 + r01 * r10) * Sxy + r01 * r11 * Syy)
        nyy = s * s * (r10 * r10 * Sxx + 2 * r10 * r11 * Sxy + r11 * r11 * Syy)
        u = (E - E0) / p
        v = (N1 - N) / p
        A = nxx / p ** 2 + 0.3
        B = -nxy / p ** 2             # o eixo das linhas aponta para sul
        C = nyy / p ** 2 + 0.3
        det = A * C - B * B
        tr = 0.5 * (A + C)
        lmax = tr + np.sqrt(np.maximum(tr * tr - det, 0))
        k = np.sqrt(np.clip(2 * np.log(np.maximum(op * 255.0, 1.0)), 0, 9.0))
        rad = np.ceil(k * np.sqrt(lmax))
        ok = (op >= 1 / 255) & (rad > 0) & (u + rad >= 0) & (u - rad < W) & (v + rad >= 0) & (v - rad < H)
        m = int(ok.sum())
        for c, val in (("u", u), ("v", v), ("z", d[:, ix["z"]]), ("op", op), ("ca", C / det),
                       ("cb", -B / det), ("cc", A / det), ("rad", rad)):
            arr[c][usadas:usadas + m] = val[ok]
        usadas += m
        print("  %d/%d lidas, %d na grelha (%.0fs)" % (b, n, usadas, time.time() - t0), flush=True)

    # De cima para baixo, como se vê do drone.
    ordem = np.argsort(-np.asarray(arr["z"][:usadas]), kind="stable")
    pronto = {}
    for c in campos:
        pronto[c] = np.ascontiguousarray(np.asarray(arr[c][:usadas])[ordem])
    del ordem, arr
    for c in campos:
        try:
            os.remove(os.path.join(RASCUNHO, "m_%s.npy" % c))
        except OSError:
            pass
    print("ordenadas (%.0fs)" % (time.time() - t0), flush=True)

    u, v, rad = pronto["u"], pronto["v"], pronto["rad"]
    media = np.full((H, W), np.nan, np.float32)
    superficie = np.full((H, W), np.nan, np.float32)
    cobertura = np.zeros((H, W), np.uint8)
    T = 128
    FAIXA = 512
    for b0 in range(0, H, FAIXA):
        b1 = min(H, b0 + FAIXA)
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
        me = np.empty((Hb, W), np.float32)
        su = np.empty((Hb, W), np.float32)
        al = np.empty((Hb, W), np.float32)
        desenhar(starts, idx, ntx, nty, T, W, Hb, bu, bv, pronto["ca"][m], pronto["cb"][m], pronto["cc"][m],
                 pronto["op"][m], pronto["z"][m], br, me, su, al)
        media[b0:b1] = me
        superficie[b0:b1] = su
        cobertura[b0:b1] = np.clip(al * 255 + 0.5, 0, 255).astype(np.uint8)
        del idx, starts, m, bu, bv, br, me, su, al
        print("  faixa %d/%d (%.0fs)" % (b1, H, time.time() - t0), flush=True)

    np.save(os.path.join(RASCUNHO, "media.npy"), media)
    np.save(os.path.join(RASCUNHO, "superficie.npy"), superficie)
    np.save(os.path.join(RASCUNHO, "cobertura.npy"), cobertura)
    print("ok, em %s (%.0fs)" % (RASCUNHO, time.time() - t0))


if __name__ == "__main__":
    main()
