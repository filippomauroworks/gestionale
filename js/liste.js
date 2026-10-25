/* ---------- Liste attrezzatura, inventario e listini ----------
   Sezione Attrezzatura: elenco delle liste, menu "Scarica" (listini e inventario)
   e procedura guidata per una lista di lavoro o un noleggio a terzi (CLAUDE.md, 5.2). */

import { $, esc, store, toast, modal, closeModal } from "./util.js";
import { stato } from "./dati.js";
import { clienti, listino, righeCliente, ricarica } from "./anagrafiche.js";
import { prossimoCodice, prossimaVersione, registra, documenti, trova, datiVersione } from "./registro.js";
import { cartellaCliente, generaDocumento } from "./genera.js";
import { cercaPerNome, creaCartella, cestina, MIME_CARTELLA } from "./drive.js";
import { nomeFile, nomeCartellaCliente } from "./nomi.js";
import { rigaDocumento, filtra, linkDoc, scaricaPdf } from "./elenco.js";
import { gestisciErrore, CollegamentoMancante } from "./errori.js";
import { opzione, interruttore, selezione, barraPassi, salvata, copia, avanzamento, campoDate, azioneDate, erroreDate } from "./procedura.js";
import { registraApritore, avvisoModifica, ultimaVersione } from "./riapertura.js";
import { numero, centesimi, eur, eurSegno, cifraCampo, qta, totali, fiscozen, scontoNoleggio, giorniTra, oggi, dataLunga, dataBreve, elencoDate, normalizzaDate } from "./calcoli.js";

/* ---------- Bozza ---------- */
const BKEY = "fm-bozza-lista-v1";
const BASE = () => ({step: "tipo", visited: ["tipo"], kind: "lavoro", fromPrv: "", cli: "", titolo: "", date: [{da: "", a: "", intervallo: false}], luogo: "", note: "",
  ritiro: "", riconsegna: "", giorni: "", items: {}, noleggi: [], filter: "", noRound: true, cifra: "", edit: null, saved: null});
let b = store.get(BKEY, null);
if (b) b = Object.assign(BASE(), b);
const salva = () => { b.saved = new Date().toISOString(); store.set(BKEY, b); };
export const haBozza = () => !!b && !!(b.cli || b.titolo || Object.keys(b.items).length);

const ETICHETTE = {tipo: "Tipo", dati: "Dati", articoli: "Articoli", totale: "Totale", riep: "Riepilogo"};
const passi = () => ["tipo", "dati", "articoli", ...(b.kind === "noleggio" ? ["totale"] : []), "riep"];

/* ---------- Dati dai fogli (caricati all'apertura della procedura) ---------- */
let L = null, C = null;
async function caricaFogli(){ [L, C] = await Promise.all([listino(), clienti()]); }

const articolo = id => L.articoli.find(a => a.id === id);
const disponibili = () => L.articoli.filter(a => a.attivo && (b.kind !== "noleggio" || a.noleggiabile));
const cliente = () => b.cli ? C.clienti.find(c => c.id === b.cli) || null : null;
const giorniDefault = () => b.ritiro && b.riconsegna ? Math.max(1, giorniTra(b.ritiro, b.riconsegna)) : 1;
const giorni = () => numero(b.giorni !== "" ? b.giorni : giorniDefault()) || 0;
const pezzi = () => Object.values(b.items).reduce((s, x) => s + (numero(x.qta) || 0), 0) + b.noleggi.reduce((s, n) => s + (numero(n.qta) || 0), 0);

// Articoli scelti nell'ordine delle categorie, poi del foglio.
function scelti(){
  const out = [];
  for (const cat of L.categorie) for (const a of L.articoli)
    if (a.cat === cat && b.items[a.id]) out.push({a, q: numero(b.items[a.id].qta) || 0});
  return out;
}

/* Totale del noleggio, in centesimi. */
function conto(){
  const g = giorni();
  const alGiorno = scelti().reduce((s, x) => s + (x.a.noleggio || 0) * x.q, 0);
  const sub = alGiorno * g, sc = scontoNoleggio(g), sconto = Math.round(sub * sc / 100);
  const t = totali(sub - sconto);
  const voluto = b.noRound || !(centesimi(b.cifra) > 0) ? t.totale : centesimi(b.cifra);
  return {g, alGiorno, sub, sc, sconto, ...t, voluto, arr: t.totale - voluto, fz: t.servizi > 0 ? fiscozen(voluto) : null};
}

// Una riga per articolo, senza categorie: "4× Nome", oppure "Nome" se è uno solo.
function righeTrello(){
  const r = scelti().map(({a, q}) => `${q > 1 ? q + "× " : ""}${a.nome}`);
  b.noleggi.forEach(n => {
    if (!n.nome.trim()) return;
    const q = numero(n.qta) || 1;
    r.push(`${q > 1 ? q + "× " : ""}${n.nome.trim()} (noleggio${n.fornitore.trim() ? " " + n.fornitore.trim() : ""})`);
  });
  return r;
}

