#!/usr/bin/env python3
# 14/11: MPR/3D — «MPR» nel menu dei preset (al posto del pulsante 3D), preset scelto = 3D nel riquadro grande, lettino tolto
# di base («Aggiungi lettino»), Ritaglio con annulla e reset, contrasto sul 3D col tasto destro, OMP nell'MPR
import sys, shutil, os
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def leggi(p): return open(W + p, encoding='utf-8').read()
def scrivi(p, s):
    if not os.path.exists(W + p + '.bak_1114mpr'): shutil.copy(W + p, W + p + '.bak_1114mpr')
    open(W + p, 'w', encoding='utf-8').write(s)
def sost(s, a, b, n=1):
    c = s.count(a)
    if c != n: sys.exit(f'trovato {c} volte (attese {n}): {a[:100]!r}')
    return s.replace(a, b)

s = leggi('app.js')
s = sost(s, """    const sel = $('#mpr-preset');
    if (!sel.options.length) sel.innerHTML = ['TC', 'RM'].map((g) => `<optgroup label="3D ${g}">${MPR.modulo.PRESET_3D.filter((x) => (x[2] || 'TC') === g).map(([v, t]) => `<option value="${v}">3D: ${t}</option>`).join('')}</optgroup>`).join('');
    // preset 3D scelto dal tipo di esame: angio-TC (vasi e ossa, con MIP di 10 mm nei piani), osso, polmone, cuore
    const testoSerie = `${V.caso?.titolo || ''} ${V.caso?.titolo_interno || ''} ${V.caso?.quesito || ''} ${V.caso?.distretto || ''} ${s.descrizione || ''}`;
    const angio = /angio|arterios|aort|vasi|embolia|cta\\b|tsa\\b/i.test(testoSerie);
    if (!MPR.presetScelto) sel.value = angio ? 'CT-AAA' : /cuore|cardi|coronar/i.test(testoSerie) ? 'CT-Cardiac' : /polmon|hrct|interstiz/i.test(testoSerie) ? 'CT-Lung'
      : /osso|ossa|rachide|bacino|frattur|trauma|vertebr|scheletr/i.test(testoSerie) ? 'CT-Bone' : 'CT-AAA';
    if (!MPR.presetScelto && f0.modalita === 'MR') sel.value = /angio|tof|vasi/i.test(testoSerie) ? 'MR-Angio' : 'MR-Default';""",
"""    // 14/11: menu del 3D: prima «MPR» (solo i piani, all'apertura), poi i preset della metodica (Willis in alto negli esami neuro)
    const sel = $('#mpr-preset'), gruppo = f0.modalita === 'MR' ? 'RM' : 'TC', neuro = esameNeuro();
    const voci = MPR.modulo.PRESET_3D.filter((x) => x[2] === gruppo && (!x[3] || neuro)).sort((a, b) => (neuro ? !!b[3] - !!a[3] : 0));
    sel.innerHTML = `<option value="mpr" class="opt-mpr">MPR</option><optgroup label="3D ${gruppo}">${voci.map(([v, t]) => `<option value="${v}">3D: ${t}</option>`).join('')}</optgroup>`;
    sel.value = 'mpr';""")
s = sost(s, """      fette, wc, ww, modalita: f0.modalita || 'CT', preset: sel.value || 'CT-AAA',""", """      fette, wc, ww, modalita: f0.modalita || 'CT', preset: f0.modalita === 'MR' ? 'MR-Default' : 'CT-AAA',""")
s = sost(s, """    caricaIA(s, mio);""", """    caricaIA(s, mio);
    $('#mpr-omp').hidden = !esameNeuro(); aggiornaTagli();""")
