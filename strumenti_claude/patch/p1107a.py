# 1.213: RM cardiaca senza pila di asse corto: FE del VS dall'asse lungo (area-lunghezza monoplano o biplano)
import json, sys
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)

c = open(R + 'cmr.js', encoding='utf-8').read()
c = sost(c, "export function segmentaCavita(img, seme, { k = 0.55, raggioMm = 50, riempi = true, minSangue = 0.45 } = {}) {",
  "// limite (facoltativo): funzione (x, y) → false per i pixel da non attraversare (es. oltre il piano valvolare mitralico)\n"
  "export function segmentaCavita(img, seme, { k = 0.55, raggioMm = 50, riempi = true, minSangue = 0.45, limite = null } = {}) {", 'firma')
c = sost(c, "      if (!dentro(xx + x0, yy + y0)) { tocchi++; continue; }\n",
  "      if (!dentro(xx + x0, yy + y0)) { tocchi++; continue; }\n      if (limite && !limite(xx + x0, yy + y0)) continue;\n", 'limite')
open(R + 'cmr.js', 'w', encoding='utf-8').write(c)

a = open(R + 'app.js', encoding='utf-8').read()
# modalità e aiuto
a = sost(a, "lge: '7 · Enhancement tardivo (LGE)' }).map(([k, n]) => `<option value=\"${k}\"${k === CMR.modo ? ' selected' : ''}>${n}</option>`).join('')}</select>",
  "lge: '7 · Enhancement tardivo (LGE)', al: '8 · FE del VS dall\\'asse lungo (area-lunghezza)' }).map(([k, n]) => `<option value=\"${k}\"${k === CMR.modo ? ' selected' : ''}>${n}</option>`).join('')}</select>", 'opzione')
a = sost(a, "const AIUTO_CMR = {\n",
  "const AIUTO_CMR = {\n"
  "  al: 'Senza pila di asse corto: apri la cine in asse lungo (2 o 4 camere), vai in fine diastole e clicca i due punti dell\\'anulus mitralico, poi il centro della cavità del VS; ripeti in fine sistole. Il contorno si ferma al piano valvolare; volume = 0,85 × area² / lunghezza (biplano con 2 e 4 camere).',\n", 'aiuto')
# stato
a = sost(a, "function azzeraCmr() { CMR.noSax = false;", "function azzeraCmr() { CMR.noSax = false; CMR.al = { tracce: {} };", 'azzera')
# automatico: senza asse corto passa all'asse lungo
a = sost(a, "async function autoCmr() {\n  if (P(V.attivo) && isMultiEco(P(V.attivo))) { avvisoBreve(MSG_MULTIECO); return; }\n  const sax = await trovaSax(); if (!sax) { CMR.noSax = true; avvisoBreve(msgNoSax()); pannelloCmr(); return; }",
  "async function autoCmr() {\n  const sax = await trovaSax();\n"
  "  if (!sax) { const lax = serieAsseLungo();\n"
  "    if (lax.length) { CMR.modo = 'al'; CMR.noSax = false; CMR.al ||= { tracce: {} }; const si = lax[0]; await selezionaSerie(si, V.attivo, { idx: faseAl(si).ed }); disegna(); pannelloCmr();\n"
  "      avvisoBreve('Manca la pila di asse corto: misura la FE del VS sulla cine in asse lungo (metodo area-lunghezza). In fine diastole clicca i due punti dell\\'anulus mitralico e poi la cavità.'); return; }\n"
  "    CMR.noSax = true; avvisoBreve(msgNoSax()); pannelloCmr(); return; }\n"
  "  if (P(V.attivo) && isMultiEco(P(V.attivo))) await selezionaSerie(sax[Math.floor(sax.length / 2)].si, V.attivo, { idx: 0 });", 'auto')
# clic
a = sost(a, "async function puntoCmr(k, pt) {\n  const p = P(k), img = p.img; if (!img) return;\n",
  "async function puntoCmr(k, pt) {\n  const p = P(k), img = p.img; if (!img) return;\n  if (CMR.modo === 'al') { await puntoAsseLungo(p, pt); return; }\n", 'clic')
