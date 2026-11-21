// vetrini-ann.js — annotazioni dei vetrini: geometria (lunghezza, area, perimetro), conteggio dei punti nei campi e nelle
// aree, salvataggio nel browser ed esportazione/importazione nel formato DICOM «Microscopy Bulk Simple Annotations»
// (PS3.3 A.87, SOP 1.2.840.10008.5.1.4.1.1.91.1), leggibile da altri visualizzatori di vetrini (per esempio Slim, QuPath
// con le estensioni DICOM, highdicom).
// Coordinate: pixel del livello pieno, origine nell'angolo in alto a sinistra del primo pixel (come nel DICOM, «VOLUME»).
// Tipi: dist e freccia (2 punti), poligono (n punti, chiuso), ellisse e hpf (centro c, semiassi rx, ry), punto.
import { part10, nuovoUID } from './gsps.js';

export const SOP_ANN = '1.2.840.10008.5.1.4.1.1.91.1';
export const CHIUSE = new Set(['poligono', 'ellisse', 'hpf']);

export function puntiEllisse(c, rx, ry, n = 72) {
  const p = []; for (let k = 0; k < n; k++) { const a = (2 * Math.PI * k) / n; p.push([c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a)]); }
  return p;
}
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
// tutte le misure in µm (sp = µm per pixel; senza calibrazione sp = 1 e le misure sono in pixel)
export function lunghezza(a, sp = 1) { return a.p.length >= 2 ? dist(a.p[0], a.p[1]) * sp : 0; }
export function area(a, sp = 1) {
  if (a.t === 'ellisse' || a.t === 'hpf') return Math.PI * a.rx * a.ry * sp * sp;
  if (a.t !== 'poligono') return 0;
  let s = 0; const p = a.p; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; }
  return (Math.abs(s) / 2) * sp * sp;
}
export function perimetro(a, sp = 1) {
  if (a.t === 'ellisse' || a.t === 'hpf') { const x = a.rx * sp, y = a.ry * sp, h = ((x - y) ** 2) / ((x + y) ** 2 || 1); return Math.PI * (x + y) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h))); }   // Ramanujan
  if (a.t !== 'poligono') return 0;
  let s = 0; for (let i = 0; i < a.p.length; i++) s += dist(a.p[i], a.p[(i + 1) % a.p.length]); return s * sp;
}
export function dentro(q, a) {
  if (a.t === 'ellisse' || a.t === 'hpf') return ((q[0] - a.c[0]) / a.rx) ** 2 + ((q[1] - a.c[1]) / a.ry) ** 2 <= 1;
  if (a.t !== 'poligono') return false;
  let s = false; const p = a.p;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > q[1]) !== (p[j][1] > q[1]) && q[0] < ((p[j][0] - p[i][0]) * (q[1] - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) s = !s; }
  return s;
}
// riepilogo del conteggio: punti in tutto, nei campi ad alto ingrandimento e nelle aree disegnate, con la densità per mm²
export function riepilogo(ann, sp = 1) {
  const punti = ann.filter((a) => a.t === 'punto'), campi = ann.filter((a) => a.t === 'hpf'), aree = ann.filter((a) => a.t === 'poligono' || a.t === 'ellisse');
  const conta = (l) => punti.filter((q) => l.some((a) => dentro(q.p[0], a))).length;
  const mm2 = (l) => l.reduce((s, a) => s + area(a, sp), 0) / 1e6;
  return { punti: punti.length, campi: campi.length, nelCampi: conta(campi), areaCampi: mm2(campi), aree: aree.length, nelleAree: conta(aree), areaAree: mm2(aree) };
}

