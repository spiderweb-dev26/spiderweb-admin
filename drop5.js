/* SPIDERWEB DROP 5 — "printed issue" creativity pass (theme-preserving) */
(function () {
  "use strict";
  if (window.__DROP5__) return;
  window.__DROP5__ = true;

  const style = document.createElement("style");
  style.textContent = `
    /* halftone print dots over everything */
    .sw-dots{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.5;
      background-image:radial-gradient(rgba(230,36,46,.10) 1px, transparent 1.6px);
      background-size:14px 14px}
    /* punchy headings */
    h1,h2,h3{transform:skewX(-1.5deg);text-shadow:2px 2px 0 #000,4px 4px 0 rgba(230,36,46,.55)!important}
    /* yellow comic caption boxes for descriptions */
    .page-head p{background:#f6e7c9;color:#201014;border:2px solid #000;border-radius:6px;
      box-shadow:3px 3px 0 rgba(230,36,46,.6);padding:8px 12px;transform:rotate(-.5deg);font-style:italic;max-width:64ch}
    /* sticker tilt on cards + nav */
    #appView .doc-card:nth-child(odd),#appView .task-row:nth-child(odd){transform:rotate(-.45deg)}
    #appView .doc-card:nth-child(even),#appView .task-row:nth-child(even){transform:rotate(.4deg)}
    #appView .doc-card:hover,#appView .task-row:hover{transform:rotate(0) translate(-3px,-3px)}
    .nav-item{transform:rotate(-.6deg)}
    .nav-item:nth-of-type(even){transform:rotate(.5deg)}
    .nav-item.active{transform:rotate(0) scale(1.03)}
    /* starburst behind stat numbers */
    .stat{position:relative}
    .stat b{position:relative;z-index:1}
    .stat b::before{content:"";position:absolute;inset:-16px -20px;z-index:-1;background:rgba(230,36,46,.16);
      clip-path:polygon(50% 0%,59% 17%,76% 6%,78% 26%,98% 26%,88% 42%,100% 50%,88% 58%,98% 74%,78% 74%,76% 94%,59% 83%,50% 100%,41% 83%,24% 94%,22% 74%,2% 74%,12% 58%,0% 50%,12% 42%,2% 26%,22% 26%,24% 6%,41% 17%)}
    /* toasts = white speech bubbles with tail */
    .toast-item{background:#fff!important;color:#16060a!important;border:3px solid #000!important;
      box-shadow:4px 4px 0 rgba(230,36,46,.9)!important;position:relative;font-weight:600}
    .toast-item::after{content:"";position:absolute;left:26px;bottom:-15px;border:8px solid transparent;border-top-color:#000}
    /* empty states get the emblem */
    .empty-state::before{content:"🕸️";font-size:54px;filter:drop-shadow(3px 3px 0 rgba(0,0,0,.6))}
    /* login card: tilted panel on a burst */
    .auth-card{position:relative;transform:rotate(-1deg)}
    .auth-card::before{content:"";position:absolute;inset:-26px -30px;z-index:-1;background:rgba(230,36,46,.14);
      clip-path:polygon(50% 0%,59% 17%,76% 6%,78% 26%,98% 26%,88% 42%,100% 50%,88% 58%,98% 74%,78% 74%,76% 94%,59% 83%,50% 100%,41% 83%,24% 94%,22% 74%,2% 74%,12% 58%,0% 50%,12% 42%,2% 26%,22% 26%,24% 6%,41% 17%)}
    /* button hover: web-ring + speed lines */
    .btn:hover{box-shadow:6px 6px 0 rgba(0,0,0,.72),0 0 0 3px rgba(230,36,46,.28)!important;
      background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.10) 0 5px,transparent 5px 11px)}
    /* web-thread scrollbars */
    ::-webkit-scrollbar{width:10px;height:10px}
    ::-webkit-scrollbar-track{background:rgba(18,6,9,.6)}
    ::-webkit-scrollbar-thumb{background:linear-gradient(rgba(230,36,46,.7),rgba(143,18,32,.9));border-radius:8px;border:2px solid rgba(18,6,9,.8)}
    /* dangling spider */
    .sw-dangle{position:fixed;top:0;right:9%;z-index:70;pointer-events:none;transform-origin:top center;animation:swSwing 4.5s ease-in-out infinite}
    .sw-dangle .thread{width:2px;height:64px;margin:0 auto;background:rgba(247,238,240,.45)}
    .sw-dangle .spider{font-size:22px;transform:translateY(-5px);filter:drop-shadow(2px 2px 0 rgba(0,0,0,.6))}
    @keyframes swSwing{0%,100%{transform:rotate(5deg)}50%{transform:rotate(-5deg)}}
    /* onomatopoeia burst */
    .pow{position:fixed;z-index:400;pointer-events:none;left:0;top:0;background:var(--red);color:#fff;
      font-family:"Bangers",cursive;font-size:1.35rem;letter-spacing:.06em;padding:16px 20px;
      text-shadow:2px 2px 0 #000;clip-path:polygon(50% 0%,59% 17%,76% 6%,78% 26%,98% 26%,88% 42%,100% 50%,88% 58%,98% 74%,78% 74%,76% 94%,59% 83%,50% 100%,41% 83%,24% 94%,22% 74%,2% 74%,12% 58%,0% 50%,12% 42%,2% 26%,22% 26%,24% 6%,41% 17%);
      animation:swPow .75s ease forwards}
    @keyframes swPow{
      0%{transform:translate(-50%,-50%) rotate(var(--rot)) scale(0);opacity:0}
      25%{transform:translate(-50%,-50%) rotate(var(--rot)) scale(1.25);opacity:1}
      55%{transform:translate(-50%,-50%) rotate(var(--rot)) scale(1)}
      100%{transform:translate(-50%,-50%) rotate(var(--rot)) scale(1.05);opacity:0}}
    /* panels slide in */
    #appView .panel{animation:swPanel .35s ease}
    @keyframes swPanel{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  `;
  document.head.appendChild(style);

  const dots = document.createElement("div");
  dots.className = "sw-dots";
  document.body.appendChild(dots);

  const dangle = document.createElement("div");
  dangle.className = "sw-dangle";
  dangle.innerHTML = '<div class="thread"></div><div class="spider">🕷️</div>';
  document.body.appendChild(dangle);

  function pow(word, x, y) {
    const el = document.createElement("div");
    el.className = "pow";
    el.textContent = word;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.setProperty("--rot", (Math.random() * 24 - 12) + "deg");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  function wordFor(btn) {
    const t = (btn.textContent || "").toLowerCase();
    if (t.includes("countersign") || t.includes("sign")) return "THWIP!";
    if (t.includes("delete") || t.includes("remove")) return "POW!";
    if (t.includes("send")) return "ZAP!";
    if (t.includes("approve")) return "YESS!";
    if (t.includes("renew")) return "KA-CHING!";
    if (t.includes("download") || t.includes("letter")) return "SWOOSH!";
    if (t.includes("create") || t.includes("add") || t.includes("new") || t.includes("upload")) return "BAM!";
    return null;
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    const w = wordFor(btn);
    if (!w) return;
    const r = btn.getBoundingClientRect();
    pow(w, r.left + r.width / 2, r.top + r.height / 2);
  });

  // logo easter egg: click the badge → THWIP + spider dips
  const badge = document.querySelector(".brand-badge");
  if (badge) badge.addEventListener("click", () => {
    const r = badge.getBoundingClientRect();
    pow("THWIP!", r.left + r.width / 2, r.top + r.height / 2);
    dangle.style.animation = "none";
    void dangle.offsetWidth;
    dangle.style.animation = "";
  });

  console.log("SPIDERWEB Drop 5 loaded — thwip.");
})();
/* SPIDERWEB-DROP5-END */
