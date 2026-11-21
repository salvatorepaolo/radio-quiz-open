# mrov.py PAZ out.png [frazione] : una immagine per serie
import sys,glob,os,pydicom,numpy as np
from PIL import Image,ImageDraw
G='/Volumes/Caloggero/_tcia_grezzi/'
p,out=sys.argv[1],sys.argv[2]; fz=float(sys.argv[3]) if len(sys.argv)>3 else 0.5
ims=[]
for d in sorted(glob.glob(G+p+'/MR_*')+glob.glob(G+p+'/CT_*')):
    fs=glob.glob(d+'/*.dcm')
    if not fs: continue
    hs=[pydicom.dcmread(f,stop_before_pixels=True) for f in fs]; h0=hs[0]
    try: n=np.cross(np.array(h0.ImageOrientationPatient[:3],float),np.array(h0.ImageOrientationPatient[3:],float))
    except Exception: continue
    pos=sorted(set(round(float(np.dot(n,np.array(h.ImagePositionPatient,float))),1) for h in hs))
    tgt=pos[int(fz*(len(pos)-1))]
    sel=[f for f,h in zip(fs,hs) if round(float(np.dot(n,np.array(h.ImagePositionPatient,float))),1)==tgt][0]
    a=pydicom.dcmread(sel).pixel_array.astype(float)
    if a.ndim==3: a=a[0]
    lo,hi=np.percentile(a,[1,99.5]); a=np.clip((a-lo)/(hi-lo+1e-6)*255,0,255).astype(np.uint8)
    im=Image.fromarray(a).resize((256,256)).convert('RGB'); dr=ImageDraw.Draw(im)
    pl='AX' if abs(n[2])>0.8 else ('COR' if abs(n[1])>0.8 else 'SAG')
    dr.text((3,3),os.path.basename(d)[3:40],fill=(255,255,0)); dr.text((3,15),f"{pl} n{len(fs)} {h0.get('SliceThickness','')}mm TE{h0.get('EchoTime','')}",fill=(255,255,0))
    ims.append(im)
c=6; W=Image.new('RGB',(256*c,256*((len(ims)+c-1)//c)))
for k,im in enumerate(ims): W.paste(im,((k%c)*256,(k//c)*256))
W.save(out); print(len(ims))
