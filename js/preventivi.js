/* ---------- Preventivi ----------
   Sezione Preventivi: elenco con stato, procedura guidata in 10 passi (CLAUDE.md, 5.1),
   generazione del preventivo e della lista ATT.
   Tutti gli importi sono in centesimi. */

import { $, esc, store, toast, modal, closeModal } from "./util.js";
import { stato } from "./dati.js";
import { clienti, listino, righeCliente } from "./anagrafiche.js";
import { prossimoCodice, prossimaVersione, registra, documenti, trova, datiVersione, rileggi } from "./registro.js";
import { cartellaCliente, generaDocumento } from "./genera.js";
import { aggiornaJSON } from "./drive.js";
import { nomeFile, nomeCartellaCliente, slug } from "./nomi.js";
import { rigaDocumento, filtra, linkDoc } from "./elenco.js";
import { gestisciErrore, CollegamentoMancante } from "./errori.js";
import { opzione, interruttore, selezione, barraPassi, avanzamento, campoDate, azioneDate, erroreDate } from "./procedura.js";
import { registraApritore, avvisoModifica, ultimaVersione } from "./riapertura.js";
import { articoloManuale, elencoManuali, nuovoManuale, togliManuale, copiaManuali, erroreManuali, campoNome, campoPrezzo, tastoTogli, tastoAggiungi } from "./manuali.js";
import { numero, centesimi, eur, eurSegno, cifraCampo, qta, totali, fiscozen, oggi, dataLunga, dataBreve, elencoDate, normalizzaDate, giorniDate } from "./calcoli.js";

/* ---------- Bozza ---------- */
const BKEY = "fm-bozza-preventivo-v1";
const BASE = () => ({step: "cliente", visited: ["cliente"], cli: "", titolo: "", desc: "", date: [{da: "", a: "", intervallo: false}], luogo: "", dataPrev: oggi(), validita: "30",
  voci: {}, nLib: 0,
  attMode: "lista", attUnit: "g", attGiorni: "", attLivello: "", kitNome: "", kitPrezzo: "", items: {}, manuali: {}, nMan: 0, override: "auto", listaMode: "kit", tetto: "top", tettoPrezzo: "", genAtt: true,
  noleggi: [], accontoOn: false, accontoPerc: "30", revOn: false, revN: "2", consOn: false, consGiorni: "10", accettOn: false, note: "",
  attNota: "", cifra: "", noRound: true, edit: null, saved: null});
let b = store.get(BKEY, null);
if (b) b = Object.assign(BASE(), b);
const salva = () => { b.saved = new Date().toISOString(); store.set(BKEY, b); };
export const haBozza = () => !!b && !!(b.cli || b.titolo);

const PASSI = [["cliente", "Cliente"], ["progetto", "Progetto"], ["pre", "Pre-prod."], ["prod", "Produz."], ["att", "Attrezz."], ["lista", "Lista"], ["post", "Post-prod."], ["cond", "Condiz."], ["totale", "Totale"], ["riep", "Riepilogo"]];
const ETICHETTE = Object.fromEntries(PASSI);
const passi = () => PASSI.map(p => p[0]).filter(id => id !== "lista" || b.attMode === "lista");
const FASI = [["pre", "Pre-produzione"], ["prod", "Produzione"], ["post", "Post-produzione"]];
const NOME_FASE = Object.fromEntries(FASI);

/* ---------- Dati dai fogli ---------- */
let L = null, C = null;
async function caricaFogli(){ [L, C] = await Promise.all([listino(), clienti()]); }

// Fase di un servizio dalla sua categoria (Pre-produzione, Produzione, Post-produzione).
const faseDi = cat => /^pre/i.test(cat) ? "pre" : /^post/i.test(cat) ? "post" : "prod";
const servizio = id => L.servizi.find(s => s.id === id);
const serviziFase = f => L.servizi.filter(s => s.attivo && faseDi(s.cat) === f);
const faseVoce = (id, v) => v.libera ? v.fase : faseDi(servizio(id)?.cat || "");
const nomeVoce = (id, v) => v.libera ? (v.nome.trim() || "Voce libera") : servizio(id)?.nome || id;
const cliente = () => b.cli ? C.clienti.find(c => c.id === b.cli) || null : null;
const articolo = id => L.articoli.find(a => a.id === id) || (b.manuali[id] && articoloManuale(id, b.manuali[id]));
const tutti = () => [...L.articoli, ...elencoManuali(b)];   // foglio e articoli scritti a mano
const campoPrezzoPezzo = () => b.attUnit === "m" ? "lavoroMezza" : "lavoro";   // il prezzo che la lista mostra
const kitUsabili = () => L.kit.filter(k => k.attivo && (b.attUnit === "m" ? k.prezzoMezza : k.prezzo) !== null);
const magg = () => Number(stato.impostazioni.maggiorazione) || 0;
// Giorni di ripresa: ogni giorno singolo e ogni giorno degli intervalli.
const giorniDefault = () => giorniDate(b.date).length || 1;

/* ---------- Unità ---------- */
const UNITA = ["Giornata", "Mezza giornata", "Ora", "Forfait", "Fisso"];
const PREZZO_UNITA = {"Giornata": "giornata", "Mezza giornata": "mezza", "Ora": "ora", "Fisso": "fisso"};
const PAROLE = {"Giornata": ["giornata", "giornate"], "Mezza giornata": ["mezza giornata", "mezze giornate"], "Ora": ["ora", "ore"]};
// Fisso solo se il prezzo fisso ha un valore (anche 0).
const unitaPossibili = s => UNITA.filter(u => u !== "Fisso" || (s && s.fisso !== null));
const prezzoListino = (s, u) => s && PREZZO_UNITA[u] ? s[PREZZO_UNITA[u]] : null;

function nuovaVoce(id){
  const s = servizio(id);
  let u = UNITA.includes(s.unita) ? s.unita : "Giornata";
  if (u === "Fisso" && s.fisso === null) u = "Forfait";
  const p = prezzoListino(s, u), aGiornata = (u === "Giornata" || u === "Mezza giornata") && faseDi(s.cat) === "prod";
  return {on: true, unita: u, qta: aGiornata ? String(giorniDefault()) : "1", ris: "1", prezzo: p !== null ? cifraCampo(p) : "", importo: "",
    nota: s.nota && !s.notaObbligatoria ? s.nota : "", modo: "tot", stima: "", fatt: "cliente", esterna: s.esterna, costo: "", cifra: ""};
}

/* ---------- Calcoli ---------- */
const conMagg = c => Math.round(c * (1 + magg() / 100));
const esternaCalcolata = v => conMagg(centesimi(v.costo) || 0);
const noleggioCalcolato = n => conMagg(Math.round((centesimi(n.prezzo) || 0) * 1.22));
const importoNoleggio = n => n.paga === "cliente" ? 0 : (centesimi(n.cifra) > 0 ? centesimi(n.cifra) : noleggioCalcolato(n));
const stimaCliente = v => { const s = centesimi(v.stima); return s > 0 ? (v.fatt === "io" ? conMagg(s) : s) : 0; };

function importoVoce(v){
  if (!v?.on || v.modo !== "tot") return 0;
  if (v.esterna) return centesimi(v.cifra) > 0 ? centesimi(v.cifra) : esternaCalcolata(v);
  if (v.unita === "Forfait") return centesimi(v.importo) || 0;
  const q = numero(v.qta) || 0, r = v.unita === "Fisso" ? 1 : (numero(v.ris) || 0);
  return Math.round(q * r * (centesimi(v.prezzo) || 0));
}

const giorniAtt = () => numero(b.attGiorni !== "" ? b.attGiorni : giorniDefault()) || 0;
const sogliaKit = k => b.attUnit === "m" ? k.sogliaMezza : k.soglia;
const prezzoKit = k => b.attUnit === "m" ? k.prezzoMezza : k.prezzo;
const KIT_MANO = "__mano";   // valore di attLivello per il kit scritto a mano (nome e prezzo nella bozza)
const prezzoPezzo = a => b.attUnit === "m" ? (a.lavoroMezza ?? a.lavoro ?? 0) : (a.lavoro ?? 0);
const valoreLista = () => Object.entries(b.items).reduce((s, [id, x]) => { const a = articolo(id); return a ? s + (numero(x.qta) || 0) * prezzoPezzo(a) : s; }, 0);

/* Attrezzatura: livello a mano, oppure calcolato dal valore della lista (Regole di calcolo, Kit). */
function attrezzatura(){
  const g = giorniAtt(), kit = kitUsabili(), alto = kit[kit.length - 1];
  if (b.attMode === "none") return {on: false, totale: 0};
  if (b.attMode === "livello" && b.attLivello === KIT_MANO){
    const al = centesimi(b.kitPrezzo) || 0, nome = b.kitNome.trim() || "Kit";
    return {on: true, mano: true, alGiorno: al, g, totale: al * g, etichetta: nome, cliente: nome};
  }
  if (b.attMode === "livello"){
    const k = kit.find(x => x.nome === b.attLivello) || kit[0];
    if (!k) return {on: false, totale: 0};
    return {on: true, kit: k, alGiorno: prezzoKit(k), g, totale: prezzoKit(k) * g, etichetta: "Kit " + k.nome, cliente: "Kit " + k.nome};
  }
  if (!Object.keys(b.items).length) return {on: false, totale: 0, vuota: true};
  const val = valoreLista(), auto = kit.find(k => sogliaKit(k) !== null && val <= sogliaKit(k)) || null;
  if (b.listaMode === "pezzi") return {on: true, val, auto, pezzi: true, alGiorno: val, g, totale: val * g, etichetta: "A pezzi", cliente: "come da lista allegata"};
  let k = b.override === "auto" ? auto : kit.find(x => x.nome === b.override);
  if (k) return {on: true, val, auto, kit: k, alGiorno: prezzoKit(k), g, totale: prezzoKit(k) * g, etichetta: "Kit " + k.nome, cliente: "Kit " + k.nome};
  // Oltre la soglia del livello più alto.
  if (!alto) return {on: true, val, auto, oltre: true, alGiorno: centesimi(b.tettoPrezzo) || 0, g, totale: (centesimi(b.tettoPrezzo) || 0) * g, etichetta: "Prezzo a mano", cliente: "come da lista allegata"};
  const al = b.tetto === "top" ? prezzoKit(alto) + (val - (sogliaKit(alto) || 0)) : (centesimi(b.tettoPrezzo) || 0);
  return {on: true, val, auto, oltre: true, kit: b.tetto === "top" ? alto : null, alGiorno: al, g, totale: al * g,
    etichetta: b.tetto === "top" ? `Kit ${alto.nome} + eccedenza` : "Prezzo a mano", cliente: b.tetto === "top" ? `Kit ${alto.nome} e materiale aggiuntivo` : "come da lista allegata"};
}

