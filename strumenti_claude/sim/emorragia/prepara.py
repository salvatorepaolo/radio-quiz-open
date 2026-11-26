# prepara.py: TotalSegmentator s0103 (RAS, 1,5 mm) -> volume orientato come DICOM LPS: v[k,riga,colonna], k dai piedi alla testa
import nibabel as nib, numpy as np
B='/Volumes/Caloggero/piattaforma-quiz/_tcia_grezzi/totalseg/s0103_'
im=nib.as_closest_canonical(nib.load(B+'ct.nii.gz')); a=im.get_fdata().astype(np.float32)
br=nib.as_closest_canonical(nib.load(B+'brain.nii.gz')).get_fdata()>0.5
def lps(x): return np.ascontiguousarray(np.transpose(x[::-1,::-1,:],(2,1,0)))
v=lps(a); m=lps(br)
A=im.affine; nI,nJ,nK=a.shape
# posizione (LPS) del pixel riga0 colonna0 di ogni fetta k: i=nI-1, j=nJ-1
pos=[]
for k in range(nK):
    r=A@[nI-1,nJ-1,k,1]; pos.append([-r[0],-r[1],r[2]])
np.save('/tmp/em_v.npy',v); np.save('/tmp/em_brain.npy',m); np.save('/tmp/em_pos.npy',np.array(pos))
print(v.shape,np.abs(np.diag(A))[:3],pos[0],pos[-1],m.sum())
