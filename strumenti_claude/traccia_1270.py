# traccia_1270.py: traccia di lettura (dopo la risposta) e schema di lettura guidato (durante il caso) in app.js e style.css
import json, sys
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
s = open(W + 'app.js', encoding='utf-8').read()
def sost(a, b):
    global s
    n = s.count(a)
    if n != 1: sys.exit(f'trovato {n} volte: {a[:80]!r}')
    s = s.replace(a, b)

CODICE = r'''
// ---------------------------------------------------------------- traccia di lettura e schema di lettura (1.270)
// Mentre si legge un caso (prima della risposta) si annota ogni 250 ms l'immagine mostrata nel riquadro attivo e la
// finestra (polmone, tessuti molli, encefalo, osso). Le pause senza mouse, tastiera o tocco oltre 60 s non contano.
// - Schema di lettura: durante il caso, le finestre da usare per il distretto si spuntano da sole quando si è scorsa
//   con quella finestra almeno il 70% di una serie TC (oppure, fuori dalla TC, quando ogni serie è stata vista tutta).
// - Traccia di lettura: dopo la risposta, il tempo per immagine nella serie del reperto, se si è passati sul reperto e
//   con quale finestra: distingue l'errore di ricerca (reperto mai visto) da quello di interpretazione.
// Tutto resta nella pagina: non si invia né si salva niente.
const TR = { attivo: false, t: new Map(), fin: new Map(), tot: 0, ultimoInput: Date.now() };
function iniziaTraccia() { TR.attivo = !CLIENT; TR.t = new Map(); TR.fin = new Map(); TR.tot = 0; TR.ultimoInput = Date.now(); disegnaSchema(); }
for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, () => { TR.ultimoInput = Date.now(); }, { passive: true, capture: true });
const classeFinestra = (p) => {
  const im = p.img; if (!im || im.modalita !== 'CT' || !(p.ww > 0)) return 'altra';
  if (p.ww >= 1000 && p.wc <= -300) return 'polmone';
  if (p.ww >= 1000 && p.wc >= 150) return 'osso';
  if (p.ww <= 160 && p.wc >= 0 && p.wc <= 80) return 'encefalo';
  if (p.ww <= 700) return 'tessuti molli';
  return 'altra';
};
setInterval(() => {
  if (!TR.attivo || document.visibilityState !== 'visible' || $('#vista-caso')?.hidden || MPR.attivo || Date.now() - TR.ultimoInput > 60000) return;
  const p = P(V.attivo), s = V.serie?.[p?.sIdx]; if (!p?.img || !s || p.piano) return;
  const k = `${s._i}:${p.idx}`; TR.t.set(k, (TR.t.get(k) || 0) + 0.25); TR.tot += 0.25;
  const f = classeFinestra(p), m = TR.fin.get(k) || {}; m[f] = (m[f] || 0) + 0.25; TR.fin.set(k, m);
  if ((TR.tot * 4) % 4 === 0) disegnaSchema();
}, 250);
const secTr = (x) => (x < 10 ? x.toFixed(1).replace('.', ',') + ' s' : Math.round(x) + ' s');
// finestre da usare per il distretto del caso (solo TC); fuori dalla TC: ogni serie vista tutta
function vociSchema() {
  if (!V.caso || !V.serie?.length) return [];
  const tc = V.serie.some((s) => /^(CT|TC)$/i.test(s.modalita || '') || /\bTC\b|\bCT\b/.test(s.descrizione || '')) || /TC/.test(V.caso.modalita || '');
  if (!tc) return [{ id: 'tutte', nome: 'Tutte le immagini di ogni serie' }];
  const d = `${V.caso.distretto || ''} ${V.caso.titolo || ''}`.toLowerCase();
  if (/encefalo|cranio|testa|cervello/.test(d)) return [{ id: 'encefalo', nome: 'Encefalo' }, { id: 'osso', nome: 'Osso' }];
  if (/torace|polmon|mediastin|cuore/.test(d)) return [{ id: 'polmone', nome: 'Polmone' }, { id: 'tessuti molli', nome: 'Mediastino' }, { id: 'osso', nome: 'Osso' }];
  return [{ id: 'tessuti molli', nome: 'Tessuti molli' }, { id: 'polmone', nome: 'Basi polmonari' }, { id: 'osso', nome: 'Osso' }];
}
function statoSchema() {
  const voci = vociSchema(), fatto = {};
  for (const v of voci) {
    if (v.id === 'tutte') { fatto[v.id] = V.serie.every((s) => { const n = s.files?.length || 0; if (n < 2) return true; let k = 0; for (let i = 0; i < n; i++) if (TR.t.get(`${s._i}:${i}`)) k++; return k / n >= 0.9; }); continue; }
    fatto[v.id] = V.serie.some((s) => { const n = s.files?.length || 0; if (n < 10) return false; let k = 0; for (let i = 0; i < n; i++) if ((TR.fin.get(`${s._i}:${i}`) || {})[v.id]) k++; return k / n >= 0.7; });
  }
  return { voci, fatto };
}
function disegnaSchema() {
  let box = $('#schema-lettura');
  const form = $('#q-form');
  if (!form || CLIENT) return;
  if (!box) { box = document.createElement('div'); box.id = 'schema-lettura'; box.className = 'schema-lettura'; form.before(box); }
  const { voci, fatto } = statoSchema();
  box.hidden = !voci.length || !TR.attivo && !TR.tot;
  if (box.hidden) return;
  const html = `<b>Schema di lettura</b> ${voci.map((v) => `<span class="sl-voce${fatto[v.id] ? ' fatta' : ''}" title="${fatto[v.id] ? 'Fatto' : v.id === 'tutte' ? 'Scorri tutte le immagini di ogni serie' : 'Scorri almeno il 70% di una serie TC con questa finestra'}">${fatto[v.id] ? '✓' : '○'} ${esc(v.nome)}</span>`).join('')}`;
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
function htmlTraccia(r) {
  if (!TR.tot) return '';
  const v = r.vista, righe = [];
  for (const s of V.serie) { const n = s.files?.length || 0; if (n < 2) continue; let viste = 0, t = 0; for (let i = 0; i < n; i++) { const x = TR.t.get(`${s._i}:${i}`) || 0; if (x) { viste++; t += x; } } if (t) righe.push({ s, n, viste, t }); }
  let grafico = '', giudizio = '';
  const s = v && Number.isFinite(v.idx) ? V.serie.find((x) => x._i === v.serie) : null, n = s?.files?.length || 0;
  if (s && n) {
    const vals = Array.from({ length: n }, (_, i) => TR.t.get(`${s._i}:${i}`) || 0), max = Math.max(0.25, ...vals);
    const vicine = [v.idx - 1, v.idx, v.idx + 1].filter((i) => i >= 0 && i < n), tRep = vicine.reduce((a, i) => a + vals[i], 0);
    const fins = {}; for (const i of vicine) for (const [f, x] of Object.entries(TR.fin.get(`${s._i}:${i}`) || {})) fins[f] = (fins[f] || 0) + x;
    const finP = Object.entries(fins).sort((a, b) => b[1] - a[1])[0]?.[0], conFin = finP && finP !== 'altra' ? finP : '';
    giudizio = !tRep ? `<p class="tr-giudizio ko"><b>Non sei passato sull'immagine del reperto</b> (${esc(nomeSerie(s))}, immagine ${v.idx + 1}): è un errore di ricerca. Scorri tutta la serie, una zona alla volta.</p>`
      : r.perfetta ? `<p class="tr-giudizio ok">Hai guardato l'immagine del reperto per ${secTr(tRep)}${conFin ? ` con la finestra ${conFin}` : ''}.</p>`
      : `<p class="tr-giudizio medio"><b>Sei passato sull'immagine del reperto</b> (${secTr(tRep)}${conFin ? `, finestra ${conFin}` : ''}), ma la risposta non era esatta: più che un errore di ricerca è un errore di interpretazione. Rileggi la discussione.</p>`;
    const L = 300, A = 54, bw = L / n, xr = (v.idx + 0.5) * bw;
    grafico = `<svg class="tr-grafico" viewBox="0 0 ${L} ${A + 13}" role="img" aria-label="Tempo passato su ogni immagine della serie del reperto">${vals.map((x, i) => (x ? `<rect x="${(i * bw).toFixed(2)}" y="${(A - (x / max) * A).toFixed(1)}" width="${Math.max(bw - 0.3, 0.7).toFixed(2)}" height="${((x / max) * A).toFixed(1)}"/>` : '')).join('')}<line class="rep" x1="${xr.toFixed(1)}" x2="${xr.toFixed(1)}" y1="0" y2="${A}"/><text x="0" y="${A + 11}">1</text><text x="${L}" y="${A + 11}" text-anchor="end">${n}</text><text class="rep" x="${Math.min(L - 26, Math.max(26, xr)).toFixed(1)}" y="${A + 11}" text-anchor="middle">reperto</text></svg>
      <p class="muted small tr-leg">Tempo passato su ogni immagine di «${esc(nomeSerie(s))}»; la linea rossa è l'immagine del reperto.</p>`;
  }
  const { voci, fatto } = statoSchema(), mancate = voci.filter((x) => !fatto[x.id]);
  if (!giudizio && !righe.length) return '';
  return `<details class="tr-box" open><summary>Come hai letto il caso</summary>${giudizio}${grafico}
    ${righe.length ? `<ul class="tr-serie">${righe.map((x) => `<li><b>${esc(nomeSerie(x.s))}</b>: ${Math.round((x.viste / x.n) * 100)}% delle immagini viste · ${secTr(x.t)}</li>`).join('')}</ul>` : ''}
    ${mancate.length ? `<p class="small">Schema di lettura non completato: ${mancate.map((x) => esc(x.nome)).join(', ')}.</p>` : voci.length ? '<p class="small">Schema di lettura completato.</p>' : ''}
    <p class="muted small">Tempo di lettura: ${secTr(TR.tot)}. Calcolato in questa pagina, non viene salvato.</p></details>`;
}
'''
sost("// ---------------------------------------------------------------- volume semiautomatico e tempo di raddoppio", CODICE + "// ---------------------------------------------------------------- volume semiautomatico e tempo di raddoppio")
# inizio: all'apertura del caso; «Riprova» ricomincia
sost("  V.serie.forEach((s, i) => { s._i = i; });\n", "  V.serie.forEach((s, i) => { s._i = i; });\n  iniziaTraccia();\n")
sost("  if (b.dataset.stato === 'fatto') return renderQuiz();", "  if (b.dataset.stato === 'fatto') { const rq = renderQuiz(); iniziaTraccia(); return rq; }")
# fine: alla correzione; riquadro sotto l'esito
sost("    $('#q-esito').hidden = false;\n    const livEsito", "    TR.attivo = false;\n    $('#q-esito').hidden = false;\n    const livEsito")
sost("      requestAnimationFrame(() => $('#q-esito').scrollIntoView({ block: 'start', behavior: 'smooth' })); }",
     "      { const h = htmlTraccia(r); if (h) { const t = document.createElement('div'); t.innerHTML = h; const dopo = az.isConnected ? az : pt; if (dopo) dopo.after(t.firstElementChild); else $('#q-esito').prepend(t.firstElementChild); } }\n      disegnaSchema();\n      requestAnimationFrame(() => $('#q-esito').scrollIntoView({ block: 'start', behavior: 'smooth' })); }")
