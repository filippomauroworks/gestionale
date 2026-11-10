/* ---------- Ritocchi d'impaginazione, dopo la compilazione ----------
   Google Docs non sa ancorare un blocco al fondo della pagina. Per il preventivo lo si fa
   misurando il PDF esportato: si legge quanto spazio resta sotto l'ultima riga e lo si
   riempie con una riga vuota prima del blocco, poi si controlla che il blocco non sia
   passato alla pagina dopo. Serve anche pdf.js, che la copia di cortesia usa per leggere Fiscozen. */

import { api } from "./google.js";
import { esportaPdf } from "./drive.js";

const DOCS = "https://docs.googleapis.com/v1/documents/";
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/";

let pdfjs = null;
export async function caricaPdfjs(){
  if (!pdfjs){
    pdfjs = await import(PDFJS + "pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
  }
  return pdfjs;
}

const leggi = id => api(DOCS + encodeURIComponent(id));
const modifica = (id, requests) => requests.length && api(`${DOCS}${encodeURIComponent(id)}:batchUpdate`, {
  method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({requests})
});
const testo = el => el.paragraph.elements.map(e => e.textRun?.content ?? "").join("").trim();
const pt = m => ({magnitude: m, unit: "PT"});


/* Misura l'ultima pagina del PDF: quante pagine, e quanti punti restano liberi tra l'ultima
   riga del corpo e il piè di pagina. */
async function misura(blob){
  const lib = await caricaPdfjs();
  const pdf = await lib.getDocument({data: new Uint8Array(await blob.arrayBuffer())}).promise;
  const pag = await pdf.getPage(pdf.numPages);
  const pezzi = (await pag.getTextContent()).items.filter(i => i.str.trim());
  // Il piè di pagina ("filippomauro.com", "2 / 2") è la riga più bassa della pagina.
  // Non lo si riconosce dal testo: nel PDF "fi" è una legatura e la parola arriva spezzata.
  const yPiede = Math.min(...pezzi.map(i => i.transform[5]));
  const piede = pezzi.filter(i => i.transform[5] < yPiede + 3);
  const corpo = pezzi.filter(i => i.transform[5] >= yPiede + 3);
  if (!corpo.length) return {pagine: pdf.numPages, libero: 0};
  // y è la linea di base, dal fondo della pagina; la riga scende di circa un terzo dell'altezza.
  const fondo = Math.min(...corpo.map(i => i.transform[5] - Math.abs(i.transform[3]) * 0.3));
  const cima = piede.length ? Math.max(...piede.map(i => i.transform[5] + Math.abs(i.transform[3]))) : 40;
  // Il piè di pagina ha sopra un filetto e uno stacco: si lascia un margine.
  return {pagine: pdf.numPages, libero: Math.max(0, fondo - cima - MARGINE)};
}
const MARGINE = 4;

/* Il blocco che comincia con il titolo (es. "ACCETTAZIONE") scende fino a finire in fondo
   all'ultima pagina. Prima del titolo si mette una riga vuota e la si allunga con l'interlinea:
   lo spazio sopra un paragrafo, in cima a una pagina, Google lo ignora; una riga vuota no.
   Restituisce il PDF già esportato, da caricare al posto di un nuovo export. */
export async function allineaInFondo(id, titolo){
  const doc = await leggi(id);
  const par = doc.body.content.find(el => el.paragraph && testo(el) === titolo);
  let pdf = await esportaPdf(id);
  if (!par) return pdf;
  const prima = await misura(pdf);
  if (prima.libero < 6) return pdf;
  const s = par.startIndex, r = {startIndex: s, endIndex: s + 1};
  const interlinea = L => [{updateParagraphStyle: {range: r, paragraphStyle: {lineSpacing: L}, fields: "lineSpacing"}}];
  await modifica(id, [
    {insertText: {location: {index: s}, text: "\n"}},
    {updateParagraphStyle: {range: r, paragraphStyle: {spaceAbove: pt(0), spaceBelow: pt(0), lineSpacing: 100, keepWithNext: true}, fields: "spaceAbove,spaceBelow,lineSpacing,keepWithNext"}},
    {updateTextStyle: {range: r, textStyle: {fontSize: pt(10)}, fields: "fontSize"}}
  ]);
  // Quanto è alta la riga vuota a interlinea 100: da qui si ricava l'interlinea che serve.
  pdf = await esportaPdf(id);
  let m = await misura(pdf);
  const riga = prima.libero - m.libero;
  if (m.pagine !== prima.pagine || !(riga > 0)){
    await modifica(id, [{deleteContentRange: {range: r}}]);
    return esportaPdf(id);
  }
  // buono: interlinea che sta nella pagina; troppo: la più bassa che la fa sforare.
  let buono = {L: 100, pdf}, troppo = Infinity;
  for (let prova = 0; prova < 6 && m.libero > 4; prova++){
    let L = Math.round(buono.L + 100 * (m.libero - 2) / riga);
    if (L >= troppo) L = Math.round((buono.L + troppo) / 2);
    if (L <= buono.L) break;
    await modifica(id, interlinea(L));
    const nuovo = await esportaPdf(id), mn = await misura(nuovo);
    if (mn.pagine !== prima.pagine){ troppo = L; continue; }
    buono = {L, pdf: nuovo}; m = mn;
  }
  await modifica(id, interlinea(buono.L));
  return buono.pdf;
}

/* Le note a piè di pagina stanno insieme al titolo "NOTE" (nel template hanno "mantieni con il
   successivo"): l'ultima nota invece non deve legarsi a quello che viene dopo. */
export async function staccaUltimaNota(id){
  const doc = await leggi(id), corpo = doc.body.content;
  const i = corpo.findIndex(el => el.paragraph && testo(el) === "NOTE");
  if (i < 0) return;
  let ultima = null;
  for (let j = i + 1; j < corpo.length && corpo[j].paragraph; j++){
    const primo = corpo[j].paragraph.elements[0]?.textRun?.textStyle;
    if (primo?.baselineOffset !== "SUPERSCRIPT") break;
    ultima = corpo[j];
  }
  if (ultima) await modifica(id, [{updateParagraphStyle: {range: {startIndex: ultima.startIndex, endIndex: ultima.endIndex},
    paragraphStyle: {keepWithNext: false}, fields: "keepWithNext"}}]);
}
