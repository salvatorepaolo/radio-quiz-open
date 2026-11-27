/* ============================================================
   MPR e volume rendering per Quiz Radiologia.
   Basato su Cornerstone3D (MIT) e vtk.js (BSD), entrambi open source.

   Il volume viene costruito dalle fette già decodificate dal
   visualizzatore 2D (nessun altro caricatore DICOM): valori in HU,
   geometria da ImagePositionPatient / ImageOrientationPatient.
   ============================================================ */
import {
  init as initCore, RenderingEngine, Enums, volumeLoader, cache, setVolumesForViewports, utilities as csUtils, eventTarget, CONSTANTS,
} from '@cornerstonejs/core';
import {
  init as initTools, addTool, ToolGroupManager, Enums as TEnums,
  CrosshairsTool, WindowLevelTool, PanTool, ZoomTool, StackScrollTool, TrackballRotateTool,
  EllipticalROITool, LengthTool, AngleTool, ProbeTool, BidirectionalTool, annotation as annotazioni, cursors as cursori, utilities as tUtil,
} from '@cornerstonejs/tools';

const { ViewportType, OrientationAxis, BlendModes } = Enums;
const { MouseBindings, KeyboardBindings } = TEnums;
// tasti del mouse come nel 2D (scelta del docente): destro = finestra/livello, rotellina premuta = zoom, Maiusc + sinistro = sposta
const LEGAMI_FISSI = () => ({ [WindowLevelTool.toolName]: [{ mouseButton: MouseBindings.Secondary }], [ZoomTool.toolName]: [{ mouseButton: MouseBindings.Auxiliary }], [PanTool.toolName]: [{ mouseButton: MouseBindings.Primary, modifierKey: KeyboardBindings.Shift }], [StackScrollTool.toolName]: [{ mouseButton: MouseBindings.Wheel }] });
const ID_MOTORE = 'quiz-motore';
const ID_GRUPPO_MPR = 'quiz-gruppo-mpr';
const ID_GRUPPO_3D = 'quiz-gruppo-3d';
const VP = { assiale: 'vp-assiale', coronale: 'vp-coronale', sagittale: 'vp-sagittale', vr: 'vp-3d' };
let pronto = false;
let motore = null;
let idVolume = null;
let strumentoAttivo = StackScrollTool.toolName;   // all'apertura: «Scorri» (10/11, come nel 2D)
let VOL = null;          // dati del volume per le statistiche 3D delle ROI
let suMisura = null;     // richiamata quando lo specializzando completa una misura
const CLIC_CENTRO = [];  // ascoltatori del clic che sposta il centro delle linee di riferimento
const MISURE = () => [EllipticalROITool.toolName, LengthTool.toolName, AngleTool.toolName, ProbeTool.toolName, BidirectionalTool.toolName];

// 14/11: elenco ridotto (prima erano 25 voci, con doppioni poco chiari come «Osso» e «Osso (volume ritagliato)»).
// [id, nome, gruppo, solo neuro]. Gli id QR-… sono elaborazioni del volume (vista3d), gli altri preset di vtk.js.
export const PRESET_3D = [
  ['QR-vascular', 'Vascular: solo le arterie', 'TC'], ['QR-angiography', 'Angiography: MIP 3D dei vasi', 'TC'], ['QR-willis', 'Willis: arterie della testa', 'TC', true],
  ['QR-angio-ossa', 'Angio e ossa (vasi rossi, ossa avorio)', 'TC'], ['CT-Bone', 'Ossa', 'TC'], ['CT-Soft-Tissue', 'Cute e tessuti molli', 'TC'],
  ['CT-Cardiac', 'Cuore e coronarie', 'TC'], ['CT-Chest-Vessels', 'Vasi del torace', 'TC'], ['CT-Pulmonary-Arteries', 'Arterie polmonari', 'TC'],
  ['CT-Lung', 'Polmone', 'TC'], ['CT-Air', 'Vie aeree e colon (aria)', 'TC'], ['CT-Liver-Vasculature', 'Vasi epatici', 'TC'],
  ['MR-Default', 'RM standard', 'RM'], ['QR-vascular', 'Vascular: angio-RM', 'RM'], ['QR-willis', 'Willis: arterie della testa', 'RM', true],
  ['QR-angiography', 'Angiography: MIP 3D', 'RM'], ['MR-T2-Brain', 'Encefalo T2', 'RM'],
];

async function prepara(mobile = false) {
  if (pronto) return;
  // smartphone e tablet: un solo contesto WebGL e texture nel tipo nativo (meno memoria della GPU)
  await initCore(mobile ? { isMobile: true, rendering: { preferSizeOverAccuracy: true } } : undefined);
  initTools();
  for (const t of [CrosshairsTool, WindowLevelTool, PanTool, ZoomTool, StackScrollTool, TrackballRotateTool,
    EllipticalROITool, LengthTool, AngleTool, ProbeTool, BidirectionalTool]) addTool(t);
  eventTarget.addEventListener(TEnums.Events.ANNOTATION_COMPLETED, (e) => {
    const a = e.detail?.annotation, nome = a?.metadata?.toolName;
    if (MISURE().includes(nome) && !STORIA_MPR.interno) { STORIA_MPR.fatte.push({ tipo: 'agg', a: copiaAnn(a) }); STORIA_MPR.annullate = []; }
    if (suMisura && MISURE().includes(nome)) { try { suMisura(nome); } catch {} }
  });
  eventTarget.addEventListener(TEnums.Events.ANNOTATION_REMOVED, (e) => {
    const a = e.detail?.annotation;
    if (a && MISURE().includes(a.metadata?.toolName) && !STORIA_MPR.interno && !STORIA_MPR.tutte) { STORIA_MPR.fatte.push({ tipo: 'via', a: copiaAnn(a) }); STORIA_MPR.annullate = []; }
  });
  registraPresetQR();
  pronto = true;
}

// ---- annulla / ripeti delle misure nelle viste MPR (Ctrl+Z, Ctrl+Maiusc+Z)
const STORIA_MPR = { fatte: [], annullate: [], interno: false, tutte: false };
const copiaAnn = (a) => JSON.parse(JSON.stringify({ ...a, data: { ...a.data, cachedStats: {} } }));
function applicaOp(op, inverso) {
  STORIA_MPR.interno = true;
  try {
    const lista = op.tipo === 'gruppo' ? op.lista : [op.a];
    const aggiungi = op.tipo === 'agg' ? !inverso : inverso;          // «via» e «gruppo» (cancella tutto): annullare = rimettere
    for (const x of lista) {
      if (aggiungi) { const c = copiaAnn(x); c.invalidated = true; annotazioni.state.addAnnotation(c, c.metadata?.FrameOfReferenceUID); }
      else annotazioni.state.removeAnnotation(x.annotationUID);
    }
  } finally { STORIA_MPR.interno = false; }
  motore?.render();
}
export function annullaMPR() { const op = STORIA_MPR.fatte.pop(); if (!op) return false; applicaOp(op, true); STORIA_MPR.annullate.push(op); return true; }
export function ripetiMPR() { const op = STORIA_MPR.annullate.pop(); if (!op) return false; applicaOp(op, false); STORIA_MPR.fatte.push(op); return true; }
export const statoStoriaMPR = () => ({ annulla: STORIA_MPR.fatte.length, ripeti: STORIA_MPR.annullate.length });

export function supportato() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}

const croce = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Controlla che le fette formino un volume regolare.
 * fette: [{ rows, cols, pix, slope, inter, ipp:[3], iop:[6], spRow, spCol }]
 * @returns { ok, motivo, ordinate, dz }
 */
export function verificaVolume(fette) {
  if (fette.length < 10) return { ok: false, motivo: 'servono almeno 10 immagini nella serie' };
  const f0 = fette[0];
  if (!f0.ipp || !f0.iop) return { ok: false, motivo: 'mancano le informazioni di posizione delle immagini' };
  for (const f of fette) {
    if (f.rows !== f0.rows || f.cols !== f0.cols) return { ok: false, motivo: 'le immagini hanno dimensioni diverse' };
    if (!f.iop || f.iop.some((v, i) => Math.abs(v - f0.iop[i]) > 1e-3)) return { ok: false, motivo: 'orientamento non uniforme (es. scanogramma o serie miste)' };
  }
  const n = croce(f0.iop.slice(0, 3), f0.iop.slice(3, 6));
  const ordinate = [...fette].map((f) => ({ f, d: punto(f.ipp, n) })).sort((a, b) => a.d - b.d);
  const passi = [];
  for (let i = 1; i < ordinate.length; i++) passi.push(ordinate[i].d - ordinate[i - 1].d);
  const dz = passi.slice().sort((a, b) => a - b)[Math.floor(passi.length / 2)];
  if (!(dz > 0.01)) return { ok: false, motivo: 'posizioni delle immagini ripetute o non valide' };
  // fette mancanti (salti di 2, 3… passi): si riempiono con la fetta più vicina, così il volume non si
  // accorcia in z (con una TC incompleta la PET della fusione risulterebbe spostata)
  const multiplo = (p) => { const k = Math.round(p / dz); return k >= 1 && k <= 25 && Math.abs(p - k * dz) <= dz * 0.25 ? k : 0; };
  const irregolari = passi.filter((p) => !multiplo(p)).length;
  if (irregolari > passi.length * 0.1) return { ok: false, motivo: 'distanza tra le immagini non regolare' };
  const piene = [ordinate[0].f]; let mancanti = 0;
  for (let i = 1; i < ordinate.length; i++) {
    const k = multiplo(passi[i - 1]);
    for (let t = 1; t < k; t++) { piene.push(t <= k / 2 ? ordinate[i - 1].f : ordinate[i].f); mancanti++; }
    piene.push(ordinate[i].f);
  }
  return { ok: true, ordinate: piene, dz, normale: n, mancanti };
}

/** Volume locale da dati già pronti, con la geometria indicata (per 3D elaborato e segmentazioni). */
function volumeDaDati(prefisso, dati, { dim, sp, origine, assi }, modalita = 'CT') {
  const id = `${prefisso}_${Date.now()}`;
  const [riga, col, normale] = assi, iop = [...riga, ...col];
  const volume = volumeLoader.createLocalVolume(id, {
    scalarData: dati, dimensions: dim, spacing: sp, origin: origine, direction: [...riga, ...col, ...normale],
    metadata: { BitsAllocated: 16, BitsStored: 16, SamplesPerPixel: 1, HighBit: 15, PhotometricInterpretation: 'MONOCHROME2', PixelRepresentation: 1,
      Modality: modalita, ImageOrientationPatient: iop, PixelSpacing: [sp[1], sp[0]], FrameOfReferenceUID: 'quiz-for', Columns: dim[0], Rows: dim[1],
      voiLut: [{ windowCenter: 40, windowWidth: 400 }], VOILUTFunction: 'LINEAR' },
  });
  volume.imageIds.forEach((iid, k) => {
    const pos = [0, 1, 2].map((i) => origine[i] + normale[i] * sp[2] * k);
    csUtils.genericMetadataProvider.add(iid, { type: 'imagePlaneModule', metadata: { frameOfReferenceUID: 'quiz-for', rows: dim[1], columns: dim[0],
      imageOrientationPatient: iop, rowCosines: riga, columnCosines: col, imagePositionPatient: pos, pixelSpacing: [sp[1], sp[0]], rowPixelSpacing: sp[1], columnPixelSpacing: sp[0], sliceThickness: sp[2] } });
    csUtils.genericMetadataProvider.add(iid, { type: 'generalSeriesModule', metadata: { modality: modalita } });
  });
  return volume;
}
/** Costruisce il volume (valori già in HU / unità reali). */
function creaVolume(fette, dz, normale, modalita, wc, ww, secondario = false) {
  const f0 = fette[0];
  const n = fette.length, area = f0.rows * f0.cols;
  // PET in fusione: valori ×1000 in interi a 16 bit (i volumi in virgola mobile come secondo
  // strato escono quasi neri nelle viste MPR); la scala colori usa la stessa unità
  // il moltiplicatore si adatta al valore massimo (PET in SUV, ma anche RM o TC sovrapposte dopo la coregistrazione)
  let massimo = 0;
  if (secondario) for (const f of fette) { const p = f.pix; for (let i = 0; i < p.length; i += 13) { const v = Math.abs(p[i] * f.slope + f.inter); if (v > massimo) massimo = v; } }
  const molt = secondario ? Math.min(1000, 30000 / Math.max(1e-6, massimo)) : 1;
  if (secondario) moltPet = molt;
  const interi = secondario || fette.every((f) => Number.isInteger(f.slope) && Number.isInteger(f.inter));
  const dati = interi ? new Int16Array(area * n) : new Float32Array(area * n);
  for (let k = 0; k < n; k++) {
    const f = fette[k], o = k * area, s = f.slope * molt, b = f.inter * molt, p = f.pix;
    // in TC i valori sotto -1024 sono il riempimento fuori dal campo di vista: nel 3D farebbero strisce
    const minimo = modalita === 'CT' ? -1024 : -32768;
    if (interi) for (let i = 0; i < area; i++) { const v = Math.round(p[i] * s + b); dati[o + i] = v < minimo ? minimo : v > 32767 ? 32767 : v; }
    else for (let i = 0; i < area; i++) { const v = p[i] * s + b; dati[o + i] = v < minimo ? minimo : v; }
  }
  const riga = f0.iop.slice(0, 3), col = f0.iop.slice(3, 6);
  const id = `${secondario ? 'quizPet' : 'quizVolume'}_${Date.now()}`;   // niente «:» nel nome: altrimenti Cornerstone cerca un caricatore di file
  if (!secondario) idVolume = id;
  const volume = volumeLoader.createLocalVolume(id, {
    scalarData: dati,
    dimensions: [f0.cols, f0.rows, n],
    spacing: [f0.spCol, f0.spRow, dz],
    origin: f0.ipp,
    direction: [...riga, ...col, ...normale],
    metadata: {
      BitsAllocated: interi ? 16 : 32, BitsStored: interi ? 16 : 32, SamplesPerPixel: 1, HighBit: interi ? 15 : 31,
      PhotometricInterpretation: 'MONOCHROME2', PixelRepresentation: 1, Modality: modalita || 'CT',
      ImageOrientationPatient: f0.iop, PixelSpacing: [f0.spRow, f0.spCol], FrameOfReferenceUID: 'quiz-for',
      Columns: f0.cols, Rows: f0.rows, voiLut: [{ windowCenter: wc, windowWidth: ww }], VOILUTFunction: 'LINEAR',
    },
  });
  // ogni fetta deve avere la sua posizione: createLocalVolume le mette tutte all'origine,
  // e la vista nel piano di acquisizione non troverebbe le immagini
  volume.imageIds.forEach((id, k) => {
    const pos = [0, 1, 2].map((i) => f0.ipp[i] + normale[i] * dz * k);
    csUtils.genericMetadataProvider.add(id, { type: 'imagePlaneModule', metadata: {
      frameOfReferenceUID: 'quiz-for', rows: f0.rows, columns: f0.cols,
      imageOrientationPatient: f0.iop, rowCosines: riga, columnCosines: col, imagePositionPatient: pos,
      pixelSpacing: [f0.spRow, f0.spCol], rowPixelSpacing: f0.spRow, columnPixelSpacing: f0.spCol, sliceThickness: dz,
    } });
    csUtils.genericMetadataProvider.add(id, { type: 'generalSeriesModule', metadata: { modality: modalita || 'CT' } });
  });
  if (!secondario) VOL = { dati, dim: [f0.cols, f0.rows, n], sp: [f0.spCol, f0.spRow, dz], origine: f0.ipp, assi: [riga, col, normale], unita: modalita === 'CT' ? 'HU' : '' };
  return volume;
}

// ---- ROI 3D: ellissoide costruito sulla ROI ellittica (terzo asse = media dei due disegnati)
const sotto = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lung = (a) => Math.hypot(a[0], a[1], a[2]);
const cache3d = new Map();
function statistiche3D(punti) {
  if (!VOL || !punti || punti.length < 4) return null;
  const [basso, alto, sx, dx] = punti;
  const chiave = punti.flat().map((v) => v.toFixed(1)).join(',');
  if (cache3d.has(chiave)) return cache3d.get(chiave);
  const c = [0, 1, 2].map((i) => (alto[i] + basso[i]) / 2);
  const a1 = sotto(alto, c), a2 = sotto(dx, [0, 1, 2].map((i) => (sx[i] + dx[i]) / 2));
  const r1 = lung(a1), r2 = lung(a2);
  if (r1 < 0.5 || r2 < 0.5) return null;
  const e1 = a1.map((v) => v / r1), e2 = a2.map((v) => v / r2);
  let e3 = croce(e1, e2); const l3 = lung(e3); if (l3 < 1e-6) return null; e3 = e3.map((v) => v / l3);
  const r3 = (r1 + r2) / 2;
  const { dati, dim, sp, origine, assi } = VOL;
  // centro e semiampiezze in indici del volume
  const ci = assi.map((u, k) => punto(sotto(c, origine), u) / sp[k]);
  const semi = assi.map((u, k) => Math.sqrt((punto(e1, u) * r1) ** 2 + (punto(e2, u) * r2) ** 2 + (punto(e3, u) * r3) ** 2) / sp[k]);
  const lo = ci.map((v, k) => Math.max(0, Math.floor(v - semi[k]))), hi = ci.map((v, k) => Math.min(dim[k] - 1, Math.ceil(v + semi[k])));
  if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 8e6) return null;   // troppo grande
  let n = 0, s = 0, s2 = 0, mi = Infinity, ma = -Infinity;
  for (let k = lo[2]; k <= hi[2]; k++) for (let j = lo[1]; j <= hi[1]; j++) for (let i = lo[0]; i <= hi[0]; i++) {
    const d = [0, 1, 2].map((q) => origine[q] + assi[0][q] * i * sp[0] + assi[1][q] * j * sp[1] + assi[2][q] * k * sp[2] - c[q]);
    const u = punto(d, e1) / r1, v = punto(d, e2) / r2, w = punto(d, e3) / r3;
    if (u * u + v * v + w * w > 1) continue;
    const x = dati[(k * dim[1] + j) * dim[0] + i];
    n++; s += x; s2 += x * x; if (x < mi) mi = x; if (x > ma) ma = x;
  }
  const media = n ? s / n : NaN;
  const r = n ? { n, media, ds: Math.sqrt(Math.max(0, s2 / n - media * media)), min: mi, max: ma,
    volume: (4 / 3) * Math.PI * r1 * r2 * r3 / 1000, diametri: [2 * r1, 2 * r2] } : null;
  if (cache3d.size > 200) cache3d.clear();
  cache3d.set(chiave, r);
  return r;
}
const arr = (v) => (Number.isFinite(v) ? Math.round(v) : '—');
// RECIST 1.1 anche sui piani MPR e obliqui: diametro massimo (lesioni, bersaglio ≥ 10 mm) e asse corto (linfonodi, bersaglio ≥ 15 mm)
function righeRecist(data, targetId) {
  const st = data.cachedStats?.[targetId] || {}, L = st.length, W = st.width;
  if (!Number.isFinite(L)) return [];
  const out = [`RECIST · diametro max ${L.toFixed(1)} mm ${L >= 10 ? '(bersaglio)' : '(< 10 mm)'}`];
  if (Number.isFinite(W)) out.push(`se linfonodo: asse corto ${W.toFixed(1)} mm ${W >= 15 ? '(bersaglio)' : W >= 10 ? '(non bersaglio)' : '(non patologico)'}`);
  return out;
}
function righeROI(data, targetId) {
  const st = data.cachedStats?.[targetId] || {};
  const u = VOL?.unita ? ' ' + VOL.unita : '';
  const out = [];
  if (Number.isFinite(st.mean)) out.push(`Media ${arr(st.mean)} ± ${arr(st.stdDev)}${u}`);
  if (Number.isFinite(st.min)) out.push(`Min ${arr(st.min)} · Max ${arr(st.max)}`);
  if (Number.isFinite(st.area) && !st.isEmptyArea) out.push(`Area ${(st.area / 100).toFixed(2)} cm²`);
  const v = statistiche3D(data.handles?.points);
  if (v) {
    out.push(`3D: ${v.diametri.map((d) => d.toFixed(0)).join(' × ')} mm · ${v.volume.toFixed(2)} cm³`);
    out.push(`3D: media ${arr(v.media)} ± ${arr(v.ds)}${u}`);
  }
  return out;
}

/**
 * Apre la vista 2×2: assiale, coronale, sagittale (MPR) + 3D.
 * elementi: { assiale, coronale, sagittale, vr } (div vuoti)
 */
export async function apri({ elementi, fette, wc = 40, ww = 400, modalita = 'CT', preset = 'CT-AAA', onMisura = null, mobile = false }) {
  await prepara(mobile);
  chiudi();
  suMisura = onMisura;
  const v = verificaVolume(fette);
  if (!v.ok) throw new Error(v.motivo);
  const volume = creaVolume(v.ordinate, v.dz, v.normale, modalita, wc, ww);
  motore = new RenderingEngine(ID_MOTORE);
  motore.setViewports([
    { viewportId: VP.assiale, type: ViewportType.ORTHOGRAPHIC, element: elementi.assiale, defaultOptions: { orientation: OrientationAxis.AXIAL, background: [0, 0, 0] } },
    { viewportId: VP.coronale, type: ViewportType.ORTHOGRAPHIC, element: elementi.coronale, defaultOptions: { orientation: OrientationAxis.CORONAL, background: [0, 0, 0] } },
    { viewportId: VP.sagittale, type: ViewportType.ORTHOGRAPHIC, element: elementi.sagittale, defaultOptions: { orientation: OrientationAxis.SAGITTAL, background: [0, 0, 0] } },
    { viewportId: VP.vr, type: ViewportType.VOLUME_3D, element: elementi.vr, defaultOptions: { orientation: OrientationAxis.CORONAL, background: [0.06, 0.07, 0.09] } },
  ]);
  const mpr = [VP.assiale, VP.coronale, VP.sagittale];
  await setVolumesForViewports(motore, [{ volumeId: volume.volumeId }], mpr);
  await setVolumesForViewports(motore, [{ volumeId: volume.volumeId }], [VP.vr]);
  for (const id of mpr) motore.getViewport(id).setProperties({ voiRange: { lower: wc - ww / 2, upper: wc + ww / 2 } });
  const vr = motore.getViewport(VP.vr);
  presetVR = preset;
  vr.setProperties({ preset });
  vr.render();

  const g = ToolGroupManager.createToolGroup(ID_GRUPPO_MPR);
  for (const id of mpr) g.addViewport(id, ID_MOTORE);
  g.addTool(CrosshairsTool.toolName, {
    getReferenceLineColor: (id) => ({ [VP.assiale]: 'rgb(255, 80, 80)', [VP.coronale]: 'rgb(80, 220, 120)', [VP.sagittale]: 'rgb(90, 160, 255)' }[id]),
    getReferenceLineControllable: () => true,
    getReferenceLineDraggableRotatable: () => true,
    getReferenceLineSlabThicknessControlsOn: () => true,
  });
  g.addTool(WindowLevelTool.toolName);
  g.addTool(EllipticalROITool.toolName, { getTextLines: righeROI });
  g.addTool(LengthTool.toolName);
  g.addTool(AngleTool.toolName);
  g.addTool(ProbeTool.toolName);
  g.addTool(BidirectionalTool.toolName, { getTextLines: righeRecist });
  for (const t of MISURE()) g.setToolPassive(t);   // le misure già fatte restano modificabili
  g.addTool(PanTool.toolName);
  g.addTool(ZoomTool.toolName, { invert: true });
  g.addTool(StackScrollTool.toolName);
  // «scorri»: il puntatore resta la freccia normale
  zoomCome2D(g);
  const cursoreDi = g._getCursor.bind(g);
  g._getCursor = (nome, strategia) => (nome === StackScrollTool.toolName ? cursori.MouseCursor.getDefinedCursor('default') : cursoreDi(nome, strategia));
  // linee di riferimento: un clic (senza trascinare) su un punto porta lì il centro, negli altri piani
  for (const id of mpr) {
    const el = motore.getViewport(id).element; let giu = null;
    const down = (e) => { giu = e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey ? [e.clientX, e.clientY] : null; };
    const up = (e) => {
      const g0 = giu; giu = null;
      if (!g0 || e.button !== 0 || cpr || strumentoAttivo !== CrosshairsTool.toolName || Math.hypot(e.clientX - g0[0], e.clientY - g0[1]) > 3) return;
      const vp = motore?.getViewport(id); if (!vp) return;
      const r = el.getBoundingClientRect(), w = vp.canvasToWorld([e.clientX - r.left, e.clientY - r.top]);
      if (w?.every(Number.isFinite)) vaiAlPunto([...w]);
    };
    el.addEventListener('mousedown', down); el.addEventListener('mouseup', up);
    CLIC_CENTRO.push([el, 'mousedown', down], [el, 'mouseup', up]);
  }
  g.setToolActive(StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] });
  strumento(strumentoAttivo);

  const g3 = ToolGroupManager.createToolGroup(ID_GRUPPO_3D);
  g3.addViewport(VP.vr, ID_MOTORE);
  g3.addTool(TrackballRotateTool.toolName);
  g3.addTool(ZoomTool.toolName, { invert: true });
  g3.addTool(PanTool.toolName);
  zoomCome2D(g3);
  strumento3d(strumentoAttivo);
  try { creaCentri(); } catch (e) { console.warn('centri', e); }
  // la prima immagine del piano di acquisizione può uscire vuota finché il volume non è
  // del tutto in memoria grafica: un secondo giro di impostazione della vista la sistema
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));
  ripristina();
  try { await csUtils.jumpToSlice(elementi.assiale, { imageIndex: Math.floor(v.ordinate.length / 2) }); } catch {}
  motore.render();
  return { fette: v.ordinate.length, mancanti: v.mancanti || 0, dz: v.dz, dimensioni: [fette[0].cols, fette[0].rows, v.ordinate.length] };
}

