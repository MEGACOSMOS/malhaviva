# -*- coding: utf-8 -*-
"""
Prepara a panoramica do Olho de Aguia para servir de ceu ao bairro.

O alvo nao e a fotografia ficar bonita, e ficar parecida com o bairro tal
como ele aparece desenhado no ecra - so assim a passagem de um para o
outro deixa de se notar. Os numeros em ALVO foram medidos assim: com o
mapa carregado, desliga-se o ceu, le-se a cor media do que fica no ecra, e
e essa a cor que a fotografia tem de imitar. Foi preciso chegar aqui por
tentativa: medir as cores guardadas nas manchas do modelo, como se fez
antes, da valores completamente diferentes dos que se veem pintados.

Sao tres coisas feitas a imagem, todas de uma vez por todas, para nao
custarem nada a quem visita:

 1. Exposicao por canal, feita em luz linear - onde aumentar o brilho e
    uma multiplicacao honesta. Somar brilho ja em espaco de ecra levanta
    os pretos e lava a imagem, que foi o erro da primeira tentativa.

 2. Cor puxada para tras. Uma fotografia e muito mais colorida do que uma
    reconstrucao em manchas: o modelo tem cerca de 14 por cento de
    saturacao e a fotografia tinha 23. Era esta a diferenca que mais
    denunciava a passagem, mais do que o brilho.

 3. Desfoque embutido, mais forte a medida que se desce. A metade de baixo
    estica sem remedio, por a panoramica ter sido tirada de um ponto so, e
    desfocada deixa de competir com o detalhe do modelo.

Como usar, a partir desta pasta:

    ffmpeg -i "HDRi - Preenchimento Generativo.exr"            -vf "scale=4096:2048:flags=lanczos" -pix_fmt rgb24 ceu-8bit.png
    python calibrar-ceu.py 0.5 48 1.0 4 56 3 ceu-olho-de-aguia-calibrado.jpg

Os numeros sao: quanto se puxa a cor para tras (1 = deixa como esta),
contraste pretendido, gama, desfoque junto ao horizonte, desfoque no
fundo, desfoque no ceu, e o nome do ficheiro a escrever.

O original de 228 MB esta na nuvem, em
https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/HDRi%20-%20Preenchimento%20Generativo.exr
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None

# Medido no ecra, com o mapa desenhado e o ceu desligado: e isto que a
# fotografia tem de imitar.
ALVO = np.array([126.6, 114.2, 109.6], dtype=np.float64)

SATURACAO = float(sys.argv[1]) if len(sys.argv) > 1 else 0.65
ALVO_DESVIO = float(sys.argv[2]) if len(sys.argv) > 2 else 55.0
GAMA = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
DESF_HOR = float(sys.argv[4]) if len(sys.argv) > 4 else 3.0
DESF_FUNDO = float(sys.argv[5]) if len(sys.argv) > 5 else 48.0
DESF_CEU = float(sys.argv[6]) if len(sys.argv) > 6 else 2.0
SAIDA = sys.argv[7] if len(sys.argv) > 7 else 'ceu-v4.jpg'

def para_linear(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)

def para_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)

def contraste(x, k):
    if abs(k) < 1e-4:
        return x
    return np.clip(0.5 + np.tanh(k * (x - 0.5)) / np.tanh(k / 2.0) * 0.5, 0.0, 1.0)

def lum(a):
    return 0.299*a[...,0] + 0.587*a[...,1] + 0.114*a[...,2]

def tratar(a, ganhos, k, gama, sat):
    # exposicao por canal em luz linear: acerta o brilho e a dominante
    srgb = para_srgb(para_linear(a / 255.0) * ganhos)
    if abs(gama - 1.0) > 1e-4:
        srgb = np.power(np.clip(srgb, 0, 1), 1.0 / gama)
    out = contraste(srgb, k) * 255.0
    # a fotografia e bem mais colorida do que o modelo: puxa-se a cor para
    # tras, aproximando cada pixel do seu proprio cinzento
    if abs(sat - 1.0) > 1e-4:
        cinza = lum(out)[..., None]
        out = cinza + (out - cinza) * sat
    return np.clip(out, 0, 255)

img = np.asarray(Image.open('ceu-8bit.png')).astype(np.float64)
h, w, _ = img.shape
linha = h // 2
cima, baixo = linha + int(h*12/180), linha + int(h*60/180)
amostra = img[cima:baixo]

ganhos = np.array([1.0, 1.0, 1.0])
k = 0.0
for _ in range(60):
    t = tratar(amostra, ganhos, k, GAMA, SATURACAO)
    medias = t.reshape(-1, 3).mean(axis=0)
    ganhos = np.clip(ganhos * (ALVO / np.maximum(medias, 1e-3)) ** 1.2, 0.01, 200.0)
    k += float(np.clip((ALVO_DESVIO - lum(t).std()) / 70.0, -0.2, 0.2))
    k = float(np.clip(k, 0.0, 5.0))

t = tratar(amostra, ganhos, k, GAMA, SATURACAO)
m = t.reshape(-1, 3).mean(axis=0)
def saturacao_media(a):
    x = a.reshape(-1, 3)
    return float(((x.max(axis=1) - x.min(axis=1)) / np.maximum(x.mean(axis=1), 1e-3)).mean())
print('ganhos %s  contraste %.2f  gama %.2f  saturacao %.2f' % (np.round(ganhos,2), k, GAMA, SATURACAO))
print('faixa: R %.1f G %.1f B %.1f  lum %.1f  desvio %.1f  saturacao %.0f%%' % (
    m[0], m[1], m[2], lum(t).mean(), lum(t).std(), 100*saturacao_media(t)))
print('alvo:  R %.1f G %.1f B %.1f  lum %.1f              saturacao ~14%%' % (
    ALVO[0], ALVO[1], ALVO[2], 0.299*ALVO[0]+0.587*ALVO[1]+0.114*ALVO[2]))

corrigida = tratar(img, ganhos, k, GAMA, SATURACAO)

def suave(a, b, x):
    tt = np.clip((x - a) / max(b - a, 1e-6), 0.0, 1.0)
    return tt * tt * (3 - 2 * tt)

v = (np.arange(h, dtype=np.float64) / (h - 1))[:, None, None]
peso = suave(0.42, 0.56, v)
img = np.clip(img * (1 - peso) + corrigida * peso, 0, 255)

def desfocar(a, raio):
    if raio <= 0.05:
        return a
    mm = int(np.ceil(raio * 3))
    largo = np.concatenate([a[:, -mm:], a, a[:, :mm]], axis=1)
    return np.asarray(Image.fromarray(largo.astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(raio)), dtype=np.float64)[:, mm:mm + a.shape[1]]

leve, medio, forte = desfocar(img, DESF_CEU), desfocar(img, DESF_HOR), desfocar(img, DESF_FUNDO)
pm, pf = suave(0.40, 0.52, v), suave(0.55, 0.95, v)
saida = leve * (1 - pm) + medio * pm
saida = saida * (1 - pf) + forte * pf
Image.fromarray(np.clip(saida, 0, 255).astype(np.uint8)).save(SAIDA, quality=92, subsampling=0)
print('guardado em', SAIDA)
