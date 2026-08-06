/* SPIDERWEB DROP 7 — admin can edit crew accounts */
(function () {
  "use strict";
  if (window.__DROP7__) return;
  window.__DROP7__ = true;

  const usersCol7 = () => db.collection("c").doc("users").collection("list");
  const OWNER = "amanu@spiderweb.lol";

  document.body.insertAdjacentHTML("beforeend", `
    <div id="userEditModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>Edit team account</h3><button class="icon-btn" data-close="userEditModal" type="button" aria-label="Close">✕</button></div>
        <div class="field"><label for="uEmail">Email (fixed — it's the login)</label><input id="uEmail" readonly /></div>
        <div class="field"><label for="uName">Display name</label><input id="uName" required /></div>
        <div class="field"><label for="uRole">Role</label><select id="uRole"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
        <div class="field"><label for="uStatus">Status</label><select id="uStatus"><option value="approved">Approved</option><option value="pending">Pending</option><option value="blocked">Blocked</option></select></div>
        <p class="muted small">To change someone's email, remove their account and create a new one.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap"><button id="uSave" class="btn" type="button">Save changes</button><button class="btn ghost" type="button" data-close="userEditModal">Cancel</button></div>
      </section>
    </div>`);

  let editTarget = null;

  function decorate() {
    const list = document.getElementById("teamList");
    if (!list) return;
    Array.from(list.children).forEach((row, i) => {
      if (row.dataset.d7) return;
      row.dataset.d7 = "1";
      const u = (state.users || [])[i];
      if (!u) return;
      if ((u.email || "").toLowerCase() === OWNER) return; // owner locked
      let bar = row.querySelector(".doc-actions");
      if (!bar) { bar = document.createElement("div"); bar.className = "doc-actions"; row.appendChild(bar); }
      const b = document.createElement("button");
      b.className = "btn secondary small";
      b.type = "button";
      b.textContent = "✎ Edit";
      b.addEventListener("click", () => openEdit(u));
      bar.appendChild(b);
    });
  }
  const tl = document.getElementById("teamList");
  if (tl) new MutationObserver(decorate).observe(tl, { childList: true, subtree: true });
  decorate();

  function openEdit(u) {
    editTarget = u;
    document.getElementById("uEmail").value = u.email || "";
    document.getElementById("uName").value = u.name || "";
    document.getElementById("uRole").value = u.role === "admin" ? "admin" : "staff";
    document.getElementById("uStatus").value = u.status || "approved";
    openModal("userEditModal");
  }

  document.getElementById("uSave").addEventListener("click", async () => {
    if (!editTarget) return;
    const name = document.getElementById("uName").value.trim();
    if (!name) { toast("Name can't be empty.", "err"); return; }
    const patch = {
      name,
      role: document.getElementById("uRole").value,
      status: document.getElementById("uStatus").value
    };
    if ((editTarget.email || "").toLowerCase() === OWNER) { patch.role = "admin"; patch.status = "approved"; }
    try {
      await usersCol7().doc(editTarget.id).update(patch);
      toast("Account updated.");
      closeModal("userEditModal");
      if (window.D2) D2.loadUsers();
    } catch (e) { toast("Update failed: " + e.message, "err"); }
  });

  console.log("SPIDERWEB Drop 7 loaded.");
})();
/* SPIDERWEB-DROP7-END */
