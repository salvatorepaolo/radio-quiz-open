#!/usr/bin/env python3
# 11/11: layout personalizzati dei riquadri (griglia fino a 4×4 celle, riquadri di più celle, fino a 8), salvati nel browser
import sys, shutil, os, json
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def leggi(p): return open(W + p, encoding='utf-8').read()
def scrivi(p, s):
    if not os.path.exists(W + p + '.bak_1111lay'): shutil.copy(W + p, W + p + '.bak_1111lay')
    open(W + p, 'w', encoding='utf-8').write(s)
def sost(s, a, b, n=1):
    c = s.count(a)
    if c != n: sys.exit(f'trovato {c} volte (attese {n}): {a[:90]!r}')
    return s.replace(a, b)

s = leggi('app.js')
s = sost(s, """  const [col, rig] = V.n === 4 ? [2, 2] : V.n > 4 ? [Math.ceil(V.n / 2), 2] : V.n === 2 && V.verticale ? [1, 2] : [V.n, 1];""",
"""  const L = layoutAttivo();
  if (L) {   // layout personalizzato: celle della griglia, ogni riquadro occupa un rettangolo di celle
    const uw = (r.width - G * (L.col - 1)) / L.col, uh = (r.height - G * (L.rig - 1)) / L.rig, [c, y, cw, ch] = L.celle[k] || [0, 0, 0, 0];
    return { x: c * (uw + G), y: y * (uh + G), w: cw * uw + (cw - 1) * G, h: ch * uh + (ch - 1) * G };
  }
  const [col, rig] = V.n === 4 ? [2, 2] : V.n > 4 ? [Math.ceil(V.n / 2), 2] : V.n === 2 && V.verticale ? [1, 2] : [V.n, 1];""")
s = sost(s, """  if (V.solo != null || V.n < 2) return null;
  const j = V.n === 4 ? k ^ 1 : V.n === 2 ? 1 - k : null;""", """  if (V.solo != null || V.n < 2 || layoutAttivo()) return null;
  const j = V.n === 4 ? k ^ 1 : V.n === 2 ? 1 - k : null;""")

