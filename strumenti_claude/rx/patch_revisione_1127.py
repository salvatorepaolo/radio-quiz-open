#!/usr/bin/env python3
"""27/11 sera, revisione clinica di tutti i casi: piccole correzioni di testo (italiano + inglese).
- 032: la conclusione dice la versione FIGO (IB1 secondo FIGO 2009, IB2 secondo FIGO 2018), come già la spiegazione.
- 167: «seno costofrenico posteriore (laterale)» poco chiaro → visibile nella proiezione laterale, con il volume.
- 177: nel giovane (emorragia profonda sotto i 45 anni) l'angio-TC per escludere una causa secondaria (AHA/ASA 2022)."""
import json
B = '/Volumes/Caloggero/piattaforma-quiz/'

def carica(n):
    f = B + 'casi-free/caso-tcia-%03d/caso.json' % n; g = B + 'cloud/web/lingua/casi/caso-tcia-%03d.json' % n
    return f, json.load(open(f)), g, json.load(open(g))

def salva(f, c, g, t):
    json.dump(c, open(f, 'w'), ensure_ascii=False, indent=1); json.dump(t, open(g, 'w'), ensure_ascii=False)

def cambia_testo(t, vecchio, nuovo, en_da, en_a):
    """sposta la traduzione dalla chiave vecchia alla nuova, sostituendo un pezzo dell'inglese"""
    e = t.pop(vecchio)
    assert en_da in e, (en_da, e[:200])
    t[nuovo] = e.replace(en_da, en_a, 1)

# 032 — opzione corretta della conclusione
f, c, g, t = carica(32)
o = [o for o in c['opzioni'] if o['testo'].startswith('Carcinoma della cervice confinato alla cervice, ≤ 4 cm (FIGO IB1)')]
assert len(o) == 1
vecchio = o[0]['testo']; nuovo = vecchio.replace('≤ 4 cm (FIGO IB1)', '≤ 4 cm (FIGO IB1 nella versione 2009; IB2 secondo FIGO 2018)')
print('032 EN:', t[vecchio][:120])
en_v = t[vecchio]
import re
m = re.search(r'\(FIGO IB1\)', en_v)
assert m, en_v
cambia_testo(t, vecchio, nuovo, '(FIGO IB1)', '(FIGO IB1 in the 2009 version; IB2 under FIGO 2018)')
o[0]['testo'] = nuovo
salva(f, c, g, t)

# 167 — spiegazione
f, c, g, t = carica(167)
vecchio = c['spiegazione']
da = 'in piedi oblitera prima il seno costofrenico posteriore (laterale), poi quello laterale in PA (servono circa 200-300 ml)'
assert da in vecchio
nuovo = vecchio.replace(da, 'in piedi oblitera prima il seno costofrenico posteriore, che si vede nella proiezione laterale (bastano circa 50-75 ml), poi quello laterale nella PA (servono circa 200-300 ml)')
e = t[vecchio]; print('167 EN:', e[:400])
c['spiegazione'] = nuovo
salva(f, c, g, t)  # l'inglese si sistema sotto, dopo aver visto il testo
print('ok parziale')
