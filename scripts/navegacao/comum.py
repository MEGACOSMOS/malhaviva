# O que os passos do reconhecimento das ruas e das casas partilham: onde
# estão os ficheiros de onde se parte, a grelha em que se trabalha e as
# contas para passar de umas coordenadas a outras.
#
# Os passos, por ordem (cada um lê o que o anterior deixou):
#
#     python -P scripts/navegacao/alturas.py      # as alturas, do modelo 3D
#     python -P scripts/navegacao/ruas.py         # as ruas desenhadas, do Illustrator
#     python -P scripts/navegacao/estradas.py     # as estradas à volta, do OpenStreetMap
#     python -P scripts/navegacao/reconhecer.py   # a rede e as casas
#     python -P scripts/navegacao/mosaicos.py     # o ortofotomapa para o mapa
#
# O "-P", e não o "-I": com o "-I" o Python esquece as bibliotecas
# instaladas para o utilizador (numpy, rasterio, numba...).
import math, os, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(AQUI, "..", ".."))
PUBLICO = os.path.join(SITE, "public")
SAIDA = os.path.join(PUBLICO, "navegacao")

# A pasta do projecto inteiro (Vídeos\Malha Viva), três acima do site.
PROJECTO = os.environ.get("MALHA_VIVA_PASTA") or os.path.normpath(os.path.join(SITE, "..", "..", ".."))
ORTOFOTO = os.path.join(PROJECTO, "Imagens", "Ortofotomapa", "Ortofotomapa Penajóia 2026-02-15 (2,5 cm).tif")
REGISTO = os.path.join(PROJECTO, "Imagens", "Ortofotomapa", "processo", "registo.json")
PLY = os.path.join(PROJECTO, "3D", "Mapa", "Gaussian Splats", "PLY", "gs_full.ply")
CASAS = os.path.join(PROJECTO, "SIG", "Base de Dados", "Números de Casas", "casas.shp")
RUAS_AI = os.path.join(PROJECTO, "SIG", "Traçado de Ruas", "Malha Viva - Ruas.ai")

# O que se calcula pelo caminho e não vai para o site (as alturas pesam
# perto de 200 MB): fica numa pasta de rascunho do sistema.
RASCUNHO = os.path.join(tempfile.gettempdir(), "malhaviva-navegacao")
os.makedirs(RASCUNHO, exist_ok=True)

# A grelha de trabalho: a do ortofotomapa, com um ponto por cada 4 × 4
# dele — 12,8 cm de Mercator, cerca de 10 cm no chão. Chega e sobra para ver
# um beco de um metro, e cabe na memória de uma vez.
FATOR = 4
RAIO_DA_TERRA = 6378137.0


def grelha():
    """A grelha de trabalho, lida do próprio ortofotomapa.

    Devolve (E0, N1, p, W, H): o canto de cima à esquerda em Web Mercator,
    o tamanho de um ponto em metros de Mercator e a largura e a altura.
    """
    import rasterio
    with rasterio.open(ORTOFOTO) as d:
        t = d.transform
        return t.c, t.f, t.a * FATOR, d.width // FATOR, d.height // FATOR


def mercator(lon, lat):
    """Longitude e latitude (graus, WGS84) em Web Mercator (metros)."""
    E = RAIO_DA_TERRA * math.radians(lon)
    N = RAIO_DA_TERRA * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return E, N


def geograficas(E, N):
    """Web Mercator (metros) em longitude e latitude (graus, WGS84)."""
    lon = math.degrees(E / RAIO_DA_TERRA)
    lat = math.degrees(2 * math.atan(math.exp(N / RAIO_DA_TERRA)) - math.pi / 2)
    return lon, lat
