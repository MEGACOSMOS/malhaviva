# O reconhecimento das ruas e das casas do bairro.
#
# Lê o ortofotomapa (a cor de cada sítio) e as alturas do mesmo levantamento
# (ver alturas.py) e tira daí, sem ninguém desenhar nada à mão:
#
#   - o chão por onde se anda — as ruas, os becos, os largos e as estradas à
#     volta — como uma rede de caminhos, com os cruzamentos, o comprimento e
#     a largura de cada troço;
#   - as casas: o telhado de cada casa numerada, a partir do ponto que lhe foi
#     posto no levantamento dos números (SIG/Base de Dados/Números de Casas),
#     e a porta mais provável, que é o lado da casa que dá para a rede.
#
# Como se reconhece, por passos:
#
#   1. O terreno. Num bairro de casas baixas e coladas, o chão quase não se
#      vê: os becos são valas estreitas entre telhados. Primeiro acham-se essas
#      valas (o que fica mais de um metro abaixo de tudo o que está a menos de
#      2,5 ou 5 metros), depois os sítios abertos e planos (estradas, largos,
#      campos), e com os dois desenha-se a superfície do chão por baixo das
#      casas.
#   2. O que está em cima do chão. Mais de 1,8 m acima dele e sem ser verde é
#      casa; verde é vegetação (a cor diz-se pelo excesso de verde da
#      fotografia); rente ao chão e sem ser verde é chão por onde se anda.
#   3. A rede. O chão por onde se anda é afinado (fora os carros, os postes e
#      as manchas pequenas) e reduzido à linha do meio, que se parte em troços
#      entre cruzamentos. Os bocados soltos que o desenho deixa nos largos são
#      cortados; os becos interrompidos por um beiral juntam-se ao troço mais
#      perto se a ponte não atravessar mais de um metro de telhado.
#   4. As estradas. Um troço largo (5 m ou mais) e cinzento (alcatrão) é
#      estrada: é por elas que se chega de carro, e é de onde parte o percurso
#      de quem vem de fora (ver public/navegacao.mjs).
#   5. As casas. Cada ponto numerado é a semente de uma casa: o telhado em
#      volta dele cresce até bater nas arestas dos telhados vizinhos (ou no
#      chão), e a porta fica no ponto do contorno mais perto da rede.
#
#     python -P scripts/navegacao/reconhecer.py
#
# Grava public/navegacao/rede.json, que é o que a página da navegação lê, e
# umas imagens de verificação na pasta de rascunho (rede.jpg, classes.jpg).
# Do levantamento das casas só sai o número e o sítio: os nomes, os
# telefones e as notas de quem lá mora ficam onde estão, fora do site.
import json, math, os, sys, time, warnings
import numpy as np
import cv2
import networkx as nx
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize
from skimage.segmentation import watershed
import sknw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import CASAS, ORTOFOTO, RASCUNHO, SAIDA, grelha, geograficas, mercator

warnings.filterwarnings("ignore", category=RuntimeWarning)

# A grelha de trabalho: 2 × 2 pontos das alturas, cerca de 20 cm no chão.
B = 2
# Mais alto do que isto acima do chão, e sem ser verde, é casa.
ALTURA_DE_CASA = 1.8
# Até isto acima do chão ainda é chão (lombas, passeios, entulho baixo).
ALTURA_DE_CHAO = 0.7
# O excesso de verde a partir do qual é vegetação.
VERDE = 0.06
# Os buracos no chão mais pequenos do que isto são carros, postes, gente:
# tapam-se. As manchas de chão mais pequenas do que isto não levam a lado
# nenhum: saem.
BURACO_M2 = 25.0
MANCHA_M2 = 40.0
# Um beco interrompido junta-se a outro troço se a ponte tiver até isto de
# comprimento e não atravessar mais de PONTE_TELHADO de telhado.
PONTE_M = 4.0
PONTE_TELHADO = 1.0
# Os pedaços da rede separados do resto juntam-se a ela por pontes até isto.
LIGAR_M = 9.0
# Uma estrada: troço com pelo menos isto de largura e cinzento.
ESTRADA_LARGURA = 5.0
ESTRADA_SATURACAO = 0.16
RUA_LARGURA = 2.6
# Uma casa não vai além disto do seu ponto (os telhados colados não têm
# sempre aresta entre eles).
RAIO_DA_CASA = 8.0
# A porta fica, no máximo, a isto da rede; mais longe, a casa fica ligada
# por uma linha a tracejado até ao ponto da rede mais perto.
PORTA_M = 15.0


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
    return dC, vala


