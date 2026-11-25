// vetrino-tiff.js (1.326, 1.327): pulizia e controllo dei vetrini: TIFF (Aperio SVS, TIFF piramidali, NDPI, Leica SCN,
// Ventana BIF, Philips TIFF) e, dalla 1.327, Zeiss CZI, Philips iSyntax, 3DHISTECH MRXS e Olympus VSI. Traduzione in
// JavaScript di strumenti/prepara_vetrino.py: stesse regole, stessi file prodotti (confronta_python.mjs, byte per byte).
// Lo stesso file serve nel browser del docente (web/vetrino-tiff.js: pulizia prima del caricamento dal pannello) e sul
// server (api/vetrino-tiff.mjs: secondo controllo del file caricato); test/vetrino-tiff.test.mjs verifica che siano uguali.
// leggi(posizione, byte) → Promise<Uint8Array>: dal File nel browser, da S3 con Range sul server. Nessun'altra dipendenza.

const TIPI = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4, 16: 8, 17: 8, 18: 8 };
// byte ↔ testo latin-1 (un carattere per byte: le espressioni regolari lavorano come quelle di Python sui bytes)
const latino = (b) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return s; };
const bytes = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };

// ------------------------------------------------------------------------------------------------ testo: ricerca e pulizia
const DATA = () => /\b\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/.]\d{2}[-/.]\d{2}(?:[T ]\d{2}:\d{2})?/g;
const CF = () => /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g;
const EMAIL = () => /(?<![\w.+-])[\w.+-]{1,64}@[\w-]{1,63}\.[\w.]{2,63}/g;
const CHIAVI = () => /\b(Date|Time|User|Filename|ScanScope ID|Barcode|Patient[\w ]*|Accession[\w ]*|Operator|Reference|Created|Updated|SLIDE_NAME|PROJECT_NAME|SLIDE_CREATIONDATETIME|Serial\w*)([ \t\r\n\f\v]*=[ \t\r\n\f\v]*)([^|\r\n]*)/gi;
const ATTR = () => /(<Attribute[ \t\r\n\f\v]+Name="(?:DICOM_ACQUISITION_DATETIME|DICOM_DEVICE_SERIAL_NUMBER|PIM_DP_UFS_BARCODE|DICOM_PATIENT\w*|DICOM_ACCESSION\w*|DICOM_STUDY_\w*|DICOM_INSTITUTION\w*|DICOM_\w*_DATE\w*|DICOM_\w*_TIME\w*|DICOM_DATE_OF_LAST_CALIBRATION|DICOM_TIME_OF_LAST_CALIBRATION|DICOM_REFERRING\w*|DICOM_OPERATORS\w*|PIM_DP_SCANNER_\w*SERIAL\w*|DICOM_SPECIMEN\w*|DICOM_CONTAINER\w*)"[^>]*>)([\s\S]*?)(<\/Attribute>)/g;
const IMMAGINI_XML = () => /(<Attribute[ \t\r\n\f\v]+Name="PIM_DP_IMAGE_DATA"[^>]*>)([\s\S]*?)(<\/Attribute>)/g;   // etichetta e panoramica in base64

