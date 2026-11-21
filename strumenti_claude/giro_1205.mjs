// giro_1205: telefono e inglese sulle funzioni nuove (barra, annotazioni, referto), tempi di apertura
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19600 + Math.floor(Math.random() * 300), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const out = {};
try {
  const ctx0 = await b.newContext(); const a = await ctx0.newPage(); await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Giro', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice)); await ctx0.close();
  for (const [nome, opz, lang] of [['tel', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, 'it'], ['en', { viewport: { width: 1440, height: 900 } }, 'en']]) {
    const ctx = await b.newContext({ ...opz, locale: lang === 'en' ? 'en-US' : 'it-IT' }); const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message));
    await p.goto(B + `/?prova&lang=${lang}#/`); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
    const t0 = Date.now(); await p.goto(B + `/?prova&lang=${lang}#/caso/caso-tcia-001`); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); out[nome + '_apertura_ms'] = Date.now() - t0; await p.waitForTimeout(1500);
    out[nome + '_largo'] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    out[nome + '_barra'] = await p.evaluate(() => [...document.querySelectorAll('#grp-client > *')].filter((e) => e.offsetParent).map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) + ` [${Math.round(e.getBoundingClientRect().width)}px]`));
    out[nome + '_italiano_rimasto'] = await p.evaluate(() => { const w = document.createTreeWalker(document.querySelector('#vista-caso'), NodeFilter.SHOW_TEXT); const r = []; for (let n = w.nextNode(); n; n = w.nextNode()) { const s = n.data.trim(); if (n.parentElement.offsetParent && /\b(della|delle|immagin|annotazion|salva|chiudi|referto|serie)\b/i.test(s) && s.length < 90) r.push(s); } return [...new Set(r)].slice(0, 15); });
    await p.screenshot({ path: `/Volumes/Caloggero/_viste/giro_${nome}.png` });
    if (nome === 'en') { await p.click('#cl-referto'); await p.waitForTimeout(800); out.en_referto = await p.evaluate(() => [...document.querySelectorAll('#dlg-referto label, #dlg-referto button, #dlg-referto .ref-etich, #dlg-referto p')].filter((e) => e.offsetParent).map((e) => e.textContent.trim().slice(0, 50)).filter((s) => /[àèéìòù]|\b(della|il|le|del|con)\b/.test(s)).slice(0, 15)); await p.screenshot({ path: '/Volumes/Caloggero/_viste/giro_en_referto.png' }); }
    out[nome + '_errori'] = err; await ctx.close();
  }
} catch (e) { out.ERRORE = String(e); } finally { console.log(JSON.stringify(out, null, 1)); await b.close(); sim.kill(); }
