/* ---------- Gestionale Filippo Mauro: guscio dell'app ---------- */

import { $, esc, store, toast, modal } from "./util.js";
import { preparaAccesso, preparaPicker, accedi, esci, haToken, scegli, SessioneScaduta } from "./google.js";
import { info } from "./drive.js";
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

/* Errori: la sessione scaduta chiede un nuovo accesso con un clic (serve un gesto
   dell'utente per aprire il popup di Google), gli altri diventano un avviso. */
function gestisciErrore(e, riprova){
  console.error(e);
  if (e instanceof SessioneScaduta){
    modal("Sessione scaduta", "<p>L’accesso a Google dura un’ora. Accedi di nuovo per continuare: non si perde nulla.</p>",
      [{label:"Esci", fn: () => { esci(); mostraLogin(); }}, {label:"Accedi", primary:true, fn: () => accedi().then(riprova || route).catch(err => toast(err.message))}]);
  } else toast(e.message);
}

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
  return `<div class="page">
    <div class="page-head"><div><h1>Buongiorno, Filippo</h1><p>Cosa prepari oggi?</p></div></div>
    ${n < tot ? `<div class="drafts"><div class="draft-card"><div><strong>Collegamenti da completare</strong><div class="muted">${n} di ${tot} file e cartelle scelti in Impostazioni.</div></div><a class="btn primary" href="#impostazioni">Impostazioni</a></div></div>` : ""}
    <div class="quick">
      <button class="tile" data-action="presto" data-fase="3"><strong>Lista attrezzatura</strong><span>Per un lavoro o un noleggio</span></button>
      <button class="tile" data-action="presto" data-fase="4"><strong>Preventivo</strong><span>Servizi, kit attrezzatura, totali</span></button>
      <button class="tile" data-action="presto" data-fase="5"><strong>Contratto</strong><span>Procedura guidata completa</span></button>
      <button class="tile" data-action="presto" data-fase="6"><strong>Copia di cortesia</strong><span>Dal PDF di Fiscozen</span></button>
    </div>
  </div>`;
}

const SEZIONI = {
  attrezzatura: {title:"Attrezzatura", desc:"Liste per i lavori e i noleggi, inventario completo.", fase:3},
  preventivi: {title:"Preventivi", desc:"Salvati in Archivio preventivi, una cartella per cliente.", fase:4},
  contratti: {title:"Contratti", desc:"Salvati in Archivio contratti, una cartella per cliente.", fase:5},
  cortesia: {title:"Copie di cortesia", desc:"Dal PDF di Fiscozen, salvate in Archivio copie di cortesia.", fase:6}
};
const sezione = k => { const s = SEZIONI[k]; return `<div class="page">
    <div class="page-head"><div><h1>${s.title}</h1><p>${s.desc}</p></div></div>
    <p class="empty">Questa sezione arriva con il punto ${s.fase} dell’ordine di sviluppo.</p>
  </div>`; };

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

/* ---------- Router ---------- */
const TITLES = {home:"Home", attrezzatura:"Attrezzatura", preventivi:"Preventivi", contratti:"Contratti", cortesia:"Copie di cortesia", impostazioni:"Impostazioni"};
function route(){
  if (!stato.impostazioni) return;
  let h = location.hash.slice(1) || "home";
  if (!TITLES[h]) h = "home";
  document.querySelectorAll("[data-nav]").forEach(a => { if (a.dataset.nav === h) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  $("#topTitle").textContent = TITLES[h];
  const v = $("#view");
  if (h === "home") v.innerHTML = home();
  else if (SEZIONI[h]) v.innerHTML = sezione(h);
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
  if (act === "picker") apriPicker(a.dataset.k);
  else if (act === "presto") toast(`In arrivo con il punto ${a.dataset.fase} dello sviluppo.`);
  else if (act === "esci") modal("Esci", "<p>Esci da Google su questo dispositivo? I dati restano su Drive.</p>",
    [{label:"Annulla"}, {label:"Esci", primary:true, fn: () => { esci(); stato.impostazioni = null; mostraLogin(); }}]);
  else if (act === "riprova-avvio") avvia();
});

const erroreSalvataggio = e => gestisciErrore(e, () => salvaImpostazioni().catch(gestisciErrore));
document.addEventListener("input", e => {
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
