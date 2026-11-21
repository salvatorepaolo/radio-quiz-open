# 1.214: client — archivio degli esami recenti, cartella predefinita (facoltativa, nelle impostazioni), precedenti automatici
import json, sys
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)

a = open(R + 'app.js', encoding='utf-8').read()
VEC = a[a.find("function dbUltimo(modo, v) {"):a.find("async function fileDaManiglie(lista) {")]
if not VEC.startswith("function dbUltimo"): sys.exit('dbUltimo')
a = a.replace(VEC, r'''// IndexedDB del client (solo in questo browser): ultimo esame, archivio degli esami recenti, cartella predefinita e suo indice
function dbCl(store, modo, chiave, valore) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('rq-client', 2);
    r.onupgradeneeded = () => { for (const n of ['ultimo', 'archivio', 'cartella', 'indice']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
    r.onerror = () => ko(r.error);
    r.onsuccess = () => { const db = r.result, tx = db.transaction(store, modo === 'get' || modo === 'tutti' ? 'readonly' : 'readwrite'), s = tx.objectStore(store);
      const q = modo === 'get' ? s.get(chiave) : modo === 'put' ? s.put(valore, chiave) : modo === 'del' ? s.delete(chiave) : modo === 'svuota' ? s.clear() : s.getAll();
      q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); tx.oncomplete = () => db.close(); };
  });
}
function dbUltimo(modo, v) { return dbCl('ultimo', modo, 'esame', v); }
''')

