# zone_vetrini.py: zona del reperto sui vetrini dei casi 136, 138, 139, 141 (controllate sulle immagini, 24/11/2026)
# 138: domanda sul vetrino (localizza); gli altri: zona mostrata con la correzione (il vetrino si sposta lì)
import json, os, sys
R = sys.argv[1]  # .../piattaforma-quiz
Z = {
 '138': ({'i': 0, 'r': [10000, 17000, 30500, 28500], 'domanda': True,
          'nota': "Adenocarcinoma che infiltra la sottomucosa (pT1): ghiandole irregolari con nuclei allungati e stratificati in uno stroma desmoplastico con infiammazione (in alto la mucosa normale, in basso la parte esofitica della stessa neoplasia)"},
         "Adenocarcinoma invading the submucosa (pT1): irregular glands with elongated, stratified nuclei in a desmoplastic, inflamed stroma (normal mucosa above, the exophytic part of the same tumour below)"),
 '136': ({'i': 0, 'r': [16200, 10300, 17800, 11700],
          'nota': "Architettura papillare: assi fibrovascolari sottili rivestiti da epitelio con nuclei sovrapposti (ingrandisci per vedere i nuclei chiari con incisure)"},
         "Papillary architecture: thin fibrovascular cores lined by epithelium with overlapping nuclei (zoom in to see the clear, grooved nuclei)"),
 '139': ({'i': 0, 'r': [7300, 8700, 9400, 10600],
          'nota': "Trabecole di cellule di tipo epatocitario con citoplasma chiaro e vacuolizzato"},
         "Trabeculae of hepatocyte-like cells with clear, vacuolated cytoplasm"),
 '141': ({'i': 0, 'r': [24500, 36500, 33500, 43500],
          'nota': "Nidi e alveoli di cellule a citoplasma chiaro o eosinofilo, con emorragia e spazi cistici"},
         "Nests and alveoli of cells with clear or eosinophilic cytoplasm, with haemorrhage and cystic spaces"),
}
for c, (z, en) in Z.items():
    p = os.path.join(R, 'casi-free', f'caso-tcia-{c}', 'caso.json'); d = json.load(open(p, encoding='utf-8'))
    assert 'zona_vetrino' not in d, c
    d['zona_vetrino'] = z
    if z.get('domanda'): d['localizza'] = True
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    q = os.path.join(R, 'cloud/web/lingua/casi', f'caso-tcia-{c}.json'); t = json.load(open(q, encoding='utf-8'))
    t[z['nota']] = en; json.dump(t, open(q, 'w', encoding='utf-8'), ensure_ascii=False)
    print(c, 'zona', z['r'], 'domanda' if z.get('domanda') else 'solo correzione')
