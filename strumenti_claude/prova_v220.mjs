// prova_v220.mjs: client — esami recenti (elenco, ricerca, riapertura), precedente automatico dello stesso paziente,
// cartella predefinita spenta di base e solo nel client
import { spawn, execSync } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18900 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
// due studi dello stesso paziente (dal caso 110, basale e controllo), con nome, ID e date di prova
const D = '/tmp/rq-arch'; fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D);
execSync(`/Users/salvatorepaolobuemi/.radioquiz-ia/venv/bin/python - <<'EOF'
import json, os, pydicom
c='/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110'; s=json.load(open(c+'/serie.json')); l=s if isinstance(s,list) else s.get('serie',[])
for nome, data, rx in (('a','20240115','Studio 1'),('b','20250120','Studio 2')):
    x=[y for y in l if y.get('descrizione','').startswith(rx)][0]; os.makedirs('${D}/'+nome, exist_ok=True)
    fs=x['files']; passo=max(1,len(fs)//12)
    for i,f in enumerate(fs[::passo][:12]):
        d=pydicom.dcmread(os.path.join(c,f)); d.PatientName='ROSSI^MARIO'; d.PatientID='PROVA123'; d.PatientBirthDate='19600101'; d.StudyDate=data; d.Modality='CT'
        d.save_as('${D}/'+nome+'/img%03d.dcm'%i)
EOF`);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
let ctx; try {
  ctx = await chromium.launchPersistentContext(fs.mkdtempSync('/tmp/rq-profilo-'), { viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  const c = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); c.on('pageerror', (e) => errori.push(e.message)); c.on('console', (m) => { if (/archivio|warn/i.test(m.type() + m.text())) console.log('   console', m.type(), m.text().slice(0, 200)); });
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  const imp = await c.evaluate(() => ({ recenti: document.querySelector('#cl-imp-recenti').checked, cartella: document.querySelector('#cl-imp-cartella').checked, box: document.querySelector('#cl-cartella-box').hidden }));
  ok('1 impostazioni: recenti attivi, cartella predefinita spenta di base', imp.recenti && !imp.cartella && imp.box, imp);
  // carica una cartella in OPFS (stessa interfaccia delle cartelle scelte dall'utente) e la apre
  const apri = async (nome) => {
    await c.evaluate(() => { document.querySelector('#prova-in')?.remove(); const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.id = 'prova-in'; document.body.append(i); });
    await c.setInputFiles('#prova-in', fs.readdirSync(path.join(D, nome)).map((f) => path.join(D, nome, f)));
    await c.evaluate(async (nome) => {
      const radice = await navigator.storage.getDirectory(), dir = await radice.getDirectoryHandle('esame-' + nome, { create: true });
      for (const f of document.querySelector('#prova-in').files) { const h = await dir.getFileHandle(f.name, { create: true }), w = await h.createWritable(); await w.write(f); await w.close(); }
      const fl = await window.__dbg.fileDaManiglie([dir]); await window.__dbg.ricordaManiglie([dir]); await window.__dbg.caricaClient(fl);
    }, nome);
    await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(1500);
  };
  await apri('a');
  await c.goto(B + '/client/index.html#/'); await c.waitForSelector('#vista-client:not([hidden])'); await c.waitForTimeout(1200);
  const el = await c.evaluate(() => ({ vis: !document.querySelector('#cl-recenti').hidden, righe: [...document.querySelectorAll('#cl-rec-lista tbody tr')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()) }));
  ok('2 home: esame negli «Esami recenti» con paziente e data', el.vis && el.righe.length === 1 && /ROSSI MARIO/.test(el.righe[0]) && /15\/01\/2024/.test(el.righe[0]), el);
  await c.fill('#cl-rec-cerca', 'rossi 2024'); await c.waitForTimeout(300);
  const c1 = await c.evaluate(() => document.querySelectorAll('#cl-rec-lista tbody tr').length);
  await c.fill('#cl-rec-cerca', 'bianchi'); await c.waitForTimeout(300);
  const c2 = await c.evaluate(() => document.querySelectorAll('#cl-rec-lista tbody tr').length);
  ok('3 ricerca per nome e data', c1 === 1 && c2 === 0, { c1, c2 }); await c.fill('#cl-rec-cerca', ''); await c.waitForTimeout(300);
  // riapertura con un clic
  await c.click('#cl-rec-lista [data-apri="0"]'); await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }).catch(() => {}); await c.waitForTimeout(1200);
  ok('4 «Apri» riapre l\'esame', await c.evaluate(() => location.hash === '#/caso/locale' && !!window.__dbg.V.img));
  // secondo studio dello stesso paziente: propone il precedente
  await apri('b'); await c.waitForSelector('#cl-precedente:not([hidden])', { timeout: 10000 }).catch(() => {});
  const pr = await c.evaluate(() => { const b = document.querySelector('#cl-precedente'); return b && !b.hidden ? b.textContent.replace(/\s+/g, ' ') : ''; });
  ok('5 precedente dello stesso paziente proposto', /precedente/.test(pr) && /15\/01\/2024/.test(pr), pr);
  const n0 = await c.evaluate(() => window.__dbg.V.serie.length);
  await c.click('#cl-prec-apri'); await c.waitForFunction((n0) => window.__dbg?.V?.serie?.length > n0, n0, { timeout: 60000 }).catch(() => {}); await c.waitForTimeout(1500);
  const conf = await c.evaluate(() => ({ serie: window.__dbg.V.serie.map((s) => s.descrizione), n: window.__dbg.V.n }));
  ok('6 «Confronta» aggiunge il precedente (due studi)', conf.serie.some((d) => /^Studio 1/.test(d)) && conf.serie.some((d) => /^Studio 2/.test(d)), conf);
  // spegnere i recenti svuota l'elenco
  await c.goto(B + '/client/index.html#/'); await c.waitForSelector('#vista-client:not([hidden])'); await c.waitForTimeout(800);
  await c.evaluate(() => { document.querySelector('#cl-impostazioni').open = true; }); await c.click('#cl-imp-recenti'); await c.waitForTimeout(800);
  ok('7 recenti spenti: elenco vuoto e nascosto', await c.evaluate(() => document.querySelector('#cl-recenti').hidden && !document.querySelectorAll('#cl-rec-lista tbody tr').length));
  // cartella predefinita (accesa a mano): qui la cartella è quella di prova del browser con i due studi
  await c.evaluate(async () => { const radice = await navigator.storage.getDirectory();
    await new Promise((ok, ko) => { const r = indexedDB.open('rq-client'); r.onerror = () => ko(r.error); r.onsuccess = () => { const tx = r.result.transaction('cartella', 'readwrite'); tx.objectStore('cartella').put(radice, 'predefinita'); tx.oncomplete = () => { r.result.close(); ok(); }; tx.onerror = () => ko(tx.error); }; }); });
  await c.evaluate(() => { const x = document.querySelector('#cl-imp-cartella'); x.checked = true; x.dispatchEvent(new Event('change')); }); await c.waitForTimeout(500);
  await c.click('#cl-cartella-leggi'); await c.waitForFunction(() => /studi in/.test(document.querySelector('#cl-cartella-stato').textContent), null, { timeout: 30000 }).catch(() => {});
  const ca = await c.evaluate(() => ({ stato: document.querySelector('#cl-cartella-stato').textContent, righe: [...document.querySelectorAll('#cl-rec-lista tbody tr')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()) }));
  ok('8a cartella predefinita: elenco degli studi letti dalla cartella', /2 studi in/.test(ca.stato) && ca.righe.length === 2 && ca.righe.every((r) => /cartella/.test(r)), ca);
  await c.click('#cl-rec-lista [data-apri="0"]'); await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }).catch(() => {}); await c.waitForTimeout(1000);
  ok('8b studio aperto dalla cartella con un clic', await c.evaluate(() => location.hash === '#/caso/locale' && window.__dbg.V.serie.length === 1));
  await c.goto(B + '/client/index.html#/'); await c.waitForSelector('#vista-client:not([hidden])'); await c.waitForTimeout(800);
  await c.evaluate(() => { document.querySelector('#cl-impostazioni').open = true; const x = document.querySelector('#cl-imp-cartella'); x.checked = false; x.dispatchEvent(new Event('change')); }); await c.waitForTimeout(800);
  ok('8c cartella spenta: dimenticata, elenco vuoto', await c.evaluate(() => document.querySelector('#cl-recenti').hidden && document.querySelector('#cl-cartella-box').hidden));
  // piattaforma: niente cartella predefinita né archivio
  const p = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); p.on('pageerror', (e) => errori.push('piattaforma: ' + e.message));
  await p.goto(B + '/?prova#/'); await p.waitForTimeout(1500);
  ok('8 piattaforma: impostazioni del client non visibili', await p.evaluate(() => { const x = document.querySelector('#cl-impostazioni'); return !x || x.offsetParent === null; }));
  ok('9 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await ctx?.close?.().catch(() => {}); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
