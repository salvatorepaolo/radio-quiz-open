// prova_video.mjs: video DICOM nel visualizzatore client: H.264 e HEVC (1.263). I file si creano con crea_video_dicom.mjs.
// HEVC dipende dal browser (WebCodecs con decodificatore H.265): se manca, deve comparire un messaggio chiaro, non un errore.
// Uso: node prova_video.mjs   (BROWSER=webkit per il motore di Safari)
import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const QUI = path.dirname(new URL(import.meta.url).pathname), T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const pw = createRequire(T + 'package.json')('playwright'), motore = pw[process.env.BROWSER || 'chromium'];
if (!fs.existsSync(path.join(QUI, 'video_prova/prova_hevc.dcm'))) execFileSync(process.execPath, [path.join(QUI, 'crea_video_dicom.mjs')], { stdio: 'inherit' });
const PORTA = +process.env.PORTA_PROVA || (19410 + Math.floor(Math.random() * 20)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await motore.launch();
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
try {
  for (const [nome, file] of [['H.264', 'prova_h264.dcm'], ['HEVC', 'prova_hevc.dcm']]) {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 850 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
    const c = await ctx.newPage(), errori = []; c.on('pageerror', (e) => errori.push(e.message));
    await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    const supporta = nome === 'HEVC' ? await c.evaluate(async () => { try { return typeof VideoDecoder !== 'undefined' && (await VideoDecoder.isConfigSupported({ codec: 'hvc1.1.6.L60.90' })).supported; } catch { return false; } }) : true;
    await c.setInputFiles('#cl-file', [path.join(QUI, 'video_prova', file)]);
    const aperto = await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }).then(() => true, () => false);
    await c.waitForTimeout(1500);
    const st = await c.evaluate(() => { const d = window.__dbg, p = d?.P?.(d.V.attivo); return { n: p?.frames?.length, w: p?.img?.cols, rgb: !!p?.img?.rgb, stato: document.querySelector('#cl-stato')?.textContent?.slice(0, 160), caricamento: document.querySelector('#caricamento')?.textContent?.slice(0, 160) }; }).catch(() => ({}));
    if (supporta) esito(aperto && st.n === 40 && st.w === 256, `${nome}: 40 fotogrammi 256×256 visualizzati`, JSON.stringify(st));
    else esito(/HEVC|H\.265|video/i.test(`${st.stato} ${st.caricamento}`), `${nome}: questo browser non lo decodifica, e lo dice chiaramente`, `${st.stato} | ${st.caricamento}`);
    esito(!errori.length, `${nome}: nessun errore JavaScript`, errori.slice(0, 2).join(' | ').slice(0, 200));
    await ctx.close();
  }
} finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
