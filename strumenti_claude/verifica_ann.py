# verifica_ann.py: legge con highdicom (libreria open source di riferimento per i DICOM di anatomia patologica) un file di
# annotazioni di vetrino esportato dal visualizzatore e ne stampa gruppi, forme e misure. Uso: python verifica_ann.py <file.dcm>
import sys, highdicom as hd, pydicom, numpy as np
ds = pydicom.dcmread(sys.argv[1])
ann = hd.ann.MicroscopyBulkSimpleAnnotations.from_dataset(ds)
print('highdicom', hd.__version__, '·', ann.Modality, ann.AnnotationCoordinateType)
for g in ann.get_annotation_groups():
    gr = g.get_graphic_data(coordinate_type=ann.AnnotationCoordinateType)
    print(f'{g.label}: {g.graphic_type.value}, {len(gr)} forme, punti per forma {[np.asarray(x).shape[0] for x in gr]}')
    nomi, valori, unita = g.get_measurements()
    for k, n in enumerate(nomi): print(f'   {n.meaning} ({unita[k].value}): {np.round(np.asarray(valori)[:, k], 5).tolist()}')
mancano = [k for k in ['PatientID', 'StudyInstanceUID', 'SeriesInstanceUID', 'SOPInstanceUID', 'ContentLabel', 'PixelOriginInterpretation', 'ReferencedImageSequence', 'FrameOfReferenceUID', 'Manufacturer', 'ContentDate'] if k not in ds]
print('elementi principali presenti' if not mancano else f'MANCANO: {mancano}')
