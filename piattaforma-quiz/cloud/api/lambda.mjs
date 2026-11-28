/* Quiz Radiologia — funzione Lambda (Function URL, payload 2.0).
   I casi stanno nel bucket privato BUCKET_DATI (casi/<id>/caso.json),
   i risultati nella tabella DynamoDB TABELLA. */
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, QueryCommand, GetItemCommand, DeleteItemCommand, UpdateItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { CloudFrontClient, ListDistributionsCommand } from '@aws-sdk/client-cloudfront';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { CodeBuildClient, StartBuildCommand, BatchGetBuildsCommand } from '@aws-sdk/client-codebuild';
import { gestisci, promemoria } from './logica.mjs';
import { urlFirmato } from './firma.mjs';

const s3 = new S3Client({});
const db = new DynamoDBClient({});
const ses = new SESv2Client({});
const { BUCKET_DATI, BUCKET_SITO, TABELLA, HASH_ADMIN, SEGRETO, SEGRETO_ORIGINE, AWS_REGION, MITTENTE, INDIRIZZO, RISPONDI_A } = process.env;
// accesso con Google (facoltativo): client OAuth della console di Google Cloud, da GOOGLE_ID e GOOGLE_SEGRETO in .segreti
const { GOOGLE_ID, GOOGLE_SEGRETO, LINKEDIN_ID, LINKEDIN_SEGRETO } = process.env;
// istanza: «vetrina» (radio-quiz.it) o «azienda» (piattaforma di un'azienda, accesso solo su invito)
const ISTANZA = { modo: process.env.MODO || 'vetrina', nome: process.env.NOME_ISTANZA || '', contatto: process.env.CONTATTO || '',
  utentiMax: process.env.UTENTI_MAX || '', scadenza: process.env.SCADENZA || '', sospesa: process.env.SOSPESA === '1',
  // sponsor nella vetrina (21/11/2026): spenti salvo SPONSOR=1 (portale open source a scopo educativo)
  sponsor: process.env.SPONSOR !== '0' };
// avvisi per email (Amazon SES): attivi solo se la pubblicazione ha configurato il mittente
// nome del mittente con lettere accentate (es. il nome dell'azienda): codificato come vuole lo standard delle email (RFC 2047)
const MITT = MITTENTE && /[^\x20-\x7e]/.test(MITTENTE) ? MITTENTE.replace(/^(.*?)\s*<([^>]+)>$/, (_, n, e) => `=?UTF-8?B?${Buffer.from(n, 'utf8').toString('base64')}?= <${e}>`) : MITTENTE;
const inviaEmail = MITTENTE ? (a, oggetto, { testo, html }) => ses.send(new SendEmailCommand({ FromEmailAddress: MITT, Destination: { ToAddresses: [a] },
  ...(RISPONDI_A ? { ReplyToAddresses: [RISPONDI_A] } : {}),
  Content: { Simple: { Subject: { Data: oggetto, Charset: 'UTF-8' }, Body: { Text: { Data: testo, Charset: 'UTF-8' }, Html: { Data: html, Charset: 'UTF-8' } } } } })) : null;
// creazione delle piattaforme dei clienti (vetrina): lavoro AWS CodeBuild che esegue crea-tenant.sh
const PROGETTO = process.env.PROGETTO_CREAZIONE;
const cb = PROGETTO ? new CodeBuildClient({}) : null;
const creazione = PROGETTO ? {
  avvia: async ({ id, azione, tenant, token }) => (await cb.send(new StartBuildCommand({ projectName: PROGETTO, environmentVariablesOverride: [
    { name: 'TENANT_ID', value: id, type: 'PLAINTEXT' }, { name: 'AZIONE', value: azione, type: 'PLAINTEXT' },
    { name: 'TENANT_JSON', value: JSON.stringify(tenant), type: 'PLAINTEXT' }, { name: 'ESITO_TOKEN', value: token, type: 'PLAINTEXT' }] }))).build?.id || '',
  stato: async (ids) => { if (!ids.length) return {}; const r = await cb.send(new BatchGetBuildsCommand({ ids })); return Object.fromEntries((r.builds || []).map((b) => [b.id, b.buildStatus])); },
} : null;
// URL firmato (1 ora) per caricare un file del caso direttamente dal browser del docente
const firmaCaricamento = (chiave) => urlFirmato({ bucket: BUCKET_SITO, regione: AWS_REGION, chiave, credenziali: {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, sessionToken: process.env.AWS_SESSION_TOKEN } });

