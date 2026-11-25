// Strumenti particolari del visualizzatore: fusione PET/TC, calcio coronarico, confronto IA con l'esame precedente, misure ecocardiografiche
// Estratto da app.js nella 1.328 (strumenti_claude/divisione/dividi2.mjs) senza modifiche al contenuto, salvo i nomi di
// app.js letti come A.nome (ponte PONTE_EX) e le istruzioni che app.js eseguiva al caricamento, ora in avvio().
// Si carica solo quando serve (app.js, caricaExtra): chi non lo usa non lo scarica. Niente import './app.js'.
let A = null;
export const collega = (p) => { A = p; };
export const NOMI_APP = ["$","CAC","CFIA","CLIENT","ECO","FUS","GIALLO","MPR","P","T","V","aComune","aPaziente","aSchermo","aSchermoPiano","allineate","applica","attiva","autoAllinea","avvisoBreve","bloccoEsame","caricaRaw","ctx","daComune","decodificaDicom","disegna","esc","evidenziaSerie","fettaVicina","getJSON","immagineDi","impostaRiquadri","inserisciNelReferto","intestazioneDicom","inversa","iopComune","modEco","mostraDi","normaleDi","offsetDi","repertiIAConsentiti","ruotaCtx","ruotato","scegliStrumento","seguiNelTempo","selezionaSerie","serieCorrispondente","statoMPR","studioDi","suvizza","tempiTraccia","testoContorno","vdtGiorni","virgola","visibili"];