const TAG_XML = () => /(<(AcquisitionDateAndTime|CreationDate|LastModifiedDate|UserName|DisplayName|FirstName|LastName|MiddleName|Email|Institution|Phone|Fax|Login|BarCode|Barcode|Comment|Description|Title|Name|Id|Ids|Description)\b[^>/]*>)([^<]*)(<\/\2>)/g;
const BLOCCO_CZI = () => /<(User|Document)\b[\s\S]*?<\/\1>/g;
const TAG_CZI = new Set(['AcquisitionDateAndTime', 'CreationDate', 'LastModifiedDate', 'UserName', 'BarCode', 'Barcode', 'Email', 'Phone', 'Login']);
const vuotaTag = (t, a, n, v, c) => a + ' '.repeat(v.length) + c;
// stesse lunghezze: si sostituiscono solo i valori
export function pulisciTesto(s, formato = '') {
  s = s.replace(CHIAVI(), (m, a, b, c) => a + b + 'x'.repeat(c.length));
  s = s.replace(ATTR(), (m, a, b, c) => a + 'x'.repeat(b.length) + c);
  s = s.replace(IMMAGINI_XML(), (m, a, b, c) => a + 'A'.repeat(b.length) + c);
  if (formato === 'czi') {
    s = s.replace(BLOCCO_CZI(), (m) => m.replace(TAG_XML(), vuotaTag));
    s = s.replace(TAG_XML(), (t, a, n, v, c) => (TAG_CZI.has(n) ? vuotaTag(t, a, n, v, c) : t));
  }
  s = s.replace(DATA(), (m) => '0'.repeat(m.length)).replace(CF(), (m) => 'X'.repeat(m.length)).replace(EMAIL(), (m) => 'x'.repeat(m.length));
  return s;
}
// cose che non dovrebbero esserci (forma mascherata: mai il valore intero)
export function sospetti(s) {
  const out = [];
  for (const [nome, r] of [['data', DATA()], ['codice fiscale', CF()], ['email', EMAIL()]])
    for (const m of s.matchAll(r)) out.push(`${nome}: ${m[0].slice(0, 2)}…${m[0].slice(-1)} (${m[0].length} caratteri)`);
  for (const m of s.matchAll(CHIAVI())) if (m[3].replace(/^[ x0X]+|[ x0X]+$/g, '')) out.push(`campo «${m[1]}» con un valore`);
  for (const m of s.matchAll(ATTR())) if (m[2].replace(/^[ x0X"]+|[ x0X"]+$/g, '')) out.push('attributo XML ' + (/Name="(\w+)"/.exec(m[1]) || [])[1]);
  for (const m of s.matchAll(IMMAGINI_XML())) if (m[2].replace(/[A \r\n=]/g, '')) out.push('immagine (etichetta o panoramica) nel testo XML');
  return out;
}

// ------------------------------------------------------------------------------------------------ lettura a pagine
// le intestazioni sono sparse nel file: si legge a pagine da 64 kB, ricordate (sul server: poche richieste a S3)
export function lettoreConPagine(leggi, PAG = 65536) {
  const pagine = new Map();
  const pagina = (p) => { if (!pagine.has(p)) pagine.set(p, leggi(p * PAG, PAG)); return pagine.get(p); };
  return async (off, n) => {
    if (n > 4 * PAG) return leggi(off, n);
    const out = new Uint8Array(n), p0 = Math.floor(off / PAG), p1 = Math.floor((off + n - 1) / PAG);
    for (let p = p0; p <= p1; p++) {
      const b = await pagina(p), da = Math.max(off, p * PAG), a = Math.min(off + n, p * PAG + b.length);
      if (a > da) out.set(b.subarray(da - p * PAG, a - p * PAG), da - off);
    }
    return out;
  };
}

