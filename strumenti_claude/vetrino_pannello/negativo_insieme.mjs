import fs from 'node:fs'; import path from 'node:path';
const M = await import('/Volumes/Caloggero/piattaforma-quiz/cloud/web/vetrino-tiff.js');
const D = '/Volumes/Caloggero/vetrini_formati_prova';
const apriDa = (mappa) => async (r) => { const p = mappa(r); const fd = fs.openSync(p, 'r'), size = fs.fstatSync(fd).size; return { size, leggi: async (o, n) => { const b = Buffer.alloc(Math.max(0, Math.min(n, size - o))); fs.readSync(fd, b, 0, b.length, o); return new Uint8Array(b.buffer, b.byteOffset, b.length); } }; };
for (const [nome, principale, mappa] of [
  ['MRXS originale', 'vetrino.mrxs', (r) => r === 'vetrino.mrxs' ? `${D}/Mirax/CMU-1-Saved-1_16.mrxs` : `${D}/Mirax/CMU-1-Saved-1_16/${r.slice(8)}`],
  ['CZI originale', 'vetrino.czi', () => `${D}/Zeiss/Zeiss-5-SlidePreview-JXR.czi`],
  ['iSyntax originale', 'vetrino.isyntax', () => `${D}/Philips-iSyntax/testslide.isyntax`],
  ['VSI originale', 'vetrino.vsi', () => `${D}/Olympus/OS-2.vsi`]]) {
  const p = await M.problemiInsieme(principale, apriDa(mappa)); console.log(nome, '→', p.length, 'problemi:', p.slice(0, 3).join(' | '));
}
