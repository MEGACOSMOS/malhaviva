# O ortofotomapa aos bocados, para o mapa da navegação.
#
# O GeoTIFF tem 90 MB: não se pode mandar inteiro a um telemóvel. Aqui é
# cortado nos mesmos quadrados de 256 × 256 que os mapas de satélite usam
# (os "mosaicos" da Web Mercator, nível a nível), e o mapa só pede os que
# estão à vista. O ortofotomapa já está na Web Mercator, por isso cada
# quadrado é só um recorte, sem deformar nada.
#
# A beira do ortofotomapa desvanece em 3 metros, para assentar na
# fotografia de satélite que fica por baixo sem se ver um corte.
#
#     python -P scripts/navegacao/mosaicos.py
#
# Grava public/navegacao/ortofoto/{z}/{x}/{y}.webp, do nível 16 (o bairro
# todo num quadrado) ao 22 (cerca de 3 cm por ponto no chão, quase os 2,5
# do ortofotomapa), e
# public/navegacao/ortofoto/indice.json com a lista dos que existem — os que
# cairiam fora do ortofotomapa não são feitos, e o mapa não os pede.
import json, math, os, shutil, sys, time
import numpy as np
import cv2
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import Window
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import ORTOFOTO, SAIDA

PASTA = os.path.join(SAIDA, "ortofoto")
MASCARA = os.path.join(os.path.dirname(ORTOFOTO), "processo", "mascara.json")
NIVEIS = range(16, 23)
LADO = 256
MUNDO = 2 * math.pi * 6378137.0
ORIGEM = MUNDO / 2
DESVANECER_M = 3.0
QUALIDADE = 74


def main():
    t0 = time.time()
    os.makedirs(PASTA, exist_ok=True)
    # Os que já lá estão são escritos por cima; os que deixarem de fazer
    # falta saem no fim. (Apagar a pasta inteira primeiro falhava às vezes
    # no Windows: uma pasta acabada de esvaziar ainda presa por alguém.)
    feitos_agora = set()

    # A beira do ortofotomapa, desenhada a 25 cm e esbatida para dentro.
    m = json.load(open(MASCARA))
    E, N = np.array(m["E"]), np.array(m["N"])
    RES = 0.25
    e0, n1 = E.min() - 10, N.max() + 10
    w = int((E.max() + 10 - e0) / RES) + 1
    h = int((n1 - (N.min() - 10)) / RES) + 1
    dentro = np.zeros((h, w), np.uint8)
    poli = np.stack([(E - e0) / RES, (n1 - N) / RES], 1)
    cv2.fillPoly(dentro, [np.round(poli * 16).astype(np.int32).reshape(-1, 1, 2)], 1, cv2.LINE_AA, shift=4)
    lat = math.degrees(2 * math.atan(math.exp(N.mean() / 6378137.0)) - math.pi / 2)
    no_chao = math.cos(math.radians(lat))
    dist = cv2.distanceTransform(dentro, cv2.DIST_L2, 5) * RES * no_chao
    x = np.clip(dist / DESVANECER_M, 0, 1)
    alfa_global = (x * x * (3 - 2 * x)).astype(np.float32)

    indice = {}
    total = 0
    with rasterio.open(ORTOFOTO) as d:
        t = d.transform
        L, T, P = t.c, t.f, t.a
        R, Bm = L + P * d.width, T - P * d.height
        for z in NIVEIS:
            tam = MUNDO / 2 ** z
            res = tam / LADO
            x0, x1 = int((L + ORIGEM) // tam), int((R + ORIGEM) // tam)
            y0, y1 = int((ORIGEM - T) // tam), int((ORIGEM - Bm) // tam)
            feitos = []
            for tx in range(x0, x1 + 1):
                for ty in range(y0, y1 + 1):
                    esq = tx * tam - ORIGEM
                    cima = ORIGEM - ty * tam
                    # o alfa do quadrado, tirado da beira esbatida
                    cx = (esq + (np.arange(LADO) + 0.5) * res - e0) / RES
                    cy = (n1 - (cima - (np.arange(LADO) + 0.5) * res)) / RES
                    mx, my = np.meshgrid(cx.astype(np.float32), cy.astype(np.float32))
                    alfa = cv2.remap(alfa_global, mx, my, cv2.INTER_LINEAR, borderValue=0)
                    if alfa.max() <= 0.004:
                        continue
                    # a parte do quadrado que o ortofotomapa cobre, em pontos inteiros do quadrado
                    px0 = max(0, int(math.ceil((L - esq) / res - 1e-6)))
                    px1 = min(LADO, int(math.floor((R - esq) / res + 1e-6)))
                    py0 = max(0, int(math.ceil((cima - T) / res - 1e-6)))
                    py1 = min(LADO, int(math.floor((cima - Bm) / res + 1e-6)))
                    if px1 <= px0 or py1 <= py0:
                        continue
                    jan = Window((esq + px0 * res - L) / P, (T - (cima - py0 * res)) / P,
                                 (px1 - px0) * res / P, (py1 - py0) * res / P)
                    rgb = d.read(window=jan, out_shape=(3, py1 - py0, px1 - px0), resampling=Resampling.average)
                    msk = d.read_masks(1, window=jan, out_shape=(py1 - py0, px1 - px0), resampling=Resampling.average)
                    img = np.zeros((LADO, LADO, 4), np.uint8)
                    img[py0:py1, px0:px1, :3] = np.moveaxis(rgb, 0, 2)
                    a = np.zeros((LADO, LADO), np.float32)
                    a[py0:py1, px0:px1] = msk / 255.0
                    a = np.clip(a * alfa, 0, 1)
                    if a.max() <= 0.004:
                        continue
                    img[..., 3] = np.round(a * 255).astype(np.uint8)
                    pasta = os.path.join(PASTA, str(z), str(tx))
                    os.makedirs(pasta, exist_ok=True)
                    destino = os.path.join(pasta, "%d.webp" % ty)
                    if img[..., 3].min() == 255:
                        Image.fromarray(img[..., :3]).save(destino, "WEBP", quality=QUALIDADE, method=5)
                    else:
                        # o que está fora fica preto e transparente: comprime melhor
                        img[..., :3][img[..., 3] == 0] = 0
                        Image.fromarray(img, "RGBA").save(destino, "WEBP", quality=QUALIDADE, method=5, alpha_quality=70)
                    feitos.append([tx, ty])
                    feitos_agora.add(os.path.normcase(os.path.abspath(destino)))
            indice[z] = feitos
            total += len(feitos)
            print("nível %d: %d quadrados (%.0fs)" % (z, len(feitos), time.time() - t0), flush=True)
    with open(os.path.join(PASTA, "indice.json"), "w") as f:
        json.dump(dict(niveis=[min(NIVEIS), max(NIVEIS)], quadrados=indice), f, separators=(",", ":"))
    for raiz, pastas, ficheiros in os.walk(PASTA, topdown=False):
        for f in ficheiros:
            caminho = os.path.normcase(os.path.abspath(os.path.join(raiz, f)))
            if f.endswith(".webp") and caminho not in feitos_agora:
                os.remove(caminho)
        if raiz != PASTA and not os.listdir(raiz):
            shutil.rmtree(raiz, ignore_errors=True)
    tam = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(PASTA) for f in fs)
    print("ok: %d quadrados, %.1f MB (%.0fs)" % (total, tam / 2 ** 20, time.time() - t0))


if __name__ == "__main__":
    main()
