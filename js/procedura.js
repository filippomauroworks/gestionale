/* ---------- Pezzi comuni delle procedure guidate ----------
   Ogni procedura usa un proprio attributo per i campi (es. data-a per le liste):
   attr è quel nome, così i gestori di eventi restano separati. */

import { esc } from "./util.js";

export const opzione = (attr, campo, valore, attuale, titolo, nota) =>
  `<label class="opt"><input type="radio" name="${attr}-${campo}" value="${esc(valore)}" ${attr}="${campo}" ${String(attuale) === String(valore) ? "checked" : ""}><span><strong>${titolo}</strong>${nota ? `<small>${nota}</small>` : ""}</span></label>`;

export const interruttore = (attr, campo, acceso, titolo, nota) =>
  `<label class="tog"><input type="checkbox" ${attr}="${campo}" data-bool ${acceso ? "checked" : ""}><span><strong>${titolo}</strong>${nota ? `<small>${nota}</small>` : ""}</span></label>`;

export const selezione = (attrs, opzioni, attuale) =>
  `<select class="inp" ${attrs}>${opzioni.map(([v, l]) => `<option value="${esc(v)}" ${String(attuale) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;

// Barra dei passi: cliccabile solo sui passi già visitati.
export const barraPassi = (passi, etichette, attuale, visitati, azione) => passi.map((id, i) => {
  const vis = visitati.includes(id);
  return `<li class="${id === attuale ? "cur" : vis ? "done" : ""}"><button data-action="${azione}" data-id="${id}" ${!vis && id !== attuale ? "disabled" : ""} ${id === attuale ? 'aria-current="step"' : ""}><span class="n">${i + 1}</span><span class="lbl">${etichette[id]}</span></button></li>`;
}).join("");

// Ora di salvataggio della bozza, per il pannello laterale.
export const salvata = iso => iso ? `<div class="saved">Bozza salvata alle ${new Date(iso).toLocaleTimeString("it-IT", {hour: "2-digit", minute: "2-digit"})}</div>` : "";

// Copia negli appunti, con il ripiego per i browser che non hanno l'API.
export function copia(testo){
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(testo);
  return new Promise((ok, ko) => {
    const t = document.createElement("textarea");
    t.value = testo; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try { document.execCommand("copy") ? ok() : ko(); } catch(e){ ko(e); }
    t.remove();
  });
}

/* Finestra di avanzamento durante la generazione: non si chiude finché il lavoro non finisce.
   Restituisce una funzione per aggiornare il testo. */
export function avanzamento(titolo){
  const el = document.createElement("div");
  el.className = "modal-back"; el.id = "modal";
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt">${titolo}</h2><p class="muted" id="avanz">Un momento…</p></div>`;
  document.getElementById("modal")?.remove();
  document.body.appendChild(el);
  return t => { const p = document.getElementById("avanz"); if (p) p.textContent = t + "…"; };
}

/* ---------- Date di ripresa: giorni singoli e intervalli ----------
   pre distingue la procedura (es. "q" per i preventivi); lista è l'elenco normalizzato
   (vedi normalizzaDate in calcoli.js). */
export function campoDate(pre, lista, titolo = "Date di ripresa (facoltative)"){
  const data = (i, k, v, l) => `<input class="inp" type="date" data-dt="${pre}" data-i="${i}" data-k="${k}" value="${esc(v)}" style="max-width:170px" aria-label="${l}">`;
  return `<div class="f"><span>${titolo}</span>
    ${lista.map((x, i) => `<div class="fase-row data-row">
      ${x.intervallo ? `<span class="muted">dal</span>${data(i, "da", x.da, `Inizio intervallo ${i + 1}`)}<span class="muted">al</span>${data(i, "a", x.a, `Fine intervallo ${i + 1}`)}` : data(i, "da", x.da, `Data ${i + 1}`)}
      <button class="btn small" data-action="dt-togli" data-dt="${pre}" data-i="${i}">Togli</button></div>`).join("")}
    <div class="actions" style="margin-top:4px"><button class="btn small" data-action="dt-giorno" data-dt="${pre}">Aggiungi giorno</button><button class="btn small" data-action="dt-intervallo" data-dt="${pre}">Aggiungi intervallo</button></div>
    <div class="cnt" id="dateHint-${pre}"></div></div>`;
}

/* Tasti del campo date. Restituisce il selettore su cui mettere il fuoco dopo il ridisegno,
   oppure null se l'azione non riguarda le date. */
export function azioneDate(act, el, lista){
  const pre = el.dataset.dt;
  if (act === "dt-giorno" || act === "dt-intervallo"){
    const vuota = lista.length === 1 && !lista[0].da && !lista[0].a;
    const nuova = {da: "", a: "", intervallo: act === "dt-intervallo"};
    if (vuota) lista[0] = nuova; else lista.push(nuova);
    return `[data-dt="${pre}"][data-i="${lista.length - 1}"][data-k="da"]`;
  }
  if (act === "dt-togli"){
    lista.splice(+el.dataset.i, 1);
    if (!lista.length) lista.push({da: "", a: "", intervallo: false});
    return `[data-action="dt-giorno"][data-dt="${pre}"]`;
  }
  return null;
}

// Controllo degli intervalli: messaggio d'errore o stringa vuota.
export function erroreDate(lista){
  for (const x of lista){
    if (!x.intervallo) continue;
    if (x.da && !x.a) return "Indica il giorno in cui finisce l’intervallo, oppure toglilo.";
    if (!x.da && x.a) return "Indica il giorno in cui comincia l’intervallo, oppure toglilo.";
    if (x.da && x.a && x.a < x.da) return "Un intervallo non può finire prima di cominciare.";
  }
  return "";
}
