import sys
W = sys.argv[1]
src = open(W + '/app.js', encoding='utf-8').read()
def rep(old, new, count=1):
    global src
    n = src.count(old); assert n == count, (n, old[:100]); src = src.replace(old, new)

MOD = r"""
// ---- misure e ROI modificabili e cancellabili una per una: si clicca una misura per selezionarla (maniglie bianche),
// si trascinano le maniglie (estremi, vertici, angoli della ROI) o il corpo (sposta tutto); Canc / ⌫ o la × la cancellano
const PUNTI_MISURA = { linea: ['a', 'b'], profilo: ['a', 'b'], nota: ['a', 'b'], angolo: ['a', 'b', 'c'], recist: ['a', 'b', 'c', 'd'], cobb: ['a', 'b', 'c', 'd'], ict: ['a', 'b', 'c', 'd'], roi: ['a', 'b'] };
function maniglieDi(m) {
  if (m.tipo === 'roi' && m.pts) return m.pts.map((t, i) => [i, t]);
  if (m.tipo === 'roi') return [['a', m.a], ['b', m.b], ['ab', { x: m.a.x, y: m.b.y }], ['ba', { x: m.b.x, y: m.a.y }]];
  return (PUNTI_MISURA[m.tipo] || []).filter((c) => m[c]).map((c) => [c, m[c]]);
}
const distSeg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0; return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
// misura sotto il puntatore (coordinate dello schermo): prima le maniglie, poi il corpo
function misuraSotto(k, sx, sy) {
  const p = P(k); if (!p.img) return null;
  const g = geometriaDi(k), lista = (V.misure[chiaveMis(p)] || []).filter((m) => !m.docente), q = { x: sx, y: sy };
  if (V.sel?.k === k && V.sel.x && Math.hypot(sx - V.sel.x.x, sy - V.sel.x.y) <= 9) return { m: V.sel.m, cancella: true };
  for (const m of [...lista].reverse()) for (const [c, t] of maniglieDi(m)) { const s = aSchermo(g, t); if (Math.hypot(s.x - sx, s.y - sy) <= 8) return { m, maniglia: c }; }
  for (const m of [...lista].reverse()) {
    if (m.tipo === 'roi') { const F = formaROI(m), t = aImmagine(g, sx, sy); if (F.ok && F.dentro(t.x, t.y)) return { m, maniglia: 'corpo' }; continue; }
    const pts = (PUNTI_MISURA[m.tipo] || []).filter((c) => m[c]).map((c) => aSchermo(g, m[c]));
    const segmenti = m.tipo === 'angolo' ? [[0, 1], [1, 2]] : pts.length === 4 ? [[0, 1], [2, 3]] : [[0, 1]];
    if (segmenti.some(([i, j]) => pts[i] && pts[j] && distSeg(q, pts[i], pts[j]) <= 6)) return { m, maniglia: 'corpo' };
  }
  return null;
}
function trovaChiaveMisura(m) { for (const [key, l] of Object.entries(V.misure)) if (l.includes(m)) return key; return null; }
function cancellaMisura(m) {
  const key = trovaChiaveMisura(m); if (!key) return;
  V.misure[key] = V.misure[key].filter((x) => x !== m);
  // ROI: anche le sue copie nelle altre fasi
  if (m.tipo === 'roi' && m.gruppo != null && !m.copia) for (const k of Object.keys(V.misure)) V.misure[k] = V.misure[k].filter((x) => !(x.copia && x.gruppo === m.gruppo));
  for (const k of Object.keys(V.misure)) if (!V.misure[k].length) delete V.misure[k];
  V.sel = null; T.cancellate = (T.cancellate || 0) + 1;
  disegna(); aggiornaTabellaMisure();
}
function muoviMisura(m, maniglia, pt, d) {
  if (maniglia === 'corpo') {
    const sposta = (t) => { t.x += d.x; t.y += d.y; };
    if (m.pts) m.pts.forEach(sposta);
    for (const c of ['a', 'b', 'c', 'd']) if (m[c]) sposta(m[c]);
    return;
  }
  if (typeof maniglia === 'number') {
    m.pts[maniglia] = { x: pt.x, y: pt.y };
    const xs = m.pts.map((t) => t.x), ys = m.pts.map((t) => t.y); m.a = { x: Math.min(...xs), y: Math.min(...ys) }; m.b = { x: Math.max(...xs), y: Math.max(...ys) };
    return;
  }
  if (maniglia === 'ab') { m.a.x = pt.x; m.b.y = pt.y; return; }
  if (maniglia === 'ba') { m.b.x = pt.x; m.a.y = pt.y; return; }
  m[maniglia] = { x: pt.x, y: pt.y };
}
function fineModificaMisura(k, m) {
  if (m.tipo === 'roi' && m.a && m.b && !m.pts) { const a = { x: Math.min(m.a.x, m.b.x), y: Math.min(m.a.y, m.b.y) }, b = { x: Math.max(m.a.x, m.b.x), y: Math.max(m.a.y, m.b.y) }; m.a = a; m.b = b; }
  // ROI: le copie nelle altre fasi seguono la ROI modificata
  if (m.tipo === 'roi' && m.gruppo != null && !m.copia) { for (const key of Object.keys(V.misure)) V.misure[key] = V.misure[key].filter((x) => !(x.copia && x.gruppo === m.gruppo)); copiaROI(k, m); }
  if (m.tipo === 'linea' && P(k).img) V.ultimaLinea = Math.hypot((m.b.x - m.a.x) * P(k).img.spCol, (m.b.y - m.a.y) * P(k).img.spRow);
  delete m._referto; T.modificate = (T.modificate || 0) + 1;
  aggiornaTabellaMisure();
}
// maniglie e × della misura selezionata
function disegnaSelezione(k, g) {
  const s = V.sel; if (!s || s.k !== k || !(V.misure[chiaveMis(P(k))] || []).includes(s.m)) { if (s?.k === k) s.x = null; return; }
  ctx.save();
  let xmax = -Infinity, ymin = Infinity;
  for (const [, t] of maniglieDi(s.m)) {
    const q = aSchermo(g, t); xmax = Math.max(xmax, q.x); ymin = Math.min(ymin, q.y);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.fillRect(q.x - 4, q.y - 4, 8, 8); ctx.strokeRect(q.x - 4, q.y - 4, 8, 8);
  }
  const x = { x: Math.min(g.R.x + g.R.w - 12, xmax + 14), y: Math.max(g.R.y + 12, ymin - 14) };
  ctx.beginPath(); ctx.arc(x.x, x.y, 8, 0, 7); ctx.fillStyle = '#d33'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x.x - 3.5, x.y - 3.5); ctx.lineTo(x.x + 3.5, x.y + 3.5); ctx.moveTo(x.x + 3.5, x.y - 3.5); ctx.lineTo(x.x - 3.5, x.y + 3.5); ctx.stroke();
  s.x = x;
  ctx.restore();
}
"""
rep("let drag = null;\ncanvas.addEventListener('contextmenu'", MOD + "let drag = null;\ncanvas.addEventListener('contextmenu'")
# disegno della selezione dopo le misure
rep("    if (!V.senzaScritte) disegnaMisure(k, g);", "    if (!V.senzaScritte) { disegnaMisure(k, g); disegnaSelezione(k, g); }")
# clic: prima le misure esistenti (selezione, maniglie, ×), poi lo strumento
rep("""  if (V.allinea && e.button === 0 && !e.shiftKey) { puntoAllinea(k, pt); return; }""",
"""  if (V.allinea && e.button === 0 && !e.shiftKey) { puntoAllinea(k, pt); return; }
  if (e.button === 0 && !e.shiftKey && !e.altKey && !V.inCorso && !ANAT.quiz && !['eco', 'cmr', 'anatomia', 'volume', 'collega', 't2s'].includes(V.tool)) {
    const h = misuraSotto(k, e.clientX - r.left, e.clientY - r.top);
    if (h?.cancella) { cancellaMisura(h.m); return; }
    if (h) { V.sel = { k, m: h.m }; drag = { tool: 'modifica', k, m: h.m, maniglia: h.maniglia, prec: pt, x: e.clientX, y: e.clientY }; disegna(); return; }
    if (V.sel) { V.sel = null; disegna(); }
  }""")
