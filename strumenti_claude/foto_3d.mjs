// foto_1110.mjs: foto del client con un esame RM a molte serie (barra delle serie) — uso: node foto_1110.mjs caso nome
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const caso = process.argv[2] || 'caso-tcia-071', nome = process.argv[3] || 'serie';
const PORTA = 19700 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
try {
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro(`/Volumes/Caloggero/piattaforma-quiz/casi-free/${caso}/serie`);
  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage(); c.on('dialog', (d) => d.accept()); c.on('pageerror', (e) => console.log('ERR', e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 180000 }); await c.waitForTimeout(4000);
  await c.click('#modo-mpr'); await c.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await c.waitForTimeout(4000);
  await c.screenshot({ path: `/Volumes/Caloggero/_viste/${nome}.png` });
  console.log(await c.evaluate(() => JSON.stringify({ tool: [...document.querySelectorAll('[data-mpr-tool].on')].map((x) => x.dataset.mprTool), vp: ['vp-assiale', 'vp-coronale', 'vp-sagittale', 'vp-3d'].map((i) => { const r = document.getElementById(i)?.getBoundingClientRect(); return r && [i, Math.round(r.x), Math.round(r.y), Math.round(r.width)]; }) })));
  console.log(await c.evaluate(() => { const a = document.querySelector('aside.serie').getBoundingClientRect(); return JSON.stringify({ aside: [a.width, a.height], n: document.querySelectorAll('#lista-serie .s').length, sw: document.querySelector('aside.serie').scrollWidth }); }));
} finally { await b.close(); sim.kill(); }
