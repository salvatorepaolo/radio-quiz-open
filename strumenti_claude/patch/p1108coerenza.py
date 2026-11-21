import shutil, json, re
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
M = '/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js'
F = {n: W + n for n in ['app.js', 'index.html', 'aiuto.json', 'lingua/en/aiuto.json', 'manuale-client.html', 'manuale-client.en.html', 'lingua/en.json']}
F['mpr'] = M
for f in F.values(): shutil.copy(f, f + '.bak_1108coerenza')
T = {k: open(f, encoding='utf-8').read() for k, f in F.items()}
def sost(k, a, b, n=1):
    assert T[k].count(a) == n, (k, a[:110], T[k].count(a)); T[k] = T[k].replace(a, b)

# ---------------- app.js
A = 'app.js'
# RECIST automatico dal volume: una sola misura (diametro massimo), come lo strumento
sost(A, "(V.misure[key] = V.misure[key] || []).push({ tipo: 'recist', a: rc.a, b: rc.b, c: rc.c, d: rc.d, auto: true }); v.recist = rc;",
        "(V.misure[key] = V.misure[key] || []).push({ tipo: 'recist', a: rc.a, b: rc.b, auto: true, sp: [im0.spCol, im0.spRow] }); v.recist = rc;")
sost(A, "avvisoBreve(`Volume ${virgola(r.vol, 2)} cm³ · RECIST ${virgola(rc.lung, 1)} × ${virgola(rc.corto, 1)} mm (immagine ${rc.j + 1}), aggiunto come misura: controllalo e correggilo se serve.`)",
        "avvisoBreve(`Volume ${virgola(r.vol, 2)} cm³ · RECIST ${virgola(rc.lung, 1)} mm di diametro massimo (immagine ${rc.j + 1}), aggiunto come misura: controllalo e correggilo se serve.`)")
sost(A, "// RECIST dallo stesso contorno: asse lungo nella sezione dove è massimo, asse corto perpendicolare; entra come misura RECIST",
        "// RECIST 1.1 dallo stesso contorno: diametro massimo nella sezione dove è più grande; entra come misura RECIST")
sost(A, "RECIST ${virgola(v.recist.lung, 1)} × ${virgola(v.recist.corto, 1)} mm (img ${v.recist.j + 1})",
        "RECIST ${virgola(v.recist.lung, 1)} mm (img ${v.recist.j + 1})")
# la misura RECIST ricorda la spaziatura dei pixel: serve alla somma dei diametri nella scala RECIST 1.1
sost(A, "      if (lungo) { salvaMisura(m.k, { tipo: 'recist', a: m.a, b: m.b, ...(m.linfonodo ? { linfonodo: true } : {}) }); T.misure++; }",
        "      if (lungo) { const im = vistaDi(P(m.k)); salvaMisura(m.k, { tipo: 'recist', a: m.a, b: m.b, ...(m.linfonodo ? { linfonodo: true } : {}), ...(im?.spCol ? { sp: [im.spCol, im.spRow] } : {}) }); T.misure++; }")
sost(A, "function misureRecist(m, img) {", """// somma dei diametri RECIST 1.1 dell'esame del riquadro attivo: le misure RECIST (diametro massimo delle lesioni,
// asse corto dei linfonodi), al massimo 5
function sommaMisureRecist() {
  const st = studioDi(V.serie[P(V.attivo)?.sIdx])?.id, l = [];
  for (const [key, ms] of Object.entries(V.misure)) {
    const si = +key.split(':')[0], s = V.serie[si]; if (!s || studioDi(s)?.id !== st) continue;
    for (const m of ms) { if (m.tipo !== 'recist' || !m.a || !m.b) continue;
      const sp = m.sp || (() => { const p = Array.from({ length: V.n || 1 }, (_, j) => P(j)).find((x) => x?.sIdx === si && x.img); const im = p && vistaDi(p); return im ? [im.spCol, im.spRow] : null; })();
      if (sp) l.push(Math.hypot((m.b.x - m.a.x) * sp[0], (m.b.y - m.a.y) * sp[1])); }
  }
  if (!l.length) return null;
  const usate = l.sort((a, b) => b - a).slice(0, 5);
  return { somma: usate.reduce((a, x) => a + x, 0), n: usate.length, oltre: l.length > 5 };
}
function misureRecist(m, img) {""")
# l'ultima distanza proposta dalle scale: anche dal RECIST
sost(A, "  if (m.tipo === 'linea' && p.img) V.ultimaLinea = Math.hypot(", "  if ((m.tipo === 'linea' || (m.tipo === 'recist' && !m.d)) && p.img) V.ultimaLinea = Math.hypot(")
sost(A, "  if (m.tipo === 'linea' && P(k).img) V.ultimaLinea = Math.hypot(", "  if ((m.tipo === 'linea' || (m.tipo === 'recist' && !m.d)) && P(k).img) V.ultimaLinea = Math.hypot(")
sost(A, "title=\"Usa l'ultima distanza misurata con il righello\"", "title=\"Usa l'ultima distanza misurata con il righello o il RECIST\"")
# scala RECIST 1.1: la somma attuale si prende dalle misure RECIST dell'esame
sost(A, "    const pennello = {};\n    for (const c of S.campi) if (MAPPA(c) && prima[c.id]) mappe[c.id] = prima[c.id];",
        "    const pennello = {}, SR = k === 'recist' ? sommaMisureRecist() : null;\n    for (const c of S.campi) if (MAPPA(c) && prima[c.id]) mappe[c.id] = prima[c.id];")
