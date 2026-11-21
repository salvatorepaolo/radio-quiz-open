import re, sys
W = sys.argv[1]
src = open(W + '/app.js', encoding='utf-8').read()
def rep(old, new, count=1):
    global src
    n = src.count(old)
    assert n == count, (n, old[:80])
    src = src.replace(old, new)

# --- chiavi delle misure: il piano ricostruito ha le sue
src, n = re.subn(r'`\$\{(\w+)\.sIdx\}:\$\{\1\.idx\}`', r'chiaveMis(\1)', src); print('chiavi', n)
rep("const P = (k = V.attivo) => V.pannelli[k];",
    "const P = (k = V.attivo) => V.pannelli[k];\n// chiave delle misure: «serie:immagine», più il piano se l'immagine è ricostruita nel riquadro\nconst chiaveMis = (p) => `${p.sIdx}:${p.idx}${p.piano ? ':' + p.piano : ''}`;")
rep("for (const [key, lista] of Object.entries(V.misure || {})) for (const m of lista) {",
    "for (const [key, lista] of Object.entries(V.misure || {})) for (const m of key.split(':').length > 2 ? [] : lista) {")
rep("for (const [key, lista] of Object.entries(V.misure)) for (const m of lista) if (m.tipo === 'roi' && !m.copia) rois.push({ key, m });",
    "for (const [key, lista] of Object.entries(V.misure)) for (const m of key.split(':').length > 2 ? [] : lista) if (m.tipo === 'roi' && !m.copia) rois.push({ key, m });")
rep("for (const [key, l] of Object.entries(V.misure || {})) for (const m of l)\n",
    "for (const [key, l] of Object.entries(V.misure || {})) for (const m of key.split(':').length > 2 ? [] : l)\n")

# --- pannello: piano
rep("token: 0, richiesta: 0, cache: new Map(), off: document.createElement('canvas'), imgData: null };",
    "token: 0, richiesta: 0, cache: new Map(), off: document.createElement('canvas'), imgData: null, piano: null };")
rep("  inverti: false, tool: 'wl', misure:", "  inverti: false, tool: 'scroll', misure:")
rep("  const img = suvizza(decodificaDicom(await caricaRaw(f)), V.serie[p.sIdx]?.suv);\n  f.pos = img.ipp;",
    "  const img = f.virt ? fettaPiano(f.vol, f.piano, f.t) : suvizza(decodificaDicom(await caricaRaw(f)), V.serie[p.sIdx]?.suv);\n  f.pos = img.ipp;")
rep("  p.frames = s.files.map((f) => ({ url: `/casi/${V.caso.id}/${f}` }));\n  p.cache.clear();",
    "  p.frames = s.files.map((f) => ({ url: `/casi/${V.caso.id}/${f}` }));\n  p.cache.clear(); p.piano = null;")
rep("  tracciaVista(p.sIdx, i);\n  const mio = ++p.richiesta;", "  if (!p.piano) tracciaVista(p.sIdx, i);\n  const mio = ++p.richiesta;")

