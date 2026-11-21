# media_strati.py src_dir dst_dir N [descrizione]: media di N strati contigui (ordinati lungo la normale), DICOM non compressi
import sys,os,glob,pydicom,numpy as np
from pydicom.uid import generate_uid, ExplicitVRLittleEndian
src,dst,N=sys.argv[1],sys.argv[2],int(sys.argv[3]); desc=sys.argv[4] if len(sys.argv)>4 else None
os.makedirs(dst,exist_ok=True)
hs=[(f,pydicom.dcmread(f,stop_before_pixels=True)) for f in glob.glob(src+'/*.dcm')]
iop=np.array(hs[0][1].ImageOrientationPatient,float); n=np.cross(iop[:3],iop[3:])
hs.sort(key=lambda t:-float(np.dot(n,np.array(t[1].ImagePositionPatient,float))))  # dalla testa ai piedi
pos=[float(np.dot(n,np.array(h.ImagePositionPatient,float))) for _,h in hs]
sp=abs(pos[0]-pos[-1])/(len(pos)-1)
ser=generate_uid(); k=0
for g in range(0,len(hs)-N+1,N):
    grp=hs[g:g+N]; arr=[]
    for f,_ in grp:
        d=pydicom.dcmread(f); arr.append(d.pixel_array.astype(np.float64)*float(d.RescaleSlope)+float(d.RescaleIntercept))
    hu=np.mean(arr,0); t=pydicom.dcmread(grp[N//2][0])
    ipp=np.mean([np.array(h.ImagePositionPatient,float) for _,h in grp],0)
    k+=1
    t.ImagePositionPatient=[f"{x:.4f}" for x in ipp]; t.SliceThickness=f"{sp*N:.3f}"; t.SpacingBetweenSlices=f"{sp*N:.3f}"
    t.InstanceNumber=k; t.SeriesInstanceUID=ser; t.SOPInstanceUID=generate_uid(); t.file_meta.MediaStorageSOPInstanceUID=t.SOPInstanceUID
    if desc: t.SeriesDescription=desc
    t.RescaleSlope=1; t.RescaleIntercept=-1024
    px=np.clip(np.round(hu+1024),0,65535).astype(np.uint16)
    t.BitsAllocated=16; t.BitsStored=16; t.HighBit=15; t.PixelRepresentation=0
    t.PixelData=px.tobytes(); t.file_meta.TransferSyntaxUID=ExplicitVRLittleEndian
    t.ImageType=['DERIVED','SECONDARY','AXIAL']; t.DerivationDescription=f"Media di {N} strati contigui (spessore originale {hs[0][1].SliceThickness} mm)"
    t.save_as(f"{dst}/img_{k:04d}.dcm",enforce_file_format=True)
print('strati',k,'passo originale %.3f mm, nuovo %.3f mm'%(sp,sp*N),'z testa',pos[0],'z piedi',pos[-1])
