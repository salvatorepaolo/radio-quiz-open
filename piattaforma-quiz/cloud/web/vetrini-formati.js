// vetrini-formati.js — vetrini in formati diversi dal DICOM, letti nel browser senza mandare nulla in rete.
// Restituisce la stessa struttura di preparaVetrini (vetrini.js): livelli con le tessere, piani, canali, etichetta e
// panoramica. Ogni tessera è un oggetto «voce» con byteTessera(k): i byte pronti per i decodificatori già presenti
// (JPEG, JPEG 2000, non compressi, WebP, JPEG XL).
//
// Famiglia TIFF: Aperio SVS, TIFF piramidale generico e OME-TIFF, Hamamatsu NDPI, Philips TIFF, Leica SCN, Ventana BIF,
// Huron, Trestle, QPTIFF. Le compressioni LZW, Deflate e PackBits si decomprimono qui; le JPEG con tabelle condivise si
// ricompongono; le JPEG RGB (Aperio) ricevono il marcatore Adobe che dice al decodificatore di non convertire il colore.
// NDPI: ogni livello è un'unica JPEG enorme con marcatori di riavvio; le tessere si ritagliano senza ricomprimere.

const TS_JPEG = '1.2.840.10008.1.2.4.50', TS_J2K = '1.2.840.10008.1.2.4.90', TS_NATIVI = '1.2.840.10008.1.2.1', TS_JXL = '1.2.840.10008.1.2.4.110', TS_WEBP = 'webp';
const ESTENSIONI = /\.(svs|tif|tiff|ndpi|scn|bif|qptiff|ptif|vtif|btf|tf2|tf8)$/i;

// ------------------------------------------------------------------------------------------------ riconoscimento
export async function formatoVetrino(f) {
  const nome = f.webkitRelativePath || f.name || '';
  let t; try { t = new Uint8Array(await f.slice(0, 8).arrayBuffer()); } catch { return null; }
  const tiff = (t[0] === 0x49 && t[1] === 0x49 && (t[2] === 42 || t[2] === 43) && t[3] === 0) || (t[0] === 0x4d && t[1] === 0x4d && t[2] === 0 && (t[3] === 42 || t[3] === 43));
  if (/\.vsi$/i.test(nome)) return 'vsi';   // anche il .vsi è un TIFF, ma le immagini stanno nei file .ets
  if (tiff) return 'tiff';
  if (/\.mrxs$/i.test(nome)) return 'mrxs';
  if (/(^|\/)(Slidedat\.ini|Index\.dat|Data\d{4}\.dat)$/i.test(nome)) return 'mrxs-parte';
  if (/\.czi$/i.test(nome) && String.fromCharCode(...t.slice(0, 8)) === 'ZISRAWFI') return 'czi';
  if (/\.vsi$/i.test(nome)) return 'vsi';
  if (/\.ets$/i.test(nome)) return 'vsi-parte';
  if (/\.i?syntax$/i.test(nome)) return 'isyntax';
  if (ESTENSIONI.test(nome)) return 'tiff';
  return null;
}

