# Encaixa a vista a pique do modelo (coordenadas do PLY) na ortofoto do QGIS
# (EPSG:3857) com muitos pontos de controlo encontrados por correlação local.
import numpy as np, cv2, json, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

QX0, QY0, QRX, QRY = -1023489.7568, 4675967.6975, 0.49997724965389323, 0.5000158507603101
q = cv2.imread('qgis_full.png')
qg = cv2.cvtColor(q, cv2.COLOR_BGR2GRAY).astype(np.float32)

# vista do modelo a 0.39 m/px: bounds -300 300 -320 400 (ens_039.npy)
RX0, RY1, RR = -300.0, 400.0, 0.39
a = np.load('ens_039.npy')
alfa = a[..., 3].astype(np.float32) / 255
rg = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2GRAY).astype(np.float32)


def modelo_de_px(c, l):          # píxel da vista -> (X, Y) do modelo
    return RX0 + (c + 0.5) * RR, RY1 - (l + 0.5) * RR


def merc_de_qpx(c, l):
    return QX0 + c * QRX, QY0 - l * QRY


def qpx_de_merc(E, N):
    return (E - QX0) / QRX, (QY0 - N) / QRY


def ajustar_similaridade(P, Q):   # Q ≈ s R P + t (mínimos quadrados, Umeyama)
    mp, mq = P.mean(0), Q.mean(0)
    Pc, Qc = P - mp, Q - mq
    U, S, Vt = np.linalg.svd(Qc.T @ Pc)
    D = np.diag([1, np.sign(np.linalg.det(U @ Vt))])
    Rm = U @ D @ Vt
    s = (S * np.diag(D)).sum() / (Pc ** 2).sum()
    t = mq - s * Rm @ mp
    return s, Rm, t


# pontos iniciais (rotunda, bifurcação), medidos à mão
P0 = np.array([[-39.0, -253.0], [-233.0, 83.5]])
Q0 = np.array([merc_de_qpx(2543, 3097), merc_de_qpx(2003, 2217)])
s, Rm, t = ajustar_similaridade(P0, Q0)
print('inicial: escala %.4f merc-m/unid, rot %.2f°' % (s, np.degrees(np.arctan2(Rm[1, 0], Rm[0, 0]))))


def realcar(img):                 # gradientes: menos sensível à estação e à luz
    gx = cv2.Sobel(img, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(img, cv2.CV_32F, 0, 1, ksize=3)
    return cv2.GaussianBlur(np.sqrt(gx * gx + gy * gy), (0, 0), 1.0)


qe = realcar(cv2.GaussianBlur(qg, (0, 0), 0.7))
for volta in range(4):
    # matriz afim: píxel da vista -> píxel do QGIS
    def mapa(c, l):
        X, Y = modelo_de_px(c, l)
        E, N = s * (Rm @ np.array([X, Y])) + t
        return qpx_de_merc(E, N)
    o = np.array(mapa(0, 0)); cx = np.array(mapa(1, 0)) - o; cy = np.array(mapa(0, 1)) - o
    A = np.array([[cx[0], cy[0], o[0]], [cx[1], cy[1], o[1]]])
    H, W = qg.shape
    rw = cv2.warpAffine(rg, A, (W, H), flags=cv2.INTER_AREA if volta == 0 else cv2.INTER_LINEAR)
    aw = cv2.warpAffine(alfa, A, (W, H), flags=cv2.INTER_LINEAR)
    re_ = realcar(rw)
    PATCH, BUSCA = 80, 16 if volta else 50
    Pm, Qm, sc = [], [], []
    for y in range(BUSCA + PATCH, H - BUSCA - PATCH, 30):
        for x in range(BUSCA + PATCH, W - BUSCA - PATCH, 30):
            if aw[y - PATCH:y + PATCH, x - PATCH:x + PATCH].mean() < 0.9:
                continue
            tpl = re_[y - PATCH:y + PATCH, x - PATCH:x + PATCH]
            if tpl.std() < 4:
                continue
            win = qe[y - PATCH - BUSCA:y + PATCH + BUSCA, x - PATCH - BUSCA:x + PATCH + BUSCA]
            r = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
            _, mx, _, ml = cv2.minMaxLoc(r)
            if mx < 0.3:
                continue
            # segundo pico afastado: rejeita padrões repetidos
            r2 = r.copy(); cv2.circle(r2, ml, 6, -1, -1)
            if mx - r2.max() < 0.04:
                continue
            # ajuste subpíxel (parábola)
            px, py = ml
            dx = dy = 0.0
            if 0 < px < r.shape[1] - 1:
                d = r[py, px - 1] - 2 * r[py, px] + r[py, px + 1]
                dx = 0.5 * (r[py, px - 1] - r[py, px + 1]) / d if d < 0 else 0
            if 0 < py < r.shape[0] - 1:
                d = r[py - 1, px] - 2 * r[py, px] + r[py + 1, px]
                dy = 0.5 * (r[py - 1, px] - r[py + 1, px]) / d if d < 0 else 0
            qx = x + (px + dx - BUSCA)
            qy = y + (py + dy - BUSCA)
            # ponto do modelo correspondente ao centro do recorte (x, y) no QGIS
            E, N = merc_de_qpx(x, y)
            X, Y = (Rm.T @ ((np.array([E, N]) - t) / s))
            Pm.append((X, Y)); Qm.append(merc_de_qpx(qx, qy)); sc.append(mx)
    Pm, Qm = np.array(Pm), np.array(Qm)
    # RANSAC de similaridade em coordenadas métricas
    best = None
    rng = np.random.default_rng(1)
    for _ in range(4000):
        i, j = rng.choice(len(Pm), 2, replace=False)
        s_, R_, t_ = ajustar_similaridade(Pm[[i, j]], Qm[[i, j]])
        res = np.linalg.norm((s_ * (R_ @ Pm.T)).T + t_ - Qm, axis=1)
        n = (res < 1.5).sum()
        if best is None or n > best[0]:
            best = (n, res < 1.5)
    inl = best[1]
    s, Rm, t = ajustar_similaridade(Pm[inl], Qm[inl])
    res = np.linalg.norm((s * (Rm @ Pm.T)).T + t - Qm, axis=1)
    print('volta %d: pontos %d, inliers %d, escala %.5f merc-m/unid, rot %.3f°, resíduo mediano %.2f merc-m'
          % (volta, len(Pm), inl.sum(), s, np.degrees(np.arctan2(Rm[1, 0], Rm[0, 0])), np.median(res[inl])))

json.dump(dict(s=s, R=Rm.tolist(), t=t.tolist(), P=Pm[inl].tolist(), Q=Qm[inl].tolist()), open('registo.json', 'w'))
