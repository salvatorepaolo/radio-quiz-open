
// ================================================================ VERSIONE CLIENT (visualizzatore offline)
// /client/index.html: lo stesso visualizzatore del sito, da installare come app del browser. Apre cartelle o file
// DICOM dal disco di questo computer; i file non lasciano mai il computer (niente accesso, niente server). Dopo la
// prima apertura funziona anche senza rete (client/sw.js). In più: anonimizzazione, esportazione di immagini (PNG)
// e video (MP4, immagini al secondo a scelta), altre finestre sincronizzate da portare su altri schermi.
async function routerClient(tipo) {
  await Promise.resolve();                                       // dopo il caricamento del modulo
  if (!CL.pronto) avviaClient();
  if (tipo === 'caso' && !CL.studio) {
    // finestra aperta da «Nuova finestra»: lo studio è quello della finestra principale (stessa origine, niente copie)
    try { const o = window.opener?.__rqClient; if (o?.studio) { CL.studio = o.studio; CL.voci = o.voci; } } catch {}
  }
  if (tipo === 'caso' && CL.studio) {
    document.body.classList.add('client-caso');
    $('#grp-client').hidden = false;
    await apriCaso('locale', CL.studio);
    $('#titolo-caso').textContent = CL.studio.caso.titolo + (CL.finestra ? ` · finestra ${CL.finestra}` : '');
    if (CL.finestra && V.serie.length > 1) {      // le finestre aggiunte propongono un'altra serie
      const si = Math.min(V.serie.length - 1, CL.finestra - 1); if (si !== V.sIdx) await selezionaSerie(si, 0);
    }
    return;
  }
  document.body.classList.remove('client-caso');
  vista('client'); $('#titolo-caso').textContent = '';
}
function avviaClient() {
  CL.pronto = true;
  CL.finestra = +new URLSearchParams(location.search).get('finestra') || 0;
  document.title = 'Visualizzatore DICOM · radio-quiz';
  window.__rqClient = CL;
  // app installabile: manifest e service worker (solo nella versione client)
  if (!document.querySelector('link[rel="manifest"]')) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = '/client/manifest.webmanifest'; document.head.appendChild(l); }
  if ('serviceWorker' in navigator && location.pathname.startsWith('/client/')) navigator.serviceWorker.register('/client/sw.js', { scope: '/client/' }).catch((e) => console.warn('service worker', e));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); CL.installa = e; $('#cl-installa').hidden = false; });
  window.addEventListener('appinstalled', () => { $('#cl-installa').hidden = true; $('#cl-installata').hidden = false; });
  if (matchMedia('(display-mode: standalone)').matches) $('#cl-installata').hidden = false;
  $('#cl-installa').onclick = async () => { if (!CL.installa) return; CL.installa.prompt(); await CL.installa.userChoice.catch(() => {}); CL.installa = null; $('#cl-installa').hidden = true; };
  const zona = $('#cl-zona');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('sopra'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('sopra'));
  zona.addEventListener('drop', async (e) => {
    e.preventDefault(); zona.classList.remove('sopra');
    const voci = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const files = []; for (const v of voci) await leggiVoce(v, files);
    caricaClient(files.length ? files : [...e.dataTransfer.files]);
  });
  $('#cl-cartella').addEventListener('change', (e) => caricaClient([...e.target.files]));
  $('#cl-file').addEventListener('change', (e) => caricaClient([...e.target.files]));
  $('#cl-apri').onclick = () => { location.hash = '#/'; };
  $('#cl-finestra').onclick = apriFinestraClient;
  $('#cl-esporta').onclick = () => { aggiornaDialogoEsporta(); $('#dlg-esporta').showModal(); };
  $('#ex-chiudi').onclick = () => $('#dlg-esporta').close();
  $('#dlg-esporta').querySelectorAll('input[name="ex-cosa"]').forEach((r) => r.addEventListener('change', aggiornaDialogoEsporta));
  $('#ex-vai').onclick = () => esportaClient().catch((e) => { console.error(e); $('#ex-stato').textContent = 'Esportazione non riuscita: ' + e.message; $('#ex-vai').disabled = false; });
  try { CL.canale = new BroadcastChannel('rq-client'); CL.canale.onmessage = (e) => clientRicevi(e.data); } catch {}
  if (CL.finestra) location.hash = '#/caso/locale';
}
// ---- apertura dei file: serie e studi come nel caricamento dei casi, ma tutto resta in memoria in questa pagina
const CL_NON_VISIBILI = /non è un file|senza immagine|big endian|multi-frame|filmato|referto strutturato/;
async function caricaClient(files) {
  const st = (t, tipo = '') => { const el = $('#cl-stato'); el.innerHTML = t; el.className = 'stato ' + tipo; };
  files = files.filter((f) => !/(^|\/)\.|DICOMDIR$/i.test(f.webkitRelativePath || f.name) && f.size < 600e6);
  if (!files.length) { st('Nessun file nella selezione.', 'errore'); return; }
  const perSerie = new Map(), esclusi = {}, voci = []; let fatti = 0;
  await aGruppi(files, 6, async (f) => {
    const buf = await f.arrayBuffer(), info = analizza(buf);
    if (info.escluso && CL_NON_VISIBILI.test(info.escluso)) { esclusi[info.escluso] = (esclusi[info.escluso] || 0) + 1; }
    else {
      const k = (info.serieUID || 'senza-serie') + (info.vistaMG ? '|' + info.vistaMG : '');
      if (!perSerie.has(k)) perSerie.set(k, { uid: k, numero: info.serieNum, descrizione: info.vistaMG || info.descrizione || `Serie ${info.serieNum}`, modalita: info.modalita, studio: info.studio, dataStudio: info.dataStudio,
        regione: info.regione || '', data: info.data || '', eta: info.eta, suv: info.suv || null, voci: [] });
      const ps = perSerie.get(k); if (!ps.suv && info.suv) ps.suv = info.suv;
      const v = { file: f, buf, istanza: info.istanza, posizione: info.posizione, ipp: info.ipp, iop: info.iop, tempo: info.tempo, escluso: info.escluso };
      ps.voci.push(v); voci.push(v);
    }
    if (++fatti % 20 === 0 || fatti === files.length) st(`Lettura dei file: ${fatti} / ${files.length}` + barra(fatti / files.length));
  });
  if (!perSerie.size) { st('Nessuna immagine DICOM visualizzabile' + (Object.keys(esclusi).length ? ': ' + Object.entries(esclusi).map(([m, n]) => `${n} ${m}`).join(', ') : '.'), 'errore'); return; }
  const studi = [...new Map([...perSerie.values()].map((s) => [s.studio, s.dataStudio])).entries()].sort((x, y) => String(x[1]).localeCompare(String(y[1]))).map(([u]) => u);
  if (studi.length > 1) for (const s of perSerie.values()) { const n = studi.indexOf(s.studio) + 1; s.nStudio = n; s.descrizione = `Studio ${n} · ${s.data ? s.data + ' · ' : ''}${s.descrizione}`; }
  const lista = [...perSerie.values()].sort((a, b) => (a.nStudio || 0) - (b.nStudio || 0) || a.numero - b.numero).flatMap(dividiSerie);
  const buf = new Map(), serie = [], cartelle = new Set();
  for (const s of lista) {
    if (s.perPosizione) s.voci.sort((a, b) => a.ordine - b.ordine || a.istanza - b.istanza);
    else s.voci.sort((a, b) => a.istanza - b.istanza || (a.posizione ?? 0) - (b.posizione ?? 0) || a.file.name.localeCompare(b.file.name));
    let c = `${s.nStudio ? `s${s.nStudio}_` : ''}${String(Math.trunc(s.numero)).padStart(4, '0')}${s.piano ? '_' + s.piano.slice(0, 3) : ''}${s.fase ? `_f${String(s.fase).padStart(2, '0')}` : ''}_${slug(s.descrizione)}`;
    while (cartelle.has(c)) c += '_b'; cartelle.add(c);
    const fl = s.voci.map((v, i) => { const p = `serie/${c}/img_${String(i).padStart(5, '0')}.dcm`; buf.set(`/casi/locale/${p}`, v.buf); v.percorso = p; return p; });
    serie.push({ descrizione: s.descrizione + (s.piano && lista.filter((x) => x.uid === s.uid).length > 1 ? ` — ${s.piano}` : '') + (s.fase ? ` — fase ${s.fase}` : ''), files: fl, suv: s.suv || undefined, regione: s.regione || undefined, data: s.data || undefined, eta: s.eta ?? undefined });
  }
  const mod = new Set(lista.map((s) => s.modalita));
  const metodica = mod.has('CT') ? 'TC' : mod.has('MR') ? 'RM' : mod.has('MG') ? 'Mammografia' : mod.has('US') ? 'Ecografia' : [...mod].some((m) => /^(CR|DX|DR|RF|XA|PX)$/.test(m)) ? 'RX' : mod.has('PT') ? 'TC' : 'Altro';
  const nome = (files[0].webkitRelativePath || '').split('/')[0] || (files.length === 1 ? files[0].name : `${files.length} file`);
  CL.voci = voci;
  CL.studio = { caso: { id: 'locale', titolo: nome, modalita: metodica, ia: false, opzioni: [], sezioni: [], visibile: true }, serie, buf };
  const nEscl = Object.values(esclusi).reduce((a, b) => a + b, 0);
  st(`<b>${voci.length} immagini</b> in ${serie.length} serie${nEscl ? ` · non visualizzabili: ${Object.entries(esclusi).map(([m, n]) => `${n} ${m}`).join(', ')}` : ''}.`, 'ok');
  if (location.hash === '#/caso/locale') routerClient('caso'); else location.hash = '#/caso/locale';
}
// ---- finestre su altri schermi: la nuova finestra prende lo studio dalla principale e si muove con lei
async function apriFinestraClient() {
  let pos = 'width=1280,height=860';
  try {
    if ('getScreenDetails' in window) {
      const d = await window.getScreenDetails(), cur = d.currentScreen;
      const altri = d.screens.filter((s) => s !== cur), s = altri[CL.nFin % Math.max(1, altri.length)] || cur;
      pos = `left=${s.availLeft},top=${s.availTop},width=${s.availWidth},height=${s.availHeight}`;
    }
  } catch (e) { console.warn('schermi', e); }
  const n = ++CL.nFin + 1;
  const w = window.open(`/client/index.html?finestra=${n}#/caso/locale`, `rq-finestra-${n}`, pos);
  if (!w) { avvisoBreve('Il browser ha bloccato la nuova finestra: consenti i popup per questo sito.'); return; }
  avvisoBreve(pos.startsWith('left') ? 'Nuova finestra aperta sull\'altro schermo: premi ⛶ (schermo intero) in quella finestra.' : 'Nuova finestra aperta: trascinala sull\'altro schermo e premi ⛶ (schermo intero).');
}
function clientInvia(p) {
  if (!CL.canale || !p.img?.ipp || !p.img.iop || $('#cl-sincro') && !$('#cl-sincro').checked) return;
  const im = p.img, c = [0, 1, 2].map((i) => im.ipp[i] + im.iop[i] * im.spCol * (im.cols - 1) / 2 + im.iop[3 + i] * im.spRow * (im.rows - 1) / 2);
  CL.canale.postMessage({ tipo: 'posizione', studio: CL.studio?.serie?.length, for: im.for || '', centro: c, iop: im.iop, da: CL.finestra });
}
async function clientRicevi(m) {
  if (m?.tipo !== 'posizione' || !V.caso || V.caso.id !== 'locale' || ($('#cl-sincro') && !$('#cl-sincro').checked)) return;
  const nm = normaleDi(m.iop);
  for (const [b, j] of visibili()) {
    if (!b.img?.iop || (b.img.for || '') !== m.for) continue;
    const nb = normaleDi(b.img.iop); if (Math.abs(nm[0] * nb[0] + nm[1] * nb[1] + nm[2] * nb[2]) < 0.8) continue;
    const t = await fettaVicina(b.frames, m.centro, null).catch(() => null);
    if (t && t.scarto <= Math.max(5, 1.5 * (t.spessore || 0)) && t.i !== b.idx) await mostraDi(j, t.i, { sincro: false });
  }
}
// ---- esportazione: immagine visibile (PNG), serie in PNG (.zip), serie in video MP4, esame anonimizzato (DICOM .zip)
function aggiornaDialogoEsporta() {
  const cosa = $('#dlg-esporta').querySelector('input[name="ex-cosa"]:checked')?.value || 'png';
  $('#ex-video').hidden = cosa !== 'mp4';
  $('#ex-scritte-riga').hidden = cosa === 'dicom';
  $('#ex-serie-riga').hidden = !(cosa === 'zip' || cosa === 'mp4');
  const p = P(), n = p.frames.length;
  $('#ex-da').max = $('#ex-a').max = String(n); if (!+$('#ex-a').value || +$('#ex-a').value > n) { $('#ex-da').value = '1'; $('#ex-a').value = String(n); }
  $('#ex-info').textContent = cosa === 'dicom'
    ? `Tutte le ${CL.voci.length} immagini dell'esame, riscritte senza dati del paziente né della struttura (stessa lista bianca dei casi del sito). Le immagini con testo impresso (alcune RX ed ecografie, schermate) non vengono esportate.`
    : `Riquadro attivo: ${nomeSerie(V.serie[p.sIdx] || {})}${p.piano ? ` (${p.piano})` : ''}, ${n} immagini, con la finestra e lo zoom attuali.`;
  $('#ex-stato').textContent = '';
}
function scarica(blob, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
// copia del riquadro come si vede sullo schermo (risoluzione dello schermo), dimensioni pari per il video
function catturaRiquadro(k, conScritte, out) {
  V.senzaScritte = !conScritte; disegna(); V.senzaScritte = false;
  const dpr = window.devicePixelRatio || 1, R = rettangolo(k);
  const sx = Math.round(R.x * dpr), sy = Math.round(R.y * dpr), sw = Math.round(R.w * dpr), sh = Math.round(R.h * dpr);
  const f = Math.min(1, 1920 / sw, 1920 / sh), w = Math.max(2, Math.floor(sw * f / 2) * 2), h = Math.max(2, Math.floor(sh * f / 2) * 2);
  out ||= document.createElement('canvas');
  if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
  const c = out.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.drawImage(canvas, sx, sy, sw, sh, 0, 0, w, h);
  return out;
}
const aBlob = (cv, tipo = 'image/png') => new Promise((ok) => cv.toBlob(ok, tipo));
async function esportaClient() {
  const cosa = $('#dlg-esporta').querySelector('input[name="ex-cosa"]:checked')?.value || 'png';
  const st = (t) => { $('#ex-stato').innerHTML = t; };
  const conScritte = $('#ex-scritte').checked, k = V.attivo, p = P(k), base = slug(CL.studio?.caso.titolo || 'esame');
  $('#ex-vai').disabled = true; stopCine();
  if (cosa === 'png') {
    scarica(await aBlob(catturaRiquadro(k, conScritte)), `${base}_img${p.idx + 1}.png`); disegna(); st('Immagine salvata.');
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
      let codec = null;
      for (const c of ['avc1.640034', 'avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42001f']) {
        try { if ((await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 8e6, framerate: fps })).supported) { codec = c; break; } } catch {}
      }
      if (!codec) throw new Error(`il codificatore H.264 del browser non accetta ${W}×${H}: riduci la finestra e riprova`);
      const { Muxer, ArrayBufferTarget } = await import('./lib/mp4-muxer.mjs');
      const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: fps }, fastStart: 'in-memory' });
      let errore = null;
      const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { errore = e; } });
      enc.configure({ codec, width: W, height: H, bitrate: Math.min(20e6, W * H * fps * 0.15), framerate: fps });
      for (let i = da; i <= a; i++) {
        if (errore) throw errore;
        await mostraDi(k, i, { sincro: false }); catturaRiquadro(k, conScritte, cv);
        const t = i - da, vf = new VideoFrame(cv, { timestamp: Math.round(t * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(vf, { keyFrame: t % (fps * 2) === 0 }); vf.close();
        while (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
        if (t % 5 === 0) st(`Video: ${t + 1} / ${totale} immagini` + barra((t + 1) / totale));
      }
      await enc.flush(); enc.close(); if (errore) throw errore; muxer.finalize();
      scarica(new Blob([muxer.target.buffer], { type: 'video/mp4' }), `${base}_${fps}fps.mp4`);
      st(`Video MP4 salvato: ${totale} immagini a ${fps} al secondo (${(totale / fps).toFixed(1).replace('.', ',')} s), ${W}×${H}.`);
    }
    await mostraDi(k, idx0, { sincro: false }); disegna();
  } else if (cosa === 'dicom') {
    const sale = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    const vietate = new Set(); for (const v of CL.voci) { try { paroleVietate(v.buf).forEach((x) => vietate.add(x)); } catch {} }
    const voci = [], scartate = {}; let fatti = 0;
    await aGruppi(CL.voci, 4, async (v) => {
      const info = analizza(v.buf);
      if (info.escluso) scartate[info.escluso] = (scartate[info.escluso] || 0) + 1;
      else {
        const out = await anonimizza(v.buf, { idCaso: 'ANONIMO', sale });
        const problema = verifica(out, vietate);
        if (problema) scartate['controllo non superato: ' + problema] = (scartate['controllo non superato: ' + problema] || 0) + 1;
        else voci.push({ nome: `${base}_anonimo/${v.percorso}`, dati: out });
      }
      if (++fatti % 10 === 0) st(`Anonimizzazione: ${fatti} / ${CL.voci.length}` + barra(fatti / CL.voci.length));
    });
    if (!voci.length) throw new Error('nessuna immagine anonimizzabile' + (Object.keys(scartate).length ? ': ' + Object.entries(scartate).map(([m, n]) => `${n} ${m}`).join(', ') : ''));
    voci.sort((x, y) => x.nome.localeCompare(y.nome));
    if (voci.reduce((t, v) => t + v.dati.length, 0) > 4e9) throw new Error('esame troppo grande per un solo .zip (oltre 4 GB)');
    scarica(creaZip(voci), `${base}_anonimo.zip`);
    st(`Esportate ${voci.length} immagini anonimizzate.` + (Object.keys(scartate).length ? ` Non esportate: ${Object.entries(scartate).map(([m, n]) => `${n} ${esc(m)}`).join(', ')}.` : ''));
  }
  $('#ex-vai').disabled = false;
}