// zoom trascinando: Cornerstone cambia la scala di 5 × spostamento / altezza della vista (nelle viste piccole a sinistra
// troppo veloce); qui come nel 2D: exp(−spostamento / 150 px)
function zoomCome2D(gr) {
  try {
    const z = gr.getToolInstance(ZoomTool.toolName), orig = z?._dragParallelProjection; if (!orig || z._come2d) return; z._come2d = true;
    z._dragParallelProjection = (evt, vp, cam, pinch = false) => {
      if (pinch) return orig(evt, vp, cam, pinch);
      const d = evt.detail, f = (d.element?.clientHeight || 400) / 750, dp = d.deltaPoints;
      return orig({ detail: { ...d, deltaPoints: { ...dp, canvas: [dp.canvas[0] * f, dp.canvas[1] * f] } } }, vp, cam, pinch);
    };
  } catch {}
}
// tasti del mouse nel 3D: sinistro ruota (o sposta / ingrandisce se è lo strumento scelto), destro e rotellina zoom,
// rotellina premuta zoom (su = ingrandisci), Maiusc + sinistro sposta
function strumento3d(t) {
  const g3 = ToolGroupManager.getToolGroup(ID_GRUPPO_3D); if (!g3) return;
  const sx = t === PanTool.toolName ? PanTool.toolName : t === ZoomTool.toolName ? ZoomTool.toolName : TrackballRotateTool.toolName;
  const base = { [TrackballRotateTool.toolName]: [], [ZoomTool.toolName]: [{ mouseButton: MouseBindings.Wheel }, { mouseButton: MouseBindings.Auxiliary }],
    [PanTool.toolName]: [{ mouseButton: MouseBindings.Primary, modifierKey: KeyboardBindings.Shift }] };
  for (const nome of Object.keys(base)) { try { g3.setToolPassive(nome, { removeAllBindings: true }); } catch {} }
  for (const [nome, b] of Object.entries(base)) { const l = nome === sx ? [{ mouseButton: MouseBindings.Primary }, ...b] : b; try { if (l.length) g3.setToolActive(nome, { bindings: l }); else g3.setToolPassive(nome); } catch {} }
}
/** Strumento sul tasto sinistro nelle tre viste MPR: 'crosshair' | 'wl' | 'pan' | 'zoom' */
export function strumento(nome) {
  const g = ToolGroupManager.getToolGroup(ID_GRUPPO_MPR);
  const mappa = { crosshair: CrosshairsTool.toolName, wl: WindowLevelTool.toolName, pan: PanTool.toolName, zoom: ZoomTool.toolName,
    roi: EllipticalROITool.toolName, misura: LengthTool.toolName, angolo: AngleTool.toolName, sonda: ProbeTool.toolName, recist: BidirectionalTool.toolName,
    scorri: StackScrollTool.toolName };   // scorri: tasto sinistro su/giù tra gli strati (la rotellina scorre sempre)
  const t = mappa[nome] || nome;
  strumentoAttivo = t;
  if (!g) return;
  const fissi = LEGAMI_FISSI();
  // Cornerstone somma i nuovi tasti a quelli che lo strumento aveva già: prima si tolgono tutti (altrimenti, dopo
  // «Scorri», il tasto sinistro resterebbe anche allo scorrimento e «Sposta», «Zoom»… non risponderebbero)
  for (const nome of new Set(Object.values(mappa))) { try { g.setToolPassive(nome, { removeAllBindings: true }); } catch {} }
  for (const altro of Object.values(mappa)) {
    if (altro === t) continue;
    if (fissi[altro]) g.setToolActive(altro, { bindings: fissi[altro] });
    else g.setToolPassive(altro);
  }
  g.setToolActive(t, { bindings: [{ mouseButton: MouseBindings.Primary }, ...(fissi[t] || [])] });
  strumento3d(t);
}

/** Finestra/livello sulle tre viste MPR */
export function finestra(wc, ww) {
  if (!motore) return;
  for (const id of [VP.assiale, VP.coronale, VP.sagittale]) {
    const vp = motore.getViewport(id);
    vp.setProperties({ voiRange: { lower: wc - ww / 2, upper: wc + ww / 2 } });
    vp.render();
  }
}

/** Spessore di strato (mm) e modalità: 'normale' | 'mip' | 'minip' | 'media' */
export function strato(mm, modo = 'mip') {
  if (!motore) return;
  const blend = { normale: BlendModes.COMPOSITE, mip: BlendModes.MAXIMUM_INTENSITY_BLEND, minip: BlendModes.MINIMUM_INTENSITY_BLEND, media: BlendModes.AVERAGE_INTENSITY_BLEND }[modo];
  for (const id of [VP.assiale, VP.coronale, VP.sagittale]) {
    const vp = motore.getViewport(id);
    if (!mm || modo === 'normale') { vp.setBlendMode(BlendModes.COMPOSITE); vp.setSlabThickness(0.1); }
    else { vp.setBlendMode(blend); vp.setSlabThickness(mm); }
    vp.render();
  }
  if (idPet && aspettoPet) aspettoFusione(aspettoPet);   // l'opacità della PET dipende dallo spessore
}

let presetVR = null;
export function preset3d(nome) {
  if (!motore) return;
  presetVR = nome; tfBase = null; tfStato = { sposta: 0, scala: 1 };
  if (idPet && petMip3d) return;   // nel 3D c'è la MIP della PET: il preset vale quando si toglie la fusione
  const vp = motore.getViewport(VP.vr);
  vp.setProperties({ preset: nome }, idVR || idVolume);
  vp.render();
}

/** Riporta piani, zoom e rotazioni all'inizio */
export function ripristina() {
  if (!motore) return;
  for (const id of Object.values(VP)) {
    const vp = motore.getViewport(id);
    vp.resetCamera();
    if (id !== VP.vr) { vp.setBlendMode(BlendModes.COMPOSITE); vp.setSlabThickness(0.1); }
    vp.render();
  }
  const g = ToolGroupManager.getToolGroup(ID_GRUPPO_MPR);
  try { g?.getToolInstance(CrosshairsTool.toolName)?.computeToolCenter?.(); } catch {}
}

// ---- fusione PET/TC nelle tre viste MPR: la PET come secondo volume, in falsi colori
let idPet = null, aspettoPet = null, moltPet = 1000, petMip3d = false;
// 3D: due volumi sovrapposti nello stesso rendering si coprono a vicenda (vtk.js li disegna uno dopo
// l'altro): con la PET il 3D mostra solo la PET, a colori, con la mappa scelta
const volumiVR = () => (idPet && petMip3d ? [{ volumeId: idPet }] : [{ volumeId: idVR || idVolume }]);
function modo3d() {
  const vr = motore.getViewport(VP.vr);
  // (niente setBlendMode: nella vista 3D di Cornerstone svuota il rendering; la MIP si imposta sul mapper, blend3d)
  if (!(idPet && petMip3d)) vr.setProperties({ preset: presetVR || 'CT-AAA' }, idVR || idVolume);
  tfBase = null; tfStato = { sposta: 0, scala: 1 }; blend3d();
}
const CALDO = { nome: 'caldo', punti: [0, 0, 0, 0, 1 / 3, 1, 0, 0, 2 / 3, 1, 1, 0, 1, 1, 1, 1] };
// mappa colore scelta dall'utente: registrata una volta per nome
function registraLut(mappa = CALDO) {
  const nome = 'quiz-' + String(mappa.nome || 'caldo').replace(/[^a-z0-9-]/gi, '');
  if (!csUtils.colormap.getColormap(nome)) csUtils.colormap.registerColormap({ Name: nome, name: nome, ColorSpace: 'RGB', RGBPoints: mappa.punti || CALDO.punti });
  return nome;
}
/**
 * fette: immagini PET decodificate (o null per togliere la fusione);
 * max: valore in cima alla scala colori; opacita: 0..1
 */
export async function fusione({ fette = null, max = 1, opacita = 0.5, mappa = CALDO, mip3d = false, soglia = 0.15 } = {}) {
  if (!motore || !idVolume) return;
  const mpr = [VP.assiale, VP.coronale, VP.sagittale];
  const voi = Object.fromEntries(mpr.map((id) => [id, motore.getViewport(id).getProperties().voiRange]));
  const camere = Object.fromEntries(mpr.map((id) => [id, motore.getViewport(id).getCamera()]));
  const vecchio = idPet;
  if (fette) {
    const v = verificaVolume(fette);
    if (!v.ok) throw new Error('PET: ' + v.motivo);
    registraLut(mappa);
    const pet = creaVolume(v.ordinate, v.dz, v.normale, 'PT', max / 2, max, true);
    idPet = pet.volumeId; petMip3d = mip3d;
    await setVolumesForViewports(motore, [{ volumeId: idVolume }, { volumeId: idPet }, ...(idSeg ? [{ volumeId: idSeg }] : [])], mpr);
  } else {
    idPet = null;
    await setVolumesForViewports(motore, [{ volumeId: idVolume }, ...(idSeg ? [{ volumeId: idSeg }] : [])], mpr);
  }
  // 3D: con la PET la MIP a colori della PET, altrimenti (o con la RM) il 3D della TC
  try {
    const vr = motore.getViewport(VP.vr), cam = vr.getCamera();
    await setVolumesForViewports(motore, volumiVR(), [VP.vr]);
    modo3d(); vr.setCamera(cam); vr.render();
  } catch (e) { console.warn('PET nel 3D', e); }
  try { if (vecchio) cache.removeVolumeLoadObject(vecchio); } catch {}
  for (const id of mpr) {
    const vp = motore.getViewport(id);
    if (voi[id]) vp.setProperties({ voiRange: voi[id] }, idVolume);
    vp.setCamera(camere[id]);
  }
  if (idPet) aspettoFusione({ max, opacita, mappa, soglia }); else motore.render();
}
export function aspettoFusione({ max, opacita, mappa = aspettoPet?.mappa || CALDO, soglia = aspettoPet?.soglia ?? 0.15 }) {
  if (!motore || !idPet) return;
  aspettoPet = { max, opacita, mappa, soglia };
  const t = Math.max(0, Math.min(0.9, soglia)), t1 = Math.min(1, t + 0.2);
  const LUT_PET = registraLut(mappa);
  for (const id of [VP.assiale, VP.coronale, VP.sagittale]) {
    const vp = motore.getViewport(id);
    // sotto la soglia scelta (di base il 15% della scala) trasparente, poi sale in un 20% della scala:
    // il fondo (sangue, fegato, muscoli) non copre la TC e la captazione patologica resta piena
    const m = max * moltPet;   // il volume sovrapposto è moltiplicato per moltPet (vedi creaVolume)
    vp.setProperties({ colormap: { name: LUT_PET, opacity: opacita, opacityMapping: [
      { value: -32768, opacity: 0 }, { value: m * t, opacity: 0 }, { value: m * t1, opacity: 1 }, { value: 32767, opacity: 1 }] },
      voiRange: { lower: 0, upper: m } }, idPet);
    // strato MPR sottile: un solo campione per raggio, quindi l'opacità va applicata per intero
    // (altrimenti vtk la riduce in proporzione alla distanza tra i campioni e la PET quasi sparisce)
    const att = vp.getActors().find((a) => a.referencedId === idPet) || vp.getActors()[1];
    try { att?.actor.getProperty().setScalarOpacityUnitDistance(0, Math.max(0.01, vp.getSlabThickness?.() || 0.05)); } catch {}
    vp.render();
  }
  // 3D: la PET da sola, con la stessa mappa colore e la stessa scala delle viste MPR
  try {
    const vr = motore.getViewport(VP.vr), m = max * moltPet;
    if (petMip3d && vr.getActors().some((a) => a.referencedId === idPet)) {
      vr.setProperties({ colormap: { name: LUT_PET, opacityMapping: [{ value: -32768, opacity: 0 }, { value: m * Math.max(0.3, t1), opacity: 0 }, { value: m * 0.6, opacity: 0.02 }, { value: m, opacity: 0.7 }, { value: 32767, opacity: 0.7 }] },
        voiRange: { lower: 0, upper: m } }, idPet);
      // nel 3D voiRange non sempre arriva alla funzione colore: la scala si imposta direttamente
      const pr = vr.getActors().find((x) => x.referencedId === idPet).actor.getProperty();
      pr.getRGBTransferFunction(0).setMappingRange(0, m); pr.setUseGradientOpacity?.(0, false); pr.setShade?.(false);
      vr.render();
    }
  } catch (e) { console.warn('aspetto PET 3D', e); }
}

/** Cancella tutte le misure fatte nelle viste MPR */
export function cancellaMisure() {
  STORIA_MPR.tutte = true;
  try { const prima = annotazioni.state.getAllAnnotations().filter((x) => MISURE().includes(x.metadata?.toolName)).map(copiaAnn);
    if (prima.length) { STORIA_MPR.fatte.push({ tipo: 'gruppo', lista: prima }); STORIA_MPR.annullate = []; } } catch {}
  try { annotazioni.state.removeAllAnnotations(); } catch {}
  STORIA_MPR.tutte = false;
  cache3d.clear();
  try { motore?.render(); } catch {}
}

/** Cancella UNA misura: quella vicina al punto (coordinate dello schermo) nella vista MPR dell'elemento. true se cancellata */
export function cancellaMisuraVicina(el, clientX, clientY) {
  try {
    const r = el.getBoundingClientRect(), pt = [clientX - r.left, clientY - r.top];
    const a = tUtil.getAnnotationNearPoint(el, pt, 10);
    if (!a || !MISURE().includes(a.metadata?.toolName)) return false;
    annotazioni.state.removeAnnotation(a.annotationUID);    // ANNOTATION_REMOVED: si può annullare (Ctrl+Z)
    cache3d.clear(); motore?.render(); return true;
  } catch (e) { console.warn('cancella misura', e); return false; }
}
/** Cancella le misure selezionate (clic su una misura, poi Canc). Quante ne ha cancellate */
export function cancellaSelezionate() {
  let n = 0;
  try { for (const a of annotazioni.selection.getAnnotationsSelected() || []) if (MISURE().includes(a.metadata?.toolName)) { annotazioni.state.removeAnnotation(a.annotationUID); n++; } } catch {}
  if (n) { cache3d.clear(); try { motore?.render(); } catch {} }
  return n;
}
/** Orientamento della vista MPR (assiale, coronale, sagittale): normale al piano, verso «su» dello schermo e centro, in coordinate del paziente */
export function pianoVista(nome) {
  const vp = motore?.getViewport(VP[nome]); if (!vp) return null;
  const c = vp.getCamera(); if (!c?.viewPlaneNormal || !c?.viewUp) return null;
  return { normale: [...c.viewPlaneNormal], su: [...c.viewUp], centro: [...c.focalPoint] };
}
/** 14/11: piani orientati su un sistema della testa (es. piano orbito-meatale): X = sinistra, D = posteriore, S = superiore
 *  (ortonormali). Le tre viste ripartono da quelle standard e ruotano insieme; il centro delle linee va in «centro». */
export function orientaPiani({ X, D, S, centro }) {
  if (!motore) return false;
  ripristina();
  const rot = (v) => [0, 1, 2].map((c) => v[0] * X[c] + v[1] * D[c] + v[2] * S[c]);
  for (const nome of ['assiale', 'coronale', 'sagittale']) {
    try {
      const vp = motore.getViewport(VP[nome]), cam = vp.getCamera(), fp = cam.focalPoint, pos = cam.position;
      const d = pos.map((v, i) => v - fp[i]), dist = Math.hypot(...d) || 500, segno = d[0] * cam.viewPlaneNormal[0] + d[1] * cam.viewPlaneNormal[1] + d[2] * cam.viewPlaneNormal[2] >= 0 ? 1 : -1;
      const n = rot(cam.viewPlaneNormal), su = rot(cam.viewUp);
      vp.setCamera({ viewPlaneNormal: n, viewUp: su, focalPoint: [...centro], position: centro.map((v, i) => v + segno * dist * n[i]) });
      vp.render();
    } catch (e) { console.warn('orientaPiani', e); }
  }
  try { const c = ToolGroupManager.getToolGroup(ID_GRUPPO_MPR)?.getToolInstance(CrosshairsTool.toolName); if (c) { c.toolCenter = [...centro]; c.computeToolCenter?.(); } } catch {}
  try { motore.render(); } catch {}
  return true;
}
export function ridimensiona() { try { motore?.resize(true, true); } catch {} }

export function chiudi() {
  for (const [el, tipo, f] of CLIC_CENTRO.splice(0)) el.removeEventListener(tipo, f);
  try { for (const [el, f] of vertAscolto) el.removeEventListener(Enums.Events.IMAGE_RENDERED, f); } catch {} vertAscolto = []; vertebre = null;
  // prima si disattivano gli strumenti, così tolgono i loro ascoltatori dagli elementi
  try { const g = ToolGroupManager.getToolGroup(ID_GRUPPO_MPR); for (const t of Object.keys(g?.toolOptions || {})) g.setToolDisabled(t); } catch {}
  try { const g = ToolGroupManager.getToolGroup(ID_GRUPPO_3D); for (const t of Object.keys(g?.toolOptions || {})) g.setToolDisabled(t); } catch {}
  try { ToolGroupManager.destroyToolGroup(ID_GRUPPO_MPR); } catch {}
  try { ToolGroupManager.destroyToolGroup(ID_GRUPPO_3D); } catch {}
  try { motore?.destroy(); } catch {}
  motore = null;
  try { if (idVolume) cache.removeVolumeLoadObject(idVolume); } catch {}
  try { if (idPet) cache.removeVolumeLoadObject(idPet); } catch {}
  idPet = null;
  try { if (idVR) cache.removeVolumeLoadObject(idVR); } catch {}
  try { if (idSeg) cache.removeVolumeLoadObject(idSeg); } catch {}
  idVR = null; idSeg = null; segInfo = null; cacheCorpo = null; vasiR = null; cacheCorpo3d = null; baseVR = null; tagli = []; mipVR = false; tfBase = null; vistaCorrente = null;
  for (const c of CENTRI.splice(0)) { try { c.el.removeEventListener(Enums.Events.IMAGE_RENDERED, aggiornaCentri); c.dot.remove(); } catch {} }
  try { if (cpr) { for (const [el, tipo, f] of cpr.ascoltatori) el.removeEventListener(tipo, f); for (const c of cpr.tele) c.remove(); } } catch {}
  cpr = null; iaVaso = null; cacheR = null; cacheL = null;
  try { cache.purgeCache(); } catch {}
  try { csUtils.genericMetadataProvider.clear(); } catch {}
  idVolume = null;
  VOL = null; cache3d.clear();
  try { STORIA_MPR.tutte = true; annotazioni.state.removeAllAnnotations(); } catch {}
  STORIA_MPR.tutte = false; STORIA_MPR.fatte = []; STORIA_MPR.annullate = [];
}

// =============================================================================================
// ELABORAZIONI DEL VOLUME (solo TC): 3D senza lettino / senza osso, segmentazioni, CPR
// =============================================================================================
const IDX = (i, j, k) => (k * VOL.dim[1] + j) * VOL.dim[0] + i;
/** Corpo per strato: soglia −500 HU, componenti grandi; tutto ciò che non è raggiungibile dal bordo
 *  passando fuori dal corpo resta dentro (così i polmoni sono «dentro» e il lettino «fuori»). */
function mascheraCorpo(f = 1) {
  const [W0, H0, N] = VOL.dim, W = Math.ceil(W0 / f), H = Math.ceil(H0 / f), d = VOL.dati;
  const dentro = new Uint8Array(W * H * N), lab = new Int32Array(W * H), coda = new Int32Array(W * H);
  for (let k = 0; k < N; k++) {
    lab.fill(0);
    const T = new Uint8Array(W * H), o0 = k * W0 * H0;
    for (let j = 0; j < H; j++) { const r0 = o0 + Math.min(H0 - 1, j * f) * W0; for (let i = 0; i < W; i++) T[j * W + i] = d[r0 + Math.min(W0 - 1, i * f)] > -500 ? 1 : 0; }
    const tess = (i, j) => T[j * W + i] === 1;
    // componenti dei tessuti
    const aree = [0];
    for (let p = 0; p < W * H; p++) {
      if (lab[p] || !tess(p % W, (p / W) | 0)) continue;
      const L = aree.length; let qn = 0, qi = 0, a = 0; coda[qn++] = p; lab[p] = L;
      while (qi < qn) { const q = coda[qi++], x = q % W, y = (q / W) | 0; a++;
        if (x > 0 && !lab[q - 1] && tess(x - 1, y)) { lab[q - 1] = L; coda[qn++] = q - 1; }
        if (x < W - 1 && !lab[q + 1] && tess(x + 1, y)) { lab[q + 1] = L; coda[qn++] = q + 1; }
        if (y > 0 && !lab[q - W] && tess(x, y - 1)) { lab[q - W] = L; coda[qn++] = q - W; }
        if (y < H - 1 && !lab[q + W] && tess(x, y + 1)) { lab[q + W] = L; coda[qn++] = q + W; } }
      aree.push(a);
    }
    const max = aree.reduce((m, a) => (a > m ? a : m), 0), tieni = aree.map((a) => a >= max * 0.08 && a > 50 / f / f);
    // fuori: dal bordo, attraverso i pixel che non sono corpo
    const fuori = new Uint8Array(W * H); let qn = 0, qi = 0;
    const tieniU = Uint8Array.from(tieni, (x) => (x ? 1 : 0)), corpo = (q) => lab[q] !== 0 && tieniU[lab[q]] === 1;
    for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const q = y * W + x; if (!corpo(q) && !fuori[q]) { fuori[q] = 1; coda[qn++] = q; } }
    for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const q = y * W + x; if (!corpo(q) && !fuori[q]) { fuori[q] = 1; coda[qn++] = q; } }
    while (qi < qn) { const q = coda[qi++], x = q % W, y = (q / W) | 0;
      if (x > 0 && !fuori[q - 1] && !corpo(q - 1)) { fuori[q - 1] = 1; coda[qn++] = q - 1; }
      if (x < W - 1 && !fuori[q + 1] && !corpo(q + 1)) { fuori[q + 1] = 1; coda[qn++] = q + 1; }
      if (y > 0 && !fuori[q - W] && !corpo(q - W)) { fuori[q - W] = 1; coda[qn++] = q - W; }
      if (y < H - 1 && !fuori[q + W] && !corpo(q + W)) { fuori[q + W] = 1; coda[qn++] = q + W; } }
    const o = k * W * H; for (let q = 0; q < W * H; q++) dentro[o + q] = fuori[q] ? 0 : 1;
  }
  return { dentro, W, H, N, f };
}
/** Osso: semi nella corticale (≥ 450 HU), crescita nello spongioso (≥ 170 HU) per al massimo 6 voxel,
 *  poi un voxel di margine. I vasi con mdc (200-450 HU) che toccano l'osso restano quasi sempre. */
function mascheraOsso() {
  const [W, H, N] = VOL.dim, d = VOL.dati, n = W * H * N;
  const dist = new Uint8Array(n); let coda = [];
  for (let p = 0; p < n; p++) if (d[p] >= 450) { dist[p] = 1; coda.push(p); }
  for (let liv = 2; liv <= 7 && coda.length; liv++) {
    const nuova = [];
    for (const p of coda) { const i = p % W, j = ((p / W) | 0) % H, k = (p / (W * H)) | 0;
      for (const [q, ok] of [[p - 1, i > 0], [p + 1, i < W - 1], [p - W, j > 0], [p + W, j < H - 1], [p - W * H, k > 0], [p + W * H, k < N - 1]])
        if (ok && !dist[q] && d[q] >= 170) { dist[q] = liv; nuova.push(q); } }
    coda = nuova;
  }
  // margine di un voxel nel piano (effetto di volume parziale)
  const out = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (dist[p]) { out[p] = 1; const i = p % W, j = ((p / W) | 0) % H;
    if (i > 0 && d[p - 1] > 90) out[p - 1] = 1; if (i < W - 1 && d[p + 1] > 90) out[p + 1] = 1; if (j > 0 && d[p - W] > 90) out[p - W] = 1; if (j < H - 1 && d[p + W] > 90) out[p + W] = 1; }
  return out;
}
/** Gabbia toracica: l'osso degli strati con i polmoni e dei 6 cm sotto (coste, sterno, clavicole, scapole) tranne la colonna:
 *  si tiene l'osso entro 4 cm dal centro della colonna, trovato strato per strato vicino alla linea mediana,
 *  nella metà posteriore del corpo. */
function mascheraGabbia() {
  const [W, H, N] = VOL.dim, WH = W * H, osso = mascheraOsso(), out = new Uint8Array(osso.length);
  const R = ridotta(), C = mascheraCorpo(2).dentro, pol = polmoni(R, C);
  const conPolmone = new Uint8Array(N); for (let p = 0; p < pol.length; p++) if (pol[p]) conPolmone[(p / (R.W * R.H)) | 0] = 1;
  // le ultime coste (fluttuanti) scendono sotto la base dei polmoni: si estende di 6 cm verso i piedi
  const su = VOL.assi[2][2] >= 0 ? 1 : -1, ext = Math.round(60 / VOL.sp[2]);
  const ks = [...conPolmone.keys()].filter((k) => conPolmone[k]);
  if (ks.length) { const kb = su > 0 ? Math.min(...ks) : Math.max(...ks); for (let t = 1; t <= ext; t++) { const k = kb - su * t; if (k >= 0 && k < N) conPolmone[k] = 1; } }
  const xm = lineaMediana(R, C), sx = VOL.sp[0], sy = VOL.sp[1];
  const colonnaX = (i) => VOL.origine[0] + VOL.assi[0][0] * i * sx;   // assiale: x del paziente dalla colonna dell'immagine
  for (let k = 0; k < N; k++) {
    if (!conPolmone[k]) continue;
    const o = k * WH;
    // metà posteriore del corpo in questo strato (in LPS la y cresce verso il dorso)
    let y0 = H, y1 = 0; for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 4) if (C[(k * R.H + Math.min(R.H - 1, j >> 1)) * R.W + Math.min(R.W - 1, i >> 1)]) { if (j < y0) y0 = j; if (j > y1) y1 = j; }
    const dorso = VOL.assi[1][1] >= 0 ? (j) => j > (y0 + y1) / 2 : (j) => j < (y0 + y1) / 2;
    let ci = 0, cj = 0, cn = 0;
    for (let j = 0; j < H; j++) { if (!dorso(j)) continue; for (let i = 0; i < W; i++) if (osso[o + j * W + i] && Math.abs(colonnaX(i) - xm) < 25) { ci += i; cj += j; cn++; } }
    if (cn < 20) continue;
    ci /= cn; cj /= cn;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const p = o + j * W + i; if (osso[p] && Math.hypot((i - ci) * sx, (j - cj) * sy) > 40) out[p] = 1; }
  }
  return out;
}
let idVR = null, cacheCorpo = null;
/** 3D (volume rendering) senza lettino e/o senza osso; la vista MPR resta sul volume originale */
export async function volume3d({ lettino = false, osso = false, gabbia = false, preset } = {}) {
  if (vista3d) return vista3d({ tipo: preset || presetVR || 'CT-AAA', lettino: !lettino, osso, gabbia });
  if (!motore || !VOL) return { ok: false };
  if (VOL.unita !== 'HU') return { ok: false, motivo: 'solo per la TC' };
  const vr = motore.getViewport(VP.vr), cam = vr.getCamera();
  // prima si libera il 3D elaborato precedente: due copie del volume intero nella memoria grafica, oltre a quello
  // dell'MPR, su molti computer fanno perdere il contesto WebGL e il 3D resta nero («cancella tutto»)
  if (idVR) { const vecchio = idVR; idVR = null; await setVolumesForViewports(motore, volumiVR(), [VP.vr]); try { cache.removeVolumeLoadObject(vecchio); } catch {} }
  if (lettino || osso || gabbia) {
    try {
      const dati = new Int16Array(VOL.dati.length); dati.set(VOL.dati);
      // senza osso / gabbia si toglie sempre anche il lettino (denso come l'osso, resterebbe sospeso nel 3D)
      cacheCorpo ||= mascheraCorpo(1);
      { const m = cacheCorpo.dentro; for (let p = 0; p < dati.length; p++) if (!m[p]) dati[p] = -1024; }
      if (osso) { const m = mascheraOsso(); for (let p = 0; p < dati.length; p++) if (m[p]) dati[p] = 30; }
      else if (gabbia) { const m = mascheraGabbia(); for (let p = 0; p < dati.length; p++) if (m[p]) dati[p] = 30; }
      // volumi grandi: il 3D si fa a metà risoluzione nel piano (media 2×2), basta per la vista e occupa un quarto
      const g = VOL.dim[0] * VOL.dim[1] * VOL.dim[2] > 30e6 ? dimezzaVR(dati) : { dati, dim: VOL.dim, sp: VOL.sp, origine: VOL.origine };
      const v = volumeDaDati('quizVR', g.dati, { dim: g.dim, sp: g.sp, origine: g.origine, assi: VOL.assi });
      idVR = v.volumeId;
      await setVolumesForViewports(motore, volumiVR(), [VP.vr]);
    } catch (e) {
      console.error(e); idVR = null; await setVolumesForViewports(motore, volumiVR(), [VP.vr]);
      presetVR = preset || presetVR || 'CT-AAA'; modo3d(); vr.setCamera(cam); vr.render();
      return { ok: false, motivo: 'memoria insufficiente su questo dispositivo (' + e.message + ')' };
    }
  }
  presetVR = preset || presetVR || 'CT-AAA';
  modo3d(); vr.setCamera(cam); vr.render();
  if (idPet && aspettoPet) aspettoFusione(aspettoPet);
  return { ok: true };
}

