/* SPIDERWEB DROP 8 v8 — Firestore-sourced pager + sign-every-page */
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
    .sw-pagebox{max-height:60vh;overflow:auto;border:2px dashed var(--line);border-radius:14px;padding:10px;background:rgba(18,6,9,.35)}
    .sw-pagebox canvas{width:100%;height:auto;display:none;border-radius:8px;box-shadow:4px 4px 0 rgba(0,0,0,.55);cursor:crosshair}
    .sw-pagebox canvas.sw-cur{display:block}
    .sw-every{display:flex;gap:10px;align-items:center;margin:10px 0 0;color:var(--ink);font-size:.95rem}
    .sw-every input{width:18px;height:18px;accent-color:var(--red)}
    #swSignAll{margin-top:10px}
  `;
  document.head.appendChild(style);

  let busy = false;
  let lastKey = "";
  let cachedBytes = null;
  let cachedDoc = null;

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
      <label class="sw-every"><input type="checkbox" id="swEvery" /> Sign every page at the bottom</label>
      <button id="swSignAll" class="btn hidden" type="button">⚡ Sign all pages (bottom)</button>`;
    head.insertAdjacentElement("afterend", v);
    const box = v.querySelector(".sw-pagebox");
    v.querySelector('[data-pg="prev"]').addEventListener("click", () => step(box, -1));
    v.querySelector('[data-pg="next"]').addEventListener("click", () => step(box, 1));
    v.querySelector("#swEvery").addEventListener("change", (e) => {
      v.querySelector("#swSignAll").classList.toggle("hidden", !e.target.checked);
    });
    v.querySelector("#swSignAll").addEventListener("click", signAllPages);
    return v;
  }
  function setStatus(v, t) { v.querySelector(".sw-status").textContent = t; }

  async function getPdfSource(modal) {
    const h3 = modal.querySelector(".modal-head h3");
    let nt = norm(h3 ? h3.textContent : "");
    if (nt.indexOf("spiderweb") === 0) nt = nt.slice(9);
    const snap = await db.collection("c").doc("docs").collection("list").orderBy("createdAt", "desc").get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const hit = docs.find((d) => {
      const t = norm(d.title || "");
      const f = norm((d.fileName || "").replace(/\.pdf$/i, ""));
      return nt && t && (t === nt || t.includes(nt) || nt.includes(t) || (f && (f === nt || nt.includes(f) || f.includes(nt))));
    }) || docs[0];
    if (!hit) return null;
    const url = hit.publicUrl || hit.fileUrl || hit.url || hit.downloadUrl ||
      (hit.storagePath ? (SUPABASE_URL + "/storage/v1/object/public/" + hit.storagePath) : "");
    if (url) return { url, hit };
    const data = hit.dataUrl || hit.base64 || hit.pdfData || "";
    if (data) return { data, hit };
    return { hit };
  }

  async function loadPages(modal, v) {
    const box = v.querySelector(".sw-pagebox");
    if (!window.pdfjsLib) { setStatus(v, "drop8: pdf.js missing."); return; }
    setStatus(v, "drop8: locating the PDF in Firestore…");
    let src = null;
    try { src = await getPdfSource(modal); } catch (e) { setStatus(v, "drop8: Firestore read failed — " + e.message); return; }
    if (!src) { setStatus(v, "drop8: no document found."); return; }
    cachedDoc = src.hit;
    try {
      if (!cachedBytes) {
        setStatus(v, "drop8: downloading PDF…");
        cachedBytes = await fetch(src.url || src.data).then((r) => {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.arrayBuffer();
        });
      }
      const pdf = await pdfjsLib.getDocument({ data: cachedBytes.slice(0) }).promise;
      box.innerHTML = "";
      for (let n = 1; n <= pdf.numPages; n++) {
        setStatus(v, "drop8: rendering page " + n + " / " + pdf.numPages + "…");
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 1.2 });
        const c = document.createElement("canvas");
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        box.appendChild(c);
      }
      // hide the old inline preview (it only shows 5)
      const caps = Array.from(modal.querySelectorAll("p,div,span")).filter((el) =>
        el.children.length === 0 && /preview shows/i.test(el.textContent || ""));
      if (caps[0] && caps[0].parentElement) caps[0].parentElement.style.display = "none";
      setStatus(v, "");
      show(box, 0);
    } catch (e) {
      console.warn("drop8:", e);
      setStatus(v, "drop8 failed: " + (e.message || e));
    }
  }

  function show(box, i) {
    const canvases = Array.from(box.querySelectorAll("canvas"));
    if (!canvases.length) return;
    i = Math.max(0, Math.min(canvases.length - 1, i));
    box.dataset.cur = i;
    canvases.forEach((c, k) => c.classList.toggle("sw-cur", k === i));
    const v = box.closest(".sw-viewer");
    v.querySelector(".sw-count").textContent = "PAGE " + (i + 1) + " OF " + canvases.length;
    v.querySelector('[data-pg="prev"]').disabled = i === 0;
    v.querySelector('[data-pg="next"]').disabled = i === canvases.length - 1;
    box.scrollTop = 0;
  }
  function step(box, d) { show(box, parseInt(box.dataset.cur || "0", 10) + d); }

  async function signAllPages() {
    if (!cachedBytes || !cachedDoc) { toast("PDF not loaded yet.", "err"); return; }
    if (!window.PDFLib) { toast("pdf-lib missing.", "err"); return; }
    const name = (state.profile && state.profile.name) || "Signer";
    try {
      toast("Stamping every page…");
      const pdfDoc = await PDFLib.PDFDocument.load(cachedBytes.slice(0));
      const ink = await pdfDoc.embedPng(typedInk8(name));
      const pages = pdfDoc.getPages();
      pages.forEach((pg) => {
        const { width } = pg.getSize();
        const w = 190;
        const h = w * ink.height / ink.width;
        pg.drawImage(ink, { x: (width - w) / 2, y: 34, width: w, height: h });
      });
      const out = await pdfDoc.save();
      const safe = (cachedDoc.fileName || cachedDoc.title || "doc").replace(/[^\w.\-]+/g, "-");
      const path = "signed/" + state.user.uid + "/" + Date.now() + "-" + safe;
      const up = await supabaseClient.storage.from(SUPABASE_BUCKET).upload(path, new Blob([out], { type: "application/pdf" }), { cacheControl: "3600", upsert: false });
      if (up.error) throw up.error;
      const pub = supabaseClient.storage.from(SUPABASE_BUCKET).getPublicUrl(path).data.publicUrl;
      await db.collection("c").doc("docs").collection("list").doc(cachedDoc.id).update({
        signatures: firebase.firestore.FieldValue.arrayUnion({
          name, email: state.user.email || "", uid: state.user.uid,
          method: "one-click", page: "all-pages-bottom",
          device: (navigator.userAgent || "") + " · " + new Date().toLocaleString(),
          signedAt: new Date().toISOString(), ink: typedInk8(name), fileUrl: pub
        })
      });
      toast("Signed every page at the bottom — signed copy saved.", "ok");
    } catch (e) {
      console.error(e);
      toast("Sign-all failed: " + (e.message || e), "err");
    }
  }

  async function fix() {
    const modal = document.getElementById("signModal");
    if (!modal || modal.classList.contains("hidden") || busy) return;
    const v = viewer(modal);
    const key = (modal.querySelector(".modal-head h3") || {}).textContent || "";
    if (key !== lastKey) {
      lastKey = key;
      cachedBytes = null;
      busy = true;
      await loadPages(modal, v);
      busy = false;
    }
  }

  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("signModal");
    if (!modal || modal.classList.contains("hidden")) return;
    const box = modal.querySelector(".sw-pagebox");
    if (!box || !box.querySelectorAll("canvas").length) return;
    if (e.key === "ArrowLeft") step(box, -1);
    if (e.key === "ArrowRight") step(box, 1);
  });

  const modal = document.getElementById("signModal");
  if (modal) {
    new MutationObserver(() => setTimeout(fix, 300)).observe(modal, { subtree: true, childList: true, attributes: true });
  }

  console.log("SPIDERWEB Drop 8 v8 loaded.");
})();
/* SPIDERWEB-DROP8-END */