function conto(){
  const fasi = {pre: 0, prod: 0, post: 0};
  Object.entries(b.voci).forEach(([id, v]) => { fasi[faseVoce(id, v)] += importoVoce(v); });
  const a = attrezzatura(), nol = b.noleggi.reduce((s, n) => s + importoNoleggio(n), 0);
  const t = totali(fasi.pre + fasi.prod + fasi.post + a.totale + nol);
  const voluto = b.noRound || !(centesimi(b.cifra) > 0) ? t.totale : centesimi(b.cifra);
  return {fasi, a, nol, ...t, voluto, arr: t.totale - voluto, fz: t.servizi > 0 ? fiscozen(voluto) : null};
}

/* ---------- Testi per il cliente ---------- */
function quantitaTesto(v, dettagliato){
  if (v.unita === "Forfait" || v.esterna) return dettagliato ? "forfait" : "";
  const q = numero(v.qta) || 0;
  if (v.unita === "Fisso") return "× " + qta(q);
  const r = numero(v.ris) || 1, P = PAROLE[v.unita];
  return `${qta(q)} ${P[q === 1 ? 0 : 1]}` + (r > 1 ? (dettagliato ? ` × ${qta(r)}` : `, ${qta(r)} persone`) : "");
}
const giorniTesto = n => `${qta(n)} ${n === 1 ? (b.attUnit === "m" ? "mezza giornata" : "giornata") : (b.attUnit === "m" ? "mezze giornate" : "giornate")}`;
const nomeNoleggio = n => n.desc.trim() || "noleggio";

// Voci di ogni fase, già pronte per anteprima e template (note numerate in ordine).
function vociCliente(){
  const t = conto(), note = [];
  const fasi = FASI.map(([f, nomeF]) => {
    const voci = Object.entries(b.voci).filter(([id, v]) => v.on && faseVoce(id, v) === f).map(([id, v]) => {
      const s = v.libera ? null : servizio(id);
      let rif = "";
      if (v.nota?.trim()){ note.push(v.nota.trim()); rif = String(note.length); }
      const st = stimaCliente(v), imp = importoVoce(v);
      const dett = v.modo === "incl" ? "Inclusa" : v.modo === "cons" ? (st > 0 ? `A consuntivo, circa ${eur(st)}` : "A consuntivo") : quantitaTesto(v, false);
      return {NOME: nomeVoce(id, v), DESCRIZIONE: s?.descrizione || "", RIF: rif, DETTAGLIO: dett,
        QUANTITA: v.modo === "tot" ? quantitaTesto(v, true) : (v.modo === "incl" ? quantitaTesto(v, true) : ""),
        PREZZO: v.modo === "tot" && !v.esterna && v.unita !== "Forfait" ? eur(centesimi(v.prezzo) || 0) : "",
        IMPORTO: v.modo === "incl" ? "Inclusa" : v.modo === "cons" ? (st > 0 ? "≈ " + eur(st) : "a consuntivo") : eur(imp)};
    });
    if (f === "prod" && t.a.on) voci.push({NOME: `Attrezzatura tecnica, ${t.a.cliente}`, DESCRIZIONE: b.attNota.trim(), RIF: "", DETTAGLIO: giorniTesto(t.a.g),
      QUANTITA: giorniTesto(t.a.g), PREZZO: eur(t.a.alGiorno), IMPORTO: eur(t.a.totale)});
    if (f === "prod") b.noleggi.forEach(n => voci.push(n.paga === "cliente"
      ? {NOME: `Noleggio ${nomeNoleggio(n)}`, DESCRIZIONE: "", RIF: "", DETTAGLIO: `${eur(centesimi(n.prezzo) || 0)} + IVA, a parte`, QUANTITA: "forfait", PREZZO: "", IMPORTO: "a parte"}
      : {NOME: `Noleggio ${nomeNoleggio(n)}`, DESCRIZIONE: "", RIF: "", DETTAGLIO: "", QUANTITA: "forfait", PREZZO: "", IMPORTO: eur(importoNoleggio(n))}));
    return {NOME: nomeF, VOCE: voci};
  }).filter(f => f.VOCE.length);
  return {fasi, note};
}

function condizioni(){
  const c = [];
  if (b.accontoOn) c.push(`Acconto del ${b.accontoPerc}% alla conferma del preventivo.`);
  if (b.revOn) c.push(`${b.revN} ${+b.revN === 1 ? "revisione inclusa" : "revisioni incluse"}.`);
  if (b.consOn) c.push(`Consegna stimata in ${b.consGiorni} giorni lavorativi dalle riprese.`);
  c.push(`Preventivo valido ${b.validita} giorni dalla data di emissione.`);
  if (b.note.trim()) c.push(b.note.trim());
  return c;
}

// Frase sulle voci fuori dal totale: noleggi pagati dal cliente e voci a consuntivo.
function diciturEsclusi(){
  const f = [];
  if (b.noleggi.some(n => n.paga === "cliente")) f.push("I noleggi indicati + IVA sono fatturati direttamente dal noleggio al cliente e non sono compresi nel totale.");
  const cons = Object.entries(b.voci).filter(([, v]) => v.on && v.modo === "cons");
  if (cons.length){
    const cl = cons.filter(([, v]) => v.fatt !== "io").map(([id, v]) => nomeVoce(id, v).toLowerCase());
    const io = cons.filter(([, v]) => v.fatt === "io").map(([id, v]) => nomeVoce(id, v).toLowerCase());
    f.push("Le voci a consuntivo non sono comprese nel totale.");
    if (cl.length) f.push(`Sono fatturate direttamente al cliente dai fornitori: ${cl.join(", ")}.`);
    if (io.length) f.push(`Sono anticipate da me e rifatturate su presentazione dei giustificativi, con una maggiorazione del ${qta(magg())}% per oneri fiscali e di gestione: ${io.join(", ")}.`);
  }
  return f.join(" ");
}

function diciturTotale(t){
  const L4 = stato.impostazioni.etichetta4, l = L4.charAt(0).toLowerCase() + L4.slice(1);
  return `Comprensivo di ${l}${t.bollo ? " e imposta di bollo" : ""}.`;
}

/* ---------- Sezione Preventivi ---------- */
const STATI = ["Bozza", "Inviato", "Accettato", "Rifiutato"];
export function vistaSezione(){
  const docs = documenti("PRV").slice().sort((x, y) => y.codice.localeCompare(x.codice));
  return `<div class="page">
    <div class="page-head"><div><h1>Preventivi</h1><p>Salvati in Archivio preventivi, una cartella per cliente.</p></div>
      <div class="actions"><button class="btn" data-action="carica-pdf" data-tipo="PRV">Carica PDF</button><button class="btn primary" data-action="prv-nuovo">Nuovo preventivo</button></div></div>
    <div class="toolbar"><input class="search" type="search" placeholder="Cerca per cliente, lavoro o codice" data-filter aria-label="Cerca"><span class="muted" style="font-size:14px">${docs.length} ${docs.length === 1 ? "preventivo" : "preventivi"}</span></div>
    <div id="docs">${docs.length ? docs.map(d => rigaDocumento(d, {extra: extraRiga(d)})).join("") : `<p class="empty">Nessun preventivo. Inizia da “Nuovo preventivo”.</p>`}</div>
  </div>`;
}
function extraRiga(d){
  const st = d.stato || "Bozza", u = d.versioni[d.versioni.length - 1];
  return `<select class="inp stato" data-stato="${esc(d.codice)}" aria-label="Stato del preventivo">${STATI.map(s => `<option ${s === st ? "selected" : ""}>${s}</option>`).join("")}</select>
    ${st === "Accettato" ? `<button class="btn small" data-action="prv-contratto" data-codice="${esc(d.codice)}">Crea contratto</button>` : ""}`;
}

export function cardBozza(){
  if (!haBozza()) return "";
  const st = passi(), i = Math.max(0, st.indexOf(b.step));
  const nome = b.cli && C ? C.clienti.find(c => c.id === b.cli)?.nome : "";
  return `<div class="draft-card"><div><strong>Preventivo in sospeso</strong><div class="muted">${b.titolo ? esc(b.titolo) + ", " : nome ? esc(nome) + ", " : ""}passo ${i + 1} di ${st.length}${b.saved ? ", salvato il " + dataBreve(b.saved.slice(0, 10)) : ""}</div></div><a class="btn primary" href="#preventivi-nuovo">Riprendi</a></div>`;
}

/* Riapre un preventivo salvato: tutti i passi sono già visitati. */
registraApritore("PRV", (d, v, dati) => {
  const apri = () => {
    b = Object.assign(BASE(), JSON.parse(JSON.stringify(dati)), {cli: dati.cli ?? d.cliente?.id ?? "", titolo: dati.titolo ?? d.titolo, edit: {codice: d.codice, v, cosa: "del preventivo"}, step: "cliente", visited: PASSI.map(p => p[0])});
    delete b.conto; delete b.maggiorazione;
    salva();
    if (location.hash === "#preventivi-nuovo") window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "preventivi-nuovo";
  };
  if (haBozza()) modal("C’è un preventivo in sospeso", "<p>Se apri questo preventivo per modificarlo, la bozza in sospeso viene sostituita.</p>", [{label: "Annulla"}, {label: "Sostituisci", primary: true, fn: apri}]);
  else apri();
});

