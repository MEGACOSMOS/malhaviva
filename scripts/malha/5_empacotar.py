"""Passo 5 — as peças que o site descarrega.

Uma peça por atlas (bairro_NN.glb, com a textura lá dentro) e o índice
public/malha/malha.json, com o peso de cada peça (é por esses bytes que o
ecrã de espera se acende).

A textura vai em KTX2 (Basis ETC1S, com níveis de pormenor): a placa
gráfica guarda-a comprimida, oito vezes menos memória do que uma imagem
normal. Faz-se com o `ktx` da Khronos (KTX-Software 4.4; KTX=caminho se não
estiver no sítio de origem). Com `webp` no lugar do formato vai em WebP,
como na primeira versão (v1).

Se o passo 4 já fez as árvores desta versão (public/malha/<versão>/arvores),
as copas da malha são baixadas até ao chão (ver `sem_copas`) e o índice
passa a apontar também para as manchas das árvores.

Uso: python 5_empacotar.py <versão> [lado da textura] [G] [ktx2|webp]
As peças ficam em public/malha/<versão>/ e o índice aponta para lá: uma
malha refeita muda de versão (v2, v3…), e nunca se misturam peças de duas.
Apague à mão a pasta da versão antiga.
"""
import json, struct, sys, os, io, subprocess, tempfile
import numpy as np, DracoPy
from PIL import Image
from comum import TRABALHO, PUBLICO
VERSAO = sys.argv[1]
LADO = int(sys.argv[2]) if len(sys.argv) > 2 else 2048
G = float(sys.argv[3]) if len(sys.argv) > 3 else 2.5
FORMATO = sys.argv[4] if len(sys.argv) > 4 else "ktx2"
KTX = os.environ.get("KTX") or os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "KTX-Software", "bin", "ktx.exe")
TRAB = os.path.join(TRABALHO, "g%g" % G)
SITE = os.path.join(PUBLICO, "malha")
PASTA_ARVORES = os.path.join(SITE, VERSAO, "arvores")
COM_ARVORES = os.path.exists(os.path.join(PASTA_ARVORES, "meta.json"))
if COM_ARVORES:
    A = np.load(os.path.join(TRABALHO, "arvores", "arvores.npz"))
    A_R, A_X0, A_Z0 = float(A["R"]), float(A["X0"]), float(A["Z0"])
    A_LARGO, A_DTM, A_ARV = A["largo"], A["dtm"], A["arv"]


