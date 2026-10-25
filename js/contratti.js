/* ---------- Contratti ----------
   Sezione Contratti: elenco, procedura guidata in 9 passi (CLAUDE.md, 5.3),
   "Crea contratto" da un preventivo accettato e generazione del documento.
   Le frasi del contratto seguono template/Guida ai template.md. */

import { $, esc, store, toast, modal, closeModal } from "./util.js";
import { stato } from "./dati.js";
import { clienti, listino, righeCliente } from "./anagrafiche.js";
import { prossimoCodice, prossimaVersione, registra, documenti, trova, datiVersione } from "./registro.js";
import { cartellaCliente, generaDocumento } from "./genera.js";
import { nomeFile, nomeCartellaCliente } from "./nomi.js";
import { rigaDocumento, linkDoc } from "./elenco.js";
import { gestisciErrore, CollegamentoMancante } from "./errori.js";
import { opzione, interruttore, selezione, barraPassi, salvata, avanzamento, campoDate, azioneDate, erroreDate } from "./procedura.js";
import { registraApritore, avvisoModifica, ultimaVersione } from "./riapertura.js";
import { numero, centesimi, eur, cifraCampo, qta, oggi, dataLunga, dataBreve, euroInLettere, conLettere, normalizzaDate, giorniDate, elencoDate } from "./calcoli.js";

/* ---------- Bozza ---------- */
const BKEY = "fm-bozza-contratto-v3";
const BASE = () => ({step: "cliente", visited: ["cliente"], cli: "", firmatario: "", titolo: "", oggetto: "", fasi: [""], date: [{da: "", a: "", intervallo: false}], luogo: "",
  consegnaOn: false, consegnaGiorni: "10", consegnaDa: "riprese", modificheOn: false, modificheN: "2",
  grezzo: true, h24: false, materialeOn: false, materialeGiorni: "15",
  totale: "", multi: false, unicaQuando: "consegna", unicaData: "", modo: "perc",
  rate: [{val: "", quando: "firma", data: ""}, {val: "", quando: "consegna", data: ""}], conto: "",
  speseIncluse: "", speseFornitori: "", speseAnticipate: "",
  licenza: "non", usi: ["web", "social"], usiAltro: "", portfolio: true, citazione: true, musicaOn: false, musicaLibreria: "", musicaPiano: "",
  foro: "torino", rifPrv: "", edit: null, saved: null});
let b = store.get(BKEY, null);
if (b) b = Object.assign(BASE(), b);
const salva = () => { b.saved = new Date().toISOString(); store.set(BKEY, b); };
export const haBozza = () => !!b && !!(b.cli || b.titolo);

const PASSI = [["cliente", "Cliente"], ["lavoro", "Lavoro"], ["tempi", "Tempi"], ["materiale", "Materiale"], ["compenso", "Compenso"], ["spese", "Spese"], ["licenza", "Licenza"], ["foro", "Foro"], ["riep", "Riepilogo"]];
const ETICHETTE = Object.fromEntries(PASSI);
const passi = () => PASSI.map(p => p[0]);

const USI = [["web", "Sito web"], ["social", "Social network"], ["piattaforme", "Altre piattaforme video online"], ["tv", "Televisione"], ["cinema", "Cinema e festival"], ["eventi", "Eventi e fiere"], ["stampa", "Stampa (fotogrammi)"]];
const QUANDO = [["firma", "Alla firma"], ["riprese", "Il giorno delle riprese"], ["consegna", "Alla consegna"], ["data", "Entro una data"]];
const QUANDO_TESTO = {firma: "alla firma del contratto", riprese: "il giorno delle riprese", consegna: "alla consegna del lavoro"};
const FORI = {
  torino: ["Foro di Torino", "Competente in via esclusiva Torino"],
  intermedio: ["Torino o sede del cliente", "Torino in alternativa al luogo di residenza o sede del cliente"],
  prestazione: ["Luogo della prestazione", "Dove si svolge il lavoro principale"]
};
const NUMERI = ["", "", "due", "tre", "quattro", "cinque", "sei"];

/* ---------- Dati dai fogli ---------- */
let C = null;
async function caricaFogli(){ C = await clienti(); }
const cliente = () => b.cli && C ? C.clienti.find(c => c.id === b.cli) || null : null;
const privato = () => cliente()?.tipo === "Privato";
const conto = () => C?.conti.find(x => x.iban === b.conto) || C?.conti[0] || null;

/* ---------- Pagamento ---------- */
const totaleC = () => centesimi(b.totale) || 0;
const quandoTesto = (q, data) => q === "data" ? (data ? "entro il " + dataLunga(data) : "entro una data da indicare") : QUANDO_TESTO[q];

// Somma delle soluzioni rispetto al totale (in percentuale o in centesimi).
function sommaRate(){
  const perc = b.modo === "perc";
  const somma = b.rate.reduce((s, r) => s + (perc ? (numero(r.val) || 0) : (centesimi(r.val) || 0)), 0);
  const obiettivo = perc ? 100 : totaleC();
  const ok = obiettivo > 0 && Math.abs(somma - obiettivo) < (perc ? 0.001 : 0.5);
  return {somma, obiettivo, ok, diff: obiettivo - somma, perc};
}

/* Importo di ogni soluzione in centesimi: in percentuale l'ultima prende il resto,
   così la somma torna sempre al centesimo. */
function importiRate(){
  const tot = totaleC();
  if (b.modo !== "perc") return b.rate.map(r => centesimi(r.val) || 0);
  const v = b.rate.map(r => Math.round(tot * (numero(r.val) || 0) / 100));
  v[v.length - 1] = tot - v.slice(0, -1).reduce((s, x) => s + x, 0);
  return v;
}

