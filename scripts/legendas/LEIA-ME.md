# Legendas dos vídeos

As legendas que o site mostra vivem em `public/legendas/<vídeo>/<língua>.vtt`
(português, inglês e espanhol; em Kriolu mostra-se a portuguesa). São texto
simples: **para corrigir uma palavra, edita-se o `.vtt` diretamente** e
sobe-se o número `VERSAO` em `public/legendas.js`, para os navegadores não
ficarem com a antiga.

Esta pasta guarda como foram feitas, para se poderem refazer se um vídeo for
remontado.

## Como foram feitas (outubro de 2026)

1. **Transcrição, cinco vezes** (`transcrever.py`, `mais_opinioes.py`):
   WhisperX (Whisper large-v3 com alinhamento wav2vec2), faster-whisper
   large-v3, large-v2, large-v3-turbo e large-v3 sem filtro de voz. Cada
   modelo erra em sítios diferentes; um deles chegou a saltar um trecho
   inteiro do Edmilson.
2. **Comparação e revisão à mão** (`comparar.py` mostra as cinco lado a
   lado; `ouvir.py` escreve os sons em alfabeto fonético para desempatar).
   O texto revisto está em `dados/pt/` — "verbatim limpo": as palavras e a
   maneira de falar de cada pessoa, sem hesitações nem repetições. Nomes e
   siglas acertados (IHRU, Penajóia, Esvarena). O Carlos mistura português
   e Kriolu; as partes em Kriolu estão passadas a português.
3. **Alinhamento palavra a palavra** (`alinhar.py`): o texto revisto é
   alinhado ao som com wav2vec2, e cortado em legendas — no máximo 2 linhas
   de 42 caracteres, até ~17 caracteres por segundo, cortes nos fins de
   frase e nunca depois de "a", "de", "para"…
4. **Tradução** legenda a legenda (`dados/tr/`, `i|inglês|espanhol`), com os
   mesmos tempos; `ajustar.py` guarda os acertos finais.
5. **Ficheiros finais** (`gerar_vtt.py <pasta public/legendas>`): parte cada
   legenda em linhas e avisa do que passar das regras.

## Refazer

Os passos 1–3 precisam de uma placa gráfica e de um ambiente Python à parte
com `whisperx` e o `torch` para CUDA 12.8 (`pip install whisperx`, depois
`pip install --force-reinstall --no-deps torch==2.8.0 torchaudio==2.8.0
--index-url https://download.pytorch.org/whl/cu128`), e das versões 480p dos
vídeos em `dados/<vídeo>_480p.mp4`. Mudar só uma tradução: editar
`dados/tr/` e correr `python gerar_vtt.py ../../public/legendas`.
