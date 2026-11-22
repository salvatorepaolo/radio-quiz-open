// vetrini.js — vetrini digitali DICOM (anatomia patologica, «VL Whole Slide Microscopy Image», 1.2.840.10008.5.1.4.1.1.77.1.6)
// nel visualizzatore client e nei casi del sito. Un vetrino è un'immagine enorme (anche 200.000 × 100.000 pixel) divisa in
// tessere, con più livelli di ingrandimento, ognuno in uno o più file DICOM. Si legge solo l'intestazione e, mentre si
// naviga, solo le tessere visibili al livello giusto (OpenSeadragon, BSD-3, disegna e gestisce zoom e spostamento).
// Tutto il vetrino è leggibile:
// - tutti i livelli (VOLUME e THUMBNAIL), anche divisi in più file;
// - tutti i piani focali (Z-stack): si sceglie il piano con il cursore;
// - tutti i cammini ottici: campo chiaro a colori (RGB/YBR) e fluorescenza a più canali (monocromatici, 8 o 16 bit),
//   mostrati sovrapposti in falsi colori, con canali accendibili e luminosità di ciascuno;
// - etichetta (LABEL) e panoramica (OVERVIEW) del vetrino, nel visualizzatore client (l'etichetta può contenere i dati del
//   paziente: si mostra dopo una conferma se «dati paziente» è spento);
// - organizzazione TILED_FULL (ordine fisso) e TILED_SPARSE (posizione di ogni tessera nell'intestazione);
// - tessere JPEG (8 e 12 bit), JPEG Lossless, JPEG 2000 e HTJ2K, JPEG-LS, JPEG XL (dove il browser lo legge), RLE e non
//   compresse (8/16 bit, piani separati, YBR → RGB).
// Niente rete nel client: i file restano nel computer. Sul sito i file si leggono a pezzi (richieste parziali).

export const SOP_VETRINO = '1.2.840.10008.5.1.4.1.1.77.1.6';
const ITEM = 0xe000fffe, FINE_SEQ = 0xe0ddfffe;

// ---------------------------------------------------------------- lettura delle intestazioni
async function leggiTesta(f) {
  // l'intestazione può essere lunga (TILED_SPARSE: posizione di ogni tessera): si legge un pezzo sempre più grande
  for (const n of [1 << 18, 1 << 22, 1 << 25, 1 << 27]) {
    const u8 = new Uint8Array(await f.slice(0, Math.min(n, f.size)).arrayBuffer());
    try {
      const ds = dicomParser.parseDicom(u8, { untilTag: 'x7fe00010' });
      if (ds.elements.x7fe00010 || n >= f.size) return { ds, u8 };
    } catch (e) { if (n >= f.size) throw e; }
  }
  throw new Error('intestazione del vetrino troppo lunga');
}
const testo = (ds, t) => (ds?.string(t) || '').replace(/\0/g, '').trim();
const primo = (ds, sq) => ds?.elements[sq]?.items?.[0]?.dataSet || null;
// numero intero di un elemento UL (o, in file non conformi, scritto come testo)
const intero = (ds, t) => { const e = ds?.elements[t]; if (!e) return 0; if (e.vr === 'UL' || (!e.vr && e.length === 4)) return ds.uint32(t) || 0; return parseInt(testo(ds, t)) || ds.uint32(t) || 0; };
const numero = (ds, t) => { const v = ds?.floatString(t); return Number.isFinite(v) ? v : null; };

// colore di un canale di fluorescenza dalla lunghezza d'onda (nm) o dal nome del colorante
const COLORI = [[0, 120, 255], [0, 255, 0], [255, 40, 40], [255, 0, 255], [0, 255, 255], [255, 255, 0], [255, 140, 0], [255, 255, 255]];
function coloreCanale(nome, onda, k) {
  const n = String(nome || '').toLowerCase();
  if (/dapi|hoechst|blue|blu/.test(n)) return [40, 110, 255];
  if (/fitc|gfp|alexa ?488|green|verde/.test(n)) return [0, 255, 0];
  if (/cy3|tritc|alexa ?5[45]\d|orange/.test(n)) return [255, 160, 0];
  if (/cy5|alexa ?6[0-9]\d|red|rosso/.test(n)) return [255, 30, 30];
  if (onda > 0) { if (onda < 470) return [40, 110, 255]; if (onda < 550) return [0, 255, 0]; if (onda < 590) return [255, 220, 0]; if (onda < 650) return [255, 120, 0]; return [255, 30, 30]; }
  return COLORI[k % COLORI.length];
}

export async function analizzaVetrino(f) {
  const { ds } = await leggiTesta(f);
  const tipo = (testo(ds, 'x00080008').split('\\')[2] || '').toUpperCase();   // VOLUME, LABEL, OVERVIEW, THUMBNAIL
  const W = ds.uint32('x00480006') || ds.uint16('x00280011'), H = ds.uint32('x00480007') || ds.uint16('x00280010');
  const tw = ds.uint16('x00280011'), th = ds.uint16('x00280010'), n = parseInt(testo(ds, 'x00280008')) || 1;
  const condivisi = primo(ds, 'x52009229'), misure = primo(condivisi, 'x00289110');
  let sp = misure ? [numero(misure, 'x00280030') ?? 0, misure.floatString('x00280030', 1) || 0] : null;   // mm: righe, colonne
  if (!(sp?.[0] > 0)) { const larg = numero(ds, 'x00480001'); sp = larg > 0 ? [larg / W, larg / W] : null; }
  const org = testo(ds, 'x00209311') || 'TILED_FULL';
  // cammini ottici (colori della fluorescenza o campo chiaro)
  const cammini = (ds.elements.x00480105?.items || []).map((it, k) => { const d = it.dataSet; return { id: testo(d, 'x00480106') || String(k + 1), nome: testo(d, 'x00480107') || testo(primo(d, 'x00220016'), 'x00080104') || '', onda: numero(d, 'x00220055') || 0 }; });
  const camminoCondiviso = testo(primo(condivisi, 'x00480207'), 'x00480106');
  // posizioni delle tessere (TILED_SPARSE): Plane Position (Slide) di ogni fotogramma, coordinate a partire da 1, e piano
  // focale (Z Offset in µm) e cammino ottico di ciascun fotogramma
  let pos = null;
  if (org === 'TILED_SPARSE' || ds.elements.x52009230) {
    const pf = ds.elements.x52009230?.items || [];
    pos = pf.map((it) => { const pp = primo(it.dataSet, 'x0048021a'); if (!pp) return null;
      return [pp.int32('x0048021e') - 1, pp.int32('x0048021f') - 1, numero(pp, 'x0040074a') ?? 0, testo(primo(it.dataSet, 'x00480207'), 'x00480106') || camminoCondiviso || cammini[0]?.id || '1']; });
    if (!pos.some(Boolean)) pos = null;
  }
  const pix = ds.elements.x7fe00010;
  return {
    f, tipo, W, H, tw, th, n, sp, org: pos ? 'TILED_SPARSE' : org, pos,
    nz: intero(ds, 'x00480303') || 1, nc: intero(ds, 'x00480302') || Math.max(1, cammini.length),
    cammini, camminoCondiviso, passoZ: numero(misure, 'x00180088'),
    ts: testo(ds, 'x00020010'), foto: testo(ds, 'x00280004'), spp: ds.uint16('x00280002') || 1, bits: ds.uint16('x00280100') || 8,
    bitsSt: ds.uint16('x00280101') || ds.uint16('x00280100') || 8, conSegno: ds.uint16('x00280103') === 1, piani: ds.uint16('x00280006') || 0,
    serie: testo(ds, 'x0020000e'), studio: testo(ds, 'x0020000d'), descrizione: testo(ds, 'x0008103e') || testo(ds, 'x00081030'),
    eot: ds.elements.x7fe00001, eotLun: ds.elements.x7fe00002, testaDs: ds,
    pixOffset: pix?.dataOffset, incapsulato: !!(pix?.hadUndefinedLength || pix?.encapsulatedPixelData),
  };
}

// posizione nel file di ogni fotogramma: tabella estesa (7FE0,0001), tabella di base (primo elemento), oppure scorrendo i
// frammenti a blocchi da 8 MB (solo se le tabelle mancano). Per ogni fotogramma: [inizio, fine) dei suoi byte.
function indiceFotogrammi(L) {
  // una sola costruzione anche con molte tessere richieste insieme
  if (!L._indice) L._indice = costruisciIndice(L).catch((e) => { L._indice = null; throw e; });
  return L._indice;
}
async function costruisciIndice(L) {
  if (L.indice) return L.indice;
  const f = L.f;
  if (!L.incapsulato) {   // non compresso: fotogrammi uno dopo l'altro
    const lato = L.tw * L.th * L.spp * (L.bits / 8);
    L.indice = Array.from({ length: L.n }, (_, k) => [L.pixOffset + k * lato, L.pixOffset + (k + 1) * lato]);
    return L.indice;
  }
  const dv = async (a, n) => new DataView(await f.slice(a, a + n).arrayBuffer());
  const t0 = await dv(L.pixOffset, 8), lunBot = t0.getUint32(4, true);
  if (t0.getUint32(0, true) !== ITEM) throw new Error('dati dei pixel del vetrino non leggibili');
  const base = L.pixOffset + 8 + lunBot;     // inizio del primo frammento
  let inizi = null;
  if (L.eot && L.eotLun) {
    const u = L.testaDs.byteArray, a = new DataView(u.buffer, u.byteOffset + L.eot.dataOffset, L.eot.length), b = new DataView(u.buffer, u.byteOffset + L.eotLun.dataOffset, L.eotLun.length);
    inizi = []; for (let k = 0; k < L.eot.length / 8; k++) { const o = Number(a.getBigUint64(k * 8, true)), l = Number(b.getBigUint64(k * 8, true)); inizi.push([base + o, base + o + 8 + l]); }
  } else if (lunBot >= 4 * L.n) {
    const t = await dv(L.pixOffset + 8, lunBot), s = [];
    for (let k = 0; k < L.n; k++) s.push(base + t.getUint32(k * 4, true));
    inizi = s.map((x, k) => [x, k + 1 < L.n ? s[k + 1] : null]);
    // fine dell'ultimo fotogramma: dall'intestazione del suo elemento (8 byte), senza scorrere il file
    const u = inizi.at(-1), tl = await dv(u[0], 8); u[1] = u[0] + 8 + tl.getUint32(4, true);
  } else {
    // senza tabella: un frammento per fotogramma (il caso normale nei vetrini)
    const fr = []; let q = base, buf = null, b0 = 0;
    const leggi = async (x) => { if (!buf || x + 8 > b0 + buf.byteLength) { b0 = x; buf = await dv(x, Math.min(1 << 23, f.size - x)); } return [buf.getUint32(x - b0, true), buf.getUint32(x - b0 + 4, true)]; };
    while (q + 8 <= f.size && fr.length < L.n) { const [tag, lun] = await leggi(q); if (tag === FINE_SEQ || tag !== ITEM) break; fr.push([q, q + 8 + lun]); q += 8 + lun; }
    if (fr.length < L.n) throw new Error('fotogrammi del vetrino non trovati');
    inizi = fr;
  }
  L.indice = inizi;
  return L.indice;
}
async function byteFotogramma(L, k) {
  if (L.byteTessera) return L.byteTessera(k);   // altri formati (vetrini-formati.js): byte già pronti per il decodificatore
  const [a, b] = (await indiceFotogrammi(L))[k];
  const u = new Uint8Array(await L.f.slice(a, b).arrayBuffer());
  if (!L.incapsulato) return u;
  // uno o più elementi «item»: si tolgono le intestazioni di 8 byte e si uniscono i dati
  const parti = []; let i = 0;
  while (i + 8 <= u.length) { const dvw = new DataView(u.buffer, u.byteOffset + i, 8), lun = dvw.getUint32(4, true); if (dvw.getUint32(0, true) !== ITEM) break; parti.push(u.subarray(i + 8, Math.min(u.length, i + 8 + lun))); i += 8 + lun; }
  if (parti.length === 1) return parti[0];
  const out = new Uint8Array(parti.reduce((t, x) => t + x.length, 0)); let o = 0; for (const x of parti) { out.set(x, o); o += x.length; } return out;
}

