/* ---------- Elenco dei documenti (comune a tutte le sezioni) ---------- */

import { esc } from "./util.js";
import { api } from "./google.js";
import { ultima } from "./registro.js";
import { dataBreve } from "./calcoli.js";

const pad2 = n => String(n).padStart(2, "0");
const SING = {ATT: "lista attrezzatura", PRV: "preventivo", CTR: "contratto", CDC: "copia di cortesia"};

// Le copie di cortesia non si modificano: si carica il PDF corretto con "Nuova versione".
const MODIFICABILI = ["ATT", "PRV", "CTR"];

export const linkDoc = id => `https://docs.google.com/document/d/${encodeURIComponent(id)}/edit`;

/* Una riga dell'elenco. extra: HTML di tasti in più (es. Trello). conSezione: per la Home. */
export function rigaDocumento(d, {extra = "", conSezione = false} = {}){
  const u = ultima(d), cliente = d.cliente?.nome || "Lavoro personale";
  return `<div class="doc" data-search="${esc((d.codice + " " + d.titolo + " " + cliente).toLowerCase())}">
    <div class="doc-row">
      <div class="c-main"><span class="code">${esc(d.codice)}</span><div><div class="doc-title">${esc(d.titolo)}</div><div class="doc-client">${esc(cliente)}${conSezione ? ", " + SING[d.tipo] : ""}</div></div></div>
      <div class="c-date">${dataBreve(u.data)}</div>
      <span class="vbadge" title="Versione">V${pad2(u.v)}</span>
      <div class="c-act">
        ${extra}
        ${MODIFICABILI.includes(d.tipo) ? `<button class="btn small" data-action="modifica" data-codice="${esc(d.codice)}" data-tipo="${d.tipo}" data-v="${u.v}">Modifica</button>` : ""}
        <a class="btn small" href="${linkDoc(u.doc)}" target="_blank" rel="noopener">Doc</a>
        <button class="btn small" data-action="scarica-pdf" data-id="${esc(u.pdf)}" data-nome="${esc(u.nome)}">PDF</button>
      </div>
    </div>
    ${d.versioni.length > 1 ? `<details class="versions"><summary>${d.versioni.length} versioni</summary><ul class="vlist">${
      d.versioni.slice().reverse().map(v => `<li><span class="fname">${esc(v.nome)}.pdf</span><span class="muted">${dataBreve(v.data)} · <a href="${linkDoc(v.doc)}" target="_blank" rel="noopener">Doc</a> · <a href="#" data-action="scarica-pdf" data-id="${esc(v.pdf)}" data-nome="${esc(v.nome)}">PDF</a>${MODIFICABILI.includes(d.tipo) ? ` · <a href="#" data-action="modifica" data-codice="${esc(d.codice)}" data-tipo="${d.tipo}" data-v="${v.v}">Modifica</a>` : ""}</span></li>`).join("")
    }</ul></details>` : ""}
  </div>`;
}

// Filtro della ricerca nell'elenco.
export function filtra(q){
  q = q.toLowerCase().trim();
  document.querySelectorAll("#docs .doc").forEach(r => { r.hidden = !!q && !r.dataset.search.includes(q); });
}

// Scarica un PDF di Drive con il suo nome.
export async function scaricaPdf(id, nome){
  const r = await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {raw: true});
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url; a.download = nome.endsWith(".pdf") ? nome : nome + ".pdf";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
