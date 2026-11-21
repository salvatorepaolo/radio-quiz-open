# pannelli.py out.png crop caso:serie:idx[:wc,ww] ... (crop = x0,y0,x1,y1 | full)
import sys,json,pydicom,numpy as np
from PIL import Image,ImageDraw
CF='/Volumes/Caloggero/piattaforma-quiz/casi-free/'
out,crop=sys.argv[1:3]; ims=[]
for t in sys.argv[3:]:
    p=t.split(':'); c,si,i=p[0],int(p[1]),int(p[2])
    S=json.load(open(f'{CF}caso-tcia-{c}/serie.json')); s=S[si]
    d=pydicom.dcmread(f"{CF}caso-tcia-{c}/{s['files'][i]}"); a=d.pixel_array.astype(float)
    if a.ndim==3: a=a[0]
    a=a*float(getattr(d,'RescaleSlope',1))+float(getattr(d,'RescaleIntercept',0))
    if len(p)>3: wc,ww=map(float,p[3].split(',')); lo,hi=wc-ww/2,wc+ww/2
    else: lo,hi=np.percentile(a,[1,99.5])
    if crop!='full':
        x0,y0,x1,y1=map(float,crop.split(',')); H,W=a.shape; a=a[int(y0*H):int(y1*H),int(x0*W):int(x1*W)]
    im=Image.fromarray(np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8)).resize((360,360)).convert('RGB')
    ImageDraw.Draw(im).text((4,4),f"s{si+1} i{i} {s['descrizione'][:28]}",fill=(255,255,0)); ims.append(im)
c=min(6,len(ims)); r=(len(ims)+c-1)//c; W=Image.new('RGB',(360*c,360*r))
for k,im in enumerate(ims): W.paste(im,((k%c)*360,(k//c)*360))
W.save(out)
