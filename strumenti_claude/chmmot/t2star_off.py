# t2star_off.py serie z x0,y0,x1,y1 : T2* con modello S = A·exp(-TE/T2*) + C (offset del rumore) sulla media della ROI
import sys,glob,pydicom,numpy as np
from scipy.optimize import curve_fit
s,z=sys.argv[1],float(sys.argv[2]); x0,y0,x1,y1=map(int,sys.argv[3].split(','))
ds=[pydicom.dcmread(f) for f in glob.glob(s+'/*.dcm')]
L=sorted([d for d in ds if abs(float(d.SliceLocation)-z)<0.2],key=lambda d:float(d.EchoTime))
te=np.array([float(d.EchoTime) for d in L]); roi=np.stack([d.pixel_array[y0:y1,x0:x1].astype(float).mean() for d in L])
f=lambda t,A,T,C: A*np.exp(-t/T)+C
p,_=curve_fit(f,te,roi,p0=[roi[0]*1.5,5,roi[-1]*0.8],bounds=([0,0.3,0],[1e5,200,roi.max()]))
print(f"T2*={p[1]:.1f} ms  R2*={1000/p[1]:.0f} s-1  A={p[0]:.0f} C={p[2]:.0f}  echi={len(te)}")
