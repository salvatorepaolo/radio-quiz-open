// Pagina e moduli (web/index.html, app.js, client/sw.js): controlli statici, senza browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '../web');
const leggi = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');
// import statici di un modulo, risolti rispetto alla sua cartella
const importi = (f) => [...leggi(f).matchAll(/^(?:import|export) [^'"\n]*?(?:from )?'(\.\/[^']+\.js)'/gm)].map((m) => path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
function grafo(radice) { const visti = new Set(); const giro = (f) => { if (visti.has(f)) return; visti.add(f); importi(f).forEach(giro); }; giro(radice); return visti; }

test('index.html: modulepreload per app.js e per tutti i moduli che importa (anche indirettamente)', () => {
  const html = leggi('index.html'), pre = new Set([...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]));
  const servono = grafo('app.js');
  for (const f of servono) assert.ok(pre.has(f), `manca <link rel="modulepreload" href="${f}">`);
  for (const f of pre) assert.ok(servono.has(f), `${f} è precaricato ma app.js non lo importa più`);
});
// moduli caricati a richiesta e nome del ponte con cui ricevono i nomi di app.js
const A_RICHIESTA = { 'scale.js': 'PONTE_SCALE', 'cmr-ui.js': 'PONTE_CMR', 'gestione-sito.js': 'PONTE_GS', 'docenti.js': 'PONTE_DOC' };
test('i moduli caricati a richiesta non sono precaricati né importati all\'avvio', () => {
  const html = leggi('index.html'), servono = grafo('app.js'), app = leggi('app.js');
  for (const f of [...Object.keys(A_RICHIESTA), 'scale-dati.js']) { assert.ok(!servono.has(f), f); assert.ok(!html.includes(`href="${f}"`), f); }
  for (const f of Object.keys(A_RICHIESTA)) assert.match(app, new RegExp(`import\\('\\./${f.replace('.', '\\.')}'\\)`), `app.js non carica ${f}`);
});
test('moduli a richiesta: niente import di app.js, ponte completo, niente istruzioni al caricamento', () => {
  const app = leggi('app.js');
  for (const [f, nome] of Object.entries(A_RICHIESTA)) {
    const js = leggi(f);
    assert.doesNotMatch(js, /from '\.\/app\.js'|import\('\.\/app\.js'\)/, `${f} importa app.js`);
    const ponte = app.match(new RegExp(`const ${nome} = \\{(.*)\\};`))[1];
    for (const n of JSON.parse(js.match(/export const NOMI_APP = (\[.*\]);/)[1])) assert.ok(ponte.includes(`get ${n}() { return ${n}; }`), `${nome} non passa ${n}`);
    const strane = js.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => l && !/^(\s|\/\/|import |export |const |let |function |async function |[}\])])/.test(l));
    assert.deepEqual(strane, [], `${f}: istruzioni eseguite al caricamento`);
  }
});
test('client offline: ogni file della pagina e ogni modulo è nella cache del service worker', () => {
  const sw = leggi('client/sw.js'), tutti = new Set([...grafo('app.js'), ...Object.keys(A_RICHIESTA).flatMap((f) => [...grafo(f)]), 'prima.js', 'lib/dicomParser.min.js', 'style.css']);
  for (const f of tutti) assert.ok(sw.includes(`'/${f}'`), `${f} non è in client/sw.js`);
});
test('nessuno script scritto dentro la pagina (la Content Security Policy li blocca)', () => {
  const html = leggi('index.html');
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].filter((m) => m[1].trim());
  assert.equal(inline.length, 0, inline.map((m) => m[0].slice(0, 80)).join('\n'));
});
test('prima.js non fa richieste nel visualizzatore scaricabile', () => {
  const js = leggi('prima.js');
  assert.match(js, /indexOf\('\/client\/'\) === 0/); assert.match(js, /client\\b/);
  // la condizione di uscita viene prima di ogni fetch
  assert.ok(js.indexOf('return;') < js.indexOf('fetch('));
});
test('motore MPR/3D: indirizzo con l\'hash del file (si riscarica solo quando cambia)', () => {
  const app = leggi('app.js');
  assert.doesNotMatch(app, /mpr3d\.js' \+ \(VERSIONE\.numero/, 'resta un indirizzo con il numero di versione del sito');
  assert.equal((app.match(/'\.\/lib\/mpr3d\.js' \+ versioneMpr3d\(\)/g) || []).length, 2);
  assert.match(app, /const versioneMpr3d = \(\) => \(VERSIONE\.mpr3d \? '\?h=' \+ VERSIONE\.mpr3d/);
});
test('comprimi.mjs: il file compresso si decomprime identico e si riusa finché il contenuto non cambia', async () => {
  const { execFileSync } = await import('node:child_process'); const zlib = await import('node:zlib'); const os = await import('node:os');
  const f = path.join(os.tmpdir(), `prova-comprimi-${process.pid}.js`); fs.writeFileSync(f, 'export const x = ' + JSON.stringify('radio-quiz '.repeat(5000)) + ';\n');
  const esegui = () => execFileSync(process.execPath, [path.join(WEB, '../comprimi.mjs'), f], { encoding: 'utf8' }).trim().split(' ');
  const [br, h] = esegui(), t1 = fs.statSync(br).mtimeMs;
  try {
    assert.equal(zlib.brotliDecompressSync(fs.readFileSync(br)).toString(), fs.readFileSync(f, 'utf8'));
    assert.ok(fs.statSync(br).size < fs.statSync(f).size / 10);
    const [br2, h2] = esegui(); assert.equal(br2, br); assert.equal(h2, h); assert.equal(fs.statSync(br2).mtimeMs, t1, 'ricompresso senza motivo');
  } finally { fs.rmSync(br, { force: true }); fs.rmSync(f, { force: true }); }
});
test('peso: ciò che si scarica all\'apertura resta sotto le soglie (non regressione delle prestazioni)', async () => {
  // stesse operazioni della pubblicazione (minifica.mjs + brotli): se si supera una soglia, si è appesantita la pagina
  const { createRequire } = await import('node:module'); const zlib = await import('node:zlib');
  // esbuild del motore 3D (sul Mac) oppure quello di qualita/ (stessa versione: così gira anche su GitHub)
  const esbuild = createRequire(import.meta.url)([path.join(WEB, '../mpr3d/node_modules/esbuild'), path.join(WEB, '../../qualita/node_modules/esbuild')].find((p) => fs.existsSync(p)) || 'esbuild');
  const peso = (f, min = true) => { let s = leggi(f); if (min) s = esbuild.transformSync(s, { loader: 'js', format: 'esm', minify: true }).code;
    return Math.round(zlib.brotliCompressSync(Buffer.from(s), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length / 1024); };
  const app = peso('app.js'); assert.ok(app <= 230, `app.js ${app} kB compressi: soglia 230 kB (era 218 al 15/11/2026)`);
  const statici = [...grafo('app.js')].filter((f) => f !== 'app.js'), pesi = statici.map((f) => [f, peso(f, !f.startsWith('lib/'))]);
  for (const [f, k] of pesi) assert.ok(k <= 15, `${f}: ${k} kB, un modulo caricato all'avvio non dovrebbe superare 15 kB`);
  const tot = app + pesi.reduce((a, [, k]) => a + k, 0); assert.ok(tot <= 290, `totale all'avvio ${tot} kB: soglia 290 kB`);
});

// ---- pagina «Qualità e sicurezza del software» (italiano e inglese)
test('qualità del software: pagina italiana e inglese con la stessa struttura, senza script, collegate tra loro e dal piede del sito', () => {
  const it = fs.readFileSync(path.join(WEB, 'qualita.html'), 'utf8'), en = fs.readFileSync(path.join(WEB, 'qualita.en.html'), 'utf8');
  const conta = (s, re) => (s.match(re) || []).length;
  for (const re of [/<h2/g, /<h3/g, /<li>/g, /<tr>/g, /<table/g, /class="num"/g]) assert.equal(conta(en, re), conta(it, re), `struttura diversa: ${re}`);
  for (const [s, lingua] of [[it, 'it'], [en, 'en']]) {
    assert.ok(!/<script/i.test(s), 'niente script (CSP)'); assert.ok(s.includes(`<html lang="${lingua}">`));
    const id = new Set([...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    for (const [, a] of s.matchAll(/href="#([^"]+)"/g)) assert.ok(id.has(a), `ancora #${a} senza destinazione (${lingua})`);
    for (const [, f] of s.matchAll(/href="([^"#:]+\.(?:html|svg))"/g)) assert.ok(fs.existsSync(path.join(WEB, f)), `collegamento a ${f} inesistente`);
    assert.ok(/strumento didattico|educational tool/i.test(s) && /dispositivo medico|medical device/.test(s), 'avvertenza: non è un dispositivo medico');
  }
  assert.ok(it.includes('href="qualita.en.html"') && en.includes('href="qualita.html"'));
  const index = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  assert.ok(index.includes('href="/qualita.html"'), 'collegamento nel piede del sito');
  assert.ok(fs.readFileSync(path.join(WEB, 'i18n.js'), 'utf8').includes("a.href = '/qualita.en.html'"), 'in inglese il piede porta alla pagina inglese');
});