// ------------------------------------------------------------------------------------------------ TIFF (anche BigTIFF)
export async function leggiTiff(leggiGrezzo) {
  const leggi = lettoreConPagine(leggiGrezzo);
  const h = await leggi(0, 16);
  if (!((h[0] === 0x49 && h[1] === 0x49) || (h[0] === 0x4d && h[1] === 0x4d))) throw new Error('non è un file TIFF');
  const le = h[0] === 0x49, dv = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (b, o) => dv(b).getUint16(o, le), u32 = (b, o) => dv(b).getUint32(o, le), u64 = (b, o) => Number(dv(b).getBigUint64(o, le));
  const big = u16(h, 2) === 43;
  if (!big && u16(h, 2) !== 42) throw new Error('non è un file TIFF');
  let off = big ? u64(h, 8) : u32(h, 4);
  const ifd = [], visti = new Set();
  const unIfd = async (off) => {
    const n = big ? u64(await leggi(off, 8), 0) : u16(await leggi(off, 2), 0), eb = big ? 20 : 12;
    if (n > 100000) throw new Error('intestazione TIFF non valida');
    const d = await leggi(off + (big ? 8 : 2), n * eb + (big ? 8 : 4)), tag = {};
    for (let i = 0; i < n; i++) {
      const p = i * eb, t = u16(d, p), ty = u16(d, p + 2), cnt = big ? u64(d, p + 4) : u32(d, p + 4);
      const sz = (TIPI[ty] || 1) * cnt, dentro = sz <= (big ? 8 : 4);
      const pos = dentro ? off + (big ? 8 : 2) + p + (big ? 12 : 8) : (big ? u64(d, p + 12) : u32(d, p + 8));
      tag[t] = [ty, cnt, pos];
    }
    return [{ off, tag }, big ? u64(d, n * eb) : u32(d, n * eb)];
  };
  while (off && !visti.has(off) && ifd.length < 5000) { visti.add(off); const [d, nx] = await unIfd(off); ifd.push(d); off = nx; }
  const T = { ifd, le, big, leggi };
  for (const d of [...ifd]) if (d.tag[330]) for (const o of await valori(T, d.tag[330])) { const [s] = await unIfd(o); s.sub = true; ifd.push(s); }
  return T;
}
export async function valori(T, [ty, cnt, pos]) {
  if (cnt > 50e6) throw new Error('intestazione TIFF non valida');
  const b = await T.leggi(pos, (TIPI[ty] || 1) * cnt);
  if (ty === 2) return b;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), le = T.le, out = [];
  for (let i = 0; i < cnt; i++) {
    switch (ty) {
      case 1: case 7: out.push(v.getUint8(i)); break; case 6: out.push(v.getInt8(i)); break;
      case 3: out.push(v.getUint16(i * 2, le)); break; case 8: out.push(v.getInt16(i * 2, le)); break;
      case 4: case 13: out.push(v.getUint32(i * 4, le)); break; case 9: out.push(v.getInt32(i * 4, le)); break;
      case 16: case 18: out.push(Number(v.getBigUint64(i * 8, le))); break; case 17: out.push(Number(v.getBigInt64(i * 8, le))); break;
      case 11: out.push(v.getFloat32(i * 4, le)); break; case 12: out.push(v.getFloat64(i * 8, le)); break;
      case 5: out.push(v.getUint32(i * 8, le) / (v.getUint32(i * 8 + 4, le) || 1)); break;
      case 10: out.push(v.getInt32(i * 8, le) / (v.getInt32(i * 8 + 4, le) || 1)); break;
      default: out.push(v.getUint8(i));
    }
  }
  return out;
}
const uno = async (T, d, t, dflt = 0) => { if (!d.tag[t]) return dflt; const v = await valori(T, d.tag[t]); return v.length ? v[0] : dflt; };
const testo = async (T, d, t) => (d.tag[t] && [1, 2, 7].includes(d.tag[t][0]) ? latino(await T.leggi(d.tag[t][2], d.tag[t][1])) : '');

