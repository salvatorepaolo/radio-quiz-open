// Analisi per dividere app.js: dato un intervallo di righe (dichiarazioni di primo livello), elenca
// - che cosa il pezzo usa da app.js (da importare), - che cosa app.js usa dal pezzo (da esportare),
// - assegnazioni incrociate (un import ESM non si può riassegnare: vanno trasformate in funzioni).
// Uso: node analizza.mjs ../../piattaforma-quiz/cloud/web/app.js 3075 4103
import fs from 'node:fs';
import * as acorn from 'acorn';
import * as scope from 'eslint-scope';
const [file, a, b] = [process.argv[2], +process.argv[3], +process.argv[4]];
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true, ranges: true });
const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const dentro = (n) => n.loc.start.line >= a && n.loc.end.line <= b;
// le istruzioni di primo livello devono stare tutte dentro o tutte fuori
const tagliate = ast.body.filter((s) => s.loc.start.line < a && s.loc.end.line >= a || s.loc.start.line <= b && s.loc.end.line > b);
if (tagliate.length) console.log('ATTENZIONE istruzioni tagliate:', tagliate.map((s) => s.loc.start.line));
const mod = sm.scopes.find((s) => s.type === 'module');
const imp = new Set(), esp = new Set(), scrittiDentro = new Set(), scrittiFuori = new Set();
for (const v of mod.variables) {
  if (!v.defs.length) continue;
  const def = v.defs[0].name; const dDentro = dentro(def);
  for (const r of v.references) {
    const rDentro = dentro(r.identifier);
    if (dDentro && !rDentro) { esp.add(v.name); if (r.isWrite()) scrittiFuori.add(v.name); }
    if (!dDentro && rDentro) { imp.add(v.name); if (r.isWrite()) scrittiDentro.add(v.name); }
  }
}
const globali = new Set(); for (const r of mod.through) if (dentro(r.identifier)) globali.add(r.identifier.name);
const ord = (s) => [...s].sort();
console.log(JSON.stringify({ importare: ord(imp), esportare: ord(esp), assegnati_dentro_ma_di_app: ord(scrittiDentro), assegnati_fuori_ma_del_pezzo: ord(scrittiFuori), globali_del_browser: ord(globali) }, null, 1));