open(W + 'app.js', 'w', encoding='utf-8').write(s)

css = '''
/* ---- 1.270: schema di lettura (durante il caso) e traccia di lettura (dopo la risposta) */
.schema-lettura{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:0 0 10px;padding:8px 10px;border:1px solid var(--bord);border-radius:12px;background:var(--pan2);font-size:.85rem}
.schema-lettura[hidden]{display:none}
.sl-voce{padding:2px 9px;border-radius:999px;border:1px dashed var(--bord);color:var(--mut)}
.sl-voce.fatta{border-style:solid;border-color:color-mix(in srgb,var(--ok) 55%,var(--bord));background:var(--ok-bg);color:var(--ok);font-weight:700}
.tr-box{margin:10px 0;border:1px solid var(--bord);border-radius:14px;padding:10px 12px;background:var(--pan);box-shadow:var(--ombra-1)}
.tr-box summary{cursor:pointer;font-weight:700}
.tr-giudizio{margin:8px 0;padding:8px 10px;border-radius:10px;line-height:1.4}
.tr-giudizio.ok{background:var(--ok-bg)}.tr-giudizio.ko{background:var(--ko-bg)}.tr-giudizio.medio{background:var(--warn-bg)}
.tr-grafico{width:100%;height:auto;display:block;margin:6px 0 0}
.tr-grafico rect{fill:color-mix(in srgb,var(--acc) 72%,transparent)}
.tr-grafico line.rep{stroke:var(--ko);stroke-width:1.6;stroke-dasharray:3 2}
.tr-grafico text{font-size:9px;fill:var(--mut)}.tr-grafico text.rep{fill:var(--ko);font-weight:700}
.tr-leg{margin:2px 0 6px}
.tr-serie{margin:6px 0;padding-left:18px;font-size:.9rem}
'''
open(W + 'style.css', 'a', encoding='utf-8').write(css)

