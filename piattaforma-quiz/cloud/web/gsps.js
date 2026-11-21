// Grayscale Softcopy Presentation State (DICOM PS3.3 A.33): le frecce, le misure e le ROI del visualizzatore in un file
// DICOM che un PACS sovrappone alle immagini originali. Scrittore DICOM minimo (Explicit VR Little Endian).
const SQ_LUNGHI = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'UC', 'UR', 'OD', 'OL', 'OV']);
const enc = new TextEncoder();
function valoreBytes(vr, v) {
  if (vr === 'FL' || vr === 'OF') { const a = new Float32Array(v.length); a.set(v); return new Uint8Array(a.buffer); }
  if (vr === 'OD' || vr === 'FD') { const a = new Float64Array(v.length); a.set(v); return new Uint8Array(a.buffer); }
  if (vr === 'OL') { const a = new Uint32Array(v.length); a.set(v); return new Uint8Array(a.buffer); }
  if (vr === 'US') { const b = new Uint8Array(v.length * 2), d = new DataView(b.buffer); v.forEach((x, i) => d.setUint16(i * 2, x, true)); return b; }
  if (vr === 'SL') { const b = new Uint8Array(v.length * 4), d = new DataView(b.buffer); v.forEach((x, i) => d.setInt32(i * 4, x, true)); return b; }
  if (vr === 'UL') { const b = new Uint8Array(v.length * 4), d = new DataView(b.buffer); v.forEach((x, i) => d.setUint32(i * 4, x, true)); return b; }
  if (vr === 'AT') { const l = Array.isArray(v) ? v : [v], b = new Uint8Array(l.length * 4), d = new DataView(b.buffer); l.forEach((x, i) => { d.setUint16(i * 4, parseInt(x.slice(0, 4), 16), true); d.setUint16(i * 4 + 2, parseInt(x.slice(4), 16), true); }); return b; }
  if (vr === 'OB') return v;
  let s = Array.isArray(v) ? v.join('\\') : String(v ?? '');
  let b = enc.encode(s);
  if (b.length % 2) { const c = new Uint8Array(b.length + 1); c.set(b); c[b.length] = vr === 'UI' ? 0 : 0x20; b = c; }
  return b;
}
function intestazione(tag, vr, len) {
  const g = parseInt(tag.slice(0, 4), 16), e = parseInt(tag.slice(4), 16), lungo = SQ_LUNGHI.has(vr);
  const b = new Uint8Array(lungo ? 12 : 8), d = new DataView(b.buffer);
  d.setUint16(0, g, true); d.setUint16(2, e, true); b[4] = vr.charCodeAt(0); b[5] = vr.charCodeAt(1);
  if (lungo) d.setUint32(8, len, true); else d.setUint16(6, len, true);
  return b;
}
function marcatore(e, len = 0) { const b = new Uint8Array(8), d = new DataView(b.buffer); d.setUint16(0, 0xfffe, true); d.setUint16(2, e, true); d.setUint32(4, len, true); return b; }
// insieme di dati: oggetto { 'GGGGEEEE': [VR, valore] }, con le sequenze come [ 'SQ', [ {…}, {…} ] ]
function scriviInsieme(ds, parti) {
  for (const tag of Object.keys(ds).sort()) {
    const [vr, v] = ds[tag];
    if (vr === 'SQ') {
      parti.push(intestazione(tag, 'SQ', 0xffffffff));
      for (const it of v) { parti.push(marcatore(0xe000, 0xffffffff)); scriviInsieme(it, parti); parti.push(marcatore(0xe00d)); }
      parti.push(marcatore(0xe0dd));
    } else { const b = valoreBytes(vr, v); parti.push(intestazione(tag, vr, b.length), b); }
  }
}
export function nuovoUID() {
  const r = crypto.getRandomValues(new Uint8Array(16)); let n = 0n; for (const x of r) n = (n << 8n) | BigInt(x);
  return '2.25.' + n.toString();
}
const ora = () => { const d = new Date(), p = (x) => String(x).padStart(2, '0'); return [`${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`, `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`]; };
/**
 * studio: { uid, data, ora, id, accesso, paziente: { nome, id, nascita, sesso } }
 * immagini: [{ classe, uid, serie, frame?, cols, rows, mono1, wc?, ww?, grafici: [{ tipo: 'POLYLINE'|'ELLIPSE', punti: [x,y,…] }], testi: [{ testo, x, y }] }]
 * Restituisce Uint8Array del file .dcm (Part 10).
 */
