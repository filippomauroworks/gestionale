/* ---------- I miei link ----------
   Un tasto per ogni profilo della scheda "I miei link" del listino (colonne Servizio e Link):
   cliccando si copia il link, da incollare nei messaggi. Come "Copia per Trello" nelle liste. */

import { esc, toast } from "./util.js";
import { listino } from "./anagrafiche.js";
import { copia } from "./procedura.js";
import { gestisciErrore } from "./errori.js";

export async function vistaLink(view){
  view.innerHTML = `<div class="page"><p class="loading">Leggo i link dal listino…</p></div>`;
  let link;
  try { link = (await listino()).link; }
  catch(e){ view.innerHTML = `<div class="page"><h1>I miei link</h1><p>${esc(e.message)}</p></div>`; gestisciErrore(e, () => vistaLink(view)); return; }
  if (location.hash !== "#link") return;   // nel frattempo si è cambiata sezione
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><h1>I miei link</h1><p>Tocca un profilo per copiarne il link, poi incollalo nel messaggio.</p></div></div>
    ${link.length ? `<div class="quick link-tasti">${link.map(l => l.url
      ? `<button class="tile" data-action="copia-link" data-link="${esc(l.url)}" data-nome="${esc(l.nome)}"><strong>${esc(l.nome)}</strong><span>${esc(l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</span></button>`
      : `<div class="tile tile-vuota"><strong>${esc(l.nome)}</strong><span>Link da aggiungere nel foglio</span></div>`).join("")}</div>`
      : `<p class="empty">Nessun link: aggiungili nella scheda “I miei link” del listino (colonne Servizio e Link).</p>`}
  </div>`;
}

export function click(act, el){
  if (act !== "copia-link") return false;
  copia(el.dataset.link).then(() => toast(`Link di ${el.dataset.nome} copiato`), () => toast("Copia non riuscita"));
  return true;
}
