/* SPIDERWEB DROP 8 v2 — scrollable PDF preview (safe caption handling) */
(function () {
  "use strict";
  if (window.__DROP8__) return;
  window.__DROP8__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .pg-tag{font-family:"Bangers",cursive;letter-spacing:.08em;color:var(--mut);font-size:.85rem;margin:2px 0 -6px}
    #signModal .sw-pdfbox{max-height:62vh;overflow-y:auto;display:grid;gap:14px;padding:10px;
      border:2px dashed var(--line);border-radius:14px;background:rgba(18,6,9,.35)}
    #signModal .sw-pdfbox canvas{width:100%!important;height:auto!important;display:block;border-radius:8px;
      box-shadow:4px 4px 0 rgba(0,0,0,.55);cursor:crosshair}
  `;
  document.head.appendChild(style);

  let busy = false;
  let lastKey = "";

  function findBox(modal) {
    const canvases = Array.from(modal.querySelectorAll("canvas"));
    if (!canvases.length) return null;
    let box = canvases[0].parentElement;
    while (box && box !== modal && !canvases.every((c) => box.contains(c))) box = box.parentElement;
    if (!box || box === modal) box = canvases[0].parentElement;
    box.classList.add("sw-pdfbox");
    return box;
  }

  function tagPages(box) {
    Array.from(box.querySelectorAll("canvas")).forEach((c, i) => {
      if (c.previousElementSibling && c.previousElementSibling.classList.contains("pg-tag")) return;
      const t = document.createElement("div");
      t.className = "pg-tag";
      t.textContent = "PAGE " + (i + 1);
      box.insertBefore(t, c);
    });
  }

  function updateCaption(modal, count) {
    // ONLY leaf nodes (no child elements) that contain the old caption text
    const nodes = Array.from(modal.querySelectorAll("p, div, span")).filter((el) => {
      if (el.children.length > 0) return false;
      return /first \d+ of|preview shows/i.test(el.textContent || "");
    });
    const cap = nodes[0];
    if (cap) cap.textContent = "Scroll to view all " + count + " pages. Tap a page to place your signature.";
  }

  async function addRemainingPages(modal, box) {
    if (!window.pdfjsLib) return;
    const titleEl = modal.querySelector(".modal-head h3");
    const title = (titleEl ? titleEl.textContent : "").trim();
    const doc = (state.docs || []).find((d) =>
      title && ((d.title || "") === title || (d.fileName || "") === title ||
        title.includes(d.fileName || "\u0000") || (d.title || "\u0000").includes(title)));
    if (!doc || !doc.publicUrl) return;
    const shown = box.querySelectorAll("canvas").length;
    try {
      const buf = await fetch(doc.publicUrl).then((r) => r.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      if (pdf.numPages <= shown) { updateCaption(modal, pdf.numPages); return; }
      for (let n = shown + 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 1.4 });
        const c = document.createElement("canvas");
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        const t = document.createElement("div");
        t.className = "pg-tag";
        t.textContent = "PAGE " + n;
        box.appendChild(t);
        box.appendChild(c);
      }
      updateCaption(modal, pdf.numPages);
    } catch (e) { console.warn("drop8 extra pages:", e); }
  }

  async function fix() {
    const modal = document.getElementById("signModal");
    if (!modal || modal.classList.contains("hidden") || busy) return;
    const box = findBox(modal);
    if (!box) return;
    tagPages(box);
    const key = ((modal.querySelector(".modal-head h3") || {}).textContent || "") + "|" + box.querySelectorAll("canvas").length;
    if (key === lastKey) return;
    lastKey = key;
    busy = true;
    await addRemainingPages(modal, box);
    tagPages(box);
    busy = false;
  }

  const modal = document.getElementById("signModal");
  if (modal) {
    new MutationObserver(() => setTimeout(fix, 250)).observe(modal, { subtree: true, childList: true, attributes: true });
  }

  console.log("SPIDERWEB Drop 8 v2 loaded.");
})();
/* SPIDERWEB-DROP8-END */