/* ---------- Sezione Attrezzatura ---------- */
export function vistaSezione(){
  const docs = documenti("ATT").slice().sort((x, y) => y.codice.localeCompare(x.codice));
  const dal = stato.impostazioni.listinoDal;
  return `<div class="page">
    <div class="page-head"><div><h1>Attrezzatura</h1><p>Liste per i lavori e i noleggi, inventario completo.</p></div>
      <div class="actions"><button class="btn" data-action="carica-pdf" data-tipo="ATT">Carica PDF</button><button class="btn primary" data-action="lista-nuova">Nuova lista</button></div></div>
    <div class="block" style="margin-bottom:28px"><div><h2 style="margin:0">Listini e inventario</h2><div class="muted">${dal ? "Listino valido dal " + dataLunga(dal) : "Data del listino da impostare in Impostazioni"}.</div></div>
      <div class="actions" style="align-items:center">${selezione(`id="dlKind" style="max-width:290px" aria-label="Cosa scaricare"`,
        [["completo", "Listino completo (servizi e noleggio)"], ["noleggio", "Listino noleggio attrezzatura"], ["inventario", "Lista attrezzatura senza prezzi"]], "completo")}
        <button class="btn" data-action="scarica-listino">Scarica PDF</button></div></div>
    <div class="toolbar"><input class="search" type="search" placeholder="Cerca per cliente, lavoro o codice" data-filter aria-label="Cerca"><span class="muted" style="font-size:14px">${docs.length} ${docs.length === 1 ? "lista" : "liste"}</span></div>
    <div id="docs">${docs.length ? docs.map(d => rigaDocumento(d, {extra: `<button class="btn small" data-action="lista-trello" data-codice="${esc(d.codice)}">Trello</button>`})).join("")
      : `<p class="empty">Nessuna lista. Inizia da “Nuova lista”.</p>`}</div>
  </div>`;
}

// Card "Riprendi" per la Home.
export function cardBozza(){
  if (!haBozza()) return "";
  const st = passi(), i = Math.max(0, st.indexOf(b.step));
  return `<div class="draft-card"><div><strong>Lista attrezzatura in sospeso</strong><div class="muted">${b.titolo ? esc(b.titolo) + ", " : ""}passo ${i + 1} di ${st.length}${b.saved ? ", salvata il " + dataBreve(b.saved.slice(0, 10)) : ""}</div></div><a class="btn primary" href="#attrezzatura-nuova">Riprendi</a></div>`;
}

/* Riapre una lista salvata: tutti i passi sono già visitati. */
registraApritore("ATT", (d, v, dati) => {
  const apri = () => {
    b = Object.assign(BASE(), JSON.parse(JSON.stringify(dati)), {cli: dati.cli ?? d.cliente?.id ?? "", titolo: dati.titolo ?? d.titolo, edit: {codice: d.codice, v, cosa: "della lista"}, step: "tipo", visited: ["tipo", "dati", "articoli", "totale", "riep"]});
    salva();
    if (location.hash === "#attrezzatura-nuova") window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "attrezzatura-nuova";
  };
  if (haBozza()) modal("C’è una lista in sospeso", "<p>Se apri questa lista per modificarla, la bozza in sospeso viene sostituita.</p>", [{label: "Annulla"}, {label: "Sostituisci", primary: true, fn: apri}]);
  else apri();
});

export function nuovaLista(){
  const vai = () => { if (location.hash === "#attrezzatura-nuova") window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "attrezzatura-nuova"; };
  if (haBozza()){
    const st = passi(), i = Math.max(0, st.indexOf(b.step));
    modal("C’è una lista in sospeso", `<p>${b.titolo ? esc(b.titolo) + ", " : ""}ferma al passo ${i + 1} di ${st.length}. Vuoi riprenderla o ricominciare da zero?</p>`,
      [{label: "Ricomincia", fn: () => { b = BASE(); store.del(BKEY); vai(); }}, {label: "Riprendi", primary: true, fn: vai}]);
  } else { b = BASE(); vai(); }
}

/* ---------- Procedura ---------- */
export async function vistaProcedura(view){
  if (!b) b = BASE();
  view.innerHTML = `<div class="page"><p class="loading">Leggo attrezzatura e clienti dai fogli…</p></div>`;
  try { await caricaFogli(); }
  catch(e){
    view.innerHTML = `<div class="page"><div class="page-head"><div><h1>Nuova lista attrezzatura</h1><p>${esc(e.message)}</p></div></div><a class="btn" href="#attrezzatura">Torna ad Attrezzatura</a></div>`;
    gestisciErrore(e, () => vistaProcedura(view));
    return;
  }
  b.date = normalizzaDate(b.date); if (!b.date.length) b.date = BASE().date;
  // Articoli che non esistono più nel foglio: via dalla bozza.
  Object.keys(b.items).forEach(id => { if (!articolo(id)) delete b.items[id]; });
  if (!passi().includes(b.step)) b.step = "articoli";
  const st = passi(), i = st.indexOf(b.step), ultimo = i === st.length - 1;
  view.innerHTML = `<div class="wiz"><div class="wiz-main">
    <a class="wiz-back" href="#attrezzatura">‹ Attrezzatura</a>
    <div class="wiz-title"><h1>${b.edit ? "Modifica lista " + esc(b.edit.codice) : "Nuova lista attrezzatura"}</h1><button class="btn small panel-toggle" data-action="panel">Riepilogo</button></div>
    ${avvisoModifica(b.edit)}
    <ol class="steps" id="asteps">${barraPassi(st, ETICHETTE, b.step, b.visited, "a-goto")}</ol>
    <section id="stepBody">${passoHTML()}</section>
    <div class="err" id="err" role="alert"></div>
    <div class="wiz-foot">
      <button class="btn" data-action="a-prev" ${i === 0 ? "disabled" : ""}>Indietro</button>
      ${ultimo ? `<button class="btn primary" data-action="a-genera">${b.edit ? "Salva nuova versione" : "Genera lista"}</button>` : `<button class="btn primary" data-action="a-next">Avanti</button>`}
    </div>
  </div><aside class="panel" id="panel" aria-label="Riepilogo">${pannello()}</aside></div>`;
  window.scrollTo(0, 0);
}

const A = "data-a";   // attributo dei campi di questa procedura

