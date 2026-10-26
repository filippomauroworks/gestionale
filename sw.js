/* ---------- Service worker ----------
   Tiene una copia della parte statica dell'app (pagine, stile, codice, icone).
   Strategia "prima la rete": online si prende sempre la versione aggiornata,
   chiedendo al server se il file è cambiato, e la copia si rinnova; offline si usa la copia.
   Le richieste verso Google (API, accesso, font) e i CDN non passano di qui. */

const CACHE = "gestionale-v2";
const FILE = [
  "./", "index.html", "privacy.html", "config.js", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/util.js", "js/google.js", "js/drive.js", "js/dati.js", "js/fogli.js", "js/motore.js", "js/genera.js",
  "js/nomi.js", "js/esempi.js", "js/calcoli.js", "js/anagrafiche.js", "js/registro.js", "js/elenco.js", "js/errori.js",
  "js/procedura.js", "js/liste.js", "js/preventivi.js", "js/contratti.js", "js/cortesia.js", "js/riapertura.js", "js/manuali.js",
  "logo-scuro.png", "logo-chiaro.png", "icone/favicon.svg", "icone/icona-192.png", "icone/icona-512.png",
  "icone/icona-maskable-512.png", "icone/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

// Via le copie delle versioni precedenti del service worker.
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(r, {cache: "no-cache"})
      .then(risposta => {
        if (risposta.ok){ const copia = risposta.clone(); caches.open(CACHE).then(c => c.put(r, copia)); }
        return risposta;
      })
      .catch(() => caches.match(r, {ignoreSearch: true}).then(c => c || caches.match("index.html")))
  );
});