FUNZ = r'''// ---- FE del VS dall'asse lungo (quando manca la pila di asse corto): metodo area-lunghezza. Per ogni fase (fine diastole
// e fine sistole) si cliccano i due punti dell'anulus mitralico e il centro della cavità: il contorno si cerca solo dal lato
// della cavità rispetto al piano valvolare; L = dal punto medio dell'anulus al punto più lontano (apice).
// V = 0,85 · A² / L (monoplano), V = 0,85 · A₁ · A₂ / L (biplano 2 + 4 camere, L la più corta).
const RE_LAX = /2\s*-?\s*(cam|ch)|4\s*-?\s*(cam|ch)|3\s*-?\s*(cam|ch)|asse lungo|long ax|\blax\b|\b[234]ch\b/i;
function serieAsseLungo() {
  return V.serie.map((s, si) => ({ s, si })).filter(({ s, si }) => (s.files?.length || 0) >= 8 && !(ME.get(si)?.eco) && !ME_NOME.test(s.descrizione || '')
    && (RE_LAX.test(s.descrizione || '') || (/cine|ssfp|fiesta|trufi|balance/i.test(s.descrizione || '') && !/asse corto|short|\bsax\b/i.test(s.descrizione || ''))))
    .sort((x, y) => (/2\s*-?\s*(cam|ch)/i.test(y.s.descrizione) - /2\s*-?\s*(cam|ch)/i.test(x.s.descrizione))).map((x) => x.si);
}
const vistaAl = (si) => { const d = V.serie[si]?.descrizione || ''; return /4\s*-?\s*(cam|ch)/i.test(d) ? '4 camere' : /2\s*-?\s*(cam|ch)/i.test(d) ? '2 camere' : /3\s*-?\s*(cam|ch)/i.test(d) ? '3 camere' : 'asse lungo'; };
function faseAl(si) { CMR.al ||= { tracce: {} }; const n = V.serie[si]?.files.length || 1; return (CMR.al.tracce[si] ||= { ed: 0, es: Math.round(n * 0.35), fasi: {} }); }
async function puntoAsseLungo(p, pt) {
  if (isMultiEco(p)) { avvisoBreve(MSG_MULTIECO); return; }
  const si = p.sIdx, n = V.serie[si]?.files.length || 0;
  if (n < 8) { avvisoBreve('Serve una cine in asse lungo (2 o 4 camere) con le fasi del ciclo.'); return; }
  const t = faseAl(si), quale = p.idx === t.ed ? 'ed' : p.idx === t.es ? 'es' : null;
  if (!quale) { avvisoBreve('Vai in fine diastole o in fine sistole (pulsanti «Vai» nella scheda), poi clicca.'); return; }
  const f = (t.fasi[quale] ||= { punti: [] });
  if (f.r) { f.punti = []; f.r = null; delete CMR.seg[`al|${si}|${p.idx}`]; }
  f.punti.push({ x: pt.x, y: pt.y });
  if (f.punti.length < 3) { avvisoBreve(f.punti.length === 1 ? 'Ora il secondo punto dell\'anulus mitralico.' : ''); disegna(); pannelloCmr(); return; }
  const [a1, a2, seme] = f.punti, im = await imgCmr(si, p.idx), lato = (q) => (a2.x - a1.x) * (q.y - a1.y) - (a2.y - a1.y) * (q.x - a1.x), sSeme = Math.sign(lato(seme));
  const limite = (x, y) => Math.sign(lato({ x, y })) === sSeme;
  let r = null; for (const dk of [0, 0.1, 0.2]) { r = CM.segmentaCavita(im, seme, { k: Math.min(0.9, CMR.k + dk), riempi: CMR.riempi, raggioMm: 90, minSangue: 0.4, limite }); if (!r || r.perdita <= 0.12) break; }
  if (!r) { avvisoBreve('Non trovo la cavità: clicca più al centro del ventricolo (i due punti dell\'anulus restano).'); f.punti = [a1, a2]; disegna(); pannelloCmr(); return; }
  const m = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 }, mm = (q) => Math.hypot((q.x - m.x) * (im.spCol || 1), (q.y - m.y) * (im.spRow || 1));
  let apice = r.bordo[0], L = 0; for (const q of r.bordo) { const d = mm(q); if (d > L) { L = d; apice = q; } }
  f.r = r; f.area = r.area; f.L = L; f.apice = apice; f.m = m; CMR.seg[`al|${si}|${p.idx}`] = r; T.misure++;
  disegna(); pannelloCmr();
  if (quale === 'ed' && !t.fasi.es?.r) avvisoBreve('Fine diastole fatta. Ora vai in fine sistole («Vai FS») e ripeti: anulus, anulus, cavità.');
}
// volumi del VS dall'asse lungo: biplano se ci sono due viste (2 e 4 camere) complete, altrimenti monoplano
function cifreAsseLungo() {
  const fatte = Object.entries(CMR.al?.tracce || {}).filter(([, t]) => t.fasi.ed?.r && t.fasi.es?.r).map(([si, t]) => ({ si: +si, t, vista: vistaAl(+si) }));
  if (!fatte.length) return null;
  const v2 = fatte.find((x) => x.vista === '2 camere'), v4 = fatte.find((x) => x.vista === '4 camere');
  const vol = (fase, lista) => (lista.length === 2 ? 0.85 * (lista[0].t.fasi[fase].area / 100) * (lista[1].t.fasi[fase].area / 100) / (Math.min(lista[0].t.fasi[fase].L, lista[1].t.fasi[fase].L) / 10)
    : 0.85 * (lista[0].t.fasi[fase].area / 100) ** 2 / (lista[0].t.fasi[fase].L / 10));
  const lista = v2 && v4 ? [v2, v4] : [fatte[0]];
  const edv = vol('ed', lista), esv = vol('es', lista);
  return { edv, esv, sv: edv - esv, fe: (edv - esv) / edv * 100, metodo: lista.length === 2 ? 'area-lunghezza biplano (2 e 4 camere)' : `area-lunghezza monoplano (${lista[0].vista})` };
}
function htmlAsseLungo() {
  const lax = serieAsseLungo(), p = P(V.attivo), si = p?.sIdx;
  if (!lax.length) return '<p class="small muted">In questo esame non trovo una cine in asse lungo (2 o 4 camere).</p>';
  if (!lax.includes(si)) return `<p class="small">Apri una cine in asse lungo: ${lax.map((x) => `<button class="ghost piccolo" data-al-serie="${x}">${esc(V.serie[x].descrizione || 'serie ' + (x + 1))}</button>`).join(' ')}</p>`;
  const t = faseAl(si), n = V.serie[si].files.length, opz = (sel) => Array.from({ length: n }, (_, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${i + 1}</option>`).join('');
  const stato = (q) => { const f = t.fasi[q]; return f?.r ? `✓ area ${virgola(f.area / 100, 1)} cm² · L ${virgola(f.L / 10, 1)} cm · ${virgola(0.85 * (f.area / 100) ** 2 / (f.L / 10), 0)} mL` : f?.punti?.length ? `${f.punti.length}/3 punti` : 'da fare'; };
  return `<div class="small muted">${esc(V.serie[si].descrizione || '')} · ${vistaAl(si)} · ${n} fasi${p.idx === t.ed ? ' · aperta: <b>fine diastole</b>' : p.idx === t.es ? ' · aperta: <b>fine sistole</b>' : ''}</div>
    <div class="cmr-fasi small"><label>Fine diastole <select id="cmr-al-ed">${opz(t.ed)}</select></label><button class="ghost piccolo" id="cmr-al-vai-ed">Vai</button>
      <label>Fine sistole <select id="cmr-al-es">${opz(t.es)}</select></label><button class="ghost piccolo" id="cmr-al-vai-es">Vai</button></div>
    <ul class="small cmr-al-stato"><li><b>FD</b>: ${stato('ed')}</li><li><b>FS</b>: ${stato('es')}</li></ul>
    ${lax.length > 1 ? `<p class="small muted">Con una seconda vista (2 e 4 camere) il calcolo diventa biplano: ${lax.filter((x) => x !== si).map((x) => `<button class="ghost piccolo" data-al-serie="${x}">${esc(V.serie[x].descrizione || '')}</button>`).join(' ')}</p>` : ''}`;
}
'''
a = sost(a, "async function puntoCmr(k, pt) {", FUNZ + "async function puntoCmr(k, pt) {", 'funzioni')
# cifre: VS dall'asse lungo se manca l'asse corto
a = sost(a, "  if (CMR.ed == null || CMR.es == null) return out;\n  for (const v of ['vs', 'vd']) {",
  "  const al = cifreAsseLungo(); if (al && !(CMR.ed != null && volumiCmr('vs'))) out.vs = al;\n  if (CMR.ed == null || CMR.es == null) return out;\n  for (const v of ['vs', 'vd']) {", 'cifre')
