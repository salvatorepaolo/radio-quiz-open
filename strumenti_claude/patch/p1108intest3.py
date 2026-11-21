import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1108intest')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)

# archivio locale: nuovo contenitore con le intestazioni già lette (resta su questo computer, come l'elenco degli esami)
sost("    const r = indexedDB.open('rq-client', 2);\n    r.onupgradeneeded = () => { for (const n of ['ultimo', 'archivio', 'cartella', 'indice'])",
     "    const r = indexedDB.open('rq-client', 3);\n    r.onupgradeneeded = () => { for (const n of ['ultimo', 'archivio', 'cartella', 'indice', 'intestazioni'])")

sost("""  await aGruppi(files, 6, async (f) => {
    // solo l'intestazione (primo MB); il file intero se l'intestazione è più lunga
    let info = analizza(await f.slice(0, 1 << 20).arrayBuffer(), { intestazione: true });
    if (info.escluso === 'non è un file DICOM' && f.size > 1 << 20) info = analizza(await f.arrayBuffer(), { intestazione: true });""",
"""  // esame già aperto su questo computer: le intestazioni lette l'altra volta (stessi file: percorso, dimensione e data
  // di modifica) si riusano e l'esame si apre senza rileggerle
  const chiaveF = (f) => `${percorsoDi(f)}|${f.size}|${f.lastModified || 0}`;
  const firmaEs = files.length >= 20 ? `${files.length}|${files.reduce((a, f) => a + f.size, 0)}|${chiaveF(files[0])}|${chiaveF(files[files.length - 1])}` : null;
  const giaLette = firmaEs ? await dbCl('intestazioni', 'get', firmaEs).catch(() => null) : null, nuoveLette = {};
  if (giaLette) st(`Esame già aperto su questo computer: preparo le serie (${files.length} file)…`);
  await aGruppi(files, 12, async (f) => {
    let info = giaLette?.info?.[chiaveF(f)];
    if (!info) {
      // solo l'intestazione: prima 64 kB (basta quasi sempre: una TC da 512 kB si legge per un ottavo, utile con dischi
      // esterni, CD e dischi di rete lenti), se l'intestazione è più lunga il primo MB, poi il file intero
      if (f.size > 65536) {
        const b = await f.slice(0, 65536).arrayBuffer();
        let finita = false; try { finita = !!dicomParser.parseDicom(new Uint8Array(b), { untilTag: 'x7fe00010' }).elements.x7fe00010; } catch {}
        if (finita) info = analizza(b, { intestazione: true });
      }
      if (!info) info = analizza(await f.slice(0, 1 << 20).arrayBuffer(), { intestazione: true });
      if (info.escluso === 'non è un file DICOM' && f.size > 1 << 20) info = analizza(await f.arrayBuffer(), { intestazione: true });
      if (firmaEs) nuoveLette[chiaveF(f)] = info;
    }""")
sost("""    if (++fatti % 20 === 0 || fatti === files.length) st(`Lettura delle intestazioni: ${fatti} / ${files.length}` + barra(fatti / files.length));
  });""", """    ++fatti; if (!giaLette && (fatti % 20 === 0 || fatti === files.length)) st(`Lettura delle intestazioni: ${fatti} / ${files.length}` + barra(fatti / files.length));
  });
  if (firmaEs && !giaLette && Object.keys(nuoveLette).length) {
    try {
      await dbCl('intestazioni', 'put', firmaEs, { quando: Date.now(), info: nuoveLette });
      // al massimo 20 esami ricordati: si tolgono i più vecchi
      const el = ((await dbCl('intestazioni', 'get', '_elenco')) || []).filter((x) => x !== firmaEs); el.push(firmaEs);
      while (el.length > 20) await dbCl('intestazioni', 'del', el.shift());
      await dbCl('intestazioni', 'put', '_elenco', el);
    } catch (e) { console.warn('intestazioni non ricordate', e); }
  }""")
# «Svuota» e spegnere gli esami recenti cancellano anche le intestazioni ricordate
sost("if (!r.checked) await dbCl('archivio', 'svuota').catch(() => {}); mostraArchivio(); };", "if (!r.checked) { await dbCl('archivio', 'svuota').catch(() => {}); await dbCl('intestazioni', 'svuota').catch(() => {}); } mostraArchivio(); };")
sost("$('#cl-rec-svuota').onclick = async () => { await dbCl('archivio', 'svuota').catch(() => {}); mostraArchivio(); };", "$('#cl-rec-svuota').onclick = async () => { await dbCl('archivio', 'svuota').catch(() => {}); await dbCl('intestazioni', 'svuota').catch(() => {}); mostraArchivio(); };")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