// IFD della piramide principale (come vetrini-formati.js); il resto è etichetta, panoramica, miniature, macro
export async function livelliTiff(T) {
  const { ifd } = T, desc = new Map();
  for (const d of ifd) desc.set(d, await testo(T, d, 270));
  const ndpi = ifd.some((d) => d.tag[65420]);
  if (/<scn\b/.test(desc.get(ifd[0]))) {   // Leica SCN: l'immagine di tessuto più grande (non la panoramica della collezione)
    const x = desc.get(ifd[0]), coll = /<collection[^>]*sizeX="(\d+)"/.exec(x), blocchi = [];
    for (const [b] of x.matchAll(/<image\b[\s\S]*?<\/image>/g)) {
      const v = /<view[^>]*sizeX="(\d+)"/.exec(b), px = /<pixels[^>]*sizeX="(\d+)"/.exec(b);
      blocchi.push([!!(coll && v && v[1] === coll[1]), px ? +px[1] : 0, [...b.matchAll(/<dimension\b[^>]*\bifd="(\d+)"/g)].map((m) => +m[1])]);
    }
    const t = blocchi.filter((b) => !b[0]).length ? blocchi.filter((b) => !b[0]) : blocchi;
    if (!t.length) return new Set();
    const m = t.reduce((a, b) => (b[1] > a[1] ? b : a));
    return new Set(m[2].filter((i) => i < ifd.length).map((i) => ifd[i].off));
  }
  // descrizione breve («label 387x463», «Macro»), non un XML lungo: nei Philips TIFF l'XML della prima immagine nomina
  // LABELIMAGE e MACROIMAGE ma è l'immagine piena
  const breve = (d) => { const s = desc.get(d); return s.length < 2000 && !/^\s*<(\?xml|DataObject)/i.test(s) ? s : ''; };
  const info = [];
  for (const d of ifd) {
    const sl = ndpi ? await uno(T, d, 65421, 0) : 0, b = breve(d);
    const etich = /\blabel/i.test(b) || (ndpi && (sl === -1 || sl === -2)) || /macro|overview|slide ?preview|thumbnail/i.test(b);
    info.push({ d, etich, W: await uno(T, d, 256), H: await uno(T, d, 257) });
  }
  const cand = info.filter((x) => !x.etich && x.W);
  if (!cand.length) return new Set();
  const base = cand.reduce((a, b) => (b.W * b.H > a.W * a.H ? b : a)), r0 = base.W / Math.max(1, base.H), tass = !!base.d.tag[322];
  return new Set(cand.filter((x) => Math.abs(x.W / Math.max(1, x.H) / r0 - 1) < 0.03 && (!tass || x.d.tag[322] || ndpi)).map((x) => x.d.off));
}
async function zonaDati(T, d) {
  const o = d.tag[324] || d.tag[273], c = d.tag[325] || d.tag[279];
  if (!o || !c) return [];
  const a = await valori(T, o), n = await valori(T, c);
  return a.map((x, i) => [x, n[i] || 0]).filter(([, k]) => k > 0);
}
const TESTI_PULITI = new Set([270, 700, 65449]);
const daPulire = (t, ty) => ty === 2 || (t === 700 && (ty === 1 || ty === 7)) || t === 65449 || t === 65468;

// piano della pulizia: zone da azzerare (etichetta, panoramica, miniature) e testi da riscrivere con la stessa lunghezza
export async function pianoPulizia(leggi) {
  const T = await leggiTiff(leggi), liv = await livelliTiff(T);
  if (!liv.size) throw new Error('nessuna piramide riconosciuta nel TIFF: non sembra un vetrino');
  const zeri = [], testi = [];
  let accessorie = 0;
  for (const d of T.ifd) {
    if (!liv.has(d.off)) { const z = await zonaDati(T, d); if (z.length) accessorie++; zeri.push(...z); }
    for (const [k, [ty, cnt, pos]] of Object.entries(d.tag)) {
      const t = +k; if (!daPulire(t, ty) || !cnt) continue;
      const b = await T.leggi(pos, cnt), s = latino(b);
      let ns;
      if (TESTI_PULITI.has(t)) ns = pulisciTesto(s);
      else if (t === 305) ns = s;   // Software: nome e versione del programma dello scanner, utile e innocuo
      else { const r = s.replace(/\0+$/, ''); ns = ' '.repeat(r.length) + '\0'.repeat(s.length - r.length); }
      if (ns !== s) testi.push([pos, bytes(ns)]);
    }
  }
  return { livelli: liv.size, immagini: T.ifd.length, accessorie, zeri, testi, descrizione: await testo(T, T.ifd[0], 270) };
}

// controllo di una copia pulita (lo stesso del Mac, controlla_tiff): elenco dei problemi, vuoto se tutto è a posto
export async function problemi(leggi, campione = 1 << 16) {
  const T = await leggiTiff(leggi), liv = await livelliTiff(T), out = [];
  if (!liv.size) return ['nessuna piramide riconosciuta nel TIFF'];
  for (const [i, d] of T.ifd.entries()) {
    if (!liv.has(d.off)) for (const [a, n] of await zonaDati(T, d)) {
      const b = await leggi(a, Math.min(n, campione));
      if (b.some((x) => x !== 0)) { out.push(`IFD ${i} (etichetta/panoramica) non azzerato`); break; }
    }
    for (const [k, [ty, cnt, pos]] of Object.entries(d.tag)) {
      const t = +k; if (!((ty === 2 || t === 700) && t !== 305) || !cnt) continue;
      out.push(...sospetti(latino(await T.leggi(pos, cnt))).map((s) => `tag ${t}: ${s}`));
    }
  }
  return out;
}

