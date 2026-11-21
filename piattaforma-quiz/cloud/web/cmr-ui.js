// RM cardiaca: analisi della pila di asse corto, scheda con volumi, funzione, massa, flusso, anulus, atri, LGE e
// disegno dei contorni sulle immagini. Si carica solo quando si sceglie lo strumento «RM cardiaca» (app.js,
// caricaCmrUi): chi non lo usa non lo scarica. I calcoli numerici stanno in cmr.js (test/cmr.test.mjs).
// Estratto da app.js nella 1.249 senza modifiche al contenuto, salvo i nomi di app.js letti come A.nome (ponte).
// nomi di app.js: arrivano con collega(PONTE) (vedi app.js); niente import './app.js'
let A = null;
export const collega = (p) => { A = p; };
export const NOMI_APP = ["$","CM","CMR","CMR_CACHE","CMR_COL","FIN_ALTRE","ME","ME_NOME","MSG_MULTIECO","P","T","V","aSchermo","avvisoBreve","azzeraCmr","chiudiCmrFinestra","cmrAlReferto","ctx","disegna","esc","imgCmr","isMultiEco","mostraDi","pazienteDa","pixelDa","scegliStrumento","selezionaSerie","staccaCmr","testoContorno","v3","verificaEco","virgola"];

function caricaAnagraficaCmr() {
  const t = `${A.V.caso?.anamnesi || ''}`;
  const h = t.match(/(\d)[,.](\d{2,3})\s*m\b/); if (h && !A.CMR.altezza) A.CMR.altezza = Math.round(parseFloat(`${h[1]}.${h[2]}`) * 100);
  const w = t.match(/(\d{2,3})\s*kg/); if (w && !A.CMR.peso) A.CMR.peso = +w[1];
  if (!A.CMR.sesso) A.CMR.sesso = /\b(uomo|maschio)\b/i.test(t) ? 'M' : /\b(donna|femmina)\b/i.test(t) ? 'F' : null;
}
async function trovaSax() {
  if (A.CMR.sax) return A.CMR.sax;
  const senzaEco = async (lista) => { const out = []; for (const c of lista) if (!(await A.verificaEco(c.si))) out.push(c); return out; };
  let cand = await senzaEco(A.V.serie.map((s, si) => ({ s, si })).filter(({ s }) => /asse corto|short|\bsax/i.test(s.descrizione || '')));
  const att = A.P(A.V.attivo);
  if (cand.length < 3 && att?.img?.iop) {          // nomi non utili: serie con lo stesso orientamento della fetta aperta
    const n0 = A.v3.norm(att.img.iop), out = [];
    for (let si = 0; si < A.V.serie.length; si++) { try { const im = await A.imgCmr(si, 0); if (im.iop && Math.abs(A.v3.dot(A.v3.norm(im.iop), n0)) > 0.98 && A.V.serie[si].files.length >= 8) out.push({ s: A.V.serie[si], si }); } catch { /* serie non leggibile */ } }
    cand = await senzaEco(out);
  }
  if (cand.length < 3) return null;
  const el = [];
  for (const { s, si } of cand) { const im = await A.imgCmr(si, 0); if (!im.ipp || !im.iop) continue; el.push({ si, n: s.files.length, im }); }
  const nn = A.v3.norm(el[0].im.iop);
  el.forEach((x) => { x.pos = A.v3.dot(nn, x.im.ipp); }); el.sort((a, b) => a.pos - b.pos);
  const d = el.slice(1).map((x, i) => Math.abs(x.pos - el[i].pos)).filter((x) => x > 0.5).sort((a, b) => a - b);
  A.CMR.passo = d.length ? d[d.length >> 1] : (el[0].im.spessore || 8);
  A.CMR.sax = el.map(({ si, n, pos }) => ({ si, n, pos })); A.CMR.normale = nn;
  return A.CMR.sax;
}
const areaCmr = (v, si, f) => { const m = A.CMR.man[`${v}|${si}|${f}`]; if (m) return m.area; const r = A.CMR.seg[`${v}|${si}|${f}`]; return r ? (r.perso ? r.stima ?? 0 : r.area) : 0; };
const inclusa = (v, si) => { const k = `${v}|${si}`; return k in A.CMR.incl ? A.CMR.incl[k] : !!A.CMR.auto[v]?.incl?.[si]; };
const nFasiCmr = () => Math.min(...A.CMR.sax.map((x) => x.n));
function volumiCmr(v) {
  if (!A.CMR.sax || !A.CMR.semi[v]) return null;
  const nf = nFasiCmr(), vol = [];
  for (let f = 0; f < nf; f++) vol.push(A.CM.volumeDaAree(A.CMR.sax.filter((x) => inclusa(v, x.si)).map((x) => areaCmr(v, x.si, f)), A.CMR.passo));
  return vol;
}
async function analizzaCmr(v) {
  const sax = await trovaSax(); if (!sax) { A.avvisoBreve(msgNoSax()); return; }
  A.CMR.lavoro = true; const nf = nFasiCmr(), q0 = A.CMR.semi[v];
  // fetta di partenza: la più vicina al punto cliccato; poi verso la base e verso l'apice, col centro della fetta vicina
  let s0 = 0; sax.forEach((x, i) => { if (Math.abs(x.pos - A.v3.dot(A.CMR.normale, q0)) < Math.abs(sax[s0].pos - A.v3.dot(A.CMR.normale, q0))) s0 = i; });
  const ordine = [s0]; for (let d = 1; d < sax.length; d++) { if (s0 + d < sax.length) ordine.push(s0 + d); if (s0 - d >= 0) ordine.push(s0 - d); }
  const centro = {}; let fatti = 0;
  const opz = { k: A.CMR.k, riempi: v === 'vs' ? A.CMR.riempi : true, raggioMm: v === 'vs' ? 50 : 60, minSangue: v === 'vs' ? 0.45 : 0.35 };
  const dubbie = {};
  for (const i of ordine) {
    const { si } = sax[i], vic = i === s0 ? null : centro[i > s0 ? i - 1 : i + 1];
    let qs = vic || q0;
    for (let f = 0; f < nf; f++) {
      const im = await A.imgCmr(si, f), prec = A.CMR.seg[`${v}|${si}|${f - 1}`];
      const prova = (seme) => { let r = null; for (const dk of [0, 0.1, 0.2]) { r = A.CM.segmentaCavita(im, seme, { ...opz, k: Math.min(0.9, opz.k + dk) }); if (!r || r.perdita <= 0.12) break; } return r; };
      let r = prova(A.pixelDa(im, qs));
      if (!r && f > 0 && prec?.centro) r = prova(prec.centro);
      if (r) r.perso = r.perdita > 0.12;                 // il bordo esce dalla finestra: area stimata dalle fasi vicine
      A.CMR.seg[`${v}|${si}|${f}`] = r;
      if (r && f === 0) { qs = A.pazienteDa(im, r.centro); centro[i] = qs; }
      if (++fatti % 20 === 0) { A.CMR.stato = `Seguo la cavità: ${fatti}/${nf * sax.length} immagini…`; pannelloCmr(); await new Promise((ok) => setTimeout(ok, 0)); }
    }
    if (!centro[i]) centro[i] = vic || q0;
    // fasi con fuoriuscita: area interpolata tra le fasi valide più vicine della stessa fetta
    const aree = Array.from({ length: nf }, (_, f) => { const r = A.CMR.seg[`${v}|${si}|${f}`]; return r ? (r.perso ? null : r.area) : 0; });
    // cavità persa in alcune fasi di una fetta che in diastole è ampia: non è l'apice, è un errore del bordo → si stima
    const a0 = A.CMR.seg[`${v}|${si}|0`]?.area || 0;
    if (a0 > 0.25 * (A.CMR.seg[`${v}|${sax[s0].si}|0`]?.area || 0)) for (let f = 0; f < nf; f++) if (!A.CMR.seg[`${v}|${si}|${f}`]) { A.CMR.seg[`${v}|${si}|${f}`] = { area: 0, bordo: [], centro: null, perdita: 1, perso: true, vuota: true }; aree[f] = null; }
    for (let f = 0; f < nf; f++) { const r = A.CMR.seg[`${v}|${si}|${f}`]; if (!r?.perso) continue;
      let a = f - 1; while (a >= 0 && aree[a] == null) a--; let b = f + 1; while (b < nf && aree[b] == null) b++;
      r.stima = a >= 0 && b < nf ? aree[a] + (aree[b] - aree[a]) * (f - a) / (b - a) : a >= 0 ? aree[a] : b < nf ? aree[b] : 0; }
    dubbie[si] = aree.filter((x) => x == null).length / nf;
  }
  if (!A.CMR.seg[`${v}|${sax[s0].si}|0`] && !A.CMR.seg[`${v}|${sax[s0].si}|${Math.floor(nf / 2)}`]) {
    A.CMR.semi[v] = null; A.CMR.lavoro = false; A.CMR.stato = ''; for (const k of Object.keys(A.CMR.seg)) if (k.startsWith(v + '|')) delete A.CMR.seg[k];
    A.avvisoBreve('Nel punto cliccato non trovo sangue (cavità chiara): clicca più al centro della cavità, su una fetta medio-ventricolare.'); A.disegna(); pannelloCmr(); return;
  }
  // fette incluse in automatico: cavità trovata in diastole, senza fuoriuscita dalla finestra, non più grande del ragionevole
  const rif = A.CMR.seg[`${v}|${sax[s0].si}|0`]?.area || 0, incl = {};
  for (const { si } of sax) { const r = A.CMR.seg[`${v}|${si}|0`]; incl[si] = !!r && !r.perso && r.area < Math.max(1.6 * rif, 400) && !(dubbie[si] > 0.3); }
  A.CMR.auto[v] = { incl, dubbie };
  for (const k of Object.keys(A.CMR.incl)) if (k.startsWith(v + '|')) delete A.CMR.incl[k];
  let vol = volumiCmr(v);
  const fasi = (l) => [l.indexOf(Math.max(...l)), l.indexOf(Math.min(...l))];
  let [ed, es] = v === 'vs' || A.CMR.ed == null ? fasi(vol) : [A.CMR.ed, A.CMR.es];
  // oltre l'apice: andando dalla fetta più grande verso le estremità, una fetta piccola seguita da una più grande è fuori dal ventricolo
  const aed = sax.map(({ si }) => (incl[si] ? areaCmr(v, si, ed) : 0)), imax = aed.indexOf(Math.max(...aed));
  for (const dir of [1, -1]) { let fuori = false;
    for (let i = imax + dir; i >= 0 && i < sax.length; i += dir) { const prima = aed[i - dir];
      if (fuori || (prima < 0.5 * aed[imax] && aed[i] > 1.5 * prima)) { fuori = true; incl[sax[i].si] = false; } } }
  // fette della base che in sistole non si riducono (atrio, tratto di efflusso): fuori; poi fasi ricalcolate
  for (const { si } of sax) if (incl[si] && areaCmr(v, si, es) > 0.9 * areaCmr(v, si, ed)) incl[si] = false;
  vol = volumiCmr(v); if (v === 'vs' || A.CMR.ed == null) [ed, es] = fasi(vol);
  // VD: in fine sistole la cavità resta dentro quella di fine diastole (dilatata di 2 pixel). Senza questo vincolo il
  // contorno del VD in sistole usciva nell'atrio o nel tratto di efflusso e la FE del VD risultava troppo bassa.
  if (v === 'vd' && ed != null && es != null && ed !== es) {
    for (const { si } of sax) {
      const rd = A.CMR.seg[`vd|${si}|${ed}`], rs = A.CMR.seg[`vd|${si}|${es}`], M = rd?.maschera; if (!M || !rs || rs.vuota || A.CMR.man[`vd|${si}|${es}`]) continue;
      const dentroED = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx - M.x0, yy = y + dy - M.y0; if (xx >= 0 && yy >= 0 && xx < M.W && yy < M.H && M.m[yy * M.W + xx]) return true; } return false; };
      const seme = [rs.centro, rd.centro].find((q) => q && dentroED(Math.round(q.x), Math.round(q.y))); if (!seme) continue;
      const r2 = A.CM.segmentaCavita(await A.imgCmr(si, es), seme, { ...opz, limite: dentroED });
      if (r2 && r2.area < rs.area) A.CMR.seg[`vd|${si}|${es}`] = r2;
    }
    for (const { si } of sax) if (incl[si] && areaCmr(v, si, es) > 0.85 * areaCmr(v, si, ed)) incl[si] = false;
  }
  A.CMR.ed = ed; A.CMR.es = es;
  A.CMR.lavoro = false; A.CMR.stato = ''; A.T.misure++;
  A.disegna(); pannelloCmr();
}
function frequenzaCmr() {
  const s = A.CMR.sax?.[0]; if (!s) return null;
  const a = A.CMR_CACHE.get(`/casi/${A.V.caso.id}/${A.V.serie[s.si].files[0]}`), b = A.CMR_CACHE.get(`/casi/${A.V.caso.id}/${A.V.serie[s.si].files[s.n - 1]}`);
  if (!(a?.trigger >= 0 && b?.trigger > 0)) return null;
  const rr = (b.trigger - a.trigger) * s.n / (s.n - 1); return rr > 300 && rr < 2000 ? 60000 / rr : null;
}
function risultatiCmr() {
  const righe = [], bsa = A.CM.superficieCorporea(A.CMR.altezza, A.CMR.peso), fc = frequenzaCmr(), f0 = (x, n = 0) => A.virgola(x, n);
  const ind = (x, u = 'mL') => (bsa ? ` (${f0(x / bsa)} ${u}/m²)` : '');
  for (const v of ['vs', 'vd']) {
    const vol = volumiCmr(v); if (!vol || A.CMR.ed == null || !(vol[A.CMR.ed] > 0)) continue;
    const edv = vol[A.CMR.ed], esv = vol[A.CMR.es], sv = edv - esv, fe = edv > 0 ? sv / edv * 100 : null, nome = v === 'vs' ? 'Ventricolo sinistro' : 'Ventricolo destro';
    let t = `${nome}: volume telediastolico ${f0(edv)} mL${ind(edv)}, telesistolico ${f0(esv)} mL${ind(esv)}, gittata sistolica ${f0(sv)} mL${ind(sv)}, frazione di eiezione ${f0(fe)}%`;
    if (v === 'vs' && fe != null) t += ` (${fe <= 40 ? 'ridotta' : fe < 50 ? 'lievemente ridotta' : 'conservata'})`;
    if (v === 'vs' && fc) t += `, portata cardiaca ${f0(sv * fc / 1000, 1)} L/min (frequenza ${f0(fc)}/min)`;
    if (v === 'vs') {
      const incl = A.CMR.sax.filter((x) => inclusa('vs', x.si)), conEpi = incl.filter((x) => A.CMR.epi[x.si]);
      if (conEpi.length && conEpi.length === incl.length) {
        const mio = incl.reduce((s, x) => s + Math.max(0, A.CMR.epi[x.si].area - areaCmr('vs', x.si, A.CMR.ed)), 0) * A.CMR.passo / 1000 * 1.05;
        t += `, massa ${f0(mio)} g${bsa ? ` (${f0(mio / bsa)} g/m²)` : ''}`;
      }
    }
    righe.push(t);
  }
  { const al = cifreAsseLungo(); if (al && !righe.some((x) => /^Ventricolo sinistro:/.test(x))) {
    const f0 = (x, n = 0) => A.virgola(x, n), ind = (x) => (bsa ? ` (${f0(x / bsa)} mL/m²)` : '');
    righe.unshift(`Ventricolo sinistro: (${al.metodo}) volume telediastolico ${f0(al.edv)} mL${ind(al.edv)}, telesistolico ${f0(al.esv)} mL${ind(al.esv)}, gittata sistolica ${f0(al.sv)} mL, frazione di eiezione ${f0(al.fe)}% (${al.fe <= 40 ? 'ridotta' : al.fe < 50 ? 'lievemente ridotta' : 'conservata'})`); } }
  const an = A.CMR.anulus.ris;
  for (const [k, n] of [['mapse-s', 'MAPSE settale'], ['mapse-l', 'MAPSE laterale'], ['tapse', 'TAPSE']]) if (an[k] != null) righe.push(`${n} ${f0(an[k])} mm${k === 'tapse' ? ` (${an[k] >= 17 ? 'nella norma' : 'ridotto'}: riferimento ecocardiografico ≥ 17 mm)` : ''}`);
  const at = A.CMR.atrio.tracce;
  if (at.as4 || at.as2) {
    const vol = at.as4 && at.as2 ? A.CM.volumeAreaLunghezza(at.as4.area / 100, at.as2.area / 100, Math.min(at.as4.L, at.as2.L) / 10) : null;
    righe.push(`Atrio sinistro: ${[at.as4 ? `area 4 camere ${f0(at.as4.area / 100, 1)} cm²` : '', at.as2 ? `area 2 camere ${f0(at.as2.area / 100, 1)} cm²` : '', vol ? `volume biplano ${f0(vol)} mL${ind(vol)}` : ''].filter(Boolean).join(', ')}`);
  }
  if (at.ad4) righe.push(`Atrio destro: area 4 camere ${f0(at.ad4.area / 100, 1)} cm²`);
  const lg = Object.values(A.CMR.lge.fette).filter((x) => x.ris);
  if (lg.length) { const mio = lg.reduce((a, x) => a + x.ris.areaMio, 0), acc = lg.reduce((a, x) => a + x.ris.areaLge, 0), sp = lg[0].spessore || A.CMR.passo || 8;
    righe.push(`Enhancement tardivo (soglia remoto + ${A.CMR.lge.n} DS): ${f0(mio ? acc / mio * 100 : 0)}% del miocardio nelle ${lg.length} fette misurate${sp ? ` (circa ${f0(acc * sp / 1000 * 1.05, 1)} g)` : ''}`); }
  const e = A.CM.ecv(A.CMR.ecv);
  if (A.CMR.ecv.t1m) righe.push(`T1 nativo del miocardio ${f0(A.CMR.ecv.t1m)} ms${e != null ? `; volume extracellulare (ECV) ${f0(e)}%` : ''}`);
  const fl = A.CMR.flusso.ris;
  if (fl) righe.push(`Flusso (contrasto di fase, venc ${f0(A.CMR.flusso.venc)} cm/s): velocità di picco ${f0(Math.abs(fl.piccoV))} cm/s, volume anterogrado ${f0(fl.avanti)} mL, retrogrado ${f0(fl.indietro)} mL, netto ${f0(fl.netto)} mL per battito${fl.rigurgito != null ? `, frazione di rigurgito ${f0(fl.rigurgito)}%` : ''}`);
  return { righe, bsa, fc };
}
function htmlCurvaCmr() {
  const a = volumiCmr('vs'), b = volumiCmr('vd'); if (!a && !b) return '';
  const tutte = [...(a || []), ...(b || [])], mx = Math.max(...tutte, 1), mn = Math.min(...tutte, 0), W = 300, H = 50, n = (a || b).length;
  const x = (i) => 2 + i / Math.max(1, n - 1) * (W - 4), y = (val) => H - 4 - (val - mn) / (mx - mn || 1) * (H - 8);
  const linea = (l, col) => (l ? `<polyline fill="none" stroke="${col}" stroke-width="1.5" points="${l.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ')}"/>` : '');
  return `<svg class="eco-curva" viewBox="0 0 ${W} ${H}" role="img" aria-label="Volumi nei fotogrammi">${linea(a, A.CMR_COL.vs)}${linea(b, A.CMR_COL.vd)}
    ${A.CMR.ed != null ? `<line x1="${x(A.CMR.ed)}" x2="${x(A.CMR.ed)}" y1="0" y2="${H}" stroke="#41d1ff" stroke-dasharray="3 2"/><line x1="${x(A.CMR.es)}" x2="${x(A.CMR.es)}" y1="0" y2="${H}" stroke="#ff9f43" stroke-dasharray="3 2"/>` : ''}</svg>`;
}
const AIUTO_CMR = {
  al: 'Senza pila di asse corto: apri la cine in asse lungo (2 o 4 camere), vai in fine diastole e clicca i due punti dell\'anulus mitralico, poi il centro della cavità del VS; ripeti in fine sistole. Il contorno si ferma al piano valvolare; volume = 0,85 × area² / lunghezza (biplano con 2 e 4 camere).',
  vs: 'Apri una fetta di asse corto medio-ventricolare e clicca al centro della cavità del ventricolo sinistro: il bordo si segue in tutte le fette e in tutte le fasi.',
  vd: 'Clicca al centro della cavità del ventricolo destro su una fetta di asse corto medio-ventricolare. Il bordo del VD è più difficile (forma a semiluna, alla base si confonde con l\'atrio e il tratto di efflusso): controlla ogni fetta e correggi a mano quelle con ⚠.',
  man: 'Correzione: sulla fetta e sulla fase da correggere (fine diastole o fine sistole) clicca i punti dell\'endocardio; Invio chiude, ⌫ toglie l\'ultimo, Esc annulla. Il contorno a mano sostituisce quello automatico.',
  epi: 'Massa del VS: in fine diastole, su ogni fetta inclusa, clicca i punti del bordo esterno del miocardio (epicardio); Invio chiude.',
  flusso: 'Flusso: apri la serie del contrasto di fase (immagine di fase o di magnitudo), clicca il centro del vaso e poi il suo bordo.',
  anulus: 'Escursione dell\'anulus nella cine 4 camere (o 2 camere): in fine diastole clicca il punto d\'inserzione dell\'anulus, poi vai in fine sistole e clicca lo stesso punto. MAPSE = anulus mitralico (settale o laterale), TAPSE = anulus tricuspidale laterale.',
  atrio: 'Atri: in fine sistole del ventricolo (atrio più grande) clicca il contorno dell\'atrio da un lato dell\'anulus all\'altro passando per il tetto (escludi vene polmonari e auricola); Invio chiude. Con 4 e 2 camere il volume dell\'atrio sinistro è biplano (area-lunghezza).',
  lge: 'Enhancement tardivo, su ogni fetta di asse corto delle sequenze dopo il gadolinio: 1) contorno dell\'epicardio (Invio), 2) contorno dell\'endocardio (Invio), 3) cerchio nel miocardio remoto sano (centro, poi bordo). Il miocardio sopra la media del remoto + n deviazioni standard è segnato in rosso.',
};
// ---- RM cardiaca: cifre principali, limiti di riferimento e misure per il referto
// Adulti, bSSFP, media ± 2 DS (Kawel-Boehm et al., J Cardiovasc Magn Reson 2020: VS tabella 2, papillari nella massa;
// VD tabella 10). Volumi e massa indicizzati sulla superficie corporea (Mosteller).
const RIF_CMR = {
  M: { vs_edv: [50, 108], vs_esv: [11, 47], vs_fe: [49, 79], vs_massa: [39, 85], vd_edv: [53, 123], vd_esv: [17, 59], vd_fe: [42, 72] },
  F: { vs_edv: [50, 96], vs_esv: [10, 40], vs_fe: [52, 79], vs_massa: [30, 68], vd_edv: [48, 104], vd_esv: [13, 48], vd_fe: [46, 74] },
};
function cifreCmr() {
  const out = { bsa: A.CM.superficieCorporea(A.CMR.altezza, A.CMR.peso) };
  const al = cifreAsseLungo(); if (al && !(A.CMR.ed != null && volumiCmr('vs'))) out.vs = al;
  if (A.CMR.ed == null || A.CMR.es == null) return controllaVd(out);
  for (const v of ['vs', 'vd']) {
    const vol = volumiCmr(v); if (!vol || !(vol[A.CMR.ed] > 0)) continue;
    const edv = vol[A.CMR.ed], esv = vol[A.CMR.es];
    out[v] = { edv, esv, sv: edv - esv, fe: (edv - esv) / edv * 100 };
    if (v === 'vs' && A.CMR.sax) {
      const incl = A.CMR.sax.filter((x) => inclusa('vs', x.si)), conEpi = incl.filter((x) => A.CMR.epi[x.si]);
      if (conEpi.length && conEpi.length === incl.length) out.vs.massa = incl.reduce((s, x) => s + Math.max(0, A.CMR.epi[x.si].area - areaCmr('vs', x.si, A.CMR.ed)), 0) * A.CMR.passo / 1000 * 1.05;
    }
  }
  return controllaVd(out);
}
// Senza shunt né insufficienze valvolari le gittate dei due ventricoli sono quasi uguali: se quella del VD è molto diversa
// (o la FE del VD è fuori da ogni plausibilità) il numero non va preso per buono: di solito sono i contorni del VD alla
// base (atrio, efflusso) o in sistole. I valori del VD restano visibili ma segnati «da verificare».
function controllaVd(out) {
  const s = out.vs, d = out.vd; if (!d) return out;
  const diff = s && !s.metodo && s.sv > 0 ? Math.abs(d.sv - s.sv) / s.sv : 0;
  if (diff > 0.3 || d.fe < 30 || d.fe > 85) d.dubbio = `${s && !s.metodo ? `Gittata del VD ${A.virgola(d.sv, 0)} mL contro ${A.virgola(s.sv, 0)} mL del VS` : `FE del VD ${A.virgola(d.fe, 0)}%`}: controlla i contorni del VD alla base (fette con l'atrio o il tratto di efflusso) e in fine sistole, e correggili («Correggi un contorno» → VD). Senza shunt né insufficienze valvolari le due gittate sono quasi uguali.`;
  return out;
}
function rifCmr(id) {
  const m = RIF_CMR.M[id], f = RIF_CMR.F[id]; if (!m) return null;
  return A.CMR.sesso === 'M' ? m : A.CMR.sesso === 'F' ? f : [Math.min(m[0], f[0]), Math.max(m[1], f[1])];
}
function righeMisureCmr(K) {
  const out = [], f0 = (x, n = 0) => A.virgola(x, n), bsa = K.bsa;
  const fuoriDa = (x, r) => (r && x != null ? (x < r[0] ? 'basso' : x > r[1] ? 'alto' : null) : null);
  for (const v of ['vs', 'vd']) {
    const d = K[v]; if (!d) continue;
    const S = v === 'vs' ? 'VS' : 'VD', nomeV = v === 'vs' ? 'ventricolo sinistro' : 'ventricolo destro';
    { const r = rifCmr(v + '_fe'), fu = fuoriDa(d.fe, r);
      out.push({ id: v + '_fe', nome: `Frazione di eiezione del ${nomeV}`, breve: `FE ${S} ${f0(d.fe)}%`, testo: `${f0(d.fe)}%`, idx: '', rif: r, rifT: r ? `${r[0]}–${r[1]}%` : '', fuori: fu,
        sub: fu ? `fuori dai limiti (${r[0]}–${r[1]}%)` : v === 'vs' ? (d.fe <= 40 ? 'ridotta' : d.fe < 50 ? 'lievemente ridotta' : 'conservata') : 'nei limiti' }); }
    for (const [k, nome, x] of [['edv', 'Volume telediastolico', d.edv], ['esv', 'Volume telesistolico', d.esv], ['sv', 'Gittata sistolica', d.sv]]) {
      const r = k === 'sv' ? null : bsa ? rifCmr(`${v}_${k}`) : null, xi = bsa ? x / bsa : null, fu = fuoriDa(xi, r);
      out.push({ id: `${v}_${k}`, nome: `${nome} del ${nomeV}`, breve: `${k === 'edv' ? 'VTD' : k === 'esv' ? 'VTS' : 'GS'} ${S} ${bsa ? f0(xi) + ' mL/m²' : f0(x) + ' mL'}`, testo: `${f0(x)} mL`, idx: bsa ? `${f0(xi)} mL/m²` : '', rif: r, rifT: r ? `${r[0]}–${r[1]} mL/m²` : '', fuori: fu,
        sub: fu ? `${f0(xi)} mL/m² · fuori dai limiti` : bsa ? `${f0(xi)} mL/m²${r ? ' · nei limiti' : ''}` : 'non indicizzato' });
    }
    if (v === 'vs' && d.massa != null) {
      const r = bsa ? rifCmr('vs_massa') : null, xi = bsa ? d.massa / bsa : null, fu = fuoriDa(xi, r);
      out.push({ id: 'vs_massa', nome: 'Massa del ventricolo sinistro', breve: `massa VS ${bsa ? f0(xi) + ' g/m²' : f0(d.massa) + ' g'}`, testo: `${f0(d.massa)} g`, idx: bsa ? `${f0(xi)} g/m²` : '', rif: r, rifT: r ? `${r[0]}–${r[1]} g/m²` : '', fuori: fu,
        sub: fu ? `${f0(xi)} g/m² · fuori dai limiti` : bsa ? `${f0(xi)} g/m² · nei limiti` : 'non indicizzata' });
    }
  }
  if (K.vd?.dubbio) for (const r of out) if (r.id.startsWith('vd_')) { r.fuori = null; r.dubbio = true; r.sub = 'da verificare'; }
  return out;
}
// misure per il referto: elenco (entra anche nel PDF, in Word e nella stampa) e testo semplice
function misureRefertoCmr(ris) {
  const KK = cifreCmr(), RM = righeMisureCmr(KK), altre = ris.righe.filter((x) => !/^Ventricolo (sinistro|destro):/.test(x));
  const sesso = A.CMR.sesso === 'M' ? 'uomini' : A.CMR.sesso === 'F' ? 'donne' : 'sesso non indicato';
  const riga = (r) => `${r.nome}: ${r.testo}${r.idx ? ` (${r.idx})` : ''}${r.rifT ? ` · riferimento ${r.rifT}` : ''}`;
  const segno = (r) => (r.fuori === 'alto' ? '↑ sopra il limite' : r.fuori === 'basso' ? '↓ sotto il limite' : '');
  const al = cifreAsseLungo(), metodo = RM.length && al && !(A.CMR.ed != null && volumiCmr('vs')) ? `Volumi del VS con il metodo ${al.metodo} sulla cine in asse lungo.` : 'Volumi con il metodo di Simpson sulla pila di asse corto.';
  const fonte = `Riferimenti: adulti, bSSFP, ${sesso} (Kawel-Boehm et al., J Cardiovasc Magn Reson 2020). ${metodo}`;
  const fuori = RM.filter((r) => r.fuori);
  const html = `<h3>Misure di RM cardiaca</h3><ul>${RM.map((r) => `<li>${A.esc(riga(r))}${r.dubbio ? ' — <i>da verificare</i>' : r.fuori ? ` — <b>${segno(r)}</b>` : ''}</li>`).join('')}${altre.map((x) => `<li>${A.esc(x)}</li>`).join('')}</ul>`
    + (KK.vd?.dubbio ? `<p><b>Valori del VD da verificare:</b> ${A.esc(KK.vd.dubbio)}</p>` : '')
    + (fuori.length ? `<p><b>Fuori dai limiti di riferimento:</b> ${A.esc(fuori.map((r) => r.breve + (r.fuori === 'alto' ? ' ↑' : ' ↓')).join('; '))}.</p>` : '')
    + `<p><i>${A.esc(fonte)}</i></p>`;
  const testo = ['MISURE DI RM CARDIACA', ...RM.map((r) => `- ${riga(r)}${r.dubbio ? ' — da verificare' : r.fuori ? ' — ' + segno(r) : ''}`), ...altre.map((x) => `- ${x}`), ...(KK.vd?.dubbio ? [`Valori del VD da verificare: ${KK.vd.dubbio}`] : []),
    ...(fuori.length ? [`Fuori dai limiti di riferimento: ${fuori.map((r) => r.breve + (r.fuori === 'alto' ? ' ↑' : ' ↓')).join('; ')}.`] : []), fonte].join('\n');
  return { html, testo, fuori };
}
function pannelloCmr() {
  const box = A.$('#cmr-pannello'); if (!box || box.hidden) return;
  caricaAnagraficaCmr();
  const ris = risultatiCmr(), p = A.P(A.V.attivo), eco = !!p && A.isMultiEco(p);
  const fase = A.CMR.ed != null && p ? (p.idx === A.CMR.ed ? 'fine diastole' : p.idx === A.CMR.es ? 'fine sistole' : `fase ${p.idx + 1}`) : '';
  const nf = A.CMR.sax ? nFasiCmr() : 0, opz = (sel) => Array.from({ length: nf }, (_, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${i + 1}</option>`).join('');
  const righeTab = A.CMR.sax && (A.CMR.semi.vs || A.CMR.semi.vd) ? A.CMR.sax.map((x, i) => {
    const c = (v) => (A.CMR.semi[v] ? `<td><input type="checkbox" data-incl="${v}|${x.si}"${inclusa(v, x.si) ? ' checked' : ''}> ${A.virgola(areaCmr(v, x.si, A.CMR.ed) / 100, 1)} / ${A.virgola(areaCmr(v, x.si, A.CMR.es) / 100, 1)}${A.CMR.man[`${v}|${x.si}|${A.CMR.ed}`] || A.CMR.man[`${v}|${x.si}|${A.CMR.es}`] ? ' ✎' : ''}${A.CMR.auto[v]?.dubbie?.[x.si] > 0 ? ` <span title="Bordo perso in ${Math.round(A.CMR.auto[v].dubbie[x.si] * 100)}% delle fasi: area stimata dalle fasi vicine, controlla e correggi a mano">⚠</span>` : ''}</td>` : '<td>—</td>');
    return `<tr class="${p?.sIdx === x.si ? 'on' : ''}"><td><button class="ghost piccolo" data-vai="${x.si}">${i + 1}</button></td>${c('vs')}${c('vd')}<td>${A.CMR.epi[x.si] ? '✓' : ''}</td></tr>`;
  }).join('') : '';
  box.classList.toggle('ridotto', !!A.CMR.ridotto);
  const K = cifreCmr(), RM = righeMisureCmr(K), altre = ris.righe.filter((x) => !/^Ventricolo (sinistro|destro):/.test(x)), fuori = RM.filter((r) => r.fuori);
  const trovaR = (id) => RM.find((r) => r.id === id), freccia = (r) => (r.fuori === 'alto' ? '↑' : r.fuori === 'basso' ? '↓' : '');
  const tile = (r, tit) => (r ? `<div class="cmr-kpi ${r.dubbio ? 'dubbio' : r.fuori ? 'ko' : r.rif ? 'ok' : ''}" title="${A.esc(r.rifT ? 'Riferimento ' + r.rifT : '')}"><span class="k-tit">${tit}</span><b class="k-val">${A.esc(r.testo)}${r.dubbio ? ' <span class="k-freccia">?</span>' : r.fuori ? ` <span class="k-freccia">${freccia(r)}</span>` : ''}</b><span class="k-sub">${A.esc(r.sub)}</span></div>` : '');
  const feVs = trovaR('vs_fe');
  box.innerHTML = `<div class="riga eco-testa cmr-testa" title="${A.FIN_ALTRE.cmr ? '' : 'Trascina per spostare il pannello'}"><b>❤ RM cardiaca</b><span class="eco-breve small ${feVs?.fuori ? 'ko' : 'muted'}">${A.esc(A.CMR.stato || (feVs ? `FE VS ${feVs.testo}${feVs.fuori ? ' ' + freccia(feVs) : ''}` : ''))}</span><span class="spacer"></span><button class="ghost piccolo" id="cmr-finestra" title="${A.FIN_ALTRE.cmr ? 'Rimetti la scheda nella pagina' : 'Apri la scheda in una finestra separata (spostala su un altro monitor)'}">${A.FIN_ALTRE.cmr ? '⤓' : '⧉'}</button><button class="ghost piccolo" id="cmr-riduci" title="Riduci o espandi">${A.CMR.ridotto ? '▴' : '▾'}</button><button class="ghost piccolo" id="cmr-chiudi" title="Chiudi">✕</button></div>
    ${eco ? `<p class="avviso small" id="cmr-multieco">${A.esc(A.MSG_MULTIECO)}</p>` : A.CMR.noSax ? `<p class="avviso small" id="cmr-nosax">${A.esc(msgNoSax())}</p>` : ''}
    ${K.vs || K.vd ? `<div class="cmr-kpis">${tile(feVs, 'FE VS')}${tile(trovaR('vs_edv'), 'VTD VS')}${tile(trovaR('vd_fe'), 'FE VD')}${trovaR('vs_massa') ? tile(trovaR('vs_massa'), 'Massa VS') : tile(trovaR('vd_edv'), 'VTD VD')}</div>
      ${K.vd?.dubbio ? `<p class="cmr-dubbio">⚠ ${A.esc(K.vd.dubbio)}</p>` : ''}
      ${fuori.length ? `<p class="cmr-allarme">⚠ Fuori dai limiti di riferimento: ${A.esc(fuori.map((r) => `${r.breve} ${r.fuori === 'alto' ? '↑' : '↓'}`).join(', '))}</p>` : ''}`
      : '<p class="cmr-vuoto small">Traccia i ventricoli (passo 1) per vedere qui frazione di eiezione, volumi e massa, con i valori fuori dai limiti segnalati.</p>'}
    <section class="cmr-sez"><h4><span class="cmr-n">1</span> Contorni</h4>
      <div class="riga"><button class="piccolo cmr-auto" id="cmr-auto" title="Trova da solo le cavità dei due ventricoli sulla pila di asse corto e le segue in tutte le fette e le fasi"${A.CMR.lavoro ? ' disabled' : ''}>✳ ${A.CMR.noSax === false && Object.keys(A.CMR.al?.tracce || {}).length ? 'Ricomincia dall\'asse lungo' : 'Traccia VS e VD in automatico'}</button></div>
      <div class="eco-scelte"><select id="cmr-modo" aria-label="Misura">${Object.entries({ vs: '1 · VS: clic nella cavità', vd: '2 · VD: clic nella cavità', man: 'Correggi un contorno a mano', epi: '3 · Epicardio del VS (massa)', flusso: '4 · Flusso (contrasto di fase)', anulus: '5 · Escursione dell\'anulus (MAPSE, TAPSE)', atrio: '6 · Atri (area e volume)', lge: '7 · Enhancement tardivo (LGE)', al: '8 · FE del VS dall\'asse lungo (area-lunghezza)' }).map(([k, n]) => `<option value="${k}"${k === A.CMR.modo ? ' selected' : ''}>${n}</option>`).join('')}</select>
        ${A.CMR.modo === 'anulus' ? `<select id="cmr-anulus">${Object.entries({ 'mapse-s': 'MAPSE settale', 'mapse-l': 'MAPSE laterale', tapse: 'TAPSE' }).map(([k, n]) => `<option value="${k}"${k === A.CMR.anulus.tipo ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}
        ${A.CMR.modo === 'atrio' ? `<select id="cmr-atrio">${Object.entries({ as4: 'Atrio sinistro · 4 camere', as2: 'Atrio sinistro · 2 camere', ad4: 'Atrio destro · 4 camere' }).map(([k, n]) => `<option value="${k}"${k === A.CMR.atrio.vista ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}
        ${A.CMR.modo === 'lge' ? `<select id="cmr-lgen" title="Soglia: media del remoto + n DS">${[2, 3, 5, 6].map((n) => `<option value="${n}"${n === A.CMR.lge.n ? ' selected' : ''}>${n} DS</option>`).join('')}</select><span class="small">passo: <b>${{ epi: '1 epicardio', endo: '2 endocardio', remoto: '3 remoto' }[A.CMR.lge.fase]}</b></span>` : ''}
        ${A.CMR.modo === 'man' ? `<select id="cmr-manv"><option value="vs"${A.CMR.manV !== 'vd' ? ' selected' : ''}>VS</option><option value="vd"${A.CMR.manV === 'vd' ? ' selected' : ''}>VD</option></select>` : ''}</div>
      <p class="small muted cmr-aiuto">${A.esc(AIUTO_CMR[A.CMR.modo])}${A.CMR.punti.length ? ` <b>${A.CMR.punti.length} punti.</b>` : ''}</p>
      <div class="cmr-soglia small"><label title="Soglia tra sangue e miocardio: più bassa = cavità più grande">Soglia <input type="range" id="cmr-k" min="0.35" max="0.75" step="0.05" value="${A.CMR.k}"> <b>${A.virgola(A.CMR.k, 2)}</b></label>
        <label><input type="checkbox" id="cmr-riempi"${A.CMR.riempi ? ' checked' : ''}> papillari e trabecole nella cavità del VS</label></div></section>
    ${A.CMR.modo === 'al' || Object.keys(A.CMR.al?.tracce || {}).length ? `<section class="cmr-sez"><h4><span class="cmr-n">2</span> Asse lungo (area-lunghezza)</h4>${htmlAsseLungo()}</section>` : ''}
    ${A.CMR.sax ? `<section class="cmr-sez"><h4><span class="cmr-n">2</span> Fasi e fette</h4>
      <div class="small muted">${A.CMR.sax.length} fette di asse corto · ${A.virgola(A.CMR.passo, 1)} mm tra le fette · ${nf} fasi${fase ? ` · aperta: <b>${fase}</b>` : ''}</div>
      ${A.CMR.ed != null ? `<div class="cmr-fasi small"><label>Fine diastole <select id="cmr-ed">${opz(A.CMR.ed)}</select></label><button class="ghost piccolo" id="cmr-vai-ed" title="Vai alla fine diastole">Vai</button>
        <label>Fine sistole <select id="cmr-es">${opz(A.CMR.es)}</select></label><button class="ghost piccolo" id="cmr-vai-es" title="Vai alla fine sistole">Vai</button></div>
        ${htmlCurvaCmr()}<div class="cmr-legenda small"><span style="--c:${A.CMR_COL.vs}">VS</span><span style="--c:${A.CMR_COL.vd}">VD</span><span class="muted">volume nel ciclo</span></div>` : ''}
      ${righeTab ? `<div class="cmr-tab-box"><table class="tab eco-tab"><thead><tr><th>Fetta</th><th>VS cm² FD/FS</th><th>VD cm² FD/FS</th><th>Epi</th></tr></thead><tbody>${righeTab}</tbody></table></div><p class="muted small">Spunta solo le fette con il ventricolo (alla base escludi quelle con l'atrio o il tratto di efflusso).</p>` : ''}</section>` : ''}
    <section class="cmr-sez"><h4><span class="cmr-n">${A.CMR.sax ? 3 : 2}</span> Paziente e altre misure</h4>
      <div class="eco-scelte small cmr-paz"><label>Sesso <select id="cmr-sesso"><option value="">—</option><option value="M"${A.CMR.sesso === 'M' ? ' selected' : ''}>Uomo</option><option value="F"${A.CMR.sesso === 'F' ? ' selected' : ''}>Donna</option></select></label>
        <label>Altezza <input type="number" id="cmr-h" min="100" max="230" value="${A.CMR.altezza ?? ''}" style="width:64px"> cm</label><label>Peso <input type="number" id="cmr-w" min="20" max="250" value="${A.CMR.peso ?? ''}" style="width:64px"> kg</label>${ris.bsa ? `<span class="cmr-sc">SC ${A.virgola(ris.bsa, 2)} m²</span>` : ''}</div>
      ${!ris.bsa ? '<p class="small muted">Con altezza e peso i volumi e la massa si indicizzano e si confrontano con i limiti di riferimento.</p>' : ''}
      ${A.CMR.modo === 'flusso' ? `<div class="eco-scelte small"><label>venc <input type="number" id="cmr-venc" min="10" max="800" value="${A.CMR.flusso.venc ?? ''}" style="width:64px"> cm/s</label><label><input type="checkbox" id="cmr-segno"${A.CMR.flusso.segno < 0 ? ' checked' : ''}> inverti il verso</label></div>` : ''}
      <details class="small" id="cmr-ecv-box"${A.CMR.ecvAperto ? ' open' : ''}><summary>T1 e volume extracellulare (ECV)</summary>
        <p class="muted">Misura con la ROI (strumento ROI) il T1 in ms del setto e del sangue nelle mappe T1 prima e dopo il gadolinio e scrivi i valori.</p>
        <div class="eco-scelte">${[['t1m', 'T1 miocardio pre'], ['t1b', 'T1 sangue pre'], ['t1mp', 'T1 miocardio post'], ['t1bp', 'T1 sangue post'], ['hct', 'Ematocrito %']].map(([k, n]) => `<label>${n} <input type="number" data-ecv="${k}" value="${A.CMR.ecv[k] ?? ''}" style="width:64px"></label>`).join('')}</div></details></section>
    ${RM.length || altre.length ? `<section class="cmr-sez cmr-risultati"><h4>📊 Risultati</h4>
      ${RM.length ? `<table class="tab cmr-ris-tab"><thead><tr><th>Misura</th><th>Valore</th><th>Indicizzato</th><th>Riferimento</th></tr></thead><tbody>${RM.map((r) => `<tr class="${r.dubbio ? 'dubbio' : r.fuori ? 'fuori' : ''}"><td>${A.esc(r.nome)}</td><td class="num">${A.esc(r.testo)}${r.dubbio ? ' <b>?</b>' : r.fuori ? ` <b>${freccia(r)}</b>` : ''}</td><td class="num">${A.esc(r.idx)}</td><td class="num muted">${A.esc(r.rifT)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${altre.length ? `<ul class="small eco-ris">${altre.map((x) => `<li>${A.esc(x)}</li>`).join('')}</ul>` : ''}
      ${K.vs?.metodo ? `<p class="small">Volumi del VS con il metodo ${A.esc(K.vs.metodo)}: stima meno precisa della pila di asse corto (Simpson).</p>` : ''}
      <p class="muted small">Riferimenti: adulti, bSSFP, ${A.CMR.sesso === 'M' ? 'uomini' : A.CMR.sesso === 'F' ? 'donne' : 'sesso non indicato (limiti più larghi tra i due sessi)'}; Kawel-Boehm et al., J Cardiovasc Magn Reson 2020.</p></section>` : ''}
    <div class="cmr-azioni"><button class="piccolo primario" id="cmr-copia" title="Porta nel referto la tabella delle misure, con i riferimenti e i valori fuori dai limiti"${RM.length || altre.length ? '' : ' disabled'}>📋 Misure nel referto</button><button class="ghost piccolo" id="cmr-modello" title="Inserisce nel referto lo schema del referto di RM cardiaca con le misure fatte">Modello di referto</button><button class="ghost piccolo" id="cmr-bull" title="Cinetica segmentaria del VS (17 segmenti) e frazione di eiezione nella scheda Σ">Cinetica (Σ)</button>${ris.righe.length || Object.keys(A.CMR.lge.fette).length ? '<button class="ghost piccolo" id="cmr-azzera">Cancella le misure</button>' : ''}</div>
    <details class="small cmr-note"><summary>Metodo e riferimenti</summary><p class="muted">Volumi: somma delle aree × distanza tra le fette (Simpson sulla pila di asse corto). FE del VS: ≤ 40% ridotta, 41-49% lievemente ridotta, ≥ 50% conservata (ESC 2021). Limiti di riferimento (media ± 2 DS, adulti, bSSFP): Kawel-Boehm et al., J Cardiovasc Magn Reson 2020, tabella 2 per il VS (papillari nella massa) e tabella 10 per il VD; dipendono anche dall'età e dal metodo (papillari nella cavità o nella massa). Controlla sempre i contorni: il bordo automatico è un aiuto, non una misura certificata.</p></details>`;
  A.$('#cmr-riduci').onclick = () => { A.CMR.ridotto = !A.CMR.ridotto; pannelloCmr(); };
  A.$('#cmr-chiudi').onclick = () => { if (A.FIN_ALTRE.cmr) { A.chiudiCmrFinestra(); return; } box.hidden = true; A.scegliStrumento('wl'); };
  A.$('#cmr-finestra').onclick = () => { if (A.FIN_ALTRE.cmr) A.chiudiCmrFinestra(); else A.staccaCmr(); };
  box.querySelector('.eco-testa').onpointerdown = (e) => {
    if (e.target.closest('button') || A.FIN_ALTRE.cmr) return;
    const r0 = box.getBoundingClientRect(), dx = e.clientX - r0.left, dy = e.clientY - r0.top;
    const muovi = (ev) => Object.assign(box.style, { left: Math.max(0, Math.min(innerWidth - r0.width, ev.clientX - dx)) + 'px', top: Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px', bottom: 'auto' });
    const fine = () => { removeEventListener('pointermove', muovi); removeEventListener('pointerup', fine); };
    addEventListener('pointermove', muovi); addEventListener('pointerup', fine);
  };
  A.$('#cmr-auto').onclick = () => { A.CMR.lavoro = true; autoCmr().catch((e) => A.avvisoBreve('Non riuscito: ' + e.message)).finally(() => { A.CMR.lavoro = false; pannelloCmr(); }); };
  A.$('#cmr-modo').onchange = (e) => { A.CMR.modo = e.target.value; A.CMR.punti = []; A.CMR.flusso.clic = null; A.disegna(); pannelloCmr(); };
  A.$('#cmr-manv')?.addEventListener('change', (e) => { A.CMR.manV = e.target.value; A.CMR.punti = []; A.disegna(); });
  A.$('#cmr-anulus')?.addEventListener('change', (e) => { A.CMR.anulus.tipo = e.target.value; A.CMR.anulus.p1 = null; A.disegna(); pannelloCmr(); });
  A.$('#cmr-atrio')?.addEventListener('change', (e) => { A.CMR.atrio.vista = e.target.value; A.CMR.punti = []; A.disegna(); pannelloCmr(); });
  A.$('#cmr-lgen')?.addEventListener('change', (e) => { A.CMR.lge.n = +e.target.value; ricalcolaLge(); });
  box.querySelectorAll('[data-ecv]').forEach((c) => c.onchange = () => { A.CMR.ecv[c.dataset.ecv] = +c.value || null; A.CMR.ecvAperto = true; pannelloCmr(); });
  A.$('#cmr-ecv-box').ontoggle = (e) => { A.CMR.ecvAperto = e.target.open; };
  A.$('#cmr-modello').onclick = () => { const m = misureRefertoCmr(ris), t = modelloRefertoCmr(ris) + (m.fuori.length ? `\nValori fuori dai limiti di riferimento: ${m.fuori.map((r) => r.breve + (r.fuori === 'alto' ? ' ↑' : ' ↓')).join('; ')}.` : '');
    A.cmrAlReferto({ testo: t + '\n\n' + m.testo, html: t.split('\n').filter((r) => r.trim()).map((r) => `<p>${A.esc(r)}</p>`).join('') + m.html }); };
  A.$('#cmr-sesso')?.addEventListener('change', (e) => { A.CMR.sesso = e.target.value || null; A.disegna(); pannelloCmr(); });
  A.$('#cmr-bull').onclick = () => A.$('#btn-scale')?.click();
  A.$('#cmr-ed')?.addEventListener('change', (e) => { A.CMR.ed = +e.target.value; A.disegna(); pannelloCmr(); });
  A.$('#cmr-es')?.addEventListener('change', (e) => { A.CMR.es = +e.target.value; A.disegna(); pannelloCmr(); });
  A.$('#cmr-vai-ed')?.addEventListener('click', () => A.mostraDi(A.V.attivo, A.CMR.ed).then(() => { A.disegna(); pannelloCmr(); }));
  A.$('#cmr-vai-es')?.addEventListener('click', () => A.mostraDi(A.V.attivo, A.CMR.es).then(() => { A.disegna(); pannelloCmr(); }));
  A.$('#cmr-k').onchange = (e) => { A.CMR.k = +e.target.value; ricalcolaCmr(); };
  A.$('#cmr-riempi').onchange = (e) => { A.CMR.riempi = e.target.checked; ricalcolaCmr(); };
  A.$('#cmr-h').onchange = (e) => { A.CMR.altezza = +e.target.value || null; pannelloCmr(); };
  A.$('#cmr-w').onchange = (e) => { A.CMR.peso = +e.target.value || null; pannelloCmr(); };
  A.$('#cmr-venc')?.addEventListener('change', (e) => { A.CMR.flusso.venc = +e.target.value || null; calcolaFlusso(); });
  A.$('#cmr-segno')?.addEventListener('change', (e) => { A.CMR.flusso.segno = e.target.checked ? -1 : 1; calcolaFlusso(); });
  box.querySelectorAll('[data-incl]').forEach((c) => c.onchange = () => { A.CMR.incl[c.dataset.incl] = c.checked; A.disegna(); pannelloCmr(); });
  box.querySelectorAll('[data-vai]').forEach((b) => b.onclick = () => { A.selezionaSerie(+b.dataset.vai, A.V.attivo, { idx: A.P().idx }).then(() => { A.disegna(); pannelloCmr(); }); });
  A.$('#cmr-copia')?.addEventListener('click', () => { const m = misureRefertoCmr(ris); A.cmrAlReferto({ testo: m.testo, html: m.html }); });
  box.querySelectorAll('[data-al-serie]').forEach((b) => b.onclick = async () => { const si = +b.dataset.alSerie; await A.selezionaSerie(si, A.V.attivo, { idx: faseAl(si).ed }); A.disegna(); pannelloCmr(); });
  { const si = A.P(A.V.attivo)?.sIdx, t = A.CMR.al?.tracce?.[si];
    if (t) {
      A.$('#cmr-al-ed')?.addEventListener('change', (e) => { t.ed = +e.target.value; t.fasi.ed = { punti: [] }; pannelloCmr(); });
      A.$('#cmr-al-es')?.addEventListener('change', (e) => { t.es = +e.target.value; t.fasi.es = { punti: [] }; pannelloCmr(); });
      A.$('#cmr-al-vai-ed')?.addEventListener('click', () => A.mostraDi(A.V.attivo, t.ed).then(() => { A.disegna(); pannelloCmr(); }));
      A.$('#cmr-al-vai-es')?.addEventListener('click', () => A.mostraDi(A.V.attivo, t.es).then(() => { A.disegna(); pannelloCmr(); }));
    } }
  A.$('#cmr-azzera')?.addEventListener('click', () => { A.azzeraCmr(); A.disegna(); pannelloCmr(); });
}
// nessuna pila di asse corto con le fasi: se il caso ha solo serie T2* multi-eco lo si dice chiaramente
const msgNoSax = () => A.V.serie.some((s, si) => A.ME.get(si)?.eco || (!A.ME.has(si) && A.ME_NOME.test(s.descrizione || '')))
  ? 'Non c\'è una cine in asse corto: le serie di asse corto di questo caso sono T2* multi-eco (echi, non fasi del ciclo cardiaco). Per il ferro usa lo strumento T2* (Altre misure → T2*) con una ROI sul setto.'
  : 'Non trovo una pila di asse corto (servono almeno 3 serie cine di asse corto con le fasi del ciclo).';
async function autoCmr() {
  const sax = await trovaSax();
  if (!sax) { const lax = serieAsseLungo();
    if (lax.length) { A.CMR.modo = 'al'; A.CMR.noSax = false; A.CMR.al ||= { tracce: {} }; const si = lax[0]; await A.selezionaSerie(si, A.V.attivo, { idx: faseAl(si).ed }); A.disegna(); pannelloCmr();
      A.avvisoBreve('Manca la pila di asse corto: misura la FE del VS sulla cine in asse lungo (metodo area-lunghezza). In fine diastole clicca i due punti dell\'anulus mitralico e poi la cavità.'); return; }
    A.CMR.noSax = true; A.avvisoBreve(msgNoSax()); pannelloCmr(); return; }
  if (A.P(A.V.attivo) && A.isMultiEco(A.P(A.V.attivo))) await A.selezionaSerie(sax[Math.floor(sax.length / 2)].si, A.V.attivo, { idx: 0 });
  A.CMR.stato = 'Cerco i ventricoli…'; pannelloCmr();
  const nf = nFasiCmr(), a = Math.floor(sax.length * 0.25), b = Math.ceil(sax.length * 0.75), ris = [];
  for (let i = a; i < b; i++) {
    const fasi = []; for (let f = 0; f < nf; f++) fasi.push(await A.imgCmr(sax[i].si, f));
    const r = A.CM.trovaCentri(fasi); if (!r) continue;
    ris.push({ i, vs: A.pazienteDa(fasi[0], r.vs), vd: r.vd ? A.pazienteDa(fasi[0], r.vd) : null });
  }
  if (!ris.length) { A.CMR.stato = ''; A.avvisoBreve('Non riesco a trovare i ventricoli: clicca tu al centro della cavità.'); pannelloCmr(); return; }
  const dist = (p, q) => Math.hypot(...A.v3.sub(p, q));
  // consenso: il centro del VS più vicino alla mediana di tutte le fette (le fette con un errore restano isolate)
  const mvs = A.CM.mediana2(ris.map((x) => x.vs)), bvs = ris.filter((x) => dist(x.vs, mvs) < 25).sort((p, q) => Math.abs(p.i - sax.length / 2) - Math.abs(q.i - sax.length / 2))[0] || ris[0];
  const vds = ris.filter((x) => x.vd && dist(x.vs, mvs) < 25);
  const mvd = vds.length ? A.CM.mediana2(vds.map((x) => x.vd)) : null, bvd = mvd ? vds.filter((x) => dist(x.vd, mvd) < 30).sort((p, q) => Math.abs(p.i - sax.length / 2) - Math.abs(q.i - sax.length / 2))[0] : null;
  A.CMR.semi.vs = bvs.vs; await analizzaCmr('vs');
  if (bvd) { A.CMR.semi.vd = bvd.vd; await analizzaCmr('vd'); }
  await A.selezionaSerie(sax[bvs.i].si, A.V.attivo, { idx: A.CMR.ed ?? 0 });
  A.CMR.stato = ''; A.disegna(); pannelloCmr();
  A.avvisoBreve(bvd ? 'VS e VD tracciati in automatico: controlla i contorni fetta per fetta.' : 'VS tracciato in automatico; il VD non è stato trovato: clicca al centro della sua cavità (modalità 2).');
}
async function ricalcolaCmr() { for (const v of ['vs', 'vd']) if (A.CMR.semi[v]) await analizzaCmr(v); pannelloCmr(); }
// ---- FE del VS dall'asse lungo (quando manca la pila di asse corto): metodo area-lunghezza. Per ogni fase (fine diastole
// e fine sistole) si cliccano i due punti dell'anulus mitralico e il centro della cavità: il contorno si cerca solo dal lato
// della cavità rispetto al piano valvolare; L = dal punto medio dell'anulus al punto più lontano (apice).
// V = 0,85 · A² / L (monoplano), V = 0,85 · A₁ · A₂ / L (biplano 2 + 4 camere, L la più corta).
const RE_LAX = /2\s*-?\s*(cam|ch)|4\s*-?\s*(cam|ch)|3\s*-?\s*(cam|ch)|asse lungo|long ax|\blax\b|\b[234]ch\b/i;
function serieAsseLungo() {
  return A.V.serie.map((s, si) => ({ s, si })).filter(({ s, si }) => (s.files?.length || 0) >= 8 && !(A.ME.get(si)?.eco) && !A.ME_NOME.test(s.descrizione || '')
    && (RE_LAX.test(s.descrizione || '') || (/cine|ssfp|fiesta|trufi|balance/i.test(s.descrizione || '') && !/asse corto|short|\bsax\b/i.test(s.descrizione || ''))))
    .sort((x, y) => (/2\s*-?\s*(cam|ch)/i.test(y.s.descrizione) - /2\s*-?\s*(cam|ch)/i.test(x.s.descrizione))).map((x) => x.si);
}
const vistaAl = (si) => { const d = A.V.serie[si]?.descrizione || ''; return /4\s*-?\s*(cam|ch)/i.test(d) ? '4 camere' : /2\s*-?\s*(cam|ch)/i.test(d) ? '2 camere' : /3\s*-?\s*(cam|ch)/i.test(d) ? '3 camere' : 'asse lungo'; };
function faseAl(si) { A.CMR.al ||= { tracce: {} }; const n = A.V.serie[si]?.files.length || 1; return (A.CMR.al.tracce[si] ||= { ed: 0, es: Math.round(n * 0.35), fasi: {} }); }
async function puntoAsseLungo(p, pt) {
  if (A.isMultiEco(p)) { A.avvisoBreve(A.MSG_MULTIECO); return; }
  const si = p.sIdx, n = A.V.serie[si]?.files.length || 0;
  if (n < 8) { A.avvisoBreve('Serve una cine in asse lungo (2 o 4 camere) con le fasi del ciclo.'); return; }
  const t = faseAl(si), quale = p.idx === t.ed ? 'ed' : p.idx === t.es ? 'es' : null;
  if (!quale) { A.avvisoBreve('Vai in fine diastole o in fine sistole (pulsanti «Vai» nella scheda), poi clicca.'); return; }
  const f = (t.fasi[quale] ||= { punti: [] });
  if (f.r) { f.punti = []; f.r = null; delete A.CMR.seg[`al|${si}|${p.idx}`]; }
  f.punti.push({ x: pt.x, y: pt.y });
  if (f.punti.length < 3) { A.avvisoBreve(f.punti.length === 1 ? 'Ora il secondo punto dell\'anulus mitralico.' : ''); A.disegna(); pannelloCmr(); return; }
  const [a1, a2, seme] = f.punti, im = await A.imgCmr(si, p.idx), lato = (q) => (a2.x - a1.x) * (q.y - a1.y) - (a2.y - a1.y) * (q.x - a1.x), sSeme = Math.sign(lato(seme));
  const limite = (x, y) => Math.sign(lato({ x, y })) === sSeme;
  let r = null; for (const dk of [0, 0.1, 0.2]) { r = A.CM.segmentaCavita(im, seme, { k: Math.min(0.9, A.CMR.k + dk), riempi: A.CMR.riempi, raggioMm: 90, minSangue: 0.4, limite }); if (!r || r.perdita <= 0.12) break; }
  if (!r) { A.avvisoBreve('Non trovo la cavità: clicca più al centro del ventricolo (i due punti dell\'anulus restano).'); f.punti = [a1, a2]; A.disegna(); pannelloCmr(); return; }
  const m = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 }, mm = (q) => Math.hypot((q.x - m.x) * (im.spCol || 1), (q.y - m.y) * (im.spRow || 1));
  let apice = r.bordo[0], L = 0; for (const q of r.bordo) { const d = mm(q); if (d > L) { L = d; apice = q; } }
  f.r = r; f.area = r.area; f.L = L; f.apice = apice; f.m = m; A.CMR.seg[`al|${si}|${p.idx}`] = r; A.T.misure++;
  A.disegna(); pannelloCmr();
  if (quale === 'ed' && !t.fasi.es?.r) A.avvisoBreve('Fine diastole fatta. Ora vai in fine sistole («Vai FS») e ripeti: anulus, anulus, cavità.');
}
// volumi del VS dall'asse lungo: biplano se ci sono due viste (2 e 4 camere) complete, altrimenti monoplano
function cifreAsseLungo() {
  const fatte = Object.entries(A.CMR.al?.tracce || {}).filter(([, t]) => t.fasi.ed?.r && t.fasi.es?.r).map(([si, t]) => ({ si: +si, t, vista: vistaAl(+si) }));
  if (!fatte.length) return null;
  const v2 = fatte.find((x) => x.vista === '2 camere'), v4 = fatte.find((x) => x.vista === '4 camere');
  const vol = (fase, lista) => (lista.length === 2 ? 0.85 * (lista[0].t.fasi[fase].area / 100) * (lista[1].t.fasi[fase].area / 100) / (Math.min(lista[0].t.fasi[fase].L, lista[1].t.fasi[fase].L) / 10)
    : 0.85 * (lista[0].t.fasi[fase].area / 100) ** 2 / (lista[0].t.fasi[fase].L / 10));
  const lista = v2 && v4 ? [v2, v4] : [fatte[0]];
  // il volume maggiore è la fine diastole (se le fasi scelte erano invertite si scambiano)
  const vd1 = vol('ed', lista), vs1 = vol('es', lista), edv = Math.max(vd1, vs1), esv = Math.min(vd1, vs1);
  return { edv, esv, sv: edv - esv, fe: (edv - esv) / edv * 100, scambiate: vs1 > vd1, metodo: lista.length === 2 ? 'area-lunghezza biplano (2 e 4 camere)' : `area-lunghezza monoplano (${lista[0].vista})` };
}
function htmlAsseLungo() {
  const lax = serieAsseLungo(), p = A.P(A.V.attivo), si = p?.sIdx;
  if (!lax.length) return '<p class="small muted">In questo esame non trovo una cine in asse lungo (2 o 4 camere).</p>';
  if (!lax.includes(si)) return `<p class="small">Apri una cine in asse lungo: ${lax.map((x) => `<button class="ghost piccolo" data-al-serie="${x}">${A.esc(A.V.serie[x].descrizione || 'serie ' + (x + 1))}</button>`).join(' ')}</p>`;
  const t = faseAl(si), n = A.V.serie[si].files.length, opz = (sel) => Array.from({ length: n }, (_, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${i + 1}</option>`).join('');
  const stato = (q) => { const f = t.fasi[q]; return f?.r ? `✓ area ${A.virgola(f.area / 100, 1)} cm² · L ${A.virgola(f.L / 10, 1)} cm · ${A.virgola(0.85 * (f.area / 100) ** 2 / (f.L / 10), 0)} mL` : f?.punti?.length ? `${f.punti.length}/3 punti` : 'da fare'; };
  return `<div class="small muted">${A.esc(A.V.serie[si].descrizione || '')} · ${vistaAl(si)} · ${n} fasi${p.idx === t.ed ? ' · aperta: <b>fine diastole</b>' : p.idx === t.es ? ' · aperta: <b>fine sistole</b>' : ''}</div>
    <div class="cmr-fasi small"><label>Fine diastole <select id="cmr-al-ed">${opz(t.ed)}</select></label><button class="ghost piccolo" id="cmr-al-vai-ed">Vai</button>
      <label>Fine sistole <select id="cmr-al-es">${opz(t.es)}</select></label><button class="ghost piccolo" id="cmr-al-vai-es">Vai</button></div>
    <ul class="small cmr-al-stato"><li><b>FD</b>: ${stato('ed')}</li><li><b>FS</b>: ${stato('es')}</li></ul>
    ${cifreAsseLungo()?.scambiate ? '<p class="cmr-dubbio">⚠ Il volume in «fine sistole» è maggiore di quello in «fine diastole»: le fasi sono state scambiate nel calcolo. Controlla con il cine quali sono davvero la fine diastole e la fine sistole.</p>' : ''}
    ${lax.length > 1 ? `<p class="small muted">Con una seconda vista (2 e 4 camere) il calcolo diventa biplano: ${lax.filter((x) => x !== si).map((x) => `<button class="ghost piccolo" data-al-serie="${x}">${A.esc(A.V.serie[x].descrizione || '')}</button>`).join(' ')}</p>` : ''}`;
}
async function puntoCmr(k, pt) {
  const p = A.P(k), img = p.img; if (!img) return;
  if (A.CMR.modo === 'al') { await puntoAsseLungo(p, pt); return; }
  if (A.isMultiEco(p)) { A.avvisoBreve(A.MSG_MULTIECO); return; }
  if (A.CMR.modo === 'vs' || A.CMR.modo === 'vd') {
    if (!img.ipp || !img.iop) { A.avvisoBreve('Questa immagine non ha la posizione nello spazio: servono le cine di asse corto.'); return; }
    const sax = await trovaSax(); if (!sax) { A.avvisoBreve(msgNoSax()); return; }
    if (!sax.some((x) => x.si === p.sIdx)) { A.avvisoBreve('Clicca su una fetta di asse corto (le serie «asse corto»).'); return; }
    A.CMR.semi[A.CMR.modo] = A.pazienteDa(img, pt); A.CMR.stato = 'Analisi in corso…'; pannelloCmr();
    analizzaCmr(A.CMR.modo).catch((e) => { A.CMR.lavoro = false; A.avvisoBreve('Analisi non riuscita: ' + e.message); });
    return;
  }
  if (A.CMR.modo === 'flusso') {
    if (!A.CMR.flusso.clic || A.CMR.flusso.clic.k !== k || A.CMR.flusso.clic.sIdx !== p.sIdx) { A.CMR.flusso.clic = { k, sIdx: p.sIdx, x: pt.x, y: pt.y }; A.disegna(); return; }
    const c = A.CMR.flusso.clic, r = Math.hypot(pt.x - c.x, pt.y - c.y);
    if (r < 1.5) return;
    A.CMR.flusso.roi = { k, sIdx: p.sIdx, x: c.x, y: c.y, r }; A.CMR.flusso.clic = null;
    await calcolaFlusso(); return;
  }
  if (A.CMR.modo === 'anulus') {
    const a = A.CMR.anulus;
    if (!a.p1 || a.p1.k !== k || a.p1.sIdx !== p.sIdx) { a.p1 = { k, sIdx: p.sIdx, idx: p.idx, x: pt.x, y: pt.y }; A.avvisoBreve('Ora vai al fotogramma di fine sistole e clicca lo stesso punto dell\'anulus.'); A.disegna(); return; }
    if (a.p1.idx === p.idx) { a.p1 = { k, sIdx: p.sIdx, idx: p.idx, x: pt.x, y: pt.y }; A.disegna(); return; }
    a.ris[a.tipo] = Math.hypot((pt.x - a.p1.x) * img.spCol, (pt.y - a.p1.y) * img.spRow); a.p2 = { k, sIdx: p.sIdx, idx: p.idx, x: pt.x, y: pt.y, da: a.p1 }; a.p1 = null; A.T.misure++;
    A.disegna(); pannelloCmr(); return;
  }
  if (A.CMR.modo === 'lge' && A.CMR.lge.fase === 'remoto') {
    const L = A.CMR.lge, chiave = `${p.sIdx}|${p.idx}`;
    if (!L.clic || L.clic.chiave !== chiave) { L.clic = { chiave, x: pt.x, y: pt.y }; A.disegna(); return; }
    const r = Math.hypot(pt.x - L.clic.x, pt.y - L.clic.y); if (r < 1) return;
    const f = L.fette[chiave]; f.remoto = { x: L.clic.x, y: L.clic.y, r }; f.spessore = img.spessore; L.clic = null; L.fase = 'epi';
    f.ris = A.CM.lgeFetta(img, f.epi, f.endo, f.remoto, L.n); A.T.misure++; A.disegna(); pannelloCmr(); return;
  }
  if (A.CMR.pk && (A.CMR.pk.k !== k || A.CMR.pk.sIdx !== p.sIdx || A.CMR.pk.idx !== p.idx)) A.CMR.punti = [];
  A.CMR.pk = { k, sIdx: p.sIdx, idx: p.idx }; A.CMR.punti.push(pt); A.disegna(); pannelloCmr();
}
async function ricalcolaLge() {
  for (const [chiave, f] of Object.entries(A.CMR.lge.fette)) { if (!f.remoto) continue; const [si, idx] = chiave.split('|').map(Number); f.ris = A.CM.lgeFetta(await A.imgCmr(si, idx), f.epi, f.endo, f.remoto, A.CMR.lge.n); }
  A.disegna(); pannelloCmr();
}
function modelloRefertoCmr(ris) {
  const t = ris.righe, trova = (re) => t.find((x) => re.test(x));
  return ['RM CARDIACA',
    'Tecnica: cine bSSFP in asse lungo (2, 3, 4 camere) e pila di asse corto; [mappe T1 prima e dopo mdc]; [enhancement tardivo dopo gadolinio].',
    `Ventricolo sinistro: ${trova(/^Ventricolo sinistro/)?.replace(/^Ventricolo sinistro: /, '') || 'dimensioni …, spessori parietali … mm, frazione di eiezione …%'}. Cinetica segmentaria: ….${trova(/^MAPSE settale/) ? ' ' + trova(/^MAPSE settale/) + '.' : ''}${trova(/^MAPSE laterale/) ? ' ' + trova(/^MAPSE laterale/) + '.' : ''}`,
    `Ventricolo destro: ${trova(/^Ventricolo destro/)?.replace(/^Ventricolo destro: /, '') || 'dimensioni e funzione …'}${trova(/^TAPSE/) ? '; ' + trova(/^TAPSE/) : ''}.`,
    `Atri: ${[trova(/^Atrio sinistro/), trova(/^Atrio destro/)].filter(Boolean).join('; ') || '…'}.`,
    'Valvole: … (getti di dephasing, flussi).' + (trova(/^Flusso/) ? ' ' + trova(/^Flusso/) + '.' : ''),
    `Caratterizzazione tissutale: ${[trova(/^T1 nativo/), trova(/^Enhancement/)].filter(Boolean).join('; ') || 'enhancement tardivo … (sede, estensione, pattern: subendocardico o transmurale = ischemico; intramiocardico o subepicardico = non ischemico)'}.`,
    'Pericardio: ….',
    'Conclusioni: ….'].join('\n');
}
function chiudiPuntiCmr() {
  if (A.CMR.punti.length < 4) { A.avvisoBreve('Servono almeno 4 punti.'); return; }
  const { sIdx, idx, k } = A.CMR.pk, img = A.P(k).img, area = A.CM.areaPoligonoMm(A.CMR.punti, img), punti = A.CMR.punti.slice();
  if (A.CMR.modo === 'atrio') {
    A.CMR.atrio.tracce[A.CMR.atrio.vista] = { punti, area, L: A.CM.lunghezzaDaAnulus(punti, img), sIdx, idx };
    A.CMR.punti = []; A.T.misure++; A.disegna(); pannelloCmr(); return;
  }
  if (A.CMR.modo === 'lge') {
    const L = A.CMR.lge, chiave = `${sIdx}|${idx}`; L.fette[chiave] ||= {};
    if (L.fase === 'epi') { L.fette[chiave] = { epi: punti }; L.fase = 'endo'; }
    else if (L.fase === 'endo') { if (!L.fette[chiave].epi) { A.avvisoBreve('Prima l\'epicardio di questa fetta.'); return; } L.fette[chiave].endo = punti; L.fase = 'remoto'; }
    A.CMR.punti = []; A.disegna(); pannelloCmr(); return;
  }
  if (A.CMR.modo === 'epi') {
    if (A.CMR.ed != null && idx !== A.CMR.ed) { A.avvisoBreve(`L'epicardio si traccia in fine diastole (fase ${A.CMR.ed + 1}).`); return; }
    A.CMR.epi[sIdx] = { punti, area, idx };
  } else A.CMR.man[`${A.CMR.manV === 'vd' ? 'vd' : 'vs'}|${sIdx}|${idx}`] = { punti, area };
  A.CMR.punti = []; A.T.misure++; A.disegna(); pannelloCmr();
}
async function calcolaFlusso() {
  const R = A.CMR.flusso.roi; if (!R) { pannelloCmr(); return; }
  // serie di fase: quella aperta se è di fase, altrimenti una con lo stesso piano e lo stesso numero di fotogrammi
  const isFase = async (si) => /(^|\\)P(\\|$)/.test((await A.imgCmr(si, 0)).tipoImmagine);
  let si = R.sIdx;
  if (!(await isFase(si))) {
    const im0 = await A.imgCmr(R.sIdx, 0); si = null;
    for (let j = 0; j < A.V.serie.length && si == null; j++) {
      if (j === R.sIdx || A.V.serie[j].files.length !== A.V.serie[R.sIdx].files.length) continue;
      const im = await A.imgCmr(j, 0); if (await isFase(j) && im.ipp && im0.ipp && Math.hypot(...A.v3.sub(im.ipp, im0.ipp)) < 2) si = j;
    }
    if (si == null) { A.avvisoBreve('Non trovo l\'immagine di fase di questo piano: apri la serie di contrasto di fase.'); return; }
  }
  const s = A.V.serie[si], imgs = []; for (let f = 0; f < s.files.length; f++) imgs.push(await A.imgCmr(si, f));
  if (!A.CMR.flusso.venc) { const m = imgs[0].sequenza.match(/_v(\d+)/); A.CMR.flusso.venc = m ? +m[1] : 150; }
  const tempi = imgs.map((im) => im.trigger);
  A.CMR.flusso.ris = A.CM.flussoROI(imgs, R, A.CMR.flusso.venc, { segno: A.CMR.flusso.segno, tempi: tempi.every(Number.isFinite) ? tempi : null });
  A.CMR.flusso.si = si; A.T.misure++; A.disegna(); pannelloCmr();
}
function disegnaCmr(k, g) {
  if (A.V.tool !== 'cmr' && !A.CMR.semi.vs && !A.CMR.semi.vd && !Object.keys(A.CMR.al?.tracce || {}).length && !A.CMR.flusso.roi && !A.CMR.anulus.p2 && !Object.keys(A.CMR.atrio.tracce).length && !Object.keys(A.CMR.lge.fette).length) return;
  const p = A.P(k); if (!p?.img) return;
  const punti = (lista, col, chiuso = true) => { if (!lista?.length) return; A.ctx.save(); A.ctx.strokeStyle = col; A.ctx.lineWidth = 2; A.ctx.beginPath();
    lista.forEach((t, i) => { const q = A.aSchermo(g, t); i ? A.ctx.lineTo(q.x, q.y) : A.ctx.moveTo(q.x, q.y); }); if (chiuso) A.ctx.closePath(); A.ctx.stroke(); A.ctx.restore(); };
  for (const v of ['vs', 'vd']) {
    const m = A.CMR.man[`${v}|${p.sIdx}|${p.idx}`];
    if (m) { punti(m.punti, A.CMR_COL[v]); continue; }
    const r = A.CMR.seg[`${v}|${p.sIdx}|${p.idx}`]; if (!r || r.vuota) continue;
    const dentro = inclusa(v, p.sIdx) && !r.perso; A.ctx.save(); A.ctx.fillStyle = dentro ? A.CMR_COL[v] : 'rgba(255,255,255,.45)';
    const passo = Math.max(1, Math.floor(r.bordo.length / 400));
    for (let i = 0; i < r.bordo.length; i += passo) { const q = A.aSchermo(g, { x: r.bordo[i].x + 0.5, y: r.bordo[i].y + 0.5 }); A.ctx.fillRect(q.x - 1, q.y - 1, 2, 2); }
    A.ctx.restore();
  }
  { const t = A.CMR.al?.tracce?.[p.sIdx]; const f = t && (p.idx === t.ed ? t.fasi.ed : p.idx === t.es ? t.fasi.es : null);
    if (f) {
      if (f.r) { A.ctx.save(); A.ctx.fillStyle = A.CMR_COL.vs; const passo = Math.max(1, Math.floor(f.r.bordo.length / 500)); for (let i = 0; i < f.r.bordo.length; i += passo) { const q = A.aSchermo(g, { x: f.r.bordo[i].x + 0.5, y: f.r.bordo[i].y + 0.5 }); A.ctx.fillRect(q.x - 1, q.y - 1, 2, 2); } A.ctx.restore(); }
      if (f.punti.length >= 2) punti(f.punti.slice(0, 2), '#ffd34d', false);
      if (f.r && f.m && f.apice) { A.ctx.save(); A.ctx.setLineDash([5, 4]); punti([f.m, f.apice], '#ffffff', false); A.ctx.restore(); }
      A.ctx.save(); A.ctx.fillStyle = '#ffd34d'; for (const q0 of f.punti) { const q = A.aSchermo(g, q0); A.ctx.beginPath(); A.ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); A.ctx.fill(); } A.ctx.restore();
    } }
  if (A.CMR.epi[p.sIdx] && p.idx === A.CMR.epi[p.sIdx].idx) punti(A.CMR.epi[p.sIdx].punti, A.CMR_COL.epi);
  const R = A.CMR.flusso.roi;
  if (R && (R.sIdx === p.sIdx || R.sIdx === A.CMR.flusso.si || p.sIdx === A.CMR.flusso.si)) { const c = A.aSchermo(g, R), e = A.aSchermo(g, { x: R.x + R.r, y: R.y }); A.ctx.save(); A.ctx.strokeStyle = A.CMR_COL.flusso; A.ctx.lineWidth = 2; A.ctx.beginPath(); A.ctx.arc(c.x, c.y, Math.hypot(e.x - c.x, e.y - c.y), 0, 2 * Math.PI); A.ctx.stroke(); A.ctx.restore(); }
  const an = A.CMR.anulus;
  for (const q0 of [an.p1, an.p2?.da]) if (q0 && q0.sIdx === p.sIdx) { const q = A.aSchermo(g, q0); A.ctx.save(); A.ctx.strokeStyle = '#ffd34d'; A.ctx.lineWidth = 2; A.ctx.beginPath(); A.ctx.arc(q.x, q.y, 5, 0, 2 * Math.PI); A.ctx.stroke(); A.ctx.restore(); }
  if (an.p2 && an.p2.sIdx === p.sIdx) { const a = A.aSchermo(g, an.p2.da), b = A.aSchermo(g, an.p2); A.ctx.save(); A.ctx.strokeStyle = '#ffd34d'; A.ctx.lineWidth = 2; A.ctx.beginPath(); A.ctx.moveTo(a.x, a.y); A.ctx.lineTo(b.x, b.y); A.ctx.stroke(); A.ctx.fillStyle = '#ffd34d'; A.ctx.fillRect(b.x - 3, b.y - 3, 6, 6); A.ctx.restore(); }
  for (const [vi, t] of Object.entries(A.CMR.atrio.tracce)) if (t.sIdx === p.sIdx && t.idx === p.idx) { punti(t.punti, vi === 'ad4' ? '#ff9f43' : '#b48cff'); const q = A.aSchermo(g, t.punti[0]); A.ctx.save(); A.ctx.font = '12px system-ui, sans-serif'; A.testoContorno(`${vi === 'ad4' ? 'AD' : 'AS'} ${A.virgola(t.area / 100, 1)} cm²`, q.x + 6, q.y - 6, '#fff'); A.ctx.restore(); }
  const fl = A.CMR.lge.fette[`${p.sIdx}|${p.idx}`];
  if (fl) {
    if (fl.epi) punti(fl.epi, '#7dff7a'); if (fl.endo) punti(fl.endo, '#41d1ff');
    if (fl.remoto) { const c = A.aSchermo(g, fl.remoto), e = A.aSchermo(g, { x: fl.remoto.x + fl.remoto.r, y: fl.remoto.y }); A.ctx.save(); A.ctx.strokeStyle = '#fff'; A.ctx.lineWidth = 1.5; A.ctx.beginPath(); A.ctx.arc(c.x, c.y, Math.hypot(e.x - c.x, e.y - c.y), 0, 2 * Math.PI); A.ctx.stroke(); A.ctx.restore(); }
    if (fl.ris) { A.ctx.save(); A.ctx.fillStyle = 'rgba(255,60,60,.75)'; const z = A.aSchermo(g, { x: 1, y: 0 }), o = A.aSchermo(g, { x: 0, y: 0 }), d = Math.max(1.5, Math.hypot(z.x - o.x, z.y - o.y));
      for (const t of fl.ris.acceso) { const q = A.aSchermo(g, { x: t.x + 0.5, y: t.y + 0.5 }); A.ctx.fillRect(q.x - d / 2, q.y - d / 2, d, d); } A.ctx.restore(); }
  }
  if (A.CMR.lge.clic && A.CMR.lge.clic.chiave === `${p.sIdx}|${p.idx}`) { const c = A.aSchermo(g, A.CMR.lge.clic); A.ctx.save(); A.ctx.fillStyle = '#fff'; A.ctx.fillRect(c.x - 3, c.y - 3, 6, 6); A.ctx.restore(); }
  if (A.CMR.flusso.clic && A.CMR.flusso.clic.k === k) { const c = A.aSchermo(g, A.CMR.flusso.clic); A.ctx.save(); A.ctx.fillStyle = A.CMR_COL.flusso; A.ctx.fillRect(c.x - 3, c.y - 3, 6, 6); A.ctx.restore(); }
  if (A.CMR.punti.length && A.CMR.pk?.k === k && A.CMR.pk.sIdx === p.sIdx && A.CMR.pk.idx === p.idx) {
    punti(A.CMR.punti, '#fff', false); for (const t of A.CMR.punti) { const q = A.aSchermo(g, t); A.ctx.fillStyle = '#fff'; A.ctx.fillRect(q.x - 2, q.y - 2, 4, 4); } }
  if (A.V.tool === 'cmr' && A.CMR.ed != null && A.CMR.sax?.some((x) => x.si === p.sIdx)) {
    A.ctx.save(); A.ctx.font = '12px system-ui, sans-serif'; A.testoContorno(p.idx === A.CMR.ed ? 'fine diastole' : p.idx === A.CMR.es ? 'fine sistole' : `fase ${p.idx + 1}`, 10, 34, p.idx === A.CMR.ed ? '#41d1ff' : p.idx === A.CMR.es ? '#ff9f43' : '#ccc'); A.ctx.restore();
  }
}

export { pannelloCmr, disegnaCmr, puntoCmr, chiudiPuntiCmr, autoCmr, cifreCmr };
