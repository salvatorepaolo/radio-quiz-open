# sag.py caso serie xfrac1,xfrac2 wc,ww out.png [coronale]  -> ricostruzioni sagittali (o coronali) con indici delle immagini
import sys,json,os,pydicom,numpy as np
from PIL import Image,ImageDraw
CF=os.path.expanduser('~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free/')
c,si,xs,win,out=sys.argv[1:6]; cor=len(sys.argv)>6
s=json.load(open(f"{CF}caso-tcia-{c}/serie.json"))[int(si)]
v=[];
for f in s['files']:
    d=pydicom.dcmread(CF+f"caso-tcia-{c}/"+f); a=d.pixel_array.astype(float)*float(getattr(d,'RescaleSlope',1))+float(getattr(d,'RescaleIntercept',0)); v.append(a)
v=np.stack(v); ps=float(d.PixelSpacing[0]); th=float(getattr(d,'SliceThickness',3) or 3)
wc,ww=map(float,win.split(',')); lo,hi=wc-ww/2,wc+ww/2
ims=[]
for x in xs.split(','):
    x=float(x); 
    sl=v[:,int(x*v.shape[1]),:] if cor else v[:,:,int(x*v.shape[2])]
    im=Image.fromarray(np.clip((sl-lo)/(hi-lo)*255,0,255).astype(np.uint8))
    h=int(sl.shape[0]*th/ps); im=im.resize((sl.shape[1],h)).convert('RGB'); D=ImageDraw.Draw(im)
    for i in range(0,sl.shape[0],5):
        y=int(i*th/ps); D.line([(0,y),(12 if i%10 else 25,y)],fill=(255,255,0)); 
        if i%10==0: D.text((28,y-5),str(i),fill=(255,255,0))
    D.text((5,5),f"{'cor' if cor else 'sag'} {x}",fill=(0,255,0)); ims.append(im)
W=Image.new('RGB',(sum(i.size[0] for i in ims),max(i.size[1] for i in ims))); X=0
for im in ims: W.paste(im,(X,0)); X+=im.size[0]
W.save(out); print(v.shape,ps,th)