export function nuovoPreventivo(){
  const vai = () => { if (location.hash === "#preventivi-nuovo") window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "preventivi-nuovo"; };
  if (haBozza()){
    const st = passi(), i = Math.max(0, st.indexOf(b.step));
    modal("C’è un preventivo in sospeso", `<p>${b.titolo ? esc(b.titolo) + ", " : ""}fermo al passo ${i + 1} di ${st.length}. Vuoi riprenderlo o ricominciare da zero?</p>`,
      [{label: "Ricomincia", fn: () => { b = BASE(); store.del(BKEY); vai(); }}, {label: "Riprendi", primary: true, fn: vai}]);
  } else { b = BASE(); vai(); }
}

/* ---------- Procedura ---------- */
const Q = "data-q";
const seg = (campo, opzioni) => `<div class="seg" role="radiogroup">${opzioni.map(([v, l]) => `<label><input type="radio" name="q-${campo}" value="${v}" ${Q}="${campo}" ${b[campo] === v ? "checked" : ""}>${l}</label>`).join("")}</div>`;

export async function vistaProcedura(view){
  if (!b) b = BASE();
  view.innerHTML = `<div class="page"><p class="loading">Leggo clienti, servizi e attrezzatura dai fogli…</p></div>`;
  try { await caricaFogli(); }
  catch(e){
    view.innerHTML = `<div class="page"><div class="page-head"><div><h1>Nuovo preventivo</h1><p>${esc(e.message)}</p></div></div><a class="btn" href="#preventivi">Torna ai preventivi</a></div>`;
    gestisciErrore(e, () => vistaProcedura(view));
    return;
  }
  b.date = normalizzaDate(b.date); if (!b.date.length) b.date = BASE().date;
  // Voci e articoli che non esistono più nel foglio: via dalla bozza.
  Object.keys(b.voci).forEach(id => { if (!b.voci[id].libera && !servizio(id)) delete b.voci[id]; });
  Object.keys(b.items).forEach(id => { if (!articolo(id)) delete b.items[id]; });
  if (!b.attLivello && kitUsabili().length) b.attLivello = kitUsabili()[Math.min(1, kitUsabili().length - 1)].nome;
  if (!passi().includes(b.step)) b.step = "att";
  const st = passi(), i = st.indexOf(b.step), ultimo = i === st.length - 1;
  view.innerHTML = `<div class="wiz"><div class="wiz-main">
    <a class="wiz-back" href="#preventivi">‹ Preventivi</a>
    <div class="wiz-title"><h1>${b.edit ? "Modifica preventivo " + esc(b.edit.codice) : "Nuovo preventivo"}</h1><button class="btn small panel-toggle" data-action="panel" id="ptog">Totale</button></div>
    ${avvisoModifica(b.edit)}
    <ol class="steps compact" id="qsteps">${barraPassi(st, ETICHETTE, b.step, b.visited, "q-goto")}</ol>
    <section id="stepBody">${passoHTML()}</section>
    <div class="err" id="err" role="alert"></div>
    <div class="wiz-foot">
      <button class="btn" data-action="q-prev" ${i === 0 ? "disabled" : ""}>Indietro</button>
      ${ultimo ? `<button class="btn primary" data-action="q-genera">${b.edit ? "Salva nuova versione" : "Genera preventivo"}</button>` : `<button class="btn primary" data-action="q-next">Avanti</button>`}
    </div>
  </div><aside class="panel" id="panel" aria-label="Totali">${pannello()}</aside></div>`;
  dalVivo();
  window.scrollTo(0, 0);
}

function listinoTesto(s){
  const p = [];
  if (s.giornata !== null) p.push(`${eur(s.giornata)}/giorno`);
  if (s.mezza !== null) p.push(`${eur(s.mezza)}/mezza`);
  if (s.ora !== null) p.push(`${eur(s.ora)}/ora`);
  if (s.fisso !== null) p.push(`${eur(s.fisso)} fisso`);
  return p.length ? p.join(" · ") : "a forfait";
}
function esternaTesto(v){
  if (!(centesimi(v.costo) > 0)) return `+${qta(magg())}% = –`;
  const c = esternaCalcolata(v), w = centesimi(v.cifra);
  return `+${qta(magg())}% = ${eur(c)}${w > 0 && w < c ? ` <span class="bad">sotto di ${eur(c - w)}</span>` : ""}`;
}
function importoTesto(v){
  if (v.modo === "incl") return "Inclusa";
  if (v.modo === "cons") return stimaCliente(v) > 0 ? "≈ " + eur(stimaCliente(v)) : "A consuntivo";
  return eur(importoVoce(v));
}

const MODI = [["tot", "Nel totale"], ["incl", "Inclusa"], ["cons", "A consuntivo"]];
function voceHTML(id, s, v){
  const on = !!v?.on;
  const testa = s
    ? `<label class="vhead"><input type="checkbox" data-qv="${esc(id)}" data-k="on" ${on ? "checked" : ""}><span class="vtxt"><strong>${esc(s.nome)}</strong><small>${esc(s.descrizione)}</small></span><span class="vlist">${listinoTesto(s)}</span></label>`
    : `<div class="vhead"><span class="vtxt"><input class="inp" data-qv="${esc(id)}" data-k="nome" value="${esc(v.nome)}" placeholder="Nome della voce libera" aria-label="Nome della voce libera" style="max-width:none"></span><button class="btn small" data-action="q-libdel" data-id="${esc(id)}">Togli</button></div>`;
  if (!on) return `<div class="voce">${testa}</div>`;
  const campo = (k, l, cls, extra = "") => `<label class="${cls}"><span>${l}</span><input class="inp" inputmode="decimal" data-qv="${esc(id)}" data-k="${k}" value="${esc(v[k])}" ${extra}></label>`;
  const nota = s?.notaObbligatoria
    ? `<label class="vnote"><span>Nota a piè di pagina, obbligatoria</span><input class="inp" data-qv="${esc(id)}" data-k="nota" value="${esc(v.nota)}" placeholder="${esc(s.nota)}"></label>`
    : s?.nota ? `<label class="vnote"><span>Nota a piè di pagina</span><textarea class="inp" data-qv="${esc(id)}" data-k="nota">${esc(v.nota)}</textarea></label>`
    : `<label class="vnote"><span>Nota a piè di pagina (facoltativa)</span><input class="inp" data-qv="${esc(id)}" data-k="nota" value="${esc(v.nota)}"></label>`;
  let corpo;
  if (v.esterna && v.modo === "tot")
    corpo = campo("costo", "Costo, IVA inclusa (€)", "w-s", `placeholder="0,00"`) + `<div class="calc" data-calc="${esc(id)}">${esternaTesto(v)}</div>` + campo("cifra", "Cifra a preventivo (€)", "w-s", `placeholder="${esc(cifraCampo(esternaCalcolata(v)))}"`);
  else {
    corpo = `<label class="w-u"><span>Unità</span>${selezione(`data-qv="${esc(id)}" data-k="unita"`, unitaPossibili(s).map(u => [u, u]), v.unita)}</label>`;
    if (v.modo === "cons") corpo += campo("stima", "Stima, facoltativa (€)", "w-s", `placeholder="0,00"`);
    else if (v.modo === "tot") corpo += v.unita === "Forfait" ? campo("importo", "Importo (€)", "w-p", `placeholder="0,00"`)
      : campo("qta", "Quantità", "w-n") + (v.unita === "Fisso" ? "" : campo("ris", "Risorse", "w-n")) + campo("prezzo", "Prezzo (€)", "w-p");
  }
  return `<div class="voce on">${testa}<div class="vbody">
    ${corpo}
    <div class="vimp" data-imp="${esc(id)}">${importoTesto(v)}</div>
    <div class="vmodo"><div class="seg" role="radiogroup" aria-label="Come si paga">${MODI.map(([k, l]) => `<label><input type="radio" name="m-${esc(id)}" value="${k}" data-qv="${esc(id)}" data-k="modo" ${v.modo === k ? "checked" : ""}>${l}</label>`).join("")}</div>${v.modo === "cons" ? `<span class="cnt">Fuori dal totale. Chi la fattura lo scegli al passo Totale.</span>` : ""}</div>
    ${v.modo === "tot" ? `<label class="vincl"><input type="checkbox" data-qv="${esc(id)}" data-k="esterna" ${v.esterna ? "checked" : ""}> Spesa esterna: maggiorazione del ${qta(magg())}% sul costo</label>` : ""}
    ${nota}
    ${s?.noteInterne ? `<p class="vint">Nota interna: ${esc(s.noteInterne)}</p>` : ""}
  </div></div>`;
}

