// Vetrini caricati dal pannello (1.326): pulizia nel browser e secondo controllo sul server (vetrino-tiff.js / .mjs).
// Stesso file nei due posti; testi dello scanner ripuliti con la stessa lunghezza; etichetta azzerata; il server cancella
// e non pubblica un vetrino non pulito; solo gli autori, solo in aggiunta a un caso esistente. Attraverso il simulatore.
// (Il confronto byte per byte con strumenti/prepara_vetrino.py sui vetrini veri di OpenSlide è in
// strumenti_claude/vetrino_pannello/confronta_python.mjs: quei file non stanno nei test.)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(QUI, '../web/vetrino-tiff.js'), API = path.join(QUI, '../api/vetrino-tiff.mjs');
const M = await import(pathToFileURL(API).href);

// TIFF di prova (little endian): piramide di due livelli a tessere e un'etichetta a strisce con dati «del paziente»
function tiffProva() {
  const desc0 = 'Aperio Image Library v12.0.15 \r\n1000x800 [0,0 1000x800] (256x256) JPEG/RGB Q=70|AppMag = 20|MPP = 0.499|Date = 11/24/26|Time = 10:00:00|User = 3f2e8a|Filename = 123456 ROSSI|ScanScope ID = SS1234\0';
  const desc2 = 'label 200x100\0', data = '2026:11:24 10:00:00\0', email = 'tecnico mario.rossi@ospedale.it\0';
  const parti = []; let pos = 8;
  const aggiungi = (b) => { const o = pos; parti.push(b); pos += b.length; if (pos % 2) { parti.push(Buffer.alloc(1)); pos++; } return o; };
  const testo = (s) => aggiungi(Buffer.from(s, 'latin1'));
  const pix = (n, v) => aggiungi(Buffer.alloc(n, v));
  // dati: tessere finte (byte non nulli) e strisce dell'etichetta
  const t0 = [pix(300, 7), pix(300, 7)], t1 = [pix(200, 9)], et = pix(500, 0x55);
  const s0 = testo(desc0), s2 = testo(desc2), sd = testo(data), se = testo(email);
  const ifd = (voci, prossimo) => {   // voci: [tag, tipo, conteggio, valore o posizione]
    const b = Buffer.alloc(2 + voci.length * 12 + 4); b.writeUInt16LE(voci.length, 0);
    voci.sort((a, c) => a[0] - c[0]).forEach(([t, ty, n, v], i) => { const p = 2 + i * 12; b.writeUInt16LE(t, p); b.writeUInt16LE(ty, p + 2); b.writeUInt32LE(n, p + 4); if (ty === 3 && n === 1) b.writeUInt16LE(v, p + 8); else b.writeUInt32LE(v, p + 8); });
    b.writeUInt32LE(prossimo, 2 + voci.length * 12); return b;
  };
  const lista = (v) => aggiungi(Buffer.from(new Uint32Array(v).buffer));
  const o0 = lista(t0), c0 = lista([300, 300]);
  // posizioni degli IFD: calcolate prima di scriverli (dimensioni fisse)
  const n0 = 11, n1 = 8, n2 = 8, i0 = pos, i1 = i0 + 2 + n0 * 12 + 4, i2 = i1 + 2 + n1 * 12 + 4;
  aggiungi(ifd([[256, 3, 1, 1000], [257, 3, 1, 800], [259, 3, 1, 7], [262, 3, 1, 2], [270, 2, desc0.length, s0], [306, 2, data.length, sd], [315, 2, email.length, se],
    [322, 3, 1, 256], [323, 3, 1, 256], [324, 4, 2, o0], [325, 4, 2, c0]], i1));
  aggiungi(ifd([[256, 3, 1, 500], [257, 3, 1, 400], [259, 3, 1, 7], [262, 3, 1, 2], [322, 3, 1, 256], [323, 3, 1, 256], [324, 4, 1, t1[0]], [325, 4, 1, 200]], i2));
  aggiungi(ifd([[256, 3, 1, 200], [257, 3, 1, 100], [259, 3, 1, 5], [262, 3, 1, 2], [270, 2, desc2.length, s2], [273, 4, 1, et], [278, 3, 1, 100], [279, 4, 1, 500]], 0));
  const h = Buffer.alloc(8); h.write('II', 0, 'latin1'); h.writeUInt16LE(42, 2); h.writeUInt32LE(i0, 4);
  return Buffer.concat([h, ...parti]);
}
const lettore = (b) => async (o, n) => new Uint8Array(b.buffer, b.byteOffset + Math.min(o, b.length), Math.max(0, Math.min(n, b.length - o)));

