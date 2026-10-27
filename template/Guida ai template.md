# Template del gestionale

Otto template, uno per ogni documento che il gestionale genera. Il design è quello approvato sul canvas delle anteprime: EB Garamond per titoli e cifre, DM Sans per il testo, ambra #854F0B, filetti sabbia.

| File | Documento | Codice |
|---|---|---|
| PRV — Preventivo riepilogativo | Il preventivo da inviare, senza prezzi unitari | PRV |
| PRV — Preventivo dettagliato | Facoltativo, con prezzi e blocco totali completo | PRV, suffisso `_Dettaglio` |
| ATT — Lista attrezzatura lavoro | Checklist per te, con caselle vuote | ATT |
| ATT — Noleggio a terzi | Lista con prezzi, sconti e totale per chi noleggia | ATT |
| CTR — Contratto | Contratto in 12 punti, con approvazione specifica | CTR |
| CDC — Copia di cortesia | Dal PDF di Fiscozen | CDC |
| LIS — Listino prezzi | Servizi e kit, poi noleggio; anche solo noleggio | — |
| INV — Lista attrezzatura completa | Inventario senza prezzi, con caselle | — |

## Come portarli su Google Docs

1. Crea su Drive una cartella "Template" e caricaci gli otto file.
2. Apri ciascun file e scegli File → Salva come Documenti Google. Poi elimina i .docx, per non selezionare il file sbagliato.
3. Controlla che i font siano DM Sans ed EB Garamond: Google Docs li ha entrambi. Il logo è già inserito.
4. Puoi cambiare stili e testi fissi. Non toccare i segnaposto: il testo tra doppie graffe deve restare identico.
5. Nelle Impostazioni del gestionale selezioni ogni template con il Picker.

## Regole dei segnaposto

- **`{{NOME}}`**: sostituito dal testo. Prende lo stile del segnaposto (font, dimensione, colore).
- **`{{NOME?}}`**: facoltativo. Se il valore è vuoto, l'app elimina l'intero paragrafo o l'intera riga di tabella che lo contiene, etichetta compresa. Esempio: la riga "Marca da bollo {{BOLLO?}}" sparisce quando il bollo non è dovuto.
- **`{{ELENCO.CAMPO}}`**: riga ripetuta. La riga di tabella, o il paragrafo, che contiene il segnaposto viene duplicata per ogni elemento dell'elenco. Quando nella stessa tabella ci sono due livelli (`FASE` e `VOCE`, `CAT` e `ART`), l'app scrive la riga del gruppo seguita dalle sue righe, gruppo dopo gruppo.
- **`{{#BLOCCO}}` … `{{/BLOCCO}}`**: blocco facoltativo, su paragrafi propri. Se il blocco è attivo, l'app toglie solo i due marcatori; se non lo è, toglie tutto quello che c'è in mezzo.
- **`FRASE_…` e `DICITURA_…`**: frasi intere composte dall'app in base alle scelte della procedura. I testi sono qui sotto.
- **Importi**: arrivano già formattati, per esempio `1.234,00 €`. **Date**: `22 ottobre 2026`, tranne nella copia di cortesia, dove si usa il formato della fattura (`22/10/2026`).
- **Numeri di pagina**: sono campi nel piè di pagina; si aggiornano da soli.

## Campi comuni

| Segnaposto | Contenuto |
|---|---|
| `{{NUMERO}}` | Codice del documento, es. `2026-016` |
| `{{DATA}}` | Data del documento |
| `{{CLIENTE_NOME}}` | Ragione sociale o nome |
| `{{CLIENTE_RIGA1}}` | `P.IVA … · SDI …` (aziende) oppure `C.F. …` (privati) |
| `{{CLIENTE_RIGA2}}` | `Indirizzo, CAP Comune (PR)` |
| `{{CLIENTE_RIGA3?}}` | `Referente · email`, se c'è |
| `{{ETICHETTA_4}}` | L'etichetta del 4% dalle Impostazioni |

## PRV — Preventivo

Un solo template, il Documento Google "PRV — Preventivo dettagliato" (il nome è rimasto quello di prima). File senza suffisso. Il preventivo riepilogativo e il dettagliato con la lista attrezzatura non esistono più (decisione del 26 ottobre 2026).

