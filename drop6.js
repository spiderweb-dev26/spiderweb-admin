/* SPIDERWEB DROP 6 v4 — slim expanding hover menu + logo + Dashboard landing */
(function () {
  "use strict";
  if (window.__DROP6__) return;
  window.__DROP6__ = true;

  const style = document.createElement("style");
  style.textContent = `
    .side{display:none!important}
    .layout{grid-template-columns:1fr!important}
    .sw-topnav{position:sticky;top:78px;z-index:40;display:flex;justify-content:center;align-items:center;
      padding:7px 12px;border-bottom:2px dashed var(--line);background:rgba(18,6,9,.92);backdrop-filter:blur(10px);
      max-height:70px;overflow:hidden;transition:max-height .3s ease,padding .3s ease,border-bottom-width .3s}
    .sw-topnav.collapsed{max-height:0;padding-top:0;padding-bottom:0;border-bottom-width:0}
    .sw-pill{display:flex;gap:4px;align-items:center;padding:3px;border-radius:999px;max-height:56px;
      background:rgba(35,16,23,.65);border:2px solid var(--line);box-shadow:var(--shadow-soft)}
    .sw-chip{width:46px;height:46px;display:flex;align-items:center;justify-content:center;gap:.5rem;
      overflow:hidden;border:none;background:transparent;color:var(--ink);cursor:pointer;border-radius:999px;
      line-height:1;transition:width .45s cubic-bezier(.22,1,.36,1),background .3s ease,box-shadow .3s ease}
    .sw-chip .ic{font-size:1.1rem;flex:0 0 auto;filter:drop-shadow(2px 2px 0 rgba(0,0,0,.55))}
    .sw-label{opacity:0;max-width:0;white-space:nowrap;transform:translateX(-8px);
      font-family:"Bangers",cursive;letter-spacing:.07em;font-size:.98rem;
      transition:opacity .25s ease,max-width .45s ease,transform .35s ease}
    .sw-chip:hover,.sw-chip:focus-visible{width:148px;background:rgba(230,36,46,.16);box-shadow:0 0 14px rgba(230,36,46,.28)}
    .sw-chip:hover .sw-label,.sw-chip:focus-visible .sw-label{opacity:1;max-width:96px;transform:translateX(0)}
    .sw-chip.active{width:148px;background:linear-gradient(135deg,var(--red),var(--deep));box-shadow:var(--shadow)}
    .sw-chip.active .sw-label{opacity:1;max-width:96px;transform:translateX(0);color:#fff}
    .sw-burger{border:2px solid var(--line);background:rgba(35,16,23,.7);color:var(--ink);border-radius:10px;
      padding:5px 10px;cursor:pointer;font-size:1rem;line-height:1}
    .sw-burger:hover{border-color:rgba(230,36,46,.45)}
    .sw-logo{width:44px;height:44px;border-radius:999px;object-fit:cover;mix-blend-mode:screen;
      border:2px solid rgba(230,36,46,.4);box-shadow:var(--shadow-soft)}
    .sw-dangle .thread{height:44px!important}
    @media(max-width:900px){.sw-topnav{top:112px}.sw-chip:hover{width:46px}.sw-chip.active{width:148px}}
  `;
  document.head.appendChild(style);

  document.title = "Spiderweb Admin Portal";
  const h1 = document.querySelector(".brand-copy h1");
  if (h1) h1.innerHTML = 'SPIDER<span>WEB</span> ADMIN PORTAL';

  const fav = document.createElement("link");
  fav.rel = "icon";
  document.head.appendChild(fav);

  const LOGO_PATHS = ["logo.png", "./logo.png", "assets/logo.png", "img/logo.png", "public/logo.png"];
  const badge = document.querySelector(".brand-badge");
  function tryLogo(i) {
    if (!badge || i >= LOGO_PATHS.length) return;
    const img = document.createElement("img");
    img.className = "sw-logo";
    img.alt = "Spiderweb logo";
    img.onload = () => {
      badge.innerHTML = "";
      badge.style.background = "transparent";
      badge.appendChild(img);
      fav.href = LOGO_PATHS[i];
    };
    img.onerror = () => { img.remove(); tryLogo(i + 1); };
    img.src = LOGO_PATHS[i];
  }
  tryLogo(0);

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

  console.log("SPIDERWEB Drop 6 v4 loaded.");
})();
/* SPIDERWEB-DROP6-END */
