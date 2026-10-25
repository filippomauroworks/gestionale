/* ---------- Gestione degli errori ----------
   La sessione scaduta chiede un nuovo accesso con un clic (serve un gesto dell'utente
   per aprire il popup di Google); un foglio da sistemare porta alle Impostazioni;
   gli altri errori diventano un avviso. app.js imposta i ganci all'avvio. */

import { modal, toast, esc } from "./util.js";
import { accedi, esci, SessioneScaduta } from "./google.js";

const ganci = {dopoAccesso: () => {}, uscita: () => {}};
export const impostaGanci = g => Object.assign(ganci, g);

export function gestisciErrore(e, riprova){
  console.error(e);
  if (e instanceof SessioneScaduta){
    modal("Sessione scaduta", "<p>L’accesso a Google dura un’ora. Accedi di nuovo per continuare: non si perde nulla.</p>",
      [{label: "Esci", fn: () => { esci(); ganci.uscita(); }},
       {label: "Accedi", primary: true, fn: () => accedi().then(riprova || ganci.dopoAccesso).catch(err => toast(err.message))}]);
  } else if (e.name === "FoglioMancante" || e.name === "CollegamentoMancante"){
    modal("Manca qualcosa in Impostazioni", `<p>${esc(e.message)}</p>`,
      [{label: "Chiudi"}, {label: "Vai alle Impostazioni", primary: true, fn: () => { location.hash = "impostazioni"; }}]);
  } else toast(e.message);
}

// Un file o una cartella da scegliere in Impostazioni prima di procedere.
export class CollegamentoMancante extends Error {
  constructor(nome){ super(`Scegli “${nome}” in Impostazioni prima di continuare.`); this.name = "CollegamentoMancante"; }
}