/* ---------- Frasi del contratto ---------- */
const pct = n => qta(n) + "%";
function frasePagamento(){
  if (!b.multi) return `Il pagamento avverrà in un’unica soluzione ${quandoTesto(b.unicaQuando, b.unicaData)}.`;
  const imp = importiRate();
  const parti = b.rate.map((r, i) => `${b.modo === "perc" ? `${pct(numero(r.val) || 0)} (${eur(imp[i])})` : eur(imp[i])} ${quandoTesto(r.quando, r.data)}`);
  return `Il pagamento avverrà in ${NUMERI[b.rate.length]} soluzioni: ${parti.join("; ")}.`;
}
function fraseCompenso(){
  const L4 = stato.impostazioni.etichetta4, l = L4.charAt(0).toLowerCase() + L4.slice(1);
  return `Il compenso complessivo è di ${eur(totaleC())} (${euroInLettere(totaleC())}), comprensivo di ${l} e imposta di bollo. Operazione in regime forfettario, senza applicazione dell’IVA.`;
}
function fraseSpese(){
  const p = [], s = x => x.trim();
  if (s(b.speseIncluse)) p.push(`Le spese per ${s(b.speseIncluse)} sono comprese nel compenso indicato al Punto 5.`);
  if (s(b.speseFornitori)) p.push(`Le spese per ${s(b.speseFornitori)} non sono comprese nel compenso: sono a carico del Cliente e gli vengono fatturate direttamente dai fornitori.`);
  if (s(b.speseAnticipate)) p.push(`Le spese per ${s(b.speseAnticipate)} non sono comprese nel compenso: sono anticipate dal Videomaker e rimborsate dal Cliente con fattura${b.rifPrv ? `, secondo quanto indicato nel preventivo n. ${b.rifPrv}` : ", per l’importo concordato tra le parti"}.`);
  return p.length ? p.join(" ") : "Il lavoro non prevede spese di trasferta o servizi esterni a carico del Cliente.";
}
function usiTesto(){
  const u = USI.filter(([k]) => b.usi.includes(k)).map(([, l]) => l.toLowerCase());
  if (b.usiAltro.trim()) u.push(b.usiAltro.trim());
  return u.join(", ");
}
function fraseLicenza(){
  const adatta = "Il Cliente può adattarle a formati e piattaforme diversi (ad esempio tagli di durata, cambi di formato, sottotitoli) senza alterarne il contenuto. Utilizzi diversi da quelli indicati vanno concordati per iscritto.";
  return b.licenza === "escl"
    ? `Il Videomaker concede al Cliente una licenza esclusiva, senza limiti di tempo e di territorio, per utilizzare le opere realizzate con il presente contratto nei seguenti ambiti: ${usiTesto()}. Per la durata della licenza il Videomaker non concede a terzi l’uso delle opere negli stessi ambiti. ${adatta}`
    : `Il Videomaker concede al Cliente una licenza non esclusiva, senza limiti di tempo e di territorio, per utilizzare le opere realizzate con il presente contratto nei seguenti ambiti: ${usiTesto()}. ${adatta}`;
}
function fraseForo(){
  if (privato()) return "Per qualsiasi controversia derivante dal presente contratto è competente il foro del luogo di residenza o di domicilio del Cliente, in quanto consumatore.";
  if (b.foro === "intermedio") return "Per qualsiasi controversia derivante dal presente contratto è competente il foro di Torino o, in alternativa, il foro del luogo in cui il Cliente ha la propria sede.";
  if (b.foro === "prestazione") return `Per qualsiasi controversia derivante dal presente contratto è competente il foro del luogo in cui si svolge la prestazione principale${b.luogo.trim() ? ` (${b.luogo.trim()})` : ""}.`;
  return "Per qualsiasi controversia derivante dal presente contratto è competente in via esclusiva il foro di Torino.";
}
const foroBreve = () => b.foro === "intermedio" ? "foro di Torino o della sede del Cliente" : b.foro === "prestazione" ? `foro del luogo della prestazione${b.luogo.trim() ? `, ${b.luogo.trim()}` : ""}` : "foro di Torino";
/* "il 21 novembre 2026", "dal 20 al 23 novembre 2026", "nei giorni 20 e 21 novembre 2026". */
function fraseRiprese(){
  const l = b.luogo.trim(), giorni = giorniDate(b.date), testo = elencoDate(b.date);
  const date = b.date.filter(x => x.da), quando = !testo ? "" : giorni.length === 1 ? " il " + testo : date.length === 1 ? " " + testo : " nei giorni " + testo;
  if (!l && !quando) return "";
  return `Le riprese si svolgeranno${l ? " a " + l : ""}${quando}.`;
}
function fraseRevisioni(){
  const n = parseInt(b.modificheN, 10) || 0;
  if (n === 0) return "Non sono incluse revisioni del prodotto finito.";
  if (n === 1) return "È inclusa una (1) revisione del prodotto finito. La revisione raccoglie in un’unica richiesta tutte le modifiche desiderate.";
  return `Sono incluse ${conLettere(n)} revisioni del prodotto finito. Ogni revisione raccoglie in un’unica richiesta tutte le modifiche desiderate.`;
}
// Oggetto: prima lettera minuscola, senza punto finale (segue "ha per oggetto").
const oggetto = () => { const s = b.oggetto.trim().replace(/[.\s]+$/, ""); return s ? s.charAt(0).toLowerCase() + s.slice(1) : ""; };
const firma = () => { const c = cliente(); return !c ? "" : c.tipo === "Privato" ? c.nome : `${c.nome}, nella persona di ${b.firmatario.trim()}`; };

function approvazioni(){
  const a = [];
  if (b.materialeOn) a.push({PUNTO: "Punto 4", TESTO: "Ritardo nell’invio del materiale e riprogrammazione del lavoro"});
  a.push({PUNTO: "Punto 7", TESTO: "Licenza efficace dopo il pagamento integrale del compenso"});
  a.push({PUNTO: "Punto 8", TESTO: "Costi di annullamento e recesso"});
  a.push({PUNTO: "Punto 9", TESTO: "Cancellazione dei file dopo due anni dalla consegna"});
  if (!privato()) a.push({PUNTO: "Punto 11", TESTO: `Deroga alla competenza territoriale (${foroBreve()})`});
  return a;
}

/* ---------- Sezione Contratti ---------- */
export function vistaSezione(){
  const docs = documenti("CTR").slice().sort((x, y) => y.codice.localeCompare(x.codice));
  return `<div class="page">
    <div class="page-head"><div><h1>Contratti</h1><p>Salvati in Archivio contratti, una cartella per cliente.</p></div>
      <div class="actions"><button class="btn" data-action="carica-pdf" data-tipo="CTR">Carica PDF</button><button class="btn primary" data-action="ctr-nuovo">Nuovo contratto</button></div></div>
    <div class="toolbar"><input class="search" type="search" placeholder="Cerca per cliente, lavoro o codice" data-filter aria-label="Cerca"><span class="muted" style="font-size:14px">${docs.length} ${docs.length === 1 ? "contratto" : "contratti"}</span></div>
    <div id="docs">${docs.length ? docs.map(d => rigaDocumento(d)).join("") : `<p class="empty">Nessun contratto. Inizia da “Nuovo contratto”, oppure da “Crea contratto” su un preventivo accettato.</p>`}</div>
  </div>`;
}