function riquadroLista(){
  if (!Object.keys(b.items).length) return `<p class="muted" style="margin:0 0 18px">Nessun articolo spuntato.</p>`;
  const a = attrezzatura(), kit = kitUsabili(), alto = kit[kit.length - 1], u = b.attUnit === "m" ? "mezza giornata" : "giornata";
  const diff = a.pezzi ? 0 : a.alGiorno - a.val;
  return `<div class="kpi">
    <div><small>Valore del materiale</small><strong>${eur(a.val)}</strong><span>a ${u}, prezzi lavoro</span></div>
    <div><small>Livello calcolato</small><strong>${a.auto ? "Kit " + esc(a.auto.nome) : "Oltre il tetto"}</strong><span>${a.auto ? `materiale fino a ${eur(sogliaKit(a.auto))}` : alto ? `sopra ${eur(sogliaKit(alto) || 0)}` : "nessun kit nel foglio"}</span></div>
    <div><small>Nel preventivo</small><strong>${eur(a.alGiorno)}</strong><span>× ${qta(a.g)} = ${eur(a.totale)}</span></div>
  </div>
  ${!a.pezzi && a.val > 0 ? `<p class="cnt" style="margin:-8px 0 18px">Rispetto al valore a pezzi: ${diff >= 0 ? "+" + eur(diff) : eurSegno(-diff)} a ${u}.</p>` : ""}`;
}
function riquadroTetto(){
  const a = attrezzatura();
  if (!a.oltre) return "";
  const kit = kitUsabili(), alto = kit[kit.length - 1], u = b.attUnit === "m" ? "mezza giornata" : "giornata";
  if (!alto) return `<div class="note warn">Nel foglio Kit non ci sono livelli: scrivi il prezzo a mano.</div><div class="sub"><label class="f"><span>Prezzo a ${u} (€)</span><input class="inp num" inputmode="decimal" ${Q}="tettoPrezzo" value="${esc(b.tettoPrezzo)}" placeholder="0,00"></label></div>`;
  const ecc = a.val - (sogliaKit(alto) || 0);
  return `<div class="note warn">Il materiale vale ${eur(a.val)} a ${u}, oltre la soglia del Kit ${esc(alto.nome)} (${eur(sogliaKit(alto) || 0)}).</div>
    ${opzione(Q, "tetto", "top", b.tetto, `Kit ${esc(alto.nome)} più l’eccedenza`, `${eur(prezzoKit(alto))} + ${eur(ecc)} = ${eur(prezzoKit(alto) + ecc)} a ${u}`)}
    ${opzione(Q, "tetto", "mano", b.tetto, "Prezzo a mano", "Scrivi tu il prezzo")}
    ${b.tetto === "mano" ? `<div class="sub"><label class="f"><span>Prezzo a ${u} (€)</span><input class="inp num" inputmode="decimal" ${Q}="tettoPrezzo" value="${esc(b.tettoPrezzo)}" placeholder="0,00"></label></div>` : ""}`;
}
function riquadroTotale(){
  const t = conto(), L4 = stato.impostazioni.etichetta4;
  if (!(t.servizi > 0)) return `<p class="muted">Il preventivo è ancora vuoto.</p>`;
  let avviso = "";
  if (t.arr > 0 && t.arr / t.totale > 0.15) avviso = `<div class="note warn">Stai scontando il ${qta(t.arr / t.totale * 100)}% sul totale calcolato.</div>`;
  else if (t.arr < 0) avviso = `<div class="note${-t.arr / t.totale > 0.15 ? " warn" : ""}">Arrotondamento in su di ${eur(-t.arr)} (${qta(-t.arr / t.totale * 100)}%).</div>`;
  let fz = "";
  if (t.fz?.ok) fz = `<div class="fzbox"><small>Da inserire su Fiscozen</small><strong>Compenso ${eur(t.fz.compenso)}</strong><span>${esc(L4)} ${eur(t.fz.riv)}${t.fz.bollo ? ", bollo 2,00 €" : ""}: fattura di ${eur(t.voluto)}</span></div>`;
  else if (t.fz) fz = `<div class="note warn">Con ${eur(t.voluto)} la fattura su Fiscozen non torna al centesimo. Scegli una cifra vicina:<div class="actions" style="margin-top:10px">${[t.fz.sotto, t.fz.sopra].filter(x => x).map(x => `<button class="btn small" data-action="q-cifra" data-v="${x}">${eur(x)}</button>`).join("")}</div></div>`;
  return `<dl class="tot big">
    <dt>Totale servizi</dt><dd>${eur(t.servizi)}</dd>
    <dt>${esc(L4)}</dt><dd>${eur(t.riv)}</dd>
    <dt>Marca da bollo</dt><dd>${t.bollo ? eur(t.bollo) : "Non dovuta"}</dd>
    <dt class="sep">Totale calcolato</dt><dd class="sep">${eur(t.totale)}</dd>
    ${t.arr ? `<dt>Arrotondamento</dt><dd>${eurSegno(t.arr)}</dd>` : ""}
    <dt class="grand">Totale al cliente</dt><dd class="grand">${eur(t.voluto)}</dd>
  </dl>${avviso}${fz}`;
}
function noleggioTesto(n){
  const p = centesimi(n.prezzo);
  if (!(p > 0)) return `IVA 22% e +${qta(magg())}% = –`;
  const c = noleggioCalcolato(n), w = centesimi(n.cifra);
  return `${eur(p)} + IVA = ${eur(Math.round(p * 1.22))}, +${qta(magg())}% = ${eur(c)}${w > 0 && w < c ? ` <span class="bad">sotto di ${eur(c - w)}</span>` : ""}`;
}
const importoNoleggioTesto = n => n.paga === "cliente" ? (centesimi(n.prezzo) > 0 ? eur(centesimi(n.prezzo)) + " + IVA" : "+ IVA") : eur(importoNoleggio(n));
function noleggiHTML(){
  return `<h3 class="grp" style="margin-top:32px">Noleggio esterno</h3><p class="hint" style="margin-bottom:10px">Attrezzatura presa da un rental. I prezzi dei noleggi si scrivono sempre IVA esclusa.</p>
    ${b.noleggi.map((n, i) => `<div class="voce on"><div class="vbody" style="margin:0;padding:0;border:0">
      <label class="vnote"><span>Cosa e da quale noleggio</span><input class="inp" data-qn="${i}" data-k="desc" value="${esc(n.desc)}" placeholder="Es. drone DJI Inspire, da Rental X"></label>
      <label class="w-s"><span>Prezzo, IVA esclusa (€)</span><input class="inp" inputmode="decimal" data-qn="${i}" data-k="prezzo" value="${esc(n.prezzo)}" placeholder="0,00"></label>
      ${n.paga === "cliente" ? "" : `<div class="calc" data-ncalc="${i}">${noleggioTesto(n)}</div><label class="w-s"><span>Cifra a preventivo (€)</span><input class="inp" inputmode="decimal" data-qn="${i}" data-k="cifra" value="${esc(n.cifra)}" placeholder="${esc(cifraCampo(noleggioCalcolato(n)))}"></label>`}
      <div class="vimp" data-nimp="${i}">${importoNoleggioTesto(n)}</div>
      <div class="vmodo"><div class="seg" role="radiogroup" aria-label="Chi paga il noleggio">${[["io", "Lo pago io, IVA inclusa"], ["cliente", "Lo paga il cliente, + IVA"]].map(([k, l]) => `<label><input type="radio" name="n-${i}" value="${k}" data-qn="${i}" data-k="paga" ${n.paga === k ? "checked" : ""}>${l}</label>`).join("")}</div>
        <button class="btn small" data-action="q-noldel" data-i="${i}">Togli</button>
        ${n.paga === "cliente" ? `<span class="cnt">Fuori dal totale: il noleggio fattura direttamente al cliente.</span>` : ""}</div>
    </div></div>`).join("")}
    <button class="btn small" data-action="q-noladd">Aggiungi noleggio</button>`;
}
function consuntivoHTML(){
  const lista = Object.entries(b.voci).filter(([, v]) => v.on && v.modo === "cons");
  if (!lista.length) return "";
  return `<h3 class="grp" style="margin-top:32px">Spese a consuntivo</h3><p class="hint" style="margin-bottom:8px">Fuori dal totale. Per ognuna scegli chi la fattura al cliente; la maggiorazione si cambia nelle Impostazioni.</p>
    ${lista.map(([id, v]) => {
      const nome = nomeVoce(id, v), f = v.fatt === "io" ? "io" : "cliente";
      return `<div class="cons-row"><div><strong>${esc(nome)}</strong>${v.nota ? `<small>${esc(v.nota)}</small>` : ""}</div>
        <div class="seg" role="radiogroup" aria-label="Chi fattura ${esc(nome)}">${[["cliente", "Fattura diretta al cliente"], ["io", `Anticipo io, +${qta(magg())}%`]].map(([k, l]) => `<label><input type="radio" name="f-${esc(id)}" value="${k}" data-qv="${esc(id)}" data-k="fatt" ${f === k ? "checked" : ""}>${l}</label>`).join("")}</div>
        <span class="cnt">${centesimi(v.stima) > 0 ? `Stima nel preventivo: ${eur(stimaCliente(v))}` : "Senza stima"}</span></div>`;
    }).join("")}`;
}

function anteprima(){
  const t = conto(), {fasi, note} = vociCliente(), esclusi = diciturEsclusi();
  return `<small class="cnt" style="display:block;margin-bottom:12px">Anteprima del preventivo</small>
    ${fasi.length ? fasi.map(f => `<h4>${f.NOME}</h4><ul>${f.VOCE.map(v => `<li><span>${esc(v.NOME)}${v.RIF ? `<sup>${v.RIF}</sup>` : ""}${v.DESCRIZIONE ? `<br><small class="muted">${esc(v.DESCRIZIONE)}</small>` : ""}</span><span>${esc([v.QUANTITA, v.IMPORTO].filter(Boolean).join(" · "))}</span></li>`).join("")}</ul>`).join("") : `<p class="muted">Nessuna voce.</p>`}
    <div class="ptot">Totale ${eur(t.voluto)}</div>
    <div class="cnt">${esc(diciturTotale(t))}${esclusi ? " " + esc(esclusi) : ""}</div>
    <div class="pnote">${condizioni().map(esc).join("<br>")}</div>
    ${note.length ? `<div class="pnote">${note.map((n, i) => `<sup>${i + 1}</sup> ${esc(n)}`).join("<br>")}</div>` : ""}
    ${b.accettOn ? `<div class="pnote"><strong>Accettazione</strong>: clausola e spazi per luogo, data e firme in fondo al preventivo.</div>` : ""}`;
}

function riepilogo(){
  const c = cliente(), trattino = `<span class="muted">–</span>`, date = elencoDate(b.date), a = attrezzatura();
  const cond = [b.accontoOn && `acconto ${esc(b.accontoPerc)}%`, b.revOn && `${esc(b.revN)} revisioni`, b.consOn && `consegna in ${esc(b.consGiorni)} gg lav.`, b.accettOn && "accettazione con firma"].filter(Boolean);
  const n = Object.values(b.voci).filter(v => v.on).length;
  return `<dl class="sum">
    <dt>Cliente</dt><dd>${c ? esc(c.nome) : trattino}</dd>
    <dt>Progetto</dt><dd>${b.titolo ? esc(b.titolo) : trattino}</dd>
    <dt>Riprese</dt><dd>${date ? esc(date) : "Da definire"}${b.luogo ? ", " + esc(b.luogo) : ""}</dd>
    <dt>Preventivo</dt><dd>${b.dataPrev ? dataBreve(b.dataPrev) : trattino}, valido ${esc(b.validita)} giorni</dd>
    <dt>Voci</dt><dd>${n || trattino}</dd>
    <dt>Attrezzatura</dt><dd>${a.on ? `${esc(a.etichetta)} × ${qta(a.g)}` : "Nessuna"}${b.noleggi.length ? `, ${b.noleggi.length} ${b.noleggi.length === 1 ? "noleggio esterno" : "noleggi esterni"}` : ""}</dd>
    <dt>Condizioni</dt><dd>${cond.length ? cond.join(", ") : "Nessuna"}</dd>
  </dl>`;
}

