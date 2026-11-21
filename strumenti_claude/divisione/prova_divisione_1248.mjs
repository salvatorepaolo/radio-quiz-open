// Prova di divisione: dati gli intervalli di righe di app.js da spostare in un modulo, dice
// - quali nomi di app.js il pezzo usa (andranno nel ponte),
// - quali nomi del pezzo usa il resto di app.js (servono funzioni di ingresso), con le righe,
// - istruzioni eseguite al caricamento dentro il pezzo (vanno lasciate in app.js),
// - assegnazioni dal pezzo a variabili di app.js (vietate: il ponte è in sola lettura).
// Uso: node dividi.mjs app.js 4486-4663 4721-5117
import fs from 'node:fs';
import * as acorn from 'acorn';
import * as scope from 'eslint-scope';
const [file, ...rr] = process.argv.slice(2), R = rr.map((x) => x.split('-').map(Number));
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true });
const dentro = (n) => R.some(([a, b]) => n.loc.start.line >= a && n.loc.end.line <= b);
for (const s of ast.body) if (!dentro(s) && R.some(([a, b]) => s.loc.end.line >= a && s.loc.start.line <= b)) console.log('TAGLIATA', s.loc.start.line, s.loc.end.line);
const effetti = ast.body.filter((s) => dentro(s) && !/Declaration$/.test(s.type)).map((s) => `${s.loc.start.line}: ${src.slice(s.start, s.start + 90).replace(/\n/g, ' ')}`);
const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' }), mod = sm.scopes.find((s) => s.type === 'module');
const ponte = new Set(), ingressi = {}, scritti = new Set();
for (const v of mod.variables) {
  if (!v.defs.length) continue; const dd = dentro(v.defs[0].name);
  for (const r of v.references) { const rd = dentro(r.identifier);
    if (!dd && rd) { ponte.add(v.name); if (r.isWrite()) scritti.add(v.name); }
    if (dd && !rd) (ingressi[v.name] ||= []).push(r.identifier.loc.start.line); }
}
console.log(JSON.stringify({ effetti, scritti: [...scritti], ingressi, ponte: [...ponte].sort() }, null, 1));
