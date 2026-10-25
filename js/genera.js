/* ---------- Generazione dei documenti ----------
   Copia il template nella cartella del cliente, applica i dati, esporta il PDF
   con Drive e lo carica nella stessa cartella. Doc e PDF hanno lo stesso nome. */

import { cerca, creaCartella, copia, esportaPdf, caricaFile, cestina, MIME_CARTELLA } from "./drive.js";
import { applica } from "./motore.js";
import { nomeCartellaCliente } from "./nomi.js";

const qs = s => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";

/* Sottocartella del cliente in un archivio, ritrovata tramite l'ID (CLI-001):
   se la ragione sociale cambia, la cartella resta la stessa. Se manca, la crea. */
export async function cartellaCliente(archivioId, cliente){
  const nome = nomeCartellaCliente(cliente);
  const cerco = cliente ? `${cliente.id} ` : nome;
  const trovate = await cerca(`${qs(archivioId)} in parents and mimeType = ${qs(MIME_CARTELLA)} and name contains ${qs(cliente ? cliente.id : nome)}`);
  const giusta = trovate.find(f => cliente ? f.name.startsWith(cerco) || f.name === cliente.id : f.name === nome);
  return giusta || creaCartella(nome, archivioId);
}

/* Genera Doc e PDF. avanzamento(testo) racconta a che punto è.
   Restituisce {doc, pdf, rimasti, link}: rimasti sono i segnaposto non sostituiti. */
export async function generaDocumento({template, cartella, nome, dati}, avanzamento = () => {}){
  avanzamento("Copio il template");
  const doc = await copia(template, nome, cartella);
  try {
    avanzamento("Compilo il documento");
    const {rimasti, link} = await applica(doc.id, dati);
    avanzamento("Esporto il PDF");
    const blob = await esportaPdf(doc.id);
    const pdf = await caricaFile(nome + ".pdf", cartella, blob, "application/pdf");
    return {doc, pdf, rimasti, link};
  } catch(e){
    // Una copia a metà non deve restare in archivio: va nel cestino.
    await cestina(doc.id).catch(() => {});
    throw e;
  }
}