function pannello(){
  const t = conto(), L4 = stato.impostazioni.etichetta4, a = t.a, trattino = `<span class="muted">–</span>`;
  const cliNol = b.noleggi.filter(n => n.paga === "cliente"), cons = Object.values(b.voci).filter(v => v.on && v.modo === "cons");
  const stime = cons.reduce((s, v) => s + stimaCliente(v), 0);
  return `<button class="btn small panel-close" data-action="panel">Chiudi</button><h3>Totali</h3>
    <dl class="tot">
      ${FASI.map(([f, l]) => `<dt>${l}</dt><dd>${t.fasi[f] ? eur(t.fasi[f]) : trattino}</dd>`).join("")}
      ${a.on ? `<dt>Attrezzatura<small>${esc(a.etichetta)} × ${qta(a.g)} ${b.attUnit === "m" ? "½ g" : "gg"}</small></dt><dd>${eur(a.totale)}</dd>` : ""}
      ${t.nol ? `<dt>Noleggi esterni</dt><dd>${eur(t.nol)}</dd>` : ""}
      <dt class="sep">Totale servizi</dt><dd class="sep">${eur(t.servizi)}</dd>
      <dt>${esc(L4)}</dt><dd>${eur(t.riv)}</dd>
      ${t.bollo ? `<dt>Marca da bollo</dt><dd>${eur(t.bollo)}</dd>` : ""}
      ${t.arr ? `<dt>Arrotondamento</dt><dd>${eurSegno(t.arr)}</dd>` : ""}
      <dt class="grand">Totale</dt><dd class="grand">${eur(t.voluto)}</dd>
    </dl>
    ${cliNol.length ? `<div class="saved">Noleggi pagati dal cliente, fuori dal totale: ${eur(cliNol.reduce((s, n) => s + (centesimi(n.prezzo) || 0), 0))} + IVA</div>` : ""}
    ${cons.length ? `<div class="saved">A consuntivo, fuori dal totale: ${cons.length} ${cons.length === 1 ? "voce" : "voci"}${stime > 0 ? `, stima ${eur(stime)}` : ""}</div>` : ""}
    ${t.fz ? (t.fz.ok ? `<div class="saved">Su Fiscozen: compenso <strong>${eur(t.fz.compenso)}</strong></div>` : `<div class="saved" style="color:var(--err)">La cifra scelta non torna su Fiscozen: vedi il passo Totale.</div>`) : ""}
    ${b.saved ? `<div class="saved">Bozza salvata alle ${new Date(b.saved).toLocaleTimeString("it-IT", {hour: "2-digit", minute: "2-digit"})}</div>` : ""}`;
}

function passoHTML(){
  const c = cliente();
  switch (b.step){
    case "cliente": return `<h2 class="field-q">Per quale cliente?</h2><p class="hint">L’elenco arriva dal foglio Clienti.</p>
      <label class="f"><span>Cliente</span>${selezione(`${Q}="cli" style="max-width:420px"`, [["", "Scegli dal foglio Clienti"], ...C.clienti.map(x => [x.id, `${x.nome} (${x.id})`])], b.cli)}</label>
      ${c ? `<div class="out" style="margin-top:8px"><p><strong>${esc(c.nome)}</strong><br><span class="muted">${esc([righeCliente(c).CLIENTE_RIGA1, righeCliente(c).CLIENTE_RIGA2, righeCliente(c).CLIENTE_RIGA3].filter(Boolean).join(" · ") || c.tipo)}</span></p></div>` : ""}`;

    case "progetto": return `<h2 class="field-q">Il progetto</h2><p class="hint">Il titolo va nel nome del file. Date e luogo sono facoltativi.</p>
      <label class="f"><span>Titolo del progetto</span><input class="inp" ${Q}="titolo" value="${esc(b.titolo)}" placeholder="Es. Spot autunno"><div class="cnt" id="titCount"></div></label>
      <label class="f"><span>Breve descrizione per il cliente (facoltativa)</span><textarea class="inp" ${Q}="desc" placeholder="Es. Riprese e montaggio di uno spot di 30 secondi per i social.">${esc(b.desc)}</textarea></label>
      ${campoDate("q", b.date)}
      <label class="f"><span>Luogo (facoltativo)</span><input class="inp" ${Q}="luogo" value="${esc(b.luogo)}" placeholder="Es. Torino"></label>
      <div class="row2"><label class="f"><span>Data del preventivo</span><input class="inp" type="date" ${Q}="dataPrev" value="${esc(b.dataPrev)}" style="max-width:200px"></label>
        <label class="f"><span>Validità (giorni)</span><input class="inp num" type="number" min="1" ${Q}="validita" value="${esc(b.validita)}"></label></div>`;

    case "pre": case "prod": case "post": {
      const note = {pre: "Spunta solo quello che fai davvero: le call ordinarie non si addebitano.",
        prod: "Le voci a giornata partono dal numero di date di ripresa. L’attrezzatura è al passo successivo.",
        post: "Le note a piè di pagina si possono modificare per questo preventivo."};
      const libere = Object.entries(b.voci).filter(([, v]) => v.libera && v.fase === b.step);
      return `<h2 class="field-q">${NOME_FASE[b.step]}</h2><p class="hint">${note[b.step]}</p>
        ${serviziFase(b.step).map(s => voceHTML(s.id, s, b.voci[s.id])).join("")}
        ${libere.map(([id, v]) => voceHTML(id, null, v)).join("")}
        <button class="btn small" data-action="q-libadd" data-fase="${b.step}" style="margin-top:6px">Aggiungi voce libera</button>`;
    }

    case "att": {
      const u = b.attUnit === "m" ? "mezza giornata" : "giornata";
      return `<h2 class="field-q">Attrezzatura</h2><p class="hint">Nel preventivo compare come kit: il cliente non vede i singoli pezzi.</p>
      ${opzione(Q, "attMode", "lista", b.attMode, "Compilo o carico la lista", "Il livello del kit si calcola dal valore del materiale")}
      ${opzione(Q, "attMode", "livello", b.attMode, "Scelgo il livello a mano", "Senza lista, per un preventivo veloce")}
      ${opzione(Q, "attMode", "none", b.attMode, "Nessuna attrezzatura", "Lavoro solo come operatore")}
      ${b.attMode !== "none" ? `<div class="sub">
        <div class="f"><span>Durata</span>${seg("attUnit", [["g", "Giornata intera"], ["m", "Mezza giornata"]])}</div>
        <label class="f"><span>Giorni</span><input class="inp num" type="number" min="1" ${Q}="attGiorni" value="${esc(b.attGiorni !== "" ? b.attGiorni : String(giorniDefault()))}"><div class="cnt">Di default uguali al numero di date di ripresa.</div></label>
        <label class="f"><span>Cosa include, per il cliente (facoltativo)</span><input class="inp" ${Q}="attNota" value="${esc(b.attNota)}" placeholder="Es. 1 camera, ottiche fisse, kit luci" style="max-width:600px"><div class="cnt">Compare sotto la voce dell’attrezzatura nel preventivo.</div></label>
        ${b.attMode === "livello" ? (kitUsabili().map(k => opzione(Q, "attLivello", k.nome, b.attLivello, "Kit " + esc(k.nome), `${eur(prezzoKit(k))} a ${u}${sogliaKit(k) !== null ? `, materiale fino a ${eur(sogliaKit(k))}` : ""}`)).join("") || `<div class="note warn">Nel foglio Kit non ci sono livelli attivi con un prezzo a ${u}.</div>`)
            + opzione(Q, "attLivello", KIT_MANO, b.attLivello, "Kit scritto a mano", "Nome e prezzo li scrivi tu")
            + (b.attLivello === KIT_MANO ? `<div class="sub">
              <label class="f"><span>Nome, come lo vede il cliente</span><input class="inp" ${Q}="kitNome" value="${esc(b.kitNome)}" placeholder="Es. Kit intervista" style="max-width:420px"><div class="cnt">Nel preventivo compare come “Attrezzatura tecnica, ” seguito da questo nome.</div></label>
              <label class="f"><span>Prezzo a ${u} (€)</span><input class="inp num" inputmode="decimal" ${Q}="kitPrezzo" value="${esc(b.kitPrezzo)}" placeholder="0,00"><div class="cnt">Al netto di rivalsa e bollo, come i prezzi del foglio; si moltiplica per i giorni.</div></label>
            </div>` : "")
          : `<div class="note">La lista la compili al passo successivo.</div>`}
      </div>` : ""}
      ${noleggiHTML()}`;
    }

    case "lista": return `<h2 class="field-q">Lista attrezzatura</h2><p class="hint">Spunta quello che porti: il livello del kit si calcola da solo, a ${b.attUnit === "m" ? "mezza giornata" : "giornata"}. Quello che non è nel foglio lo aggiungi a mano sotto la sua categoria, con il suo prezzo.</p>
      <div class="actions" style="margin-bottom:18px"><button class="btn" data-action="q-importa">Importa da una lista ATT</button></div>
      <div id="listaSum">${riquadroLista()}</div>
      <input class="search" type="search" placeholder="Cerca un articolo" data-qfilter aria-label="Cerca un articolo" style="margin-bottom:8px">
      <div class="inv">${L.categorie.map(cat => {
        const its = tutti().filter(a => a.attivo && a.cat === cat);
        if (!its.length) return "";
        return `<h3 class="grp" data-qcat="${esc(cat)}">${esc(cat)}</h3>${its.map(a => {
          const x = b.items[a.id];
          if (a.manuale){
            const m = b.manuali[a.id];
            return `<div class="inv-row att-row man-row" data-qname="${esc((a.nome + " " + a.id).toLowerCase())}" data-qcat2="${esc(cat)}"><input type="checkbox" data-qitem="${esc(a.id)}" data-k="on" ${x ? "checked" : ""} aria-label="Porta ${esc(a.nome || "articolo a mano")}">${campoNome("data-qman", a.id, m)}${campoPrezzo("data-qman", a.id, m, campoPrezzoPezzo())}${tastoTogli("q-mantogli", a.id, m)}${x ? `<input class="inp" inputmode="numeric" data-qitem="${esc(a.id)}" data-k="qta" value="${esc(x.qta)}" aria-label="Quantità ${esc(a.nome)}">` : "<span></span>"}</div>`;
          }
          return `<div class="inv-row att-row" data-qname="${esc((a.nome + " " + a.id).toLowerCase())}" data-qcat2="${esc(cat)}"><input type="checkbox" id="qi-${esc(a.id)}" data-qitem="${esc(a.id)}" data-k="on" ${x ? "checked" : ""}><label for="qi-${esc(a.id)}">${esc(a.nome)} <small class="muted">${esc(a.id)}</small></label><span class="muted">${eur(prezzoPezzo(a))}</span><span class="muted av">su ${a.q}</span>${x ? `<input class="inp" inputmode="numeric" data-qitem="${esc(a.id)}" data-k="qta" value="${esc(x.qta)}" aria-label="Quantità ${esc(a.nome)}">` : "<span></span>"}</div>`;
        }).join("")}${tastoAggiungi("q-manadd", cat, "data-qname")}`;
      }).join("")}</div>
      <h3 class="grp">Livello e prezzo</h3>
      <label class="f"><span>Livello del kit</span>${selezione(`${Q}="override" style="max-width:260px"`, [["auto", "Automatico"], ...kitUsabili().map(k => [k.nome, "Kit " + k.nome])], b.override)}</label>
      <div id="tettoBox" data-oltre="${String(!!attrezzatura().oltre)}">${riquadroTetto()}</div>
      <div class="f"><span>Nel preventivo</span>${seg("listaMode", [["kit", "Come kit"], ["pezzi", "A pezzi"]])}</div>
      ${interruttore(Q, "genAtt", b.genAtt, "Genera anche la lista attrezzatura (ATT)", "Stesso codice del preventivo, per la scheda Trello")}`;

    case "cond": return `<h2 class="field-q">Condizioni</h2><p class="hint">Tutte facoltative: se le lasci spente, nel preventivo non compaiono.</p>
      ${interruttore(Q, "accontoOn", b.accontoOn, "Acconto alla conferma")}
      ${b.accontoOn ? `<div class="sub"><label class="f"><span>Percentuale</span><input class="inp num" inputmode="decimal" ${Q}="accontoPerc" value="${esc(b.accontoPerc)}"><div class="cnt" id="accHint"></div></label></div>` : ""}
      ${interruttore(Q, "revOn", b.revOn, "Revisioni incluse", "Giri di modifiche sul montaggio. Lasciala spenta se fai solo l’operatore")}
      ${b.revOn ? `<div class="sub"><label class="f"><span>Numero di revisioni</span><input class="inp num" type="number" min="0" ${Q}="revN" value="${esc(b.revN)}"></label></div>` : ""}
      ${interruttore(Q, "consOn", b.consOn, "Tempi di consegna", "Stima in giorni lavorativi dalle riprese")}
      ${b.consOn ? `<div class="sub"><label class="f"><span>Giorni lavorativi</span><input class="inp num" type="number" min="1" ${Q}="consGiorni" value="${esc(b.consGiorni)}"></label></div>` : ""}
      <label class="f" style="margin-top:20px"><span>Note generali (facoltative)</span><textarea class="inp" ${Q}="note" placeholder="Es. Eventuali permessi di ripresa sono a carico del cliente.">${esc(b.note)}</textarea></label>
      <div style="margin-top:20px">${interruttore(Q, "accettOn", b.accettOn, "Accettazione con firma", "In fondo la clausola di accettazione e gli spazi per luogo, data e firme: il preventivo firmato vale come accordo di inizio lavori")}</div>`;

    case "totale": return `<h2 class="field-q">Totale</h2><p class="hint">Scrivi la cifra che comunicherai al cliente: l’app calcola l’arrotondamento e il compenso da inserire su Fiscozen.</p>
      ${interruttore(Q, "noRound", b.noRound, "Nessun arrotondamento", "Il totale resta quello calcolato")}
      ${b.noRound ? "" : `<label class="f"><span>Cifra finale desiderata (€)</span><input class="inp num" inputmode="decimal" ${Q}="cifra" value="${esc(b.cifra)}" placeholder="0,00"></label>`}
      <div id="totBox">${riquadroTotale()}</div>
      ${consuntivoHTML()}`;

    case "riep": {
      const codice = b.edit?.codice || codiceProvvisorio(), cartella = stato.impostazioni.file.archivioPreventivi?.name || "Archivio preventivi";
      const esiste = b.edit && trova(codice, "PRV"), v = esiste ? ultimaVersione(esiste) + 1 : 1, att = trova(codice, "ATT"), va = att ? ultimaVersione(att) + 1 : 1;
      const nome = nomeFile({codice, tipo: "PRV", titolo: b.titolo, cliente: c?.nome, versione: v});
      const conAtt = b.attMode === "lista" && b.genAtt;
      return `<h2 class="field-q">Controlla e genera</h2><p class="hint">Il preventivo ha i prezzi di ogni servizio; per l’attrezzatura, il kit con la tua nota.</p>
        ${riepilogo()}
        <div class="prev" id="prevBox">${anteprima()}</div>
        <div class="out">
          <p><strong>Cartella</strong><br>${esc(cartella)} / ${esc(nomeCartellaCliente(c))}</p>
          <p><strong>Preventivo</strong><br><span class="fname">${esc(nome)}</span> <span class="muted">(Google Doc)</span><br><span class="fname">${esc(nome)}.pdf</span></p>
          ${conAtt ? `<p><strong>Lista attrezzatura</strong> (Archivio liste attrezzatura)<br><span class="fname">${esc(nomeFile({codice, tipo: "ATT", titolo: b.titolo, cliente: c?.nome, versione: va}))}.pdf</span></p>` : ""}
          <p class="muted">${b.edit ? `Nuova versione del preventivo ${esc(codice)}: le precedenti restano in archivio.` : "Il codice definitivo si assegna alla generazione: è il primo libero dell’anno."}</p>
        </div>`;
    }
  }
  return "";
}