// ---------------------------------------------------------------- salvataggio nel browser (per vetrino)
export const chiaveAnn = (V) => 'rq-vt-ann:' + [V.serie || V.descrizione || '', V.W + 'x' + V.H].join('|');
export function caricaAnn(V) { try { const l = JSON.parse(localStorage.getItem(chiaveAnn(V)) || '[]'); return Array.isArray(l) ? l.filter(valida) : []; } catch { return []; } }
export function salvaAnn(V, ann) { try { if (ann.length) localStorage.setItem(chiaveAnn(V), JSON.stringify(ann)); else localStorage.removeItem(chiaveAnn(V)); return true; } catch { return false; } }
const num = (x) => typeof x === 'number' && Number.isFinite(x);
function valida(a) {
  if (!a || typeof a !== 'object') return false;
  if (a.t === 'ellisse' || a.t === 'hpf') return Array.isArray(a.c) && a.c.length === 2 && a.c.every(num) && num(a.rx) && num(a.ry) && a.rx > 0 && a.ry > 0;
  if (!Array.isArray(a.p) || !a.p.every((q) => Array.isArray(q) && q.length === 2 && q.every(num))) return false;
  return (a.t === 'punto' && a.p.length === 1) || ((a.t === 'dist' || a.t === 'freccia') && a.p.length === 2) || (a.t === 'poligono' && a.p.length >= 3);
}

// ---------------------------------------------------------------- DICOM
const GRUPPI = [
  ['dist', 'POLYLINE', 'Distanze', 'RQ101', 'Distanza'],
  ['freccia', 'POLYLINE', 'Frecce', 'RQ102', 'Freccia (dal primo punto alla punta)'],
  ['poligono', 'POLYGON', 'Aree', 'RQ103', 'Area disegnata'],
  ['ellisse', 'ELLIPSE', 'Ellissi', 'RQ104', 'Area ellittica'],
  ['hpf', 'ELLIPSE', 'Campi ad alto ingrandimento', 'RQ105', 'Campo ad alto ingrandimento (HPF)'],
  ['punto', 'POINT', 'Conteggio', 'RQ106', 'Elemento contato (per esempio mitosi)'],
];
const codice = (v, s, m) => ({ '00080100': ['SH', v], '00080102': ['SH', s], '00080104': ['LO', m] });
const punti = (a) => {
  if (a.t === 'ellisse' || a.t === 'hpf') {   // ELLIPSE: estremi dell'asse maggiore, poi del minore
    const [cx, cy] = a.c, X = [[cx - a.rx, cy], [cx + a.rx, cy]], Y = [[cx, cy - a.ry], [cx, cy + a.ry]];
    return a.rx >= a.ry ? [...X, ...Y] : [...Y, ...X];
  }
  return a.p;
};
const testoDs = (ds, t) => (ds?.string?.(t) || '').replace(/\0/g, '').trim();

/**
 * V: vetrino (preparaVetrini); ann: annotazioni; sp: µm per pixel (null se senza calibrazione).
 * Il paziente, lo studio e il riferimento all'immagine vengono dall'intestazione del livello pieno del vetrino.
 * Restituisce Uint8Array del file .dcm (Part 10).
 */
