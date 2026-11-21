import shutil, json
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
F = {n: W + n for n in ['app.js', 'index.html', 'style.css', 'lingua/en.json']}
for f in F.values(): shutil.copy(f, f + '.bak_1109a')
T = {k: open(f, encoding='utf-8').read() for k, f in F.items()}
def sost(k, a, b, n=1):
    assert T[k].count(a) == n, (k, a[:110], T[k].count(a)); T[k] = T[k].replace(a, b)
A, H, C = 'app.js', 'index.html', 'style.css'

# ---- ✕ del riquadro in alto a destra (le scritte di destra si spostano a sinistra della ✕)
sost(A, "  if (chiudibile) { const x = R.x + 6, y = R.y + 6;", "  if (chiudibile) { const x = R.x + R.w - 22, y = R.y + 6;")
sost(A, "  tl.forEach((t, i) => testoContorno(t, R.x + (i === 0 && chiudibile ? 28 : 10), R.y + 8 + i * 15, '#d8e2ee'));",
        "  tl.forEach((t, i) => testoContorno(t, R.x + 10, R.y + 8 + i * 15, '#d8e2ee'));")
sost(A, "  if (img) [`${img.cols}×${img.rows}`, `Zoom ${Math.round(p.zoom * 100)}%`].forEach((t, i) => testoContorno(t, R.x + R.w - 10, R.y + 8 + i * 15, '#d8e2ee'));",
        "  if (img) [`${img.cols}×${img.rows}`, `Zoom ${Math.round(p.zoom * 100)}%`].forEach((t, i) => testoContorno(t, R.x + R.w - (i === 0 && chiudibile ? 30 : 10), R.y + 8 + i * 15, '#d8e2ee'));")
sost(A, "    if (x >= 2 && x <= 26 && y >= 2 && y <= 26) { e.preventDefault(); chiudiRiquadro(k); return; } }",
        "    if (x >= R.w - 26 && x <= R.w - 2 && y >= 2 && y <= 26) { e.preventDefault(); chiudiRiquadro(k); return; } }\n"
        "  // testo di una misura: si trascina dove si vuole (resta collegato alla misura con una linea tratteggiata)\n"
        "  if (e.button === 0 && !e.shiftKey && !MPR.attivo) { const et = etichettaSotto(e.clientX - r.left, e.clientY - r.top); if (et) { e.preventDefault(); trascinaEtichetta(e, et); return; } }")

# ---- etichette delle misure spostabili
sost(A, "function disegnaMisure(k, g) {\n  const p = P(k), img = vistaDi(p);",
"""// riquadri delle etichette delle misure appena disegnate: servono per trascinarle
const ETICHETTE = [];
function etichettaMisura(k, m, righe, x, y, col, passo = 15) {
  righe = righe.filter(Boolean); if (!righe.length) return;
  const o = m.dt || null, X = x + (o?.x || 0), Y = y + (o?.y || 0);
  const w = Math.max(...righe.map((t) => ctx.measureText(t).width)), al = ctx.textAlign, bl = ctx.textBaseline;
  const x0 = al === 'right' || al === 'end' ? X - w : al === 'center' ? X - w / 2 : X;
  const y0 = bl === 'top' || bl === 'hanging' ? Y : bl === 'middle' ? Y - 7 : bl === 'bottom' ? Y - 15 : Y - 12;
  const h = (righe.length - 1) * passo + 15;
  if (o && (o.x || o.y)) {   // spostata: una linea sottile la collega al punto di partenza
    const cx = Math.max(x0, Math.min(x0 + w, x)), cy = Math.max(y0, Math.min(y0 + h, y));
    ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeStyle = col; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
  }
  righe.forEach((t, i) => testoContorno(t, X, Y + i * passo, col));
  if (m !== V.inCorso) ETICHETTE.push({ k, m, x: x0 - 3, y: y0 - 3, w: w + 6, h: h + 6 });
}
function etichettaSotto(x, y) {
  for (let i = ETICHETTE.length - 1; i >= 0; i--) { const e = ETICHETTE[i]; if (e.k < V.n && x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) return e; }
  return null;
}
function trascinaEtichetta(e, et) {
  const x0 = e.clientX, y0 = e.clientY, o0 = { x: et.m.dt?.x || 0, y: et.m.dt?.y || 0 };
  let mosso = false; attiva(et.k);
  const muovi = (ev) => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!mosso && Math.hypot(dx, dy) < 3) return;
    if (!mosso) { memoriaMisure(); mosso = true; } et.m.dt = { x: o0.x + dx, y: o0.y + dy }; disegna(); };
  const fine = () => { removeEventListener('pointermove', muovi); removeEventListener('pointerup', fine);
    if (mosso) { if (Math.hypot(et.m.dt.x, et.m.dt.y) < 4) delete et.m.dt; fineModificaMisura(et.k, et.m); disegna(); } };
  addEventListener('pointermove', muovi); addEventListener('pointerup', fine);
}
// sopra il testo di una misura il puntatore diventa la croce dello spostamento
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons || MPR.attivo) return;
  const r = canvas.getBoundingClientRect(), sopra = !!etichettaSotto(e.clientX - r.left, e.clientY - r.top);
  if (sopra && canvas.style.cursor !== 'move') { canvas.dataset.cursorePrima = canvas.style.cursor; canvas.style.cursor = 'move'; }
  else if (!sopra && canvas.style.cursor === 'move') canvas.style.cursor = canvas.dataset.cursorePrima || '';
});
function disegnaMisure(k, g) {
  for (let i = ETICHETTE.length - 1; i >= 0; i--) if (ETICHETTE[i].k === k) ETICHETTE.splice(i, 1);
  const p = P(k), img = vistaDi(p);""")