s = sost(s, """$('#riquadri').addEventListener('change', (e) => { V.verticale = e.target.value === '2v'; impostaRiquadri(parseInt(e.target.value, 10)); });
const valoreRiquadri = (n = V.n) => (n === 2 && V.verticale ? '2v' : String(n));""",
"""$('#riquadri').addEventListener('change', (e) => {
  const v = e.target.value;
  if (v === 'nuovo') { e.target.value = valoreRiquadri(); editorLayout(); return; }
  if (v.startsWith('L:')) { const L = layoutSalvati().find((x) => 'L:' + x.id === v); if (L) { V.verticale = false; V.layout = L; impostaRiquadri(L.celle.length); } return; }
  V.layout = null; V.verticale = v === '2v'; impostaRiquadri(parseInt(v, 10));
});
const valoreRiquadri = (n = V.n) => (layoutAttivo(n) ? 'L:' + V.layout.id : n === 2 && V.verticale ? '2v' : String(n));
// ---- 11/11: layout personalizzati. Griglia di celle (fino a 4×4); ogni riquadro è un rettangolo di celle (fino a 8 riquadri,
// lettere A-H da sinistra a destra e dall'alto in basso). Si disegnano trascinando sulla griglia nel dialogo «＋ Nuovo layout…»,
// si salvano con un nome in questo browser (anche nel client) e compaiono nel menu dei riquadri e nelle disposizioni ricordate.
const LAY_CHIAVE = 'rq-layout-1';
function layoutSalvati() { try { const l = JSON.parse(localStorage.getItem(LAY_CHIAVE) || '[]'); return Array.isArray(l) ? l.filter(layoutValido) : []; } catch { return []; } }
function scriviLayout(l) { try { localStorage.setItem(LAY_CHIAVE, JSON.stringify(l)); } catch {} opzioniLayout(); }
function layoutValido(L) {
  if (!L || !(L.col >= 1 && L.col <= 4 && L.rig >= 1 && L.rig <= 4) || !Array.isArray(L.celle) || !L.celle.length || L.celle.length > MAX_RIQUADRI) return false;
  const usate = new Set();
  return L.celle.every(([c, r, w, h]) => { if (!(w >= 1 && h >= 1 && c >= 0 && r >= 0 && c + w <= L.col && r + h <= L.rig)) return false;
    for (let x = c; x < c + w; x++) for (let y = r; y < r + h; y++) { const q = y * 4 + x; if (usate.has(q)) return false; usate.add(q); } return true; });
}
function layoutAttivo(n = V.n) { return V.layout && V.solo == null && V.layout.celle?.length === n ? V.layout : null; }
function opzioniLayout() {
  const sel = $('#riquadri'); if (!sel) return;
  sel.querySelectorAll('.opt-layout').forEach((o) => o.remove());
  const l = layoutSalvati(), g = document.createElement('optgroup'); g.label = 'Personalizzati'; g.className = 'opt-layout';
  for (const L of l) { const o = document.createElement('option'); o.value = 'L:' + L.id; o.textContent = `▦ ${L.nome}`; o.title = `${L.celle.length} riquadri su una griglia ${L.col}×${L.rig}`; g.append(o); }
  const n = document.createElement('option'); n.value = 'nuovo'; n.textContent = l.length ? '✎ Layout personalizzati…' : '＋ Nuovo layout…'; n.title = 'Crea, modifica o elimina i layout personalizzati dei riquadri'; g.append(n);
  sel.append(g); sel.value = valoreRiquadri();
}
opzioniLayout();
// modelli di partenza nel dialogo
const LAY_MODELLI = [
  { nome: '1 grande + 2', col: 3, rig: 2, celle: [[0, 0, 2, 2], [2, 0, 1, 1], [2, 1, 1, 1]] },
  { nome: '1 grande + 3', col: 3, rig: 3, celle: [[0, 0, 2, 3], [2, 0, 1, 1], [2, 1, 1, 1], [2, 2, 1, 1]] },
  { nome: '2 sopra + 1 sotto', col: 2, rig: 2, celle: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 2, 1]] },
  { nome: '3 in colonna', col: 1, rig: 3, celle: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1]] },
  { nome: '3×2', col: 3, rig: 2, celle: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]] },
  { nome: '2×3', col: 2, rig: 3, celle: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [0, 2, 1, 1], [1, 2, 1, 1]] },
];
const ordinaCelle = (c) => c.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
function editorLayout(dalLayout = null) {
  const d = $('#dlg-layout'); if (!d) return;
  const E = { col: 3, rig: 2, celle: [], id: null, nome: '' };
  if (dalLayout) Object.assign(E, JSON.parse(JSON.stringify(dalLayout)));
  else if (layoutAttivo()) Object.assign(E, JSON.parse(JSON.stringify(V.layout)), { id: null, nome: '' });
  let ancora = null, sopra = null;
  const occ = (x, y) => E.celle.findIndex(([c, r, w, h]) => x >= c && x < c + w && y >= r && y < r + h);
  const disegnaGriglia = () => {
    $('#lay-col').value = E.col; $('#lay-rig').value = E.rig; $('#lay-nome').value = E.nome || '';
    const g = $('#lay-griglia'); g.style.gridTemplateColumns = `repeat(${E.col},1fr)`; g.style.gridTemplateRows = `repeat(${E.rig},1fr)`;
    const sel = ancora && sopra ? [Math.min(ancora[0], sopra[0]), Math.min(ancora[1], sopra[1]), Math.abs(ancora[0] - sopra[0]) + 1, Math.abs(ancora[1] - sopra[1]) + 1] : null;
    const ord = ordinaCelle(E.celle);
    let h = '';
    for (let y = 0; y < E.rig; y++) for (let x = 0; x < E.col; x++) if (occ(x, y) < 0) {
      const dentro = sel && x >= sel[0] && x < sel[0] + sel[2] && y >= sel[1] && y < sel[1] + sel[3];
      h += `<div class="lay-cella${dentro ? ' sel' : ''}" data-x="${x}" data-y="${y}" style="grid-column:${x + 1};grid-row:${y + 1}"></div>`;
    }
    for (const c of E.celle) { const i = ord.indexOf(c); h += `<div class="lay-riq" data-i="${E.celle.indexOf(c)}" title="Clic per togliere questo riquadro" style="grid-column:${c[0] + 1}/span ${c[2]};grid-row:${c[1] + 1}/span ${c[3]}"><b>${LETTERE[i]}</b></div>`; }
    g.innerHTML = h;
    const libere = E.col * E.rig - E.celle.reduce((t, c) => t + c[2] * c[3], 0);
    $('#lay-info').textContent = `${E.celle.length} riquadri${libere ? ` · ${libere} ${libere === 1 ? 'cella libera' : 'celle libere'} (al salvataggio diventano riquadri singoli)` : ''} · al massimo ${MAX_RIQUADRI}`;
    $('#lay-modelli').innerHTML = LAY_MODELLI.map((m, i) => `<button type="button" class="ghost piccolo" data-m="${i}">${esc(m.nome)}</button>`).join('');
    const l = layoutSalvati();
    $('#lay-salvati').innerHTML = l.length ? l.map((L) => `<li><span>▦ <b>${esc(L.nome)}</b> <span class="muted small">${L.celle.length} riquadri, griglia ${L.col}×${L.rig}</span></span><button type="button" class="ghost piccolo" data-usa="${L.id}">Usa</button><button type="button" class="ghost piccolo" data-mod="${L.id}">✎ Modifica</button><button type="button" class="ghost piccolo" data-via="${L.id}" aria-label="Elimina ${esc(L.nome)}">🗑</button></li>`).join('') : '<li class="muted small">Nessun layout salvato.</li>';
  };
  const g = $('#lay-griglia');
  g.onpointerdown = (e) => {
    const r = e.target.closest('.lay-riq'); if (r) { E.celle.splice(+r.dataset.i, 1); disegnaGriglia(); return; }
    const c = e.target.closest('.lay-cella'); if (!c) return;
    ancora = sopra = [+c.dataset.x, +c.dataset.y]; g.setPointerCapture?.(e.pointerId); disegnaGriglia();
  };
  g.onpointermove = (e) => {
    if (!ancora) return;
    const c = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.lay-cella'); if (!c) return;
    const p = [+c.dataset.x, +c.dataset.y]; if (p[0] !== sopra[0] || p[1] !== sopra[1]) { sopra = p; disegnaGriglia(); }
  };
  g.onpointerup = () => {
    if (!ancora) return;
    const nuovo = [Math.min(ancora[0], sopra[0]), Math.min(ancora[1], sopra[1]), Math.abs(ancora[0] - sopra[0]) + 1, Math.abs(ancora[1] - sopra[1]) + 1];
    ancora = sopra = null;
    let libero = true; for (let x = nuovo[0]; x < nuovo[0] + nuovo[2]; x++) for (let y = nuovo[1]; y < nuovo[1] + nuovo[3]; y++) if (occ(x, y) >= 0) libero = false;
    if (!libero) avvisoBreve('Il riquadro si sovrappone a un altro: toglilo prima con un clic');
    else if (E.celle.length >= MAX_RIQUADRI) avvisoBreve(`Al massimo ${MAX_RIQUADRI} riquadri`);
    else E.celle.push(nuovo);
    disegnaGriglia();
  };
  const dimensioni = () => {
    E.col = Math.max(1, Math.min(4, +$('#lay-col').value || 1)); E.rig = Math.max(1, Math.min(4, +$('#lay-rig').value || 1));
    E.celle = E.celle.filter(([c, r, w, h]) => c + w <= E.col && r + h <= E.rig); disegnaGriglia();
  };
  $('#lay-col').onchange = dimensioni; $('#lay-rig').onchange = dimensioni;
  $('#lay-nome').oninput = (e) => { E.nome = e.target.value; };
  $('#lay-svuota').onclick = () => { E.celle = []; disegnaGriglia(); };
  $('#lay-modelli').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; const m = LAY_MODELLI[+b.dataset.m]; Object.assign(E, JSON.parse(JSON.stringify(m)), { id: E.id }); disegnaGriglia(); };
  $('#lay-salvati').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return; const l = layoutSalvati();
    if (b.dataset.usa) { const L = l.find((x) => x.id === b.dataset.usa); d.close(); if (L) { V.verticale = false; V.layout = L; impostaRiquadri(L.celle.length); } return; }
    if (b.dataset.mod) { const L = l.find((x) => x.id === b.dataset.mod); if (L) Object.assign(E, JSON.parse(JSON.stringify(L))); disegnaGriglia(); return; }
    if (b.dataset.via) { scriviLayout(l.filter((x) => x.id !== b.dataset.via)); if (V.layout?.id === b.dataset.via) { V.layout = null; disegna(); } disegnaGriglia(); }
  };
  // salva (e applica): le celle libere diventano riquadri singoli; lettere dall'alto a sinistra
  const salva = () => {
    const celle = E.celle.slice();
    for (let y = 0; y < E.rig; y++) for (let x = 0; x < E.col; x++) if (!celle.some(([c, r, w, h]) => x >= c && x < c + w && y >= r && y < r + h)) celle.push([x, y, 1, 1]);
    if (celle.length > MAX_RIQUADRI) { avvisoBreve(`Troppi riquadri (${celle.length}): al massimo ${MAX_RIQUADRI}. Unisci qualche cella trascinando.`); return null; }
    const L = { id: E.id || Date.now().toString(36), nome: (E.nome || '').trim().slice(0, 40) || `${celle.length} riquadri ${E.col}×${E.rig}`, col: E.col, rig: E.rig, celle: ordinaCelle(celle) };
    if (!layoutValido(L)) { avvisoBreve('Layout non valido'); return null; }
    const l = layoutSalvati(), i = l.findIndex((x) => x.id === L.id); if (i >= 0) l[i] = L; else l.push(L);
    scriviLayout(l); return L;
  };
  $('#lay-salva').onclick = () => { const L = salva(); if (!L) return; d.close(); V.verticale = false; V.layout = L; impostaRiquadri(L.celle.length); avvisoBreve(`▦ Layout «${L.nome}» salvato: lo trovi nel menu dei riquadri`); };
  $('#lay-chiudi').onclick = () => d.close();
  disegnaGriglia(); d.showModal();
}""")

