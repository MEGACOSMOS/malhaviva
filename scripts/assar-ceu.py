# -*- coding: utf-8 -*-
"""
Assa a panoramica do Olho de Aguia com os acertos ja embutidos.

A vista do alto do bairro esta no site em dois ficheiros:

  - public/olho-de-aguia-360.jpg - a paragem 360 do Olho de Aguia. E o que
    este guiao escreve.
  - public/ceu-olho-de-aguia.jpg - o ceu que envolve o bairro (a cupula).
    Este guiao NAO lhe toca. E a imagem tal como estava antes de
    2026-11-12, feita com as contas antigas (ver mais abaixo), e fica
    assim por pedido: "A cupula nao deve mudar de cores, apenas o olho de
    aguia". A cor dela foi afinada a olho contra o bairro, com essa imagem
    (ver AJUSTES_PADRAO em public/ceu-fotografia.mjs).

As contas sao feitas uma so vez, a partir do original de doze mil pontos
de largura e em virgula flutuante, e o resultado e guardado numa imagem
so. Chega ao visitante ja pronto: sem bandas, sem contas a fazer, e com os
altos a encostar ao branco em vez de chapar.

O original esta em luz linear
-----------------------------

O ficheiro .exr guarda a luz tal como ela e - "linear", diz o proprio
ficheiro -, e nao ja preparada para o ecra, como um JPG. Ate 2026-11-12
este guiao tratava-o como se fosse um JPG: passava-o outra vez para luz
linear, o que e fazer a mesma conta duas vezes. A imagem ficava muito
mais escura e muito mais carregada de cor do que a fotografia, e para a
trazer de volta era preciso uma exposicao de quase cinco vezes e um
contraste forte por cima. Dai o ceu azul-marinho em cima, a faixa ciano
junto ao horizonte, o sol num disco enorme e os telhados cor de sangue.

Agora a luz entra como esta, passa uma unica vez para o ecra, e os
acertos por cima sao poucos: o equilibrio de cor do original ja estava
certo (as estradas e o betao dao cinzento, a menos de 2 % de diferenca
entre canais), so lhe faltava um pouco de corpo.

A ordem das contas:

  - Exposicao em luz linear, que e onde ela e honesta, com um joelho: ate
    JOELHO nada muda, e dai para cima os valores vao encostando ao branco
    sem nunca la chegar de repente.
  - A passagem para o ecra (sRGB), uma vez so.
  - Gama, contraste e cor vem a seguir, com as mesmas formulas do editor
    do menu de desenvolvedor.

Como usar, a partir da raiz do projecto:

    python scripts/assar-ceu.py

Os numeros vivem em ACERTOS.
"""
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

# O original, em virgula flutuante e luz linear, com 12272 x 6136 pontos.
ORIGINAL = r"C:\Users\malve\Videos\Malha Viva\Imagens\HDRi\HDRi - Preenchimento Generativo.exr"
# Só a paragem do Olho de Aguia; o ceu do bairro fica como esta.
SAIDA = os.path.join('public', 'olho-de-aguia-360.jpg')

# Largura da imagem a escrever. E a largura com que o site trabalha o ceu
# antes de o arrumar nas seis faces do cubo: mais do que isto seria peso
# de mais na ligacao para nao se ver diferenca nenhuma no ecra.
LARGURA = 4096

# Os acertos por cima da fotografia. Sao pequenos de proposito: a cor do
# original ja esta certa, e isto so lhe da um pouco mais de corpo.
ACERTOS = {
    'exposicao': 1.1,
    'gama': 1.0,
    'contraste': 0.9,
    'saturacao': 1.1,
}

# A partir de que ponto os altos comecam a encostar ao branco, em luz
# linear e ja depois da exposicao.
JOELHO = 0.8


def achar_ffmpeg():
    """O ffmpeg que houver: o do sistema, o que vem com o Python, ou o do Stremio."""
    candidatos = [os.environ.get('FFMPEG'), shutil.which('ffmpeg')]
    try:
        import imageio_ffmpeg
        candidatos.append(imageio_ffmpeg.get_ffmpeg_exe())
    except Exception:
        pass
    candidatos.append(r"C:\Users\malve\AppData\Local\Programs\Stremio\ffmpeg.exe")
    for c in candidatos:
        if c and os.path.isfile(c):
            return c
    sys.exit('Nao encontrei o ffmpeg. Instale-o ou diga onde esta com FFMPEG=...')


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


def trazer_original(largura):
    """
    Traz o original para virgula flutuante, no tamanho pedido.

    Sai em pontos crus, plano a plano (verde, azul, vermelho) e de cima para
    baixo. Antes passava por um ficheiro PFM, mas esse formato guarda as
    linhas de baixo para cima e nem todas as versoes do ffmpeg o respeitam:
    com uma a imagem saia direita, com outra de pernas para o ar.
    """
    altura = largura // 2
    crus = subprocess.run([
        achar_ffmpeg(), '-hide_banner', '-loglevel', 'error',
        '-i', ORIGINAL,
        '-vf', 'scale=%d:%d:flags=lanczos' % (largura, altura),
        '-pix_fmt', 'gbrpf32le', '-f', 'rawvideo', '-',
    ], check=True, stdout=subprocess.PIPE).stdout
    planos = np.frombuffer(crus, dtype='<f4').reshape(3, altura, largura)
    verde, azul, vermelho = planos
    return np.stack([vermelho, verde, azul], axis=-1).astype(np.float64)


def tratar(linear, acertos=ACERTOS, joelho=JOELHO):
    """Da luz linear ao ecra, uma vez so, com os acertos por cima."""
    # 1. Exposicao em luz linear, com os altos a encostar ao branco, e a
    #    passagem para o ecra.
    x = np.clip(linear, 0.0, None)
    x = para_ecra(encostar_ao_branco(x * acertos['exposicao'], joelho))

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


def confirmar_que_esta_direita(imagem):
    """O ceu tem de estar em cima: o quarto de cima e mais azul do que o de baixo."""
    quarto = imagem.shape[0] // 4
    cima = imagem[:quarto].reshape(-1, 3).mean(0)
    baixo = imagem[-quarto:].reshape(-1, 3).mean(0)
    if cima[2] - cima[0] <= baixo[2] - baixo[0]:
        sys.exit('A imagem saiu de pernas para o ar - nada foi escrito.')


def escrever(imagem, caminho, qualidade=88):
    pontos = np.rint(imagem * 255.0).astype(np.uint8)
    Image.fromarray(pontos, 'RGB').save(caminho, quality=qualidade, subsampling=0, optimize=True)


def main():
    print('A trazer o original a %d pontos de largura...' % LARGURA)
    imagem = trazer_original(LARGURA)
    confirmar_que_esta_direita(imagem)
    print('A aplicar os acertos...')
    tratada = tratar(imagem)
    print('A escrever %s...' % SAIDA)
    escrever(tratada, SAIDA)
    tamanho = os.path.getsize(SAIDA) / (1024 * 1024)
    print('Pronto: %s (%.1f MB)' % (SAIDA, tamanho))


if __name__ == '__main__':
    main()
