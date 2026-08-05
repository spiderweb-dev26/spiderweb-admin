/* SPIDERWEB DROP 3 — Payments (countersign) + Crew chat (add-on) */
(function () {
  "use strict";
  if (window.__DROP3__) return;
  window.__DROP3__ = true;
  if (!window.D2) console.warn("Drop 3: missing Drop 2 export patch.");

  const style = document.createElement("style");
  style.textContent = `
    .pay-amount{font-family:var(--font-display);font-size:1.6rem;line-height:1}
    .chat-wrap{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px}
    .chat-rooms{display:grid;gap:8px;align-content:start}
    .room-btn{padding:10px 12px;border-radius:12px;border:2px solid transparent;background:rgba(18,6,9,.35);color:var(--ink);text-align:left;font-weight:700}
    .room-btn.active{border-color:rgba(230,36,46,.42);background:linear-gradient(135deg,rgba(230,36,46,.18),rgba(143,18,32,.28))}
    .chat-msgs{max-height:440px;min-height:260px;overflow:auto;display:grid;gap:8px;padding:12px;border-radius:14px;border:2px solid var(--line);background:rgba(18,6,9,.35);align-content:start}
    .msg{max-width:82%;padding:10px 12px;border-radius:14px;background:rgba(61,123,255,.14);border:1px solid rgba(61,123,255,.3);overflow-wrap:anywhere}
    .msg.me{margin-left:auto;background:rgba(230,36,46,.14);border-color:rgba(230,36,46,.35)}
    .msg small{display:block;color:var(--mut);margin-top:4px;font-size:.72rem}
    .chat-input{display:flex;gap:10px;margin-top:10px}
    .chat-input input{flex:1}
    .appr-list{display:grid;gap:6px}
    @media(max-width:900px){.chat-wrap{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const paymentsCol = () => db.collection("c").doc("payments").collection("list");
  const isAdmin3 = () => !!(state.profile && state.profile.role === "admin");
  const adminEmails3 = () => {
    const set = new Set(["amanu@spiderweb.lol"]);
    (state.users || []).forEach((u) => { if (u.role === "admin") set.add((u.email || "").toLowerCase()); });
    return set;
  };

  // ---- nav buttons
  const navSec = document.querySelector(".side .nav");
  const allNav = () => Array.from(document.querySelectorAll(".nav-item"));
  function makeNav(label, view) {
    const b = document.createElement("button");
    b.className = "nav-item";
    b.type = "button";
    b.dataset.view = view;
    b.innerHTML = `<span>${label}</span><span class="state">Drop 3</span>`;
    b.addEventListener("click", () => switchView3(view));
    return b;
  }
  const teamBtn = allNav().find((b) => b.textContent.includes("Team"));
  const payBtn = makeNav("Payments", "payments");
  const chatBtn = makeNav("Chat", "chat");
  navSec.insertBefore(chatBtn, teamBtn);
  navSec.insertBefore(payBtn, chatBtn);

  // ---- views + modals
  const mainEl = document.querySelector(".main");
  mainEl.insertAdjacentHTML("beforeend", `
    <section class="panel hidden" id="paymentsView">
      <div class="page-head">
        <div><h2>Payments</h2><p>Bank-transfer & payment authorizations. High-stake: two inks required — one of them an admin countersign.</p></div>
        <button id="newPaymentBtn" class="btn" type="button">New payment auth</button>
      </div>
      <div class="content">
        <div id="payEmpty" class="empty-state hidden"><h3>NO PAYMENT AUTHS</h3><p>Create a bank-transfer authorization and get it countersigned.</p></div>
        <div id="payList" class="task-list"></div>
      </div>
    </section>

    <section class="panel hidden" id="chatView">
      <div class="page-head">
        <div><h2>Crew chat</h2><p>Real-time rooms for the crew, plus one room per customer. Client-facing chat arrives with the client portal (Drop 4).</p></div>
      </div>
      <div class="content">
        <div class="chat-wrap">
          <div id="roomList" class="chat-rooms"></div>
          <div>
            <div id="chatMsgs" class="chat-msgs"></div>
            <form id="chatForm" class="chat-input">
              <input id="chatText" placeholder="Type a message…" autocomplete="off" />
              <button class="btn" type="submit">Send</button>
            </form>
          </div>
        </div>
      </div>
    </section>

    <div id="paymentModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>New payment authorization</h3><button class="icon-btn" data-close="paymentModal" type="button" aria-label="Close">✕</button></div>
        <form id="paymentForm">
          <div class="field"><label for="payTitle">What for</label><input id="payTitle" required placeholder="Example: Deposit — Kebede Cafe website" /></div>
          <div class="field"><label for="payAmount">Amount (ETB)</label><input id="payAmount" type="number" min="0" step="0.01" required /></div>
          <div class="field"><label for="payBank">Bank</label><input id="payBank" placeholder="Example: CBE" /></div>
          <div class="field"><label for="payAccountName">Account name</label><input id="payAccountName" /></div>
          <div class="field"><label for="payAccountNumber">Account number</label><input id="payAccountNumber" /></div>
          <div class="field"><label for="payNote">Note, optional</label><input id="payNote" /></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" type="submit">Create</button><button class="btn ghost" type="button" data-close="paymentModal">Cancel</button></div>
        </form>
      </section>
    </div>

    <div id="paySignModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3 id="paySignTitle">Sign payment</h3><button class="icon-btn" data-close="paySignModal" type="button" aria-label="Close">✕</button></div>
        <div class="field"><label for="paySignName">Signer name</label><input id="paySignName" placeholder="Full name" required /></div>
        <div class="sign-tabs">
          <button id="payTabOne" class="sign-tab active" type="button">One-click</button>
          <button id="payTabDraw" class="sign-tab" type="button">Draw</button>
        </div>
        <section id="payOnePane" class="sign-pad">
          <p class="muted small">Records name, device, date and time as an authorization ink.</p>
          <button id="payOneBtn" class="btn" type="button">Sign with one click</button>
        </section>
        <section id="payDrawPane" class="sign-pad hidden">
          <div class="canvas-wrap"><canvas id="payCanvas"></canvas><div class="canvas-hint">Draw with mouse, finger, or stylus.</div></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button id="payClearBtn" class="btn ghost" type="button">Clear</button>
            <button id="payDrawSignBtn" class="btn secondary" type="button">Sign with drawing</button>
          </div>
        </section>
      </section>
    </div>
  `);

  function switchView3(name) {
    if (window.D2) window.D2.switchView(name);
    ["payments", "chat"].forEach((v) => {
      document.getElementById(v + "View").classList.toggle("hidden", v !== name);
    });
    allNav().forEach((b) => {
      if (b.dataset.view === "payments" || b.dataset.view === "chat") b.classList.toggle("active", b.dataset.view === name);
    });
    if (name === "payments") loadPayments();
    if (name === "chat") enterChat();
  }
    state.payments = state.payments || [];

  // ============ PAYMENTS ============
  async function loadPayments() {
    try {
      const snap = await paymentsCol().orderBy("createdAt", "desc").get();
      state.payments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderPayments();
    } catch (err) {
      console.error(err);
      toast("Payments load failed: " + err.message, "err");
    }
  }

  function payStatus(p) {
    const ap = Array.isArray(p.approvals) ? p.approvals : [];
    const admins = adminEmails3();
    const hasAdmin = ap.some((s) => admins.has((s.email || "").toLowerCase()));
    if (ap.length >= 2 && hasAdmin) return { key: "ok", html: '<span class="signed">Authorized</span>' };
    if (ap.length === 0) return { key: "none", html: '<span class="pending">Awaiting first ink</span>' };
    if (!hasAdmin) return { key: "needadmin", html: '<span class="pending">Needs admin countersign</span>' };
    return { key: "needsecond", html: '<span class="pending">Needs second ink</span>' };
  }

  function renderPayments() {
    const list = document.getElementById("payList");
    const empty = document.getElementById("payEmpty");
    list.innerHTML = "";
    const pays = state.payments || [];
    if (!pays.length) { empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");
    const admins = adminEmails3();
    pays.forEach((p) => {
      const st = payStatus(p);
      const ap = Array.isArray(p.approvals) ? p.approvals : [];
      const row = document.createElement("div");
      row.className = "task-row";
      row.innerHTML = `
        <div class="task-top">
          <span class="task-title">${escapeHtml(p.title)}</span>
          ${st.html}
        </div>
        <div class="pay-amount">${escapeHtml(Number(p.amount || 0).toLocaleString())} ETB</div>
        <div class="task-meta">
          ${p.bank ? `<span>Bank: ${escapeHtml(p.bank)}</span>` : ""}
          ${p.accountName ? `<span>Acct name: ${escapeHtml(p.accountName)}</span>` : ""}
          ${p.accountNumber ? `<span>Acct #: ${escapeHtml(p.accountNumber)}</span>` : ""}
        </div>
        ${p.note ? `<div class="task-meta">${escapeHtml(p.note)}</div>` : ""}
        <div class="appr-list">
          ${ap.map((s) => `<div class="mini-row"><span>${escapeHtml(s.name)} ${admins.has((s.email || "").toLowerCase()) ? '<span class="overdue">Admin</span>' : ""} · ${escapeHtml(s.method === "gesture" ? "drawn" : "one-click")}</span><span class="muted small">${escapeHtml(formatDate(s.signedAt))}</span></div>`).join("") || '<div class="muted small">No inks yet.</div>'}
        </div>
        <div class="doc-actions">
          <button class="btn small" data-act="sign" type="button">Sign / countersign</button>
          <button class="btn secondary small" data-act="letter" type="button" ${st.key === "ok" ? "" : "disabled"}>Authorization letter</button>
          ${isAdmin3() ? '<button class="btn ghost small" data-act="del" type="button">Delete</button>' : ""}
        </div>`;
      row.querySelector('[data-act="sign"]').addEventListener("click", () => openPaySign(p));
      row.querySelector('[data-act="letter"]').addEventListener("click", () => openLetter(p));
      const del = row.querySelector('[data-act="del"]');
      if (del) del.addEventListener("click", async () => {
        if (!confirm("Delete this payment authorization?")) return;
        await paymentsCol().doc(p.id).delete();
        toast("Payment auth deleted.");
        loadPayments();
      });
      list.appendChild(row);
    });
  }

  document.getElementById("newPaymentBtn").addEventListener("click", () => openModal("paymentModal"));
  document.getElementById("paymentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await paymentsCol().add({
        title: document.getElementById("payTitle").value.trim(),
        amount: parseFloat(document.getElementById("payAmount").value) || 0,
        bank: document.getElementById("payBank").value.trim(),
        accountName: document.getElementById("payAccountName").value.trim(),
        accountNumber: document.getElementById("payAccountNumber").value.trim(),
        note: document.getElementById("payNote").value.trim(),
        approvals: [],
        createdBy: state.user ? state.user.email : "",
        createdByName: state.profile ? state.profile.name : "",
        createdAt: new Date().toISOString()
      });
      toast("Payment auth created — collect two inks.");
      closeModal("paymentModal");
      e.target.reset();
      loadPayments();
    } catch (err) { toast("Payment failed: " + err.message, "err"); }
  });

  // ---- payment sign pad
  let payTarget = null;
  let payDrawing = false, payLast = null, payCtx = null, payHasInk = false;

  function openPaySign(p) {
    payTarget = p.id;
    document.getElementById("paySignTitle").textContent = p.title || "Sign payment";
    document.getElementById("paySignName").value = state.profile ? state.profile.name : "";
    payTabSwitch("one");
    openModal("paySignModal");
  }

  function payTabSwitch(which) {
    const one = which === "one";
    document.getElementById("payTabOne").classList.toggle("active", one);
    document.getElementById("payTabDraw").classList.toggle("active", !one);
    document.getElementById("payOnePane").classList.toggle("hidden", !one);
    document.getElementById("payDrawPane").classList.toggle("hidden", one);
    if (!one) requestAnimationFrame(payResize);
  }
  document.getElementById("payTabOne").addEventListener("click", () => payTabSwitch("one"));
  document.getElementById("payTabDraw").addEventListener("click", () => payTabSwitch("draw"));

  function payResize() {
    const canvas = document.getElementById("payCanvas");
    const rect = canvas.parentElement.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(220 * ratio);
    canvas.style.height = "220px";
    payCtx = canvas.getContext("2d");
    payCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    payCtx.clearRect(0, 0, canvas.width, canvas.height);
    payCtx.lineWidth = 3; payCtx.lineCap = "round"; payCtx.lineJoin = "round";
    payCtx.strokeStyle = "#22080d";
    payHasInk = false;
  }
  function payPos(e) {
    const rect = document.getElementById("payCanvas").getBoundingClientRect();
    const cx = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const cy = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  }
  const payCanvasEl = document.getElementById("payCanvas");
  payCanvasEl.addEventListener("pointerdown", (e) => { e.preventDefault(); payDrawing = true; payHasInk = true; payLast = payPos(e); });
  payCanvasEl.addEventListener("pointermove", (e) => {
    if (!payDrawing || !payCtx) return;
    e.preventDefault();
    const p = payPos(e);
    payCtx.beginPath(); payCtx.moveTo(payLast.x, payLast.y); payCtx.lineTo(p.x, p.y); payCtx.stroke();
    payLast = p;
  });
  ["pointerup", "pointercancel"].forEach((ev) => window.addEventListener(ev, () => { payDrawing = false; }));
  document.getElementById("payClearBtn").addEventListener("click", () => {
    const canvas = document.getElementById("payCanvas");
    if (!payCtx) return;
    payCtx.save(); payCtx.setTransform(1, 0, 0, 1, 0, 0); payCtx.clearRect(0, 0, canvas.width, canvas.height); payCtx.restore();
    payHasInk = false;
  });

  function typedInk3(name) {
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

  async function addPayApproval(sig) {
    if (!payTarget) return;
    await paymentsCol().doc(payTarget).update({ approvals: firebase.firestore.FieldValue.arrayUnion(sig) });
    toast("Ink recorded.");
    closeModal("paySignModal");
    loadPayments();
  }

  function payGuard(name) {
    const p = (state.payments || []).find((x) => x.id === payTarget);
    if (!p) return "Payment not found.";
    const mine = (state.user.email || "").toLowerCase();
    if ((p.approvals || []).some((s) => (s.email || "").toLowerCase() === mine)) return "You already inked this payment.";
    if (!name) return "Enter signer name first.";
    return null;
  }

  document.getElementById("payOneBtn").addEventListener("click", async () => {
    const name = document.getElementById("paySignName").value.trim();
    const bad = payGuard(name);
    if (bad) { toast(bad, "err"); return; }
    await addPayApproval({
      name, email: state.user.email || "", uid: state.user.uid || "",
      method: "one-click", device: (navigator.userAgent || "") + " · " + new Date().toLocaleString(),
      signedAt: new Date().toISOString(), ink: typedInk3(name)
    });
  });

  document.getElementById("payDrawSignBtn").addEventListener("click", async () => {
    const name = document.getElementById("paySignName").value.trim();
    const bad = payGuard(name);
    if (bad) { toast(bad, "err"); return; }
    if (!payHasInk) { toast("Draw a signature first.", "err"); return; }
    await addPayApproval({
      name, email: state.user.email || "", uid: state.user.uid || "",
      method: "gesture", device: (navigator.userAgent || "") + " · " + new Date().toLocaleString(),
      signedAt: new Date().toISOString(), ink: document.getElementById("payCanvas").toDataURL("image/png")
    });
  });

  // ---- printable authorization letter
  function openLetter(p) {
    const admins = adminEmails3();
    const ap = Array.isArray(p.approvals) ? p.approvals : [];
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payment Authorization — ${escapeHtml(p.title)}</title></head>
    <body style="font-family:Segoe UI,Arial,sans-serif;background:#f7eef0;color:#22080d;margin:0;padding:40px">
      <div style="max-width:720px;margin:0 auto;background:#fff;border:3px solid #e6242e;border-radius:16px;padding:36px">
        <h1 style="margin:0;font-size:26px">SPIDERWEB DIGITAL SOLUTIONS</h1>
        <p style="margin:4px 0 24px;color:#8f1220;letter-spacing:.12em;text-transform:uppercase;font-size:12px">Payment Authorization Letter</p>
        <h2 style="margin:0 0 8px">${escapeHtml(p.title)}</h2>
        <p style="font-size:34px;margin:8px 0"><strong>${escapeHtml(Number(p.amount || 0).toLocaleString())} ETB</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${p.bank ? `<tr><td style="padding:6px 0;color:#8f1220">Bank</td><td>${escapeHtml(p.bank)}</td></tr>` : ""}
          ${p.accountName ? `<tr><td style="padding:6px 0;color:#8f1220">Account name</td><td>${escapeHtml(p.accountName)}</td></tr>` : ""}
          ${p.accountNumber ? `<tr><td style="padding:6px 0;color:#8f1220">Account number</td><td>${escapeHtml(p.accountNumber)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#8f1220">Created</td><td>${escapeHtml(formatDate(p.createdAt))} by ${escapeHtml(p.createdByName || p.createdBy || "")}</td></tr>
        </table>
        ${p.note ? `<p style="background:#f7eef0;border-radius:10px;padding:12px">${escapeHtml(p.note)}</p>` : ""}
        <h3 style="margin:24px 0 12px">Authorizations (${ap.length})</h3>
        ${ap.map((s) => `
          <div style="display:flex;align-items:center;gap:16px;border-top:1px dashed #e6242e;padding:12px 0">
            ${s.ink ? `<img src="${s.ink}" style="height:52px" alt="signature">` : ""}
            <div>
              <strong>${escapeHtml(s.name)}</strong> ${admins.has((s.email || "").toLowerCase()) ? '<span style="color:#e6242e;font-weight:700">— ADMIN COUNTERSIGN</span>' : ""}
              <div style="font-size:12px;color:#666">${escapeHtml(formatDate(s.signedAt))} · ${escapeHtml(s.method === "gesture" ? "drawn signature" : "one-click signature")}</div>
              <div style="font-size:11px;color:#999">${escapeHtml(s.device || "")}</div>
            </div>
          </div>`).join("")}
        <p style="margin-top:28px;font-size:12px;color:#666">Recorded in Spiderweb Studio OS with two-ink approval including an admin countersign. Verify against the system record if needed.</p>
      </div>
    </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    window.open(url, "_blank", "noopener");
    toast("Authorization letter opened — print or save as PDF.");
  }
    // ============ CREW CHAT ============
  let chatRoom = null;
  let chatUnsub = null;

  function roomList3() {
    const rooms = [{ id: "crew", name: "# crew — all hands" }];
    (state.customers || []).forEach((c) => rooms.push({ id: "cust-" + c.id, name: "# " + (c.name || "customer") }));
    return rooms;
  }

  async function enterChat() {
    if (window.D2) { try { await D2.loadCustomers(); } catch (e) {} }
    renderRooms();
    if (!chatRoom) setRoom("crew");
  }

  function renderRooms() {
    const wrap = document.getElementById("roomList");
    wrap.innerHTML = "";
    roomList3().forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "room-btn" + (chatRoom === r.id ? " active" : "");
      b.textContent = r.name;
      b.addEventListener("click", () => setRoom(r.id));
      wrap.appendChild(b);
    });
  }

  function setRoom(id) {
    chatRoom = id;
    renderRooms();
    if (chatUnsub) { chatUnsub(); chatUnsub = null; }
    chatUnsub = db.collection("c").doc("chat").collection(id)
      .orderBy("at", "asc")
      .onSnapshot((snap) => {
        const box = document.getElementById("chatMsgs");
        box.innerHTML = "";
        snap.forEach((d) => {
          const m = d.data();
          const div = document.createElement("div");
          div.className = "msg" + (m.uid === state.user.uid ? " me" : "");
          div.innerHTML = `${escapeHtml(m.text)}<small>${escapeHtml(m.byName || m.by || "")} · ${escapeHtml(formatDate(m.at))}</small>`;
          box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
      }, (err) => { console.error(err); toast("Chat error: " + err.message, "err"); });
  }

  document.getElementById("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chatText");
    const text = input.value.trim();
    if (!text || !chatRoom) return;
    input.value = "";
    try {
      await db.collection("c").doc("chat").collection(chatRoom).add({
        text,
        by: state.user.email || "",
        byName: state.profile ? state.profile.name : "",
        uid: state.user.uid,
        at: new Date().toISOString()
      });
    } catch (err) { toast("Send failed: " + err.message, "err"); }
  });

    // ============ CHAT v2: edit, delete, files ============
  (function () {
    const css = document.createElement("style");
    css.textContent = `.msg-actions{display:flex;gap:6px;margin-top:6px}.msg-btn{border:1px solid var(--line);background:rgba(18,6,9,.4);border-radius:8px;padding:2px 8px;font-size:.8rem;color:var(--mut)}.msg-btn:hover{color:var(--ink)}.edit-wrap{display:grid;gap:8px}.edit-input{width:100%;padding:10px 12px;border-radius:12px;border:2px solid rgba(230,36,46,.22);background:rgba(18,6,9,.62);color:var(--ink);outline:none}.chat-file-chip{display:flex;align-items:center;gap:8px;margin-top:8px;padding:8px 10px;border-radius:12px;border:1px dashed var(--line);color:var(--mut);font-size:.85rem}`;
    document.head.appendChild(css);

    const oldForm = document.getElementById("chatForm");
    const form = oldForm.cloneNode(true);
    oldForm.parentNode.replaceChild(form, oldForm);
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.hidden = true;
    const fileBtn = document.createElement("button");
    fileBtn.type = "button";
    fileBtn.className = "btn ghost";
        fileBtn.textContent = "📎";
    fileBtn.title = "Attach a file";
    const fileChip = document.createElement("div");
    fileChip.className = "chat-file-chip hidden";
    const sendBtn = form.querySelector("button[type='submit']");
    form.insertBefore(fileInput, form.firstChild);
    form.insertBefore(fileBtn, sendBtn);
    form.appendChild(fileChip);
    let pendingFile = null;
    fileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      pendingFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      if (pendingFile) { fileChip.classList.remove("hidden"); fileChip.textContent = "📎 " + pendingFile.name + " (" + formatBytes(pendingFile.size) + ")"; }
      else fileChip.classList.add("hidden");
    });

    function chatCol(room) { return db.collection("c").doc("chat").collection(room); }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("chatText");
      const text = input.value.trim();
      if ((!text && !pendingFile) || !chatRoom) return;
      input.value = "";
      const file = pendingFile;
      pendingFile = null;
      fileInput.value = "";
      fileChip.classList.add("hidden");
      try {
        let fileMeta = {};
        if (file) {
          if (file.size > 25 * 1024 * 1024) { toast("Max 25 MB per file.", "err"); return; }
          const safe = file.name.replace(/[^\w.\-]+/g, "-");
          const path = "chat/" + state.user.uid + "/" + Date.now() + "-" + safe;
          const up = await supabaseClient.storage.from(SUPABASE_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
          if (up.error) throw up.error;
          const pub = supabaseClient.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
          fileMeta = { fileUrl: pub.data.publicUrl, fileName: file.name, fileType: file.type || "application/octet-stream", fileSize: file.size };
        }
        await chatCol(chatRoom).add(Object.assign({
          text: text,
          by: state.user.email || "",
          byName: state.profile ? state.profile.name : "",
          uid: state.user.uid,
          at: new Date().toISOString()
        }, fileMeta));
      } catch (err) { console.error(err); toast("Send failed: " + err.message, "err"); }
    });

    function richRender(snap) {
      const box = document.getElementById("chatMsgs");
      box.innerHTML = "";
      snap.forEach((d) => {
        const m = d.data();
        const mine = m.uid === state.user.uid;
        const div = document.createElement("div");
        div.className = "msg" + (mine ? " me" : "");
        let html = "";
        if (m.fileUrl) {
          html += (m.fileType || "").startsWith("image/")
            ? `<a href="${escapeHtml(m.fileUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(m.fileUrl)}" style="max-width:220px;max-height:160px;border-radius:10px;display:block;margin-bottom:6px" alt=""></a>`
            : `<a class="link" href="${escapeHtml(m.fileUrl)}" target="_blank" rel="noopener">📎 ${escapeHtml(m.fileName || "file")}</a>`;
        }
        if (m.text) html += escapeHtml(m.text);
        html += `<small>${escapeHtml(m.byName || m.by || "")} · ${escapeHtml(formatDate(m.at))}${m.editedAt ? " · edited" : ""}</small>`;
        div.innerHTML = html;
        if (mine || isAdmin3()) {
          const bar = document.createElement("div");
          bar.className = "msg-actions";
          if (mine) bar.innerHTML += '<button class="msg-btn" type="button" data-m="edit">✎ edit</button>';
          bar.innerHTML += '<button class="msg-btn" type="button" data-m="del">🗑 delete</button>';
          div.appendChild(bar);
          const ed = bar.querySelector('[data-m="edit"]');
          if (ed) ed.addEventListener("click", () => startEdit(d.id, m, div));
          bar.querySelector('[data-m="del"]').addEventListener("click", async () => {
            if (!confirm("Delete this message for everyone?")) return;
            await chatCol(chatRoom).doc(d.id).delete();
            toast("Message deleted.");
          });
        }
        box.appendChild(div);
      });
      box.scrollTop = box.scrollHeight;
    }

    function startEdit(msgId, m, div) {
      const wrap = document.createElement("div");
      wrap.className = "edit-wrap";
      const input = document.createElement("input");
      input.className = "edit-input";
      input.value = m.text || "";
      const save = document.createElement("button");
      save.type = "button"; save.className = "btn small"; save.textContent = "Save";
      const cancel = document.createElement("button");
      cancel.type = "button"; cancel.className = "btn ghost small"; cancel.textContent = "Cancel";
      wrap.appendChild(input); wrap.appendChild(save); wrap.appendChild(cancel);
      div.innerHTML = "";
      div.appendChild(wrap);
      save.addEventListener("click", async () => {
        const t = input.value.trim();
        if (!t) { toast("Message can't be empty.", "err"); return; }
        await chatCol(chatRoom).doc(msgId).update({ text: t, editedAt: new Date().toISOString() });
        toast("Message updated.");
      });
      cancel.addEventListener("click", () => { if (chatRoom) setRoom(chatRoom); });
    }

    let richUnsub = null;
    function followRoom() {
      if (richUnsub) { richUnsub(); richUnsub = null; }
      if (!chatRoom) return;
      richUnsub = chatCol(chatRoom).orderBy("at", "asc").onSnapshot(richRender, (err) => console.error(err));
    }
    document.getElementById("roomList").addEventListener("click", () => setTimeout(followRoom, 0));
    const chatNav = Array.from(document.querySelectorAll(".nav-item")).find((b) => b.dataset.view === "chat");
    if (chatNav) chatNav.addEventListener("click", () => setTimeout(followRoom, 50));
    setTimeout(followRoom, 0);
  })();
  console.log("SPIDERWEB Drop 3 loaded.");
})();
/* SPIDERWEB-DROP3-END */
