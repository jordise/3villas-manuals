/* Pruebas del rastro de marcas manuales (peticion de Toni Segui, 04/09/2026).
   node marcas-manuales.test.js

   Como police-url.integration.test.js: NO copia el codigo de las paginas.
   Extrae el texto real de cada funcion del HTML y lo ejecuta. Si alguien edita
   una pagina, estas pruebas corren el codigo NUEVO. */
var fs = require('fs');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); } }

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

/* Saca el bloque de guardar() que anade el sello al record. */
function guardarBlock(file) {
  var src = fs.readFileSync(file, 'utf8');
  var a = src.indexOf('var _mn=marcasNuevas();');
  if (a < 0) throw new Error('no encuentro el bloque de guardar en ' + file);
  var b = src.indexOf("record.Marcas_manuales=_ls.join('\\n');", a);
  if (b < 0) throw new Error('no encuentro la escritura del campo en ' + file);
  return src.slice(a, src.indexOf('}', b) + 1);
}

/* Un DOM minimo: solo lo que estas funciones tocan. */
function makeEnv(file, opts) {
  opts = opts || {};
  var els = {};
  function el(id, extra) {
    var o = { id: id, style: {}, innerHTML: '' };
    for (var k in (extra || {})) o[k] = extra[k];
    els[id] = o; return o;
  }
  el('cbArrDone', { checked: !!opts.arr });
  el('cbPolDone', { checked: !!opts.pol });
  el('cbDepTerm', { checked: !!opts.dep });
  el('fEcotasaCobrada', { value: opts.eco === undefined ? '0' : opts.eco });
  el('mkArrDone'); el('mkPolDone'); el('mkDepTerm'); el('mkEco');

  var ctx = {
    g: function (id) { return els[id] || null; },
    MARCAS_MAX: 3800,
    MARCA_DEFS: [['arr', 'Arrival form', 'mkArrDone'], ['pol', 'Policia', 'mkPolDone'], ['dep', 'Deposito', 'mkDepTerm'], ['eco', 'Ecotasa', 'mkEco']],
    marcaPrev: opts.prev || { arr: null, pol: null, dep: null, eco: null },
    marcasTexto: opts.texto === undefined ? '' : opts.texto,
    Auth: opts.noAuth ? undefined : { name: function () { return opts.who || 'Toni Segui'; } },
    els: els
  };
  var body = [
    fnSource(file, 'marcaEsc'),
    fnSource(file, 'marcaSello'),
    fnSource(file, 'marcasNuevas'),
    fnSource(file, 'renderMarcas'),
    'function _guardar(record){' + guardarBlock(file) + '\nreturn record;}',
    'return {marcaSello:marcaSello, marcasNuevas:marcasNuevas, renderMarcas:renderMarcas, guardar:_guardar};'
  ].join('\n');
  var f = new Function('g', 'MARCAS_MAX', 'MARCA_DEFS', 'marcaPrev', 'marcasTexto', 'Auth', body);
  var api = f(ctx.g, ctx.MARCAS_MAX, ctx.MARCA_DEFS, ctx.marcaPrev, ctx.marcasTexto, ctx.Auth);
  api.els = els;
  return api;
}

var PAGES = ['notas-equipo-reservas.html', 'notas-villamanager.html'];

