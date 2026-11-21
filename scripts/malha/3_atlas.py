"""Passo 3 — as texturas juntas em atlas, e a malha na cena.

As peças do MipMap trazem cada uma as suas imagens (centenas de 1024 px): um
telemóvel não as aguenta todas nem as desenha de uma vez. Aqui cada imagem é
cortada ao que os triângulos usam, reduzida, e arrumada em até N_ATLAS
imagens de LADO px, por ordem espacial (curva de Morton), para cada atlas
cobrir uma zona do bairro — o que fica fora da vista não se desenha. As UV
são refeitas para o atlas, as posições passam para a cena do site, e a
geometria de cada atlas é comprimida com Draco.

Uso: python 3_atlas.py [G]   (o G do passo 2; por omissão 2,5)
Escreve em <trabalho>/g<G>/: atlas_NN.png (sem perdas), bairro.gltf.json e
bairro.bin.
"""
import numpy as np, pickle, io, json, struct, sys, os, DracoPy
from PIL import Image
from comum import TRABALHO, ALTURA_DA_CENA
G = float(sys.argv[1]) if len(sys.argv) > 1 else 2.5
ENTRADA = os.path.join(TRABALHO, "recorte_%g.pkl" % G)
SAIDA = os.path.join(TRABALHO, "g%g" % G)
N_ATLAS, LADO, PAD = 16, 2048, 8
os.makedirs(SAIDA, exist_ok=True)
prims = pickle.load(open(ENTRADA, "rb"))
for p in prims:
    p["img"] = Image.open(io.BytesIO(p["jpg"])).convert("RGB")
    w, h = p["img"].size
    u = np.clip(p["UV"], 0, 1)
    # caixa usada da imagem, em pixéis, com margem
    x0 = max(0, int(np.floor(u[:, 0].min() * w)) - 2); x1 = min(w, int(np.ceil(u[:, 0].max() * w)) + 2)
    y0 = max(0, int(np.floor(u[:, 1].min() * h)) - 2); y1 = min(h, int(np.ceil(u[:, 1].max() * h)) + 2)
    p["caixa"] = (x0, y0, x1, y1); p["UVpx"] = u * [w, h]
    c = p["P"][:, :2].mean(0); p["cen"] = c
# ordem espacial (curva de Morton) para cada atlas cobrir uma zona do bairro
def morton(x, y):
    def sep(v):
        v &= 0xFFFF; v = (v | (v << 8)) & 0x00FF00FF; v = (v | (v << 4)) & 0x0F0F0F0F
        v = (v | (v << 2)) & 0x33333333; return (v | (v << 1)) & 0x55555555
    return sep(x) | (sep(y) << 1)
cs = np.array([p["cen"] for p in prims]); lo = cs.min(0); hi = cs.max(0)
q = ((cs - lo) / (hi - lo) * 65535).astype(int)
prims = [prims[i] for i in np.argsort([morton(a, b) for a, b in q])]

def arrumar(s):
    """Prateleiras, por ordem espacial. Devolve lista de (atlas, x, y, w, h) ou None."""
    res = []; a = 0; x = 0; y = 0; alt = 0
    for p in prims:
        x0, y0, x1, y1 = p["caixa"]
        w = max(4, int(round((x1 - x0) * s))) + 2 * PAD; h = max(4, int(round((y1 - y0) * s))) + 2 * PAD
        if w > LADO or h > LADO: return None
        if x + w > LADO: x = 0; y += alt; alt = 0
        if y + h > LADO: a += 1; x = 0; y = 0; alt = 0
        if a >= N_ATLAS: return None
        res.append((a, x, y, w, h)); x += w; alt = max(alt, h)
    return res
