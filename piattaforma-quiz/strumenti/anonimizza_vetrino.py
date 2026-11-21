"""anonimizza_vetrino.py: vetrino digitale DICOM (VL Whole Slide Microscopy) di un archivio pubblico → cartella
serie/vetrino/ di un caso, con le stesse regole di privacy degli altri file dei casi.
- Si tengono solo i livelli di ingrandimento (VOLUME) e la miniatura (THUMBNAIL); l'etichetta (LABEL) e la panoramica
  (OVERVIEW), che possono mostrare scritte e codici a barre, si scartano.
- Dall'intestazione (anche dentro le sequenze) si tolgono i tag privati, i nomi di persona (PN), le date e le ore
  (DA, DT, TM) e i campi identificativi; PatientName = ANONIMO, PatientID = id del caso.
- I pixel (tessere compresse) restano identici: niente ricompressione.
- Aggiunge (o sostituisce) in serie.json la voce {tipo: 'vetrino'} in fondo all'elenco, così gli indici delle altre
  serie non cambiano. Uso: python anonimizza_vetrino.py <cartella del vetrino> <cartella del caso> "<descrizione>"
"""
import json, os, sys
import pydicom
from pydicom.dataset import Dataset

TOGLI = ['PatientBirthDate', 'PatientSex', 'PatientAge', 'OtherPatientIDs', 'OtherPatientIDsSequence', 'IssuerOfPatientID', 'PatientAddress',
         'InstitutionName', 'InstitutionAddress', 'InstitutionalDepartmentName', 'StationName', 'DeviceSerialNumber', 'AccessionNumber',
         'StudyID', 'RequestingService', 'ReferringPhysicianName', 'OperatorsName', 'PerformingPhysicianName', 'PhysiciansOfRecord',
         'IssuerOfTheContainerIdentifierSequence', 'ClinicalTrialSubjectID', 'ClinicalTrialSiteName', 'ClinicalTrialSponsorName']

def pulisci(ds: Dataset):
    for el in list(ds):
        if el.tag.is_private or el.VR in ('PN', 'DA', 'DT', 'TM') or el.keyword in TOGLI:
            del ds[el.tag]; continue
        if el.VR == 'SQ':
            for it in el.value: pulisci(it)

def aggiungi_bot(path, n):
    """Se i pixel compressi hanno la tabella di base vuota, la riempie (un frammento per fotogramma), riscrivendo il file a
    blocchi senza caricarlo in memoria: così il visualizzatore sul sito trova ogni tessera con poche richieste parziali invece
    di scorrere tutto il file. I byte delle tessere restano identici."""
    import struct
    with open(path, 'rb') as f:
        testa = f.read(1 << 20); i = testa.rfind(b'\xe0\x7f\x10\x00')
        while i >= 0 and testa[i + 8:i + 12] != b'\xff\xff\xff\xff': i = testa.rfind(b'\xe0\x7f\x10\x00', 0, i)
        if i < 0: return False
        q = i + 12; tag, lun = struct.unpack('<II', testa[q:q + 8])
        if tag != 0xE000FFFE or lun != 0: return False   # tabella già presente
        f.seek(q + 8); fr = []; pos = 0
        while True:
            h = f.read(8)
            if len(h) < 8: break
            tag, lun = struct.unpack('<II', h)
            if tag != 0xE000FFFE: break
            fr.append(pos); pos += 8 + lun; f.seek(lun, 1)
        if len(fr) != n or pos >= 1 << 32: print(f'  {os.path.basename(path)}: tabella non aggiunta ({len(fr)} frammenti per {n} fotogrammi)'); return False
        tmp = path + '.tmp'
        with open(tmp, 'wb') as o:
            o.write(testa[:q]); o.write(struct.pack('<II', 0xE000FFFE, 4 * n)); o.write(struct.pack(f'<{n}I', *fr))
            f.seek(q + 8)
            while (b := f.read(1 << 24)): o.write(b)
    os.replace(tmp, path); return True

def main(sorg, caso_dir, descrizione):
    caso = os.path.basename(os.path.normpath(caso_dir)); dest = os.path.join(caso_dir, 'serie', 'vetrino'); os.makedirs(dest, exist_ok=True)
    tenuti = []
    for f in sorted(os.listdir(sorg)):
        if not f.endswith('.dcm'): continue
        p = os.path.join(sorg, f); h = pydicom.dcmread(p, stop_before_pixels=True)
        tipo = (list(h.get('ImageType') or []) + ['', '', ''])[2].upper()
        if str(h.SOPClassUID) != '1.2.840.10008.5.1.4.1.1.77.1.6' or tipo not in ('VOLUME', 'THUMBNAIL'):
            print(f'  scartato {f}: {tipo or h.SOPClassUID}'); continue
        tenuti.append((int(h.get('TotalPixelMatrixColumns') or h.Columns), tipo, p))
    tenuti.sort(reverse=True)
    files, dim = [], []
    for k, (w, tipo, p) in enumerate(tenuti):
        d = pydicom.dcmread(p)
        pulisci(d); pulisci(d.file_meta)
        d.PatientName = 'ANONIMO'; d.PatientID = caso
        nome = f'livello_{k}.dcm' if tipo == 'VOLUME' else 'miniatura.dcm'
        out = os.path.join(dest, nome); d.save_as(out, enforce_file_format=True)
        if d.file_meta.TransferSyntaxUID.is_compressed and aggiungi_bot(out, int(d.get('NumberOfFrames') or 1)): print(f'  {nome}: aggiunta la tabella dei fotogrammi')
        files.append(f'serie/vetrino/{nome}'); dim.append(os.path.getsize(out))
        print(f'  {nome}: {tipo}, {w} pixel di larghezza, {dim[-1] / 1e6:.1f} MB')
    sj = os.path.join(caso_dir, 'serie.json'); serie = json.load(open(sj))
    serie = [s for s in serie if s.get('tipo') != 'vetrino'] + [{'descrizione': descrizione, 'tipo': 'vetrino', 'files': files, 'dimensioni': dim}]
    json.dump(serie, open(sj, 'w'), ensure_ascii=False, indent=1)
    print(f'{caso}: vetrino con {len(files)} file in serie/vetrino, voce aggiunta in serie.json')

if __name__ == '__main__':
    if sys.argv[1] == '--solo-tabella':   # file già anonimizzati: aggiunge solo la tabella dei fotogrammi
        for p in sys.argv[2:]: print(p, aggiungi_bot(p, int(pydicom.dcmread(p, stop_before_pixels=True).get('NumberOfFrames') or 1)))
    else: main(*sys.argv[1:4])