// account: pk "ACCOUNT", sk = id
// i dati dell'iscrizione (impronta della password, categoria, docenti scelti, gettoni di conferma…) stanno in «dati» (JSON)
const EXTRA = ['pw', 'categoria', 'sede', 'anno', 'docenti', 'stato', 'conferma', 'reset', 'noDocente', 'avvisi', 'errori', 'bloccatoFino', 'ultimoInvio', 'privacy', 'condizioni', 'sessioneDa', 'avvisoInattivo', 'google', 'linkedin', 'sfide', 'revisore', 'settimana', 'settimanaInviata', 'avvisoRevisore'];   // 27/11: revisore dei casi, caso della settimana per email
const daItem = (i) => {
  if (!i) return i;
  let extra = {};
  try { extra = i.dati?.S ? JSON.parse(i.dati.S) : {}; } catch {}
  return { id: i.sk.S, nome: i.nome?.S || '', ruolo: i.ruolo?.S || 'specializzando', hash: i.hash?.S || '',
    attivo: i.attivo?.BOOL !== false, creato: i.creato?.S || '', ultimoAccesso: i.ultimoAccesso?.S || '',
    azienda: i.azienda?.S || '', email: i.email?.S || '', autore: !!i.autore?.BOOL, ...extra };
};
async function interroga(pk) {
  const out = [];
  let start;
  do {
    const r = await db.send(new QueryCommand({ TableName: TABELLA, KeyConditionExpression: 'pk = :p', ConsistentRead: true,
      ExpressionAttributeValues: { ':p': { S: pk } }, ExclusiveStartKey: start }));
    out.push(...(r.Items || []));
    start = r.LastEvaluatedKey;
  } while (start);
  return out;
}

async function leggiJSON(chiave) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET_DATI, Key: chiave }));
    return JSON.parse(await r.Body.transformToString());
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

