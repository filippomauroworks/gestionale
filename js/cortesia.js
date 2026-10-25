/* ---------- Copie di cortesia ----------
   Dal PDF di Fiscozen: pdf.js estrae il testo, l'app riconosce numero, data,
   destinatario, righe, rivalsa, bollo, totale, intestatario, IBAN, scadenza e note
   (CLAUDE.md, 5.4). Tutto si controlla in una schermata di verifica: se righe +
   rivalsa + bollo non fanno il totale, la generazione è bloccata. */

import { $, esc, toast, modal, closeModal } from "./util.js";
import { stato } from "./dati.js";
import { clienti } from "./anagrafiche.js";
import { prossimaVersione, registra, documenti, trova } from "./registro.js";
import { cartellaCliente, generaDocumento } from "./genera.js";
import { nomeCortesia, nomeCartellaCliente } from "./nomi.js";
import { rigaDocumento, linkDoc } from "./elenco.js";
import { gestisciErrore, CollegamentoMancante } from "./errori.js";
import { selezione, avanzamento } from "./procedura.js";
import { centesimi, eur, cifraCampo } from "./calcoli.js";

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/";
const NOTA_BASE = "Operazione in franchigia da IVA ai sensi dell’art. 1, commi 54-89, L. 190/2014 (regime forfettario). Imposta di bollo assolta in modo virtuale.";

let C = null;        // clienti e conti dal foglio
let D = null;        // dati letti e corretti nella verifica

