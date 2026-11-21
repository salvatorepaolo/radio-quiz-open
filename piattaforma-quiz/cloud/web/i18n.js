// Lingua dell'interfaccia: italiano (originale) o inglese.
// In inglese il testo della pagina si traduce con un dizionario IT → EN (lingua/en.json), generato dai testi
// di app.js e index.html; i segnaposto {x} coprono le frasi con valori variabili. Lo stesso dizionario traduce le
// risposte del server (/api/…) e i file di contenuto (aiuto, schede, percorsi, protocolli, modelli di referto),
// e i casi clinici con i file lingua/casi/<id>.json (coppie testo italiano → inglese, una per caso).
// Il testo scritto dall'utente (campi, editor del referto) non si tocca mai.
const CHIAVE = 'rq-lingua';
const leggiPref = () => { try { return localStorage.getItem(CHIAVE); } catch { return null; } };
const q = new URLSearchParams(location.search).get('lang');
export const LINGUA = (q === 'en' || q === 'it') ? q : (leggiPref() || ((navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en'));
if (q === 'en' || q === 'it') try { localStorage.setItem(CHIAVE, q); } catch {}
export const EN = LINGUA === 'en';
// la pagina va ricaricata: con un indirizzo che cambia solo dopo il «#» (per es. #/caso/locale nel visualizzatore)
// location.replace non ricarica, e la lingua restava quella di prima
export function cambiaLingua(l) {
  try { localStorage.setItem(CHIAVE, l); } catch {}
  const u = new URL(location.href);
  if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); location.replace(u.href); } else location.reload();
}
document.documentElement.lang = LINGUA;

const ESATTE = new Map(), PREFISSI = new Map(), SUFFISSI = new Map();
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function aggiungi(it, en) {
  if (!it || !en || it === en) return;
  if (!it.includes('{x}')) { ESATTE.set(it, en); return; }
  const parti = it.split('{x}');
  if (parti.every((p) => !p.trim())) return;                 // solo segnaposto: troppo generico
  const re = new RegExp('^' + parti.map(esc).join('([\\s\\S]*?)') + '$'), voce = { re, en };
  const pre = parti[0], suf = parti[parti.length - 1];
  if (pre.length >= 3) { const k = pre.slice(0, 3); (PREFISSI.get(k) || PREFISSI.set(k, []).get(k)).push(voce); }
  else if (suf.length >= 3) { const k = suf.slice(-3); (SUFFISSI.get(k) || SUFFISSI.set(k, []).get(k)).push(voce); }
}
// traduce una stringa intera (senza spazi esterni); null se non la conosce
export function tr(s) {
  if (!EN || !s) return null;
  const n = norm(s); if (!n) return null;
  const t = trIntera(n); if (t != null) return t;
  // frasi composte da pezzi («57 casi · 3 svolti», «Esame · 52 anni»): si traduce pezzo per pezzo
  if (n.includes(' · ')) { const p = n.split(' · '), q = p.map((x) => trIntera(x) ?? x); if (q.some((x, i) => x !== p[i])) return q.join(' · '); }
  return null;
}
function trIntera(n) {
  const e = ESATTE.get(n); if (e) return e;
  if (!/[a-zà-ú]{2}/i.test(n)) return null;
  for (const l of [PREFISSI.get(n.slice(0, 3)), SUFFISSI.get(n.slice(-3))]) {
    if (!l) continue;
    for (const v of l) {
      const m = n.match(v.re); if (!m) continue;
      let i = 1; return v.en.replace(/\{x\}/g, () => { const g = m[i++] ?? ''; return (g.length > 1 && g.length < n.length ? trSpazi(g) : null) ?? g; });
    }
  }
  return null;
}
// stringa con gli spazi esterni conservati
const trSpazi = (s) => { const t = tr(s); return t == null ? null : s.match(/^\s*/)[0] + t + s.match(/\s*$/)[0]; };
// dati (JSON) dei casi: solo i testi dei casi (titoli, anamnesi, opzioni, spiegazioni…), mai i valori brevi che il
// programma confronta (modalità, distretto, ruolo): quelli si traducono solo quando compaiono nella pagina
const TESTI_CASI = new Map();
export function trDati(x, prof = 0) {
  if (!EN || prof > 30) return x;
  if (typeof x === 'string') return TESTI_CASI.get(norm(x)) ?? x;
  if (Array.isArray(x)) return x.map((y) => trDati(y, prof + 1));
  if (x && typeof x === 'object') { const o = {}; for (const [k, v] of Object.entries(x)) o[k] = /^(id|codice|caso|email|url|nome_file|serie|uid|quesito|modalita|distretto|difficolta|ruolo|tipo)$/i.test(k) ? v : trDati(v, prof + 1); return o; }
  return x;
}

// ---- casi: coppie IT → EN caricate quando servono
const CASI = new Map();
export function caricaCaso(id) {
  if (!EN || !/^[\w-]{1,80}$/.test(id || '')) return Promise.resolve();
  if (!CASI.has(id)) CASI.set(id, origFetch(`/lingua/casi/${id}.json`).then((r) => (r.ok ? r.json() : {})).then((c) => { for (const [a, b] of Object.entries(c)) if (a && b) { ESATTE.set(norm(a), b); TESTI_CASI.set(norm(a), b); } }).catch(() => {}));
  return CASI.get(id);
}

// ---- pagina: nodi di testo e attributi
const ATTR = ['title', 'placeholder', 'aria-label', 'alt'];
const FATTI = new WeakMap();    // nodo → testo inglese messo da qui (per non ritradurre)
const escluso = (el) => !el || el.closest?.('script,style,textarea,[contenteditable="true"],.no-tr,[data-no-tr]');
function testo(n) {
  if (FATTI.get(n) === n.data) return;
  const t = trSpazi(n.data); if (t != null && t !== n.data) { n.data = t; FATTI.set(n, t); }
}
function elemento(el) {
  for (const a of ATTR) { const v = el.getAttribute?.(a); if (v && FATTI.get(el)?.[a] !== v) { const t = tr(v); if (t) { el.setAttribute(a, t); (FATTI.get(el) || FATTI.set(el, {}).get(el))[a] = t; } } }
  if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) { const t = tr(el.value); if (t) el.value = t; }
}
export function traduciAlbero(radice) {
  if (!EN || !radice) return;
  if (radice.nodeType === 3) { if (!escluso(radice.parentElement)) testo(radice); return; }
  if (radice.nodeType !== 1 && radice.nodeType !== 9 && radice.nodeType !== 11) return;
  if (radice.nodeType === 1) { if (escluso(radice)) return; elemento(radice); }
  const w = document.createTreeWalker(radice, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeType === 1 && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.tagName)) || (n.nodeType === 1 && (n.isContentEditable || n.classList.contains('no-tr'))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n = w.nextNode(); n; n = w.nextNode()) (n.nodeType === 3 ? testo(n) : elemento(n));
}