export function creaGSPS(studio, immagini, { descrizione = 'Annotazioni radio-quiz', autore = '' } = {}) {
  const PR = '1.2.840.10008.5.1.4.1.1.11.1', uid = nuovoUID(), [data, orario] = ora();
  const rif = (im) => ({ '00081150': ['UI', im.classe], '00081155': ['UI', im.uid], ...(im.frame ? { '00081160': ['IS', String(im.frame)] } : {}) });
  const perSerie = new Map(); for (const im of immagini) { if (!perSerie.has(im.serie)) perSerie.set(im.serie, []); perSerie.get(im.serie).push(im); }
  const ds = {
    '00080005': ['CS', 'ISO_IR 192'], '00080016': ['UI', PR], '00080018': ['UI', uid], '00080012': ['DA', data], '00080013': ['TM', orario],
    '00080020': ['DA', studio.data || ''], '00080030': ['TM', studio.ora || ''], '00080050': ['SH', studio.accesso || ''], '00080060': ['CS', 'PR'], '00080070': ['LO', 'radio-quiz'],
    '00080090': ['PN', ''], '0008103E': ['LO', descrizione],
    '00081115': ['SQ', [...perSerie.entries()].map(([s, l]) => ({ '00081140': ['SQ', l.map(rif)], '0020000E': ['UI', s] }))],
    '00100010': ['PN', studio.paziente?.nome || ''], '00100020': ['LO', studio.paziente?.id || ''], '00100030': ['DA', studio.paziente?.nascita || ''], '00100040': ['CS', studio.paziente?.sesso || ''],
    '0020000D': ['UI', studio.uid], '0020000E': ['UI', nuovoUID()], '00200010': ['SH', studio.id || ''], '00200011': ['IS', '9901'], '00200013': ['IS', '1'],
    '00283110': ['SQ', immagini.filter((im) => im.ww > 0).map((im) => ({ '00081140': ['SQ', [rif(im)]], '00281050': ['DS', String(Math.round(im.wc))], '00281051': ['DS', String(Math.round(im.ww))] }))],
    '00700001': ['SQ', immagini.map((im) => ({
      '00081140': ['SQ', [rif(im)]], '00700002': ['CS', 'RADIOQUIZ'],
      ...(im.testi.length ? { '00700008': ['SQ', im.testi.map((t) => ({ '00700004': ['CS', 'PIXEL'], '00700006': ['ST', t.testo.slice(0, 1024)], '00700014': ['FL', [t.x, t.y]], '00700015': ['CS', 'N'] }))] } : {}),
      ...(im.grafici.length ? { '00700009': ['SQ', im.grafici.map((g) => ({ '00700005': ['CS', 'PIXEL'], '00700020': ['US', [2]], '00700021': ['US', [g.punti.length / 2]], '00700022': ['FL', g.punti], '00700023': ['CS', g.tipo], '00700024': ['CS', 'N'] }))] } : {}),
    }))],
    '0070005A': ['SQ', immagini.map((im) => ({ '00081140': ['SQ', [rif(im)]], '00700052': ['SL', [1, 1]], '00700053': ['SL', [im.cols, im.rows]], '00700100': ['CS', 'SCALE TO FIT'], '00700102': ['IS', ['1', '1']] }))],
    '00700060': ['SQ', [{ '00700002': ['CS', 'RADIOQUIZ'], '00700062': ['IS', '1'], '00700068': ['LO', descrizione] }]],
    '00700080': ['CS', 'RADIOQUIZ'], '00700081': ['LO', descrizione], '00700082': ['DA', data], '00700083': ['TM', orario], '00700084': ['PN', autore],
    '20500020': ['CS', immagini.some((im) => im.mono1) ? 'INVERSE' : 'IDENTITY'],
  };
  if (!ds['00283110'][1].length) delete ds['00283110'];
  const corpo = []; scriviInsieme(ds, corpo);
  const meta = {}, metaParti = [];
  meta['00020001'] = ['OB', new Uint8Array([0, 1])]; meta['00020002'] = ['UI', PR]; meta['00020003'] = ['UI', uid]; meta['00020010'] = ['UI', '1.2.840.10008.1.2.1'];
  meta['00020012'] = ['UI', '2.25.326435988980613525706415826145238737938']; meta['00020013'] = ['SH', 'RADIOQUIZ'];
  scriviInsieme(meta, metaParti);
  const lenMeta = metaParti.reduce((t, b) => t + b.length, 0), gl = valoreBytes('UL', [lenMeta]);
  const tutte = [new Uint8Array(128), enc.encode('DICM'), intestazione('00020000', 'UL', 4), gl, ...metaParti, ...corpo];
  const out = new Uint8Array(tutte.reduce((t, b) => t + b.length, 0)); let o = 0; for (const b of tutte) { out.set(b, o); o += b.length; }
  return out;
}

