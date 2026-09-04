/* ═══════════════════════════════════════════════════════════════════════════
   police-url.js — CONSTRUCTOR UNICO del link de registro de policia.
   VERSION ACTUAL: v1

   POR QUE EXISTE ESTE FICHERO
   Hasta ahora el link de policia se construia en SEIS sitios distintos, cada
   uno con su propia copia del codigo:
     1. checkin-pasos.html          (huesped, paso 2)
     2. notas-equipo-reservas.html  (equipo de reservas)
     3. notas-villamanager.html     (villa manager)
     4. checkin-testear-reserva.html  x2 (diagnostico + link completo)
   Las copias se fueron separando entre si. Cada arreglo se aplicaba a una sola
   copia, asi que el mismo fallo volvia a aparecer desde otra pagina. Ejemplos
   reales: el fix del telefono con caracteres invisibles se hizo en
   checkin-pasos v89 y en notas-equipo-reservas v67, pero notas-villamanager y
   checkin-testear-reserva siguen sin el; y el fix de number= se hizo dos veces
   (v78 y v87) solo en la pagina del huesped.
   A partir de v1 de este fichero, la logica vive AQUI y solo aqui. Cualquier
   arreglo futuro se hace en un unico sitio y llega a las cuatro paginas.

   COMO SE USA
     <script src="police-url.js"></script>   (antes del script de la pagina)

     var res = PoliceUrl.build(get, { code: '64958799' });
     if (res.url) enlace.href = res.url;

   'get' es una funcion que recibe el nombre del campo SIN prefijo y devuelve
   su valor. Cada pagina pasa su propio accesor, porque cada una lee de una
   vista de Caspio distinta (unas traen los campos con el prefijo
   TaBookings2021_/TaVillas_ y otras sin el).

   QUE DEVUELVE build()
     {
       url:         String   link final ('' si no se puede construir)
       external:    Boolean  true si la villa usa el formulario del complejo
       count:       Number   numero de personas enviado en number=
       countSource: String   'form' | 'hostaway' | 'unknown' | 'external'
       firstName:   String   nombre usado en el link (fiscal si existe)
       lastName:    String   apellido usado en el link
       checkIn:     String   fecha de entrada en YYYYMMDD
       checkOut:    String   fecha de salida en YYYYMMDD
       warnings:    Array    codigos de aviso para que el equipo los vea
     }

   CODIGOS DE AVISO (warnings)
     'count-unknown'    ni el Arrival Form ni Hostaway dan un numero de personas
     'no-organization'  la villa no tiene Link_Registrodepolicia
     'external-complex' la villa registra en el formulario propio del complejo
     'external-link-invalid'  el link propio guardado no es una direccion web
                        valida y se ha descartado
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var VERSION  = 1;
  var CUSTOMER = 'ee6f5c47d6bd4c7e9a4b75a457e58a96';
  var BASE     = 'https://policheckin01.azurewebsites.net/api/v5/customer/' + CUSTOMER;

  /* Organizacion por defecto heredada de checkin-pasos.html. Se conserva para
     no cambiar el comportamiento actual, pero se avisa siempre que se usa:
     registra al huesped bajo una organizacion que NO es la de su villa. */
  var ORG_FALLBACK = '20e22b77-0763-803a-3832-5e268a466527';

  /* ── Utilidades ─────────────────────────────────────────────────────────── */

  /* ISNULL(x,0) a prueba del 0 falsy: un 0 real cuenta como 0, no como vacio. */
  function num(v) {
    if (v === undefined || v === null || String(v).trim() === '') return 0;
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  /* Fecha -> YYYYMMDD, SIEMPRE ocho digitos o cadena vacia. Acepta
     'YYYY-MM-DD', ISO completo y Date.
     El resultado se concatena en la URL, asi que nunca puede contener otra
     cosa que digitos: un valor como '2026-09-05&number=1#' en el campo de
     fecha anadiria un parametro propio y cortaria el resto de la URL (el
     nombre y el telefono del huesped no llegarian a la policia). La revision
     de seguridad del 04/09/2026 lo demostro. Por eso cada salida pasa por
     ocho() antes de devolverse. */
  function ocho(x) { return /^\d{8}$/.test(x) ? x : ''; }
  function ymd(v) {
    if (!v) return '';
    var s = String(v).replace(/[T ].*/, '');
    var p = s.split('-');
    if (p.length === 3) {
      var out = ocho(p[0] + String(p[1]).padStart(2, '0') + String(p[2]).padStart(2, '0'));
      if (out) return out;
    }
    var d = new Date(v);
    if (isNaN(d)) return '';
    return ocho(d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0'));
  }

  /* Un link guardado en la base de datos solo se acepta como direccion web.
     Se rechazan los esquemas que ejecutan codigo en el navegador del huesped
     (javascript:, data:, vbscript:). Un valor sin esquema se deja pasar: se
     resuelve contra la propia intranet y no puede ejecutar nada. */
  function linkSeguro(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    var limpio = s.replace(/[\s\u0000-\u001f\u00a0\u200b-\u200f\u2028\u2029]/g, '').toLowerCase();
    if (/^(javascript|data|vbscript|file|blob):/.test(limpio)) return '';
    return s;
  }

  function todayYMD() {
    var d = new Date();
    return d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
  }

  /* Telefono para la URL. Se prefiere el Segundo_Telefono si existe.
     Se quita TODO lo que no sea digito o '+' — incluidas las marcas Unicode
     invisibles de direccion de texto (LRE U+202A / PDF U+202C) que vienen
     pegadas al numero cuando se copia desde WhatsApp o iOS y que rompian el
     parametro &phone=. Despues '+' pasa a '00' (formato de la API), asi que el
     prefijo internacional NUNCA se pierde. */
  function phone(get) {
    var p2 = String(get('Segundo_Telefono') || '').trim();
    var p  = p2 ? p2 : String(get('Guest_phonenumber') || '');
    return p.replace(/[^\d+]/g, '').replace(/\+/g, '00');
  }

  /* Nombre y apellido: los datos fiscales mandan sobre los de la reserva. */
  function names(get) {
    var fisc = String(get('Fiscal_guest_name') || '').trim();
    var useFisc = !!(fisc && fisc !== ' ');
    return {
      first: useFisc ? fisc
                     : String(get('Guest_Full_Name') || get('Guest_Name') || ''),
      last:  useFisc ? String(get('Fiscal_guest_surename') || '')
                     : String(get('Guest_Surename') || '')
    };
  }

  /* ── Numero de personas (el parametro que causaba el fallo) ──────────────
     REGLA, en este orden:
       1. Arrival Form: Guest_adults_nr_form + Guest_children_nr_form,
          SOLO si los adultos resuelven a 1 o mas. Un 0 en adultos no es un
          dato real (ninguna reserva tiene 0 adultos): viene de un Arrival Form
          antiguo, anterior a la validacion adultsOk>=1, o de una correccion
          manual erronea. Los ninos a 0 SI son un valor real y se respetan.
       2. Hostaway: Adults + Children, si suman 1 o mas.
       3. Nada de lo anterior -> DESCONOCIDO.

     QUE PASA CUANDO ES DESCONOCIDO. Antes, la pagina del huesped enviaba
     number=1 ("suelo de seguridad: siempre hay al menos el titular"). Ese 1 no
     era un dato, era una suposicion, y el formulario de policia la trata como
     el numero definitivo de personas: el huesped mete al titular, el formulario
     se marca 100% completado con el tick verde y ya no deja anadir a nadie mas.
     Es el fallo que reporta el equipo (clase 1 del analisis del grupo de
     soporte: 07-13, 07-26, 08-04, 08-05, 08-16 y de nuevo 2026-09-04).
     La pagina del equipo de reservas, con la MISMA reserva, enviaba number=0 y
     ahi el formulario si deja seguir anadiendo huespedes — por eso el equipo
     usa el link largo como solucion provisional.
     AHORA: cuando no se sabe, no se inventa. Se envia number=0, igual que el
     link del equipo que si funciona, y se devuelve el aviso 'count-unknown'
     para que la pagina del equipo lo muestre y alguien corrija la reserva. */
  function guestCount(get) {
    var ad = get('Guest_adults_nr_form');
    if (num(ad) >= 1) {
      return { count: num(ad) + num(get('Guest_children_nr_form')), source: 'form' };
    }
    var host = num(get('Adults')) + num(get('Children'));
    if (host >= 1) return { count: host, source: 'hostaway' };
    return { count: 0, source: 'unknown' };
  }

  /* ── Constructor ────────────────────────────────────────────────────────── */
  /* opts:
       code         String  codigo de reserva (obligatorio)
       contractDate 'today' | 'created'  (por defecto 'today')
                    Las paginas no coinciden en esto: checkin-pasos envia la
                    fecha de HOY y notas-equipo-reservas la fecha de creacion de
                    la reserva. Se conserva el valor de cada pagina hasta saber
                    cual espera la API; no se cambia a ciegas.
       allowFallbackOrg  Boolean (por defecto true) usar ORG_FALLBACK si la
                    villa no tiene Link_Registrodepolicia.
       ignoreExternal  Boolean (por defecto false) construir el link de
                    policheckin aunque la villa tenga formulario propio del
                    complejo. Lo usan las paginas del equipo, que siguen
                    mostrando el link de siempre pero con el aviso al lado. */
  function build(get, opts) {
    opts = opts || {};
    var warnings = [];

    /* Villa con formulario de policia propio (complejo externo, p.ej. Castell
       Sol): se usa su link tal cual. NO se le anaden los parametros de
       policheckin01 — es otro sistema y esos parametros no significan nada
       ahi. La confirmacion llega por email y el equipo marca el paso a mano
       (clase 9 del analisis de soporte). */
    var nm = names(get);
    var lintCrudo = String(get('Lint_Policia_castellsol') || '').trim();
    var lint = linkSeguro(lintCrudo);
    if (lintCrudo && !lint) warnings.push('external-link-invalid');
    if (lint && opts.ignoreExternal) {
      /* Paginas del equipo: se sigue mostrando el link de policheckin como
         hasta ahora (no se quita nada), pero se avisa de que esta villa
         registra en el formulario propio del complejo. */
      warnings.push('external-complex');
    } else if (lint) {
      return {
        url: lint, external: true, externalUrl: lint, count: null, countSource: 'external',
        firstName: nm.first, lastName: nm.last,
        checkIn: ymd(get('Checkin')), checkOut: ymd(get('Checkout')),
        warnings: ['external-complex']
      };
    }

    var code = String(opts.code || '');
    var org  = String(get('Link_Registrodepolicia') || '').trim();
    if (!org) {
      warnings.push('no-organization');
      if (opts.allowFallbackOrg === false) {
        return { url: '', external: false, count: null, countSource: 'unknown',
                 firstName: nm.first, lastName: nm.last,
                 checkIn: ymd(get('Checkin')), checkOut: ymd(get('Checkout')),
                 warnings: warnings };
      }
      org = ORG_FALLBACK;
    }

    var gc = guestCount(get);
    if (gc.source === 'unknown') warnings.push('count-unknown');

    var contract = (opts.contractDate === 'created')
      ? ymd(get('Cretated_At') || get('Created_At') || '')
      : todayYMD();

    var url = BASE +
      '/organization/' + encodeURIComponent(org) +
      '/reservation/'  + encodeURIComponent(code) +
      '?checkInDate='  + encodeURIComponent(ymd(get('Checkin'))) +
      '&checkOutDate=' + encodeURIComponent(ymd(get('Checkout'))) +
      '&contractDate=' + encodeURIComponent(contract) +
      '&number='       + gc.count +
      '&firstName='    + encodeURIComponent(nm.first) +
      '&lastName1='    + encodeURIComponent(nm.last) +
      '&phone='        + encodeURIComponent(phone(get));

    return {
      url: url, external: !!lint, externalUrl: lint || null,
      count: gc.count, countSource: gc.source,
      firstName: nm.first, lastName: nm.last,
      checkIn: ymd(get('Checkin')), checkOut: ymd(get('Checkout')),
      warnings: warnings
    };
  }

  /* Texto de aviso para las paginas del equipo (ES). El huesped no ve nada. */
  var WARNING_TEXT = {
    'count-unknown':
      'Esta reserva no tiene numero de personas ni en el Arrival Form ni en ' +
      'Hostaway. El link se envia con number=0. Corrige Adultos/Ninos en la ' +
      'reserva para que el formulario de policia sepa cuantos huespedes espera.',
    'no-organization':
      'Esta villa no tiene Link_Registrodepolicia. El link usa la organizacion ' +
      'por defecto, que puede no ser la de esta villa. Revisa la ficha de la villa.',
    'external-link-invalid':
      'Esta villa tiene un link de registro propio guardado, pero no es una ' +
      'direccion web valida y se ha descartado por seguridad. Revisa el campo ' +
      'Lint_Policia_castellsol en la ficha de la villa.',
    'external-complex':
      'Esta villa registra en el formulario propio del complejo. La confirmacion ' +
      'llega por email y el paso se marca a mano. No uses el link de policheckin.'
  };

  global.PoliceUrl = {
    VERSION: VERSION,
    build: build,
    warningText: function (code) { return WARNING_TEXT[code] || code; },
    /* expuesto solo para las pruebas */
    _internals: { num: num, ymd: ymd, phone: phone, names: names, guestCount: guestCount }
  };
})(typeof window !== 'undefined' ? window : this);

if (typeof module !== 'undefined' && module.exports) module.exports = this.PoliceUrl || global.PoliceUrl;
