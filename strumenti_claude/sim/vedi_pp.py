import numpy as np,sys
sys.path.insert(0,'.'); from vol import *
from PIL import Image
v=np.load('/tmp/k123_sim.npy',mmap_mode='r'); o=np.load('/tmp/k123.npy',mmap_mode='r')
zs=[int(x) for x in sys.argv[1].split(',')]; tag=sys.argv[2]; cr=sys.argv[3] if len(sys.argv)>3 else '60,60,330,460'
y0,x0,y1,x1=map(int,cr.split(','))
imgs=[];lab=[]
for z in zs:
    for s,n in ((o,'o'),(v,'s')):
        imgs.append(win(np.asarray(s[z,y0:y1,x0:x1]),40,450)); lab.append(f'{n}{z}')
mosaico(imgs,f'../../_viste/val/pp_{tag}.png',size=330,cols=4,labels=lab)
