/* ============================================================
   Quiz Radiologia — infrastruttura come codice (AWS CDK).

   Stesso impianto dei Turni:
     · S3 "Sito"  (privato) → pagina, librerie e immagini DICOM anonimizzate,
       servite solo tramite CloudFront.
     · S3 "Dati"  (privato, mai esposto) → i casi con le risposte corrette.
     · Lambda (Function URL) dietro CloudFront su /api/*.
     · DynamoDB → i risultati degli specializzandi.
     · CloudFront Function su /casi/* → le immagini si aprono solo
       con il gettone di accesso valido.
     · Dominio quiz.turniradiologia.it (certificato ACM in Virginia).
   ============================================================ */
import { Stack, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as bersagli from 'aws-cdk-lib/aws-route53-targets';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sesAzioni from 'aws-cdk-lib/aws-ses-actions';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));

export class QuizStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    const { hashAdmin, segreto, segretoOrigine, dominio, zona, certificato, inoltro } = props;
    // istanza: «vetrina» (radio-quiz.it) o «azienda»; emailCondivisa = l'azienda è un sottodominio di una zona che ha già
    // la posta configurata dalla vetrina (identità SES, MX e regole di ricezione: una sola serie attiva per regione)
    const { modo = 'vetrina', nomeIstanza = '', contatto = '', emailCondivisa = false } = props;
    if (!hashAdmin || !segreto || !segretoOrigine) {
      throw new Error('Mancano codici o segreti: usa pubblica.command, che li genera da sé.');
    }
    // limiti di spesa (21 nov 2026): tetto della Lambda (vetrina 50, piattaforme dei clienti 10), budget mensile del progetto
    // (solo vetrina, in USD) con avvisi per email, firewall WAF già creato da collegare (piano CloudFront a tariffa fissa)
    const numero = (v, d) => (v === undefined || v === null || v === '' ? d : Math.max(0, Math.floor(Number(v)) || 0));
    const limiteApi = numero(props.limiteApi, modo === 'vetrina' ? 50 : 10);
    const budgetUsd = numero(props.budgetUsd, 30);
    const { emailBudget = '', webAcl = '' } = props;

    // --- dati privati: i casi con le risposte. Mai collegato a CloudFront.
    const dati = new s3.Bucket(this, 'Dati', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,                         // una modifica sbagliata dall'editor si recupera
      removalPolicy: RemovalPolicy.RETAIN,
      // backup giornalieri della tabella: 90 giorni; versioni vecchie dei casi: 365 giorni
      lifecycleRules: [{ prefix: 'backup/', expiration: Duration.days(90), noncurrentVersionExpiration: Duration.days(30) },
        { noncurrentVersionExpiration: Duration.days(365) }],
    });

    // --- risultati
    const tabella = new dynamodb.Table(this, 'Risultati', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // --- sito e immagini (il docente carica i casi nuovi direttamente qui dal browser,
    //     con URL firmati di un'ora: serve il CORS per il solo metodo PUT)
    const origini = ['https://*.cloudfront.net', ...(dominio ? [`https://${dominio}`] : []),
      ...(dominio && dominio === zona ? [`https://www.${dominio}`] : [])];
    const sito = new s3.Bucket(this, 'Sito', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [{ allowedMethods: [s3.HttpMethods.PUT], allowedOrigins: origini, allowedHeaders: ['*'], maxAge: 3000 }],
    });

    // --- API
    const api = new lambda.Function(this, 'Api', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(path.join(qui, '..', 'api')),
      memorySize: 256,
      timeout: Duration.seconds(28),
      // tetto alle esecuzioni contemporanee (21 nov 2026): un picco o un abuso non moltiplica la spesa e non toglie capacità ai
      // Turni né alle altre piattaforme (limite del conto a Milano: 1000). 50 chiamate insieme ≈ diverse centinaia al
      // secondo; oltre, l'utente riceve «riprova» (429) invece di una bolletta. LIMITE_API=0 toglie il tetto.
      ...(limiteApi > 0 ? { reservedConcurrentExecutions: limiteApi } : {}),
      logGroup: new logs.LogGroup(this, 'ApiLog', { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY }),
      environment: {
        BUCKET_DATI: dati.bucketName,
        BUCKET_SITO: sito.bucketName,
        TABELLA: tabella.tableName,
        HASH_ADMIN: hashAdmin,
        SEGRETO: segreto,
        SEGRETO_ORIGINE: segretoOrigine,
        MODO: modo,
        NOME_ISTANZA: nomeIstanza,
        CONTATTO: contatto,
        UTENTI_MAX: String(props.utentiMax || ''),
        SCADENZA: props.scadenza || '',
        SOSPESA: props.sospesa ? '1' : '0',
        SPONSOR: props.sponsor ? '1' : '0',      // sponsor nella vetrina: spenti salvo SPONSOR=1 (21/11/2026)
      },
    });
    dati.grantReadWrite(api);
    sito.grantPut(api, 'casi/*');                 // solo per firmare i caricamenti dei casi
    sito.grantRead(api, 'casi/*');                // elenco delle immagini di un caso da eliminare
    sito.grantDelete(api, 'casi/*');              // eliminazione di un caso (solo docenti, dall'API)
    tabella.grantReadWriteData(api);
    // dashboard dell'amministratore: legge le metriche di traffico (CloudFront, Lambda, S3) e trova la propria distribuzione
    api.addToRolePolicy(new iam.PolicyStatement({ actions: ['cloudwatch:GetMetricData', 'cloudfront:ListDistributions'], resources: ['*'] }));
    // --- avvisi per email (Amazon SES) dal dominio: identità verificata con i record DKIM nella zona,
    //     mittente avvisi@<zona>; promemoria ogni mattina per i compiti che scadono tra due giorni
    if (dominio && zona) {
      const zonaEmail = route53.HostedZone.fromLookup(this, 'ZonaEmail', { domainName: zona });
      if (!emailCondivisa) {
        new ses.EmailIdentity(this, 'IdentitaEmail', { identity: ses.Identity.publicHostedZone(zonaEmail), mailFromDomain: `posta.${zona}` });
        new route53.TxtRecord(this, 'Dmarc', { zone: zonaEmail, recordName: `_dmarc.${zona}`, values: ['v=DMARC1; p=quarantine; adkim=r; aspf=r; pct=100;'] });   // politica applicata: Outlook e Gmail si fidano di più
      }
      // nome del mittente senza caratteri che rompono l'intestazione
      const nomeMitt = (nomeIstanza ? `${nomeIstanza} - Quiz Radiologia` : 'Quiz Radiologia').replace(/[<>"\r\n,;]/g, ' ');
      api.addEnvironment('MITTENTE', `${nomeMitt} <avvisi@${zona}>`);
      if (contatto) api.addEnvironment('RISPONDI_A', contatto);        // le risposte vanno al referente dell'azienda
      else if (inoltro && !emailCondivisa) api.addEnvironment('RISPONDI_A', `info@${zona}`);   // casella reale per le risposte (inoltrata)
      api.addEnvironment('INDIRIZZO', `https://${dominio}`);
      api.addToRolePolicy(new iam.PolicyStatement({ actions: ['ses:SendEmail', 'ses:SendRawEmail'], resources: ['*'] }));
      new events.Rule(this, 'Promemoria', {
        schedule: events.Schedule.cron({ minute: '0', hour: '6' }),
        targets: [new targets.LambdaFunction(api, { event: events.RuleTargetInput.fromObject({ promemoria: true }) })],
      });

      // --- posta in arrivo: privacy@<zona> viene inoltrata alla casella del gestore (inoltro).
      //     Record MX del dominio verso SES di Milano; SES salva il messaggio (30 giorni) e chiama
      //     la funzione di inoltro. Il set di regole va reso «attivo» (uno solo per regione).
      if (inoltro && !emailCondivisa) {
        const posta = new s3.Bucket(this, 'PostaInArrivo', {
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          encryption: s3.BucketEncryption.S3_MANAGED,
          lifecycleRules: [{ expiration: Duration.days(30) }],
          removalPolicy: RemovalPolicy.RETAIN,
        });
        const inoltra = new lambda.Function(this, 'InoltroPosta', {
          runtime: lambda.Runtime.NODEJS_22_X,
          architecture: lambda.Architecture.ARM_64,
          handler: 'inoltro.handler',
          code: lambda.Code.fromAsset(path.join(qui, '..', 'posta')),
          memorySize: 256,
          timeout: Duration.seconds(30),
          logGroup: new logs.LogGroup(this, 'InoltroLog', { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY }),
          environment: { BUCKET: posta.bucketName, PREFISSO: 'in/', DESTINATARIO: inoltro },
        });
        posta.grantRead(inoltra, 'in/*');
        inoltra.addToRolePolicy(new iam.PolicyStatement({ actions: ['ses:SendEmail', 'ses:SendRawEmail'], resources: ['*'] }));
        const regole = new ses.ReceiptRuleSet(this, 'RegolePosta', {
          rules: [{
            recipients: [`privacy@${zona}`, `info@${zona}`, `avvisi@${zona}`],   // le risposte agli avvisi arrivano al gestore
            scanEnabled: true,
            tlsPolicy: ses.TlsPolicy.REQUIRE,
            actions: [
              new sesAzioni.S3({ bucket: posta, objectKeyPrefix: 'in/' }),
              new sesAzioni.Lambda({ function: inoltra, invocationType: sesAzioni.LambdaInvocationType.EVENT }),
            ],
          }],
        });
        const attiva = { service: 'SES', action: 'setActiveReceiptRuleSet', parameters: { RuleSetName: regole.receiptRuleSetName },
          physicalResourceId: cr.PhysicalResourceId.of('quiz-regole-posta-attive') };
        new cr.AwsCustomResource(this, 'AttivaRegolePosta', {
          onCreate: attiva, onUpdate: attiva,
          onDelete: { service: 'SES', action: 'setActiveReceiptRuleSet', parameters: {} },
          policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE }),
          installLatestAwsSdk: false,
        });
        new route53.MxRecord(this, 'MxPosta', { zone: zonaEmail, recordName: zona,
          values: [{ priority: 10, hostName: `inbound-smtp.${this.region}.amazonaws.com` }] });
      }
    }
    const urlApi = api.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    const origineSito = origins.S3BucketOrigin.withOriginAccessControl(sito);

    // Le immagini si aprono solo con un gettone valido (stessa firma della Lambda).
    // Qui non si può consultare la tabella: un account disattivato perde subito
    // l'accesso ai casi e alle risposte (Lambda), le sole immagini anonime restano
    // leggibili fino alla scadenza del gettone (30 giorni) o all'uscita.
    const guardia = new cloudfront.Function(this, 'GuardiaImmagini', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
import crypto from 'crypto';
var SEGRETO = ${JSON.stringify(segreto)};
// tutti tranne l'amministratore (chiunque può dichiararsi docente): serve il cookie «qc» del caso, rilasciato dall'API
// quando il caso viene aperto (le bozze solo agli autori); le cartelle delle serie nascoste elencate nel cookie restano chiuse
function casoConsentito(req) {
  var u = req.uri.split('/');                      // ['', 'casi', id, ...resto]
  if (u.length < 4 || u[1] !== 'casi' || !u[2]) return false;
  var m = [null, u[2], u.slice(3).join('/')];
  var q = req.cookies && req.cookies.qc, valori = [];
  if (q) { valori.push(q.value); (q.multiValue || []).forEach(function (x) { valori.push(x.value); }); }
  for (var i = 0; i < valori.length; i++) {
    var v = String(valori[i]).split('~');
    if (v.length !== 4 || v[0] !== m[1] || !(Number(v[1]) > Date.now() / 1000)) continue;
    if (crypto.createHmac('sha256', SEGRETO).update('qc.' + v[0] + '.' + v[1] + '.' + v[2]).digest('hex') !== v[3]) continue;
    var cartella = m[2].indexOf('serie/') === 0 ? m[2].split('/')[1] : '';
    return !(cartella && v[2] && v[2].split('*').indexOf(cartella) >= 0);
  }
  return false;
}
function handler(event) {
  var c = event.request.cookies && event.request.cookies.quiz;
  var p = c ? String(c.value).split('.') : [];
  var ruoli = { admin: 1, referente: 1, docente: 1, specializzando: 1 };
  if (p.length === 4 && ruoli[p[0]] === 1 && Number(p[2]) > Date.now() / 1000) {
    var f = crypto.createHmac('sha256', SEGRETO).update(p[0] + '.' + p[1] + '.' + p[2]).digest('hex');
    if (f === p[3] && (p[0] === 'admin' || casoConsentito(event.request))) {
      delete event.request.cookies.quiz;   // i cookie non servono a S3 e non devono entrare nella cache
      delete event.request.cookies.qc;
      return event.request;
    }
  }
  return { statusCode: 403, statusDescription: 'Forbidden', headers: { 'cache-control': { value: 'no-store' } } };
}`),
    });

    // indirizzi di cartella (radio-quiz.it/client/): la pagina index.html della cartella invece del 403 di S3
    const indici = new cloudfront.Function(this, 'IndiciCartelle', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var r = event.request, u = r.uri;
  if (u === '/client') return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: '/client/' } } };
  if (u === '/client/manuale-client.html' || u === '/client/manuale-client.en.html') r.uri = u.slice(7);   // il manuale è una pagina a sé (come in client/sw.js)
  if (u.length > 1 && u.charAt(u.length - 1) === '/') r.uri = u + 'index.html';
  return r;
}`),
    });

    // --- intestazioni di sicurezza (21 nov 2026): una CloudFront Function sulla risposta invece della «response headers
    //     policy» personalizzata, che i piani CloudFront a tariffa fissa Free e Pro non accettano. Le intestazioni sono le
    //     stesse di prima, sovrascritte su ogni risposta (come «override: true»).
    // solo risorse del sito: niente script in linea né di terzi; 'unsafe-eval' serve alle librerie MPR/3D (ndarray);
    // connect-src comprende S3 di Milano per il caricamento dei casi con URL firmati e, per la correzione del referto con il
    // modello open source nel browser (refertolocale.js, WebLLM), Hugging Face (pesi del modello) e GitHub (libreria WebGPU)
    const csp = [
      "default-src 'self'", "script-src 'self' 'unsafe-eval'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
      `connect-src 'self' https://*.s3.${this.region}.amazonaws.com https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com`, "worker-src 'self' blob:", "font-src 'self' data:",
      "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", 'upgrade-insecure-requests'].join('; ');
    const fisse = {
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'same-origin',
      'content-security-policy': csp,
      // microfono solo per il sito stesso: la dettatura del referto (riconoscimento della voce sul computer)
      'permissions-policy': 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()',
      'cross-origin-opener-policy': 'same-origin-allow-popups',
    };
    // immagini DICOM: il browser le tiene 7 giorni invece di 1, così chi riapre un caso nella settimana non le riscarica.
    // «private»: solo il browser dell'utente, mai cache condivise (le immagini richiedono l'accesso). Vale anche per i casi
    // caricati dal docente con l'URL firmato, che arrivano su S3 senza Cache-Control. La cache di CloudFront resta quella
    // di prima (intestazione di S3); i JSON del caso (serie.json…) restano «no-cache».
    const intestazioni = new cloudfront.Function(this, 'IntestazioniRisposta', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
var FISSE = ${JSON.stringify(fisse)};
function handler(event) {
  var r = event.response, h = r.headers;
  for (var k in FISSE) h[k] = { value: FISSE[k] };
  var s = r.statusCode;
  if ((s === 200 || s === 206 || s === 304) && /^\\/casi\\/.+\\.dcm$/.test(event.request.uri)) h['cache-control'] = { value: 'private, max-age=604800' };
  return r;
}`),
    });
    const risposta = { function: intestazioni, eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE };

    // dominio di secondo livello (es. radioquiz.it): risponde anche www.radioquiz.it
    const nomi = dominio ? (dominio === zona ? [dominio, `www.${dominio}`] : [dominio]) : undefined;
    const distribuzione = new cloudfront.Distribution(this, 'Cdn', {
      comment: nomeIstanza ? `Quiz Radiologia - ${nomeIstanza}`.slice(0, 120) : 'Quiz Radiologia',
      defaultRootObject: 'index.html',
      // Europa e Nord America: basta e costa meno. Con il piano a tariffa fissa (WEB_ACL presente) la classe di prezzo non
      // è ammessa: CloudFront serve da tutte le località, allo stesso prezzo del piano
      ...(webAcl ? {} : { priceClass: cloudfront.PriceClass.PRICE_CLASS_100 }),
      ...(nomi && certificato ? { domainNames: nomi, certificate: acm.Certificate.fromCertificateArn(this, 'Certificato', certificato) } : {}),
      // firewall (WAF, in Virginia) creato attivando il piano CloudFront a tariffa fissa dalla console: va scritto qui
      // (WEB_ACL), altrimenti la pubblicazione proverebbe a staccarlo e il piano lo impedisce
      ...(webAcl ? { webAclId: webAcl } : {}),
      defaultBehavior: {
        origin: origineSito,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [{ function: indici, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }, risposta],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.FunctionUrlOrigin(urlApi, { customHeaders: { 'x-origine-quiz': segretoOrigine } }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [risposta],
        },
        '/casi/*': {
          origin: origineSito,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
          functionAssociations: [{ function: guardia, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }, risposta],
        },
      },
    });

    if (dominio && zona && certificato) {
      const hz = route53.HostedZone.fromLookup(this, 'Zona', { domainName: zona });
      const verso = route53.RecordTarget.fromAlias(new bersagli.CloudFrontTarget(distribuzione));
      nomi.forEach((nome, i) => {
        const suff = i === 0 ? '' : 'Www';
        new route53.ARecord(this, `RecordA${suff}`, { zone: hz, recordName: nome, target: verso });
        new route53.AaaaRecord(this, `RecordAaaa${suff}`, { zone: hz, recordName: nome, target: verso });
      });
      new CfnOutput(this, 'IndirizzoDominio', { value: `https://${dominio}` });
    }

    // --- creazione automatica delle piattaforme dei clienti (solo vetrina): Gestione → Clienti e piattaforme avvia un
    //     lavoro AWS CodeBuild che esegue crea-tenant.sh. Il ruolo del lavoro agisce solo sugli stack «QuizIstanza-*» e
    //     «QuizCert-*» (le risorse le crea CloudFormation con il ruolo di esecuzione del bootstrap CDK), sui bucket
    //     «quizistanza-*» e sui segreti /radio-quiz/tenant/*: nessun permesso sulla vetrina.
    if (modo === 'vetrina') {
      const conto = this.account, regioni = [this.region, 'us-east-1'];
      const codice = new s3.Bucket(this, 'CodiceAutomazione', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true, removalPolicy: RemovalPolicy.DESTROY });
      const ruolo = new iam.Role(this, 'RuoloCreazione', { assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
        description: 'Crea e aggiorna le piattaforme dei clienti (QuizIstanza-*): niente permessi sulla vetrina' });
      const stackClienti = regioni.flatMap((r) => [`arn:aws:cloudformation:${r}:${conto}:stack/QuizIstanza-*/*`, `arn:aws:cloudformation:${r}:${conto}:stack/QuizCert-*/*`]);
      ruolo.addToPolicy(new iam.PolicyStatement({ actions: ['cloudformation:*'], resources: stackClienti }));
      ruolo.addToPolicy(new iam.PolicyStatement({ actions: ['cloudformation:DescribeStacks', 'cloudformation:ListStacks', 'cloudformation:GetTemplateSummary', 'cloudformation:ValidateTemplate'], resources: ['*'] }));
      ruolo.addToPolicy(new iam.PolicyStatement({ actions: ['iam:PassRole'], resources: regioni.map((r) => `arn:aws:iam::${conto}:role/cdk-hnb659fds-cfn-exec-role-${conto}-${r}`),
        conditions: { StringEquals: { 'iam:PassedToService': 'cloudformation.amazonaws.com' } } }));
      ruolo.addToPolicy(new iam.PolicyStatement({ actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:GetBucketLocation', 's3:GetEncryptionConfiguration'],
        resources: regioni.flatMap((r) => [`arn:aws:s3:::cdk-hnb659fds-assets-${conto}-${r}`, `arn:aws:s3:::cdk-hnb659fds-assets-${conto}-${r}/*`]) }));
      ruolo.addToPolicy(new iam.PolicyStatement({ actions: ['ssm:GetParameter', 'ssm:GetParameters'], resources: regioni.map((r) => `arn:aws:ssm:${r}:${conto}:parameter/cdk-bootstrap/*`) }));
      ruolo.addToPolicy(new iam.PolicyStatement({ actions: ['s3:*'], resources: ['arn:aws:s3:::quizistanza-*', 'arn:aws:s3:::quizistanza-*/*'] }));
      ruolo.addToPolicy(new iam.PolicyStatement({ actions: ['cloudfront:CreateInvalidation', 'route53:ListHostedZonesByName', 'route53:ListHostedZones', 'route53:GetHostedZone',
        'acm:ListCertificates', 'acm:DescribeCertificate', 'sts:GetCallerIdentity'], resources: ['*'] }));
      ruolo.addToPolicy(new iam.PolicyStatement({ actions: ['ssm:GetParameter', 'ssm:PutParameter'], resources: [`arn:aws:ssm:${this.region}:${conto}:parameter/radio-quiz/tenant/*`] }));
      codice.grantRead(ruolo);
      const progetto = new codebuild.Project(this, 'CreaPiattaforme', {
        description: 'Crea, aggiorna, sospende o smonta la piattaforma di un cliente (avviato da Gestione → Clienti e piattaforme)',
        role: ruolo, timeout: Duration.minutes(75), concurrentBuildLimit: 2,
        environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_7_0, computeType: codebuild.ComputeType.SMALL },
        environmentVariables: { BUCKET_CODICE: { value: codice.bucketName }, REGIONE: { value: this.region }, INDIRIZZO_VETRINA: { value: dominio ? `https://${dominio}` : '' } },
        logging: { cloudWatch: { logGroup: new logs.LogGroup(this, 'CreaPiattaformeLog', { retention: logs.RetentionDays.THREE_MONTHS, removalPolicy: RemovalPolicy.DESTROY }) } },
        buildSpec: codebuild.BuildSpec.fromObject({ version: '0.2', env: { shell: 'bash' },
          phases: { install: { 'runtime-versions': { nodejs: '20' } },
            build: { commands: ['aws s3 cp "s3://${BUCKET_CODICE}/codice.tgz" /tmp/codice.tgz --only-show-errors', 'mkdir -p /tmp/lavoro && tar -xzf /tmp/codice.tgz -C /tmp/lavoro',
              'cd /tmp/lavoro && npm ci --no-audit --no-fund --loglevel=error', 'cd /tmp/lavoro && bash crea-tenant.sh'] } } }),
      });
      api.addEnvironment('PROGETTO_CREAZIONE', progetto.projectName);
      api.addToRolePolicy(new iam.PolicyStatement({ actions: ['codebuild:StartBuild', 'codebuild:BatchGetBuilds'], resources: [progetto.projectArn] }));
      new CfnOutput(this, 'BucketCodice', { value: codice.bucketName });

      // --- budget mensile del progetto (21 nov 2026): somma vetrina e piattaforme dei clienti (tutte hanno il tag
      //     progetto=quiz-radiologia, da attivare una volta in Fatturazione → Tag per l'allocazione dei costi; finché il
      //     tag non è attivo il budget vede 0). Avvisi per email all'80% della spesa reale, al 100% e alla previsione
      //     oltre il 100%. AWS::Budgets::Budget non esiste a Milano: si crea con l'API (globale, in Virginia).
      if (budgetUsd > 0 && emailBudget) {
        const nomeBudget = 'radio-quiz-mensile';
        const datiBudget = { BudgetName: nomeBudget, BudgetType: 'COST', TimeUnit: 'MONTHLY',
          BudgetLimit: { Amount: String(budgetUsd), Unit: 'USD' },
          CostFilters: { TagKeyValue: ['user:progetto$quiz-radiologia'] } };
        const avviso = (tipo, soglia) => ({ Notification: { NotificationType: tipo, ComparisonOperator: 'GREATER_THAN', Threshold: soglia, ThresholdType: 'PERCENTAGE' },
          Subscribers: [{ SubscriptionType: 'EMAIL', Address: emailBudget }] });
        new cr.AwsCustomResource(this, 'BudgetQuiz', {
          onCreate: { service: 'Budgets', action: 'createBudget', region: 'us-east-1',
            parameters: { AccountId: conto, Budget: datiBudget, NotificationsWithSubscribers: [avviso('ACTUAL', 80), avviso('ACTUAL', 100), avviso('FORECASTED', 100)] },
            physicalResourceId: cr.PhysicalResourceId.of(nomeBudget), ignoreErrorCodesMatching: 'DuplicateRecord' },
          onUpdate: { service: 'Budgets', action: 'updateBudget', region: 'us-east-1', parameters: { AccountId: conto, NewBudget: datiBudget },
            physicalResourceId: cr.PhysicalResourceId.of(nomeBudget) },
          onDelete: { service: 'Budgets', action: 'deleteBudget', region: 'us-east-1', parameters: { AccountId: conto, BudgetName: nomeBudget },
            ignoreErrorCodesMatching: 'NotFound' },
          // le azioni IAM di Budgets non hanno i nomi delle chiamate (createBudget → budgets:ModifyBudget)
          policy: cr.AwsCustomResourcePolicy.fromStatements([new iam.PolicyStatement({ actions: ['budgets:ModifyBudget', 'budgets:ViewBudget'], resources: ['*'] })]),
          installLatestAwsSdk: false,
        });
      }
    }
    new CfnOutput(this, 'Indirizzo', { value: `https://${distribuzione.distributionDomainName}` });
    new CfnOutput(this, 'BucketSito', { value: sito.bucketName });
    new CfnOutput(this, 'BucketDati', { value: dati.bucketName });
    new CfnOutput(this, 'Distribuzione', { value: distribuzione.distributionId });
  }
}

/* Il certificato per CloudFront deve stare in Virginia (us-east-1).
   Convalida automatica con un record DNS nella zona esistente. */
export class CertificatoStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    const hz = route53.HostedZone.fromLookup(this, 'Zona', { domainName: props.zona });
    const cert = new acm.Certificate(this, 'Certificato', {
      domainName: props.dominio,
      ...(props.dominio === props.zona ? { subjectAlternativeNames: [`www.${props.dominio}`] } : {}),
      validation: acm.CertificateValidation.fromDns(hz),
    });
    new CfnOutput(this, 'ArnCertificato', { value: cert.certificateArn });
  }
}
