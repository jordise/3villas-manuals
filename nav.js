// ================================================================
//  nav.js — MENÚS POR ROL  3Villas  v6
// ================================================================

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

// HISTORIAL: v6 - Fix error de sintaxis en children de Configuración (comas faltantes); eliminado duplicado "Roles y permisos"; URL hostaway-comprobar-fechas-reservas.html añadida con .html | v5 - versión anterior
