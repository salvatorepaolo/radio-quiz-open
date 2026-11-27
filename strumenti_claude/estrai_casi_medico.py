#!/usr/bin/env python3
"""Revisione clinica: (1) controlli di coerenza «da medico» automatici, (2) schede compatte per la lettura.
Uscita: /Volumes/Caloggero/_viste/revisione/coerenza.txt e schede_NN.txt (25 casi per file)."""
import json, glob, os, re, sys
BASE = '/Volumes/Caloggero/piattaforma-quiz/casi-free'
OUT = '/Volumes/Caloggero/_viste/revisione'; os.makedirs(OUT, exist_ok=True)
try:
    import pydicom
except ImportError:
    pydicom = None

def testo(d):
    return json.dumps(d, ensure_ascii=False)

def dicom_info(cartella, d):
    if not pydicom: return {}
    s = d.get('serie_iniziale')
    files = sorted(glob.glob(os.path.join(cartella, '**', '*.dcm'), recursive=True))
    if not files: return {}
    try:
        ds = pydicom.dcmread(files[0], stop_before_pixels=True)
        return {'eta': str(getattr(ds, 'PatientAge', '') or ''), 'sesso': str(getattr(ds, 'PatientSex', '') or ''),
                'mod': str(getattr(ds, 'Modality', '') or ''), 'parte': str(getattr(ds, 'BodyPartExamined', '') or '')}
    except Exception as e:
        return {'err': str(e)[:60]}

LATI = [('destr', 'sinistr')]
def lati(t):
    t = t.lower()
    return len(re.findall(r'\bdestr[oaie]\b', t)), len(re.findall(r'\bsinistr[oaie]\b', t))

coer = []; schede = []
for f in sorted(glob.glob(BASE + '/caso-*/caso.json')):
    d = json.load(open(f)); cid = d['id']; cart = os.path.dirname(f)
    T = testo(d).lower(); prob = []
    # età e sesso: anamnesi contro DICOM
    an = (d.get('anamnesi') or '').lower()
    m = re.search(r'(\d{1,3})\s*anni', an)
    di = dicom_info(cart, d)
    if m and di.get('eta'):
        e = re.match(r'(\d+)([YMWD])', di['eta'])
        if e and e.group(2) == 'Y' and abs(int(e.group(1)) - int(m.group(1))) > 1 and 'simulato' not in T[:400]:
            prob.append(f"età anamnesi {m.group(1)} ≠ DICOM {di['eta']}")
    sx = 'F' if re.search(r'\b(donna|paziente femmina|ragazza|bambina|signora)\b', an) else 'M' if re.search(r'\b(uomo|ragazzo|bambino|signore)\b', an) else None
    if sx and di.get('sesso') in ('M', 'F') and sx != di['sesso']:
        prob.append(f"sesso anamnesi {sx} ≠ DICOM {di['sesso']}")
    if di.get('mod') and d.get('modalita') and di['mod'] not in ('OT', 'SC'):
        mm = {'TC': 'CT', 'RM': 'MR', 'RX': ('CR', 'DX', 'DR'), 'Ecografia': 'US', 'US': 'US', 'PET-TC': ('PT', 'CT'), 'Mammografia': ('MG',)}
        att = mm.get(d['modalita'])
        if att and di['mod'] not in (att if isinstance(att, tuple) else (att,)):
            prob.append(f"modalità {d['modalita']} ma DICOM {di['mod']}")
    # sesso e organi
    if sx == 'M' and re.search(r'\b(utero|ovai|endometri|mammell)', ' '.join(o['testo'].lower() for o in d.get('opzioni', []) if o.get('corretta'))):
        prob.append('organo femminile in risposta corretta con paziente uomo')
    if sx == 'F' and re.search(r'\b(prostat|testicol)', ' '.join(o['testo'].lower() for o in d.get('opzioni', []) if o.get('corretta'))):
        prob.append('organo maschile in risposta corretta con paziente donna')
    # lato: titolo interno contro risposte corrette
    ti = (d.get('titolo_interno') or '') + ' ' + (d.get('titolo') or '')
    ldx, lsx = lati(ti)
    corr = ' '.join(o['testo'] for o in d.get('opzioni', []) if o.get('corretta'))
    cdx, csx = lati(corr)
    if ldx and not lsx and csx and not cdx: prob.append('titolo dice destra, risposte corrette dicono sinistra')
    if lsx and not ldx and cdx and not csx: prob.append('titolo dice sinistra, risposte corrette dicono destra')
    # sezioni a scelta singola: una sola corretta
    for i, s in enumerate(d.get('sezioni') or []):
        n = sum(1 for o in d.get('opzioni', []) if o.get('sezione', 0) == i and o.get('corretta'))
        if s.get('singola') and n != 1: prob.append(f"sezione «{s.get('nome')}» singola con {n} corrette")
        if n == 0: prob.append(f"sezione «{s.get('nome')}» senza risposte corrette")
    # opzioni duplicate o vuote
    tt = [o['testo'].strip().lower() for o in d.get('opzioni', [])]
    if len(tt) != len(set(tt)): prob.append('opzioni duplicate')
    if prob: coer.append(f"{cid}: " + ' | '.join(prob))
    # scheda compatta
    righe = [f"## {cid} · {d.get('modalita')} · {d.get('distretto')} · {d.get('difficolta')} · DICOM {di.get('eta','')}{di.get('sesso','')}",
             f"TIT: {d.get('titolo')} || INT: {d.get('titolo_interno')}",
             f"ANA: {(d.get('anamnesi') or '')[:300]}",
             f"RICH: {json.dumps(d.get('richiesta'), ensure_ascii=False)[:160] if d.get('richiesta') else ''} QUES: {d.get('quesito','')}",
             f"DOM: {d.get('domanda')}"]
    sez = d.get('sezioni') or [{'nome': ''}]
    for i, s in enumerate(sez):
        righe.append(f"[{s.get('nome','')}{' (1)' if s.get('singola') else ''}]")
        for o in d.get('opzioni', []):
            if o.get('sezione', 0) != i: continue
            nota = (o.get('nota') or '')[:110]
            righe.append(f"  {'✔' if o.get('corretta') else '✘'} {o['testo']}" + (f"  — {nota}" if nota else ''))
    righe.append(f"SPIEG: {(d.get('spiegazione') or '')[:480]}")
    if d.get('regola'): righe.append(f"REG: {str(d.get('regola'))[:150]}")
    if d.get('esito_clinico'): righe.append(f"ESITO: {str(d.get('esito_clinico'))[:150]}")
    if d.get('comunicazione'): righe.append(f"COM: {json.dumps(d.get('comunicazione'), ensure_ascii=False)[:150]}")
    schede.append('\n'.join(righe))

open(OUT + '/coerenza.txt', 'w').write('\n'.join(coer) + '\n')
for k in range(0, len(schede), 25):
    open(f"{OUT}/schede_{k // 25:02d}.txt", 'w').write('\n\n'.join(schede[k:k + 25]))
print(len(schede), 'casi;', len(coer), 'con avvisi di coerenza; pydicom', bool(pydicom))