const origFetch = window.fetch.bind(window);
const CONTENUTI = /^\/?(aiuto|schede|percorsi|protocolli|modelli-referto)\.json$/;
if (EN) {
  document.documentElement.classList.add('lingua-attesa');
  try {
    const d = await origFetch('/lingua/en.json').then((r) => r.json());
    for (const [a, b] of Object.entries(d)) aggiungi(a, b);
  } catch (e) { console.warn('dizionario inglese non disponibile', e); }
  // risposte del server e file di contenuto
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin === location.origin && CONTENUTI.test(url.pathname.replace(/^\/client\//, '/'))) {
      const r = await origFetch('/lingua/en/' + url.pathname.split('/').pop(), init);
      if (r.ok) return r;
    }
    const r = await origFetch(input, init);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/') || !(r.headers.get('content-type') || '').includes('json')) return r;
    // si traduce solo ciò che si legge (casi per lo studente, correzioni, elenchi); mai i dati che l'editor
    // rimanda indietro (/completo), così un autore in inglese non salva testo inglese nel caso italiano
    const p = url.pathname, metodo = (init?.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    const caso = p.match(/^\/api\/casi\/([\w-]+)/)?.[1];
    const tutto = (metodo === 'GET' && (p === '/api/casi' || /^\/api\/casi\/[\w-]+(\/(atteso|errore))?$/.test(p) || /^\/api\/(esame|errori|percorsi|ripasso|consigli)/.test(p)))
      || (metodo === 'POST' && /^\/api\/casi\/[\w-]+\/(risposta|errore)$/.test(p));
    try {
      const j = await r.clone().json();
      let out;
      if (tutto) { if (caso) await caricaCaso(caso); await caricaCaso('_titoli'); out = trDati(j); }
      else if (j && typeof j === 'object' && !Array.isArray(j) && (j.errore || j.messaggio)) out = { ...j, ...(typeof j.errore === 'string' ? { errore: tr(j.errore) || j.errore } : {}), ...(typeof j.messaggio === 'string' ? { messaggio: tr(j.messaggio) || j.messaggio } : {}) };
      else return r;
      return new Response(JSON.stringify(out), { status: r.status, statusText: r.statusText, headers: r.headers });
    } catch { return r; }
  };
  for (const k of ['alert', 'confirm', 'prompt']) { const f = window[k].bind(window); window[k] = (m, ...a) => f(typeof m === 'string' ? (m.split('\n').map((r) => trSpazi(r) ?? r).join('\n')) : m, ...a); }
  const avvia = () => {
    // manuale del client in inglese
    document.querySelectorAll('a[href="/client/manuale-client.html"]').forEach((a) => { a.href = '/client/manuale-client.en.html'; });
    // pagina sulla qualità del software in inglese
    document.querySelectorAll('a[href="/qualita.html"]').forEach((a) => { a.href = '/qualita.en.html'; });
    traduciAlbero(document.body); document.title = tr(document.title) || document.title;
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'childList') m.addedNodes.forEach((n) => traduciAlbero(n));
        else if (m.type === 'characterData') { if (!escluso(m.target.parentElement)) testo(m.target); }
        else if (m.type === 'attributes' && !escluso(m.target)) elemento(m.target);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
    new MutationObserver(() => { const t = tr(document.title); if (t && t !== document.title) document.title = t; }).observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true });
    document.documentElement.classList.remove('lingua-attesa');
  };
  if (document.body) avvia(); else document.addEventListener('DOMContentLoaded', avvia);
  setTimeout(() => document.documentElement.classList.remove('lingua-attesa'), 3000);
}

// pulsante IT / EN nella barra in alto (mostra la lingua in cui si passa)
{ const b = document.getElementById('btn-lingua');
  if (b) { b.textContent = EN ? 'IT' : 'EN'; b.title = EN ? 'Passa all\'italiano' : 'Switch to English'; b.setAttribute('aria-label', b.title); b.onclick = () => cambiaLingua(EN ? 'it' : 'en'); } }
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__i18n = { tr, traduciAlbero, n: () => ESATTE.size };