// =============================================================================================
// 14/11: 3D rivisto. Preset curati (Vascular, Angiography, Willis, Angio e ossa con colori diversi), lettino tolto di
// base, rimozioni più fini (corpo come componente 3D, osso con le cavità riempite), torace «interno» per vasi e polmone,
// finestra (contrasto) sul volume rendering, Ritaglio a mano libera con annulla e reset, punto centrale delle linee.
// =============================================================================================
const PRESET_QR = [
  // solo vasi (volume con i soli vasi): rosso, calcificazioni e mdc densissimo giallo chiaro
  { name: 'QR-Vascular', gradientOpacity: '4 0 1 255 1', specularPower: '12', specular: '0.3', shade: '1', ambient: '0.15', diffuse: '0.85', interpolation: '1',
    scalarOpacity: '12 -3024 0 100 0 180 0.5 320 0.8 900 0.85 3071 0.85',
    colorTransfer: '24 -3024 0 0 0 100 0.45 0.03 0.03 200 0.78 0.1 0.08 380 0.95 0.22 0.18 800 1 0.92 0.7 3071 1 1 0.9' },
  // vasi e ossa con colori diversi: l'osso è codificato sotto l'aria (−1150…−1900), i vasi restano nei valori reali
  { name: 'QR-AngioOssa', gradientOpacity: '4 0 1 255 1', specularPower: '12', specular: '0.3', shade: '1', ambient: '0.15', diffuse: '0.85', interpolation: '1',
    scalarOpacity: '20 -3024 0.85 -1900 0.85 -1240 0.7 -1170 0 -1030 0 100 0 180 0.5 320 0.8 900 0.85 3071 0.85',
    colorTransfer: '36 -3024 0.95 0.93 0.84 -1900 0.95 0.93 0.84 -1240 0.9 0.85 0.72 -1170 0.9 0.85 0.72 -1030 0 0 0 100 0.45 0.03 0.03 200 0.78 0.1 0.08 380 0.95 0.22 0.18 3071 1 0.92 0.7' },
  // MIP dei vasi (Angiography): rampa lineare in grigi
  { name: 'QR-MIP', gradientOpacity: '4 0 1 255 1', specularPower: '1', specular: '0', shade: '0', ambient: '1', diffuse: '0', interpolation: '1',
    scalarOpacity: '8 -3024 0 90 0 160 1 3071 1', colorTransfer: '16 -3024 0 0 0 90 0 0 0 340 1 1 1 3071 1 1 1' },
  // ossa: solo dall'osso in su (prima «CT-Bone» mostrava anche cute e muscoli); avorio
  { name: 'QR-Ossa', gradientOpacity: '4 0 1 255 1', specularPower: '10', specular: '0.25', shade: '1', ambient: '0.15', diffuse: '0.85', interpolation: '1',
    scalarOpacity: '10 -3024 0 140 0 260 0.6 700 0.85 3071 0.9', colorTransfer: '16 -3024 0.62 0.5 0.35 140 0.62 0.5 0.35 400 0.93 0.88 0.76 3071 1 0.98 0.92' },
  // torace interno (cute e parete già tolte): vasi, cuore e mediastino; l'aria dei polmoni trasparente
  { name: 'QR-Torace', gradientOpacity: '4 0 1 255 1', specularPower: '10', specular: '0.2', shade: '1', ambient: '0.15', diffuse: '0.85', interpolation: '1',
    scalarOpacity: '12 -3024 0 -350 0 -120 0.25 60 0.6 300 0.85 3071 0.85', colorTransfer: '20 -3024 0 0 0 -350 0.55 0.25 0.15 40 0.85 0.35 0.3 250 1 0.55 0.5 3071 1 1 0.95' },
  // arterie polmonari: il sangue opacizzato (≥ 150 HU) rosso pieno, il resto del mediastino tenue
  { name: 'QR-AP', gradientOpacity: '4 0 1 255 1', specularPower: '10', specular: '0.25', shade: '1', ambient: '0.15', diffuse: '0.85', interpolation: '1',
    scalarOpacity: '12 -3024 0 -300 0 -100 0.06 100 0.08 200 0.75 3071 0.85', colorTransfer: '20 -3024 0 0 0 -300 0.4 0.3 0.3 100 0.6 0.45 0.45 200 0.9 0.15 0.12 3071 1 0.4 0.3' },
  { name: 'QR-MIP-RM', gradientOpacity: '4 0 1 255 1', specularPower: '1', specular: '0', shade: '0', ambient: '1', diffuse: '0', interpolation: '1',
    scalarOpacity: '6 0 0 300 0 3000 1', colorTransfer: '12 0 0 0 0 300 0 0 0 3000 1 1 1' },
];
function registraPresetQR() {
  try { for (const p of PRESET_QR) if (!CONSTANTS.VIEWPORT_PRESETS.some((x) => x.name === p.name)) CONSTANTS.VIEWPORT_PRESETS.push(p); } catch (e) { console.warn('preset', e); }
}
// corpo come componente 3D: maschera per strato (griglia ridotta di 2), erosa di 2 voxel nel piano (si staccano lettino,
// supporti e cuscini che toccano), componenti 3D: restano la più grande e quelle almeno al 30% (braccia staccate), poi
// ricostruite dentro la maschera di partenza. Il lettino resta fuori anche quando nel singolo strato è grande.
let cacheCorpo3d = null;
function corpo3dR() {
  if (cacheCorpo3d?.vol === VOL) return cacheCorpo3d.m;
  const C = mascheraCorpo(2), { W, H, N } = C, er = erodi(C.dentro, W, H, N, 2), { lab, comp } = componenti3d(er, W, H, N);
  const max = comp.reduce((a, c) => Math.max(a, c.n), 0), tieni = new Uint8Array(comp.length + 2);
  for (const c of comp) if (c.n >= max * 0.3) tieni[c.L] = 1;
  let m = new Uint8Array(er.length); for (let p = 0; p < m.length; p++) if (tieni[lab[p]]) m[p] = 1;
  m = dilataIn(m, C.dentro, W, H, N, 4);
  cacheCorpo3d = { vol: VOL, m: { m, W, H, N, f: 2 } };
  return cacheCorpo3d.m;
}
function corpoPieno() {   // a piena risoluzione: maschera per strato ∧ corpo 3D (allargato di un voxel ridotto)
  cacheCorpo ||= mascheraCorpo(1);
  const [W0, H0, N] = VOL.dim, c = corpo3dR(), out = new Uint8Array(W0 * H0 * N), d = cacheCorpo.dentro;
  for (let k = 0; k < N; k++) for (let j = 0; j < H0; j++) { const jj = Math.min(c.H - 1, j >> 1);
    for (let i = 0; i < W0; i++) { const ii = Math.min(c.W - 1, i >> 1), q = (k * c.H + jj) * c.W + ii, p = (k * H0 + j) * W0 + i;
      if (d[p] && (c.m[q] || (ii > 0 && c.m[q - 1]) || (ii < c.W - 1 && c.m[q + 1]) || (jj > 0 && c.m[q - c.W]) || (jj < c.H - 1 && c.m[q + c.W]))) out[p] = 1; } }
  return out;
}
// osso più completo: come mascheraOsso, con soglia dei semi sopra il sangue opacizzato (angio-TC) e le cavità chiuse
// strato per strato (spongiosa dei corpi vertebrali, canale midollare) se piccole (fino a 20 cm²: non il cranio)
function mascheraOssoFine() {
  const [W, H, N] = VOL.dim, d = VOL.dati, n = W * H * N, R = ridottaC(), dv = VOL.unita === 'HU' ? densitaVasi(R, corpo3dR().m) : null;
  const seme = dv ? Math.max(450, Math.round(dv * 1.35 + 60)) : 450;
  const dist = new Uint8Array(n); let coda = [];
  const cal = calcioPerOsso(), calR = (p) => { if (!cal) return 0; const i = p % W, j = ((p / W) | 0) % H, k = (p / (W * H)) | 0,
    ii = Math.min(cal.W - 1, i >> 1), jj = Math.min(cal.H - 1, j >> 1), q = (k * cal.H + jj) * cal.W + ii;
    return cal.m[q] || (ii > 0 && cal.m[q - 1]) || (ii < cal.W - 1 && cal.m[q + 1]) || (jj > 0 && cal.m[q - cal.W]) || (jj < cal.H - 1 && cal.m[q + cal.W]); };
  for (let p = 0; p < n; p++) if (d[p] >= seme && !calR(p)) { dist[p] = 1; coda.push(p); }
  for (let liv = 2; liv <= 8 && coda.length; liv++) {
    const nuova = [];
    for (const p of coda) { const i = p % W, j = ((p / W) | 0) % H, k = (p / (W * H)) | 0;
      for (const [q, ok] of [[p - 1, i > 0], [p + 1, i < W - 1], [p - W, j > 0], [p + W, j < H - 1], [p - W * H, k > 0], [p + W * H, k < N - 1]])
        if (ok && !dist[q] && d[q] >= 160 && (!dv || d[q] < dv * 0.85 || d[q] >= seme)) { dist[q] = liv; nuova.push(q); } }
    coda = nuova;
  }
  const out = new Uint8Array(n); for (let p = 0; p < n; p++) if (dist[p]) out[p] = 1;
  // cavità piccole chiuse dall'osso, strato per strato
  const maxPix = Math.round(2000 / (VOL.sp[0] * VOL.sp[1])), WH = W * H, lab = new Int32Array(WH), cq = new Int32Array(WH);
  for (let k = 0; k < N; k++) {
    const o = k * WH; lab.fill(0); let L = 1;
    for (let q0 = 0; q0 < WH; q0++) {
      if (lab[q0] || out[o + q0]) continue;
      L++; let qi = 0, qn = 0, bordo = false; cq[qn++] = q0; lab[q0] = L;
      while (qi < qn) { const q = cq[qi++], x = q % W, y = (q / W) | 0; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) bordo = true;
        for (const [b, ok] of [[q - 1, x > 0], [q + 1, x < W - 1], [q - W, y > 0], [q + W, y < H - 1]]) if (ok && !lab[b] && !out[o + b]) { lab[b] = L; cq[qn++] = b; } }
      if (!bordo && qn <= maxPix) for (let t = 0; t < qn; t++) out[o + cq[t]] = 1;
    }
  }
  // un voxel di margine nel piano (volume parziale)
  const m2 = out.slice();
  for (let p = 0; p < n; p++) if (out[p]) { const i = p % W, j = ((p / W) | 0) % H;
    if (i > 0 && d[p - 1] > 90) m2[p - 1] = 1; if (i < W - 1 && d[p + 1] > 90) m2[p + 1] = 1; if (j > 0 && d[p - W] > 90) m2[p - W] = 1; if (j < H - 1 && d[p + W] > 90) m2[p + W] = 1; }
  return m2;
}
// torace «interno»: inviluppo convesso dei polmoni strato per strato (griglia ridotta), allargato di 2 voxel: cuore,
// mediastino, vasi e polmoni restano, la parete (cute, muscoli, coste in gran parte) va via
function toraceInternoR() {
  const R = ridottaC(), C = corpo3dR().m, pol = polmoni(R, C), { W, H, N } = R, WH = W * H, out = new Uint8Array(W * H * N);
  let strati = 0;
  for (let k = 0; k < N; k++) {
    const pts = []; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (pol[k * WH + j * W + i]) pts.push([i, j]);
    if (pts.length < 20) continue; strati++;
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let t = pts.length - 1; t >= 0; t--) { const p = pts[t]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    const poli = lo.slice(0, -1).concat(hi.slice(0, -1));
    for (let j = 0; j < H; j++) {   // riempimento a righe
      const xs = []; for (let a = 0; a < poli.length; a++) { const p = poli[a], q = poli[(a + 1) % poli.length];
        if ((p[1] <= j && q[1] > j) || (q[1] <= j && p[1] > j)) xs.push(p[0] + (j - p[1]) / (q[1] - p[1]) * (q[0] - p[0])); }
      xs.sort((a, b) => a - b); for (let t = 0; t + 1 < xs.length; t += 2) for (let i = Math.ceil(xs[t]); i <= Math.floor(xs[t + 1]); i++) out[k * WH + j * W + i] = 1;
    }
  }
  return strati ? { m: dilataIn(out, new Uint8Array(out.length).fill(1), W, H, N, 2), W, H, N } : null;
}
// vasi del torace / arterie polmonari: i polmoni con i loro vasi (buchi della maschera riempiti strato per strato) più i vasi
// con mdc (segmentazione dei vasi: cuore, aorta, tronco polmonare). Niente parete e niente «inviluppo»: nessuna superficie
// di taglio davanti al cuore.
function toraceVasiR() {
  const R = ridottaC(), C = corpo3dR().m, pol = polmoni(R, C); let tot = 0; for (let p = 0; p < pol.length; p++) tot += pol[p];
  if (!tot) return null;
  const m = riempiBuchi(pol.slice(), R.W, R.H, R.N);
  try { const v = vasi(R, C); if (v.tot) for (let p = 0; p < m.length; p++) if (v.m[p]) m[p] = 1; } catch (e) { console.warn('vasi', e); }
  return { m, W: R.W, H: R.H, N: R.N };
}
const daRidotta = (m, i, j, k) => m.m[(k * m.H + Math.min(m.H - 1, j >> 1)) * m.W + Math.min(m.W - 1, i >> 1)];

// ---- volume del 3D: base (elaborazioni) + ritagli
let baseVR = null, tagli = [], mipVR = false, vistaCorrente = null;
const TORACE = ['CT-Chest-Vessels', 'CT-Pulmonary-Arteries', 'CT-Lung'];
/** tipo: id del menu (preset vtk o QR-…); lettino = true per lasciarlo (di base si toglie); osso / gabbia: toglierli */
export async function vista3d({ tipo, lettino = false, osso = false, gabbia = false } = {}) {
  if (!motore || !VOL) return { ok: false };
  registraPresetQR();
  const ct = VOL.unita === 'HU', [W0, H0, N] = VOL.dim, info = {};
  vistaCorrente = { tipo, lettino, osso, gabbia };
  let dati = null, preset = tipo, mip = false;
  try {
    if (/^QR-(vascular|willis|angiography)$/.test(tipo)) {
      const R = ridottaC(), C = ct ? corpo3dR().m : new Uint8Array(R.r.length).fill(1), v = vasi(R, C);
      if (!v.tot) return { ok: false, motivo: 'vasi con mdc non trovati: serve un\'angio-TC o un\'angio-RM' };
      info.soglia = v.soglia;
      dati = new Int16Array(W0 * H0 * N).fill(ct ? -1024 : 0); const d = VOL.dati;
      for (let k = 0; k < N; k++) for (let j = 0; j < H0; j++) for (let i = 0; i < W0; i++) {
        const ii = Math.min(R.W - 1, Math.round(i / R.f)), jj = Math.min(R.H - 1, Math.round(j / R.f)), b = (k * R.H + jj) * R.W + ii;
        if (v.m[b] || (ii > 0 && v.m[b - 1]) || (ii < R.W - 1 && v.m[b + 1]) || (jj > 0 && v.m[b - R.W]) || (jj < R.H - 1 && v.m[b + R.W])) { const p = (k * H0 + j) * W0 + i; dati[p] = d[p]; }
      }
      mip = tipo === 'QR-angiography'; preset = mip ? (ct ? 'QR-MIP' : 'QR-MIP-RM') : ct ? 'QR-Vascular' : 'MR-Angio';
    } else {
      dati = new Int16Array(VOL.dati.length); dati.set(VOL.dati);
      if (ct) {
        if (!lettino) { const m = corpoPieno(); for (let p = 0; p < dati.length; p++) if (!m[p]) dati[p] = -1024; }
        if (tipo === 'QR-angio-ossa') {
          // vasi dalla segmentazione dei vasi (rossi, valori reali); tutto il resto denso (≥ 150 HU: ossa, ma anche
          // calcificazioni e organi molto impregnati) avorio, codificato sotto l'aria
          const R = ridottaC(), v = vasi(R, corpo3dR().m), mv = v.m;
          for (let k = 0; k < N; k++) for (let j = 0; j < H0; j++) for (let i = 0; i < W0; i++) {
            const p = (k * H0 + j) * W0 + i, x = VOL.dati[p]; if (x < 150 || dati[p] === -1024) continue;
            const ii = Math.min(R.W - 1, Math.round(i / R.f)), jj = Math.min(R.H - 1, Math.round(j / R.f)), b = (k * R.H + jj) * R.W + ii;
            if (mv[b] || (ii > 0 && mv[b - 1]) || (ii < R.W - 1 && mv[b + 1]) || (jj > 0 && mv[b - R.W]) || (jj < R.H - 1 && mv[b + R.W])) continue;
            dati[p] = Math.max(-1900, -1150 - (x - 150) * 0.6);
          }
          preset = 'QR-AngioOssa';
        } else if (osso || tipo === 'CT-Pulmonary-Arteries') { const o = mascheraOssoFine(); for (let p = 0; p < dati.length; p++) if (o[p]) dati[p] = 30; }
        else if (gabbia) { const o = mascheraGabbia(); for (let p = 0; p < dati.length; p++) if (o[p]) dati[p] = 30; }
        if (TORACE.includes(tipo)) {
          const t = tipo === 'CT-Lung' ? toraceInternoR() : toraceVasiR();
          if (t) { const fuori = tipo === 'CT-Lung' ? 0 : -1024;
            for (let k = 0; k < N; k++) for (let j = 0; j < H0; j++) for (let i = 0; i < W0; i++) if (!daRidotta(t, i, j, k)) dati[(k * H0 + j) * W0 + i] = fuori; }
          else info.avviso = 'polmoni non trovati: niente ritaglio del torace';
        }
      } else if (tipo === 'QR-angiography') { mip = true; preset = 'QR-MIP-RM'; }
      if (ct) preset = { 'CT-Bone': 'QR-Ossa', 'CT-Chest-Vessels': 'QR-Torace', 'CT-Pulmonary-Arteries': 'QR-AP' }[tipo] || preset;
    }
  } catch (e) { console.error(e); return { ok: false, motivo: 'memoria insufficiente su questo dispositivo (' + e.message + ')' }; }
  baseVR = VOL.dim[0] * VOL.dim[1] * VOL.dim[2] > 30e6 ? dimezzaVR(dati) : { dati, dim: VOL.dim, sp: VOL.sp, origine: VOL.origine };
  mipVR = mip; presetVR = preset;
  await carica3d();
  return { ok: true, ...info, tagli: tagli.length };
}
async function carica3d() {
  const vr = motore.getViewport(VP.vr), cam = vr.getCamera(), vecchio = idVR;
  let d = baseVR.dati;
  if (tagli.length) { d = baseVR.dati.slice(); for (const t of tagli) applicaTaglio(t, d, baseVR); }
  try {
    idVR = volumeDaDati('quizVR', d, { dim: baseVR.dim, sp: baseVR.sp, origine: baseVR.origine, assi: VOL.assi }).volumeId;
    await setVolumesForViewports(motore, volumiVR(), [VP.vr]);
  } finally { try { if (vecchio && vecchio !== idVR) cache.removeVolumeLoadObject(vecchio); } catch {} }
  modo3d(); vr.setCamera(cam); vr.render();
  if (idPet && aspettoPet) aspettoFusione(aspettoPet);
}
function blend3d() {
  try { const a = motore.getViewport(VP.vr).getActors()[0]?.actor, m = a?.getMapper?.(); if (!m) return;
    if (mipVR) m.setBlendModeToMaximumIntensity(); else m.setBlendModeToComposite(); } catch (e) { console.warn('blend', e); }
}
// ---- Ritaglio a mano libera: il poligono disegnato sulla vista 3D si proietta lungo la direzione di vista; i voxel
// che cadono dentro si tolgono (aria). La proiezione mondo → schermo è la matrice 3×4 stimata dai punti di Cornerstone.
function matriceProiezione() {
  const vp = motore.getViewport(VP.vr), g = baseVR, A = VOL.assi, pts = [];
  for (const a of [0, 0.5, 1]) for (const b of [0, 0.5, 1]) for (const c of [0, 0.5, 1]) {
    const ijk = [a * (g.dim[0] - 1), b * (g.dim[1] - 1), c * (g.dim[2] - 1)];
    const w = [0, 1, 2].map((q) => g.origine[q] + ijk[0] * g.sp[0] * A[0][q] + ijk[1] * g.sp[1] * A[1][q] + ijk[2] * g.sp[2] * A[2][q]);
    const s = vp.worldToCanvas(w); if (s?.every(Number.isFinite)) pts.push([w, s]);
  }
  // minimi quadrati con p34 = 1: 11 incognite
  const M = Array.from({ length: 11 }, () => new Float64Array(12));
  const riga = (r, y) => { for (let a = 0; a < 11; a++) { for (let b = 0; b < 11; b++) M[a][b] += r[a] * r[b]; M[a][11] += r[a] * y; } };
  for (const [[x, y, z], [u, v]] of pts) { riga([x, y, z, 1, 0, 0, 0, 0, -u * x, -u * y, -u * z], u); riga([0, 0, 0, 0, x, y, z, 1, -v * x, -v * y, -v * z], v); }
  for (let c = 0; c < 11; c++) { let piv = c; for (let r = c + 1; r < 11; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r; [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < 11; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let t = c; t < 12; t++) M[r][t] -= f * M[c][t]; } }
  const p = M.map((r, i) => r[11] / r[i]); p.push(1);
  return p;   // [p11 p12 p13 p14 p21 … p34]
}
function applicaTaglio(t, d, g) {
  const [W, H, N] = g.dim, A = VOL.assi, P = t.P, w = t.w, h = t.h, m = t.mask, vuoto = VOL.unita === 'HU' ? -1024 : 0;
  const pr = (q) => [P[0] * q[0] + P[1] * q[1] + P[2] * q[2], P[4] * q[0] + P[5] * q[1] + P[6] * q[2], P[8] * q[0] + P[9] * q[1] + P[10] * q[2]];
  const ax = [0, 1, 2].map((a) => pr([0, 1, 2].map((q) => A[a][q] * g.sp[a])));
  const o0 = pr(g.origine), b0 = [o0[0] + P[3], o0[1] + P[7], o0[2] + P[11]];
  for (let k = 0; k < N; k++) for (let j = 0; j < H; j++) {
    let u = b0[0] + j * ax[1][0] + k * ax[2][0], v = b0[1] + j * ax[1][1] + k * ax[2][1], s = b0[2] + j * ax[1][2] + k * ax[2][2];
    const o = (k * H + j) * W;
    for (let i = 0; i < W; i++, u += ax[0][0], v += ax[0][1], s += ax[0][2]) {
      const x = Math.round(u / s), y = Math.round(v / s);
      if (x >= 0 && y >= 0 && x < w && y < h && m[y * w + x]) d[o + i] = vuoto;
    }
  }
}
/** poli: punti [x, y] in pixel CSS della vista 3D (larghezza w, altezza h) */
export async function taglia(poli, w, h) {
  if (!motore || !baseVR || poli.length < 3) return { ok: false };
  const cv = new OffscreenCanvas(Math.round(w), Math.round(h)), cx = cv.getContext('2d');
  cx.beginPath(); poli.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath(); cx.fillStyle = '#fff'; cx.fill();
  const px = cx.getImageData(0, 0, cv.width, cv.height).data, mask = new Uint8Array(cv.width * cv.height);
  for (let q = 0; q < mask.length; q++) mask[q] = px[q * 4 + 3] > 0 ? 1 : 0;
  tagli.push({ P: matriceProiezione(), mask, w: cv.width, h: cv.height });
  await carica3d();
  return { ok: true, n: tagli.length };
}
export async function annullaTaglio() { if (!tagli.length || !baseVR) return 0; tagli.pop(); await carica3d(); return tagli.length; }
export async function azzeraTagli() { if (!baseVR) return 0; tagli = []; await carica3d(); return 0; }
export const numeroTagli = () => tagli.length;
export function _diagnosiVR() {
  const vp = motore?.getViewport(VP.vr); return { preset: presetVR, mip: mipVR, tagli: tagli.length, attori: (vp?.getActors() || []).map((x) => { const m = x.actor.getMapper(); return { uid: x.uid, blend: m.getBlendMode?.(), classe: m.getClassName?.() }; }) };
}
// ---- finestra (contrasto) sul volume rendering: sposta e stringe/allarga le curve del preset (opacità e colori).
// Verso il basso si vedono strutture meno dense, fino ai tessuti molli e alla cute.
let tfBase = null, tfStato = { sposta: 0, scala: 1 };
function proprieta3d() { return motore?.getViewport(VP.vr)?.getActors()[0]?.actor?.getProperty?.(); }
function memorizzaTF() {
  const pr = proprieta3d(); if (!pr) return null;
  const of = pr.getScalarOpacity(0), cf = pr.getRGBTransferFunction(0), o = [], c = [];
  for (let i = 0; i < of.getSize(); i++) { const v = [0, 0, 0, 0]; of.getNodeValue(i, v); o.push(v); }
  for (let i = 0; i < cf.getSize(); i++) { const v = [0, 0, 0, 0, 0, 0]; cf.getNodeValue(i, v); c.push(v); }
  const ancora = (o.find((v) => v[1] > 0.01 && v[0] > -2000) || o[0] || [0])[0];
  return { o, c, ancora };
}
export function contrasto3d(sposta, scala = 1) {
  if (!motore) return null;
  tfBase ||= memorizzaTF(); const pr = proprieta3d(); if (!tfBase || !pr) return null;
  tfStato = { sposta, scala: Math.max(0.2, Math.min(5, scala)) };
  const X = (x) => (x <= -2000 || x >= 3000 ? x : tfBase.ancora + (x - tfBase.ancora) * tfStato.scala + sposta);
  const of = pr.getScalarOpacity(0), cf = pr.getRGBTransferFunction(0);
  of.removeAllPoints(); for (const [x, y, m, s] of tfBase.o) of.addPointLong(X(x), y, m, s);
  cf.removeAllPoints(); for (const [x, r, g, b, m, s] of tfBase.c) cf.addRGBPointLong(X(x), r, g, b, m, s);
  motore.getViewport(VP.vr).render();
  return tfStato;
}
export const statoContrasto3d = () => ({ ...tfStato });
// ---- punto centrale delle linee di riferimento: si trascina e sposta tutte e due le linee
const CENTRI = [];
function centroLinee() { try { return ToolGroupManager.getToolGroup(ID_GRUPPO_MPR)?.getToolInstance(CrosshairsTool.toolName)?.toolCenter || null; } catch { return null; } }
function aggiornaCentri() {
  const c = centroLinee();
  for (const { id, dot } of CENTRI) {
    const vp = motore?.getViewport(id); if (!vp || !c) { dot.hidden = true; continue; }
    const s = vp.worldToCanvas(c); if (!s?.every(Number.isFinite)) { dot.hidden = true; continue; }
    dot.hidden = false; dot.style.left = s[0] + 'px'; dot.style.top = s[1] + 'px';
  }
}
function creaCentri() {
  for (const id of [VP.assiale, VP.coronale, VP.sagittale]) {
    const vp = motore.getViewport(id), el = vp.element, dot = document.createElement('div');
    dot.className = 'mpr-centro'; dot.title = 'Trascina: sposta insieme le due linee (il centro delle ricostruzioni)';
    el.appendChild(dot);
    let att = false, raf = 0, ultimo = null;
    dot.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); att = true; dot.setPointerCapture(e.pointerId); });
    dot.addEventListener('pointermove', (e) => {
      if (!att) return; e.stopPropagation(); const r = el.getBoundingClientRect(); ultimo = [e.clientX - r.left, e.clientY - r.top];
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; const w = motore?.getViewport(id)?.canvasToWorld(ultimo); if (w?.every(Number.isFinite)) vaiAlPunto([...w]); aggiornaCentri(); });
    });
    const fine = (e) => { if (!att) return; att = false; e.stopPropagation(); try { dot.releasePointerCapture(e.pointerId); } catch {} };
    dot.addEventListener('pointerup', fine); dot.addEventListener('pointercancel', fine);
    for (const ev of ['mousedown', 'mouseup', 'click']) dot.addEventListener(ev, (e) => e.stopPropagation());   // il doppio clic passa: scambia le viste
    el.addEventListener(Enums.Events.IMAGE_RENDERED, aggiornaCentri);
    CENTRI.push({ id, dot, el });
  }
  aggiornaCentri();
}

