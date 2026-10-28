# A rede de caminhos e as casas do bairro, para a navegação.
#
# Junta três coisas:
#
#   - as ruas do bairro, desenhadas à mão sobre o ortofotomapa (ver ruas.py):
#     são elas, e só elas, os caminhos por onde se leva quem vem de fora;
#   - as estradas públicas à volta, do OpenStreetMap (ver estradas.py), por
#     onde se chega ao bairro e onde as ruas desenhadas vão dar;
#   - as casas: o telhado de cada casa numerada, reconhecido no ortofotomapa
#     e nas alturas do mesmo levantamento (ver alturas.py) a partir do ponto
#     que lhe foi posto no levantamento dos números (SIG/Base de Dados/Números
#     de Casas), e a porta mais provável, que é o lado da casa que dá para a
#     rede.
#
# Como se faz, por passos:
#
#   1. A rede. As ruas desenhadas partem-se onde se cruzam — e onde uma acaba
#      a menos de 2 m de outra, que é o mesmo cruzamento desenhado à mão — e
#      fazem uma rede de troços entre cruzamentos, com o traçado tal e qual o
#      desenho. A largura de cada troço mede-se no chão livre à volta dele:
#      daí se é rua ou beco.
#   2. As estradas. As do OpenStreetMap entram inteiras, com o nome. Uma rua
#      desenhada que atravessa uma estrada cruza-se com ela; uma que acaba ao
#      pé de uma (até 12 m) liga-se a ela.
#   3. O chão e os telhados, para as casas. Num bairro de casas baixas e
#      coladas, o chão quase não se vê: os becos são valas estreitas entre
#      telhados. Primeiro acham-se essas valas, depois os sítios abertos e
#      planos, e com os dois desenha-se a superfície do chão por baixo das
#      casas. Mais de 1,8 m acima dele (ou chapa vermelha um pouco acima dele)
#      e sem ser verde é casa; a terra batida e os becos são o chão onde os
#      telhados param de crescer.
#   4. As casas. Cada ponto numerado é a semente de uma casa: o telhado em
#      volta dele cresce até bater nas arestas dos telhados vizinhos (ou no
#      chão), e a porta fica no ponto do contorno mais perto da rede.
#
#     python -P scripts/navegacao/reconhecer.py
#
# Grava public/navegacao/rede.json, que é o que a página da navegação lê, e
# umas imagens de verificação na pasta de rascunho (rede.jpg, classes.jpg).
# Do levantamento das casas só sai o número e o sítio: os nomes, os
# telefones e as notas de quem lá mora ficam onde estão, fora do site.
#
# (Até 28-10-2026 as ruas eram reconhecidas sozinhas no ortofotomapa — a
# terra batida e os becos, reduzidos à linha do meio; ficaram de lado quando
# as ruas passaram a ser desenhadas à mão. Está na história do git, no commit
# 5402ce4.)
import json, math, os, sys, time, warnings
import numpy as np
import cv2
import networkx as nx
from scipy.spatial import cKDTree
from skimage.segmentation import watershed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import AQUI, CASAS, ORTOFOTO, RASCUNHO, SAIDA, grelha, geograficas, mercator

warnings.filterwarnings("ignore", category=RuntimeWarning)

# A grelha de trabalho: 2 × 2 pontos das alturas, cerca de 20 cm no chão.
B = 2
# Mais alto do que isto acima do chão, e sem ser verde, é casa.
ALTURA_DE_CASA = 1.8
# Até isto acima do chão ainda é chão (lombas, passeios, entulho baixo).
ALTURA_DE_CHAO = 0.7
# A chapa vermelha: mais vermelho do que isto (a do Lab) e pelo menos
# CHAPA_ALTURA acima do chão é telhado, mesmo baixo.
CHAPA_A = 12
CHAPA_ALTURA = 0.4
# O excesso de verde a partir do qual é vegetação.
VERDE = 0.06
# A cor da terra batida, no espaço Lab (L de 0 a 100; a e b à volta de 0):
# ao sol, clara (L) e puxada ao amarelo (b), sem puxar ao vermelho nem ao
# verde (a); à sombra, nas valas entre telhados, mais escura.
TERRA_L_SOL = 45
TERRA_B_SOL = 6
TERRA_B_SOMBRA = 1.5
TERRA_A = (-6, 9)
SOMBRA_FUNDA_L = 30
# Um campo de terra lavrada: mais largo do que isto, e com mais de
# CAMPO_VERDE de verde à volta (a uns 6 m).
CAMPO_LARGURA_M = 4.0
CAMPO_VERDE = 0.45
# As falhas na terra batida mais estreitas do que isto (uma laje, uma sombra,
# um carro) enchem-se, se forem de chão livre ou da beira de um telhado
# (até BEIRAL_M para dentro dele).
FALHA_M = 3.0
BEIRAL_M = 0.6
# Um beco: chão livre pelo menos isto mais fundo do que o que fica a 1,5 m
# dele, e com pelo menos BECO_M2 de área.
BECO_FUNDO_M = 1.0
BECO_M2 = 10.0
# Os buracos na terra mais pequenos do que isto são carros, postes, gente:
# tapam-se. As manchas de terra mais pequenas do que isto não levam a lado
# nenhum: saem.
BURACO_M2 = 25.0
MANCHA_M2 = 60.0
# As ruas desenhadas que acabam a menos disto de outra acabam nela; e as que
# acabam a menos de ESTRADA_M de uma estrada ligam-se a ela.
COLAR_M = 2.0
ESTRADA_M = 12.0
# Um bocadinho de rua que passa um cruzamento por menos disto (o traço
# desenhado à mão que vai um nada além da outra rua) sai.
ESPIGAO_M = 1.5
# Uma rua com pelo menos isto de largura é rua; mais estreita, é beco.
RUA_LARGURA = 2.6
# O traçado guardado de cada rua não se afasta mais do que isto do desenho.
SIMPLIFICAR_M = 0.05
# Uma casa não vai além disto do seu ponto (os telhados colados não têm
# sempre aresta entre eles).
RAIO_DA_CASA = 8.0
# A porta fica, no máximo, a isto da rede; mais longe, a casa fica ligada
# por uma linha a tracejado até ao ponto da rede mais perto.
PORTA_M = 10.0


