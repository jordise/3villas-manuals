/* Pruebas de integracion del link de policia.
   node police-url.integration.test.js

   IMPORTANTE: este fichero NO copia el codigo de las paginas. Extrae el texto
   real de cada accesor del propio HTML y lo ejecuta. Si alguien edita un
   accesor en una pagina, estas pruebas corren el codigo NUEVO. Una copia
   pegada aqui solo probaria el pasado. */
global.window = global;
require('./police-url.js');
var fs = require('fs');
var P = window.PoliceUrl;
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); } }
function param(u, n) { var m = (u || '').match(new RegExp('[?&]' + n + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : null; }

/* Saca el texto de `function NOMBRE(...){...}` contando llaves. */
function fnSource(file, name) {
  var src = fs.readFileSync(file, 'utf8');
  var i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('no encuentro ' + name + ' en ' + file);
  var j = src.indexOf('{', i), depth = 0, k = j;
  for (; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) { k++; break; } }
  }
  return src.slice(i, k);
}

console.log('\n1. checkin-pasos.html (huesped) — accesor real extraido del fichero');
var pasosSrc = fs.readFileSync('checkin-pasos.html', 'utf8');
var villaFlds = pasosSrc.match(/var _polVillaFlds=\{[^}]*\};/)[0];
var makePasosGet = new Function('r', villaFlds + '\n' + fnSource('checkin-pasos.html', '_polGet') + '\nreturn _polGet;');

var ROW = {
  TaBookings2021_Checkin: '2026-09-10', TaBookings2021_Checkout: '2026-09-17',
  TaBookings2021_Cretated_At: '2026-06-02',
  TaBookings2021_Adults: '', TaBookings2021_Children: '',
  TaBookings2021_Guest_Full_Name: 'Marc', TaBookings2021_Guest_Surename: 'Dupont',
  TaBookings2021_Guest_phonenumber: '‪+33 6 12 34 56 78‬',
  TaVillas_Link_Registrodepolicia: 'org-villa-real'
};
function withCount(r) { var o = Object.assign({}, r); o.TaBookings2021_Adults = '5'; o.TaBookings2021_Children = '2'; return o; }
function guest(row, opts) { return P.build(makePasosGet(row), Object.assign({ code: '64958799', contractDate: 'today' }, opts || {})); }

var r1 = guest(ROW);
ok('encuentra la organizacion de la villa', r1.url.indexOf('org-villa-real') > 0);
ok('sin numero de personas envia number=0, NO number=1', param(r1.url, 'number') === '0', 'number=' + param(r1.url, 'number'));
ok('telefono limpio y con prefijo 00', param(r1.url, 'phone') === '0033612345678', param(r1.url, 'phone'));
ok('con personas envia el total real (5+2=7)', param(guest(withCount(ROW)).url, 'number') === '7');
ok('sin avisos cuando el dato existe', guest(withCount(ROW)).warnings.length === 0);

var vacio = Object.assign({}, withCount(ROW), { Checkin: '', Link_Registrodepolicia: '' });
ok('una columna vacia sin prefijo no tapa la misma columna con prefijo',
   param(guest(vacio).url, 'checkInDate') === '20260910' && guest(vacio).url.indexOf('org-villa-real') > 0,
   'checkInDate=' + param(guest(vacio).url, 'checkInDate'));

var sinOrg = Object.assign({}, withCount(ROW)); delete sinOrg.TaVillas_Link_Registrodepolicia;
ok('el huesped conserva la organizacion por defecto (no se queda sin link)', guest(sinOrg).url.indexOf('20e22b77') > 0);
ok('  ...y avisa de que la usa', guest(sinOrg).warnings.indexOf('no-organization') >= 0);

