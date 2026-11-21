# angio2dcm.py: converte le sequenze PNG di CADICA in serie DICOM XA (un fotogramma per file) per i casi del sito
import os,glob,json,numpy as np
import pydicom
from pydicom.dataset import Dataset,FileMetaDataset
from pydicom.uid import generate_uid,ExplicitVRLittleEndian
from PIL import Image
CF=os.path.expanduser('~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free/')
R=os.path.expanduser('~/mnt/Volumes--Caloggero/_tcia_grezzi/angio/cad/CADICA/selectedVideos/')
XA='1.2.840.10008.5.1.4.1.1.12.1'
COLL='CADICA'
def scrivi(a,out,caso,study,series,fr,sn,inst,descr,eta,sesso,sdescr,orig):
    fm=FileMetaDataset(); sop=generate_uid(); fm.MediaStorageSOPClassUID=XA; fm.MediaStorageSOPInstanceUID=sop
    fm.TransferSyntaxUID=ExplicitVRLittleEndian; fm.ImplementationClassUID=generate_uid()
    d=Dataset(); d.file_meta=fm
    d.SpecificCharacterSet='ISO_IR 192'; d.SOPClassUID=XA; d.SOPInstanceUID=sop; d.ImageType=['DERIVED','SECONDARY']; d.Modality='XA'
    d.StudyDescription=sdescr; d.SeriesDescription=descr
    d.PatientName=f'ANONIMO^{caso}'; d.PatientID=caso; d.PatientIdentityRemoved='YES'
    d.DeidentificationMethod='CADICA anonimizzata alla fonte'
    if eta: d.PatientAge=f'{int(eta):03d}Y'
    if sesso: d.PatientSex=sesso
    d.BodyPartExamined='HEART'
    d.StudyInstanceUID=study; d.SeriesInstanceUID=series; d.FrameOfReferenceUID=fr
    d.SeriesNumber=sn; d.InstanceNumber=inst
    d.DerivationDescription=f'Convertita da {orig} della collezione CADICA: non e un DICOM originale'
    d.ImageComments=d.DerivationDescription; d.BurnedInAnnotation='NO'
    d.SamplesPerPixel=1; d.PhotometricInterpretation='MONOCHROME2'; d.PixelRepresentation=0
    d.BitsAllocated=8; d.BitsStored=8; d.HighBit=7
    d.Rows,d.Columns=a.shape; d.WindowCenter='128'; d.WindowWidth='256'
    d.RescaleIntercept='0'; d.RescaleSlope='1'; d.FrameTime='100'; d.RecommendedDisplayFrameRate=10
    d.PixelData=a.astype(np.uint8).tobytes()
    d.save_as(out,enforce_file_format=True)
def crea(caso,paz,video,eta,sesso,sdescr):
    base=CF+caso; os.makedirs(base+'/serie',exist_ok=True); study=generate_uid(); S=[]
    for n,(v,descr) in enumerate(video,1):
        fr=sorted(glob.glob(f'{R}{paz}/{v}/input/*.png'),key=lambda x:int(x.split('_')[-1][:-4]))
        su=generate_uid(); fo=generate_uid(); nome=f's{n}_{n:04d}_'+descr.split(' – ')[0].replace(' ','_')
        os.makedirs(f'{base}/serie/{nome}',exist_ok=True); files=[]
        for k,p in enumerate(fr):
            a=np.array(Image.open(p).convert('L')); f=f'serie/{nome}/img_{n:05d}_{k:05d}.dcm'
            scrivi(a,f'{base}/{f}',caso,study,su,fo,n,k+1,descr,eta,sesso,sdescr,'PNG'); files.append(f)
        S.append({'descrizione':descr,'numero':n,'files':files,'data':'','eta':int(eta),'cine_ms':100})
    json.dump(S,open(base+'/serie.json','w'),ensure_ascii=False,indent=1)
    return S
