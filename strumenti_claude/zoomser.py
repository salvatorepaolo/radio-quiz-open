# zoomser.py PAZ prefisso out.png i0,i1,step x0,y0,x1,y1 : fette (dalla testa ai piedi) ritagliate
import sys,glob,os,pydicom,numpy as np
from PIL import Image,ImageDraw
G='/Volumes/Caloggero/_tcia_grezzi/'
p,s,out,rg,cr=sys.argv[1:6]; a0,a1,st=map(int,rg.split(',')); x0,y0,x1,y1=map(float,cr.split(','))
ds=[pydicom.dcmread(f) for f in glob.glob(G+p+'/'+s+'*/*.dcm')]
n=np.cross(np.array(ds[0].ImageOrientationPatient[:3],float),np.array(ds[0].ImageOrientationPatient[3:],float))
ds.sort(key=lambda d:-float(np.dot(n,np.array(d.ImagePositionPatient,float))))
v=np.stack([d.pixel_array.astype(float) for d in ds]); lo,hi=np.percentile(v,[1,99.7]); H,W=v.shape[1:]
ims=[]
for i in range(a0,min(a1,len(ds)),st):
    a=v[i][int(y0*H):int(y1*H),int(x0*W):int(x1*W)]
    im=Image.fromarray(np.clip((a-lo)/(hi-lo)*255,0,255).astype(np.uint8)).resize((240,240)).convert('RGB'); ImageDraw.Draw(im).text((3,3),f'i{i}',fill=(255,255,0)); ims.append(im)
c=8; Wd=Image.new('RGB',(240*c,240*((len(ims)+c-1)//c)))
for k,im in enumerate(ims): Wd.paste(im,((k%c)*240,(k//c)*240))
Wd.save(out); print(len(ds))
