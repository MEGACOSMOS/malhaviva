# -*- coding: utf-8 -*-
"""
Prepara a panoramica do Olho de Aguia para servir de ceu ao bairro.

Faz duas coisas a imagem, de uma vez por todas, para nao custarem nada a
quem visita o site.

A primeira e corrigir-lhe a luz. A fotografia sai da maquina bem mais
escura do que o modelo do bairro, e era isso que denunciava o sitio onde
um acaba e a outra comeca. A conta e feita em luz linear, que e onde
aumentar o brilho e uma multiplicacao honesta: somar brilho ja em espaco
de ecra levanta os pretos e lava a imagem, que foi o erro da primeira
tentativa. A gama e o contraste vem depois, ja em espaco de ecra, que e
onde o olho os mede.

So se lhe corrige a luz, nao a cor: a mesma exposicao para os tres canais.
Chegou a experimentar-se impor a paleta do modelo canal a canal, medida
nas manchas do proprio ficheiro do splat, mas o que se media eram as cores
guardadas de cada mancha e nao a imagem composta que aparece no ecra - o
resultado saia com verdes fluorescentes e telhados rosados.

A segunda e embutir o desfoque, mais forte a medida que se desce. A metade
de baixo estica sem remedio, por a panoramica ter sido tirada de um ponto
so, e desfocada deixa de competir com o detalhe do modelo.

Como usar, a partir desta pasta:

    ffmpeg -i "HDRi - Preenchimento Generativo.exr"            -vf "scale=4096:2048:flags=lanczos" -pix_fmt rgb24 ceu-8bit.png
    python calibrar-ceu.py 130 62 1.08 3 48 2 ceu-olho-de-aguia-calibrado.jpg

Os numeros sao: brilho pretendido no terreno (0 a 255), contraste
pretendido, gama, desfoque junto ao horizonte, desfoque no fundo,
desfoque no ceu, e o nome do ficheiro a escrever.

O original de 228 MB esta na nuvem, em
https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/HDRi%20-%20Preenchimento%20Generativo.exr
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None

ALVO_LUM = float(sys.argv[1]) if len(sys.argv) > 1 else 135.0
ALVO_DESVIO = float(sys.argv[2]) if len(sys.argv) > 2 else 60.0
GAMA = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
DESF_HOR = float(sys.argv[4]) if len(sys.argv) > 4 else 3.0
DESF_FUNDO = float(sys.argv[5]) if len(sys.argv) > 5 else 48.0
DESF_CEU = float(sys.argv[6]) if len(sys.argv) > 6 else 2.0
SAIDA = sys.argv[7] if len(sys.argv) > 7 else 'ceu-v3.jpg'

def para_linear(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)

def para_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)

def contraste(x, k):
    if abs(k) < 1e-4:
        return x
    return np.clip(0.5 + np.tanh(k * (x - 0.5)) / np.tanh(k / 2.0) * 0.5, 0.0, 1.0)

def tratar(a, exposicao, k, gama):
    """A exposicao e feita em luz linear, que e onde ela e uma multiplicacao
    honesta: nao levanta os pretos nem lava a imagem. A gama e o contraste
    vem depois, ja em espaco de ecra, que e onde o olho os mede."""
    srgb = para_srgb(para_linear(a / 255.0) * exposicao)
    if abs(gama - 1.0) > 1e-4:
        srgb = np.power(np.clip(srgb, 0, 1), 1.0 / gama)
    return contraste(srgb, k) * 255.0

img = np.asarray(Image.open('ceu-8bit.png')).astype(np.float64)
h, w, _ = img.shape
linha = h // 2
cima, baixo = linha + int(h*12/180), linha + int(h*60/180)
amostra = img[cima:baixo]

def luminancia(a):
    return 0.299*a[...,0] + 0.587*a[...,1] + 0.114*a[...,2]

# Uma so exposicao para os tres canais: a fotografia mantem a sua cor, so
# se lhe corrige a luz. Procura-se a exposicao que acerta o brilho e o
# contraste que acerta o desvio.
exposicao, k = 1.0, 0.0
for _ in range(60):
    t = tratar(amostra, exposicao, k, GAMA)
    lum = luminancia(t)
    exposicao *= (ALVO_LUM / max(lum.mean(), 1e-3)) ** 1.2
    exposicao = min(exposicao, 80.0)
    k += float(np.clip((ALVO_DESVIO - lum.std()) / 70.0, -0.2, 0.2))
    k = float(np.clip(k, 0.0, 5.0))
t = tratar(amostra, exposicao, k, GAMA)
lum = luminancia(t)
print('exposicao %.2f   contraste %.3f   gama %.2f' % (exposicao, k, GAMA))
print('faixa do terreno: luminancia %.1f (alvo %.0f)   desvio %.1f (alvo %.0f)' % (
    lum.mean(), ALVO_LUM, lum.std(), ALVO_DESVIO))
print('cor media  R %.1f  G %.1f  B %.1f' % tuple(t.reshape(-1,3).mean(axis=0)))

corrigida = tratar(img, exposicao, k, GAMA)

def suave(a, b, x):
    tt = np.clip((x - a) / max(b - a, 1e-6), 0.0, 1.0)
    return tt * tt * (3 - 2 * tt)

v = (np.arange(h, dtype=np.float64) / (h - 1))[:, None, None]
peso = suave(0.42, 0.56, v)
img = np.clip(img * (1 - peso) + corrigida * peso, 0, 255)

def desfocar(a, raio):
    if raio <= 0.05:
        return a
    m = int(np.ceil(raio * 3))
    largo = np.concatenate([a[:, -m:], a, a[:, :m]], axis=1)
    return np.asarray(Image.fromarray(largo.astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(raio)), dtype=np.float64)[:, m:m + a.shape[1]]

leve, medio, forte = desfocar(img, DESF_CEU), desfocar(img, DESF_HOR), desfocar(img, DESF_FUNDO)
pm, pf = suave(0.40, 0.52, v), suave(0.55, 0.95, v)
saida = leve * (1 - pm) + medio * pm
saida = saida * (1 - pf) + forte * pf
Image.fromarray(np.clip(saida, 0, 255).astype(np.uint8)).save(SAIDA, quality=92, subsampling=0)
print('guardado em', SAIDA)
