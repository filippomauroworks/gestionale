/* ---------- Motore dei template su Google Docs ----------
   Riempie una copia di un template. Regole (vedi template/Guida ai template.md):
   - {{NOME}}            sostituzione semplice, con lo stile del segnaposto;
   - {{NOME?}}           facoltativo: se vuoto si toglie il paragrafo, o la riga di tabella
                         se il paragrafo è l'unico contenuto della riga;
   - {{ELENCO.CAMPO}}    riga di tabella o paragrafo ripetuto per ogni elemento;
                         due righe consecutive (GRUPPO, poi ELEMENTO) fanno un elenco a due livelli;
   - {{CONDIZIONE}}      un segnaposto senza punto il cui valore è un elenco ripete il paragrafo;
   - {{#BLOCCO}}…{{/BLOCCO}} paragrafi tolti, o tolti con tutto quello che c'è in mezzo.

   Dati: {NOME: "testo", ELENCO: [{CAMPO: "…", FIGLIO: [{…}]}], CONDIZIONE: ["…"], BLOCCO: true}.

   Il lavoro è diviso in fasi; tra una fase e l'altra si rilegge il documento,
   così gli indici sono sempre quelli veri. Dentro una fase le modifiche vanno
   dal fondo verso l'inizio, così una modifica non sposta le successive. */

import { api } from "./google.js";

