import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A, H = W + 'app.js', W + 'index.html'
for f in (A, H): shutil.copy(f, f + '.bak_1108visual')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:100], s.count(a)); s = s.replace(a, b)

# ---------- 1. chiusura di un esame dalla ✕ della linguetta (client): file dall'elenco completo, non solo da quelli già letti
sost("    for (const f of s.files) { const v = BUF.get(`/casi/locale/${f}`); const file = v?.file || v; if (file && typeof file === 'object') dove.add(file); } }",
     "    // dall'elenco completo dell'esame aperto: BUF contiene solo le immagini già lette e con esami grandi ne mancherebbero\n    for (const f of s.files) { const k = `/casi/locale/${f}`, v = CL.studio?.buf?.get?.(k) ?? BUF.get(k); const file = v?.file || v; if (file && typeof file === 'object') dove.add(file); } }")

# ---------- 2. RECIST 1.1: una sola misura. Lesione: diametro massimo (bersaglio ≥ 10 mm); linfonodo: asse corto (bersaglio ≥ 15 mm)
sost("""  if (tool === 'recist' && V.inCorso?.tipo === 'recist' && V.inCorso.fase === 2 && V.inCorso.k === k) {
    V.inCorso.c = pt; V.inCorso.d = { ...pt }; V.inCorso.fase = 3;
    drag = { tool, x: e.clientX, y: e.clientY, k }; disegna(); return;
  }
""", "")
sost("  if (tool === 'recist') V.inCorso = { k, tipo: 'recist', a: pt, b: { ...pt }, fase: 1 };",
     "  if (tool === 'recist') V.inCorso = { k, tipo: 'recist', a: pt, b: { ...pt }, fase: 1, ...(V.recistLinfonodo ? { linfonodo: true } : {}) };")
sost("""    } else if (m.tipo === 'recist') {
      if (m.fase === 1) { if (lungo) m.fase = 2; else V.inCorso = null; }            // ora si traccia l'asse corto
      else if (m.fase === 3) {
        if (Math.hypot(m.d.x - m.c.x, m.d.y - m.c.y) > 1) { salvaMisura(m.k, { tipo: 'recist', a: m.a, b: m.b, c: m.c, d: m.d }); T.misure++; }
        V.inCorso = null;
      }
    }""", """    } else if (m.tipo === 'recist') {
      // RECIST 1.1: una sola misura (diametro massimo della lesione, o asse corto del linfonodo)
      if (lungo) { salvaMisura(m.k, { tipo: 'recist', a: m.a, b: m.b, ...(m.linfonodo ? { linfonodo: true } : {}) }); T.misure++; }
      V.inCorso = null;
    }""")
sost("""      const r = misureRecist(m, img), righe = [`Asse lungo ${r.lung.toFixed(1)} mm`];
      if (m.d && r.corto > 0) {
        righe.push(`Asse corto ${r.corto.toFixed(1)} mm · ${(r.prodotto / 100).toFixed(1)} cm²`);
        if (img.modalita === 'CT' || img.modalita === 'MR') righe.push(`Volume stimato ≈ ${r.volume.toFixed(1)} cm³ (ellissoide)`);
      } else if (m.fase === 2) righe.push('ora traccia l\\'asse corto');""", """      const r = misureRecist(m, img), righe = [];
      if (m.d && r.corto > 0) {   // misure salvate con la versione precedente (due assi)
        righe.push(`Asse lungo ${r.lung.toFixed(1)} mm`, `Asse corto ${r.corto.toFixed(1)} mm · ${(r.prodotto / 100).toFixed(1)} cm²`);
      } else righe.push(...righeRecist(m, r.lung, img));""")
sost("function misureRecist(m, img) {", """// RECIST 1.1: lesione bersaglio con diametro massimo ≥ 10 mm (o ≥ 2 volte lo spessore dello strato se è oltre 5 mm);
// linfonodo bersaglio con asse corto ≥ 15 mm (10-14 patologico non bersaglio, < 10 normale). Al massimo 5 bersagli, 2 per organo.
function righeRecist(m, d, img) {
  const v = virgola(d, 1);
  if (m.linfonodo) return [`RECIST · linfonodo, asse corto ${v} mm`, d >= 15 ? 'bersaglio (≥ 15 mm)' : d >= 10 ? 'patologico, non bersaglio (10-14 mm)' : 'non patologico (< 10 mm)'];
  const soglia = img?.spessore > 5 ? Math.max(10, 2 * img.spessore) : 10;
  return [`RECIST · diametro max ${v} mm`, d >= soglia ? `bersaglio (≥ ${virgola(soglia, 0)} mm)` : `non misurabile come bersaglio (< ${virgola(soglia, 0)} mm)`];
}
function misureRecist(m, img) {""")
sost("  if (m.tipo === 'recist') { const r = misureRecist(m, img); return `reperto di ${mm(r.lung)} mm di asse lungo (${dove})`; }",
     "  if (m.tipo === 'recist') { const r = misureRecist(m, img); return m.linfonodo ? `linfonodo con asse corto di ${mm(r.lung)} mm (${dove})` : `lesione di ${mm(r.lung)} mm di diametro massimo (${dove})`; }")
