#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { QuizStack, CertificatoStack } from '../lib/stack.mjs';

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const dominio = process.env.DOMINIO || '';          // quiz.turniradiologia.it
const zona = process.env.ZONA || '';                // turniradiologia.it
const tags = { progetto: 'quiz-radiologia' };
// creazione dal pannello (AWS CodeBuild, crea-tenant.sh): il lavoro non può assumere i ruoli di deploy del bootstrap CDK, quindi
// il CDK prosegue con le sue credenziali, valide solo sugli stack dei clienti; CloudFormation crea le risorse con il ruolo di esecuzione

if (dominio && zona && !process.env.CERTIFICATO) {   // serve solo finché il certificato non c'è
  // uno stack per dominio: cambiare dominio non tocca il certificato in uso
  new CertificatoStack(app, process.env.STACK_CERT || 'QuizRadiologiaCertificato', {
    env: { account, region: 'us-east-1' }, dominio, zona, tags,
    description: 'Quiz Radiologia - certificato HTTPS per CloudFront',
  });
}

// STACK: «QuizRadiologia» per la vetrina, «QuizIstanza-<nome>» per le aziende (pubblica.command con ISTANZA=<nome>)
new QuizStack(app, process.env.STACK || 'QuizRadiologia', {
  env: { account, region: process.env.CDK_DEFAULT_REGION || 'eu-south-1' },   // Europe (Milano)
  hashAdmin: process.env.HASH_ADMIN,
  segreto: process.env.SEGRETO,
  segretoOrigine: process.env.SEGRETO_ORIGINE,
  dominio, zona,
  certificato: process.env.CERTIFICATO || '',
  // casella a cui inoltrare la posta per privacy@<zona> (vuoto = nessuna ricezione)
  inoltro: process.env.INOLTRO_POSTA ?? '',   // casella del gestore: in .segreti (INOLTRO_POSTA), mai nel codice
  modo: process.env.MODO === 'azienda' ? 'azienda' : 'vetrina',
  nomeIstanza: process.env.NOME_ISTANZA || '',
  contatto: process.env.CONTATTO || '',
  utentiMax: process.env.UTENTI_MAX || '',
  scadenza: process.env.SCADENZA || '',
  sospesa: process.env.SOSPESA === '1',
  sponsor: process.env.SPONSOR === '1',
  // accesso con Google (22/11/2026): client OAuth in .segreti (GOOGLE_ID, GOOGLE_SEGRETO); vuoti = pulsante nascosto
  googleId: process.env.GOOGLE_ID || '',
  googleSegreto: process.env.GOOGLE_SEGRETO || '',
  linkedinId: process.env.LINKEDIN_ID || '',
  linkedinSegreto: process.env.LINKEDIN_SEGRETO || '',   // sponsor nella vetrina: spenti salvo SPONSOR="1" in .segreti (21/11/2026)
  emailCondivisa: process.env.EMAIL_CONDIVISA === '1',
  // limiti di spesa (21 nov 2026): LIMITE_API = esecuzioni contemporanee della Lambda (vuoto: 50 vetrina, 10 aziende; 0 = nessun
  // tetto); BUDGET_QUIZ_USD = budget mensile del progetto (vuoto: 30; 0 = nessun budget), avvisi a EMAIL_BUDGET (vuoto: la
  // casella dell'inoltro); WEB_ACL = ARN del firewall creato con il piano CloudFront a tariffa fissa (vuoto: nessuno)
  limiteApi: process.env.LIMITE_API,
  budgetUsd: process.env.BUDGET_QUIZ_USD,
  emailBudget: process.env.EMAIL_BUDGET || process.env.INOLTRO_POSTA || '',
  webAcl: process.env.WEB_ACL || '',
  tags,
  description: process.env.NOME_ISTANZA ? `Quiz Radiologia - ${process.env.NOME_ISTANZA}` : 'Quiz Radiologia - piattaforma di addestramento su casi DICOM',
});