// copia pulita come Blob: pezzi dell'originale e parti sostituite, senza copiare il file (anche 4 GB vanno bene)
export function copiaPulita(file, piano) {
  const zona = []; for (const [a, n] of piano.zeri) zona.push([a, n, null]);
  for (const [a, b] of piano.testi) zona.push([a, b.length, b]);
  zona.sort((x, y) => x[0] - y[0] || (x[2] ? 1 : -1));
  const parti = [], ZERO = new Uint8Array(1 << 20);
  let cur = 0;
  for (const [a, n, b] of zona) {
    if (a + n <= cur) continue;                          // testo dentro una zona già azzerata
    const da = Math.max(a, cur);
    if (da > cur) parti.push(file.slice(cur, da));
    if (b) parti.push(b.subarray(da - a));
    else for (let r = a + n - da; r > 0; r -= ZERO.length) parti.push(r >= ZERO.length ? ZERO : ZERO.subarray(0, r));
    cur = a + n;
  }
  if (cur < file.size) parti.push(file.slice(cur));
  return new Blob(parti, { type: 'application/octet-stream' });
}
export const lettoreBlob = (b) => async (o, n) => new Uint8Array(await b.slice(o, o + n).arrayBuffer());

// ================================================================================================ altri formati (1.327)
const i32 = (b, o) => new DataView(b.buffer, b.byteOffset, b.byteLength).getInt32(o, true);
const i64 = (b, o) => Number(new DataView(b.buffer, b.byteOffset, b.byteLength).getBigInt64(o, true));
const zeroIn = async (leggi, zone, campione = 1 << 16) => { for (const [a, n] of zone) if ((await leggi(a, Math.min(n, campione))).some((x) => x !== 0)) return false; return true; };
export const SEGNAPOSTO = 'radio-quiz: file principale senza immagini (tolte)\n';

// ------------------------------------------------------------------------------------------------ Zeiss CZI
async function cziAllegati(leggi) {
  const ap = i64(await leggi(32 + 72, 8), 0), out = [];
  if (ap <= 0) return out;
  const n = i32(await leggi(ap + 32, 4), 0);
  if (n < 0 || n > 100000) throw new Error('CZI: elenco degli allegati non valido');
  const e = await leggi(ap + 32 + 256, n * 128);
  for (let k = 0; k < n; k++) {
    const r = e.subarray(k * 128, k * 128 + 128), pos = i64(r, 12), nome = latino(r.subarray(48, 128)).split('\0')[0];
    const lun = i32(await leggi(pos + 32, 4), 0);
    out.push({ nome, zona: [pos + 32 + 256, Math.max(0, lun)] });
  }
  return out;
}
async function cziMeta(leggi) {
  const mp = i64(await leggi(32 + 60, 8), 0); if (mp <= 0) return null;
  const n = i32(await leggi(mp + 32, 4), 0); return { pos: mp + 32 + 256, testo: latino(await leggi(mp + 32 + 256, n)) };
}
async function pianoCzi(leggi) {
  if (latino(await leggi(0, 4)) !== 'ZISR') throw new Error('non è un file CZI');
  const al = await cziAllegati(leggi), m = await cziMeta(leggi), testi = [];
  if (m) { const t = pulisciTesto(m.testo, 'czi'); if (t !== m.testo) testi.push([m.pos, bytes(t)]); }
  return { accessorie: al.length, zeri: al.map((x) => x.zona).filter(([, n]) => n > 0), testi };
}
async function problemiCzi(leggi) {
  const out = [];
  for (const x of await cziAllegati(leggi)) if (!(await zeroIn(leggi, [x.zona]))) out.push(`allegato «${x.nome}» non azzerato`);
  const m = await cziMeta(leggi); if (m) out.push(...sospetti(m.testo));
  return out;
}

