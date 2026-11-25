// vetrino-tiff.js (1.326): pulizia e controllo dei vetrini TIFF (Aperio SVS, TIFF piramidali; la stessa struttura hanno
// NDPI, Leica SCN, Ventana BIF, Philips TIFF). Traduzione in JavaScript di strumenti/prepara_vetrino.py (leggi_tiff,
// livelli_tiff, pulisci_tiff, controlla_tiff, pulisci_testo, sospetti): stesse regole, stessi risultati.
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

// stesse lunghezze: si sostituiscono solo i valori
export function pulisciTesto(s) {
  s = s.replace(CHIAVI(), (m, a, b, c) => a + b + 'x'.repeat(c.length));
  s = s.replace(ATTR(), (m, a, b, c) => a + 'x'.repeat(b.length) + c);
  s = s.replace(IMMAGINI_XML(), (m, a, b, c) => a + 'A'.repeat(b.length) + c);
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
