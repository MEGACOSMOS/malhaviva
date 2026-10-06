"""Phonetic 'ear': IPA phonemes of audio windows, with a multilingual
wav2vec2 phoneme recogniser. Usage: ouvir.py "<nome>" start-end [start-end ...]"""
import os
import sys

import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2FeatureExtractor
from transformers import AutoTokenizer  # noqa: F401

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from transcrever import PASTA, ler_audio  # noqa: E402

MODELO = 'facebook/wav2vec2-xlsr-53-espeak-cv-ft'
ext = Wav2Vec2FeatureExtractor.from_pretrained(MODELO)
model = Wav2Vec2ForCTC.from_pretrained(MODELO).to('cuda').eval()
import json  # noqa: E402
from huggingface_hub import hf_hub_download  # noqa: E402
vocab = json.load(open(hf_hub_download(MODELO, 'vocab.json'), encoding='utf-8'))
inv = {v: k for k, v in vocab.items()}

nome = sys.argv[1]
audio = ler_audio(os.path.join(PASTA, nome + '_480p.mp4'))
for janela in sys.argv[2:]:
    a, b = (float(x) for x in janela.split('-'))
    trecho = audio[int(a * 16000):int(b * 16000)]
    x = ext(trecho, sampling_rate=16000, return_tensors='pt').input_values.to('cuda')
    with torch.no_grad():
        ids = model(x).logits.argmax(-1)[0].tolist()
    out, prev = [], None
    for i in ids:
        if i != prev:
            t = inv.get(i, '')
            if t not in ('<pad>', '<s>', '</s>', '<unk>'):
                out.append(t)
        prev = i
    texto = ''.join(' ' if t == '|' else t + ' ' for t in out)
    print(f'[{a:.2f}-{b:.2f}]', ' '.join(texto.split()))
