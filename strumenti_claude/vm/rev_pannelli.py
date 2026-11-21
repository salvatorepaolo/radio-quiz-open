# rev_pannelli.py NNN [n_per_serie]  → /Volumes/Caloggero/_viste/rev/NNN/: s<k>.png (strati distribuiti, finestra automatica
# e, per la TC, anche tessuti molli e polmone) e vista.png (immagine della vista del caso con il segno). Per i dettagli: vk.py
import sys,json,os,pydicom,numpy as np
from PIL import Image,ImageDraw
H=os.path.expanduser('~/mnt/Volumes--Caloggero'); CF=H+'/piattaforma-quiz/casi-free/'
c=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 12
cid=f'caso-tcia-{c}'; OUT=f'{H}/_viste/rev/{c}'; os.makedirs(OUT,exist_ok=True)
S=json.load(open(CF+cid+'/serie.json')); caso=json.load(open(CF+cid+'/caso.json'))
def px(f):
    d=pydicom.dcmread(f); a=d.pixel_array.astype(float)
    if a.ndim==4: a=a[0]
    if a.ndim==3: a=a.mean(-1) if a.shape[-1]==3 else a[0]
    return a*float(getattr(d,'RescaleSlope',1))+float(getattr(d,'RescaleIntercept',0)), d
def img(a,lo,hi,lab,sz=300):
    im=Image.fromarray(np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8)).resize((sz,sz)).convert('RGB')
    ImageDraw.Draw(im).text((4,4),lab,fill=(255,255,0)); return im
def griglia(ims,out,cols=6):
    r=(len(ims)+cols-1)//cols; W=Image.new('RGB',(300*cols,300*r))
    for k,im in enumerate(ims): W.paste(im,((k%cols)*300,(k//cols)*300))
    W.save(out)
righe=[]
for k,s in enumerate(S):
    f=s['files']; N=len(f); idx=sorted(set(int(round(x)) for x in np.linspace(0,N-1,min(n,N))))
    a0,d0=px(CF+cid+'/'+f[idx[len(idx)//2]]); mod=getattr(d0,'Modality','')
    finestre=[('auto',None)]+([('molli',(40,400)),('polmone',(-600,1500))] if mod=='CT' else [])
    for nome,w in finestre:
        ims=[]
        for i in idx:
            a,_=px(CF+cid+'/'+f[i]); lo,hi=(np.percentile(a,[1,99.5]) if w is None else (w[0]-w[1]/2,w[0]+w[1]/2))
            ims.append(img(a,lo,hi,f's{k} i{i}/{N} {nome}'))
        griglia(ims,f'{OUT}/s{k}_{nome}.png')
    righe.append(f"s{k}: {s.get('descrizione','')} · {N} immagini · {mod}")
v=caso.get('vista') or {}
if 'serie' in v and v['serie']<len(S):
    s=S[v['serie']]; i=min(v.get('idx',0),len(s['files'])-1); a,_=px(CF+cid+'/'+s['files'][i])
    lo,hi=(v['wc']-v['ww']/2,v['wc']+v['ww']/2) if v.get('ww') else np.percentile(a,[1,99.5])
    im=Image.fromarray(np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8)).convert('RGB'); dr=ImageDraw.Draw(im)
    sg=v.get('segno') or {}
    if 'a' in sg and 'b' in sg: dr.rectangle([sg['a']['x'],sg['a']['y'],sg['b']['x'],sg['b']['y']],outline=(255,0,0),width=2)
    im.thumbnail((900,900)); im.save(f'{OUT}/vista.png'); righe.append(f"vista: serie {v['serie']} img {i} · nota: {v.get('nota','')}")
open(f'{OUT}/indice.txt','w').write('\n'.join(righe)+'\n'); print('\n'.join(righe)); print('file in',OUT)
