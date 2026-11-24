// prova_vetrini_iphone.mjs (1.321): su iPhone (WebKit, densità 3) i pulsanti 20× e 40× del vetrino si attivano e portano all'ingrandimento giusto
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', { webkit, chromium, devices } = createRequire(T + 'package.json')('playwright');
const PORTA = 23961, B = `http://localhost:${PORTA}`, OUT = '/Volumes/Caloggero/strumenti_claude/schermate_iphone/'; fs.mkdirSync(OUT, { recursive: true });
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const entra = async (codice) => (await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice }) })).headers.get('set-cookie').split(';')[0];
const admin = await entra('admin-test-0000');
const stud = await entra((await (await fetch(B + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json', cookie: admin }, body: JSON.stringify({ nome: 'Prova iPhone', ruolo: 'specializzando' }) })).json()).codice);
let ok = 0, ko = 0; const esito = (c, m, d = '') => { c ? ok++ : ko++; console.log(`${c ? 'OK' : 'KO'}  ${m}${d !== '' ? ' → ' + d : ''}`); };
for (const [nomeB, motore, disp] of [['iPhone 13 (WebKit)', webkit, devices['iPhone 13']], ['iPhone 15 Pro Max (WebKit)', webkit, devices['iPhone 15 Pro Max'] || devices['iPhone 14 Pro Max']], ['Mac (Chromium, densità 2)', chromium, { viewport: { width: 1300, height: 850 }, deviceScaleFactor: 2 }]]) {
  const b = await motore.launch(), ctx = await b.newContext({ ...disp }), err = [];
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-guida-vista', '1'); } catch {} });
  const [n, v] = stud.split('='); await ctx.addCookies([{ name: n, value: v, url: B }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message));
  await p.goto(B + '/#/caso/caso-tcia-138'); await p.waitForSelector('.vt-ingr', { timeout: 60000 }); await p.waitForTimeout(3000);
  const st = () => p.evaluate(() => ({ dpr: devicePixelRatio, at: document.querySelector('.vt-ingr-at')?.textContent, pulsanti: [...document.querySelectorAll('.vt-ingr')].map((b) => `${b.dataset.m}${b.disabled ? '(spento)' : ''}${b.classList.contains('on') ? '*' : ''}`).join(' ') }));
  const s0 = await st(); console.log(nomeB, JSON.stringify(s0));
  for (const m of ['20', '40']) {
    const btn = p.locator(`.vt-ingr[data-m="${m}"]`).first();
    const vis = await btn.isVisible().catch(() => false), dis = await btn.isDisabled().catch(() => true);
    esito(vis && !dis, `${nomeB}: pulsante ${m}× visibile e attivo`, `visibile ${vis}, spento ${dis}`);
    if (!vis || dis) continue;
    await btn.click(); await p.waitForTimeout(3500);
    const s = await st();
    const pix = await p.evaluate(() => { const c = document.querySelector('.vt-osd canvas'); if (!c) return 0; const g = c.getContext('2d'), d = g.getImageData(c.width / 4, c.height / 4, c.width / 2, c.height / 2).data; let col = 0; for (let i = 0; i < d.length; i += 4 * 97) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx - mn > 25) col++; } return Math.round(100 * col / (d.length / (4 * 97))); });
    esito(s.at === `${m}×` && pix > 3, `${nomeB}: a ${m}× ingrandimento giusto e tessuto disegnato`, `${s.at}, ${pix}% pixel colorati`);
    await p.screenshot({ path: `${OUT}${nomeB.split(' ')[0]}-${nomeB.includes('Pro') ? 'pro-' : ''}${m}x.png` });
  }
  esito(!err.length, `${nomeB}: nessun errore JavaScript`, err.join(' | ').slice(0, 300));
  await b.close();
}
console.log(`\n${ok} OK, ${ko} KO`); sim.kill(); process.exit(ko ? 1 : 0);
