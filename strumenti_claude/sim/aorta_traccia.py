# aorta_traccia.py vol.npy z_seed cy cx out.json : segue il lume aortico (>150 HU) fetta per fetta;
# componente col centro del cerchio inscritto più vicino al precedente; sotto la biforcazione segue l'iliaca con x maggiore
import numpy as np,sys,json
from scipy import ndimage as ndi
v=np.load(sys.argv[1],mmap_mode='r'); z0=int(sys.argv[2]); c0=(float(sys.argv[3]),float(sys.argv[4])); out=sys.argv[5]
Z=v.shape[0]; R=30
def trova(z,c,rprev):
    cy,cx=int(round(c[0])),int(round(c[1])); y0,x0=cy-R,cx-R
    a=np.asarray(v[z,y0:cy+R,x0:cx+R],np.float32); m=ndi.median_filter(a,3)>150
    m=ndi.binary_fill_holes(m)
    l,n=ndi.label(m); cand=[]
    for i in range(1,n+1):
        cc=l==i; s=cc.sum()
        if s<15: continue
        dt=ndi.distance_transform_edt(cc)
        # cerchio inscritto vicino al centro precedente
        yy,xx=np.mgrid[0:cc.shape[0],0:cc.shape[1]]
        near=dt*(np.hypot(yy-R,xx-R)<8)
        if near.max()<2: continue
        py,px=np.unravel_index(near.argmax(),near.shape)
        cand.append((np.hypot(py-R,px-R),py+y0,px+x0,near.max(),s))
    if not cand: return None
    cand.sort(key=lambda t:(t[0]-0.5*t[3]))
    d,py,px,r,s=cand[0]
    return dict(z=z,cy=float(py),cx=float(px),r=float(r),area=int(s))
res={}
for direction in (-1,1):
    c=c0; rp=9.0; z=z0
    while 0<=z<Z:
        f=trova(z,c,rp)
        if f is None or f['r']<2.5: break
        res[z]=f; c=(0.5*c[0]+0.5*f['cy'],0.5*c[1]+0.5*f['cx']) if False else (f['cy'],f['cx']); rp=f['r']; z+=direction
json.dump([res[k] for k in sorted(res)],open(out,'w'))
ks=sorted(res); print('da',ks[0],'a',ks[-1])
for k in ks[::8]: print(k,round(res[k]['cy']),round(res[k]['cx']),round(res[k]['r'],1),res[k]['area'])
