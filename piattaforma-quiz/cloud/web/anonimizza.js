/* ============================================================
   Anonimizzazione DICOM nel browser (stesse regole di anonimizza.py).
   I dati del paziente non lasciano mai il computer del docente:
   il file viene riscritto qui, e solo la copia anonima viene inviata.

   LISTA BIANCA: si conservano solo i campi tecnici elencati sotto.
   Tutto il resto (nomi, ID, date, orari, ospedale, medici, apparecchio,
   tag privati, sequenze, overlay, commenti) viene eliminato.
   Gli UID vengono rigenerati in modo coerente (le serie restano unite).
   Escluse: secondary capture, structured report, immagini a colori,
   BurnedInAnnotation=YES, tipi immagine da schermata o riepilogo.
   Usa dicomParser (globale).
   ============================================================ */

const TENUTI = new Set([
  // generali
  'x00080005', 'x00080008', 'x00080016', 'x00080060', 'x0008103e',
  // acquisizione (TC / RM)
  'x00180010', 'x00180015', 'x00180020', 'x00180021', 'x00180022', 'x00180023', 'x00180050', 'x00180060',
  'x00180080', 'x00180081', 'x00180082', 'x00180083', 'x00180084', 'x00180086', 'x00180087', 'x00180088',
  'x00180091', 'x00180095', 'x00181150', 'x00181151', 'x00181152', 'x00181210', 'x00181314', 'x00185100',
  // mammografia: proiezione e lato (servono a disporre CC/MLO), intento di presentazione
  'x00185101', 'x00200062', 'x00200060', 'x00080068',
  // geometria e ordine
  'x00200011', 'x00200012', 'x00200013', 'x00200020', 'x00200032', 'x00200037', 'x00201040', 'x00201041',
  // pixel
  'x7fe00010',
]);
const UID_DA_RIGENERARE = new Set(['x00080018', 'x0020000d', 'x0020000e', 'x00200052']);
// gruppo 0028 (pixel): tenuto, tranne i campi di testo libero (come anonimizza.py, che tiene solo i testi tecnici
// RescaleType e WindowCenterWidthExplanation). Image Presentation Comments (0028,4000) è testo libero anche senza VR.
const TESTO_LIBERO = new Set(['LT', 'ST', 'UT', 'UC', 'PN', 'LO', 'SH']);
const TESTI_0028 = new Set(['x00281054', 'x00281055']);
const tieni = (tag, vr) => TENUTI.has(tag) || UID_DA_RIGENERARE.has(tag)
  || (tag.startsWith('x0028') && tag !== 'x00284000' && !(TESTO_LIBERO.has(vr) && !TESTI_0028.has(tag)));
const VR_LUNGHI = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'SV', 'UC', 'UN', 'UR', 'UT', 'UV']);
const TS_IMPLICITO = '1.2.840.10008.1.2';
const TS_BIG = '1.2.840.10008.1.2.2';
const SOSPETTI = ['SCREEN SAVE', 'RESULTS', 'EXECUTED_SURVIEW', 'DOSE_INFO', 'DOSE_REPORT', 'SCREENSHOT', 'PROTOCOL', 'SUMMARY', 'VXTL STATE'];
// campi da cui si raccolgono le "parole vietate" da cercare nel risultato
const TAG_IDENTIFICATIVI = ['x00100010', 'x00100020', 'x00100030', 'x00080050', 'x00080080', 'x00080081', 'x00080090',
  'x00081010', 'x00081040', 'x00081050', 'x00081070', 'x00080092', 'x00321032', 'x00200010', 'x00181000', 'x00101040'];

const testo = (ds, tag) => { try { return (ds.string(tag) || '').trim(); } catch { return ''; } };

function numeri(ds, tag, n) {
  const v = testo(ds, tag).split('\\').map(Number);
  return v.length === n && v.every(Number.isFinite) ? v : null;
}
function tempoAcquisizione(ds) {
  const tp = parseInt(testo(ds, 'x00200100'));                     // Temporal Position Identifier
  if (Number.isFinite(tp)) return tp * 1e6;
  const trig = parseFloat(testo(ds, 'x00181060'));                 // Trigger Time (ms)
  const t = testo(ds, 'x00080032') || testo(ds, 'x00080033');      // Acquisition / Content Time hhmmss.frac
  const sec = t.length >= 6 ? (+t.slice(0, 2)) * 3600 + (+t.slice(2, 4)) * 60 + parseFloat(t.slice(4)) : NaN;
  return Number.isFinite(sec) ? sec * 1000 : Number.isFinite(trig) ? trig : null;
}

