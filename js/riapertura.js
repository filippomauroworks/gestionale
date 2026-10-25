/* ---------- Riapertura e versioni ----------
   "Modifica" dall'elenco, oppure "Carica PDF": l'app legge codice, tipo e versione
   dal nome del file e riapre la procedura con i dati salvati di quella versione.
   Il salvataggio crea sempre la versione successiva: numero più alto in archivio + 1,
   non quello del file aperto + 1. Il codice non cambia mai. */

import { esc, modal, toast } from "./util.js";
import { trova, datiVersione, rileggi } from "./registro.js";
import { nomeFile } from "./nomi.js";
import { gestisciErrore } from "./errori.js";

const pad2 = n => String(n).padStart(2, "0");
// [pagina, sezione, nome, "un …", "nessun … salvato", "del …"]
const SEZIONE = {
  ATT: ["attrezzatura", "Attrezzatura", "lista attrezzatura", "una lista attrezzatura", "nessuna lista attrezzatura salvata", "della lista attrezzatura"],
  PRV: ["preventivi", "Preventivi", "preventivo", "un preventivo", "nessun preventivo salvato", "del preventivo"],
  CTR: ["contratti", "Contratti", "contratto", "un contratto", "nessun contratto salvato", "del contratto"]
};

// Ogni procedura registra qui la funzione che la riapre con i dati salvati.
const apritori = {};
export const registraApritore = (tipo, fn) => { apritori[tipo] = fn; };

export const ultimaVersione = d => Math.max(...d.versioni.map(x => x.v));

/* Chiede conferma e riapre la versione v del documento d. */
export function apriModifica(d, v = ultimaVersione(d)){
  const s = SEZIONE[d.tipo], ult = ultimaVersione(d), nuova = ult + 1;
  const nome = nomeFile({codice: d.codice, tipo: d.tipo, titolo: d.titolo, cliente: d.cliente?.nome, versione: nuova});
  modal(`Modifica ${s[2]} ${esc(d.codice)}`,
    `<p>Stai aprendo la <strong>V${pad2(v)}</strong>${v < ult ? `, ma in archivio c’è già la <strong>V${pad2(ult)}</strong>: le modifiche partono dalla V${pad2(v)}` : ""}.</p>
     <p>Dopo le modifiche verrà salvato come:</p><p class="fname"><strong>${esc(nome)}.pdf</strong></p>
     <p class="muted" style="font-size:13px">Il nome finale tiene conto di eventuali cambi di titolo o cliente. Le versioni precedenti restano in archivio.</p>`,
    [{label: "Annulla"}, {label: "Apri per modificare", primary: true, fn: async () => {
      try {
        const dati = await datiVersione(d, v);
        if (!dati){ toast(`La V${pad2(v)} non ha dati salvati: non si può riaprire.`); return; }
        apritori[d.tipo](d, v, dati);
      } catch(e){ gestisciErrore(e); }
    }}]);
}

/* "Carica PDF" in una sezione: dal nome del file al documento in archivio. */
export function caricaPdf(tipoSezione){
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/pdf,.pdf";
  inp.onchange = () => { const f = inp.files[0]; if (f) daNomeFile(f.name, tipoSezione); };
  inp.click();
}

// Dal nome di un PDF creato dall'app al documento in archivio (anche "file (1).pdf" scaricati due volte).
export async function daNomeFile(nomeFile, tipoSezione){
  const f = {name: nomeFile.replace(/\s*\(\d+\)(?=\.pdf$)/i, "")};
  const m = f.name.replace(/\.pdf$/i, "").match(/^(\d{4}-\d{3})_(PRV|CTR|ATT)_.+?(?:_Dettaglio)?(?:_V(\d{2}))?$/);
  if (!m) return modal("Codice documento non trovato",
    `<p>Il nome <strong class="fname">${esc(f.name)}</strong> non contiene un codice documento. I file creati dall’app si chiamano, ad esempio, <span class="fname">2026-014_CTR_Progetto_Cliente_FilippoMauro.pdf</span>.</p><p>Puoi anche scegliere il documento dall’elenco e premere “Modifica”.</p>`,
    [{label: "Chiudi", primary: true}]);
  const [, codice, tipo, ver] = m;
  if (tipo !== tipoSezione){
    const o = SEZIONE[tipo];
    return modal("Documento di un’altra sezione", `<p>Questo file è ${o[3]}. Caricalo dalla sezione ${o[1]}.</p>`,
      [{label: "Chiudi"}, {label: "Vai a " + o[1], primary: true, fn: () => { location.hash = o[0]; }}]);
  }
  try {
    await rileggi();
    const d = trova(codice, tipo);
    if (!d) return modal("Documento non in archivio", `<p>Il codice ${esc(codice)} non corrisponde a ${SEZIONE[tipo][4]}.</p>`, [{label: "Chiudi", primary: true}]);
    const v = ver ? +ver : 1;
    if (!d.versioni.some(x => x.v === v)) return modal("Versione non in archivio", `<p>${SEZIONE[tipo][5].replace(/^d/, "D")} ${esc(codice)} non c’è la V${pad2(v)} in archivio.</p>`, [{label: "Chiudi", primary: true}]);
    apriModifica(d, v);
  } catch(e){ gestisciErrore(e); }
}

// Avviso in testa alla procedura quando si modifica un documento.
export const avvisoModifica = (edit, dopo) => edit
  ? `<div class="note" style="margin-bottom:18px">Stai modificando la V${pad2(edit.v)} ${edit.cosa} ${esc(edit.codice)}. Verrà salvato come nuova versione${dopo ? `: ${dopo}` : ""}; le precedenti restano in archivio.</div>`
  : "";