def tempo(t0, texto):
    print("%-44s %5.0fs" % (texto, time.time() - t0), flush=True)


# ---------------------------------------------------------------- dados ---

def fotografia(W, H):
    """O ortofotomapa na grelha das alturas (cor e máscara), guardado."""
    f_rgb = os.path.join(RASCUNHO, "orto_rgb.npy")
    f_msk = os.path.join(RASCUNHO, "orto_mascara.npy")
    if os.path.exists(f_rgb) and os.path.exists(f_msk):
        rgb, msk = np.load(f_rgb), np.load(f_msk)
        if rgb.shape[:2] == (H, W):
            return rgb, msk
    import rasterio
    from rasterio.enums import Resampling
    with rasterio.open(ORTOFOTO) as d:
        rgb = np.moveaxis(d.read(out_shape=(3, H, W), resampling=Resampling.average), 0, 2)
        msk = (d.read_masks(1, out_shape=(H, W)) > 127).astype(np.uint8)
    np.save(f_rgb, rgb)
    np.save(f_msk, msk)
    return rgb, msk


def ler_casas():
    """O número e o sítio de cada casa — e nada mais — do levantamento."""
    import shapefile
    r = shapefile.Reader(os.path.splitext(CASAS)[0], encoding="latin-1")
    nomes = [f.name for f in r.fields[1:]]
    i_num = nomes.index("NºATRIBUID")
    casas = []
    for rec, forma in zip(r.records(), r.shapes()):
        numero = (rec[i_num] or "").strip().upper().replace(" ", "")
        if not numero or not forma.points:
            continue
        lon, lat = forma.points[0]
        casas.append((numero, lon, lat))
    return casas


# -------------------------------------------------------------- terreno ---

def encher(Z, ok):
    """Uma superfície que passa pelos pontos marcados e é lisa no meio."""
    z = np.where(ok, Z, 0).astype(np.float32)
    m = ok.astype(np.float32)
    zs, ms = [z], [m]
    while min(z.shape) > 4:
        z, m = cv2.pyrDown(z), cv2.pyrDown(m)
        zs.append(z)
        ms.append(m)
    est = zs[-1] / np.maximum(ms[-1], 1e-6)
    for z, m in zip(reversed(zs[:-1]), reversed(ms[:-1])):
        cima = cv2.pyrUp(est, dstsize=(z.shape[1], z.shape[0]))
        peso = np.clip(m * 4, 0, 1)
        est = peso * (z / np.maximum(m, 1e-6)) + (1 - peso) * cima
    return est


def terreno(Zmin, valido, cell):
    """A altura do chão por baixo de tudo, e a de cada ponto acima dele."""
    def disco(m):
        d = max(3, int(round(m / cell)) | 1)
        return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (d, d))

    baixo = np.where(valido, Zmin, np.nanmin(Zmin) - 50).astype(np.float32)
    alto = np.where(valido, Zmin, np.nanmax(Zmin) + 50).astype(np.float32)
    # As valas: o que fica bem abaixo de tudo o que o rodeia de perto.
    v5 = cv2.morphologyEx(baixo, cv2.MORPH_CLOSE, disco(5)) - baixo
    v10 = cv2.morphologyEx(baixo, cv2.MORPH_CLOSE, disco(10)) - baixo
    vala = valido & ((v10 > 1.5) | (v5 > 1.0))
    # A fundura de cada sítio em relação ao que o rodeia a 1,5 m: os becos
    # entre filas de casas são corredores fundos e estreitos.
    estreito = np.where(valido, cv2.morphologyEx(baixo, cv2.MORPH_CLOSE, disco(3)) - baixo, 0)
    # O chão aberto: o filtro morfológico progressivo (janelas cada vez
    # maiores, com a tolerância a subir com o declive).
    aberto = valido.copy()
    Z = alto
    antes = 0
    for m in (0.6, 1.2, 2.4, 4.8, 9.6, 19.2, 38.4):
        el = disco(m)
        Zo = cv2.dilate(cv2.erode(Z, el), el)
        aberto &= ~((Z - Zo) > min(2.2, 0.3 + 0.2 * (m - antes)))
        Z, antes = Zo, m
    # Primeiro só com as valas; depois com o chão aberto que não fique muito
    # acima delas (os telhados largos passavam por chão aberto); por fim com
    # tudo o que ficou rente.
    dA = cv2.GaussianBlur(encher(Zmin, vala), (0, 0), 1.5 / cell)
    longe = cv2.distanceTransform((~vala).astype(np.uint8), cv2.DIST_L2, 5) * cell
    semente = vala | (aberto & ((Zmin < dA + 0.8) | (longe > 15)))
    dB = cv2.GaussianBlur(encher(Zmin, semente), (0, 0), 1.0 / cell)
    rente = valido & (np.abs(Zmin - dB) < 0.6)
    dC = cv2.GaussianBlur(encher(Zmin, rente), (0, 0), 1.0 / cell)
    return dC, vala, estreito


# ------------------------------------------------------------- máscaras ---