function codiceProvvisorio(){
  const a = new Date().getFullYear();
  const n = documenti().filter(d => d.codice.startsWith(a + "-")).map(d => parseInt(d.codice.slice(5), 10) || 0);
  return `${a}-${String(Math.max(0, ...n) + 1).padStart(3, "0")}`;
}

function valida(id){
  if (id === "cliente" && !b.cli) return "Scegli un cliente per continuare.";
  if (id === "progetto"){
    if (!b.titolo.trim()) return "Scrivi il titolo del progetto.";
    if (!b.dataPrev) return "Indica la data del preventivo.";
    if (!(numero(b.validita) > 0)) return "Indica per quanti giorni vale il preventivo.";
    if (erroreDate(b.date)) return erroreDate(b.date);
  }
  if (id === "pre" || id === "prod" || id === "post"){
    for (const [vid, v] of Object.entries(b.voci)){
      if (!v.on || faseVoce(vid, v) !== id) continue;
      const s = v.libera ? null : servizio(vid), nome = nomeVoce(vid, v);
      if (v.libera && !v.nome.trim()) return "Dai un nome alla voce libera, oppure toglila.";
      if (v.modo === "tot" && v.esterna){ if (!(centesimi(v.costo) > 0) && !(centesimi(v.cifra) > 0)) return `${nome}: scrivi il costo IVA inclusa.`; }
      else if (v.modo === "tot"){
        if (v.unita === "Forfait"){ if (!(centesimi(v.importo) > 0)) return `${nome}: scrivi l’importo, oppure scegli Inclusa o A consuntivo.`; }
        else if (!(numero(v.qta) > 0) || !(centesimi(v.prezzo) >= 0 && v.prezzo !== "") || (v.unita !== "Fisso" && !(numero(v.ris) >= 1)))
          return `${nome}: compila ${v.unita === "Fisso" ? "quantità e prezzo" : "quantità, risorse e prezzo"}.`;
      }
      if (s?.notaObbligatoria && !v.nota.trim()) return `${nome}: compila la nota a piè di pagina, è obbligatoria.`;
    }
  }
  if (id === "att"){
    if (b.attMode !== "none" && !(giorniAtt() > 0)) return "Indica per quanti giorni serve l’attrezzatura.";
    if (b.attMode === "livello" && b.attLivello === KIT_MANO){
      if (!b.kitNome.trim()) return "Kit scritto a mano: scrivi il nome.";
      if (!(centesimi(b.kitPrezzo) > 0)) return "Kit scritto a mano: scrivi il prezzo.";
    } else if (b.attMode === "livello" && !kitUsabili().length) return "Nel foglio Kit non ci sono livelli: scegli il kit scritto a mano, la lista o nessuna attrezzatura.";
    for (const n of b.noleggi){
      if (!n.desc.trim()) return "Noleggio esterno: scrivi cosa e da quale noleggio.";
      if (!(centesimi(n.prezzo) > 0)) return `Noleggio esterno (${n.desc.trim()}): scrivi il prezzo IVA esclusa.`;
    }
  }
  if (id === "lista"){
    if (!Object.keys(b.items).length) return "Spunta almeno un articolo, oppure torna indietro e scegli un’altra opzione.";
    for (const [iid, x] of Object.entries(b.items)){
      const a = articolo(iid), q = numero(x.qta);
      if (!(q > 0) || !Number.isInteger(q)) return `${a.nome || "Articolo aggiunto a mano"}: indica la quantità.`;
      if (q > a.q) return `${a.nome}: in inventario ne hai ${a.q}.`;
    }
    const em = erroreManuali(b, campoPrezzoPezzo()); if (em) return em;
    const a = attrezzatura();
    if (a.oltre && (b.tetto === "mano" || !kitUsabili().length) && !(centesimi(b.tettoPrezzo) > 0)) return "Scrivi il prezzo dell’attrezzatura.";
  }
  if (id === "cond"){
    if (b.accontoOn){ const p = numero(b.accontoPerc); if (!(p > 0 && p < 100)) return "L’acconto deve essere tra 1 e 99%."; }
    if (b.revOn && !(b.revN !== "" && +b.revN >= 0)) return "Indica il numero di revisioni, oppure spegni l’opzione.";
    if (b.consOn && !(+b.consGiorni > 0)) return "Indica i giorni di consegna, oppure spegni l’opzione.";
  }
  if (id === "totale"){
    if (!(conto().servizi > 0)) return "Il preventivo è vuoto: aggiungi almeno una voce.";
    if (!b.noRound && !(centesimi(b.cifra) > 0)) return "Scrivi la cifra finale, oppure attiva “Nessun arrotondamento”.";
  }
  return "";
}

