# Prédios à volta do bairro

Gera `public/edificios/edificios.bin` (+ `.json`): blocos simples, de telhado
plano, dos prédios à volta do bairro, que o site desenha com
`public/edificios.mjs`.

## Fontes

- **Alturas** — Direção-Geral do Território, voo LiDAR de julho de 2024:
  MDS (superfície, com os prédios) e MDT (terreno), 50 cm, EPSG:3763,
  licença CC BY 4.0. Descarregados do Centro de Dados da DGT
  (cdd.dgterritorio.gov.pt, precisa de conta gratuita). Quadrículas
  usadas: 108190, 108191, 109190, 109191 (MDS-50cm e MDT-50cm). Ficam na
  pasta de trabalho, não no repositório.
- **Plantas** — OpenStreetMap (ODbL), pedidas à Overpass API para a caixa
  38.664…38.682 N, −9.194…−9.172 E. Os prédios que lá faltam são tirados
  do próprio LiDAR (alto e liso = telhado; alto e rugoso = árvore).
- **Encaixe** — o modelo do drone (`gs_optimizado.ply`, o mesmo que o site
  mostra) serve de régua: a superfície da DGT foi comparada com a dele no
  chão aberto. Resultado em `altura.json`: o modelo do drone está ~98 m
  abaixo das altitudes reais e inclinado 0,53° (resíduo mediano ~12 cm);
  na horizontal, 0,5 m de acerto. Cena ↔ geo vem do `registo.json` do
  ortofotomapa (ver `osm_cena.py`).

O 3D do Google Earth / Google Maps não foi usado: as regras do Google
proíbem fazer modelos ou tirar medidas a partir dele.

## Ordem

Todos correm com o Python do ambiente de trabalho
(`E:/Malha Viva - trabalho/venv`), que tem numpy, scipy, opencv, rasterio
e shapely. Os caminhos estão no topo de cada ficheiro.

1. `grelha.py` — MDS e MDT da DGT para uma grelha de 0,5 m em coordenadas
   da cena (±750 m à volta da origem).
2. `drone.py` — superfície do modelo do drone na mesma grelha.
3. `alinhar.py`, `inclinacao.py` — acerto horizontal e de altura
   (escreve `altura.json`).
4. `mascara_site.py` — reproduz o esbatimento das bordas do bairro que o
   site faz (para não pôr blocos onde o bairro em manchas já se vê).
5. `mascara.py` — máscara de prédios do LiDAR.
6. `construir.py` — os blocos: planta do OSM (ou do LiDAR), chão = o mais
   baixo à volta, telhado = mediana da superfície; prédios com partes de
   alturas bem diferentes ficam em degraus. Cor de betão claro já
   sombreada por vértice (sol de sudoeste, pé das paredes mais escuro) e a
   esbater-se para o fundo dos 380 m até `RAIO_MAX` (720 m).

`ver_alturas.py` desenha uma vista de cima para conferir.
