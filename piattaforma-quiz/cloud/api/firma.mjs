/* URL firmati (AWS SigV4, "presigned URL") per caricare un file su S3
   direttamente dal browser del docente. Scritto a mano per non dipendere
   da librerie esterne: la funzione usa le credenziali del proprio ruolo
   (variabili AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN). */
import { createHash, createHmac } from 'node:crypto';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => createHmac('sha256', k).update(s).digest();
const codifica = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export function urlFirmato({ bucket, regione, chiave, metodo = 'PUT', scadenza = 3600, credenziali, ora = new Date(), host: hostDato, contenuto = false }) {
  const { accessKeyId, secretAccessKey, sessionToken } = credenziali;
  const host = hostDato || `${bucket}.s3.${regione}.amazonaws.com`;
  const percorso = '/' + chiave.split('/').map(codifica).join('/');
  const amzDate = ora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');   // 20261003T160000Z
  const giorno = amzDate.slice(0, 8);
  const ambito = `${giorno}/${regione}/s3/aws4_request`;
  const q = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${ambito}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(scadenza),
    'X-Amz-SignedHeaders': 'host',
  };
  if (contenuto) q['X-Amz-Content-Sha256'] = 'UNSIGNED-PAYLOAD';
  if (sessionToken) q['X-Amz-Security-Token'] = sessionToken;
  const query = Object.keys(q).sort().map((k) => `${codifica(k)}=${codifica(q[k])}`).join('&');
  const canonica = [metodo, percorso, query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const daFirmare = ['AWS4-HMAC-SHA256', amzDate, ambito, sha(canonica)].join('\n');
  let k = hmac('AWS4' + secretAccessKey, giorno);
  k = hmac(k, regione); k = hmac(k, 's3'); k = hmac(k, 'aws4_request');
  const firma = createHmac('sha256', k).update(daFirmare).digest('hex');
  return `https://${host}${percorso}?${query}&X-Amz-Signature=${firma}`;
}