// file Part 10 (preambolo, meta-informazioni, insieme di dati) in Explicit VR Little Endian
export function part10(ds, classe, uid) {
  const corpo = []; scriviInsieme(ds, corpo);
  const meta = {}, metaParti = [];
  meta['00020001'] = ['OB', new Uint8Array([0, 1])]; meta['00020002'] = ['UI', classe]; meta['00020003'] = ['UI', uid]; meta['00020010'] = ['UI', '1.2.840.10008.1.2.1'];
  meta['00020012'] = ['UI', '2.25.326435988980613525706415826145238737938']; meta['00020013'] = ['SH', 'RADIOQUIZ'];
  scriviInsieme(meta, metaParti);
  const lenMeta = metaParti.reduce((t, b) => t + b.length, 0), gl = valoreBytes('UL', [lenMeta]);
  const tutte = [new Uint8Array(128), enc.encode('DICM'), intestazione('00020000', 'UL', 4), gl, ...metaParti, ...corpo];
  const out = new Uint8Array(tutte.reduce((t, b) => t + b.length, 0)); let o = 0; for (const b of tutte) { out.set(b, o); o += b.length; }
  return out;
}
/**
 * Secondary Capture (immagine chiave) a colori, 8 bit RGB.
 * rgb: Uint8Array cols*rows*3; studio: { uid, data, ora, id, accesso, paziente: { nome, id, nascita, sesso } } oppure null (anonimo: studio nuovo);
 * serie: UID della serie (uguale per tutte le immagini chiave dello stesso invio); numero: 1, 2, …
 */
export function creaSC({ rgb, cols, rows, studio = null, serie, numero = 1, didascalia = '', descrizione = 'Immagini chiave' }) {
  const SC = '1.2.840.10008.5.1.4.1.1.7', uid = nuovoUID(), [data, orario] = ora();
  let px = rgb; if (px.length % 2) { px = new Uint8Array(rgb.length + 1); px.set(rgb); }
  const st = studio || { uid: nuovoUID(), data, ora: orario, id: 'ANONIMO', accesso: '', paziente: { nome: 'ANONIMO', id: 'ANONIMO', nascita: '', sesso: '' } };
  const ds = {
    '00080005': ['CS', 'ISO_IR 192'], '00080008': ['CS', ['DERIVED', 'SECONDARY']], '00080016': ['UI', SC], '00080018': ['UI', uid],
    '00080012': ['DA', data], '00080013': ['TM', orario], '00080020': ['DA', st.data || ''], '00080030': ['TM', st.ora || ''], '00080050': ['SH', st.accesso || ''],
    '00080060': ['CS', 'OT'], '00080064': ['CS', 'WSD'], '00080070': ['LO', 'radio-quiz'], '00080090': ['PN', ''], '0008103E': ['LO', descrizione],
    '00100010': ['PN', st.paziente?.nome || ''], '00100020': ['LO', st.paziente?.id || ''], '00100030': ['DA', st.paziente?.nascita || ''], '00100040': ['CS', st.paziente?.sesso || ''],
    '0020000D': ['UI', st.uid], '0020000E': ['UI', serie], '00200010': ['SH', st.id || ''], '00200011': ['IS', '9902'], '00200013': ['IS', String(numero)],
    '00204000': ['LT', String(didascalia || '').slice(0, 10240)],
    '00280002': ['US', [3]], '00280004': ['CS', 'RGB'], '00280006': ['US', [0]], '00280010': ['US', [rows]], '00280011': ['US', [cols]],
    '00280100': ['US', [8]], '00280101': ['US', [8]], '00280102': ['US', [7]], '00280103': ['US', [0]], '00280301': ['CS', 'NO'],
    '7FE00010': ['OB', px],
  };
  return part10(ds, SC, uid);
}

