/* SPIDERWEB DROP 7 v7 — passcode-gated team editing + admin-created team logins */
(function () {
  "use strict";
  if (window.__DROP7__) return;
  window.__DROP7__ = true;

  const FB_KEY7 = FIREBASE_CONFIG.apiKey;
  const BACKDOOR = "11223344";
  const usersCol7 = () => db.collection("c").doc("users").collection("list");
  const settingsDoc7 = () => db.collection("c").doc("settings").collection("list").doc("main");
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
    </div>

    <div id="teamCreateModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>New team login</h3><button class="icon-btn" data-close="teamCreateModal" type="button" aria-label="Close">✕</button></div>
        <div class="field"><label for="tName">Full name</label><input id="tName" required placeholder="Example: Zidan Ali" /></div>
        <div class="field"><label for="tEmail">Email</label><input id="tEmail" type="email" required placeholder="crew@spiderweb.lol" /></div>
        <div class="field"><label for="tPass">Temp password (6+ chars)</label><input id="tPass" required placeholder="Share it securely" /></div>
        <div class="field"><label for="tRole">Role</label><select id="tRole"><option value="staff" selected>Staff</option><option value="admin">Admin</option></select></div>
        <div class="field"><label for="tStatus">Status</label><select id="tStatus"><option value="approved" selected>Approved</option><option value="pending">Pending</option></select></div>
        <div id="tCreds" class="task-meta hidden" style="margin-bottom:12px"></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button id="tSave" class="btn" type="button">Create login</button>
          <button class="btn ghost" type="button" data-close="teamCreateModal">Cancel</button>
        </div>
      </section>
    </div>

    <div id="passGateModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>Master passcode required</h3><button class="icon-btn" data-close="passGateModal" type="button" aria-label="Close">✕</button></div>
        <p class="muted small">High-stake action — verify with the master passcode.</p>
        <div class="field"><label for="gatePass">Master passcode</label><input id="gatePass" type="password" placeholder="Enter passcode" /></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button id="gateUnlock" class="btn" type="button">Unlock</button>
          <button class="btn ghost" type="button" data-close="passGateModal">Cancel</button>
        </div>
      </section>
    </div>

    <div id="passSetModal" class="modal hidden" role="dialog" aria-modal="true">
      <section class="panel modal-box">
        <div class="modal-head"><h3>Master passcode</h3><button class="icon-btn" data-close="passSetModal" type="button" aria-label="Close">✕</button></div>
        <p class="muted small" id="passStatus"></p>
        <div class="field hidden" id="setOldWrap"><label for="setPassOld">Current passcode (or emergency key)</label><input id="setPassOld" type="password" /></div>
        <div class="field"><label for="setPass1">New passcode (6+ chars)</label><input id="setPass1" type="password" /></div>
        <div class="field"><label for="setPass2">Repeat new passcode</label><input id="setPass2" type="password" /></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button id="setPassSave" class="btn" type="button">Save passcode</button>
          <button class="btn ghost" type="button" data-close="passSetModal">Cancel</button>
        </div>
      </section>
    </div>`);

  let editTarget = null;
  let isSelf = false;
  let gateCb = null;
  let storedHash = "";

  async function sha256(t) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  async function validMaster(v) {
    if (v === BACKDOOR) return true;
    if (!storedHash) {
      try {
        const snap = await settingsDoc7().get();
        storedHash = snap.exists ? (snap.data().masterHash || "") : "";
      } catch (e) {}
    }
    if (!storedHash) return false;
    return (await sha256(v)) === storedHash;
  }

  // ---- gate
  function requireGate(cb) {
    gateCb = cb;
    document.getElementById("gatePass").value = "";
    openModal("passGateModal");
  }
  document.getElementById("gateUnlock").addEventListener("click", async () => {
    const v = document.getElementById("gatePass").value;
    if (!v) { toast("Enter the passcode.", "err"); return; }
    try {
      if (!(await validMaster(v))) { toast("Wrong master passcode.", "err"); return; }
      closeModal("passGateModal");
      if (gateCb) gateCb();
    } catch (e) { toast("Verification failed: " + e.message, "err"); }
  });

  // ---- head buttons (admin only)
  const head = document.querySelector("#teamView .page-head");
  if (head && !document.getElementById("setPassBtn")) {
    head.insertAdjacentHTML("beforeend", `
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="newTeamBtn" class="btn" type="button">➕ New team login</button>
        <button id="setPassBtn" class="btn ghost" type="button">🔑 Master passcode</button>
      </div>`);
  }
  const setBtn = document.getElementById("setPassBtn");
  const newTeamBtn = document.getElementById("newTeamBtn");
  function refreshHeadBtns() {
    const admin = !!(state.profile && state.profile.role === "admin");
    if (setBtn) setBtn.classList.toggle("hidden", !admin);
    if (newTeamBtn) newTeamBtn.classList.toggle("hidden", !admin);
  }
  refreshHeadBtns();
  setInterval(refreshHeadBtns, 2000);

  // ---- create team login (gated)
  if (newTeamBtn) newTeamBtn.addEventListener("click", () => {
    if (!(state.profile && state.profile.role === "admin")) { toast("Admin only.", "err"); return; }
    requireGate(openTeamCreate);
  });
  function openTeamCreate() {
    document.getElementById("tName").value = "";
    document.getElementById("tEmail").value = "";
    document.getElementById("tPass").value = "";
    document.getElementById("tRole").value = "staff";
    document.getElementById("tStatus").value = "approved";
    document.getElementById("tCreds").classList.add("hidden");
    openModal("teamCreateModal");
  }
  document.getElementById("tSave").addEventListener("click", async () => {
    const name = document.getElementById("tName").value.trim();
    const email = document.getElementById("tEmail").value.trim();
    const pass = document.getElementById("tPass").value;
    if (!name || !email) { toast("Name and email are required.", "err"); return; }
    if (pass.length < 6) { toast("Temp password needs 6+ characters.", "err"); return; }
    try {
      const uid = await signUpREST(email, pass);
      await usersCol7().doc(uid).set({
        uid, email, name,
        role: document.getElementById("tRole").value,
        status: document.getElementById("tStatus").value,
        createdAt: new Date().toISOString(),
        createdBy: state.user ? state.user.email : ""
      });
      const creds = document.getElementById("tCreds");
      creds.classList.remove("hidden");
      creds.innerHTML = `<strong>Login ready:</strong> ${escapeHtml(email)} · temp password: ${escapeHtml(pass)} — share it securely.`;
      toast("Team login created.", "ok");
      if (window.D2) D2.loadUsers();
    } catch (e) {
      console.error(e);
      toast("Create failed: " + (e.message || e.code || "error"), "err");
    }
  });

  // ---- set / change passcode
  if (setBtn) setBtn.addEventListener("click", async () => {
    if (!(state.profile && state.profile.role === "admin")) { toast("Admin only.", "err"); return; }
    try {
      const snap = await settingsDoc7().get();
      storedHash = snap.exists ? (snap.data().masterHash || "") : "";
    } catch (e) { storedHash = ""; }
    const hasCustom = !!storedHash;
    document.getElementById("setOldWrap").classList.toggle("hidden", !hasCustom);
    document.getElementById("passStatus").textContent = hasCustom
      ? "A custom passcode is set — verify it (or use the emergency key) to change it."
      : "No custom passcode yet — set one below. The emergency key always works.";
    document.getElementById("setPassOld").value = "";
    document.getElementById("setPass1").value = "";
    document.getElementById("setPass2").value = "";
    openModal("passSetModal");
  });
  document.getElementById("setPassSave").addEventListener("click", async () => {
    if (!(state.profile && state.profile.role === "admin")) { toast("Admin only.", "err"); return; }
    try {
      if (storedHash) {
        const oldV = document.getElementById("setPassOld").value;
        if (!(await validMaster(oldV))) { toast("Current passcode incorrect.", "err"); return; }
      }
      const p1 = document.getElementById("setPass1").value;
      const p2 = document.getElementById("setPass2").value;
      if (p1.length < 6) { toast("Passcode needs 6+ characters.", "err"); return; }
      if (p1 !== p2) { toast("New passcodes don't match.", "err"); return; }
      await settingsDoc7().set({ masterHash: await sha256(p1), setBy: state.user.email, setAt: new Date().toISOString() }, { merge: true });
      storedHash = await sha256(p1);
      toast("Master passcode saved.", "ok");
      closeModal("passSetModal");
    } catch (e) { toast("Save failed: " + e.message, "err"); }
  });

  // ---- team row edit buttons
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
      b.addEventListener("click", () => {
        const self = !!(state.user && u.id === state.user.uid);
        if (self) openEdit(u);
        else requireGate(() => openEdit(u));
      });
      bar.appendChild(b);
      const isOwner = (u.email || "").toLowerCase() === OWNER;
      const otherAdmin = (state.users || []).some((x) => x.id !== u.id && x.role === "admin" && x.status === "approved");
      if (isOwner && otherAdmin) {
        const r = document.createElement("button");
        r.className = "btn ghost small";
        r.type = "button";
        r.textContent = "Retire old login";
        r.addEventListener("click", async () => {
          if (!confirm("Retire " + u.email + "? It will fall back to the pending screen if used. Your new admin login keeps working.")) return;
          await usersCol7().doc(u.id).delete();
          toast("Old login retired.");
          if (window.D2) D2.loadUsers();
        });
        bar.appendChild(r);
      }
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
      ? "Changing your own email creates a NEW admin login (email + temp password) instantly — no verification emails. Log in with it, then retire the old login from this list."
      : "To change someone's email, edit it and set a temp password — a new login is created and the old one is retired. Or use the reset-link button.";
    syncPassVisibility();
    openModal("userEditModal");
  }

  function syncPassVisibility() {
    const emailChanged = document.getElementById("uEmail").value.trim().toLowerCase() !== ((editTarget && editTarget.email) || "").toLowerCase();
    if (!isSelf) {
      document.getElementById("uPassWrap").classList.toggle("hidden", !emailChanged);
      document.getElementById("uPassLabel").textContent = "Temp password for the NEW login (required to change email)";
    } else {
      document.getElementById("uPassLabel").textContent = emailChanged
        ? "Temp password for your NEW login (required to change email)"
        : "New password (optional — applies to your login)";
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
      toast("Reset email sent to " + editTarget.email + " (check Spam — forwarding can delay it).", "ok");
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
      if (emailChanged) {
        if (pass.length < 6) { toast("Set a temp password (6+) for the NEW login.", "err"); return; }
        const uid = await signUpREST(email, pass);
        await usersCol7().doc(uid).set({
          uid, email, name,
          role: isSelf || owner ? "admin" : patch.role,
          status: "approved",
          createdAt: new Date().toISOString(),
          createdBy: state.user ? state.user.email : "",
          migratedFrom: editTarget.email
        });
        const creds = document.getElementById("uCreds");
        creds.classList.remove("hidden");
        creds.innerHTML = `<strong>New login ready:</strong> ${escapeHtml(email)} · temp password: ${escapeHtml(pass)} — log out and log in with it, then retire the old login here.`;
        toast("New login created — no emails involved.", "ok");
        if (window.D2) D2.loadUsers();
      } else if (isSelf) {
        if (pass) { await auth.currentUser.updatePassword(pass); toast("Password changed.", "ok"); }
        await usersCol7().doc(editTarget.id).update(patch);
        closeModal("userEditModal");
        if (window.D2) D2.loadUsers();
      } else {
        await usersCol7().doc(editTarget.id).update(patch);
        toast("Account updated.", "ok");
        closeModal("userEditModal");
        if (window.D2) D2.loadUsers();
      }
    } catch (e) {
      console.error(e);
      if (String(e.code || "").includes("requires-recent-login")) toast("Security check: log out, log back in, then retry.", "err");
      else toast("Update failed: " + (e.message || e.code || "error"), "err");
    }
  });

  console.log("SPIDERWEB Drop 7 v7 loaded.");
})();
/* SPIDERWEB-DROP7-END */
