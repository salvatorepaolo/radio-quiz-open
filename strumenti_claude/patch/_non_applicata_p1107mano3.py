import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1107mano')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)

# riquadri in cui l'utente ha scelto una serie (clic nella lista o trascinamento): la disposizione non li tocca
sost("  l.addEventListener('click', (e) => { const b = e.target.closest('.s'); if (b && !b.disabled) selezionaSerie(+b.dataset.i); });",
     "  l.addEventListener('click', (e) => { const b = e.target.closest('.s'); if (b && !b.disabled) { V.manoRiq?.add(V.attivo); selezionaSerie(+b.dataset.i); } });")
sost("    V.sopra = null; attiva(k); await selezionaSerie(+si, k); T.trascinate",
     "    V.sopra = null; attiva(k); V.manoRiq?.add(k); await selezionaSerie(+si, k); T.trascinate")
sost("  const gen = V.genCaso = (V.genCaso || 0) + 1, vecchia = () => gen !== V.genCaso;",
     """  const gen = V.genCaso = (V.genCaso || 0) + 1, vecchia = () => gen !== V.genCaso;
  // l'utente può scegliere una serie mentre la disposizione si sta ancora caricando: quel riquadro resta suo
  const mano = V.manoRiq = new Set(), suo = (k) => mano.has(k);""")
sost("""    for (let k = 0; k < auto.length; k++) {
      await selezionaSerie(auto[k].si, k); if (vecchia()) return;""",
     """    for (let k = 0; k < auto.length; k++) {
      if (suo(k)) continue;
      await selezionaSerie(auto[k].si, k); if (vecchia()) return;""")
sost("""    V.attivo = 0; evidenziaSerie(); disegna();
    try { if (V.sincro) await sincronizzaDa(0); } catch {}""",
     """    if (!mano.size) V.attivo = 0;
    evidenziaSerie(); disegna();
    try { if (V.sincro) await sincronizzaDa(V.attivo); } catch {}""")
sost("""  if (disp.length && !window.matchMedia('(max-width: 700px)').matches) {
    await selezionaSerie(disp[0], 0); if (vecchia()) return;
    if (disp.length > 1) {
      V.n = disp.length; $('#riquadri').value = String(V.n); $('#sincro-wrap').hidden = false;
      for (let k = 1; k < disp.length; k++) { await selezionaSerie(disp[k], k); if (vecchia()) return; }
      V.attivo = 0; evidenziaSerie(); disegna();
    }""",
     """  if (disp.length && !window.matchMedia('(max-width: 700px)').matches) {
    if (!suo(0)) { await selezionaSerie(disp[0], 0); if (vecchia()) return; }
    if (disp.length > 1) {
      V.n = disp.length; $('#riquadri').value = String(V.n); $('#sincro-wrap').hidden = false;
      for (let k = 1; k < disp.length; k++) { if (suo(k)) continue; await selezionaSerie(disp[k], k); if (vecchia()) return; }
      if (!mano.size) V.attivo = 0;
      evidenziaSerie(); disegna();
    }""")
sost("    await selezionaSerie(Math.max(0, i), 0, { idx: 0 });\n    aggiornaFusioneUI(); aggiornaSottrazioneUI();",
     "    if (!suo(0)) await selezionaSerie(Math.max(0, i), 0, { idx: 0 });\n    aggiornaFusioneUI(); aggiornaSottrazioneUI();")
sost("  await selezionaSerie(iniziale, 0, { idx: n > 1 && V.serie[iniziale].files.length <= 8 ? 0 : undefined }); if (vecchia()) return;",
     "  if (!suo(0)) { await selezionaSerie(iniziale, 0, { idx: n > 1 && V.serie[iniziale].files.length <= 8 ? 0 : undefined }); if (vecchia()) return; }")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
