/* ---------- Calcoli e formati ----------
   Tutti gli importi sono in centesimi interi. Vedi CLAUDE.md, "Regole di calcolo". */

// "1.234,56", "1234.56", "€ 300", 300 → numero (NaN se vuoto o non valido).
export function numero(v){
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[€\s]/g, "").trim();
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}
export const centesimi = v => { const n = numero(v); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

// 123456 → "1.234,56 €" (il separatore delle migliaia anche sotto i 10.000).
export function eur(c){
  const neg = c < 0, a = Math.abs(Math.round(c));
  const int = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "−" : ""}${int},${String(a % 100).padStart(2, "0")} €`;
}
// Arrotondamento con segno: positivo è uno sconto (−), negativo un rialzo (+).
export const eurSegno = arr => arr > 0 ? "−" + eur(arr) : "+" + eur(-arr);
// Cifra da scrivere in un campo: 123456 → "1234,56"
export const cifraCampo = c => (c / 100).toFixed(2).replace(".", ",");
export const qta = n => Number(n).toLocaleString("it-IT", {maximumFractionDigits: 2});

export const rivalsa = s => Math.round(s * 0.04);
export const bollo = imponibile => imponibile > 7747 ? 200 : 0;   // servizi + rivalsa oltre 77,47 €

// Servizi → rivalsa, bollo, totale calcolato.
export function totali(servizi){
  const riv = rivalsa(servizi), b = bollo(servizi + riv);
  return {servizi, riv, bollo: b, totale: servizi + riv + b};
}

/* Compenso per Fiscozen: C tale che C + arrotonda(C × 0,04) + bollo = T.
   Se non esiste, i due totali raggiungibili più vicini. */
export function fiscozen(T){
  if (!(T > 0)) return null;
  const base = Math.round(T / 1.04);
  let sotto = null, sopra = null;
  for (let c = Math.max(1, base - 400); c <= base + 400; c++){
    const t = totali(c);
    if (t.totale === T) return {ok: true, compenso: c, riv: t.riv, bollo: t.bollo};
    if (t.totale < T && (sotto === null || t.totale > sotto)) sotto = t.totale;
    if (t.totale > T && (sopra === null || t.totale < sopra)) sopra = t.totale;
  }
  return {ok: false, sotto, sopra};
}

// Sconto del noleggio a terzi in base ai giorni.
export const scontoNoleggio = g => g > 10 ? 25 : g >= 6 ? 20 : g >= 4 ? 15 : 0;

// Giorni tra due date ISO, a 24 ore: dal 2 al 7 = 5.
export const giorniTra = (a, b) => Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 86400000);

/* ---------- Date ---------- */
const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
export const oggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const dataLunga = iso => { const [a, m, g] = iso.split("-").map(Number); return `${g} ${MESI[m - 1]} ${a}`; };
export const dataBreve = iso => new Date(iso + "T12:00:00").toLocaleDateString("it-IT", {day: "numeric", month: "short", year: "numeric"});

// ["2026-11-20","2026-11-21"] → "20 e 21 novembre 2026"; mesi o anni diversi restano distinti.
export function elencoDate(isos){
  const d = [...new Set(isos.filter(Boolean))].sort().map(x => x.split("-").map(Number));
  if (!d.length) return "";
  const gruppi = [];
  for (const [a, m, g] of d){
    const ult = gruppi[gruppi.length - 1];
    if (ult && ult.a === a && ult.m === m) ult.g.push(g); else gruppi.push({a, m, g: [g]});
  }
  const unisci = l => l.length > 1 ? l.slice(0, -1).join(", ") + " e " + l[l.length - 1] : l[0];
  const pezzi = gruppi.map((x, i) => {
    const stessoAnnoDopo = gruppi[i + 1] && gruppi[i + 1].a === x.a;
    return `${unisci(x.g.map(String))} ${MESI[x.m - 1]}${stessoAnnoDopo ? "" : " " + x.a}`;
  });
  return unisci(pezzi);
}

/* ---------- Numeri in lettere ---------- */
const UNITA_L = ["zero","uno","due","tre","quattro","cinque","sei","sette","otto","nove","dieci","undici","dodici","tredici","quattordici","quindici","sedici","diciassette","diciotto","diciannove"];
const DECINE_L = ["","","venti","trenta","quaranta","cinquanta","sessanta","settanta","ottanta","novanta"];
function intero(n){
  if (n < 20) return UNITA_L[n];
  if (n < 100){ let t = DECINE_L[Math.floor(n / 10)]; const r = n % 10; if (r === 1 || r === 8) t = t.slice(0, -1); return t + (r ? UNITA_L[r] : ""); }
  if (n < 1000){ const c = Math.floor(n / 100), r = n % 100; let s = (c === 1 ? "" : UNITA_L[c]) + "cento"; if (Math.floor(r / 10) === 8 || r === 8) s = s.slice(0, -1); return s + (r ? intero(r) : ""); }
  if (n < 1e6){ const m = Math.floor(n / 1000), r = n % 1000; return (m === 1 ? "mille" : intero(m) + "mila") + (r ? intero(r) : ""); }
  const M = Math.floor(n / 1e6), r = n % 1e6; return (M === 1 ? "unmilione" : intero(M) + "milioni") + (r ? intero(r) : "");
}
// Accento sui composti che finiscono in "tre": ventitré, centotré.
export const inLettere = n => { const s = intero(n); return s.length > 3 && s.endsWith("tre") ? s.slice(0, -3) + "tré" : s; };
// 100000 → "mille/00 euro"
export const euroInLettere = c => `${inLettere(Math.floor(c / 100))}/${String(c % 100).padStart(2, "0")} euro`;
// 10 → "dieci (10)"
export const conLettere = n => `${inLettere(n)} (${n})`;
