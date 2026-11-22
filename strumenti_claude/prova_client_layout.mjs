// prova_client_layout.mjs (1.301): impaginazione del visualizzatore scaricabile (client) con un esame TC aperto, a più larghezze.
// - 2D e MPR + 3D: nessuno spazio vuoto tra la barra degli strumenti e le immagini (nella 1.278-1.300, in MPR, metà altezza vuota);
// - le immagini (o le viste MPR) occupano quasi tutto lo spazio tra la barra e la striscia delle serie;
// - la barra in alto e quella degli strumenti non escono dallo schermo;
// - un vetrino accanto alle immagini: TC e vetrino affiancati, tutti e due grandi; nessun errore JavaScript.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23901, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const tutti = (d) => fs.readdirSync(d, { recursive: true }).filter((x) => /\.dcm$/i.test(x)).map((x) => path.join(d, x));
const ESAME = '/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-004/serie', VETRINO = path.join(os.homedir(), 'rq-vetrini', 'jp2k');
const b = await chromium.launch(), err = [];
// misure: barra degli strumenti, area delle immagini (stage o MPR), striscia delle serie, debordi orizzontali
const misura = (p) => p.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const q = e.getBoundingClientRect(); return q.width && q.height ? q : null; };
  const barra = r('#vista-caso .barra-unica'), img = r('#mpr') || r('#stage'), serie = r('#vista-caso aside.serie'), h = document.querySelector('header.top'), bu = document.querySelector('#vista-caso .barra-unica');
  const fondo = serie && serie.top > (img?.top || 0) ? serie.top : innerHeight;
  return { buco: img && barra ? Math.round(img.top - barra.bottom) : null, quota: img && barra ? +((img.height) / (fondo - barra.bottom)).toFixed(2) : null,
    hImg: img ? Math.round(img.height) : 0, debordoTesta: h.scrollWidth - h.clientWidth, debordoBarra: bu ? bu.scrollWidth - bu.clientWidth : 0, mpr: !!r('#mpr') };
});
try {
  for (const [w, hh] of [[1290, 900], [1440, 900], [1920, 1080], [1000, 800]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: hh }, locale: 'it-IT' }); await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
    const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(`${w}: ${e.message}`));
    await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    await p.setInputFiles('#cl-file', tutti(ESAME)); await p.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 90000 }); await p.waitForTimeout(1200);
    const d2 = await misura(p);
    esito(d2.buco !== null && d2.buco <= 20 && d2.quota >= 0.8 && d2.debordoTesta <= 1, `${w}×${hh} 2D: immagini subito sotto la barra e grandi, barra in alto senza debordi`, JSON.stringify(d2));
    await p.click('#modo-mpr'); await p.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#vp-assiale canvas'), null, { timeout: 120000 }); await p.waitForTimeout(2000);
    const dm = await misura(p);
    esito(dm.mpr && dm.buco !== null && dm.buco <= 20 && dm.quota >= 0.8 && dm.debordoTesta <= 1, `${w}×${hh} MPR + 3D: viste subito sotto la barra e grandi (niente spazio vuoto)`, JSON.stringify(dm));
    await ctx.close();
  }
  // vetrino accanto all'esame
  if (fs.existsSync(VETRINO)) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' }); await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
    const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(`vetrino: ${e.message}`)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    await p.setInputFiles('#cl-file', [...tutti(ESAME), ...tutti(VETRINO)]); await p.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 120000 }); await p.waitForTimeout(1500);
    const bv = await p.$('#btn-vetrini:not([hidden])');
    if (bv) {
      await bv.click(); await p.waitForSelector('#vista-vetrino .vt-modo-accanto', { timeout: 90000 }); await p.click('#vista-vetrino .vt-modo-accanto');
      await p.waitForFunction(() => document.querySelector('#vt-accanto') && window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 90000 }); await p.waitForTimeout(1500);
      const a = await p.evaluate(() => { const s = document.querySelector('#stage').getBoundingClientRect(), v = document.querySelector('#vt-accanto .vt-osd').getBoundingClientRect(); return { tc: [Math.round(s.width), Math.round(s.height)], vetrino: [Math.round(v.width), Math.round(v.height)] }; });
      esito(a.tc[0] > 400 && a.tc[1] > 300 && a.vetrino[0] > 400 && a.vetrino[1] > 250, 'vetrino accanto all\'esame: TC e vetrino affiancati, tutti e due grandi', JSON.stringify(a));
    } else esito(false, 'vetrino accanto all\'esame', 'pulsante 🔬 non comparso');
    await ctx.close();
  } else console.log('(vetrini di prova assenti: parte del vetrino saltata)');
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!err.length, 'nessun errore JavaScript', err.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
