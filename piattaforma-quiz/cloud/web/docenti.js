// Docenti e autori: nuovo caso, analisi, classi e compiti, revisione delle bozze, percorsi didattici, gestione dei casi
// Estratto da app.js nella 1.272 (strumenti_claude/divisione/dividi.mjs) senza modifiche al contenuto, salvo i nomi di
// app.js letti come A.nome (ponte PONTE_DOC) e le istruzioni che app.js eseguiva al caricamento, ora in avvio().
// Si carica solo quando serve (app.js, caricaDocenti): chi non lo usa non lo scarica. Niente import './app.js'.
let A = null;
export const collega = (p) => { A = p; };
export const NOMI_APP = ["$", "ADMIN", "AN", "AUTORE", "AZIENDA", "ELENCO", "ESAME_MIN", "ESAME_N", "LIVELLI_ESAME", "NonAutorizzato", "PERCORSI", "PERCORSI_DOC", "PERCORSI_FISSI", "PERCORSI_FISSI_TUTTI", "RE_STUDIO", "aGruppi", "barra", "caricaPercorsi", "caricaScale", "decodificaDicom", "disegnaAnteprima", "disegnaMensile", "esc", "getJSON", "htmlChecklistDoc", "htmlChiaviDoc", "impostazioniIA", "istanteDicom", "metodicaDi", "modAnalisi", "modAnon", "normal", "pausa", "postJSON", "qs1", "qsAll", "scriviSessione", "slug", "testoEta", "testoImpresso"];

