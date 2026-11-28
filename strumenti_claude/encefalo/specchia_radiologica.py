"""Serie assiali salvate in convenzione neurologica (prima colonna = sinistra del paziente, riga verso destra): si
specchiano le colonne e si correggono orientamento e posizione, così la destra del paziente sta a sinistra
nell'immagine (convenzione radiologica). La geometria nel paziente non cambia. Uso: specchia_radiologica.py <caso>"""
import sys, json, numpy as np, pydicom
B = '/Volumes/Caloggero/piattaforma-quiz/casi-free/' + sys.argv[1] + '/'
for s in json.load(open(B + 'serie.json')):
    d0 = pydicom.dcmread(B + s['files'][0], stop_before_pixels=True); r = np.array(d0.ImageOrientationPatient[:3], float)
    if not (r[0] < -0.7):                       # solo assiali/coronali con la riga verso la destra del paziente
        print('lasciata', s['descrizione'], r.round(2)); continue
    for f in s['files']:
        d = pydicom.dcmread(B + f); a = d.pixel_array[:, ::-1].copy(); W = a.shape[1]
        sp = float(d.PixelSpacing[1]); io = [float(x) for x in d.ImageOrientationPatient]; ipp = np.array(d.ImagePositionPatient, float)
        d.ImagePositionPatient = [f'{x:.5f}' for x in ipp + (W - 1) * sp * np.array(io[:3])]
        d.ImageOrientationPatient = [f'{-x:.6f}' for x in io[:3]] + [f'{x:.6f}' for x in io[3:]]
        d.PixelData = a.astype(d.pixel_array.dtype).tobytes(); d.save_as(B + f)
    print('specchiata', s['descrizione'], len(s['files']))
