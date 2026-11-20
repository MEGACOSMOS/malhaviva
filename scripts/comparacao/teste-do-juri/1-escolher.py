# Escolhe os dez sítios de construção nova do "teste para o júri".
# Entre as manchas de construção nova de 7-atualidade.py (atualidade.npz), ficam
# as maiores, com subida mediana abaixo de 5 m (acima disso são bordas do modelo
# ou objetos altos, não casas) e a pelo menos 30 m umas das outras. Em cada uma
# o ponto escolhido é o mais afastado da borda da mancha, para cair em cima de
# um telhado. Escreve teste_juri.json e teste_do_juri.csv, com as ligações para
# o site e para o Google Earth.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, json, csv
from scipy import ndimage
from rasterio.warp import transform
from caminhos import *

A = np.load('atualidade.npz'); novo = A['novo']
z = np.load('mudanca.npz'); DL, d, cs = z['DL'], z['d'], float(z['cs']); x0, y0 = float(z['x0']), float(z['y0'])
lab, n = ndimage.label(novo)
idx = np.arange(1, n + 1)
area = ndimage.sum(np.ones_like(d), lab, idx) * cs * cs
subida = ndimage.median(np.nan_to_num(d), lab, idx)
centro = ndimage.center_of_mass(novo, lab, idx)
print(n, 'manchas,', round(float(area.sum())), 'm²')

escolhidas = []
for k in np.argsort(-area):
    if subida[k] >= 5: continue
    r, c = centro[k]; E = x0 + (c + .5) * cs; N = y0 + (r + .5) * cs
    if all(np.hypot(E - p['E'], N - p['N']) > 30 for p in escolhidas):
        escolhidas.append(dict(id=int(k + 1), area=round(float(area[k]), 1), dz=round(float(subida[k]), 2), E=E, N=N))
    if len(escolhidas) == 10: break

dist = ndimage.distance_transform_edt(novo)
for i, p in enumerate(escolhidas, 1):
    dd = np.where(lab == p['id'], dist, 0); r, c = np.unravel_index(dd.argmax(), dd.shape)
    E = x0 + (c + .5) * cs; N = y0 + (r + .5) * cs
    lon, lat = transform('EPSG:3763', 'EPSG:4326', [E], [N]); lat, lon = lat[0], lon[0]
    chao = float(np.nanmedian(DL[max(r - 20, 0):r + 20, max(c - 20, 0):c + 20]))
    p.update(n=i, E=E, N=N, lat=round(lat, 6), lon=round(lon, 6), chao=round(chao, 1))
    p['site'] = f'https://malhaviva.pt/@{lat:.6f},{lon:.6f}'
    p['ge'] = f'https://earth.google.com/web/@{lat:.6f},{lon:.6f},{chao:.0f}a,120d,35y,0h,0t,0r'
    print(i, p['area'], 'm²', p['site'])

json.dump(escolhidas, open('teste_juri.json', 'w'), indent=1)
with open('teste_do_juri.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f, delimiter=';')
    w.writerow(['n', 'latitude', 'longitude', 'E_3763', 'N_3763', 'area_nova_m2', 'subida_mediana_m', 'ligacao_malhaviva', 'ligacao_google_earth'])
    for p in escolhidas:
        w.writerow([p['n'], p['lat'], p['lon'], round(p['E'], 2), round(p['N'], 2), p['area'], p['dz'], p['site'], p['ge']])
