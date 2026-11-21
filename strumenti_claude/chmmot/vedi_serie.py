# vedi_serie.py out.png serie1 [serie2 ...]: per ogni serie una riga per fetta (SliceLocation), immagini ordinate per TE (max 12)
import sys,glob,pydicom,numpy as np
from PIL import Image,ImageDraw
out=sys.argv[1]; rows=[]
for s in sys.argv[2:]:
    ds=[pydicom.dcmread(f) for f in glob.glob(s+'/*.dcm')]
    g={}
    for d in ds: g.setdefault(round(float(d.get('SliceLocation',0)),1),[]).append(d)
    for loc in sorted(g):
        L=sorted(g[loc],key=lambda d:(float(d.get('EchoTime',0)),float(d.get('TriggerTime',0) or 0),int(d.InstanceNumber)))
        if len(L)>12: L=[L[i] for i in np.linspace(0,len(L)-1,12).astype(int)]
        a0=L[0].pixel_array.astype(float); lo,hi=np.percentile(a0,[1,99.5])
        r=[]
        for d in L:
            a=d.pixel_array.astype(float)
            im=Image.fromarray(np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8)).convert('RGB').resize((200,200))
            ImageDraw.Draw(im).text((3,3),f"{s.split('/')[-1]} z{loc} TE{float(d.get('EchoTime',0)):.1f}",fill=(255,255,0)); r.append(im)
        rows.append(r)
W=Image.new('RGB',(200*max(len(r) for r in rows),200*len(rows)))
for i,r in enumerate(rows):
    for j,im in enumerate(r): W.paste(im,(j*200,i*200))
W.save(out); print(out,len(rows))
