# rit.py out.png PID ORIENT x0,y0,x1,y1(frazioni) [lo,hi percentili] : ritaglio a piena risoluzione di una proiezione (ORIENT = PatientOrientation senza '/', es. AFR)
import sys,glob,os,pydicom,numpy as np
from PIL import Image,ImageDraw
B=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/cmmd/')
out,pid,ori,cr=sys.argv[1:5]
for f in glob.glob(B+pid+'/*/*.dcm'):
    d=pydicom.dcmread(f)
    if ''.join(d.PatientOrientation)!=ori: continue
    a=d.pixel_array.astype(float); H,W=a.shape; x0,y0,x1,y1=map(float,cr.split(','))
    X0,Y0=int(x0*W),int(y0*H); c=a[Y0:int(y1*H),X0:int(x1*W)]
    lo,hi=np.percentile(c,[1,99.8]); im=Image.fromarray(np.clip((c-lo)/(hi-lo)*255,0,255).astype(np.uint8)).convert('RGB')
    s=900/max(im.size); im=im.resize((int(im.width*s),int(im.height*s)))
    g=ImageDraw.Draw(im); step=10/0.0940909*s  # griglia 1 cm
    for k in range(1,int(im.width/step)+1): g.line([(k*step,0),(k*step,8)],fill=(0,255,0))
    for k in range(1,int(im.height/step)+1): g.line([(0,k*step),(8,k*step)],fill=(0,255,0))
    g.text((12,4),f'{pid} {ori} crop x{X0} y{Y0} tacche=1cm',fill=(255,255,0)); im.save(out); print(out.split('/')[-1],a.shape)
