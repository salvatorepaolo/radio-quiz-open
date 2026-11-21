# scrivi_sim.py CARTELLA_SERIE orig.npy sim.npy : sostituisce i pixel dei DICOM anonimizzati con il volume simulato
# (fette ordinate dalla testa ai piedi come vol.carica); verifica la corrispondenza con orig.npy prima di scrivere.
import sys,glob,os,numpy as np,pydicom
from pydicom.uid import ExplicitVRLittleEndian
d,orig,sim=sys.argv[1:4]
fs=sorted(glob.glob(os.path.join(d,'*.dcm')))
ds=[pydicom.dcmread(f) for f in fs]
iop=np.array(ds[0].ImageOrientationPatient,float); n=np.cross(iop[:3],iop[3:])
order=sorted(range(len(ds)),key=lambda i:-float(np.dot(n,np.array(ds[i].ImagePositionPatient,float))))
O=np.load(orig,mmap_mode='r'); S=np.load(sim,mmap_mode='r')
assert len(order)==O.shape[0]==S.shape[0], (len(order),O.shape,S.shape)
# controllo su 5 fette
for k in np.linspace(0,len(order)-1,5).astype(int):
    x=ds[order[k]]; a=x.pixel_array.astype(np.float32)*float(x.RescaleSlope)+float(x.RescaleIntercept)
    err=np.abs(a-np.asarray(O[k],np.float32)).mean(); assert err<1.0,(k,err)
cambiate=0
for k,i in enumerate(order):
    x=ds[i]; hu=np.asarray(S[k],np.float32)
    if np.array_equal(np.round(hu),np.round(np.asarray(O[k],np.float32))): continue
    st=np.round((hu-float(x.RescaleIntercept))/float(x.RescaleSlope))
    info=np.iinfo(np.int16 if x.PixelRepresentation==1 else np.uint16)
    st=np.clip(st,info.min,info.max).astype(np.int16 if x.PixelRepresentation==1 else np.uint16)
    x.decompress() if x.file_meta.TransferSyntaxUID.is_compressed else None
    x.PixelData=st.tobytes(); x.BitsAllocated=16; x.BitsStored=16; x.HighBit=15
    x.file_meta.TransferSyntaxUID=ExplicitVRLittleEndian
    it=list(x.ImageType) if 'ImageType' in x else ['ORIGINAL','PRIMARY','AXIAL']
    it[0]='DERIVED'; x.ImageType=it
    x.DerivationDescription='Lesioni simulate a scopo didattico (radio-quiz.it)'
    x.save_as(fs[i],enforce_file_format=True); cambiate+=1
print('file modificati',cambiate,'su',len(fs))