def sem_pequenos(m, area_px):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    fica = np.zeros(n, bool)
    fica[1:] = st[1:, cv2.CC_STAT_AREA] >= area_px
    return fica[lab]


def sem_buracos(m, area_px):
    return ~sem_pequenos(~m, area_px) | m


def disco(metros, cell):
    d = max(3, int(round(metros / cell)) | 1)
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (d, d))


def terra_batida(col, rente, verde, edif, vala, estreito, cell):
    """Onde se anda no bairro: a terra batida das ruas e dos largos, e os
    becos entre as filas de casas."""
    m2 = 1 / (cell * cell)
    # A cor de cada sítio vista um pouco de longe (uns 25 cm), sem o grão
    # das pedras e das sombras pequenas.
    suave = cv2.GaussianBlur(col.astype(np.float32), (0, 0), 0.25 / cell)
    lab = cv2.cvtColor(np.clip(suave, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    L, A, Bb = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
    sem_tom = (A >= TERRA_A[0]) & (A <= TERRA_A[1])
    ao_sol = (L >= TERRA_L_SOL) & (Bb >= TERRA_B_SOL) & sem_tom
    a_sombra = (L < TERRA_L_SOL) & (Bb >= TERRA_B_SOMBRA) & sem_tom & (L >= 18)
    sombra_funda = (L < SOMBRA_FUNDA_L) & (np.abs(A) < 6) & (np.abs(Bb) < 6)
    livre = rente & ~verde & ~edif
    terra = livre & (ao_sol | (vala & (a_sombra | sombra_funda)))
    # Um caminho de terra não acaba por ter, uns metros, uma laje de
    # cimento, uma sombra ou um carro por cima: as falhas estreitas entre
    # bocados de terra enchem-se, mas só por chão livre — ou pela beira de
    # um telhado, que de cima tapa a entrada de muitos becos (o beiral passa
    # por cima do beco). Nunca pelo meio de uma casa nem pelo mato.
    longe_do_livre = cv2.distanceTransform((~livre).astype(np.uint8), cv2.DIST_L2, 5) * cell
    beiral = edif & (longe_do_livre <= BEIRAL_M)
    fechado = cv2.morphologyEx(terra.astype(np.uint8), cv2.MORPH_CLOSE, disco(FALHA_M, cell)) > 0
    terra |= fechado & (livre | beiral)
    u8 = cv2.morphologyEx(terra.astype(np.uint8), cv2.MORPH_OPEN, disco(0.6, cell))
    u8 = cv2.morphologyEx(u8, cv2.MORPH_CLOSE, disco(1.2, cell))
    terra = sem_buracos(u8 > 0, int(BURACO_M2 * m2))
    # Os campos de terra lavrada: largos, e no meio do verde. Um caminho que
    # atravessa um campo é estreito, e fica.
    largo = cv2.morphologyEx(terra.astype(np.uint8), cv2.MORPH_OPEN, disco(CAMPO_LARGURA_M, cell)) > 0
    verdura = cv2.GaussianBlur(verde.astype(np.float32), (0, 0), 6 / cell) > CAMPO_VERDE
    campo = cv2.dilate((largo & verdura).astype(np.uint8), disco(0.8, cell)) > 0
    terra &= ~campo
    # Os becos: corredores de chão livre, fundos e estreitos, entre filas de
    # casas. Estão quase sempre à sombra, e por isso não se reconhecem pela
    # cor da terra: reconhecem-se pela forma.
    becos = livre & (estreito > BECO_FUNDO_M)
    becos = cv2.morphologyEx(becos.astype(np.uint8), cv2.MORPH_OPEN, disco(0.4, cell)) > 0
    becos = sem_pequenos(becos, int(BECO_M2 * m2))
    terra = cv2.morphologyEx((terra | becos).astype(np.uint8), cv2.MORPH_CLOSE, disco(0.8, cell)) > 0
    terra = sem_buracos(terra, int(BURACO_M2 * m2))
    terra = sem_pequenos(terra, int(MANCHA_M2 * m2))
    # Um alisamento leve da beira: mais do que isto apagava os becos mais
    # estreitos (a suavidade do traçado vem depois, das linhas).
    return cv2.GaussianBlur(terra.astype(np.float32), (0, 0), 0.3 / cell) > 0.5


# ---------------------------------------------------------------- rede ----

def comprimento(pts):
    return float(np.hypot(*np.diff(pts, axis=0).T).sum()) if len(pts) > 1 else 0.0


def orientar(pts, inicio):
    """Os pontos de um troço, a começar na ponta mais perto de 'inicio'."""
    if np.hypot(*(pts[0] - inicio)) > np.hypot(*(pts[-1] - inicio)):
        return pts[::-1]
    return pts


def juntar_grau_2(G):
    """Um nó com só dois troços não é cruzamento: os dois passam a um (se
    forem da mesma estrada, ou nenhum dos dois de estrada nenhuma)."""
    for n in list(G.nodes):
        if n not in G or G.degree(n) != 2 or G.nodes[n].get("fixo"):
            continue
        eds = list(G.edges(n, keys=True, data=True))
        if len(eds) != 2:
            continue
        (_, a, ka, da), (_, b, kb, db) = eds
        if a == n or b == n:
            continue
        if da.get("nome") != db.get("nome") or da.get("osm") != db.get("osm"):
            continue
        o = np.asarray(G.nodes[n]["o"], float)
        pa = orientar(np.asarray(da["pts"], float), np.asarray(G.nodes[a]["o"], float))
        pb = orientar(np.asarray(db["pts"], float), o)
        # Fica o tipo e a largura do mais comprido dos dois.
        novo = dict(da if comprimento(pa) >= comprimento(pb) else db)
        novo["pts"] = np.vstack([pa, pb[1:]])
        G.remove_node(n)
        G.add_edge(a, b, **novo)


def densos(G, passo):
    """Pontos ao longo de todos os troços: (ponto, troço, índice)."""
    pts, quem = [], []
    for u, v, k, d in G.edges(keys=True, data=True):
        p = np.asarray(d["pts"], float)
        for i in range(len(p)):
            pts.append(p[i])
            quem.append((u, v, k, i))
        # entre vértices afastados, pontos pelo meio (ligados ao vértice antes)
        for i in range(len(p) - 1):
            seg = p[i + 1] - p[i]
            L = np.hypot(*seg)
            for t in np.arange(passo, L, passo):
                pts.append(p[i] + seg * (t / L))
                quem.append((u, v, k, i + t / L))
    return np.array(pts), quem


def partir(G, u, v, k, i, novo_no, ponto, primeira=None):
    """Parte um troço num ponto (índice i dos pontos do troço, que pode ser
    fracionário). Devolve o nó do ponto. Com 'primeira' (uma lista), junta-
    -lhe o troço que fica do princípio até ao ponto, com os mesmos índices
    de antes — para se poder partir o mesmo troço noutro ponto mais atrás."""
    d = G.edges[u, v, k]
    p = np.asarray(d["pts"], float)
    i0 = int(math.floor(i))
    a = np.vstack([p[:i0 + 1], [ponto]]) if i > i0 else p[:i0 + 1]
    b = np.vstack([[ponto], p[i0 + 1:]]) if i > i0 else p[i0:]
    # As pontas dos pontos do troço podem estar em qualquer dos nós.
    pu = np.asarray(G.nodes[u]["o"], float)
    inicio = u if np.hypot(*(p[0] - pu)) <= np.hypot(*(p[-1] - pu)) else v
    fim = v if inicio == u else u
    if len(a) < 2 or len(b) < 2:
        # o ponto é uma das pontas: nada a partir
        if primeira is not None:
            primeira.append((u, v, k))
        return inicio if len(a) < 2 else fim
    resto = {kk: vv for kk, vv in d.items() if kk != "pts"}
    G.remove_edge(u, v, k)
    G.add_node(novo_no, o=np.asarray(ponto, float))
    ka = G.add_edge(inicio, novo_no, pts=a, **resto)
    G.add_edge(novo_no, fim, pts=b, **resto)
    if primeira is not None:
        primeira.append((inicio, novo_no, ka))
    return novo_no


# ------------------------------------------------------------ estradas ---

def ler_estradas(para_grelha):
    """As estradas do OpenStreetMap (ver estradas.py), na grelha."""
    d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "estradas-osm.json"), encoding="utf8"))
    nos = {int(k): np.array(para_grelha(v[1], v[0])) for k, v in d["nos"].items()}
    # Os pontos onde uma estrada toca noutra (ou acaba) são cruzamentos.
    usos = {}
    for e in d["estradas"]:
        for n in e["nos"]:
            usos[n] = usos.get(n, 0) + 1
        for n in (e["nos"][0], e["nos"][-1]):
            usos[n] = usos.get(n, 0) + 1
    return d["estradas"], nos, usos


