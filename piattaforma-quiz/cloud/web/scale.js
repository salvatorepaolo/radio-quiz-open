// Scale e classificazioni: la scheda da compilare (apriScale) e il confronto con la scheda del docente dopo la
// risposta (htmlConfrontoScale). Si carica solo quando servono (app.js, caricaScale): chi non apre le scale non
// lo scarica. I calcoli e i disegni stanno in scale-dati.js, provati da test/scale.test.mjs.
// Estratto da app.js nella 1.248 senza modifiche al contenuto, salvo: i nomi di app.js si leggono come A.nome
// (ponte passato da app.js con collega) e REF_DA_SCALE = false → A.fineRefDaScale().
import { SCALE, descriviBullseye, descriviSegmento, descriviSettore, sedeMammella, sigla, siglaSegmento, svgBullseye, svgFegato, svgMammella, svgProstata, virgola } from './scale-dati.js';
// nomi di app.js: arrivano con collega(PONTE) (vedi app.js); niente import './app.js'
let A = null;
export const collega = (p) => { A = p; };
export const NOMI_APP = ["$","AUTORE","CLIENT","CLOUD","DOCENTE","FIN_ALTRE","NonAutorizzato","REF_DA_SCALE","T","V","aggiornaAvvisoScale","aggiornaSchemiReferto","aggiungiAlEditor","aggiungiSchema","apriReferto","avvisoBreve","bloccoEsame","btnFinScale","esc","fineRefDaScale","getJSON","legaChiudiScale","metodicaDi","postJSON","qs1","qsAll","salvaBozzaReferto","scalaApplicabile","sommaMisureRecist","tipoOpzione"];

