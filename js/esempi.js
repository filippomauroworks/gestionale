/* ---------- Dati d'esempio per la prova dei template ----------
   Clienti e cifre inventati. Ogni prova usa un template e mette alla prova
   ripetizioni, facoltativi e blocchi; le varianti provano i casi "vuoti". */

const CLIENTE = {
  NUMERO: "2026-016", DATA: "25 ottobre 2026",
  CLIENTE_NOME: "Studio Lanterna srl",
  CLIENTE_RIGA1: "P.IVA 01234567890",
  CLIENTE_RIGA2: "Via Roma 1, 10121 Torino (TO)",
  CLIENTE_RIGA3: "Laura Bensi",
  ETICHETTA_4: "Rivalsa INPS 4%"
};

const PRV = {
  ...CLIENTE, VALIDITA: "30", TIPO_DOC: "PREVENTIVO",
  TITOLO: "Spot autunno",
  DESCRIZIONE: "Riprese e montaggio di uno spot di 30 secondi per la campagna autunnale.",
  INFO_LAVORO: "Riprese: 5 novembre e dal 20 al 23 novembre 2026 · Torino",
  FASE: [
    {NOME: "Pre-produzione", VOCE: [
      {NOME: "Sopralluogo", DESCRIZIONE: "Visita della location e piano di ripresa", RIF: "", DETTAGLIO: "Inclusa", QUANTITA: "1 forfait", PREZZO: "", IMPORTO: "Inclusa"}
    ]},
    {NOME: "Produzione", VOCE: [
      {NOME: "Operatore di ripresa", DESCRIZIONE: "Riprese con camera cinema e ottiche fisse", RIF: "1", DETTAGLIO: "2 giornate, 2 persone", QUANTITA: "2 giornate × 2", PREZZO: "300,00 €", IMPORTO: "1.200,00 €"},
      {NOME: "Attrezzatura tecnica, Kit Completo", DESCRIZIONE: "Camera, ottiche, luci e audio", RIF: "", DETTAGLIO: "2 giornate", QUANTITA: "2 giornate", PREZZO: "250,00 €", IMPORTO: "500,00 €"},
      {NOME: "Noleggio drone, da Rental X", DESCRIZIONE: "Drone con operatore abilitato", RIF: "", DETTAGLIO: "200,00 € + IVA, a parte", QUANTITA: "forfait", PREZZO: "", IMPORTO: "a parte"}
    ]},
    {NOME: "Post-produzione", VOCE: [
      {NOME: "Montaggio", DESCRIZIONE: "Montaggio, color e mix audio", RIF: "2", DETTAGLIO: "3 giornate", QUANTITA: "3 giornate", PREZZO: "280,00 €", IMPORTO: "840,00 €"}
    ]}
  ],
  CON_NOTE: true,
  NOTA: [
    {RIF: "1", TESTO: "Giornata di 8 ore, pausa pranzo esclusa."},
    {RIF: "2", TESTO: "Il servizio comprende montaggio, musiche, scritte, color correction e color grading."}
  ],
  CONDIZIONE: ["Acconto del 30% alla firma.", "Due revisioni incluse.", "Consegna entro 10 giorni lavorativi dalle riprese.", "Preventivo valido 30 giorni."],
  DICITURA_ESCLUSI: "Il noleggio del drone è fatturato direttamente da Rental X e non è compreso nel totale.",
  TOT_SERVIZI: "2.540,00 €", RIVALSA: "101,60 €", BOLLO: "2,00 €", ARROTONDAMENTO: "−3,60 €",
  TOTALE: "2.640,00 €",
  DICITURA_TOTALE: "Comprensivo di rivalsa INPS 4% e imposta di bollo."
};

const ARTICOLI = [
  {NOME: "Camere", CONTEGGIO: "2", ART: [{QTA: "1", NOME: "Sony FX3", PREZZO: "80,00 €", IMPORTO: "400,00 €"}, {QTA: "1", NOME: "Sony A7 IV", PREZZO: "50,00 €", IMPORTO: "250,00 €"}]},
  {NOME: "Ottiche", CONTEGGIO: "2", ART: [{QTA: "1", NOME: "Sigma 24-70 f/2.8", PREZZO: "25,00 €", IMPORTO: "125,00 €"}, {QTA: "1", NOME: "Sony 85 f/1.8", PREZZO: "20,00 €", IMPORTO: "100,00 €"}]},
  {NOME: "Alimentazione", CONTEGGIO: "4", ART: [{QTA: "4", NOME: "Batteria NP-FZ100", PREZZO: "incluso", IMPORTO: ""}]}
];

