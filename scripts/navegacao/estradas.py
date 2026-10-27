# As estradas públicas à volta do bairro, do OpenStreetMap.
#
# Dentro do bairro, as ruas e os becos saem do ortofotomapa (ver
# reconhecer.py): no OpenStreetMap quase não estão. Mas quem vem de fora
# chega pelas estradas à volta — a Rua dos Três Vales, a Rua de São Lourenço
# Nascente, a Rua dos Lusíadas —, e algumas casas numeradas (as F) ficam já
# fora da zona do ortofotomapa, ao pé de uma delas. Por isso a rede continua
# por essas estradas, com os nomes que têm, até uns 300 metros do bairro.
#
#     python -P scripts/navegacao/estradas.py
#
# Grava scripts/navegacao/estradas-osm.json: só as estradas (e não os
# passeios nem os caminhos), com o nome e os pontos de cada uma. Os dados são
# © contribuidores do OpenStreetMap, com a licença ODbL — o crédito vai na
# página da navegação. Volta a correr-se se as estradas à volta mudarem.
import json, os, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import AQUI, geograficas, grelha

SAIDA = os.path.join(AQUI, "estradas-osm.json")
# As que levam carros (e as de peões largas, como as praças).
TIPOS = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential",
         "living_street", "service", "pedestrian", "primary_link", "secondary_link", "tertiary_link"]
MARGEM_M = 300


def main():
    E0, N1, p, W, H = grelha()
    oeste, norte = geograficas(E0 - MARGEM_M / 0.78, N1 + MARGEM_M / 0.78)
    este, sul = geograficas(E0 + p * W + MARGEM_M / 0.78, N1 - p * H - MARGEM_M / 0.78)
    pedido = '[out:json][timeout:60];way["highway"~"^(%s)$"](%.5f,%.5f,%.5f,%.5f);(._;>;);out body;' % (
        "|".join(TIPOS), sul, oeste, norte, este)
    # O curl, e não o urllib: neste computador o Python não consegue abrir
    # ligações seguras a alguns servidores. O servidor do Overpass às vezes
    # responde vazio quando está ocupado: tenta-se outra vez, um pouco depois.
    for tentativa in range(5):
        r = subprocess.run(["curl", "-s", "-m", "120", "-A", "MalhaViva/1.0 (navegacao do Bairro de Penajoia)",
                            "--data-urlencode", "data=" + pedido, "https://overpass-api.de/api/interpreter"],
                           capture_output=True)
        try:
            dados = json.loads(r.stdout.decode("utf8"))
            break
        except ValueError:
            print("o Overpass não respondeu (%d bytes); outra vez daqui a 20 s" % len(r.stdout), flush=True)
            time.sleep(20)
    else:
        sys.exit("o Overpass não respondeu")
    nos = {e["id"]: (round(e["lat"], 7), round(e["lon"], 7)) for e in dados["elements"] if e["type"] == "node"}
    estradas = []
    for e in dados["elements"]:
        if e["type"] != "way":
            continue
        t = e.get("tags", {})
        estradas.append(dict(id=e["id"], tipo=t.get("highway"), nome=t.get("name", ""),
                             nos=[n for n in e["nodes"] if n in nos]))
    usados = {n for e in estradas for n in e["nos"]}
    saida = dict(
        fonte="© contribuidores do OpenStreetMap (ODbL), via Overpass API",
        data=time.strftime("%Y-%m-%d"),
        caixa=[round(sul, 5), round(oeste, 5), round(norte, 5), round(este, 5)],
        nos={str(n): nos[n] for n in usados},
        estradas=estradas)
    with open(SAIDA, "w", encoding="utf8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    print("%d estradas, %d pontos -> %s" % (len(estradas), len(usados), SAIDA))


if __name__ == "__main__":
    main()
