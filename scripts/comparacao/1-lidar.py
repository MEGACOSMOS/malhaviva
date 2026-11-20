# Lê as duas quadrículas do LiDAR da DGT (julho de 2024), guarda os pontos dentro
# do contorno da zona do drone (laz_bairro.npz) e mede a densidade de pontos.
import numpy as np, laspy, json
from rasterio.warp import transform
from matplotlib.path import Path
from caminhos import *
m=json.load(open(MASCARA))
lon,lat=transform('EPSG:3857','EPSG:4326',m['E'],m['N']); E,N=transform('EPSG:4326','EPSG:3763',lon,lat)
poly=Path(np.stack([E,N],1))
xs,ys,zs,cl,rn,nr,rgb=[],[],[],[],[],[],[]
for n in QUADRICULAS:
    f=laspy.read(lidar_laz(n))
    if n==108190: print(f.header.point_format, f.header.version, f.header.point_count, list(f.point_format.dimension_names)[:25])
    x=np.asarray(f.x);y=np.asarray(f.y)
    k=poly.contains_points(np.stack([x,y],1))
    xs.append(x[k]);ys.append(y[k]);zs.append(np.asarray(f.z)[k]);cl.append(np.asarray(f.classification)[k]);rn.append(np.asarray(f.return_number)[k]);nr.append(np.asarray(f.number_of_returns)[k])
    if 'red' in f.point_format.dimension_names: rgb.append(np.stack([f.red[k],f.green[k],f.blue[k]],1))
x=np.concatenate(xs);y=np.concatenate(ys);z=np.concatenate(zs);c=np.concatenate(cl);r=np.concatenate(rn)
xx=np.array(E);yy=np.array(N); area=0.5*abs(np.dot(xx,np.roll(yy,1))-np.dot(yy,np.roll(xx,1)))
print('área',round(area),'pontos',len(x),'pontos/m2',len(x)/area,'primeiros retornos/m2',(r==1).sum()/area)
u,cnt=np.unique(c,return_counts=True); print('classes',dict(zip(u.tolist(),cnt.tolist())))
# espaçamento: células 1 m com pontos
ix=np.floor(x).astype(int);iy=np.floor(y).astype(int); key=(ix-ix.min())*100000+(iy-iy.min())
uc,cc=np.unique(key,return_counts=True); print('pontos por m2 (mediana das células ocupadas)',np.median(cc),'p10',np.percentile(cc,10))
ix=np.floor(x/0.5).astype(int);iy=np.floor(y/0.5).astype(int); key=(ix-ix.min())*1000000+(iy-iy.min())
print('células de 50cm com pelo menos 1 ponto',len(np.unique(key))/(area*4))
if rgb: print('tem cor RGB')
np.savez('laz_bairro.npz',x=x,y=y,z=z,c=c)
