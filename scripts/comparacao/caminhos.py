"""
Onde estão os dados que os programas da comparação leem e escrevem.

Os dados não estão no repositório (são grandes, ou são da DGT):

  - o LiDAR da DGT de julho de 2024, quadrículas 108190 e 108191
    (ficheiros LO-*.laz, MDS-50cm-*.tif e MDT-50cm-*.tif), descarregado
    do Centro de Dados da DGT (licença CC BY 4.0);
  - o modelo do drone, gs_full.ply (16 104 037 elipsoides, 3,8 GB), e a
    versão que o site mostra, gs_optimizado.ply (14 317 556);
  - o ortofotomapa do drone a 2,5 cm (GeoTIFF em EPSG:3857), feito com os
    programas da pasta `registo/`.

Por omissão estão em `dados/`, ao lado deste ficheiro. Cada um pode ser
apontado para outro sítio com uma variável de ambiente, por exemplo:

    set MALHAVIVA_LIDAR=D:\\LiDAR DGT 2024
    set MALHAVIVA_PLY=D:\\modelo\\gs_full.ply

Os ficheiros intermédios (laz_bairro.npz, modelo.npz, mudanca.npz, …) são
escritos na pasta onde se corre o programa. Corra-os todos na mesma pasta.
"""
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..'))
DADOS = os.environ.get('MALHAVIVA_DADOS', os.path.join(AQUI, 'dados'))


def _pasta(caminho):
    return os.path.join(caminho, '')


# Entradas
LIDAR = _pasta(os.environ.get('MALHAVIVA_LIDAR', os.path.join(DADOS, 'lidar-dgt-2024')))
MODELO_PLY = os.environ.get('MALHAVIVA_PLY', os.path.join(DADOS, 'gs_full.ply'))
MODELO_SITE_PLY = os.environ.get('MALHAVIVA_PLY_SITE', os.path.join(DADOS, 'gs_optimizado.ply'))
ORTOFOTO = os.environ.get('MALHAVIVA_ORTOFOTO', os.path.join(DADOS, 'ortofotomapa-2026-02-15-2,5cm.tif'))

# O registo do modelo no mapa (escala, rotação e deslocamento do sistema do
# modelo para EPSG:3857) e o contorno da zona nítida: estão no repositório.
REGISTO = os.path.join(AQUI, 'registo', 'registo.json')
MASCARA = os.path.join(AQUI, 'registo', 'mascara.json')

# A correção de altura que o site usa para os prédios à volta (ver
# scripts/edificios); só serve para comparar com a de 3-vertical.py.
ALTURA_SITE = os.path.join(REPO, 'scripts', 'edificios', 'altura.json')

# Intermédios, na pasta de trabalho
LAZ_BAIRRO = 'laz_bairro.npz'

# Saída para a página malhaviva.pt/comparacao
SAIDA_PAGINA = _pasta(os.environ.get('MALHAVIVA_SAIDA', os.path.join(REPO, 'public', 'comparacao-dados')))


def lidar_laz(n):
    return LIDAR + f'LO-{n}-07-2024_v01.laz'


def lidar_raster(produto, n):
    """produto: 'MDS' ou 'MDT' (modelos de 50 cm)."""
    return LIDAR + f'{produto}-50cm-{n}-07-2024_v01.tif'


QUADRICULAS = (108190, 108191)
