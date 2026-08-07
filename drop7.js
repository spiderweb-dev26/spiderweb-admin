/* SPIDERWEB DROP 7 v3 — account editing w/ verify-before-update email */
(function () {
  "use strict";
  if (window.__DROP7__) return;
  window.__DROP7__ = true;

  const FB_KEY7 = FIREBASE_CONFIG.apiKey;
  const usersCol7 = () => db.collection("c").doc("users").collection("list");
  const OWNER = "amanu@spiderweb.lol";

  document.body.insertAdjacentHTML("beforeend", `
    <div id="userEditModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>Edit team account</h3><button class="icon-btn" data-close="userEditModal" type="button" aria-label="Close">✕</button></div>
        <div class="field"><label for="uName">Display name</label><input id="uName" required /></div>
        <div class="field"><label for="uEmail">Email</label><input id="uEmail" type="email" required /></div>
        <div class="field"><label for="uRole">Role</label><select id="uRole"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
        <div class="field"><label for="uStatus">Status</label><select id="uStatus"><option value="approved">Approved</option><option value="pending">Pending</option><option value="blocked">Blocked</option></select></div>
        <div class="field" id="uPassWrap"><label for="uPass" id="uPassLabel">New password (optional — applies to your login)</label><input id="uPass" type="password" placeholder="6+ characters" /></div>
        <div id="uCreds" class="task-meta hidden" style="margin-bottom:12px"></div>
        <p class="muted small" id="uHint"></p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button id="uSave" class="btn" type="button">Save changes</button>
          <button id="uResetLink" class="btn ghost hidden" type="button">Send password reset email</button>
          <button class="btn ghost" type="button" data-close="userEditModal">Cancel</button>
        </div>
      </section>
    </div>`);

  let editTarget = null;
  let isSelf = false;

  // keep profile email in sync after a verified email change
  const syncTimer = setInterval(async () => {
    try {
      if (state.user && state.profile && state.user.email && state.profile.email &&
          state.profile.email.toLowerCase() !== state.user.email.toLowerCase()) {
        await usersCol7().doc(state.user.uid).update({ email: state.user.email });
        state.profile.email = state.user.email;
        toast("Profile email synced to " + state.user.email, "ok");
        clearInterval(syncTimer);
      }
    } catch (e) { /* retry next tick */ }
  }, 3000);
  setTimeout(() => clearInterval(syncTimer), 60000);

  function decorate() {
    const list = document.getElementById("teamList");
    if (!list) return;
    Array.from(list.children).forEach((row, i) => {
      if (row.dataset.d7) return;
      row.dataset.d7 = "1";
      const u = (state.users || [])[i];
      if (!u) return;
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
    isSelf = !!(state.user && u.id === state.user.uid);
    const owner = (u.email || "").toLowerCase() === OWNER;
    document.getElementById("uName").value = u.name || "";
    document.getElementById("uEmail").value = u.email || "";
    document.getElementById("uRole").value = u.role === "admin" ? "admin" : "staff";
    document.getElementById("uStatus").value = u.status || "approved";
    document.getElementById("uRole").disabled = owner;
    document.getElementById("uStatus").disabled = owner;
    document.getElementById("uPass").value = "";
    document.getElementById("uCreds").classList.add("hidden");
    document.getElementById("uPassWrap").classList.toggle("hidden", !isSelf);
    document.getElementById("uResetLink").classList.toggle("hidden", isSelf);
    document.getElementById("uHint").textContent = isSelf
      ? "Changing your own email sends a verification link to the NEW address — the login switches after you click it. Password applies immediately."
      : "To change someone's email, edit it and set a temp password — a new login is created and the old one is retired. Or use the reset-link button.";
    syncPassVisibility();
    openModal("userEditModal");
  }

  function syncPassVisibility() {
    const emailChanged = document.getElementById("uEmail").value.trim().toLowerCase() !== ((editTarget && editTarget.email) || "").toLowerCase();
    if (!isSelf) {
      document.getElementById("uPassWrap").classList.toggle("hidden", !emailChanged);
      document.getElementById("uPassLabel").textContent = "Temp password for the NEW login (required to change email)";
    }
  }
  document.getElementById("uEmail").addEventListener("input", syncPassVisibility);

  async function signUpREST(email, pass) {
    const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + FB_KEY7, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass, returnSecureToken: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ? data.error.message : "Auth create failed");
    return data.localId;
  }

  document.getElementById("uResetLink").addEventListener("click", async () => {
    if (!editTarget) return;
    try {
      await auth.sendPasswordResetEmail(editTarget.email);
      toast("Reset email sent to " + editTarget.email, "ok");
    } catch (e) { toast("Could not send: " + e.message, "err"); }
  });

  document.getElementById("uSave").addEventListener("click", async () => {
    if (!editTarget) return;
    const name = document.getElementById("uName").value.trim();
    const email = document.getElementById("uEmail").value.trim();
    const pass = document.getElementById("uPass").value;
    if (!name || !email) { toast("Name and email are required.", "err"); return; }
    const owner = (editTarget.email || "").toLowerCase() === OWNER;
    const patch = {
      name,
      role: owner ? "admin" : document.getElementById("uRole").value,
      status: owner ? "approved" : document.getElementById("uStatus").value
    };
    const emailChanged = email.toLowerCase() !== ((editTarget.email || "")).toLowerCase();
    try {
      if (isSelf) {
        if (pass) { await auth.currentUser.updatePassword(pass); toast("Password changed.", "ok"); }
        if (emailChanged) {
          await auth.currentUser.verifyBeforeUpdateEmail(email);
          toast("Verification link sent to " + email + " — click it, then log in with the new address.", "ok");
        }
        await usersCol7().doc(editTarget.id).update(patch);
        closeModal("userEditModal");
        if (window.D2) D2.loadUsers();
      } else if (emailChanged) {
        if (pass.length < 6) { toast("Set a temp password (6+) for the new login.", "err"); return; }
        const uid = await signUpREST(email, pass);
        await usersCol7().doc(uid).set({
          uid, email, name,
          role: patch.role, status: patch.status,
          createdAt: new Date().toISOString(),
          createdBy: state.user ? state.user.email : ""
        });
        await usersCol7().doc(editTarget.id).delete();
        const creds = document.getElementById("uCreds");
        creds.classList.remove("hidden");
        creds.innerHTML = `<strong>New login ready:</strong> ${escapeHtml(email)} · temp password: ${escapeHtml(pass)} — share it securely.`;
        toast("Email migrated to the new login.", "ok");
        if (window.D2) D2.loadUsers();
      } else {
        await usersCol7().doc(editTarget.id).update(patch);
        toast("Account updated.", "ok");
        closeModal("userEditModal");
        if (window.D2) D2.loadUsers();
      }
    } catch (e) {
      console.error(e);
      if (String(e.code || "").includes("requires-recent-login")) toast("Security check: log out, log back in, then retry the change.", "err");
      else toast("Update failed: " + (e.message || e.code || "error"), "err");
    }
  });

  console.log("SPIDERWEB Drop 7 v3 loaded.");
})();
/* SPIDERWEB-DROP7-END */
