#!/usr/bin/env python3
"""Controllo automatico dei casi prima della pubblicazione (lo lancia pubblica.command).
Errori (bloccano la pubblicazione): dati del paziente o della struttura nei DICOM, file mancanti, JSON rotti.
Avvisi: testi segnaposto, metodica non coerente con le serie, distretti diversi nello stesso caso, immagini doppie.
uso: python3 controlla.py [cartella casi]   (codice di uscita 2 se ci sono errori)"""
import json, os, re, sys, glob, hashlib, collections
base = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'casi')
try:
    import pydicom
except ImportError:
    pydicom = None
MOD = {'CR': 'RX', 'DX': 'RX', 'CT': 'TC', 'MR': 'RM', 'US': 'Ecografia', 'MG': 'Mammografia', 'PT': 'PET', 'NM': 'PET', 'SM': 'Vetrini', 'XA': 'Angiografia'}
PHI = ['PatientBirthDate', 'InstitutionName', 'InstitutionAddress', 'ReferringPhysicianName', 'OperatorsName', 'PerformingPhysicianName',
       'AccessionNumber', 'StudyDate', 'StudyTime', 'PatientAddress', 'OtherPatientIDs', 'PatientWeight', 'StationName', 'PatientTelephoneNumbers']
errori, avvisi = collections.defaultdict(list), collections.defaultdict(list)
for cdir in sorted(glob.glob(os.path.join(base, 'caso-*'))):
    c = os.path.basename(cdir)
    if not os.path.exists(f'{cdir}/serie.json'):
        continue
    try:
        s = json.load(open(f'{cdir}/serie.json')); j = json.load(open(f'{cdir}/caso.json'))
    except Exception as e:
        errori[c].append(f'JSON non leggibile: {e}'); continue
    for x in s:
        for f in x['files']:
            if not os.path.exists(f'{cdir}/{f}'):
                errori[c].append(f'file mancante {f}'); break
    op = j.get('opzioni', [])
    if any('da compilare' in o.get('testo', '').lower() for o in op) or 'DA COMPILARE' in j.get('anamnesi', ''):
        (errori if j.get('visibile') else avvisi)[c].append('testi segnaposto «da compilare»' + (' in un caso VISIBILE' if j.get('visibile') else ''))
    if len(op) < 2 or not any(o.get('corretta') for o in op):
        (errori if j.get('visibile') else avvisi)[c].append('servono almeno 2 opzioni e una corretta')
    distr = lambda r: r.split(' ', 1)[-1]   # «TC torace» e «RX torace» sono lo stesso distretto
    if len({distr(x['regione']) for x in s if x.get('regione')}) > 1:
        avvisi[c].append('distretti diversi nello stesso caso: ' + ', '.join(sorted({x['regione'] for x in s if x.get('regione')})))
    if pydicom is None:
        continue
    mods = collections.Counter(); hashes = collections.defaultdict(list)
    for x in s:
        campione = x['files'] if len(x['files']) <= 6 else [x['files'][0], x['files'][len(x['files']) // 2], x['files'][-1]]
        for f in campione:
            try:
                d = pydicom.dcmread(f'{cdir}/{f}', stop_before_pixels=x.get('tipo') == 'vetrino')   # vetrini: GB di tessere, basta l'intestazione
            except Exception:
                continue
            mods[MOD.get(str(d.get('Modality', '')), str(d.get('Modality', '')))] += 1
            if not str(d.get('PatientName', '')).startswith('ANONIMO'):
                errori[c].append(f'nome paziente non anonimo in {f}')
            for t in PHI:
                v = d.get(t)
                if v not in (None, '') and str(v).strip():
                    errori[c].append(f'{t} presente in {f}')
            if len(x['files']) <= 6 and 'PixelData' in d:
                hashes[hashlib.md5(d.PixelData).hexdigest()].append(f)
    m = {'Medicina nucleare': 'PET', 'PET-TC': 'PET'}.get(j.get('modalita', ''), j.get('modalita', ''))
    if m and mods and m not in mods:
        avvisi[c].append(f'metodica «{j.get("modalita")}» ma le serie sono {", ".join(mods)}')
    d = [v for v in hashes.values() if len(v) > 1]
    if d:
        avvisi[c].append(f'{len(d)} immagini identiche ripetute')
    # copie «… 2» create dalla sincronizzazione (iCloud/Dropbox): doppioni non usati, vanno tolti
    dop = [os.path.relpath(os.path.join(r, x), cdir) for r, ds, fs in os.walk(cdir) for x in ds + fs if re.search(r' \d+(\.\w+)?$', x)]
    if dop:
        avvisi[c].append(f'{len(dop)} copie doppie della sincronizzazione (es. «{dop[0]}»): cancellarle')
for titolo, diz in (('ERRORI', errori), ('Avvisi', avvisi)):
    if diz:
        print(f'{titolo}:')
        for c, l in diz.items():
            for v in dict.fromkeys(l):
                print(f'  {c}: {v}')
if pydicom is None:
    print('(pydicom non installato: controllo dei DICOM saltato — installalo con: python3 -m pip install --user pydicom)')
print(f'Controllo: {sum(len(v) for v in errori.values())} errori, {sum(len(v) for v in avvisi.values())} avvisi.')
sys.exit(2 if errori else 0)
