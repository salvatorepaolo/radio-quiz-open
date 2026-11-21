/* Quiz Radiologia — inoltro della posta in arrivo (privacy@<dominio>) alla casella del gestore.
   SES riceve il messaggio, lo salva nel bucket «posta» (in/<id>) e chiama questa funzione,
   che lo rispedisce a DESTINATARIO: il mittente diventa l'indirizzo del dominio (SES può
   inviare solo da identità verificate), l'indirizzo originale va in Reply-To, così
   «Rispondi» risponde a chi ha scritto. Spam e virus segnalati da SES non vengono inoltrati. */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const s3 = new S3Client({});
const ses = new SESv2Client({});
const { BUCKET, PREFISSO = 'in/', DESTINATARIO } = process.env;
const VIA = new Set(['from', 'return-path', 'sender', 'reply-to', 'to', 'cc', 'bcc', 'dkim-signature', 'domainkey-signature', 'message-id']);

export function riscrivi(raw, { destinatario, indirizzo, mittente }) {
  const txt = raw.toString('latin1');                      // latin1: i byte restano identici
  const m = txt.match(/\r?\n\r?\n/);
  const fine = m ? m.index : txt.length;
  const testa = txt.slice(0, fine), corpo = txt.slice(fine);
  const intest = [];
  for (const l of testa.split(/\r?\n/)) {
    if (/^[ \t]/.test(l) && intest.length) intest[intest.length - 1] += '\r\n' + l; else if (l) intest.push(l);
  }
  const nome = (h) => h.slice(0, h.indexOf(':')).trim().toLowerCase();
  const tieni = intest.filter((h) => h.includes(':') && !VIA.has(nome(h)) && !nome(h).startsWith('x-ses') && !nome(h).startsWith('arc-'));
  // nel Reply-To solo ASCII: con caratteri accentati nel nome si tengono i soli indirizzi
  const pulito = (s) => { const t = String(s || '').replace(/[\r\n]/g, ' ').trim();
    return /^[\x20-\x7e]*$/.test(t) ? t : (t.match(/[^\s<>,"]+@[^\s<>,"]+/g) || []).join(', '); };
  return Buffer.from([
    `From: "Quiz Radiologia - inoltro" <${indirizzo}>`,
    `Reply-To: ${pulito(mittente)}`,
    `To: ${destinatario}`,
    `X-Inoltrato-Per: ${indirizzo}`,
    ...tieni,
  ].join('\r\n') + corpo, 'latin1');
}

export async function handler(event) {
  for (const r of event.Records || []) {
    const { mail, receipt } = r.ses || {};
    if (!mail) continue;
    const bocciato = (v) => v?.status === 'FAIL';
    if (bocciato(receipt?.spamVerdict) || bocciato(receipt?.virusVerdict)) { console.log('scartato (spam/virus)', mail.messageId); continue; }
    const indirizzo = (receipt?.recipients || [])[0];
    const o = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: PREFISSO + mail.messageId }));
    const raw = Buffer.from(await o.Body.transformToByteArray());
    const mittente = (mail.commonHeaders?.from || [mail.source]).join(', ');
    await ses.send(new SendEmailCommand({ FromEmailAddress: indirizzo, Destination: { ToAddresses: [DESTINATARIO] },
      Content: { Raw: { Data: riscrivi(raw, { destinatario: DESTINATARIO, indirizzo, mittente }) } } }));
    console.log('inoltrato', mail.messageId);          // niente indirizzi nei log
  }
}
