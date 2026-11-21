import numpy as np,sys,json
sys.path.insert(0,'.'); from vol import *
from PIL import Image
v=np.load('/tmp/k014_sim.npy',mmap_mode='r'); o=np.load('/tmp/k014.npy',mmap_mode='r')
A={d['z']:d for d in json.load(open('/tmp/k014_ao.json'))}
zs=[int(x) for x in sys.argv[1].split(',')]; tag=sys.argv[2]
imgs=[];lab=[]
for z in zs:
    cy,cx=int(A[z]['cy']),int(A[z]['cx'])
    for src,nm in ((o,'orig'),(v,'sim')):
        a=np.asarray(src[z,cy-45:cy+45,cx-45:cx+45]); imgs.append(win(a,150,600)); lab.append(f'{nm} {z}')
mosaico(imgs,f'../../_viste/val/dis_{tag}.png',size=220,cols=8,labels=lab)