function dimezzaVR(d) {
  const [W, H, N] = VOL.dim, W2 = W >> 1, H2 = H >> 1, out = new Int16Array(W2 * H2 * N);
  for (let k = 0; k < N; k++) { const o = k * W * H, o2 = k * W2 * H2;
    for (let j = 0; j < H2; j++) { const r = o + 2 * j * W; for (let i = 0; i < W2; i++) { const q = r + 2 * i; out[o2 + j * W2 + i] = (d[q] + d[q + 1] + d[q + W] + d[q + W + 1]) >> 2; } } }
  const [a, b] = VOL.assi, sp = VOL.sp, origine = [0, 1, 2].map((c) => VOL.origine[c] + 0.5 * sp[0] * a[c] + 0.5 * sp[1] * b[c]);
  return { dati: out, dim: [W2, H2, N], sp: [sp[0] * 2, sp[1] * 2, sp[2]], origine };
}

// ---- segmentazioni automatiche (polmoni, fegato) su una griglia ridotta di metà nel piano
let idSeg = null, segInfo = null;
const COLORI_SEG = { polmoni: [0.25, 0.6, 1], fegato: [0.85, 0.45, 0.2], vasi: [0.95, 0.15, 0.15], aorta: [1, 0.25, 0.3], reni: [0.6, 0.3, 0.9], vescica: [1, 0.85, 0.2], intestino: [0.3, 0.85, 0.4], encefalo: [0.95, 0.6, 0.75] };
function ridotta() {
  // media 2×2 nel piano e, con fette sottili (< 1,5 mm), anche delle fette vicine: il rumore delle
  // acquisizioni sottili spezzerebbe le crescite di regione
  const f = 2, [W0, H0, N] = VOL.dim, W = Math.ceil(W0 / f), H = Math.ceil(H0 / f), r = new Int16Array(W * H * N), d = VOL.dati;
  const vz = VOL.sp[2] < 1.5 ? 1 : 0, rmax = new Int16Array(W * H * N);   // rmax: massimo 2×2 dello strato (la corticale sottile resta densa)
  for (let k = 0; k < N; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let t = 0, c = 0, mx = -32768;
    for (let kk = Math.max(0, k - vz); kk <= Math.min(N - 1, k + vz); kk++) for (let jj = j * f; jj < Math.min(H0, j * f + f); jj++) for (let ii = i * f; ii < Math.min(W0, i * f + f); ii++) { const v = d[IDX(ii, jj, kk)]; t += v; c++; if (kk === k && v > mx) mx = v; }
    r[(k * H + j) * W + i] = Math.round(t / c); rmax[(k * H + j) * W + i] = mx;
  }
  return { r, rmax, W, H, N, f, sp: [VOL.sp[0] * f, VOL.sp[1] * f, VOL.sp[2]] };
}
function componenti3d(maschera, W, H, N) {
  const lab = new Int32Array(W * H * N), dim = [], coda = new Int32Array(W * H * N);
  for (let p = 0; p < maschera.length; p++) {
    if (!maschera[p] || lab[p]) continue;
    const L = dim.length + 1; let qi = 0, qn = 0, a = 0, sx = 0, sz = 0; coda[qn++] = p; lab[p] = L;
    while (qi < qn) { const q = coda[qi++], i = q % W, j = ((q / W) | 0) % H, k = (q / (W * H)) | 0; a++; sx += i; sz += k;
      for (const [r, ok] of [[q - 1, i > 0], [q + 1, i < W - 1], [q - W, j > 0], [q + W, j < H - 1], [q - W * H, k > 0], [q + W * H, k < N - 1]])
        if (ok && maschera[r] && !lab[r]) { lab[r] = L; coda[qn++] = r; } }
    dim.push({ L, n: a, cx: sx / a, cz: sz / a });
  }
  return { lab, comp: dim };
}
function polmoni(R, corpo) {
  const { r, W, H, N } = R, n = W * H * N, aria = new Uint8Array(n);
  for (let p = 0; p < n; p++) aria[p] = r[p] < -400 && corpo[p] ? 1 : 0;
  const { lab, comp } = componenti3d(aria, W, H, N);
  // il polmone ha densità media circa −850 HU (parenchima con vasi); il gas intestinale è quasi −1000:
  // si tengono le componenti grandi con densità media da polmone
  // criterio più robusto: nel gas intestinale molti voxel sono aria pura (< −970 HU), nel polmone quasi nessuno
  const puri = new Float64Array(comp.length + 1);
  for (let p = 0; p < n; p++) if (lab[p] && r[p] < -970) puri[lab[p]]++;
  const vv = R.sp[0] * R.sp[1] * R.sp[2];
  const polm = comp.filter((c) => c.n * vv > 30e3 && puri[c.L] / c.n < 0.06).sort((a, b) => b.n - a.n);
  const scelte = polm.filter((c) => c.n >= (polm[0]?.n || 0) * 0.15).slice(0, 3).map((c) => c.L);
  const m = new Uint8Array(n); for (let p = 0; p < n; p++) if (scelte.includes(lab[p])) m[p] = 1;
  return m;
}
const aMondo = (R, i, j, k) => [0, 1, 2].map((q) => VOL.origine[q] + VOL.assi[0][q] * i * R.sp[0] + VOL.assi[1][q] * j * R.sp[1] + VOL.assi[2][q] * k * R.sp[2]);
function daMondo(R, w) { const d = [0, 1, 2].map((q) => w[q] - VOL.origine[q]); return [0, 1, 2].map((a) => Math.round(punto(d, VOL.assi[a]) / R.sp[a])); }
function erodi(m, W, H, N, volte) {
  let a = m;
  for (let t = 0; t < volte; t++) { const b = new Uint8Array(a.length);
    for (let p = 0; p < a.length; p++) { if (!a[p]) continue; const i = p % W, j = ((p / W) | 0) % H;
      b[p] = i > 0 && i < W - 1 && j > 0 && j < H - 1 && a[p - 1] && a[p + 1] && a[p - W] && a[p + W] ? 1 : 0; }
    a = b; }
  return a;
}
function dilataIn(m, cand, W, H, N, volte) {
  let a = m;
  for (let t = 0; t < volte; t++) { const b = a.slice();
    for (let p = 0; p < a.length; p++) { if (!a[p]) continue; const i = p % W, j = ((p / W) | 0) % H;
      for (const [q, ok] of [[p - 1, i > 0], [p + 1, i < W - 1], [p - W, j > 0], [p + W, j < H - 1]]) if (ok && cand[q]) b[q] = 1; }
    a = b; }
  return a;
}
function riempiBuchi(m, W, H, N) {           // per strato: i vasi dentro il fegato
  const coda = new Int32Array(W * H);
  for (let k = 0; k < N; k++) { const o = k * W * H, fuori = new Uint8Array(W * H); let qn = 0, qi = 0;
    const metti = (q) => { if (!fuori[q] && !m[o + q]) { fuori[q] = 1; coda[qn++] = q; } };
    for (let x = 0; x < W; x++) { metti(x); metti((H - 1) * W + x); } for (let y = 0; y < H; y++) { metti(y * W); metti(y * W + W - 1); }
    while (qi < qn) { const q = coda[qi++], x = q % W, y = (q / W) | 0; if (x > 0) metti(q - 1); if (x < W - 1) metti(q + 1); if (y > 0) metti(q - W); if (y < H - 1) metti(q + W); }
    for (let q = 0; q < W * H; q++) if (!fuori[q]) m[o + q] = 1; }
  return m;
}
function liscia(r0, W, H, N) {      // media 3×3 nel piano: toglie il rumore delle fasi tardive e delle fette spesse
  const o = new Int16Array(r0.length);
  for (let k = 0; k < N; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let t = 0, c = 0; for (let jj = Math.max(0, j - 1); jj <= Math.min(H - 1, j + 1); jj++) for (let ii = Math.max(0, i - 1); ii <= Math.min(W - 1, i + 1); ii++) { t += r0[(k * H + jj) * W + ii]; c++; }
    o[(k * H + j) * W + i] = Math.round(t / c); }
  return o;
}
function riempiBuchi3(m, W, H, N) {   // buchi chiusi anche nei piani coronale e sagittale (vasi, strati mancanti)
  for (const [A, B, idx] of [[W, N, (a, b, c) => (b * H + c) * W + a], [H, N, (a, b, c) => (b * H + a) * W + c]]) {
    const C = A === W ? H : W, fuori = new Uint8Array(A * B), coda = new Int32Array(A * B);
    for (let c = 0; c < C; c++) { fuori.fill(0); let qi = 0, qn = 0;
      const metti = (a, b) => { const q = b * A + a; if (!fuori[q] && !m[idx(a, b, c)]) { fuori[q] = 1; coda[qn++] = q; } };
      for (let a = 0; a < A; a++) { metti(a, 0); metti(a, B - 1); } for (let b = 0; b < B; b++) { metti(0, b); metti(A - 1, b); }
      while (qi < qn) { const q = coda[qi++], a = q % A, b = (q / A) | 0; if (a > 0) metti(a - 1, b); if (a < A - 1) metti(a + 1, b); if (b > 0) metti(a, b - 1); if (b < B - 1) metti(a, b + 1); }
      for (let b = 0; b < B; b++) for (let a = 0; a < A; a++) if (!fuori[b * A + a]) m[idx(a, b, c)] = 1; }
  }
  return m;
}
function fegato(R, corpo, pol, seme) {
  const { W, H, N } = R, n = W * H * N, WH = W * H, r = liscia(R.r, W, H, N);
  // asse superiore-inferiore: la componente z (LPS: +z verso la testa) della normale agli strati
  const su = VOL.assi[2][2] >= 0 ? 1 : -1;
  if (!seme) {
    // base del polmone destro (x del paziente più bassa = destra in LPS), poi 3 cm più in basso
    let cx = 0, cn = 0; for (let p = 0; p < n; p += 7) if (corpo[p]) { cx += aMondo(R, p % W, ((p / W) | 0) % H, 0)[0]; cn++; }
    const xMedio = cn ? cx / cn : 0;
    let kBase = null;
    for (let k = 0; k < N; k++) { let c = 0; for (let q = 0; q < WH; q += 2) if (pol[k * WH + q] && aMondo(R, q % W, (q / W) | 0, k)[0] < xMedio) c++;
      if (c > 20) { if (kBase == null || (su > 0 ? k < kBase : k > kBase)) kBase = k; } }
    if (kBase == null) return { errore: 'polmone destro non trovato: metti il mirino nel fegato e usa «Fegato dal mirino»' };
    const k = Math.max(0, Math.min(N - 1, kBase - su * Math.round(30 / R.sp[2])));
    // nello strato: pixel di tessuto (−20..250 HU) nella metà destra, eroso, il più grande
    const cand = new Uint8Array(WH);
    for (let q = 0; q < WH; q++) { const v = r[k * WH + q]; cand[q] = corpo[k * WH + q] && v > -20 && v < 250 && aMondo(R, q % W, (q / W) | 0, k)[0] < xMedio ? 1 : 0; }
    const e = erodi(cand, W, H, 1, 4); let best = -1, bestN = 0;
    const lab = new Int32Array(WH), coda = new Int32Array(WH); let L = 0;
    for (let q = 0; q < WH; q++) { if (!e[q] || lab[q]) continue; L++; let qi = 0, qn = 0; coda[qn++] = q; lab[q] = L;
      while (qi < qn) { const a = coda[qi++], x = a % W, y = (a / W) | 0; for (const [b, ok] of [[a - 1, x > 0], [a + 1, x < W - 1], [a - W, y > 0], [a + W, y < H - 1]]) if (ok && e[b] && !lab[b]) { lab[b] = L; coda[qn++] = b; } }
      if (qn > bestN) { bestN = qn; best = q; } }
    if (best < 0) return { errore: 'fegato non trovato: metti il mirino nel fegato e usa «Fegato dal mirino»' };
    // il primo pixel trovato sta sul bordo (spesso nel lobo sinistro sottile): si erode la componente
    // finché resta qualcosa e si prende il punto più interno
    let comp = new Uint8Array(WH); const Lb = lab[best]; for (let q = 0; q < WH; q++) if (lab[q] === Lb) comp[q] = 1;
    for (let t = 0; t < 60; t++) { const c2 = erodi(comp, W, H, 1, 1); let qq = -1; for (let q = 0; q < WH; q++) if (c2[q]) { qq = q; break; } if (qq < 0) break; comp = c2; best = qq; }
    { let sx = 0, sy = 0, c = 0; for (let q = 0; q < WH; q++) if (comp[q]) { sx += q % W; sy += (q / W) | 0; c++; }
      if (c) { const cx0 = Math.round(sx / c), cy0 = Math.round(sy / c); if (comp[cy0 * W + cx0]) best = cy0 * W + cx0; } }
    seme = [best % W, (best / W) | 0, k];
  } else seme = daMondo(R, seme);
  const [si, sj, sk] = seme;
  if (si < 0 || sj < 0 || sk < 0 || si >= W || sj >= H || sk >= N) return { errore: 'il punto di partenza è fuori dal volume' };
  // intervallo di densità dal dintorno del seme
  const v = []; for (let k = sk - 1; k <= sk + 1; k++) for (let j = sj - 5; j <= sj + 5; j++) for (let i = si - 5; i <= si + 5; i++) if (k >= 0 && k < N && j >= 0 && j < H && i >= 0 && i < W) v.push(r[(k * H + j) * W + i]);
  v.sort((a, b) => a - b); const m = v[v.length >> 1], ds = Math.max(8, (v[Math.floor(v.length * 0.84)] - v[Math.floor(v.length * 0.16)]) / 2);
  const semi_ampiezza = Math.min(30, Math.max(22, 2 * ds)), lo = m - semi_ampiezza, hi = m + semi_ampiezza;   // dati lisciati: ds è già ridotto
  // il fegato sta a destra e supera la linea mediana di pochi centimetri (lobo sinistro)
  let cx = 0, cn = 0; for (let p = 0; p < n; p += 7) if (corpo[p]) { cx += aMondo(R, p % W, ((p / W) | 0) % H, 0)[0]; cn++; }
  const xMax = (cn ? cx / cn : 0) + 90;
  const xDi = new Float32Array(W); for (let i = 0; i < W; i++) xDi[i] = aMondo(R, i, 0, 0)[0];   // assiale: x dipende quasi solo dalla colonna
  const candStrato = (k) => { const c = new Uint8Array(WH), o = k * WH;
    for (let q = 0; q < WH; q++) { const val = r[o + q]; c[q] = corpo[o + q] && !pol[o + q] && val >= lo && val <= hi && xDi[q % W] <= xMax ? 1 : 0; } return c; };
  const cresci2d = (er, semi) => { const out = new Uint8Array(WH), coda = new Int32Array(WH); let qi = 0, qn = 0;
    for (const q of semi) if (er[q] && !out[q]) { out[q] = 1; coda[qn++] = q; }
    while (qi < qn) { const q = coda[qi++], x = q % W, y = (q / W) | 0;
      for (const [b, ok] of [[q - 1, x > 0], [q + 1, x < W - 1], [q - W, y > 0], [q + W, y < H - 1]]) if (ok && er[b] && !out[b]) { out[b] = 1; coda[qn++] = b; } }
    return { out, area: qn }; };
  const fin = new Uint8Array(n);
  // strato del seme
  const er0 = erodi(candStrato(sk), W, H, 1, 3);
  let q0 = sj * W + si;
  if (!er0[q0]) { let d = 1e9, mig = -1; for (let j = Math.max(0, sj - 15); j < Math.min(H, sj + 15); j++) for (let i = Math.max(0, si - 15); i < Math.min(W, si + 15); i++) { const q = j * W + i; if (er0[q]) { const dd = (i - si) ** 2 + (j - sj) ** 2; if (dd < d) { d = dd; mig = q; } } }
    if (mig < 0) return { errore: 'il punto di partenza non è nel fegato' }; q0 = mig; }
  const base = cresci2d(er0, [q0]);
  const scrivi = (k, mm, cand) => { const d3 = riempiBuchi(dilataIn(mm, cand, W, H, 1, 3), W, H, 1); fin.set(d3, k * WH); };
  scrivi(sk, base.out, candStrato(sk));
  // propagazione strato per strato: i semi sono il fegato dello strato vicino; se l'area salta, si
  // tiene solo la parte vicina allo strato precedente (sconfinamento nei visceri vicini)
  for (const dir of [-1, 1]) {
    let prec = base.out, area = base.area;
    for (let k = sk + dir; k >= 0 && k < N; k += dir) {
      const cand = candStrato(k), er = erodi(cand, W, H, 1, 3);
      const semi = []; for (let q = 0; q < WH; q++) if (prec[q] && er[q]) semi.push(q);
      if (semi.length < 4) break;
      let { out, area: a } = cresci2d(er, semi);
      if (a > area * 1.35 + 30) { const vicino = dilataIn(prec, new Uint8Array(WH).fill(1), W, H, 1, 4); for (let q = 0; q < WH; q++) if (!vicino[q]) out[q] = 0; a = out.reduce((s, x) => s + x, 0); }
      if (a < 12) break;
      scrivi(k, out, cand); prec = out; area = a;
    }
  }
  // ponti sottili verso i visceri vicini (duodeno, pancreas, parete): erosione, componente 3D più
  // grande, poi ricostruzione dentro la maschera di partenza
  const er3 = erodi(fin, W, H, N, 2), { lab: lb3, comp: cp3 } = componenti3d(er3, W, H, N);
  if (cp3.length) {
    const Lmax = cp3.reduce((a, c) => (c.n > a.n ? c : a)).L;
    let tieni = new Uint8Array(n); for (let p = 0; p < n; p++) if (lb3[p] === Lmax) tieni[p] = 1;
    tieni = dilataIn(tieni, fin, W, H, N, 3); fin.set(tieni);
  }
  riempiBuchi3(fin, W, H, N);
  return { maschera: fin, intervallo: [Math.round(lo), Math.round(hi)] };
}

