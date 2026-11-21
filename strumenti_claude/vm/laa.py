# laa.py DIR : percentuale di voxel polmonari < -950 HU (grezzo: polmone = -1000..-400 dentro il corpo, componenti non a contatto col bordo)
import sys,glob,pydicom,numpy as np
from scipy import ndimage as nd
fs=sorted(glob.glob(sys.argv[1]+'/*.dcm'))
v=[];
for f in fs:
    x=pydicom.dcmread(f); a=x.pixel_array*float(x.RescaleSlope)+float(x.RescaleIntercept); v.append(a)
v=np.stack(v)
tot=0;laa=0;up=[0,0];lo=[0,0];n=len(v)
for k,a in enumerate(v):
    m=(a<-400)&(a>-1100); lab,nn=nd.label(m)
    edge=set(np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]))
    keep=np.isin(lab,[i for i in range(1,nn+1) if i not in edge]) 
    keep=nd.binary_erosion(keep,iterations=2)
    t=keep.sum(); l=(keep&(a<-950)).sum(); tot+=t; laa+=l
print(f'LAA-950 {100*laa/max(tot,1):.1f}% su {tot} pixel')
