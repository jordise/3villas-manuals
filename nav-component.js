// ================================================================
//  nav-component.js — Renderizador del menú  3Villas
//  No edites este archivo para cambiar el menú.
//  Edita nav.js en su lugar.
//
//  Para añadir el menú a una página, incluye AMBOS scripts:
//    <script src="nav.js"></script>
//    <script src="nav-component.js"></script>
// ================================================================

(function () {

  // ── CSS del sidebar ─────────────────────────────────────────
  const STYLES = `
    #nav-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.45);
      z-index: 900;
      backdrop-filter: blur(2px);
      animation: navFadeIn .2s ease;
    }
    #nav-overlay.open { display: block; }
    @keyframes navFadeIn { from{opacity:0} to{opacity:1} }

    #nav-sidebar {
      position: fixed;
      top: 0; left: 0; bottom: 0;
      width: 270px;
      background: #1e2030;
      color: #fff;
      z-index: 950;
      display: flex;
      flex-direction: column;
      transform: translateX(-100%);
      transition: transform .25s cubic-bezier(.4,0,.2,1);
      box-shadow: 4px 0 24px rgba(0,0,0,.3);
      overflow: hidden;
    }
    #nav-sidebar.open { transform: translateX(0); }

    /* Header del sidebar */
    .nav-head {
      background: #C8102E;
      padding: 16px 20px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .nav-logo {
      font-family: 'Montserrat', sans-serif;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 1px;
      color: #fff;
    }
    .nav-head-logo { height:36px; } .nav-close {
      background: rgba(255,255,255,.15);
      border: none;
      color: #fff;
      width: 30px; height: 30px;
      border-radius: 6px;
      font-size: 18px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
      line-height: 1;
    }
    .nav-close:hover { background: rgba(255,255,255,.3); }

    /* Usuario actual */
    .nav-user {
      padding: 12px 20px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      font-size: 12px;
      color: rgba(255,255,255,.55);
      flex-shrink: 0;
    }
    .nav-user-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,.9);
      margin-bottom: 2px;
    }
    .nav-role {
      display: inline-block;
      background: rgba(255,255,255,.1);
      padding: 1px 8px;
      border-radius: 10px;
      font-size: 10px;
      letter-spacing: .5px;
      text-transform: uppercase;
    }

    /* Lista de menú */
    .nav-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,.1) transparent;
    }

    /* Item */
    .nav-item {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 11px 20px;
      font-size: 13px;
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      color: rgba(255,255,255,.75);
      cursor: pointer;
      transition: all .15s;
      text-decoration: none;
      border-left: 3px solid transparent;
      position: relative;
      letter-spacing: .2px;
    }
    .nav-item:hover {
      background: rgba(255,255,255,.07);
      color: #fff;
    }
    .nav-item.active {
      background: rgba(200,16,46,.25);
      border-left-color: #C8102E;
      color: #fff;
    }
    .nav-item .nav-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
    .nav-item .nav-arrow {
      margin-left: auto;
      font-size: 10px;
      transition: transform .2s;
      color: rgba(255,255,255,.35);
    }
    .nav-item.expanded .nav-arrow { transform: rotate(90deg); }

    /* Sub-menú */
    .nav-children {
      overflow: hidden;
      max-height: 0;
      transition: max-height .25s ease;
    }
    .nav-children.open { max-height: 600px; }

    .nav-subitem {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 20px 9px 44px;
      font-size: 12px;
      font-family: 'Montserrat', sans-serif;
      font-weight: 500;
      color: rgba(255,255,255,.6);
      cursor: pointer;
      transition: all .15s;
      text-decoration: none;
      border-left: 3px solid transparent;
    }
    .nav-subitem:hover { background: rgba(255,255,255,.06); color: #fff; }
    .nav-subitem.active {
      background: rgba(200,16,46,.2);
      border-left-color: #C8102E;
      color: #fff;
    }
    .nav-subitem .nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }

    /* Separador de grupo */
    .nav-sep {
      height: 1px;
      background: rgba(255,255,255,.07);
      margin: 6px 0;
    }

    /* Footer del sidebar */
    .nav-footer {
      border-top: 1px solid rgba(255,255,255,.08);
      padding: 12px 20px;
      flex-shrink: 0;
    }
    .nav-logout {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      background: rgba(255,255,255,.07);
      border: none;
      border-radius: 8px;
      color: rgba(255,255,255,.7);
      font-family: 'Montserrat', sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      transition: all .15s;
      letter-spacing: .3px;
    }
    .nav-logout:hover { background: rgba(200,16,46,.3); color: #fff; }

    /* Botón hamburger en el header */
    .nav-hamburger {
      background: rgba(255,255,255,.15);
      border: none;
      color: #fff;
      width: 36px; height: 36px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background .15s;
      flex-shrink: 0;
    }
    .nav-hamburger:hover { background: rgba(255,255,255,.28); }
    .nav-hamburger span {
      display: block;
      width: 18px; height: 2px;
      background: #fff;
      border-radius: 2px;
      transition: all .2s;
    }

    @media (max-width: 640px) {
      #nav-sidebar { width: 85vw; }
    }
  `;

  // ── Helpers ─────────────────────────────────────────────────
  function currentPage() {
    const path = window.location.pathname;
    return path.split('/').pop() || 'index.html';
  }

  function userRole() {
    try { return (typeof Auth !== 'undefined' && Auth.role) ? Auth.role() : ''; } catch(e) { return ''; }
  }
  function userName() {
    try { return (typeof Auth !== 'undefined' && Auth.name) ? Auth.name() : ''; } catch(e) { return ''; }
  }
  function doLogout() {
    try { if (typeof Auth !== 'undefined' && Auth.logout) Auth.logout(); } catch(e) {}
  }

  function hasAccess(item) {
    if (!item.roles || !item.roles.length) return true;
    const role = userRole();
    return item.roles.includes(role) || role === 'admin';
  }

  // ── Render ──────────────────────────────────────────────────
  function renderItem(item, isChild) {
    if (!hasAccess(item)) return '';

    const cur  = currentPage();
    const isActive = item.url && (cur === item.url);
    const cls  = isChild ? 'nav-subitem' : 'nav-item';
    const icon = item.icon || '▸';

    // Item con hijos (grupo)
    if (!isChild && item.children && item.children.length) {
      const hasActiveChild = item.children.some(c => cur === c.url);
      const id = 'nav-grp-' + Math.random().toString(36).slice(2,7);
      let html = `
        <div class="nav-item${hasActiveChild?' expanded':''}" onclick="document.getElementById('${id}').classList.toggle('open');this.classList.toggle('expanded')">
          <span class="nav-icon">${icon}</span>
          <span>${item.label}</span>
          <span class="nav-arrow">▶</span>
        </div>
        <div class="nav-children${hasActiveChild?' open':''}" id="${id}">
      `;
      item.children.forEach(child => {
        if (hasAccess(child)) html += renderItem(child, true);
      });
      html += '</div>';
      return html;
    }

    // Item simple
    if (item.url) {
      return `<a class="${cls}${isActive?' active':''}" href="${item.url}">
        <span class="nav-icon">${icon}</span>
        <span>${item.label}</span>
      </a>`;
    }

    return '';
  }

  function buildMenu() {
    const menu = (typeof NAV_MENU !== 'undefined') ? NAV_MENU : [];
    let html = '';
    menu.forEach((item, i) => {
      if (i > 0 && !item.children && !menu[i-1]?.children) {
        // no sep
      } else if (i > 0 && (item.children || menu[i-1]?.children)) {
        html += '<div class="nav-sep"></div>';
      }
      html += renderItem(item, false);
    });
    return html;
  }

  // ── DOM Injection ────────────────────────────────────────────
  function init() {
    // Inject CSS
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);

    const name = userName();
    const role = userRole();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'nav-overlay';
    overlay.onclick = closeNav;
    document.body.appendChild(overlay);

    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.id = 'nav-sidebar';
    sidebar.innerHTML = `
      <div class="nav-head">
        <img src="logo-blanco.png" alt="3Villas" style="height:36px;display:block;filter:brightness(0) invert(1)">
        <button class="nav-close" onclick="NavComponent.close()">✕</button>
      </div>
      ${name ? `
      <div class="nav-user">
        <div class="nav-user-name">👤 ${name}</div>
        ${role ? `<span class="nav-role">${role}</span>` : ''}
      </div>` : ''}
      <div class="nav-list" id="nav-list">
        ${buildMenu()}
      </div>
      <div class="nav-footer">
        <button class="nav-logout" onclick="NavComponent.logout()">
          ↪ &nbsp;Cerrar sesión
        </button>
      </div>
    `;
    document.body.appendChild(sidebar);

    // Inject hamburger into existing header
    const header = document.querySelector('header');
    if (header) {
      const hamburger = document.createElement('button');
      hamburger.className = 'nav-hamburger';
      hamburger.title = 'Menú';
      hamburger.innerHTML = '<span></span><span></span><span></span>';
      hamburger.onclick = openNav;
      // Insert as first child of header
      header.insertBefore(hamburger, header.firstChild);
    }
  }

  function openNav() {
    document.getElementById('nav-overlay').classList.add('open');
    document.getElementById('nav-sidebar').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeNav() {
    document.getElementById('nav-overlay').classList.remove('open');
    document.getElementById('nav-sidebar').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Public API ───────────────────────────────────────────────
  window.NavComponent = {
    open   : openNav,
    close  : closeNav,
    logout : function() { closeNav(); doLogout(); },
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* Mia v1 (2026-09-02): carga mia-intranet.js si hay sesion. Quitar esta linea = desactivar Mia. */
try{if(typeof Auth!=='undefined'&&Auth.token&&Auth.token()){var s=document.createElement('script');s.src='mia-intranet.js';s.defer=true;document.head.appendChild(s);}}catch(e){}