export function cardBozza(){
  if (!haBozza()) return "";
  const i = Math.max(0, passi().indexOf(b.step));
  return `<div class="draft-card"><div><strong>Contratto in sospeso</strong><div class="muted">${b.titolo ? esc(b.titolo) + ", " : ""}passo ${i + 1} di ${PASSI.length}${b.saved ? ", salvato il " + dataBreve(b.saved.slice(0, 10)) : ""}</div></div><a class="btn primary" href="#contratti-nuovo">Riprendi</a></div>`;
}

const vai = () => { if (location.hash === "#contratti-nuovo") window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "contratti-nuovo"; };
export function nuovoContratto(){
  if (haBozza()){
    const i = Math.max(0, passi().indexOf(b.step));
    modal("C’è un contratto in sospeso", `<p>${b.titolo ? esc(b.titolo) + ", " : ""}fermo al passo ${i + 1} di ${PASSI.length}. Vuoi riprenderlo o ricominciare da zero?</p>`,
      [{label: "Ricomincia", fn: () => { b = BASE(); store.del(BKEY); vai(); }}, {label: "Riprendi", primary: true, fn: vai}]);
  } else { b = BASE(); vai(); }
}

/* Riapre un contratto salvato: tutti i passi sono già visitati. */
registraApritore("CTR", (d, v, dati) => {
  const apri = () => {
    b = Object.assign(BASE(), JSON.parse(JSON.stringify(dati)), {cli: dati.cli ?? d.cliente?.id ?? "", titolo: dati.titolo ?? d.titolo, edit: {codice: d.codice, v, cosa: "del contratto"}, step: "cliente", visited: passi()});
    delete b.importiRate;
    salva(); vai();
  };
  if (haBozza()) modal("C’è un contratto in sospeso", "<p>Se apri questo contratto per modificarlo, la bozza in sospeso viene sostituita.</p>", [{label: "Annulla"}, {label: "Sostituisci", primary: true, fn: apri}]);
  else apri();
});

/* "Crea contratto" su un preventivo accettato: stessa procedura, campi precompilati.
   Le fasi restano vuote. */
export function daPreventivo(codice){
  const crea = async () => {
    try {
      const d = trova(codice, "PRV"), p = await datiVersione(d), L = await listino();
      const nome = (id, v) => (v.libera ? v.nome : L.servizi.find(s => s.id === id)?.nome || "").trim().toLowerCase();
      const voci = Object.entries(p.voci || {}).filter(([, v]) => v.on);
      // "alloggio, vitto e noleggio di attrezzatura"
      const unici = a => { const u = [...new Set(a.filter(Boolean))]; return u.length > 1 ? u.slice(0, -1).join(", ") + " e " + u[u.length - 1] : u.join(""); };
      const incluse = voci.filter(([, v]) => v.modo === "tot" && v.esterna).map(([id, v]) => nome(id, v)).concat((p.noleggi || []).some(n => n.paga !== "cliente") ? ["noleggio di attrezzatura"] : []);
      const fornitori = voci.filter(([, v]) => v.modo === "cons" && v.fatt !== "io").map(([id, v]) => nome(id, v)).concat((p.noleggi || []).some(n => n.paga === "cliente") ? ["noleggio di attrezzatura"] : []);
      const anticipate = voci.filter(([, v]) => v.modo === "cons" && v.fatt === "io").map(([id, v]) => nome(id, v));
      const acc = numero(p.accontoPerc), conAcconto = !!(p.accontoOn && acc > 0 && acc < 100);
      b = Object.assign(BASE(), {
        cli: d.cliente?.id || "", titolo: d.titolo, oggetto: p.desc || "", date: normalizzaDate(p.date).length ? normalizzaDate(p.date) : BASE().date, luogo: p.luogo || "",
        consegnaOn: !!p.consOn, consegnaGiorni: p.consGiorni || "10", modificheOn: !!p.revOn, modificheN: p.revN || "2",
        totale: p.conto?.voluto ? cifraCampo(p.conto.voluto) : "",
        multi: conAcconto, modo: "perc",
        rate: conAcconto ? [{val: qta(acc), quando: "firma", data: ""}, {val: qta(100 - acc), quando: "consegna", data: ""}] : BASE().rate,
        speseIncluse: unici(incluse), speseFornitori: unici(fornitori), speseAnticipate: unici(anticipate), rifPrv: codice});
      salva(); vai();
    } catch(e){ gestisciErrore(e, crea); }
  };
  if (haBozza()) modal("C’è un contratto in sospeso", `<p>Se crei il contratto dal preventivo ${esc(codice)}, la bozza in sospeso viene sostituita.</p>`, [{label: "Annulla"}, {label: "Sostituisci", primary: true, fn: crea}]);
  else crea();
}

/* ---------- Procedura ---------- */
const F = "data-c";   // attributo dei campi di questa procedura

export async function vistaProcedura(view){
  if (!b) b = BASE();
  view.innerHTML = `<div class="page"><p class="loading">Leggo clienti e conti dal foglio…</p></div>`;
  try { await caricaFogli(); }
  catch(e){
    view.innerHTML = `<div class="page"><div class="page-head"><div><h1>Nuovo contratto</h1><p>${esc(e.message)}</p></div></div><a class="btn" href="#contratti">Torna ai contratti</a></div>`;
    gestisciErrore(e, () => vistaProcedura(view));
    return;
  }
  if (!b.conto && C.conti.length) b.conto = C.conti[0].iban;
  // I contratti salvati prima avevano una sola data ("data"): diventa il primo giorno dell'elenco.
  if (b.data && !normalizzaDate(b.date).some(x => x.da)) b.date = [{da: b.data, a: "", intervallo: false}];
  delete b.data;
  b.date = normalizzaDate(b.date); if (!b.date.length) b.date = BASE().date;
  const st = passi(), i = st.indexOf(b.step), ultimo = i === st.length - 1;
  view.innerHTML = `<div class="wiz"><div class="wiz-main">
    <a class="wiz-back" href="#contratti">‹ Contratti</a>
    <div class="wiz-title"><h1>${b.edit ? "Modifica contratto " + esc(b.edit.codice) : "Nuovo contratto"}</h1><button class="btn small panel-toggle" data-action="panel">Riepilogo</button></div>
    ${avvisoModifica(b.edit)}
    ${b.rifPrv && !b.edit ? `<div class="note" style="margin-bottom:18px">Precompilato dal preventivo ${esc(b.rifPrv)}: controlla ogni passo prima di andare avanti. Le fasi del progetto sono da scrivere.</div>` : ""}
    <ol class="steps" id="csteps">${barraPassi(st, ETICHETTE, b.step, b.visited, "c-goto")}</ol>
    <section id="stepBody">${passoHTML()}</section>
    <div class="err" id="err" role="alert"></div>
    <div class="wiz-foot">
      <button class="btn" data-action="c-prev" ${i === 0 ? "disabled" : ""}>Indietro</button>
      ${ultimo ? `<button class="btn primary" data-action="c-genera">${b.edit ? "Salva nuova versione" : "Genera contratto"}</button>` : `<button class="btn primary" data-action="c-next">Avanti</button>`}
    </div>
  </div><aside class="panel" id="panel" aria-label="Riepilogo">${pannello()}</aside></div>`;
  dalVivo();
  window.scrollTo(0, 0);
}