function pianoDi(iop) {
  const [r0, r1, r2, c0, c1, c2] = iop;
  const n = [r1 * c2 - r2 * c1, r2 * c0 - r0 * c2, r0 * c1 - r1 * c0];
  const k = [0, 1, 2].reduce((m, i) => (Math.abs(n[i]) > Math.abs(n[m]) ? i : m), 0);
  return { piano: Math.abs(n[k]) < 0.9 ? 'obliqua' : ['sagittale', 'coronale', 'assiale'][k], n };
}
const ORDINE_PIANI = { assiale: 1, coronale: 2, sagittale: 3, obliqua: 4 };

/** Divide le serie miste, come anonimizza.py:
 *  - piani diversi nella stessa serie (pacchetto di ricostruzioni multiplanari) → una serie per piano;
 *  - più immagini nella stessa posizione, con lo stesso numero per posizione (RM dinamica) → una serie per fase,
 *    così il visualizzatore può confrontarle e calcolare le curve di enhancement. */
export function dividiSerie(s) {
  const voci = s.voci;
  if (voci.some((v) => !v.ipp || !v.iop)) return [s];
  for (const v of voci) { const { piano, n } = pianoDi(v.iop); v.piano = piano; v.ordine = v.ipp[0] * n[0] + v.ipp[1] * n[1] + v.ipp[2] * n[2]; }
  const multipiano = new Set(voci.map((v) => v.piano)).size > 1;
  const gruppi = new Map();
  for (const v of voci) { const g = multipiano ? v.piano : ''; (gruppi.get(g) || gruppi.set(g, []).get(g)).push(v); }
  const out = [];
  for (const [piano, g] of gruppi) {
    const perPos = new Map();
    for (const v of g) { const k = v.ipp.map((x) => x.toFixed(1)).join('/'); (perPos.get(k) || perPos.set(k, []).get(k)).push(v); }
    const k = g.length / perPos.size;
    const dinamica = perPos.size >= 2 && k >= 2 && Number.isInteger(k) && [...perPos.values()].every((x) => x.length === k);
    const temporale = dinamica && g.some((v) => v.tempo != null) && new Set(g.map((v) => v.tempo)).size > 1;
    const nFasi = dinamica ? k : 1;
    const parti = Array.from({ length: nFasi }, (_, j) => {
      const etichette = [piano, dinamica ? `${temporale ? 'fase' : 'gruppo'} ${j + 1}/${k}` : ''].filter(Boolean);
      return { ...s, voci: [], piano: piano || null, fase: dinamica ? j + 1 : 0,
        numero: s.numero + (piano ? ORDINE_PIANI[piano] / 10 : 0) + (dinamica ? (j + 1) / 1000 : 0),
        descrizione: etichette.length ? `${s.descrizione} — ${etichette.join(', ')}` : s.descrizione, perPosizione: true };
    });
    for (const pos of perPos.values()) {
      pos.sort((a, b) => (a.tempo ?? 0) - (b.tempo ?? 0) || a.istanza - b.istanza);
      pos.forEach((v, j) => parti[dinamica ? j : 0].voci.push(v));
    }
    out.push(...parti);
  }
  if (out.length === 1 && !multipiano && !out[0].fase) return [s];
  return out.sort((a, b) => a.numero - b.numero);
}

const MESI = 'gen feb mar apr mag giu lug ago set ott nov dic'.split(' ');
const MOD_IT = { CR: 'RX', DX: 'RX', CT: 'TC', MR: 'RM', US: 'Eco', MG: 'Mammografia', PT: 'PET', NM: 'Scintigrafia' };
const ZONE = [[/ginocch|knee/i, 'ginocchio'], [/torac|thorax|chest|polmon/i, 'torace'], [/colonna dors|dorsal/i, 'rachide dorsale'],
  [/lombar|lspine/i, 'rachide lombare'], [/cervical|neck|collo/i, 'collo'], [/orbit/i, 'orbite'], [/encefal|capo|cerebral|cranio|head|brain/i, 'encefalo'],
  [/addom|abdom/i, 'addome'], [/bacino|pelvi/i, 'bacino'], [/ecocardio|cardiac/i, 'cuore'], [/mammell|breast|mammogr/i, 'mammella'],
  [/spalla|shoulder/i, 'spalla'], [/piede|calcagno|foot/i, 'piede'], [/anca|hip/i, 'anca'], [/tiroid|thyro/i, 'tiroide']];
