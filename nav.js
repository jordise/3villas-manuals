// ================================================================
//  nav.js — MENÚS POR ROL  3Villas  v7
// ================================================================
// VERSIÓN ACTUAL: v7 | Historial completo al final de este archivo

var _NAV_WORKER = 'https://caspio-proxy.jordi-89b.workers.dev';

var _itemEquipo = {
  label: 'Equipo',
  icon: '👥',
  children: [
    { label: 'Horarios', icon: '📄', url: 'https://docs.google.com/document/d/1cStA_oxwK__WiJSn-5Ut1J5nUkJVZIlDDy2jYFtn_k4/edit?tab=t.0' }
  ]
};

var _menuAdmin = [
  { label: 'Entradas y Salidas', url: 'entradas.html',           icon: '🚪' },
  { label: 'Villas',             url: 'buscar-villa.html',        icon: '🏡' },
  { label: 'Contactos',          url: 'contactos.html',           icon: '👥' },
  { label: 'Tareas',             url: 'tareas.html',              icon: '✅' },
  { label: 'Ocupación',          url: 'listado-ocupacion.html',   icon: '📅' },
  { label: 'WelcomePacks',       url: 'pedir-wellcomepacks.html', icon: '📦' },
  { label: 'Guardias',           url: 'guardias-e-intervenciones.html', icon: '🚨' },
  _itemEquipo,
  {
    label: 'Listados', icon: '📖',
    children: [
      { label: 'Reporte ventas semanal', url: 'reports-ventas.html', icon: '📄' }
    ]
  },
    {
    label: 'Administración', icon: '📖',
    children: [
      { label: 'Nueva Villa',       url: 'crear-villa.html',                     icon: '🏠' },
      { label: 'Control Waiver',      url: 'control-waiver.html',             icon: '🔧' },
      { label: 'Listado Guardias',          url: 'listado-guardias-e-intervenciones.html',   icon: '📅' }
      { label: 'Reuniones',          url: 'reuniones.html',   icon: '📅' }
    ]
  },
  {
    label: 'Configuración', icon: '⚙️',
    children: [
      { label: 'Test checkin-online',        url: 'checkin-test-reserva.html',              icon: '🧪' },
      { label: 'Revisar fechas reservas',    url: 'hostaway-comprobar-fechas-reservas.html', icon: '🔄' },
      { label: 'Revisar multiunits',    url: 'hostaway-comprobar-multiunits.html', icon: '🔄' },
      { label: 'Roles y permisos',           url: 'permisos.html',                          icon: '🔐' },
      { label: 'Test1',                      url: 'XXtest1XX.html',                         icon: '1'  },
      { label: 'Test2',                      url: 'XXtest2XX.html',                         icon: '2'  },
      { label: 'Test3',                      url: 'XXtest3XX.html',                         icon: '3'  }
    ]
  },
  { label: 'Login', url: 'login.html', icon: '🔑' }
];

var _menuStaff = [
  { label: 'Entradas y Salidas', url: 'entradas.html',           icon: '🚪' },
  { label: 'Villas',             url: 'buscar-villa.html',        icon: '🏡' },
  { label: 'Contactos',          url: 'contactos.html',           icon: '👥' },
  { label: 'Tareas',             url: 'tareas.html',              icon: '✅' },
  { label: 'Ocupación',          url: 'listado-ocupacion.html',   icon: '📅' },
  { label: 'WelcomePacks',       url: 'pedir-wellcomepacks.html', icon: '📦' },
  { label: 'Guardias',           url: 'guardias-e-intervenciones.html', icon: '🚨' },
  _itemEquipo,
  { label: 'Login', url: 'login.html', icon: '🔑' }
];

var _menuSales = [
  { label: 'Reporte Semanal', url: 'reports-ventas.html', icon: '📅' },
  {
    label: 'Vacacional', icon: '📖',
    children: [
      { label: 'Villas',    url: 'buscar-villa.html', icon: '🏡' },
      { label: 'Contactos', url: 'contactos.html',    icon: '👥' }
    ]
  },
      {
    label: 'Administración', icon: '📖',
    children: [
      { label: 'Nueva Villa',       url: 'crear-villa.html',                     icon: '🏠' },
      { label: 'Control Waiver',      url: 'control-waiver.html',             icon: '🔧' },
      { label: 'Reuniones',          url: 'reuniones.html',   icon: '📅' }
    ]
  },
  { label: 'Login', url: 'login.html', icon: '🔑' }
];

var _menuCleaner = [
  { label: 'Entradas y Salidas', url: 'entradas.html',    icon: '🚪' },
  { label: 'Mis tareas',         url: 'tareas.html',       icon: '✅' },
  { label: 'Villas',             url: 'buscar-villa.html', icon: '🏡' },
  { label: 'Login',              url: 'login.html',        icon: '🔑' }
];

