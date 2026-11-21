// misura_caricamento.mjs: che cosa si scarica aprendo un caso (simulatore locale): byte per serie, per tipo di file,
// tempo alla prima immagine disegnata. Computer e telefono (390×844, rete 4G lenta simulata a 1,6 Mbit/s, 150 ms).
// Uso: node misura_caricamento.mjs [caso] [secondi di osservazione]
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASO = process.argv[2] || 'caso-tcia-001', SEC = +(process.argv[3] || 20);
const { chromium } = createRequire(T + 'package.json')('playwright');
import fs from 'node:fs';
const SITO = process.env.SITO, PORTA = +process.env.PORTA_PROVA || 19900, B = SITO || `http://localhost:${PORTA}`;
const CODICE = SITO ? (fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/cloud/.segreti', 'utf8').match(/^CODICE_AMMINISTRATORE="(.*)"/m) || [])[1] : 'admin-test-0000';
const sim = SITO ? { kill() {} } : spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
if (!SITO) await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
for (const [nome, opz, lenta] of [['computer', { viewport: { width: 1400, height: 900 } }, false], ['telefono', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true]]) {
  const ctx = await b.newContext({ locale: 'it-IT', ...opz }), p = await ctx.newPage();
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', CODICE); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  const cdp = await ctx.newCDPSession(p);
  if (lenta) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  const per = new Map(), tipi = new Map(); let tot = 0, n = 0;
  p.on('response', async (r) => { const u = r.url().replace(B, ''); let len = 0; try { len = +(r.headers()['content-length'] || 0) || (await r.body()).length; } catch {} tot += len; n++;
    const m = u.match(/\/casi\/[^/]+\/serie\/([^/]+)\//), k = m ? m[1].slice(0, 40) : (u.match(/\.(\w+)(\?|$)/)?.[1] || 'altro');
    const t = m ? 'dicom serie' : /\.js/.test(u) ? 'js' : /\.css/.test(u) ? 'css' : /\.(png|jpe?g|webp|svg)/.test(u) ? 'immagini' : /\.json|\/api\//.test(u) ? 'json/api' : 'altro';
    const e = per.get(k) || { n: 0, b: 0, f: [] }; e.n++; e.b += len; e.f.push(u.split('/').pop() + (r.status() === 206 ? ' (parziale)' : '')); per.set(k, e); tipi.set(t, (tipi.get(t) || 0) + len); });
  const t0 = Date.now(); await p.goto(B + `/?prova&x=${nome}#/caso/${CASO}`);
  const prima = await p.waitForFunction(() => { if (window.__dbg) return !!window.__dbg.P(0)?.img; const c = document.querySelector('#vista-caso:not([hidden]) #stage canvas, #vista-caso:not([hidden]) canvas'); if (!c || !c.width) return false; try { const t = document.createElement('canvas'); t.width = 32; t.height = 32; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 32, 32); const d = g.getImageData(0, 0, 32, 32).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]; return s > 3000; } catch { return false; } }, null, { timeout: 120000, polling: 100 }).then(() => Date.now() - t0, () => null);
  await p.waitForTimeout(SEC * 1000);
  console.log(`\n== ${nome}: prima immagine in ${prima} ms; dopo ${SEC} s: ${n} richieste, ${(tot / 1e6).toFixed(1)} MB`);
  console.log('   per tipo:', [...tipi].map(([k, v]) => `${k} ${(v / 1e6).toFixed(2)} MB`).join(' · '));
  for (const [k, e] of [...per].filter(([, e]) => e.b > 50e3).sort((a, b) => b[1].b - a[1].b).slice(0, 12)) console.log(`   ${k.padEnd(42)} ${String(e.n).padStart(4)} file ${(e.b / 1e6).toFixed(2).padStart(7)} MB${e.n <= 6 ? '  ' + e.f.join(', ') : ''}`); // ELENCO
  
  await ctx.close();
}
await b.close(); sim.kill();
