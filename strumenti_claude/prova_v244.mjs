// prova_v244.mjs: coerenza RECIST 1.1 (una misura) in somma della scala, GSPS, SR e MPR; tasti nuovi nell'aiuto; traduzioni inglesi
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19450 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0;
try {
  const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
  const errori = [];
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110/serie');
  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message)); c.on('dialog', (d) => d.accept());
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 }); await c.waitForTimeout(1500);
  const D = (f, x) => c.evaluate(f, x);
  await D(() => document.querySelector('#barra-2d [data-tool="recist"]').click());
  const g = await D(() => { const r = document.querySelector('#canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
  await c.mouse.move(cx - 40, cy); await c.mouse.down(); await c.mouse.move(cx, cy, { steps: 4 }); await c.mouse.move(cx + 40, cy, { steps: 4 }); await c.mouse.up(); await c.waitForTimeout(400);
  const r1 = await D(() => { const d = window.__dbg, e = Object.entries(d.V.misure).flatMap(([k, l]) => l.map((m) => ({ k, m }))).filter(({ m }) => m.tipo === 'recist');
    const { k, m } = e[0] || {}; if (!m) return null; const [si, idx] = k.split(':').map(Number), p = d.P(d.V.attivo), img = p.img;
    const s = d.sommaMisureRecist(), gr = d.graficiMisura(m, img, idx, si), sr = d.misureSR(m, img, idx, si, gr.g);
    const lung = Math.hypot((m.b.x - m.a.x) * img.spCol, (m.b.y - m.a.y) * img.spRow);
    return { sp: !!m.sp, lung, somma: s?.somma, n: s?.n, g: gr.g.length, testo: gr.testi.map((t) => t.testo), sr: sr.map((x) => x.valori.map((v) => v.codice[2])) }; });
  ok('1 la misura RECIST ricorda la spaziatura dei pixel', r1?.sp, r1);
  ok('2 somma RECIST dell\'esame = la misura', r1 && r1.n === 1 && Math.abs(r1.somma - r1.lung) < 0.01);
  ok('3 GSPS: la misura a una linea c\'è (prima veniva persa)', r1 && r1.g === 1 && /^RECIST [\d.]+ mm$/.test(r1.testo[0] || ''), r1?.testo);
  ok('4 DICOM SR: valore «Long Axis»', r1 && r1.sr.length === 1 && r1.sr[0][0] === 'Long Axis', r1?.sr);
  // scala RECIST 1.1: pulsante della somma
  await D(() => document.querySelector('#btn-scale').click()); await c.waitForTimeout(400);
  await D(() => { const s = document.querySelector('#scala-scelta'); if (![...s.options].some((o) => o.value === 'recist')) { const t = document.querySelector('#scala-tutte, [data-scale-tutte]'); t?.click(); } s.value = 'recist'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await c.waitForTimeout(400);
  const btn = await D(() => document.querySelector('#scala-corpo [data-somma="sa"]')?.textContent || null);
  ok('5 scala RECIST 1.1: «⟵ Σ RECIST … mm (1 misura)»', /Σ RECIST [\d,]+ mm \(1 misura\)/.test(btn || ''), btn);
  if (btn) { await c.click('#scala-corpo [data-somma="sa"]'); await c.waitForTimeout(300); }
  const val = await D(() => document.querySelector('#scala-corpo input[data-c="sa"]')?.value);
  ok('6 il clic scrive la somma nel campo', r1 && Math.abs(+val - r1.lung) < 0.06, val);
  // aiuto e tasti
  const aiuto = await D(() => document.querySelector('#aiuto-2d').title.replace(/\n/g, ' · '));
  ok('7 aiuto in barra: T, B + clic, Ctrl/⌘ + clic, ✕ del riquadro', /T freccia/.test(aiuto) && /B \+ clic/.test(aiuto) && /Ctrl\/⌘ \+ clic/.test(aiuto) && /✕ in alto a destra/.test(aiuto));
  await c.keyboard.press('Escape'); await c.mouse.click(cx, cy + 120); await c.keyboard.press('Escape'); await c.keyboard.press('?'); await c.waitForTimeout(300);
  const tasti = await D(() => document.querySelector('#tasti-rapidi')?.textContent || '');
  ok('8 elenco dei tasti con i comandi nuovi', /B \+ clic/.test(tasti) && /Ctrl\/⌘ \+ clic su una serie/.test(tasti) && /Freccia con testo/.test(tasti));
  const mpr = fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/cloud/web/lib/mpr3d.js', 'utf8');
  ok('9 MPR ricostruito con le righe RECIST 1.1', mpr.includes('se linfonodo: asse corto') && !mpr.includes('Volume stimato ≈'));
  // inglese
  const e = await (await b.newContext({ locale: 'en-US', viewport: { width: 1400, height: 900 } })).newPage(); e.on('pageerror', (x) => errori.push(x.message));
  await e.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
  await e.goto(B + '/client/index.html?lang=en'); await e.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 }); await e.waitForTimeout(1500);
  await e.evaluate(() => document.querySelector('#aiuto-2d')?.click()); await e.waitForTimeout(300);
  const en = await e.evaluate(() => ({ r: document.querySelector('#barra-2d [data-tool="recist"]')?.title, a: document.querySelector('#aiuto-2d')?.textContent, m: document.querySelector('[data-mpr-tool="recist"]')?.title, t: document.querySelector('#cl-paz-tab')?.closest('label')?.textContent?.trim() }));
  ok('10 inglese: titoli RECIST, aiuto e linguetta tradotti', /^RECIST 1\.1: one measurement/.test(en.r || '') && /T arrow/.test(en.a || '') && /longest diameter/.test(en.m || '') && /patient data on the tab/.test(en.t || ''), en);
  ok('11 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