# riga dei risultati (testo per il referto e il modello)
a = sost(a, "  const an = CMR.anulus.ris;\n",
  "  { const al = cifreAsseLungo(); if (al && !righe.some((x) => /^Ventricolo sinistro:/.test(x))) {\n"
  "    const f0 = (x, n = 0) => virgola(x, n), ind = (x) => (bsa ? ` (${f0(x / bsa)} mL/m²)` : '');\n"
  "    righe.unshift(`Ventricolo sinistro: (${al.metodo}) volume telediastolico ${f0(al.edv)} mL${ind(al.edv)}, telesistolico ${f0(al.esv)} mL${ind(al.esv)}, gittata sistolica ${f0(al.sv)} mL, frazione di eiezione ${f0(al.fe)}% (${al.fe <= 40 ? 'ridotta' : al.fe < 50 ? 'lievemente ridotta' : 'conservata'})`); } }\n"
  "  const an = CMR.anulus.ris;\n", 'righe')
# sezione nel pannello
a = sost(a, "    ${CMR.sax ? `<section class=\"cmr-sez\"><h4><span class=\"cmr-n\">2</span> Fasi e fette</h4>",
  "    ${CMR.modo === 'al' || Object.keys(CMR.al?.tracce || {}).length ? `<section class=\"cmr-sez\"><h4><span class=\"cmr-n\">2</span> Asse lungo (area-lunghezza)</h4>${htmlAsseLungo()}</section>` : ''}\n"
  "    ${CMR.sax ? `<section class=\"cmr-sez\"><h4><span class=\"cmr-n\">2</span> Fasi e fette</h4>", 'sezione')
