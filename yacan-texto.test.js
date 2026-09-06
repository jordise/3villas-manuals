/* Pruebas del texto "código de la puerta" para cerraduras Yacan (petición de Sanaa vía Jordi, 02/09/2026).
   node yacan-texto.test.js

   Como marcas-manuales.test.js: NO copia el código de las páginas. Extrae el texto real
   de cada función o bloque del HTML y lo ejecuta. Si alguien edita una página, estas
   pruebas corren el código NUEVO. Nunca imprime códigos de puerta ni de keybox. */
var fs = require('fs'), vm = require('vm');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); } }
function src(f) { return fs.readFileSync(f, 'utf8'); }
function fnSource(file, name) {
  var s = src(file), i = s.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('no encuentro ' + name + ' en ' + file);
  var j = s.indexOf('{', i), depth = 0, k = j;
  for (; k < s.length; k++) { if (s[k] === '{') depth++; else if (s[k] === '}') { depth--; if (depth === 0) { k++; break; } } }
  return s.slice(i, k);
}
/* Todos los <script> inline de una página deben compilar (detecta comas o comillas rotas). */
function scriptsCompile(file) {
  var s = src(file), re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi, m, n = 0;
  while ((m = re.exec(s))) { n++; new vm.Script(m[1], { filename: file + '#script' + n }); }
  return n;
}
var KEYWORDS = /keybox|llave|\bkey\b|clé|schlüssel|chiav|sleutel|chave|\bclau/i;

