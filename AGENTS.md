# Regras do Malha Viva para agentes de IA

Este ficheiro é lido por assistentes de programação (Claude Code, Cursor,
Codex, Copilot e afins). O que está aqui não são sugestões: é o que tem de
ser feito, sempre, sem esperar que alguém peça.

---

## Toda a anotação nova tem de ser alcançável por quem não vê o ecrã

O bairro é uma tela desenhada pela placa gráfica. Um leitor de ecrã não lê
telas — lê o que está escrito à volta delas. Os marcadores do mapa são a
única porta de entrada para os testemunhos e para as paragens 360º, e por
isso são a diferença entre o site ter conteúdo para toda a gente ou só para
quem vê.

**Ao acrescentar uma anotação — um testemunho, uma paragem, um tipo novo de
ponto no mapa — não está feita enquanto não tiver as quatro coisas
seguintes.** Todas vivem em `public/annotations.mjs`.

1. **Um nome dito por palavras.** Em `nomeAcessivel()`, uma anotação de
   qualquer tipo tem de devolver uma frase que diga *de quem é* e *o que é*
   — "Testemunho de Dulce", e não "Dulce". O que está desenhado no
   marcador — uma câmara, um olho, a palavra 360º — não se lê em voz
   alta. Se acrescentar um tipo novo, ensine-o a esta função.

2. **Esse nome traduzido nas quatro línguas.** Em `public/idiomas.js`, em
   `pt`, `en`, `es` e `kea`. Nomes de pessoas e de sítios — Dulce, Luna,
   Esvarena, Olho de Águia — nunca se traduzem; traduz-se o que está à
   volta deles. O nome é refeito sozinho quando se troca de língua, desde
   que a chave exista nas quatro.

3. **Papel de botão e lugar na fila do Tab.** `role="button"` e
   `tabindex="0"`, com o Enter e o espaço a abrir. Isto já é feito para
   todas as anotações da lista em `initialize()`: uma anotação acrescentada
   a essa lista herda-o. Uma anotação criada por outro caminho, não —
   nesse caso é preciso fazê-lo à mão.

4. **Sair da fila quando não está à vista.** Um marcador que fique para
   trás da câmara leva `aria-hidden="true"` e `tabindex="-1"` enquanto lá
   estiver. Andar de tecla e carregar em coisas que não se veem é pior do
   que não lá chegar. Isto é feito em `update()`, à conta da mesma lista.

O código reclama sozinho se o ponto 1 for esquecido: `baptizarMarcadores()`
escreve um erro na consola com a anotação em falta. Um erro na consola não
é um aviso a pedir atenção — é uma anotação que ninguém consegue abrir.

E para quem vê: a miniatura de uma anotação nova (ou de uma cujo vídeo ou
fotografia mudou) faz-se com `bun scripts/gerar-miniaturas.mjs`, que a
guarda em `public/miniaturas/`. Sem isso a anotação tem miniatura na mesma,
mas feita no navegador de quem visita, devagar, só depois de o bairro abrir
— e a consola avisa.

### Como verificar, em dez segundos

Com o site a correr, na consola do navegador:

```js
[...document.querySelectorAll('.annotation-marker')]
    .map(m => m.getAttribute('role') + ' · ' + m.getAttribute('aria-label'));
```

Todas as linhas têm de dizer `button` e um nome. Nenhuma pode dizer `null`
nem ficar vazia.

---

## Remontar uma rota 360? Refaz o caminho da cara

Nas três rotas a vista não fica parada numa direcção: vai atrás da cara da
Esvarena, que é quem leva quem vê pelo bairro e que, ao longo do caminho,
passa para a frente, fica para trás e vira-se para apontar uma casa. Onde
ela está em cada meio segundo do filme não é adivinhado no navegador —
está medido em `public/olhar-das-rotas.mjs`. O player segue sempre esse
caminho, e quem arrasta a vista olha a partir dele: a câmara tem duas
mãos, a de baixo agarrada à cara dela e a de cima de quem está a ver (ver
`juntarAsDuasMaos` em `public/video360.html`).