NUOVO = r"""
// ---------------------------------------------------------------- piani ricostruiti nel riquadro (senza MPR)
// Coronale e sagittale (o assiale da un'acquisizione sagittale/coronale) calcolati dalla pila di immagini della serie
// e mostrati SOLO nel riquadro attivo: gli altri riquadri restano come sono. Ogni fetta ricostruita ha posizione e
// orientamento DICOM, quindi linee di riferimento, punto collegato (Alt + clic) e misure in mm funzionano come nelle
// immagini originali. Tasti A / C / S.
const PIANI = {
  assiale: { N: [0, 0, 1], H: [1, 0, 0], U: [0, 1, 0], nome: 'Assiale' },
  coronale: { N: [0, 1, 0], H: [1, 0, 0], U: [0, 0, -1], nome: 'Coronale' },
  sagittale: { N: [1, 0, 0], H: [0, 1, 0], U: [0, 0, -1], nome: 'Sagittale' },
};
const VOLS = new Map();   // sIdx → Promise del volume (al massimo 2 in memoria)
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function pianoNativo(img) {
  if (!img?.iop) return null;
  const n = normaleDi(img.iop).map(Math.abs), k = n.indexOf(Math.max(...n));
  return ['sagittale', 'coronale', 'assiale'][k];
}
function pianoPossibile(p) {
  if (p.piano) return true;
  const s = V.serie[p.sIdx], img = p.img;
  if (!s || !img || img.rgb || !img.iop || !img.ipp || img.proiezione || s.files.length < 8) return false;
  if (!/^(CT|MR|PT|NM)$/.test(img.modalita || '')) return false;
  return !isCine(p) && !isMultiEco(p);
}
async function volumeDi(si, avanza) {
  if (VOLS.has(si)) { const v = VOLS.get(si); VOLS.delete(si); VOLS.set(si, v); return v; }
  const pr = (async () => {
    const s = V.serie[si], frames = s.files.map((f) => ({ url: `/casi/${V.caso.id}/${f}` }));
    const già = new Map(V.pannelli.flatMap((q) => q.frames).filter((f) => f.buf && !f.virt).map((f) => [f.url, f.buf]));
    let fatti = 0, i = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (i < frames.length) { const f = frames[i++]; f.buf = già.get(f.url) || null; await caricaRaw(f); if (++fatti % 10 === 0) avanza?.(fatti, frames.length); }
    }));
    const fette = frames.map((f) => suvizza(decodificaDicom(f.buf), s.suv));
    frames.forEach((f) => { f.buf = null; });
    const f0 = fette[0];
    if (fette.some((f) => f.rows !== f0.rows || f.cols !== f0.cols || !f.ipp || !f.iop || f.rgb || !stessaOrientazione(f.iop, f0.iop, 0.02)))
      throw new Error('le immagini della serie non hanno tutte la stessa dimensione e lo stesso orientamento');
    const n = normaleDi(f0.iop);
    fette.sort((a, b) => dot3(a.ipp, n) - dot3(b.ipp, n));
    const d = fette.map((f) => dot3(f.ipp, n)), passi = d.slice(1).map((x, k) => x - d[k]).filter((x) => x > 0.01).sort((a, b) => a - b);
    if (passi.length < fette.length / 2) throw new Error('più immagini nella stessa posizione (serie dinamica o con più fasi)');
    const dz = passi[passi.length >> 1], W = f0.cols, H = f0.rows, N = Math.round((d[d.length - 1] - d[0]) / dz) + 1;
    if (N > fette.length * 3 || N > 2500) throw new Error('le immagini non sono contigue');
    const intero = fette.every((f) => Number.isInteger(f.slope) && Number.isInteger(f.inter));
    const dati = intero ? new Int16Array(W * H * N) : new Float32Array(W * H * N);
    for (let k = 0, j = 0; k < N; k++) {     // salti tra le fette: ogni posizione prende la fetta più vicina
      const z = d[0] + k * dz; while (j < fette.length - 1 && Math.abs(d[j + 1] - z) <= Math.abs(d[j] - z)) j++;
      const f = fette[j], o = k * W * H, px = f.pix, sl = f.slope, it = f.inter;
      for (let q = 0; q < W * H; q++) dati[o + q] = px[q] * sl + it;
    }
    const { pix, ...meta } = f0;
    return { si, W, H, N, dati, assi: [f0.iop.slice(0, 3), f0.iop.slice(3, 6), n], sp: [f0.spCol, f0.spRow, dz], origine: fette[0].ipp, meta };
  })();
  VOLS.set(si, pr); pr.catch(() => VOLS.delete(si));
  while (VOLS.size > 2) VOLS.delete(VOLS.keys().next().value);
  return pr;
}
// asse del volume fisso (a), orizzontale (h) e verticale (u) per il piano richiesto, con i versi
function assiPiano(vol, piano) {
  const T = PIANI[piano], A = vol.assi, len = [vol.W, vol.H, vol.N], ab = (k, v) => Math.abs(dot3(A[k], v));
  const a = [0, 1, 2].reduce((m, k) => (ab(k, T.N) > ab(m, T.N) ? k : m), 0), r = [0, 1, 2].filter((k) => k !== a);
  const h = ab(r[0], T.H) >= ab(r[1], T.H) ? r[0] : r[1], u = r.find((k) => k !== h);
  return { a, h, u, sa: dot3(A[a], T.N) >= 0 ? 1 : -1, sh: dot3(A[h], T.H) >= 0 ? 1 : -1, su: dot3(A[u], T.U) >= 0 ? 1 : -1, len };
}
function geometriaPiano(vol, piano, t) {
  const G = assiPiano(vol, piano), { a, h, u, sa, sh, su, len } = G, A = vol.assi, sp = vol.sp, idx = [0, 0, 0];
  idx[a] = sa > 0 ? t : len[a] - 1 - t; idx[h] = sh > 0 ? 0 : len[h] - 1; idx[u] = su > 0 ? 0 : len[u] - 1;
  const ipp = [0, 1, 2].map((c) => vol.origine[c] + idx[0] * sp[0] * A[0][c] + idx[1] * sp[1] * A[1][c] + idx[2] * sp[2] * A[2][c]);
  return { G, fisso: idx[a], ipp, iop: [...A[h].map((v) => v * sh), ...A[u].map((v) => v * su)] };
}
function fettaPiano(vol, piano, t) {
  const { G, fisso, ipp, iop } = geometriaPiano(vol, piano, t), { a, h, u, sh, su, len } = G;
  const st = [1, vol.W, vol.W * vol.H], cols = len[h], rows = len[u], pix = new Float32Array(cols * rows), d = vol.dati;
  const sH = st[h] * sh, sU = st[u] * su, q0 = fisso * st[a] + (sh > 0 ? 0 : (len[h] - 1) * st[h]) + (su > 0 ? 0 : (len[u] - 1) * st[u]);
  for (let y = 0; y < rows; y++) { let q = q0 + y * sU; const o = y * cols; for (let x = 0; x < cols; x++, q += sH) pix[o + x] = d[q]; }
  return { ...vol.meta, rows, cols, pix, slope: 1, inter: 0, spCol: vol.sp[h], spRow: vol.sp[u], spessore: vol.sp[a], ipp, iop,
    posizione: dot3(ipp, PIANI[piano].N), parete: null, box: null, proiezione: false, riformattata: piano, tipoImmagine: 'DERIVED\\SECONDARY\\MPR' };
}
async function pianoRiquadro(piano, k = V.attivo) {
  const p = P(k);
  if (!p.frames.length || !p.img || MPR.attivo) return;
  if (!p.piano && piano === pianoNativo(p.img)) { avvisoBreve(`Questa serie è già ${PIANI[piano].nome.toLowerCase()}`); return; }
  if (p.piano === piano) return;
  if (!pianoPossibile(p)) { avvisoBreve('Ricostruzione non disponibile per questa serie: serve una pila di immagini TC, RM o PET.'); return; }
  stopCine();
  const im = p.img, c = [0, 1, 2].map((i) => im.ipp[i] + im.iop[i] * im.spCol * (im.cols - 1) / 2 + im.iop[3 + i] * im.spRow * (im.rows - 1) / 2);
  const si = p.sIdx, wc = p.wc, ww = p.ww, tok = ++p.token;
  let vol;
  const tm = setTimeout(() => { $('#caricamento').hidden = false; $('#caricamento').textContent = 'Ricostruisco il piano…'; }, 120);
  try { vol = await volumeDi(si, (a, b) => { $('#caricamento').hidden = false; $('#caricamento').textContent = `Ricostruisco il piano: ${a} / ${b} immagini`; }); }
  catch (e) { clearTimeout(tm); $('#caricamento').hidden = true; avvisoBreve('Ricostruzione non riuscita: ' + e.message); return; }
  clearTimeout(tm); $('#caricamento').hidden = true;
  if (tok !== p.token || p.sIdx !== si) return;
  const G = assiPiano(vol, piano);
  if (G.a === 2) {   // il piano d'acquisizione: si torna alle immagini originali, alla fetta che passa per lo stesso punto
    await selezionaSerie(si, k);
    const t = await fettaVicina(p.frames, c, null).catch(() => null);
    p.wc = wc; p.ww = ww; p.wl0 = true;
    if (t) await mostraDi(k, t.i); else disegna();
    return;
  }
  const n = G.len[G.a];
  p.piano = piano; p.cache.clear(); p.img = null;
  p.frames = Array.from({ length: n }, (_, t) => { const g = geometriaPiano(vol, piano, t); return { url: `piano:${si}:${piano}:${t}`, virt: true, vol, piano, t, buf: 1, pos: g.ipp, iop: g.iop, for: vol.meta.for }; });
  const nn = normaleDi(p.frames[0].iop); let t0 = n >> 1, best = Infinity;
  p.frames.forEach((f, t) => { const dd = Math.abs(dot3([f.pos[0] - c[0], f.pos[1] - c[1], f.pos[2] - c[2]], nn)); if (dd < best) { best = dd; t0 = t; } });
  p.zoom = 1; p.panX = p.panY = 0; p.rot = 0; p.fl = false; p.wl0 = true; p.wc = wc; p.ww = ww;
  if (k === V.attivo) $('#slider').max = n - 1;
  T.piani = (T.piani || 0) + 1;
  await mostraDi(k, t0); evidenziaSerie(); disegna();
}
function aggiornaPulsantiPiani() {
  const g = $('#grp-piani'); if (!g) return;
  const p = P(), ok = !MPR.attivo && pianoPossibile(p), att = p.piano || pianoNativo(p.img);
  const st = ok + '|' + att; if (g._st === st) return; g._st = st;
  g.hidden = !ok;
  g.querySelectorAll('[data-piano]').forEach((b) => b.classList.toggle('on', b.dataset.piano === att));
}
document.querySelectorAll('#grp-piani [data-piano]').forEach((b) => b.addEventListener('click', () => pianoRiquadro(b.dataset.piano)));
"""
rep("const immagine = (i) => immagineDi(P(), i);\n", "const immagine = (i) => immagineDi(P(), i);\n" + NUOVO)