// ---------------------------------------------------------------- nuovo caso (docenti)
// Il file originale viene letto e anonimizzato nel browser; si invia solo la copia anonima.
let NC;   // valore in avvio()
function stato(html, tipo = '') { const el = A.$('#nc-stato'); el.hidden = false; el.className = 'stato ' + tipo; el.innerHTML = html; }
async function apriNuovo({ aggiungi = null, proposta = false } = {}) {
  if (NC.occupato) return;
  NC.file = []; NC.serie = []; NC.vietate = new Set(); NC.aggiungiA = aggiungi; NC.proposta = proposta;
  A.$('#nc-proposta').hidden = !proposta; A.$('#nc-id-riga').hidden = proposta; A.$('#nc-intro-proposta').hidden = !proposta;
  A.$('#nc-vetrino').hidden = !aggiungi || proposta; A.$('#nc-vt-esame').hidden = true; A.$('#nc-vt-file').value = ''; NC.vt = null;
  if (proposta) {
    A.$('#nc-testa').textContent = 'Proponi un caso';
    A.$('#nc-id').value = 'prop-' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
    NC.sale = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    A.$('#nc-stato').hidden = true; A.$('#nc-serie').hidden = true; A.$('#nc-titolo').value = ''; A.$('#nc-titolo-riga').hidden = false; A.$('#nc-id').disabled = true;
    for (const k of ['quesito', 'anamnesi', 'descrizione']) A.$('#nc-p-' + k).value = '';
    A.$('#nc-p-dich').checked = false;
    disegnaMieProposte();
    return;
  }
  // aggiunta di immagini a un caso esistente: stesso percorso (anonimizzazione e controlli), codice fisso
  A.$('#nc-testa').textContent = aggiungi ? `Aggiungi immagini a ${aggiungi}` : 'Nuovo caso';
  A.$('#nc-id').disabled = !!aggiungi; A.$('#nc-titolo-riga').hidden = !!aggiungi;
  if (aggiungi) { A.$('#nc-id').value = aggiungi; NC.sale = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    A.$('#nc-stato').hidden = true; A.$('#nc-serie').hidden = true; return; }
  NC.sale = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  A.$('#nc-stato').hidden = true; A.$('#nc-serie').hidden = true; A.$('#nc-titolo').value = '';
  const numeri = (A.ELENCO.length ? A.ELENCO : await A.getJSON('/api/casi')).map((c) => parseInt((c.id.match(/(\d+)$/) || [])[1]) || 0);
  A.$('#nc-id').value = 'caso-' + String(Math.max(0, ...numeri) + 1).padStart(3, '0');
}
async function disegnaMieProposte() {
  const box = A.$('#nc-mie'); if (!box) return;
  let l = []; try { l = await A.getJSON('/api/proposte'); } catch { box.innerHTML = ''; return; }
  const st = { 'in attesa': 'in attesa del docente', approvata: 'pubblicata ✓', rifiutata: 'non pubblicata' };
  box.innerHTML = l.length ? `<h3>Le tue proposte</h3><table class="tab"><thead><tr><th>Data</th><th>Titolo</th><th>Stato</th></tr></thead><tbody>${l.map((p) => `<tr><td>${A.esc(String(p.data).slice(0, 10).split('-').reverse().join('/'))}</td>
    <td>${p.stato === 'approvata' ? `<a href="#/caso/${A.esc(p.id)}">${A.esc(p.titolo)}</a>` : A.esc(p.titolo)}</td><td>${A.esc(st[p.stato] || p.stato)}${p.motivo ? `<br><small class="muted">${A.esc(p.motivo)}</small>` : ''}</td></tr>`).join('')}</tbody></table>` : '';
}
async function leggiVoce(voce, out) {   // trascinamento: cartelle annidate
  if (voce.isFile) { out.push(await new Promise((r, x) => voce.file(r, x))); return; }
  if (voce.isDirectory) {
    const lettore = voce.createReader();
    for (;;) {
      const blocco = await new Promise((r, x) => lettore.readEntries(r, x));
      if (!blocco.length) break;
      for (const v of blocco) await leggiVoce(v, out);
    }
  }
}
let zona;   // valore in avvio()
async function analizzaFile(files) {
  const { analizza, anonimizza, verifica, paroleVietate, dividiSerie, controllaIntestazione } = await A.modAnon();
  if (NC.occupato) return;
  files = files.filter((f) => !/(^|\/)\.|DICOMDIR$/i.test(f.webkitRelativePath || f.name) && f.size < 200e6);
  if (!files.length) { stato('Nessun file utilizzabile nella selezione.', 'errore'); return; }
  NC.occupato = true; A.$('#nc-serie').hidden = true;
  const perSerie = new Map(); const esclusi = {}; NC.vietate = new Set(); let fatti = 0;
  try {
    await A.aGruppi(files, 4, async (f) => {
      const buf = await f.arrayBuffer();
      const info = analizza(buf);
      if (!info.escluso) {
        try { paroleVietate(buf).forEach((p) => NC.vietate.add(p)); } catch {}
        // mammografia: una serie per proiezione (alcuni apparecchi mettono le 4 viste nella stessa serie)
        const k = (info.serieUID || 'senza-serie') + (info.vistaMG ? '|' + info.vistaMG : '');
        if (!perSerie.has(k)) perSerie.set(k, { uid: k, numero: info.serieNum, descrizione: info.vistaMG || info.descrizione || `Serie ${info.serieNum}`, modalita: info.modalita, studio: info.studio, dataStudio: info.dataStudio,
          regione: info.regione || '', data: info.data || '', eta: info.eta, suv: info.suv || null, voci: [], incluso: true });
        const ps = perSerie.get(k);
        if (ps.eta == null && info.eta != null) ps.eta = info.eta;
        if (!ps.suv && info.suv) ps.suv = info.suv;
        ps.voci.push({ file: f, istanza: info.istanza, posizione: info.posizione, ipp: info.ipp, iop: info.iop, tempo: info.tempo });
      } else esclusi[info.escluso] = (esclusi[info.escluso] || 0) + 1;
      if (++fatti % 20 === 0 || fatti === files.length) stato(`Analisi dei file: ${fatti} / ${files.length}` + A.barra(fatti / files.length));
    });
    // più studi nella stessa cartella (es. attuale e precedente): «Studio 1» è il più vecchio
    const studi = [...new Map([...perSerie.values()].map((s) => [s.studio, s.dataStudio])).entries()].sort((x, y) => String(x[1]).localeCompare(String(y[1]))).map(([u]) => u);
    // intervallo dal primo studio (ore): per i controlli ravvicinati (es. post-operatori) conta l'orario;
    // si salva solo la differenza, mai la data o l'ora
    const t0 = Math.min(...[...perSerie.values()].map((s) => A.istanteDicom(s.dataStudio)).filter(Number.isFinite));
    for (const s of perSerie.values()) { const t = A.istanteDicom(s.dataStudio); s.ore = Number.isFinite(t) && Number.isFinite(t0) && studi.length > 1 ? Math.round((t - t0) / 360000) / 10 : null; }
    if (studi.length > 1) for (const s of perSerie.values()) { const n = studi.indexOf(s.studio) + 1; s.nStudio = n; s.descrizione = `Studio ${n} · ${s.data ? s.data + ' · ' : ''}${s.descrizione}`; }
    const distretti = [...new Set([...perSerie.values()].map((s) => s.regione).filter(Boolean))];
    A.$('#nc-distretti-riga').hidden = distretti.length < 2;
    A.$('#nc-distretti-elenco').textContent = distretti.join(', ');
    NC.serie = [...perSerie.values()].sort((a, b) => (a.nStudio || 0) - (b.nStudio || 0) || a.numero - b.numero).flatMap(dividiSerie);
    if (!NC.serie.length) { stato('Nessuna immagine utilizzabile: ' + Object.entries(esclusi).map(([m, n]) => `${n} ${m}`).join(', '), 'errore'); return; }
    const cartelle = new Set();
    for (const s of NC.serie) {
      if (s.perPosizione) s.voci.sort((a, b) => a.ordine - b.ordine || a.istanza - b.istanza);   // serie divise: in ordine di posizione
      else s.voci.sort((a, b) => a.istanza - b.istanza || (a.posizione ?? 0) - (b.posizione ?? 0) || a.file.name.localeCompare(b.file.name));
      let c = `${s.nStudio ? `s${s.nStudio}_` : ''}${String(Math.trunc(s.numero)).padStart(4, '0')}${s.piano ? '_' + s.piano.slice(0, 3) : ''}${s.fase ? `_f${String(s.fase).padStart(2, '0')}` : ''}_${A.slug(s.descrizione)}`;
      if (NC.aggiungiA) c = `a${Date.now().toString(36)}_${c}`.slice(0, 80);   // aggiunta: mai lo stesso nome di una cartella già nel caso
      while (cartelle.has(c)) c += '_b';
      cartelle.add(c); s.cartella = c;
      s.voci.forEach((v, i) => { v.percorso = `serie/${c}/img_${String(v.istanza).padStart(5, '0')}_${String(i).padStart(5, '0')}.dcm`; });
    }
    const tot = NC.serie.reduce((n, s) => n + s.voci.length, 0);
    stato(`<b>${tot} immagini</b> in ${NC.serie.length} serie, pronte per l'anonimizzazione.`, 'ok');
    A.$('#nc-esclusi').textContent = Object.keys(esclusi).length ? 'Esclusi: ' + Object.entries(esclusi).map(([m, n]) => `${n} file (${m})`).join(', ') : '';
    A.$('#nc-lista').innerHTML = NC.serie.map((s, i) => `<div class="serie-card" data-i="${i}">
      <canvas width="180" height="180"></canvas>
      <div class="tit"><input type="checkbox" checked><span>${A.esc(s.descrizione)}<br><small>${s.modalita}${s.regione ? ' · ' + A.esc(s.regione) : ''} · ${s.voci.length} immagini${s.data ? ' · ' + A.esc(s.data) : ''}${s.eta != null ? ' · ' + A.testoEta(s.eta) : ''}</small></span></div></div>`).join('');
    A.qsAll('.serie-card').forEach((card) => {
      const cb = card.querySelector('input'), s = NC.serie[+card.dataset.i];
      const agg = () => { s.incluso = cb.checked; card.classList.toggle('off', !cb.checked); };
      cb.onchange = agg; card.onclick = (e) => { if (e.target !== cb) { cb.checked = !cb.checked; agg(); } };
    });
    A.$('#nc-serie').hidden = false; A.$('#nc-controllo').checked = false;
    // anteprime già anonimizzate e ricerca del testo impresso: tutte le immagini nelle serie corte (RX,
    // mammografia), la prima, la centrale e l'ultima nelle serie lunghe
    let sospette = 0;
    for (const [i, s] of NC.serie.entries()) {
      try {
        s.zone = []; s.sceltaTesto = null;
        const quali = s.modalita === 'US' ? [Math.floor(s.voci.length / 2)]
          : s.voci.length <= 6 ? s.voci.map((_, k) => k) : [0, Math.floor(s.voci.length / 2), s.voci.length - 1];
        let mostra = null, maxZone = -1;
        for (const k of quali) {
          const out = await anonimizza(await s.voci[k].file.arrayBuffer(), { idCaso: A.$('#nc-id').value, sale: NC.sale });
          const img = A.decodificaDicom(out.buffer, { grezzo: true });
          const z = s.modalita === 'US' ? [] : A.testoImpresso(img);
          for (const b of z) {
            const u = s.zone.find((q) => b.x0 <= q.x1 && b.x1 >= q.x0 && b.y0 <= q.y1 && b.y1 >= q.y0);
            if (u) { u.x0 = Math.min(u.x0, b.x0); u.y0 = Math.min(u.y0, b.y0); u.x1 = Math.max(u.x1, b.x1); u.y1 = Math.max(u.y1, b.y1); } else s.zone.push({ ...b });
          }
          // anteprima: l'immagine con più testo trovato, altrimenti quella centrale
          if (z.length > maxZone || (!z.length && k === quali[Math.floor(quali.length / 2)] && maxZone <= 0)) { maxZone = z.length; mostra = img; }
        }
        const card = A.qs1(`.serie-card[data-i="${i}"]`);
        A.disegnaAnteprima(card.querySelector('canvas'), mostra, s.zone);
        if (s.zone.length) {
          sospette++; s.sceltaTesto = 'oscura'; card.classList.add('sospetta');
          const box = document.createElement('div'); box.className = 'nc-testo';
          box.innerHTML = `<b>⚠ Possibile testo impresso</b> (${s.zone.length} ${s.zone.length === 1 ? 'zona' : 'zone'}, in rosso)
            <label><input type="radio" name="t-${i}" value="oscura" checked> Copri le zone in tutte le immagini della serie</label>
            <label><input type="radio" name="t-${i}" value="ok"> Sono marcatori o misure, nessun dato personale</label>
            <label><input type="radio" name="t-${i}" value="escludi"> Escludi la serie</label>`;
          box.onclick = (e) => e.stopPropagation();
          box.querySelectorAll('input').forEach((r) => r.onchange = () => {
            s.sceltaTesto = r.value; const cb = card.querySelector('.tit input');
            if (r.value === 'escludi') { cb.checked = false; s.incluso = false; card.classList.add('off'); }
            else if (!cb.checked) { cb.checked = true; s.incluso = true; card.classList.remove('off'); }
          });
          card.appendChild(box);
        }
      } catch (e) { console.warn('anteprima', e); }
    }
    A.$('#nc-testo-avviso').hidden = !sospette;
    A.$('#nc-testo-avviso').innerHTML = sospette ? `In <b>${sospette} ${sospette === 1 ? 'serie' : 'serie'}</b> c'è del testo dentro l'immagine. Di serie viene coperto (pixel anneriti prima dell'invio); se sono solo marcatori di lato o misure puoi lasciarlo.` : '';
  } finally { NC.occupato = false; }
}
async function caricaCaso({ id, titolo, serie }, conto) {
  const { analizza, anonimizza, verifica, paroleVietate, dividiSerie, controllaIntestazione } = await A.modAnon();
  const voci = serie.flatMap((s) => s.voci.map((v) => Object.assign(v, { _s: s })));
  // 1. URL firmati (a blocchi)
  const urls = {};
  const aggiunta = !!NC.aggiungiA;
  const percorsi = [...voci.map((v) => v.percorso), ...(aggiunta ? [] : ['serie.json'])];
  for (let i = 0; i < percorsi.length; i += 250) {
    const r = await A.getJSON(`/api/casi/${encodeURIComponent(id)}/caricamento`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: percorsi.slice(i, i + 250), ...(aggiunta ? { aggiunta: true } : {}), ...(NC.proposta ? { proposta: true } : {}) }) });
    Object.assign(urls, r.urls);
  }
  const invia = async (url, corpo, tipo) => {
    for (let t = 1; ; t++) {
      try {
        const r = await fetch(url, { method: 'PUT', body: corpo, headers: { 'Content-Type': tipo } });
        if (r.ok) return; throw new Error(`HTTP ${r.status}`);
      } catch (e) { if (t >= 3) throw e; await A.pausa(1000 * t); }
    }
  };
  // 2. anonimizza → controlla → invia, un file alla volta (6 in parallelo)
  await A.aGruppi(voci, 6, async (v) => {
    const out = await anonimizza(await v.file.arrayBuffer(), { idCaso: id, sale: NC.sale,
      oscura: v._s?.sceltaTesto === 'oscura' ? v._s.zone : null, decodifica: (b) => A.decodificaDicom(b, { grezzo: true }) });
    const problema = verifica(out, NC.vietate);
    if (problema) throw new Error(`controllo di anonimizzazione non superato (${v.file.name}): ${problema}. Caricamento interrotto.`);
    await invia(urls[v.percorso], out, 'application/dicom');
    conto.fatti++; conto.byte += out.length;
    if (conto.fatti % 5 === 0 || conto.fatti === conto.totale) {
      const sec = (Date.now() - conto.t0) / 1000, resto = sec / conto.fatti * (conto.totale - conto.fatti);
      stato(`Anonimizzazione e caricamento${id !== A.$('#nc-id').value.trim() ? ` (caso ${A.esc(id)})` : ''}: <b>${conto.fatti} / ${conto.totale}</b> immagini · ${(conto.byte / 1e6).toFixed(0)} MB` +
        (conto.fatti < conto.totale ? ` · circa ${Math.ceil(resto / 60)} min rimanenti` : '') + A.barra(conto.fatti / conto.totale) +
        '<p class="small muted">Non chiudere questa pagina fino alla fine.</p>');
    }
  });
  // 3. elenco delle serie (con distretto, mese/anno, età e fattore SUV) e caso in bozza
  const unico = new Set(serie.map((s) => s.nStudio || 0)).size === 1;   // un solo studio nel caso: niente «Studio N ·»
  const elenco = serie.map((s) => {
    const e = { descrizione: unico ? s.descrizione.replace(A.RE_STUDIO, '') : s.descrizione, numero: Math.trunc(s.numero), files: s.voci.map((v) => v.percorso) };
    if (s.regione) e.regione = s.regione;
    if (s.data) e.data = s.data;
    if (s.eta != null) e.eta = s.eta;
    if (s.suv) e.suv = s.suv;
    if (Number.isFinite(s.ore)) e.ore = s.ore;
    return e;
  });
  // privacy: nemmeno i testi che viaggiano fuori dalle immagini (descrizioni delle serie, titolo, testi della proposta)
  // possono contenere le parole del paziente o della struttura lette dalle intestazioni originali
  const testiFuori = [...elenco.map((e) => e.descrizione), titolo, ...(NC.proposta ? ['#nc-p-quesito', '#nc-p-anamnesi', '#nc-p-descrizione'].map((x) => A.$(x)?.value || '') : [])];
  for (const t of testiFuori) { const T = String(t || '').toUpperCase(); for (const p of NC.vietate) if (p && T.includes(p)) throw new Error(`nei testi del caso c'è «${p}», preso dai dati del paziente o della struttura: toglilo e riprova. Caricamento interrotto.`); }
  if (aggiunta) {   // il server aggiunge le serie a serie.json (e riallinea il caso)
    await A.getJSON(`/api/casi/${encodeURIComponent(id)}/immagini`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aggiungi: elenco }) });
    return;
  }
  await invia(urls['serie.json'], JSON.stringify(elenco, null, 1), 'application/json');
  if (NC.proposta) {
    const mod = { CT: 'TC', MR: 'RM', US: 'Ecografia', MG: 'Mammografia', CR: 'RX', DX: 'RX', PX: 'RX', PT: 'Medicina nucleare', NM: 'Medicina nucleare', XA: 'Angiografia' }[serie[0]?.modalita] || '';
    await A.postJSON(`/api/casi/${encodeURIComponent(id)}`, { proposta: true, titolo, quesito: A.$('#nc-p-quesito').value, anamnesi: A.$('#nc-p-anamnesi').value,
      descrizione: A.$('#nc-p-descrizione').value, dichiarazione: A.$('#nc-p-dich').checked, modalita: mod, distretto: serie[0]?.regione || '' });
    return;
  }
  await A.getJSON(`/api/casi/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titolo, visibile: false, opzioni: [],
      domanda: 'Quali dei seguenti reperti sono presenti in questo esame? (seleziona tutte le risposte corrette)' }) });
}
const fp = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
const fn = (x) => (x == null ? '—' : Math.round(x));
const ft = (sec) => (sec == null ? '—' : sec < 90 ? Math.round(sec) + ' s' : Math.round(sec / 60) + ' min');
const mini = (x, cls = '') => (x == null ? '' : `<span class="mini ${cls}"><i style="width:${Math.max(0, Math.min(100, x * 100))}%"></i></span>`);
const classeD = (d) => (d == null ? '' : d >= 0.3 ? 'd-buona' : d >= 0.1 ? 'd-discreta' : d >= 0 ? 'd-scarsa' : 'd-negativa');
const testoD = (d) => (d == null ? '<span class="muted" title="Servono almeno 4 persone">—</span>' : `<span class="${classeD(d)}">${d.toFixed(2).replace('.', ',')}</span>`);
let NOMI_TIPO;   // valore in avvio()
function spark(punti) {
  if (!punti.length) return '';
  const w = 110, h = 26, n = punti.length;
  const xy = punti.map((p, i) => [n === 1 ? w / 2 : 3 + (i * (w - 6)) / (n - 1), h - 3 - (p.punteggio / 100) * (h - 6)]);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-label="Andamento dei punteggi">
    <line x1="0" x2="${w}" y1="${h - 3 - 0.5 * (h - 6)}" y2="${h - 3 - 0.5 * (h - 6)}" stroke="currentColor" stroke-opacity=".15"/>
    <polyline fill="none" stroke="var(--acc)" stroke-width="1.6" points="${xy.map((p) => p.join(',')).join(' ')}"/>
    ${xy.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="2.2" fill="var(--acc)"><title>${A.esc(punti[i].data)} · ${A.esc(punti[i].caso)}: ${punti[i].punteggio}%</title></circle>`).join('')}</svg>`;
}
// ---------------------------------------------------------------- classi e compiti (docenti)
let CLASSI, SPECIALIZZANDI;   // valore in avvio()
async function apriClassi() {
  if (!A.ELENCO.length) A.ELENCO = await A.getJSON('/api/casi');
  if (!A.PERCORSI.length) await A.caricaPercorsi();
  [CLASSI, SPECIALIZZANDI] = await Promise.all([A.getJSON('/api/classi').then((l) => l.filter((c) => c.gestita)), A.getJSON('/api/specializzandi')]);
  disegnaClassi();
}
function disegnaClassi() {
  const oggiISO = new Date().toLocaleDateString('sv-SE'), titolo = Object.fromEntries(A.ELENCO.map((c) => [c.id, c.titolo]));
  A.$('#cl-lista').innerHTML = CLASSI.length ? CLASSI.map((c) => `<section class="classe" data-id="${A.esc(c.id)}">
    <div class="riga"><h2>${A.esc(c.nome)}</h2><small class="muted">${c.membri.length} studenti · ${c.compiti.length} compiti</small><span class="spacer"></span>
      <button class="ghost cl-modifica">Modifica</button><button class="ghost cl-elimina">Elimina</button></div>
    ${c.compiti.length && c.membri.length ? `<table class="tab cl-stato"><thead><tr><th>Studente</th>${c.compiti.map((k) =>
      `<th title="${A.esc(k.casi.map((x) => titolo[x] || x).join('\n'))}">${A.esc(k.titolo)}<br><small>${k.casi.length} casi${k.scadenza ? ' · entro ' + k.scadenza.split('-').reverse().join('/') : ''}</small></th>`).join('')}</tr></thead><tbody>
      ${c.membri.map((m, i) => `<tr><td>${A.esc(m.nome)}</td>${c.compiti.map((k) => { const st = k.stato[i], completo = st.fatti === st.totale, scaduto = k.scadenza && k.scadenza < oggiISO;
        const cls = completo ? (st.inTempo === st.totale ? 'ok' : 'tardi') : scaduto ? 'ko' : '';
        return `<td class="num ${cls}" title="${st.inTempo} entro la scadenza">${st.fatti}/${st.totale}${st.media != null ? ` · ${st.media}%` : ''}${completo && st.inTempo < st.totale ? ' (in ritardo)' : !completo && scaduto ? ' (scaduto)' : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table>` : '<p class="muted small">Aggiungi studenti e compiti con «Modifica».</p>'}
    </section>`).join('') : '<p class="muted">Nessuna classe: creane una con «Nuova classe».</p>';
  A.qsAll('.cl-modifica').forEach((b) => b.onclick = () => editorClasse(CLASSI.find((c) => c.id === b.closest('.classe').dataset.id)));
  A.qsAll('.cl-elimina').forEach((b) => b.onclick = async () => {
    const c = CLASSI.find((x) => x.id === b.closest('.classe').dataset.id);
    if (!confirm(`Eliminare la classe «${c.nome}»? I risultati degli studenti restano.`)) return;
    await A.postJSON(`/api/classi/${c.id}/elimina`); await apriClassi();
  });
}
function editorClasse(c) {
  c = c ? JSON.parse(JSON.stringify(c)) : { nome: '', membri: [], compiti: [] };
  const membri = new Set(c.membri.map((m) => m.id || m));
  const sec = document.createElement('section'); sec.className = 'classe editor-classe';
  const metodiche = [...new Set(A.ELENCO.map(A.metodicaDi))];
  const sceltaCasi = (k, j) => `<details class="cl-casi"><summary>${k.casi.length} casi scelti</summary>
      <div class="riga"><select class="cl-da-percorso"><option value="">Aggiungi i casi di un percorso…</option>${A.PERCORSI.map((p) => `<option value="${A.esc(p.id)}">${A.esc(p.titolo)}</option>`).join('')}</select>
      <input class="cl-filtro" placeholder="filtra i casi…"></div>
      <div class="cl-griglia">${metodiche.map((m) => `<div><b>${A.esc(m)}</b>${A.ELENCO.filter((x) => A.metodicaDi(x) === m).map((x) =>
        `<label class="check cl-caso"><input type="checkbox" value="${A.esc(x.id)}" ${k.casi.includes(x.id) ? 'checked' : ''}> ${A.esc(x.titolo)}${x.visibile === false ? ' <span class="badge">bozza</span>' : ''}</label>`).join('')}</div>`).join('')}</div></details>`;
  const rigaCompito = (k, j) => `<div class="cl-compito" data-j="${j}"><input class="cl-tit" placeholder="Titolo del compito" value="${A.esc(k.titolo || '')}">
      <label>Scadenza <input type="date" class="cl-scad" value="${A.esc(k.scadenza || '')}"></label><button type="button" class="ghost cl-togli">✕</button>${sceltaCasi(k, j)}</div>`;
  const disegna = () => {
    sec.innerHTML = `<div class="riga"><input id="cl-nome" placeholder="Nome della classe (es. Specializzandi 2° anno)" value="${A.esc(c.nome)}"></div>
      <h3>Specializzandi</h3><div class="cl-membri">${SPECIALIZZANDI.map((a) => `<label class="check" title="${a.email ? 'Riceve gli avvisi per email' : 'Nessuna email: niente avvisi'}"><input type="checkbox" value="${A.esc(a.id)}" ${membri.has(a.id) ? 'checked' : ''}> ${A.esc(a.nome)}${a.email ? ' <span class="muted">✉</span>' : ''}</label>`).join('') || '<p class="muted small">Nessuno studente.</p>'}</div>
      <h3>Compiti</h3><div class="cl-compiti">${c.compiti.map(rigaCompito).join('')}</div>
      <button type="button" class="ghost cl-aggiungi">+ Aggiungi compito</button>
      <div class="riga"><label class="check" title="Agli studenti con un indirizzo email: i compiti nuovi a tutti, quelli esistenti solo a chi è appena entrato nella classe. Due giorni prima della scadenza arriva un promemoria a chi non ha finito."><input type="checkbox" class="cl-avvisa" checked> Avvisa per email</label>
        <span class="spacer"></span><button type="button" class="ghost cl-annulla">Annulla</button><button type="button" class="primary cl-salva">Salva classe</button></div>`;
    sec.querySelector('#cl-nome').oninput = (e) => { c.nome = e.target.value; };
    sec.querySelectorAll('.cl-membri input').forEach((x) => x.onchange = () => { x.checked ? membri.add(x.value) : membri.delete(x.value); });
    sec.querySelectorAll('.cl-compito').forEach((r) => {
      const k = c.compiti[+r.dataset.j];
      r.querySelector('.cl-tit').oninput = (e) => { k.titolo = e.target.value; };
      r.querySelector('.cl-scad').onchange = (e) => { k.scadenza = e.target.value; };
      r.querySelector('.cl-togli').onclick = () => { c.compiti.splice(+r.dataset.j, 1); disegna(); };
      const aggiornaConteggio = () => { r.querySelector('.cl-casi summary').textContent = `${k.casi.length} casi scelti`; };
      r.querySelectorAll('.cl-caso input').forEach((x) => x.onchange = () => { k.casi = x.checked ? [...new Set([...k.casi, x.value])] : k.casi.filter((y) => y !== x.value); aggiornaConteggio(); });
      r.querySelector('.cl-da-percorso').onchange = (e) => { const p = A.PERCORSI.find((x) => x.id === e.target.value); if (!p) return;
        k.casi = [...new Set([...k.casi, ...p.casi.filter((id) => A.ELENCO.some((x) => x.id === id))])]; if (!k.titolo) k.titolo = p.titolo; disegna(); };
      r.querySelector('.cl-filtro').oninput = (e) => { const t = A.normal(e.target.value); r.querySelectorAll('.cl-caso').forEach((l) => { l.hidden = t && !A.normal(l.textContent).includes(t); }); };
    });
    sec.querySelector('.cl-aggiungi').onclick = () => { c.compiti.push({ titolo: '', casi: [], scadenza: '' }); disegna(); sec.querySelector('.cl-compito:last-child details').open = true; };
    sec.querySelector('.cl-annulla').onclick = () => disegnaClassi();
    sec.querySelector('.cl-salva').onclick = async () => {
      c.nome = A.$('#cl-nome').value;
      const r = await A.postJSON(`/api/classi${c.id ? '/' + c.id : ''}`, { nome: c.nome, membri: [...membri], compiti: c.compiti.map(({ stato, ...k }) => k), avvisa: sec.querySelector('.cl-avvisa').checked });
      await apriClassi();
      if (r.avvisati) { const m = document.createElement('p'); m.className = 'stato ok'; m.textContent = `Avviso inviato per email a ${r.avvisati} ${r.avvisati === 1 ? 'studente' : 'studenti'}.`; A.$('#cl-lista').prepend(m); }
    };
  };
  disegna();
  A.$('#cl-lista').prepend(sec); sec.scrollIntoView({ block: 'start' });
}
// ---------------------------------------------------------------- revisione delle bozze (autori)
// Bozze e casi visibili con un dubbio nella nota: cosa controllare, apri, conferma e pubblica, oppure correggi.
let RE_CONTROLLO;   // valore in avvio()
async function apriRevisione() {
  A.$('#rv-lista').innerHTML = '<p class="muted">Carico…</p>';
  A.ELENCO = await A.getJSON('/api/casi');
  const da = A.ELENCO.filter((c) => c.visibile === false || (c.controlli || []).some((x) => /nota/.test(x)));
  const dett = await Promise.all(da.map((c) => A.getJSON(`/api/casi/${encodeURIComponent(c.id)}/completo`).catch(() => null)));
  const righe = da.map((c, i) => ({ c, d: dett[i] })).filter((x) => x.d && !/non pubblicarlo|unito nel caso/i.test(x.d.nota_docente || '') && x.d.proposta?.stato !== 'rifiutata');
  const gruppo = (x) => (x.d.proposta?.stato === 'in attesa' ? 'Proposte degli iscritti' : /analisi IA/.test(x.d.nota_docente || '') ? 'Bozze dall\'analisi IA' : /importazione del/.test(x.d.nota_docente || '') ? 'Casi importati da confermare' : x.c.visibile === false ? 'Altre bozze' : 'Visibili con un dubbio aperto');
  const gruppi = {}; for (const x of righe) (gruppi[gruppo(x)] ||= []).push(x);
  const testoControllo = (n) => { const m = (n || '').match(RE_CONTROLLO); if (m) return m.join('\n'); const r = (n || '').split('\n').filter((l) => /verific|controll|dubbi|bozza/i.test(l)); return r.join('\n') || (n || '').slice(-400); };
  A.$('#rv-lista').innerHTML = righe.length ? Object.entries(gruppi).map(([g, l]) => `<h2 class="pd-gruppo">${A.esc(g)} <small class="muted">${l.length}</small></h2>` + l.map(({ c, d }) => {
    const pronta = (d.opzioni || []).length >= 2 && (d.opzioni || []).some((o) => o.corretta) && !/da compilare/i.test(d.anamnesi + (d.opzioni || []).map((o) => o.testo).join(' '));
    return `<section class="classe rv-caso" data-id="${A.esc(c.id)}"><div class="riga"><h2>${A.esc(c.id.replace('caso-', ''))} · ${A.esc(d.titolo_interno || d.titolo)}</h2>
      <small class="muted">${A.esc(A.metodicaDi(d))} · ${c.visibile === false ? 'bozza' : 'visibile'}${(c.controlli || []).length ? ' · ' + A.esc(c.controlli.join(', ')) : ''}</small><span class="spacer"></span>
      <a class="btn" href="#/caso/${A.esc(c.id)}">Apri con le immagini</a><a class="btn" href="#/editor/${A.esc(c.id)}">Correggo</a>
      <button class="primary rv-ok" ${!pronta ? 'disabled title="Prima completa il caso (risposte, testi segnaposto)"' : d.proposta?.stato === 'in attesa' && d.proposta.controllo?.esito !== 'ok' ? 'disabled title="Prima controlla l\'anonimato delle immagini"' : ''}>${c.visibile === false ? 'Confermo e pubblico' : 'Confermo'}</button></div>
      ${d.proposta?.stato === 'in attesa' ? `<p class="small">Proposto da <b>${A.esc(d.proposta.nome)}</b> il ${A.esc(d.proposta.data)}. Prima di pubblicare controlla <b>tutte le immagini</b> (anonimato, testo impresso) e scrivi reperti e domande con «Correggo».</p>
        <div class="rv-anon-box">${d.proposta.controllo?.esito === 'ok'
          ? `<p class="small ok">✓ Anonimato controllato da ${A.esc(d.proposta.controllo.docente || '')} il ${A.esc(d.proposta.controllo.data || '')}: ${d.proposta.controllo.file} file, ${d.proposta.controllo.immagini} immagini guardate.</p>`
          : '<p class="small">Prima della pubblicazione serve il <b>controllo dell\'anonimato</b>: intestazioni di tutti i file e testo impresso nelle immagini.</p>'}
          <button class="ghost rv-anon">🔍 Controlla l'anonimato</button><div class="rv-anon-esito"></div></div>
        <div class="riga rv-rifiuta"><input class="rv-motivo" maxlength="500" placeholder="Motivo per cui non lo pubblichi (lo vede chi l'ha proposto)"><button class="ghost rv-no">Non pubblicare</button></div>` : ''}
      <pre class="rv-nota">${A.esc(d.proposta?.stato === 'in attesa' ? d.proposta.descrizione || '' : testoControllo(d.nota_docente))}</pre>
      <details><summary class="small">Reperti attesi e conclusione</summary><ul class="small">${(d.opzioni || []).filter((o) => o.corretta).map((o) => `<li>${o.tipo === 'principale' ? '<b>' : ''}${A.esc(o.testo)}${o.tipo === 'principale' ? '</b>' : ''}</li>`).join('')}</ul></details>
      <p class="rv-msg small muted"></p></section>`; }).join('')).join('')
    : '<div class="vuoto">Nessuna bozza da rivedere. 🎉</div>';
  A.qsAll('.rv-anon-box button.rv-anon').forEach((b) => b.onclick = () => controllaAnonimatoProposta(b.closest('.rv-caso'), righe.find((x) => x.c.id === b.closest('.rv-caso').dataset.id)));
  A.qsAll('.rv-no').forEach((b) => b.onclick = async () => {
    const sec = b.closest('.rv-caso'), id = sec.dataset.id, msg = sec.querySelector('.rv-msg'), motivo = sec.querySelector('.rv-motivo').value.trim();
    if (!motivo) { msg.textContent = 'Scrivi il motivo: lo vede chi ha proposto il caso.'; sec.querySelector('.rv-motivo').focus(); return; }
    b.disabled = true;
    try { await A.postJSON(`/api/proposte/${encodeURIComponent(id)}`, { azione: 'rifiuta', motivo }); sec.classList.add('rv-fatto'); msg.textContent = 'Proposta non pubblicata: resta in bozza, puoi eliminarla da Gestione casi.'; }
    catch (e) { b.disabled = false; msg.textContent = 'Non salvato: ' + e.message; }
  });
  A.qsAll('.rv-ok').forEach((b) => b.onclick = async () => {
    const sec = b.closest('.rv-caso'), id = sec.dataset.id, msg = sec.querySelector('.rv-msg');
    b.disabled = true; msg.textContent = 'Salvo…';
    try {
      const d = await A.getJSON(`/api/casi/${encodeURIComponent(id)}/completo`), oggi = new Date().toLocaleDateString('it-IT');
      const nota = String(d.nota_docente || '').replace(RE_CONTROLLO, '').replace(/\n{3,}/g, '\n\n').trim() + `\n[revisione-ott2026] Reperti confermati dal docente (${oggi}).`;
      const { id: _x, ...corpo } = d;
      await A.postJSON(`/api/casi/${encodeURIComponent(id)}`, { ...corpo, visibile: true, nota_docente: nota.trim() });
      sec.classList.add('rv-fatto'); msg.textContent = `Confermato${d.visibile === false ? ' e pubblicato' : ''}. Online subito; nel Mac lo riporta «confronta_online.py --allinea».`;
    } catch (e) { b.disabled = false; msg.textContent = 'Non salvato: ' + e.message; }
  });
}
// controllo dell'anonimato di un caso proposto: intestazioni di tutti i file (stessa lista bianca dell'anonimizzazione)
// e testo impresso nelle immagini (stessa ricerca del caricamento), con le anteprime da guardare. Senza esito positivo
// e conferma del docente il server non lascia pubblicare la proposta.
async function controllaAnonimatoProposta(sec, riga) {
  const { analizza, anonimizza, verifica, paroleVietate, dividiSerie, controllaIntestazione } = await A.modAnon();
  const id = sec.dataset.id, box = sec.querySelector('.rv-anon-esito'), bot = sec.querySelector('button.rv-anon');
  bot.disabled = true; box.innerHTML = '<p class="small muted an-stato">Preparo il controllo…</p>';
  const st = (t) => { const e = box.querySelector('.an-stato'); if (e) e.textContent = t; };
  try {
    await A.getJSON(`/api/casi/${encodeURIComponent(id)}`);                       // cookie per le immagini del caso
    const serie = await (await fetch(`/casi/${encodeURIComponent(id)}/serie.json`, { cache: 'no-store' })).json();
    const file = serie.flatMap((s, i) => (s.files || []).map((f) => ({ i, f })));
    if (!file.length) throw new Error('nessuna immagine nel caso');
    const prendi = async (f, inizio) => new Uint8Array(await (await fetch(`/casi/${encodeURIComponent(id)}/${f}`, inizio ? { headers: { Range: 'bytes=0-131071' } } : {})).arrayBuffer());
    const problemi = new Map(); let fatti = 0;
    await A.aGruppi(file, 6, async ({ f }) => {
      let p = controllaIntestazione(await prendi(f, true), id);
      if (p.includes('file non leggibile')) p = controllaIntestazione(await prendi(f, false), id);   // intestazione più lunga di 128 kB
      for (const x of p) problemi.set(x, [...(problemi.get(x) || []), f]);
      if (++fatti % 10 === 0 || fatti === file.length) st(`Intestazioni: ${fatti} / ${file.length} file`);
    });
    // testo impresso: tutte le immagini nelle serie corte, prima, centrale e ultima nelle lunghe
    const schede = [], zoneTot = { n: 0 }; let guardate = 0;
    for (const [i, s] of serie.entries()) {
      const fs = s.files || [], quali = fs.length <= 12 ? fs : [fs[0], fs[Math.floor(fs.length / 2)], fs[fs.length - 1]];
      let mostra = null, zone = [], max = -1;
      for (const f of quali) {
        st(`Testo nelle immagini: serie ${i + 1} di ${serie.length}`);
        const img = A.decodificaDicom((await prendi(f, false)).buffer, { grezzo: true }); guardate++;
        const z = img.rgb ? [] : A.testoImpresso(img);
        if (z.length > max) { max = z.length; mostra = img; zone = z; }
        zoneTot.n += z.length;
      }
      schede.push({ i, s, mostra, zone });
    }
    const ok = !problemi.size;
    box.innerHTML = `${ok ? `<p class="small ok">✓ Intestazioni anonime in tutti i ${file.length} file.</p>`
      : `<div class="avviso small"><b>Intestazioni non anonime: non pubblicare.</b><ul>${[...problemi].map(([k, l]) => `<li>${A.esc(k)} — ${l.length} file</li>`).join('')}</ul>Elimina la proposta o ricarica le immagini con il caricamento guidato.</div>`}
      <p class="small">${zoneTot.n ? `<b>⚠ Possibile testo impresso</b> in ${schede.filter((x) => x.zone.length).length} serie (zone in rosso): guarda se sono nomi, date o strutture.` : 'Nessun testo impresso trovato in automatico.'}
        Guarda comunque tutte le anteprime (ecografie e immagini a colori non sono analizzate in automatico).</p>
      <div class="serie-griglia rv-anteprime">${schede.map((x) => `<div class="serie-card${x.zone.length ? ' sospetta' : ''}" title="Apri il caso con le immagini" data-i="${x.i}"><canvas width="260" height="260"></canvas><div class="tit"><span>${A.esc(x.s.descrizione || 'Serie ' + (x.i + 1))}<br><small>${(x.s.files || []).length} immagini${x.zone.length ? ` · ${x.zone.length} zone di testo` : ''}</small></span></div></div>`).join('')}</div>
      ${ok ? `<label class="spunta"><input type="checkbox" class="rv-anon-ok"> <span>Ho guardato tutte le anteprime e le serie del caso: nessun nome, data, codice, struttura o medico.</span></label>
        <button class="primary rv-anon-salva" disabled>Registra il controllo</button>` : ''}`;
    box.querySelectorAll('.rv-anteprime canvas').forEach((cv, k) => { try { A.disegnaAnteprima(cv, schede[k].mostra, schede[k].zone); } catch {} });
    box.querySelectorAll('.rv-anteprime .serie-card').forEach((c) => { c.style.cursor = 'pointer'; c.onclick = () => { location.hash = `#/caso/${encodeURIComponent(id)}`; }; });
    const esito = { file: file.length, immagini: guardate, zone: zoneTot.n };
    if (!ok) { await A.postJSON(`/api/proposte/${encodeURIComponent(id)}`, { azione: 'controllo', esito: 'problemi', ...esito, problemi: [...problemi.keys()] }).catch(() => {}); return; }
    const cb = box.querySelector('.rv-anon-ok'), sv = box.querySelector('.rv-anon-salva');
    cb.onchange = () => { sv.disabled = !cb.checked; };
    sv.onclick = async () => {
      sv.disabled = true;
      try {
        await A.postJSON(`/api/proposte/${encodeURIComponent(id)}`, { azione: 'controllo', esito: 'ok', ...esito });
        box.insertAdjacentHTML('beforeend', '<p class="small ok">Controllo registrato: ora puoi pubblicare.</p>');
        const pub = sec.querySelector('.rv-ok'); const d = riga?.d;
        if (pub && d && (d.opzioni || []).length >= 2 && (d.opzioni || []).some((o) => o.corretta)) { pub.disabled = false; pub.title = ''; }
        if (riga?.d?.proposta) riga.d.proposta.controllo = { esito: 'ok' };
      } catch (e) { sv.disabled = false; box.insertAdjacentHTML('beforeend', `<p class="small ko">Non registrato: ${A.esc(e.message)}</p>`); }
    };
  } catch (e) { box.innerHTML = `<p class="small ko">Controllo non riuscito: ${A.esc(e.message)}</p>`; }
  finally { bot.disabled = false; }
}
// ---------------------------------------------------------------- percorsi didattici dei docenti (Gestione → Percorsi didattici)
async function apriPercorsiDoc() {
  if (!A.ELENCO.length) A.ELENCO = await A.getJSON('/api/casi');
  await A.caricaPercorsi();
  disegnaPercorsiDoc();
}
function disegnaPercorsiDoc() {
  const tit = Object.fromEntries(A.ELENCO.map((c) => [c.id, c.titolo]));
  const elencoCasi = (p) => `<details class="pd-elenco"><summary>${p.casi.length} casi</summary><ol class="small">${p.casi.map((id) => `<li>${A.esc(tit[id] || id)}${tit[id] ? (A.ELENCO.find((c) => c.id === id)?.visibile === false ? ' <span class="badge">bozza</span>' : '') : ' <span class="badge">non disponibile</span>'}</li>`).join('')}</ol></details>`;
  const card = (p, fisso) => `<section class="classe percorso-doc" data-id="${A.esc(p.id)}"><div class="riga"><h2>${A.esc(p.titolo)}</h2>
      <small class="muted">${fisso ? (p.nascosto ? 'nascosto agli studenti' : p.personalizzato ? 'percorso del sito, personalizzato' : p.casi.length ? 'percorso del sito' : 'modello: ancora senza casi') : p.pubblico ? 'visibile a tutti' : 'per chi ha scelto ' + (p.autore_nome ? A.esc(p.autore_nome) : 'il docente') + ' come riferimento'}${!fisso && p.aggiornato ? ' · ' + A.esc(p.aggiornato.slice(0, 10).split('-').reverse().join('/')) : ''}</small><span class="spacer"></span>
      ${fisso ? (A.ADMIN ? `<button class="ghost pd-personalizza" title="Scegli i casi, il titolo e la descrizione di questo percorso per la piattaforma">${p.casi.length ? 'Personalizza' : 'Riempi con i casi'}</button><button class="ghost pd-nascondi">${p.nascosto ? 'Mostra' : 'Nascondi'}</button>${p.personalizzato ? '<button class="ghost pd-ripristina" title="Torna al percorso originale">Ripristina</button>' : ''}` : '')
        + '<button class="ghost pd-copia" title="Crea un tuo percorso partendo da questo">Copia e modifica</button>' : p.modificabile ? '<button class="ghost pd-modifica">Modifica</button><button class="ghost pd-elimina">Elimina</button>' : ''}</div>
      ${p.descrizione ? `<p class="muted small">${A.esc(p.descrizione)}</p>` : ''}${elencoCasi(p)}</section>`;
  const miei = A.PERCORSI_DOC.filter((p) => p.modificabile), altri = A.PERCORSI_DOC.filter((p) => !p.modificabile);
  A.$('#pd-lista').innerHTML = `<h2 class="pd-gruppo">${A.ADMIN ? 'Percorsi dei docenti e tuoi' : 'I tuoi percorsi'} <small class="muted">${miei.length}</small></h2>`
    + (miei.length ? miei.map((p) => card(p, false)).join('') : '<p class="muted">Nessun percorso: creane uno con «Nuovo percorso» o copia un percorso del sito.</p>')
    + (altri.length ? `<h2 class="pd-gruppo">Percorsi di altri docenti che vedi <small class="muted">${altri.length}</small></h2>` + altri.map((p) => card(p, false)).join('') : '')
    + `<details class="pd-fissi"${A.ADMIN && A.AZIENDA() ? ' open' : ''}><summary><h2 class="pd-gruppo">${A.AZIENDA() ? 'Percorsi tematici (modelli da riempire con i vostri casi)' : 'Percorsi del sito'} <small class="muted">${A.PERCORSI_FISSI_TUTTI.length}</small></h2></summary>`
    + (A.ADMIN ? '<p class="muted small">Ogni percorso tematico si può personalizzare: scegli i casi e il loro ordine, cambia titolo e descrizione, oppure nascondilo. Gli studenti vedono solo i percorsi con almeno un caso.</p>' : '')
    + `${(A.ADMIN ? A.PERCORSI_FISSI_TUTTI : A.PERCORSI_FISSI).map((p) => card(p, true)).join('')}</details>`;
  const trova = (b) => { const id = b.closest('.percorso-doc').dataset.id; return A.PERCORSI_DOC.find((p) => p.id === id) || A.PERCORSI_FISSI_TUTTI.find((p) => p.id === id); };
  const salvaFisso = async (p, campi) => { await A.postJSON('/api/percorsi', { fisso: p.id, titolo: p.titolo, descrizione: p.descrizione || '', casi: p.casi, nascosto: !!p.nascosto, ...campi }); await apriPercorsiDoc(); };
  A.qsAll('.pd-personalizza').forEach((b) => b.onclick = () => { const p = trova(b); editorPercorso({ titolo: p.titolo, descrizione: p.descrizione || '', casi: [...p.casi], fisso: p.id, nascosto: !!p.nascosto }); });
  A.qsAll('.pd-nascondi').forEach((b) => b.onclick = () => { const p = trova(b); salvaFisso(p, { nascosto: !p.nascosto }); });
  A.qsAll('.pd-ripristina').forEach((b) => b.onclick = async () => { const p = trova(b);
    if (!confirm(`Riportare «${p.modello.titolo}» al percorso originale? La personalizzazione si perde.`)) return;
    await A.postJSON(`/api/percorsi/f-${p.id}/elimina`); await apriPercorsiDoc(); });
  A.qsAll('.pd-modifica').forEach((b) => b.onclick = () => editorPercorso(trova(b)));
  A.qsAll('.pd-copia').forEach((b) => b.onclick = () => { const p = trova(b); editorPercorso({ titolo: p.titolo, descrizione: p.descrizione || '', casi: [...p.casi], pubblico: false }); });
  A.qsAll('.pd-elimina').forEach((b) => b.onclick = async () => {
    const p = trova(b); if (!confirm(`Eliminare il percorso «${p.titolo}»? I risultati degli studenti restano.`)) return;
    await A.postJSON(`/api/percorsi/${p.id}/elimina`); await apriPercorsiDoc();
  });
}
function editorPercorso(p) {
  p = p ? JSON.parse(JSON.stringify(p)) : { titolo: '', descrizione: '', casi: [], pubblico: false };
  const sec = document.createElement('section'); sec.className = 'classe editor-classe editor-percorso';
  const metodiche = [...new Set(A.ELENCO.map(A.metodicaDi))], tit = Object.fromEntries(A.ELENCO.map((c) => [c.id, c.titolo]));
  let filtro = '';
  const disegna = () => {
    sec.innerHTML = `<div class="riga"><input id="pd-tit" placeholder="Titolo del percorso (es. Addome acuto in Pronto Soccorso)" value="${A.esc(p.titolo)}"></div>
      <textarea id="pd-desc" rows="2" placeholder="Descrizione: a chi serve, cosa si impara">${A.esc(p.descrizione || '')}</textarea>
      ${p.fisso ? '<p class="muted small">Percorso tematico del sito personalizzato per questa piattaforma: lo vedono tutti gli iscritti, se ha almeno un caso.</p>' : A.ADMIN ? `<label class="check"><input type="checkbox" id="pd-pub" ${p.pubblico ? 'checked' : ''}> Visibile a tutti gli iscritti (altrimenti solo a chi ti ha scelto come docente)</label>` : '<p class="muted small">Lo vedono gli iscritti che ti hanno scelto come docente di riferimento, nella pagina iniziale sotto «Percorsi tematici».</p>'}
      <h3>Casi nell'ordine del percorso <small class="muted">${p.casi.length}</small></h3>
      ${p.casi.length ? `<ol class="pd-ordine">${p.casi.map((id, i) => `<li data-i="${i}"><span>${A.esc(tit[id] || id)}${tit[id] ? '' : ' <span class="badge">non disponibile</span>'}</span>
        <button type="button" class="ghost pd-su" title="Su" ${i ? '' : 'disabled'}>↑</button><button type="button" class="ghost pd-giu" title="Giù" ${i < p.casi.length - 1 ? '' : 'disabled'}>↓</button><button type="button" class="ghost pd-via" title="Togli">✕</button></li>`).join('')}</ol>` : '<p class="muted small">Nessun caso: aggiungili qui sotto. L\'ordine conta: si consiglia dal più semplice al più difficile.</p>'}
      <details class="cl-casi" ${p.casi.length ? '' : 'open'}><summary>Aggiungi casi</summary>
        <div class="riga"><select class="pd-da"><option value="">Aggiungi i casi di un percorso…</option>${A.PERCORSI.map((x) => `<option value="${A.esc(x.id)}">${A.esc(x.titolo)}</option>`).join('')}</select>
        <input class="pd-filtro" placeholder="filtra i casi…" value="${A.esc(filtro)}"></div>
        <div class="cl-griglia">${metodiche.map((m) => `<div><b>${A.esc(m)}</b>${A.ELENCO.filter((x) => A.metodicaDi(x) === m).map((x) =>
          `<label class="check cl-caso"><input type="checkbox" value="${A.esc(x.id)}" ${p.casi.includes(x.id) ? 'checked' : ''}> ${A.esc(x.titolo)}${x.difficolta ? ` <small class="muted">${A.esc(x.difficolta)}</small>` : ''}${x.visibile === false ? ' <span class="badge">bozza</span>' : ''}</label>`).join('')}</div>`).join('')}</div></details>
      <div class="riga"><span class="pd-msg muted small"></span><span class="spacer"></span><button type="button" class="ghost pd-annulla">Annulla</button><button type="button" class="primary pd-salva">Salva percorso</button></div>`;
    sec.querySelector('#pd-tit').oninput = (e) => { p.titolo = e.target.value; };
    sec.querySelector('#pd-desc').oninput = (e) => { p.descrizione = e.target.value; };
    sec.querySelector('#pd-pub')?.addEventListener('change', (e) => { p.pubblico = e.target.checked; });
    const aperto = () => sec.querySelector('.cl-casi').open;
    const ridisegna = () => { const ap = aperto(), y = window.scrollY; disegna(); sec.querySelector('.cl-casi').open = ap; window.scrollTo(0, y); };
    sec.querySelectorAll('.pd-ordine li').forEach((li) => { const i = +li.dataset.i;
      li.querySelector('.pd-su').onclick = () => { [p.casi[i - 1], p.casi[i]] = [p.casi[i], p.casi[i - 1]]; ridisegna(); };
      li.querySelector('.pd-giu').onclick = () => { [p.casi[i + 1], p.casi[i]] = [p.casi[i], p.casi[i + 1]]; ridisegna(); };
      li.querySelector('.pd-via').onclick = () => { p.casi.splice(i, 1); ridisegna(); }; });
    sec.querySelectorAll('.cl-caso input').forEach((x) => x.onchange = () => { p.casi = x.checked ? [...new Set([...p.casi, x.value])] : p.casi.filter((y) => y !== x.value); ridisegna(); });
    sec.querySelector('.pd-da').onchange = (e) => { const q = A.PERCORSI.find((x) => x.id === e.target.value); if (!q) return;
      p.casi = [...new Set([...p.casi, ...q.casi.filter((id) => tit[id])])]; if (!p.titolo) p.titolo = q.titolo; ridisegna(); };
    const filtra = () => { const t = A.normal(filtro); sec.querySelectorAll('.cl-caso').forEach((l) => { l.hidden = t && !A.normal(l.textContent).includes(t); }); };
    sec.querySelector('.pd-filtro').oninput = (e) => { filtro = e.target.value; filtra(); }; filtra();
    sec.querySelector('.pd-annulla').onclick = () => disegnaPercorsiDoc();
    sec.querySelector('.pd-salva').onclick = async () => {
      if (!p.titolo.trim()) { sec.querySelector('.pd-msg').textContent = 'Scrivi un titolo.'; return; }
      if (!p.casi.length && !p.fisso) { sec.querySelector('.pd-msg').textContent = 'Aggiungi almeno un caso.'; return; }
      try {
        if (p.fisso) await A.postJSON('/api/percorsi', { fisso: p.fisso, titolo: p.titolo, descrizione: p.descrizione, casi: p.casi, nascosto: !!p.nascosto });
        else await A.postJSON(`/api/percorsi${p.id ? '/' + p.id : ''}`, { titolo: p.titolo, descrizione: p.descrizione, casi: p.casi, pubblico: !!p.pubblico });
        await apriPercorsiDoc();
      }
      catch (e) { sec.querySelector('.pd-msg').textContent = 'Non salvato: ' + e.message; }
    };
  };
  disegna();
  A.$('#pd-lista').prepend(sec); sec.scrollIntoView({ block: 'start' });
}
// ---------------------------------------------------------------- gestione dei casi (amministratori)
let GC;   // valore in avvio()
const statoIAgc = () => { const el = A.$('#gc-ia-stato'); if (el) el.textContent = [A.$('#gc-ia').checked ? 'segmentazione attiva' : 'segmentazione spenta', A.$('#gc-referto-locale').checked ? 'correzione del referto attiva' : 'correzione del referto spenta'].join(' · '); };
async function apriGestioneCasi() {
  A.impostazioniIA(true).then((on) => { A.$('#gc-ia').checked = on; statoIAgc(); }).catch(() => {});
  A.getJSON('/api/impostazioni', { cache: 'no-store' }).then((x) => { A.$('#gc-referto-locale').checked = !!x.refertoLocale; statoIAgc(); }).catch(() => {});
  GC.casi = await A.getJSON('/api/casi'); GC.sel.clear(); GC.ord ||= { campo: 'id', verso: 1 };
  const opz = (el, val) => { const v = el.value; el.innerHTML = el.options[0].outerHTML + [...new Set(val)].filter(Boolean).sort((a, b) => a.localeCompare(b)).map((x) => `<option>${A.esc(x)}</option>`).join(''); el.value = v; };
  opz(A.$('#gc-metodica'), GC.casi.map(A.metodicaDi)); opz(A.$('#gc-distretto'), GC.casi.map((c) => c.distretto));
  disegnaGestioneCasi();
}
const valoreGC = (c, campo) => ({ metodica: A.metodicaDi(c), stato: c.visibile === false ? 1 : 0, risposte: c.risposte || 0, controlli: (c.controlli || []).length,
  difficolta: ['Base', 'Intermedio', 'Avanzato'].indexOf(c.difficolta) })[campo] ?? String(c[campo] ?? '');
function filtratiGC() {
  const f = A.normal(A.$('#gc-filtro').value), st = A.$('#gc-stato').value, me = A.$('#gc-metodica').value, di = A.$('#gc-distretto').value;
  const l = GC.casi.filter((c) => (!f || A.normal([c.id, c.titolo, c.quesito].join(' ')).includes(f)) && (!me || A.metodicaDi(c) === me) && (!di || c.distretto === di)
    && (!st || (st === 'bozza' && c.visibile === false) || (st === 'visibile' && c.visibile !== false) || (st === 'problemi' && c.controlli?.length)
      || (st === 'pronti' && c.visibile === false && !c.controlli?.length)));
  const { campo, verso } = GC.ord;
  return l.sort((a, b) => { const x = valoreGC(a, campo), y = valoreGC(b, campo); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'it', { numeric: true })) * verso; });
}
function disegnaGestioneCasi() {
  const l = filtratiGC(), tot = GC.casi.length, bozze = GC.casi.filter((c) => c.visibile === false).length, prob = GC.casi.filter((c) => c.controlli?.length).length;
  A.$('#gc-riepilogo').innerHTML = [[tot, 'casi', '', 't0'], [tot - bozze, 'visibili', 'visibile', 't2'], [bozze, 'in bozza', 'bozza', 't3'], [prob, 'con controlli da fare', 'problemi', prob ? 't5' : 't4'],
    [GC.casi.reduce((n, c) => n + (c.risposte || 0), 0), 'risposte', null, 't1']].map(([n, t, f, c]) => `<button type="button" class="acc-tile ${c}${f !== null && A.$('#gc-stato').value === f && f ? ' on' : ''}"${f === null ? ' disabled' : ` data-f="${f}"`}><b>${n}</b><small>${t}</small></button>`).join('');
  A.$('#gc-riepilogo').querySelectorAll('.acc-tile[data-f]').forEach((b) => b.onclick = () => { A.$('#gc-stato').value = A.$('#gc-stato').value === b.dataset.f ? '' : b.dataset.f; disegnaGestioneCasi(); });
  statoIAgc();
  A.qsAll('.gc-tab th[data-ord]').forEach((th) => { th.classList.toggle('ord', th.dataset.ord === GC.ord.campo); th.dataset.verso = GC.ord.verso > 0 ? '▲' : '▼'; });
  const pct = (x) => (x == null ? '' : ` · ${Math.round(x <= 1 ? x * 100 : x)}%`);
  A.$('#gc-lista').innerHTML = l.map((c) => `<tr class="${c.visibile === false ? 'off' : ''}"><td><input type="checkbox" data-id="${A.esc(c.id)}" aria-label="Seleziona ${A.esc(c.titolo_interno || c.titolo || c.id)}" ${GC.sel.has(c.id) ? 'checked' : ''}></td>
    <td class="small gc-cod">${A.esc(c.id)}</td><td><b class="gc-tit">${A.esc(c.titolo)}</b>${c.quesito ? `<div class="muted small">${A.esc(c.quesito)}</div>` : ''}</td><td><span class="met-pill gc-met met-${A.esc(A.normal(A.metodicaDi(c)).replace(/[^a-z]+/g, '-'))}">${A.esc(A.metodicaDi(c))}</span></td><td>${A.esc(c.distretto || '')}</td>
    <td class="small">${c.difficolta ? `<span class="diff diff-${A.esc(c.difficolta.toLowerCase())}">${A.esc(c.difficolta)}</span>` : ''}${c.difficoltaAuto ? ' <span class="muted" title="Calcolata dalle risposte">(auto)</span>' : ''}</td>
    <td class="small">${c.risposte ? `${c.risposte}${pct(c.media)}` : '—'}</td>
    <td class="small">${c.controlli?.length ? `<span class="badge gc-prob" title="${A.esc(c.controlli.join('\n'))}">${c.controlli.length} da fare</span><div class="muted small">${A.esc(c.controlli[0])}${c.controlli.length > 1 ? '…' : ''}</div>` : '<span class="gc-ok">✓</span>'}</td>
    <td class="small">${A.esc((c.aggiornato || '').slice(0, 10))}</td>
    <td>${c.visibile === false ? '<span class="acc-stato attesa">bozza</span>' : '<span class="acc-stato ok">visibile</span>'}</td>
    <td class="small gc-azioni"><a class="gc-az" href="#/caso/${encodeURIComponent(c.id)}" title="Apri il caso">👁 Apri</a><a class="gc-az" href="#/editor/${encodeURIComponent(c.id)}" title="Modifica domande e risposte">✎ Modifica</a><a class="gc-az" href="#/aggiungi/${encodeURIComponent(c.id)}" title="Aggiungi immagini">＋ Immagini</a></td></tr>`).join('') || '<tr><td colspan="11" class="muted">Nessun caso.</td></tr>';
  A.$('#gc-lista').querySelectorAll('input').forEach((x) => { x.onchange = () => { x.checked ? GC.sel.add(x.dataset.id) : GC.sel.delete(x.dataset.id); A.$('#gc-sel').textContent = GC.sel.size ? `${GC.sel.size} selezionati` : ''; }; });
  A.$('#gc-tutti').checked = l.length > 0 && l.every((c) => GC.sel.has(c.id));
  A.$('#gc-tutti').onchange = (e) => { l.forEach((c) => (e.target.checked ? GC.sel.add(c.id) : GC.sel.delete(c.id))); disegnaGestioneCasi(); };
  A.$('#gc-sel').textContent = GC.sel.size ? `${GC.sel.size} selezionati` : `${l.length} casi nell'elenco`;
}
async function visibilitaCasi(visibile) {
  const ids = [...GC.sel]; if (!ids.length) { A.$('#gc-msg').textContent = 'Seleziona almeno un caso.'; return; }
  let ok = 0; const err = [];
  for (const id of ids) {
    A.$('#gc-msg').textContent = `Aggiornamento ${ok + err.length + 1} / ${ids.length}…`;
    try { const c = await A.getJSON(`/api/casi/${encodeURIComponent(id)}/completo`); await A.postJSON(`/api/casi/${encodeURIComponent(id)}`, { ...c, visibile }); ok++; }
    catch (e) { if (e instanceof A.NonAutorizzato) return; err.push(`${id}: ${e.message}`); }
  }
  A.ELENCO = [];
  await apriGestioneCasi();
  A.$('#gc-msg').textContent = `${ok} ${visibile ? 'resi visibili' : 'messi in bozza'}.` + (err.length ? ' Non aggiornati: ' + err.join(' · ') : '');
}
async function apriAnalisi() {
  A.$('#an-corpo').innerHTML = '<p class="muted">Calcolo…</p>';
  [A.AN.dati, A.AN.iscritti, A.AN.classi] = await Promise.all([A.getJSON('/api/analisi'), A.getJSON('/api/specializzandi').catch(() => []), A.getJSON('/api/classi').then((l) => l.filter((c) => c.gestita)).catch(() => [])]);
  const sel = A.$('#an-classe'); const prima = sel.value;
  sel.innerHTML = '<option value="">Tutti</option>' + A.AN.classi.map((c) => `<option value="${A.esc(c.id)}">Classe: ${A.esc(c.nome)} (${(c.membri || []).length})</option>`).join('');
  sel.hidden = !A.AN.classi.length; if ([...sel.options].some((o) => o.value === prima)) sel.value = prima;
  disegnaAnalisi();
}
function disegnaAnalisi() {
  if (!A.modAnalisi.m) { A.modAnalisi().then(disegnaAnalisi).catch(() => {}); return; }
  const { calcola } = A.modAnalisi.m;
  const cl = (A.AN.classi || []).find((c) => c.id === A.$('#an-classe').value), membri = cl ? new Set((cl.membri || []).map((m) => m.id || m)) : null;
  const dati = membri ? { ...A.AN.dati, risultati: A.AN.dati.risultati.filter((r) => membri.has(r.account)) } : A.AN.dati;
  const a = calcola(dati, { primoSolo: A.$('#an-primo').checked });
  A.qsAll('[data-scheda]').forEach((b) => b.classList.toggle('on', b.dataset.scheda === A.AN.scheda));
  const vuoto = '<div class="vuoto">Ancora nessuna risposta da analizzare.</div>';
  if (A.AN.scheda === 'referti') { disegnaReferti(dati); return; }
  if (A.AN.scheda === 'esami') { disegnaEsamiDocente(membri); return; }
  if (A.AN.scheda === 'mensile') { A.disegnaMensile(); return; }
  if (A.AN.scheda === 'persone') A.$('#an-corpo').innerHTML = htmlIscritti(a) + (a.totale ? htmlPersone(a) : '');
  else A.$('#an-corpo').innerHTML = !a.totale ? vuoto : A.AN.scheda === 'casi' ? htmlCasi(a) : htmlErrori(a);
  A.qsAll('.an-persone tr.cliccabile').forEach((tr) => tr.onclick = () => {
    const d = tr.nextElementSibling; d.hidden = !d.hidden;
  });
}
function htmlCasi(a) {
  // giudizio automatico (da almeno 3 risposte): troppo facile, molto difficile o ambiguo
  const giudizioCaso = (c) => {
    if (c.n < 3) return '';
    const g = [];
    if (c.perfette >= 0.9) g.push(['facile', 'Troppo facile: quasi tutti rispondono esatto']);
    if (c.punteggio < 40) g.push(['difficile', 'Molto difficile: punteggio medio basso']);
    const d = (c.opzioni || []).filter((o) => o.tipo === 'distrattore' && o.scelta >= 0.4);
    if (d.length) g.push(['ambiguo', `Ambiguo: distrattore scelto spesso («${d[0].testo.slice(0, 40)}»)`]);
    return g.map(([k, t]) => `<span class="badge giudizio ${k}" title="${A.esc(t)}">${t.split(':')[0]}</span>`).join('');
  };
  return a.casi.filter((c) => c.n).map((c) => `<details class="an-caso">
    <summary><span class="tit"><b>${A.esc(c.titolo)}${c.visibile === false ? '<span class="badge">bozza</span>' : ''}${giudizioCaso(c)}</b><small>${A.esc([c.distretto, c.modalita].filter(Boolean).join(' · ') || c.id)}</small></span>
      <span class="kpi">Risposte<b>${c.n}</b></span><span class="kpi">Punteggio medio<b>${fn(c.punteggio)}</b></span>
      <span class="kpi">Esatte<b>${fp(c.perfette)}</b></span><span class="kpi">Tempo mediano<b>${ft(c.tempo)}</b></span>
      <span class="kpi">Reperti sec. mancati<b>${fp(c.secondariMancatiAlmenoUno)}</b></span></summary>
    <div class="an-dett">
      <div><h4>Opzioni</h4><table class="tab"><thead><tr><th>Opzione</th><th>Tipo</th><th>Scelta da</th><th>Corretti</th><th>Discriminazione</th><th>Sicurezza di chi l'ha scelta</th></tr></thead><tbody>
      ${c.opzioni.map((o) => `<tr><td>${A.esc(o.testo)}</td><td><span class="tag-tipo ${o.tipo}">${NOMI_TIPO[o.tipo]}</span></td>
        <td class="num">${fp(o.scelta)}${mini(o.scelta, o.tipo === 'distrattore' ? 'ko' : '')}</td>
        <td class="num">${fp(o.corretti)}${mini(o.corretti, o.corretti >= 0.7 ? 'ok' : o.corretti >= 0.4 ? 'warn' : 'ko')}</td>
        <td class="num">${testoD(o.discriminazione)}</td>
        <td class="small">${o.conf.sicuro + o.conf.probabile + o.conf.ipotesi ? `sicuro ${o.conf.sicuro} · probabile ${o.conf.probabile} · ipotesi ${o.conf.ipotesi}` : '<span class="muted">—</span>'}
          ${o.convinti ? `<br><b style="color:var(--ko)">${o.convinti} errore/i convinto/i</b>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      ${c.sezioni.length ? `<div><h4>Referto guidato: punteggio per distretto</h4><table class="tab"><thead><tr><th>Distretto</th><th>Punteggio medio</th></tr></thead><tbody>
        ${c.sezioni.map((z) => `<tr><td>${A.esc(z.nome)}</td><td class="num">${fn(z.punteggio)}${mini(z.punteggio == null ? null : z.punteggio / 100, z.punteggio >= 70 ? 'ok' : z.punteggio >= 40 ? 'warn' : 'ko')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${c.chiavi.length ? `<div><h4>Immagini chiave indicate</h4><table class="tab"><thead><tr><th>Studente</th><th>Punteggio</th><th>Immagini chiave (didascalia · serie · immagine · note)</th></tr></thead><tbody>
        ${c.chiavi.map((x) => `<tr><td>${A.esc(x.nome)}</td><td class="num">${x.punteggio}</td><td class="small">${A.htmlChiaviDoc(x.chiavi, c.id)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="griglia2">
        <div><h4>Reperti secondari</h4>
          <p class="small muted">Hanno trovato il reperto principale: <b>${fp(c.principaleTrovato)}</b>. Di questi, hanno perso almeno un reperto secondario: <b>${fp(c.secondariMancatiAlmenoUno)}</b>.</p>
          ${c.secondari.length ? `<table class="tab"><thead><tr><th>Reperto secondario</th><th>Mancato da</th></tr></thead><tbody>
            ${c.secondari.sort((x, y) => (y.mancato ?? -1) - (x.mancato ?? -1)).map((x) => `<tr><td>${A.esc(x.testo)}</td><td class="num">${fp(x.mancato)}${mini(x.mancato, 'warn')}</td></tr>`).join('')}</tbody></table>`
            : '<p class="muted small">Nessuna opzione segnata come «reperto secondario» in questo caso.</p>'}</div>
        <div><h4>Come hanno guardato le immagini</h4>
          <p class="small muted">Uso di MPR/3D: <b>${fp(c.usoMpr)}</b> · misure: <b>${fp(c.usoMisure)}</b> · ROI: <b>${fp(c.usoRoi)}</b> · confronto fasi: <b>${fp(c.usoConfronto)}</b></p>
          ${c.serie.length ? `<table class="tab"><thead><tr><th>Serie</th><th>Aperta da</th><th>Immagini scorse (media)</th></tr></thead><tbody>
            ${c.serie.map((x) => `<tr><td>${A.esc(x.descrizione)}</td><td class="num">${fp(x.aperta)}</td><td class="num">${fp(x.scorsa)}${mini(x.scorsa)}</td></tr>`).join('')}</tbody></table>`
            : '<p class="muted small">Dati non ancora disponibili per questo caso.</p>'}</div>
      </div>
    </div></details>`).join('') || '<div class="vuoto">Nessun caso con risposte.</div>';
}
// mappa degli errori: in quali distretti si perdono i reperti e quali distrattori ingannano di più
// ---------------- referti scritti dagli studenti: testo, confronto automatico con i reperti attesi, revisione del docente
// esami di livello degli studenti (docente): per studente e livello primo, ultimo, migliore e andamento
function collegaTurni() {
  A.qsAll('.gu-rivedi').forEach((x) => { x.onclick = (ev) => { ev.preventDefault(); A.AN.filtroReferti = { caso: '', solo: 'da' }; A.qs1('#vista-analisi .schede [data-scheda="referti"]')?.click(); }; });
}
async function disegnaEsamiDocente(membri) {
  A.$('#an-corpo').innerHTML = '<p class="muted">Carico gli esami…</p>';
  let lista = []; try { lista = await A.getJSON('/api/esami/tutti'); } catch (e) { A.$('#an-corpo').innerHTML = `<p class="stato ko">${A.esc(e.message)}</p>`; return; }
  if (membri) lista = lista.filter((e) => membri.has(e.account));
  const turni = lista.filter((e) => ['guardia', 'lista'].includes(e.livello)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const liv = lista.filter((e) => !['libero', 'pre', 'post', 'guardia', 'lista'].includes(e.livello));
  const htmlTurni = turni.length ? `<h3>Turni di guardia e liste di lavoro simulate</h3><p class="muted small">Casi misti, tempo unico, solo referto (nella lista di lavoro anche priorità e tempo di lettura di ogni caso). Segna la discrepanza di ogni referto in «Referti» (nessuna, minore, maggiore).</p>
    <table class="tab"><thead><tr><th>Studente</th><th>Data</th><th>Casi svolti</th><th>Punteggio automatico</th><th>Maggiori</th><th>Minori</th><th>Da rivedere</th></tr></thead><tbody>${turni.map((e) => `<tr><td>${A.esc(e.nome)}</td><td>${A.esc(e.data)}</td><td class="num">${e.svolti}/${e.n}</td><td class="num">${e.punteggio}%</td>
      <td class="num ${e.discrepanze?.maggiori ? 'ko' : ''}"><b>${e.discrepanze?.maggiori ?? 0}</b></td><td class="num">${e.discrepanze?.minori ?? 0}</td><td class="num">${e.discrepanze?.daRivedere ? `<a href="#" class="gu-rivedi" data-acc="${A.esc(e.account)}">${e.discrepanze.daRivedere}</a>` : '—'}</td></tr>`).join('')}</tbody></table>` : '';
  if (!liv.length) { A.$('#an-corpo').innerHTML = htmlTurni + '<div class="vuoto">Nessun esame di livello svolto. Gli studenti li trovano in «Esame simulato» → «Esame di livello»: 10 casi, 3 minuti a caso, regole sempre uguali.</div>'; collegaTurni(); return; }
  const per = {}; for (const e of liv) ((per[e.account] ||= { nome: e.nome, l: {} }).l[e.livello] ||= []).push(e);
  const col = (p) => (p >= 75 ? 'var(--ok)' : p >= 50 ? 'var(--warn)' : 'var(--ko)');
  const dt = (d) => String(d || '').slice(0, 10).split('-').reverse().join('/');
  const righe = Object.values(per).sort((a, b) => a.nome.localeCompare(b.nome, 'it')).flatMap((s) => Object.entries(s.l).map(([l, v]) => {
    const pts = v.map((e) => e.punteggio), d = pts[pts.length - 1] - pts[0];
    return `<tr><td>${A.esc(s.nome)}</td><td>${A.esc(l)}</td><td class="num">${v.length}</td><td>${pts[0]}% <small class="muted">${dt(v[0].data)}</small></td>
      <td style="color:${col(pts[pts.length - 1])};font-weight:600">${pts[pts.length - 1]}% <small class="muted">${dt(v[v.length - 1].data)}</small></td><td class="num">${Math.max(...pts)}%</td>
      <td>${v.length > 1 ? `${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '= '}${d} punti` : '—'}</td><td class="small muted">${v.map((e) => `${e.punteggio}%`).join(' → ')}</td></tr>`; }));
  const media = (l) => { const v = liv.filter((e) => e.livello === l).map((e) => e.punteggio); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  A.$('#an-corpo').innerHTML = `<p class="muted small">Esami di livello: ${A.ESAME_N} casi di tutte le metodiche, ${A.ESAME_MIN} minuti a caso; il punteggio è ricalcolato dal server dalle risposte salvate. Media per livello: ${Object.keys(A.LIVELLI_ESAME).map((l) => media(l) != null ? `${l} ${media(l)}%` : '').filter(Boolean).join(' · ')}.</p>
    <table class="tab an-esami"><thead><tr><th>Studente</th><th>Livello</th><th>Esami</th><th>Primo</th><th>Ultimo</th><th>Migliore</th><th>Andamento</th><th>Tutti i punteggi</th></tr></thead><tbody>${righe.join('')}</tbody></table>
    <p><button class="ghost" id="an-esami-csv">Esporta CSV</button></p>${htmlTurni}`;
  A.$('#an-esami-csv').onclick = () => {
    const csv = [['studente', 'livello', 'data', 'punteggio', 'casi', 'svolti', 'perfetti', 'durata_min'].join(';'), ...liv.map((e) => [e.nome, e.livello, e.data, e.punteggio, e.n, e.svolti, e.perfetti, Math.round((e.durata_s || 0) / 60)].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'esami-di-livello.csv'; a.click();
  };
  collegaTurni();
}
async function disegnaReferti(dati) {
  // scale compilate dagli studenti, con i loro disegni (1.263): il modulo delle scale si carica solo se serve
  const SC = (dati?.risultati || []).some((r) => r?.dettagli?.scale?.length) ? await A.caricaScale().catch(() => null) : null;
  const casi = Object.fromEntries((dati.casi || []).map((c) => [c.id, c]));
  const filtro = A.AN.filtroReferti || { caso: '', solo: 'tutti' };
  let righe = (dati.risultati || []).filter((r) => (r.dettagli?.referto || '').trim()).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const casiCon = [...new Set(righe.map((r) => r.caso))];
  if (filtro.caso) righe = righe.filter((r) => r.caso === filtro.caso);
  if (filtro.solo === 'da') righe = righe.filter((r) => !r.dettagli?.revisione);
  if (filtro.solo === 'fatti') righe = righe.filter((r) => r.dettagli?.revisione);
  const lista = (t, l, cls) => (l?.length ? `<div class="ref-lista ${cls}"><b>${t}</b><ul>${l.map((x) => `<li>${A.esc(x)}</li>`).join('')}</ul></div>` : '');
  A.$('#an-corpo').innerHTML = `<div class="ref-filtri">
      <select id="ref-caso"><option value="">Tutti i casi (${casiCon.length})</option>${casiCon.map((id) => `<option value="${A.esc(id)}"${id === filtro.caso ? ' selected' : ''}>${A.esc(casi[id]?.titolo || id)}</option>`).join('')}</select>
      <select id="ref-solo"><option value="tutti">Tutti i referti</option><option value="da"${filtro.solo === 'da' ? ' selected' : ''}>Da rivedere</option><option value="fatti"${filtro.solo === 'fatti' ? ' selected' : ''}>Già rivisti</option></select>
      <span class="muted small">${righe.length} referti · il punteggio automatico confronta le parole chiave con i reperti attesi: controllalo e, se serve, dai il tuo voto</span></div>`
    + (righe.length ? righe.map((r) => {
      const c = casi[r.caso] || {}, v = r.dettagli?.valutazione, rev = r.dettagli?.revisione, soloRef = r.dettagli?.modo === 'referto';
      return `<div class="ref-card" data-id="${A.esc(r.id || '')}">
        <div class="ref-testa"><b>${A.esc(r.nome || 'anonimo')}</b><span>${A.esc(c.titolo || r.caso)}</span><span class="muted small">${A.esc(String(r.data || ''))}${r.tentativo > 1 ? ` · tentativo ${r.tentativo}` : ''} · ${soloRef ? 'solo referto' : 'referto facoltativo, risposte a scelta'}</span>
          <span class="ref-punti" title="${soloRef ? 'Punteggio della risposta (dal referto)' : 'Punteggio della risposta a scelta'}">${r.punteggio}%</span></div>
        <div class="ref-corpo"><div class="ref-testo">${A.esc(r.dettagli.referto).replace(/\n/g, '<br>')}${A.htmlChecklistDoc(r.dettagli?.checklist)}${SC && r.dettagli?.scale?.length ? `<div class="ref-scale small"><b>Σ Scale compilate</b>${SC.htmlScaleStudente(r.dettagli.scale)}</div>` : ''}${r.dettagli?.chiavi?.length ? `<div class="ref-chiavi small"><b>📸 Immagini chiave</b>${A.htmlChiaviDoc(r.dettagli.chiavi, r.caso)}</div>` : ''}</div>
          <div class="ref-auto">${v ? `<div class="small">Confronto automatico: <b>${v.punteggio}%</b> · reperti ritrovati ${v.citati}/${v.attesi}</div>${lista('Reperti attesi non ritrovati', v.mancati, 'ko')}${lista('Affermazioni sbagliate scritte come presenti', v.errori, 'ko')}` : '<div class="muted small">Nessun confronto automatico (risposta precedente alla versione 1.55).</div>'}
            <div class="ref-rev"><label>Discrepanza <select class="ref-disc"><option value="">—</option>${['nessuna', 'minore', 'maggiore'].map((d) => `<option value="${d}"${rev?.discrepanza === d ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
              <label>Voto del docente <input type="number" min="0" max="100" step="5" class="ref-voto" value="${rev?.voto ?? ''}" placeholder="0-100"></label>
              <textarea class="ref-comm" rows="3" maxlength="2000" placeholder="Commento per lo studente (lo vede nel suo storico)">${A.esc(rev?.commento || '')}</textarea>
              <div><button class="ref-salva">Salva la revisione</button> <button class="ghost ref-annota" title="Doppia lettura: apre il caso per disegnare frecce con nota e misure sulle immagini; lo studente le ritrova nel caso">Annota sulle immagini${rev?.annotazioni?.length ? ` (${rev.annotazioni.length})` : ''}</button> <span class="ref-stato muted small">${rev ? `Rivisto da ${A.esc(rev.docente || '')} il ${A.esc(rev.data || '')}` : ''}</span></div></div></div></div></div>`;
    }).join('') : '<div class="vuoto">Nessun referto scritto dagli studenti con questi filtri.</div>');
  A.$('#ref-caso').onchange = (e) => { A.AN.filtroReferti = { ...filtro, caso: e.target.value }; disegnaReferti(dati); };
  A.$('#ref-solo').onchange = (e) => { A.AN.filtroReferti = { ...filtro, solo: e.target.value }; disegnaReferti(dati); };
  A.qsAll('.ref-card .ref-annota').forEach((b) => { b.onclick = () => {
    const card = b.closest('.ref-card'), r = righe.find((x) => x.id === card.dataset.id); if (!r) return;
    const voto = card.querySelector('.ref-voto').value;
    A.scriviSessione('quiz-annota', { id: r.id, caso: r.caso, nome: r.nome, voto: voto === '' ? null : +voto, commento: card.querySelector('.ref-comm').value, annotazioni: r.dettagli?.revisione?.annotazioni || [] });
    location.hash = `#/caso/${encodeURIComponent(r.caso)}`;
  }; });
  A.qsAll('.ref-card .ref-salva').forEach((b) => { b.onclick = async () => {
    const card = b.closest('.ref-card'), id = card.dataset.id, st = card.querySelector('.ref-stato');
    const voto = card.querySelector('.ref-voto').value, commento = card.querySelector('.ref-comm').value, discrepanza = card.querySelector('.ref-disc').value || null;
    b.disabled = true; st.textContent = 'Salvo…';
    try {
      const r = await fetch('/api/referti/revisione', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, voto: voto === '' ? null : +voto, commento, discrepanza }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.errore || r.status);
      const riga = A.AN.dati.risultati.find((x) => x.id === id); if (riga) riga.dettagli = { ...riga.dettagli, revisione: j.revisione || undefined };
      st.textContent = j.revisione ? `Salvato: lo studente lo vede nel suo storico` : 'Revisione tolta';
    } catch (e) { st.textContent = 'Non salvato: ' + e.message; }
    finally { b.disabled = false; }
  }; });
}
function htmlErrori(a) {
  const e = a.errori, col = (x) => (x == null ? '' : x >= 0.5 ? 'ko' : x >= 0.25 ? 'warn' : 'ok');
  return `<p class="small muted">Per ogni distretto (quello del referto guidato, se il caso lo usa, altrimenti il distretto del caso): quanti reperti corretti non vengono indicati e quanti distrattori vengono scelti. In alto i distretti con più errori.</p>
    <table class="tab"><thead><tr><th>Distretto</th><th>Studenti</th><th>Reperti non indicati</th><th>Distrattori scelti</th><th>Errori «sicuro»</th></tr></thead><tbody>
    ${e.aree.map((x) => `<tr><td><b>${A.esc(x.area)}</b></td><td class="num">${x.persone}</td>
      <td class="num">${fp(x.mancati)} <span class="muted small">(${x.reperti})</span>${mini(x.mancati, col(x.mancati))}</td>
      <td class="num">${fp(x.scelti)} <span class="muted small">(${x.distrattori})</span>${mini(x.scelti, col(x.scelti))}</td>
      <td class="num">${x.convinti || '—'}</td></tr>`).join('')}</tbody></table>
    <h4>Reperti mancati più spesso</h4>
    ${e.mancati?.length ? `<table class="tab"><thead><tr><th>Reperto (corretto, non indicato)</th><th>Tipo</th><th>Caso</th><th>Distretto</th><th>Mancato da</th></tr></thead><tbody>
      ${e.mancati.map((d) => `<tr><td>${A.esc(d.testo)}</td><td><span class="tag-tipo ${d.tipo}">${NOMI_TIPO[d.tipo] || ''}</span></td><td><a href="#/caso/${encodeURIComponent(d.caso)}">${A.esc(d.titolo)}</a></td><td>${A.esc(d.area)}</td>
        <td class="num">${d.mancati}/${d.n}${mini(d.frazione, d.frazione >= 0.5 ? 'ko' : 'warn')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Nessun reperto mancato finora.</p>'}
    <h4>Distrattori più scelti</h4>
    ${e.distrattori.length ? `<table class="tab"><thead><tr><th>Distrattore</th><th>Caso</th><th>Distretto</th><th>Scelto da</th></tr></thead><tbody>
      ${e.distrattori.map((d) => `<tr><td>${A.esc(d.testo)}</td><td><a href="#/caso/${encodeURIComponent(d.caso)}">${A.esc(d.titolo)}</a></td><td>${A.esc(d.area)}</td>
        <td class="num">${d.scelti}/${d.n}${mini(d.frazione, 'ko')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Nessun distrattore scelto finora.</p>'}`;
}
// chi ha scelto il docente come riferimento, anche senza risposte (l'amministratore vede tutti)
function htmlIscritti(a) {
  const l = A.AN.iscritti || [];
  if (A.ADMIN) return '';
  if (!l.length && A.AZIENDA()) return '<div class="vuoto">Non hai ancora studenti: li assegna l\'amministratore della piattaforma (Gestione → Iscritti e docenti), oppure ti scelgono gli specializzandi dal loro profilo.</div>';
  if (!l.length) return `<div class="vuoto">Nessuno ti ha ancora scelto come docente di riferimento. Gli iscritti ti scelgono dal loro profilo:
    puoi far conoscere la pagina di iscrizione <b>${A.esc(location.origin)}/#/iscriviti</b>.</div>`;
  const casi = Object.fromEntries((a.persone || []).map((p) => [p.nome, p]));
  return `<h3>Ti hanno scelto come docente (${l.length})</h3><table class="tab"><thead><tr><th>Nome</th><th>Chi è</th><th>Sede</th><th>Casi svolti</th><th>Punteggio medio</th><th>Avvisi email</th></tr></thead><tbody>
    ${l.map((x) => { const p = casi[x.nome]; return `<tr><td><b>${A.esc(x.nome)}</b></td><td>${A.esc(x.categoria || '—')}${x.anno ? ` · ${A.esc(x.anno)}° anno` : ''}</td><td>${A.esc(x.sede || '—')}</td>
      <td class="num">${p ? p.n : 0}</td><td class="num">${p ? fn(p.punteggio) : '—'}</td><td>${x.email ? 'sì' : 'no'}</td></tr>`; }).join('')}</tbody></table>
    ${a.totale ? '<h3>Dettaglio dei risultati</h3>' : ''}`;
}
function htmlPersone(a) {
  const cal = (c) => (c.n ? `${fp(c.corrette)} <span class="muted small">(${c.n})</span>` : '<span class="muted">—</span>');
  return `<table class="tab an-persone"><thead><tr><th>Studente</th><th>Casi</th><th>Punteggio medio</th><th>Andamento</th><th>Sec. trovati</th>
    <th title="Quanto spesso è corretta una scelta dichiarata…">Corrette se «sicuro»</th><th>se «probabile»</th><th>se «ipotesi»</th><th>Errori convinti</th><th>Tempo</th><th>MPR</th></tr></thead><tbody>
    ${a.persone.map((p) => `<tr class="cliccabile"><td><b>${A.esc(p.nome)}</b><br><span class="small muted">ultimo: ${A.esc(p.ultimo)}</span></td>
      <td class="num">${p.n}</td><td class="num">${fn(p.punteggio)}${mini(p.punteggio == null ? null : p.punteggio / 100)}</td><td>${spark(p.curva)}</td>
      <td class="num">${fp(p.secondariTrovati)}</td><td class="num">${cal(p.calibrazione.sicuro)}</td><td class="num">${cal(p.calibrazione.probabile)}</td>
      <td class="num">${cal(p.calibrazione.ipotesi)}</td><td class="num">${p.distrattoriConvinti || '—'}</td><td class="num">${ft(p.tempo)}</td><td class="num">${fp(p.usoMpr)}</td></tr>
      <tr class="an-persona-dett" hidden><td colspan="11"><div class="griglia2">
        <div><h4>Per area</h4><table class="tab"><thead><tr><th>Area</th><th>Casi</th><th>Punteggio</th></tr></thead><tbody>
          ${p.aree.map((x) => `<tr><td>${A.esc(x.area)}</td><td class="num">${x.n}</td><td class="num">${fn(x.punteggio)}${mini(x.punteggio / 100, x.punteggio >= 70 ? 'ok' : x.punteggio >= 40 ? 'warn' : 'ko')}</td></tr>`).join('')}</tbody></table></div>
        <div><h4>Casi svolti</h4><table class="tab"><thead><tr><th>Data</th><th>Caso</th><th>Punteggio</th></tr></thead><tbody>
          ${p.curva.slice().reverse().map((x) => `<tr><td>${A.esc(x.data)}</td><td>${A.esc((A.AN.dati.casi.find((c) => c.id === x.caso) || {}).titolo || x.caso)}</td><td class="num">${x.punteggio}</td></tr>`).join('')}</tbody></table></div>
      </div></td></tr>`).join('')}</tbody></table>`;
}
// ---------------------------------------------------------------- cruscotto (1.273): amministratore e docente
// Una pagina con i numeri chiave e l'elenco di ciò che richiede attenzione, ognuno con il collegamento alla pagina dove
// si risolve. Solo dati che il server già fornisce (riepilogo mensile, classi, analisi, proposte; per l'amministratore
// statistiche, traffico, account e piattaforme): nessuna rotta nuova, nessun dato nuovo salvato.
const crNum = (v) => (v == null ? '—' : Number(v).toLocaleString('it-IT'));
const crGiorno = (s) => { const d = new Date(String(s).replace(' ', 'T') + (String(s).length <= 10 ? 'T12:00' : '')); return isNaN(d) ? '' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }); };
function crTile(v, t, c, href) {
  const dentro = `<div class="v">${v}</div><small>${A.esc(t)}</small>`;
  return href ? `<a class="tr-tile cr-tile" style="--c:${c}" href="${href}">${dentro}</a>` : `<div class="tr-tile" style="--c:${c}">${dentro}</div>`;
}
// andamento giornaliero (30 giorni): una linea, senza assi
function crLinea(val, colore) {
  const w = 320, h = 60, max = Math.max(1, ...val), x = (i) => (i * w) / Math.max(1, val.length - 1), y = (v) => h - 4 - (v / max) * (h - 8);
  return `<svg class="cr-linea" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Andamento degli ultimi ${val.length} giorni"><polyline fill="none" stroke="${colore}" stroke-width="2" points="${val.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/></svg>`;
}
async function apriCruscotto() {
  const box = A.$('#cr-corpo'); box.innerHTML = '<p class="muted">Caricamento…</p>';
  A.$('#cr-aggiorna').onclick = () => apriCruscotto();
  A.$('#cr-titolo').textContent = A.ADMIN ? 'Cruscotto dell\'amministratore' : 'Cruscotto del docente';
  A.$('#cr-sotto').textContent = A.ADMIN ? 'Cosa richiede attenzione sulla piattaforma: studenti, compiti, referti, casi, iscritti e consumi dei server.'
    : 'I tuoi studenti, i compiti e i referti da rivedere in un colpo d\'occhio.';
  const prendi = (u) => A.getJSON(u).catch((e) => { if (e instanceof A.NonAutorizzato) throw e; return null; });
  const [rm, classi, an, prop, st, tr, acc] = await Promise.all([prendi('/api/riepilogo-mensile'), prendi('/api/classi'), prendi('/api/analisi'),
    A.AUTORE ? prendi('/api/proposte') : null, A.ADMIN ? prendi('/api/statistiche') : null, A.ADMIN ? prendi('/api/statistiche/traffico/30') : null,
    A.ADMIN ? prendi('/api/account') : null]);
  const oggi = new Date().toISOString().slice(0, 10), fra7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  // studenti (riepilogo degli ultimi 30 giorni)
  const persone = rm?.persone || [], attivi = persone.filter((p) => !p.fermo), conMedia = attivi.filter((p) => p.media != null);
  const media = conMedia.length ? Math.round(conMedia.reduce((t, p) => t + p.media, 0) / conMedia.length) : null;
  const risposte = persone.reduce((t, p) => t + p.risposte, 0);
  // compiti: in scadenza nei prossimi 7 giorni e scaduti da poco con lavoro incompleto
  const compiti = [];
  for (const c of (classi || []).filter((x) => x.gestita)) for (const k of c.compiti || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k.scadenza || '') || k.scadenza > fra7) continue;
    const s = Array.isArray(k.stato) ? k.stato : [], fatti = s.filter((x) => x.totale && x.fatti >= x.totale).length;
    if (k.scadenza < oggi && (!s.length || fatti === s.length)) continue;
    if (k.scadenza < new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)) continue;
    compiti.push({ classe: c.nome, nome: k.titolo || 'Compito', scadenza: k.scadenza, fatti, membri: s.length, scaduto: k.scadenza < oggi });
  }
  compiti.sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  // referti scritti dagli studenti e non ancora rivisti (voto o commento del docente)
  const referti = (an?.risultati || []).filter((r) => String(r.dettagli?.referto || '').trim() && !r.dettagli?.revisione);
  // casi: bozze e proposte in attesa (autori)
  const bozze = (an?.casi || []).filter((c) => !c.visibile), proposte = (prop || []).filter((p) => p.stato === 'in attesa');
  const daFare = [];
  const voce = (n, testo, href, tipo = '') => { if (n) daFare.push(`<li class="${tipo}"><a href="${href}"><b>${crNum(n)}</b> ${A.esc(testo)}</a></li>`); };
  voce(referti.length, referti.length === 1 ? 'referto da rivedere' : 'referti da rivedere', '#/analisi/referti');
  voce(compiti.filter((c) => c.scaduto && c.fatti < c.membri).length, 'compiti scaduti non completati da tutti', '#/classi', 'ko');
  voce(compiti.filter((c) => !c.scaduto).length, 'compiti in scadenza nei prossimi 7 giorni', '#/classi');
  voce(rm?.fermi?.length, 'studenti senza attività negli ultimi 30 giorni', '#/analisi/persone');
  if (A.AUTORE) { voce(proposte.length, proposte.length === 1 ? 'caso proposto da valutare' : 'casi proposti da valutare', '#/revisione'); voce(bozze.length, 'casi in bozza (non visibili agli studenti)', '#/revisione'); }
  voce(rm?.difficili?.length, 'casi molto difficili (media ≤ 35%): controlla domande e distrattori', '#/analisi/mensile');
  voce(rm?.facili?.length, 'casi molto facili (media ≥ 90%)', '#/analisi/mensile');
  let attesa = [], aws = null;
  if (A.ADMIN) {
    attesa = (acc || []).filter((a) => !a.confermato || a.invitoInAttesa);
    voce(attesa.length, 'iscrizioni o inviti non ancora confermati', '#/account');
    aws = crConsumi(tr?.aws);
    if (aws && aws.max >= 0.85) daFare.push(`<li class="ko"><a href="#/statistiche"><b>${Math.round(aws.max * 100)}%</b> della soglia gratuita AWS più vicina a fine mese (${A.esc(aws.nome)})</a></li>`);
  }
  let h = '<div class="tr-tiles">';
  if (A.ADMIN && st) h += crTile(crNum(st.iscritti?.totale), 'iscritti', 'var(--acc)', '#/account') + crTile(crNum(st.iscritti?.attivi30), 'attivi negli ultimi 30 giorni', 'var(--ok)', '#/statistiche')
    + crTile(crNum(st.risposte?.ultimi30), 'risposte negli ultimi 30 giorni', '#38c6d9', '#/analisi');
  else h += crTile(crNum(persone.length), 'studenti seguiti', 'var(--acc)', '#/analisi/persone') + crTile(crNum(attivi.length), 'attivi negli ultimi 30 giorni', 'var(--ok)', '#/analisi/persone')
    + crTile(crNum(risposte), 'risposte negli ultimi 30 giorni', '#38c6d9', '#/analisi');
  h += crTile(media == null ? '—' : media + '%', 'punteggio medio nel mese', 'var(--warn)', '#/analisi/mensile')
    + crTile(crNum(referti.length), 'referti da rivedere', '#ff8fb1', '#/analisi/referti') + crTile(crNum(compiti.filter((c) => !c.scaduto).length), 'compiti in scadenza (7 giorni)', '#9b8cff', '#/classi');
  h += '</div>';
  h += `<section class="dash-card cr-da-fare"><div class="tr-testa"><span class="dash-ico" aria-hidden="true">✅</span><h2>Da fare</h2></div>
    ${daFare.length ? `<ul class="cr-lista">${daFare.join('')}</ul>` : '<p class="muted">Niente che richieda attenzione adesso. 🎉</p>'}</section>`;
  const riq = [];
  if (compiti.length) riq.push(`<div class="tr-box"><h3>Compiti vicini alla scadenza</h3><ul class="cr-righe">${compiti.slice(0, 8).map((c) => `<li><span>${A.esc(c.nome)} <small class="muted">${A.esc(c.classe)}</small></span><span class="${c.scaduto ? 'ko' : ''}">${c.scaduto ? 'scaduto il' : 'entro il'} ${A.esc(crGiorno(c.scadenza))} · ${c.fatti}/${c.membri} completati</span></li>`).join('')}</ul></div>`);
  if (rm?.fermi?.length) riq.push(`<div class="tr-box"><h3>Studenti fermi da 30 giorni</h3><ul class="cr-righe">${rm.fermi.slice(0, 8).map((p) => `<li><span>${A.esc(p.nome)}</span><span class="muted">${p.ultima ? 'ultima risposta il ' + A.esc(crGiorno(p.ultima)) : 'mai risposto'}</span></li>`).join('')}</ul>${rm.fermi.length > 8 ? `<p class="muted small">e altri ${rm.fermi.length - 8}</p>` : ''}</div>`);
  if (rm?.temi?.length) riq.push(`<div class="tr-box"><h3>Temi più sbagliati nel mese</h3><ul class="cr-righe">${rm.temi.slice(0, 6).map((t) => `<li><span>${A.esc(t.nome)}${t.zona ? ` <small class="muted">${A.esc(t.zona)}</small>` : ''}</span><span>${t.errori} errori su ${t.prove} (${t.perc}%)</span></li>`).join('')}</ul></div>`);
  if (referti.length) riq.push(`<div class="tr-box"><h3>Ultimi referti da rivedere</h3><ul class="cr-righe">${referti.slice(-6).reverse().map((r) => `<li><span>${A.esc(r.nome || '')} <small class="muted">${A.esc((an.casi.find((c) => c.id === r.caso) || {}).titolo || r.caso)}</small></span><span class="muted">${A.esc(crGiorno(r.data))}</span></li>`).join('')}</ul><p><a href="#/analisi/referti">Rivedi i referti →</a></p></div>`);
  if (A.ADMIN && tr?.giorni?.length) riq.push(`<div class="tr-box"><h3>Persone attive al giorno (30 giorni)</h3>${crLinea(tr.giorni.map((g) => g.utenti || 0), 'var(--ok)')}<p class="muted small">Pagine viste: ${crNum(tr.giorni.reduce((t, g) => t + (g.pagine || 0), 0))} · nuovi iscritti: ${crNum(tr.giorni.reduce((t, g) => t + (g.iscrizioni || 0), 0))}</p></div>`);
  if (A.ADMIN && aws) riq.push(`<div class="tr-box"><h3>Consumi dei server a fine mese (stima)</h3><p>${Math.round(aws.max * 100)}% della soglia gratuita più vicina (${A.esc(aws.nome)})</p><div class="cr-barra"><i style="width:${Math.min(100, Math.round(aws.max * 100))}%;background:${aws.max >= 0.85 ? 'var(--ko)' : aws.max >= 0.6 ? 'var(--warn)' : 'var(--ok)'}"></i></div><p><a href="#/statistiche">Dettagli →</a></p></div>`);
  if (riq.length) h += `<div class="cr-griglia">${riq.join('')}</div>`;
  if (A.ADMIN && !A.AZIENDA()) h += '<div id="cr-tenant"></div>';
  h += `<p class="tr-nota">Aggiornato alle ${A.esc(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))}. Studenti, temi e casi: ultimi 30 giorni${A.ADMIN ? ', tutti gli iscritti' : ', i tuoi studenti e le tue classi'}.</p>`;
  box.innerHTML = h;
  // piattaforme dei clienti: la risposta arriva dopo (controlla che ognuna sia raggiungibile)
  if (A.ADMIN && !A.AZIENDA()) prendi('/api/tenant').then((l) => {
    const el = A.$('#cr-tenant'); if (!el || !Array.isArray(l) || !l.length) return;
    const male = l.filter((t) => t.stato === 'errore' || t.online === false), sca = l.filter((t) => t.scadenza && t.scadenza <= fra7 && t.scadenza >= oggi);
    el.innerHTML = `<section class="dash-card"><div class="tr-testa"><span class="dash-ico" aria-hidden="true">🏥</span><h2>Piattaforme dei clienti</h2></div>
      <p>${crNum(l.length)} piattaforme${male.length ? ` · <b class="ko">${male.length} con errore o non raggiungibili</b>` : ' · tutte raggiungibili'}${sca.length ? ` · ${sca.length} in scadenza entro 7 giorni` : ''} · <a href="#/tenant">Gestisci →</a></p></section>`;
  }).catch(() => {});
}
// stima dei consumi AWS a fine mese rispetto alle soglie gratuite (come la dashboard dell'amministratore)
function crConsumi(a) {
  if (!a || a.errore) return null;
  const S = { richieste: 10e6, byte: 1e12, invocazioni: 1e6, gbs: 4e5 }, oggi = new Date(), mese = oggi.toISOString().slice(0, 7), gm = oggi.getUTCDate();
  const dm = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() + 1, 0)).getUTCDate();
  const somma = (k, f = (v) => v) => (a[k] || []).filter(([g]) => g.startsWith(mese)).reduce((t, [, v]) => t + f(v), 0);
  const l = [['richieste CloudFront', somma('richieste') / S.richieste], ['dati trasferiti', somma('byte') / S.byte], ['chiamate all\'API', somma('invocazioni') / S.invocazioni],
    ['calcolo Lambda', somma('durata', (ms) => (ms / 1000) * ((a.memoriaMB || 128) / 1024)) / S.gbs]].map(([n, f]) => [n, (f * dm) / gm]).sort((x, y) => y[1] - x[1]);
  return { nome: l[0][0], max: l[0][1] };
}
// istruzioni che app.js eseguiva al caricamento (pulsanti e moduli di queste pagine): ora una volta, al primo uso
// ---------------------------------------------------------------- vetrino dal pannello (1.326)
// Il vetrino si pulisce nel browser con le stesse regole dello script del Mac (vetrino-tiff.js = prepara_vetrino.py):
// zone di etichetta, panoramica e miniature azzerate, testi dello scanner riscritti con la stessa lunghezza; la copia
// pulita è un Blob fatto di pezzi dell'originale (nessuna copia in memoria) e si ricontrolla prima dell'invio. Sul
// server lo stesso controllo, sul file caricato: se non passa il vetrino è cancellato e non entra nel caso.
const MAX_VT = 4 * 2 ** 30, EST_VT_PANN = /\.(svs|tiff?|ndpi|scn|bif)$/i;
const gb = (n) => (n >= 2 ** 30 ? `${(n / 2 ** 30).toFixed(2).replace('.', ',')} GB` : `${Math.max(1, Math.round(n / 2 ** 20))} MB`);
function mettiImmagine(box, cv) { box.replaceChildren(); if (cv) { cv.className = 'nc-vt-cv'; box.append(cv); } else box.innerHTML = '<span class="muted small">non presente</span>'; }
async function esaminaVetrino(f) {
  if (NC.occupato || !f) return;
  const esame = A.$('#nc-vt-esame'); esame.hidden = true; NC.vt = null;
  if (!EST_VT_PANN.test(f.name)) { stato('Formato non accettato qui: carica un file .svs, .tif, .tiff, .ndpi, .scn o .bif. Gli altri formati (MRXS, VSI, CZI, iSyntax) per ora passano dal Mac.', 'errore'); return; }
  if (f.size > MAX_VT) { stato(`Il vetrino è di ${gb(f.size)}: il limite è 4 GB.`, 'errore'); return; }
  NC.occupato = true;
  try {
    stato(`Leggo il vetrino «${A.esc(f.name)}» (${gb(f.size)})…`);
    const T = await import('./vetrino-tiff.js'), piano = await T.pianoPulizia(T.lettoreBlob(f));
    const { anteprimeVetrino } = await import('./vetrini.js'), ap = await anteprimeVetrino([f]).catch(() => null);
    mettiImmagine(A.$('#nc-vt-mini'), ap?.miniatura); mettiImmagine(A.$('#nc-vt-etich'), ap?.etichetta); mettiImmagine(A.$('#nc-vt-pano'), ap?.panoramica);
    A.$('#nc-vt-etich-box').hidden = !ap?.etichetta; A.$('#nc-vt-pano-box').hidden = !ap?.panoramica;
    const vari = piano.testi.length;
    A.$('#nc-vt-riassunto').innerHTML = [
      `${A.esc(ap?.formato || 'TIFF')}${ap ? `, ${ap.W.toLocaleString('it-IT')} × ${ap.H.toLocaleString('it-IT')} pixel` : ''}${ap?.um ? `, ${ap.um.toFixed(3).replace('.', ',')} µm per pixel` : ''}: ${piano.livelli === 1 ? 'il livello della piramide resta com\'era' : `${piano.livelli} livelli della piramide restano com'erano`}`,
      `${piano.accessorie ? `${piano.accessorie} ${piano.accessorie === 1 ? 'immagine accessoria azzerata' : 'immagini accessorie azzerate'} (etichetta, panoramica, miniature)` : 'nessuna immagine accessoria da togliere'}`,
      `${vari ? `${vari} ${vari === 1 ? 'testo' : 'testi'} della scansione ripuliti (data e ora, operatore, nome del file, codici, numero di serie dello scanner)` : 'nessun testo della scansione da ripulire'}`,
    ].map((x) => `<li>${x}</li>`).join('');
    A.$('#nc-vt-descr').value = ''; A.$('#nc-vt-controllo').checked = false;
    NC.vt = { f, piano }; esame.hidden = false;
    A.$('#nc-stato').hidden = true;
    esame.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { stato(`Vetrino non leggibile: ${A.esc(e.message)}.`, 'errore'); }
  finally { NC.occupato = false; }
}
// PUT con avanzamento (fetch non lo dice per l'invio)
const inviaConAvanzamento = (url, corpo, avanza) => new Promise((ok, ko) => {
  const x = new XMLHttpRequest(); x.open('PUT', url); x.setRequestHeader('Content-Type', 'application/octet-stream');
  x.upload.onprogress = (e) => { if (e.lengthComputable) avanza(e.loaded, e.total); };
  x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : ko(new Error(`HTTP ${x.status}`))); x.onerror = () => ko(new Error('connessione interrotta'));
  x.send(corpo);
});
async function caricaVetrino() {
  if (NC.occupato || !NC.vt) return;
  const id = NC.aggiungiA, descr = A.$('#nc-vt-descr').value.trim();
  if (!id) return;
  if (descr.length < 3) { stato('Scrivi una breve descrizione del vetrino (campione e colorazione).', 'errore'); A.$('#nc-vt-descr').focus(); return; }
  if (!A.$('#nc-vt-controllo').checked) { stato('Prima di caricare conferma di aver guardato l\'immagine del tessuto (casella sopra il pulsante).', 'errore'); A.$('#nc-vt-controllo').focus(); return; }
  NC.occupato = true; const btn = A.$('#nc-vt-carica'); btn.disabled = true;
  try {
    const T = await import('./vetrino-tiff.js'), { f, piano } = NC.vt;
    stato('Pulisco il vetrino e ricontrollo la copia…');
    const pulito = T.copiaPulita(f, piano), prob = await T.problemi(T.lettoreBlob(pulito));
    if (prob.length) throw new Error(`nella copia resta ${prob.slice(0, 3).join('; ')}. Caricamento non fatto: usa lo script del Mac`);
    const est = (f.name.match(EST_VT_PANN) || ['.svs'])[0].toLowerCase(), rel = `serie/vetrino_p${Date.now().toString(36)}/vetrino${est}`;
    const r = await A.getJSON(`/api/casi/${encodeURIComponent(id)}/caricamento`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [rel], aggiunta: true }) });
    const t0 = Date.now();
    await inviaConAvanzamento(r.urls[rel], pulito, (fatti, tot) => {
      const sec = (Date.now() - t0) / 1000, resto = fatti ? sec / fatti * (tot - fatti) : 0;
      stato(`Caricamento del vetrino pulito: <b>${gb(fatti)} / ${gb(tot)}</b>${fatti < tot && sec > 3 ? ` · circa ${Math.max(1, Math.ceil(resto / 60))} min rimanenti` : ''}${A.barra(fatti / tot)}<p class="small muted">Non chiudere questa pagina fino alla fine.</p>`);
    });
    stato('Il server ricontrolla il vetrino…');
    await A.getJSON(`/api/casi/${encodeURIComponent(id)}/immagini`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aggiungi: [{ tipo: 'vetrino', descrizione: descr, files: [rel] }] }) });
    A.$('#nc-vt-esame').hidden = true; A.$('#nc-vt-file').value = ''; NC.vt = null;
    stato(`Vetrino aggiunto al caso ${A.esc(id)} (${gb(pulito.size)}), senza etichetta, panoramica e dati della scansione. <a href="#/caso/${encodeURIComponent(id)}">Apri il caso</a> · per la domanda sul vetrino e la scheda usa ✎ Modifica.`, 'ok');
  } catch (e) { if (!(e instanceof A.NonAutorizzato)) stato(`Vetrino non caricato: ${A.esc(e.message)}`, 'errore'); }
  finally { NC.occupato = false; btn.disabled = false; }
}

