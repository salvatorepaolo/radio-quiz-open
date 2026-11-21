# vol.py: utilità comuni per i simulati (VM). carica(dir) -> (vol HU float32 z dall'alto, lista dataset ordinati, spacing (dz,dy,dx))
import glob,os,numpy as np,pydicom
from PIL import Image,ImageDraw
def carica(d,soloheader=False):
    fs=[f for f in glob.glob(os.path.join(d,'**','*.dcm'),recursive=True)]
    ds=[pydicom.dcmread(f) for f in fs]
    ds=[x for x in ds if getattr(x,'Modality','')=='CT' and hasattr(x,'ImagePositionPatient')]
    iop=np.array(ds[0].ImageOrientationPatient,float); n=np.cross(iop[:3],iop[3:])
    ds.sort(key=lambda x:-float(np.dot(n,np.array(x.ImagePositionPatient,float))))  # dalla testa ai piedi
    for x,f in zip(ds,[x.filename for x in ds]): pass
    if soloheader: return ds
    v=np.stack([x.pixel_array.astype(np.float32)*float(getattr(x,'RescaleSlope',1))+float(getattr(x,'RescaleIntercept',0)) for x in ds])
    z=[float(np.dot(n,np.array(x.ImagePositionPatient,float))) for x in ds]
    dz=abs(np.median(np.diff(z))); py,px=map(float,ds[0].PixelSpacing)
    return v,ds,(dz,py,px)
def win(a,wc,ww): return np.clip((a-(wc-ww/2))/ww*255,0,255).astype(np.uint8)
def mosaico(imgs,out,size=360,cols=4,labels=None):
    ims=[]
    for k,a in enumerate(imgs):
        im=Image.fromarray(a).resize((size,int(size*a.shape[0]/a.shape[1]))).convert('RGB')
        if labels: ImageDraw.Draw(im).text((4,4),labels[k],fill=(255,255,0))
        ims.append(im)
    h=max(i.size[1] for i in ims); r=(len(ims)+cols-1)//cols
    W=Image.new('RGB',(size*cols,h*r))
    for k,im in enumerate(ims): W.paste(im,((k%cols)*size,(k//cols)*h))
    W.save(out)
