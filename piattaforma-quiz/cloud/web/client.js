// Visualizzatore scaricabile (versione client): avvio, esami recenti, cartella dei vetrini, DICOMDIR
// Estratto da app.js nella 1.328 (strumenti_claude/divisione/dividi2.mjs) senza modifiche al contenuto, salvo i nomi di
// app.js letti come A.nome (ponte PONTE_CL) e le istruzioni che app.js eseguiva al caricamento, ora in avvio().
// Si carica solo quando serve (app.js, caricaClientMod): chi non lo usa non lo scarica. Niente import './app.js'.
let A = null;
export const collega = (p) => { A = p; };
export const NOMI_APP = ["$","BUF","CL","CLIENT","FIN_REF","IC","MPR","NOMI_TS","RAW","SOP_VETRINO","TS_CODEC","TS_DEFLATE","TS_VIDEO","ULTIMO","V","aGruppi","aggiornaBottoneVetrini","aggiornaDialogoEsporta","aggiornaTabPaziente","annotazioniNonSalvate","apriCaso","apriFinestraClient","apriSessioneFile","apriVetrinoClient","autoNeuro","avvisoBreve","barra","caricaCodec","caricaIC","clientRicevi","dataDicom","dataLeggibile","disegna","disegnaIC","disposizioneClient","eDicomFile","esc","espandiZip","esportaClient","etichettaStudio","fileRemoto","formatoVetrinoFile","modAnon","modo2D","mostraAiuto","noduliClientAuto","pausa","pazTabAttivi","primaDiChiudere","qs1","ritrovaAnnotazioni","selezionaSerie","sgonfiaDeflate","slug","studioDi","virgola","vista"];

// solo per i test automatici in locale (simulatore): stato del visualizzatore accessibile dalla console