// ---------------------------------------------------------------- decodifica di una tessera
// risultato: { bm } (ImageBitmap a colori) oppure { pix, w, h, spp } (campioni: canali monocromatici o RGB da convertire)
const TS = { jpeg: ['1.2.840.10008.1.2.4.50'], jpeg12: ['1.2.840.10008.1.2.4.51'], lossless: ['1.2.840.10008.1.2.4.57', '1.2.840.10008.1.2.4.70', '1.2.840.10008.1.2.4.14'],
  j2k: ['1.2.840.10008.1.2.4.90', '1.2.840.10008.1.2.4.91', '1.2.840.10008.1.2.4.92', '1.2.840.10008.1.2.4.93', '1.2.840.10008.1.2.4.201', '1.2.840.10008.1.2.4.202', '1.2.840.10008.1.2.4.203'],
  jls: ['1.2.840.10008.1.2.4.80', '1.2.840.10008.1.2.4.81'], jxl: ['1.2.840.10008.1.2.4.110', '1.2.840.10008.1.2.4.111', '1.2.840.10008.1.2.4.112'], rle: ['1.2.840.10008.1.2.5'],
  nativi: ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1'], webp: ['webp'], png: ['png'], bmp: ['bmp'] };
const MIME = { jxl: 'image/jxl', webp: 'image/webp', png: 'image/png', bmp: 'image/bmp', jpeg: 'image/jpeg' };
const tipoTs = (ts) => Object.keys(TS).find((k) => TS[k].includes(ts)) || null;
export const sintassiSupportata = (ts) => !!tipoTs(ts);
// decodifica delle tessere in un gruppo di web worker (vetrini-worker.js), fuori dal filo principale: lo scorrimento resta
// fluido anche con le tessere JPEG 2000. Le JPEG a colori e JPEG XL le decodifica il browser (createImageBitmap, già in
// parallelo). Se i worker non si avviano, si decodifica nella pagina (vetrini-dec.js).
export const DEC = { worker: 0, pagina: 0, browser: 0 };
const POOL = { lav: [], i: 0, attesa: new Map(), id: 0, no: typeof Worker === 'undefined' };
function avviaPool() {
  if (POOL.lav.length || POOL.no) return;
  const guasto = () => { POOL.no = true; for (const q of POOL.attesa.values()) q.ko(Object.assign(new Error('worker'), { worker: true })); POOL.attesa.clear(); POOL.lav.forEach((x) => x.terminate()); POOL.lav = []; };
  try {
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    for (let k = 0; k < n; k++) {
      const w = new Worker(new URL('./vetrini-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => { const q = POOL.attesa.get(e.data.id); if (!q) return; POOL.attesa.delete(e.data.id); if (e.data.errore) q.ko(new Error(e.data.errore)); else q.ok(e.data.t); };
      w.onerror = (e) => { e.preventDefault?.(); guasto(); };
      POOL.lav.push(w);
    }
  } catch { guasto(); }
}
function nelWorker(t, b, P) {
  avviaPool(); if (POOL.no || !POOL.lav.length) return null;
  const id = ++POOL.id, w = POOL.lav[POOL.i++ % POOL.lav.length], buf = b.byteOffset || b.byteLength !== b.buffer.byteLength ? b.slice().buffer : b.buffer;
  return new Promise((ok, ko) => { POOL.attesa.set(id, { ok, ko }); w.postMessage({ id, t, b: buf, P }, [buf]); });
}
async function tessera(L, k) {
  if (L.tesseraPropria) return L.tesseraPropria(k);   // formati con decodifica propria (CZI): { bm } oppure { pix, w, h, spp, bits }
  const t = tipoTs(L.ts), colore = L.spp === 3, P = { w: L.tw, h: L.th, spp: L.spp, bits: L.bits, conSegno: L.conSegno, foto: L.foto, piani: L.piani };
  if (!t) throw new Error('compressione delle tessere non supportata: ' + L.ts);
  if ((t === 'jpeg' && colore) || (t !== 'jpeg' && t in MIME)) {   // JPEG monocromatiche (fluorescenza): campioni dal decodificatore
    const b = await byteFotogramma(L, k);
    try { const bm = await createImageBitmap(new Blob([b], { type: MIME[t] })); DEC.browser++; return { bm }; }
    catch { if (t === 'jxl') throw new Error('questo browser non legge le tessere JPEG XL (Safari sì)'); if (t !== 'jpeg') throw new Error(`tessera ${t.toUpperCase()} non leggibile`); }   // JPEG: libjpeg-turbo
  }
  const p = nelWorker(t === 'jpeg' && L.bits > 8 ? 'jpeg12' : t, await byteFotogramma(L, k), P);
  if (p) { try { const r = await p; DEC.worker++; return r; } catch (e) { if (!e.worker) throw e; } }
  const { decodificaTessera } = await import('./vetrini-dec.js');
  DEC.pagina++; return decodificaTessera(t === 'jpeg' && L.bits > 8 ? 'jpeg12' : t, await byteFotogramma(L, k), P);
}
// campioni a colori (8 bit) → ImageBitmap
async function bitmapRGB(t) {
  if (t.bm) return t.bm;
  const img = new ImageData(t.w, t.h), d = img.data, p = t.pix, n = t.w * t.h, sc = t.bits > 8 ? 1 / 256 : 1;
  if (t.spp === 3) for (let i = 0, j = 0; i < n; i++, j += 3) { d[i * 4] = p[j] * sc; d[i * 4 + 1] = p[j + 1] * sc; d[i * 4 + 2] = p[j + 2] * sc; d[i * 4 + 3] = 255; }
  else for (let i = 0; i < n; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = p[i] * sc; d[i * 4 + 3] = 255; }
  return createImageBitmap(img);
}

// ---------------------------------------------------------------- un vetrino: livelli, piani focali, canali, immagini accessorie
const eDicom = async (f) => { try { const u = new Uint8Array(await f.slice(128, 132).arrayBuffer()); return String.fromCharCode(...u) === 'DICM'; } catch { return false; } };
export async function preparaVetrini(files) {
  const voci = [], altri = [];
  for (const f of files) {
    if (!(await eDicom(f)) && await (await import('./vetrini-formati.js')).formatoVetrino(f)) { altri.push(f); continue; }
    try { voci.push(await analizzaVetrino(f)); } catch (e) { console.warn('vetrino', f.name, e); }
  }
  // SVS, NDPI, TIFF piramidali, MRXS, … (vetrini-formati.js): stessa struttura dei vetrini DICOM
  const daAltri = altri.length ? await (await import('./vetrini-formati.js')).vetriniDaFormati(altri) : [];
  return [...preparaDicom(voci), ...daAltri];
}
function preparaDicom(voci) {
  const perSerie = new Map();
  for (const v of voci) { const k = v.serie || v.studio || 'vetrino'; if (!perSerie.has(k)) perSerie.set(k, []); perSerie.get(k).push(v); }
  return [...perSerie.values()].map((l) => {
    const img = l.filter((v) => v.tipo === 'VOLUME' || v.tipo === 'THUMBNAIL').sort((a, b) => b.W - a.W);
    if (!img.length) return null;
    // canali: tutti i cammini ottici dichiarati (nell'ordine del file più grande), poi quelli trovati nelle tessere
    const canali = [];
    const aggiungiCanale = (id, nome = '', onda = 0) => { if (!canali.some((c) => c.id === id)) canali.push({ id, nome, onda }); };
    for (const v of img) for (const c of v.cammini) aggiungiCanale(c.id, c.nome, c.onda);
    for (const v of img) for (const p of v.pos || []) if (p) aggiungiCanale(p[3]);
    if (!canali.length) aggiungiCanale('1');
    // piani focali: valori Z (µm) dalle tessere sparse, oppure indici 0..n-1
    const zVal = new Set();
    for (const v of img) if (v.pos) for (const p of v.pos) if (p) zVal.add(p[2]);
    for (const v of img) if (!v.pos && (v.nz > 1 || !zVal.size)) for (let z = 0; z < Math.max(1, v.nz); z++) zVal.add(v.nz > 1 && v.passoZ ? z * v.passoZ * 1000 : z);
    const piani = [...zVal].sort((a, b) => a - b);
    // livelli: file con la stessa larghezza = stesso livello (un vetrino può dividere piani o canali in più file)
    const livelli = [];
    for (const v of img) {
      let L = livelli.find((x) => Math.abs(x.W - v.W) <= 1 && Math.abs(x.H - v.H) <= 1 && x.tw === v.tw && x.th === v.th);
      if (!L) { L = { W: v.W, H: v.H, tw: v.tw, th: v.th, tipo: v.tipo, voci: new Map(), zPresenti: new Set() }; livelli.push(L); }
      const nx = Math.ceil(v.W / v.tw), ny = Math.ceil(v.H / v.th), cIdx = (id) => Math.max(0, canali.findIndex((c) => c.id === id));
      if (v.pos) v.pos.forEach((p, k) => { if (!p) return; const z = piani.indexOf(p[2]), key = `${Math.floor(p[0] / v.tw)},${Math.floor(p[1] / v.th)},${z},${cIdx(p[3])}`; if (!L.voci.has(key)) L.voci.set(key, [v, k]); L.zPresenti.add(z); });
      else {
        // TILED_FULL: colonna più veloce, poi riga, poi piano focale, poi cammino ottico
        const nz = Math.max(1, v.nz), nc = Math.max(1, Math.min(v.nc, Math.floor(v.n / (nx * ny * nz)) || 1));
        const ids = v.cammini.length ? v.cammini.map((c) => c.id) : [v.camminoCondiviso || canali[0].id];
        for (let k = 0; k < Math.min(v.n, nx * ny * nz * nc); k++) {
          const col = k % nx, row = Math.floor(k / nx) % ny, zi = Math.floor(k / (nx * ny)) % nz, ci = Math.floor(k / (nx * ny * nz));
          const zv = nz > 1 && v.passoZ ? zi * v.passoZ * 1000 : zi, z = piani.indexOf(zv) >= 0 ? piani.indexOf(zv) : zi;
          L.voci.set(`${col},${row},${z},${cIdx(ids[ci] ?? ids[0])}`, [v, k]); L.zPresenti.add(z);
        }
      }
    }
    const L0 = livelli[0], P0 = img[0];
    for (const L of livelli) { L.ds = L0.W / L.W; L.zLista = [...L.zPresenti].sort((a, b) => a - b); }
    const mono = P0.spp === 1;
    canali.forEach((c, k) => { c.colore = mono ? (canali.length === 1 ? [255, 255, 255] : coloreCanale(c.nome, c.onda, k)) : null; c.acceso = true; c.guadagno = 1; c.max = null; });
    return { W: L0.W, H: L0.H, sp: P0.sp, serie: P0.serie, livelli, piani, canali, mono, bitsSt: P0.bitsSt,
      descrizione: P0.descrizione || 'Vetrino', etichetta: l.find((v) => v.tipo === 'LABEL') || null, panoramica: l.find((v) => v.tipo === 'OVERVIEW') || null, studio: P0.studio };
  }).filter(Boolean);
}

// cache delle tessere decodificate (le ultime 500)
const CACHE = new Map();
function tesseraCache(v, k) {
  const ch = (v.chiave || (v.f.percorso || v.f.name) + '|' + v.f.size) + '|' + k;   // altri formati: più livelli nello stesso file
  if (CACHE.has(ch)) { const x = CACHE.get(ch); CACHE.delete(ch); CACHE.set(ch, x); return x; }
  const p = tessera(v, k).catch((e) => { CACHE.delete(ch); throw e; });
  CACHE.set(ch, p);
  while (CACHE.size > 500) { const [kk, x] = CACHE.entries().next().value; CACHE.delete(kk); x.then?.((t) => t.bm?.close?.()).catch(() => {}); }
  return p;
}
// tessera del livello L in (a, b) per il piano z e il canale c: se il livello non ha quel piano, il piano più vicino
function vocePer(L, a, b, z, c) {
  let r = L.voci.get(`${a},${b},${z},${c}`); if (r) return r;
  if (L.zLista.length && !L.zPresenti.has(z)) { const zz = L.zLista.reduce((m, x) => (Math.abs(x - z) < Math.abs(m - z) ? x : m), L.zLista[0]); r = L.voci.get(`${a},${b},${zz},${c}`); }
  return r || null;
}

// immagine della tessera per lo stato attuale: a colori, oppure canali monocromatici sovrapposti in falsi colori
async function immagineTessera(V, L, a, b, stato) {
  if (!V.mono) { const r = vocePer(L, a, b, stato.z, 0); if (!r) return null; const t = await tesseraCache(r[0], r[1]); if (t.bm) return t.bm; const bm = await bitmapRGB(t); bm._tmp = true; return bm; }
  const accesi = V.canali.map((c, i) => [c, i]).filter(([c]) => c.acceso);
  const parti = await Promise.all(accesi.map(async ([c, i]) => { const r = vocePer(L, a, b, stato.z, i); return r ? [c, await tesseraCache(r[0], r[1])] : null; }));
  const ok = parti.filter(Boolean); if (!ok.length) return null;
  const w = ok[0][1].w, h = ok[0][1].h, img = new ImageData(w, h), d = img.data, n = w * h;
  for (let i = 0; i < n; i++) d[i * 4 + 3] = 255;
  for (const [c, t] of ok) {
    const p = t.pix, max = (c.max || (t.bits > 8 ? 2 ** (V.bitsSt || 16) - 1 : 255)) / c.guadagno, [r, g, bl] = c.colore;
    for (let i = 0; i < n; i++) { const v = Math.min(1, Math.max(0, p[i] / max)); d[i * 4] = Math.min(255, d[i * 4] + v * r); d[i * 4 + 1] = Math.min(255, d[i * 4 + 1] + v * g); d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] + v * bl); }
  }
  return createImageBitmap(img);
}
// fluorescenza: valore massimo di ogni canale (99,5° percentile) dalle tessere del livello più piccolo
async function stimaCanali(V) {
  if (!V.mono) return;
  const L = V.livelli.at(-1);
  for (const [i, c] of V.canali.entries()) {
    const val = [];
    for (const [key, [v, k]] of [...L.voci].slice(0, 400)) {
      if (!key.endsWith(`,${i}`) || val.length > 200000) continue;
      try { const t = await tesseraCache(v, k); for (let j = 0; j < t.pix.length; j += 7) val.push(t.pix[j]); } catch {}
    }
    if (val.length) { val.sort((x, y) => x - y); c.max = Math.max(1, val[Math.floor(val.length * 0.995)]); }
  }
}

// tessere del livello L che toccano la zona (pixel del livello) e loro posizione: di norma una griglia regolare; alcuni formati
// (MRXS) hanno tessere in posizioni proprie, date da L.trova e L.pos
function tessereIn(L, x0, y0, w, h) {
  if (L.trova) return L.trova(x0, y0, w, h);
  const a0 = Math.max(0, Math.floor(x0 / L.tw)), a1 = Math.floor((x0 + w - 1) / L.tw), b0 = Math.max(0, Math.floor(y0 / L.th)), b1 = Math.floor((y0 + h - 1) / L.th), o = [];
  for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) o.push([a, b]);
  return o;
}
const posTessera = (L, a, b) => L.pos?.get(`${a},${b}`) || [a * L.tw, b * L.th];
// sorgente di tessere per OpenSeadragon: i livelli di OpenSeadragon sono potenze di 2; ogni tessera si compone dal livello
// DICOM più vicino (con un fattore di riduzione non più grande di quello richiesto), riducendo sul canvas.
// Lo stato (piano focale, canali) fa parte dell'indirizzo della tessera, così cambiandolo le tessere si rifanno.
function sorgente(OSD, V, stato, T = 256) {
  const maxL = Math.ceil(Math.log2(Math.max(V.W, V.H)));
  const ts = new OSD.TileSource({ width: V.W, height: V.H, tileSize: T, tileOverlap: 0, minLevel: 0, maxLevel: maxL });
  ts.getTileUrl = (l, x, y) => `vetrino://${stato.chiave()}/${l}/${x}/${y}`;
  const esegui = (job) => {
    const [l, x, y] = job.src.split('/').slice(-3).map(Number), f = 2 ** (maxL - l);
    const rx = x * T * f, ry = y * T * f, rw = Math.min(T * f, V.W - rx), rh = Math.min(T * f, V.H - ry);
    const cw = Math.max(1, Math.ceil(rw / f)), chh = Math.max(1, Math.ceil(rh / f));
    const L = [...V.livelli].reverse().find((q) => q.ds <= f * 1.01) || V.livelli[0];
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const g = cv.getContext('2d');
    g.fillStyle = V.mono ? '#000' : '#f3f3f3'; g.fillRect(0, 0, cw, chh);
    const s = L.ds / f;     // pixel del livello DICOM → pixel della tessera
    const lavori = [];
    for (const [a, b] of tessereIn(L, rx / L.ds, ry / L.ds, rw / L.ds, rh / L.ds)) {
      const [px, py] = posTessera(L, a, b);
      lavori.push(immagineTessera(V, L, a, b, stato).then((bm) => { if (!bm) return; g.imageSmoothingQuality = 'high'; g.drawImage(bm, (px * L.ds - rx) / f, (py * L.ds - ry) / f, (bm.width || L.tw) * s, (bm.height || L.th) * s); if (V.mono || bm._tmp) bm.close?.(); }));
    }
    Promise.allSettled(lavori).then((r) => {
      const err = r.find((z) => z.status === 'rejected');
      if (err && r.every((z) => z.status === 'rejected')) { job.fail(String(err.reason?.message || err.reason)); return; }
      if (!neutro(stato.colore)) try { applicaColore(g, cw, chh, stato.colore, V.mono); } catch {}
      job.finish(g, null, 'context2d');
    });
  };
  // rete lenta: mentre ci si muove, le tessere più fini di stato.lOk aspettano; si caricano quando ci si ferma sopra
  // quella zona (le richieste non vengono annullate né fatte fallire: OpenSeadragon non le chiederebbe più)
  stato.esegui = esegui;
  ts.downloadTileStart = (job) => { const l = +job.src.split('/').at(-3); if (stato.lento && stato.inMoto && l > stato.lOk) { stato.rinviate.add(job); return; } esegui(job); };
  ts.downloadTileAbort = (job) => { stato.rinviate?.delete(job); };
  return ts;
}

