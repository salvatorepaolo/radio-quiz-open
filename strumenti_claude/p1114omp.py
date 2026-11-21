#!/usr/bin/env python3
# 14/11: piano orbito-meatale (OMP) dai punti di repere; pulsante OMP accanto a Sag (attiva/disattiva)
import sys, shutil, os, json
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def leggi(p): return open(W + p, encoding='utf-8').read()
def scrivi(p, s):
    if not os.path.exists(W + p + '.bak_1114omp'): shutil.copy(W + p, W + p + '.bak_1114omp')
    open(W + p, 'w', encoding='utf-8').write(s)
def sost(s, a, b, n=1):
    c = s.count(a)
    if c != n: sys.exit(f'trovato {c} volte (attese {n}): {a[:100]!r}')
    return s.replace(a, b)
JS = open('/Volumes/Caloggero/strumenti_claude/omp/omp_js.txt', encoding='utf-8').read()
s = leggi('app.js')
s = sost(s, """// ---- encefalo raddrizzato in automatico: piano medio-sagittale per simmetria destra-sinistra (rotazioni attorno
// all'asse cranio-caudale e antero-posteriore), poi l'asse antero-posteriore del cervello nel piano medio (vicino alla
// linea fronto-meatale / bicommissurale) per l'inclinazione. Si crea la serie assiale raddrizzata (come «⊞ Serie»).
async function raddrizzaEncefalo(k = V.attivo, { auto = false } = {}) {
  const p = P(k); if (!p.img?.ipp || p.piano || !pianoPossibile(p)) { if (!auto) avvisoBreve('Serve una serie volumetrica TC o RM dell\\'encefalo'); return false; }
  const si = p.sIdx, box = $('#caricamento'), stato = (t) => { box.hidden = false; box.textContent = t; };
  try {""", JS + """// ---- encefalo sul piano orbito-meatale (OMP), in automatico all'apertura e con il pulsante «OMP» accanto a Sag:
// piano medio-sagittale per simmetria destra-sinistra, poi l'inclinazione dai punti di repere (canto esterno / globo
// oculare e centro del meato acustico esterno, dai due lati: puntiOMP). Senza punti di repere affidabili: asse
// antero-posteriore del cervello nel piano medio (stima). Si crea la serie assiale raddrizzata (come «⊞ Serie»);
// di nuovo «OMP» (o Ax) torna alle immagini originali. Il piano si ricorda per la serie: la seconda volta è immediato.
async function raddrizzaEncefalo(k = V.attivo, { auto = false } = {}) {
  let p = P(k);
  if (p.piano && p.ompUrl && p.frames[0]?.url === p.ompUrl) {   // OMP attivo: si torna alle immagini originali
    if (auto) return true;
    await pianoRiquadro('assiale', k); aggiornaPulsanteOMP(); return false;
  }
  if (p.piano && p.frames.length) { await selezionaSerie(p.sIdx, k); p = P(k); }   // da un'altra ricostruzione: prima le originali
  if (!p.img?.ipp || p.piano || !pianoPossibile(p)) { if (!auto) avvisoBreve('Serve una serie volumetrica TC o RM dell\\'encefalo'); return false; }
  const si = p.sIdx, box = $('#caricamento'), stato = (t) => { box.hidden = false; box.textContent = t; };
  const fatto = V.serie[si]?._omp;
  if (fatto) { await serieDalPiano(si, fatto.pv, 'assiale', k); P(k).ompUrl = P(k).frames[0]?.url; aggiornaPulsanteOMP(); if (!auto) avvisoBreve(fatto.testo); return true; }
  try {""")
s = sost(s, """    if (best.r < 0.4) throw new Error('simmetria non trovata');
    let Hh = Rzy(best.yaw, best.roll); if (Hh[0] < 0) Hh = Hh.map((x) => -x);
    const cm = [c[0] + best.d * Hh[0], c[1] + best.d * Hh[1], c[2] + best.d * Hh[2]];""", """    if (best.r < 0.4) throw new Error('simmetria non trovata');
    let Hh = Rzy(best.yaw, best.roll); if (Hh[0] < 0) Hh = Hh.map((x) => -x);
    const cm = [c[0] + best.d * Hh[0], c[1] + best.d * Hh[1], c[2] + best.d * Hh[2]];
    stato('Piano orbito-meatale: cerco orbite e meati acustici…'); await pausa(20);
    let omp = null; try { omp = puntiOMP(vol, cm, Hh, tc, soglia, st); } catch (e) { console.warn('OMP', e); }
    if (omp) console.info('OMP', omp.ok ? 'dai punti di repere' : omp.motivo, omp);""")