| Segnaposto | Contenuto |
|---|---|
| `{{TIPO_DOC}}` | `PREVENTIVO`, nell'intestazione |
| `{{VALIDITA}}` | Giorni di validità |
| `{{TITOLO}}` | Titolo del progetto |
| `{{DESCRIZIONE?}}` | Breve descrizione per il cliente |
| `{{INFO_LAVORO?}}` | `Riprese: 20 e 21 novembre 2026 · Torino`, oppure con gli intervalli `Riprese: 5 novembre e dal 20 al 23 novembre 2026 · Torino` |
| `{{FASE.NOME}}` | Pre-produzione, Produzione, Post-produzione (solo le fasi con voci) |
| `{{VOCE.NOME}}`, `{{VOCE.DESCRIZIONE}}` | Nome e descrizione per il cliente, dal foglio Servizi |
| `{{VOCE.RIF}}` | Numero della nota a piè di pagina, vuoto se non c'è |
| `{{VOCE.QUANTITA}}`, `{{VOCE.PREZZO}}`, `{{VOCE.IMPORTO}}` | `2 giornate × 2` · `300,00 €` · `1.200,00 €`. Forfait e spese esterne: quantità `forfait`, prezzo vuoto |
| `{{CONDIZIONE}}` | Una riga per condizione: acconto, revisioni, consegna, validità, note generali |
| `{{DICITURA_ESCLUSI?}}` | Frase su voci a consuntivo e noleggi pagati dal cliente |
| `{{TOT_SERVIZI}}`, `{{RIVALSA}}`, `{{BOLLO?}}`, `{{ARROTONDAMENTO?}}`, `{{TOTALE}}` | Totali. L'arrotondamento ha il segno: `−7,20 €` |
| `{{#CON_NOTE}}` … `{{/CON_NOTE}}` | Blocco delle note a piè di pagina; sparisce se non ce ne sono |
| `{{NOTA.RIF}}`, `{{NOTA.TESTO}}` | Note a piè di pagina numerate, un paragrafo per nota |
| `{{#ACCETTAZIONE}}` … `{{/ACCETTAZIONE}}` | Blocco finale facoltativo (interruttore "Accettazione con firma" nel passo Condizioni): titolo `ACCETTAZIONE`, la clausola scritta nel Doc e la tabella delle firme (a sinistra il cliente con `{{CLIENTE_NOME}}`, luogo e data, firma; a destra Filippo Mauro, firma) |

Kit e noleggi compaiono come voci di Produzione: `Attrezzatura tecnica, Kit Completo`, `Noleggio drone, da Rental X`. La riga dell'attrezzatura ha come `{{VOCE.DESCRIZIONE}}` la nota "Cosa include" scritta nella procedura (es. `1 camera, ottiche fisse, kit luci`).