FUNZ = r'''// ---- client: archivio degli esami recenti e cartella predefinita (tutto solo in questo browser, mai sul server).
// L'elenco dei recenti si può spegnere e svuotare; la cartella predefinita è spenta di base e si accende nelle impostazioni.
const recentiAttivi = () => { try { return localStorage.getItem('rq-cl-recenti') !== '0'; } catch { return true; } };
const cartellaAttiva = () => { try { return localStorage.getItem('rq-cl-cartella') === '1' && !!window.showDirectoryPicker; } catch { return false; } };
const dataDicom = (d) => (/^\d{8}$/.test(d || '') ? `${d.slice(6)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : '');
const NOMI_MOD = { CT: 'TC', MR: 'RM', CR: 'RX', DX: 'RX', DR: 'RX', MG: 'Mammografia', US: 'Ecografia', PT: 'PET', NM: 'Medicina nucleare', XA: 'Angiografia', RF: 'Fluoroscopia' };
const nomeModalita = (m) => String(m || '').split('/').filter(Boolean).map((x) => NOMI_MOD[x] || x).filter((x, i, l) => l.indexOf(x) === i).join(' + ');
// intestazione dello studio dal primo pezzo del file (senza leggere le immagini)
async function intestazioneStudio(f) {
  for (const n of [1 << 16, 1 << 20]) {
    try {
      const b = new Uint8Array(await f.slice(0, n).arrayBuffer()); if (b.length < 132) return null;
      const ds = dicomParser.parseDicom(b, { untilTag: 'x7fe00010' }), t = (x) => (ds.string(x) || '').trim();
      const uid = t('x0020000d'); if (!uid) return null;
      return { uid, nome: t('x00100010').replace(/\^+/g, ' ').trim(), pid: t('x00100020'), nascita: t('x00100030'), sesso: t('x00100040'), data: t('x00080020'), descrizione: t('x00081030'), modalita: t('x00080060'), regione: t('x00180015') };
    } catch { if (f.size <= n) return null; }
  }
  return null;
}
async function registraArchivio() {
  if (!CLIENT || !recentiAttivi() || !CL.studio) return;
  await pausa(500); const man = ULTIMO.maniglie; if (!man?.length) return;
  const f = CL.sorgenti?.find((x) => x.size > 132), h = f ? await intestazioneStudio(f) : null;
  const voce = { id: String(CL.chiave || Date.now()).slice(0, 400), maniglie: man, quando: Date.now(), cartella: man.map((x) => x.name).join(', '), titolo: CL.studio.caso.titolo, ...(h || {}) };
  await dbCl('archivio', 'put', voce, voce.id);
  const tutte = (await dbCl('archivio', 'tutti')).sort((x, y) => y.quando - x.quando);
  for (const v of tutte.slice(40)) await dbCl('archivio', 'del', v.id);
}
async function vociArchivio() {
  const rec = recentiAttivi() ? (await dbCl('archivio', 'tutti').catch(() => [])).sort((x, y) => y.quando - x.quando).map((v) => ({ ...v, fonte: 'recente' })) : [];
  const idx = cartellaAttiva() ? await dbCl('indice', 'get', 'studi').catch(() => null) : null;
  const giaRecenti = new Set(rec.map((v) => v.uid));
  return [...rec, ...(idx?.studi || []).filter((s) => !giaRecenti.has(s.uid)).map((s) => ({ ...s, fonte: 'cartella' }))];
}
async function mostraArchivio() {
  const box = $('#cl-recenti'); if (!box || !CLIENT) return;
  const voci = await vociArchivio(), q = ($('#cl-rec-cerca')?.value || '').trim().toLowerCase();
  const testo = (v) => `${v.nome || ''} ${v.pid || ''} ${dataDicom(v.data)} ${v.data || ''} ${v.descrizione || ''} ${nomeModalita(v.modalita)} ${v.titolo || ''} ${v.cartella || ''}`.toLowerCase();
  const filtrate = voci.filter((v) => !q || q.split(/\s+/).every((p) => testo(v).includes(p))).slice(0, 200);
  box.hidden = !voci.length && !cartellaAttiva();
  $('#cl-rec-lista').innerHTML = filtrate.length ? `<table class="cl-rec-tab"><thead><tr><th>Paziente</th><th>Data</th><th>Esame</th><th></th></tr></thead><tbody>${filtrate.map((v, i) => `<tr>
      <td><b>${esc(v.nome || '—')}</b>${v.nascita ? `<span class="muted small"> · nato/a il ${dataDicom(v.nascita)}</span>` : ''}</td><td class="num">${dataDicom(v.data) || '—'}</td>
      <td>${esc([nomeModalita(v.modalita), v.descrizione || v.titolo || ''].filter(Boolean).join(' · ') || v.cartella || '')} <span class="cl-fonte ${v.fonte}">${v.fonte === 'recente' ? 'recente' : 'cartella'}</span></td>
      <td class="cl-rec-az"><button type="button" class="primary piccolo" data-apri="${i}">Apri</button>${v.fonte === 'recente' ? `<button type="button" class="ghost piccolo" data-togli="${i}" title="Togli dall'elenco">✕</button>` : ''}</td></tr>`).join('')}</tbody></table>`
    : `<p class="muted small">${q ? 'Nessun esame trovato.' : cartellaAttiva() ? 'Nessun esame: scegli la cartella o aggiorna l\'elenco nelle impostazioni.' : 'Nessun esame recente.'}</p>`;
  box.querySelectorAll('[data-apri]').forEach((b) => { b.onclick = () => apriDaArchivio(filtrate[+b.dataset.apri]).catch((e) => { $('#cl-stato').textContent = 'Non riesco ad aprire l\'esame: ' + e.message; }); });
  box.querySelectorAll('[data-togli]').forEach((b) => { b.onclick = async () => { await dbCl('archivio', 'del', filtrate[+b.dataset.togli].id); mostraArchivio(); }; });
}
async function permessoLettura(h) { let s = await h.queryPermission({ mode: 'read' }); if (s !== 'granted') s = await h.requestPermission({ mode: 'read' }); if (s !== 'granted') throw new Error('permesso di lettura non concesso'); }
async function apriDaArchivio(v, aggiungi = false) {
  if (v.maniglie?.length) {
    for (const h of v.maniglie) await permessoLettura(h);
    $('#cl-stato').textContent = 'Apro l\'esame…';
    const f = await fileDaManiglie(v.maniglie); if (!f.length) throw new Error('file non trovati (cartella spostata o disco scollegato)');
    if (!aggiungi) { ULTIMO.maniglie = v.maniglie; ricordaManiglie(v.maniglie); return caricaClient(f); }
    return caricaClient(f, { aggiungi: true });
  }
  const dir = await dbCl('cartella', 'get', 'predefinita'); if (!dir) throw new Error('cartella predefinita non impostata');
  await permessoLettura(dir); $('#cl-stato').textContent = 'Apro lo studio dalla cartella…';
  const voluti = new Set(v.percorsi || []), dirs = new Set(); for (const p of voluti) { const parti = p.split('/'); for (let i = 1; i < parti.length; i++) dirs.add(parti.slice(0, i).join('/')); }
  const out = [];
  const giro = async (h, base) => { for await (const x of h.values()) { const p = base + x.name;
    if (x.kind === 'file') { if (voluti.has(p)) { const f = await x.getFile(); f._percorso = p; out.push(f); } } else if (dirs.has(p)) await giro(x, p + '/'); } };
  await giro(dir, '');
  if (!out.length) throw new Error('file non trovati: aggiorna l\'elenco della cartella');
  return aggiungi ? caricaClient(out, { aggiungi: true }) : caricaClient(out);
}
async function leggiCartella() {
  const st = $('#cl-cartella-stato'), scrivi = (t) => { if (st) st.textContent = t; };
  const dir = await dbCl('cartella', 'get', 'predefinita'); if (!dir) { scrivi('Scegli prima la cartella.'); return; }
  try { await permessoLettura(dir); } catch (e) { scrivi(e.message); return; }
  const studi = new Map(); let n = 0, letti = 0;
  const giro = async (h, base, prof) => {
    if (prof > 8 || n > 50000) return;
    for await (const x of h.values()) {
      if (x.name.startsWith('.')) continue; const p = base + x.name;
      if (x.kind === 'directory') { await giro(x, p + '/', prof + 1); continue; }
      if (++n > 50000 || /\.(jpe?g|png|gif|pdf|txt|xml|html?|exe|dll|ini|inf|zip|mp4|js|css|json)$/i.test(x.name)) continue;
      const i = await intestazioneStudio(await x.getFile()); letti++;
      if (i) { const s = studi.get(i.uid) || { ...i, n: 0, percorsi: [], mod: [] }; s.n++; s.percorsi.push(p); if (i.modalita && !s.mod.includes(i.modalita)) s.mod.push(i.modalita); studi.set(i.uid, s); }
      if (letti % 200 === 0) scrivi(`Leggo la cartella: ${letti} file, ${studi.size} studi…`);
    }
  };
  scrivi('Leggo la cartella…'); await giro(dir, '', 0);
  const lista = [...studi.values()].map(({ mod, ...s }) => ({ ...s, modalita: mod.filter((m) => !/^(SR|PR|KO|SEG|DOC|RTSTRUCT)$/.test(m)).join('/') || s.modalita })).sort((x, y) => String(y.data).localeCompare(String(x.data)));
  await dbCl('indice', 'put', { quando: Date.now(), studi: lista, cartella: dir.name }, 'studi');
  scrivi(`${lista.length} ${lista.length === 1 ? 'studio' : 'studi'} in «${dir.name}» (${letti} file letti)`);
  mostraArchivio();
}
async function initArchivio() {
  if (!CLIENT || !$('#cl-impostazioni')) return;
  const r = $('#cl-imp-recenti'), c = $('#cl-imp-cartella'), box = $('#cl-cartella-box');
  r.checked = recentiAttivi(); c.checked = cartellaAttiva(); box.hidden = !c.checked; $('#cl-cartella-no').hidden = !!window.showDirectoryPicker;
  if (!window.showDirectoryPicker) c.disabled = true;
  r.onchange = async () => { try { localStorage.setItem('rq-cl-recenti', r.checked ? '1' : '0'); } catch {} if (!r.checked) await dbCl('archivio', 'svuota').catch(() => {}); mostraArchivio(); };
  c.onchange = async () => {
    try { localStorage.setItem('rq-cl-cartella', c.checked ? '1' : '0'); } catch {}
    box.hidden = !c.checked;
    if (!c.checked) { await dbCl('cartella', 'del', 'predefinita').catch(() => {}); await dbCl('indice', 'del', 'studi').catch(() => {}); $('#cl-cartella-stato').textContent = ''; }
    mostraArchivio();
  };
  $('#cl-cartella-scegli').onclick = async () => { try { const h = await showDirectoryPicker({ id: 'rq-cartella', mode: 'read' }); await dbCl('cartella', 'put', h, 'predefinita'); await leggiCartella(); } catch (e) { if (e?.name !== 'AbortError') $('#cl-cartella-stato').textContent = 'Cartella non scelta: ' + e.message; } };
  $('#cl-cartella-leggi').onclick = () => leggiCartella().catch((e) => { $('#cl-cartella-stato').textContent = 'Lettura non riuscita: ' + e.message; });
  $('#cl-rec-cerca').oninput = () => mostraArchivio();
  $('#cl-rec-svuota').onclick = async () => { await dbCl('archivio', 'svuota').catch(() => {}); mostraArchivio(); };
  if (c.checked) { const i = await dbCl('indice', 'get', 'studi').catch(() => null); $('#cl-cartella-stato').textContent = i ? `${i.studi.length} studi in «${i.cartella}» · aggiornato il ${new Date(i.quando).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Scegli la cartella.'; }
  mostraArchivio();
}
// precedenti automatici: aprendo un esame si cerca tra i recenti e nella cartella predefinita uno studio più vecchio dello
// stesso paziente (ID, o nome e data di nascita) e della stessa metodica; si propone il confronto affiancato
async function cercaPrecedenti() {
  if (!CL.studio) return;
  const f = CL.sorgenti?.find((x) => x.size > 132), h = f && await intestazioneStudio(f); if (!h || (!h.pid && !h.nome)) return;
  const stesso = (v) => v.uid && v.uid !== h.uid && ((h.pid && v.pid === h.pid) || (!h.pid && h.nome && v.nome === h.nome && v.nascita === h.nascita));
  const cand = (await vociArchivio()).filter(stesso).filter((v) => !h.modalita || !v.modalita || v.modalita.split('/').includes(h.modalita))
    .filter((v) => !h.data || !v.data || v.data < h.data).sort((x, y) => String(y.data).localeCompare(String(x.data)));
  const p = cand.find((v) => !h.regione || !v.regione || v.regione === h.regione); if (!p) return;
  let b = $('#cl-precedente'); if (!b) { b = document.createElement('div'); b.id = 'cl-precedente'; b.className = 'cl-precedente'; b.setAttribute('role', 'status'); document.body.append(b); }
  b.innerHTML = `<span>🕘 Esame precedente dello stesso paziente: <b>${esc(nomeModalita(p.modalita) || 'esame')} del ${dataDicom(p.data) || '—'}</b>${p.descrizione ? ' · ' + esc(p.descrizione) : ''}</span><button type="button" class="primary piccolo" id="cl-prec-apri">Confronta</button><button type="button" class="ghost piccolo" id="cl-prec-chiudi" aria-label="Chiudi">✕</button>`;
  b.hidden = false;
  $('#cl-prec-chiudi').onclick = () => { b.hidden = true; };
  $('#cl-prec-apri').onclick = async () => { b.hidden = true; try { await apriDaArchivio(p, true); } catch (e) { avvisoBreve('Precedente non aperto: ' + e.message); } };
}
'''
a = sost(a, "async function fileDaManiglie(lista) {", FUNZ + "async function fileDaManiglie(lista) {", 'funzioni')
a = sost(a, "  CL.studio = { caso: { id: 'locale', titolo, modalita: metodica, ia: false, opzioni: [], sezioni: [], visibile: true }, serie, buf };\n",
  "  CL.studio = { caso: { id: 'locale', titolo, modalita: metodica, ia: false, opzioni: [], sezioni: [], visibile: true }, serie, buf };\n"
  "  if ($('#cl-precedente')) $('#cl-precedente').hidden = true;\n"
  "  if (!aggiungi) registraArchivio().then(cercaPrecedenti).catch((e) => console.warn('archivio', e));\n", 'aggancio')