# disposizioni ricordate: anche il layout
s = sost(s, """  l[t.chiave] = { nome: t.nome, n: V.n, salvato: new Date().toISOString().slice(0, 10), riquadri:""",
"""  l[t.chiave] = { nome: t.nome, n: V.n, layout: layoutAttivo() || null, salvato: new Date().toISOString().slice(0, 10), riquadri:""")
s = sost(s, """  V.pannelli = Array.from({ length: MAX_RIQUADRI }, nuovoPannello); V.n = pr.riquadri.length; V.attivo = 0; $('#riquadri').value = valoreRiquadri();""",
"""  V.pannelli = Array.from({ length: MAX_RIQUADRI }, nuovoPannello); V.n = pr.riquadri.length; V.attivo = 0;
  V.layout = pr.layout && layoutValido(pr.layout) && pr.layout.celle.length === pr.riquadri.length ? pr.layout : null; $('#riquadri').value = valoreRiquadri();""")
# nuovo caso: niente layout personalizzato rimasto dall'esame prima
s = sost(s, """  $('#riquadri').value = '1'; $('#btn-allinea').classList.remove('on');""", """  V.layout = null; $('#riquadri').value = '1'; $('#btn-allinea').classList.remove('on');""")
scrivi('app.js', s)

h = leggi('index.html')
h = sost(h, """<dialog id="dlg-ann" class="dlg-ann">""", """<dialog id="dlg-layout" class="dlg-esporta dlg-layout" aria-labelledby="lay-titolo">
  <h3 id="lay-titolo">▦ Layout personalizzato dei riquadri</h3>
  <p class="small">Scegli colonne e righe, poi <b>trascina sulla griglia</b> per creare un riquadro (anche di più celle); un clic su un riquadro lo toglie. Le celle libere diventano riquadri singoli. Al massimo 8 riquadri.</p>
  <p class="lay-riga"><label>Colonne <select id="lay-col"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
    <label>Righe <select id="lay-rig"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
    <button type="button" id="lay-svuota" class="ghost piccolo">Svuota</button></p>
  <p class="lay-riga small"><span class="muted">Parti da:</span> <span id="lay-modelli"></span></p>
  <div id="lay-griglia" class="lay-griglia" role="application" aria-label="Griglia del layout: trascina per creare un riquadro"></div>
  <p id="lay-info" class="small muted"></p>
  <p class="lay-riga"><label class="largo">Nome <input id="lay-nome" maxlength="40" placeholder="es. TC torace: polmone grande + 2"></label></p>
  <p class="dlg-ann-pulsanti"><button type="button" id="lay-salva" class="primary">Salva e applica</button><button type="button" id="lay-chiudi" class="ghost">Chiudi</button></p>
  <h4>Layout salvati in questo browser</h4>
  <ul id="lay-salvati" class="lay-salvati"></ul>
</dialog>
<dialog id="dlg-ann" class="dlg-ann">""")
scrivi('index.html', h)

