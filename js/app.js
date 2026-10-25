/* ---------- Gestionale Filippo Mauro: guscio dell'app ---------- */

import { $, esc, store, toast, modal } from "./util.js";
import { gestisciErrore, impostaGanci } from "./errori.js";
import * as liste from "./liste.js";
import * as preventivi from "./preventivi.js";
import * as contratti from "./contratti.js";
import * as cortesia from "./cortesia.js";
import { documenti, ultima, trova } from "./registro.js";
import { apriModifica, caricaPdf } from "./riapertura.js";
import { rigaDocumento, scaricaPdf } from "./elenco.js";
import { copia } from "./procedura.js";
import { preparaAccesso, preparaPicker, accedi, esci, haToken, scegli, SessioneScaduta } from "./google.js";
import { info, cerca, cercaPerNome, creaCartella, cestina, MIME_CARTELLA } from "./drive.js";
import { cartellaCliente, generaDocumento } from "./genera.js";
import { nomeFile } from "./nomi.js";
import { PROVE } from "./esempi.js";
import { leggiFoglio, SCHEMI } from "./fogli.js";
import { stato, caricaDati, salvaImpostazioni, salvaImpostazioniDopo, COLLEGAMENTI, TUTTI_COLLEGAMENTI, NOME_CARTELLA, collegati } from "./dati.js";

/* ---------- Icone e navigazione ---------- */
const ICONS = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  attrezzatura:'<rect x="3" y="7" width="13" height="11" rx="1.5"/><path d="M16 11l5-3v9l-5-3"/>',
  preventivi:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  contratti:'<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 17l2 1.5 4-3.5"/>',
  cortesia:'<path d="M5 3h14v18l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5L5 21z"/><path d="M9 8h6M9 12h6"/>',
  impostazioni:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
const NAV = [["home","Home"],["attrezzatura","Attrezzatura"],["preventivi","Preventivi"],["contratti","Contratti"],["cortesia","Copie di cortesia"]];
const TAB_LABEL = {cortesia:"Cortesia"};
$("#sideNav").innerHTML = NAV.map(([k,l]) => `<a href="#${k}" data-nav="${k}">${icon(k)}${l}</a>`).join("");
$("#sideNav2").innerHTML = `<a href="#impostazioni" data-nav="impostazioni">${icon("impostazioni")}Impostazioni</a>`;
$("#tabbar").innerHTML = NAV.map(([k,l]) => `<a href="#${k}" data-nav="${k}">${icon(k)}${TAB_LABEL[k]||l}</a>`).join("");
$("#topSet").innerHTML = icon("impostazioni");
$("#topSet").dataset.nav = "impostazioni";

/* ---------- Tema ---------- */
function applyTheme(){
  const t = stato.impostazioni?.tema || store.get("fm-tema", "auto");
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}
applyTheme();

/* ---------- Accesso ---------- */
function mostraLogin(msg = ""){
  $("#app").hidden = true; $("#tabbar").hidden = true;
  $("#login").hidden = false;
  $("#loginErr").textContent = msg;
}

$("#btnAccedi").addEventListener("click", async () => {
  $("#loginErr").textContent = "";
  try { await accedi(); avvia(); }
  catch(e){ $("#loginErr").textContent = e.message; }
});

impostaGanci({dopoAccesso: () => route(), uscita: () => mostraLogin()});

async function avvia(){
  $("#login").hidden = true;
  $("#app").hidden = false; $("#tabbar").hidden = false;
  $("#view").innerHTML = `<div class="page"><p class="loading">Apro i dati su Drive…</p></div>`;
  try {
    const {primoAvvio} = await caricaDati();
    applyTheme();
    preparaPicker();
    route();
    if (primoAvvio) modal("Benvenuto",
      `<p>Ho creato su Drive la cartella <strong>${esc(NOME_CARTELLA)}</strong>, dove l’app tiene impostazioni e registro dei documenti.</p>
       <p>L’app vede solo i file che scegli in Impostazioni e quelli che crea lei. Per questo le sottocartelle dei clienti negli archivi le crea l’app: se ne hai già fatte a mano con lo stesso nome, l’app ne crea comunque di sue e quelle vecchie restano dove sono.</p>`,
      [{label:"Vai alle Impostazioni", primary:true, fn: () => { location.hash = "impostazioni"; }}]);
  } catch(e){
    if (e instanceof SessioneScaduta) mostraLogin("Accedi di nuovo per continuare.");
    else $("#view").innerHTML = `<div class="page"><div class="page-head"><div><h1>Qualcosa non va</h1><p>${esc(e.message)}</p></div></div><button class="btn primary" data-action="riprova-avvio">Riprova</button></div>`;
  }
}

