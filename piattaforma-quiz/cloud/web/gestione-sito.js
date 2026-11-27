// Amministrazione: traffico, sponsor, piattaforme dei clienti, statistiche d'uso, iscritti e docenti
// Estratto da app.js nella 1.272 (strumenti_claude/divisione/dividi.mjs) senza modifiche al contenuto, salvo i nomi di
// app.js letti come A.nome (ponte PONTE_GS) e le istruzioni che app.js eseguiva al caricamento, ora in avvio().
// Si carica solo quando serve (app.js, caricaGestioneSito): chi non lo usa non lo scarica. Niente import './app.js'.
let A = null;
export const collega = (p) => { A = p; };
export const NOMI_APP = ["$","AZIENDA","CATEGORIE","ELENCO","ISTANZA","NonAutorizzato","PERCORSI","PERCORSI_FISSI","SOGLIA_SUPERATO","SPONSOR","UTENTE","caricaPercorsi","esc","getJSON","normal","postJSON","qsAll"];

let NOMI_PAGINE;   // valore in avvio()
// soglie mensili del piano gratuito permanente di AWS («always free»): indicative, da verificare su AWS Billing
let SOGLIE_AWS;   // valore in avvio()
let TR_GIORNI;   // valore in avvio()
const trNum = (n, dec = 0) => Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: dec });
const trByte = (b) => { b = Number(b || 0); const u = ['B', 'kB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; } return `${trNum(b, b < 10 && i ? 1 : 0)} ${u[i]}`; };
const trBreve = (v, f) => (v >= 1e6 ? trNum(v / 1e6, 1) + ' M' : v >= 1e4 ? trNum(v / 1e3, 0) + ' k' : f(v));
const trData = (g, lungo) => new Date(g + 'T12:00:00Z').toLocaleDateString('it-IT', lungo ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });
// grafico per giorno: la prima serie a barre, le altre a linee; ogni serie con la sua scala se `asse2`
function graficoGiorni(giorni, serie, { alto = 190, formato = trNum } = {}) {
  const W = 640, H = alto, sx = 42, dx = 8, su = 10, giu = 22, L = W - sx - dx, ALT = H - su - giu, n = giorni.length || 1;   // 27/11: ALT (altezza utile) e non A, che è il ponte con app.js (con «A» il grafico dava «A.esc is not a function» dalla 1.272)
  const max = (k) => Math.max(1, ...giorni.map((g) => g[k] || 0));
  const m0 = max(serie[0].k), passo = L / n, x = (i) => sx + i * passo + passo / 2;
  const tacche = [0, 0.5, 1].map((f) => `<line class="asse" x1="${sx}" x2="${W - dx}" y1="${su + ALT * (1 - f)}" y2="${su + ALT * (1 - f)}" stroke-dasharray="${f ? '2 3' : ''}"/><text x="${sx - 4}" y="${su + ALT * (1 - f) + 3}" text-anchor="end">${A.esc(trBreve(m0 * f, formato))}</text>`).join('');
  const bw = Math.max(1.5, passo * 0.68);
  const barre = giorni.map((g, i) => { const h = ALT * (g[serie[0].k] || 0) / m0; return `<rect class="b" x="${x(i) - bw / 2}" y="${su + ALT - h}" width="${bw}" height="${Math.max(h, 0)}" rx="${Math.min(3, bw / 3)}" fill="${serie[0].c}"><title>${A.esc(trData(g.giorno, true))}\n${serie.map((s) => `${s.nome}: ${formato(g[s.k] || 0)}`).join('\n')}</title></rect>`; }).join('');
  const linee = serie.slice(1).map((s) => { const m = s.asse2 ? max(s.k) : m0; const pts = giorni.map((g, i) => `${x(i).toFixed(1)},${(su + ALT - ALT * (g[s.k] || 0) / m).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${s.c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>${n <= 45 ? giorni.map((g, i) => `<circle cx="${x(i)}" cy="${su + ALT - ALT * (g[s.k] || 0) / m}" r="2.4" fill="${s.c}"/>`).join('') : ''}`; }).join('');
  const etich = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${A.esc(trData(giorni[i].giorno))}</text>`).join('');
  return `<div class="leg">${serie.map((s) => `<span><i style="background:${s.c}"></i>${A.esc(s.nome)}${s.asse2 ? ' (scala propria)' : ''}</span>`).join('')}</div>
    <svg class="tr-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${A.esc(serie.map((s) => s.nome).join(', '))} per giorno">${tacche}${barre}${linee}${etich}</svg>`;
}
const trRighe = (voci) => { const m = Math.max(1, ...voci.map((v) => v.n)); return `<ul class="tr-righe">${voci.map((v) => `<li><span class="nome" title="${A.esc(v.nome)}">${A.esc(v.nome)}</span><span class="n">${trNum(v.n)}</span><span class="barra"><span style="width:${(100 * v.n / m).toFixed(1)}%"></span></span></li>`).join('')}</ul>`; };
// 27/11: da dove arrivano le visite (prima pagina della sessione) e le iscrizioni
const NOMI_ORIGINI = { instagram: 'Instagram', 'instagram-bio': 'Instagram (link nella bio)', facebook: 'Facebook', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', telegram: 'Telegram',
  google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', x: 'X (Twitter)', reddit: 'Reddit', hackernews: 'Hacker News', youtube: 'YouTube', github: 'GitHub', tiktok: 'TikTok',
  amico: 'Link mandato da un iscritto', diretto: 'Diretto (indirizzo scritto, app, link senza etichetta)', 'altro-sito': 'Altri siti', 'link-caso': 'Link a un caso (origine non nota)', argomenti: 'Pagine per argomento (Google)' };
function trProvenienze(l) {
  if (!Array.isArray(l)) return '';
  const righe = l.map((x) => `<tr><td>${A.esc(NOMI_ORIGINI[x.da] || x.da)}</td><td class="n">${trNum(x.visite)}</td><td class="n">${trNum(x.iscrizioni)}</td><td class="n">${x.visite ? trNum(100 * x.iscrizioni / x.visite, 1) : '–'}</td></tr>`).join('');
  return `<div class="tr-box" style="margin-bottom:14px"><h3>Da dove arrivano</h3>${l.length ? `<table class="tab"><thead><tr><th>Provenienza</th><th>Visite</th><th>Iscrizioni</th><th>Iscrizioni ogni 100 visite</th></tr></thead><tbody>${righe}</tbody></table>` : '<p class="muted small">Ancora nessun dato: i conteggi partono dal 27/11/2026.</p>'}
    <p class="muted small">Dalla prima pagina di ogni visita: l'etichetta del link (<code>?da=…</code>) o il sito di provenienza (solo la categoria, mai l'indirizzo). WhatsApp e molte app non dicono da dove arriva la visita: usa i link con l'etichetta, qui sotto.</p></div>`;
}
// 27/11: casi di prova da condividere: link con l'anteprima per i social (/c/<caso>) e testo pronto, per canale
async function trCondividi() {
  if (!trCondividi.click) {   // una volta sola, alla prima apertura (i moduli a richiesta non eseguono nulla al caricamento)
    trCondividi.click = true;
    document.addEventListener('click', async (e) => {
      const b = e.target.closest?.('.cd-box [data-copia]'); if (!b) return;
      const m = A.$('#cd-msg');
      try { await navigator.clipboard.writeText(b.dataset.copia); if (m) m.textContent = 'Copiato: ' + b.dataset.copia.slice(0, 80); } catch { if (m) m.textContent = b.dataset.copia; }
    });
  }
  let p; try { p = await A.getJSON('/api/prova'); } catch { return ''; }
  if (!p?.casi?.length) return '';
  const o = location.origin, CANALI = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['whatsapp', 'WhatsApp']];
  const riga = (c) => `<li class="cd-caso"><img src="/img/condividi/${A.esc(c.id)}.jpg" alt="" width="72" height="72" loading="lazy"><div><b>${A.esc(c.titolo)}</b>${c.id === p.giorno ? ' <span class="badge">caso del giorno</span>' : ''}<div class="muted small">${A.esc(c.domanda || '')}</div>
    <div class="cd-az">${CANALI.map(([k, n]) => `<button type="button" class="ghost" data-copia="${A.esc(`${o}/c/${c.id}?da=${k}`)}">🔗 ${n}</button>`).join('')}<button type="button" class="ghost" data-copia="${A.esc(`${c.titolo}: che cosa vedi? ${c.domanda || ''} Prova il caso senza iscriverti: ${o}/c/${c.id}?da=social`)}">📝 Testo del post</button></div></div></li>`;
  return `<div class="tr-box cd-box" style="margin-bottom:14px"><h3>Casi da condividere</h3><p class="muted small">Si aprono senza iscrizione. Il link <code>/c/…</code> mostra sui social l'immagine e la domanda del caso, e conta da dove arrivano le visite. Link per la bio di Instagram: <button type="button" class="ghost" data-copia="${A.esc(`${o}/?da=instagram-bio#/prova`)}">🔗 copia</button> <span class="stato small" id="cd-msg"></span></p><ul class="cd-lista">${p.casi.map(riga).join('')}</ul></div>`;
}
// 27/11: dalla visita al primo caso, per capire dove si perdono le persone (percentuale sul passo da cui si parte)
function trImbuto(i) {
  if (!i) return '';
  const pc = (a, b) => (b ? ` · ${Math.round(100 * a / b)}%` : '');
  return `<div class="tr-box" style="margin-bottom:14px"><h3>Dalla visita al primo caso</h3>${trRighe([
    { nome: 'Visite', n: i.visite || 0 },
    { nome: `Casi di prova aperti senza account${pc(i.provaApri, i.visite)}`, n: i.provaApri || 0 },
    { nome: `Casi di prova risolti senza account${pc(i.prova, i.provaApri)}`, n: i.prova || 0 },
    { nome: `Nuovi iscritti${pc(i.iscrizioni, i.visite)}`, n: i.iscrizioni || 0 },
    { nome: `Iscritti che hanno risolto un caso${pc(i.primoCaso, i.iscrizioni)}`, n: i.primoCaso || 0 },
    { nome: `Iscritti tornati un altro giorno${pc(i.tornati, i.iscrizioni)}`, n: i.tornati || 0 }])}
    <p class="muted small">Percentuali sul passo da cui si parte. Dal 27/11/2026 le visite dei browser automatici (controllo quotidiano, test, motori di ricerca) non si contano.</p></div>`;
}
function trMetro(nome, usato, soglia, fmt, proiez) {
  const f = usato / soglia, p = proiez / soglia, cl = Math.max(f, p) >= 0.85 ? 'alto' : Math.max(f, p) >= 0.6 ? 'medio' : '';
  return `<div class="tr-metro ${cl}"><div class="t"><span>${A.esc(nome)}</span><b>${A.esc(fmt(usato))} / ${A.esc(fmt(soglia))}</b></div>
    <div class="barra"><span style="width:${Math.min(100, f * 100).toFixed(1)}%"></span>${p > f ? `<em style="left:${Math.min(100, p * 100).toFixed(1)}%" title="proiezione a fine mese"></em>` : ''}</div>
    <small>${trNum(f * 100, 1)}% usato · a fine mese circa ${A.esc(fmt(proiez))} (${trNum(p * 100, 0)}%)</small></div>`;
}
async function apriTraffico(n = TR_GIORNI) {
  TR_GIORNI = n; A.qsAll('.tr-periodo button').forEach((b) => b.classList.toggle('on', Number(b.dataset.g) === n));
  const box = A.$('#tr-corpo'); if (!box.dataset.pronto) box.innerHTML = '<p class="muted">Caricamento…</p>';
  try {
    const d = await A.getJSON('/api/statistiche/traffico/' + n);
    const G = d.giorni, tot = (k, l = G) => l.reduce((t, g) => t + (g[k] || 0), 0);
    const meta = Math.floor(G.length / 2), prima = G.slice(0, meta), dopo = G.slice(G.length - meta);
    const delta = (k) => { const a = tot(k, prima), b = tot(k, dopo); if (!a) return ''; const v = Math.round(100 * (b - a) / a); return `<div class="d ${v > 0 ? 'su' : v < 0 ? 'giu' : ''}">${v > 0 ? '▲' : v < 0 ? '▼' : '='} ${Math.abs(v)}% sulla metà precedente</div>`; };
    const tile = (v, t, c, k) => `<div class="tr-tile" style="--c:${c}"><div class="v">${v}</div><small>${t}</small>${k ? delta(k) : ''}</div>`;
    const sess = tot('sessioni'), mob = tot('mobile');
    const medUtenti = G.length ? tot('utenti') / G.length : 0;
    let h = `<div class="tr-tiles">
      ${tile(trNum(d.attiviPeriodo), `persone attive negli ultimi ${n} giorni`, 'var(--acc)')}
      ${tile(trNum(medUtenti, 1), 'persone attive al giorno (media)', '#9b8cff', 'utenti')}
      ${tile(trNum(tot('login')), 'accessi (login)', 'var(--ok)', 'login')}
      ${tile(trNum(sess), `visite${sess ? ` · ${trNum(100 * mob / sess)}% da smartphone o tablet` : ''}`, '#38c6d9', 'sessioni')}
      ${tile(trNum(tot('pagine')), 'pagine viste', 'var(--warn)', 'pagine')}
      ${tile(trNum(tot('iscrizioni')), 'nuovi iscritti', '#ff8fb1', 'iscrizioni')}
    </div>
    <div class="tr-griglia">
      <div class="tr-box"><h3>Andamento giornaliero</h3>${graficoGiorni(G, [{ k: 'pagine', nome: 'Pagine viste', c: 'var(--acc)' }, { k: 'utenti', nome: 'Persone attive', c: 'var(--warn)', asse2: true }, { k: 'login', nome: 'Accessi', c: 'var(--ok)', asse2: true }])}</div>
      <div class="tr-box"><h3>Pagine più usate</h3>${d.pagine.length ? trRighe(d.pagine.slice(0, 10).map((x) => ({ nome: NOMI_PAGINE[x.p] || x.p, n: x.n }))) : '<p class="muted small">Ancora nessun dato: i conteggi partono da questa versione.</p>'}</div>
    </div>`;
    h += trImbuto(d.imbuto) + trProvenienze(d.provenienze) + await trCondividi();
    if (d.casi.length) h += `<div class="tr-box" style="margin-bottom:14px"><h3>Casi più aperti</h3>${trRighe(d.casi.map((x) => ({ nome: x.titolo, n: x.n })))}</div>`;
    h += trAws(d.aws);
    h += `<p class="tr-nota">Dal ${A.esc(trData(d.da, true))} · solo totali giornalieri, nessun dato personale. L'amministratore non viene contato; il visualizzatore scaricabile non invia nulla. Aggiornato alle ${A.esc(new Date(d.generato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))}.</p>`;
    box.innerHTML = h; box.dataset.pronto = '1';
  } catch (e) { box.innerHTML = `<p class="stato ko">${A.esc(e.message)}</p>`; }
}
function trAws(a) {
  if (!a) return `<div class="tr-box"><h3>Traffico dei server (AWS)</h3><p class="muted small">Disponibile solo sul sito pubblicato (legge le metriche di CloudFront e Lambda).</p></div>`;
  if (a.errore) return `<div class="tr-box"><h3>Traffico dei server (AWS)</h3><p class="stato ko">Metriche non disponibili: ${A.esc(a.errore)}</p></div>`;
  const oggi = new Date(), mese = oggi.toISOString().slice(0, 7), gm = oggi.getUTCDate(), dm = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() + 1, 0)).getUTCDate();
  const somma = (k, f = (v) => v) => (a[k] || []).filter(([g]) => g.startsWith(mese)).reduce((t, [, v]) => t + f(v), 0);
  const gbs = (ms) => (ms / 1000) * (a.memoriaMB / 1024);
  const proi = (v) => (v / gm) * dm;
  const req = somma('richieste'), by = somma('byte'), inv = somma('invocazioni'), gb = somma('durata', gbs);
  const ultimo = (k) => { const l = a[k] || []; return l.length ? l[l.length - 1][1] : 0; };
  // serie per il grafico, sugli stessi giorni del periodo scelto
  const mappa = (k, f = (v) => v) => Object.fromEntries((a[k] || []).map(([g, v]) => [g, f(v)]));
  const R = mappa('richieste'), B = mappa('byte', (v) => v / 1e9), I = mappa('invocazioni');
  const giorni = []; for (let k = TR_GIORNI - 1; k >= 0; k--) { const g = new Date(Date.now() - k * 864e5).toISOString().slice(0, 10); giorni.push({ giorno: g, richieste: R[g] || 0, gb: B[g] || 0, api: I[g] || 0 }); }
  const err5 = (a.err5 || []).filter(([g]) => g.startsWith(mese)).map(([, v]) => v), e5 = err5.length ? err5.reduce((t, v) => t + v, 0) / err5.length : 0;
  const rischio = [req / SOGLIE_AWS.richieste, by / SOGLIE_AWS.byte, inv / SOGLIE_AWS.invocazioni, gb / SOGLIE_AWS.gbs].map((f) => f * dm / gm);
  return `<div class="tr-box" style="margin-bottom:14px"><h3>Traffico dei server (AWS) — ${A.esc(oggi.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }))}</h3>
    ${Math.max(...rischio) >= 0.85 ? '<p class="tr-avviso">⚠ A questo ritmo, entro fine mese si supera almeno una soglia gratuita: è il momento di valutare un budget o un piano commerciale AWS.</p>' : ''}
    ${a.distribuzione ? '' : '<p class="muted small">Distribuzione CloudFront non trovata: mancano richieste e dati trasferiti.</p>'}
    <div class="tr-metri">
      ${trMetro('Richieste CloudFront', req, SOGLIE_AWS.richieste, (v) => trNum(v), proi(req))}
      ${trMetro('Dati trasferiti', by, SOGLIE_AWS.byte, trByte, proi(by))}
      ${trMetro('Chiamate all\'API (Lambda)', inv, SOGLIE_AWS.invocazioni, (v) => trNum(v), proi(inv))}
      ${trMetro('Calcolo Lambda (GB-secondi)', gb, SOGLIE_AWS.gbs, (v) => trNum(v), proi(gb))}
      ${trMetro('Database (DynamoDB)', a.tabellaByte, SOGLIE_AWS.tabella, trByte, a.tabellaByte)}
      <div class="tr-metro"><div class="t"><span>Spazio su S3</span><b>${A.esc(trByte(ultimo('sito') + ultimo('dati')))}</b></div><small>immagini dei casi ${A.esc(trByte(ultimo('sito')))} · dati e backup ${A.esc(trByte(ultimo('dati')))}; S3 si paga a GB al mese</small></div>
    </div>
    <div class="tr-griglia tr-aws">
      <div>${graficoGiorni(giorni, [{ k: 'richieste', nome: 'Richieste CloudFront', c: '#38c6d9' }, { k: 'api', nome: 'Chiamate API', c: 'var(--ok)', asse2: true }], { alto: 170 })}</div>
      <div>${graficoGiorni(giorni, [{ k: 'gb', nome: 'GB trasferiti', c: '#9b8cff' }], { alto: 170, formato: (v) => trNum(v, v < 10 ? 1 : 0) })}</div>
    </div>
    <p class="tr-nota">Errori del server (5xx) questo mese: ${trNum(e5, 2)}% delle richieste. Soglie del piano gratuito permanente AWS, indicative: i costi reali sono in AWS Billing. La linea tratteggiata è la proiezione a fine mese.</p></div>`;
}
let POS_SPONSOR;   // valore in avvio()
let SP_LISTA, SP_MOD;   // valore in avvio()
async function apriSponsor() {
  const box = A.$('#sp-gest'); if (!box) return;
  box.hidden = A.AZIENDA(); if (A.AZIENDA()) return;
  try { SP_LISTA = await A.getJSON('/api/sponsor/gestione'); } catch (e) { A.$('#sp-elenco').innerHTML = `<p class="stato ko">${A.esc(e.message)}</p>`; return; }
  disegnaSponsor();
}
function statoSponsor(x) {
  const oggi = new Date().toISOString().slice(0, 10);
  if (x.attivo === false) return ['sospeso', 'Sospeso'];
  if (x.dal && x.dal > oggi) return ['futuro', 'Dal ' + x.dal.split('-').reverse().join('/')];
  if (x.al && x.al < oggi) return ['scaduto', 'Scaduto'];
  if (!x.logo) return ['sospeso', 'Senza logo'];
  return ['attivo', x.al ? 'Attivo fino al ' + x.al.split('-').reverse().join('/') : 'Attivo'];
}
function disegnaSponsor() {
  const el = A.$('#sp-elenco');
  if (!SP_LISTA.length) { el.innerHTML = '<div class="tn-vuoto"><span>🤝</span><p><b>Nessuno sponsor ancora.</b><br>Aggiungi il primo con «＋ Nuovo sponsor»: logo, link e dove deve comparire.</p></div>'; return; }
  el.innerHTML = SP_LISTA.map((x) => { const [cl, st] = statoSponsor(x), s = x.stat || {}, ctr = s.viste30 ? (100 * s.clic30 / s.viste30).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%' : '—';
    return `<div class="sp-scheda" data-id="${A.esc(x.id)}">
      <div class="sp-scheda-logo">${x.logo ? `<img src="${A.esc(x.logo)}" alt="">` : '<span class="muted small">nessun logo</span>'}</div>
      <div class="sp-scheda-testo"><b>${A.esc(x.nome)}</b> <span class="sp-stato ${cl}">${A.esc(st)}</span>
        <small>${x.link ? `<a href="${A.esc(x.link)}" target="_blank" rel="noopener">${A.esc(x.link.replace(/^https:\/\//, ''))}</a>` : 'senza link'}${x.testo ? ' · ' + A.esc(x.testo) : ''}</small>
        <small>${(x.posizioni || []).map((p) => A.esc(POS_SPONSOR[p] || p)).join(' · ') || 'nessuna posizione'}</small></div>
      <div class="sp-scheda-num"><span><b>${trNum(s.viste30)}</b> viste</span><span><b>${trNum(s.clic30)}</b> clic</span><span><b>${ctr}</b> CTR</span><small>ultimi 30 giorni · 90 gg: ${trNum(s.viste90)} / ${trNum(s.clic90)}</small></div>
      <div class="sp-scheda-az"><button type="button" class="ghost" data-az="mod">Modifica</button><button type="button" class="ghost" data-az="att">${x.attivo === false ? 'Riattiva' : 'Sospendi'}</button><button type="button" class="ghost pericolo" data-az="del">Elimina</button></div></div>`; }).join('');
  el.querySelectorAll('.sp-scheda button').forEach((b) => b.onclick = async () => {
    const id = b.closest('.sp-scheda').dataset.id, x = SP_LISTA.find((y) => y.id === id);
    try {
      if (b.dataset.az === 'mod') return formSponsor(x);
      if (b.dataset.az === 'att') await A.postJSON('/api/sponsor/' + encodeURIComponent(id), { attivo: x.attivo === false });
      if (b.dataset.az === 'del') { if (!confirm(`Eliminare lo sponsor «${x.nome}»? I conteggi restano nel database.`)) return; await A.postJSON(`/api/sponsor/${encodeURIComponent(id)}/elimina`); }
      A.SPONSOR = null; await apriSponsor();
    } catch (e) { alert(e.message); }
  });
}
function formSponsor(x = null) {
  SP_MOD = x; const f = A.$('#sp-form'); f.hidden = false;
  f.querySelector('h3').textContent = x ? `Modifica «${x.nome}»` : 'Nuovo sponsor';
  f.elements.nome.value = x?.nome || ''; f.elements.link.value = x?.link || ''; f.elements.testo.value = x?.testo || '';
  f.elements.dal.value = x?.dal || ''; f.elements.al.value = x?.al || ''; f.elements.attivo.checked = x ? x.attivo !== false : true;
  f.querySelectorAll('[name=pos]').forEach((c) => { c.checked = x ? (x.posizioni || []).includes(c.value) : c.value !== 'caso'; });
  f.dataset.logo = x?.logo || ''; A.$('#sp-anteprima').innerHTML = x?.logo ? `<img src="${A.esc(x.logo)}" alt="">` : '<span class="muted small">nessun logo</span>';
  f.elements.logo.value = ''; A.$('#sp-esito').textContent = ''; f.scrollIntoView({ block: 'nearest' }); f.elements.nome.focus();
}
// ---------------------------------------------------------------- clienti e piattaforme (tenant), solo nella vetrina
// la piattaforma del cliente è uno stack AWS separato: qui si registra e, se la creazione automatica è attiva, si crea
// con un lavoro AWS (pulsanti «▶ …»); in alternativa la crea sul Mac «crea-istanze.command»
let STATI_TENANT;   // valore in avvio()
let PIANI_TENANT;   // valore in avvio()
let TENANT, TN_MOD;   // valore in avvio()
async function apriTenant() {
  A.$('#tn-elenco').innerHTML = '<p class="muted">Caricamento…</p>';
  try { TENANT = await A.getJSON('/api/tenant'); } catch (e) { A.$('#tn-elenco').innerHTML = `<p class="stato ko">${A.esc(e.message)}</p>`; return; }
  A.$('#tn-zona').textContent = '.' + TENANT.zona;
  const l = TENANT.elenco, conta = (f) => l.filter(f).length;
  const AUTO = !!TENANT.automatica;
  clearTimeout(apriTenant.t); if (l.some((t) => t.stato === 'in_corso')) apriTenant.t = setTimeout(() => { if (A.$('#tn-elenco')?.offsetParent) apriTenant(); }, 20000);
  A.$('#tn-riepilogo').innerHTML = [[l.length, 'clienti', ''], [conta((t) => t.stato === 'attiva'), 'attive', 'ok'], [conta((t) => /^da_|in_corso/.test(t.stato)), AUTO ? 'in coda o in corso' : 'in coda sul Mac', 'attesa'],
    [conta((t) => t.stato === 'errore' || t.online === false), 'da controllare', 'ko']].map(([n, t, c]) => `<div class="tn-tile ${c}"><b>${n}</b><small>${t}</small></div>`).join('');
  A.$('#tn-coda').hidden = AUTO || !l.some((t) => /^da_/.test(t.stato));
  if (!l.length) { A.$('#tn-elenco').innerHTML = '<div class="tn-vuoto"><span>🏥</span><p><b>Nessun cliente ancora.</b><br>Aggiungi la prima piattaforma con il pulsante «Nuovo cliente».</p></div>'; return; }
  A.$('#tn-elenco').innerHTML = l.map((t) => { const [st, cl] = STATI_TENANT[t.stato] || [t.stato, ''];
    const scad = t.scadenza ? Math.ceil((new Date(t.scadenza) - Date.now()) / 864e5) : null;
    return `<article class="tn-scheda ${cl}" data-id="${A.esc(t.id)}">
      <div class="tn-testa"><span class="tn-ico">${A.esc((t.cliente || '?').trim()[0].toUpperCase())}</span>
        <div class="tn-nome"><b>${A.esc(t.cliente)}</b><small>${A.esc(t.nomeIstanza !== t.cliente ? t.nomeIstanza : '')}</small></div>
        <span class="tn-stato ${cl}">${A.esc(st)}${t.stato === 'sospesa' && !t.sospesaApplicata ? ' · da applicare' : ''}</span></div>
      <a class="tn-url" ${t.stato === 'attiva' || t.stato === 'sospesa' ? `href="https://${A.esc(t.dominio)}" target="_blank" rel="noopener"` : ''}>🌐 ${A.esc(t.dominio)}${t.online === true ? ' <span class="tn-online">● online</span>' : t.online === false ? ' <span class="tn-offline">● non risponde</span>' : ''}</a>
      <dl class="tn-dati"><div><dt>Piano</dt><dd>${A.esc(PIANI_TENANT[t.piano] || t.piano)}${t.utentiMax ? ` · fino a ${t.utentiMax} utenti` : ''}</dd></div>
        <div><dt>Referente</dt><dd>${A.esc(t.referenteNome || '')} <span class="muted">${A.esc(t.referenteEmail)}</span>${t.invitato ? ' · invitato ✓' : ''}</dd></div>
        <div><dt>Scadenza</dt><dd>${t.scadenza ? `${A.esc(t.scadenza.split('-').reverse().join('/'))}${scad != null ? ` <span class="${scad < 0 ? 'ko' : scad < 30 ? 'attesa' : 'muted'}">(${scad < 0 ? 'scaduta' : scad + ' giorni'})</span>` : ''}` : '—'}</dd></div>
        <div><dt>Pubblicata</dt><dd>${A.esc(t.pubblicato || '—')}${t.versione ? ` · v${A.esc(t.versione)}` : ''}</dd></div></dl>
      ${t.stato === 'in_corso' ? `<p class="tn-lavoro"><span class="tn-gira" aria-hidden="true"></span> ${A.esc({ crea: 'Creazione', aggiorna: 'Aggiornamento', sospendi: 'Sospensione', smonta: 'Smontaggio' }[t.lavoro?.azione] || 'Lavoro')} in corso su AWS dalle ${A.esc((t.lavoro?.inizio || '').slice(11, 16))} · di solito 10-20 minuti (la prima creazione fino a 30); a fine lavoro arriva un'email</p>` : ''}
      ${t.errore && t.stato === 'errore' ? `<p class="tn-errore">⚠ ${A.esc(t.errore)}</p>` : ''}${t.registro ? `<details class="tn-registro"><summary>Registro dell'ultimo lavoro${t.lavoro?.fine ? ' (' + A.esc(t.lavoro.fine) + ')' : ''}</summary><pre>${A.esc(t.registro)}</pre></details>` : ''}${t.note ? `<p class="tn-note">${A.esc(t.note)}</p>` : ''}
      <div class="tn-azioni"><button type="button" data-az="mod">Modifica</button>
        ${AUTO && t.stato !== 'in_corso' && (/^da_(creare|aggiornare)$/.test(t.stato) || t.stato === 'errore' || (t.stato === 'sospesa' && !t.sospesaApplicata)) ? `<button type="button" class="primary" data-az="avvia">▶ ${t.stato === 'da_creare' || (t.stato === 'errore' && !t.creata) ? 'Crea la piattaforma' : t.stato === 'sospesa' ? 'Applica la sospensione' : t.stato === 'errore' ? 'Riprova' : 'Aggiorna ora'}</button>` : ''}
        ${t.stato === 'in_corso' ? '' : t.stato === 'attiva' || (t.stato === 'errore' && t.creata) ? '<button type="button" data-az="agg" title="Alla prossima esecuzione di crea-istanze.command la piattaforma riceve l\'ultima versione del codice">Aggiorna alla nuova versione</button>' : ''}
        ${t.stato === 'attiva' ? '<button type="button" data-az="sosp">Sospendi</button>' : t.stato === 'sospesa' ? '<button type="button" data-az="riatt">Riattiva</button>' : ''}
        ${['attiva', 'sospesa'].includes(t.stato) || (t.stato === 'errore' && t.creata) ? `<button type="button" class="pericolo" data-az="smonta">${AUTO ? 'Smonta…' : 'Da smontare'}</button>` : ''}
        ${(t.stato === 'da_creare' || t.stato === 'errore' || t.stato === 'smontata') && !t.creata ? '<button type="button" class="pericolo" data-az="del">Togli</button>' : ''}</div></article>`; }).join('');
  A.qsAll('.tn-scheda button').forEach((b) => b.onclick = async () => {
    const id = b.closest('.tn-scheda').dataset.id, t = TENANT.elenco.find((x) => x.id === id), az = b.dataset.az;
    if (az === 'mod') return formTenant(t);
    if (az === 'del' && b.dataset.ok !== '1') { b.dataset.ok = '1'; const x = b.textContent; b.textContent = 'Confermi?'; setTimeout(() => { b.dataset.ok = ''; b.textContent = x; }, 4000); return; }
    if (az === 'smonta' && !AUTO && b.dataset.ok !== '1') { b.dataset.ok = '1'; const x = b.textContent; b.textContent = 'Confermi?'; setTimeout(() => { b.dataset.ok = ''; b.textContent = x; }, 4000); return; }
    let conferma = '';
    if (az === 'smonta' && AUTO) {
      conferma = prompt(`Smontare la piattaforma «${t.cliente}» (https://${t.dominio})?\nIl sito non sarà più raggiungibile; i dati restano conservati su AWS ma non sono più usati.\n\nPer confermare scrivi l'identificativo: ${id}`) || '';
      if (conferma.trim() !== id) { if (conferma) alert('Identificativo diverso: niente smontato.'); return; }
    }
    b.disabled = true;
    try {
      if (az === 'del') await A.postJSON(`/api/tenant/${id}/elimina`);
      else if (az !== 'avvia') await A.postJSON(`/api/tenant/${id}`, { stato: { agg: 'da_aggiornare', sosp: 'sospesa', riatt: 'da_aggiornare', smonta: 'da_smontare' }[az] });
      // con la creazione automatica le azioni partono subito su AWS
      if (AUTO && az !== 'del') await A.postJSON(`/api/tenant/${id}/avvia`, { conferma: conferma.trim() });
      await apriTenant();
    } catch (e) { alert(e.message); b.disabled = false; await apriTenant(); }
  });
}
function formTenant(t = null) {
  TN_MOD = t; const f = A.$('#tn-form'); f.hidden = false;
  f.querySelector('h3').textContent = t ? `Modifica «${t.cliente}»` : 'Nuovo cliente';
  for (const k of ['id', 'cliente', 'nomeIstanza', 'referenteNome', 'referenteEmail', 'contatto', 'utentiMax', 'scadenza', 'note']) f.elements[k].value = t?.[k] ?? '';
  f.elements.piano.value = t?.piano || 'pilota'; f.elements.id.readOnly = !!t; A.$('#tn-esito').textContent = ''; aggiornaAnteprimaTenant();
  f.scrollIntoView({ block: 'nearest' }); (t ? f.elements.cliente : f.elements.cliente).focus();
}
function aggiornaAnteprimaTenant() {
  const f = A.$('#tn-form'), id = f.elements.id.value.trim().toLowerCase();
  A.$('#tn-anteprima').textContent = id ? `https://${id}.${TENANT.zona}` : `https://<identificativo>.${TENANT.zona}`;
}
function mostraCodice(nome, codice, nuovo) {
  const box = A.$('#acc-codice'); box.hidden = false;
  box.innerHTML = `${nuovo ? 'Account creato per' : 'Nuovo codice per'} <b>${A.esc(nome)}</b>:<br>
    <code>${A.esc(codice)}</code> <button type="button" class="ghost" id="acc-copia">Copia</button><br>
    <span class="small">Annotalo ora e comunicalo di persona: non sarà più visibile.${nuovo ? '' : ' Il codice precedente non vale più.'}</span>`;
  A.$('#acc-copia').onclick = () => { navigator.clipboard?.writeText(codice).then(() => { A.$('#acc-copia').textContent = 'Copiato ✓'; }).catch(() => {}); };
}
let ACCOUNT, ACC_ORD, ACC_APERTO, ACC_INVITO_VISTO;   // valore in avvio()
// «＋ Invita una persona»: il modulo si apre sotto il titolo
function apriInvito(si = A.$('#form-invito').hidden) {
  A.$('#form-invito').hidden = !si; A.$('#acc-invita-apri').setAttribute('aria-expanded', String(si));
  A.$('#acc-invita-apri').classList.toggle('on', si); if (si) setTimeout(() => A.$('#inv-nome').focus(), 30);
}
// quanto tempo fa (oggi, ieri, 3 giorni fa…), con la data completa nel suggerimento
function quandoFa(t) {
  if (!t || !/^\d{4}-\d{2}-\d{2}/.test(t)) return '—';
  const d = new Date(t.length > 10 ? t : t + 'T12:00:00'), g = Math.floor((Date.now() - d) / 864e5);
  return g <= 0 ? 'oggi' : g === 1 ? 'ieri' : g < 30 ? `${g} giorni fa` : g < 365 ? (Math.round(g / 30.4) <= 1 ? '1 mese fa' : `${Math.round(g / 30.4)} mesi fa`) : (Math.round(g / 365) <= 1 ? '1 anno fa' : `${Math.round(g / 365)} anni fa`);
}
const dataLunga = (t) => (t && /^\d{4}-\d{2}-\d{2}/.test(t) ? new Date(t.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) + (t.length > 10 ? ' ' + t.slice(11, 16) : '') : '');
// menù «Azioni» di ogni persona: si apre in posizione fissa (la tabella scorre in orizzontale e lo taglierebbe)
function posizionaMenuAcc(d) {
  const r = d.querySelector('summary').getBoundingClientRect(), pop = d.querySelector('.acc-menu-pop');
  const h = pop.offsetHeight, w = pop.offsetWidth, sotto = r.bottom + 6 + h < innerHeight;
  pop.style.top = `${sotto ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`; pop.style.left = `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px`;
}
async function apriAccount() {
  ACCOUNT = await A.getJSON('/api/account');
  // filtri che dipendono dai dati: categorie e docenti presenti
  const cat = A.$('#acc-cat'), doc = A.$('#acc-doc'), vc = cat.value, vd = doc.value;
  cat.innerHTML = '<option value="">Ogni categoria</option>' + Object.entries(A.CATEGORIE).map(([k, v]) => `<option value="${A.esc(k)}">${A.esc(v)}</option>`).join('');
  doc.innerHTML = '<option value="">Ogni docente</option>' + ACCOUNT.filter((a) => a.ruolo === 'docente').sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    .map((a) => `<option value="${A.esc(a.id)}">Studenti di ${A.esc(a.nome)}</option>`).join('');
  cat.value = vc; doc.value = vd;
  disegnaAccount();
}
const accStato = (a) => (!a.confermato ? 0 : a.attivo ? 2 : 1);
function accFiltrati() {
  const f = A.normal(A.$('#acc-filtro').value), v = A.$('#acc-vista').value, c = A.$('#acc-cat').value, d = A.$('#acc-doc').value;
  const l = ACCOUNT.filter((a) => (!f || A.normal([a.nome, a.email, a.sede, A.CATEGORIE[a.categoria]].join(' ')).includes(f))
    && (!v || (v === 'docenti' && a.ruolo === 'docente') || (v === 'iscritti' && a.ruolo === 'specializzando') || (v === 'admin' && a.ruolo === 'admin')
      || (v === 'senza' && a.ruolo === 'specializzando' && !(a.docenti || []).length) || (v === 'inattivi' && !a.attivita?.risposte && a.ruolo !== 'admin')
      || (v === 'attesa' && !a.confermato) || (v === 'off' && !a.attivo))
    && (!c || a.categoria === c) && (!d || (a.docenti || []).includes(d)));
  const k = ACC_ORD.k, val = (a) => ({ nome: a.nome, categoria: A.CATEGORIE[a.categoria] || '', ruolo: a.ruolo, stato: accStato(a), casi: a.attivita?.casi || 0,
    ultima: a.attivita?.ultima || '', creato: a.creato || '', accesso: a.ultimoAccesso || '' }[k]);
  if (k) l.sort((a, b) => { const x = val(a), y = val(b); const r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'it'); return ACC_ORD.su ? r : -r; });
  return l;
}
function disegnaAccount() {
  const nomi = Object.fromEntries(ACCOUNT.map((a) => [a.id, a.nome]));
  const docenti = ACCOUNT.filter((a) => a.ruolo === 'docente' && a.attivo && a.confermato).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  const l = accFiltrati();
  const isc = ACCOUNT.filter((a) => a.ruolo === 'specializzando'), nDoc = ACCOUNT.filter((a) => a.ruolo === 'docente').length;
  const mese = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  // filtri a pillola con il numero di persone (le pillole vuote non compaiono, «Tutti» sì)
  const v = A.$('#acc-vista').value, nAdmin = ACCOUNT.filter((a) => a.ruolo === 'admin').length;
  const pillole = [['', 'Tutti', ACCOUNT.length, '👥'], ['iscritti', A.AZIENDA() ? 'Specializzandi' : 'Iscritti', isc.length, '🎓'], ['docenti', 'Docenti', nDoc, '🧑‍🏫'],
    ['admin', 'Amministratori', nAdmin, '🛡'], ['senza', 'Senza docente', isc.filter((a) => !(a.docenti || []).length).length, '⚠'],
    ['attesa', A.AZIENDA() ? 'Da attivare' : 'Email da confermare', ACCOUNT.filter((a) => !a.confermato).length, '✉'],
    ['inattivi', 'Mai un caso', ACCOUNT.filter((a) => !a.attivita?.risposte && a.ruolo !== 'admin').length, '💤'], ['off', 'Disattivati', ACCOUNT.filter((a) => !a.attivo).length, '⏸']]
    .filter(([f, , n]) => !f || n || f === v);
  A.$('#acc-riepilogo').innerHTML = pillole.map(([f, t, n, ic]) => `<button type="button" role="tab" aria-selected="${v === f}" class="acc-pill${v === f ? ' on' : ''}${f === 'senza' || f === 'attesa' ? ' avviso' : ''}" data-f="${f}"><span aria-hidden="true">${ic}</span>${t}<b>${n}</b></button>`).join('');
  A.$('#acc-riepilogo').querySelectorAll('.acc-pill').forEach((b) => b.onclick = () => { A.$('#acc-vista').value = b.dataset.f; disegnaAccount(); });
  const attivi = ACCOUNT.filter((a) => (a.attivita?.ultima || '') >= mese).length;
  A.$('#acc-stat').textContent = ACCOUNT.length ? `${ACCOUNT.length} ${ACCOUNT.length === 1 ? 'persona' : 'persone'} · ${attivi} ${attivi === 1 ? 'attiva' : 'attive'} negli ultimi 30 giorni` : '';
  A.$('#acc-conta').textContent = l.length === ACCOUNT.length ? `${l.length} ${l.length === 1 ? 'persona' : 'persone'}` : `${l.length} di ${ACCOUNT.length}`;
  A.$('#acc-msg').textContent = ''; A.$('#acc-vuoto').hidden = !!l.length; A.$('.tab-account').hidden = !l.length;
  // prima volta (nessuno da gestire): il modulo dell'invito è già aperto
  if (ACCOUNT.filter((a) => a.id !== A.UTENTE?.id).length === 0 && !ACC_INVITO_VISTO) { ACC_INVITO_VISTO = true; apriInvito(true); }
  A.qsAll('.tab-account th[data-ord]').forEach((th) => { th.className = th.dataset.ord === ACC_ORD.k ? (ACC_ORD.su ? 'ord-su' : 'ord-giu') : ''; });
  const stato = (a) => (!a.confermato ? '<span class="acc-stato attesa">email da confermare</span>' : a.invitoInAttesa ? `<span class="acc-stato attesa" title="Invito inviato il ${A.esc(a.invitoInAttesa)}: non ha ancora scelto la password">invito in attesa</span>` : a.attivo ? '<span class="acc-stato ok">attivo</span>' : '<span class="acc-stato off">disattivato</span>');
  const ruolo = (a) => (a.ruolo === 'admin' ? '<span class="acc-ruolo admin">Amministratore</span>' : a.ruolo === 'docente' ? `<span class="acc-ruolo docente">Docente</span>${a.autore ? ' <span class="acc-ruolo autore" title="Può scrivere e modificare i casi">✎ autore</span>' : ''}` : a.noDocente ? '<span class="acc-ruolo">Iscritto</span> <span class="acc-ruolo bloccato">docente bloccato</span>' : '<span class="acc-ruolo">Iscritto</span>');
  const iniziali = (n) => A.esc(String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase());
  const tinta = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const dataBreveVecchia = (t) => (t && /^\d{4}-\d{2}-\d{2}/.test(t) ? `${new Date(t.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })}${t.length > 10 ? `<br><span class="muted">${A.esc(t.slice(11, 16))}</span>` : ''}` : '—');
  const accesso = (a) => [a.conPassword ? 'password' : '', a.conCodice ? 'codice' : ''].filter(Boolean).join(' + ') || (a.invitoInAttesa ? 'invitato' : '—');
  const studenti = (a) => ACCOUNT.filter((x) => (x.docenti || []).includes(a.id));
  const colDocenti = (a) => {
    if (a.ruolo === 'admin') return '—';
    if (a.ruolo === 'docente') {
      const st = studenti(a);
      return `${st.length ? `<details><summary>${st.length} ${st.length === 1 ? 'studente' : 'studenti'}</summary>${st.map((x) => A.esc(x.nome)).join('<br>')}</details>` : 'nessuno studente'}
        <span class="muted">${a.classi ? ` · ${a.classi} ${a.classi === 1 ? 'classe' : 'classi'}` : ''}</span>`;
    }
    const scelti = (a.docenti || []).map((d) => A.esc(nomi[d] || '?')).join(', ') || '<span class="muted">nessuno</span>';
    const ed = ACC_APERTO === a.id ? `<div class="acc-docenti-ed">${docenti.length ? docenti.filter((d) => d.id !== a.id).map((d) => `<label><input type="checkbox" value="${A.esc(d.id)}"${(a.docenti || []).includes(d.id) ? ' checked' : ''}> ${A.esc(d.nome)}${d.sede ? ` <span class="muted">· ${A.esc(d.sede)}</span>` : ''}</label>`).join('')
      : '<span class="muted">Nessun docente attivo.</span>'}
      <span class="muted small">L'iscritto riceve un'email per i docenti aggiunti e può toglierli dal suo profilo.</span>
      <div class="riga"><button type="button" class="primary" data-az="salvadoc">Salva</button><button type="button" class="ghost" data-az="chiudidoc">Annulla</button></div></div>` : '';
    return `${scelti} <button type="button" class="ghost" data-az="apridoc" title="Scegli i docenti di riferimento">✎</button>${ed}`;
  };
  const att = (a) => (a.ruolo === 'admin' ? '—' : a.attivita?.risposte ? `${a.attivita.casi} ${a.attivita.casi === 1 ? 'caso' : 'casi'}${a.attivita.media != null ? ` · ${a.attivita.media}%` : ''}<br><span class="muted">${a.attivita.risposte} risposte</span>` : '<span class="muted">nessun caso</span>');
  const voce = (az, ic, t, tit = '', cl = '') => `<button type="button" role="menuitem" data-az="${az}"${tit ? ` title="${tit}"` : ''}${cl ? ` class="${cl}"` : ''}><span class="mi" aria-hidden="true">${ic}</span><span class="mt">${t}</span></button>`;
  const azioni = (a) => {
    const ruoloV = a.ruolo === 'admin' ? (a.id === A.UTENTE?.id ? '' : voce('noadmin', '🛡', 'Togli amministratore', 'Toglie i permessi di amministratore: l\'account resta docente'))
      : a.ruolo === 'docente' ? voce('autore', '✎', a.autore ? 'Togli autore' : 'Rendi autore', a.autore ? '' : 'Può scrivere e modificare i casi (riceve un\'email)') + voce('togli', '🚫', 'Togli docente', 'Toglie la funzione docente e impedisce di riattivarla')
      : a.noDocente ? voce('sblocca', '🔓', 'Sblocca docente') : voce('docente', '🧑‍🏫', 'Rendi docente', 'Riceve un\'email');
    const adm = a.ruolo !== 'admin' && a.attivo && a.confermato ? voce('admin', '🛡', 'Rendi amministratore', 'Gestisce account, casi, percorsi e statistiche. Riceve un\'email') : '';
    const acc = (a.confermato ? '' : voce('conferma', '✔', 'Conferma l\'account', 'Attiva l\'account senza aspettare la conferma via email'))
      + (a.conPassword && a.email && a.attivo ? voce('reset', '🔑', 'Invia link password', 'Email con il link per scegliere una nuova password (valido 24 ore)') : '')
      + (a.invitoInAttesa ? voce('invito', '✉', 'Reinvia invito', 'Nuova email con il link per scegliere la password (7 giorni)') : '')
      + (a.conCodice ? voce('codice', '#', 'Nuovo codice') : '');
    const gr = (t, x) => (x ? `<div class="mg-tit">${t}</div>${x}` : '');
    return `<details class="acc-menu"><summary class="btn ghost" aria-label="Azioni per ${A.esc(a.nome)}" title="Azioni">⋯</summary><div class="acc-menu-pop" role="menu">
      ${gr('Ruolo', ruoloV + adm)}${gr('Accesso', acc)}${gr('Account', voce('attivo', a.attivo ? '⏸' : '▶', a.attivo ? 'Disattiva' : 'Riattiva', a.attivo ? 'Non può più entrare finché non lo riattivi' : '') + voce('elimina', '🗑', 'Elimina', 'Elimina l\'account e i suoi dati (premi due volte)', 'pericolo'))}</div></details>`;
  };
  A.$('#acc-lista').innerHTML = l.map((a) => `<tr class="${a.attivo ? '' : 'off'}" data-id="${A.esc(a.id)}">
    <td><div class="acc-chi"><span class="acc-avatar" style="--h:${tinta(a.id)}">${iniziali(a.nome)}</span><div class="acc-nome"><b>${A.esc(a.nome)}</b>
      <span class="small muted">${a.email ? A.esc(a.email) : 'nessuna email'}</span>
      <span class="small muted">${[A.CATEGORIE[a.categoria], a.anno ? `${A.esc(a.anno)}° anno` : '', a.sede].filter(Boolean).map(A.esc).join(' · ')}</span></div></div></td>
    <td><div class="acc-ruoli">${ruolo(a)}</div>${stato(a)}</td>
    <td class="small">${colDocenti(a)}</td>
    <td class="small">${att(a)}${a.attivita?.ultima ? `<br><span class="muted" title="Ultimo caso: ${A.esc(dataLunga(a.attivita.ultima))}">ultimo ${quandoFa(a.attivita.ultima)}</span>` : ''}</td>
    <td class="small"><span title="${A.esc(dataLunga(a.ultimoAccesso))}${a.ultimoAccesso ? '' : 'mai'}">${a.ultimoAccesso ? quandoFa(a.ultimoAccesso) : '<span class="muted">mai</span>'}</span><br><span class="muted" title="Iscritto il ${A.esc(dataLunga(a.creato))} · accesso con ${accesso(a)}">iscritto ${quandoFa(a.creato)}</span></td>
    <td class="acc-azioni">${azioni(a)}</td></tr>`).join('');
  A.qsAll('#acc-lista details.acc-menu').forEach((d) => d.addEventListener('toggle', () => {
    if (!d.open) return; for (const x of A.qsAll('#acc-lista details.acc-menu[open]')) if (x !== d) x.open = false; posizionaMenuAcc(d);
  }));
  A.qsAll('#acc-lista button').forEach((b) => b.onclick = async () => {
    const tr = b.closest('tr'), id = tr.dataset.id, a = ACCOUNT.find((x) => x.id === id), az = b.dataset.az;
    if (az === 'apridoc') { ACC_APERTO = ACC_APERTO === id ? '' : id; disegnaAccount(); return; }
    if (az === 'chiudidoc') { ACC_APERTO = ''; disegnaAccount(); return; }
    if ((az === 'elimina' || az === 'codice' || az === 'togli' || az === 'admin' || az === 'noadmin') && b.dataset.conferma !== '1') {   // seconda pressione per confermare
      b.dataset.conferma = '1'; const t = b.innerHTML; b.innerHTML = '<span class="mi" aria-hidden="true">❓</span><span class="mt">Confermi? Premi di nuovo</span>'; b.classList.add('conferma');
      setTimeout(() => { b.dataset.conferma = ''; b.innerHTML = t; b.classList.remove('conferma'); }, 4000); return;
    }
    try {
      if (az === 'salvadoc') {
        const sc = [...tr.querySelectorAll('.acc-docenti-ed input:checked')].map((x) => x.value);
        const r = await A.postJSON(`/api/account/${id}`, { docenti: sc }); ACC_APERTO = '';
        A.$('#acc-msg').textContent = `Docenti di ${a.nome} aggiornati${r.avvisati ? ': avviso inviato per email' : ''} ✓`;
      }
      if (az === 'docente') { const r = await A.postJSON(`/api/account/${id}`, { ruolo: 'docente', noDocente: false }); A.$('#acc-msg').textContent = `${a.nome} ora è docente${r.avvisatoRuolo ? `: email inviata a ${a.email}` : a.email ? ' (email non inviata)' : ' (nessuna email per avvisarlo)'} ✓`; }
      if (az === 'sblocca') await A.postJSON(`/api/account/${id}`, { noDocente: false });
      if (az === 'togli') await A.postJSON(`/api/account/${id}`, { noDocente: true });
      if (az === 'autore') { const r = await A.postJSON(`/api/account/${id}`, { autore: !a.autore }); A.$('#acc-msg').textContent = a.autore ? `${a.nome} non è più autore ✓` : `${a.nome} ora è autore dei casi${r.avvisatoRuolo ? `: email inviata a ${a.email}` : a.email ? ' (email non inviata)' : ' (nessuna email per avvisarlo)'} ✓`; }
      if (az === 'conferma') await A.postJSON(`/api/account/${id}`, { conferma: true });
      if (az === 'admin') { await A.postJSON(`/api/account/${id}`, { ruolo: 'admin' }); A.$('#acc-msg').textContent = `${a.nome} ora è amministratore${a.email ? ` (avviso inviato a ${a.email})` : ''} ✓`; }
      if (az === 'noadmin') { await A.postJSON(`/api/account/${id}`, { ruolo: 'docente' }); A.$('#acc-msg').textContent = `${a.nome} non è più amministratore (resta docente) ✓`; }
      if (az === 'reset') { await A.postJSON(`/api/account/${id}/reset`); A.$('#acc-msg').textContent = `Link per la nuova password inviato a ${a.email} (valido 24 ore) ✓`; }
      if (az === 'invito') { await A.postJSON(`/api/account/${id}/invito`); A.$('#acc-msg').textContent = `Invito inviato di nuovo a ${a.email} ✓`; }
      if (az === 'codice') { const r = await A.postJSON(`/api/account/${id}/codice`); tr.closest('main').querySelector('.acc-codici').open = true; mostraCodice(a.nome, r.codice, false); }
      if (az === 'attivo') await A.postJSON(`/api/account/${id}`, { attivo: !a.attivo });
      if (az === 'elimina') await A.postJSON(`/api/account/${id}/elimina`);
      const msg = A.$('#acc-msg').textContent; await apriAccount(); if (['salvadoc', 'invito', 'docente', 'autore', 'admin', 'noadmin', 'reset'].includes(az)) A.$('#acc-msg').textContent = msg;
    } catch (e) { if (!(e instanceof A.NonAutorizzato)) A.$('#acc-msg').textContent = 'Errore: ' + e.message; }
  });
}
// istruzioni che app.js eseguiva al caricamento (pulsanti e moduli di queste pagine): ora una volta, al primo uso
export function avvio() {
  NOMI_PAGINE = { cruscotto: 'Cruscotto', vetrini: 'Vetrini digitali', allenamento: 'Allenamento', progressi: 'I miei progressi', elenco: 'Elenco dei casi', caso: 'Caso (quiz e visualizzatore)', editor: 'Editor del caso', nuovo: 'Nuovo caso', aggiungi: 'Aggiungi immagini', analisi: 'Analisi dei risultati',
    esame: 'Esame simulato', confronto: 'Confronto tra esami', proponi: 'Proponi un caso', errore: 'Cerca l\'errore', aiuto: 'Aiuto e guida', profilo: 'Profilo', 'gestione-casi': 'Gestione dei casi',
    classi: 'Classi', percorsi: 'Percorsi didattici', revisione: 'Revisione dei casi', account: 'Iscritti e docenti', accesso: 'Pagina di accesso', iscriviti: 'Iscrizione',
    conferma: 'Conferma email', 'nuova-password': 'Nuova password' };
  SOGLIE_AWS = { richieste: 10e6, byte: 1e12, invocazioni: 1e6, gbs: 4e5, tabella: 25e9 };
  TR_GIORNI = 30;
  A.qsAll('.tr-periodo button').forEach((b) => b.addEventListener('click', () => apriTraffico(Number(b.dataset.g))));
  A.$('#tr-aggiorna').addEventListener('click', () => apriTraffico(TR_GIORNI));
  POS_SPONSOR = { accesso: 'Pagina di accesso', home: 'Home (elenco dei casi)', caso: 'Fine del caso, dopo la risposta' };
  SP_LISTA = [];
  SP_MOD = null;
  A.$('#sp-nuovo').addEventListener('click', () => formSponsor(null));
  A.$('#sp-annulla').addEventListener('click', () => { A.$('#sp-form').hidden = true; });
  A.$('#sp-form').elements.logo.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) { A.$('#sp-esito').textContent = 'Formato non valido: PNG, JPEG, WebP o SVG.'; return; }
    if (file.size > 200 * 1024) { A.$('#sp-esito').textContent = 'Logo troppo grande: al massimo 200 kB.'; return; }
    const r = new FileReader(); r.onload = () => { A.$('#sp-form').dataset.logo = r.result; A.$('#sp-anteprima').innerHTML = `<img src="${A.esc(r.result)}" alt="">`; A.$('#sp-esito').textContent = ''; }; r.readAsDataURL(file);
  });
  A.$('#sp-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    const d = { nome: f.elements.nome.value, link: f.elements.link.value.trim(), testo: f.elements.testo.value, dal: f.elements.dal.value, al: f.elements.al.value,
      attivo: f.elements.attivo.checked, posizioni: [...f.querySelectorAll('[name=pos]:checked')].map((c) => c.value), logo: f.dataset.logo || '' };
    if (!d.logo) { A.$('#sp-esito').textContent = 'Serve il logo: è quello che compare nelle pagine.'; return; }
    try { await A.postJSON('/api/sponsor' + (SP_MOD ? '/' + encodeURIComponent(SP_MOD.id) : ''), d); f.hidden = true; A.SPONSOR = null; await apriSponsor(); }
    catch (er) { A.$('#sp-esito').textContent = er.message; }
  });
  STATI_TENANT = { in_corso: ['Lavoro in corso su AWS…', 'attesa'], da_creare: ['In coda di creazione', 'attesa'], da_aggiornare: ['In coda di aggiornamento', 'attesa'], attiva: ['Attiva', 'ok'], sospesa: ['Sospesa', 'off'],
    da_smontare: ['Da smontare', 'ko'], smontata: ['Smontata', 'off'], errore: ['Errore di pubblicazione', 'ko'] };
  PIANI_TENANT = { pilota: 'Pilota', base: 'Base', pro: 'Pro', personalizzato: 'Personalizzato' };
  TENANT = { zona: '', elenco: [] };
  TN_MOD = null;
  A.$('#tn-form').elements.cliente.addEventListener('input', (e) => { const f = A.$('#tn-form'); if (!TN_MOD && !f.elements.id.dataset.toccato) { f.elements.id.value = A.normal(e.target.value).replace(/\b(azienda|ospedaliera|universitaria|policlinico|di|del|della|e|s\.?r\.?l\.?)\b/g, ' ').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30); aggiornaAnteprimaTenant(); } });
  A.$('#tn-form').elements.id.addEventListener('input', (e) => { e.target.dataset.toccato = '1'; aggiornaAnteprimaTenant(); });
  A.$('#tn-nuovo').addEventListener('click', () => { delete A.$('#tn-form').elements.id.dataset.toccato; formTenant(null); });
  A.$('#tn-annulla').addEventListener('click', () => { A.$('#tn-form').hidden = true; });
  A.$('#tn-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target, d = {};
    for (const k of ['id', 'cliente', 'nomeIstanza', 'referenteNome', 'referenteEmail', 'contatto', 'utentiMax', 'scadenza', 'note', 'piano']) d[k] = f.elements[k].value;
    try { await A.postJSON('/api/tenant' + (TN_MOD ? '/' + encodeURIComponent(TN_MOD.id) : ''), d); f.hidden = true; await apriTenant(); }
    catch (er) { A.$('#tn-esito').textContent = er.message; }
  });
  // ---------------------------------------------------------------- statistiche d'uso aggregate (amministratore)
  A.$('#sp-stat-calcola').addEventListener('click', async () => {
    const box = A.$('#sp-stat-corpo'); box.innerHTML = '<p class="muted">Calcolo…</p>';
    try {
      const d = await A.getJSON('/api/statistiche');
      if (!A.PERCORSI.length) await A.caricaPercorsi();
      if (!A.ELENCO.length) A.ELENCO = await A.getJSON('/api/casi');
      const completati = A.PERCORSI_FISSI.map((p) => { const casi = p.casi.filter((id) => A.ELENCO.some((c) => c.id === id && c.visibile !== false));
        return { t: p.titolo, n: casi.length ? d.migliori.filter((m) => casi.every((id) => (m[id] ?? -1) >= A.SOGLIA_SUPERATO)).length : 0 }; })
        .filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
      const it = (n) => Number(n || 0).toLocaleString('it-IT');
      const nomeMese = (m) => new Date(m + '-15').toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
      const tile = (v, t) => `<div class="sp-tile"><div class="grande">${v}</div><small>${t}</small></div>`;
      box.innerHTML = `<div class="sp-rapporto"><h3>${A.esc(A.ISTANZA.nome || location.host)} — statistiche d'uso al ${A.esc(d.generato.slice(0, 10).split('-').reverse().join('/'))}</h3>
        <div class="sp-tiles">${tile(it(d.iscritti.totale), 'iscritti')}${tile(it(d.iscritti.attivi30), 'attivi negli ultimi 30 giorni')}${tile(it(d.iscritti.docenti), 'docenti')}
          ${tile(it(d.risposte.totale), 'casi svolti (risposte)')}${tile(it(d.risposte.ultimi30), 'casi svolti negli ultimi 30 giorni')}${tile(it(d.risposte.referti), 'referti scritti')}
          ${tile(it(completati.reduce((t, x) => t + x.n, 0)), 'percorsi completati')}${tile(it(Object.values(d.esami || {}).reduce((t, x) => t + x, 0)), 'esami simulati')}</div>
        <div class="griglia2"><div><h4>Iscritti per categoria</h4><table class="tab">${Object.entries(d.iscritti.categorie).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${A.esc(k)}</td><td class="num">${it(v)}</td></tr>`).join('') || '<tr><td class="muted">—</td></tr>'}</table></div>
          <div><h4>Percorsi completati</h4><table class="tab">${completati.map((x) => `<tr><td>${A.esc(x.t)}</td><td class="num">${it(x.n)}</td></tr>`).join('') || '<tr><td class="muted">Nessuno ancora</td></tr>'}</table></div></div>
        <h4>Andamento mensile</h4><table class="tab"><thead><tr><th>Mese</th><th>Nuovi iscritti</th><th>Persone attive</th><th>Casi svolti</th></tr></thead><tbody>${d.perMese.slice(-12).map((m) => `<tr><td>${A.esc(nomeMese(m.mese))}</td><td class="num">${it(m.iscrizioni)}</td><td class="num">${it(m.attivi)}</td><td class="num">${it(m.risposte)}</td></tr>`).join('')}</tbody></table>
        ${(d.lettura || []).length ? `<h4>Accuratezza di lettura per metodica</h4><table class="tab"><thead><tr><th>Metodica</th><th>Persone</th><th>Punteggio (mediana)</th><th>Sensibilità (mediana)</th><th>Specificità (mediana)</th></tr></thead><tbody>${d.lettura.map((x) => `<tr><td>${A.esc(x.area)}</td><td class="num">${it(x.persone)}</td><td class="num">${x.media ?? '—'}%</td><td class="num">${x.sens ?? '—'}%</td><td class="num">${x.spec ?? '—'}%</td></tr>`).join('')}</tbody></table><p class="muted small">Primo tentativo dei casi a scelta multipla; solo metodiche con almeno 5 persone.</p>` : ''}
        ${d.prePost?.coppie ? `<h4>Miglioramento nei percorsi (test d'ingresso → finale)</h4><p>${it(d.prePost.coppie)} ${d.prePost.coppie === 1 ? 'persona' : 'persone'}: da ${d.prePost.prima}% a ${d.prePost.dopo}% di media (${d.prePost.dopo - d.prePost.prima >= 0 ? '+' : ''}${d.prePost.dopo - d.prePost.prima} punti).</p>` : ''}
        <p class="muted small">Casi diversi svolti: ${it(d.risposte.casiDiversi)} · punteggio medio ${d.risposte.media ?? '—'}% · attivi negli ultimi 90 giorni: ${it(d.iscritti.attivi90)}. Nessun dato personale è incluso.</p></div>`;
      A.$('#sp-stat-stampa').hidden = false;
    } catch (e) { box.innerHTML = `<p class="stato ko">${A.esc(e.message)}</p>`; }
  });
  A.$('#sp-stat-stampa').addEventListener('click', () => {
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Statistiche d'uso</title><style>body{font:14px system-ui,sans-serif;margin:24px;color:#111}.sp-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.sp-tile{border:1px solid #ccc;border-radius:8px;padding:10px;text-align:center}.grande{font-size:24px;font-weight:700}table{border-collapse:collapse;width:100%;margin:6px 0 14px}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}.num{text-align:right}.griglia2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.muted{color:#666}</style></head><body>${A.$('#sp-stat-corpo').innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  });
  ACCOUNT = [];
  ACC_ORD = { k: '', su: true };
  ACC_APERTO = '';
  ACC_INVITO_VISTO = false;
  A.$('#acc-invita-apri').addEventListener('click', () => apriInvito());
  A.$('#inv-chiudi').addEventListener('click', () => apriInvito(false));
  A.qsAll('#form-invito input[name="inv-r"]').forEach((r) => r.addEventListener('change', () => { A.$('#inv-ruolo').value = r.value; }));
  document.addEventListener('pointerdown', (e) => { for (const d of A.qsAll('#acc-lista details.acc-menu[open]')) if (!d.contains(e.target)) d.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') for (const d of A.qsAll('#acc-lista details.acc-menu[open]')) { d.open = false; d.querySelector('summary').focus(); } });
  addEventListener('scroll', () => { for (const d of A.qsAll('#acc-lista details.acc-menu[open]')) posizionaMenuAcc(d); }, { passive: true, capture: true });
  ['#acc-filtro', '#acc-vista', '#acc-cat', '#acc-doc'].forEach((s) => A.$(s).addEventListener(s === '#acc-filtro' ? 'input' : 'change', () => disegnaAccount()));
  A.qsAll('.tab-account th[data-ord]').forEach((th) => th.addEventListener('click', () => {
    ACC_ORD = { k: th.dataset.ord, su: ACC_ORD.k === th.dataset.ord ? !ACC_ORD.su : !['casi', 'ultima', 'creato', 'accesso'].includes(th.dataset.ord) }; disegnaAccount();
  }));
  A.$('#acc-csv').addEventListener('click', () => {
    const nomi = Object.fromEntries(ACCOUNT.map((a) => [a.id, a.nome]));
    const c = (v) => { const t = String(v ?? ''); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const righe = [['Nome', 'Email', 'Categoria', 'Anno', 'Sede', 'Ruolo', 'Autore', 'Stato', 'Accesso', 'Avvisi email', 'Docenti di riferimento', 'Studenti', 'Classi',
      'Casi svolti', 'Risposte', 'Punteggio medio %', 'Ultimo caso', 'Iscritto', 'Ultimo accesso'].join(';'),
      ...accFiltrati().map((a) => [a.nome, a.email, A.CATEGORIE[a.categoria] || '', a.anno, a.sede, a.ruolo, a.autore ? 'sì' : '', !a.confermato ? 'email da confermare' : a.attivo ? 'attivo' : 'disattivato',
        [a.conPassword ? 'password' : '', a.conCodice ? 'codice' : ''].filter(Boolean).join('+'), a.avvisi ? 'sì' : 'no', (a.docenti || []).map((d) => nomi[d] || '?').join(', '),
        a.ruolo === 'docente' ? a.seguaci : '', a.ruolo === 'docente' ? a.classi : '', a.attivita?.casi ?? 0, a.attivita?.risposte ?? 0, a.attivita?.media ?? '', a.attivita?.ultima || '',
        a.creato, a.ultimoAccesso].map(c).join(';'))];
    const x = document.createElement('a'); x.href = URL.createObjectURL(new Blob(['﻿' + righe.join('\n')], { type: 'text/csv;charset=utf-8' }));
    x.download = `iscritti-${new Date().toISOString().slice(0, 10)}.csv`; x.click();
  });
  A.$('#form-invito').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = A.$('#inv-msg');
    try {
      const r = await A.postJSON('/api/account', { nome: A.$('#inv-nome').value, email: A.$('#inv-email').value, ruolo: A.$('#inv-ruolo').value, invita: true });
      A.$('#inv-nome').value = ''; A.$('#inv-email').value = ''; await apriAccount(); apriInvito(false); A.$('#acc-msg').textContent = `✓ Invito inviato a ${r.account.email}`;
    } catch (e2) { if (!(e2 instanceof A.NonAutorizzato)) m.textContent = 'Errore: ' + e2.message; }
  });
  A.$('#form-account').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await A.postJSON('/api/account', { nome: A.$('#acc-nome').value, ruolo: A.$('#acc-ruolo').value, email: A.$('#acc-email').value });
      A.$('#acc-nome').value = ''; A.$('#acc-email').value = ''; mostraCodice(r.account.nome, r.codice, true); await apriAccount();
    } catch (e2) { if (!(e2 instanceof A.NonAutorizzato)) A.$('#acc-msg').textContent = 'Errore: ' + e2.message; }
  });
}
export { apriTraffico, apriSponsor, apriTenant, apriAccount };