def sem_copas(draco, atlas):
    """A geometria de um atlas com as copas das árvores baixadas até ao chão.

    As copas não se apagam: a malha não tem chão debaixo delas (o drone não
    o vê), e apagá-las deixava buracos para o vazio, que as manchas das
    árvores, espaçadas, não chegam a tapar. Em vez disso, os vértices que só
    pertencem a copas descem até um pouco abaixo do chão: a superfície fica
    inteira, e debaixo das árvores fica a fotografia da copa vista de cima.

    É copa um triângulo dentro da zona das árvores, com o centro mais de
    0,8 m acima do chão e, na orla (fora do miolo), verde na fotografia — as
    paredes e os telhados encostados às árvores ficam como estão.
    Devolve (draco novo, ids dos atributos, triângulos, vértices, baixados)."""
    d = DracoPy.decode(draco)
    P = np.asarray(d.points, np.float64); F = np.asarray(d.faces, np.int64).reshape(-1, 3)
    UV = np.asarray(d.tex_coord, np.float64)
    c = P[F].mean(1)
    i = ((c[:, 0] - A_X0) / A_R).astype(int); j = ((c[:, 2] - A_Z0) / A_R).astype(int)
    ok = (i >= 0) & (i < A_LARGO.shape[1]) & (j >= 0) & (j < A_LARGO.shape[0])
    # Cor de cada triângulo na fotografia: a média dos três cantos e do meio.
    lado = atlas.shape[0]
    def cor(uv):
        x = np.clip((uv[:, 0] * lado).astype(int), 0, lado - 1); y = np.clip((uv[:, 1] * lado).astype(int), 0, lado - 1)
        return atlas[y, x].astype(np.float64)
    rgb = (cor(UV[F[:, 0]]) + cor(UV[F[:, 1]]) + cor(UV[F[:, 2]]) + cor(UV[F].mean(1))) / 4
    verde = (2 * rgb[:, 1] - rgb[:, 0] - rgb[:, 2]) / (rgb.sum(1) + 1e-6) > 0.03
    copa = np.zeros(len(F), bool)
    io, jo = i[ok], j[ok]
    copa[ok] = A_LARGO[jo, io] & (c[ok, 1] > A_DTM[jo, io] + 0.8) & (A_ARV[jo, io] | verde[ok])
    # Vértices só de copas (nenhum triângulo que fica os usa) descem ao chão.
    fica = np.zeros(len(P), bool); fica[F[~copa].ravel()] = True
    desce = np.zeros(len(P), bool); desce[F[copa].ravel()] = True; desce &= ~fica
    vi = np.clip(((P[:, 0] - A_X0) / A_R).astype(int), 0, A_LARGO.shape[1] - 1)
    vj = np.clip(((P[:, 2] - A_Z0) / A_R).astype(int), 0, A_LARGO.shape[0] - 1)
    P[desce, 1] = np.minimum(P[desce, 1], A_DTM[vj[desce], vi[desce]] - 0.15)
    e = DracoPy.encode(P, F, quantization_bits=16, compression_level=7, tex_coord=UV, tex_coord_quantization_bits=14)
    dd = DracoPy.decode(e)
    novos = {x["attribute_type"]: x["unique_id"] for x in dd.attributes}
    return e, {"POSITION": novos[0], "TEXCOORD_0": novos[3]}, len(np.asarray(dd.faces).reshape(-1, 3)), len(np.asarray(dd.points)), int(copa.sum())


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
    atributos = ext["attributes"]
    acc = [dict(g["accessors"][pr["indices"]]), dict(g["accessors"][pr["attributes"]["POSITION"]]),
           dict(g["accessors"][pr["attributes"]["TEXCOORD_0"]])]
    im = Image.open(os.path.join(TRAB, "atlas_%02d.png" % i))
    if COM_ARVORES:
        draco, atributos, nt, nv, baixados = sem_copas(draco, np.asarray(im.convert("RGB")))
        acc[0]["count"] = nt * 3; acc[1]["count"] = nv; acc[2]["count"] = nv
        print("  triângulos de copa baixados ao chão:", baixados)
    if im.size[0] != LADO:
        im = im.resize((LADO, LADO), Image.LANCZOS)
    imagem, tipo, extensao = textura(im)
    b = bytearray(draco)
    b += b"\0" * (-len(b) % 4)
    off = len(b)
    b += imagem
    js = {"asset": g["asset"],
          "extensionsUsed": ["KHR_draco_mesh_compression", "KHR_materials_unlit", extensao],
          "extensionsRequired": ["KHR_draco_mesh_compression", extensao],
          "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "bairro_%02d" % i}],
          "meshes": [{"primitives": [{"attributes": {"POSITION": 1, "TEXCOORD_0": 2}, "indices": 0, "material": 0, "mode": 4,
                      "extensions": {"KHR_draco_mesh_compression": {"bufferView": 0, "attributes": atributos}}}]}],
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
indice = {"versao": 1, "textura": LADO, "formato": FORMATO, "pecas": pecas}
if COM_ARVORES:
    indice["arvores"] = {"ficheiro": VERSAO + "/arvores/meta.json",
                         "bytes": sum(os.path.getsize(os.path.join(PASTA_ARVORES, f)) for f in os.listdir(PASTA_ARVORES)),
                         "manchas": json.load(open(os.path.join(PASTA_ARVORES, "meta.json")))["count"]}
json.dump(indice,
          open(os.path.join(SITE, "malha.json"), "w"), indent=1)
print("total MB", sum(p["bytes"] for p in pecas) / 1e6)
