/* ---------- Nomi dei file e delle cartelle ----------
   CODICE_TIPO_Progetto_Cliente_FilippoMauro[_Dettaglio][_Vxx]
   es. 2026-016_CTR_VideocorsoADHD_GamMedical_FilippoMauro_V02 */

const pad2 = n => String(n).padStart(2, "0");
const pad3 = n => String(n).padStart(3, "0");

// CamelCase senza accenti né simboli: "Video corso ADHD" → "VideoCorsoADHD".
export const slug = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, " ")
  .split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join("");

// Ragione sociale senza forma societaria; "Personale" se manca il cliente.
export const slugCliente = nome => nome ? slug(String(nome).replace(/\b(srls|srl|sas|spa|snc|s\.r\.l\.s?|s\.a\.s|s\.p\.a|s\.n\.c)\.?(?=\s|$)/ig, "")) || "Personale" : "Personale";

export function nomeFile({codice, tipo, titolo, cliente, versione = 1, dettaglio = false}){
  return `${codice}_${tipo}_${slug(titolo).slice(0, 32)}_${slugCliente(cliente)}_FilippoMauro${dettaglio ? "_Dettaglio" : ""}${versione > 1 ? "_V" + pad2(versione) : ""}`;
}

// Copia di cortesia: numero di fattura "38/2026" → FT-2026-038_CDC_Cliente_FilippoMauro[_Vxx]
export function nomeCortesia({numero, cliente, versione = 1}){
  const [n, a] = String(numero).split("/").map(x => x.trim());
  return `FT-${a || "????"}-${pad3(+n || 0)}_CDC_${slugCliente(cliente)}_FilippoMauro${versione > 1 ? "_V" + pad2(versione) : ""}`;
}

// Sottocartella cliente negli archivi: "CLI-001 – Ragione sociale" oppure "Lavori personali".
export const nomeCartellaCliente = cliente => cliente ? `${cliente.id} – ${cliente.nome}` : "Lavori personali";
