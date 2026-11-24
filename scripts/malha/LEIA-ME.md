# O bairro em malha poligonal

No telemóvel, nos computadores muito fracos, no nível **Baixo** e no modo de
poupança (quando a placa gráfica desistiu a meio de uma visita), o bairro
deixa de ser o gaussian splat e passa a ser uma **malha poligonal com
fotografia por cima** (`public/bairro-malha.mjs`). As manchas pintam cada
ponto do ecrã muitas vezes, com transparências umas por cima das outras; a
malha pinta-o uma vez só.

No nível **Médio** o bairro é misto: o gaussian splat fica nos dois
primeiros anéis de detalhe, à volta de quem olha (o fino, com as manchas
todas, e o do meio, com o nível de manchas do meio), e a malha faz o
terceiro, o de longe (`aneisDeManchas` em `public/lod-foco.mjs`). Não há
tecto de manchas no Médio.

Uma grelha de um metro, vista de cima, diz em cada sítio quanto das manchas
está à vista, de zero a um, em três partes: o nível fino, o do meio, e tudo
junto (`vigiarAsManchas` em `public/bairro-malha.mjs`). Cada mancha leva no
azul uma marca do nível de onde vem (`marcarAsManchas`), e é por ela que
aparece na medida da sua parte da grelha; as árvores da malha aparecem na
medida contrária, e a malha só se apaga onde as manchas estão inteiras.

Trocas de nível, em 0,6 s:

- de manchas para malha, as manchas desvanecem-se por cima da malha, e só
  depois a zona sai (`segurarNaPassagem` em `public/lod-foco.mjs`);
- de malha para manchas, aparecem aos poucos por cima dela;
- do fino para o do meio, e ao contrário, os dois níveis ficam desenhados
  juntos durante a troca, um a aparecer e o outro a desvanecer-se. O motor
  não o faz sozinho: guarda-se o nível antigo (`guardarNivelAntigo`), dá-se-lhe
  um lugar próprio na memória gráfica (`separarLugares` — sem isso os dois
  disputavam o mesmo lugar e a zona ficava preta umas imagens), e só se
  larga na atualização do próprio motor.

Uma zona que acabou de trocar não volta ao nível de onde veio antes de
2,5 s, para não piscar. Onde as manchas ainda não chegaram, ou já se foram,
fica a malha, e por isso não há buracos.

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
python scripts/malha/4_arvores.py v4        # árvores em manchas: public/malha/v4/arvores
python scripts/malha/5_empacotar.py v4      # malha sem copas: public/malha/v4/*.glb + malha.json
```

Os intermédios (pesados) ficam em `E:/Malha Viva - trabalho/malha`
(`MALHA_TRABALHO` muda-o; `MIPMAP_RESULTADO` muda onde está o MipMap).
Ao refazer, dê-se uma versão nova nos passos 4 e 5 (a mesma nos dois) e apague-se a pasta
da antiga: as peças são guardadas pelos navegadores um ano, o índice não.

## As árvores

Uma copa de árvore não tem pele: numa malha vira uma bolha verde. Por isso
as árvores saem da malha e passam a ser **manchas**, tiradas do splat do
próprio site (passo 4), desenhadas por cima da malha. O resto continua malha.

- **Onde há árvores** (grelha de meio metro): mais de 1,5 m acima do chão e
  verde. O cimo é o da malha; o chão é o cimo "aberto" com um disco de 30 m
  (tira casas e árvores) e esbatido; o verde é o índice 2G−R−B das manchas
  do cimo. Limpa-se (nada abaixo de 4 m²) e alarga-se 1,5 m para apanhar a
  orla da copa. Fica uma imagem para ver em `<trabalho>/arvores/arvores.png`.
- **A malha** não perde nada: as copas são **baixadas** (passo 5). É copa um
  triângulo mais de 0,8 m acima do chão e: na zona das árvores, no miolo ou
  verde na fotografia; ou, até 3 m dela, debaixo do cimo das manchas das
  árvores, ou num sítio onde o splat do bairro não tem nada (bocados da
  bolha da copa a pairar por cima da estrada, pintados com a estrada).
  - Apagá-las deixava buracos — o drone não vê o chão debaixo das árvores,
    por isso a malha não o tem (v3). Baixá-las até à estimativa do chão
    abria valas na orla do bairro, onde a estrada está num aterro e a
    estimativa fica 3 m abaixo dela (v4). Agora descem como um **pano
    esticado** entre os vértices que ficam à volta (`pano` no passo 5):
    assentam na estrada, no quintal ou no beiral que as rodeia.
  - Depois, perto das árvores, os **bicos** (vértices mais de 40 cm acima de
    todos os vizinhos) descem à média dos vizinhos.
  - A malha é pintada dos dois lados, para onde dobra não ficar uma frincha
    preta.
- **As manchas** são as dessa zona, do chão (−0,5 m) até 1,5 m acima do
  cimo, sem as soltas maiores do que 1,5 m e, na orla, só as verdes, do **nível 1** do splat (um
  décimo do mais fino). O nível 0 fica quase igual ao bairro no computador,
  mas são dez vezes mais manchas: de mais para um telemóvel. Ensaio de
  2026-11-21 no centro do bairro: nível 1 = 36 mil manchas, 0,5 MB; nível 0
  = 325 mil, 4,2 MB.
- Ficam de fora: arbustos baixos e as encostas de mato (abaixo de 1,5 m), e
  alguma árvore pequena que escape.

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
