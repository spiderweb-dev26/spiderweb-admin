/* SPIDERWEB DROP 8 v18 — merged history across duplicate docs */
(function () {
  "use strict";
  if (window.__DROP8__) return;
  window.__DROP8__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .sw-viewer{margin:0 0 14px}
    .sw-status{color:var(--mut);font-size:.85rem;font-style:italic;margin:0 0 6px}
    .sw-pager{display:flex;gap:12px;align-items:center;justify-content:center;margin:0 0 10px}
    .sw-pager button{border:2px solid var(--line);background:rgba(35,16,23,.7);color:var(--ink);
      border-radius:10px;padding:8px 14px;cursor:pointer;font-size:1rem}
    .sw-pager button:hover{border-color:rgba(230,36,46,.45)}
    .sw-pager button:disabled{opacity:.35;cursor:not-allowed}
    .sw-pager .sw-count{font-family:"Bangers",cursive;letter-spacing:.08em}
    .sw-pagebox{position:relative;max-height:60vh;overflow:auto;border:2px dashed var(--line);border-radius:14px;padding:10px;background:rgba(18,6,9,.35)}
    .sw-pagebox canvas{width:100%;height:auto;display:none;border-radius:8px;box-shadow:4px 4px 0 rgba(0,0,0,.55);cursor:crosshair}
    .sw-pagebox canvas.sw-cur{display:block}
    .sw-mark{position:absolute;z-index:5;transform:translate(-50%,-50%);font-size:26px;pointer-events:none;
      filter:drop-shadow(2px 2px 0 rgba(0,0,0,.6))}
    .sw-every{display:flex;gap:10px;align-items:center;margin:10px 0 0;color:var(--ink);font-size:.95rem}
    .sw-every input{width:18px;height:18px;accent-color:var(--red)}
    .sw-btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
  `;
  document.head.appendChild(style);

  let busy = false;
  let lastKey = "";
  let originalBytes = null;
  let cachedBytes = null;
  let cachedDoc = null;
  let matchedDocs = [];
  let lastUrl = "";
  let tap = null;

  function invalidate() { cachedBytes = null; originalBytes = null; lastKey = ""; matchedDocs = []; }

  function norm(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function typedInk8(name) {
    const c = document.createElement("canvas");
    c.width = 620; c.height = 150;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#22080d";
    ctx.font = 'italic 64px "Segoe Script","Brush Script MT","Comic Sans MS",cursive';
    ctx.textBaseline = "middle";
    ctx.fillText(name, 24, 78, 580);
    return c.toDataURL("image/png");
  }
  function canvasHasInk(c) {
    const t = document.createElement("canvas");
    t.width = c.width; t.height = c.height;
    const x = t.getContext("2d");
    x.drawImage(c, 0, 0);
    const d = x.getImageData(0, 0, t.width, t.height).data;
    for (let i = 3; i < d.length; i += 4) { if (d[i] > 0) return true; }
    return false;
  }
  function signerName() {
    const modal = document.getElementById("signModal");
    const el = modal.querySelector("#signName") ||
      Array.from(modal.querySelectorAll("input")).find((i) => (i.type || "text") === "text");
    return (el && el.value.trim()) || ((state.profile && state.profile.name) || "Signer");
  }
  function getInk() {
    const modal = document.getElementById("signModal");
    const tab = modal.querySelector(".sign-tab.active");
    const isDraw = tab && /draw/i.test(tab.textContent || "");
    if (isDraw) {
      const c = modal.querySelector(".sign-pad:not(.hidden) canvas") ||
        Array.from(modal.querySelectorAll(".sign-pad canvas"))[0];
      if (!c || !canvasHasInk(c)) { toast("Draw your signature first — or switch to One-click.", "err"); return null; }
      return { dataUrl: c.toDataURL("image/png"), method: "gesture" };
    }
    return { dataUrl: typedInk8(signerName()), method: "one-click" };
  }

  function viewer(modal) {
    let v = modal.querySelector(".sw-viewer");
    if (v) return v;
    const head = modal.querySelector(".modal-head");
    v = document.createElement("div");
    v.className = "sw-viewer";
    v.innerHTML = `
      <div class="sw-status"></div>
      <div class="sw-pager"><button type="button" data-pg="prev">◀</button><span class="sw-count"></span><button type="button" data-pg="next">▶</button></div>
      <div class="sw-pagebox"></div>
      <label class="sw-every"><input type="checkbox" id="swEvery" /> Bottom-sign EVERY page (not just this one)</label>
      <div class="sw-btns">
        <button id="swSignTap" class="btn" type="button" disabled>⚡ SIGN WHERE I TAPPED</button>
        <button id="swSignBottom" class="btn secondary" type="button">⚡ SIGN BOTTOM OF PAGE 1</button>
      </div>`;
    head.insertAdjacentElement("afterend", v);
    const box = v.querySelector(".sw-pagebox");
    v.querySelector('[data-pg="prev"]').addEventListener("click", () => step(box, -1));
    v.querySelector('[data-pg="next"]').addEventListener("click", () => step(box, 1));
    v.querySelector("#swEvery").addEventListener("change", () => refreshBtns(v, box));
    v.querySelector("#swSignTap").addEventListener("click", signAtTap);
    v.querySelector("#swSignBottom").addEventListener("click", signBottom);
    box.addEventListener("click", (e) => {
      const c = e.target.closest("canvas");
      if (!c) return;
      const idx = Array.from(box.querySelectorAll("canvas")).indexOf(c);
      const r = c.getBoundingClientRect();
      tap = { page: idx + 1, xPct: (e.clientX - r.left) / r.width, yPct: (e.clientY - r.top) / r.height };
      let mark = box.querySelector(".sw-mark");
      if (!mark) { mark = document.createElement("div"); mark.className = "sw-mark"; box.appendChild(mark); }
      mark.textContent = "🕸️";
      mark.style.left = (c.offsetLeft + tap.xPct * c.offsetWidth) + "px";
      mark.style.top = (c.offsetTop + tap.yPct * c.offsetHeight) + "px";
      mark.style.display = "";
      refreshBtns(v, box);
    });
    return v;
  }
  function setStatus(v, t) { v.querySelector(".sw-status").textContent = t; }
  function curPage(box) { return parseInt(box.dataset.cur || "0", 10) + 1; }
  function refreshBtns(v, box) {
    const every = v.querySelector("#swEvery").checked;
    const bt = v.querySelector("#swSignTap");
    const bb = v.querySelector("#swSignBottom");
    bt.disabled = !tap;
    bt.textContent = tap ? "⚡ SIGN WHERE I TAPPED (PAGE " + tap.page + ")" : "⚡ SIGN WHERE I TAPPED";
    bb.textContent = every ? "⚡ SIGN BOTTOM OF EVERY PAGE" : "⚡ SIGN BOTTOM OF PAGE " + curPage(box);
  }

  async function getPdfSource(modal) {
    const h3 = modal.querySelector(".modal-head h3");
    let nt = norm(h3 ? h3.textContent : "");
    if (nt.indexOf("spiderweb") === 0) nt = nt.slice(9);
    const snap = await db.collection("c").doc("docs").collection("list").orderBy("createdAt", "desc").get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const isMatch = (d) => {
      const t = norm(d.title || "");
      const f = norm((d.fileName || "").replace(/\.pdf$/i, ""));
      return nt && t && (t === nt || t.includes(nt) || nt.includes(t) || (f && (f === nt || nt.includes(f) || f.includes(nt))));
    };
    let matching = docs.filter(isMatch);
    if (!matching.length) matching = docs.slice(0, 1);
    matchedDocs = matching;
    matching.sort((a, b) =>
      ((b.signatures || []).length - (a.signatures || []).length) ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const hit = matching[0];
    if (!hit) return null;
    const withUrl = matching.find((m) => m.publicUrl || m.fileUrl || m.url || m.downloadUrl || m.storagePath);
    const src = withUrl || hit;
    const url = src.publicUrl || src.fileUrl || src.url || src.downloadUrl ||
      (src.storagePath ? (SUPABASE_URL + "/storage/v1/object/public/" + src.storagePath) : "");
    if (url) return { url, hit };
    const data = hit.dataUrl || hit.base64 || hit.pdfData || "";
    if (data) return { data, hit };
    return { hit };
  }

  async function pdfPoint(bytes, pageNo, xPct, yPct) {
    const jsDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const jpage = await jsDoc.getPage(pageNo);
    const vp = jpage.getViewport({ scale: 1 });
    if (vp.convertToPdfPoint) {
      const pt = vp.convertToPdfPoint(xPct * vp.width, yPct * vp.height);
      return { x: pt[0], y: pt[1] };
    }
    return { x: xPct * vp.width, y: (1 - yPct) * vp.height };
  }

  async function applyEntry(pdfDoc, bytes, entry) {
    if (!entry || !entry.ink) return;
    let emb;
    try { emb = await pdfDoc.embedPng(entry.ink); } catch (e) { return; }
    const w = 190;
    const h = w * emb.height / emb.width;
    const pages = pdfDoc.getPages();
    if (entry.page === "all-pages-bottom") {
      pages.forEach((pg) => pg.drawImage(emb, { x: (pg.getSize().width - w) / 2, y: 34, width: w, height: h }));
      return;
    }
    const pageNo = parseInt(entry.page, 10);
    if (!pageNo || !pages[pageNo - 1]) return;
    const pg = pages[pageNo - 1];
    if (typeof entry.xPct === "number" && typeof entry.yPct === "number") {
      const pt = await pdfPoint(bytes, pageNo, entry.xPct, entry.yPct);
      pg.drawImage(emb, { x: pt.x - w / 2, y: pt.y - h / 2, width: w, height: h });
    } else {
      pg.drawImage(emb, { x: (pg.getSize().width - w) / 2, y: 34, width: w, height: h });
    }
  }

  function historyEntries() {
    const seen = {};
    const all = [];
    (matchedDocs.length ? matchedDocs : [cachedDoc]).forEach((d) => {
      ((d && d.signatures) || []).forEach((s) => {
        if (!s || !s.ink) return;
        const k = (s.signedAt || "") + "|" + (s.page || "") + "|" + (s.name || "");
        if (seen[k]) return;
        seen[k] = 1;
        all.push(s);
      });
    });
    return all.sort((a, b) => String(a.signedAt || "").localeCompare(String(b.signedAt || "")));
  }
