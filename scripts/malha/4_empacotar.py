"""Passo 4 — as peças que o site descarrega.

Uma peça por atlas (bairro_NN.glb, com a textura lá dentro, em WebP) e o
índice public/malha/malha.json, com o peso de cada peça (é por esses bytes
que o ecrã de espera se acende).

Uso: python 4_empacotar.py <versão> [lado da textura] [G]
As peças ficam em public/malha/<versão>/ e o índice aponta para lá: uma
malha refeita muda de versão (v2, v3…), e nunca se misturam peças de duas.
Apague à mão a pasta da versão antiga.
"""
import json, struct, sys, os, io, numpy as np
from PIL import Image
from comum import TRABALHO, PUBLICO
VERSAO = sys.argv[1]
LADO = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
G = float(sys.argv[3]) if len(sys.argv) > 3 else 2.5
TRAB = os.path.join(TRABALHO, "g%g" % G)
SITE = os.path.join(PUBLICO, "malha")
g = json.load(open(os.path.join(TRAB, "bairro.gltf.json")))
binario = open(os.path.join(TRAB, "bairro.bin"), "rb").read()
os.makedirs(os.path.join(SITE, VERSAO), exist_ok=True)
pecas = []
def glb(js, b):
    j = json.dumps(js, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4); b = bytes(b) + b"\0" * (-len(b) % 4)
    return struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(j) + 8 + len(b)) + \
        struct.pack("<I4s", len(j), b"JSON") + j + struct.pack("<I4s", len(b), b"BIN\0") + b
for i, mesh in enumerate(g["meshes"]):
    pr = mesh["primitives"][0]
    ext = pr["extensions"]["KHR_draco_mesh_compression"]
    bv = g["bufferViews"][ext["bufferView"]]
    draco = binario[bv["byteOffset"]:bv["byteOffset"] + bv["byteLength"]]
    im = Image.open(os.path.join(TRAB, "atlas_%02d.png" % i))
    if im.size[0] != LADO: im = im.resize((LADO, LADO), Image.LANCZOS)
    f = io.BytesIO(); im.save(f, "WEBP", quality=88, method=6); webp = f.getvalue()
    b = bytearray(draco); b += b"\0" * (-len(b) % 4); off = len(b); b += webp
    acc = [dict(g["accessors"][pr["indices"]]), dict(g["accessors"][pr["attributes"]["POSITION"]]), dict(g["accessors"][pr["attributes"]["TEXCOORD_0"]])]
    js = {"asset": g["asset"],
          "extensionsUsed": ["KHR_draco_mesh_compression", "KHR_materials_unlit", "EXT_texture_webp"],
          "extensionsRequired": ["KHR_draco_mesh_compression", "EXT_texture_webp"],
          "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "bairro_%02d" % i}],
          "meshes": [{"primitives": [{"attributes": {"POSITION": 1, "TEXCOORD_0": 2}, "indices": 0, "material": 0, "mode": 4,
                      "extensions": {"KHR_draco_mesh_compression": {"bufferView": 0, "attributes": ext["attributes"]}}}]}],
          "materials": [{"pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1},
                         "extensions": {"KHR_materials_unlit": {}}}],
          "textures": [{"sampler": 0, "extensions": {"EXT_texture_webp": {"source": 0}}}],
          "samplers": g["samplers"],
          "images": [{"bufferView": 1, "mimeType": "image/webp"}],
          "accessors": acc,
          "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(draco)},
                          {"buffer": 0, "byteOffset": off, "byteLength": len(webp)}],
          "buffers": [{"byteLength": len(b)}]}
    nome = VERSAO + "/bairro_%02d.glb" % i
    dados = glb(js, b)
    open(os.path.join(SITE, nome), "wb").write(dados)
    a = acc[1]
    pecas.append({"ficheiro": nome, "bytes": len(dados), "min": a["min"], "max": a["max"], "triangulos": acc[0]["count"] // 3})
    print(nome, len(dados) // 1024, "KB")
json.dump({"versao": 1, "textura": LADO, "pecas": pecas}, open(os.path.join(SITE, "malha.json"), "w"), indent=1)
print("total MB", sum(p["bytes"] for p in pecas) / 1e6)