en = json.load(open(W + 'lingua/en.json', encoding='utf-8'))
for k, v in {
  'Schema di lettura': 'Reading scheme', 'Fatto': 'Done', 'Scorri tutte le immagini di ogni serie': 'Scroll through all images of every series',
  'Scorri almeno il 70% di una serie TC con questa finestra': 'Scroll through at least 70% of a CT series with this window',
  'Tutte le immagini di ogni serie': 'All images of every series', 'Encefalo': 'Brain', 'Osso': 'Bone', 'Polmone': 'Lung', 'Mediastino': 'Mediastinum',
  'Tessuti molli': 'Soft tissue', 'Basi polmonari': 'Lung bases', '✓ {x}': '✓ {x}', '○ {x}': '○ {x}',
  'Come hai letto il caso': 'How you read the case', "Non sei passato sull'immagine del reperto": 'You did not pass over the image with the finding',
  ' ({x}, immagine {x}): è un errore di ricerca. Scorri tutta la serie, una zona alla volta.': ' ({x}, image {x}): this is a search error. Scroll through the whole series, one region at a time.',
  "Hai guardato l'immagine del reperto per {x} con la finestra {x}.": 'You looked at the image with the finding for {x} with the {x} window.',
  "Hai guardato l'immagine del reperto per {x}.": 'You looked at the image with the finding for {x}.',
  "Sei passato sull'immagine del reperto": 'You passed over the image with the finding',
  ' ({x}, finestra {x}), ma la risposta non era esatta: più che un errore di ricerca è un errore di interpretazione. Rileggi la discussione.': ' ({x}, {x} window), but the answer was not exact: rather than a search error it is an interpretation error. Read the discussion again.',
  ' ({x}), ma la risposta non era esatta: più che un errore di ricerca è un errore di interpretazione. Rileggi la discussione.': ' ({x}), but the answer was not exact: rather than a search error it is an interpretation error. Read the discussion again.',
  'Tempo passato su ogni immagine di «{x}»; la linea rossa è l\'immagine del reperto.': 'Time spent on each image of "{x}"; the red line is the image with the finding.',
  ': {x}% delle immagini viste · {x}': ': {x}% of images seen · {x}', 'Schema di lettura non completato: {x}.': 'Reading scheme not completed: {x}.', 'Schema di lettura completato.': 'Reading scheme completed.',
  'Tempo di lettura: {x}. Calcolato in questa pagina, non viene salvato.': 'Reading time: {x}. Computed in this page, not saved.',
  'Tempo passato su ogni immagine della serie del reperto': 'Time spent on each image of the series with the finding', 'reperto': 'finding',
  'polmone': 'lung', 'tessuti molli': 'soft tissue', 'osso': 'bone', 'encefalo': 'brain',
  'Nodulo in vetro smerigliato (soglia −650 HU) · Volume {x} cm³ ({x} mm³) · RECIST {x} mm di diametro massimo (immagine {x}), aggiunto come misura: controllalo e correggilo se serve.': 'Ground-glass nodule (threshold −650 HU) · Volume {x} cm³ ({x} mm³) · RECIST {x} mm maximum diameter (image {x}), added as a measurement: check it and correct it if needed.',
  'Nodulo solido (soglia −400 HU) · Volume {x} cm³ ({x} mm³) · RECIST {x} mm di diametro massimo (immagine {x}), aggiunto come misura: controllalo e correggilo se serve.': 'Solid nodule (threshold −400 HU) · Volume {x} cm³ ({x} mm³) · RECIST {x} mm maximum diameter (image {x}), added as a measurement: check it and correct it if needed.',
  'Punto non adatto: clicca dentro il nodulo': 'Unsuitable point: click inside the nodule',
}.items(): en.setdefault(k, v)
open(W + 'lingua/en.json', 'w', encoding='utf-8').write(json.dumps(en, ensure_ascii=False))
print('fatto')
