import sys
W = sys.argv[1]
src = open(W + '/app.js', encoding='utf-8').read()
def rep(old, new, count=1):
    global src
    n = src.count(old); assert n == count, (n, old[:100]); src = src.replace(old, new)

# ============ 1. annulla / ripeti
ANN = r"""
// ---- annulla / ripeti (Ctrl+Z, Ctrl+Maiusc+Z o Ctrl+Y): lo stato delle misure prima di ogni modifica
const STORIA = { indietro: [], avanti: [] };
function memoriaMisure() {
  try { STORIA.indietro.push(JSON.stringify(V.misure || {})); } catch { return; }
  if (STORIA.indietro.length > 100) STORIA.indietro.shift();
  STORIA.avanti = []; aggiornaPulsantiStoria();
}
function ripristinaStato(da, a) {
  if (!da.length) { avvisoBreve(a === STORIA.avanti ? 'Niente da annullare' : 'Niente da ripetere'); return; }
  a.push(JSON.stringify(V.misure || {}));
  V.misure = JSON.parse(da.pop()); V.sel = null; V.inCorso = null;
  disegna(); aggiornaTabellaMisure(); aggiornaPulsantiStoria();
}
const annulla = () => ripristinaStato(STORIA.indietro, STORIA.avanti);
const ripeti = () => ripristinaStato(STORIA.avanti, STORIA.indietro);
function azzeraStoria() { STORIA.indietro = []; STORIA.avanti = []; aggiornaPulsantiStoria(); }
function aggiornaPulsantiStoria() { const a = $('#btn-annulla'), r = $('#btn-ripeti'); if (a) a.disabled = !STORIA.indietro.length; if (r) r.disabled = !STORIA.avanti.length; }
"""
rep("function salvaMisura(k, m) {\n", ANN + "function salvaMisura(k, m) {\n  memoriaMisure();\n")
rep("function cancellaMisura(m) {\n  const key = trovaChiaveMisura(m); if (!key) return;", "function cancellaMisura(m) {\n  const key = trovaChiaveMisura(m); if (!key) return;\n  memoriaMisure();")
rep("    muoviMisura(drag.m, drag.maniglia, q, { x: q.x - drag.prec.x, y: q.y - drag.prec.y }); drag.prec = q; drag.mosso = true; disegna(); return;",
    "    if (!drag.mosso) memoriaMisure();\n    muoviMisura(drag.m, drag.maniglia, q, { x: q.x - drag.prec.x, y: q.y - drag.prec.y }); drag.prec = q; drag.mosso = true; disegna(); return;")
rep("""  if (V.sel) { cancellaMisura(V.sel.m); return; }
  for (const p of V.confronto ? V.pannelli : [P()]) delete V.misure[chiaveMis(p)];""", """  if (V.sel) { cancellaMisura(V.sel.m); return; }
  memoriaMisure();
  for (const p of V.confronto ? V.pannelli : [P()]) delete V.misure[chiaveMis(p)];""")
rep("  V.misure = {}; V.gruppi = 0; V.inCorso = null; V.chiavi = [];", "  V.misure = {}; azzeraStoria(); V.gruppi = 0; V.inCorso = null; V.chiavi = [];")
rep("""window.addEventListener('keydown', (e) => {
  if ($('#vista-caso').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;""",
"""window.addEventListener('keydown', (e) => {
  if ($('#vista-caso').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !MPR.attivo && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
    e.preventDefault(); if (e.key.toLowerCase() === 'y' || e.shiftKey) ripeti(); else annulla(); return;
  }""")
src = src.replace("+ r('Canc · ⌫ · ×', 'Cancella la misura selezionata')", "+ r('Canc · ⌫ · ×', 'Cancella la misura selezionata') + r('Ctrl+Z · Ctrl+Maiusc+Z', 'Annulla · ripeti (misure)')")