const DOCS = "https://docs.googleapis.com/v1/documents/";
const RE = /\{\{([#/]?)([A-Z0-9_]+)(?:\.([A-Z0-9_]+))?(\?)?\}\}/g;

const leggi = id => api(DOCS + encodeURIComponent(id));
async function modifica(id, requests){
  if (!requests.length) return;
  // Google accetta molte richieste per chiamata, ma a blocchi l'errore è più leggibile.
  for (let i = 0; i < requests.length; i += 400)
    await api(`${DOCS}${encodeURIComponent(id)}:batchUpdate`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({requests: requests.slice(i, i + 400)})
    });
}

/* ---------- Lettura della struttura ---------- */

const testoPar = p => p.paragraph.elements.map(e => e.textRun?.content ?? "").join("");
const segnaposti = t => [...t.matchAll(RE)].map(m => ({tutto: m[0], blocco: m[1], nome: m[2], campo: m[3], facolt: !!m[4]}));
const stringa = v => v === null || v === undefined ? "" : String(v);
const vuoto = v => v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && !v.length);

// Tutti i paragrafi del corpo, anche dentro le tabelle, con il loro contenitore.
function paragrafiCorpo(doc){
  const out = [];
  const giro = (content, cont) => content.forEach((el, i) => {
    if (el.paragraph) out.push({el, cont, i});
    else if (el.table) el.table.tableRows.forEach((r, ri) => r.tableCells.forEach(c =>
      giro(c.content, {cella: c, riga: r, ri, tabella: el})));
  });
  giro(doc.body.content, {corpo: doc.body.content});
  return out;
}
const fratelli = cont => cont.corpo || cont.cella.content;

/* ---------- Cancellazioni sicure ----------
   Google Docs non permette di cancellare l'ultimo a capo di una cella o del corpo,
   né l'a capo che precede una tabella. In quei casi si toglie l'a capo del paragrafo
   precedente (che poi riprende il suo stile), oppure si svuota soltanto il testo. */

function cancellaParagrafo(p){
  const lista = fratelli(p.cont), prima = lista[p.i - 1], dopo = lista[p.i + 1];
  const {startIndex: s, endIndex: e} = p.el;
  if (dopo && !dopo.table) return [del(s, e)];
  if (prima?.paragraph) return [del(prima.endIndex - 1, e - 1), ...stilePar(prima.paragraph.paragraphStyle, prima.startIndex, prima.startIndex + 1, !!p.cont.cella, false)];
  return e - 1 > s ? [del(s, e - 1)] : [];
}

// Da a (incluso) a b (incluso): due paragrafi dello stesso contenitore.
function cancellaTratto(lista, a, b){
  const prima = lista[a - 1], dopo = lista[b + 1];
  const s = lista[a].startIndex, e = lista[b].endIndex;
  if (dopo && !dopo.table) return [del(s, e)];
  if (prima?.paragraph) return [del(prima.endIndex - 1, e - 1)];
  return e - 1 > s ? [del(s, e - 1)] : [];
}

const del = (s, e) => ({deleteContentRange: {range: {startIndex: s, endIndex: e}}});

/* ---------- Stili ---------- */

const CAMPI_PAR = ["namedStyleType","alignment","lineSpacing","spaceAbove","spaceBelow","indentStart","indentEnd","indentFirstLine","keepWithNext","keepLinesTogether"];
const CAMPI_PAR_SE_CI = ["direction","spacingMode","avoidWidowAndOrphan","shading","borderBetween","borderTop","borderBottom","borderLeft","borderRight"];
// conNome = false: non tocca lo stile con nome, che azzererebbe la formattazione del testo già scritto.
function stilePar(stile = {}, s, e, inCella, conNome = true){
  const campi = CAMPI_PAR.filter(k => conNome || k !== "namedStyleType").concat(CAMPI_PAR_SE_CI.filter(k => k in stile));
  const st = Object.fromEntries(campi.filter(k => k in stile).map(k => [k, stile[k]]));
  if (!inCella && "pageBreakBefore" in stile){ campi.push("pageBreakBefore"); st.pageBreakBefore = stile.pageBreakBefore; }
  return [{updateParagraphStyle: {range: {startIndex: s, endIndex: e}, paragraphStyle: st, fields: campi.join(",")}}];
}
const stileTesto = (stile, s, e) => e > s ? [{updateTextStyle: {range: {startIndex: s, endIndex: e}, textStyle: stile || {}, fields: "*"}}] : [];

/* Celle "di testa" di una riga: Google elenca una cella per colonna, anche quelle
   coperte da un'unione (con span 1). La colonna di una cella è la sua posizione. */
function celleTesta(riga){
  const out = [];
  for (let c = 0; c < riga.tableCells.length; ){
    const cella = riga.tableCells[c], span = Math.max(cella.tableCellStyle?.columnSpan ?? 1, 1);
    out.push({c, span, cella});
    c += span;
  }
  return out;
}

const CAMPI_CELLA = ["backgroundColor","borderLeft","borderRight","borderTop","borderBottom","paddingLeft","paddingRight","paddingTop","paddingBottom","contentAlignment"];

/* Un paragrafo modello diventa un elenco di "pezzi" {testo, stile}: i segnaposto
   prendono lo stile del pezzo in cui cominciano. valore(s) dà il testo di un segnaposto. */
function componi(par, valore){
  const pezzi = [];
  const runs = par.elements.filter(e => e.textRun).map(e => ({t: e.textRun.content.replace(/\n$/, ""), st: e.textRun.textStyle}));
  const tutto = runs.map(r => r.t).join("");
  const stileA = pos => { let n = 0; for (const r of runs){ n += r.t.length; if (pos < n) return r.st; } return runs[runs.length - 1]?.st; };
  let pos = 0;
  for (const m of tutto.matchAll(RE)){
    // Testo fisso prima del segnaposto, run per run.
    let k = pos, n = 0;
    for (const r of runs){
      const a = Math.max(n, k), b = Math.min(n + r.t.length, m.index);
      if (b > a) pezzi.push({testo: tutto.slice(a, b), stile: r.st});
      n += r.t.length;
    }
    pezzi.push({testo: valore(segnaposti(m[0])[0]), stile: stileA(m.index)});
    pos = m.index + m[0].length;
  }
  let n = 0;
  for (const r of runs){
    const a = Math.max(n, pos), b = n + r.t.length;
    if (b > a) pezzi.push({testo: tutto.slice(a, b), stile: r.st});
    n += r.t.length;
  }
  return pezzi;
}

/* Scrive una serie di paragrafi (ognuno un elenco di pezzi) in un punto vuoto.
   Gli a capo inseriti dividono il paragrafo esistente, che conserva stile e tabulazioni;
   modelli: stile di paragrafo da applicare a ciascuno (o null per lasciare quello che c'è). */
function scrivi(pos, paragrafi, modelli, inCella){
  const testo = paragrafi.map(p => p.map(x => x.testo).join("")).join("\n");
  // Prima lo stile di paragrafo: cambiare lo stile con nome azzera la formattazione del testo.
  const req = [], testi = [];
  if (testo) req.push({insertText: {location: {index: pos}, text: testo}});
  let i = pos;
  paragrafi.forEach((p, k) => {
    const inizio = i;
    for (const x of p){ testi.push(...stileTesto(x.stile, i, i + x.testo.length)); i += x.testo.length; }
    if (modelli?.[k]) req.push(...stilePar(modelli[k], inizio, i + 1, inCella));
    i += 1;
  });
  return req.concat(testi);
}

/* ---------- Fase 1: blocchi ---------- */

function fasiBlocchi(doc, dati){
  const lista = doc.body.content, req = [], aperti = {};
  lista.forEach((el, i) => {
    if (!el.paragraph) return;
    const s = segnaposti(testoPar(el)).find(x => x.blocco);
    if (!s) return;
    if (s.blocco === "#") aperti[s.nome] = i;
    else if (aperti[s.nome] !== undefined){ req.push({a: aperti[s.nome], b: i, attivo: !vuoto(dati[s.nome])}); delete aperti[s.nome]; }
  });
  const out = [];
  // Dal fondo: ogni cancellazione non sposta quelle prima.
  req.sort((x, y) => y.a - x.a).forEach(({a, b, attivo}) => {
    if (attivo){
      out.push(...cancellaParagrafo({el: lista[b], cont: {corpo: lista}, i: b}));
      out.push(...cancellaParagrafo({el: lista[a], cont: {corpo: lista}, i: a}));
    } else out.push(...cancellaTratto(lista, a, b));
  });
  return out;
}

/* ---------- Fase 2: righe di tabella ripetute ---------- */

// Elenchi e segnaposti semplici di una riga di tabella.
function analizzaRiga(riga, dati){
  const elenchi = new Set(); let semplici = false;
  for (const c of riga.tableCells) for (const el of c.content) if (el.paragraph)
    for (const s of segnaposti(testoPar(el))){
      if (s.blocco) continue;
      if (s.campo || Array.isArray(dati[s.nome])) elenchi.add(s.nome); else semplici = true;
    }
  return {elenchi: [...elenchi], semplici};
}

/* Trova le righe da ripetere. Una riga si ripete se contiene un solo elenco e nessun
   segnaposto semplice; altrimenti gli elenchi al suo interno sono paragrafi ripetuti. */
function trovaRipetizioni(doc, dati){
  const out = [];
  doc.body.content.forEach(el => {
    if (!el.table) return;
    const righe = el.table.tableRows;
    for (let r = 0; r < righe.length; r++){
      const a = analizzaRiga(righe[r], dati);
      if (a.elenchi.length !== 1 || a.semplici) continue;
      const g = a.elenchi[0];
      const b = righe[r + 1] && analizzaRiga(righe[r + 1], dati);
      if (b && b.elenchi.length === 1 && !b.semplici && !Array.isArray(dati[b.elenchi[0]])){
        out.push({tabella: el, r, gruppo: g, figlio: b.elenchi[0], gruppi: Array.isArray(dati[g]) ? dati[g] : []});
        r++;
      } else out.push({tabella: el, r, gruppo: g, figlio: null, gruppi: Array.isArray(dati[g]) ? dati[g] : []});
    }
  });
  return out;
}

/* Piano della tabella dopo la ripetizione: per ogni riga, quale riga modello usa e con quali valori.
   Le righe di gruppo vengono create accanto alla riga modello del gruppo; le righe figlie sotto
   il loro gruppo e poi rese uguali alla riga modello figlia (stili, celle unite). */
function piano(rip, dati){
  const righe = [];
  if (!rip.figlio) rip.gruppi.forEach(x => righe.push({modello: 0, el: x}));
  else rip.gruppi.forEach(gr => {
    righe.push({modello: 0, el: gr});
    (Array.isArray(gr[rip.figlio]) ? gr[rip.figlio] : []).forEach(x => righe.push({modello: 1, el: x}));
  });
  return righe;
}

async function fasiTabelle(id, dati){
  let doc = await leggi(id);
  let rips = trovaRipetizioni(doc, dati);
  if (!rips.length) return;
  const tabelle = doc.body.content.filter(el => el.table);
  rips.forEach(rip => { rip.tabellaIdx = tabelle.indexOf(rip.tabella); rip.start = rip.tabella.startIndex; });

  // I modelli si leggono adesso, prima che le righe cambino.
  const modelli = rips.map(rip => [0, 1].slice(0, rip.figlio ? 2 : 1).map(k => rip.tabella.table.tableRows[rip.r + k]));
  const piani = rips.map(rip => piano(rip, dati));

  // A. Righe di gruppo (o righe semplici) sotto la riga modello. Tabelle dal fondo.
  let req = [];
  rips.slice().reverse().forEach(rip => {
    const loc = r => ({tableStartLocation: {index: rip.start}, rowIndex: r, columnIndex: 0});
    for (let k = 1; k < rip.gruppi.length; k++) req.push({insertTableRow: {tableCellLocation: loc(rip.r), insertBelow: true}});
  });
  await modifica(id, req);

  // B. Righe figlie sotto ciascun gruppo; poi via la riga modello figlia. Righe vuote se n = 0.
  doc = await leggi(id); rips = trovaRipetizioni2(doc, rips);
  req = [];
  rips.slice().reverse().forEach(rip => {
    const n = rip.gruppi.length;
    const loc = r => ({tableStartLocation: {index: rip.start}, rowIndex: r, columnIndex: 0});
    if (rip.figlio){
      req.push({deleteTableRow: {tableCellLocation: loc(rip.r + Math.max(n, 1))}});
      for (let k = n - 1; k >= 0; k--){
        const figli = Array.isArray(rip.gruppi[k][rip.figlio]) ? rip.gruppi[k][rip.figlio].length : 0;
        for (let f = 0; f < figli; f++) req.push({insertTableRow: {tableCellLocation: loc(rip.r + k), insertBelow: true}});
      }
    }
    if (n === 0) req.push({deleteTableRow: {tableCellLocation: loc(rip.r)}});
  });
  await modifica(id, req);

  // C. Struttura e stile di ogni riga uguali a quelli della sua riga modello.
  doc = await leggi(id); rips = trovaRipetizioni2(doc, rips);
  req = [];
  rips.forEach((rip, j) => {
    const tab = trovaTabella(doc, rip.start), mod = modelli[j];
    piani[j].forEach((p, k) => {
      const riga = tab.table.tableRows[rip.r + k], m = mod[p.modello];
      const loc = c => ({tableStartLocation: {index: rip.start}, rowIndex: rip.r + k, columnIndex: c});
      const firma = r => celleTesta(r).map(x => x.c + ":" + x.span).join(",");
      if (firma(riga) !== firma(m)){
        req.push({unmergeTableCells: {tableRange: {tableCellLocation: loc(0), rowSpan: 1, columnSpan: tab.table.columns}}});
        celleTesta(m).filter(x => x.span > 1).forEach(x =>
          req.push({mergeTableCells: {tableRange: {tableCellLocation: loc(x.c), rowSpan: 1, columnSpan: x.span}}}));
      }
      // Le righe nate dal proprio modello hanno già il suo stile. Il bordo superiore
      // è in comune con la riga sopra: lo decide la riga sopra (il suo bordo inferiore).
      if (p.modello === 0) return;
      celleTesta(m).forEach(({c, span, cella}) => {
        const st = cella.tableCellStyle || {}, campi = CAMPI_CELLA.filter(f => f in st && f !== "borderTop");
        if (campi.length) req.push({updateTableCellStyle: {tableRange: {tableCellLocation: loc(c), rowSpan: 1, columnSpan: span},
          tableCellStyle: Object.fromEntries(campi.map(f => [f, st[f]])), fields: campi.join(",")}});
      });
      const rs = m.tableRowStyle || {};
      if ("minRowHeight" in rs) req.push({updateTableRowStyle: {tableStartLocation: {index: rip.start}, rowIndices: [rip.r + k], tableRowStyle: {minRowHeight: rs.minRowHeight}, fields: "minRowHeight"}});
    });
  });
  await modifica(id, req);

  // D. Testo: ogni cella riscritta dal modello con i valori. Dal fondo del documento.
  doc = await leggi(id); rips = trovaRipetizioni2(doc, rips);
  const celle = [];
  rips.forEach((rip, j) => {
    const tab = trovaTabella(doc, rip.start);
    piani[j].forEach((p, k) => {
      const riga = tab.table.tableRows[rip.r + k], m = modelli[j][p.modello];
      const valore = s => s.campo ? stringa(p.el?.[s.campo]) : stringa(dati[s.nome]);
      celleTesta(riga).forEach(({c, cella}) => {
        const mc = m.tableCells[c];
        if (!mc) return;
        const pars = mc.content.filter(e => e.paragraph);
        celle.push({cella, paragrafi: pars.map(e => componi(e.paragraph, valore)), stili: pars.map(e => e.paragraph.paragraphStyle)});
      });
    });
  });
  req = [];
  celle.sort((a, b) => b.cella.startIndex - a.cella.startIndex).forEach(({cella, paragrafi, stili}) => {
    const primo = cella.content[0], ultimo = cella.content[cella.content.length - 1];
    if (ultimo.endIndex - 1 > primo.startIndex) req.push(del(primo.startIndex, ultimo.endIndex - 1));
    req.push(...scrivi(primo.startIndex, paragrafi, stili, true));
  });
  await modifica(id, req);
}

const trovaTabella = (doc, start) => doc.body.content.find(el => el.table && el.startIndex === start);

/* Dopo una modifica le tabelle si spostano: le ritrova per posizione
   (in queste fasi le tabelle non si creano né si cancellano). */
function trovaRipetizioni2(doc, rips){
  const tabelle = doc.body.content.filter(el => el.table);
  rips.forEach(rip => { rip.start = tabelle[rip.tabellaIdx].startIndex; });
  return rips;
}

/* ---------- Fase 3: paragrafi ripetuti ---------- */

function fasiParagrafi(doc, dati){
  const req = [];
  paragrafiCorpo(doc).reverse().forEach(p => {
    const ss = segnaposti(testoPar(p.el)).filter(s => !s.blocco);
    const el = ss.find(s => s.campo || Array.isArray(dati[s.nome]));
    if (!el) return;
    const elementi = Array.isArray(dati[el.nome]) ? dati[el.nome] : [];
    if (!elementi.length){ req.push(...cancellaParagrafo(p)); return; }
    const pars = elementi.map(x => componi(p.el.paragraph, s =>
      s.nome === el.nome ? (s.campo ? stringa(x?.[s.campo]) : stringa(x)) : (Array.isArray(dati[s.nome]) ? "" : stringa(dati[s.nome]))));
    const {startIndex: s, endIndex: e} = p.el;
    if (e - 1 > s) req.push(del(s, e - 1));
    req.push(...scrivi(s, pars, null, !!p.cont.cella));
  });
  return req;
}

/* ---------- Fase 4: facoltativi vuoti ---------- */

function fasiFacoltativi(doc, dati){
  const req = [], righeTolte = new Set();
  paragrafiCorpo(doc).reverse().forEach(p => {
    const ss = segnaposti(testoPar(p.el));
    if (!ss.some(s => s.facolt && !s.campo && vuoto(dati[s.nome]))) return;
    if (p.cont.cella){
      // Unico contenuto della riga: si toglie la riga intera.
      const piene = p.cont.riga.tableCells.flatMap(c => c.content).filter(e => e.paragraph && testoPar(e).trim());
      if (piene.length === 1 && p.cont.tabella.table.tableRows.length > 1){
        const k = p.cont.tabella.startIndex + ":" + p.cont.ri;
        if (!righeTolte.has(k)){ righeTolte.add(k); req.push({deleteTableRow: {tableCellLocation: {tableStartLocation: {index: p.cont.tabella.startIndex}, rowIndex: p.cont.ri, columnIndex: 0}}}); }
        return;
      }
    }
    req.push(...cancellaParagrafo(p));
  });
  return req;
}

/* ---------- Fase 5: sostituzioni semplici (anche intestazioni e piè di pagina) ---------- */

function testoTutto(doc){
  const pezzi = [];
  const giro = content => (content || []).forEach(el => {
    if (el.paragraph) pezzi.push(testoPar(el));
    else if (el.table) el.table.tableRows.forEach(r => r.tableCells.forEach(c => giro(c.content)));
  });
  giro(doc.body.content);
  Object.values(doc.headers || {}).forEach(h => giro(h.content));
  Object.values(doc.footers || {}).forEach(f => giro(f.content));
  return pezzi.join("\n");
}

function fasiSemplici(doc, dati){
  const visti = new Set(segnaposti(testoTutto(doc)).filter(s => !s.blocco && !s.campo).map(s => s.tutto));
  return [...visti].map(t => {
    const s = segnaposti(t)[0];
    const v = Array.isArray(dati[s.nome]) ? "" : stringa(dati[s.nome]);
    return {replaceAllText: {containsText: {text: t, matchCase: true}, replaceText: v}};
  });
}

/* ---------- Ingresso ---------- */

/* Applica i dati al documento (già copiato dal template).
   Restituisce {rimasti: [segnaposti non sostituiti], link: true/false}. */
export async function applica(id, dati){
  let doc = await leggi(id);
  await modifica(id, fasiBlocchi(doc, dati));
  await fasiTabelle(id, dati);
  doc = await leggi(id);
  await modifica(id, fasiParagrafi(doc, dati));
  doc = await leggi(id);
  await modifica(id, fasiFacoltativi(doc, dati));
  doc = await leggi(id);
  await modifica(id, fasiSemplici(doc, dati));
  doc = await leggi(id);
  const rimasti = [...new Set((testoTutto(doc).match(/\{\{[^}]*\}\}/g) || []))];
  const link = JSON.stringify(doc).includes("filippomauro.com");
  return {rimasti, link};
}
