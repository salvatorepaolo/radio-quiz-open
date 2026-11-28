"""Controlli di coerenza tra testi dei casi e immagini DICOM.
uso: python controlla_coerenza.py <cartella casi-free>
"""
import json, re, sys, os
import pydicom

CASI = sys.argv[1]
MOD = {'TC': {'CT'}, 'RM': {'MR'}, 'RX': {'CR', 'DX', 'DR', 'RF'}, 'PET-TC': {'PT', 'CT'}, 'PET': {'PT'},
       'MG': {'MG'}, 'Mammografia': {'MG'}, 'Ecografia': {'US'}, 'ECO': {'US'}, 'Scintigrafia': {'NM'}}
problemi = []

def p(c, t):
    problemi.append((c, t))

def testo_pubblico(d):
    parti = [d.get('titolo', ''), d.get('anamnesi', ''), d.get('domanda', ''), d.get('spiegazione', ''), d.get('regola', '')]
    parti += [o.get('testo', '') for o in d.get('opzioni', [])]
    parti += [o.get('nota', '') for o in d.get('opzioni', [])]
    return '\n'.join(x for x in parti if isinstance(x, str))

def eta_sesso(t):
    m = re.search(r'\b(Uomo|Donna|Ragazzo|Ragazza|Bambino|Bambina|Paziente|Maschio|Femmina)\s+di\s+(\d+)\s+anni', t, re.I)
    if not m:
        return None, None
    s = m.group(1).lower()
    sx = 'M' if s in ('uomo', 'ragazzo', 'bambino', 'maschio') else 'F' if s in ('donna', 'ragazza', 'bambina', 'femmina') else None
    return sx, int(m.group(2))

for c in sorted(x for x in os.listdir(CASI) if x.startswith('caso-')):
    f = os.path.join(CASI, c, 'caso.json')
    if not os.path.exists(f):
        continue
    d = json.load(open(f))
    try:
        S = json.load(open(os.path.join(CASI, c, 'serie.json')))
    except Exception:
        S = []
    n = [len(s.get('files', [])) for s in S]
    v = d.get('vista') or {}
    if isinstance(v, dict) and 'serie' in v:
        if not (0 <= v['serie'] < len(S)):
            p(c, f"vista.serie {v['serie']} fuori dalle {len(S)} serie")
        elif 'idx' in v and not (0 <= v['idx'] < n[v['serie']]):
            p(c, f"vista.idx {v['idx']} oltre le {n[v['serie']]} immagini della serie {v['serie']}")
    si = d.get('serie_iniziale')
    if isinstance(si, int) and S and not (0 <= si < len(S)):
        p(c, f'serie_iniziale {si} fuori dalle {len(S)} serie')
    T = testo_pubblico(d)
    # eta e sesso: titolo contro anamnesi
    s1, e1 = eta_sesso(d.get('titolo', ''))
    s2, e2 = eta_sesso(d.get('anamnesi', ''))
    if e1 and e2 and e1 != e2:
        p(c, f'età nel titolo {e1}, nell\'anamnesi {e2}')
    if s1 and s2 and s1 != s2:
        p(c, f'sesso nel titolo {s1}, nell\'anamnesi {s2}')
    sx, et = s2 or s1, e2 or e1
    # DICOM: primo file di ogni serie
    mods, sessi, eta_d = set(), set(), set()
    for s in S:
        if not s.get('files'):
            continue
        try:
            ds = pydicom.dcmread(os.path.join(CASI, c, s['files'][0]), stop_before_pixels=True)
        except Exception as ex:
            p(c, f"file illeggibile {s['files'][0]}: {ex}")
            continue
        mods.add(str(getattr(ds, 'Modality', '')))
        if getattr(ds, 'PatientSex', ''):
            sessi.add(str(ds.PatientSex))
        a = str(getattr(ds, 'PatientAge', '') or '')
        if re.fullmatch(r'\d{3}Y', a):
            eta_d.add(int(a[:3]))
    if sx and sessi and sx not in sessi and sessi <= {'M', 'F'}:
        p(c, f'sesso nel testo {sx}, nel DICOM {sorted(sessi)}')
    if et and eta_d and min(abs(et - x) for x in eta_d) > 2:
        p(c, f'età nel testo {et}, nel DICOM {sorted(eta_d)}')
    attese = MOD.get(d.get('modalita', ''))
    if attese and mods and not (mods & attese):
        p(c, f"modalità {d.get('modalita')} ma serie {sorted(mods)}")
    # riferimenti a immagini oltre la lunghezza massima delle serie
    if n:
        mx = max(n)
        for m in re.finditer(r'\b(?:immagin[ei]|fett[ae]|img)\s+(\d+)(?:\s*[-–]\s*(\d+))?', T, re.I):
            k = int(m.group(2) or m.group(1))
            if k > mx:
                p(c, f'«{m.group(0)}» oltre la serie più lunga ({mx} immagini)')
    # sesso contro anatomia
    low = T.lower()
    if sx == 'M' and re.search(r'\b(utero|ovai|endometri|mammell\w* femminil|gravidanz)', low):
        p(c, 'paziente uomo ma il testo cita organi femminili')
    if sx == 'F' and re.search(r'\b(prostat|testicol|scrot)', low):
        p(c, 'paziente donna ma il testo cita organi maschili')
    # lato: opzioni corrette principali contro titolo interno
    ti = (d.get('titolo_interno') or '').lower()
    corr = ' '.join(o['testo'].lower() for o in d.get('opzioni', []) if o.get('corretta') and o.get('tipo') == 'principale')
    def lati(t):
        return {'d' for _ in [0] if re.search(r'\bdestr[oaie]\b', t)} | {'s' for _ in [0] if re.search(r'\bsinistr[oaie]\b', t)}
    lt, lc = lati(ti), lati(corr)
    if len(lt) == 1 and len(lc) == 1 and lt != lc:
        p(c, f'lato nel titolo interno {lt} diverso dalle risposte principali {lc}')
    # opzioni duplicate
    vis = {}
    for o in d.get('opzioni', []):
        k = re.sub(r'\W+', ' ', o.get('testo', '').lower()).strip()
        if k in vis:
            p(c, f'opzione duplicata: {o["testo"][:80]}')
        vis[k] = 1
    # sezioni senza risposta corretta
    sez = d.get('sezioni') or []
    for i, s in enumerate(sez):
        oo = [o for o in d.get('opzioni', []) if o.get('sezione') == i]
        if oo and not any(o.get('corretta') for o in oo):
            p(c, f'sezione {i} «{s.get("nome")}» senza risposta corretta')
        if sez and not oo:
            p(c, f'sezione {i} «{s.get("nome")}» senza opzioni')

for c, t in problemi:
    print(c, '·', t)
print(f'{len(problemi)} segnalazioni')
