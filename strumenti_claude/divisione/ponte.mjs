// Toglie da un modulo l'import da './app.js' e lo sostituisce con un «ponte»: un oggetto passato da app.js con
// collega(PONTE); ogni nome importato diventa A.nome. Serve perché nel client offline il service worker serve
// /client/app.js con l'indirizzo /app.js: un import './app.js' dal modulo caricato a richiesta caricherebbe app.js
// una seconda volta (pagina reinizializzata). Uso: node ponte.mjs ../../piattaforma-quiz/cloud/web/scale.js
import fs from 'node:fs';
import * as acorn from 'acorn';
import * as scope from 'eslint-scope';
const file = process.argv[2], src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true });
const imp = ast.body.find((s) => s.type === 'ImportDeclaration' && s.source.value === './app.js');
if (!imp) { console.error('nessun import da ./app.js'); process.exit(1); }
const nomi = imp.specifiers.map((s) => s.local.name);
const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const mod = sm.scopes.find((s) => s.type === 'module');
const sost = [];   // [inizio, fine, testo]
// padri delle proprietà abbreviate { V } → { V: A.V }
const abbreviate = new Set(); (function giro(n) { if (!n || typeof n.type !== 'string') return;
  if (n.type === 'Property' && n.shorthand && n.value.type === 'Identifier') abbreviate.add(n.value);
  for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(giro); else if (v && typeof v.type === 'string') giro(v); } })(ast);
for (const v of mod.variables) {
  if (!nomi.includes(v.name)) continue;
  for (const r of v.references) {
    if (r.isWrite()) { console.error('assegnazione a un nome di app.js:', v.name, r.identifier.loc.start.line); process.exit(1); }
    const id = r.identifier; sost.push([id.start, id.end, abbreviate.has(id) ? `${v.name}: A.${v.name}` : `A.${v.name}`]);
  }
}
sost.push([imp.start, imp.end, `// nomi di app.js: arrivano con collega(PONTE) (vedi app.js); niente import './app.js'\nlet A = null;\nexport const collega = (p) => { A = p; };\nexport const NOMI_APP = ${JSON.stringify(nomi)};`]);
let out = src; for (const [a, b, t] of sost.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + t + out.slice(b);
fs.writeFileSync(file, out);
console.log(`${sost.length - 1} riferimenti sostituiti; ponte: ${nomi.join(', ')}`);
