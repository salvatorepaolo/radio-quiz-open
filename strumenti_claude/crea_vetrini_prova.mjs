// crea_vetrini_prova.mjs: vetrini DICOM sintetici (nessun paziente) per provare in prova_vetrini.mjs ciò che i vetrini
// pubblici di prova non hanno: fluorescenza a 3 canali con 3 piani focali (TILED_FULL), campo chiaro con 2 piani focali in
// TILED_SPARSE (posizioni e Z per fotogramma), etichetta e panoramica. Tessere non compresse. Cartella: ~/rq-vetrini/sintetici
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const D = path.join(os.homedir(), 'rq-vetrini/sintetici'); fs.mkdirSync(D, { recursive: true });
const s = (t) => Buffer.from(t, 'latin1'), us = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }, ul = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }, sl = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const pari = (v, vr) => (v.length % 2 ? Buffer.concat([v, Buffer.from([vr === 'UI' || vr === 'OB' ? 0 : 0x20])]) : v);
const el = (g, e, vr, val) => { const v = pari(val, vr), lungo = ['OB', 'OW', 'SQ', 'UN', 'UT', 'UC'].includes(vr), h = Buffer.alloc(lungo ? 12 : 8); h.writeUInt16LE(g, 0); h.writeUInt16LE(e, 2); h.write(vr, 4, 'latin1'); if (lungo) h.writeUInt32LE(v.length, 8); else h.writeUInt16LE(v.length, 6); return Buffer.concat([h, v]); };
const sq = (g, e, items) => { const corpo = Buffer.concat(items.map((it) => { const h = Buffer.alloc(8); h.writeUInt16LE(0xfffe, 0); h.writeUInt16LE(0xe000, 2); h.writeUInt32LE(it.length, 4); return Buffer.concat([h, it]); })); const h = Buffer.alloc(12); h.writeUInt16LE(g, 0); h.writeUInt16LE(e, 2); h.write('SQ', 4, 'latin1'); h.writeUInt32LE(corpo.length, 8); return Buffer.concat([h, corpo]); };
const SOP = '1.2.840.10008.5.1.4.1.1.77.1.6', serieUID = (k) => `2.25.9${k}${Date.now() % 1e9}`;
let uidN = 0;
function scrivi(nome, { serie, tipo, W, H, T = 256, spp, foto, cammini, nz = 1, sparse = null, frames, spMm = 0.0005 }) {
  const corpoMeta = Buffer.concat([el(2, 1, 'OB', Buffer.from([0, 1])), el(2, 2, 'UI', s(SOP)), el(2, 3, 'UI', s(`2.25.7${++uidN}${Date.now() % 1e9}`)), el(2, 0x10, 'UI', s('1.2.840.10008.1.2.1'))]);
  const meta = Buffer.concat([el(2, 0, 'UL', ul(corpoMeta.length)), corpoMeta]);
  const shared = Buffer.concat([sq(0x0028, 0x9110, [Buffer.concat([el(0x18, 0x50, 'DS', s('0.001')), el(0x18, 0x88, 'DS', s('0.002')), el(0x28, 0x30, 'DS', s(`${spMm}\\${spMm}`))])]),
    ...(cammini.length === 1 ? [sq(0x48, 0x207, [el(0x48, 0x106, 'SH', s(cammini[0].id))])] : [])]);
  const perFrame = sparse ? sq(0x5200, 0x9230, sparse.map((p) => Buffer.concat([sq(0x48, 0x21a, [Buffer.concat([el(0x40, 0x74a, 'DS', s(String(p[2]))), el(0x48, 0x21e, 'SL', sl(p[0] + 1)), el(0x48, 0x21f, 'SL', sl(p[1] + 1))])]), sq(0x48, 0x207, [el(0x48, 0x106, 'SH', s(p[3]))])]))) : Buffer.alloc(0);
  const pix = Buffer.concat(frames), hp = Buffer.alloc(12); hp.writeUInt16LE(0x7fe0, 0); hp.writeUInt16LE(0x10, 2); hp.write('OB', 4, 'latin1'); hp.writeUInt32LE(pix.length + (pix.length % 2), 8);
  // elementi in ordine di tag
  const ds = Buffer.concat([
    el(8, 8, 'CS', s(`DERIVED\\PRIMARY\\${tipo}\\NONE`)), el(8, 0x16, 'UI', s(SOP)), el(8, 0x18, 'UI', s(`2.25.8${uidN}${Date.now() % 1e9}`)), el(8, 0x60, 'CS', s('SM')), el(8, 0x103e, 'LO', s('Vetrino sintetico di prova')),
    el(0x10, 0x10, 'PN', s('PROVA')), el(0x20, 0x0d, 'UI', s('2.25.555')), el(0x20, 0x0e, 'UI', s(serie)), el(0x20, 0x9311, 'CS', s(sparse ? 'TILED_SPARSE' : 'TILED_FULL')),
    el(0x28, 2, 'US', us(spp)), el(0x28, 4, 'CS', s(foto)), ...(spp === 3 ? [el(0x28, 6, 'US', us(0))] : []), el(0x28, 8, 'IS', s(String(frames.length))), el(0x28, 0x10, 'US', us(T)), el(0x28, 0x11, 'US', us(T)),
    el(0x28, 0x100, 'US', us(8)), el(0x28, 0x101, 'US', us(8)), el(0x28, 0x102, 'US', us(7)), el(0x28, 0x103, 'US', us(0)),
    el(0x48, 1, 'FL', (() => { const b = Buffer.alloc(4); b.writeFloatLE(W * spMm); return b; })()), el(0x48, 6, 'UL', ul(W)), el(0x48, 7, 'UL', ul(H)),
    sq(0x48, 0x105, cammini.map((c) => Buffer.concat([el(0x22, 0x55, 'FL', (() => { const b = Buffer.alloc(4); b.writeFloatLE(c.onda || 0); return b; })()), el(0x48, 0x106, 'SH', s(c.id)), el(0x48, 0x107, 'ST', s(c.nome))]))),
    el(0x48, 0x302, 'UL', ul(cammini.length)), el(0x48, 0x303, 'UL', ul(nz)),
    sq(0x5200, 0x9229, [shared]), perFrame, hp, pix, pix.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)]);
  fs.writeFileSync(path.join(D, nome), Buffer.concat([Buffer.alloc(128), s('DICM'), meta, ds]));
}
// tessera T×T: funzione (x, y) → valori
const tessera = (T, f, spp) => { const b = Buffer.alloc(T * T * spp); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = f(x, y); if (spp === 1) b[y * T + x] = v; else { b[(y * T + x) * 3] = v[0]; b[(y * T + x) * 3 + 1] = v[1]; b[(y * T + x) * 3 + 2] = v[2]; } } return b; };
// A. fluorescenza: 3 canali × 3 piani, livelli 1024 e 256 (TILED_FULL: colonna, riga, piano, canale)
const canali = [{ id: '1', nome: 'DAPI', onda: 461 }, { id: '2', nome: 'FITC', onda: 519 }, { id: '3', nome: 'Cy5', onda: 670 }];
const centri = [[300, 300], [700, 400], [500, 750]], sA = serieUID(1);
for (const [W, nome] of [[1024, 'fluo_l0.dcm'], [256, 'fluo_l1.dcm']]) {
  const sc = 1024 / W, n = Math.ceil(W / 256), frames = [];
  for (let c = 0; c < 3; c++) for (let z = 0; z < 3; z++) for (let r = 0; r < n; r++) for (let q = 0; q < n; q++)
    frames.push(tessera(256, (x, y) => { const X = (q * 256 + x) * sc, Y = (r * 256 + y) * sc, d = Math.hypot(X - centri[c][0], Y - centri[c][1]); const raggio = 120 + z * 60; return d < raggio ? 200 - z * 60 : 10; }, 1));
  scrivi(nome, { serie: sA, tipo: 'VOLUME', W, H: W, spp: 1, foto: 'MONOCHROME2', cammini: canali, nz: 3, frames });
}
// B. campo chiaro RGB, 2 piani focali, TILED_SPARSE (solo le tessere con tessuto), 512×512; più etichetta e panoramica
const sB = serieUID(2), posizioni = [], framesB = [];
for (const z of [0, 2]) for (const [q, r] of [[0, 0], [1, 0], [1, 1]]) { posizioni.push([q * 256, r * 256, z, '1']); framesB.push(tessera(256, (x, y) => (z === 0 ? [230, 120 + ((x >> 4) % 2) * 60, 180] : [120, 60, 160]), 3)); }
scrivi('rgb_sparse.dcm', { serie: sB, tipo: 'VOLUME', W: 512, H: 512, spp: 3, foto: 'RGB', cammini: [{ id: '1', nome: 'campo chiaro' }], nz: 2, sparse: posizioni, frames: framesB });
scrivi('rgb_etichetta.dcm', { serie: sB, tipo: 'LABEL', W: 256, H: 256, spp: 3, foto: 'RGB', cammini: [{ id: '1', nome: 'campo chiaro' }], frames: [tessera(256, (x, y) => (x > 40 && x < 216 && y > 100 && y < 140 ? [0, 0, 0] : [255, 255, 255]), 3)] });
scrivi('rgb_panoramica.dcm', { serie: sB, tipo: 'OVERVIEW', W: 256, H: 256, spp: 3, foto: 'RGB', cammini: [{ id: '1', nome: 'campo chiaro' }], frames: [tessera(256, (x, y) => [200, 200, 230], 3)] });
console.log('vetrini sintetici in', D, fs.readdirSync(D).join(', '));