a = sost(a, "  $('#cl-torna').hidden = !CL.studio; if (CL.studio) $('#cl-torna-nome').textContent = CL.studio.caso.titolo; mostraUltimo();",
  "  $('#cl-torna').hidden = !CL.studio; if (CL.studio) $('#cl-torna-nome').textContent = CL.studio.caso.titolo; mostraUltimo(); mostraArchivio(); if ($('#cl-precedente')) $('#cl-precedente').hidden = true;", 'home')
a = sost(a, "  $('#cl-ultimo').onclick = () => riapriUltimo(false)", "  initArchivio().catch((e) => console.warn('archivio', e));\n  $('#cl-ultimo').onclick = () => riapriUltimo(false)", 'init')
open(R + 'app.js', 'w', encoding='utf-8').write(a)

h = open(R + 'index.html', encoding='utf-8').read()
h = sost(h, 'ultimo esame: <span id="cl-ultimo-nome"></span></button></p>\n',
  'ultimo esame: <span id="cl-ultimo-nome"></span></button></p>\n'
  '    <section id="cl-recenti" class="cl-recenti" hidden aria-label="Esami recenti">\n'
  '      <div class="cl-rec-testa"><h2>Esami recenti</h2><input type="search" id="cl-rec-cerca" placeholder="Cerca per nome, data, metodica…" aria-label="Cerca negli esami"><button type="button" id="cl-rec-svuota" class="ghost piccolo" title="Svuota l\'elenco degli esami recenti (i file sul disco non si toccano)">Svuota</button></div>\n'
  '      <div id="cl-rec-lista"></div>\n'
  '    </section>\n'
  '    <details id="cl-impostazioni" class="cl-impostazioni"><summary>⚙ Impostazioni del visualizzatore</summary>\n'
  '      <label class="check"><input type="checkbox" id="cl-imp-recenti"> Ricorda gli esami aperti in questo browser (elenco «Esami recenti», con nome del paziente e data: restano solo su questo computer)</label>\n'
  '      <label class="check"><input type="checkbox" id="cl-imp-cartella"> Cartella predefinita degli esami: il visualizzatore elenca gli studi che contiene (spenta di base; il browser chiede il permesso di leggerla)</label>\n'
  '      <div id="cl-cartella-box" class="cl-cartella-box" hidden><button type="button" id="cl-cartella-scegli">📁 Scegli la cartella…</button> <button type="button" id="cl-cartella-leggi" class="ghost">↻ Aggiorna l\'elenco</button> <span id="cl-cartella-stato" class="muted small"></span></div>\n'
  '      <p id="cl-cartella-no" class="muted small" hidden>La cartella predefinita funziona in Chrome ed Edge sul computer.</p>\n'
  '    </details>\n', 'html')