// ---- altri organi con regole classiche (TC): aorta, reni, vescica, gas intestinale, encefalo
// x del paziente (LPS: destra = x minore) di ogni colonna e linea mediana del corpo
function lineaMediana(R, corpo) {
  let cx = 0, cn = 0; for (let p = 0; p < corpo.length; p += 7) if (corpo[p]) { cx += aMondo(R, p % R.W, ((p / R.W) | 0) % R.H, 0)[0]; cn++; }
  return cn ? cx / cn : 0;
}
function comp2d(m, W, H, q0, lab, coda) {        // componente 2D (4-connessa) che contiene q0
  let qi = 0, qn = 0; coda[qn++] = q0; lab[q0] = 1;
  while (qi < qn) { const q = coda[qi++], x = q % W, y = (q / W) | 0;
    for (const [b, ok] of [[q - 1, x > 0], [q + 1, x < W - 1], [q - W, y > 0], [q + W, y < H - 1]]) if (ok && m[b] && !lab[b]) { lab[b] = 1; coda[qn++] = b; } }
  return qn;
}
// diametro massimo di un vaso (maschera sulla griglia ridotta): per ogni strato e componente, asse corto
// dell'ellisse equivalente (4·σ minore); solo sezioni quasi circolari (asse lungo / corto < 1,6)
function diametroMassimo(fin, R) {
  const { W, H, N } = R, WH = W * H;
  let dmax = 0, kmax = -1;
  { const lb = new Uint8Array(WH), cc = new Int32Array(WH), sx = R.sp[0], sy = R.sp[1];
    for (let k = 2; k < N - 2; k++) { lb.fill(0); const o = k * WH;   // primi e ultimi strati esclusi: il vaso tagliato dal bordo del volume
      for (let q = 0; q < WH; q++) { if (!fin[o + q] || lb[q]) continue;
        let qi = 0, qn = 0; cc[qn++] = q; lb[q] = 1;
        while (qi < qn) { const a = cc[qi++], x = a % W, y = (a / W) | 0; for (const [b2, ok] of [[a - 1, x > 0], [a + 1, x < W - 1], [a - W, y > 0], [a + W, y < H - 1]]) if (ok && fin[o + b2] && !lb[b2]) { lb[b2] = 1; cc[qn++] = b2; } }
        if (qn * sx * sy < 80) continue;
        let mx = 0, my = 0; for (let t = 0; t < qn; t++) { mx += (cc[t] % W) * sx; my += ((cc[t] / W) | 0) * sy; } mx /= qn; my /= qn;
        let xx = 0, yy = 0, xy = 0; for (let t = 0; t < qn; t++) { const dx = (cc[t] % W) * sx - mx, dy = ((cc[t] / W) | 0) * sy - my; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
        xx /= qn; yy /= qn; xy /= qn; const tr = (xx + yy) / 2, dd = Math.sqrt(Math.max(0, tr * tr - (xx * yy - xy * xy)));
        const dMin = 4 * Math.sqrt(Math.max(0, tr - dd)) + sx, dMag = 4 * Math.sqrt(tr + dd) + sx;
        if (dMag / dMin < 1.6 && dMin > dmax) { dmax = dMin; kmax = k; } } } }
  return { dmax, kmax };
}
// aorta: oggetto rotondo e omogeneo con mdc davanti alla colonna, seguito strato per strato
function aorta(R, corpo) {
  const { r, W, H, N } = R, WH = W * H, a2 = R.sp[0] * R.sp[1], xm = lineaMediana(R, corpo);
  // densità del sangue: prima quella dei vasi più densi (arteriosa, venosa); in fase tardiva l'aorta
  // (100-150 HU) è meno densa dei reni e delle vie urinarie opacizzate: si riprova con soglie più basse
  const dvs = [densitaVasi(R, corpo), densitaVasiA(R, corpo, 100), densitaVasiA(R, corpo, 80)].filter((d, i, a) => d && a.findIndex((x) => x && Math.abs(x - d) < 8) === i);
  if (!dvs.length) return { errore: 'aorta con mdc non trovata (serve una TC con mdc)' };
  const m = new Uint8Array(WH), lab = new Uint8Array(WH), coda = new Int32Array(WH);
  let dv = 0, lo = 0, hi = 0, seme = null;
  const cand = (k) => { const o = k * WH; for (let q = 0; q < WH; q++) m[q] = corpo[o + q] && r[o + q] >= lo && r[o + q] <= hi ? 1 : 0; };
  for (const d of dvs) {
  dv = d; lo = dv * 0.65; hi = dv * 1.6 + 100;
  // seme: negli strati centrali, la componente rotonda più grande vicino alla linea mediana (± 5 cm)
  for (let k = Math.floor(N * 0.3); k < N * 0.7; k += Math.max(1, Math.floor(N / 30))) {
    cand(k); lab.fill(0);
    for (let q = 0; q < WH; q++) {
      if (!m[q] || lab[q]) continue;
      const n = comp2d(m, W, H, q, lab, coda); let x0 = W, x1 = 0, y0 = H, y1 = 0, sx = 0, s1 = 0, s2 = 0, densi = 0;
      for (let t = 0; t < n; t++) { const b = coda[t], x = b % W, y = (b / W) | 0, v = r[k * WH + b]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; sx += x; s1 += v; s2 += v * v; if (R.rmax[k * WH + b] >= 450) densi++; }
      const area = n * a2, bw = x1 - x0 + 1, bh = y1 - y0 + 1, riemp = n / (Math.PI / 4 * bw * bh), cx = aMondo(R, sx / n, 0, k)[0];
      const media = s1 / n, cv = Math.sqrt(Math.max(0, s2 / n - media * media)) / media;
      if (area < 150 || area > 1500 || riemp < 0.7 || bw / bh < 0.65 || bw / bh > 1.5 || Math.abs(cx - xm) > 35) continue;
      // il sangue: densità vicina a quella dei vasi, omogeneo, senza corticale (la vertebra è rotonda ma ha l'osso)
      if (media < dv * 0.75 || media > dv * 1.3 || cv > 0.2 || densi / n > 0.03) continue;
      // la vertebra (spongiosa opacizzata quanto il sangue) ha intorno la corticale: si guarda un anello
      // di 3 pixel attorno alla componente; l'aorta è circondata da grasso e tessuti molli
      { let anello = 0, osso2 = 0; const vis = new Uint8Array(WH); for (let t = 0; t < n; t++) vis[coda[t]] = 1;
        for (let t = 0; t < n; t++) { const b = coda[t], x = b % W, y = (b / W) | 0;
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const c = yy * W + xx; if (vis[c]) continue; vis[c] = 1; anello++; if (R.rmax[k * WH + c] >= 400) osso2++; } }
        if (osso2 / Math.max(1, anello) > 0.08) continue; }
      // la spongiosa dell'osso porotico è meno omogenea del sangue (cv del sangue in aorta ≈ 0,07-0,12)
      if (cv > 0.14) continue;
      // si preferisce l'aorta discendente: la più posteriore (davanti alla colonna), poi la più grande
      let sy = 0; for (let t = 0; t < n; t++) sy += (coda[t] / W) | 0;
      const post = aMondo(R, sx / n, sy / n, k)[1];
      if (!seme || post > seme.post + 15 || (Math.abs(post - seme.post) <= 15 && area > seme.area)) seme = { k, q: coda[Math.floor(n / 2)], area, post, media };
    }
  }
  if (seme) break;
  }
  // fase tardiva: l'intervallo di densità si ricentra sul sangue del seme (l'aorta a 110-140 HU)
  if (seme && dv !== dvs[0] && seme.media < dv * 0.9) { dv = seme.media; lo = dv * 0.65; hi = dv * 1.6 + 100; }
  if (!seme) return { errore: 'aorta non trovata: è un\'angio-TC o una TC con mdc?' };
  // inseguimento strato per strato di TUTTE le componenti collegate (ascendente, arco, discendente,
  // addominale). Una componente si accetta se tocca il vaso dello strato vicino e il suo spessore
  // (raggio massimo, dalla distanza dal bordo) è simile: il cuore è molto più spesso, i rami
  // (tronchi sovraortici, iliache, renali) molto più sottili. Si ripete in su e in giù finché cambia.
  const su = VOL.assi[2][2] >= 0 ? 1 : -1, bud = new Float32Array(r.length), osso = Math.max(450, dv * 1.4 + 60), fin = new Uint8Array(r.length), spes = new Float32Array(r.length);
  const dist = new Float32Array(WH), lab2 = new Int32Array(WH);
  const candE = (k) => { const o = k * WH; for (let q = 0; q < WH; q++) m[q] = corpo[o + q] && r[o + q] >= lo && r[o + q] <= hi && R.rmax[o + q] < osso ? 1 : 0;
    const e = erodi(m, W, H, 1, 1); return e; };
  const distanza = (mm) => {       // distanza dal bordo (chamfer 3-4) in pixel
    for (let q = 0; q < WH; q++) dist[q] = mm[q] ? 1e9 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = y * W + x; if (!dist[q]) continue; let d = dist[q];
      if (x > 0) d = Math.min(d, dist[q - 1] + 1); if (y > 0) d = Math.min(d, dist[q - W] + 1); if (x > 0 && y > 0) d = Math.min(d, dist[q - W - 1] + 1.4); if (x < W - 1 && y > 0) d = Math.min(d, dist[q - W + 1] + 1.4); dist[q] = x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 1 : d; }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const q = y * W + x; if (!dist[q]) continue; let d = dist[q];
      if (x < W - 1) d = Math.min(d, dist[q + 1] + 1); if (y < H - 1) d = Math.min(d, dist[q + W] + 1); if (x < W - 1 && y < H - 1) d = Math.min(d, dist[q + W + 1] + 1.4); if (x > 0 && y < H - 1) d = Math.min(d, dist[q + W - 1] + 1.4); dist[q] = d; } };
  // strato del seme
  let Tseme = 0;
  { const e = candE(seme.k); lab.fill(0); let q0 = seme.q; if (!e[q0]) { for (let q = 0; q < WH; q++) if (e[q] && (q % W - q0 % W) ** 2 + ((q / W | 0) - (q0 / W | 0)) ** 2 < 25) { q0 = q; break; } }
    if (!e[q0]) return { errore: 'aorta non trovata' };
    const n = comp2d(e, W, H, q0, lab, coda); const mm = new Uint8Array(WH); for (let t = 0; t < n; t++) mm[coda[t]] = 1; distanza(mm);
    let T = 0; for (let t = 0; t < n; t++) T = Math.max(T, dist[coda[t]]);
    for (let t = 0; t < n; t++) { fin[seme.k * WH + coda[t]] = 1; spes[seme.k * WH + coda[t]] = T; } Tseme = T; }
  const passo = (k, dir) => {          // aggiunge allo strato k le componenti collegate allo strato k - dir
    const kp = k - dir; if (kp < 0 || kp >= N) return 0;
    const e = candE(k); lab2.fill(0); let nuovi = 0;
    for (let q = 0; q < WH; q++) {
      if (!e[q] || lab2[q]) continue;
      lab.fill(0); const n = comp2d(e, W, H, q, lab, coda);
      let Tp = 0, gia = 0, ap = 0; for (let t = 0; t < n; t++) { const b = coda[t]; lab2[b] = 1; if (fin[kp * WH + b]) { Tp = Math.max(Tp, spes[kp * WH + b]); } if (fin[k * WH + b]) gia++; }
      // area dello strato vicino nelle componenti toccate (per il limite verso il basso: radice aortica → cuore)
      if (Tp) { const vis = new Uint8Array(WH), cc = new Int32Array(WH); for (let t = 0; t < n; t++) { const b = coda[t]; if (fin[kp * WH + b] && !vis[b]) { let qi = 0, qn = 0; cc[qn++] = b; vis[b] = 1;
        while (qi < qn) { const a = cc[qi++], x = a % W, y = (a / W) | 0; ap++; for (const [c2, ok] of [[a - 1, x > 0], [a + 1, x < W - 1], [a - W, y > 0], [a + W, y < H - 1]]) if (ok && !vis[c2] && fin[kp * WH + c2]) { vis[c2] = 1; cc[qn++] = c2; } } } } }
      if (!Tp || gia === n) continue;
      const mm = new Uint8Array(WH); for (let t = 0; t < n; t++) mm[coda[t]] = 1; distanza(mm);
      let T = 0; for (let t = 0; t < n; t++) T = Math.max(T, dist[coda[t]]);
      // il cuore cresce poco per volta da uno strato all'altro: serve anche il limite assoluto rispetto al seme
      if (T < Tp * 0.6 - 0.5 || T < 2) continue;
      if (T > Tp * 1.35 + 1.5 || T > Tseme * 1.45 + 1) {
        // il vaso si fonde con una struttura vicina (vena cava, pilastri, cuore): si tiene solo la parte
        // che sta dentro il vaso dello strato vicino allargato di un pixel, se resta abbastanza grande
        const vic = dilataIn(fin.subarray(kp * WH, kp * WH + WH), mm, W, H, 1, 1); let c = 0;
        for (let t = 0; t < n; t++) if (vic[coda[t]]) c++;
        if (c < ap * 0.7) continue;
        for (let t = 0; t < n; t++) { const b = coda[t]; if (vic[b] && !fin[k * WH + b]) { fin[k * WH + b] = 1; spes[k * WH + b] = Tp; nuovi++; } }
        continue;
      }
      // verso i piedi l'area non può crescere molto (dall'aorta ascendente al ventricolo sinistro);
      // verso la testa sì (la discendente che diventa arco)
      let normali = 0; for (let t = 0; t < n; t++) { const b = coda[t]; if (fin[kp * WH + b] && !bud[kp * WH + b]) normali++; }
      if ((dir !== su && n > ap * 1.6 + 30) || !normali) {
        // l'aorta ascendente che tocca l'arteria polmonare o il cuore: si tiene solo la parte sotto il
        // vaso dello strato vicino (con un pixel di margine), per al massimo 2 cm
        let bp = 0; for (let t = 0; t < n; t++) { const b = coda[t]; if (fin[kp * WH + b]) bp = Math.max(bp, bud[kp * WH + b]); }
        if (bp + R.sp[2] > 20) continue;
        const vic = dilataIn(fin.subarray(kp * WH, kp * WH + WH), mm, W, H, 1, 1); let c = 0;
        for (let t = 0; t < n; t++) { const b = coda[t]; if (vic[b] && !fin[k * WH + b]) { fin[k * WH + b] = 1; spes[k * WH + b] = Tp; bud[k * WH + b] = bp + R.sp[2]; c++; } }
        nuovi += c; continue;
      }
      for (let t = 0; t < n; t++) { const b = coda[t]; if (!fin[k * WH + b]) { fin[k * WH + b] = 1; spes[k * WH + b] = T; nuovi++; } }
    }
    return nuovi;
  };
  for (let giro = 0; giro < 4; giro++) {
    let c = 0;
    for (let k = 1; k < N; k++) c += passo(k, 1);
    for (let k = N - 2; k >= 0; k--) c += passo(k, -1);
    if (!c) break;
  }
  // il bordo tolto dall'erosione torna (un pixel, dentro l'intervallo di densità)
  for (let k = 0; k < N; k++) { const o = k * WH; let any = 0; for (let q = 0; q < WH; q++) if (fin[o + q]) { any = 1; break; } if (!any) continue;
    for (let q = 0; q < WH; q++) m[q] = corpo[o + q] && r[o + q] >= lo && r[o + q] <= hi ? 1 : 0;
    fin.set(dilataIn(fin.subarray(o, o + WH), m, W, H, 1, 1), o); }
  // fase tardiva: arterie e vene hanno la stessa densità e la cava inferiore entra dalla vena renale
  // sinistra. Si segue il centro dell'aorta dal seme, strato per strato (cerchio poco più grande del
  // vaso), e si toglie quello che sta a destra dell'aorta alla stessa profondità; poi resta solo la
  // parte collegata al seme (la cava sotto le renali si stacca)
  if (dv !== dvs[0]) {
    const xDi = new Float32Array(W), yDi = new Float32Array(H);
    for (let i = 0; i < W; i++) xDi[i] = aMondo(R, i, 0, 0)[0]; for (let j = 0; j < H; j++) yDi[j] = aMondo(R, 0, j, 0)[1];
    const disco = (k, X, Y, rag) => { let n = 0, sx = 0, sy = 0; const o = k * WH;
      for (let q = 0; q < WH; q++) if (fin[o + q]) { const dx = xDi[q % W] - X, dy = yDi[(q / W) | 0] - Y; if (dx * dx + dy * dy <= rag * rag) { n++; sx += dx + X; sy += dy + Y; } }
      return n ? { X: sx / n, Y: sy / n, rag: Math.sqrt(n * a2 / Math.PI) } : null; };
    const c0 = disco(seme.k, xDi[seme.q % W], yDi[(seme.q / W) | 0], 20);
    if (c0) for (const dir of [-1, 1]) {
      let c = c0;
      for (let k = seme.k; k >= 0 && k < N; k += dir) {
        const nc = k === seme.k ? c0 : disco(k, c.X, c.Y, c.rag * 1.3 + 3);
        if (!nc || nc.rag < c0.rag * 0.6) break;              // biforcazione o fine del vaso
        c = nc; const o = k * WH;
        for (let q = 0; q < WH; q++) if (fin[o + q] && xDi[q % W] < c.X - c.rag - 4 && Math.abs(yDi[(q / W) | 0] - c.Y) < 25) fin[o + q] = 0;
      }
    }
    const { lab: l3, comp: c3 } = componenti3d(fin, W, H, N);
    let Ls = l3[seme.k * WH + seme.q]; if (!Ls && c0) for (let q = 0; q < WH && !Ls; q++) if (fin[seme.k * WH + q] && (xDi[q % W] - c0.X) ** 2 + (yDi[(q / W) | 0] - c0.Y) ** 2 <= c0.rag * c0.rag) Ls = l3[seme.k * WH + q];
    if (Ls && c3.length > 1) for (let p = 0; p < fin.length; p++) if (fin[p] && l3[p] !== Ls) fin[p] = 0;
  }
  const { dmax, kmax } = diametroMassimo(fin, R);
  const zmax = kmax >= 0 ? punto(aMondo(R, 0, 0, kmax), VOL.assi[2]) : null;
  return { maschera: fin, info: { ...(dmax ? { diametro: Math.round(dmax), posizione: zmax != null ? Math.round(zmax * 10) / 10 : null } : {}), densita: Math.round(dv) } };
}
// reni (TC con mdc): parenchima opacizzato ai lati della colonna, nella metà posteriore del corpo,
// separato dai vasi con un'erosione
function reni(R, corpo) {
  const { r, W, H, N } = R, n = W * H * N, vv = R.sp[0] * R.sp[1] * R.sp[2], xm = lineaMediana(R, corpo);
  const dorsoY = VOL.assi[1][1] >= 0 ? 1 : -1;
  // i reni stanno nella metà posteriore del corpo (il cuore, il fegato e la milza opacizzati più avanti)
  let cy = 0, cn = 0; for (let p = 0; p < n; p += 11) if (corpo[p]) { cy += ((p / W) | 0) % H; cn++; } cy = cn ? cy / cn : H / 2;
  const cand = new Uint8Array(n); for (let p = 0; p < n; p++) cand[p] = corpo[p] && r[p] >= 100 && r[p] <= 400 ? 1 : 0;
  // fase corticomidollare: la corticale è un anello, la midollare meno densa sta dentro: si riempie strato per strato
  const pieno = riempiBuchi(cand.slice(), W, H, N);
  const e = erodi(pieno, W, H, N, 2), { lab, comp } = componenti3d(e, W, H, N);
  const sx = new Float64Array(comp.length + 1), sy = new Float64Array(comp.length + 1), alti = new Float64Array(comp.length + 1);
  for (let p = 0; p < n; p++) { const L = lab[p]; if (!L) continue; sx[L] += aMondo(R, p % W, 0, 0)[0]; sy[L] += ((p / W) | 0) % H; if (R.rmax[p] >= 600) alti[L]++; }
  // densità media: il rene opacizzato è più denso della milza e del fegato; ed è più vicino alla colonna
  const med = new Float64Array(comp.length + 1); for (let p = 0; p < n; p++) if (lab[p]) med[lab[p]] += r[p];
  const punti = (c) => med[c.L] / c.n - 0.5 * Math.abs(sx[c.L] / c.n - xm);
  const scelti = comp.filter((c) => { const v = c.n * vv / 1000, x = sx[c.L] / c.n - xm, y = sy[c.L] / c.n;
    const posteriore = (y - cy) * dorsoY > 0;
    return v >= 30 && v <= 600 && Math.abs(x) >= 25 && Math.abs(x) <= 150 && posteriore && alti[c.L] / c.n < 0.02; });
  const dx = scelti.filter((c) => sx[c.L] / c.n < xm).sort((a, b) => punti(b) - punti(a))[0], sn = scelti.filter((c) => sx[c.L] / c.n >= xm).sort((a, b) => punti(b) - punti(a))[0];
  if (!dx && !sn) return { errore: 'reni non trovati: serve una TC con mdc (fase venosa o nefrografica)' };
  let m = new Uint8Array(n); for (let p = 0; p < n; p++) if ((dx && lab[p] === dx.L) || (sn && lab[p] === sn.L)) m[p] = 1;
  m = dilataIn(m, pieno, W, H, N, 2);
  let vdx = 0, vsn = 0; for (let p = 0; p < n; p++) if (m[p]) { if (aMondo(R, p % W, 0, 0)[0] < xm) vdx++; else vsn++; }
  return { maschera: m, info: { destro: vdx * vv / 1000, sinistro: vsn * vv / 1000 } };
}
// vescica: liquido (−5…35 HU) nella parte bassa del corpo, vicino alla linea mediana, compatta
function vescica(R, corpo) {
  const { r, W, H, N } = R, n = W * H * N, vv = R.sp[0] * R.sp[1] * R.sp[2], xm = lineaMediana(R, corpo), su = VOL.assi[2][2] >= 0 ? 1 : -1;
  const cand = new Uint8Array(n); for (let p = 0; p < n; p++) cand[p] = corpo[p] && r[p] >= -5 && r[p] <= 35 ? 1 : 0;
  const e = erodi(cand, W, H, N, 2), { lab, comp } = componenti3d(e, W, H, N), sx = new Float64Array(comp.length + 1);
  for (let p = 0; p < n; p++) if (lab[p]) sx[lab[p]] += aMondo(R, p % W, 0, 0)[0];
  // basso = fette verso i piedi (z minore in LPS)
  const basso = (c) => (su > 0 ? c.cz < N * 0.45 : c.cz > N * 0.55);
  const c = comp.filter((c) => c.n * vv / 1000 >= 15 && c.n * vv / 1000 <= 1500 && Math.abs(sx[c.L] / c.n - xm) < 40 && basso(c)).sort((a, b) => b.n - a.n)[0];
  if (!c) return { errore: 'vescica non trovata (serve la pelvi nel volume, vescica con urina non opacizzata)' };
  let m = new Uint8Array(n); for (let p = 0; p < n; p++) if (lab[p] === c.L) m[p] = 1;
  return { maschera: dilataIn(m, cand, W, H, N, 2) };
}
// intestino: gas nel corpo fuori dai polmoni (le anse piene di liquido non si distinguono senza modello)
function gasIntestinale(R, corpo, pol) {
  const { r, W, H, N } = R, n = W * H * N, vv = R.sp[0] * R.sp[1] * R.sp[2];
  const g = new Uint8Array(n); for (let p = 0; p < n; p++) g[p] = corpo[p] && !pol[p] && r[p] < -400 ? 1 : 0;
  const { lab, comp } = componenti3d(g, W, H, N), tieni = new Uint8Array(comp.length + 1);
  for (const c of comp) tieni[c.L] = c.n * vv >= 500 ? 1 : 0;
  const m = new Uint8Array(n); for (let p = 0; p < n; p++) if (tieni[lab[p]]) m[p] = 1;
  return { maschera: dilataIn(m, new Uint8Array(n).fill(1), W, H, N, 1) };
}
// encefalo: dentro la teca cranica (osso ≥ 300 HU, buchi riempiti strato per strato), tessuto 0…90 HU
function encefalo(R, corpo) {
  const { r, W, H, N } = R, n = W * H * N, vv = R.sp[0] * R.sp[1] * R.sp[2];
  let osso = new Uint8Array(n); for (let p = 0; p < n; p++) osso[p] = r[p] >= 300 ? 1 : 0;
  osso = dilataIn(osso, new Uint8Array(n).fill(1), W, H, N, 1);
  const dentro = riempiBuchi(osso.slice(), W, H, N);
  const c = new Uint8Array(n); for (let p = 0; p < n; p++) c[p] = dentro[p] && !osso[p] && r[p] >= 0 && r[p] <= 90 ? 1 : 0;
  const e = erodi(c, W, H, N, 1), { lab, comp } = componenti3d(e, W, H, N), best = comp.sort((a, b) => b.n - a.n)[0];
  if (!best || best.n * vv / 1000 < 200) return { errore: 'encefalo non trovato (serve una TC del cranio)' };
  let m = new Uint8Array(n); for (let p = 0; p < n; p++) if (lab[p] === best.L) m[p] = 1;
  return { maschera: dilataIn(m, c, W, H, N, 1) };
}
/** tipo: 'polmoni' | 'fegato' | null (toglie); seme: punto del mondo (centro del mirino) per il fegato */
export async function segmenta(tipo, { seme = null } = {}) {
  if (!motore || !VOL) return { ok: false };
  if (!tipo) {
    const eraVasi = !!segInfo?.vr; segInfo = null; await mettiSeg(null);
    if (eraVasi) { const vr = motore.getViewport(VP.vr), cam = vr.getCamera(), vecchio = idVR; idVR = null; await setVolumesForViewports(motore, volumiVR(), [VP.vr]); modo3d(); vr.setCamera(cam); vr.render(); try { if (vecchio) cache.removeVolumeLoadObject(vecchio); } catch {} }
    return { ok: true };
  }
  if (VOL.unita !== 'HU' && tipo !== 'vasi') return { ok: false, motivo: 'la segmentazione automatica funziona sulla TC' };
  const R = ridotta();
  const C = VOL.unita === 'HU' ? mascheraCorpo(2).dentro : new Uint8Array(R.r.length).fill(1);
  let m, info = {};
  if (tipo === 'vasi') {
    const v = vasi(R, C); m = v.m; vasiR = { m, R }; info = { soglia: v.soglia, componenti: v.componenti };
  } else if (['aorta', 'reni', 'vescica', 'intestino', 'encefalo'].includes(tipo)) {
    const r = tipo === 'aorta' ? aorta(R, C) : tipo === 'reni' ? reni(R, C) : tipo === 'vescica' ? vescica(R, C) : tipo === 'encefalo' ? encefalo(R, C) : gasIntestinale(R, C, polmoni(R, C));
    if (r.errore) return { ok: false, motivo: r.errore };
    m = r.maschera; info = r.info || {};
  } else if (tipo === 'polmoni') {
    const pol = polmoni(R, C);
    m = pol;
    // destro e sinistro rispetto alla linea mediana del corpo
    let cx = 0, cn = 0; for (let p = 0; p < C.length; p += 7) if (C[p]) { cx += aMondo(R, p % R.W, ((p / R.W) | 0) % R.H, 0)[0]; cn++; }
    const xm = cn ? cx / cn : 0; let dx = 0, sx = 0;
    for (let p = 0; p < m.length; p++) if (m[p]) { if (aMondo(R, p % R.W, ((p / R.W) | 0) % R.H, 0)[0] < xm) dx++; else sx++; }
    const vv = R.sp[0] * R.sp[1] * R.sp[2] / 1000;
    info = { destro: dx * vv, sinistro: sx * vv };
  } else {
    const r = fegato(R, C, polmoni(R, C), seme);
    if (r.errore) return { ok: false, motivo: r.errore };
    m = r.maschera; info = { intervallo: r.intervallo };
  }
  let nv = 0; for (let p = 0; p < m.length; p++) nv += m[p];
  const volume = nv * R.sp[0] * R.sp[1] * R.sp[2] / 1000;
  if (!nv) return { ok: false, motivo: { aorta: 'aorta non trovata', reni: 'reni non trovati', vescica: 'vescica non trovata', intestino: 'gas intestinale non trovato', encefalo: 'encefalo non trovato', polmoni: 'polmoni non trovati in questo volume', fegato: 'fegato non trovato', vasi: 'vasi con mdc non trovati: serve un\'angio-TC o un\'angio-RM' }[tipo] };
  const dati = new Int16Array(m.length); for (let p = 0; p < m.length; p++) dati[p] = m[p] ? 1000 : 0;
  await mettiSeg({ dati, geom: { dim: [R.W, R.H, R.N], sp: R.sp, origine: VOL.origine, assi: VOL.assi }, colore: COLORI_SEG[tipo] });
  if (tipo === 'fegato' && volume < 400) return { ok: false, motivo: `trovati solo ${Math.round(volume)} cm³: porta il mirino al centro del fegato (lontano dai vasi) e usa «Fegato dal centro del mirino»` };
  // organo tagliato dal campo di vista: maschera sul primo o sull'ultimo strato della serie
  const WH0 = R.W * R.H; let bordo = false;
  for (const k of [0, R.N - 1]) { let c = 0; for (let q = 0; q < WH0; q++) c += m[k * WH0 + q]; if (c * R.sp[0] * R.sp[1] > 300) bordo = true; }
  segInfo = { tipo, volume, ...info, sconfina: tipo === 'fegato' && volume > 3500, tagliato: bordo };
  // nel 3D resta solo la struttura estratta (vasi, organo, gas), con un preset adatto
  const PRESET_ORGANO = { vasi: null, aorta: 'solido', polmoni: 'solido', intestino: 'solido', fegato: 'solido', reni: 'solido', vescica: 'solido', encefalo: 'solido' };
  segInfo.vr = true; await vr3dVasi(m, R, PRESET_ORGANO[tipo]);
  return { ok: true, ...segInfo };
}
let nLutIA = 0;
// etichette IA riportate sulla griglia ridotta del volume aperto (vicino più prossimo)
function etichetteSuR(geo, lab, R) {
  const { W, H, N } = R, n = W * H * N, [LW, LH, LN] = geo.dim, out = new Uint8Array(n), A = geo.assi, o = geo.origine, sp = geo.sp;
  const proietta = (w) => [0, 1, 2].map((a) => ((w[0] - o[0]) * A[a][0] + (w[1] - o[1]) * A[a][1] + (w[2] - o[2]) * A[a][2]) / sp[a]);
  const p0 = proietta(aMondo(R, 0, 0, 0)), pi = proietta(aMondo(R, 1, 0, 0)).map((v, a) => v - p0[a]), pj = proietta(aMondo(R, 0, 1, 0)).map((v, a) => v - p0[a]), pk = proietta(aMondo(R, 0, 0, 1)).map((v, a) => v - p0[a]);
  for (let k = 0; k < N; k++) for (let j = 0; j < H; j++) {
    let x = p0[0] + pj[0] * j + pk[0] * k, y = p0[1] + pj[1] * j + pk[1] * k, z = p0[2] + pj[2] * j + pk[2] * k;
    for (let i = 0; i < W; i++, x += pi[0], y += pi[1], z += pi[2]) {
      const li = Math.round(x), lj = Math.round(y), lk = Math.round(z);
      if (li < 0 || lj < 0 || lk < 0 || li >= LW || lj >= LH || lk >= LN) continue;
      out[(k * H + j) * W + i] = lab[(lk * LH + lj) * LW + li];
    }
  }
  return out;
}
// Misure «opportunistiche» della TC (stime didattiche, da verificare):
// · densità di L1: spongiosa del soma (etichetta erosa di 2 voxel, mediana HU); ≤ 100 HU sospetta osteoporosi,
//   101-159 incerta, ≥ 160 normale (Pickhardt 2013);
// · muscoli a L3: area di psoas e paravertebrali nello strato centrale di L3 (il modello veloce non segmenta
//   i muscoli della parete addominale: niente SMI completo) e densità media (miosteatosi se bassa);
// · enfisema: percentuale di polmone sotto −950 HU, per lobo;
// · calcio coronarico (Agatston) solo senza mdc: calcificazioni ≥ 130 HU nel cuore (esclusa l'aorta),
//   area × peso del picco (1-4), normalizzata a strati di 3 mm.
function misureOpportunistiche(R, L, id) {
  const { W, H, N, r } = R, WH = W * H, n = WH * N, out = {}, a2 = R.sp[0] * R.sp[1];
  const voxel = (k) => { const v = []; if (!k) return v; for (let p = 0; p < n; p++) if (L[p] === k) v.push(p); return v; };
  const mediana = (a) => { if (!a.length) return null; const b = Float32Array.from(a).sort(); return b[b.length >> 1]; };
  // L1
  const kL1 = id.vertebrae_L1;
  if (kL1) { const m = new Uint8Array(n); for (let p = 0; p < n; p++) if (L[p] === kL1) m[p] = 1;
    const e = erodi(m, W, H, N, 2), v = []; for (let p = 0; p < n; p++) if (e[p]) v.push(r[p]);
    const hu = mediana(v); if (hu != null && v.length > 40) out.L1 = { hu: Math.round(hu) }; }
  // L3: strato centrale
  const kL3 = id.vertebrae_L3;
  if (kL3) { let k0 = N, k1 = -1; for (let p = 0; p < n; p++) if (L[p] === kL3) { const z = (p / WH) | 0; if (z < k0) k0 = z; if (z > k1) k1 = z; }
    if (k1 >= 0) { const k = (k0 + k1) >> 1, o = k * WH, mus = ['iliopsoas_left', 'iliopsoas_right', 'autochthon_left', 'autochthon_right'].map((x) => id[x]).filter(Boolean);
      let ps = 0, pv = 0, sh = 0, c = 0; const kps = new Set([id.iliopsoas_left, id.iliopsoas_right]);
      for (let q = 0; q < WH; q++) { const l = L[o + q]; if (!mus.includes(l)) continue; const hu = r[o + q]; if (hu < -29 || hu > 150) continue; if (kps.has(l)) ps++; else pv++;
        // densità solo all'interno del muscolo (i voxel di bordo, mediati con il grasso, la abbassano)
        if (L[o + q - 1] === l && L[o + q + 1] === l && L[o + q - W] === l && L[o + q + W] === l) { sh += hu; c++; } }
      if (ps + pv) out.L3 = { psoas: ps * a2 / 100, paravertebrali: pv * a2 / 100, hu: c ? Math.round(sh / c) : null }; } }
  // enfisema per lobo
  const lobi = [['lung_upper_lobe_right', 'superiore dx'], ['lung_middle_lobe_right', 'medio'], ['lung_lower_lobe_right', 'inferiore dx'], ['lung_upper_lobe_left', 'superiore sn'], ['lung_lower_lobe_left', 'inferiore sn']];
  const enf = []; let tot = 0, bassi = 0;
  for (const [nome, t] of lobi) { const k = id[nome]; if (!k) continue; let c = 0, b = 0; for (let p = 0; p < n; p++) if (L[p] === k) { c++; if (r[p] < -950) b++; }
    if (c > 200) { enf.push({ lobo: t, perc: Math.round(1000 * b / c) / 10 }); tot += c; bassi += b; } }
  if (enf.length) out.enfisema = { lobi: enf, totale: Math.round(1000 * bassi / tot) / 10 };
  // Agatston (solo senza mdc: sangue nel cuore < 100 HU), sulla piena risoluzione
  const kc = id.heart;
  if (kc) {
    // mdc: si guarda il sangue nell'aorta (il «cuore» del modello comprende il miocardio e il grasso epicardico)
    const ka0 = id.aorta, vc = []; if (ka0) { const ma = new Uint8Array(n); for (let p = 0; p < n; p++) if (L[p] === ka0) ma[p] = 1; const e = erodi(ma, W, H, N, 1); for (let p = 0; p < n; p++) if (e[p]) vc.push(r[p]); }
    if (!vc.length) for (let p = 0; p < n; p += 3) if (L[p] === kc) vc.push(r[p]);
    const sangue = mediana(vc);
    if (sangue != null && sangue < 90) {
      const [W0, H0] = VOL.dim, d = VOL.dati, spx = VOL.sp[0] * VOL.sp[1], f = R.f, ka = id.aorta;
      const vis = new Uint8Array(W0 * H0), coda = new Int32Array(W0 * H0); let score = 0, lesioni = 0;
      for (let k = 0; k < N; k++) {
        // solo il riquadro del cuore in questo strato
        let x0 = W, x1 = -1, y0 = H, y1 = -1; for (let q = 0; q < WH; q++) if (L[k * WH + q] === kc) { const x = q % W, y = (q / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) continue;
        vis.fill(0); const o0 = k * W0 * H0;
        const cuore = (i, j) => L[k * WH + Math.min(H - 1, (j / f) | 0) * W + Math.min(W - 1, (i / f) | 0)] === kc;
        for (let j = y0 * f; j <= Math.min(H0 - 1, y1 * f + f); j++) for (let i = x0 * f; i <= Math.min(W0 - 1, x1 * f + f); i++) { const q = j * W0 + i; if (vis[q] || d[o0 + q] < 130 || !cuore(i, j)) continue;
          let qi = 0, qn = 0, pk = 0; coda[qn++] = q; vis[q] = 1;
          while (qi < qn) { const a = coda[qi++], x = a % W0, y = (a / W0) | 0; pk = Math.max(pk, d[o0 + a]);
            for (const [b, ok] of [[a - 1, x > 0], [a + 1, x < W0 - 1], [a - W0, y > 0], [a + W0, y < H0 - 1]]) if (ok && !vis[b] && d[o0 + b] >= 130 && cuore(b % W0, (b / W0) | 0)) { vis[b] = 1; coda[qn++] = b; } }
          const area = qn * spx; if (area < 1) continue;
          score += area * (pk >= 400 ? 4 : pk >= 300 ? 3 : pk >= 200 ? 2 : 1); lesioni++; } }
      out.agatston = { punteggio: Math.round(score * VOL.sp[2] / 3), lesioni, spessore: VOL.sp[2] };
    } else if (sangue != null) out.agatston = { conMdc: true };
  }
  return out;
}
// ---- vertebre numerate nelle tre viste MPR: etichette (L1, T12…) accanto al soma, solo per le vertebre
// tagliate dal piano mostrato. lista = [{ nome, c: [x,y,z] centro, min: [..], max: [..] }] in coordinate paziente
let vertebre = null, vertAscolto = [];
export function etichetteVertebre(lista) {
  for (const [el, f] of vertAscolto) el.removeEventListener(Enums.Events.IMAGE_RENDERED, f);
  vertAscolto = []; document.querySelectorAll('.vert-strato').forEach((x) => x.remove());
  vertebre = lista && lista.length ? lista : null;
  if (!vertebre || !motore) return;
  for (const id of [VP.assiale, VP.coronale, VP.sagittale]) {
    const vp = motore.getViewport(id); if (!vp) continue;
    const el = vp.element, strato = document.createElement('div'); strato.className = 'vert-strato'; el.appendChild(strato);
    const f = () => {
      const cam = vp.getCamera(), nrm = cam.viewPlaneNormal, fp = cam.focalPoint, html = [];
      const vis = vertebre.map((v) => { const d = (v.c[0] - fp[0]) * nrm[0] + (v.c[1] - fp[1]) * nrm[1] + (v.c[2] - fp[2]) * nrm[2];
        const semi = [0, 1, 2].reduce((t, i) => t + Math.abs(nrm[i]) * (v.max[i] - v.min[i]) / 2, 0); return { v, d, r: Math.abs(d) / Math.max(1, semi) }; }).filter((x) => x.r <= 0.9);
      // piano assiale: una sola vertebra, quella tagliata più vicino al centro
      const scelte = Math.abs(nrm[2]) > 0.8 ? vis.sort((a, b) => a.r - b.r).slice(0, 1) : vis;
      for (const { v, d } of scelte) {
        // punto del soma proiettato sul piano, etichetta poco a lato
        const q = [0, 1, 2].map((i) => v.c[i] - d * nrm[i]), [x, y] = vp.worldToCanvas(q);
        html.push(`<span class="vert-et" style="left:${Math.round(x + 14)}px;top:${Math.round(y - 8)}px">${v.nome}</span>`);
      }
      strato.innerHTML = html.join('');
    };
    el.addEventListener(Enums.Events.IMAGE_RENDERED, f); vertAscolto.push([el, f]); f();
  }
}
/** Misure automatiche dalla segmentazione IA: volumi, lunghezza cranio-caudale, densità media (TC)
 *  dell'interno dell'organo (eroso, senza bordi), diametro massimo dell'aorta. */
export function misureIA({ geo, lab }) {
  if (!motore || !VOL) return null;
  const R = ridotta(), { W, H, N } = R, n = W * H * N, L = etichetteSuR(geo, lab, R), vv = R.sp[0] * R.sp[1] * R.sp[2] / 1000;
  const id = Object.fromEntries(Object.entries(geo.etichette).map(([k, v]) => [v, +k]));
  const organo = (nome) => {
    const k = id[nome]; if (!k) return null;
    const m = new Uint8Array(n); let c = 0, k0 = N, k1 = -1;
    for (let p = 0; p < n; p++) if (L[p] === k) { m[p] = 1; c++; const z = (p / (W * H)) | 0; if (z < k0) k0 = z; if (z > k1) k1 = z; }
    if (!c) return null;
    const bordo = k0 === 0 || k1 === N - 1;   // tagliato dal campo di vista
    let hu = null;
    if (VOL.unita === 'HU') { const e = erodi(m, W, H, N, 2), v = []; for (let p = 0; p < n; p++) if (e[p]) v.push(R.r[p]); v.sort((a, b) => a - b); if (v.length > 30) hu = v[v.length >> 1]; }
    return { m, volume: c * vv, lunghezza: (k1 - k0 + 1) * R.sp[2] / 10, hu, bordo };
  };
  const out = {};
  for (const [chiave, nome] of [['fegato', 'liver'], ['milza', 'spleen'], ['reneDx', 'kidney_right'], ['reneSn', 'kidney_left'], ['prostata', 'prostate'], ['pancreas', 'pancreas']]) {
    const o = organo(nome); if (o) { const { m, ...r } = o; out[chiave] = r; }
  }
  if (VOL.unita === 'HU') Object.assign(out, misureOpportunistiche(R, L, id));
  const ao = organo('aorta');
  if (ao) {
    // aorta toracica e addominale separate allo iato aortico (margine superiore di T12); senza T12, tutta insieme
    const WH = W * H, zk = (k) => aMondo(R, 0, 0, k)[2], pos = (k) => Math.round(punto(aMondo(R, 0, 0, k), VOL.assi[2]) * 10) / 10;
    let zT12 = null; const k12 = id.vertebrae_T12;
    if (k12) for (let k = 0; k < N; k++) { let c = 0; for (let q = 0; q < WH; q++) if (L[k * WH + q] === k12) { c = 1; break; } if (c) { const z = zk(k); if (zT12 == null || z > zT12) zT12 = z; } }
    const parte = (addome) => { const m = new Uint8Array(n); for (let k = 0; k < N; k++) { const sotto = zT12 != null && zk(k) <= zT12; if (zT12 != null && sotto !== addome) continue; for (let q = 0; q < WH; q++) m[k * WH + q] = ao.m[k * WH + q]; } return diametroMassimo(m, R); };
    out.aorta = { volume: ao.volume, bordo: ao.bordo };
    if (zT12 != null) {
      const a = parte(true), t = parte(false);
      if (a.dmax) out.aorta.addominale = { diametro: Math.round(a.dmax), posizione: pos(a.kmax) };
      if (t.dmax) out.aorta.toracica = { diametro: Math.round(t.dmax), posizione: pos(t.kmax) };
    } else { const d = diametroMassimo(ao.m, R); if (d.dmax) out.aorta.tutta = { diametro: Math.round(d.dmax), posizione: pos(d.kmax) }; }
  }
  return out;
}

/** Segmentazione con IA già calcolata (TotalSegmentator, sul Mac): geo = geometria delle etichette
 *  (mondo LPS, metà risoluzione), lab = Uint8Array (strato, riga, colonna), scelte = { etichetta: [r, g, b] }.
 *  Le etichette si riportano sulla griglia ridotta del volume aperto (vicino più prossimo). */
export async function segmentaIA({ geo, lab, scelte, preset = 'solido' }) {
  if (!motore || !VOL) return { ok: false };
  const R = ridotta(), { W, H, N } = R, n = W * H * N, [LW, LH, LN] = geo.dim, out = new Uint8Array(n), sel = new Uint8Array(256);
  for (const k of Object.keys(scelte)) sel[+k] = 1;
  const A = geo.assi, o = geo.origine, sp = geo.sp;
  // indice nelle etichette = (mondo − origine) · asse / passo: lineare in i, j, k
  const proietta = (w) => [0, 1, 2].map((a) => ((w[0] - o[0]) * A[a][0] + (w[1] - o[1]) * A[a][1] + (w[2] - o[2]) * A[a][2]) / sp[a]);
  const p0 = proietta(aMondo(R, 0, 0, 0)), pi = proietta(aMondo(R, 1, 0, 0)).map((v, a) => v - p0[a]), pj = proietta(aMondo(R, 0, 1, 0)).map((v, a) => v - p0[a]), pk = proietta(aMondo(R, 0, 0, 1)).map((v, a) => v - p0[a]);
  const conta = new Float64Array(256);
  for (let k = 0; k < N; k++) for (let j = 0; j < H; j++) {
    let x = p0[0] + pj[0] * j + pk[0] * k, y = p0[1] + pj[1] * j + pk[1] * k, z = p0[2] + pj[2] * j + pk[2] * k;
    for (let i = 0; i < W; i++, x += pi[0], y += pi[1], z += pi[2]) {
      const li = Math.round(x), lj = Math.round(y), lk = Math.round(z);
      if (li < 0 || lj < 0 || lk < 0 || li >= LW || lj >= LH || lk >= LN) continue;
      const v = lab[(lk * LH + lj) * LW + li];
      if (v && sel[v]) { const p = (k * H + j) * W + i; out[p] = v; conta[v]++; }
    }
  }
  let nv = 0; for (let v = 1; v < 256; v++) nv += conta[v];
  if (!nv) return { ok: false, motivo: 'struttura non presente in questo volume' };
  const vv = R.sp[0] * R.sp[1] * R.sp[2] / 1000, volumi = {};
  for (let v = 1; v < 256; v++) if (conta[v]) volumi[v] = conta[v] * vv;
  const dati = new Int16Array(n); for (let p = 0; p < n; p++) dati[p] = out[p] * 8;   // etichetta × 8 su 0-1000, come le altre segmentazioni
  const colori = {}; for (const [k, c] of Object.entries(scelte)) if (conta[+k]) colori[k] = c.map((x) => x / 255);
  await mettiSeg({ dati, geom: { dim: [W, H, N], sp: R.sp, origine: VOL.origine, assi: VOL.assi }, colori });
  const m = new Uint8Array(n); for (let p = 0; p < n; p++) m[p] = out[p] ? 1 : 0;
  segInfo = { tipo: 'ia', volume: nv * vv, volumi, vr: true };
  if (preset === 'solido') await vr3dEtichette(out, R, scelte); else await vr3dVasi(m, R, preset);
  return { ok: true, ...segInfo };
}
async function mettiSeg(s) {
  const mpr = [VP.assiale, VP.coronale, VP.sagittale];
  const voi = Object.fromEntries(mpr.map((id) => [id, motore.getViewport(id).getProperties().voiRange]));
  const camere = Object.fromEntries(mpr.map((id) => [id, motore.getViewport(id).getCamera()]));
  const vecchio = idSeg;
  let nomeLut = null;
  if (s) {
    const v = volumeDaDati('quizSeg', s.dati, s.geom); idSeg = v.volumeId;
    if (s.colori) {          // etichette (IA): un colore per struttura, valore = numero dell'etichetta
      nomeLut = 'quiz-ia-' + (++nLutIA);
      const pt = [0, 0, 0, 0]; for (const [v, c] of Object.entries(s.colori)) pt.push((+v * 8 - 3) / 1000, ...c, (+v * 8 + 3) / 1000, ...c); pt.push(1, 0, 0, 0);   // con 0 e 1: setMappingRange riscala tra il primo e l'ultimo punto   // punti normalizzati sull'intervallo 0-255
      csUtils.colormap.registerColormap({ Name: nomeLut, name: nomeLut, ColorSpace: 'RGB', RGBPoints: pt });
    } else {
      nomeLut = 'quiz-seg-' + s.colore.join('-');
      if (!csUtils.colormap.getColormap(nomeLut)) csUtils.colormap.registerColormap({ Name: nomeLut, name: nomeLut, ColorSpace: 'RGB', RGBPoints: [0, ...s.colore, 1, ...s.colore] });
    }
  } else idSeg = null;
  await setVolumesForViewports(motore, [{ volumeId: idVolume }, ...(idPet ? [{ volumeId: idPet }] : []), ...(idSeg ? [{ volumeId: idSeg }] : [])], mpr);
  try { if (vecchio) cache.removeVolumeLoadObject(vecchio); } catch {}
  for (const id of mpr) {
    const vp = motore.getViewport(id);
    if (voi[id]) vp.setProperties({ voiRange: voi[id] }, idVolume);
    vp.setCamera(camere[id]);
    if (idSeg) {
      vp.setProperties(s.colori
        ? { colormap: { name: nomeLut, opacity: 0.45, opacityMapping: [{ value: -1, opacity: 0 }, { value: 4, opacity: 0 }, { value: 5, opacity: 1 }, { value: 1001, opacity: 1 }] }, voiRange: { lower: 0, upper: 1000 } }
        : { colormap: { name: nomeLut, opacity: 0.4, opacityMapping: [{ value: -1, opacity: 0 }, { value: 400, opacity: 0 }, { value: 600, opacity: 1 }, { value: 1001, opacity: 1 }] }, voiRange: { lower: 0, upper: 1000 } }, idSeg);
      const att = vp.getActors().find((a) => a.referencedId === idSeg);
      try { att?.actor.getProperty().setScalarOpacityUnitDistance(0, Math.max(0.01, vp.getSlabThickness?.() || 0.05)); } catch {}
    }
  }
  if (idPet && aspettoPet) aspettoFusione(aspettoPet); else motore.render();
}


// ---- vasi: estrazione automatica (angio-TC e angio-RM) sulla griglia ridotta
// TC: voxel con mdc (soglia dal 60% della densità dell'aorta) nel corpo, tolto l'osso e i frammenti che
// lo toccano; restano le componenti di almeno 0,3 cm³.
// RM: il 1,5% più intenso del volume (il sangue nelle sequenze angiografiche è la struttura più chiara).
let vasiR = null;   // { m, R } maschera dei vasi, per l'analisi del vaso
// densità del sangue opacizzato: aorta (o altri grossi vasi) cercata negli strati centrali come oggetto
// rotondo e omogeneo (la vertebra è rotonda ma disomogenea: corticale e spongiosa)
function densitaVasi(R, corpo) {
  // soglia alta prima (fase arteriosa: l'aorta si stacca dalle strutture vicine), poi più bassa
  for (const soglia of [260, 150]) { const d = densitaVasiA(R, corpo, soglia); if (d) return d; }
  return null;
}
function densitaVasiA(R, corpo, soglia) {
  const { r, W, H, N } = R, WH = W * H, a2 = R.sp[0] * R.sp[1], medie = [], lab = new Int32Array(WH), coda = new Int32Array(WH);
  for (let k = Math.floor(N * 0.15); k < N * 0.85; k += Math.max(1, Math.floor(N / 40))) {
    lab.fill(0); const o = k * WH; let L = 0;
    for (let q0 = 0; q0 < WH; q0++) {
      if (lab[q0] || !corpo[o + q0] || r[o + q0] < soglia) continue;
      L++; let qi = 0, qn = 0, s1 = 0, s2 = 0, x0 = W, x1 = 0, y0 = H, y1 = 0; coda[qn++] = q0; lab[q0] = L;
      while (qi < qn) { const q = coda[qi++], x = q % W, y = (q / W) | 0, v = r[o + q]; s1 += v; s2 += v * v;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const [b, ok] of [[q - 1, x > 0], [q + 1, x < W - 1], [q - W, y > 0], [q + W, y < H - 1]]) if (ok && !lab[b] && corpo[o + b] && r[o + b] >= soglia) { lab[b] = L; coda[qn++] = b; } }
      const area = qn * a2, bw = x1 - x0 + 1, bh = y1 - y0 + 1, riemp = qn / (Math.PI / 4 * bw * bh), asp = bw / bh;
      if (area < 150 || area > 1500 || riemp < 0.75 || asp < 0.6 || asp > 1.6) continue;
      const m = s1 / qn, sd = Math.sqrt(Math.max(0, s2 / qn - m * m));
      if (sd / m < 0.2 && m < 700) medie.push(m);
    }
  }
  // l'aorta è il vaso più denso (in fase arteriosa molto più della cava e della porta): 85° percentile
  medie.sort((a, b) => a - b);
  return medie.length >= 3 ? medie[Math.floor(medie.length * 0.85)] : null;
}
function vasi(R, corpo) {
  const { r, W, H, N } = R, n = W * H * N, ct = VOL.unita === 'HU', vv = R.sp[0] * R.sp[1] * R.sp[2];
  let lo, semeOsso = 450, dv = null;
  if (ct) { dv = densitaVasi(R, corpo); lo = dv ? Math.max(140, dv * 0.6) : 160; if (dv) semeOsso = Math.max(450, Math.round(dv * 1.4 + 60)); }
  else { const c = []; let mx = 0; for (let p = 0; p < n; p += 13) if (r[p] > mx) mx = r[p];
    for (let p = 0; p < n; p += 13) if (r[p] > mx * 0.03) c.push(r[p]); c.sort((a, b) => a - b); lo = c[Math.floor(c.length * 0.985)] || mx / 2; }
  const cand = new Uint8Array(n); for (let p = 0; p < n; p++) cand[p] = (ct ? corpo[p] : 1) && r[p] >= lo ? 1 : 0;
  let libero = cand, osso = null;
  if (ct) {
    // osso: corticale (più densa del sangue opacizzato) cresciuta per 5 voxel nella spongiosa (≥ 170 HU),
    // poi i buchi riempiti strato per strato e un voxel di margine
    let o = new Uint8Array(n); for (let p = 0; p < n; p++) o[p] = R.rmax[p] >= semeOsso ? 1 : 0;
    // le calcificazioni dei vasi non sono osso: prima facevano da seme e si portavano via un pezzo di vaso
    const calc = OPZ_VASI.calcio ? calcificazioniR(R, o, dv, semeOsso) : null;
    if (calc) for (let p = 0; p < n; p++) if (calc[p]) o[p] = 0;
    const spong = new Uint8Array(n); for (let p = 0; p < n; p++) spong[p] = r[p] >= 170 ? 1 : 0;
    o = riempiBuchi(dilataIn(o, spong, W, H, N, 5), W, H, N);
    osso = dilataIn(o, cand, W, H, N, 1);
    libero = new Uint8Array(n); for (let p = 0; p < n; p++) libero[p] = cand[p] && !osso[p] ? 1 : 0;
  }
  // classificazione per componenti, dopo un'erosione che stacca i vasi dall'osso che toccano
  // (aorta davanti alla vertebra): restano le parti che toccano poco l'osso, sono omogenee e non troppo piccole
  const tocca = (p) => { const i = p % W, j = ((p / W) | 0) % H; return osso && ((i > 0 && osso[p - 1]) || (i < W - 1 && osso[p + 1]) || (j > 0 && osso[p - W]) || (j < H - 1 && osso[p + W]) || (p >= W * H && osso[p - W * H]) || (p + W * H < n && osso[p + W * H])); };
  const classifica = (maschera, minimo) => {
    const { lab, comp } = componenti3d(maschera, W, H, N), vic = new Float64Array(comp.length + 1), s1 = new Float64Array(comp.length + 1), s2 = new Float64Array(comp.length + 1);
    for (let p = 0; p < n; p++) { const L = lab[p]; if (!L) continue; s1[L] += r[p]; s2[L] += r[p] * r[p]; if (tocca(p)) vic[L]++; }
    const ok = new Uint8Array(comp.length + 1);
    for (const c of comp) { const m = s1[c.L] / c.n, cv = Math.sqrt(Math.max(0, s2[c.L] / c.n - m * m)) / m;
      ok[c.L] = c.n * vv >= minimo && vic[c.L] / c.n < 0.15 && (!ct || cv < 0.45) ? 1 : 0; }
    return { lab, ok };
  };
  const er = erodi(libero, W, H, N, 1), A = classifica(er, 200);
  let m = new Uint8Array(n); for (let p = 0; p < n; p++) if (A.ok[A.lab[p]]) m[p] = 1;
  m = dilataIn(m, libero, W, H, N, 2);
  // vasi sottili (spariti con l'erosione): componenti senza parte erosa, prese se non stanno sull'osso
  const B = classifica(libero, 50), conErosa = new Uint8Array(B.ok.length);
  for (let p = 0; p < n; p++) if (er[p] && B.lab[p]) conErosa[B.lab[p]] = 1;
  let tot = 0; for (let p = 0; p < n; p++) { const L = B.lab[p]; if (L && !conErosa[L] && B.ok[L]) m[p] = 1; tot += m[p]; }
  // frammenti di coste e cartilagini calcifiche (corticale sottile, meno densa della soglia dell'osso):
  // pezzi piccoli che stanno per buona parte a ridosso dell'osso riconosciuto
  let ncomp = 0;
  if (osso) {
    const vicino = dilataIn(osso, new Uint8Array(n).fill(1), W, H, N, 3), { lab: L2, comp: C2 } = componenti3d(m, W, H, N), nv = new Float64Array(C2.length + 1);
    for (let p = 0; p < n; p++) if (L2[p] && vicino[p]) nv[L2[p]]++;
    const via = new Uint8Array(C2.length + 1);
    for (const c of C2) { const vol = c.n * vv / 1000; if (vol < 0.3 || (vol < 8 && nv[c.L] / c.n > 0.25)) via[c.L] = 1; else ncomp++; }
    tot = 0; for (let p = 0; p < n; p++) { if (via[L2[p]]) m[p] = 0; tot += m[p]; }
  } else ncomp = A.ok.reduce((a, b) => a + b, 0);
  ultimiVasi = { m, R, dv, semeOsso };
  return { m, soglia: Math.round(lo), componenti: ncomp, tot };
}
// Calcificazioni dei vasi (griglia ridotta): componenti dei semi densi piccole (<= 6 cm³) che per almeno un quarto del
// contorno toccano il lume dei vasi principali (sangue opacizzato, 0,75-1,35 × densità dei vasi, in una regione grande). Solo con i vasi ben opacizzati (≥ 250 HU):
// in fase venosa il midollo osseo ha la densità del sangue e non si distingue.
let OPZ_VASI = { calcio: true }, ultimiVasi = null;
function calcificazioniR(R, semi, dv, seme) {
  if (!dv || dv < 250) return null;
  const { r, W, H, N } = R, n = W * H * N, WH = W * H, vv = R.sp[0] * R.sp[1] * R.sp[2];
  const { lab, comp } = componenti3d(semi, W, H, N), bordo = new Float64Array(comp.length + 1), sangue = new Float64Array(comp.length + 1);
  const lo = dv * 0.75, hi = Math.min(seme, dv * 1.35);
  // lume dei vasi principali: regioni di sangue opacizzato grandi (il midollo delle coste è piccolo e chiuso nella corticale)
  const bl = new Uint8Array(n); for (let p = 0; p < n; p++) bl[p] = !semi[p] && r[p] >= lo && r[p] < hi ? 1 : 0;
  const S = componenti3d(bl, W, H, N), maxS = S.comp.reduce((a, c) => Math.max(a, c.n), 0), minS = Math.min(30000 / vv, maxS * 0.25);
  const lume = new Uint8Array(S.comp.length + 1); for (const c of S.comp) if (c.n >= minS) lume[c.L] = 1;
  for (let p = 0; p < n; p++) { const L = lab[p]; if (!L) continue; const i = p % W, j = ((p / W) | 0) % H, k = (p / WH) | 0;
    for (const [q, ok] of [[p - 1, i > 0], [p + 1, i < W - 1], [p - W, j > 0], [p + W, j < H - 1], [p - WH, k > 0], [p + WH, k < N - 1]])
      if (ok && !semi[q]) { bordo[L]++; if (lume[S.lab[q]]) sangue[L]++; } }
  const ok = new Uint8Array(comp.length + 1); let tot = 0;
  for (const c of comp) if (c.n * vv <= 6000 && bordo[c.L] && sangue[c.L] / bordo[c.L] >= 0.25) { ok[c.L] = 1; tot += c.n; }
  if (!tot) return null;
  const out = new Uint8Array(n); for (let p = 0; p < n; p++) if (ok[lab[p]]) out[p] = 1;
  return out;
}
// calcificazioni per «togli l'osso» (stessi semi della segmentazione dei vasi), in cache per volume
let cacheCalcio = null;
function calcioPerOsso() {
  if (cacheCalcio?.vol === VOL) return cacheCalcio.c;
  let c = null;
  if (OPZ_VASI.calcio && VOL.unita === 'HU') {
    const R = ridottaC(), dv = densitaVasi(R, corpo3dR().m);
    if (dv) { const seme = Math.max(450, Math.round(dv * 1.4 + 60)), n = R.r.length, s0 = new Uint8Array(n);
      for (let p = 0; p < n; p++) s0[p] = R.rmax[p] >= seme ? 1 : 0;
      const m = calcificazioniR(R, s0, dv, seme); if (m) c = { m, W: R.W, H: R.H, N: R.N }; }
  }
  cacheCalcio = { vol: VOL, c };
  return c;
}
export function _opzioniVasi(o = {}) { Object.assign(OPZ_VASI, o); cacheCalcio = null; return { ...OPZ_VASI }; }
/** Diagnosi: calcificazioni e lume vicino, quanto ne resta nell'ultima maschera dei vasi (griglia ridotta). */
export function _diagnosiCalcio() {
  if (!ultimiVasi?.dv) return null;
  const { m, R, dv, semeOsso } = ultimiVasi, { r, W, H, N } = R, n = W * H * N, WH = W * H, s0 = new Uint8Array(n);
  for (let p = 0; p < n; p++) s0[p] = R.rmax[p] >= semeOsso ? 1 : 0;
  const c = calcificazioniR(R, s0, dv, semeOsso);
  if (!c) return { dv: Math.round(dv), calcificazioni: 0 };
  const vic = dilataIn(c, new Uint8Array(n).fill(1), W, H, N, 2), vv = R.sp[0] * R.sp[1] * R.sp[2] / 1000;
  let nc = 0, ncm = 0, nl = 0, nlm = 0;
  for (let p = 0; p < n; p++) { if (c[p]) { nc++; if (m[p]) ncm++; }
    else if (vic[p] && r[p] >= dv * 0.75 && r[p] < dv * 1.35) { nl++; if (m[p]) nlm++; } }
  const cm = (x) => Math.round(x * vv * 100) / 100;
  return { dv: Math.round(dv), calcificazioni: cm(nc), calcioNeiVasi: cm(ncm), lumeVicino: cm(nl), lumeVicinoNeiVasi: cm(nlm) };
}
// 3D con i soli vasi: la maschera ridotta riportata alla risoluzione piena (e allargata di un voxel)
async function vr3dVasi(mR, R, preset = null) {
  // fuori dalla struttura: aria per i tessuti, tessuto (0 HU, trasparente nel preset «Aria») per polmoni e gas
  const [W0, H0, N] = VOL.dim, d = VOL.dati, fondo = VOL.unita === 'HU' && preset !== 'CT-Air' ? -1024 : 0, dati = new Int16Array(d.length).fill(fondo);
  if (preset === 'solido') {
    // organo pieno (fegato, reni, vescica, encefalo): superficie liscia invece della densità reale,
    // che con il rumore e i valori dei tessuti molli dà un 3D «a puntini». La maschera della griglia
    // ridotta si sfuma (media 3×3×3, due volte) e si porta a piena risoluzione interpolando nel piano.
    const { W, H } = R; let a = Float32Array.from(mR);
    for (let t = 0; t < 2; t++) { const b = new Float32Array(a.length);
      for (let k = 0; k < N; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s2 = 0, c = 0;
        for (let kk = Math.max(0, k - 1); kk <= Math.min(N - 1, k + 1); kk++) for (let jj = Math.max(0, j - 1); jj <= Math.min(H - 1, j + 1); jj++) for (let ii = Math.max(0, i - 1); ii <= Math.min(W - 1, i + 1); ii++) { s2 += a[(kk * H + jj) * W + ii]; c++; }
        b[(k * H + j) * W + i] = s2 / c; }
      a = b; }
    for (let k = 0; k < N; k++) for (let j = 0; j < H0; j++) { const y = Math.min(H - 1, j / R.f), j0 = Math.floor(y), j1 = Math.min(H - 1, j0 + 1), fy = y - j0;
      for (let i = 0; i < W0; i++) { const x = Math.min(W - 1, i / R.f), i0 = Math.floor(x), i1 = Math.min(W - 1, i0 + 1), fx = x - i0, o = k * H * W;
        const v = (a[o + j0 * W + i0] * (1 - fx) + a[o + j0 * W + i1] * fx) * (1 - fy) + (a[o + j1 * W + i0] * (1 - fx) + a[o + j1 * W + i1] * fx) * fy;
        // il preset diventa opaco da ~145 HU: superficie a metà del bordo sfumato, anche per organi sottili (pancreas, surreni)
        if (v > 0.02) dati[(k * H0 + j) * W0 + i] = Math.round(-1024 + Math.min(1, v * 2.2) * 1300); } }
    preset = 'CT-Muscle';
  } else for (let k = 0; k < N; k++) for (let j = 0; j < H0; j++) for (let i = 0; i < W0; i++) {
    const ii = Math.min(R.W - 1, Math.round(i / R.f)), jj = Math.min(R.H - 1, Math.round(j / R.f)), b = (k * R.H + jj) * R.W + ii;
    if (mR[b] || (ii > 0 && mR[b - 1]) || (ii < R.W - 1 && mR[b + 1]) || (jj > 0 && mR[b - R.W]) || (jj < R.H - 1 && mR[b + R.W])) { const p = (k * H0 + j) * W0 + i; dati[p] = d[p]; }
  }
  const vr = motore.getViewport(VP.vr), cam = vr.getCamera(), vecchio = idVR;
  idVR = volumeDaDati('quizVR', dati, { dim: VOL.dim, sp: VOL.sp, origine: VOL.origine, assi: VOL.assi }).volumeId;
  await setVolumesForViewports(motore, volumiVR(), [VP.vr]);
  try { if (vecchio) cache.removeVolumeLoadObject(vecchio); } catch {}
  if (preset) presetVR = preset; else if (VOL.unita !== 'HU') presetVR = 'MR-Angio'; else if (!/AAA|Vessel|Coronary|Angio|Arter|MIP/.test(presetVR || '')) presetVR = 'CT-AAA';
  modo3d(); vr.setCamera(cam); vr.render();
}

