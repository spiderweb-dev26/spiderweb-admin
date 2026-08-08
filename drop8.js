/* SPIDERWEB DROP 8 v6 — self-sufficient single-page pager for the sign modal */
(function () {
  "use strict";
  if (window.__DROP8__) return;
  window.__DROP8__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .pg-tag{font-family:"Bangers",cursive;letter-spacing:.08em;color:var(--mut);font-size:.85rem;margin:2px 0 -6px}
    #signModal .sw-pdfbox{max-height:70vh;overflow-y:auto!important;padding:10px;
      border:2px dashed var(--line);border-radius:14px;background:rgba(18,6,9,.35)}
    #signModal .sw-pdfbox div{max-height:none!important;min-height:0!important;overflow:visible!important}
    #signModal .sw-pdfbox canvas{width:100%!important;height:auto!important;max-height:none!important;
      object-fit:initial!important;display:none;border-radius:8px;box-shadow:4px 4px 0 rgba(0,0,0,.55);cursor:crosshair}
    #signModal .sw-pdfbox canvas.sw-cur{display:block}
    #signModal .sw-pdfbox .pg-tag{display:none}
    #signModal .sw-pdfbox .pg-tag.sw-cur{display:block}
    .sw-pager{display:flex;gap:12px;align-items:center;justify-content:center;margin:0 0 10px}
    .sw-pager button{border:2px solid var(--line);background:rgba(35,16,23,.7);color:var(--ink);
      border-radius:10px;padding:8px 14px;cursor:pointer;font-size:1rem}
    .sw-pager button:hover{border-color:rgba(230,36,46,.45)}
    .sw-pager button:disabled{opacity:.35;cursor:not-allowed}
    .sw-pager .sw-count{font-family:"Bangers",cursive;letter-spacing:.08em;color:var(--ink)}
  `;
  document.head.appendChild(style);

  let busy = false;
  let lastKey = "";

  function norm(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }

  function getContainer(modal) {
    const canvases = Array.from(modal.querySelectorAll("canvas"));
    if (canvases.length) {
      let box = canvases[0].parentElement;
      while (box && box !== modal && !canvases.every((c) => box.contains(c))) box = box.parentElement;
      if (box && box !== modal) { box.classList.add("sw-pdfbox"); return box; }
    }
    const caps = Array.from(modal.querySelectorAll("p,div,span")).filter((el) =>
      el.children.length === 0 && /preview shows/i.test(el.textContent || ""));
    if (caps[0] && caps[0].parentElement) { caps[0].parentElement.classList.add("sw-pdfbox"); return caps[0].parentElement; }
    return null;
  }

  function unclip(box) {
    [box].concat(Array.from(box.querySelectorAll("div"))).forEach((el) => {
      el.style.height = ""; el.style.maxHeight = ""; el.style.minHeight = ""; el.style.overflow = "";
    });
    Array.from(box.querySelectorAll("canvas")).forEach((c) => {
      c.style.width = "100%"; c.style.height = "auto"; c.style.maxHeight = "none"; c.style.objectFit = "initial";
    });
  }

  function tagPages(box) {
    Array.from(box.querySelectorAll("canvas")).forEach((c, i) => {
      if (!(c.previousElementSibling && c.previousElementSibling.classList.contains("pg-tag"))) {
        const t = document.createElement("div");
        t.className = "pg-tag";
        box.insertBefore(t, c);
      }
    });
    Array.from(box.querySelectorAll("canvas")).forEach((c, i) => {
      if (c.previousElementSibling && c.previousElementSibling.classList.contains("pg-tag")) {
        c.previousElementSibling.textContent = "PAGE " + (i + 1);
      }
    });
  }

  function findPdfUrl(modal) {
    let nt = norm((modal.querySelector(".modal-head h3") || {}).textContent || "");
    if (nt.indexOf("spiderweb") === 0) nt = nt.slice(9);
    if (!nt) return "";
    const anchors = Array.from(document.querySelectorAll('a[href*="supabase"], a[href*=".pdf"]'));
    for (const a of anchors) {
      const card = a.closest(".doc-card") || a.closest(".task-row") || a.parentElement;
      const txt = norm(card ? card.textContent : "");
      if (txt && (txt.includes(nt) || (nt.length > 8 && txt.includes(nt.slice(0, 12))))) return a.href;
    }
    return "";
  }

  async function renderPage(pdf, n) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1.4 });
    const c = document.createElement("canvas");
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    return c;
  }

  async function ensurePages(modal, box) {
    if (!window.pdfjsLib) return;
    const m = (modal.textContent || "").match(/first \d+ of (\d+)/i);
    const total = m ? parseInt(m[1], 10) : 0;
    const shown = box.querySelectorAll("canvas").length;
    if (total && shown >= total) return;
    const url = findPdfUrl(modal);
    if (!url) { console.warn("drop8: pdf url not found"); return; }
    try {
      const buf = await fetch(url).then((r) => r.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      if (shown === 0) {
        for (let n = 1; n <= pdf.numPages; n++) {
          const t = document.createElement("div"); t.className = "pg-tag";
          box.appendChild(t);
          box.appendChild(await renderPage(pdf, n));
        }
      } else {
        for (let n = shown + 1; n <= pdf.numPages; n++) {
          const t = document.createElement("div"); t.className = "pg-tag";
          box.appendChild(t);
          box.appendChild(await renderPage(pdf, n));
        }
      }
    } catch (e) { console.warn("drop8 render failed:", e); }
  }

  function buildPager(box) {
    if (!box.querySelectorAll("canvas").length) return;
    if (!box.parentElement.querySelector(".sw-pager")) {
      const bar = document.createElement("div");
      bar.className = "sw-pager";
      bar.innerHTML = '<button type="button" data-pg="prev">◀</button><span class="sw-count"></span><button type="button" data-pg="next">▶</button>';
      box.parentElement.insertBefore(bar, box);
      bar.querySelector('[data-pg="prev"]').addEventListener("click", () => step(box, -1));
      bar.querySelector('[data-pg="next"]').addEventListener("click", () => step(box, 1));
    }
    show(box, parseInt(box.dataset.cur || "0", 10));
  }

  function show(box, i) {
    const canvases = Array.from(box.querySelectorAll("canvas"));
    if (!canvases.length) return;
    i = Math.max(0, Math.min(canvases.length - 1, i));
    box.dataset.cur = i;
    canvases.forEach((c, k) => {
      c.classList.toggle("sw-cur", k === i);
      const tag = c.previousElementSibling;
      if (tag && tag.classList.contains("pg-tag")) tag.classList.toggle("sw-cur", k === i);
    });
    const bar = box.parentElement.querySelector(".sw-pager");
    if (bar) {
      bar.querySelector(".sw-count").textContent = "PAGE " + (i + 1) + " OF " + canvases.length;
      bar.querySelector('[data-pg="prev"]').disabled = i === 0;
      bar.querySelector('[data-pg="next"]').disabled = i === canvases.length - 1;
    }
    box.scrollTop = 0;
  }
  function step(box, d) { show(box, parseInt(box.dataset.cur || "0", 10) + d); }

  async function fix() {
    const modal = document.getElementById("signModal");
    if (!modal || modal.classList.contains("hidden") || busy) return;
    const box = getContainer(modal);
    if (!box) return;
    unclip(box);
    const key = ((modal.querySelector(".modal-head h3") || {}).textContent || "") + "|" + box.querySelectorAll("canvas").length;
    if (key !== lastKey) {
      lastKey = key;
      busy = true;
      await ensurePages(modal, box);
      unclip(box);
      tagPages(box);
      busy = false;
    } else {
      tagPages(box);
    }
    buildPager(box);
  }

  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("signModal");
    if (!modal || modal.classList.contains("hidden")) return;
    const box = modal.querySelector(".sw-pdfbox");
    if (!box) return;
    if (e.key === "ArrowLeft") step(box, -1);
    if (e.key === "ArrowRight") step(box, 1);
  });

  const modal = document.getElementById("signModal");
  if (modal) {
    new MutationObserver(() => setTimeout(fix, 300)).observe(modal, { subtree: true, childList: true, attributes: true });
  }

  console.log("SPIDERWEB Drop 8 v6 loaded.");
})();
/* SPIDERWEB-DROP8-END */
