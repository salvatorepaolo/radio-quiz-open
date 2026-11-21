# volvedi.py serie_dir out.png wc,ww ax:i1,i2 sag:col cor:row [crop=x0,y0,x1,y1 frazioni per assiali] : assiali + ricostruzioni da cartella DICOM ordinata per InstanceNumber
import sys,glob,pydicom,numpy as np
from PIL import Image,ImageDraw
sd,out,win=sys.argv[1:4]; wc,ww=map(float,win.split(',')); lo,hi=wc-ww/2,wc+ww/2
hs=sorted(glob.glob(sd+'/*.dcm'),key=lambda f:int(pydicom.dcmread(f,stop_before_pixels=True).InstanceNumber))
d0=pydicom.dcmread(hs[0]); ps=float(d0.PixelSpacing[0]); th=float(d0.SliceThickness)
V=np.stack([(lambda d:d.pixel_array*float(d.RescaleSlope)+float(d.RescaleIntercept))(pydicom.dcmread(f)) for f in hs])
tiles=[]; crop=None
for a in sys.argv[4:]:
    k,v=a.split(':')
    if k=='crop': crop=[float(x) for x in v.split(',')]; continue
    for x in [int(t) for t in v.split(',')]:
        if k=='ax':
            im=V[x]
            if crop: H,W=im.shape; im=im[int(crop[1]*H):int(crop[3]*H),int(crop[0]*W):int(crop[2]*W)]
            sz=(500,500)
        elif k=='sag': im=V[:,:,x]; sz=(500,int(500*V.shape[0]*th/(V.shape[1]*ps)))
        else: im=V[:,x,:]; sz=(500,int(500*V.shape[0]*th/(V.shape[2]*ps)))
        t=Image.fromarray(np.clip((im-lo)/(hi-lo)*255,0,255).astype(np.uint8)).resize(sz).convert('RGB')
        ImageDraw.Draw(t).text((3,3),f'{k} {x}',fill=(255,255,0)); tiles.append(t)
W=sum(t.width for t in tiles); H=max(t.height for t in tiles); C=Image.new('RGB',(W,H)); x=0
for t in tiles: C.paste(t,(x,0)); x+=t.width
C.save(out); print(out,V.shape)
