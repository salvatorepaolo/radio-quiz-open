/* ============================================================
   Quiz Radiologia — logica dell'API, indipendente da AWS.
   Il "magazzino" (casi, account, risultati) viene passato da fuori:
   su AWS è S3 + DynamoDB, nelle prove è un oggetto in memoria.

   Iscrizione libera: chiunque si registra con email e password
   (specializzandi, radiologi, medici di altre specialità, studenti…);
   l'account si attiva con il link ricevuto per email.
   Ciascuno sceglie da sé i docenti di riferimento (anche più d'uno):
   un docente vede risultati e progressi solo di chi lo ha scelto.
   Ruoli:
     · admin          — gestore della piattaforma: casi, account, approva i
                        docenti, vede tutto. Entra con il codice fissato
                        alla pubblicazione (o con un codice personale).
     · docente        — iscritto che si è dichiarato docente (da sé, senza
                        approvazione: vede solo chi lo sceglie): classi e
                        compiti per chi lo ha scelto, risultati e analisi
                        dei suoi. Scrive i casi solo se «autore».
     · specializzando — ogni iscritto (il nome resta per compatibilità con i
                        dati già salvati; la categoria professionale è a parte).
   Le password sono conservate solo come impronta scrypt con sale.
   I vecchi account con codice personale continuano a entrare con il codice.

   Gettone (cookie "quiz"):  ruolo.id.scadenza.firmaHMAC
   ============================================================ */
import { createHash, createHmac, timingSafeEqual, randomBytes, randomInt, scryptSync } from 'node:crypto';

export const RUOLI = ['admin', 'referente', 'docente', 'specializzando'];
export const normalizza = (c) => String(c || '').toLowerCase().replace(/[\s-]/g, '');
export const impronta = (codice) => createHash('sha256').update('quiz-radiologia:' + normalizza(codice)).digest('hex');
const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;
const ID_PROPOSTA = /^prop-[a-z0-9]{8}$/;           // codice dei casi proposti dagli iscritti
const DURATA = 60 * 60 * 24 * 30; // 30 giorni

// categorie professionali di chi si iscrive (solo informative: i permessi dipendono dal ruolo)
export const CATEGORIE = { specializzando: 'Medico specializzando', radiologo: 'Radiologo', medico: 'Medico di altra specialità',
  studente: 'Studente di medicina', tsrm: 'Tecnico di radiologia (TSRM)', infermiere: 'Infermiere', altro: 'Altro' };
