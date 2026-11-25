// confronta_python.mjs (1.326): web/vetrino-tiff.js (pulizia nel browser) contro strumenti/prepara_vetrino.py (Mac) sugli
// stessi vetrini di prova: le due copie pulite devono essere identiche byte per byte, e il controllo JS deve dire «nulla».
// Uso: node confronta_python.mjs <file.svs|.tif…>…
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import crypto from 'node:crypto';
const M = await import('/Volumes/Caloggero/piattaforma-quiz/cloud/web/vetrino-tiff.js');
const PY = '/Volumes/Caloggero/piattaforma-quiz/strumenti/.venv/bin/python', STR = '/Volumes/Caloggero/piattaforma-quiz/strumenti';
const lettore = (fd) => async (o, n) => { const b = Buffer.alloc(n); const k = fs.readSync(fd, b, 0, n, o); return new Uint8Array(b.buffer, b.byteOffset, k); };
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
let ko = 0;
for (const src of process.argv.slice(2)) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-')), py = path.join(tmp, 'py' + path.extname(src)), js = path.join(tmp, 'js' + path.extname(src));
  fs.copyFileSync(src, py);
  execFileSync(PY, ['-c', `import sys; sys.path.insert(0, ${JSON.stringify(STR)}); import prepara_vetrino as p; p.pulisci_tiff(${JSON.stringify(py)})`]);
  const fd = fs.openSync(src, 'r'), t0 = Date.now(), piano = await M.pianoPulizia(lettore(fd));
  const blob = M.copiaPulita(await fs.openAsBlob(src), piano); fs.writeFileSync(js, Buffer.from(await blob.arrayBuffer())); fs.closeSync(fd);
  const ms = Date.now() - t0, fd2 = fs.openSync(js, 'r'), prob = await M.problemi(lettore(fd2)); fs.closeSync(fd2);
  const pyProb = execFileSync(PY, [path.join(STR, 'prepara_vetrino.py'), '--controlla', js], { encoding: 'utf8' }).trim();
  const uguali = hash(py) === hash(js);
  if (!uguali || prob.length || pyProb !== 'nessun problema') ko++;
  console.log(`${uguali && !prob.length && pyProb === 'nessun problema' ? 'OK' : 'KO'}  ${path.basename(src)}: ${piano.livelli} livelli, ${piano.accessorie} immagini tolte, ${piano.testi.length} testi riscritti, ${ms} ms · uguale a Python: ${uguali} · controllo JS: ${prob.length ? prob.join('; ') : 'nulla'} · controllo Python: ${pyProb}`);
  fs.rmSync(tmp, { recursive: true });
}
process.exit(ko ? 1 : 0);
