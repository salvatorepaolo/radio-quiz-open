# ldct_vedi.py PAZ out.png wc,ww half "x,y,inst;x,y,inst;..."  -> per ogni punto: full | low, ritaglio centrato (half px), cerchio
import sys,glob,os,pydicom,numpy as np
from PIL import Image,ImageDraw
G=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/LDCT/')
p,out,win,half,pts=sys.argv[1:6]; wc,ww=map(float,win.split(',')); half=int(half)
def ser(kind):
    d=[x for x in glob.glob(G+p+'/CT_*') if kind in x][0]
    return {int(pydicom.dcmread(f,stop_before_pixels=True).InstanceNumber):f for f in glob.glob(d+'/*.dcm')}
F,L=ser('Full'),ser('Low'); rows=[]
for t in pts.split(';'):
    x,y,i=map(float,t.split(',')); i=int(round(i)); ims=[]
    for S,lab in ((F,'FULL'),(L,'LOW')):
        d=pydicom.dcmread(S[i]); a=d.pixel_array*float(d.RescaleSlope)+float(d.RescaleIntercept)
        if half>0:
            x0,y0=int(x)-half,int(y)-half; a=a[max(0,y0):y0+2*half,max(0,x0):x0+2*half]; cx,cy=x-max(0,x0),y-max(0,y0)
        else: cx,cy=x,y
        im=Image.fromarray(np.clip((a-wc+ww/2)/ww*255,0,255).astype(np.uint8)).convert('RGB'); s=400/im.width
        im=im.resize((400,int(im.height*s))); dr=ImageDraw.Draw(im); r=12
        dr.ellipse((cx*s-r*s/2-10,cy*s-r*s/2-10,cx*s+r*s/2+10,cy*s+r*s/2+10),outline=(255,0,0))
        dr.text((4,4),f'{p} {lab} inst {i}',fill=(255,255,0)); ims.append(im)
    rows.append(ims)
W=Image.new('RGB',(800,sum(r[0].height for r in rows))); y=0
for r in rows: W.paste(r[0],(0,y)); W.paste(r[1],(400,y)); y+=r[0].height
W.save(out)
