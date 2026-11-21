// ---- compressioni: JPEG lossless (sopra) e, caricati solo quando servono, i decodificatori open source in WebAssembly
// (Cornerstone codecs: OpenJPEG per JPEG 2000 / HTJ2K, CharLS per JPEG-LS, libjpeg-turbo per il JPEG standard 8 bit);
// RLE in JavaScript. I file stanno in lib/codec/ e funzionano anche senza rete (versione client).
const TS_RLE = '1.2.840.10008.1.2.5';
const TS_CODEC = {
  '1.2.840.10008.1.2.4.50': 'jpeg', '1.2.840.10008.1.2.4.90': 'j2k', '1.2.840.10008.1.2.4.91': 'j2k',
  '1.2.840.10008.1.2.4.201': 'j2k', '1.2.840.10008.1.2.4.202': 'j2k', '1.2.840.10008.1.2.4.203': 'j2k',
  '1.2.840.10008.1.2.4.80': 'jls', '1.2.840.10008.1.2.4.81': 'jls',
};
const NOMI_TS = { '1.2.840.10008.1.2.4.51': 'JPEG a 12 bit', '1.2.840.10008.1.2.1.99': 'deflate', '1.2.840.10008.1.2.2': 'big endian',
  '1.2.840.10008.1.2.4.100': 'video MPEG-2', '1.2.840.10008.1.2.4.101': 'video MPEG-2', '1.2.840.10008.1.2.4.102': 'video MPEG-4', '1.2.840.10008.1.2.4.103': 'video MPEG-4',
  '1.2.840.10008.1.2.4.104': 'video MPEG-4', '1.2.840.10008.1.2.4.105': 'video MPEG-4', '1.2.840.10008.1.2.4.106': 'video MPEG-4', '1.2.840.10008.1.2.4.107': 'video HEVC', '1.2.840.10008.1.2.4.108': 'video HEVC' };
const CODEC = {};
const CODEC_FILE = { jpeg: ['libjpegturbowasm_decode', 'libjpegturbowasm_decode', 'JPEGDecoder'], j2k: ['openjpegwasm_decode', 'OpenJPEGWASM', 'J2KDecoder'], jls: ['charlswasm_decode', 'CharLSWASM', 'JpegLSDecoder'] };
function caricaCodec(tipo) {
  CODEC[tipo] ||= (async () => {
    const [file, globale, classe] = CODEC_FILE[tipo], base = new URL('./lib/codec/', import.meta.url).href;
    if (!window[globale]) await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = base + file + '.js'; s.onload = ok; s.onerror = () => ko(new Error('decodificatore non disponibile (' + file + ')')); document.head.appendChild(s); });
    const m = await window[globale]({ locateFile: (f) => base + f });
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
  const ab = b instanceof ArrayBuffer ? b : b?.buf;
  if (!(ab instanceof ArrayBuffer)) return;
  let ts = TS_VISTI.get(ab);
  if (ts === undefined) { try { ts = dicomParser.readPart10Header(new Uint8Array(ab)).string('x00020010') || ''; } catch { ts = ''; } TS_VISTI.set(ab, ts); }
  const t = TS_CODEC[(ts || '').trim()];
  if (t && !CODEC[t + '_pronto']) await caricaCodec(t);
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
// file presi dal disco (versione client): si leggono quando servono; i multi-frame restano in memoria (ultimi 3)
const FILE_CACHE = new Map();
async function daFile(v) {
  if (v instanceof Blob) return v.arrayBuffer();
  let p = FILE_CACHE.get(v.file);
  if (!p) { p = v.file.arrayBuffer(); FILE_CACHE.set(v.file, p); while (FILE_CACHE.size > 3) FILE_CACHE.delete(FILE_CACHE.keys().next().value); }
  return { buf: await p, frame: v.frame };
}
const bufDi = (b) => (b && !(b instanceof ArrayBuffer) && b.buf instanceof ArrayBuffer ? b.buf : b);
