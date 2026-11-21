// DICOM sintetici per i test: VR esplicito little endian, piccola immagine 16 bit, campi a scelta.
// Servono a provare l'anonimizzazione con dati del paziente inventati (mai dati veri).
const enc = (s) => Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const LUNGHI = new Set(['OB', 'OW', 'SQ', 'UN', 'UT']);
export function elemento(tag, vr, valore) {
  const g = parseInt(tag.slice(0, 4), 16), e = parseInt(tag.slice(4, 8), 16);
  let v = valore instanceof Uint8Array ? [...valore] : typeof valore === 'number' ? (vr === 'US' ? [valore & 255, valore >> 8] : []) : enc(String(valore));
  if (v.length % 2) v.push(vr === 'UI' || vr === 'OB' ? 0 : 0x20);
  const t = [g & 255, g >> 8, e & 255, e >> 8, ...enc(vr)];
  if (LUNGHI.has(vr)) t.push(0, 0, v.length & 255, (v.length >> 8) & 255, (v.length >> 16) & 255, v.length >>> 24);
  else t.push(v.length & 255, v.length >> 8);
  return [...t, ...v];
}
export const PIXEL = (() => { const p = new Uint8Array(4 * 4 * 2); for (let i = 0; i < 16; i++) { p[i * 2] = (i * 37) & 255; p[i * 2 + 1] = i & 3; } return p; })();
// campi: { 'GGGGEEEE': [VR, valore] }; i campi tecnici di base ci sono già (TC assiale 4×4)
// ts: sintassi di trasferimento; pixelGrezzo: byte di (7FE0,0010) già codificati (es. compresso, lunghezza indefinita)
export function dicomFinto(campi = {}, { senzaPixel = false, ts = '1.2.840.10008.1.2.1', pixelGrezzo = null } = {}) {
  const base = {
    '00080016': ['UI', '1.2.840.10008.5.1.4.1.1.2'], '00080018': ['UI', '1.2.3.4.5.6.7.1'], '00080008': ['CS', 'ORIGINAL\\PRIMARY\\AXIAL'],
    '00080060': ['CS', 'CT'], '0008103e': ['LO', 'TORACE 1.25'], '0020000d': ['UI', '1.2.3.4.5.6.7.2'], '0020000e': ['UI', '1.2.3.4.5.6.7.3'],
    '00200011': ['IS', '3'], '00200013': ['IS', '12'], '00200032': ['DS', '-100\\-100\\-50'], '00200037': ['DS', '1\\0\\0\\0\\1\\0'], '00201041': ['DS', '-50'],
    '00280002': ['US', 1], '00280004': ['CS', 'MONOCHROME2'], '00280010': ['US', 4], '00280011': ['US', 4], '00280030': ['DS', '0.7\\0.7'],
    '00280100': ['US', 16], '00280101': ['US', 12], '00280102': ['US', 11], '00280103': ['US', 0], '00281050': ['DS', '40'], '00281051': ['DS', '400'],
    '00281052': ['DS', '-1024'], '00281053': ['DS', '1'], ...campi,
  };
  if (!senzaPixel && !pixelGrezzo && !('7fe00010' in campi)) base['7fe00010'] = ['OW', PIXEL];
  const ds = [...Object.keys(base).filter((k) => base[k]).sort().flatMap((k) => elemento(k, ...base[k])), ...(pixelGrezzo || [])];
  const meta = [...elemento('00020001', 'OB', new Uint8Array([0, 1])), ...elemento('00020002', 'UI', base['00080016'][1]), ...elemento('00020003', 'UI', base['00080018'][1]), ...elemento('00020010', 'UI', ts)];
  const ul = [   // (0002,0000) lunghezza del gruppo, UL scritto a mano
   0x02, 0x00, 0x00, 0x00, ...enc('UL'), 4, 0, meta.length & 255, (meta.length >> 8) & 255, 0, 0];
  return new Uint8Array([...new Array(128).fill(0), ...enc('DICM'), ...ul, ...meta, ...ds]);
}
// dati del paziente inventati, nei campi che l'anonimizzazione deve togliere
export const PAZIENTE_FINTO = {
  '00100010': ['PN', 'ROSSIGNOLI^MARCELLO'], '00100020': ['LO', 'RSSMRC80A01H501Z'], '00100030': ['DA', '19800101'], '00101040': ['LO', 'VIA GARIBALDI 12 PALERMO'],
  '00080020': ['DA', '20240311'], '00080030': ['TM', '101500'], '00080050': ['SH', 'ACC9988776'], '00080080': ['LO', 'OSPEDALE SANTACROCE'],
  '00080090': ['PN', 'BIANCHERI^LUIGINO'], '00081010': ['SH', 'TCSTAZIONE7'], '00081040': ['LO', 'RADIOLOGIAPRONTO'], '00321032': ['PN', 'VERDOLINI^ANSELMO'],
  '00091010': ['LO', 'PRIVATOCOSTRUTTORE'], '00204000': ['LT', 'COMMENTO CON ROSSIGNOLI'],
};

// voce di una sequenza (FFFE,E000) con i campi dati: { 'GGGGEEEE': [VR, valore] }
export function voce(campi) {
  const c = Object.keys(campi).sort().flatMap((k) => elemento(k, ...campi[k])), n = c.length;
  return new Uint8Array([0xfe, 0xff, 0x00, 0xe0, n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24, ...c]);
}
