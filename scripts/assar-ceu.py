# -*- coding: utf-8 -*-
"""
Assa a panoramica do Olho de Aguia com a cor ja embutida.

A vista do alto do bairro esta no site em dois ficheiros:

  - public/olho-de-aguia-360.jpg - a paragem 360 do Olho de Aguia. E o que
    este guiao escreve.
  - public/ceu-olho-de-aguia.jpg - o ceu que envolve o bairro (a cupula).
    Este guiao NAO lhe toca. E a imagem tal como estava antes de
    2026-11-12, feita com as contas antigas, e fica assim por pedido: "A
    cupula nao deve mudar de cores, apenas o olho de aguia". A cor dela foi
    afinada a olho contra o bairro, com essa imagem (ver AJUSTES_PADRAO em
    public/ceu-fotografia.mjs).

As contas sao feitas uma so vez, a partir do original de doze mil pontos
de largura e em virgula flutuante, e o resultado e guardado numa imagem
so. Chega ao visitante ja pronto: sem bandas e sem contas a fazer.

O original esta em luz linear
-----------------------------

O ficheiro .exr guarda a luz tal como ela e - "linear" -, e nao ja
preparada para o ecra, como um JPG. Foi montado no Hugin a partir das
fotografias do drone (Brutos\\JPG), e nao diz que cores usa, o que no
formato quer dizer as cores normais de ecra (as do sRGB e da alta
definicao, Rec. 709). Ate 2026-11-12 este guiao tratava-o como se fosse
um JPG e passava-o duas vezes para luz linear (ceu azul-marinho, telhados
cor de sangue). Ver o historico do git para as versoes anteriores.

A cor: o LUT "1-Basic" da HH (desde 2026-11-17)
-----------------------------------------------

A cor da paragem e a do LUT "1-Basic" do pacote HH Cinematic Sony (pasta
HLG), o mesmo que se usou nos videos da visita da FAUL. Um LUT destes foi
feito para video filmado em HLG com as cores largas do BT.2020 (o "Read
me" do pacote: entrada "Rec. 2020 HLG", saida "Rec. 709"; na camara,
HLG3 com Color Mode BT2020). A fotografia nao foi filmada assim, por isso
primeiro e posta como se tivesse sido, e so depois passa pelo LUT:

  1. Das cores de ecra (709) para as cores largas (BT.2020), em luz
     linear. E uma conta de matriz: nao se perde nada.
  2. A cor (COR). Sozinho, o LUT deixava esta fotografia com 6/10 da cor
     da propria fotografia do drone: foi pensado para a cor de uma camara
     Sony, mais carregada do que a luz medida. A cor sobe aqui, em luz
     linear e a volta do cinzento de cada ponto, antes do LUT, como se a
     camara a tivesse dado.
  3. A exposicao. O branco da fotografia vai para o branco de referencia
     do HLG (75 %, ITU-R BT.2408), que e onde uma camara o poria, e dai
     sobe-se EXPOSICAO stops, em luz linear, que e onde a exposicao e
     honesta. Sem esta subida a imagem sai muito escura (o cinzento medio
     a 18 % em vez de 41 %): o LUT foi feito para video exposto mais claro
     do que o normal - o proprio pacote manda filmar com +0,3 a +0,7 - e
     so poe o cinzento medio no sitio quando ele chega ao HLG a 55 %. Nos
     videos da FAUL foi o mesmo (+0,15 a +1,2 stops).
  4. A curva HLG (ITU-R BT.2100), com um joelho: acima de JOELHO os altos
     encostam a 1 em vez de cortarem a seco.
  5. O LUT, com interpolacao tetraedrica (a mesma do ffmpeg, com que os
     videos foram feitos).
  6. Do ecra de video para o ecra da web. O LUT entrega a imagem para um
     ecra de video (Rec. 709 / ITU-R BT.1886, gama 2,4), que mostra as
     sombras mais fundas do que um navegador (sRGB). Passar os numeros tal
     e qual deixava as sombras levantadas, como um veu; aqui converte-se
     de um para o outro.
  7. Os pontos de negro e de branco (NEGRO, BRANCO): o mais claro que o
     LUT da fica pouco abaixo do branco, e o branco passa a ser BRANCO.
     Acima de 94 % os altos encostam ao branco devagar, como nos videos.

Os numeros foram escolhidos contra as fotografias do proprio drone (os JPG
de Brutos\\JPG, na exposicao do meio), projectando a panoramica em seis
das vistas delas: cinzentos, claros e escuros no mesmo sitio, e contraste
e cor a 0,97-0,98 das da camara. O EXR, por sua vez, foi conferido contra
os RAW (Brutos\\RAW): a luz dele e a do sensor, a menos de 8 %.

O JPG leva um pouco de ruido por baixo do ultimo degrau (sempre o mesmo)
para os degrades do ceu nao fazerem bandas.

Como usar, a partir da raiz do projecto:

    python scripts/assar-ceu.py              # escreve public/olho-de-aguia-360.jpg
    python scripts/assar-ceu.py outro.jpg    # escreve noutro sitio, para comparar

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
# O LUT. Fica fora do repositorio: e de um pacote comprado, nao se publica.
LUT_HH = r"C:\Users\malve\Videos\Malha Viva\Vídeo\Cor\Correção\HH-CINEMATIC-SONY-LUT-PACK\HLG\1-Basic LUT.cube"
# So a paragem do Olho de Aguia; o ceu do bairro fica como esta.
SAIDA = os.path.join('public', 'olho-de-aguia-360.jpg')

# Largura da imagem a escrever. E a largura com que o site trabalha o ceu
# antes de o arrumar nas seis faces do cubo: mais do que isto seria peso
# de mais na ligacao para nao se ver diferenca nenhuma no ecra.
LARGURA = 4096

ACERTOS = {
    # Quanto sobe a cor, em luz linear, antes do LUT (ponto 2 acima).
    'cor': 1.5,
    # Stops a mais, em luz linear, antes do LUT (ponto 3).
    'exposicao': 1.5,
    # Codigo HLG a partir do qual os altos encostam a 1 (ponto 4).
    'joelho': 0.90,
    # Pontos de negro e de branco, ja no ecra da web (ponto 7).
    'negro': 0.01,
    'branco': 0.95,
}

# O peso de cada cor primaria na luz, nas cores largas (ITU-R BT.2020).
PESOS_2020 = np.array([0.2627, 0.6780, 0.0593], dtype=np.float32)

# Das cores de ecra (Rec. 709) para as do BT.2020, em luz linear (ITU-R BT.2087).
DE_709_PARA_2020 = np.array([
    [0.6274040, 0.3292820, 0.0433136],
    [0.0690970, 0.9195400, 0.0113612],
    [0.0163916, 0.0880132, 0.8955950],
], dtype=np.float32)

# A curva HLG (ITU-R BT.2100).
HLG_A = 0.17883277
HLG_B = 1.0 - 4.0 * HLG_A
HLG_C = 0.5 - HLG_A * np.log(4.0 * HLG_A)
# A luz que o HLG poe a 75 %: o branco de referencia (ITU-R BT.2408).
BRANCO_HLG = (np.exp((0.75 - HLG_C) / HLG_A) + HLG_B) / 12.0


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


def trazer_original(largura):
    """
    Traz o original para virgula flutuante, no tamanho pedido (reduzido em
    luz linear).

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
    return np.stack([vermelho, verde, azul], axis=-1).astype(np.float32)