/* ---------- Viste ---------- */
function home(){
  const n = collegati(), tot = TUTTI_COLLEGAMENTI.length;
  const recenti = documenti().slice().sort((x, y) => ultima(y).data.localeCompare(ultima(x).data) || y.codice.localeCompare(x.codice)).slice(0, 5);
  const card = [preventivi.cardBozza(), contratti.cardBozza(), liste.cardBozza()].filter(Boolean);
  if (n < tot) card.unshift(`<div class="draft-card"><div><strong>Collegamenti da completare</strong><div class="muted">${n} di ${tot} file e cartelle scelti in Impostazioni.</div></div><a class="btn primary" href="#impostazioni">Impostazioni</a></div>`);
  return `<div class="page">
    <div class="page-head"><div><h1>Buongiorno, Filippo</h1><p>Cosa prepari oggi?</p></div></div>
    ${card.length ? `<div class="drafts">${card.join("")}</div>` : ""}
    <div class="quick">
      <button class="tile" data-action="lista-nuova"><strong>Lista attrezzatura</strong><span>Per un lavoro o un noleggio</span></button>
      <button class="tile" data-action="prv-nuovo"><strong>Preventivo</strong><span>Servizi, kit attrezzatura, totali</span></button>
      <button class="tile" data-action="ctr-nuovo"><strong>Contratto</strong><span>Procedura guidata completa</span></button>
      <button class="tile" data-action="cdc-carica"><strong>Copia di cortesia</strong><span>Dal PDF di Fiscozen</span></button>
    </div>
    <h2 class="section-gap">Ultimi documenti</h2>
    <div>${recenti.length ? recenti.map(d => rigaDocumento(d, {conSezione: true})).join("") : `<p class="empty">Ancora nessun documento.</p>`}</div>
  </div>`;
}

/* ---------- Impostazioni ---------- */
// Esito dei controlli sui collegamenti, una volta per sessione: k → {stato, testo, problemi}
const verifiche = {};

async function verifica(c){
  const f = stato.impostazioni.file[c.k];
  if (!f) return;
  verifiche[c.k] = {stato:"corso"};
  try {
    if (c.tipo === "foglio"){
      const r = await leggiFoglio(f.id, c.k);
      if (r.titolo !== f.name){ f.name = r.titolo; salvaImpostazioni().catch(gestisciErrore); }
      const conti = Object.keys(SCHEMI[c.k]).filter(n => r.schede[n]).map(n => `${n} ${r.schede[n].length}`);
      verifiche[c.k] = r.problemi.length
        ? {stato:"errore", problemi: r.problemi}
        : {stato:"ok", testo: "Intestazioni a posto · righe: " + conti.join(", ")};
    } else {
      const m = await info(f.id);
      if (m.trashed) verifiche[c.k] = {stato:"errore", problemi:["È nel cestino di Drive. Sceglilo di nuovo."]};
      else { if (m.name !== f.name){ f.name = m.name; salvaImpostazioni().catch(gestisciErrore); } verifiche[c.k] = {stato:"ok"}; }
    }
  } catch(e){
    if (e instanceof SessioneScaduta){ delete verifiche[c.k]; gestisciErrore(e); return; }
    verifiche[c.k] = {stato:"errore", problemi:[e.status === 404 ? "Non raggiungibile: forse è stato eliminato o spostato. Sceglilo di nuovo." : e.message]};
  }
  aggiornaRiga(c);
}

