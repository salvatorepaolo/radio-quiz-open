import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1108timeout')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)

sost("""  await aGruppi(files, 12, async (f) => {
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
    }""",
"""  // solo l'intestazione: prima 64 kB (basta quasi sempre: una TC da 512 kB si legge per un ottavo, utile con dischi
  // esterni, CD e dischi di rete lenti), se l'intestazione è più lunga il primo MB, poi il file intero
  const leggiIntestazione = async (f) => {
    let info = null;
    if (f.size > 65536) {
      const b = await f.slice(0, 65536).arrayBuffer();
      let finita = false; try { finita = !!dicomParser.parseDicom(new Uint8Array(b), { untilTag: 'x7fe00010' }).elements.x7fe00010; } catch {}
      if (finita) info = analizza(b, { intestazione: true });
    }
    if (!info) info = analizza(await f.slice(0, 1 << 20).arrayBuffer(), { intestazione: true });
    if (info.escluso === 'non è un file DICOM' && f.size > 1 << 20) info = analizza(await f.arrayBuffer(), { intestazione: true });
    return info;
  };
  // un file che non si riesce a leggere (disco che non risponde, file solo nel cloud, CD rovinato) non blocca l'apertura:
  // dopo 20 secondi si salta e si dice quanti sono
  const NON_LETTO = 'file non letti in tempo (disco lento o file non scaricato dal cloud)';
  const conLimite = (f) => Promise.race([leggiIntestazione(f).catch(() => ({ escluso: NON_LETTO })), new Promise((ok) => setTimeout(() => ok({ escluso: NON_LETTO }), 20000))]);
  await aGruppi(files, 12, async (f) => {
    let info = giaLette?.info?.[chiaveF(f)];
    if (!info) {
      info = await conLimite(f);
      if (firmaEs && info.escluso !== NON_LETTO) nuoveLette[chiaveF(f)] = info;
    }""")
sost("""    if (info.escluso && /non è un file|senza immagine|big endian|referto strutturato/.test(info.escluso)) { esclusi[info.escluso] = (esclusi[info.escluso] || 0) + 1; }""",
     """    if (info.escluso && /non è un file|senza immagine|big endian|referto strutturato|non letti in tempo/.test(info.escluso)) { esclusi[info.escluso] = (esclusi[info.escluso] || 0) + 1; }""")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