// immagine intera di un file piccolo (etichetta, panoramica): tutte le sue tessere su un canvas
async function immagineIntera(v) {
  const nx = Math.ceil(v.W / v.tw), ny = Math.ceil(v.H / v.th), cv = document.createElement('canvas'); cv.width = v.W; cv.height = v.H; const g = cv.getContext('2d');
  for (let k = 0; k < Math.min(v.n, nx * ny); k++) {
    const pk = v.pos?.[k], col = pk ? Math.floor(pk[0] / v.tw) : k % nx, row = pk ? Math.floor(pk[1] / v.th) : Math.floor(k / nx);
    const bm = await bitmapRGB(await tessera(v, k)); g.drawImage(bm, col * v.tw, row * v.th);
  }
  return cv;
}

// zona del vetrino (pixel del livello pieno x0, y0, w, h) ridotta di f (pixel del vetrino per pixel dell'immagine): le tessere
// del livello DICOM più vicino, a gruppi di 12 (non migliaia di richieste insieme); colore come nella vista
async function regione(V, stato, x0, y0, w, h, f, avanza) {
  const cw = Math.max(1, Math.round(w / f)), ch = Math.max(1, Math.round(h / f));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const g = cv.getContext('2d');
  g.fillStyle = V.mono ? '#000' : '#f3f3f3'; g.fillRect(0, 0, cw, ch); g.imageSmoothingQuality = 'high';
  const L = [...V.livelli].reverse().find((q) => q.ds <= f * 1.01) || V.livelli[0], s = L.ds / f;
  const lav = tessereIn(L, x0 / L.ds, y0 / L.ds, w / L.ds, h / L.ds);
  let fatti = 0, falliti = 0;
  for (let i = 0; i < lav.length; i += 12) {
    await Promise.all(lav.slice(i, i + 12).map(async ([a, b]) => {
      try { const bm = await immagineTessera(V, L, a, b, stato); const [px, py] = posTessera(L, a, b); if (bm) { g.drawImage(bm, (px * L.ds - x0) / f, (py * L.ds - y0) / f, (bm.width || L.tw) * s, (bm.height || L.th) * s); if (V.mono || bm._tmp) bm.close?.(); } }
      catch { falliti++; }
      fatti++;
    }));
    avanza?.(fatti, lav.length);
  }
  if (lav.length && falliti === lav.length) throw new Error('tessere del vetrino non leggibili');
  if (!neutro(stato.colore)) applicaColore(g, cw, ch, stato.colore, V.mono);
  return cv;
}
const MAX_LATO = 12000, MAX_PIXEL = 16e6;   // canvas che tutti i browser (anche Safari su iPad) sanno creare e salvare

// ---------------------------------------------------------------- colore: luminosità, contrasto, gamma, ematossilina / DAB
const neutro = (c) => !c || (c.lum === 0 && c.con === 1 && c.gam === 1 && c.modo === 'rgb');
// vettori di colore di ematossilina e DAB (Ruifrok e Johnston, Anal Quant Cytol Histol 2001), terzo vettore ortogonale;
// densità ottica OD = −log10(I/255); concentrazioni C = OD · M⁻¹ (righe di M: i tre vettori)
const HDAB = (() => {
  const n = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const h = n([0.65, 0.704, 0.286]), d = n([0.268, 0.57, 0.776]), r = n([h[1] * d[2] - h[2] * d[1], h[2] * d[0] - h[0] * d[2], h[0] * d[1] - h[1] * d[0]]);
  const M = [h, d, r], det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const inv = [0, 1, 2].map((i) => [0, 1, 2].map((j) => { const a = M[(j + 1) % 3], b = M[(j + 2) % 3]; return (a[(i + 1) % 3] * b[(i + 2) % 3] - a[(i + 2) % 3] * b[(i + 1) % 3]) / det; }));
  const od = new Float32Array(256); for (let i = 0; i < 256; i++) od[i] = -Math.log10(Math.max(i, 1) / 255);
  return { colori: [h, d], inv, od };
})();
function applicaColore(g, w, h, c, mono) {
  const img = g.getImageData(0, 0, w, h), d = img.data, lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) { let v = (i / 255 - 0.5) * c.con + 0.5 + c.lum / 100; v = Math.min(1, Math.max(0, v)); lut[i] = Math.round(255 * v ** (1 / c.gam)); }
  if (!mono && c.modo !== 'rgb') {   // solo ematossilina (blu) o solo DAB (marrone), ricostruiti dalla loro concentrazione
    const k = c.modo === 'H' ? 0 : 1, OD = HDAB.od, I = HDAB.inv, s = HDAB.colori[k];
    for (let i = 0; i < d.length; i += 4) {
      const ck = Math.max(0, OD[d[i]] * I[0][k] + OD[d[i + 1]] * I[1][k] + OD[d[i + 2]] * I[2][k]);
      d[i] = 255 * 10 ** (-ck * s[0]); d[i + 1] = 255 * 10 ** (-ck * s[1]); d[i + 2] = 255 * 10 ** (-ck * s[2]);
    }
  }
  if (c.lum !== 0 || c.con !== 1 || c.gam !== 1) for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
  g.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- vista