function rigaHTML(c){
  const f = stato.impostazioni.file[c.k], v = verifiche[c.k];
  let st = `<span class="st-todo">Da scegliere</span>`, det = c.det ? `<span class="nome">${c.det}</span>` : "";
  if (f){
    det = `<span class="nome">${esc(f.name)}</span>`;
    if (!v || v.stato === "corso") st = `<span class="st-todo">Controllo…</span>`;
    else if (v.stato === "ok"){ st = `<span class="st-ok">Collegato</span>`; if (v.testo) det += `<span class="ok-det">${esc(v.testo)}</span>`; }
    else { st = `<span class="st-err">Da sistemare</span>`; det += `<ul class="probl">${v.problemi.map(p => `<li>${esc(p)}</li>`).join("")}</ul>`; }
  }
  return `<div class="set-row" id="riga-${c.k}"><div>${esc(c.nome)}${det}</div>${st}
    <button class="btn small" data-action="picker" data-k="${c.k}">${f ? "Cambia" : "Seleziona"}</button></div>`;
}
function aggiornaRiga(c){ const el = document.getElementById("riga-" + c.k); if (el) el.outerHTML = rigaHTML(c); }

function impostazioni(){
  const s = stato.impostazioni;
  return `<div class="page" style="max-width:760px">
    <div class="page-head"><div><h1>Impostazioni</h1><p>Collegamenti a Google, aspetto e diciture dei documenti.</p></div></div>
    <h2>Collegamenti Google</h2>
    <p class="muted" style="margin-top:-4px">L’app vede solo i file selezionati qui e quelli che crea lei.</p>
    ${COLLEGAMENTI.map(g => `<h3 class="set-grp">${g.gruppo}</h3>
      ${g.gruppo === "Cartelle archivio" ? `<p class="hint" style="margin:0 0 8px;font-size:13px">In ogni archivio l’app crea le sottocartelle dei clienti. Quelle fatte a mano non le vede: se ne esiste una con lo stesso nome, l’app ne crea comunque una sua.</p>` : ""}
      ${g.gruppo === "Template" ? `<p class="hint" style="margin:0 0 8px;font-size:13px">Solo Documenti Google: i .docx vanno prima salvati come Documenti Google.</p>` : ""}
      <div class="set-list">${g.voci.map(rigaHTML).join("")}</div>`).join("")}

    <h2 class="section-gap">Aspetto</h2>
    <div class="seg" role="radiogroup" aria-label="Tema">${[["auto","Automatico"],["light","Chiaro"],["dark","Scuro"]].map(([v,l]) => `<label><input type="radio" name="tema" value="${v}" data-setting="tema" ${s.tema===v?"checked":""}>${l}</label>`).join("")}</div>

    <h2 class="section-gap">Diciture</h2>
    <label class="f"><span>Etichetta del 4% nei documenti</span><input class="inp" value="${esc(s.etichetta4)}" data-setting="etichetta4"></label>
    <label class="f"><span>Maggiorazione su spese esterne, noleggi e spese rifatturate (%)</span><input class="inp num" inputmode="decimal" value="${esc(String(s.maggiorazione).replace(".", ","))}" data-setting="maggiorazione"><span class="err" id="errMagg" style="display:block"></span></label>
    <label class="f"><span>Listino valido dal</span><input class="inp" type="date" value="${esc(s.listinoDal)}" data-setting="listinoDal" style="max-width:200px"></label>

    <h2 class="section-gap">Prova dei template</h2>
    <p class="muted" style="margin-top:-4px">Genera Doc e PDF di ogni template collegato con dati d’esempio, nella cartella “Prove template” dentro i dati dell’app. Serve a controllare il motore dei segnaposto.</p>
    <button class="btn" data-action="prova-template">Prova i template</button>
    <div class="set-list" id="esitoProve" style="margin-top:16px">${esitiProve.map(rigaProva).join("")}</div>

    <h2 class="section-gap">Account</h2>
    <div class="block"><div><strong>Dati dell’app</strong><div class="muted">Cartella “${esc(NOME_CARTELLA)}” su Drive.</div></div>
      <div class="actions"><a class="btn" href="https://drive.google.com/drive/folders/${encodeURIComponent(stato.cartella)}" target="_blank" rel="noopener">Apri in Drive</a><button class="btn" data-action="esci">Esci</button></div></div>
  </div>`;
}

const TITOLI_PICKER = {foglio:"Scegli il foglio", cartella:"Scegli la cartella", documento:"Scegli il template"};
async function apriPicker(k){
  const c = TUTTI_COLLEGAMENTI.find(x => x.k === k);
  try {
    const f = await scegli(c.tipo, `${TITOLI_PICKER[c.tipo]}: ${c.nome}`);
    if (!f) return;
    stato.impostazioni.file[k] = f;
    delete verifiche[k];
    aggiornaRiga(c);
    await salvaImpostazioni();
    toast(`${c.nome} collegato.`);
    verifica(c);
  } catch(e){ gestisciErrore(e, () => apriPicker(k)); }
}