const CACHE_CASI = new Map();   // id → { etag, caso }
const magazzino = {
  // con molti casi non si rileggono tutti i caso.json a ogni richiesta: la funzione, finché resta calda, li tiene in
  // memoria e rilegge da S3 solo quelli con l'ETag cambiato (l'elenco degli oggetti costa una richiesta ogni 1000)
  async elencoCasi() {
    const voci = [];
    let token;
    do {
      const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_DATI, Prefix: 'casi/', ContinuationToken: token }));
      for (const o of r.Contents || []) {
        const m = o.Key.match(/^casi\/([^/]+)\/caso\.json$/);
        if (m) voci.push([m[1], o.ETag]);
      }
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    voci.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const casi = await Promise.all(voci.map(async ([id, etag]) => {
      const m = CACHE_CASI.get(id);
      if (m && m.etag === etag) return m.caso;
      const caso = { ...(await leggiJSON(`casi/${id}/caso.json`)), id };
      CACHE_CASI.set(id, { etag, caso });
      return caso;
    }));
    for (const id of CACHE_CASI.keys()) if (!voci.some(([k]) => k === id)) CACHE_CASI.delete(id);
    // copie: chi modifica un caso dell'elenco non deve cambiare quello in memoria
    return casi.map((c) => structuredClone(c));
  },
  leggiCaso: (id) => leggiJSON(`casi/${id}/caso.json`),
  scriviCaso: (id, caso) => s3.send(new PutObjectCommand({
    Bucket: BUCKET_DATI, Key: `casi/${id}/caso.json`,
    Body: JSON.stringify(caso, null, 2), ContentType: 'application/json; charset=utf-8',
  })),
  salvaRisultato: (r) => db.send(new PutItemCommand({
    TableName: TABELLA,
    Item: {
      pk: { S: 'RISULTATO' }, sk: { S: `${new Date().toISOString()}#${randomBytes(4).toString('hex')}` },
      data: { S: r.data }, nome: { S: r.nome || '' }, account: { S: r.account || '' }, ruolo: { S: r.ruolo || '' },
      caso: { S: r.caso }, punteggio: { N: String(r.punteggio) }, perfetta: { BOOL: !!r.perfetta }, scelte: { S: r.scelte || '' },
      tentativo: { N: String(r.tentativo || 1) },
      opzioni: { S: JSON.stringify(r.opzioni || []) }, dettagli: { S: JSON.stringify(r.dettagli || {}) },
      ...(r.loc ? { loc: { S: r.loc } } : {}),
    },
  })),
  // numero progressivo del tentativo di questa persona su questo caso (1 = primo)
  async contaTentativo(account, caso) {
    const r = await db.send(new UpdateItemCommand({
      TableName: TABELLA, Key: { pk: { S: 'TENTATIVI' }, sk: { S: `${account}#${caso}` } },
      UpdateExpression: 'ADD #n :uno', ExpressionAttributeNames: { '#n': 'n' }, ExpressionAttributeValues: { ':uno': { N: '1' } }, ReturnValues: 'UPDATED_NEW',
    }));
    return Number(r.Attributes?.n?.N || 1);
  },
  async risultati() {
    const js = (x) => { try { return JSON.parse(x); } catch { return null; } };
    return (await interroga('RISULTATO')).map((i) => ({ data: i.data?.S, nome: i.nome?.S, account: i.account?.S || '', ruolo: i.ruolo?.S || '',
      caso: i.caso?.S, punteggio: Number(i.punteggio?.N || 0), perfetta: !!i.perfetta?.BOOL, scelte: i.scelte?.S,
      tentativo: i.tentativo?.N ? Number(i.tentativo.N) : null,
      opzioni: i.opzioni?.S ? js(i.opzioni.S) : null, dettagli: i.dettagli?.S ? js(i.dettagli.S) : null, ...(i.loc?.S ? { loc: i.loc.S } : {}), id: i.sk?.S || '' }));
  },
  // revisione del docente nei dettagli di una risposta (null la toglie)
  async revisionaRisultato(id, revisione) {
    const r = await db.send(new GetItemCommand({ TableName: TABELLA, Key: { pk: { S: 'RISULTATO' }, sk: { S: id } }, ConsistentRead: true }));
    if (!r.Item) return;
    let d = {}; try { d = JSON.parse(r.Item.dettagli?.S || '{}') || {}; } catch {}
    if (revisione) d.revisione = revisione; else delete d.revisione;
    await db.send(new UpdateItemCommand({ TableName: TABELLA, Key: { pk: { S: 'RISULTATO' }, sk: { S: id } },
      UpdateExpression: 'SET dettagli = :d', ExpressionAttributeValues: { ':d': { S: JSON.stringify(d) } } }));
  },
  elencoAccount: async () => (await interroga('ACCOUNT')).map(daItem),
  async leggiAccount(id) {
    // lettura consistente: un account appena disattivato o eliminato deve fermarsi subito
    const r = await db.send(new GetItemCommand({ TableName: TABELLA, Key: { pk: { S: 'ACCOUNT' }, sk: { S: id } }, ConsistentRead: true }));
    return daItem(r.Item) || null;
  },
  scriviAccount: (a) => db.send(new PutItemCommand({
    TableName: TABELLA,
    Item: {
      pk: { S: 'ACCOUNT' }, sk: { S: a.id }, nome: { S: a.nome }, ruolo: { S: a.ruolo }, hash: { S: a.hash },
      attivo: { BOOL: a.attivo !== false }, creato: { S: a.creato || '' }, ultimoAccesso: { S: a.ultimoAccesso || '' },
      azienda: { S: a.azienda || '' }, email: { S: a.email || '' }, autore: { BOOL: !!a.autore },
      dati: { S: JSON.stringify(Object.fromEntries(EXTRA.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]))) },
    },
  })),
  // account cancellato: i suoi risultati restano per le statistiche dei casi, senza nome
  async anonimizzaRisultati(id) {
    for (const i of await interroga('RISULTATO')) {
      if (i.account?.S !== id) continue;
      await db.send(new UpdateItemCommand({ TableName: TABELLA, Key: { pk: i.pk, sk: i.sk },
        UpdateExpression: 'SET nome = :n, account = :a', ExpressionAttributeValues: { ':n': { S: 'Account eliminato' }, ':a': { S: 'eliminato-' + id.slice(0, 4) } } }));
    }
    // esami simulati dell'account: cancellati (sono dati solo suoi)
    for (const i of await interroga('ESAME')) if (String(i.sk?.S || '').startsWith(id + '#')) await db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: i.pk, sk: i.sk } }));
    for (const i of await interroga('ERRORE')) if (String(i.sk?.S || '').startsWith(id + '#')) await db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: i.pk, sk: i.sk } }));
  },
  eliminaAccount: (id) => db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: { S: 'ACCOUNT' }, sk: { S: id } } })),
  // Elimina un caso: le domande vanno in eliminati/<id>/ (il bucket ha le versioni: si possono recuperare),
  // le immagini vengono cancellate. Il segno in eliminati/ dice a pubblica.command di non ricaricarlo.
  async eliminaCaso(id, { caso, da, quando }) {
    await s3.send(new PutObjectCommand({ Bucket: BUCKET_DATI, Key: `eliminati/${id}/caso.json`,
      Body: JSON.stringify({ ...caso, eliminato: { da, quando } }, null, 2), ContentType: 'application/json; charset=utf-8' }));
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_DATI, Key: `casi/${id}/caso.json` }));
    let token, n = 0;
    do {
      const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_SITO, Prefix: `casi/${id}/`, ContinuationToken: token }));
      const chiavi = (r.Contents || []).map((o) => ({ Key: o.Key }));
      if (chiavi.length) { await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET_SITO, Delete: { Objects: chiavi, Quiet: true } })); n += chiavi.length; }
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    return n;
  },
  // aziende: pk "AZIENDA", sk = id, dati JSON
  elencoAziende: async () => (await interroga('AZIENDA')).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  async leggiAzienda(id) {
    const r = await db.send(new GetItemCommand({ TableName: TABELLA, Key: { pk: { S: 'AZIENDA' }, sk: { S: id } }, ConsistentRead: true }));
    try { return r.Item ? JSON.parse(r.Item.dati.S) : null; } catch { return null; }
  },
  scriviAzienda: (a) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'AZIENDA' }, sk: { S: a.id }, dati: { S: JSON.stringify(a) } } })),
  eliminaAzienda: (id) => db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: { S: 'AZIENDA' }, sk: { S: id } } })),
  // sponsor: pk "SPONSOR", sk = id, dati JSON; contatori: pk "SPONSORSTAT", sk = id#AAAA-MM-GG, viste e clic
  elencoSponsor: async () => (await interroga('SPONSOR')).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  scriviSponsor: (x) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'SPONSOR' }, sk: { S: x.id }, dati: { S: JSON.stringify(x) } } })),
  eliminaSponsor: (id) => db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: { S: 'SPONSOR' }, sk: { S: id } } })),
  contaSponsor: (id, giorno, campo) => db.send(new UpdateItemCommand({ TableName: TABELLA, Key: { pk: { S: 'SPONSORSTAT' }, sk: { S: `${id}#${giorno}` } },
    UpdateExpression: 'ADD #c :uno', ExpressionAttributeNames: { '#c': campo === 'clic' ? 'clic' : 'viste' }, ExpressionAttributeValues: { ':uno': { N: '1' } } })),
  async statSponsor(da) {
    return (await interroga('SPONSORSTAT')).map((i) => { const [id, giorno] = i.sk.S.split('#'); return { id, giorno, viste: Number(i.viste?.N || 0), clic: Number(i.clic?.N || 0) }; })
      .filter((r) => r.giorno >= da);
  },
  // traffico: pk "VISITE", sk = AAAA-MM-GG#voce (pagina, «caso:<id>», «_utenti», «_login», «_sessioni», «_mobile», «_desktop»), n
  contaVisita: (giorno, voce) => db.send(new UpdateItemCommand({ TableName: TABELLA, Key: { pk: { S: 'VISITE' }, sk: { S: `${giorno}#${voce}` } },
    UpdateExpression: 'ADD #n :uno', ExpressionAttributeNames: { '#n': 'n' }, ExpressionAttributeValues: { ':uno': { N: '1' } } })),
  async statVisite(da) {
    const out = []; let start;
    do {
      const r = await db.send(new QueryCommand({ TableName: TABELLA, KeyConditionExpression: 'pk = :p AND sk >= :d',
        ExpressionAttributeValues: { ':p': { S: 'VISITE' }, ':d': { S: da } }, ExclusiveStartKey: start }));
      for (const i of r.Items || []) { const k = i.sk.S.indexOf('#'); out.push({ giorno: i.sk.S.slice(0, k), voce: i.sk.S.slice(k + 1), n: Number(i.n?.N || 0) }); }
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  },
  // tentativi di questa persona su questo caso (0 = non ha ancora risposto)
  async tentativi(account, caso) {
    const r = await db.send(new GetItemCommand({ TableName: TABELLA, Key: { pk: { S: 'TENTATIVI' }, sk: { S: `${account}#${caso}` } } }));
    return Number(r.Item?.n?.N || 0);
  },
  // impostazioni generali: pk "IMPOSTAZIONI", sk "generali", dati JSON
  async leggiImpostazioni() {
    const r = await db.send(new GetItemCommand({ TableName: TABELLA, Key: { pk: { S: 'IMPOSTAZIONI' }, sk: { S: 'generali' } }, ConsistentRead: true }));
    try { return r.Item ? JSON.parse(r.Item.dati.S) : {}; } catch { return {}; }
  },
  scriviImpostazioni: (x) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'IMPOSTAZIONI' }, sk: { S: 'generali' }, dati: { S: JSON.stringify(x) } } })),
  // esami simulati: pk "ESAME", sk = account#data#casuale, dati JSON
  elencoEsami: async () => (await interroga('ESAME')).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  scriviEsame: (e) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'ESAME' }, sk: { S: `${e.account}#${e.data}#${Math.random().toString(36).slice(2, 8)}` }, dati: { S: JSON.stringify(e) } } })),
  // esercizi «cerca l'errore»: pk "ERRORE", sk = account#data#casuale, dati JSON
  elencoErrori: async () => (await interroga('ERRORE')).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  scriviErrore: (e) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'ERRORE' }, sk: { S: `${e.account}#${e.data}#${Math.random().toString(36).slice(2, 8)}` }, dati: { S: JSON.stringify(e) } } })),
  // percorsi didattici dei docenti: pk "PERCORSO", sk = id, dati JSON
  elencoPercorsi: async () => (await interroga('PERCORSO')).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  scriviPercorso: (p) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'PERCORSO' }, sk: { S: p.id }, dati: { S: JSON.stringify(p) } } })),
  eliminaPercorso: (id) => db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: { S: 'PERCORSO' }, sk: { S: id } } })),
  // sfide tra amici: pk "SFIDA", sk = codice, dati JSON; partecipanti: pk "SFIDA#<codice>", sk = account, dati JSON
  elencoSfide: async () => (await interroga('SFIDA')).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  async leggiSfida(c) {
    const r = await db.send(new GetItemCommand({ TableName: TABELLA, Key: { pk: { S: 'SFIDA' }, sk: { S: c } }, ConsistentRead: true }));
    try { return r.Item ? JSON.parse(r.Item.dati.S) : null; } catch { return null; }
  },
  scriviSfida: (x) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'SFIDA' }, sk: { S: x.codice }, dati: { S: JSON.stringify(x) } } })),
  partecipantiSfida: async (c) => (await interroga('SFIDA#' + c)).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  scriviPartecipante: (c, p) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'SFIDA#' + c }, sk: { S: p.account }, dati: { S: JSON.stringify(p) } } })),
  eliminaPartecipante: (c, a) => db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: { S: 'SFIDA#' + c }, sk: { S: a } } })),
  // segnalazioni sul programma (28/11): pk "SEGNALAZIONE", sk = id, dati JSON
  elencoSegnalazioni: async () => (await interroga('SEGNALAZIONE')).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  scriviSegnalazione: (s) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'SEGNALAZIONE' }, sk: { S: s.id }, dati: { S: JSON.stringify(s) } } })),
  eliminaSegnalazione: (id) => db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: { S: 'SEGNALAZIONE' }, sk: { S: id } } })),
  // classi: pk "CLASSE", sk = id, dati JSON
  elencoClassi: async () => (await interroga('CLASSE')).map((i) => { try { return JSON.parse(i.dati.S); } catch { return null; } }).filter(Boolean),
  scriviClasse: (c) => db.send(new PutItemCommand({ TableName: TABELLA, Item: { pk: { S: 'CLASSE' }, sk: { S: c.id }, dati: { S: JSON.stringify(c) } } })),
  eliminaClasse: (id) => db.send(new DeleteItemCommand({ TableName: TABELLA, Key: { pk: { S: 'CLASSE' }, sk: { S: id } } })),
  // elenco delle serie del caso (bucket del sito): serve per sapere quali cartelle sono nascoste
  async leggiSerie(id) {
    try {
      const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET_SITO, Key: `casi/${id}/serie.json` }));
      return JSON.parse(await r.Body.transformToString());
    } catch { return null; }
  },
  // serie.json scritto dal server (modifica delle immagini dall'editor): senza cache, come quello della pubblicazione
  scriviSerie: (id, serie) => s3.send(new PutObjectCommand({ Bucket: BUCKET_SITO, Key: `casi/${id}/serie.json`, Body: JSON.stringify(serie, null, 1),
    ContentType: 'application/json; charset=utf-8', CacheControl: 'no-cache' })),
  // segno per il Mac: alla prossima pubblicazione riprende dal sito immagini, serie.json e caso.json di questo caso
  segnaModificaImmagini: (id, quando) => s3.send(new PutObjectCommand({ Bucket: BUCKET_DATI, Key: `modifiche-immagini/${id}.json`,
    Body: JSON.stringify({ id, quando }), ContentType: 'application/json' })),
  // 1.326: controllo dei vetrini caricati dal pannello (pezzi del file con Range: mai il file intero)
  async dimensioneFile(id, f) { try { return (await s3.send(new HeadObjectCommand({ Bucket: BUCKET_SITO, Key: `casi/${id}/${f}` }))).ContentLength || 0; } catch { return 0; } },
  async leggiIntervallo(id, f, o, n) {
    if (n <= 0) return new Uint8Array(0);
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET_SITO, Key: `casi/${id}/${f}`, Range: `bytes=${o}-${o + n - 1}` }));
    return new Uint8Array(await r.Body.transformToByteArray());
  },
  async cancellaFile(id, files) {
    for (let i = 0; i < files.length; i += 1000) {
      const chiavi = files.slice(i, i + 1000).map((f) => ({ Key: `casi/${id}/${f}` }));
      await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET_SITO, Delete: { Objects: chiavi, Quiet: true } }));
    }
  },
  ripristinaCodice: (id) => s3.send(new DeleteObjectCommand({ Bucket: BUCKET_DATI, Key: `eliminati/${id}/caso.json` })),
};