// 3D delle strutture segmentate con l'IA, ognuna con il suo colore (lo stesso delle viste MPR).
// Il contorno viene dalla maschera sfumata a piena risoluzione (superficie liscia), il colore dall'etichetta
// più vicina; il valore del voxel è 100 + 8 × etichetta, letto senza interpolazione (niente colori misti ai bordi).
async function vr3dEtichette(Lr, R, colori) {
  const [W0, H0, N] = VOL.dim, { W, H } = R, dati = new Int16Array(W0 * H0 * N);
  let a = new Float32Array(Lr.length); for (let p = 0; p < Lr.length; p++) a[p] = Lr[p] ? 1 : 0;
  for (let t = 0; t < 2; t++) { const b = new Float32Array(a.length);
    for (let k = 0; k < N; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s2 = 0, c = 0;
      for (let kk = Math.max(0, k - 1); kk <= Math.min(N - 1, k + 1); kk++) for (let jj = Math.max(0, j - 1); jj <= Math.min(H - 1, j + 1); jj++) for (let ii = Math.max(0, i - 1); ii <= Math.min(W - 1, i + 1); ii++) { s2 += a[(kk * H + jj) * W + ii]; c++; }
      b[(k * H + j) * W + i] = s2 / c; }
    a = b; }
  const etichetta = (o, i, j) => { const ii = Math.min(W - 1, Math.round(i)), jj = Math.min(H - 1, Math.round(j)), q = o + jj * W + ii; if (Lr[q]) return Lr[q];
    for (const d of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) { const z = q + d; if (z >= o && z < o + W * H && Lr[z]) return Lr[z]; } return 0; };
  for (let k = 0; k < N; k++) for (let j = 0; j < H0; j++) { const y = Math.min(H - 1, j / R.f), j0 = Math.floor(y), j1 = Math.min(H - 1, j0 + 1), fy = y - j0, o = k * H * W;
    for (let i = 0; i < W0; i++) { const x = Math.min(W - 1, i / R.f), i0 = Math.floor(x), i1 = Math.min(W - 1, i0 + 1), fx = x - i0;
      const v = (a[o + j0 * W + i0] * (1 - fx) + a[o + j0 * W + i1] * fx) * (1 - fy) + (a[o + j1 * W + i0] * (1 - fx) + a[o + j1 * W + i1] * fx) * fy;
      if (v < 0.42) continue;
      const l = etichetta(o, x, y); if (l) dati[(k * H0 + j) * W0 + i] = 100 + 8 * l; } }
  const vr = motore.getViewport(VP.vr), cam = vr.getCamera(), vecchio = idVR;
  idVR = volumeDaDati('quizVR', dati, { dim: VOL.dim, sp: VOL.sp, origine: VOL.origine, assi: VOL.assi }).volumeId;
  await setVolumesForViewports(motore, volumiVR(), [VP.vr]);
  try { if (vecchio) cache.removeVolumeLoadObject(vecchio); } catch {}
  presetVR = 'CT-Muscle'; modo3d();     // impostazioni di luce e ombreggiatura del preset, poi i colori delle etichette
  const att = vr.getActors().find((x) => x.referencedId === idVR) || vr.getActors()[0];
  const pr = att.actor.getProperty(), ctf = pr.getRGBTransferFunction(0), ofun = pr.getScalarOpacity(0);
  ctf.removeAllPoints(); ofun.removeAllPoints();
  ctf.addRGBPoint(0, 0, 0, 0); ofun.addPoint(0, 0); ofun.addPoint(99, 0);
  for (const [k, c] of Object.entries(colori)) { const v = 100 + 8 * +k; ctf.addRGBPoint(v - 3, c[0] / 255, c[1] / 255, c[2] / 255); ctf.addRGBPoint(v + 3, c[0] / 255, c[1] / 255, c[2] / 255); }
  ofun.addPoint(100, 1); ofun.addPoint(3000, 1);
  try { pr.setInterpolationTypeToNearest(); pr.setUseGradientOpacity(0, false); pr.setShade(true); pr.setAmbient(0.25); pr.setDiffuse(0.8); pr.setSpecular(0.15); } catch {}
  vr.setCamera(cam); vr.render();
}

