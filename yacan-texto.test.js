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
  var c2 = { window: {}, LANG_P0: ctx.LANG_P0, _currentLang: 'en' };
  vm.runInNewContext(fnSource(f, '_p0IsYes') + '\n' + fnSource(f, '_p0IsYacan') + '\n' +
    s.slice(s.indexOf('var _P0_YACAN_KEYS='), s.indexOf('\n', s.indexOf('var _P0_YACAN_KEYS='))) + '\n' + fnSource(f, '_p0Key') +
    '\nthis.k=_p0Key;this.y=_p0IsYacan;this.setLang=function(l){_currentLang=l;};', c2);
  ok('_p0IsYacan usa su propio matcher _p0IsYes, no el isTruthy global (tres definiciones distintas en la página)', /_p0IsYes\(/.test(fnSource(f, '_p0IsYacan')) && !/isTruthy/.test(fnSource(f, '_p0IsYacan')));
  c2.window._bookingData = { TaVillas_Yacan: true };
  ok('Yacan=true: keybox_lbl -> door_lbl', c2.k('keybox_lbl') === 'door_lbl');
  ok('Yacan=true: keybox_countdown -> door_countdown', c2.k('keybox_countdown') === 'door_countdown');
  ok('Yacan=true: otra clave no cambia', c2.k('wifi_lbl') === 'wifi_lbl');
  c2.window._bookingData = { TaVillas_Yacan: 'Yes' };
  ok('Yacan="Yes": kb_photos_lbl -> door_photos_lbl', c2.k('kb_photos_lbl') === 'door_photos_lbl');
  c2.window._bookingData = { TaVillas_Yacan: 'Yes ' }; ok('Yacan="Yes " (espacio): door', c2.k('keybox_lbl') === 'door_lbl');
  c2.window._bookingData = { TaVillas_Yacan: 'Sí' }; ok('Yacan="Sí": door', c2.k('keybox_lbl') === 'door_lbl');
  c2.window._bookingData = { TaVillas_Yacan: true };
  ok('EN Yacan: s5_name -> s5_name_door, s5_pend -> s5_pend_door', c2.k('s5_name') === 's5_name_door' && c2.k('s5_pend') === 's5_pend_door');
  c2.setLang('es'); ok('ES Yacan: s5_name se queda (sin variante en es, texto ya neutro)', c2.k('s5_name') === 's5_name' && c2.k('keybox_lbl') === 'door_lbl'); c2.setLang('en');
  ok('clave rara (constructor) no se mapea', c2.k('constructor') === 'constructor');
  ok('todas las door_lbl empiezan por 🚪', langs.every(function (l) { return /^🚪 /.test(ctx.LANG_P0[l].door_lbl); }));
  var pv = s.match(/var PAGE_VERSION = (\d+);/), hv = s.match(/VERSIÓN ACTUAL: v(\d+) \|/);
  ok('PAGE_VERSION coincide con la cabecera (si no, recarga forzada para todos)', pv && hv && pv[1] === hv[1], pv && hv ? pv[1] + ' vs ' + hv[1] : 'no encontrado');
  ok('cabecera: icono de la pestaña Keys en su propio span', /<span id="hdrTabKeysIco">🔑<\/span> <span id="hdrTabKeysLbl">Keys<\/span>/.test(s));
  ok('applyLang llama a _p0YacanHeader al final, tras applyLangTax', /applyLangTax\(lang\);\n  if\(typeof _p0YacanHeader==='function'\) _p0YacanHeader\(lang\);/.test(s));
  var hdr = fnSource(f, '_p0YacanHeader'); ok('_p0YacanHeader no toca nada si no es Yacan', /if\(!_p0IsYacan\(\)\) return;/.test(hdr));
  var tabs = s.slice(s.indexOf('var _P0_YACAN_TAB='), s.indexOf('\n', s.indexOf('var _P0_YACAN_TAB=')));
  var c3 = {}; vm.runInNewContext(tabs + ';this.T=_P0_YACAN_TAB;', c3);
  ok('etiqueta de pestaña Yacan en los 8 idiomas, sin llaves', langs.every(function (l) { return typeof c3.T[l] === 'string' && !KEYWORDS.test(c3.T[l]); }));
  c2.window._bookingData = { TaVillas_Yacan: false };
  ok('Yacan=false: keybox_lbl se queda', c2.k('keybox_lbl') === 'keybox_lbl');
  c2.window._bookingData = {};
  ok('sin campo Yacan: keybox_note se queda', c2.k('keybox_note') === 'keybox_note');
  c2.window._bookingData = null;
  ok('sin reserva cargada: no rompe y no cambia', c2.k('keybox_lbl') === 'keybox_lbl' && c2.y() === false);
  ok('applyLangP0 pasa por _p0Key', /tP0\(_p0Key\(el\.getAttribute\('data-i18n-p0'\)\)\)/.test(fnSource(f, 'applyLangP0')));
  ok('ningún tP0(\'keybox_countdown\') directo queda', !/tP0\('keybox_countdown'\)/.test(s));
  /* v94 (06/09/2026): la version ya no se fija a v93; se exige que cabecera, titulo e
     historial lleven LA MISMA version y que sea v93 o posterior (el texto Yacan entro en v93). */
  var _pv = (s.match(/VERSIÓN ACTUAL: v(\d+) \|/) || [])[1];
  ok('versión (v93 o posterior) igual en cabecera, título e historial',
     _pv && parseInt(_pv, 10) >= 93 && new RegExp('<title>Check-in Pasos v' + _pv + ' ').test(s) && new RegExp('<!-- HISTORIAL: v' + _pv + ' - ').test(s),
     'cabecera v' + _pv);
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
  ['ca', 'es', 'fr', 'de'].forEach(function (l) { ok(l + ': checkout2_yacan sin llaves', typeof ctx.T[l].checkout2_yacan === 'string' && !KEYWORDS.test(ctx.T[l].checkout2_yacan)); });
  ok('en: checkout2 ya neutro, sin variante', ctx.T.en.checkout2_yacan === undefined && !KEYWORDS.test(ctx.T.en.checkout2));
  ok('p6: checkout2 usa la variante Yacan cuando toca', /bl\(\(d\.yacan&&t\.checkout2_yacan\)\|\|t\.checkout2\)/.test(s));
  ok('p3: la nota del # va en su propia viñeta', /\+\(d\.yacan\?bl\(t\.door_note\):''\):''\)\+/.test(s));
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
  ok('ES yacan: párrafo de la puerta, sin keybox, en ustedes', /🚪 Su alojamiento tiene cerradura electrónica/.test(esY) && /pulsen #/.test(esY) && /No necesitan llaves/.test(esY) && !/keybox/i.test(esY));
  ok('ES sin yacan: párrafo del keybox de siempre', /dejen la llave en el keybox/.test(esN) && !/cerradura electrónica/.test(esN));
  ok('EN yacan: párrafo de la puerta, sin keybox', /🚪 Your accommodation has an electronic lock/.test(enY) && /press #/.test(enY) && !/keybox/i.test(enY));
  ok('EN sin yacan: párrafo del keybox de siempre', /place the key in the designated keybox/.test(enN) && !/electronic lock/.test(enN));
  ok('ES: el resto del mensaje es idéntico', esY.replace(/🚪[^\n]*/, '') === esN.replace(/🔑 Asimismo[^\n]*/, ''));
  ok('EN: el resto del mensaje es idéntico', enY.replace(/🚪[^\n]*/, '') === enN.replace(/🔑 Additionally[^\n]*/, ''));
  ok('versión v16 en cabecera, título e historial', /VERSIÓN ACTUAL: v16 \|/.test(s) && /<title>Primer Contacto v16/.test(s) && /<!-- HISTORIAL: v16 - /.test(s));
})();

console.log('\n' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
