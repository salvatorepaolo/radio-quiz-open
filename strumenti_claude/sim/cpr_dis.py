import numpy as np,sys,json
sys.path.insert(0,'.'); from vol import *
from scipy import ndimage as ndi
from PIL import Image
sim=sys.argv[1]; tag=sys.argv[2]
v=np.load(sim,mmap_mode='r'); o=np.load('/tmp/k014.npy',mmap_mode='r')
A={d['z']:d for d in json.load(open('/tmp/k014_ao.json'))}
zs=np.arange(0,200)
cy=ndi.gaussian_filter1d(ndi.median_filter(np.array([A[z]['cy'] for z in zs]),9),3)
cx=ndi.gaussian_filter1d(ndi.median_filter(np.array([A[z]['cx'] for z in zs]),9),3)
ims=[]
for src in (o,v):
    cor=np.stack([np.asarray(src[z,int(round(cy[i])),int(cx[i])-40:int(cx[i])+40]) for i,z in enumerate(zs)])
    sag=np.stack([np.asarray(src[z,int(cy[i])-40:int(cy[i])+40,int(round(cx[i]))]) for i,z in enumerate(zs)])
    for a in (cor,sag):
        im=win(a,150,500); im=np.array(Image.fromarray(im).resize((80*3,int(200*1.0/0.85)*3//2)))
        ims.append(im)
mosaico(ims,f'../../_viste/val/cpr_{tag}.png',size=240,cols=4,labels=['orig cor','orig sag','sim cor','sim sag'])
