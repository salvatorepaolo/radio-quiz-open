#!/usr/bin/env python3
"""correla_vetrini_2411.py (24/11/2026): più collegamenti vetrino ↔ casi radiologici con la stessa diagnosi (campo «rassegna»,
in tutti e due i sensi) e le frasi inglesi nei file di traduzione dei casi. Idempotente; mantiene il formato dei file."""
import json, os
R = '/Volumes/Caloggero/piattaforma-quiz/'
# (vetrino, caso radiologico, frase nel vetrino IT/EN, frase nel caso radiologico IT/EN)
COPPIE = [
 ('137', '063', ('RM: astrocitoma IDH-mutato di grado 4, stessa famiglia istologica', 'MRI: IDH-mutant grade 4 astrocytoma, same histological family'),
                ('vetrino: glioblastoma, necrosi a pseudopalizzata e proliferazione microvascolare (il quadro istologico del grado 4)', 'slide: glioblastoma, pseudopalisading necrosis and microvascular proliferation (the histological picture of grade 4)')),
 ('138', '131', ('Ecografia: metastasi epatiche ipoecogene da carcinoma colorettale', 'Ultrasound: hypoechoic liver metastases from colorectal carcinoma'),
                ('vetrino: adenocarcinoma del colon, il tumore primitivo', 'slide: colon adenocarcinoma, the primary tumour')),
 ('139', '004', ('TC: epatocarcinoma multinodulare del lobo destro', 'CT: multinodular hepatocellular carcinoma of the right lobe'),
                ('vetrino: carcinoma epatocellulare ben differenziato (trabecole, arterie «spaiate», cellule chiare)', 'slide: well-differentiated hepatocellular carcinoma (trabeculae, «unpaired» arteries, clear cells)')),
 ('139', '044', ('Ecografia e CEUS: piccolo epatocarcinoma quasi isoecogeno', 'Ultrasound and CEUS: small, almost isoechoic hepatocellular carcinoma'),
                ('vetrino: carcinoma epatocellulare ben differenziato', 'slide: well-differentiated hepatocellular carcinoma')),
 ('141', '068', ('TC: carcinoma a cellule chiare di circa 14 cm', 'CT: clear cell carcinoma of about 14 cm'), ('vetrino: carcinoma renale a cellule chiare', 'slide: clear cell renal cell carcinoma')),
 ('141', '069', ('TC: piccolo carcinoma a cellule chiare (2,3 cm)', 'CT: small clear cell carcinoma (2.3 cm)'), ('vetrino: carcinoma renale a cellule chiare', 'slide: clear cell renal cell carcinoma')),
 ('141', '077', ('TC: carcinoma a cellule chiare di circa 10 cm', 'CT: clear cell carcinoma of about 10 cm'), ('vetrino: carcinoma renale a cellule chiare', 'slide: clear cell renal cell carcinoma')),
 ('141', '078', ('TC: carcinoma a cellule chiare del polo superiore', 'CT: clear cell carcinoma of the upper pole'), ('vetrino: carcinoma renale a cellule chiare', 'slide: clear cell renal cell carcinoma')),
 ('141', '080', ('RM: carcinoma renale della coorte a cellule chiare', 'MRI: renal carcinoma from the clear cell cohort'), ('vetrino: carcinoma renale a cellule chiare', 'slide: clear cell renal cell carcinoma')),
 ('141', '062', ('RM encefalo: metastasi cerebrale di carcinoma a cellule renali', 'Brain MRI: brain metastasis of renal cell carcinoma'),
                ('vetrino: carcinoma renale a cellule chiare, l\'istotipo più frequente', 'slide: clear cell renal cell carcinoma, the most common histotype')),
 ('165', '055', ('RM: carcinoma duttale infiltrante con componente intraduttale, stesso istotipo', 'MRI: invasive ductal carcinoma with intraductal component, same histotype'),
                ('vetrino: carcinoma infiltrante di tipo non speciale (duttale), lo stesso istotipo', 'slide: invasive carcinoma of no special type (ductal), the same histotype')),
 ('165', '158', ('Ecografia: massa spiculata, istologia carcinoma duttale invasivo', 'Ultrasound: spiculated mass, histology invasive ductal carcinoma'),
                ('vetrino: carcinoma infiltrante di tipo non speciale (duttale), come la biopsia di questo nodulo', 'slide: invasive carcinoma of no special type (ductal), like the biopsy of this nodule')),
]
def leggi(p):
    s = open(p, encoding='utf-8').read(); d = json.loads(s)
    for ind in (None, 1, 2):
        for sep in (None, (', ', ': '), (',', ':')):
            if json.dumps(d, ensure_ascii=False, indent=ind, separators=sep) + ('\n' if s.endswith('\n') else '') == s: return d, (ind, sep, s.endswith('\n'))
    raise SystemExit(f'formato non riconosciuto: {p}')
def scrivi(p, d, fm): open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=fm[0], separators=fm[1]) + ('\n' if fm[2] else ''))
def collega(da, verso, it, en):
    cid, vid = f'caso-tcia-{da}', f'caso-tcia-{verso}'
    p = R + f'casi-free/{cid}/caso.json'; c, fm = leggi(p)
    r = [x for x in (c.get('rassegna') or []) if x.get('caso') != vid] + [{'caso': vid, 'testo': it}]
    if r != c.get('rassegna'): c['rassegna'] = r; scrivi(p, c, fm); print(cid, '→', vid)
    pt = R + f'cloud/web/lingua/casi/{cid}.json'; t, ft = leggi(pt)
    if t.get(it) != en: t[it] = en; scrivi(pt, t, ft)
for vt, rx, a_vt, a_rx in COPPIE:
    collega(vt, rx, *a_vt); collega(rx, vt, *a_rx)
