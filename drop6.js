/* SPIDERWEB DROP 6 — top retractable nav + logo wiring (fixes stuck sidebar) */
(function () {
  "use strict";
  if (window.__DROP6__) return;
  window.__DROP6__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .side{display:none!important}
    .layout{grid-template-columns:1fr!important}
    .sw-topnav{display:flex;gap:8px;flex-wrap:wrap;padding:10px 18px;border-bottom:2px dashed var(--line);
      background:rgba(18,6,9,.92);backdrop-filter:blur(10px);position:sticky;top:78px;z-index:40;
      max-height:220px;overflow:hidden;transition:max-height .3s ease,padding .3s ease,border-bottom-width .3s}
    .sw-topnav.collapsed{max-height:0;padding-top:0;padding-bottom:0;border-bottom-width:0}
    .sw-chip{border:2px solid var(--line);background:rgba(35,16,23,.7);color:var(--ink);border-radius:999px;
      padding:8px 15px;font-family:"Bangers",cursive;letter-spacing:.07em;cursor:pointer;transform:rotate(-.6deg)}
    .sw-chip:nth-child(even){transform:rotate(.5deg)}
    .sw-chip:hover{border-color:rgba(230,36,46,.45)}
    .sw-chip.active{background:linear-gradient(135deg,var(--red),var(--deep));border-color:#3d060d;box-shadow:var(--shadow);transform:rotate(0)}
    .sw-burger{border:2px solid var(--line);background:rgba(35,16,23,.7);color:var(--ink);border-radius:10px;
      padding:6px 11px;cursor:pointer;font-size:1.05rem;line-height:1}
    .sw-burger:hover{border-color:rgba(230,36,46,.45)}
    .sw-logo{width:46px;height:46px;border-radius:999px;object-fit:cover;mix-blend-mode:screen;
      border:2px solid rgba(230,36,46,.4);box-shadow:var(--shadow-soft)}
    @media(max-width:900px){.sw-topnav{top:112px}}
  `;
  document.head.appendChild(style);

  // favicon
  const fav = document.createElement("link");
  fav.rel = "icon";
  fav.href = "logo.png";
  document.head.appendChild(fav);

  // logo swap (falls back to old badge if logo.png missing)
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

  // top nav
  const VIEWS = [
    ["dashboard", "Dashboard"], ["documents", "Documents"], ["tasks", "Tasks"],
    ["customers", "Customers"], ["payments", "Payments"], ["chat", "Chat"],
    ["clients", "Clients"], ["team", "Team"]
  ];
  const topbar = document.querySelector(".topbar");
  const nav = document.createElement("nav");
  nav.className = "sw-topnav";
  nav.id = "swTopnav";
  VIEWS.forEach(([v, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw-chip";
    b.dataset.view = v;
    b.textContent = label;
    b.addEventListener("click", () => go(v));
    nav.appendChild(b);
  });
  topbar.insertAdjacentElement("afterend", nav);

  // hamburger (retractable, remembered)
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

  // delegate to the existing (hidden) nav buttons so every loader + fix still runs
  function oldBtn(v) { return document.querySelector('.nav-item[data-view="' + v + '"]'); }
  function go(v) {
    const ob = oldBtn(v);
    if (ob) ob.click();
    setActive(v);
  }
  function setActive(v) {
    nav.querySelectorAll(".sw-chip").forEach((c) => c.classList.toggle("active", c.dataset.view === v));
  }

  // keep chips synced with whatever the old nav thinks is active
  const side = document.querySelector(".side");
  if (side) {
    new MutationObserver(() => {
      const a = document.querySelector(".nav-item.active");
      if (a && a.dataset.view) setActive(a.dataset.view);
    }).observe(side, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  setActive("documents");

  console.log("SPIDERWEB Drop 6 loaded — menu on top.");
})();
/* SPIDERWEB-DROP6-END */