const CONTRATTO = {
  ...CLIENTE,
  RIF_PREVENTIVO: "Rif. preventivo n. 2026-016",
  OGGETTO: "riprese e montaggio di uno spot di 30 secondi per la campagna autunnale",
  FRASE_RIPRESE: "Le riprese si svolgeranno a Torino il 21 novembre 2026.",
  FASE: [{N: "1.", TESTO: "Riprese in studio a Torino"}, {N: "2.", TESTO: "Montaggio e color"}, {N: "3.", TESTO: "Consegna in formato orizzontale e verticale"}],
  FRASE_CONSEGNA: "A titolo indicativo, la consegna del lavoro è prevista entro dieci (10) giorni lavorativi dalla fine delle riprese.",
  FRASE_REVISIONI: "Sono incluse due (2) revisioni del prodotto finito. Ogni revisione raccoglie in un’unica richiesta tutte le modifiche desiderate.",
  FRASE_GREZZO: "Il Cliente riceve il prodotto finito: il girato grezzo e i file di progetto non sono inclusi.",
  FRASE_24_ORE: "",
  MATERIALE_CLIENTE: true, GIORNI_MATERIALE: "quindici (15)",
  FRASE_COMPENSO: "Il compenso complessivo è di 1.000,00 € (mille/00 euro), comprensivo di rivalsa INPS 4% e imposta di bollo. Operazione in regime forfettario, senza applicazione dell’IVA.",
  FRASE_PAGAMENTO: "Il pagamento avverrà in due soluzioni: 30% (300,00 €) alla firma del contratto; 70% (700,00 €) tramite PayPal a trenta (30) giorni dalla data della fattura.",
  INTESTATARIO: "Filippo Mauro", IBAN: "IT00 X000 0000 0000 0000 0000 000",
  FRASE_CONTO: "I pagamenti con bonifico si effettuano sul conto intestato a Filippo Mauro, IBAN IT00 X000 0000 0000 0000 0000 000. ",
  FRASE_SPESE: "Le spese per viaggio e alloggio sono comprese nel compenso indicato al Punto 5.",
  FRASE_LICENZA: "Il Videomaker concede al Cliente una licenza non esclusiva, senza limiti di tempo e di territorio, per utilizzare le opere realizzate con il presente contratto nei seguenti ambiti: sito web, social network. Il Cliente può adattarle a formati e piattaforme diversi (ad esempio tagli di durata, cambi di formato, sottotitoli) senza alterarne il contenuto. Utilizzi diversi da quelli indicati vanno concordati per iscritto.",
  FRASE_PORTFOLIO: "Il Videomaker può utilizzare le opere, o loro estratti, nel proprio portfolio e sui propri canali professionali, a scopo promozionale. Il Cliente può chiedere di escludere questo utilizzo per contenuti riservati.",
  FRASE_CITAZIONE: "Dove il formato lo consente (titoli di coda, descrizione del video, didascalia), il Cliente indica il Videomaker come autore del video.",
  FRASE_MUSICHE: "Le musiche di repertorio provengono dalla libreria Artlist (piano Pro), la cui licenza copre gli utilizzi indicati sopra.",
  FRASE_FORO: "Per qualsiasi controversia derivante dal presente contratto è competente in via esclusiva il foro di Torino.",
  CLIENTE_FIRMA: "Studio Lanterna srl, nella persona di Laura Bensi",
  APPROVAZIONE: [
    {PUNTO: "Punto 4", TESTO: "Ritardo nell’invio del materiale e riprogrammazione del lavoro"},
    {PUNTO: "Punto 7", TESTO: "Licenza efficace dopo il pagamento integrale del compenso"},
    {PUNTO: "Punto 8", TESTO: "Costi di annullamento e recesso"},
    {PUNTO: "Punto 9", TESTO: "Cancellazione dei file dopo due anni dalla consegna"},
    {PUNTO: "Punto 11", TESTO: "Deroga alla competenza territoriale (foro di Torino)"}
  ]
};

const LISTINO = {
  DATA_LISTINO: "1 ottobre 2026",
  SERVIZI: true, NOLEGGIO: true,
  FASE: [
    {NOME: "Produzione", SERV: [
      {NOME: "Operatore di ripresa", DESCRIZIONE: "Riprese con camera cinema", GIORNATA: "300,00 €", MEZZA: "180,00 €", ORA: "—"},
      {NOME: "Drone", DESCRIZIONE: "Riprese aeree con operatore abilitato", GIORNATA: "su preventivo", MEZZA: "—", ORA: "—"}
    ]},
    {NOME: "Post-produzione", SERV: [
      {NOME: "Montaggio", DESCRIZIONE: "Montaggio, color e mix audio", GIORNATA: "280,00 €", MEZZA: "160,00 €", ORA: "40,00 €"}
    ]}
  ],
  KIT: [
    {NOME: "Kit Base", DESCRIZIONE: "Camera, un’ottica, audio essenziale", GIORNATA: "120,00 €", MEZZA: "80,00 €"},
    {NOME: "Kit Completo", DESCRIZIONE: "Due camere, ottiche, luci e audio", GIORNATA: "250,00 €", MEZZA: "160,00 €"}
  ],
  CAT: [
    {NOME: "Camere", ART: [{NOME: "Sony FX3", PREZZO: "80,00 €"}, {NOME: "Sony A7 IV", PREZZO: "50,00 €"}]},
    {NOME: "Alimentazione", ART: [{NOME: "Batteria NP-FZ100", PREZZO: "incluso"}]}
  ]
};