def indice_no_troco(pts, q):
    """Em que ponto de um troço (índice fracionário) fica o sítio q."""
    a, b = pts[:-1], pts[1:]
    ab = b - a
    L2 = np.maximum((ab ** 2).sum(1), 1e-12)
    t = np.clip(((q - a) * ab).sum(1) / L2, 0, 1)
    d = np.hypot(*(a + ab * t[:, None] - q).T)
    i = int(np.argmin(d))
    return i + float(t[i])


def rede_desenhada(para_grelha, livre, cell):
    """As ruas desenhadas (ver ruas.py), feitas rede, na grelha."""
    from shapely.geometry import LineString, MultiLineString, Point
    from shapely.ops import nearest_points, unary_union
    d = json.load(open(os.path.join(AQUI, "ruas-desenhadas.geojson"), encoding="utf8"))
    linhas = [np.array([para_grelha(lon, lat) for lon, lat in f["geometry"]["coordinates"]], float)
              for f in d["features"]]
    # Uma rua que acaba ao pé de outra acaba nela: a ponta vai até ao ponto
    # mais perto da outra, e esse ponto entra também no traçado da outra —
    # um cruzamento em T só se reconhece com um ponto que seja das duas (um
    # ponto calculado em cima de uma linha nunca lhe fica exatamente em cima).
    geoms = [LineString(l) for l in linhas]
    inserir = {}
    for i, l in enumerate(linhas):
        extra = {}
        for ponta in (0, -1):
            P = Point(l[ponta])
            perto = min(((g.distance(P), j) for j, g in enumerate(geoms) if j != i), default=None)
            if perto and perto[0] * cell <= COLAR_M:
                q = nearest_points(geoms[perto[1]], P)[0]
                q = np.array([q.x, q.y])
                extra[ponta] = q[None]
                inserir.setdefault(perto[1], []).append(q)
        if extra:
            linhas[i] = np.vstack([extra.get(0, np.empty((0, 2))), l, extra.get(-1, np.empty((0, 2)))])
    for j, pontos in inserir.items():
        l = linhas[j]
        for q in sorted(pontos, key=lambda q: -indice_no_troco(l, q)):
            i = indice_no_troco(l, q)
            k = int(math.floor(i))
            if np.hypot(*(l[k] - q)) < 1e-9 or (k + 1 < len(l) and np.hypot(*(l[k + 1] - q)) < 1e-9):
                continue
            l = np.vstack([l[:k + 1], q[None], l[k + 1:]])
        linhas[j] = l
    # Os pontos das pontas já ficaram iguais aos da outra rua; a união acerta
    # os restantes cruzamentos (os em X) sozinha.
    # Parte-se tudo onde as ruas se cruzam.
    uniao = unary_union(MultiLineString([LineString(l) for l in linhas]))
    G = nx.MultiGraph()
    nos = {}

    def no(q):
        k = (round(q[0], 2), round(q[1], 2))
        if k not in nos:
            nos[k] = len(nos)
            G.add_node(nos[k], o=np.array(q, float))
        return nos[k]

    for seg in (uniao.geoms if hasattr(uniao, "geoms") else [uniao]):
        pts = np.array(seg.coords, float)
        if len(pts) > 1 and comprimento(pts) > 1e-6:
            G.add_edge(no(pts[0]), no(pts[-1]), pts=pts)
    # Os traços que passam um nada além de um cruzamento saem.
    for n in [n for n in G.nodes if G.degree(n) == 1]:
        if n not in G or G.degree(n) != 1:
            continue
        _, outro, dd = next(iter(G.edges(n, data=True)))
        if G.degree(outro) >= 3 and comprimento(dd["pts"]) * cell < ESPIGAO_M:
            G.remove_node(n)
    juntar_grau_2(G)
    # A largura de cada troço, medida no chão à volta dele (o livre e a terra
    # batida, que entra um pouco por baixo das beiras dos telhados).
    meia = cv2.distanceTransform(livre.astype(np.uint8), cv2.DIST_L2, 5) * cell
    H, W = livre.shape
    for u, v, k, dd in G.edges(keys=True, data=True):
        pp = np.round(dd["pts"]).astype(int)
        pp[:, 0] = np.clip(pp[:, 0], 0, H - 1)
        pp[:, 1] = np.clip(pp[:, 1], 0, W - 1)
        dd["largura"] = float(np.median(meia[pp[:, 0], pp[:, 1]]) * 2)
        dd["tipo"] = "rua" if dd["largura"] >= RUA_LARGURA else "beco"
        # O desenho vem com um ponto a cada 10 cm; fica um só onde a linha
        # se desvia mais de SIMPLIFICAR_M da reta (o mapa alisa-a na mesma).
        dd["pts"] = cv2.approxPolyDP(dd["pts"][:, ::-1].astype(np.float32).reshape(-1, 1, 2),
                                     SIMPLIFICAR_M / cell, False)[:, 0, ::-1].astype(float)
    return G