# Escalas em que as peças de 1024 px enchem o atlas em grelha certa (k por
# lado); fica a maior que cabe nos atlas disponíveis.
s = None
for k in range(3, 12):
    c = (LADO // k - 2 * PAD) / 1024
    if arrumar(c): s = c; break
lugar = arrumar(s)
print("escala", round(s, 4), "atlas", lugar[-1][0] + 1)
atlas = [np.zeros((LADO, LADO, 3), np.uint8) for _ in range(N_ATLAS)]
grupos = [[] for _ in range(N_ATLAS)]
for p, (a, x, y, w, h) in zip(prims, lugar):
    x0, y0, x1, y1 = p["caixa"]
    iw, ih = w - 2 * PAD, h - 2 * PAD
    peca = np.asarray(p["img"].crop((x0, y0, x1, y1)).resize((iw, ih), Image.LANCZOS))
    peca = np.pad(peca, ((PAD, PAD), (PAD, PAD), (0, 0)), mode="edge")
    atlas[a][y:y + h, x:x + w] = peca
    # UV novas: pixel da imagem original -> pixel do atlas
    sx = iw / (x1 - x0); sy = ih / (y1 - y0)
    U = (x + PAD + (p["UVpx"][:, 0] - x0) * sx) / LADO
    V = (y + PAD + (p["UVpx"][:, 1] - y0) * sy) / LADO
    E, N, Uu = p["P"][:, 0], p["P"][:, 1], p["P"][:, 2]
    cena = np.stack([E, Uu + ALTURA_DA_CENA, -N], 1).astype(np.float32)
    grupos[a].append((cena, np.stack([U, V], 1).astype(np.float32), p["F"]))
usados = lugar[-1][0] + 1
for a in range(usados):
    Image.fromarray(atlas[a]).save(os.path.join(SAIDA, "atlas_%02d.png" % a))

# --- GLB ---
bin_ = bytearray(); bvs = []; acc = []; meshes = []; nodes = []
def junta(b):
    while len(bin_) % 4: bin_.append(0)
    bvs.append({"buffer": 0, "byteOffset": len(bin_), "byteLength": len(b)}); bin_.extend(b); return len(bvs) - 1
for a in range(usados):
    P = []; T = []; F = []; base = 0
    for cena, uv, f in grupos[a]:
        P.append(cena); T.append(uv); F.append(f + base); base += len(cena)
    P = np.concatenate(P); T = np.concatenate(T); F = np.concatenate(F)
    d = DracoPy.encode(P.astype(np.float64), F, quantization_bits=16, compression_level=7, tex_coord=T.astype(np.float64), tex_coord_quantization_bits=14)
    dd = DracoPy.decode(d)
    nv = len(np.asarray(dd.points)) ; nf = len(np.asarray(dd.faces).reshape(-1, 3))
    # O número de cada atributo dentro do Draco: o DracoPy põe as UV primeiro.
    ids = {a["attribute_type"]: a["unique_id"] for a in dd.attributes}
    ID_POS, ID_UV = ids[0], ids[3]
    bv = junta(d)
    ia = len(acc); acc.append({"componentType": 5125, "count": nf * 3, "type": "SCALAR"})
    pa = len(acc); acc.append({"componentType": 5126, "count": nv, "type": "VEC3", "min": P.min(0).tolist(), "max": P.max(0).tolist()})
    ta = len(acc); acc.append({"componentType": 5126, "count": nv, "type": "VEC2"})
    meshes.append({"primitives": [{"attributes": {"POSITION": pa, "TEXCOORD_0": ta}, "indices": ia, "material": a, "mode": 4,
                   "extensions": {"KHR_draco_mesh_compression": {"bufferView": bv, "attributes": {"POSITION": ID_POS, "TEXCOORD_0": ID_UV}}}}]})
    nodes.append({"mesh": a, "name": "bairro_%02d" % a})
    print("atlas", a, "triângulos", len(F), "vértices", nv, "draco KB", len(d) // 1024)
gltf = {"asset": {"version": "2.0", "generator": "Malha Viva — scripts/malha"},
        "extensionsUsed": ["KHR_draco_mesh_compression", "KHR_materials_unlit"],
        "extensionsRequired": ["KHR_draco_mesh_compression"],
        "scene": 0, "scenes": [{"nodes": list(range(usados))}], "nodes": nodes, "meshes": meshes,
        "materials": [{"pbrMetallicRoughness": {"baseColorTexture": {"index": a}, "metallicFactor": 0, "roughnessFactor": 1},
                       "extensions": {"KHR_materials_unlit": {}}, "doubleSided": False} for a in range(usados)],
        "textures": [{"sampler": 0, "source": a} for a in range(usados)],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"uri": "atlas_%02d.png" % a} for a in range(usados)],
        "accessors": acc, "bufferViews": bvs, "buffers": [{"byteLength": len(bin_)}]}
json.dump(gltf, open(os.path.join(SAIDA, "bairro.gltf.json"), "w"))
open(os.path.join(SAIDA, "bairro.bin"), "wb").write(bin_)
print("geometria KB", len(bin_) // 1024)