const BP_RX = { CHEST: 'torace', PELVIS: 'bacino', HEAD: 'encefalo', ABDOMEN: 'addome', KNEE: 'ginocchio', SHOULDER: 'spalla', FOOT: 'piede', HAND: 'mano', LSPINE: 'rachide lombare', CSPINE: 'collo' };
const zona = (t) => (ZONE.find(([re]) => re.test(t || '')) || [])[1] || '';
/** Distretto della serie (es. «RX torace», «TC encefalo»), per raggruppare i pregressi e separare i casi. */
function distrettoDi(ds, descr) {
  const m = testo(ds, 'x00080060'), mod = MOD_IT[m] || m;
  let z = mod === 'RX' ? BP_RX[testo(ds, 'x00180015').toUpperCase()] : '';
  if (mod === 'Mammografia') z = 'mammella';
  z = z || zona(testo(ds, 'x00081030')) || zona(descr) || zona(testo(ds, 'x00180015'));
  return `${mod} ${z}`.trim();
}
/** Mese e anno dell'esame ed età all'esame (la data esatta non viene conservata). */
function dataEta(ds) {
  const d = testo(ds, 'x00080020');
  const data = /^\d{6}/.test(d) && +d.slice(4, 6) >= 1 && +d.slice(4, 6) <= 12 ? `${MESI[+d.slice(4, 6) - 1]} ${d.slice(0, 4)}` : '';
  let eta = null;
  const a = /^(\d{3})([YMWD])/.exec(testo(ds, 'x00101010'));
  if (a) eta = a[2] === 'Y' ? +a[1] : 0;
  else {
    const b = testo(ds, 'x00100030');
    if (/^\d{8}$/.test(b) && /^\d{8}/.test(d)) eta = (+d.slice(0, 4)) - (+b.slice(0, 4)) - (d.slice(4, 8) < b.slice(4, 8) ? 1 : 0);
  }
  return { data, eta: eta == null ? null : Math.min(eta, 90) };
}
/** Fattore SUV (peso corporeo) della PET, calcolato qui: peso, dose e orari non vengono conservati. */
function fattoreSUV(ds) {
  try {
    if (testo(ds, 'x00080060') !== 'PT') return null;
    const unita = testo(ds, 'x00541001').toUpperCase();
    if (unita !== 'BQML') return null;
    const peso = parseFloat(testo(ds, 'x00101030')) * 1000;
    const r = ds.elements.x00540016?.items?.[0]?.dataSet; if (!r) return null;
    const dose = parseFloat(testo(r, 'x00181074')), emi = parseFloat(testo(r, 'x00181075'));
    const sec = (t) => (t && t.length >= 6 ? (+t.slice(0, 2)) * 3600 + (+t.slice(2, 4)) * 60 + parseFloat(t.slice(4)) : NaN);
    const t0 = sec(testo(r, 'x00181072') || testo(r, 'x00181078').slice(8));
    const ts = sec(testo(ds, 'x00541102').toUpperCase() === 'START' || !testo(ds, 'x00541102') ? testo(ds, 'x00080031') : testo(ds, 'x00080032'));
    if (![peso, dose, emi, t0, ts].every(Number.isFinite) || dose <= 0 || peso <= 0) return null;
    const dt = ts - t0 + (ts < t0 ? 86400 : 0);
    return peso / (dose * 2 ** (-dt / emi));
  } catch { return null; }
}
/** Regioni d'immagine dell'ecografo (SequenceOfUltrasoundRegions): tutto il resto dell'immagine viene annerito. */
function regioniEco(ds) {
  const items = ds.elements.x00186011?.items || [];
  return items.map((it) => { const r = it.dataSet;
    return { x0: r.uint32('x00186018'), y0: r.uint32('x0018601a'), x1: r.uint32('x0018601c'), y1: r.uint32('x0018601e'),
      formato: r.uint16('x00186012'), ux: r.uint16('x00186024'), uy: r.uint16('x00186026'),
      dx: r.double('x0018602c'), dy: r.double('x0018602e') }; }).filter((r) => Number.isFinite(r.x0) && r.x1 > r.x0 && r.y1 > r.y0);
}