console.log('\n2. Fechas: nada que no sean ocho digitos entra en la URL');
var sucia = Object.assign({}, withCount(ROW), { TaBookings2021_Checkin: '2026-09-05&number=1#' });
var rs = guest(sucia);
ok('una fecha con caracteres extra NO inyecta parametros', param(rs.url, 'number') === '7', 'number=' + param(rs.url, 'number'));
ok('  ...la fecha invalida se descarta', param(rs.url, 'checkInDate') === '');
ok('  ...y el telefono sigue llegando (la URL no se corta)', param(rs.url, 'phone') === '0033612345678');
ok('la fecha ISO con hora se lee bien', param(guest(Object.assign({}, withCount(ROW), { TaBookings2021_Checkin: '2026-09-10T00:00:00' })).url, 'checkInDate') === '20260910');
ok('la fecha sin ceros se rellena', param(guest(Object.assign({}, withCount(ROW), { TaBookings2021_Checkin: '2026-9-5' })).url, 'checkInDate') === '20260905');
ok('un texto que no es fecha da vacio, no NaN', param(guest(Object.assign({}, withCount(ROW), { TaBookings2021_Checkin: 'pendiente' })).url, 'checkInDate') === '');

console.log('\n3. Link propio del complejo: solo direcciones web');
['javascript:alert(1)', 'JavaScript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox'].forEach(function (mal) {
  var rr = guest(Object.assign({}, withCount(ROW), { TaVillas_Lint_Policia_castellsol: mal }));
  ok('rechaza ' + JSON.stringify(mal.slice(0, 22)), rr.url.indexOf('policheckin01') > 0 && rr.warnings.indexOf('external-link-invalid') >= 0);
});
var bueno = guest(Object.assign({}, withCount(ROW), { TaVillas_Lint_Policia_castellsol: 'https://castellsol.example/registro' }));
ok('acepta una direccion https normal', bueno.url === 'https://castellsol.example/registro' && bueno.external === true);

console.log('\n4. Paginas del equipo — accesor real extraido del fichero');
['notas-equipo-reservas.html', 'notas-villamanager.html'].forEach(function (file) {
  var makeGet = new Function('bookingData', 'villaData',
    fnSource(file, 'fB') + '\n' + fnSource(file, 'fV') + '\n' + fnSource(file, 'polGet') + '\nreturn polGet;');
  function staff(row, opts) {
    return P.build(makeGet(row, row), Object.assign({ code: '64958799', contractDate: 'created', ignoreExternal: true, allowFallbackOrg: false }, opts || {}));
  }
  var s1 = staff(withCount(ROW));
  ok(file + ': encuentra la organizacion con prefijo TaVillas_', s1.url.indexOf('org-villa-real') > 0);
  ok(file + ': contractDate = fecha de creacion', param(s1.url, 'contractDate') === '20260602');
  ok(file + ': telefono limpio', param(s1.url, 'phone') === '0033612345678');
  ok(file + ': sin personas envia number=0 y avisa',
     param(staff(ROW).url, 'number') === '0' && staff(ROW).warnings.indexOf('count-unknown') >= 0);

  var sinOrgS = Object.assign({}, withCount(ROW)); delete sinOrgS.TaVillas_Link_Registrodepolicia;
  var s2 = staff(sinOrgS);
  ok(file + ': villa sin organizacion NO produce link', s2.url === '', s2.url);
  ok(file + ':   ...y avisa al equipo', s2.warnings.indexOf('no-organization') >= 0);

  var vacioS = Object.assign({}, withCount(ROW), { Checkin: '' });
  ok(file + ': columna vacia sin prefijo no tapa la prefijada',
     param(staff(vacioS).url, 'checkInDate') === '20260910', param(staff(vacioS).url, 'checkInDate'));

  var ext = staff(Object.assign({}, withCount(ROW), { TaVillas_Lint_Policia_castellsol: 'https://castellsol.example/f' }));
  ok(file + ': villa con formulario propio sigue mostrando el link de policheckin', ext.url.indexOf('policheckin01') > 0);
  ok(file + ':   ...mas el aviso y el link del complejo',
     ext.warnings.indexOf('external-complex') >= 0 && ext.externalUrl === 'https://castellsol.example/f');
});