// ---- analisi del vaso: linea centrale automatica tra i punti cliccati, CPR e diametri lungo il vaso
function percorsoNelVaso(R, m, a, b) {
  const { W, H, N } = R;
  // riquadro attorno ai due punti (+3 cm), dentro il quale si cerca il percorso
  const marg = [0, 1, 2].map((q) => Math.ceil(30 / R.sp[q]));
  const lo = [0, 1, 2].map((q) => Math.max(0, Math.min(a[q], b[q]) - marg[q])), hi = [0, 1, 2].map((q, i) => Math.min([W, H, N][i] - 1, Math.max(a[q], b[q]) + marg[q]));
  const bw = hi[0] - lo[0] + 1, bh = hi[1] - lo[1] + 1, bd = hi[2] - lo[2] + 1, bn = bw * bh * bd;
  const g = (i, j, k) => ((k - lo[2]) * bh + (j - lo[1])) * bw + (i - lo[0]);
  const dentro = new Uint8Array(bn);
  for (let k = lo[2]; k <= hi[2]; k++) for (let j = lo[1]; j <= hi[1]; j++) for (let i = lo[0]; i <= hi[0]; i++) dentro[g(i, j, k)] = m[(k * H + j) * W + i];
  // il punto cliccato va portato nel vaso più vicino (entro 6 mm)
  const aggancia = (p) => { let mig = -1, dm = 1e9; const rr = [0, 1, 2].map((q) => Math.ceil(6 / R.sp[q]));
    for (let k = Math.max(lo[2], p[2] - rr[2]); k <= Math.min(hi[2], p[2] + rr[2]); k++) for (let j = Math.max(lo[1], p[1] - rr[1]); j <= Math.min(hi[1], p[1] + rr[1]); j++) for (let i = Math.max(lo[0], p[0] - rr[0]); i <= Math.min(hi[0], p[0] + rr[0]); i++) {
      const q = g(i, j, k); if (!dentro[q]) continue; const d = ((i - p[0]) * R.sp[0]) ** 2 + ((j - p[1]) * R.sp[1]) ** 2 + ((k - p[2]) * R.sp[2]) ** 2; if (d < dm) { dm = d; mig = q; } }
    return mig; };
  const sa = aggancia(a), sb = aggancia(b);
  if (sa < 0 || sb < 0) return null;
  // distanza dal bordo del vaso (smussatura a due passate): il percorso preferisce il centro
  const dt = new Float32Array(bn); for (let q = 0; q < bn; q++) dt[q] = dentro[q] ? 1e6 : 0;
  const passi = [[-1, 0, 0], [0, -1, 0], [0, 0, -1], [-1, -1, 0], [1, -1, 0]].map(([x, y, z]) => [x, y, z, Math.hypot(x * R.sp[0], y * R.sp[1], z * R.sp[2])]);
  for (const verso of [1, -1]) for (let k = verso > 0 ? 0 : bd - 1; verso > 0 ? k < bd : k >= 0; k += verso) for (let j = verso > 0 ? 0 : bh - 1; verso > 0 ? j < bh : j >= 0; j += verso) for (let i = verso > 0 ? 0 : bw - 1; verso > 0 ? i < bw : i >= 0; i += verso) {
    const q = (k * bh + j) * bw + i; if (!dt[q]) continue;
    for (const [x, y, z, c] of passi) { const ii = i + x * verso, jj = j + y * verso, kk = k + z * verso;
      const v = ii < 0 || jj < 0 || kk < 0 || ii >= bw || jj >= bh || kk >= bd ? 0 : dt[(kk * bh + jj) * bw + ii]; if (v + c < dt[q]) dt[q] = v + c; } }
  // Dijkstra (coda a priorità binaria) con costo per passo / (distanza dal bordo)²
  const dist = new Float32Array(bn).fill(Infinity), da = new Int32Array(bn).fill(-1), heap = [], fatto = new Uint8Array(bn);
  const push = (q, d) => { heap.push([d, q]); let i = heap.length - 1; while (i) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const t = heap[0], u = heap.pop(); if (heap.length) { heap[0] = u; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  const vic = []; for (let z = -1; z <= 1; z++) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (x || y || z) vic.push([x, y, z, Math.hypot(x * R.sp[0], y * R.sp[1], z * R.sp[2])]);
  dist[sa] = 0; push(sa, 0);
  while (heap.length) {
    const [d, q] = pop(); if (fatto[q]) continue; fatto[q] = 1; if (q === sb) break;
    const i = q % bw, j = ((q / bw) | 0) % bh, k = (q / (bw * bh)) | 0;
    for (const [x, y, z, c] of vic) { const ii = i + x, jj = j + y, kk = k + z; if (ii < 0 || jj < 0 || kk < 0 || ii >= bw || jj >= bh || kk >= bd) continue;
      const r = (kk * bh + jj) * bw + ii; if (!dentro[r] || fatto[r]) continue;
      const nd = d + c / (0.05 + dt[r] * dt[r]); if (nd < dist[r]) { dist[r] = nd; da[r] = q; push(r, nd); } }
  }
  if (!fatto[sb]) return null;
  const via = []; for (let q = sb; q >= 0; q = da[q]) { const i = q % bw, j = ((q / bw) | 0) % bh, k = (q / (bw * bh)) | 0; via.push(aMondo(R, i + lo[0], j + lo[1], k + lo[2])); if (q === sa) break; }
  return via.reverse();
}
export async function analisiVaso() {
  if (!cpr || cpr.punti.length < 2 || !VOL) return { ok: false, motivo: 'servono almeno due punti sul vaso' };
  if (!vasiR) {
    const R = ridotta(), C = VOL.unita === 'HU' ? mascheraCorpo(2).dentro : new Uint8Array(R.r.length).fill(1);
    vasiR = { m: vasi(R, C).m, R };
  }
  const { m, R } = vasiR, clic = cpr.punti.slice();
  let via = [];
  for (let s = 0; s < clic.length - 1; s++) {
    const p = percorsoNelVaso(R, m, daMondo(R, clic[s]), daMondo(R, clic[s + 1]));
    if (!p) return { ok: false, motivo: `non trovo un vaso continuo tra il punto ${s + 1} e il punto ${s + 2}: avvicina i punti o mettili al centro del vaso` };
    via = via.concat(s ? p.slice(1) : p);
  }
  // linea centrale liscia: media mobile su ±3 voxel, poi un punto ogni 3 mm
  const lisc = via.map((_, i) => { const a = Math.max(0, i - 3), b = Math.min(via.length - 1, i + 3); return [0, 1, 2].map((q) => { let t = 0; for (let k = a; k <= b; k++) t += via[k][q]; return t / (b - a + 1); }); });
  const punti = [lisc[0]]; let acc = 0;
  for (let i = 1; i < lisc.length; i++) { acc += lung(sotto(lisc[i], lisc[i - 1])); if (acc >= 3) { punti.push(lisc[i]); acc = 0; } }
  if (lung(sotto(punti[punti.length - 1], lisc[lisc.length - 1])) > 0.5) punti.push(lisc[lisc.length - 1]);
  cpr.punti = punti; cpr.clic = clic; disegnaPuntiCPR();
  return { ok: true, ...profiloVaso() };
}
/** diametri nelle sezioni perpendicolari alla linea centrale, ogni millimetro */
function profiloVaso() {
  const curva = curvaCPR(1), n = curva.length, norm = (v) => { const l = lung(v) || 1; return v.map((x) => x / l); };
  const ct = VOL.unita === 'HU', RAGGI = 24, out = [];
  let N0 = null;
  for (let i = 0; i < n; i++) {
    const T = norm(sotto(curva[Math.min(n - 1, i + 1)], curva[Math.max(0, i - 1)]));
    let A = N0 ? sotto(N0, T.map((x) => x * punto(N0, T))) : croce(T, Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]); A = norm(A); N0 = A;
    const B = croce(T, A), c = curva[i];
    // intensità del lume: media vicino al centro; soglia a metà tra lume e fondo (TC: tessuti ~ 0 HU)
    let ic = 0, nc = 0; for (let t = 0; t < 8; t++) { const a = t * Math.PI / 4; const v = campiona([0, 1, 2].map((q) => c[q] + (A[q] * Math.cos(a) + B[q] * Math.sin(a)) * 0.7)); if (v != null) { ic += v; nc++; } }
    const v0 = campiona(c); if (v0 != null) { ic += v0; nc++; }
    if (!nc) { out.push(null); continue; }
    ic /= nc; const soglia = ct ? Math.max(100, (ic + 20) / 2) : ic / 2;
    const r = [];
    for (let t = 0; t < RAGGI; t++) { const a = t * 2 * Math.PI / RAGGI, D = [0, 1, 2].map((q) => A[q] * Math.cos(a) + B[q] * Math.sin(a));
      let rr = 0; for (let d = 0.2; d <= 25; d += 0.2) { const v = campiona([0, 1, 2].map((q) => c[q] + D[q] * d)); if (v == null || v < soglia) break; rr = d; } r.push(rr + 0.1); }
    let area = 0; for (let t = 0; t < RAGGI; t++) area += 0.5 * r[t] * r[(t + 1) % RAGGI] * Math.sin(2 * Math.PI / RAGGI);
    let dmin = Infinity, dmax = 0; for (let t = 0; t < RAGGI / 2; t++) { const d = r[t] + r[t + RAGGI / 2]; if (d < dmin) dmin = d; if (d > dmax) dmax = d; }
    out.push({ s: i, area, deq: 2 * Math.sqrt(area / Math.PI), dmin, dmax });
  }
  // riferimento interpolato (come nell'angiografia quantitativa): mediana del tratto iniziale e di quello
  // finale (20% ciascuno), raccordate in linea retta; la stenosi è il massimo restringimento rispetto
  // al riferimento atteso in quel punto, cercato lontano dagli estremi (10% per parte)
  const val = out.filter(Boolean), med = (a) => { const b = a.map((x) => x.deq).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  const k = Math.max(2, Math.round(val.length * 0.2)), rifP = med(val.slice(1, k + 1)), rifD = med(val.slice(-k - 1, -1));
  const rifIn = (i) => rifP + (rifD - rifP) * i / Math.max(1, n - 1), rif = (rifP + rifD) / 2;
  const m0 = Math.max(2, Math.round(out.length * 0.1)), m1 = Math.min(out.length - 2, Math.round(out.length * 0.9));
  let piu = null; for (let i = m0; i < m1; i++) { const w = out.slice(i - 1, i + 2); if (w.some((x) => !x)) continue; const d = w.reduce((a, x) => a + x.deq, 0) / 3, st = 1 - d / rifIn(i); if (!piu || st > piu.st) piu = { d, i, st }; }
  const minimo = piu ? { s: piu.i, deq: piu.d, dmin: out[piu.i].dmin, dmax: out[piu.i].dmax, area: out[piu.i].area, rif: rifIn(piu.i) } : null;
  const stenosi = minimo ? Math.max(0, Math.round(piu.st * 100)) : null;
  const gradoStenosi = stenosi == null ? '' : stenosi < 1 ? 'nessuna stenosi' : stenosi < 25 ? 'minima (1-24%)' : stenosi < 50 ? 'lieve (25-49%)' : stenosi < 70 ? 'moderata (50-69%)' : stenosi < 100 ? 'severa (70-99%)' : 'occlusione';
  return { profilo: out, lunghezza: n - 1, riferimento: rif, rifP, rifD, minimo, stenosi, gradoStenosi };
}

// ---- diametri del vaso nelle sezioni perpendicolari alla linea centrale (aneurismi, ectasie)
// parete esterna dalla segmentazione IA quando c'è (comprende il trombo), altrimenti il lume opacizzato
let iaVaso = null, cacheR = null;
function ridottaC() { if (!cacheR || cacheR.vol !== VOL) cacheR = { vol: VOL, R: ridotta() }; return cacheR.R; }
let cacheL = null;
function etichetteC(geo, lab) { if (!cacheL || cacheL.vol !== VOL || cacheL.lab !== lab) cacheL = { vol: VOL, lab, L: etichetteSuR(geo, lab, ridottaC()) }; return cacheL.L; }
/** sceglie il vaso della segmentazione IA per la parete esterna; senza nome: quello sotto la linea centrale */
export function impostaMascheraVaso({ geo, lab, nome } = {}) {
  iaVaso = null;
  if (!geo || !lab || !VOL) return null;
  const R = ridottaC(), L = etichetteC(geo, lab);
  let id = nome ? +(Object.entries(geo.etichette).find(([, v]) => v === nome)?.[0] || 0) : 0;
  if (!id && cpr?.punti.length >= 2) {   // etichetta più frequente lungo la linea centrale (solo vasi)
    const conta = {}, curva = curvaCPR(2);
    for (const w of curva) { const p = daMondo(R, w); if (p.some((v, a) => v < 0 || v >= [R.W, R.H, R.N][a])) continue; const e = L[(p[2] * R.H + p[1]) * R.W + p[0]]; if (e) conta[e] = (conta[e] || 0) + 1; }
    const vaso = /aorta|arter|vein|vena|trunk|carotid|subclavian|iliac/;
    const mig = Object.entries(conta).filter(([e]) => vaso.test(geo.etichette[e] || '')).sort((a, b) => b[1] - a[1])[0];
    if (mig && mig[1] >= curva.length * 0.4) id = +mig[0];
  }
  if (!id) return null;
  iaVaso = { R, L, id, nome: geo.etichette[id] };
  return iaVaso.nome;
}
function etichettaIn(w) {
  const { R, L } = iaVaso, p = daMondo(R, w);
  if (p.some((v, a) => v < 0 || v >= [R.W, R.H, R.N][a])) return 0;
  return L[(p[2] * R.H + p[1]) * R.W + p[0]];
}
/** sistemi di riferimento lungo la curva che ruotano il meno possibile (trasporto parallelo) */
function riferimentiCurva(curva) {
  const n = curva.length, norm = (v) => { const l = lung(v) || 1; return v.map((x) => x / l); }, out = [];
  let N = null;
  for (let i = 0; i < n; i++) {
    const T = norm(sotto(curva[Math.min(n - 1, i + 1)], curva[Math.max(0, i - 1)]));
    N = norm(N ? sotto(N, T.map((x) => x * punto(N, T))) : croce(T, Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]));
    out.push({ T, A: N, B: croce(T, N) });
  }
  return out;
}
const RAGGI_D = 48;
/** una sezione: raggi del lume e della parete esterna, diametro massimo e quello perpendicolare */
function misuraSezione(c, A, B) {
  const ct = VOL.unita === 'HU', dir = (t) => { const a = t * 2 * Math.PI / RAGGI_D; return [0, 1, 2].map((q) => A[q] * Math.cos(a) + B[q] * Math.sin(a)); };
  let ic = 0, nc = 0;
  for (let t = 0; t < 8; t++) { const D = dir(t * RAGGI_D / 8), v = campiona([0, 1, 2].map((q) => c[q] + D[q] * 0.8)); if (v != null) { ic += v; nc++; } }
  const v0 = campiona(c); if (v0 != null) { ic += v0; nc++; }
  if (!nc) return null;
  ic /= nc; const soglia = ct ? Math.max(100, (ic + 20) / 2) : ic / 2, opac = !ct || ic >= 110;   // TC senza contrasto: il lume non si distingue
  const rl = [], re = [], ia = iaVaso && etichettaIn(c) === iaVaso.id;
  if (!opac && !ia) return null;
  for (let t = 0; t < RAGGI_D; t++) {
    const D = dir(t);
    let r = 0; for (let d = 0.2; d <= 45; d += 0.2) { const v = campiona([0, 1, 2].map((q) => c[q] + D[q] * d)); if (v == null || v < soglia) break; r = d; }
    rl.push(r + 0.1);
    if (ia) { let rr = 0, buchi = 0; for (let d = 0.25; d <= 70; d += 0.25) { if (etichettaIn([0, 1, 2].map((q) => c[q] + D[q] * d)) === iaVaso.id) { rr = d; buchi = 0; } else if (++buchi > 8) break; } re.push(rr + 0.5); }
  }
  // i raggi che escono lungo un ramo (arterie renali, tronco celiaco) non sono il diametro del vaso:
  // limitati a 1,6 volte la mediana della sezione
  // mediana mobile sugli angoli (5 raggi): un raggio isolato che sfugge non fa il diametro
  const taglia = (r0) => { const n = r0.length, r = r0.map((_, t) => [-3, -2, -1, 0, 1, 2, 3].map((d) => r0[(t + d + n) % n]).sort((a, b) => a - b)[3]);
    const m = [...r].sort((a, b) => a - b)[n >> 1]; return r.map((x) => Math.min(x, 1.6 * m)); };
  const rL = opac ? taglia(rl) : null, rE = ia ? taglia(re).map((x, t) => Math.max(x, rL ? rL[t] : 0)) : rL;
  const diam = (r) => { let dmax = 0, tmax = 0; for (let t = 0; t < RAGGI_D / 2; t++) { const d = r[t] + r[t + RAGGI_D / 2]; if (d > dmax) { dmax = d; tmax = t; } }
    const tp = (tmax + RAGGI_D / 4) % RAGGI_D; return { dmax, tmax, dperp: r[tp] + r[(tp + RAGGI_D / 2) % RAGGI_D] }; };
  const e = diam(rE), l = rL ? diam(rL) : { dmax: null };
  let area = 0; for (let t = 0; t < RAGGI_D; t++) area += 0.5 * rE[t] * rE[(t + 1) % RAGGI_D] * Math.sin(2 * Math.PI / RAGGI_D);
  return { rE, rL, ia, opac, dmax: e.dmax, dperp: e.dperp, tmax: e.tmax, dlume: l.dmax, area };
}
/** profilo dei diametri ogni millimetro e punto di diametro massimo (lontano dagli estremi) */
export function diametriVaso() {
  if (!cpr || cpr.punti.length < 2 || !VOL) return { ok: false, motivo: 'servono almeno due punti sul vaso' };
  const curva = curvaCPR(1), rif = riferimentiCurva(curva), n = curva.length, out = [];
  for (let i = 0; i < n; i++) { const m = misuraSezione(curva[i], rif[i].A, rif[i].B); out.push(m ? { s: i, dmax: m.dmax, dperp: m.dperp, dlume: m.dlume, area: m.area, ia: m.ia } : null); }
  const m0 = Math.min(5, Math.floor(n * 0.05)), m1 = n - 1 - m0;
  let max = null;
  // mediana su 9 mm: le origini dei rami (pochi millimetri) non fanno il massimo, un aneurisma sì
  for (let i = Math.max(4, m0); i < Math.min(n - 4, m1 + 1); i++) {
    const w = out.slice(i - 4, i + 5).filter(Boolean); if (w.length < 7) continue;
    const d = [...w.map((x) => x.dmax)].sort((a, b) => a - b)[w.length >> 1];
    if (!max || d > max.d) max = { d, i };
  }
  const val = out.filter(Boolean), med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  const k = Math.max(2, Math.round(val.length * 0.15)), rifP = med(val.slice(0, k).map((x) => x.dmax)), rifD = med(val.slice(-k).map((x) => x.dmax));
  const massimo = max ? { s: max.i, dmax: max.d, dsez: out[max.i].dmax, dperp: out[max.i].dperp, dlume: out[max.i].dlume, area: out[max.i].area } : null;
  const ia = val.filter((x) => x.ia).length > val.length / 2, opac = val.filter((x) => x.dlume != null).length > val.length / 2;
  if (!val.length) return { ok: false, motivo: 'TC senza contrasto e vaso non segmentato: il lume non si distingue' };
  return { ok: true, opac, profilo: out, lunghezza: n - 1, massimo, rifP, rifD, parete: ia ? 'ia' : 'lume', vaso: ia ? iaVaso.nome : null };
}
/** immagine della sezione perpendicolare alla linea centrale a «s» mm dall'inizio, con contorno e diametri */
export function sezioneVaso(s, { campo = 40, passo = 0.25 } = {}) {
  if (!cpr || cpr.punti.length < 2 || !VOL) return null;
  const curva = curvaCPR(1), i = Math.max(0, Math.min(curva.length - 1, Math.round(s))), rif = riferimentiCurva(curva.slice(0, i + 2))[i];
  const c = curva[i], { A, B } = rif, m = misuraSezione(c, A, B);
  const cm = m ? Math.max(campo, Math.max(...m.rE) * 1.35) : campo, lato = Math.round(2 * cm / passo), dati = new Float32Array(lato * lato);
  for (let y = 0; y < lato; y++) for (let x = 0; x < lato; x++) {
    const u = (x - lato / 2) * passo, v = (lato / 2 - y) * passo;
    const val = campiona([0, 1, 2].map((q) => c[q] + A[q] * u + B[q] * v)); dati[y * lato + x] = val == null ? -1024 : val;
  }
  const px = (r, t) => { const a = t * 2 * Math.PI / RAGGI_D; return [lato / 2 + r * Math.cos(a) / passo, lato / 2 - r * Math.sin(a) / passo]; };
  const out = { dati, lato, passo: cm * 2 / lato, s: i, voi: motore.getViewport(VP.assiale).getProperties().voiRange || { lower: -160, upper: 240 } };
  if (m) {
    out.contorno = m.rE.map((r, t) => px(r, t)); out.lume = m.ia && m.rL ? m.rL.map((r, t) => px(r, t)) : null;
    const t0 = m.tmax, tp = (t0 + RAGGI_D / 4) % RAGGI_D;
    out.linee = [{ a: px(m.rE[t0], t0), b: px(m.rE[(t0 + RAGGI_D / 2) % RAGGI_D], t0 + RAGGI_D / 2), mm: m.dmax, tipo: 'max' },
      { a: px(m.rE[tp], tp), b: px(m.rE[(tp + RAGGI_D / 2) % RAGGI_D], tp + RAGGI_D / 2), mm: m.dperp, tipo: 'perp' }];
    out.dmax = m.dmax; out.dperp = m.dperp; out.dlume = m.dlume; out.ia = m.ia;
  }
  return out;
}
/** linea centrale di un vaso della segmentazione IA (non l'aorta, che ha la sua): dagli estremi più lontani */
export function lineaVasoIA({ geo, lab, nome }) {
  if (!motore || !VOL || !cpr) return { ok: false, motivo: 'apri prima lo strumento CPR' };
  const id = +(Object.entries(geo.etichette).find(([, v]) => v === nome)?.[0] || 0); if (!id) return { ok: false, motivo: 'vaso non segmentato in questa serie' };
  const R = ridottaC(), { W, H, N } = R, WH = W * H, L = etichetteC(geo, lab);
  const m = new Uint8Array(W * H * N); let primo = -1, tot = 0;
  for (let p = 0; p < m.length; p++) if (L[p] === id) { m[p] = 1; tot++; if (primo < 0) primo = p; }
  if (tot < 20) return { ok: false, motivo: 'vaso troppo piccolo in questa serie' };
  // componente più grande, poi gli estremi: il voxel più lontano da uno qualsiasi, e il più lontano da quello
  const segno = new Int32Array(m.length), coda = new Int32Array(tot + 1); let gen = 0;
  const visita = (da) => { gen++; let qi = 0, qn = 0, ult = da; segno[da] = gen; coda[qn++] = da;
    while (qi < qn) { const q = coda[qi++], i = q % W, j = ((q / W) | 0) % H, k = (q / WH) | 0; ult = q;
      for (const [r, ok] of [[q - 1, i > 0], [q + 1, i < W - 1], [q - W, j > 0], [q + W, j < H - 1], [q - WH, k > 0], [q + WH, k < N - 1]])
        if (ok && m[r] && segno[r] !== gen) { segno[r] = gen; coda[qn++] = r; } }
    return { ult, n: qn }; };
  let seme = primo, mig = visita(primo);
  if (mig.n < tot * 0.5) {   // la prima componente è piccola: cerca la più grande
    const fatto = new Uint8Array(m.length);
    for (let p = 0; p < m.length; p++) if (m[p] && !fatto[p]) { const v = visita(p); for (let x = 0; x < v.n; x++) fatto[coda[x]] = 1; if (v.n > mig.n) { mig = v; seme = p; } if (mig.n > tot * 0.5) break; }
  }
  const a = visita(seme).ult, b = visita(a).ult;
  const vox = (q) => [q % W, ((q / W) | 0) % H, (q / WH) | 0];
  const via = percorsoNelVaso(R, m, vox(a), vox(b));
  if (!via || via.length < 3) return { ok: false, motivo: 'non trovo un percorso continuo nel vaso' };
  const lisc = via.map((_, i) => { const x = Math.max(0, i - 3), y = Math.min(via.length - 1, i + 3); return [0, 1, 2].map((q) => { let t = 0; for (let k = x; k <= y; k++) t += via[k][q]; return t / (y - x + 1); }); });
  const punti = [lisc[0]]; let acc = 0, tl = 0;
  for (let i = 1; i < lisc.length; i++) { const d = lung(sotto(lisc[i], lisc[i - 1])); acc += d; tl += d; if (acc >= 8) { punti.push(lisc[i]); acc = 0; } }
  if (lung(sotto(punti[punti.length - 1], lisc[lisc.length - 1])) > 0.5) punti.push(lisc[lisc.length - 1]);
  // dall'alto verso il basso (craniale → caudale), come si legge
  if (punti[0][2] < punti[punti.length - 1][2]) punti.reverse();
  cpr.punti = punti; disegnaPuntiCPR(); cpr.suPunti?.(cpr.punti.length);
  return { ok: true, n: punti.length, lunghezza: Math.round(tl) };
}

// ---- CPR: ricostruzione curva lungo una linea centrale indicata con i clic nelle viste MPR
let cpr = null;   // { punti: [mondo], ascoltatori, tele: canvas per vista }
export function modoCPR(attivo, { suPunti } = {}) {
  if (!motore) return;
  const mpr = [VP.assiale, VP.coronale, VP.sagittale];
  if (cpr) { for (const [el, tipo, f] of cpr.ascoltatori) el.removeEventListener(tipo, f); for (const c of cpr.tele) c.remove(); }
  if (!attivo) { cpr = null; strumento(strumentoAttivo); motore.render(); return; }
  cpr = { punti: [], ascoltatori: [], tele: [], suPunti };
  const g = ToolGroupManager.getToolGroup(ID_GRUPPO_MPR);
  for (const t of [CrosshairsTool.toolName, WindowLevelTool.toolName, ...MISURE()]) try { g.setToolPassive(t); } catch {}
  for (const id of mpr) {
    const vp = motore.getViewport(id), el = vp.element;
    const tela = document.createElement('canvas'); tela.className = 'cpr-tela';
    Object.assign(tela.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 5 });
    el.appendChild(tela); cpr.tele.push(tela);
    let giu = null;
    const down = (e) => { if (e.button === 0) giu = [e.clientX, e.clientY]; };
    const up = (e) => {
      if (e.button !== 0 || !giu || Math.hypot(e.clientX - giu[0], e.clientY - giu[1]) > 4) { giu = null; return; }
      giu = null; const r = el.getBoundingClientRect();
      const w = vp.canvasToWorld([e.clientX - r.left, e.clientY - r.top]);
      cpr.punti.push(w); disegnaPuntiCPR(); cpr.suPunti?.(cpr.punti.length);
    };
    el.addEventListener('mousedown', down); el.addEventListener('mouseup', up);
    cpr.ascoltatori.push([el, 'mousedown', down], [el, 'mouseup', up]);
    const ridisegna = () => disegnaPuntiCPR();
    el.addEventListener(Enums.Events.IMAGE_RENDERED, ridisegna);
    cpr.ascoltatori.push([el, Enums.Events.IMAGE_RENDERED, ridisegna]);
  }
  disegnaPuntiCPR();
}
export function centroMirino() {
  try { const c = ToolGroupManager.getToolGroup(ID_GRUPPO_MPR)?.getToolInstance(CrosshairsTool.toolName)?.toolCenter; if (c) return [...c]; } catch {}
  try { return [...motore.getViewport(VP.assiale).getCamera().focalPoint]; } catch { return null; }
}
// linea centrale dell'aorta dalla segmentazione IA: fetta per fetta (dal basso verso l'alto) il baricentro della sezione
// dell'aorta più vicina alla precedente; ci si ferma all'arco (sezione molto più grande della mediana o salto > 15 mm).
// I punti, uno ogni ~10 mm, diventano i punti della CPR (poi si correggono come quelli cliccati a mano).
export function lineaAortaIA({ geo, lab }) {
  if (!motore || !VOL || !cpr) return { ok: false, motivo: 'apri prima lo strumento CPR' };
  const R = ridottaC(), { W, H, N } = R, WH = W * H, L = etichetteC(geo, lab);
  const id = Object.entries(geo.etichette).find(([, v]) => v === 'aorta')?.[0]; if (!id) return { ok: false, motivo: 'aorta non segmentata in questa serie' };
  const k = +id, zk = (q) => aMondo(R, 0, 0, q)[2];
  const fette = [...Array(N).keys()].sort((a, b) => zk(a) - zk(b));   // dal basso (caudale) all'alto
  const sezioni = (q) => {   // componenti connesse (4-connessione) dell'aorta nella fetta q
    const vis = new Uint8Array(WH), out = [];
    for (let p = 0; p < WH; p++) { if (vis[p] || L[q * WH + p] !== k) continue;
      const pila = [p]; vis[p] = 1; let n = 0, sx = 0, sy = 0;
      while (pila.length) { const c = pila.pop(), i = c % W, j = (c / W) | 0; n++; sx += i; sy += j;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const cc = jj * W + ii; if (!vis[cc] && L[q * WH + cc] === k) { vis[cc] = 1; pila.push(cc); } } }
      if (n >= 4) out.push({ n, w: aMondo(R, sx / n, sy / n, q) }); }
    return out;
  };
  const centri = []; let prec = null; const aree = [];
  for (const q of fette) {
    const s = sezioni(q); if (!s.length) { if (prec) break; continue; }
    let c = prec ? s.map((x) => ({ ...x, d: lung(sotto(x.w, prec.w)) })).sort((a, b) => a.d - b.d)[0] : s.sort((a, b) => b.n - a.n)[0];
    if (prec && c.d > 15) break;
    const med = aree.length >= 5 ? [...aree].sort((a, b) => a - b)[aree.length >> 1] : null;
    if (med && c.n > 2.5 * med) break;            // arco aortico: le sezioni si fondono
    centri.push(c.w); aree.push(c.n); prec = c;
  }
  if (centri.length < 3) return { ok: false, motivo: 'aorta troppo corta in questa serie' };
  const punti = [centri[0]]; let acc = 0;
  for (let i = 1; i < centri.length; i++) { acc += lung(sotto(centri[i], centri[i - 1])); if (acc >= 10) { punti.push(centri[i]); acc = 0; } }
  if (punti[punti.length - 1] !== centri[centri.length - 1]) punti.push(centri[centri.length - 1]);
  cpr.punti = punti.reverse(); disegnaPuntiCPR(); cpr.suPunti?.(cpr.punti.length);
  return { ok: true, n: cpr.punti.length, lunghezza: Math.round(centri.slice(1).reduce((t, w, i) => t + lung(sotto(w, centri[i])), 0)) };
}
export function annullaPuntoCPR() { if (cpr?.punti.length) { cpr.punti.pop(); disegnaPuntiCPR(); cpr.suPunti?.(cpr.punti.length); } }
function disegnaPuntiCPR() {
  if (!cpr || !motore) return;
  [VP.assiale, VP.coronale, VP.sagittale].forEach((id, n) => {
    const vp = motore.getViewport(id), tela = cpr.tele[n]; if (!vp || !tela) return;
    const r = vp.element.getBoundingClientRect(); tela.width = r.width; tela.height = r.height;
    const cx = tela.getContext('2d'), cam = vp.getCamera(), nrm = cam.viewPlaneNormal, fp = cam.focalPoint;
    const pts = cpr.punti.map((w) => ({ c: vp.worldToCanvas(w), d: Math.abs(punto(sotto(w, fp), nrm)) }));
    cx.strokeStyle = 'rgba(255,220,60,.8)'; cx.lineWidth = 1.5; cx.beginPath();
    pts.forEach((p, i) => (i ? cx.lineTo(p.c[0], p.c[1]) : cx.moveTo(p.c[0], p.c[1]))); if (pts.length > 1) cx.stroke();
    for (const p of pts) { cx.fillStyle = p.d < 3 ? '#ffd23c' : 'rgba(255,210,60,.35)'; cx.beginPath(); cx.arc(p.c[0], p.c[1], p.d < 3 ? 4 : 3, 0, 7); cx.fill(); }
  });
}
function campiona(w) {           // trilineare nel volume, coordinate del mondo
  const { dati, dim, sp, origine, assi } = VOL, d = sotto(w, origine);
  const x = punto(d, assi[0]) / sp[0], y = punto(d, assi[1]) / sp[1], z = punto(d, assi[2]) / sp[2];
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  if (i < 0 || j < 0 || k < 0 || i >= dim[0] - 1 || j >= dim[1] - 1 || k >= dim[2] - 1) return null;
  const fx = x - i, fy = y - j, fz = z - k, W = dim[0], WH = dim[0] * dim[1], b = k * WH + j * W + i;
  const l = (a, c, t) => a + (c - a) * t;
  return l(l(l(dati[b], dati[b + 1], fx), l(dati[b + W], dati[b + W + 1], fx), fy), l(l(dati[b + WH], dati[b + WH + 1], fx), l(dati[b + WH + W], dati[b + WH + W + 1], fx), fy), fz);
}
/** linea centrale: Catmull-Rom tra i punti, poi ricampionata ogni «passo» mm lungo la curva */
function curvaCPR(passo) {
  const P = cpr.punti;
  const fitti = [];
  for (let s = 0; s < P.length - 1; s++) {
    const p0 = P[Math.max(0, s - 1)], p1 = P[s], p2 = P[s + 1], p3 = P[Math.min(P.length - 1, s + 2)];
    const seg = Math.max(2, Math.ceil(lung(sotto(p2, p1)) / 0.25));
    for (let t = 0; t < seg; t++) { const u = t / seg, u2 = u * u, u3 = u2 * u;
      fitti.push([0, 1, 2].map((q) => 0.5 * (2 * p1[q] + (-p0[q] + p2[q]) * u + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * u2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * u3))); }
  }
  fitti.push(P[P.length - 1]);
  // ricampionamento esatto per lunghezza d'arco (un punto ogni «passo» mm)
  const curva = [fitti[0]]; let prossimo = passo, fatto = 0;
  for (let i = 1; i < fitti.length; i++) {
    const a = fitti[i - 1], b = fitti[i], l = lung(sotto(b, a));
    while (l > 0 && fatto + l >= prossimo) { const t = (prossimo - fatto) / l; curva.push([0, 1, 2].map((q) => a[q] + (b[q] - a[q]) * t)); prossimo += passo; }
    fatto += l;
  }
  return curva;
}
/** CPR stirata: righe lungo la curva (passo 0,5 mm), colonne di traverso (±larghezza/2), ruotata di «angolo» */
export function calcolaCPR({ angolo = 0, larghezza = 80, passo = 0.5 } = {}) {
  if (!cpr || cpr.punti.length < 2 || !VOL) return null;
  const curva = curvaCPR(passo);
  const n = curva.length, cols = Math.round(larghezza / passo), out = new Float32Array(n * cols);
  // sistema di riferimento che ruota il meno possibile lungo la curva (trasporto parallelo)
  const norm = (v) => { const l = lung(v) || 1; return v.map((x) => x / l); };
  let T = norm(sotto(curva[Math.min(1, n - 1)], curva[0]));
  let N = croce(T, Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]); N = norm(N);
  for (let i = 0; i < n; i++) {
    const Tn = norm(sotto(curva[Math.min(n - 1, i + 1)], curva[Math.max(0, i - 1)]));
    // trasporto: togli da N la componente lungo la nuova tangente
    N = norm(sotto(N, Tn.map((x) => x * punto(N, Tn)))); T = Tn;
    const B = croce(T, N), a = angolo * Math.PI / 180, D = [0, 1, 2].map((q) => N[q] * Math.cos(a) + B[q] * Math.sin(a));
    for (let c = 0; c < cols; c++) { const o = (c - cols / 2) * passo; const v = campiona([0, 1, 2].map((q) => curva[i][q] + D[q] * o)); out[i * cols + c] = v == null ? -1024 : v; }
  }
  const vp = motore.getViewport(VP.assiale), voi = vp.getProperties().voiRange || { lower: -160, upper: 240 };
  return { dati: out, larghezza: cols, altezza: n, lunghezza: (n - 1) * passo, passo, voi };
}
export { csUtils };
/** Solo per diagnosi: stato delle viste */
export function _diagnosi() {
  if (!motore) return null;
  const out = {};
  for (const [nome, id] of Object.entries(VP)) {
    const vp = motore.getViewport(id);
    const cam = vp.getCamera();
    out[nome] = { tipo: vp.type, fuoco: cam.focalPoint?.map((x) => +x.toFixed(1)), normale: cam.viewPlaneNormal?.map((x) => +x.toFixed(2)),
      imageId: vp.getCurrentImageId?.(), slab: vp.getSlabThickness?.(), actors: vp.getActors?.().length };
  }
  const vol = cache.getVolume(idVolume);
  out.volume = { dim: vol?.dimensions, spacing: vol?.spacing, origin: vol?.origin, direction: vol?.direction,
    campione: (() => { try { const vm = vol.voxelManager; const [x, y, z] = vol.dimensions; return [vm.getAtIJK(x/2|0, y/2|0, 0), vm.getAtIJK(x/2|0, y/2|0, z/2|0), vm.getAtIJK(x/2|0, y/2|0, z-1)]; } catch (e) { return String(e); } })() };
  return out;
}
// piano della misura dalla normale della vista: assiale, coronale, sagittale oppure obliquo
function pianoDa(n) {
  if (!n) return '';
  const a = n.map(Math.abs), i = a.indexOf(Math.max(...a));
  return a[i] < 0.95 ? 'obliquo' : ['sagittale', 'coronale', 'assiale'][i];
}
/** Solo per i test: misure presenti con statistiche 2D e 3D */
export function _misure() {
  return annotazioni.state.getAllAnnotations().filter((a) => MISURE().includes(a.metadata?.toolName)).map((a) => ({ tool: a.metadata.toolName,
    stats: Object.values(a.data.cachedStats || {})[0], vp: pianoDa(a.metadata?.viewPlaneNormal), uid: a.annotationUID, st3d: a.metadata.toolName === EllipticalROITool.toolName ? statistiche3D(a.data.handles.points) : null,
    punti: a.data.handles.points }));
}
/** Solo per i test: testi delle misure (posizione nel mondo e se spostati) e scala delle viste */
export const _testi = () => annotazioni.state.getAllAnnotations().filter((a) => MISURE().includes(a.metadata?.toolName)).map((a) => ({ tool: a.metadata.toolName, tb: a.data.handles.textBox?.worldPosition ? [...a.data.handles.textBox.worldPosition] : null, mosso: !!a.data.handles.textBox?.hasMoved }));
export const _scala = (q = 'assiale') => motore?.getViewport(VP[q])?.getCamera()?.parallelScale ?? null;
/** misure fatte nell'MPR (per portarle nel referto) */
export const elencoMisure = () => _misure();
export function _stato() {
  const g = ToolGroupManager.getToolGroup(ID_GRUPPO_MPR);
  const vp = motore?.getViewport(VP.assiale);
  return { opzioni: Object.fromEntries(Object.entries(g?.toolOptions || {}).map(([k, v]) => [k, v.mode])), annotazioni: annotazioni.state.getAllAnnotations().map((a) => a.metadata?.toolName), voi: vp?.getProperties?.().voiRange, fuoco: vp?.getCamera().focalPoint };
}
export function _fusione(qualeVp = 'assiale') {
  const vp = motore?.getViewport(VP[qualeVp]); if (!vp) return null;
  const vol = idPet ? cache.getVolume(idPet) : null;
  return { idPet, actors: vp.getActors().map((a) => { const pr = a.actor.getProperty(); return { uid: a.uid, rgb: pr.getRGBTransferFunction(0)?.getRange(), col: (() => { const f = pr.getRGBTransferFunction(0), r = f?.getRange(); if (!r) return null; const c = []; f.getColor(r[0] + (r[1] - r[0]) * 0.3, c); return c.map((x) => +x.toFixed(2)); })(), op: pr.getScalarOpacity(0)?.getRange(), opv: [0, 1, 3, 6].map((v) => pr.getScalarOpacity(0)?.getValue(v)), vis: a.actor.getVisibility(), ref: a.referencedId, ud: pr.getScalarOpacityUnitDistance(0), sd: a.actor.getMapper().getSampleDistance?.(), cls: a.actor.getMapper().getClassName?.() }; }),
    pet: vol && { dim: vol.dimensions, sp: vol.spacing, or: vol.origin, dir: vol.direction, c: (() => { const vm = vol.voxelManager; const [x, y, z] = vol.dimensions; return [vm.getAtIJK(x / 2 | 0, y / 2 | 0, z / 2 | 0), vm.getAtIJK(x / 2 | 0, y / 2.5 | 0, z / 2 | 0)]; })() } };
}
/** unità dei valori del volume: 'HU' per la TC */
export const unita = () => VOL?.unita || '';

