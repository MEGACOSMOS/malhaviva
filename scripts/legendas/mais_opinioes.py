"""Extra transcription hypotheses with faster-whisper large-v2 and
large-v3-turbo (sequential, beam 5, word timestamps), plus large-v3 with
VAD off, to catch passages the VAD-gated runs dropped."""
import json
import os
import sys

import torch
_LIB = os.path.join(os.path.dirname(torch.__file__), 'lib')
os.add_dll_directory(_LIB)
os.environ['PATH'] = _LIB + os.pathsep + os.environ['PATH']

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from transcrever import PASTA, SAIDA, PROMPT, ler_audio, nome_de  # noqa: E402
import glob  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402

PROMPT2 = PROMPT + ' O terreno é do IHRU e da Câmara de Almada.'

ficheiros = sorted(glob.glob(os.path.join(PASTA, '*_480p.mp4')))
audios = {nome_de(f): ler_audio(f) for f in ficheiros}

for etiqueta, modelo, vad in [('v2', 'large-v2', True), ('tb', 'large-v3-turbo', True), ('nv', 'large-v3', False)]:
    fw = WhisperModel(modelo, device='cuda', compute_type='float16')
    for nome, audio in audios.items():
        segs, info = fw.transcribe(audio, language='pt', beam_size=5, word_timestamps=True, vad_filter=vad,
                                   initial_prompt=PROMPT2, condition_on_previous_text=False)
        lista = [{'start': s.start, 'end': s.end, 'text': s.text,
                  'words': [{'start': w.start, 'end': w.end, 'word': w.word, 'p': w.probability} for w in (s.words or [])]}
                 for s in segs]
        with open(os.path.join(SAIDA, f'{nome}.{etiqueta}.json'), 'w', encoding='utf-8') as f:
            json.dump({'segments': lista}, f, ensure_ascii=False, indent=1)
        print(etiqueta, nome, len(lista), flush=True)
    del fw
    torch.cuda.empty_cache()