console.log('\n5. checkin-testear-reserva.html — accesor real extraido del fichero');
var FORM = {};
global.document = { getElementById: function (id) { return FORM[id] !== undefined ? { value: FORM[id] } : null; } };
var makeTestGet = new Function('_booking',
  'function g(f){ return _booking ? (_booking[f]??"") : ""; }\n' +
  fnSource('checkin-testear-reserva.html', 'polGetTest') + '\nreturn polGetTest;');
function tester(row, form, opts) {
  FORM = form || {};
  return P.build(makeTestGet(row), Object.assign({ code: '64958799', contractDate: 'today', ignoreExternal: true, allowFallbackOrg: false }, opts || {}));
}
ok('encuentra la organizacion', tester(withCount(ROW)).url.indexOf('org-villa-real') > 0);
ok('sin personas envia number=0', param(tester(ROW).url, 'number') === '0');
ok('el prefijo internacional se conserva', param(tester(withCount(ROW)).url, 'phone') === '0033612345678');
ok('lo escrito en el formulario gana al dato guardado',
   param(tester(withCount(ROW), { f_Guest_Surename: 'Martin', f_Guest_phonenumber_ha: '+34600111222' }).url, 'lastName1') === 'Martin');
var conFiscal = Object.assign({}, withCount(ROW), { TaBookings2021_Fiscal_guest_name: 'GUARDADO', TaBookings2021_Segundo_Telefono: '+34699999999' });
ok('el nombre fiscal escrito gana al nombre fiscal guardado',
   param(tester(conFiscal, { f_Fiscal_guest_name: 'ESCRITO' }).url, 'firstName') === 'ESCRITO',
   param(tester(conFiscal, { f_Fiscal_guest_name: 'ESCRITO' }).url, 'firstName'));
ok('el segundo telefono escrito gana al guardado',
   param(tester(conFiscal, { f_Segundo_Telefono: '+34600000001' }).url, 'phone') === '0034600000001');
var sinOrgT = Object.assign({}, withCount(ROW)); delete sinOrgT.TaVillas_Link_Registrodepolicia;
ok('villa sin organizacion NO produce link', tester(sinOrgT).url === '');

console.log('\n6. La pagina de pruebas ya no pierde un dia en la fecha');
var makeToInput = new Function(fnSource('checkin-testear-reserva.html', 'toInputDate') + '\nreturn toInputDate;');
var toInputDate = makeToInput();
ok("'2026-09-10T00:00:00' se queda en 2026-09-10", toInputDate('2026-09-10T00:00:00') === '2026-09-10', toInputDate('2026-09-10T00:00:00'));
ok("'2026-01-01' se queda en 2026-01-01", toInputDate('2026-01-01') === '2026-01-01', toInputDate('2026-01-01'));
ok('un valor vacio da cadena vacia', toInputDate('') === '');

console.log('\n7. Las cuatro paginas: fichero compartido cargado y sin constructor propio');
['checkin-pasos.html', 'notas-equipo-reservas.html', 'notas-villamanager.html', 'checkin-testear-reserva.html'].forEach(function (f) {
  var h = fs.readFileSync(f, 'utf8');
  ok(f + ' carga police-url.js con version', h.indexOf('<script src="police-url.js?v=') >= 0);
  ok(f + ' ya no contiene la URL de policheckin', h.indexOf('policheckin01') < 0);
  var m = h.match(/VERSIÓN ACTUAL:\s*v(\d+)/);
  var pv = h.match(/var PAGE_VERSION\s*=\s*(\d+)/);
  ok(f + ' marcador de version y PAGE_VERSION coinciden',
     !pv || (m && m[1] === pv[1]), m ? ('marcador v' + m[1] + ' vs PAGE_VERSION ' + (pv && pv[1])) : 'sin marcador');
});

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
