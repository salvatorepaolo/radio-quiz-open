import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1108apri')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)

# lettura dei file dalle maniglie salvate: avanzamento visibile, errori chiari, avviso se la cartella non risponde
sost("""async function fileDaManiglie(lista) {
  const out = [];
  const giro = async (h, base) => {
    if (h.kind === 'file') { const f = await h.getFile(); f._percorso = base + f.name; out.push(f); return; }
    for await (const x of h.values()) await giro(x, base + h.name + '/');
  };
  for (const h of lista) await giro(h, '');
  return out;
}""", """async function fileDaManiglie(lista, avanza) {
  const out = []; let ultimo = 0;
  const giro = async (h, base) => {
    if (h.kind === 'file') {
      const f = await h.getFile(); f._percorso = base + f.name; out.push(f);
      if (avanza && Date.now() - ultimo > 250) { ultimo = Date.now(); avanza(out.length); }
      return;
    }
    for await (const x of h.values()) await giro(x, base + h.name + '/');
  };
  try { for (const h of lista) await giro(h, ''); }
  catch (e) {
    if (/NotFound|NotReadable|could not be found|not be read/i.test(`${e.name} ${e.message}`)) throw new Error('file non trovati o non leggibili: la cartella è stata spostata, il disco o il CD non è collegato, oppure il disco di rete non risponde');
    throw e;
  }
  return out;
}""")
sost("""    $('#cl-stato').textContent = 'Apro l\\'esame…';
    const f = await fileDaManiglie(v.maniglie); if (!f.length) throw new Error('file non trovati (cartella spostata o disco scollegato)');""",
"""    const st = $('#cl-stato'); st.className = 'stato'; st.textContent = 'Apro l\\'esame: leggo l\\'elenco dei file…';
    // disco esterno in standby, CD lento o disco di rete: dopo 15 secondi senza risposta lo si dice
    const lento = setTimeout(() => { if (/leggo/.test(st.textContent)) st.textContent += ' (la cartella risponde lentamente: disco esterno in standby, CD o disco di rete? Attendi o ricollega il disco)'; }, 15000);
    let f;
    try { f = await fileDaManiglie(v.maniglie, (n) => { st.textContent = `Apro l'esame: leggo i file (${n})…`; }); }
    finally { clearTimeout(lento); }
    if (!f.length) throw new Error('file non trovati (cartella spostata o disco scollegato)');
    st.textContent = `Apro l'esame: ${f.length} file…`;""")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
