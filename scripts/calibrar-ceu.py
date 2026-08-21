# -*- coding: utf-8 -*-
"""
Prepara a panorâmica do Olho de Águia para servir de céu ao bairro.

Faz duas coisas à imagem, de uma vez por todas, para não custarem nada a
quem visita o site:

 1. Acerta a cor pela paleta do modelo do bairro. Os valores em ALVO_MEDIA
    e ALVO_DESVIO foram medidos nas próprias manchas do modelo (o campo
    sh0 dos ficheiros em public/splat), mais de um milhão delas. A
    fotografia original é bem mais escura do que o modelo, e era isso que
    fazia saltar à vista o sítio onde um acaba e a outra começa. A
    correcção só entra a partir de pouco acima do horizonte: o azul lá em
    cima não tem nada a ver com o chão do bairro.

 2. Embute desfoque, mais forte à medida que se desce. A metade de baixo
    da fotografia estica sem remédio, por ter sido tirada de um ponto só,
    e desfocada deixa de competir com o detalhe do modelo.

Como usar, a partir desta pasta:

    ffmpeg -i "HDRi - Preenchimento Generativo.exr"            -vf "scale=4096:2048:flags=lanczos" -pix_fmt rgb24 ceu-8bit.png
    python calibrar-ceu.py 0.75 3 48 2 ceu-olho-de-aguia-calibrado.jpg

Os cinco números são: força da correcção de cor (1 = igualar por completo
a paleta do modelo), desfoque junto ao horizonte, desfoque no fundo,
desfoque no céu, e o nome do ficheiro a escrever.

O original de 228 MB está na nuvem, em
https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/HDRi%20-%20Preenchimento%20Generativo.exr
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None

# Paleta do modelo, medida nas manchas do próprio ficheiro (sh0).
ALVO_MEDIA = np.array([161.32, 167.81, 147.12], dtype=np.float32)
ALVO_DESVIO = np.array([72.53, 63.63, 81.12], dtype=np.float32)

# Até onde se puxa: 1 = igualar por completo a paleta do modelo.
FORCA = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
# Desfoque junto ao horizonte e no fundo, em pontos da imagem.
DESFOQUE_HORIZONTE = float(sys.argv[2]) if len(sys.argv) > 2 else 3.0
DESFOQUE_FUNDO = float(sys.argv[3]) if len(sys.argv) > 3 else 48.0
DESFOQUE_CEU = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0
SAIDA = sys.argv[5] if len(sys.argv) > 5 else 'ceu-calibrado.jpg'

def suave(borda0, borda1, x):
    t = np.clip((x - borda0) / max(borda1 - borda0, 1e-6), 0.0, 1.0)
    return t * t * (3 - 2 * t)

img = np.asarray(Image.open('ceu-8bit.png')).astype(np.float32)
h, w, _ = img.shape
linha = h // 2                      # o horizonte fica a meio
v = (np.arange(h, dtype=np.float32) / (h - 1))[:, None, None]

# --- Cor -------------------------------------------------------------------
# A referência é o terreno da fotografia: dos 12 aos 60 graus abaixo do
# horizonte, que é a faixa que fica encostada ao modelo.
faixa = img[linha + int(h*12/180): linha + int(h*60/180)]
media = faixa.reshape(-1, 3).mean(axis=0)
desvio = faixa.reshape(-1, 3).std(axis=0)

ganho = np.clip(ALVO_DESVIO / np.maximum(desvio, 1e-3), 0.7, 1.8)
corrigida = (img - media) * ganho + ALVO_MEDIA

# A correcção entra só a partir de pouco acima do horizonte: o azul lá em
# cima não tem nada a ver com o chão do bairro e deve ficar como está.
peso = suave(0.42, 0.56, v) * FORCA
img = img * (1 - peso) + corrigida * peso
img = np.clip(img, 0, 255)

# --- Desfoque --------------------------------------------------------------
# Três versões da imagem, misturadas por altura: pouco no céu, um pouco mais
# no horizonte, muito no fundo, que é onde a fotografia mais estica.
def desfocar(a, raio):
    if raio <= 0.05:
        return a
    margem = int(np.ceil(raio * 3))
    largo = np.concatenate([a[:, -margem:], a, a[:, :margem]], axis=1)  # dá a volta
    saida = np.asarray(
        Image.fromarray(largo.astype(np.uint8)).filter(ImageFilter.GaussianBlur(raio)),
        dtype=np.float32)
    return saida[:, margem:margem + a.shape[1]]

leve = desfocar(img, DESFOQUE_CEU)
medio = desfocar(img, DESFOQUE_HORIZONTE)
forte = desfocar(img, DESFOQUE_FUNDO)

peso_medio = suave(0.40, 0.52, v)
peso_forte = suave(0.55, 0.95, v)
saida = leve * (1 - peso_medio) + medio * peso_medio
saida = saida * (1 - peso_forte) + forte * peso_forte

Image.fromarray(np.clip(saida, 0, 255).astype(np.uint8)).save(SAIDA, quality=92, subsampling=0)

# --- Relatório -------------------------------------------------------------
final = np.asarray(Image.open(SAIDA)).astype(np.float32)
f2 = final[linha + int(h*12/180): linha + int(h*60/180)].reshape(-1, 3)
print('terreno antes  R %6.2f  G %6.2f  B %6.2f' % tuple(media))
print('terreno depois R %6.2f  G %6.2f  B %6.2f' % tuple(f2.mean(axis=0)))
print('modelo (alvo)  R %6.2f  G %6.2f  B %6.2f' % tuple(ALVO_MEDIA))
print('guardado em', SAIDA)
