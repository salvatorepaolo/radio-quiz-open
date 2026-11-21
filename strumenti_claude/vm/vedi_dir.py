# vedi_dir.py cartella_serie idx1,idx2|all out.png [lato=600] [cols=3]: immagini grandi di una cartella DICOM (ordinate per InstanceNumber)
import sys,glob,pydicom,numpy as np
from PIL import Image,ImageDraw
d,idx,out=sys.argv[1:4]; L=int(sys.argv[4]) if len(sys.argv)>4 else 600; c=int(sys.argv[5]) if len(sys.argv)>5 else 3
fs=sorted(glob.glob(d+'/*.dcm'),key=lambda f:int(getattr(pydicom.dcmread(f,stop_before_pixels=True),'InstanceNumber',0) or 0))
ii=range(len(fs)) if idx=='all' else [int(x) for x in idx.split(',')]
ims=[]
for i in ii:
    ds=pydicom.dcmread(fs[i])
    if getattr(ds,'SamplesPerPixel',1)==3 and 'PlanarConfiguration' not in ds: ds.PlanarConfiguration=0
    a=ds.pixel_array
    if a.ndim==4: a=a[0]
    if a.ndim==3 and a.shape[-1]==3: a=a.mean(-1)
    elif a.ndim==3: a=a[a.shape[0]//2]
    a=a.astype(float); lo,hi=np.percentile(a,[0.5,99.8])
    if getattr(ds,'PhotometricInterpretation','')=='MONOCHROME1': a=hi-(a-lo)
    im=Image.fromarray(np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8)).convert('RGB'); im.thumbnail((L,L))
    t=Image.new('RGB',(L,L)); t.paste(im,(0,0)); ImageDraw.Draw(t).text((3,3),f'i{i}',fill=(255,255,0)); ims.append(t)
r=(len(ims)+c-1)//c; W=Image.new('RGB',(L*c,L*r))
for k,t in enumerate(ims): W.paste(t,((k%c)*L,(k//c)*L))
W.save(out); print(out,len(fs))
