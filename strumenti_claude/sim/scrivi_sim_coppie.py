# scrivi_sim_coppie.py CARTELLA_SERIE orig.npy sim.npy : scrive la media di coppie di strati simulati nei file pari
# (ordine testa->piedi), aggiorna posizione e spessore; stampa l'elenco dei file dispari da togliere.
import sys,glob,os,numpy as np,pydicom
from pydicom.uid import ExplicitVRLittleEndian
d,orig,sim=sys.argv[1:4]
fs=sorted(glob.glob(os.path.join(d,'*.dcm'))); ds=[pydicom.dcmread(f) for f in fs]
iop=np.array(ds[0].ImageOrientationPatient,float); n=np.cross(iop[:3],iop[3:])
order=sorted(range(len(ds)),key=lambda i:-float(np.dot(n,np.array(ds[i].ImagePositionPatient,float))))
O=np.load(orig,mmap_mode='r'); S=np.load(sim,mmap_mode='r'); assert len(order)==O.shape[0]==S.shape[0]
for k in np.linspace(0,len(order)-1,5).astype(int):
    x=ds[order[k]]; a=x.pixel_array.astype(np.float32)*float(x.RescaleSlope)+float(x.RescaleIntercept)
    assert np.abs(a-np.asarray(O[k],np.float32)).mean()<1.0
via=[]
for j in range(0,len(order)-1,2):
    i0,i1=order[j],order[j+1]; x=ds[i0]
    hu=(np.asarray(S[j],np.float32)+np.asarray(S[j+1],np.float32))/2
    st=np.round((hu-float(x.RescaleIntercept))/float(x.RescaleSlope))
    dt=np.int16 if x.PixelRepresentation==1 else np.uint16; info=np.iinfo(dt)
    if x.file_meta.TransferSyntaxUID.is_compressed: x.decompress()
    x.PixelData=np.clip(st,info.min,info.max).astype(dt).tobytes(); x.BitsAllocated=16; x.BitsStored=16; x.HighBit=15
    x.file_meta.TransferSyntaxUID=ExplicitVRLittleEndian
    p=(np.array(ds[i0].ImagePositionPatient,float)+np.array(ds[i1].ImagePositionPatient,float))/2
    x.ImagePositionPatient=[round(float(q),4) for q in p]; x.SliceThickness=1.0; x.SpacingBetweenSlices=1.0 if 'SpacingBetweenSlices' in x else None
    if x.get('SpacingBetweenSlices') is None and 'SpacingBetweenSlices' in x: del x.SpacingBetweenSlices
    if 'SliceLocation' in x: x.SliceLocation=round(float(p[2]),4)
    it=list(x.ImageType) if 'ImageType' in x else ['ORIGINAL','PRIMARY','AXIAL']; it[0]='DERIVED'; x.ImageType=it
    x.DerivationDescription='Media di 2 strati da 0,5 mm; lesioni simulate a scopo didattico (radio-quiz.it)'
    x.save_as(fs[i0],enforce_file_format=True); via.append(os.path.basename(fs[i1]))
if len(order)%2: via.append(os.path.basename(fs[order[-1]]))
open('/tmp/via101.txt','w').write('\n'.join(via)); print('scritti',len(order)//2,'da togliere',len(via))