// ------------------------------------------------------------------------------------------------ Philips iSyntax
// intestazione XML fino a «\r\n\x04» (entro i primi 64 MB), letta a blocchi di 1 MB
async function xmlIsyntax(leggi, size) {
  const MAX = Math.min(size ?? 64 << 20, 64 << 20), B = 1 << 20; let s = '';
  for (let o = 0; o < MAX; o += B) {
    const b = await leggi(o, Math.min(B, MAX - o)); if (!b.length) break;
    s += latino(b); const i = s.indexOf('\r\n\x04', Math.max(0, o - 2)); if (i >= 0) return s.slice(0, i);
  }
  throw new Error('iSyntax: intestazione non trovata');
}
async function pianoIsyntax(leggi, size) {
  const x = await xmlIsyntax(leggi, size), t = pulisciTesto(x);
  return { accessorie: (x.match(IMMAGINI_XML()) || []).length, zeri: [], testi: t !== x ? [[0, bytes(t)]] : [] };
}
const problemiIsyntax = async (leggi, size) => sospetti(await xmlIsyntax(leggi, size));

// ------------------------------------------------------------------------------------------------ 3DHISTECH MRXS
// vetrino.mrxs (foto del vetrino con l'etichetta) → segnaposto; cartella «vetrino»: Slidedat.ini ripulito, nei file Data
// azzerati codice a barre (etichetta), anteprima e miniatura
const ini16 = (b) => b.length >= 2 && ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff));
function testoIni(b) {
  if (ini16(b)) return new TextDecoder(b[0] === 0xff ? 'utf-16le' : 'utf-16be').decode(b);
  return new TextDecoder('utf-8').decode(b);
}
function leggiIni(b) {
  const o = {}; let s = null;
  for (const r of testoIni(b).split(/\r\n|\r|\n/)) {
    const m = /^\s*\[(.+)\]\s*$/.exec(r);
    if (m) { s = m[1]; o[s] ||= {}; continue; }
    const i = r.indexOf('='); if (i >= 0 && s) o[s][r.slice(0, i).trim()] = r.slice(i + 1).trim();
  }
  return o;
}
const RECORD_MRXS = ['ScanDataLayer_SlideBarcode', 'ScanDataLayer_SlidePreview', 'ScanDataLayer_SlideThumbnail'];
async function recordMrxs(apri) {   // apri(nome nella cartella) → { size, leggi }
  const fi = await apri('Slidedat.ini'), I = leggiIni(await fi.leggi(0, fi.size)), H = I.HIERARCHICAL || {}, G = I.GENERAL || {}, DF = I.DATAFILE || {};
  const fx = await apri(H.INDEXFILE || 'Index.dat'), d = await fx.leggi(0, fx.size), lid = (G.SLIDE_ID || '').length;
  const nr = i32(d, 9 + lid), out = []; let k = 0;
  for (let i = 0; i < +(H.NONHIER_COUNT || 0); i++) {
    const c = +H[`NONHIER_${i}_COUNT`];
    for (let j = 0; j < c; j++) {
      const v = H[`NONHIER_${i}_VAL_${j}`];
      if (!RECORD_MRXS.includes(v)) continue;
      const p = i32(d, nr + 4 * (k + j)), pg = i32(d, p + 4);
      if (pg > 0 && i32(d, pg) > 0) out.push({ nome: v, file: DF[`FILE_${i32(d, pg + 24)}`], zona: [i32(d, pg + 16), i32(d, pg + 20)] });
    }
    k += c;
  }
  return out;
}
function iniPulito(b) {
  if (!ini16(b)) return bytes(pulisciTesto(latino(b)));
  const u8 = latino(new TextEncoder().encode(testoIni(b)));
  const t = new TextDecoder('utf-8').decode(bytes(pulisciTesto(u8)));
  const out = new Uint8Array(2 + t.length * 2); out[0] = 0xff; out[1] = 0xfe;   // UTF-16 con BOM, come Python .encode('utf-16')
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); out[2 + i * 2] = c & 255; out[3 + i * 2] = c >> 8; }
  return out;
}
const iniSospetti = (b) => sospetti(ini16(b) ? latino(new TextEncoder().encode(testoIni(b))) : latino(b));

