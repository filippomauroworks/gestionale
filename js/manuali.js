/* ---------- Articoli scritti a mano ----------
   Nelle liste attrezzatura e nel preventivo si possono aggiungere, sotto ogni categoria, articoli
   che non sono nel foglio. Stanno nella bozza: b.manuali (id "MAN-1", "MAN-2"…) con nome, categoria
   e prezzi come li ha scritti l'utente, e b.items come gli altri. Si comportano come quelli del foglio
   (quantità, prezzi, scelta); non hanno un massimo d'inventario e il foglio non si tocca. */

import { centesimi } from "./calcoli.js";
import { esc } from "./util.js";

const prezzo = v => String(v ?? "").trim() === "" ? null : centesimi(v);   // null = non indicato

// L'articolo nella stessa forma di quelli del foglio (vedi listino in anagrafiche.js).
export const articoloManuale = (id, m) => ({id, nome: m.nome.trim(), cat: m.cat, q: Infinity,
  lavoro: prezzo(m.lavoro), lavoroMezza: prezzo(m.lavoroMezza), noleggio: prezzo(m.noleggio),
  noleggiabile: true, attivo: true, manuale: true});

export const elencoManuali = b => Object.entries(b.manuali || {}).map(([id, m]) => articoloManuale(id, m));

export function nuovoManuale(b, cat){
  const id = "MAN-" + (++b.nMan);
  b.manuali[id] = {nome: "", cat, lavoro: "", lavoroMezza: "", noleggio: ""};
  b.items[id] = {qta: "1"};
  return id;
}
export function togliManuale(b, id){ delete b.manuali[id]; delete b.items[id]; }

// Riprende gli articoli a mano da un altro documento (preventivo → lista, lista → preventivo).
export function copiaManuali(da, b){
  b.manuali = JSON.parse(JSON.stringify(da?.manuali || {}));
  b.nMan = Math.max(0, ...Object.keys(b.manuali).map(id => parseInt(id.slice(4), 10) || 0));
}

// Controllo: nome scritto e prezzo leggibile. Messaggio d'errore o stringa vuota.
export function erroreManuali(b, campoPrezzo){
  for (const [id, m] of Object.entries(b.manuali || {})){
    if (!b.items[id]) continue;
    if (!m.nome.trim()) return `Articolo aggiunto a mano in ${m.cat}: scrivi il nome, oppure toglilo.`;
    const p = campoPrezzo && m[campoPrezzo];
    if (p && String(p).trim() && !(centesimi(p) >= 0)) return `${m.nome.trim()}: il prezzo non è valido.`;
  }
  return "";
}

/* Campi della riga di un articolo a mano. attr è l'attributo dei campi della procedura (data-aman, data-qman),
   campoPrezzo il prezzo che quella procedura mostra (noleggio, lavoro, lavoroMezza) o null se non ne mostra. */
export const campoNome = (attr, id, m) =>
  `<input class="inp man-nome" ${attr}="${esc(id)}" data-k="nome" value="${esc(m.nome)}" placeholder="Nome dell’articolo" aria-label="Nome dell’articolo aggiunto a mano">`;
export const campoPrezzo = (attr, id, m, k) => k
  ? `<input class="inp num man-prezzo" inputmode="decimal" ${attr}="${esc(id)}" data-k="${k}" value="${esc(m[k])}" placeholder="0,00 €" aria-label="Prezzo al giorno di ${esc(m.nome || "articolo a mano")}">`
  : "<span></span>";
export const tastoTogli = (azione, id, m) =>
  `<button class="btn small man-x" data-action="${azione}" data-id="${esc(id)}" aria-label="Togli ${esc(m.nome || "articolo a mano")}" title="Togli">×</button>`;
// filtro: l'attributo che la ricerca usa per nascondere le righe, così il tasto sparisce mentre si cerca.
export const tastoAggiungi = (azione, cat, filtro) =>
  `<div class="man-add" ${filtro}=""><button class="btn small" data-action="${azione}" data-cat="${esc(cat)}">Aggiungi a mano in ${esc(cat)}</button></div>`;