function rateHTML(){
  const unita = b.modo === "perc" ? "%" : "€";
  return b.rate.map((r, i) => `<div class="rate-row">
      <span class="rn">${i + 1}</span>
      <input class="inp" inputmode="decimal" data-rata="${i}" data-k="val" value="${esc(r.val)}" aria-label="Importo soluzione ${i + 1}">
      <span>${unita}</span>
      ${selezione(`data-rata="${i}" data-k="quando" aria-label="Quando"`, QUANDO, r.quando)}
      <div class="extra">${r.quando === "data" ? `<input class="inp" type="date" data-rata="${i}" data-k="data" value="${esc(r.data)}" aria-label="Data" style="max-width:180px">` : ""}<span class="conv" data-conv="${i}"></span></div>
    </div>`).join("");
}

function passoHTML(){
  const c = cliente();
  switch (b.step){
    case "cliente": return `<h2 class="field-q">Per quale cliente?</h2><p class="hint">L’elenco arriva dal foglio Clienti.</p>
      <label class="f"><span>Cliente</span>${selezione(`${F}="cli" style="max-width:420px"`, [["", "Scegli dal foglio Clienti"], ...C.clienti.map(x => [x.id, `${x.nome} (${x.id})`])], b.cli)}</label>
      ${c?.tipo === "Privato" ? `<div class="note">Cliente privato: nel contratto si applica in automatico il foro del consumatore.</div>` : ""}
      ${c?.tipo === "Azienda" ? `<label class="f" style="margin-top:18px"><span>Chi firma per l’azienda</span><input class="inp" ${F}="firmatario" value="${esc(b.firmatario)}" placeholder="Nome e cognome"></label>` : ""}`;

    case "lavoro": return `<h2 class="field-q">Di che lavoro si tratta?</h2><p class="hint">Il titolo finisce nel nome del file, l’oggetto e le fasi nel contratto.</p>
      <label class="f"><span>Titolo del progetto</span><input class="inp" ${F}="titolo" value="${esc(b.titolo)}" placeholder="Es. Videocorso ADHD"></label>
      <label class="f"><span>Oggetto del contratto</span><textarea class="inp" ${F}="oggetto" placeholder="Es. Riprese e montaggio con grafiche di pillole video per un corso di formazione.">${esc(b.oggetto)}</textarea><div class="cnt" id="oggHint"></div></label>
      <div class="f"><span>Fasi del progetto</span>
        ${b.fasi.map((f, i) => `<div class="fase-row"><input class="inp" data-fase="${i}" value="${esc(f)}" placeholder="Es. Riprese con doppia camera" aria-label="Fase ${i + 1}">
          <button class="btn small" data-action="c-faseup" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Sposta su">Su</button>
          <button class="btn small" data-action="c-fasedel" data-i="${i}" aria-label="Togli fase">Togli</button></div>`).join("")}
        <button class="btn small" data-action="c-faseadd" style="margin-top:4px">Aggiungi fase</button></div>
      ${campoDate("c", b.date, "Date delle riprese (facoltative)")}
      <label class="f"><span>Luogo (facoltativo)</span><input class="inp" ${F}="luogo" value="${esc(b.luogo)}" placeholder="Es. Torino"></label>
      <div class="frase"><small>Testo nel contratto, Punto 2</small><p id="frasePunto2"></p></div>`;

    case "tempi": return `<h2 class="field-q">Tempi e modifiche</h2><p class="hint">Entrambi facoltativi: se li lasci spenti, nel contratto non compaiono.</p>
      ${interruttore(F, "consegnaOn", b.consegnaOn, "Indica i tempi di consegna", "Stima in giorni lavorativi")}
      ${b.consegnaOn ? `<div class="sub"><label class="f"><span>Giorni lavorativi</span><input class="inp num" type="number" min="1" ${F}="consegnaGiorni" value="${esc(b.consegnaGiorni)}"></label>
        <label class="f"><span>A partire da</span>${selezione(`${F}="consegnaDa" style="max-width:320px"`, [["riprese", "Fine delle riprese"], ["materiale", "Ricezione del materiale del cliente"]], b.consegnaDa)}</label></div>` : ""}
      ${interruttore(F, "modificheOn", b.modificheOn, "Indica il numero di modifiche incluse", "Giri di revisione sul prodotto finito")}
      ${b.modificheOn ? `<div class="sub"><label class="f"><span>Modifiche incluse</span><input class="inp num" type="number" min="0" ${F}="modificheN" value="${esc(b.modificheN)}"></label></div>` : ""}`;

    case "materiale": return `<h2 class="field-q">Girato e materiale</h2><p class="hint">Attiva solo le clausole che servono a questo lavoro.</p>
      ${interruttore(F, "grezzo", b.grezzo, "Il girato grezzo non è incluso", "Il cliente riceve solo il prodotto finito")}
      ${interruttore(F, "h24", b.h24, "Consegna entro 24 ore dall’evento", "Per eventi con consegna rapida")}
      ${interruttore(F, "materialeOn", b.materialeOn, "Il cliente deve fornirmi del materiale", "Loghi, musiche, testi, grafiche")}
      ${b.materialeOn ? `<div class="sub"><label class="f"><span>Entro quanti giorni dalla firma</span><input class="inp num" type="number" min="1" ${F}="materialeGiorni" value="${esc(b.materialeGiorni)}"></label></div>` : ""}`;

    case "compenso": return `<h2 class="field-q">Compenso e pagamento</h2><p class="hint">Importo che il cliente paga in totale, rivalsa e bollo compresi.</p>
      <label class="f"><span>Compenso totale (€)</span><input class="inp num" inputmode="decimal" ${F}="totale" value="${esc(b.totale)}" placeholder="0,00"><div class="lettere" id="lettere"></div></label>
      ${interruttore(F, "multi", b.multi, "Pagamento in più soluzioni", "Se è spento, il pagamento è in un’unica soluzione")}
      ${!b.multi ? `<div class="sub"><label class="f"><span>Quando</span>${selezione(`${F}="unicaQuando" style="max-width:260px"`, QUANDO, b.unicaQuando)}</label>
          ${b.unicaQuando === "data" ? `<label class="f"><span>Data</span><input class="inp" type="date" ${F}="unicaData" value="${esc(b.unicaData)}" style="max-width:200px"></label>` : ""}</div>`
      : `<div class="sub">
          <label class="f"><span>Numero di soluzioni</span>${selezione(`${F}="nRate" style="max-width:120px"`, [2, 3, 4, 5, 6].map(n => [n, n]), b.rate.length)}</label>
          <div class="seg" role="radiogroup" aria-label="Modalità" style="margin-bottom:14px">${[["perc", "In percentuale"], ["euro", "In euro"]].map(([v, l]) => `<label><input type="radio" name="c-modo" value="${v}" ${F}="modo" ${b.modo === v ? "checked" : ""}>${l}</label>`).join("")}</div>
          ${rateHTML()}
          <div class="check" id="check"></div>
          <button class="btn small" data-action="c-resto">Assegna il resto all’ultima</button>
        </div>`}
      <label class="f" style="margin-top:20px"><span>Conto per il bonifico</span>${C.conti.length ? selezione(`${F}="conto" style="max-width:420px"`, C.conti.map(x => [x.iban, `${x.banca || "Conto"} · ${x.iban}`]), b.conto) : `<span class="err" style="display:block">Il foglio Conti è vuoto: aggiungi almeno un conto.</span>`}</label>
      <div class="frase"><small>Testo nel contratto, Punto 5</small><p id="frase"></p></div>`;

    case "spese": return `<h2 class="field-q">Spese di trasferta e servizi esterni</h2><p class="hint">Scrivi le spese in minuscolo, separate da virgole (es. viaggio, alloggio). Lascia vuoto quello che non serve: se è tutto vuoto, il contratto dice che non ci sono spese a carico del cliente.</p>
      <label class="f"><span>Comprese nel compenso</span><input class="inp" ${F}="speseIncluse" value="${esc(b.speseIncluse)}" placeholder="Es. viaggio e vitto"></label>
      <label class="f"><span>A consuntivo, fatturate dai fornitori al cliente</span><input class="inp" ${F}="speseFornitori" value="${esc(b.speseFornitori)}" placeholder="Es. alloggio, noleggio di attrezzatura"></label>
      <label class="f"><span>A consuntivo, anticipate da me e rimborsate</span><input class="inp" ${F}="speseAnticipate" value="${esc(b.speseAnticipate)}" placeholder="Es. permessi"></label>
      <div class="frase"><small>Testo nel contratto, Punto 6</small><p id="fraseSpese"></p></div>`;

    case "licenza": return `<h2 class="field-q">Licenza d’uso</h2><p class="hint">Gli adattamenti di formato sono sempre consentiti.</p>
      ${opzione(F, "licenza", "non", b.licenza, "Non esclusiva", "Il cliente usa il video negli ambiti scelti, i diritti restano a me")}
      ${opzione(F, "licenza", "escl", b.licenza, "Esclusiva", "Negli ambiti scelti il video lo usa solo il cliente")}
      <h3 class="grp">Dove potrà usarlo</h3>
      ${USI.map(([k, l]) => `<label class="opt"><input type="checkbox" value="${k}" ${F}="usi" ${b.usi.includes(k) ? "checked" : ""}><span>${l}</span></label>`).join("")}
      <label class="f" style="margin-top:12px"><span>Altro (facoltativo)</span><input class="inp" ${F}="usiAltro" value="${esc(b.usiAltro)}" placeholder="Es. piattaforme di formazione online"></label>
      <h3 class="grp">Altre condizioni</h3>
      ${interruttore(F, "portfolio", b.portfolio, "Posso usare il lavoro nel mio portfolio")}
      ${interruttore(F, "citazione", b.citazione, "Il cliente cita il mio nome come autore", "Dove il formato lo permette")}
      ${interruttore(F, "musicaOn", b.musicaOn, "Uso musiche di repertorio", "Indica la libreria: la sua licenza deve coprire gli usi scelti sopra")}
      ${b.musicaOn ? `<div class="sub row2"><label class="f"><span>Libreria</span><input class="inp" ${F}="musicaLibreria" value="${esc(b.musicaLibreria)}" placeholder="Es. Artlist"></label>
        <label class="f"><span>Piano (facoltativo)</span><input class="inp" ${F}="musicaPiano" value="${esc(b.musicaPiano)}" placeholder="Es. Pro"></label></div>` : ""}
      <div class="frase"><small>Testo nel contratto, Punto 7</small><p id="fraseLicenza"></p></div>`;

    case "foro": return privato()
      ? `<h2 class="field-q">Foro competente</h2><div class="note">${esc(c.nome)} è un cliente privato: si applica il foro del consumatore, cioè quello del suo luogo di residenza. Non c’è niente da scegliere.</div>`
      : `<h2 class="field-q">Foro competente</h2><p class="hint">Dove si discute un’eventuale controversia.</p>
        ${Object.entries(FORI).map(([k, [l, h]]) => opzione(F, "foro", k, b.foro, l, h)).join("")}
        <div class="frase"><small>Testo nel contratto, Punto 11</small><p id="fraseForo"></p></div>`;

    case "riep": {
      const {codice, v} = codiceProvvisorio(), cartella = stato.impostazioni.file.archivioContratti?.name || "Archivio contratti";
      const nome = nomeFile({codice, tipo: "CTR", titolo: b.titolo, cliente: c?.nome, versione: v});
      return `<h2 class="field-q">Controlla e genera</h2><p class="hint">Puoi tornare a qualsiasi passo dalla barra in alto.</p>
        ${riepilogo()}
        <div class="frase"><small>Pagamento</small><p id="frase"></p></div>
        <div class="out">
          <p><strong>Cartella</strong><br>${esc(cartella)} / ${esc(nomeCartellaCliente(c))}</p>
          <p><strong>File</strong><br><span class="fname">${esc(nome)}</span> <span class="muted">(Google Doc)</span><br><span class="fname">${esc(nome)}.pdf</span></p>
          <p class="muted">${b.edit ? `Nuova versione del contratto ${esc(codice)}: le precedenti restano in archivio.` : b.rifPrv ? `Stesso codice del preventivo ${esc(b.rifPrv)}${v > 1 ? `: il contratto esiste già e diventa la V${String(v).padStart(2, "0")}` : ""}.` : "Il codice definitivo si assegna alla generazione: è il primo libero dell’anno."}</p>
        </div>`;
    }
  }
  return "";
}

