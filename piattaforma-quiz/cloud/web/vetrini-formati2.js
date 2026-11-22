// vetrini-formati2.js — formati di vetrino che servono decodificatori in più (caricati solo quando si apre un file così).
// Zeiss CZI: file a segmenti (ZISRAW). Le tessere («subblock») hanno posizione e dimensioni proprie (mosaico), più livelli
// della piramide (dimensione memorizzata più piccola di quella logica), canali (fluorescenza) e piani; compressioni:
// nessuna, JPEG, JPEG XR (jxrlib in WebAssembly, lib/jpegxr.mjs) e Zstandard (lib/fzstd.mjs). Etichetta e panoramica sono
// allegati (CZI annidati o JPEG).
const TS_JPEG = '1.2.840.10008.1.2.4.50';
let JXR = null;
const jxr = () => (JXR ||= import('./lib/jpegxr.mjs').then((m) => m.default()));
let ZSTD = null;
const zstd = () => (ZSTD ||= import('./lib/fzstd.mjs'));

const PIXEL = { 0: { spp: 1, b: 1 }, 1: { spp: 1, b: 2 }, 3: { spp: 3, b: 1 }, 4: { spp: 3, b: 2 }, 9: { spp: 4, b: 1 } };
async function leggiCzi(f) {
  const dv = async (a, n) => new DataView(await f.slice(a, a + n).arrayBuffer());
  const id = async (a) => { const u = new Uint8Array(await f.slice(a, a + 16).arrayBuffer()); return new TextDecoder().decode(u).replace(/\0+$/, ''); };
  if ((await id(0)) !== 'ZISRAWFILE') throw new Error('non è un file CZI');
  const h = await dv(32, 80), dirPos = Number(h.getBigInt64(52, true)), metaPos = Number(h.getBigInt64(60, true)), attPos = Number(h.getBigInt64(72, true));
  if ((await id(dirPos)) !== 'ZISRAWDIRECTORY') throw new Error('CZI: indice non trovato (file diviso in più parti?)');
  const n = (await dv(dirPos + 32, 4)).getInt32(0, true), lun = Number((await dv(dirPos + 24, 8)).getBigInt64(0, true));
  const D = await dv(dirPos + 32 + 128, Math.max(0, lun - 128)), voci = [];
  let p = 0;
  for (let k = 0; k < n && p + 32 <= D.byteLength; k++) {
    const nd = D.getInt32(p + 28, true), dims = {};
    for (let j = 0; j < nd; j++) { const q = p + 32 + 20 * j; const nome = String.fromCharCode(D.getUint8(q)).trim(); dims[nome] = { start: D.getInt32(q + 4, true), size: D.getInt32(q + 8, true), stored: D.getInt32(q + 16, true) }; }
    voci.push({ pixel: D.getInt32(p + 2, true), pos: Number(D.getBigInt64(p + 6, true)), parte: D.getInt32(p + 14, true), comp: D.getInt32(p + 18, true), dims, lunVoce: 32 + 20 * nd });
    p += 32 + 20 * nd;
  }
  let xml = '';
  if (metaPos > 0) { try { const m = await dv(metaPos + 32, 4); xml = new TextDecoder().decode(new Uint8Array(await f.slice(metaPos + 32 + 256, metaPos + 32 + 256 + m.getInt32(0, true)).arrayBuffer())); } catch {} }
  const allegati = [];
  if (attPos > 0) {
    try {
      const na = (await dv(attPos + 32, 4)).getInt32(0, true), A = new Uint8Array(await f.slice(attPos + 32 + 256, attPos + 32 + 256 + 128 * na).arrayBuffer()), Av = new DataView(A.buffer);
      for (let k = 0; k < na; k++) { const e = 128 * k, txt = (a, b) => new TextDecoder().decode(A.subarray(e + a, e + b)).replace(/\0[\s\S]*$/, ''); allegati.push({ pos: Number(Av.getBigInt64(e + 12, true)), tipo: txt(40, 48), nome: txt(48, 128) }); }
    } catch {}
  }
  return { voci, xml, allegati };
}
// byte di un allegato (segmento ZISRAWATTACH: 32 di intestazione del segmento, 256 di intestazione dell'allegato)
async function datiAllegato(f, a) { const h = new DataView(await f.slice(a.pos + 32, a.pos + 36).arrayBuffer()); const n = h.getInt32(0, true); return f.slice(a.pos + 32 + 256, a.pos + 32 + 256 + n); }

