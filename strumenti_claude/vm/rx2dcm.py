# rx2dcm.py: converte PNG/JPG in DICOM DX (For Presentation) per i casi del sito
# uso da python: crea_caso(caso, studi=[{descr, files:[(path, vista, lat, spacing, maschere)]}], eta, sesso, parte, studio_descr, collezione)
import os,json,numpy as np,datetime
import pydicom
from pydicom.dataset import Dataset,FileMetaDataset
from pydicom.uid import generate_uid,ExplicitVRLittleEndian
from PIL import Image
CF=os.path.expanduser('~/mnt/Volumes--Caloggero/piattaforma-quiz/casi-free/')
DX='1.2.840.10008.5.1.4.1.1.1.1'
def leggi(p,maschere=()):
    im=Image.open(p)
    a=np.array(im)
    if a.ndim==3: a=np.array(im.convert('L'))
    a=a.copy()
    for (x0,y0,x1,y1) in maschere: a[y0:y1,x0:x1]=a.min()
    return a
def dcm(a,out,caso,study_uid,series_uid,serie_n,inst,descr,vista,lat,spacing,eta,sesso,parte,sdescr,coll,orig):
    fm=FileMetaDataset(); fm.MediaStorageSOPClassUID=DX; sop=generate_uid(prefix=None)
    fm.MediaStorageSOPInstanceUID=sop; fm.TransferSyntaxUID=ExplicitVRLittleEndian; fm.ImplementationClassUID=generate_uid(prefix=None)
    d=Dataset(); d.file_meta=fm; d.is_little_endian=True; d.is_implicit_VR=False
    d.SOPClassUID=DX; d.SOPInstanceUID=sop; d.ImageType=['DERIVED','SECONDARY']; d.Modality='DX'; d.PresentationIntentType='FOR PRESENTATION'
    d.StudyDescription=sdescr; d.SeriesDescription=descr
    d.PatientName=f'ANONIMO^{caso}'; d.PatientID=caso; d.PatientIdentityRemoved='YES'
    d.DeidentificationMethod=f'{coll} anonimizzata alla fonte'[:64]
    if eta is not None: d.PatientAge=f'{int(eta):03d}Y'
    if sesso: d.PatientSex=sesso
    d.BodyPartExamined=parte
    if vista: d.ViewPosition=vista
    d.ImageLaterality=lat or ''
    d.StudyInstanceUID=study_uid; d.SeriesInstanceUID=series_uid; d.SeriesNumber=serie_n; d.InstanceNumber=inst
    d.DerivationDescription=f'Convertita da {orig} della collezione {coll}: non e un DICOM originale'
    d.ImageComments=d.DerivationDescription
    d.BurnedInAnnotation='NO'
    a=np.asarray(a)
    if a.dtype==np.uint8:
        bits=8; d.BitsAllocated=8; d.BitsStored=8; d.HighBit=7
    else:
        a=a.astype(np.uint16); bits=16; d.BitsAllocated=16; d.BitsStored=16; d.HighBit=15
    d.SamplesPerPixel=1; d.PhotometricInterpretation='MONOCHROME2'; d.PixelRepresentation=0
    d.Rows,d.Columns=a.shape
    if spacing: d.ImagerPixelSpacing=[spacing,spacing]; d.PixelSpacing=[spacing,spacing]
    lo,hi=np.percentile(a,[0.5,99.8]); d.WindowCenter=f'{(lo+hi)/2:.1f}'; d.WindowWidth=f'{max(hi-lo,1):.1f}'
    d.RescaleIntercept='0'; d.RescaleSlope='1'; d.RescaleType='US'
    d.PixelData=a.tobytes()
    d.save_as(out,enforce_file_format=True)
def crea_caso(caso,studi,eta,sesso,parte,sdescr,coll,orig):
    base=CF+caso; os.makedirs(base+'/serie',exist_ok=True)
    study=generate_uid(prefix=None); S=[]; n=0
    for st in studi:
        n+=1; su=generate_uid(prefix=None); nome=f"s{n}_{n:04d}_"+st['descr'].replace(' ','_').replace('/','-')
        os.makedirs(f"{base}/serie/{nome}",exist_ok=True); files=[]
        for k,(p,vista,lat,sp,masch) in enumerate(st['files']):
            a=leggi(p,masch); f=f"serie/{nome}/img_{n:05d}_{k:05d}.dcm"
            dcm(a,f"{base}/{f}",caso,study,su,n,k+1,st['descr'],vista,lat,sp,eta,sesso,parte,sdescr,coll,orig); files.append(f)
        S.append({'descrizione':st['descr'],'numero':n,'files':files,'data':'','eta':int(eta) if eta is not None else ''})
    json.dump(S,open(base+'/serie.json','w'),ensure_ascii=False,indent=1)
    return S
