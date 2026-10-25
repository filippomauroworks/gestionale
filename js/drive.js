/* ---------- Drive v3: funzioni di base ----------
   Con lo scope drive.file le ricerche trovano solo i file scelti con il Picker
   e quelli creati dall'app. */

import { api } from "./google.js";

const D = "https://www.googleapis.com/drive/v3/files";
const U = "https://www.googleapis.com/upload/drive/v3/files";
export const MIME_CARTELLA = "application/vnd.google-apps.folder";

// Le stringhe nelle query di Drive vanno tra apici, con \ e ' protetti.
const q = s => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";

export async function cerca(query, campi = "id,name,mimeType,createdTime"){
  const p = new URLSearchParams({q: query + " and trashed = false", fields: `files(${campi})`, orderBy: "createdTime", pageSize: "100", spaces: "drive"});
  const r = await api(`${D}?${p}`);
  return r.files;
}

export const cercaPerNome = (nome, {parent, mime} = {}) =>
  cerca(`name = ${q(nome)}` + (parent ? ` and ${q(parent)} in parents` : "") + (mime ? ` and mimeType = ${q(mime)}` : ""));

export const info = (id, campi = "id,name,mimeType,trashed") =>
  api(`${D}/${encodeURIComponent(id)}?fields=${campi}`);

export function creaCartella(nome, parent){
  return api(`${D}?fields=id,name`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({name: nome, mimeType: MIME_CARTELLA, parents: parent ? [parent] : undefined})
  });
}

export async function leggiJSON(id){
  const r = await api(`${D}/${encodeURIComponent(id)}?alt=media`, {raw: true});
  return r.json();
}

// Caricamento multipart: metadati e contenuto in una sola richiesta.
export function creaJSON(nome, parent, dati){
  const b = "fm" + Math.random().toString(36).slice(2);
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({name: nome, parents: [parent], mimeType: "application/json"}) +
    `\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(dati, null, 2) + `\r\n--${b}--`;
  return api(`${U}?uploadType=multipart&fields=id,name`, {
    method: "POST",
    headers: {"Content-Type": `multipart/related; boundary=${b}`},
    body
  });
}

export function copia(id, nome, parent){
  return api(`${D}/${encodeURIComponent(id)}/copy?fields=id,name,webViewLink`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({name: nome, parents: [parent]})
  });
}

// Sposta nel cestino di Drive (recuperabile per 30 giorni).
export const cestina = id => api(`${D}/${encodeURIComponent(id)}?fields=id`, {
  method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({trashed: true})
});

export async function esportaPdf(id){
  const r = await api(`${D}/${encodeURIComponent(id)}/export?mimeType=application/pdf`, {raw: true});
  return r.blob();
}

// Carica un file binario (es. il PDF) con i suoi metadati.
export function caricaFile(nome, parent, blob, mime){
  const b = "fm" + Math.random().toString(36).slice(2);
  const body = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` + JSON.stringify({name: nome, parents: [parent], mimeType: mime}) +
    `\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, blob, `\r\n--${b}--`]);
  return api(`${U}?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: {"Content-Type": `multipart/related; boundary=${b}`},
    body
  });
}

export function aggiornaJSON(id, dati){
  return api(`${U}/${encodeURIComponent(id)}?uploadType=media&fields=id`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json; charset=UTF-8"},
    body: JSON.stringify(dati, null, 2)
  });
}