# secondo clic sullo strumento RECIST già attivo: lesione ↔ linfonodo (non si torna a «Scorri»)
sost("""  const ritorno = b.classList.contains('on') && b.dataset.tool !== 'scroll' && !scegliStrumento.daTasto;""",
     """  if (b.dataset.tool === 'recist' && b.classList.contains('on') && !scegliStrumento.daTasto) {
    V.recistLinfonodo = !V.recistLinfonodo; V.inCorso = null;
    avvisoBreve(V.recistLinfonodo ? 'RECIST: linfonodo — misura l\\'asse corto (bersaglio ≥ 15 mm)' : 'RECIST: lesione — misura il diametro massimo (bersaglio ≥ 10 mm)');
    b.classList.toggle('recist-ln', !!V.recistLinfonodo); return;
  }
  const ritorno = b.classList.contains('on') && b.dataset.tool !== 'scroll' && !scegliStrumento.daTasto;""")
# una misura a metà (Cobb, indice cardio-toracico, angolo) non segue lo scorrimento: cambiando immagine si annulla
sost("async function mostraDi(k, i, { sincro = true } = {}) {",
     "async function mostraDi(k, i, { sincro = true } = {}) {\n  if (V.inCorso && V.inCorso.k === k && V.inCorso.fase >= 2 && P(k).idx !== i) V.inCorso = null;")

# ---------- 3. immagini chiave: il clic mostra quell'immagine nel riquadro attivo (anche se lì c'è un'altra serie)
sost("""    v.querySelector('.ic-img').onclick = async () => { const c = IC.lista[i], p = P(); if (c.vista) { await vaiChiave(c.vista); return; } if (p && p.sIdx === c.sIdx && !p.piano && !c.piano) await mostraDi(V.attivo, c.idx); };""",
     """    v.querySelector('.ic-img').onclick = () => vaiIC(IC.lista[i]).catch((e) => avvisoBreve('Immagine non disponibile: ' + e.message));""")
sost("async function vaiChiave(c) {", """async function vaiIC(c) {
  if (!c) return;
  if (c.vista) { await vaiChiave(c.vista); return; }
  if (c.sIdx == null || !V.serie[c.sIdx]) { avvisoBreve('La serie di questa immagine chiave non è aperta'); return; }
  if (MPR.attivo) modo2D();
  const k = V.attivo, p = P(k);
  if (p.sIdx !== c.sIdx || (p.piano || '') !== (c.piano || '')) {
    await selezionaSerie(c.sIdx, k, { idx: c.piano ? undefined : c.idx });
    if (c.piano) await pianoRiquadro(c.piano, k);
  }
  await mostraDi(k, Math.min(c.idx, P(k).frames.length - 1));
  const q = P(k); if (Number.isFinite(c.wc) && Number.isFinite(c.ww)) { q.wc = c.wc; q.ww = c.ww; q.wl0 = true; }
  evidenziaSerie(); disegna();
}
async function vaiChiave(c) {""")

# ---------- 4. ✕ in alto a sinistra di ogni riquadro (con più riquadri): si chiude e la disposizione si adatta
sost("  tl.forEach((t, i) => testoContorno(t, R.x + 10, R.y + 8 + i * 15, '#d8e2ee'));",
     """  const chiudibile = V.n > 1 && V.solo == null && !V.esportando && !V.senzaScritte && !MPR.attivo;
  if (chiudibile) { const x = R.x + 6, y = R.y + 6; ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.strokeStyle = 'rgba(216,226,238,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, 16, 16, 4); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#d8e2ee'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + 11, y + 11); ctx.moveTo(x + 11, y + 5); ctx.lineTo(x + 5, y + 11); ctx.stroke(); ctx.restore(); }
  tl.forEach((t, i) => testoContorno(t, R.x + (i === 0 && chiudibile ? 28 : 10), R.y + 8 + i * 15, '#d8e2ee'));""")
