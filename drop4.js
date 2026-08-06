/* SPIDERWEB DROP 4 — Client login manager + payments↔customers */
(function () {
  "use strict";
  if (window.__DROP4__) return;
  window.__DROP4__ = true;
  if (!window.D2) console.warn("Drop 4: missing Drop 2 export patch.");

  const FB_API_KEY = FIREBASE_CONFIG.apiKey;
  const clientsCol = () => db.collection("c").doc("clients").collection("list");

  // global view-leak fix: any nav click hides every view except the target
  document.addEventListener("click", (e) => {
    const nb = e.target.closest(".nav-item");
    if (!nb || !nb.dataset.view) return;
    ["documents", "tasks", "customers", "team", "dashboard", "payments", "chat", "clients"].forEach((v) => {
      const sec = document.getElementById(v + "View");
      if (sec && v !== nb.dataset.view) sec.classList.add("hidden");
    });
  }, true);

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
        <div><h2>Clients</h2><p>Create client portal logins. Clients get their room chat + payment receipts.</p></div>
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
  `);

  function switchView4(name) {
    if (window.D2) window.D2.switchView(name);
    ["payments", "chat"].forEach((v) => document.getElementById(v + "View").classList.add("hidden"));
    document.getElementById("clientsView").classList.toggle("hidden", name !== "clients");
    allNav4().forEach((nb) => { if (nb.dataset.view === "clients") nb.classList.toggle("active", name === "clients"); });
    if (name === "clients") loadClients();
  }

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
          <div class="task-top"><span class="task-title">${escapeHtml(c.name)}</span><span class="signed">Client</span></div>
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

  // payments: customer link
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

  console.log("SPIDERWEB Drop 4 loaded.");
})();
/* SPIDERWEB-DROP4-END */
