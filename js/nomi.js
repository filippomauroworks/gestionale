/* ---------- Nomi dei file e delle cartelle ----------
   CODICE_TIPO_Progetto_Cliente_FilippoMauro[_Dettaglio][_Vxx]
   es. 2026-016_CTR_VideocorsoADHD_GamMedical_FilippoMauro_V02 */

const pad2 = n => String(n).padStart(2, "0");
const pad3 = n => String(n).padStart(3, "0");

// CamelCase senza accenti né simboli: "Video corso ADHD" → "VideoCorsoADHD".
export const slug = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, " ")
  .split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join("");

/* Ragione sociale senza forma societaria; "Personale" se manca il cliente.
   Le parole tutte maiuscole diventano "Parola": "SALA GIOCHI S.r.l." → "SalaGiochi". */
const FORME = /(^|\s)(s\.?\s?r\.?\s?l\.?(\s?s\.?)?|s\.?\s?a\.?\s?s\.?|s\.?\s?p\.?\s?a\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?p\.?\s?a\.?|s\.?\s?b\.?|societ[aà] benefit|ssdrl|ssd|asd|aps|ets|onlus|odv)(?=\s|,|$)/ig;
export const slugCliente = nome => {
  if (!nome) return "Personale";
  const pulito = String(nome).replace(FORME, " ").split(/\s+/)
    .map(w => /^[A-ZÀ-Ý]{2,}$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w).join(" ");
  return slug(pulito) || "Personale";
};

// riepilogo: il preventivo essenziale facoltativo (suffisso _Riepilogo); dettaglio: il vecchio dettagliato.
export function nomeFile({codice, tipo, titolo, cliente, versione = 1, dettaglio = false, riepilogo = false}){
  return `${codice}_${tipo}_${slug(titolo).slice(0, 32)}_${slugCliente(cliente)}_FilippoMauro${dettaglio ? "_Dettaglio" : ""}${riepilogo ? "_Riepilogo" : ""}${versione > 1 ? "_V" + pad2(versione) : ""}`;
}

// Copia di cortesia: numero di fattura "38/2026" → FT-2026-038_CDC_Cliente_FilippoMauro[_Vxx]
export function nomeCortesia({numero, cliente, versione = 1}){
  const [n, a] = String(numero).split("/").map(x => x.trim());
  return `FT-${a || "????"}-${pad3(+n || 0)}_CDC_${slugCliente(cliente)}_FilippoMauro${versione > 1 ? "_V" + pad2(versione) : ""}`;
}

// Sottocartella cliente negli archivi: "CLI-001 – Ragione sociale" oppure "Lavori personali".
export const nomeCartellaCliente = cliente => cliente ? `${cliente.id} – ${cliente.nome}` : "Lavori personali";
