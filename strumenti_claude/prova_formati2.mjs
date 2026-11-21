// prova_formati2.mjs: JPEG 12 bit, JPEG RGB senza trasformazione, video H.264 nel client
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/fmt_';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] }); const err = [];
try {
  for (const f of ['/Volumes/Caloggero/_viste/dicom_reali/JPEG-lossy.dcm', '/Volumes/Caloggero/_viste/dicom_reali/SC_jpeg_no_color_transform.dcm', '/Volumes/Caloggero/_viste/dicom_reali/SC_rgb_jpeg_dcmtk.dcm', '/Volumes/Caloggero/_viste/dicom_prova/video_h264.dcm']) {
    const c = await b.newPage({ viewport: { width: 1200, height: 800 } }); c.on('pageerror', (e) => err.push(e.message)); c.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
    await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    await c.setInputFiles('#cl-file', [f]);
    const okk = await c.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 30000 }).then(() => true).catch(() => false);
    await c.waitForTimeout(1500);
    const st = await c.evaluate(() => { const V = window.__dbg?.V; const im = V?.img; return im ? { w: im.cols, h: im.rows, rgb: !!im.rgb, n: window.__dbg.P().frames.length, med: (() => { const p = im.rgb || im.pix; let s = 0; for (let i = 0; i < p.length; i += 97) s += p[i]; return Math.round(s / (p.length / 97)); })() } : { stato: document.querySelector('#cl-stato')?.textContent }; });
    if (okk && st.n > 1) { await c.keyboard.press('ArrowDown'); await c.keyboard.press('ArrowDown'); await c.waitForTimeout(400); }
    console.log(f.split('/').pop(), okk, JSON.stringify(st));
    await c.screenshot({ path: OUT + f.split('/').pop().replace('.dcm', '.png') }); await c.close();
  }
} finally { console.log('errori', JSON.stringify(err.slice(0, 6))); await b.close(); sim.kill(); }