// ------------------------------------------------------------------------------------------------ Olympus VSI
// del .vsi resta solo un segnaposto con la calibrazione (µm per pixel, letta dal visualizzatore); delle immagini .ets nella
// cartella «_nome_» resta la più grande (il tessuto), copiata com'è
export function micronVsi(d) {
  let um = null; const pat = [4, 1, 0, 0, 0xe3, 7, 0, 0], v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  for (let i = 0; i + 8 <= d.length; i++) {
    if (d[i] !== 4) continue;
    let ok = true; for (let k = 1; k < 8; k++) if (d[i + k] !== pat[k]) { ok = false; break; }
    if (!ok || i + 32 > d.length || v.getUint32(i + 12, true) !== 16) continue;
    const x = v.getFloat64(i + 16, true), y = v.getFloat64(i + 24, true);
    if (x > 0.01 && x < 1000 && Math.abs(y / x - 1) < 0.05 && (um === null || x < um)) um = x;
  }
  return um;
}

// ------------------------------------------------------------------------------------------------ insieme di file → vetrino
// files: File (o Blob con name) con «rel», il percorso relativo alla cartella scelta (webkitRelativePath o trascinamento).
// Risultato: file da caricare nella cartella serie/vetrino_N del caso, con i nomi che usa prepara_vetrino.py
export const ESTENSIONI_VETRINO = /\.(svs|tiff?|ndpi|scn|bif|czi|isyntax|i2syntax|mrxs|vsi)$/i;
const relDi = (f) => (f.rel || f.webkitRelativePath || f.name).replace(/\\/g, '/');
export function principaleTra(files) {
  const p = files.filter((f) => /\.(mrxs|vsi|czi|isyntax|i2syntax)$/i.test(f.name));
  if (p.length > 1) throw new Error('più di un vetrino tra i file scelti: caricane uno alla volta');
  if (p.length) return p[0];
  const t = files.filter((f) => /\.(svs|tiff?|ndpi|scn|bif)$/i.test(f.name));
  if (t.length > 1) throw new Error('più di un vetrino tra i file scelti: caricane uno alla volta');
  if (!t.length) throw new Error('nessun vetrino riconosciuto tra i file scelti');
  return t[0];
}
export async function preparaInsieme(files, Blob_ = Blob) {
  const f = principaleTra(files), nome = f.name.toLowerCase(), stem = f.name.replace(/\.[^.]+$/, '');
  const L = (x) => async (o, n) => new Uint8Array(await x.slice(o, o + n).arrayBuffer());
  const pr = relDi(f), dir = pr.includes('/') ? pr.slice(0, pr.lastIndexOf('/') + 1) : '';
  if (/\.(svs|tiff?|ndpi|scn|bif)$/.test(nome)) {
    const piano = await pianoPulizia(L(f)), est = nome.slice(nome.lastIndexOf('.'));
    return { formato: 'tiff', sorgenti: [f], principale: `vetrino${est}`, accessorie: piano.accessorie, testi: piano.testi.length, livelli: piano.livelli, uscita: [{ rel: `vetrino${est}`, blob: copiaPulita(f, piano) }] };
  }
  if (nome.endsWith('.czi')) { const piano = await pianoCzi(L(f)); return { formato: 'czi', sorgenti: [f], principale: 'vetrino.czi', accessorie: piano.accessorie, testi: piano.testi.length, uscita: [{ rel: 'vetrino.czi', blob: copiaPulita(f, piano) }] }; }
  if (/\.i2?syntax$/.test(nome)) { const piano = await pianoIsyntax(L(f), f.size); return { formato: 'isyntax', sorgenti: [f], principale: 'vetrino.isyntax', accessorie: piano.accessorie, testi: piano.testi.length, uscita: [{ rel: 'vetrino.isyntax', blob: copiaPulita(f, piano) }] }; }
  if (nome.endsWith('.mrxs')) {
    const parte = files.filter((x) => { const r = relDi(x); return r.startsWith(`${dir}${stem}/`) && !r.slice(`${dir}${stem}/`.length).includes('/'); });
    const per = new Map(parte.map((x) => [x.name, x]));
    if (!per.has('Slidedat.ini')) throw new Error(`MRXS: manca la cartella «${stem}» accanto al file .mrxs (scegli la cartella che li contiene tutti e due)`);
    const apri = async (n) => { const x = per.get(n); if (!x) throw new Error(`MRXS: manca ${n}`); return { size: x.size, leggi: L(x) }; };
    const rec = await recordMrxs(apri), zone = new Map();
    for (const r of rec) { if (!per.has(r.file)) throw new Error(`MRXS: manca ${r.file}`); (zone.get(r.file) || zone.set(r.file, []).get(r.file)).push(r.zona); }
    const ini = per.get('Slidedat.ini'), iniB = new Uint8Array(await ini.arrayBuffer()), iniN = iniPulito(iniB);
    const uscita = [{ rel: 'vetrino.mrxs', blob: new Blob_([SEGNAPOSTO]) }];
    for (const n of [...per.keys()].sort()) {
      const x = per.get(n);
      uscita.push({ rel: `vetrino/${n}`, blob: n === 'Slidedat.ini' ? new Blob_([iniN]) : zone.has(n) ? copiaPulita(x, { zeri: zone.get(n), testi: [] }) : x });
    }
    return { formato: 'mrxs', sorgenti: [f, ...parte], principale: 'vetrino.mrxs', accessorie: rec.length, testi: latino(iniN) === latino(iniB) ? 0 : 1, uscita };
  }
  if (nome.endsWith('.vsi')) {
    const ets = files.filter((x) => { const r = relDi(x); return r.startsWith(`${dir}_${stem}_/`) && /\.ets$/i.test(x.name); });
    if (!ets.length) throw new Error(`VSI: file .ets non trovati (serve la cartella «_${stem}_» accanto al file .vsi: scegli la cartella che li contiene tutti e due)`);
    const grande = ets.reduce((a, b) => (b.size > a.size ? b : a)), um = micronVsi(new Uint8Array(await f.arrayBuffer()));
    return { formato: 'vsi', sorgenti: [f, ...ets], principale: 'vetrino.vsi', accessorie: ets.length - 1, testi: 1, um,
      uscita: [{ rel: 'vetrino.vsi', blob: new Blob_([SEGNAPOSTO + (um ? `um=${um.toFixed(5)}\n` : '')]) }, { rel: 'vetrino_ets/stack1/frame_t.ets', blob: grande }] };
  }
  throw new Error('formato non riconosciuto');
}