s = sost(s, """$('#mpr-preset').addEventListener('change', (e) => { T.vr = true; MPR.presetScelto = true; MPR.modulo?.preset3d(e.target.value); });""",
"""// scelta nel menu: «MPR» toglie il 3D; un preset mostra il 3D nel riquadro grande (le viste piccole restano i piani)
$('#mpr-preset').addEventListener('change', (e) => {
  MPR.presetScelto = true; const tre = e.target.value !== 'mpr';
  mostra3D(tre); if (tre) { T.vr = true; aggiorna3d(); }
});
function mostra3D(on) {
  const m = $('#mpr'), era = !m.classList.contains('senza-3d');
  m.classList.toggle('senza-3d', !on); m.classList.remove('solo'); qsAll('.mpr-cella').forEach((c) => c.classList.remove('scelta'));
  if (on && !era) { const i = MPR_POS.ordine.indexOf('3d'); if (i > 0) { MPR_POS.ordine.splice(i, 1); MPR_POS.ordine.unshift('3d'); } }
  if (!on) { ritaglio(false); if (MPR_POS.ordine[0] === '3d') MPR_POS.ordine.push(MPR_POS.ordine.shift()); }
  disponiMPR(); setTimeout(() => MPR.modulo?.ridimensiona(), 30);
}""")
s = sost(s, """async function aggiorna3d() {
  if (!MPR.modulo?.volume3d) { $('#mpr-info').textContent = 'Funzione non disponibile: ricarica la pagina (versione vecchia in memoria)'; $('#vr-lettino').checked = $('#vr-osso').checked = $('#vr-gabbia').checked = false; return; }
  statoMPR('Elaboro il 3D…'); await pausa(30);
  try {
    const r = await MPR.modulo.volume3d({ lettino: $('#vr-lettino').checked, osso: $('#vr-osso').checked, gabbia: $('#vr-gabbia').checked, preset: $('#mpr-preset').value });
    if (r && !r.ok && r.motivo) { $('#mpr-info').textContent = 'Senza lettino/osso: ' + r.motivo; $('#vr-lettino').checked = $('#vr-osso').checked = $('#vr-gabbia').checked = false; }
    T.vr = true;
  } catch (e) { console.error(e); alert('Elaborazione del 3D non riuscita: ' + e.message); }
  statoMPR('');
}""", """async function aggiorna3d() {
  if (!MPR.modulo?.vista3d) { $('#mpr-info').textContent = 'Funzione non disponibile: ricarica la pagina (versione vecchia in memoria)'; return; }
  const sel = $('#mpr-preset'); if (sel.value === 'mpr') return;
  statoMPR(/^QR-(vascular|willis|angiography)/.test(sel.value) ? 'Estraggo i vasi (tolgo osso e lettino)…' : 'Elaboro il 3D…'); await pausa(30);
  try {
    const r = await MPR.modulo.vista3d({ tipo: sel.value, lettino: $('#vr-lettino').checked, osso: $('#vr-osso').checked, gabbia: $('#vr-gabbia').checked });
    $('#mpr-info').textContent = r && !r.ok && r.motivo ? '3D: ' + r.motivo : r?.avviso ? '3D: ' + r.avviso : '';
    T.vr = true;
  } catch (e) { console.error(e); alert('Elaborazione del 3D non riuscita: ' + e.message); }
  statoMPR(''); aggiornaTagli();
}""")
s = sost(s, """// scegliendo un preset del 3D o «senza lettino / osso / gabbia» il 3D compare
['#mpr-preset', '#vr-lettino', '#vr-osso', '#vr-gabbia'].forEach((id) => $(id)?.addEventListener('change', () => { if ($('#mpr').classList.contains('senza-3d')) $('#mpr-3d').click(); }));""",
"""// «aggiungi lettino / senza osso / gabbia» con il solo MPR: si mostra il 3D con il primo preset della metodica
['#vr-lettino', '#vr-osso', '#vr-gabbia'].forEach((id) => $(id)?.addEventListener('change', () => {
  const sel = $('#mpr-preset'); if (sel.value !== 'mpr') return;
  sel.value = sel.querySelector('optgroup option')?.value || 'mpr'; if (sel.value !== 'mpr') mostra3D(true);
}, true));""")
s = sost(s, """$('#mpr-3d').addEventListener('click', () => {
  $('#mpr').classList.toggle('senza-3d'); $('#mpr').classList.remove('solo'); qsAll('.mpr-cella').forEach((c) => c.classList.remove('scelta'));
  disponiMPR(); T.vr = true; setTimeout(() => MPR.modulo?.ridimensiona(), 30);
  if (!$('#mpr').classList.contains('senza-3d') && esameNeuro() && MPR.vasiAuto !== MPR.token) {
    MPR.vasiAuto = MPR.token;
    const tc = MPR.modulo?.unita?.() === 'HU', sel = $('#mpr-preset');
    if (sel && !MPR.presetScelto) { const pr = tc ? 'CT-AAA' : 'MR-Angio'; if ([...sel.options].some((o) => o.value === pr)) { sel.value = pr; MPR.modulo?.preset3d(pr); } }
    setTimeout(() => { const s = $('#mpr-seg'); if (s && [...s.options].some((o) => o.value === 'vasi')) { s.value = 'vasi'; s.dispatchEvent(new Event('change')); } }, 120);
  }
});""", """// (il vecchio pulsante «3D» resta nascosto: il 3D si sceglie dal menu, «MPR» lo toglie)
$('#mpr-3d').addEventListener('click', () => {
  const sel = $('#mpr-preset'), on = $('#mpr').classList.contains('senza-3d');
  sel.value = on ? (sel.querySelector('optgroup option')?.value || 'mpr') : 'mpr'; sel.dispatchEvent(new Event('change'));
});
// ---- Ritaglio a mano libera nel 3D (forbici): si disegna attorno a ciò che si vuole togliere; ↶ annulla l'ultimo, ⟲ li toglie tutti
const RIT = { attivo: false, tela: null, punti: null };
function aggiornaTagli() {
  const n = MPR.modulo?.numeroTagli?.() || 0;
  if ($('#mpr-taglio-annulla')) $('#mpr-taglio-annulla').disabled = !n;
  if ($('#mpr-taglio-reset')) $('#mpr-taglio-reset').disabled = !n;
  $('#mpr-taglio')?.classList.toggle('on', RIT.attivo);
}
function ritaglio(on) {
  RIT.attivo = on; const cella = cellaMPR('3d');
  if (on && !RIT.tela && cella) {
    const t = RIT.tela = Object.assign(document.createElement('canvas'), { className: 'mpr-ritaglio', title: 'Disegna attorno a ciò che vuoi togliere dal 3D (Esc per uscire)' });
    cella.appendChild(t);
    const disegna = () => { const c = t.getContext('2d'); c.clearRect(0, 0, t.width, t.height); if (!RIT.punti?.length) return;
      c.lineWidth = 2; c.strokeStyle = '#ffd34d'; c.fillStyle = 'rgba(255,211,77,.18)'; c.setLineDash([6, 4]); c.beginPath();
      RIT.punti.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.stroke(); };
    t.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); const r = t.getBoundingClientRect(); t.width = r.width; t.height = r.height; RIT.punti = [[e.clientX - r.left, e.clientY - r.top]]; t.setPointerCapture(e.pointerId); disegna(); });
    t.addEventListener('pointermove', (e) => { if (!RIT.punti) return; const r = t.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top], u = RIT.punti[RIT.punti.length - 1];
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) > 3) { RIT.punti.push(p); disegna(); } });
    t.addEventListener('pointerup', async () => {
      const pts = RIT.punti; RIT.punti = null; if (!pts || pts.length < 3) { disegna(); return; }
      const r = t.getBoundingClientRect(), vp = $('#vp-3d').getBoundingClientRect(), dx = r.left - vp.left, dy = r.top - vp.top;
      statoMPR('Ritaglio…'); await pausa(20);
      try { const x = await MPR.modulo?.taglia?.(pts.map(([a, b]) => [a + dx, b + dy]), vp.width, vp.height); if (!x?.ok) avvisoBreve('Ritaglio non riuscito: scegli prima un 3D dal menu'); T.ritagli = (T.ritagli || 0) + 1; }
      catch (e) { console.error(e); avvisoBreve('Ritaglio non riuscito: ' + e.message); }
      statoMPR(''); disegna(); aggiornaTagli();
    });
  }
  if (RIT.tela) RIT.tela.hidden = !on;
  aggiornaTagli();
}
$('#mpr-taglio')?.addEventListener('click', () => {
  if (!RIT.attivo && $('#mpr-preset').value === 'mpr') { const sel = $('#mpr-preset'); sel.value = sel.querySelector('optgroup option')?.value || 'mpr'; sel.dispatchEvent(new Event('change')); }
  ritaglio(!RIT.attivo); if (RIT.attivo) avvisoBreve('✂ Ritaglio: disegna sul 3D attorno a ciò che vuoi togliere. ↶ annulla l\\'ultimo, ⟲ torna al volume intero');
});
$('#mpr-taglio-annulla')?.addEventListener('click', async () => { statoMPR('Ritaglio…'); await pausa(20); await MPR.modulo?.annullaTaglio?.(); statoMPR(''); aggiornaTagli(); });
$('#mpr-taglio-reset')?.addEventListener('click', async () => { statoMPR('Ritaglio…'); await pausa(20); await MPR.modulo?.azzeraTagli?.(); statoMPR(''); aggiornaTagli(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && RIT.attivo) ritaglio(false); });
// ---- contrasto del 3D: tasto destro trascinato sulla vista 3D (come la finestra nei piani): su/giù sposta la soglia
// (giù = strutture meno dense, fino ai tessuti molli e alla cute), destra/sinistra stringe o allarga la rampa
(() => {
  const c = cellaMPR('3d'); if (!c) return; let st = null;
  c.addEventListener('pointerdown', (e) => { if (e.button !== 2 || e.target.closest('.mpr-ritaglio')) return; e.preventDefault(); e.stopPropagation();
    const s0 = MPR.modulo?.statoContrasto3d?.() || { sposta: 0, scala: 1 }; st = { x: e.clientX, y: e.clientY, ...s0 }; c.setPointerCapture(e.pointerId); }, true);
  c.addEventListener('pointermove', (e) => { if (!st) return; e.stopPropagation(); MPR.modulo?.contrasto3d?.(st.sposta - (e.clientY - st.y) * 3, st.scala * Math.exp((e.clientX - st.x) / 250)); T.contrasto3d = true; }, true);
  const fine = (e) => { if (!st) return; st = null; try { c.releasePointerCapture(e.pointerId); } catch {} };
  c.addEventListener('pointerup', fine, true); c.addEventListener('pointercancel', fine, true);
  c.addEventListener('contextmenu', (e) => e.preventDefault());
})();
// ---- OMP nell'MPR: i tre piani orientati sul piano orbito-meatale; «⊞ Serie» salva la serie su quel piano
$('#mpr-omp')?.addEventListener('click', async () => {
  const si = V.sIdx;
  try {
    const o = V.serie[si]?._omp || await calcolaOMP(si, (t) => statoMPR(t));
    statoMPR('');
    if (!MPR.modulo?.orientaPiani?.(o.R)) throw new Error('MPR non pronto');
    avvisoBreve(o.testo.replace(/OMP o Ax per le immagini originali\\./, '«⊞ Serie» salva la serie su questo piano; Reset per i piani standard.'));
  } catch (e) { statoMPR(''); avvisoBreve('Piano orbito-meatale non trovato: ' + e.message); }
});""")
s = sost(s, """function azzeraElaborazioni() {
  $('#vr-lettino').checked = $('#vr-osso').checked = $('#vr-gabbia').checked = false;""", """function azzeraElaborazioni() {
  if (typeof RIT !== 'undefined') { ritaglio(false); RIT.tela?.remove(); RIT.tela = null; }
  $('#vr-lettino').checked = $('#vr-osso').checked = $('#vr-gabbia').checked = false;""")
