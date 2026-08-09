/* SPIDERWEB DROP 9 — mobile UX pass */
(function () {
  "use strict";
  if (window.__DROP9__) return;
  window.__DROP9__ = true;

  if (!document.querySelector('meta[name="viewport"]')) {
    const m = document.createElement("meta");
    m.name = "viewport";
    m.content = "width=device-width, initial-scale=1";
    document.head.appendChild(m);
  }

  const style = document.createElement("style");
  style.textContent = `
    html{-webkit-text-size-adjust:100%}
    body{overflow-x:hidden;-webkit-tap-highlight-color:transparent}
    @media(max-width:720px){
      .topbar{padding:10px 12px}
      .topbar p{display:none!important}
      .brand-copy h1{font-size:1.15rem!important}
      .sw-logo{width:38px!important;height:38px!important}
      .top-actions{gap:8px}
      .sw-dangle{display:none}
      .sw-topnav{top:60px;padding:6px 8px}
      .sw-pill{width:100%;justify-content:flex-start;overflow-x:auto;overflow-y:hidden;padding:4px;gap:6px;max-height:none;-webkit-overflow-scrolling:touch}
      .sw-chip{width:auto!important;min-width:58px;height:54px;flex:0 0 auto;display:flex;flex-direction:column;gap:3px;padding:6px 12px}
      .sw-chip .ic{font-size:1.25rem}
      .sw-label{opacity:1!important;max-width:none!important;transform:none!important;font-size:.72rem;letter-spacing:.05em}
      .sw-chip:hover,.sw-chip.active{width:auto!important}
      .page-head{flex-direction:column;align-items:stretch;gap:10px}
      .page-head .btn{width:100%}
      .modal-box{width:96vw!important;max-height:92vh;overflow:auto;padding:14px}
      .sw-btns{flex-direction:column}
      .sw-btns .btn{width:100%}
      .btn{min-height:44px}
      input,select,textarea{font-size:16px!important}
      .toast{left:12px;right:12px;max-width:none}
      .doc-actions{flex-wrap:wrap}
      .stats{flex-wrap:wrap!important}
      .stat{flex:1 1 46%!important;min-width:46%!important}
      h2{font-size:1.3rem}
      .sw-pager button{padding:10px 16px}
    }
    @media(max-width:420px){
      .brand-copy h1{font-size:1rem!important}
      .sw-chip .sw-label{font-size:.65rem}
      .sw-chip{min-width:52px;padding:6px 9px}
    }
  `;
  document.head.appendChild(style);

  console.log("SPIDERWEB Drop 9 loaded — mobile pass.");
})();
/* SPIDERWEB-DROP9-END */