sost(A, "style=\"width:90px\"> mm ${V.ultimaLinea ?",
        "style=\"width:90px\"> mm ${SR && c.id === 'sa' ? `<button type=\"button\" class=\"ghost piccolo\" data-somma=\"${c.id}\" title=\"Somma dei diametri delle misure RECIST di questo esame (le 5 più grandi)\">⟵ Σ RECIST ${virgola(SR.somma, 1)} mm (${SR.n} ${SR.n === 1 ? 'misura' : 'misure'}${SR.oltre ? ', le 5 più grandi' : ''})</button> ` : ''}${V.ultimaLinea ?")
sost(A, "    $('#scala-corpo').querySelectorAll('[data-ultima]').forEach((b) => b.onclick = () => {",
        "    $('#scala-corpo').querySelectorAll('[data-somma]').forEach((b) => b.onclick = () => { $(`#scala-corpo input[data-c=\"${b.dataset.somma}\"]`).value = SR.somma.toFixed(1); leggi(); });\n    $('#scala-corpo').querySelectorAll('[data-ultima]').forEach((b) => b.onclick = () => {")
# RECIST a una misura anche nelle esportazioni (annotazioni GSPS e DICOM SR): prima mancava
sost(A, "    testo(m.tipo === 'recist' ? `${mm(m.a, m.b).toFixed(1)} × ${mm(m.c, m.d).toFixed(1)} mm` : (fraseMisura(m, img, idx, si) || '').slice(0, 64), m.b);\n  }",
        "    testo(m.tipo === 'recist' ? `${mm(m.a, m.b).toFixed(1)} × ${mm(m.c, m.d).toFixed(1)} mm` : (fraseMisura(m, img, idx, si) || '').slice(0, 64), m.b);\n  } else if (m.tipo === 'recist' && m.a && m.b) { linea(m.a, m.b); testo(`RECIST ${mm(m.a, m.b).toFixed(1)} mm${m.linfonodo ? ' (asse corto)' : ''}`, m.b); }")
sost(A, "  if (m.tipo === 'angolo' && m.c) return [{ nome: 'Angolo',",
        "  if (m.tipo === 'recist' && m.a && m.b) return [{ nome: m.linfonodo ? 'RECIST linfonodo' : 'RECIST', valori: [{ codice: m.linfonodo ? ['103340004', 'SCT', 'Short Axis'] : ['103339001', 'SCT', 'Long Axis'], valore: mm(m.a, m.b), unita: MM }], grafici }];\n  if (m.tipo === 'angolo' && m.c) return [{ nome: 'Angolo',")
# MPR: frase nel referto con il criterio RECIST 1.1
sost(A, "return `reperto di ${mm(st.length)}${Number.isFinite(st.width) ? ` × ${mm(st.width)}` : ''} mm (${piano(m)})`;",
        "return `lesione di ${mm(st.length)} mm di diametro massimo${Number.isFinite(st.width) ? ` (asse corto ${mm(st.width)} mm)` : ''} (${piano(m)})`;")
# elenco dei tasti: i comandi nuovi
sost(A, "+ r('Alt + clic', 'Punto collegato negli altri riquadri')",
        "+ r('K · B + clic', 'Immagine chiave (B + clic: dell\\'immagine cliccata)') + r('T', 'Freccia con testo') + r('Ctrl/⌘ + clic su una serie', 'La apre in un nuovo riquadro') + r('✕ del riquadro', 'Chiude il riquadro, gli altri si allargano')\n      + r('Alt + clic', 'Punto collegato negli altri riquadri')")

