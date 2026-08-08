/* SPIDERWEB DROP 8 v4 — all pages, verified by page count */
(function () {
  "use strict";
  if (window.__DROP8__) return;
  window.__DROP8__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .pg-tag{font-family:"Bangers",cursive;letter-spacing:.08em;color:var(--mut);font-size:.85rem;margin:2px 0 -6px}
    #signModal .sw-pdfbox{max-height:62vh;overflow-y:auto!important;display:grid;gap:14px;padding:10px;
      border:2px dashed var(--line);border-radius:14px;background:rgba(18,6,9,.35)}
    #signModal .sw-pdfbox div{height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important}
    #signModal .sw-pdfbox canvas{width:100%!important;height:auto!important;max-height:none!important;
      object-fit:initial!important;display:block;border-radius:8px;box-shadow:4px 4px 0 rgba(0,0,0,.55);cursor:crosshair}
  `;
  document.head.appendChild(style);

  let busy = false;
  let lastKey = "";

  function norm(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }

  function findBox(modal) {
    const canvases = Array.from(modal.querySelectorAll("canvas"));
    if (!canvases.length) return null;
    let box = canvases[0].parentElement;
    while (box && box !== modal && !canvases.every((c) => box.contains(c))) box = box.parentElement;
    if (!box || box === modal) box = canvases[0].parentElement;
    box.classList.add("sw-pdfbox");
    return box;
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
      if (c.previousElementSibling && c.previousElementSibling.classList.contains("pg-tag")) return;
      const t = document.createElement("div");
      t.className = "pg-tag";
      t.textContent = "PAGE " + (i + 1);
      box.insertBefore(t, c);
    });
  }

  function updateCaption(modal, count) {
    const nodes = Array.from(modal.querySelectorAll("p, div, span")).filter((el) => {
      if (el.children.length > 0) return false;
      return /first \d+ of|preview shows/i.test(el.textContent || "");
    });
    if (nodes[0]) nodes[0].textContent = "Scroll to view all " + count + " pages. Tap a page to place your signature.";
  }

  async function addRemainingPages(modal, box) {
    if (!window.pdfjsLib) return;
    const shown = box.querySelectorAll("canvas").length;
    const m = (modal.textContent || "").match(/first \d+ of (\d+)/i);
    const total = m ? parseInt(m[1], 10) : 0;
    if (total && total <= shown) { updateCaption(modal, total); return; }

    const titleEl = modal.querySelector(".modal-head h3");
    const nt = norm(titleEl ? titleEl.textContent : "");
    function score(x) {
      const t = norm(x.d.title || "");
      const f = norm((x.d.fileName || "").replace(/\.pdf$/i, ""));
      let s = 0;
      if (t && nt && (t === nt || t.includes(nt) || nt.includes(t))) s += 100;
      if (f && nt && (f === nt || f.includes(nt) || nt.includes(f))) s += 50;
      return s;
    }
    const cands = (state.docs || [])
      .map((d) => ({ d, u: d.publicUrl || d.fileUrl || d.url || "" }))
      .filter((x) => x.u && /pdf/i.test((x.d.fileType || "") + (x.d.fileName || "")))
      .sort((a, b) => score(b) - score(a));

    for (const x of cands.slice(0, 6)) {
      try {
        const buf = await fetch(x.u).then((r) => r.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        if (pdf.numPages <= shown) continue;
        if (total && pdf.numPages !== total) continue;
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
        return;
      } catch (e) { console.warn("drop8 candidate failed:", e); }
    }
  }

  async function fix() {
    const modal = document.getElementById("signModal");
    if (!modal || modal.classList.contains("hidden") || busy) return;
    const box = findBox(modal);
    if (!box) return;
    unclip(box);
    tagPages(box);
    const key = ((modal.querySelector(".modal-head h3") || {}).textContent || "") + "|" + box.querySelectorAll("canvas").length;
    if (key === lastKey) return;
    lastKey = key;
    busy = true;
    await addRemainingPages(modal, box);
    unclip(box);
    tagPages(box);
    busy = false;
  }

  const modal = document.getElementById("signModal");
  if (modal) {
    new MutationObserver(() => setTimeout(fix, 250)).observe(modal, { subtree: true, childList: true, attributes: true });
  }

  console.log("SPIDERWEB Drop 8 v4 loaded.");
})();
/* SPIDERWEB-DROP8-END */
