/* ---------- Lettura dei fogli Google ----------
   Le colonne si leggono per nome di intestazione (prima riga), mai per posizione.
   Le righe vuote si saltano. L'app non scrive mai nei fogli. */

import { api } from "./google.js";

const S = "https://sheets.googleapis.com/v4/spreadsheets";

// Schede e colonne obbligatorie di ogni foglio.
export const SCHEMI = {
  sheetClienti: {
    "Clienti": ["ID", "Tipo", "Ragione sociale / Nome", "Referente", "P.IVA", "C.F.", "Codice SDI", "PEC", "Indirizzo", "CAP", "Comune", "Provincia", "Nazione", "Telefono", "Email", "Note"],
    "Conti": ["Banca", "Intestatario", "IBAN"]
  },
  sheetAttrezzatura: {
    "Attrezzatura": ["ID", "Nome", "Categoria", "Quantità", "Prezzo lavoro giornata", "Prezzo lavoro mezza giornata", "Prezzo noleggio giornata", "Noleggiabile", "Attivo", "Note interne"],
    "Categorie attrezzatura": ["Categoria", "Ordine", "Prefisso ID", "Prossimo ID"],
    "Servizi": ["ID", "Nome", "Categoria", "Prezzo giornata", "Prezzo mezza giornata", "Prezzo orario", "Prezzo fisso", "Unità predefinita", "Spesa esterna", "Descrizione per il cliente", "Nota", "Nota obbligatoria", "Nel listino", "Attivo", "Note interne"],
    "Categorie servizi": ["Categoria", "Ordine", "Prefisso ID", "Prossimo ID"],
    "Kit": ["Livello", "Nome", "Descrizione per il cliente", "Soglia giornata", "Prezzo giornata", "Soglia mezza giornata", "Prezzo mezza giornata", "Attivo", "Note interne"]
  }
};

// Confronto tollerante: maiuscole, spazi doppi e spazi ai lati non contano.
const norm = s => String(s ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
const vuota = v => v === "" || v === null || v === undefined;

/* Legge un foglio secondo il suo schema.
   Restituisce {titolo, schede: {Nome: [riga, …]}, problemi: [testo, …]}.
   Ogni riga è un oggetto con le chiavi scritte come nello schema. */
export async function leggiFoglio(id, chiave){
  const schema = SCHEMI[chiave];
  const meta = await api(`${S}/${encodeURIComponent(id)}?fields=properties.title,sheets.properties.title`);
  const titoli = new Map(meta.sheets.map(s => [norm(s.properties.title), s.properties.title]));
  const problemi = [], schede = {};

  const presenti = Object.keys(schema).filter(n => {
    if (titoli.has(norm(n))) return true;
    problemi.push(`Manca la scheda “${n}”.`);
    return false;
  });
  if (!presenti.length) return {titolo: meta.properties.title, schede, problemi};

  const ranges = presenti.map(n => `'${titoli.get(norm(n)).replace(/'/g, "''")}'`);
  const p = new URLSearchParams({valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING", majorDimension: "ROWS"});
  ranges.forEach(r => p.append("ranges", r));
  const r = await api(`${S}/${encodeURIComponent(id)}/values:batchGet?${p}`);

  presenti.forEach((nome, i) => {
    const righe = r.valueRanges[i].values || [];
    const intest = (righe[0] || []).map(norm);
    const pos = {}, mancanti = [];
    for (const col of schema[nome]){
      const j = intest.indexOf(norm(col));
      if (j < 0) mancanti.push(col); else pos[col] = j;
    }
    if (mancanti.length){
      problemi.push(`Nella scheda “${nome}” ${mancanti.length === 1 ? "manca la colonna" : "mancano le colonne"} ${mancanti.map(c => `“${c}”`).join(", ")}.`);
      return;
    }
    schede[nome] = righe.slice(1)
      .filter(riga => riga.some(v => !vuota(v) && String(v).trim() !== ""))
      .map(riga => Object.fromEntries(schema[nome].map(col => {
        const v = riga[pos[col]];
        return [col, typeof v === "string" ? v.trim() : (v ?? "")];
      })));
  });
  return {titolo: meta.properties.title, schede, problemi};
}