# ---------------- index.html
H = 'index.html'
VECCHIO_MPR = 'RECIST: asse lungo e asse corto perpendicolare, anche sui piani obliqui (con volume ellissoide stimato)'
NUOVO_MPR = 'RECIST 1.1, anche sui piani obliqui: diametro massimo della lesione (bersaglio ≥ 10 mm) e asse corto, quello dei linfonodi (bersaglio ≥ 15 mm)'
sost(H, VECCHIO_MPR, NUOVO_MPR, T[H].count(VECCHIO_MPR))
VECCHIO_TAB = "Nome, data di nascita e codice del paziente sulla linguetta dell'esame, sopra le serie (solo su questo schermo: mai nelle esportazioni)"
NUOVO_TAB = "Nome, data di nascita con l'età all'esame e sesso del paziente sulla linguetta dell'esame (solo su questo schermo: mai nelle esportazioni)"
sost(H, VECCHIO_TAB, NUOVO_TAB)
m = re.search(r'<p class="aiuto" id="aiuto-2d">(.*?)</p>', T[H], re.S); VECCHIO_AIUTO = m.group(1)
NUOVO_AIUTO = VECCHIO_AIUTO.replace('Spazio cine · ', 'Spazio cine · T freccia · K o B + clic: immagine chiave · Ctrl/⌘ + clic su una serie: nuovo riquadro · ✕ in alto a sinistra: chiudi il riquadro · ')
assert NUOVO_AIUTO != VECCHIO_AIUTO
sost(H, VECCHIO_AIUTO, NUOVO_AIUTO)

# ---------------- MPR (Cornerstone): RECIST 1.1
sost('mpr', """// RECIST (bidimensionale) anche sui piani MPR e obliqui: asse lungo, asse corto perpendicolare, volume ellissoide stimato
function righeRecist(data, targetId) {
  const st = data.cachedStats?.[targetId] || {}, L = st.length, W = st.width;
  if (!Number.isFinite(L)) return [];
  const out = [`Asse lungo ${L.toFixed(1)} mm`];
  if (Number.isFinite(W)) { out.push(`Asse corto ${W.toFixed(1)} mm · ${(L * W / 100).toFixed(1)} cm²`); out.push(`Volume stimato ≈ ${(Math.PI / 6 * L * W * W / 1000).toFixed(1)} cm³`); }
  return out;
}""", """// RECIST 1.1 anche sui piani MPR e obliqui: diametro massimo (lesioni, bersaglio ≥ 10 mm) e asse corto (linfonodi, bersaglio ≥ 15 mm)
function righeRecist(data, targetId) {
  const st = data.cachedStats?.[targetId] || {}, L = st.length, W = st.width;
  if (!Number.isFinite(L)) return [];
  const out = [`RECIST · diametro max ${L.toFixed(1)} mm ${L >= 10 ? '(bersaglio)' : '(< 10 mm)'}`];
  if (Number.isFinite(W)) out.push(`se linfonodo: asse corto ${W.toFixed(1)} mm ${W >= 15 ? '(bersaglio)' : W >= 10 ? '(non bersaglio)' : '(non patologico)'}`);
  return out;
}""")

# ---------------- aiuto (IT ed EN)
AI, AE = 'aiuto.json', 'lingua/en/aiuto.json'
sost(AI, '"RECIST: asse lungo e asse corto perpendicolare; in TC e RM anche la stima del volume."',
 '"RECIST 1.1: una sola misura. Lesione: diametro massimo (bersaglio se ≥ 10 mm, o il doppio dello spessore di strato se è più di 5 mm); un secondo clic sul pulsante RECIST passa ai linfonodi: asse corto (bersaglio ≥ 15 mm, 10-14 mm patologico non bersaglio, < 10 mm normale), un altro clic torna alle lesioni. Al massimo 5 bersagli, 2 per organo: la scelta è tua. La somma dei diametri si porta nella scala Σ RECIST 1.1 con un clic.",\n      "🤖 Confronto con l\'esame precedente (con un esame precedente aperto): nelle TC del torace analizzate dall\'IA, la tabella dei noduli prima e dopo (diametro, volume, tempo di raddoppio, crescita Lung-RADS, RECIST), che nei casi a quiz si vede dopo la risposta; negli altri esami e nel visualizzatore scaricabile, «＋ Aggiungi lesione» e un clic sulla lesione nell\'esame attuale: il volume si misura da solo, la lesione si ritrova nell\'altro esame e si misura anche lì. Sono stime da controllare sulle immagini; «Copia nel referto» porta il confronto nel referto."')
sost(AE, '"RECIST: long axis and perpendicular short axis; in CT and MRI also the volume estimate."',
 '"RECIST 1.1: a single measurement. Lesion: longest diameter (target if ≥ 10 mm, or twice the slice thickness if it is more than 5 mm); a second click on the RECIST button switches to lymph nodes: short axis (target ≥ 15 mm, 10-14 mm pathological non-target, < 10 mm normal), another click goes back to lesions. At most 5 targets, 2 per organ: you choose them. The sum of diameters goes into the Σ RECIST 1.1 scale with one click.",\n      "🤖 Comparison with the prior exam (with a prior exam open): in chest CTs analyzed by the AI, the table of nodules before and after (diameter, volume, doubling time, Lung-RADS growth, RECIST), which in quiz cases is shown after the answer; in the other exams and in the downloadable viewer, “＋ Add lesion” and a click on the lesion in the current exam: the volume is measured automatically, the lesion is found in the other exam and measured there too. These are estimates to be checked on the images; “Copy to report” brings the comparison into the report."')
