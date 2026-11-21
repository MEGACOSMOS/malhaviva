# O bairro em malha poligonal

No telemóvel, nos computadores muito fracos, no nível **Baixo** e no modo de
poupança (quando a placa gráfica desistiu a meio de uma visita), o bairro
deixa de ser o gaussian splat e passa a ser uma **malha poligonal com
fotografia por cima** (`public/bairro-malha.mjs`). As manchas pintam cada
ponto do ecrã muitas vezes, com transparências umas por cima das outras; a
malha pinta-o uma vez só.

## De onde vem

Do mesmo processamento do MipMap Desktop que deu o splat (voo de
2026-02-15, projeto `a27723fa…`, pasta `result/3D/model-b3dm`, 3D Tiles com
peças Draco e texturas JPEG). A malha e o splat estão no mesmo referencial
(ENU com origem em 38,6715844022 N, −9,1824929236), por isso o encaixe é
exacto: a cena do site é `(leste, cima + 52,985, −norte)`. O 52,985 foi
medido contra as manchas do próprio site (moda da diferença de altura,
nenhum desvio na horizontal a 25 cm) e bate com o que a navegação já tinha
medido (52,99, `scripts/navegacao/comum.py`).

## O corte

O contorno é tirado das manchas que o site mostra (`public/splat`, nível 0):
grelha de meio metro, fecho de 1,5 m, maior zona, contorno de fora,
simplificado a 30 cm. Cada triângulo da malha é cortado por esse contorno —
os que o atravessam são cortados à medida. A malha acaba onde o splat acaba.

## Os passos

Com Python 3.12 (numpy, opencv, pillow, shapely, DracoPy) e o `ktx` da
Khronos, a partir da raiz do site:

```
python scripts/malha/1_contorno.py          # contorno do splat do site
python scripts/malha/2_recortar.py 2.5      # peças do MipMap, recortadas
python scripts/malha/3_atlas.py 2.5         # atlas de texturas + cena + Draco
python scripts/malha/4_empacotar.py v3      # public/malha/v3/*.glb + malha.json
```

Os intermédios (pesados) ficam em `E:/Malha Viva - trabalho/malha`
(`MALHA_TRABALHO` muda-o; `MIPMAP_RESULTADO` muda onde está o MipMap).
Ao refazer, dê-se uma versão nova no passo 4 (v2, v3…) e apague-se a pasta
da antiga: as peças são guardadas pelos navegadores um ano, o índice não.

## Escolhas (mudáveis)

- **Nível de detalhe:** peças com erro geométrico até 2,5 m (o nível logo
  acima do mais fino): ~680 mil triângulos dentro do contorno. O mais fino
  tem 1,1 milhões e o dobro das texturas.
- **Texturas:** 14 atlas de 2048 px, arrumados para caberem em 16, cada um
  uma zona do bairro (um desenho por atlas), em **KTX2 (Basis ETC1S,
  qualidade 255)**: a placa gráfica guarda-os comprimidos — cerca de 40 MB
  de memória gráfica, 13,5 MB a descarregar com a geometria. A v1 levava
  WebP de 1024 px: 80 MB de memória gráfica e menos nítida.
- **Sem luz:** a fotografia já traz a luz do dia do voo (material sem
  iluminação, `KHR_materials_unlit`).
- **Anti-serrilhado** ligado e até 1,5 pontos por ponto do ecrã (máx. 1,6
  milhões de pontos), porque a malha é barata de pintar; em poupança, sem
  anti-serrilhado e 0,5 milhões.

## Texturas comprimidas

Fazem-se com o `ktx` da Khronos (KTX-Software 4.4.2, instalado em
`%LOCALAPPDATA%\Programs\KTX-Software`; `KTX=caminho` muda-o). No site, o
transcodificador Basis do PlayCanvas (`public/motor/basis-2.21.4/`, de
`examples/assets/wasm/basis/` do repositório do motor, tag v2.21.4) passa-as
no aparelho ao formato que a placa gráfica dele entende (ETC, ASTC ou DXT).
`4_empacotar.py <versão> 1024 2.5 webp` volta a fazer a versão WebP.
