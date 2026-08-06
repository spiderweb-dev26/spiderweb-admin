/* SPIDERWEB DROP 6 v2 — expanding hover menu on top + logo + Dashboard landing */
(function () {
  "use strict";
  if (window.__DROP6__) return;
  window.__DROP6__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .side{display:none!important}
    .layout{grid-template-columns:1fr!important}
    .sw-topnav{position:sticky;top:78px;z-index:40;display:flex;justify-content:center;padding:12px 14px;
      border-bottom:2px dashed var(--line);background:rgba(18,6,9,.92);backdrop-filter:blur(10px);
      max-height:240px;overflow:hidden;transition:max-height .3s ease,padding .3s ease,border-bottom-width .3s}
    .sw-topnav.collapsed{max-height:0;padding-top:0;padding-bottom:0;border-bottom-width:0}
    .sw-pill{display:flex;gap:6px;align-items:center;padding:4px;border-radius:999px;
      background:rgba(35,16,23,.65);border:2px solid var(--line);box-shadow:var(--shadow-soft)}
    .sw-chip{width:52px;height:52px;display:flex;align-items:center;justify-content:center;gap:.6rem;
      overflow:hidden;border:none;background:transparent;color:var(--ink);cursor:pointer;border-radius:999px;
      transition:width .45s cubic-bezier(.22,1,.36,1),background .3s ease,box-shadow .3s ease}
    .sw-chip .ic{font-size:1.3rem;flex:0 0 auto;filter:drop-shadow(2px 2px 0 rgba(0,0,0,.55))}
    .sw-label{opacity:0;max-width:0;white-space:nowrap;transform:translateX(-8px);
      font-family:"Bangers",cursive;letter-spacing:.07em;font-size:1.08rem;
      transition:opacity .25s ease,max-width .45s ease,transform .35s ease}
    .sw-chip:hover,.sw-chip:focus-visible{width:172px;background:rgba(230,36,46,.16);box-shadow:0 0 18px rgba(230,36,46,.28)}
    .sw-chip:hover .sw-label,.sw-chip:focus-visible .sw-label{opacity:1;max-width:112px;transform:translateX(0)}
    .sw-chip.active{width:172px;background:linear-gradient(135deg,var(--red),var(--deep));box-shadow:var(--shadow)}
    .sw-chip.active .sw-label{opacity:1;max-width:112px;transform:translateX(0);color:#fff}
    .sw-burger{border:2px solid var(--line);background:rgba(35,16,23,.7);color:var(--ink);border-radius:10px;
      padding:6px 11px;cursor:pointer;font-size:1.05rem;line-height:1}
    .sw-burger:hover{border-color:rgba(230,36,46,.45)}
    .sw-logo{width:46px;height:46px;border-radius:999px;object-fit:cover;mix-blend-mode:screen;
      border:2px solid rgba(230,36,46,.4);box-shadow:var(--shadow-soft)}
    @media(max-width:900px){.sw-topnav{top:112px}.sw-chip:hover{width:52px}.sw-chip.active{width:172px}}
  `;
  document.head.appendChild(style);

  const fav = document.createElement("link");
  fav.rel = "icon";
  fav.href = "logo.png";
  document.head.appendChild(fav);

  const badge = document.querySelector(".brand-badge");
  if (badge) {
    const img = document.createElement("img");
    img.src = "logo.png";
    img.alt = "Spiderweb logo";
    img.className = "sw-logo";
    img.onerror = () => img.remove();
    badge.innerHTML = "";
    badge.style.background = "transparent";
    badge.appendChild(img);
  }

  // expanding hover menu
  const VIEWS = [
    ["dashboard", "Dashboard", "🕸️"],
    ["documents", "Documents", "📄"],
    ["tasks", "Tasks", "✅"],
    ["customers", "Customers", "🤝"],
    ["payments", "Payments", "💰"],
    ["chat", "Chat", "💬"],
    ["clients", "Clients", "👥"],
    ["team", "Team", "🛡️"]
  ];
  const topbar = document.querySelector(".topbar");
  const nav = document.createElement("nav");
  nav.className = "sw-topnav";
  nav.id = "swTopnav";
  const pill = document.createElement("div");
  pill.className = "sw-pill";
  nav.appendChild(pill);
  VIEWS.forEach(([v, label, ic]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw-chip";
    b.dataset.view = v;
    b.title = label;
    b.innerHTML = `<span class="ic">${ic}</span><span class="sw-label">${label}</span>`;
    b.addEventListener("click", () => go(v));
    pill.appendChild(b);
  });
  topbar.insertAdjacentElement("afterend", nav);

  const burger = document.createElement("button");
  burger.type = "button";
  burger.className = "sw-burger";
  burger.title = "Show / hide menu";
  burger.textContent = "☰";
  burger.addEventListener("click", () => {
    const collapsed = nav.classList.toggle("collapsed");
    try { localStorage.setItem("swNavCollapsed", collapsed ? "1" : ""); } catch (e) {}
  });
  const actions = topbar.querySelector(".top-actions");
  if (actions) actions.insertAdjacentElement("afterbegin", burger);
  try { if (localStorage.getItem("swNavCollapsed") === "1") nav.classList.add("collapsed"); } catch (e) {}

  function oldBtn(v) { return document.querySelector('.nav-item[data-view="' + v + '"]'); }
  function go(v) {
    const ob = oldBtn(v);
    if (ob) ob.click();
    setActive(v);
  }
  function setActive(v) {
    nav.querySelectorAll(".sw-chip").forEach((c) => c.classList.toggle("active", c.dataset.view === v));
  }

  const side = document.querySelector(".side");
  if (side) {
    new MutationObserver(() => {
      const a = document.querySelector(".nav-item.active");
      if (a && a.dataset.view) setActive(a.dataset.view);
    }).observe(side, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // land on Dashboard at every login
  const appView = document.getElementById("appView");
  let landed = false;
  if (appView) {
    new MutationObserver(() => {
      if (appView.classList.contains("hidden")) { landed = false; return; }
      if (!landed) {
        landed = true;
        setTimeout(() => go("dashboard"), 80);
      }
    }).observe(appView, { attributes: true, attributeFilter: ["class"] });
  }
  setActive("dashboard");

  console.log("SPIDERWEB Drop 6 v2 loaded — hover to expand.");
})();
/* SPIDERWEB-DROP6-END */