sost("""  const r = canvas.getBoundingClientRect(), k = pannelloSotto(e.clientX - r.left, e.clientY - r.top);
  attiva(k);
  if (!V.img) { disegna(); return; }""", """  const r = canvas.getBoundingClientRect(), k = pannelloSotto(e.clientX - r.left, e.clientY - r.top);
  // ✕ del riquadro
  if (V.n > 1 && V.solo == null && !MPR.attivo && e.button === 0) { const R = rettangolo(k), x = e.clientX - r.left - R.x, y = e.clientY - r.top - R.y;
    if (x >= 2 && x <= 26 && y >= 2 && y <= 26) { e.preventDefault(); chiudiRiquadro(k); return; } }
  // B + clic: immagine chiave del riquadro cliccato
  if (TASTI_GIU.has('b') && e.button === 0) { attiva(k); if (P(k).img) catturaChiave(); return; }
  attiva(k);
  if (!V.img) { disegna(); return; }""")
sost("async function impostaRiquadri(n) {", """// chiude un riquadro: gli altri scorrono al suo posto e la disposizione si adatta (4 → 3 affiancati → 2 → 1)
async function chiudiRiquadro(k) {
  if (V.n < 2) return;
  stopCine();
  const att = V.attivo;
  V.pannelli.splice(k, 1); V.pannelli.push(nuovoPannello());
  V.attivo = att > k ? att - 1 : att === k ? Math.max(0, k - 1) : att;
  await impostaRiquadri(V.n - 1);
  if (V.n < 2) V.confrontoPrec = null;
  evidenziaSerie(); disegna();
}
// tasti tenuti premuti (B + clic = immagine chiave)
const TASTI_GIU = new Set();
addEventListener('keydown', (e) => { if (!e.repeat && e.key.length === 1 && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) TASTI_GIU.add(e.key.toLowerCase()); });
addEventListener('keyup', (e) => { TASTI_GIU.delete(e.key.toLowerCase()); });
addEventListener('blur', () => TASTI_GIU.clear());
async function impostaRiquadri(n) {""")

# ---------- 5. scorciatoie: T = freccia con testo; B tenuto premuto non fa nient'altro (serve per B + clic)
sost("  if (k === 'k' && !e.shiftKey) { catturaChiave(); return true; }",
     "  if (k === 'k' && !e.shiftKey) { catturaChiave(); return true; }\n  if (k === 't' && !e.shiftKey) { if (scegliStrumento('nota')) avvisoBreve('Freccia con testo'); return true; }\n  if (k === 'b' && !e.shiftKey) return true;   // B + clic sull'immagine: immagine chiave")

# ---------- 6. Ctrl (o ⌘) + clic su una serie: si apre in un riquadro in più, senza sostituire quella attuale
sost("  l.addEventListener('click', (e) => { const b = e.target.closest('.s'); if (b && !b.disabled) selezionaSerie(+b.dataset.i); });",
     """  l.addEventListener('click', (e) => { const b = e.target.closest('.s'); if (!b || b.disabled) return; if (e.ctrlKey || e.metaKey) { aggiungiRiquadroSerie(+b.dataset.i); return; } selezionaSerie(+b.dataset.i); });
  // sul Mac Ctrl + clic apre il menu contestuale invece del clic: lo si intercetta
  l.addEventListener('contextmenu', (e) => { const b = e.target.closest('.s'); if (!b || b.disabled || !e.ctrlKey) return; e.preventDefault(); aggiungiRiquadroSerie(+b.dataset.i); });""")
sost("// chiude un riquadro: gli altri scorrono al suo posto", """// Ctrl + clic su una serie: un riquadro in più con quella serie (la disposizione si adatta), la serie attuale resta
async function aggiungiRiquadroSerie(si) {
  if (MPR.attivo) modo2D();
  if (V.n >= MAX_RIQUADRI) { avvisoBreve(`Al massimo ${MAX_RIQUADRI} riquadri: chiudine uno con la ✕ in alto a sinistra`); return; }
  const k = V.n;
  V.pannelli[k] = nuovoPannello();
  await selezionaSerie(si, k);
  await impostaRiquadri(V.n + 1);
  attiva(k); evidenziaSerie(); disegna();
}
// chiude un riquadro: gli altri scorrono al suo posto""")