open(R + 'index.html', 'w', encoding='utf-8').write(h)

s = open(R + 'style.css', encoding='utf-8').read()
if '.cl-recenti' not in s:
    s += '''
/* 1.214 client: esami recenti, impostazioni, precedente */
.cl-recenti{margin:14px 0;padding:14px 16px;border:1px solid var(--bord);border-radius:14px;background:var(--pan)}
.cl-rec-testa{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-bottom:8px}
.cl-rec-testa h2{margin:0;font-size:1.05rem;flex:1 1 auto}
.cl-rec-testa input{flex:1 1 220px;max-width:340px}
.cl-rec-tab{width:100%;border-collapse:collapse;font-size:.9em}
.cl-rec-tab th{text-align:left;font-size:.78em;color:var(--mut);font-weight:600;border-bottom:1px solid var(--bord);padding:5px 6px}
.cl-rec-tab td{padding:6px;border-bottom:1px solid color-mix(in srgb,var(--bord) 60%,transparent);vertical-align:middle}
.cl-rec-tab tr:hover td{background:var(--pan2)}
.cl-rec-az{white-space:nowrap;text-align:right}.cl-rec-az button+button{margin-left:4px}
.cl-fonte{display:inline-block;font-size:.7em;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:1px 7px;margin-left:4px;background:var(--pan2);color:var(--mut)}
.cl-fonte.cartella{color:var(--acc)}
.cl-impostazioni{margin:10px 0 16px;padding:10px 14px;border:1px solid var(--bord);border-radius:12px;background:var(--pan)}
.cl-impostazioni summary{cursor:pointer;font-weight:600}
.cl-impostazioni label.check{display:block;margin:8px 0}
.cl-cartella-box{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 6px 24px}
.cl-precedente{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:70;display:flex;gap:10px;align-items:center;max-width:calc(100vw - 32px);padding:9px 12px;border-radius:12px;background:var(--pan);border:1px solid var(--acc);box-shadow:0 8px 28px rgba(0,0,0,.3);font-size:.92em}
'''
    open(R + 'style.css', 'w', encoding='utf-8').write(s)

