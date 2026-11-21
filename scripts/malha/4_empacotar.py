"""Passo 4 — as peças que o site descarrega.

Uma peça por atlas (bairro_NN.glb, com a textura lá dentro) e o índice
public/malha/malha.json, com o peso de cada peça (é por esses bytes que o
ecrã de espera se acende).

A textura vai em KTX2 (Basis ETC1S, com níveis de pormenor): a placa
gráfica guarda-a comprimida, oito vezes menos memória do que uma imagem
normal. Faz-se com o `ktx` da Khronos (KTX-Software 4.4; KTX=caminho se não
estiver no sítio de origem). Com `webp` no lugar do formato vai em WebP,
como na primeira versão (v1).

Uso: python 4_empacotar.py <versão> [lado da textura] [G] [ktx2|webp]
As peças ficam em public/malha/<versão>/ e o índice aponta para lá: uma
malha refeita muda de versão (v2, v3…), e nunca se misturam peças de duas.
Apague à mão a pasta da versão antiga.
"""
import json, struct, sys, os, io, subprocess, tempfile
from PIL import Image
from comum import TRABALHO, PUBLICO
VERSAO = sys.argv[1]
LADO = int(sys.argv[2]) if len(sys.argv) > 2 else 2048
G = float(sys.argv[3]) if len(sys.argv) > 3 else 2.5
FORMATO = sys.argv[4] if len(sys.argv) > 4 else "ktx2"
KTX = os.environ.get("KTX") or os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "KTX-Software", "bin", "ktx.exe")
TRAB = os.path.join(TRABALHO, "g%g" % G)
SITE = os.path.join(PUBLICO, "malha")


def textura(im):
    """(bytes, mimeType, extensão do glTF) da imagem de um atlas."""
    if FORMATO == "webp":
        f = io.BytesIO()
        im.save(f, "WEBP", quality=88, method=6)
        return f.getvalue(), "image/webp", "EXT_texture_webp"
    with tempfile.TemporaryDirectory() as d:
        png, ktx2 = os.path.join(d, "a.png"), os.path.join(d, "a.ktx2")
        im.convert("RGB").save(png)
        # Qualidade 255: mais fiel do que o WebP de 1024 px da v1 (PSNR 32,3
        # contra 29,3 dB num atlas de ensaio), cerca de 850 KB por atlas.
        subprocess.run([KTX, "create", "--format", "R8G8B8_SRGB", "--assign-tf", "srgb",
                        "--encode", "basis-lz", "--clevel", "2", "--qlevel", "255",
                        "--generate-mipmap", png, ktx2], check=True)
        return open(ktx2, "rb").read(), "image/ktx2", "KHR_texture_basisu"


def glb(js, b):
    j = json.dumps(js, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    b = bytes(b) + b"\0" * (-len(b) % 4)
    return struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(j) + 8 + len(b)) + \
        struct.pack("<I4s", len(j), b"JSON") + j + struct.pack("<I4s", len(b), b"BIN\0") + b


g = json.load(open(os.path.join(TRAB, "bairro.gltf.json")))
binario = open(os.path.join(TRAB, "bairro.bin"), "rb").read()
os.makedirs(os.path.join(SITE, VERSAO), exist_ok=True)
pecas = []
for i, mesh in enumerate(g["meshes"]):
    pr = mesh["primitives"][0]
    ext = pr["extensions"]["KHR_draco_mesh_compression"]
    bv = g["bufferViews"][ext["bufferView"]]
    draco = binario[bv["byteOffset"]:bv["byteOffset"] + bv["byteLength"]]
    im = Image.open(os.path.join(TRAB, "atlas_%02d.png" % i))
    if im.size[0] != LADO:
        im = im.resize((LADO, LADO), Image.LANCZOS)
    imagem, tipo, extensao = textura(im)
    b = bytearray(draco)
    b += b"\0" * (-len(b) % 4)
    off = len(b)
    b += imagem
    acc = [dict(g["accessors"][pr["indices"]]), dict(g["accessors"][pr["attributes"]["POSITION"]]),
           dict(g["accessors"][pr["attributes"]["TEXCOORD_0"]])]
    js = {"asset": g["asset"],
          "extensionsUsed": ["KHR_draco_mesh_compression", "KHR_materials_unlit", extensao],
          "extensionsRequired": ["KHR_draco_mesh_compression", extensao],
          "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "bairro_%02d" % i}],
          "meshes": [{"primitives": [{"attributes": {"POSITION": 1, "TEXCOORD_0": 2}, "indices": 0, "material": 0, "mode": 4,
                      "extensions": {"KHR_draco_mesh_compression": {"bufferView": 0, "attributes": ext["attributes"]}}}]}],
          "materials": [{"pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1},
                         "extensions": {"KHR_materials_unlit": {}}}],
          "textures": [{"sampler": 0, "extensions": {extensao: {"source": 0}}}],
          "samplers": g["samplers"],
          "images": [{"bufferView": 1, "mimeType": tipo}],
          "accessors": acc,
          "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(draco)},
                          {"buffer": 0, "byteOffset": off, "byteLength": len(imagem)}],
          "buffers": [{"byteLength": len(b)}]}
    nome = VERSAO + "/bairro_%02d.glb" % i
    dados = glb(js, b)
    open(os.path.join(SITE, nome), "wb").write(dados)
    a = acc[1]
    pecas.append({"ficheiro": nome, "bytes": len(dados), "min": a["min"], "max": a["max"], "triangulos": acc[0]["count"] // 3})
    print(nome, len(dados) // 1024, "KB")
json.dump({"versao": 1, "textura": LADO, "formato": FORMATO, "pecas": pecas},
          open(os.path.join(SITE, "malha.json"), "w"), indent=1)
print("total MB", sum(p["bytes"] for p in pecas) / 1e6)