Se uma rota for remontada — cortada, rodada, exportada de novo — o caminho
medido passa a apontar para sítios que já não são aqueles. Isso não dá
erro nenhum: só se vê a vista a fugir dela. Por isso, ao trocar o ficheiro
de uma rota, refaz-se tudo o que foi medido a partir dele:

```
python scripts/seguir-a-cara.py     # o caminho da cara, filme fora
bun scripts/gerar-miniaturas.mjs    # as miniaturas dos marcadores
```

e a fotografia do primeiro instante, `public/previas/<nome>.jpg`
(2160 × 1080, tirada da versão de 1080 linhas), que é o que o palco mostra
antes de o filme andar e de onde saem as miniaturas. O `OLHAR_INICIAL` de
`public/videos.mjs` — a direcção com que a rota abre, que é também o
primeiro ponto do caminho — mede-se nessa mesma fotografia, com a cara
dela ao meio da vista.

---

## Mexer no guarda do arranque? Prova-o num Chrome a sério

O primeiro bloco de `public/index.html` repara sozinho o Chrome que ficou
preso a arrancar: manda-o a `/limpar`, que **apaga a cache do site**. Isso é
caro (o motor e o bairro pesam megas) e já correu mal duas vezes de
sentidos opostos: o Chrome ficava branco sem se reparar, e depois um
visitante com a ligação lenta que carregasse em F5 era mandado limpar a
cache a cada vez, sem o site chegar a guardar nada.

Antes de dar por acabada qualquer alteração a esse bloco, a `/limpar`, ou
aos cabeçalhos de cache em `public/_headers`, com o site a correr:

```
bun scripts/testar-arranque.mjs --completo
```

Abre um Chrome à parte, com perfil limpo, e confere que o guarda repara
quando deve e só quando deve. Todas as linhas têm de dizer `ok`. Um Chrome
embutido num painel não serve para isto: os separadores escondidos não
desenham, e o guarda só conta o tempo em que a página está à vista.

---

## Mexer nos modos de qualidade, ou na escolha automática? Prova-os

Há três modos — Alto, Médio e Baixo — e, se quem visita não escolher nenhum,
o site escolhe sozinho conforme a fluidez (`public/escolha-de-qualidade.mjs`,
ligada em `medirAFluidez()` no `index.html`; o que se guarda de uma visita
para outra está em `window.qualidade`, no princípio da mesma página). No
Baixo, o modo dos telemóveis, a densidade da imagem afina-se também
(`public/fluidez.mjs`). Uma escolha que escolhe mal não dá erro nenhum: só
deixa o site pior, em silêncio — aos solavancos, ou a saltar entre dois
modos. Por isso, antes de dar por acabada qualquer alteração a isto:

```
bun scripts/testar-escolha.mjs     # a escolha do modo, sem placa gráfica
bun scripts/testar-fluidez.mjs     # o afinador da densidade, idem
bun scripts/testar-modos.mjs       # os três modos, num Chrome a sério
```

Todas as linhas dos três têm de dizer `ok`. E, para saber como o bairro se
comporta de facto, com o seu vaivém de vistas leves e pesadas:

```
bun scripts/medir-fluidez.mjs
```

Abre um Chrome à parte, leva a câmara por um percurso sempre igual e conta
quantos segundos ficaram abaixo de 30 imagens, e em que modo se esteve (com
`--qualidade=high`, `--aparelho=telemovel` e `--carga=45` testam-se os outros
casos). A simulação apanha erros de lógica; só o Chrome a sério diz se o
bairro se comporta.

---

## Mexer na qualidade automática dos vídeos? Mede-a, antes e depois