/* Le prove: k è la chiave del template nelle Impostazioni. */
export const PROVE = [
  {k: "tplPrvDettagliato", nome: "Preventivo, con note e accettazione con firma", dati: {...PRV, ACCETTAZIONE: true}},
  {k: "tplPrvDettagliato", nome: "Preventivo, senza note né accettazione", dati: {...PRV, ACCETTAZIONE: false, CON_NOTE: false, NOTA: [],
    FASE: PRV.FASE.map(f => ({...f, VOCE: f.VOCE.map(v => ({...v, RIF: ""}))}))}},
  {k: "tplAttLavoro", nome: "Lista lavoro, con noleggi e note", dati: {
    ...CLIENTE, TITOLO: "Convention di fine anno", INFO_LAVORO: "12 dicembre 2026 · Torino",
    CAT: ARTICOLI, NOLEGGI: true,
    NOL: [{QTA: "1", NOME: "Teleprompter", FORNITORE: "Rental X", CHI_PAGA: "Paga il cliente"}, {QTA: "2", NOME: "Pannello LED", FORNITORE: "Rental Y", CHI_PAGA: "Pago io"}],
    NOTE_LISTA: "Portare prolunghe e nastro gaffer.", N_ARTICOLI: "10"}},
  {k: "tplAttLavoro", nome: "Lista lavoro, senza noleggi né note", dati: {
    ...CLIENTE, TITOLO: "Riprese personali", INFO_LAVORO: "", CLIENTE_NOME: "Lavoro personale",
    CAT: ARTICOLI.slice(0, 1), NOLEGGI: false, NOL: [], NOTE_LISTA: "", N_ARTICOLI: "2"}},
  {k: "tplAttNoleggio", nome: "Noleggio a terzi", dati: {
    ...CLIENTE, RITIRO: "2 dicembre 2026", RICONSEGNA: "7 dicembre 2026", GIORNI: "5",
    CAT: ARTICOLI, SUBTOTALE: "875,00 €", SCONTO_PERC: "15%", SCONTO: "−131,25 €",
    RIVALSA: "29,75 €", BOLLO: "2,00 €", ARROTONDAMENTO: "", TOTALE: "775,50 €", CONDIZIONI_NOLEGGIO: ""}},
  {k: "tplCtr", nome: "Contratto, azienda", dati: CONTRATTO},
  {k: "tplCtr", nome: "Contratto, privato senza facoltativi", dati: {
    ...CONTRATTO, CLIENTE_NOME: "Marta Ferri", CLIENTE_RIGA1: "C.F. FRRMRT90A41L219X", CLIENTE_RIGA3: "",
    RIF_PREVENTIVO: "", FRASE_RIPRESE: "", FRASE_CONSEGNA: "", FRASE_REVISIONI: "", FRASE_GREZZO: "",
    MATERIALE_CLIENTE: false, FRASE_PORTFOLIO: "", FRASE_CITAZIONE: "", FRASE_MUSICHE: "",
    FRASE_PAGAMENTO: "Il pagamento avverrà in un’unica soluzione tramite contanti a quindici (15) giorni dalla data della fattura.", FRASE_CONTO: "",
    FRASE_SPESE: "Il lavoro non prevede spese di trasferta o servizi esterni a carico del Cliente.",
    FRASE_FORO: "Per qualsiasi controversia derivante dal presente contratto è competente il foro del luogo di residenza o di domicilio del Cliente, in quanto consumatore.",
    CLIENTE_FIRMA: "Marta Ferri",
    APPROVAZIONE: CONTRATTO.APPROVAZIONE.filter(a => ["Punto 7", "Punto 8", "Punto 9"].includes(a.PUNTO))}},
  {k: "tplCdc", nome: "Copia di cortesia", dati: {
    NUMERO: "38 / 2026", DATA: "22/10/2026", ETICHETTA_4: "Rivalsa INPS 4%",
    DEST_NOME: "Officine Dora sas", DEST_RIGA1: "P.IVA 09876543210", DEST_RIGA2: "Corso Regina 10, 10152 Torino (TO)", DEST_RIGA3: "",
    RIGA: [{DESCRIZIONE: "Riprese evento aziendale del 15 ottobre 2026", IMPORTO: "600,00 €"}, {DESCRIZIONE: "Montaggio video di sintesi", IMPORTO: "224,62 €"}],
    RIVALSA: "32,98 €", BOLLO: "2,00 €", TOTALE: "859,60 €",
    INTESTATARIO: "Filippo Mauro", IBAN: "IT00 X000 0000 0000 0000 0000 000",
    FRASE_SCADENZA: "Da saldare entro il 21/11/2026",
    NOTE: "Operazione in franchigia da IVA ai sensi dell’art. 1, commi 54-89, L. 190/2014 (regime forfettario). Imposta di bollo assolta in modo virtuale."}},
  {k: "tplLis", nome: "Listino completo", dati: LISTINO},
  {k: "tplLis", nome: "Listino solo noleggio", dati: {...LISTINO, SERVIZI: false}},
  {k: "tplInv", nome: "Lista attrezzatura completa", dati: {DATA: "25 ottobre 2026", CAT: ARTICOLI, N_ARTICOLI: "8"}}
];