// Uno o due vetrini affiancati (sincronizzati in µm: si muovono, ingrandiscono e ruotano insieme), ingrandimenti come al
// microscopio, rotazione, schermo intero, tastiera, cronologia delle viste, istantanea con barra di scala, colore
// (luminosità, contrasto, gamma, ematossilina / DAB), annotazioni salvate (distanza, freccia, area, ellisse, campo ad alto
// ingrandimento, conteggio) esportabili in DICOM.
const fmt = (um, sp = true) => (!sp ? `${Math.round(um)} px` : um >= 1000 ? `${(um / 1000).toFixed(um >= 10000 ? 1 : 2).replace('.', ',')} mm` : `${um < 10 ? um.toFixed(1).replace('.', ',') : Math.round(um)} µm`);
const fmtA = (um2, sp = true) => (!sp ? `${Math.round(um2).toLocaleString()} px²` : um2 >= 1e4 ? `${(um2 / 1e6).toFixed(um2 >= 1e7 ? 2 : 3).replace('.', ',')} mm²` : `${Math.round(um2)} µm²`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const INGR = [2, 4, 10, 20, 40];      // «40×» = 0,25 µm per pixel dello schermo (obiettivo 40× con oculare 10×)
const HPF = [0.5, 0.55, 0.6];         // diametro del campo ad alto ingrandimento, mm (0,55 mm ≈ 0,24 mm²)
const STRUMENTI = [['dist', '📏', 'Distanza', 'trascina da un punto all\'altro'], ['freccia', '↗', 'Freccia', 'trascina dalla coda alla punta'],
  ['poligono', '⬠', 'Area', 'clic sui vertici o trascina a mano libera; doppio clic, Invio o clic sul primo punto per chiudere'],
  ['ellisse', '⬭', 'Ellisse', 'trascina da un angolo all\'altro'], ['hpf', '◯', 'Campo HPF', 'clic per posare un campo ad alto ingrandimento'],
  ['punto', '✚', 'Conta', 'clic su ogni elemento da contare (per esempio le mitosi); Canc toglie l\'ultimo']];
const COLORI_ANN = { dist: '#ffd400', freccia: '#ff5a1f', poligono: '#00e5ff', ellisse: '#7cff4f', hpf: '#ff4fd8', punto: '#ff2b2b' };
const scarica = (blob, nome) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

// onChiave(canvas, info) → numero di immagini chiave: 📸 e tasto K (anche dal ritaglio); onReferto(): 📝 apre il referto;
// onMisure(frasi): tasto I e «Misure nel referto»; credito: archivio, collezione e licenza (didascalie del ritaglio)
export async function apriVetrino(box, V, { OSD, conPaziente = false, client = true, tr = null, tutti = null, indice = 0, lento = false, dicomParser = globalThis.dicomParser,
  onChiave = null, onReferto = null, onMisure = null, credito = '', conTasti = null } = {}) {
  const A = await import('./vetrini-ann.js');
  if (!tr) { const t = await import('./i18n.js').then((m) => m.tr, () => null); tr = (s) => (t && t(s)) ?? s; }
  const altri = (tutti || []).map((v, k) => [v, k]).filter(([, k]) => k !== indice);
  const zEt = (i) => { const z = V.piani[i]; return V.piani.length > 1 && Math.abs(z - Math.round(z)) > 1e-6 || Math.abs(z) > 50 ? `${z.toFixed(1).replace('.', ',')} µm` : `${i + 1} / ${V.piani.length}`; };
  box.innerHTML = `<div class="vt-barra"><button type="button" class="vt-chiudi">← ${tr('Torna all\'esame')}</button><b class="vt-tit"></b>
      <span class="vt-gruppo" role="group" aria-label="${tr('Ingrandimento')}">${INGR.map((m) => `<button type="button" class="vt-ingr" data-m="${m}" title="${tr('Ingrandimento')} ${m}× (${tr('tasto')} ${INGR.indexOf(m) + 1})">${m}×</button>`).join('')}<b class="vt-ingr-at" title="${tr('Ingrandimento attuale')}"></b></span>
      <span class="vt-gruppo"><button type="button" class="vt-casa" title="${tr('Tutto il vetrino')} (0)">⤢</button><button type="button" class="vt-indietro" title="${tr('Vista precedente')} (B)" disabled>↶</button>
      <button type="button" class="vt-ruota" data-r="-90" title="${tr('Ruota a sinistra')} (Maiusc+R)">⟲</button><button type="button" class="vt-ruota" data-r="90" title="${tr('Ruota a destra')} (R)">⟳</button>
      <button type="button" class="vt-intero" title="${tr('Schermo intero')} (F)">⛶</button></span>
      <button type="button" class="vt-colore-b" aria-expanded="false">🎨 ${tr('Colore')}</button>
      <button type="button" class="vt-foto" title="${tr('Immagine della vista con la barra di scala, per un referto o una presentazione')}">📷 ${tr('Istantanea')}</button>
      <button type="button" class="vt-ritaglia" title="${tr('Ritaglia: trascina un rettangolo sulla zona e salvala in JPEG o PNG, anche alla risoluzione piena della scansione')} (X)">✂ ${tr('Ritaglia')}</button>
      ${onChiave ? `<button type="button" class="vt-chiave" title="${tr('Immagine chiave: la vista con annotazioni e barra di scala, per il referto')} (K)">📸 ${tr('Chiave')}<b class="vt-chiave-n"></b></button>` : ''}
      ${onReferto ? `<button type="button" class="vt-referto" title="${tr('Apri il referto')}">📝 ${tr('Referto')}</button>` : ''}
      ${altri.length ? `<select class="vt-affianca" title="${tr('Mostra un secondo vetrino accanto, sincronizzato')}"><option value="">⧉ ${tr('Affianca un vetrino…')}</option>${altri.map(([v, k]) => `<option value="${k}">${esc(v.descrizione || tr('Vetrino') + ' ' + (k + 1))}</option>`).join('')}</select>` : ''}
      ${client && V.panoramica ? `<button type="button" class="vt-panoramica" title="${tr('Panoramica del vetrino')}">🗺 ${tr('Panoramica')}</button>` : ''}
      ${client && V.etichetta ? `<button type="button" class="vt-etichetta" title="${tr('Etichetta del vetrino (può contenere i dati del paziente)')}">🏷 ${tr('Etichetta')}</button>` : ''}
      <span class="vt-info muted small"></span></div>
    <div class="vt-strumenti">${STRUMENTI.map(([s, ico, nome, aiuto]) => `<button type="button" class="vt-s${s === 'dist' ? ' vt-misura' : ''}" data-s="${s}" title="${tr(nome)}: ${tr(aiuto)}. Esc ${tr('per smettere')}">${ico} ${tr(nome)}</button>`).join('')}
      <select class="vt-hpf-d" title="${tr('Diametro del campo ad alto ingrandimento')}">${HPF.map((d) => `<option value="${d}"${d === 0.55 ? ' selected' : ''}>Ø ${String(d).replace('.', ',')} mm = ${(Math.PI * (d / 2) ** 2).toFixed(3).replace('.', ',')} mm²</option>`).join('')}</select>
      ${onMisure ? `<button type="button" class="vt-al-referto" title="${tr('Distanze, aree e conteggi nel referto')} (I)">↳ ${tr('Misure nel referto')}</button>` : ''}
      <button type="button" class="vt-annulla" title="${tr('Togli l\'ultima annotazione')} (Canc)">↩ ${tr('Annulla')}</button><button type="button" class="vt-cancella">🗑 ${tr('Cancella tutto')}</button>
      <button type="button" class="vt-esporta" title="${tr('Annotazioni in formato DICOM (Microscopy Bulk Simple Annotations), leggibili da altri visualizzatori di vetrini')}">💾 ${tr('Esporta DICOM')}</button>
      <label class="vt-importa cl-btn-piccolo" title="${tr('Apri un file DICOM di annotazioni di questo vetrino')}">📂 ${tr('Importa')}<input type="file" accept=".dcm,application/dicom" hidden></label>
      <span class="vt-conta small"></span><span class="vt-aiuto muted small"></span></div>
    <div class="vt-colore" hidden><label>${tr('Luminosità')} <input type="range" class="vt-lum" min="-60" max="60" step="2" value="0"></label>
      <label>${tr('Contrasto')} <input type="range" class="vt-con" min="0.4" max="2.5" step="0.05" value="1"></label>
      <label>${tr('Gamma')} <input type="range" class="vt-gam" min="0.4" max="2.5" step="0.05" value="1"></label>
      <label class="vt-modo-l">${tr('Colorazioni')} <select class="vt-modo"><option value="rgb">${tr('tutte (originale)')}</option><option value="H">${tr('solo ematossilina (nuclei)')}</option><option value="DAB">${tr('solo DAB (marrone, immunoistochimica)')}</option></select></label>
      <button type="button" class="vt-col-zero">${tr('Ripristina')}</button><span class="muted small vt-col-nota"></span></div>
    ${V.piani.length > 1 ? `<div class="vt-piani"><label>${tr('Piano focale')} <input type="range" class="vt-z" min="0" max="${V.piani.length - 1}" step="1" value="${Math.max(0, V.piani.indexOf(0))}"></label> <b class="vt-z-et"></b> <span class="muted small">(${tr('tasti')} PagSu / PagGiù)</span></div>` : ''}
    ${V.mono && V.canali.length > 1 ? `<div class="vt-canali">${V.canali.map((c, i) => `<label class="vt-canale" style="--c:rgb(${c.colore.join(',')})"><input type="checkbox" data-c="${i}" checked> ${esc(c.nome || tr('Canale') + ' ' + c.id)} <input type="range" data-g="${i}" min="0.25" max="6" step="0.25" value="1" title="${tr('Luminosità')}"></label>`).join('')}</div>` : ''}
    <div class="vt-corpo"></div>`;
  box.querySelector('.vt-tit').textContent = V.descrizione;
  const corpo = box.querySelector('.vt-corpo'), $ = (s) => box.querySelector(s);
  const touch = matchMedia('(pointer:coarse)').matches;
  const pannelli = []; let attivo = null, legato = true, sincronizzo = false;
  let strumento = null, inCorso = null;
  // 1.303 domanda sul vetrino: un clic (punto) o un rettangolo (zona) chiesto da fuori; segni fissi (zona del docente, punto dello studente)
  let chiesta = null; const segni = [];
  const storia = []; let tornando = false;

  // ------------------------------------------------ un pannello: vetrino, viewer, livello delle annotazioni, scala
  async function creaPannello(Vp) {
    const el = document.createElement('div'); el.className = 'vt-pane';
    el.innerHTML = '<div class="vt-osd"></div><svg class="vt-misure" aria-hidden="true"></svg><div class="vt-scala"><span></span><i></i></div><b class="vt-pane-tit"></b>';
    corpo.append(el);
    const P = { V: Vp, el, svg: el.querySelector('.vt-misure'), sp: Vp.sp ? Vp.sp[1] * 1000 : null, ann: A.caricaAnn(Vp),
      stato: { z: Math.max(0, Vp.piani.indexOf(0)), gen: 0, colore: { lum: 0, con: 1, gam: 1, modo: 'rgb' }, lento, inMoto: false, rinviate: new Set(), lOk: 99, chiave() { return `${this.z}.${this.gen}`; } } };
    el.querySelector('.vt-pane-tit').textContent = Vp.descrizione || '';
    await stimaCanali(Vp);
    P.viewer = OSD({ element: el.querySelector('.vt-osd'), tileSources: sorgente(OSD, Vp, P.stato), drawer: 'canvas', showNavigationControl: false, showNavigator: true, navigatorPosition: 'BOTTOM_RIGHT',
      maxZoomPixelRatio: 2, minZoomImageRatio: 0.8, visibilityRatio: 0.5, imageLoaderLimit: lento ? 0 : 8, timeout: lento ? 3.6e6 : 3e4, crossOriginPolicy: false,
      gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true }, gestureSettingsTouch: { clickToZoom: false, dblClickToZoom: true, pinchToZoom: true, pinchRotate: false, flickEnabled: true, flickMomentum: 0.2 },
      animationTime: touch ? 0.35 : 0.6, springStiffness: touch ? 9 : 6.5, zoomPerScroll: 1.25 });
    // i tasti li gestisce questo modulo (tasti()): senza questo OpenSeadragon, con il vetrino cliccato, ruotava, spostava e
    // ingrandiva una seconda volta (R ruotava di 180°)
    P.viewer.addHandler('canvas-key', (e) => { e.preventDefaultAction = true; });
    P.rifai = () => { P.stato.gen++; P.viewer.world.getItemAt(0)?.reset(); P.viewer.forceRedraw(); };
    const maxL = Math.ceil(Math.log2(Math.max(Vp.W, Vp.H)));
    P.izoom = () => P.viewer.viewport.viewportToImageZoom(P.viewer.viewport.getZoom(true));   // pixel dello schermo per pixel del vetrino
    // rete lenta: mentre ci si muove arrivano solo i livelli 4 volte più grossolani di quello pieno; il dettaglio quando ci si ferma
    const livelloOk = () => { const l = maxL + Math.ceil(Math.log2(Math.max(1e-6, P.izoom() * (devicePixelRatio || 1)))); P.stato.lOk = Math.min(maxL, l) - 2; };
    P.viewer.addHandler('animation-start', () => { P.stato.inMoto = true; livelloOk(); });
    P.viewer.addHandler('animation-finish', () => {
      P.stato.inMoto = false;
      if (P.stato.rinviate.size) {
        const b = P.viewer.viewport.getBoundsNoRotate(true);
        for (const j of [...P.stato.rinviate]) { const t = j.tile?.bounds; if (!t || (t.x < b.x + b.width && t.x + t.width > b.x && t.y < b.y + b.height && t.y + t.height > b.y)) { P.stato.rinviate.delete(j); P.stato.esegui(j); } }
      }
      ricorda(P); disegnaTutto();
    });
    P.viewer.addHandler('animation', () => { if (P === attivo) sincronizza(P); disegna(P); aggiornaIngr(); });
    P.viewer.addHandler('open', () => { disegna(P); aggiornaIngr(); ricorda(P); });
    P.viewer.addHandler('resize', () => disegna(P));
    P.viewer.addHandler('rotate', () => { if (P === attivo) sincronizza(P); disegna(P); });
    el.addEventListener('pointerdown', () => attiva(P), true);
    // disegno sulle annotazioni (attivo solo con uno strumento scelto); due dita: zoom e spostamento anche durante il disegno
    const dita = new Map(); let pinch = null;
    P.svg.addEventListener('pointerdown', (e) => {
      if (!strumento) return; P.svg.setPointerCapture(e.pointerId); dita.set(e.pointerId, [e.clientX, e.clientY]);
      if (dita.size === 2) { inCorso = null; const [a, b] = [...dita.values()]; pinch = { d: Math.hypot(b[0] - a[0], b[1] - a[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; disegna(P); return; }
      inizia(P, e);
    });
    P.svg.addEventListener('pointermove', (e) => {
      if (!dita.has(e.pointerId)) return; dita.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && dita.size === 2) {
        const [a, b] = [...dita.values()], d = Math.hypot(b[0] - a[0], b[1] - a[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r = P.svg.getBoundingClientRect(), vp = P.viewer.viewport;
        const prima = vp.pointFromPixel(new OSD.Point(pinch.m[0] - r.left, pinch.m[1] - r.top), true), dopo = vp.pointFromPixel(new OSD.Point(m[0] - r.left, m[1] - r.top), true);
        vp.panBy(prima.minus(dopo), true); vp.zoomBy(d / (pinch.d || d), vp.pointFromPixel(new OSD.Point(m[0] - r.left, m[1] - r.top), true), true); vp.applyConstraints(true);
        pinch = { d, m }; return;
      }
      continua(P, e);
    });
    const fine = (e) => { if (!dita.has(e.pointerId)) return; dita.delete(e.pointerId); if (pinch) { if (!dita.size) pinch = null; return; } termina(P, e); };
    P.svg.addEventListener('pointerup', fine); P.svg.addEventListener('pointercancel', fine);
    P.svg.addEventListener('dblclick', (e) => { if (strumento === 'poligono' && inCorso) { e.preventDefault(); chiudiPoligono(P); } });
    return P;
  }
  const aImg = (P, e) => { const r = P.svg.getBoundingClientRect(), q = P.viewer.viewport.viewerElementToImageCoordinates(new OSD.Point(e.clientX - r.left, e.clientY - r.top)); return [q.x, q.y]; };
  const aSch = (P, q) => { const s = P.viewer.viewport.imageToViewerElementCoordinates(new OSD.Point(q[0], q[1])); return [s.x, s.y]; };
  const pxSch = (P) => P.izoom();   // pixel dello schermo per pixel del vetrino

  // ------------------------------------------------ strumenti di annotazione
  function inizia(P, e) {
    const q = aImg(P, e);
    if (strumento === 'scelta') { const c = chiesta; chiesta = null; scegli('scelta'); c?.cb([Math.round(q[0]), Math.round(q[1])], indiceDi(P)); return; }
    if (strumento === 'zona') { inCorso = { P, a: { t: 'zona', p: [q, q] } }; disegna(P); return; }
    if (strumento === 'punto') { aggiungi(P, { t: 'punto', p: [q] }); return; }
    if (strumento === 'hpf') { const d = +$('.vt-hpf-d').value, r = P.sp ? (d * 1000) / 2 / P.sp : 100; aggiungi(P, { t: 'hpf', c: q, rx: r, ry: r }); return; }
    if (strumento === 'poligono') {
      if (inCorso?.P === P) {   // vertice in più, o chiusura sul primo punto
        const s0 = aSch(P, inCorso.a.p[0]), s = aSch(P, q);
        if (inCorso.a.p.length >= 3 && Math.hypot(s[0] - s0[0], s[1] - s0[1]) < 12) { chiudiPoligono(P); return; }
        inCorso.a.p.push(q); inCorso.giu = true; disegna(P); return;
      }
      inCorso = { P, a: { t: 'poligono', p: [q] }, giu: true }; disegna(P); return;
    }
    inCorso = { P, a: strumento === 'ellisse' ? { t: 'ellisse', c: q, rx: 0, ry: 0, o: q } : { t: strumento, p: [q, q] } }; disegna(P);
  }
  function continua(P, e) {
    if (!inCorso || inCorso.P !== P) return;
    const q = aImg(P, e), a = inCorso.a;
    if (a.t === 'poligono') { if (!inCorso.giu) return; const u = a.p.at(-1), su = aSch(P, u), s = aSch(P, q); if (Math.hypot(s[0] - su[0], s[1] - su[1]) > 6) { a.p.push(q); inCorso.libero = true; } }
    else if (a.t === 'ellisse') { a.c = [(a.o[0] + q[0]) / 2, (a.o[1] + q[1]) / 2]; a.rx = Math.abs(q[0] - a.o[0]) / 2; a.ry = Math.abs(q[1] - a.o[1]) / 2; }
    else a.p[1] = q;
    disegna(P);
  }
  function termina(P) {
    if (!inCorso || inCorso.P !== P) return;
    const a = inCorso.a;
    if (a.t === 'ritaglio') {
      inCorso = null; scegli('ritaglio'); disegna(P);
      const [p, q] = a.p, x0 = Math.max(0, Math.min(p[0], q[0])), y0 = Math.max(0, Math.min(p[1], q[1])), x1 = Math.min(P.V.W, Math.max(p[0], q[0])), y1 = Math.min(P.V.H, Math.max(p[1], q[1]));
      if ((x1 - x0) * pxSch(P) > 8 && (y1 - y0) * pxSch(P) > 8) apriRitaglio(P, [x0, y0, x1 - x0, y1 - y0]);
      return;
    }
    if (a.t === 'zona') {
      inCorso = null; const c = chiesta; chiesta = null; scegli('zona');
      const [p, q] = a.p, x0 = Math.max(0, Math.min(p[0], q[0])), y0 = Math.max(0, Math.min(p[1], q[1])), x1 = Math.min(P.V.W, Math.max(p[0], q[0])), y1 = Math.min(P.V.H, Math.max(p[1], q[1]));
      if ((x1 - x0) * pxSch(P) > 6 && (y1 - y0) * pxSch(P) > 6) c?.cb([x0, y0, x1, y1].map(Math.round), indiceDi(P)); else c?.cb(null);
      return;
    }
    if (a.t === 'poligono') { inCorso.giu = false; if (inCorso.libero && a.p.length >= 8) chiudiPoligono(P); return; }   // a mano libera: si chiude alzando il dito
    inCorso = null;
    if (a.t === 'ellisse') { delete a.o; if (a.rx * pxSch(P) > 2 && a.ry * pxSch(P) > 2) aggiungi(P, a); else disegna(P); return; }
    if (Math.hypot(a.p[1][0] - a.p[0][0], a.p[1][1] - a.p[0][1]) * pxSch(P) > 3) aggiungi(P, a); else disegna(P);
  }
  function chiudiPoligono(P) {
    const a = inCorso?.a; inCorso = null; if (!a) return;
    const p = []; for (const q of a.p) { const u = p.at(-1); if (!u || Math.hypot(q[0] - u[0], q[1] - u[1]) * pxSch(P) >= 3) p.push(q); }   // via i punti doppi (doppio clic)
    if (p.length >= 3) aggiungi(P, { t: 'poligono', p }); else disegna(P);
  }
  const salva = (P) => { if (!A.salvaAnn(P.V, P.ann)) $('.vt-aiuto').textContent = tr('Annotazioni non salvate: memoria del browser piena o non disponibile'); };
  function aggiungi(P, a) { P.ann.push(a); salva(P); disegna(P); riepilogo(); }
  function scegli(s) {
    strumento = strumento === s ? null : s; inCorso = null;
    if (chiesta && strumento !== chiesta.tipo) { const c = chiesta; chiesta = null; c.cb(null); }
    box.querySelectorAll('.vt-s').forEach((b) => b.classList.toggle('on', b.dataset.s === strumento)); $('.vt-ritaglia')?.classList.toggle('on', strumento === 'ritaglio');
    for (const P of pannelli) { P.svg.style.pointerEvents = strumento ? 'auto' : 'none'; P.svg.style.cursor = strumento ? 'crosshair' : ''; P.svg.style.touchAction = strumento ? 'none' : ''; P.viewer.setMouseNavEnabled(!strumento); disegna(P); }
    $('.vt-aiuto').textContent = !strumento ? '' : chiesta ? chiesta.aiuto : strumento === 'ritaglio' ? tr('trascina un rettangolo sulla zona da salvare; Esc per smettere') : tr(STRUMENTI.find((x) => x[0] === strumento)[3]);
  }

  // ------------------------------------------------ disegno: forme in coordinate dello schermo, per l'SVG e per l'istantanea
  function forme(P, map = (q) => aSch(P, q), conInCorso = true) {
    const sp = P.sp || 1, cal = !!P.sp, out = [], l = conInCorso && inCorso?.P === P ? [...P.ann, inCorso.a] : P.ann;
    for (const a of l) {
      const col = COLORI_ANN[a.t];
      if (a.t === 'zona') { const [p, q] = a.p; out.push({ k: 'area', p: [[p[0], p[1]], [q[0], p[1]], [q[0], q[1]], [p[0], q[1]]].map(map), col: '#ffd400', tratteggio: true }); continue; }
      if (a.t === 'ritaglio') { const [p, q] = a.p; out.push({ k: 'area', p: [[p[0], p[1]], [q[0], p[1]], [q[0], q[1]], [p[0], q[1]]].map(map), col: '#ffffff', tratteggio: true }); continue; }
      if (a.t === 'punto') { out.push({ k: 'punto', c: map(a.p[0]), col }); continue; }
      if (a.t === 'dist' || a.t === 'freccia') {
        const p = a.p.map(map); out.push({ k: a.t === 'freccia' ? 'freccia' : 'linea', p, col });
        if (a.t === 'dist') out.push({ k: 'testo', x: p[1][0] + 7, y: p[1][1] - 7, s: fmt(A.lunghezza(a, sp), cal) });
        continue;
      }
      const pts = a.t === 'poligono' ? a.p : A.puntiEllisse(a.c, a.rx, a.ry);
      const p = pts.map(map), aperto = a === inCorso?.a && a.t === 'poligono';
      out.push({ k: aperto ? 'linea' : 'area', p, col, tratteggio: a.t === 'hpf' });
      if (!aperto && pts.length >= 3) {
        const top = p.reduce((m, q) => (q[1] < m[1] ? q : m), p[0]);
        const ar = A.area(a, sp), per = A.perimetro(a, sp);
        let s = a.t === 'hpf' ? `HPF ${fmtA(ar, cal)}` : `${fmtA(ar, cal)} · ${fmt(per, cal)}`;
        const n = P.ann.filter((x) => x.t === 'punto' && A.dentro(x.p[0], a)).length; if (n) s += ` · ${n} ✚`;
        out.push({ k: 'testo', x: top[0] + 6, y: top[1] - 6, s });
      }
    }
    for (const g of segni.filter((x) => x.i === indiceDi(P))) {
      if (g.r) { const [x0, y0, x1, y1] = g.r, p = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(map); out.push({ k: 'area', p, col: g.col || '#ffd400' }); if (g.testo) out.push({ k: 'testo', x: Math.min(...p.map((q) => q[0])) + 4, y: Math.min(...p.map((q) => q[1])) - 6, s: g.testo }); }
      if (g.p) { const c = map(g.p); out.push({ k: 'punto', c, col: g.col || '#00e5ff' }); if (g.testo) out.push({ k: 'testo', x: c[0] + 9, y: c[1] - 9, s: g.testo }); }
    }
    return out;
  }
  const svgDi = (f) => f.map((x) => {
    if (x.k === 'punto') return `<circle cx="${x.c[0]}" cy="${x.c[1]}" r="6" style="fill:none;stroke:${x.col};stroke-width:2.5"/><circle cx="${x.c[0]}" cy="${x.c[1]}" r="1.8" style="fill:${x.col}"/>`;
    if (x.k === 'testo') return `<text x="${x.x}" y="${x.y}">${esc(x.s)}</text>`;
    const d = x.p.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('') + (x.k === 'area' ? 'Z' : '');
    let s = `<path d="${d}" style="fill:${x.k === 'area' ? x.col + '22' : 'none'};stroke:${x.col};stroke-width:2.5${x.tratteggio ? ';stroke-dasharray:7 5' : ''}"/>`;
    if (x.k === 'freccia') { const [a, b] = x.p, ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 14; s += `<path d="M${b[0]},${b[1]}L${b[0] - L * Math.cos(ang - 0.45)},${b[1] - L * Math.sin(ang - 0.45)}L${b[0] - L * Math.cos(ang + 0.45)},${b[1] - L * Math.sin(ang + 0.45)}Z" style="fill:${x.col};stroke:${x.col}"/>`; }
    if (x.k === 'linea' && x.p.length === 2) s += x.p.map((q) => `<circle cx="${q[0]}" cy="${q[1]}" r="3" style="fill:${x.col};stroke:#000"/>`).join('');
    return s;
  }).join('');
  function suCanvas(g, f, k = 1) {   // le stesse forme dell'SVG, disegnate sul canvas dell'istantanea (k: spessori e testi più grandi)
    for (const x of f) {
      if (x.k === 'testo') { g.font = `600 ${Math.round(13 * k)}px system-ui,sans-serif`; g.lineWidth = 3 * k; g.strokeStyle = '#000'; g.strokeText(x.s, x.x, x.y); g.fillStyle = '#fff'; g.fillText(x.s, x.x, x.y); continue; }
      g.lineWidth = 2.5 * k; g.strokeStyle = x.col; g.fillStyle = x.col;
      if (x.k === 'punto') { g.beginPath(); g.arc(x.c[0], x.c[1], 6 * k, 0, 2 * Math.PI); g.stroke(); g.beginPath(); g.arc(x.c[0], x.c[1], 1.8 * k, 0, 2 * Math.PI); g.fill(); continue; }
      g.setLineDash(x.tratteggio ? [7 * k, 5 * k] : []); g.beginPath(); x.p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
      if (x.k === 'area') { g.closePath(); g.fillStyle = x.col + '22'; g.fill(); } g.stroke(); g.setLineDash([]);
      if (x.k === 'freccia') { const [a, b] = x.p, ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 14 * k; g.fillStyle = x.col; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - L * Math.cos(ang - 0.45), b[1] - L * Math.sin(ang - 0.45)); g.lineTo(b[0] - L * Math.cos(ang + 0.45), b[1] - L * Math.sin(ang + 0.45)); g.closePath(); g.fill(); }
    }
  }
  function scalaDi(P) {   // barra di scala: la lunghezza «tonda» più vicina a 120 pixel dello schermo
    if (!P.sp) return null;
    const umPx = P.sp / pxSch(P), passi = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000], um = passi.find((x) => x >= 120 * umPx * 0.6) || 20000;
    return { um, px: um / umPx };
  }
  function disegna(P) {
    if (!P?.viewer?.world.getItemCount()) return;
    P.svg.innerHTML = svgDi(forme(P));
    const s = scalaDi(P), sc = P.el.querySelector('.vt-scala');
    if (s) { sc.querySelector('i').style.width = `${s.px}px`; sc.querySelector('span').textContent = fmt(s.um); } else sc.hidden = true;
  }
  const disegnaTutto = () => pannelli.forEach(disegna);
  function riepilogo() {
    const P = attivo; if (!P) return;
    const r = A.riepilogo(P.ann, P.sp || 1), cal = !!P.sp, parti = [];
    if (r.punti) parti.push(`✚ ${r.punti}`);
    if (r.campi) parti.push(tr(`nei ${r.campi} campi HPF (${fmtA(r.areaCampi * 1e6, cal)}): ${r.nelCampi}`) + (cal && r.areaCampi ? ` = ${(r.nelCampi / r.areaCampi).toFixed(1).replace('.', ',')}/mm²` : ''));
    if (r.aree && r.punti) parti.push(tr(`nelle aree (${fmtA(r.areaAree * 1e6, cal)}): ${r.nelleAree}`) + (cal && r.areaAree ? ` = ${(r.nelleAree / r.areaAree).toFixed(1).replace('.', ',')}/mm²` : ''));
    $('.vt-conta').textContent = parti.join(' · ');
  }

  // ------------------------------------------------ ingrandimento, sincronia, cronologia
  const ingrAttuale = (P) => (P.sp ? (10 * pxSch(P)) / P.sp : null);
  function aggiornaIngr() {
    const P = attivo; if (!P) return; const m = ingrAttuale(P), maxM = P.sp ? (10 * 2) / (P.sp * (devicePixelRatio || 1)) * 1.001 : 0;
    $('.vt-ingr-at').textContent = m ? `${m < 10 ? m.toFixed(1).replace('.', ',') : Math.round(m)}×` : '';
    box.querySelectorAll('.vt-ingr').forEach((b) => { b.disabled = !P.sp || +b.dataset.m > maxM; b.classList.toggle('on', !!m && Math.abs(m / +b.dataset.m - 1) < 0.04); });
  }
  function vaiIngr(m) { const P = attivo; if (!P?.sp) return; const vp = P.viewer.viewport; vp.zoomTo(vp.imageToViewportZoom((P.sp * m) / 10)); }
  function sincronizza(P) {   // l'altro pannello mostra lo stesso punto (in µm, più lo scostamento scelto) con la stessa scala e rotazione
    if (!legato || sincronizzo || pannelli.length < 2) return;
    const Q = pannelli.find((x) => x !== P), a = P.sp || 1, b = Q.sp || 1, vp = P.viewer.viewport, vq = Q.viewer.viewport;
    if (!Q.viewer.world.getItemCount()) return;
    sincronizzo = true;
    const c = vp.viewportToImageCoordinates(vp.getCenter(true)), sx = P === pannelli[0] ? 1 : -1;
    const cq = new OSD.Point((c.x * a + sx * scost.x) / b, (c.y * a + sx * scost.y) / b);
    vq.setRotation(vp.getRotation(true), true); vq.zoomTo(vq.imageToViewportZoom(pxSch(P) * (b / a)), null, true); vq.panTo(vq.imageToViewportCoordinates(cq), true);
    disegna(Q); sincronizzo = false;
  }
  const scost = { x: 0, y: 0 };   // µm: centro del secondo vetrino − centro del primo
  function misuraScost() { const [P, Q] = pannelli, c = (R) => R.viewer.viewport.viewportToImageCoordinates(R.viewer.viewport.getCenter(true)); const p = c(P), q = c(Q); scost.x = q.x * (Q.sp || 1) - p.x * (P.sp || 1); scost.y = q.y * (Q.sp || 1) - p.y * (P.sp || 1); }
  function ricorda(P) {
    if (tornando || P !== attivo) { tornando = false; return; }
    const vp = P.viewer.viewport, v = { c: vp.getCenter(true), z: vp.getZoom(true), r: vp.getRotation(true) }, u = storia.at(-1);
    if (u && Math.abs(u.z / v.z - 1) < 0.02 && u.r === v.r && Math.hypot(u.c.x - v.c.x, u.c.y - v.c.y) < 0.01 / v.z) return;
    storia.push(v); if (storia.length > 60) storia.shift(); $('.vt-indietro').disabled = storia.length < 2;
  }
  function indietro() {
    const P = attivo; if (!P || storia.length < 2) return;
    storia.pop(); const v = storia.at(-1); tornando = true; const vp = P.viewer.viewport;
    vp.setRotation(v.r); vp.zoomTo(v.z); vp.panTo(v.c); $('.vt-indietro').disabled = storia.length < 2;
  }
  function attiva(P) {
    if (attivo === P) return; attivo = P; pannelli.forEach((x) => x.el.classList.toggle('attivo', x === P && pannelli.length > 1));
    const c = P.stato.colore; $('.vt-lum').value = c.lum; $('.vt-con').value = c.con; $('.vt-gam').value = c.gam; $('.vt-modo').value = c.modo;
    $('.vt-modo-l').hidden = P.V.mono; aggiornaIngr(); riepilogo();
  }
  async function affianca(k) {
    if (pannelli[1]) { pannelli[1].viewer.destroy(); pannelli[1].el.remove(); pannelli.length = 1; }
    corpo.classList.toggle('due', k !== '');
    if (k !== '') {
      const Q = await creaPannello(tutti[+k]); pannelli.push(Q);
      const lega = document.createElement('button'); lega.type = 'button'; lega.className = 'vt-lega on'; lega.textContent = '🔗'; lega.title = tr('Movimenti legati al primo vetrino: clic per sganciarli, spostare il secondo e riagganciarli');
      lega.onclick = () => { legato = !legato; lega.classList.toggle('on', legato); if (legato) misuraScost(); };
      Q.el.append(lega); legato = true;
      // all'inizio i due vetrini sono allineati al centro (poi si possono sganciare e riallineare)
      scost.x = (Q.V.W * (Q.sp || 1) - P0.V.W * (P0.sp || 1)) / 2; scost.y = (Q.V.H * (Q.sp || 1) - P0.V.H * (P0.sp || 1)) / 2;
      Q.viewer.addOnceHandler('open', () => { attiva(pannelli[0]); sincronizza(pannelli[0]); });
      if (strumento) { const s0 = strumento, c = chiesta; chiesta = null; scegli(s0); chiesta = c; scegli(s0); }
    }
    pannelli.forEach((x) => x.viewer.forceResize?.()); setTimeout(() => { pannelli.forEach((x) => { x.viewer.forceResize?.(); disegna(x); }); if (pannelli[0]) sincronizza(pannelli[0]); }, 60);
  }

  // ------------------------------------------------ istantanea: la vista (uno o due vetrini) con annotazioni, barra di scala e didascalia
  function vistaCanvas() {
    const dpr = devicePixelRatio || 1, larg = pannelli.reduce((s, P) => s + P.el.clientWidth, 0), alt = Math.max(...pannelli.map((P) => P.el.clientHeight)), piede = 34;
    const cv = document.createElement('canvas'); cv.width = Math.round(larg * dpr); cv.height = Math.round((alt + piede) * dpr); const g = cv.getContext('2d'); g.scale(dpr, dpr);
    g.fillStyle = '#fff'; g.fillRect(0, 0, larg, alt + piede); let x0 = 0;
    for (const P of pannelli) {
      const w = P.el.clientWidth, h = P.el.clientHeight, src = P.viewer.drawer.canvas;
      g.drawImage(src, x0, 0, w, h);
      g.save(); g.beginPath(); g.rect(x0, 0, w, h); g.clip(); g.translate(x0, 0); suCanvas(g, forme(P)); g.restore();
      const s = scalaDi(P);
      if (s) { g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(x0 + 12, h - 44, Math.max(s.px, 60) + 16, 32); g.fillStyle = '#111'; g.font = '600 12px system-ui,sans-serif'; g.fillText(fmt(s.um), x0 + 20, h - 28); g.fillRect(x0 + 20, h - 22, s.px, 5); }
      x0 += w; if (P !== pannelli.at(-1)) { g.fillStyle = '#fff'; g.fillRect(x0 - 1, 0, 2, h); }
    }
    const m = attivo && ingrAttuale(attivo);
    g.fillStyle = '#111'; g.font = '13px system-ui,sans-serif';
    g.fillText([pannelli.map((P) => P.V.descrizione).join(' | '), m ? `${tr('ingrandimento')} ≈ ${Math.round(m)}×` : ''].filter(Boolean).join(' · ').slice(0, 220), 10, alt + 22);
    return cv;
  }
  async function istantanea() {
    const cv = vistaCanvas(), blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
    if (blob) scarica(blob, `vetrino-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`);
    return blob;
  }


  // ------------------------------------------------ vista attuale (per le immagini chiave: un clic la riporta)
  const indiceDi = (P) => { const k = (tutti || []).indexOf(P.V); return k >= 0 ? k : indice; };
  function vista(P = attivo) {
    const vp = P.viewer.viewport, c = vp.viewportToImageCoordinates(vp.getCenter(true)), iz = P.izoom();
    return { i: indiceDi(P), c: [Math.round(c.x), Math.round(c.y)], ...(P.sp ? { um: +(P.sp / iz).toPrecision(5) } : { s: +(1 / iz).toPrecision(5) }), r: Math.round(vp.getRotation(true)) % 360, z: P.stato.z };
  }
  function vaiVista(v, P = P0) {
    if (!v || !P.viewer.world.getItemCount()) return false;
    const vp = P.viewer.viewport, iz = P.sp && v.um ? P.sp / v.um : 1 / (v.s || 1);
    if (Number.isInteger(v.z) && v.z !== P.stato.z && P === P0) vaiZ(v.z);
    vp.setRotation(v.r || 0, true); vp.zoomTo(vp.imageToViewportZoom(iz), null, true); vp.panTo(vp.imageToViewportCoordinates(new OSD.Point(v.c[0], v.c[1])), true); vp.applyConstraints(true);
    disegna(P); aggiornaIngr(); return true;
  }
  const ingrTesto = (P) => { const m = ingrAttuale(P); return m ? `${m < 10 ? m.toFixed(1).replace('.', ',') : Math.round(m)}×` : ''; };

  // ------------------------------------------------ misure nel referto: distanze, aree, campi HPF e conteggi
  function frasiMisure(P = attivo) {
    const sp = P.sp || 1, cal = !!P.sp, out = [];
    for (const a of P.ann) {
      if (a.t === 'dist') out.push(`${tr('distanza')} ${fmt(A.lunghezza(a, sp), cal)}`);
      else if (a.t === 'poligono' || a.t === 'ellisse') out.push(`${tr('area')} ${fmtA(A.area(a, sp), cal)} (${tr('perimetro')} ${fmt(A.perimetro(a, sp), cal)})`);
    }
    const r = A.riepilogo(P.ann, sp);
    if (r.campi) out.push(`${r.nelCampi} ${tr('elementi contati in')} ${r.campi} ${tr(r.campi === 1 ? 'campo HPF' : 'campi HPF')} (${fmtA(r.areaCampi * 1e6, cal)})${cal && r.areaCampi ? ` = ${(r.nelCampi / r.areaCampi).toFixed(1).replace('.', ',')}/mm²` : ''}`);
    else if (r.aree && r.punti) out.push(`${r.nelleAree} ${tr('elementi contati in')} ${fmtA(r.areaAree * 1e6, cal)}${cal && r.areaAree ? ` = ${(r.nelleAree / r.areaAree).toFixed(1).replace('.', ',')}/mm²` : ''}`);
    else if (r.punti) out.push(`${r.punti} ${tr('elementi contati')}`);
    return out;
  }

  // ------------------------------------------------ ritaglio: una zona del vetrino in JPEG o PNG, alla risoluzione scelta
  // rett: [x, y, larghezza, altezza] in pixel del livello pieno. f = pixel del vetrino per pixel dell'immagine.
  // La rotazione della vista (multipli di 90°) si applica all'immagine; annotazioni, barra di scala e didascalia a scelta.
  async function componi(P, rett, { f = 1, conAnn = true, conScala = true, conDid = true, avanza = null } = {}) {
    const [x0, y0, w, h] = rett, img = await regione(P.V, P.stato, x0, y0, w, h, f, avanza);
    const r = ((Math.round(P.viewer.viewport.getRotation(true) / 90) * 90) % 360 + 360) % 360, gira = r % 180 !== 0;
    const ow = gira ? img.height : img.width, oh = gira ? img.width : img.height, k = Math.max(1, Math.min(8, Math.max(ow, oh) / 1100));
    const did = conDid ? [P.V.descrizione, P.sp ? `${fmt(w * P.sp)} × ${fmt(h * P.sp)}` : `${Math.round(w)} × ${Math.round(h)} px`, P.sp ? `${(P.sp * f).toFixed(3).replace('.', ',')} µm/pixel` : '', credito].filter(Boolean).join(' · ') : '';
    const piede = did ? Math.round(30 * k) : 0, cv = document.createElement('canvas'); cv.width = ow; cv.height = oh + piede;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.save(); g.translate(ow / 2, oh / 2); g.rotate((r * Math.PI) / 180); g.drawImage(img, -img.width / 2, -img.height / 2); g.restore();
    const cs = Math.cos((r * Math.PI) / 180), sn = Math.sin((r * Math.PI) / 180);
    const mappa = (q) => { const dx = (q[0] - x0) / f - img.width / 2, dy = (q[1] - y0) / f - img.height / 2; return [dx * cs - dy * sn + ow / 2, dx * sn + dy * cs + oh / 2]; };
    if (conAnn && P.ann.length) { g.save(); g.beginPath(); g.rect(0, 0, ow, oh); g.clip(); suCanvas(g, forme(P, mappa, false), k); g.restore(); }
    if (conScala && P.sp) {
      const umPx = P.sp * f, passi = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000], um = [...passi].reverse().find((x) => x / umPx <= ow * 0.25) || 1, px = um / umPx;
      g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(12 * k, oh - 44 * k, Math.max(px, 60 * k) + 16 * k, 32 * k);
      g.fillStyle = '#111'; g.font = `600 ${Math.round(12 * k)}px system-ui,sans-serif`; g.fillText(fmt(um), 20 * k, oh - 28 * k); g.fillRect(20 * k, oh - 22 * k, px, 5 * k);
    }
    if (did) {   // la didascalia entra nella larghezza: carattere più piccolo, poi «…»
      let fs = 13 * k, t = did.slice(0, 240); g.fillStyle = '#111'; g.font = `${fs}px system-ui,sans-serif`;
      while (g.measureText(t).width > ow - 20 * k && fs > 8) { fs -= 0.5; g.font = `${fs}px system-ui,sans-serif`; }
      while (g.measureText(t).width > ow - 20 * k && t.length > 4) t = t.slice(0, -2).trimEnd() + '…';
      if (t.endsWith('……')) t = t.replace(/…+$/, '…');
      g.fillText(t, 10 * k, oh + 21 * k);
    }
    return cv;
  }
  // fattori di riduzione proposti: come sullo schermo, piena risoluzione, metà, un quarto (oltre i limiti del browser: non disponibili)
  function risoluzioni(P, rett) {
    const [, , w, h] = rett, dpr = devicePixelRatio || 1, schermo = Math.max(1, 1 / (P.izoom() * dpr));
    const voci = [['schermo', schermo, tr('come sullo schermo')], ['piena', 1, tr('piena (scansione)')], ['meta', 2, tr('metà')], ['quarto', 4, tr('un quarto')]];
    return voci.map(([id, f, nome]) => {
      const ow = Math.round(w / f), oh = Math.round(h / f), ok = ow <= MAX_LATO && oh <= MAX_LATO && ow * oh <= MAX_PIXEL;
      return { id, f, nome, ow, oh, ok, um: P.sp ? P.sp * f : null };
    });
  }
  function apriRitaglio(P, rett) {
    const d = document.createElement('dialog'); d.className = 'vt-dlg vt-rit';
    const ris = risoluzioni(P, rett), prima = (['piena', 'meta', 'quarto'].map((id) => ris.find((x) => x.id === id && x.ok)).find(Boolean) || ris[0]).id;   // la più fine che il browser regge
    const mis = P.sp ? `${fmt(rett[2] * P.sp)} × ${fmt(rett[3] * P.sp)}` : `${Math.round(rett[2])} × ${Math.round(rett[3])} px`;
    d.innerHTML = `<h3>✂ ${tr('Ritaglio')} <span class="muted small">${mis}</span></h3><div class="vt-rit-ant"><p class="muted small">${tr('Anteprima…')}</p></div>
      <div class="vt-rit-opz"><label>${tr('Risoluzione')} <select class="vt-rit-ris">${ris.map((x) => `<option value="${x.id}"${x.ok ? '' : ' disabled'}${x.id === prima ? ' selected' : ''}>${x.nome}: ${x.ow.toLocaleString()} × ${x.oh.toLocaleString()} px${x.um ? ` (${x.um.toFixed(2).replace('.', ',')} µm/pixel)` : ''}${x.ok ? '' : ' — ' + tr('troppo grande')}</option>`).join('')}</select></label>
      <label>${tr('Formato')} <select class="vt-rit-fmt"><option value="jpeg">JPEG</option><option value="png">PNG (${tr('senza perdita, file più grande')})</option></select></label>
      <label class="vt-rit-q">${tr('Qualità JPEG')} <input type="range" min="0.6" max="1" step="0.02" value="0.92"> <b>92%</b></label>
      <label><input type="checkbox" class="vt-rit-ann"${P.ann.length ? ' checked' : ' disabled'}> ${tr('annotazioni')}</label>
      <label><input type="checkbox" class="vt-rit-scala"${P.sp ? ' checked' : ' disabled'}> ${tr('barra di scala')}</label>
      <label><input type="checkbox" class="vt-rit-did" checked> ${tr('didascalia')}</label></div>
      <p class="vt-rit-stato muted small"></p>
      <p class="vt-rit-az"><button type="button" class="primario vt-rit-scarica">⬇ ${tr('Scarica')}</button>${onChiave ? `<button type="button" class="vt-rit-chiave">📸 ${tr('Immagine chiave')}</button>` : ''}<button type="button" class="vt-rit-annulla">${tr('Chiudi')}</button></p>`;
    box.append(d); d.onclose = () => d.remove(); d.showModal();
    const q = (x) => d.querySelector(x), stato = q('.vt-rit-stato');
    q('.vt-rit-q input').oninput = (e) => { q('.vt-rit-q b').textContent = Math.round(e.target.value * 100) + '%'; };
    q('.vt-rit-fmt').onchange = () => { q('.vt-rit-q').hidden = q('.vt-rit-fmt').value !== 'jpeg'; };
    const opz = () => ({ f: ris.find((x) => x.id === q('.vt-rit-ris').value).f, conAnn: q('.vt-rit-ann').checked, conScala: q('.vt-rit-scala').checked, conDid: q('.vt-rit-did').checked });
    let anteprima = null;
    const rifaiAnt = async () => {   // anteprima alla risoluzione dello schermo (veloce, tessere già caricate)
      try { const o = opz(), cv = await componi(P, rett, { ...o, f: ris[0].f }); cv.className = 'vt-img'; const a = q('.vt-rit-ant'); a.innerHTML = ''; a.append(cv); anteprima = cv; } catch (e) { q('.vt-rit-ant').textContent = e.message; }
    };
    ['.vt-rit-ann', '.vt-rit-scala', '.vt-rit-did'].forEach((x) => { q(x).onchange = rifaiAnt; }); rifaiAnt();
    const crea = async () => {
      const o = opz(); stato.textContent = tr('Compongo l\'immagine…'); d.querySelectorAll('.vt-rit-az button').forEach((b) => { b.disabled = true; });
      try { return await componi(P, rett, { ...o, avanza: (n, t) => { stato.textContent = `${tr('Tessere')} ${n} / ${t}`; } }); }
      finally { d.querySelectorAll('.vt-rit-az button').forEach((b) => { b.disabled = false; }); }
    };
    q('.vt-rit-scarica').onclick = async () => {
      try {
        const cv = await crea(), jpeg = q('.vt-rit-fmt').value === 'jpeg';
        const blob = await new Promise((ok) => cv.toBlob(ok, jpeg ? 'image/jpeg' : 'image/png', jpeg ? +q('.vt-rit-q input').value : undefined));
        if (!blob) throw new Error(tr('il browser non è riuscito a creare il file'));
        const nome = `vetrino-${(P.V.descrizione || 'ritaglio').replace(/[^\w.-]+/g, '_').slice(0, 40)}-${cv.width}x${cv.height}.${jpeg ? 'jpg' : 'png'}`;
        scarica(blob, nome); stato.textContent = `${tr('Salvato')}: ${nome} (${(blob.size / 1e6).toFixed(1).replace('.', ',')} MB)`; API.ultimoRitaglio = { blob, w: cv.width, h: cv.height, nome };
      } catch (e) { stato.textContent = tr('Ritaglio non riuscito') + ': ' + e.message; }
    };
    q('.vt-rit-chiave')?.addEventListener('click', async () => {
      try { const cv = anteprima || await crea(); const n = await onChiave(cv, infoChiave(P, { ritaglio: rett })); segnaChiavi(n); stato.textContent = `📸 ${tr('Immagine chiave')} ${n}`; } catch (e) { stato.textContent = e.message; }
    });
    q('.vt-rit-annulla').onclick = () => d.close();
    return d;
  }

  // ------------------------------------------------ immagini chiave
  const infoChiave = (P, extra = {}) => ({ descrizione: P.V.descrizione || tr('Vetrino'), vista: { ...vista(P), ...(extra.ritaglio ? { rit: extra.ritaglio.map(Math.round) } : {}) }, ingr: ingrTesto(P), misure: frasiMisure(P) });
  const segnaChiavi = (n) => { const b = $('.vt-chiave-n'); if (b && Number.isFinite(n)) b.textContent = n ? ` ${n}` : ''; };
  async function chiave() {
    if (!onChiave || !attivo) return;
    try { const n = await onChiave(vistaCanvas(), infoChiave(attivo)); segnaChiavi(n); $('.vt-aiuto').textContent = `📸 ${tr('Immagine chiave')} ${n ?? ''}`; }
    catch (e) { $('.vt-aiuto').textContent = e.message; }
  }
  const misureAlReferto = () => { if (!onMisure || !attivo) return; const l = frasiMisure(attivo); if (!l.length) { $('.vt-aiuto').textContent = tr('Nessuna misura: usa distanza, area, ellisse, campo HPF o conta'); return; } onMisure(l); };

  // ------------------------------------------------ comandi
  const P0 = await creaPannello(V); pannelli.push(P0); attiva(P0);
  const sp = P0.sp;
  $('.vt-info').textContent = `${V.formato ? V.formato + ' · ' : ''}${V.W.toLocaleString()} × ${V.H.toLocaleString()} pixel · ${V.livelli.length} ${tr('livelli')}${V.piani.length > 1 ? ` · ${V.piani.length} ${tr('piani focali')}` : ''}${V.mono && V.canali.length > 1 ? ` · ${V.canali.length} ${tr('canali')}` : ''}${sp ? ` · ${sp.toFixed(3).replace('.', ',')} µm/pixel (≈ ${Math.round(10 / sp)}×)` : ' · ' + tr('senza calibrazione: misure in pixel')}`;
  const zIn = $('.vt-z'), zEtEl = $('.vt-z-et');
  const vaiZ = (z) => { P0.stato.z = Math.max(0, Math.min(V.piani.length - 1, z)); if (zIn) zIn.value = String(P0.stato.z); if (zEtEl) zEtEl.textContent = zEt(P0.stato.z); P0.rifai(); };
  if (zIn) { zEtEl.textContent = zEt(P0.stato.z); zIn.oninput = () => vaiZ(+zIn.value); }
  box.querySelectorAll('.vt-canali [data-c]').forEach((x) => { x.onchange = () => { V.canali[+x.dataset.c].acceso = x.checked; P0.rifai(); }; });
  box.querySelectorAll('.vt-canali [data-g]').forEach((x) => { x.onchange = () => { V.canali[+x.dataset.g].guadagno = +x.value; P0.rifai(); }; });
  box.querySelectorAll('.vt-ingr').forEach((b) => { b.onclick = () => vaiIngr(+b.dataset.m); });
  $('.vt-casa').onclick = () => attivo.viewer.viewport.goHome();
  $('.vt-indietro').onclick = indietro;
  box.querySelectorAll('.vt-ruota').forEach((b) => { b.onclick = () => { const vp = attivo.viewer.viewport; vp.setRotation((vp.getRotation() + +b.dataset.r + 360) % 360); }; });
  const intero = () => { const fs = document.fullscreenElement || document.webkitFullscreenElement; if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (box.requestFullscreen || box.webkitRequestFullscreen)?.call(box)?.catch?.(() => {}); };
  $('.vt-intero').onclick = intero;
  const fsCambio = () => { $('.vt-intero').classList.toggle('on', !!(document.fullscreenElement || document.webkitFullscreenElement)); setTimeout(() => pannelli.forEach((P) => { P.viewer.forceResize?.(); disegna(P); }), 100); };
  document.addEventListener('fullscreenchange', fsCambio); document.addEventListener('webkitfullscreenchange', fsCambio);
  $('.vt-colore-b').onclick = () => { const p = $('.vt-colore'); p.hidden = !p.hidden; $('.vt-colore-b').classList.toggle('on', !p.hidden); $('.vt-colore-b').setAttribute('aria-expanded', String(!p.hidden)); };
  const colore = () => { const c = attivo.stato.colore; c.lum = +$('.vt-lum').value; c.con = +$('.vt-con').value; c.gam = +$('.vt-gam').value; c.modo = $('.vt-modo').value; $('.vt-col-nota').textContent = c.modo !== 'rgb' ? tr('separazione delle colorazioni (Ruifrok e Johnston): stima visiva, non una misura') : ''; attivo.rifai(); };
  let tCol = 0; box.querySelectorAll('.vt-colore input, .vt-colore select').forEach((x) => { x.oninput = () => { clearTimeout(tCol); tCol = setTimeout(colore, 120); }; });
  $('.vt-col-zero').onclick = () => { $('.vt-lum').value = 0; $('.vt-con').value = 1; $('.vt-gam').value = 1; $('.vt-modo').value = 'rgb'; colore(); };
  $('.vt-foto').onclick = () => istantanea().catch((e) => { $('.vt-aiuto').textContent = tr('Istantanea non riuscita') + ': ' + e.message; });
  $('.vt-ritaglia').onclick = () => scegli('ritaglio');
  if ($('.vt-chiave')) $('.vt-chiave').onclick = chiave;
  if ($('.vt-referto')) $('.vt-referto').onclick = () => onReferto();
  if ($('.vt-al-referto')) $('.vt-al-referto').onclick = misureAlReferto;
  const sel = $('.vt-affianca'); if (sel) sel.onchange = () => affianca(sel.value).catch((e) => { $('.vt-aiuto').textContent = e.message; });
  box.querySelectorAll('.vt-s').forEach((b) => { b.onclick = () => scegli(b.dataset.s); });
  const annulla = () => { const P = attivo; if (inCorso) { inCorso = null; disegna(P); return; } if (P.ann.length) { P.ann.pop(); salva(P); disegna(P); riepilogo(); } };
  $('.vt-annulla').onclick = annulla;
  $('.vt-cancella').onclick = () => { const P = attivo; if (!P.ann.length || !confirm(tr('Cancellare tutte le annotazioni di questo vetrino?'))) return; P.ann.length = 0; salva(P); disegna(P); riepilogo(); };
  $('.vt-esporta').onclick = () => {
    const P = attivo; if (!P.ann.length) { $('.vt-aiuto').textContent = tr('Nessuna annotazione da esportare'); return; }
    try { const b = A.creaANN(P.V, P.ann, P.sp); scarica(new Blob([b], { type: 'application/dicom' }), 'annotazioni-vetrino.dcm'); $('.vt-aiuto').textContent = `${P.ann.length} ${tr('annotazioni esportate in DICOM')}`; }
    catch (e) { $('.vt-aiuto').textContent = tr('Esportazione non riuscita') + ': ' + e.message; }
  };
  $('.vt-importa input').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return; const P = attivo;
    try {
      if (!dicomParser) throw new Error('lettore DICOM non disponibile');
      const ds = dicomParser.parseDicom(new Uint8Array(await f.arrayBuffer())), l = A.leggiANN(ds);
      const fuori = l.filter((a) => (a.c || a.p[0])[0] > P.V.W * 1.05 || (a.c || a.p[0])[1] > P.V.H * 1.05).length;
      P.ann.push(...l); salva(P); disegna(P); riepilogo();
      $('.vt-aiuto').textContent = `${l.length} ${tr('annotazioni importate')}${fuori ? ` (${fuori} ${tr('fuori dal vetrino: forse sono di un altro vetrino')})` : ''}`;
    } catch (x) { $('.vt-aiuto').textContent = tr('Annotazioni non importate') + ': ' + x.message; }
  };
  // etichetta e panoramica (finestra sopra il vetrino)
  const mostra = async (v, titolo) => {
    const d = document.createElement('dialog'); d.className = 'vt-dlg'; d.innerHTML = `<h3></h3><p class="muted">${tr('Caricamento…')}</p><p><button type="button">${tr('Chiudi')}</button></p>`;
    d.querySelector('h3').textContent = titolo; d.querySelector('button').onclick = () => d.close(); d.onclose = () => d.remove(); box.append(d); d.showModal();
    try {
      const cv = await immagineIntera(v); cv.className = 'vt-img'; d.querySelector('.muted').replaceWith(cv);
      // codici a barre, DataMatrix e QR (di solito l'identificativo del paziente o del campione): avviso, nel browser, senza rete
      const av = document.createElement('p'); av.className = 'vt-avviso-dati small'; cv.after(av);
      if ('BarcodeDetector' in globalThis) {
        try {
          const cod = await new globalThis.BarcodeDetector().detect(cv);
          av.textContent = cod.length ? `⚠ ${tr('Contiene')} ${cod.length === 1 ? tr('un codice') : cod.length + ' ' + tr('codici')} (${[...new Set(cod.map((c) => c.format))].join(', ')}): ${tr('può identificare il paziente. Non includerlo in immagini o documenti da condividere.')}`
            : tr('Nessun codice a barre riconosciuto; scritte e numeri possono comunque identificare il paziente.');
          if (cod.length) av.classList.add('trovato');
        } catch { av.textContent = tr('Scritte e codici dell\'etichetta possono identificare il paziente.'); }
      } else av.textContent = tr('Scritte e codici dell\'etichetta possono identificare il paziente.');
    } catch (e) { d.querySelector('.muted').textContent = e.message; }
  };
  const bp = $('.vt-panoramica'); if (bp) bp.onclick = () => mostra(V.panoramica, tr('Panoramica del vetrino'));
  const be = $('.vt-etichetta');
  if (be) be.onclick = () => { if (!conPaziente && !confirm(tr('L\'etichetta del vetrino può contenere nome e codici del paziente. Mostrarla?'))) return; mostra(V.etichetta, tr('Etichetta del vetrino')); };
  // tastiera: frecce per spostarsi, + e − per ingrandire, 1–5 ingrandimenti, 0 tutto il vetrino, R ruota, F schermo intero,
  // B vista precedente, Canc toglie l'ultima annotazione, Invio chiude l'area, Esc smette di disegnare, PagSu/PagGiù piani
  const tasti = (e) => {
    if (box.hidden || box.querySelector('dialog[open]') || (conTasti && !conTasti())) return;   // accanto alle immagini: solo se si sta usando il vetrino
    if (e.target?.closest?.('input, textarea, select') && e.key !== 'Escape') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const vp = attivo.viewer.viewport, b = vp.getBounds(true), k = e.key;
    const fatto = () => e.preventDefault();
    if (k === 'Escape') { if (inCorso?.a.t === 'poligono' && inCorso.a.p.length >= 3) chiudiPoligono(attivo); else if (strumento) scegli(strumento); return; }
    if (k === 'Enter' && inCorso?.a.t === 'poligono') { chiudiPoligono(attivo); fatto(); return; }
    if (k === 'Delete' || k === 'Backspace') { annulla(); fatto(); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      const r = (vp.getRotation() * Math.PI) / 180, d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k], f = e.shiftKey ? 0.6 : 0.2;
      const dx = d[0] * Math.cos(r) + d[1] * Math.sin(r), dy = -d[0] * Math.sin(r) + d[1] * Math.cos(r);
      vp.panBy(new OSD.Point(dx * b.width * f, dy * b.height * f)); fatto(); return;
    }
    if (k === '+' || k === '=') { vp.zoomBy(1.4); fatto(); return; }
    if (k === '-' || k === '_') { vp.zoomBy(1 / 1.4); fatto(); return; }
    if (k === '0') { vp.goHome(); fatto(); return; }
    if (/^[1-5]$/.test(k)) { vaiIngr(INGR[+k - 1]); fatto(); return; }
    if (k === 'r' || k === 'R') { vp.setRotation((vp.getRotation() + (e.shiftKey ? -90 : 90) + 360) % 360); fatto(); return; }
    if (k === 'f' || k === 'F') { intero(); fatto(); return; }
    if (k === 'b' || k === 'B') { indietro(); fatto(); return; }
    if ((k === 'k' || k === 'K') && onChiave) { chiave(); fatto(); return; }
    if ((k === 'i' || k === 'I') && onMisure) { misureAlReferto(); fatto(); return; }
    if (k === 'x' || k === 'X') { scegli('ritaglio'); fatto(); return; }
    if (V.piani.length > 1 && (k === 'PageUp' || k === 'PageDown')) { vaiZ(P0.stato.z + (k === 'PageUp' ? 1 : -1)); fatto(); }
  };
  document.addEventListener('keydown', tasti);
  riepilogo();
  const API = {
    vista: () => vista(), vaiVista: (v) => vaiVista(v), chiave, frasiMisure: () => frasiMisure(), apriRitaglio: (r) => apriRitaglio(attivo, r), componi: (r, o) => componi(attivo, r, o), risoluzioni: (r) => risoluzioni(attivo, r), segnaChiavi,
    get viewer() { return pannelli[0].viewer; }, get misure() { return P0.ann; }, get ann() { return attivo.ann; }, stato: P0.stato, vaiZ, sp, V, pannelli,
    // domanda sul vetrino: chiediPunto/chiediZona(aiuto) → Promise con [x, y] o [x0, y0, x1, y1] (pixel della scansione) e indice del vetrino, null se annullata
    chiediPunto: (aiuto) => new Promise((ok) => { if (chiesta) { const c = chiesta; chiesta = null; c.cb(null); } chiesta = { tipo: 'scelta', aiuto, cb: (q, i) => ok(q ? { p: q, i } : null) }; if (strumento !== 'scelta') scegli('scelta'); else $('.vt-aiuto').textContent = aiuto; }),
    chiediZona: (aiuto) => new Promise((ok) => { if (chiesta) { const c = chiesta; chiesta = null; c.cb(null); } chiesta = { tipo: 'zona', aiuto, cb: (r, i) => ok(r ? { r, i } : null) }; if (strumento !== 'zona') scegli('zona'); else $('.vt-aiuto').textContent = aiuto; }),
    segna: (l) => { segni.length = 0; segni.push(...(l || [])); disegnaTutto(); },
    get segni() { return segni.slice(); },
    scegli, vaiIngr, ingrAttuale: () => ingrAttuale(attivo), istantanea, affianca, indietro, aImg: (x, y) => { const s = attivo.svg.getBoundingClientRect(); return aImg(attivo, { clientX: x + s.left, clientY: y + s.top }); },
    _lung: (a) => A.lunghezza(a, sp || 1), riepilogo: () => A.riepilogo(attivo.ann, attivo.sp || 1), creaANN: () => A.creaANN(attivo.V, attivo.ann, attivo.sp), leggiANN: A.leggiANN,
    chiudi: () => { document.removeEventListener('keydown', tasti); document.removeEventListener('fullscreenchange', fsCambio); document.removeEventListener('webkitfullscreenchange', fsCambio); if (document.fullscreenElement === box) document.exitFullscreen?.().catch(() => {}); pannelli.forEach((P) => P.viewer.destroy()); box.innerHTML = ''; },
  };
  return API;
}
