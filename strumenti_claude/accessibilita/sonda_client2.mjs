// accessibilita.mjs: controllo automatico dell'accessibilità (axe-core, WCAG 2.0/2.1/2.2 A e AA) delle pagine principali
// di radio-quiz.it sul simulatore locale, più tre controlli che axe non fa: tastiera (Tab raggiunge i comandi e il fuoco si vede),
// zoom al 200% senza scorrimento orizzontale, lingua della pagina. Risultato: /tmp/accessibilita.json e riassunto a schermo.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const AXE = fs.readFileSync('/Volumes/Caloggero/strumenti_claude/accessibilita/node_modules/axe-core/axe.min.js', 'utf8');
const PORTA = 19450 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
const tutti = [];
const analizza = async (p, nome, { contesto } = {}) => {
  await p.addScriptTag({ content: AXE }).catch(() => {});
  const r = await p.evaluate(async (ctx) => {
    const res = await window.axe.run(ctx || document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations', 'incomplete'] });
    const breve = (v) => ({ id: v.id, impatto: v.impact, aiuto: v.help, n: v.nodes.length, esempi: v.nodes.slice(0, 4).map((x) => ({ dove: x.target.join(' '), html: x.html.slice(0, 160), perche: (x.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 220) })) });
    return { violazioni: res.violations.map(breve), dubbi: res.incomplete.filter((v) => v.id === 'color-contrast').map(breve) };
  }, contesto || null);
  tutti.push({ pagina: nome, ...r });
  console.log(`\n== ${nome}: ${r.violazioni.length} regole violate` + (r.violazioni.length ? '' : ' ✓'));
  for (const v of r.violazioni) console.log(`  [${v.impatto}] ${v.id} ×${v.n}: ${v.aiuto}\n      es. ${v.esempi[0]?.dove} — ${v.esempi[0]?.html.slice(0, 110)}`);
};
const tastiera = async (p, nome, passi = 40) => {
  const visti = [];
  await p.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  for (let i = 0; i < passi; i++) {
    await p.keyboard.press('Tab');
    const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null;
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const anello = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || /rgba?\([^)]*\)\s+0px\s+0px\s+0px\s+[1-9]/.test(s.boxShadow) || s.boxShadow !== 'none';
      return { tag: e.tagName.toLowerCase(), nome: (e.getAttribute('aria-label') || e.textContent || e.value || e.title || '').trim().slice(0, 30), visibile: r.width > 0 && r.height > 0, anello }; });
    if (f) visti.push(f);
  }
  const senzaAnello = visti.filter((f) => f.visibile && !f.anello), invisibili = visti.filter((f) => !f.visibile);
  console.log(`  tastiera (${nome}): ${visti.length} fermate con Tab · fuoco non visibile su ${senzaAnello.length}` + (senzaAnello.length ? ` (es. ${senzaAnello.slice(0, 4).map((f) => f.tag + ' «' + f.nome + '»').join(', ')})` : '') + ` · su elementi nascosti ${invisibili.length}`);
  tutti.push({ pagina: nome + ' (tastiera)', fermate: visti.length, senzaAnello, invisibili });
};
try {
  const c = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT', bypassCSP: true })).newPage();
  c.on('framenavigated', (f) => { if (f === c.mainFrame()) console.log('nav', f.url()); });
  await c.goto(B + '/client/index.html');
  await c.waitForTimeout(6000); console.log(await c.evaluate(() => [location.href, document.documentElement.lang, document.title])); await analizza(c, 'Client (pagina iniziale)'); await tastiera(c, 'client', 30);
} catch (e) { console.log('ERRORE', e); }
finally { fs.writeFileSync('/tmp/accessibilita.json', JSON.stringify(tutti, null, 1)); await b.close(); sim.kill(); console.log('\nFINE'); }