function riquadroArticoli(){
  const n = Object.keys(b.items).length, p = pezzi();
  if (!n && !b.noleggi.length) return `<p class="muted" style="margin:0 0 16px">Nessun articolo spuntato.</p>`;
  if (b.kind === "noleggio"){
    const t = conto();
    return `<div class="kpi"><div><small>Articoli</small><strong>${n}</strong><span>${p} pezzi in tutto</span></div><div><small>Al giorno</small><strong>${eur(t.alGiorno)}</strong><span>prezzi di noleggio</span></div><div><small>Per ${qta(t.g)} ${t.g === 1 ? "giorno" : "giorni"}</small><strong>${eur(t.sub - t.sconto)}</strong><span>${t.sc ? `sconto ${t.sc}% compreso` : "nessuno sconto"}</span></div></div>`;
  }
  return `<div class="kpi"><div><small>Articoli</small><strong>${n}</strong><span>dal tuo inventario</span></div><div><small>Pezzi in tutto</small><strong>${p}</strong><span>da spuntare sul set</span></div><div><small>Noleggio esterno</small><strong>${b.noleggi.length}</strong><span>${b.noleggi.length === 1 ? "articolo" : "articoli"}</span></div></div>`;
}

function riquadroTotale(){
  const t = conto(), L4 = stato.impostazioni.etichetta4;
  if (!(t.servizi > 0)) return `<p class="muted">Nessun articolo a pagamento.</p>`;
  let fz = "";
  if (t.fz?.ok) fz = `<div class="fzbox"><small>Da inserire su Fiscozen</small><strong>Compenso ${eur(t.fz.compenso)}</strong><span>${esc(L4)} ${eur(t.fz.riv)}${t.fz.bollo ? ", bollo 2,00 €" : ""}: fattura di ${eur(t.voluto)}</span></div>`;
  else if (t.fz) fz = `<div class="note warn">Con ${eur(t.voluto)} la fattura su Fiscozen non torna al centesimo. Scegli una cifra vicina:<div class="actions" style="margin-top:10px">${[t.fz.sotto, t.fz.sopra].filter(x => x).map(x => `<button class="btn small" data-action="a-cifra" data-v="${x}">${eur(x)}</button>`).join("")}</div></div>`;
  return `<dl class="tot big">
    <dt>Subtotale<small>${eur(t.alGiorno)} al giorno × ${qta(t.g)} ${t.g === 1 ? "giorno" : "giorni"}</small></dt><dd>${eur(t.sub)}</dd>
    ${t.sc ? `<dt>Sconto ${t.sc}%</dt><dd>${eurSegno(t.sconto)}</dd>` : ""}
    <dt class="sep">Totale noleggio</dt><dd class="sep">${eur(t.servizi)}</dd>
    <dt>${esc(L4)}</dt><dd>${eur(t.riv)}</dd>
    <dt>Marca da bollo</dt><dd>${t.bollo ? eur(t.bollo) : "Non dovuta"}</dd>
    ${t.arr ? `<dt>Arrotondamento</dt><dd>${eurSegno(t.arr)}</dd>` : ""}
    <dt class="grand">Totale</dt><dd class="grand">${eur(t.voluto)}</dd>
  </dl>${fz}`;
}

function noleggiEsterniHTML(){
  return `<h3 class="grp" style="margin-top:28px">Noleggio esterno</h3><p class="hint" style="margin-bottom:10px">Attrezzatura presa da un rental per questo lavoro. Finisce nella lista e nella copia per Trello.</p>
    ${b.noleggi.map((n, i) => `<div class="voce on"><div class="vbody" style="margin:0;padding:0;border:0">
      <label class="vnote" style="flex-basis:auto;flex:1 1 260px"><span>Articolo</span><input class="inp" data-an="${i}" data-k="nome" value="${esc(n.nome)}" placeholder="Es. Teleprompter"></label>
      <label class="w-s"><span>Fornitore</span><input class="inp" data-an="${i}" data-k="fornitore" value="${esc(n.fornitore)}" placeholder="Es. Rental X"></label>
      <label class="w-n"><span>Quantità</span><input class="inp" inputmode="numeric" data-an="${i}" data-k="qta" value="${esc(n.qta)}"></label>
      <div class="vmodo"><div class="seg" role="radiogroup" aria-label="Chi paga">${[["io", "Pago io"], ["cliente", "Paga il cliente"]].map(([k, l]) => `<label><input type="radio" name="an-${i}" value="${k}" data-an="${i}" data-k="paga" ${n.paga === k ? "checked" : ""}>${l}</label>`).join("")}</div>
        <button class="btn small" data-action="a-noldel" data-i="${i}">Togli</button></div>
    </div></div>`).join("")}
    <button class="btn small" data-action="a-noladd">Aggiungi noleggio</button>`;
}

