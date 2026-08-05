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
