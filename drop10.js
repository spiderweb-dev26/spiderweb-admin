/* SPIDERWEB DROP 10 v1 — Activity log + Device sessions (remote logout) + Notifications */
(function () {
  "use strict";
  if (window.__DROP10__) return;
  window.__DROP10__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .sw-bellwrap{position:relative;display:flex;align-items:center}
    .sw-bell{position:relative;width:42px;height:42px;display:grid;place-items:center;border-radius:12px;
      border:2px solid var(--line);background:rgba(18,6,9,.55);color:var(--ink);font-size:1.15rem;
      box-shadow:var(--shadow-soft);cursor:pointer}
    .sw-bell:hover{border-color:rgba(230,36,46,.45)}
    .sw-badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;
      background:var(--red);color:#fff;font-size:.72rem;font-weight:800;display:grid;place-items:center;
      border:2px solid #120609;box-shadow:var(--shadow-soft)}
    .sw-bellpanel{position:absolute;top:50px;right:0;width:min(360px,calc(100vw - 40px));max-height:420px;
      display:grid;grid-template-rows:auto 1fr;z-index:120;border:2px solid var(--line);border-radius:16px;
      background:linear-gradient(180deg,rgba(35,16,23,.98),rgba(27,11,16,.98));box-shadow:var(--shadow);overflow:hidden}
    .sw-bellhead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;
      border-bottom:2px dashed var(--line)}
    .sw-belList{overflow:auto;padding:10px;display:grid;gap:8px;align-content:start}
    .sw-notif{padding:11px 12px;border-radius:14px;border:2px solid rgba(61,123,255,.18);
      background:rgba(61,123,255,.06);cursor:pointer;display:grid;gap:4px}
    .sw-notif.unread{border-color:rgba(230,36,46,.4);background:rgba(230,36,46,.09)}
    .sw-notif strong{font-size:.92rem}
    .sw-notif small{color:var(--mut);font-size:.78rem}
    .sw-ndot{display:inline-block;width:8px;height:8px;border-radius:999px;background:var(--red);margin-right:6px}
    .act-row{display:grid;gap:4px;padding:11px 12px;border-radius:14px;border:2px solid var(--line);
      background:rgba(18,6,9,.35);overflow-wrap:anywhere}
    .act-row .act-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .act-row .act-who{font-weight:700}
    .act-row .act-meta{color:var(--mut);font-size:.82rem}
    .dev-row{display:grid;gap:6px;padding:12px;border-radius:14px;border:2px solid var(--line);
      background:rgba(18,6,9,.35);overflow-wrap:anywhere}
    .dev-row .dev-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .sw-sechead{margin:4px 0 10px;font-family:var(--font-display);letter-spacing:.08em;color:var(--mut);
      text-transform:uppercase;font-size:1rem}
  `;
  document.head.appendChild(style);

  // ---- collections ----
  const activityCol = () => db.collection("c").doc("activity").collection("list");
  const sessionsCol = () => db.collection("c").doc("sessions").collection("list");
  const notifCol = () => db.collection("c").doc("notifications").collection("list");
  const usersCol = () => db.collection("c").doc("users").collection("list");

  // ---- helpers ----
  function rid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function getDeviceId() {
    try {
      if (!localStorage.getItem("sw_device_id")) localStorage.setItem("sw_device_id", rid());
      return localStorage.getItem("sw_device_id");
    } catch (e) { return "nodev"; }
  }
  function describeUA() {
    const ua = navigator.userAgent || "";
    let os = "Unknown OS";
    if (/Windows/i.test(ua)) os = "Windows";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Mac OS/i.test(ua)) os = "macOS";
    else if (/Linux/i.test(ua)) os = "Linux";
    let br = "Browser";
    if (/Edg\//i.test(ua)) br = "Edge";
    else if (/OPR\//i.test(ua)) br = "Opera";
    else if (/Chrome\//i.test(ua)) br = "Chrome";
    else if (/Firefox\//i.test(ua)) br = "Firefox";
    else if (/Safari\//i.test(ua)) br = "Safari";
    return br + " · " + os;
  }
  function timeAgo(ts) {
    try {
      const d = ts && ts.toDate ? ts.toDate() : new Date(ts);
      const s = Math.floor((Date.now() - d.getTime()) / 1000);
      if (s < 10) return "just now";
      if (s < 60) return s + "s ago";
      if (s < 3600) return Math.floor(s / 60) + "m ago";
      if (s < 86400) return Math.floor(s / 3600) + "h ago";
      return Math.floor(s / 86400) + "d ago";
    } catch (e) { return ""; }
  }

  // ---- runtime state ----
  let cur = { user: null, profile: null };
  let unsubs = [];
  let timers = [];
  let notifCache = [];
  let selfRevoking = false;
  let actFilter = "all";

  // ---- activity logger (global) ----
  async function swLog(action, detail) {
    try {
      await activityCol().add({
        uid: cur.user ? cur.user.uid : "",
        email: cur.user ? (cur.user.email || "") : "",
        name: (cur.profile && cur.profile.name) || (cur.user ? cur.user.email : ""),
        action: action || "", detail: detail || "",
        device: describeUA(), deviceId: getDeviceId(),
        at: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.warn("drop10 swLog failed:", e); }
  }
  window.swLog = swLog;

  // ---- notification sender (global) ----
  async function swNotify(toUid, title, body, type, refId) {
    try {
      await notifCol().add({
        toUid: toUid || "", type: type || "info", title: title || "", body: body || "",
        refId: refId || "", fromUid: cur.user ? cur.user.uid : "", fromName: cur.profile ? cur.profile.name : "",
        read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.warn("drop10 swNotify failed:", e); }
  }
  window.swNotify = swNotify;
  // ================= UI (built once at load) =================
  function buildUI() {
    const actions = document.querySelector(".top-actions");
    if (actions && !document.getElementById("swBellBtn")) {
      const wrap = document.createElement("div");
      wrap.className = "sw-bellwrap";
      wrap.innerHTML = `
        <button id="swBellBtn" class="sw-bell" type="button" title="Notifications" aria-label="Notifications">🔔<span id="swBellBadge" class="sw-badge hidden">0</span></button>
        <div id="swBellPanel" class="sw-bellpanel hidden">
          <div class="sw-bellhead"><strong>Notifications</strong><button id="swBellReadAll" class="btn ghost small" type="button">Mark all read</button></div>
          <div id="swBellList" class="sw-belList"></div>
        </div>`;
      const chip = actions.querySelector(".user-chip");
      if (chip) actions.insertBefore(wrap, chip); else actions.appendChild(wrap);
      document.getElementById("swBellBtn").addEventListener("click", (e) => { e.stopPropagation(); toggleBell(); });
      document.getElementById("swBellReadAll").addEventListener("click", markAllRead);
      document.addEventListener("click", (e) => {
        const panel = document.getElementById("swBellPanel");
        if (panel && !panel.classList.contains("hidden") && !e.target.closest(".sw-bellwrap")) panel.classList.add("hidden");
      });
    }
    const main = document.querySelector(".main");
    if (main && !document.getElementById("activityView")) {
      main.insertAdjacentHTML("beforeend", `
        <section class="panel hidden" id="activityView">
          <div class="page-head">
            <div><h2>Activity &amp; devices</h2><p>Who did what, when, on which device — and where you are logged in.</p></div>
            <button id="actRefreshBtn" class="btn ghost small" type="button">Refresh</button>
          </div>
          <div class="content">
            <h3 class="sw-sechead">📱 Where you're logged in</h3>
            <div id="deviceList"></div>
            <div class="divider" style="margin:14px 0"></div>
            <h3 class="sw-sechead">🕘 Activity log</h3>
            <div style="display:flex;gap:8px;margin:0 0 10px">
              <button id="actAllBtn" class="btn small" type="button">All</button>
              <button id="actMineBtn" class="btn ghost small" type="button">Mine</button>
            </div>
            <div id="activityList"></div>
          </div>
        </section>`);
      document.getElementById("actRefreshBtn").addEventListener("click", () => { renderDevices(); renderActivity(); });
      document.getElementById("actAllBtn").addEventListener("click", () => setActFilter("all"));
      document.getElementById("actMineBtn").addEventListener("click", () => setActFilter("mine"));
    }
    const pill = document.querySelector(".sw-pill");
    if (pill && !document.querySelector('.sw-chip[data-view="activity"]')) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sw-chip";
      b.dataset.view = "activity";
      b.title = "Activity & devices";
      b.innerHTML = '<span class="ic">🕘</span><span class="sw-label">Activity</span>';
      b.addEventListener("click", () => openActivity());
      pill.appendChild(b);
      pill.addEventListener("click", (e) => {
        const c = e.target.closest(".sw-chip");
        if (!c) return;
        if (c.dataset.view === "activity") return;
        closeActivity();
      }, true);
    }
  }

  // ---- view switching ----
  function openActivity() {
    document.querySelectorAll('section[id$="View"]').forEach((s) => s.classList.add("hidden"));
    const v = document.getElementById("activityView");
    if (v) v.classList.remove("hidden");
    document.querySelectorAll(".sw-chip").forEach((c) => c.classList.toggle("active", c.dataset.view === "activity"));
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    renderDevices();
    renderActivity();
  }
  function closeActivity() {
    const v = document.getElementById("activityView");
    if (v) v.classList.add("hidden");
    document.querySelectorAll('.sw-chip[data-view="activity"]').forEach((c) => c.classList.remove("active"));
  }

  // ---- notification bell ----
  function toggleBell() {
    const panel = document.getElementById("swBellPanel");
    if (!panel) return;
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) renderBellList();
  }
  function updateBellBadge(n) {
    const badge = document.getElementById("swBellBadge");
    if (!badge) return;
    badge.textContent = String(n);
    badge.classList.toggle("hidden", n <= 0);
  }
  function renderBellList() {
    const list = document.getElementById("swBellList");
    if (!list) return;
    list.innerHTML = "";
    if (!notifCache.length) { list.innerHTML = '<div class="muted small">No notifications yet.</div>'; return; }
    notifCache.forEach((n) => {
      const div = document.createElement("div");
      div.className = "sw-notif" + (n.read ? "" : " unread");
      div.innerHTML = `
        <strong>${n.read ? "" : '<span class="sw-ndot"></span>'}${escapeHtml(n.title || "Notification")}</strong>
        ${n.body ? '<span class="small">' + escapeHtml(n.body) + "</span>" : ""}
        <small>${escapeHtml(timeAgo(n.createdAt))}</small>`;
      div.addEventListener("click", async () => {
        if (!n.read) { try { await notifCol().doc(n.id).update({ read: true }); } catch (e) {} }
      });
      list.appendChild(div);
    });
  }
  async function markAllRead() {
    const unread = notifCache.filter((n) => !n.read);
    for (const n of unread) { try { await notifCol().doc(n.id).update({ read: true }); } catch (e) {} }
    toast("All notifications marked read.", "ok");
  }
  function startNotifListener(uid) {
    let prevUnread = -1;
    const unsub = notifCol().where("toUid", "==", uid).onSnapshot((snap) => {
      notifCache = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
      notifCache.sort((a, b) => {
        const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });
      notifCache = notifCache.slice(0, 40);
      const unread = notifCache.filter((n) => !n.read).length;
      updateBellBadge(unread);
      renderBellList();
      if (prevUnread >= 0 && unread > prevUnread) toast("🔔 New notification.", "ok");
      prevUnread = unread;
    }, (e) => console.warn("drop10 notif listener:", e));
    unsubs.push(unsub);
  }
  // ---- device sessions ----
  function startSessionTracking(user, profile) {
    const deviceId = getDeviceId();
    const ref = sessionsCol().doc(deviceId);
    ref.set({
      uid: user.uid, email: user.email || "", name: profile.name || "",
      deviceId: deviceId, label: describeUA(), ua: navigator.userAgent || "",
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(), revoked: false
    }, { merge: true }).catch((e) => console.warn("drop10 session set:", e));
    timers.push(setInterval(() => {
      ref.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    }, 45000));
    const unsub = ref.onSnapshot((snap) => {
      const d = snap.data();
      if (d && d.revoked && !selfRevoking) {
        selfRevoking = true;
        toast("This device was signed out remotely.", "err");
        auth.signOut();
      }
    });
    unsubs.push(unsub);
  }
  async function renderDevices() {
    const box = document.getElementById("deviceList");
    if (!box || !cur.user) return;
    box.innerHTML = '<div class="muted small">Loading devices…</div>';
    try {
      const snap = await sessionsCol().where("uid", "==", cur.user.uid).get();
      const rows = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
      rows.sort((a, b) => {
        const at = a.lastSeen && a.lastSeen.toMillis ? a.lastSeen.toMillis() : 0;
        const bt = b.lastSeen && b.lastSeen.toMillis ? b.lastSeen.toMillis() : 0;
        return bt - at;
      });
      if (!rows.length) { box.innerHTML = '<div class="muted small">No sessions recorded yet.</div>'; return; }
      box.innerHTML = "";
      rows.forEach((s) => {
        const isCur = s.deviceId === getDeviceId();
        const div = document.createElement("div");
        div.className = "dev-row";
        div.innerHTML = `
          <div class="dev-top">
            <strong>${escapeHtml(s.label || "Device")}</strong>
            ${isCur ? '<span class="signed">This device</span>' : (s.revoked ? '<span class="overdue">Signed out</span>' : '<span class="pending">Active</span>')}
          </div>
          <div class="act-meta">${escapeHtml(s.email || "")} · last seen ${escapeHtml(timeAgo(s.lastSeen))}</div>
          ${(!isCur && !s.revoked) ? '<div class="doc-actions"><button class="btn ghost small" data-logout="' + escapeHtml(s.deviceId) + '" type="button">Log out this device</button></div>' : ""}`;
        const lb = div.querySelector("[data-logout]");
        if (lb) lb.addEventListener("click", () => logoutDevice(s));
        box.appendChild(div);
      });
    } catch (e) {
      box.innerHTML = '<div class="muted small">Could not load devices: ' + escapeHtml(e.message || "") + "</div>";
    }
  }
  async function logoutDevice(s) {
    if (!confirm('Log out "' + (s.label || "this device") + '"? It will be signed out on its next check-in.')) return;
    try {
      await sessionsCol().doc(s.deviceId).update({ revoked: true });
      swLog("device-logout", "Signed out device: " + (s.label || s.deviceId));
      swNotify(s.uid, "Device signed out", "Your account was signed out of " + (s.label || "a device") + ". If this wasn't you, change your password.", "security", s.deviceId);
      toast("Device will be signed out.", "ok");
      renderDevices();
    } catch (e) { toast("Logout failed: " + (e.message || e), "err"); }
  }

  // ---- activity log ----
  function setActFilter(f) {
    actFilter = f;
    const all = document.getElementById("actAllBtn"), mine = document.getElementById("actMineBtn");
    if (all) all.className = "btn small" + (f === "all" ? "" : " ghost");
    if (mine) mine.className = "btn small" + (f === "mine" ? "" : " ghost");
    renderActivity();
  }
  async function renderActivity() {
    const box = document.getElementById("activityList");
    if (!box) return;
    box.innerHTML = '<div class="muted small">Loading activity…</div>';
    try {
      const snap = await activityCol().orderBy("at", "desc").limit(100).get();
      let rows = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
      if (actFilter === "mine" && cur.user) rows = rows.filter((r) => r.uid === cur.user.uid);
      if (!rows.length) { box.innerHTML = '<div class="muted small">No activity yet.</div>'; return; }
      box.innerHTML = "";
      rows.forEach((r) => {
        const div = document.createElement("div");
        div.className = "act-row";
        div.innerHTML = `
          <div class="act-top">
            <span class="act-who">${escapeHtml(r.name || r.email || "Someone")}</span>
            <span class="signed">${escapeHtml(r.action || "")}</span>
          </div>
          ${r.detail ? '<div class="small">' + escapeHtml(r.detail) + "</div>" : ""}
          <div class="act-meta">${escapeHtml(formatDate(r.at))}${r.device ? " · " + escapeHtml(r.device) : ""}</div>`;
        box.appendChild(div);
      });
    } catch (e) {
      box.innerHTML = '<div class="muted small">Could not load activity: ' + escapeHtml(e.message || "") + "</div>";
    }
  }

  // ---- notify admins (idempotent via create) ----
  async function notifyAdmins(title, body, type, refId, dedupeKey) {
    try {
      const usnap = await usersCol().where("role", "==", "admin").get();
      const admins = usnap.docs.map((x) => x.data()).filter((u) => u.status === "approved" && u.uid);
      for (const a of admins) {
        try {
          await notifCol().doc(dedupeKey + "_" + a.uid).create({
            toUid: a.uid, toEmail: a.email || "", type: type || "info",
            title: title, body: body || "", refId: refId || "",
            fromUid: "", fromName: "Spiderweb OS",
            read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) { /* already exists -> dedupe */ }
      }
    } catch (e) { console.warn("drop10 notifyAdmins:", e); }
  }

  // ---- watchers: activity + auto notifications ----
  function watchCreated(key, col, label, after) {
    let ready = false;
    const unsub = col.onSnapshot((snap) => {
      if (!ready) { ready = true; return; }
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const id = ch.doc.id;
        const d = ch.doc.data() || {};
        const name = d.uploadedByName || d.createdByName || d.byName || d.name || "";
        const email = d.uploadedByEmail || d.createdBy || d.by || d.email || "";
        const title = d.title || d.name || d.fileName || id;
        activityCol().doc(key + "_" + id).create({
          uid: d.uploadedBy || d.createdBy || d.uid || "", email: email, name: name,
          action: "created", detail: label + ": " + title, device: "", deviceId: "",
          at: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
        if (after) after(id, d);
      });
    }, () => {});
    unsubs.push(unsub);
  }
  function startWatchers() {
    watchCreated("doc", db.collection("c").doc("docs").collection("list"), "Document", null);
    watchCreated("task", db.collection("c").doc("tasks").collection("list"), "Task", null);
    watchCreated("customer", db.collection("c").doc("customers").collection("list"), "Customer", null);
    watchCreated("pay", db.collection("c").doc("payments").collection("list"), "Payment", (id, d) => {
      notifyAdmins("Payment needs inks", (d.title || "A payment") + " — " + Number(d.amount || 0).toLocaleString() + " ETB needs authorization.", "payment", id, "pay_new_" + id);
    });
    let uready = false;
    const uUnsub = usersCol().onSnapshot((snap) => {
      if (!uready) { uready = true; return; }
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const u = ch.doc.data() || {};
        if (u.status === "pending") {
          notifyAdmins("New team signup", (u.name || u.email || "Someone") + " requested access and is waiting for approval.", "team", ch.doc.id, "user_new_" + ch.doc.id);
        }
      });
    }, () => {});
    unsubs.push(uUnsub);
  }

  // ---- lifecycle + auth wiring ----
  function stopServices() {
    unsubs.forEach((u) => { try { u(); } catch (e) {} });
    unsubs = [];
    timers.forEach((t) => clearInterval(t));
    timers = [];
    notifCache = [];
    updateBellBadge(0);
  }
  function startServices(user, profile) {
    stopServices();
    selfRevoking = false;
    cur = { user: user, profile: profile };
    startSessionTracking(user, profile);
    startNotifListener(user.uid);
    startWatchers();
    swLog("login", "Signed in");
  }
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      if (cur.user) swLog("logout", "Signed out");
      stopServices();
      cur = { user: null, profile: null };
      return;
    }
    try {
      const ps = await usersCol().doc(user.uid).get();
      const profile = ps.exists ? ps.data() : null;
      if (!profile || profile.status !== "approved") { stopServices(); return; }
      startServices(user, profile);
    } catch (e) { console.warn("drop10 auth bootstrap:", e); }
  });

  buildUI();
  console.log("SPIDERWEB Drop 10 v1 loaded.");
})();
/* SPIDERWEB-DROP10-END */