def ler_cube(caminho):
    """Le um LUT .cube 3D. Devolve [azul, verde, vermelho, canal]: no .cube o vermelho varia mais depressa."""
    tamanho, linhas = None, []
    with open(caminho, encoding='utf-8', errors='replace') as f:
        for linha in f:
            s = linha.strip()
            if not s or s[0] == '#':
                continue
            if s.startswith('LUT_3D_SIZE'):
                tamanho = int(s.split()[1])
            elif s.startswith('DOMAIN_MIN') or s.startswith('DOMAIN_MAX'):
                valores = [float(v) for v in s.split()[1:]]
                esperado = [0.0] * 3 if s.startswith('DOMAIN_MIN') else [1.0] * 3
                if valores != esperado:
                    sys.exit('O LUT tem um dominio que este guiao nao conhece: ' + s)
            elif s[0].isalpha():
                continue
            else:
                linhas.append([float(v) for v in s.split()])
    lut = np.asarray(linhas, dtype=np.float32)
    if tamanho is None or lut.shape != (tamanho ** 3, 3):
        sys.exit('O LUT nao tem o tamanho que diz ter.')
    return lut.reshape(tamanho, tamanho, tamanho, 3)


def lut_tetraedrico(rgb, lut):
    """Interpolacao tetraedrica, a mesma do lut3d do ffmpeg. rgb [..., 3] entre 0 e 1."""
    n = lut.shape[0]
    x = np.clip(rgb, 0.0, 1.0) * (n - 1)
    i0 = np.minimum(x.astype(np.int32), n - 2)
    f = (x - i0).astype(np.float32)
    r0, g0, b0 = i0[..., 0], i0[..., 1], i0[..., 2]
    fr, fg, fb = f[..., 0:1], f[..., 1:2], f[..., 2:3]

    def canto(dr, dg, db):
        return lut[b0 + db, g0 + dg, r0 + dr]

    c000, c111 = canto(0, 0, 0), canto(1, 1, 1)
    c100, c010, c001 = canto(1, 0, 0), canto(0, 1, 0), canto(0, 0, 1)
    c110, c101, c011 = canto(1, 1, 0), canto(1, 0, 1), canto(0, 1, 1)
    rg, gb, rb, bg, br = fr > fg, fg > fb, fr > fb, fb > fg, fb > fr
    casos = [
        rg & gb, rg & ~gb & rb, rg & ~gb & ~rb,
        ~rg & bg, ~rg & ~bg & br, ~rg & ~bg & ~br,
    ]
    valores = [
        (1 - fr) * c000 + (fr - fg) * c100 + (fg - fb) * c110 + fb * c111,
        (1 - fr) * c000 + (fr - fb) * c100 + (fb - fg) * c101 + fg * c111,
        (1 - fb) * c000 + (fb - fr) * c001 + (fr - fg) * c101 + fg * c111,
        (1 - fb) * c000 + (fb - fg) * c001 + (fg - fr) * c011 + fr * c111,
        (1 - fg) * c000 + (fg - fb) * c010 + (fb - fr) * c011 + fr * c111,
        (1 - fg) * c000 + (fg - fr) * c010 + (fr - fb) * c110 + fb * c111,
    ]
    return np.select([np.broadcast_to(m, valores[0].shape) for m in casos], valores).astype(np.float32)


