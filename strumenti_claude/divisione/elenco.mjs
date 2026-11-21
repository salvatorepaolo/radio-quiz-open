import fs from 'node:fs'; import * as acorn from 'acorn';
const [f, a, b] = process.argv.slice(2), src = fs.readFileSync(f, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
for (const s of ast.body) { if (s.loc.start.line < +a || s.loc.start.line >= +b) continue;
  const n = s.id?.name || s.declarations?.map((d) => d.id.name || '{…}').join(',') || src.slice(s.start, s.start + 60).replace(/\n/g, ' ');
  console.log(s.loc.start.line, '-', s.loc.end.line, (s.end - s.start) + 'B', s.type.replace('Declaration', ''), n); }