/* ---------- Aggiornamenti dal vivo ---------- */
function dalVivo(){
  document.querySelectorAll("[data-imp]").forEach(el => { const v = b.voci[el.dataset.imp]; if (v) el.textContent = importoTesto(v); });
  document.querySelectorAll("[data-calc]").forEach(el => { const v = b.voci[el.dataset.calc]; if (v) el.innerHTML = esternaTesto(v); });
  document.querySelectorAll("[data-ncalc]").forEach(el => { const n = b.noleggi[+el.dataset.ncalc]; if (n) el.innerHTML = noleggioTesto(n); });
  document.querySelectorAll("[data-nimp]").forEach(el => { const n = b.noleggi[+el.dataset.nimp]; if (n) el.textContent = importoNoleggioTesto(n); });
  const tc = $("#titCount");
  if (tc){ const s = slug(b.titolo); tc.textContent = s ? `Nel nome del file: ${s.slice(0, 32)}${s.length > 32 ? ` (tagliato, ${s.length} caratteri su 32)` : ` (${s.length}/32)`}` : ""; }
  const dh = $("#dateHint-q");
  if (dh){ const n = giorniDate(b.date).length; dh.textContent = n ? `${n} ${n === 1 ? "giorno" : "giorni"} di ripresa (${elencoDate(b.date)}): le voci a giornata in Produzione e i giorni di attrezzatura partono da ${n}.` : "Senza date, le voci a giornata partono da 1."; }
  const ls = $("#listaSum"); if (ls) ls.innerHTML = riquadroLista();
  const tb = $("#tettoBox");
  if (tb){ const ol = String(!!attrezzatura().oltre); if (tb.dataset.oltre !== ol || (ol === "true" && !tb.contains(document.activeElement))){ tb.dataset.oltre = ol; tb.innerHTML = riquadroTetto(); } }
  const t = conto();
  const ah = $("#accHint"); if (ah){ const p = numero(b.accontoPerc); ah.textContent = p > 0 ? `= ${eur(Math.round(t.voluto * p / 100))} sul totale` : ""; }
  const tot = $("#totBox"); if (tot) tot.innerHTML = riquadroTotale();
  const pv = $("#prevBox"); if (pv) pv.innerHTML = anteprima();
  const p = $("#panel"); if (p) p.innerHTML = pannello();
  const pt = $("#ptog"); if (pt) pt.textContent = "Totale " + eur(t.voluto);
}
function ridisegna(fuoco){
  $("#qsteps").innerHTML = barraPassi(passi(), ETICHETTE, b.step, b.visited, "q-goto");
  $("#stepBody").innerHTML = passoHTML();
  dalVivo();
  if (fuoco){ const el = document.querySelector(fuoco); if (el) el.focus({preventScroll: true}); }
}
const vaiAlPasso = id => { b.step = id; if (!b.visited.includes(id)) b.visited.push(id); salva(); vistaProcedura($("#view")); };

const RIDISEGNA = ["cli", "attMode", "attUnit", "attLivello", "override", "tetto", "listaMode", "accontoOn", "revOn", "consOn", "noRound", "genAtt"];
function campo(el){
  if (!b || !L) return;
  let rr = false, fuoco = null;
  if (el.dataset.qv !== undefined){
    const id = el.dataset.qv, k = el.dataset.k, sel = `[data-qv="${CSS.escape(id)}"][data-k="${k}"]`;
    if (k === "on"){ if (el.checked) b.voci[id] = nuovaVoce(id); else delete b.voci[id]; rr = true; fuoco = sel; }
    else {
      const v = b.voci[id]; if (!v) return;
      if (k === "unita"){
        v.unita = el.value;
        const s = v.libera ? null : servizio(id);
        if (s){ const p = prezzoListino(s, v.unita); v.prezzo = p !== null ? cifraCampo(p) : ""; if ((v.unita === "Giornata" || v.unita === "Mezza giornata") && faseDi(s.cat) === "prod") v.qta = String(giorniDefault()); }
        rr = true; fuoco = sel;
      } else if (k === "esterna"){ v.esterna = el.checked; rr = true; fuoco = sel; }
      else if (k === "fatt" || k === "modo"){ v[k] = el.value; rr = true; fuoco = `${sel}[value="${el.value}"]`; }
      else v[k] = el.value;
    }
  } else if (el.dataset.qitem !== undefined){
    const id = el.dataset.qitem;
    if (el.dataset.k === "on"){ if (el.checked) b.items[id] = {qta: "1"}; else delete b.items[id]; rr = true; fuoco = `[data-qitem="${CSS.escape(id)}"][data-k="on"]`; }
    else if (b.items[id]) b.items[id].qta = el.value;
  } else if (el.dataset.qman !== undefined){
    const m = b.manuali[el.dataset.qman]; if (!m) return;
    m[el.dataset.k] = el.value;
  } else if (el.dataset.qn !== undefined){
    const n = b.noleggi[+el.dataset.qn]; if (!n) return;
    n[el.dataset.k] = el.value;
    if (el.dataset.k === "paga"){ rr = true; fuoco = `[data-qn="${el.dataset.qn}"][data-k="paga"][value="${el.value}"]`; }
  } else if (el.dataset.dt === "q") b.date[+el.dataset.i][el.dataset.k] = el.value;
  else {
    const f = el.getAttribute(Q);
    b[f] = el.hasAttribute("data-bool") ? el.checked : el.value;
    if (RIDISEGNA.includes(f)){ rr = true; fuoco = el.type === "radio" ? `[${Q}="${f}"][value="${el.value}"]` : `[${Q}="${f}"]`; }
  }
  salva();
  const e = $("#err"); if (e) e.textContent = "";
  if (rr) ridisegna(fuoco); else dalVivo();
}

function filtroArticoli(q){
  const f = q.toLowerCase().trim();
  document.querySelectorAll("[data-qname]").forEach(r => { r.hidden = !!f && !r.dataset.qname.includes(f); });
  document.querySelectorAll("[data-qcat]").forEach(h => { h.hidden = ![...document.querySelectorAll(`[data-qcat2="${CSS.escape(h.dataset.qcat)}"]`)].some(r => !r.hidden); });
}

async function importaLista(){
  const liste = documenti("ATT").slice().sort((x, y) => y.codice.localeCompare(x.codice));
  if (!liste.length){ toast("Nessuna lista attrezzatura in archivio"); return; }
  modal("Importa da una lista", `<p>Gli articoli della lista scelta sostituiscono quelli spuntati qui. Poi puoi modificarli.</p>
    <label class="f"><span>Lista</span>${selezione(`id="impLista" style="max-width:none"`, liste.map(d => [d.codice, `${d.codice} · ${d.titolo}`]), liste[0].codice)}</label>`,
    [{label: "Annulla"}, {label: "Importa", primary: true, fn: async () => {
      const codice = document.getElementById("impLista")?.value || liste[0].codice;
      try {
        const dati = await datiVersione(trova(codice, "ATT"));
        b.items = {};
        copiaManuali(dati, b);
        Object.entries(dati?.items || {}).forEach(([id, x]) => { if (articolo(id)) b.items[id] = {qta: x.qta}; });
        salva(); ridisegna();
        toast(`Importati ${Object.keys(b.items).length} articoli dalla lista ${codice}`);
      } catch(e){ gestisciErrore(e); }
    }}]);
}

/* ---------- Generazione ---------- */
/* Dati per il template del preventivo. Le note a piè di pagina stanno in un blocco a parte, in fondo. */
function datiTemplate(codice){
  const c = cliente(), t = conto(), {fasi, note} = vociCliente();
  const info = [elencoDate(b.date) && "Riprese: " + elencoDate(b.date), b.luogo.trim()].filter(Boolean).join(" · ");
  return {TIPO_DOC: "PREVENTIVO", NUMERO: codice, DATA: dataLunga(b.dataPrev), VALIDITA: String(b.validita), ETICHETTA_4: stato.impostazioni.etichetta4, ...righeCliente(c),
    TITOLO: b.titolo.trim(), DESCRIZIONE: b.desc.trim(), INFO_LAVORO: info,
    FASE: fasi, CON_NOTE: note.length > 0, ACCETTAZIONE: !!b.accettOn, NOTA: note.map((n, i) => ({RIF: String(i + 1), TESTO: n})), CONDIZIONE: condizioni(),
    DICITURA_ESCLUSI: diciturEsclusi(), TOTALE: eur(t.voluto), DICITURA_TOTALE: diciturTotale(t),
    TOT_SERVIZI: eur(t.servizi), RIVALSA: eur(t.riv), BOLLO: t.bollo ? eur(t.bollo) : "", ARROTONDAMENTO: t.arr ? eurSegno(t.arr) : ""};
}

