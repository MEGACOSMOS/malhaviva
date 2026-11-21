"""Escreve um splat no formato SOG (versão 2, o do site): meta.json e cinco
imagens WebP sem perdas. As posições vão em 16 bits por eixo, em escala
logarítmica; as escalas e as cores em índices de um livro de 256 valores,
tirado aqui dos próprios valores (quantis); a rotação e a opacidade passam
tal como vieram do splat do site."""
import json, os, numpy as np
from PIL import Image
def escrever_sog(pasta, pos, esc, sh0, alfa, quat):
    os.makedirs(pasta, exist_ok=True)
    n = len(pos); W = int(np.ceil(np.sqrt(n) / 4) * 4); H = int(np.ceil(n / W / 4) * 4)
    def guardar(nome, rgba):
        a = np.zeros((W * H, 4), np.uint8); a[:, 3] = 255; a[:n] = rgba
        Image.fromarray(a.reshape(H, W, 4), "RGBA").save(os.path.join(pasta, nome), lossless=True, quality=100, method=6, exact=True)
    l = np.sign(pos) * np.log(np.abs(pos.astype(np.float64)) + 1)
    mn, mx = l.min(0), l.max(0)
    q = np.round((l - mn) / np.maximum(mx - mn, 1e-12) * 65535).astype(np.uint32)
    lo = np.zeros((n, 4), np.uint8); lo[:, :3] = q & 255; lo[:, 3] = 255
    up = np.zeros((n, 4), np.uint8); up[:, :3] = q >> 8; up[:, 3] = 255
    guardar("means_l.webp", lo); guardar("means_u.webp", up)
    def livro(v):
        cb = np.unique(np.quantile(v.ravel(), np.linspace(0, 1, 256)).astype(np.float32))
        if len(cb) < 256: cb = np.concatenate([cb, np.full(256 - len(cb), cb[-1], np.float32)])
        cb = np.sort(cb)
        idx = np.clip(np.searchsorted(cb, v), 1, 255)
        idx = np.where(np.abs(v - cb[idx - 1]) < np.abs(v - cb[idx]), idx - 1, idx)
        return cb, idx.astype(np.uint8)
    cbs, ie = livro(esc); s = np.zeros((n, 4), np.uint8); s[:, :3] = ie; s[:, 3] = 255; guardar("scales.webp", s)
    cb0, ic = livro(sh0); c = np.zeros((n, 4), np.uint8); c[:, :3] = ic; c[:, 3] = alfa; guardar("sh0.webp", c)
    guardar("quats.webp", quat)
    meta = {"version": 2, "asset": {"generator": "Malha Viva — scripts/malha"}, "count": int(n),
            "means": {"mins": mn.tolist(), "maxs": mx.tolist(), "files": ["means_l.webp", "means_u.webp"]},
            "scales": {"codebook": cbs.tolist(), "files": ["scales.webp"]},
            "quats": {"files": ["quats.webp"]},
            "sh0": {"codebook": cb0.tolist(), "files": ["sh0.webp"]}}
    json.dump(meta, open(os.path.join(pasta, "meta.json"), "w"))
    return sum(os.path.getsize(os.path.join(pasta, f)) for f in os.listdir(pasta))