/* ---------- Prova dei template ---------- */
const esitiProve = [];   // {nome, stato: "attesa"|"corso"|"ok"|"avviso"|"errore", testo, doc, pdf}

function rigaProva(e){
  const st = {attesa:["st-todo","In attesa"], corso:["st-todo","In corso…"], ok:["st-ok","Fatto"], avviso:["st-err","Da controllare"], errore:["st-err","Errore"], salta:["st-todo","Template non collegato"]}[e.stato];
  const link = (e.doc ? `<a class="btn small" href="https://docs.google.com/document/d/${encodeURIComponent(e.doc)}/edit" target="_blank" rel="noopener">Doc</a>` : "") +
    (e.pdf ? ` <a class="btn small" href="https://drive.google.com/file/d/${encodeURIComponent(e.pdf)}/view" target="_blank" rel="noopener">PDF</a>` : "");
  return `<div class="set-row"><div>${esc(e.nome)}${e.testo ? `<span class="${e.stato === "ok" ? "ok-det" : e.stato === "corso" || e.stato === "salta" ? "nome" : "probl"}">${esc(e.testo)}</span>` : ""}</div><span class="${st[0]}">${st[1]}</span><span class="actions">${link}</span></div>`;
}
const mostraProve = () => { const el = $("#esitoProve"); if (el) el.innerHTML = esitiProve.map(rigaProva).join(""); };

let proveInCorso = false;
async function provaTemplate(){
  if (proveInCorso) return;
  proveInCorso = true;
  esitiProve.length = 0;
  PROVE.forEach(p => esitiProve.push({nome: p.nome, stato: stato.impostazioni.file[p.k] ? "attesa" : "salta"}));
  mostraProve();
  try {
    const radice = (await cercaPerNome("Prove template", {parent: stato.cartella, mime: MIME_CARTELLA}))[0] || await creaCartella("Prove template", stato.cartella);
    const cartella = await cartellaCliente(radice.id, {id: "CLI-000", nome: "Cliente di prova"});
    // Le prove precedenti vanno nel cestino, così restano solo quelle nuove.
    for (const f of await cerca(`'${cartella.id}' in parents`)) await cestina(f.id);
    for (const [i, p] of PROVE.entries()){
      const e = esitiProve[i];
      if (e.stato === "salta") continue;
      e.stato = "corso"; mostraProve();
      try {
        const nome = nomeFile({codice: "PROVA-" + String(i + 1).padStart(2, "0"), tipo: "TPL", titolo: p.nome, cliente: "Cliente di prova"});
        const r = await generaDocumento({template: stato.impostazioni.file[p.k].id, cartella: cartella.id, nome, dati: p.dati},
          t => { e.testo = t + "…"; mostraProve(); });
        Object.assign(e, {doc: r.doc.id, pdf: r.pdf.id});
        const note = [];
        if (r.rimasti.length) note.push("Segnaposto rimasti: " + r.rimasti.join(", "));
        if (!r.link) note.push("Link a filippomauro.com non trovato nel Doc");
        e.stato = note.length ? "avviso" : "ok";
        e.testo = note.length ? note.join(" · ") : "Nessun segnaposto rimasto, link presente";
      } catch(err){
        if (err instanceof SessioneScaduta) throw err;
        console.error(p.nome, err);
        e.stato = "errore"; e.testo = err.message;
      }
      mostraProve();
    }
  } catch(err){ gestisciErrore(err, provaTemplate); }
  finally { proveInCorso = false; mostraProve(); }
}

