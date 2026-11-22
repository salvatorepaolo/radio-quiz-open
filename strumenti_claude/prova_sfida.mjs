// prova_sfida.mjs: sfida tra amici nel browser (simulatore locale). Ada crea la sfida scegliendo i casi; il link /s/<codice>
// porta alla pagina pubblica; Bea accetta con il nome in classifica, risolve i casi senza correzioni fino alla fine, poi
// vede classifica e correzioni; Ada vede Bea in classifica. Schermate in /tmp/sfida-*.png
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23901, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const api = async (cookie, url, corpo) => { const r = await fetch(B + url, { method: corpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined }); return { r, j: await r.json().catch(() => null) }; };
const entra = async (codice) => (await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice }) })).headers.get('set-cookie').split(';')[0];
const admin = await entra('admin-test-0000');
const nuovo = async (nome) => entra((await api(admin, '/api/account', { nome, ruolo: 'specializzando' })).j.codice);
const ckAda = await nuovo('Ada Prova'), ckBea = await nuovo('Bea Prova');
const b = await chromium.launch(), err = [];
const pagina = async (ck) => {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-guida-vista', '1'); } catch {} });
  if (ck) { const [n, v] = ck.split('='); await ctx.addCookies([{ name: n, value: v, url: B }]); }
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message)); p.on('dialog', (d) => d.accept()); return p;
};
const rispondiCaso = async (p) => {
  await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 20000 });
  await p.waitForFunction(() => document.querySelector('#q-form input'), null, { timeout: 30000 });
  for (let k = 0; k < 15; k++) {
    await p.evaluate(() => { const i = [...document.querySelectorAll('#q-form input[type=checkbox], #q-form input[type=radio]')].find((x) => x.offsetParent); if (i && !i.checked) i.click(); i?.closest('.opz')?.querySelector('button[data-conf]')?.click(); });
    await p.waitForTimeout(250);
    await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); });
    const bt = await p.$('#btn-conferma:not([hidden])'); if (bt && await bt.isVisible()) { await bt.evaluate((e) => e.click()); return; }
    const av = await p.$('#q-succ:not([hidden])'); if (av) await av.evaluate((e) => e.click()); else return;
    await p.waitForTimeout(200);
  }
};
let codice = '';
try {
  // Ada crea la sfida
  const a = await pagina(ckAda);
  await a.goto(B + '/#/sfide'); await a.waitForSelector('#sfida-corpo .sf-testa', { timeout: 20000 });
  esito(await a.isVisible('a[data-nav="sfide"]'), 'menu in alto: voce «Sfide»');
  await a.click('text=Crea una sfida'); await a.waitForSelector('#sf-lista .sf-voce');
  await a.fill('#sf-titolo', 'Sfida di prova del lunedì');
  const voci = await a.$$('#sf-lista .sf-voce input'); for (const v of voci.slice(0, 3)) await v.check();
  esito(await a.$eval('#sf-conta', (e) => e.textContent) === '3 casi scelti' && !(await a.$eval('#sf-crea', (e) => e.disabled)), 'scelta di 3 casi: «Crea la sfida» attivo');
  await a.click('#sf-crea'); await a.waitForFunction(() => /#\/sfida\/[A-Z2-9]{8}$/.test(location.hash), null, { timeout: 15000 });
  codice = await a.evaluate(() => location.hash.split('/').pop());
  await a.waitForSelector('#sf-link');
  esito((await a.$eval('#sf-link', (e) => e.value)).endsWith('/s/' + codice), 'sfida creata: link /s/codice da condividere', codice);
  esito((await a.$$('.sf-social a')).length >= 5, 'pulsanti WhatsApp, LinkedIn, Facebook, X, email');
  await a.screenshot({ path: '/tmp/sfida-creata.png', fullPage: true });
  // senza accesso: /s/codice → pagina pubblica
  const n = await pagina(null);
  await n.goto(B + '/s/' + codice); await n.waitForSelector('#sf-entra', { timeout: 20000 });
  esito(n.url().endsWith('#/sfida/' + codice), 'il link /s/ porta alla pagina della sfida');
  esito(/Sfida di prova del lunedì/.test(await n.textContent('#sfida-corpo')) && (await n.$$('.sf-casi li')).length === 3, 'pagina pubblica: titolo e 3 esami');
  await n.screenshot({ path: '/tmp/sfida-pubblica.png', fullPage: true });
  await n.click('#sf-entra'); await n.waitForSelector('#vista-accesso:not([hidden])');
  esito(await n.evaluate(() => !!localStorage.getItem('rq-sfida-dopo')), 'dopo l\'accesso si torna alla sfida (ricordata)');
  // Bea accetta e gioca
  const p = await pagina(ckBea);
  await p.goto(B + '/#/sfida/' + codice); await p.waitForSelector('#sf-accetta', { timeout: 20000 });
  await p.check('#sf-in-classifica'); await p.fill('#sf-nome', 'Bea la Rossa');
  await p.click('#sf-accetta');
  for (let i = 0; i < 3; i++) {
    await p.waitForFunction(() => location.hash.startsWith('#/caso/'), null, { timeout: 20000 });
    await p.waitForSelector('#q-casuale:not([hidden])', { timeout: 20000 });
    const barra = await p.$eval('#q-casuale', (e) => e.textContent);
    esito(new RegExp(`caso ${i + 1} di 3`).test(barra) && /correzioni alla fine/.test(barra), `caso ${i + 1}: barra della sfida`, barra.replace(/\s+/g, ' ').slice(0, 90));
    const h = await p.evaluate(() => location.hash);
    await rispondiCaso(p);
    await p.waitForFunction((h0) => location.hash !== h0, h, { timeout: 20000 });
    esito(true, `caso ${i + 1}: consegnato senza correzione, si va avanti`);
  }
  await p.waitForFunction(() => location.hash === '#/sfida/' + document.querySelector('#sf-link')?.value.split('/').pop() || /#\/sfida\//.test(location.hash), null, { timeout: 20000 });
  await p.waitForSelector('.sf-classifica', { timeout: 20000 });
  const tab = await p.$eval('.sf-classifica', (e) => e.textContent);
  esito(/Bea la Rossa/.test(tab) && /3\/3/.test(tab), 'fine: Bea in classifica con 3/3', tab.replace(/\s+/g, ' ').slice(0, 80));
  esito(await p.isVisible('#sf-corr'), 'fine: «Mostra le correzioni»');
  await p.click('#sf-corr'); esito((await p.$$('#sf-corr-box .sf-corr')).length === 3, 'correzioni dei 3 casi');
  await p.screenshot({ path: '/tmp/sfida-fine.png', fullPage: true });
  // Ada vede Bea in classifica
  await a.goto(B + '/#/sfide'); await a.goto(B + '/#/sfida/' + codice); await a.waitForSelector('.sf-classifica', { timeout: 20000 });
  esito(/Bea la Rossa/.test(await a.$eval('.sf-classifica', (e) => e.textContent)), 'chi ha creato la sfida vede la classifica');
  const el = await api(ckBea, '/api/sfide'); esito(el.j?.[0]?.mio?.finito === true, 'elenco delle sfide di Bea: completata');
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!err.length, 'nessun errore JavaScript', err.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
