/* ---------- Dati dell'app su Drive ----------
   Cartella "Gestionale FM — dati" creata dall'app, con impostazioni.json e registro.json.
   Essendo file creati dall'app, si ritrovano da ogni dispositivo cercandoli per nome. */

import { cercaPerNome, creaCartella, creaJSON, leggiJSON, aggiornaJSON, MIME_CARTELLA } from "./drive.js";
import { store, debounce } from "./util.js";

export const NOME_CARTELLA = "Gestionale FM — dati";

// Tutto ciò che si collega con il Picker. Le chiavi finiscono in impostazioni.json.
export const COLLEGAMENTI = [
  {gruppo: "Fogli Google", voci: [
    {k: "sheetClienti", tipo: "foglio", nome: "Sheet Clienti", det: "Schede Clienti e Conti"},
    {k: "sheetAttrezzatura", tipo: "foglio", nome: "Sheet Attrezzatura", det: "Attrezzatura, categorie, servizi e kit"}
  ]},
  {gruppo: "Cartelle archivio", voci: [
    {k: "archivioPreventivi", tipo: "cartella", nome: "Archivio preventivi"},
    {k: "archivioContratti", tipo: "cartella", nome: "Archivio contratti"},
    {k: "archivioListe", tipo: "cartella", nome: "Archivio liste attrezzatura"},
    {k: "archivioCortesia", tipo: "cartella", nome: "Archivio copie di cortesia"}
  ]},
  {gruppo: "Template", voci: [
    {k: "tplPrvDettagliato", tipo: "documento", nome: "PRV — Preventivo dettagliato", det: "Per il preventivo e per il dettagliato con la lista attrezzatura"},
    {k: "tplAttLavoro", tipo: "documento", nome: "ATT — Lista attrezzatura lavoro"},
    {k: "tplAttNoleggio", tipo: "documento", nome: "ATT — Noleggio a terzi"},
    {k: "tplCtr", tipo: "documento", nome: "CTR — Contratto"},
    {k: "tplCdc", tipo: "documento", nome: "CDC — Copia di cortesia"},
    {k: "tplLis", tipo: "documento", nome: "LIS — Listino prezzi"},
    {k: "tplInv", tipo: "documento", nome: "INV — Lista attrezzatura completa"}
  ]}
];
export const TUTTI_COLLEGAMENTI = COLLEGAMENTI.flatMap(g => g.voci);

const IMPOSTAZIONI_BASE = () => ({
  versione: 1,
  file: {},                        // chiave → {id, name}
  etichetta4: "Rivalsa INPS 4%",
  maggiorazione: 26,
  listinoDal: "",
  tema: "auto"
});
const REGISTRO_BASE = () => ({versione: 1, documenti: []});

export const stato = {
  cartella: null,         // id della cartella dati
  impostazioni: null,
  registro: null,
  ids: {}                 // id dei file JSON
};

// Trova (o crea) un file JSON nella cartella dati. Se ce ne sono più copie, vince la più vecchia.
async function apriJSON(nome, base){
  const trovati = await cercaPerNome(nome, {parent: stato.cartella});
  if (trovati.length){
    stato.ids[nome] = trovati[0].id;
    return Object.assign(base(), await leggiJSON(trovati[0].id));
  }
  const dati = base();
  const f = await creaJSON(nome, stato.cartella, dati);
  stato.ids[nome] = f.id;
  return dati;
}

/* Prima operazione dopo l'accesso. primoAvvio è vero se la cartella dati è stata appena creata. */
export async function caricaDati(){
  let primoAvvio = false;
  const cartelle = await cercaPerNome(NOME_CARTELLA, {mime: MIME_CARTELLA});
  if (cartelle.length) stato.cartella = cartelle[0].id;
  else { stato.cartella = (await creaCartella(NOME_CARTELLA)).id; primoAvvio = true; }
  [stato.impostazioni, stato.registro] = await Promise.all([
    apriJSON("impostazioni.json", IMPOSTAZIONI_BASE),
    apriJSON("registro.json", REGISTRO_BASE)
  ]);
  store.set("fm-tema", stato.impostazioni.tema);
  return {primoAvvio};
}

/* Salvataggio delle impostazioni: immediato per i collegamenti, ritardato per i testi. */
let inSalvataggio = Promise.resolve();
export function salvaImpostazioni(){
  store.set("fm-tema", stato.impostazioni.tema);
  inSalvataggio = inSalvataggio.catch(() => {}).then(() => aggiornaJSON(stato.ids["impostazioni.json"], stato.impostazioni));
  return inSalvataggio;
}
export const salvaImpostazioniDopo = debounce(onErr => salvaImpostazioni().catch(onErr), 800);

export const collegati = () => TUTTI_COLLEGAMENTI.filter(c => stato.impostazioni?.file[c.k]).length;
