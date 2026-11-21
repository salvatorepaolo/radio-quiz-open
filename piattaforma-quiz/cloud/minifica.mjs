// Pubblicazione: riduce app.js, style.css e i moduli delle scale nella copia da caricare (non tocca web/).
// esbuild (MIT) senza unire i moduli: stessi file e stessi import, solo spazi, commenti e nomi interni accorciati.
// Le mappe (.map) permettono di risalire al codice originale: si scrivono in cloud/.mappe, sul Mac, e NON si pubblicano
// (il codice commentato resta privato); controlla-sito.sh verifica che sul sito non siano raggiungibili.
// Uso: node minifica.mjs <cartella copiata>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const esbuild = require('./mpr3d/node_modules/esbuild');
const dir = process.argv[2], MAPPE = path.join(path.dirname(new URL(import.meta.url).pathname), '.mappe');
if (!dir || !fs.existsSync(path.join(dir, 'app.js'))) { console.error('cartella non valida'); process.exit(1); }
fs.mkdirSync(MAPPE, { recursive: true });
let prima = 0, dopo = 0;
for (const f of ['app.js', 'style.css', 'scale.js', 'scale-dati.js', 'cmr-ui.js']) {
  const p = path.join(dir, f), s = fs.readFileSync(p, 'utf8'), css = f.endsWith('.css');
  const r = esbuild.transformSync(s, { loader: css ? 'css' : 'js', format: css ? undefined : 'esm', minify: true, target: css ? ['chrome100', 'safari15', 'firefox100'] : 'es2020',
    legalComments: 'none', sourcemap: 'external', sourcefile: f, sourcesContent: true });
  fs.writeFileSync(p, r.code + '\n');
  fs.writeFileSync(path.join(MAPPE, f + '.map'), r.map);
  fs.rmSync(p + '.map', { force: true });
  prima += s.length; dopo += r.code.length;
}
console.log(`app.js, style.css e moduli a richiesta ridotti: ${Math.round(prima / 1024)} → ${Math.round(dopo / 1024)} kB`);