export function avvio() {
  NC = { file: [], serie: [], vietate: new Set(), sale: '', occupato: false };
  zona = A.$('#nc-zona');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('sopra'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('sopra'));
  zona.addEventListener('drop', async (e) => {
    e.preventDefault(); zona.classList.remove('sopra');
    const voci = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const files = []; for (const v of voci) await leggiVoce(v, files);
    const tutti = files.length ? files : [...e.dataTransfer.files];
    if (NC.aggiungiA && !NC.proposta && tutti.length === 1 && EST_VT_PANN.test(tutti[0].name)) { esaminaVetrino(tutti[0]); return; }
    analizzaFile(tutti);
  });
  A.$('#nc-vt-file').addEventListener('change', (e) => esaminaVetrino(e.target.files[0]));
  A.$('#nc-vt-carica').addEventListener('click', () => caricaVetrino());
  A.$('#nc-cartella').addEventListener('change', (e) => analizzaFile([...e.target.files]));
  A.$('#nc-file').addEventListener('change', (e) => analizzaFile([...e.target.files]));
  A.$('#nc-carica').addEventListener('click', async () => {
    if (NC.occupato) return;
    const id = A.$('#nc-id').value.trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) { stato('Il codice del caso può contenere solo lettere, numeri, - e _.', 'errore'); return; }
    const serie = NC.serie.filter((s) => s.incluso);
    if (!serie.length) { stato('Seleziona almeno una serie.', 'errore'); return; }
    if (!A.$('#nc-controllo').checked) { stato('Prima di caricare conferma di aver guardato le anteprime (casella in fondo alla pagina).', 'errore'); A.$('#nc-controllo').focus(); return; }
    // un caso per distretto (opzionale): il distretto più rappresentato tiene il codice scelto
    const titolo = A.$('#nc-titolo').value.trim();
    if (NC.proposta) {
      if (titolo.length < 5) { stato('Scrivi il titolo: esame e sospetto clinico, senza la diagnosi.', 'errore'); A.$('#nc-titolo').focus(); return; }
      if (A.$('#nc-p-descrizione').value.trim().length < 20) { stato('Descrivi cosa mostra l\'esame (reperti e diagnosi): serve al docente.', 'errore'); A.$('#nc-p-descrizione').focus(); return; }
      if (!A.$('#nc-p-dich').checked) { stato('Serve la dichiarazione su anonimato e autorizzazione.', 'errore'); A.$('#nc-p-dich').focus(); return; }
    }
    let gruppi = [{ id, titolo: titolo || id, serie }];
    if (!NC.aggiungiA && !NC.proposta && !A.$('#nc-distretti-riga').hidden && A.$('#nc-distretti').checked) {
      const m = new Map(); for (const s of serie) { const r = s.regione || 'altro'; if (!m.has(r)) m.set(r, []); m.get(r).push(s); }
      const ord = [...m.entries()].sort((x, y) => y[1].reduce((n, s) => n + s.voci.length, 0) - x[1].reduce((n, s) => n + s.voci.length, 0));
      gruppi = ord.map(([r, ss], i) => ({ id: i ? `${id}-${A.slug(r).toLowerCase()}`.slice(0, 64) : id, titolo: `${titolo || id} — ${r}`, serie: ss }));
    }
    const totale = gruppi.reduce((n, g) => n + g.serie.reduce((k, s) => k + s.voci.length, 0), 0);
    NC.occupato = true; A.$('#nc-carica').disabled = true;
    const conto = { fatti: 0, byte: 0, t0: Date.now(), totale };
    try {
      for (const g of gruppi) await caricaCaso(g, conto);
      if (NC.proposta) { stato(`Proposta inviata: ${totale} immagini anonimizzate. Un docente la controlla prima di pubblicarla; lo stato è qui sotto.`, 'ok'); A.$('#nc-serie').hidden = true; await disegnaMieProposte(); return; }
      stato(NC.aggiungiA ? `Aggiunte ${totale} immagini anonimizzate al caso ${A.esc(id)}.` : `Caricate ${totale} immagini anonimizzate` + (gruppi.length > 1 ? ` in ${gruppi.length} casi (${gruppi.map((g) => A.esc(g.id)).join(', ')})` : '') + '. Ora scrivi anamnesi e domande…', 'ok');
      A.ELENCO = [];
      await A.pausa(900);
      location.hash = `#/editor/${encodeURIComponent(gruppi[0].id)}`;
    } catch (e) {
      if (!(e instanceof A.NonAutorizzato)) stato('Errore: ' + A.esc(e.message) + (conto.fatti ? `<br>Caricate ${conto.fatti} immagini prima dell'errore: puoi riprovare con lo stesso codice.` : ''), 'errore');
    } finally { NC.occupato = false; A.$('#nc-carica').disabled = false; }
  });
  NOMI_TIPO = { principale: 'principale', secondario: 'secondario', distrattore: 'distrattore' };
  CLASSI = [];
  SPECIALIZZANDI = [];
  A.$('#cl-nuova').addEventListener('click', () => editorClasse(null));
  RE_CONTROLLO = /DA CONTROLLARE[\s\S]*?FINE CONTROLLO(?: IA)?\.?/g;
  A.$('#pd-nuovo').addEventListener('click', () => editorPercorso(null));
  GC = { casi: [], sel: new Set() };
  ['#gc-ia', '#gc-referto-locale'].forEach((x) => A.$(x).addEventListener('change', statoIAgc));
  A.qsAll('.gc-tab th[data-ord]').forEach((th) => th.addEventListener('click', () => {
    GC.ord = { campo: th.dataset.ord, verso: GC.ord?.campo === th.dataset.ord ? -GC.ord.verso : 1 }; disegnaGestioneCasi();
  }));
  A.$('#gc-metodica').addEventListener('change', disegnaGestioneCasi);
  A.$('#gc-distretto').addEventListener('change', disegnaGestioneCasi);
  A.$('#gc-csv').addEventListener('click', () => {
    const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`, l = filtratiGC();
    const righe = [['Codice', 'Titolo', 'Sospetto', 'Metodica', 'Distretto', 'Difficoltà', 'Risposte', 'Media', 'Stato', 'Aggiornato', 'Controlli'].map(q).join(';'),
      ...l.map((c) => [c.id, c.titolo, c.quesito, A.metodicaDi(c), c.distretto, c.difficolta, c.risposte || 0, c.media ?? '', c.visibile === false ? 'bozza' : 'visibile', c.aggiornato, (c.controlli || []).join(' | ')].map(q).join(';'))];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + righe.join('\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'casi-quiz.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  });
  A.$('#gc-elimina').addEventListener('click', async () => {
    const ids = [...GC.sel]; if (!ids.length) { A.$('#gc-msg').textContent = 'Seleziona almeno un caso.'; return; }
    const ris = GC.casi.filter((c) => GC.sel.has(c.id)).reduce((n, c) => n + (c.risposte || 0), 0);
    const ok = prompt(`Eliminare ${ids.length} ${ids.length === 1 ? 'caso' : 'casi'} (${ids.join(', ')})?\nLe immagini vengono cancellate dal sito, le domande archiviate; i risultati degli studenti (${ris}) restano.\nPer confermare scrivi ELIMINA`);
    if (ok !== 'ELIMINA') { A.$('#gc-msg').textContent = 'Eliminazione annullata.'; return; }
    let fatti = 0; const err = [];
    for (const id of ids) {
      A.$('#gc-msg').textContent = `Elimino ${fatti + err.length + 1} / ${ids.length}…`;
      try { await A.postJSON(`/api/casi/${encodeURIComponent(id)}/elimina`, { conferma: id }); fatti++; }
      catch (e) { if (e instanceof A.NonAutorizzato) return; err.push(`${id}: ${e.message}`); }
    }
    A.ELENCO = []; await apriGestioneCasi();
    A.$('#gc-msg').textContent = `${fatti} eliminati.` + (err.length ? ' Non eliminati: ' + err.join(' · ') : '');
  });
  A.$('#gc-filtro').addEventListener('input', disegnaGestioneCasi);
  A.$('#gc-stato').addEventListener('change', disegnaGestioneCasi);
  A.$('#gc-pubblica').addEventListener('click', () => visibilitaCasi(true));
  A.$('#gc-bozza').addEventListener('click', () => visibilitaCasi(false));
  A.qsAll('[data-scheda]').forEach((b) => b.addEventListener('click', () => { A.AN.scheda = b.dataset.scheda; if (A.AN.dati) disegnaAnalisi(); }));
  A.$('#an-classe').addEventListener('change', () => disegnaAnalisi());
  A.$('#an-primo').addEventListener('change', () => { if (A.AN.dati) disegnaAnalisi(); });
}
export { apriNuovo, apriClassi, apriRevisione, apriPercorsiDoc, apriGestioneCasi, apriAnalisi, apriCruscotto };