// Lista ATT nata dal preventivo: stessa forma dei dati delle liste.
function datiLista(codice){
  const c = cliente();
  const scelti = [];
  for (const cat of L.categorie) for (const a of tutti()) if (a.cat === cat && b.items[a.id]) scelti.push({a, q: numero(b.items[a.id].qta) || 0});
  const noleggi = b.noleggi.map(n => ({nome: n.desc.trim(), fornitore: "", qta: "1", paga: n.paga === "cliente" ? "cliente" : "io"}));
  const trello = scelti.map(({a, q}) => `${q > 1 ? q + "× " : ""}${a.nome}`).concat(noleggi.map(n => `${n.nome} (noleggio)`));
  const pezzi = scelti.reduce((s, x) => s + x.q, 0) + noleggi.length;
  const gruppi = L.categorie.map(cat => ({cat, el: scelti.filter(x => x.a.cat === cat)})).filter(g => g.el.length);
  const template = {NUMERO: codice, TITOLO: b.titolo.trim(), CLIENTE_NOME: c ? c.nome : "Lavoro personale",
    INFO_LAVORO: [elencoDate(b.date), b.luogo.trim()].filter(Boolean).join(" · "),
    CAT: gruppi.map(g => ({NOME: g.cat, CONTEGGIO: String(g.el.reduce((s, x) => s + x.q, 0)), ART: g.el.map(x => ({QTA: String(x.q), NOME: x.a.nome}))})),
    NOLEGGI: noleggi.length > 0, NOL: noleggi.map(n => ({QTA: "1", NOME: n.nome, FORNITORE: "", CHI_PAGA: n.paga === "cliente" ? "Paga il cliente" : "Pago io"})),
    NOTE_LISTA: "", N_ARTICOLI: String(pezzi)};
  const dati = {kind: "lavoro", fromPrv: codice, cli: b.cli, titolo: b.titolo.trim(), date: b.date, luogo: b.luogo, note: "",
    items: JSON.parse(JSON.stringify(b.items)), manuali: JSON.parse(JSON.stringify(b.manuali)), nMan: b.nMan, noleggi, trello, articoli: scelti.map(({a, q}) => ({id: a.id, nome: a.nome, cat: a.cat, q}))};
  return {template, dati};
}

async function genera(){
  for (const id of passi()){
    const m = valida(id);
    if (m){ b.step = id; if (!b.visited.includes(id)) b.visited.push(id); salva(); await vistaProcedura($("#view")); $("#err").textContent = m; return; }
  }
  const f = stato.impostazioni.file, conAtt = b.attMode === "lista" && b.genAtt;
  try {
    if (!f.archivioPreventivi) throw new CollegamentoMancante("Archivio preventivi");
    if (!f.tplPrvDettagliato) throw new CollegamentoMancante("Template PRV — Preventivo");
    if (conAtt && !f.archivioListe) throw new CollegamentoMancante("Archivio liste attrezzatura");
    if (conAtt && !f.tplAttLavoro) throw new CollegamentoMancante("Template ATT — Lista attrezzatura lavoro");
    const passo = avanzamento("Genero il preventivo");
    passo("Assegno il codice");
    const codice = b.edit?.codice || await prossimoCodice(), c = cliente(), t = conto();
    const v = b.edit ? await prossimaVersione(codice, "PRV") : 1;
    passo("Preparo la cartella del cliente");
    const cartella = await cartellaCliente(f.archivioPreventivi.id, c);
    const dati = datiTemplate(codice), nome = nomeFile({codice, tipo: "PRV", titolo: b.titolo, cliente: c?.nome, versione: v});
    const r = await generaDocumento({template: f.tplPrvDettagliato.id, cartella: cartella.id, nome, dati}, x => passo("Preventivo: " + x.toLowerCase()));
    passo("Aggiorno il registro");
    const bozza = JSON.parse(JSON.stringify(b));
    ["step", "visited", "saved", "edit"].forEach(k => delete bozza[k]);
    bozza.conto = {servizi: t.servizi, riv: t.riv, bollo: t.bollo, totale: t.totale, voluto: t.voluto, compenso: t.fz?.ok ? t.fz.compenso : null, fasi: t.fasi, attrezzatura: t.a.totale, noleggi: t.nol};
    bozza.maggiorazione = magg();
    const d = await registra({codice, tipo: "PRV", cliente: c, titolo: b.titolo.trim(), v, nome, doc: r.doc.id, pdf: r.pdf.id, dati: bozza});
    // Lo stato sta nel registro.
    if (!d.stato) d.stato = "Bozza";
    await aggiornaJSON(stato.ids["registro.json"], stato.registro);
    let ra = null, nomeA = null;
    if (conAtt){
      const {template, dati: datiA} = datiLista(codice);
      const va = await prossimaVersione(codice, "ATT");
      nomeA = nomeFile({codice, tipo: "ATT", titolo: b.titolo, cliente: c?.nome, versione: va});
      passo("Preparo la lista attrezzatura");
      const cartA = await cartellaCliente(f.archivioListe.id, c);
      ra = await generaDocumento({template: f.tplAttLavoro.id, cartella: cartA.id, nome: nomeA, dati: template}, x => passo("Lista: " + x.toLowerCase()));
      await registra({codice, tipo: "ATT", cliente: c, titolo: b.titolo.trim(), v: va, nome: nomeA, doc: ra.doc.id, pdf: ra.pdf.id, dati: datiA});
    }
    b = null; store.del(BKEY);
    location.hash = "preventivi";
    const rimasti = [...r.rimasti, ...(ra?.rimasti || [])];
    const tasti = (titolo, x, n) => `<p style="margin:12px 0 4px"><strong>${titolo}</strong></p><div class="actions" style="justify-content:flex-start"><a class="btn small" href="${linkDoc(x.doc.id)}" target="_blank" rel="noopener">Apri il Doc</a><button class="btn small" data-action="scarica-pdf" data-id="${esc(x.pdf.id)}" data-nome="${esc(n)}">Scarica il PDF</button></div>`;
    modal(`Preventivo ${codice}${v > 1 ? ` V${String(v).padStart(2, "0")}` : ""} generato`,
      `${t.fz?.ok ? `<div class="fzbox" style="margin:0 0 8px"><small>Da inserire su Fiscozen</small><strong>Compenso ${eur(t.fz.compenso)}</strong><span>fattura di ${eur(t.voluto)}</span></div>` : ""}
       ${tasti("Preventivo", r, nome)}${ra ? tasti("Lista attrezzatura", ra, nomeA) : ""}
       ${rimasti.length ? `<div class="note warn">Nei documenti sono rimasti questi segnaposto: ${esc([...new Set(rimasti)].join(", "))}. Controlla il template.</div>` : ""}`,
      [{label: "Fatto", primary: true}]);
  } catch(e){
    closeModal();
    gestisciErrore(e, genera);
  }
}

/* ---------- Stato dei preventivi ---------- */
async function cambiaStato(codice, nuovo){
  try {
    await rileggi();
    const d = trova(codice, "PRV");
    if (!d) return;
    d.stato = nuovo;
    await aggiornaJSON(stato.ids["registro.json"], stato.registro);
    const y = window.scrollY;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.scrollTo(0, y);
    toast(`Preventivo ${codice}: ${nuovo.toLowerCase()}`);
  } catch(e){ gestisciErrore(e, () => cambiaStato(codice, nuovo)); }
}

// Dati di un preventivo in archivio (per la lista ATT e, dopo, per il contratto).
export async function datiPreventivo(codice){
  const d = trova(codice, "PRV");
  return d ? {doc: d, dati: await datiVersione(d)} : null;
}

/* ---------- Eventi ---------- */
export function click(act, el){
  if (act === "prv-nuovo"){ nuovoPreventivo(); return true; }
  if (act.startsWith("dt-") && el.dataset.dt === "q" && b){ const f = azioneDate(act, el, b.date); salva(); ridisegna(f); return true; }
  if (!act.startsWith("q-") || !b) return false;
  const st = passi(), i = st.indexOf(b.step);
  if (act === "q-goto"){ const id = el.dataset.id; if (b.visited.includes(id) || id === b.step) vaiAlPasso(id); }
  else if (act === "q-prev"){ if (i > 0) vaiAlPasso(st[i - 1]); }
  else if (act === "q-next"){ const m = valida(b.step); if (m) $("#err").textContent = m; else vaiAlPasso(st[i + 1]); }
  else if (act === "q-manadd"){ const id = nuovoManuale(b, el.dataset.cat); salva(); ridisegna(`[data-qman="${id}"][data-k="nome"]`); }
  else if (act === "q-mantogli"){ togliManuale(b, el.dataset.id); salva(); ridisegna(); }
  else if (act === "q-libadd"){ const id = "LIB-" + (++b.nLib); b.voci[id] = {on: true, libera: true, fase: el.dataset.fase, nome: "", unita: "Forfait", qta: "1", ris: "1", prezzo: "", importo: "", nota: "", modo: "tot", stima: "", fatt: "cliente", esterna: false, costo: "", cifra: ""}; salva(); ridisegna(`[data-qv="${id}"][data-k="nome"]`); }
  else if (act === "q-libdel"){ delete b.voci[el.dataset.id]; salva(); ridisegna(); }
  else if (act === "q-noladd"){ b.noleggi.push({desc: "", prezzo: "", paga: "io", cifra: ""}); salva(); ridisegna(`[data-qn="${b.noleggi.length - 1}"][data-k="desc"]`); }
  else if (act === "q-noldel"){ b.noleggi.splice(+el.dataset.i, 1); salva(); ridisegna(); }
  else if (act === "q-cifra"){ b.cifra = cifraCampo(+el.dataset.v); b.noRound = false; salva(); ridisegna(`[${Q}="cifra"]`); }
  else if (act === "q-importa") importaLista();
  else if (act === "q-genera") genera();
  else return false;
  return true;
}

const testuale = el => el.tagName !== "SELECT" && el.type !== "radio" && el.type !== "checkbox";
const deiCampi = el => el.matches(`[${Q}],[data-qv],[data-qitem],[data-qman],[data-dt="q"],[data-qn]`);
export function input(el){
  if (el.matches("[data-qfilter]")){ filtroArticoli(el.value); return true; }
  if (deiCampi(el) && testuale(el)){ campo(el); return true; }
  return false;
}
export function change(el){
  if (el.dataset.stato !== undefined){ cambiaStato(el.dataset.stato, el.value); return true; }
  if (deiCampi(el) && !testuale(el)){ campo(el); return true; }
  return false;
}