var NAV_MENUS = {
  'admin':        _menuAdmin,
  'manager':      _menuAdmin,
  'staff':        _menuStaff,
  'villamanager': _menuStaff,
  'sales':        _menuSales,
  'comercial':    _menuSales,
  'cleaner':      _menuCleaner,
  'limpieza':     _menuCleaner,
  'default':      _menuAdmin
};

// ── Asignación síncrona ──────────────────────────────────────────
var NAV_MENU = (function () {
  try {
    var rawRole = (typeof Auth !== 'undefined' && Auth.role) ? Auth.role() : '';
    var role    = String(rawRole || '').trim().toLowerCase();
    window.__navRole = role;
    console.log('[nav.js] Auth.role() =', JSON.stringify(rawRole), '→ key =', JSON.stringify(role));
    var menu = NAV_MENUS[role];
    if (!menu) {
      console.warn('[nav.js] Rol "' + role + '" no tiene menú definido → usando admin completo');
      menu = _menuAdmin;
    }
    return menu;
  } catch (e) {
    console.error('[nav.js] Error al leer rol:', e);
    window.__navRole = 'default';
    return _menuAdmin;
  }
})();

// ── Tracker de página anterior ───────────────────────────────────
(function () {
  try {
    if (location.pathname.indexOf('usuario-valores-por-defecto') === -1) {
      localStorage.setItem('3v_prev_page', location.href);
    }
  } catch (e) {}
})();

// ── AUTO-DETECCIÓN DE VERSIÓN ─────────────────────────────────────
// Comprueba en 2º plano si el servidor tiene una versión más nueva
// de nav.js (lee el comentario "VERSIÓN ACTUAL: vXX" de la copia
// fresca) y, si es así, recarga la página UNA sola vez por versión
// (marca en sessionStorage para no entrar nunca en bucle). Como
// nav.js es compartido por todas las páginas, esto corrige el menú
// desactualizado en todo el intranet, no solo en la página actual.
// No bloquea la carga ni rompe nada si falla. Mismo mecanismo ya
// probado en checkin-pasos.html (v76) y en reuniones.html (v14).
(function () {
  var NAV_VERSION = 7; /* debe coincidir con la versión de este archivo */
  try {
    if (location.protocol.indexOf('http') !== 0) return; /* file:// u otros: no aplicar */
    fetch('nav.js', { cache: 'reload' }) /* red directa + actualiza la caché HTTP */
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (js) {
        var m = js.match(/VERSI\u00d3N ACTUAL:\s*v(\d+)/i);
        if (!m) return;
        var srvV = parseInt(m[1], 10);
        if (!(srvV > NAV_VERSION)) return; /* solo recargar si el servidor va POR DELANTE */
        var key = '3v_vchk_nav.js_v' + srvV;
        if (sessionStorage.getItem(key)) return; /* ya se intentó esta versión: evitar bucle */
        sessionStorage.setItem(key, '1');
        location.reload(); /* recarga la página actual completa (toma el nav.js fresco) */
      })
      .catch(function () { /* sin red o error: seguir con la versión actual */ });
  } catch (e) { /* esta comprobación jamás debe romper la página */ }
})();

// HISTORIAL: v7 - Auto-detección de versión nueva (mismo mecanismo "Opción B" ya implementado y probado en checkin-pasos.html desde su v76 y en reuniones.html desde su v14, pedido por Jordi para replicarlo aquí): nueva IIFE al final del archivo que hace un fetch de 'nav.js' con cache:'reload' (va a red saltándose la caché del navegador), lee el nuevo comentario "VERSIÓN ACTUAL: vXX" (añadido en la cabecera, junto al comentario de nombre/versión existente) de la copia fresca del servidor y lo compara con la constante embebida NAV_VERSION (=7, actualizar en cada nueva versión junto con el número en la cabecera y en el historial). Si el servidor va por delante, recarga la página actual completa una sola vez por versión (marca antibucle en sessionStorage '3v_vchk_nav.js_v<XX>'); si va por detrás o falla (sin red, file://), no hace nada. A diferencia de las páginas HTML (que se recargan a sí mismas), aquí la recarga es de la página que esté cargando nav.js en ese momento — como nav.js lo cargan prácticamente todas las páginas del intranet, esto corrige de raíz el problema de menú desactualizado en TODO el sitio, no solo en una página. Coste: +1 fetch a nav.js por carga de página en todo el intranet (avisado y aceptado por Jordi). Recuerda: nav.js es de nombre fijo (excepción, como checkin-auth.js) — la versión va solo en la cabecera y el historial, nunca en el nombre del archivo. | v6 - Fix error de sintaxis en children de Configuración (comas faltantes); eliminado duplicado "Roles y permisos"; URL hostaway-comprobar-fechas-reservas.html añadida con .html | v5 - versión anterior
