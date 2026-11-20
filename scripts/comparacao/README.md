# Comparação do modelo do drone com o LiDAR da DGT

Os programas em Python que mediram o modelo 3D do Bairro de Penajóia contra o
levantamento LiDAR oficial da Direção-Geral do Território, e que fazem os
dados da página [malhaviva.pt/comparacao](https://malhaviva.pt/comparacao).
Estão aqui para poderem ser lidos, verificados e corridos outra vez.

## O que se compara

| | Modelo do drone (Malha Viva) | LiDAR DGT |
|---|---|---|
| Data | 15 de fevereiro de 2026 | julho de 2024 |
| Como foi feito | 486 fotografias de drone, fotogrametria e Gaussian Splat | laser a partir de avião |
| Ficheiro | `gs_full.ply`, 16 104 037 elipsoides (o site mostra `gs_optimizado.ply`, 14 317 556) | quadrículas 108190 e 108191: nuvem `LO-*.laz`, `MDS-50cm`, `MDT-50cm` |

Tudo é medido na zona nítida do modelo, o contorno em `registo/mascara.json`
(206 035 m²), e no sistema de coordenadas oficial português, PT-TM06/ETRS89
(EPSG:3763).

## Os dados

Não estão no repositório. Ponha-os em `dados/`, ao lado destes programas, ou
diga onde estão com variáveis de ambiente (ver `caminhos.py`):

| Variável | O quê | De onde |
|---|---|---|
| `MALHAVIVA_LIDAR` | pasta com `LO-108190-07-2024_v01.laz`, `LO-108191-…`, `MDS-50cm-…tif`, `MDT-50cm-…tif` | Centro de Dados da DGT, gratuito, licença CC BY 4.0 (pede registo) |
| `MALHAVIVA_PLY` | `gs_full.ply`, o modelo completo (3,8 GB) | autor do projeto |
| `MALHAVIVA_PLY_SITE` | `gs_optimizado.ply`, o modelo que o site mostra | autor do projeto |
| `MALHAVIVA_ORTOFOTO` | o ortofotomapa do drone, 2,5 cm, GeoTIFF em EPSG:3857 | feito com `registo/ortofoto.py` |
| `MALHAVIVA_SAIDA` | onde escrever os dados da página (por omissão `public/comparacao-dados/`) | — |

Bibliotecas: `pip install -r requisitos.txt`.

## Ordem

Corra-os todos na mesma pasta de trabalho: cada um deixa lá os ficheiros
intermédios (`.npz`, `.json`) de que o seguinte precisa.

```
python 1-lidar.py
python 2-modelo.py
python 3-vertical.py      # primeira vez: ajusta a inclinação
python 4-mudanca.py
python 3-vertical.py      # segunda vez: já separa as zonas que mudaram
python 5-horizontal.py
python 6-fachadas.py
python 7-atualidade.py
python 8-densidade-do-site.py
python 9-dados-da-pagina.py
python 10-pontos-da-pagina.py
```

O `3-vertical.py` corre duas vezes porque as zonas que mudaram entre os dois
voos (`4-mudanca.py`) são encontradas com a inclinação que ele ajusta. O
ajuste em si não depende delas; só a separação dos resultados.

## O que cada programa faz

**`registo/`** — antes de tudo, o modelo do drone foi posto no mapa. O
modelo sai do processamento num sistema próprio, em metros. `preparar.py` lê
o PLY, `render.py` desenha-o visto de cima, `registar.py` encontra a escala,
a rotação e o deslocamento que o põem em cima de uma fotografia de satélite
(301 pontos de controlo em estradas, passeios e rotunda, diferença típica de
cerca de 40 cm), `mascara.py` marca a zona onde o modelo é nítido e
`ortofoto.py` faz o ortofotomapa de 2,5 cm. Os resultados, `registo.json` e
`mascara.json`, estão aqui; as imagens intermédias de que `registar.py` e
`mascara.py` partiram não estão. O LiDAR **não** foi usado neste registo, por
isso a comparação horizontal (programa 5) é independente.

**`1-lidar.py`** — lê as duas quadrículas do LiDAR e guarda os pontos dentro
do contorno. Resultado: 22,8 pontos por m², com cor (a DGT colore os pontos a
partir de fotografia aérea).

**`2-modelo.py`** — lê as elipsoides do modelo dentro do contorno e passa-as
para EPSG:3763 com o registo. Resultado: 15,5 milhões de elipsoides, 75 por
m²; 24 por m² com mais de 50 % de opacidade e menos de 25 cm de comprimento.

**`3-vertical.py`** — exatidão das alturas. Pontos de controlo: chão do LiDAR
(classe 2), um por célula de 2 m, sem árvores nem prédios a menos de 1,5 m,
com declive abaixo de 15 % e chão que cabe num plano a menos de 5 cm. A altura
do modelo é a mediana das elipsoides opacas a menos de 30 cm. O modelo sai do
processamento inclinado (0,53°) e com outra altitude; isso é ajustado ao
LiDAR com validação cruzada em xadrez de 50 m (ajusta-se numa metade do
bairro e mede-se na outra) e intervalos de 95 % por reamostragem em blocos.
Resultado, fora das zonas que mudaram: 4 965 pontos, erro típico (NMAD)
15,4 cm, RMSE 30,1 cm, 95 % abaixo de 42 cm.

**`4-mudanca.py`** — superfícies dos dois em grelha de 50 cm (o ponto mais
alto de cada célula) e as manchas de mais de 8 m² onde diferem mais de 1 m: o
que se construiu ou demoliu entre os voos, e as árvores cortadas.

**`5-horizontal.py`** — exatidão da posição. As duas superfícies cortadas em
quadrados de 32 m; em cada um, a correlação de fase das arestas (beirais,
muros) dá o deslocamento entre os dois. Resultado: 173 quadrados, desvio fixo
de 38 cm, RMSE 0,62 m.

**`6-fachadas.py`** — pontos nas paredes. Em cada aresta de telhado do LiDAR
ajusta-se um degrau (chão, altura, posição da parede) e contam-se os pontos a
menos de 30 cm do plano da parede, entre 0,5 m acima do chão e 0,5 m abaixo
do beiral, a dividir pela área de parede. Só entram paredes com a mesma
altura (±50 cm) nos dois: 269. Resultado, mediana: 6,0 pontos por m² de
parede no drone, 0,5 no LiDAR.

**`7-atualidade.py`** — construção nova: manchas de pelo menos 10 m² onde o
modelo está mais de 2 m acima do LiDAR, num sítio onde o LiDAR não tinha
prédio nem árvore. Resultado: 98 sítios.

**`8-densidade-do-site.py`** — a mesma contagem do programa 2 para o modelo
que o site mostra: 64,6 elipsoides por m².

**`9-dados-da-pagina.py`** e **`10-pontos-da-pagina.py`** — as imagens do
"Lado a lado" e os pontos dos quatro quadrados de 24 × 24 m da "Qualidade dos
pontos" da página. Os quadrados foram escolhidos onde há casas que existem
nas duas medições, mais um de casas novas. Do LiDAR entram todos os pontos
menos os marcados como ruído (classe 7); do drone, os centros das elipsoides
com pelo menos 20 % de opacidade, com a altura acertada como no programa 3.

**`teste-do-juri/`** — escolhe os dez maiores sítios de construção nova,
afastados pelo menos 30 m uns dos outros, e faz os recortes do drone e do
LiDAR à volta de cada um. As capturas do Google Earth da imagem final não
são feitas por estes programas.

## Resultados

A pasta `resultados/` tem o que estes programas deram quando foram corridos
de raiz, numa pasta vazia, a 20 de novembro de 2026: `vertical.json`,
`horizontal.json`, `atualidade.json` e os dez sítios do teste do júri
(`teste_juri.json`, `teste_do_juri.csv`). Nessa corrida, as imagens e os
pontos da página saíram iguais, byte a byte, aos que estão publicados em
`public/comparacao-dados/`.

## O que estes números não dizem

- O LiDAR é a referência, por isso os erros medidos juntam os dele e os do
  modelo. Para provar uma exatidão melhor do que a do LiDAR seriam precisos
  pontos medidos no terreno com GPS.
- A inclinação e a altitude do modelo foram acertadas com o próprio LiDAR.
- O Google Earth 3D não foi medido: as regras do Google não permitem tirar
  medidas do seu 3D.
