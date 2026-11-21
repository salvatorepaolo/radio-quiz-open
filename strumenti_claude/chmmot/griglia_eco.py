# griglia_eco.py serie z out.png : primo eco della fetta z, ingrandito 3x con griglia ogni 10 px (coordinate in pixel)
import sys,glob,pydicom,numpy as np
from PIL import Image,ImageDraw
s,z,out=sys.argv[1],float(sys.argv[2]),sys.argv[3]
ds=[pydicom.dcmread(f) for f in glob.glob(s+'/*.dcm')]
L=sorted([d for d in ds if abs(float(d.SliceLocation)-z)<0.2],key=lambda d:float(d.EchoTime))
a=L[0].pixel_array.astype(float); lo,hi=np.percentile(a,[1,99.5]); H,W=a.shape; k=3
im=Image.fromarray(np.clip((a-lo)/(hi-lo)*255,0,255).astype(np.uint8)).resize((W*k,H*k)).convert('RGB'); dr=ImageDraw.Draw(im)
for x in range(0,W,10):
    dr.line([(x*k,0),(x*k,H*k)],fill=(0,90,0) if x%50 else (0,200,0)); 
    if x%50==0: dr.text((x*k+2,2),str(x),fill=(255,255,0))
for y in range(0,H,10):
    dr.line([(0,y*k),(W*k,y*k)],fill=(0,90,0) if y%50 else (0,200,0))
    if y%50==0: dr.text((2,y*k+2),str(y),fill=(255,255,0))
im.save(out)
