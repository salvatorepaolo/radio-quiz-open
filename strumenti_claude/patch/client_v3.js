
// ---- archivi .zip aperti direttamente (senza decomprimere sul disco): ogni file dell'archivio diventa un «file» che si
// decomprime quando serve (DecompressionStream del browser). Supporta zip «store» e «deflate», anche ZIP64.
async function voceZip(zip, nome, metodo, offLocale, compr, dim) {
  const t = new DataView(await zip.slice(offLocale, offLocale + 30).arrayBuffer());
  if (t.getUint32(0, true) !== 0x04034b50) throw new Error('zip danneggiato');
  const ini = offLocale + 30 + t.getUint16(26, true) + t.getUint16(28, true), dati = zip.slice(ini, ini + compr);
  if (metodo === 0) return dati.arrayBuffer();
  if (metodo !== 8) throw new Error('compressione zip non supportata (' + metodo + ')');
  return new Response(dati.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
}
function fileDaZip(zip, base, e) {
  // niente copia in memoria: si decomprime a ogni lettura (gli esami nello zip possono essere grandi)
  const leggi = () => voceZip(zip, e.nome, e.metodo, e.off, e.compr, e.dim);
  const f = {
    name: e.nome.split('/').pop(), size: e.dim, _percorso: base + e.nome, type: '',
    arrayBuffer: () => leggi(),
    slice: (a = 0, b = e.dim) => ({ size: Math.max(0, Math.min(b, e.dim) - a), arrayBuffer: async () => (await leggi()).slice(a, b), slice() { throw new Error('slice annidato'); } }),
  };
  return f;
}
async function apriZip(zip) {
  const n = zip.size, coda = await zip.slice(Math.max(0, n - 66000), n).arrayBuffer(), dv = new DataView(coda);
  let p = -1; for (let i = coda.byteLength - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { p = i; break; }
  if (p < 0) throw new Error('non è un archivio zip');
  let num = dv.getUint16(p + 10, true), dimCD = dv.getUint32(p + 12, true), offCD = dv.getUint32(p + 16, true);
  if (offCD === 0xffffffff || num === 0xffff) {                     // ZIP64
    const l = p - 20; if (l >= 0 && dv.getUint32(l, true) === 0x07064b50) {
      const off64 = Number(dv.getBigUint64(l + 8, true)), r = new DataView(await zip.slice(off64, off64 + 56).arrayBuffer());
      num = Number(r.getBigUint64(32, true)); dimCD = Number(r.getBigUint64(40, true)); offCD = Number(r.getBigUint64(48, true));
    }
  }
  const cd = new DataView(await zip.slice(offCD, offCD + dimCD).arrayBuffer()), dec = new TextDecoder(), voci = [];
  for (let i = 0, q = 0; i < num && q + 46 <= cd.byteLength; i++) {
    if (cd.getUint32(q, true) !== 0x02014b50) break;
    const metodo = cd.getUint16(q + 10, true); let compr = cd.getUint32(q + 20, true), dim = cd.getUint32(q + 24, true);
    const ln = cd.getUint16(q + 28, true), le = cd.getUint16(q + 30, true), lc = cd.getUint16(q + 32, true); let off = cd.getUint32(q + 42, true);
    const nome = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + q + 46, ln));
    if (compr === 0xffffffff || dim === 0xffffffff || off === 0xffffffff) {      // campi ZIP64 nell'«extra»
      let x = q + 46 + ln; const fine = x + le;
      while (x + 4 <= fine) { const id = cd.getUint16(x, true), sz = cd.getUint16(x + 2, true);
        if (id === 1) { let y = x + 4; if (dim === 0xffffffff) { dim = Number(cd.getBigUint64(y, true)); y += 8; } if (compr === 0xffffffff) { compr = Number(cd.getBigUint64(y, true)); y += 8; } if (off === 0xffffffff) off = Number(cd.getBigUint64(y, true)); }
        x += 4 + sz; }
    }
    if (!nome.endsWith('/') && !/(^|\/)(__MACOSX|\.)/.test(nome)) voci.push({ nome, metodo, compr, dim, off });
    q += 46 + ln + le + lc;
  }
  const base = (zip._percorso || zip.name || 'archivio.zip').replace(/\.zip$/i, '') + '/';
  return voci.map((e) => fileDaZip(zip, base, e));
}
async function espandiZip(files, st) {
  const out = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name || '')) {
      st?.(`Apro l'archivio ${esc(f.name)}…`);
      if (!('DecompressionStream' in window)) throw new Error('questo browser non apre gli zip: decomprimili prima, oppure usa Chrome, Edge, Firefox o Safari aggiornati');
      out.push(...await apriZip(f));
    } else out.push(f);
  }
  return out;
}
// ---- sessione in un file: misure, disposizione dei riquadri, serie, immagini, finestre e zoom (si riapre sullo stesso esame,
// anche anonimizzato: le serie si riconoscono dall'ordine e dal numero di immagini)
function datiSessione() {
  return {
    tipo: 'radio-quiz-sessione', versione: 1, creata: new Date().toISOString(), titolo: CL.studio?.caso.titolo || '',
    serie: V.serie.map((s) => [s.descrizione, s.files.length]), misure: V.misure, n: V.n, attivo: V.attivo, sincro: V.sincro,
    pannelli: V.pannelli.slice(0, V.n).map((q) => ({ s: q.sIdx, idx: q.idx, piano: q.piano || null, wc: q.wc, ww: q.ww, zoom: q.zoom, panX: q.panX, panY: q.panY, rot: q.rot || 0, fl: !!q.fl })),
  };
}
async function applicaSessione(d) {
  if (d?.tipo !== 'radio-quiz-sessione') throw new Error('non è un file di sessione di radio-quiz');
  if (!V.caso) throw new Error('apri prima l\'esame a cui si riferisce la sessione');
  const ok = d.serie.length === V.serie.length && d.serie.every(([, n], i) => V.serie[i].files.length === n);
  if (!ok) throw new Error('la sessione è di un altro esame (serie diverse)');
  memoriaMisure();
  V.misure = d.misure || {};
  if (d.n !== V.n) await impostaRiquadri(d.n);
  for (const [k, q] of (d.pannelli || []).entries()) {
    if (!V.serie[q.s]) continue;
    if (P(k).sIdx !== q.s || P(k).piano) await selezionaSerie(q.s, k, { idx: q.idx });
    if (q.piano) { attiva(k); await pianoRiquadro(q.piano, k); }
    await mostraDi(k, q.idx, { sincro: false });
    Object.assign(P(k), { wc: q.wc, ww: q.ww, zoom: q.zoom, panX: q.panX, panY: q.panY, rot: q.rot, fl: q.fl, wl0: true });
  }
  attiva(Math.min(d.attivo || 0, V.n - 1)); V.sincro = d.sincro !== false; if ($('#sincro')) $('#sincro').checked = V.sincro;
  disegna(); aggiornaTabellaMisure();
  avvisoBreve('Sessione riaperta: misure, riquadri e finestre come erano.');
}
async function apriSessioneFile(f) {
  try { await applicaSessione(JSON.parse(new TextDecoder().decode(await f.arrayBuffer()))); } catch (e) { avvisoBreve('Sessione non aperta: ' + e.message); }
}
// ---- annotazioni in DICOM (presentation state, GSPS): frecce, misure e ROI riaperte da un PACS sulle immagini originali
function graficiMisura(m, img, idx, si) {
  const P1 = (t) => [t.x + 0.5, t.y + 0.5], g = [], testi = [], mm = (a, b) => Math.hypot((b.x - a.x) * img.spCol, (b.y - a.y) * img.spRow);
  const linea = (...t) => g.push({ tipo: 'POLYLINE', punti: t.flatMap(P1) });
  const testo = (s, t) => s && testi.push({ testo: s, x: t.x + 0.5 + 4, y: t.y + 0.5 - 4 });
  if (m.tipo === 'linea' || m.tipo === 'profilo') { linea(m.a, m.b); testo(`${mm(m.a, m.b).toFixed(1)} mm`, m.b); }
  else if (m.tipo === 'nota') {
    linea(m.a, m.b);
    const ang = Math.atan2(m.b.y - m.a.y, m.b.x - m.a.x), l = Math.max(4, Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) * 0.12);
    for (const s of [-0.45, 0.45]) linea(m.b, { x: m.b.x - l * Math.cos(ang + s), y: m.b.y - l * Math.sin(ang + s) });
    if (m.testo) testi.push({ testo: m.testo.replace(/^✎\s*/, ''), x: m.a.x + 0.5, y: m.a.y + 0.5 });
  } else if (m.tipo === 'angolo' && m.c) { linea(m.a, m.b, m.c); testo(`${angoloDi(img, m).toFixed(1)}°`, m.b); }
  else if ((m.tipo === 'recist' || m.tipo === 'cobb' || m.tipo === 'ict') && m.c && m.d) {
    linea(m.a, m.b); linea(m.c, m.d);
    testo(m.tipo === 'recist' ? `${mm(m.a, m.b).toFixed(1)} × ${mm(m.c, m.d).toFixed(1)} mm` : (fraseMisura(m, img, idx, si) || '').slice(0, 64), m.b);
  } else if (m.tipo === 'roi') {
    if (m.pts) linea(...m.pts, m.pts[0]);
    else {
      const cx = (m.a.x + m.b.x) / 2 + 0.5, cy = (m.a.y + m.b.y) / 2 + 0.5, rx = Math.abs(m.b.x - m.a.x) / 2, ry = Math.abs(m.b.y - m.a.y) / 2;
      g.push({ tipo: 'ELLIPSE', punti: rx >= ry ? [cx - rx, cy, cx + rx, cy, cx, cy - ry, cx, cy + ry] : [cx, cy - ry, cx, cy + ry, cx - rx, cy, cx + rx, cy] });
    }
    const st = statisticheROI(img, m);
    if (st) testo(`${m.etichetta ? m.etichetta + ' ' : ''}${valore(img, st.media)} ± ${valore(img, st.ds)}${unita(img)} · ${st.area.toFixed(2)} cm²`, { x: Math.max(m.a.x, m.b.x), y: Math.min(m.a.y, m.b.y) });
  }
  return { g, testi };
}
async function esportaGSPS() {
  const chiavi = Object.keys(V.misure || {}).filter((k) => k.split(':').length === 2 && (V.misure[k] || []).some((m) => !m.copia));
  if (!chiavi.length) throw new Error('nessuna misura o annotazione sulle immagini originali (quelle sui piani ricostruiti non si possono riferire)');
  const { creaGSPS } = await import('./gsps.js');
  const perStudio = new Map();
  for (const key of chiavi) {
    const [si, idx] = key.split(':').map(Number), s = V.serie[si]; if (!s) continue;
    const f = { url: `/casi/${V.caso.id}/${s.files[idx]}` }, raw = await caricaRaw(f), ab = bufDi(raw), frame = raw?.frame;
    const ds = dicomParser.parseDicom(new Uint8Array(ab), { untilTag: 'x7fe00010' }), t = (x) => (ds.string(x) || '').trim();
    const img = await immagineDi(await pannelloDi(si), idx);
    const pan = visibili().find(([q]) => q.sIdx === si && q.idx === idx && !q.piano)?.[0];
    const graf = { g: [], testi: [] };
    for (const m of V.misure[key].filter((x) => !x.copia)) { const r = graficiMisura(m, img, idx, si); graf.g.push(...r.g); graf.testi.push(...r.testi); }
    const su = t('x0020000d') || 'senza-studio';
    if (!perStudio.has(su)) perStudio.set(su, { studio: { uid: su, data: t('x00080020'), ora: t('x00080030'), id: t('x00200010'), accesso: t('x00080050'), paziente: { nome: t('x00100010'), id: t('x00100020'), nascita: t('x00100030'), sesso: t('x00100040') } }, immagini: [] });
    perStudio.get(su).immagini.push({ classe: t('x00080016'), uid: t('x00080018'), serie: t('x0020000e'), frame: frame != null && (parseInt(t('x00280008')) || 1) > 1 ? frame + 1 : null,
      cols: img.cols, rows: img.rows, mono1: !!img.mono1, wc: pan?.wc, ww: pan?.ww, grafici: graf.g, testi: graf.testi });
  }
  const file = [...perStudio.values()].map((x, i) => ({ nome: `annotazioni_${i + 1}.dcm`, dati: creaGSPS(x.studio, x.immagini, { autore: UTENTE?.nome || '' }) }));
  return file;
}