function passoHTML(){
  const nol = b.kind === "noleggio", c = cliente();
  const opzClienti = C.clienti.map(x => [x.id, `${x.nome} (${x.id})`]);
  switch (b.step){
    case "tipo": return `<h2 class="field-q">Che lista ti serve?</h2><p class="hint">La lista per un lavoro è per te; quella per un noleggio va a chi noleggia, con prezzi e totale.</p>
      ${opzione(A, "kind", "lavoro", b.kind, "Per un lavoro", "Checklist da portare sul set, con caselle da spuntare")}
      ${opzione(A, "kind", "noleggio", b.kind, "Noleggio a terzi", "Attrezzatura data in noleggio, con prezzi, sconti e totale")}
      ${!nol && documenti("PRV").length ? `<h3 class="grp">Partire da un preventivo</h3>
        <label class="f"><span>Preventivo (facoltativo)</span>${selezione(`${A}="fromPrv" style="max-width:420px"`, [["", "Nessuno, parto da zero"], ...documenti("PRV").slice().sort((x, y) => y.codice.localeCompare(x.codice)).map(d => [d.codice, `${d.codice} · ${d.titolo} · ${d.cliente?.nome || ""}`])], b.fromPrv)}
        <div class="cnt">Riprende cliente, titolo, date, luogo, articoli e noleggi esterni. La lista prende lo stesso codice del preventivo, e resta modificabile.</div></label>` : ""}`;

    case "dati": return nol
      ? `<h2 class="field-q">Chi noleggia e quando</h2><p class="hint">I giorni si calcolano dalle date, contando 24 ore per giorno; puoi cambiarli.</p>
        <label class="f"><span>Chi noleggia</span>${selezione(`${A}="cli" style="max-width:420px"`, [["", "Scegli dal foglio Clienti"], ...opzClienti], b.cli)}</label>
        <label class="f"><span>Titolo</span><input class="inp" ${A}="titolo" value="${esc(b.titolo)}" placeholder="Noleggio attrezzatura"></label>
        <div class="row2"><label class="f"><span>Ritiro</span><input class="inp" type="date" ${A}="ritiro" value="${esc(b.ritiro)}" style="max-width:200px"></label>
          <label class="f"><span>Riconsegna</span><input class="inp" type="date" ${A}="riconsegna" value="${esc(b.riconsegna)}" style="max-width:200px"></label>
          <label class="f"><span>Giorni</span><input class="inp num" type="number" min="1" ${A}="giorni" value="${esc(b.giorni !== "" ? b.giorni : String(giorniDefault()))}"></label></div>
        <div class="cnt" id="scHint"></div>`
      : `<h2 class="field-q">Il lavoro</h2><p class="hint">${b.fromPrv ? `Dati ripresi dal preventivo ${esc(b.fromPrv)}: controllali.` : "Cliente, date e luogo sono facoltativi."}</p>
        <label class="f"><span>Titolo del lavoro</span><input class="inp" ${A}="titolo" value="${esc(b.titolo)}" placeholder="Es. Convention di fine anno"></label>
        <label class="f"><span>Cliente</span>${selezione(`${A}="cli" style="max-width:420px"`, [["", "Lavoro personale"], ...opzClienti], b.cli)}</label>
        ${campoDate("a", b.date, "Date di ripresa")}
        <label class="f"><span>Luogo</span><input class="inp" ${A}="luogo" value="${esc(b.luogo)}" placeholder="Es. Torino"></label>
        <label class="f"><span>Note (facoltative)</span><textarea class="inp" ${A}="note" placeholder="Es. Ricaricare le batterie V-mount la sera prima">${esc(b.note)}</textarea></label>`;

    case "articoli": {
      const lista = disponibili(), f = b.filter.toLowerCase();
      return `<h2 class="field-q">${nol ? "Cosa noleggi" : "Cosa porti"}</h2><p class="hint">${nol ? "Solo gli articoli noleggiabili. Quelli a prezzo 0 risultano inclusi." : "Spunta gli articoli e indica quanti pezzi. Il massimo è quello che hai in inventario."}</p>
        <div id="aSum">${riquadroArticoli()}</div>
        <input class="search" type="search" placeholder="Cerca un articolo" data-afilter value="${esc(b.filter)}" aria-label="Cerca un articolo" style="margin-bottom:8px">
        <div class="inv">${L.categorie.map(cat => {
          const its = lista.filter(a => a.cat === cat);
          if (!its.length) return "";
          return `<h3 class="grp" data-acat="${esc(cat)}">${esc(cat)}</h3>${its.map(a => {
            const x = b.items[a.id], nascondi = f && !(a.nome + " " + a.id).toLowerCase().includes(f);
            return `<div class="inv-row att-row" data-aname="${esc((a.nome + " " + a.id).toLowerCase())}" data-acat2="${esc(cat)}" ${nascondi ? "hidden" : ""}>
              <input type="checkbox" id="ai-${esc(a.id)}" data-aitem="${esc(a.id)}" data-k="on" ${x ? "checked" : ""}>
              <label for="ai-${esc(a.id)}">${esc(a.nome)} <small class="muted">${esc(a.id)}</small></label>
              <span class="muted">${nol ? (a.noleggio > 0 ? eur(a.noleggio) : "incluso") : ""}</span>
              <span class="muted av">su ${a.q}</span>
              ${x ? `<input class="inp" inputmode="numeric" data-aitem="${esc(a.id)}" data-k="qta" value="${esc(x.qta)}" aria-label="Quantità ${esc(a.nome)}">` : "<span></span>"}
            </div>`;
          }).join("")}`;
        }).join("")}</div>
        ${nol ? "" : noleggiEsterniHTML()}`;
    }

    case "totale": return `<h2 class="field-q">Totale del noleggio</h2><p class="hint">Sconto automatico: da 4 a 5 giorni 15%, da 6 a 10 giorni 20%, oltre 10 giorni 25%. La rivalsa del 4% si applica sempre.</p>
      ${interruttore(A, "noRound", b.noRound, "Nessun arrotondamento", "Il totale resta quello calcolato")}
      ${b.noRound ? "" : `<label class="f"><span>Cifra finale desiderata (€)</span><input class="inp num" inputmode="decimal" ${A}="cifra" value="${esc(b.cifra)}" placeholder="0,00"></label>`}
      <div id="aTotBox">${riquadroTotale()}</div>`;

    case "riep": {
      const codice = b.edit?.codice || b.fromPrv || codiceProvvisorio(), esiste = (b.edit || b.fromPrv) && trova(codice, "ATT");
      const v = esiste ? ultimaVersione(esiste) + 1 : 1;
      const nome = nomeFile({codice, tipo: "ATT", titolo: titolo(), cliente: c?.nome, versione: v});
      const righe = righeTrello();
      return `<h2 class="field-q">Controlla e genera</h2><p class="hint">${nol ? "Il PDF va a chi noleggia." : "Il PDF è per te, con le caselle da spuntare; per Trello usa la copia qui sotto."}</p>
        ${riepilogo()}
        <div class="trello"><div class="trello-head"><div><strong>Copia per Trello</strong><div class="cnt" style="margin:2px 0 0">Un articolo per riga, senza categorie. In Trello incollala nel campo di una checklist.</div></div><button class="btn small" data-action="a-trello">Copia ${righe.length} righe</button></div>
          <pre id="trelloTxt">${esc(righe.join("\n"))}</pre></div>
        <div class="out">
          <p><strong>Cartella</strong><br>${esc(stato.impostazioni.file.archivioListe?.name || "Archivio liste attrezzatura")} / ${esc(nomeCartellaCliente(c))}</p>
          <p><strong>File</strong><br><span class="fname">${esc(nome)}</span> <span class="muted">(Google Doc)</span><br><span class="fname">${esc(nome)}.pdf</span></p>
          <p class="muted">${b.edit ? `Nuova versione della lista ${esc(b.edit.codice)}: le precedenti restano in archivio.` : b.fromPrv ? `Stesso codice del preventivo ${esc(b.fromPrv)}${esiste ? `: la lista esiste già e diventa la V${String(v).padStart(2, "0")}` : ""}.` : "Il codice definitivo si assegna alla generazione: è il primo libero dell’anno."}</p>
        </div>`;
    }
  }
  return "";
}

