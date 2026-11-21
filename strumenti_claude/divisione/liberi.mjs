// nomi usati in un modulo ma non dichiarati né importati (dovrebbero essere solo globali del browser)
import fs from 'node:fs';
import * as acorn from 'acorn';
import * as scope from 'eslint-scope';
const ast = acorn.parse(fs.readFileSync(process.argv[2], 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true, ranges: true });
const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const glob = sm.globalScope.through.concat(sm.scopes.find((s) => s.type === 'module').through);
console.log([...new Set(glob.map((r) => r.identifier.name))].sort().join(' '));