function codiceProvvisorio(){
  const fisso = b.edit?.codice || b.rifPrv;
  if (fisso){
    const d = trova(fisso, "CTR");
    return {codice: fisso, v: d ? ultimaVersione(d) + 1 : 1};
  }
  const a = new Date().getFullYear();
  const n = documenti().filter(d => d.codice.startsWith(a + "-")).map(d => parseInt(d.codice.slice(5), 10) || 0);
  return {codice: `${a}-${String(Math.max(0, ...n) + 1).padStart(3, "0")}`, v: 1};
}

function riepilogo(){
  const c = cliente(), tot = totaleC(), trattino = `<span class="muted">–</span>`;
  const mat = [b.grezzo && "Grezzo escluso", b.h24 && "Consegna in 24 ore", b.materialeOn && `Materiale entro ${esc(b.materialeGiorni)} gg`].filter(Boolean);
  const spese = [b.speseIncluse.trim() && "incluse: " + esc(b.speseIncluse.trim()), b.speseFornitori.trim() && "dai fornitori: " + esc(b.speseFornitori.trim()), b.speseAnticipate.trim() && "anticipate: " + esc(b.speseAnticipate.trim())].filter(Boolean);
  return `<dl class="sum">
    <dt>Cliente</dt><dd>${c ? esc(c.nome) : trattino}</dd>
    ${c?.tipo === "Azienda" ? `<dt>Firmatario</dt><dd>${b.firmatario ? esc(b.firmatario) : trattino}</dd>` : ""}
    <dt>Lavoro</dt><dd>${b.titolo ? esc(b.titolo) : trattino}</dd>
    <dt>Riprese</dt><dd>${elencoDate(b.date) ? esc(elencoDate(b.date)) : trattino}${b.luogo ? ", " + esc(b.luogo) : ""}</dd>
    <dt>Fasi</dt><dd>${b.fasi.filter(f => f.trim()).length || trattino}</dd>
    <dt>Consegna</dt><dd>${b.consegnaOn ? `${esc(b.consegnaGiorni)} gg lav. ${b.consegnaDa === "riprese" ? "dalle riprese" : "dal materiale"}` : "Non indicata"}</dd>
    <dt>Modifiche</dt><dd>${b.modificheOn ? esc(b.modificheN) : "Non indicate"}</dd>
    <dt>Materiale</dt><dd>${mat.length ? mat.join(", ") : trattino}</dd>
    <dt>Compenso</dt><dd>${tot > 0 ? eur(tot) + (b.multi ? `, in ${b.rate.length} soluzioni` : ", unica soluzione") : trattino}</dd>
    <dt>Spese</dt><dd>${spese.join("; ") || "Nessuna"}</dd>
    <dt>Licenza</dt><dd>${b.licenza === "escl" ? "Esclusiva" : "Non esclusiva"}${usiTesto() ? ": " + esc(usiTesto()) : ""}</dd>
    <dt>Musiche</dt><dd>${b.musicaOn ? (b.musicaLibreria ? esc(b.musicaLibreria) : "Da indicare") : "Non indicate"}</dd>
    <dt>Foro</dt><dd>${c ? (privato() ? "Del consumatore" : FORI[b.foro][0]) : trattino}</dd>
  </dl>`;
}
const pannello = () => `<button class="btn small panel-close" data-action="panel">Chiudi</button><h3>Riepilogo</h3>${riepilogo()}${salvata(b.saved)}`;

