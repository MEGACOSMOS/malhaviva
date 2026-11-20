import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from caminhos import *
f=ImageFont.truetype('arial.ttf',18); fb=ImageFont.truetype('arialbd.ttf',20)
T=230; G=8
def escala(im):
    a=np.asarray(im.convert('L')).astype(int)
    best=None
    for y in range(885,902):
        row=a[y,1050:1300]>110
        xs=np.nonzero(row)[0]
        if len(xs)>60:
            runs=np.split(xs,np.nonzero(np.diff(xs)>1)[0]+1); r=max(runs,key=len)
            if best is None or len(r)>best: best=len(r)
    return best
W=2*(3*T+2*G)+40; H=60+5*(T+34)
g=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(g)
for c in range(2):
    x0=c*(3*T+2*G+40)
    for j,t in enumerate(['Drone, fev 2026','LiDAR DGT, jul 2024','Google Earth, abr 2023']):
        d.text((x0+j*(T+G)+4,20),t,font=fb,fill='black')
for k in range(10):
    ge=Image.open(f'ge_{k+1:02d}.png').convert('RGB'); px=escala(ge)/10
    cx,cy=ge.width/2,ge.height/2; h=20*px
    gc=ge.crop((int(cx-h),int(cy-h),int(cx+h),int(cy+h))).resize((500,500))
    ImageDraw.Draw(gc).ellipse((240,240,260,260),outline=(255,200,0),width=4)
    ims=[Image.open(f'dr_{k+1:02d}.png'),Image.open(f'li_{k+1:02d}.png'),gc]
    c=k//5; r=k%5; x0=c*(3*T+2*G+40); y0=60+r*(T+34)
    d.text((x0+2,y0+2),f'{k+1}',font=fb,fill='black')
    for j,m in enumerate(ims): g.paste(m.convert('RGB').resize((T,T)),(x0+j*(T+G),y0+28))
    print(k+1,px)
g.save('teste_juri.jpg',quality=88)