c = leggi('style.css')
c += """
/* 11/11: layout personalizzati dei riquadri */
.dlg-layout{max-width:600px}
.dlg-layout h4{margin:14px 0 6px}
.lay-riga{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.lay-riga label{display:inline-flex;gap:6px;align-items:center}
.lay-riga label.largo{flex:1}.lay-riga label.largo input{flex:1}
#lay-modelli{display:inline-flex;gap:4px;flex-wrap:wrap}
.lay-griglia{display:grid;gap:4px;height:240px;background:#111;padding:4px;border-radius:8px;user-select:none;touch-action:none}
.lay-cella{background:#2a2f36;border:1px dashed #556;border-radius:4px;cursor:crosshair}
.lay-cella.sel{background:#2d5d9f;border-color:#8bb4ff}
.lay-riq{background:#1f3b63;border:2px solid #5b8fd6;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;cursor:pointer}
.lay-riq:hover{border-color:#ff8a80;background:#4a2a2a}
.lay-salvati{list-style:none;padding:0;margin:0}
.lay-salvati li{display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px solid var(--bord)}
.lay-salvati li>span{flex:1}
"""
scrivi('style.css', c)

p = W + 'lingua/en.json'; d = json.load(open(p, encoding='utf-8'))
for k, v in {
 'Personalizzati': 'Custom', '＋ Nuovo layout…': '＋ New layout…', '✎ Layout personalizzati…': '✎ Custom layouts…',
 'Crea, modifica o elimina i layout personalizzati dei riquadri': 'Create, edit or delete custom viewport layouts',
 '▦ Layout personalizzato dei riquadri': '▦ Custom viewport layout',
 'Scegli colonne e righe, poi': 'Choose columns and rows, then', 'trascina sulla griglia': 'drag on the grid',
 'per creare un riquadro (anche di più celle); un clic su un riquadro lo toglie. Le celle libere diventano riquadri singoli. Al massimo 8 riquadri.': 'to create a viewport (also spanning several cells); a click on a viewport removes it. Free cells become single viewports. At most 8 viewports.',
 'Colonne': 'Columns', 'Righe': 'Rows', 'Svuota': 'Clear', 'Parti da:': 'Start from:', 'Nome': 'Name',
 'es. TC torace: polmone grande + 2': 'e.g. chest CT: large lung + 2', 'Salva e applica': 'Save and apply', 'Chiudi': 'Close',
 'Layout salvati in questo browser': 'Layouts saved in this browser', 'Nessun layout salvato.': 'No saved layout.',
 'Usa': 'Use', '✎ Modifica': '✎ Edit', 'Clic per togliere questo riquadro': 'Click to remove this viewport',
 '1 grande + 2': '1 large + 2', '1 grande + 3': '1 large + 3', '2 sopra + 1 sotto': '2 above + 1 below', '3 in colonna': '3 stacked',
}.items(): d.setdefault(k, v)
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('ok')