sost(A, "        righe.forEach((t, i) => testoContorno(t, tx, ty + i * 15, m.copia ? ROSA : CIANO));",
        "        etichettaMisura(k, m, righe, tx, ty, m.copia ? ROSA : CIANO);")
sost(A, "      righe.forEach((t, i) => testoContorno(t, Math.max(a.x, b.x) + 8, Math.min(a.y, b.y) + i * 15, '#7CFC9A'));",
        "      etichettaMisura(k, m, righe, Math.max(a.x, b.x) + 8, Math.min(a.y, b.y), '#7CFC9A');")
sost(A, "      testoContorno(t, Math.max(a.x, b.x) + 8, Math.min(a.y, b.y) - 6, col);",
        "      etichettaMisura(k, m, [t], Math.max(a.x, b.x) + 8, Math.min(a.y, b.y) - 6, col);")
sost(A, "        testoContorno(m.testo, a.x + (b.x >= a.x ? -4 : 4), a.y + (b.y >= a.y ? -4 : 4), VERDE_NOTA); ctx.restore();",
        "        etichettaMisura(k, m, [m.testo], a.x + (b.x >= a.x ? -4 : 4), a.y + (b.y >= a.y ? -4 : 4), VERDE_NOTA); ctx.restore();")
sost(A, "      if (c) testoContorno(`${angoloDi(img, m).toFixed(1)}°`, b.x + 8, b.y - 8, GIALLO);",
        "      if (c) etichettaMisura(k, m, [`${angoloDi(img, m).toFixed(1)}°`], b.x + 8, b.y - 8, GIALLO);")
sost(A, "      testoContorno(`${mm.toFixed(1)} mm`, b.x + 6, b.y - 6, GIALLO);",
        "      etichettaMisura(k, m, [`${mm.toFixed(1)} mm`], b.x + 6, b.y - 6, GIALLO);")

# ---- layout 2×1 (uno sopra l'altro, per gli schermi verticali)
sost(A, "  const [col, rig] = V.n === 4 ? [2, 2] : [V.n, 1];", "  const [col, rig] = V.n === 4 ? [2, 2] : V.n === 2 && V.verticale ? [1, 2] : [V.n, 1];")
sost(A, "$('#riquadri').addEventListener('change', (e) => impostaRiquadri(+e.target.value));",
        "$('#riquadri').addEventListener('change', (e) => { V.verticale = e.target.value === '2v'; impostaRiquadri(parseInt(e.target.value, 10)); });\n"
        "const valoreRiquadri = (n = V.n) => (n === 2 && V.verticale ? '2v' : String(n));")
T[A] = T[A].replace("$('#riquadri').value = String(V.n)", "$('#riquadri').value = valoreRiquadri()").replace("$('#riquadri').value = String(n)", "$('#riquadri').value = valoreRiquadri(n)")
sost(H, '<option value="1">▢ 1</option><option value="2">▢ 2</option>',
        '<option value="1">▢ 1</option><option value="2" title="Due riquadri affiancati">▢ 2</option><option value="2v" title="Due riquadri uno sopra l\'altro (schermi verticali)">▢ 2×1</option>')