/** Prima lettura: serie, ordine e motivo di esclusione (senza modificare nulla). */
export function analizza(buf, { intestazione = false } = {}) {
  let ds;
  try { ds = dicomParser.parseDicom(new Uint8Array(buf), intestazione ? { untilTag: 'x7fe00010' } : undefined); } catch { return { escluso: 'non è un file DICOM' }; }
  const ts = testo(ds, 'x00020010');
  const sop = testo(ds, 'x00080016');
  const tipo = testo(ds, 'x00080008').toUpperCase().split('\\');
  const fot = testo(ds, 'x00280004').toUpperCase();
  const info = {
    serieUID: testo(ds, 'x0020000e'), serieNum: parseInt(testo(ds, 'x00200011')) || 0,
    descrizione: testo(ds, 'x0008103e'), istanza: parseInt(testo(ds, 'x00200013')) || 0,
    posizione: (() => { const v = ds.floatString('x00201041'); return Number.isFinite(v) ? v : null; })(),
    modalita: testo(ds, 'x00080060'), escluso: null,
    // per riconoscere le serie dinamiche (più fasi nella stessa serie)
    ipp: numeri(ds, 'x00200032', 3), iop: numeri(ds, 'x00200037', 6),
    studio: testo(ds, 'x0020000d'), dataStudio: testo(ds, 'x00080020') + testo(ds, 'x00080030'),   // solo per ordinare gli studi: non viene salvata
    tempo: tempoAcquisizione(ds),
    ...dataEta(ds), suv: fattoreSUV(ds),
  };
  info.regione = distrettoDi(ds, info.descrizione);
  info.ts = testo(ds, 'x00020010');
  info.nFrames = parseInt(testo(ds, 'x00280008')) || 1;
  info.frameMs = ds.floatString('x00181063') || null;
  // multi-frame «enhanced»: posizione e orientamento di ogni fotogramma (gruppi funzionali)
  if (info.nFrames > 1 && ds.elements.x52009230?.items?.length) {
    const fg = (k, seq, tag, n) => { for (const g of [ds.elements.x52009230.items[k]?.dataSet, ds.elements.x52009229?.items?.[0]?.dataSet]) { const it = g?.elements?.[seq]?.items?.[0]?.dataSet; const v = it ? numeri(it, tag, n) : null; if (v) return v; } return null; };
    info.frames = Array.from({ length: info.nFrames }, (_, k) => ({ ipp: fg(k, 'x00209113', 'x00200032', 3), iop: fg(k, 'x00209116', 'x00200037', 6) }));
    if (!info.iop) info.iop = info.frames[0]?.iop || null;
  }
  // mammografia: nome della proiezione dal file (lato + CC/MLO), come nell'importazione dal Mac
  const vp = testo(ds, 'x00185101').toUpperCase(), lat = (testo(ds, 'x00200062') || testo(ds, 'x00200060')).toUpperCase();
  if (info.modalita === 'MG' && vp && (lat === 'L' || lat === 'R')) info.vistaMG = `${lat}${vp} (${lat === 'R' ? 'destra' : 'sinistra'})`;
  info.eco = info.modalita === 'US';
  if (!ds.elements.x7fe00010) info.escluso = 'senza immagine';
  else if (ts === TS_BIG) info.escluso = 'formato big endian non supportato';
  else if (sop.startsWith('1.2.840.10008.5.1.4.1.1.7')) info.escluso = 'secondary capture';
  else if (sop.startsWith('1.2.840.10008.5.1.4.1.1.88')) info.escluso = 'referto strutturato';
  else if (testo(ds, 'x00280301').toUpperCase() === 'YES') info.escluso = 'testo impresso nell\'immagine';
  else if (tipo.some((t) => SOSPETTI.includes(t))) info.escluso = 'schermata / riepilogo';
  else if ((sop.startsWith('1.2.840.10008.5.1.4.1.1.1.') && sop.endsWith('.1') && sop.split('.').length === 12) || testo(ds, 'x00080068').toUpperCase() === 'FOR PROCESSING')
    info.escluso = 'immagine grezza «for processing»';
  else if (info.eco && (parseInt(testo(ds, 'x00280008')) || 1) > 1) info.escluso = 'filmato ecografico (multi-frame): si importa dall\'archivio .zip, non dal browser';
  else if (info.eco && !regioniEco(ds).length) info.escluso = 'ecografia senza regioni d\'immagine (il testo non si può coprire)';
  else if (info.eco && ds.elements.x7fe00010.encapsulatedPixelData && !['1.2.840.10008.1.2.4.50', '1.2.840.10008.1.2.4.51'].includes(ts)) info.escluso = 'ecografia con compressione non supportata';
  else if (!info.eco && fot && fot !== 'MONOCHROME1' && fot !== 'MONOCHROME2') info.escluso = 'immagine a colori';
  else if ((parseInt(testo(ds, 'x00280008')) || 1) > 1) info.escluso = 'multi-frame (non ancora supportato dal visualizzatore)';
  return info;
}

/** Parole che non devono comparire nel file anonimo (nome, ID, ospedale...). */
export function paroleVietate(buf) {
  const ds = dicomParser.parseDicom(new Uint8Array(buf), { untilTag: 'x7fe00010' });
  const out = new Set();
  for (const t of TAG_IDENTIFICATIVI) {
    for (const p of testo(ds, t).toUpperCase().split(/[\^\s,.;:/\\-]+/)) {
      if (p.length >= 4 && p !== 'ANONIMO' && !/^CASO/.test(p)) out.add(p);   // non i segnaposto già anonimi
    }
  }
  return out;
}