# ============ 2. istogramma a richiesta
rep("$('#grafico-chiudi').addEventListener('click', () => { GR.nascosto = GR.chiave; $('#grafico').hidden = true; });",
"""// il grafico (istogramma della ROI, profilo) non copre l'immagine: resta chiuso in una piccola etichetta e si apre a richiesta
try { GR.aperto = localStorage.getItem('rq-grafico') === '1'; } catch {}
const apriGrafico = (on) => { GR.aperto = on; try { localStorage.setItem('rq-grafico', on ? '1' : '0'); } catch {} GR.chiave = null; aggiornaGrafico(); };
$('#grafico-chiudi').addEventListener('click', () => apriGrafico(false));
$('#grafico-chip')?.addEventListener('click', () => apriGrafico(true));""")
rep("""  if (!m || !img || MPR.attivo || Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) < 1) { box.hidden = true; GR.chiave = null; return; }
  const chiave = JSON.stringify([m.tipo, m.a, m.b, m.pts?.length, m.pts?.[m.pts.length - 1], p.sIdx, p.idx, !!img.rif]);
  if (chiave === GR.nascosto) { box.hidden = true; return; }""", """  const chip = $('#grafico-chip');
  if (!m || !img || MPR.attivo || Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) < 1) { box.hidden = true; if (chip) chip.hidden = true; GR.chiave = null; return; }
  const chiave = JSON.stringify([m.tipo, m.a, m.b, m.pts?.length, m.pts?.[m.pts.length - 1], p.sIdx, p.idx, !!img.rif]);
  if (!GR.aperto) { box.hidden = true; if (chip) { chip.hidden = false; chip.textContent = `📊 ${m.tipo === 'profilo' ? 'Profilo' : 'Istogramma ' + (m.etichetta || 'ROI')}`; } GR.chiave = null; return; }
  if (chip) chip.hidden = true;""")

# ============ 4. confronto automatico attuale / precedente
rep("$('#btn-confronta').addEventListener('click', async () => {", "$('#btn-confronta').addEventListener('click', () => confrontaStudi());\nasync function confrontaStudi({ auto = false } = {}) {")
rep("""  if (!lista.length) { alert('In questo caso c\\'è un solo esame: non c\\'è niente da affiancare.'); return; }""",
    """  if (!lista.length) { if (!auto) alert('In questo caso c\\'è un solo esame: non c\\'è niente da affiancare.'); return; }""")
rep("""  attiva(0); V.sincro = true; $('#sincro').checked = true;
  V.confrontoPrec = { cur: curIdx };""", """  attiva(0); V.sincro = true; $('#sincro').checked = true;
  V.confrontoPrec = { cur: curIdx };
  // stessa finestra nei due esami (se della stessa metodica)
  if (P(0).img && P(1).img && famigliaFinestra(P(0).img) === famigliaFinestra(P(1).img) && famigliaFinestra(P(0).img) === 'CT') { P(1).wc = P(0).wc; P(1).ww = P(0).ww; }""")
src = src.replace("""  if (a?.ipp && b?.ipp && a.for && b.for && a.for !== b.for && !allineate(a, b) && !a.rgb && !b.rgb) $('#btn-auto-allinea').click();
  else { sincronizzaDa(0); disegna(); }
});""", """  if (a?.ipp && b?.ipp && a.for && b.for && a.for !== b.for && !allineate(a, b) && !a.rgb && !b.rgb) $('#btn-auto-allinea').click();
  else { sincronizzaDa(0); disegna(); }
  if (auto) avvisoBreve('Esame attuale (A) e precedente (B) affiancati e collegati. «Confronta» passa a un altro esame.');
}
// all'apertura: con un esame precedente dello stesso distretto, i due esami affiancati (se il docente non ha scelto la disposizione)
async function confrontoAutomatico() {
  try {
    if (!V.caso || V.studi.length < 2 || MPR.attivo || window.matchMedia('(max-width: 700px)').matches) return;
    if ((V.caso.disposizione || []).length || Number.isInteger(V.caso.riquadri) || !$('#ws-mg').hidden) return;
    if (visibili().some(([q]) => studioDi(V.serie[q.sIdx]).id !== studioDi(V.serie[P(0).sIdx]).id)) return;   // già affiancati
    const cur = studioDi(V.serie[P(0).sIdx]);
    if (!V.studi.some((x) => x.id !== cur.id && x.regione === cur.regione)) return;
    if (P(0).img?.modalita === 'US') return;
    attiva(0); await confrontaStudi({ auto: true });
  } catch (e) { console.warn('confronto automatico', e); }
}""", 1)
assert 'async function confrontoAutomatico' in src
rep("    if (tipo === 'caso' && id) await apriCaso(decodeURIComponent(id));", "    if (tipo === 'caso' && id) { await apriCaso(decodeURIComponent(id)); await confrontoAutomatico(); }")
rep("    await apriCaso('locale', CL.studio);", "    await apriCaso('locale', CL.studio);\n    if (!CL.finestra) await confrontoAutomatico();")