// ---- Structured Report (Comprehensive SR, PS3.3 A.35.3) con il modello TID 1500 «Imaging Measurement Report»:
// le misure come dati (valore, unità UCUM, codice del concetto) con la regione disegnata (SCOORD) e l'immagine di origine.
const codice = (v, s, m) => ({ '00080100': ['SH', v], '00080102': ['SH', s], '00080104': ['LO', m] });
const voceSR = (rel, tipo, nome, extra = {}) => ({ '0040A010': ['CS', rel], '0040A040': ['CS', tipo], '0040A043': ['SQ', [codice(...nome)]], ...extra });
const ds16 = (x) => { let s = String(+(+x).toPrecision(8)); if (s.length > 16) s = (+x).toExponential(6); return s; };
/**
 * studio: come per creaGSPS; immagini: [{ classe, uid, serie, frame?, sr: [{ nome, valori: [{ codice: [v, s, m], valore, unita: [v, m] }], grafici: [{ tipo, punti }], testo? }] }]
 */
export function creaSR(studio, immagini, { autore = '', descrizione = 'Misure radio-quiz' } = {}) {
  const SR = '1.2.840.10008.5.1.4.1.1.88.33', uid = nuovoUID(), [data, orario] = ora();
  const rif = (im) => ({ '00081150': ['UI', im.classe], '00081155': ['UI', im.uid], ...(im.frame ? { '00081160': ['IS', String(im.frame)] } : {}) });
  const gruppi = []; let n = 0;
  for (const im of immagini) for (const m of im.sr || []) {
    n++;
    const regioni = (m.grafici || []).map((gr) => voceSR('INFERRED FROM', 'SCOORD', ['111030', 'DCM', 'Image Region'], {
      '00700023': ['CS', gr.tipo], '00700022': ['FL', gr.punti], '0040A730': ['SQ', [voceSR('SELECTED FROM', 'IMAGE', ['121112', 'DCM', 'Source of Measurement'], { '00081199': ['SQ', [rif(im)]] })]] }));
    const figli = [voceSR('HAS OBS CONTEXT', 'TEXT', ['112039', 'DCM', 'Tracking Identifier'], { '0040A160': ['UT', `${m.nome} ${n}`] }),
      voceSR('HAS OBS CONTEXT', 'UIDREF', ['112040', 'DCM', 'Tracking Unique Identifier'], { '0040A124': ['UI', nuovoUID()] })];
    for (const v of m.valori || []) figli.push(voceSR('CONTAINS', 'NUM', v.codice, {
      '0040A300': ['SQ', [{ '004008EA': ['SQ', [codice(v.unita[0], 'UCUM', v.unita[1])]], '0040A30A': ['DS', ds16(v.valore)] }]], ...(regioni.length ? { '0040A730': ['SQ', regioni] } : {}) }));
    if (m.testo) figli.push(voceSR('CONTAINS', 'TEXT', ['121106', 'DCM', 'Comment'], { '0040A160': ['UT', String(m.testo).slice(0, 1024)], ...(regioni.length && !(m.valori || []).length ? { '0040A730': ['SQ', regioni] } : {}) }));
    gruppi.push(voceSR('CONTAINS', 'CONTAINER', ['125007', 'DCM', 'Measurement Group'], { '0040A050': ['CS', 'SEPARATE'], '0040A730': ['SQ', figli] }));
  }
  const contenuto = [
    voceSR('HAS CONCEPT MOD', 'CODE', ['121049', 'DCM', 'Language of Content Item and Descendants'], { '0040A168': ['SQ', [codice('it', 'RFC5646', 'Italian')]] }),
    ...(autore ? [voceSR('HAS OBS CONTEXT', 'PNAME', ['121008', 'DCM', 'Person Observer Name'], { '0040A123': ['PN', autore] })] : []),
    voceSR('HAS CONCEPT MOD', 'CODE', ['121058', 'DCM', 'Procedure reported'], { '0040A168': ['SQ', [codice('363679005', 'SCT', 'Imaging procedure')]] }),
    voceSR('CONTAINS', 'CONTAINER', ['126010', 'DCM', 'Imaging Measurements'], { '0040A050': ['CS', 'SEPARATE'], '0040A730': ['SQ', gruppi] }),
  ];
  const perSerie = new Map(); for (const im of immagini) { if (!perSerie.has(im.serie)) perSerie.set(im.serie, []); perSerie.get(im.serie).push(im); }
  const ds = {
    '00080005': ['CS', 'ISO_IR 192'], '00080016': ['UI', SR], '00080018': ['UI', uid], '00080012': ['DA', data], '00080013': ['TM', orario],
    '00080020': ['DA', studio.data || ''], '00080023': ['DA', data], '00080030': ['TM', studio.ora || ''], '00080033': ['TM', orario], '00080050': ['SH', studio.accesso || ''],
    '00080060': ['CS', 'SR'], '00080070': ['LO', 'radio-quiz'], '00080090': ['PN', ''], '0008103E': ['LO', descrizione], '00081111': ['SQ', []],
    '00100010': ['PN', studio.paziente?.nome || ''], '00100020': ['LO', studio.paziente?.id || ''], '00100030': ['DA', studio.paziente?.nascita || ''], '00100040': ['CS', studio.paziente?.sesso || ''],
    '0020000D': ['UI', studio.uid], '0020000E': ['UI', nuovoUID()], '00200010': ['SH', studio.id || ''], '00200011': ['IS', '9903'], '00200013': ['IS', '1'],
    '0040A040': ['CS', 'CONTAINER'], '0040A043': ['SQ', [codice('126000', 'DCM', 'Imaging Measurement Report')]], '0040A050': ['CS', 'SEPARATE'],
    '0040A375': ['SQ', [{ '00081115': ['SQ', [...perSerie.entries()].map(([s, l]) => ({ '00081199': ['SQ', l.map(rif)], '0020000E': ['UI', s] }))], '0020000D': ['UI', studio.uid] }]],
    '0040A372': ['SQ', []], '0040A491': ['CS', 'PARTIAL'], '0040A493': ['CS', 'UNVERIFIED'],
    '0040A504': ['SQ', [{ '00080105': ['CS', 'DCMR'], '0040DB00': ['CS', '1500'] }]],
    '0040A730': ['SQ', contenuto],
  };
  return part10(ds, SR, uid);
}

