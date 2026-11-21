import json, numpy as np, SimpleITK as sitk, math, sys
sys.path.insert(0,'.')
import analizza_tc as A
from scipy import ndimage as ndi
img=sitk.ReadImage('out/034/ct.nii.gz'); hu=sitk.GetArrayFromImage(img); sp=img.GetSpacing()[::-1]
lobi=[A.carica_maschera(f'out/034/seg/{n}.nii.gz',img) for n in A.LOBI]
pol=np.any(lobi,0); pd=ndi.binary_dilation(pol,iterations=3)
mn=A.carica_maschera('out/034/noduli_ts/lung_nodules.nii.gz',img)&pd
for c,d,s,m,sl in A.componenti(mn,sp):
    spa=np.array(sp,float)
    for delta in (60,100,150):
        n2,sl2=A.espandi_vetro(hu,sp,m,sl,pd,delta_hu=delta)
        v=n2.sum()*spa.prod(); print(c,round(d,1),'delta',delta,'->',round(2*(3*v/(4*math.pi))**(1/3),1), n2 is m)