export function creaANN(V, ann, sp, { autore = '', descrizione = 'Annotazioni radio-quiz' } = {}) {
  const L0 = V.livelli[0], ds = L0.testaDs, uid = nuovoUID(), d = new Date(), p2 = (x) => String(x).padStart(2, '0');
  const data = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`, ora = `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  const rifImm = { '00081150': ['UI', testoDs(ds, 'x00080016') || '1.2.840.10008.5.1.4.1.1.77.1.6'], '00081155': ['UI', testoDs(ds, 'x00080018') || nuovoUID()] };
  const gruppi = [];
  for (const [t, gt, etichetta, cod, signif] of GRUPPI) {
    const l = ann.filter((a) => a.t === t); if (!l.length) continue;
    const coord = [], indici = [];
    for (const a of l) { indici.push(coord.length + 1); for (const [x, y] of punti(a)) coord.push(x, y); }   // indice 1-based del primo valore di ogni forma
    const g = {
      '0040A180': ['US', [gruppi.length + 1]], '006A0003': ['UI', nuovoUID()], '006A0005': ['LO', etichetta], '006A0006': ['UT', signif],
      '006A0007': ['CS', 'MANUAL'], '006A0009': ['SQ', [codice('RQ100', '99RQ', 'Annotazione didattica')]], '006A000A': ['SQ', [codice(cod, '99RQ', signif)]],
      '006A000C': ['UL', [l.length]], '006A000D': ['CS', 'YES'], '006A000F': ['CS', 'YES'], '00700023': ['CS', gt], '00660016': ['OF', coord],
    };
    if (gt === 'POLYLINE' || gt === 'POLYGON') g['00660040'] = ['OL', indici];
    // misure: lunghezza delle linee, area delle forme chiuse (mm e mm²)
    const mis = [];
    if (gt === 'POLYLINE' && t === 'dist' && sp) mis.push([codice('410668003', 'SCT', 'Length'), codice('mm', 'UCUM', 'millimeter'), l.map((a) => lunghezza(a, sp) / 1000)]);
    if (CHIUSE.has(t) && sp) mis.push([codice('42798000', 'SCT', 'Area'), codice('mm2', 'UCUM', 'square millimeter'), l.map((a) => area(a, sp) / 1e6)]);
    if (mis.length) g['00660121'] = ['SQ', mis.map(([n, u, v]) => ({ '0040A043': ['SQ', [n]], '004008EA': ['SQ', [u]], '00660132': ['SQ', [{ '00660125': ['OF', v] }]] }))];
    gruppi.push(g);
  }
  const serie = testoDs(ds, 'x0020000e') || V.serie || nuovoUID();
  const out = {
    '00080005': ['CS', 'ISO_IR 192'], '00080016': ['UI', SOP_ANN], '00080018': ['UI', uid], '00080012': ['DA', data], '00080013': ['TM', ora],
    '00080020': ['DA', testoDs(ds, 'x00080020')], '00080023': ['DA', data], '00080030': ['TM', testoDs(ds, 'x00080030')], '00080033': ['TM', ora],
    '00080050': ['SH', testoDs(ds, 'x00080050')], '00080060': ['CS', 'ANN'], '00080070': ['LO', 'radio-quiz'], '00080090': ['PN', ''],
    '00081090': ['LO', 'radio-quiz visualizzatore vetrini'], '0008103E': ['LO', descrizione],
    '00081115': ['SQ', [{ '0020000E': ['UI', serie], '0008114A': ['SQ', [rifImm]] }]],
    '00081140': ['SQ', [rifImm]],
    '00100010': ['PN', testoDs(ds, 'x00100010')], '00100020': ['LO', testoDs(ds, 'x00100020')], '00100030': ['DA', testoDs(ds, 'x00100030')], '00100040': ['CS', testoDs(ds, 'x00100040')],
    '00181000': ['LO', '1'], '00181020': ['LO', 'radio-quiz'],
    '0020000D': ['UI', testoDs(ds, 'x0020000d') || V.studio || nuovoUID()], '0020000E': ['UI', nuovoUID()], '00200010': ['SH', testoDs(ds, 'x00200010')],
    '00200011': ['IS', '9902'], '00200013': ['IS', '1'], '00200052': ['UI', testoDs(ds, 'x00200052') || nuovoUID()], '00201040': ['LO', ''],
    '00480301': ['CS', 'VOLUME'], '006A0001': ['CS', '2D'], '006A0002': ['SQ', gruppi],
    '00700080': ['CS', 'RADIOQUIZ'], '00700081': ['LO', descrizione], '00700084': ['PN', autore],
  };
  if (sp == null) out['0008103E'][1] += ' (vetrino senza calibrazione)';
  return part10(out, SOP_ANN, uid);
}

