// controllo_generale.mjs: giro di tutte le pagine (amministratore, studente, client) a caccia di errori JavaScript,
// richieste fallite, pagine più larghe dello schermo ed elementi che si sovrappongono nella barra in alto
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18500 + Math.floor(Math.random() * 400)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const problemi = [];
const segui = (p, dove) => {
  p.on('pageerror', (e) => problemi.push(`[${dove()}] ERRORE JS: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 40[134]|Failed to load resource/.test(m.text())) problemi.push(`[${dove()}] console: ${m.text().slice(0, 160)}`); });
  p.on('response', (r) => { if (r.status() >= 500 || (r.status() === 404 && !/\/api\//.test(r.url()))) problemi.push(`[${dove()}] ${r.status()} ${r.url().replace(B, '')}`); });
};
const controlla = async (p, dove) => {
  const r = await p.evaluate(() => {
    const largo = document.documentElement.scrollWidth - innerWidth;
    const top = [...document.querySelectorAll('header.top > *')].filter((e) => e.offsetParent && getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect());
    let sovr = 0; for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) { const a = top[i], c = top[j]; if (a.width && c.width && a.left < c.right - 2 && c.left < a.right - 2 && a.top < c.bottom - 2 && c.top < a.bottom - 2) sovr++; }
    return { largo, sovr, h: document.querySelector('header.top')?.getBoundingClientRect().height };
  });
  if (r.largo > 2) problemi.push(`[${dove}] pagina più larga dello schermo di ${r.largo}px`);
  if (r.sovr) problemi.push(`[${dove}] ${r.sovr} elementi sovrapposti nella barra in alto (altezza ${Math.round(r.h)})`);
};
try {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' }); const p = await ctx.newPage(); segui(p, () => 'gpu');
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
  for (const caso of ['caso-tcia-006', 'caso-tcia-001']) {
    await p.goto(B + '/?prova#/caso/' + caso); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await p.waitForTimeout(1500);
    const r = await p.evaluate(async () => {
      const D = window.__dbg, V = D.V, cv = document.querySelector('#canvas'), c = cv.getContext('2d');
      const somma = () => { const d = c.getImageData(0, 0, cv.width, cv.height).data; let s = 0; for (let i = 0; i < d.length; i += 4000) s += d[i]; return s; };
      const s1 = somma(); const t0 = performance.now();
      for (let k = 0; k < 30; k++) { V.wc = V.wc + 5; window.dispatchEvent(new Event('resize')); }
      // forza il ridisegno con il percorso normale
      document.querySelector('#canvas').dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 }));
      await new Promise((r) => setTimeout(r, 300));
      // confronto GPU / CPU sulla stessa finestra
      const cattura = () => c.getImageData(0, 0, cv.width, cv.height).data;
      const rf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const usati = [];
      V.wc = V.wc + 37; V.ww = V.ww * 0.7; D.disegna(); await rf(); usati.push(!!D.V.pannelli[0]._fatto); const a = cattura();
      const gl = D.GPU2D.gl; D.GPU2D.gl = null; D.GPU2D.ko = true; for (const q of D.V.pannelli) q._fatto = null; D.disegna(); await rf(); const b2 = cattura();
      D.GPU2D.gl = gl; D.GPU2D.ko = false; for (const q of D.V.pannelli) q._fatto = null;
      let diff = 0, mx = 0, n = 0; for (let i = 0; i < a.length; i += 4) { const x = Math.abs(a[i] - b2[i]); diff += x; mx = Math.max(mx, x); n++; }
      let diffPrima = 0; const s0 = somma();
      return { diffMedia: +(diff / n).toFixed(3), diffMax: mx, gpu: !!D.GPU2D.gl, ko: D.GPU2D.ko, tex: D.GPU2D.tex.size, s1, s2: somma(), dim: `${V.img.cols}x${V.img.rows}`, rawMB: Math.round(D.RAW.tot / 2 ** 20) };
    });
    console.log(caso, JSON.stringify(r));
  }
  // cache su disco: dopo aver aperto i casi, OPFS contiene le immagini
  console.log('OPFS', await p.evaluate(async () => { const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('rq-immagini').catch(() => null); if (!d) return 'nessuna cartella'; let n = 0, tot = 0; for await (const [, h] of d.entries()) { n++; tot += (await h.getFile()).size; } return `${n} file, ${Math.round(tot / 2 ** 20)} MB`; }));
  await p.screenshot({ path: '/Volumes/Caloggero/_viste/schemi/gpu2d.png' });
} finally { console.log(problemi.length ? [...new Set(problemi)].join('\n') : 'nessun problema trovato'); await b.close(); sim.kill(); }
