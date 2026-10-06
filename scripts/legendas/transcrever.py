"""Transcribe every video with WhisperX (large-v3 + wav2vec2 word alignment)
and, as a second opinion, with plain faster-whisper (sequential, beam 5).

Outputs per video, in dados/out/:
  <nome>.wx.json   WhisperX aligned segments with word timings
  <nome>.fw.json   faster-whisper segments with word timings
"""
import gc
import glob
import json
import os
import sys
import time

import av
import numpy as np
import torch

# CTranslate2 (faster-whisper) finds cuBLAS/cuDNN in torch's own folder.
_LIB = os.path.join(os.path.dirname(torch.__file__), 'lib')
os.add_dll_directory(_LIB)
os.environ['PATH'] = _LIB + os.pathsep + os.environ['PATH']

AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.join(AQUI, 'dados')
SAIDA = os.path.join(PASTA, 'out')
os.makedirs(SAIDA, exist_ok=True)

PROMPT = ('Testemunhos de moradores do Bairro de Penajóia, em Almada. '
          'Dulce, Luna, Sofia, Frei, Edson, Edmilson, Carlos, Esvarena.')


def ler_audio(caminho):
    """Decode to 16 kHz mono float32, the input Whisper expects."""
    c = av.open(caminho)
    s = next(x for x in c.streams if x.type == 'audio')
    r = av.AudioResampler(format='flt', layout='mono', rate=16000)
    partes = []
    for frame in c.decode(s):
        for f in r.resample(frame):
            partes.append(f.to_ndarray().reshape(-1))
    for f in r.resample(None):
        partes.append(f.to_ndarray().reshape(-1))
    return np.concatenate(partes).astype(np.float32)


def nome_de(caminho):
    return os.path.basename(caminho).replace('_480p.mp4', '')


def main():
    so = sys.argv[1:]  # optional: only these names
    ficheiros = sorted(glob.glob(os.path.join(PASTA, '*_480p.mp4')))
    if so:
        ficheiros = [f for f in ficheiros if nome_de(f) in so]
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    compute = 'float16' if device == 'cuda' else 'int8'
    print('device', device, torch.cuda.get_device_name(0) if device == 'cuda' else '', flush=True)

    audios = {nome_de(f): ler_audio(f) for f in ficheiros}

    # --- 1. WhisperX ---
    import whisperx
    modelo = whisperx.load_model('large-v3', device, compute_type=compute,
                                 asr_options={'initial_prompt': PROMPT, 'beam_size': 5})
    resultados = {}
    for nome, audio in audios.items():
        t0 = time.time()
        r = modelo.transcribe(audio, batch_size=8)
        resultados[nome] = r
        print('wx', nome, r['language'], len(r['segments']), 'segs', round(time.time() - t0, 1), 's', flush=True)
    del modelo
    gc.collect()
    torch.cuda.empty_cache()

    alinhadores = {}
    for nome, r in resultados.items():
        lingua = r['language']
        if lingua not in alinhadores:
            alinhadores[lingua] = whisperx.load_align_model(language_code=lingua, device=device)
        am, meta = alinhadores[lingua]
        a = whisperx.align(r['segments'], am, meta, audios[nome], device, return_char_alignments=False)
        a['language'] = lingua
        with open(os.path.join(SAIDA, nome + '.wx.json'), 'w', encoding='utf-8') as f:
            json.dump(a, f, ensure_ascii=False, indent=1)
    del alinhadores
    gc.collect()
    torch.cuda.empty_cache()

    # --- 2. faster-whisper, sequential, as a cross-check ---
    from faster_whisper import WhisperModel
    fw = WhisperModel('large-v3', device=device, compute_type=compute)
    for nome, audio in audios.items():
        t0 = time.time()
        segs, info = fw.transcribe(audio, beam_size=5, word_timestamps=True, vad_filter=True,
                                   initial_prompt=PROMPT, condition_on_previous_text=False)
        lista = []
        for s in segs:
            lista.append({'start': s.start, 'end': s.end, 'text': s.text,
                          'words': [{'start': w.start, 'end': w.end, 'word': w.word, 'p': w.probability}
                                    for w in (s.words or [])]})
        with open(os.path.join(SAIDA, nome + '.fw.json'), 'w', encoding='utf-8') as f:
            json.dump({'language': info.language, 'language_probability': info.language_probability,
                       'segments': lista}, f, ensure_ascii=False, indent=1)
        print('fw', nome, info.language, round(info.language_probability, 2), len(lista), 'segs',
              round(time.time() - t0, 1), 's', flush=True)


if __name__ == '__main__':
    main()
