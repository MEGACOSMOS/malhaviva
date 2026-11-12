# Contornos dos edifícios do OpenStreetMap em coordenadas da cena (x, z).
import json, math
import numpy as np

_REG = r"G:/Outros computadores/O meu portátil/Malha Viva/Imagens/Ortofotomapa/processo/registo.json"
_OSM = r"E:/Malha Viva - trabalho/edificios/osm/edificios.json"
_reg = json.load(open(_REG, encoding="utf8"))
_s = _reg["s"]; _Rinv = np.linalg.inv(np.array(_reg["R"])); _t = np.array(_reg["t"])
_RT = 6378137.0


def lonlat_para_cena(lon, lat):
    m = np.array([_RT * math.radians(lon), _RT * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))])
    X = _Rinv @ ((m - _t) / _s)
    return float(X[0]), float(-X[1])


def carregar_osm():
    """Lista de (elemento, [(x, z), ...]) — só anéis exteriores."""
    d = json.load(open(_OSM, encoding="utf8"))
    out = []
    for e in d["elements"]:
        aneis = []
        if e["type"] == "way" and "geometry" in e:
            aneis.append(e["geometry"])
        elif e["type"] == "relation":
            aneis += [m["geometry"] for m in e.get("members", []) if m.get("role") == "outer" and "geometry" in m]
        for g in aneis:
            pts = [lonlat_para_cena(q["lon"], q["lat"]) for q in g]
            if len(pts) >= 4:
                out.append((e, pts))
    return out
