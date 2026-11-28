# scrivi_dicom.py: /tmp/em_sim.npy -> serie DICOM CT assiale (1,5 mm) in _tcia_grezzi/totalseg/dicom_181 (poi anonimizza.py)
import numpy as np, os, pydicom, datetime
from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid, CTImageStorage
v=np.load('/tmp/em_sim.npy'); pos=np.load('/tmp/em_pos.npy')
D='/Volumes/Caloggero/piattaforma-quiz/_tcia_grezzi/totalseg/dicom_181'; os.makedirs(D,exist_ok=True)
st,se,fr=generate_uid(),generate_uid(),generate_uid()
n=v.shape[0]
for i in range(n):
    k=n-1-i                                   # istanza 1 = vertice
    fm=FileMetaDataset(); fm.MediaStorageSOPClassUID=CTImageStorage; uid=generate_uid(); fm.MediaStorageSOPInstanceUID=uid; fm.TransferSyntaxUID=ExplicitVRLittleEndian
    ds=FileDataset(None,{},file_meta=fm,preamble=b'\0'*128)
    ds.SpecificCharacterSet='ISO_IR 100'; ds.ImageType=['DERIVED','SECONDARY','AXIAL']
    ds.SOPClassUID=CTImageStorage; ds.SOPInstanceUID=uid; ds.Modality='CT'
    ds.SeriesDescription='TC encefalo senza mdc 1.5 mm'; ds.BodyPartExamined='HEAD'
    ds.DerivationDescription='TotalSegmentator v2 s0103 (CC BY 4.0), volume ricampionato 1,5 mm; infarto ischemico simulato a scopo didattico'
    ds.PatientName='ANONIMO'; ds.PatientID='anonimo'; ds.PatientPosition='HFS'
    ds.StudyInstanceUID=st; ds.SeriesInstanceUID=se; ds.FrameOfReferenceUID=fr
    ds.SeriesNumber=2; ds.InstanceNumber=i+1
    ds.ImagePositionPatient=[f'{x:.4f}' for x in pos[k]]; ds.ImageOrientationPatient=[1,0,0,0,1,0]
    ds.SliceThickness='1.5'; ds.SliceLocation=f'{pos[k][2]:.2f}'; ds.PixelSpacing=['1.5','1.5']
    ds.SamplesPerPixel=1; ds.PhotometricInterpretation='MONOCHROME2'; ds.Rows,ds.Columns=v.shape[1],v.shape[2]
    ds.BitsAllocated=16; ds.BitsStored=16; ds.HighBit=15; ds.PixelRepresentation=1
    ds.RescaleIntercept='0'; ds.RescaleSlope='1'; ds.RescaleType='HU'; ds.WindowCenter='40'; ds.WindowWidth='80'
    a=np.clip(np.round(v[k]),-1024,3071).astype(np.int16); ds.PixelData=a.tobytes()
    ds.is_little_endian=True; ds.is_implicit_VR=False
    ds.save_as(os.path.join(D,'img_%04d.dcm'%(i+1)),write_like_original=False)
print(n,'file in',D)