// ================================================================ VERSIONE CLIENT (visualizzatore offline)
// /client/index.html: lo stesso visualizzatore del sito, da installare come app del browser. Apre cartelle, CD (DICOMDIR)
// o file DICOM dal disco di questo computer; i file non lasciano mai il computer (niente accesso, niente server). Dopo la
// prima apertura funziona anche senza rete (client/sw.js). Si leggono subito solo le intestazioni: le immagini si leggono
// dal disco quando servono (esami grandi). In più: compressioni JPEG / JPEG 2000 / JPEG-LS / RLE, multi-frame,
// anonimizzazione (anche con testo impresso coperto), esportazione PNG / MP4 / misure, finestre su più schermi.
async function routerClient(tipo) {
  await Promise.resolve();                                       // dopo il caricamento del modulo
  if (!A.CL.pronto) avviaClient();
  if (tipo === 'caso' && !A.CL.studio) {
    // finestra aperta da «Nuova finestra»: lo studio è quello della finestra principale (stessa origine, niente copie)
    try { const o = window.opener?.__rqClient; if (o?.studio) { A.CL.studio = o.studio; A.CL.file = o.file; } } catch {}
  }
  if (tipo === 'caso' && A.CL.studio) {
    document.body.classList.add('client-caso');
    A.$('#grp-client').hidden = false;
    await A.apriCaso('locale', A.CL.studio);
    if (!A.CL.finestra) { await A.disposizioneClient(); A.autoNeuro(); setTimeout(A.noduliClientAuto, 1500); }   // 11/11: 1×1 all'apertura, salvo una disposizione salvata dall'utente
    if (A.CL.sessioneDaAprire && !A.CL.finestra) { const s = A.CL.sessioneDaAprire; A.CL.sessioneDaAprire = null; await A.apriSessioneFile(s); }
    A.$('#titolo-caso').textContent = A.CL.studio.caso.titolo + (A.CL.finestra ? ` · finestra ${A.CL.finestra}` : '');
    A.ritrovaAnnotazioni(); A.caricaIC();
    if (A.CL.finestra && A.V.serie.length > 1) {      // le finestre aggiunte propongono un'altra serie
      const si = Math.min(A.V.serie.length - 1, A.CL.finestra - 1); if (si !== A.V.sIdx) await A.selezionaSerie(si, 0);
    }
    return;
  }
  document.body.classList.remove('client-caso');
  if (tipo === 'aiuto') { A.vista('aiuto'); await A.mostraAiuto(); return; }
  A.vista('client'); A.$('#titolo-caso').textContent = '';
  A.$('#cl-torna').hidden = !A.CL.studio; if (A.CL.studio) A.$('#cl-torna-nome').textContent = A.CL.studio.caso.titolo; mostraUltimo(); mostraArchivio(); mostraVetriniCartella(); mostraPacs(); if (A.$('#cl-precedente')) A.$('#cl-precedente').hidden = true;
}
// ---- chiudere un esame: uno solo (con più esami aperti) o tutti. I file restano sul disco; misure e immagini chiave
// restano salvate in questo browser per quando l'esame si riapre.
function fileDelloStudio(id) {
  const del = new Set(), altri = new Set();
  for (const s of A.V.serie) { const dove = id == null || A.studioDi(s).id === id ? del : altri;
    // dall'elenco completo dell'esame aperto: BUF contiene solo le immagini già lette e con esami grandi ne mancherebbero
    for (const f of s.files) { const k = `/casi/locale/${f}`, v = A.CL.studio?.buf?.get?.(k) ?? A.BUF.get(k); const file = v?.file || v; if (file && typeof file === 'object') dove.add(file); } }
  return { del, altri };
}
async function chiudiStudio(id) {
  const st = A.V.studi.find((x) => x.id === id), nome = st ? A.etichettaStudio(id) : 'questo esame';
  const { del, altri } = fileDelloStudio(id);
  if (!altri.size) return chiudiEsameClient();
  if (A.annotazioniNonSalvate()) { if (!(await A.primaDiChiudere())) return; }
  else if (!confirm(`Chiudere «${nome}»? Gli altri esami restano aperti.`)) return;
  if (A.MPR.attivo) A.modo2D();
  const resto = (A.CL.sorgenti || []).filter((f) => !del.has(f) || altri.has(f));
  await caricaClient(resto);
}
async function chiudiEsameClient(chiedi = true) {
  if (A.annotazioniNonSalvate()) { if (!(await A.primaDiChiudere())) return; }
  else if (chiedi && A.V.studi.length > 1 && !confirm('Chiudere tutti gli esami aperti?')) return;
  if (A.MPR.attivo) A.modo2D();
  try { A.FIN_REF.win?.close(); } catch {} const d = A.$('#dlg-referto'); if (d?.open) d.close();
  A.CL.studio = null; A.CL.sorgenti = []; A.CL.file = null; A.CL.chiave = null; A.BUF.clear(); A.RAW.voci.clear(); A.RAW.tot = 0;
  for (const p of A.V.pannelli) { p.frames = []; p.img = null; p.cache.clear(); }
  location.hash = '#/';
}
function avviaClient() {
  A.CL.pronto = true;
  A.CL.eraCaso = location.hash === '#/caso/locale' && !A.CL.studio;     // pagina ricaricata con un esame aperto
  A.CL.finestra = +new URLSearchParams(location.search).get('finestra') || 0;
  if (!A.CL.finestra) setTimeout(() => avvisoPrivacyClient(false), 0);
  A.$('#cl-privacy-leggi') && (A.$('#cl-privacy-leggi').onclick = () => avvisoPrivacyClient(true));
  A.$('#cl-cancella-dati') && (A.$('#cl-cancella-dati').onclick = () => cancellaDatiClient().catch((e) => { A.$('#cl-cancella-stato').textContent = 'Non riuscito: ' + e.message; }));
  document.title = 'Visualizzatore DICOM · radio-quiz';
  window.__rqClient = A.CL;
  // app installabile: manifest e service worker (solo nella versione client)
  if (!A.qs1('link[rel="manifest"]')) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = '/client/manifest.json'; document.head.appendChild(l); }
  if ('serviceWorker' in navigator && location.pathname.startsWith('/client/')) navigator.serviceWorker.register('/client/sw.js', { scope: '/client/' }).catch((e) => console.warn('service worker', e));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); A.CL.installa = e; A.$('#cl-installa').hidden = false; A.$('#cl-installa-nota').hidden = true; });
  window.addEventListener('appinstalled', () => { A.$('#cl-installa').hidden = true; A.$('#cl-installata').hidden = false; A.$('#cl-installa-nota').hidden = true; });
  if (matchMedia('(display-mode: standalone)').matches) { A.$('#cl-installata').hidden = false; A.$('#cl-installa-nota').hidden = true; }
  A.$('#cl-installa').onclick = async () => { if (!A.CL.installa) return; A.CL.installa.prompt(); await A.CL.installa.userChoice.catch(() => {}); A.CL.installa = null; A.$('#cl-installa').hidden = true; };
  // Safari e Firefox: il visualizzatore funziona, ma installazione e video MP4 sono garantiti solo con Chrome ed Edge
  const chromium = !!navigator.userAgentData?.brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  A.$('#cl-browser').hidden = chromium && 'VideoEncoder' in window;
  const zona = A.$('#cl-zona');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('sopra'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('sopra'));
  zona.addEventListener('drop', async (e) => {
    e.preventDefault(); zona.classList.remove('sopra');
    // riferimenti alle cartelle e ai file trascinati (vanno chiesti subito, durante l'evento): servono a riaprire dopo un ricaricamento
    const pm = [...e.dataTransfer.items].filter((i) => i.kind === 'file' && i.getAsFileSystemHandle).map((i) => i.getAsFileSystemHandle());
    Promise.all(pm).then((h) => ricordaManiglie(h.filter(Boolean))).catch(() => {});
    const voci = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const files = []; for (const v of voci) await leggiVoceConPercorso(v, files, '');
    caricaClient(files.length ? files : [...e.dataTransfer.files]);
  });
  A.$('#cl-cartella').addEventListener('change', (e) => { const f = [...e.target.files]; e.target.value = ''; dimenticaManiglie(); caricaClient(f); });   // svuotato: si può riaprire lo stesso esame
  A.$('#cl-file').addEventListener('change', (e) => { const f = [...e.target.files]; e.target.value = ''; dimenticaManiglie(); caricaClient(f); });   // svuotato: si può riaprire lo stesso esame
  // dove il browser lo consente (Chrome, Edge) cartella e file si scelgono con il selettore che dà un riferimento riutilizzabile
  A.$('#cl-cartella').closest('label')?.addEventListener('click', async (e) => {
    if (!window.showDirectoryPicker) return;
    e.preventDefault();
    try { const h = await showDirectoryPicker({ id: 'rq-esami', mode: 'read' }); A.$('#cl-stato').textContent = 'Leggo la cartella…'; const f = await fileDaManiglie([h]); await ricordaManiglie([h]); caricaClient(f); }
    catch (x) { if (x?.name !== 'AbortError') { console.warn('selettore cartella', x); A.$('#cl-cartella').click(); } }
  });
  A.$('#cl-file').closest('label')?.addEventListener('click', async (e) => {
    if (!window.showOpenFilePicker) return;
    e.preventDefault();
    try { const h = await showOpenFilePicker({ id: 'rq-esami', multiple: true }); const f = await fileDaManiglie(h); await ricordaManiglie(h); caricaClient(f); }
    catch (x) { if (x?.name !== 'AbortError') { console.warn('selettore file', x); A.$('#cl-file').click(); } }
  });
  // esame di esempio (TCIA, TCGA-KICH, CC BY 3.0): per provare il visualizzatore senza un esame proprio. Il pulsante
  // si scarica solo al clic (il visualizzatore non fa richieste da solo); nelle installazioni delle aziende il file non
  // si pubblica e il clic lo dice
  A.$('#cl-esempio-box').hidden = false;
  // 1.302 guida rapida alla prima apertura (poi a richiesta con «❔ Guida rapida»)
  { const G = 'rq-cl-guida-1', g = A.$('#cl-guida'); let vista = false; try { vista = localStorage.getItem(G) === '1'; } catch {}
    if (g) { g.hidden = vista; A.$('#cl-guida-ok').onclick = () => { g.hidden = true; try { localStorage.setItem(G, '1'); } catch {} };
      A.$('#cl-guida-apri').onclick = () => { g.hidden = false; g.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; } }
  // anche un vetrino di esempio (OpenSlide test data, aorta, JPEG 2000 a 40×, con etichetta e panoramica)
  const scaricaEsempio = async (b, url, nome, vetrino) => {
    const st = (t, tipo = '') => { const el = A.$('#cl-stato'); el.textContent = t; el.className = 'stato ' + tipo; };
    b.disabled = true;
    try {
      const r = await fetch(url, { cache: 'force-cache' }); if (!r.ok) throw new Error(r.status === 404 ? 'in questa installazione non c\'è' : 'file non disponibile (' + r.status + ')');
      const tot = +r.headers.get('content-length') || 0, rd = r.body.getReader(), pezzi = []; let n = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; pezzi.push(value); n += value.length; const p = tot ? Math.round(100 * n / tot) + '%' : Math.round(n / 1048576) + ' MB'; st(vetrino ? `Scarico il vetrino di esempio… ${p}` : `Scarico l'esame di esempio… ${p}`); }
      const f = new File(pezzi, nome, { type: 'application/zip' });
      dimenticaManiglie(); await caricaClient([f]);
    } catch (x) {
      if (vetrino) st(x.name === 'TypeError' ? 'Vetrino di esempio non scaricato: serve la connessione a internet.' : 'Vetrino di esempio non disponibile: ' + x.message + '.', 'errore');
      else st(x.name === 'TypeError' ? 'Esame di esempio non scaricato: serve la connessione a internet.' : 'Esame di esempio non disponibile: ' + x.message + '.', 'errore');
    } finally { b.disabled = false; }
  };
  A.$('#cl-esempio')?.addEventListener('click', (e) => scaricaEsempio(e.currentTarget, '/esempi/tc-addome-esempio.zip', 'TC-addome-esempio_TCIA-TCGA-KICH.zip', false));
  // 1.305 vetrini di esempio negli altri formati (uno per formato, ripuliti con prepara_vetrino.py): si leggono dal sito a pezzi
  // come i vetrini dei casi, senza scaricarli interi; l'elenco (file e dimensioni) si chiede solo al clic
  const apriVetrinoEsempio = async (b, id) => {
    const st = (t, tipo = '') => { const el = A.$('#cl-stato'); el.textContent = t; el.className = 'stato ' + tipo; };
    b.disabled = true; st('Apro il vetrino di esempio…');
    try {
      const r = await fetch('/esempi/vetrini/elenco.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status === 404 ? 'in questa installazione non c\'è' : 'file non disponibile (' + r.status + ')');
      const v = (await r.json()).find((x) => x.id === id); if (!v) throw new Error('in questa installazione non c\'è');
      dimenticaManiglie(); await caricaClient(v.files.map((p, k) => A.fileRemoto(`/esempi/vetrini/${id}/${p}`, v.dimensioni[k])));
    } catch (x) { st(x.name === 'TypeError' ? 'Vetrino di esempio non aperto: serve la connessione a internet.' : 'Vetrino di esempio non disponibile: ' + x.message + '.', 'errore'); }
    finally { b.disabled = false; }
  };
  const formatoEs = A.$('#cl-esempio-formato');
  formatoEs?.addEventListener('change', () => { A.$('#cl-esempio-vetrino-scarica').hidden = formatoEs.value !== 'zip'; });
  A.$('#cl-esempio-vetrino')?.addEventListener('click', (e) => { const id = formatoEs?.value || 'zip';
    if (id === 'zip') scaricaEsempio(e.currentTarget, '/esempi/vetrino-esempio.zip', 'vetrino-esempio_aorta_OpenSlide.zip', true); else apriVetrinoEsempio(e.currentTarget, id); });
  initArchivio().catch((e) => console.warn('archivio', e)); initVetriniCartella(); initPacs();
  A.$('#cl-ultimo').onclick = () => riapriUltimo(false).catch((x) => { A.$('#cl-stato').textContent = 'Non riesco a riaprire l\'ultimo esame: ' + x.message; });
  mostraUltimo();
  if (A.CL.eraCaso && !A.CL.finestra) riapriUltimo(true).catch(() => {});
  A.$('#cl-torna').onclick = () => { location.hash = '#/caso/locale'; };
  A.$('#cl-apri').onclick = () => { location.hash = '#/'; };
  A.$('#cl-aggiungi-cartella').addEventListener('change', (e) => { aggiungiEsameClient([...e.target.files]); e.target.value = ''; });
  A.$('#cl-aggiungi-file').addEventListener('change', (e) => { aggiungiEsameClient([...e.target.files]); e.target.value = ''; });
  A.$('#cl-sessione').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; A.$('.cl-aggiungi')?.removeAttribute('open'); if (f) A.apriSessioneFile(f); });
  A.$('#cl-finestra').onclick = A.apriFinestraClient;
  A.$('#cl-paziente').onchange = (e) => { A.V.datiPaziente = e.target.checked; A.disegna(); };
  // dati del paziente sulla linguetta dell'esame: accesi di base nel client, la scelta si ricorda
  A.$('#cl-paz-tab').checked = A.pazTabAttivi();
  A.$('#cl-paz-tab').onchange = (e) => { try { localStorage.setItem('rq-cl-paz-tab', e.target.checked ? '1' : '0'); } catch {} A.aggiornaTabPaziente(); };
  A.$('#cl-esporta').onclick = () => { A.aggiornaDialogoEsporta(); A.$('#dlg-esporta').showModal(); };
  A.$('#ex-chiudi').onclick = () => A.$('#dlg-esporta').close();
  A.$('#dlg-esporta').querySelectorAll('input[name="ex-cosa"]').forEach((r) => r.addEventListener('change', A.aggiornaDialogoEsporta));
  A.$('#ex-vai').onclick = () => A.esportaClient().catch((e) => { console.error(e); A.$('#ex-stato').textContent = 'Esportazione non riuscita: ' + e.message; A.$('#ex-vai').disabled = false; });
  try { A.CL.canale = new BroadcastChannel('rq-client'); A.CL.canale.onmessage = (e) => A.clientRicevi(e.data); } catch {}
  if (A.CL.finestra) location.hash = '#/caso/locale';
}
// ---- client: avviso privacy e uso (alla prima apertura, da accettare; si rilegge dal link nella pagina iniziale)
// e cancellazione dei dati salvati nel browser (bozze, immagini chiave, annotazioni, recenti, cartella predefinita)
let PRIVACY_CL;   // valore in avvio()
function avvisoPrivacyClient(forza) {
  const d = A.$('#dlg-privacy-cl'); if (!d) return;
  let ok = false; try { ok = localStorage.getItem(PRIVACY_CL) === '1'; } catch {}
  if (ok && !forza) return;
  A.$('#pr-accetto').textContent = ok ? 'Chiudi' : 'Ho letto e accetto';
  A.$('#pr-accetto').onclick = () => { try { localStorage.setItem(PRIVACY_CL, '1'); } catch {} d.close(); };
  d.oncancel = (e) => { if (!ok) e.preventDefault(); };     // la prima volta si chiude solo accettando
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
}
async function cancellaDatiClient() {
  if (!confirm('Cancellare da questo browser bozze dei referti, immagini chiave, annotazioni, disegni delle scale, esami recenti, cartella predefinita degli esami e cartella dei vetrini? I file sul disco non vengono toccati.')) return;
  try { for (const k of Object.keys(localStorage)) if (/^rq-(chiave:|referto:|schemi:)/.test(k)) localStorage.removeItem(k); } catch {}
  const via = (n) => new Promise((ok) => { try { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => ok(); } catch { ok(); } });
  await via('rq-client'); await via('rq-annotazioni');
  A.IC.lista = []; try { A.disegnaIC(); } catch {}
  A.$('#cl-cancella-stato').textContent = 'Dati cancellati ✓'; try { mostraArchivio(); mostraVetriniCartella(); mostraUltimo(); } catch {}
}
// IndexedDB del client (solo in questo browser): ultimo esame, archivio degli esami recenti, cartella predefinita e suo indice
function dbCl(store, modo, chiave, valore) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('rq-client', 3);
    r.onupgradeneeded = () => { for (const n of ['ultimo', 'archivio', 'cartella', 'indice', 'intestazioni']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error('archivio occupato da un\'altra scheda'));
    r.onsuccess = () => { const db = r.result; try { const tx = db.transaction(store, modo === 'get' || modo === 'tutti' ? 'readonly' : 'readwrite'), s = tx.objectStore(store);
      const q = modo === 'get' ? s.get(chiave) : modo === 'put' ? s.put(valore, chiave) : modo === 'del' ? s.delete(chiave) : modo === 'svuota' ? s.clear() : s.getAll();
      q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); tx.oncomplete = () => db.close(); } catch (e) { db.close(); ko(e); } };
  });
}
function dbUltimo(modo, v) { return dbCl('ultimo', modo, 'esame', v); }
// ---- client: archivio degli esami recenti e cartella predefinita (tutto solo in questo browser, mai sul server).
// L'elenco dei recenti si può spegnere e svuotare; la cartella predefinita è spenta di base e si accende nelle impostazioni.
const recentiAttivi = () => { try { return localStorage.getItem('rq-cl-recenti') !== '0'; } catch { return true; } };
const cartellaAttiva = () => { try { return localStorage.getItem('rq-cl-cartella') === '1' && !!window.showDirectoryPicker; } catch { return false; } };
let NOMI_MOD;   // valore in avvio()
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
  if (!A.CLIENT || !recentiAttivi() || !A.CL.studio) return;
  await A.pausa(500); const man = A.ULTIMO.maniglie, pacs = A.CL.daPacs; if (!man?.length && !pacs) return;
  const f = A.CL.sorgenti?.find((x) => x.size > 132), h = f ? await intestazioneStudio(f) : null;
  const voce = { id: String(A.CL.chiave || Date.now()).slice(0, 400), ...(man?.length ? { maniglie: man } : { daPacs: true }), quando: Date.now(), cartella: man?.length ? man.map((x) => x.name).join(', ') : 'PACS', titolo: A.CL.studio.caso.titolo, ...(h || {}) };
  await dbCl('archivio', 'put', voce.id, voce);
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
  const box = A.$('#cl-recenti'); if (!box || !A.CLIENT) return;
  const voci = await vociArchivio(), q = (A.$('#cl-rec-cerca')?.value || '').trim().toLowerCase();
  const testo = (v) => `${v.nome || ''} ${v.pid || ''} ${A.dataDicom(v.data)} ${v.data || ''} ${v.descrizione || ''} ${nomeModalita(v.modalita)} ${v.titolo || ''} ${v.cartella || ''}`.toLowerCase();
  const filtrate = voci.filter((v) => !q || q.split(/\s+/).every((p) => testo(v).includes(p))).slice(0, 200);
  box.hidden = !voci.length && !cartellaAttiva();
  A.$('#cl-rec-lista').innerHTML = filtrate.length ? `<table class="cl-rec-tab"><thead><tr><th>Paziente</th><th>Data</th><th>Esame</th><th></th></tr></thead><tbody>${filtrate.map((v, i) => `<tr>
      <td><b>${A.esc(v.nome || '—')}</b>${v.nascita ? `<span class="muted small"> · nato/a il ${A.dataDicom(v.nascita)}</span>` : ''}</td><td class="num">${A.dataDicom(v.data) || '—'}</td>
      <td>${A.esc([nomeModalita(v.modalita), v.descrizione || v.titolo || ''].filter(Boolean).join(' · ') || v.cartella || '')} <span class="cl-fonte ${v.fonte}">${v.fonte === 'recente' ? 'recente' : 'cartella'}</span></td>
      <td class="cl-rec-az"><button type="button" class="primary piccolo" data-apri="${i}">Apri</button>${v.fonte === 'recente' ? `<button type="button" class="ghost piccolo" data-togli="${i}" title="Togli dall'elenco">✕</button>` : ''}</td></tr>`).join('')}</tbody></table>`
    : `<p class="muted small">${q ? 'Nessun esame trovato.' : cartellaAttiva() ? 'Nessun esame: scegli la cartella o aggiorna l\'elenco nelle impostazioni.' : 'Nessun esame recente.'}</p>`;
  box.querySelectorAll('[data-apri]').forEach((b) => { b.onclick = () => apriDaArchivio(filtrate[+b.dataset.apri]).catch((e) => { A.$('#cl-stato').textContent = 'Non riesco ad aprire l\'esame: ' + e.message; }); });
  box.querySelectorAll('[data-togli]').forEach((b) => { b.onclick = async () => { await dbCl('archivio', 'del', filtrate[+b.dataset.togli].id); mostraArchivio(); }; });
}
async function permessoLettura(h) { let s = await h.queryPermission({ mode: 'read' }); if (s !== 'granted') s = await h.requestPermission({ mode: 'read' }); if (s !== 'granted') throw new Error('permesso di lettura non concesso'); }
async function apriDaArchivio(v, aggiungi = false) {
  if ((v.daPacs || v.pacs) && v.uid && !v.maniglie?.length) { throw new Error('questo esame era stato aperto dal PACS, collegamento non più disponibile: aprilo da una cartella o da un CD'); }
  if (v.maniglie?.length) {
    for (const h of v.maniglie) await permessoLettura(h);
    const st = A.$('#cl-stato'); st.className = 'stato'; st.textContent = 'Apro l\'esame: leggo l\'elenco dei file…';
    // disco esterno in standby, CD lento o disco di rete: dopo 15 secondi senza risposta lo si dice
    const lento = setTimeout(() => { if (/leggo/.test(st.textContent)) st.textContent += ' (la cartella risponde lentamente: disco esterno in standby, CD o disco di rete? Attendi o ricollega il disco)'; }, 15000);
    let f;
    try { f = await fileDaManiglie(v.maniglie, (n) => { st.textContent = `Apro l'esame: leggo i file (${n})…`; }); }
    finally { clearTimeout(lento); }
    if (!f.length) throw new Error('file non trovati (cartella spostata o disco scollegato)');
    st.textContent = `Apro l'esame: ${f.length} file…`;
    if (!aggiungi) { A.ULTIMO.maniglie = v.maniglie; ricordaManiglie(v.maniglie); return caricaClient(f); }
    return caricaClient(f, { aggiungi: true });
  }
  const dir = await dbCl('cartella', 'get', 'predefinita'); if (!dir) throw new Error('cartella predefinita non impostata');
  await permessoLettura(dir); A.$('#cl-stato').textContent = 'Apro lo studio dalla cartella…';
  const voluti = new Set(v.percorsi || []), dirs = new Set(); for (const p of voluti) { const parti = p.split('/'); for (let i = 1; i < parti.length; i++) dirs.add(parti.slice(0, i).join('/')); }
  const out = [];
  const giro = async (h, base) => { for await (const x of h.values()) { const p = base + x.name;
    if (x.kind === 'file') { if (voluti.has(p)) { const f = await x.getFile(); f._percorso = p; out.push(f); } } else if (dirs.has(p)) await giro(x, p + '/'); } };
  await giro(dir, '');
  if (!out.length) throw new Error('file non trovati: aggiorna l\'elenco della cartella');
  return aggiungi ? caricaClient(out, { aggiungi: true }) : caricaClient(out);
}
async function leggiCartella() {
  const st = A.$('#cl-cartella-stato'), scrivi = (t) => { if (st) st.textContent = t; };
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
  await dbCl('indice', 'put', 'studi', { quando: Date.now(), studi: lista, cartella: dir.name });
  scrivi(`${lista.length} ${lista.length === 1 ? 'studio' : 'studi'} in «${dir.name}» (${letti} file letti)`);
  mostraArchivio();
}
async function initArchivio() {
  if (!A.CLIENT || !A.$('#cl-impostazioni')) return;
  const r = A.$('#cl-imp-recenti'), c = A.$('#cl-imp-cartella'), box = A.$('#cl-cartella-box');
  r.checked = recentiAttivi(); c.checked = cartellaAttiva(); box.hidden = !c.checked; A.$('#cl-cartella-no').hidden = !!window.showDirectoryPicker;
  if (!window.showDirectoryPicker) c.disabled = true;
  r.onchange = async () => { try { localStorage.setItem('rq-cl-recenti', r.checked ? '1' : '0'); } catch {} if (!r.checked) { await dbCl('archivio', 'svuota').catch(() => {}); await dbCl('intestazioni', 'svuota').catch(() => {}); } mostraArchivio(); };
  c.onchange = async () => {
    try { localStorage.setItem('rq-cl-cartella', c.checked ? '1' : '0'); } catch {}
    box.hidden = !c.checked;
    if (!c.checked) { await dbCl('cartella', 'del', 'predefinita').catch(() => {}); await dbCl('indice', 'del', 'studi').catch(() => {}); A.$('#cl-cartella-stato').textContent = ''; }
    mostraArchivio();
  };
  A.$('#cl-cartella-scegli').onclick = async () => { try { const h = await showDirectoryPicker({ id: 'rq-cartella', mode: 'read' }); await dbCl('cartella', 'put', 'predefinita', h); await leggiCartella(); } catch (e) { if (e?.name !== 'AbortError') A.$('#cl-cartella-stato').textContent = 'Cartella non scelta: ' + e.message; } };
  A.$('#cl-cartella-leggi').onclick = () => leggiCartella().catch((e) => { A.$('#cl-cartella-stato').textContent = 'Lettura non riuscita: ' + e.message; });
  A.$('#cl-rec-cerca').oninput = () => mostraArchivio();
  A.$('#cl-rec-svuota').onclick = async () => { await dbCl('archivio', 'svuota').catch(() => {}); await dbCl('intestazioni', 'svuota').catch(() => {}); mostraArchivio(); };
  if (c.checked) { const i = await dbCl('indice', 'get', 'studi').catch(() => null); A.$('#cl-cartella-stato').textContent = i ? `${i.studi.length} studi in «${i.cartella}» · aggiornato il ${new Date(i.quando).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Scegli la cartella.'; }
  mostraArchivio();
}
// ---- client (1.322): cartella dei vetrini. Si sceglie una volta (Chrome ed Edge); il client elenca i vetrini digitali che
// contiene, in tutti i formati che sa leggere, e li apre dal disco senza copiarli. Maniglia della cartella ed elenco restano
// solo in questo browser (IndexedDB «rq-client»), come la cartella predefinita degli esami. Spenta di base.
const vetriniCartAttiva = () => { try { return localStorage.getItem('rq-cl-vetrini') === '1' && !!window.showDirectoryPicker; } catch { return false; } };
let EST_VT;   // valore in avvio()
let NOMI_FMT_VT;   // valore in avvio()
const dimLeggibile = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1).replace('.', ',')} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`);
async function leggiCartellaVetrini() {
  const st = A.$('#cl-vtc-stato'), scrivi = (t) => { if (st) st.textContent = t; };
  const dir = await dbCl('cartella', 'get', 'vetrini'); if (!dir) { scrivi('Scegli prima la cartella dei vetrini.'); return; }
  try { await permessoLettura(dir); } catch (e) { scrivi(e.message); return; }
  const file = []; let n = 0;
  const giro = async (h, base, prof) => {
    if (prof > 8 || n > 100000) return;
    for await (const x of h.values()) {
      if (x.name.startsWith('.')) continue; const p = base + x.name;
      if (++n % 500 === 0) scrivi(`Leggo la cartella: ${n} file…`);
      if (x.kind === 'directory') await giro(x, p + '/', prof + 1); else file.push({ p, h: x });
    }
  };
  scrivi('Leggo la cartella…'); await giro(dir, '', 0);
  const vetrini = [], usati = new Set(), cartellaDi = (p) => p.split('/').slice(0, -1).join('/');
  const dati = async (x) => { const f = await x.h.getFile(); return { dim: f.size, data: f.lastModified, f }; };
  // MRXS: file .mrxs + cartella con lo stesso nome accanto; VSI: file .vsi + cartella «_nome_» con i file .ets
  for (const x of file) {
    const m = /^(.*\/)?([^/]+)\.(mrxs|vsi)$/i.exec(x.p); if (!m) continue;
    const fmt = m[3].toLowerCase(), dirP = (m[1] || '') + (fmt === 'mrxs' ? m[2] : `_${m[2]}_`) + '/';
    const parti = file.filter((y) => y.p.startsWith(dirP)); usati.add(x.p); parti.forEach((y) => usati.add(y.p));
    const d0 = await dati(x); let dim = d0.dim; for (const y of parti) dim += (await dati(y)).dim;
    vetrini.push({ nome: m[2], percorsi: [x.p, ...parti.map((y) => y.p)], formato: fmt, dim, data: d0.data, cartella: cartellaDi(x.p), incompleto: !parti.length });
  }
  for (const x of file) {
    if (usati.has(x.p) || !EST_VT.test(x.p)) continue;
    const est = x.p.split('.').pop().toLowerCase(), d = await dati(x);
    if (/^tiff?$/.test(est) && d.dim < 5e6) continue;   // TIFF piccoli: immagini normali, non vetrini
    vetrini.push({ nome: x.p.split('/').pop().replace(/\.[^.]+$/, ''), percorsi: [x.p], formato: est, dim: d.dim, data: d.data, cartella: cartellaDi(x.p) });
  }
  // DICOM WSI: i file .dcm dello stesso vetrino (un file per livello, stessa serie)
  const dicom = new Map();
  for (const x of file) {
    if (usati.has(x.p) || !/\.(dcm|dicom)$/i.test(x.p)) continue;
    try {
      const { f, dim, data } = await dati(x), b = new Uint8Array(await f.slice(0, Math.min(f.size, 1 << 16)).arrayBuffer());
      if (dicomParser.readPart10Header(b).string('x00020002')?.replace(/\0/g, '').trim() !== A.SOP_VETRINO) continue;
      let uid = cartellaDi(x.p), descr = '';
      try { const ds = dicomParser.parseDicom(b, { untilTag: 'x7fe00010' }); uid = (ds.string('x0020000e') || '').trim() || uid; descr = (ds.string('x0008103e') || '').trim(); } catch {}
      const v = dicom.get(uid) || { nome: descr || cartellaDi(x.p).split('/').pop() || x.p, percorsi: [], formato: 'dicom', dim: 0, data, cartella: cartellaDi(x.p) };
      v.percorsi.push(x.p); v.dim += dim; dicom.set(uid, v);
    } catch {}
  }
  vetrini.push(...dicom.values());
  vetrini.sort((a, b) => a.cartella.localeCompare(b.cartella) || a.nome.localeCompare(b.nome));
  await dbCl('indice', 'put', 'vetrini', { quando: Date.now(), cartella: dir.name, vetrini });
  scrivi(`${vetrini.length} ${vetrini.length === 1 ? 'vetrino' : 'vetrini'} in «${dir.name}» (${file.length} file)`);
  mostraVetriniCartella();
}
async function mostraVetriniCartella() {
  const box = A.$('#cl-vtc'); if (!box || !A.CLIENT) return;
  box.hidden = !vetriniCartAttiva(); if (box.hidden) return;
  const idx = await dbCl('indice', 'get', 'vetrini').catch(() => null), q = (A.$('#cl-vtc-cerca')?.value || '').trim().toLowerCase();
  A.$('#cl-vtc-nome').textContent = idx?.cartella ? `«${idx.cartella}»` : '';
  const l = (idx?.vetrini || []).filter((v) => !q || q.split(/\s+/).every((p) => `${v.nome} ${v.cartella} ${NOMI_FMT_VT[v.formato] || v.formato}`.toLowerCase().includes(p))).slice(0, 300);
  A.$('#cl-vtc-lista').innerHTML = l.length ? `<table class="cl-rec-tab"><thead><tr><th></th><th>Vetrino</th><th>Formato</th><th>Dimensione</th><th>Data</th><th></th></tr></thead><tbody>${l.map((v, i) => `<tr>
      <td class="cl-vtc-mini"><img alt="" data-mini="${A.esc(chiaveMiniVt(v))}" width="64" height="48"></td><td><b>${A.esc(v.nome)}</b>${v.cartella ? `<span class="muted small"> · ${A.esc(v.cartella)}</span>` : ''}${v.incompleto ? ' <span class="cl-fonte" title="Manca la cartella con i dati accanto al file">incompleto</span>' : ''}</td>
      <td>${A.esc(NOMI_FMT_VT[v.formato] || v.formato)}</td><td class="num">${dimLeggibile(v.dim)}</td><td class="num">${new Date(v.data).toLocaleDateString('it-IT')}</td>
      <td class="cl-rec-az"><button type="button" class="primary piccolo" data-vtc="${i}">Apri</button></td></tr>`).join('')}</tbody></table>`
    : `<p class="muted small">${!idx ? 'Scegli la cartella dei vetrini nelle impostazioni (⚙ qui sotto).' : q ? 'Nessun vetrino trovato.' : 'Nessun vetrino nella cartella: aggiorna l\'elenco se ne hai aggiunti.'}</p>`;
  box.querySelectorAll('[data-vtc]').forEach((b) => { b.onclick = () => apriVetrinoDaCartella(l[+b.dataset.vtc]).catch((e) => { const st = A.$('#cl-stato'); st.className = 'stato errore'; st.textContent = 'Vetrino non aperto: ' + e.message; }); });
  miniatureVetriniCartella(l).catch((e) => console.warn('miniature', e));
}
async function fileVetrinoCartella(dir, v) {
  const out = [];
  for (const p of v.percorsi) {
    try {
      const parti = p.split('/'); let h = dir; for (const d of parti.slice(0, -1)) h = await h.getDirectoryHandle(d);
      const f = await (await h.getFileHandle(parti.at(-1))).getFile(); f._percorso = p;
      try { Object.defineProperty(f, 'webkitRelativePath', { value: p }); } catch {}   // MRXS e VSI cercano i file accanto per percorso
      out.push(f);
    } catch {}
  }
  return out;
}
async function apriVetrinoDaCartella(v) {
  const dir = await dbCl('cartella', 'get', 'vetrini'); if (!dir) throw new Error('cartella dei vetrini non impostata');
  await permessoLettura(dir);
  const st = A.$('#cl-stato'); st.className = 'stato'; st.textContent = `Apro il vetrino «${v.nome}»…`;
  const out = await fileVetrinoCartella(dir, v);
  if (!out.length) throw new Error('file non trovati: la cartella è cambiata o il disco è scollegato, aggiorna l\'elenco');
  return caricaClient(out);
}
// miniature dell'elenco: una alla volta, ricordate nel browser (chiave: percorso, dimensione e data del file); solo se il
// permesso di lettura c'è già (nessuna richiesta di permesso senza un clic); vetrino non leggibile → segnato, non si riprova
const chiaveMiniVt = (v) => `mini|${v.percorsi[0]}|${v.dim}|${v.data}`;
let MINI_VT_GIRO;   // valore in avvio()
async function miniatureVetriniCartella(l) {
  const giro = ++MINI_VT_GIRO, dir = await dbCl('cartella', 'get', 'vetrini').catch(() => null);
  if (!dir || await dir.queryPermission({ mode: 'read' }).catch(() => 'denied') !== 'granted') return;
  for (const v of l) {
    if (giro !== MINI_VT_GIRO) return;                       // elenco ridisegnato (ricerca, aggiornamento): si riparte da lì
    const img = A.$(`#cl-vtc-lista img[data-mini="${CSS.escape(chiaveMiniVt(v))}"]`); if (!img || img.dataset.pronta) continue;
    let m = await dbCl('indice', 'get', chiaveMiniVt(v)).catch(() => null);
    if (m === undefined || m === null) {
      try {
        const { miniaturaVetrino } = await import('./vetrini.js'), cv = await miniaturaVetrino(await fileVetrinoCartella(dir, v));
        m = cv ? cv.toDataURL('image/jpeg', 0.8) : '';
      } catch (e) { console.warn('miniatura', v.nome, e); m = ''; }
      await dbCl('indice', 'put', chiaveMiniVt(v), m).catch(() => {});
    }
    if (giro !== MINI_VT_GIRO) return;
    const im = A.$(`#cl-vtc-lista img[data-mini="${CSS.escape(chiaveMiniVt(v))}"]`); if (!im) continue;
    im.dataset.pronta = '1'; if (m) { im.src = m; im.classList.add('ok'); } else im.closest('.cl-vtc-mini')?.classList.add('vuota');
  }
}
function initVetriniCartella() {
  const c = A.$('#cl-imp-vetrini'), box = A.$('#cl-vtc-box'); if (!c) return;
  c.checked = vetriniCartAttiva(); box.hidden = !c.checked; if (!window.showDirectoryPicker) c.disabled = true;
  c.onchange = async () => {
    try { localStorage.setItem('rq-cl-vetrini', c.checked ? '1' : '0'); } catch {}
    box.hidden = !c.checked;
    if (!c.checked) { await dbCl('cartella', 'del', 'vetrini').catch(() => {}); await dbCl('indice', 'del', 'vetrini').catch(() => {}); A.$('#cl-vtc-stato').textContent = ''; }
    mostraVetriniCartella();
  };
  A.$('#cl-vtc-scegli').onclick = async () => { try { const h = await showDirectoryPicker({ id: 'rq-vetrini', mode: 'read' }); await dbCl('cartella', 'put', 'vetrini', h); await leggiCartellaVetrini(); } catch (e) { if (e?.name !== 'AbortError') A.$('#cl-vtc-stato').textContent = 'Cartella non scelta: ' + e.message; } };
  const leggi = () => leggiCartellaVetrini().catch((e) => { A.$('#cl-vtc-stato').textContent = 'Lettura non riuscita: ' + e.message; });
  A.$('#cl-vtc-leggi').onclick = leggi; A.$('#cl-vtc-aggiorna').onclick = leggi;
  A.$('#cl-vtc-cerca').oninput = () => mostraVetriniCartella();
  if (c.checked) dbCl('indice', 'get', 'vetrini').then((i) => { A.$('#cl-vtc-stato').textContent = i ? `${i.vetrini.length} vetrini in «${i.cartella}» · aggiornato il ${new Date(i.quando).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Scegli la cartella dei vetrini.'; }).catch(() => {});
  mostraVetriniCartella();
}
// precedenti automatici: aprendo un esame si cerca tra i recenti e nella cartella predefinita uno studio più vecchio dello
// stesso paziente (ID, o nome e data di nascita) e della stessa metodica; si propone il confronto affiancato
async function cercaPrecedenti() {
  if (!A.CL.studio) return;
  const f = A.CL.sorgenti?.find((x) => x.size > 132), h = f && await intestazioneStudio(f); if (!h || (!h.pid && !h.nome)) return;
  const stesso = (v) => v.uid && v.uid !== h.uid && ((h.pid && v.pid === h.pid) || (!h.pid && h.nome && v.nome === h.nome && v.nascita === h.nascita));
  const dalPacs = [];
  const cand = [...(await vociArchivio()), ...dalPacs].filter(stesso).filter((v) => !h.modalita || !v.modalita || v.modalita.split('/').includes(h.modalita))
    .filter((v) => !h.data || !v.data || v.data < h.data).sort((x, y) => String(y.data).localeCompare(String(x.data)));
  const p = cand.find((v) => !h.regione || !v.regione || v.regione === h.regione); if (!p) return;
  let b = A.$('#cl-precedente'); if (!b) { b = document.createElement('div'); b.id = 'cl-precedente'; b.className = 'cl-precedente'; b.setAttribute('role', 'status'); document.body.append(b); }
  b.innerHTML = `<span>🕘 Esame precedente dello stesso paziente: <b>${A.esc(nomeModalita(p.modalita) || 'esame')} del ${A.dataDicom(p.data) || '—'}</b>${p.descrizione ? ' · ' + A.esc(p.descrizione) : ''}</span><button type="button" class="primary piccolo" id="cl-prec-apri">Confronta</button><button type="button" class="ghost piccolo" id="cl-prec-chiudi" aria-label="Chiudi">✕</button>`;
  b.hidden = false;
  A.$('#cl-prec-chiudi').onclick = () => { b.hidden = true; };
  A.$('#cl-prec-apri').onclick = async () => { b.hidden = true; try { await apriDaArchivio(p, true); } catch (e) { A.avvisoBreve('Precedente non aperto: ' + e.message); } };
}
// ---- client: il collegamento al PACS (DICOMweb) è stato tolto il 7/11/2026: il visualizzatore è solo per la formazione e
// non si collega ai sistemi dell'ospedale. Restano le esportazioni in file (SR, GSPS, SEG, Secondary Capture).
const pacsAttivo = () => false;
const pacsBase = () => '';
function mostraPacs() {}
function aggiornaVociPacs() {}
function initPacs() { try { localStorage.removeItem('rq-cl-pacs'); localStorage.removeItem('rq-cl-pacs-url'); } catch {} }
async function fileDaManiglie(lista, avanza) {
  const out = []; let ultimo = 0;
  const giro = async (h, base) => {
    if (h.kind === 'file') {
      const f = await h.getFile(); f._percorso = base + f.name; out.push(f);
      if (avanza && Date.now() - ultimo > 250) { ultimo = Date.now(); avanza(out.length); }
      return;
    }
    for await (const x of h.values()) await giro(x, base + h.name + '/');
  };
  try { for (const h of lista) await giro(h, ''); }
  catch (e) {
    if (/NotFound|NotReadable|could not be found|not be read/i.test(`${e.name} ${e.message}`)) throw new Error('file non trovati o non leggibili: la cartella è stata spostata, il disco o il CD non è collegato, oppure il disco di rete non risponde');
    throw e;
  }
  return out;
}
async function ricordaManiglie(maniglie) {
  if (!maniglie.length) return;
  A.ULTIMO.maniglie = maniglie;
  try { await dbUltimo('put', { maniglie, quando: Date.now(), nome: maniglie.map((h) => h.name).join(', ') }); } catch (e) { console.warn('ultimo esame', e); }
}
function dimenticaManiglie() { A.ULTIMO.maniglie = []; dbUltimo('del').catch(() => {}); A.$('#cl-ultimo').hidden = true; }
async function mostraUltimo() {
  const u = await dbUltimo('get').catch(() => null), b = A.$('#cl-ultimo'); if (!b) return;
  b.hidden = !u?.maniglie?.length || !!A.CL.studio;
  if (!b.hidden) A.$('#cl-ultimo-nome').textContent = `${u.nome.length > 60 ? u.nome.slice(0, 57) + '…' : u.nome} (${new Date(u.quando).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})`;
}
async function riapriUltimo(automatico) {
  const u = await dbUltimo('get').catch(() => null); if (!u?.maniglie?.length) return false;
  for (const h of u.maniglie) {
    let st = await h.queryPermission({ mode: 'read' });
    if (st !== 'granted' && !automatico) st = await h.requestPermission({ mode: 'read' });
    if (st !== 'granted') { if (automatico) { mostraUltimo(); A.$('#cl-stato').textContent = 'La pagina è stata ricaricata: «↻ Riapri l\'ultimo esame» lo riapre dal disco.'; } return false; }
  }
  A.$('#cl-stato').textContent = 'Riapro l\'ultimo esame…';
  const f = await fileDaManiglie(u.maniglie).catch(() => []);
  if (!f.length) { A.$('#cl-stato').textContent = 'L\'ultimo esame non si trova più (cartella spostata o disco scollegato).'; return false; }
  A.ULTIMO.maniglie = u.maniglie; A.$('#cl-ultimo').hidden = true; await caricaClient(f); return true;
}
// trascinamento: cartelle annidate, con il percorso (serve al DICOMDIR)
async function leggiVoceConPercorso(voce, out, base) {
  if (voce.isFile) { const f = await new Promise((r, x) => voce.file(r, x)); f._percorso = base + f.name; out.push(f); return; }
  if (voce.isDirectory) {
    const lettore = voce.createReader();
    for (;;) {
      const blocco = await new Promise((r, x) => lettore.readEntries(r, x));
      if (!blocco.length) break;
      for (const v of blocco) await leggiVoceConPercorso(v, out, base + voce.name + '/');
    }
  }
}
const percorsoDi = (f) => (f._percorso || f.webkitRelativePath || f.name).replace(/\\/g, '/');
// ---- DICOMDIR (CD e DVD): studi e serie con i file che contengono, per scegliere cosa aprire
function leggiDicomdir(buf) {
  const ds = dicomParser.parseDicom(new Uint8Array(buf));
  const rec = ds.elements.x00041220?.items || [];
  const perOff = new Map(rec.map((it) => [it.dataOffset - 8, it]));
  const tipo = (it) => (it.dataSet.string('x00041430') || '').trim().toUpperCase();
  const studi = [];
  let studio = null, serie = null;
  const visita = (it) => {
    const t = tipo(it), d = it.dataSet;
    if (t === 'STUDY') { studio = { uid: d.string('x0020000d') || '', data: d.string('x00080020') || '', descrizione: (d.string('x00081030') || '').trim(), serie: [] }; studi.push(studio); }
    else if (t === 'SERIES' && studio) { serie = { modalita: (d.string('x00080060') || '').trim(), numero: d.intString('x00200011') || 0, descrizione: (d.string('x0008103e') || '').trim(), file: [] }; studio.serie.push(serie); }
    else if (serie && (d.string('x00041500') || '')) serie.file.push(d.string('x00041500').trim().replace(/\\/g, '/'));
  };
  // gerarchia dagli offset (record successivo e figlio); se non tornano, ordine del file
  const radice = ds.uint32('x00041200');
  if (radice && perOff.has(radice)) {
    const giro = (off, prof) => {
      for (let n = 0; off && n < 100000; n++) {
        const it = perOff.get(off); if (!it) break;
        visita(it);
        const giu = it.dataSet.uint32('x00041420'); if (giu && prof < 6) giro(giu, prof + 1);
        off = it.dataSet.uint32('x00041400');
      }
    };
    giro(radice, 0);
  }
  if (!studi.length) for (const it of rec) visita(it);
  return studi.filter((s) => s.serie.some((x) => x.file.length));
}
function aggiungiEsameClient(files) {
  if (!files?.length) return;
  A.avvisoBreve('Aggiungo l\'esame per il confronto…');
  caricaClient(files, { aggiungi: true });
}
async function caricaClient(files, { aggiungi = false } = {}) {
  const { analizza, anonimizza, verifica, paroleVietate, dividiSerie, controllaIntestazione } = await A.modAnon();
  if (A.V.caso?.id === 'locale' && A.CL.studio && A.annotazioniNonSalvate() && !(await A.primaDiChiudere())) return;
  const st = (t, tipo = '') => { const el = A.$('#cl-stato'); el.innerHTML = t; el.className = 'stato ' + tipo; };
  A.$('#cl-scelta').hidden = true;
  files = files.filter((f) => !/(^|\/)\./.test(percorsoDi(f)) && f.size > 0);
  try { files = await A.espandiZip(files, st); } catch (e) { st('Archivio non aperto: ' + A.esc(e.message), 'errore'); return; }
  // licenze e istruzioni che accompagnano gli esami scaricati dagli archivi (LICENSE di TCIA, LEGGIMI.txt, README):
  // non sono immagini e non vanno segnalate come «non DICOM»
  files = files.filter((f) => !/(^|\/)(LICENSE|LICENCE|LEGGIMI|README)[^/]*\.(txt|md|pdf)$|(^|\/)(LICENSE|LICENCE|README)$/i.test(percorsoDi(f)));
  // file di sessione insieme all'esame (per esempio nello zip anonimizzato): si riapre dopo le immagini
  const sessione = files.find((f) => /\.rqsess(\.json)?$/i.test(f.name || ''));
  if (sessione) { A.CL.sessioneDaAprire = sessione; files = files.filter((f) => f !== sessione); }
  if (!files.length) { st('Nessun file nella selezione.', 'errore'); return; }
  // CD con DICOMDIR: elenco degli studi, si aprono quelli scelti
  const dd = files.find((f) => /(^|\/)DICOMDIR$/i.test(percorsoDi(f)));
  if (dd) {
    try {
      const studi = leggiDicomdir(await dd.arrayBuffer()), base = percorsoDi(dd).replace(/DICOMDIR$/i, '').toUpperCase();
      const mappa = new Map(files.map((f) => [percorsoDi(f).toUpperCase(), f]));
      for (const s of studi) { s.files = s.serie.flatMap((x) => x.file.map((p) => mappa.get(base + p.toUpperCase()))).filter(Boolean); s.n = s.files.length; }
      const validi = studi.filter((s) => s.n);
      if (validi.length > 1) { if (aggiungi) { location.hash = '#/'; await A.pausa(50); } sceltaStudi(validi, aggiungi); return; }
      if (validi.length === 1) { files = validi[0].files; }
    } catch (e) { console.warn('DICOMDIR non leggibile, leggo tutti i file', e); }
  }
  files = files.filter((f) => !/(^|\/)DICOMDIR$/i.test(percorsoDi(f)));
  // esame aggiunto: insieme ai file già aperti (gli studi diventano attuale e precedenti)
  if (aggiungi && A.CL.sorgenti?.length) { const visti = new Set(A.CL.sorgenti); files = [...A.CL.sorgenti, ...files.filter((f) => !visti.has(f))]; }
  A.CL.sorgenti = files;
  const perSerie = new Map(), esclusi = {}, sintassi = new Set(); let fatti = 0, byte = 0, nImm = 0;
  A.CL.file = [];
  // esame già aperto su questo computer: le intestazioni lette l'altra volta (stessi file: percorso, dimensione e data
  // di modifica) si riusano e l'esame si apre senza rileggerle
  const chiaveF = (f) => `${percorsoDi(f)}|${f.size}|${f.lastModified || 0}`;
  const firmaEs = files.length >= 20 ? `${files.length}|${files.reduce((a, f) => a + f.size, 0)}|${chiaveF(files[0])}|${chiaveF(files[files.length - 1])}` : null;
  const giaLette = firmaEs ? await dbCl('intestazioni', 'get', firmaEs).catch(() => null) : null, nuoveLette = {};
  if (giaLette) st(`Esame già aperto su questo computer: preparo le serie (${files.length} file)…`);
  // solo l'intestazione: prima 64 kB (basta quasi sempre: una TC da 512 kB si legge per un ottavo, utile con dischi
  // esterni, CD e dischi di rete lenti), se l'intestazione è più lunga il primo MB, poi il file intero
  const leggiIntestazione = async (f) => {
    let info = null;
    // vetrino digitale (anatomia patologica): solo il tipo dall'intestazione del file, il resto lo legge vetrini.js
    try { const t = new Uint8Array(await f.slice(0, Math.min(f.size, 65536)).arrayBuffer()); if (dicomParser.readPart10Header(t).string('x00020002')?.replace(/\0/g, '').trim() === A.SOP_VETRINO) return { vetrino: true }; } catch {}
    // altri formati di vetrino (SVS, NDPI, TIFF piramidali, MRXS, CZI, VSI, iSyntax): li legge vetrini-formati.js
    if (!(await A.eDicomFile(f))) { const fm = await A.formatoVetrinoFile(f); if (fm) return { vetrino: true, formato: fm }; }
    if (f.size > 65536) {
      const b = await f.slice(0, 65536).arrayBuffer();
      let finita = false; try { finita = !!dicomParser.parseDicom(new Uint8Array(b), { untilTag: 'x7fe00010' }).elements.x7fe00010; } catch {}
      if (finita) info = analizza(b, { intestazione: true });
    }
    if (!info) info = analizza(await f.slice(0, 1 << 20).arrayBuffer(), { intestazione: true });
    if (info.escluso === 'non è un file DICOM' && f.size > 1 << 20) info = analizza(await f.arrayBuffer(), { intestazione: true });
    // sintassi deflate: si legge il file intero decompresso (daFile lo decomprime anche quando servono le immagini)
    if (info.ts === A.TS_DEFLATE) try { info = analizza(await A.sgonfiaDeflate(await f.arrayBuffer()), { intestazione: true }); } catch (e) { console.warn('deflate', e); }
    return info;
  };
  // un file che non si riesce a leggere (disco che non risponde, file solo nel cloud, CD rovinato) non blocca l'apertura:
  // dopo 20 secondi si salta e si dice quanti sono
  const NON_LETTO = 'file non letti in tempo (disco lento o file non scaricato dal cloud)';
  const conLimite = (f) => Promise.race([leggiIntestazione(f).catch(() => ({ escluso: NON_LETTO })), new Promise((ok) => setTimeout(() => ok({ escluso: NON_LETTO }), 20000))]);
  const saltati = [], vetriniFile = [];
  await A.aGruppi(files, 12, async (f) => {
    let info = giaLette?.info?.[chiaveF(f)];
    if (!info) {
      info = await conLimite(f);
      if (info.escluso === NON_LETTO) saltati.push(f);
      if (firmaEs && info.escluso !== NON_LETTO) nuoveLette[chiaveF(f)] = info;
    }
    if (info.vetrino) { vetriniFile.push(f); return; }
    if (info.escluso && /non è un file|senza immagine|big endian|referto strutturato|non letti in tempo/.test(info.escluso)) { esclusi[info.escluso] = (esclusi[info.escluso] || 0) + 1; }
    else if (/^(SEG|SR|PR|KO|RTSTRUCT|RTPLAN|REG|DOC)$/.test(info.modalita || '')) { const m = 'oggetti non immagine (segmentazioni, referti, stati di presentazione)'; esclusi[m] = (esclusi[m] || 0) + 1; }
    else if (A.NOMI_TS[info.ts] && !A.TS_CODEC[info.ts] && !A.TS_VIDEO[info.ts] && /video|deflate/.test(A.NOMI_TS[info.ts])) { const m = `${A.NOMI_TS[info.ts]} (non supportato)`; esclusi[m] = (esclusi[m] || 0) + 1; }
    else {
      sintassi.add(info.ts); byte += f.size;
      const nf = info.nFrames || 1, mf = nf > 1;
      // multi-frame: ogni file è una serie (clip eco, angiografia, tomosintesi, TC/RM «enhanced»)
      const k = (info.serieUID || 'senza-serie') + (info.vistaMG ? '|' + info.vistaMG : '') + (mf ? '|mf|' + percorsoDi(f) : '');
      if (!perSerie.has(k)) perSerie.set(k, { uid: k, numero: info.serieNum, descrizione: info.vistaMG || info.descrizione || `Serie ${info.serieNum}`, modalita: info.modalita, studio: info.studio, dataStudio: info.dataStudio,
        regione: info.regione || '', data: info.data || '', eta: info.eta, suv: info.suv || null, cine_ms: mf && info.frameMs ? info.frameMs : null, voci: [] });
      const ps = perSerie.get(k); if (!ps.suv && info.suv) ps.suv = info.suv;
      const voceFile = { file: f, eco: info.modalita === 'US', mf, escluso: info.escluso };
      A.CL.file.push(voceFile);
      if (!mf) { ps.voci.push({ file: f, sorgente: f, voceFile, istanza: info.istanza, posizione: info.posizione, ipp: info.ipp, iop: info.iop, tempo: info.tempo }); nImm++; }
      else for (let j = 0; j < nf; j++) { const g = info.frames?.[j] || {}; ps.voci.push({ file: f, sorgente: { file: f, frame: j }, voceFile, istanza: j + 1, posizione: null, ipp: g.ipp || null, iop: g.iop || info.iop, tempo: null }); nImm++; }
    }
    ++fatti; if (!giaLette && (fatti % 20 === 0 || fatti === files.length)) st(`Lettura delle intestazioni: ${fatti} / ${files.length}` + A.barra(fatti / files.length));
  });
  if (firmaEs && !giaLette && Object.keys(nuoveLette).length) {
    try {
      await dbCl('intestazioni', 'put', firmaEs, { quando: Date.now(), info: nuoveLette });
      // al massimo 20 esami ricordati: si tolgono i più vecchi
      const el = ((await dbCl('intestazioni', 'get', '_elenco')) || []).filter((x) => x !== firmaEs); el.push(firmaEs);
      while (el.length > 20) await dbCl('intestazioni', 'del', el.shift());
      await dbCl('intestazioni', 'put', '_elenco', el);
    } catch (e) { console.warn('intestazioni non ricordate', e); }
  }
  // vetrini digitali: si aprono nella loro vista (zoom a tessere); senza altre immagini si va subito lì
  if (!aggiungi || !A.CL.vetrini) A.CL.vetrini = [];
  if (vetriniFile.length) {
    st(`Leggo ${vetriniFile.length === 1 ? 'il vetrino' : `${vetriniFile.length} file di vetrini`}…`);
    try { const { preparaVetrini } = await import('./vetrini.js'); A.CL.vetrini.push(...await preparaVetrini(vetriniFile)); } catch (e) { console.warn('vetrini', e); st('Vetrino non leggibile: ' + A.esc(e.message), 'errore'); }
    A.aggiornaBottoneVetrini();
    if (!perSerie.size && A.CL.vetrini.length) { try { A.caricaIC(); } catch {} st(`<b>${A.CL.vetrini.length === 1 ? 'Vetrino digitale' : A.CL.vetrini.length + ' vetrini digitali'}</b> (anatomia patologica): si apre la vista a ingrandimento.`, 'ok'); A.apriVetrinoClient(0); return; }
  }
  if (!perSerie.size) { st('Nessuna immagine DICOM visualizzabile' + (Object.keys(esclusi).length ? ': ' + Object.entries(esclusi).map(([m, n]) => `${n} ${m}`).join(', ') : '.'), 'errore'); return; }
  // decodificatori delle compressioni presenti, una volta sola (poi funzionano anche senza rete)
  for (const ts of sintassi) if (A.TS_CODEC[ts]) { st('Preparo il decodificatore ' + ({ jpeg: 'JPEG', j2k: 'JPEG 2000', jls: 'JPEG-LS' }[A.TS_CODEC[ts]]) + '…'); try { await A.caricaCodec(A.TS_CODEC[ts]); } catch (e) { st('Decodificatore non disponibile: ' + e.message, 'errore'); return; } }
  const studi = [...new Map([...perSerie.values()].map((s) => [s.studio, s.dataStudio])).entries()].sort((x, y) => String(x[1]).localeCompare(String(y[1]))).map(([u]) => u);
  if (studi.length > 1) for (const s of perSerie.values()) { const n = studi.indexOf(s.studio) + 1; s.nStudio = n; s.descrizione = `Studio ${n} · ${s.data ? s.data + ' · ' : ''}${s.descrizione}`; }
  const lista = [...perSerie.values()].sort((a, b) => (a.nStudio || 0) - (b.nStudio || 0) || a.numero - b.numero).flatMap(dividiSerie);
  const buf = new Map(), serie = [], cartelle = new Set();
  for (const s of lista) {
    if (s.perPosizione) s.voci.sort((a, b) => a.ordine - b.ordine || a.istanza - b.istanza);
    else s.voci.sort((a, b) => a.istanza - b.istanza || (a.posizione ?? 0) - (b.posizione ?? 0) || a.file.name.localeCompare(b.file.name));
    let c = `${s.nStudio ? `s${s.nStudio}_` : ''}${String(Math.trunc(s.numero)).padStart(4, '0')}${s.piano ? '_' + s.piano.slice(0, 3) : ''}${s.fase ? `_f${String(s.fase).padStart(2, '0')}` : ''}_${A.slug(s.descrizione)}`;
    while (cartelle.has(c)) c += '_b'; cartelle.add(c);
    // i file restano sul disco: in BUF c'è il riferimento al file (e al fotogramma), letto quando serve
    const fl = s.voci.map((v, i) => { const p = `serie/${c}/img_${String(i).padStart(5, '0')}.dcm`; buf.set(`/casi/locale/${p}`, v.sorgente); if (!v.voceFile.percorso) v.voceFile.percorso = p; return p; });
    serie.push({ uidMis: s.uid || undefined, descrizione: s.descrizione + (s.piano && lista.filter((x) => x.uid === s.uid).length > 1 ? ` — ${s.piano}` : '') + (s.fase ? ` — fase ${s.fase}` : ''), files: fl,
      suv: s.suv || undefined, regione: s.regione || undefined, data: s.data || undefined, eta: s.eta ?? undefined, cine_ms: s.cine_ms || undefined });
  }
  const mod = new Set(lista.map((s) => s.modalita));
  const metodica = mod.has('CT') ? 'TC' : mod.has('MR') ? 'RM' : mod.has('MG') ? 'Mammografia' : mod.has('US') ? 'Ecografia' : mod.has('XA') ? 'Angiografia' : [...mod].some((m) => /^(CR|DX|DR|RF|PX)$/.test(m)) ? 'RX' : mod.has('PT') ? 'TC' : 'Altro';
  const nomeMod = { CT: 'TC', MR: 'RM', CR: 'RX', DX: 'RX', DR: 'RX', MG: 'Mammografia', US: 'Ecografia', PT: 'PET', NM: 'Medicina nucleare', XA: 'Angiografia', RF: 'Fluoroscopia' };
  const titolo = [[...new Set([...mod].map((m) => nomeMod[m] || m))].join(' + '), studi.length > 1 ? `${studi.length} studi` : '', `${serie.length} ${serie.length === 1 ? 'serie' : 'serie'}`, `${nImm} immagini`].filter(Boolean).join(' · ');
  A.CL.chiave = [...perSerie.values()].map((s) => s.uid).sort().join('|');
  if (!aggiungi && !files.every((f) => /^pacs_\d+\.dcm$/.test(f.name || ''))) A.CL.daPacs = null;
  A.CL.studio = { caso: { id: 'locale', titolo, modalita: metodica, ia: false, opzioni: [], sezioni: [], visibile: true }, serie, buf };
  if (A.$('#cl-precedente')) A.$('#cl-precedente').hidden = true;
  if (!aggiungi) registraArchivio().then(cercaPrecedenti).catch((e) => console.warn('archivio', e));
  const nEscl = Object.values(esclusi).reduce((a, b) => a + b, 0), gb = byte / 1e9;
  st(`<b>${nImm} immagini</b> in ${serie.length} serie${gb >= 0.1 ? ` (${A.virgola(gb, 1)} GB)` : ''}${nEscl ? ` · non visualizzabili: ${Object.entries(esclusi).map(([m, n]) => `${n} ${A.esc(m)}`).join(', ')}` : ''}.`
    + (gb > 1.5 ? ' <br>Esame grande: le immagini si leggono dal disco quando apri ogni serie; per MPR e 3D scegli serie sotto 1 GB circa.' : ''), 'ok');
  if (location.hash === '#/caso/locale') routerClient('caso'); else location.hash = '#/caso/locale';
  if (saltati.length) avvisoSaltati(saltati);
}
// file che non si sono potuti leggere: quali sono, perché (di solito iCloud Drive con «Ottimizza spazio»), e «Riprova»
function avvisoSaltati(saltati) {
  let d = A.$('#dlg-saltati');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlg-saltati'; d.className = 'dlg-saltati'; document.body.appendChild(d); }
  const nomi = saltati.map((f) => percorsoDi(f)).sort();
  const cartelle = [...new Set(nomi.map((p) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '(cartella scelta)'))];
  d.innerHTML = `<form method="dialog"><h3>⚠ ${saltati.length} file non letti</h3>
    <p>L'esame si è aperto senza questi file: la lettura non è finita entro 20 secondi. Di solito sono <b>file di iCloud Drive non scaricati</b> sul Mac (con «Ottimizza spazio del Mac» restano solo nel cloud), oppure un disco esterno in standby o un disco di rete lento.</p>
    <p class="small"><b>Per iCloud</b>: nel Finder, clic destro sulla cartella dell'esame → <b>Scarica ora</b> (aspetta che sparisca la nuvola), poi «Riprova». Per non avere più il problema: Impostazioni di Sistema → [il tuo nome] → iCloud → iCloud Drive → togli «Ottimizza spazio del Mac», oppure copia gli esami in una cartella fuori da iCloud.</p>
    <p class="small muted">${cartelle.length === 1 ? 'Cartella' : 'Cartelle'}: ${cartelle.slice(0, 5).map(A.esc).join(' · ')}${cartelle.length > 5 ? ` e altre ${cartelle.length - 5}` : ''}</p>
    <details${saltati.length <= 12 ? ' open' : ''}><summary>Elenco dei file (${saltati.length})</summary><ol class="saltati-lista">${nomi.slice(0, 300).map((n) => `<li>${A.esc(n)}</li>`).join('')}</ol>${nomi.length > 300 ? `<p class="small muted">… e altri ${nomi.length - 300}</p>` : ''}</details>
    <div class="riga"><button type="button" class="primary" id="saltati-riprova">↻ Riprova</button><button type="button" class="ghost" id="saltati-copia">Copia l'elenco</button><span class="spacer"></span><button value="chiudi">Chiudi</button></div></form>`;
  d.querySelector('#saltati-copia').onclick = async () => { try { await navigator.clipboard.writeText(nomi.join('\n')); A.avvisoBreve('Elenco copiato'); } catch { A.avvisoBreve('Copia non riuscita'); } };
  // si riapre tutto l'esame: i file già letti non si rileggono (intestazioni ricordate), si riprovano solo i saltati
  d.querySelector('#saltati-riprova').onclick = () => { d.close(); if (A.CL.sorgenti?.length) caricaClient(A.CL.sorgenti); };
  if (!d.open) d.showModal();
}
function sceltaStudi(studi, aggiungi = false) {
  const box = A.$('#cl-scelta');
  box.innerHTML = `<h3>Studi sul disco</h3><p class="muted small">Scegli quali aprire (più studi insieme si confrontano come attuale e precedenti).</p>`
    + studi.map((s, i) => `<label class="cl-studio"><input type="checkbox" value="${i}"${i === studi.length - 1 ? ' checked' : ''}> <span><b>${A.esc(A.dataLeggibile(s.data) || 'data non indicata')}</b> ${A.esc(s.descrizione || '')}<br><small class="muted">${A.esc([...new Set(s.serie.map((x) => x.modalita))].join(', '))} · ${s.serie.length} serie · ${s.n} immagini</small></span></label>`).join('')
    + `<p><button type="button" class="primary" id="cl-scelta-apri">Apri gli studi scelti</button></p>`;
  box.hidden = false; A.$('#cl-stato').textContent = '';
  A.$('#cl-scelta-apri').onclick = () => {
    const sc = [...box.querySelectorAll('input:checked')].map((x) => studi[+x.value]);
    if (!sc.length) return;
    box.hidden = true; caricaClient(sc.flatMap((s) => s.files), { aggiungi });
  };
}
// istruzioni che app.js eseguiva al caricamento (pulsanti e moduli di queste pagine): ora una volta, al primo uso
export function avvio() {
  PRIVACY_CL = 'rq-cl-privacy-1';
  NOMI_MOD = { CT: 'TC', MR: 'RM', CR: 'RX', DX: 'RX', DR: 'RX', MG: 'Mammografia', US: 'Ecografia', PT: 'PET', NM: 'Medicina nucleare', XA: 'Angiografia', RF: 'Fluoroscopia' };
  EST_VT = /\.(svs|tif|tiff|ndpi|scn|bif|qptiff|ptif|vtif|btf|czi|isyntax|i2syntax)$/i;
  NOMI_FMT_VT = { svs: 'Aperio SVS', ndpi: 'Hamamatsu NDPI', scn: 'Leica SCN', bif: 'Ventana BIF', mrxs: '3DHISTECH MRXS', czi: 'Zeiss CZI', isyntax: 'Philips iSyntax',
    i2syntax: 'Philips iSyntax', vsi: 'Olympus VSI', tif: 'TIFF', tiff: 'TIFF', qptiff: 'QPTIFF', ptif: 'TIFF', vtif: 'TIFF', btf: 'BigTIFF', dicom: 'DICOM WSI' };
  MINI_VT_GIRO = 0;
  // ricaricare la pagina chiude l'esame: dove non si può riaprire da solo, il browser chiede conferma
  addEventListener('beforeunload', (e) => { if (A.CLIENT && A.CL.studio && !A.CL.finestra && !A.ULTIMO.maniglie.length) { e.preventDefault(); e.returnValue = ''; } });
}
export { routerClient, chiudiStudio, chiudiEsameClient, registraArchivio, fileDaManiglie, ricordaManiglie, riapriUltimo, leggiVoceConPercorso, aggiungiEsameClient, caricaClient };