console.log('checkin-pasos.html');
(function () {
  var f = 'checkin-pasos.html', s = src(f);
  ok('los scripts inline compilan', (function () { try { return scriptsCompile(f) > 0; } catch (e) { return e.message; } })() === true);
  var langs = ['en', 'es', 'fr', 'de', 'it', 'nl', 'pt', 'ca'];
  var a = s.indexOf('var LANG_P0 = {};'), b = s.indexOf('function tP0(');
  var block = s.slice(a, b);
  var ctx = { LANG_P0: {} };
  vm.runInNewContext(block, ctx);
  langs.forEach(function (l) {
    var L = ctx.LANG_P0[l] || {};
    var keys = ['door_lbl', 'door_note', 'door_countdown', 'door_photos_lbl'];
    ok(l + ': cuatro claves door_*', keys.every(function (k) { return typeof L[k] === 'string' && L[k].length > 3; }));
    ok(l + ': ninguna clave door_* habla de llaves ni keybox', keys.every(function (k) { return !KEYWORDS.test(L[k] || ''); }),
      keys.filter(function (k) { return KEYWORDS.test(L[k] || ''); }).join(','));
    ok(l + ': door_note lleva #', /#/.test(L.door_note || ''));
    ok(l + ': door_countdown lleva {date} y {time}', /\{date\}/.test(L.door_countdown || '') && /\{time\}/.test(L.door_countdown || ''));
    ok(l + ': las claves keybox_* siguen ahí', ['keybox_lbl', 'keybox_note', 'keybox_countdown', 'kb_photos_lbl'].every(function (k) { return typeof L[k] === 'string'; }));
  });
  /* _p0Key con el isTruthy real de la página */
  var c2 = { window: {} };
  vm.runInNewContext(fnSource(f, 'isTruthy') + '\n' + fnSource(f, '_p0IsYacan') + '\n' +
    s.slice(s.indexOf('var _P0_YACAN_KEYS='), s.indexOf('\n', s.indexOf('var _P0_YACAN_KEYS='))) + '\n' + fnSource(f, '_p0Key') +
    '\nthis.k=_p0Key;this.y=_p0IsYacan;', c2);
  c2.window._bookingData = { TaVillas_Yacan: true };
  ok('Yacan=true: keybox_lbl -> door_lbl', c2.k('keybox_lbl') === 'door_lbl');
  ok('Yacan=true: keybox_countdown -> door_countdown', c2.k('keybox_countdown') === 'door_countdown');
  ok('Yacan=true: otra clave no cambia', c2.k('s5_pend') === 's5_pend');
  c2.window._bookingData = { TaVillas_Yacan: 'Yes' };
  ok('Yacan="Yes": kb_photos_lbl -> door_photos_lbl', c2.k('kb_photos_lbl') === 'door_photos_lbl');
  c2.window._bookingData = { TaVillas_Yacan: false };
  ok('Yacan=false: keybox_lbl se queda', c2.k('keybox_lbl') === 'keybox_lbl');
  c2.window._bookingData = {};
  ok('sin campo Yacan: keybox_note se queda', c2.k('keybox_note') === 'keybox_note');
  c2.window._bookingData = null;
  ok('sin reserva cargada: no rompe y no cambia', c2.k('keybox_lbl') === 'keybox_lbl' && c2.y() === false);
  ok('applyLangP0 pasa por _p0Key', /tP0\(_p0Key\(el\.getAttribute\('data-i18n-p0'\)\)\)/.test(fnSource(f, 'applyLangP0')));
  ok('ningún tP0(\'keybox_countdown\') directo queda', !/tP0\('keybox_countdown'\)/.test(s));
  ok('versión v93 en cabecera, título e historial', /VERSIÓN ACTUAL: v93 \|/.test(s) && /<title>Check-in Pasos v93/.test(s) && /<!-- HISTORIAL: v93 - /.test(s));
})();

console.log('generar.html');
(function () {
  var f = 'generar.html', s = src(f);
  ok('los scripts inline compilan', (function () { try { return scriptsCompile(f) > 0; } catch (e) { return e.message; } })() === true);
  var a = s.indexOf('const T={'), b = s.indexOf('};', a) + 2;
  var ctx = {}; vm.runInNewContext(s.slice(a, b) + ';this.T=T;', ctx);
  ['ca', 'es', 'en', 'fr', 'de'].forEach(function (l) {
    var L = ctx.T[l] || {};
    ok(l + ': door_code y door_note', typeof L.door_code === 'string' && typeof L.door_note === 'string' && /#/.test(L.door_note));
    ok(l + ': door_* sin llaves ni keybox', !KEYWORDS.test(L.door_code) && !KEYWORDS.test(L.door_note));
    ok(l + ': keybox_code sigue ahí', typeof L.keybox_code === 'string');
  });
  var mr = {}; vm.runInNewContext(fnSource(f, '_isYes') + '\n' + fnSource(f, 'mapRecord') + '\nthis.m=mapRecord;', mr);
  ok('mapRecord: Yacan=true -> yacan true', mr.m({ Yacan: true }).yacan === true);
  ok('mapRecord: Yacan=false -> yacan false', mr.m({ Yacan: false }).yacan === false);
  ok('mapRecord: sin Yacan -> yacan false', mr.m({}).yacan === false);
  ok('p3: etiqueta según yacan', /\(d\.yacan\?t\.door_code:t\.keybox_code\)\+':<\/strong> <strong>'\+d\.keybox/.test(s));
  ok('p6: la línea "dejen la llave" solo sin yacan', /\(d\.keybox&&!d\.yacan\?bl\(lang==='ca'\?'Deixau la clau al keybox/.test(s));
  ok('versión v3 en cabecera e historial', /VERSIÓN ACTUAL: v3 \|/.test(s) && /<!-- HISTORIAL: v3 - /.test(s));
})();

console.log('entradas-primer-contacto-whatsapp.html');
(function () {
  var f = 'entradas-primer-contacto-whatsapp.html', s = src(f);
  ok('los scripts inline compilan', (function () { try { return scriptsCompile(f) > 0; } catch (e) { return e.message; } })() === true);
  ok('F.yacan apunta a TaVillas_Yacan', /yacan:\s*'TaVillas_Yacan'/.test(s));
  ok('rowToModalData devuelve yacan', /var yacan=_isYes\(r\[F\.yacan\]\);/.test(fnSource(f, 'rowToModalData')) && /mgrN:mgrN,yacan:yacan\}/.test(fnSource(f, 'rowToModalData')));
  var ctx = { isEs: function (ph) { return ph === 'ES'; } };
  vm.runInNewContext(fnSource(f, 'buildMsg') + '\nthis.b=buildMsg;', ctx);
  var base = { name: 'X', ciTime: '16:00', code: '0' };
  var esY = ctx.b(Object.assign({}, base, { phHost: 'ES', yacan: true }), 'M', false);
  var esN = ctx.b(Object.assign({}, base, { phHost: 'ES', yacan: false }), 'M', false);
  var enY = ctx.b(Object.assign({}, base, { phHost: 'EN', yacan: true }), 'M', false);
  var enN = ctx.b(Object.assign({}, base, { phHost: 'EN', yacan: false }), 'M', false);
  ok('ES yacan: párrafo de la puerta, sin keybox', /cerradura electrónica/.test(esY) && /pulse #/.test(esY) && !/keybox/i.test(esY));
  ok('ES sin yacan: párrafo del keybox de siempre', /dejen la llave en el keybox/.test(esN) && !/cerradura electrónica/.test(esN));
  ok('EN yacan: párrafo de la puerta, sin keybox', /electronic lock/.test(enY) && /press #/.test(enY) && !/keybox/i.test(enY));
  ok('EN sin yacan: párrafo del keybox de siempre', /place the key in the designated keybox/.test(enN) && !/electronic lock/.test(enN));
  ok('ES: el resto del mensaje es idéntico', esY.replace(/🔢[^\n]*/, '') === esN.replace(/🔑 Asimismo[^\n]*/, ''));
  ok('EN: el resto del mensaje es idéntico', enY.replace(/🔢[^\n]*/, '') === enN.replace(/🔑 Additionally[^\n]*/, ''));
  ok('versión v16 en cabecera, título e historial', /VERSIÓN ACTUAL: v16 \|/.test(s) && /<title>Primer Contacto v16/.test(s) && /<!-- HISTORIAL: v16 - /.test(s));
})();

console.log('\n' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
