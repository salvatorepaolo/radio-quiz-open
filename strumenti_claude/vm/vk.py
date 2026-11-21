# vk.py caso serie idx1,idx2 wc,ww|auto crop(x0,y0,x1,y1 frazioni)|full out.png [cols]
import sys,json,os,pydicom,numpy as np
from PIL import Image,ImageDraw
CF=__import__('os').path.expanduser('~/mnt/Volumes--Caloggero')+'/piattaforma-quiz/casi-free/'
c,si,idx,win,crop,out=sys.argv[1:7]; cols=int(sys.argv[7]) if len(sys.argv)>7 else 3
s=json.load(open(f"{CF}/caso-tcia-{c}/serie.json"))[int(si)]
ims=[]
for i in [int(x) for x in idx.split(',')]:
    d=pydicom.dcmread(f"{CF}/caso-tcia-{c}/{s['files'][i]}"); a=d.pixel_array.astype(float)
    if a.ndim==3: a=a[...,0] if a.shape[-1]==3 else a[0]
    a=a*float(getattr(d,'RescaleSlope',1))+float(getattr(d,'RescaleIntercept',0))
    if win=='auto': lo,hi=np.percentile(a,[1,99.5])
    else: wc,ww=map(float,win.split(',')); lo,hi=wc-ww/2,wc+ww/2
    if crop!='full':
        x0,y0,x1,y1=map(float,crop.split(',')); H,W=a.shape; a=a[int(y0*H):int(y1*H),int(x0*W):int(x1*W)]
    im=Image.fromarray(np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8)).resize((400,400)).convert('RGB')
    ImageDraw.Draw(im).text((4,4),f's{si} i{i}',fill=(255,255,0)); ims.append(im)
r=(len(ims)+cols-1)//cols; W=Image.new('RGB',(400*cols,400*r))
for k,im in enumerate(ims): W.paste(im,((k%cols)*400,(k//cols)*400))
W.save(out)