const titolo = () => b.titolo.trim() || (b.kind === "noleggio" ? "Noleggio attrezzatura" : "");
function codiceProvvisorio(){
  const a = new Date().getFullYear();
  const n = documenti().filter(d => d.codice.startsWith(a + "-")).map(d => parseInt(d.codice.slice(5), 10) || 0);
  return `${a}-${String(Math.max(0, ...n) + 1).padStart(3, "0")}`;
}

function riepilogo(){
  const c = cliente(), trattino = `<span class="muted">–</span>`, date = elencoDate(b.date);
  return `<dl class="sum">
    <dt>Tipo</dt><dd>${b.kind === "noleggio" ? "Noleggio a terzi" : "Lavoro"}${b.fromPrv ? `, dal preventivo ${esc(b.fromPrv)}` : ""}</dd>
    <dt>${b.kind === "noleggio" ? "Noleggia" : "Cliente"}</dt><dd>${c ? esc(c.nome) : (b.kind === "noleggio" ? trattino : "Lavoro personale")}</dd>
    <dt>Titolo</dt><dd>${titolo() ? esc(titolo()) : trattino}</dd>
    ${b.kind === "noleggio" ? `<dt>Periodo</dt><dd>${b.ritiro && b.riconsegna ? `${dataBreve(b.ritiro)} → ${dataBreve(b.riconsegna)}, ${qta(giorni())} gg` : trattino}</dd>`
      : `<dt>Riprese</dt><dd>${date ? esc(date) : "Da definire"}${b.luogo ? ", " + esc(b.luogo) : ""}</dd>`}
    <dt>Articoli</dt><dd>${Object.keys(b.items).length} (${pezzi()} pezzi)${b.noleggi.length ? `, ${b.noleggi.length} a noleggio` : ""}</dd>
    ${b.kind === "noleggio" ? `<dt>Totale</dt><dd>${conto().servizi > 0 ? eur(conto().voluto) : trattino}</dd>` : ""}
  </dl>`;
}
const pannello = () => `<button class="btn small panel-close" data-action="panel">Chiudi</button><h3>Riepilogo</h3>${riepilogo()}${salvata(b.saved)}`;

function valida(id){
  if (id === "dati"){
    if (b.kind === "noleggio"){
      if (!b.cli) return "Scegli chi noleggia.";
      if (!b.ritiro || !b.riconsegna) return "Indica le date di ritiro e di riconsegna.";
      if (giorniTra(b.ritiro, b.riconsegna) < 0) return "La riconsegna non può essere prima del ritiro.";
      if (!(giorni() > 0)) return "Indica i giorni di noleggio.";
    } else if (!b.titolo.trim()) return "Scrivi il titolo del lavoro.";
    else if (erroreDate(b.date)) return erroreDate(b.date);
  }
  if (id === "articoli"){
    if (!Object.keys(b.items).length && !b.noleggi.length) return "Spunta almeno un articolo.";
    for (const [id, x] of Object.entries(b.items)){
      const a = articolo(id), q = numero(x.qta);
      if (!(q > 0) || !Number.isInteger(q)) return `${a.nome}: indica la quantità.`;
      if (q > a.q) return `${a.nome}: in inventario ne hai ${a.q}.`;
    }
    if (b.noleggi.some(n => !n.nome.trim())) return "Noleggio esterno: scrivi il nome dell’articolo, oppure toglilo.";
    if (b.noleggi.some(n => !(numero(n.qta) > 0))) return "Noleggio esterno: indica la quantità.";
  }
  if (id === "totale" && !b.noRound && !(centesimi(b.cifra) > 0)) return "Scrivi la cifra finale, oppure attiva “Nessun arrotondamento”.";
  return "";
}

