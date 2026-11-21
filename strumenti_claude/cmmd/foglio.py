# foglio.py out.png PID [PID...] : provino delle mammografie CMMD scaricate (una riga per paziente)
import sys,glob,os,pydicom,numpy as np
from PIL import Image,ImageDraw
B=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/cmmd/')
out=sys.argv[1]; rows=[]
for pid in sys.argv[2:]:
    fs=sorted(glob.glob(B+pid+'/*/*.dcm')); ims=[]
    for f in fs:
        d=pydicom.dcmread(f); a=d.pixel_array.astype(float)
        lat=getattr(d,'ImageLaterality','') or getattr(d,'Laterality',''); po='/'.join(getattr(d,'PatientOrientation',[]) or [])
        lo,hi=np.percentile(a,[1,99.8]); im=Image.fromarray(np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8))
        im.thumbnail((300,380)); c=Image.new('RGB',(300,380)); c.paste(im.convert('RGB'),(0,0))
        ImageDraw.Draw(c).text((3,3),f'{pid} {os.path.basename(f)[:10]} {lat} {po} {a.shape}',fill=(255,255,0)); ims.append(c)
    r=Image.new('RGB',(1200,380))
    for k,c in enumerate(ims[:4]): r.paste(c,(k*300,0))
    rows.append(r)
W=Image.new('RGB',(1200,380*len(rows)))
for k,r in enumerate(rows): W.paste(r,(0,k*380))
W.save(out)
