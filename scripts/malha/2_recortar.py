"""Passo 2 — as peças da malha que tocam o bairro, recortadas pelo contorno.

Escolhe na árvore do MipMap as peças com erro geométrico até G metros
(argumento; por omissão 2,5 — o nível logo acima do mais fino, com cerca de
680 mil triângulos dentro do contorno), descomprime-as (Draco) e corta cada
triângulo pelo contorno do passo 1: os de dentro ficam, os de fora saem, e
os que o atravessam são cortados à medida (posição e UV interpoladas). As
paredes vistas de cima (sem área em planta) ficam ou saem pelo centro.
Guarda recorte_G.pkl na pasta de trabalho.
"""
import os, sys, json, pickle
import numpy as np, DracoPy, shapely
from shapely.geometry import Polygon
from comum import TRABALHO, arvore, corte, ler_b3dm as ler
poly = Polygon(json.load(open(os.path.join(TRABALHO, "contorno_enu.json"))))
shapely.prepare(poly)
bx0, by0, bx1, by1 = poly.bounds
def dentro(b):
    cx, cy = b[0], b[1]; hx, hy = abs(b[3]) + abs(b[6]), abs(b[4]) + abs(b[7])
    return cx + hx > bx0 and cx - hx < bx1 and cy + hy > by0 and cy - hy < by1
G = float(sys.argv[1]) if len(sys.argv) > 1 else 2.5
sel = corte(arvore(), G, dentro)
out = []; ntri = 0; ncort = 0
for n in sel:
    ft, js, b = ler(n["uri"])
    for mi, mesh in enumerate(js["meshes"]):
        for pr in mesh["primitives"]:
            ext = pr["extensions"]["KHR_draco_mesh_compression"]
            bv = js["bufferViews"][ext["bufferView"]]; o = bv.get("byteOffset", 0)
            d = DracoPy.decode(b[o:o + bv["byteLength"]])
            P = np.asarray(d.points, np.float64); F = np.asarray(d.faces, np.int64).reshape(-1, 3)
            UV = np.asarray(d.tex_coord, np.float64)
            img = js["images"][js["textures"][js["materials"][pr["material"]]["pbrMetallicRoughness"]["baseColorTexture"]["index"]]["source"]]
            ibv = js["bufferViews"][img["bufferView"]]; io_ = ibv.get("byteOffset", 0)
            jpg = b[io_:io_ + ibv["byteLength"]]
            ins = shapely.contains_xy(poly, P[:, 0], P[:, 1])
            k = ins[F].sum(1)
            keep = F[k == 3]
            novosP = [P]; novosUV = [UV]; base = len(P); extra = []
            for f in F[(k > 0) & (k < 3)]:
                a, bb, c = P[f]
                area2 = (bb[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (bb[1] - a[1])
                if abs(area2) < 1e-4:          # parede vista de cima: decide pelo centro
                    cen = (a + bb + c) / 3
                    if poly.contains(shapely.Point(cen[0], cen[1])): extra.append(list(f))
                    continue
                inter = Polygon([a[:2], bb[:2], c[:2]]).intersection(poly)
                if inter.is_empty: continue
                for t in shapely.constrained_delaunay_triangles(inter).geoms:
                    q = np.array(t.exterior.coords)[:3]
                    # baricêntricas no plano
                    M = np.array([[bb[0] - a[0], c[0] - a[0]], [bb[1] - a[1], c[1] - a[1]]])
                    st = np.linalg.solve(M, (q - a[:2]).T).T
                    w = np.stack([1 - st[:, 0] - st[:, 1], st[:, 0], st[:, 1]], 1)
                    novosP.append(w @ P[f]); novosUV.append(w @ UV[f])
                    extra.append([base, base + 1, base + 2]); base += 3; ncort += 1
            if extra: keep = np.concatenate([keep, np.array(extra, np.int64)])
            if len(keep) == 0: continue
            P2 = np.concatenate(novosP); UV2 = np.concatenate(novosUV)
            usados, inv = np.unique(keep, return_inverse=True)
            out.append({"P": P2[usados].astype(np.float32), "UV": UV2[usados].astype(np.float32),
                        "F": inv.reshape(-1, 3).astype(np.uint32), "jpg": jpg, "tile": n["uri"]})
            ntri += len(keep)
print("primitivas", len(out), "triângulos", ntri, "cortados", ncort)
pickle.dump(out, open(os.path.join(TRABALHO, "recorte_%g.pkl" % G), "wb"))
