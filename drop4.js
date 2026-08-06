/* SPIDERWEB DROP 4 v2 — Clients, Team dropdown w/ Client designation, cancellations */
(function () {
  "use strict";
  if (window.__DROP4__) return;
  window.__DROP4__ = true;
  if (!window.D2) console.warn("Drop 4: missing Drop 2 export patch.");

  const FB_API_KEY = FIREBASE_CONFIG.apiKey;
  const clientsCol = () => db.collection("c").doc("clients").collection("list");
  const customersCol4 = () => db.collection("c").doc("customers").collection("list");

  const style4 = document.createElement("style");
  style4.textContent = `.desig-client{color:#9ec1ff;border-color:rgba(61,123,255,.4);background:rgba(61,123,255,.1)}`;
  document.head.appendChild(style4);

  function delDone(dr) {
    return dr && Array.isArray(dr.approvals) && dr.approvals.some((s) => s.role === "admin") && dr.approvals.some((s) => s.role === "client");
  }
  function typedInk4(name) {
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
  function buildSig4(name, method, ink) {
    return {
      name, email: state.user ? state.user.email : "", uid: state.user ? state.user.uid : "",
      role: "admin", method, device: (navigator.userAgent || "") + " · " + new Date().toLocaleString(),
      signedAt: new Date().toISOString(), ink
    };
  }

  // global view-leak fix
  document.addEventListener("click", (e) => {
    const nb = e.target.closest(".nav-item");
    if (!nb || !nb.dataset.view) return;
    ["documents", "tasks", "customers", "team", "dashboard", "payments", "chat", "clients"].forEach((v) => {
      const sec = document.getElementById(v + "View");
      if (sec && v !== nb.dataset.view) sec.classList.add("hidden");
    });
    if (nb.dataset.view === "team") setTimeout(() => { renderClientsTeam(); applyTeamFilter(); }, 400);
    if (nb.dataset.view === "customers") setTimeout(renderCancelPanel, 400);
  }, true);

  // ---- Clients nav + view
  const navSec = document.querySelector(".side .nav");
  const allNav4 = () => Array.from(document.querySelectorAll(".nav-item"));
  const clientsBtn = document.createElement("button");
  clientsBtn.className = "nav-item";
  clientsBtn.type = "button";
  clientsBtn.dataset.view = "clients";
  clientsBtn.innerHTML = '<span>Clients</span><span class="state">Drop 4</span>';
  clientsBtn.addEventListener("click", () => switchView4("clients"));
  const teamBtn4 = allNav4().find((x) => x.textContent.includes("Team"));
  navSec.insertBefore(clientsBtn, teamBtn4);

  const mainEl = document.querySelector(".main");
  mainEl.insertAdjacentHTML("beforeend", `
    <section class="panel hidden" id="clientsView">
      <div class="page-head">
        <div><h2>Clients</h2><p>Create client portal logins. Clients get chat, receipts — and they countersign cancellations.</p></div>
        <button id="newClientBtn" class="btn" type="button">New client login</button>
      </div>
      <div class="content">
        <div id="clientsEmpty" class="empty-state hidden"><h3>NO CLIENT LOGINS</h3><p>Create one and share the email + temporary password.</p></div>
        <div id="clientsList" class="task-list"></div>
      </div>
    </section>

    <div id="clientModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>New client login</h3><button class="icon-btn" data-close="clientModal" type="button" aria-label="Close">✕</button></div>
        <form id="clientForm">
          <div class="field"><label for="clName">Client name</label><input id="clName" required placeholder="Example: Kebede T." /></div>
          <div class="field"><label for="clEmail">Email</label><input id="clEmail" type="email" required placeholder="client@example.com" /></div>
          <div class="field"><label for="clPass">Temporary password (6+ chars)</label><input id="clPass" required minlength="6" placeholder="Share it with the client" /></div>
          <div class="field"><label for="clCustomer">Customer card</label><select id="clCustomer"></select></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" type="submit">Create login</button><button class="btn ghost" type="button" data-close="clientModal">Cancel</button></div>
        </form>
      </section>
    </div>

    <div id="credModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>Share with client</h3><button class="icon-btn" data-close="credModal" type="button" aria-label="Close">✕</button></div>
        <p class="muted small">Send these securely — the password is shown once.</p>
        <div class="field"><label>Portal link</label><input id="credLink" readonly /></div>
        <div class="field"><label>Email</label><input id="credEmail" readonly /></div>
        <div class="field"><label>Temporary password</label><input id="credPass" readonly /></div>
        <button class="btn" id="credCopyBtn" type="button">Copy all</button>
      </section>
    </div>

    <div id="d4SignModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3 id="d4SignTitle">Admin ink</h3><button class="icon-btn" data-close="d4SignModal" type="button" aria-label="Close">✕</button></div>
        <div class="field"><label for="d4SignName">Signer name</label><input id="d4SignName" placeholder="Full name" /></div>
        <div class="sign-tabs">
          <button id="d4TabOne" class="sign-tab active" type="button">One-click</button>
          <button id="d4TabDraw" class="sign-tab" type="button">Draw</button>
        </div>
        <section id="d4OnePane" class="sign-pad">
          <p class="muted small">Your ink starts the request — the client's ink completes it.</p>
          <button id="d4OneBtn" class="btn" type="button">Sign with one click</button>
        </section>
        <section id="d4DrawPane" class="sign-pad hidden">
          <div class="canvas-wrap"><canvas id="d4Canvas"></canvas><div class="canvas-hint">Draw with mouse, finger, or stylus.</div></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button id="d4Clear" class="btn ghost" type="button">Clear</button>
            <button id="d4DrawBtn" class="btn secondary" type="button">Sign with drawing</button>
          </div>
        </section>
      </section>
    </div>
  `);

  function switchView4(name) {
    if (window.D2) window.D2.switchView(name);
    ["payments", "chat"].forEach((v) => document.getElementById(v + "View").classList.add("hidden"));
    document.getElementById("clientsView").classList.toggle("hidden", name !== "clients");
    allNav4().forEach((nb) => { if (nb.dataset.view === "clients") nb.classList.toggle("active", name === "clients"); });
    if (name === "clients") loadClients();
  }

  // ---- d4 sign modal machinery
  let d4OnSign = null;
  let d4Drawing = false, d4Last = null, d4Ctx = null, d4HasInk = false;
  function openD4Sign(title, cb) {
    d4OnSign = cb;
    document.getElementById("d4SignTitle").textContent = title;
    document.getElementById("d4SignName").value = state.profile ? state.profile.name : "";
    d4TabSwitch("one");
    openModal("d4SignModal");
  }
  function d4TabSwitch(which) {
    const one = which === "one";
    document.getElementById("d4TabOne").classList.toggle("active", one);
    document.getElementById("d4TabDraw").classList.toggle("active", !one);
    document.getElementById("d4OnePane").classList.toggle("hidden", !one);
    document.getElementById("d4DrawPane").classList.toggle("hidden", one);
    if (!one) requestAnimationFrame(d4Resize);
  }
  document.getElementById("d4TabOne").addEventListener("click", () => d4TabSwitch("one"));
  document.getElementById("d4TabDraw").addEventListener("click", () => d4TabSwitch("draw"));
  function d4Resize() {
    const canvas = document.getElementById("d4Canvas");
    const rect = canvas.parentElement.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(220 * ratio);
    canvas.style.height = "220px";
    d4Ctx = canvas.getContext("2d");
    d4Ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    d4Ctx.clearRect(0, 0, canvas.width, canvas.height);
    d4Ctx.lineWidth = 3; d4Ctx.lineCap = "round"; d4Ctx.lineJoin = "round";
    d4Ctx.strokeStyle = "#22080d";
    d4HasInk = false;
  }
  function d4Pos(e) {
    const rect = document.getElementById("d4Canvas").getBoundingClientRect();
    const cx = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const cy = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  }
  const d4CanvasEl = document.getElementById("d4Canvas");
  d4CanvasEl.addEventListener("pointerdown", (e) => { e.preventDefault(); d4Drawing = true; d4HasInk = true; d4Last = d4Pos(e); });
  d4CanvasEl.addEventListener("pointermove", (e) => {
    if (!d4Drawing || !d4Ctx) return;
    e.preventDefault();
    const p = d4Pos(e);
    d4Ctx.beginPath(); d4Ctx.moveTo(d4Last.x, d4Last.y); d4Ctx.lineTo(p.x, p.y); d4Ctx.stroke();
    d4Last = p;
  });
  ["pointerup", "pointercancel"].forEach((ev) => window.addEventListener(ev, () => { d4Drawing = false; }));
  document.getElementById("d4Clear").addEventListener("click", () => {
    const canvas = document.getElementById("d4Canvas");
    if (!d4Ctx) return;
    d4Ctx.save(); d4Ctx.setTransform(1, 0, 0, 1, 0, 0); d4Ctx.clearRect(0, 0, canvas.width, canvas.height); d4Ctx.restore();
    d4HasInk = false;
  });
  function d4Collect(name, method, ink) {
    if (!name) { toast("Enter signer name first.", "err"); return null; }
    return buildSig4(name, method, ink);
  }
  document.getElementById("d4OneBtn").addEventListener("click", () => {
    const sig = d4Collect(document.getElementById("d4SignName").value.trim(), "one-click", typedInk4(document.getElementById("d4SignName").value.trim()));
    if (!sig) return;
    closeModal("d4SignModal");
    if (d4OnSign) d4OnSign(sig);
  });
  document.getElementById("d4DrawBtn").addEventListener("click", () => {
    if (!d4HasInk) { toast("Draw a signature first.", "err"); return; }
    const name = document.getElementById("d4SignName").value.trim();
    const sig = d4Collect(name, "gesture", document.getElementById("d4Canvas").toDataURL("image/png"));
    if (!sig) return;
    closeModal("d4SignModal");
    if (d4OnSign) d4OnSign(sig);
  });

  // ---- Clients view (create / remove logins)
  async function loadClients() {
    try {
      const snap = await clientsCol().orderBy("createdAt", "desc").get();
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const list = document.getElementById("clientsList");
      const empty = document.getElementById("clientsEmpty");
      list.innerHTML = "";
      if (!rows.length) { empty.classList.remove("hidden"); return; }
      empty.classList.add("hidden");
      rows.forEach((c) => {
        const row = document.createElement("div");
        row.className = "task-row";
        row.innerHTML = `
          <div class="task-top"><span class="task-title">${escapeHtml(c.name)}</span><span class="pending desig-client">Client</span></div>
          <div class="task-meta"><span>${escapeHtml(c.email)}</span><span>Customer: ${escapeHtml(c.customerName || "—")}</span><span>Created: ${escapeHtml(formatDate(c.createdAt))}</span></div>
          <div class="doc-actions"><button class="btn ghost small" data-act="del" type="button">Remove login</button></div>`;
        row.querySelector('[data-act="del"]').addEventListener("click", async () => {
          if (!confirm(`Remove portal access for ${c.email}?`)) return;
          await clientsCol().doc(c.id).delete();
          toast("Client login removed.");
          loadClients();
        });
        list.appendChild(row);
      });
    } catch (err) { console.error(err); toast("Clients load failed: " + err.message, "err"); }
  }

  async function createClientAuth(email, pass) {
    const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + FB_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass, returnSecureToken: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ? data.error.message : "Auth create failed");
    return data.localId;
  }

  document.getElementById("newClientBtn").addEventListener("click", async () => {
    if (window.D2) { try { await D2.loadCustomers(); } catch (e) {} }
    const sel = document.getElementById("clCustomer");
    sel.innerHTML = '<option value="">— none —</option>' + (state.customers || []).map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    openModal("clientModal");
  });

  document.getElementById("clientForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("clName").value.trim();
    const email = document.getElementById("clEmail").value.trim();
    const pass = document.getElementById("clPass").value;
    const custId = document.getElementById("clCustomer").value;
    const cust = (state.customers || []).find((c) => c.id === custId);
    try {
      const uid = await createClientAuth(email, pass);
      await clientsCol().doc(uid).set({
        uid, name, email,
        customerId: custId || "",
        customerName: cust ? cust.name : "",
        status: "approved",
        createdAt: new Date().toISOString(),
        createdBy: state.user ? state.user.email : ""
      });
      toast("Client login created.");
      closeModal("clientModal");
      e.target.reset();
      document.getElementById("credLink").value = location.origin + "/client.html";
      document.getElementById("credEmail").value = email;
      document.getElementById("credPass").value = pass;
      openModal("credModal");
      loadClients();
    } catch (err) { console.error(err); toast("Create failed: " + err.message, "err"); }
  });

  document.getElementById("credCopyBtn").addEventListener("click", async () => {
    const txt = "Spiderweb client portal: " + document.getElementById("credLink").value +
      " | email: " + document.getElementById("credEmail").value +
      " | temp password: " + document.getElementById("credPass").value;
    try { await navigator.clipboard.writeText(txt); toast("Copied — paste it to your client."); }
    catch (e) { toast("Copy failed — select the fields manually.", "err"); }
  });

  // ---- payments: customer link (for drop3)
  document.getElementById("payBank").closest(".field").insertAdjacentHTML("beforebegin",
    '<div class="field"><label for="payCustomer">Customer (shows in client portal)</label><select id="payCustomer"></select></div>');
  document.getElementById("newPaymentBtn").addEventListener("click", async () => {
    if (window.D2) { try { await D2.loadCustomers(); } catch (e) {} }
    const sel = document.getElementById("payCustomer");
    sel.innerHTML = '<option value="">— none —</option>' + (state.customers || []).map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }, true);
  document.getElementById("paymentForm").addEventListener("submit", () => {
    const sel = document.getElementById("payCustomer");
    const cust = (state.customers || []).find((c) => c.id === sel.value);
    window.__payCustomerId = cust ? cust.id : "";
    window.__payCustomerName = cust ? cust.name : "";
  }, true);

  // ---- Team approvals: dropdown + Client designation
  const teamContent = document.getElementById("teamView").querySelector(".content");
  teamContent.insertAdjacentHTML("afterbegin", `
    <div class="field" style="max-width:280px">
      <label for="teamFilter">User type</label>
      <select id="teamFilter">
        <option value="all">All users</option>
        <option value="staff">Staff</option>
        <option value="admin">Admins</option>
        <option value="client">Clients</option>
      </select>
    </div>
    <div id="clientsTeamWrap" style="display:grid;gap:10px;margin-bottom:14px">
      <h4 style="margin:0;font-family:var(--font-display);letter-spacing:.08em;color:var(--mut);text-transform:uppercase">Client accounts</h4>
      <div id="clientsTeamList" class="task-list"></div>
    </div>`);
  document.getElementById("teamFilter").addEventListener("change", applyTeamFilter);
  new MutationObserver(() => applyTeamFilter()).observe(document.getElementById("teamList"), { childList: true });

  function applyTeamFilter() {
    const sel = document.getElementById("teamFilter");
    if (!sel) return;
    const v = sel.value;
    const crewList = document.getElementById("teamList");
    const wrap = document.getElementById("clientsTeamWrap");
    wrap.classList.toggle("hidden", v === "staff" || v === "admin");
    crewList.style.display = v === "client" ? "none" : "";
    Array.from(crewList.children).forEach((row) => {
      if (v === "all" || v === "client") { row.style.display = ""; return; }
      const isAdm = row.textContent.includes("Admin");
      row.style.display = (v === "admin" ? isAdm : !isAdm) ? "" : "none";
    });
  }

  async function renderClientsTeam() {
    const list = document.getElementById("clientsTeamList");
    if (!list) return;
    try {
      const snap = await clientsCol().orderBy("createdAt", "desc").get();
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.innerHTML = "";
      if (!rows.length) { list.innerHTML = '<div class="muted small">No client accounts yet.</div>'; return; }
      rows.forEach((c) => {
        const st = c.status || "approved";
        const stBadge = st === "approved" ? '<span class="signed">Approved</span>' : st === "pending" ? '<span class="pending">Pending</span>' : '<span class="overdue">Blocked</span>';
        const row = document.createElement("div");
        row.className = "task-row";
        row.innerHTML = `
          <div class="task-top"><span class="task-title">${escapeHtml(c.name || c.email)}</span><span><span class="pending desig-client">Client</span> ${stBadge}</span></div>
          <div class="task-meta"><span>${escapeHtml(c.email)}</span><span>Customer: ${escapeHtml(c.customerName || "—")}</span></div>
          ${c.delRequest && !delDone(c.delRequest) ? '<div class="task-meta" style="color:#ff8f8f">Cancellation pending client ink</div>' : ""}
          <div class="doc-actions">
            ${st !== "approved" ? '<button class="btn small" data-act="appr" type="button">Approve</button>' : ""}
            ${st !== "blocked" ? '<button class="btn ghost small" data-act="blk" type="button">Block</button>' : ""}
            ${!c.delRequest ? '<button class="btn ghost small" data-act="cxl" type="button">Request cancellation</button>' : ""}
            ${c.delRequest && delDone(c.delRequest) ? '<button class="btn ghost small" data-act="fin" type="button">Finalize cancellation</button>' : ""}
            <button class="btn ghost small" data-act="rm" type="button">Remove login</button>
          </div>`;
        const ap = row.querySelector('[data-act="appr"]');
        if (ap) ap.addEventListener("click", async () => {
          await clientsCol().doc(c.id).update({ status: "approved" });
          toast(`${c.email} approved.`);
          renderClientsTeam();
        });
        const bl = row.querySelector('[data-act="blk"]');
        if (bl) bl.addEventListener("click", async () => {
          if (!confirm(`Block ${c.email}? Their portal locks.`)) return;
          await clientsCol().doc(c.id).update({ status: "blocked" });
          toast(`${c.email} blocked.`);
          renderClientsTeam();
        });
        const cx = row.querySelector('[data-act="cxl"]');
        if (cx) cx.addEventListener("click", () => {
          openD4Sign("Authorize MEMBERSHIP cancellation: " + (c.name || c.email), async (sig) => {
            await clientsCol().doc(c.id).update({
              delRequest: { what: "membership", clientEmail: c.email, requestedBy: state.user.email, requestedAt: new Date().toISOString(), approvals: [sig] }
            });
            toast("Cancellation requested — waiting for the client's ink.");
            renderClientsTeam();
          });
        });
        const fn = row.querySelector('[data-act="fin"]');
        if (fn) fn.addEventListener("click", async () => {
          if (!confirm("Both inks recorded — cancel this membership now?")) return;
          await clientsCol().doc(c.id).delete();
          toast("Membership cancelled with admin + client inks.");
          renderClientsTeam();
        });
        row.querySelector('[data-act="rm"]').addEventListener("click", async () => {
          if (!confirm(`Remove portal access for ${c.email}?`)) return;
          await clientsCol().doc(c.id).delete();
          toast("Client login removed.");
          renderClientsTeam();
        });
        list.appendChild(row);
      });
    } catch (e) { console.error(e); }
  }

  // ---- Customers: contract cancellation panel
  const custContent = document.getElementById("customersView").querySelector(".content");
  custContent.insertAdjacentHTML("beforeend", `
    <div class="divider" style="margin:16px 0"></div>
    <h3 style="margin:0 0 10px;font-family:var(--font-display);letter-spacing:.06em;color:var(--mut);text-transform:uppercase">Contract cancellation (client countersigns)</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
      <div class="field" style="flex:1;min-width:220px;margin:0"><label for="cancelCustomer">Customer</label><select id="cancelCustomer"></select></div>
      <button id="cancelRequestBtn" class="btn ghost" type="button">Request cancellation</button>
    </div>
    <div id="pendingCancels" class="task-meta" style="margin-top:10px"></div>`);

  function renderCancelPanel() {
    const sel = document.getElementById("cancelCustomer");
    if (!sel) return;
    if (window.D2) { D2.loadCustomers().catch(() => {}); }
    sel.innerHTML = '<option value="">— choose —</option>' + (state.customers || []).filter((c) => !c.delRequest).map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    const pend = (state.customers || []).filter((c) => c.delRequest && !delDone(c.delRequest));
    document.getElementById("pendingCancels").innerHTML = pend.length
      ? pend.map((c) => `<div style="color:#ff8f8f">• ${escapeHtml(c.name)} — cancellation pending client ink (${escapeHtml(c.delRequest.clientEmail || "")})</div>`).join("")
      : "";
  }

  document.getElementById("cancelRequestBtn").addEventListener("click", () => {
    const id = document.getElementById("cancelCustomer").value;
    const cust = (state.customers || []).find((c) => c.id === id);
    if (!cust) { toast("Pick a customer first.", "err"); return; }
    (async () => {
      try {
        const cs = await clientsCol().where("customerId", "==", cust.id).get();
        if (cs.empty) { toast("No client login for this customer yet — create one under Clients first.", "err"); return; }
        const client = cs.docs[0].data();
        openD4Sign("Authorize CONTRACT cancellation: " + cust.name, async (sig) => {
          await customersCol4().doc(cust.id).update({
            delRequest: { what: "customer", clientEmail: client.email, requestedBy: state.user.email, requestedAt: new Date().toISOString(), approvals: [sig] }
          });
          toast("Cancellation requested — waiting for the client's ink.");
          renderCancelPanel();
        });
      } catch (e) { toast("Lookup failed: " + e.message, "err"); }
    })();
  });

  console.log("SPIDERWEB Drop 4 v2 loaded.");
})();
/* SPIDERWEB-DROP4-END */