# ------------------------------------------------------------- máscaras ---

def sem_pequenos(m, area_px):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    fica = np.zeros(n, bool)
    fica[1:] = st[1:, cv2.CC_STAT_AREA] >= area_px
    return fica[lab]


def sem_buracos(m, area_px):
    return ~sem_pequenos(~m, area_px) | m


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
        novo = dict(da)
        novo["pts"] = np.vstack([pa, pb[1:]])
        if da.get("tipo") != db.get("tipo"):
            novo.pop("tipo", None)
        G.remove_node(n)
        G.add_edge(a, b, **novo)


def podar(G, meia_largura, cell):
    """Corta os espigões: bocados soltos que o desenho deixa nos largos."""
    mudou = True
    while mudou:
        mudou = False
        for n in list(G.nodes):
            if n not in G or G.degree(n) != 1:
                continue
            (_, outro, k, d) = next(iter(G.edges(n, keys=True, data=True)))
            if outro == n or G.degree(outro) < 3:
                continue
            L = comprimento(np.asarray(d["pts"], float)) * cell
            r, c = np.round(G.nodes[outro]["o"]).astype(int)
            meia = meia_largura[min(r, meia_largura.shape[0] - 1), min(c, meia_largura.shape[1] - 1)]
            if L < max(2.5, 1.5 * meia + 1.0):
                G.remove_node(n)
                mudou = True
        juntar_grau_2(G)


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


def telhado_no_caminho(a, b, edif, cell):
    """Quantos metros de telhado atravessa a linha reta de a a b."""
    L = np.hypot(*(b - a))
    n = max(2, int(L / 0.5) + 1)
    t = np.linspace(0, 1, n)
    r = np.clip(np.round(a[0] + (b[0] - a[0]) * t).astype(int), 0, edif.shape[0] - 1)
    c = np.clip(np.round(a[1] + (b[1] - a[1]) * t).astype(int), 0, edif.shape[1] - 1)
    return edif[r, c].mean() * L * cell


def pontes(G, edif, cell, proximo):
    """Junta os becos interrompidos (por um beiral, uma árvore) ao troço mais
    perto, se a ponte for curta e quase não atravessar telhados."""
    pts, quem = densos(G, 0.5 / cell)
    arvore = cKDTree(pts)
    feitas = 0
    for n in [n for n in G.nodes if G.degree(n) == 1]:
        if n not in G or G.degree(n) != 1:
            continue
        o = np.asarray(G.nodes[n]["o"], float)
        perto = nx.single_source_dijkstra_path_length(G, n, cutoff=12 / cell, weight=lambda a, b, d: min(
            comprimento(np.asarray(e["pts"], float)) for e in d.values()))
        melhor = None
        for j in arvore.query_ball_point(o, PONTE_M / cell):
            u, v, k, i = quem[j]
            if u in perto and v in perto:
                continue
            if not G.has_edge(u, v, k):
                continue
            L = np.hypot(*(pts[j] - o))
            if L < 1e-6 or telhado_no_caminho(o, pts[j], edif, cell) > PONTE_TELHADO:
                continue
            if melhor is None or L < melhor[0]:
                melhor = (L, j)
        if melhor is None:
            continue
        u, v, k, i = quem[melhor[1]]
        alvo = partir(G, u, v, k, i, proximo(), pts[melhor[1]])
        G.add_edge(n, alvo, pts=np.array([o, np.asarray(G.nodes[alvo]["o"], float)]), tipo="ligacao")
        feitas += 1
        # os pontos mudaram de troço: refazer a árvore
        pts, quem = densos(G, 0.5 / cell)
        arvore = cKDTree(pts)
    return feitas


