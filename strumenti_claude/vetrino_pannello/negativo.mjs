import fs from 'node:fs'; const M = await import('/Volumes/Caloggero/piattaforma-quiz/cloud/web/vetrino-tiff.js');
const lettore = (fd) => async (o, n) => { const b = Buffer.alloc(n); const k = fs.readSync(fd, b, 0, n, o); return new Uint8Array(b.buffer, b.byteOffset, k); };
for (const f of process.argv.slice(2)) { const fd = fs.openSync(f, 'r'); const p = await M.problemi(lettore(fd)); console.log(f.split('/').pop(), '→', p.length, 'problemi:', p.slice(0, 4).join(' | ')); }