/** Porta i tre piani MPR (e quindi il mirino) sul punto del mondo w = [x, y, z] (LPS, mm):
 *  usato dalla seconda lettura dei noduli («vai al nodulo»). */
export function vaiAlPunto(w) {
  if (!motore || !Array.isArray(w) || w.length !== 3) return false;
  let ok = false;
  for (const nome of ['assiale', 'coronale', 'sagittale']) {
    // sposta il piano lungo la sua normale fino a passare per w (stesso ingrandimento e inquadratura)
    try {
      const vp = motore.getViewport(VP[nome]); if (!vp) continue;
      const cam = vp.getCamera(), n = cam.viewPlaneNormal, fp = cam.focalPoint, pos = cam.position;
      const d = (w[0] - fp[0]) * n[0] + (w[1] - fp[1]) * n[1] + (w[2] - fp[2]) * n[2];
      vp.setCamera({ focalPoint: fp.map((v, i) => v + d * n[i]), position: pos.map((v, i) => v + d * n[i]) });
      vp.render(); ok = true;
    } catch {}
  }
  try { const c = ToolGroupManager.getToolGroup(ID_GRUPPO_MPR)?.getToolInstance(CrosshairsTool.toolName); if (c) c.toolCenter = [...w]; } catch {}
  try { motore.render(); } catch {}
  return ok;
}