def juntar_estradas(G, estradas, nos, usos, cell, proximo):
    """As estradas públicas entram na rede inteiras, com o traçado e o nome do
    OpenStreetMap, partidas só onde se cruzam umas com as outras (uma estrada
    que passa por cima de outra numa ponte não se cruza com ela). Uma rua
    desenhada que atravessa uma estrada cruza-se com ela; uma que acaba ao pé
    de uma estrada liga-se a ela: é por aí que se entra no bairro."""
    from shapely.geometry import LineString
    no_osm = {}

    def no_de(chave, q):
        if chave not in no_osm:
            n = proximo()
            G.add_node(n, o=np.asarray(q, float))
            no_osm[chave] = n
        return no_osm[chave]

    for e in estradas:
        ids = e["nos"]
        corrida = [nos[ids[0]]]
        inicio = ids[0]
        for i in range(1, len(ids)):
            corrida.append(nos[ids[i]])
            if i == len(ids) - 1 or usos.get(ids[i], 0) >= 2:
                a, b = no_de(inicio, nos[inicio]), no_de(ids[i], nos[ids[i]])
                if a != b and len(corrida) >= 2:
                    G.add_edge(a, b, pts=np.array(corrida), tipo="estrada", nome=e["nome"], osm=True)
                corrida = [nos[ids[i]]]
                inicio = ids[i]

    # Os cruzamentos de uma rua desenhada com uma estrada.
    cruzamentos = 0
    mudou = True
    while mudou:
        mudou = False
        estrada = [(u, v, k) for u, v, k, d in G.edges(keys=True, data=True) if d.get("osm")]
        for (a, b, ka) in [(u, v, k) for u, v, k, d in G.edges(keys=True, data=True) if not d.get("osm")]:
            la = LineString(G.edges[a, b, ka]["pts"])
            for (u, v, k) in estrada:
                lb = LineString(G.edges[u, v, k]["pts"])
                x = la.intersection(lb)
                if x.is_empty or x.geom_type != "Point":
                    continue
                q = np.array([x.x, x.y])
                # (as pontas que já tocam numa estrada tratam-se a seguir)
                if min(np.hypot(*(q - G.nodes[n]["o"])) for n in (a, b, u, v)) * cell < 0.5:
                    continue
                n1 = partir(G, a, b, ka, indice_no_troco(G.edges[a, b, ka]["pts"], q), proximo(), q)
                n2 = partir(G, u, v, k, indice_no_troco(G.edges[u, v, k]["pts"], q), proximo(), q)
                nx.contracted_nodes(G, n1, n2, self_loops=False, copy=False)
                cruzamentos += 1
                mudou = True
                break
            if mudou:
                break

    # As pontas das ruas desenhadas que ficam perto de uma estrada.
    ligadas = 0
    pontas = [n for n in G.nodes if G.degree(n) == 1 and not any(d.get("osm") for _, _, d in G.edges(n, data=True))]
    for n in pontas:
        estrada = [(u, v, k) for u, v, k, d in G.edges(keys=True, data=True) if d.get("osm")]
        pts, quem = densos(G.edge_subgraph(estrada), 0.5 / cell)
        o = np.asarray(G.nodes[n]["o"], float)
        dist, j = cKDTree(pts).query(o, distance_upper_bound=ESTRADA_M / cell)
        if not np.isfinite(dist):
            continue
        u, v, k, i = quem[j]
        alvo = partir(G, u, v, k, i, proximo(), pts[j])
        G.add_edge(n, alvo, pts=np.array([o, np.asarray(G.nodes[alvo]["o"], float)]), tipo="ligacao")
        ligadas += 1
    return cruzamentos, ligadas