// backup giornaliero: tutta la tabella (account, risultati, classi, sponsor…) in backup/AAAA-MM-GG.json.gz nel bucket
// privato dei dati (versionato; i backup più vecchi di 90 giorni li cancella la regola del bucket). I casi sono già versionati.
async function backupGiornaliero(oggi = new Date()) {
  const voci = []; let chiave;
  do { const r = await db.send(new ScanCommand({ TableName: TABELLA, ExclusiveStartKey: chiave })); voci.push(...(r.Items || [])); chiave = r.LastEvaluatedKey; } while (chiave);
  const nome = `backup/${oggi.toISOString().slice(0, 10)}.json.gz`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET_DATI, Key: nome, Body: gzipSync(JSON.stringify({ data: oggi.toISOString(), tabella: TABELLA, voci })), ContentType: 'application/gzip' }));
  return { backup: nome, voci: voci.length };
}

// ---- consumi AWS per la dashboard dell'amministratore (CloudWatch): una metrica al giorno
const cwUsa = new CloudWatchClient({ region: 'us-east-1' }), cwQui = new CloudWatchClient({});
let DISTRIB;
async function idDistribuzione() {
  if (DISTRIB) return DISTRIB;
  const host = INDIRIZZO ? new URL(INDIRIZZO).host : '', cf = new CloudFrontClient({ region: 'us-east-1' });
  let marker;
  do {
    const l = (await cf.send(new ListDistributionsCommand({ Marker: marker }))).DistributionList;
    const d = (l?.Items || []).find((x) => (x.Aliases?.Items || []).includes(host));
    if (d) return (DISTRIB = d.Id);
    marker = l?.IsTruncated ? l.NextMarker : undefined;
  } while (marker);
  return null;
}
const metrica = (id, ns, nome, dim, stat = 'Sum') => ({ Id: id, ReturnData: true, MetricStat: { Period: 86400, Stat: stat,
  Metric: { Namespace: ns, MetricName: nome, Dimensions: Object.entries(dim).map(([Name, Value]) => ({ Name, Value })) } } });