// lettura di un file di annotazioni (dataset di dicomParser): forme del visualizzatore. Le forme di altri programmi si
// convertono nel tipo più vicino (ellissi ruotate e rettangoli diventano poligoni).
export function leggiANN(dsAnn) {
  if (testoDs(dsAnn, 'x00080016') !== SOP_ANN) throw new Error('il file non contiene annotazioni di vetrino');
  if ((testoDs(dsAnn, 'x006a0001') || '2D') !== '2D') throw new Error('annotazioni in coordinate 3D del vetrino: non ancora lette');
  const out = [];
  for (const it of dsAnn.elements.x006a0002?.items || []) {
    const g = it.dataSet, gt = testoDs(g, 'x00700023'), et = testoDs(g, 'x006a0005'), n = g.uint32('x006a000c') || 0;
    const el = g.elements.x00660016 || g.elements.x00660017; if (!el) continue;
    const dop = !!g.elements.x00660017 && !g.elements.x00660016, u8 = g.byteArray.slice(el.dataOffset, el.dataOffset + el.length);
    const v = dop ? new Float64Array(u8.buffer) : new Float32Array(u8.buffer), pts = []; for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]]);
    const tipo = GRUPPI.find((x) => x[2] === et)?.[0];
    let forme;
    if (gt === 'POINT') forme = pts.map((q) => [q]);
    else if (gt === 'ELLIPSE' || gt === 'RECTANGLE') { forme = []; for (let i = 0; i + 3 < pts.length; i += 4) forme.push(pts.slice(i, i + 4)); }
    else {
      const ix = g.elements.x00660040, inizi = [];
      if (ix) { const a = g.byteArray.slice(ix.dataOffset, ix.dataOffset + ix.length), u = new Uint32Array(a.buffer); for (const x of u) inizi.push((x - 1) / 2); }
      else if (n > 0) for (let k = 0; k < n; k++) inizi.push(Math.round((k * pts.length) / n));
      else inizi.push(0);
      forme = inizi.map((s, k) => pts.slice(s, k + 1 < inizi.length ? inizi[k + 1] : pts.length));
    }
    for (const f of forme) {
      if (gt === 'POINT') { out.push({ t: 'punto', p: f }); continue; }
      if (gt === 'ELLIPSE' && f.length === 4) {
        const c = [(f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2], a1 = dist(f[0], f[1]) / 2, a2 = dist(f[2], f[3]) / 2;
        const orizz = Math.abs(f[0][1] - f[1][1]) < 1e-3 * (a1 + 1) && Math.abs(f[2][0] - f[3][0]) < 1e-3 * (a2 + 1), vert = Math.abs(f[0][0] - f[1][0]) < 1e-3 * (a1 + 1) && Math.abs(f[2][1] - f[3][1]) < 1e-3 * (a2 + 1);
        if (orizz) out.push({ t: tipo === 'hpf' ? 'hpf' : 'ellisse', c, rx: a1, ry: a2 });
        else if (vert) out.push({ t: tipo === 'hpf' ? 'hpf' : 'ellisse', c, rx: a2, ry: a1 });
        else { const ang = Math.atan2(f[1][1] - f[0][1], f[1][0] - f[0][0]), p = []; for (let k = 0; k < 72; k++) { const t = (2 * Math.PI * k) / 72, x = a1 * Math.cos(t), y = a2 * Math.sin(t); p.push([c[0] + x * Math.cos(ang) - y * Math.sin(ang), c[1] + x * Math.sin(ang) + y * Math.cos(ang)]); } out.push({ t: 'poligono', p }); }
        continue;
      }
      if (gt === 'RECTANGLE' || gt === 'POLYGON') { if (f.length >= 3) out.push({ t: 'poligono', p: f }); continue; }
      if (gt === 'POLYLINE') {
        if (f.length === 2) out.push({ t: tipo === 'freccia' ? 'freccia' : 'dist', p: f });
        else for (let k = 0; k + 1 < f.length; k++) out.push({ t: 'dist', p: [f[k], f[k + 1]] });
      }
    }
  }
  return out.filter(valida);
}
