"""O que os passos do bairro em malha partilham: onde estão as coisas, como
se lê uma peça da malha do MipMap e a árvore de peças. Ver LEIA-ME.md."""
import json, os, struct

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(AQUI, "..", ".."))
PUBLICO = os.path.join(SITE, "public")

# O resultado do MipMap Desktop (o mesmo processamento do gaussian splat).
MIPMAP = os.environ.get("MIPMAP_RESULTADO") or (
    r"E:/mipmap-desktop/a27723fa-bd8f-4a3a-8556-053d4135be0c/Bairro de Penajóia/"
    r"Bairro de Penajóia-20260728/result")
B3DM = os.path.join(MIPMAP, "3D", "model-b3dm")

# Ficheiros intermédios (pesados, fora do site).
TRABALHO = os.environ.get("MALHA_TRABALHO") or r"E:/Malha Viva - trabalho/malha"
os.makedirs(TRABALHO, exist_ok=True)

# A malha e o splat estão no mesmo referencial do MipMap: ENU com origem em
# 38.6715844022 N, -9.1824929236 (model-gs-ply/metadata.xml), x leste,
# y norte, z cima, em metros. A cena do site é (leste, cima + ALTURA, -norte).
# Medido em 2026-11-21 contra as manchas do próprio site (moda da diferença
# de altura entre manchas opacas e a superfície da malha, 0 de desvio na
# horizontal a 25 cm); é o mesmo número que a navegação mediu em 2026-10-28
# entre o splat optimizado e o completo (52,99).
ALTURA_DA_CENA = 52.985


def ler_b3dm(caminho):
    """Uma peça .b3dm: (tabela de características, json do glTF, binário)."""
    b = open(caminho, "rb").read()
    _, _, _, ftj, ftb, btj, btb = struct.unpack("<4sIIIIII", b[:28])
    o = 28
    ft = json.loads(b[o:o + ftj] or b"{}")
    o += ftj + ftb + btj + btb
    glb = b[o:]
    _, _, comprimento = struct.unpack("<4sII", glb[:12])
    glb = glb[:comprimento]
    o = 12
    js = binario = None
    while o + 8 <= len(glb):
        cl, ct = struct.unpack("<II", glb[o:o + 8])
        c = glb[o + 8:o + 8 + cl]
        if ct == 0x4E4F534A:
            js = json.loads(c)
        else:
            binario = c
        o += 8 + cl
    return ft, js, binario


def arvore():
    """A árvore de peças do tileset (refinamento REPLACE), já com caminhos."""
    def visita(n, base):
        c = n.get("content", {}).get("uri")
        if c and c.endswith(".json"):
            sub = json.load(open(os.path.join(base, c)))
            return visita(sub["root"], os.path.dirname(os.path.join(base, c)))
        reg = {"uri": os.path.join(base, c) if c else None, "ge": n["geometricError"],
               "box": n["boundingVolume"]["box"], "filhos": []}
        for ch in n.get("children", []):
            r = visita(ch, base)
            if r:
                reg["filhos"].append(r)
        return reg
    raiz = json.load(open(os.path.join(B3DM, "tileset.json")))["root"]
    topo = {"uri": None, "ge": raiz["geometricError"], "box": raiz["boundingVolume"]["box"], "filhos": []}
    for ch in raiz["children"]:
        uri = os.path.join(B3DM, ch["content"]["uri"])
        topo["filhos"].append(visita(json.load(open(uri))["root"], os.path.dirname(uri)))
    return topo


def corte(n, G, toca):
    """As peças a usar para um erro geométrico <= G, só as que tocam a zona."""
    if not toca(n["box"]):
        return []
    if (n["ge"] <= G or not n["filhos"]) and n["uri"]:
        return [n]
    r = []
    for f in n["filhos"]:
        r += corte(f, G, toca)
    return r