rep("""  if (drag.tool === 'collega') { if (drag.k === k && p.img) collegaPunto(k, aImmagine(geometriaDi(k), e.clientX - r.left, e.clientY - r.top)); return; }""",
"""  if (drag.tool === 'collega') { if (drag.k === k && p.img) collegaPunto(k, aImmagine(geometriaDi(k), e.clientX - r.left, e.clientY - r.top)); return; }
  if (drag.tool === 'modifica') {
    const q = aImmagine(geometriaDi(drag.k), e.clientX - r.left, e.clientY - r.top);
    muoviMisura(drag.m, drag.maniglia, q, { x: q.x - drag.prec.x, y: q.y - drag.prec.y }); drag.prec = q; drag.mosso = true; disegna(); return;
  }""")
rep("""canvas.addEventListener('pointerup', (e) => {
  fineTocco(e);
  const m = V.inCorso;""", """canvas.addEventListener('pointerup', (e) => {
  fineTocco(e);
  if (drag?.tool === 'modifica') { if (drag.mosso) fineModificaMisura(drag.k, drag.m); drag = null; disegna(); return; }
  const m = V.inCorso;""")
# cursore sopra una misura
rep("""    if (!drag) { disegna(); return; }
  }
  if (!drag) return;""", """    if (!drag) { const h = !V.inCorso && misuraSotto(k, e.clientX - r.left, e.clientY - r.top); canvas.classList.toggle('su-misura', !!h && !h.cancella); canvas.classList.toggle('su-x', !!h?.cancella); disegna(); return; }
  }
  if (!drag) return;""")