/* ---------- Router ---------- */
const TITLES = {home:"Home", attrezzatura:"Attrezzatura", "attrezzatura-nuova":"Attrezzatura", preventivi:"Preventivi", "preventivi-nuovo":"Preventivi", contratti:"Contratti", "contratti-nuovo":"Contratti", cortesia:"Copie di cortesia", "cortesia-verifica":"Copie di cortesia", impostazioni:"Impostazioni"};
const PROCEDURE = {"attrezzatura-nuova": "attrezzatura", "preventivi-nuovo": "preventivi", "contratti-nuovo": "contratti", "cortesia-verifica": "cortesia"};
function route(){
  if (!stato.impostazioni) return;
  let h = location.hash.slice(1) || "home";
  if (!TITLES[h]) h = "home";
  const base = PROCEDURE[h] || h;
  document.body.classList.toggle("in-wiz", !!PROCEDURE[h]);
  document.querySelectorAll("[data-nav]").forEach(a => { if (a.dataset.nav === base) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  $("#topTitle").textContent = TITLES[h];
  const v = $("#view");
  if (h === "home") v.innerHTML = home();
  else if (h === "attrezzatura") v.innerHTML = liste.vistaSezione();
  else if (h === "attrezzatura-nuova"){ liste.vistaProcedura(v); return; }
  else if (h === "preventivi") v.innerHTML = preventivi.vistaSezione();
  else if (h === "preventivi-nuovo"){ preventivi.vistaProcedura(v); return; }
  else if (h === "contratti") v.innerHTML = contratti.vistaSezione();
  else if (h === "contratti-nuovo"){ contratti.vistaProcedura(v); return; }
  else if (h === "cortesia") v.innerHTML = cortesia.vistaSezione();
  else if (h === "cortesia-verifica"){ const html = cortesia.vistaVerifica(); if (!html) return; v.innerHTML = html; cortesia.aggiorna(); }
  else if (h === "impostazioni"){
    v.innerHTML = impostazioni();
    TUTTI_COLLEGAMENTI.filter(c => stato.impostazioni.file[c.k] && !verifiche[c.k]).forEach(verifica);
  }
  window.scrollTo(0,0);
}
window.addEventListener("hashchange", route);

/* ---------- Eventi ---------- */
document.addEventListener("click", e => {
  const a = e.target.closest("[data-action]");
  if (!a) return;
  const act = a.dataset.action;
  if (liste.click(act, a) || preventivi.click(act, a) || contratti.click(act, a) || cortesia.click(act, a)) return;
  if (act === "modifica"){ e.preventDefault(); const d = trova(a.dataset.codice, a.dataset.tipo); if (d) apriModifica(d, +a.dataset.v); }
  else if (act === "carica-pdf") caricaPdf(a.dataset.tipo);
  else if (act === "scarica-pdf"){ e.preventDefault(); scaricaPdf(a.dataset.id, a.dataset.nome).catch(err => gestisciErrore(err)); }
  else if (act === "copia-testo") copia(a.dataset.testo).then(() => toast("Copiato: in Trello incollalo in una checklist"), () => toast("Copia non riuscita"));
  else if (act === "panel") $("#panel")?.classList.toggle("open");
  else if (act === "picker") apriPicker(a.dataset.k);
  else if (act === "prova-template") provaTemplate();
  else if (act === "esci") modal("Esci", "<p>Esci da Google su questo dispositivo? I dati restano su Drive.</p>",
    [{label:"Annulla"}, {label:"Esci", primary:true, fn: () => { esci(); stato.impostazioni = null; mostraLogin(); }}]);
  else if (act === "riprova-avvio") avvia();
});

const erroreSalvataggio = e => gestisciErrore(e, () => salvaImpostazioni().catch(gestisciErrore));
document.addEventListener("input", e => {
  if (liste.input(e.target) || preventivi.input(e.target) || contratti.input(e.target) || cortesia.input(e.target)) return;
  const t = e.target, k = t.dataset.setting;
  if (!k || !stato.impostazioni || k === "tema") return;
  if (k === "maggiorazione"){
    const n = Number(t.value.trim().replace(",", "."));
    const ok = t.value.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
    $("#errMagg").textContent = ok ? "" : "Scrivi una percentuale tra 0 e 100.";
    if (!ok) return;
    stato.impostazioni.maggiorazione = n;
  } else stato.impostazioni[k] = t.value;
  salvaImpostazioniDopo(erroreSalvataggio);
});
document.addEventListener("change", e => {
  if (liste.change(e.target) || preventivi.change(e.target) || contratti.change(e.target) || cortesia.change(e.target)) return;
  const t = e.target;
  if (t.dataset.setting === "tema" && stato.impostazioni){
    stato.impostazioni.tema = t.value;
    applyTheme();
    salvaImpostazioni().catch(erroreSalvataggio);
  }
});

/* ---------- Avvio ---------- */
preparaAccesso().catch(e => { $("#loginErr").textContent = e.message; });
if (haToken()) avvia(); else mostraLogin();