# ---- «Multischermo» con l'icona di due monitor
DUE_MONITOR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><rect x="2" y="4" width="9" height="12" rx="1.5"/><rect x="13" y="4" width="9" height="12" rx="1.5"/><path d="M6 20h12"/></svg>'
sost(H, """title="Apri un'altra finestra (su un altro schermo, se c'è), sincronizzata nello scorrimento">⧉ Nuova finestra</button>""",
        """title="Multischermo: apri un'altra finestra (sull'altro schermo, se c'è), sincronizzata nello scorrimento">""" + DUE_MONITOR + """ Multischermo</button>""")
sost(H, "«Nuova finestra» apre l'esame sull'altro monitor; le finestre scorrono insieme.", "«Multischermo» apre l'esame sull'altro monitor; le finestre scorrono insieme.")
sost(H, 'title="Altre funzioni: nuova finestra su un altro schermo,', 'title="Altre funzioni: multischermo,')
sost(A, "avvisoBreve(spostata ? 'Nuova finestra aperta sull\\'altro schermo: premi ⛶ (schermo intero) in quella finestra.' : 'Nuova finestra aperta: trascinala sull\\'altro schermo e premi ⛶ (schermo intero).');",
        "avvisoBreve(spostata ? 'Multischermo: finestra aperta sull\\'altro schermo, premi ⛶ (schermo intero) in quella finestra.' : 'Multischermo: finestra aperta, trascinala sull\\'altro schermo e premi ⛶ (schermo intero).');")

# ---- referto nella finestra separata: niente «Rimetti nella pagina» (si chiude la finestra); la scelta si azzera chiudendola
sost(A, "  scriviPrefFinestraRef('finestra'); $('#ref-finestra').textContent = '⧉ Rimetti nella pagina';\n  const rientra = () => {\n    if (FIN_REF.win !== w) return;",
        "  scriviPrefFinestraRef('finestra'); $('#ref-finestra').hidden = true;\n  let paginaChiusa = false;\n  const rientra = () => {\n    if (FIN_REF.win !== w) return;\n    if (!paginaChiusa) scriviPrefFinestraRef('');   // chiusa la finestra del referto: la prossima volta si apre nella pagina")
sost(A, "    $('#ref-finestra').textContent = '⧉ Finestra separata'; $('#ref-pieno').textContent = '⛶ Schermo intero';\n  };",
        "    $('#ref-finestra').hidden = false; $('#ref-finestra').textContent = '⧉ Finestra separata'; $('#ref-pieno').textContent = '⛶ Schermo intero';\n  };")
sost(A, "  addEventListener('pagehide', () => { try { w.close(); } catch {} }, { once: true });",
        "  addEventListener('pagehide', () => { paginaChiusa = true; try { w.close(); } catch {} }, { once: true });")
sost(A, "  $('#ref-finestra').textContent = FIN_REF.win ? '⧉ Rimetti nella pagina' : '⧉ Finestra separata';",
        "  $('#ref-finestra').hidden = !!FIN_REF.win; if (!FIN_REF.win) $('#ref-finestra').textContent = dlg.classList.contains('affiancato') ? '⧉ Rimetti nella pagina' : '⧉ Finestra separata';")

# ---- inglese
E = json.loads(T['lingua/en.json'])
E.update({
  'Due riquadri affiancati': 'Two viewports side by side',
  "Due riquadri uno sopra l'altro (schermi verticali)": 'Two viewports one above the other (vertical screens)',
  '▢ 2×1': '▢ 2×1',
  "Multischermo: apri un'altra finestra (sull'altro schermo, se c'è), sincronizzata nello scorrimento": 'Multi-screen: open another window (on the other screen, if there is one), synchronized when scrolling',
  'Multischermo': 'Multi-screen',
  "«Multischermo» apre l'esame sull'altro monitor; le finestre scorrono insieme.": '“Multi-screen” opens the exam on the other monitor; the windows scroll together.',
  "Multischermo: finestra aperta sull'altro schermo, premi ⛶ (schermo intero) in quella finestra.": 'Multi-screen: window opened on the other screen, press ⛶ (full screen) in that window.',
  "Multischermo: finestra aperta, trascinala sull'altro schermo e premi ⛶ (schermo intero).": 'Multi-screen: window opened, drag it to the other screen and press ⛶ (full screen).',
})
k = [x for x in E if x.startswith('Altre funzioni: nuova finestra su un altro schermo,')]
for x in k:
    E[x.replace('Altre funzioni: nuova finestra su un altro schermo,', 'Altre funzioni: multischermo,')] = E.pop(x).replace('new window on another screen', 'multi-screen').replace('a new window on another screen', 'multi-screen')
T['lingua/en.json'] = json.dumps(E, ensure_ascii=False, separators=(',', ':'))
for k, f in F.items(): open(f, 'w', encoding='utf-8').write(T[k])
print('ok')