# metodo nella nota dei risultati e nel referto
a = sost(a, "      <p class=\"muted small\">Riferimenti: adulti, bSSFP, ${CMR.sesso === 'M' ? 'uomini'",
  "      ${K.vs?.metodo ? `<p class=\"small\">Volumi del VS con il metodo ${esc(K.vs.metodo)}: stima meno precisa della pila di asse corto (Simpson).</p>` : ''}\n"
  "      <p class=\"muted small\">Riferimenti: adulti, bSSFP, ${CMR.sesso === 'M' ? 'uomini'", 'nota metodo')
a = sost(a, "  const fonte = `Riferimenti: adulti, bSSFP, ${sesso} (Kawel-Boehm et al., J Cardiovasc Magn Reson 2020). Volumi con il metodo di Simpson sulla pila di asse corto.`;",
  "  const al = cifreAsseLungo(), metodo = RM.length && al && !(CMR.ed != null && volumiCmr('vs')) ? `Volumi del VS con il metodo ${al.metodo} sulla cine in asse lungo.` : 'Volumi con il metodo di Simpson sulla pila di asse corto.';\n"
  "  const fonte = `Riferimenti: adulti, bSSFP, ${sesso} (Kawel-Boehm et al., J Cardiovasc Magn Reson 2020). ${metodo}`;", 'fonte')
# gestori della sezione asse lungo
a = sost(a, "  $('#cmr-copia')?.addEventListener('click', () => { const m = misureRefertoCmr(ris); cmrAlReferto({ testo: m.testo, html: m.html }); });",
  "  $('#cmr-copia')?.addEventListener('click', () => { const m = misureRefertoCmr(ris); cmrAlReferto({ testo: m.testo, html: m.html }); });\n"
  "  box.querySelectorAll('[data-al-serie]').forEach((b) => b.onclick = async () => { const si = +b.dataset.alSerie; await selezionaSerie(si, V.attivo, { idx: faseAl(si).ed }); disegna(); pannelloCmr(); });\n"
  "  { const si = P(V.attivo)?.sIdx, t = CMR.al?.tracce?.[si];\n"
  "    if (t) {\n"
  "      $('#cmr-al-ed')?.addEventListener('change', (e) => { t.ed = +e.target.value; t.fasi.ed = { punti: [] }; pannelloCmr(); });\n"
  "      $('#cmr-al-es')?.addEventListener('change', (e) => { t.es = +e.target.value; t.fasi.es = { punti: [] }; pannelloCmr(); });\n"
  "      $('#cmr-al-vai-ed')?.addEventListener('click', () => mostraDi(V.attivo, t.ed).then(() => { disegna(); pannelloCmr(); }));\n"
  "      $('#cmr-al-vai-es')?.addEventListener('click', () => mostraDi(V.attivo, t.es).then(() => { disegna(); pannelloCmr(); }));\n"
  "    } }", 'gestori')
