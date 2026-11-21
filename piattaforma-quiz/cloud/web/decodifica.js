// Decodifica DICOM condivisa dalla pagina e dai web worker (decodifica-worker.js): sintassi native, JPEG lossless, RLE,
// JPEG / JPEG 2000 / JPEG-LS (decodificatori WebAssembly in lib/codec), multi-frame e gruppi funzionali «enhanced».
// Usa dicomParser globale (nella pagina dal tag <script>, nel worker caricato da decodifica-worker.js).
import { Decoder } from './lib/lossless-min.js';
let CON_PAZIENTE = false;   // versione client: dati del paziente nell'immagine (mostrati solo a richiesta)
export function impostaPaziente(v) { CON_PAZIENTE = !!v; }
const TS_LOSSLESS = ['1.2.840.10008.1.2.4.70', '1.2.840.10008.1.2.4.57'];
const TS_NATIVI = ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1'];
// ---- compressioni: JPEG lossless (sopra) e, caricati solo quando servono, i decodificatori open source in WebAssembly
// (Cornerstone codecs: OpenJPEG per JPEG 2000 / HTJ2K, CharLS per JPEG-LS, libjpeg-turbo per il JPEG standard 8 bit);
// RLE in JavaScript. I file stanno in lib/codec/ e funzionano anche senza rete (versione client).
// file e memoria possono venire da un'altra finestra (versione client): niente instanceof
const isAB = (x) => x instanceof ArrayBuffer || Object.prototype.toString.call(x) === '[object ArrayBuffer]';
const isBlob = (x) => !!x && typeof x.arrayBuffer === 'function' && typeof x.size === 'number' && typeof x.slice === 'function';
const TS_RLE = '1.2.840.10008.1.2.5';
const TS_CODEC = {
  '1.2.840.10008.1.2.4.50': 'jpeg', '1.2.840.10008.1.2.4.90': 'j2k', '1.2.840.10008.1.2.4.91': 'j2k',
  '1.2.840.10008.1.2.4.201': 'j2k', '1.2.840.10008.1.2.4.202': 'j2k', '1.2.840.10008.1.2.4.203': 'j2k',
  '1.2.840.10008.1.2.4.80': 'jls', '1.2.840.10008.1.2.4.81': 'jls',
  '1.2.840.10008.1.2.4.51': 'jpegjs',                                       // JPEG esteso a 12 bit: decodificatore in JavaScript
};
// video nel DICOM: H.264 (MPEG-4 AVC) decodificato con WebCodecs del browser; MPEG-2 e HEVC non sono decodificabili nel browser
const TS_VIDEO = { '1.2.840.10008.1.2.4.102': 'h264', '1.2.840.10008.1.2.4.103': 'h264', '1.2.840.10008.1.2.4.104': 'h264', '1.2.840.10008.1.2.4.105': 'h264', '1.2.840.10008.1.2.4.106': 'h264', '1.2.840.10008.1.2.4.107': 'hevc', '1.2.840.10008.1.2.4.108': 'hevc' };   // HEVC dalla 1.263 (dove il browser lo decodifica)
const VIDEO_CACHE = new WeakMap();
const NOMI_TS = { '1.2.840.10008.1.2.4.51': 'JPEG a 12 bit', '1.2.840.10008.1.2.1.99': 'deflate', '1.2.840.10008.1.2.2': 'big endian',
  '1.2.840.10008.1.2.4.100': 'video MPEG-2', '1.2.840.10008.1.2.4.101': 'video MPEG-2', '1.2.840.10008.1.2.4.102': 'video MPEG-4', '1.2.840.10008.1.2.4.103': 'video MPEG-4',
  '1.2.840.10008.1.2.4.104': 'video MPEG-4', '1.2.840.10008.1.2.4.105': 'video MPEG-4', '1.2.840.10008.1.2.4.106': 'video MPEG-4', '1.2.840.10008.1.2.4.107': 'video HEVC', '1.2.840.10008.1.2.4.108': 'video HEVC' };
