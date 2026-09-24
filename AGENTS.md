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
   marcador — um microfone, um olho, a palavra 360º — não se lê em voz
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

### Como verificar, em dez segundos

Com o site a correr, na consola do navegador:

```js
[...document.querySelectorAll('.annotation-marker')]
    .map(m => m.getAttribute('role') + ' · ' + m.getAttribute('aria-label'));
```

Todas as linhas têm de dizer `button` e um nome. Nenhuma pode dizer `null`
nem ficar vazia.

---

## Porquê esta regra e não uma lista de boas intenções

O Malha Viva é feito de pessoas a contar o sítio onde vivem. Um testemunho
que só se alcança com o rato e com a vista é um testemunho que fica fechado
a parte de quem o quer ouvir — e a razão de ser do projecto é o contrário
disso.