// una tessera decodificata: { bm } a colori, { pix, w, h, spp: 1, bits } per un canale
async function decodificaSubblock(f, v, profondita) {
  const h = new DataView(await f.slice(v.pos + 32, v.pos + 48).arrayBuffer());
  const ms = h.getInt32(0, true), ds = Number(h.getBigInt64(8, true)), a = v.pos + 32 + Math.max(256, 16 + v.lunVoce) + ms;
  let u = new Uint8Array(await f.slice(a, a + ds).arrayBuffer());
  const w = v.dims.X.stored, hh = v.dims.Y.stored, P = PIXEL[v.pixel];
  if (!P) throw new Error(`CZI: tipo di pixel ${v.pixel} non supportato`);
  if (v.comp === 1) { const bm = await createImageBitmap(new Blob([u], { type: 'image/jpeg' })); return P.spp === 1 ? { bm, mono: true } : { bm }; }
  let bgr = true;
  if (v.comp === 4) { const im = (await jxr()).decode(u); u = im.bytes; bgr = !!im.pixelInfo?.bgr; }
  else if (v.comp === 5) u = (await zstd()).decompress(u);
  else if (v.comp === 6) {   // zstd1: intestazione (lunghezza, poi «1 = byte alti e bassi separati»), poi i dati
    const hl = u[0], hilo = hl >= 3 && u[1] === 1 && u[2] === 1; u = (await zstd()).decompress(u.subarray(hl));
    if (hilo) { const n = u.length >> 1, o = new Uint8Array(u.length); for (let i = 0; i < n; i++) { o[2 * i] = u[i]; o[2 * i + 1] = u[n + i]; } u = o; }
  } else if (v.comp !== 0) throw new Error(`CZI: compressione ${v.comp} non supportata`);
  const n = w * hh;
  if (P.spp === 1) { const pix = P.b === 2 ? new Uint16Array(u.buffer.slice(u.byteOffset, u.byteOffset + n * 2)) : u.slice(0, n); return { pix, w, h: hh, spp: 1, bits: P.b * 8 }; }
  const img = new ImageData(w, hh), d = img.data, s16 = P.b === 2 ? new Uint16Array(u.buffer, u.byteOffset, u.length >> 1) : null, sh = Math.max(0, (profondita || 16) - 8);
  for (let i = 0; i < n; i++) {
    const q = i * P.spp; let r, g, b;
    if (s16) { r = s16[q] >> sh; g = s16[q + 1] >> sh; b = s16[q + 2] >> sh; } else { r = u[q]; g = u[q + 1]; b = u[q + 2]; }
    if (bgr) { const t = r; r = b; b = t; }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  return { bm: await createImageBitmap(img) };
}

async function vetriniCzi(f, nome, annidato = false) {
  const C = await leggiCzi(f), xml = C.xml;
  const um = (+(/<Distance Id="X">\s*<Value>([^<]+)</i.exec(xml)?.[1] || 0)) * 1e6 || null;
  const prof = +(/<ComponentBitCount>(\d+)</i.exec(xml)?.[1] || 0) || null;
  // un solo piano focale e un solo tempo (il primo), tutti i canali, tutte le scene
  const voci = C.voci.filter((v) => v.dims.X && v.dims.Y && PIXEL[v.pixel]);
  if (!voci.length) throw new Error('CZI: nessuna immagine leggibile');
  const z0 = Math.min(...voci.map((v) => v.dims.Z?.start ?? 0)), t0 = Math.min(...voci.map((v) => v.dims.T?.start ?? 0));
  const usate = voci.filter((v) => (v.dims.Z?.start ?? 0) === z0 && (v.dims.T?.start ?? 0) === t0);
  const fattore = (v) => Math.max(1, Math.round(v.dims.X.size / Math.max(1, v.dims.X.stored)));
  const canaliId = [...new Set(usate.map((v) => v.dims.C?.start ?? 0))].sort((a, b) => a - b);
  const mono = PIXEL[usate[0].pixel].spp === 1;
  const fattori = [...new Set(usate.map(fattore))].sort((a, b) => a - b);
  const base = usate.filter((v) => fattore(v) === fattori[0]);
  const x0 = Math.min(...base.map((v) => v.dims.X.start)), y0 = Math.min(...base.map((v) => v.dims.Y.start));
  const W = Math.max(...base.map((v) => v.dims.X.start + v.dims.X.size)) - x0, H = Math.max(...base.map((v) => v.dims.Y.start + v.dims.Y.size)) - y0;
  const livelli = fattori.map((fz) => {
    const tutte = usate.filter((v) => fattore(v) === fz), lato = Math.max(64, Math.round(tutte.reduce((s, v) => s + v.dims.X.stored, 0) / tutte.length));
    const ds = fz / fattori[0];
    const L = { W: Math.ceil(W / ds), H: Math.ceil(H / ds), tw: lato, th: lato, ds, tipo: 'VOLUME', voci: new Map(), zPresenti: new Set([0]), zLista: [0], pos: new Map(), dim: new Map(), secchi: new Map() };
    const posti = new Map();
    for (const v of tutte) {
      const c = canaliId.indexOf(v.dims.C?.start ?? 0), px = (v.dims.X.start - x0) / fz * fattori[0], py = (v.dims.Y.start - y0) / fz * fattori[0];
      const kk = `${v.dims.X.start},${v.dims.Y.start},${v.dims.X.stored},${v.dims.Y.stored}`;
      if (!posti.has(kk)) { const a = posti.size; posti.set(kk, a); L.pos.set(`${a},0`, [px, py]); L.dim.set(`${a},0`, [v.dims.X.stored, v.dims.Y.stored]);
        const sk = `${Math.floor(px / lato)},${Math.floor(py / lato)}`; if (!L.secchi.has(sk)) L.secchi.set(sk, []); L.secchi.get(sk).push([a, 0]); }
      const a = posti.get(kk), voce = { f, chiave: `${f.percorso || f.name || nome}|czi|${v.pos}`, W: v.dims.X.stored, H: v.dims.Y.stored, tw: v.dims.X.stored, th: v.dims.Y.stored, n: 1, spp: mono ? 1 : 3, bits: 8, piani: 0, tipo: 'VOLUME', ts: TS_JPEG, tesseraPropria: () => decodificaSubblock(f, v, prof) };
      if (!L.voci.has(`${a},0,0,${c}`)) L.voci.set(`${a},0,0,${c}`, [voce, 0]);
    }
    const marg = Math.ceil(Math.max(...[...L.dim.values()].map((d) => Math.max(d[0], d[1]))) / lato) + 1;
    L.trova = (xa, ya, w, h) => { const o = []; for (let by = Math.floor(ya / lato) - marg; by <= Math.floor((ya + h) / lato); by++) for (let bx = Math.floor(xa / lato) - marg; bx <= Math.floor((xa + w) / lato); bx++) for (const t of L.secchi.get(`${bx},${by}`) || []) { const p = L.pos.get(`${t[0]},0`), d = L.dim.get(`${t[0]},0`); if (p[0] < xa + w && p[0] + d[0] > xa && p[1] < ya + h && p[1] + d[1] > ya) o.push(t); } return o; };
    return L;
  });
  const nomiC = [...xml.matchAll(/<Channel\b[^>]*Name="([^"]*)"/gi)].map((m) => m[1]);
  const coloriC = [...xml.matchAll(/<Channel\b[^>]*>[\s\S]*?<Color>#?([0-9A-F]{8}|[0-9A-F]{6})<\/Color>/gi)].map((m) => { const h = m[1].slice(-6); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); });
  const COL = [[40, 110, 255], [0, 255, 0], [255, 40, 40], [255, 0, 255], [0, 255, 255], [255, 255, 0]];
  const canali = canaliId.map((c, k) => ({ id: String(c + 1), nome: nomiC[k] || '', onda: 0, colore: mono ? (canaliId.length === 1 ? [255, 255, 255] : coloriC[k] || COL[k % COL.length]) : null, acceso: true, guadagno: 1, max: null }));
  // etichetta e panoramica: allegati «Label» e «SlidePreview» (CZI annidati) o JPEG
  const accessoria = async (re) => {
    if (annidato) return null;
    const a = C.allegati.find((x) => re.test(x.nome)); if (!a) return null;
    try {
      const b = await datiAllegato(f, a);
      if (/JPG|JPEG/i.test(a.tipo)) { const u = new Uint8Array(await b.arrayBuffer()), bm = await createImageBitmap(new Blob([u], { type: 'image/jpeg' })); return { W: bm.width, H: bm.height, tw: bm.width, th: bm.height, n: 1, spp: 3, bits: 8, tipo: 'LABEL', chiave: `${f.percorso || f.name}|att|${a.pos}`, tesseraPropria: async () => ({ bm }) }; }
      if (/CZI/i.test(a.tipo)) { const [Vx] = await vetriniCzi(b, a.nome, true); const L = Vx.livelli[0]; const r = L.voci.get('0,0,0,0'); if (!r) return null; const v = r[0]; return { W: v.W, H: v.H, tw: v.W, th: v.H, n: 1, spp: 3, bits: 8, tipo: 'LABEL', chiave: `${f.percorso || f.name}|att|${a.pos}`, tesseraPropria: v.tesseraPropria }; }
    } catch (e) { console.warn('allegato CZI', a.nome, e.message); }
    return null;
  };
  return [{ W, H, sp: um ? [um / 1000, um / 1000] : null, serie: `${f.percorso || f.name || nome}|czi`, livelli, piani: [0], canali, mono, bitsSt: mono ? 16 : 8,
    descrizione: String(nome || f.name || 'Vetrino').replace(/\.czi$/i, ''), formato: 'Zeiss CZI', etichetta: await accessoria(/^label$/i), panoramica: await accessoria(/^slidepreview$/i), studio: `${f.percorso || f.name || nome}|czi` }];
}
export const czi = (f) => vetriniCzi(f, f.name);

// ------------------------------------------------------------------------------------------------ Olympus VSI
// nome.vsi + cartella _nome_/stackNNNN/frame_t.ets: ogni ETS è un'immagine a tessere con la sua piramide (intestazione «SIS»,
// poi «ETS» con tipo di pixel, compressione e dimensione delle tessere, poi l'elenco delle tessere con le coordinate e il
// livello). L'immagine principale è l'ETS più grande; uno più piccolo, se c'è, fa da panoramica.
const TS_DA_ETS = { 0: 'raw', 2: TS_JPEG, 3: '1.2.840.10008.1.2.4.90', 5: '1.2.840.10008.1.2.4.70', 8: 'png', 9: 'bmp' };
async function leggiEts(f) {
  const h = new DataView(await f.slice(0, 64).arrayBuffer());
  if (String.fromCharCode(h.getUint8(0), h.getUint8(1), h.getUint8(2)) !== 'SIS') throw new Error('ETS non valido');
  const nd = h.getInt32(12, true), eo = Number(h.getBigInt64(16, true)), to = Number(h.getBigInt64(32, true)), nt = h.getInt32(40, true);
  const e = new DataView(await f.slice(eo, eo + 228).arrayBuffer());
  if (String.fromCharCode(e.getUint8(0), e.getUint8(1), e.getUint8(2)) !== 'ETS') throw new Error('ETS: intestazione non trovata');
  const E = { nd, pixel: e.getInt32(8, true), sizeC: e.getInt32(12, true), colore: e.getInt32(16, true), comp: e.getInt32(20, true), tw: e.getInt32(28, true), th: e.getInt32(32, true), piramide: e.getInt32(152, true) !== 0 };
  const lun = 4 + 4 * nd + 8 + 4 + 4, T = new DataView(await f.slice(to, to + lun * nt).arrayBuffer());
  E.tessere = [];
  for (let k = 0; k < nt; k++) { const p = k * lun, c = []; for (let j = 0; j < nd; j++) c.push(T.getInt32(p + 4 + 4 * j, true)); E.tessere.push({ c, off: Number(T.getBigInt64(p + 4 + 4 * nd, true)), n: T.getInt32(p + 12 + 4 * nd, true) }); }
  return E;
}
async function vetriniVsi(f, files) {
  const nome = f.name.replace(/\.vsi$/i, ''), rel = (x) => x.webkitRelativePath || x.name;
  let ets = files.filter((x) => /\.ets$/i.test(x.name) && rel(x).includes(`_${nome}_/`));
  if (!ets.length) ets = files.filter((x) => /\.ets$/i.test(x.name));
  if (!ets.length) throw new Error('VSI: servono anche i file .ets (cartella «_' + nome + '_»): apri la cartella che contiene il file .vsi');
  const lette = [];
  for (const x of ets) { try { lette.push({ f: x, E: await leggiEts(x) }); } catch (e) { console.warn('ETS', rel(x), e.message); } }
  if (!lette.length) throw new Error('VSI: file ETS non leggibili');
  const dimEts = ({ E }) => { const l0 = E.tessere.filter((t) => (E.piramide ? t.c[E.nd - 1] : 0) === 0); return (Math.max(...l0.map((t) => t.c[0])) + 1) * E.tw * (Math.max(...l0.map((t) => t.c[1])) + 1) * E.th; };
  lette.sort((a, b) => dimEts(b) - dimEts(a));
  const costruisci = ({ f: fe, E }, chiave) => {
    const liv = new Map(), spp = E.sizeC >= 3 ? 3 : 1, b16 = [3, 4].includes(E.pixel);
    for (const [k, t] of E.tessere.entries()) { const l = E.piramide ? t.c[E.nd - 1] : 0, ch = E.nd >= 5 ? t.c[3] : 0, z = E.nd >= 4 && E.nd !== 4 ? t.c[2] : 0; if (z !== 0) continue; if (!liv.has(l)) liv.set(l, []); liv.get(l).push([t, k, ch]); }
    const ts = TS_DA_ETS[E.comp]; if (!ts) throw new Error(`VSI: compressione ${E.comp} non supportata`);
    const livelli = [...liv.keys()].sort((a, b) => a - b).map((l) => {
      const L = { tw: E.tw, th: E.th, ds: 2 ** l, tipo: 'VOLUME', voci: new Map(), zPresenti: new Set([0]), zLista: [0] };
      const v = { f: fe, chiave: `${chiave}|${l}`, tw: E.tw, th: E.th, spp, bits: b16 ? 16 : 8, bitsSt: b16 ? 16 : 8, conSegno: false, piani: 0, tipo: 'VOLUME', incapsulato: false, foto: spp === 3 ? 'RGB' : 'MONOCHROME2', ts: ts === 'raw' ? '1.2.840.10008.1.2.1' : ts };
      const elenco = liv.get(l);
      v.n = elenco.length;
      v.byteTessera = async (k) => { const t = elenco[k][0]; return new Uint8Array(await fe.slice(t.off, t.off + t.n).arrayBuffer()); };
      let mx = 0, my = 0;
      elenco.forEach(([t, , ch], k) => { L.voci.set(`${t.c[0]},${t.c[1]},0,${ch}`, [v, k]); mx = Math.max(mx, t.c[0] + 1); my = Math.max(my, t.c[1] + 1); });
      L.W = mx * E.tw; L.H = my * E.th; return L;
    });
    return livelli;
  };
  const livelli = costruisci(lette[0], `${f.name}|vsi|0`), L0 = livelli[0];
  // livello l = metà del precedente (2^l): le dimensioni non si ricavano dalle tessere, che ai livelli piccoli sono quasi
  // vuote (una tessera da 512 per un'immagine di 190 pixel), altrimenti l'immagine finisce schiacciata in un angolo
  for (const L of livelli) { L.W = Math.ceil(L0.W / L.ds); L.H = Math.ceil(L0.H / L.ds); }
  const mono = lette[0].E.sizeC < 3, nc = mono ? Math.max(1, lette[0].E.sizeC) : 1;
  const COL = [[40, 110, 255], [0, 255, 0], [255, 40, 40], [255, 0, 255]];
  const canali = Array.from({ length: nc }, (_, k) => ({ id: String(k + 1), nome: '', onda: 0, colore: mono ? (nc === 1 ? [255, 255, 255] : COL[k % 4]) : null, acceso: true, guadagno: 1, max: null }));
  let panoramica = null;
  if (lette[1]) { try { const Lp = costruisci(lette[1], `${f.name}|vsi|1`).at(-1); const [v] = Lp.voci.values().next().value; if (Lp.voci.size === 1) panoramica = { ...v, W: Lp.W, H: Lp.H, n: 1, tipo: 'LABEL' }; } catch {} }
  const um = await micronVsi(f).catch(() => null);
  return [{ W: L0.W, H: L0.H, sp: um ? [um / 1000, um / 1000] : null, serie: `${f.percorso || f.name}|vsi`, livelli, piani: [0], canali, mono, bitsSt: 8,
    descrizione: nome, formato: 'Olympus VSI', etichetta: null, panoramica, studio: `${f.percorso || f.name}|vsi` }];
}
// dimensione del pixel dal file .vsi: nell'albero dei metadati (formato cellSens, come lo legge Bio-Formats) il campo 2019
// (scala del fotogramma, µm per pixel in x e y) è un array di due double: tipo 0x104, id 2019, lunghezza 16. Ce n'è uno per
// immagine (panoramica, vetrino): il più piccolo è quello dell'immagine a piena risoluzione. Sulla piattaforma il .vsi è un
// segnaposto (prepara_vetrino.py) che riporta solo «um=<valore>»
async function micronVsi(f) {
  if (!f.size || f.size > 64 << 20) return null;
  const b = new Uint8Array(await f.arrayBuffer());
  const t = /\bum=([\d.]+)/.exec(new TextDecoder().decode(b.subarray(0, 256))); if (t && f.size <= 256) return +t[1] || null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let um = null;
  for (let i = 0; i + 32 <= b.length; i++) {
    if (b[i] !== 0x04 || b[i + 1] !== 0x01 || dv.getUint32(i, true) !== 0x104 || dv.getUint32(i + 4, true) !== 2019 || dv.getUint32(i + 12, true) !== 16) continue;
    const x = dv.getFloat64(i + 16, true), y = dv.getFloat64(i + 24, true);
    if (x > 0.01 && x < 1000 && Math.abs(y / x - 1) < 0.05 && (um === null || x < um)) um = x;
  }
  return um;
}
export const vsi = (f, files) => vetriniVsi(f, files);

// ------------------------------------------------------------------------------------------------ Philips iSyntax
// Compressione a ondine (wavelet) propria: la decodifica libisyntax (BSD-2) compilata in WebAssembly, in un web worker.
async function vetriniIsyntax(f) {
  const w = new Worker(new URL('./vetrini-isyntax-worker.js', import.meta.url), { type: 'module' });
  let n = 0; const attesa = new Map();
  w.onmessage = (e) => { const q = attesa.get(e.data.id); if (!q) return; attesa.delete(e.data.id); if (e.data.errore) q.ko(new Error(e.data.errore)); else q.ok(e.data); };
  w.onerror = (e) => { for (const q of attesa.values()) q.ko(new Error('lettore iSyntax non avviato: ' + (e.message || ''))); attesa.clear(); };
  const chiedi = (m) => new Promise((ok, ko) => { const id = ++n; attesa.set(id, { ok, ko }); w.postMessage({ ...m, id }); });
  // una tessera alla volta: libisyntax lavora su un solo filo; le richieste si mettono in coda
  let coda = Promise.resolve();
  const tessera = (l, x, y) => { const p = coda.then(() => chiedi({ tipo: 'tessera', l, x, y })); coda = p.catch(() => {}); return p; };
  const { info } = await chiedi({ tipo: 'apri', ...(f.url && !f.base ? { url: new URL(f.url, location.href).href } : { file: f }) });
  const { tw, th } = info, L0 = info.livelli[0];
  const livelli = info.livelli.map((Li, l) => {
    const L = { W: Li.w, H: Li.h, tw, th, ds: L0.w / Li.w, tipo: 'VOLUME', voci: new Map(), zPresenti: new Set([0]), zLista: [0] };
    const v = { f, chiave: `${f.percorso || f.name}|${f.size}|isyntax|${l}`, tw, th, n: Li.tx * Li.ty, spp: 3, bits: 8, piani: 0, tipo: 'VOLUME',
      tesseraPropria: async (k) => { const { b } = await tessera(l, k % Li.tx, Math.floor(k / Li.tx)); return { bm: await createImageBitmap(new ImageData(new Uint8ClampedArray(b.buffer, b.byteOffset, tw * th * 4), tw, th)) }; } };
    for (let k = 0; k < v.n; k++) L.voci.set(`${k % Li.tx},${Math.floor(k / Li.tx)},0,0`, [v, k]);
    return L;
  });
  const accessoria = async (u, nome) => { if (!u) return null; try { const bm = await createImageBitmap(new Blob([u], { type: 'image/jpeg' })); return { W: bm.width, H: bm.height, tw: bm.width, th: bm.height, n: 1, spp: 3, bits: 8, tipo: 'LABEL', chiave: `${f.percorso || f.name}|isyntax|${nome}`, tesseraPropria: async () => ({ bm }) }; } catch { return null; } };
  return [{ W: L0.w, H: L0.h, sp: info.mpp > 0 ? [info.mpp / 1000, info.mpp / 1000] : null, serie: `${f.percorso || f.name}|isyntax`, livelli, piani: [0],
    canali: [{ id: '1', nome: '', onda: 0, colore: null, acceso: true, guadagno: 1, max: null }], mono: false, bitsSt: 8,
    descrizione: f.name.replace(/\.i?syntax$/i, ''), formato: 'Philips iSyntax', etichetta: await accessoria(info.etichetta, 'etichetta'), panoramica: await accessoria(info.panoramica, 'panoramica'), studio: `${f.percorso || f.name}|isyntax` }];
}
export const isyntax = (f) => vetriniIsyntax(f);