def ligar_pedacos(G, edif, cell, proximo):
    """Os pedaços da rede soltos do resto ligam-se a ele pela ponte mais
    curta que quase não atravesse telhados."""
    ligados = 0
    while True:
        comps = sorted(nx.connected_components(G), key=lambda c: -sum(
            comprimento(np.asarray(d["pts"], float)) for _, _, d in G.subgraph(c).edges(data=True)))
        if len(comps) < 2:
            break
        principal = comps[0]
        pts, quem = densos(G.subgraph(principal), 0.5 / cell)
        arvore = cKDTree(pts)
        feito = False
        for comp in comps[1:]:
            cp, cq = densos(G.subgraph(comp), 0.5 / cell)
            if not len(cp):
                continue
            dist, j = arvore.query(cp, distance_upper_bound=LIGAR_M / cell)
            ordem = np.argsort(dist)
            for a in ordem:
                if not np.isfinite(dist[a]):
                    break
                if telhado_no_caminho(cp[a], pts[j[a]], edif, cell) > 1.5:
                    continue
                u1, v1, k1, i1 = cq[a]
                u2, v2, k2, i2 = quem[j[a]]
                n1 = partir(G, u1, v1, k1, i1, proximo(), cp[a])
                n2 = partir(G, u2, v2, k2, i2, proximo(), pts[j[a]])
                G.add_edge(n1, n2, pts=np.array([np.asarray(G.nodes[n1]["o"], float),
                                                 np.asarray(G.nodes[n2]["o"], float)]), tipo="ligacao")
                ligados += 1
                feito = True
                break
            if feito:
                break
        if not feito:
            break
    return ligados


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


def nomear_estradas(G, estradas, nos, cell):
    """Um troço reconhecido que vai por cima de uma estrada do OpenStreetMap
    é estrada, e fica com o nome dela."""
    from collections import Counter
    pts, nome = [], []
    for e in estradas:
        P = [nos[n] for n in e["nos"]]
        for A, B in zip(P[:-1], P[1:]):
            k = max(1, int(np.hypot(*(B - A)) * cell))
            for t in np.linspace(0, 1, k, endpoint=False):
                pts.append(A + (B - A) * t)
                nome.append(e["nome"])
        pts.append(P[-1])
        nome.append(e["nome"])
    arvore = cKDTree(np.array(pts))
    for u, v, k, d in G.edges(keys=True, data=True):
        if d.get("osm") or d.get("largura", 0) < 2.5:
            continue
        dist, j = arvore.query(d["pts"], distance_upper_bound=7 / cell)
        perto = np.isfinite(dist)
        if perto.mean() >= 0.6:
            d["tipo"] = "estrada"
            nomes = [nome[i] for i in j[perto] if nome[i]]
            d["nome"] = Counter(nomes).most_common(1)[0][0] if nomes else ""