# tasti: Canc / Backspace cancellano la misura selezionata; Esc la deseleziona
rep("""  if (e.key === 'Escape') { V.inCorso = null; scegliStrumento('scroll'); return; }""",
"""  if ((e.key === 'Delete' || e.key === 'Backspace') && V.sel && !V.inCorso) { cancellaMisura(V.sel.m); e.preventDefault(); return; }
  if (e.key === 'Escape') { V.inCorso = null; V.sel = null; scegliStrumento('scroll'); return; }""")
# pulsante «cancella»: la selezionata, altrimenti tutte quelle dell'immagine
rep("""$('#btn-cancella').addEventListener('click', () => {
  for (const p of V.confronto ? V.pannelli : [P()]) delete V.misure[chiaveMis(p)];""", """$('#btn-cancella').addEventListener('click', () => {
  if (V.sel) { cancellaMisura(V.sel.m); return; }
  for (const p of V.confronto ? V.pannelli : [P()]) delete V.misure[chiaveMis(p)];""")
# serie trascinate dall'elenco in un riquadro
rep("  document.querySelectorAll('#lista-serie .s').forEach((b) => b.onclick = () => selezionaSerie(+b.dataset.i));",
"""  document.querySelectorAll('#lista-serie .s').forEach((b) => {
    b.onclick = () => selezionaSerie(+b.dataset.i);
    b.draggable = true;
    b.ondragstart = (e) => { e.dataTransfer.setData('text/x-rq-serie', b.dataset.i); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('trascina-serie'); };
    b.ondragend = () => { document.body.classList.remove('trascina-serie'); V.sopra = null; disegna(); };
  });""")
