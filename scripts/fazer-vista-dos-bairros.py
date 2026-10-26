# A vista com que o mapa dos bairros abre, numa fotografia só.
#
# O marcador do "Mapa dos Bairros" mostra no bairro a miniatura do que se
# vê ao abri-lo, como todos os outros (ver scripts/gerar-miniaturas.mjs). Só
# que o mapa não é um vídeo nem uma fotografia: é feito de bocadinhos da
# fotografia de satélite, pedidos à Esri à medida que se anda por ele. Esta
# fotografia é a primeira vista do mapa — os 27 bairros todos à vista —
# montada aqui com os mesmos bocadinhos e com os quadrados dos bairros por
# cima, e guardada em public/mapa-dos-bairros/vista.jpg. É dela que sai a
# miniatura.
#
#     python scripts/fazer-vista-dos-bairros.py
#     bun scripts/gerar-miniaturas.mjs
#
# Volta a correr-se se a lista dos bairros mudar (public/mapa-dos-bairros.mjs,
# de onde ela é lida) ou se a Esri trocar a fotografia por uma mais nova.
import io, math, os, re, urllib.request
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
PUBLICO = os.path.join(AQUI, "..", "public")
DADOS = os.path.join(PUBLICO, "mapa-dos-bairros.mjs")
SAIDA = os.path.join(PUBLICO, "mapa-dos-bairros", "vista.jpg")

# Do tamanho de um ecrã de computador, com as folgas que a página deixa às
# barras de cima e de baixo (ver vistaDoPrincipio em mapa-dos-bairros.html).
LARGURA, ALTURA = 1920, 1080
FOLGA_CIMA, FOLGA_BAIXO, FOLGA_LADO = 100, 92, 24
TILE = 256

texto = open(DADOS, encoding="utf8").read()
bairros = [(n, float(lo), float(la)) for n, lo, la in re.findall(
    r"nome: '([^']+)', lon: ([-\d.]+), lat: ([-\d.]+)", texto)]
endereco = re.search(r"endereco: '(https://server\.arcgisonline[^']+)'", texto).group(1)
penajoia = re.search(r"PENAJOIA = '([^']+)'", texto).group(1)
assert len(bairros) == 27, len(bairros)


def mundo(lon, lat):
    """Longitude e latitude na Web Mercator, de 0 a 1."""
    s = math.sin(math.radians(lat))
    return (lon + 180) / 360, 0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)


pts = [mundo(lo, la) for _, lo, la in bairros]
x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)

# O zoom e o meio do fitBounds do Leaflet, com as mesmas folgas.
uteis_w = LARGURA - 2 * FOLGA_LADO
uteis_h = ALTURA - FOLGA_CIMA - FOLGA_BAIXO
zoom = min(math.log2(uteis_w / (TILE * (x1 - x0))), math.log2(uteis_h / (TILE * (y1 - y0))))
escala = TILE * 2 ** zoom
cx = (x0 + x1) / 2 * escala
cy = (y0 + y1) / 2 * escala + (FOLGA_BAIXO - FOLGA_CIMA) / 2

# Os bocadinhos de um nível mais perto, reduzidos: mais nítido.
nivel = math.ceil(zoom)
fator = 2 ** (nivel - zoom)
W, H = round(LARGURA * fator), round(ALTURA * fator)
esq = cx * fator - W / 2
topo = cy * fator - H / 2
grande = Image.new("RGB", (W, H))
for ty in range(int(topo // TILE), int((topo + H) // TILE) + 1):
    for tx in range(int(esq // TILE), int((esq + W) // TILE) + 1):
        url = endereco.replace("{z}", str(nivel)).replace("{y}", str(ty)).replace("{x}", str(tx))
        pedido = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Malha Viva)"})
        for tentativa in range(5):   # o servidor às vezes corta a ligação
            try:
                dados = urllib.request.urlopen(pedido, timeout=60).read()
                break
            except OSError:
                if tentativa == 4:
                    raise
        img = Image.open(io.BytesIO(dados)).convert("RGB")
        grande.paste(img, (round(tx * TILE - esq), round(ty * TILE - topo)))
vista = grande.resize((LARGURA, ALTURA), Image.LANCZOS)

# Os quadrados, mais grossos do que na página: a miniatura é quatro vezes
# mais pequena, e lá têm de se ver.
d = ImageDraw.Draw(vista)
for (nome, lo, la), (px, py) in zip(bairros, pts):
    x = px * escala - cx + LARGURA / 2
    y = py * escala - cy + ALTURA / 2
    destaque = nome == penajoia
    lado = 30 if destaque else 24
    borda = 5
    fundo, contorno = ((255, 255, 255), (5, 5, 10)) if destaque else ((5, 5, 10), (255, 255, 255))
    d.rectangle((x - lado / 2, y - lado / 2, x + lado / 2, y + lado / 2), fill=contorno)
    d.rectangle((x - lado / 2 + borda, y - lado / 2 + borda, x + lado / 2 - borda, y + lado / 2 - borda), fill=fundo)

os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
vista.save(SAIDA, quality=85, optimize=True, progressive=True)
print(SAIDA, vista.size, "zoom %.2f" % zoom)