def para_hlg(luz):
    """A curva HLG (BT.2100): luz linear da cena (0 a 1) para o sinal (0 a 1)."""
    luz = np.clip(luz, 0.0, None)
    baixo = np.sqrt(3.0 * luz)
    alto = HLG_A * np.log(np.maximum(12.0 * luz - HLG_B, 1e-9)) + HLG_C
    return np.where(luz <= 1.0 / 12.0, baixo, alto).astype(np.float32)


def do_video_para_a_web(x):
    """Ponto 6: de Rec. 709 visto num ecra de video (BT.1886, gama 2,4) para sRGB."""
    luz = np.power(np.clip(x, 0.0, 1.0), 2.4)
    return np.where(luz <= 0.0031308, 12.92 * luz, 1.055 * np.power(luz, 1 / 2.4) - 0.055)


def como_se_fosse_hlg(linear, acertos=ACERTOS):
    """Pontos 1 a 4: da luz linear (709) ao sinal que o LUT espera (HLG, BT.2020)."""
    largas = np.clip(linear, 0.0, None) @ DE_709_PARA_2020.T
    cinzento = (largas @ PESOS_2020)[..., None]
    largas = np.clip(cinzento + (largas - cinzento) * acertos['cor'], 0.0, None)
    sinal = para_hlg(largas * (BRANCO_HLG * 2.0 ** acertos['exposicao']))
    k = acertos['joelho']
    if k < 1.0:
        sinal = np.where(sinal > k, k + (1 - k) * np.tanh((sinal - k) / (1 - k)), sinal)
    return sinal.astype(np.float32)


def tratar(linear, lut, acertos=ACERTOS, bloco=256):
    """Da luz linear ao ecra, com o LUT. Aos bocados, para caber na memoria."""
    saida = np.empty_like(linear, dtype=np.float32)
    negro, branco = acertos['negro'], acertos['branco']
    for i in range(0, linear.shape[0], bloco):
        x = lut_tetraedrico(como_se_fosse_hlg(linear[i:i + bloco], acertos), lut)
        x = do_video_para_a_web(x)
        # Ponto 7: os pontos de negro e de branco, e os altos a encostar ao branco devagar.
        x = (x - negro) / (branco - negro)
        x = np.where(x > 0.94, 0.94 + 0.06 * np.tanh((x - 0.94) / 0.06), x)
        saida[i:i + bloco] = np.clip(x, 0.0, 1.0)
    return saida


def confirmar_que_esta_direita(imagem):
    """O ceu tem de estar em cima: o quarto de cima e mais azul do que o de baixo."""
    quarto = imagem.shape[0] // 4
    cima = imagem[:quarto].reshape(-1, 3).mean(0)
    baixo = imagem[-quarto:].reshape(-1, 3).mean(0)
    if cima[2] - cima[0] <= baixo[2] - baixo[0]:
        sys.exit('A imagem saiu de pernas para o ar - nada foi escrito.')


def escrever(imagem, caminho, qualidade=88):
    # Ruido triangular de um degrau por baixo do arredondamento, sempre o
    # mesmo (semente fixa), para os degrades nao fazerem bandas.
    rng = np.random.default_rng(2026)
    ruido = rng.random(imagem.shape, dtype=np.float32) + rng.random(imagem.shape, dtype=np.float32) - 1.0
    pontos = np.clip(np.rint(imagem * 255.0 + ruido), 0, 255).astype(np.uint8)
    Image.fromarray(pontos, 'RGB').save(caminho, quality=qualidade, subsampling=0, optimize=True)


def main():
    saida = sys.argv[1] if len(sys.argv) > 1 else SAIDA
    print('A trazer o original a %d pontos de largura...' % LARGURA)
    imagem = trazer_original(LARGURA)
    confirmar_que_esta_direita(imagem)
    print('A aplicar o LUT (%s)...' % os.path.basename(LUT_HH))
    tratada = tratar(imagem, ler_cube(LUT_HH))
    print('A escrever %s...' % saida)
    escrever(tratada, saida)
    tamanho = os.path.getsize(saida) / (1024 * 1024)
    print('Pronto: %s (%.1f MB)' % (saida, tamanho))


if __name__ == '__main__':
    main()
