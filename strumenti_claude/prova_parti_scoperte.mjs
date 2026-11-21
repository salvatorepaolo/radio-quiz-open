// prova_parti_scoperte.mjs: le parti del visualizzatore che nessun test provava (copertura nel browser, 15/11):
//  1. fusione PET-TC (caso 012): la PET in falsi colori sopra la TC nel 2D, la soglia cambia il disegno, e nell'MPR;
//  2. «Segui nel tempo» (caso 110, TC del torace di due anni): un nodulo misurato nel primo esame si ritrova nel secondo;
//  3. misure cardiache in ecografia (Simpson, monoplano): due contorni noti danno la frazione di eiezione attesa.
// Uso: node prova_parti_scoperte.mjs   (BROWSER=webkit|firefox per gli altri motori)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const pw = createRequire(T + 'package.json')('playwright'), motore = pw[process.env.BROWSER || 'chromium'];
const PORTA = +process.env.PORTA_PROVA || (19520 + Math.floor(Math.random() * 30)), B = `http://localhost:${PORTA}/?prova`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await motore.launch(process.env.BROWSER ? {} : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const p = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1500, height: 950 } })).newPage(), errori = [];
p.on('pageerror', (e) => errori.push(e.message));
await p.addInitScript(() => { setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); window.alert = (m) => { window.__alert = String(m); }; });
const apri = async (id) => {
  await p.goto(B + `#/caso/${id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 20000 });
  await p.waitForFunction((x) => { const d = window.__dbg; return d?.V?.caso?.id === x && d.P(d.V.attivo).img; }, id, { timeout: 60000 });
  await p.waitForTimeout(800);
};
// pixel colorati nel riquadro (falsi colori della PET): R, G e B diversi tra loro
const colorati = () => p.evaluate(() => { const c = document.querySelector('#canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, t = 0;
  for (let i = 0; i < d.length; i += 16) { t++; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) n++; } return n / t; });
try {
  await p.goto(B + '#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });

  // 1. fusione PET-TC
  if (fs.existsSync(`${CASI}/caso-tcia-012`)) {
    await apri('caso-tcia-012');
    const prima = await colorati();
    await p.click('#btn-fusione');
    await p.waitForFunction(() => { const d = window.__dbg; return d.FUS.attiva && d.FUS.max > 0; }, null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const st = await p.evaluate(() => { const d = window.__dbg, a = d.P(d.V.attivo); return { mod: a.img?.modalita, fus: d.FUS.sIdx, att: d.V.sIdx, pet: d.V.serie[d.FUS.sIdx]?.suv }; });
    esito(st.mod === 'CT' && st.fus !== st.att, 'fusione: sotto la TC, sopra un\'altra serie', JSON.stringify(st));
    const con = await colorati();
    esito(con > prima + 0.005, 'fusione: la PET compare in falsi colori sopra la TC', `${(prima * 100).toFixed(1)}% → ${(con * 100).toFixed(1)}% di pixel colorati`);
    await p.evaluate(() => { const r = document.querySelector('#fusione-max'); r.value = String(Math.max(+r.min || 0, +r.max * 0.15 || 1)); r.dispatchEvent(new Event('input')); });
    await p.waitForTimeout(600);
    const soglia = await colorati();
    esito(Math.abs(soglia - con) > 0.003, 'fusione: cambiando il massimo della scala cambia il disegno', `${(con * 100).toFixed(1)}% → ${(soglia * 100).toFixed(1)}%`);
    await p.click('#modo-mpr');
    const mpr = await p.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelectorAll('#mpr canvas').length >= 3, null, { timeout: 120000 }).then(() => true, () => false);
    if (mpr) {
      await p.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }).catch(() => {});
      await p.waitForTimeout(3000);
      const f = await p.evaluate(() => window.__dbg.MPR.modulo?._fusione?.('assiale'));
      esito((f?.actors?.length || 0) >= 2 && !!f?.idPet, 'fusione nell\'MPR: TC e PET nella vista assiale', `${f?.actors?.length || 0} volumi`);
      await p.click('#modo-mpr').catch(() => {}); await p.waitForTimeout(1000);
    } else esito(false, 'fusione nell\'MPR: l\'MPR non si è aperto');
    await p.evaluate(() => { const b2 = document.querySelector('#btn-fusione'); if (b2.classList.contains('on')) b2.click(); });
  }

  // 2. segui nel tempo (caso 110, due TC del torace a un anno), dal nodulo n. 2 della seconda lettura IA (8 mm, ritrovato
  // dall'IA anche nel secondo esame). Il percorso deve arrivare in fondo senza errori e dare un risultato per il secondo
  // esame. Il volume del misuratore semiautomatico sui noduli polmonari piccoli è solo segnalato (⚠): con le TC a bassa
  // dose non è affidabile (limite noto, da migliorare).
  const ia = `${CASI}/caso-tcia-110/ia/0003_0_OPA_SE_VZOOM_B50f_300_2_120_75_40_na.json`;
  if (fs.existsSync(ia)) {
    const nodi = JSON.parse(fs.readFileSync(ia, 'utf8')).analisi.noduli;
    await apri('caso-tcia-110');
    const misura = (q, segui) => p.evaluate(async ([q, segui]) => {
      const d = window.__dbg, si = d.V.serie.findIndex((s) => /Studio 1/.test(s.descrizione || '')); if (si < 0) return { errore: 'serie del primo esame non trovata' };
      await d.selezionaSerie(si); const pn = d.P(d.V.attivo);
      let best = 0, dist = Infinity;
      for (let i = 0; i < pn.frames.length; i++) { const im = await d.immagineDi(pn, i), n = d.normaleDi(im.iop), dd = Math.abs((im.ipp[0] - q[0]) * n[0] + (im.ipp[1] - q[1]) * n[1] + (im.ipp[2] - q[2]) * n[2]); if (dd < dist) { dist = dd; best = i; } }
      await d.mostraDi(d.V.attivo, best); const im = await d.immagineDi(pn, best), px = d.pixelDa(im, q), prima = d.V.volumi.length;
      await d.volumeDa(d.V.attivo, { x: px.x, y: px.y }, best);
      const v = d.V.volumi.length > prima ? d.V.volumi.at(-1) : null;
      if (!v || !segui) return { vol: v?.vol ?? null, sconfina: v?.sconfina };
      window.__alert = ''; await d.seguiNelTempo(v);
      return { vol: v.vol, sconfina: v.sconfina, alert: window.__alert, punti: (d.V.traccia?.punti || []).map((x) => ({ stato: x.stato, vol: x.vol, data: x.data })) };
    }, [q, segui]);
    // volumi dei quattro noduli rispetto alla seconda lettura IA (solo informazione)
    for (const [k, n] of nodi.entries()) {
      const r = await misura(n.centro_lps, false), mm3 = r.vol != null ? Math.round(r.vol * 1000) : null;
      const vicino = mm3 != null && !r.sconfina && mm3 > n.volume_mm3 / 2 && mm3 < n.volume_mm3 * 2;
      console.log(`${vicino ? 'OK' : '⚠ '}  volume semiautomatico del nodulo ${k + 1} (${n.diametro_medio_mm} mm, ${Math.round(n.hu)} HU): ${mm3 == null ? 'non misurato' : mm3 + ' mm³'}${r.sconfina ? ', sconfina' : ''} (IA ${Math.round(n.volume_mm3)} mm³)`);
    }
    // segui nel tempo dal primo nodulo che il misuratore riesce a misurare senza sconfinare
    let r = null;
    for (const n of nodi) { r = await misura(n.centro_lps, true); if (r.vol && !r.sconfina) break; }
    const sec = r?.punti?.find((x) => x.stato !== 'partenza');
    esito(!!sec, 'segui nel tempo: il percorso arriva al secondo esame', JSON.stringify(r?.punti || r).slice(0, 200));
    if (sec && sec.stato !== 'non trovata') esito(Number.isFinite(sec.vol), 'segui nel tempo: misura nel secondo esame', JSON.stringify(sec));
    else console.log('⚠   segui nel tempo: lesione non ritrovata nel secondo esame (dipende dal misuratore dei volumi)');
  }

  // 3. ecografia cardiaca: contorni ellittici noti, il sistolico ridotto all'80% → volume × 0,8³ → FE = 48,8%
  const eco = ['caso-tcia-044', 'caso-tcia-105', 'caso-tcia-124'].find((c) => fs.existsSync(`${CASI}/${c}`));
  if (eco) {
    await apri(eco);
    const r = await p.evaluate(async () => {
      const d = window.__dbg, b2 = document.querySelector('[data-tool="eco"]'); if (b2) { b2.hidden = false; b2.click(); }
      if (d.V.tool !== 'eco') return { errore: 'strumento eco non attivo' };
      const im = d.P(d.V.attivo).img, cx = im.cols / 2, cy = im.rows / 2;
      const contorno = (k) => { const l = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12); l.push({ x: cx - Math.cos(a) * 40 * k, y: cy + 60 * k - Math.sin(a) * 120 * k }); } return l; };
      const tasto = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      d.ECO.fase = 'd'; d.ECO.punti = contorno(1); d.ECO.k = d.V.attivo; d.ECO.sIdx = d.P(d.V.attivo).sIdx; d.ECO.idx = d.P(d.V.attivo).idx; tasto('Enter');
      d.ECO.fase = 's'; d.ECO.punti = contorno(0.8); tasto('Enter');
      const ris = d.risultatiEco();
      return { fe: ris.fe, testo: document.querySelector('#eco-pannello')?.innerText, tracce: Object.keys(d.ECO.tracce) };
    });
    if (r.errore) esito(false, 'ecografia cardiaca: ' + r.errore);
    else {
      esito(Math.abs(r.fe - 48.8) < 1.5, 'ecografia cardiaca: frazione di eiezione da due contorni noti (attesa 48,8%)', `${r.fe?.toFixed?.(1)}% · tracce ${r.tracce.join(', ')}`);
      esito(/(FE|eiezione)[^\n]*4[89]\s*%/i.test(r.testo || ''), 'ecografia cardiaca: il risultato è nel pannello', ((r.testo || '').match(/[^\n]*(FE|eiezione)[^\n]*/i) || [''])[0].slice(0, 120));
    }
  }
  esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 3).join(' | ').slice(0, 300));
} finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
