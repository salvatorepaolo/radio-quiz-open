// analizza.mjs <file> <riga inizio> <riga fine>: cosa servirebbe per spostare le righe [a, b) di app.js in un modulo a richiesta
import fs from 'node:fs'; import * as acorn from 'acorn'; import * as walk from 'acorn-walk'; import { analyze } from 'eslint-scope';
const [f, A, B] = process.argv.slice(2), src = fs.readFileSync(f, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true });
const sm = analyze(ast, { ecmaVersion: 2022, sourceType: 'module' }), mod = sm.globalScope.childScopes.find((s) => s.type === 'module');
const dentro = (n) => n.loc.start.line >= +A && n.loc.start.line < +B;
const sez = ast.body.filter(dentro);
const fine = sez.length ? sez[sez.length - 1].loc.end.line : 0;
const inSez = (id) => sez.some((s) => id.range[0] >= s.range[0] && id.range[1] <= s.range[1]);
const genit = new Map(); walk.fullAncestor(ast, (n, st, anc) => { if (n.type === 'Identifier') genit.set(n, anc[anc.length - 2]); });
const D = mod.variables.filter((v) => v.defs.some((d) => inSez(d.name)));
const altri = sez.filter((s) => !/Declaration$/.test(s.type));
console.log(`sezione righe ${A}–${fine}: ${sez.length} istruzioni, ${D.length} nomi; istruzioni non dichiarazioni: ${altri.length}`);
for (const s of altri) console.log('  ESEGUITA AL CARICAMENTO riga', s.loc.start.line, src.slice(s.range[0], s.range[0] + 100).replace(/\n/g, ' '));
console.log('— usati da fuori:');
for (const v of D) {
  const fuori = v.references.filter((r) => !inSez(r.identifier));
  if (!fuori.length) continue;
  const tipi = fuori.map((r) => { const p = genit.get(r.identifier); const ch = p?.type === 'CallExpression' && p.callee === r.identifier; const g2 = ch ? null : null; return `${r.identifier.loc.start.line}${ch ? '()' : r.isWrite() ? '=' : ''}`; });
  console.log(`  ${v.defs[0].type === 'FunctionName' ? 'fn ' : v.defs[0].kind || v.defs[0].parent?.kind || ''} ${v.name}: ${tipi.join(' ')}`);
}
const dip = new Map();
for (const s of sm.scopes) for (const r of s.references) {
  if (!inSez(r.identifier) || !r.resolved || r.resolved.scope !== mod || D.includes(r.resolved)) continue;
  const e = dip.get(r.resolved.name) || { w: 0, n: 0 }; e.n++; if (r.isWrite()) e.w++; dip.set(r.resolved.name, e);
}
const glob = new Set(); for (const s of sm.scopes) for (const r of s.references) if (inSez(r.identifier) && !r.resolved) glob.add(r.identifier.name);
console.log(`— nomi di app.js usati (${dip.size}):`, [...dip].map(([k, e]) => k + (e.w ? `[SCRITTO ${e.w}]` : '')).join(' '));
console.log('— globali:', [...glob].join(' '));
