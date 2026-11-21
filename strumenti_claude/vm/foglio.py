# foglio.py cartella_radice out_prefisso : un foglio di anteprime per ogni serie (max 12 immagini) con etichette
import sys,os,glob,pydicom,numpy as np
from PIL import Image,ImageDraw
R,O=sys.argv[1],sys.argv[2]
k=0; tiles=[]
def tile(path,lab):
    try:
        d=pydicom.dcmread(path); a=d.pixel_array
    except Exception as e: return None
    if a.ndim==4: a=a[0]
    if a.ndim==3 and a.shape[-1]==3: a=a.mean(-1)
    elif a.ndim==3: a=a[a.shape[0]//2]
    a=a.astype(float); lo,hi=np.percentile(a,[1,99.5])
    if getattr(d,'PhotometricInterpretation','')=='MONOCHROME1': a=hi-(a-lo)
    im=Image.fromarray(np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8)).convert('RGB'); im.thumbnail((300,300))
    t=Image.new('RGB',(300,300)); t.paste(im,(0,0)); ImageDraw.Draw(t).text((3,3),lab[:48],fill=(255,255,0)); return t
for s in sorted(glob.glob(R+'/*/*/')):
    fs=sorted(glob.glob(s+'*.dcm'))
    if not fs: continue
    pick=fs if len(fs)<=6 else [fs[i] for i in np.linspace(0,len(fs)-1,6).astype(int)]
    lab=s.rstrip('/').split('/')[-2]+'/'+s.rstrip('/').split('/')[-1]
    for i,f in enumerate(pick):
        t=tile(f,f"{lab[:30]}#{fs.index(f)}/{len(fs)}")
        if t: tiles.append(t)
c=6
for n in range(0,len(tiles),36):
    ch=tiles[n:n+36]; W=Image.new('RGB',(300*c,300*((len(ch)+c-1)//c)))
    for j,t in enumerate(ch): W.paste(t,((j%c)*300,(j//c)*300))
    W.save(f"{O}_{n//36}.png"); print(f"{O}_{n//36}.png")