/* ---------- Lettura del PDF ---------- */
let pdfjs = null;
async function caricaPdfjs(){
  if (!pdfjs){
    pdfjs = await import(PDFJS + "pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
  }
  return pdfjs;
}

/* Testo del PDF riga per riga: i pezzi con la stessa altezza formano una riga,
   ordinati da sinistra; dove c'è uno spazio largo si mette " | " (colonne). */
export async function testoPdf(file){
  const lib = await caricaPdfjs();
  const pdf = await lib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
  const righe = [];
  for (let n = 1; n <= pdf.numPages; n++){
    const pag = await pdf.getPage(n);
    const t = await pag.getTextContent();
    const pezzi = t.items.filter(i => i.str.trim()).map(i => ({s: i.str, x: i.transform[4], y: i.transform[5], w: i.width}));
    pezzi.sort((a, b) => b.y - a.y || a.x - b.x);
    let riga = null;
    for (const p of pezzi){
      if (riga && Math.abs(riga.y - p.y) < 3){ riga.pezzi.push(p); continue; }
      riga = {y: p.y, pezzi: [p]}; righe.push(riga);
    }
  }
  return righe.map(r => {
    r.pezzi.sort((a, b) => a.x - b.x);
    let s = "", fine = null;
    for (const p of r.pezzi){
      if (fine !== null) s += p.x - fine > 18 ? " | " : (p.x - fine > 1.5 ? " " : "");
      s += p.s; fine = p.x + p.w;
    }
    return s.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}

const IMPORTO = /(?:€\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s*€)?/;
const importoIn = s => { const m = s.match(new RegExp(IMPORTO.source + "\\s*$")); return m ? m[1] : null; };
const dataIso = s => { const m = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; };

/* Riconoscimento dei campi. Le regole cercano le parole che Fiscozen mette accanto
   a ogni dato; quello che non si trova resta vuoto e si scrive nella verifica. */
export function leggiFattura(righe){
  const tutto = righe.join("\n"), D = {righe: [], dest: ["", "", "", ""], note: "", intestatario: "", iban: "", scadenza: "", riv: "", bollo: "", totale: "", num: "", data: "", piva: "", cf: ""};
  // Numero e data
  let m = tutto.match(/fattura\s*(?:n\.?|nr\.?|numero)?\s*[:°]?\s*(\d+)\s*\/\s*(\d{4})/i) || tutto.match(/\bn(?:umero|r)?\.?\s*[:°]?\s*(\d+)\s*\/\s*(\d{4})/i);
  if (m) D.num = `${+m[1]}/${m[2]}`;
  m = tutto.match(/(?:data(?:\s+(?:fattura|documento|emissione))?|del)\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i);
  if (m) D.data = dataIso(m[1]);
  // IBAN e intestatario
  m = tutto.replace(/[  ]/g, "").match(/IBAN:?([A-Z]{2}\d{2}[A-Z0-9]{11,30})/i);
  if (m) D.iban = m[1].toUpperCase().replace(/(.{4})/g, "$1 ").trim();
  m = tutto.match(/(?:intestat[oa]|beneficiario)\s*(?:a)?\s*:?\s*([^\n|]+)/i);
  if (m) D.intestatario = m[1].trim();
  // Scadenza
  m = tutto.match(/(?:scadenza|da saldare entro|entro il)\s*(?:il)?\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i);
  if (m) D.scadenza = dataIso(m[1]);
  // Totali: si cercano dall'ultima riga che li nomina
  const ultimaCon = re => { for (let i = righe.length - 1; i >= 0; i--) if (re.test(righe[i])){ const v = importoIn(righe[i]) || (righe[i + 1] && importoIn(righe[i + 1])); if (v) return v; } return ""; };
  D.riv = ultimaCon(/rivalsa|contributo\s+(?:integrativo|previdenziale)|inps/i);
  D.bollo = ultimaCon(/bollo/i);
  D.totale = ultimaCon(/totale\s+(?:documento|fattura|da pagare|dovuto)|netto a pagare|^totale\b/i);
  // Destinatario: il blocco dopo "Destinatario", "Cliente" o "Spett.le"
  const iDest = righe.findIndex(r => /^(destinatario|cliente|spett\.?\s*le|intestato a|fatturato a)\b/i.test(r));
  if (iDest >= 0){
    const blocco = [];
    for (let i = iDest; i < righe.length && blocco.length < 5; i++){
      const r = righe[i].split(" | ")[0].replace(/^(destinatario|cliente|spett\.?\s*le|intestato a|fatturato a)\s*:?\s*/i, "").trim();
      if (!r) continue;
      if (/^(descrizione|data|fattura|n\.|numero)\b/i.test(r)) break;
      blocco.push(r);
    }
    D.dest = [blocco[0] || "", blocco.slice(1).find(x => /p\.?\s*iva|c\.?\s*f\.?|codice fiscale/i.test(x)) || "", blocco.slice(1).find(x => /\d{5}/.test(x) && !/p\.?\s*iva/i.test(x)) || "", ""];
  }
  m = tutto.match(/p\.?\s*iva\s*:?\s*(?:IT)?\s*(\d{11})/gi);
  if (m){ const tutte = m.map(x => x.match(/(\d{11})/)[1]); D.piva = tutte.find(x => x !== "02971460429") || ""; }
  m = tutto.match(/\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b/gi);
  if (m) D.cf = m.map(x => x.toUpperCase()).find(x => !x.startsWith("MRAFPP")) || "";
  // Righe: tra l'intestazione "Descrizione" e la prima riga dei totali, quelle che finiscono con un importo
  const iDesc = righe.findIndex(r => /descrizione/i.test(r));
  const iTot = righe.findIndex((r, i) => i > iDesc && /imponibile|totale|rivalsa|bollo|contributo/i.test(r));
  if (iDesc >= 0){
    for (let i = iDesc + 1; i < (iTot > 0 ? iTot : righe.length); i++){
      const imp = importoIn(righe[i]);
      const testo = righe[i].replace(new RegExp(IMPORTO.source + "\\s*$"), "").split(" | ").filter(x => x.trim() && !IMPORTO.test(x) && !/^\d+([,.]\d+)?$/.test(x.trim())).join(" ").trim();
      if (imp && testo) D.righe.push({desc: testo, imp});
      else if (!imp && testo && D.righe.length && !/^(qt|quantit|prezzo|importo)/i.test(testo)) D.righe[D.righe.length - 1].desc += " " + testo;
    }
  }
  // Note: il testo sul regime forfettario, se c'è
  m = tutto.match(/(operazione\s+(?:in franchigia|effettuata|senza applicazione)[\s\S]{0,400}?(?:\.\s*\n|$))/i);
  D.note = m ? m[1].replace(/\s*\n\s*/g, " ").replace(/ \| /g, " ").trim() : NOTA_BASE;
  return D;
}

/* ---------- Sezione Copie di cortesia ---------- */
export function vistaSezione(){
  const docs = documenti("CDC").slice().sort((x, y) => {
    const [nx, ax] = x.codice.split("/").map(Number), [ny, ay] = y.codice.split("/").map(Number);
    return ay - ax || ny - nx;
  });
  return `<div class="page">
    <div class="page-head"><div><h1>Copie di cortesia</h1><p>Generate dal PDF di Fiscozen, senza valenza fiscale. Salvate in Archivio copie di cortesia, una cartella per cliente.</p></div>
      <div class="actions"><button class="btn primary" data-action="cdc-carica">Carica PDF Fiscozen</button></div></div>
    <div class="toolbar"><input class="search" type="search" placeholder="Cerca per cliente o numero" data-filter aria-label="Cerca"><span class="muted" style="font-size:14px">${docs.length} ${docs.length === 1 ? "copia" : "copie"}</span></div>
    <div id="docs">${docs.length ? docs.map(d => rigaDocumento(d, {extra: `<button class="btn small" data-action="cdc-versione" data-codice="${esc(d.codice)}">Nuova versione</button>`})).join("")
      : `<p class="empty">Nessuna copia. Inizia da “Carica PDF Fiscozen”.</p>`}</div>
  </div>`;
}

function scegliPdf(versione){
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/pdf,.pdf";
  inp.onchange = () => { const f = inp.files[0]; if (f) apri(f, versione); };
  inp.click();
}

export async function apri(file, versione){
  const passo = avanzamento("Leggo il PDF");
  try {
    passo("Estraggo il testo");
    const [righe] = await Promise.all([testoPdf(file), clienti().then(x => { C = x; })]);
    if (!righe.length) throw new Error("Nel PDF non c’è testo leggibile: è forse una scansione? Serve il PDF scaricato da Fiscozen.");
    passo("Riconosco i campi");
    const l = leggiFattura(righe);
    // Cliente dalla P.IVA o dal C.F.
    const pulisci = s => String(s || "").replace(/\s/g, "").toUpperCase().replace(/^IT/, "");
    const cli = C.clienti.find(c => (l.piva && pulisci(c.piva) === l.piva) || (l.cf && pulisci(c.cf) === l.cf));
    const conto = C.conti.find(k => k.iban.replace(/\s/g, "") === l.iban.replace(/\s/g, ""));
    D = Object.assign(l, {file: file.name, testo: righe, ver: versione || null, cli: cli?.id || "", riconosciuto: !!cli,
      intestatario: l.intestatario || conto?.intestatario || ""});
    if (!D.righe.length) D.righe = [{desc: "", imp: ""}];
    closeModal();
    if (location.hash === "#cortesia-verifica") window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "cortesia-verifica";
  } catch(e){ closeModal(); gestisciErrore(e); }
}

/* ---------- Verifica ---------- */
const verso = () => {
  if (!D) return null;
  const somma = D.righe.reduce((s, r) => s + (centesimi(r.imp) || 0), 0) + (centesimi(D.riv) || 0) + (centesimi(D.bollo) || 0);
  const tot = centesimi(D.totale) || 0;
  return {somma, tot, ok: tot > 0 && somma === tot};
};
const codiceDi = num => String(num || "").replace(/\s/g, "");
// Versione esistente a cui agganciarsi: quella scelta con "Nuova versione", o lo stesso numero già in archivio.
const bersaglio = () => D.ver ? trova(D.ver, "CDC") : trova(codiceDi(D.num), "CDC");

export function vistaVerifica(){
  if (!D || !C){ location.replace("#cortesia"); return ""; }
  const campo = (k, l, extra = "") => `<label class="f"><span>${l}</span><input class="inp" data-cd="${k}" value="${esc(D[k])}" ${extra}></label>`;
  const L4 = stato.impostazioni.etichetta4;
  return `<div class="page" style="max-width:760px">
    <a class="wiz-back" href="#cortesia">‹ Copie di cortesia</a>
    <div class="page-head" style="margin-top:8px"><div><h1>${D.ver ? `Nuova versione della ${esc(D.ver)}` : "Verifica i dati"}</h1><p>Letti da <span class="fname">${esc(D.file)}</span>. Controlla e correggi prima di generare.</p></div></div>
    <h3 class="grp">Fattura</h3>
    <div class="row2">${campo("num", "Numero", `placeholder="38/2026" style="max-width:140px"`)}<label class="f"><span>Data</span><input class="inp" type="date" data-cd="data" value="${esc(D.data)}" style="max-width:200px"></label></div>
    <h3 class="grp">Destinatario</h3>
    <label class="f"><span>Cliente (per la cartella e il nome del file)</span>${selezione(`data-cd="cli" style="max-width:420px"`, [["", "Scegli dal foglio Clienti"], ...C.clienti.map(x => [x.id, `${x.nome} (${x.id})`])], D.cli)}
      <div class="cnt">${D.riconosciuto ? "Riconosciuto dalla partita IVA o dal codice fiscale nel foglio Clienti." : `Non riconosciuto${D.piva ? ` (P.IVA letta: ${esc(D.piva)})` : D.cf ? ` (C.F. letto: ${esc(D.cf)})` : ""}: sceglilo a mano.`}</div></label>
    ${[0, 1, 2, 3].map(i => `<label class="f"><span>${["Nome", "Riga 1 (P.IVA o C.F.)", "Riga 2 (indirizzo)", "Riga 3 (facoltativa)"][i]}</span><input class="inp" data-cdest="${i}" value="${esc(D.dest[i])}" style="max-width:600px"></label>`).join("")}
    <button class="btn small" data-action="cdc-destcli" ${D.cli ? "" : "disabled"}>Usa i dati del foglio Clienti</button>
    <h3 class="grp">Righe</h3>
    ${D.righe.map((r, i) => `<div class="cd-row"><input class="inp" data-cdr="${i}" data-k="desc" value="${esc(r.desc)}" aria-label="Descrizione riga ${i + 1}" placeholder="Descrizione"><input class="inp" inputmode="decimal" data-cdr="${i}" data-k="imp" value="${esc(r.imp)}" aria-label="Importo riga ${i + 1}" placeholder="0,00"><button class="btn small" data-action="cdc-rigadel" data-i="${i}">Togli</button></div>`).join("")}
    <button class="btn small" data-action="cdc-rigaadd" style="margin-top:4px">Aggiungi riga</button>
    <h3 class="grp">Totali</h3>
    <div class="row2">${campo("riv", esc(L4) + " (€)", `inputmode="decimal" style="max-width:140px"`)}${campo("bollo", "Bollo (€)", `inputmode="decimal" style="max-width:140px"`)}${campo("totale", "Totale fattura (€)", `inputmode="decimal" style="max-width:140px"`)}</div>
    <div class="check" id="cdcCheck"></div>
    <h3 class="grp">Pagamento</h3>
    ${campo("intestatario", "Intestatario")}
    ${campo("iban", "IBAN", `style="max-width:420px"`)}
    <label class="f"><span>Scadenza (facoltativa)</span><input class="inp" type="date" data-cd="scadenza" value="${esc(D.scadenza)}" style="max-width:200px"></label>
    <h3 class="grp">Note</h3>
    <label class="f"><span>Note in fondo alla copia</span><textarea class="inp" data-cd="note">${esc(D.note)}</textarea></label>
    <div id="cdcOut">${uscitaHTML()}</div>
    <details style="margin-top:16px"><summary class="muted" style="cursor:pointer;font-size:13px">Testo letto dal PDF</summary><pre style="white-space:pre-wrap;font-size:12px;background:var(--surface);padding:10px;border-radius:6px;max-height:300px;overflow:auto">${esc(D.testo.join("\n"))}</pre></details>
    <div class="err" id="err" role="alert"></div>
    <div class="wiz-foot" style="max-width:none"><a class="btn" href="#cortesia">Annulla</a><button class="btn primary" data-action="cdc-genera">Genera copia di cortesia</button></div>
  </div>`;
}

function uscitaHTML(){
  const c = C.clienti.find(x => x.id === D.cli), tg = bersaglio();
  const v = tg ? Math.max(...tg.versioni.map(x => x.v)) + 1 : 1, num = tg ? tg.codice : codiceDi(D.num);
  const cartella = stato.impostazioni.file.archivioCortesia?.name || "Archivio copie di cortesia";
  const nome = num && c ? nomeCortesia({numero: num, cliente: c.nome, versione: v}) : "";
  return `${D.ver && codiceDi(D.num) !== D.ver ? `<div class="note warn">Il numero letto (${esc(D.num)}) è diverso da quello della copia scelta (${esc(D.ver)}). Verrà comunque salvata come V${String(v).padStart(2, "0")} della ${esc(D.ver)}.</div>` : ""}
    ${!D.ver && tg ? `<div class="note">In archivio c’è già la copia della fattura ${esc(num)}: questa diventa la V${String(v).padStart(2, "0")}.</div>` : ""}
    <div class="out">
      <p><strong>Cartella</strong><br>${esc(cartella)} / ${c ? esc(nomeCartellaCliente(c)) : "<span class=\"muted\">scegli il cliente</span>"}</p>
      <p><strong>File</strong><br>${nome ? `<span class="fname">${esc(nome)}</span> <span class="muted">(Google Doc)</span><br><span class="fname">${esc(nome)}.pdf</span>` : `<span class="muted">Servono numero e cliente.</span>`}</p>
      ${v > 1 ? `<p class="muted">Le versioni precedenti restano in archivio.</p>` : ""}
    </div>`;
}

export function aggiorna(){ dalVivo(); }

function dalVivo(){
  const k = verso(), el = $("#cdcCheck");
  if (el){
    el.className = "check " + (k.ok ? "ok" : "bad");
    el.textContent = k.ok ? `Righe, rivalsa e bollo fanno ${eur(k.somma)}: i conti tornano.` : `Righe, rivalsa e bollo fanno ${eur(k.somma)}, il totale è ${eur(k.tot)}: controlla i valori letti.`;
  }
  const o = $("#cdcOut"); if (o) o.innerHTML = uscitaHTML();
}
const ridisegna = () => { const y = window.scrollY; $("#view").innerHTML = vistaVerifica(); dalVivo(); window.scrollTo(0, y); };

function valida(){
  if (!/^\d+\/\d{4}$/.test(codiceDi(D.num))) return "Il numero deve essere nella forma 38/2026.";
  if (!D.data) return "Indica la data della fattura.";
  if (!D.cli) return "Scegli il cliente: serve per la cartella e il nome del file.";
  if (!D.dest[0].trim()) return "Scrivi il nome del destinatario.";
  if (!D.righe.length || D.righe.some(r => !r.desc.trim() || !(centesimi(r.imp) > 0))) return "Ogni riga deve avere descrizione e importo.";
  if (!verso().ok) return "La somma non torna con il totale: controlla i valori letti dal PDF.";
  if (!D.intestatario.trim()) return "Indica l’intestatario del conto.";
  if (!D.iban.trim()) return "Indica l’IBAN.";
  return "";
}

const dataFattura = iso => { const [a, m, g] = iso.split("-"); return `${g}/${m}/${a}`; };
function datiTemplate(){
  const [n, a] = codiceDi(D.num).split("/");
  return {NUMERO: `${n} / ${a}`, DATA: dataFattura(D.data), ETICHETTA_4: stato.impostazioni.etichetta4,
    DEST_NOME: D.dest[0].trim(), DEST_RIGA1: D.dest[1].trim(), DEST_RIGA2: D.dest[2].trim(), DEST_RIGA3: D.dest[3].trim(),
    RIGA: D.righe.map(r => ({DESCRIZIONE: r.desc.trim(), IMPORTO: eur(centesimi(r.imp))})),
    RIVALSA: centesimi(D.riv) > 0 ? eur(centesimi(D.riv)) : "", BOLLO: centesimi(D.bollo) > 0 ? eur(centesimi(D.bollo)) : "",
    TOTALE: eur(centesimi(D.totale)), INTESTATARIO: D.intestatario.trim(), IBAN: D.iban.trim(),
    FRASE_SCADENZA: D.scadenza ? `Da saldare entro il ${dataFattura(D.scadenza)}` : "", NOTE: D.note.trim()};
}

async function genera(){
  const m = valida();
  if (m){ $("#err").textContent = m; return; }
  const f = stato.impostazioni.file;
  try {
    if (!f.archivioCortesia) throw new CollegamentoMancante("Archivio copie di cortesia");
    if (!f.tplCdc) throw new CollegamentoMancante("Template CDC — Copia di cortesia");
    const passo = avanzamento("Genero la copia di cortesia");
    passo("Controllo le versioni");
    const tg = bersaglio(), codice = tg ? tg.codice : codiceDi(D.num);
    const v = await prossimaVersione(codice, "CDC");
    const c = C.clienti.find(x => x.id === D.cli);
    passo("Preparo la cartella del cliente");
    const cartella = await cartellaCliente(f.archivioCortesia.id, c);
    const nome = nomeCortesia({numero: codice, cliente: c.nome, versione: v});
    const r = await generaDocumento({template: f.tplCdc.id, cartella: cartella.id, nome, dati: datiTemplate()}, passo);
    passo("Aggiorno il registro");
    const dati = JSON.parse(JSON.stringify(D));
    delete dati.testo;
    // Nell'elenco il "titolo" di una copia è l'importo della fattura.
    await registra({codice, tipo: "CDC", cliente: c, titolo: eur(centesimi(D.totale)), v, nome, doc: r.doc.id, pdf: r.pdf.id, dati});
    D = null;
    location.hash = "cortesia";
    modal(`Copia della fattura ${codice}${v > 1 ? ` V${String(v).padStart(2, "0")}` : ""} generata`,
      `<p class="fname">${esc(nome)}</p>${r.rimasti.length ? `<div class="note warn">Nel documento sono rimasti questi segnaposto: ${esc(r.rimasti.join(", "))}. Controlla il template.</div>` : ""}
       <div class="actions" style="justify-content:flex-start;margin-top:12px"><a class="btn" href="${linkDoc(r.doc.id)}" target="_blank" rel="noopener">Apri il Doc</a>
       <button class="btn" data-action="scarica-pdf" data-id="${esc(r.pdf.id)}" data-nome="${esc(nome)}">Scarica il PDF</button></div>`,
      [{label: "Fatto", primary: true}]);
  } catch(e){ closeModal(); gestisciErrore(e, genera); }
}

/* ---------- Eventi ---------- */
export function click(act, el){
  if (act === "cdc-carica"){ scegliPdf(null); return true; }
  if (act === "cdc-versione"){ scegliPdf(el.dataset.codice); return true; }
  if (!act.startsWith("cdc-") || !D) return false;
  if (act === "cdc-rigaadd"){ D.righe.push({desc: "", imp: ""}); ridisegna(); }
  else if (act === "cdc-rigadel"){ D.righe.splice(+el.dataset.i, 1); if (!D.righe.length) D.righe.push({desc: "", imp: ""}); ridisegna(); }
  else if (act === "cdc-destcli"){
    const c = C.clienti.find(x => x.id === D.cli); if (!c) return true;
    const unisci = (l, sep = " · ") => l.map(x => String(x ?? "").trim()).filter(Boolean).join(sep);
    const luogo = unisci([c.cap, c.comune], " ") + (c.provincia ? ` (${c.provincia})` : "");
    D.dest = [c.nome, c.tipo === "Privato" ? unisci([c.cf && "C.F. " + c.cf]) : unisci([c.piva && "P.IVA " + c.piva, c.cf && c.cf !== c.piva && "C.F. " + c.cf]), unisci([c.indirizzo, luogo.trim()], ", "), ""];
    ridisegna();
  }
  else if (act === "cdc-genera") genera();
  else return false;
  return true;
}
export function input(el){
  if (!D) return false;
  if (el.dataset.cdr !== undefined){ D.righe[+el.dataset.cdr][el.dataset.k] = el.value; }
  else if (el.dataset.cdest !== undefined){ D.dest[+el.dataset.cdest] = el.value; }
  else if (el.dataset.cd !== undefined && el.tagName !== "SELECT"){ D[el.dataset.cd] = el.value; }
  else return false;
  $("#err") && ($("#err").textContent = "");
  dalVivo();
  return true;
}
export function change(el){
  if (!D || el.dataset.cd !== "cli") return false;
  D.cli = el.value; ridisegna();
  return true;
}