# etichetta del riquadro
rep("const tl = [(V.confronto ? LETTERE[k] + ' · ' : '') + nomeSerie(s), ",
    "const tl = [(V.confronto ? LETTERE[k] + ' · ' : '') + nomeSerie(s) + (p.piano ? ` · ${PIANI[p.piano].nome} ricostruita` : ''), ")
# pulsanti dei piani aggiornati a ogni disegno
rep("  disegnaLente();\n}\nconst overlay = () => disegna();", "  disegnaLente(); aggiornaPulsantiPiani();\n}\nconst overlay = () => disegna();")

# --- scorrimento col tasto sinistro: velocità secondo il numero di immagini; con «Scorri» il destro regola la finestra
rep("  if (e.button === 2) tool = 'zoom';", "  if (e.button === 2) tool = V.tool === 'scroll' ? 'wl' : 'zoom';")
rep("""    drag.acc = (drag.acc || 0) + dy;
    const passo = Math.trunc(drag.acc / 14);
    if (passo) { drag.acc -= passo * 14; mostra(V.idx - passo); }""",
"""    // pixel per immagine: tutta la serie in circa una volta e mezza l'altezza del riquadro (da 2 a 14 px)
    const px = Math.max(2, Math.min(14, rettangolo(drag.k).h * 1.5 / Math.max(1, V.frames.length)));
    drag.acc = (drag.acc || 0) + dy;
    const passo = Math.trunc(drag.acc / px);
    if (passo) { drag.acc -= passo * px; mostra(V.idx + passo); }""")