/* ---------- Aggiornamenti dal vivo ---------- */
function dalVivo(){
  const s = $("#aSum"); if (s) s.innerHTML = riquadroArticoli();
  const t = $("#aTotBox"); if (t) t.innerHTML = riquadroTotale();
  const sc = $("#scHint"); if (sc){ const g = giorni(), p = scontoNoleggio(g); sc.textContent = `${qta(g)} ${g === 1 ? "giorno" : "giorni"}: ${p ? `sconto del ${p}%` : "nessuno sconto"}.`; }
  const tr = $("#trelloTxt"); if (tr) tr.textContent = righeTrello().join("\n");
  const p = $("#panel"); if (p) p.innerHTML = pannello();
}
function ridisegna(fuoco){
  $("#asteps").innerHTML = barraPassi(passi(), ETICHETTE, b.step, b.visited, "a-goto");
  $("#stepBody").innerHTML = passoHTML();
  dalVivo();
  if (fuoco){ const el = document.querySelector(fuoco); if (el) el.focus({preventScroll: true}); }
}
const vaiAlPasso = id => { b.step = id; if (!b.visited.includes(id)) b.visited.push(id); salva(); vistaProcedura($("#view")); };

const RIDISEGNA = ["kind", "fromPrv", "cli", "noRound", "ritiro", "riconsegna"];

// Riprende cliente, titolo, date, luogo, articoli e noleggi esterni da un preventivo in archivio.
async function daPreventivo(codice){
  try {
    const d = trova(codice, "PRV"), p = await datiVersione(d);
    Object.assign(b, {fromPrv: codice, cli: d.cliente?.id || "", titolo: d.titolo, date: normalizzaDate(p.date).length ? normalizzaDate(p.date) : BASE().date, luogo: p.luogo || ""});
    b.items = {};
    if (p.attMode === "lista") Object.entries(p.items || {}).forEach(([id, x]) => { if (articolo(id)) b.items[id] = {qta: x.qta}; });
    b.noleggi = (p.noleggi || []).map(n => ({nome: n.desc || "", fornitore: "", qta: "1", paga: n.paga === "cliente" ? "cliente" : "io"}));
    salva(); ridisegna(`[${A}="fromPrv"]`);
    const n = Object.keys(b.items).length;
    toast(n ? `Ripresi ${n} articoli dal preventivo ${codice}` : `Il preventivo ${codice} non ha una lista: ripresi cliente, titolo, date e luogo`);
  } catch(e){ gestisciErrore(e, () => daPreventivo(codice)); }
}
function campo(el){
  if (!b || !L) return;
  let rr = false, fuoco = null;
  if (el.dataset.aitem !== undefined){
    const id = el.dataset.aitem;
    if (el.dataset.k === "on"){ if (el.checked) b.items[id] = {qta: "1"}; else delete b.items[id]; rr = true; fuoco = `[data-aitem="${CSS.escape(id)}"][data-k="on"]`; }
    else if (b.items[id]) b.items[id].qta = el.value;
  } else if (el.dataset.an !== undefined){
    const n = b.noleggi[+el.dataset.an]; if (!n) return;
    n[el.dataset.k] = el.value;
  } else if (el.dataset.dt === "a") b.date[+el.dataset.i][el.dataset.k] = el.value;
  else {
    const f = el.getAttribute(A);
    b[f] = el.hasAttribute("data-bool") ? el.checked : el.value;
    if (f === "kind" && el.value === "noleggio"){ b.fromPrv = ""; Object.keys(b.items).forEach(id => { if (!articolo(id).noleggiabile) delete b.items[id]; }); }
    if (f === "fromPrv" && el.value){ salva(); daPreventivo(el.value); return; }
    if (f === "ritiro" || f === "riconsegna") b.giorni = "";
    if (RIDISEGNA.includes(f)){ rr = true; fuoco = el.type === "radio" ? `[${A}="${f}"][value="${el.value}"]` : `[${A}="${f}"]`; }
  }
  salva();
  const e = $("#err"); if (e) e.textContent = "";
  if (rr) ridisegna(fuoco); else dalVivo();
}

function filtroArticoli(q){
  b.filter = q; const f = q.toLowerCase().trim();
  document.querySelectorAll("[data-aname]").forEach(r => { r.hidden = !!f && !r.dataset.aname.includes(f); });
  document.querySelectorAll("[data-acat]").forEach(h => { h.hidden = ![...document.querySelectorAll(`[data-acat2="${CSS.escape(h.dataset.acat)}"]`)].some(r => !r.hidden); });
}

/* ---------- Generazione della lista ---------- */
function datiTemplate(codice){
  const c = cliente(), nol = b.kind === "noleggio";
  const gruppi = L.categorie.map(cat => ({cat, el: scelti().filter(x => x.a.cat === cat)})).filter(g => g.el.length);
  const comuni = {NUMERO: codice, DATA: dataLunga(oggi()), TITOLO: titolo(), ETICHETTA_4: stato.impostazioni.etichetta4, ...righeCliente(c)};
  if (!nol){
    const info = [elencoDate(b.date), b.luogo.trim()].filter(Boolean).join(" · ");
    return {...comuni, CLIENTE_NOME: c ? c.nome : "Lavoro personale", INFO_LAVORO: info,
      CAT: gruppi.map(g => ({NOME: g.cat, CONTEGGIO: String(g.el.reduce((s, x) => s + x.q, 0)), ART: g.el.map(x => ({QTA: String(x.q), NOME: x.a.nome}))})),
      NOLEGGI: b.noleggi.length > 0,
      NOL: b.noleggi.map(n => ({QTA: String(numero(n.qta) || 1), NOME: n.nome.trim(), FORNITORE: n.fornitore.trim(), CHI_PAGA: n.paga === "cliente" ? "Paga il cliente" : "Pago io"})),
      NOTE_LISTA: b.note.trim(), N_ARTICOLI: String(pezzi())};
  }
  const t = conto();
  return {...comuni, RITIRO: dataLunga(b.ritiro), RICONSEGNA: dataLunga(b.riconsegna), GIORNI: qta(t.g),
    CAT: gruppi.map(g => ({NOME: g.cat, ART: g.el.map(x => ({QTA: String(x.q), NOME: x.a.nome,
      PREZZO: x.a.noleggio > 0 ? eur(x.a.noleggio) : "incluso", IMPORTO: x.a.noleggio > 0 ? eur(x.a.noleggio * x.q * t.g) : ""}))})),
    SUBTOTALE: eur(t.sub), SCONTO_PERC: t.sc + "%", SCONTO: t.sc ? eurSegno(t.sconto) : "",
    RIVALSA: eur(t.riv), BOLLO: t.bollo ? eur(t.bollo) : "", ARROTONDAMENTO: t.arr ? eurSegno(t.arr) : "",
    TOTALE: eur(t.voluto), CONDIZIONI_NOLEGGIO: ""};
}

