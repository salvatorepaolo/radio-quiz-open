# dissezione.py: simula una dissezione aortica (flap intimale, lume vero/falso, rientro) sul volume /tmp/k014.npy
# usa la traccia /tmp/k014_ao.json (aorta_traccia.py). output /tmp/k014_sim.npy, parametri in /tmp/k014_dis.json
import numpy as np,json
from scipy import ndimage as ndi
rng=np.random.default_rng(14)
v=np.load('/tmp/k014.npy',mmap_mode='r'); out=np.array(v,dtype=np.float32)
A={d['z']:d for d in json.load(open('/tmp/k014_ao.json'))}
Z0,Z1=0,180            # estensione (indici di fetta, 1 mm)
REN=(150,156)           # rientro (lacerazione distale del flap)
zs=np.arange(Z0,Z1+1)
cy=ndi.gaussian_filter1d(ndi.median_filter(np.array([A[z]['cy'] for z in zs]),9),3)
cx=ndi.gaussian_filter1d(ndi.median_filter(np.array([A[z]['cx'] for z in zs]),9),3)
rr=ndi.gaussian_filter1d(ndi.median_filter(np.array([A[z]['r'] for z in zs]),21),4)
# orientamento della normale verso il lume vero (gradi, coordinate immagine: -90 = anteriore, 0 = sinistra del paziente)
def ang(z):
    return np.interp(z,[0,85,135,180],[-55,-120,-122,-165])
def frac(z):   # spostamento del flap dal centro verso il lume falso (in frazioni di r): h>0 -> lume vero piccolo
    return np.interp(z,[0,160,168,180],[0.20,0.22,-0.45,-1.15])
YY,XX=np.mgrid[-34:35,-34:35].astype(np.float32)
lowf_all=ndi.gaussian_filter(rng.normal(size=(Z1+1,69,69)).astype(np.float32),(4,3,3)); lowf_all/=lowf_all.std()
info=[]
for i,z in enumerate(zs):
    c=(cy[i],cx[i]); r=rr[i]; iy,ix=int(round(c[0])),int(round(c[1]))
    sl=(z,slice(iy-34,iy+35),slice(ix-34,ix+35))
    a=np.array(v[sl],np.float32)
    dy=YY-(c[0]-iy); dx=XX-(c[1]-ix); dist=np.hypot(dy,dx)
    lum=(ndi.median_filter(a,3)>140)&(dist<r+2.0)
    lab,n=ndi.label(lum)
    if n>1:
        k=lab[34,34] if lab[34,34] else np.argmax(ndi.sum(lum,lab,range(1,n+1)))+1
        lum=lab==k
    lum=ndi.binary_fill_holes(lum)
    lw=np.clip(ndi.gaussian_filter(lum.astype(np.float32),0.6)*1.3,0,1)
    t=np.radians(ang(z)); n_=np.array([np.sin(t),np.cos(t)])   # (y,x)
    u=dy*n_[0]+dx*n_[1]; w=-dy*n_[1]+dx*n_[0]
    h=frac(z)*r
    # flap curvo, convesso verso il lume vero
    curve=h+0.13*r*np.clip(1-(w/max(r,1))**2,0,1)+0.06*r*np.sin(np.pi*1.4*w/max(r,1)+0.045*z)
    sd=u-curve                                  # >0 lume vero, <0 lume falso
    m_l=a[lum].mean() if lum.sum()>10 else 250
    res=a-ndi.gaussian_filter(a,1.0)
    kf=np.interp(z,[0,180],[0.80,0.72])
    fl=(sd<0).astype(np.float32)
    fl=ndi.gaussian_filter(fl,0.5)
    fl_val=a-(1-kf)*m_l+9*lowf_all[z]
    o=a*(1-fl*lw)+fl_val*fl*lw
    # flap
    thick=0.9   # mezza larghezza in pixel (~1,5 mm totali con 0,85 mm/pixel)
    wflap=np.exp(-0.5*(np.abs(sd)/thick)**2)
    if REN[0]<=z<=REN[1]:
        gap=np.exp(-0.5*((w-0.15*r)/(0.22*r))**2)*np.sin(np.pi*(z-REN[0]+1)/(REN[1]-REN[0]+2))
        wflap=wflap*(1-gap)
    endfade=np.interp(z,[0,170,180],[1,1,0.0])
    wflap=wflap*lw*endfade
    flap_val=95+0.6*res+4*lowf_all[z]
    o=o*(1-wflap)+flap_val*wflap
    out[sl]=o
    if z%10==0: info.append(dict(z=int(z),r_mm=round(float(r)*0.8496,1),ang=round(float(ang(z))),tl_frac=round(float(((sd>0)&lum).sum()/max(lum.sum(),1)),2),lum_HU=round(float(m_l)),fl_HU=round(float(m_l*kf))))
np.save('/tmp/k014_sim.npy',out)
json.dump(info,open('/tmp/k014_dis.json','w'),indent=0)
for d in info: print(d)