# ============ 5. finestre e tasti personali
PERS = r"""
// ---- finestre e tasti personali, salvati in questo browser (⚙ Personalizza: dal menu delle finestre o dall'elenco dei tasti)
const FINESTRE_BASE = [['1', 'Addome', 40, 400], ['2', 'Polmone', -600, 1500], ['3', 'Osso', 400, 1800], ['4', 'Encefalo', 40, 80], ['5', 'Angio', 200, 600], ['6', 'Mediastino', 50, 350], ['7', 'Fegato', 60, 160], ['8', '', null, null], ['9', '', null, null]];
const TASTI_BASE = { misura: 'r', roi: 'e', zoom: 'z', wl: 'w', assiale: 'a', coronale: 'c', sagittale: 's' };
const NOMI_AZIONI = { misura: 'Distanza', roi: 'ROI ellittica', zoom: 'Zoom', wl: 'Finestra/livello', assiale: 'Assiale', coronale: 'Coronale', sagittale: 'Sagittale' };
let PREF = { finestre: null, tasti: null };
try { PREF = { ...PREF, ...JSON.parse(localStorage.getItem('rq-preferenze') || '{}') }; } catch {}
const finestrePersonali = () => (PREF.finestre || FINESTRE_BASE).filter((f) => f[1] && Number.isFinite(+f[2]) && +f[3] > 0);
const tastiPersonali = () => ({ ...TASTI_BASE, ...(PREF.tasti || {}) });
function applicaPreferenze() {
  const tc = { 0: 'auto' };
  for (const [t, , c, w] of finestrePersonali()) tc[t] = `${+c},${+w}`;
  TASTI_FINESTRA.TC = tc;
  for (const [t, n, c, w] of finestrePersonali()) NOMI_TASTI[`${+c},${+w}`] = n;
  const gruppo = finestrePersonali().filter(([, , c, w]) => !PRESET_TC_BASE.includes(`value="${+c},${+w}"`));
  PRESET_TC = PRESET_TC_BASE.replace('</option>', '</option>' + (gruppo.length ? `<optgroup label="Le mie finestre">${gruppo.map(([, n, c, w]) => `<option value="${+c},${+w}">${esc(n)} (${+c}/${+w})</option>`).join('')}</optgroup>` : '')) + '<option value="personalizza">⚙ Personalizza finestre e tasti…</option>';
  V._menuFinestre = null; try { aggiornaMenuFinestre(); } catch {}
  $('#tasti-rapidi')?.remove();
}
function apriPersonalizza() {
  let d = $('#dlg-pers');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlg-pers'; d.className = 'dlg-esporta dlg-pers'; document.body.appendChild(d); }
  const fin = PREF.finestre || FINESTRE_BASE, ta = tastiPersonali();
  d.innerHTML = `<h3>⚙ Finestre e tasti personali</h3><p class="muted small">Valgono in questo browser. Le finestre si richiamano con i tasti 1–9 (TC) e compaiono nel menu «Le mie finestre».</p>
    <table class="pers-tab"><tr><th>Tasto</th><th>Nome</th><th>Livello (L)</th><th>Ampiezza (W)</th></tr>
    ${fin.map(([t, n, c, w]) => `<tr><td><b>${t}</b></td><td><input data-f="${t}" data-c="n" value="${esc(n || '')}" placeholder="—"></td><td><input data-f="${t}" data-c="c" type="number" value="${c ?? ''}"></td><td><input data-f="${t}" data-c="w" type="number" min="1" value="${w ?? ''}"></td></tr>`).join('')}</table>
    <h4>Tasti degli strumenti</h4><div class="pers-tasti">${Object.keys(TASTI_BASE).map((k) => `<label>${NOMI_AZIONI[k]} <input data-t="${k}" maxlength="1" value="${esc(ta[k])}"></label>`).join('')}</div>
    <p class="muted small">Esc (scorri), spazio (cine), 0 (finestra automatica), L, H, I, ? restano fissi.</p>
    <p id="pers-stato" class="stato"></p>
    <p><button type="button" class="primary" id="pers-salva">Salva</button> <button type="button" id="pers-base">Ripristina le predefinite</button> <button type="button" class="ghost" id="pers-chiudi">Chiudi</button></p>`;
  d.querySelector('#pers-chiudi').onclick = () => d.close();
  d.querySelector('#pers-base').onclick = () => { PREF = { finestre: null, tasti: null }; try { localStorage.removeItem('rq-preferenze'); } catch {} applicaPreferenze(); d.close(); avvisoBreve('Finestre e tasti predefiniti ripristinati.'); };
  d.querySelector('#pers-salva').onclick = () => {
    const f = FINESTRE_BASE.map(([t]) => { const v = (c) => d.querySelector(`[data-f="${t}"][data-c="${c}"]`).value.trim(); return [t, v('n'), v('c') === '' ? null : +v('c'), v('w') === '' ? null : +v('w')]; });
    const t = {}; for (const k of Object.keys(TASTI_BASE)) { const v = d.querySelector(`[data-t="${k}"]`).value.trim().toLowerCase(); if (v) t[k] = v; }
    const usati = Object.values(t), fissi = ['l', 'h', 'i', ' ', '?', ...'0123456789'];
    const doppio = usati.find((x, i) => usati.indexOf(x) !== i), fisso = usati.find((x) => fissi.includes(x));
    if (doppio || fisso) { d.querySelector('#pers-stato').textContent = doppio ? `Il tasto «${doppio}» è usato due volte.` : `Il tasto «${fisso}» è già usato dal visualizzatore.`; return; }
    PREF = { finestre: f, tasti: t }; try { localStorage.setItem('rq-preferenze', JSON.stringify(PREF)); } catch {}
    applicaPreferenze(); d.close(); avvisoBreve('Finestre e tasti salvati in questo browser.');
  };
  d.showModal();
}
"""
rep("const PRESET_TC = $('#preset').innerHTML;", "const PRESET_TC_BASE = $('#preset').innerHTML;\nlet PRESET_TC = PRESET_TC_BASE;")
rep("// mostra il tasto accanto alla voce del menu\n", PERS + "applicaPreferenze();\n// mostra il tasto accanto alla voce del menu\n")
rep("""$('#preset').addEventListener('change', (e) => {
  if (!e.target.value) return;""", """$('#preset').addEventListener('change', (e) => {
  if (!e.target.value) return;
  if (e.target.value === 'personalizza') { e.target.value = ''; apriPersonalizza(); return; }""")
