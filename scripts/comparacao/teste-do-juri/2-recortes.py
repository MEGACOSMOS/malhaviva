import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, json, rasterio
from rasterio.windows import from_bounds
from rasterio.warp import transform
from rasterio.merge import merge
from PIL import Image, ImageDraw
from caminhos import *
P=json.load(open('teste_juri.json'))
O=rasterio.open(ORTOFOTO)
srcs=[rasterio.open(lidar_raster('MDS', n)) for n in QUADRICULAS]
arr,tr=merge(srcs); a=arr[0].astype(float); a[a<-100]=np.nan; inv=~tr
def sombra(z):
    gy,gx=np.gradient(np.nan_to_num(z,nan=np.nanmedian(z)),0.5)
    az,alt=np.radians(315),np.radians(45); sl=np.arctan(np.hypot(gx,gy)); asp=np.arctan2(-gx,gy)
    return (np.clip(np.sin(alt)*np.cos(sl)+np.cos(alt)*np.sin(sl)*np.cos(az-asp),0,1)*255).astype(np.uint8)
S=40
for p in P:
    E,N=p['E'],p['N']
    xs,ys=transform('EPSG:3763','EPSG:3857',[E-S/2,E+S/2,E-S/2,E+S/2],[N-S/2,N-S/2,N+S/2,N+S/2])
    w=from_bounds(min(xs),min(ys),max(xs),max(ys),O.transform)
    im=Image.fromarray(np.moveaxis(O.read([1,2,3],window=w,out_shape=(3,500,500)),0,-1))
    c0,r0=inv*(E-S/2,N+S/2); c1,r1=inv*(E+S/2,N-S/2)
    h=Image.fromarray(sombra(a[int(r0):int(r1),int(c0):int(c1)])).resize((500,500)).convert('RGB')
    for x in (im,h):
        d=ImageDraw.Draw(x); d.ellipse((240,240,260,260),outline=(255,200,0),width=4)
    im.save(f"dr_{p['n']:02d}.png"); h.save(f"li_{p['n']:02d}.png")
