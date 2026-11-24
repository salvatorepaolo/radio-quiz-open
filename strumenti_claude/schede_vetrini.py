# schede_vetrini.py: compila scheda_vetrino (organo, colorazione, campione, ingrandimento, formato) dei casi con vetrino,
# dalla descrizione della serie e dall'estensione del file; non tocca le schede già scritte a mano
import json, os, re, sys, glob
CASI = sys.argv[1]
ORG = {'tiroide': 'Tiroide', 'encefalo': 'Encefalo', 'colon': 'Colon', 'fegato': 'Fegato', 'polmone': 'Polmone', 'rene': 'Rene', 'mammella': 'Mammella'}
for d in sorted(glob.glob(os.path.join(CASI, '*'))):
    try: serie = json.load(open(os.path.join(d, 'serie.json'), encoding='utf-8')); caso = json.load(open(os.path.join(d, 'caso.json'), encoding='utf-8'))
    except Exception: continue
    vt = [s for s in serie if s.get('tipo') == 'vetrino']
    if not vt or caso.get('scheda_vetrino'): continue
    s = vt[0]; ds = s.get('descrizione', '').lower()
    org = next((v for k, v in ORG.items() if k in ds), caso.get('distretto', ''))
    est = os.path.splitext(s['files'][0])[1].lower()
    scheda = {'organo': org,
              'colorazione': 'Ematossilina-eosina' if 'ematossilina' in ds else '',
              'campione': 'Pezzo operatorio' if re.search(r'pezzo operatorio|nefrectomia|resezione', ds) else '',
              'ingrandimento': (re.search(r'(\d+)\s*×', ds).group(1) + '×') if re.search(r'(\d+)\s*×', ds) else '',
              'formato': 'DICOM' if est == '.dcm' else {'.svs': 'Aperio SVS', '.ndpi': 'Hamamatsu NDPI', '.mrxs': '3DHISTECH MRXS', '.czi': 'Zeiss CZI', '.isyntax': 'Philips iSyntax', '.scn': 'Leica SCN', '.bif': 'Ventana BIF', '.vsi': 'Olympus VSI'}.get(est, est.lstrip('.').upper())}
    caso['scheda_vetrino'] = {k: v for k, v in scheda.items() if v}
    json.dump(caso, open(os.path.join(d, 'caso.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(os.path.basename(d), caso['scheda_vetrino'])