sost(AI, 'RECIST (asse lungo e asse corto perpendicolare, anche sui piani obliqui, con il volume ellissoide stimato)', 'RECIST 1.1 (anche sui piani obliqui: diametro massimo della lesione e asse corto, quello da usare per i linfonodi)')
sost(AE, 'RECIST (long axis and perpendicular short axis, also on oblique planes, with the estimated ellipsoid volume)', 'RECIST 1.1 (also on oblique planes: longest diameter of the lesion and short axis, the one to use for lymph nodes)')
sost(AI, 'in TC 1 polmone, 2 mediastino, 3 osso, 4 encefalo, 5 addome, 6 fegato, 0 finestra originale', 'in TC 1 addome, 2 polmone, 3 osso, 4 encefalo, 5 angio, 6 mediastino, 7 fegato, 0 automatica (si cambiano con ⚙ Personalizza finestre e tasti)')
sost(AE, 'in CT 1 lung, 2 mediastinum, 3 bone, 4 brain, 5 abdomen, 6 liver, 0 original window', 'in CT 1 abdomen, 2 lung, 3 bone, 4 brain, 5 angio, 6 mediastinum, 7 liver, 0 automatic (they can be changed with ⚙ Customize windows and keys)')
sost(AI, 'Ruota di 90° (tasto R; Maiusc+R in senso antiorario)', 'Ruota di 90° (pulsante della barra; Maiusc + clic in senso antiorario)')
sost(AE, 'Rotate 90° (R key; Shift+R counterclockwise)', 'Rotate 90° (toolbar button; Shift + click counterclockwise)')
sost(AI, 'Freccia con nota e 📸 Chiave (tasto K): segnano le immagini che giustificano la risposta. Le immagini chiave compaiono nella striscia sotto le immagini (con la didascalia da scrivere,',
         'Freccia con nota (tasto T) e 📸 Chiave (tasto K, oppure B + clic sull\'immagine): segnano le immagini che giustificano la risposta. Le immagini chiave compaiono nella striscia sotto le immagini (un clic sulla miniatura riporta a quell\'immagine con la sua finestra; la didascalia da scrivere,')
sost(AE, 'Arrow with annotation and 📸 Key (K key): mark the images that justify the answer. Key images appear in the strip below the images (with a caption to write,',
         'Arrow with annotation (T key) and 📸 Key (K key, or B + click on the image): mark the images that justify the answer. Key images appear in the strip below the images (a click on the thumbnail goes back to that image with its window; a caption to write,')
sost(AI, "I diametri si scrivono o si prendono dall'ultima misura fatta con il righello; il risultato, con la categoria e l'indicazione, si copia nel referto libero con un clic.",
         "I diametri si scrivono o si prendono dall'ultima misura fatta con il righello o il RECIST (nella RECIST 1.1 la somma attuale si prende con un clic dalle misure RECIST dell'esame); il risultato, con la categoria, l'indicazione e i dati inseriti, si copia nel referto con un clic.")
sost(AE, "Diameters are typed or taken from the last measurement made with the ruler; the result, with the category and the recommendation, is copied into the free-text report with a click.",
         "Diameters are typed or taken from the last measurement made with the ruler or RECIST (in RECIST 1.1 the current sum is taken with one click from the exam's RECIST measurements); the result, with the category, the recommendation and the data entered, is copied into the report with a click.")
sost(AI, 'quelli su piani diversi mostrano la linea di riferimento."', 'quelli su piani diversi mostrano la linea di riferimento. Ctrl + clic (⌘ + clic sul Mac) su una serie la apre in un nuovo riquadro; la ✕ in alto a sinistra di un riquadro lo chiude e gli altri si allargano."')
sost(AE, 'those on different planes show the reference line."', 'those on different planes show the reference line. Ctrl + click (⌘ + click on Mac) on a series opens it in a new viewport; the ✕ at the top left of a viewport closes it and the others widen."')
sost(AI, 'con la serie più simile;', 'con la serie dello stesso tipo e piano (per esempio T2 assiale con T2 assiale);')
sost(AE, 'with the most similar series;', 'with the series of the same type and plane (for example axial T2 with axial T2);')
sost(AI, "«⧉ Finestra separata» (Chrome ed Edge) lo apre in un'altra finestra, anche su un altro schermo, mentre scorri le immagini.",
         "«⧉ Finestra separata» lo apre in un'altra finestra, anche su un altro schermo, con la stessa disposizione (dati a sinistra, referto a destra), mentre scorri le immagini; ⛶ la mette a schermo intero. Se il browser blocca le finestre popup, il referto si affianca alle immagini.")
