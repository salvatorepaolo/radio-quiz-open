
// ================================================================ VERSIONE CLIENT (visualizzatore offline)
// /client/index.html: lo stesso visualizzatore del sito, da installare come app del browser. Apre cartelle, CD (DICOMDIR)
// o file DICOM dal disco di questo computer; i file non lasciano mai il computer (niente accesso, niente server). Dopo la
// prima apertura funziona anche senza rete (client/sw.js). Si leggono subito solo le intestazioni: le immagini si leggono
// dal disco quando servono (esami grandi). In più: compressioni JPEG / JPEG 2000 / JPEG-LS / RLE, multi-frame,
// anonimizzazione (anche con testo impresso coperto), esportazione PNG / MP4 / misure, finestre su più schermi.
async function routerClient(tipo) {
  await Promise.resolve();                                       // dopo il caricamento del modulo
  if (!CL.pronto) avviaClient();
  if (tipo === 'caso' && !CL.studio) {
    // finestra aperta da «Nuova finestra»: lo studio è quello della finestra principale (stessa origine, niente copie)
    try { const o = window.opener?.__rqClient; if (o?.studio) { CL.studio = o.studio; CL.file = o.file; } } catch {}
  }
  if (tipo === 'caso' && CL.studio) {
    document.body.classList.add('client-caso');
    $('#grp-client').hidden = false;
    await apriCaso('locale', CL.studio);
    $('#titolo-caso').textContent = CL.studio.caso.titolo + (CL.finestra ? ` · finestra ${CL.finestra}` : '');
    ripristinaMisureClient();
    if (CL.finestra && V.serie.length > 1) {      // le finestre aggiunte propongono un'altra serie
      const si = Math.min(V.serie.length - 1, CL.finestra - 1); if (si !== V.sIdx) await selezionaSerie(si, 0);
    }
    return;
  }
  document.body.classList.remove('client-caso');
  if (tipo === 'aiuto') { vista('aiuto'); await mostraAiuto(); return; }
  vista('client'); $('#titolo-caso').textContent = '';
  $('#cl-torna').hidden = !CL.studio; if (CL.studio) $('#cl-torna-nome').textContent = CL.studio.caso.titolo;
}
function avviaClient() {
  CL.pronto = true;
  CL.finestra = +new URLSearchParams(location.search).get('finestra') || 0;
  document.title = 'Visualizzatore DICOM · radio-quiz';
  window.__rqClient = CL;
  // app installabile: manifest e service worker (solo nella versione client)
  if (!document.querySelector('link[rel="manifest"]')) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = '/client/manifest.json'; document.head.appendChild(l); }
  if ('serviceWorker' in navigator && location.pathname.startsWith('/client/')) navigator.serviceWorker.register('/client/sw.js', { scope: '/client/' }).catch((e) => console.warn('service worker', e));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); CL.installa = e; $('#cl-installa').hidden = false; $('#cl-installa-nota').hidden = true; });
  window.addEventListener('appinstalled', () => { $('#cl-installa').hidden = true; $('#cl-installata').hidden = false; $('#cl-installa-nota').hidden = true; });
  if (matchMedia('(display-mode: standalone)').matches) { $('#cl-installata').hidden = false; $('#cl-installa-nota').hidden = true; }
  $('#cl-installa').onclick = async () => { if (!CL.installa) return; CL.installa.prompt(); await CL.installa.userChoice.catch(() => {}); CL.installa = null; $('#cl-installa').hidden = true; };
  // Safari e Firefox: il visualizzatore funziona, ma installazione e video MP4 sono garantiti solo con Chrome ed Edge
  const chromium = !!navigator.userAgentData?.brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  $('#cl-browser').hidden = chromium && 'VideoEncoder' in window;
  const zona = $('#cl-zona');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('sopra'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('sopra'));
  zona.addEventListener('drop', async (e) => {
    e.preventDefault(); zona.classList.remove('sopra');
    const voci = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const files = []; for (const v of voci) await leggiVoceConPercorso(v, files, '');
    caricaClient(files.length ? files : [...e.dataTransfer.files]);
  });
  $('#cl-cartella').addEventListener('change', (e) => caricaClient([...e.target.files]));
  $('#cl-file').addEventListener('change', (e) => caricaClient([...e.target.files]));
  $('#cl-torna').onclick = () => { location.hash = '#/caso/locale'; };
  $('#cl-apri').onclick = () => { location.hash = '#/'; };
  $('#cl-finestra').onclick = apriFinestraClient;
  $('#cl-paziente').onchange = (e) => { V.datiPaziente = e.target.checked; disegna(); };
  $('#cl-esporta').onclick = () => { aggiornaDialogoEsporta(); $('#dlg-esporta').showModal(); };
  $('#ex-chiudi').onclick = () => $('#dlg-esporta').close();
  $('#dlg-esporta').querySelectorAll('input[name="ex-cosa"]').forEach((r) => r.addEventListener('change', aggiornaDialogoEsporta));
  $('#ex-vai').onclick = () => esportaClient().catch((e) => { console.error(e); $('#ex-stato').textContent = 'Esportazione non riuscita: ' + e.message; $('#ex-vai').disabled = false; });
  try { CL.canale = new BroadcastChannel('rq-client'); CL.canale.onmessage = (e) => clientRicevi(e.data); } catch {}
  window.addEventListener('pagehide', salvaMisureClient);
  setInterval(salvaMisureClient, 10000);
  if (CL.finestra) location.hash = '#/caso/locale';
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
const dataLeggibile = (d) => (/^\d{8}$/.test(d || '') ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : '');
async function caricaClient(files) {
  const st = (t, tipo = '') => { const el = $('#cl-stato'); el.innerHTML = t; el.className = 'stato ' + tipo; };
  $('#cl-scelta').hidden = true;
  files = files.filter((f) => !/(^|\/)\./.test(percorsoDi(f)) && f.size > 0);
  if (!files.length) { st('Nessun file nella selezione.', 'errore'); return; }
  // CD con DICOMDIR: elenco degli studi, si aprono quelli scelti
  const dd = files.find((f) => /(^|\/)DICOMDIR$/i.test(percorsoDi(f)));
  if (dd) {
    try {
      const studi = leggiDicomdir(await dd.arrayBuffer()), base = percorsoDi(dd).replace(/DICOMDIR$/i, '').toUpperCase();
      const mappa = new Map(files.map((f) => [percorsoDi(f).toUpperCase(), f]));
      for (const s of studi) { s.files = s.serie.flatMap((x) => x.file.map((p) => mappa.get(base + p.toUpperCase()))).filter(Boolean); s.n = s.files.length; }
      const validi = studi.filter((s) => s.n);
      if (validi.length > 1) { sceltaStudi(validi); return; }
      if (validi.length === 1) { files = validi[0].files; }
    } catch (e) { console.warn('DICOMDIR non leggibile, leggo tutti i file', e); }
  }
  files = files.filter((f) => !/(^|\/)DICOMDIR$/i.test(percorsoDi(f)));
  const perSerie = new Map(), esclusi = {}, sintassi = new Set(); let fatti = 0, byte = 0, nImm = 0;
  CL.file = [];
  await aGruppi(files, 6, async (f) => {
    // solo l'intestazione (primo MB); il file intero se l'intestazione è più lunga
    let info = analizza(await f.slice(0, 1 << 20).arrayBuffer(), { intestazione: true });
    if (info.escluso === 'non è un file DICOM' && f.size > 1 << 20) info = analizza(await f.arrayBuffer(), { intestazione: true });
    if (info.escluso && /non è un file|senza immagine|big endian|referto strutturato/.test(info.escluso)) { esclusi[info.escluso] = (esclusi[info.escluso] || 0) + 1; }
    else if (NOMI_TS[info.ts] && /video|deflate|12 bit/.test(NOMI_TS[info.ts])) { const m = `${NOMI_TS[info.ts]} (non supportato)`; esclusi[m] = (esclusi[m] || 0) + 1; }
    else {
      sintassi.add(info.ts); byte += f.size;
      const nf = info.nFrames || 1, mf = nf > 1;
      // multi-frame: ogni file è una serie (clip eco, angiografia, tomosintesi, TC/RM «enhanced»)
      const k = (info.serieUID || 'senza-serie') + (info.vistaMG ? '|' + info.vistaMG : '') + (mf ? '|mf|' + percorsoDi(f) : '');
      if (!perSerie.has(k)) perSerie.set(k, { uid: k, numero: info.serieNum, descrizione: info.vistaMG || info.descrizione || `Serie ${info.serieNum}`, modalita: info.modalita, studio: info.studio, dataStudio: info.dataStudio,
        regione: info.regione || '', data: info.data || '', eta: info.eta, suv: info.suv || null, cine_ms: mf && info.frameMs ? info.frameMs : null, voci: [] });
      const ps = perSerie.get(k); if (!ps.suv && info.suv) ps.suv = info.suv;
      const voceFile = { file: f, eco: info.modalita === 'US', mf, escluso: info.escluso };
      CL.file.push(voceFile);
      if (!mf) { ps.voci.push({ file: f, sorgente: f, voceFile, istanza: info.istanza, posizione: info.posizione, ipp: info.ipp, iop: info.iop, tempo: info.tempo }); nImm++; }
      else for (let j = 0; j < nf; j++) { const g = info.frames?.[j] || {}; ps.voci.push({ file: f, sorgente: { file: f, frame: j }, voceFile, istanza: j + 1, posizione: null, ipp: g.ipp || null, iop: g.iop || info.iop, tempo: null }); nImm++; }
    }
    if (++fatti % 20 === 0 || fatti === files.length) st(`Lettura delle intestazioni: ${fatti} / ${files.length}` + barra(fatti / files.length));
  });
  if (!perSerie.size) { st('Nessuna immagine DICOM visualizzabile' + (Object.keys(esclusi).length ? ': ' + Object.entries(esclusi).map(([m, n]) => `${n} ${m}`).join(', ') : '.'), 'errore'); return; }
  // decodificatori delle compressioni presenti, una volta sola (poi funzionano anche senza rete)
  for (const ts of sintassi) if (TS_CODEC[ts]) { st('Preparo il decodificatore ' + ({ jpeg: 'JPEG', j2k: 'JPEG 2000', jls: 'JPEG-LS' }[TS_CODEC[ts]]) + '…'); try { await caricaCodec(TS_CODEC[ts]); } catch (e) { st('Decodificatore non disponibile: ' + e.message, 'errore'); return; } }
  const studi = [...new Map([...perSerie.values()].map((s) => [s.studio, s.dataStudio])).entries()].sort((x, y) => String(x[1]).localeCompare(String(y[1]))).map(([u]) => u);
  if (studi.length > 1) for (const s of perSerie.values()) { const n = studi.indexOf(s.studio) + 1; s.nStudio = n; s.descrizione = `Studio ${n} · ${s.data ? s.data + ' · ' : ''}${s.descrizione}`; }
  const lista = [...perSerie.values()].sort((a, b) => (a.nStudio || 0) - (b.nStudio || 0) || a.numero - b.numero).flatMap(dividiSerie);
  const buf = new Map(), serie = [], cartelle = new Set();
  for (const s of lista) {
    if (s.perPosizione) s.voci.sort((a, b) => a.ordine - b.ordine || a.istanza - b.istanza);
    else s.voci.sort((a, b) => a.istanza - b.istanza || (a.posizione ?? 0) - (b.posizione ?? 0) || a.file.name.localeCompare(b.file.name));
    let c = `${s.nStudio ? `s${s.nStudio}_` : ''}${String(Math.trunc(s.numero)).padStart(4, '0')}${s.piano ? '_' + s.piano.slice(0, 3) : ''}${s.fase ? `_f${String(s.fase).padStart(2, '0')}` : ''}_${slug(s.descrizione)}`;
    while (cartelle.has(c)) c += '_b'; cartelle.add(c);
    // i file restano sul disco: in BUF c'è il riferimento al file (e al fotogramma), letto quando serve
    const fl = s.voci.map((v, i) => { const p = `serie/${c}/img_${String(i).padStart(5, '0')}.dcm`; buf.set(`/casi/locale/${p}`, v.sorgente); if (!v.voceFile.percorso) v.voceFile.percorso = p; return p; });
    serie.push({ descrizione: s.descrizione + (s.piano && lista.filter((x) => x.uid === s.uid).length > 1 ? ` — ${s.piano}` : '') + (s.fase ? ` — fase ${s.fase}` : ''), files: fl,
      suv: s.suv || undefined, regione: s.regione || undefined, data: s.data || undefined, eta: s.eta ?? undefined, cine_ms: s.cine_ms || undefined });
  }
  const mod = new Set(lista.map((s) => s.modalita));
  const metodica = mod.has('CT') ? 'TC' : mod.has('MR') ? 'RM' : mod.has('MG') ? 'Mammografia' : mod.has('US') ? 'Ecografia' : [...mod].some((m) => /^(CR|DX|DR|RF|XA|PX)$/.test(m)) ? 'RX' : mod.has('PT') ? 'TC' : 'Altro';
  const nomeMod = { CT: 'TC', MR: 'RM', CR: 'RX', DX: 'RX', DR: 'RX', MG: 'Mammografia', US: 'Ecografia', PT: 'PET', NM: 'Medicina nucleare', XA: 'Angiografia', RF: 'Fluoroscopia' };
  const titolo = [[...new Set([...mod].map((m) => nomeMod[m] || m))].join(' + '), studi.length > 1 ? `${studi.length} studi` : '', `${serie.length} ${serie.length === 1 ? 'serie' : 'serie'}`, `${nImm} immagini`].filter(Boolean).join(' · ');
  CL.chiave = [...perSerie.values()].map((s) => s.uid).sort().join('|');
  CL.studio = { caso: { id: 'locale', titolo, modalita: metodica, ia: false, opzioni: [], sezioni: [], visibile: true }, serie, buf };
  const nEscl = Object.values(esclusi).reduce((a, b) => a + b, 0), gb = byte / 1e9;
  st(`<b>${nImm} immagini</b> in ${serie.length} serie${gb >= 0.1 ? ` (${virgola(gb, 1)} GB)` : ''}${nEscl ? ` · non visualizzabili: ${Object.entries(esclusi).map(([m, n]) => `${n} ${esc(m)}`).join(', ')}` : ''}.`
    + (gb > 1.5 ? ' <br>Esame grande: le immagini si leggono dal disco quando apri ogni serie; per MPR e 3D scegli serie sotto 1 GB circa.' : ''), 'ok');
  if (location.hash === '#/caso/locale') routerClient('caso'); else location.hash = '#/caso/locale';
}
function sceltaStudi(studi) {
  const box = $('#cl-scelta');
  box.innerHTML = `<h3>Studi sul disco</h3><p class="muted small">Scegli quali aprire (più studi insieme si confrontano come attuale e precedenti).</p>`
    + studi.map((s, i) => `<label class="cl-studio"><input type="checkbox" value="${i}"${i === studi.length - 1 ? ' checked' : ''}> <span><b>${esc(dataLeggibile(s.data) || 'data non indicata')}</b> ${esc(s.descrizione || '')}<br><small class="muted">${esc([...new Set(s.serie.map((x) => x.modalita))].join(', '))} · ${s.serie.length} serie · ${s.n} immagini</small></span></label>`).join('')
    + `<p><button type="button" class="primary" id="cl-scelta-apri">Apri gli studi scelti</button></p>`;
  box.hidden = false; $('#cl-stato').textContent = '';
  $('#cl-scelta-apri').onclick = () => {
    const sc = [...box.querySelectorAll('input:checked')].map((x) => studi[+x.value]);
    if (!sc.length) return;
    box.hidden = true; caricaClient(sc.flatMap((s) => s.files));
  };
}
// ---- misure ritrovate alla riapertura dello stesso esame (salvate solo in questo browser)
function salvaMisureClient() {
  if (!CL.chiave || V.caso?.id !== 'locale' || CL.finestra) return;
  try { const t = JSON.stringify(V.misure || {}); if (t !== CL.ultimeMisure) { localStorage.setItem('rq-misure:' + CL.chiave, t); CL.ultimeMisure = t; } } catch {}
}
function ripristinaMisureClient() {
  if (!CL.chiave || CL.finestra) return;
  try {
    const m = JSON.parse(localStorage.getItem('rq-misure:' + CL.chiave) || 'null');
    if (m && Object.keys(m).length) { V.misure = m; CL.ultimeMisure = JSON.stringify(m); disegna(); aggiornaTabellaMisure(); avvisoBreve('Ritrovate le misure dell\'ultima apertura di questo esame.'); }
  } catch {}
}
// ---- finestre su altri schermi: la nuova finestra prende lo studio dalla principale e si muove con lei
async function apriFinestraClient() {
  // la finestra si apre subito (il clic vale come gesto dell'utente), poi si porta sull'altro schermo se il browser lo consente
  const n = ++CL.nFin + 1;
  const w = window.open(`/client/index.html?finestra=${n}#/caso/locale`, `rq-finestra-${n}`, 'width=1280,height=860');
  if (!w) { avvisoBreve('Il browser ha bloccato la nuova finestra: consenti i popup per questo sito.'); return; }
  let spostata = false;
  try {
    if ('getScreenDetails' in window) {
      const d = await Promise.race([window.getScreenDetails(), pausa(8000).then(() => null)]);
      const altri = d ? d.screens.filter((x) => x !== d.currentScreen) : [];
      if (altri.length) { const s = altri[(n - 2) % altri.length]; w.moveTo(s.availLeft, s.availTop); w.resizeTo(s.availWidth, s.availHeight); spostata = true; }
    }
  } catch (e) { console.warn('schermi', e); }
  avvisoBreve(spostata ? 'Nuova finestra aperta sull\'altro schermo: premi ⛶ (schermo intero) in quella finestra.' : 'Nuova finestra aperta: trascinala sull\'altro schermo e premi ⛶ (schermo intero).');
}
// posizione, finestra (W/L) e zoom del riquadro attivo vanno alle altre finestre, sui riquadri dello stesso esame e piano
const collegate = () => !!CL.canale && (!$('#cl-sincro') || $('#cl-sincro').checked);
function centroImg(im) { return [0, 1, 2].map((i) => im.ipp[i] + im.iop[i] * im.spCol * (im.cols - 1) / 2 + im.iop[3 + i] * im.spRow * (im.rows - 1) / 2); }
function clientInvia(p) {
  if (!collegate() || !p.img?.ipp || !p.img.iop) return;
  CL.canale.postMessage({ tipo: 'posizione', for: p.img.for || '', centro: centroImg(p.img), iop: p.img.iop });
}
function clientInviaVista() {
  if (!CLIENT || !collegate() || V.caso?.id !== 'locale') return;
  const p = P(); if (!p.img) return;
  const s = [Math.round(p.wc), Math.round(p.ww), p.zoom.toFixed(3), Math.round(p.panX), Math.round(p.panY)].join('|');
  if (s === CL.ultimaVista) return;
  CL.ultimaVista = s;
  CL.canale.postMessage({ tipo: 'vista', for: p.img.for || '', iop: p.img.iop || null, fam: famigliaFinestra(p.img), wc: p.wc, ww: p.ww, zoom: p.zoom, panX: p.panX, panY: p.panY });
}
async function clientRicevi(m) {
  if (!V.caso || V.caso.id !== 'locale' || !collegate()) return;
  if (m?.tipo === 'vista') {
    for (const [b] of visibili()) {
      if (!b.img || (b.img.for || '') !== m.for || famigliaFinestra(b.img) !== m.fam) continue;
      b.wc = m.wc; b.ww = m.ww;
      if (m.iop && b.img.iop && stessaOrientazione(m.iop, b.img.iop, 0.05)) { b.zoom = m.zoom; b.panX = m.panX; b.panY = m.panY; }
    }
    const p = P(); if (p.img) CL.ultimaVista = [Math.round(p.wc), Math.round(p.ww), p.zoom.toFixed(3), Math.round(p.panX), Math.round(p.panY)].join('|');
    disegna(); return;
  }
  if (m?.tipo !== 'posizione') return;
  const nm = normaleDi(m.iop);
  for (const [b, j] of visibili()) {
    if (!b.img?.iop || (b.img.for || '') !== m.for) continue;
    const nb = normaleDi(b.img.iop); if (Math.abs(nm[0] * nb[0] + nm[1] * nb[1] + nm[2] * nb[2]) < 0.8) continue;
    const t = await fettaVicina(b.frames, m.centro, null).catch(() => null);
    if (t && t.scarto <= Math.max(5, 1.5 * (t.spessore || 0)) && t.i !== b.idx) await mostraDi(j, t.i, { sincro: false });
  }
}
// ---- dati del paziente sull'immagine (solo nel client, spenti di serie, mai nelle esportazioni)
function righePaziente(img) {
  const d = img?.paziente; if (!d) return [];
  return [d.nome, [d.nascita ? 'nato/a ' + dataLeggibile(d.nascita) : '', d.sesso].filter(Boolean).join(' · '), [d.esame ? 'esame ' + dataLeggibile(d.esame) : '', d.studio].filter(Boolean).join(' · '), d.struttura].filter(Boolean);
}
// ---- esportazione: immagine visibile (PNG), serie in PNG (.zip), serie in video MP4, misure (testo), esame anonimizzato (DICOM .zip)
function aggiornaDialogoEsporta() {
  const cosa = $('#dlg-esporta').querySelector('input[name="ex-cosa"]:checked')?.value || 'png';
  $('#ex-video').hidden = cosa !== 'mp4';
  $('#ex-scritte-riga').hidden = !['png', 'zip', 'mp4'].includes(cosa);
  $('#ex-testo-riga').hidden = cosa !== 'dicom';
  $('#ex-serie-riga').hidden = !(cosa === 'zip' || cosa === 'mp4');
  const p = P(), n = p.frames.length;
  $('#ex-da').max = $('#ex-a').max = String(n); if (!+$('#ex-a').value || +$('#ex-a').value > n) { $('#ex-da').value = '1'; $('#ex-a').value = String(n); }
  const nMis = Object.values(V.misure || {}).reduce((t, l) => t + l.filter((m) => !m.copia).length, 0);
  $('#ex-info').textContent = cosa === 'dicom'
    ? `Tutti i ${CL.file?.length || 0} file dell'esame, riscritti senza dati del paziente né della struttura (stessa lista bianca dei casi del sito). Il testo impresso nelle immagini viene cercato e coperto; schermate, clip ecografiche multi-frame e immagini con testo non trovato non vengono esportate.`
    : cosa === 'misure' ? `${nMis} ${nMis === 1 ? 'misura' : 'misure'} di questo esame, in un file di testo (immagine, serie e valore).`
    : `Riquadro attivo: ${nomeSerie(V.serie[p.sIdx] || {})}${p.piano ? ` (${p.piano})` : ''}, ${n} immagini, con la finestra e lo zoom attuali. I dati del paziente non compaiono mai.`;
  $('#ex-stato').textContent = cosa === 'mp4' && !('VideoEncoder' in window) ? 'Questo browser non sa creare video MP4: usa Chrome o Edge.' : '';
}
function scarica(blob, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
// copia del riquadro come si vede sullo schermo (risoluzione dello schermo), dimensioni pari per il video; mai i dati del paziente
function catturaRiquadro(k, conScritte, out) {
  V.senzaScritte = !conScritte; V.esportando = true; disegna(); V.senzaScritte = false; V.esportando = false;
  const dpr = window.devicePixelRatio || 1, R = rettangolo(k);
  const sx = Math.round(R.x * dpr), sy = Math.round(R.y * dpr), sw = Math.round(R.w * dpr), sh = Math.round(R.h * dpr);
  const f = Math.min(1, 1920 / sw, 1920 / sh), w = Math.max(2, Math.floor(sw * f / 2) * 2), h = Math.max(2, Math.floor(sh * f / 2) * 2);
  out ||= document.createElement('canvas');
  if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
  const c = out.getContext('2d', { willReadFrequently: true }); c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.drawImage(canvas, sx, sy, sw, sh, 0, 0, w, h);
  return out;
}
const aBlob = (cv, tipo = 'image/png') => new Promise((ok) => cv.toBlob(ok, tipo));
async function testoMisureClient() {
  const righe = [`Misure — ${CL.studio?.caso.titolo || 'esame'} — ${new Date().toLocaleString('it-IT')}`, 'Strumento didattico, non per uso medico.', ''];
  const chiavi = Object.keys(V.misure || {}).sort((a, b) => { const [x, y] = [a, b].map((k) => k.split(':').map((v, i) => (i < 2 ? +v : v))); return x[0] - y[0] || x[1] - y[1]; });
  for (const key of chiavi) {
    const [si, idx, piano] = key.split(':'), lista = (V.misure[key] || []).filter((m) => !m.copia), s = V.serie[+si];
    if (!lista.length || !s) continue;
    let img = null;
    try {
      if (piano) { const vol = await volumeDi(+si); const G = assiPiano(vol, piano); if (+idx < G.len[G.a]) img = fettaPiano(vol, piano, +idx); }
      else img = await immagineDi(await pannelloDi(+si), +idx);
    } catch {}
    const frasi = img ? lista.map((m) => fraseMisura(m, img, +idx, +si)).filter(Boolean) : [];
    if (frasi.length) righe.push(`${nomeSerie(s)}${piano ? ` (${piano} ricostruita)` : ''}, immagine ${+idx + 1}:`, ...frasi.map((f) => '  - ' + f), '');
  }
  if (righe.length <= 3) righe.push('Nessuna misura.');
  return righe.join('\n');
}
async function esportaClient() {
  const cosa = $('#dlg-esporta').querySelector('input[name="ex-cosa"]:checked')?.value || 'png';
  const st = (t) => { $('#ex-stato').innerHTML = t; };
  const conScritte = $('#ex-scritte').checked, k = V.attivo, p = P(k), base = slug(CL.studio?.caso.titolo || 'esame');
  $('#ex-vai').disabled = true; stopCine();
  if (cosa === 'png') {
    scarica(await aBlob(catturaRiquadro(k, conScritte)), `${base}_img${p.idx + 1}.png`); disegna(); st('Immagine salvata.');
  } else if (cosa === 'misure') {
    st('Preparo il testo…'); const t = await testoMisureClient();
    scarica(new Blob([t], { type: 'text/plain;charset=utf-8' }), `${base}_misure.txt`); st('Misure salvate in un file di testo.');
  } else if (cosa === 'zip' || cosa === 'mp4') {
    const n = p.frames.length, da = Math.max(1, Math.min(n, +$('#ex-da').value || 1)) - 1, a = Math.max(da + 1, Math.min(n, +$('#ex-a').value || n)) - 1, idx0 = p.idx;
    const totale = a - da + 1, cv = document.createElement('canvas');
    if (cosa === 'zip') {
      const voci = [];
      for (let i = da; i <= a; i++) {
        await mostraDi(k, i, { sincro: false });
        voci.push({ nome: `${base}/img_${String(i + 1).padStart(4, '0')}.png`, dati: new Uint8Array(await (await aBlob(catturaRiquadro(k, conScritte, cv))).arrayBuffer()) });
        if ((i - da) % 5 === 0) st(`Immagini: ${i - da + 1} / ${totale}` + barra((i - da + 1) / totale));
      }
      scarica(creaZip(voci), `${base}_serie.zip`); st(`Salvate ${totale} immagini PNG.`);
    } else {
      if (!('VideoEncoder' in window)) throw new Error('questo browser non sa creare video MP4: usa Chrome o Edge aggiornati');
      const fps = Math.max(1, Math.min(60, +$('#ex-fps').value || 10));
      await mostraDi(k, da, { sincro: false }); catturaRiquadro(k, conScritte, cv);
      const W = cv.width, H = cv.height;
      // prima il codificatore software (stesso risultato su ogni computer; quello della scheda grafica a volte dà fotogrammi neri)
      let codec = null, hw = 'prefer-software';
      cerca: for (const h of ['prefer-software', 'no-preference']) for (const c of ['avc1.640034', 'avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42001f']) {
        try { if ((await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 8e6, framerate: fps, hardwareAcceleration: h })).supported) { codec = c; hw = h; break cerca; } } catch {}
      }
      if (!codec) throw new Error(`il codificatore H.264 del browser non accetta ${W}×${H}: riduci la finestra e riprova`);
      const { Muxer, ArrayBufferTarget } = await import('./lib/mp4-muxer.js');
      const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: fps }, fastStart: 'in-memory' });
      let errore = null;
      const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { errore = e; } });
      enc.configure({ codec, width: W, height: H, bitrate: Math.min(20e6, Math.max(2e6, W * H * fps * 0.15)), framerate: fps, hardwareAcceleration: hw });
      for (let i = da; i <= a; i++) {
        if (errore) throw errore;
        await mostraDi(k, i, { sincro: false }); catturaRiquadro(k, conScritte, cv);
        // fotogramma dai pixel (copia in memoria): con la tela passata direttamente alcune schede grafiche danno fotogrammi neri
        const t = i - da, px = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
        const vf = new VideoFrame(px, { format: 'RGBA', codedWidth: W, codedHeight: H, timestamp: Math.round(t * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(vf, { keyFrame: t % (fps * 2) === 0 }); vf.close();
        while (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
        if (t % 5 === 0) st(`Video: ${t + 1} / ${totale} immagini` + barra((t + 1) / totale));
      }
      await enc.flush(); enc.close(); if (errore) throw errore; muxer.finalize();
      scarica(new Blob([muxer.target.buffer], { type: 'video/mp4' }), `${base}_${fps}fps.mp4`);
      st(`Video MP4 salvato: ${totale} immagini a ${fps} al secondo (${virgola(totale / fps, 1)} s), ${W}×${H}.`);
    }
    await mostraDi(k, idx0, { sincro: false }); disegna();
  } else if (cosa === 'dicom') {
    const copri = $('#ex-copri').checked;
    const sale = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    const tutti = CL.file || [], voci = [], scartate = {}, conta = (m) => { scartate[m] = (scartate[m] || 0) + 1; };
    let fatti = 0, coperte = 0;
    // parole da non trovare nel file anonimo: nomi, ID, struttura di tutti i file (prima passata, solo intestazioni)
    const vietate = new Set();
    for (const v of tutti) { try { paroleVietate(await v.file.slice(0, 1 << 20).arrayBuffer()).forEach((x) => vietate.add(x)); } catch {} }
    const decod = (b) => decodificaDicom(b, { grezzo: true });
    await aGruppi(tutti, 3, async (v) => {
      try {
        const buf = await v.file.arrayBuffer(), info = analizza(buf);
        await assicuraCodec(buf);
        const testoDichiarato = info.escluso === 'testo impresso nell\'immagine';
        if (info.escluso && !testoDichiarato && !/multi-frame \(non ancora/.test(info.escluso)) { conta(info.escluso); return; }
        let out = await anonimizza(buf, { idCaso: 'ANONIMO', sale });
        // testo impresso (RX, mammografia, immagini con BurnedInAnnotation): si cerca e si coprono le zone nei pixel
        if (!v.mf && !info.eco && copri && (testoDichiarato || /^(CR|DX|DR|MG|RF|XA|PX|OT)$/.test(info.modalita))) {
          const zone = testoImpresso(decod(out.buffer));
          if (zone.length) { out = await anonimizza(buf, { idCaso: 'ANONIMO', sale, oscura: zone, decodifica: decod }); coperte++; }
          else if (testoDichiarato) { conta('testo impresso dichiarato ma non trovato'); return; }
        } else if (testoDichiarato) { conta('testo impresso nell\'immagine'); return; }
        const problema = verifica(out, vietate);
        if (problema) { conta('controllo non superato: ' + problema); return; }
        voci.push({ nome: `${base}_anonimo/${v.percorso || 'img_' + (fatti + 1) + '.dcm'}`, dati: out });
      } catch (e) { conta('errore: ' + e.message); }
      finally { if (++fatti % 5 === 0) st(`Anonimizzazione: ${fatti} / ${tutti.length}` + barra(fatti / tutti.length)); }
    });
    if (!voci.length) throw new Error('nessuna immagine anonimizzabile' + (Object.keys(scartate).length ? ': ' + Object.entries(scartate).map(([m, n]) => `${n} ${m}`).join(', ') : ''));
    voci.sort((x, y) => x.nome.localeCompare(y.nome));
    if (voci.reduce((t, v) => t + v.dati.length, 0) > 4e9) throw new Error('esame troppo grande per un solo .zip (oltre 4 GB)');
    scarica(creaZip(voci), `${base}_anonimo.zip`);
    st(`Esportati ${voci.length} file anonimizzati${coperte ? `, in ${coperte} il testo impresso è stato coperto (controlla le immagini)` : ''}.` + (Object.keys(scartate).length ? ` Non esportati: ${Object.entries(scartate).map(([m, n]) => `${n} ${esc(m)}`).join(', ')}.` : ''));
  }
  $('#ex-vai').disabled = false;
}
