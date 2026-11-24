# patch_badge.py: l'etichetta dell'archivio sulla carta del caso dice l'archivio vero («Archivio TCIA» solo per TCIA,
# altrimenti «Archivio pubblico»: IDC, GDC, figshare, Mendeley, Zenodo…). Il filtro per origine resta com'era.
import sys, json
R = sys.argv[1]
p = R + '/web/app.js'; s = open(p, encoding='utf-8').read()
a = "${origineDi(c) === 'TCIA' ? '<span class=\"badge tcia\" title=\"Immagini da The Cancer Imaging Archive (licenza CC BY)\">📚 Archivio TCIA</span>' : ''}"
b = "${origineDi(c) === 'TCIA' ? (c.origine === 'TCIA' ? '<span class=\"badge tcia\" title=\"Immagini da The Cancer Imaging Archive (licenza CC BY)\">📚 Archivio TCIA</span>' : '<span class=\"badge tcia\" title=\"Immagini da un archivio pubblico con licenza aperta (fonte completa dopo la risposta)\">📚 Archivio pubblico</span>') : ''}"
assert s.count(a) == 1; open(p, 'w', encoding='utf-8').write(s.replace(a, b))
q = R + '/web/lingua/en.json'; t = open(q, encoding='utf-8').read().rstrip(); d = json.loads(t)
nuovi = {'📚 Archivio pubblico': '📚 Public archive', 'Immagini da un archivio pubblico con licenza aperta (fonte completa dopo la risposta)': 'Images from a public archive with an open licence (full source after the answer)'}
agg = {k: v for k, v in nuovi.items() if k not in d}
if agg:
    t = t[:-1] + ''.join(',' + json.dumps(k, ensure_ascii=False) + ':' + json.dumps(v, ensure_ascii=False) for k, v in agg.items()) + '}'
    json.loads(t); open(q, 'w', encoding='utf-8').write(t)
print('ok', len(agg))