# --- tastiera (mappa dell'utente)
rep("""const TASTI_FINESTRA = {
  TC: { 1: '-600,1500', 2: '50,350', 3: '400,1800', 4: '40,80', 5: '40,400', 6: '60,160', 0: 'auto' },""",
"""const TASTI_FINESTRA = {
  TC: { 1: '40,400', 2: '-600,1500', 3: '400,1800', 4: '40,80', 5: '200,600', 6: '50,350', 7: '60,160', 0: 'auto' },""")
rep("// scorciatoie da tastiera per le finestre (come nei PACS): 1 polmone, 2 mediastino, 3 osso, 4 encefalo, 5 addome, 6 fegato, 0 automatica",
    "// scorciatoie da tastiera per le finestre: 1 addome, 2 polmone, 3 osso, 4 encefalo, 5 angio, 6 mediastino, 7 fegato, 0 automatica")
rep("""  if (MPR.attivo) { if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey && !e.altKey) { misureMPRAlReferto(); e.preventDefault(); } return; }""",
"""  if (MPR.attivo) {
    if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey && !e.altKey) { misureMPRAlReferto(); e.preventDefault(); }
    const fm = /^[0-7]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && TASTI_FINESTRA.TC[e.key];
    if (fm && fm !== 'auto' && MPR.modulo?.unita?.() === 'HU') { const [c, w] = fm.split(',').map(Number); MPR.modulo.finestra(c, w); avvisoBreve(`Finestra: ${c}/${w}`); e.preventDefault(); }
    return;
  }""")