scrivi('app.js', s)

h = leggi('index.html')
h = sost(h, """<button id="mpr-3d" type="button" class="ico" title""", """<button id="mpr-3d" type="button" class="ico" hidden title""")
h = sost(h, """<label class="check" title="3D senza il lettino della TC (resta solo il corpo)"><input type="checkbox" id="vr-lettino"> Senza lettino</label>""",
"""<label class="check" title="Il lettino della TC è tolto di base dal 3D: spunta per rimetterlo"><input type="checkbox" id="vr-lettino"> Aggiungi lettino</label>""")
h = sost(h, """<label class="check" title="3D senza la gabbia toracica (coste, sterno, clavicole, scapole): restano colonna, cuore, polmoni e vasi del torace"><input type="checkbox" id="vr-gabbia"> Senza gabbia toracica</label>""",
"""<label class="check" title="3D senza la gabbia toracica (coste, sterno, clavicole, scapole): restano colonna, cuore, polmoni e vasi del torace"><input type="checkbox" id="vr-gabbia"> Senza gabbia toracica</label>
        <button id="mpr-taglio" type="button" class="ico" title="Ritaglio a mano libera nel 3D: disegna attorno a ciò che vuoi togliere (tutto lo spessore nella direzione di vista)" aria-label="Ritaglio"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg></button>
        <button id="mpr-taglio-annulla" type="button" class="ico" title="Annulla l'ultimo ritaglio" aria-label="Annulla ritaglio" disabled><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button>
        <button id="mpr-taglio-reset" type="button" class="ico" title="Togli tutti i ritagli: di nuovo il volume intero" aria-label="Azzera ritagli" disabled><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button>""")
h = sost(h, """        <button id="mpr-obliqua" """, """        <button id="mpr-omp" type="button" hidden title="Piano orbito-meatale (OMP): i tre piani orientati dal canto esterno dell'occhio al centro del meato acustico esterno; poi «⊞ Serie» salva la serie su quel piano">OMP</button>
        <button id="mpr-obliqua" """)
scrivi('index.html', h)

c = leggi('style.css')
c += """
/* 14/11: MPR e 3D */
#mpr-preset .opt-mpr{font-weight:700}
.mpr-centro{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid #fff;background:rgba(255,196,0,.9);box-shadow:0 0 0 1px rgba(0,0,0,.6);cursor:move;z-index:6;touch-action:none}
.mpr-centro:hover{transform:scale(1.25)}
.mpr-ritaglio{position:absolute;inset:0;width:100%;height:100%;z-index:7;cursor:crosshair;touch-action:none}
#mpr-omp{font-weight:700;font-size:12px}
"""
scrivi('style.css', c)
print('ok')