const enc = new TextEncoder();
async function nuovoUID(sale, vecchio) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(sale + vecchio)));
  let n = 0n;
  for (let i = 0; i < 16; i++) n = (n << 8n) | BigInt(h[i]);
  return '2.25.' + n.toString();
}

// --- scrittura
// Campi tenuti ma malformati. Un file con una lunghezza sbagliata può far «inghiottire» a un campo tenuto
// (es. la modalità) i campi che lo seguono, nome del paziente compreso: copiandone i byte, quei dati uscirebbero
// nascosti dopo un carattere nullo, dove la verifica del testo non guarda. Regola: dopo il testo di un campo testuale
// sono ammessi solo spazi o zeri di riempimento; un campo binario tenuto non può contenere parole leggibili.
// Altrimenti il file non è conforme e si esclude, come le immagini che non si possono anonimizzare con certezza.
const BINARI_0028 = new Set(['0002', '0006', '0010', '0011', '0100', '0101', '0102', '0103', '0106', '0107', '0108', '0109', '0120', '1101', '1102',
  '1103', '1104', '1201', '1202', '1203', '1221', '1222', '1223', '3002', '3006', '7fe0']);
const VR_BINARI = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'US', 'SS', 'UL', 'SL', 'FL', 'FD', 'AT', 'SV', 'UV', 'UN']);
export function campoConforme(tag, vr, b) {
  const binario = vr && vr !== 'UN' ? VR_BINARI.has(vr) : tag.startsWith('x0028') && BINARI_0028.has(tag.slice(5));
  if (!binario) {
    let k = 0;
    while (k < b.length && (b[k] >= 0x20 || b[k] === 9 || b[k] === 10 || b[k] === 12 || b[k] === 13 || b[k] === 0x1b)) k++;
    for (let j = k; j < b.length; j++) if (b[j] !== 0 && b[j] !== 0x20) return false;
    return true;
  }
  // binario: nessuna sequenza di 6 o più lettere (un nome inghiottito)
  let lettere = 0;
  for (const c of b) { if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) { if (++lettere >= 6) return false; } else if (c !== 0x5e && c !== 0x20) lettere = 0; }
  return true;
}
function valoreTesto(s, vr) {
  const b = Array.from(s, (c) => c.charCodeAt(0) & 0xff);
  if (b.length % 2) b.push(vr === 'UI' ? 0 : 0x20);
  return new Uint8Array(b);
}
class Scrittore {
  constructor() { this.parti = []; this.n = 0; }
  push(u8) { this.parti.push(u8); this.n += u8.length; }
  intest(gruppo, elem, vr, len, esplicito) {
    const lungo = VR_LUNGHI.has(vr);
    const b = new DataView(new ArrayBuffer(esplicito ? (lungo ? 12 : 8) : 8));
    b.setUint16(0, gruppo, true); b.setUint16(2, elem, true);
    if (!esplicito) b.setUint32(4, len, true);
    else {
      b.setUint8(4, vr.charCodeAt(0)); b.setUint8(5, vr.charCodeAt(1));
      if (lungo) b.setUint32(8, len, true); else b.setUint16(6, len, true);
    }
    this.push(new Uint8Array(b.buffer));
  }
  elemento(tag, vr, valore, esplicito) {
    const g = parseInt(tag.slice(1, 5), 16), e = parseInt(tag.slice(5, 9), 16);
    this.intest(g, e, vr, valore.length, esplicito); this.push(valore);
  }
  unisci() { const o = new Uint8Array(this.n); let p = 0; for (const x of this.parti) { o.set(x, p); p += x.length; } return o; }
}

// VR di ripiego per i nuovi elementi quando il file è a VR implicito
const VR_NOTI = { x00100010: 'PN', x00100020: 'LO', x00120062: 'CS', x00120063: 'LO' };

/**
 * Riscrive il file tenendo solo la lista bianca.
 * @returns Uint8Array del nuovo file DICOM
 */