rep("  const strum = { r: 'misura', e: 'roi', z: 'zoom', w: 'wl' }[k];", "  const tp = tastiPersonali(), strum = Object.fromEntries(['misura', 'roi', 'zoom', 'wl'].map((x) => [tp[x], x]))[k];")
rep("  const piano = { a: 'assiale', c: 'coronale', s: 'sagittale' }[k];", "  const piano = Object.fromEntries(['assiale', 'coronale', 'sagittale'].map((x) => [tp[x], x]))[k];")
# elenco dei tasti: secondo le preferenze, con il pulsante per personalizzare
rep("""      + r('R', 'Distanza (righello)') + r('E', 'ROI ellittica (HU)') + r('Z', 'Zoom') + r('W', 'Finestra/livello')
      + r('A · C · S', 'Assiale · coronale · sagittale nel riquadro attivo')
      + r('1 … 7', 'Addome · polmone · osso · encefalo · angio · mediastino · fegato') + r('0', 'Finestra automatica')""",
"""      + ['misura', 'roi', 'zoom', 'wl'].map((x) => r(tastiPersonali()[x].toUpperCase(), NOMI_AZIONI[x])).join('')
      + r(['assiale', 'coronale', 'sagittale'].map((x) => tastiPersonali()[x].toUpperCase()).join(' · '), 'Assiale · coronale · sagittale nel riquadro attivo')
      + finestrePersonali().map(([t, n, c, w]) => r(t, `Finestra ${n} (${c}/${w})`)).join('') + r('0', 'Finestra automatica')""")
rep("""      + `</table></div>`;""", """      + `</table><p><button type="button" id="tasti-pers">⚙ Personalizza finestre e tasti</button></p></div>`;""")
rep("""    el.addEventListener('click', (ev) => { if (ev.target === el || ev.target.classList.contains('tr-chiudi')) el.hidden = true; });""",
    """    el.addEventListener('click', (ev) => { if (ev.target === el || ev.target.classList.contains('tr-chiudi')) el.hidden = true; if (ev.target.id === 'tasti-pers') { el.hidden = true; apriPersonalizza(); } });""")
open(W + '/app.js', 'w', encoding='utf-8').write(src)

h = open(W + '/index.html', encoding='utf-8').read()
def hrep(o, n):
    global h; assert h.count(o) == 1, o[:80]; h = h.replace(o, n)
i = h.index('<button id="btn-cancella"')
h = h[:i] + '<button id="btn-annulla" class="ico" title="Annulla (Ctrl+Z)" aria-label="Annulla" disabled><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg></button>\n        <button id="btn-ripeti" class="ico" title="Ripeti (Ctrl+Maiusc+Z)" aria-label="Ripeti" disabled><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></svg></button>\n        ' + h[i:]
hrep('<div id="grafico" class="grafico" hidden>', '<button id="grafico-chip" class="grafico-chip" type="button" hidden title="Mostra il grafico (istogramma della ROI o profilo)"></button>\n      <div id="grafico" class="grafico" hidden>')
hrep('title="Nascondi il grafico (riappare con la prossima linea o ROI)"', 'title="Chiudi il grafico (resta l\'etichetta per riaprirlo)"')
open(W + '/index.html', 'w', encoding='utf-8').write(h)
print('ok')
