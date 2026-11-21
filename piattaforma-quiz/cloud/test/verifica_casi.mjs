// Verifica della correttezza dei casi: domande, risposte, punteggi e scale di riferimento.
//   node cloud/test/verifica_casi.mjs [cartella casi] [--json]
// Stampa per ogni caso i problemi trovati (ERRORE = da correggere, avviso = da guardare).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const L = await import(pathToFileURL(path.join(QUI, '../api/logica.mjs')).href);
const CASI = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(QUI, '../../casi-free'));
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const VUOTE = new Set('della delle dello degli dalla dalle nella nelle negli sulla sulle senza circa verso sotto sopra anche quindi oppure ancora come con per tra fra una uno del dei che non nel nei alla alle gli lo la le il di da in su ad ed esame reperto reperti segni aspetto parte lato destro destra sinistro sinistra'.split(' '));
const parole = (t) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 4 && !VUOTE.has(w)).map((w) => w.slice(0, 6)));
const out = [];
for (const d of fs.readdirSync(CASI).filter((x) => x.startsWith('caso-')).sort()) {
  let c; try { c = JSON.parse(fs.readFileSync(path.join(CASI, d, 'caso.json'), 'utf8')); } catch { continue; }
  const p = [], E = (m) => p.push(['ERRORE', m]), A = (m) => p.push(['avviso', m]);
  const o = c.opzioni || [], z = c.sezioni || [];
  for (const x of L.controlliCaso(c)) (/nota/.test(x) ? A : E)(x);
  // sezioni: almeno una corretta e un distrattore; «singola» = una sola corretta
  z.forEach((s, i) => {
    const os = o.filter((x) => x.sezione === i), giuste = os.filter((x) => x.corretta).length;
    if (!os.length) E(`sezione «${s.nome}» senza opzioni`);
    else { if (!giuste) E(`sezione «${s.nome}» senza risposte corrette`); if (giuste === os.length) A(`sezione «${s.nome}» senza distrattori (tutto giusto = 100%)`); if (s.singola && giuste !== 1) E(`sezione «${s.nome}» a risposta singola con ${giuste} corrette`); }
  });
  const testi = o.map((x) => norm(x.testo).trim());
  testi.forEach((t, i) => { const j = testi.indexOf(t); if (j !== i) (o[j].corretta !== o[i].corretta ? E : A)(`opzione ripetuta${o[j].corretta !== o[i].corretta ? ' una volta giusta e una volta sbagliata' : ' in due sezioni'}: «${o[i].testo.slice(0, 70)}»`); });
  // punteggi
  if (o.length >= 2 && c.scelte !== false) {
    const tutte = o.map((x, i) => (x.corretta ? i : -1)).filter((i) => i >= 0), distr = o.map((x, i) => (!x.corretta ? i : -1)).filter((i) => i >= 0);
    const v = L.valuta(c, tutte).punteggio, n = L.valuta(c, []).punteggio, s = L.valuta(c, distr).punteggio;
    if (v !== 100) E(`tutte le risposte corrette danno ${v}%`);
    if (n >= 50) E(`nessuna scelta dà ${n}%`);
    if (distr.length && s >= 40) E(`solo distrattori danno ${s}%`);
  }
  // referto: i reperti attesi scritti come referto, e i distrattori scritti come referto
  const ref = o.filter((x) => x.corretta).map((x) => x.testo).join('. ');
  if (ref.length > 60) {
    const vr = L.valutaReferto(c, ref).punteggio; if (vr < 60) A(`referto con i reperti attesi: solo ${vr}%`);
    const sb = o.filter((x) => !x.corretta && (x.sezione == null || !/tecnica/i.test(z[x.sezione]?.nome || ''))).map((x) => x.testo).join('. ');
    if (sb.length > 60) { const vs = L.valutaReferto(c, sb).punteggio; if (vs >= 60) A(`referto fatto solo di distrattori: ${vs}%`); }
  }
  // conclusione coerente con il reperto principale
  const zc = z.findIndex((s) => /conclusion/i.test(s.nome));
  const princ = o.filter((x) => x.corretta && x.tipo === 'principale' && x.sezione !== zc);
  const concl = o.filter((x) => x.corretta && x.sezione === zc && zc >= 0);
  if (princ.length && concl.length) {
    const pc = new Set([...concl.flatMap((x) => [...parole(x.testo)])]);
    const nessuna = princ.filter((x) => ![...parole(x.testo)].some((w) => pc.has(w)));
    if (nessuna.length === princ.length) A(`la conclusione non riprende il reperto principale («${princ[0].testo.slice(0, 60)}»)`);
  }
  // scale di riferimento ↔ testo della conclusione
  const sc = c.scale || [], tc = concl.map((x) => x.testo).join(' ') + ' ' + princ.map((x) => x.testo).join(' ');
  const birads = (tc.match(/BI-?RADS\s*([0-6][abc]?)/i) || [])[1], acr = (tc.match(/ACR\s*([ABCD])\b/) || [])[1];
  const mam = sc.find((s) => s.id === 'mammella');
  if (mam) {
    const br = String(mam.valori?.br || '').toLowerCase(), ac = String(mam.valori?.acr || '').toLowerCase();
    if (birads && br && br !== birads.toLowerCase()) E(`scheda mammella BI-RADS ${br.toUpperCase()} ma il testo dice BI-RADS ${birads}`);
    if (acr && ac && ac !== acr.toLowerCase()) E(`scheda mammella ACR ${ac.toUpperCase()} ma il testo dice ACR ${acr}`);
    const tutto = o.filter((x) => x.corretta).map((x) => x.testo).join(' ');
    const acrT = (tutto.match(/ACR\s*([ABCD])\b/) || [])[1];
    if (!acr && acrT && ac && ac !== acrT.toLowerCase()) E(`scheda mammella ACR ${ac.toUpperCase()} ma le risposte dicono ACR ${acrT}`);
    const brT = (tutto.match(/BI-?RADS\s*([0-6][abc]?)/i) || [])[1];
    if (!birads && brT && br && br !== brT.toLowerCase()) E(`scheda mammella BI-RADS ${br.toUpperCase()} ma le risposte dicono BI-RADS ${brT}`);
  } else if (birads && /mammograf|mammell|ecografia/i.test((c.modalita || '') + ' ' + (c.distretto || ''))) A(`il testo dice BI-RADS ${birads} ma manca la scheda di riferimento della mammella`);
  const bos = sc.find((s) => s.id === 'bosniak'), bosT = (o.filter((x) => x.corretta).map((x) => x.testo).join(' ').match(/Bosniak\s*(I{1,3}F?|IV)\b/) || [])[1];
  if (bos && bosT && String(bos.valore).toUpperCase() !== bosT.toUpperCase()) E(`scheda Bosniak ${bos.valore} ma le risposte dicono Bosniak ${bosT}`);
  if (p.length) out.push({ caso: d, visibile: c.visibile === true, problemi: p });
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  for (const x of out) { console.log(`${x.caso}${x.visibile ? '' : ' (bozza)'}`); for (const [t, m] of x.problemi) console.log(`  ${t}: ${m}`); }
  const e = out.reduce((t, x) => t + x.problemi.filter(([k]) => k === 'ERRORE').length, 0), a = out.reduce((t, x) => t + x.problemi.filter(([k]) => k === 'avviso').length, 0);
  console.log(`\nCasi con problemi: ${out.length} · errori ${e} · avvisi ${a}`);
}