// mappe colore della fusione: punti [t, r, g, b] con t e colori da 0 a 1 (stesso formato di Cornerstone per l'MPR)
let MAPPE_PET;   // valore in avvio()
function lutDa(punti) {
  const l = new Uint8ClampedArray(256 * 3), n = punti.length / 4;
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let k = 0; while (k < n - 2 && punti[(k + 1) * 4] < t) k++;
    const t0 = punti[k * 4], t1 = punti[(k + 1) * 4], f = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 0;
    for (let c = 1; c <= 3; c++) l[i * 3 + c - 1] = (punti[k * 4 + c] + (punti[(k + 1) * 4 + c] - punti[k * 4 + c]) * f) * 255;
  }
  return l;
}
let mappaFus;   // valore in avvio()
let LUT_FUS;   // valore in avvio()
async function tipiSerie() {               // modalità di ogni serie (prima immagine)
  if (A.FUS.tipi) return A.FUS.tipi;
  A.FUS.tipi = await Promise.all(A.V.serie.map(async (s) => {
    const m = A.V.metaSerie?.[s.files[0]]; if (m && m[2] !== 'obliqua') return { mod: m[0], for: m[1], n: s.files.length, piano: m[2] || '' };
    try { const ds = await A.intestazioneDicom(`/casi/${A.V.caso.id}/${s.files[0]}`), fl = (n) => { const v = [...Array(n).keys()].map((i) => ds.floatString('x00200037', i)); return v.every(Number.isFinite) ? v : null; };
      const im = { modalita: (ds.string('x00080060') || '').trim(), for: ds.string('x00200052') || '', iop: fl(6) }; const n = im.iop ? [im.iop[1] * im.iop[5] - im.iop[2] * im.iop[4], im.iop[2] * im.iop[3] - im.iop[0] * im.iop[5], im.iop[0] * im.iop[4] - im.iop[1] * im.iop[3]].map(Math.abs) : null;
      return { mod: im.modalita, for: im.for, n: s.files.length, piano: n ? ['sagittale', 'coronale', 'assiale'][n.indexOf(Math.max(...n))] : '' }; }
    catch { return { mod: '' }; }
  }));
  return A.FUS.tipi;
}
async function aggiornaFusioneUI() {
  A.FUS.attiva = false; A.FUS.tipi = null; A.FUS.cache.clear(); A.FUS.sIdx = null; A.FUS.base = null; A.FUS.sceltaUtente = false;
  A.$('#fusione-wrap').hidden = true; A.$('#btn-fusione').classList.remove('on');
  const tipi = await tipiSerie();
  const pet = tipi.map((t, i) => [t, i]).filter(([t]) => ['PT', 'NM'].includes(t.mod) && t.n >= 10);
  // fusione anche tra studi diversi (TC con RM, ecc.): servono almeno due studi e, per vederla, la coregistrazione
  // qualsiasi serie TC o RM (di altri studi, che vanno coregistrati, o della stessa seduta: per esempio due fasi)
  const altre = tipi.map((t, i) => [t, i]).filter(([t]) => ['CT', 'MR'].includes(t.mod) && t.n >= 10);
  if (altre.length < 2 && !pet.length) altre.length = 0;
  if (!(pet.length && tipi.some((t) => t.mod === 'CT')) && !altre.length) return;
  A.$('#fusione-wrap').hidden = false;
  // prima la PET corretta per l'attenuazione (AC/CTAC): la NAC (non corretta) è solo di controllo
  const nac = (i) => /(^|[^A-Z])(NAC|NOAC|NON[ _-]?AC|UNCORR|NON[ _-]?CORR)/i.test(A.V.serie[i].descrizione);
  pet.sort(([, a], [, b]) => nac(a) - nac(b) || a - b);
  const nomeMod = { CT: 'TC', MR: 'RM' };
  A.$('#fusione-serie').innerHTML = (pet.length ? `<optgroup label="PET">${pet.map(([, i]) => `<option value="${i}">${A.esc(A.V.serie[i].descrizione)}${nac(i) ? ' (non corretta)' : ''}</option>`).join('')}</optgroup>` : '')
    + (altre.length ? `<optgroup label="TC e RM">${altre.map(([t, i]) => `<option value="${i}">${nomeMod[t.mod] || t.mod}: ${A.esc(A.V.serie[i].descrizione)}${t.piano ? ` (${t.piano})` : ''}</option>`).join('')}</optgroup>` : '');
  // serie di base (sotto): quella del riquadro attivo, si può cambiare da qui
  const basi = tipi.map((t, i) => [t, i]).filter(([t]) => ['CT', 'MR'].includes(t.mod) && t.n >= 10);
  A.$('#fusione-base').innerHTML = basi.map(([t, i]) => `<option value="${i}">${nomeMod[t.mod] || t.mod}: ${A.esc(A.V.serie[i].descrizione)}</option>`).join('');
}
// colori: la mappa PET per la PET, il verde per una TC o RM sovrapposta (finché non se ne sceglie un'altra)
function mappaPerSovrapposta() {
  const t = A.FUS.tipi?.[Number(A.$('#fusione-serie').value)], pet = ['PT', 'NM'].includes(t?.mod);
  let salvata = null; try { salvata = localStorage.getItem('quiz-mappa-pet'); } catch {}
  const k = pet ? (MAPPE_PET[salvata] ? salvata : 'caldo') : (MAPPE_PET[A.FUS.mappaAltro] ? A.FUS.mappaAltro : 'verde');
  mappaFus = k; LUT_FUS = lutDa(MAPPE_PET[k].punti); A.$('#fusione-mappa').value = k;
  A.$('#fusione-mappa').title = pet ? 'Mappa colore della PET' : 'Colore della serie sovrapposta';
}
async function aggiornaFusione(k) {
  const p = A.P(k);
  if (!A.FUS.attiva || !p.img?.ipp || p.img.modalita === 'PT' || p.img.modalita === 'NM' || p.sIdx === A.FUS.sIdx || (A.FUS.base != null && p.sIdx !== A.FUS.base)) { p.fus = null; return; }
  const s = A.V.serie[A.FUS.sIdx]; if (!s) return;
  const frames = (s._frames ||= s.files.map((f) => ({ url: `/casi/${A.V.caso.id}/${f}` })));
  const centro = A.aPaziente(p.img, { x: p.img.cols / 2, y: p.img.rows / 2 });
  const t = await A.fettaVicina(frames, centro, A.iopComune(p.img)).catch(() => null);
  if (!t || t.scarto > Math.max(5, t.spessore)) { p.fus = null; A.disegna(); return; }
  const f = frames[t.i];
  let pet = A.FUS.cache.get(f.url);
  if (!pet) {
    pet = A.suvizza(A.decodificaDicom(await A.caricaRaw(f)), s.suv); A.FUS.cache.set(f.url, pet);
    if (A.FUS.cache.size > 80) A.FUS.cache.delete(A.FUS.cache.keys().next().value);
  }
  if (A.FUS.max == null && pet.suv) A.FUS.max = 6;   // con i SUV: scala 0–6 come nelle consolle PET
  if (A.FUS.max == null) {                   // scala: 99,5° percentile della prima fetta con attività
    const v = Array.from(pet.pix, (x) => x * pet.slope + pet.inter).sort((x, y) => x - y);
    A.FUS.max = Math.max(1e-6, v[Math.floor(v.length * 0.995)]); A.$('#fusione-max').value = '100';
  }
  p.fus = pet; testoScalaFusione(A.FUS.max, pet.suv); A.disegna();
}
function disegnaFusione(k, g) {
  const p = A.P(k), pet = p.fus, img = p.img;
  if (!A.FUS.attiva || !pet || !img?.ipp || !pet.ipp) return;
  if (pet.for && img.for && pet.for !== img.for && !A.allineate(pet, img)) {
    A.testoContorno('Fusione: coregistra prima i due studi (pulsante «Coregistrazione automatica»)', g.R.x + 10, g.R.y + g.R.h - 30, A.GIALLO); return;
  }
  const max = A.FUS.max * (Number(A.$('#fusione-max').value) || 100) / 100;
  const c = (pet._canvas ||= document.createElement('canvas'));
  if (pet._max !== max || pet._mappa !== mappaFus || pet._soglia !== A.FUS.soglia) {
    const t0 = Math.round(A.FUS.soglia * 255), rampa = 0.2 * 255;
    const petLike = !!pet.suv || /^(PT|NM)$/.test(pet.modalita || '');
    c.width = pet.cols; c.height = pet.rows; const cx = c.getContext('2d'), id = cx.createImageData(pet.cols, pet.rows), d = id.data;
    for (let i = 0, j = 0; i < pet.pix.length; i++, j += 4) {
      const v = Math.max(0, Math.min(255, ((pet.pix[i] * pet.slope + pet.inter) / max) * 255)) | 0;
      // sotto la soglia (di base il 15% della scala) trasparente, poi sale in un 20% della scala: il fondo non copre la TC
      d[j] = LUT_FUS[v * 3]; d[j + 1] = LUT_FUS[v * 3 + 1]; d[j + 2] = LUT_FUS[v * 3 + 2]; d[j + 3] = petLike ? (v <= t0 ? 0 : Math.min(255, (v - t0) * 255 / rampa)) : v;   // TC/RM sopra: trasparenza proporzionale al segnale
    }
    cx.putImageData(id, 0, 0); pet._max = max; pet._mappa = mappaFus; pet._soglia = A.FUS.soglia;
  }
  const q0 = A.daComune(img, A.aComune(pet, { x: -0.5, y: -0.5 })), q1 = A.daComune(img, A.aComune(pet, { x: pet.cols - 0.5, y: pet.rows - 0.5 }));
  const a0 = A.aSchermoPiano(g, q0), a1 = A.aSchermoPiano(g, q1);
  A.ctx.save(); A.ruotaCtx(g); A.ctx.globalAlpha = A.FUS.opacita; A.ctx.imageSmoothingEnabled = true;
  A.ctx.drawImage(c, Math.min(a0.x, a1.x) - g.sx / 2, Math.min(a0.y, a1.y) - g.sy / 2, Math.abs(a1.x - a0.x), Math.abs(a1.y - a0.y));
  A.ctx.restore();
}
// Fusione in MPR: la PET intera diventa un secondo volume nelle tre viste
async function fusioneMPR() {
  if (!A.MPR.attivo || !A.MPR.modulo?.fusione) return;
  const mio = A.MPR.token;
  try {
    if (!A.FUS.attiva) { await A.MPR.modulo.fusione({ fette: null }); return; }
    const s = A.V.serie[A.FUS.sIdx]; if (!s) return;
    const frames = s.files.map((f) => ({ url: `/casi/${A.V.caso.id}/${f}` }));
    let fatti = 0, i = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (i < frames.length) { const f = frames[i++]; await A.caricaRaw(f); if (++fatti % 20 === 0) A.statoMPR(`Scarico la PET: ${fatti} / ${frames.length}`); if (mio !== A.MPR.token) return; }
    }));
    if (mio !== A.MPR.token) return;
    const fette = frames.map((f) => A.suvizza(A.decodificaDicom(f.buf), s.suv)); frames.forEach((f) => { f.buf = null; });
    // studi diversi coregistrati: la serie sovrapposta va portata nelle coordinate della serie di base
    const base = A.P().img, f0 = fette[0];
    if (f0?.for && base?.for && f0.for !== base.for) {
      if (!A.allineate(f0, base)) { A.statoMPR(''); alert('Fusione: prima coregistra i due studi (pulsante «Coregistrazione automatica» in 2D).'); return; }
      for (const f of fette) if (f.ipp) f.ipp = A.inversa(A.offsetDi(base.for), A.applica(A.offsetDi(f.for), f.ipp));
      if (A.ruotato(f0) || A.ruotato(base)) console.warn('fusione MPR: rotazione della coregistrazione non applicata');
    }
    // scala: 99,5° percentile dei valori del volume (campione), come in 2D ma su tutta la PET
    const camp = [];
    for (const f of fette) for (let k = 0; k < f.pix.length; k += 37) camp.push(f.pix[k] * f.slope + f.inter);
    camp.sort((a, b) => a - b);
    A.FUS.maxVol = fette[0].suv ? 6 : Math.max(1e-6, camp[Math.floor(camp.length * 0.995)]);
    A.statoMPR('');
    await A.MPR.modulo.fusione({ fette, max: A.FUS.maxVol * (Number(A.$('#fusione-max').value) || 100) / 100, opacita: A.FUS.opacita, soglia: A.FUS.soglia, mappa: { nome: mappaFus, punti: MAPPE_PET[mappaFus].punti }, mip3d: !!fette[0].suv || /^(PT|NM)$/.test(fette[0].modalita || '') });
    testoScalaFusione(A.FUS.maxVol, fette[0].suv);
    A.T.fusione = true;
  } catch (e) { console.error(e); A.statoMPR(''); alert('Fusione in MPR non riuscita: ' + e.message); }
}
function testoScalaFusione(max, suv) {
  const v = max * (Number(A.$('#fusione-max').value) || 100) / 100;
  A.$('#fusione-scala').textContent = suv ? `0–${v.toFixed(1)} SUV · trasparente sotto ${(v * A.FUS.soglia).toFixed(1)}` : '';
  A.FUS._ultimaScala = [max, suv];
}
function aspettoFusioneMPR() {
  if (A.MPR.attivo && A.FUS.attiva && A.FUS.maxVol) A.MPR.modulo?.aspettoFusione?.({ max: A.FUS.maxVol * (Number(A.$('#fusione-max').value) || 100) / 100, opacita: A.FUS.opacita, soglia: A.FUS.soglia, mappa: { nome: mappaFus, punti: MAPPE_PET[mappaFus].punti } });
}
async function attivaFusione(on) {
  A.FUS.attiva = on; A.$('#btn-fusione').classList.toggle('on', on); A.$('#fusione-controlli').hidden = !on;
  { const sel = A.$('#fusione-serie'), o = [...sel.options];    // sopra e sotto devono essere serie diverse
    const tb = A.FUS.tipi?.[A.V.sIdx], tS = A.FUS.tipi?.[Number(sel.value)];
    if (on && !A.FUS.sceltaUtente && tb && !['PT', 'NM'].includes(tb.mod) && !['PT', 'NM'].includes(tS?.mod) && A.V.studi?.length > 1) {
      // senza PET: di base la serie corrispondente di un altro esame (prima il precedente), non un'altra serie della stessa seduta
      const st = A.studioDi(A.V.serie[A.V.sIdx]), altri = A.V.studi.filter((x) => x.id !== st.id).sort((x, y) => (x.n > st.n) - (y.n > st.n) || Math.abs(x.n - st.n) - Math.abs(y.n - st.n));
      for (const a of altri) {
        const cand = o.map((x) => Number(x.value)).filter((i) => A.studioDi(A.V.serie[i]).id === a.id && A.FUS.tipi[i]?.piano === tb.piano);
        if (!cand.length) continue;
        // la più simile per nome tra quelle nello stesso piano (o la più lunga)
        const i = cand.includes(A.serieCorrispondente(A.V.serie[A.V.sIdx], a.id)) ? A.serieCorrispondente(A.V.serie[A.V.sIdx], a.id) : cand.sort((x, y) => A.FUS.tipi[y].n - A.FUS.tipi[x].n)[0];
        sel.value = String(i); break; }
    }
    if (on && Number(sel.value) === A.V.sIdx && !['PT', 'NM'].includes(tb?.mod)) { const alt = o.find((x) => Number(x.value) !== A.V.sIdx); if (alt) sel.value = alt.value; } }
  A.FUS.sIdx = Number(A.$('#fusione-serie').value); A.FUS.max = null; A.FUS.cache?.clear?.(); mappaPerSovrapposta();
  if (A.MPR.attivo) { await fusioneMPR(); return; }
  if (on) {
    A.T.fusione = true;
    // il riquadro attivo deve mostrare la TC: se mostra la PET, passa alla TC più lunga
    const tipi = await tipiSerie();
    if (['PT', 'NM'].includes(tipi[A.V.sIdx]?.mod)) {
      const ct = tipi.map((t, i) => [t, i]).filter(([t]) => t.mod === 'CT').sort((x, y) => y[0].n - x[0].n)[0];
      if (ct) await A.selezionaSerie(ct[1]);
    } else if (A.V.sIdx === A.FUS.sIdx) {
      // il riquadro attivo mostra la serie da sovrapporre: passa alla serie più lunga dell'altro studio
      const f0 = tipi[A.FUS.sIdx]?.for, alt = tipi.map((t, i) => [t, i]).filter(([t]) => t.for && t.for !== f0 && ['CT', 'MR'].includes(t.mod)).sort((x, y) => y[0].n - x[0].n)[0];
      if (alt) await A.selezionaSerie(alt[1]);
    }
    // la sovrapposizione va solo sulla serie «sotto» (quella del riquadro attivo)
    A.FUS.base = A.V.sIdx;
    if (tipi[A.FUS.base]?.piano && tipi[A.FUS.sIdx]?.piano && tipi[A.FUS.base].piano !== tipi[A.FUS.sIdx].piano)
      alert(`La serie «sopra» è ${tipi[A.FUS.sIdx].piano}, quella «sotto» ${tipi[A.FUS.base].piano}: in 2D si sovrappongono solo serie nello stesso piano. Scegli una serie ${tipi[A.FUS.base].piano} in «Sopra», oppure usa MPR + 3D.`);
    // studi diversi non ancora coregistrati: si affiancano le due serie e si coregistrano, poi si sovrappone
    { const a = tipi[A.FUS.base], b = tipi[A.FUS.sIdx];
      if (a?.for && b?.for && a.for !== b.for && !(A.V.offset[a.for] && A.V.offset[b.for]) && !['PT', 'NM'].includes(b.mod)) {
        const base = A.FUS.base; await A.impostaRiquadri(2); await A.selezionaSerie(base, 0); await A.selezionaSerie(A.FUS.sIdx, 1); A.attiva(0);
        await A.autoAllinea(); A.FUS.base = base;
      } }
    for (const [, k] of A.visibili()) await aggiornaFusione(k);
    if ([...A.$('#fusione-base').options].some((o) => Number(o.value) === A.V.sIdx)) A.$('#fusione-base').value = String(A.V.sIdx);
  }
  A.disegna();
}
let VASI_CAC;   // valore in avvio()
const pesoAgatston = (hu) => (hu >= 400 ? 4 : hu >= 300 ? 3 : hu >= 200 ? 2 : hu >= 130 ? 1 : 0);
function categoriaCac(score) { return score <= 0 ? ['A0', 'calcio assente'] : score < 100 ? ['A1', 'lieve'] : score < 300 ? ['A2', 'moderato'] : ['A3', 'grave']; }
function categoriaVisiva(somma) { return somma <= 0 ? ['V0', 'calcio assente'] : somma <= 3 ? ['V1', 'lieve'] : somma <= 5 ? ['V2', 'moderato'] : ['V3', 'grave']; }
async function calcioDa(k, pt) {
  if (A.bloccoEsame()) return;
  const p = A.P(k), img0 = p.img; if (!img0) return;
  if (img0.modalita !== 'CT') throw new Error('Il calcio coronarico si misura sulle TC');
  const W = img0.cols, H = img0.rows, val = (im, i) => im.pix[i] * im.slope + im.inter, sp = Math.min(img0.spCol, img0.spRow);
  // punto sopra soglia più vicino al clic (entro 3 mm)
  const x0 = Math.round(pt.x), y0 = Math.round(pt.y), rc = Math.ceil(3 / sp); let seme = -1, dm = Infinity;
  for (let y = Math.max(0, y0 - rc); y <= Math.min(H - 1, y0 + rc); y++) for (let x = Math.max(0, x0 - rc); x <= Math.min(W - 1, x0 + rc); x++) {
    const i = y * W + x, d = (x - x0) ** 2 + (y - y0) ** 2; if (val(img0, i) >= 130 && d < dm) { dm = d; seme = i; } }
  if (seme < 0) throw new Error('Nessuna calcificazione (≥ 130 HU) vicino al punto: clicca sulla calcificazione');
  const sx = seme % W, sy = (seme / W) | 0, rMax = 12 / sp, n = A.normaleDi(img0.iop);
  const cresci = (im, semi) => { const m = new Uint8Array(W * H), coda = [], out = [];
    for (const i of semi) if (!m[i] && val(im, i) >= 130) { m[i] = 1; coda.push(i); }
    while (coda.length) { const i = coda.pop(); out.push(i); if (out.length > 20000) break; const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (m[j] || Math.hypot(xx - sx, yy - sy) > rMax) continue; if (val(im, j) >= 130) { m[j] = 1; coda.push(j); } } }
    return out; };
  const maschere = new Map(), base = cresci(img0, [seme]);
  if (base.length > Math.PI * rMax * rMax * 0.5) throw new Error('La regione è troppo grande: non sembra una calcificazione coronarica (osso o mezzo di contrasto?)');
  maschere.set(p.idx, base);
  for (const dir of [-1, 1]) { let prec = base;
    for (let j = p.idx + dir, giri = 0; j >= 0 && j < p.frames.length && giri < 12; j += dir, giri++) {
      const im = await A.immagineDi(p, j); if (!im || im.cols !== W || im.rows !== H) break;
      if (im.ipp && img0.ipp && Math.abs((im.ipp[0] - img0.ipp[0]) * n[0] + (im.ipp[1] - img0.ipp[1]) * n[1] + (im.ipp[2] - img0.ipp[2]) * n[2]) > 15) break;
      const r = cresci(im, prec); if (!r.length) break; maschere.set(j, r); prec = r; } }
  // passo tra le immagini e punteggio
  const idxs = [...maschere.keys()].sort((x, y) => x - y), pos = [];
  for (const j of idxs) { const im = await A.immagineDi(p, j); pos.push(im.ipp ? im.ipp[0] * n[0] + im.ipp[1] * n[1] + im.ipp[2] * n[2] : j * (img0.spessore || 3)); }
  let passo = idxs.length > 1 ? Math.abs(pos[pos.length - 1] - pos[0]) / (idxs.length - 1) : 0;
  if (!passo) { const im1 = await A.immagineDi(p, Math.min(p.frames.length - 1, p.idx + 1)); passo = im1?.ipp && img0.ipp ? Math.abs((im1.ipp[0] - img0.ipp[0]) * n[0] + (im1.ipp[1] - img0.ipp[1]) * n[1] + (im1.ipp[2] - img0.ipp[2]) * n[2]) : (img0.spessore || 3); }
  const pxmm2 = img0.spCol * img0.spRow; let grezzo = 0, vox = 0, picco = 0;
  for (const j of idxs) { const im = await A.immagineDi(p, j), l = maschere.get(j); let mx = 0; for (const i of l) { const v = val(im, i); if (v > mx) mx = v; } vox += l.length; picco = Math.max(picco, mx);
    const area = l.length * pxmm2; if (area >= 1) grezzo += area * pesoAgatston(mx); }
  const agatston = grezzo * (passo || 3) / 3, volume = vox * pxmm2 * (passo || 3);
  // la stessa calcificazione cliccata due volte non si conta due volte
  const giaPresa = A.CAC.lesioni.find((l) => l.sIdx === p.sIdx && l.maschere.get(p.idx)?.includes(seme));
  if (giaPresa) { giaPresa.vaso = A.CAC.vaso; A.avvisoBreve(`Calcificazione già misurata: assegnata a ${A.CAC.vaso}`); pannelloCalcio(); A.disegna(); return; }
  A.CAC.lesioni.push({ sIdx: p.sIdx, idx: p.idx, x: sx, y: sy, vaso: A.CAC.vaso, maschere, agatston, volume, picco, passo, _cv: new Map() });
  A.T.misure++; A.$('#calcio-pannello').hidden = false; pannelloCalcio(); A.disegna();
  A.avvisoBreve(`${A.CAC.vaso}: calcificazione di ${A.virgola(volume, 0)} mm³, picco ${Math.round(picco)} HU, Agatston ${A.virgola(agatston, 1)}`);
}
function disegnaCalcio(k, g) {
  const p = A.P(k); if (!A.CAC.lesioni.length) return;
  for (const l of A.CAC.lesioni) {
    if (l.sIdx !== p.sIdx || !l.maschere.has(p.idx)) continue;
    let cv = l._cv.get(`${p.idx}|${l.vaso}`);
    if (!cv) { cv = document.createElement('canvas'); cv.width = p.img.cols; cv.height = p.img.rows;
      const c = cv.getContext('2d'), id = c.createImageData(cv.width, cv.height), col = (VASI_CAC.find(([v]) => v === l.vaso) || VASI_CAC[1])[2];
      const rgb = [1, 3, 5].map((o) => parseInt(col.slice(o, o + 2), 16));
      for (const i of l.maschere.get(p.idx)) { id.data[i * 4] = rgb[0]; id.data[i * 4 + 1] = rgb[1]; id.data[i * 4 + 2] = rgb[2]; id.data[i * 4 + 3] = 190; }
      c.putImageData(id, 0, 0); l._cv.set(`${p.idx}|${l.vaso}`, cv); }
    A.ctx.save(); A.ruotaCtx(g); A.ctx.imageSmoothingEnabled = false; A.ctx.drawImage(cv, g.x, g.y, g.w, g.h); A.ctx.restore();
    if (p.idx === l.idx) { const q = A.aSchermo(g, { x: l.x, y: l.y }); A.testoContorno(`${l.vaso} ${A.virgola(l.agatston, 0)}`, q.x + 10, q.y - 8, (VASI_CAC.find(([v]) => v === l.vaso) || VASI_CAC[1])[2]); }
  }
}
function riassuntoCalcio() {
  const per = Object.fromEntries(VASI_CAC.map(([v]) => [v, { agatston: 0, volume: 0, n: 0 }]));
  for (const l of A.CAC.lesioni) { const x = per[l.vaso]; x.agatston += l.agatston; x.volume += l.volume; x.n++; }
  const totale = Object.values(per).reduce((t, x) => t + x.agatston, 0), vasi = Object.values(per).filter((x) => x.n).length;
  const somma = Object.values(A.CAC.visivo).reduce((t, x) => t + (+x || 0), 0);
  return { per, totale, vasi, cat: categoriaCac(totale), somma, vis: categoriaVisiva(somma), vasiVis: Object.values(A.CAC.visivo).filter((x) => +x > 0).length };
}
function testoCalcio() {
  const r = riassuntoCalcio(), passo = A.CAC.lesioni[0]?.passo;
  if (A.CAC.modo === 'visivo') return `Calcio coronarico, valutazione visiva (CAC-DRS): TCS ${A.CAC.visivo.TCS}, IVA ${A.CAC.visivo.IVA}, CX ${A.CAC.visivo.CX}, CD ${A.CAC.visivo.CD} (somma ${r.somma}/12): CAC-DRS ${r.vis[0]}${r.vasiVis ? '/N' + r.vasiVis : ''}, calcio ${r.vis[1]}.`;
  return `Calcio coronarico: punteggio di Agatston ${A.virgola(r.totale, 0)} (TCS ${A.virgola(r.per.TCS.agatston, 0)}, IVA ${A.virgola(r.per.IVA.agatston, 0)}, CX ${A.virgola(r.per.CX.agatston, 0)}, CD ${A.virgola(r.per.CD.agatston, 0)})`
    + `${passo && Math.abs(passo - 3) > 0.3 ? `, stimato da strati di ${A.virgola(passo, 1)} mm` : ''}: CAC-DRS ${r.cat[0]}${r.vasi ? '/N' + r.vasi : ''}, calcio ${r.cat[1]}.`;
}
function pannelloCalcio() {
  const box = A.$('#calcio-pannello'); if (!box || box.hidden) return;
  const r = riassuntoCalcio(), passo = A.CAC.lesioni[0]?.passo, img = A.P(A.V.attivo).img, gated = /cardi|coronar|calcium|score|gat/i.test(A.V.serie[A.P(A.V.attivo).sIdx]?.descrizione || '');
  box.innerHTML = `<div class="riga eco-testa" title="Trascina per spostare il pannello"><b>Calcio coronarico</b><span class="eco-breve small muted">${A.CAC.modo === 'visivo' ? `CAC-DRS ${r.vis[0]}` : `Agatston ${A.virgola(r.totale, 0)} · ${r.cat[0]}`}</span><span class="spacer"></span><button class="ghost piccolo" id="cac-chiudi" title="Chiudi">✕</button></div>
    <div class="cac-modi"><button type="button" class="${A.CAC.modo === 'agatston' ? 'on' : ''}" data-cac-modo="agatston">Agatston (clic)</button><button type="button" class="${A.CAC.modo === 'visivo' ? 'on' : ''}" data-cac-modo="visivo">Visiva (TC torace)</button></div>
    ${A.CAC.modo === 'agatston' ? `<p class="small muted">Scegli l'arteria, poi clicca su ogni calcificazione (sopra 130 HU): la piattaforma la segue nelle immagini vicine. ${img && !gated ? 'Su una TC del torace non sincronizzata con l\'ECG il punteggio è una stima: le linee guida suggeriscono di riportare anche la categoria visiva.' : ''}</p>
      <div class="cac-vasi">${VASI_CAC.map(([v, nome, col]) => `<button type="button" data-cac-vaso="${v}" class="${A.CAC.vaso === v ? 'on' : ''}" style="--c:${col}" title="${nome}">${v}</button>`).join('')}</div>
      <table class="tab eco-tab"><thead><tr><th>Arteria</th><th>Lesioni</th><th>Agatston</th><th>Volume</th></tr></thead><tbody>
      ${VASI_CAC.map(([v, nome, col]) => `<tr><td><span class="cac-pallino" style="background:${col}"></span>${v} <span class="muted small">${nome}</span></td><td class="num">${r.per[v].n}</td><td class="num">${A.virgola(r.per[v].agatston, 0)}</td><td class="num">${A.virgola(r.per[v].volume, 0)} mm³</td></tr>`).join('')}
      <tr class="cac-tot"><td><b>Totale</b></td><td class="num">${A.CAC.lesioni.length}</td><td class="num"><b>${A.virgola(r.totale, 0)}</b></td><td></td></tr></tbody></table>
      <p class="cac-esito cac-${r.cat[0]}"><b>CAC-DRS ${r.cat[0]}${r.vasi ? '/N' + r.vasi : ''}</b>: calcio ${r.cat[1]} <span class="muted small">(A0 = 0 · A1 1-99 · A2 100-299 · A3 ≥ 300; N = arterie coinvolte)</span></p>
      ${passo && Math.abs(passo - 3) > 0.3 ? `<p class="small muted">Strati di ${A.virgola(passo, 1)} mm: punteggio riportato a 3 mm (stima).</p>` : ''}
      <p><button type="button" class="ghost piccolo" id="cac-ultima" ${A.CAC.lesioni.length ? '' : 'disabled'}>↶ Togli l'ultima</button> <button type="button" class="ghost piccolo" id="cac-azzera" ${A.CAC.lesioni.length ? '' : 'disabled'}>Azzera</button></p>`
    : `<p class="small muted">Per ogni arteria: 0 assente, 1 lieve, 2 moderato, 3 grave (estensione delle calcificazioni lungo il vaso).</p>
      <table class="tab eco-tab"><tbody>${VASI_CAC.map(([v, nome, col]) => `<tr><td><span class="cac-pallino" style="background:${col}"></span>${v} <span class="muted small">${nome}</span></td><td>${[0, 1, 2, 3].map((x) => `<button type="button" class="cac-vis ${+A.CAC.visivo[v] === x ? 'on' : ''}" data-cac-vis="${v}:${x}">${x}</button>`).join('')}</td></tr>`).join('')}</tbody></table>
      <p class="cac-esito cac-${r.vis[0].replace('V', 'A')}"><b>CAC-DRS ${r.vis[0]}${r.vasiVis ? '/N' + r.vasiVis : ''}</b>: calcio ${r.vis[1]} <span class="muted small">(somma ${r.somma}/12: 0 → V0 · 1-3 → V1 · 4-5 → V2 · 6-12 → V3)</span></p>`}
    <p><button type="button" class="ghost piccolo" id="cac-referto">Copia nel referto</button></p>`;
  A.$('#cac-chiudi').onclick = () => { box.hidden = true; if (A.V.tool === 'calcio') A.scegliStrumento('scroll'); };
  box.querySelectorAll('[data-cac-modo]').forEach((b) => b.onclick = () => { A.CAC.modo = b.dataset.cacModo; pannelloCalcio(); });
  box.querySelectorAll('[data-cac-vaso]').forEach((b) => b.onclick = () => { A.CAC.vaso = b.dataset.cacVaso; pannelloCalcio(); });
  box.querySelectorAll('[data-cac-vis]').forEach((b) => b.onclick = () => { const [v, x] = b.dataset.cacVis.split(':'); A.CAC.visivo[v] = +x; pannelloCalcio(); });
  A.$('#cac-ultima')?.addEventListener('click', () => { A.CAC.lesioni.pop(); pannelloCalcio(); A.disegna(); });
  A.$('#cac-azzera')?.addEventListener('click', () => { A.CAC.lesioni = []; pannelloCalcio(); A.disegna(); });
  A.$('#cac-referto').onclick = () => { const t = A.$('#q-referto'); const frase = testoCalcio();
    if (t) { t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + frase; t.closest('details')?.setAttribute('open', ''); t.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (typeof A.inserisciNelReferto === 'function') A.inserisciNelReferto(frase);
    A.avvisoBreve('Calcio coronarico copiato nel referto'); };
}
async function caricaConfrontoIA() {
  A.CFIA.dati = null; A.CFIA.caso = A.V.caso?.id; A.CFIA.lesioni = []; A.CFIA.attesa = false; A.$('#btn-confronto-ia').hidden = true; A.$('#cfia-pannello').hidden = true;
  if (!A.V.caso?.id || A.V.studi.length < 2) return;
  // con almeno due esami il confronto assistito c'è sempre; nei casi della piattaforma con l'analisi IA preparata, quella
  A.$('#btn-confronto-ia').hidden = false;
  if (A.CLIENT) return;
  const id = A.V.caso.id;
  try { const r = await fetch(`/casi/${id}/ia/confronto.json`, { credentials: 'same-origin' }); if (!r.ok || A.CFIA.caso !== id) return; A.CFIA.dati = await r.json(); }
  catch { return; }
  A.$('#btn-confronto-ia').hidden = false;
}
const mmV = (x) => (x == null ? '—' : A.virgola(+x, 1) + ' mm');
const pct = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${x}%`);
function testoConfrontoIA(d) {
  const mesi = d.intervallo_giorni ? Math.round(d.intervallo_giorni / 30.44) : null, r = [];
  r.push(`Confronto con l'esame precedente${mesi ? ` (intervallo ${mesi} mesi)` : ''}, stime automatiche da verificare:`);
  for (const c of d.coppie) r.push(`- nodulo ${c.tipo?.[1] || ''} del lobo ${c.lobo || '—'}: ${mmV(c.diametro_mm[0])} → ${mmV(c.diametro_mm[1])} (volume ${pct(c.variazione_volume_pct)}${c.vdt_giorni ? `, tempo di raddoppio ${c.vdt_giorni} giorni` : ''}): ${c.andamento === 'crescita' ? `in crescita (Lung-RADS ${c.lung_rads_controllo})` : c.andamento === 'riduzione' ? 'ridotto' : 'stabile'}`);
  for (const n of d.nuovi) r.push(`- nodulo nuovo ${n.tipo || ''} del lobo ${n.lobo || '—'}: ${mmV(n.diametro_mm)} (Lung-RADS ${n.lung_rads_controllo})`);
  for (const n of d.scomparsi) r.push(`- non più visibile il nodulo del lobo ${n.lobo || '—'} di ${mmV(n.diametro_mm)}`);
  if (d.recist) r.push(`RECIST 1.1: somma dei diametri ${mmV(d.recist.somma_mm[0])} → ${mmV(d.recist.somma_mm[1])} (${pct(d.recist.variazione_pct)}): ${d.recist.risposta}.`);
  r.push(`Lung-RADS al controllo proposto: ${d.lung_rads_controllo}.`);
  return r.join('\n');
}
async function vaiNoduloIA(prima, dopo) {
  const d = A.CFIA.dati; if (!d) return;
  const iP = A.V.serie.findIndex((x) => x._i === d.precedente.indice), iA = A.V.serie.findIndex((x) => x._i === d.attuale.indice);
  if (iP < 0 || iA < 0) { A.avvisoBreve('Le serie del confronto non sono nel caso'); return; }
  const nP = prima != null ? (await geoNoduli(d.precedente.serie))?.[prima] : null, nA = dopo != null ? (await geoNoduli(d.attuale.serie))?.[dopo] : null;
  if (A.V.n < 2) await A.impostaRiquadri(2);
  const sincro = A.V.sincro; A.V.sincro = false;
  try {
    await A.selezionaSerie(iP, 0, { idx: Math.max(0, (nP?.immagine || 1) - 1) });
    await A.selezionaSerie(iA, 1, { idx: Math.max(0, (nA?.immagine || 1) - 1) });
  } finally { A.V.sincro = sincro; }
  A.attiva(1); A.evidenziaSerie(); A.disegna();
}
let GEO_NODULI;   // valore in avvio()
async function geoNoduli(cart) {
  const k = A.V.caso.id + '/' + cart;
  if (!GEO_NODULI.has(k)) GEO_NODULI.set(k, A.getJSON(`/casi/${A.V.caso.id}/ia/${cart}.json`).then((g) => g.analisi?.noduli || []).catch(() => []));
  return GEO_NODULI.get(k);
}
function pannelloConfrontoIA() {
  const box = A.$('#cfia-pannello'), d = A.CFIA.dati; if (!box || !d) return;
  box.hidden = false;
  const testa = `<div class="riga eco-testa" title="Trascina per spostare il pannello"><b>🤖 Confronto IA con il precedente</b><span class="spacer"></span><button type="button" class="ghost piccolo" id="cfia-chiudi" aria-label="Chiudi">✕</button></div>`;
  if (!A.repertiIAConsentiti()) { box.innerHTML = testa + '<p class="small muted">Il confronto automatico con il precedente si vede dopo la risposta: prima prova da solo a confrontare i due esami.</p>'; legaPannelloCfia(box); return; }
  const mesi = d.intervallo_giorni ? Math.round(d.intervallo_giorni / 30.44) : null, al = d.allineamento || {};
  const LR = (x) => (x ? `<span class="cfia-lr lr-${String(x).toLowerCase()}">${A.esc(x)}</span>` : '<span class="muted small">da valutare</span>');
  const and = { crescita: '<b class="cfia-su">▲ crescita</b>', riduzione: '▼ ridotto', stabile: '= stabile' };
  box.innerHTML = testa + `<p class="small muted">${d.precedente.data ? A.esc(dataLeggibileIso(d.precedente.data)) : 'precedente'} → ${d.attuale.data ? A.esc(dataLeggibileIso(d.attuale.data)) : 'attuale'}${mesi ? ` · intervallo ${mesi} mesi` : ''} · allineamento su ${al.punti}/${al.punti_totali} strutture, errore mediano ${A.virgola(al.errore_mediano_mm ?? 0, 1)} mm</p>
    <table class="tab eco-tab cfia-tab"><thead><tr><th>Lobo</th><th>Diametro</th><th>Volume</th><th>VDT</th><th>Andamento</th><th>Lung-RADS</th><th></th></tr></thead><tbody>
    ${d.coppie.map((c) => `<tr><td>${A.esc(c.lobo || '—')}<br><span class="muted small">${A.esc(c.tipo?.[1] || '')}</span></td><td>${mmV(c.diametro_mm[0])} → <b>${mmV(c.diametro_mm[1])}</b></td><td>${pct(c.variazione_volume_pct)}</td><td>${c.vdt_giorni ? `${c.vdt_giorni} gg${c.vdt_giorni < 400 ? ' <b title="Sotto 400 giorni: crescita sospetta">!</b>' : ''}` : '—'}</td><td>${and[c.andamento] || ''}</td><td>${LR(c.lung_rads_controllo)}</td><td><button type="button" class="ghost piccolo" data-cfia="${c.prima},${c.dopo}">vai</button></td></tr>`).join('')}
    ${d.nuovi.map((n) => `<tr class="cfia-nuovo"><td>${A.esc(n.lobo || '—')}<br><span class="muted small">${A.esc(n.tipo || '')}</span></td><td>nuovo · <b>${mmV(n.diametro_mm)}</b></td><td>—</td><td>—</td><td><b>● nuovo</b></td><td>${LR(n.lung_rads_controllo)}</td><td><button type="button" class="ghost piccolo" data-cfia=",${n.dopo}">vai</button></td></tr>`).join('')}
    ${d.scomparsi.map((n) => `<tr class="muted"><td>${A.esc(n.lobo || '—')}</td><td>${mmV(n.diametro_mm)} → —</td><td>—</td><td>—</td><td>○ non più visto</td><td></td><td><button type="button" class="ghost piccolo" data-cfia="${n.prima},">vai</button></td></tr>`).join('')}
    </tbody></table>
    ${d.recist ? `<p class="small"><b>RECIST 1.1</b>: somma dei diametri dei bersagli ${mmV(d.recist.somma_mm[0])} → ${mmV(d.recist.somma_mm[1])} (${pct(d.recist.variazione_pct)}) → <b>${A.esc(d.recist.risposta)}</b><br><span class="muted">${A.esc(d.recist.nota)}</span></p>` : ''}
    <p><b>Lung-RADS al controllo (proposta)</b>: ${LR(d.lung_rads_controllo)} <span class="muted small">— i noduli stabili o ridotti si declassano secondo la storia (es. 4A stabile → 3 → 2): la categoria la decide il radiologo.</span></p>
    <p class="small muted">${A.esc(d.nota)} VDT sotto 400 giorni: crescita sospetta per neoplasia; oltre 600 giorni: crescita lenta o assente.</p>
    <p><button type="button" class="ghost piccolo" id="cfia-referto">Copia nel referto</button></p>`;
  box.querySelectorAll('[data-cfia]').forEach((b) => b.onclick = () => { const [p, a] = b.dataset.cfia.split(','); vaiNoduloIA(p === '' ? null : +p, a === '' ? null : +a); });
  A.$('#cfia-referto').onclick = () => { const t = A.$('#q-referto'), frase = testoConfrontoIA(d);
    if (t) { t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + frase; t.closest('details')?.setAttribute('open', ''); t.dispatchEvent(new Event('input', { bubbles: true })); }
    else A.inserisciNelReferto(frase);
    A.avvisoBreve('Confronto copiato nel referto'); };
  legaPannelloCfia(box);
}
function legaPannelloCfia(box) {
  A.$('#cfia-chiudi').onclick = () => { box.hidden = true; };
  box.querySelector('.eco-testa').onpointerdown = (e) => {
    if (e.target.closest('button')) return;
    const r0 = box.getBoundingClientRect(), dx = e.clientX - r0.left, dy = e.clientY - r0.top;
    const muovi = (ev) => { Object.assign(box.style, { left: Math.max(0, Math.min(innerWidth - r0.width, ev.clientX - dx)) + 'px', top: Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px', bottom: 'auto' }); };
    const fine = () => { removeEventListener('pointermove', muovi); removeEventListener('pointerup', fine); };
    addEventListener('pointermove', muovi); addEventListener('pointerup', fine);
  };
}
const dataLeggibileIso = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'][+m[2] - 1]} ${m[1]}` : d; };
// ---- confronto assistito (visualizzatore scaricabile e casi senza analisi IA): si clicca ogni lesione nell'esame attuale;
// il volume si misura per crescita di regione, la lesione si ritrova negli altri esami con la coregistrazione e la ricerca
// del blocco di «Segui nel tempo», e si misura anche lì. Tutto nel browser, niente esce dal computer.
function torace() {
  const t = [A.V.caso?.distretto, A.V.caso?.titolo, ...A.V.serie.map((x) => `${x.regione || ''} ${x.descrizione || ''}`)].join(' ');
  return /torac|polmon|chest|lung|thorax|nodul/i.test(t) && !/\bPET\b|total body/i.test(t);
}
function datiLesione(l) {
  const ok = l.punti.filter((p) => p.vol != null && p.diam != null).sort((a, b) => a.n - b.n);
  const att = ok.find((p) => p.studio === l.studio) || ok[ok.length - 1];
  const prec = [...ok].reverse().find((p) => p.n < att?.n) || ok.find((p) => p !== att);
  if (!att || !prec) return { att, prec, ok };
  const tt = A.tempiTraccia([prec, att]), giorni = tt.noti ? (tt.t[1] - tt.t[0]) * tt.giorniPer : null;
  const [p, a] = att.n > prec.n ? [prec, att] : [att, prec];
  const dv = p.vol > 0 ? Math.round((a.vol / p.vol - 1) * 100) : null, dd = a.diam - p.diam;
  const vdt = giorni && a.vol > p.vol * 1.05 ? Math.round(A.vdtGiorni(p.vol, a.vol, Math.abs(giorni))) : null;
  return { att: a, prec: p, ok, giorni: giorni && Math.abs(giorni), dv, dd, vdt, crescita: dd > 1.5, riduzione: a.vol < p.vol * 0.75 };
}
function lungRadsCrescita(d) { return !d.crescita ? null : d.att.diam < 8 ? '4A' : '4B'; }
function sommaRecist(lista) {
  const ber = lista.filter((d) => d.prec && d.prec.diam >= 10).sort((x, y) => y.prec.diam - x.prec.diam).slice(0, 5);
  if (!ber.length) return null;
  const s0 = ber.reduce((a, d) => a + d.prec.diam, 0), s1 = ber.reduce((a, d) => a + d.att.diam, 0), v = (s1 - s0) / s0 * 100;
  return { n: ber.length, s0, s1, v: Math.round(v), r: (v >= 20 && s1 - s0 >= 5) ? 'PD' : s1 < 1 ? 'CR' : v <= -30 ? 'PR' : 'SD' };
}
async function aggiungiLesioneAssistita(v) {
  A.CFIA.attesa = false;
  await A.seguiNelTempo(v);
  const tr = A.V.traccia; if (!tr) return;
  A.CFIA.lesioni.push({ studio: v.studio, punti: tr.punti.map(({ v: _v, ...x }) => ({ ...x })), sIdx: v.sIdx, idx: v.idx });
  A.scegliStrumento('scroll'); pannelloAssistito();
}
function testoAssistito() {
  const L = A.CFIA.lesioni.map(datiLesione).filter((d) => d.att && d.prec), r = [], tor = torace();
  if (!L.length) return '';
  const mesi = L[0].giorni ? Math.round(L[0].giorni / 30.44) : null;
  r.push(`Confronto con l'esame precedente${mesi ? ` (intervallo ${mesi} mesi)` : ''}, misure volumetriche semiautomatiche:`);
  L.forEach((d, i) => r.push(`- lesione ${i + 1}: ${mmV(d.prec.diam)} → ${mmV(d.att.diam)} (volume ${pct(d.dv)}${d.vdt ? `, tempo di raddoppio ${d.vdt} giorni` : ''}): ${d.crescita ? `in crescita${tor ? ` (Lung-RADS ${lungRadsCrescita(d)})` : ''}` : d.riduzione ? 'ridotta' : 'stabile'}`));
  const rc = sommaRecist(L); if (rc) r.push(`RECIST 1.1: somma dei diametri ${mmV(rc.s0)} → ${mmV(rc.s1)} (${pct(rc.v)}): ${rc.r}.`);
  return r.join('\n');
}
function pannelloAssistito() {
  const box = A.$('#cfia-pannello'); if (!box) return;
  box.hidden = false;
  const tor = torace(), L = A.CFIA.lesioni.map((l) => ({ l, d: datiLesione(l) }));
  const and = (d) => (d.crescita ? '<b class="cfia-su">▲ crescita</b>' : d.riduzione ? '▼ ridotta' : '= stabile');
  const righe = L.map(({ d }, i) => !d.att || !d.prec
    ? `<tr class="muted"><td>${i + 1}</td><td colspan="${tor ? 5 : 4}">non ritrovata nell'altro esame: apri «Segui nel tempo» dalla lista dei volumi e misurala a mano</td><td><button type="button" class="ghost piccolo" data-cfia-via="${i}">✕</button></td></tr>`
    : `<tr><td>${i + 1}</td><td>${mmV(d.prec.diam)} → <b>${mmV(d.att.diam)}</b>${d.ok.some((p) => p.stato === 'da verificare') ? ' <span class="muted small" title="ritrovata con poca sicurezza: controlla">(da verificare)</span>' : ''}</td><td>${pct(d.dv)}</td><td>${d.vdt ? `${d.vdt} gg${d.vdt < 400 ? ' <b title="Sotto 400 giorni: crescita sospetta">!</b>' : ''}` : '—'}</td><td>${and(d)}</td>${tor ? `<td>${lungRadsCrescita(d) ? `<span class="cfia-lr lr-${lungRadsCrescita(d).toLowerCase()}">${lungRadsCrescita(d)}</span>` : '<span class="muted small">da valutare</span>'}</td>` : ''}<td><button type="button" class="ghost piccolo" data-cfia-vai="${i}">vai</button> <button type="button" class="ghost piccolo" data-cfia-via="${i}" title="Togli dal confronto">✕</button></td></tr>`).join('');
  const rc = sommaRecist(L.map(({ d }) => d).filter((d) => d.att && d.prec));
  box.innerHTML = `<div class="riga eco-testa" title="Trascina per spostare il pannello"><b>🤖 Confronto con l'esame precedente</b><span class="spacer"></span><button type="button" class="ghost piccolo" id="cfia-chiudi" aria-label="Chiudi">✕</button></div>
    <p class="small">Clicca <b>＋ Aggiungi lesione</b>, poi clicca la lesione (nodulo, massa, linfonodo) nell'<b>esame attuale</b>: il programma ne misura il volume, la ritrova negli altri esami (allineamento automatico) e la misura anche lì. Ripeti per ogni lesione.</p>
    <p><button type="button" class="primary piccolo" id="cfia-aggiungi"${A.CFIA.attesa ? ' disabled' : ''}>${A.CFIA.attesa ? 'Clicca la lesione nell\'immagine…' : '＋ Aggiungi lesione'}</button></p>
    ${L.length ? `<table class="tab eco-tab cfia-tab"><thead><tr><th>#</th><th>Diametro</th><th>Volume</th><th>VDT</th><th>Andamento</th>${tor ? '<th>Lung-RADS</th>' : ''}<th></th></tr></thead><tbody>${righe}</tbody></table>` : ''}
    ${rc ? `<p class="small"><b>RECIST 1.1</b> (${rc.n} ${rc.n === 1 ? 'bersaglio' : 'bersagli'} ≥ 10 mm al precedente, al massimo 5): somma ${mmV(rc.s0)} → ${mmV(rc.s1)} (${pct(rc.v)}) → <b>${rc.r}</b> <span class="muted">— al massimo 2 bersagli per organo: scegli tu quali; una lesione nuova fa PD.</span></p>` : ''}
    <p class="small muted">Diametro = massimo della lesione segmentata; crescita Lung-RADS v2022: aumento di più di 1,5 mm${tor ? '' : ' (Lung-RADS solo nelle TC del torace)'}; VDT = intervallo × ln2 / ln(V2/V1), sotto 400 giorni crescita sospetta. Stime da verificare sulle immagini.</p>
    ${L.length ? '<p><button type="button" class="ghost piccolo" id="cfia-referto">Copia nel referto</button></p>' : ''}`;
  A.$('#cfia-aggiungi').onclick = () => { A.CFIA.attesa = true; A.scegliStrumento('volume'); A.avvisoBreve('Clicca la lesione nell\'esame attuale'); pannelloAssistito(); };
  box.querySelectorAll('[data-cfia-via]').forEach((b) => b.onclick = () => { A.CFIA.lesioni.splice(+b.dataset.cfiaVia, 1); pannelloAssistito(); });
  box.querySelectorAll('[data-cfia-vai]').forEach((b) => b.onclick = async () => {
    const d = L[+b.dataset.cfiaVai].d; if (!d.att || !d.prec) return;
    if (A.V.n < 2) await A.impostaRiquadri(2);
    const sincro = A.V.sincro; A.V.sincro = false;
    try { await A.selezionaSerie(d.prec.sIdx, 0, { idx: d.prec.idx }); await A.selezionaSerie(d.att.sIdx, 1, { idx: d.att.idx }); } finally { A.V.sincro = sincro; }
    A.attiva(1); A.evidenziaSerie(); A.disegna();
  });
  A.$('#cfia-referto')?.addEventListener('click', () => { const t = A.$('#q-referto'), frase = testoAssistito(); if (!frase) return;
    if (t) { t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + frase; t.closest('details')?.setAttribute('open', ''); t.dispatchEvent(new Event('input', { bubbles: true })); }
    else A.inserisciNelReferto(frase);
    A.avvisoBreve('Confronto copiato nel referto'); });
  legaPannelloCfia(box);
}
let VISTE_ECO;   // valore in avvio()
function puntoEco(k, pt, g) {
  if (A.ECO.semi && A.ECO.vista.startsWith('vs')) { puntoSemi(k, pt); return; }
  const p = A.P(k);
  if (A.ECO.punti.length && (A.ECO.k !== k || A.ECO.sIdx !== p.sIdx || A.ECO.idx !== p.idx)) A.ECO.punti = [];   // nuovo fotogramma: si ricomincia
  if (A.ECO.punti.length >= 3) {
    const a = A.aSchermo(g, A.ECO.punti[0]), b = A.aSchermo(g, pt);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 10) { chiudiEco(); return; }
  }
  A.ECO.k = k; A.ECO.sIdx = p.sIdx; A.ECO.idx = p.idx; A.ECO.punti.push(pt); if (A.ECO.punti.length === 1 && innerWidth <= 700) A.ECO.ridotto = true; A.disegna(); pannelloEco();
}
function misuraContorno(punti, img) {
  const q = punti.map((t) => ({ x: t.x * img.spCol, y: t.y * img.spRow }));   // in mm
  let area = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; area += a.x * b.y - b.x * a.y; }
  area = Math.abs(area) / 2;
  const M = { x: (q[0].x + q[q.length - 1].x) / 2, y: (q[0].y + q[q.length - 1].y) / 2 };
  let A = q[0], L = 0; for (const t of q) { const d = Math.hypot(t.x - M.x, t.y - M.y); if (d > L) { L = d; A = t; } }
  const u = { x: (A.x - M.x) / L, y: (A.y - M.y) / L }, v = { x: -u.y, y: u.x };
  const larghezze = [];
  for (let i = 0; i < 20; i++) {
    const t = (i + 0.5) / 20 * L, c = { x: M.x + u.x * t, y: M.y + u.y * t }, s = [];
    for (let j = 0; j < q.length; j++) {          // intersezione della retta c + v·s con ogni lato del contorno chiuso
      const a = q[j], b = q[(j + 1) % q.length], ex = b.x - a.x, ey = b.y - a.y, den = v.x * ey - v.y * ex;
      if (Math.abs(den) < 1e-9) continue;
      const wx = a.x - c.x, wy = a.y - c.y, ss = (wx * ey - wy * ex) / den, tt = (wx * v.y - wy * v.x) / den;
      if (tt >= 0 && tt <= 1) s.push(ss);
    }
    larghezze.push(s.length >= 2 ? Math.max(...s) - Math.min(...s) : 0);
  }
  const vol = larghezze.reduce((t, w) => t + Math.PI * (w / 2) ** 2, 0) * L / 20 / 1000;   // mm³ → mL
  return { area: area / 100, L, larghezze, vol, asse: [M, A] };
}
function chiudiEco() {
  if (A.ECO.punti.length < 6) { A.avvisoBreve('Servono almeno 6 punti lungo l\'endocardio, da un lato dell\'anulus all\'altro passando per l\'apice.'); return; }
  const p = A.P(A.ECO.k), img = p.img; if (!img) return;
  A.ECO.tracce[`${A.ECO.vista}|${A.ECO.fase}`] = { punti: A.ECO.punti.slice(), sIdx: A.ECO.sIdx, idx: A.ECO.idx, ...misuraContorno(A.ECO.punti, img), calibrata: !(img.spCol === 1 && img.spRow === 1) };
  A.ECO.punti = []; A.ECO.ridotto = false; A.T.misure++;
  // passo successivo suggerito: dopo la diastole, la sistole della stessa vista
  if (A.ECO.fase === 'd' && !A.ECO.tracce[`${A.ECO.vista}|s`]) A.ECO.fase = 's';
  A.disegna(); pannelloEco();
}
function risultatiEco() {
  const t = A.ECO.tracce, r = {}, fmt = (x, n = 0) => A.virgola(x, n);
  const vol = (f) => {
    const a = t[`vs4|${f}`], b = t[`vs2|${f}`];
    if (a && b) { const L = Math.max(a.L, b.L); return { v: a.larghezze.reduce((s, w, i) => s + Math.PI / 4 * w * b.larghezze[i], 0) * L / 20 / 1000, metodo: 'biplano' }; }
    if (a) return { v: a.vol, metodo: 'monoplano 4 camere' }; if (b) return { v: b.vol, metodo: 'monoplano 2 camere' }; return null;
  };
  const d = vol('d'), s = vol('s'), righe = [];
  if (d) righe.push(`Volume telediastolico del VS ${fmt(d.v)} mL (${d.metodo}; normale M 62-150, F 46-106 mL)`);
  if (s) righe.push(`Volume telesistolico del VS ${fmt(s.v)} mL (${s.metodo}; normale M 21-61, F 14-42 mL)`);
  if (d && s && d.v > 0) { const fe = (d.v - s.v) / d.v * 100; r.fe = fe;
    righe.push(`Frazione di eiezione del VS ${fmt(fe)}% (${d.metodo === s.metodo ? d.metodo : 'metodi diversi'}): ${fe < 30 ? 'gravemente ridotta' : fe <= 40 ? 'ridotta (≤ 40%)' : fe < 50 ? 'lievemente ridotta (41-49%)' : fe <= 74 ? 'conservata (normale M 52-72%, F 54-74%)' : 'aumentata (> 74%)'}`); }
  const ad = t['vd4|d'], as = t['vd4|s'];
  if (ad) righe.push(`Area telediastolica del VD ${fmt(ad.area, 1)} cm² (normale M 10-24, F 8-20 cm²)`);
  if (as) righe.push(`Area telesistolica del VD ${fmt(as.area, 1)} cm² (normale M 3-15, F 3-11 cm²)`);
  if (ad && as && ad.area > 0) { const fac = (ad.area - as.area) / ad.area * 100; righe.push(`Variazione frazionale d'area del VD (FAC) ${fmt(fac)}% (${fac >= 35 ? 'normale, ≥ 35%' : 'ridotta, < 35%'})`); }
  return { righe, ...r };
}
// contorno semiautomatico (ecosemi.js, codice nostro senza modelli addestrati): 3 clic, poi bordo e filmato
let SEMI_AIUTO;   // valore in avvio()
function puntoSemi(k, pt) {
  if (!A.modEco.m) { A.modEco().then(() => puntoSemi(k, pt)).catch((e) => A.avvisoBreve('Modulo non scaricato: ' + e.message)); return; }
  const { contornoVS } = A.modEco.m;
  const p = A.P(k);
  if (A.ECO.semiPunti.length && (A.ECO.k !== k || A.ECO.sIdx !== p.sIdx || A.ECO.idx !== p.idx)) A.ECO.semiPunti = [];
  A.ECO.k = k; A.ECO.sIdx = p.sIdx; A.ECO.idx = p.idx; A.ECO.semiPunti.push(pt);
  if (A.ECO.semiPunti.length < 3) { A.disegna(); pannelloEco(); return; }
  const img = p.img; if (!img) return;
  const [A1, Ap, A2] = A.ECO.semiPunti, r = contornoVS(img, A1, Ap, A2);
  A.ECO.tracce[`${A.ECO.vista}|${A.ECO.fase}`] = { punti: r.punti, sIdx: p.sIdx, idx: p.idx, ...misuraContorno(r.punti, img), calibrata: !(img.spCol === 1 && img.spRow === 1), semi: true };
  A.ECO.semiRif = { k, sIdx: p.sIdx, idx: p.idx, A1, Ap, A2, off: r.off, vista: A.ECO.vista };
  A.ECO.semiPunti = []; A.ECO.semi = false; A.ECO.curva = null; A.ECO.ridotto = false; A.T.misure++;
  if (A.ECO.fase === 'd' && !A.ECO.tracce[`${A.ECO.vista}|s`]) A.ECO.fase = 's';
  A.disegna(); pannelloEco();
}
// dal fotogramma di partenza il bordo si segue in avanti e indietro in tutto il filmato
async function seguiFilmato() {
  const { contornoVS, segui, areaPoligono, battiti } = await A.modEco();
  const R = A.ECO.semiRif; if (!R) return;
  const p = A.P(R.k); if (p.sIdx !== R.sIdx) return;
  const n = p.frames.length, ris = new Array(n), stato = A.$('#eco-semi-stato');
  const img0 = await A.immagineDi(p, R.idx);
  ris[R.idx] = { punti: contornoVS(img0, R.A1, R.Ap, R.A2).punti };
  let fatti = 1;
  for (const dir of [1, -1]) {
    let a1 = R.A1, a2 = R.A2, off = R.off;
    for (let i = R.idx + dir; i >= 0 && i < n; i += dir) {
      const im = await A.immagineDi(p, i);
      a1 = segui(img0, im, R.A1, { da: a1 }); a2 = segui(img0, im, R.A2, { da: a2 });
      const r = contornoVS(im, a1, R.Ap, a2, { prima: off }); off = r.off; ris[i] = { punti: r.punti };
      if (++fatti % 6 === 0) { if (stato) stato.textContent = `Seguo il bordo: ${fatti}/${n} fotogrammi…`; await new Promise((ok) => setTimeout(ok, 0)); }
    }
  }
  const aree = ris.map((x) => areaPoligono(x.punti) * img0.spCol * img0.spRow / 100);
  const bt = battiti(aree).map((b) => { const d = misuraContorno(ris[b.ed].punti, img0), s = misuraContorno(ris[b.es].punti, img0);
    return { ...b, edv: d.vol, esv: s.vol, fe: d.vol > 0 ? (d.vol - s.vol) / d.vol * 100 : null }; });
  const val = bt.filter((b) => b.fe != null).sort((a, b) => a.fe - b.fe), b = val[val.length >> 1] || bt[0];
  const cal = !(img0.spCol === 1 && img0.spRow === 1);
  for (const [f, i] of [['d', b.ed], ['s', b.es]])
    A.ECO.tracce[`${R.vista}|${f}`] = { punti: ris[i].punti, sIdx: p.sIdx, idx: i, ...misuraContorno(ris[i].punti, img0), calibrata: cal, semi: true };
  A.ECO.curva = { aree, battiti: bt, scelto: b };
  await A.mostraDi(R.k, b.ed); A.disegna(); pannelloEco();
}
function htmlSemi() {
  if (!A.ECO.vista.startsWith('vs')) return '';
  const R = A.ECO.semiRif, p = A.P(A.V.attivo), filmato = p?.frames?.length >= 8;
  let h = `<div class="eco-semi small"><button class="ghost piccolo${A.ECO.semi ? ' on' : ''}" id="eco-semi">${A.ECO.semi ? '✕ Annulla i 3 clic' : '✳ Contorno semiautomatico'}</button>`;
  if (A.ECO.semi) h += ` <span>Clic ${A.ECO.semiPunti.length + 1} di 3: <b>${SEMI_AIUTO[A.ECO.semiPunti.length]}</b>.</span>`;
  else if (R && filmato && p.sIdx === R.sIdx) h += ` <button class="ghost piccolo" id="eco-segui" title="Segue il bordo in tutti i fotogrammi e trova fine diastole e fine sistole dall'area">▶ Segui nel filmato</button> <span id="eco-semi-stato" class="muted"></span>`;
  const c = A.ECO.curva;
  if (c) {
    const W = 300, H = 44, mx = Math.max(...c.aree), mn = Math.min(...c.aree), y = (a) => H - 4 - (a - mn) / (mx - mn || 1) * (H - 8), x = (i) => 2 + i / (c.aree.length - 1 || 1) * (W - 4);
    h += `<svg class="eco-curva" viewBox="0 0 ${W} ${H}" role="img" aria-label="Area del ventricolo sinistro nei fotogrammi"><polyline fill="none" stroke="currentColor" stroke-width="1.5" points="${c.aree.map((a, i) => `${x(i).toFixed(1)},${y(a).toFixed(1)}`).join(' ')}"/>
      <circle cx="${x(c.scelto.ed)}" cy="${y(c.aree[c.scelto.ed])}" r="3.5" fill="#41d1ff"/><circle cx="${x(c.scelto.es)}" cy="${y(c.aree[c.scelto.es])}" r="3.5" fill="#ff9f43"/></svg>
      <span class="muted">Area del VS nei fotogrammi: ● fine diastole fot. ${c.scelto.ed + 1}, ● fine sistole fot. ${c.scelto.es + 1}${c.battiti.length > 1 ? ` · FE nei ${c.battiti.length} battiti: ${c.battiti.map((b) => A.virgola(b.fe, 0)).join(', ')}%` : ''}.</span>`;
  }
  return h + '<br><span class="muted">Il programma cerca il passaggio cavità scura → parete chiara: controlla il contorno e, se sbaglia, ritraccialo a mano.</span></div>';
}
function pannelloEco() {
  const box = A.$('#eco-pannello'); if (box.hidden) return;
  const t = A.ECO.tracce, img = A.P(A.V.attivo)?.img, cal = img && !(img.spCol === 1 && img.spRow === 1);
  const stato = (vista, f) => { const x = t[`${vista}|${f}`]; return x ? `✓${x.semi ? ' semi' : ''} fot. ${x.idx + 1}${vista === 'vd4' ? ` · ${A.virgola(x.area, 1)} cm²` : ` · ${A.virgola(x.vol, 0)} mL`}` : '—'; };
  const ris = risultatiEco();
  const breve = A.ECO.semi ? `clic ${A.ECO.semiPunti.length + 1}/3: ${SEMI_AIUTO[A.ECO.semiPunti.length]}` : A.ECO.punti.length ? `${A.ECO.punti.length} punti` : ris.fe != null ? `FE ${A.virgola(ris.fe, 0)}%` : '';
  box.classList.toggle('ridotto', !!A.ECO.ridotto);
  box.innerHTML = `<div class="riga eco-testa" title="Trascina per spostare il pannello"><b>❤ Misure cardiache</b><span class="eco-breve small muted">${A.esc(breve)}</span><span class="spacer"></span><button class="ghost piccolo" id="eco-riduci" title="${A.ECO.ridotto ? 'Mostra il pannello' : 'Riduci il pannello (lascia vedere l\'immagine)'}">${A.ECO.ridotto ? '▴' : '▾'}</button><button class="ghost piccolo" id="eco-chiudi" title="Chiudi">✕</button></div>
    ${cal ? '' : '<p class="avviso small">Questa immagine non ha la calibrazione dell\'ecografo: aree e volumi non sono in millimetri.</p>'}
    <div class="eco-scelte"><select id="eco-vista">${Object.entries(VISTE_ECO).map(([k, n]) => `<option value="${k}"${k === A.ECO.vista ? ' selected' : ''}>${n}</option>`).join('')}</select>
      <span class="eco-fase"><button class="${A.ECO.fase === 'd' ? 'on' : ''}" data-fase="d">Fine diastole</button><button class="${A.ECO.fase === 's' ? 'on' : ''}" data-fase="s">Fine sistole</button></span></div>
    <p class="small muted">${A.ECO.punti.length ? `Contorno in corso: ${A.ECO.punti.length} punti. <b>Invio</b> o clic sul primo punto per chiudere, ⌫ toglie l'ultimo, Esc ricomincia.`
      : `Scorri fino al fotogramma di ${A.ECO.fase === 'd' ? 'fine diastole (cavità più grande, valvola mitrale appena chiusa)' : 'fine sistole (cavità più piccola)'}, poi clicca l'endocardio da un lato dell'anulus all'altro passando per l'apice (trabecole e muscoli papillari dentro la cavità).`}</p>
    <table class="tab eco-tab"><thead><tr><th></th><th>Diastole</th><th>Sistole</th></tr></thead><tbody>${Object.entries(VISTE_ECO).map(([k, n]) => `<tr><td>${A.esc(n.split(' · ')[0] + ' ' + (k === 'vs2' ? '2C' : '4C'))}</td><td>${stato(k, 'd')}</td><td>${stato(k, 's')}</td></tr>`).join('')}</tbody></table>
    ${ris.righe.length ? `<ul class="small eco-ris">${ris.righe.map((x) => `<li>${A.esc(x)}</li>`).join('')}</ul>` : ''}
    ${htmlSemi()}
    <div class="riga">${ris.righe.length ? '<button class="ghost piccolo" id="eco-copia">Copia nel referto</button>' : ''}${Object.keys(t).length ? ' <button class="ghost piccolo" id="eco-azzera">Cancella le misure</button>' : ''}</div>
    <p class="muted small">Metodo dei dischi (Simpson); con 4 e 2 camere della stessa fase il volume è biplano. Il volume del ventricolo destro non si stima in 2D: si usano aree e FAC (e il TAPSE in M-mode).</p>`;
  A.$('#eco-riduci').onclick = () => { A.ECO.ridotto = !A.ECO.ridotto; pannelloEco(); };
  A.$('#eco-chiudi').onclick = () => { box.hidden = true; A.scegliStrumento('wl'); };
  // il pannello si sposta trascinando l'intestazione (resta dove lo si lascia)
  box.querySelector('.eco-testa').onpointerdown = (e) => {
    if (e.target.closest('button')) return;
    const r0 = box.getBoundingClientRect(), dx = e.clientX - r0.left, dy = e.clientY - r0.top;
    const muovi = (ev) => { const x = Math.max(0, Math.min(innerWidth - r0.width, ev.clientX - dx)), y = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy));
      Object.assign(box.style, { left: x + 'px', top: y + 'px', bottom: 'auto' }); };
    const fine = () => { removeEventListener('pointermove', muovi); removeEventListener('pointerup', fine); };
    addEventListener('pointermove', muovi); addEventListener('pointerup', fine);
  };
  A.$('#eco-vista').onchange = (e) => { A.ECO.vista = e.target.value; A.ECO.punti = []; A.ECO.semiPunti = []; A.disegna(); pannelloEco(); };
  box.querySelectorAll('[data-fase]').forEach((b) => b.onclick = () => { A.ECO.fase = b.dataset.fase; A.ECO.punti = []; A.disegna(); pannelloEco(); });
  A.$('#eco-copia')?.addEventListener('click', () => { const q = A.$('#q-referto'); if (!q) return; q.value = (q.value.trim() ? q.value.trim() + '\n' : '') + ris.righe.join('. ') + '.'; q.closest('details')?.setAttribute('open', ''); });
  A.$('#eco-azzera')?.addEventListener('click', () => { A.ECO.tracce = {}; A.ECO.punti = []; A.ECO.semiPunti = []; A.ECO.semiRif = null; A.ECO.curva = null; A.disegna(); pannelloEco(); });
  A.$('#eco-semi')?.addEventListener('click', () => { A.ECO.semi = !A.ECO.semi; A.ECO.semiPunti = []; A.ECO.punti = []; if (innerWidth <= 700) A.ECO.ridotto = A.ECO.semi; A.disegna(); pannelloEco(); });
  A.$('#eco-segui')?.addEventListener('click', (e) => { e.target.disabled = true; seguiFilmato().catch((err) => A.avvisoBreve('Non riesco a seguire il filmato: ' + err.message)); });
}
function disegnaEco(k, g) {
  const p = A.P(k); if (!p?.img) return;
  const linea = (punti, chiuso, col, tratt = []) => { if (!punti.length) return; A.ctx.save(); A.ctx.strokeStyle = col; A.ctx.lineWidth = 2; A.ctx.setLineDash(tratt); A.ctx.beginPath();
    punti.forEach((t, i) => { const q = A.aSchermo(g, t); i ? A.ctx.lineTo(q.x, q.y) : A.ctx.moveTo(q.x, q.y); }); if (chiuso) A.ctx.closePath(); A.ctx.stroke(); A.ctx.restore(); };
  for (const [chiave, x] of Object.entries(A.ECO.tracce)) {
    if (x.sIdx !== p.sIdx || x.idx !== p.idx) continue;
    const col = chiave.endsWith('|d') ? '#41d1ff' : '#ff9f43';
    linea(x.punti, true, col);
    if (!chiave.startsWith('vd')) { const [M, A] = x.asse.map((t) => ({ x: t.x / p.img.spCol, y: t.y / p.img.spRow })); linea([M, A], false, col, [6, 4]); }
    const q = A.aSchermo(g, x.punti[0]); A.ctx.font = '12px system-ui, sans-serif';
    A.testoContorno(`${chiave.startsWith('vd') ? 'VD' : 'VS'} ${chiave.endsWith('|d') ? 'diastole' : 'sistole'}${chiave.startsWith('vd') ? ` ${A.virgola(x.area, 1)} cm²` : ` ${A.virgola(x.vol, 0)} mL`}`, q.x + 6, q.y - 6, col);
  }
  if (A.ECO.semiPunti.length && A.ECO.k === k && A.ECO.sIdx === p.sIdx && A.ECO.idx === p.idx)
    A.ECO.semiPunti.forEach((t, i) => { const q = A.aSchermo(g, t); A.ctx.save(); A.ctx.strokeStyle = '#ffd34d'; A.ctx.lineWidth = 2; A.ctx.beginPath(); A.ctx.arc(q.x, q.y, 6, 0, 2 * Math.PI); A.ctx.stroke();
      A.ctx.font = 'bold 12px system-ui, sans-serif'; A.ctx.fillStyle = '#ffd34d'; A.ctx.fillText(String(i + 1), q.x + 8, q.y - 8); A.ctx.restore(); });
  if (A.ECO.punti.length && A.ECO.k === k && A.ECO.sIdx === p.sIdx && A.ECO.idx === p.idx) {
    linea(A.ECO.punti, false, '#fff', [4, 3]);
    for (const t of A.ECO.punti) { const q = A.aSchermo(g, t); A.ctx.fillStyle = '#fff'; A.ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
  }
}
// istruzioni che app.js eseguiva al caricamento (pulsanti e moduli di queste pagine): ora una volta, al primo uso
export function avvio() {
  MAPPE_PET = {
    verde: { gruppo: 'Sovrapposizione TC / RM', nome: 'Verde', punti: [0, 0, 0, 0, 1, 0.2, 1, 0.3] },
    magenta: { gruppo: 'Sovrapposizione TC / RM', nome: 'Magenta', punti: [0, 0, 0, 0, 1, 1, 0.2, 1] },
    caldo: { gruppo: 'Medicina nucleare', nome: 'Caldo (hot iron)', punti: [0, 0, 0, 0, 1 / 3, 1, 0, 0, 2 / 3, 1, 1, 0, 1, 1, 1, 1] },
    'hot-blu': { gruppo: 'Medicina nucleare', nome: 'Hot metal blu', punti: [0, 0, 0, 0, 0.2, 0, 0, 0.6, 0.45, 0.6, 0, 0.35, 0.65, 1, 0.35, 0, 0.85, 1, 0.85, 0.3, 1, 1, 1, 1] },
    pet: { gruppo: 'Medicina nucleare', nome: 'PET (blu-rosso-giallo)', punti: [0, 0, 0, 0, 0.25, 0, 0, 0.7, 0.45, 0.6, 0, 0.7, 0.65, 1, 0, 0, 0.85, 1, 0.8, 0, 1, 1, 1, 1] },
    spettro: { gruppo: 'Medicina nucleare', nome: 'Spettro (NIH)', punti: [0, 0, 0, 0, 0.15, 0.5, 0, 1, 0.3, 0, 0, 1, 0.45, 0, 1, 1, 0.6, 0, 1, 0, 0.75, 1, 1, 0, 0.9, 1, 0, 0, 1, 1, 1, 1] },
    termico: { gruppo: 'Medicina nucleare', nome: 'Termico', punti: [0, 0, 0, 0, 0.3, 0.5, 0, 0.5, 0.5, 1, 0, 0, 0.75, 1, 0.6, 0, 1, 1, 1, 1] },
    viridis: { gruppo: 'Percettive', nome: 'Viridis', punti: [0, 0.267, 0.005, 0.329, 0.25, 0.229, 0.322, 0.546, 0.5, 0.128, 0.567, 0.551, 0.75, 0.369, 0.789, 0.383, 1, 0.993, 0.906, 0.144] },
    magma: { gruppo: 'Percettive', nome: 'Magma', punti: [0, 0.001, 0, 0.014, 0.25, 0.317, 0.071, 0.485, 0.5, 0.716, 0.215, 0.475, 0.75, 0.987, 0.536, 0.383, 1, 0.987, 0.991, 0.75] },
    inferno: { gruppo: 'Percettive', nome: 'Inferno', punti: [0, 0.001, 0, 0.014, 0.25, 0.341, 0.062, 0.429, 0.5, 0.735, 0.216, 0.33, 0.75, 0.978, 0.557, 0.035, 1, 0.988, 1, 0.645] },
    plasma: { gruppo: 'Percettive', nome: 'Plasma', punti: [0, 0.05, 0.03, 0.528, 0.25, 0.494, 0.012, 0.658, 0.5, 0.798, 0.28, 0.47, 0.75, 0.973, 0.585, 0.252, 1, 0.94, 0.975, 0.131] },
    jet: { gruppo: 'Arcobaleno', nome: 'Jet', punti: [0, 0, 0, 0.5, 0.11, 0, 0, 1, 0.36, 0, 1, 1, 0.62, 1, 1, 0, 0.87, 1, 0, 0, 1, 0.5, 0, 0] },
    arcobaleno: { gruppo: 'Arcobaleno', nome: 'Arcobaleno', punti: [0, 0, 0, 0.5, 0.2, 0, 0, 1, 0.4, 0, 1, 1, 0.6, 0, 1, 0, 0.8, 1, 1, 0, 1, 1, 0, 0] },
    grigio: { gruppo: 'Un colore', nome: 'Grigio', punti: [0, 0, 0, 0, 1, 1, 1, 1] },
    'grigio-inv': { gruppo: 'Un colore', nome: 'Grigio inverso', punti: [0, 1, 1, 1, 1, 0, 0, 0] },
    rosso: { gruppo: 'Un colore', nome: 'Rosso', punti: [0, 0, 0, 0, 0.6, 1, 0, 0, 1, 1, 0.7, 0.7] },
    'verde-scala': { gruppo: 'Un colore', nome: 'Verde', punti: [0, 0, 0, 0, 0.5, 0, 0.7, 0.2, 1, 0.7, 1, 0.6] },
    blu: { gruppo: 'Un colore', nome: 'Blu ghiaccio', punti: [0, 0, 0, 0, 0.5, 0, 0.4, 1, 1, 0.8, 1, 1] },
  };
  mappaFus = 'caldo';
  try { const m = localStorage.getItem('quiz-mappa-pet'); if (MAPPE_PET[m]) mappaFus = m; } catch {}
  LUT_FUS = lutDa(MAPPE_PET[mappaFus].punti);
  A.$('#fusione-base').addEventListener('change', async (e) => { await A.selezionaSerie(Number(e.target.value)); if (A.FUS.attiva) attivaFusione(true); });
  A.$('#btn-fusione').addEventListener('click', () => attivaFusione(!A.FUS.attiva));
  A.$('#fusione-serie').addEventListener('change', () => { A.FUS.sceltaUtente = true; if (A.FUS.attiva) attivaFusione(true); });
  A.$('#fusione-mappa').innerHTML = [...new Set(Object.values(MAPPE_PET).map((m) => m.gruppo))].map((g) => `<optgroup label="${A.esc(g)}">${Object.entries(MAPPE_PET).filter(([, m]) => m.gruppo === g).map(([k, m]) => `<option value="${k}">${A.esc(m.nome)}</option>`).join('')}</optgroup>`).join('');
  A.$('#fusione-mappa').value = mappaFus;
  A.$('#fusione-mappa').addEventListener('change', (e) => {
    mappaFus = MAPPE_PET[e.target.value] ? e.target.value : 'caldo'; LUT_FUS = lutDa(MAPPE_PET[mappaFus].punti);
    const t = A.FUS.tipi?.[Number(A.$('#fusione-serie').value)];
    if (['PT', 'NM'].includes(t?.mod)) { try { localStorage.setItem('quiz-mappa-pet', mappaFus); } catch {} } else A.FUS.mappaAltro = mappaFus;
    if (A.MPR.attivo) aspettoFusioneMPR(); else A.disegna();
  });
  A.$('#fusione-soglia').addEventListener('input', (e) => {
    A.FUS.soglia = Number(e.target.value) / 100; if (A.FUS._ultimaScala) testoScalaFusione(...A.FUS._ultimaScala);
    if (A.MPR.attivo) aspettoFusioneMPR(); else A.disegna();
  });
  A.$('#fusione-opacita').addEventListener('input', (e) => { A.FUS.opacita = Number(e.target.value) / 100; if (A.MPR.attivo) aspettoFusioneMPR(); else A.disegna(); });
  A.$('#fusione-max').addEventListener('input', () => { if (A.MPR.attivo) aspettoFusioneMPR(); else A.disegna(); testoScalaFusione(A.MPR.attivo ? A.FUS.maxVol : A.FUS.max, !!A.V.serie[A.FUS.sIdx]?.suv); });
  VASI_CAC = [['TCS', 'tronco comune', '#ff6b5b'], ['IVA', 'interventricolare anteriore', '#ffd23c'], ['CX', 'circonflessa', '#7ee787'], ['CD', 'coronaria destra', '#78b4ff']];
  GEO_NODULI = new Map();
  A.$('#btn-confronto-ia').addEventListener('click', () => { const b = A.$('#cfia-pannello'); if (!b.hidden) { b.hidden = true; return; } if (A.CFIA.dati) pannelloConfrontoIA(); else pannelloAssistito(); });
  VISTE_ECO = { vs4: 'VS · apicale 4 camere', vs2: 'VS · apicale 2 camere', vd4: 'VD · apicale 4 camere (focalizzata sul VD)' };
  SEMI_AIUTO = ['anulus dal lato del setto', "l'apice (endocardio)", "anulus dal lato della parete laterale (o anteriore in 2 camere)"];
}
export { tipiSerie, aggiornaFusioneUI, aggiornaFusione, disegnaFusione, fusioneMPR, calcioDa, disegnaCalcio, pannelloCalcio, caricaConfrontoIA, vaiNoduloIA, aggiungiLesioneAssistita, pannelloAssistito, puntoEco, chiudiEco, risultatiEco, pannelloEco, disegnaEco };
