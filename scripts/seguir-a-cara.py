# -*- coding: utf-8 -*-
"""
Segue a cara da Esvarena ao longo das rotas 360º e escreve o caminho que o
player usa para a manter ao meio da vista.

    python scripts/seguir-a-cara.py

A Esvarena é quem leva quem vê pelo bairro, e vai a andar ao lado de quem
filma: ao longo do caminho passa para a frente, fica para trás, vira-se
para apontar uma casa. Uma direcção fixa deixava-a sair do ecrã. Este
programa vê o filme uma vez, fora do site, encontra a cara dela em cada
meio segundo e guarda a direcção onde ela está em
`public/olhar-das-rotas.mjs`. O player lê esse caminho e vai sempre atrás
dela; quem arrasta a vista olha a partir de onde ela está (ver
`public/video360.html`).

Como procura: de meio em meio segundo abre uma janela larga na direcção
onde ela estava — a mesma conta do site (`public/previa-360.mjs`), porque
um detector de caras não percebe nada de uma imagem esticada de lado a
lado — e procura caras lá dentro. Fica com a que for grande (ela vai a um
metro da câmara; quem passa ao longe tem a cara pequena) e perto de onde
ela estava. Quando a perde de vista uns segundos, dá uma volta completa à
procura dela. No fim tira os solavancos: mediana de três para deitar fora
enganos de uma imagem só, e uma passagem suave para a vista deslizar em
vez de tremer.

Volta a correr-se se uma rota for remontada. Os nomes das rotas, o sítio
dos vídeos e o `OLHAR_INICIAL` de cada uma são lidos de
`public/videos.mjs`, para não haver duas listas a dizer coisas diferentes:
é de lá que a busca parte, e é esse olhar inicial que fica a ser o
primeiro ponto do caminho — assim a rota abre exactamente na imagem que o
marcador mostrava no mapa, e só depois começa a andar atrás dela.

Precisa do ffmpeg no PATH e de `pip install numpy pillow opencv-python`.
O detector (YuNet, 232 KB, do opencv_zoo) é descarregado à primeira vez
para `scripts/yunet.onnx`.
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
MODELO = AQUI / "yunet.onnx"
MODELO_DE = ("https://media.githubusercontent.com/media/opencv/opencv_zoo/main/"
             "models/face_detection_yunet/face_detection_yunet_2023mar.onnx")

# A versão mais leve chega: a cara dela, a um metro da câmara, ainda tem
# dezenas de pontos, e assim o filme inteiro desce num instante.
RESOLUCAO = "480p"
MEDIDA = (960, 480)

AMOSTRAS_POR_SEGUNDO = 2.0
ABERTURA = 110.0        # abertura vertical da janela onde se procura
LARGURA, ALTURA = 960, 720
CONFIANCA = 0.5         # abaixo disto não é uma cara
PERTO = 35.0            # graus: o que conta como "ao pé de onde ela estava"
PEQUENA = 0.45          # uma cara com menos de 45% do tamanho dela não é ela
PERDIDAS_ATE_VARRER = 4  # meias-segundos perdidos antes de dar a volta toda

JANELA_DA_MEDIANA = 3   # amostras
SUAVIDADE = 1.0         # amostras
PASSO_FINAL = 0.5       # segundos entre pontos no ficheiro do site
INCLINACAO_MAXIMA = 55.0

RAD = np.pi / 180.0


# ---- O que o site diz ----------------------------------------------------

def lista_dos_videos():
    """Nomes das rotas, endereço na nuvem e olhar inicial, de videos.mjs."""
    fonte = (RAIZ / "public" / "videos.mjs").read_text(encoding="utf-8")
    base = re.search(r"const BASE = '([^']+)'", fonte).group(1)
    nomes = re.findall(r"'([^']+)'", re.search(r"VIDEOS_360 = \[([^\]]+)\]", fonte).group(1))
    olhares = {}
    for nome, yaw, pitch in re.findall(
            r"'([^']+)':\s*\{\s*yaw:\s*(-?[\d.]+),\s*pitch:\s*(-?[\d.]+)\s*\}", fonte):
        olhares[nome] = (float(yaw), float(pitch))
    return base, nomes, olhares


def endereco(base, nome):
    from urllib.parse import quote
    return base + quote("%s_%s.mp4" % (nome, RESOLUCAO))


# ---- A janela para dentro da fotografia a dar a volta toda ---------------
#
# A mesma conta de public/previa-360.mjs (projetarPrevia360), feita de uma
# vez para toda a imagem. Mudar uma tem de mudar a outra.

def janela(equirect, yaw_graus, pitch_graus, abertura, L, A):
    fh, fw = equirect.shape[0], equirect.shape[1]
    cy, sy = np.cos(yaw_graus * RAD), np.sin(yaw_graus * RAD)
    cp, sp = np.cos(pitch_graus * RAD), np.sin(pitch_graus * RAD)
    tan_v = np.tan(abertura * 0.5 * RAD)
    tan_h = tan_v * (L / A)

    nx, ny = np.meshgrid((np.arange(L) + 0.5) / L * 2 - 1,
                         1 - (np.arange(A) + 0.5) / A * 2)
    x0, y0, z0 = nx * tan_h, ny * tan_v, -1.0
    y1 = cp * y0 - sp * z0
    z1 = sp * y0 + cp * z0
    dx = cy * x0 + sy * z1
    dy = y1
    dz = -sy * x0 + cy * z1
    n = np.sqrt(dx * dx + dy * dy + dz * dz)

    u = np.arctan2(-dz / n, -dx / n) / (2 * np.pi)
    u -= np.floor(u)
    v = np.arccos(np.clip(dy / n, -1, 1)) / np.pi
    sx = np.clip((u * fw).astype(np.int32), 0, fw - 1)
    sy2 = np.clip((v * fh).astype(np.int32), 0, fh - 1)
    return equirect[sy2, sx]


def para_onde_olhar(yaw_graus, pitch_graus, abertura, L, A, px, py):
    """A volta e a inclinação que põem o ponto (px, py) da janela ao meio."""
    cy, sy = np.cos(yaw_graus * RAD), np.sin(yaw_graus * RAD)
    cp, sp = np.cos(pitch_graus * RAD), np.sin(pitch_graus * RAD)
    tan_v = np.tan(abertura * 0.5 * RAD)
    tan_h = tan_v * (L / A)
    nx = ((px + 0.5) / L) * 2 - 1
    ny = 1 - ((py + 0.5) / A) * 2
    x0, y0, z0 = nx * tan_h, ny * tan_v, -1.0
    y1 = cp * y0 - sp * z0
    z1 = sp * y0 + cp * z0
    dx, dy, dz = cy * x0 + sy * z1, y1, -sy * x0 + cy * z1
    n = np.sqrt(dx * dx + dy * dy + dz * dz)
    dx, dy, dz = dx / n, dy / n, dz / n
    return (np.degrees(np.arctan2(-dx, -dz)) % 360.0,
            np.degrees(np.arcsin(np.clip(dy, -1, 1))))


def afastamento(a, b):
    """Graus entre duas direcções (volta, inclinação)."""
    def seta(d):
        cy, sy = np.cos(d[0] * RAD), np.sin(d[0] * RAD)
        cp, sp = np.cos(d[1] * RAD), np.sin(d[1] * RAD)
        return np.array([-sy * cp, sp, -cy * cp])
    return float(np.degrees(np.arccos(np.clip(np.dot(seta(a), seta(b)), -1, 1))))


# ---- As caras ------------------------------------------------------------

_detector = {}


def caras(imagem):
    """[(x, y, largura, altura)] das caras encontradas na janela."""
    A, L = imagem.shape[:2]
    if (L, A) not in _detector:
        if not MODELO.exists():
            print("A buscar o detector de caras (uma vez)...", flush=True)
            urllib.request.urlretrieve(MODELO_DE, MODELO)
        _detector[(L, A)] = cv2.FaceDetectorYN.create(str(MODELO), "", (L, A),
                                                      CONFIANCA, 0.3, 5000)
    _, achadas = _detector[(L, A)].detect(cv2.cvtColor(imagem, cv2.COLOR_RGB2BGR))
    return [] if achadas is None else [(f[0], f[1], f[2], f[3]) for f in achadas]


def a_cara_dela(equirect, yaw, pitch, tamanho_habitual):
    """A cara dela numa janela aberta onde ela estava, ou None."""
    imagem = janela(equirect, yaw, pitch, ABERTURA, LARGURA, ALTURA)
    melhor, melhor_peso = None, 0.0
    for (x, y, w, h) in caras(imagem):
        lado = float((w * h) ** 0.5)
        if tamanho_habitual and lado < PEQUENA * tamanho_habitual:
            continue
        alvo = para_onde_olhar(yaw, pitch, ABERTURA, LARGURA, ALTURA, x + w / 2, y + h / 2)
        peso = lado * lado / (1.0 + (afastamento((yaw, pitch), alvo) / PERTO) ** 2)
        if peso > melhor_peso:
            melhor, melhor_peso = (alvo, lado), peso
    return melhor


def a_volta_toda(equirect):
    """A maior cara de toda a volta, para quando ela se perde de vista."""
    melhor, maior = None, 0.0
    for quarto in range(4):
        yaw = quarto * 90.0
        imagem = janela(equirect, yaw, 0.0, ABERTURA, LARGURA, ALTURA)
        for (x, y, w, h) in caras(imagem):
            lado = float((w * h) ** 0.5)
            if lado > maior:
                melhor = para_onde_olhar(yaw, 0.0, ABERTURA, LARGURA, ALTURA,
                                         x + w / 2, y + h / 2)
                maior = lado
    return (melhor, maior) if melhor else None


# ---- Seguir uma rota do princípio ao fim ---------------------------------

def seguir(nome, endereco_do_video, olhar_inicial):
    largura, altura = MEDIDA
    bytes_por_imagem = largura * altura * 3
    ffmpeg = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", endereco_do_video,
         "-vf", "fps=%g" % AMOSTRAS_POR_SEGUNDO, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=bytes_por_imagem)

    yaw, pitch = olhar_inicial
    tamanhos, caminho = [], []
    perdidas, i = 0, 0
    while True:
        bruto = ffmpeg.stdout.read(bytes_por_imagem)
        if len(bruto) < bytes_por_imagem:
            break
        equirect = np.frombuffer(bruto, np.uint8).reshape(altura, largura, 3)
        habitual = float(np.median(tamanhos[-40:])) if tamanhos else 0.0

        achou = a_cara_dela(equirect, yaw, pitch, habitual)
        if achou is None and perdidas >= PERDIDAS_ATE_VARRER:
            achou = a_volta_toda(equirect)
        if achou:
            (yaw, pitch), lado = achou
            tamanhos.append(lado)
            perdidas = 0
        else:
            perdidas += 1
        caminho.append({"t": round(i / AMOSTRAS_POR_SEGUNDO, 2),
                        "yaw": round(float(yaw), 2), "pitch": round(float(pitch), 2),
                        "achada": bool(achou)})
        i += 1
        if i % 100 == 0:
            print("   %s  %s  %d com cara em %d" %
                  (nome, minutos(i / AMOSTRAS_POR_SEGUNDO),
                   sum(1 for c in caminho if c["achada"]), len(caminho)), flush=True)

    erro = ffmpeg.stderr.read().decode(errors="replace").strip()
    ffmpeg.stdout.close()
    ffmpeg.wait()
    if not caminho:
        raise SystemExit("Não veio imagem nenhuma de %s\n%s" % (nome, erro[:400]))
    return caminho


def minutos(segundos):
    return "%d:%02d" % (int(segundos) // 60, int(segundos) % 60)


# ---- Tirar os solavancos -------------------------------------------------

def mediana_movel(valores, janela_):
    meio = janela_ // 2
    return np.array([np.median(valores[max(0, i - meio):i + meio + 1])
                     for i in range(len(valores))])


def suavizar(valores, sigma):
    raio = int(np.ceil(3 * sigma))
    nucleo = np.exp(-0.5 * (np.arange(-raio, raio + 1) / sigma) ** 2)
    nucleo /= nucleo.sum()
    return np.convolve(np.pad(valores, raio, mode="edge"), nucleo, mode="valid")


def tratar(caminho, olhar_inicial):
    t = np.array([c["t"] for c in caminho])
    # A volta fica contínua — passa dos 360º em vez de saltar — para a
    # suavização não tropeçar na costura e para o player ir pelo caminho
    # mais curto de um ponto para o outro.
    yaw = np.degrees(np.unwrap(np.radians([c["yaw"] for c in caminho])))
    pitch = np.clip([c["pitch"] for c in caminho], -INCLINACAO_MAXIMA, INCLINACAO_MAXIMA)
    yaw = suavizar(mediana_movel(yaw, JANELA_DA_MEDIANA), SUAVIDADE)
    pitch = suavizar(mediana_movel(pitch, JANELA_DA_MEDIANA), SUAVIDADE)
    quando = np.arange(0.0, float(t[-1]) + 1e-6, PASSO_FINAL)
    yaw = np.interp(quando, t, yaw)
    pitch = np.interp(quando, t, pitch)
    # O primeiro ponto é o olhar inicial da rota, tal e qual: é com ele
    # que a rota abre e é ele que está na miniatura do marcador, e assim
    # a rota começa exactamente na imagem que se viu no mapa. Daí em
    # diante manda o que se mediu. (Sem isto, a suavização puxa o
    # princípio para onde ela já vai um segundo depois.)
    yaw[0], pitch[0] = olhar_inicial
    return quando, yaw, pitch


# ---- O ficheiro que o site lê --------------------------------------------

def em_linhas(valores, largura=70, avanco=" " * 12):
    numeros = [("%.1f" % v).replace(".0", "") if abs(v) >= 0.05 else "0" for v in valores]
    linhas, linha = [], ""
    for n in numeros:
        peca = n + ","
        if len(linha) + len(peca) > largura:
            linhas.append(avanco + linha)
            linha = ""
        linha += peca
    if linha:
        linhas.append(avanco + linha)
    return "\n".join(linhas).rstrip(",")


def escrever_modulo(caminhos):
    blocos = []
    for nome, (quando, yaw, pitch) in caminhos.items():
        blocos.append(
            "    '%s': {\n        volta: [\n%s\n        ],\n"
            "        inclinacao: [\n%s\n        ]\n    }"
            % (nome, em_linhas(yaw), em_linhas(pitch)))
    destino = RAIZ / "public" / "olhar-das-rotas.mjs"
    destino.write_text(CABECALHO + "const CAMINHOS = {\n" + ",\n".join(blocos) + "\n};\n" + RODAPE,
                       encoding="utf-8", newline="\n")
    return destino


CABECALHO = '''/**
 * Para onde olha cada rota, de meio em meio segundo, para ter a cara da
 * Esvarena ao meio da vista.
 *
 * A Esvarena é quem leva quem vê pelo bairro, e vai a andar ao lado de
 * quem filma: ao longo do caminho passa para a frente, fica para trás,
 * vira-se para apontar uma casa. Uma direcção fixa deixava-a sair do
 * ecrã. Aqui está, para cada rota, a direcção onde ela está em cada meio
 * segundo do filme — a volta (yaw) e a inclinação (pitch), em graus.
 *
 * Isto não foi escrito à mão: é o que `scripts/seguir-a-cara.py` mede,
 * vendo o filme uma vez fora do site e seguindo a cara dela. Se uma rota
 * for remontada, volta a correr-se esse programa.
 *
 * A volta é contínua: passa dos 360º e desce abaixo de zero em vez de
 * saltar, para quem a lê ir sempre pelo caminho mais curto. O player anda
 * a direito de um ponto para o outro e ainda aproxima a câmara disso a
 * deslizar, para a vista nunca dar solavancos (ver video360.html).
 */

// Meio segundo entre pontos, do princípio ao fim de cada rota.
const PASSO = 0.5;

'''

RODAPE = '''
/**
 * Se uma rota tem o caminho da cara da Esvarena medido.
 *
 * @param {string} nome - Nome do vídeo.
 * @returns {boolean} Verdadeiro se tiver.
 */
export function temCaminhoDaCara(nome) {
    return !!CAMINHOS[nome];
}

/**
 * Para onde olhar, num instante de uma rota, para ter a cara dela ao meio.
 *
 * @param {string} nome - Nome do vídeo.
 * @param {number} segundos - O instante do filme.
 * @returns {{yaw: number, pitch: number}|null} Volta e inclinação, em graus.
 */
export function olharDaCara(nome, segundos) {
    const caminho = CAMINHOS[nome];
    if (!caminho) return null;
    const volta = caminho.volta;
    const inclinacao = caminho.inclinacao;
    const ultimo = volta.length - 1;
    const onde = Math.max(0, Math.min(ultimo, (segundos || 0) / PASSO));
    const antes = Math.floor(onde);
    const depois = Math.min(ultimo, antes + 1);
    const parte = onde - antes;
    return {
        yaw: volta[antes] + (volta[depois] - volta[antes]) * parte,
        pitch: inclinacao[antes] + (inclinacao[depois] - inclinacao[antes]) * parte
    };
}
'''


def main():
    opcoes = argparse.ArgumentParser(description="Segue a cara da Esvarena pelas rotas 360.")
    opcoes.add_argument("rotas", nargs="*", help="letras das rotas (por omissão, todas)")
    opcoes.add_argument("--bruto", metavar="PASTA",
                        help="onde guardar (e de onde reaproveitar) o seguimento por medir")
    args = opcoes.parse_args()

    base, nomes, olhares = lista_dos_videos()
    if args.rotas:
        letras = [r.upper() for r in args.rotas]
        nomes = [n for n in nomes if n[-1].upper() in letras]
    bruto = Path(args.bruto) if args.bruto else None

    caminhos, resumo = {}, []
    for nome in nomes:
        guardado = bruto / ("%s.json" % nome) if bruto else None
        if guardado and guardado.exists():
            caminho = json.loads(guardado.read_text(encoding="utf-8"))
            print("%s: seguimento já feito, %d amostras" % (nome, len(caminho)))
        else:
            print("%s: a ver o filme..." % nome, flush=True)
            caminho = seguir(nome, endereco(base, nome), olhares.get(nome, (0.0, 0.0)))
            if guardado:
                guardado.parent.mkdir(parents=True, exist_ok=True)
                guardado.write_text(json.dumps(caminho), encoding="utf-8")
        vistas = sum(1 for c in caminho if c["achada"])
        quando, yaw, pitch = tratar(caminho, olhares.get(nome, (0.0, 0.0)))
        caminhos[nome] = (quando, yaw, pitch)
        resumo.append((nome, len(caminho), vistas, quando[-1], yaw[0], pitch[0]))

    destino = escrever_modulo(caminhos)
    print("\n%s" % destino)
    print("\nrota                      cara vista          fim    comeca em")
    for nome, n, vistas, fim, yaw0, pitch0 in resumo:
        print("%-24s  %3.0f%% (%d/%d)  %s   yaw %.1f  pitch %.1f"
              % (nome, 100.0 * vistas / n, vistas, n, minutos(fim), yaw0, pitch0))
    print("\nCada rota comeca no OLHAR_INICIAL de public/videos.mjs. Se mexeres nesses\n"
          "numeros, refaz tambem as miniaturas: bun scripts/gerar-miniaturas.mjs")


if __name__ == "__main__":
    sys.exit(main())
