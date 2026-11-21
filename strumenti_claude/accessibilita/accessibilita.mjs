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
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT', bypassCSP: true });
  const a = await ctx.newPage();
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  // 1 pagina iniziale senza accesso
  await a.goto(B + '/?prova#/'); await a.waitForTimeout(1500);
  await analizza(a, 'Pagina iniziale (non autenticato)');
  console.log('  lingua della pagina:', await a.evaluate(() => document.documentElement.lang || '(manca)'));
  await tastiera(a, 'pagina iniziale', 25);
  // 2 accesso amministratore e studente
  await a.click('[data-vai="codice"]'); await a.waitForTimeout(400);
  await analizza(a, 'Dialogo di accesso con codice');
  await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const cod = (await a.evaluate(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Accessibilità', ruolo: 'specializzando' }) })).json()))).codice;
  await a.waitForTimeout(1000);
  await analizza(a, 'Elenco dei casi (amministratore)');
  // 3 caso con visualizzatore (RX + TC), domande
  await a.goto(B + '/?prova#/caso/caso-tcia-014'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-014', null, { timeout: 60000 }); await a.waitForTimeout(2500);
  await analizza(a, 'Caso con visualizzatore (RX + angio-TC)');
  await tastiera(a, 'caso e visualizzatore', 60);
  // 4 pagine di gestione
  for (const [h, n] of [['#/gestione-casi', 'Gestione dei casi'], ['#/statistiche', 'Statistiche (amministratore)'], ['#/aiuto', 'Aiuto'], ['#/account', 'Account'], ['#/nuovo', 'Nuovo caso (editor)']]) {
    await a.goto(B + '/?prova' + h); await a.waitForTimeout(1800); await analizza(a, n);
  }
  // 5 studente
  const s = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT', bypassCSP: true })).newPage();
  await s.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await s.goto(B + '/?prova#/'); await s.click('[data-vai="codice"]'); await s.fill('#codice', cod); await s.press('#codice', 'Enter'); await s.waitForSelector('#vista-elenco:not([hidden])'); await s.waitForTimeout(1200);
  await analizza(s, 'Elenco dei casi (studente)');
  await s.goto(B + '/?prova#/mie-statistiche'); await s.waitForTimeout(1800); await analizza(s, 'Le mie statistiche (studente)');
  await s.goto(B + '/?prova#/caso/caso-tcia-004'); await s.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await s.waitForTimeout(2500);
  await analizza(s, 'Caso TC fegato (studente)');
  // risposta: esito
  await s.evaluate(() => { const o = document.querySelector('#opzioni input, .opzione input, [data-opz]'); o?.click(); });
  await s.evaluate(() => document.querySelector('#btn-rispondi, #q-conferma, button[data-azione="rispondi"]')?.click()); await s.waitForTimeout(1500);
  await analizza(s, 'Caso dopo la risposta (esito)');
  // 6 inglese
  await s.goto(B + '/?prova&lang=en#/'); await s.waitForTimeout(1500);
  console.log('  lingua (inglese):', await s.evaluate(() => document.documentElement.lang || '(manca)'));
  // 7 telefono e zoom 200%
  const t = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'it-IT', bypassCSP: true })).newPage();
  await t.goto(B + '/?prova#/'); await t.click('[data-vai="codice"]'); await t.fill('#codice', cod); await t.press('#codice', 'Enter'); await t.waitForSelector('#vista-elenco:not([hidden])'); await t.waitForTimeout(1000);
  await analizza(t, 'Telefono: elenco');
  await t.goto(B + '/?prova#/caso/caso-tcia-014'); await t.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await t.waitForTimeout(2000);
  await analizza(t, 'Telefono: caso');
  const z = await (await b.newContext({ viewport: { width: 640, height: 450 }, locale: 'it-IT', bypassCSP: true })).newPage();   // 1280×900 al 200%
  await z.goto(B + '/?prova#/'); await z.click('[data-vai="codice"]'); await z.fill('#codice', cod); await z.press('#codice', 'Enter'); await z.waitForSelector('#vista-elenco:not([hidden])'); await z.waitForTimeout(800);
  const oriz = async () => z.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: innerWidth }));
  console.log('\n== Zoom 200% (1280 px → 640): elenco', JSON.stringify(await oriz()));
  await z.goto(B + '/?prova#/caso/caso-tcia-004'); await z.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await z.waitForTimeout(2000);
  console.log('   caso', JSON.stringify(await oriz()));
  // 8 client
  const c = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT', bypassCSP: true })).newPage();
  await c.goto(B + '/client/index.html'); await c.waitForTimeout(3000); await c.waitForLoadState('load'); await c.waitForFunction(() => document.documentElement.lang, null, { timeout: 20000 }).catch(() => {}); await c.waitForTimeout(2000);
  await analizza(c, 'Client (pagina iniziale)');
} catch (e) { console.log('ERRORE', e); }
finally { fs.writeFileSync('/tmp/accessibilita.json', JSON.stringify(tutti, null, 1)); await b.close(); sim.kill(); console.log('\nFINE'); }