// valore di un campo della scheda in parole (per il confronto con la scheda del docente)
function testoCampo(c, val) {
  if (val == null || val === '' || (Array.isArray(val) && !val.length)) return '—';
  if (c.tipo === 'mm') return `${virgola(+val, 1)} mm`;
  if (c.tipo === 'num') return `${val} ${c.unita || ''}`.trim();
  if (c.tipo === 'prostata') return val.map(sigla).join(', ');
  if (c.tipo === 'fegato') return val.map(siglaSegmento).join(', ');
  if (c.tipo === 'mammella') return val.testo || '—';
  if (c.tipo === 'bullseye') return descriviBullseye(val);
  const et = (x) => (c.scelte || []).find(([v]) => String(v) === String(x))?.[1] || String(x);
  return Array.isArray(val) ? val.map(et).join('; ') : et(val);
}
// confronto di un campo: uguale, vicino (misure entro il 20% o 3 mm, settori in parte comuni, stesso quadrante) o diverso
function confrontaCampo(c, mio, atteso) {
  const vuoto = (x) => x == null || x === '' || (Array.isArray(x) && !x.length);
  if (vuoto(atteso)) return null;
  if (vuoto(mio)) return 'manca';
  if (c.tipo === 'mm' || c.tipo === 'num') { const a = +mio, b = +atteso; return a === b ? 'ok' : Math.abs(a - b) <= Math.max(3, 0.2 * Math.abs(b)) ? 'vicino' : 'no'; }
  if (c.tipo === 'prostata' || c.tipo === 'fegato') { const A = new Set(mio), B = new Set(atteso), com = [...A].filter((x) => B.has(x)).length; return com === A.size && com === B.size ? 'ok' : com ? 'vicino' : 'no'; }
  if (c.tipo === 'bullseye') { const k = Object.keys(atteso); if (!k.length) return null; const ug = k.filter((s) => String(mio?.[s]) === String(atteso[s])).length;
    return ug === k.length && Object.keys(mio || {}).length === k.length ? 'ok' : ug / k.length >= 0.7 ? 'vicino' : 'no'; }
  if (c.tipo === 'mammella') return mio.lato !== atteso.lato ? 'no' : mio.breve === atteso.breve && Math.abs((mio.ora || 0) - (atteso.ora || 0)) <= 1 ? 'ok' : mio.breve === atteso.breve ? 'vicino' : 'no';
  if (Array.isArray(atteso)) { const A = new Set((mio || []).map(String)), B = new Set(atteso.map(String)); return A.size === B.size && [...B].every((x) => A.has(x)) ? 'ok' : [...B].some((x) => A.has(x)) ? 'vicino' : 'no'; }
  return String(mio) === String(atteso) ? 'ok' : 'no';
}
// esito delle scale dopo la risposta: la scheda dello studente accanto a quella del docente
function htmlConfrontoScale(rif) {
  if (!rif?.length) return '';
  const SEGNO = { ok: '✓', vicino: '≈', no: '✗', manca: '—' };
  return `<h3>Scale e classificazioni</h3>` + rif.map((d) => {
    const S = SCALE[d.id]; if (!S) return '';
    const m = A.V.scaleMie?.[d.id];
    const finale = !m ? 'manca' : (m.valore || m.testo) === (d.valore || d.testo) ? 'ok' : 'no';
    const righe = S.campi.map((c) => { const e = confrontaCampo(c, m?.valori?.[c.id], d.valori?.[c.id]); if (!e) return '';
      return `<tr class="sc-${e}"><td>${A.esc(c.nome.replace(/ \(.*?\)$/, '').replace(/^Sede: .*/, 'Sede'))}</td><td>${A.esc(m ? testoCampo(c, m.valori?.[c.id]) : '—')}</td><td>${A.esc(testoCampo(c, d.valori?.[c.id]))}</td><td class="sc-segno">${SEGNO[e]}</td></tr>`; }).join('');
    return `<div class="sc-confronto"><div class="sc-tit"><b>${A.esc(S.nome)}</b> <span class="sc-${finale}">${finale === 'ok' ? '✓ stessa categoria' : finale === 'manca' ? 'non compilata' : '✗ categoria diversa'}</span></div>
      <p class="small"><b>Tu:</b> ${m ? A.esc(m.testo) : '<span class="muted">scheda non compilata (pannello Σ)</span>'}<br><b>Docente:</b> ${A.esc(d.testo)}</p>
      ${righe ? `<table class="sc-tab"><thead><tr><th>Voce</th><th>Tu</th><th>Docente</th><th></th></tr></thead><tbody>${righe}</tbody></table>` : ''}${disegniConfronto(S, m, d)}</div>`;
  }).join('');
}
// disegni della scheda (settori della prostata, sede in mammella, segmenti epatici, bull's eye) affiancati:
// il tuo e quello del docente; nel tuo in verde ciò che coincide, in rosso ciò che il docente non ha segnato
function disegniConfronto(S, m, d) {
  const out = [];
  for (const c of S.campi) {
    const mio = m?.valori?.[c.id], rif = d.valori?.[c.id];
    const pieno = (x) => x && (Array.isArray(x) ? x.length : typeof x === 'object' ? Object.keys(x).length : false);
    if (!['prostata', 'mammella', 'fegato', 'bullseye'].includes(c.tipo) || !pieno(rif)) continue;
    const svg = (v, conf) => {
      if (c.tipo === 'prostata') return svgProstata(v || []);
      if (c.tipo === 'fegato') return svgFegato(v || []);
      if (c.tipo === 'mammella') return svgMammella(v?.x != null ? v : null);
      return svgBullseye(v || {}, '');
    };
    // confronto per settori: segna i tuoi settori giusti/sbagliati e quelli che mancano
    const segna = (html) => {
      if (!Array.isArray(rif) || !Array.isArray(mio)) return html;
      const R = new Set(rif), M = new Set(mio);
      return html.replace(/class="sm-s([^"]*)" data-s="([^"]+)"/g, (t, cl, id) => `class="sm-s${cl}${M.has(id) ? (R.has(id) ? ' cf-ok' : ' cf-no') : R.has(id) ? ' cf-manca' : ''}" data-s="${id}"`);
    };
    const testo = (v) => c.tipo === 'mammella' ? v?.testo || '' : c.tipo === 'bullseye' ? descriviBullseye(v) : (v || []).map(c.tipo === 'prostata' ? descriviSettore : descriviSegmento).join('; ');
    out.push(`<div class="sc-disegni"><figure><figcaption>Tu</figcaption>${pieno(mio) ? segna(svg(mio)) : '<div class="muted small sc-vuoto">disegno non compilato</div>'}<small>${A.esc(pieno(mio) ? testo(mio) : '')}</small></figure>
      <figure><figcaption>Docente</figcaption>${svg(rif)}<small>${A.esc(testo(rif))}</small></figure></div>`
      + (Array.isArray(rif) && pieno(mio) ? '<p class="small muted sc-legenda"><span class="cf-l ok"></span> segnato anche dal docente <span class="cf-l no"></span> in più <span class="cf-l manca"></span> mancante</p>' : ''));
  }
  return out.join('');
}
// Proposte di schede di riferimento dal testo del caso (risposte corrette, titolo interno, discussione):
// la categoria citata (es. «Bosniak IIF», «TI-RADS 4», «LR-5») diventa una scheda da confermare con un clic
const REGOLE_PROPOSTE = [
  ['bosniak', /Bosniak\s*(?:categoria\s*)?(IIF|IV|III|II|I)\b/i, (m) => m[1].toUpperCase()],
  ['tirads', /TI-?RADS\s*(?:TR\s*)?([1-5])\b/i, (m) => `TR${m[1]}`],
  ['pirads', /PI-?RADS\s*(?:v?2\.1\s*)?([1-5])\b/i, (m) => `PI-RADS ${m[1]}`],
  ['lirads', /\bLR-?(5|4|3|2|1|M|TIV|NC)\b|LI-?RADS\s*([1-5])\b/i, (m) => `LR-${(m[1] || m[2]).toUpperCase()}`],
  ['lungrads', /Lung-?RADS\s*(?:v?2022\s*)?([0-4][ABX]?|4[ABX])\b/i, (m) => `Lung-RADS ${m[1].toUpperCase()}`],
  ['orads', /O-?RADS\s*(?:US|MRI|RM)?\s*([0-5])\b/i, (m) => `O-RADS ${m[1]}`],
  ['genant', /Genant\s*(?:grado\s*)?([0-3])\b/i, (m) => `Genant ${m[1]}`],
  ['fazekas', /Fazekas\s*(?:grado\s*)?([0-3])(?:\s*\/\s*([0-3]))?/i, (m) => `Fazekas ${m[1]}/${m[2] ?? m[1]}`],
  ['aast', /AAST\s*(?:grado\s*)?(V|IV|III|II|I)\b/i, (m) => `AAST ${m[1].toUpperCase()}`],
];
async function proposteScale() {
  const c = await A.getJSON(`/api/casi/${A.V.caso.id}/completo`);
  const opz = c.opzioni || [], giuste = opz.filter((o, i) => A.tipoOpzione(opz, i) !== 'distrattore');
  const testi = [c.titolo_interno || '', ...giuste.map((o) => o.testo), c.spiegazione || ''];
  const gia = new Set((A.V.caso.scale || []).map((x) => x.id)), out = [];
  for (const [k, re, val] of REGOLE_PROPOSTE) {
    if (gia.has(k) || !SCALE[k]) continue;
    for (const t of testi) { const m = t.match(re); if (!m) continue;
      const frase = (t.split(/(?<=[.;])\s+/).find((f) => re.test(f)) || t).slice(0, 300);
      out.push({ id: k, valore: val(m), testo: frase }); break; }
  }
  return out;
}
function apriScale(sceltaIniziale) {
  if (A.bloccoEsame()) return;
  const box = A.$('#scale');
  if (typeof sceltaIniziale !== 'string' && !A.FIN_ALTRE.scale) { box.hidden = !box.hidden; if (box.hidden) return; } else { box.hidden = false; try { A.FIN_ALTRE.scale?.focus(); } catch {} }
  A.V.scaleMie ||= {};
  // solo le scale applicabili al caso (metodica e organo); gli autori possono vederle tutte
  const richieste = (A.V.caso?.scaleRichieste || []).filter((k) => SCALE[k]);
  const DOC = A.AUTORE || A.DOCENTE, tutte = A.CLIENT || (DOC && A.V.scaleTutte);
  const altre = Object.entries(SCALE).filter(([k]) => !richieste.includes(k) && (tutte || A.scalaApplicabile(k)));
  if (!richieste.length && !altre.length) {
    box.innerHTML = `<div class="scale-testa"><b>Scale e classificazioni</b> ${A.btnFinScale()}<button class="ghost" id="scala-chiudi" title="Chiudi">✕</button></div>
      <p class="muted small">Per questo caso non ci sono scale applicabili (sono per mammella, prostata, rene, fegato, ovaio, tiroide, polmone, rachide, encefalo, traumi addominali e risposta oncologica RECIST).${DOC ? ' <button type="button" class="link" id="scala-tutte">Mostra tutte</button>' : ''}</p>`;
    A.legaChiudiScale(box);
    A.$('#scala-tutte')?.addEventListener('click', () => { A.V.scaleTutte = true; apriScale('-'); });
    return;
  }
  const opz = ([k, x]) => `<option value="${k}">${A.esc(x.nome)}${A.V.scaleMie[k] ? ' ✓' : ''}</option>`;
  // visualizzatore scaricabile: tutte le scale, ma prima quelle adatte all'esame aperto (metodica e organo), poi le altre della
  // stessa metodica; così una TC dell'addome non si apre sulla scheda della mammella
  const gruppiClient = () => {
    const met = A.metodicaDi(A.V.caso || {}), adatte = altre.filter(([k]) => A.scalaApplicabile(k)), ha = (l, k) => l.some(([j]) => j === k);
    const stessa = altre.filter(([k]) => !ha(adatte, k) && SCALE[k].metodiche?.includes(met)), resto = altre.filter(([k]) => !ha(adatte, k) && !ha(stessa, k));
    return [['Adatte a questo esame', adatte], [`Altre per ${met || 'questa metodica'}`, stessa], ['Tutte le altre', resto]].filter(([, l]) => l.length)
      .map(([tit, l]) => `<optgroup label="${A.esc(tit)}">${l.map(opz).join('')}</optgroup>`).join('');
  };
  box.innerHTML = `<div class="scale-testa"><b>Scale e classificazioni</b> <select id="scala-scelta" class="compatto">${richieste.length
      ? `<optgroup label="Richieste da questo caso">${richieste.map((k) => opz([k, SCALE[k]])).join('')}</optgroup><optgroup label="Altre (solo come strumento)">${altre.map(opz).join('')}</optgroup>`
      : A.CLIENT ? gruppiClient() : altre.map(opz).join('')}</select>${DOC && !tutte ? ' <button type="button" class="link" id="scala-tutte" title="Anche le scale non adatte a questo caso">tutte</button>' : ''}
    ${A.btnFinScale()}<button class="ghost" id="scala-chiudi" title="Chiudi">✕</button></div>${A.AUTORE && A.CLOUD ? '<div class="scala-autore small"><button type="button" class="link" id="scala-proponi" title="Cerca nel testo del caso (risposte corrette e discussione) le categorie citate e propone le schede di riferimento mancanti">💡 Proponi le schede mancanti dal testo del caso</button> <span id="scala-proposte"></span></div>' : ''}${DOC && A.V.caso?.scale?.length ? `<div class="scala-autore small">Schede di riferimento del caso (confrontate con quelle degli studenti): ${A.V.caso.scale.map((x) => `<button type="button" class="link" data-vai-scala="${x.id}">${A.esc(SCALE[x.id]?.nome.replace(/ \(.*/, '') || x.id)}: ${A.esc(x.valore || '✓')}</button>`).join(' · ')}</div>` : DOC ? '<div class="scala-autore small muted">Nessuna scheda di riferimento: compila una scala e premi «Salva come risposta del caso»; gli studenti la confronteranno con la loro.</div>' : ''}<div id="scala-corpo"></div>`;
  A.legaChiudiScale(box);
  A.$('#scala-tutte')?.addEventListener('click', () => { A.V.scaleTutte = true; apriScale(A.$('#scala-scelta').value); });
  A.$('#scala-proponi')?.addEventListener('click', async () => {
    const el = A.$('#scala-proposte'); el.textContent = 'cerco…';
    try {
      const l = await proposteScale();
      if (!l.length) { el.textContent = 'nessuna categoria citata nel testo per le scale ancora senza scheda.'; return; }
      el.innerHTML = l.map((x, i) => `<span class="proposta"><b>${A.esc(SCALE[x.id].nome.replace(/ \(.*/, ''))}: ${A.esc(x.valore)}</b> <span class="muted">«${A.esc(x.testo)}»</span> <button type="button" class="ghost piccolo" data-prop="${i}">✔ Conferma</button></span>`).join('')
        + (l.length > 1 ? ' <button type="button" class="ghost piccolo" id="prop-tutte">✔ Conferma tutte</button>' : '');
      const salva = async (x) => { const r = await A.postJSON(`/api/casi/${encodeURIComponent(A.V.caso.id)}/scala`, { scala: { id: x.id, valori: { _manuale: true }, valore: x.valore, testo: x.testo } }); A.V.caso.scale = r.scale; A.V.caso.scaleRichieste = r.scale.map((y) => y.id); };
      el.querySelectorAll('[data-prop]').forEach((b) => b.onclick = async () => { try { await salva(l[+b.dataset.prop]); A.aggiornaAvvisoScale(); apriScale(l[+b.dataset.prop].id); } catch (e) { alert('Non salvata: ' + e.message); } });
      A.$('#prop-tutte')?.addEventListener('click', async () => { try { for (const x of l) await salva(x); A.aggiornaAvvisoScale(); apriScale('-'); } catch (e) { alert('Non salvate: ' + e.message); } });
    } catch (e) { el.textContent = 'non riuscito: ' + e.message; }
  });
  box.querySelectorAll('[data-vai-scala]').forEach((b) => b.onclick = () => { if (![...A.$('#scala-scelta').options].some((o) => o.value === b.dataset.vaiScala)) A.V.scaleTutte = true; apriScale(b.dataset.vaiScala); });
  if (typeof sceltaIniziale === 'string' && SCALE[sceltaIniziale]) A.$('#scala-scelta').value = sceltaIniziale;
  const disegnaScala = () => {
    const k = A.$('#scala-scelta').value, S = SCALE[k], v = {}, mappe = {};
    // valori già inseriti: i miei, oppure (autori) quelli salvati come risposta del caso
    const rifCaso = (A.V.caso?.scale || []).find((x) => x.id === k);
    if ((A.AUTORE || A.DOCENTE) && rifCaso?.valori?._manuale && !(A.V.scalaManuale ||= {})[k]) A.V.scalaManuale[k] = { valore: rifCaso.valore, testo: rifCaso.testo };
    const prima = A.V.scaleMie[k]?.valori || (DOC ? rifCaso?.valori : null) || {};
    const MAPPA = (c) => ['prostata', 'mammella', 'fegato', 'bullseye'].includes(c.tipo);
    const pennello = {}, SR = k === 'recist' ? A.sommaMisureRecist() : null;
    // ultimo nodulo misurato con il volume semiautomatico: diametro medio dal suo contorno (1.271)
    const NOD = (k === 'fleischner' || k === 'lungrads') ? A.ultimoNodulo?.() : null;
    for (const c of S.campi) if (MAPPA(c) && prima[c.id]) mappe[c.id] = prima[c.id];
    A.$('#scala-corpo').innerHTML = `<p class="muted small">${A.esc(S.intro)} <i>Fonte: ${A.esc(S.fonte)}.</i></p>
      <div class="scala-campi">${S.campi.map((c) => `<div class="scala-campo" data-campo="${c.id}"><div class="scala-nome">${A.esc(c.nome)}</div>${c.tipo === 'mm'
        ? `<input type="number" min="0" step="0.5" data-c="${c.id}" class="compatto" style="width:90px"> mm ${SR && c.id === 'sa' ? `<button type="button" class="ghost piccolo" data-somma="${c.id}" title="Somma dei diametri delle misure RECIST di questo esame (le 5 più grandi)">⟵ Σ RECIST ${virgola(SR.somma, 1)} mm (${SR.n} ${SR.n === 1 ? 'misura' : 'misure'}${SR.oltre ? ', le 5 più grandi' : ''})</button> ` : ''}${NOD && c.id === 'd' ? `<button type="button" class="ghost piccolo" data-nodulo="${c.id}" title="Diametro medio (media tra asse lungo e corto, come chiedono Fleischner e Lung-RADS) dal contorno 3D dell'ultimo volume misurato">⟵ nodulo ${virgola(NOD.medio, 1)} mm (${virgola(NOD.lung, 1)} × ${virgola(NOD.corto, 1)} mm, ${NOD.vol} mm³)</button> ` : ''}${A.V.ultimaLinea ? `<button type="button" class="ghost piccolo" data-ultima="${c.id}" title="Usa l'ultima distanza misurata con il righello o il RECIST">⟵ ${A.V.ultimaLinea.toFixed(1)} mm</button>` : '<span class="muted small">(o misura con il righello)</span>'}`
        : c.tipo === 'num' ? `<input type="number" min="0" step="0.01" data-c="${c.id}" class="compatto" style="width:90px"> ${A.esc(c.unita || '')}${c.daROI ? ` <button type="button" class="ghost piccolo" data-roi="${c.id}" data-q="${c.daROI}" title="Copia il valore ${c.daROI === 'max' ? 'massimo' : 'medio'} dell'ultima ROI disegnata (sulla PET, o sulla fusione PET-TC)">⟵ ${c.daROI === 'max' ? 'max' : 'media'} dell'ultima ROI</button>` : ''}`
        : c.tipo === 'prostata' ? `<div data-mappa="${c.id}">${svgProstata(mappe[c.id] || [])}</div><div class="muted small" data-mappa-testo="${c.id}">${mappe[c.id] ? A.esc(mappe[c.id].map(descriviSettore).join('; ')) : 'Nessun settore scelto: clicca sugli spicchi (di nuovo per toglierli).'}</div>`
        : c.tipo === 'fegato' ? `<div data-mappa="${c.id}">${svgFegato(mappe[c.id] || [])}</div><div class="muted small" data-mappa-testo="${c.id}">${mappe[c.id] ? A.esc(mappe[c.id].map(descriviSegmento).join('; ')) : 'Nessun segmento scelto: clicca sui segmenti (di nuovo per toglierli).'}</div>`
        : c.tipo === 'bullseye' ? `<div data-mappa="${c.id}">${svgBullseye(mappe[c.id] || {}, '2')}</div><div class="muted small" data-mappa-testo="${c.id}">${A.esc(descriviBullseye(mappe[c.id]))}</div>`
        : c.tipo === 'mammella' ? `<div data-mappa="${c.id}">${svgMammella(mappe[c.id]?.x != null ? mappe[c.id] : null)}</div><div class="muted small" data-mappa-testo="${c.id}">${mappe[c.id] ? A.esc(mappe[c.id].testo) : 'Clicca dove si trova la lesione.'}</div>`
        : c.scelte.map(([val, t], i) => `<label class="check"><input type="${c.multi ? 'checkbox' : 'radio'}" name="sc-${c.id}" data-c="${c.id}" value="${val}" data-i="${i}"> ${A.esc(t)}${c.senzaPunti || typeof val !== 'number' ? '' : ` <span class="muted small">(${val})</span>`}</label>`).join('')}</div>`).join('')}</div>
      <div class="scala-esito" id="scala-esito"></div>`;
    const datiCompilati = () => S.campi.filter((c) => !A.$(`#scala-corpo [data-campo="${c.id}"]`)?.hidden).map((c) => {
      const x = v[c.id];
      if (x == null || x === '' || (Array.isArray(x) && !x.length)) return null;
      if (MAPPA(c)) { const t = A.$(`#scala-corpo [data-mappa-testo="${c.id}"]`)?.textContent?.trim(); return t ? [c.nome, t] : null; }
      if (c.tipo === 'mm') return [c.nome, `${virgola(+x, x % 1 ? 1 : 0)} mm`];
      if (c.tipo === 'num') return [c.nome, `${String(x).replace('.', ',')}${c.unita ? ' ' + c.unita : ''}`];
      const nomeDi = (val) => (c.scelte || []).find(([w]) => String(w) === String(val))?.[1] ?? String(val);
      return [c.nome, Array.isArray(x) ? x.map(nomeDi).join(', ') : nomeDi(x)];
    }).filter(Boolean);
    const leggi = () => {
      for (const c of S.campi) {
        if (MAPPA(c)) { v[c.id] = mappe[c.id]; continue; }
        if (c.tipo === 'mm' || c.tipo === 'num') { const x = A.$(`#scala-corpo input[data-c="${c.id}"]`).value; v[c.id] = x === '' ? undefined : +x; }
        else if (c.multi) v[c.id] = [...A.qsAll(`#scala-corpo input[data-c="${c.id}"]:checked`)].map((x) => x.value);
        else { const x = A.qs1(`#scala-corpo input[data-c="${c.id}"]:checked`); v[c.id] = x ? x.value : undefined; }
      }
      // campi che dipendono da altre scelte (es. il T2 della zona periferica o di transizione)
      for (const c of S.campi) if (c.se) { const vis = !!c.se(v); A.$(`#scala-corpo [data-campo="${c.id}"]`).hidden = !vis; if (!vis) v[c.id] = undefined; }
      let r = S.calcola(v);
      // il docente può correggere a mano categoria e testo (o inserirli se il calcolo non li dà)
      A.V.scalaManuale ||= {};
      const man = DOC ? A.V.scalaManuale[k] : null;
      if (man) r = { valore: man.valore, testo: man.testo, manuale: true };
      // la scheda compilata resta in memoria: con la risposta va al confronto con quella del docente
      if (r) A.V.scaleMie[k] = { id: k, valori: { ...JSON.parse(JSON.stringify(v)), ...(r.manuale ? { _manuale: true } : {}) }, valore: r.valore, testo: r.testo }; else delete A.V.scaleMie[k];
      const chiesta = richieste.includes(k), rif = (A.V.caso?.scale || []).find((x) => x.id === k);
      A.$('#scala-esito').innerHTML = (r ? `<div class="scala-valore">${A.esc(r.testo)}</div><button type="button" class="ghost" id="scala-copia" title="Aggiunge al referto il risultato e i dati inseriti nella scala (con i disegni compilati)">Copia nel referto</button>` : '<span class="muted small">Completa i campi per il risultato.</span>')
        + (chiesta && !DOC ? `<div class="muted small">La tua scheda viene confrontata con quella del docente quando confermi la risposta.</div>` : '')
        + (DOC ? `<details class="scala-man"${man ? ' open' : ''}><summary>✎ Correggi o inserisci il risultato a mano${man ? ' (modificato)' : ''}</summary>
            <label class="small">Categoria / punteggio <input id="scala-man-val" class="compatto" maxlength="60" value="${A.esc(r?.valore || '')}"></label>
            <textarea id="scala-man-txt" rows="3" maxlength="1200" placeholder="Testo del risultato">${A.esc(r?.testo || '')}</textarea>
            <button type="button" class="ghost" id="scala-man-ok">Usa questo risultato</button>${man ? ' <button type="button" class="ghost" id="scala-man-via">↺ Torna al calcolo</button>' : ''}</details>` : '')
        + (DOC && A.CLOUD && A.V.caso?.id ? `<div class="scala-autore">${r ? `<button type="button" class="ghost" id="scala-salva" title="Gli studenti compilano la stessa scheda e la confrontano con la tua dopo la risposta">${rif ? 'Aggiorna la risposta del caso' : 'Salva come risposta del caso'}</button>` : ''}
            ${rif ? `<button type="button" class="ghost" id="scala-togli" title="La scala non è più chiesta in questo caso">Togli dal caso</button> <span class="muted small">Risposta del caso: ${A.esc(rif.valore || rif.testo)}</span>` : '<span class="muted small">Salva solo le scale adatte a questo caso.</span>'}</div>` : '');
      A.$('#scala-man-ok')?.addEventListener('click', () => { const val = A.$('#scala-man-val').value.trim(), txt = A.$('#scala-man-txt').value.trim(); if (!val && !txt) return; A.V.scalaManuale[k] = { valore: val, testo: txt || val }; leggi(); });
      A.$('#scala-man-via')?.addEventListener('click', () => { delete A.V.scalaManuale[k]; leggi(); });
      A.$('#scala-copia')?.addEventListener('click', async () => {
        if (A.CLIENT || A.$('#dlg-referto').open || A.REF_DA_SCALE) {     // la frase va nel referto strutturato (nella piattaforma se è aperto)
          if (!A.$('#dlg-referto').open) await A.apriReferto();
          const dati = datiCompilati();
          A.aggiungiAlEditor(`<p><b>${A.esc(S.nome.replace(/ \(.*/, ''))}</b>: ${A.esc(r.testo)}</p>${dati.length ? `<ul>${dati.map(([n, x]) => `<li>${A.esc(n)}: ${A.esc(x)}</li>`).join('')}</ul>` : ''}`);
          // anche i disegni compilati (settori, segmenti, sede): diventano figure del referto
          let nd = 0;
          for (const c of S.campi.filter(MAPPA)) {
            const val = mappe[c.id]; if (!val || (Array.isArray(val) ? !val.length : !Object.keys(val).length)) continue;
            const svg = A.$(`#scala-corpo [data-mappa="${c.id}"] svg`), txt = A.$(`#scala-corpo [data-mappa-testo="${c.id}"]`)?.textContent || '';
            try { await A.aggiungiSchema(k + ':' + c.id, svg, `${S.nome.replace(/ \(.*/, '')}${r.valore ? ': ' + r.valore : ''} — ${txt}`); nd++; } catch (e) { console.warn('schema', e); }
          }
          A.salvaBozzaReferto(); A.aggiornaSchemiReferto(); A.fineRefDaScale(); A.avvisoBreve(nd ? `Aggiunto al referto, con ${nd === 1 ? 'il disegno' : nd + ' disegni'}` : 'Aggiunto al referto'); return;
        }
        const t = A.$('#q-referto'); if (!t) return; const dati = datiCompilati();
        t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + `${S.nome.replace(/ \(.*/, '')}: ${r.testo}` + dati.map(([n, x]) => `\n- ${n}: ${x}`).join(''); t.closest('details')?.setAttribute('open', ''); A.T.misure++; });
      const salvaRif = async (corpo) => {
        try { const x = await A.postJSON(`/api/casi/${encodeURIComponent(A.V.caso.id)}/scala`, corpo); A.V.caso.scale = x.scale; A.V.caso.scaleRichieste = x.scale.map((y) => y.id); A.aggiornaAvvisoScale(); apriScale(k); }
        catch (e) { if (!(e instanceof A.NonAutorizzato)) alert('Non salvata: ' + e.message); }
      };
      A.$('#scala-salva')?.addEventListener('click', () => salvaRif({ scala: A.V.scaleMie[k] }));
      A.$('#scala-togli')?.addEventListener('click', () => { if (confirm('Togliere questa scala dalle risposte del caso?')) salvaRif({ rimuovi: k }); });
    };
    A.$('#scala-corpo').querySelectorAll('input').forEach((x) => x.addEventListener('input', leggi));
    // disegni cliccabili
    for (const c of S.campi.filter(MAPPA)) {
      const box = A.$(`#scala-corpo [data-mappa="${c.id}"]`), testo = A.$(`#scala-corpo [data-mappa-testo="${c.id}"]`);
      box.addEventListener('click', (e) => {
        if (c.tipo === 'bullseye') {
          const p = e.target.closest('[data-p]')?.dataset.p;
          if (p) { pennello[c.id] = p; box.innerHTML = svgBullseye(mappe[c.id] || {}, p); return; }
          const id = e.target.closest('[data-s]')?.dataset.s; if (!id) return;
          const pen = pennello[c.id] || '2', cur = { ...(mappe[c.id] || {}) };
          if (cur[id] === pen) delete cur[id]; else cur[id] = pen;
          mappe[c.id] = Object.keys(cur).length ? cur : undefined;
          box.innerHTML = svgBullseye(mappe[c.id] || {}, pen); testo.textContent = descriviBullseye(mappe[c.id]);
        } else if (c.tipo === 'fegato') {
          const id = e.target.closest('[data-s]')?.dataset.s; if (!id) return;
          const sel = mappe[c.id] || []; mappe[c.id] = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
          if (!mappe[c.id].length) mappe[c.id] = undefined;
          box.innerHTML = svgFegato(mappe[c.id] || []);
          testo.textContent = mappe[c.id] ? mappe[c.id].map(descriviSegmento).join('; ') : 'Nessun segmento scelto: clicca sui segmenti (di nuovo per toglierli).';
        } else if (c.tipo === 'prostata') {
          const id = e.target.closest('[data-s]')?.dataset.s; if (!id) return;
          const sel = mappe[c.id] || []; mappe[c.id] = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
          if (!mappe[c.id].length) mappe[c.id] = undefined;
          box.innerHTML = svgProstata(mappe[c.id] || []);
          testo.textContent = mappe[c.id] ? mappe[c.id].map(descriviSettore).join('; ') : 'Nessun settore scelto: clicca sugli spicchi (di nuovo per toglierli).';
          // la zona si deduce dai settori, se sono tutti della stessa
          const zone = new Set((mappe[c.id] || []).map((x) => x.split('-')[1]?.slice(0, 2)).filter((z) => z === 'PZ' || z === 'TZ'));
          if (zone.size === 1) { const z = [...zone][0] === 'PZ' ? 'pz' : 'tz'; const r = A.qs1(`#scala-corpo input[data-c="z"][value="${z}"]`); if (r) r.checked = true; }
        } else {
          const svg = box.querySelector('svg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
          const q = pt.matrixTransform(svg.getScreenCTM().inverse()), sede = sedeMammella(q.x, q.y); if (!sede) return;
          mappe[c.id] = sede; box.innerHTML = svgMammella({ x: q.x, y: q.y }); testo.textContent = sede.testo;
        }
        leggi();
      });
    }
    A.$('#scala-corpo').querySelectorAll('[data-nodulo]').forEach((b) => b.onclick = () => { A.$(`#scala-corpo input[data-c="${b.dataset.nodulo}"]`).value = NOD.medio.toFixed(1); leggi(); });
    A.$('#scala-corpo').querySelectorAll('[data-somma]').forEach((b) => b.onclick = () => { A.$(`#scala-corpo input[data-c="${b.dataset.somma}"]`).value = SR.somma.toFixed(1); leggi(); });
    A.$('#scala-corpo').querySelectorAll('[data-ultima]').forEach((b) => b.onclick = () => { A.$(`#scala-corpo input[data-c="${b.dataset.ultima}"]`).value = A.V.ultimaLinea.toFixed(1); leggi(); });
    A.$('#scala-corpo').querySelectorAll('[data-roi]').forEach((b) => b.onclick = () => { const x = A.V.ultimaROI?.[b.dataset.q]; if (x == null) { A.avvisoBreve('Disegna prima una ROI sull\'immagine (strumento ROI).'); return; }
      if (b.dataset.q && !A.V.ultimaROI.suv && /SUV/.test(b.closest('.scala-campo')?.textContent || '')) A.avvisoBreve('L\'ultima ROI non è sulla PET: i valori non sono SUV. Disegnala sulla serie PET o con la fusione attiva.');
      A.avvisoBreve(`${A.V.ultimaROI.etichetta || 'ROI'}: ${b.dataset.q === 'max' ? 'massimo' : 'media'} ${virgola(x, A.V.ultimaROI.suv ? 2 : 0)}`); A.$(`#scala-corpo input[data-c="${b.dataset.roi}"]`).value = +x.toFixed(A.V.ultimaROI.suv ? 2 : 0); leggi(); });
    // valori già inseriti
    for (const c of S.campi) {
      const x = prima[c.id]; if (x == null || MAPPA(c)) continue;
      if (c.tipo === 'mm' || c.tipo === 'num') { const el = A.$(`#scala-corpo input[data-c="${c.id}"]`); if (el) el.value = x; }
      else for (const el of A.qsAll(`#scala-corpo input[data-c="${c.id}"]`)) el.checked = Array.isArray(x) ? x.map(String).includes(el.value) : String(x) === el.value;
    }
    leggi();
  };
  A.$('#scala-scelta').onchange = disegnaScala; disegnaScala();
}

// 1.263: scale compilate da uno studente, per il docente (Analisi → Referti): nome, risultato e i disegni (settori
// della prostata, segmenti epatici, sede in mammella, bull's eye) ricostruiti dai valori salvati con la risposta
function htmlScaleStudente(lista) {
  if (!lista?.length) return '';
  return lista.map((d) => {
    const S = SCALE[d.id]; if (!S) return '';
    const disegni = S.campi.map((c) => { const v = d.valori?.[c.id];
      const pieno = v && (Array.isArray(v) ? v.length : typeof v === 'object' ? Object.keys(v).length : false); if (!pieno) return '';
      const svg = c.tipo === 'prostata' ? svgProstata(v) : c.tipo === 'fegato' ? svgFegato(v) : c.tipo === 'mammella' ? (v?.x != null ? svgMammella(v) : '') : c.tipo === 'bullseye' ? svgBullseye(v, '') : '';
      return svg ? `<figure class="sc-dis-doc">${svg}<figcaption>${A.esc(c.nome.replace(/ \(.*?\)$/, ''))}</figcaption></figure>` : ''; }).join('');
    return `<div class="sc-studente"><b>${A.esc(S.nome)}</b>${d.testo ? `: ${A.esc(d.testo)}` : ''}${disegni ? `<div class="sc-disegni-doc">${disegni}</div>` : ''}</div>`;
  }).join('');
}
export { apriScale, htmlConfrontoScale, htmlScaleStudente };
