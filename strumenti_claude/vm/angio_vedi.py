# angio_vedi.py p v1,v2,.. out.png : per ogni video il fotogramma piu opacizzato (o i keyframe) con i riquadri delle lesioni
import sys,os,glob,json,numpy as np
from PIL import Image,ImageDraw
R=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/angio/cad/CADICA/selectedVideos/')
pj=json.load(open(R+'CADICAprojections.json')); proj={x:k for k,l in pj.items() for x in l}
p,vs,out=sys.argv[1],sys.argv[2].split(','),sys.argv[3]
ims=[]
for v in vs:
    fr=sorted(glob.glob(f'{R}{p}/{v}/input/*.png'))
    gt=sorted(glob.glob(f'{R}{p}/{v}/groundtruth/*.txt'))
    if gt: f=R+f'{p}/{v}/input/'+os.path.basename(gt[len(gt)//2]).replace('.txt','.png'); boxes=[l.split() for l in open(gt[len(gt)//2]) if l.strip()]
    else:
        m=[np.array(Image.open(x)).mean() for x in fr]; f=fr[int(np.argmin(m))]; boxes=[]
    im=Image.open(f).convert('RGB'); d=ImageDraw.Draw(im)
    for b in boxes:
        x,y,w,h=map(int,b[:4]); d.rectangle([x,y,x+w,y+h],outline=(255,0,0)); d.text((x,y-11),b[4],fill=(255,0,0))
    d.text((4,4),f'{p} {v} {proj.get(p+"_"+v,"?")} {os.path.basename(f)} ({len(fr)} fot.)',fill=(255,255,0))
    ims.append(im)
c=min(4,len(ims)); r=(len(ims)+c-1)//c; W=Image.new('RGB',(512*c,512*r))
for k,im in enumerate(ims): W.paste(im,((k%c)*512,(k//c)*512))
W.save(out)