// ------------------------------------------------------------------------------------------------ lettura TIFF
const TIPI = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4, 16: 8, 17: 8, 18: 8 };
async function leggiTiff(f) {
  const h = new DataView(await f.slice(0, 16).arrayBuffer());
  const le = h.getUint16(0) === 0x4949, big = h.getUint16(2, le) === 43;
  const T = { f, le, big, ifd: [] };
  // le intestazioni si leggono a pezzi da 256 kB (molti tag in poche letture)
  const cache = new Map();
  T.leggi = async (a, n) => {
    if (n > 1 << 18) return new DataView(await f.slice(a, a + n).arrayBuffer());
    const b0 = Math.floor(a / (1 << 18)) * (1 << 18);
    if (a + n <= b0 + (1 << 18) + (1 << 16)) {
      if (!cache.has(b0)) cache.set(b0, f.slice(b0, Math.min(f.size, b0 + (1 << 18) + (1 << 16))).arrayBuffer());
      const ab = await cache.get(b0); if (a - b0 + n <= ab.byteLength) return new DataView(ab, a - b0, n);
    }
    return new DataView(await f.slice(a, a + n).arrayBuffer());
  };
  let off = big ? Number(h.getBigUint64(8, le)) : h.getUint32(4, le);
  const viste = new Set();
  while (off && off < f.size && !viste.has(off) && T.ifd.length < 2000) { viste.add(off); const d = await leggiIfd(T, off); T.ifd.push(d); off = d.prossimo; }
  // OME-TIFF moderni: i livelli ridotti sono nei SubIFD (tag 330) dell'immagine piena
  for (const d of T.ifd) if (d.tag[330]) { d.sub = []; for (const o of d.tag[330]) d.sub.push(await leggiIfd(T, o)); }
  return T;
}
async function leggiIfd(T, off) {
  const { le, big } = T, nb = big ? 8 : 2, eb = big ? 20 : 12;
  const c = await T.leggi(off, nb), n = big ? Number(c.getBigUint64(0, le)) : c.getUint16(0, le);
  const d = await T.leggi(off + nb, n * eb + (big ? 8 : 4)), tag = {};
  for (let i = 0; i < n; i++) {
    const p = i * eb, id = d.getUint16(p, le), ty = d.getUint16(p + 2, le), cnt = big ? Number(d.getBigUint64(p + 4, le)) : d.getUint32(p + 4, le);
    const sz = (TIPI[ty] || 1) * cnt, dentro = sz <= (big ? 8 : 4);
    const voff = dentro ? null : big ? Number(d.getBigUint64(p + 12, le)) : d.getUint32(p + 8, le);
    // gli array grandi (posizioni delle tessere) si leggono solo quando servono
    if (!dentro && sz > 1 << 16) { tag[id] = { tardi: true, ty, cnt, voff }; continue; }
    const v = dentro ? new DataView(d.buffer, d.byteOffset + p + (big ? 12 : 8), big ? 8 : 4) : await T.leggi(voff, sz);
    tag[id] = valori(v, ty, cnt, le);
  }
  const q = n * eb;
  return { off, tag, prossimo: big ? Number(d.getBigUint64(q, le)) : d.getUint32(q, le) };
}
function valori(v, ty, cnt, le) {
  if (ty === 2) { let s = ''; for (let i = 0; i < cnt; i++) { const c = v.getUint8(i); if (!c) break; s += String.fromCharCode(c); } try { return decodeURIComponent(escape(s)); } catch { return s; } }
  const o = [];
  for (let i = 0; i < cnt; i++) {
    if (ty === 1 || ty === 7 || ty === 6) o.push(ty === 6 ? v.getInt8(i) : v.getUint8(i));
    else if (ty === 3) o.push(v.getUint16(i * 2, le)); else if (ty === 8) o.push(v.getInt16(i * 2, le));
    else if (ty === 4 || ty === 13) o.push(v.getUint32(i * 4, le)); else if (ty === 9) o.push(v.getInt32(i * 4, le));
    else if (ty === 5) o.push(v.getUint32(i * 8, le) / (v.getUint32(i * 8 + 4, le) || 1)); else if (ty === 10) o.push(v.getInt32(i * 8, le) / (v.getInt32(i * 8 + 4, le) || 1));
    else if (ty === 11) o.push(v.getFloat32(i * 4, le)); else if (ty === 12) o.push(v.getFloat64(i * 8, le));
    else if (ty === 16 || ty === 18) o.push(Number(v.getBigUint64(i * 8, le))); else if (ty === 17) o.push(Number(v.getBigInt64(i * 8, le)));
  }
  return o;
}
async function tag(T, d, id) {
  const x = d.tag[id]; if (!x?.tardi) return x;
  const v = await T.leggi(x.voff, (TIPI[x.ty] || 1) * x.cnt); d.tag[id] = valori(v, x.ty, x.cnt, T.le); return d.tag[id];
}
const uno = (d, id, def = 0) => (Array.isArray(d.tag[id]) ? d.tag[id][0] : d.tag[id]) ?? def;
const testoTag = (d, id) => (typeof d.tag[id] === 'string' ? d.tag[id] : Array.isArray(d.tag[id]) && d.tag[id].every((x) => x < 256) ? new TextDecoder().decode(new Uint8Array(d.tag[id])) : '');

// ------------------------------------------------------------------------------------------------ JPEG
function segmentiJpeg(u) {   // marcatori fino all'inizio dei dati (SOS compreso)
  const s = []; let i = 2;
  while (i + 4 <= u.length) {
    if (u[i] !== 0xff) { i++; continue; }
    const m = u[i + 1]; if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    if (m === 0xd9) break;
    const n = (u[i + 2] << 8) | u[i + 3]; s.push({ m, a: i, b: i + 2 + n });
    if (m === 0xda) break; i += 2 + n;
  }
  return s;
}
const concat = (l) => { const n = l.reduce((t, x) => t + x.length, 0), o = new Uint8Array(n); let p = 0; for (const x of l) { o.set(x, p); p += x.length; } return o; };
const ADOBE_RGB = new Uint8Array([0xff, 0xee, 0, 14, 0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, 0]);   // APP14 «Adobe», trasformazione 0 = RGB
// tessera JPEG di un TIFF: tabelle condivise (tag 347) davanti, marcatore Adobe se i dati sono RGB e non YCbCr
function jpegCompleta(b, tabelle, rgb) {
  const parti = [new Uint8Array([0xff, 0xd8])];
  if (rgb && !segmentiJpeg(b).some((s) => s.m === 0xee)) parti.push(ADOBE_RGB);
  if (tabelle?.length > 4) parti.push(tabelle.subarray(2, tabelle.length - 2));
  parti.push(b.subarray(b[0] === 0xff && b[1] === 0xd8 ? 2 : 0));
  return concat(parti);
}

