# Constrói os modelos simples (blocos com telhado plano, um ou mais
# degraus de altura por edifício) dos edifícios à volta do bairro.
#
# Planta: contornos do OpenStreetMap; os edifícios que lá faltam vêm da
# máscara do LiDAR. Alturas: superfície e terreno da DGT (LiDAR 2024,
# 50 cm), levadas para o "cima" do modelo do drone com altura.json.
#
# Saída: public/edificios/edificios.bin (+ .json) — vértices em
# coordenadas da cena do site, cor por vértice já sombreada.
import json, math, os, struct, sys
import numpy as np, cv2
from scipy import ndimage as ndi
import shapely
from shapely.geometry import Polygon, MultiPolygon
from shapely.validation import make_valid

BASE = r"E:/Malha Viva - trabalho/edificios"
SAIDA = r"G:/Outros computadores/O meu portátil/Malha Viva/Site/Malha Viva/malhaviva/public/edificios"
exec(open(BASE + "/osm_cena.py", encoding="utf8").read())

mds = np.roll(np.load(BASE + "/mds.npy"), -1, 0)
mdt = np.roll(np.load(BASE + "/mdt.npy"), -1, 0)
vis = np.load(BASE + "/visivel.npy")
mlidar = np.load(BASE + "/mascara_lidar.npy")
rug = np.load(BASE + "/rugosidade.npy")
alt = json.load(open(BASE + "/altura.json"))["a1"]
n = mds.shape[0]; P = 0.5; E = 750.0
valido = np.isfinite(mds) & np.isfinite(mdt)
nd = np.where(valido, mds - mdt, np.nan)

RAIO_MAX = float(os.environ.get("RAIO_MAX", 720))   # metros do centro do bairro


def cena_y(altitude, x, z):
    return altitude + alt["b"] * x + alt["c"] * z + alt["d"]


def para_px(x, z):
    return (x + E) / P - 0.5, (z + E) / P - 0.5


def para_cena(c, l):
    return (c + 0.5) * P - E, (l + 0.5) * P - E


# ---------------------------------------------------------------- etiquetas
# Cada píxel fica com um edifício só: os contornos maiores pintam-se
# primeiro e os menores (partes, anexos) por cima.
osm = []
for e, pts in carregar_osm():
    tags = e.get("tags", {})
    if tags.get("building") in ("roof", "carport"):
        continue                     # coberturas abertas: não são volumes
    pg = make_valid(Polygon(pts))
    if pg.is_empty or pg.area < 8:
        continue
    if isinstance(pg, MultiPolygon) or pg.geom_type != "Polygon":
        pg = max([g for g in getattr(pg, "geoms", [pg]) if g.geom_type == "Polygon"], key=lambda g: g.area)
    osm.append({"tags": tags, "pg": pg})
osm.sort(key=lambda o: -o["pg"].area)

etiq = np.zeros((n, n), np.int32)
for i, o in enumerate(osm, start=1):
    q = np.array([para_px(x, z) for x, z in o["pg"].exterior.coords], np.float32)
    cv2.fillPoly(etiq, [np.round(q * 4).astype(np.int32)], i, shift=2)
    for h in o["pg"].interiors:
        q = np.array([para_px(x, z) for x, z in h.coords], np.float32)
        cv2.fillPoly(etiq, [np.round(q * 4).astype(np.int32)], 0, shift=2)
NOSM = len(osm)

