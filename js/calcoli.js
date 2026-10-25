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

/* Elenco di date: giorni singoli {da} o intervalli {da, a, intervallo: true}.
   Accetta anche il formato vecchio, un elenco di stringhe ISO. */
export const normalizzaDate = l => (l || []).map(x => typeof x === "string"
  ? {da: x, a: "", intervallo: false}
  : {da: x?.da || "", a: x?.a || "", intervallo: !!x?.intervallo});

const isoPiuUno = iso => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

// Tutti i giorni dell'elenco, senza doppioni e in ordine: un intervallo dal 20 al 23 conta 4 giorni.
export function giorniDate(l){
  const s = new Set();
  for (const x of normalizzaDate(l)){
    if (!x.da) continue;
    if (x.intervallo && x.a && x.a > x.da) for (let g = x.da, n = 0; g <= x.a && n < 400; g = isoPiuUno(g), n++) s.add(g);
    else s.add(x.da);
  }
  return [...s].sort();
}

/* Testo delle date: "20 e 21 novembre 2026", "dal 20 al 23 novembre 2026",
   "5 novembre e dal 20 al 23 novembre 2026". L'anno si scrive una volta sola quando non cambia. */
export function elencoDate(l){
  const norm = normalizzaDate(l).filter(x => x.da).map(x => ({da: x.da, a: x.intervallo && x.a && x.a > x.da ? x.a : ""}));
  // Un giorno singolo che cade dentro un intervallo non si ripete.
  const voci = norm.filter(x => x.a || !norm.some(y => y.a && y.da <= x.da && x.da <= y.a))
    .sort((x, y) => x.da < y.da ? -1 : x.da > y.da ? 1 : 0)
    .map(x => ({da: x.da.split("-").map(Number), a: x.a ? x.a.split("-").map(Number) : null}));
  if (!voci.length) return "";
  const pezzi = [];
  for (const v of voci){
    const ult = pezzi[pezzi.length - 1], [a, m, g] = v.da;
    if (!v.a && ult?.giorni && ult.a === a && ult.m === m){ if (!ult.giorni.includes(g)) ult.giorni.push(g); }
    else pezzi.push(v.a ? {da: v.da, fine: v.a, annoInizio: a, annoFine: v.a[0]} : {giorni: [g], a, m, annoInizio: a, annoFine: a});
  }
  const unisci = x => x.length > 1 ? x.slice(0, -1).join(", ") + " e " + x[x.length - 1] : x[0];
  // "dall’1", "dall’8", "dall’11"; "all’8"
  const dal = g => [1, 8, 11].includes(g) ? "dall’" + g : "dal " + g, al = g => [1, 8, 11].includes(g) ? "all’" + g : "al " + g;
  return unisci(pezzi.map((p, i) => {
    const anno = pezzi[i + 1] && pezzi[i + 1].annoInizio === p.annoFine ? "" : " " + p.annoFine;
    if (p.giorni) return `${unisci(p.giorni.map(String))} ${MESI[p.m - 1]}${anno}`;
    const [a1, m1, g1] = p.da, [a2, m2, g2] = p.fine;
    if (a1 !== a2) return `${dal(g1)} ${MESI[m1 - 1]} ${a1} ${al(g2)} ${MESI[m2 - 1]} ${a2}`;
    if (m1 !== m2) return `${dal(g1)} ${MESI[m1 - 1]} ${al(g2)} ${MESI[m2 - 1]}${anno}`;
    return `${dal(g1)} ${al(g2)} ${MESI[m1 - 1]}${anno}`;
  }));
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