// ---- Segmentation (PS3.3 A.51), binaria: le regioni misurate (volumi semiautomatici, calcificazioni coronariche) come
// maschere DICOM che 3D Slicer, OHIF e i PACS sovrappongono alle immagini originali. Un fotogramma per fetta e segmento.
/**
 * studio: come creaGSPS; rif: { classe, serie, forUID, iop: [6], sp: [riga, colonna], spessore, passo, rows, cols };
 * segmenti: [{ etichetta, descrizione?, colore?: [L, a, b] 0-65535, algoritmo: 'SEMIAUTOMATIC'|'MANUAL', nomeAlg,
 *   tipo?: [valore, schema, significato], fette: [{ uid, frame?, ipp: [3], maschera: Uint8Array rows*cols (0/1) }] }]
 */
export function creaSEG(studio, rif, segmenti, { descrizione = 'Segmentazioni radio-quiz', autore = '', versione = '' } = {}) {
  const SEG = '1.2.840.10008.5.1.4.1.1.66.4', uid = nuovoUID(), serie = nuovoUID(), org = nuovoUID(), [data, orario] = ora();
  const n = [rif.iop[1] * rif.iop[5] - rif.iop[2] * rif.iop[4], rif.iop[2] * rif.iop[3] - rif.iop[0] * rif.iop[5], rif.iop[0] * rif.iop[4] - rif.iop[1] * rif.iop[3]];
  const lungo = (p) => p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
  // indici di posizione comuni a tutti i segmenti (dal basso verso l'alto lungo la normale)
  const posizioni = [...new Set(segmenti.flatMap((s) => s.fette.map((f) => lungo(f.ipp).toFixed(3))))].map(Number).sort((a, b) => a - b);
  const fotogrammi = [];
  segmenti.forEach((s, k) => [...s.fette].sort((a, b) => lungo(a.ipp) - lungo(b.ipp)).forEach((f) => fotogrammi.push({ seg: k + 1, f, pos: posizioni.indexOf(+lungo(f.ipp).toFixed(3)) + 1 })));
  // pixel a 1 bit, senza riempimento tra i fotogrammi (il primo pixel è il bit meno significativo)
  const px1 = rif.rows * rif.cols, bit = px1 * fotogrammi.length, byte = Math.ceil(bit / 8), dati = new Uint8Array(byte + (byte % 2));
  fotogrammi.forEach((fr, j) => { const m = fr.f.maschera, o = j * px1; for (let i = 0; i < px1; i++) if (m[i]) { const b = o + i; dati[b >> 3] |= 1 << (b & 7); } });
  const istanze = [...new Map(fotogrammi.map((fr) => [fr.f.uid, fr.f])).values()];
  const st = studio;
  const ds = {
    '00080005': ['CS', 'ISO_IR 192'], '00080008': ['CS', ['DERIVED', 'PRIMARY']], '00080016': ['UI', SEG], '00080018': ['UI', uid],
    '00080012': ['DA', data], '00080013': ['TM', orario], '00080020': ['DA', st.data || ''], '00080030': ['TM', st.ora || ''], '00080023': ['DA', data], '00080033': ['TM', orario],
    '00080050': ['SH', st.accesso || ''], '00080060': ['CS', 'SEG'], '00080070': ['LO', 'radio-quiz'], '00080090': ['PN', ''], '0008103E': ['LO', descrizione],
    '00081090': ['LO', 'visualizzatore radio-quiz'], '00181000': ['LO', '1'], '00181020': ['LO', versione || 'radio-quiz'],
    '00081115': ['SQ', [{ '0020000E': ['UI', rif.serie], '0008114A': ['SQ', istanze.map((f) => ({ '00081150': ['UI', rif.classe], '00081155': ['UI', f.uid] }))] }]],
    '00100010': ['PN', st.paziente?.nome || ''], '00100020': ['LO', st.paziente?.id || ''], '00100030': ['DA', st.paziente?.nascita || ''], '00100040': ['CS', st.paziente?.sesso || ''],
    '0020000D': ['UI', st.uid], '0020000E': ['UI', serie], '00200010': ['SH', st.id || ''], '00200011': ['IS', '9903'], '00200013': ['IS', '1'],
    '00200052': ['UI', rif.forUID], '00201040': ['LO', ''],
    '00280002': ['US', [1]], '00280004': ['CS', 'MONOCHROME2'], '00280008': ['IS', String(fotogrammi.length)], '00280010': ['US', [rif.rows]], '00280011': ['US', [rif.cols]],
    '00280100': ['US', [1]], '00280101': ['US', [1]], '00280102': ['US', [0]], '00280103': ['US', [0]], '00282110': ['CS', '00'],
    '00700080': ['CS', 'RADIOQUIZ'], '00700081': ['LO', descrizione], '00700084': ['PN', autore || ''],
    '00620001': ['CS', 'BINARY'],
    '00620002': ['SQ', segmenti.map((s, k) => ({
      '00620004': ['US', [k + 1]], '00620005': ['LO', String(s.etichetta).slice(0, 64)], ...(s.descrizione ? { '00620006': ['ST', String(s.descrizione).slice(0, 1024)] } : {}),
      '00620008': ['CS', s.algoritmo || 'SEMIAUTOMATIC'], ...(s.algoritmo !== 'MANUAL' ? { '00620009': ['LO', s.nomeAlg || 'radio-quiz'] } : {}),
      '0062000D': ['US', s.colore || [55000, 40000, 50000]],
      '00620003': ['SQ', [codice('49755003', 'SCT', 'Morphologically Altered Structure')]],
      '0062000F': ['SQ', [codice(...(s.tipo || ['52988006', 'SCT', 'Lesion']))]] }))],
    '00209221': ['SQ', [{ '00209164': ['UI', org] }]],
    '00209222': ['SQ', [{ '00209164': ['UI', org], '00209165': ['AT', '0062000B'], '00209167': ['AT', '0062000A'], '00209421': ['LO', 'Segmento'] },
      { '00209164': ['UI', org], '00209165': ['AT', '00200032'], '00209167': ['AT', '00209113'], '00209421': ['LO', 'Posizione'] }]],
    '52009229': ['SQ', [{ '00289110': ['SQ', [{ '00280030': ['DS', rif.sp.map(ds16)], '00180050': ['DS', ds16(rif.spessore || rif.passo || 1)], '00180088': ['DS', ds16(rif.passo || rif.spessore || 1)] }]],
      '00209116': ['SQ', [{ '00200037': ['DS', rif.iop.map(ds16)] }]] }]],
    '52009230': ['SQ', fotogrammi.map((fr) => ({
      '00089124': ['SQ', [{ '00082112': ['SQ', [{ '00081150': ['UI', rif.classe], '00081155': ['UI', fr.f.uid], ...(fr.f.frame ? { '00081160': ['IS', String(fr.f.frame)] } : {}),
        '0040A170': ['SQ', [codice('121322', 'DCM', 'Source image for image processing operation')]] }]], '00089215': ['SQ', [codice('113076', 'DCM', 'Segmentation')]] }]],
      '00209111': ['SQ', [{ '00209157': ['UL', [fr.seg, fr.pos]] }]],
      '00209113': ['SQ', [{ '00200032': ['DS', fr.f.ipp.map(ds16)] }]],
      '0062000A': ['SQ', [{ '0062000B': ['US', [fr.seg]] }]] }))],
    '7FE00010': ['OB', dati],
  };
  return part10(ds, SEG, uid);
}