# ---------- 7. «Confronta»: la serie che si sta guardando nel riquadro attivo (non quella del confronto precedente) e,
# nell'altro esame, la sequenza dello stesso tipo (T2 con T2, T1 dopo mdc con T1 dopo mdc, DWI, ADC, FLAIR…) e dello stesso piano
sost("  const curIdx = V.confrontoPrec?.cur ?? P().sIdx, cur = V.serie[curIdx]; if (!cur) return;",
     "  // la serie del riquadro attivo; il confronto precedente si continua (esame successivo) solo se si guarda ancora la stessa serie\n  if (V.confrontoPrec && P(0).sIdx !== V.confrontoPrec.cur) V.confrontoPrec = null;\n  const curIdx = V.confrontoPrec?.cur ?? P().sIdx, cur = V.serie[curIdx]; if (!cur) return;")
sost("""function serieCorrispondente(cur, studioId) {
  const parole = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, ' ').split(' ').filter((w) => w.length > 1));
  const a = studioDi(cur), pa = parole(a.nome);
  let migliore = null;
  V.serie.forEach((s, i) => {
    const b = studioDi(s); if (b.id !== studioId) return;
    const pb = parole(b.nome), comuni = [...pa].filter((w) => pb.has(w)).length;
    let p = (b.nome === a.nome ? 100 : 0) + 50 * comuni / Math.max(1, new Set([...pa, ...pb]).size);""", """// tipo di sequenza e piano dal nome della serie (RM e TC): servono per affiancare la serie giusta del precedente
function tipoSequenza(t) {
  t = String(t || '').toLowerCase();
  const post = /(post|mdc|\\+c\\b|gd|gado|contr|\\bc\\+|dopo)/.test(t) && !/pre[\\s_-]?(mdc|c\\b|contr)|senza/.test(t);
  const tipo = /\\badc\\b|apparent/.test(t) ? 'ADC' : /dwi|diff|trace|\\bb\\s?-?\\d{3,4}\\b|ep2d_diff/.test(t) ? 'DWI' : /flair|\\bir\\b.*t2|t2.*\\bir\\b|dark.?fluid/.test(t) ? 'FLAIR'
    : /swi|\\bt2\\*|t2star|gre\\b|hemo|ffe/.test(t) ? 'SWI' : /stir|tirm/.test(t) ? 'STIR' : /\\bpd\\b|densit/.test(t) ? 'PD'
    : /t1|mprage|mpr\\b|vibe|lava|thrive|spgr|bravo|flash|dixon/.test(t) ? (post ? 'T1+C' : 'T1') : /t2|haste|ssfse|tse|fse|space|cube|vista|ciss|fiesta/.test(t) ? 'T2'
    : /arter/.test(t) ? 'arteriosa' : /portal|venos/.test(t) ? 'venosa' : /tardiv|delay|late/.test(t) ? 'tardiva' : /basal|senza|pre[\\s_-]?(mdc|contr)|non.?contr/.test(t) ? 'basale' : '';
  const piano = /\\b(tra|ax|axial|assial)/.test(t) ? 'ax' : /\\bcor/.test(t) ? 'cor' : /\\bsag/.test(t) ? 'sag' : '';
  return { tipo, piano };
}
function serieCorrispondente(cur, studioId) {
  const parole = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, ' ').split(' ').filter((w) => w.length > 1));
  const a = studioDi(cur), pa = parole(a.nome), ta = tipoSequenza(cur.descrizione || a.nome);
  let migliore = null;
  V.serie.forEach((s, i) => {
    const b = studioDi(s); if (b.id !== studioId) return;
    const pb = parole(b.nome), comuni = [...pa].filter((w) => pb.has(w)).length, tb = tipoSequenza(s.descrizione || b.nome);
    let p = (b.nome === a.nome ? 100 : 0) + 50 * comuni / Math.max(1, new Set([...pa, ...pb]).size);
    // lo stesso tipo di sequenza conta più del nome: T2 con T2, mai T1 al posto di T2
    if (ta.tipo && tb.tipo) p += ta.tipo === tb.tipo ? 120 : -120;
    if (ta.piano && tb.piano) p += ta.piano === tb.piano ? 40 : -40;""")
open(A, 'w', encoding='utf-8').write(s)

h = open(H, encoding='utf-8').read()
h = h.replace("""<button data-tool="recist" title="RECIST: trascina l'asse lungo, poi l'asse corto (perpendicolare); in TC anche la stima del volume\"""",
              """<button data-tool="recist" title="RECIST 1.1: una misura. Lesione: diametro massimo (bersaglio ≥ 10 mm). Clicca di nuovo il pulsante per i linfonodi: asse corto (bersaglio ≥ 15 mm). Al massimo 5 bersagli, 2 per organo\"""")
assert 'RECIST 1.1: una misura' in h
open(H, 'w', encoding='utf-8').write(h)
print('ok')
