// dividi.mjs: sposta parti di app.js in un modulo a richiesta (come cmr-ui.js): i nomi di app.js letti come A.nome
// (ponte con getter, e setter per i nomi riassegnati), le istruzioni eseguite al caricamento in avvio(), al posto delle
// funzioni chiamate da fuori dei «rimandi» che caricano il modulo.
// Uso: node dividi.mjs <app.js> <modulo.js> <NOME_PONTE> <caricaX> "<a1-b1,a2-b2>" "<restano: nomi separati da virgola>" "<descrizione>"
import fs from 'node:fs'; import path from 'node:path'; import * as acorn from 'acorn'; import * as walk from 'acorn-walk'; import { analyze } from 'eslint-scope';
const [F, MOD, PONTE, CARICA, RANGES, RESTANO = '', DESCR = ''] = process.argv.slice(2);
const src = fs.readFileSync(F, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true });
const sm = analyze(ast, { ecmaVersion: 2022, sourceType: 'module' }), mod = sm.globalScope.childScopes.find((s) => s.type === 'module');
const intervalli = RANGES.split(',').map((r) => r.split('-').map(Number));
const resta = new Set(RESTANO.split(',').map((s) => s.trim()).filter(Boolean));
const nomiDi = (s) => s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration' ? [s.id.name] : s.type === 'VariableDeclaration' ? s.declarations.flatMap((d) => { const o = []; walk.fullAncestor(d.id, (n, _, anc) => { if (n.type === 'Identifier' && !(anc.at(-2)?.type === 'Property' && anc.at(-2).key === n && !anc.at(-2).shorthand)) o.push(n.name); }); return o; }) : [];
const sez = ast.body.filter((s) => intervalli.some(([a, b]) => s.loc.start.line >= a && s.loc.start.line < b) && !nomiDi(s).some((n) => resta.has(n)));
const nonTrovati = [...resta].filter((n) => !ast.body.some((s) => nomiDi(s).includes(n))); if (nonTrovati.length) throw new Error('restano: non trovati ' + nonTrovati);
const inSez = (r) => sez.some((s) => r[0] >= s.range[0] && r[1] <= s.range[1]);
const D = new Set(mod.variables.filter((v) => v.defs.some((d) => inSez(d.name.range))));
const genit = new Map(); walk.fullAncestor(ast, (n, st, anc) => { if (n.type === 'Identifier') genit.set(n, anc.at(-2)); });
// riferimenti
const esterni = new Map(), errori = [];   // nome spostato → righe da fuori
for (const v of D) for (const r of v.references) if (!inSez(r.identifier.range)) {
  const p = genit.get(r.identifier), chiamata = p?.type === 'CallExpression' && p.callee === r.identifier;
  if (v.defs[0].type !== 'FunctionName') errori.push(`${v.name} (non funzione) usato da fuori alla riga ${r.identifier.loc.start.line}`);
  if (r.isWrite()) errori.push(`${v.name} assegnato da fuori alla riga ${r.identifier.loc.start.line}`);
  const e = esterni.get(v.name) || []; e.push(r.identifier.loc.start.line + (chiamata ? '()' : '')); esterni.set(v.name, e);
}
if (errori.length) { console.error('NON SI PUÒ:\n  ' + errori.join('\n  ')); process.exit(1); }
const app = new Map();   // nome di app.js → scritto?
const sost = [];
for (const s of sm.scopes) for (const r of s.references) {
  if (!inSez(r.identifier.range) || !r.resolved || r.resolved.scope !== mod || D.has(r.resolved)) continue;
  const n = r.identifier.name; app.set(n, app.get(n) || r.isWrite());
  const p = genit.get(r.identifier);
  if (p?.type === 'Property' && p.shorthand && p.value === r.identifier) sost.push([r.identifier.range[0], r.identifier.range[1], `${n}: A.${n}`]);
  else if (p?.type === 'AssignmentPattern' && p.left === r.identifier && genit.get(p)?.type === 'Property' && genit.get(p).shorthand) sost.push([r.identifier.range[0], r.identifier.range[1], `${n}: A.${n}`]);
  else sost.push([r.identifier.range[0], r.identifier.range[1], `A.${n}`]);
}
// le dichiarazioni di import di app.js non si possono riassegnare: nessuna scrittura
const testoR = (A0, B0) => { let t = src.slice(A0, B0); const qui = sost.filter(([a, b]) => a >= A0 && b <= B0).sort((x, y) => y[0] - x[0]); for (const [a, b, r] of qui) t = t.slice(0, a - A0) + r + t.slice(b - A0); return t; };
const testo = (s) => testoR(s.range[0], s.range[1]);
// commenti subito prima di ogni istruzione (dalla fine della precedente), per tenerli nel modulo
const conCommento = (s) => { const i = ast.body.indexOf(s), prima = i ? ast.body[i - 1].range[1] : 0; const pre = src.slice(prima, s.range[0]); const m = pre.match(/\n((?:[ \t]*\/\/[^\n]*\n|[ \t]*\n)*)[ \t]*$/); return { pre: m ? m[1].replace(/^\s*\n/, '') : '', da: m ? prima + pre.indexOf(m[0]) + 1 : s.range[0] }; };
const dich = [], avvio = [];
const funz = (n) => n && /^(ArrowFunctionExpression|FunctionExpression)$/.test(n.type);
for (const s of sez) {
  const { pre } = conCommento(s);
  // variabili con un valore calcolato (es. const x = A.$('#id')): il ponte arriva solo dopo il caricamento, quindi si
  // dichiarano qui e il valore si calcola in avvio(), nello stesso ordine
  if (s.type === 'VariableDeclaration' && s.declarations.some((d) => d.init && !funz(d.init))) {
    const nomi = [], ass = [];
    for (const d of s.declarations) {
      walk.fullAncestor(d.id, (n, _, anc) => { if (n.type === 'Identifier' && !(anc.at(-2)?.type === 'Property' && anc.at(-2).key === n && !anc.at(-2).shorthand)) nomi.push(n.name); });
      if (!d.init) continue;
      const idT = testoR(d.id.range[0], d.id.range[1]), finale = testoR(d.init.range[0], d.init.range[1]);
      ass.push(d.id.type === 'Identifier' ? `${idT} = ${finale};` : `(${idT} = ${finale});`);
    }
    dich.push(pre + `let ${[...new Set(nomi)].join(', ')};   // valore in avvio()`); avvio.push(ass.join('\n')); continue;
  }
  (/Declaration$/.test(s.type) ? dich : avvio).push(pre + testo(s));
}
const nomiApp = [...app.keys()].sort();
const esporta = [...esterni.keys()];
const modulo = `// ${DESCR}
// Estratto da app.js nella 1.272 (strumenti_claude/divisione/dividi.mjs) senza modifiche al contenuto, salvo i nomi di
// app.js letti come A.nome (ponte ${PONTE}) e le istruzioni che app.js eseguiva al caricamento, ora in avvio().
// Si carica solo quando serve (app.js, ${CARICA}): chi non lo usa non lo scarica. Niente import './app.js'.
let A = null;
export const collega = (p) => { A = p; };
export const NOMI_APP = ${JSON.stringify(nomiApp)};

${dich.join('\n')}
// istruzioni che app.js eseguiva al caricamento (pulsanti e moduli di queste pagine): ora una volta, al primo uso
export function avvio() {
${avvio.join('\n').split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}
}
export { ${esporta.join(', ')} };
`;
// app.js: si tolgono le istruzioni spostate (con i commenti davanti), si mette il ponte al posto della prima
const tagli = sez.map((s) => { const { da } = conCommento(s); let fine = s.range[1]; while (src[fine] === ' ' || src[fine] === '\t') fine++; if (src[fine] === '\n') fine++; return [Math.min(da, s.range[0]), fine]; });
const nomeMod = path.basename(MOD);
const ponte = `// ${DESCR}: in ${nomeMod}, scaricato la prima volta che serve (1.272). Qui il ponte e le funzioni di ingresso.
const ${PONTE} = { ${nomiApp.map((n) => `get ${n}() { return ${n}; }` + (app.get(n) ? `, set ${n}(v) { ${n} = v; }` : '')).join(', ')} };
let ${CARICA}_P = null;
const ${CARICA} = () => (${CARICA}_P ||= import('./${nomeMod}').then((m) => { m.collega(${PONTE}); m.avvio(); return m; }).catch((e) => { ${CARICA}_P = null; throw e; }));
${esporta.map((n) => `function ${n}(...a) { return ${CARICA}().then((m) => m.${n}(...a)); }`).join('\n')}
`;
let out = src; const ord = tagli.sort((x, y) => y[0] - x[0]);
for (const [i, [a, b]] of ord.entries()) out = out.slice(0, a) + (i === ord.length - 1 ? ponte : '') + out.slice(b);
fs.writeFileSync(MOD, modulo); fs.writeFileSync(F, out);
console.log(`${nomeMod}: ${sez.length} istruzioni (${avvio.length} al caricamento), ${(modulo.length / 1024).toFixed(1)} kB; nomi di app.js ${nomiApp.length} (scritti: ${nomiApp.filter((n) => app.get(n)).join(' ') || 'nessuno'})`);
console.log('ingressi:', [...esterni].map(([k, v]) => `${k} ← ${v.join(' ')}`).join('; '));