function valida(id){
  const c = cliente();
  if (id === "cliente"){
    if (!b.cli) return "Scegli un cliente per continuare.";
    if (c?.tipo === "Azienda" && !b.firmatario.trim()) return "Indica chi firma per l’azienda.";
  }
  if (id === "lavoro"){
    if (!b.titolo.trim()) return "Scrivi il titolo del progetto.";
    if (!b.oggetto.trim()) return "Descrivi l’oggetto del contratto.";
    if (!b.fasi.some(f => f.trim())) return "Scrivi almeno una fase del progetto.";
    if (erroreDate(b.date)) return erroreDate(b.date);
  }
  if (id === "tempi"){
    if (b.consegnaOn && !(+b.consegnaGiorni > 0)) return "Indica i giorni di consegna, oppure spegni l’opzione.";
    if (b.modificheOn && !(b.modificheN !== "" && +b.modificheN >= 0)) return "Indica il numero di modifiche, oppure spegni l’opzione.";
  }
  if (id === "materiale" && b.materialeOn && !(+b.materialeGiorni > 0)) return "Indica entro quanti giorni il cliente invia il materiale.";
  if (id === "compenso"){
    if (!(totaleC() > 0)) return "Inserisci il compenso totale.";
    if (!b.multi && b.unicaQuando === "data" && !b.unicaData) return "Indica la data del pagamento.";
    if (b.multi){
      if (b.rate.some(r => !(numero(r.val) > 0))) return "Compila l’importo di ogni soluzione.";
      if (b.rate.some(r => r.quando === "data" && !r.data)) return "Indica la data delle soluzioni con scadenza.";
      if (!sommaRate().ok) return b.modo === "perc" ? "Le percentuali devono fare 100%." : "La somma delle soluzioni deve essere uguale al compenso totale.";
    }
    if (!conto()) return "Aggiungi un conto nel foglio Conti.";
  }
  if (id === "licenza"){
    if (!b.usi.length && !b.usiAltro.trim()) return "Scegli almeno un uso, oppure scrivilo in Altro.";
    if (b.musicaOn && !b.musicaLibreria.trim()) return "Indica la libreria musicale, oppure spegni l’opzione.";
  }
  return "";
}