sost(AE, "“⧉ Separate window” (Chrome and Edge) opens it in another window, even on another screen, while you scroll the images.",
         "“⧉ Separate window” opens it in another window, even on another screen, with the same layout (data on the left, report on the right), while you scroll the images; ⛶ makes it full screen. If the browser blocks pop-up windows, the report is placed next to the images.")
for k in (AI, AE): json.loads(T[k])

# ---------------- manuale del visualizzatore scaricabile (IT ed EN)
MI, ME = 'manuale-client.html', 'manuale-client.en.html'
sost(MI, "      <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Annulla (misure)</td></tr>",
 "      <tr><td><kbd>T</kbd> · <kbd>B</kbd> + clic</td><td>Freccia con testo · immagine chiave dell'immagine cliccata</td></tr>\n      <tr><td>Ctrl + clic (⌘ + clic sul Mac) su una serie</td><td>La apre in un nuovo riquadro</td></tr>\n      <tr><td>✕ in alto a sinistra del riquadro</td><td>Chiude il riquadro, gli altri si allargano</td></tr>\n      <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Annulla (misure)</td></tr>")
sost(ME, "      <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Undo (measurements)</td></tr>",
 "      <tr><td><kbd>T</kbd> · <kbd>B</kbd> + click</td><td>Arrow with text · key image of the clicked image</td></tr>\n      <tr><td>Ctrl + click (⌘ + click on Mac) on a series</td><td>Opens it in a new viewport</td></tr>\n      <tr><td>✕ at the top left of the viewport</td><td>Closes the viewport, the others widen</td></tr>\n      <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Undo (measurements)</td></tr>")
sost(MI, "      <li>Distanza, angolo, ROI ellittica, a mano libera o poligonale (media, deviazione, area, HU o SUV), frecce.</li>",
 "      <li>Distanza, angolo, ROI ellittica, a mano libera o poligonale (media, deviazione, area, HU o SUV), frecce.</li>\n      <li><b>RECIST 1.1</b>: una sola misura, il diametro massimo della lesione (bersaglio ≥ 10 mm); un secondo clic sul pulsante RECIST passa ai linfonodi, asse corto (bersaglio ≥ 15 mm). Al massimo 5 bersagli, 2 per organo; la somma si porta nella scala Σ RECIST 1.1 con un clic.</li>")
sost(ME, "      <li>Distance, angle, elliptical, freehand or polygonal ROI (mean, deviation, area, HU or SUV), arrows.</li>",
 "      <li>Distance, angle, elliptical, freehand or polygonal ROI (mean, deviation, area, HU or SUV), arrows.</li>\n      <li><b>RECIST 1.1</b>: a single measurement, the longest diameter of the lesion (target ≥ 10 mm); a second click on the RECIST button switches to lymph nodes, short axis (target ≥ 15 mm). At most 5 targets, 2 per organ; the sum goes into the Σ RECIST 1.1 scale with one click.</li>")
sost(MI, "La fusione sovrappone PET e TC con mappa colore, opacità e soglia regolabili.</p>",
 "La fusione sovrappone PET e TC con mappa colore, opacità e soglia regolabili.</p>\n    <p><b>🤖 Confronto con l'esame precedente</b>: «＋ Aggiungi lesione», poi un clic sulla lesione nell'esame attuale: il volume si misura da solo, la lesione si ritrova nel precedente (allineamento automatico) e si misura anche lì. La tabella dà diametro, volume, tempo di raddoppio, crescita Lung-RADS (nelle TC del torace) e somma RECIST; «Copia nel referto» la porta nel referto. Sono stime da controllare; tutto resta sul computer.</p>\n    <p><b>Confronta con il precedente</b> affianca la serie dello stesso tipo e piano (per esempio T2 assiale con T2 assiale).</p>")
sost(ME, "Fusion overlays PET and CT with an adjustable color map, opacity and threshold.</p>",
 "Fusion overlays PET and CT with an adjustable color map, opacity and threshold.</p>\n    <p><b>🤖 Comparison with the prior exam</b>: “＋ Add lesion”, then a click on the lesion in the current exam: the volume is measured automatically, the lesion is found in the prior (automatic alignment) and measured there too. The table gives diameter, volume, doubling time, Lung-RADS growth (in chest CT) and RECIST sum; “Copy to report” brings it into the report. These are estimates to be checked; everything stays on the computer.</p>\n    <p><b>Compare with prior</b> places side by side the series of the same type and plane (for example axial T2 with axial T2).</p>")
