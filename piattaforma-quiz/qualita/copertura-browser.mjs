// Copertura del codice del sito misurata nel browser: somma i contatori che i simulatori hanno scritto
// (COPERTURA_SITO, file sito-*.json) e scrive il rapporto (testo, HTML e JSON in qualita/copertura-browser/).
// Uso: bash qualita/copertura-browser.sh [--veloce]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const libCoverage = require('istanbul-lib-coverage'), libReport = require('istanbul-lib-report'), reports = require('istanbul-reports');
const QUA = path.dirname(new URL(import.meta.url).pathname), DATI = path.join(QUA, '.copertura-browser'), OUT = path.join(QUA, 'copertura-browser');
const mappa = libCoverage.createCoverageMap({});
const file = fs.existsSync(DATI) ? fs.readdirSync(DATI).filter((x) => /^sito-.*\.json$/.test(x)) : [];
for (const f of file) mappa.merge(JSON.parse(fs.readFileSync(path.join(DATI, f), 'utf8')));
fs.rmSync(OUT, { recursive: true, force: true });
const contesto = libReport.createContext({ dir: OUT, coverageMap: mappa, defaultSummarizer: 'flat' });
for (const r of ['text', 'text-summary', 'html', 'json']) reports.create(r).execute(contesto);
console.log(`(${file.length} simulatori; rapporto HTML in ${OUT}/index.html)`);