// profilo didattico dalla categoria: decide quali percorsi si vedono (medico, tsrm, infermiere)
export const profiloDidattico = (categoria) => (categoria === 'tsrm' ? 'tsrm' : categoria === 'infermiere' ? 'infermiere' : 'medico');
// password: scrypt con sale casuale → "s1$sale$impronta"
export function improntaPassword(pw) {
  const sale = randomBytes(16);
  return `s1$${sale.toString('hex')}$${scryptSync(String(pw), sale, 32).toString('hex')}`;
}
export function verificaPassword(pw, conservata) {
  const [v, sale, h] = String(conservata || '').split('$');
  if (v !== 's1' || !sale || !h) return false;
  const x = scryptSync(String(pw), Buffer.from(sale, 'hex'), 32), y = Buffer.from(h, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}
export const passwordValida = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 200 && /[A-Za-z]/.test(p) && /[^A-Za-z]/.test(p);
// gettoni monouso per conferma dell'email e nuova password: nel link "id.gettone", sul server solo l'impronta
const improntaGettone = (t) => createHash('sha256').update('quiz-gettone:' + String(t)).digest('hex');
function nuovoGettone(ore) {
  const t = randomBytes(24).toString('base64url');
  return { t, salvato: { h: improntaGettone(t), scad: Date.now() + ore * 3600000 } };
}
function gettoneValido(salvato, t) {
  return !!(salvato?.h && salvato.scad > Date.now() && t && uguali(salvato.h, improntaGettone(t)));
}
export function generaCodice() {
  const c = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) { s += c[randomInt(c.length)]; if (i % 4 === 3 && i < 11) s += '-'; }
  return s;
}
function uguali(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
export const firma = (segreto, testo) => createHmac('sha256', segreto).update(testo).digest('hex');
export function creaGettone(segreto, ruolo, id, ora = Math.floor(Date.now() / 1000)) {
  const scad = ora + DURATA;
  return `${ruolo}.${id}.${scad}.${firma(segreto, `${ruolo}.${id}.${scad}`)}`;
}
export function leggiGettone(segreto, gettone, ora = Math.floor(Date.now() / 1000)) {
  const p = String(gettone || '').split('.');
  if (p.length !== 4 || !RUOLI.includes(p[0]) || !ID_OK.test(p[1])) return null;
  const scad = Number(p[2]);
  if (!Number.isFinite(scad) || scad < ora) return null;
  return uguali(firma(segreto, `${p[0]}.${p[1]}.${p[2]}`), p[3]) ? { ruolo: p[0], id: p[1], scad } : null;
}
// Accesso alle immagini per gli studenti (cookie «qc», uno per caso, con Path=/casi/<id>):
// lo rilascia l'API quando si apre un caso visibile ed elenca le cartelle delle serie nascoste,
// che la guardia di CloudFront rifiuta. Senza cookie del caso (bozza, caso mai aperto) niente immagini.
// Valore: id~scadenza~cartella*cartella~firmaHMAC
export function cookieCaso(segreto, id, cartelle, ora = Math.floor(Date.now() / 1000)) {
  const scad = ora + DURATA, lista = cartelle.filter((c) => /^[A-Za-z0-9_.-]{1,120}$/.test(c)).join('*');
  return `${id}~${scad}~${lista}~${firma(segreto, `qc.${id}.${scad}.${lista}`)}`;
}
export function cartelleNascoste(serie, nascoste) {
  const dir = (s) => String(s?.files?.[0] || '').split('/').slice(0, -1).join('/').replace(/^serie\//, '');
  const vis = new Set((serie || []).filter((s, i) => !nascoste.includes(i)).flatMap((s) => (s.files || []).map((f) => f.split('/').slice(0, -1).join('/').replace(/^serie\//, ''))));
  return [...new Set(nascoste.map((i) => dir(serie?.[i])).filter((d) => d && !d.includes('/') && !vis.has(d)))];
}
function cookie(headers) {
  const h = headers || {};
  const m = [h.cookie, h.Cookie].filter(Boolean).join('; ').match(/(?:^|;\s*)quiz=([^;]+)/);
  return m ? m[1] : '';
}

export function valuta(caso, scelte) {
  const opz = caso.opzioni || [];
  const sel = new Set((scelte || []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < opz.length));
  let tp = 0, fp = 0, giuste = 0;
  const esito = opz.map((o, i) => {
    const s = sel.has(i), ok = !!o.corretta;
    if (ok) giuste++;
    if (s && ok) tp++; if (s && !ok) fp++;
    return { indice: i, stato: s && ok ? 'corretta' : s ? 'errata' : ok ? 'mancata' : 'neutra', nota: o.nota || '' };
  });
  const punteggio = giuste ? Math.round(Math.max(0, (tp - fp) / giuste) * 100) : 0;
  // referto guidato per distretti: punteggio di ogni distretto, con la stessa formula
  const sezioni = (caso.sezioni || []).map((z, k) => {
    let a = 0, b = 0, g = 0;
    opz.forEach((o, i) => { if (o.sezione !== k) return; if (o.corretta) g++; if (sel.has(i) && o.corretta) a++; if (sel.has(i) && !o.corretta) b++; });
    return { nome: z.nome, punteggio: g ? Math.round(Math.max(0, (a - b) / g) * 100) : (b ? 0 : 100), perfetta: a === g && b === 0 };
  });
  return { esito, punteggio, ...(sezioni.length ? { sezioni } : {}), perfetta: tp === giuste && fp === 0, spiegazione: caso.spiegazione || '',
    scelteTesti: [...sel].sort((a, b) => a - b).map((i) => opz[i].testo) };
}

// Tipo di ogni opzione: il reperto principale, un reperto secondario (entrambi corretti) o un distrattore.
// Per i casi scritti prima che esistesse il campo: la prima opzione corretta è il principale.
export const TIPI = ['principale', 'secondario', 'distrattore'];
export function tipoOpzione(opzioni, i) {
  const o = opzioni[i];
  if (TIPI.includes(o?.tipo)) return o.tipo;
  if (!o?.corretta) return 'distrattore';
  return opzioni.findIndex((x) => x.corretta) === i ? 'principale' : 'secondario';
}
export const LIVELLI_SICUREZZA = ['sicuro', 'probabile', 'ipotesi'];
export const DISCREPANZE = ['nessuna', 'minore', 'maggiore'];
// sessioni con referti riletti dal docente (discrepanze): turno di guardia e lista di lavoro simulata
const CON_REVISIONE = ['guardia', 'lista'];
// turno di guardia: per ogni caso del turno la risposta data durante il turno e la discrepanza segnata dal docente
export function esitoGuardia(e, righe) {
  const mie = righe.filter((x) => x.account === e.account && e.casi.some((c) => c.id === x.caso) && String(x.data) >= String(e.inizio || '') && String(x.data) <= String(e.data));
  const casi = e.casi.map((c) => { const x = mie.filter((y) => y.caso === c.id).pop(); const d = x?.dettagli?.revisione?.discrepanza || null;
    return { ...c, ...(x ? { risposta: x.id } : {}), ...(d ? { discrepanza: d } : {}), ...(x?.dettagli?.revisione?.commento ? { commento: x.dettagli.revisione.commento } : {}) }; });
  const conta = (k) => casi.filter((c) => c.discrepanza === k).length;
  return { ...e, casi, discrepanze: { maggiori: conta('maggiore'), minori: conta('minore'), nessuna: conta('nessuna'), daRivedere: casi.filter((c) => c.risposta && !c.discrepanza).length } };
}
// confronto anonimo con i colleghi: per metodica, dal primo tentativo di ogni caso a scelta multipla.
// sensibilità = reperti presenti indicati / reperti presenti; specificità = distrattori evitati / distrattori
// (le affermazioni sulla tecnica non contano). Solo persone con almeno 3 casi nella metodica.
export function letturaPerArea(righe, casiPerId) {
  const primi = {}; for (const x of [...righe].sort((a, b) => String(a.data).localeCompare(String(b.data)))) {
    if (!x.account || String(x.account).startsWith('eliminato') || x.ruolo === 'admin' || !(x.opzioni || []).length) continue;
    const k = `${x.account}|${x.caso}`; if (!primi[k]) primi[k] = x; }
  const per = {};        // area → account → contatori
  for (const x of Object.values(primi)) {
    const c = casiPerId[x.caso]; if (!c) continue;
    const area = normalizzaMetodica(c.modalita); if (!area) continue;
    const t = ((per[area] ||= {})[x.account] ||= { casi: 0, punti: 0, vp: 0, fn: 0, fp: 0, vn: 0 });
    t.casi++; t.punti += Number(x.punteggio) || 0;
    for (const o of x.opzioni) {
      if (Number.isInteger(o.z) && /tecnica/i.test(c.sezioni?.[o.z]?.nome || '')) continue;
      if (o.tipo === 'distrattore') { if (o.s) t.fp++; else t.vn++; } else if (o.s) t.vp++; else t.fn++;
    }
  }
  const out = {};
  for (const [area, acc] of Object.entries(per)) {
    out[area] = Object.fromEntries(Object.entries(acc).filter(([, t]) => t.casi >= 3).map(([id, t]) => [id, { casi: t.casi, media: Math.round(t.punti / t.casi),
      sens: t.vp + t.fn ? Math.round(100 * t.vp / (t.vp + t.fn)) : null, spec: t.fp + t.vn ? Math.round(100 * t.vn / (t.fp + t.vn)) : null }]));
  }
  return out;
}
const mediana = (l) => { const v = l.filter((x) => x != null).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2); };
export function normalizzaMetodica(m) {
  const t = String(m || '').toLowerCase();
  if (/mammo|tomosin/.test(t)) return 'Mammografia';
  if (/eco/.test(t)) return 'Ecografia';
  if (/^tc|tomografia comp|\bct\b/.test(t)) return 'TC';
  if (/^rm|risonanza|\bmr\b/.test(t)) return 'RM';
  if (/^rx|radiograf|^cr$|^dx$|opt|ortopan/.test(t)) return 'RX';
  if (/pet|nucleare|scint/.test(t)) return 'Medicina nucleare';
  if (/^angiograf|coronarograf|^xa$|\bdsa\b/.test(t)) return 'Angiografia';
  return t ? m : '';
}
export function confrontoColleghi(per, mio) {
  return Object.entries(per).map(([area, acc]) => {
    const io = acc[mio], altri = Object.entries(acc).filter(([id]) => id !== mio).map(([, t]) => t);
    const base = { area, colleghi: altri.length };
    if (!io) return { ...base, casi: 0 };
    const ok = altri.length >= 5;           // sotto 5 colleghi niente confronto: i dati sarebbero riconoscibili
    return { ...base, casi: io.casi, media: io.media, sens: io.sens, spec: io.spec,
      ...(ok ? { percentile: Math.round(100 * altri.filter((t) => t.media < io.media).length / altri.length + 50 * altri.filter((t) => t.media === io.media).length / altri.length),
        mediaColleghi: mediana(altri.map((t) => t.media)), sensColleghi: mediana(altri.map((t) => t.sens)), specColleghi: mediana(altri.map((t) => t.spec)) } : {}) };
  }).filter((x) => x.casi || x.colleghi >= 5).sort((a, b) => b.casi - a.casi);
}
export function letturaAggregata(per) {
  return Object.entries(per).map(([area, acc]) => { const l = Object.values(acc);
    return l.length >= 5 ? { area, persone: l.length, media: mediana(l.map((t) => t.media)), sens: mediana(l.map((t) => t.sens)), spec: mediana(l.map((t) => t.spec)) } : null; }).filter(Boolean);
}
// Temi delle risposte: per trovare i punti deboli («sbagli spesso le basi polmonari nelle TC dell'addome»).
// Il tema viene dal nome della sezione (tecnica, conclusioni) o dal testo dell'opzione; il primo che combacia vince.
export const TEMI = [
  ['tecnica', 'Tecnica dell\'esame', /tecnica/i, null],
  ['conclusioni', 'Conclusioni', /conclusion/i, null],
  ['dispositivi', 'Dispositivi, cateteri e protesi', null, /catetere|sondino|drenagg|pacemaker|defibrillat|elettrocatetere|protes|vit[ei]\b|chiod|placc|impiant|cementoplast|tubo endotrach|clip\b|stent/i],
  ['basi', 'Basi polmonari e torace nelle immagini dell\'addome', null, /basi polmonari|bas[ei] (del |dei )?polmon/i],
  ['pleura', 'Pleura e versamenti', null, /versament|pleur|pneumotorace/i],
  ['polmoni', 'Polmoni e noduli', null, /polmon|nodul[oi] (solid|polm|subpleur)|addensament|vetro smerigliato|interstiz|enfisema|bronc/i],
  ['linfonodi', 'Linfonodi', null, /linfonod|adenopat|linfoadenopat/i],
  ['vasi', 'Vasi', null, /aort|arteri|vena\b|vene\b|venos[oa]|embol|aneurism|tromb|dissezion|calcificazioni ateromas/i],
  ['encefalo', 'Encefalo', null, /encefal|ventricol|ischemi|emorrag|sostanza bianca|lacun|cerebr|subaracnoid|midline|linea mediana/i],
  ['midollo', 'Rachide, midollo e canale', null, /midoll|canale vertebrale|sacco durale|radic|forami|ernia|protrusion|disc[oh]/i],
  ['ossa', 'Ossa e scheletro', null, /oss[ea]|osse[oi]|vertebr|soma|somi|cost[ae]\b|frattur|cedim|osteo|scheletr|articol|femor|bacino|anca|spalla|ginocch|lit/i],
  ['fegato', 'Fegato, vie biliari e pancreas', null, /fegat|epatic|biliar|coledoc|colecist|pancrea|wirsung/i],
  ['reni', 'Reni, surreni e vie urinarie', null, /\bren[ei]\b|renal|surren|uret|vescic|calcol|idronefros|pielo/i],
  ['intestino', 'Stomaco, intestino e peritoneo', null, /stomac|intestin|colon|ansa|anse|appendic|diverticol|peritone|ascite|aria libera|pneumoperit|occlusion/i],
  ['mammella', 'Mammella', null, /mammell|BI-RADS|microcalcific|capezzol|ascell|seno\b|ghiandolar/i],
  ['cuore', 'Cuore e mediastino', null, /cuore|cardi|pericard|mediastin|ilo\b|ili\b/i],
];
export function temaOpzione(testo, nomeSezione = '') {
  for (const [k, nome, reSez, reTesto] of TEMI) if ((reSez && reSez.test(nomeSezione)) || (reTesto && reTesto.test(testo))) return { k, nome };
  return { k: 'altro', nome: 'Altri reperti' };
}
const METODICA_BREVE = (c) => [c?.modalita || '', c?.distretto || ''].filter(Boolean).join(' ');
// errori per tema e per tipo di esame dalle istantanee delle risposte: reperti attesi non scelti e distrattori scelti
export function analisiTemi(righe, casiPerId) {
  const out = {};
  for (const r of righe) {
    const c = casiPerId[r.caso]; if (!c || !Array.isArray(r.opzioni) || !r.opzioni.length) continue;
    const zona = METODICA_BREVE(c);
    for (const o of r.opzioni) {
      const atteso = o.tipo !== 'distrattore';
      const sez = Number.isInteger(o.z) ? c.sezioni?.[o.z]?.nome || '' : '';
      const t = temaOpzione(o.t || '', sez); if (t.k === 'conclusioni') continue;
      const key = `${t.k}|${zona}`;
      const x = (out[key] ||= { tema: t.k, nome: t.nome, zona, prove: 0, errori: 0, mancati: 0, sbagliati: 0, casi: new Set() });
      if (atteso) { x.prove++; if (!o.s) { x.errori++; x.mancati++; x.casi.add(r.caso); } }
      else if (o.s) { x.prove++; x.errori++; x.sbagliati++; x.casi.add(r.caso); }
    }
  }
  return Object.values(out).map((x) => ({ ...x, casi: [...x.casi], perc: x.prove ? Math.round(x.errori / x.prove * 100) : 0 }));
}
// casi che allenano un tema in un tipo di esame: reperti attesi di quel tema, esame dello stesso tipo
export function casiPerTema(casi, tema, zona) {
  return casi.filter((c) => METODICA_BREVE(c) === zona && (c.opzioni || []).some((o, i) => o.corretta
    && temaOpzione(o.testo, Number.isInteger(o.sezione) ? c.sezioni?.[o.sezione]?.nome || '' : '').k === tema)).map((c) => c.id);
}
// statistiche personali dello studente: errori ricorrenti per esame (metodica e distretto) e per tipo di reperto,
// andamento nel tempo e ripasso mirato sui punti deboli. Contano i primi tentativi (come nel confronto con i colleghi).
export function statisticheStudente(mie, casiPerId, visibili) {
  const ord = [...mie].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const primi = {}, migliore = {};
  for (const r of ord) { if (!primi[r.caso]) primi[r.caso] = r; migliore[r.caso] = Math.max(migliore[r.caso] ?? 0, Number(r.punteggio) || 0); }
  const P = Object.values(primi).filter((r) => casiPerId[r.caso]);
  const tecnica = (c, o) => Number.isInteger(o.z) && /tecnica/i.test(c.sezioni?.[o.z]?.nome || '');
  // casi da proporre: prima quelli già sbagliati (da rifare), poi quelli non ancora svolti, dai più semplici
  const ORD = { Base: 0, Intermedio: 1, Avanzato: 2 };
  const daProporre = (ids) => { const vis = new Set(visibili.map((c) => c.id)), dif = Object.fromEntries(visibili.map((c) => [c.id, ORD[c.difficolta] ?? 1]));
    const l = [...new Set(ids)].filter((id) => vis.has(id) && (migliore[id] ?? -1) < 90);
    return l.sort((a, b) => ((migliore[a] ?? -1) >= 0 ? 0 : 1) - ((migliore[b] ?? -1) >= 0 ? 0 : 1) || (dif[a] - dif[b])).slice(0, 10); };
  // per esame
  const aree = {}; let vp = 0, fn = 0, fp = 0, vn = 0, punti = 0;
  for (const r of P) {
    const c = casiPerId[r.caso], zona = METODICA_BREVE(c) || 'Altro';
    const a = (aree[zona] ||= { zona, casi: 0, punti: 0, perfetti: 0, vp: 0, fn: 0, fp: 0, vn: 0 });
    a.casi++; a.punti += Number(r.punteggio) || 0; punti += Number(r.punteggio) || 0; if (r.perfetta) a.perfetti++;
    for (const o of r.opzioni || []) { if (tecnica(c, o)) continue; if (o.tipo === 'distrattore') { if (o.s) { a.fp++; fp++; } else { a.vn++; vn++; } } else if (o.s) { a.vp++; vp++; } else { a.fn++; fn++; } }
  }
  const pc = (x, y) => (x + y ? Math.round(100 * x / (x + y)) : null);
  const perEsame = Object.values(aree).map((a) => ({ zona: a.zona, casi: a.casi, media: Math.round(a.punti / a.casi), perfetti: a.perfetti, mancati: a.fn, inventati: a.fp,
    sens: pc(a.vp, a.fn), spec: pc(a.vn, a.fp), ripasso: daProporre(visibili.filter((c) => METODICA_BREVE(c) === a.zona).map((c) => c.id)) })).sort((x, y) => x.media - y.media);
  // per tipo di reperto e incrocio tipo × esame
  const matrice = analisiTemi(P, casiPerId).filter((t) => t.prove && t.tema !== 'tecnica');
  const temi = {};
  for (const t of matrice) { const x = (temi[t.tema] ||= { tema: t.tema, nome: t.nome, prove: 0, errori: 0, mancati: 0, sbagliati: 0, zone: [] }); x.prove += t.prove; x.errori += t.errori; x.mancati += t.mancati; x.sbagliati += t.sbagliati; if (t.errori) x.zone.push({ zona: t.zona, perc: t.perc, errori: t.errori, prove: t.prove }); }
  const perTema = Object.values(temi).map((x) => ({ ...x, perc: x.prove ? Math.round(x.errori / x.prove * 100) : 0, zone: x.zone.sort((a, b) => b.perc - a.perc).slice(0, 3) })).sort((a, b) => b.perc - a.perc || b.errori - a.errori);
  // esempi degli errori (le frasi delle risposte), dai più recenti
  const esempi = {};
  for (const r of [...P].reverse()) { const c = casiPerId[r.caso], zona = METODICA_BREVE(c);
    for (const o of r.opzioni || []) { if (tecnica(c, o)) continue; const atteso = o.tipo !== 'distrattore'; if (atteso ? o.s : !o.s) continue;
      const t = temaOpzione(o.t || '', Number.isInteger(o.z) ? c.sezioni?.[o.z]?.nome || '' : ''); if (t.k === 'conclusioni' || t.k === 'tecnica') continue; const k = `${t.k}|${zona}`;
      if ((esempi[k] ||= []).length < 3) esempi[k].push({ caso: r.caso, testo: String(o.t || '').slice(0, 160), tipo: atteso ? 'mancato' : 'inventato' }); } }
  // punti deboli: tipo di reperto in un esame con almeno 3 prove, 2 errori e il 30% di errori; con i casi per il ripasso mirato
  const deboli = matrice.filter((t) => t.tema !== 'altro' && t.prove >= 3 && t.errori >= 2 && t.perc >= 30).sort((a, b) => b.perc - a.perc || b.errori - a.errori).slice(0, 6)
    .map((t) => ({ tema: t.tema, nome: t.nome, zona: t.zona, prove: t.prove, errori: t.errori, mancati: t.mancati, sbagliati: t.sbagliati, perc: t.perc,
      esempi: esempi[`${t.tema}|${t.zona}`] || [], casi: daProporre([...t.casi, ...casiPerTema(visibili, t.tema, t.zona)]) }));
  // andamento mensile dei primi tentativi
  const mesi = {}; for (const r of P) { const m = String(r.data).slice(0, 7); const x = (mesi[m] ||= { mese: m, n: 0, punti: 0 }); x.n++; x.punti += Number(r.punteggio) || 0; }
  const andamento = Object.values(mesi).sort((a, b) => a.mese.localeCompare(b.mese)).slice(-12).map((x) => ({ mese: x.mese, casi: x.n, media: Math.round(x.punti / x.n) }));
  return { risposte: mie.length, casi: P.length, media: P.length ? Math.round(punti / P.length) : null, sens: pc(vp, fn), spec: pc(vn, fp), mancati: fn, inventati: fp,
    perEsame, perTema, matrice: matrice.map(({ tema, nome, zona, prove, errori, perc }) => ({ tema, nome, zona, prove, errori, perc })), deboli, andamento };
}
const numero = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };
function pulisciDettagli(d) {
  d = d && typeof d === 'object' ? d : {};
  return {
    tempo: Math.round(numero(d.tempo, 86400)), tempoAttivo: Math.round(numero(d.tempoAttivo, 86400)),
    serie: (Array.isArray(d.serie) ? d.serie : []).slice(0, 50).map((x) => ({
      descrizione: String(x?.descrizione || '').slice(0, 80), viste: Math.round(numero(x?.viste, 5000)), totale: Math.round(numero(x?.totale, 5000)) })),
    mpr: !!d.mpr, mip: !!d.mip, vr: !!d.vr, misure: Math.round(numero(d.misure, 1000)), finestra: Math.round(numero(d.finestra, 10000)),
    roi: Math.round(numero(d.roi, 1000)), angoli: Math.round(numero(d.angoli, 1000)), confronto: !!d.confronto, allineamenti: Math.round(numero(d.allineamenti, 1000)), fusione: !!d.fusione,
    referto: String(d.referto || '').slice(0, 4000),
    // checklist di lettura: zone spuntate prima di rispondere
    ...(d.checklist && typeof d.checklist === 'object' ? { checklist: { tipo: String(d.checklist.tipo || '').slice(0, 20), fatte: Math.round(numero(d.checklist.fatte, 50)), totale: Math.round(numero(d.checklist.totale, 50)),
      mancanti: (Array.isArray(d.checklist.mancanti) ? d.checklist.mancanti : []).slice(0, 20).map((x) => String(x || '').slice(0, 120)) } } : {}),
    ...(pulisciComunicazioneFatta(d.comunicazione) ? { comunicazione: pulisciComunicazioneFatta(d.comunicazione) } : {}),
    // scale compilate dallo studente (confrontate con quelle del docente)
    scale: pulisciScale(d.scale).map(({ id, valori, valore, testo }) => ({ id, valori, valore, testo: testo.slice(0, 500) })),
    profili: Math.round(numero(d.profili, 1000)), sottrazione: !!d.sottrazione, note: Math.round(numero(d.note, 1000)),
    // immagini chiave scelte dallo studente: serie, immagine e testo delle annotazioni
    chiavi: (Array.isArray(d.chiavi) ? d.chiavi : []).slice(0, 12).map((x) => ({ s: String(x?.s || '').slice(0, 80), i: Math.round(numero(x?.i, 100000)),
      n: (Array.isArray(x?.n) ? x.n : []).slice(0, 6).map((t) => String(t || '').slice(0, 200)),
      // didascalia e vista (per riaprire l'immagine dal docente): serie, finestra, zoom, spostamento, rotazione, specchio
      ...(x?.d ? { d: String(x.d).slice(0, 200) } : {}),
      ...(x?.si != null && String(x.si).length <= 40 ? { si: String(x.si) } : {}),
      ...(Number.isFinite(+x?.ww) && +x.ww > 0 ? { wc: Math.round(Math.max(-100000, Math.min(100000, +x.wc || 0))), ww: Math.round(Math.min(200000, +x.ww)) } : {}),
      ...(Number.isFinite(+x?.z) && +x.z > 0 ? { z: Math.round(Math.min(50, +x.z) * 1000) / 1000, px: Math.round(Math.max(-1e5, Math.min(1e5, +x.px || 0))), py: Math.round(Math.max(-1e5, Math.min(1e5, +x.py || 0))) } : {}),
      ...([90, 180, 270].includes(+x?.r) ? { r: +x.r } : {}), ...(x?.f ? { f: 1 } : {}) })),
  };
}

// ---- richiesta clinica, precedenti, comunicazione dell'esito
const PRIORITA_RICH = ['PS', 'R', 'U', 'B', 'D', 'P'];
const testoBreve = (x, n) => String(x ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, n);
function pulisciRichiesta(r) {
  if (!r || typeof r !== 'object') return null;
  const out = { reparto: testoBreve(r.reparto, 80), priorita: PRIORITA_RICH.includes(r.priorita) ? r.priorita : '',
    lab: (Array.isArray(r.lab) ? r.lab : []).slice(0, 20).map((x) => [testoBreve(x?.[0], 60), testoBreve(x?.[1], 60)]).filter(([n, v]) => n.trim() && v.trim()),
    allergie: testoBreve(r.allergie, 200), farmaci: testoBreve(r.farmaci, 300), dispositivi: testoBreve(r.dispositivi, 200), gravidanza: testoBreve(r.gravidanza, 80) };
  return out.reparto || out.priorita || out.lab.length || out.allergie || out.farmaci || out.dispositivi || out.gravidanza ? out : null;
}
function pulisciPrecedenti(l) {
  return (Array.isArray(l) ? l : []).slice(0, 10).map((x) => ({ data: testoBreve(x?.data, 40), esame: testoBreve(x?.esame, 120), referto: testoBreve(x?.referto, 6000),
    ...(Number.isInteger(x?.serie) && x.serie >= 0 ? { serie: x.serie } : {}), ...(x?.didattico ? { didattico: true } : {}) })).filter((x) => x.referto.trim());
}
export const LIVELLI_COM = ['nessuna', 'differita', 'urgente', 'immediata'];
const DEST_COM = ['richiedente', 'ps', 'mmg', 'paziente'];
function pulisciComunicazione(c) {
  if (!c || typeof c !== 'object' || !LIVELLI_COM.includes(c.livello)) return null;
  return { livello: c.livello, accettabili: (Array.isArray(c.accettabili) ? c.accettabili : []).filter((x) => LIVELLI_COM.includes(x) && x !== c.livello),
    destinatari: (Array.isArray(c.destinatari) ? c.destinatari : ['richiedente']).filter((x) => DEST_COM.includes(x)),
    parole: (Array.isArray(c.parole) ? c.parole : []).slice(0, 8).map((x) => testoBreve(x, 40).toLowerCase()).filter(Boolean), motivo: testoBreve(c.motivo, 1000) };
}
function pulisciComunicazioneFatta(c) {
  if (!c || typeof c !== 'object' || !LIVELLI_COM.includes(c.livello)) return null;
  return { livello: c.livello, a: DEST_COM.includes(c.a) ? c.a : '', come: ['telefono', 'messaggio', 'referto'].includes(c.come) ? c.come : '',
    testo: testoBreve(c.testo, 600), dopo_s: Math.round(numero(c.dopo_s, 86400)) };
}
// esito critico: livello di urgenza giusto, persona giusta, mezzo adatto, contenuto, tempo e traccia nel referto.
// Livelli come le categorie ACR degli «actionable findings»: immediata (minuti), urgente (ore), differita (giorni).
export function valutaComunicazione(atteso, fatto, referto) {
  if (!atteso) return null;
  const f = fatto || { livello: 'nessuna' }, ord = (x) => LIVELLI_COM.indexOf(x), righe = [];
  const ok = (cond, punti, si, no) => { righe.push({ ok: !!cond, testo: cond ? si : no }); return cond ? punti : 0; };
  if (atteso.livello === 'nessuna') {
    const p = f.livello === 'nessuna' ? 100 : 60;
    righe.push({ ok: f.livello === 'nessuna', testo: f.livello === 'nessuna' ? 'Giusto: bastava il referto, nessuna comunicazione urgente.' : 'Il reperto non richiedeva una comunicazione oltre al referto: troppe chiamate tolgono peso a quelle importanti.' });
    return { punteggio: p, atteso: atteso.livello, fatto: f.livello, motivo: atteso.motivo, righe };
  }
  if (f.livello === 'nessuna') {
    righe.push({ ok: false, testo: `L'esito andava comunicato (${atteso.livello}): il solo referto non basta.` });
    return { punteggio: atteso.accettabili.includes('nessuna') ? 50 : 0, atteso: atteso.livello, fatto: f.livello, motivo: atteso.motivo, righe };
  }
  let p = 0;
  const dist = Math.abs(ord(f.livello) - ord(atteso.livello));
  if (f.livello === atteso.livello) p += ok(true, 35, 'Urgenza giusta.', '');
  else if (atteso.accettabili.includes(f.livello)) p += ok(true, 25, `Urgenza accettabile (attesa: ${atteso.livello}).`, '');
  else { righe.push({ ok: false, testo: `Urgenza da rivedere: attesa ${atteso.livello}, scelta ${f.livello}.` }); p += dist === 1 ? 12 : 0; }
  p += ok(atteso.destinatari.includes(f.a), 20, 'Persona giusta.', `Andava avvisato: ${atteso.destinatari.map((x) => ({ richiedente: 'il medico richiedente / il reparto', ps: 'il medico del Pronto soccorso', mmg: 'il medico di medicina generale', paziente: 'il paziente' }[x])).join(' o ')}.`);
  const servePresto = ['immediata', 'urgente'].includes(atteso.livello);
  p += ok(servePresto ? f.come === 'telefono' : ['telefono', 'messaggio'].includes(f.come), 15, servePresto ? 'Contatto diretto a voce: giusto per un esito urgente.' : 'Mezzo tracciato adatto.', servePresto ? 'Per un esito urgente serve il contatto diretto (telefono), con conferma della ricezione.' : 'Serve una comunicazione tracciata al medico, non solo il referto.');
  const testo = (f.testo || '').toLowerCase(), trov = atteso.parole.filter((w) => testo.includes(w.slice(0, 6)));
  p += ok(!atteso.parole.length || trov.length >= Math.ceil(atteso.parole.length / 2), 15, 'Il messaggio dice il reperto essenziale.', `Nel messaggio manca il reperto essenziale (${atteso.parole.join(', ')}).`);
  const limite = { immediata: 15 * 60, urgente: 60 * 60 }[atteso.livello];
  p += ok(!limite || (f.dopo_s || 0) <= limite, 5, limite ? `Comunicato dopo ${Math.round((f.dopo_s || 0) / 60)} minuti: in tempo.` : 'Tempo adeguato.', `Comunicato dopo ${Math.round((f.dopo_s || 0) / 60)} minuti: troppo tardi (entro ${limite / 60} minuti).`);
  p += ok(/comunicat|avvisat|contattat|informat|riferit[oa] (telefonicamente|al|alla)/i.test(referto || ''), 10, 'La comunicazione è registrata nel referto.', 'Nel referto va scritto a chi, quando e come è stato comunicato l\'esito.');
  return { punteggio: Math.min(100, p), atteso: atteso.livello, fatto: f.livello, motivo: atteso.motivo, righe };
}
const nSezioni = (d) => (Array.isArray(d.sezioni) ? Math.min(d.sezioni.filter((z) => String(z?.nome || '').trim()).length === d.sezioni.length ? d.sezioni.length : 0, 12) : 0);
const pulisciCaso = (id, d) => ({
  id,
  titolo: String(d.titolo || '').slice(0, 200),
  // titolo con la diagnosi, solo per gli autori: agli studenti si mostrano esame e sospetto clinico
  ...(d.titolo_interno ? { titolo_interno: String(d.titolo_interno).slice(0, 200) } : {}),
  distretto: String(d.distretto || '').slice(0, 80),
  // sospetto clinico breve (per la ricerca nell'elenco), es. «nodulo mammario palpabile»
  quesito: String(d.quesito || '').slice(0, 200),
  modalita: String(d.modalita || '').slice(0, 20),
  difficolta: String(d.difficolta || '').slice(0, 40),
  anamnesi: String(d.anamnesi || '').slice(0, 20000),
  domanda: String(d.domanda || '').slice(0, 2000),
  opzioni: (Array.isArray(d.opzioni) ? d.opzioni : []).slice(0, 40)
    .map((o) => {
      const tipo = TIPI.includes(o.tipo) ? o.tipo : null;
      return { testo: String(o.testo || '').slice(0, 500), corretta: tipo ? tipo !== 'distrattore' : !!o.corretta,
        ...(tipo ? { tipo } : {}), nota: String(o.nota || '').slice(0, 2000),
        ...(Number.isInteger(o.sezione) && o.sezione >= 0 && o.sezione < nSezioni(d) ? { sezione: o.sezione } : {}) };
    })
    .filter((o) => o.testo.trim()),
  // referto guidato: distretti in ordine (es. encefalo → torace → addome), ognuno con la sua domanda
  ...(nSezioni(d) ? { sezioni: d.sezioni.slice(0, 12).map((z) => ({ nome: String(z?.nome || '').slice(0, 80), domanda: String(z?.domanda || '').slice(0, 500),
    ...(Number.isInteger(z?.serie) && z.serie >= 0 ? { serie: z.serie } : {}), ...(z?.singola ? { singola: true } : {}),
    // caso a tappe: la serie del distretto resta chiusa finché lo studente non arriva a questa domanda
    ...(z?.scopri && Number.isInteger(z?.serie) && z.serie >= 0 ? { scopri: true } : {}) })) } : {}),
  spiegazione: String(d.spiegazione || '').slice(0, 50000),
  // richiesta clinica (impegnativa) e referti degli esami precedenti, come al lavoro
  ...(pulisciRichiesta(d.richiesta) ? { richiesta: pulisciRichiesta(d.richiesta) } : {}),
  ...(pulisciPrecedenti(d.precedenti).length ? { precedenti: pulisciPrecedenti(d.precedenti) } : {}),
  // comunicazione dell'esito attesa (esiti critici): livello, destinatari, parole chiave; mai mostrata prima della risposta
  ...(pulisciComunicazione(d.comunicazione) ? { comunicazione: pulisciComunicazione(d.comunicazione) } : {}),
  // appunti per i docenti (fonte dei reperti, cose da verificare): mai mostrati agli studenti
  ...(String(d.nota_docente || '').trim() ? { nota_docente: String(d.nota_docente).slice(0, 5000) } : {}),
  serie_iniziale: Number.isInteger(d.serie_iniziale) ? d.serie_iniziale : null,
  riquadri: Number.isInteger(d.riquadri) && d.riquadri >= 0 && d.riquadri <= 4 ? d.riquadri : 0,
  // serie in ogni riquadro all'apertura e serie nascoste agli studenti (indici di serie.json)
  disposizione: (Array.isArray(d.disposizione) ? d.disposizione : []).filter(Number.isInteger).slice(0, 4),
  serie_nascoste: (Array.isArray(d.serie_nascoste) ? d.serie_nascoste : []).filter(Number.isInteger).slice(0, 500),
  visibile: d.visibile === true,            // in bozza finché il docente non lo pubblica
  // vista del reperto per la correzione guidata: serie, immagine, finestra, zoom e un segno (ellisse)
  vista: pulisciVista(d.vista),
  // scale internazionali compilate dal docente (risposta attesa), solo quelle adatte al caso
  ...(pulisciScale(d.scale).length ? { scale: pulisciScale(d.scale) } : {}),
  // domanda sulla figura: lo studente indica il reperto, confrontato con il segno della vista
  ...(d.localizza ? { localizza: true } : {}),
  // segmentazione con IA (TotalSegmentator) già calcolata: si può nascondere caso per caso
  ...(d.ia === false ? { ia: false } : {}),
  // funzioni per gli studenti scelte dall'amministratore caso per caso (assenti = attive)
  ...(d.anatomia === false ? { anatomia: false } : {}),   // riconoscimento delle strutture anatomiche (?, Anat, vertebre)
  ...(d.scelte === false ? { scelte: false } : {}),       // risposte a scelta multipla: se spente, solo referto scritto
  ...(d.score === false ? { score: false } : {}),
  // checklist di lettura per lo studente: obbligatoria prima di rispondere o nascosta (assente = facoltativa)
  ...(['obbligatoria', 'spenta'].includes(d.checklist) ? { checklist: d.checklist } : {}),         // compilazione delle scale (Σ) da parte dello studente
  // caso nato da un errore reale del reparto («mancato»), con la lezione da trarne (mostrata dopo la risposta)
  ...(d.mancato === true ? { mancato: true } : {}),
  ...(String(d.lezione || '').trim() ? { lezione: String(d.lezione).slice(0, 2000) } : {}),
  // regola da ricordare e «lo stesso segno in altri casi»: mostrate solo dopo la risposta
  ...(String(d.regola || '').trim() ? { regola: String(d.regola).trim().slice(0, 300) } : {}),
  ...(Array.isArray(d.rassegna) && d.rassegna.some((x) => ID_OK.test(String(x?.caso || ''))) ? { rassegna: d.rassegna.filter((x) => ID_OK.test(String(x?.caso || ''))).slice(0, 8)
    .map((x) => ({ caso: String(x.caso), testo: String(x.testo || '').slice(0, 300) })) } : {}),
  // esito del caso (istologia, follow-up, intervento): mostrato solo dopo la risposta
  ...(String(d.esito_clinico?.testo || '').trim() ? { esito_clinico: { tipo: ['istologia', 'follow-up', 'intervento', 'altro'].includes(d.esito_clinico.tipo) ? d.esito_clinico.tipo : 'altro',
    testo: String(d.esito_clinico.testo).slice(0, 2000) } } : {}),
  // immagini da un archivio pubblico (es. TCIA): archivio e licenza sempre visibili, collezione, DOI e citazione
  // solo dopo la risposta (il nome della collezione può suggerire la diagnosi)
  ...(pulisciFonte(d.fonte) ? { fonte: pulisciFonte(d.fonte) } : {}),
  // acquisizione sbagliata (posizionamento, artefatti, protocollo): percorso per TSRM e radiologi
  ...(d.acquisizione === true ? { acquisizione: true } : {}),
  // schede teoriche collegate (id di schede.json)
  ...(Array.isArray(d.schede) && d.schede.some((x) => ID_OK.test(String(x))) ? { schede: [...new Set(d.schede.map(String).filter((x) => ID_OK.test(x)))].slice(0, 6) } : {}),
  aggiornato: new Date().toISOString().slice(0, 16).replace('T', ' '),
});
// Domanda sulla figura: il punto indicato dallo studente rispetto al segno (ellisse) del docente.
// Stessa serie, immagine entro ±3 da quella del segno; «centrato» dentro l'ellisse allargata del 30%
// (+10 pixel), «vicino» entro 2,5 volte, altrimenti «mancato».
// Modalità «solo referto»: lo studente scrive il referto senza le risposte a scelta. Il punteggio viene dal
// confronto per parole chiave con i reperti del caso (come nel browser, negazioni comprese); le frasi di
// teoria e la sezione «Tecnica» non contano. Reperto principale non citato: punteggio al massimo 50.
const PAROLE_VUOTE = new Set('della delle dello degli dalla dalle nella nelle negli sulla sulle senza circa verso sotto sopra anche quindi oppure ancora tipico tipica segni segno reperto reperti presenza assenza aspetto parte lato destro destra sinistro sinistra'.split(' '));
const normalizzaTesto = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TEORIA = /\b(si usa|si usano|si stima|si calcola|si intend|si descriv|si valuta|si studia|si riconosc|va |vanno |deve |devono |di norma|indica |indicano )/i;
// sinonimi e varianti del lessico radiologico: parole diverse con lo stesso significato diventano una sola radice
// (lo studente può scrivere «adenopatia» dove il docente ha scritto «linfonodo», «ipoattenuante» per «ipodenso»…)
const SINONIMI = [
  [/^(ipodens|ipoattenu)/, 'ipodens'], [/^(iperdens|iperattenu)/, 'iperdens'],
  [/^(ipointens|iposegnal)/, 'ipointens'], [/^(iperintens|ipersegnal)/, 'iperintens'],
  [/^(linfonod|adenopat|linfoadenopat|linfoaden)/, 'linfonod'],
  [/^(neoplas|neoform|tumor|massa$|masse$|formazion)/, 'neoplas'], [/^(metasta|secondarism)/, 'metasta'],
  [/^(emorrag|sanguinam|ematic)/, 'emorrag'], [/^(ischem|infart)/, 'ischem'],
  [/^(calcol|litiasi|litiasic)/, 'calcol'], [/^(dilataz|dilatat|ectasi|ectasic)/, 'dilataz'], [/^(idronefros|pielectas|ureteroidronefros)/, 'idronefr'],
  [/^(stenos|stenot|restring)/, 'stenos'], [/^(frattur|cediment|crollo|infrazion)/, 'frattur'],
  [/^(edem|imbibiz)/, 'edemat'], [/^(consolidam|addensam|opacam|epatizzaz)/, 'addensam'], [/^(atelettas|collass)/, 'atelett'],
  [/^nodul/, 'nodulo'], [/^(cisti$|cistic|cistich)/, 'cistic'], [/^(fegat|epatic)/, 'fegato'], [/^(rene$|reni$|renal)/, 'renale'],
  [/^(colecist|cistifell)/, 'colecist'], [/^(pneumon|broncopolmon|polmonit|flogos|flogist|infiamm)/, 'flogos'], [/^(milz|splenic)/, 'milza'], [/^polmon/, 'polmon'], [/^(encefal|cerebral|cerebr)/, 'encefal'],
  [/^(pneumotor|pnx$)/, 'pneumotor'], [/^(versam|effusion|ascit|liquid)/, 'versam'], [/^(occlus|ostruz)/, 'occlus'],
  [/^(aument|incrementat|ingrandit|ipertrof|voluminos)/, 'aumentat'], [/^(ridott|diminuit|ipotrof|atrof)/, 'ridott'],
  [/^(enhanc|impregn|captaz|potenziam|contrastograf)/, 'impregn'], [/^(disomogen|eterogen)/, 'disomog'],
  [/^(steatos|steatosic|epatosteat)/, 'steatos'], [/^(spondiloartros|artros|osteoartros|degenerat)/, 'artros'],
  [/^(ernia|ernie|protrus|estrusion)/, 'erniaz'], [/^(osteopor|osteopen|demineraliz|rarefaz)/, 'osteopor'],
  [/^(pneumon|broncopolmon|polmonit|flogos|flogist|infiamm)/, 'flogos'], [/^(fibros|fibrotic|interstiziopat)/, 'fibros'],
  [/^(diametro|diametri|calibro)/, 'calibro'],
];
// parole che negano quella che segue (fino a 3 parole prima) o quella che precede (fino a 2 parole dopo)
const NEGA_PRIMA = /^(non|senza|nessun[aoe]?|assenza|esclus[aoie]|negativ[aoie]|ne|privo|priva|privi|prive)$/;
const NEGA_DOPO = /^(assent[ei]|negativ[aoie]|esclus[aoie])$/;
// radici con la loro polarità (affermata e/o negata) in un testo
function radiciDi(testo) {
  const out = new Map();
  // la negazione non scavalca la punteggiatura: «non versamento, linfonodi aumentati»
  for (const frase of normalizzaTesto(testo).split(/[.;:!?\n()]+/)) {
  const parole = frase.split(/[^a-z0-9]+/).filter(Boolean);
  parole.forEach((w0, i) => {
    // «-ite» (infiammazione) non si confonde con l'organo o con «-osi»: pancreatite ≠ pancreas, diverticolite ≠ diverticolosi
    const ite = /it[ei]$/.test(w0) && w0.length > 6;
    let w = canonico(w0); if (ite && w !== 'flogos') w = w0.slice(0, 6) + '~i';
    if (w.length < 4) return;
    // la negazione vale per tutta la proposizione che segue («non evidenti rime di frattura di clavicola, omero…»),
    // fino alla punteggiatura o a «ma», «con», «mentre», «tuttavia», «invece»
    let negP = false;
    for (let j = i - 1; j >= 0; j--) { if (/^(ma|pero|tuttavia|mentre|invece|con)$/.test(parole[j])) break; if (NEGA_PRIMA.test(parole[j])) { negP = true; break; } }
    const neg = negP || parole.slice(i + 1, i + 3).some((x) => NEGA_DOPO.test(x));
    const r = w.endsWith('~i') ? w : w.slice(0, 6), v = out.get(r) || { pos: false, neg: false };
    if (neg) v.neg = true; else v.pos = true; out.set(r, v);
  });
  }
  return out;
}
const canonico = (w) => { for (const [re, c] of SINONIMI) if (re.test(w)) return c; return w; };
const TEORIA_SBAGLIATA = /\b(sempre|mai|serve|servono|richied\w*|influisc\w*|si puo|si può|bisogna|occorre|basta|inutile)\b/i;
const PAROLE_VUOTE_R = new Set([...PAROLE_VUOTE].map((w) => w.slice(0, 6)));
// modelli di referto strutturato: i titoli in MAIUSCOLO a inizio riga («PARENCHIMA POLMONARE:») e i segnaposto «…»
// non sono reperti scritti dallo studente e non contano (né per il punteggio né per la lunghezza minima)
export function togliModello(testo) {
  return String(testo || '').split('\n').map((r) => r.replace(/^[ \t]*[A-ZÀÈÉÌÒÙ][A-ZÀÈÉÌÒÙ0-9 ,/'’()\-]{1,60}:/, '').replace(/…|\.{3}/g, ' ').trim()).filter(Boolean).join('\n');
}
/** voci del referto del docente: i reperti attesi del caso, sezione per sezione (senza tecnica e frasi di teoria) */
export function vociReferto(caso) {
  const opz = caso.opzioni || [], sez = caso.sezioni || [];
  const tecnica = (o) => Number.isInteger(o.sezione) && /tecnica/i.test(sez[o.sezione]?.nome || '');
  const voci = opz.map((o, i) => ({ o, tipo: tipoOpzione(opz, i) })).filter(({ o, tipo }) => tipo !== 'distrattore' && !tecnica(o) && !TEORIA.test(o.testo))
    .map(({ o, tipo }) => ({ testo: o.testo, principale: tipo === 'principale', sezione: Number.isInteger(o.sezione) ? sez[o.sezione]?.nome || '' : '' }));
  const sbagliate = opz.map((o, i) => ({ o, tipo: tipoOpzione(opz, i) })).filter(({ o, tipo }) => tipo === 'distrattore' && !tecnica(o) && !TEORIA.test(o.testo) && !TEORIA_SBAGLIATA.test(o.testo)).map(({ o }) => o.testo);
  return { voci, sbagliate };
}
export function valutaReferto(caso, testo) {
  testo = togliModello(testo);
  const opz = caso.opzioni || [], sez = caso.sezioni || [];
  const tecnica = (o) => Number.isInteger(o.sezione) && /tecnica/i.test(sez[o.sezione]?.nome || '');
  const attesi = opz.map((o, i) => ({ o, tipo: tipoOpzione(opz, i) })).filter(({ o, tipo }) => tipo !== 'distrattore' && !tecnica(o) && !TEORIA.test(o.testo));
  // le affermazioni sbagliate di teoria («va sempre biopsiata»…) non sono reperti: non contano come errori nel referto
  const sbagliati = opz.map((o, i) => ({ o, tipo: tipoOpzione(opz, i) })).filter(({ o, tipo }) => tipo === 'distrattore' && !tecnica(o) && !TEORIA.test(o.testo) && !TEORIA_SBAGLIATA.test(o.testo));
  const radici = radiciDi(testo);
  // chiavi del reperto atteso con la sua polarità: «assenza di versamento» va ritrovato negato, non affermato
  const chiavi = (a) => { const r = radiciDi(a); return [...r].filter(([w]) => w.length >= 5 && !PAROLE_VUOTE_R.has(w)).map(([w, v]) => ({ w, neg: v.neg && !v.pos })); };
  const trovata = (c) => { const v = radici.get(c.w); return !!v && (c.neg ? v.neg : v.pos); };
  const frazione = (k) => (k.length ? k.filter(trovata).length / k.length : 0);
  // affermazione sbagliata scritta come presente: almeno due parole chiave, o una sola se è un termine specifico (≥ 6 lettere) ritrovato
  const scritto = (o) => { const k = chiavi(o.testo); return (k.length >= 2 && frazione(k) >= (k.length >= 3 ? 0.75 : 0.6)) || (k.length === 1 && k[0].w.length >= 6 && trovata(k[0])); };
  const sbagliatiScritti = sbagliati.filter(({ o }) => scritto(o)), chiaviSbagliate = sbagliatiScritti.map(({ o }) => new Set(chiavi(o.testo).map((c) => c.w)));
  // 1.259: se le parole trovate sono già spiegate da un'affermazione sbagliata scritta («versamento pericardico» al posto di
  // «versamento pleurico»), il reperto atteso conta solo se compare anche una delle sue parole proprie (qui «pleurico»)
  const citato = (t) => {
    const k = chiavi(t), f = frazione(k);
    if (!(f >= 0.4 || (f >= 0.25 && k.filter(trovata).length >= 3))) return false;
    for (const e of chiaviSbagliate) {
      if (!k.some((c) => trovata(c) && e.has(c.w))) continue;
      const proprie = k.filter((c) => !e.has(c.w));
      if (proprie.length && !proprie.some(trovata)) return false;
    }
    return true;
  };
  const righe = attesi.map(({ o, tipo }) => ({ testo: o.testo, principale: tipo === 'principale', ok: citato(o.testo), sezione: Number.isInteger(o.sezione) ? sez[o.sezione]?.nome || '' : '' }));
  const errori = sbagliatiScritti.map(({ o }) => o.testo);
  const n = righe.filter((x) => x.ok).length;
  let punteggio = righe.length ? Math.round(100 * n / righe.length) : 0;
  punteggio = Math.max(0, punteggio - 15 * errori.length);
  if (righe.some((x) => x.principale && !x.ok)) punteggio = Math.min(50, punteggio);
  return { punteggio, citati: n, attesi: righe.length, mancati: righe.filter((x) => !x.ok).map((x) => x.testo), errori, voci: righe };
}
function casoAtteso(caso) {
  const opz = caso.opzioni || [];
  const giuste = opz.map((o, i) => ({ o, tipo: tipoOpzione(opz, i) })).filter((x) => x.tipo !== 'distrattore');
  const sbagliate = opz.map((o, i) => ({ o, tipo: tipoOpzione(opz, i) })).filter((x) => x.tipo === 'distrattore');
  const sez = (o) => (Number.isInteger(o.sezione) && caso.sezioni?.[o.sezione] ? `[${caso.sezioni[o.sezione].nome}] ` : '');
  return [
    `Esame: ${caso.titolo || ''}${caso.quesito ? ' — quesito: ' + caso.quesito : ''}`,
    caso.anamnesi ? `Anamnesi: ${String(caso.anamnesi).slice(0, 1500)}` : '',
    'REPERTI PRESENTI (attesi nel referto):',
    ...giuste.map(({ o, tipo }) => `- ${sez(o)}${o.testo}${tipo === 'principale' ? ' (reperto principale)' : ''}${o.nota ? ' — ' + o.nota : ''}`),
    'AFFERMAZIONI SBAGLIATE (non devono comparire come presenti):',
    ...sbagliate.map(({ o }) => `- ${sez(o)}${o.testo}`),
    caso.spiegazione ? `DISCUSSIONE DEL DOCENTE: ${String(caso.spiegazione).slice(0, 5000)}` : '',
  ].filter(Boolean).join('\n');
}
export function valutaPunto(vista, punto) {
  const sg = vista?.segno;
  if (!sg) return null;
  if (!punto || !Number.isFinite(+punto.x) || !Number.isFinite(+punto.y)) return { esito: 'assente' };
  const cx = (sg.a.x + sg.b.x) / 2, cy = (sg.a.y + sg.b.y) / 2, rx = Math.abs(sg.b.x - sg.a.x) / 2, ry = Math.abs(sg.b.y - sg.a.y) / 2;
  const d = (k, m) => ((+punto.x - cx) / (rx * k + m)) ** 2 + ((+punto.y - cy) / (ry * k + m)) ** 2;
  const stessa = +punto.serie === vista.serie, dz = Math.abs((+punto.idx || 0) - (vista.idx || 0));
  if (stessa && dz <= 3 && d(1.3, 10) <= 1) return { esito: 'centrato' };
  if (stessa && dz <= 6 && d(2.5, 20) <= 1) return { esito: 'vicino' };
  return { esito: 'mancato', ...(stessa ? {} : { altraSerie: true }) };
}
// scala compilata: { id, valori (campi della scheda), valore (es. «Bosniak IIF»), testo (frase per il referto) }
const ID_SCALA = /^[a-z0-9-]{2,24}$/;
// fonte esterna delle immagini (archivi pubblici con licenza CC BY): testi brevi, link solo https
function pulisciFonte(f) {
  if (!f || typeof f !== 'object' || !String(f.archivio || '').trim()) return null;
  const t = (x, n) => String(x || '').trim().slice(0, n);
  const u = (x) => (/^https:\/\/[^\s"<>]+$/.test(String(x || '')) ? String(x).slice(0, 300) : '');
  const o = { archivio: t(f.archivio, 120), licenza: t(f.licenza, 60), licenza_url: u(f.licenza_url), collezione: t(f.collezione, 120),
    doi: t(f.doi, 120), citazione: t(f.citazione, 1500), soggetto: t(f.soggetto, 60), url: u(f.url) };
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v));
}
function pulisciScale(x) {
  return (Array.isArray(x) ? x : []).slice(0, 8).filter((s) => s && ID_SCALA.test(s.id)).map((s) => {
    let valori = s.valori && typeof s.valori === 'object' && !Array.isArray(s.valori) ? s.valori : {};
    if (JSON.stringify(valori).length > 4000) valori = {};
    return { id: s.id, valori, valore: String(s.valore || '').slice(0, 60), testo: String(s.testo || '').slice(0, 1200) };
  }).filter((s, i, a) => a.findIndex((t) => t.id === s.id) === i);
}
function pulisciVista(v) {
  if (!v || typeof v !== 'object' || !Number.isInteger(v.serie)) return null;
  const n = (x, lo, hi) => (Number.isFinite(+x) ? Math.max(lo, Math.min(hi, +x)) : null);
  const punto = (p) => (p && Number.isFinite(+p.x) && Number.isFinite(+p.y) ? { x: +(+p.x).toFixed(1), y: +(+p.y).toFixed(1) } : null);
  const segno = v.segno && punto(v.segno.a) && punto(v.segno.b) ? { a: punto(v.segno.a), b: punto(v.segno.b) } : null;
  // misura di riferimento del docente (distanza o RECIST) con la spaziatura dei pixel, per il confronto con lo studente
  const ms = v.misura, misura = ms && punto(ms.a) && punto(ms.b) && Array.isArray(ms.sp) && ms.sp.length === 2 && ms.sp.every((x) => Number.isFinite(+x) && +x > 0 && +x < 50)
    ? { tipo: ms.tipo === 'recist' ? 'recist' : 'linea', a: punto(ms.a), b: punto(ms.b), ...(punto(ms.c) && punto(ms.d) ? { c: punto(ms.c), d: punto(ms.d) } : {}), sp: ms.sp.map((x) => +(+x).toFixed(5)) } : null;
  return { serie: v.serie, idx: Number.isInteger(v.idx) ? v.idx : 0, wc: n(v.wc, -5000, 70000), ww: n(v.ww, 1, 140000),
    zoom: n(v.zoom, 0.2, 20) ?? 1, panX: n(v.panX, -5000, 5000) ?? 0, panY: n(v.panY, -5000, 5000) ?? 0, segno, ...(misura ? { misura } : {}),
    nota: String(v.nota || '').slice(0, 300) };
}
const visibile = (c) => c.visibile !== false;
// controlli di completezza per la gestione dei casi (solo autori): cosa manca prima di pubblicarlo
export function controlliCaso(c) {
  const o = c.opzioni || [], z = c.sezioni || [], out = [];
  if (o.length < 2) out.push('meno di 2 risposte');
  const pr = o.filter((_, i) => tipoOpzione(o, i) === 'principale').length;
  if (o.length && pr !== 1) out.push(pr ? `${pr} reperti principali` : 'nessun reperto principale');
  z.forEach((x, k) => { const ops = o.filter((y) => y.sezione === k); if (ops.length && !ops.some((y) => y.corretta)) out.push(`«${x.nome}» senza risposta corretta`); });
  if (z.length && !z.some((x) => /conclusion/i.test(x.nome))) out.push('manca la sezione Conclusioni');
  if (!String(c.spiegazione || '').trim()) out.push('manca la spiegazione');
  // nota del docente: «DA CONTROLLARE» (per es. dall'analisi IA) o un «verificare» non ancora chiuso dalla conferma del docente
  const nota = c.nota_docente || '';
  if (/DA CONTROLLARE/.test(nota)) out.push('nota: DA CONTROLLARE');
  else if (/verificar|da controllare/i.test(nota) && !/confermat\w* dal docente/i.test(nota)) out.push('nota: da verificare');
  if (c.localizza && !c.vista?.segno) out.push('domanda sulla figura senza segno');
  return out;
}
// Statistiche per caso dai risultati: solo il primo tentativo di ogni iscritto (non l'amministratore).
// Con almeno MIN_STAT risposte la difficoltà diventa automatica: media ≥75% Base, ≥50% Intermedio, sotto Avanzato.
// Tenute in memoria qualche minuto per non rileggere tutti i risultati a ogni richiesta.
export const MIN_STAT = 5;
let cacheStat = null;
export function difficoltaDa(media) { return media >= 75 ? 'Base' : media >= 50 ? 'Intermedio' : 'Avanzato'; }
export function calcolaStatistiche(righe) {
  const visti = new Set(), per = new Map();
  for (const r of righe || []) {
    if (!r || r.ruolo === 'admin' || !r.caso || !r.account) continue;
    const k = r.account + '|' + r.caso;
    if (visti.has(k)) continue;             // i risultati arrivano in ordine di data: il primo è il primo tentativo
    visti.add(k);
    const p = Number(r.punteggio); if (!Number.isFinite(p)) continue;
    const s = per.get(r.caso) || { n: 0, somma: 0 }; s.n++; s.somma += p; per.set(r.caso, s);
  }
  const out = {};
  for (const [c, s] of per) { const media = Math.round(s.somma / s.n); out[c] = { n: s.n, media, ...(s.n >= MIN_STAT ? { livello: difficoltaDa(media) } : {}) }; }
  return out;
}
async function statistiche(M) {
  if (cacheStat && Date.now() - cacheStat.t < 5 * 60e3) return cacheStat.v;
  const righe = await M.risultati().catch(() => []);
  const ord = [...righe].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  cacheStat = { t: Date.now(), v: calcolaStatistiche(ord) };
  return cacheStat.v;
}   // i casi senza il campo (i primi) sono visibili
// percorsi accettati per il caricamento delle immagini di un caso
const PERCORSO_OK = /^(serie\/[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9_.-]{1,80}\.dcm|serie\.json)$/;
const csvCampo = (v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const pubblicoAccount = (a) => ({ id: a.id, nome: a.nome, ruolo: a.ruolo, attivo: a.attivo !== false,
  creato: a.creato || '', ultimoAccesso: a.ultimoAccesso || '', email: a.email || '', autore: !!a.autore,
  categoria: a.categoria || '', sede: a.sede || '', anno: a.anno || '', confermato: a.stato !== 'attesa',
  noDocente: !!a.noDocente, docenti: Array.isArray(a.docenti) ? a.docenti : [], conPassword: !!a.pw, conCodice: !!a.hash,
  ...(a.invitato && !a.pw ? { invitoInAttesa: a.invitato } : {}) });
const pulisciTesto = (t, n) => String(t ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const ritardo = (ms) => new Promise((r) => setTimeout(r, ms));
const EMAIL_OK = /^[^\s@<>",;]{1,64}@[^\s@<>",;]{1,190}\.[a-z]{2,24}$/i;
const pulisciEmail = (e) => { const x = String(e || '').trim().toLowerCase().slice(0, 254); return EMAIL_OK.test(x) ? x : ''; };
// Date «italiane» (1.261, test/date.test.mjs): le scadenze sono giorni del calendario italiano, mentre le date salvate
// sono in UTC («AAAA-MM-GG HH:MM»). Senza conversione, un compito che scade il 20 restava aperto fino all'1 o alle 2 di
// notte del 21 e, nel giorno della scadenza, chi è in un altro fuso vedeva date sbagliate. L'ora legale è quella di Roma.
const FMT_ROMA = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
const FMT_OFF = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' });
/** il giorno di calendario in Italia («AAAA-MM-GG») in un istante (millisecondi o Date) */
export const giornoItalia = (t = Date.now()) => FMT_ROMA.format(new Date(t));
/** n giorni di calendario dopo il giorno «AAAA-MM-GG» (non n×24 ore: col cambio dell'ora un giorno ne ha 23 o 25) */
export const piuGiorni = (g, n) => new Date(Date.parse(g + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const minutiRoma = (t) => { const m = (FMT_OFF.formatToParts(new Date(t)).find((p) => p.type === 'timeZoneName')?.value || '').match(/GMT([+-])(\d+)(?::(\d+))?/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0; };
/** fine (23:59 in Italia) del giorno «AAAA-MM-GG», nel formato UTC delle date salvate */
export function fineGiornoItalia(g) {
  const [a, m, d] = g.split('-').map(Number), t = Date.UTC(a, m - 1, d, 23, 59);
  return new Date(t - minutiRoma(t - 3 * 3600000) * 60000).toISOString().slice(0, 16).replace('T', ' ');
}
const dataIt = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
// ---------------- sponsor (solo nella vetrina gratuita radio-quiz.it; mai nelle istanze delle aziende)
// Sponsor: { id, nome, link (https), testo, logo (data URL png/jpeg/webp/svg, max ~200 kB), posizioni: ['accesso','home','caso'],
//            dal, al ('AAAA-MM-GG', facoltativi), attivo }. Agli sponsor non va alcun dato personale: si contano
//            solo in forma aggregata le visualizzazioni e i clic per giorno.
export const POSIZIONI_SPONSOR = ['accesso', 'home', 'caso'];
const LOGO_OK = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
function pulisciSponsor(d, prima = {}) {
  const t = (x, n) => String(x ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const data = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(x || '') ? x : '');
  const link = t(d.link ?? prima.link, 300);
  const logo = typeof d.logo === 'string' ? d.logo : prima.logo || '';
  return { id: prima.id, nome: t(d.nome ?? prima.nome, 80) || 'Sponsor', link: /^https:\/\/[^\s"'<>]+$/.test(link) ? link : '',
    testo: t(d.testo ?? prima.testo, 200), logo: logo.length <= 280000 && LOGO_OK.test(logo) ? logo : '',
    posizioni: (Array.isArray(d.posizioni) ? d.posizioni : prima.posizioni || POSIZIONI_SPONSOR).filter((x) => POSIZIONI_SPONSOR.includes(x)),
    dal: data(d.dal ?? prima.dal), al: data(d.al ?? prima.al), attivo: typeof d.attivo === 'boolean' ? d.attivo : prima.attivo !== false,
    creato: prima.creato || new Date().toISOString().slice(0, 10) };
}
const sponsorAttivo = (x, oggi = giornoItalia()) => x.attivo !== false && (!x.dal || x.dal <= oggi) && (!x.al || x.al >= oggi);
const PAGINE_TRAFFICO = new Set(['cruscotto', 'vetrini', 'allenamento', 'progressi', 'elenco', 'caso', 'editor', 'nuovo', 'aggiungi', 'analisi', 'esame', 'confronto', 'proponi', 'errore', 'aiuto', 'profilo',
  'gestione-casi', 'classi', 'percorsi', 'revisione', 'account', 'accesso', 'iscriviti', 'conferma', 'nuova-password']);
const ora16 = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

/**
 * req = { metodo, percorso, headers, corpo }
 * cfg = { hashAdmin, segreto, magazzino, sicuro }
 * → { stato, headers, corpo }
 */
// ---------------- elementi di gioco: punti, serie di risposte esatte, livelli
// Calcolati ogni volta dai risultati salvati (nessun dato in più da tenere allineato).
// Punti solo al primo tentativo di ogni caso: ripetere un caso già visto non fa salire la classifica.
export const LIVELLI_GIOCO = [
  [0, 'Matricola'], [50, 'Osservatore'], [150, 'Apprendista'], [300, 'Lettore'],
  [500, 'Lettore esperto'], [800, 'Refertatore'], [1200, 'Radiologo'], [1700, 'Radiologo esperto'],
  [2300, 'Consulente'], [3000, 'Maestro'],
];
export function livelloDi(punti) {
  let n = 0;
  while (n + 1 < LIVELLI_GIOCO.length && punti >= LIVELLI_GIOCO[n + 1][0]) n++;
  const prossimo = LIVELLI_GIOCO[n + 1];
  return { n: n + 1, nome: LIVELLI_GIOCO[n][1], da: LIVELLI_GIOCO[n][0], a: prossimo ? prossimo[0] : null, prossimo: prossimo ? prossimo[1] : null };
}
// punti di una risposta al primo tentativo: fino a 10 per il punteggio, +5 se esatta,
// e un bonus per la serie di risposte esatte di fila (da 2 in su, massimo +5)
export function puntiRisposta(punteggio, perfetta, serie) {
  return Math.round((Number(punteggio) || 0) / 10) + (perfetta ? 5 + Math.min(Math.max(serie - 1, 0), 5) : 0);
}
// Ripasso degli errori (ripetizione dilazionata): un caso sbagliato torna dopo 1 giorno; ogni risposta
// esatta successiva allunga l'attesa (7, poi 30 giorni); dopo 3 risposte esatte di fila esce dal ripasso.
// Un nuovo errore lo riporta a 1 giorno.
export const INTERVALLI_RIPASSO = [1, 7, 30];
export function ripasso(mie, adesso = new Date()) {
  const per = new Map();
  for (const r of mie) { const c = String(r.caso); if (!per.has(c)) per.set(c, []); per.get(c).push(r); }
  const out = [];
  for (const [caso, l] of per) {
    if (!l.some((r) => !r.perfetta)) continue;            // mai sbagliato: niente ripasso
    let k = 0;
    for (const r of l) k = r.perfetta ? k + 1 : 0;        // risposte esatte di fila dopo l'ultimo errore
    if (k >= INTERVALLI_RIPASSO.length) continue;          // imparato
    const ultima = l[l.length - 1], giorni = INTERVALLI_RIPASSO[k];
    const t = new Date(String(ultima.data).replace(' ', 'T') + ':00Z');
    const scadenza = new Date(t.getTime() + giorni * 86400000);
    out.push({ caso, ultimo: Number(ultima.punteggio) || 0, esatte: k, giorni, scadenza: scadenza.toISOString().slice(0, 10), dovuto: scadenza <= adesso });
  }
  return out.sort((a, b) => a.scadenza.localeCompare(b.scadenza));
}
// stato di un compito per una persona: casi svolti (almeno un tentativo), entro la scadenza, punteggio medio (migliore per caso)
export function statoCompito(k, righe) {
  const fine = /^\d{4}-\d{2}-\d{2}$/.test(k.scadenza || '') ? fineGiornoItalia(k.scadenza) : null, migliori = {};
  let inTempo = 0;
  for (const id of k.casi || []) {
    const l = righe.filter((r) => String(r.caso) === id).sort((a, b) => String(a.data).localeCompare(String(b.data)));
    if (!l.length) continue;
    migliori[id] = Math.max(...l.map((r) => Number(r.punteggio) || 0));
    if (!fine || String(l[0].data) <= fine) inTempo++;
  }
  const fatti = Object.keys(migliori).length, v = Object.values(migliori);
  return { fatti, totale: (k.casi || []).length, inTempo, media: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null,
    fatti_ids: Object.keys(migliori) };
}
export function progressi(righe, account) {
  const mie = righe.filter((r) => r.account === account).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const visti = new Set(), casi = {};
  let punti = 0, serie = 0, migliore = 0, perfetti = 0, ultimi = 0;
  for (const r of mie) {
    const c = String(r.caso);
    casi[c] = Math.max(casi[c] ?? 0, Number(r.punteggio) || 0);
    if (visti.has(c)) { ultimi = 0; continue; }             // tentativi successivi: niente punti, la serie non cambia
    visti.add(c);
    serie = r.perfetta ? serie + 1 : 0;
    if (r.perfetta) perfetti++;
    migliore = Math.max(migliore, serie);
    ultimi = puntiRisposta(r.punteggio, r.perfetta, serie);
    punti += ultimi;
  }
  return { punti, livello: livelloDi(punti), serie, migliore, casiRisolti: visti.size, perfetti, casi, ultimi, ripasso: ripasso(mie) };
}


// ---------------- avvisi per email (testo semplice + HTML essenziale)
const escH = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PIEDE_AVVISI = 'Ricevi questo messaggio perché un tuo docente ti ha assegnato dei casi. Per non ricevere più avvisi, toglili nel tuo profilo («Il mio profilo»).';
function corpoEmail(righe, link, { pulsante = 'Apri la piattaforma', piede = PIEDE_AVVISI } = {}) {
  const testo = righe.join('\n') + `\n\n${pulsante}: ${link}\n\n${piede}`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1b2430">${righe.map((r) => (r ? `<p style="margin:0 0 8px">${escH(r)}</p>` : '')).join('')}
    <p style="margin:16px 0"><a href="${escH(link)}" style="background:#2f7de1;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none">${escH(pulsante)}</a></p>
    <p style="color:#6b7684;font-size:12px">${escH(piede)}</p></div>`;
  return { testo, html };
}
const radice = (indirizzo) => String(indirizzo || '').replace(/\/+$/, '');
/** [oggetto, corpo] dell'email di conferma dell'iscrizione. */
export function testoConferma(nome, indirizzo, codice) {
  const link = `${radice(indirizzo)}/#/conferma/${codice}`;
  return ['Conferma la tua iscrizione a Quiz Radiologia', corpoEmail([`Ciao ${nome},`,
    'grazie per esserti iscritto a Quiz Radiologia, la piattaforma di casi radiologici anonimi per la formazione (versione dimostrativa: proof of concept).',
    'Per attivare l\'account conferma il tuo indirizzo email con il pulsante qui sotto. Il link vale 48 ore.'], link,
  { pulsante: 'Conferma l\'indirizzo', piede: 'Se non ti sei iscritto tu, ignora questo messaggio: senza conferma l\'account non viene attivato e viene cancellato.' })];
}
/** [oggetto, corpo] dell'email per scegliere una nuova password. */
export function testoNuovaPassword(nome, indirizzo, codice) {
  const link = `${radice(indirizzo)}/#/nuova-password/${codice}`;
  return ['Nuova password per Quiz Radiologia', corpoEmail([`Ciao ${nome},`,
    'abbiamo ricevuto una richiesta di nuova password per il tuo account. Il link vale un\'ora e si può usare una sola volta.'], link,
  { pulsante: 'Scegli la nuova password', piede: 'Se non l\'hai chiesta tu, ignora questo messaggio: la password attuale resta valida.' })];
}
/** [oggetto, corpo] dell'invito di un account creato dall'amministratore (link per scegliere la password, 7 giorni). */
export function testoInvito(nome, indirizzo, codice, ruolo, azienda = '') {
  const link = `${radice(indirizzo)}/#/nuova-password/${codice}`;
  const come = { admin: 'amministratore', docente: 'docente' }[ruolo] || 'specializzando';
  const dove = azienda ? `la piattaforma di formazione radiologica di ${azienda}` : 'Quiz Radiologia, la piattaforma di casi radiologici anonimi per la formazione';
  return [azienda ? `Invito alla piattaforma di formazione di ${azienda}` : 'Invito a Quiz Radiologia', corpoEmail([`Ciao ${nome},`,
    `sei stato invitato come ${come} in ${dove}.`,
    'Per entrare scegli la tua password con il pulsante qui sotto: il link vale 7 giorni e si può usare una sola volta. Poi entrerai con questo indirizzo email e la password.'], link,
  { pulsante: 'Scegli la password', piede: 'Se non ti aspettavi questo invito, ignora il messaggio o rispondi per segnalarlo.' })];
}
// istanza: la vetrina pubblica (radio-quiz.it, dimostrazione con iscrizione libera) o la piattaforma di un'azienda
// (installazione separata, solo account invitati dall'amministratore, nessuna pagina pubblica)
export const istanzaDi = (cfg) => {
  const i = cfg?.istanza || {}, azienda = i.modo === 'azienda', oggi = giornoItalia();
  const scadenza = azienda && /^\d{4}-\d{2}-\d{2}$/.test(i.scadenza || '') ? i.scadenza : '';
  // piattaforma di un cliente sospesa o con il servizio scaduto: entra solo l'amministratore (per esportare i dati)
  const blocco = !azienda ? '' : i.sospesa ? 'sospesa' : scadenza && oggi > scadenza ? 'scaduta' : '';
  const utentiMax = azienda ? Math.max(0, parseInt(i.utentiMax, 10) || 0) : 0;
  return { modo: azienda ? 'azienda' : 'vetrina', nome: String(i.nome || '').slice(0, 120), contatto: String(i.contatto || '').slice(0, 254),
    ...(blocco ? { blocco } : {}), ...(scadenza ? { scadenza } : {}), ...(utentiMax ? { utentiMax } : {}) };
};
const messaggioBlocco = (IST) => (IST.blocco === 'sospesa' ? 'La piattaforma è sospesa' : `Il servizio della piattaforma è terminato il ${IST.scadenza.split('-').reverse().join('/')}`)
  + `: per informazioni scrivi ${IST.contatto ? 'a ' + IST.contatto : 'al referente della tua azienda'}.`;
/** [oggetto, {testo, html}] per l'assegnazione di uno o più compiti. */
export function testoAssegnazione(a, classe, compiti, titoli, indirizzo = '', docente = '') {
  const righe = [`Ciao ${a.nome},`, `${docente ? docente + ' ti ha' : 'Ti è stato'} assegnato ${compiti.length === 1 ? 'un nuovo compito' : compiti.length + ' nuovi compiti'} nella classe «${classe.nome}»:`];
  for (const k of compiti) {
    righe.push(`• ${k.titolo}: ${k.casi.length} ${k.casi.length === 1 ? 'caso' : 'casi'}${k.scadenza ? `, da completare entro il ${dataIt(k.scadenza)}` : ''}.`);
    k.casi.slice(0, 8).forEach((c) => righe.push(`   – ${titoli.get(c) || c}`));
    if (k.casi.length > 8) righe.push(`   – … e altri ${k.casi.length - 8}`);
  }
  righe.push('', 'Trovi i compiti nella pagina iniziale, sotto «Compiti assegnati».');
  const o = compiti.length === 1 ? `Nuovo compito: ${compiti[0].titolo}` : `${compiti.length} nuovi compiti`;
  return [o, corpoEmail(righe, indirizzo || '/')];
}
/** Promemoria giornaliero (pianificato): due giorni prima della scadenza, a chi non ha ancora finito. */
export async function promemoria(cfg, oggi = new Date()) {
  const M = cfg.magazzino;
  // manutenzione automatica: le iscrizioni mai confermate vengono cancellate dopo una settimana
  let cancellati = 0;
  for (const a of await M.elencoAccount()) {
    if (a.stato === 'attesa' && a.conferma?.scad && a.conferma.scad < oggi.getTime() - 86400000 * 5) { await M.eliminaAccount(a.id); cancellati++; }
  }
  // conservazione: gli account inattivi da 24 mesi vengono cancellati (avviso un mese prima); le risposte restano anonime
  const mesi = (n) => new Date(oggi.getTime() - n * 30.44 * 86400000).toISOString().slice(0, 16).replace('T', ' ');
  for (const a of istanzaDi(cfg).modo === 'azienda' ? [] : await M.elencoAccount()) {   // in un'azienda decide l'amministratore
    if (!a.pw || a.stato === 'attesa') continue;
    const ultimo = a.ultimoAccesso || a.creato || '';
    if (!ultimo) continue;
    if (ultimo < mesi(24) && a.avvisoInattivo) {
      if (M.anonimizzaRisultati) await M.anonimizzaRisultati(a.id);
      await M.eliminaAccount(a.id); cancellati++;
    } else if (ultimo < mesi(23) && !a.avvisoInattivo && cfg.inviaEmail && a.email) {
      await cfg.inviaEmail(a.email, 'Il tuo account Quiz Radiologia sta per essere cancellato', corpoEmail([`Ciao ${a.nome},`,
        'non entri in Quiz Radiologia da quasi due anni. Per non conservare dati inutilmente, tra un mese il tuo account verrà cancellato; le tue risposte resteranno solo in forma anonima.',
        'Se vuoi tenerlo, basta entrare una volta prima di allora.'], radice(cfg.indirizzo) + '/', { pulsante: 'Entra in Quiz Radiologia', piede: 'Messaggio di servizio: non è necessario rispondere.' }))
        .then(() => M.scriviAccount({ ...a, avvisoInattivo: ora16() })).catch((e) => console.error('inattivo', e?.message || e));
    }
  }
  if (!cfg.inviaEmail || !M.elencoClassi) return { inviati: 0, cancellati };
  const tra = (n) => piuGiorni(giornoItalia(oggi), n);
  const obiettivo = tra(2);
  const [classi, account, righe, casi] = await Promise.all([M.elencoClassi(), M.elencoAccount(), M.risultati(), M.elencoCasi()]);
  const acc = new Map(account.map((a) => [a.id, a])), titoli = new Map(casi.map((c) => [c.id, c.titolo || c.id]));
  let inviati = 0;
  for (const c of classi) for (const k of c.compiti || []) {
    if (k.scadenza !== obiettivo) continue;
    for (const m of c.membri || []) {
      const a = acc.get(m);
      if (!a?.email || a.attivo === false || a.avvisi === false || !segue(a, c)) continue;
      const st = statoCompito(k, righe.filter((r) => r.account === m));
      if (st.fatti >= st.totale) continue;
      const mancano = k.casi.filter((x) => !st.fatti_ids.includes(x));
      const r = [`Ciao ${a.nome},`, `il compito «${k.titolo}» (classe «${c.nome}») scade il ${dataIt(k.scadenza)}: hai svolto ${st.fatti} casi su ${st.totale}.`, 'Mancano:'];
      mancano.slice(0, 10).forEach((x) => r.push(`   – ${titoli.get(x) || x}`));
      if (mancano.length > 10) r.push(`   – … e altri ${mancano.length - 10}`);
      try { await cfg.inviaEmail(a.email, `Promemoria: «${k.titolo}» scade il ${dataIt(k.scadenza)}`, corpoEmail(r, cfg.indirizzo || '/')); inviati++; }
      catch (e) { console.error('promemoria', e?.message || e); }
    }
  }
  // il lunedì: riepilogo settimanale ai docenti
  const riepiloghi = oggi.getUTCDay() === 1 ? await riepilogoDocenti(cfg, oggi) : 0;
  return { inviati, cancellati, riepiloghi };
}
const PIEDE_DOCENTE = 'Ricevi questo messaggio perché sei docente su Quiz Radiologia. Puoi disattivare gli avvisi per email dal tuo profilo («Il mio profilo»).';
/** Riepilogo settimanale per ogni docente: attività di chi lo ha scelto negli ultimi 7 giorni e compiti in scadenza. */
/** Riepilogo mensile per un docente (o per l'amministratore, docente = null): chi è fermo da 30 giorni, i temi
 *  sbagliati più spesso nel mese (per persona e in tutto), i casi troppo facili o troppo difficili per tutti gli iscritti
 *  (primo tentativo, almeno 5 persone) con il distrattore scelto più spesso: serve anche a correggere i casi. */
export function riepilogoMensile({ account, righe, casi, classi = [], errori = [] }, docente, oggi = new Date()) {
  const da = new Date(oggi.getTime() - 30 * 86400000).toISOString().slice(0, 16).replace('T', ' ');
  const membriClassi = new Set(classi.filter((c) => !docente || c.proprietario === docente).flatMap((c) => c.membri || []));
  const studenti = account.filter((a) => a.attivo !== false && a.stato !== 'attesa' && a.ruolo !== 'admin'
    && (!docente ? a.ruolo === 'specializzando' : (a.docenti || []).includes(docente) || membriClassi.has(a.id)));
  const perId = Object.fromEntries(casi.map((c) => [c.id, c]));
  const persone = studenti.map((a) => {
    const tutte = righe.filter((r) => r.account === a.id), mese = tutte.filter((r) => String(r.data) >= da);
    const ultima = tutte.map((r) => String(r.data)).sort().pop() || '';
    const temi = analisiTemi(mese, perId).filter((t) => t.errori >= 3 && t.perc >= 40).sort((x, y) => y.errori - x.errori).slice(0, 3)
      .map((t) => ({ nome: t.nome, zona: t.zona, errori: t.errori, prove: t.prove, perc: t.perc }));
    return { id: a.id, nome: a.nome, categoria: CATEGORIE[a.categoria] || '', risposte: mese.length, casi: new Set(mese.map((r) => r.caso)).size,
      media: mese.length ? Math.round(mese.reduce((t, r) => t + (Number(r.punteggio) || 0), 0) / mese.length) : null, ultima, fermo: !mese.length, temi,
      errore: riassuntoErrori(errori.filter((e) => e.account === a.id && String(e.data) >= da)) };
  }).sort((x, y) => x.nome.localeCompare(y.nome, 'it'));
  const ids = new Set(studenti.map((a) => a.id));
  const temiGruppo = analisiTemi(righe.filter((r) => ids.has(r.account) && String(r.data) >= da), perId).filter((t) => t.errori >= 3)
    .sort((x, y) => y.errori - x.errori).slice(0, 8).map((t) => ({ nome: t.nome, zona: t.zona, errori: t.errori, prove: t.prove, perc: t.perc, casi: t.casi.slice(0, 5) }));
  // taratura dei casi: primo tentativo di ogni persona, su tutti gli iscritti
  const primi = {}; for (const r of [...righe].sort((x, y) => String(x.data).localeCompare(String(y.data)))) { const k = `${r.account}|${r.caso}`; if (!primi[k]) primi[k] = r; }
  const per = {}; for (const r of Object.values(primi)) (per[r.caso] ||= []).push(r);
  const taratura = Object.entries(per).filter(([id, l]) => l.length >= 5 && perId[id] && visibile(perId[id])).map(([id, l]) => {
    const media = Math.round(l.reduce((t, r) => t + (Number(r.punteggio) || 0), 0) / l.length);
    const dist = {}; for (const r of l) for (const o of r.opzioni || []) if (o.tipo === 'distrattore' && o.s) dist[o.t] = (dist[o.t] || 0) + 1;
    const peggiore = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    return { id, titolo: perId[id].titolo || id, difficolta: perId[id].difficolta || '', n: l.length, media, ...(peggiore ? { distrattore: peggiore[0], scelto: peggiore[1] } : {}) };
  });
  const errGruppo = riassuntoErrori(errori.filter((e) => ids.has(e.account) && String(e.data) >= da));
  return { dal: da.slice(0, 10), al: oggi.toISOString().slice(0, 10), persone, errore: errGruppo, fermi: persone.filter((p) => p.fermo).map((p) => ({ nome: p.nome, ultima: p.ultima })),
    temi: temiGruppo, facili: taratura.filter((t) => t.media >= 90).sort((a, b) => b.media - a.media).slice(0, 10),
    difficili: taratura.filter((t) => t.media <= 35).sort((a, b) => a.media - b.media).slice(0, 10) };
}
// «Cerca l'errore»: quanti esercizi, media, frasi sbagliate trovate e corrette, reperti mancanti riconosciuti
export function riassuntoErrori(l) {
  if (!l.length) return null;
  const sb = l.filter((e) => e.tipo === 'sbagliata'), ma = l.filter((e) => e.tipo === 'manca');
  return { n: l.length, media: Math.round(l.reduce((t, e) => t + (Number(e.punti) || 0), 0) / l.length),
    trovate: sb.filter((e) => e.trovata).length, sbagliate: sb.length, corrette: sb.filter((e) => e.corretta).length,
    mancanti: ma.filter((e) => e.corretta).length, manca: ma.length, ultima: l.map((e) => String(e.data)).sort().pop() };
}
export async function riepilogoDocenti(cfg, oggi = new Date()) {
  const M = cfg.magazzino;
  if (!cfg.inviaEmail) return 0;
  const [account, righe, classi] = await Promise.all([M.elencoAccount(), M.risultati(), M.elencoClassi ? M.elencoClassi() : []]);
  const da = new Date(oggi.getTime() - 7 * 86400000).toISOString().slice(0, 16).replace('T', ' ');
  const oggiIso = giornoItalia(oggi), fra7 = piuGiorni(oggiIso, 7);
  let n = 0;
  for (const d of account.filter((a) => eDocente(a) && a.email && a.avvisi !== false)) {
    const miei = account.filter((a) => a.attivo !== false && a.stato !== 'attesa' && (a.docenti || []).includes(d.id));
    if (!miei.length) continue;
    const r = [`Ciao ${d.nome},`, `ecco la settimana di chi ti ha scelto come docente (${miei.length} ${miei.length === 1 ? 'studente' : 'studenti'}):`];
    const fermi = [];
    for (const a of miei.sort((x, y) => x.nome.localeCompare(y.nome, 'it'))) {
      const sett = righe.filter((x) => x.account === a.id && String(x.data) >= da);
      if (!sett.length) { fermi.push(a.nome); continue; }
      const casi = new Set(sett.map((x) => x.caso)).size, media = Math.round(sett.reduce((t, x) => t + (Number(x.punteggio) || 0), 0) / sett.length);
      r.push(`• ${a.nome}: ${casi} ${casi === 1 ? 'caso' : 'casi'}, punteggio medio ${media}%.`);
    }
    if (fermi.length) r.push(`• Nessun caso questa settimana: ${fermi.join(', ')}.`);
    const scad = [];
    for (const c of classi.filter((c) => c.proprietario === d.id)) for (const k of c.compiti || []) {
      if (!k.scadenza || k.scadenza < oggiIso || k.scadenza > fra7) continue;
      const membri = (c.membri || []).filter((m) => miei.some((a) => a.id === m));
      const finiti = membri.filter((m) => { const st = statoCompito(k, righe.filter((x) => x.account === m)); return st.fatti >= st.totale; }).length;
      scad.push(`• «${k.titolo}» (${c.nome}) scade il ${dataIt(k.scadenza)}: completato da ${finiti} su ${membri.length}.`);
    }
    if (scad.length) r.push('', 'Compiti in scadenza nei prossimi 7 giorni:', ...scad);
    if (oggi.getUTCDate() <= 7 && M.elencoCasi) {          // primo lunedì del mese: anche il riepilogo mensile
      const m = riepilogoMensile({ account, righe, casi: await M.elencoCasi(), classi, errori: M.elencoErrori ? await M.elencoErrori().catch(() => []) : [] }, d.id, oggi);
      r.push('', 'Il mese in breve:');
      if (m.fermi.length) r.push(`• Fermi da 30 giorni: ${m.fermi.map((f) => f.nome).join(', ')}.`);
      for (const t of m.temi.slice(0, 3)) r.push(`• Tema sbagliato spesso: ${t.nome} (${t.zona}), ${t.errori} errori su ${t.prove}.`);
      if (m.difficili.length) r.push(`• Casi molto difficili per tutti: ${m.difficili.slice(0, 3).map((c) => `${c.titolo} (${c.media}%)`).join('; ')}.`);
      r.push('Il dettaglio è in Analisi → «Mensile».');
    }
    try {
      await cfg.inviaEmail(d.email, 'Quiz Radiologia: la settimana dei tuoi studenti',
        corpoEmail(r, radice(cfg.indirizzo) + '/#/analisi/persone', { pulsante: 'Apri i tuoi studenti', piede: PIEDE_DOCENTE }));
      n++;
    } catch (e) { console.error('riepilogo', e?.message || e); }
  }
  return n;
}
// un iscritto «segue» una classe se ha ancora tra i suoi docenti chi l'ha creata (le classi vecchie non hanno proprietario)
const segue = (a, c) => !c.proprietario || (Array.isArray(a?.docenti) && a.docenti.includes(c.proprietario));
const eDocente = (a) => a && a.attivo !== false && a.stato !== 'attesa' && (a.ruolo === 'docente' || a.ruolo === 'referente');
// dati dell'utente per l'interfaccia: ruolo, nome, profilo e permessi
async function profiloDi(a, M) {
  const tutti = a.id === 'admin' ? [] : await M.elencoAccount();
  const docenti = (a.docenti || []).map((d) => tutti.find((x) => x.id === d)).filter(eDocente).map((x) => ({ id: x.id, nome: x.nome }));
  return { id: a.id, ruolo: a.ruolo === 'referente' ? 'docente' : a.ruolo, nome: a.nome, autore: a.ruolo === 'admin' || (a.ruolo === 'docente' && !!a.autore),
    email: a.email || '', categoria: a.categoria || '', sede: a.sede || '', anno: a.anno || '', docenti, avvisi: a.avvisi !== false,
    noDocente: !!a.noDocente, conPassword: !!a.pw, profilo: profiloDidattico(a.categoria),
    seguaci: a.ruolo === 'docente' ? tutti.filter((x) => (x.docenti || []).includes(a.id) && x.attivo !== false).length : 0 };
}
// dati del profilo inviati dall'utente (iscrizione o modifica)
function datiProfilo(d, prima = {}) {
  const out = {};
  if (typeof d.nome === 'string') out.nome = pulisciTesto(d.nome, 80);
  if (typeof d.categoria === 'string') out.categoria = CATEGORIE[d.categoria] ? d.categoria : prima.categoria || 'altro';
  if (typeof d.sede === 'string') out.sede = pulisciTesto(d.sede, 120);
  if (d.anno !== undefined) out.anno = /^[1-6]$/.test(String(d.anno)) ? String(d.anno) : '';
  if (typeof d.avvisi === 'boolean') out.avvisi = d.avvisi;
  return out;
}
export async function gestisci(req, cfg) {
  const json = (stato, obj, extra = {}) => ({ stato, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }, corpo: JSON.stringify(obj) });
  const { metodo } = req;
  const parti = req.percorso.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parti[0] !== 'api') return json(404, { errore: 'non trovato' });
  let dati = {};
  if (metodo === 'POST' && req.corpo) {
    try { dati = JSON.parse(req.corpo); } catch { return json(400, { errore: 'JSON non valido' }); }
    // 1.259 (trovato con api-fuzz.test.mjs): JSON valido ma non un oggetto («null», un numero, un elenco) → come un corpo vuoto
    if (!dati || typeof dati !== 'object' || Array.isArray(dati)) dati = {};
  }
  const M = cfg.magazzino;
  const opzCookie = `Path=/; HttpOnly; SameSite=Lax${cfg.sicuro === false ? '' : '; Secure'}`;
  const IST = istanzaDi(cfg), AZIENDA = IST.modo === 'azienda';
  // tipo di istanza, pubblico: la pagina si adatta prima dell'accesso (iscrizione, nome dell'azienda)
  if (parti[1] === 'istanza' && metodo === 'GET') return json(200, IST, { 'cache-control': 'public, max-age=300' });
  // esito del lavoro di creazione di una piattaforma (AWS CodeBuild, crea-tenant.sh): senza sessione, autorizzato dal
  // gettone monouso consegnato all'avvio (se ne conserva solo l'impronta, scade dopo 3 ore)
  if (parti[1] === 'tenant' && parti[3] === 'esito' && metodo === 'POST' && !AZIENDA && M.leggiAzienda) {
    const tid = parti[2] || '';
    if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(tid)) return json(404, { errore: 'identificativo non valido' });
    const prima = await M.leggiAzienda(tid), lav = prima?.lavoro || {};
    const a = Buffer.from(improntaGettone(String(dati.token || ''))), b = Buffer.from(String(lav.token || ''));
    if (prima?.tipo !== 'tenant' || !lav.token || !(lav.scade > Date.now()) || a.length !== b.length || !timingSafeEqual(a, b)) return json(403, { errore: 'gettone non valido' });
    const st = ['attiva', 'sospesa', 'errore', 'smontata'].includes(dati.stato) ? dati.stato : 'errore';
    const tn = { ...prima, stato: st, aggiornato: ora16(), lavoro: { ...lav, token: '', fine: ora16(), esito: st }, registro: String(dati.log || '').slice(-6000) };
    if (st === 'attiva' || st === 'sospesa') Object.assign(tn, { pubblicato: ora16(), errore: '', versione: pulisciTesto(dati.versione || '', 20), creata: true, sospesaApplicata: st === 'sospesa' });
    if (st === 'errore') tn.errore = pulisciTesto(dati.errore || 'pubblicazione non riuscita', 300);
    if (st === 'smontata') tn.creata = false;
    if (dati.invitato) tn.invitato = ora16();
    await M.scriviAzienda(tn);
    if (cfg.inviaEmail && cfg.avvisiA) {
      const cosa = { crea: 'creazione', aggiorna: 'aggiornamento', sospendi: 'sospensione', smonta: 'smontaggio' }[lav.azione] || 'lavoro';
      const ok = st !== 'errore';
      try { await cfg.inviaEmail(cfg.avvisiA, `${ok ? '✓' : '⚠'} ${prima.cliente}: ${cosa} ${ok ? 'completato' : 'non riuscito'}`, corpoEmail([
        `Piattaforma «${prima.cliente}» (https://${prima.dominio}): ${cosa} ${ok ? 'completato' : 'NON riuscito'}.`,
        ok ? (dati.invitato ? `Invito inviato al referente (${prima.referenteEmail}).` : 'Stato aggiornato in Gestione → Clienti e piattaforme.') : `Motivo: ${tn.errore}. Il registro è nella scheda del cliente.`],
        radice(cfg.indirizzo) + '/#/tenant', { pulsante: 'Apri Clienti e piattaforme' })); } catch (e) { console.error('avviso esito', e?.message || e); }
    }
    return json(200, { ok: true });
  }

  // traffico: solo contatori per giorno (pagina, accessi, persone attive), senza identificativi; mai bloccanti
  const conta = (voce) => (M.contaVisita ? Promise.resolve(M.contaVisita(ora16().slice(0, 10), voce)).catch(() => {}) : null);
  const entra = async (chi) => {
    if (IST.blocco && chi.ruolo !== 'admin') return json(403, { errore: messaggioBlocco(IST), blocco: IST.blocco });
    if (chi.id !== 'admin') {
      await Promise.all([conta('_login'), String(chi.ultimoAccesso || '').slice(0, 10) !== ora16().slice(0, 10) ? conta('_utenti') : null]);
      await M.scriviAccount({ ...chi, ultimoAccesso: ora16(), errori: 0, bloccatoFino: 0, avvisoInattivo: '' });
    }
    return json(200, await profiloDi(chi, M),
      { 'set-cookie': `quiz=${creaGettone(cfg.segreto, chi.ruolo, chi.id)}; Max-Age=${DURATA}; ${opzCookie}` });
  };
  const perEmail = async (email) => (email ? (await M.elencoAccount()).find((a) => a.email === email) : null);
  const scaduti = (a) => a.stato === 'attesa' && a.conferma?.scad && a.conferma.scad < Date.now() - 86400000 * 5;

  // ---------------- accesso: email e password, oppure codice personale (amministratori e vecchi account)
  if (parti[1] === 'accesso' && metodo === 'POST') {
    const email = pulisciEmail(dati.email);
    if (email) {
      const a = await perEmail(email);
      if (a && a.bloccatoFino > Date.now()) return json(429, { errore: 'Troppi tentativi sbagliati: riprova tra qualche minuto o scegli una nuova password.' });
      const ok = a && a.pw && verificaPassword(dati.password, a.pw);
      if (!ok) {
        if (a) { const errori = (a.errori || 0) + 1; await M.scriviAccount({ ...a, errori, bloccatoFino: errori >= 5 ? Date.now() + 15 * 60000 : 0 }); }
        await ritardo(400); return json(401, { errore: 'Email o password non corretti.' });
      }
      if (a.stato === 'attesa') return json(403, { errore: 'Devi ancora confermare l\'indirizzo email: apri il link che ti abbiamo inviato.', daConfermare: true });
      if (a.attivo === false) return json(403, { errore: 'Account disattivato: scrivi all\'amministratore della piattaforma.' });
      return entra(a);
    }
    const h = impronta(dati.codice);
    let chi = null;
    if (normalizza(dati.codice) && cfg.hashAdmin && uguali(h, cfg.hashAdmin)) chi = { id: 'admin', nome: 'Amministratore', ruolo: 'admin' };
    else if (normalizza(dati.codice)) {
      for (const a of await M.elencoAccount()) if (a.attivo !== false && a.hash && uguali(h, a.hash)) chi = a;
    }
    if (!chi) { await ritardo(400); return json(401, { errore: 'Codice non valido' }); }
    return entra(chi);
  }
  if (parti[1] === 'esci') return json(200, { ok: true }, { 'set-cookie': `quiz=; Max-Age=0; ${opzCookie}` });

  // pagina vista (anche prima dell'accesso): solo il nome della pagina, e per i casi l'identificativo del caso
  if (parti[1] === 'visita' && metodo === 'POST') {
    const p = String(dati.p || ''), c = String(dati.c || '');
    const voci = PAGINE_TRAFFICO.has(p) ? [p] : [];
    if (p === 'caso' && /^caso-[a-z0-9-]{1,40}$/i.test(c)) voci.push('caso:' + c);
    if (dati.s) voci.push('_sessioni', dati.m ? '_mobile' : '_desktop');
    await Promise.all(voci.map(conta));
    return json(200, { ok: true });
  }

  // sponsor: tolti l'11/10/2026, riattivati il 5/11/2026 solo per la vetrina
  // ---------------- sponsor: elenco pubblico (anche senza accesso), visualizzazioni e clic contati in forma aggregata
  // 21/11/2026, decisione dell'utente: sponsor spenti anche nella vetrina (portale open source a scopo educativo); si
  // riaccendono con SPONSOR="1" in .segreti. Spenti: elenco pubblico vuoto, quindi nessun riquadro nelle pagine; la
  // gestione dell'amministratore resta, con i dati, per poterli riattivare
  if (parti[1] === 'sponsor' && (AZIENDA || cfg?.istanza?.sponsor === false)) return metodo === 'GET' && !parti[2] ? json(200, []) : json(404, { errore: 'non disponibile' });
  if (parti[1] === 'sponsor' && M.elencoSponsor && (!parti[2] || parti[3] === 'vai' || parti[2] === 'viste')) {
    const oggi = new Date().toISOString().slice(0, 10);
    if (!parti[2] && metodo === 'GET') {
      const l = (await M.elencoSponsor()).filter((x) => sponsorAttivo(x, oggi) && x.logo)
        .map(({ id, nome, link, testo, logo, posizioni }) => ({ id, nome, link: !!link, testo, logo, posizioni }));
      return json(200, l, { 'cache-control': 'public, max-age=300' });
    }
    if (parti[2] === 'viste' && metodo === 'POST') {                // { ids: [...] } dal browser, una volta per pagina
      const validi = new Set((await M.elencoSponsor()).map((x) => x.id));
      for (const id of [...new Set(Array.isArray(dati.ids) ? dati.ids : [])].filter((x) => validi.has(x)).slice(0, 10)) await M.contaSponsor(id, oggi, 'viste');
      return json(200, { ok: true });
    }
    if (parti[3] === 'vai' && metodo === 'GET') {                   // clic: conta e manda al sito dello sponsor
      const x = ID_OK.test(parti[2] || '') ? (await M.elencoSponsor()).find((y) => y.id === parti[2]) : null;
      if (!x?.link) return json(404, { errore: 'sponsor non trovato' });
      await M.contaSponsor(x.id, oggi, 'clic');
      return { stato: 302, headers: { location: x.link, 'cache-control': 'no-store' }, corpo: '' };
    }
  }

  // ---------------- iscrizione libera, con conferma dell'indirizzo email
  if (parti[1] === 'iscrizione' && metodo === 'POST') {
    if (AZIENDA) return json(403, { errore: `L'accesso è solo su invito: chiedi un account all'amministratore${IST.nome ? ' di ' + IST.nome : ''}.` });
    if (dati.sito) return json(200, { ok: true });                 // campo nascosto: lo compilano solo i programmi automatici
    if (!cfg.inviaEmail) return json(503, { errore: 'Le iscrizioni non sono ancora attive (manca l\'invio delle email).' });
    const email = pulisciEmail(dati.email), p = datiProfilo(dati);
    if (!p.nome || p.nome.length < 3) return json(400, { errore: 'Scrivi nome e cognome.' });
    if (!email) return json(400, { errore: 'Indirizzo email non valido.' });
    if (!passwordValida(dati.password)) return json(400, { errore: 'La password deve avere almeno 10 caratteri, con lettere e almeno un numero o simbolo.' });
    if (dati.privacy !== true) return json(400, { errore: 'Per iscriverti devi accettare le condizioni d\'uso e leggere l\'informativa sul trattamento dei dati.' });
    if (dati.maggiorenne !== true) return json(400, { errore: 'Per iscriverti devi avere almeno 18 anni.' });
    const prima = await perEmail(email);
    const risposta = { ok: true, messaggio: `Ti abbiamo inviato un'email a ${email}: apri il link per attivare l'account.` };
    if (prima && prima.stato !== 'attesa') {
      // indirizzo già iscritto: non lo diciamo a chi compila il modulo, ma avvisiamo il titolare
      await cfg.inviaEmail(email, 'Hai già un account su Quiz Radiologia', corpoEmail([`Ciao ${prima.nome},`,
        'qualcuno (forse tu) ha provato a iscriversi con questo indirizzo, che ha già un account. Se hai dimenticato la password, scegline una nuova dalla pagina di accesso.'],
        radice(cfg.indirizzo) + '/', { pulsante: 'Vai alla pagina di accesso', piede: 'Se non sei stato tu, ignora questo messaggio.' })).catch((e) => console.error('email', e?.message || e));
      return json(200, risposta);
    }
    if (prima && prima.ultimoInvio > Date.now() - 2 * 60000) return json(429, { errore: 'Ti abbiamo appena inviato l\'email: controlla anche nella posta indesiderata e riprova tra qualche minuto.' });
    const { t, salvato } = nuovoGettone(48);
    const acc = { ...(prima || {}), id: prima?.id || randomBytes(6).toString('hex'), ...p, categoria: p.categoria || 'altro', email,
      ruolo: dati.docente === true ? 'docente' : 'specializzando', pw: improntaPassword(dati.password), hash: '', attivo: true, stato: 'attesa', creato: prima?.creato || ora16(),
      conferma: salvato, ultimoInvio: Date.now(), avvisi: true, docenti: [], privacy: ora16(), condizioni: ora16() };
    await M.scriviAccount(acc);
    try { await cfg.inviaEmail(email, ...testoConferma(acc.nome, cfg.indirizzo, `${acc.id}.${t}`)); }
    catch (e) { console.error('email', e?.message || e); return json(502, { errore: 'Non siamo riusciti a inviare l\'email di conferma: riprova più tardi.' }); }
    return json(200, risposta);
  }
  // nuovo invio dell'email di conferma (dalla pagina di accesso)
  if (parti[1] === 'conferma' && parti[2] === 'invia' && metodo === 'POST') {
    const a = await perEmail(pulisciEmail(dati.email));
    if (a && a.stato === 'attesa' && cfg.inviaEmail && !(a.ultimoInvio > Date.now() - 2 * 60000)) {
      const { t, salvato } = nuovoGettone(48);
      await M.scriviAccount({ ...a, conferma: salvato, ultimoInvio: Date.now() });
      await cfg.inviaEmail(a.email, ...testoConferma(a.nome, cfg.indirizzo, `${a.id}.${t}`)).catch((e) => console.error('email', e?.message || e));
    }
    return json(200, { ok: true });
  }
  // conferma dell'indirizzo: attiva l'account ed entra
  if (parti[1] === 'conferma' && metodo === 'POST') {
    const [id, t] = String(dati.codice || '').split('.');
    const a = ID_OK.test(id || '') ? await M.leggiAccount(id) : null;
    if (a && a.stato !== 'attesa' && a.pw) return json(200, { giaAttivo: true });
    if (!a || !gettoneValido(a.conferma, t)) { await ritardo(300); return json(400, { errore: 'Link non valido o scaduto: iscriviti di nuovo o chiedi un nuovo invio dalla pagina di accesso.' }); }
    return entra({ ...a, stato: '', conferma: null });
  }
  // password dimenticata: email con un link valido un'ora (la risposta è la stessa se l'indirizzo non esiste)
  if (parti[1] === 'password' && parti[2] === 'dimenticata' && metodo === 'POST') {
    const a = await perEmail(pulisciEmail(dati.email));
    if (a && a.attivo !== false && a.stato !== 'attesa' && cfg.inviaEmail && !(a.reset?.inviato > Date.now() - 2 * 60000)) {
      const { t, salvato } = nuovoGettone(1);
      await M.scriviAccount({ ...a, reset: { ...salvato, inviato: Date.now() } });
      await cfg.inviaEmail(a.email, ...testoNuovaPassword(a.nome, cfg.indirizzo, `${a.id}.${t}`)).catch((e) => console.error('email', e?.message || e));
    }
    await ritardo(300);
    return json(200, { ok: true, messaggio: 'Se l\'indirizzo è iscritto, riceverai un\'email con il link per scegliere la nuova password.' });
  }
  if (parti[1] === 'password' && parti[2] === 'nuova' && metodo === 'POST') {
    const [id, t] = String(dati.codice || '').split('.');
    const a = ID_OK.test(id || '') ? await M.leggiAccount(id) : null;
    if (!a || !gettoneValido(a.reset, t)) { await ritardo(300); return json(400, { errore: 'Link non valido o scaduto: chiedine uno nuovo dalla pagina di accesso.' }); }
    if (!passwordValida(dati.password)) return json(400, { errore: 'La password deve avere almeno 10 caratteri, con lettere e almeno un numero o simbolo.' });
    if (a.attivo === false) return json(403, { errore: 'Account disattivato.' });
    return entra({ ...a, pw: improntaPassword(dati.password), reset: null, sessioneDa: Date.now() });   // chiude le altre sessioni
  }

  // ---------------- da qui serve un gettone valido, di un account ancora attivo
  const g = leggiGettone(cfg.segreto, cookie(req.headers));
  if (!g) return json(401, { errore: 'accesso richiesto' });
  let io;
  if (g.id === 'admin') io = g.ruolo === 'admin' ? { id: 'admin', nome: 'Amministratore', ruolo: 'admin' } : null;
  else {
    const a = await M.leggiAccount(g.id);
    // dopo un cambio o un recupero di password valgono solo i gettoni emessi da allora (la scadenza dice quando è stato emesso)
    const emesso = (g.scad || 0) - DURATA;
    io = a && a.attivo !== false && a.stato !== 'attesa' && a.ruolo === g.ruolo && !(a.sessioneDa && emesso * 1000 < a.sessioneDa - 2000) ? a : null;
  }
  if (!io) return json(401, { errore: 'account non più attivo' });
  // ultimo utilizzo (per la cancellazione degli account inattivi): aggiornato al più una volta al giorno
  if (io.id !== 'admin' && String(io.ultimoAccesso || '').slice(0, 10) !== ora16().slice(0, 10)) {
    io = { ...io, ultimoAccesso: ora16(), avvisoInattivo: '' }; await Promise.all([M.scriviAccount(io), conta('_utenti')]);
  }
  const admin = io.ruolo === 'admin';
  if (IST.blocco && !admin) return json(403, { errore: messaggioBlocco(IST), blocco: IST.blocco });
  const docente = admin || io.ruolo === 'docente' || io.ruolo === 'referente';   // classi, compiti, analisi
  const autore = admin || (io.ruolo === 'docente' && !!io.autore);              // casi comuni
  // ambito: l'amministratore vede tutti; il docente chi lo ha scelto come riferimento (e sé stesso)
  const nelMioAmbito = (a) => admin || a?.id === io.id || (Array.isArray(a?.docenti) && a.docenti.includes(io.id));
  const accountAmbito = async () => (await M.elencoAccount()).filter((a) => a.stato !== 'attesa' && nelMioAmbito(a));
  const risultatiAmbito = async () => {
    const righe = await M.risultati();
    if (admin) return righe;
    const ids = new Set((await accountAmbito()).map((a) => a.id));
    return righe.filter((r) => ids.has(r.account));
  };
  const classeMia = (c) => admin || c.proprietario === io.id;

  if (parti[1] === 'io' && parti[2] === 'progressi') {
    const righe = await M.risultati();
    const { ultimi, ...p } = progressi(righe, io.id);
    // logbook: tutti i tentativi, in ordine di data
    p.storico = righe.filter((r) => r.account === io.id).sort((a, b) => String(a.data).localeCompare(String(b.data)))
      .map((r) => ({ caso: r.caso, data: r.data, punteggio: r.punteggio, perfetta: !!r.perfetta, tentativo: r.tentativo || null,
        ...(r.dettagli?.revisione ? { revisione: r.dettagli.revisione } : {}) }));
    p.nome = io.nome;
    return json(200, p);
  }
  // punti deboli per tema e tipo di esame (5): dalle risposte salvate; con i casi visibili non ancora risolti che li allenano
  if (parti[1] === 'io' && parti[2] === 'temi' && metodo === 'GET') {
    const [righe, casi] = await Promise.all([M.risultati(), M.elencoCasi()]);
    const mie = righe.filter((r) => r.account === io.id), perId = Object.fromEntries(casi.map((c) => [c.id, c]));
    const migliore = {}; for (const r of mie) migliore[r.caso] = Math.max(migliore[r.caso] ?? 0, Number(r.punteggio) || 0);
    const visibili = casi.filter((c) => visibile(c));
    const temi = analisiTemi(mie, perId).filter((t) => t.prove >= 3 && t.errori >= 2 && t.perc >= 30)
      .sort((a, b) => b.perc - a.perc || b.errori - a.errori).slice(0, 6)
      .map((t) => ({ ...t, proposti: casiPerTema(visibili, t.tema, t.zona).filter((id) => (migliore[id] ?? -1) < 90).sort((a, b) => (migliore[a] ?? -1) - (migliore[b] ?? -1)).slice(0, 6) }));
    return json(200, { risposte: mie.length, temi });
  }
  // statistiche personali: errori ricorrenti per esame e per tipo di reperto, andamento e ripasso mirato
  if (parti[1] === 'io' && parti[2] === 'statistiche' && metodo === 'GET') {
    const [righe, casi] = await Promise.all([M.risultati(), M.elencoCasi()]);
    const mie = righe.filter((r) => r.account === io.id), perId = Object.fromEntries(casi.map((c) => [c.id, c]));
    return json(200, statisticheStudente(mie, perId, casi.filter((c) => visibile(c))));
  }
  // confronto anonimo con i colleghi per metodica (percentile, sensibilità, specificità)
  if (parti[1] === 'io' && parti[2] === 'confronto' && metodo === 'GET') {
    const [righe, casi] = await Promise.all([M.risultati(), M.elencoCasi()]);
    return json(200, { aree: confrontoColleghi(letturaPerArea(righe, Object.fromEntries(casi.map((c) => [c.id, c]))), io.id) });
  }
  // storico personale di «cerca l'errore»
  if (parti[1] === 'io' && parti[2] === 'errori' && metodo === 'GET') {
    const mie = M.elencoErrori ? (await M.elencoErrori()).filter((e) => e.account === io.id).sort((x, y) => String(x.data).localeCompare(String(y.data))) : [];
    return json(200, { ...(riassuntoErrori(mie) || { n: 0, media: 0 }), ultimi: mie.slice(-20).map(({ caso, tipo, punti, data }) => ({ caso, tipo, punti, data })) });
  }
  // il proprio profilo: nome, categoria, sede, anno, avvisi per email e docenti di riferimento (scelti da sé)
  if (parti[1] === 'io' && metodo === 'POST' && (parti[2] === 'profilo' || parti[2] === 'email')) {
    if (admin) return json(400, { errore: 'non disponibile per l\'amministratore' });
    const p = datiProfilo(dati, io);
    if ('nome' in p && p.nome.length < 3) return json(400, { errore: 'Scrivi nome e cognome.' });
    const nuovo = { ...io, ...p };
    if (parti[2] === 'email' && !io.pw) {                         // vecchi account con codice: email solo per gli avvisi
      const email = pulisciEmail(dati.email);
      if (dati.email && !email) return json(400, { errore: 'indirizzo email non valido' });
      if (email && (await perEmail(email))?.id && (await perEmail(email)).id !== io.id) return json(400, { errore: 'indirizzo già usato da un altro account' });
      nuovo.email = email;
    }
    let nuoviDocenti = [];
    if (Array.isArray(dati.docenti)) {
      const tutti = new Map((await M.elencoAccount()).map((a) => [a.id, a]));
      nuovo.docenti = [...new Set(dati.docenti)].filter((d) => d !== io.id && eDocente(tutti.get(d))).slice(0, 10);
      nuoviDocenti = nuovo.docenti.filter((d) => !(io.docenti || []).includes(d)).map((d) => tutti.get(d));
    }
    let gettone = {};
    if (typeof dati.docente === 'boolean' && io.ruolo !== 'referente' && (dati.docente ? 'docente' : 'specializzando') !== io.ruolo) {
      if (AZIENDA) return json(403, { errore: 'Il ruolo lo assegna l\'amministratore della piattaforma.' });
      if (dati.docente && io.noDocente) return json(403, { errore: 'L\'amministratore ha disattivato la funzione docente per questo account.' });
      nuovo.ruolo = dati.docente ? 'docente' : 'specializzando';
      if (!dati.docente) nuovo.autore = false;
      // il ruolo è nel gettone: con il ruolo nuovo serve un gettone nuovo
      if (nuovo.ruolo !== io.ruolo) gettone = { 'set-cookie': `quiz=${creaGettone(cfg.segreto, nuovo.ruolo, io.id)}; Max-Age=${DURATA}; ${opzCookie}` };
    }
    await M.scriviAccount(nuovo);
    // il docente scelto riceve un avviso (se ha gli avvisi attivi)
    for (const d of nuoviDocenti) {
      if (!cfg.inviaEmail || !d?.email || d.avvisi === false) continue;
      const chi = [CATEGORIE[nuovo.categoria], nuovo.anno ? `${nuovo.anno}° anno` : '', nuovo.sede].filter(Boolean).join(', ');
      await cfg.inviaEmail(d.email, `${nuovo.nome} ti ha scelto come docente`, corpoEmail([`Ciao ${d.nome},`,
        `${nuovo.nome}${chi ? ` (${chi})` : ''} ti ha scelto come docente di riferimento su Quiz Radiologia.`,
        'Da ora vedi i suoi risultati e puoi assegnargli dei casi: lo trovi in Gestione → I miei studenti e in Classi e compiti.'],
      radice(cfg.indirizzo) + '/#/analisi/persone', { pulsante: 'Apri i tuoi studenti', piede: PIEDE_DOCENTE })).catch((e) => console.error('email', e?.message || e));
    }
    return json(200, await profiloDi(nuovo, M), gettone);
  }
  if (parti[1] === 'io' && metodo === 'POST' && parti[2] === 'password') {
    if (admin) return json(400, { errore: 'non disponibile per l\'amministratore' });
    if (io.pw && !verificaPassword(dati.attuale, io.pw)) { await ritardo(400); return json(400, { errore: 'La password attuale non è corretta.' }); }
    if (!passwordValida(dati.password)) return json(400, { errore: 'La password deve avere almeno 10 caratteri, con lettere e almeno un numero o simbolo.' });
    if (!io.pw && !io.email) return json(400, { errore: 'Prima indica la tua email: servirà per entrare con la password.' });
    // la password nuova chiude le altre sessioni aperte; questa riceve un gettone nuovo
    await M.scriviAccount({ ...io, pw: improntaPassword(dati.password), sessioneDa: Date.now() });
    return json(200, { ok: true }, { 'set-cookie': `quiz=${creaGettone(cfg.segreto, io.ruolo, io.id, Math.floor(Date.now() / 1000) + 2)}; Max-Age=${DURATA}; ${opzCookie}` });
  }
  // cancellazione del proprio account: i risultati restano per le statistiche, senza nome
  if (parti[1] === 'io' && metodo === 'POST' && parti[2] === 'elimina') {
    if (admin) return json(400, { errore: 'non disponibile per l\'amministratore' });
    if (io.pw && !verificaPassword(dati.password, io.pw)) { await ritardo(400); return json(400, { errore: 'Password non corretta.' }); }
    if (M.anonimizzaRisultati) await M.anonimizzaRisultati(io.id);
    await M.eliminaAccount(io.id);
    return json(200, { ok: true }, { 'set-cookie': `quiz=; Max-Age=0; ${opzCookie}` });
  }
  // i propri dati in un file (diritto di accesso e portabilità): profilo, docenti scelti, risposte, classi
  if (parti[1] === 'io' && parti[2] === 'dati' && metodo === 'GET') {
    const { pw, hash, conferma, reset, errori, bloccatoFino, sessioneDa, ...profilo } = io;
    const righe = (await M.risultati()).filter((r) => r.account === io.id);
    const classi = M.elencoClassi ? (await M.elencoClassi()).filter((c) => (c.membri || []).includes(io.id)).map((c) => ({ nome: c.nome, compiti: c.compiti })) : [];
    const doc = { esportato: new Date().toISOString(), titolare: 'Quiz Radiologia — privacy@radio-quiz.it', profilo, classi, risposte: righe };
    return { stato: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="i-miei-dati-quiz-radiologia.json"', 'cache-control': 'no-store' },
      corpo: JSON.stringify(doc, null, 2) };
  }
  if (parti[1] === 'io') return json(200, await profiloDi(io, M));

  // impostazioni generali del servizio (per ora: segmentazione con IA attiva o no), decise dall'amministratore
  if (parti[1] === 'impostazioni') {
    const imp = (M.leggiImpostazioni ? await M.leggiImpostazioni().catch(() => null) : null) || {};
    const pubbliche = (x) => ({ ia: x.ia !== false, refertoLocale: x.refertoLocale === true });
    if (metodo === 'GET') return json(200, pubbliche(imp));
    if (metodo === 'POST') {
      if (!admin) return json(403, { errore: 'solo amministratori' });
      if (!M.scriviImpostazioni) return json(501, { errore: 'non disponibile' });
      const nuovo = { ...imp, aggiornato: ora16() };
      if (typeof dati?.ia === 'boolean') nuovo.ia = dati.ia;
      if (typeof dati?.refertoLocale === 'boolean') nuovo.refertoLocale = dati.refertoLocale;
      await M.scriviImpostazioni(nuovo);
      return json(200, pubbliche(nuovo));
    }
  }

  // ---------------- statistiche d'uso aggregate (amministratore), per esempio per i resoconti all'azienda: solo conteggi,
  // nessun nome, email o identificativo; le categorie con meno di 3 persone sono accorpate in «altre».
  // traffico (amministratore): pagine viste, accessi e persone attive per giorno, più i consumi AWS (CloudFront, Lambda, spazio)
  if (parti[1] === 'statistiche' && parti[2] === 'traffico' && (parti.length === 3 || (parti.length === 4 && /^\d+$/.test(parti[3]))) && metodo === 'GET') {   // 1.261: niente sotto-indirizzi inventati (OWASP ZAP)
    if (!admin) return json(403, { errore: 'solo amministratori' });
    const n = Math.min(365, Math.max(7, Number(parti[3]) || 30));
    const giorno = (k) => new Date(Date.now() - k * 864e5).toISOString().slice(0, 10), da = giorno(n - 1);
    const [righe, acc, casi, aws] = await Promise.all([M.statVisite ? M.statVisite(da) : [], M.elencoAccount(), M.elencoCasi(),
      cfg.traffico ? cfg.traffico(Math.max(n, 32)).catch((e) => ({ errore: String(e?.message || e) })) : null]);
    const perGiorno = {};
    for (let k = n - 1; k >= 0; k--) perGiorno[giorno(k)] = { giorno: giorno(k), pagine: 0, utenti: 0, login: 0, sessioni: 0, mobile: 0, iscrizioni: 0 };
    const pagine = {}, perCaso = {};
    for (const r of righe) {
      const g = perGiorno[r.giorno]; if (!g) continue;
      if (r.voce.startsWith('_')) { const k = r.voce.slice(1); if (k in g) g[k] += r.n; }
      else if (r.voce.startsWith('caso:')) perCaso[r.voce.slice(5)] = (perCaso[r.voce.slice(5)] || 0) + r.n;
      else { g.pagine += r.n; pagine[r.voce] = (pagine[r.voce] || 0) + r.n; }
    }
    const iscritti = acc.filter((a) => a.ruolo !== 'admin' && a.stato !== 'attesa');
    for (const a of iscritti) { const g = perGiorno[String(a.creato || '').slice(0, 10)]; if (g) g.iscrizioni++; }
    const titoli = Object.fromEntries(casi.map((c) => [c.id, c.titolo || c.id]));
    return json(200, { generato: new Date().toISOString(), da, giorni: Object.values(perGiorno),
      attiviPeriodo: iscritti.filter((a) => String(a.ultimoAccesso || '') >= da).length, iscritti: iscritti.length,
      pagine: Object.entries(pagine).map(([p, v]) => ({ p, n: v })).sort((a, b) => b.n - a.n),
      casi: Object.entries(perCaso).map(([id, v]) => ({ id, titolo: titoli[id] || id, n: v })).sort((a, b) => b.n - a.n).slice(0, 15), aws });
  }
  if (parti[1] === 'statistiche' && parti.length === 2 && metodo === 'GET') {
    if (!admin) return json(403, { errore: 'solo amministratori' });
    const [acc, righe, esami, casiTutti] = await Promise.all([M.elencoAccount(), M.risultati(), M.elencoEsami ? M.elencoEsami().catch(() => []) : [], M.elencoCasi()]);
    const iscritti = acc.filter((a) => a.stato !== 'attesa' && a.ruolo !== 'admin' && a.attivo !== false);
    const giorni = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const conta = (l, f) => { const m = {}; for (const x of l) { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; } return m; };
    const accorpa = (m) => { const o = {}; let altre = 0; for (const [k, v] of Object.entries(m)) { if (v >= 3) o[k] = v; else altre += v; } if (altre) o.altre = altre; return o; };
    const r = righe.filter((x) => x.account && !String(x.account).startsWith('eliminato') && x.ruolo !== 'admin' && x.account !== 'admin');
    const mesi = [...new Set([...r.map((x) => String(x.data).slice(0, 7)), ...iscritti.map((a) => String(a.creato || '').slice(0, 7))])].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
    const perMese = mesi.map((m) => { const rm = r.filter((x) => String(x.data).startsWith(m));
      return { mese: m, iscrizioni: iscritti.filter((a) => String(a.creato || '').startsWith(m)).length, risposte: rm.length, attivi: new Set(rm.map((x) => x.account)).size }; });
    const migliori = {}; for (const x of r) { const o = (migliori[x.account] ||= {}); o[x.caso] = Math.max(o[x.caso] ?? 0, x.punteggio); }
    return json(200, {
      generato: ora16(),
      iscritti: { totale: iscritti.length, docenti: iscritti.filter((a) => a.ruolo === 'docente' || a.ruolo === 'referente').length,
        attivi30: iscritti.filter((a) => String(a.ultimoAccesso || '') >= giorni(30)).length, attivi90: iscritti.filter((a) => String(a.ultimoAccesso || '') >= giorni(90)).length,
        categorie: accorpa(conta(iscritti, (a) => CATEGORIE[a.categoria] || 'non indicata')) },
      risposte: { totale: r.length, ultimi30: r.filter((x) => String(x.data) >= giorni(30)).length, casiDiversi: new Set(r.map((x) => x.caso)).size,
        media: r.length ? Math.round(r.reduce((t, x) => t + (x.punteggio || 0), 0) / r.length) : null, referti: r.filter((x) => (x.dettagli?.referto || '').trim()).length },
      perMese,
      // per contare i percorsi completati nel browser (percorsi.json non è nella Lambda): solo i migliori punteggi, senza chi
      migliori: Object.values(migliori).sort(() => Math.random() - 0.5),
      esami: conta(esami, (e) => e.livello),
      // accuratezza di lettura per metodica (mediane, solo con almeno 5 persone): sensibilità e specificità
      lettura: letturaAggregata(letturaPerArea(r, Object.fromEntries(casiTutti.map((c) => [c.id, c])))),
      // test d'ingresso e finale dei percorsi (10): coppie della stessa persona sullo stesso percorso, miglioramento medio
      prePost: (() => { const coppie = [];
        for (const pre of esami.filter((e) => e.livello === 'pre' && e.percorso)) {
          const post = esami.filter((e) => e.livello === 'post' && e.percorso === pre.percorso && e.account === pre.account && String(e.data) > String(pre.data)).pop();
          if (post) coppie.push({ percorso: pre.percorso, prima: pre.punteggio, dopo: post.punteggio });
        }
        const per = {}; for (const c of coppie) (per[c.percorso] ||= []).push(c);
        const media = (l, k) => Math.round(l.reduce((t, x) => t + x[k], 0) / l.length);
        return { coppie: coppie.length, ...(coppie.length ? { prima: media(coppie, 'prima'), dopo: media(coppie, 'dopo') } : {}),
          percorsi: Object.entries(per).filter(([, l]) => l.length >= 3).map(([id, l]) => ({ id, n: l.length, prima: media(l, 'prima'), dopo: media(l, 'dopo') })) }; })(),
    });
  }

  // ---------------- esami simulati: storico per confrontare i risultati nel tempo (e per il docente)
  // Esame: { account, nome, livello (Base|Intermedio|Avanzato|Misto|libero), ambito, n, minuti, punteggio, perfetti, svolti, durata_s, data, casi: [{ id, p }] }
  // Il punteggio lo ricalcola il server dalle risposte salvate durante la prova (non quello mandato dal browser).
  // riepilogo mensile per il docente (9): fermi, temi sbagliati, casi troppo facili o difficili
  if (parti[1] === 'riepilogo-mensile' && metodo === 'GET') {
    if (!docente) return json(403, { errore: 'solo docenti' });
    const [account, righe, casi, classi, errori] = await Promise.all([M.elencoAccount(), M.risultati(), M.elencoCasi(), M.elencoClassi ? M.elencoClassi() : [],
      M.elencoErrori ? M.elencoErrori().catch(() => []) : []]);
    return json(200, riepilogoMensile({ account, righe, casi, classi, errori }, admin ? null : io.id));
  }
  // casi proposti dagli iscritti: gli autori vedono tutte le proposte e le rifiutano o le pubblicano dall'editor;
  // chi propone vede solo le sue, con lo stato e il motivo di un eventuale rifiuto
  if (parti[1] === 'proposte') {
    const tutti = (await M.elencoCasi()).filter((c) => c.proposta);
    if (metodo === 'GET') {
      const l = tutti.filter((c) => autore || c.proposta.da === io.id).sort((x, y) => String(y.proposta.data).localeCompare(String(x.proposta.data)));
      return json(200, l.map((c) => ({ id: c.id, titolo: c.titolo || c.id, modalita: c.modalita || '', stato: c.proposta.stato, data: c.proposta.data,
        ...(c.proposta.motivo ? { motivo: c.proposta.motivo } : {}), ...(c.proposta.esito ? { esito: c.proposta.esito } : {}),
        ...(autore ? { nome: c.proposta.nome, descrizione: c.proposta.descrizione, visibile: visibile(c) } : {}) })));
    }
    if (metodo === 'POST' && ID_PROPOSTA.test(parti[2] || '')) {
      if (!autore) return json(403, { errore: 'solo autori dei casi' });
      const c = tutti.find((x) => x.id === parti[2]);
      if (!c) return json(404, { errore: 'proposta non trovata' });
      // controllo dell'anonimato fatto dal docente nel browser (intestazioni di tutti i file, testo nelle immagini)
      if (dati.azione === 'controllo') {
        const n = (x) => Math.max(0, Math.min(1e6, Math.round(+x || 0)));
        const controllo = { esito: dati.esito === 'ok' ? 'ok' : 'problemi', data: ora16(), docente: io.nome || '', file: n(dati.file), immagini: n(dati.immagini), zone: n(dati.zone),
          ...(dati.esito === 'ok' ? {} : { problemi: (Array.isArray(dati.problemi) ? dati.problemi : []).slice(0, 20).map((x) => pulisciTesto(x, 120)) }) };
        if (controllo.esito === 'ok' && !controllo.file) return json(400, { errore: 'controllo senza file' });
        await M.scriviCaso(c.id, { ...c, proposta: { ...c.proposta, controllo } });
        return json(200, { ok: true, controllo });
      }
      if (dati.azione !== 'rifiuta') return json(400, { errore: 'azione non valida' });
      const motivo = pulisciTesto(dati.motivo, 500);
      if (!motivo) return json(400, { errore: 'scrivi il motivo (lo vede chi ha proposto il caso)' });
      await M.scriviCaso(c.id, { ...c, visibile: false, proposta: { ...c.proposta, stato: 'rifiutata', motivo, esito: ora16(), docente: io.nome || '' } });
      return json(200, { ok: true });
    }
    return json(404, { errore: 'percorso non valido' });
  }
  if (parti[1] === 'esami') {
    if (!M.elencoEsami) return json(501, { errore: 'non disponibile' });
    if (metodo === 'GET') {
      let tutti = await M.elencoEsami();
      if (tutti.some((e) => CON_REVISIONE.includes(e.livello))) { const righe = await M.risultati(); tutti = tutti.map((e) => (CON_REVISIONE.includes(e.livello) ? esitoGuardia(e, righe) : e)); }
      if (parti[2] === 'tutti') {
        if (!docente) return json(403, { errore: 'solo docenti' });
        const amb = new Set((await accountAmbito()).map((a) => a.id));
        return json(200, tutti.filter((e) => amb.has(e.account)).sort((x, y) => String(x.data).localeCompare(String(y.data))));
      }
      return json(200, tutti.filter((e) => e.account === io.id).sort((x, y) => String(x.data).localeCompare(String(y.data))));
    }
    if (metodo === 'POST') {
      const ids = [...new Set((Array.isArray(dati.casi) ? dati.casi : []).filter((x) => typeof x === 'string' && ID_OK.test(x)))].slice(0, 40);
      if (!ids.length) return json(400, { errore: 'esame senza casi' });
      const inizio = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dati.inizio || '') ? dati.inizio : ora16();
      const mie = (await M.risultati()).filter((r) => r.account === io.id && ids.includes(r.caso) && String(r.data) >= inizio)
        .sort((x, y) => String(x.data).localeCompare(String(y.data)));
      // lista di lavoro: tempo di lettura di ogni caso (secondi) e priorità della richiesta
      const tempo = (id) => { const t = Math.round(+dati.tempi?.[id]); return Number.isFinite(t) && t > 0 ? { t: Math.min(7200, t) } : {}; };
      const prio = (id) => (['urgente', 'prioritaria', 'ordinaria'].includes(dati.priorita?.[id]) ? { prio: dati.priorita[id] } : {});
      const casi = ids.map((id) => { const r = mie.find((x) => x.caso === id); return { id, p: r ? Math.round(r.punteggio) : 0, ...(r ? {} : { ns: true }), ...(r?.perfetta ? { perf: true } : {}),
        ...(dati.livello === 'lista' ? { ...tempo(id), ...prio(id) } : {}) }; });
      const e = { account: io.id, nome: io.nome || '', livello: ['Base', 'Intermedio', 'Avanzato', 'Misto', 'pre', 'post', 'guardia', 'lista'].includes(dati.livello) ? dati.livello : 'libero',
        ...(CON_REVISIONE.includes(dati.livello) ? { inizio } : {}),
        ...(['pre', 'post'].includes(dati.livello) && ID_OK.test(String(dati.percorso || '')) ? { percorso: String(dati.percorso) } : {}),
        ambito: pulisciTesto(dati.ambito, 120), n: ids.length, minuti: Math.max(1, Math.min(20, Math.round(+dati.minuti || 3))),
        punteggio: Math.round(casi.reduce((t, c) => t + c.p, 0) / ids.length), perfetti: casi.filter((c) => c.perf).length, svolti: casi.filter((c) => !c.ns).length,
        durata_s: Math.max(0, Math.min(36000, Math.round(+dati.durata_s || 0))), data: ora16(), casi };
      if (CON_REVISIONE.includes(e.livello)) e.minuti = Math.max(1, Math.min(240, Math.round(+dati.minuti || 60)));
      if (!admin) await M.scriviEsame(e);
      return json(200, { ...(CON_REVISIONE.includes(e.livello) ? esitoGuardia(e, await M.risultati()) : e), salvato: !admin });
    }
    return json(404, { errore: 'percorso non valido' });
  }

  // ---------------- percorsi didattici creati dai docenti (oltre a quelli fissi di percorsi.json)
  // Percorso: { id, titolo, descrizione, casi: [id caso, in ordine], autore, autore_nome, pubblico, aggiornato }
  // pubblico (solo l'amministratore): lo vedono tutti; altrimenti chi ha scelto l'autore come docente di riferimento.
  if (parti[1] === 'percorsi') {
    if (!M.elencoPercorsi) return json(501, { errore: 'percorsi non disponibili' });
    const tutti = await M.elencoPercorsi();
    // percorsi del sito (percorsi.json) personalizzati dall'amministratore: record «f-<id>» con il campo «fisso»,
    // visibili a tutti; i casi, il titolo e la descrizione sostituiscono quelli del modello, «nascosto» lo toglie
    const posso = (p) => admin || (docente && !p.fisso && p.autore === io.id);
    const vedo = (p) => posso(p) || !!p.fisso || p.pubblico === true || (Array.isArray(io.docenti) && io.docenti.includes(p.autore));
    const pid = parti[2];
    if (metodo === 'GET' && !pid) return json(200, tutti.filter(vedo).map((p) => ({ ...p, modificabile: posso(p) })));
    if (!docente) return json(403, { errore: 'solo docenti' });
    const prima = pid ? tutti.find((p) => p.id === pid) : null;
    if (pid && (!prima || !posso(prima))) return json(404, { errore: 'percorso non trovato' });
    if (metodo === 'POST' && pid && parti[3] === 'elimina') { await M.eliminaPercorso(pid); return json(200, { ok: true }); }
    if (metodo === 'POST' && !pid && typeof dati.fisso === 'string') {
      if (!admin) return json(403, { errore: 'i percorsi del sito li personalizza l\'amministratore' });
      if (!ID_OK.test(dati.fisso) || dati.fisso.length > 60) return json(400, { errore: 'percorso non valido' });
      const p = { id: 'f-' + dati.fisso, fisso: dati.fisso, titolo: pulisciTesto(dati.titolo, 100), descrizione: pulisciTesto(dati.descrizione, 300),
        casi: [...new Set((Array.isArray(dati.casi) ? dati.casi : []).filter((x) => typeof x === 'string' && ID_OK.test(x)))].slice(0, 120),
        nascosto: dati.nascosto === true, autore: io.id, aggiornato: ora16() };
      await M.scriviPercorso(p);
      return json(200, { ...p, modificabile: true });
    }
    if (metodo === 'POST') {
      if (!prima && tutti.filter((p) => p.autore === io.id).length >= 50) return json(400, { errore: 'massimo 50 percorsi per docente' });
      const p = { id: prima ? prima.id : 'd-' + randomBytes(5).toString('hex'), titolo: pulisciTesto(dati.titolo, 100) || 'Percorso',
        descrizione: pulisciTesto(dati.descrizione, 300), casi: [...new Set((Array.isArray(dati.casi) ? dati.casi : []).filter((x) => typeof x === 'string' && ID_OK.test(x)))].slice(0, 120),
        autore: prima ? prima.autore : io.id, autore_nome: prima ? prima.autore_nome : (admin ? '' : io.nome || ''),
        pubblico: admin ? dati.pubblico === true : (prima?.pubblico === true), aggiornato: ora16() };
      await M.scriviPercorso(p);
      return json(200, { ...p, modificabile: true });
    }
    return json(404, { errore: 'percorso non valido' });
  }

  // elenco dei docenti tra cui scegliere i propri riferimenti
  if (parti[1] === 'docenti' && metodo === 'GET') {
    const l = (await M.elencoAccount()).filter(eDocente).map((a) => ({ id: a.id, nome: a.nome, sede: a.sede || '', categoria: CATEGORIE[a.categoria] || '' }));
    return json(200, l.sort((x, y) => x.nome.localeCompare(y.nome, 'it')));
  }

  // ---------------- sponsor: gestione (solo amministratore), con viste e clic degli ultimi 90 giorni
  if (parti[1] === 'sponsor') {
    if (!admin) return json(403, { errore: 'solo amministratori' });
    if (!M.elencoSponsor) return json(501, { errore: 'sponsor non disponibili' });
    if (metodo === 'GET' && parti[2] === 'gestione') {
      const da = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const [l, st] = await Promise.all([M.elencoSponsor(), M.statSponsor ? M.statSponsor(da) : []]);
      return json(200, l.map((x) => {
        const mie = st.filter((r) => r.id === x.id);
        const somma = (k, giorni) => mie.filter((r) => r.giorno >= new Date(Date.now() - giorni * 86400000).toISOString().slice(0, 10)).reduce((t, r) => t + (r[k] || 0), 0);
        return { ...x, attivoOra: sponsorAttivo(x), stat: { viste30: somma('viste', 30), clic30: somma('clic', 30), viste90: somma('viste', 90), clic90: somma('clic', 90) } };
      }).sort((a, b) => a.nome.localeCompare(b.nome, 'it')));
    }
    const sid = parti[2];
    if (sid && !ID_OK.test(sid)) return json(404, { errore: 'sponsor non valido' });
    if (metodo === 'POST' && sid && parti[3] === 'elimina') { await M.eliminaSponsor(sid); return json(200, { ok: true }); }
    if (metodo === 'POST') {
      const prima = sid ? (await M.elencoSponsor()).find((x) => x.id === sid) : null;
      if (sid && !prima) return json(404, { errore: 'sponsor non trovato' });
      const x = pulisciSponsor(dati, prima || { id: randomBytes(4).toString('hex') });
      if (typeof dati.logo === 'string' && dati.logo && !x.logo) return json(400, { errore: 'Logo non valido: PNG, JPEG, WebP o SVG, al massimo 200 kB.' });
      if (dati.link && !x.link) return json(400, { errore: 'Il link deve iniziare con https://' });
      await M.scriviSponsor(x);
      return json(200, x);
    }
    return json(404, { errore: 'percorso non valido' });
  }

  // ---------------- clienti e piattaforme (tenant): solo nella vetrina, solo amministratore.
  // Qui si registra la piattaforma di un cliente; la crea (o la aggiorna) sul Mac lo script crea-istanze.command,
  // che legge questo elenco, pubblica lo stack AWS separato, invita il referente come amministratore e segna lo stato.
  if (parti[1] === 'tenant') {
    if (AZIENDA || !admin) return json(403, { errore: 'solo l\'amministratore della vetrina' });
    if (!M.elencoAziende) return json(501, { errore: 'non disponibile' });
    const zona = (() => { try { return new URL(cfg.indirizzo).hostname.replace(/^www\./, ''); } catch { return 'radio-quiz.it'; } })();
    const tid = parti[2];
    if (metodo === 'GET' && !tid) {
      const l = (await M.elencoAziende()).filter((t) => t && t.id && t.tipo === 'tenant');
      const verifica = true;
      await Promise.all(l.map(async (t) => {               // la piattaforma risponde? (solo quelle create)
        if (!verifica || !['attiva', 'sospesa', 'da_aggiornare'].includes(t.stato)) return;
        try { const c = new AbortController(), to = setTimeout(() => c.abort(), 3000);
          const r = await fetch(`https://${t.dominio}/api/istanza`, { signal: c.signal }); clearTimeout(to);
          t.online = r.ok; } catch { t.online = false; }
      }));
      // lavori AWS in corso: se il lavoro è finito senza esito (errore, interrotto, tempo scaduto) lo stato diventa «errore»
      const inCorso = l.filter((t) => t.stato === 'in_corso' && t.lavoro?.build);
      if (inCorso.length && cfg.creazione) {
        try { const s = await cfg.creazione.stato(inCorso.map((t) => t.lavoro.build));
          for (const t of inCorso) { const x = s[t.lavoro.build];
            if (x && x !== 'IN_PROGRESS' && x !== 'SUCCEEDED') { Object.assign(t, { stato: 'errore', errore: `lavoro AWS ${x === 'TIMED_OUT' ? 'scaduto' : x === 'STOPPED' ? 'interrotto' : 'non riuscito'} prima di concludersi`, aggiornato: ora16(), lavoro: { ...t.lavoro, token: '', fine: ora16(), esito: 'errore' } }); await M.scriviAzienda(t); } }
        } catch (e) { console.error('stato lavori', e?.message || e); }
      }
      for (const t of l) if (t.lavoro) t.lavoro = { ...t.lavoro, token: undefined };
      return json(200, { zona, automatica: !!cfg.creazione, elenco: l.sort((a, b) => String(a.cliente).localeCompare(String(b.cliente), 'it')) });
    }
    if (tid && !/^[a-z0-9][a-z0-9-]{1,29}$/.test(tid)) return json(404, { errore: 'identificativo non valido' });
    const prima = tid ? await M.leggiAzienda(tid) : null;
    if (tid && (!prima || prima.tipo !== 'tenant')) return json(404, { errore: 'piattaforma non trovata' });
    if (metodo === 'POST' && tid && parti[3] === 'elimina') {
      if (prima.creata || !['da_creare', 'errore', 'smontata'].includes(prima.stato)) return json(400, { errore: 'La piattaforma esiste già su AWS: prima va smontata dal Mac (scegli «Da smontare»), poi si toglie dall\'elenco.' });
      await M.eliminaAzienda(tid); return json(200, { ok: true });
    }
    // avvio dal pannello: il lavoro AWS crea, aggiorna, sospende o smonta la piattaforma (vedi crea-tenant.sh)
    if (metodo === 'POST' && tid && parti[3] === 'avvia') {
      if (!cfg.creazione) return json(501, { errore: 'Creazione automatica non configurata: usa crea-istanze.command sul Mac.' });
      if (prima.stato === 'in_corso' && prima.lavoro?.scade > Date.now()) return json(409, { errore: 'C\'è già un lavoro in corso per questa piattaforma.' });
      const azione = prima.stato === 'da_smontare' ? 'smonta' : prima.stato === 'sospesa' && !prima.sospesaApplicata ? 'sospendi'
        : prima.stato === 'da_creare' || (prima.stato === 'errore' && !prima.creata) ? 'crea' : ['da_aggiornare', 'attiva', 'errore'].includes(prima.stato) ? 'aggiorna' : null;
      if (!azione) return json(400, { errore: 'Niente da fare per questa piattaforma.' });
      if (azione === 'smonta' && dati.conferma !== tid) return json(400, { errore: 'Per smontare scrivi l\'identificativo della piattaforma come conferma.' });
      const token = randomBytes(24).toString('base64url');
      const datiLavoro = Object.fromEntries(['id', 'cliente', 'nomeIstanza', 'dominio', 'zona', 'contatto', 'referenteNome', 'referenteEmail', 'utentiMax', 'scadenza'].map((k) => [k, prima[k] ?? '']));
      let build;
      try { build = await cfg.creazione.avvia({ id: tid, azione, tenant: datiLavoro, token }); }
      catch (e) { return json(502, { errore: 'AWS non ha avviato il lavoro: ' + (e?.message || e) }); }
      const tn = { ...prima, stato: 'in_corso', statoPrima: prima.stato, errore: '', aggiornato: ora16(),
        lavoro: { azione, build, inizio: ora16(), avviatoMs: Date.now(), scade: Date.now() + 3 * 3600e3, token: improntaGettone(token) } };
      await M.scriviAzienda(tn); return json(200, { ...tn, lavoro: { ...tn.lavoro, token: undefined } });
    }
    // aggiornamento dello stato da parte dello script del Mac
    if (metodo === 'POST' && tid && parti[3] === 'stato') {
      const st = ['attiva', 'errore', 'smontata', 'sospesa'].includes(dati.stato) ? dati.stato : null;
      if (!st) return json(400, { errore: 'stato non valido' });
      const t = { ...prima, stato: st, aggiornato: ora16(), sospesaApplicata: st === 'sospesa' ? true : st === 'attiva' ? false : prima.sospesaApplicata, ...(st === 'attiva' || st === 'sospesa' ? { pubblicato: ora16(), errore: '', versione: pulisciTesto(dati.versione || '', 20) } : {}),
        ...(st === 'errore' ? { errore: pulisciTesto(dati.errore || 'pubblicazione non riuscita', 300) } : {}), ...(dati.invitato ? { invitato: ora16() } : {}) };
      await M.scriviAzienda(t); return json(200, t);
    }
    if (metodo === 'POST' && !parti[3]) {
      const id = tid || String(dati.id || '').toLowerCase().trim();
      if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(id) || ['www', 'api', 'esempio', 'admin', 'mail', 'posta'].includes(id)) return json(400, { errore: 'Identificativo: da 2 a 30 caratteri tra lettere minuscole, numeri e trattini (diventa l\'indirizzo: <id>.' + zona + ').' });
      if (!tid && await M.leggiAzienda(id)) return json(400, { errore: 'Identificativo già usato.' });
      const email = (x) => pulisciEmail(x) || '';
      const cliente = pulisciTesto(dati.cliente ?? prima?.cliente, 120), nome = pulisciTesto(dati.nomeIstanza ?? prima?.nomeIstanza, 80) || cliente;
      if (!cliente) return json(400, { errore: 'Scrivi il nome del cliente.' });
      const refEmail = email(dati.referenteEmail ?? prima?.referenteEmail);
      if (!refEmail) return json(400, { errore: 'Serve l\'email del referente: riceverà l\'invito come amministratore della piattaforma.' });
      const statiAdmin = ['da_creare', 'da_aggiornare', 'sospesa', 'da_smontare'];
      let stato = prima ? prima.stato : 'da_creare';
      if (statiAdmin.includes(dati.stato) && prima && prima.stato !== 'da_creare' && prima.stato !== 'in_corso') stato = dati.stato;
      const sospesaApplicata = stato === 'sospesa' ? (prima?.stato === 'sospesa' ? !!prima.sospesaApplicata : false) : false;
      const t = { ...(prima || {}), tipo: 'tenant', id, cliente, nomeIstanza: nome, dominio: `${id}.${zona}`, zona,
        contatto: email(dati.contatto ?? prima?.contatto) || refEmail, referenteNome: pulisciTesto(dati.referenteNome ?? prima?.referenteNome, 80), referenteEmail: refEmail,
        piano: ['pilota', 'base', 'pro', 'personalizzato'].includes(dati.piano) ? dati.piano : prima?.piano || 'pilota',
        utentiMax: Math.max(0, Math.min(100000, parseInt(dati.utentiMax ?? prima?.utentiMax ?? 0, 10) || 0)),
        scadenza: /^\d{4}-\d{2}-\d{2}$/.test(dati.scadenza || '') ? dati.scadenza : (dati.scadenza === '' ? '' : prima?.scadenza || ''),
        note: String(dati.note ?? prima?.note ?? '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').slice(0, 1000),
        stato, sospesaApplicata, creato: prima?.creato || ora16(), aggiornato: ora16() };
      await M.scriviAzienda(t); return json(200, t);
    }
    return json(404, { errore: 'percorso non valido' });
  }

  // ---------------- gestione account (solo amministratore)
  if (parti[1] === 'account') {
    if (!admin) return json(403, { errore: 'solo amministratori' });
    const ruoliConsentiti = ['admin', 'docente', 'specializzando'];
    const id = parti[2];
    if (!id && metodo === 'GET') {
      const tutti = await M.elencoAccount();
      for (const a of tutti.filter(scaduti)) await M.eliminaAccount(a.id);  // iscrizioni mai confermate: via dopo una settimana
      // passaggio dalle aziende: chi apparteneva a un'azienda tiene come riferimento i docenti della stessa azienda
      for (const a of tutti.filter((x) => x.azienda && !Array.isArray(x.docenti) && x.ruolo === 'specializzando')) {
        a.docenti = tutti.filter((d) => d.azienda === a.azienda && eDocente(d)).map((d) => d.id).slice(0, 10);
        await M.scriviAccount(a);
      }
      const vivi = tutti.filter((a) => !scaduti(a));
      // attività di ciascuno (casi diversi, risposte, punteggio medio al primo tentativo, ultima risposta) e classi dei docenti
      const [righe, classi] = await Promise.all([M.risultati(), M.elencoClassi ? M.elencoClassi() : []]);
      const att = {};
      for (const r of righe) {
        const t = (att[r.account] ||= { risposte: 0, casi: new Set(), punti: 0, primi: 0, ultima: '' });
        t.risposte++; t.casi.add(r.caso);
        if ((r.tentativo || 1) === 1 && Number.isFinite(Number(r.punteggio))) { t.punti += Number(r.punteggio); t.primi++; }
        if (String(r.data) > t.ultima) t.ultima = String(r.data);
      }
      const l = vivi.map((a) => { const t = att[a.id];
        return { ...pubblicoAccount(a), seguaci: vivi.filter((x) => (x.docenti || []).includes(a.id)).length,
          ruolo: a.ruolo === 'referente' ? 'docente' : a.ruolo, avvisi: a.avvisi !== false,
          attivita: t ? { casi: t.casi.size, risposte: t.risposte, media: t.primi ? Math.round(t.punti / t.primi) : null, ultima: t.ultima } : { casi: 0, risposte: 0, media: null, ultima: '' },
          classi: classi.filter((c) => c.proprietario === a.id).length }; });
      l.sort((a, b) => a.ruolo.localeCompare(b.ruolo) || a.nome.localeCompare(b.nome, 'it'));
      return json(200, l);
    }
    if (!id && metodo === 'POST') {                                // account con codice personale (amministratori, prove) o invito per email
      const nome = pulisciTesto(dati.nome, 80);
      const ruolo = ruoliConsentiti.includes(dati.ruolo) ? dati.ruolo : 'specializzando';
      if (!nome) return json(400, { errore: 'serve il nome' });
      const email = pulisciEmail(dati.email);
      if (email && await perEmail(email)) return json(400, { errore: 'indirizzo già usato da un altro account' });
      // limite di utenti del piano del cliente (account attivi, amministratore escluso)
      if (IST.utentiMax) {
        const attivi = (await M.elencoAccount()).filter((a) => a.attivo !== false && !String(a.id).startsWith('eliminato') && a.ruolo !== 'admin').length;
        if (attivi >= IST.utentiMax) return json(400, { errore: `Limite del piano raggiunto: ${IST.utentiMax} utenti attivi. Disattiva un account non più usato o chiedi di ampliare il piano.` });
      }
      if (dati.invita === true) {
        // invito: l'account è attivo ma senza password; il link dell'email (7 giorni) serve a sceglierla
        if (!email) return json(400, { errore: 'Per l\'invito serve l\'indirizzo email.' });
        if (!cfg.inviaEmail) return json(503, { errore: 'Invio delle email non disponibile.' });
        const { t, salvato } = nuovoGettone(24 * 7);
        const acc = { id: randomBytes(6).toString('hex'), nome, ruolo, email, pw: '', hash: '', attivo: true, stato: '', creato: ora16(),
          autore: ruolo === 'docente' && !!dati.autore, categoria: CATEGORIE[dati.categoria] ? dati.categoria : (ruolo === 'specializzando' ? 'specializzando' : ''),
          sede: pulisciTesto(dati.sede || '', 120), docenti: [], avvisi: true, invitato: ora16(), reset: { ...salvato, inviato: Date.now() } };
        await M.scriviAccount(acc);
        try { await cfg.inviaEmail(email, ...testoInvito(nome, cfg.indirizzo, `${acc.id}.${t}`, ruolo, IST.nome)); }
        catch (e) { console.error('email', e?.message || e); return json(502, { errore: 'Account creato, ma l\'email di invito non è partita: riprova con «Reinvia invito».', account: pubblicoAccount(acc) }); }
        return json(200, { account: pubblicoAccount(acc), invitato: true });
      }
      const codice = generaCodice();
      const acc = { id: randomBytes(5).toString('hex'), nome, ruolo, hash: impronta(codice), attivo: true, creato: ora16(),
        email, autore: ruolo === 'docente' && !!dati.autore, categoria: CATEGORIE[dati.categoria] ? dati.categoria : '', docenti: [] };
      await M.scriviAccount(acc);
      return json(200, { account: pubblicoAccount(acc), codice });
    }
    if (!id || !ID_OK.test(id) || id === 'admin') return json(404, { errore: 'account non valido' });
    const acc = await M.leggiAccount(id);
    if (!acc) return json(404, { errore: 'account non trovato' });
    if (metodo === 'POST' && parti[3] === 'codice') {
      const codice = generaCodice();
      await M.scriviAccount({ ...acc, hash: impronta(codice) });
      return json(200, { account: pubblicoAccount(acc), codice });
    }
    if (metodo === 'POST' && parti[3] === 'invito') {
      if (acc.pw) return json(400, { errore: 'L\'account ha già una password: può usare «Password dimenticata».' });
      if (!acc.email || !cfg.inviaEmail) return json(400, { errore: 'Manca l\'indirizzo email.' });
      const { t, salvato } = nuovoGettone(24 * 7);
      await M.scriviAccount({ ...acc, invitato: ora16(), reset: { ...salvato, inviato: Date.now() } });
      await cfg.inviaEmail(acc.email, ...testoInvito(acc.nome, cfg.indirizzo, `${acc.id}.${t}`, acc.ruolo, IST.nome));
      return json(200, { ok: true });
    }
    // l'amministratore manda il link per scegliere una nuova password (account con email e password; valido 24 ore)
    if (metodo === 'POST' && parti[3] === 'reset') {
      if (!acc.email || !cfg.inviaEmail) return json(400, { errore: 'Manca l\'indirizzo email.' });
      if (!acc.pw) return json(400, { errore: 'L\'account non ha ancora una password: usa «Reinvia invito».' });
      if (acc.attivo === false) return json(400, { errore: 'Account disattivato: riattivalo prima.' });
      const { t, salvato } = nuovoGettone(24);
      await M.scriviAccount({ ...acc, reset: { ...salvato, inviato: Date.now() } });
      await cfg.inviaEmail(acc.email, ...testoNuovaPassword(acc.nome, cfg.indirizzo, `${acc.id}.${t}`));
      return json(200, { ok: true });
    }
    if (metodo === 'POST' && parti[3] === 'elimina') { if (M.anonimizzaRisultati) await M.anonimizzaRisultati(id); await M.eliminaAccount(id); return json(200, { ok: true }); }
    if (metodo === 'POST' && !parti[3]) {
      const nuovo = { ...acc };
      if (typeof dati.nome === 'string' && dati.nome.trim()) nuovo.nome = pulisciTesto(dati.nome, 80);
      if (ruoliConsentiti.includes(dati.ruolo)) {
        nuovo.ruolo = dati.ruolo;
        if (dati.ruolo !== 'docente') nuovo.autore = false;
      }
      // l'amministratore può togliere (e bloccare) la funzione docente a un account, o sbloccarla
      if (typeof dati.noDocente === 'boolean') { nuovo.noDocente = dati.noDocente; if (dati.noDocente && nuovo.ruolo === 'docente') { nuovo.ruolo = 'specializzando'; nuovo.autore = false; } }
      if (typeof dati.attivo === 'boolean') nuovo.attivo = dati.attivo;
      if (dati.conferma === true) { nuovo.stato = ''; nuovo.conferma = null; }   // conferma manuale dell'iscrizione
      if (typeof dati.email === 'string') {
        const email = pulisciEmail(dati.email);
        if (email && (await perEmail(email))?.id && (await perEmail(email)).id !== id) return json(400, { errore: 'indirizzo già usato da un altro account' });
        nuovo.email = email;
      }
      if (typeof dati.autore === 'boolean') nuovo.autore = dati.autore && nuovo.ruolo === 'docente';
      // docenti di riferimento assegnati dall'amministratore: l'iscritto riceve un avviso e può toglierli dal suo profilo
      let aggiunti = [];
      if (Array.isArray(dati.docenti)) {
        const tutti = new Map((await M.elencoAccount()).map((x) => [x.id, x]));
        nuovo.docenti = [...new Set(dati.docenti)].filter((d) => typeof d === 'string' && d !== id && eDocente(tutti.get(d))).slice(0, 10);
        aggiunti = nuovo.docenti.filter((d) => !(acc.docenti || []).includes(d)).map((d) => tutti.get(d));
      }
      await M.scriviAccount(nuovo);
      // nuova funzione (docente, autore dei casi): l'interessato riceve un'email con cosa può fare da ora
      const diventaDocente = nuovo.ruolo === 'docente' && acc.ruolo !== 'docente', diventaAutore = !!nuovo.autore && !acc.autore;
      if (nuovo.ruolo === 'admin' && acc.ruolo !== 'admin' && cfg.inviaEmail && nuovo.email && nuovo.stato !== 'attesa' && nuovo.attivo !== false) {
        const sito = IST.nome ? `la piattaforma ${IST.nome}` : 'Quiz Radiologia';
        await cfg.inviaEmail(nuovo.email, `Sei amministratore di ${IST.nome || 'Quiz Radiologia'}`, corpoEmail([`Ciao ${nuovo.nome},`,
          `sei stato reso amministratore di ${sito}.`, 'Da ora gestisci gli account (inviti, ruoli, docenti), i casi, i percorsi e le statistiche: trovi tutto nel menu «Gestione», in alto a destra, dopo l\'accesso.'],
          radice(cfg.indirizzo) + '/#/account', { pulsante: 'Apri la gestione' })).catch((e) => console.error('email', e?.message || e));
      }
      let avvisatoRuolo = false;
      if ((diventaDocente || diventaAutore) && cfg.inviaEmail && nuovo.email && nuovo.stato !== 'attesa' && nuovo.attivo !== false) {
        const sito = IST.nome ? `la piattaforma ${IST.nome}` : 'Quiz Radiologia', righe = [`Ciao ${nuovo.nome},`];
        if (diventaDocente) righe.push(`l'amministratore di ${sito} ti ha reso docente.`,
          'Da ora vedi i risultati degli iscritti che ti scelgono come docente di riferimento (o che l\'amministratore ti assegna), puoi creare classi, assegnare casi con una scadenza, comporre percorsi didattici e rivedere i referti scritti dai tuoi studenti.');
        if (diventaAutore) righe.push(diventaDocente ? 'Sei anche autore dei casi: puoi caricare nuovi casi clinici e modificare quelli esistenti.'
          : `l'amministratore di ${sito} ti ha reso autore dei casi: da ora puoi caricare nuovi casi clinici e modificare quelli esistenti.`,
          'I casi nuovi restano in bozza finché un revisore indipendente non li controlla; le immagini devono essere anonime.');
        righe.push('Le nuove funzioni sono nel menu «Gestione», in alto a destra, dopo l\'accesso.');
        await cfg.inviaEmail(nuovo.email, diventaAutore && !diventaDocente ? `Sei autore dei casi su ${IST.nome || 'Quiz Radiologia'}` : `Sei docente su ${IST.nome || 'Quiz Radiologia'}`,
          corpoEmail(righe, radice(cfg.indirizzo) + (diventaAutore && !diventaDocente ? '/#/gestione-casi' : '/#/classi'), { pulsante: 'Apri la piattaforma', ...(diventaDocente ? { piede: PIEDE_DOCENTE } : {}) }))
          .then(() => { avvisatoRuolo = true; }).catch((e) => console.error('email', e?.message || e));
      }
      if (aggiunti.length && cfg.inviaEmail) {
        const elenco = aggiunti.map((d) => d.nome).join(', ');
        if (nuovo.email && nuovo.stato !== 'attesa') await cfg.inviaEmail(nuovo.email, `Nuovo docente di riferimento su Quiz Radiologia`, corpoEmail([`Ciao ${nuovo.nome},`,
          `l'amministratore di Quiz Radiologia ti ha assegnato come ${aggiunti.length === 1 ? 'docente' : 'docenti'} di riferimento: ${elenco}.`,
          `${aggiunti.length === 1 ? 'Questo docente vede' : 'Questi docenti vedono'} i tuoi risultati e ${aggiunti.length === 1 ? 'può' : 'possono'} assegnarti dei casi.`,
          'Se non sei d\'accordo puoi toglierli in qualsiasi momento dal tuo profilo.'], radice(cfg.indirizzo) + '/#/profilo', { pulsante: 'Apri il profilo' })).catch((e) => console.error('email', e?.message || e));
        for (const d of aggiunti) {
          if (!d.email || d.avvisi === false) continue;
          await cfg.inviaEmail(d.email, `${nuovo.nome} è tra i tuoi studenti`, corpoEmail([`Ciao ${d.nome},`,
            `l'amministratore ti ha assegnato ${nuovo.nome} come studente: da ora vedi i suoi risultati e puoi assegnargli dei casi.`],
          radice(cfg.indirizzo) + '/#/analisi/persone', { pulsante: 'Apri i tuoi studenti', piede: PIEDE_DOCENTE })).catch((e) => console.error('email', e?.message || e));
        }
      }
      return json(200, { account: pubblicoAccount(nuovo), avvisati: aggiunti.length, avvisatoRuolo });
    }
    return json(404, { errore: 'percorso non valido' });
  }

  // ---------------- classi e compiti con scadenza
  // Classe: { id, nome, proprietario, membri: [id account], compiti: [{ id, titolo, casi: [id caso], scadenza: 'AAAA-MM-GG' }] }
  // Il docente compone le classi solo con chi lo ha scelto come riferimento; se l'iscritto toglie il docente, la classe sparisce per lui.
  if (parti[1] === 'classi') {
    if (!M.elencoClassi) return json(501, { errore: 'classi non disponibili' });
    const cid = parti[2];
    if (metodo === 'GET' && !cid) {
      const tutte = await M.elencoClassi();
      const mie = tutte.filter((c) => (c.membri || []).includes(io.id) && segue(io, c));
      const righeMie = (await M.risultati()).filter((r) => r.account === io.id);
      const daStudente = mie.map((c) => ({ id: c.id, nome: c.nome, compiti: (c.compiti || []).map((k) => ({ ...k, stato: statoCompito(k, righeMie) })) }));
      if (!docente) return json(200, daStudente);
      // stato di ogni membro per ogni compito: casi svolti (prima della scadenza / dopo) e punteggio medio
      const righe = await risultatiAmbito(), acc = Object.fromEntries((await M.elencoAccount()).map((a) => [a.id, a]));
      const membriValidi = (c) => (c.membri || []).filter((m) => admin || segue(acc[m], c));
      const gestite = tutte.filter(classeMia).map((c) => ({ ...c, gestita: true, membri: membriValidi(c).map((m) => ({ id: m, nome: acc[m]?.nome || '(account eliminato)' })),
        compiti: (c.compiti || []).map((k) => ({ ...k, stato: membriValidi(c).map((m) => statoCompito(k, righe.filter((r) => r.account === m))) })) }));
      // un docente può essere anche iscritto alle classi di un altro docente
      return json(200, [...gestite, ...daStudente.filter((c) => !gestite.some((x) => x.id === c.id))]);
    }
    if (!docente) return json(403, { errore: 'solo docenti' });
    const prima = cid ? (await M.elencoClassi()).find((c) => c.id === cid) : null;
    if (prima && !classeMia(prima)) return json(404, { errore: 'classe non trovata' });
    if (metodo === 'POST' && cid && parti[3] === 'elimina') { await M.eliminaClasse(cid); return json(200, { ok: true }); }
    if (metodo === 'POST') {
      const id = cid && ID_OK.test(cid) ? cid : randomBytes(5).toString('hex');
      const mieiAccount = new Map((await accountAmbito()).filter((a) => a.id !== io.id).map((a) => [a.id, a]));
      const data = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');
      const classe = { id, nome: pulisciTesto(dati.nome, 80) || 'Classe', proprietario: prima ? prima.proprietario || '' : (admin ? '' : io.id),
        membri: (Array.isArray(dati.membri) ? dati.membri : []).filter((m) => ID_OK.test(m) && mieiAccount.has(m)).slice(0, 300),
        compiti: (Array.isArray(dati.compiti) ? dati.compiti : []).slice(0, 100).map((k) => ({
          id: ID_OK.test(k.id || '') ? k.id : randomBytes(4).toString('hex'), titolo: pulisciTesto(k.titolo, 120) || 'Compito',
          casi: (Array.isArray(k.casi) ? k.casi : []).filter((x) => ID_OK.test(x)).slice(0, 200), scadenza: data(k.scadenza) })),
        aggiornato: ora16() };
      await M.scriviClasse(classe);
      // avvisi per email: compiti nuovi a tutti i membri, compiti già esistenti solo ai membri appena aggiunti
      let avvisati = 0;
      if (dati.avvisa !== false && cfg.inviaEmail) {
        const vecchi = new Map((prima?.compiti || []).map((k) => [k.id, k])), giaMembri = new Set(prima?.membri || []);
        const casi = new Map((await M.elencoCasi()).map((c) => [c.id, c.titolo || c.id]));
        for (const m of classe.membri) {
          const a = mieiAccount.get(m);
          if (!a?.email || a.attivo === false || a.avvisi === false) continue;
          const nuovi = classe.compiti.filter((k) => !vecchi.has(k.id) || !giaMembri.has(m));
          if (!nuovi.length) continue;
          try { await cfg.inviaEmail(a.email, ...testoAssegnazione(a, classe, nuovi, casi, cfg.indirizzo, io.nome)); avvisati++; }
          catch (e) { console.error('email', e?.message || e); }
        }
      }
      return json(200, { ...classe, avvisati });
    }
    return json(404, { errore: 'percorso non valido' });
  }
  // chi ha scelto questo docente come riferimento (per comporre le classi): nome, categoria e sede
  if (parti[1] === 'specializzandi' && metodo === 'GET') {
    if (!docente) return json(403, { errore: 'solo docenti' });
    return json(200, (await accountAmbito()).filter((a) => a.attivo !== false && a.id !== io.id && a.ruolo !== 'admin')
      .map((a) => ({ id: a.id, nome: a.nome, email: !!a.email && a.avvisi !== false, categoria: CATEGORIE[a.categoria] || '', sede: a.sede || '', anno: a.anno || '' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it')));
  }

  // ---------------- dati per il cruscotto di analisi (docenti)
  if (parti[1] === 'analisi' && parti.length === 2 && metodo === 'GET') {
    if (!docente) return json(403, { errore: 'solo docenti' });
    const [righe, casi] = await Promise.all([risultatiAmbito(), M.elencoCasi()]);
    righe.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    return json(200, {
      casi: casi.map((c) => ({ id: c.id, titolo: c.titolo || c.id, distretto: c.distretto || '', modalita: c.modalita || '',
        visibile: visibile(c), ...(c.sezioni?.length ? { sezioni: c.sezioni.map((z) => z.nome) } : {}),
        opzioni: (c.opzioni || []).map((o, i) => ({ testo: o.testo, tipo: tipoOpzione(c.opzioni, i), ...(Number.isInteger(o.sezione) ? { sezione: o.sezione } : {}) })) })),
      risultati: righe,
    });
  }

  // ---------------- revisione del referto da parte del docente: voto e commento, visibili allo studente
  if (parti[1] === 'referti' && parti[2] === 'revisione' && metodo === 'POST') {
    if (!docente) return json(403, { errore: 'solo docenti' });
    const idR = String(dati?.id || '');
    if (!/^[0-9T:.\-Z]+#[0-9a-f]{8}$/.test(idR)) return json(400, { errore: 'risposta non valida' });
    let riga = (await risultatiAmbito()).find((r) => r.id === idR);
    if (!riga && M.elencoClassi) {
      // doppia lettura nelle classi: il docente rivede anche i referti di chi è iscritto alle sue classi
      const membri = new Set((await M.elencoClassi()).filter(classeMia).flatMap((c) => c.membri || []));
      riga = (await M.risultati()).find((r) => r.id === idR && membri.has(r.account));
    }
    if (!riga) return json(404, { errore: 'risposta non trovata' });
    const voto = dati.voto === null || dati.voto === '' || dati.voto === undefined ? null : Math.round(Number(dati.voto));
    if (voto !== null && !(voto >= 0 && voto <= 100)) return json(400, { errore: 'il voto va da 0 a 100' });
    const commento = String(dati.commento || '').trim().slice(0, 2000);
    // frecce con nota e misure disegnate dal docente sulle immagini del caso (doppia lettura)
    const pto = (q) => (q && Number.isFinite(+q.x) && Number.isFinite(+q.y) ? { x: Math.round(+q.x * 10) / 10, y: Math.round(+q.y * 10) / 10 } : null);
    const annotazioni = (Array.isArray(dati.annotazioni) ? dati.annotazioni : []).slice(0, 40).map((m) => ({
      k: String(m?.k || ''), tipo: ['nota', 'linea'].includes(m?.tipo) ? m.tipo : null, a: pto(m?.a), b: pto(m?.b), testo: pulisciTesto(m?.testo || '', 160) }))
      .filter((m) => /^\d{1,3}:\d{1,5}$/.test(m.k) && m.tipo && m.a && m.b);
    const prima = riga.dettagli?.revisione || {};
    const ann = Array.isArray(dati.annotazioni) ? annotazioni : (prima.annotazioni || []);
    // turno di guardia: discrepanza tra il referto e la lettura del docente (maggiore = cambia la gestione del paziente)
    const discrepanza = dati.discrepanza === undefined ? (prima.discrepanza || null) : (DISCREPANZE.includes(dati.discrepanza) ? dati.discrepanza : null);
    const revisione = voto === null && !commento && !ann.length && !discrepanza ? null
      : { voto, commento, docente: io.nome, data: ora16(), ...(ann.length ? { annotazioni: ann } : {}), ...(discrepanza ? { discrepanza } : {}) };
    await M.revisionaRisultato(idR, revisione);
    cacheStat = null;
    return json(200, { ok: true, revisione });
  }

  // ---------------- risultati (docenti)
  if (parti[1] === 'risultati' && metodo === 'GET') {
    if (!docente) return json(403, { errore: 'solo docenti' });
    const righe = await risultatiAmbito();
    const catDi = Object.fromEntries((await M.elencoAccount()).map((a) => [a.id, CATEGORIE[a.categoria] || '']));
    righe.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const confTesto = (r) => (r.opzioni || []).filter((o) => o.s).map((o) => `${o.t}: ${o.conf || '-'}`).join(' | ');
    const csv = ['data_ora;nome;categoria;caso;tentativo;punteggio_%;risposta_perfetta;scelte;sicurezza;tempo_s;tempo_attivo_s;mpr;mip;misure;roi;angoli;confronto_fasi;profili;sottrazione;annotazioni;immagini_chiave;referto_libero;referto_confronto_auto_%;voto_docente;commento_docente',
      ...righe.map((r) => [r.data, r.nome, catDi[r.account] || '', r.caso, r.tentativo || '', r.punteggio, r.perfetta ? 'si' : 'no', r.scelte, confTesto(r),
        r.dettagli?.tempo ?? '', r.dettagli?.tempoAttivo ?? '', r.dettagli?.mpr ? 'si' : '', r.dettagli?.mip ? 'si' : '', r.dettagli?.misure ?? '',
        r.dettagli?.roi ?? '', r.dettagli?.angoli ?? '', r.dettagli?.confronto ? 'si' : '',
        r.dettagli?.profili ?? '', r.dettagli?.sottrazione ? 'si' : '', r.dettagli?.note ?? '',
        (r.dettagli?.chiavi || []).map((k) => `${k.d ? '«' + k.d + '» ' : ''}${k.s} img ${k.i}${k.n?.length ? ' (' + k.n.join('; ') + ')' : ''}`).join(' | '), r.dettagli?.referto || '',
        r.dettagli?.valutazione?.punteggio ?? '', r.dettagli?.revisione?.voto ?? '', r.dettagli?.revisione?.commento || '']
        .map(csvCampo).join(';'))].join('\n');
    return { stato: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="risultati-quiz.csv"', 'cache-control': 'no-store' }, corpo: '﻿' + csv };
  }

  // ---------------- casi
  if (parti[1] !== 'casi') return json(404, { errore: 'non trovato' });
  if (parti.length === 2 && metodo === 'GET') {
    // ?indice=1: elenco leggero per la pagina iniziale (niente controlli, conteggi di opzioni e sezioni, proposte)
    const indice = req.query?.indice === '1';
    const casi = (await M.elencoCasi()).filter((c) => autore || visibile(c));
    const st = M.risultati ? await statistiche(M) : {};
    return json(200, casi.map((c) => {
      const s = st[c.id];
      // difficoltà mostrata: quella calcolata dalle risposte quando ce ne sono abbastanza, altrimenti quella del docente
      return { id: c.id, titolo: c.titolo || c.id, distretto: c.distretto || '', difficolta: s?.livello || c.difficolta || '', modalita: c.modalita || '', quesito: c.quesito || '',
        ...(s?.livello ? { difficoltaAuto: true, media: s.media, risposte: s.n } : {}), ...(c.localizza && c.vista?.segno ? { localizza: true } : {}),
        ...(c.mancato ? { mancato: true } : {}), ...(c.acquisizione ? { acquisizione: true } : {}), ...(c.esito_clinico ? { esitoNoto: true } : {}),
        // origine delle immagini: casi del Polime (predefinito) o da archivi pubblici (es. TCIA), tenuti separati nell'elenco
        ...(c.fonte?.archivio ? { origine: /TCIA|Cancer Imaging Archive/i.test(c.fonte.archivio) ? 'TCIA' : 'Archivio pubblico' } : {}),
        ...(c.area ? { area: c.area } : {}),
        ...(autore ? { visibile: visibile(c), difficoltaDocente: c.difficolta || '', ...(s ? { media: s.media, risposte: s.n } : {}),
          ...(indice ? {} : { aggiornato: c.aggiornato || '', controlli: controlliCaso(c), nOpzioni: (c.opzioni || []).length, nSezioni: (c.sezioni || []).length,
            ...(c.proposta ? { proposta: { stato: c.proposta.stato, nome: c.proposta.nome, data: c.proposta.data } } : {}) }) } : {}) };
    }));
  }
  const id = parti[2];
  if (!ID_OK.test(id)) return json(404, { errore: 'caso non valido' });
  const azione = parti[3] || '';
  const caso = await M.leggiCaso(id);

  // nuovo caso: URL firmati per caricare le immagini già anonimizzate nel browser
  // proposta di un iscritto (non autore): codice «prop-…» nuovo, al massimo 5 proposte in attesa per persona
  const proposta = !autore && dati.proposta === true && ID_PROPOSTA.test(id);
  if (proposta && metodo === 'POST' && (azione === 'caricamento' || azione === '')) {
    if (caso) return json(409, { errore: 'codice già usato' });
    const mie = (await M.elencoCasi()).filter((c) => c.proposta?.da === io.id && c.proposta.stato === 'in attesa');
    if (mie.length >= 5) return json(429, { errore: 'Hai già 5 proposte in attesa: aspetta che un docente le controlli.' });
  }
  if (metodo === 'POST' && azione === 'caricamento') {
    if (!autore && !proposta) return json(403, { errore: 'solo autori dei casi' });
    if (proposta && dati.aggiunta === true) return json(403, { errore: 'solo autori dei casi' });
    // aggiunta di immagini a un caso esistente: solo file di serie nuove (serie.json lo scrive il server)
    const aggiunta = dati.aggiunta === true;
    if (caso && !aggiunta) return json(409, { errore: `Il caso ${id} esiste già: scegli un altro codice.` });
    if (!caso && aggiunta) return json(404, { errore: 'caso non trovato' });
    const files = Array.isArray(dati.files) ? dati.files : [];
    if (aggiunta && files.some((f) => f === 'serie.json')) return json(400, { errore: 'serie.json non si carica in aggiunta' });
    if (aggiunta) {                                                // mai sovrascrivere immagini già nel caso
      const esistenti = new Set(((M.leggiSerie ? await M.leggiSerie(id) : null) || []).flatMap((x) => x.files || []));
      if (files.some((f) => esistenti.has(f))) return json(409, { errore: 'alcuni file esistono già nel caso' });
    }
    if (!files.length || files.length > 300) return json(400, { errore: 'da 1 a 300 file per richiesta' });
    const urls = {};
    for (const f of files) {
      if (typeof f !== 'string' || !PERCORSO_OK.test(f)) return json(400, { errore: `percorso non valido: ${String(f).slice(0, 80)}` });
      urls[f] = cfg.firmaCaricamento(`casi/${id}/${f}`);
    }
    return json(200, { urls });
  }
  if (metodo === 'POST' && azione === '' && !caso && proposta) {  // proposta: bozza con i dati scritti dall'iscritto
    const serie = M.leggiSerie ? await M.leggiSerie(id).catch(() => null) : null;
    if (!Array.isArray(serie) || !serie.length) return json(400, { errore: 'carica prima le immagini' });
    const descr = String(dati.descrizione || '').trim();
    if (descr.length < 20) return json(400, { errore: 'Descrivi cosa mostra l\'esame (almeno una riga).' });
    if (dati.dichiarazione !== true) return json(400, { errore: 'Serve la dichiarazione su anonimato e autorizzazione.' });
    const base = pulisciCaso(id, { titolo: dati.titolo, quesito: dati.quesito, anamnesi: dati.anamnesi, modalita: dati.modalita, distretto: dati.distretto, opzioni: [],
      domanda: 'Quali dei seguenti reperti sono presenti in questo esame? (seleziona tutte le risposte corrette)',
      nota_docente: `PROPOSTA DA CONTROLLARE (${io.nome || 'iscritto'}, ${ora16()}): anonimato delle immagini, reperti e domande da scrivere.\n\nDescrizione dell'iscritto:\n${descr.slice(0, 4000)}` });
    await M.scriviCaso(id, { ...base, visibile: false, proposta: { da: io.id, nome: io.nome || '', data: ora16(), stato: 'in attesa', descrizione: descr.slice(0, 4000) } });
    return json(200, { ok: true, creato: true, proposta: true });
  }
  if (metodo === 'POST' && azione === '' && !caso) {              // creazione (dopo il caricamento)
    if (!autore) return json(403, { errore: 'solo autori dei casi' });
    await M.scriviCaso(id, pulisciCaso(id, dati));
    if (M.ripristinaCodice) await M.ripristinaCodice(id);         // un codice già eliminato torna utilizzabile
    return json(200, { ok: true, creato: true });
  }
  if (!caso || (!autore && !visibile(caso))) return json(404, { errore: 'caso non trovato' });
  // eliminazione (docenti): immagini cancellate, domande archiviate, risultati conservati
  if (metodo === 'POST' && azione === 'elimina') {
    if (!autore) return json(403, { errore: 'solo autori dei casi' });
    if (dati.conferma !== id) return json(400, { errore: 'conferma mancante' });
    const n = await M.eliminaCaso(id, { caso, da: io.nome || io.id, quando: ora16() });
    return json(200, { ok: true, immagini: n });
  }

  // immagini di un caso esistente: serie aggiunte (file già caricati con gli URL firmati) e immagini tolte.
  // Gli indici delle serie usati dal caso (serie iniziale, riquadri, nascoste, sezioni, vista del reperto)
  // vengono riallineati; le immagini tolte sono cancellate. Il Mac le riprende alla prossima pubblicazione.
  if (metodo === 'POST' && azione === 'immagini') {
    if (!autore) return json(403, { errore: 'solo autori dei casi' });
    if (!M.leggiSerie || !M.scriviSerie) return json(501, { errore: 'non disponibile' });
    const serie = await M.leggiSerie(id);
    if (!Array.isArray(serie)) return json(409, { errore: 'elenco delle serie non trovato' });
    const fileOk = (f) => typeof f === 'string' && f !== 'serie.json' && PERCORSO_OK.test(f);
    const togli = new Set((Array.isArray(dati.togli) ? dati.togli : []).filter(fileOk));
    const esistenti = new Set(serie.flatMap((x) => x.files || []));
    const nuove = (Array.isArray(dati.aggiungi) ? dati.aggiungi : []).slice(0, 100).map((x) => ({
      descrizione: String(x?.descrizione || 'Serie aggiunta').slice(0, 200), numero: Number.isFinite(+x?.numero) ? Math.trunc(+x.numero) : 0,
      files: (Array.isArray(x?.files) ? x.files : []).filter((f) => fileOk(f) && !esistenti.has(f)).slice(0, 5000),
      ...(x?.regione ? { regione: String(x.regione).slice(0, 40) } : {}), ...(x?.data ? { data: String(x.data).slice(0, 20) } : {}),
      ...(Number.isFinite(+x?.eta) && x?.eta !== null && x?.eta !== '' ? { eta: Math.trunc(+x.eta) } : {}), ...(Number.isFinite(+x?.suv) && +x.suv > 0 ? { suv: +x.suv } : {}),
    })).filter((x) => x.files.length);
    // intervalli tra gli studi (ore dal primo), ricalcolati nel browser dai DICOM originali: solo numeri
    const tempi = dati.tempi && typeof dati.tempi === 'object' ? Object.entries(dati.tempi).filter(([i, h]) => /^\d+$/.test(i) && +i < serie.length && Number.isFinite(+h) && +h >= 0 && +h < 24 * 365 * 30) : [];
    for (const [i, h] of tempi) serie[+i] = { ...serie[+i], ore: Math.round(+h * 10) / 10 };
    if (!togli.size && !nuove.length) {
      if (!tempi.length) return json(400, { errore: 'nessuna modifica' });
      await M.scriviSerie(id, serie);
      if (M.segnaModificaImmagini) await M.segnaModificaImmagini(id, ora16());
      return json(200, { ok: true, tempi: tempi.length });
    }
    const mappa = [], tolteIn = [], risultato = [];
    serie.forEach((x, i) => {
      const files = (x.files || []).filter((f) => !togli.has(f));
      tolteIn[i] = (x.files || []).map((f) => togli.has(f));
      if (!files.length) { mappa[i] = -1; return; }
      mappa[i] = risultato.length; risultato.push({ ...x, files });
    });
    risultato.push(...nuove);
    if (!risultato.length) return json(400, { errore: 'il caso resterebbe senza immagini: per eliminarlo usa «Elimina caso»' });
    const nuovoIdx = (i) => (Number.isInteger(i) && i >= 0 && i < mappa.length ? mappa[i] : i);
    const c = { ...caso };
    if (Number.isInteger(c.serie_iniziale)) { const k = nuovoIdx(c.serie_iniziale); c.serie_iniziale = k >= 0 ? k : null; }
    for (const campo of ['disposizione', 'serie_nascoste']) if (Array.isArray(c[campo])) c[campo] = c[campo].map(nuovoIdx).filter((k) => k >= 0);
    if (Array.isArray(c.sezioni)) c.sezioni = c.sezioni.map((z) => { if (!Number.isInteger(z.serie)) return z; const k = nuovoIdx(z.serie); const { serie: _, ...r } = z; return k >= 0 ? { ...r, serie: k } : r; });
    if (c.vista && Number.isInteger(c.vista.serie)) {
      const vs = c.vista.serie, k = nuovoIdx(vs), tolte = tolteIn[vs] || [];
      if (k < 0 || tolte[c.vista.idx]) { delete c.vista; delete c.localizza; }
      else c.vista = { ...c.vista, serie: k, idx: c.vista.idx - tolte.slice(0, c.vista.idx).filter(Boolean).length };
    }
    // immagini aggiunte a una proposta non ancora pubblicata: il controllo dell'anonimato va rifatto
    if (nuove.length && c.proposta?.controllo && c.proposta.stato !== 'approvata') { const { controllo: _c, ...pr } = c.proposta; c.proposta = pr; }
    await M.scriviSerie(id, risultato);
    await M.scriviCaso(id, c);
    if (togli.size && M.cancellaFile) await M.cancellaFile(id, [...togli]);
    if (M.segnaModificaImmagini) await M.segnaModificaImmagini(id, ora16());
    return json(200, { ok: true, serie: risultato.length, aggiunte: nuove.reduce((n, x) => n + x.files.length, 0), tolte: togli.size });
  }

  // cookie «qc» per le immagini del caso (la guardia di CloudFront lo chiede a tutti tranne l'amministratore):
  // per gli autori tutte le serie, per gli altri senza le serie nascoste
  const cookieImmagini = async () => {
    if (admin) return {};
    const nasc = !autore && Array.isArray(caso.serie_nascoste) ? caso.serie_nascoste : [];
    const serie = nasc.length && M.leggiSerie ? await M.leggiSerie(id).catch(() => null) : null;
    const val = cookieCaso(cfg.segreto, id, nasc.length ? cartelleNascoste(serie, nasc) : []);
    return { 'set-cookie': `qc=${val}; Path=/casi/${id}; Max-Age=${DURATA}; ${opzCookie.replace(/^Path=\/; /, "")}` };
  };
  if (metodo === 'GET' && azione === '') {
    const { spiegazione, opzioni, vista, titolo_interno, nota_docente, localizza, scale, lezione, esito_clinico, proposta, regola, rassegna, fonte, comunicazione, ...resto } = caso;
    if (comunicazione && (autore || docente)) resto.comunicazione = comunicazione;
    // fonte delle immagini: prima della risposta solo archivio e licenza (agli autori e ai docenti tutto)
    if (fonte) resto.fonte = autore || docente ? fonte : { archivio: fonte.archivio, ...(fonte.licenza ? { licenza: fonte.licenza } : {}), ...(fonte.licenza_url ? { licenza_url: fonte.licenza_url } : {}) };
    // scale: lo studente sa quali compilare, il risultato del docente arriva con la correzione (gli autori lo vedono subito)
    if (Array.isArray(scale) && scale.length) { resto.scaleRichieste = scale.map((x) => x.id); if (autore || docente) resto.scale = scale; }   // vista e titolo con la diagnosi: solo dopo la risposta / agli autori
    // domanda sulla figura: allo studente si dice solo in quale serie indicare il reperto
    if (localizza && vista?.segno) resto.localizza = { serie: vista.serie };
    return json(200, { ...resto, id, opzioni: (opzioni || []).map((o) => ({ testo: o.testo, ...(Number.isInteger(o.sezione) ? { sezione: o.sezione } : {}) })) }, await cookieImmagini());
  }
  if (metodo === 'GET' && azione === 'completo') {
    if (!autore) return json(403, { errore: 'solo autori dei casi' });
    return json(200, { ...caso, id }, await cookieImmagini());
  }
  // «Cerca l'errore» (6): referto fatto con i reperti attesi, con una frase sostituita da un distrattore della stessa
  // sezione o un reperto tolto. Solo sui casi a cui si è già risposto (la soluzione viaggia con l'esercizio).
  if (metodo === 'GET' && azione === 'errore') {
    if (!caso || (!autore && !visibile(caso))) return json(404, { errore: 'caso non trovato' });
    if (!autore && !(await M.risultati()).some((r) => r.account === io.id && String(r.caso) === id)) return json(403, { errore: 'rispondi prima al caso' });
    const opz = caso.opzioni || [], sez = caso.sezioni || [];
    const zc = sez.findIndex((z) => /conclusion/i.test(z.nome || '')), zt = sez.findIndex((z) => /tecnica/i.test(z.nome || ''));
    const giuste = opz.map((o, i) => ({ ...o, i })).filter((o) => o.corretta);
    const distr = opz.filter((o) => !o.corretta);
    const candidati = giuste.filter((o) => o.sezione !== zc && o.sezione !== zt && (sez.length ? distr.some((d) => d.sezione === o.sezione) : distr.length));
    if (giuste.length < 3 || !candidati.length || distr.length < 2) return json(422, { errore: 'caso non adatto' });
    const caso1 = (l) => l[Math.floor(Math.random() * l.length)];
    const pref = candidati.filter((o) => o.tipo === 'principale' || tipoOpzione(opz, o.i) === 'principale');
    const bersaglio = Math.random() < 0.4 && pref.length ? caso1(pref) : caso1(candidati);
    const tipo = Math.random() < 0.6 ? 'sbagliata' : 'manca';
    const stessaSez = distr.filter((d) => !sez.length || d.sezione === bersaglio.sezione);
    const inserito = caso1(stessaSez);
    const altri = distr.filter((d) => d !== inserito).sort(() => Math.random() - 0.5).slice(0, 2).map((d) => d.testo);
    const ordine = (o) => (Number.isInteger(o.sezione) ? o.sezione : 0);
    const frasi = giuste.filter((o) => tipo === 'sbagliata' || o !== bersaglio).sort((a, b) => ordine(a) - ordine(b) || a.i - b.i)
      .map((o) => ({ testo: o === bersaglio ? inserito.testo : o.testo, sezione: sez[ordine(o)]?.nome || '', ...(o === bersaglio ? { errata: true } : {}) }));
    return json(200, { id, titolo: caso.titolo, modalita: caso.modalita || '', anamnesi: String(caso.anamnesi || '').slice(0, 600), tipo, frasi,
      giusta: bersaglio.testo, sbagliata: tipo === 'sbagliata' ? inserito.testo : null,
      alternative: [bersaglio.testo, ...(tipo === 'sbagliata' ? altri : [inserito.testo, ...altri.slice(0, 1)])].sort(() => Math.random() - 0.5) });
  }
  // risultato di «cerca l'errore»: salvato per lo storico personale e per il docente (riepilogo mensile)
  if (metodo === 'POST' && azione === 'errore') {
    if (!caso || (!autore && !visibile(caso))) return json(404, { errore: 'caso non trovato' });
    if (!autore && !(await M.risultati()).some((r) => r.account === io.id && String(r.caso) === id)) return json(403, { errore: 'rispondi prima al caso' });
    const tipo = dati.tipo === 'manca' ? 'manca' : 'sbagliata', trovata = tipo === 'sbagliata' && dati.trovata === true, corretta = dati.corretta === true;
    const e = { account: io.id, nome: io.nome || '', caso: id, tipo, ...(tipo === 'sbagliata' ? { trovata } : {}), corretta,
      punti: tipo === 'manca' ? (corretta ? 100 : 0) : (trovata ? 50 : 0) + (corretta ? 50 : 0), data: ora16() };
    const salva = !admin && !!M.scriviErrore;
    if (salva) await M.scriviErrore(e);
    return json(200, { ...e, salvato: salva });
  }
  if (metodo === 'POST' && azione === 'risposta') {
    const soloReferto = dati.modo === 'referto';
    if (caso.scelte === false && !soloReferto) return json(400, { errore: 'In questo caso si risponde solo scrivendo il referto.' });
    const r = valuta(caso, soloReferto ? [] : dati.scelte);
    // comunicazione dell'esito (esiti critici): valutata solo se il docente l'ha indicata nel caso
    if (caso.comunicazione) r.comunicazione = valutaComunicazione(caso.comunicazione, pulisciComunicazioneFatta(dati.dettagli?.comunicazione), String(dati.dettagli?.referto || ''));
    if (soloReferto) {
      const testoRef = String(dati.dettagli?.referto || '').slice(0, 4000);
      if (togliModello(testoRef).length < 40) return json(400, { errore: 'Scrivi il referto (almeno qualche riga).' });
      const vr = valutaReferto(caso, testoRef);
      r.punteggio = vr.punteggio; r.perfetta = false; r.refertoAuto = vr; r.modo = 'referto';
    }
    // domanda sulla figura: la localizzazione pesa il 20% del punteggio e serve per la risposta perfetta
    const loc = caso.localizza ? valutaPunto(caso.vista, dati.punto) : null;
    if (loc) {
      r.localizzazione = loc;
      r.punteggio = Math.round(r.punteggio * 0.8 + (loc.esito === 'centrato' ? 20 : loc.esito === 'vicino' ? 10 : 0));
      r.perfetta = r.perfetta && loc.esito === 'centrato';
    }
    // confronto automatico del referto con i reperti attesi (anche quello facoltativo): resta per il docente
    const testoLibero = String(dati.dettagli?.referto || '').slice(0, 4000);
    const vrL = r.refertoAuto || (togliModello(testoLibero).length >= 40 ? valutaReferto(caso, testoLibero) : null);
    const valutazioneRef = vrL ? { punteggio: vrL.punteggio, citati: vrL.citati, attesi: vrL.attesi, mancati: vrL.mancati.slice(0, 20), errori: vrL.errori.slice(0, 10) } : null;
    const opz = caso.opzioni || [];
    const sic = dati.sicurezza && typeof dati.sicurezza === 'object' ? dati.sicurezza : {};
    // istantanea delle opzioni: l'analisi resta corretta anche se il docente modifica il caso dopo
    const istantanea = soloReferto ? [] : opz.map((o, i) => ({ t: o.testo, tipo: tipoOpzione(opz, i), s: r.esito[i].stato === 'corretta' || r.esito[i].stato === 'errata',
      ...(LIVELLI_SICUREZZA.includes(sic[i]) ? { conf: sic[i] } : {}), ...(Number.isInteger(o.sezione) ? { z: o.sezione } : {}) }));
    const tentativo = await M.contaTentativo(io.id, id);
    const prima = await M.risultati().catch(() => null);         // per i punti: risultati prima di questa risposta
    const riga = { data: ora16(), nome: io.nome, account: io.id, ruolo: io.ruolo, caso: id,
      punteggio: r.punteggio, perfetta: r.perfetta, scelte: r.scelteTesti.join(' | '),
      tentativo, opzioni: istantanea, dettagli: { ...pulisciDettagli(dati.dettagli), ...(soloReferto ? { modo: 'referto' } : {}), ...(valutazioneRef ? { valutazione: valutazioneRef } : {}), ...(r.comunicazione ? { valComunicazione: { punteggio: r.comunicazione.punteggio, atteso: r.comunicazione.atteso, fatto: r.comunicazione.fatto } } : {}) }, ...(loc ? { loc: loc.esito } : {}) };
    await M.salvaRisultato(riga); cacheStat = null;
    const { scelteTesti, ...pubblico } = r;
    if (caso.vista) pubblico.vista = caso.vista;
    if (caso.lezione) pubblico.lezione = caso.lezione;
    if (caso.regola) pubblico.regola = caso.regola;
    // altri casi con lo stesso segno: solo quelli pubblicati, con il titolo che vedono gli studenti
    if (caso.rassegna?.length) {
      const altri = await Promise.all(caso.rassegna.map((x) => M.leggiCaso(x.caso).catch(() => null)));
      pubblico.rassegna = caso.rassegna.map((x, k) => (altri[k] && altri[k].visibile !== false ? { ...x, titolo: altri[k].titolo || x.caso, ...(altri[k].modalita === 'Vetrini' ? { vetrino: true } : {}) } : null)).filter(Boolean);
    }
    if (caso.esito_clinico) pubblico.esitoClinico = caso.esito_clinico;
    if (caso.fonte) pubblico.fonte = caso.fonte;
    if (Array.isArray(caso.scale) && caso.scale.length) pubblico.scale = caso.scale;
    if (prima) {
      const mie = prima.filter((x) => x.account === io.id && String(x.data) <= riga.data);
      const p0 = progressi(mie, io.id), p1 = progressi([...mie, riga], io.id);
      const primoTentativo = !mie.some((x) => String(x.caso) === id);
      pubblico.gioco = { guadagnati: primoTentativo ? p1.ultimi : 0, primoTentativo, punti: p1.punti, livello: p1.livello,
        serie: p1.serie, migliore: p1.migliore, salito: p1.livello.n > p0.livello.n };
    }
    return json(200, pubblico);
  }
  // testo del caso di riferimento per la correzione del referto con il modello open source nel browser (refertolocale.js):
  // solo se l'amministratore l'ha attivata e solo dopo aver risposto al caso (autori e docenti sempre)
  if (metodo === 'GET' && azione === 'atteso') {
    const imp = (M.leggiImpostazioni ? await M.leggiImpostazioni().catch(() => null) : null) || {};
    if (imp.refertoLocale !== true && !admin) return json(403, { errore: 'correzione nel browser non attiva' });
    if (!autore && !docente && !(await M.tentativi(io.id, id))) return json(403, { errore: 'prima rispondi al caso' });
    return json(200, { testo: casoAtteso(caso).slice(0, 7000), ...vociReferto(caso) });
  }
  // scala di riferimento del caso: compilata dal docente nel pannello Σ («Salva come risposta del caso»)
  if (metodo === 'POST' && azione === 'scala') {
    if (!autore && !docente) return json(403, { errore: 'solo docenti' });
    const altre = (caso.scale || []).filter((x) => x.id !== (dati.rimuovi || dati.scala?.id));
    const nuova = dati.rimuovi ? [] : pulisciScale([dati.scala]);
    if (!dati.rimuovi && !nuova.length) return json(400, { errore: 'scala non valida' });
    const scale = [...altre, ...nuova];
    const c = { ...caso }; if (scale.length) c.scale = scale; else delete c.scale;
    await M.scriviCaso(id, c);
    return json(200, { ok: true, scale });
  }
  if (metodo === 'POST' && azione === '') {
    if (!autore) return json(403, { errore: 'solo autori dei casi' });
    const nuovo = pulisciCaso(id, dati);
    // le funzioni del caso per gli studenti le decide solo l'amministratore: per gli altri autori restano come erano
    if (!admin) for (const f of ['anatomia', 'scelte', 'score']) { delete nuovo[f]; if (caso[f] === false) nuovo[f] = false; }
    if (caso.proposta && nuovo.visibile && caso.proposta.stato !== 'approvata' && caso.proposta.controllo?.esito !== 'ok')
      return json(400, { errore: 'Caso proposto da un iscritto: prima di pubblicarlo controlla l\'anonimato in Gestione → Revisione delle bozze.' });
    if (caso.proposta) nuovo.proposta = nuovo.visibile && caso.proposta.stato !== 'approvata'
      ? { ...caso.proposta, stato: 'approvata', esito: ora16(), docente: io.nome || '' } : caso.proposta;
    if (nuovo.visibile && (nuovo.opzioni.length < 2 || !nuovo.opzioni.some((o) => o.corretta))) {
      return json(400, { errore: 'Per renderlo visibile servono almeno 2 opzioni, di cui almeno una corretta. Puoi salvarlo come bozza.' });
    }
    await M.scriviCaso(id, nuovo);
    return json(200, { ok: true });
  }
  return json(404, { errore: 'percorso non valido' });
}
