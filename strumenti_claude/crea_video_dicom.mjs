// crea_video_dicom.mjs: due video DICOM di prova (immagine di prova di ffmpeg, nessun paziente) per prova_video.mjs:
// HEVC (1.2.840.10008.1.2.4.107) e H.264 (1.2.840.10008.1.2.4.102), 40 fotogrammi 256×256.
// Prima: ffmpeg -f lavfi -i testsrc=size=256x256:rate=25 -frames:v 40 -c:v libx265 -f hevc video_prova/prova.hevc (e libx264 → prova.h264)
import fs from 'node:fs'; import path from 'node:path';
const D = path.join(path.dirname(new URL(import.meta.url).pathname), 'video_prova');
const el = (g, e, vr, val) => { const lungo = ['OB', 'OW', 'SQ', 'UN', 'UT'].includes(vr), v = val.length % 2 ? Buffer.concat([val, Buffer.from([vr === 'UI' ? 0 : 0x20])]) : val;
  const h = Buffer.alloc(lungo ? 12 : 8); h.writeUInt16LE(g, 0); h.writeUInt16LE(e, 2); h.write(vr, 4, 'latin1'); if (lungo) h.writeUInt32LE(v.length, 8); else h.writeUInt16LE(v.length, 6); return Buffer.concat([h, v]); };
const s = (t) => Buffer.from(t, 'latin1'), us = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const item = (g, e, dati) => { const h = Buffer.alloc(8); h.writeUInt16LE(g, 0); h.writeUInt16LE(e, 2); h.writeUInt32LE(dati.length, 4); return Buffer.concat([h, dati]); };
for (const [nome, ts, file] of [['prova_hevc.dcm', '1.2.840.10008.1.2.4.107', 'prova.hevc'], ['prova_h264.dcm', '1.2.840.10008.1.2.4.102', 'prova.h264']]) {
  let flusso = fs.readFileSync(path.join(D, file)); if (flusso.length % 2) flusso = Buffer.concat([flusso, Buffer.from([0])]);
  const corpo = Buffer.concat([el(2, 1, 'OB', Buffer.from([0, 1])), el(2, 2, 'UI', s('1.2.840.10008.5.1.4.1.1.77.1.4.1')), el(2, 3, 'UI', s('2.25.' + Date.now())), el(2, 0x10, 'UI', s(ts))]);
  const gl = Buffer.alloc(4); gl.writeUInt32LE(corpo.length);
  const pix = Buffer.alloc(12); pix.writeUInt16LE(0x7fe0, 0); pix.writeUInt16LE(0x0010, 2); pix.write('OB', 4, 'latin1'); pix.writeUInt32LE(0xffffffff, 8);
  const dati = Buffer.concat([el(8, 0x16, 'UI', s('1.2.840.10008.5.1.4.1.1.77.1.4.1')), el(8, 0x18, 'UI', s('2.25.' + (Date.now() + 1))), el(8, 0x60, 'CS', s('ES')),
    el(0x20, 0x0d, 'UI', s('2.25.11')), el(0x20, 0x0e, 'UI', s('2.25.' + (nome.length * 7))), el(0x20, 0x13, 'IS', s('1')),
    el(0x28, 2, 'US', us(3)), el(0x28, 4, 'CS', s('YBR_PARTIAL_420')), el(0x28, 6, 'US', us(0)), el(0x28, 8, 'IS', s('40')), el(0x28, 0x10, 'US', us(256)), el(0x28, 0x11, 'US', us(256)),
    el(0x28, 0x100, 'US', us(8)), el(0x28, 0x101, 'US', us(8)), el(0x28, 0x102, 'US', us(7)), el(0x28, 0x103, 'US', us(0)), el(0x18, 0x1063, 'DS', s('40')),
    pix, item(0xfffe, 0xe000, Buffer.alloc(0)), item(0xfffe, 0xe000, flusso), item(0xfffe, 0xe0dd, Buffer.alloc(0))]);
  fs.writeFileSync(path.join(D, nome), Buffer.concat([Buffer.alloc(128), s('DICM'), el(2, 0, 'UL', gl), corpo, dati]));
  console.log(nome, flusso.length, 'byte di video');
}
