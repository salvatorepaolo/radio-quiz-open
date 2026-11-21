# calc.py PID LATO : trova i gruppi di microcalcificazioni (top-hat) e salva ritagli a piena risoluzione dei 2 gruppi più densi per proiezione
import sys,glob,os,pydicom,numpy as np
from scipy import ndimage as ndi
from PIL import Image,ImageDraw
B=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/cmmd/'); O=os.path.expanduser('~/mnt/Volumes--Caloggero/_viste/val/')
pid,lat=sys.argv[1:3]
for f in sorted(glob.glob(B+pid+'/*/*.dcm')):
    d=pydicom.dcmread(f)
    if d.ImageLaterality!=lat: continue
    a=d.pixel_array.astype(float); po='/'.join(d.PatientOrientation)
    th=a-ndi.grey_opening(ndi.gaussian_filter(a,0.8),size=(15,15))
    breast=ndi.binary_erosion(a>15,iterations=60)
    sp=(th>np.percentile(th[breast],99.7))&breast&(th>18)
    lab,n=ndi.label(sp); sz=ndi.sum(sp,lab,range(1,n+1))
    keep=np.isin(lab,np.where((sz>=2)&(sz<=200))[0]+1)
    dens=ndi.uniform_filter(keep.astype(float),150)
    res=[]
    for k in range(2):
        y,x=np.unravel_index(np.argmax(dens),dens.shape); v=dens[y,x]*150*150
        res.append((y,x,v)); dens[max(0,y-250):y+250,max(0,x-250):x+250]=0
    for k,(y,x,v) in enumerate(res):
        y0,x0=max(0,y-200),max(0,x-200); c=a[y0:y0+400,x0:x0+400]
        lo,hi=np.percentile(a[breast],[5,99.95]); im=Image.fromarray(np.clip((c-lo)/(hi-lo)*255,0,255).astype(np.uint8)).resize((600,600)).convert('RGB')
        ImageDraw.Draw(im).text((3,3),f'{pid} {lat} {po} centro y{y} x{x} punti~{v:.0f}',fill=(255,255,0))
        nm=f'{O}cc_{pid}_{po.replace("/","")}_{k}.png'; im.save(nm); print(nm.split('/')[-1],y,x,round(v))
