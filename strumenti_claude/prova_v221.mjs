// prova_v221.mjs: client — PACS con DICOMweb (server di prova: QIDO-RS, WADO-RS multipart, STOW-RS), spento di base
import { spawn, execSync } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19950 + Math.floor(Math.random() * 40), B = `http://localhost:${PORTA}`, PP = PORTA + 1000;
// due studi dello stesso paziente (dal caso 110) e il loro indice
const D = '/tmp/rq-pacs'; fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D);
const indice = JSON.parse(execSync(`/Users/salvatorepaolobuemi/.radioquiz-ia/venv/bin/python - <<'EOF'
import json, os, pydicom
c='/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110'; s=json.load(open(c+'/serie.json')); l=s if isinstance(s,list) else s.get('serie',[])
out=[]
for nome, data, rx in (('a','20240115','Studio 1'),('b','20250120','Studio 2')):
    x=[y for y in l if y.get('descrizione','').startswith(rx)][0]; os.makedirs('${D}/'+nome, exist_ok=True)
    fs=x['files']; passo=max(1,len(fs)//10)
    for i,f in enumerate(fs[::passo][:10]):
        d=pydicom.dcmread(os.path.join(c,f)); d.PatientName='VERDI^ANNA'; d.PatientID='PACS77'; d.StudyDate=data; d.Modality='CT'
        p='${D}/'+nome+'/img%03d.dcm'%i; d.save_as(p); out.append({'p':p,'st':str(d.StudyInstanceUID),'se':str(d.SeriesInstanceUID),'data':data})
print(json.dumps(out))
EOF`).toString());
const studi = [...new Set(indice.map((x) => x.st))];
let ricevuti = 0;
const pacs = http.createServer((q, r) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (q.method === 'OPTIONS') { r.writeHead(204, cors); return r.end(); }
  const u = new URL(q.url, 'http://x'), parti = u.pathname.replace(/^\/dicom-web\/?/, '').split('/').filter(Boolean);
  if (q.method === 'POST' && parti[0] === 'studies') { let n = 0; q.on('data', (b) => { n += b.length; }); q.on('end', () => { ricevuti = n; r.writeHead(200, { ...cors, 'Content-Type': 'application/dicom+json' }); r.end('{}'); }); return; }
  const js = (o) => { r.writeHead(200, { ...cors, 'Content-Type': 'application/dicom+json' }); r.end(JSON.stringify(o)); };
  if (parti.length === 1) {   // QIDO studi
    const nome = (u.searchParams.get('PatientName') || '').replace(/\*/g, '').toUpperCase(), id = u.searchParams.get('PatientID') || '';
    if ((nome && !'VERDI ANNA'.includes(nome.replace(/\s+/g, ' ').trim()) && !'VERDI^ANNA'.includes(nome)) || (id && id !== 'PACS77')) return js([]);
    return js(studi.map((st) => ({ '0020000D': { vr: 'UI', Value: [st] }, '00100010': { vr: 'PN', Value: [{ Alphabetic: 'VERDI^ANNA' }] }, '00100020': { vr: 'LO', Value: ['PACS77'] },
      '00080020': { vr: 'DA', Value: [indice.find((x) => x.st === st).data] }, '00081030': { vr: 'LO', Value: ['TC torace'] }, '00080061': { vr: 'CS', Value: ['CT'] }, '00201206': { vr: 'IS', Value: [1] } })));
  }
  if (parti.length === 3 && parti[2] === 'series') return js([...new Set(indice.filter((x) => x.st === parti[1]).map((x) => x.se))].map((se) => ({ '0020000E': { vr: 'UI', Value: [se] } })));
  if (parti.length >= 4 && parti[2] === 'series') {   // WADO-RS serie in multipart
    const fl = indice.filter((x) => x.st === parti[1] && x.se === parti[3]), conf = 'CONFINE123';
    const corpo = Buffer.concat([...fl.flatMap((x) => [Buffer.from(`--${conf}\r\nContent-Type: application/dicom\r\n\r\n`), fs.readFileSync(x.p), Buffer.from('\r\n')]), Buffer.from(`--${conf}--\r\n`)]);
    r.writeHead(200, { ...cors, 'Content-Type': `multipart/related; type="application/dicom"; boundary=${conf}` }); return r.end(corpo);
  }
  r.writeHead(404, cors); r.end();
}).listen(PP);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
let ctx; try {
  ctx = await chromium.launchPersistentContext(fs.mkdtempSync('/tmp/rq-profilo-'), { viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  ok('1 PACS spento di base: niente ricerca nella pagina', await c.evaluate(() => !document.querySelector('#cl-imp-pacs').checked && document.querySelector('#cl-pacs').hidden));
  await c.evaluate(() => { document.querySelector('#cl-impostazioni').open = true; const x = document.querySelector('#cl-imp-pacs'); x.checked = true; x.dispatchEvent(new Event('change')); });
  await c.fill('#cl-pacs-url', `http://localhost:${PP}/dicom-web`); await c.evaluate(() => document.querySelector('#cl-pacs-url').dispatchEvent(new Event('change')));
  await c.click('#cl-pacs-prova'); await c.waitForFunction(() => /PACS raggiungibile|✗/.test(document.querySelector('#cl-pacs-prova-stato').textContent), null, { timeout: 10000 });
  ok('2 «Prova il collegamento»', /✓/.test(await c.textContent('#cl-pacs-prova-stato')), await c.textContent('#cl-pacs-prova-stato'));
  await c.fill('#cl-pacs-nome', 'verdi'); await c.click('#cl-pacs-cerca'); await c.waitForSelector('#cl-pacs-lista tbody tr', { timeout: 10000 });
  const righe = await c.evaluate(() => [...document.querySelectorAll('#cl-pacs-lista tbody tr')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  ok('3 ricerca per nome: due studi', righe.length === 2 && righe.every((r) => /VERDI ANNA/.test(r)), righe);
  // apre il più recente (2025)
  const i25 = righe.findIndex((r) => /2025/.test(r));
  await c.click(`#cl-pacs-lista [data-pacs="${i25}"]`); await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }); await c.waitForTimeout(2000);
  ok('4 studio aperto dal PACS (WADO-RS)', await c.evaluate(() => window.__dbg.V.serie.length === 1 && window.__dbg.V.serie[0].files.length === 10));
  const pr = await c.evaluate(() => { const b = document.querySelector('#cl-precedente'); return b && !b.hidden ? b.textContent.replace(/\s+/g, ' ') : ''; });
  ok('5 precedente proposto dal PACS', /15\/01\/2024/.test(pr), pr);
  // misura e invio al PACS (STOW-RS)
  await c.evaluate(() => { const d = window.__dbg, p = d.P(), k = `${p.sIdx}:${p.idx}`; d.V.misure[k] = [{ tipo: 'linea', a: { x: 100, y: 100 }, b: { x: 160, y: 100 } }]; });
  await c.evaluate(() => { const r = document.querySelector('input[name="ex-cosa"][value="pacs"]'); r.closest('label').hidden = false; });
  const vis = await c.evaluate(() => !document.querySelector('input[name="ex-cosa"][value="pacs"]').closest('label').hidden);
  await c.click('#cl-esporta').catch(() => {}); await c.waitForTimeout(400);
  await c.evaluate(() => { const r = document.querySelector('input[name="ex-cosa"][value="pacs"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
  await c.evaluate(() => { const d = document.querySelector('#dlg-esporta'); if (!d.open) d.showModal(); });
  const pulsante = 'ex-vai'; await c.click('#ex-vai');
  await c.waitForFunction(() => /Inviati al PACS|non riuscita/.test(document.querySelector('#ex-stato')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  console.log('   stato', await c.evaluate(() => document.querySelector('#ex-stato')?.textContent));
  ok('6 invio al PACS di SR e GSPS (STOW-RS)', vis && ricevuti > 1000, { vis, pulsante, ricevuti });
  ok('7 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await ctx?.close?.().catch(() => {}); sim.kill(); pacs.close(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
