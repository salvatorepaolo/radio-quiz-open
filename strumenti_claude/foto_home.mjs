// Immagini della home (1.246): il visualizzatore con un caso pubblico (TCIA, CC BY), per mostrare il prodotto
import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const B = 'http://localhost:19777', OUT = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/img/';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2, locale: 'it-IT' });
const p = await ctx.newPage();
await p.goto(B + '/?prova#/');
await p.evaluate(async () => { await fetch('/api/iscrizione', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'Utente Demo', email: 'foto' + Date.now() + '@example.com', password: 'prova-sicura-2026', categoria: 'specializzando', privacy: true, maggiorenne: true }) }); });   // gitleaks:allow (account di prova sul simulatore locale)
const link = (await p.evaluate(() => fetch('/__posta').then((x) => x.text()))).match(/#\/conferma\/[\w.-]+/g).pop();
await p.goto(B + '/?prova' + link); await p.waitForTimeout(2500);
await p.evaluate(() => { try { localStorage.setItem('rq-barra', 'essenziali'); } catch {} });
await p.goto(B + '/?prova#/caso/caso-tcia-062'); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await p.waitForTimeout(2500);
// riquadro A sull'immagine con la lesione, B FLAIR alla stessa altezza
await p.evaluate(async () => { const V = window.__dbg.V; for (let k = 0; k < 16; k++) { document.querySelector('#viewer canvas, canvas')?.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, clientX: 300, clientY: 400 })); await new Promise((r) => setTimeout(r, 60)); } });
await p.waitForTimeout(1200);
await p.screenshot({ path: OUT + 'anteprima-caso.png', fullPage: false });
await b.close(); console.log('ok');