// ------------------------------------------------------------------------------------------------ LZW, PackBits, Deflate
function lzw(u, atteso) {
  const out = new Uint8Array(atteso || u.length * 4); let o = 0;
  let dict = [], bit = 9, pos = 0, prec = null;
  const leggi = () => { let v = 0; for (let k = 0; k < bit; k++) { const p = pos + k; v = (v << 1) | ((u[p >> 3] >> (7 - (p & 7))) & 1); } pos += bit; return v; };
  const scrivi = (s) => { if (o + s.length > out.length) return false; out.set(s, o); o += s.length; return true; };
  const azzera = () => { dict = []; for (let i = 0; i < 256; i++) dict[i] = new Uint8Array([i]); dict[256] = dict[257] = null; bit = 9; };
  azzera();
  while (pos + bit <= u.length * 8) {
    const c = leggi();
    if (c === 257) break;
    if (c === 256) { azzera(); prec = null; continue; }
    let s;
    if (c < dict.length && dict[c]) s = dict[c]; else if (prec) { s = new Uint8Array(prec.length + 1); s.set(prec); s[prec.length] = prec[0]; } else break;
    if (!scrivi(s)) break;
    if (prec) { const n = new Uint8Array(prec.length + 1); n.set(prec); n[prec.length] = s[0]; dict.push(n); }
    prec = s;
    if (dict.length + 1 >= (1 << bit) && bit < 12) bit++;
  }
  return out.subarray(0, o);
}
function packbits(u, atteso) {
  const out = new Uint8Array(atteso); let i = 0, o = 0;
  while (i < u.length && o < atteso) { const n = (u[i] << 24) >> 24; i++; if (n >= 0) { out.set(u.subarray(i, i + n + 1), o); o += n + 1; i += n + 1; } else if (n !== -128) { out.fill(u[i], o, o - n + 1); o += -n + 1; i++; } }
  return out;
}
async function deflate(u) {
  const ds = new DecompressionStream('deflate'), w = ds.writable.getWriter(); w.write(u); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
function predittore(u, w, h, spp, bits) {   // predittore 2: differenze orizzontali
  if (bits === 16) { const v = new Uint16Array(u.buffer, u.byteOffset, u.length >> 1); for (let y = 0; y < h; y++) for (let x = spp; x < w * spp; x++) v[y * w * spp + x] += v[y * w * spp + x - spp]; return u; }
  for (let y = 0; y < h; y++) for (let x = spp; x < w * spp; x++) u[y * w * spp + x] = (u[y * w * spp + x] + u[y * w * spp + x - spp]) & 255;
  return u;
}

// ------------------------------------------------------------------------------------------------ un IFD → livello
async function livelloTiff(T, d, chiave) {
  const W = uno(d, 256), H = uno(d, 257), tiled = !!d.tag[322];
  const comp = uno(d, 259, 1), foto = uno(d, 262, 2), spp = uno(d, 277, 1), bits = uno(d, 258, 8), pred = uno(d, 317, 1);
  const tw = tiled ? uno(d, 322) : W, th = tiled ? uno(d, 323) : Math.min(H, uno(d, 278, H));
  const off = (await tag(T, d, tiled ? 324 : 273)) || [], cnt = (await tag(T, d, tiled ? 325 : 279)) || [];
  const tabelle = d.tag[347] ? new Uint8Array(d.tag[347]) : null;
  const v = { f: T.f, chiave, W, H, tw, th, n: off.length, spp: spp >= 3 ? 3 : 1, bits: bits > 8 ? 16 : 8, bitsSt: bits, conSegno: false, piani: 0, pos: null, nz: 1, nc: 1, cammini: [], tipo: 'VOLUME', incapsulato: false };
  v.indice = off.map((o, i) => [o, o + (cnt[i] || 0)]);
  const leggi = async (k) => { const [a, b] = v.indice[k]; return b > a ? new Uint8Array(await T.f.slice(a, b).arrayBuffer()) : new Uint8Array(0); };
  const lato = tw * th * v.spp * (v.bits / 8);
  const pieno = (u) => { if (u.length >= lato) return u; const o = new Uint8Array(lato); o.set(u); return o; };   // ultima striscia più corta
  const nativi = (u) => { if (spp > 3) { const n = tw * th, o = new Uint8Array(n * 3); for (let i = 0; i < n; i++) { o[i * 3] = u[i * spp]; o[i * 3 + 1] = u[i * spp + 1]; o[i * 3 + 2] = u[i * spp + 2]; } return o; } return u; };
  const sppLetto = spp;
  if (comp === 7) {
    v.ts = TS_JPEG; v.foto = 'RGB';
    // JPEG RGB (foto 2) o YCbCr (foto 6, il caso normale)
    v.byteTessera = async (k) => jpegCompleta(await leggi(k), tabelle, foto === 2 && spp === 3);
  } else if (comp === 33003 || comp === 33005 || comp === 34712 || comp === 33004) {
    v.ts = TS_J2K; v.foto = 'RGB'; v.byteTessera = leggi;   // 33003 (YCbCr): la trasformazione del colore la fa già il decodificatore (MCT nel flusso)
  } else if (comp === 50001 || comp === 34927) { v.ts = TS_WEBP; v.foto = 'RGB'; v.byteTessera = leggi; }
  else if (comp === 50002 || comp === 52546) { v.ts = TS_JXL; v.foto = 'RGB'; v.byteTessera = leggi; }
  else if ([1, 5, 8, 32946, 32773].includes(comp)) {
    v.ts = TS_NATIVI; v.foto = foto === 6 ? 'YBR_FULL' : 'RGB';
    const pixLato = tw * th * sppLetto * (v.bits / 8);
    v.byteTessera = async (k) => {
      let u = await leggi(k);
      if (comp === 5) u = lzw(u, pixLato); else if (comp === 8 || comp === 32946) u = await deflate(u); else if (comp === 32773) u = packbits(u, pixLato);
      if (u.length < pixLato) { const o = new Uint8Array(pixLato); o.set(u); u = o; }
      if (pred === 2) predittore(u, tw, th, sppLetto, v.bits);
      if (foto === 0 && v.bits === 8) for (let i = 0; i < u.length; i++) u[i] = 255 - u[i];   // bianco = 0
      return pieno(nativi(u));
    };
    if (v.bits === 16) v.byteTessera = ((g) => async (k) => { const u = await g(k); return T.le ? u : (() => { const o = new Uint8Array(u.length); for (let i = 0; i < u.length; i += 2) { o[i] = u[i + 1]; o[i + 1] = u[i]; } return o; })(); })(v.byteTessera);
  } else throw new Error(`compressione TIFF ${comp} non supportata`);
  return v;
}

// NDPI: livello = una JPEG con marcatori di riavvio (posizioni nel tag 65426). Tessere larghe un intervallo di riavvio e alte
// circa quanto larghe: le righe di MCU si copiano una dopo l'altra rinumerando i marcatori RST, senza ricomprimere.
async function livelloNdpi(T, d, chiave) {
  const W = uno(d, 256), H = uno(d, 257), a0 = uno(d, 273), lun = uno(d, 279);
  const mcu = await tag(T, d, 65426);
  const testa = new Uint8Array(await T.f.slice(a0, a0 + Math.min(lun, 1 << 16)).arrayBuffer());
  const seg = segmentiJpeg(testa), sof = seg.find((s) => s.m >= 0xc0 && s.m <= 0xc3), sos = seg.find((s) => s.m === 0xda), dri = seg.find((s) => s.m === 0xdd);
  const v = { f: T.f, chiave, W, H, spp: 3, bits: 8, bitsSt: 8, conSegno: false, piani: 0, pos: null, nz: 1, nc: 1, cammini: [], tipo: 'VOLUME', incapsulato: false, ts: TS_JPEG, foto: 'RGB' };
  const comps = testa[sof.a + 9]; if (comps === 1) v.spp = 1;
  let hmax = 1, vmax = 1; for (let c = 0; c < comps; c++) { const s = testa[sof.a + 11 + c * 3]; hmax = Math.max(hmax, s >> 4); vmax = Math.max(vmax, s & 15); }
  const mw = 8 * hmax, mh = 8 * vmax, ri = dri ? (testa[dri.a + 4] << 8) | testa[dri.a + 5] : 0;
  const mcuRiga = Math.ceil(W / mw), perRiga = ri ? mcuRiga / ri : 0;
  if (!ri || !mcu?.length || !Number.isInteger(perRiga)) {   // senza riavvii (livelli piccoli): una tessera sola
    Object.assign(v, { tw: W, th: H, n: 1 }); v.indice = [[a0, a0 + lun]];
    v.byteTessera = async () => new Uint8Array(await T.f.slice(a0, a0 + lun).arrayBuffer());
    if (W * H > 64e6) throw new Error('livello NDPI senza marcatori di riavvio troppo grande');
    return v;
  }
  const tw = ri * mw, righe = Math.max(1, Math.round(Math.min(tw, 1024) / mh)), th = righe * mh;
  const nx = perRiga, righeMcu = Math.ceil(H / mh), ny = Math.ceil(righeMcu / righe);
  Object.assign(v, { tw, th, n: nx * ny });
  const fine = (i) => (i + 1 < mcu.length ? mcu[i + 1] - 2 : lun - 2);   // ogni intervallo termina con RSTm (o con EOI)
  const intesta = (h) => {   // intestazione con le dimensioni della tessera
    const t = new Uint8Array(testa.subarray(0, sos.b));
    t[sof.a + 5] = h >> 8; t[sof.a + 6] = h & 255; t[sof.a + 7] = tw >> 8; t[sof.a + 8] = tw & 255;
    return t;
  };
  v.indice = Array.from({ length: v.n }, (_, k) => { const x = k % nx, y = Math.floor(k / nx), i = y * righe * nx + x; return [a0 + mcu[i], a0 + fine(Math.min(mcu.length - 1, i + (righe - 1) * nx))]; });
  v.byteTessera = async (k) => {
    const x = k % nx, y = Math.floor(k / nx), r0 = y * righe, r1 = Math.min(righeMcu, r0 + righe), parti = [intesta((r1 - r0) * mh)];
    // un'unica lettura dal primo all'ultimo intervallo della tessera, poi si prendono i pezzi delle sue righe
    const i0 = r0 * nx + x, iU = (r1 - 1) * nx + x, A = a0 + mcu[i0], B = a0 + fine(iU) + 2;
    const blocco = (r1 - r0) <= 1 || (B - A) < 16 << 20 ? new Uint8Array(await T.f.slice(A, B).arrayBuffer()) : null;
    for (let r = r0; r < r1; r++) {
      const i = r * nx + x, a = a0 + mcu[i], b = a0 + fine(i);
      parti.push(blocco ? blocco.subarray(a - A, b - A) : new Uint8Array(await T.f.slice(a, b).arrayBuffer()));
      parti.push(new Uint8Array(r + 1 < r1 ? [0xff, 0xd0 + ((r - r0) & 7)] : [0xff, 0xd9]));
    }
    return concat(parti);
  };
  return v;
}

// ------------------------------------------------------------------------------------------------ vetrino TIFF
const rapporto = (d) => uno(d, 256) / Math.max(1, uno(d, 257));
function micronPerPixel(T, d0, desc, W) {
  let m = /MPP\s*=\s*([\d.]+)/i.exec(desc); if (m) return +m[1];                                         // Aperio
  m = /DICOM_PIXEL_SPACING"[^>]*>\s*(?:&quot;|")?\s*([\d.eE+-]+)/i.exec(desc); if (m) return +m[1] * 1000;   // Philips (mm, tra &quot;)
  m = /PhysicalSizeX="([\d.eE+-]+)"(?:\s+PhysicalSizeXUnit="([^"]+)")?/i.exec(desc);                       // OME-TIFF
  if (m) { const u = m[2] || 'µm'; return +m[1] * ({ nm: 1e-3, mm: 1e3, cm: 1e4, m: 1e6 }[u] || 1); }
  m = /<view[^>]*sizeX="(\d+)"[^>]*>/i.exec(desc); const px = /<pixels[^>]*sizeX="(\d+)"/i.exec(desc);   // Leica SCN (nm)
  if (m && px) return (+m[1] / +px[1]) / 1000;
  const xmp = testoTag(d0, 700); m = /ScanRes="([\d.]+)"/i.exec(xmp); if (m) return +m[1];               // Ventana BIF
  const x = uno(d0, 282), u = uno(d0, 296, 2);
  if (x > 0 && u === 3) return 1e4 / x; if (x > 0 && u === 2 && x > 1000) return 25400 / x;               // pixel per cm / per pollice
  return null;
}
// Leica SCN: XML nell'IFD 0 con le immagini della collezione (panoramica del vetrino e una o più zone di tessuto), i loro
// IFD per livello e canale, la dimensione reale in nm e i canali di fluorescenza con nome e colore
function leggiScn(xml) {
  const coll = /<collection[^>]*sizeX="(\d+)"/i.exec(xml)?.[1];
  const blocchi = [...xml.matchAll(/<image\b[\s\S]*?<\/image>/gi)].map((m) => {
    const b = m[0], dim = [...b.matchAll(/<dimension\b([^>]*)\/?>/gi)].map((d) => { const a = (k) => +(new RegExp(`\\b${k}="(\\d+)"`).exec(d[1])?.[1] ?? 0); return { x: a('sizeX'), y: a('sizeY'), r: a('r'), c: a('c'), z: a('z'), ifd: a('ifd') }; });
    const view = +(/<view[^>]*sizeX="(\d+)"/i.exec(b)?.[1] || 0), px = +(/<pixels[^>]*sizeX="(\d+)"/i.exec(b)?.[1] || 0);
    const canali = [...b.matchAll(/<channel\b[^>]*name="([^"]*)"[^>]*rgb="#([0-9a-f]{6})"/gi)].map((c) => ({ nome: c[1].split('|')[0], colore: [0, 2, 4].map((i) => parseInt(c[2].slice(i, i + 2), 16)) }));
    return { dim, view, px, canali, macro: !!coll && String(view) === coll, chiaro: /brightfield/i.test(b) };
  }).filter((x) => x.dim.length);
  const tessuto = blocchi.filter((x) => !x.macro), principale = (tessuto.length ? tessuto : blocchi).reduce((m, x) => (x.px * x.dim[0].y > m.px * m.dim[0].y ? x : m));
  const macro = blocchi.find((x) => x.macro && x.chiaro) || blocchi.find((x) => x.macro);
  return { ifd: new Set(principale.dim.filter((d) => !d.z).map((d) => d.ifd)), um: principale.view && principale.px ? principale.view / principale.px / 1000 : null, canali: principale.canali,
    macro: macro && macro !== principale ? macro.dim.find((d) => d.r === 0 && !d.c)?.ifd : null };
}
export async function vetriniTiff(f) {
  const T = await leggiTiff(f), nome = (f.name || 'vetrino').replace(/\.[^.]+$/, '');
  const ndpi = T.ifd.some((d) => d.tag[65420]);
  const tutti = T.ifd.flatMap((d) => [d, ...(d.sub || [])]);
  const desc = (d) => testoTag(d, 270);
  const eEtichetta = (d) => /\blabel/i.test(desc(d)) || (ndpi && uno(d, 65421) === -2);
  const ePanoramica = (d) => /\bmacro|overview|slide ?preview/i.test(desc(d)) || (ndpi && uno(d, 65421) === -1);
  const eMiniatura = (d) => /thumbnail/i.test(desc(d)) && !d.tag[322];
  const scn = /<scn\b/i.test(desc(T.ifd[0])) ? leggiScn(desc(T.ifd[0])) : null;
  const immagini = scn ? T.ifd.filter((d, i) => scn.ifd.has(i)) : tutti.filter((d) => !eEtichetta(d) && !ePanoramica(d) && !eMiniatura(d) && uno(d, 256) > 0);
  // immagine principale: la più grande; livelli: stesse proporzioni (±3%), tassellate (o strisce NDPI), più piccole
  const base = immagini.reduce((m, d) => (uno(d, 256) * uno(d, 257) > uno(m, 256) * uno(m, 257) ? d : m), immagini[0]);
  if (!base) throw new Error('nessuna immagine nel file');
  const r0 = rapporto(base), tassellata = !!base.tag[322];
  const scelti = immagini.filter((d) => Math.abs(rapporto(d) / r0 - 1) < 0.03 && (!tassellata || d.tag[322] || ndpi) && (!ndpi || uno(d, 65421) === uno(base, 65421) || uno(d, 65421) > 0));
  // NDPI con più piani focali (tag 65424): si tiene il piano 0
  const piano = (d) => (ndpi ? uno(d, 65424, 0) : 0);
  const voci = [];
  for (const d of scelti.filter((d) => piano(d) === piano(base))) {
    try { voci.push(await (ndpi ? livelloNdpi : livelloTiff)(T, d, `${f.percorso || f.name}|${f.size}|${d.off}`)); } catch (e) { console.warn('livello', e.message); }
  }
  if (!voci.length) throw new Error('livelli del vetrino non leggibili');
  // canali: livelli con le stesse dimensioni e un campione per pixel (fluorescenza, Leica SCN e OME-TIFF)
  const livelli = [], canali = [];
  voci.sort((a, b) => b.W - a.W);
  for (const v of voci) {
    let L = livelli.find((x) => Math.abs(x.W - v.W) <= 1 && Math.abs(x.H - v.H) <= 1 && x.tw === v.tw && x.th === v.th);
    if (!L) { L = { W: v.W, H: v.H, tw: v.tw, th: v.th, tipo: 'VOLUME', voci: new Map(), zPresenti: new Set([0]), nCanali: 0 }; livelli.push(L); }
    else if (v.spp !== 1) continue;
    const c = L.nCanali++;
    if (c >= 8) continue;
    const nx = Math.ceil(v.W / v.tw), ny = Math.ceil(v.H / v.th);
    for (let k = 0; k < Math.min(v.n, nx * ny); k++) L.voci.set(`${k % nx},${Math.floor(k / nx)},0,${c}`, [v, k]);
  }
  const L0 = livelli[0], P0 = voci[0], mono = P0.spp === 1;
  const nc = Math.max(1, L0.nCanali);
  const nomiCanali = [...desc(T.ifd[0]).matchAll(/<Channel[^>]*Name="([^"]*)"/gi)].map((m) => m[1]);
  for (let c = 0; c < nc; c++) canali.push({ id: String(c + 1), nome: nomiCanali[c] || scn?.canali[c]?.nome || '', onda: 0 });
  for (const L of livelli) { L.ds = L0.W / L.W; L.zLista = [0]; }
  const COL = [[40, 110, 255], [0, 255, 0], [255, 40, 40], [255, 0, 255], [0, 255, 255], [255, 255, 0], [255, 140, 0], [255, 255, 255]];
  canali.forEach((c, k) => { c.colore = mono ? (nc === 1 ? [255, 255, 255] : scn?.canali[k]?.colore || COL[k % COL.length]) : null; c.acceso = true; c.guadagno = 1; c.max = null; });
  const um = scn?.um || micronPerPixel(T, T.ifd[0], desc(base) + '\n' + desc(T.ifd[0]), L0.W);
  const accessoria = async (d) => { if (!d) return null; try { const v = await livelloTiff(T, d, `${f.percorso || f.name}|${f.size}|${d.off}`); v.tipo = 'LABEL'; return v; } catch { return null; } };
  const formato = ndpi ? 'Hamamatsu NDPI' : /aperio/i.test(desc(T.ifd[0])) ? 'Aperio SVS' : /<OME/i.test(desc(T.ifd[0])) ? 'OME-TIFF' : /Philips/i.test(desc(T.ifd[0]) + testoTag(T.ifd[0], 305)) ? 'Philips TIFF'
    : /leica|<scn/i.test(desc(T.ifd[0])) ? 'Leica SCN' : /iScan|Ventana/i.test(testoTag(T.ifd[0], 700) + desc(T.ifd[0])) ? 'Ventana BIF' : 'TIFF';
  return [{ W: L0.W, H: L0.H, sp: um ? [um / 1000, um / 1000] : null, serie: `${f.percorso || f.name}|${f.size}`, livelli, piani: [0], canali, mono, bitsSt: P0.bitsSt,
    descrizione: nome, formato, etichetta: await accessoria(tutti.find(eEtichetta)), panoramica: await accessoria(scn ? (scn.macro != null ? T.ifd[scn.macro] : null) : tutti.find(ePanoramica)), studio: `${f.percorso || f.name}|${f.size}` }];
}