Os testemunhos e as rotas escolhem sozinhos a versão do vídeo (de 480p a
1440p) conforme a ligação de quem vê (`public/qualidade-video.mjs`, com o
índice de cada ficheiro lido por `public/indice-mp4.mjs`). Uma escolha que
escolhe mal não dá erro nenhum: só deixa o vídeo a saltar de nitidez, com a
imagem e o som a parar em cada troca, ou parado à espera de mais filme. E há
duas coisas que enganam quem mexe nisto sem medir:

- **O Chrome engana-se na reserva.** O que ele diz ter já descarregado
  (`video.buffered`) é contado em bytes e passado a segundos como se o filme
  pesasse o mesmo do princípio ao fim: numa rota chega a dizer 5 segundos
  quando tem 17. Era isso que fazia o site descer de qualidade sem razão nas
  rotas. A conta certa faz-se com o índice do ficheiro (`faixaActual` e
  `reserva`, no gestor).
- **O travão de rede do próprio Chrome não serve para provar isto**: uma
  mudança de velocidade só vale para os pedidos seguintes, e o filme, que é
  um pedido só, passa a ir à velocidade toda da ligação verdadeira.

Antes de dar por acabada qualquer alteração a esses dois ficheiros, ou ao que
os players fazem durante uma troca (o evento `trocadeversao` e o atributo
`data-troca-de-versao`, que seguram o relógio, o quadrado de espera e as
legendas), com o site a correr:

```
bun scripts/testar-qualidade-video.mjs                    # o código de agora (~20 min)
bun scripts/testar-qualidade-video.mjs --versao=<commit>  # o mesmo, com o site desse commit
```

Abre dois Chromes à parte, sem som, que vão à nuvem por um cano que finge
ligações de vários feitios (rápida, justa, a oscilar, instável, lenta, a cair
de repente, e uma segunda visita), e conta, para um testemunho e para uma
rota, as trocas por minuto, as paragens e o tempo de imagem parada em cada
troca. Corre-se com o commit de antes e com o de agora e comparam-se caso a
caso: nenhum caso pode ficar com mais paragens nem com mais imagem parada, e
as trocas só podem subir onde a qualidade média também subiu.

---

## Mexer em como o bairro arranca, ou em `src/index.ts`? Prova o pré-carregamento

Quem escreve "malhaviva.pt" na barra do Chrome faz o Chrome adivinhar para
onde vai e carregar o bairro **escondido**, em segundo plano ("prerender"),
antes de a pessoa carregar em Enter. O motor 3D, a arrancar numa página
escondida assim, deixava o separador preso para sempre — o círculo a rodar,
a página escura, "Página sem resposta" — e a pessoa nunca via o bairro.
Num Chrome limpo, ou no Chrome embutido de um painel, isto não se vê: só
acontece com um Chrome a sério que pré-carrega, e passou meses a parecer
"o Chrome às vezes encrava". O servidor (`src/index.ts`) evita-o recusando
esse pré-carregamento nas páginas pesadas, e o Chrome abre-as normalmente.

Antes de dar por acabada qualquer alteração a `src/index.ts`, ao
`run_worker_first` de `wrangler.jsonc`, ou ao que o código principal faz
logo que a página abre (motor 3D, WebGPU, ecrã de espera), e depois de
publicar, com o site a correr:

```
bun scripts/testar-prerender.mjs                       # o site local
bun scripts/testar-prerender.mjs https://malhaviva.pt  # o site publicado
```

Abre um Chrome à parte, com perfil limpo e **sem controlo remoto** (ligar o
Chrome a um controlo desliga o pré-carregamento, e o defeito desaparece
sem ter sido corrigido), manda-o pré-carregar o bairro e depois abri-lo.
Tem de dizer `ok`. Se alguma vez se tirar a recusa do servidor, o teste
tem de falhar — foi assim que se provou o defeito no site publicado.

---

## Porquê esta regra e não uma lista de boas intenções

O Malha Viva é feito de pessoas a contar o sítio onde vivem. Um testemunho
que só se alcança com o rato e com a vista é um testemunho que fica fechado
a parte de quem o quer ouvir — e a razão de ser do projecto é o contrário
disso.
