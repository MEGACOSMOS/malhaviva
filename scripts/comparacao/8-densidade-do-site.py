import numpy as np, json
from matplotlib.path import Path
from caminhos import *
P=MODELO_SITE_PLY
h=open(P,'rb').read(4000); off=h.index(b'end_header\n')+11; n=14317556
a=np.memmap(P,dtype='<f4',mode='r',offset=off,shape=(n,14))
reg=json.load(open(REGISTO))
m=json.load(open(MASCARA))
s=reg['s']; R=np.array(reg['R']); t=np.array(reg['t'])
XY=((np.stack([m['E'],m['N']],1)-t)/s)@R
d=Path(XY).contains_points(np.stack([np.array(a[:,0]),np.array(a[:,1])],1))
b=np.array(a[d]); sc=np.exp(b[:,7:10]); op=1/(1+np.exp(-b[:,10]))
area=206035.0  # m² do contorno, medido em 2-modelo.py
print('no bairro',d.sum(),'por m2',d.sum()/area,'confiantes',((op>0.5)&(sc.max(1)<0.25)).sum()/area,'opacas',(op>0.5).sum()/area)
