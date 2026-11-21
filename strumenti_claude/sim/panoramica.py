# panoramica.py DIR out.png [wc,ww] : 8 assiali equidistanti + coronale e sagittale centrali
import sys,numpy as np; sys.path.insert(0,__import__('os').path.dirname(__file__)); from vol import *
d,out=sys.argv[1:3]; wc,ww=map(float,(sys.argv[3] if len(sys.argv)>3 else '50,400').split(','))
v,ds,(dz,py,px)=carica(d); n=len(v)
idx=np.linspace(0,n-1,10).astype(int)[1:-1]
imgs=[win(v[i],wc,ww) for i in idx]; lab=[f'i{i}' for i in idx]
from PIL import Image
cor=win(v[:,v.shape[1]//2+20,:],wc,ww); cor=np.array(Image.fromarray(cor).resize((v.shape[2],int(n*dz/px))))
sag=win(v[:,:,v.shape[2]//2],wc,ww); sag=np.array(Image.fromarray(sag).resize((v.shape[1],int(n*dz/py))))
imgs+= [cor,sag]; lab+=['cor','sag']
mosaico(imgs,out,cols=5,labels=lab)
d0=ds[0]; print(n,'fette',dz,'mm',py,'px',d0.get('SliceThickness'),d0.get('ConvolutionKernel'),d0.get('PatientSex'),d0.get('PatientAge'),d0.get('ContrastBolusAgent'),d0.get('SeriesDescription'))
