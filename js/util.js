/* ---------- Utilità comuni ---------- */

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// localStorage protetto: in navigazione privata può mancare o lanciare errori.
export const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};

let toastT;
export function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 2800);
}

/* Modale: buttons = [{label, primary, fn}]. Il tasto senza fn chiude e basta. */
let modalFns = [];
export function modal(title, body, buttons){
  closeModal();
  modalFns = buttons.map(b => b.fn || null);
  const el = document.createElement("div");
  el.className = "modal-back"; el.id = "modal";
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt">${title}</h2>${body}
    <div class="actions">${buttons.map((b,i) => `<button class="btn ${b.primary ? "primary" : ""}" data-modal-btn="${i}">${b.label}</button>`).join("")}</div></div>`;
  document.body.appendChild(el);
  (el.querySelector(".btn.primary") || el.querySelector(".btn")).focus();
}
export function closeModal(){ const m = $("#modal"); if (m) m.remove(); }
document.addEventListener("click", e => {
  const b = e.target.closest("[data-modal-btn]");
  if (!b) return;
  const fn = modalFns[+b.dataset.modalBtn];
  closeModal();
  if (fn) fn();
});

// Ritarda una funzione finché l'utente smette di scrivere.
export function debounce(fn, ms){
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
