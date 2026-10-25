/* ---------- Accesso a Google e chiamate alle API ----------
   Google Identity Services (token client) per l'accesso, Picker per scegliere i file.
   Il token dura un'ora: lo teniamo in localStorage con la scadenza, così riaprendo
   l'app entro l'ora non serve accedere di nuovo. */

import { CONFIG } from "../config.js";
import { store } from "./util.js";

const TKEY = "fm-token";
let tokenClient = null;
let tok = store.get(TKEY, null);   // {value, exp}

// Errore speciale: la sessione è scaduta e serve un nuovo accesso (con un clic).
export class SessioneScaduta extends Error {
  constructor(){ super("La sessione con Google è scaduta. Accedi di nuovo."); this.name = "SessioneScaduta"; }
}

const caricati = {};
function loadScript(src){
  if (!caricati[src]) caricati[src] = new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.defer = true;
    s.onload = ok;
    s.onerror = () => { delete caricati[src]; ko(new Error("Non riesco a caricare i servizi di Google. Controlla la connessione.")); };
    document.head.appendChild(s);
  });
  return caricati[src];
}

export const haToken = () => !!tok && tok.exp - Date.now() > 60_000;

export function token(){
  if (!haToken()) throw new SessioneScaduta();
  return tok.value;
}

/* Carica GIS in anticipo: requestAccessToken deve partire subito dal clic,
   altrimenti il browser blocca il popup. */
export async function preparaAccesso(){
  await loadScript("https://accounts.google.com/gsi/client");
  if (!tokenClient) tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.clientId,
    scope: CONFIG.scope,
    callback: r => { const a = attesa; attesa = null; if (a) rispostaAccesso(r, a); },
    error_callback: e => {
      const a = attesa; attesa = null;
      if (a) a.ko(new Error(e.type === "popup_closed" ? "Finestra di accesso chiusa prima di finire." : "Il browser ha bloccato la finestra di accesso. Consenti i popup per questo sito."));
    }
  });
}

let attesa = null;   // {ok, ko} della richiesta di accesso in corso

function rispostaAccesso(r, {ok, ko}){
  if (r.error){ ko(new Error("Accesso non riuscito: " + (r.error_description || r.error))); return; }
  if (!google.accounts.oauth2.hasGrantedAllScopes(r, CONFIG.scope)){
    ko(new Error("Serve il permesso di accedere ai file di Drive scelti con l’app. Riprova e lascia la casella spuntata."));
    return;
  }
  tok = {value: r.access_token, exp: Date.now() + r.expires_in * 1000};
  store.set(TKEY, tok);
  ok();
}

// Da chiamare dentro un gestore di clic, dopo preparaAccesso().
export function accedi(){
  return new Promise((ok, ko) => {
    if (!tokenClient){ ko(new Error("I servizi di Google non sono ancora pronti. Riprova tra un attimo.")); return; }
    attesa = {ok, ko};
    tokenClient.requestAccessToken({prompt: ""});
  });
}

export function esci(){
  tok = null;
  store.del(TKEY);
}

/* fetch verso le API di Google con il token. Restituisce JSON (o testo se raw).
   Gli errori di Google diventano messaggi leggibili. */
export async function api(url, opts = {}){
  const headers = Object.assign({Authorization: "Bearer " + token()}, opts.headers || {});
  let r;
  try { r = await fetch(url, Object.assign({}, opts, {headers})); }
  catch(e){ throw new Error("Nessuna risposta da Google. Controlla la connessione."); }
  if (r.status === 401){ esci(); throw new SessioneScaduta(); }
  if (!r.ok){
    let msg = "";
    try { const j = await r.json(); msg = j.error?.message || ""; } catch(e){}
    const err = new Error(`Google ha risposto con un errore (${r.status})${msg ? ": " + msg : ""}`);
    err.status = r.status;
    throw err;
  }
  if (opts.raw) return r;
  if (r.status === 204) return null;
  return r.json();
}

/* ---------- Picker ---------- */
let pickerPronto = null;
function caricaPicker(){
  if (!pickerPronto) pickerPronto = loadScript("https://apis.google.com/js/api.js")
    .then(() => new Promise(ok => gapi.load("picker", ok)));
  return pickerPronto;
}
export const preparaPicker = () => caricaPicker().catch(() => { pickerPronto = null; });

const MIME = {
  foglio: "application/vnd.google-apps.spreadsheet",
  cartella: "application/vnd.google-apps.folder",
  documento: "application/vnd.google-apps.document"
};

/* Apre il Picker. tipo: "foglio" | "cartella" | "documento".
   Restituisce {id, name} oppure null se si chiude senza scegliere. */
export async function scegli(tipo, titolo){
  const t = token();
  await caricaPicker();
  const P = google.picker;
  let view;
  if (tipo === "cartella"){
    view = new P.DocsView(P.ViewId.FOLDERS).setSelectFolderEnabled(true).setIncludeFolders(true).setMimeTypes(MIME.cartella);
  } else {
    view = new P.DocsView(tipo === "foglio" ? P.ViewId.SPREADSHEETS : P.ViewId.DOCUMENTS).setMimeTypes(MIME[tipo]).setIncludeFolders(true);
  }
  return new Promise(ok => {
    const picker = new P.PickerBuilder()
      .setOAuthToken(t)
      .setDeveloperKey(CONFIG.apiKey)
      .setAppId(CONFIG.appId)
      .setLocale("it")
      .setTitle(titolo)
      .addView(view)
      .setCallback(d => {
        if (d.action === P.Action.PICKED){ const f = d.docs[0]; ok({id: f.id, name: f.name}); }
        else if (d.action === P.Action.CANCEL) ok(null);
      })
      .build();
    picker.setVisible(true);
  });
}
