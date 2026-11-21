# us2dcm.py: immagini US della collezione B-mode-and-CEUS-Liver (RGB, senza regioni) -> DICOM US in scala di grigi per il sito.
# I file della collezione sono gia anonimizzati da TCIA (banda alta oscurata); il testo nei pixel e solo tecnico
# (sonda, parametri, etichette, tempo dall'iniezione T1, calibri): va controllato a vista.
import os,re,json,numpy as np,pydicom
from pydicom.dataset import Dataset,FileMetaDataset
from pydicom.uid import generate_uid,ExplicitVRLittleEndian
CF=os.path.expanduser('~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free/')
US='1.2.840.10008.5.1.4.1.1.6.1'
def scrivi(src,out,caso,study,series,sn,inst,descr):
    s=pydicom.dcmread(src); a=s.pixel_array
    if int(getattr(s,'NumberOfFrames',1) or 1)>1: a=a[0]
    if a.ndim==3: a=a.astype(np.float32).mean(-1)
    a=np.clip(a,0,255).astype(np.uint8)
    fm=FileMetaDataset(); sop=generate_uid(prefix=None); fm.MediaStorageSOPClassUID=US; fm.MediaStorageSOPInstanceUID=sop
    fm.TransferSyntaxUID=ExplicitVRLittleEndian; fm.ImplementationClassUID=generate_uid(prefix=None)
    d=Dataset(); d.file_meta=fm; d.is_little_endian=True; d.is_implicit_VR=False
    d.SOPClassUID=US; d.SOPInstanceUID=sop; d.Modality='US'; d.ImageType=['ORIGINAL','PRIMARY','ABDOMINAL']
    d.PatientName=f'ANONIMO^{caso}'; d.PatientID=caso; d.PatientIdentityRemoved='YES'
    d.DeidentificationMethod='TCIA (B-mode-and-CEUS-Liver) + whitelist radio-quiz'
    d.Manufacturer=str(s.get('Manufacturer',''))[:64]; d.BodyPartExamined='LIVER'
    d.StudyDescription='Ecografia epatica con mdc (CEUS)'; d.SeriesDescription=descr[:64]
    d.StudyInstanceUID=study; d.SeriesInstanceUID=series; d.SeriesNumber=sn; d.InstanceNumber=inst
    d.FrameOfReferenceUID=study+'.1' if len(study)<60 else generate_uid(prefix=None)
    d.ImageComments='Immagine della collezione B-mode-and-CEUS-Liver (TCIA, CC BY 4.0) portata in scala di grigi; testo tecnico nei pixel invariato; nessuna calibrazione in mm (usare i calibri e la scala di profondita dell immagine)'
    d.BurnedInAnnotation='YES'
    d.SamplesPerPixel=1; d.PhotometricInterpretation='MONOCHROME2'; d.PixelRepresentation=0
    d.BitsAllocated=8; d.BitsStored=8; d.HighBit=7; d.Rows,d.Columns=a.shape
    d.WindowCenter='128'; d.WindowWidth='256'; d.PixelData=a.tobytes()
    d.save_as(out,enforce_file_format=True)
def crea(caso,serie):
    base=CF+caso; os.makedirs(base+'/serie',exist_ok=True); study=generate_uid(prefix=None); S=[]
    for n,(descr,files) in enumerate(serie,1):
        su=generate_uid(prefix=None); nome=f"{n:04d}_"+re.sub(r'[^A-Za-z0-9_-]','',descr.split(' (')[0].split(':')[0].replace(' ','_'))[:30]
        os.makedirs(f"{base}/serie/{nome}",exist_ok=True); fl=[]
        for k,src in enumerate(files):
            f=f"serie/{nome}/img_{n:05d}_{k:05d}.dcm"; scrivi(src,f"{base}/{f}",caso,study,su,n,k+1,descr); fl.append(f)
        S.append({'descrizione':descr,'numero':n,'files':fl,'data':'','eta':''})
    json.dump(S,open(base+'/serie.json','w'),ensure_ascii=False,indent=1); return S
