# correla_vetrini.py (1.276): nei casi radiologici, collegamento al caso di soli vetrini con la stessa diagnosi
# (campo «rassegna»: dopo la risposta compare «Correlazione con l'anatomia patologica»). Idempotente.
import json, os
CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free'
INV = {
 'caso-tcia-133': [('caso-tcia-136', 'vetrino: carcinoma papillare della tiroide (papille, nuclei chiari con incisure)')],
 'caso-tcia-057': [('caso-tcia-137', 'vetrino: glioblastoma, necrosi a pseudopalizzata e proliferazione microvascolare (anello e centro necrotico in RM)')],
 'caso-tcia-021': [('caso-tcia-138', 'vetrino: adenocarcinoma del colon, il tumore primitivo')],
 'caso-tcia-090': [('caso-tcia-138', 'vetrino: adenocarcinoma del colon, il tumore primitivo')],
 'caso-tcia-128': [('caso-tcia-139', 'vetrino: carcinoma epatocellulare ben differenziato (trabecole, arterie «spaiate», cellule chiare)')],
 'caso-tcia-124': [('caso-tcia-139', 'vetrino: carcinoma epatocellulare ben differenziato')],
 'caso-tcia-129': [('caso-tcia-139', 'vetrino: carcinoma epatocellulare ben differenziato')],
 'caso-tcia-026': [('caso-tcia-140', 'vetrino: carcinoma squamoso del polmone (nidi solidi, cheratinizzazione)')],
 'caso-tcia-088': [('caso-tcia-141', 'vetrino della STESSA paziente: carcinoma a cellule chiare G4 della nefrectomia')],
 'caso-tcia-003': [('caso-tcia-141', 'vetrino: carcinoma a cellule chiare di alto grado di un\'altra paziente (con metastasi polmonari)')],
 'caso-tcia-079': [('caso-tcia-141', 'vetrino: carcinoma renale a cellule chiare')],
}
for cid, l in INV.items():
    p = os.path.join(CASI, cid, 'caso.json'); c = json.load(open(p, encoding='utf-8'))
    r = [x for x in (c.get('rassegna') or []) if x.get('caso') not in {k for k, _ in l}] + [{'caso': k, 'testo': t} for k, t in l]
    if r != c.get('rassegna'):
        c['rassegna'] = r; json.dump(c, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(cid, len(r))
