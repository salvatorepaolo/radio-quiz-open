"""Controllo trasversale di tutti i casi (28/11): percorsi, traduzioni, fonti e licenze, file, vista, simulati,
coerenza tra opzioni e sezioni, lato (destra/sinistra) tra titolo, opzioni e spiegazione."""
import json, glob, os, re
B = '/Volumes/Caloggero/piattaforma-quiz/'; C = B + 'casi-free/'; W = B + 'cloud/web/'
casi = {os.path.basename(d): json.load(open(d + '/caso.json')) for d in sorted(glob.glob(C + 'caso-*')) if os.path.exists(d + '/caso.json')}
prob = []
def p(c, m): prob.append(f'{c}: {m}')
perc = json.load(open(W + 'percorsi.json')); perc_en = json.load(open(W + 'lingua/en/percorsi.json'))
for x in perc:
    for c in x['casi']:
        if c not in casi: p(x['id'], f'percorso con caso inesistente {c}')
if [(x['id'], x['casi']) for x in perc] != [(x['id'], x['casi']) for x in perc_en]: p('percorsi', 'italiano e inglese non allineati')
nei_percorsi = {c for x in perc for c in x['casi']}
titoli = json.load(open(W + 'lingua/casi/_titoli.json'))
def testi(d):
    out = [d.get('titolo'), d.get('anamnesi'), d.get('domanda'), d.get('spiegazione'), d.get('regola'), d.get('quesito'), (d.get('esito_clinico') or {}).get('testo'), (d.get('vista') or {}).get('nota'), (d.get('comunicazione') or {}).get('motivo')]
    out += [s.get('nome') for s in d.get('sezioni', [])] + [s.get('domanda') for s in d.get('sezioni', [])]
    for o in d.get('opzioni', []): out += [o.get('testo'), o.get('nota')]
    return [t for t in out if t]
for c, d in casi.items():
    if not d.get('visibile', True): continue
    f = W + f'lingua/casi/{c}.json'
    if not os.path.exists(f): p(c, 'manca la traduzione'); continue
    T = json.load(open(f)); mancano = [t for t in testi(d) if t not in T and t not in titoli]
    if mancano: p(c, f'{len(mancano)} testi senza inglese, es. «{mancano[0][:60]}»')
    fo = d.get('fonte') or {}
    if not fo.get('licenza'): p(c, 'manca la licenza')
    if re.search(r'\bNC\b|NonCommercial|non commerciale|ND\b', str(fo.get('licenza', ''))): p(c, f"licenza non adatta: {fo.get('licenza')}")
    s = json.load(open(C + c + '/serie.json'))
    for x in s:
        for fl in x['files'][:: max(1, len(x['files']) // 5)]:
            if not os.path.exists(C + c + '/' + fl): p(c, f'file mancante {fl}'); break
    v = d.get('vista') or {}
    if v and (v.get('serie', 0) >= len(s) or v.get('idx', 0) >= len(s[v.get('serie', 0)]['files'])): p(c, f'vista fuori dalla serie {v}')
    if d.get('serie_iniziale', 0) >= len(s): p(c, 'serie iniziale inesistente')
    for q in d.get('disposizione') or []:
        if q >= len(s): p(c, f'disposizione con serie inesistente {q}')
    sez = d.get('sezioni') or []
    for o in d.get('opzioni', []):
        if sez and o.get('sezione', 0) >= len(sez): p(c, 'opzione in una sezione inesistente')
    for i, x in enumerate(sez):
        g = [o for o in d['opzioni'] if o.get('sezione', 0) == i and o.get('corretta')]
        if not g: p(c, f'sezione «{x.get("nome")}» senza risposte giuste')
        if x.get('singola') and len(g) > 1: p(c, f'sezione a risposta singola con {len(g)} giuste')
    if '🧪' in d.get('titolo', '') and 'SIMULATO' not in d.get('anamnesi', '').upper(): p(c, 'simulato non dichiarato nell\'anamnesi')
    # lato: se il titolo interno dice destra/sinistra, le opzioni giuste principali non devono dire il lato opposto
    ti = d.get('titolo_interno', '').lower(); giuste = ' '.join(o['testo'].lower() for o in d['opzioni'] if o.get('corretta'))
    for a, b in (('destr', 'sinistr'), ('sinistr', 'destr')):
        if re.search(a + r'[oa]\b', ti) and not re.search(b + r'[oa]\b', ti) and re.search(b + r'[oaie]\b', giuste) and not re.search(a + r'[oaie]\b', giuste):
            p(c, f'lato: titolo interno «{a}» ma risposte giuste «{b}»')
fuori = [c for c, d in casi.items() if d.get('visibile', True) and c not in nei_percorsi]
print('\n'.join(prob) or 'nessun problema'); print(f'{len(casi)} casi · fuori dai percorsi: {len(fuori)}')
