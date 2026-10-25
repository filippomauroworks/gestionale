/* ---------- Registro dei documenti ----------
   registro.json: indice di tutti i documenti. Ogni voce:
   {codice, tipo, cliente: {id, nome} | null, titolo, stato?, dati: id del JSON,
    versioni: [{v, data, nome, doc, pdf}]}
   I dati compilati di ogni documento stanno in "2026-016_ATT.json": {versioni: {"1": {…}, "2": {…}}}.
   Prima di scrivere si rilegge sempre da Drive, così due dispositivi non si pestano i piedi. */

import { stato } from "./dati.js";
import { cercaPerNome, leggiJSON, creaJSON, aggiornaJSON } from "./drive.js";
import { oggi } from "./calcoli.js";

const pad3 = n => String(n).padStart(3, "0");

export async function rileggi(){
  stato.registro = Object.assign({versione: 1, documenti: []}, await leggiJSON(stato.ids["registro.json"]));
  return stato.registro;
}
const salva = () => aggiornaJSON(stato.ids["registro.json"], stato.registro);

export const documenti = tipo => (stato.registro?.documenti || []).filter(d => !tipo || d.tipo === tipo);
export const trova = (codice, tipo) => documenti(tipo).find(d => d.codice === codice);
export const ultima = d => d.versioni[d.versioni.length - 1];

// Numerazione unica per anno e per tutti i tipi: 2026-001, 2026-002…
export async function prossimoCodice(){
  await rileggi();
  const a = new Date().getFullYear();
  const n = documenti().filter(d => d.codice.startsWith(a + "-")).map(d => parseInt(d.codice.slice(5), 10) || 0);
  return `${a}-${pad3(Math.max(0, ...n) + 1)}`;
}

// Numero più alto in archivio + 1 (non quello del file aperto + 1).
export async function prossimaVersione(codice, tipo){
  await rileggi();
  const d = trova(codice, tipo);
  return d ? Math.max(...d.versioni.map(v => v.v)) + 1 : 1;
}

/* Registra una versione generata: aggiorna registro.json e il JSON dei dati.
   voce: {codice, tipo, cliente, titolo, v, nome, doc, pdf, dati} */
export async function registra(voce){
  const nomeJSON = `${voce.codice}_${voce.tipo}.json`;
  await rileggi();
  let d = trova(voce.codice, voce.tipo);
  // Dati compilati
  let datiId = d?.dati, contenuto = {versioni: {}};
  if (!datiId){
    const f = (await cercaPerNome(nomeJSON, {parent: stato.cartella}))[0];
    if (f){ datiId = f.id; contenuto = await leggiJSON(f.id); }
  } else contenuto = await leggiJSON(datiId);
  contenuto.versioni = contenuto.versioni || {};
  contenuto.versioni[voce.v] = voce.dati;
  if (datiId) await aggiornaJSON(datiId, contenuto);
  else datiId = (await creaJSON(nomeJSON, stato.cartella, contenuto)).id;
  // Registro
  if (!d){ d = {codice: voce.codice, tipo: voce.tipo, versioni: []}; stato.registro.documenti.push(d); }
  Object.assign(d, {cliente: voce.cliente ? {id: voce.cliente.id, nome: voce.cliente.nome} : null, titolo: voce.titolo, dati: datiId});
  d.versioni = d.versioni.filter(x => x.v !== voce.v).concat({v: voce.v, data: oggi(), nome: voce.nome, doc: voce.doc, pdf: voce.pdf});
  d.versioni.sort((a, b) => a.v - b.v);
  await salva();
  return d;
}

export async function datiVersione(d, v){
  const c = await leggiJSON(d.dati);
  return c.versioni?.[v ?? ultima(d).v];
}
