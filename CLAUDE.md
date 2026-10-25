# Gestionale Filippo Mauro — specifica di sviluppo

Questo file è la fonte di verità del progetto. Claude Code lo legge a ogni sessione: va aggiornato ogni volta che una decisione cambia.

**Utente**: Filippo Mauro, videomaker e camera operator freelance a Torino, regime forfettario (ATECO 74.20.19), Gestione Separata INPS, imposta sostitutiva al 5%, fatture con Fiscozen. Parla italiano: interfaccia, testi e commenti al codice in italiano. Vuole risposte dirette e franche e soluzioni concrete; se una sua idea non regge, va detto.

**Riferimenti nella cartella**

| File | Ruolo |
|---|---|
| `prototipo.html` | Prototipo cliccabile completo, con dati d'esempio. È il riferimento per interfaccia, comportamento, testi e calcoli. Dove questa specifica è sintetica, vale il prototipo. |
| `template/` | Gli 8 template dei documenti in .docx, da convertire in Google Docs, più `Guida ai template.md` con tutti i segnaposto e le regole del motore dei template. |
| `logo-scuro.png`, `logo-chiaro.png` | Logo FM per modalità chiara e scura. |

---

## 1. Architettura

- **Web app statica (PWA)** ospitata su **GitHub Pages**, installabile su Mac, Windows, iPhone e Android. Nessun server.
- **JavaScript senza build** (moduli ES, niente framework, niente bundler): l'utente deve poter chiedere modifiche e vederle online in un minuto. Librerie solo da CDN con versione fissata (pdf.js per leggere i PDF di Fiscozen).
- **Google**: Google Identity Services (token client), Picker, API REST di Drive v3, Sheets v4, Docs v1.
- **Scope**: solo `https://www.googleapis.com/auth/drive.file`. L'app vede solo i file scelti con il Picker e quelli che crea lei.
- **Configurazione pubblica** in `config.js`: ID client OAuth, chiave API (limitata al Picker e al dominio), numero del progetto Cloud (appId del Picker). Sono valori pubblici per natura.
- **Il repository è pubblico**: nel codice non vanno mai ID di file Drive, IBAN, prezzi o dati dei clienti. Prezzi e dati stanno nei fogli; gli ID dei file nelle impostazioni (vedi sotto).
- **Font**: EB Garamond (titoli e cifre) e DM Sans (testo) da Google Fonts.
- **Repository**: `github.com/filippomauroworks/gestionale`, pubblicato con GitHub Pages da `main`, cartella radice. I `.docx` dei template restano fuori (`.gitignore`): contengono P.IVA, C.F. e indirizzo, e vivono su Drive. Pagina della privacy: `privacy.html`.
- **File**: `index.html`, `css/app.css`, `config.js`; in `js/`: `app.js` (guscio, viste, Impostazioni), `google.js` (accesso, Picker, `api()`), `drive.js` (Drive v3 di base), `dati.js` (cartella dati, impostazioni, registro), `fogli.js` (schemi e lettura dei fogli), `util.js`.
- **Moduli per le sezioni**: `calcoli.js` (centesimi, formati, Fiscozen, sconto noleggio, date), `anagrafiche.js` (clienti, conti, attrezzatura, servizi e kit già normalizzati; un "-" da solo in una cella vale vuoto), `registro.js` (codici, versioni, JSON dei dati), `elenco.js` (righe dell'elenco, scarica PDF), `procedura.js` (pezzi comuni delle procedure guidate), `errori.js`, `liste.js` (sezione Attrezzatura).
- **Prova in locale**: `python3 -m http.server 8000` dalla cartella del progetto. `http://localhost:8000` deve essere tra le origini JavaScript autorizzate del client OAuth e tra i referrer della chiave API.

### Dove stanno i dati dell'app

- **Impostazioni e registro**: in una cartella Drive creata dall'app, "Gestionale FM — dati", con `impostazioni.json` (ID dei file scelti, etichetta del 4%, maggiorazione, data listino, tema) e `registro.json` (indice di tutti i documenti: codice, tipo, cliente, titolo, versioni con data e ID di Doc e PDF, stato del preventivo). Essendo file creati dall'app, si ritrovano da ogni dispositivo cercandoli per nome.
- **Dati compilati di ogni documento**: un JSON per documento nella stessa cartella (`2026-016_PRV.json`), con i dati di ogni versione. Servono per riaprire e modificare.
- **Bozze**: salvate automaticamente in `localStorage` del dispositivo (una per tipo di procedura), con "Riprendi" in Home.

### Attenzione a `drive.file`

L'app non vede le sottocartelle che l'utente ha creato a mano. Le cartelle cliente devono crearle l'app. Se ne esistono già di manuali con lo stesso nome, l'app ne crea comunque di sue: va detto all'utente al primo avvio.

---

## 2. Fogli Google

L'app legge le colonne **per nome di intestazione**, mai per posizione. Salta le righe vuote. Le righe non si cancellano mai: `Attivo = No` le nasconde. Gli ID li assegna l'utente a mano, copiandoli dalla colonna "Prossimo ID" del foglio categorie.

### Sheet Clienti

- **Foglio Clienti**: ID (`CLI-001`), Tipo (Azienda/Privato), Ragione sociale / Nome, Referente, P.IVA, C.F., Codice SDI, PEC, Indirizzo, CAP, Comune, Provincia, Nazione, Telefono, Email, Note.
- **Foglio Conti**: banca, intestatario, IBAN. Nel contratto si sceglie il conto.

### Sheet Attrezzatura (chiamato anche Listino)

- **Attrezzatura**: ID, Nome, Categoria, Quantità, Prezzo lavoro giornata, Prezzo lavoro mezza giornata, Prezzo noleggio giornata, Noleggiabile, Attivo, Note interne. Prezzi per singolo pezzo e per giornata. La mezza giornata vale solo per i lavori fatti da lui; il noleggio a terzi è sempre a giornata.
- **Categorie attrezzatura**: Categoria, Ordine, Prefisso ID, Prossimo ID (formula). L'ordine delle categorie nelle liste è quello della colonna Ordine.
- **Servizi**: ID, Nome, Categoria (Pre-produzione, Produzione, Post-produzione), Prezzo giornata, Prezzo mezza giornata, Prezzo orario, Prezzo fisso, Unità predefinita (Giornata, Mezza giornata, Ora, Forfait, Fisso), Spesa esterna (Sì/No), Descrizione per il cliente, Nota, Nota obbligatoria (Sì/No), Nel listino (Sì/No), Attivo, Note interne.
- **Categorie servizi**: come Categorie attrezzatura (prefissi PRE, PRO, POS).
- **Kit**: Livello, Nome, Descrizione per il cliente, Soglia giornata, Prezzo giornata, Soglia mezza giornata, Prezzo mezza giornata, Attivo, Note interne. Ordinati per soglia; possono essere più di tre.

Tutti i prezzi nei fogli sono al netto della rivalsa del 4% e del bollo.

---

## 3. Archivio, nomi dei file e versioni

### Cartelle Drive (scelte con il Picker in Impostazioni)

| Cartella | Contenuto |
|---|---|
| Archivio preventivi | Preventivi riepilogativi e dettagliati |
| Archivio contratti | Contratti |
| Archivio liste attrezzatura | Liste ATT |
| Archivio copie di cortesia | Copie di cortesia |
| Template | Gli 8 template, ciascuno scelto singolarmente |

In ogni archivio l'app crea una sottocartella per cliente chiamata `CLI-001 – Ragione sociale` e la ritrova tramite l'ID, così un cambio di ragione sociale non la perde. Per le liste senza cliente la sottocartella è "Lavori personali".

### Codici e nomi

- **Formato**: `CODICE_TIPO_Progetto_Cliente_FilippoMauro[_Vxx]`, per esempio `2026-016_CTR_VideocorsoADHD_GamMedical_FilippoMauro_V02`.
- **Tipi**: PRV, CTR, ATT. Numerazione unica per anno e per tutti i tipi.
- **Progetto**: titolo in CamelCase senza accenti, tagliato a 32 caratteri.
- **Cliente**: ragione sociale in CamelCase senza srl, srls, sas, spa, snc (anche con i punti, es. S.r.l.) e senza ssdrl, ssd, asd, aps, sapa, ets, onlus, odv; le parole tutte maiuscole diventano "Parola" (`SALA GIOCHI S.r.l.` → `SalaGiochi`, `GAM Medical srls` → `GamMedical`); `Personale` se manca. Il titolo invece resta com'è scritto (`ADHD` resta `ADHD`).
- **Stesso codice**: una lista ATT o un contratto creati da un preventivo prendono lo stesso codice del preventivo. Il tipo distingue i documenti. Un contratto nato da zero prende un codice nuovo.
- **Preventivo dettagliato**: stesso codice e stessa versione, con il suffisso `_Dettaglio` prima della versione.
- **Copie di cortesia**: `FT-2026-038_CDC_Cliente_FilippoMauro[_Vxx]`, usando il numero di fattura di Fiscozen.

### Versioni

- Il file senza suffisso è la V01.
- Ogni salvataggio dopo una modifica crea la versione successiva: numero più alto in archivio + 1, non quello del file aperto + 1.
- Non si sovrascrive mai nulla. Doc e PDF hanno sempre la stessa versione. Il codice non cambia mai.

### Riapertura

- Dall'elenco con "Modifica", oppure caricando il PDF: l'app legge codice e tipo dal nome del file.
- Se il PDF appartiene a un'altra sezione, propone di andarci. Se il codice non è in archivio, lo dice.
- Se si apre una versione vecchia, avvisa che ne esiste una più recente.
- Copie di cortesia: "Nuova versione" su una copia in archivio, poi si carica il PDF corretto. Viene letto da zero e salvato come versione successiva. Se il numero letto è diverso, avvisa ma salva comunque come versione della copia scelta. Un PDF con un numero di fattura già in archivio diventa sempre la versione successiva.

### Generazione dei documenti

L'app copia il template nella cartella del cliente, sostituisce i segnaposto (motore descritto nella Guida ai template), poi esporta il PDF con Drive (`files.export`) e lo carica nella stessa cartella. Doc e PDF sono identici e si scaricano con due tasti.

---

## 4. Interfaccia

Come nel prototipo.

- **Navigazione**: barra laterale su desktop, barra in basso su mobile. Voci: Home, Attrezzatura, Preventivi, Contratti, Copie di cortesia; Impostazioni a parte.
- **Stile**: EB Garamond per titoli e cifre, DM Sans per il testo, ambra `#854F0B`, filetti sabbia, modalità chiara e scura. Logo: versione scura in modalità chiara, chiara in modalità scura.
- **Home**: card "Riprendi" per ogni bozza in sospeso, quattro tasti rapidi, ultimi documenti.
- **Ogni sezione** ha un elenco dei documenti con ricerca, versioni espandibili, tasti Modifica, Doc e PDF, "Carica PDF" e "Nuovo".
  - I preventivi hanno lo stato (Bozza, Inviato, Accettato, Rifiutato) e, se accettati, il tasto "Crea contratto".
  - Le liste hanno il tasto "Trello".
- **Procedure guidate**:
  - barra dei passi cliccabile solo sui passi già visitati, un passo alla volta, Indietro/Avanti;
  - validazione che blocca l'avanzamento con un messaggio chiaro;
  - riepilogo finale con cartella e nomi dei file;
  - pannello laterale live (a destra su desktop, a scomparsa dal basso su mobile).
- **Attrezzatura**, menu "Scarica":
  - listino completo (pagina servizi e kit, pagina noleggio);
  - listino noleggio;
  - lista attrezzatura completa senza prezzi.
- **Impostazioni**:
  - Picker per Sheet Clienti, Sheet Attrezzatura, le 4 cartelle archivio e gli 8 template;
  - etichetta del 4% ("Rivalsa INPS 4%");
  - maggiorazione sulle spese (26%);
  - data "Listino valido dal";
  - tema (automatico, chiaro, scuro).

---

## 5. Procedure

### 5.1 Preventivo (10 passi)

1. **Cliente.**
2. **Progetto**:
   - titolo obbligatorio, con anteprima del nome nel file e indicatore dei 32 caratteri;
   - breve descrizione per il cliente;
   - date di ripresa, facoltative e anche più di una;
   - luogo, facoltativo;
   - data del preventivo (oggi, modificabile);
   - validità in giorni (30).
3. **Pre-produzione**, 4. **Produzione**, 7. **Post-produzione**: le voci del foglio Servizi della fase, più le voci libere. Ogni voce ha:
   - **Unità**: Giornata, Mezza giornata, Ora e Forfait sono sempre selezionabili; Fisso solo se Prezzo fisso ha un valore (anche 0). Il prezzo si precompila dal listino e si modifica; se manca, si scrive a mano.
   - **Campi**: quantità, risorse (persone) e prezzo; per Fisso solo quantità e prezzo; per Forfait solo l'importo.
   - **Pagamento**, selettore a tre posizioni: Nel totale / Inclusa (0 €, scritto "Inclusa") / A consuntivo (fuori dal totale, con stima facoltativa).
   - **Spesa esterna**: casella che parte attiva se il foglio dice Sì. Al posto di unità e prezzo chiede il costo IVA inclusa, mostra costo × (1 + maggiorazione) e una "Cifra a preventivo" facoltativa per arrotondare. Se la cifra è sotto il calcolato lo segnala in rosso.
   - **Note**: se Nota obbligatoria = No, il testo di Nota si precompila come nota a piè di pagina modificabile; se = Sì, è il suggerimento di un campo che blocca l'avanzamento finché non è compilato. Le Note interne si mostrano solo a lui.
   - Le voci a giornata di Produzione partono dal numero di date di ripresa.
5. **Attrezzatura**:
   - **Lista**: livello calcolato dal valore.
   - **Livello a mano**.
   - **Nessuna**.
   - Durata (giornata intera o mezza) e giorni, che partono dal numero di date.
   - **Noleggio esterno**: righe con cosa, da quale rental e prezzo IVA esclusa.
     - "Lo pago io": prezzo × 1,22 × (1 + maggiorazione), con cifra arrotondabile; entra nel totale.
     - "Lo paga il cliente": fuori dal totale, scritto "200,00 € + IVA, a parte".
6. **Lista** (solo se si è scelta la lista):
   - articoli per categoria con quantità;
   - riquadro con valore del materiale, livello calcolato, prezzo nel preventivo e differenza rispetto al valore a pezzi;
   - livello forzabile a mano; scelta "Come kit / A pezzi";
   - "Importa da una lista ATT" in archivio;
   - interruttore "Genera anche la lista ATT".
8. **Condizioni**, tutte facoltative e spente: acconto (%), revisioni incluse, tempi di consegna (giorni lavorativi), note generali.
9. **Totale**:
   - cifra finale desiderata, oppure "Nessun arrotondamento";
   - arrotondamento con segno, in su o in giù, e avviso oltre il 15%;
   - compenso per Fiscozen;
   - sezione "Spese a consuntivo": per ogni voce, "Fattura diretta al cliente" oppure "Anticipo io, +26%". Nel secondo caso la stima nel preventivo include la maggiorazione.
10. **Riepilogo**: anteprima del riepilogativo con note numerate, interruttore "Genera anche il dettagliato", cartella e nomi dei file.

Il pannello laterale mostra i totali per fase, attrezzatura, noleggi, totale servizi, rivalsa, bollo, arrotondamento, totale, voci fuori dal totale e compenso Fiscozen.

### 5.2 Lista attrezzatura

1. **Tipo**: per un lavoro (checklist per lui) oppure noleggio a terzi. Per un lavoro si può partire da un preventivo: riprende cliente, titolo, date, luogo, articoli e noleggi esterni, e usa lo stesso codice.
2. **Dati**:
   - lavoro: titolo obbligatorio, cliente facoltativo ("Lavoro personale"), date, luogo, note;
   - noleggio: chi noleggia (obbligatorio), titolo ("Noleggio attrezzatura"), ritiro, riconsegna e giorni. I giorni sono la differenza tra le date a 24 ore (dal 2 al 7 = 5), minimo 1, modificabili.
3. **Articoli**:
   - ricerca; quantità massima pari a quella in inventario, con blocco se superata;
   - nel noleggio solo articoli Noleggiabile = Sì, con prezzo o "incluso" se è 0;
   - per un lavoro anche il noleggio esterno (articolo, fornitore, quantità, chi paga).
4. **Totale** (solo noleggio):
   - subtotale = Σ prezzo × quantità × giorni;
   - sconto: fino a 3 giorni nessuno, 4–5 giorni 15%, 6–10 giorni 20%, oltre 10 giorni 25%;
   - rivalsa 4% sempre, bollo, arrotondamento e compenso Fiscozen come nel preventivo.
5. **Riepilogo**, con **Copia per Trello**:
   - un articolo per riga, senza categorie, nell'ordine delle categorie;
   - `4× Nome` se la quantità è più di 1, solo `Nome` se è 1;
   - noleggi esterni come `Nome (noleggio Fornitore)`.

   Il PDF della lista lavoro è per lui, con caselle vuote; quello del noleggio va a chi noleggia, con prezzi e totale.

**Scelte fatte nello sviluppo (punto 3)**

- Il cliente si sceglie da un menu a tendina (con 15+ clienti l'elenco a pulsanti del prototipo era troppo lungo); nel noleggio è obbligatorio.
- "Partire da un preventivo" arriva con il punto 4, quando esistono i preventivi.
- Trello dall'elenco: le righe si salvano nel JSON della lista alla generazione, così restano uguali anche se il foglio cambia.
- Listini e inventario (menu "Scarica") si generano nella cartella "Listini e inventario" dentro i dati dell'app e si scaricano in PDF. Nomi: `Listino_FilippoMauro_<data listino>`, `ListinoNoleggio_FilippoMauro_<data listino>`, `Inventario_FilippoMauro_<oggi>`. Rigenerare lo stesso listino manda il precedente nel cestino (non sono documenti d'archivio).
- Nel listino completo il noleggio parte su una pagina nuova: l'interruzione di pagina del marcatore `{{#NOLEGGIO}}` passa al titolo, tranne quando prima c'era solo un blocco tolto.

### 5.3 Contratto (9 passi)

1. **Cliente**: per le aziende serve il nome del firmatario; per i privati si applica il foro del consumatore.
2. **Lavoro**: titolo, oggetto, fasi (scritte a mano, ordinabili), data e luogo.
3. **Tempi**: consegna (giorni lavorativi dalle riprese o dal materiale) e modifiche incluse, entrambe facoltative.
4. **Materiale**: girato grezzo escluso (attivo di default), consegna in 24 ore, materiale dal cliente entro N giorni.
5. **Compenso**: totale pagato dal cliente, comprensivo di rivalsa e bollo, scritto anche in lettere.
   - Unica soluzione (alla firma, alle riprese, alla consegna, entro una data) oppure più soluzioni, da 2 a 6, in percentuale o in euro.
   - Controllo che la somma torni e tasto "Assegna il resto all'ultima".
   - Conto per il bonifico dal foglio Conti.
6. **Spese**: tre campi in minuscolo, separati da virgole. Compongono il Punto 6:
   - comprese nel compenso;
   - a consuntivo, fatturate dai fornitori al cliente;
   - a consuntivo, anticipate da lui e rimborsate. Rimanda al preventivo, senza indicare la percentuale.
   Se sono tutti vuoti, il contratto dice che non ci sono spese a carico del cliente.
7. **Licenza**: non esclusiva o esclusiva, usi consentiti, portfolio, citazione dell'autore, musiche di repertorio con libreria.
8. **Foro**: Torino, Torino o sede del cliente, luogo della prestazione; per i privati sempre il consumatore.
9. **Riepilogo.**

**Scelte fatte nello sviluppo (punto 4)**

- Il cliente si sceglie da un menu a tendina, come nelle liste.
- Le categorie del foglio Servizi diventano le fasi così: "Pre-…" → Pre-produzione, "Post-…" → Post-produzione, il resto → Produzione.
- Livello del kit e livello a mano si identificano con il nome del kit (colonna Nome del foglio Kit). I kit senza prezzo per l'unità scelta (giornata o mezza) non si propongono.
- Nel preventivo, in Produzione: prima le voci, poi l'attrezzatura (kit), poi i noleggi esterni.
- Il prezzo di una voce può essere 0 (es. Fisso a 0); l'importo di un Forfait no.
- La lista ATT nata dal preventivo usa il template della lista lavoro e lo stesso codice; i noleggi esterni del preventivo diventano righe di noleggio con chi paga.
- Stato del preventivo e file del dettagliato stanno nel registro (`stato`, e `docDett`/`pdfDett`/`nomeDett` nella versione).
- Se la generazione si interrompe a metà, la copia del template già creata va nel cestino.
- Motore: nelle righe ripetute, un paragrafo fatto solo di segnaposto che restano vuoti non si scrive (es. la descrizione mancante); paragrafi facoltativi vuoti consecutivi si tolgono insieme.

**Dal preventivo**: con "Crea contratto" su un preventivo accettato si apre la stessa procedura, passo per passo e con gli stessi controlli, con i campi precompilati e un avviso in alto. Si precompilano:

- cliente, titolo, descrizione come oggetto, prima data e luogo;
- consegna e revisioni;
- totale al cliente;
- acconto come pagamento in due soluzioni (acconto alla firma, resto alla consegna);
- spese, divise per tipo.

Le fasi restano vuote.

**Scelte fatte nello sviluppo (punto 5)**

- Il cliente si sceglie da un menu a tendina; per le aziende il firmatario parte dalla colonna Referente.
- Almeno una fase è obbligatoria (il Punto 2 dice "si articola nelle seguenti fasi").
- Musiche di repertorio: due campi, Libreria e Piano facoltativo → "dalla libreria Artlist (piano Pro)".
- Soluzioni in percentuale: l'ultima prende il resto in centesimi, così la somma torna sempre al totale.
- Dal preventivo il contratto prende lo stesso codice; se un contratto con quel codice esiste già, diventa la versione successiva. Le spese si uniscono con "e" prima dell'ultima ("alloggio e noleggio di attrezzatura").
- **Testi da far verificare** (non erano nella guida né nel prototipo, li ha proposti Claude): licenza esclusiva ("Per la durata della licenza il Videomaker non concede a terzi l'uso delle opere negli stessi ambiti."), foro "Torino o sede del cliente", foro "luogo della prestazione", e le relative righe del Punto 11 nell'approvazione specifica. Stanno in `js/contratti.js` (fraseLicenza, fraseForo, foroBreve).

### 5.4 Copia di cortesia

1. "Carica PDF Fiscozen": pdf.js estrae il testo e l'app riconosce numero e data, destinatario, righe, rivalsa, bollo, totale, intestatario, IBAN, scadenza e note.
2. Il cliente si riconosce dalla P.IVA o dal C.F. nel foglio Clienti.
3. Schermata di verifica: tutto modificabile, con controllo che righe + rivalsa + bollo = totale. Se non torna, la generazione è bloccata.

---

## 6. Regole di calcolo

Tutti i calcoli si fanno in **centesimi interi**.

- **Rivalsa**: rivalsa = arrotonda(servizi × 0,04).
- **Bollo**: 2,00 € solo se servizi + rivalsa > 77,47 €.
- **Totale calcolato**: servizi + rivalsa + bollo.
- **Arrotondamento**: totale calcolato − cifra desiderata. Positivo è uno sconto, negativo un rialzo.
- **Compenso Fiscozen**: cercare il compenso C in centesimi tale che C + arrotonda(C × 0,04) + bollo(C) = totale desiderato. Se nessun C torna, proporre i due totali raggiungibili più vicini.
- **Kit**:
  - il valore è Σ prezzo lavoro × quantità, a giornata o a mezza giornata; per la mezza, i pezzi senza prezzo di mezza contano a prezzo intero;
  - il livello è il primo con valore ≤ soglia;
  - oltre la soglia del livello più alto si sceglie tra "livello più alto + eccedenza a prezzo pieno" e "prezzo a mano";
  - il prezzo di attrezzatura è prezzo del livello × giorni.
- **Maggiorazione** (Impostazioni, default 26%): è il pareggio con imposta al 5% e contributi INPS al 26% circa sul 78%, tenendo conto che la rivalsa del 4% si aggiunge una sola volta sul totale. Con l'imposta al 15% diventa circa 35%.
  - Si applica a spese esterne, noleggi esterni pagati da lui e voci a consuntivo rifatturate.
  - Il cliente la vede solo sulle voci a consuntivo rifatturate, dove è dichiarata.
- **Noleggi da rental**: sempre IVA esclusa. Lui non può addebitare IVA (forfettario): "+ IVA" compare solo quando fattura il rental direttamente al cliente.
- **Voci "Inclusa" e "A consuntivo"**: non entrano nel totale.

---

## 7. Template e motore dei segnaposto

Vedi `template/Guida ai template.md`: elenco completo dei segnaposto per documento e regole.

- `{{NOME}}`: sostituzione semplice.
- `{{NOME?}}`: facoltativo; se vuoto, si elimina il paragrafo o la riga di tabella che lo contiene.
- `{{ELENCO.CAMPO}}`: riga ripetuta, anche su due livelli (FASE/VOCE, CAT/ART).
- `{{#BLOCCO}}…{{/BLOCCO}}`: blocco che c'è o non c'è.
- `FRASE_…` e `DICITURA_…`: frasi composte dall'app (testi esatti nella guida e nel prototipo).

Il motore va scritto una volta sola come modulo generico, sopra l'API di Google Docs (lettura della struttura, `insertTableRow`, `deleteContentRange`, `replaceAllText`), e va provato su tutti gli 8 template.

**Come è fatto** (`js/motore.js`): lavora a fasi (blocchi, righe di tabella ripetute, paragrafi ripetuti, facoltativi, sostituzioni semplici) e rilegge il documento tra una fase e l'altra. Regole scoperte provando sui template veri:

- Una riga di tabella si ripete se contiene un solo elenco e nessun segnaposto semplice; altrimenti gli elenchi al suo interno sono paragrafi ripetuti (es. NOTA e CONDIZIONE nella cella delle note).
- Le righe di gruppo si creano accanto alla riga modello del gruppo; le righe figlie sotto il loro gruppo, poi rese uguali alla riga modello figlia (celle unite, stile delle celle). Il bordo superiore non si riscrive: è condiviso con la riga sopra.
- Google elenca una cella per colonna anche nelle celle unite (le coperte hanno span 1): la colonna è la posizione nella riga.
- Lo stile di paragrafo va applicato prima di quello del testo: cambiare lo stile con nome azzera la formattazione del testo.
- Tabulazioni: i `.docx` avevano il carattere tab scritto come testo (`\t` dentro `<w:t>`) invece di `<w:tab/>`, e la conversione di Google l'ha scartato tenendo però gli arresti di tabulazione. Il 25 ottobre 2026 i 28 tab mancanti sono stati reinseriti via API nei Documenti Google (copia di sicurezza in "Gestionale FM — dati / Backup template"). Se un template si riconverte dal `.docx`, il problema torna. Gli arresti di tabulazione non si impostano via API, ma le righe copiate dal motore li conservano.
- In Impostazioni, "Prova i template" genera 11 prove (8 template e 3 varianti) nella cartella "Prove template" dei dati dell'app e segnala segnaposto rimasti e link mancanti.

**Link**: nei template logo e nome hanno il link a `https://filippomauro.com`. Va verificato che sopravviva nel PDF esportato da Google.

---

## 8. Ordine di sviluppo

Ogni sezione si prova su `http://localhost:8000` con i fogli veri, poi si pubblica.

1. **Configurazione Google**: login, Picker, Impostazioni, `impostazioni.json` e `registro.json`, lettura dei fogli con controllo delle intestazioni (messaggio chiaro se manca una colonna).
2. **Motore dei template e generazione** Doc + PDF in una cartella cliente.
3. **Liste attrezzatura**, con copia per Trello, inventario e listini.
4. **Preventivi.**
5. **Contratti**, compreso "Crea contratto" dal preventivo.
6. **Copie di cortesia**, con la lettura del PDF di Fiscozen.
7. **Riapertura e versioni** su tutte le sezioni.
8. **PWA**: manifest, icone dal logo, service worker per la parte statica.

### Prove prima di dichiarare finita una sezione

- Totali confrontati a mano su almeno 3 casi: con e senza bollo, con arrotondamento in su e in giù, con voci a consuntivo.
- Compenso Fiscozen che torna al centesimo.
- Nomi dei file e versioni (V01 senza suffisso, V02 creata riaprendo la V01 quando esiste già una V02 → diventa V03).
- Documento generato aperto e controllato in Google Docs e in PDF.

---

## 9. Come lavorare con l'utente

- Prima di cambiare comportamento o struttura, spiega cosa farai in due righe e aspetta l'ok. Per correzioni ovvie procedi.
- Dopo ogni modifica: prova in locale, poi commit con un messaggio in italiano chiaro e push su `main` (GitHub Pages pubblica da solo).
- Aggiorna questo file quando cambia una decisione.
- Non toccare i fogli Google dell'utente: l'app li legge soltanto.