async function genera(){
  for (const id of passi()){
    const m = valida(id);
    if (m){ b.step = id; if (!b.visited.includes(id)) b.visited.push(id); salva(); await vistaProcedura($("#view")); $("#err").textContent = m; return; }
  }
  const f = stato.impostazioni.file, nol = b.kind === "noleggio";
  const tpl = nol ? f.tplAttNoleggio : f.tplAttLavoro;
  try {
    if (!f.archivioListe) throw new CollegamentoMancante("Archivio liste attrezzatura");
    if (!tpl) throw new CollegamentoMancante(nol ? "Template ATT — Noleggio a terzi" : "Template ATT — Lista attrezzatura lavoro");
    const passo = avanzamento("Genero la lista");
    passo("Assegno il codice");
    const codice = b.edit?.codice || b.fromPrv || await prossimoCodice(), c = cliente();
    const v = b.edit || b.fromPrv ? await prossimaVersione(codice, "ATT") : 1;
    passo("Preparo la cartella del cliente");
    const cartella = await cartellaCliente(f.archivioListe.id, c);
    const nome = nomeFile({codice, tipo: "ATT", titolo: titolo(), cliente: c?.nome, versione: v});
    const r = await generaDocumento({template: tpl.id, cartella: cartella.id, nome, dati: datiTemplate(codice)}, passo);
    passo("Aggiorno il registro");
    const t = nol ? conto() : null;
    const dati = JSON.parse(JSON.stringify(b));
    ["step", "visited", "filter", "saved", "edit"].forEach(k => delete dati[k]);
    Object.assign(dati, {titolo: titolo(), trello: righeTrello(), articoli: scelti().map(({a, q}) => ({id: a.id, nome: a.nome, cat: a.cat, q, prezzo: a.noleggio})),
      totali: t && {servizi: t.servizi, riv: t.riv, bollo: t.bollo, totale: t.totale, voluto: t.voluto, compenso: t.fz?.ok ? t.fz.compenso : null}});
    await registra({codice, tipo: "ATT", cliente: c, titolo: titolo(), v, nome, doc: r.doc.id, pdf: r.pdf.id, dati});
    const trello = !nol && righeTrello();
    b = null; store.del(BKEY);
    location.hash = "attrezzatura";
    modal(`Lista ${codice}${v > 1 ? ` V${String(v).padStart(2, "0")}` : ""} generata`,
      `<p class="fname">${esc(nome)}</p>${r.rimasti.length ? `<div class="note warn">Nel documento sono rimasti questi segnaposto: ${esc(r.rimasti.join(", "))}. Controlla il template.</div>` : ""}
       <div class="actions" style="justify-content:flex-start;margin-top:12px"><a class="btn" href="${linkDoc(r.doc.id)}" target="_blank" rel="noopener">Apri il Doc</a>
       <button class="btn" data-action="scarica-pdf" data-id="${esc(r.pdf.id)}" data-nome="${esc(nome)}">Scarica il PDF</button>
       ${trello ? `<button class="btn" data-action="copia-testo" data-testo="${esc(trello.join("\n"))}">Copia per Trello</button>` : ""}</div>`,
      [{label: "Fatto", primary: true}]);
  } catch(e){
    closeModal();
    gestisciErrore(e, genera);
  }
}

/* ---------- Listini e inventario ---------- */
async function scaricaListino(tipo){
  const f = stato.impostazioni.file, dal = stato.impostazioni.listinoDal;
  try {
    const inv = tipo === "inventario";
    const tpl = inv ? f.tplInv : f.tplLis;
    if (!tpl) throw new CollegamentoMancante(inv ? "Template INV — Lista attrezzatura completa" : "Template LIS — Listino prezzi");
    if (!inv && !dal){ modal("Manca la data del listino", "<p>Imposta “Listino valido dal” in Impostazioni: compare in testa al listino.</p>", [{label: "Chiudi"}, {label: "Vai alle Impostazioni", primary: true, fn: () => { location.hash = "impostazioni"; }}]); return; }
    const passo = avanzamento(inv ? "Genero la lista completa" : "Genero il listino");
    passo("Leggo il foglio Attrezzatura");
    ricarica();
    const l = await listino();
    const dati = inv ? datiInventario(l) : datiListino(l, tipo === "completo", dal);
    const nome = inv ? `Inventario_FilippoMauro_${oggi()}` : `${tipo === "completo" ? "Listino" : "ListinoNoleggio"}_FilippoMauro_${dal}`;
    passo("Preparo la cartella");
    const cart = (await cercaPerNome("Listini e inventario", {parent: stato.cartella, mime: MIME_CARTELLA}))[0] || await creaCartella("Listini e inventario", stato.cartella);
    // Lo stesso listino rigenerato sostituisce il precedente (che va nel cestino).
    for (const vecchio of [...await cercaPerNome(nome, {parent: cart.id}), ...await cercaPerNome(nome + ".pdf", {parent: cart.id})]) await cestina(vecchio.id);
    const r = await generaDocumento({template: tpl.id, cartella: cart.id, nome, dati}, passo);
    passo("Scarico il PDF");
    await scaricaPdf(r.pdf.id, nome);
    closeModal();
    toast(r.rimasti.length ? `Scaricato, ma restano segnaposto: ${r.rimasti.join(", ")}` : "PDF scaricato. Una copia resta in “Listini e inventario”.");
  } catch(e){ closeModal(); gestisciErrore(e, () => scaricaListino(tipo)); }
}

