# tbad2dcm.py NN caso-tcia-XXX [k_top k_bottom]
# Converte il volume NRRD (LPS) della collezione TBAD in una serie DICOM CT assiale:
# righe = posteriore+, colonne = sinistra+ (convenzione radiologica), fette dalla testa ai piedi,
# HU conservate (uint16 = HU+1024, RescaleIntercept -1024), UID nuovi, nessun dato personale.
import nrrd,numpy as np,sys,os,json,datetime
import pydicom
from pydicom.dataset import Dataset,FileDataset,FileMetaDataset
from pydicom.uid import generate_uid,ExplicitVRLittleEndian
R=os.path.expanduser('~/mnt/Volumes--Caloggero/')
nn,caso=sys.argv[1],sys.argv[2]
v,h=nrrd.read(R+f'_tcia_grezzi/tbad/seg/cta{nn}s.nrrd')
D=np.array(h['space directions'],float); O=np.array(h['space origin'],float)
assert h['space']=='left-posterior-superior' and np.allclose(D,np.diag(np.diag(D))), 'geometria non assiale'
nx,ny,nz=v.shape; dx,dy,dz=np.diag(D)
kt=int(sys.argv[3]) if len(sys.argv)>3 else nz-1; kb=int(sys.argv[4]) if len(sys.argv)>4 else 0
x0=O[0]+min(0,dx*(nx-1)); y0=O[1]+min(0,dy*(ny-1))
out=R+f'piattaforma-quiz/casi-free/{caso}/serie/0001_AngioTC_aorta'; os.makedirs(out,exist_ok=True)
study,series,frame=generate_uid(prefix=None),generate_uid(prefix=None),generate_uid(prefix=None)
files=[]; ks=list(range(min(kt,nz-1),kb-1,-1) if dz>0 else range(kb,min(kt,nz-1)+1))
for n,k in enumerate(ks,1):
    a=v[:,:,k].T.astype(np.int32)           # [y,x]
    if dx<0: a=a[:,::-1]
    if dy<0: a=a[::-1,:]
    px=np.clip(a+1024,0,4095).astype(np.uint16)
    fm=FileMetaDataset(); fm.MediaStorageSOPClassUID='1.2.840.10008.5.1.4.1.1.2'
    sop=generate_uid(prefix=None); fm.MediaStorageSOPInstanceUID=sop; fm.TransferSyntaxUID=ExplicitVRLittleEndian
    fm.ImplementationClassUID=generate_uid(prefix=None)
    ds=FileDataset(None,{},file_meta=fm,preamble=b'\0'*128)
    ds.SpecificCharacterSet='ISO_IR 100'
    ds.ImageType=['DERIVED','SECONDARY','AXIAL']; ds.SOPClassUID=fm.MediaStorageSOPClassUID; ds.SOPInstanceUID=sop
    ds.Modality='CT'; ds.StudyDescription='Angio-TC aorta'; ds.SeriesDescription='Angio-TC aorta toraco-addominale'
    ds.DerivationDescription='Convertita da NRRD della collezione TBAD (Mayer et al., figshare 10.6084/m9.figshare.22269091, CC BY 4.0): non e un DICOM originale'
    ds.ImageComments='Immagine convertita da NRRD in DICOM (collezione TBAD, CC BY 4.0)'
    ds.PatientName=f'ANONIMO^{caso}'; ds.PatientID=caso; ds.PatientIdentityRemoved='YES'
    ds.DeidentificationMethod='Collezione pubblica TBAD, nessun dato personale'
    ds.ContrastBolusAgent='C+'; ds.PatientPosition='HFS'
    ds.SliceThickness=f'{abs(dz):.2f}'; ds.SpacingBetweenSlices=f'{abs(dz):.2f}'
    ds.StudyInstanceUID=study; ds.SeriesInstanceUID=series; ds.FrameOfReferenceUID=frame
    ds.SeriesNumber=1; ds.InstanceNumber=n
    z=O[2]+dz*k
    ds.ImagePositionPatient=[f'{x0:.3f}',f'{y0:.3f}',f'{z:.3f}']; ds.ImageOrientationPatient=[1,0,0,0,1,0]; ds.SliceLocation=f'{z:.3f}'
    ds.SamplesPerPixel=1; ds.PhotometricInterpretation='MONOCHROME2'; ds.Rows,ds.Columns=px.shape
    ds.PixelSpacing=[f'{abs(dy):.6f}',f'{abs(dx):.6f}']
    ds.BitsAllocated=16; ds.BitsStored=16; ds.HighBit=15; ds.PixelRepresentation=0
    ds.RescaleIntercept=-1024; ds.RescaleSlope=1; ds.RescaleType='HU'
    ds.WindowCenter=[100,40]; ds.WindowWidth=[700,400]; ds.WindowCenterWidthExplanation=['ANGIO','TESSUTI MOLLI']
    ds.PixelData=px.tobytes()
    fn=f'img_{n:05d}.dcm'; ds.save_as(os.path.join(out,fn),enforce_file_format=True); files.append('serie/0001_AngioTC_aorta/'+fn)
s=[{"descrizione":f"Angio-TC aorta toraco-addominale ({abs(dz):g} mm, convertita da NRRD)","numero":1,"files":files}]
json.dump(s,open(R+f'piattaforma-quiz/casi-free/{caso}/serie.json','w'),ensure_ascii=False,indent=1)
print(caso,'fette',len(files),'k',ks[0],'->',ks[-1],'px',abs(dx),abs(dy),'dz',dz,'z',O[2]+dz*ks[0],'->',O[2]+dz*ks[-1])