async function serieCW(cw, query, giorni) {
  const fine = new Date(); fine.setUTCHours(24, 0, 0, 0);
  const r = await cw.send(new GetMetricDataCommand({ StartTime: new Date(fine - giorni * 864e5), EndTime: fine, MetricDataQueries: query }));
  return Object.fromEntries((r.MetricDataResults || []).map((m) => [m.Id, (m.Timestamps || []).map((t, i) => [new Date(t).toISOString().slice(0, 10), m.Values[i]]).sort()]));
}
async function traffico(giorni) {
  const dist = await idDistribuzione().catch(() => null), fn = process.env.AWS_LAMBDA_FUNCTION_NAME, cfd = { DistributionId: dist, Region: 'Global' };
  const [cf, la, sp, tab] = await Promise.all([
    dist ? serieCW(cwUsa, [metrica('richieste', 'AWS/CloudFront', 'Requests', cfd), metrica('byte', 'AWS/CloudFront', 'BytesDownloaded', cfd),
      metrica('err5', 'AWS/CloudFront', '5xxErrorRate', cfd, 'Average'), metrica('err4', 'AWS/CloudFront', '4xxErrorRate', cfd, 'Average')], giorni) : {},
    serieCW(cwQui, [metrica('invocazioni', 'AWS/Lambda', 'Invocations', { FunctionName: fn }), metrica('durata', 'AWS/Lambda', 'Duration', { FunctionName: fn }),
      metrica('erroriApi', 'AWS/Lambda', 'Errors', { FunctionName: fn })], giorni),
    serieCW(cwQui, [metrica('sito', 'AWS/S3', 'BucketSizeBytes', { BucketName: BUCKET_SITO, StorageType: 'StandardStorage' }, 'Average'),
      metrica('dati', 'AWS/S3', 'BucketSizeBytes', { BucketName: BUCKET_DATI, StorageType: 'StandardStorage' }, 'Average')], 4),
    db.send(new DescribeTableCommand({ TableName: TABELLA })).catch(() => null),
  ]);
  return { distribuzione: !!dist, memoriaMB: Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || 256), ...cf, ...la, ...sp,
    tabellaByte: Number(tab?.Table?.TableSizeBytes || 0) };
}