// controllo di un vetrino già preparato (nel browser prima dell'invio, sul server dopo il caricamento). apri(rel relativo
// alla cartella serie/vetrino_N) → { size, leggi(o, n) }; principale: 'vetrino.svs', 'vetrino.mrxs', …
export async function problemiInsieme(principale, apri) {
  const p = principale.toLowerCase(), m = await apri(principale);
  if (/\.(svs|tiff?|ndpi|scn|bif)$/.test(p)) return problemi(m.leggi);
  if (p.endsWith('.czi')) return problemiCzi(m.leggi);
  if (p.endsWith('.isyntax')) return problemiIsyntax(m.leggi, m.size);
  if (p.endsWith('.vsi')) return m.size <= 64 ? [] : ['il file .vsi (miniature e metadati) non è stato tolto'];
  if (p.endsWith('.mrxs')) {
    const out = []; if (m.size > 64) out.push('il file .mrxs (foto del vetrino) non è stato tolto');
    const dentro = (n) => apri(`vetrino/${n}`);
    for (const r of await recordMrxs(dentro)) { const x = await dentro(r.file); if (!(await zeroIn(x.leggi, [r.zona]))) out.push(`${r.nome} non azzerato`); }
    const ini = await dentro('Slidedat.ini'); out.push(...iniSospetti(await ini.leggi(0, ini.size)));
    return out;
  }
  return ['formato non riconosciuto'];
}
