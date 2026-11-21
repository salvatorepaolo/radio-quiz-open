// Indice delle scale (nome e metodiche): basta ad app.js per sapere quali scale proporre in un caso senza
// scaricare scale-dati.js e scale.js, che si caricano solo quando si aprono le scale.
// Deve coincidere con SCALE di scale-dati.js: lo controlla test/scale.test.mjs.
export const SCALE_INDICE = {
  renal: { nome: 'RENAL (nefrometria)', metodiche: ['TC', 'RM'] },
  padua: { nome: 'PADUA (masse renali)', metodiche: ['TC', 'RM'] },
  bosniak: { nome: 'Bosniak 2019 (masse cistiche renali)', metodiche: ['TC', 'RM'] },
  tirads: { nome: 'ACR TI-RADS (noduli tiroidei)', metodiche: ['Ecografia'] },
  pirads: { nome: 'PI-RADS v2.1 (prostata)', metodiche: ['RM'] },
  mammella: { nome: 'Mammella: sede della lesione (quadranti) e BI-RADS', metodiche: ['Mammografia', 'Ecografia', 'RM'] },
  segmenti: { nome: 'Fegato: sede della lesione (segmenti di Couinaud)', metodiche: ['TC', 'RM', 'Ecografia'] },
  cinetica: { nome: 'Cinetica segmentaria del ventricolo sinistro (bull\'s eye, 17 segmenti)', metodiche: ['Ecocardio', 'Ecografia', 'RM', 'TC'] },
  lirads: { nome: 'LI-RADS v2018 TC/RM (fegato a rischio)', metodiche: ['TC', 'RM'] },
  lrtr: { nome: 'LI-RADS dopo trattamento (LR-TR)', metodiche: ['TC', 'RM'] },
  uslirads: { nome: 'US LI-RADS (ecografia di sorveglianza)', metodiche: ['Ecografia'] },
  steatosi: { nome: 'Steatosi epatica in TC senza mdc', metodiche: ['TC'] },
  lungrads: { nome: 'Lung-RADS v2022 (screening del tumore polmonare)', metodiche: ['TC'] },
  orads: { nome: 'O-RADS US v2022 (masse annessiali)', metodiche: ['Ecografia'] },
  aast: { nome: 'AAST 2018: traumi di milza, fegato e rene (TC)', metodiche: ['TC'] },
  genant: { nome: 'Genant (fratture vertebrali da fragilità)', metodiche: ['RX', 'TC', 'RM'] },
  fazekas: { nome: 'Fazekas (iperintensità della sostanza bianca)', metodiche: ['RM'] },
  mcdonald: { nome: 'McDonald 2017 (sclerosi multipla)', metodiche: ['RM'] },
  recist: { nome: 'RECIST 1.1 (risposta dei tumori solidi)', metodiche: ['TC', 'RM'] },
  fleischner: { nome: 'Fleischner 2017 (noduli polmonari incidentali)', metodiche: ['TC'] },
  deauville: { nome: 'Deauville (linfoma, PET-TC FDG)', metodiche: ['Medicina nucleare'] },
};