rep("""  if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && finestraDaTasto(e.key)) { e.preventDefault(); return; }
  if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey && !e.altKey) { misureAlReferto(); e.preventDefault(); return; }
  if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) { ruotaVista(e.shiftKey ? 'sx' : 'dx'); e.preventDefault(); return; }""",
"""  if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && finestraDaTasto(e.key)) { e.preventDefault(); return; }
  if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey && !e.altKey) { misureAlReferto(); e.preventDefault(); return; }
  if (tastoRapido(e)) { e.preventDefault(); return; }""")
# Esc: annulla la misura in corso e torna a «Scorri»
rep("""  if (e.key === 'Escape' && V.inCorso) { V.inCorso = null; disegna(); return; }
  if (e.key === 'Escape' && V.solo != null) { V.solo = null; disegna(); return; }""",
"""  if (e.key === 'Escape') { V.inCorso = null; scegliStrumento('scroll'); return; }""")
rep("""  if (e.key === 'PageUp') mostra(V.idx - 10);""", """  if (e.key === 'Home') { mostra(0); e.preventDefault(); }
  if (e.key === 'End') { mostra(V.frames.length - 1); e.preventDefault(); }
  if (e.key === 'PageUp') mostra(V.idx - 10);""")

TASTI = r"""
// ---- scorciatoie da tastiera del visualizzatore 2D (scelte dal docente): R distanza, E ROI ellittica, Z zoom,
// W finestra, A / C / S assiale, coronale, sagittale nel riquadro attivo, Esc scorri, spazio cine, 0-7 finestre,
// Home / Fine prima e ultima immagine, ? elenco dei tasti
function scegliStrumento(t) {
  const b = document.querySelector(`#barra-2d [data-tool="${t}"]`) || document.querySelector(`[data-tool="${t}"]`);
  if (b && !b.hidden) { b.click(); return true; }
  return false;
}
function tastoRapido(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const strum = { r: 'misura', e: 'roi', z: 'zoom', w: 'wl' }[k];
  if (strum && !e.shiftKey) { if (scegliStrumento(strum)) avvisoBreve({ misura: 'Distanza', roi: 'ROI ellittica (HU)', zoom: 'Zoom', wl: 'Finestra/livello' }[strum]); return true; }
  const piano = { a: 'assiale', c: 'coronale', s: 'sagittale' }[k];
  if (piano && !e.shiftKey) { pianoRiquadro(piano); return true; }
  if (e.key === ' ') { $('#btn-cine').click(); return true; }
  if (e.key === '?') { mostraTasti(); return true; }
  return false;
}
function mostraTasti() {
  let el = $('#tasti-rapidi');
  if (!el) {
    el = document.createElement('div'); el.id = 'tasti-rapidi'; el.className = 'tasti-rapidi';
    const r = (t, d) => `<tr><td><kbd>${t}</kbd></td><td>${d}</td></tr>`;
    el.innerHTML = `<div class="tr-box"><button class="tr-chiudi" aria-label="Chiudi">×</button><h3>Tasti rapidi</h3><table>`
      + r('Esc', 'Scorri (tasto sinistro su/giù); annulla la misura in corso')
      + r('Spazio', 'Scorrimento automatico (cine) avvia/ferma')
      + r('R', 'Distanza (righello)') + r('E', 'ROI ellittica (HU)') + r('Z', 'Zoom') + r('W', 'Finestra/livello')
      + r('A · C · S', 'Assiale · coronale · sagittale nel riquadro attivo')
      + r('1 … 7', 'Addome · polmone · osso · encefalo · angio · mediastino · fegato') + r('0', 'Finestra automatica')
      + r('↑ ↓ · rotellina', 'Immagine precedente / successiva') + r('Pag↑ Pag↓', '10 immagini') + r('Home · Fine', 'Prima · ultima immagine')
      + r('L', 'Lente') + r('H', 'Speculare') + r('I', 'Misure nel referto')
      + r('Destro', 'Zoom (con Scorri: finestra/livello)') + r('Centrale · Maiusc', 'Sposta') + r('Ctrl + rotellina', 'Zoom')
      + r('Alt + clic', 'Punto collegato negli altri riquadri') + r('Doppio clic', 'Ingrandisci il riquadro') + r('?', 'Questo elenco')
      + `</table></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (ev) => { if (ev.target === el || ev.target.classList.contains('tr-chiudi')) el.hidden = true; });
  }
  el.hidden = !el.hidden;
}
"""
rep("// mostra il tasto accanto alla voce del menu\n", TASTI + "// mostra il tasto accanto alla voce del menu\n")