# --------------------------------------------------------------- casas ----

def reconhecer_casas(casas, edif, andavel, ndm, col, cell, para_grelha):
    """O telhado de cada casa numerada, a crescer a partir do seu ponto."""
    Hc, Wc = edif.shape
    marcas = np.zeros((Hc, Wc), np.int32)
    sementes = []
    for i, (numero, lon, lat) in enumerate(casas):
        r, c = para_grelha(lon, lat)
        sementes.append((r, c))
        if 0 <= r < Hc and 0 <= c < Wc:
            cv2.circle(marcas, (int(round(c)), int(round(r))), max(1, int(0.6 / cell)), i + 1, -1)
    fundo = len(casas) + 1
    marcas[(andavel > 0) & (marcas == 0)] = fundo
    # O relevo por onde as casas crescem: as arestas da altura (beirais,
    # degraus entre telhados) e as da cor (chapas de cores diferentes).
    h = np.nan_to_num(ndm, nan=0).astype(np.float32)
    gh = np.hypot(cv2.Sobel(h, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(h, cv2.CV_32F, 0, 1, ksize=3))
    lab = cv2.cvtColor(col.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    gc = sum(np.hypot(cv2.Sobel(lab[..., j], cv2.CV_32F, 1, 0, ksize=3),
                      cv2.Sobel(lab[..., j], cv2.CV_32F, 0, 1, ksize=3)) for j in range(3))
    relevo = gh / (np.percentile(gh, 99) + 1e-6) + 0.5 * gc / (np.percentile(gc, 99) + 1e-6)
    relevo = cv2.GaussianBlur(relevo, (0, 0), 0.6)
    zona = (edif > 0) | ((marcas > 0) & (marcas < fundo))
    reg = watershed(relevo, marcas, mask=zona | (marcas == fundo), compactness=0.001)
    resultado = []
    raio = RAIO_DA_CASA / cell
    for i, (r, c) in enumerate(sementes):
        if not (0 <= r < Hc and 0 <= c < Wc):
            resultado.append(None)
            continue
        r0, r1 = int(max(0, r - raio - 2)), int(min(Hc, r + raio + 3))
        c0, c1 = int(max(0, c - raio - 2)), int(min(Wc, c + raio + 3))
        bloco = (reg[r0:r1, c0:c1] == i + 1).astype(np.uint8)
        yy, xx = np.mgrid[r0:r1, c0:c1]
        bloco &= ((yy - r) ** 2 + (xx - c) ** 2 <= raio ** 2).astype(np.uint8)
        bloco = cv2.morphologyEx(bloco, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, lb, st, _ = cv2.connectedComponentsWithStats(bloco, connectivity=4)
        if n <= 1:
            resultado.append(None)
            continue
        rr, cc = int(round(r)) - r0, int(round(c)) - c0
        k = lb[rr, cc] if 0 <= rr < lb.shape[0] and 0 <= cc < lb.shape[1] and lb[rr, cc] else 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        bloco = (lb == k).astype(np.uint8)
        bloco = sem_buracos(bloco > 0, int(4 / cell ** 2)).astype(np.uint8)
        cs, _ = cv2.findContours(bloco, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cont = max(cs, key=cv2.contourArea)
        cont = cv2.approxPolyDP(cont, 0.35 / cell, True)[:, 0, :].astype(float)
        cont[:, 0] += c0
        cont[:, 1] += r0
        resultado.append(dict(contorno=cont[:, ::-1], area=float(bloco.sum()) * cell * cell))
    return resultado


# ---------------------------------------------------------------- tudo ----

def main():
    t0 = time.time()
    E0, N1, p, W, H = grelha()
    lat_meio = geograficas(E0, N1 - p * H / 2)[1]
    k = math.cos(math.radians(lat_meio))
    cell = p * B * k
    Hc, Wc = H // B, W // B
    tempo(t0, "grelha %d x %d, %.2f m por ponto" % (Wc, Hc, cell))

    su = np.load(os.path.join(RASCUNHO, "superficie.npy"))
    me = np.load(os.path.join(RASCUNHO, "media.npy"))
    S = np.where(np.isfinite(su), su, me)
    del su, me
    rgb, msk = fotografia(W, H)

    def juntar(a, f):
        return f(a[:Hc * B, :Wc * B].reshape(Hc, B, Wc, B, *a.shape[2:]), axis=(1, 3))

    Zmin = juntar(S, np.nanmin).astype(np.float32)
    Zmed = juntar(S, np.nanmedian).astype(np.float32)
    col = juntar(rgb.astype(np.float32), np.mean)
    # só onde o ortofotomapa é nítido, com uma margem para dentro
    mk = juntar(msk, np.min) > 0
    mk = cv2.erode(mk.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))) > 0
    valido = np.isfinite(Zmin)
    del S, rgb
    tempo(t0, "dados")

    chao, vala, estreito = terreno(Zmin, valido, cell)
    nd = np.where(valido, Zmin - chao, np.nan)
    ndm = np.where(valido, Zmed - chao, np.nan)
    tempo(t0, "terreno")

    r_, g_, b_ = col[..., 0], col[..., 1], col[..., 2]
    verde = (2 * g_ - r_ - b_) / (r_ + g_ + b_ + 1e-3) > VERDE
    m2 = 1 / (cell * cell)
    edif = mk & (ndm > ALTURA_DE_CASA) & ~verde
    # A chapa vermelha dos telhados reconhece-se pela cor: nenhum chão é tão
    # vermelho. Uma casa baixa, ou numa encosta onde o chão por baixo dela
    # fica mal medido, é casa na mesma, desde que fique um pouco acima dele.
    lab = cv2.cvtColor(cv2.GaussianBlur(col, (0, 0), 0.25 / cell).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    chapa = (lab[..., 1] - 128 > CHAPA_A) & (lab[..., 0] * 100 / 255 > 20) & (ndm > CHAPA_ALTURA)
    edif |= mk & chapa & ~verde
    edif = sem_pequenos(edif, int(6 * m2))
    rente = mk & valido & (nd < ALTURA_DE_CHAO)
    livre = rente & ~verde & ~edif
    andavel = terra_batida(col, rente, verde, edif, vala, estreito, cell) & mk
    tempo(t0, "terra batida: %.1f ha" % (andavel.sum() * cell * cell / 1e4))

    # ---- a rede: as ruas desenhadas e as estradas ----
    def para_grelha(lon, lat):
        E, N = mercator(lon, lat)
        return (N1 - N) / (p * B) - 0.5, (E - E0) / (p * B) - 0.5

    G = rede_desenhada(para_grelha, livre | andavel, cell)
    desenhado = sum(comprimento(d["pts"]) for _, _, d in G.edges(data=True)) * cell
    tempo(t0, "ruas desenhadas: %d troços, %.0f m" % (G.number_of_edges(), desenhado))
    contador = [max(G.nodes) + 1 if G.number_of_nodes() else 0]

    def proximo():
        contador[0] += 1
        return contador[0] - 1

    estradas, nos_osm, usos = ler_estradas(para_grelha)
    cruz, lig = juntar_estradas(G, estradas, nos_osm, usos, cell, proximo)
    tempo(t0, "estradas: %d cruzamentos com ruas, %d ruas ligadas a elas" % (cruz, lig))

    # Só fica a rede que está toda ligada; uma rua desenhada que não chegasse
    # a nenhuma outra nem a uma estrada ficava de fora — diz-se.
    def desenhado_em(c):
        return sum(comprimento(d["pts"]) for _, _, d in G.subgraph(c).edges(data=True) if not d.get("osm")) * cell

    comps = sorted(nx.connected_components(G), key=lambda c: -desenhado_em(c))
    for comp in comps[1:]:
        if desenhado_em(comp) > 0:
            print("  aviso: %.0f m de ruas desenhadas sem ligação ao resto ficam de fora" % desenhado_em(comp))
        G.remove_nodes_from(comp)
    juntar_grau_2(G)
    tempo(t0, "rede final: %d nós, %d troços" % (G.number_of_nodes(), G.number_of_edges()))

    # ---- casas ----
    casas = ler_casas()
    telhados = reconhecer_casas(casas, edif, andavel, ndm, col, cell, para_grelha)
    tempo(t0, "casas: %d, com telhado: %d" % (len(casas), sum(t is not None for t in telhados)))

    # a porta: o ponto do contorno da casa mais perto da rede
    pts, quem = densos(G, 0.3 / cell)
    arvore = cKDTree(pts)
    portas = []
    for (numero, lon, lat), tel in zip(casas, telhados):
        r, c = para_grelha(lon, lat)
        bordo = tel["contorno"] if tel else np.array([[r, c]])
        if tel:
            # pontos ao longo do contorno, de 20 em 20 cm
            dens = []
            fechado = np.vstack([bordo, bordo[:1]])
            for a, b in zip(fechado[:-1], fechado[1:]):
                L = max(1, int(np.hypot(*(b - a))))
                for t in np.linspace(0, 1, L, endpoint=False):
                    dens.append(a + (b - a) * t)
            bordo = np.array(dens)
        dist, j = arvore.query(bordo)
        a = int(np.argmin(dist))
        portas.append((bordo[a], j[a], float(dist[a]) * cell))

    # As portas entram na rede: um nó no troço, no ponto mais perto da porta.
    # Num troço com várias portas, parte-se do fim para o princípio, para os
    # índices dos pontos que faltam continuarem a valer.
    pedidos = {}
    for c, (porta, j, dist) in enumerate(portas):
        u, v, kk, i = quem[j]
        pedidos.setdefault((u, v, kk), []).append((i, pts[j], c))
    no_da_casa = {}
    for (u, v, kk), lista in pedidos.items():
        lista.sort(key=lambda t: -t[0])
        atual = (u, v, kk)
        anterior = None
        for i, ponto, c in lista:
            if anterior is not None and abs(anterior[0] - i) < 1e-6:
                no_da_casa[c] = anterior[1]
                continue
            primeira = []
            no = partir(G, *atual, i, proximo(), ponto, primeira)
            atual = primeira[0]
            no_da_casa[c] = no
            anterior = (i, no)
    casas_saida = {}
    for c, ((numero, lon, lat), tel, (porta, j, dist)) in enumerate(zip(casas, telhados, portas)):
        # Fora da zona que o drone fotografou (as F): ali não há ruas
        # desenhadas, só as estradas.
        r, cc = (int(round(x)) for x in para_grelha(lon, lat))
        fora = not (0 <= r < Hc and 0 <= cc < Wc and mk[r, cc])
        casas_saida.setdefault(numero, []).append(dict(
            no=no_da_casa[c], porta=porta, dist=dist, lon=lon, lat=lat, telhado=tel, fora=fora))
    tempo(t0, "portas ligadas à rede")

    escrever(G, casas_saida, E0, N1, p, cell)
    tempo(t0, "rede.json escrita")
    verificar(G, casas_saida, col, edif, andavel, verde, mk, cell)
    tempo(t0, "imagens de verificação")


def escrever(G, casas, E0, N1, p, cell):
    """public/navegacao/rede.json: nós, troços e casas, em graus."""
    def geo(r, c):
        lon, lat = geograficas(E0 + (c + 0.5) * p * B, N1 - (r + 0.5) * p * B)
        return [round(lat, 7), round(lon, 7)]

    ordem = {n: i for i, n in enumerate(G.nodes)}
    nos = [geo(*G.nodes[n]["o"]) for n in G.nodes]
    tipos = ["estrada", "rua", "beco", "ligacao"]
    nomes = sorted({d.get("nome") for _, _, d in G.edges(data=True) if d.get("nome")})
    trocos = []
    for u, v, kk, d in G.edges(keys=True, data=True):
        pp = orientar(d["pts"], G.nodes[u]["o"])
        meio = [geo(*q) for q in pp[1:-1]]
        troco = [ordem[u], ordem[v], round(comprimento(pp) * cell, 2),
                 round(d.get("largura", 0), 1), tipos.index(d.get("tipo", "beco")), meio]
        if d.get("nome"):
            troco.append(nomes.index(d["nome"]))
        trocos.append(troco)
    saida_casas = []
    for numero in sorted(casas, key=chave_do_numero):
        postas = []
        for c in casas[numero]:
            # O mesmo número duas vezes no mesmo sítio é a mesma casa.
            if any(math.hypot(c["lat"] - a["lat"], (c["lon"] - a["lon"]) * 0.78) * 111320 < 3 for a in postas):
                continue
            postas.append(c)
            item = dict(n=numero, no=ordem[c["no"]], porta=geo(*c["porta"]),
                        ponto=[round(c["lat"], 7), round(c["lon"], 7)])
            if c["dist"] > PORTA_M:
                item["longe"] = round(c["dist"], 1)
            if c["fora"]:
                item["fora"] = 1
            # (O contorno do telhado serve só para achar a porta: o mapa não
            # o desenha, e não vai para o site.)
            saida_casas.append(item)
    os.makedirs(SAIDA, exist_ok=True)
    dados = dict(
        versao=1,
        fonte="Ruas desenhadas à mão sobre o ortofotomapa do voo de drone de 15-02-2026; casas reconhecidas "
              "no ortofotomapa e no modelo 3D do mesmo voo; numeração das casas do levantamento do bairro; "
              "estradas de fora do bairro © contribuidores do OpenStreetMap (ODbL)",
        tipos=tipos, nomes=nomes, nos=nos, trocos=trocos, casas=saida_casas)
    with open(os.path.join(SAIDA, "rede.json"), "w", encoding="utf8") as f:
        json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))


def chave_do_numero(n):
    """A1, A2, ..., A10 (e não A1, A10, A2); números sem letra no fim."""
    import re
    m = re.match(r"([A-Z]*)(\d+)(?:\.(\d+))?", n)
    if not m:
        return ("~", 0, 0, n)
    return (m.group(1) or "~", int(m.group(2)), int(m.group(3) or 0), n)


def verificar(G, casas, col, edif, andavel, verde, mk, cell):
    """Imagens para ver se a rede e as casas batem com a fotografia."""
    img = col[..., ::-1].astype(np.uint8).copy()
    classes = img.copy()
    classes[edif] = (0.45 * classes[edif] + 0.55 * np.array([60, 60, 255])).astype(np.uint8)
    classes[andavel] = (0.45 * classes[andavel] + 0.55 * np.array([255, 255, 0])).astype(np.uint8)
    so_verde = verde & ~edif & ~andavel
    classes[so_verde] = (0.5 * classes[so_verde] + 0.5 * np.array([0, 200, 0])).astype(np.uint8)
    classes[~mk] //= 3
    cv2.imwrite(os.path.join(RASCUNHO, "classes.jpg"), classes, [cv2.IMWRITE_JPEG_QUALITY, 88])
    rede = img.copy()
    cores = {"estrada": (255, 255, 255), "rua": (0, 220, 255), "beco": (0, 255, 0), "ligacao": (255, 0, 255)}
    for u, v, kk, d in G.edges(keys=True, data=True):
        pp = np.round(d["pts"][:, ::-1]).astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(rede, [pp], False, cores.get(d.get("tipo"), (0, 0, 255)), 2, cv2.LINE_AA)
    for n in G.nodes:
        r, c = G.nodes[n]["o"]
        if G.degree(n) != 2:
            cv2.circle(rede, (int(c), int(r)), 3, (0, 0, 255), -1)
    for numero, lista in casas.items():
        for c in lista:
            if c["telhado"]:
                cont = np.round(c["telhado"]["contorno"][:, ::-1]).astype(np.int32).reshape(-1, 1, 2)
                cv2.polylines(rede, [cont], True, (255, 128, 0), 2, cv2.LINE_AA)
            pr, pc = c["porta"]
            cv2.circle(rede, (int(pc), int(pr)), 4, (0, 128, 255), -1)
            cv2.putText(rede, numero, (int(pc) + 4, int(pr) - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.imwrite(os.path.join(RASCUNHO, "rede.jpg"), rede, [cv2.IMWRITE_JPEG_QUALITY, 88])


if __name__ == "__main__":
    main()