/* ---------- Aggiornamenti dal vivo ---------- */
function dalVivo(){
  const tot = totaleC();
  const l = $("#lettere"); if (l) l.textContent = tot > 0 ? euroInLettere(tot) : "";
  const f = $("#frase"); if (f) f.textContent = tot > 0 ? `${fraseCompenso()} ${frasePagamento()}` : "Inserisci il compenso per vedere il testo.";
  const fs = $("#fraseSpese"); if (fs) fs.textContent = fraseSpese();
  const fl = $("#fraseLicenza"); if (fl) fl.textContent = usiTesto() ? fraseLicenza() : "Scegli almeno un uso.";
  const ff = $("#fraseForo"); if (ff) ff.textContent = fraseForo();
  const f2 = $("#frasePunto2"); if (f2) f2.textContent = [oggetto() ? `Il presente contratto ha per oggetto ${oggetto()}.` : "", fraseRiprese()].filter(Boolean).join(" ") || "Scrivi l’oggetto per vedere il testo.";
  const ch = $("#check");
  if (ch && b.multi){
    const s = sommaRate(), fmt = n => s.perc ? pct(n) : eur(n);
    if (!s.perc && !(tot > 0)){ ch.className = "check bad"; ch.textContent = "Inserisci prima il compenso totale."; }
    else {
      ch.className = "check " + (s.ok ? "ok" : "bad");
      ch.textContent = `Somma: ${fmt(s.somma)} su ${fmt(s.obiettivo)}` + (s.ok ? ". I conti tornano." : s.diff > 0 ? `. Mancano ${fmt(s.diff)}.` : `. Hai superato di ${fmt(-s.diff)}.`);
    }
    const imp = importiRate();
    document.querySelectorAll("[data-conv]").forEach(el => {
      const i = +el.dataset.conv, v = numero(b.rate[i].val);
      el.textContent = !(v > 0) || !(tot > 0) ? "" : s.perc ? "= " + eur(imp[i]) : "= " + pct(Math.round(centesimi(b.rate[i].val) / tot * 10000) / 100);
    });
  }
  const p = $("#panel"); if (p) p.innerHTML = pannello();
}
function ridisegna(fuoco){
  $("#csteps").innerHTML = barraPassi(passi(), ETICHETTE, b.step, b.visited, "c-goto");
  $("#stepBody").innerHTML = passoHTML();
  dalVivo();
  if (fuoco){ const el = document.querySelector(fuoco); if (el) el.focus({preventScroll: true}); }
}
const vaiAlPasso = id => { b.step = id; if (!b.visited.includes(id)) b.visited.push(id); salva(); vistaProcedura($("#view")); };

const RIDISEGNA = ["cli", "consegnaOn", "modificheOn", "materialeOn", "multi", "unicaQuando", "modo", "nRate", "licenza", "musicaOn", "foro"];
function campo(el){
  if (!b || !C) return;
  let rr = false, fuoco = null;
  if (el.dataset.fase !== undefined) b.fasi[+el.dataset.fase] = el.value;
  else if (el.dataset.dt === "c") b.date[+el.dataset.i][el.dataset.k] = el.value;
  else if (el.dataset.rata !== undefined){
    b.rate[+el.dataset.rata][el.dataset.k] = el.value;
    if (el.dataset.k === "quando"){ rr = true; fuoco = `[data-rata="${el.dataset.rata}"][data-k="quando"]`; }
  } else {
    const f = el.getAttribute(F);
    if (f === "usi") b.usi = [...document.querySelectorAll(`[${F}="usi"]:checked`)].map(x => x.value);
    else if (el.hasAttribute("data-bool")) b[f] = el.checked;
    else if (f === "nRate"){ const n = +el.value; while (b.rate.length < n) b.rate.push({val: "", quando: "consegna", data: ""}); b.rate.length = n; }
    else if (f === "modo" && el.value !== b.modo){
      // Passando da percentuale a euro (o viceversa) le cifre si convertono.
      const tot = totaleC();
      b.rate.forEach(r => {
        const v = numero(r.val);
        if (v > 0 && tot > 0) r.val = el.value === "euro" ? cifraCampo(Math.round(tot * v / 100)) : qta(Math.round(centesimi(r.val) / tot * 10000) / 100);
      });
      b.modo = el.value;
    } else b[f] = el.value;
    // Il firmatario parte dal referente del foglio Clienti.
    if (f === "cli"){ const c = cliente(); if (c?.tipo === "Azienda" && !b.firmatario.trim()) b.firmatario = c.referente || ""; }
    if (RIDISEGNA.includes(f)){ rr = true; fuoco = el.type === "radio" ? `[${F}="${f}"][value="${el.value}"]` : `[${F}="${f}"]`; }
  }
  salva();
  const e = $("#err"); if (e) e.textContent = "";
  if (rr) ridisegna(fuoco); else dalVivo();
}

/* ---------- Generazione ---------- */
function datiTemplate(codice){
  const c = cliente(), k = conto();
  return {NUMERO: codice, DATA: dataLunga(oggi()), ETICHETTA_4: stato.impostazioni.etichetta4, ...righeCliente(c),
    RIF_PREVENTIVO: b.rifPrv ? `Rif. preventivo n. ${b.rifPrv}` : "",
    OGGETTO: oggetto(), FRASE_RIPRESE: fraseRiprese(),
    FASE: b.fasi.map(f => f.trim()).filter(Boolean).map((f, i) => ({N: `${i + 1}.`, TESTO: f})),
    FRASE_CONSEGNA: b.consegnaOn ? `A titolo indicativo, la consegna del lavoro è prevista entro ${conLettere(+b.consegnaGiorni)} giorni lavorativi ${b.consegnaDa === "riprese" ? "dalla fine delle riprese" : "dalla ricezione del materiale richiesto al Cliente"}.` : "",
    FRASE_REVISIONI: b.modificheOn ? fraseRevisioni() : "",
    FRASE_GREZZO: b.grezzo ? "Il Cliente riceve il prodotto finito: il girato grezzo e i file di progetto non sono inclusi." : "",
    FRASE_24_ORE: b.h24 ? "Il Videomaker consegna il prodotto finito entro ventiquattro (24) ore dalla fine dell’evento." : "",
    MATERIALE_CLIENTE: b.materialeOn, GIORNI_MATERIALE: b.materialeOn ? conLettere(+b.materialeGiorni) : "",
    FRASE_COMPENSO: fraseCompenso(), FRASE_PAGAMENTO: frasePagamento(),
    INTESTATARIO: k?.intestatario || "", IBAN: k?.iban || "",
    FRASE_SPESE: fraseSpese(), FRASE_LICENZA: fraseLicenza(),
    FRASE_PORTFOLIO: b.portfolio ? "Il Videomaker può utilizzare le opere, o loro estratti, nel proprio portfolio e sui propri canali professionali, a scopo promozionale. Il Cliente può chiedere di escludere questo utilizzo per contenuti riservati." : "",
    FRASE_CITAZIONE: b.citazione ? "Dove il formato lo consente (titoli di coda, descrizione del video, didascalia), il Cliente indica il Videomaker come autore del video." : "",
    FRASE_MUSICHE: b.musicaOn ? `Le musiche di repertorio provengono dalla libreria ${b.musicaLibreria.trim()}${b.musicaPiano.trim() ? ` (piano ${b.musicaPiano.trim()})` : ""}, la cui licenza copre gli utilizzi indicati sopra.` : "",
    FRASE_FORO: fraseForo(), CLIENTE_FIRMA: firma(), APPROVAZIONE: approvazioni()};
}

