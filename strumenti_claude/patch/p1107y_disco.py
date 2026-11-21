import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1107y')
s = open(A, encoding='utf-8').read()
a = "async function leggiDisco(u) { const d = await dirDisco(); if (!d) return null; try { return await (await (await d.getFileHandle(nomeDisco(u))).getFile()).arrayBuffer(); } catch { return null; } }"
b = """// un file che si sta ancora scrivendo è vuoto (getFileHandle con create lo crea subito, il contenuto arriva alla chiusura): non si legge
async function leggiDisco(u) { if (DISCO.inScrittura?.has(u)) return null; const d = await dirDisco(); if (!d) return null;
  try { const b = await (await (await d.getFileHandle(nomeDisco(u))).getFile()).arrayBuffer(); return b.byteLength > 132 ? b : null; } catch { return null; } }"""
assert s.count(a) == 1; s = s.replace(a, b)
a = """  try { const h = await d.getFileHandle(nomeDisco(u), { create: true }), w = await h.createWritable(); await w.write(b); await w.close(); } catch { return; }"""
b = """  (DISCO.inScrittura ||= new Set()).add(u);
  try { const h = await d.getFileHandle(nomeDisco(u), { create: true }), w = await h.createWritable(); await w.write(b); await w.close(); } catch { return; } finally { DISCO.inScrittura.delete(u); }"""
assert s.count(a) == 1; s = s.replace(a, b)
open(A, 'w', encoding='utf-8').write(s)
print('ok')
