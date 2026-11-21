#!/usr/bin/env python3
# uso: ~/.radioquiz-ia/venv/bin/python strumenti/converti_enhanced.py <cartella originale> <cartella temporanea>
# poi: anonimizza.py <cartella temporanea> caso-NNN, e cancellare la cartella temporanea (contiene ancora i dati del paziente)
"""Converte immagini Enhanced MR (multi-frame) in MR Image Storage classiche, un file per fotogramma.
Solo uso locale e temporaneo prima dell'anonimizzazione."""
import os, sys, copy, pydicom
from pydicom.dataset import Dataset
from pydicom.uid import generate_uid, ExplicitVRLittleEndian
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
def g(seq_owner, name):
    s = seq_owner.get(name); return s[0] if s else None
n = 0
for r, _, fs in os.walk(src):
    for f in fs:
        p = os.path.join(r, f)
        try: d = pydicom.dcmread(p)
        except Exception: continue
        if str(d.SOPClassUID) != '1.2.840.10008.5.1.4.1.1.4.1': continue
        arr = d.pixel_array
        nf = int(d.get('NumberOfFrames', 1)); arr = arr.reshape((nf,) + arr.shape[-2:]) if nf > 1 or arr.ndim == 2 else arr
        sh = g(d, 'SharedFunctionalGroupsSequence'); pf = d.get('PerFrameFunctionalGroupsSequence', [])
        serie_uid = d.SeriesInstanceUID
        for k in range(nf):
            fg = pf[k] if k < len(pf) else Dataset()
            def cerca(nome):
                for grp in (fg, sh):
                    if grp is not None and nome in grp: return grp[nome].value[0]
                return None
            o = Dataset()
            for el in d:
                if el.tag.group in (0x5200,) or el.keyword in ('PixelData', 'NumberOfFrames', 'SharedFunctionalGroupsSequence', 'PerFrameFunctionalGroupsSequence'): continue
                o.add(copy.deepcopy(el))
            o.SOPClassUID = '1.2.840.10008.5.1.4.1.1.4'; o.SOPInstanceUID = generate_uid()
            o.SeriesInstanceUID = serie_uid; o.InstanceNumber = k + 1
            pm = cerca('PixelMeasuresSequence')
            if pm is not None:
                o.PixelSpacing = pm.PixelSpacing
                if 'SliceThickness' in pm: o.SliceThickness = pm.SliceThickness
                if 'SpacingBetweenSlices' in pm: o.SpacingBetweenSlices = pm.SpacingBetweenSlices
            pp = cerca('PlanePositionSequence');   po = cerca('PlaneOrientationSequence')
            if pp is not None: o.ImagePositionPatient = pp.ImagePositionPatient
            if po is not None: o.ImageOrientationPatient = po.ImageOrientationPatient
            vt = cerca('PixelValueTransformationSequence')
            if vt is not None: o.RescaleIntercept = vt.RescaleIntercept; o.RescaleSlope = vt.RescaleSlope
            voi = cerca('FrameVOILUTSequence')
            if voi is not None:
                o.WindowCenter = voi.WindowCenter; o.WindowWidth = voi.WindowWidth
            o.ImageType = ['DERIVED', 'PRIMARY'] if 'ImageType' not in d else list(d.ImageType)[:4]
            px = arr[k]; o.Rows, o.Columns = px.shape
            o.SamplesPerPixel = 1; o.PhotometricInterpretation = 'MONOCHROME2'
            o.BitsAllocated = 16; o.BitsStored = int(d.get('BitsStored', 16)); o.HighBit = o.BitsStored - 1
            o.PixelRepresentation = int(d.get('PixelRepresentation', 0))
            o.PixelData = px.astype('int16' if o.PixelRepresentation else 'uint16').tobytes()
            o.file_meta = pydicom.dataset.FileMetaDataset(); o.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
            o.file_meta.MediaStorageSOPClassUID = o.SOPClassUID; o.file_meta.MediaStorageSOPInstanceUID = o.SOPInstanceUID
            sd = os.path.join(dst, str(d.get('SeriesNumber', 0))); os.makedirs(sd, exist_ok=True)
            o.save_as(os.path.join(sd, f'{k + 1:04d}.dcm'), enforce_file_format=True); n += 1
print('fotogrammi scritti', n)