async function genera(){
  for (const id of passi()){
    const m = valida(id);
    if (m){ b.step = id; if (!b.visited.includes(id)) b.visited.push(id); salva(); await vistaProcedura($("#view")); $("#err").textContent = m; return; }
  }
  const f = stato.impostazioni.file;
  try {
    if (!f.archivioContratti) throw new CollegamentoMancante("Archivio contratti");
    if (!f.tplCtr) throw new CollegamentoMancante("Template CTR — Contratto");
    const passo = avanzamento("Genero il contratto");
    passo("Assegno il codice");
    // Dal preventivo: stesso codice; se il contratto c'è già, diventa la versione successiva.
    const codice = b.edit?.codice || b.rifPrv || await prossimoCodice();
    const v = b.edit || b.rifPrv ? await prossimaVersione(codice, "CTR") : 1;
    const c = cliente();
    passo("Preparo la cartella del cliente");
    const cartella = await cartellaCliente(f.archivioContratti.id, c);
    const nome = nomeFile({codice, tipo: "CTR", titolo: b.titolo, cliente: c?.nome, versione: v});
    const r = await generaDocumento({template: f.tplCtr.id, cartella: cartella.id, nome, dati: datiTemplate(codice)}, passo);
    passo("Aggiorno il registro");
    const dati = JSON.parse(JSON.stringify(b));
    ["step", "visited", "saved", "edit"].forEach(k => delete dati[k]);
    dati.importiRate = b.multi ? importiRate() : [totaleC()];
    await registra({codice, tipo: "CTR", cliente: c, titolo: b.titolo.trim(), v, nome, doc: r.doc.id, pdf: r.pdf.id, dati});
    b = null; store.del(BKEY);
    location.hash = "contratti";
    modal(`Contratto ${codice}${v > 1 ? ` V${String(v).padStart(2, "0")}` : ""} generato`,
      `<p class="fname">${esc(nome)}</p>${r.rimasti.length ? `<div class="note warn">Nel documento sono rimasti questi segnaposto: ${esc(r.rimasti.join(", "))}. Controlla il template.</div>` : ""}
       <div class="actions" style="justify-content:flex-start;margin-top:12px"><a class="btn" href="${linkDoc(r.doc.id)}" target="_blank" rel="noopener">Apri il Doc</a>
       <button class="btn" data-action="scarica-pdf" data-id="${esc(r.pdf.id)}" data-nome="${esc(nome)}">Scarica il PDF</button></div>`,
      [{label: "Fatto", primary: true}]);
  } catch(e){
    closeModal();
    gestisciErrore(e, genera);
  }
}

/* ---------- Eventi ---------- */
export function click(act, el){
  if (act === "ctr-nuovo"){ nuovoContratto(); return true; }
  if (act === "prv-contratto"){ daPreventivo(el.dataset.codice); return true; }
  if (act.startsWith("dt-") && el.dataset.dt === "c" && b){ const f = azioneDate(act, el, b.date); salva(); ridisegna(f); return true; }
  if (!act.startsWith("c-") || !b) return false;
  const st = passi(), i = st.indexOf(b.step);
  if (act === "c-goto"){ const id = el.dataset.id; if (b.visited.includes(id) || id === b.step) vaiAlPasso(id); }
  else if (act === "c-prev"){ if (i > 0) vaiAlPasso(st[i - 1]); }
  else if (act === "c-next"){ const m = valida(b.step); if (m) $("#err").textContent = m; else vaiAlPasso(st[i + 1]); }
  else if (act === "c-faseadd"){ b.fasi.push(""); salva(); ridisegna(`[data-fase="${b.fasi.length - 1}"]`); }
  else if (act === "c-fasedel"){ const k = +el.dataset.i; if (b.fasi.length > 1) b.fasi.splice(k, 1); else b.fasi[0] = ""; salva(); ridisegna(); }
  else if (act === "c-faseup"){ const k = +el.dataset.i; [b.fasi[k - 1], b.fasi[k]] = [b.fasi[k], b.fasi[k - 1]]; salva(); ridisegna(`[data-fase="${k - 1}"]`); }
  else if (act === "c-resto"){
    const s = sommaRate(), ultima = b.rate[b.rate.length - 1];
    if (!(s.obiettivo > 0)){ toast("Inserisci prima il compenso totale"); return true; }
    const altre = s.somma - (s.perc ? (numero(ultima.val) || 0) : (centesimi(ultima.val) || 0));
    const resto = s.obiettivo - altre;
    if (resto <= 0){ toast("Le altre soluzioni coprono già tutto il totale"); return true; }
    ultima.val = s.perc ? qta(Math.round(resto * 100) / 100) : cifraCampo(resto);
    salva(); ridisegna();
  }
  else if (act === "c-genera") genera();
  else return false;
  return true;
}

const testuale = el => el.tagName !== "SELECT" && el.type !== "radio" && el.type !== "checkbox";
const deiCampi = el => el.matches(`[${F}],[data-fase],[data-rata],[data-dt="c"]`);
export function input(el){
  if (deiCampi(el) && testuale(el)){ campo(el); return true; }
  return false;
}
export function change(el){
  if (deiCampi(el) && !testuale(el)){ campo(el); return true; }
  return false;
}