export async function anonimizza(buf, { idCaso, sale, oscura = null, decodifica = null }) {
  const byteArray = new Uint8Array(buf);
  const ds = dicomParser.parseDicom(byteArray);
  if (testo(ds, 'x00080060') === 'US') return anonimizzaEco(byteArray, ds, { idCaso, sale });
  if (oscura?.length) return anonimizzaOscurando(byteArray, ds, { idCaso, sale, oscura, decodifica });
  return scriviAnonimo(byteArray, ds, { idCaso, sale });
}
// Testo impresso nell'immagine (nomi, date, struttura): le zone indicate vengono coperte con il colore
// del fondo direttamente nei pixel, e il file viene riscritto non compresso. I pixel originali non partono.
async function anonimizzaOscurando(byteArray, ds, { idCaso, sale, oscura, decodifica }) {
  const rows = ds.uint16('x00280010'), cols = ds.uint16('x00280011'), bits = ds.uint16('x00280100') || 16;
  const el = ds.elements.x7fe00010, mono1 = testo(ds, 'x00280004').toUpperCase() === 'MONOCHROME1';
  let pix;
  if (el.encapsulatedPixelData) {
    if (!decodifica) throw new Error('immagine compressa: impossibile coprire il testo');
    pix = decodifica(byteArray.slice().buffer).pix;
  } else {
    const grezzi = byteArray.slice(el.dataOffset, el.dataOffset + el.length);
    pix = bits === 8 ? grezzi : ds.uint16('x00280103') === 1 ? new Int16Array(grezzi.buffer, 0, rows * cols) : new Uint16Array(grezzi.buffer, 0, rows * cols);
  }
  let mi = Infinity, ma = -Infinity;
  for (let i = 0; i < pix.length; i += 7) { const v = pix[i]; if (v < mi) mi = v; if (v > ma) ma = v; }
  const fondo = mono1 ? ma : mi;
  for (const b of oscura) {
    const x0 = Math.max(0, Math.floor(b.x0)), x1 = Math.min(cols - 1, Math.ceil(b.x1)), y0 = Math.max(0, Math.floor(b.y0)), y1 = Math.min(rows - 1, Math.ceil(b.y1));
    for (let y = y0; y <= y1; y++) pix.fill(fondo, y * cols + x0, y * cols + x1 + 1);
  }
  const dati = new Uint8Array(pix.buffer, pix.byteOffset, rows * cols * (bits === 8 ? 1 : 2)).slice();
  return scriviAnonimo(byteArray, ds, { idCaso, sale, sost: { x7fe00010: [bits === 8 ? 'OB' : 'OW', dati] }, ts: '1.2.840.10008.1.2.1' });
}
// Ecografia: i pixel vengono decodificati (anche JPEG), si tiene solo l'interno delle regioni d'immagine,
// si annerisce il resto (nome, struttura, data, ora) e si riscrive non compresso in RGB.
async function anonimizzaEco(byteArray, ds, opz) {
  const rows = ds.uint16('x00280010'), cols = ds.uint16('x00280011'), spp = ds.uint16('x00280002') || 1;
  const ts = testo(ds, 'x00020010'), el = ds.elements.x7fe00010, fot = testo(ds, 'x00280004').toUpperCase();
  let rgb;
  if (el.encapsulatedPixelData) {
    const fr = el.basicOffsetTable?.length ? dicomParser.readEncapsulatedImageFrame(ds, el, 0) : dicomParser.readEncapsulatedPixelDataFromFragments(ds, el, 0, el.fragments.length);
    const bmp = await createImageBitmap(new Blob([fr], { type: 'image/jpeg' }));
    const cv = new OffscreenCanvas(cols, rows), cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0);
    const d = cx.getImageData(0, 0, cols, rows).data; rgb = new Uint8Array(rows * cols * 3);
    for (let i = 0, j = 0; i < rows * cols; i++, j += 4) { rgb[i * 3] = d[j]; rgb[i * 3 + 1] = d[j + 1]; rgb[i * 3 + 2] = d[j + 2]; }
  } else {
    const px = byteArray.subarray(el.dataOffset, el.dataOffset + el.length), n = rows * cols;
    rgb = new Uint8Array(n * 3);
    if (spp === 1) { const b = ds.uint16('x00280100') === 16 ? 2 : 1; for (let i = 0; i < n; i++) { const v = b === 2 ? px[i * 2 + 1] : px[i]; rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = fot === 'MONOCHROME1' ? 255 - v : v; } }
    else if (ds.uint16('x00280006') === 1) { for (let i = 0; i < n; i++) { rgb[i * 3] = px[i]; rgb[i * 3 + 1] = px[n + i]; rgb[i * 3 + 2] = px[2 * n + i]; } }
    else rgb.set(px.subarray(0, n * 3));
    if (fot.startsWith('YBR')) for (let i = 0; i < n; i++) {   // YBR_FULL non compresso → RGB
      const y = rgb[i * 3], cb = rgb[i * 3 + 1] - 128, cr = rgb[i * 3 + 2] - 128, c = (v) => Math.max(0, Math.min(255, Math.round(v)));
      rgb[i * 3] = c(y + 1.402 * cr); rgb[i * 3 + 1] = c(y - 0.344136 * cb - 0.714136 * cr); rgb[i * 3 + 2] = c(y + 1.772 * cb);
    }
  }
  const reg = regioniEco(ds), dentro = new Uint8Array(rows * cols);
  for (const r of reg) for (let y = Math.max(0, r.y0); y <= Math.min(rows - 1, r.y1); y++) dentro.fill(1, y * cols + Math.max(0, r.x0), y * cols + Math.min(cols - 1, r.x1) + 1);
  for (let i = 0; i < rows * cols; i++) if (!dentro[i]) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = 0;
  const us16 = (v) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; };
  const sost = { x00280002: ['US', us16(3)], x00280004: ['CS', valoreTesto('RGB', 'CS')], x00280006: ['US', us16(0)], x00280100: ['US', us16(8)],
    x00280101: ['US', us16(8)], x00280102: ['US', us16(7)], x00280103: ['US', us16(0)], x7fe00010: ['OB', rgb] };
  const r2d = reg.find((r) => r.formato === 1 && r.ux === 3 && r.uy === 3);
  if (r2d && r2d.dx > 0 && r2d.dy > 0) sost.x00280030 = ['DS', valoreTesto(`${(r2d.dy * 10).toFixed(6)}\\${(r2d.dx * 10).toFixed(6)}`, 'DS')];
  return scriviAnonimo(byteArray, ds, { ...opz, sost, ts: '1.2.840.10008.1.2.1', togli: ['x00282110', 'x00282112', 'x00282114', 'x00280008'] });
}
async function scriviAnonimo(byteArray, ds, { idCaso, sale, sost = null, ts: tsNuovo = null, togli = [] }) {
  const ts = tsNuovo || testo(ds, 'x00020010') || TS_IMPLICITO;
  if (ts === TS_BIG) throw new Error('big endian non supportato');
  const esplicito = ts !== TS_IMPLICITO;
  const elementi = [];   // { tag, vr, valore (Uint8Array) | grezzo: {da,a}, indefinito }

  for (const [tag, el] of Object.entries(ds.elements)) {
    if (!tag.startsWith('x') || tag.startsWith('x0002')) continue;
    const gruppo = parseInt(tag.slice(1, 5), 16);
    if (gruppo % 2 === 1) continue;                       // tag privati
    if (!tieni(tag, el.vr) || togli.includes(tag) || (sost && sost[tag])) continue;
    const vr = el.vr || (tag === 'x7fe00010' ? 'OW' : 'UN');
    if (vr === 'SQ' || el.items) continue;                // nessuna sequenza
    if (UID_DA_RIGENERARE.has(tag)) {
      const v = testo(ds, tag);
      if (v) elementi.push({ tag, vr: 'UI', valore: valoreTesto(await nuovoUID(sale, v), 'UI') });
      continue;
    }
    if (tag === 'x7fe00010' && el.encapsulatedPixelData) {
      elementi.push({ tag, vr: 'OB', grezzo: [el.dataOffset, el.dataOffset + el.length], indefinito: true });
    } else {
      const valore = byteArray.slice(el.dataOffset, el.dataOffset + el.length);
      if (tag !== 'x7fe00010' && !campoConforme(tag, el.vr, valore)) throw new Error(`campo ${tag} non conforme (lunghezza o contenuto): file escluso per prudenza`);
      elementi.push({ tag, vr, valore });
    }
  }
  if (sost) for (const [tag, [vr, valore]] of Object.entries(sost)) elementi.push({ tag, vr, valore: valore.length % 2 ? Uint8Array.from([...valore, 0]) : valore });
  const nuovo = (tag, s) => elementi.push({ tag, vr: VR_NOTI[tag], valore: valoreTesto(s, VR_NOTI[tag]) });
  nuovo('x00100010', `ANONIMO^${idCaso}`);
  nuovo('x00100020', idCaso);
  nuovo('x00120062', 'YES');
  nuovo('x00120063', 'PS3.15 Basic Profile - whitelist');
  elementi.sort((a, b) => (a.tag < b.tag ? -1 : 1));

  // file meta (sempre VR esplicito little endian)
  const sopClass = testo(ds, 'x00080016');
  const sopInst = await nuovoUID(sale, testo(ds, 'x00080018') || String(Math.random()));
  const meta = new Scrittore();
  meta.elemento('x00020001', 'OB', new Uint8Array([0, 1]), true);
  meta.elemento('x00020002', 'UI', valoreTesto(sopClass, 'UI'), true);
  meta.elemento('x00020003', 'UI', valoreTesto(sopInst, 'UI'), true);
  meta.elemento('x00020010', 'UI', valoreTesto(ts, 'UI'), true);
  meta.elemento('x00020012', 'UI', valoreTesto('2.25.270129419158414104513573806347245385541', 'UI'), true);
  meta.elemento('x00020013', 'SH', valoreTesto('QUIZ_ANON', 'SH'), true);
  const corpoMeta = meta.unisci();

  const w = new Scrittore();
  w.push(new Uint8Array(128)); w.push(enc.encode('DICM'));
  const gl = new Uint8Array(4); new DataView(gl.buffer).setUint32(0, corpoMeta.length, true);
  w.elemento('x00020000', 'UL', gl, true);
  w.push(corpoMeta);
  for (const e of elementi) {
    const g = parseInt(e.tag.slice(1, 5), 16), el = parseInt(e.tag.slice(5, 9), 16);
    if (e.grezzo) {
      w.intest(g, el, 'OB', 0xffffffff, esplicito);
      w.push(byteArray.subarray(e.grezzo[0], e.grezzo[1]));
    } else {
      w.intest(g, el, e.vr, e.valore.length, esplicito);
      w.push(e.valore);
    }
  }
  return w.unisci();
}