# disegno: anulus, contorno, lunghezza
a = sost(a, "  if (CMR.epi[p.sIdx] && p.idx === CMR.epi[p.sIdx].idx) punti(CMR.epi[p.sIdx].punti, CMR_COL.epi);",
  "  { const t = CMR.al?.tracce?.[p.sIdx]; const f = t && (p.idx === t.ed ? t.fasi.ed : p.idx === t.es ? t.fasi.es : null);\n"
  "    if (f) {\n"
  "      if (f.r) { ctx.save(); ctx.fillStyle = CMR_COL.vs; const passo = Math.max(1, Math.floor(f.r.bordo.length / 500)); for (let i = 0; i < f.r.bordo.length; i += passo) { const q = aSchermo(g, { x: f.r.bordo[i].x + 0.5, y: f.r.bordo[i].y + 0.5 }); ctx.fillRect(q.x - 1, q.y - 1, 2, 2); } ctx.restore(); }\n"
  "      if (f.punti.length >= 2) punti(f.punti.slice(0, 2), '#ffd34d', false);\n"
  "      if (f.r && f.m && f.apice) { ctx.save(); ctx.setLineDash([5, 4]); punti([f.m, f.apice], '#ffffff', false); ctx.restore(); }\n"
  "      ctx.save(); ctx.fillStyle = '#ffd34d'; for (const q0 of f.punti) { const q = aSchermo(g, q0); ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fill(); } ctx.restore();\n"
  "    } }\n"
  "  if (CMR.epi[p.sIdx] && p.idx === CMR.epi[p.sIdx].idx) punti(CMR.epi[p.sIdx].punti, CMR_COL.epi);", 'disegno')
# il disegno parte anche con le sole tracce dell'asse lungo
a = sost(a, "  if (V.tool !== 'cmr' && !CMR.semi.vs && !CMR.semi.vd && !CMR.flusso.roi",
  "  if (V.tool !== 'cmr' && !CMR.semi.vs && !CMR.semi.vd && !Object.keys(CMR.al?.tracce || {}).length && !CMR.flusso.roi", 'disegno guardia')
open(R + 'app.js', 'w', encoding='utf-8').write(a)

s = open(R + 'style.css', encoding='utf-8').read()
if '.cmr-al-stato' not in s:
    s += '\n.cmr-al-stato{list-style:none;padding:0;margin:6px 0}.cmr-al-stato li{margin:2px 0}\n'
    open(R + 'style.css', 'w', encoding='utf-8').write(s)
en = json.load(open(R + 'lingua/en.json', encoding='utf-8'))
for k, v in {
  "8 · FE del VS dall'asse lungo (area-lunghezza)": '8 · LV EF from the long axis (area-length)',
  'Asse lungo (area-lunghezza)': 'Long axis (area-length)', 'da fare': 'to do', 'Fine diastole': 'End-diastole', 'Fine sistole': 'End-systole',
  'In questo esame non trovo una cine in asse lungo (2 o 4 camere).': 'No long-axis cine (2 or 4 chamber) found in this exam.',
  'Apri una cine in asse lungo: {x}': 'Open a long-axis cine: {x}',
  "Senza pila di asse corto: apri la cine in asse lungo (2 o 4 camere), vai in fine diastole e clicca i due punti dell'anulus mitralico, poi il centro della cavità del VS; ripeti in fine sistole. Il contorno si ferma al piano valvolare; volume = 0,85 × area² / lunghezza (biplano con 2 e 4 camere).": 'Without a short-axis stack: open the long-axis cine (2 or 4 chamber), go to end-diastole and click the two mitral annulus points, then the centre of the LV cavity; repeat at end-systole. The contour stops at the valve plane; volume = 0.85 × area² / length (biplane with 2 and 4 chamber).',
  "Manca la pila di asse corto: misura la FE del VS sulla cine in asse lungo (metodo area-lunghezza). In fine diastole clicca i due punti dell'anulus mitralico e poi la cavità.": 'No short-axis stack: measure LV EF on the long-axis cine (area-length method). At end-diastole click the two mitral annulus points, then the cavity.',
  "Ora il secondo punto dell'anulus mitralico.": 'Now the second mitral annulus point.',
  'Vai in fine diastole o in fine sistole (pulsanti «Vai» nella scheda), poi clicca.': 'Go to end-diastole or end-systole («Go» buttons in the panel), then click.',
  "Non trovo la cavità: clicca più al centro del ventricolo (i due punti dell'anulus restano).": 'Cavity not found: click closer to the centre of the ventricle (the two annulus points are kept).',
  'Fine diastole fatta. Ora vai in fine sistole («Vai FS») e ripeti: anulus, anulus, cavità.': 'End-diastole done. Now go to end-systole and repeat: annulus, annulus, cavity.',
  'Volumi del VS con il metodo {x}: stima meno precisa della pila di asse corto (Simpson).': 'LV volumes with the {x} method: less precise than the short-axis stack (Simpson).',
  'Serve una cine in asse lungo (2 o 4 camere) con le fasi del ciclo.': 'A long-axis cine (2 or 4 chamber) with cardiac phases is needed.',
}.items(): en.setdefault(k, v)
json.dump(en, open(R + 'lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('asse lungo OK')
