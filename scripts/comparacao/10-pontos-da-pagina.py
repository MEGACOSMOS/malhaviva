# Pontos do LiDAR (com a cor que a DGT lhes deu) e centros das manchas do modelo do drone,
# em caixas de 24 m, para a comparação de qualidade em 3D na página /comparacao.
import numpy as np, json, laspy
from caminhos import *
OUT=SAIDA_PAGINA+'pontos/'
import os; os.makedirs(OUT, exist_ok=True)
SITIOS=[('casas', -91295.3,-110040.4),('casas2',-91247.3,-110200.4),('beco',-91383.3,-110152.4),('novas',-91423.3,-110115.9)]
L=12.0
las=[laspy.read(lidar_laz(n)) for n in QUADRICULAS]
print(list(las[0].point_format.dimension_names))
lx=np.concatenate([np.asarray(f.x) for f in las]); ly=np.concatenate([np.asarray(f.y) for f in las]); lz=np.concatenate([np.asarray(f.z) for f in las])
lc=np.concatenate([np.asarray(f.classification) for f in las])
tem_cor='red' in las[0].point_format.dimension_names
if tem_cor:
    rgb=np.concatenate([np.stack([np.asarray(f.red),np.asarray(f.green),np.asarray(f.blue)],1) for f in las]).astype(np.float64)
    if rgb.max()>255: rgb=rgb/256
Mo=np.load('modelo.npz'); L0=np.load(LAZ_BAIRRO); E0,N0=np.median(L0['x']),np.median(L0['y'])
sol=np.mean(json.load(open('vertical.json'))['solucoes'],0)
mE,mN,op=Mo['E'],Mo['N'],Mo['op']; cor=np.clip(0.5+0.28209479*Mo['cor'],0,1)
meta=[]
for nome,cx,cy in SITIOS:
    k=(abs(lx-cx)<L)&(abs(ly-cy)<L)&(lc!=7)
    z0=np.percentile(lz[k],2)
    c=(rgb[k] if tem_cor else np.full((k.sum(),3),200.)).astype(np.uint8)
    a=np.zeros(k.sum(),dtype=[('x','<i2'),('y','<i2'),('z','<i2'),('r','u1'),('g','u1'),('b','u1')])
    a['x']=np.round((lx[k]-cx)*100); a['y']=np.round((ly[k]-cy)*100); a['z']=np.round((lz[k]-z0)*100)
    a['r'],a['g'],a['b']=c[:,0],c[:,1],c[:,2]
    a.tofile(OUT+f'{nome}_lidar.bin')
    j=(abs(mE-cx)<L)&(abs(mN-cy)<L)&(op>0.2)
    zz=sol[0]*Mo['z'][j]+sol[1]*(mE[j]-E0)+sol[2]*(mN[j]-N0)+sol[3]
    b=np.zeros(j.sum(),dtype=a.dtype)
    b['x']=np.round((mE[j]-cx)*100); b['y']=np.round((mN[j]-cy)*100); b['z']=np.round((zz-z0)*100)
    cc=(cor[j]*255).astype(np.uint8); b['r'],b['g'],b['b']=cc[:,0],cc[:,1],cc[:,2]
    b.tofile(OUT+f'{nome}_drone.bin')
    meta.append(dict(nome=nome,E=cx,N=cy,lado=2*L,lidar=int(k.sum()),drone=int(j.sum()),drone_opacos=int(((abs(mE-cx)<L)&(abs(mN-cy)<L)&(op>0.5)).sum())))
    print(meta[-1])
json.dump(dict(sitios=meta,cor_lidar=tem_cor),open(OUT+'pontos.json','w'))