**Disposizione in fondo.** Dopo la tabella delle voci, una tabella a due colonne: a sinistra `CONDIZIONI` (condizioni, dicitura degli esclusi, frase sull'IVA), a destra i totali. Sotto, a tutta larghezza, il blocco `NOTE` con le note numerate: così le note lunghe non allungano la colonna delle condizioni. Per ultimo, se attivo, il blocco `ACCETTAZIONE` con le firme. Il testo della clausola sta nel Documento Google, non nel codice: per cambiarlo basta modificarlo lì.

## ATT — Lista attrezzatura lavoro

| Segnaposto | Contenuto |
|---|---|
| `{{TITOLO}}` | Titolo del lavoro |
| `{{INFO_LAVORO?}}` | Date e luogo delle riprese |
| `{{CAT.NOME}}`, `{{CAT.CONTEGGIO}}` | Categoria, nell'ordine del foglio Categorie, e numero di pezzi |
| `{{ART.QTA}}`, `{{ART.NOME}}` | Quantità e nome |
| `{{#NOLEGGI}}` | Blocco del noleggio esterno |
| `{{NOL.QTA}}`, `{{NOL.NOME}}`, `{{NOL.FORNITORE}}`, `{{NOL.CHI_PAGA}}` | `Paga il cliente` oppure `Pago io` |
| `{{NOTE_LISTA?}}` | Note libere |
| `{{N_ARTICOLI}}` | Totale dei pezzi |

## ATT — Noleggio a terzi

| Segnaposto | Contenuto |
|---|---|
| `{{RITIRO}}`, `{{RICONSEGNA}}`, `{{GIORNI}}` | Date e giorni di noleggio |
| `{{CAT.NOME}}`, `{{ART.QTA}}`, `{{ART.NOME}}` | Come nella lista lavoro |
| `{{ART.PREZZO}}`, `{{ART.IMPORTO}}` | Prezzo noleggio al giorno; importo = prezzo × quantità × giorni. Per gli articoli a prezzo 0 (accessori, batterie, schede): prezzo `incluso`, importo vuoto |
| `{{SUBTOTALE}}` | Somma degli importi |
| `{{SCONTO_PERC}}`, `{{SCONTO?}}` | `15%` e `−45,00 €`. Fino a 3 giorni nessuno sconto; da 4 a 5 il 15%; da 6 a 10 il 20%; oltre 10 il 25% |
| `{{RIVALSA?}}`, `{{BOLLO?}}`, `{{ARROTONDAMENTO?}}`, `{{TOTALE}}` | Come nel preventivo |
| `{{CONDIZIONI_NOLEGGIO?}}` | Facoltativo, per un domani: cauzione, documento, responsabilità |

## CTR — Contratto

| Segnaposto | Testo composto dall'app |
|---|---|
| `{{RIF_PREVENTIVO?}}` | `Rif. preventivo n. 2026-016` |
| `{{OGGETTO}}` | L'oggetto scritto nella procedura, con la prima lettera minuscola e senza punto finale |
| `{{FRASE_RIPRESE?}}` | `Le riprese si svolgeranno a Torino il 21 novembre 2026.`; con più date `… nei giorni 20 e 21 novembre 2026.`; con un intervallo `… dal 20 al 23 novembre 2026.` |
| `{{FASE.N}}`, `{{FASE.TESTO}}` | `1.` e il testo della fase |
| `{{FRASE_CONSEGNA?}}` | `A titolo indicativo, la consegna del lavoro è prevista entro dieci (10) giorni lavorativi dalla fine delle riprese.` (oppure `dalla ricezione del materiale richiesto al Cliente`) |
| `{{FRASE_REVISIONI?}}` | `Sono incluse due (2) revisioni del prodotto finito. Ogni revisione raccoglie in un’unica richiesta tutte le modifiche desiderate.` |
| `{{FRASE_GREZZO?}}` | `Il Cliente riceve il prodotto finito: il girato grezzo e i file di progetto non sono inclusi.` |
| `{{FRASE_24_ORE?}}` | `Il Videomaker consegna il prodotto finito entro ventiquattro (24) ore dalla fine dell’evento.` |
| `{{#MATERIALE_CLIENTE}}`, `{{GIORNI_MATERIALE}}` | Blocco del materiale dal cliente; `quindici (15)` |
| `{{FRASE_COMPENSO}}` | `Il compenso complessivo è di 1.000,00 € (mille/00 euro), comprensivo di rivalsa INPS 4% e imposta di bollo. Operazione in regime forfettario, senza applicazione dell’IVA.` |
| `{{FRASE_PAGAMENTO}}` | `Il pagamento avverrà in un’unica soluzione alla consegna del lavoro.` oppure `… in due soluzioni: 20% (200,00 €) alla firma del contratto; 80% (800,00 €) alla consegna del lavoro.` |
| `{{INTESTATARIO}}`, `{{IBAN}}` | Dal foglio Conti |
| `{{FRASE_SPESE}}` | Vedi sotto |
| `{{FRASE_LICENZA}}` | `Il Videomaker concede al Cliente una licenza non esclusiva, senza limiti di tempo e di territorio, per utilizzare le opere realizzate con il presente contratto nei seguenti ambiti: sito web, social network. Il Cliente può adattarle a formati e piattaforme diversi (ad esempio tagli di durata, cambi di formato, sottotitoli) senza alterarne il contenuto. Utilizzi diversi da quelli indicati vanno concordati per iscritto.` |
| `{{FRASE_PORTFOLIO?}}` | `Il Videomaker può utilizzare le opere, o loro estratti, nel proprio portfolio e sui propri canali professionali, a scopo promozionale. Il Cliente può chiedere di escludere questo utilizzo per contenuti riservati.` |
| `{{FRASE_CITAZIONE?}}` | `Dove il formato lo consente (titoli di coda, descrizione del video, didascalia), il Cliente indica il Videomaker come autore del video.` |
| `{{FRASE_MUSICHE?}}` | `Le musiche di repertorio provengono dalla libreria Artlist (piano Pro), la cui licenza copre gli utilizzi indicati sopra.` |
| `{{FRASE_FORO}}` | `Per qualsiasi controversia derivante dal presente contratto è competente in via esclusiva il foro di Torino.` · variante "Torino o sede del cliente" · variante "luogo della prestazione" · per i privati: `… è competente il foro del luogo di residenza o di domicilio del Cliente, in quanto consumatore.` |
| `{{CLIENTE_FIRMA}}` | `GAM Medical srls, nella persona di Mario Rossi` (aziende) o il nome (privati) |
| `{{APPROVAZIONE.PUNTO}}`, `{{APPROVAZIONE.TESTO}}` | Elenco dinamico, vedi sotto |

### Punto 6 — Spese di trasferta e servizi esterni

L'app compone `{{FRASE_SPESE}}` dalle scelte della procedura. Se ci sono spese di entrambi i tipi, usa le ultime due frasi insieme.

- **Nessuna spesa**: `Il lavoro non prevede spese di trasferta o servizi esterni a carico del Cliente.`
- **Incluse nel compenso**: `Le spese per viaggio e alloggio sono comprese nel compenso indicato al Punto 5.`
- **A consuntivo, fatturate dai fornitori**: `Le spese per alloggio e noleggio di attrezzatura non sono comprese nel compenso: sono a carico del Cliente e gli vengono fatturate direttamente dai fornitori.`
- **A consuntivo, anticipate da te**: `Le spese per viaggio e vitto non sono comprese nel compenso: sono anticipate dal Videomaker e rimborsate dal Cliente con fattura, secondo quanto indicato nel preventivo n. 2026-016.`

### Approvazione specifica

L'app elenca solo i punti presenti nel contratto:

| Punto | Testo | Quando compare |
|---|---|---|
| Punto 4 | Ritardo nell’invio del materiale e riprogrammazione del lavoro | Se il cliente deve inviare materiale |
| Punto 7 | Licenza efficace dopo il pagamento integrale del compenso | Sempre |
| Punto 8 | Costi di annullamento e recesso | Sempre |
| Punto 9 | Cancellazione dei file dopo due anni dalla consegna | Sempre |
| Punto 11 | Deroga alla competenza territoriale (foro di …) | Solo per le aziende |

## CDC — Copia di cortesia

| Segnaposto | Contenuto |
|---|---|
| `{{NUMERO}}`, `{{DATA}}` | `38 / 2026`, `22/10/2026` |
| `{{DEST_NOME}}`, `{{DEST_RIGA1}}`, `{{DEST_RIGA2}}`, `{{DEST_RIGA3?}}` | Destinatario come nel PDF di Fiscozen |
| `{{RIGA.DESCRIZIONE}}`, `{{RIGA.IMPORTO}}` | Righe della fattura |
| `{{RIVALSA?}}`, `{{BOLLO?}}`, `{{TOTALE}}` | Come in fattura |
| `{{INTESTATARIO}}`, `{{IBAN}}` | Dati di pagamento |
| `{{FRASE_SCADENZA?}}` | `Da saldare entro il 28/08/2026` |
| `{{NOTE}}` | Note della fattura |

## LIS — Listino prezzi

| Segnaposto | Contenuto |
|---|---|
| `{{DATA_LISTINO}}` | Data dalle Impostazioni |
| `{{#SERVIZI}}` | Pagina servizi e kit. Nel "solo noleggio" viene tolta |
| `{{FASE.NOME}}`, `{{SERV.NOME}}`, `{{SERV.DESCRIZIONE}}` | Servizi con Nel listino = Sì |
| `{{SERV.GIORNATA}}`, `{{SERV.MEZZA}}`, `{{SERV.ORA}}` | `300,00 €` oppure `—`. Se manca ogni prezzo: `su preventivo` nella prima colonna |
| `{{KIT.NOME}}`, `{{KIT.DESCRIZIONE}}`, `{{KIT.GIORNATA}}`, `{{KIT.MEZZA}}` | Dal foglio Kit |
| `{{#NOLEGGIO}}` | Pagina noleggio |
| `{{CAT.NOME}}`, `{{ART.NOME}}`, `{{ART.PREZZO}}` | Articoli con Noleggiabile = Sì e Attivo = Sì. Con prezzo di noleggio 0 il prezzo è `incluso` |

## INV — Lista attrezzatura completa

| Segnaposto | Contenuto |
|---|---|
| `{{DATA}}` | Data di generazione |
| `{{CAT.NOME}}`, `{{CAT.CONTEGGIO}}`, `{{ART.QTA}}`, `{{ART.NOME}}` | Tutti gli articoli con Attivo = Sì |
| `{{N_ARTICOLI}}` | Totale dei pezzi |
