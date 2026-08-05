/* SPIDERWEB DROP 2 — Tasks, Customers, Team approvals, Dashboard (add-on) */
(function () {
  "use strict";
  if (window.__DROP2__) return;
  window.__DROP2__ = true;

  const style = document.createElement("style");
  style.textContent = `
    select{width:100%;padding:13px 14px;border-radius:14px;border:2px solid rgba(230,36,46,.22);background:rgba(18,6,9,.62);color:var(--ink);outline:none}
    input[type="date"],select{color-scheme:dark}
    .task-list{display:grid;gap:12px}
    .task-row{display:grid;gap:8px;padding:14px 16px;border-radius:14px;border:2px solid var(--line);background:rgba(18,6,9,.35)}
    .task-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
    .task-title{font-weight:700}
    .task-meta{color:var(--mut);font-size:.86rem;display:flex;gap:12px;flex-wrap:wrap}
    .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px}
    .stat{padding:16px;border-radius:16px;border:2px solid var(--line);background:rgba(18,6,9,.35);display:grid;gap:6px}
    .stat b{font-family:var(--font-display);font-size:2rem;line-height:1}
    .stat span{color:var(--mut);font-size:.8rem;text-transform:uppercase;letter-spacing:.08em}
    .link{color:var(--blue)}
    .mini-list{display:grid;gap:8px}
    .mini-row{padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(18,6,9,.3);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .cust-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
  `;
  document.head.appendChild(style);

  const isAdmin = () => !!(state.profile && state.profile.role === "admin");
  const tasksCol = () => db.collection("c").doc("tasks").collection("list");
  const customersCol = () => db.collection("c").doc("customers").collection("list");
  const usersCol = () => db.collection("c").doc("users").collection("list");
  const todayStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const daysUntil = (iso) => Math.ceil((new Date(iso + "T00:00:00") - todayStart()) / 86400000);

  state.tasks = []; state.customers = []; state.users = [];

  const mainEl = document.querySelector(".main");
  const docsSection = document.getElementById("docGrid").closest("section");
  docsSection.id = "documentsView";

  mainEl.insertAdjacentHTML("beforeend", `
    <section class="panel hidden" id="tasksView">
      <div class="page-head">
        <div><h2>Tasks</h2><p>Deadlines, priorities and assignments. Overdue webs glow red.</p></div>
        <button id="newTaskBtn" class="btn" type="button">New task</button>
      </div>
      <div class="content">
        <div id="tasksEmpty" class="empty-state hidden"><h3>NO TASKS YET</h3><p>Spin a task, set a deadline, assign a spider.</p></div>
        <div id="taskList" class="task-list"></div>
      </div>
    </section>

    <section class="panel hidden" id="customersView">
      <div class="page-head">
        <div><h2>Customers</h2><p>Domains, contract expiry, assigned developer and attached signed contracts.</p></div>
        <button id="newCustomerBtn" class="btn" type="button">New customer</button>
      </div>
      <div class="content">
        <div id="custEmpty" class="empty-state hidden"><h3>NO CUSTOMERS YET</h3><p>Add your first customer and attach their signed contract.</p></div>
        <div id="custGrid" class="cust-grid"></div>
      </div>
    </section>

    <section class="panel hidden" id="teamView">
      <div class="page-head">
        <div><h2>Team approvals</h2><p>Approve, block or promote Studio OS users. Admin only.</p></div>
      </div>
      <div class="content"><div id="teamList" class="task-list"></div></div>
    </section>

    <section class="panel hidden" id="dashboardView">
      <div class="page-head">
        <div><h2>Dashboard</h2><p>The whole web at a glance.</p></div>
      </div>
      <div class="content">
        <div id="dashStats" class="stat-grid"></div>
        <div class="divider" style="margin:8px 0"></div>
        <div id="dashLists" class="sign-layout"></div>
      </div>
    </section>
  `);

  document.body.insertAdjacentHTML("beforeend", `
    <div id="taskModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>New task</h3><button class="icon-btn" data-close="taskModal" type="button" aria-label="Close">✕</button></div>
        <form id="taskForm">
          <div class="field"><label for="taskTitle">Task</label><input id="taskTitle" required placeholder="Example: Finish logo for Kebede Cafe" /></div>
          <div class="field"><label for="taskDue">Deadline</label><input id="taskDue" type="date" required /></div>
          <div class="field"><label for="taskPriority">Priority</label><select id="taskPriority"><option value="low">Low</option><option value="med" selected>Medium</option><option value="high">High</option></select></div>
          <div class="field"><label for="taskAssignee">Assign to</label><select id="taskAssignee"></select></div>
          <div class="field"><label for="taskNote">Note, optional</label><input id="taskNote" /></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" type="submit">Add task</button><button class="btn ghost" type="button" data-close="taskModal">Cancel</button></div>
        </form>
      </section>
    </div>

    <div id="customerModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>New customer</h3><button class="icon-btn" data-close="customerModal" type="button" aria-label="Close">✕</button></div>
        <form id="customerForm">
          <div class="field"><label for="custName">Customer / business</label><input id="custName" required placeholder="Example: Kebede Cafe" /></div>
          <div class="field"><label for="custDomain">Domain</label><input id="custDomain" placeholder="example.com" /></div>
          <div class="field"><label for="custExpiry">Contract expiry</label><input id="custExpiry" type="date" required /></div>
          <div class="field"><label for="custAssignee">Assigned to</label><select id="custAssignee"></select></div>
          <div class="field"><label for="custContract">Attach signed contract (optional)</label><select id="custContract"></select></div>
          <div class="field"><label for="custNotes">Notes, optional</label><input id="custNotes" /></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" type="submit">Add customer</button><button class="btn ghost" type="button" data-close="customerModal">Cancel</button></div>
        </form>
      </section>
    </div>

    <div id="attachModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>Attach contract</h3><button class="icon-btn" data-close="attachModal" type="button" aria-label="Close">✕</button></div>
        <div class="field"><label for="attachSelect">Document</label><select id="attachSelect"></select></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap"><button id="attachSaveBtn" class="btn" type="button">Attach</button><button class="btn ghost" type="button" data-close="attachModal">Cancel</button></div>
      </section>
    </div>
  `);

  const navButtons = Array.from(document.querySelectorAll(".nav-item"));
  function viewForLabel(t) {
    if (t.includes("Documents")) return "documents";
    if (t.includes("Tasks")) return "tasks";
    if (t.includes("Customers")) return "customers";
    if (t.includes("Team")) return "team";
    if (t.includes("Dashboard")) return "dashboard";
    return null;
  }
  navButtons.forEach((b) => {
    const v = viewForLabel(b.textContent);
    if (!v) return;
    b.dataset.view = v;
    b.disabled = false;
    b.classList.remove("locked");
    b.addEventListener("click", () => switchView(v));
  });

  function applyRoleGating() {
    navButtons.forEach((b) => {
      if (b.dataset.view === "team") b.classList.toggle("hidden", !isAdmin());
    });
    const nc = document.getElementById("newCustomerBtn");
    if (nc) nc.classList.toggle("hidden", !isAdmin());
  }

  function switchView(name) {
    ["documents", "tasks", "customers", "team", "dashboard"].forEach((v) => {
      const sec = document.getElementById(v + "View");
      if (sec) sec.classList.toggle("hidden", v !== name);
    });
    navButtons.forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    if (name === "tasks") loadTasks();
    if (name === "customers") loadCustomers();
    if (name === "team") loadUsers();
    if (name === "dashboard") loadDashboard();
  }

  const gateTimer = setInterval(() => {
    if (state.profile) { applyRoleGating(); clearInterval(gateTimer); }
  }, 250);
  setTimeout(() => clearInterval(gateTimer), 15000);
    // ============ shared pickers ============
  async function ensureUsers() {
    const snap = await usersCol().get();
    state.users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  function populatePeople(selectEl) {
    const people = state.users.filter((u) => u.status === "approved");
    selectEl.innerHTML = people.length
      ? people.map((u) => `<option value="${escapeHtml(u.email)}">${escapeHtml(u.name || u.email)}${u.role === "admin" ? " (admin)" : ""}</option>`).join("")
      : '<option value="">No approved users yet</option>';
  }

  function populateContracts(selectEl) {
    selectEl.innerHTML = (state.docs || []).length
      ? ['<option value="">— none —</option>'].concat(state.docs.map((d) => `<option value="${d.id}">${escapeHtml(d.title || d.fileName)}</option>`)).join("")
      : '<option value="">No documents uploaded yet</option>';
  }

  // ============ TASKS ============
  async function loadTasks() {
    try {
      const snap = await tasksCol().orderBy("due", "asc").get();
      state.tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTasks();
    } catch (err) {
      console.error(err);
      toast("Tasks load failed: " + err.message, "err");
    }
  }

  function taskBadge(t) {
    if (t.status === "done") return '<span class="signed">Done</span>';
    const d = daysUntil(t.due);
    if (d < 0) return `<span class="overdue">Overdue ${-d}d</span>`;
    if (d <= 3) return `<span class="pending">Due ${d === 0 ? "today" : "in " + d + "d"}</span>`;
    return '<span class="empty">Scheduled</span>';
  }

  function prioBadge(p) {
    if (p === "high") return '<span class="overdue">High</span>';
    if (p === "med") return '<span class="pending">Medium</span>';
    return '<span class="empty">Low</span>';
  }

  function renderTasks() {
    const list = document.getElementById("taskList");
    const empty = document.getElementById("tasksEmpty");
    list.innerHTML = "";
    if (!state.tasks.length) { empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");
    state.tasks.forEach((t) => {
      const row = document.createElement("div");
      row.className = "task-row";
      row.innerHTML = `
        <div class="task-top">
          <span class="task-title">${escapeHtml(t.title)}</span>
          <span>${prioBadge(t.priority)} ${taskBadge(t)}</span>
        </div>
        <div class="task-meta">
          <span>Due: ${escapeHtml(t.due || "—")}</span>
          <span>Assigned: ${escapeHtml(t.assigneeName || t.assignee || "Unassigned")}</span>
          <span>By: ${escapeHtml(t.createdByName || t.createdBy || "—")}</span>
        </div>
        ${t.note ? `<div class="task-meta">${escapeHtml(t.note)}</div>` : ""}
        <div class="doc-actions">
          <button class="btn small ${t.status === "done" ? "ghost" : "secondary"}" data-act="toggle" type="button">${t.status === "done" ? "Reopen" : "Mark done"}</button>
          ${isAdmin() ? '<button class="btn ghost small" data-act="del" type="button">Delete</button>' : ""}
        </div>`;
      row.querySelector('[data-act="toggle"]').addEventListener("click", async () => {
        const done = t.status === "done";
        await tasksCol().doc(t.id).update({ status: done ? "todo" : "done", completedAt: done ? null : new Date().toISOString() });
        toast(done ? "Task reopened." : "Task done. Thwip!");
        loadTasks();
      });
      const del = row.querySelector('[data-act="del"]');
      if (del) del.addEventListener("click", async () => {
        if (!confirm("Delete this task?")) return;
        await tasksCol().doc(t.id).delete();
        toast("Task deleted.");
        loadTasks();
      });
      list.appendChild(row);
    });
  }

  document.getElementById("newTaskBtn").addEventListener("click", async () => {
    await ensureUsers();
    populatePeople(document.getElementById("taskAssignee"));
    openModal("taskModal");
  });

  document.getElementById("taskForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("taskAssignee").value;
    const person = state.users.find((u) => u.email === email);
    try {
      await tasksCol().add({
        title: document.getElementById("taskTitle").value.trim(),
        due: document.getElementById("taskDue").value,
        priority: document.getElementById("taskPriority").value,
        assignee: email || "",
        assigneeName: person ? person.name : email,
        note: document.getElementById("taskNote").value.trim(),
        status: "todo",
        createdBy: state.user ? state.user.email : "",
        createdByName: state.profile ? state.profile.name : "",
        createdAt: new Date().toISOString()
      });
      toast("Task added to the web.");
      closeModal("taskModal");
      e.target.reset();
      loadTasks();
    } catch (err) {
      console.error(err);
      toast("Task failed: " + err.message, "err");
    }
  });

  // ============ CUSTOMERS ============
  async function loadCustomers() {
    try {
      const snap = await customersCol().orderBy("createdAt", "desc").get();
      state.customers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCustomers();
    } catch (err) {
      console.error(err);
      toast("Customers load failed: " + err.message, "err");
    }
  }

  function expiryBadge(c) {
    if (!c.contractExpiry) return '<span class="empty">No expiry set</span>';
    const d = daysUntil(c.contractExpiry);
    if (d < 0) return `<span class="overdue">Expired ${-d}d ago</span>`;
    if (d <= 30) return `<span class="pending">Expires in ${d}d</span>`;
    return '<span class="signed">Active</span>';
  }

  function renderCustomers() {
    const grid = document.getElementById("custGrid");
    const empty = document.getElementById("custEmpty");
    grid.innerHTML = "";
    if (!state.customers.length) { empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");
    state.customers.forEach((c) => {
      const card = document.createElement("article");
      card.className = "doc-card";
      card.innerHTML = `
        <div class="doc-top"><span class="doc-type">${escapeHtml(c.domain || "no domain")}</span>${expiryBadge(c)}</div>
        <h3 class="doc-title">${escapeHtml(c.name)}</h3>
        <div class="doc-meta">
          <span>Contract expires: ${escapeHtml(c.contractExpiry || "—")}</span>
          <span>Assigned: ${escapeHtml(c.assignedName || c.assignedTo || "Unassigned")}</span>
          ${c.contractUrl
            ? `<span>Contract: <a class="link" target="_blank" rel="noopener" href="${escapeHtml(c.contractUrl)}">${escapeHtml(c.contractName || "view")}</a></span>`
            : '<span>No contract attached</span>'}
          ${c.notes ? `<span>${escapeHtml(c.notes)}</span>` : ""}
        </div>
        ${isAdmin() ? `
        <div class="doc-actions">
          <button class="btn small" data-act="attach" type="button">Attach contract</button>
          <button class="btn secondary small" data-act="renew" type="button">Renew +1yr</button>
          <button class="btn ghost small" data-act="del" type="button">Delete</button>
        </div>` : ""}`;
      if (isAdmin()) {
        card.querySelector('[data-act="attach"]').addEventListener("click", () => openAttach(c));
        card.querySelector('[data-act="renew"]').addEventListener("click", async () => {
          const cur = c.contractExpiry ? new Date(c.contractExpiry + "T00:00:00") : new Date();
          const base = cur > new Date() ? cur : new Date();
          base.setFullYear(base.getFullYear() + 1);
          await customersCol().doc(c.id).update({ contractExpiry: base.toISOString().slice(0, 10) });
          toast("Contract renewed for one more year.");
          loadCustomers();
        });
        card.querySelector('[data-act="del"]').addEventListener("click", async () => {
          if (!confirm(`Delete customer "${c.name}"?`)) return;
          await customersCol().doc(c.id).delete();
          toast("Customer deleted.");
          loadCustomers();
        });
      }
      grid.appendChild(card);
    });
  }

  let attachTarget = null;
  function openAttach(customer) {
    attachTarget = customer.id;
    populateContracts(document.getElementById("attachSelect"));
    openModal("attachModal");
  }

  document.getElementById("attachSaveBtn").addEventListener("click", async () => {
    const docId = document.getElementById("attachSelect").value;
    const doc = (state.docs || []).find((d) => d.id === docId);
    if (!doc || !attachTarget) { toast("Pick a document first.", "err"); return; }
    await customersCol().doc(attachTarget).update({
      contractId: doc.id,
      contractName: doc.title || doc.fileName,
      contractUrl: doc.publicUrl
    });
    closeModal("attachModal");
    toast("Contract attached.");
    loadCustomers();
  });

  document.getElementById("newCustomerBtn").addEventListener("click", async () => {
    await ensureUsers();
    await loadDocs();
    populatePeople(document.getElementById("custAssignee"));
    populateContracts(document.getElementById("custContract"));
    openModal("customerModal");
  });

  document.getElementById("customerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("custAssignee").value;
    const person = state.users.find((u) => u.email === email);
    const docId = document.getElementById("custContract").value;
    const doc = (state.docs || []).find((d) => d.id === docId);
    try {
      await customersCol().add({
        name: document.getElementById("custName").value.trim(),
        domain: document.getElementById("custDomain").value.trim(),
        contractExpiry: document.getElementById("custExpiry").value,
        assignedTo: email || "",
        assignedName: person ? person.name : email,
        notes: document.getElementById("custNotes").value.trim(),
        contractId: doc ? doc.id : "",
        contractName: doc ? (doc.title || doc.fileName) : "",
        contractUrl: doc ? doc.publicUrl : "",
        createdBy: state.user ? state.user.email : "",
        createdAt: new Date().toISOString()
      });
      toast("Customer caught in the web.");
      closeModal("customerModal");
      e.target.reset();
      loadCustomers();
    } catch (err) {
      console.error(err);
      toast("Customer failed: " + err.message, "err");
    }
  });
    // ============ TEAM APPROVALS ============
  async function loadUsers() {
    try {
      const snap = await usersCol().get();
      state.users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTeam();
    } catch (err) {
      console.error(err);
      toast("Team load failed: " + err.message, "err");
    }
  }

  function renderTeam() {
    const list = document.getElementById("teamList");
    list.innerHTML = "";
    if (!state.users.length) {
      list.innerHTML = '<div class="empty-state"><h3>NO USERS YET</h3><p>When someone logs in, they appear here for approval.</p></div>';
      return;
    }
    state.users.forEach((u) => {
      const row = document.createElement("div");
      row.className = "task-row";
      const statusBadge = u.status === "approved"
        ? '<span class="signed">Approved</span>'
        : u.status === "pending" ? '<span class="pending">Pending</span>' : '<span class="overdue">Blocked</span>';
      const roleBadge = u.role === "admin" ? '<span class="overdue">Admin</span>' : '<span class="empty">Staff</span>';
      const protectedRow = u.email === "amanu@spiderweb.lol";
      row.innerHTML = `
        <div class="task-top">
          <span class="task-title">${escapeHtml(u.name || u.email)}</span>
          <span>${roleBadge} ${statusBadge}</span>
        </div>
        <div class="task-meta"><span>${escapeHtml(u.email)}</span>${u.createdAt ? `<span>Joined ${escapeHtml(formatDate(u.createdAt))}</span>` : ""}</div>
        ${isAdmin() && !protectedRow ? `
        <div class="doc-actions">
          ${u.status !== "approved" ? '<button class="btn small" data-act="approve" type="button">Approve</button>' : ""}
          ${u.status !== "blocked" ? '<button class="btn ghost small" data-act="block" type="button">Block</button>' : ""}
          <button class="btn secondary small" data-act="role" type="button">${u.role === "admin" ? "Make staff" : "Make admin"}</button>
                    <button class="btn ghost small" data-act="remove" type="button">Remove</button>
        </div>` : (protectedRow ? '<div class="task-meta">Owner account — protected.</div>' : "")}`;
      if (isAdmin() && !protectedRow) {
        const ap = row.querySelector('[data-act="approve"]');
        if (ap) ap.addEventListener("click", async () => {
          await usersCol().doc(u.id).update({ status: "approved" });
          toast(`${u.name || u.email} approved.`);
          loadUsers();
        });
        const bl = row.querySelector('[data-act="block"]');
        if (bl) bl.addEventListener("click", async () => {
          if (!confirm(`Block ${u.email}? They will see the waiting screen.`)) return;
          await usersCol().doc(u.id).update({ status: "blocked" });
          toast(`${u.email} blocked.`, "err");
          loadUsers();
        });
        row.querySelector('[data-act="role"]').addEventListener("click", async () => {
          const toAdmin = u.role !== "admin";
          if (toAdmin && !confirm(`Make ${u.email} an ADMIN? Admins can manage everything.`)) return;
          await usersCol().doc(u.id).update({ role: toAdmin ? "admin" : "staff" });
          toast(toAdmin ? "Promoted to admin." : "Moved to staff.");
          loadUsers();
        });
                row.querySelector('[data-act="remove"]').addEventListener("click", async () => {
          if (!confirm(`Remove ${u.email}? They will return to the pending screen on next login.`)) return;
          await usersCol().doc(u.id).delete();
          toast(`${u.email} removed from the web.`);
          loadUsers();
        });
      }
      list.appendChild(row);
    });
  }

  // ============ DASHBOARD ============
  async function loadDashboard() {
    try {
      await Promise.all([loadTasks(), loadCustomers(), ensureUsers(), loadDocs()]);
      renderDashboard();
    } catch (err) {
      console.error(err);
      toast("Dashboard load issue: " + err.message, "err");
    }
  }

  function renderDashboard() {
    const docs = state.docs || [];
    const signed = docs.filter((d) => (d.signatures || []).length >= Math.max(1, Number(d.requiredSignatures) || 1)).length;
    const openTasks = state.tasks.filter((t) => t.status !== "done");
    const overdue = openTasks.filter((t) => daysUntil(t.due) < 0);
    const expiring = state.customers.filter((c) => c.contractExpiry && daysUntil(c.contractExpiry) <= 30);
    const pendingUsers = state.users.filter((u) => u.status === "pending");

    document.getElementById("dashStats").innerHTML = `
      <div class="stat"><b>${docs.length}</b><span>Documents</span></div>
      <div class="stat"><b>${signed}</b><span>Fully signed</span></div>
      <div class="stat"><b>${docs.length - signed}</b><span>Awaiting ink</span></div>
      <div class="stat"><b>${openTasks.length}</b><span>Open tasks</span></div>
      <div class="stat"><b>${overdue.length}</b><span>Overdue</span></div>
      <div class="stat"><b>${expiring.length}</b><span>Expiring 30d</span></div>
      <div class="stat"><b>${pendingUsers.length}</b><span>Pending users</span></div>
    `;

    const wrap = document.getElementById("dashLists");
    wrap.innerHTML = "";
    const left = document.createElement("div");
    left.innerHTML = `
      <h4 style="margin:0 0 10px;font-family:var(--font-display);letter-spacing:.08em;color:var(--mut);text-transform:uppercase;">Overdue tasks</h4>
      <div class="mini-list">
        ${overdue.slice(0, 5).map((t) => `<div class="mini-row"><span>${escapeHtml(t.title)}</span><span class="overdue">${-daysUntil(t.due)}d late</span></div>`).join("") || '<div class="muted small">Nothing overdue. With great power…</div>'}
      </div>
      <h4 style="margin:18px 0 10px;font-family:var(--font-display);letter-spacing:.08em;color:var(--mut);text-transform:uppercase;">Pending users</h4>
      <div class="mini-list">
        ${pendingUsers.slice(0, 5).map((u) => `<div class="mini-row"><span>${escapeHtml(u.name || u.email)}</span><span class="pending">Needs approval</span></div>`).join("") || '<div class="muted small">No one is waiting at the door.</div>'}
      </div>`;
    const right = document.createElement("div");
    right.innerHTML = `
      <h4 style="margin:0 0 10px;font-family:var(--font-display);letter-spacing:.08em;color:var(--mut);text-transform:uppercase;">Contracts expiring ≤ 30 days</h4>
      <div class="mini-list">
        ${expiring.slice(0, 6).map((c) => `<div class="mini-row"><span>${escapeHtml(c.name)}</span><span class="${daysUntil(c.contractExpiry) < 0 ? "overdue" : "pending"}">${escapeHtml(c.contractExpiry)}</span></div>`).join("") || '<div class="muted small">No contracts near expiry.</div>'}
      </div>`;
    wrap.appendChild(left);
    wrap.appendChild(right);
  }

    document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-close]");
    if (btn) closeModal(btn.getAttribute("data-close"));
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") ["taskModal", "customerModal", "attachModal"].forEach((id) => closeModal(id));
  });
    // ---- Admin-signature-required + upgraded doc badges
  const chkStyle = document.createElement("style");
  chkStyle.textContent = `.chk{display:flex;align-items:center;gap:10px;text-transform:none;letter-spacing:0;font-size:.95rem;color:var(--ink)} .chk input{width:20px;height:20px;accent-color:var(--red)}`;
  document.head.appendChild(chkStyle);

  document.getElementById("docRequired").closest(".field").insertAdjacentHTML("afterend", `
    <div class="field">
      <label class="chk" for="docAdminReq"><input id="docAdminReq" type="checkbox" checked /> Admin signature required</label>
    </div>`);

  const realDocsCollection = docsCollection;
  window.docsCollection = function () {
    const col = realDocsCollection();
    return new Proxy(col, {
      get(target, prop) {
        if (prop === "add") {
          return (data) => {
            data.adminRequired = window.__adminReqPending === true;
            window.__adminReqPending = false;
            return target.add(data);
          };
        }
        const v = Reflect.get(target, prop);
        return typeof v === "function" ? v.bind(target) : v;
      }
    });
  };

  document.getElementById("uploadForm").addEventListener("submit", () => {
    window.__adminReqPending = document.getElementById("docAdminReq").checked;
  }, true);

  function adminEmails() {
    const set = new Set(["amanu@spiderweb.lol"]);
    (state.users || []).forEach((u) => { if (u.role === "admin") set.add((u.email || "").toLowerCase()); });
    return set;
  }

  window.renderDocs = function () {
    const term = els.docSearch.value.trim().toLowerCase();
    els.docGrid.innerHTML = "";
    const docs = state.docs.filter((doc) => {
      if (!term) return true;
      const haystack = [doc.title, doc.fileName, doc.notes, doc.uploadedByEmail, doc.uploadedByName, (doc.signatures || []).map((s) => s.name).join(" ")].join(" ").toLowerCase();
      return haystack.includes(term);
    });
    if (!docs.length) { els.docsEmpty.classList.remove("hidden"); return; }
    els.docsEmpty.classList.add("hidden");
    const isAdminUser = isAdmin();
    docs.forEach((doc) => {
      const sigs = Array.isArray(doc.signatures) ? doc.signatures : [];
      const count = sigs.length;
      const req = Math.max(1, Number(doc.requiredSignatures) || 1);
      const needsAdmin = !!doc.adminRequired;
      const hasAdmin = sigs.some((s) => adminEmails().has((s.email || "").toLowerCase()));
      const fully = count >= req && (!needsAdmin || hasAdmin);
      const badge = fully
        ? `<span class="signed">Fully signed ${count}/${req}</span>`
        : count > 0
          ? `<span class="pending">Signed ${count}/${req}${needsAdmin && !hasAdmin ? " + admin" : ""}</span>`
          : `<span class="pending">Awaiting signature</span>`;
      const deleteBtn = isAdminUser ? '<button class="btn ghost small" data-action="delete" type="button">Delete</button>' : "";
      const card = document.createElement("article");
      card.className = "doc-card";
      card.innerHTML = `
        <div class="doc-top"><span class="doc-type">${escapeHtml((doc.fileType || "file").split("/")[1] || "file")}</span>${badge}</div>
        <h3 class="doc-title">${escapeHtml(doc.title || doc.fileName || "Untitled document")}</h3>
        <div class="doc-meta">
          <span>File: ${escapeHtml(doc.fileName || "unknown")}</span>
          <span>Size: ${escapeHtml(formatBytes(doc.fileSize)) || "unknown"}</span>
          <span>Uploaded: ${escapeHtml(formatDate(doc.createdAt))}</span>
          <span>By: ${escapeHtml(doc.uploadedByName || doc.uploadedByEmail || "unknown")}</span>
          ${needsAdmin ? `<span>${hasAdmin ? "Admin ink: yes" : "Admin ink: required"}</span>` : ""}
        </div>
        <div class="divider"></div>
        <div class="doc-actions">
          <button class="btn small" data-action="sign" type="button">Sign</button>
          <button class="btn secondary small" data-action="signed" type="button" ${count === 0 ? "disabled" : ""}>Signed copy</button>
          <button class="btn ghost small" data-action="download" type="button">Download</button>
          ${deleteBtn}
        </div>`;
      card.querySelector('[data-action="sign"]').addEventListener("click", () => openSignModal(doc.id));
      card.querySelector('[data-action="signed"]').addEventListener("click", () => buildSignedCopy(doc));
      card.querySelector('[data-action="download"]').addEventListener("click", () => downloadDocument(doc));
      const del = card.querySelector('[data-action="delete"]');
      if (del) del.addEventListener("click", () => deleteDocument(doc));
      els.docGrid.appendChild(card);
    });
  };
    // ---- Self-signup (creates pending staff account)
  document.querySelector("#authView .auth-card").insertAdjacentHTML("beforeend", `
    <div class="divider" style="margin:18px 0"></div>
    <h3 style="margin:0;font-family:var(--font-display);letter-spacing:.06em;">JOIN THE CREW</h3>
    <p class="muted small" style="margin:6px 0 14px">Creates a staff account that stays locked until Amanuel approves it.</p>
    <form id="signupForm">
      <div class="field"><label for="signupName">Full name</label><input id="signupName" required placeholder="Example: Zidan Ali" /></div>
      <div class="field"><label for="signupEmail">Email</label><input id="signupEmail" type="email" required placeholder="you@spiderweb.lol" /></div>
      <div class="field"><label for="signupPassword">Password (6+ characters)</label><input id="signupPassword" type="password" required minlength="6" /></div>
      <button id="signupBtn" class="btn secondary" type="submit" style="width:100%">Create account</button>
    </form>
  `);

  document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const pass = document.getElementById("signupPassword").value;
    if (pass.length < 6) { toast("Password needs 6+ characters.", "err"); return; }
    const btn = document.getElementById("signupBtn");
    btn.disabled = true;
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      toast("Account created — waiting for admin approval.");
      const uid = cred.user.uid;
      for (let i = 0; i < 12; i++) {
        const snap = await db.collection("c").doc("users").collection("list").doc(uid).get();
        if (snap.exists) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      await db.collection("c").doc("users").collection("list").doc(uid).update({ name });
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") toast("That email already has an account — log in above.", "err");
      else toast(err.message || "Signup failed.", "err");
    } finally { btn.disabled = false; }
  });
    // ---- Collapse signup behind a "Join The Crew" link
  (function () {
    const card = document.querySelector("#authView .auth-card");
    if (!card) return;
    const form = document.getElementById("signupForm");
    const h3 = card.querySelector("h3");
    const para = card.querySelector("p.muted");
    const divider = card.querySelector(".divider");
    if (!form || !h3) return;
    [form, h3, para, divider].forEach((el) => { if (el) el.classList.add("hidden"); });
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn ghost";
    toggle.style.width = "100%";
    toggle.style.marginTop = "14px";
    toggle.textContent = "Join The Crew";
    card.appendChild(toggle);
    toggle.addEventListener("click", () => {
      const reveal = form.classList.contains("hidden");
      [form, h3, para, divider].forEach((el) => { if (el) el.classList.toggle("hidden", !reveal); });
      toggle.textContent = reveal ? "Hide signup" : "Join The Crew";
    });
  })();
    // ---- Nav order: Dashboard above Documents
  (function () {
    const dashBtn = navButtons.find((b) => b.dataset.view === "dashboard");
    const docsBtn = navButtons.find((b) => b.dataset.view === "documents");
    if (dashBtn && docsBtn) docsBtn.parentNode.insertBefore(dashBtn, docsBtn);
  })();
    window.D2 = { switchView, loadTasks, loadCustomers, loadUsers, loadDashboard };
  console.log("SPIDERWEB Drop 2 loaded.");
})();
/* SPIDERWEB-DROP2-END */
