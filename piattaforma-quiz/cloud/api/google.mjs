/* ============================================================
   Quiz Radiologia — accesso con Google e LinkedIn (OpenID Connect).
   Flusso «authorization code» con state e nonce (e PKCE dove il fornitore lo accetta: Google); nessuno script dei
   fornitori nella pagina: il browser va sul sito del fornitore e torna su /api/<fornitore>/ritorno.
   Il gettone d'identità (id_token) arriva direttamente dal fornitore al server, su TLS, in cambio del codice e del
   segreto del client: per OpenID Connect (Core 1.0, § 3.1.3.7) basta allora controllare emittente, destinatario,
   scadenza e nonce, senza verificare la firma. LinkedIn dà email e verifica dell'email solo da /userinfo.
   Dal fornitore si prendono solo: identificativo dell'account (sub), email verificata e nome.
   Lo stato del passaggio sta in un cookie firmato «qg» (Path=/api/<fornitore>, 10 minuti); chi entra per la prima
   volta riceve un cookie firmato «qn» (30 minuti) e completa l'iscrizione (condizioni, 18 anni) nella pagina.
   Il nome del file resta google.mjs (il primo fornitore, 22/11/2026).
   ============================================================ */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const FORNITORI = {
  google: { nome: 'Google', autorizza: 'https://accounts.google.com/o/oauth2/v2/auth', gettone: 'https://oauth2.googleapis.com/token',
    emittenti: ['https://accounts.google.com', 'accounts.google.com'], scope: 'openid email profile', pkce: true, nonce: true,
    extra: { prompt: 'select_account' } },
  linkedin: { nome: 'LinkedIn', autorizza: 'https://www.linkedin.com/oauth/v2/authorization', gettone: 'https://www.linkedin.com/oauth/v2/accessToken',
    userinfo: 'https://api.linkedin.com/v2/userinfo', emittenti: ['https://www.linkedin.com'], scope: 'openid profile email', pkce: false, nonce: false,
    extra: {} },
};
// compatibilità con la prima versione (solo Google)
export const AUTORIZZA = FORNITORI.google.autorizza;
export const GETTONE = FORNITORI.google.gettone;

const b64 = (b) => Buffer.from(b).toString('base64url');
const casuale = (n) => randomBytes(n).toString('base64url');

// valore firmato con scadenza: base64url(JSON).firma
export function firmato(segreto, etichetta, oggetto) {
  const v = b64(JSON.stringify(oggetto));
  return `${v}.${createHmac('sha256', segreto).update(`${etichetta}.${v}`).digest('base64url')}`;
}
export function leggiFirmato(segreto, etichetta, s, adesso = Date.now()) {
  const [v, f, resto] = String(s || '').split('.');
  if (!v || !f || resto !== undefined) return null;
  const a = Buffer.from(createHmac('sha256', segreto).update(`${etichetta}.${v}`).digest('base64url')), b = Buffer.from(f);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(v, 'base64url').toString('utf8')); return o && o.scad > adesso ? o : null; } catch { return null; }
}
export function leggiCookie(headers, nome) {
  const h = headers || {};
  const m = [h.cookie, h.Cookie].filter(Boolean).join('; ').match(new RegExp(`(?:^|;\\s*)${nome}=([^;]+)`));
  return m ? m[1] : '';
}
// pagina della piattaforma a cui tornare dopo l'accesso (solo indirizzi interni «#/…»)
export const dopoValido = (d) => (/^#\/[A-Za-z0-9/_.~%-]{0,200}$/.test(String(d || '')) ? String(d) : '#/');
const fornitore = (prov) => { const F = FORNITORI[prov]; if (!F) throw new Error('fornitore sconosciuto: ' + prov); return F; };

// inizio: indirizzo del fornitore e cookie con state, nonce e verificatore PKCE (u = account da collegare, dal profilo)
export function inizio(cfg, ritorno, dopo, adesso = Date.now(), prov = 'google', u = '') {
  const F = fornitore(prov), c = cfg[prov];
  const s = casuale(16), n = casuale(16), v = casuale(32);
  const q = new URLSearchParams({ response_type: 'code', client_id: c.id, redirect_uri: ritorno, scope: F.scope, state: s, nonce: n, ...F.extra });
  if (F.pkce) { q.set('code_challenge', createHash('sha256').update(v).digest('base64url')); q.set('code_challenge_method', 'S256'); }
  return { url: `${c.autorizza || F.autorizza}?${q}`, valore: firmato(cfg.segreto, 'qg', { s, n, v, d: dopoValido(dopo), ...(u ? { u } : {}), scad: adesso + 600000 }) };
}

// codice → affermazioni del gettone d'identità, completate da /userinfo dove serve (nei test cfg[prov].scambia le inventa)
export async function scambia(cfg, codice, verificatore, ritorno, prov = 'google') {
  const F = fornitore(prov), c = cfg[prov];
  if (c.scambia) return c.scambia(codice, verificatore, ritorno);
  const corpo = new URLSearchParams({ grant_type: 'authorization_code', code: codice, client_id: c.id, client_secret: c.segreto, redirect_uri: ritorno });
  if (F.pkce) corpo.set('code_verifier', verificatore);
  const r = await fetch(F.gettone, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: corpo, signal: AbortSignal.timeout(10000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || typeof j.id_token !== 'string') throw new Error(`${prov}: scambio non riuscito (${r.status} ${j.error || ''})`);
  const p = j.id_token.split('.');
  if (p.length !== 3) throw new Error(`${prov}: gettone malformato`);
  const aff = JSON.parse(Buffer.from(p[1], 'base64url').toString('utf8'));
  if (F.userinfo && j.access_token) {
    const u = await fetch(F.userinfo, { headers: { authorization: `Bearer ${j.access_token}` }, signal: AbortSignal.timeout(10000) });
    const ui = u.ok ? await u.json().catch(() => ({})) : {};
    if (ui.sub && ui.sub === aff.sub) for (const k of ['email', 'email_verified', 'name', 'given_name', 'family_name']) if (ui[k] !== undefined) aff[k] = ui[k];
  }
  return aff;
}

// controlli sulle affermazioni: emittente, destinatario, scadenza, nonce, email verificata
export function controllaAffermazioni(c, cfg, nonce, adesso = Date.now(), prov = 'google') {
  const F = fornitore(prov);
  if (!c || typeof c !== 'object') return 'gettone';
  if (!F.emittenti.includes(c.iss)) return 'emittente';
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(cfg[prov].id)) return 'destinatario';
  if (!(Number(c.exp) * 1000 > adesso)) return 'scaduto';
  // Google mette sempre il nonce; LinkedIn non lo documenta: se c'è deve coincidere
  if ((F.nonce || c.nonce !== undefined) && (!nonce || c.nonce !== nonce)) return 'nonce';
  if (typeof c.sub !== 'string' || !/^[0-9A-Za-z_-]{1,255}$/.test(c.sub)) return 'sub';
  if (c.email_verified !== true && c.email_verified !== 'true') return 'email';
  return '';
}
// l'email identifica l'account già esistente solo se il fornitore ne è il gestore: Google per Gmail o per un dominio
// Workspace («hd»). Per gli altri indirizzi, e per LinkedIn, un account può aver verificato l'email una volta e poi
// averla persa: si collega dal profilo, dopo essere entrati con la password
export const emailAutorevole = (c, prov = 'google') => prov === 'google' && (/@(gmail|googlemail)\.com$/i.test(String(c?.email || ''))
  || (typeof c?.hd === 'string' && c.hd.length > 0 && String(c.email || '').toLowerCase().endsWith('@' + c.hd.toLowerCase())));