# Edifícios que só o LiDAR vê: componentes da máscara que o OSM não cobre
sobra = mlidar & (etiq == 0)
sobra = ndi.binary_opening(sobra, structure=np.ones((3, 3)), iterations=1)
lab, nl = ndi.label(sobra)
extra = 0
objs = ndi.find_objects(lab)
for k in range(1, nl + 1):
    sl = objs[k - 1]
    mk = lab[sl] == k
    area = mk.sum() * P * P
    if area < 40:
        continue
    # já coberto em boa parte pelo OSM? (componente original)
    cs, _ = cv2.findContours(mk.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    rect = cv2.minAreaRect(max(cs, key=cv2.contourArea))
    compacto = area / max(rect[1][0] * rect[1][1] * P * P, 1e-6)
    lisura = (rug[sl][mk] < 0.25).mean()
    if compacto < 0.45 or lisura < 0.6:
        continue
    if vis[sl][mk].max() > 0.05:
        continue                     # dentro (ou à beira) do bairro em manchas
    extra += 1
    etiq[sl][mk] = NOSM + extra
print("OSM", NOSM, "só LiDAR", extra)

# ---------------------------------------------------------------- geometria
pos = []; cor = []; idx = []
FUNDO = np.array([5, 5, 10], np.float32)
SOL = np.array([-0.55, 0.62, 0.56]); SOL /= np.linalg.norm(SOL)   # sol de sudoeste, alto (x leste, y cima, z sul)
rng = np.random.default_rng(7)


def tom_base():
    # betão claro, ligeiramente quente, com pequena variação por edifício
    b = np.array([170, 167, 161], np.float32) * rng.uniform(0.93, 1.05)
    return b


def esbater(c, x, z):
    d = math.hypot(x, z)
    t = min(max((d - 380) / (RAIO_MAX - 380), 0), 1)
    t = t * t * (3 - 2 * t)
    return c * (1 - 0.85 * t) + FUNDO * 0.85 * t


def emitir(vs, cs, tris):
    b = len(pos)
    pos.extend(vs); cor.extend(cs)
    idx.extend([(b + a, b + c, b + d) for a, c, d in tris])


def bloco(pg, base_alt, topo_alt, tom):
    """Prisma de planta pg (shapely, x/z da cena) entre duas altitudes."""
    pg = shapely.orient_polygons(pg) if hasattr(shapely, "orient_polygons") else shapely.geometry.polygon.orient(pg, 1.0)
    aneis = [pg.exterior] + list(pg.interiors)
    # paredes
    for anel in aneis:
        c = np.array(anel.coords)[:-1]
        # sentido: exterior anti-horário em (x, z); como z aponta a sul,
        # visto de cima (y para cima) o sentido inverte-se: trata-se pela normal
        for i in range(len(c)):
            x0, z0 = c[i]; x1, z1 = c[(i + 1) % len(c)]
            L = math.hypot(x1 - x0, z1 - z0)
            if L < 1e-3:
                continue
            # normal horizontal para fora: anel exterior orientado (shapely) anti-horário em x/z
            nx, nz = (z1 - z0) / L, -(x1 - x0) / L
            luz = 0.58 + 0.42 * max(0.0, nx * SOL[0] + nz * SOL[2]) + 0.06 * (nz)  # norte um pouco mais escuro
            yb0 = cena_y(base_alt, x0, z0); yb1 = cena_y(base_alt, x1, z1)
            yt0 = cena_y(topo_alt, x0, z0); yt1 = cena_y(topo_alt, x1, z1)
            vs = [(x0, yb0, z0), (x1, yb1, z1), (x1, yt1, z1), (x0, yt0, z0)]
            # pé da parede mais escuro, como oclusão de ambiente
            fb = 0.66 if topo_alt - base_alt > 2 else 0.8
            cs = [esbater(tom * luz * fb, x0, z0), esbater(tom * luz * fb, x1, z1),
                  esbater(tom * luz, x1, z1), esbater(tom * luz, x0, z0)]
            emitir(vs, cs, [(0, 2, 1), (0, 3, 2)])
    # telhado
    tri = shapely.constrained_delaunay_triangles(pg)
    for t in tri.geoms:
        c = np.array(t.exterior.coords)[:3]
        vs = [(x, cena_y(topo_alt, x, z), z) for x, z in c]
        # virado para cima: verifica o sentido
        a = np.array(vs[1]) - np.array(vs[0]); b_ = np.array(vs[2]) - np.array(vs[0])
        ny = np.cross(a, b_)[1]
        cs = [esbater(tom * 1.06, x, z) for x, _, z in vs]
        emitir(vs, cs, [(0, 1, 2)] if ny > 0 else [(0, 2, 1)])


def contornos(mask, c0, l0, simpl=1.3):
    """Polígonos (shapely, coordenadas da cena) de uma máscara de píxeis
    recortada da grelha a partir da coluna c0 e da linha l0."""
    mk = mask.astype(np.uint8)
    cs, hier = cv2.findContours(mk, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hier is None:
        return []
    out = []
    hier = hier[0]
    for i, c in enumerate(cs):
        if hier[i][3] != -1:
            continue
        def anel(cc):
            a = cv2.approxPolyDP(cc, simpl, True)[:, 0, :].astype(np.float64)
            return [para_cena(px_ + c0, py_ + l0) for px_, py_ in a]
        ext = anel(c)
        if len(ext) < 3:
            continue
        furos = []
        j = hier[i][2]
        while j != -1:
            h = anel(cs[j])
            if len(h) >= 3 and cv2.contourArea(cs[j]) > 30:
                furos.append(h)
            j = hier[j][0]
        pg = make_valid(Polygon(ext, furos))
        for g in getattr(pg, "geoms", [pg]):
            if g.geom_type == "Polygon" and g.area > 6:
                out.append(g)
    return out


objs = ndi.find_objects(etiq)
contagem = {"osm": 0, "lidar": 0, "degraus": 0, "sem_dados": 0, "baixos": 0, "bairro": 0, "longe": 0}
for k, sl in enumerate(objs, start=1):
    if sl is None:
        continue
    # alarga a janela para apanhar o chão à volta
    l0, l1 = max(sl[0].start - 8, 0), min(sl[0].stop + 8, n)
    c0, c1 = max(sl[1].start - 8, 0), min(sl[1].stop + 8, n)
    W = (slice(l0, l1), slice(c0, c1))
    mk = etiq[W] == k
    if mk.sum() < 16:
        continue
    cy, cx = np.argwhere(mk).mean(0)
    xc, zc = para_cena(cx + c0, cy + l0)
    if math.hypot(xc, zc) > RAIO_MAX:
        contagem["longe"] += 1
        continue
    if vis[W][mk].mean() > (0.6 if k <= NOSM else 0.05):
        contagem["bairro"] += 1
        continue
    if (~valido[W][mk]).mean() > 0.3:
        contagem["sem_dados"] += 1
        continue
    miolo = ndi.binary_erosion(mk, iterations=1)
    if miolo.sum() < 8:
        miolo = mk
    alturas = mds[W][miolo & valido[W]]
    acima = nd[W][miolo & valido[W]]
    if len(alturas) < 8 or np.nanmedian(acima) < 2.0:
        contagem["baixos"] += 1
        continue
    # chão: o mais baixo à volta (anel de 1–3 m fora da planta)
    anel = ndi.binary_dilation(mk, iterations=6) & ~ndi.binary_dilation(mk, iterations=1) & valido[W]
    chao_v = mdt[W][anel] if anel.sum() > 4 else mdt[W][mk & valido[W]]
    base_alt = float(np.percentile(chao_v, 5)) - 0.6
    tom = tom_base()

    # degraus de altura: só se a planta tiver partes bem diferentes
    so_acima = alturas[acima > 1.5]
    if len(so_acima) < 8:
        so_acima = alturas
    centros = [float(np.median(so_acima))]
    if len(so_acima) > 200:
        # k-médias 1D, até 3 grupos, ficam só os que se distinguem bem
        for kk in (3, 2):
            cs_ = np.percentile(so_acima, np.linspace(15, 85, kk))
            for _ in range(20):
                lb = np.argmin(np.abs(so_acima[:, None] - cs_[None, :]), 1)
                cs_ = np.array([np.median(so_acima[lb == j]) if (lb == j).any() else cs_[j] for j in range(kk)])
            fr = np.array([(lb == j).mean() for j in range(kk)])
            ar = np.array([(lb == j).sum() for j in range(kk)]) * P * P
            sep = np.min(np.diff(np.sort(cs_))) if kk > 1 else 0
            if sep >= 2.8 and fr.min() >= 0.08 and ar.min() >= 30:
                centros = sorted(cs_.tolist())
                break
    is_osm = k <= NOSM
    if len(centros) == 1:
        topo = centros[0]
        if is_osm and mk.sum() >= 0.9 * osm[k - 1]["pg"].area / (P * P):
            pgs = [osm[k - 1]["pg"].simplify(0.15)]   # planta inteira do OSM, nítida
        else:
            pgs = contornos(mk, c0, l0)
        for pg in pgs:
            bloco(pg, base_alt, topo, tom)
    else:
        contagem["degraus"] += 1
        hh = np.where(valido[W], mds[W], np.nan)
        lb = np.argmin(np.abs(np.nan_to_num(hh, nan=centros[0])[..., None] - np.array(centros)[None, None, :]), 2)
        lb[~mk] = -1
        # suaviza: cada píxel fica com o grupo da maioria à volta (5x5)
        votos = np.stack([cv2.boxFilter((lb == j).astype(np.float32), -1, (7, 7), normalize=False) for j in range(len(centros))], 2)
        lb2 = np.argmax(votos, 2); lb2[~mk] = -1
        # degraus empilhados: o primeiro vai do chão ao seu topo, cada um dos
        # seguintes começa onde o anterior acaba (sem paredes sobrepostas)
        de = base_alt
        for j, topo in enumerate(centros):
            parte = lb2 >= j       # tudo o que é pelo menos desta altura
            if j == 0:
                parte = mk
            else:
                parte = ndi.binary_opening(parte, iterations=2) & mk
            if parte.sum() * P * P < 25:
                continue
            for pg in contornos(parte, c0, l0):
                bloco(pg, de, topo, tom)
            de = topo
    contagem["osm" if is_osm else "lidar"] += 1

print(contagem)
pos = np.array(pos, np.float32); cor = np.clip(np.array(cor), 0, 255).astype(np.uint8)
idx = np.array(idx, np.uint32)
print("vértices", len(pos), "triângulos", len(idx))

# ------------------------------------------------------------------ escrita
os.makedirs(SAIDA, exist_ok=True)
mn = pos.min(0); mx = pos.max(0)
esc = (mx - mn) / 65535.0
q = np.round((pos - mn) / esc).astype(np.uint16)
cores = np.concatenate([cor, np.full((len(cor), 1), 255, np.uint8)], 1)
with open(SAIDA + "/edificios.bin", "wb") as f:
    f.write(q.tobytes()); f.write(cores.tobytes())
    f.write(idx.astype(np.uint32 if len(pos) > 65535 else np.uint16).tobytes())
json.dump({
    "versao": 1,
    "vertices": int(len(pos)), "triangulos": int(len(idx)),
    "indices32": bool(len(pos) > 65535),
    "minimo": [float(v) for v in mn], "escala": [float(v) for v in esc],
    "fontes": "Alturas: DGT, LiDAR 2024 (MDS e MDT 50 cm), CC BY 4.0. Plantas: © contribuidores do OpenStreetMap, ODbL.",
}, open(SAIDA + "/edificios.json", "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("bytes", os.path.getsize(SAIDA + "/edificios.bin"))
