import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1107s')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)
sost("""  p.frames = s.files.map((f) => ({ url: `/casi/${V.caso.id}/${f}` }));
  p.cache.clear(); p.piano = null;""", """  p.frames = s.files.map((f) => ({ url: `/casi/${V.caso.id}/${f}` }));
  if (s.anteprima && !CLIENT) caricaAnteprima(s);
  p.cache.clear(); p.piano = null;""")
sost("""async function selezionaSerie(si, k = V.attivo, { idx } = {}) {""", r"""// anteprima a bassa risoluzione di tutta la serie (strumenti/anteprime.py): un solo file, scaricato subito; mentre arriva
// l'immagine completa, la fetta si vede ridotta (ingrandita a blocchi). Le misure si fanno sull'immagine completa.
function caricaAnteprima(s) {
  if (s._ant || s._antP) return s._antP;
  s._antP = (async () => {
    try {
      const r = await fetch(`/casi/${V.caso.id}/${s.anteprima}`, { credentials: 'same-origin' }); if (!r.ok) return null;
      const b = new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      if (String.fromCharCode(...b.slice(0, 4)) !== 'RQA1') return null;
      const n = new DataView(b.buffer).getUint32(4, true), testa = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + n)));
      const dati = new Int16Array(b.slice(8 + n, 8 + n + testa.n * testa.w * testa.h * 2).buffer);
      s._ant = { ...testa, dati }; return s._ant;
    } catch (e) { console.warn('anteprima', e); return null; }
  })();
  return s._antP;
}
function anteprimaDi(p, i) {
  const s = V.serie[p.sIdx], a = s?._ant, m = s?._modello;
  if (!a || !m || m.mono1 || m.rgb || a.cols !== m.cols || a.rows !== m.rows || i >= a.n || p.frames.length !== a.n) return null;
  const { cols, rows, f, w, h, dati } = a, pix = new Int16Array(cols * rows), o = i * w * h;
  const xs = new Int32Array(cols); for (let x = 0; x < cols; x++) xs[x] = Math.min(w - 1, (x / f) | 0);
  for (let y = 0; y < rows; y++) { const r = o + Math.min(h - 1, (y / f) | 0) * w, b = y * cols; for (let x = 0; x < cols; x++) pix[b + x] = dati[r + xs[x]]; }
  return { ...m, pix, slope: 1, inter: 0, conSegno: true, bitsSt: 16, ipp: a.ipp?.[i] || m.ipp, posizione: null, anteprima: true };
}
async function selezionaSerie(si, k = V.attivo, { idx } = {}) {""")
sost("""  const tm = setTimeout(() => { $('#caricamento').hidden = false; $('#caricamento').textContent = 'Caricamento…'; }, 150);
  try {
    const img = await immagineDi(p, i);
    if (mio !== p.richiesta) return;
    p.img = img;""", """  const tm = setTimeout(() => { $('#caricamento').hidden = false; $('#caricamento').textContent = 'Caricamento…'; }, 150);
  try {
    // immagine non ancora scaricata: intanto l'anteprima ridotta della serie, se c'è
    { const f = p.frames[i]; if (!f.virt && !p.adc && !p.piano && !p.cache.has(f.url)) { const a = anteprimaDi(p, i); if (a) { p.img = a; disegna(); clearTimeout(tm); $('#caricamento').hidden = false; $('#caricamento').textContent = 'Anteprima ridotta: l\\'immagine completa sta arrivando…'; } } }
    const img = await immagineDi(p, i);
    if (mio !== p.richiesta) return;
    p.img = img; if (!img.anteprima && V.serie[p.sIdx]) V.serie[p.sIdx]._modello ||= img;""")
sost("window.__dbg = { GPU2D, CPRS, CAC, calcioDa, ", "window.__dbg = { GPU2D, CPRS, CAC, calcioDa, mostraDi, anteprimaDi, ")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