def juntar_estradas(G, estradas, nos, usos, dentro, edif, cell, proximo):
    """As estradas de fora da zona do ortofotomapa entram na rede. Onde uma
    delas entra na zona, liga-se ao troço reconhecido mais perto — que é a
    mesma estrada, vista do drone."""
    H, W = dentro.shape

    def fora(q):
        r, c = int(round(q[0])), int(round(q[1]))
        return not (0 <= r < H and 0 <= c < W and dentro[r, c])

    no_osm, cortes = {}, []

    def no_de(chave, q):
        if chave not in no_osm:
            n = proximo()
            G.add_node(n, o=np.asarray(q, float))
            no_osm[chave] = n
            if chave[0] == "corte":
                cortes.append(n)
        return no_osm[chave]

    passo = 2.0 / cell
    for e in estradas:
        ids = e["nos"]
        P = [nos[n] for n in ids]
        corrida, inicio = [], None

        def fechar(chave_fim, q_fim):
            if len(corrida) >= 2:
                a, b = no_de(*inicio), no_de(chave_fim, q_fim)
                if a != b:
                    G.add_edge(a, b, pts=np.array(corrida), tipo="estrada", nome=e["nome"], osm=True)

        for i in range(len(P) - 1):
            A, B = P[i], P[i + 1]
            k = max(1, int(math.ceil(np.hypot(*(B - A)) / passo)))
            for s in range(k):
                a, b = A + (B - A) * s / k, A + (B - A) * (s + 1) / k
                if fora((a + b) / 2):
                    if not corrida:
                        inicio = (("osm", ids[i]), a) if s == 0 else (("corte", proximo()), a)
                        corrida = [a]
                    corrida.append(b)
                elif corrida:
                    fechar(("corte", proximo()), a)
                    corrida = []
            if corrida and i + 1 < len(P) - 1 and usos.get(ids[i + 1], 0) >= 2:
                fechar(("osm", ids[i + 1]), B)
                corrida, inicio = [B], (("osm", ids[i + 1]), B)
        if corrida:
            fechar(("osm", ids[-1]), P[-1])

    # As pontas cortadas à entrada da zona ligam-se à rede reconhecida.
    ligadas = 0
    for n in cortes:
        if n not in G or G.degree(n) == 0:
            if n in G:
                G.remove_node(n)
            continue
        reconhecidos = [(u, v, k) for u, v, k, d in G.edges(keys=True, data=True) if not d.get("osm")]
        pts, quem = densos(G.edge_subgraph(reconhecidos), 0.5 / cell)
        dist, j = cKDTree(pts).query(G.nodes[n]["o"], distance_upper_bound=30 / cell)
        if not np.isfinite(dist):
            continue
        o = np.asarray(G.nodes[n]["o"], float)
        if telhado_no_caminho(o, pts[j], edif, cell) > 1.5:
            continue
        u, v, k, i = quem[j]
        alvo = partir(G, u, v, k, i, proximo(), pts[j])
        nome = next(iter(G.edges(n, data=True)))[2].get("nome", "")
        G.add_edge(n, alvo, pts=np.array([o, np.asarray(G.nodes[alvo]["o"], float)]),
                   tipo="estrada", nome=nome, osm=True)
        ligadas += 1
    # O que ficou sem ligação ao bairro não serve para lá chegar: sai.
    reconhecido = {n for u, v, d in G.edges(data=True) if not d.get("osm") for n in (u, v)}
    for comp in list(nx.connected_components(G)):
        if not comp & reconhecido:
            G.remove_nodes_from(comp)
    juntar_grau_2(G)
    return ligadas


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

    chao, vala = terreno(Zmin, valido, cell)
    nd = np.where(valido, Zmin - chao, np.nan)
    ndm = np.where(valido, Zmed - chao, np.nan)
    tempo(t0, "terreno")

    r_, g_, b_ = col[..., 0], col[..., 1], col[..., 2]
    verde = (2 * g_ - r_ - b_) / (r_ + g_ + b_ + 1e-3) > VERDE
    m2 = 1 / (cell * cell)
    edif = mk & (ndm > ALTURA_DE_CASA) & ~verde
    edif = sem_pequenos(edif, int(6 * m2))
    andavel = mk & valido & (nd < ALTURA_DE_CHAO) & ~verde
    u8 = andavel.astype(np.uint8)
    disco = lambda m: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(3, int(round(m / cell)) | 1),) * 2)
    u8 = cv2.morphologyEx(u8, cv2.MORPH_OPEN, disco(0.6))
    u8 = cv2.morphologyEx(u8, cv2.MORPH_CLOSE, disco(1.0))
    andavel = sem_buracos(u8 > 0, int(BURACO_M2 * m2))
    andavel = sem_pequenos(andavel, int(MANCHA_M2 * m2))
    andavel = cv2.GaussianBlur(andavel.astype(np.float32), (0, 0), 0.4 / cell) > 0.5
    tempo(t0, "classes")

    meia_largura = cv2.distanceTransform(andavel.astype(np.uint8), cv2.DIST_L2, 5) * cell
    esq = skeletonize(andavel)
    G = sknw.build_sknw(esq.astype(np.uint16), multi=True, iso=False, ring=True, full=True)
    for n in G.nodes:
        G.nodes[n]["o"] = np.asarray(G.nodes[n]["o"], float)
    for u, v, kk, d in G.edges(keys=True, data=True):
        d["pts"] = np.asarray(d["pts"], float)
    tempo(t0, "esqueleto: %d nós, %d troços" % (G.number_of_nodes(), G.number_of_edges()))

    contador = [max(G.nodes) + 1 if G.number_of_nodes() else 0]

    def proximo():
        contador[0] += 1
        return contador[0] - 1

    podar(G, meia_largura, cell)
    tempo(t0, "podada: %d nós, %d troços" % (G.number_of_nodes(), G.number_of_edges()))
    n_pontes = pontes(G, edif, cell, proximo)
    juntar_grau_2(G)
    tempo(t0, "pontes nos becos interrompidos: %d" % n_pontes)
    n_lig = ligar_pedacos(G, edif, cell, proximo)
    tempo(t0, "pedaços ligados: %d" % n_lig)
    # o que ficou solto e é pequeno sai
    for comp in list(nx.connected_components(G)):
        tot = sum(comprimento(d["pts"]) for _, _, d in G.subgraph(comp).edges(data=True)) * cell
        if tot < 25:
            G.remove_nodes_from(comp)
    podar(G, meia_largura, cell)

    # A largura de cada troço (antes de simplificar a linha), e daí se é rua
    # ou beco; estrada é o que vai por cima de uma do OpenStreetMap.
    def para_grelha(lon, lat):
        E, N = mercator(lon, lat)
        return (N1 - N) / (p * B) - 0.5, (E - E0) / (p * B) - 0.5

    for u, v, kk, d in G.edges(keys=True, data=True):
        pp = np.round(d["pts"]).astype(int)
        pp[:, 0] = np.clip(pp[:, 0], 0, Hc - 1)
        pp[:, 1] = np.clip(pp[:, 1], 0, Wc - 1)
        d["largura"] = float(np.median(meia_largura[pp[:, 0], pp[:, 1]]) * 2)
        if d.get("tipo") != "ligacao":
            d["tipo"] = "rua" if d["largura"] >= RUA_LARGURA else "beco"
    estradas, nos_osm, usos = ler_estradas(para_grelha)
    nomear_estradas(G, estradas, nos_osm, cell)
    for u, v, kk, d in G.edges(keys=True, data=True):
        d["pts"] = cv2.approxPolyDP(d["pts"][:, ::-1].astype(np.float32).reshape(-1, 1, 2), 0.2 / cell, False)[:, 0, ::-1].astype(float)
    # A zona onde a rede é a reconhecida: a do ortofotomapa, menos 3 m.
    dentro = cv2.erode(mk.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))) > 0
    n_est = juntar_estradas(G, estradas, nos_osm, usos, dentro, edif, cell, proximo)
    tempo(t0, "estradas de fora ligadas: %d" % n_est)
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
        casas_saida.setdefault(numero, []).append(dict(
            no=no_da_casa[c], porta=porta, dist=dist, lon=lon, lat=lat, telhado=tel))
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
            if c["telhado"]:
                item["contorno"] = [geo(*q) for q in c["telhado"]["contorno"]]
            saida_casas.append(item)
    os.makedirs(SAIDA, exist_ok=True)
    dados = dict(
        versao=1,
        fonte="Ruas e casas reconhecidas no ortofotomapa e no modelo 3D do voo de drone de 15-02-2026; "
              "numeração das casas do levantamento do bairro; estradas de fora do bairro "
              "© contribuidores do OpenStreetMap (ODbL)",
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
    """Imagens para ver se o reconhecimento bate com a fotografia."""
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
