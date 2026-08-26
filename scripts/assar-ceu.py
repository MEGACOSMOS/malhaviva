# -*- coding: utf-8 -*-
"""
Assa a panoramica do Olho de Aguia com os acertos ja embutidos.

O ceu do bairro era a fotografia tal como saiu, e os acertos de luz e cor
eram feitos no navegador, a cada visita, a partir dos numeros do editor.
Isso tinha dois problemas. Um: os acertos eram feitos por cima de uma
imagem ja reduzida a 256 tons por canal, e uma exposicao de quase cinco
vezes esticada sobre 256 degraus deixa bandas a vista. Dois: tudo o que
passava do branco era cortado a direito, e o ceu ficava uma mancha chapada
sem desenho nenhum - "estourado".

Aqui as mesmas contas sao feitas uma so vez, a partir do original de doze
mil pontos de largura e em virgula flutuante, e o resultado e guardado numa
imagem so. Chega ao visitante ja pronto: sem bandas, sem contas a fazer, e
com os altos recuperados.

O que muda em relacao ao que o editor fazia:

  - A exposicao continua a ser uma multiplicacao em luz linear, que e onde
    ela e honesta.
  - Mas em vez de cortar a direito no branco, ha um joelho: ate ao valor
    ESCOLHIDO nada muda - fica igualzinho ao que se afinou no editor - e
    dai para cima os valores vao encostando ao branco sem nunca la chegar
    de repente. E a diferenca entre um ceu chapado e um ceu com desenho.
  - Gama, contraste e cor vem a seguir, pela mesma ordem e com as mesmas
    formulas do editor, para o resultado ser o que se viu ao afinar.

Como usar, a partir da raiz do projecto:

    python scripts/assar-ceu.py

Os numeros vivem em ACERTOS. Se um dia forem afinados outra vez no editor
do menu de desenvolvedor, escrevem-se aqui e volta-se a correr o guiao.
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

# O original, em virgula flutuante, com 12272 x 6136 pontos.
ORIGINAL = r"C:\Users\malve\Videos\Malha Viva\Imagens\HDRi\HDRi - Preenchimento Generativo.exr"
FFMPEG = r"C:\Users\malve\AppData\Local\Programs\Stremio\ffmpeg.exe"
SAIDA = os.path.join('public', 'ceu-olho-de-aguia.jpg')

# Largura da imagem a escrever. E a largura com que o site trabalha o ceu
# antes de o arrumar nas seis faces do cubo: mais do que isto seria peso
# de mais na ligacao para nao se ver diferenca nenhuma no ecra.
LARGURA = 4096

# Os acertos, tal como foram afinados no editor.
ACERTOS = {
    'exposicao': 4.75,
    'gama': 1.06,
    'contraste': 1.55,
    'saturacao': 1.13,
}

# A partir de que ponto os altos comecam a encostar ao branco, em luz
# linear e ja depois da exposicao. Abaixo disto a imagem fica exactamente
# como o editor a deixava; acima, em vez de chapar, ganha desenho.
JOELHO = 0.5


def para_linear(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def para_ecra(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def encostar_ao_branco(y, joelho=JOELHO):
    """Deixa os valores baixos como estao e curva os altos para o branco."""
    if joelho >= 1.0:
        return np.clip(y, 0.0, 1.0)
    alto = y > joelho
    saida = np.array(y, dtype=np.float64)
    margem = 1.0 - joelho
    saida[alto] = joelho + margem * (1.0 - np.exp(-(y[alto] - joelho) / margem))
    return np.clip(saida, 0.0, 1.0)


def ler_pfm(caminho):
    with open(caminho, 'rb') as f:
        cabecalho = f.readline().strip()
        assert cabecalho == b'PF', cabecalho
        largura, altura = map(int, f.readline().split())
        escala = float(f.readline())
        tipo = '<f4' if escala < 0 else '>f4'
        dados = np.frombuffer(f.read(), dtype=tipo)
    return dados.reshape(altura, largura, 3).astype(np.float64)


def trazer_original(largura, destino):
    """Traz o original para virgula flutuante, no tamanho pedido."""
    altura = largura // 2
    subprocess.run([
        FFMPEG, '-y', '-hide_banner', '-loglevel', 'error',
        '-i', ORIGINAL,
        '-vf', 'scale=%d:%d:flags=lanczos' % (largura, altura),
        '-pix_fmt', 'gbrpf32le', '-f', 'image2', '-c:v', 'pfm', destino,
    ], check=True)
    return ler_pfm(destino)


def tratar(imagem, acertos=ACERTOS, joelho=JOELHO):
    """As mesmas contas do editor, pela mesma ordem, mas em virgula flutuante."""
    x = np.clip(imagem, 0.0, 1.0)

    # 1. Exposicao em luz linear, com os altos a encostar ao branco.
    x = encostar_ao_branco(para_linear(x) * acertos['exposicao'], joelho)
    x = para_ecra(x)

    # 2. Gama, em espaco de ecra.
    gama = acertos['gama']
    if abs(gama - 1.0) > 1e-4:
        x = np.power(x, 1.0 / gama)

    # 3. Contraste, com a mesma curva em S do editor.
    k = acertos['contraste']
    if k > 1e-4:
        x = 0.5 + np.tanh(k * (x - 0.5)) / np.tanh(k / 2) * 0.5

    # 4. Cor, sempre por ultimo.
    sat = acertos['saturacao']
    if abs(sat - 1.0) > 1e-4:
        cinzento = (0.299 * x[..., 0] + 0.587 * x[..., 1] + 0.114 * x[..., 2])[..., None]
        x = cinzento + (x - cinzento) * sat

    return np.clip(x, 0.0, 1.0)


def escrever(imagem, caminho, qualidade=88):
    pontos = np.rint(imagem * 255.0).astype(np.uint8)
    Image.fromarray(pontos, 'RGB').save(caminho, quality=qualidade, subsampling=0, optimize=True)


def main():
    pasta = os.environ.get('TEMP', '.')
    bruto = os.path.join(pasta, 'ceu-original-%d.pfm' % LARGURA)
    print('A trazer o original a %d pontos de largura...' % LARGURA)
    imagem = trazer_original(LARGURA, bruto)
    print('A aplicar os acertos...')
    tratada = tratar(imagem)
    print('A escrever %s...' % SAIDA)
    escrever(tratada, SAIDA)
    tamanho = os.path.getsize(SAIDA) / (1024 * 1024)
    print('Pronto: %s (%.1f MB)' % (SAIDA, tamanho))
    try:
        os.remove(bruto)
    except OSError:
        pass


if __name__ == '__main__':
    main()
