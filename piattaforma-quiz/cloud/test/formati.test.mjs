// Formati DICOM rari letti dal visualizzatore (web/decodifica.js). Sintassi «deflate» (1.2.840.10008.1.2.1.99): un file
// TC vero viene compresso con deflate come farebbe un apparecchio; il visualizzatore deve decomprimerlo e dare gli stessi
// pixel e la stessa intestazione dell'originale. I file non deflate restano identici (stesso oggetto).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { createRequire } from 'node:module'; import { fileURLToPath, pathToFileURL } from 'node:url';
const QUI = path.dirname(fileURLToPath(import.meta.url)), WEB = path.join(QUI, '../web');
const m = { exports: {} };
new Function('module', 'exports', 'require', fs.readFileSync(path.join(WEB, 'lib/dicomParser.min.js'), 'utf8'))(m, m.exports, createRequire(import.meta.url));
globalThis.dicomParser = m.exports;
const D = await import(pathToFileURL(path.join(WEB, 'decodifica.js')).href);

// un DICOM piccolo ma vero, costruito qui: intestazione del file + dati in Explicit VR Little Endian, immagine 16×16
function dicomDiProva() {
  const el = (g, e, vr, val) => {
    const lungo = ['OB', 'OW', 'SQ', 'UN', 'UT'].includes(vr), v = val.length % 2 ? Buffer.concat([val, Buffer.from(vr === 'UI' ? [0] : [0x20])]) : val;
    const h = Buffer.alloc(lungo ? 12 : 8); h.writeUInt16LE(g, 0); h.writeUInt16LE(e, 2); h.write(vr, 4, 'latin1');
    if (lungo) h.writeUInt32LE(v.length, 8); else h.writeUInt16LE(v.length, 6);
    return Buffer.concat([h, v]);
  };
  const s = (t) => Buffer.from(t, 'latin1'), us = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
  const pix = Buffer.alloc(16 * 16 * 2); for (let i = 0; i < 256; i++) pix.writeInt16LE((i * 37) % 2000 - 1000, i * 2);
  const meta = (ts) => { const corpo = Buffer.concat([el(2, 1, 'OB', Buffer.from([0, 1])), el(2, 2, 'UI', s('1.2.840.10008.5.1.4.1.1.2')), el(2, 3, 'UI', s('1.2.3.4.5')), el(2, 0x10, 'UI', s(ts))]);
    const gl = Buffer.alloc(4); gl.writeUInt32LE(corpo.length); return Buffer.concat([el(2, 0, 'UL', gl), corpo]); };
  const dati = Buffer.concat([el(8, 0x16, 'UI', s('1.2.840.10008.5.1.4.1.1.2')), el(8, 0x60, 'CS', s('CT')), el(0x20, 0x0e, 'UI', s('1.2.3.4.6')),
    el(0x28, 2, 'US', us(1)), el(0x28, 4, 'CS', s('MONOCHROME2')), el(0x28, 0x10, 'US', us(16)), el(0x28, 0x11, 'US', us(16)),
    el(0x28, 0x100, 'US', us(16)), el(0x28, 0x101, 'US', us(12)), el(0x28, 0x102, 'US', us(11)), el(0x28, 0x103, 'US', us(1)),
    el(0x28, 0x1052, 'DS', s('-1024')), el(0x28, 0x1053, 'DS', s('1')), el(0x7fe0, 0x10, 'OW', pix)]);
  const pre = Buffer.concat([Buffer.alloc(128), s('DICM')]);
  return { normale: Buffer.concat([pre, meta('1.2.840.10008.1.2.1'), dati]), deflate: Buffer.concat([pre, meta('1.2.840.10008.1.2.1.99'), zlib.deflateRawSync(dati)]) };
}
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.length);

test('deflate: decompresso e letto come il file originale (intestazione e pixel)', async () => {
  const { normale, deflate } = dicomDiProva();
  assert.ok(deflate.length < normale.length, 'il file di prova è davvero compresso');
  const sg = await D.sgonfiaDeflate(ab(deflate));
  const ds = dicomParser.parseDicom(new Uint8Array(sg));
  assert.equal(ds.string('x00020010'), '1.2.840.10008.1.2.1');
  assert.equal(ds.string('x00080060'), 'CT');
  const a = D.decodificaDicom(ab(normale)), b = D.decodificaDicom(sg);
  assert.equal(b.cols, 16); assert.equal(b.rows, 16);
  assert.deepEqual([...b.pix], [...a.pix]);
});

test('file non deflate: restituiti tali e quali, senza copie', async () => {
  const { normale } = dicomDiProva(), x = ab(normale);
  assert.equal(await D.sgonfiaDeflate(x), x);
  const nonDicom = new ArrayBuffer(300); assert.equal(await D.sgonfiaDeflate(nonDicom), nonDicom);
});
