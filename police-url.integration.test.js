/* Pruebas de integracion: los accesores REALES de cada pagina contra filas de
   Caspio con la forma que devuelve el proxy. El riesgo de esta refactorizacion
   no esta en el constructor (ya cubierto por police-url.test.js) sino en que
   una pagina lea los campos con el prefijo equivocado y el link salga vacio.
   node police-url.integration.test.js */
global.window = global;
require('./police-url.js');
var fs = require('fs');
var P = window.PoliceUrl;
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); } }
function param(u, n) { var m = u.match(new RegExp('[?&]' + n + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : null; }

/* Guarda contra la deriva: si alguien edita el accesor en la pagina y no aqui,
   esta prueba falla y avisa. */
function guard(file, needle) {
  ok('el accesor de ' + file + ' sigue siendo el que se prueba aqui',
     fs.readFileSync(file, 'utf8').indexOf(needle) >= 0);
}

/* Fila tipica del proxy: vista unida TaBookings2021 + TaVillas, todo prefijado.
   Reserva SIN numero de personas — el caso que rompia el formulario. */
var ROW = {
  TaBookings2021_FS_confirmation_code: '64958799',
  TaBookings2021_Checkin: '2026-09-10', TaBookings2021_Checkout: '2026-09-17',
  TaBookings2021_Cretated_At: '2026-06-02',
  TaBookings2021_Adults: '', TaBookings2021_Children: '',
  TaBookings2021_Guest_adults_nr_form: '', TaBookings2021_Guest_children_nr_form: '',
  TaBookings2021_Guest_Full_Name: 'Marc', TaBookings2021_Guest_Surename: 'Dupont',
  TaBookings2021_Guest_phonenumber: '‪+33 6 12 34 56 78‬',
  TaVillas_Link_Registrodepolicia: 'org-villa-real'
};
function withCount(row) {
  var r = Object.assign({}, row);
  r.TaBookings2021_Adults = '5'; r.TaBookings2021_Children = '2';
  return r;
}

console.log('\n1. checkin-pasos.html (huesped)');
guard('checkin-pasos.html', "var pfx=_polVillaFlds[k]?['TaVillas_','TaBookings2021_','']");
function getPasos(r) {
  var villa = { Link_Registrodepolicia: 1, Lint_Policia_castellsol: 1 };
  return function (k) {
    var pfx = villa[k] ? ['TaVillas_', 'TaBookings2021_', ''] : ['TaBookings2021_', 'TaVillas_', ''];
    for (var i = 0; i < 3; i++) { var v = r[pfx[i] + k]; if (v !== undefined && v !== null) return v; }
    return '';
  };
}
var r1 = P.build(getPasos(ROW), { code: '64958799', contractDate: 'today' });
ok('la organizacion de la villa se encuentra (no la de por defecto)', r1.url.indexOf('org-villa-real') > 0, r1.url);
ok('sin numero de personas envia number=0, NO number=1', param(r1.url, 'number') === '0', 'number=' + param(r1.url, 'number'));
ok('  (antes de este cambio enviaba 1 y el formulario se cerraba tras un huesped)', r1.countSource === 'unknown');
ok('telefono limpio y con prefijo 00', param(r1.url, 'phone') === '0033612345678', param(r1.url, 'phone'));
ok('fechas correctas', param(r1.url, 'checkInDate') === '20260910' && param(r1.url, 'checkOutDate') === '20260917');
ok('nombre y apellido correctos', param(r1.url, 'firstName') === 'Marc' && param(r1.url, 'lastName1') === 'Dupont');
var r1b = P.build(getPasos(withCount(ROW)), { code: '64958799', contractDate: 'today' });
ok('con personas en Hostaway envia el total real (5+2=7)', param(r1b.url, 'number') === '7', 'number=' + param(r1b.url, 'number'));
ok('  ...y sin avisos', r1b.warnings.length === 0);

console.log('\n2. notas-equipo-reservas.html y notas-villamanager.html (equipo)');
guard('notas-equipo-reservas.html', "function polGet(k){");
guard('notas-villamanager.html', "function polGet(k){");
function getEquipo(bookingData) {
  function fB(k) { var v = bookingData[k]; if (v !== undefined && v !== null) return v; v = bookingData['TaBookings2021_' + k]; if (v !== undefined && v !== null) return v; return ''; }
  return function polGet(k) {
    if (k === 'Link_Registrodepolicia' || k === 'Lint_Policia_castellsol') { var v = fB('TaVillas_' + k); if (v !== '') return v; }
    return fB(k);
  };
}
var r2 = P.build(getEquipo(ROW), { code: '64958799', contractDate: 'created', ignoreExternal: true });
ok('la organizacion de la villa se encuentra con el prefijo TaVillas_', r2.url.indexOf('org-villa-real') > 0, r2.url);
ok('contractDate = fecha de creacion de la reserva (como antes)', param(r2.url, 'contractDate') === '20260602', param(r2.url, 'contractDate'));
ok('sin numero de personas envia number=0 (igual que el link que funcionaba)', param(r2.url, 'number') === '0');
ok('  ...y avisa al equipo para que corrija la reserva', r2.warnings.indexOf('count-unknown') >= 0);
ok('telefono limpio (fix que villamanager no tenia)', param(r2.url, 'phone') === '0033612345678', param(r2.url, 'phone'));
var r2b = P.build(getEquipo(withCount(ROW)), { code: '64958799', contractDate: 'created', ignoreExternal: true });
ok('con personas envia el total real (7) y no avisa', param(r2b.url, 'number') === '7' && r2b.warnings.length === 0);

var rowExt = Object.assign({}, withCount(ROW), { TaVillas_Lint_Policia_castellsol: 'https://castellsol.example/registro' });
var r2c = P.build(getEquipo(rowExt), { code: '64958799', contractDate: 'created', ignoreExternal: true });
ok('villa con formulario propio: el equipo sigue viendo el link de policheckin', r2c.url.indexOf('policheckin01') > 0);
ok('  ...mas el aviso y el link del complejo', r2c.warnings.indexOf('external-complex') >= 0 && r2c.externalUrl === 'https://castellsol.example/registro');
var r1c = P.build(getPasos(rowExt), { code: '64958799', contractDate: 'today' });
ok('la pagina del huesped manda al formulario del complejo (comportamiento de siempre)', r1c.url === 'https://castellsol.example/registro' && r1c.external === true);

console.log('\n3. checkin-testear-reserva.html (pagina de pruebas)');
guard('checkin-testear-reserva.html', "function polGetTest(k){");
function getTest(booking, form) {
  form = form || {};
  function g(f) { var v = booking[f]; return (v === undefined || v === null) ? '' : v; }
  return function (k) {
    var live = { Guest_Name: 'f_Guest_Name', Guest_Full_Name: 'f_Guest_Name', Guest_Surename: 'f_Guest_Surename', Guest_phonenumber: 'f_Guest_phonenumber_ha', Checkin: 'f_Checkin', Checkout: 'f_Checkout' };
    if (live[k] && form[live[k]] !== undefined && form[live[k]] !== '') return form[live[k]];
    if (k === 'Link_Registrodepolicia' || k === 'Lint_Policia_castellsol') { var vv = g('TaVillas_' + k); if (vv !== '') return vv; }
    var v = g('TaBookings2021_' + k); if (v !== '') return v;
    v = g('TaVillas_' + k); if (v !== '') return v;
    return g(k);
  };
}
var r3 = P.build(getTest(ROW), { code: '64958799', contractDate: 'today', ignoreExternal: true });
ok('encuentra la organizacion', r3.url.indexOf('org-villa-real') > 0);
ok('sin personas envia number=0, NO el 1 inventado de antes', param(r3.url, 'number') === '0');
ok('telefono con prefijo internacional intacto (antes /\\D/g borraba el +)', param(r3.url, 'phone') === '0033612345678', param(r3.url, 'phone'));
var r3b = P.build(getTest(ROW, { f_Guest_Surename: 'Martin', f_Guest_phonenumber_ha: '+34600111222' }), { code: '64958799', contractDate: 'today', ignoreExternal: true });
ok('lo escrito en el formulario manda sobre el dato guardado', param(r3b.url, 'lastName1') === 'Martin' && param(r3b.url, 'phone') === '0034600111222');

console.log('\n4. las cuatro paginas cargan police-url.js y ya no construyen el link');
['checkin-pasos.html', 'notas-equipo-reservas.html', 'notas-villamanager.html', 'checkin-testear-reserva.html'].forEach(function (f) {
  var h = fs.readFileSync(f, 'utf8');
  ok(f + ' carga police-url.js', h.indexOf('<script src="police-url.js">') >= 0);
  ok(f + ' ya no contiene la URL de policheckin', h.indexOf('policheckin01') < 0);
});

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
