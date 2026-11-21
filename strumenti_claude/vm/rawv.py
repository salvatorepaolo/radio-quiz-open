# rawv.py DIR inst1,inst2,... wc,ww out.png [x0,y0,x1,y1] : mostra immagini per InstanceNumber da una cartella DICOM grezza
import sys,glob,pydicom,numpy as np
from PIL import Image,ImageDraw
d,ins,win,out=sys.argv[1:5]; cr=sys.argv[5] if len(sys.argv)>5 else None
wc,ww=map(float,win.split(','))
fs={}
for f in glob.glob(d+'/*.dcm'):
    h=pydicom.dcmread(f,stop_before_pixels=True); fs[int(h.InstanceNumber)]=f
ims=[]
for i in map(int,ins.split(',')):
    x=pydicom.dcmread(fs[i]); a=x.pixel_array*float(x.RescaleSlope)+float(x.RescaleIntercept)
    if cr:
        x0,y0,x1,y1=map(float,cr.split(',')); H,W=a.shape; a=a[int(y0*H):int(y1*H),int(x0*W):int(x1*W)]
    im=Image.fromarray(np.clip((a-wc+ww/2)/ww*255,0,255).astype(np.uint8)).resize((420,420)).convert('RGB')
    ImageDraw.Draw(im).text((4,4),f'inst {i} z {float(x.ImagePositionPatient[2]):.0f}',fill=(255,255,0)); ims.append(im)
c=min(4,len(ims)); W_=Image.new('RGB',(420*c,420*((len(ims)+c-1)//c)))
for k,im in enumerate(ims): W_.paste(im,((k%c)*420,(k//c)*420))
W_.save(out)
print(len(fs),'immagini', min(fs),max(fs))