# all'apertura del caso: Scorri per le pile TC/RM/PET, Finestra per RX, mammografia ed ecografia
rep("  renderQuiz(); mostraModoCasuale(); mostraGiro(); aggiornaWorkspaceMG(); aggiornaWorkspaceFasi();",
    "  renderQuiz(); mostraModoCasuale(); mostraGiro(); aggiornaWorkspaceMG(); aggiornaWorkspaceFasi();\n  { const met = metodicaDi(V.caso || {}); if (V.tool === 'scroll' || V.tool === 'wl') scegliStrumento(/^(RX|Mammografia|Ecografia|Ecocardio)$/.test(met) ? 'wl' : 'scroll'); }")
open(W + '/app.js', 'w', encoding='utf-8').write(src)
print('app.js ok')

h = open(W + '/index.html', encoding='utf-8').read()
def hrep(old, new):
    global h
    assert h.count(old) == 1, old[:60]
    h = h.replace(old, new)
hrep('<button data-tool="wl" class="ico on" title="Finestra/Livello (tasto sinistro)"',
 '<button data-tool="scroll" class="ico on" title="Scorri le immagini: tieni premuto il tasto sinistro e muovi il mouse su/giù (Esc). Con Scorri il tasto destro regola la finestra" aria-label="Scorri"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="6" width="10" height="12" rx="1.5"/><path d="M12 1.5v3M10 3l2-1.5L14 3M12 22.5v-3M10 21l2 1.5 2-1.5"/></svg></button>\n        <button data-tool="wl" class="ico" title="Finestra/Livello (W)"')
hrep('<button data-tool="zoom" title="Ingrandisci" aria-label="Zoom" class="ico">', '<button data-tool="zoom" title="Ingrandisci (Z)" aria-label="Zoom" class="ico">')
hrep('<button data-tool="misura" title="Misura distanza in mm"', '<button data-tool="misura" title="Misura distanza in mm (R)"')
hrep('<button data-tool="roi" title="ROI ellittica: densità media (HU), deviazione standard, min/max, area"', '<button data-tool="roi" title="ROI ellittica: densità media (HU), deviazione standard, min/max, area (E)"')
hrep('      <div class="grp" role="group" aria-label="Misure">',
 '''      <div class="grp" id="grp-piani" role="group" aria-label="Piano del riquadro" hidden>
        <button data-piano="assiale" title="Assiale nel riquadro attivo (A)">Ax</button>
        <button data-piano="coronale" title="Coronale ricostruita nel solo riquadro attivo, senza aprire l'MPR (C)">Cor</button>
        <button data-piano="sagittale" title="Sagittale ricostruita nel solo riquadro attivo, senza aprire l'MPR (S)">Sag</button>
        <button id="btn-tasti" title="Elenco dei tasti rapidi (?)" aria-label="Tasti rapidi"><b>?</b></button>
      </div>
      <div class="grp" role="group" aria-label="Misure">''')
hrep('<p class="aiuto" id="aiuto-2d">Rotellina / ↑↓: scorri immagini · Trascina sinistro: strumento attivo · Destro: zoom ·',
     '<p class="aiuto" id="aiuto-2d">Tasti: Esc scorri · R distanza · E ROI · Z zoom · A/C/S assiale/coronale/sagittale · 1-7 finestre, 0 auto · Spazio cine · ? tutti i tasti · Rotellina / ↑↓ o trascina col sinistro (Scorri): scorri immagini · Destro: zoom (con Scorri: finestra) ·')
open(W + '/index.html', 'w', encoding='utf-8').write(h)
print('index ok')