s = sost(s, """    let phi = 0.5 * Math.atan2(2 * syz, syy - szz) * 180 / Math.PI; phi = Math.max(-25, Math.min(25, phi));
    const ph = phi * Math.PI / 180, Dn = unit3(y1.map((x, i) => x * Math.cos(ph) + z1[i] * Math.sin(ph))), S = unit3(croce3(Hh, Dn));
    const pv = { normale: S.map((x) => -x), su: Dn.map((x) => -x), centro: cm };
    box.hidden = true;
    await serieDalPiano(si, pv, 'assiale', k);
    const gradi = (u, v) => Math.round(Math.acos(Math.min(1, Math.abs(dot3(u, v)))) * 180 / Math.PI);
    avvisoBreve(`🧠 Encefalo raddrizzato (stima automatica: ${gradi(Hh, [1, 0, 0])}° di lato, ${Math.round(Math.abs(phi))}° di inclinazione). Ax per le immagini originali.`);
    T.raddrizzato = true; return true;""", """    let phi = 0.5 * Math.atan2(2 * syz, syy - szz) * 180 / Math.PI; phi = Math.max(-25, Math.min(25, phi));
    const ph = phi * Math.PI / 180, Dn = omp?.ok ? unit3(omp.Dn.map((x, i) => x - dot3(omp.Dn, Hh) * Hh[i])) : unit3(y1.map((x, i) => x * Math.cos(ph) + z1[i] * Math.sin(ph))), S = unit3(croce3(Hh, Dn));
    const pv = { normale: S.map((x) => -x), su: Dn.map((x) => -x), centro: omp?.ok ? omp.punto : cm };
    box.hidden = true;
    await serieDalPiano(si, pv, 'assiale', k);
    const gradi = (u, v) => Math.round(Math.acos(Math.min(1, Math.abs(dot3(u, v)))) * 180 / Math.PI);
    const incl = gradi(Dn, [0, 1, 0]);
    const testo = omp?.ok ? `🧠 Piano orbito-meatale (OMP) dai punti di repere: globi oculari / canto esterno e meati acustici esterni, dai due lati (${gradi(Hh, [1, 0, 0])}° di lato, ${incl}° di inclinazione). OMP o Ax per le immagini originali.`
      : `🧠 Encefalo raddrizzato (stima dall'asse del cervello: ${omp?.motivo || 'punti di repere non trovati'}; ${gradi(Hh, [1, 0, 0])}° di lato, ${incl}° di inclinazione). OMP o Ax per le immagini originali.`;
    V.serie[si]._omp = { pv, testo, ok: !!omp?.ok, punti: omp?.ok ? { globi: omp.globi, meati: omp.meati } : null, R: { X: Hh, D: Dn, S, centro: cm } };
    P(k).ompUrl = P(k).frames[0]?.url; aggiornaPulsanteOMP();
    avvisoBreve(testo);
    T.raddrizzato = true; return true;""")
s = sost(s, """function aggiornaPulsantiNeuro() {
  const neuro = typeof esameNeuro === 'function' && esameNeuro();
  if ($('#btn-raddrizza')) $('#btn-raddrizza').hidden = !neuro;""", """function aggiornaPulsanteOMP() {
  const b = $('#btn-raddrizza'); if (!b) return; const p = P();
  const on = !!(p?.piano && p.ompUrl && p.frames[0]?.url === p.ompUrl); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
}
function aggiornaPulsantiNeuro() {
  const neuro = typeof esameNeuro === 'function' && esameNeuro();
  if ($('#btn-raddrizza')) { $('#btn-raddrizza').hidden = !neuro; aggiornaPulsanteOMP(); }""")
# lo stato del pulsante segue il riquadro attivo e i cambi di piano
s = sost(s, """  g.querySelectorAll('[data-piano]').forEach((b) => { b.classList.toggle('on', ok && b.dataset.piano === att); b.disabled = !ok; });
}""", """  g.querySelectorAll('[data-piano]').forEach((b) => { b.classList.toggle('on', ok && b.dataset.piano === att && !(p.ompUrl && p.frames[0]?.url === p.ompUrl)); b.disabled = !ok; });
  aggiornaPulsanteOMP();
}""")
s = sost(s, "registraArchivio, ULTIMO, NOD, NODC, rett: rettangolo,", "registraArchivio, ULTIMO, NOD, NODC, rett: rettangolo, puntiOMP, raddrizzaEncefalo, volumeDi, vaiPunto: async (w, k = V.attivo) => { const p = P(k); const t = await fettaVicina(p.frames, w, null).catch(() => null); if (t) await mostraDi(k, t.i); },")
scrivi('app.js', s)

h = leggi('index.html')
i0 = h.index('<button id="btn-raddrizza"'); i1 = h.index('</button>', i0) + len('</button>')
vecchio = h[i0:i1]; h = h[:i0] + h[i1:]
nuovo = '<button id="btn-raddrizza" type="button" hidden aria-pressed="false" title="Piano orbito-meatale (OMP): dal canto esterno dell\'occhio al centro del meato acustico esterno, dai due lati (punti di repere trovati in automatico). Di nuovo per tornare alle immagini originali">OMP</button>'
h = sost(h, """        <button data-piano="sagittale" title="Sagittale ricostruita nel solo riquadro attivo, senza aprire l'MPR (S)">Sag</button>""",
"""        <button data-piano="sagittale" title="Sagittale ricostruita nel solo riquadro attivo, senza aprire l'MPR (S)">Sag</button>
        """ + nuovo)
scrivi('index.html', h)
print('ok', vecchio[:60])
