/* SPIDERWEB DROP 11 v1 — User position (job title) manual entry for admins */
(function () {
  "use strict";
  if (window.__DROP11__) return;
  window.__DROP11__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .sw-pos{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--mut);font-size:.88rem}
    .sw-pos .sw-pos-label{overflow-wrap:anywhere}
    .sw-pos .btn{margin-left:auto}
  `;
  document.head.appendChild(style);

  const usersCol = () => db.collection("c").doc("users").collection("list");
  const isAdmin = () => !!(state.profile && state.profile.role === "admin");

  // ---- position modal ----
  if (!document.getElementById("posModal")) {
    document.body.insertAdjacentHTML("beforeend", `
      <div id="posModal" class="modal hidden" role="dialog" aria-modal="true">
        <section class="panel modal-box">
          <div class="modal-head"><h3 id="posTitle">Set position</h3><button class="icon-btn" data-posclose type="button" aria-label="Close">✕</button></div>
          <div class="field"><label for="posInput">Position / job title</label><input id="posInput" placeholder="Example: Web Developer, Designer, Accountant…" /></div>
          <p class="muted small">Type the position manually. Leave blank to clear it.</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button id="posSave" class="btn" type="button">Save position</button>
            <button class="btn ghost" type="button" data-posclose>Cancel</button>
          </div>
        </section>
      </div>`);
    document.querySelectorAll("#posModal [data-posclose]").forEach((b) => b.addEventListener("click", () => closeModal("posModal")));
  }

  let posTarget = null;
  function openPos(userId, label, current) {
    posTarget = userId;
    document.getElementById("posTitle").textContent = "Position — " + (label || "user");
    document.getElementById("posInput").value = current || "";
    openModal("posModal");
    setTimeout(() => { const i = document.getElementById("posInput"); if (i) i.focus(); }, 60);
  }
  document.getElementById("posSave").addEventListener("click", async () => {
    if (!posTarget) return;
    const val = document.getElementById("posInput").value.trim();
    const btn = document.getElementById("posSave");
    btn.disabled = true;
    try {
      await usersCol().doc(posTarget).update({ position: val });
      toast(val ? "Position saved." : "Position cleared.", "ok");
      if (window.swLog) swLog("set-position", "Position set to: " + (val || "(cleared)"));
      closeModal("posModal");
      if (window.D2 && window.D2.loadUsers) window.D2.loadUsers();
    } catch (e) {
      console.error(e);
      toast("Save failed: " + (e.message || e), "err");
    } finally { btn.disabled = false; }
  });

  // ---- match a team row to its user ----
  function findUserByRow(row) {
    const spans = row.querySelectorAll(".task-meta span");
    for (const s of spans) {
      const t = (s.textContent || "").trim().toLowerCase();
      if (t.indexOf("@") !== -1) {
        const u = (state.users || []).find((x) => (x.email || "").toLowerCase() === t);
        if (u) return u;
      }
    }
    return null;
  }

  // ---- inject position display + edit button into each team row ----
  let enhancing = false;
  function enhanceRows() {
    if (enhancing) return;
    const list = document.getElementById("teamList");
    if (!list) return;
    enhancing = true;
    const rows = list.querySelectorAll(".task-row");
    rows.forEach((row) => {
      if (row.querySelector(".sw-pos")) return;
      const u = findUserByRow(row);
      if (!u) return;
      const line = document.createElement("div");
      line.className = "task-meta sw-pos";
      const label = document.createElement("span");
      label.className = "sw-pos-label";
      label.textContent = u.position ? ("💼 " + u.position) : "💼 Position: —";
      line.appendChild(label);
      if (isAdmin()) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn ghost small";
        btn.textContent = u.position ? "Edit position" : "Set position";
        btn.addEventListener("click", () => openPos(u.id, u.name || u.email, u.position || ""));
        line.appendChild(btn);
      }
      const actions = row.querySelector(".doc-actions");
      if (actions) actions.insertAdjacentElement("beforebegin", line);
      else row.appendChild(line);
    });
    enhancing = false;
  }

  const list = document.getElementById("teamList");
  if (list) {
    new MutationObserver(() => setTimeout(enhanceRows, 120)).observe(list, { childList: true, subtree: true });
    enhanceRows();
  }

  console.log("SPIDERWEB Drop 11 v1 loaded.");
})();
/* SPIDERWEB-DROP11-END */
