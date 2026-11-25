// confronta_insieme.mjs (1.327): preparaInsieme (browser) contro prepara_vetrino.py (Mac) per tutti i formati, anche quelli a
// più file (MRXS con la sua cartella, VSI con «_nome_»): stessi file prodotti, byte per byte; poi problemiInsieme sui file
// JS (il controllo del server) e il controllo Python. Uso: node confronta_insieme.mjs <file principale>…
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import crypto from 'node:crypto';
const M = await import('/Volumes/Caloggero/piattaforma-quiz/cloud/web/vetrino-tiff.js');
const PY = '/Volumes/Caloggero/piattaforma-quiz/strumenti/.venv/bin/python', STR = '/Volumes/Caloggero/piattaforma-quiz/strumenti';
const h = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const tutti = (d, base = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name))]);
let ko = 0;
for (const src of process.argv.slice(2)) {
  const dir = path.dirname(src), stem = path.basename(src).replace(/\.[^.]+$/, ''), est = path.extname(src).toLowerCase();
  // file come li darebbe il browser scegliendo la cartella che contiene il vetrino
  let rels = [path.basename(src)];
  if (est === '.mrxs') rels.push(...fs.readdirSync(path.join(dir, stem)).map((x) => `${stem}/${x}`));
  if (est === '.vsi') rels.push(...tutti(path.join(dir, `_${stem}_`)).map((x) => `_${stem}_/${x}`));
  const files = await Promise.all(rels.map(async (r) => { const b = await fs.openAsBlob(path.join(dir, r)); b.name = path.basename(r); b.rel = `cartella/${r}`; return b; }));
  const t0 = Date.now(), ins = await M.preparaInsieme(files), ms = Date.now() - t0;
  const js = new Map(); for (const u of ins.uscita) js.set(u.rel, Buffer.from(await u.blob.arrayBuffer()));
  const caso = fs.mkdtempSync(path.join(os.tmpdir(), 'vtc-'));
  execFileSync(PY, [path.join(STR, 'prepara_vetrino.py'), src, caso, 'prova'], { stdio: 'pipe' });
  const out = path.join(caso, 'serie', 'vetrino_0'), py = tutti(out).sort(), jsr = [...js.keys()].sort();
  const stessiNomi = JSON.stringify(py) === JSON.stringify(jsr);
  const diversi = py.filter((r) => !js.has(r) || h(fs.readFileSync(path.join(out, r))) !== h(js.get(r)));
  const prob = await M.problemiInsieme(ins.principale, async (r) => { const b = js.get(r); if (!b) throw new Error('manca ' + r); return { size: b.length, leggi: async (o, n) => new Uint8Array(b.buffer, b.byteOffset + o, Math.max(0, Math.min(n, b.length - o))) }; });
  const pyc = execFileSync(PY, [path.join(STR, 'prepara_vetrino.py'), '--controlla', path.join(out, ins.principale)], { encoding: 'utf8' }).trim();
  const tuttoOk = stessiNomi && !diversi.length && !prob.length && pyc === 'nessun problema';
  if (!tuttoOk) ko++;
  console.log(`${tuttoOk ? 'OK' : 'KO'}  ${path.basename(src)} (${ins.formato}, ${ms} ms): ${jsr.length} file, ${ins.accessorie} immagini tolte · stessi nomi: ${stessiNomi}${stessiNomi ? '' : ` (py ${py.join(',')} | js ${jsr.join(',')})`} · diversi: ${diversi.length ? diversi.join(',') : 'nessuno'} · controllo JS: ${prob.join('; ') || 'nulla'} · Python: ${pyc}`);
  fs.rmSync(caso, { recursive: true });
}
process.exit(ko ? 1 : 0);