d = open(R + 'decodifica.js', encoding='utf-8').read()
if "pid:" not in d:
    d = sost(d, "paziente: CON_PAZIENTE ? { nome: (ds.string('x00100010') || '').replace(/\\^+/g, ' ').trim(),",
      "paziente: CON_PAZIENTE ? { nome: (ds.string('x00100010') || '').replace(/\\^+/g, ' ').trim(), pid: (ds.string('x00100020') || '').trim(),", 'pid')
    open(R + 'decodifica.js', 'w', encoding='utf-8').write(d)

en = json.load(open(R + 'lingua/en.json', encoding='utf-8'))
for k, v in {
  'Esami recenti': 'Recent exams', 'Cerca per nome, data, metodica…': 'Search by name, date, modality…', 'Cerca negli esami': 'Search exams', 'Svuota': 'Clear',
  "Svuota l'elenco degli esami recenti (i file sul disco non si toccano)": 'Clear the recent exams list (files on disk are not touched)',
  '⚙ Impostazioni del visualizzatore': '⚙ Viewer settings',
  'Ricorda gli esami aperti in questo browser (elenco «Esami recenti», con nome del paziente e data: restano solo su questo computer)': 'Remember opened exams in this browser («Recent exams» list, with patient name and date: they stay on this computer only)',
  'Cartella predefinita degli esami: il visualizzatore elenca gli studi che contiene (spenta di base; il browser chiede il permesso di leggerla)': 'Default exam folder: the viewer lists the studies it contains (off by default; the browser asks permission to read it)',
  '📁 Scegli la cartella…': '📁 Choose folder…', "↻ Aggiorna l'elenco": '↻ Refresh list', 'La cartella predefinita funziona in Chrome ed Edge sul computer.': 'The default folder works in Chrome and Edge on desktop.',
  'Paziente': 'Patient', 'Data': 'Date', 'Esame': 'Exam', 'Apri': 'Open', "Togli dall'elenco": 'Remove from list', 'recente': 'recent', 'cartella': 'folder',
  'Nessun esame trovato.': 'No exam found.', 'Nessun esame recente.': 'No recent exams.', "Nessun esame: scegli la cartella o aggiorna l'elenco nelle impostazioni.": 'No exams: choose the folder or refresh the list in the settings.',
  'nato/a il {x}': 'born {x}', 'Confronta': 'Compare', 'Leggo la cartella…': 'Reading the folder…', 'Leggo la cartella: {x} file, {x} studi…': 'Reading the folder: {x} files, {x} studies…',
  '{x} studi in «{x}» ({x} file letti)': '{x} studies in «{x}» ({x} files read)', 'Scegli prima la cartella.': 'Choose the folder first.', 'Scegli la cartella.': 'Choose the folder.',
  'permesso di lettura non concesso': 'read permission not granted', "Apro l'esame…": 'Opening the exam…', 'Apro lo studio dalla cartella…': 'Opening the study from the folder…',
  '🕘 Esame precedente dello stesso paziente: {x}': '🕘 Prior exam of the same patient: {x}',
}.items(): en.setdefault(k, v)
json.dump(en, open(R + 'lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('archivio OK')