function datiListino(l, completo, dal){
  const prezzoO = c => c === null ? "—" : eur(c);
  const fasi = l.categorieServizi.map(cat => ({NOME: cat, SERV: l.servizi.filter(s => s.attivo && s.nelListino && s.cat === cat).map(s => {
    const nessuno = s.giornata === null && s.mezza === null && s.ora === null;
    return {NOME: s.nome, DESCRIZIONE: s.descrizione || "", GIORNATA: nessuno ? "su preventivo" : prezzoO(s.giornata), MEZZA: prezzoO(s.mezza), ORA: prezzoO(s.ora)};
  })})).filter(f => f.SERV.length);
  const kit = l.kit.filter(k => k.attivo).map(k => ({NOME: k.nome, DESCRIZIONE: k.descrizione || "", GIORNATA: prezzoO(k.prezzo), MEZZA: prezzoO(k.prezzoMezza)}));
  const cat = l.categorie.map(c => ({NOME: c, ART: l.articoli.filter(a => a.attivo && a.noleggiabile && a.cat === c)
    .map(a => ({NOME: a.nome, PREZZO: a.noleggio > 0 ? eur(a.noleggio) : "incluso"}))})).filter(c => c.ART.length);
  return {DATA_LISTINO: dataLunga(dal), SERVIZI: completo, NOLEGGIO: true, FASE: fasi, KIT: kit, CAT: cat};
}

function datiInventario(l){
  const cat = l.categorie.map(c => {
    const art = l.articoli.filter(a => a.attivo && a.cat === c);
    return {NOME: c, CONTEGGIO: String(art.reduce((s, a) => s + a.q, 0)), ART: art.map(a => ({QTA: String(a.q), NOME: a.nome}))};
  }).filter(c => c.ART.length);
  return {DATA: dataLunga(oggi()), CAT: cat, N_ARTICOLI: String(cat.reduce((s, c) => s + Number(c.CONTEGGIO), 0))};
}

/* ---------- Eventi ---------- */
export function click(act, el){
  if (act === "lista-nuova"){ nuovaLista(); return true; }
  if (act === "scarica-listino"){ scaricaListino($("#dlKind").value); return true; }
  if (act === "lista-trello"){
    const d = trova(el.dataset.codice, "ATT");
    datiVersione(d).then(dati => copia((dati?.trello || []).join("\n")).then(() => toast(`Copiate ${dati.trello.length} righe: in Trello incollale in una checklist`)))
      .catch(e => gestisciErrore(e));
    return true;
  }
  if (act.startsWith("dt-") && el.dataset.dt === "a" && b){ const f = azioneDate(act, el, b.date); salva(); ridisegna(f); return true; }
  if (!act.startsWith("a-") || !b) return false;
  const st = passi(), i = st.indexOf(b.step);
  if (act === "a-goto"){ const id = el.dataset.id; if (b.visited.includes(id) || id === b.step) vaiAlPasso(id); }
  else if (act === "a-prev"){ if (i > 0) vaiAlPasso(st[i - 1]); }
  else if (act === "a-next"){ const m = valida(b.step); if (m) $("#err").textContent = m; else vaiAlPasso(st[i + 1]); }
  else if (act === "a-noladd"){ b.noleggi.push({nome: "", fornitore: "", qta: "1", paga: "io"}); salva(); ridisegna(`[data-an="${b.noleggi.length - 1}"][data-k="nome"]`); }
  else if (act === "a-noldel"){ b.noleggi.splice(+el.dataset.i, 1); salva(); ridisegna(); }
  else if (act === "a-cifra"){ b.cifra = cifraCampo(+el.dataset.v); b.noRound = false; salva(); ridisegna(`[${A}="cifra"]`); }
  else if (act === "a-trello"){ const r = righeTrello(); copia(r.join("\n")).then(() => toast(`Copiate ${r.length} righe: in Trello incollale in una checklist`), () => toast("Copia non riuscita: seleziona il testo a mano")); }
  else if (act === "a-genera") genera();
  else return false;
  return true;
}

const testuale = el => el.tagName !== "SELECT" && el.type !== "radio" && el.type !== "checkbox";
const deiCampi = el => el.matches(`[${A}],[data-aitem],[data-dt="a"],[data-an]`);
export function input(el){
  if (el.matches("[data-afilter]")){ filtroArticoli(el.value); return true; }
  if (el.matches("[data-filter]")){ filtra(el.value); return true; }
  if (deiCampi(el) && testuale(el)){ campo(el); return true; }
  return false;
}
export function change(el){
  if (deiCampi(el) && !testuale(el)){ campo(el); return true; }
  return false;
}
