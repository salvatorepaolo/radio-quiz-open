// nomi dichiarati al primo livello di un file JavaScript (per costruire la lista degli export)
import fs from 'node:fs';
import * as acorn from 'acorn';
const ast = acorn.parse(fs.readFileSync(process.argv[2], 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
const n = [];
for (const s of ast.body) {
  if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') n.push(s.id.name);
  if (s.type === 'VariableDeclaration') for (const d of s.declarations) { if (d.id.type === 'Identifier') n.push(d.id.name); else console.error('destrutturazione', d.loc); }
}
console.log(n.join(', '));