export async function handler(event) {
  // promemoria giornaliero (EventBridge): due giorni prima della scadenza dei compiti
  if (event?.promemoria === true && !event.requestContext) {
    let b = null; try { b = await backupGiornaliero(); } catch (e) { console.error('backup', e?.message || e); }
    return { ...(await promemoria({ magazzino, inviaEmail, indirizzo: INDIRIZZO, istanza: ISTANZA })), backup: b };
  }
  const headers = event.headers || {};
  // la funzione risponde solo a CloudFront, che aggiunge questa intestazione segreta
  if (!SEGRETO_ORIGINE || headers['x-origine-quiz'] !== SEGRETO_ORIGINE) {
    return { statusCode: 403, body: 'vietato' };
  }
  const corpo = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) : '';
  const cookieHeader = (event.cookies || []).join('; ');
  try {
    const r = await gestisci({
      metodo: event.requestContext?.http?.method || 'GET',
      percorso: event.rawPath || '/',
      query: event.queryStringParameters || {},
      headers: { cookie: cookieHeader, 'user-agent': event.headers?.['user-agent'] || '', referer: event.headers?.referer || '' },
      corpo,
    }, { hashAdmin: HASH_ADMIN, segreto: SEGRETO, magazzino, firmaCaricamento, inviaEmail, indirizzo: INDIRIZZO, istanza: ISTANZA, traffico, creazione, avvisiA: RISPONDI_A || '',
      google: GOOGLE_ID && GOOGLE_SEGRETO ? { id: GOOGLE_ID, segreto: GOOGLE_SEGRETO } : null,
      linkedin: LINKEDIN_ID && LINKEDIN_SEGRETO ? { id: LINKEDIN_ID, segreto: LINKEDIN_SEGRETO } : null });
    const { 'set-cookie': setCookie, ...altri } = r.headers;
    return { statusCode: r.stato, headers: altri, body: r.corpo, ...(setCookie && setCookie.length ? { cookies: [].concat(setCookie) } : {}) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ errore: 'errore interno' }) };
  }
}
