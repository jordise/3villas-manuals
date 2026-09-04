/* Pruebas de police-url.js — node police-url.test.js */
global.window = global;
require('./police-url.js');
var P = window.PoliceUrl;

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function mk(fields) { return function (k) { return fields[k] !== undefined ? fields[k] : ''; }; }
function param(url, name) {
  var m = url.match(new RegExp('[?&]' + name + '=([^&]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

var BASE_VILLA = { Link_Registrodepolicia: 'org-abc', Checkin: '2026-09-10', Checkout: '2026-09-17' };
function booking(extra) { return Object.assign({}, BASE_VILLA, extra); }

console.log('\n1. number= — el fallo que reporta el equipo');

var r = P.build(mk(booking({ Adults: '', Children: '', Guest_adults_nr_form: '' })), { code: 'X1' });
ok('reserva sin datos de personas NO envia number=1', param(r.url, 'number') === '0', 'number=' + param(r.url, 'number'));
ok('  ...y avisa count-unknown', r.warnings.indexOf('count-unknown') >= 0);
ok('  ...y marca la fuente como unknown', r.countSource === 'unknown');

r = P.build(mk(booking({ Adults: '4', Children: '2', Guest_adults_nr_form: '' })), { code: 'X1' });
ok('Arrival Form vacio -> usa Hostaway (4+2=6)', param(r.url, 'number') === '6', 'number=' + param(r.url, 'number'));
ok('  ...sin avisos', r.warnings.length === 0);

r = P.build(mk(booking({ Adults: '4', Children: '2', Guest_adults_nr_form: '0', Guest_children_nr_form: '0' })), { code: 'X1' });
ok('adultos=0 en el formulario NO es un dato real -> cae a Hostaway (6)', param(r.url, 'number') === '6', 'number=' + param(r.url, 'number'));

r = P.build(mk(booking({ Adults: '4', Children: '2', Guest_adults_nr_form: '3', Guest_children_nr_form: '0' })), { code: 'X1' });
ok('formulario confirmado manda sobre Hostaway (3+0=3)', param(r.url, 'number') === '3', 'number=' + param(r.url, 'number'));
ok('  ...ninos=0 se respeta como valor real', r.countSource === 'form');

r = P.build(mk(booking({ Adults: '2', Children: '0', Guest_adults_nr_form: '2', Guest_children_nr_form: '3' })), { code: 'X1' });
ok('formulario con ninos anadidos (2+3=5)', param(r.url, 'number') === '5', 'number=' + param(r.url, 'number'));

console.log('\n2. telefono — el fix que solo tenian 2 de las 4 paginas');

r = P.build(mk(booking({ Guest_phonenumber: '‪+34 666 12 34 56‬', Adults: '2' })), { code: 'X1' });
ok('marcas Unicode invisibles eliminadas', param(r.url, 'phone') === '0034666123456', 'phone=' + param(r.url, 'phone'));

r = P.build(mk(booking({ Guest_phonenumber: '+34 (666) 12-34-56', Adults: '2' })), { code: 'X1' });
ok('espacios, parentesis y guiones eliminados', param(r.url, 'phone') === '0034666123456', 'phone=' + param(r.url, 'phone'));

r = P.build(mk(booking({ Guest_phonenumber: '+41791234567', Adults: '2' })), { code: 'X1' });
ok('prefijo internacional se conserva como 00 (no se pierde)', param(r.url, 'phone') === '0041791234567', 'phone=' + param(r.url, 'phone'));

r = P.build(mk(booking({ Guest_phonenumber: '+34600000000', Segundo_Telefono: '+34611111111', Adults: '2' })), { code: 'X1' });
ok('Segundo_Telefono tiene prioridad', param(r.url, 'phone') === '0034611111111', 'phone=' + param(r.url, 'phone'));

console.log('\n3. nombre y apellido');

r = P.build(mk(booking({ Adults: '2', Guest_Full_Name: 'John', Guest_Surename: 'Smith',
                         Fiscal_guest_name: 'Jonathan', Fiscal_guest_surename: 'Smithson' })), { code: 'X1' });
ok('los datos fiscales mandan', param(r.url, 'firstName') === 'Jonathan' && param(r.url, 'lastName1') === 'Smithson');

r = P.build(mk(booking({ Adults: '2', Guest_Full_Name: 'John', Guest_Surename: 'Smith', Fiscal_guest_name: ' ' })), { code: 'X1' });
ok('un espacio en el nombre fiscal no cuenta', param(r.url, 'firstName') === 'John');

r = P.build(mk(booking({ Adults: '2', Guest_Name: 'Ana', Guest_Surename: 'Roca' })), { code: 'X1' });
ok('Guest_Name (pagina de test) tambien vale', param(r.url, 'firstName') === 'Ana');

console.log('\n4. fechas');

r = P.build(mk(booking({ Adults: '2' })), { code: 'X1' });
ok('checkIn/checkOut en YYYYMMDD', param(r.url, 'checkInDate') === '20260910' && param(r.url, 'checkOutDate') === '20260917');

r = P.build(mk(booking({ Adults: '2', Checkin: '2026-09-10T00:00:00' })), { code: 'X1' });
ok('fecha ISO completa tambien', param(r.url, 'checkInDate') === '20260910', param(r.url, 'checkInDate'));

r = P.build(mk(booking({ Adults: '2', Cretated_At: '2026-07-01' })), { code: 'X1', contractDate: 'created' });
ok('contractDate=created usa la fecha de creacion', param(r.url, 'contractDate') === '20260701', param(r.url, 'contractDate'));

r = P.build(mk(booking({ Adults: '2' })), { code: 'X1' });
ok('contractDate por defecto = hoy', /^\d{8}$/.test(param(r.url, 'contractDate')));

console.log('\n5. villa y organizacion');

r = P.build(mk(booking({ Adults: '2', Lint_Policia_castellsol: 'https://complejo.example/form' })), { code: 'X1' });
ok('complejo externo: se usa su link tal cual', r.url === 'https://complejo.example/form');
ok('  ...marcado como externo', r.external === true);
ok('  ...con aviso para el equipo', r.warnings.indexOf('external-complex') >= 0);

r = P.build(mk({ Adults: '2', Checkin: '2026-09-10', Checkout: '2026-09-17' }), { code: 'X1' });
ok('villa sin Link_Registrodepolicia avisa', r.warnings.indexOf('no-organization') >= 0);
ok('  ...pero el link sigue saliendo (comportamiento actual)', r.url.indexOf('20e22b77') > 0);

r = P.build(mk({ Adults: '2' }), { code: 'X1', allowFallbackOrg: false });
ok('  ...y con allowFallbackOrg:false no sale link', r.url === '');

r = P.build(mk(booking({ Adults: '2', Lint_Policia_castellsol: 'https://complejo.example/form' })),
            { code: 'X1', ignoreExternal: true });
ok('paginas del equipo: el link de policheckin se sigue construyendo', r.url.indexOf('policheckin01') > 0);
ok('  ...y ademas se avisa del complejo externo', r.warnings.indexOf('external-complex') >= 0);
ok('  ...con el link del complejo a mano', r.externalUrl === 'https://complejo.example/form');

console.log('\n6. codificacion');

r = P.build(mk(booking({ Adults: '2', Guest_Full_Name: 'Ana Maria', Guest_Surename: "O'Neill & Co" })), { code: 'A/B 1' });
ok('nombre con espacio codificado', r.url.indexOf('firstName=Ana%20Maria') > 0 || r.url.indexOf('firstName=Ana+Maria') > 0);
ok('apellido con & codificado (no rompe la query)', param(r.url, 'lastName1') === "O'Neill & Co");
ok('codigo de reserva codificado en la ruta', r.url.indexOf('/reservation/A%2FB%201') > 0, r.url);

console.log('\n7. textos de aviso');
ok('cada aviso tiene texto en ES',
  P.warningText('count-unknown').length > 20 &&
  P.warningText('no-organization').length > 20 &&
  P.warningText('external-complex').length > 20);

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