/** Controllo dell'anonimato di un file già caricato (casi proposti dagli iscritti, prima della pubblicazione):
 *  stessa lista bianca dell'anonimizzazione. Restituisce l'elenco dei problemi (vuoto = intestazione anonima);
 *  non riporta mai i valori trovati, solo il campo. */
const AGGIUNTI = new Set(['x00100010', 'x00100020', 'x00120062', 'x00120063']);
const META_OK = new Set(['x00020000', 'x00020001', 'x00020002', 'x00020003', 'x00020010', 'x00020012', 'x00020013']);
const SOSPETTE = /ospedal|presidio|policlinic|azienda|\basp\b|\baou?\b|\basl\b|irccs|clinica|casa di cura|\bdott|\bdr\.|\bprof\.|\bvia\b|viale|piazza|@|\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i;
const UID_NOTI = new Set(['x00080016', ...UID_DA_RIGENERARE]);
export function controllaIntestazione(u8, idCaso) {
  let ds; try { ds = dicomParser.parseDicom(u8, { untilTag: 'x7fe00010' }); } catch { return ['file non leggibile']; }
  const p = new Set();
  for (const [tag, el] of Object.entries(ds.elements)) {
    if (tag === 'x7fe00010') continue;
    if (tag.startsWith('x0002')) { if (!META_OK.has(tag)) p.add(`campo di intestazione non previsto (${tag})`); continue; }
    if (parseInt(tag.slice(1, 5), 16) % 2 === 1) { p.add(`campo privato (${tag})`); continue; }
    if (el.items || el.vr === 'SQ') { p.add(`sequenza non prevista (${tag})`); continue; }
    if (!tieni(tag, el.vr) && !AGGIUNTI.has(tag)) { p.add(`campo non ammesso dall'anonimizzazione (${tag})`); continue; }
    if ((el.vr === 'DA' || el.vr === 'DT') && testo(ds, tag)) p.add(`data presente (${tag})`);
    if (el.vr === 'PN' && tag !== 'x00100010') p.add(`nome di persona (${tag})`);
    // con VR implicito el.vr manca: gli UID noti non sono testo (1.2.840… sembrava una data: falso allarme, 15/11/2026)
    const vr = el.vr || (UID_NOTI.has(tag) ? 'UI' : tag.startsWith('x0028') ? 'US' : undefined);
    if (!['UI', 'OB', 'OW', 'US', 'SS', 'UL', 'SL', 'FL', 'FD', 'AT', 'OF', 'OD'].includes(vr) && SOSPETTE.test(testo(ds, tag))) p.add(`testo sospetto (${tag})`);
  }
  if (!testo(ds, 'x00100010').startsWith('ANONIMO')) p.add('nome del paziente non anonimo');
  if (testo(ds, 'x00100020') !== idCaso) p.add('codice del paziente diverso dal caso');
  return [...p];
}

/** Controllo finale: rilegge il file anonimo e cerca le parole vietate nei campi di testo. */
export function verifica(u8, vietate) {
  const ds = dicomParser.parseDicom(u8, { untilTag: 'x7fe00010' });
  for (const [tag, el] of Object.entries(ds.elements)) {
    if (tag === 'x7fe00010') continue;
    const g = parseInt(tag.slice(1, 5), 16);
    if (g % 2 === 1) return `tag privato ${tag}`;
    if (['UI', 'OB', 'OW', 'US', 'SS', 'UL', 'SL', 'FL', 'FD', 'AT'].includes(el.vr)) continue;
    const v = testo(ds, tag).toUpperCase();
    if (/^(x0010|x0012)/.test(tag) && !['x00100010', 'x00100020', 'x00120062', 'x00120063'].includes(tag)) return `campo paziente ${tag}`;
    for (const p of vietate) if (p && v.includes(p)) return `"${p}" trovato in ${tag}`;
  }
  return null;
}