const CODEC = {};
const CODEC_FILE = { jpeg: ['libjpegturbowasm_decode', 'libjpegturbowasm_decode', 'JPEGDecoder'], j2k: ['openjpegwasm_decode', 'OpenJPEGWASM', 'J2KDecoder'], jls: ['charlswasm_decode', 'CharLSWASM', 'JpegLSDecoder'] };
function caricaCodec(tipo) {
  if (tipo === 'jpegjs') return (CODEC.jpegjs ||= import(new URL('./lib/codec/jpegimage.js', import.meta.url).href).then((m) => { CODEC.jpegjs_pronto = m.default; }).catch((e) => { delete CODEC.jpegjs; throw e; }));
  CODEC[tipo] ||= (async () => {
    const [file, globale, classe] = CODEC_FILE[tipo], base = new URL('./lib/codec/', import.meta.url).href;
    if (!globalThis[globale]) {
      if (typeof document !== 'undefined') await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = base + file + '.js'; s.onload = ok; s.onerror = () => ko(new Error('decodificatore non disponibile (' + file + ')')); document.head.appendChild(s); });
      else { const t = await (await fetch(base + file + '.js')).text(); globalThis[globale] = new Function(t + '\nreturn ' + globale + ';')(); }   // web worker
    }
    const m = await globalThis[globale]({ locateFile: (f) => base + f });
    CODEC[tipo + '_pronto'] = new m[classe]();
  })().catch((e) => { delete CODEC[tipo]; throw e; });
  return CODEC[tipo];
}
function decodificaCodec(tipo, fr) {
  const d = CODEC[tipo + '_pronto'];
  if (!d) throw new Error('decodificatore non ancora pronto: riprova');
  d.getEncodedBuffer(fr.length).set(fr);
  d.decode();
  return new Uint8Array(d.getDecodedBuffer()).slice();             // copia: la memoria del modulo viene riusata
}
// prima di decodificare: il decodificatore della sintassi del file deve essere caricato (una volta sola)
const TS_VISTI = new WeakMap();
async function assicuraCodec(b) {
  const ab = isAB(b) ? b : b?.buf;
  if (!isAB(ab)) return;
  let ts = TS_VISTI.get(ab);
  if (ts === undefined) { try { ts = dicomParser.readPart10Header(new Uint8Array(ab)).string('x00020010') || ''; } catch { ts = ''; } TS_VISTI.set(ab, ts); }
  ts = (ts || '').trim();
  const t = TS_CODEC[ts];
  if (t && !CODEC[t + '_pronto']) await caricaCodec(t);
  if (t === 'jpeg' && !CODEC.jpegjs_pronto) await caricaCodec('jpegjs').catch(() => {});   // JPEG a colori senza trasformazione del colore
  if (TS_VIDEO[ts] && !VIDEO_CACHE.has(ab)) await decodificaVideo(ab);
}
// JPEG a colori i cui pixel sono già RGB (marcatore Adobe con trasformazione 0, oppure componenti «R», «G», «B» senza JFIF)
function jpegSenzaTrasformazione(fr) {
  let i = 2, jfif = false, adobe = null, ids = null;
  while (i + 4 < fr.length && fr[i] === 0xff) {
    const m = fr[i + 1], len = (fr[i + 2] << 8) | fr[i + 3];
    if (m === 0xe0 && fr[i + 4] === 0x4a && fr[i + 5] === 0x46) jfif = true;
    if (m === 0xee && fr[i + 4] === 0x41 && fr[i + 5] === 0x64) adobe = fr[i + 4 + 11];
    if (m >= 0xc0 && m <= 0xc3) { const n = fr[i + 9]; ids = []; for (let k = 0; k < n; k++) ids.push(fr[i + 10 + k * 3]); }
    if (m === 0xda) break;
    i += 2 + len;
  }
  return adobe === 0 || (adobe === null && !jfif && ids && ids.join() === '82,71,66');
}
function decodificaJpegJS(fr, cols, rows, bits, senzaTrasf) {
  const J = CODEC.jpegjs_pronto; if (!J) throw new Error('decodificatore JPEG non ancora pronto: riprova');
  const j = new J(); j.parse(fr); if (senzaTrasf) j.colorTransform = false;
  return bits > 8 && j.components.length === 1 ? j.getData16(cols, rows) : j.getData(cols, rows);
}
// HEVC: la stringa del codec (hvc1.profilo.compatibilità.livello.vincoli) si legge da profile_tier_level dell'SPS, dopo aver
// tolto i byte di prevenzione (00 00 03); se il browser non la accetta si provano le più comuni del profilo Main
function codecHevcDaSps(sps) {
  const b = []; for (let i = 2, z = 0; i < sps.length && b.length < 14; i++) { if (z >= 2 && sps[i] === 3) { z = 0; continue; } b.push(sps[i]); z = sps[i] === 0 ? z + 1 : 0; }
  const ptl = b[1], spazio = ptl >> 6, tier = (ptl >> 5) & 1, profilo = ptl & 31;
  let comp = ((b[2] << 24) | (b[3] << 16) | (b[4] << 8) | b[5]) >>> 0, inv = 0; for (let k = 0; k < 32; k++) { inv = (inv << 1) | (comp & 1); comp >>>= 1; }
  const vincoli = b.slice(6, 12); while (vincoli.length > 1 && vincoli.at(-1) === 0) vincoli.pop();
  return `hvc1.${['', 'A', 'B', 'C'][spazio]}${profilo}.${(inv >>> 0).toString(16).toUpperCase()}.${tier ? 'H' : 'L'}${b[12]}.${vincoli.map((x) => x.toString(16).toUpperCase()).join('.')}`;
}
async function codecHevc(sps) {
  if (typeof VideoDecoder === 'undefined') return codecHevcDaSps(sps);
  for (const c of [codecHevcDaSps(sps), 'hvc1.1.6.L120.90', 'hev1.1.6.L120.90', 'hvc1.2.4.L120.90']) try { if ((await VideoDecoder.isConfigSupported({ codec: c })).supported) return c; } catch {}
  throw new Error('questo browser non decodifica i video HEVC (H.265): prova con Safari o con Chrome/Edge su un computer recente');
}
// ---- video H.264 nel DICOM: tutti i fotogrammi decodificati una volta (WebCodecs), poi letti come un multi-frame RGB
async function decodificaVideo(ab) {
  const ds = dicomParser.parseDicom(new Uint8Array(ab)), el = ds.elements.x7fe00010;
  const parti = el.fragments?.length ? el.fragments.map((f) => new Uint8Array(ab, el.dataOffset + f.offset + 8 + 0, f.length)) : [new Uint8Array(ab, el.dataOffset, el.length)];
  // i frammenti partono dopo la tabella degli offset: dicomParser dà offset relativi all'inizio del primo frammento
  const flusso = new Uint8Array(parti.reduce((t, p) => t + p.length, 0)); let o = 0;
  for (const f of el.fragments || []) { const p = new Uint8Array(ab, f.position, f.length); flusso.set(p, o); o += p.length; }
  if (!el.fragments?.length) flusso.set(parti[0]);
  const W = ds.uint16('x00280011'), H = ds.uint16('x00280010'), ms = parseFloat(ds.string('x00181063')) || 33;
  if (typeof VideoDecoder === 'undefined') throw new Error('questo browser non decodifica i video: usa Chrome o Edge aggiornati');
  // unità di accesso (Annex B): si comincia una nuova unità al delimitatore o alla prima fetta di un'immagine
  const hevc = TS_VIDEO[ds.string('x00020010')?.replace(/\0/g, '').trim()] === 'hevc';
  const nal = []; for (let i = 0; i + 3 < flusso.length; i++) if (flusso[i] === 0 && flusso[i + 1] === 0 && (flusso[i + 2] === 1 || (flusso[i + 2] === 0 && flusso[i + 3] === 1))) { const s = flusso[i + 2] === 1 ? i + 3 : i + 4; nal.push([i, s]); i = s - 1; }
  const unita = []; let cur = null, vcl = false, sps = null;
  nal.forEach(([ini, s], k) => {
    const fine = k + 1 < nal.length ? nal[k + 1][0] : flusso.length;
    if (hevc) {   // HEVC: intestazione NAL di 2 byte; 0-31 fette (16-23 immagini chiave), 32-34 VPS/SPS/PPS, 35 delimitatore, 39-40 SEI
      const tipo = (flusso[s] >> 1) & 63, fetta = tipo < 32, primaFetta = fetta && (flusso[s + 2] & 0x80);
      if (tipo === 33 && !sps) sps = flusso.subarray(s, fine);
      if (!cur || tipo === 35 || (vcl && (primaFetta || (tipo >= 32 && tipo <= 34) || tipo === 39))) { cur = { ini, fine, chiave: false }; unita.push(cur); vcl = false; }
      cur.fine = fine; if (tipo >= 16 && tipo <= 23) cur.chiave = true; if (fetta) vcl = true;
      return;
    }
    const tipo = flusso[s] & 31;
    if (tipo === 7 && !sps) sps = flusso.subarray(s, fine);
    const primaFetta = (tipo === 1 || tipo === 5) && (flusso[s + 1] & 0x80);
    if (!cur || tipo === 9 || (vcl && (primaFetta || tipo === 7 || tipo === 8 || tipo === 6))) { cur = { ini, fine, chiave: false }; unita.push(cur); vcl = false; }
    cur.fine = fine; if (tipo === 5) cur.chiave = true; if (tipo === 1 || tipo === 5) vcl = true;
  });
  if (!sps) throw new Error(`video ${hevc ? 'HEVC' : 'H.264'} senza parametri (SPS)`);
  const codec = hevc ? await codecHevc(sps) : 'avc1.' + [sps[1], sps[2], sps[3]].map((x) => x.toString(16).padStart(2, '0')).join('');
  const nMax = Math.max(1, unita.length), scala = W * H * 3 * nMax > 600e6 ? Math.sqrt(600e6 / (W * H * 3 * nMax)) : 1;
  const w = Math.max(2, Math.round(W * scala)), h = Math.max(2, Math.round(H * scala));
  const cv = new OffscreenCanvas(w, h), cx = cv.getContext('2d', { willReadFrequently: true }), fotogrammi = [];
  let errore = null;
  const dec = new VideoDecoder({ output: (f) => { cx.drawImage(f, 0, 0, w, h); f.close(); const d = cx.getImageData(0, 0, w, h).data, rgb = new Uint8Array(w * h * 3);
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { rgb[j] = d[i]; rgb[j + 1] = d[i + 1]; rgb[j + 2] = d[i + 2]; } fotogrammi.push(rgb); }, error: (e) => { errore = e; } });
  dec.configure({ codec, optimizeForLatency: false });
  let t = 0, prima = true;
  for (const u of unita) {
    if (prima && !u.chiave) continue; prima = false;
    dec.decode(new EncodedVideoChunk({ type: u.chiave ? 'key' : 'delta', timestamp: Math.round(t * 1000), data: flusso.subarray(u.ini, u.fine) })); t += ms;
    if (dec.decodeQueueSize > 30) await new Promise((r) => setTimeout(r, 5));
    if (errore) break;
  }
  await dec.flush().catch((e) => { errore ||= e; }); dec.close();
  if (!fotogrammi.length) throw new Error('video non decodificato' + (errore ? ': ' + errore.message : ''));
  VIDEO_CACHE.set(ab, { fotogrammi, w, h, ms });
}
// RLE (PS3.5 G): intestazione di 64 byte con fino a 15 segmenti PackBits; un segmento per byte di ogni campione,
// prima il byte più significativo; il colore è a piani separati
function decodificaRLE(fr, rows, cols, spp, bits) {
  const dv = new DataView(fr.buffer, fr.byteOffset, fr.byteLength), nSeg = dv.getUint32(0, true), n = rows * cols, bps = bits / 8;
  const out = new Uint8Array(n * spp * bps), piano = new Uint8Array(n);
  for (let s = 0; s < nSeg; s++) {
    const ini = dv.getUint32(4 + 4 * s, true), fine = s + 1 < nSeg ? dv.getUint32(8 + 4 * s, true) : fr.byteLength;
    let i = ini, o = 0;
    while (i < fine && o < n) {
      const c = fr[i++];
      if (c < 128) { const k = c + 1; piano.set(fr.subarray(i, i + k), o); i += k; o += k; }
      else if (c > 128) { const k = 257 - c; piano.fill(fr[i++], o, o + k); o += k; }
    }
    const comp = Math.floor(s / bps), byte = bps - 1 - (s % bps);      // segmento → componente e byte (little endian in uscita)
    for (let p = 0; p < n; p++) out[(p * spp + comp) * bps + byte] = piano[p];
  }
  return out;
}
// fotogramma k di un file con pixel incapsulati (anche multi-frame senza tabella degli offset)
function frameIncapsulato(ds, el, k, nFr) {
  if (nFr <= 1) return el.basicOffsetTable?.length ? dicomParser.readEncapsulatedImageFrame(ds, el, 0) : dicomParser.readEncapsulatedPixelDataFromFragments(ds, el, 0, el.fragments.length);
  if (el.basicOffsetTable?.length) return dicomParser.readEncapsulatedImageFrame(ds, el, k);
  if (el.fragments.length === nFr) return dicomParser.readEncapsulatedPixelDataFromFragments(ds, el, k, 1);
  el._bot ||= dicomParser.createJPEGBasicOffsetTable(ds, el);
  return dicomParser.readEncapsulatedImageFrame(ds, el, k, el._bot);
}
// multi-frame «enhanced» (TC, RM, tomosintesi): posizione, orientamento, pixel, rescale e finestra stanno nei gruppi funzionali
const FG = { x00200032: 'x00209113', x00200037: 'x00209116', x00280030: 'x00289110', x00180050: 'x00289110', x00281053: 'x00289145', x00281052: 'x00289145', x00281050: 'x00289132', x00281051: 'x00289132' };
function fgFloat(ds, k, tag, i = 0) {
  const seq = FG[tag]; if (!seq) return undefined;
  for (const g of [ds.elements.x52009230?.items?.[k]?.dataSet, ds.elements.x52009229?.items?.[0]?.dataSet]) {
    const it = g?.elements?.[seq]?.items?.[0]?.dataSet; if (!it) continue;
    const v = it.floatString(tag, i); if (Number.isFinite(v)) return v;
  }
  return undefined;
}
const DS_CACHE = new WeakMap();   // file multi-frame già letti: si legge l'intestazione una volta sola
// 1.263: sintassi «deflate» (1.2.840.10008.1.2.1.99): tutto quello che segue l'intestazione del file (gruppo 0002) è
// compresso con deflate. Si decomprime una volta e si riscrive il file come Explicit VR Little Endian, così il resto del
// visualizzatore lo legge come gli altri. Si usa DecompressionStream («deflate-raw»), presente in tutti i browser recenti.
const TS_DEFLATE = '1.2.840.10008.1.2.1.99', TS_ELE = '1.2.840.10008.1.2.1';
async function sgonfiaDeflate(buf) {
  if (!isAB(buf) || buf.byteLength < 140) return buf;
  const u = new Uint8Array(buf), dv = new DataView(buf);
  if (u[128] !== 0x44 || u[129] !== 0x49 || u[130] !== 0x43 || u[131] !== 0x4d) return buf;
  const voci = []; let pos = 132, ts = '';
  while (pos + 8 <= u.length && dv.getUint16(pos, true) === 0x0002) {
    const el = dv.getUint16(pos + 2, true), vr = String.fromCharCode(u[pos + 4], u[pos + 5]);
    const lungo = ['OB', 'OW', 'OF', 'SQ', 'UT', 'UN'].includes(vr), testa = lungo ? 12 : 8;
    const len = lungo ? dv.getUint32(pos + 8, true) : dv.getUint16(pos + 6, true);
    if (pos + testa + len > u.length) return buf;
    if (el === 0x0010) ts = String.fromCharCode(...u.subarray(pos + testa, pos + testa + len)).replace(/[\0 ]+$/, '');
    voci.push({ el, vr, testa, val: u.subarray(pos + testa, pos + testa + len), raw: u.subarray(pos, pos + testa + len) });
    pos += testa + len;
  }
  if (ts !== TS_DEFLATE) return buf;
  const dati = new Uint8Array(await new Response(new Blob([u.subarray(pos)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  const tsNuovo = new TextEncoder().encode(TS_ELE + '\0');               // 20 caratteri: lunghezza pari
  const corpo = voci.filter((v) => v.el !== 0x0000).map((v) => {
    if (v.el !== 0x0010) return v.raw;
    const r = new Uint8Array(8 + tsNuovo.length), d = new DataView(r.buffer);
    d.setUint16(0, 2, true); d.setUint16(2, 0x0010, true); r[4] = 0x55; r[5] = 0x49; d.setUint16(6, tsNuovo.length, true); r.set(tsNuovo, 8); return r;
  });
  const lg = corpo.reduce((a, b) => a + b.length, 0);
  const gl = new Uint8Array(12), dg = new DataView(gl.buffer); dg.setUint16(0, 2, true); gl[4] = 0x55; gl[5] = 0x4c; dg.setUint16(6, 4, true); dg.setUint32(8, lg, true);
  const out = new Uint8Array(132 + gl.length + lg + dati.length);
  out.set(u.subarray(0, 132)); let o = 132; out.set(gl, o); o += gl.length;
  for (const c of corpo) { out.set(c, o); o += c.length; }
  out.set(dati, o);
  return out.buffer;
}
// file presi dal disco (versione client): si leggono quando servono; i multi-frame restano in memoria (ultimi 3)
const FILE_CACHE = new Map();
async function daFile(v) {
  if (isBlob(v)) return v.arrayBuffer().then(sgonfiaDeflate);
  let p = FILE_CACHE.get(v.file);
  if (!p) { p = v.file.arrayBuffer().then(sgonfiaDeflate); FILE_CACHE.set(v.file, p); while (FILE_CACHE.size > 3) FILE_CACHE.delete(FILE_CACHE.keys().next().value); }
  return { buf: await p, frame: v.frame };
}
const bufDi = (b) => (b && !isAB(b) && isAB(b.buf) ? b.buf : b);

const slopeDi = (ds) => { const v = ds.floatString('x00281053'); return Number.isFinite(v) ? v : 1; };
const interDi = (ds) => { const v = ds.floatString('x00281052'); return Number.isFinite(v) ? v : 0; };
// lato della parete toracica in una mammografia: il bordo (destro o sinistro) dove c'è tessuto,
// mentre dall'altra parte c'è il fondo nero oltre il capezzolo
function latoParete(pix, rows, cols, mono1) {
  const fascia = Math.max(1, Math.round(cols * 0.03)), passo = Math.max(1, Math.floor(rows / 300));
  let sx = 0, dx = 0;
  for (let r = 0; r < rows; r += passo) {
    const o = r * cols;
    for (let c = 0; c < fascia; c++) { sx += pix[o + c]; dx += pix[o + cols - 1 - c]; }
  }
  if (sx === dx) return null;
  return (dx > sx) !== mono1 ? 'dx' : 'sx';
}
// riquadro che contiene la mammella (il resto del detettore è fondo): righe/colonne con
// abbastanza tessuto, così le scritte e i piccoli marcatori non lo allargano
function riquadroTessuto(pix, rows, cols, mono1, parete) {
  const passo = Math.max(1, Math.floor(Math.max(rows, cols) / 400));
  let mi = Infinity, ma = -Infinity;
  for (let r = 0; r < rows; r += passo * 4) for (let c = 0; c < cols; c += passo * 4) { const v = pix[r * cols + c]; if (v < mi) mi = v; if (v > ma) ma = v; }
  const soglia = mono1 ? ma - (ma - mi) * 0.08 : mi + (ma - mi) * 0.08;
  const nr = Math.ceil(rows / passo), nc = Math.ceil(cols / passo), pr = new Uint32Array(nr), pc = new Uint32Array(nc);
  const cMin = new Int32Array(nr).fill(-1), cMax = new Int32Array(nr).fill(-1);   // primo e ultimo pixel di tessuto di ogni riga
  for (let r = 0, i = 0; r < rows; r += passo, i++) for (let c = 0, j = 0; c < cols; c += passo, j++) {
    const v = pix[r * cols + c];
    if (mono1 ? v < soglia : v > soglia) { pr[i]++; pc[j]++; if (cMin[i] < 0) cMin[i] = c; cMax[i] = c; }
  }
  const lim = (a, n) => { const m = n * 0.03; let lo = 0, hi = a.length - 1; while (lo < hi && a[lo] < m) lo++; while (hi > lo && a[hi] < m) hi--; return [lo * passo, (hi + 1) * passo - 1]; };   // il limite superiore lo taglia il chiamante (righe/colonne)
  const [y0, y1] = lim(pr, nc), [x0, x1] = lim(pc, nr);
  if (x1 - x0 < cols * 0.1 || y1 - y0 < rows * 0.1) return null;
  // livello del capezzolo: la riga in cui la mammella si allontana di più dalla parete toracica
  // (mediana mobile su 7 righe contro rumore e marcatori; si usano solo le colonne del riquadro)
  let ny = null;
  if (parete) {
    const est = new Float32Array(nr);
    for (let i = 0; i < nr; i++) {
      if (cMin[i] < 0 || i * passo < y0 || i * passo > y1) continue;
      est[i] = parete === 'dx' ? cols - Math.max(cMin[i], x0) : Math.min(cMax[i], x1) + 1;
    }
    const med = new Float32Array(nr);
    for (let i = 0; i < nr; i++) { const f = []; for (let d = -3; d <= 3; d++) if (i + d >= 0 && i + d < nr) f.push(est[i + d]); f.sort((a, b) => a - b); med[i] = f[f.length >> 1]; }
    let mx = 0; for (let i = 0; i < nr; i++) if (med[i] > mx) mx = med[i];
    let sum = 0, n = 0; for (let i = 0; i < nr; i++) if (mx > 0 && med[i] >= mx * 0.985) { sum += i; n++; }
    if (n) ny = Math.round((sum / n) * passo + passo / 2);
  }
  return { x0, y0, x1: Math.min(cols - 1, x1), y1: Math.min(rows - 1, y1), ...(ny != null ? { ny } : {}) };
}
// finestra automatica di una radiografia: si tolgono i «picchi» di valori costanti (collimatori,
// fondo, bordi saturati) e si prendono i percentili 0,5-99,5 di quello che resta (il paziente)
function finestraRX(pix, sl, it) {
  const passo = Math.max(1, Math.floor(pix.length / 80000)), v = [];
  for (let i = 0; i < pix.length; i += passo) v.push(pix[i] * sl + it);
  if (v.length < 100) return null;
  let mi = Infinity, ma = -Infinity; for (const x of v) { if (x < mi) mi = x; if (x > ma) ma = x; }
  if (!(ma > mi)) return null;
  const NB = 512, w = (ma - mi) / NB, h = new Float64Array(NB), bin = (x) => Math.min(NB - 1, Math.floor((x - mi) / w));
  for (const x of v) h[bin(x)]++;
  const tieni = new Uint8Array(NB).fill(1); tieni[0] = tieni[NB - 1] = 0;
  for (let i = 0; i < NB; i++) {
    if (h[i] <= v.length * 0.02) continue;
    let somma = 0, n = 0;
    for (let d = 5; d <= 12; d++) { if (i - d >= 0) { somma += h[i - d]; n++; } if (i + d < NB) { somma += h[i + d]; n++; } }
    if (!n || h[i] > 6 * (somma / n + 1)) for (let d = -2; d <= 2; d++) if (i + d >= 0 && i + d < NB) tieni[i + d] = 0;
  }
  let r = v.filter((x) => tieni[bin(x)]);
  if (r.length < v.length * 0.2) r = v;
  r.sort((a, b) => a - b);
  const lo = r[Math.floor(r.length * 0.005)], hi = r[Math.floor(r.length * 0.995)];
  return hi > lo ? { wc: (lo + hi) / 2, ww: hi - lo } : null;
}
// contrasto locale (CLAHE): equalizzazione adattiva a riquadri con limite di contrasto, utile nelle
// radiografie con zone molto diverse (es. rachide dorsale e lombare nella stessa lastra).
// Restituisce un'immagine a 12 bit (0-4095) da finestrare come le altre; si calcola una volta sola.
function contrastoLocale(img) {
  if (img._eq) return img._eq;
  const { cols: W, rows: H, pix } = img, sl = img.slope ?? 1, it = img.inter ?? 0, N = W * H;
  const lo = img.wc - img.ww / 2, sc = 255 / Math.max(1, img.ww);
  const g8 = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const x = (pix[i] * sl + it - lo) * sc; g8[i] = x < 0 ? 0 : x > 255 ? 255 : x; }
  const TX = 8, TY = 8, tw = W / TX, th = H / TY, passo = Math.max(1, Math.floor(Math.sqrt(N / 2e6)));
  const mappe = new Float32Array(TX * TY * 256), hist = new Float64Array(256);
  for (let ty = 0; ty < TY; ty++) for (let tx = 0; tx < TX; tx++) {
    hist.fill(0); let n = 0;
    const y0 = Math.floor(ty * th), y1 = Math.floor((ty + 1) * th), x0 = Math.floor(tx * tw), x1 = Math.floor((tx + 1) * tw);
    for (let y = y0; y < y1; y += passo) for (let x = x0, o = y * W; x < x1; x += passo) { hist[g8[o + x]]++; n++; }
    const lim = Math.max(1, (n / 256) * 3); let ecc = 0;
    for (let k = 0; k < 256; k++) if (hist[k] > lim) { ecc += hist[k] - lim; hist[k] = lim; }
    const add = ecc / 256; let cum = 0; const m = (ty * TX + tx) * 256;
    for (let k = 0; k < 256; k++) { cum += hist[k] + add; mappe[m + k] = n ? (cum / n) * 4095 : k * 16; }
  }
  // interpolazione bilineare tra i centri dei riquadri: indici e pesi delle colonne calcolati una volta
  const cx0 = new Int32Array(W), cx1 = new Int32Array(W), cax = new Float32Array(W);
  for (let x = 0; x < W; x++) { const fx = Math.min(TX - 1, Math.max(0, x / tw - 0.5)); cx0[x] = Math.floor(fx) * 256; cx1[x] = Math.min(TX - 1, Math.floor(fx) + 1) * 256; cax[x] = fx - Math.floor(fx); }
  const out = new Uint16Array(N);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(TY - 1, Math.max(0, y / th - 0.5)), ty0 = Math.floor(fy), ay = fy - ty0;
    const r0 = ty0 * TX * 256, r1 = Math.min(TY - 1, ty0 + 1) * TX * 256, o = y * W;
    for (let x = 0; x < W; x++) {
      const k = g8[o + x], ax = cax[x];
      const top = mappe[r0 + cx0[x] + k] + (mappe[r0 + cx1[x] + k] - mappe[r0 + cx0[x] + k]) * ax;
      const bot = mappe[r1 + cx0[x] + k] + (mappe[r1 + cx1[x] + k] - mappe[r1 + cx0[x] + k]) * ax;
      out[o + x] = top + (bot - top) * ay;
    }
  }
  img._eq = { ...img, pix: out, slope: 1, inter: 0, wc: 2048, ww: 4096, _eq: null };
  return img._eq;
}
// valore b della diffusione: etichetta standard (0018,9087); nel visualizzatore scaricabile anche i campi privati dei
// produttori (Siemens 0019,100C · GE 0043,1039, primo valore, spesso + 10⁹ · Philips 2001,1003), che l'anonimizzazione toglie
function valoreB(ds) {
  const e = ds.elements || {};
  try { if (e.x00189087) { const v = ds.double('x00189087'); if (Number.isFinite(v)) return v; } } catch {}
  try { if (e.x0019100c) { const v = parseFloat(ds.string('x0019100c')); if (Number.isFinite(v)) return v; } } catch {}
  try { if (e.x00431039) { let v = parseFloat(String(ds.string('x00431039') || '').split('\\')[0]); if (Number.isFinite(v)) { if (v >= 1e9) v -= 1e9; if (v >= 0 && v < 1e5) return v; } } } catch {}
  try { if (e.x20011003) { const v = ds.float('x20011003'); if (Number.isFinite(v)) return v; } } catch {}
  return null;
}
function decodificaDicom(buf, { grezzo = false, frame = 0 } = {}) {
  if (buf && !isAB(buf) && isAB(buf.buf)) { frame = buf.frame || 0; buf = buf.buf; }   // fotogramma di un multi-frame
  const byteArray = new Uint8Array(buf);
  let ds = DS_CACHE.get(buf);
  if (!ds) { ds = dicomParser.parseDicom(byteArray); if ((parseInt(ds.string('x00280008')) || 1) > 1) DS_CACHE.set(buf, ds); }
  const nFr = parseInt(ds.string('x00280008')) || 1; frame = Math.max(0, Math.min(nFr - 1, frame));
  const ts = (ds.string('x00020010') || '').trim();
  let rows = ds.uint16('x00280010'), cols = ds.uint16('x00280011'), video = null;
  let bits = ds.uint16('x00280100') || 16; const signed = ds.uint16('x00280103') === 1;
  let spp = ds.uint16('x00280002') || 1;
  let fot = (ds.string('x00280004') || 'MONOCHROME2').trim().toUpperCase();
  if (spp !== 1 && spp !== 3) throw new Error('Formato colore non supportato');
  const el = ds.elements.x7fe00010;
  let pix;
  const tipo = (b) => bits === 8 || spp === 3 ? new Uint8Array(b) : signed ? new Int16Array(b) : new Uint16Array(b);
  if (el.encapsulatedPixelData) {
    if (TS_VIDEO[ts]) {                                                       // video H.264: fotogramma già decodificato
      const v = VIDEO_CACHE.get(buf); if (!v) throw new Error('video non ancora decodificato: riprova');
      pix = v.fotogrammi[Math.min(frame, v.fotogrammi.length - 1)]; fot = 'RGB'; spp = 3; bits = 8; rows = v.h; cols = v.w; video = v;
    } else {
    if (!TS_LOSSLESS.includes(ts) && ts !== TS_RLE && !TS_CODEC[ts]) throw new Error('Compressione non supportata: ' + (NOMI_TS[ts] || ts) + (/video/.test(NOMI_TS[ts] || '') ? ' (il browser legge solo i video H.264)' : ''));
    const fr = frameIncapsulato(ds, el, frame, nFr);
    if (TS_LOSSLESS.includes(ts)) {
      const out = new Decoder().decompress(fr.buffer, fr.byteOffset, fr.length);
      pix = tipo(out.buffer ? out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) : out);
    } else if (ts === TS_RLE) pix = tipo(decodificaRLE(fr, rows, cols, spp, bits).buffer);
    else if (TS_CODEC[ts] === 'jpegjs' || (TS_CODEC[ts] === 'jpeg' && spp === 3 && CODEC.jpegjs_pronto && jpegSenzaTrasformazione(fr))) {
      const d = decodificaJpegJS(fr, cols, rows, bits, TS_CODEC[ts] === 'jpeg');
      pix = spp === 3 || bits === 8 ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : signed ? new Int16Array(d.buffer, d.byteOffset, d.length) : d;
      if (spp === 3) fot = 'RGB';
    }
    else { pix = tipo(decodificaCodec(TS_CODEC[ts], fr).buffer); if (spp === 3) fot = 'RGB'; }   // JPEG e JPEG 2000 escono già in RGB
    }
  } else {
    if (!TS_NATIVI.includes(ts)) throw new Error('Sintassi non supportata: ' + (NOMI_TS[ts] || ts));
    const nb = nFr > 1 ? rows * cols * spp * (bits / 8) : el.length, start = byteArray.byteOffset + el.dataOffset + frame * nb;
    pix = tipo(byteArray.buffer.slice(start, start + nb));
    if (spp === 3 && fot === 'YBR_FULL' && ds.uint16('x00280006') !== 1) {     // YBR_FULL non compresso → RGB
      const c = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
      for (let i = 0; i < pix.length; i += 3) { const y = pix[i], cb = pix[i + 1] - 128, cr = pix[i + 2] - 128; pix[i] = c(y + 1.402 * cr); pix[i + 1] = c(y - 0.344136 * cb - 0.714136 * cr); pix[i + 2] = c(y + 1.772 * cb); }
      fot = 'RGB';
    }
  }
  if (spp === 3 && !/^RGB/.test(fot)) throw new Error('Colore ' + fot + ' non supportato');
  // nei multi-frame «enhanced» i valori per fotogramma stanno nei gruppi funzionali
  const num = (tag, i = 0) => { let v = ds.floatString(tag, i); if (!Number.isFinite(v) && nFr > 1) v = fgFloat(ds, frame, tag, i); return Number.isFinite(v) ? v : undefined; };
  const sp = [num('x00280030', 0) || num('x00181164', 0) || 1, num('x00280030', 1) || num('x00181164', 1) || num('x00280030', 0) || num('x00181164', 0) || 1];
  // colore (ecografia Doppler, ecc.): pixel RGB interlacciati; pix diventa la luminanza (per ROI e valori)
  let rgb = null;
  if (spp === 3) {
    const n = rows * cols;
    if (ds.uint16('x00280006') === 1 && !el.encapsulatedPixelData) {        // piani separati RRR…GGG…BBB…
      rgb = new Uint8Array(n * 3); for (let i = 0; i < n; i++) { rgb[i * 3] = pix[i]; rgb[i * 3 + 1] = pix[n + i]; rgb[i * 3 + 2] = pix[2 * n + i]; }
    } else rgb = pix;
    pix = new Uint8Array(n); for (let i = 0; i < n; i++) pix[i] = (rgb[i * 3] * 0.299 + rgb[i * 3 + 1] * 0.587 + rgb[i * 3 + 2] * 0.114) | 0;
  }
  let wc = num('x00281050'), ww = num('x00281051');
  const modRX = /^(CR|DX|DR|RF|XA|PX|RG)$/.test(ds.string('x00080060') || ''), bitsSt = ds.uint16('x00280101') || bits;
  // finestra assente, o «tutta la scala» (es. L 32767 W 65535, o L 2048 W 4096 su 12 bit di molte RX): si calcola dai valori dell'immagine
  if (ww >= 60000 && !rgb) ww = undefined;
  if (modRX && !rgb && ww >= 0.9 * 2 ** bitsSt) ww = undefined;
  // finestra del file fuori scala per questa immagine (es. finestra polmonare -600/1600 rimasta su una RX): si ricalcola
  if (modRX && !rgb && ww > 0) {
    const s = slopeDi(ds), b = interDi(ds), passo = Math.max(1, Math.floor(pix.length / 5000)); let dentro = 0, n = 0;
    for (let i = 0; i < pix.length; i += passo) { const v = pix[i] * s + b; n++; if (v > wc - ww / 2 && v < wc + ww / 2) dentro++; }
    if (dentro < 0.2 * n) ww = undefined;
  }
  if (modRX && !rgb && !(ww > 0)) {
    const f = finestraRX(pix, slopeDi(ds), interDi(ds));
    if (f) { wc = f.wc; ww = f.ww; }
  }
  if (!(ww > 0)) {   // nessuna finestra nel file (mammografia, RX, ecografia): dai valori dell'immagine
    if (rgb) { wc = 128; ww = 256; }
    else {
      const s = slopeDi(ds), b = interDi(ds), campione = [];
      for (let i = 0; i < pix.length; i += Math.max(1, Math.floor(pix.length / 20000))) campione.push(pix[i] * s + b);
      campione.sort((x, y) => x - y);
      const lo = campione[Math.floor(campione.length * 0.01)], hi = campione[Math.floor(campione.length * 0.995)];
      wc = (lo + hi) / 2; ww = Math.max(1, hi - lo);
    }
  }
  const modalita = ds.string('x00080060') || '';
  let ipp = [0, 1, 2].map((i) => num('x00200032', i)).every(Number.isFinite) ? [0, 1, 2].map((i) => num('x00200032', i)) : null;
  let iop = [0, 1, 2, 3, 4, 5].map((i) => num('x00200037', i)).every(Number.isFinite) ? [0, 1, 2, 3, 4, 5].map((i) => num('x00200037', i)) : null;
  // mammografia: destra con la parete toracica a destra, sinistra con la parete a sinistra.
  // Se il file è salvato al contrario (es. tomosintesi sinistra), si specchia l'immagine.
  let parete = modalita === 'MG' && !rgb && !grezzo ? latoParete(pix, rows, cols, fot === 'MONOCHROME1') : null;   // grezzo: pixel come sono nel file (per coprire il testo)
  const lato = (ds.string('x00200062') || ds.string('x00200060') || '').trim().toUpperCase();
  // orientamento standard: destra con righe verso P (parete a destra), sinistra verso A; in alto il lato
  // esterno (CC) o la testa (MLO). Dal campo PatientOrientation se c'è, altrimenti dal contenuto.
  const po = (ds.string('x00200020') || '').toUpperCase().split('\\');
  let girH = false, girV = false;
  if (parete && (lato === 'L' || lato === 'R') && po.length === 2 && po[0] && po[1]) {
    girH = po[0].includes(lato === 'R' ? 'A' : 'P');
    girV = po[1].includes('H') || (!po[1].includes('F') && po[1].includes(lato));
  } else if (parete) girH = (lato === 'L' && parete === 'dx') || (lato === 'R' && parete === 'sx');
  if (girH) {
    for (let r = 0; r < rows; r++) { const o = r * cols; pix.subarray(o, o + cols).reverse(); }
    if (ipp && iop) { ipp = ipp.map((v, i) => v + iop[i] * (cols - 1) * sp[1]); iop = [-iop[0], -iop[1], -iop[2], iop[3], iop[4], iop[5]]; }
  }
  if (girV) {
    const riga = pix.slice(0, cols);
    for (let r = 0; r < rows >> 1; r++) { const a = r * cols, b = (rows - 1 - r) * cols; riga.set(pix.subarray(a, a + cols)); pix.copyWithin(a, b, b + cols); pix.set(riga, b); }
    if (ipp && iop) { ipp = ipp.map((v, i) => v + iop[3 + i] * (rows - 1) * sp[0]); iop = [iop[0], iop[1], iop[2], -iop[3], -iop[4], -iop[5]]; }
  }
  if (girH || girV) parete = latoParete(pix, rows, cols, fot === 'MONOCHROME1');
  const box = parete ? riquadroTessuto(pix, rows, cols, fot === 'MONOCHROME1', parete) : null;
  return {
    rows, cols, pix, rgb, mono1: fot === 'MONOCHROME1', parete, box, rx: modRX,
    slope: num('x00281053') ?? 1, inter: num('x00281052') ?? 0,
    wc, ww,
    spRow: sp[0], spCol: sp[1],
    spessore: num('x00180050'), posizione: num('x00201041'),
    ipp, iop,
    modalita,
    trigger: num('x00181060'), te: num('x00180081'), b: valoreB(ds), bitsSt, conSegno: signed, tipoImmagine: ds.string('x00080008') || '', sequenza: ds.string('x00180024') || '',
    for: ds.string('x00200052') || '',
    // dati dell'esame per l'etichetta della serie: solo campi non identificativi (niente nome, codici, struttura)
    esame: (() => { const st = (t) => (ds.string(t) || '').trim(), n = (t) => num(t);
      return { sesso: st('x00100040'), eta: st('x00101010'), data: st('x00080020'), studio: st('x00081030'), serie: st('x0008103e'), parte: st('x00180015'),
        kv: n('x00180060'), mas: n('x00181152'), ma: n('x00181151'), ctdi: n('x00189345'), tesla: n('x00180087'), tr: n('x00180080'), ti: n('x00180082'), flip: n('x00181314'),
        mdc: st('x00180010'), produttore: st('x00080070'), modello: st('x00081090') }; })(),
    // versione client: dati del paziente, mostrati solo se chi legge li accende (mai nelle esportazioni)
    paziente: CON_PAZIENTE ? { nome: (ds.string('x00100010') || '').replace(/\^+/g, ' ').trim(), pid: (ds.string('x00100020') || '').trim(), nascita: ds.string('x00100030') || '', sesso: (ds.string('x00100040') || '').trim(), esame: ds.string('x00080020') || '', studio: (ds.string('x00081030') || '').trim(), struttura: (ds.string('x00080080') || '').trim() } : undefined,
    // MIP e proiezioni: non hanno un piano vero, niente linee di riferimento
    proiezione: /(^|\\)(PJN|MIP|PROJECTION|MINIP|VR)(\\|$)/i.test(ds.string('x00080008') || '') || ds.string('x00080016') === '1.2.840.10008.5.1.4.1.1.4' && /PROJECTION/i.test(ds.string('x0008103e') || ''),
  };
}

export { codecHevcDaSps, TS_DEFLATE, sgonfiaDeflate, TS_VIDEO, VIDEO_CACHE, decodificaVideo, TS_LOSSLESS, TS_NATIVI, isAB, isBlob, TS_RLE, TS_CODEC, NOMI_TS, CODEC, CODEC_FILE, caricaCodec, decodificaCodec, TS_VISTI, assicuraCodec, decodificaRLE, frameIncapsulato, FG, fgFloat, DS_CACHE, FILE_CACHE, daFile, bufDi, slopeDi, interDi, latoParete, riquadroTessuto, finestraRX, contrastoLocale, decodificaDicom };
