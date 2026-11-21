# quattro.py out.png PID... : 4 proiezioni per paziente, ordine RCC LCC RMLO LMLO, 330 px di larghezza
import sys,glob,os,pydicom,numpy as np
from PIL import Image,ImageDraw
B=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/cmmd/')
out=sys.argv[1]; rows=[]
for pid in sys.argv[2:]:
    D={}
    for f in glob.glob(B+pid+'/*/*.dcm'):
        d=pydicom.dcmread(f); D[d.ImageLaterality+('MLO' if 'F' in ''.join(d.PatientOrientation) else 'CC')]=d.pixel_array.astype(float)
    r=Image.new('RGB',(1320,396))
    for k,v in enumerate(['RCC','LCC','RMLO','LMLO']):
        if v not in D: continue
        a=D[v]; lo,hi=np.percentile(a,[1,99.9]); im=Image.fromarray(np.clip((a-lo)/(hi-lo)*255,0,255).astype(np.uint8)).resize((330,396)).convert('RGB')
        ImageDraw.Draw(im).text((3,3),pid+' '+v,fill=(255,255,0)); r.paste(im,(k*330,0))
    rows.append(r)
W=Image.new('RGB',(1320,396*len(rows)))
for k,r in enumerate(rows): W.paste(r,(0,k*396))
W.save(out)
