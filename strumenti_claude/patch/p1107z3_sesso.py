import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1107z3')
s = open(A, encoding='utf-8').read()
a = "  const r = [], sesso = { M: 'M', F: 'F', O: 'altro' }[e.sesso?.toUpperCase()] || '';"
b = """  // il sesso: dal DICOM (client) o, nei casi pubblici anonimizzati, dall'anamnesi del caso («Donna di 22 anni…»)
  const an = (V.caso?.anamnesi || '').trim().slice(0, 80);
  const sessoCaso = /^(donna|ragazza|bambina|neonata|signora|paziente (di sesso )?femmin)/i.test(an) ? 'F' : /^(uomo|ragazzo|bambino|neonato|signore|paziente (di sesso )?maschi)/i.test(an) ? 'M' : '';
  const r = [], sesso = { M: 'M', F: 'F', O: 'altro' }[e.sesso?.toUpperCase()] || sessoCaso;"""
assert s.count(a) == 1; s = s.replace(a, b)
a = "  if (e.mdc) t.push(`mdc: ${e.mdc}`);"
b = "  if (e.mdc) t.push(/^(contrast[oe]?|yes|si|sì|c\\+?|\\+c|iv|mdc|y)$/i.test(e.mdc) ? 'con mdc' : /^(no|none|nessuno|n|-)$/i.test(e.mdc) ? '' : `mdc: ${e.mdc}`);"
assert s.count(a) == 1; s = s.replace(a, b)
open(A, 'w', encoding='utf-8').write(s)
print('ok')