sost(MI, "Premi <b>📸 Chiave</b> o il tasto <kbd>K</kbd>:", "Premi <b>📸 Chiave</b> o il tasto <kbd>K</kbd> (oppure <kbd>B</kbd> + clic sull'immagine):")
sost(ME, "Press <b>📸 Key</b> or the <kbd>K</kbd> key:", "Press <b>📸 Key</b> or the <kbd>K</kbd> key (or <kbd>B</kbd> + click on the image):")

# ---------------- en.json: testi cambiati e testi nuovi senza traduzione
E = json.loads(T['lingua/en.json'])
vecchio_aiuto_en = E.pop(re.sub(r'\s+', ' ', VECCHIO_AIUTO).strip(), None) or E.pop(VECCHIO_AIUTO, None)
assert vecchio_aiuto_en, 'aiuto-2d EN'
E.pop(VECCHIO_MPR, None); E.pop(VECCHIO_TAB, None)
NUOVE = {
  re.sub(r'\s+', ' ', NUOVO_AIUTO).strip(): vecchio_aiuto_en.replace('Space cine · ', 'Space cine · T arrow · K or B + click: key image · Ctrl/⌘ + click on a series: new viewport · ✕ at the top left: close the viewport · ') if 'Space cine · ' in vecchio_aiuto_en else vecchio_aiuto_en + ' · T arrow · K or B + click: key image · Ctrl/⌘ + click on a series: new viewport · ✕ at the top left: close the viewport',
  NUOVO_MPR: 'RECIST 1.1, also on oblique planes: longest diameter of the lesion (target ≥ 10 mm) and short axis, the one for lymph nodes (target ≥ 15 mm)',
  NUOVO_TAB: "Name, date of birth with age at the exam and sex of the patient on the exam tab (only on this screen: never in exports)",
  'RECIST 1.1: una misura. Lesione: diametro massimo (bersaglio ≥ 10 mm). Clicca di nuovo il pulsante per i linfonodi: asse corto (bersaglio ≥ 15 mm). Al massimo 5 bersagli, 2 per organo': 'RECIST 1.1: one measurement. Lesion: longest diameter (target ≥ 10 mm). Click the button again for lymph nodes: short axis (target ≥ 15 mm). At most 5 targets, 2 per organ',
  'RECIST: lesione — misura il diametro massimo (bersaglio ≥ 10 mm)': 'RECIST: lesion — measure the longest diameter (target ≥ 10 mm)',
  "RECIST: linfonodo — misura l'asse corto (bersaglio ≥ 15 mm)": 'RECIST: lymph node — measure the short axis (target ≥ 15 mm)',
  'RECIST · diametro max {x} mm (bersaglio)': 'RECIST · max diameter {x} mm (target)',
  'RECIST · diametro max {x} mm (< 10 mm)': 'RECIST · max diameter {x} mm (< 10 mm)',
  'se linfonodo: asse corto {x} mm (bersaglio)': 'if lymph node: short axis {x} mm (target)',
  'se linfonodo: asse corto {x} mm (non bersaglio)': 'if lymph node: short axis {x} mm (non-target)',
  'se linfonodo: asse corto {x} mm (non patologico)': 'if lymph node: short axis {x} mm (not pathological)',
  'RECIST {x} mm (img {x})': 'RECIST {x} mm (img {x})',
  'Volume {x} cm³ · RECIST {x} mm di diametro massimo (immagine {x}), aggiunto come misura: controllalo e correggilo se serve.': 'Volume {x} cm³ · RECIST {x} mm longest diameter (image {x}), added as a measurement: check it and correct it if needed.',
  "Usa l'ultima distanza misurata con il righello o il RECIST": 'Use the last distance measured with the ruler or RECIST',
  'Somma dei diametri delle misure RECIST di questo esame (le 5 più grandi)': 'Sum of the diameters of the RECIST measurements of this exam (the 5 largest)',
  '⟵ Σ RECIST {x} mm ({x} misura)': '⟵ Σ RECIST {x} mm ({x} measurement)',
  '⟵ Σ RECIST {x} mm ({x} misure)': '⟵ Σ RECIST {x} mm ({x} measurements)',
  '⟵ Σ RECIST {x} mm ({x} misure, le 5 più grandi)': '⟵ Σ RECIST {x} mm ({x} measurements, the 5 largest)',
  "Immagine chiave (B + clic: dell'immagine cliccata)": 'Key image (B + click: of the clicked image)',
  'Freccia con testo': 'Arrow with text',
  'Ctrl/⌘ + clic su una serie': 'Ctrl/⌘ + click on a series',
  'La apre in un nuovo riquadro': 'Opens it in a new viewport',
  '✕ del riquadro': 'Viewport ✕',
  'Chiude il riquadro, gli altri si allargano': 'Closes the viewport, the others widen',
  # confronto con il precedente
  'Confronto IA con il precedente': 'AI comparison with the prior exam',
  "Confronto con l'esame precedente: per ogni lesione volume e diametro prima e dopo, tempo di raddoppio, crescita Lung-RADS e RECIST (stime da verificare)": 'Comparison with the prior exam: for each lesion volume and diameter before and after, doubling time, Lung-RADS growth and RECIST (estimates to be checked)',
  "🤖 Confronto con l'esame precedente": '🤖 Comparison with the prior exam',
  '🤖 Confronto IA con il precedente': '🤖 AI comparison with the prior exam',
  'Clicca': 'Click',
  '＋ Aggiungi lesione': '＋ Add lesion',
  ", poi clicca la lesione (nodulo, massa, linfonodo) nell'": ', then click the lesion (nodule, mass, lymph node) in the',
  'esame attuale': 'current exam',
  ': il programma ne misura il volume, la ritrova negli altri esami (allineamento automatico) e la misura anche lì. Ripeti per ogni lesione.': ': the program measures its volume, finds it in the other exams (automatic alignment) and measures it there too. Repeat for each lesion.',
  "Clicca la lesione nell'immagine…": 'Click the lesion in the image…',
  "Clicca la lesione nell'esame attuale": 'Click the lesion in the current exam',
  "non ritrovata nell'altro esame: apri «Segui nel tempo» dalla lista dei volumi e misurala a mano": 'not found in the other exam: open «Follow over time» from the volume list and measure it by hand',
  '(da verificare)': '(to be checked)',
  'ritrovata con poca sicurezza: controlla': 'found with low confidence: check it',
  '{x} gg': '{x} d',
  'Sotto 400 giorni: crescita sospetta': 'Under 400 days: suspicious growth',
  '▲ crescita': '▲ growth', '▼ ridotta': '▼ reduced', '▼ ridotto': '▼ reduced', '= stabile': '= stable',
  'da valutare': 'to be assessed',
  'Togli dal confronto': 'Remove from the comparison',
  'Volume': 'Volume', 'Lobo': 'Lobe',
  '({x} bersaglio ≥ 10 mm al precedente, al massimo 5): somma {x} → {x} ({x}) →': '({x} target ≥ 10 mm at the prior exam, at most 5): sum {x} → {x} ({x}) →',
  '({x} bersagli ≥ 10 mm al precedente, al massimo 5): somma {x} → {x} ({x}) →': '({x} targets ≥ 10 mm at the prior exam, at most 5): sum {x} → {x} ({x}) →',
  '— al massimo 2 bersagli per organo: scegli tu quali; una lesione nuova fa PD.': '— at most 2 targets per organ: you choose which; a new lesion means PD.',
  'Diametro = massimo della lesione segmentata; crescita Lung-RADS v2022: aumento di più di 1,5 mm; VDT = intervallo × ln2 / ln(V2/V1), sotto 400 giorni crescita sospetta. Stime da verificare sulle immagini.': 'Diameter = maximum of the segmented lesion; Lung-RADS v2022 growth: increase of more than 1.5 mm; VDT = interval × ln2 / ln(V2/V1), under 400 days suspicious growth. Estimates to be checked on the images.',
  'Diametro = massimo della lesione segmentata; crescita Lung-RADS v2022: aumento di più di 1,5 mm (Lung-RADS solo nelle TC del torace); VDT = intervallo × ln2 / ln(V2/V1), sotto 400 giorni crescita sospetta. Stime da verificare sulle immagini.': 'Diameter = maximum of the segmented lesion; Lung-RADS v2022 growth: increase of more than 1.5 mm (Lung-RADS only in chest CT); VDT = interval × ln2 / ln(V2/V1), under 400 days suspicious growth. Estimates to be checked on the images.',
  'Confronto copiato nel referto': 'Comparison copied to the report',
  'nuovo ·': 'new ·', '● nuovo': '● new', '○ non più visto': '○ no longer seen',
  'Il confronto automatico con il precedente si vede dopo la risposta: prima prova da solo a confrontare i due esami.': 'The automatic comparison with the prior exam is shown after the answer: first try comparing the two exams yourself.',
  '{x} → {x} · intervallo {x} mesi · allineamento su {x}/{x} strutture, errore mediano {x} mm': '{x} → {x} · interval {x} months · alignment on {x}/{x} structures, median error {x} mm',
  '{x} → {x} · allineamento su {x}/{x} strutture, errore mediano {x} mm': '{x} → {x} · alignment on {x}/{x} structures, median error {x} mm',
  'Le serie del confronto non sono nel caso': 'The comparison series are not in the case',
  # file non letti e apertura degli esami (client)
  '⚠ {x} file non letti': '⚠ {x} files not read',
  "L'esame si è aperto senza questi file: la lettura non è finita entro 20 secondi. Di solito sono": 'The exam opened without these files: reading did not finish within 20 seconds. They are usually',
  'file di iCloud Drive non scaricati': 'iCloud Drive files not downloaded',
  'sul Mac (con «Ottimizza spazio del Mac» restano solo nel cloud), oppure un disco esterno in standby o un disco di rete lento.': 'to the Mac (with «Optimize Mac Storage» they stay only in the cloud), or an external disk in standby or a slow network disk.',
  'Per iCloud': 'For iCloud',
  ": nel Finder, clic destro sulla cartella dell'esame →": ': in the Finder, right-click the exam folder →',
  'Scarica ora': 'Download Now',
  '(aspetta che sparisca la nuvola), poi «Riprova». Per non avere più il problema: Impostazioni di Sistema → [il tuo nome] → iCloud → iCloud Drive → togli «Ottimizza spazio del Mac», oppure copia gli esami in una cartella fuori da iCloud.': '(wait for the cloud icon to disappear), then «Retry». To avoid the problem: System Settings → [your name] → iCloud → iCloud Drive → turn off «Optimize Mac Storage», or copy the exams to a folder outside iCloud.',
  'Cartella: {x}': 'Folder: {x}', 'Cartelle: {x}': 'Folders: {x}', '(cartella scelta)': '(chosen folder)',
  'Elenco dei file ({x})': 'File list ({x})', '… e altri {x}': '… and {x} more',
  '↻ Riprova': '↻ Retry', "Copia l'elenco": 'Copy the list', 'Elenco copiato': 'List copied', 'Copia non riuscita': 'Copy failed',
  'file non letti in tempo (disco lento o file non scaricato dal cloud)': 'files not read in time (slow disk or file not downloaded from the cloud)',
  'file non trovati o non leggibili: la cartella è stata spostata, il disco o il CD non è collegato, oppure il disco di rete non risponde': 'files not found or not readable: the folder was moved, the disk or CD is not connected, or the network disk is not responding',
  "Apro l'esame: {x} file…": 'Opening the exam: {x} files…',
  "Apro l'esame: leggo l'elenco dei file…": 'Opening the exam: reading the file list…',
  "Apro l'esame: leggo l'elenco dei file… (la cartella risponde lentamente: disco esterno in standby, CD o disco di rete? Attendi o ricollega il disco)": 'Opening the exam: reading the file list… (the folder is responding slowly: external disk in standby, CD or network disk? Wait or reconnect the disk)',
  'Lettura delle intestazioni: {x} / {x}': 'Reading headers: {x} / {x}',
  "Non riesco ad aprire l'esame: {x}": 'Cannot open the exam: {x}',
  'Precedente non aperto: {x}': 'Prior not opened: {x}',
  'Cartella non scelta: {x}': 'Folder not chosen: {x}',
  'Lettura non riuscita: {x}': 'Reading failed: {x}',
  # viewer, referto, linguetta del paziente
  'Al massimo {x} riquadri: chiudine uno con la ✕ in alto a sinistra': 'At most {x} viewports: close one with the ✕ at the top left',
  'Immagine non disponibile: {x}': 'Image not available: {x}',
  'La serie di questa immagine chiave non è aperta': 'The series of this key image is not open',
  'Immagini chiave non salvate: spazio del browser pieno?': 'Key images not saved: browser storage full?',
  'Il browser ha bloccato la finestra: consenti le finestre popup per questo sito. Intanto il referto si affianca.': 'The browser blocked the window: allow pop-up windows for this site. Meanwhile the report is shown next to the images.',
  'Referto · radio-quiz': 'Report · radio-quiz',
  '🗗 Esci da schermo intero': '🗗 Exit full screen',
  'dati paziente sulla linguetta': 'patient data on the tab',
  'Strato del riquadro': 'Viewport slab',
  'Finestra/Livello': 'Window/Level', 'Finestra/Livello (W)': 'Window/Level (W)',
  'gg/mm/aaaa': 'dd/mm/yyyy',
  'Mappa ADC non calcolata: {x}': 'ADC map not calculated: {x}',
}
agg = 0
for k, v in NUOVE.items():
    if k not in E or E[k] != v: E[k] = v; agg += 1
# stesso formato del file (una riga, separatori compatti) se era così
compatto = '\n' not in T['lingua/en.json'].strip()
T['lingua/en.json'] = json.dumps(E, ensure_ascii=False, separators=(',', ':')) if compatto else json.dumps(E, ensure_ascii=False, indent=1)
print('en.json voci aggiunte/aggiornate:', agg)

for k, f in F.items(): open(f, 'w', encoding='utf-8').write(T[k])
print('ok')
