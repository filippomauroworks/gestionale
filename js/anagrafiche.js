/* ---------- Anagrafiche dai fogli Google ----------
   Clienti, conti, attrezzatura, categorie, servizi e kit, già pronti per l'uso:
   prezzi in centesimi, Sì/No come vero/falso, categorie nell'ordine della colonna Ordine.
   Si rileggono al massimo ogni due minuti, o subito con ricarica(). */

import { leggiFoglio } from "./fogli.js";
import { stato } from "./dati.js";
import { centesimi, numero } from "./calcoli.js";

const si = v => /^(s[iì]|true|vero|x|1)$/i.test(String(v ?? "").trim());
// Un trattino o una barra da soli valgono "vuoto" (nel foglio si usano al posto della cella vuota).
const testo = v => { const s = String(v ?? "").trim(); return /^[-–—/]$/.test(s) ? "" : s; };
const prezzo = v => String(v ?? "").trim() === "" ? null : centesimi(v);   // null = non indicato

export class FoglioMancante extends Error {
  constructor(nome, problemi){
    super(problemi?.length ? `${nome}: ${problemi.join(" ")} Sistemalo e riprova.` : `Collega “${nome}” in Impostazioni.`);
    this.name = "FoglioMancante";
  }
}

const cache = {};
async function carica(chiave, nome){
  const f = stato.impostazioni.file[chiave];
  if (!f) throw new FoglioMancante(nome);
  const c = cache[chiave];
  if (c && c.id === f.id && Date.now() - c.quando < 120_000) return c.dati;
  const r = await leggiFoglio(f.id, chiave);
  if (r.problemi.length) throw new FoglioMancante(nome, r.problemi);
  cache[chiave] = {id: f.id, quando: Date.now(), dati: r.schede};
  return r.schede;
}
export const ricarica = () => { for (const k in cache) delete cache[k]; };

const ordinaCategorie = righe => righe.slice()
  .sort((a, b) => (numero(a["Ordine"]) || 999) - (numero(b["Ordine"]) || 999))
  .map(r => String(r["Categoria"]).trim()).filter(Boolean);

/* ---------- Clienti e conti ---------- */
export async function clienti(){
  const s = await carica("sheetClienti", "Sheet Clienti");
  return {
    clienti: s["Clienti"].filter(r => r["ID"]).map(r => ({
      id: String(r["ID"]).trim(),
      tipo: /privat/i.test(r["Tipo"]) ? "Privato" : "Azienda",
      nome: String(r["Ragione sociale / Nome"]).trim(),
      referente: testo(r["Referente"]), piva: testo(r["P.IVA"]), cf: testo(r["C.F."]), sdi: testo(r["Codice SDI"]), pec: testo(r["PEC"]),
      indirizzo: testo(r["Indirizzo"]), cap: testo(r["CAP"]), comune: testo(r["Comune"]), provincia: testo(r["Provincia"]), nazione: testo(r["Nazione"]),
      telefono: testo(r["Telefono"]), email: testo(r["Email"])
    })),
    conti: s["Conti"].filter(r => testo(r["IBAN"])).map(r => ({banca: testo(r["Banca"]), intestatario: testo(r["Intestatario"]), iban: testo(r["IBAN"])}))
  };
}

// Le tre righe del cliente nei documenti (Guida ai template, campi comuni).
export function righeCliente(c){
  if (!c) return {CLIENTE_NOME: "", CLIENTE_RIGA1: "", CLIENTE_RIGA2: "", CLIENTE_RIGA3: ""};
  const unisci = (l, sep = " · ") => l.map(x => String(x ?? "").trim()).filter(Boolean).join(sep);
  const riga1 = c.tipo === "Privato"
    ? unisci([c.cf && "C.F. " + c.cf])
    : unisci([c.piva && "P.IVA " + c.piva]);
  const luogo = unisci([c.cap, c.comune], " ") + (String(c.provincia ?? "").trim() ? ` (${String(c.provincia).trim()})` : "");
  return {
    CLIENTE_NOME: c.nome,
    CLIENTE_RIGA1: riga1,
    CLIENTE_RIGA2: unisci([c.indirizzo, luogo.trim()], ", "),
    CLIENTE_RIGA3: String(c.referente ?? "").trim()   // solo il referente: niente email né telefono
  };
}

/* ---------- Attrezzatura, servizi e kit ---------- */
export async function listino(){
  const s = await carica("sheetAttrezzatura", "Sheet Attrezzatura");
  const categorie = ordinaCategorie(s["Categorie attrezzatura"]);
  const articoli = s["Attrezzatura"].filter(r => r["ID"] && r["Nome"]).map(r => ({
    id: String(r["ID"]).trim(),
    nome: String(r["Nome"]).trim(),
    cat: String(r["Categoria"]).trim(),
    q: Math.max(0, Math.floor(numero(r["Quantità"]) || 0)),
    lavoro: prezzo(r["Prezzo lavoro giornata"]),
    lavoroMezza: prezzo(r["Prezzo lavoro mezza giornata"]),
    noleggio: prezzo(r["Prezzo noleggio giornata"]),
    noleggiabile: si(r["Noleggiabile"]),
    attivo: si(r["Attivo"]),
    noteInterne: r["Note interne"]
  }));
  // Categorie del foglio Attrezzatura che mancano in Categorie attrezzatura: in fondo.
  for (const a of articoli) if (a.cat && !categorie.includes(a.cat)) categorie.push(a.cat);
  const servizi = s["Servizi"].filter(r => r["ID"] && r["Nome"]).map(r => ({
    id: String(r["ID"]).trim(), nome: String(r["Nome"]).trim(), cat: String(r["Categoria"]).trim(),
    giornata: prezzo(r["Prezzo giornata"]), mezza: prezzo(r["Prezzo mezza giornata"]),
    ora: prezzo(r["Prezzo orario"]), fisso: prezzo(r["Prezzo fisso"]),
    unita: String(r["Unità predefinita"]).trim(), esterna: si(r["Spesa esterna"]),
    descrizione: testo(r["Descrizione per il cliente"]), nota: testo(r["Nota"]), notaObbligatoria: si(r["Nota obbligatoria"]),
    nelListino: si(r["Nel listino"]), attivo: si(r["Attivo"]), noteInterne: r["Note interne"]
  }));
  const kit = s["Kit"].filter(r => r["Nome"]).map(r => ({
    livello: r["Livello"], nome: String(r["Nome"]).trim(), descrizione: testo(r["Descrizione per il cliente"]),
    soglia: prezzo(r["Soglia giornata"]), prezzo: prezzo(r["Prezzo giornata"]),
    sogliaMezza: prezzo(r["Soglia mezza giornata"]), prezzoMezza: prezzo(r["Prezzo mezza giornata"]),
    attivo: si(r["Attivo"]), noteInterne: r["Note interne"]
  })).sort((a, b) => (a.soglia ?? Infinity) - (b.soglia ?? Infinity));
  return {categorie, articoli, servizi, categorieServizi: ordinaCategorie(s["Categorie servizi"]), kit};
}
