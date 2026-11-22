"""prepara.py: vetrini di esempio per il visualizzatore (pulsante «Prova un vetrino di esempio» del client), uno per formato.
Origine: dati di prova di OpenSlide (Carnegie Mellon University, liberamente distribuibili) e la slide di prova di
OpenPhi/libisyntax (MIT) in /Volumes/Caloggero/vetrini_formati_prova (non in git). Ogni vetrino passa da
strumenti/prepara_vetrino.py (etichetta e panoramica tolte, metadati ripuliti, controllo), poi va in
cloud/web/esempi/vetrini/<id>/ con l'elenco cloud/web/esempi/vetrini/elenco.json (non in git, come gli zip degli esempi).
Il client li legge a pezzi (richieste parziali): si scarica solo la parte che si guarda.
Uso: <python del venv con zxing-cpp> prepara.py [id ...]   (senza id: tutti)"""
import os, sys, json, shutil, subprocess
SRC = '/Volumes/Caloggero/vetrini_formati_prova'
PREP = '/Volumes/Caloggero/piattaforma-quiz/strumenti/prepara_vetrino.py'
OUT = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/esempi/vetrini'
TMP = '/Volumes/Caloggero/strumenti_claude/esempi_vetrini/caso'
OS_ = 'OpenSlide (Carnegie Mellon University), dati di prova liberamente distribuibili'
VETRINI = [  # id, file, formato, nota (it, en), fonte
  ('aperio-svs', 'Aperio/CMU-1-Small-Region.svs', 'Aperio SVS', ('JPEG, piccola regione', 'JPEG, small region'), OS_),
  ('hamamatsu-ndpi', 'Hamamatsu/CMU-1.ndpi', 'Hamamatsu NDPI', ('JPEG', 'JPEG'), OS_),
  ('tiff-generico', 'Generic-TIFF/CMU-1.tiff', 'TIFF piramidale generico', ('JPEG', 'JPEG'), OS_),
  ('huron-tif', 'Huron/Huron-1.tif', 'Huron TIFF', ('', ''), OS_),
  ('ventana-bif', 'Ventana/Ventana-1.bif', 'Roche Ventana BIF', ('', ''), OS_),
  ('philips-tiff', 'Philips-TIFF/Philips-4.tiff', 'Philips TIFF', ('', ''), OS_),
  ('philips-isyntax', 'Philips-iSyntax/testslide.isyntax', 'Philips iSyntax', ('', ''), 'OpenPhi / libisyntax (licenza MIT)'),
  ('leica-scn', 'Leica/Leica-Fluorescence-1.scn', 'Leica SCN', ('fluorescenza', 'fluorescence'), OS_),
  ('mirax-mrxs', 'Mirax/CMU-1-Saved-1_16.mrxs', '3DHISTECH MRXS', ('più file', 'multi-file'), OS_),
  ('zeiss-czi', 'Zeiss/Zeiss-5-JXR.czi', 'Zeiss CZI', ('JPEG XR', 'JPEG XR'), OS_),
  ('olympus-vsi', 'Olympus/OS-2.vsi', 'Olympus VSI', ('più file', 'multi-file'), OS_),
]
scelti = set(sys.argv[1:])
os.makedirs(OUT, exist_ok=True)
ej = os.path.join(OUT, 'elenco.json'); elenco = {v['id']: v for v in (json.load(open(ej)) if os.path.exists(ej) else [])}
for vid, rel, fmt, nota, fonte in VETRINI:
    if scelti and vid not in scelti: continue
    if not os.path.exists(os.path.join(SRC, rel)): print('manca', rel); continue
    shutil.rmtree(TMP, ignore_errors=True); os.makedirs(TMP)
    subprocess.run([sys.executable, PREP, os.path.join(SRC, rel), TMP, fmt], check=True)
    s = json.load(open(os.path.join(TMP, 'serie.json')))[0]
    dst = os.path.join(OUT, vid); shutil.rmtree(dst, ignore_errors=True)
    shutil.move(os.path.join(TMP, 'serie', 'vetrino_0'), dst)
    files = [f.split('serie/vetrino_0/', 1)[1] for f in s['files']]
    elenco[vid] = {'id': vid, 'formato': fmt, 'nota': nota[0], 'nota_en': nota[1], 'fonte': fonte, 'files': files, 'dimensioni': s['dimensioni']}
    json.dump([elenco[v[0]] for v in VETRINI if v[0] in elenco], open(ej, 'w'), ensure_ascii=False, indent=1)   # dopo ogni vetrino
    print('ok', vid, round(sum(s['dimensioni']) / 1048576), 'MB', flush=True)
shutil.rmtree(TMP, ignore_errors=True)
print('elenco:', len(elenco), 'vetrini')