DND = r"""
// ---- una serie trascinata dall'elenco (in basso) in un riquadro sostituisce quella che c'era; nel client si possono
// trascinare sulle immagini anche cartelle e file di altri esami (si aggiungono per il confronto)
canvas.addEventListener('dragover', (e) => {
  const tipi = [...(e.dataTransfer?.types || [])];
  if (tipi.includes('text/x-rq-serie') && !MPR.attivo) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    const r = canvas.getBoundingClientRect(), k = pannelloSotto(e.clientX - r.left, e.clientY - r.top);
    if (V.sopra !== k) { V.sopra = k; disegna(); }
  } else if (CLIENT && tipi.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
});
canvas.addEventListener('dragleave', () => { if (V.sopra != null) { V.sopra = null; disegna(); } });
canvas.addEventListener('drop', async (e) => {
  const si = e.dataTransfer.getData('text/x-rq-serie');
  if (si !== '' && si != null && !MPR.attivo) {
    e.preventDefault();
    const r = canvas.getBoundingClientRect(), k = pannelloSotto(e.clientX - r.left, e.clientY - r.top);
    V.sopra = null; attiva(k); await selezionaSerie(+si, k); T.trascinate = (T.trascinate || 0) + 1; disegna(); return;
  }
  if (CLIENT && e.dataTransfer.files?.length) {
    e.preventDefault();
    const voci = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const files = []; for (const v of voci) await leggiVoceConPercorso(v, files, '');
    aggiungiEsameClient(files.length ? files : [...e.dataTransfer.files]);
  }
});
"""
rep("\n// ---- misure e ROI modificabili e cancellabili", DND + "\n// ---- misure e ROI modificabili e cancellabili")
# bordo del riquadro di destinazione durante il trascinamento
rep("  disegnaLente(); aggiornaPulsantiPiani();\n", """  if (V.sopra != null && V.sopra < V.n) { const R = rettangolo(V.sopra); ctx.save(); ctx.strokeStyle = '#4ea1ff'; ctx.lineWidth = 4; ctx.setLineDash([10, 6]); ctx.strokeRect(R.x + 2, R.y + 2, R.w - 4, R.h - 4); ctx.restore(); }
  disegnaLente(); aggiornaPulsantiPiani();
""")
open(W + '/app.js', 'w', encoding='utf-8').write(src)

# client: aggiungi esame (cartelle o file) all'esame aperto, per il confronto
c = open(W + '/app.js', encoding='utf-8').read()
def crep(o, n):
    global c; assert c.count(o) == 1, o[:80]; c = c.replace(o, n)
crep("async function caricaClient(files) {", """function aggiungiEsameClient(files) {
  if (!files?.length) return;
  avvisoBreve('Aggiungo l\\'esame per il confronto…');
  caricaClient(files, { aggiungi: true });
}
async function caricaClient(files, { aggiungi = false } = {}) {""")
crep("      if (validi.length > 1) { sceltaStudi(validi); return; }", "      if (validi.length > 1) { if (aggiungi) { location.hash = '#/'; await pausa(50); } sceltaStudi(validi, aggiungi); return; }")
crep("  files = files.filter((f) => !/(^|\\/)DICOMDIR$/i.test(percorsoDi(f)));",
"""  files = files.filter((f) => !/(^|\\/)DICOMDIR$/i.test(percorsoDi(f)));
  // esame aggiunto: insieme ai file già aperti (gli studi diventano attuale e precedenti)
  if (aggiungi && CL.sorgenti?.length) { const visti = new Set(CL.sorgenti); files = [...CL.sorgenti, ...files.filter((f) => !visti.has(f))]; }
  CL.sorgenti = files;""")
crep("function sceltaStudi(studi) {", "function sceltaStudi(studi, aggiungi = false) {")
crep("    box.hidden = true; caricaClient(sc.flatMap((s) => s.files));", "    box.hidden = true; caricaClient(sc.flatMap((s) => s.files), { aggiungi });")
crep("  $('#cl-apri').onclick = () => { location.hash = '#/'; };", """  $('#cl-apri').onclick = () => { location.hash = '#/'; };
  $('#cl-aggiungi-cartella').addEventListener('change', (e) => { aggiungiEsameClient([...e.target.files]); e.target.value = ''; });
  $('#cl-aggiungi-file').addEventListener('change', (e) => { aggiungiEsameClient([...e.target.files]); e.target.value = ''; });""")
open(W + '/app.js', 'w', encoding='utf-8').write(c)

h = open(W + '/index.html', encoding='utf-8').read()
o = '''      <button id="cl-esporta" type="button"'''
assert h.count(o) == 1
h = h.replace(o, '''      <details class="cl-aggiungi"><summary class="btn" title="Aggiungi un altro esame (precedente o successivo) per il confronto: si apre insieme a quello attuale">＋ Aggiungi esame</summary>
        <div class="cl-aggiungi-voci"><label>📂 Cartella<input type="file" id="cl-aggiungi-cartella" webkitdirectory multiple hidden></label><label>🗎 File<input type="file" id="cl-aggiungi-file" multiple hidden></label><span class="muted small">oppure trascinali sulle immagini</span></div></details>
''' + o)
open(W + '/index.html', 'w', encoding='utf-8').write(h)
print('ok')
