// css_morti.mjs <style.css> [--scrivi]: toglie le dichiarazioni sempre superate da una regola successiva con lo
// STESSO selettore nello stesso contesto (@media/@supports): a parità di specificità vince la più recente, quindi la
// più vecchia non si applica mai. Non tocca !important, proprietà ripetute nella stessa regola (fallback) e regole
// annidate diverse. Le regole rimaste vuote si tolgono.
import fs from 'node:fs'; import postcss from 'postcss';
const [f, scrivi] = process.argv.slice(2), root = postcss.parse(fs.readFileSync(f, 'utf8'));
const contesto = (n) => { const c = []; for (let p = n.parent; p && p.type !== 'root'; p = p.parent) c.unshift(p.type === 'atrule' ? `@${p.name} ${p.params}` : p.selector); return c.join(' » '); };
const norm = (s) => s.split(',').map((x) => x.trim().replace(/\s+/g, ' ')).sort().join(',');
const ultimo = new Map(); let tolte = 0; const esempi = [];
const regole = []; root.walkRules((r) => { if (r.parent.type === 'atrule' && /keyframes/.test(r.parent.name)) return; regole.push(r); });
for (let i = regole.length - 1; i >= 0; i--) {
  const r = regole[i], k = contesto(r) + ' | ' + norm(r.selector), vis = ultimo.get(k) || new Set();
  const nodi = r.nodes.filter((d) => d.type === 'decl'), conta = new Map(); nodi.forEach((d) => conta.set(d.prop, (conta.get(d.prop) || 0) + 1));
  for (const d of nodi) {
    if (d.important || conta.get(d.prop) > 1 || d.prop.startsWith('--') && false) continue;
    if (vis.has(d.prop)) { if (esempi.length < 12) esempi.push(`${r.selector.slice(0, 50)} { ${d.prop} } riga ${d.source.start.line}`); d.remove(); tolte++; }
  }
  for (const d of r.nodes.filter((d) => d.type === 'decl' && !d.important)) vis.add(d.prop);
  ultimo.set(k, vis);
}
let vuote = 0; root.walkRules((r) => { if (!r.nodes.some((n) => n.type === 'decl' || n.type === 'rule' || n.type === 'atrule')) { r.remove(); vuote++; } });
root.walkAtRules((a) => { if (/media|supports/.test(a.name) && a.nodes && !a.nodes.length) a.remove(); });
console.log(`dichiarazioni superate: ${tolte}, regole rimaste vuote: ${vuote}`); esempi.forEach((e) => console.log('  ' + e));
if (scrivi) fs.writeFileSync(f, root.toString());
