# lato.py out.png PID LATO [gamma] : CC e MLO del lato indicato a media risoluzione (e crop opzionale x0,y0,x1,y1 in frazioni)
import sys,glob,os,pydicom,numpy as np
from PIL import Image,ImageDraw
B=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/cmmd/')
out,pid,lat=sys.argv[1:4]; crop=sys.argv[4] if len(sys.argv)>4 else None; W=int(sys.argv[5]) if len(sys.argv)>5 else 700
ims=[]
for f in sorted(glob.glob(B+pid+'/*/*.dcm')):
    d=pydicom.dcmread(f)
    if getattr(d,'ImageLaterality','')!=lat: continue
    a=d.pixel_array.astype(float); po='/'.join(d.PatientOrientation)
    if crop:
        x0,y0,x1,y1=map(float,crop.split(',')); H,Wd=a.shape; a=a[int(y0*H):int(y1*H),int(x0*Wd):int(x1*Wd)]
    lo,hi=np.percentile(a,[1,99.9]); im=Image.fromarray(np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8)).convert('RGB')
    im=im.resize((W,int(W*im.height/im.width)))
    ImageDraw.Draw(im).text((4,4),f'{pid} {lat} {po} {os.path.basename(f)[:8]} sp={getattr(d,"PixelSpacing",getattr(d,"ImagerPixelSpacing","?"))}',fill=(255,255,0)); ims.append(im)
H=max(i.height for i in ims); C=Image.new('RGB',(W*len(ims),H))
for k,i in enumerate(ims): C.paste(i,(k*W,0))
C.save(out)
