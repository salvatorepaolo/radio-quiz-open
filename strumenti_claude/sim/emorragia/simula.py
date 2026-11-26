# simula.py: ematoma intraparenchimale del putamen destro (~6 ml) con edema perilesionale su TC encefalo normale (TotalSegmentator s0103)
# input /tmp/em_v.npy (k dai piedi alla testa, riga, colonna; colonna 0 = destra del paziente), output /tmp/em_sim.npy e /tmp/em_mask.npy
import numpy as np, json
from scipy import ndimage as ndi
rng=np.random.default_rng(177)
v=np.load('/tmp/em_v.npy'); br=np.load('/tmp/em_brain.npy'); out=v.copy()
K,R,C=np.mgrid[0:v.shape[0],0:v.shape[1],0:v.shape[2]].astype(np.float32)
c=(56.0,86.0,71.0); ax=(7.0,10.0,6.0)          # voxel 1,5 mm: semiassi ~10,5 x 15 x 9 mm (alto-basso, AP, LL)
t=np.deg2rad(12)                                  # lieve obliquità nel piano assiale
dr,dc=R-c[1],C-c[2]; rr=dr*np.cos(t)+dc*np.sin(t); cc=-dr*np.sin(t)+dc*np.cos(t)
d=np.sqrt(((K-c[0])/ax[0])**2+(rr/ax[1])**2+(cc/ax[2])**2)
pert=ndi.gaussian_filter(rng.normal(size=v.shape).astype(np.float32),2.0); pert/=pert.std()
d=d+0.12*pert                                     # margine irregolare
brs=ndi.binary_erosion(br,iterations=2)
H=(d<1.0)&brs
E=(d<1.55)&~H&brs&(v>12)&(v<45)                   # alone di edema solo nel parenchima (non nel liquor)
smooth=ndi.gaussian_filter(v,(0.6,0.8,0.8)); res=v-smooth   # rumore originale da conservare
lowf=ndi.gaussian_filter(rng.normal(size=v.shape).astype(np.float32),(1.5,2.5,2.5)); lowf/=lowf.std()
wH=np.clip(ndi.gaussian_filter(H.astype(np.float32),0.6)*1.3,0,1)
liv=63+4*lowf+np.clip(1-d,0,1)*4                  # 60-70 HU, poco più denso al centro
out=out*(1-wH)+(liv+res)*wH
wE=ndi.gaussian_filter(E.astype(np.float32),0.8)*(1-wH)
out=out-7*wE                                      # edema: ~7 HU meno del parenchima
np.save('/tmp/em_sim.npy',out.astype(np.float32)); np.save('/tmp/em_mask.npy',H)
vol=H.sum()*1.5**3/1000; ks=np.where(H.any((1,2)))[0]
print(json.dumps({'ml':round(float(vol),1),'k':[int(ks[0]),int(ks[-1])],'HU_medi':round(float(out[H].mean()),1),'edema_vox':int(E.sum())}))