test('vetrino-tiff: lo stesso file nel browser e sul server', () => {
  assert.equal(fs.readFileSync(WEB, 'utf8'), fs.readFileSync(API, 'utf8'), 'web/vetrino-tiff.js e api/vetrino-tiff.mjs devono essere identici: copia il primo sul secondo');
});
test('vetrino-tiff: testi dello scanner ripuliti con la stessa lunghezza, controllo in forma mascherata', () => {
  const s = '|Date = 11/24/26|User = 3f2e8a|Filename = ROSSI MARIO|AppMag = 20|RSSMRA80A01H501U mario@x.it 2026-11-24';
  const p = M.pulisciTesto(s);
  assert.equal(p.length, s.length); assert.match(p, /AppMag = 20/);
  assert.doesNotMatch(p, /ROSSI|3f2e8a|RSSMRA|mario@|2026-11-24/);
  assert.deepEqual(M.sospetti(p), []);
  const sp = M.sospetti(s); assert.ok(sp.length >= 5, sp.join(' | '));
  assert.ok(sp.every((x) => !/ROSSI|RSSMRA80A01H501U|mario@x\.it/.test(x)), 'il controllo non deve ripetere i dati per intero');
});
test('vetrino-tiff: piano, copia pulita e controllo su un TIFF di prova', async () => {
  const b = tiffProva(), orig = await M.problemi(lettore(b));
  assert.ok(orig.some((x) => /non azzerato/.test(x)) && orig.some((x) => /tag 270/.test(x)) && orig.some((x) => /tag 315: email/.test(x)), orig.join(' | '));
  const piano = await M.pianoPulizia(lettore(b));
  assert.equal(piano.livelli, 2); assert.equal(piano.accessorie, 1);
  const pulito = Buffer.from(await M.copiaPulita(new Blob([b]), piano).arrayBuffer());
  assert.equal(pulito.length, b.length, 'stessa lunghezza: le posizioni nel file non cambiano');
  assert.deepEqual(await M.problemi(lettore(pulito)), []);
  const t = pulito.toString('latin1');
  assert.doesNotMatch(t, /ROSSI|3f2e8a|SS1234|mario\.rossi|2026:11:24/); assert.match(t, /AppMag = 20\|MPP = 0\.499/);
  // tessere della piramide intatte, etichetta a zero
  let diversi = 0; for (let i = 0; i < b.length; i++) if (b[i] !== pulito[i]) diversi++;
  assert.ok(diversi > 500 && diversi < 900, `byte cambiati: ${diversi}`);
  await assert.rejects(M.pianoPulizia(lettore(Buffer.from('non sono un tiff, solo testo'))), /TIFF/);
});

// API: URL firmati, caricamento, controllo del server
const PORTA = await portaLibera(), BASE = `http://localhost:${PORTA}`;
let sim;
function persona() {
  let cookie = '';
  return async (url, corpo) => {
    const r = await fetch(BASE + url, { method: corpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    return { stato: r.status, j, t };
  };
}
const admin = persona(), studente = persona();
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  assert.equal((await admin('/api/accesso', { codice: 'admin-test-0000' })).stato, 200);
  const r = await admin('/api/account', { nome: 'Studente Vetrini', ruolo: 'specializzando' }); assert.equal(r.stato, 200);
  assert.equal((await studente('/api/accesso', { codice: r.j.codice })).stato, 200);
});
after(() => { sim?.kill(); });
const ID = 'caso-tcia-001';
test('API vetrino: solo autori, solo in aggiunta; un vetrino non pulito viene cancellato, uno pulito entra in serie.json', async () => {
  const f1 = 'serie/vetrino_a1/vetrino.svs', f2 = 'serie/vetrino_a2/vetrino.svs';
  assert.equal((await studente(`/api/casi/${ID}/caricamento`, { aggiunta: true, files: [f1] })).stato, 403, 'studente');
  assert.equal((await admin(`/api/casi/${ID}/caricamento`, { aggiunta: true, files: ['serie/vetrino_a1/vetrino.exe'] })).stato, 400, 'estensione');
  assert.equal((await admin(`/api/casi/${ID}/caricamento`, { aggiunta: true, files: ['serie/altro/vetrino.svs'] })).stato, 400, 'cartella');
  const u = await admin(`/api/casi/${ID}/caricamento`, { aggiunta: true, files: [f1, f2] }); assert.equal(u.stato, 200, u.t);
  const prima = (await admin(`/api/casi/${ID}/completo`)).j;
  // 1. non pulito (l'originale): rifiutato e cancellato
  assert.ok((await fetch(u.j.urls[f1], { method: 'PUT', body: tiffProva() })).ok);
  const r1 = await admin(`/api/casi/${ID}/immagini`, { aggiungi: [{ tipo: 'vetrino', descrizione: 'Vetrino EE', files: [f1] }] });
  assert.equal(r1.stato, 422, r1.t); assert.match(r1.j.errore, /non pubblicato/); assert.doesNotMatch(r1.t, /ROSSI|mario\.rossi/);
  assert.equal((await admin(`/api/casi/${ID}/immagini`, { aggiungi: [{ tipo: 'vetrino', files: [f1] }] })).stato, 400, 'file cancellato');
  // 2. pulito nel browser: accettato
  const b = tiffProva(), pulito = Buffer.from(await M.copiaPulita(new Blob([b]), await M.pianoPulizia(lettore(b))).arrayBuffer());
  assert.ok((await fetch(u.j.urls[f2], { method: 'PUT', body: pulito })).ok);
  const r2 = await admin(`/api/casi/${ID}/immagini`, { aggiungi: [{ tipo: 'vetrino', descrizione: 'Vetrino EE', files: [f2, 'serie/s1/x.dcm'], numero: 7 }] });
  assert.equal(r2.stato, 200, r2.t);
  const serie = await (await fetch(`${BASE}/casi/${ID}/serie.json`, { headers: { cookie: '' } })).json().catch(() => null);
  const s = await admin(`/api/casi/${ID}/completo`);
  assert.equal(s.stato, 200); assert.equal(s.j.serie_iniziale ?? null, prima.serie_iniziale ?? null, 'indici del caso invariati');
  const sj = serie && Array.isArray(serie) ? serie : null;
  if (sj) { const v = sj.at(-1); assert.deepEqual(v, { descrizione: 'Vetrino EE', tipo: 'vetrino', files: [f2], dimensioni: [pulito.length] }); }
  // 3. un vetrino non si mescola con le serie DICOM
  const r3 = await admin(`/api/casi/${ID}/immagini`, { aggiungi: [{ descrizione: 'Serie', files: [f2] }] });
  assert.notEqual(r3.stato, 500);
});
