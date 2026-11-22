// Sfide tra amici (22/11/2026): chi è iscritto sceglie da 3 a 10 casi, li condivide con un link (radio-quiz.it/s/<codice>)
// e chi lo apre gioca gli stessi casi. Correzioni alla fine (come l'esame simulato), classifica solo per chi la sceglie,
// con il nome che sceglie. Le regole stanno sul server (api/logica.mjs, punteggiSfida); qui le pagine.
// Si carica solo quando serve (app.js, caricaSfide). Niente import './app.js': i nomi dell'app arrivano dal ponte.
let A = null;
export const collega = (p) => { A = p; };
const MIN = 3, MAX = 10;
const mmss = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const corpo = () => A.$('#sfida-corpo');
const dataOra = (o16) => { const d = new Date(String(o16).replace(' ', 'T') + ':00Z'); return isNaN(d) ? '' : d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };
// «chiude tra 5 ore e 20 minuti», «chiude tra 3 giorni»
function traQuanto(o16) {
  const ms = new Date(String(o16).replace(' ', 'T') + ':00Z') - Date.now(); if (!(ms > 0)) return 'chiusa';
  const min = Math.round(ms / 60000), g = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (g >= 2) return `chiude tra ${g} giorni`;
  if (g === 1) return `chiude tra 1 giorno${h ? ` e ${h} ${h === 1 ? 'ora' : 'ore'}` : ''}`;
  if (h) return `chiude tra ${h} ${h === 1 ? 'ora' : 'ore'}${m ? ` e ${m} min` : ''}`;
  return `chiude tra ${Math.max(1, m)} min`;
}
const leggiLocale = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const scriviLocale = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ---------------------------------------------------------------- condivisione
// i social non permettono di taggare dal sito: si condivide il link e gli amici li tagga chi pubblica
function testoPost(titolo, n, fine) {
  return `🏁 Ti sfido su Quiz Radiologia: «${titolo}», ${n} ${n === 1 ? 'caso' : 'casi'} di diagnostica per immagini. Hai tempo fino a ${dataOra(fine)}: chi legge meglio?\n@ @ @`;
}
function htmlCondividi(link, titolo, n, fine) {
  return `<div class="sf-condividi">
    <ol class="sf-passi"><li>Scrivi il post: sostituisci le <b>@</b> con gli amici da sfidare (sui social, scrivendo @ e il nome compaiono i tuoi contatti).</li>
      <li>Scegli dove pubblicarlo: il link della sfida è già aggiunto.</li></ol>
    <label>Testo del post <textarea id="sf-testo" rows="4">${A.esc(testoPost(titolo, n, fine))}</textarea></label>
    <div class="sf-social">
      ${navigator.share ? '<button type="button" class="primary" id="sf-condividi">📤 Condividi…</button>' : ''}
      <a class="btn ghost" target="_blank" rel="noopener" data-sf="wa">WhatsApp</a>
      <a class="btn ghost" target="_blank" rel="noopener" data-sf="x">X</a>
      <a class="btn ghost" target="_blank" rel="noopener" data-sf="li" title="LinkedIn apre il post con il link: incolla il testo (è già copiato)">LinkedIn</a>
      <a class="btn ghost" target="_blank" rel="noopener" data-sf="fb" title="Facebook apre il post con il link: incolla il testo (è già copiato)">Facebook</a>
      <a class="btn ghost" data-sf="mail">Email</a>
      <button type="button" class="ghost" id="sf-copia-tutto">Copia testo e link</button>
    </div>
    <div class="sf-link"><input id="sf-link" readonly value="${A.esc(link)}" aria-label="Link della sfida"><button type="button" class="ghost" id="sf-copia">Copia il link</button></div>
    <p class="muted small">Il sito non pubblica nulla per te e non conosce i contatti dei tuoi amici: i tag li metti tu nel post o nella storia (Instagram: copia testo e link e incollali nella storia). LinkedIn e Facebook non accettano un testo già scritto: lo copiamo noi, tu lo incolli.</p>
  </div>`;
}
function attivaCondividi(link, titolo) {
  const testo = () => (A.$('#sf-testo')?.value || '').trim(), tutto = () => `${testo()}\n${link}`;
  const copia = async (t, b, et) => { try { await navigator.clipboard.writeText(t); } catch { const x = document.createElement('textarea'); x.value = t; document.body.append(x); x.select(); document.execCommand?.('copy'); x.remove(); }
    if (b) { b.textContent = 'Copiato ✓'; setTimeout(() => { b.textContent = et; }, 2500); } };
  const b = A.$('#sf-copia'); if (b) b.onclick = () => copia(link, b, 'Copia il link');
  const bt = A.$('#sf-copia-tutto'); if (bt) bt.onclick = () => copia(tutto(), bt, 'Copia testo e link');
  const u = encodeURIComponent(link);
  const indirizzi = { wa: () => `https://wa.me/?text=${encodeURIComponent(tutto())}`, x: () => `https://x.com/intent/post?text=${encodeURIComponent(testo())}&url=${u}`,
    li: () => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, fb: () => `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    mail: () => `mailto:?subject=${encodeURIComponent('Sfida su Quiz Radiologia: ' + titolo)}&body=${encodeURIComponent(tutto())}` };
  for (const a of document.querySelectorAll('#sfida-corpo [data-sf]')) {
    const k = a.dataset.sf; a.href = indirizzi[k]();
    a.onclick = () => { a.href = indirizzi[k](); if (k === 'li' || k === 'fb') { copia(tutto()); A.avvisoBreve('Testo copiato: incollalo nel post e tagga gli amici.'); } };
  }
  const s = A.$('#sf-condividi'); if (s) s.onclick = () => navigator.share({ title: 'Sfida su Quiz Radiologia', text: testo(), url: link }).catch(() => {});
}

// ---------------------------------------------------------------- dopo l'accesso: si torna alla sfida
export function inSospeso() {
  const x = leggiLocale('rq-sfida-dopo'); scriviLocale('rq-sfida-dopo', null);
  return x && Date.now() - x.t < 864e5 && /^[A-HJ-NP-Z2-9]{8}$/.test(x.c) ? x.c : '';
}

// ---------------------------------------------------------------- pagina pubblica (prima dell'accesso)
export async function apriPubblica(codice) {
  const c = String(codice || '').toUpperCase();
  corpo().innerHTML = '<p class="muted">Carico la sfida…</p>';
  let d = null, err = '';
  try { const r = await fetch(`/api/sfide/${encodeURIComponent(c)}/anteprima`, { credentials: 'same-origin' }); if (r.ok) d = await r.json(); else err = (await r.json().catch(() => ({}))).errore || 'Sfida non trovata.'; } catch { err = 'Connessione assente: riprova.'; }
  if (!d) { corpo().innerHTML = `<section class="sf-testa"><h1>🏁 Sfida</h1><p class="stato errore">${A.esc(err)}</p><p><a href="#/">Vai a Quiz Radiologia</a></p></section>`; return; }
  corpo().innerHTML = `<section class="sf-testa"><span class="sf-ico" aria-hidden="true">🏁</span><div>
      <p class="sf-sopra">Sfida su Quiz Radiologia</p><h1>${A.esc(d.titolo)}</h1>
      <p class="muted">${d.casi.length} ${d.casi.length === 1 ? 'caso' : 'casi'} · ${d.partecipanti} ${d.partecipanti === 1 ? 'partecipante' : 'partecipanti'} · ${d.aperta ? `<b>${traQuanto(d.fine)}</b> (${dataOra(d.fine)})` : 'sfida chiusa'}</p></div></section>
    <ol class="sf-casi">${d.casi.map((x) => `<li><b>${A.esc(x.titolo)}</b> <span class="muted small">${A.esc([x.modalita, x.distretto].filter(Boolean).join(' · '))}</span></li>`).join('')}</ol>
    ${d.aperta ? `<div class="sf-azioni"><button type="button" class="primary" id="sf-entra">Entra o iscriviti per accettare</button></div>
      <p class="muted small">Serve un account gratuito (per salvare il punteggio; solo per maggiorenni). Con Google o LinkedIn bastano due clic, poi torni qui.</p>` : '<p class="avviso">La sfida è chiusa: non si possono più aggiungere partecipanti.</p>'}
    <p class="muted small">Strumento solo formativo, non è un dispositivo medico. Immagini anonime da archivi pubblici.</p>`;
  const b = A.$('#sf-entra'); if (b) b.onclick = () => { scriviLocale('rq-sfida-dopo', { c, t: Date.now() }); A.mostraAccesso('Entra o iscriviti: poi torni alla sfida «' + d.titolo + '».'); };
}

// ---------------------------------------------------------------- pagina della sfida (con l'accesso)
export async function apriSfida(codice) {
  const c = String(codice || '').toUpperCase();
  corpo().innerHTML = '<p class="muted">Carico la sfida…</p>';
  let d;
  try { d = await A.getJSON('/api/sfide/' + encodeURIComponent(c)); }
  catch (e) { if (e instanceof A.NonAutorizzato) throw e; corpo().innerHTML = `<section class="sf-testa"><h1>🏁 Sfida</h1><p class="stato errore">${A.esc(e.message)}</p><p><a href="#/sfide">Le mie sfide</a></p></section>`; return; }
  A.$('#titolo-caso').textContent = '';
  const io = d.io, n = d.casi.length, daFare = io ? d.casi.filter((x) => io.casi[x.id] == null) : d.casi;
  const corr = leggiLocale('rq-sfida-corr-' + c);
  // chi ha appena creato la sfida (e non gioca ancora): l'invito agli amici viene per primo
  const invitoInCima = d.creatore && !io && d.aperta;
  const invito = `<section class="sf-scheda"><h2>${io?.finito ? 'Rilancia la sfida' : 'Invita gli amici'}</h2>${htmlCondividi(d.link, d.titolo, n, d.fine)}</section>`;
  const stato = !d.aperta ? 'Sfida chiusa' : io?.finito ? 'Hai completato la sfida' : io ? `Ne hai svolti ${io.fatti} su ${n}` : '';
  corpo().innerHTML = `<section class="sf-testa"><span class="sf-ico" aria-hidden="true">🏁</span><div>
      <p class="sf-sopra">Sfida${d.creatore ? ' · l\'hai creata tu' : ''}</p><h1>${A.esc(d.titolo)}</h1>
      <p class="muted">${n} ${n === 1 ? 'caso' : 'casi'} · ${d.partecipanti} ${d.partecipanti === 1 ? 'partecipante' : 'partecipanti'} · ${d.aperta ? `<b>${traQuanto(d.fine)}</b> (${dataOra(d.fine)})` : 'chiusa'}</p>
      ${stato ? `<p class="sf-stato">${A.esc(stato)}${io ? ` · punteggio medio <b>${io.media}%</b>` : ''}</p>` : ''}</div></section>

    ${invitoInCima ? invito : ''}
    ${!io && d.aperta ? `<section class="sf-scheda sf-accetta"><h2>${d.creatore ? 'Giochi anche tu?' : 'Accetti la sfida?'}</h2>
      <p>Risolvi i casi come al solito: <b>le correzioni le vedi alla fine</b>, quando hai consegnato tutti i casi. Conta la prima risposta che dai a ogni caso da adesso.</p>
      <label class="check"><input type="checkbox" id="sf-in-classifica"> Mostra il mio nome e il mio punteggio nella classifica della sfida</label>
      <label id="sf-nome-riga" hidden>Nome da mostrare (anche uno pseudonimo) <input id="sf-nome" maxlength="40" value="${A.esc((A.UTENTE?.nome || '').split(/\s+/)[0] || '')}"></label>
      <p class="muted small">La classifica la vede chi ha il link della sfida: nome scelto, casi svolti, punteggio medio e tempo, mai le tue risposte. Se non scegli la classifica, il punteggio lo vedi solo tu. Puoi cambiare idea o lasciare la sfida quando vuoi.</p>
      <div class="sf-azioni"><button type="button" class="primary" id="sf-accetta">Accetta e inizia</button></div><p class="stato" id="sf-msg"></p></section>` : ''}

    ${io && d.aperta && daFare.length ? `<div class="sf-azioni"><button type="button" class="primary" id="sf-gioca">${io.fatti ? '▶ Continua la sfida' : '▶ Inizia la sfida'} (${daFare.length} ${daFare.length === 1 ? 'caso' : 'casi'})</button></div>` : ''}

    <section class="sf-scheda"><h2>Casi</h2><ol class="sf-casi">${d.casi.map((x) => {
      const p = io?.casi[x.id];
      return `<li><b>${A.esc(x.titolo)}</b> <span class="muted small">${A.esc([x.modalita, x.distretto].filter(Boolean).join(' · '))}</span>
        ${p != null ? `<span class="sf-punti ${p >= 75 ? 'ok' : p >= 50 ? 'medio' : 'ko'}">${p}%</span>` : io ? '<span class="muted small">da fare</span>' : ''}</li>`; }).join('')}</ol>
      ${io?.finito || (!d.aperta && io) ? `<p class="muted small">Correzioni: ${corr ? '<button type="button" class="ghost" id="sf-corr">Mostra le correzioni</button>' : 'riapri un caso per rivederlo con le immagini.'} Chi non ha ancora giocato potrebbe leggere i tuoi commenti: non svelare le risposte sui social.</p>` : ''}
      <div id="sf-corr-box" hidden></div></section>

    <section class="sf-scheda"><h2>Classifica</h2>
      ${d.classifica.length ? `<table class="sf-classifica"><thead><tr><th>#</th><th>Nome</th><th>Casi</th><th>Punteggio medio</th><th>Tempo</th></tr></thead><tbody>
        ${d.classifica.map((x, i) => `<tr class="${x.io ? 'io' : ''}"><td>${i + 1}${i === 0 && x.fatti ? ' 🥇' : i === 1 && x.fatti ? ' 🥈' : i === 2 && x.fatti ? ' 🥉' : ''}</td><td>${A.esc(x.nome)}${x.io ? ' <span class="muted small">(tu)</span>' : ''}</td><td>${x.fatti}/${n}</td><td><b>${x.media}%</b></td><td>${mmss(x.tempo)}</td></tr>`).join('')}</tbody></table>
        <p class="muted small">Ordine: punteggio medio sui ${n} casi (i casi non svolti valgono 0), poi tempo totale.</p>`
        : '<p class="muted">Nessuno in classifica per ora: entra in classifica solo chi lo sceglie.</p>'}</section>

    ${(io || d.creatore) && !invitoInCima ? invito : ''}

    ${io ? `<details class="sf-scheda"><summary>La mia partecipazione</summary>
      <label class="check"><input type="checkbox" id="sf-in-classifica2" ${io.classifica ? 'checked' : ''}> Mostra il mio nome e il mio punteggio nella classifica</label>
      <label>Nome da mostrare <input id="sf-nome2" maxlength="40" value="${A.esc(io.nome || '')}"></label>
      <div class="sf-azioni"><button type="button" class="ghost" id="sf-salva">Salva</button><button type="button" class="ghost pericolo" id="sf-lascia">Lascia la sfida</button></div><p class="stato" id="sf-msg2"></p></details>` : ''}
    ${d.creatore && d.aperta ? '<p><button type="button" class="ghost" id="sf-chiudi">Chiudi la sfida</button> <span class="muted small">Nessuno potrà più accettarla; la classifica resta.</span></p>' : ''}
    <p><a href="#/sfide">← Le mie sfide</a></p>`;

  const nomeRiga = A.$('#sf-nome-riga'), chk = A.$('#sf-in-classifica');
  if (chk) chk.onchange = () => { nomeRiga.hidden = !chk.checked; if (chk.checked) A.$('#sf-nome').focus(); };
  const gioca = (casi) => {
    const ora = Date.now();
    A.scriviSessione('quiz-casuale', null);
    A.scriviSessione('quiz-giro', { tipo: 'esame', livello: 'sfida', sfida: c, id: 'sfida-' + c, titolo: d.titolo, casi: casi.map((x) => x.id), visti: [], inizio: ora,
      scadenza: ora + 30 * 864e5, minuti: 0, ambito: `sfida «${d.titolo}»`, risultati: {}, totale: n, giaFatti: io?.fatti || 0 });
    location.hash = '#/caso/' + encodeURIComponent(casi[0].id);
  };
  const acc = A.$('#sf-accetta');
  if (acc) acc.onclick = async () => {
    acc.disabled = true;
    try { await A.postJSON(`/api/sfide/${c}/partecipa`, { nome: chk.checked ? A.$('#sf-nome').value : '', classifica: chk.checked }); gioca(d.casi); }
    catch (e) { if (!(e instanceof A.NonAutorizzato)) A.$('#sf-msg').textContent = e.message; acc.disabled = false; }
  };
  const g = A.$('#sf-gioca'); if (g) g.onclick = () => gioca(daFare);
  if (io || d.creatore) attivaCondividi(d.link, d.titolo);
  const cb = A.$('#sf-corr');
  if (cb) cb.onclick = () => { const box = A.$('#sf-corr-box'); box.hidden = !box.hidden; if (!box.hidden) box.innerHTML = htmlCorrezioni(corr); };
  const sv = A.$('#sf-salva');
  if (sv) sv.onclick = async () => {
    try { await A.postJSON(`/api/sfide/${c}/partecipa`, { nome: A.$('#sf-nome2').value, classifica: A.$('#sf-in-classifica2').checked }); A.$('#sf-msg2').textContent = 'Salvato ✓'; setTimeout(() => apriSfida(c), 600); }
    catch (e) { if (!(e instanceof A.NonAutorizzato)) A.$('#sf-msg2').textContent = e.message; }
  };
  const la = A.$('#sf-lascia');
  if (la) la.onclick = async () => {
    if (!confirm('Lasciare la sfida? Esci dalla classifica; le risposte restano nelle tue statistiche come gli altri casi.')) return;
    try { await A.postJSON(`/api/sfide/${c}/lascia`, {}); scriviLocale('rq-sfida-corr-' + c, null); location.hash = '#/sfide'; } catch (e) { if (!(e instanceof A.NonAutorizzato)) A.$('#sf-msg2').textContent = e.message; }
  };
  const ch = A.$('#sf-chiudi');
  if (ch) ch.onclick = async () => { if (!confirm('Chiudere la sfida? Nessuno potrà più accettarla.')) return; try { await A.postJSON(`/api/sfide/${c}/chiudi`, {}); apriSfida(c); } catch (e) { if (!(e instanceof A.NonAutorizzato)) alert(e.message); } };
  if (leggiLocale('rq-sfida-nuova') === c) { scriviLocale('rq-sfida-nuova', null); const inv = A.$('#sf-testo'); if (inv) { inv.closest('.sf-scheda').classList.add('sf-evidenza'); inv.closest('.sf-scheda').scrollIntoView({ block: 'start', behavior: 'smooth' }); A.avvisoBreve('Sfida creata: ora invita gli amici.'); } }
  if (leggiLocale('rq-sfida-fine') === c) { scriviLocale('rq-sfida-fine', null); A.avvisoBreve(io?.finito ? '🏁 Sfida completata: guarda la classifica e le correzioni.' : 'Risposte salvate: puoi continuare quando vuoi.'); }
}
function htmlCorrezioni(corr) {
  const nomi = { corretta: '✓', errata: '✗', mancata: '!' };
  return (corr?.casi || []).map((x) => `<div class="sf-corr"><h3>${A.esc(x.titolo)} <span class="sf-punti ${x.punteggio >= 75 ? 'ok' : x.punteggio >= 50 ? 'medio' : 'ko'}">${x.punteggio}%</span></h3>
    ${x.opzioni?.length ? `<ul class="corr-opz">${x.opzioni.map((o) => `<li class="${A.esc(o.s)}">${nomi[o.s] || ''} ${A.esc(o.t)}${o.s === 'mancata' ? ' <small>(era corretta, non scelta)</small>' : o.s === 'errata' ? ' <small>(scelta, ma non corretta)</small>' : ''}</li>`).join('')}</ul>` : ''}
    ${x.spiegazione ? `<div class="spiegazione">${A.esc(x.spiegazione)}</div>` : ''}<p><a href="#/caso/${encodeURIComponent(x.id)}">Riapri il caso con le immagini</a></p></div>`).join('') || '<p class="muted">Nessuna correzione salvata su questo dispositivo.</p>';
}
// fine del giro della sfida (app.js, chiudiEsame): correzioni salvate su questo dispositivo, poi la pagina della sfida
export function fineGiro(g, titoli) {
  const prima = leggiLocale('rq-sfida-corr-' + g.sfida)?.casi || [];
  const nuovi = g.casi.filter((id) => g.risultati[id]).map((id) => ({ id, titolo: titoli[id]?.titolo || id, ...g.risultati[id] }));
  const tutti = [...prima.filter((x) => !nuovi.some((y) => y.id === x.id)), ...nuovi];
  scriviLocale('rq-sfida-corr-' + g.sfida, { casi: tutti });
  scriviLocale('rq-sfida-fine', g.sfida);
  location.hash = '#/sfida/' + g.sfida;
}

// ---------------------------------------------------------------- le mie sfide e nuova sfida
export async function apriElencoSfide() {
  corpo().innerHTML = '<p class="muted">Carico le tue sfide…</p>';
  const l = await A.getJSON('/api/sfide');
  corpo().innerHTML = `<section class="sf-testa"><span class="sf-ico" aria-hidden="true">🏁</span><div><h1>Sfide</h1>
      <p>Scegli da ${MIN} a ${MAX} casi, condividi il link sui social o in chat e vedi chi legge meglio. Le correzioni arrivano alla fine; in classifica solo chi lo sceglie.</p></div></section>
    <div class="sf-azioni"><a class="btn primary" href="#/sfide/nuova">＋ Crea una sfida</a></div>
    <section class="sf-scheda"><h2>Le mie sfide</h2>${l.length ? `<ul class="sf-elenco">${l.map((s) => `<li><a href="#/sfida/${A.esc(s.codice)}"><b>${A.esc(s.titolo)}</b></a>
      <span class="muted small">${s.n} casi · ${s.partecipanti} ${s.partecipanti === 1 ? 'partecipante' : 'partecipanti'} · ${s.aperta ? traQuanto(s.fine) : 'chiusa'}${s.creatore ? ' · creata da te' : ''}</span>
      ${s.mio ? `<span class="sf-punti ${s.mio.finito ? 'ok' : 'medio'}">${s.mio.finito ? 'completata' : `${s.mio.fatti}/${s.n}`} · ${s.mio.media}%</span>` : ''}</li>`).join('')}</ul>`
      : '<p class="muted">Non hai ancora sfide: creane una o apri il link che ti hanno mandato.</p>'}</section>`;
}
export async function apriNuova() {
  if (!A.ELENCO.length) await A.caricaElencoDati();
  const casi = A.ELENCO.filter((x) => x.titolo);
  const metodiche = [...new Set(casi.map((x) => x.modalita).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
  const scelti = new Set();
  corpo().innerHTML = `<section class="sf-testa"><span class="sf-ico" aria-hidden="true">🏁</span><div><h1>Crea una sfida</h1>
      <p>Scegli da ${MIN} a ${MAX} casi, dai un titolo e decidi quanto dura (in ore o in giorni). Poi inviti gli amici taggandoli nel post. Chi apre il link vede titolo ed esami, non le diagnosi.</p></div></section>
    <section class="sf-scheda sf-nuova">
      <label>Titolo <input id="sf-titolo" maxlength="80" placeholder="Es. Sfida torace del lunedì" value=""></label>
      <fieldset class="sf-durata"><legend>Durata</legend>
        <div class="sf-chip">${[[1, 'ore', '1 ora'], [3, 'ore', '3 ore'], [24, 'ore', '24 ore'], [3, 'giorni', '3 giorni'], [7, 'giorni', '1 settimana'], [30, 'giorni', '1 mese']]
          .map(([v, u, t]) => `<button type="button" class="ghost${v === 3 && u === 'giorni' ? ' on' : ''}" data-d="${v}" data-u="${u}">${t}</button>`).join('')}</div>
        <div class="sf-durata-libera"><input id="sf-durata" type="number" min="1" max="90" value="3" aria-label="Durata"><select id="sf-unita" aria-label="Unità"><option value="ore">ore</option><option value="giorni" selected>giorni</option></select>
          <span class="muted small" id="sf-chiude"></span></div>
        <p class="muted small">Da 1 ora a 90 giorni: allo scadere nessuno può più accettare né rispondere per la classifica.</p></fieldset>
      <div class="sf-filtri"><input id="sf-cerca" type="search" placeholder="Cerca tra i casi" aria-label="Cerca tra i casi">
        <select id="sf-metodica" aria-label="Metodica"><option value="">Tutte le metodiche</option>${metodiche.map((m) => `<option>${A.esc(m)}</option>`).join('')}</select>
        <button type="button" class="ghost" id="sf-caso">🎲 5 a caso</button></div>
      <p><b id="sf-conta">0 casi scelti</b> <span class="muted small">(da ${MIN} a ${MAX})</span></p>
      <div id="sf-lista" class="sf-lista"></div>
      <div class="sf-azioni"><button type="button" class="primary" id="sf-crea" disabled>Crea la sfida</button></div><p class="stato" id="sf-msg"></p>
    </section>`;
  const filtrati = () => { const q = A.normal(A.$('#sf-cerca').value), m = A.$('#sf-metodica').value; return casi.filter((x) => (!m || x.modalita === m) && (!q || A.normal(`${x.titolo} ${x.modalita} ${x.distretto}`).includes(q))); };
  const conta = () => { A.$('#sf-conta').textContent = `${scelti.size} ${scelti.size === 1 ? 'caso scelto' : 'casi scelti'}`; A.$('#sf-crea').disabled = scelti.size < MIN || scelti.size > MAX; };
  const disegna = () => {
    const l = filtrati();
    A.$('#sf-lista').innerHTML = l.slice(0, 300).map((x) => `<label class="sf-voce"><input type="checkbox" value="${A.esc(x.id)}" ${scelti.has(x.id) ? 'checked' : ''}>
      <span><b>${A.esc(x.titolo)}</b> <span class="muted small">${A.esc([x.modalita, x.distretto, x.difficolta].filter(Boolean).join(' · '))}</span></span></label>`).join('') || '<p class="muted">Nessun caso trovato.</p>';
    A.$('#sf-lista').querySelectorAll('input').forEach((i) => i.onchange = () => {
      if (i.checked && scelti.size >= MAX) { i.checked = false; A.avvisoBreve(`Al massimo ${MAX} casi.`); return; }
      if (i.checked) scelti.add(i.value); else scelti.delete(i.value); conta(); });
  };
  A.$('#sf-cerca').oninput = disegna; A.$('#sf-metodica').onchange = disegna;
  const chiude = () => { const n = +A.$('#sf-durata').value, u = A.$('#sf-unita').value, ok = Number.isInteger(n) && n >= 1 && n * (u === 'ore' ? 1 : 24) <= 90 * 24;
    A.$('#sf-durata').max = u === 'ore' ? 2160 : 90;
    A.$('#sf-chiude').textContent = ok ? 'chiude ' + new Date(Date.now() + n * (u === 'ore' ? 36e5 : 864e5)).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'da 1 ora a 90 giorni';
    A.$('#sf-durata').classList.toggle('errore', !ok); return ok; };
  A.$('#sf-durata').oninput = () => { A.$('.sf-chip').querySelectorAll('button').forEach((b) => b.classList.remove('on')); chiude(); };
  A.$('#sf-unita').onchange = A.$('#sf-durata').oninput;
  A.$('.sf-chip').querySelectorAll('button').forEach((b) => b.onclick = () => { A.$('#sf-durata').value = b.dataset.d; A.$('#sf-unita').value = b.dataset.u; chiude(); A.$('.sf-chip').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); });
  chiude();
  A.$('#sf-caso').onclick = () => { const l = filtrati().map((x) => x.id).sort(() => Math.random() - 0.5); scelti.clear(); l.slice(0, 5).forEach((x) => scelti.add(x)); disegna(); conta(); };
  A.$('#sf-crea').onclick = async () => {
    const b = A.$('#sf-crea'); b.disabled = true; A.$('#sf-msg').textContent = '';
    try {
      if (!chiude()) throw new Error('La durata va da 1 ora a 90 giorni.');
      const r = await A.postJSON('/api/sfide', { titolo: A.$('#sf-titolo').value, casi: [...scelti], durata: +A.$('#sf-durata').value, unita: A.$('#sf-unita').value });
      scriviLocale('rq-sfida-nuova', r.codice);
      location.hash = '#/sfida/' + r.codice;
    } catch (e) { if (!(e instanceof A.NonAutorizzato)) A.$('#sf-msg').textContent = e.message; b.disabled = false; }
  };
  disegna(); conta(); A.$('#sf-titolo').focus();
}