// ------------------------------------------------------------------------------------------------ 3DHISTECH MRXS
// slide.mrxs + cartella «slide» con Slidedat.ini (parametri), Index.dat (dove sta ogni immagine) e DataNNNN.dat (immagini).
// Le immagini della fotocamera si sovrappongono: la posizione vera di ciascuna è nel buffer di posizione
// (VIMSLIDE_POSITION_BUFFER, o StitchingIntensityLayer compresso), altrimenti si usa la griglia con la sovrapposizione.
function ini(t) { const o = {}; let sez = ''; for (const r of t.split(/\r?\n/)) { const m = /^\s*\[(.+)\]\s*$/.exec(r); if (m) { sez = m[1]; o[sez] ||= {}; continue; } const k = r.indexOf('='); if (k > 0 && sez) o[sez][r.slice(0, k).trim()] = r.slice(k + 1).trim(); } return o; }
async function testoFile(f) { const u = new Uint8Array(await f.arrayBuffer()); if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder('utf-16le').decode(u); return new TextDecoder().decode(u).replace(/^\uFEFF/, ''); }
const TS_DA_FMT = { JPEG: TS_JPEG, JPG: TS_JPEG, PNG: 'png', BMP: 'bmp' };
async function vetrinoMrxs(f, files) {
  const nome = f.name.replace(/\.mrxs$/i, ''), rel = (x) => x.webkitRelativePath || x.name;
  let parti = files.filter((x) => { const p = rel(x).split('/'); return p.length >= 2 && p[p.length - 2] === nome; });
  if (!parti.some((x) => /^Slidedat\.ini$/i.test(x.name))) parti = files.filter((x) => /^(Slidedat\.ini|Index\.dat|Data\d+\.dat)$/i.test(x.name));
  const per = new Map(parti.map((x) => [x.name.toLowerCase(), x]));
  const sd = per.get('slidedat.ini');
  if (!sd) throw new Error('MRXS: serve anche la cartella con lo stesso nome (Slidedat.ini, Index.dat, Data….dat): apri la cartella che contiene il file .mrxs');
  const I = ini(await testoFile(sd)), G = I.GENERAL || {}, H = I.HIERARCHICAL || {}, DF = I.DATAFILE || {};
  const nx = +G.IMAGENUMBER_X, div = +(G.CameraImageDivisionsPerSide || 1);
  const dati = (i) => per.get(String(DF[`FILE_${i}`] || '').toLowerCase());
  const fi = per.get(String(H.INDEXFILE || 'Index.dat').toLowerCase()); if (!fi) throw new Error('MRXS: manca Index.dat');
  const D = new DataView(await fi.arrayBuffer()), lid = String(G.SLIDE_ID || '').length;
  const hr = D.getInt32(5 + lid, true), nr = D.getInt32(9 + lid, true);
  const pagine = (ptr, dim) => { const out = []; let pg = D.getInt32(ptr + 4, true), g = 0; while (pg > 0 && pg < D.byteLength && g++ < 1e6) { const n = D.getInt32(pg, true); for (let k = 0; k < n; k++) { const o = pg + 8 + dim * k; const e = []; for (let j = 0; j < dim / 4; j++) e.push(D.getInt32(o + 4 * j, true)); out.push(e); } pg = D.getInt32(pg + 4, true); } return out; };
  let hz = 0; for (let i = 0; i < +H.HIER_COUNT; i++) if (/zoom level/i.test(H[`HIER_${i}_NAME`] || '')) { hz = i; break; }
  let base = 0; for (let i = 0; i < hz; i++) base += +H[`HIER_${i}_COUNT`];
  const nonhier = (nomeL, val) => { let k = 0; for (let i = 0; i < +(H.NONHIER_COUNT || 0); i++) { const c = +H[`NONHIER_${i}_COUNT`]; if (H[`NONHIER_${i}_NAME`] === nomeL) { for (let j = 0; j < c; j++) if (!val || H[`NONHIER_${i}_VAL_${j}`] === val) return { ptr: D.getInt32(nr + 4 * (k + j), true), sez: I[H[`NONHIER_${i}_VAL_${j}_SECTION`]] || {} }; return null; } k += c; } return null; };
  const leggiNonhier = async (r) => { if (!r) return null; const e = pagine(r.ptr, 20)[0], df = e && dati(e[4]); return df ? new Uint8Array(await df.slice(e[2], e[2] + e[3]).arrayBuffer()) : null; };
  const liv = []; let e = 0;
  for (let i = 0; i < +H[`HIER_${hz}_COUNT`]; i++) {
    const S = I[H[`HIER_${hz}_VAL_${i}_SECTION`]] || {}; e += +(S.IMAGE_CONCAT_FACTOR || 0);
    liv.push({ e, w: +S.DIGITIZER_WIDTH, h: +S.DIGITIZER_HEIGHT, ov: [+(S.OVERLAP_X || 0), +(S.OVERLAP_Y || 0)], um: +S.MICROMETER_PER_PIXEL_X, fmt: String(S.IMAGE_FORMAT || 'JPEG').toUpperCase(), voci: pagine(D.getInt32(hr + 4 * (base + i), true), 16) });
  }
  if (!liv.length || !liv[0].voci.length) throw new Error('MRXS: nessuna immagine nell\'indice');
  const e0 = liv[0].e, iw = liv[0].w, ih = liv[0].h, s0 = 2 ** e0, ncx = Math.ceil(nx / div);
  // posizione delle immagini della fotocamera, in pixel del livello 0
  let raw = await leggiNonhier(nonhier('VIMSLIDE_POSITION_BUFFER'));
  if (!raw) { const z = await leggiNonhier(nonhier('StitchingIntensityLayer')); if (z) try { raw = await deflate(z); } catch {} }
  const dvp = raw && raw.length >= 9 ? new DataView(raw.buffer, raw.byteOffset, raw.length) : null;
  const griglia = (cx, cy) => [cx * (div * iw / s0 - liv[0].ov[0]), cy * (div * ih / s0 - liv[0].ov[1])];
  const camera = (cx, cy) => { const k = 9 * (cy * ncx + cx); return dvp && k + 9 <= dvp.byteLength && dvp.getUint8(k) ? [dvp.getInt32(k + 1, true), dvp.getInt32(k + 5, true)] : griglia(cx, cy); };
  const posPiena = (x, y) => { const c = camera(Math.floor(x / div), Math.floor(y / div)); return [c[0] * s0 + (x % div) * iw, c[1] * s0 + (y % div) * ih]; };   // pixel a risoluzione piena
  const livelli = []; let W = 0, Hh = 0;
  for (const [i, Lm] of liv.entries()) {
    const k2 = 2 ** Lm.e, v = { f: dati(Lm.voci[0][3]) || fi, chiave: `${f.percorso || f.name}|mrxs|${i}`, W: 0, H: 0, tw: Lm.w, th: Lm.h, n: Lm.voci.length, spp: 3, bits: 8, bitsSt: 8, conSegno: false, piani: 0, pos: null, nz: 1, nc: 1, cammini: [], tipo: 'VOLUME', incapsulato: false, ts: TS_DA_FMT[Lm.fmt] || TS_JPEG, foto: 'RGB' };
    v.byteTessera = async (k) => { const [, off, lun, fn] = Lm.voci[k], df = dati(fn); if (!df) throw new Error(`MRXS: manca ${DF[`FILE_${fn}`]}`); return new Uint8Array(await df.slice(off, off + lun).arrayBuffer()); };
    const L = { tw: Lm.w, th: Lm.h, tipo: 'VOLUME', voci: new Map(), zPresenti: new Set([0]), zLista: [0], pos: new Map(), secchi: new Map(), e: Lm.e };
    Lm.voci.forEach(([img], k) => {
      const x = img % nx, y = Math.floor(img / nx), a = Math.floor(x / k2), b = Math.floor(y / k2), [px, py] = posPiena(x, y), p = [px / k2, py / k2];
      L.voci.set(`${a},${b},0,0`, [v, k]); L.pos.set(`${a},${b}`, p);
      const sk = `${Math.floor(p[0] / Lm.w)},${Math.floor(p[1] / Lm.h)}`; if (!L.secchi.has(sk)) L.secchi.set(sk, []); L.secchi.get(sk).push([a, b]);
      if (i === 0) { W = Math.max(W, p[0] + Lm.w); Hh = Math.max(Hh, p[1] + Lm.h); }
    });
    L.trova = (x0, y0, w, h) => { const o = []; for (let by = Math.floor(y0 / L.th) - 1; by <= Math.floor((y0 + h) / L.th); by++) for (let bx = Math.floor(x0 / L.tw) - 1; bx <= Math.floor((x0 + w) / L.tw); bx++) for (const t of L.secchi.get(`${bx},${by}`) || []) { const p = L.pos.get(`${t[0]},${t[1]}`); if (p[0] < x0 + w && p[0] + L.tw > x0 && p[1] < y0 + h && p[1] + L.th > y0) o.push(t); } return o; };
    livelli.push(L);
  }
  for (const L of livelli) { L.ds = 2 ** (L.e - e0); L.W = Math.ceil(W / L.ds); L.H = Math.ceil(Hh / L.ds); }
  const accessoria = async (val, pre) => { const r = nonhier('Scan data layer', val); const b = await leggiNonhier(r); if (!b) return null;
    const S = r.sez || {}, Wi = +S[`${pre}_IMAGE_WIDTH`] || 0, Hi = +S[`${pre}_IMAGE_HEIGHT`] || 0; if (!Wi || !Hi) return null;
    return { f: fi, chiave: `${f.percorso || f.name}|mrxs|${val}`, W: Wi, H: Hi, tw: Wi, th: Hi, n: 1, spp: 3, bits: 8, bitsSt: 8, piani: 0, pos: null, tipo: 'LABEL', incapsulato: false, ts: TS_DA_FMT[String(S[`${pre}_IMAGE_TYPE`] || 'JPEG').toUpperCase()] || TS_JPEG, foto: 'RGB', byteTessera: async () => b }; };
  const um = liv[0].um || null;
  return [{ W: Math.ceil(W), H: Math.ceil(Hh), sp: um ? [um / 1000, um / 1000] : null, serie: `${f.percorso || f.name}|mrxs`, livelli, piani: [0], canali: [{ id: '1', nome: '', onda: 0, colore: null, acceso: true, guadagno: 1, max: null }], mono: false, bitsSt: 8,
    descrizione: nome, formato: '3DHISTECH MRXS', etichetta: await accessoria('ScanDataLayer_SlideBarcode', 'BARCODE'), panoramica: await accessoria('ScanDataLayer_SlidePreview', 'PREVIEW'), studio: `${f.percorso || f.name}|mrxs` }];
}

// ------------------------------------------------------------------------------------------------ ingresso comune
// files: tutti i file non DICOM riconosciuti come vetrino (anche le parti dei formati a più file)
export async function vetriniDaFormati(files) {
  const out = [], errori = [];
  const conFormato = await Promise.all(files.map(async (f) => [f, await formatoVetrino(f)]));
  for (const [f, fm] of conFormato) {
    try {
      if (fm === 'tiff') out.push(...await vetriniTiff(f));
      else if (fm === 'mrxs') out.push(...await vetrinoMrxs(f, files));
      else if (fm === 'czi' || fm === 'vsi' || fm === 'isyntax') {
        const m = await import('./vetrini-formati2.js').catch(() => null);
        if (!m?.[fm]) throw new Error(`formato ${fm.toUpperCase()} non ancora supportato`);
        out.push(...await m[fm](f, files));
      }
    } catch (e) { console.warn('vetrino', f.name, e); errori.push(`${f.name}: ${e.message}`); }
  }
  if (!out.length && errori.length) throw new Error(errori.join('; '));
  return out;
}