PAGES.forEach(function (P) {
  console.log('\n== ' + P + ' ==');

  /* 1. nada cambia -> ningun sello */
  var e = makeEnv(P, { prev: { arr: false, pol: false, dep: false, eco: false } });
  ok('abrir y guardar sin tocar nada no anade ningun sello', e.marcasNuevas().length === 0);
  var rec = e.guardar({});
  ok('  ...y el campo Marcas_manuales no viaja en el record', !('Marcas_manuales' in rec));

  /* 2. off -> on */
  e = makeEnv(P, { pol: true, prev: { arr: false, pol: false, dep: false, eco: false } });
  var m = e.marcasNuevas();
  ok('marcar policia deja exactamente un sello', m.length === 1, JSON.stringify(m));
  ok('  ...con la etiqueta Policia', m[0].indexOf('[Policia marcado ') === 0, m[0]);
  ok('  ...con el nombre del usuario de la sesion', m[0].indexOf('- Toni Segui]') > 0, m[0]);
  ok('  ...con fecha DD/MM/AAAA y hora HH:MM', /^\[Policia marcado \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} - /.test(m[0]), m[0]);

  /* 3. on -> off */
  e = makeEnv(P, { pol: false, prev: { arr: false, pol: true, dep: false, eco: false } });
  ok('desmarcar tambien deja rastro', e.marcasNuevas()[0].indexOf('[Policia desmarcado ') === 0);

  /* 4. dos casillas a la vez */
  e = makeEnv(P, { arr: true, dep: true, prev: { arr: false, pol: false, dep: false, eco: false } });
  ok('dos casillas cambiadas dejan dos sellos', e.marcasNuevas().length === 2);

  /* 5. estado previo desconocido -> no se inventa nada */
  e = makeEnv(P, { pol: true, prev: { arr: null, pol: null, dep: null, eco: null } });
  ok('si el estado previo no se cargo, no se escribe ningun sello', e.marcasNuevas().length === 0);

  /* 6. ecotasa: solo '1' cuenta como pagada */
  e = makeEnv(P, { eco: '1', prev: { arr: false, pol: false, dep: false, eco: false } });
  ok('ecotasa de pendiente a pagado deja sello', e.marcasNuevas()[0].indexOf('[Ecotasa marcado ') === 0);
  e = makeEnv(P, { eco: '', prev: { arr: false, pol: false, dep: false, eco: false } });
  ok('ecotasa vacia no cuenta como pagada', e.marcasNuevas().length === 0);

  /* 7. sin sesion -> "equipo" */
  e = makeEnv(P, { pol: true, noAuth: true, prev: { arr: false, pol: false, dep: false, eco: false } });
  ok('sin nombre de usuario el sello dice equipo', e.marcasNuevas()[0].indexOf('- equipo]') > 0);

  /* 8. el historial anterior se conserva */
  e = makeEnv(P, { pol: true, texto: '[Deposito marcado 01/09/2026 10:00 - Marta]', prev: { arr: false, pol: false, dep: false, eco: false } });
  rec = e.guardar({});
  ok('el historial anterior se conserva', rec.Marcas_manuales.indexOf('[Deposito marcado 01/09/2026 10:00 - Marta]') === 0);
  ok('  ...y el sello nuevo se anade al final', rec.Marcas_manuales.split('\n').length === 2);

  /* 9. LA PRUEBA IMPORTANTE: si no se pudo leer el valor anterior, no se escribe */
  e = makeEnv(P, { pol: true, texto: null, prev: { arr: false, pol: false, dep: false, eco: false } });
  rec = e.guardar({});
  ok('si el valor anterior NO se pudo leer, el campo no se escribe (no se borra el historial)', !('Marcas_manuales' in rec));

  /* 10. tope de longitud: corta lineas enteras, nunca por la mitad */
  var largo = [];
  for (var i = 0; i < 200; i++) largo.push('[Deposito marcado 01/09/2026 10:00 - Usuario numero ' + i + ']');
  e = makeEnv(P, { pol: true, texto: largo.join('\n'), prev: { arr: false, pol: false, dep: false, eco: false } });
  rec = e.guardar({});
  ok('el tope de 3800 caracteres se respeta', rec.Marcas_manuales.length <= 3800, String(rec.Marcas_manuales.length));
  var ls = rec.Marcas_manuales.split('\n');
  ok('  ...cortando lineas enteras, ninguna a medias', ls.every(function (l) { return l.charAt(0) === '[' && l.charAt(l.length - 1) === ']'; }));
  ok('  ...y el sello mas reciente sobrevive', ls[ls.length - 1].indexOf('[Policia marcado ') === 0);

  /* 11. renderMarcas reparte por etiqueta */
  e = makeEnv(P, { texto: '[Policia marcado 01/09/2026 10:00 - Marta]\n[Deposito marcado 02/09/2026 11:00 - Toni]' });
  e.renderMarcas();
  ok('la linea de policia se pinta bajo la casilla de policia', e.els.mkPolDone.innerHTML.indexOf('- Marta') > 0);
  ok('  ...y no bajo la de deposito', e.els.mkDepTerm.innerHTML.indexOf('- Marta') === -1);
  ok('la linea de deposito se pinta bajo la casilla de deposito', e.els.mkDepTerm.innerHTML.indexOf('- Toni') > 0);
  ok('una casilla sin sellos queda oculta', e.els.mkArrDone.style.display === 'none');
  ok('una casilla con sellos se muestra', e.els.mkPolDone.style.display === 'block');

  /* 12. renderMarcas escapa el HTML */
  e = makeEnv(P, { texto: '[Policia marcado 01/09/2026 10:00 - <img src=x onerror=alert(1)>]' });
  e.renderMarcas();
  ok('el nombre del usuario se escapa antes de entrar en el HTML', e.els.mkPolDone.innerHTML.indexOf('<img') === -1, e.els.mkPolDone.innerHTML);

  /* 13. sin historial, nada que pintar */
  e = makeEnv(P, { texto: '' });
  e.renderMarcas();
  ok('sin historial las cuatro cajas quedan ocultas',
    ['mkArrDone', 'mkPolDone', 'mkDepTerm', 'mkEco'].every(function (k) { return e.els[k].style.display === 'none'; }));
});

console.log('\n== las dos paginas (HTML) ==');
PAGES.forEach(function (P) {
  var src = fs.readFileSync(P, 'utf8');
  ['mkArrDone', 'mkPolDone', 'mkDepTerm', 'mkEco'].forEach(function (id) {
    ok(P + ' tiene la caja ' + id, src.indexOf('id="' + id + '"') > 0);
  });
  ok(P + ' lee el valor anterior de la TABLA, no de la vista',
    /action=data&table=TaBookings2021&where=/.test(src));
  ok(P + ' comprueba que el campo existe antes de usarlo',
    src.indexOf("'Marcas_manuales' in rows[0]") > 0);
});

var rSrc = fs.readFileSync('notas-equipo-reservas.html', 'utf8');
var rLine3 = rSrc.split('\n')[2];
ok('notas-equipo-reservas: marcador de version y PAGE_VERSION coinciden',
  /VERSIÓN ACTUAL: v70/.test(rLine3) && /PAGE_VERSION = 70/.test(rSrc), rLine3);
var vSrc = fs.readFileSync('notas-villamanager.html', 'utf8');
ok('notas-villamanager: marcador de version v33', /VERSIÓN ACTUAL: v33/.test(vSrc.split('\n')[2]));

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
