# misura_nod.py DIR inst_centro fx fy [raggio_mm]: diametri della lesione (>-300 solido, >-700 totale) sulle fette vicine
import sys,glob,pydicom,numpy as np
from scipy import ndimage as nd
d=sys.argv[1]; c=int(sys.argv[2]); fx,fy=float(sys.argv[3]),float(sys.argv[4]); R=float(sys.argv[5]) if len(sys.argv)>5 else 20
fs={}
for f in glob.glob(d+'/*.dcm'):
    h=pydicom.dcmread(f,stop_before_pixels=True); fs[int(h.InstanceNumber)]=f
for i in range(c-4,c+5):
    if i not in fs: continue
    x=pydicom.dcmread(fs[i]); a=x.pixel_array*float(x.RescaleSlope)+float(x.RescaleIntercept); ps=float(x.PixelSpacing[0])
    H,W=a.shape; cx,cy=int(fx*W),int(fy*H); r=int(R/ps)
    sub=a[cy-r:cy+r,cx-r:cx+r]
    out=[]
    for thr in (-300,-700):
        m=nd.binary_opening(sub>thr,iterations=1); lab,n=nd.label(m)
        # componente più vicina al centro
        if n==0: out.append('—'); continue
        dist=nd.distance_transform_edt(lab==0) if False else None
        best=None;bd=1e9
        for k in range(1,n+1):
            yy,xx=np.nonzero(lab==k); dd=np.min((yy-r)**2+(xx-r)**2)
            if dd<bd: bd=dd;best=k
        yy,xx=np.nonzero(lab==best)
        if bd>(8/ps)**2: out.append('lontano'); continue
        pts=np.c_[xx,yy]*ps; 
        from itertools import combinations
        if len(pts)>400: pts=pts[np.random.RandomState(0).choice(len(pts),400,replace=False)]
        D=np.sqrt(((pts[:,None]-pts[None])**2).sum(-1)).max()
        out.append(f'{D:.1f}mm area {len(yy)*ps*ps:.0f}mm2 media {a[cy-r:cy+r,cx-r:cx+r][lab==best].mean():.0f}HU')
    print(i,'solido(>-300):',out[0],'| totale(>-700):',out[1])
