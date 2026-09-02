// ================================================================
//  mia-intranet.js — Mia en la cabecera de la intranet 3Villas
//
//  Qué hace: añade una fila con un campo de pregunta debajo de la
//  cabecera, y un botón Aa (texto más legible, opcional). La pregunta
//  va al Worker mia-intranet-search, que devuelve SOLO un JSON de
//  filtros. Todos los datos los pide el navegador a caspio-proxy con
//  el token del propio usuario, igual que cualquier otra página.
//
//  Mia solo lee. No escribe, no envía, no borra.
//
//  Reglas de este fichero:
//   · Add-only: no cambia ni una regla CSS de las páginas existentes y no
//     toca el style de ningún elemento suyo. La fila no es sticky: es un
//     bloque normal debajo de la cabecera, sin z-index, que se va con el
//     scroll. Las barras de filtros de las páginas se quedan donde estaban,
//     y al quitar la fila la página es exactamente la de antes.
//   · Toda clase de Mia lleva el prefijo mia- o vive dentro de
//     .mia-row/.mia-panel: villa.html tiene un .h-btn global.
//   · Nunca se pinta ni se registra un secreto: todo campo de caja de llaves,
//     contraseña, wifi, alarma, notas del keyholder, caja fuerte, tarjeta,
//     token o documento de identidad se borra de cada fila nada más recibir
//     la respuesta. El id del keyholder sí pasa: es una persona, no un código.
//   · Todo valor que venga del Worker o de Caspio entra en el DOM por
//     textContent o por escapeHtml(). Nunca por innerHTML sin escapar.
//   · Un chip nunca dice un filtro que no haya llegado a la URL: los
//     chips se construyen con los parámetros realmente emitidos y el
//     resto va a "No pude aplicar".
//   · Si no hay sesión, si el rol no está permitido o si el Worker
//     falla, la fila no aparece y la página queda exactamente igual.
//
//  Se carga con una sola línea al final de nav-component.js.
//  Quitar esa línea desactiva Mia en toda la intranet.
// ================================================================

(function () {
'use strict';

if (window.__MIA_LOADED) return;
window.__MIA_LOADED = true;

/* ════════════════ CONFIGURACIÓN ════════════════ */
const MIA_WORKER_URL='https://mia-intranet-search.gerard-0d3.workers.dev';
const MIA_ALLOWED_ROLES=['admin','manager','staff','sales'];
/* Quién ve las líneas de pago. Copia exacta de auth.js:121
   'cobros-inquilinos': ['admin','manager'] — la página donde se ven los cobros.
   Si cambia allí, cambia aquí. Quien no está en la lista recibe la ficha sin
   pagos y sin ninguna mención a los pagos. */
const MIA_PAY_ROLES=['admin','manager'];
const MIA_DEBUG = false;               // true solo para depurar en local

const PROXY          = 'https://caspio-proxy.jordi-89b.workers.dev';
const VIEW_BOOKINGS  = 'Vi_villas_and_bookings2021';
const VIEW_PAYMENTS  = 'Vi_bookingsall_and_paymen_editb';
/* 22 s: tiene que ser mayor que el peor caso del Worker (5 s de comprobación
   de sesión + 15 s de modelo). Si no, el navegador se rinde con la respuesta
   ya de camino. */
const TIMEOUT_MS     = 22000;
const MAX_ROWS       = 5;              // filas por lista (igual que el límite de la consulta)
const K_EASY         = '3v_easy';      // localStorage: texto más legible
const K_OFF          = '3v_mia_off';   // sessionStorage: Mia apagada esta sesión

/* Mapa de campos de la vista de reservas — copiado de entradas-equipo v141 */
const F = {
  reservationId:'TaBookings2021_BookingID', confirmCode:'TaBookings2021_FS_confirmation_code',
  villaName:'TaVillas_Name_villa_para_inquilinos', villaId:'TaVillas_villaid',
  nights:'TaBookings2021_Nights', checkIn:'TaBookings2021_Checkin', checkOut:'TaBookings2021_Checkout',
  adults:'TaBookings2021_Adults', children:'TaBookings2021_Children',
  status:'TaBookings2021_BookingStatus', statusNameFormula:'TaBookings2021_Status_name_formula',
  guestName:'TaBookings2021_Guest_Full_Name', guestEmail:'TaBookings2021_Guest_email',
  secondEmail:'TaBookings2021_Segundo_email',
  guestPhone:'TaBookings2021_Guest_phonenumber', phoneArrival:'TaBookings2021_Segundo_Telefono',
  fiscalName:'TaBookings2021_Fiscal_guest_name', fiscalSurname:'TaBookings2021_Fiscal_guest_surename',
  portalName:'TaBookings2021_Portal_Name', villaManager:'TaVillas_KeyHolder_person',
  cleaner:'TaVillas_Cleanning_team',
  limpieza:'TaBookings2021_LimpiezaTerminada', wellcomePack:'TaBookings2021_Welcomepackentregado',
  cierre:'TaBookings2021_Checkoutcontrolado', checkinPend:'TaBookings2021_checkinonline_todo_terminado',
  ecotasaCobrada:'TaBookings2021_Paso4_terminado', policeDone:'TaBookings2021_Registro_policia_done',
  depositDone:'TaBookings2021_Security_deposit_terminado'
};
const U = { id:'UserID', name:'Name' };

/* Vista de pagos — conceptos por línea */
const PAY = {
  code  :'Ta_payments_HS_confirmation_code',
  amount:'Ta_payments_Importe',
  date  :'Ta_payments_Transactiaon_date',
  status:'Ta_payments_Status'
};
const PAY_CONCEPTS = [
  ['Ta_payments_Pago_ecotasa','Ecotasa'],
  ['Ta_payments_Pago_Linea1','Extra 1'],
  ['Ta_payments_Pago_Linea2','Extra 2'],
  ['Ta_payments_Pago_Linea3','Extra 3'],
  ['Ta_payments_Pago_deposito_seguridad','Depósito'],
  ['Ta_payments_Pago_deposit_waiver','Waiver']
];

/* Páginas a las que Mia puede enlazar. Lista blanca: nada más. */
const PAGES = {
  entradas :'entradas-equipo.html',
  tareas   :'tareas.html',
  ocupacion:'listado-ocupacion.html',
  villa    :'villa.html',
  notas    :'notas-equipo-reservas.html'
};

/* tareas.html restoreFiltersFromURL() lee est(1583) u(1585) fd/fh(1591)
   vi(1594) tt(1606) bt(1607) urg(1609) imp(1613).
   bt = "Tipo reserva" del <select id="fBookingType">: 10 limpieza,
   20 welcomepack, 30 cierre. tt es el id de un tipo de tarea del catálogo,
   que Mia no conoce: no se emite nunca. */
const TASK_EST = { pendiente:'pend', terminada:'done' };
/* welcomepack NO está: bt=20 no filtra las tareas de welcome pack como la
   gente espera, así que Mia no lo emite y lo dice en "No pude aplicar". El
   resto de la pregunta (estado, usuario, fechas, villa) sí se aplica. */
const TASK_BT  = { limpieza:'10', cierre:'30' };

/* Textos (producción en español) */
const T = {
  ph        :'Pregunta a Mia: reserva, villa, fechas…',
  go        :'Preguntar',
  aa        :'Texto más legible',
  asked     :'Has preguntado:',
  onlyRead  :'Mia solo lee. No cambia datos ni envía mensajes.',
  usedHere  :'Mia ha usado los filtros de esta página. Quita un chip para ampliar.',
  filters   :'Filtros',
  openEnt   :'Abrir en Entradas',
  openTar   :'Abrir en Tareas',
  openNotes :'Abrir notas',
  notes     :'Notas',
  openVilla :'Ver villa',
  openOcu   :'Abrir Ocupación',
  noApply   :'No pude aplicar:',   /* la lista se cierra con un punto */
  down      :'Mia no está disponible ahora. Los filtros de siempre funcionan igual.',
  expired   :'Tu sesión ha caducado. Vuelve a entrar.',
  busyWait  :'Mia está ocupada. Espera un momento y vuelve a preguntar.',
  busy      :'Mia está ocupada. Prueba otra vez en un momento.',
  badQ      :'No he entendido la pregunta.',
  noBooking :'No encuentro esa reserva.',
  noVilla   :'No encuentro esa villa.',
  many      :'He encontrado varias reservas. Elige una:',
  more      :'Hay más resultados. Ábrelos todos en Entradas.',
  noMgrLink :'El enlace de Entradas no filtra por manager: ese filtro solo lo aplico yo aquí.',
  unknown   :'No he entendido. Prueba con un nombre, un código de reserva, una villa o unas fechas.',
  ocuNote   :'Ocupación no admite filtros por enlace todavía. Abre la página y pon:',
  loading   :'Un momento…',
  close     :'Cerrar',
  panelLabel:'Respuesta de Mia',
  payScroll :'Arrastra la tabla para ver el resto.',
  rmFilter  :'Quitar filtro',
  guest     :'Inquilino', dates:'Fechas', vm:'Villa Manager', state:'Estado',
  payments  :'Pagos', concept:'Concepto', date:'Fecha', amount:'Importe', total:'Total',
  nights    :'noches'
};

/* Marca de Mia (SVG en línea; no se usa <use> por el <base href> de varias páginas) */
const MARK = '<svg class="mia-mk" viewBox="0 0 100 100" aria-hidden="true" focusable="false">'
  + '<circle cx="50" cy="50" r="50" fill="#C8102E"/>'
  + '<svg x="22" y="34" width="56" height="32.6" viewBox="15.05 9.4 44.7 26">'
  + '<g transform="rotate(-90 37.4 22.35)">'
  + '<path d="M49.5978 26.9164C49.0454 25.6442 48.2754 24.506 47.3045 23.5518C46.3504 22.6145 45.1954 21.8445 43.8898 21.2586C43.7726 21.2084 43.6387 21.1582 43.5215 21.1079C47.1037 19.0156 48.9617 15.5841 48.9617 11.031C48.9617 9.40735 48.6436 7.90083 48.041 6.54497C47.4217 5.18911 46.5345 4.00063 45.413 3.02977C44.3082 2.07564 42.9691 1.32238 41.4291 0.786735C39.9226 0.267825 38.2152 0 36.3739 0C32.5742 0 29.4942 0.753257 26.7155 2.42716L24.4222 3.69933V11.868L27.9374 9.20648C30.2307 7.44888 32.6244 6.57845 35.2189 6.57845C39.6046 6.57845 41.563 8.30257 41.563 12.186C41.563 14.8308 40.6591 18.346 32.842 18.346H28.3224V24.9244H33.0261C42.015 24.9244 43.0528 28.7242 43.0528 31.5698C43.0528 32.5742 42.8687 33.4948 42.5004 34.2816C42.1322 35.0683 41.63 35.7211 40.9604 36.2903C40.2741 36.8594 39.4372 37.2946 38.4496 37.6126C37.4452 37.9307 36.2735 38.0981 35.0013 38.0981C31.7372 38.0981 28.925 37.1272 26.3974 35.152L24.439 33.5283V42.015L24.8742 42.2996C27.3683 43.9065 30.7161 44.7267 34.8339 44.7267C37.077 44.7267 39.1861 44.4087 41.0609 43.7726C42.9691 43.1365 44.643 42.2159 46.0156 41.0441C47.4217 39.8557 48.5097 38.3994 49.2797 36.7255C50.0497 35.0516 50.4347 33.1768 50.4347 31.1681C50.4347 29.6281 50.1502 28.2053 49.5978 26.9164Z" fill="#fff"/>'
  + '</g></svg></svg>';

/* ════════════════ UTILIDADES ════════════════ */
function dbg(){ if(MIA_DEBUG && typeof console!=='undefined') console.log.apply(console,['[Mia]'].concat([].slice.call(arguments))); }

function escapeHtml(v){
  return String(v==null?'':v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
/* Crea un elemento. El texto entra SIEMPRE por textContent. */
function E(tag,cls,txt){
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(txt!=null)e.textContent=String(txt);
  return e;
}
/* Escape para valores dentro de un WHERE de Caspio.
   El corte a 80 va ANTES de doblar las comillas: si no, un valor cuyo
   carácter 80 sea una comilla llegaría a medio escapar. */
function sq(v){
  return String(v==null?'':v).replace(/[\x00-\x1f\x7f]/g,'').slice(0,80).replace(/'/g,"''");
}
/* Valores que van dentro de un LIKE: fuera los comodines de verdad. Se quitan
   % y [ porque ensanchan la búsqueda sin límite. El _ se queda: es un comodín
   de UN carácter, así que un guion bajo literal sigue encontrándose a sí mismo,
   y quitarlo rompía los correos (ana_maria@gmail.com pasaba a anamaria...). */
function sqLike(v){
  return sq(String(v==null?'':v).replace(/[%\[]/g,''));
}
/* Sin acentos y en minúsculas, para comparar nombres */
function fold(v){
  let s=String(v==null?'':v);
  try{ s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }catch(e){}
  return s.toLowerCase().trim();
}
function isDate(v){ return typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
/* Id numérico: villaid, ContactID. NO es un id de usuario. */
function isId(v){ return /^\d{1,12}$/.test(String(v==null?'':v).trim()); }
/* Id de usuario de Caspio: ocho caracteres, letras mayúsculas y cifras, con al
   menos una de cada (V25EJV4G, 30QKOKC6, 1U8GA927). Es el UserID de TaUsers, el
   UserID_asigned_alfanum de TaTasks y el KeyHolder_person de TaVillas: en el
   volcado del 2026-09-01 los 382 KeyHolder_person y los 75.283 alfanum tienen
   esta forma y ninguno es numérico. Los ids numéricos son de otra tabla
   (Cleanning_team y ContactID son ContactID), así que no valen aquí. */
function isUserId(v){
  const s=String(v==null?'':v).trim();
  return /^[A-Za-z0-9]{8}$/.test(s) && /[0-9]/.test(s) && /[A-Za-z]/.test(s);
}
function isPhone(v){ return /^[\d\s+().-]{6,}$/.test(String(v==null?'':v).trim()); }
function todayISO(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function addDays(iso,n){
  if(!isDate(iso))return '';
  const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dOnly(v){ return String(v==null?'':v).split('T')[0]; }
function fmtDate(v){
  const s=dOnly(v); if(!isDate(s))return s||'—';
  const d=new Date(s+'T00:00:00');
  return isNaN(d)?s:d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtShort(v){
  const s=dOnly(v); if(!isDate(s))return s||'—';
  return s.slice(8,10)+'/'+s.slice(5,7);
}
function fmtEUR(v){
  const n=parseFloat(v);
  return isNaN(n)?'—':n.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
}
/* Igual criterio que entradas-equipo: null = sin dato */
function isOk(val){
  if(val===null||val===undefined)return null;
  if(typeof val==='boolean')return val;
  if(typeof val==='number'){ if(val===0)return false; if(val===-1)return true; return val>0; }
  const s=String(val).trim().toLowerCase();
  if(!s)return null;
  return ['0','x','no','false','pendiente','n/a','na','null','none','–','-'].indexOf(s)<0;
}
function g(r,key){ const v=r[F[key]]; return (v===undefined||v===null)?'':v; }
/* Todo lo que viene del Worker se busca así: sin esto, type:"constructor" o
   "__proto__" devolvían una función del prototipo y se colaban en la URL. */
function own(map,key){
  const k=String(key==null?'':key);
  return Object.prototype.hasOwnProperty.call(map,k)?map[k]:undefined;
}

/* Enlaces: solo páginas de la lista blanca y parámetros codificados */
/* Marca para "este parámetro va en la URL, pero vacío". Las páginas miran
   p.has(clave), no su valor: tareas.html borra el usuario preseleccionado con
   u= vacío, y entradas-equipo deja de aplicar su ventana de fechas guardada
   con desde= y hasta= vacíos. Sin la marca, un valor vacío se caía de la URL
   y la página volvía a poner su preferencia encima de lo que pidió Mia. */
const EMPTY=typeof Symbol==='function'?Symbol('mia-vacio'):{mia:'vacio'};
function link(page,params){
  const base=own(PAGES,page); if(!base)return null;
  const qs=Object.keys(params||{})
    .filter(function(k){ const v=params[k]; return v===EMPTY||(v!==''&&v!=null); })
    .map(function(k){
      const v=params[k];
      return encodeURIComponent(k)+'='+(v===EMPTY?'':encodeURIComponent(v));
    })
    .join('&');
  return qs?base+'?'+qs:base;
}
function curPage(){ return location.pathname.split('/').pop(); }

/* ════════════════ SESIÓN ════════════════ */
/* El rol llega con mayúsculas y espacios en algunas páginas */
function myRole(){
  try{ return Auth&&Auth.role?String(Auth.role()||'').trim().toLowerCase():''; }
  catch(e){ return ''; }
}
function canSeePayments(){ return MIA_PAY_ROLES.indexOf(myRole())>=0; }
function hasSession(){
  try{
    if(typeof Auth==='undefined'||!Auth||!Auth.token)return false;
    if(!Auth.token())return false;
    return MIA_ALLOWED_ROLES.indexOf(myRole())>=0;
  }catch(e){ return false; }
}
function miaOff(){ try{ return sessionStorage.getItem(K_OFF)==='1'; }catch(e){ return false; } }
function setMiaOff(){ try{ sessionStorage.setItem(K_OFF,'1'); }catch(e){} }

/* ════════════════ CSS (solo lo nuevo — add-only) ════════════════ */
/* La fila NO es sticky: es un bloque normal debajo de la cabecera y se va con
   el scroll. Sin position, sin top y sin z-index no hay nada que empujar, así
   que ninguna barra de la página cambia de sitio. */
const CSS = `
.mia-row{background:#fff;border-bottom:1px solid var(--gray-2,#e8eaed);padding:6px 12px 5px}
.mia-row .mia-in{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:8px}
.mia-row .mia-mk{width:30px;height:30px;flex-shrink:0}
.mia-field{flex:1;display:flex;align-items:center;height:44px;cursor:text;border:1.5px solid var(--gray-2,#e8eaed);border-radius:22px;padding:0 14px;background:var(--gray-1,#f4f5f7);min-width:0}
/* Anillo de foco con outline, no con borde: varias páginas hacen
   body.dark *{border-color:...!important} y se comían el borde del campo. */
.mia-field:focus-within{border-color:var(--red,#C8102E);background:#fff;outline:2px solid #9e0c24;outline-offset:2px}
/* 44 px de alto propios, no el 100% del hueco: con box-sizing:border-box el
   hueco interior del campo son 41 px y la zona tactil del input se quedaba
   corta. Sobresale 1,5 px por lado, y como es transparente no se ve. */
.mia-field input{flex:1;height:44px;box-sizing:border-box;border:none;background:transparent;font-family:inherit;font-size:16px;color:var(--gray-5,#2d3142);min-width:0;outline:none}
.mia-field input::placeholder{color:#5c6273}
.mia-go{box-sizing:border-box;height:44px;padding:0 14px;border:none;border-radius:22px;background:var(--red,#C8102E);color:#fff;font-family:Montserrat,sans-serif;font-size:13px;font-weight:800;letter-spacing:.3px;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;gap:0}
.mia-go:hover{background:var(--red-dark,#9e0c24)}
.mia-go .mia-go-i{display:none;width:20px;height:20px;flex-shrink:0}
/* Debajo de 480 px el botón es solo el icono, 44x44, y la marca sale de la
   fila: el campo gana casi 90 px, que son cinco o seis palabras más de la
   pregunta a la vista. El nombre sigue ahí para el lector de pantalla
   (aria-label) y para el ratón (title). */
@media (max-width:479px){
  .mia-row{padding:6px 8px 5px}
  .mia-row .mia-mk{display:none}
  .mia-go{width:44px;padding:0}
  .mia-go .mia-go-t{display:none}
  .mia-go .mia-go-i{display:block}
}

/* Aa: entra en la cabecera con el alto del botón de al lado, para que la
   cabecera no cambie de altura. El ::after le da 44x44 de zona táctil sin
   ocupar sitio. */
/* Aa: siempre dentro de la fila, 44x44 de verdad (no una zona táctil
   simulada), a 8 px de lo de al lado como el resto de la fila. */
@media (prefers-reduced-motion:reduce){.mia-row *,.mia-panel *{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
.mia-aa{box-sizing:border-box;font-family:'Atkinson Hyperlegible','Open Sans',sans-serif;background:var(--gray-1,#f4f5f7);border:1.5px solid var(--gray-2,#e8eaed);color:#5c6273;width:44px;height:44px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;transition:background .15s,color .15s}
.mia-aa.on{background:var(--gray-5,#2d3142);border-color:var(--gray-5,#2d3142);color:#fff}

.mia-panel{display:none;background:#fff;border-bottom:2px solid var(--gray-2,#e8eaed);padding:12px 16px 14px;font-family:'Open Sans',sans-serif;font-size:16px;line-height:1.5;--mia-muted:#5c6273;color:var(--gray-5,#2d3142)}
.mia-panel.show{display:block}
.mia-panel .mia-in{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.mia-panel .mia-top{display:flex;align-items:center;gap:8px}
.mia-panel .mia-top .mia-mk{width:30px;height:30px;flex-shrink:0}
.mia-panel .mia-top .mia-q{flex:1;min-width:0;overflow-wrap:anywhere;word-break:break-word;font-size:16px;color:var(--mia-muted)}
.mia-panel .mia-top .mia-q b{color:var(--gray-5,#2d3142);font-weight:600}
.mia-panel .mia-close{width:44px;height:44px;border:1.5px solid var(--gray-2,#e8eaed);border-radius:50%;background:#fff;color:var(--mia-muted);font-size:16px;cursor:pointer;flex-shrink:0;padding:0}
.mia-panel .mchips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.mia-panel .mchips .mia-lb{font-size:14px;font-weight:600;color:var(--mia-muted)}
/* El chip mide 44 px de alto y la equis ocupa 44x44 dentro de el: la zona
   tactil cumple el minimo sin que la fila de chips crezca. El disco visible
   sigue siendo de 26 px. box-sizing se pone aqui: hay paginas que no lo
   declaran globalmente. */
.mia-panel .mchip{box-sizing:border-box;display:inline-flex;align-items:center;gap:2px;font-size:16px;font-weight:600;color:var(--red,#C8102E);background:var(--red-light,#fce8eb);border:1.5px solid rgba(200,16,46,.25);border-radius:22px;padding:0 0 0 12px;min-width:0;max-width:100%;height:auto;min-height:44px;overflow-wrap:anywhere;word-break:break-word}
/* El margen negativo se come el borde del chip: una linea sigue midiendo 44
   exactos y la equis mantiene sus 44x44 de zona tactil. Si el texto dobla, el
   chip crece y la equis se queda arriba, a la vista. */
.mia-panel .mchip .mia-x{box-sizing:border-box;width:44px;height:44px;border:none;background:none;padding:0;margin:-1.5px 0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;align-self:flex-start}
.mia-panel .mchip .mia-x i{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:rgba(200,16,46,.12);color:#9e0c24;font-size:13px;font-weight:900;line-height:1;font-style:normal}
.mia-panel .mia-note{min-width:0;overflow-wrap:anywhere;word-break:break-word;font-size:16px;color:var(--mia-muted);max-width:62ch}
.mia-panel .mcard{background:#fff;border:1px solid var(--gray-2,#e8eaed);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden}
.mia-panel .mcard-h{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--red,#C8102E);color:#fff}
.mia-panel .mcard-h .mia-t{font-family:Montserrat,sans-serif;font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;flex:1;min-width:0;overflow-wrap:anywhere;word-break:break-word;line-height:1.2}
.mia-panel .mcard-h .mia-id{font-family:Montserrat,sans-serif;font-size:14px;font-weight:800;background:rgba(255,255,255,.12);padding:3px 9px;border-radius:20px;min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:break-word}
.mia-panel .mcard-b{padding:14px 14px 16px;display:flex;flex-direction:column;gap:12px}
.mia-panel .mia-kv{display:grid;grid-template-columns:100px 1fr;gap:8px 12px;font-size:16px;line-height:1.5}
.mia-panel .mia-kv .mia-k{font-size:14px;font-weight:600;color:var(--mia-muted);padding-top:2px}
.mia-panel .mia-kv .mia-v{min-width:0;overflow-wrap:anywhere;word-break:break-word;color:var(--gray-5,#2d3142)}
.mia-panel .mia-sec{font-family:Montserrat,sans-serif;font-size:15px;font-weight:700;color:var(--gray-5,#2d3142);padding-bottom:6px;border-bottom:1px solid var(--gray-2,#e8eaed);margin-bottom:8px}
.mia-panel .mia-states{display:flex;flex-wrap:wrap;gap:6px}
.mia-panel .mia-st{display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:600;border-radius:22px;padding:6px 12px;min-height:36px;border:1.5px solid var(--gray-2,#e8eaed);background:#fff;color:var(--gray-5,#2d3142)}
.mia-panel .mia-st.ok{border-color:rgba(20,101,47,.35);background:var(--green-light,#e6f7ee);color:#14652f}
.mia-panel .mia-st.pend{border-color:rgba(138,69,0,.35);background:var(--orange-light,#fff4e0);color:#8a4500}
.mia-panel .mia-st.bad{border-color:rgba(158,12,36,.35);background:var(--red-light,#fce8eb);color:#9e0c24}
/* La tabla de pagos vive en su propio carril: con Aa y a 320 px no cabe, y
   antes empujaba el panel entero a lo ancho. */
.mia-panel .mia-payw{position:relative;width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
/* Aviso de que el carril se puede arrastrar. Solo se pinta cuando de verdad
   sobra ancho: lo pone el JS con la clase mia-scrolls. */
.mia-panel .mia-payw.mia-scrolls{padding-bottom:2px}
.mia-panel .mia-payhint{display:none;font-size:14px;color:var(--mia-muted);padding-top:4px}
.mia-panel .mia-payw.mia-scrolls+.mia-payhint{display:block}
/* La fecha repetida bajo el concepto solo se ve en pantallas muy estrechas. */
.mia-panel .mia-pay td.mia-c .mia-dsub{display:none;font-size:16px;color:var(--mia-muted)}
@media (max-width:359px){
  /* Sin sitio para tres columnas: la fecha se va debajo del concepto y quedan
     Concepto e Importe, que es lo que hay que leer. */
  .mia-panel .mia-pay{min-width:0}
  .mia-panel .mia-pay th.mia-d,.mia-panel .mia-pay td.mia-d{display:none}
  .mia-panel .mia-pay td.mia-c .mia-dsub{display:block}
}
/* Con Aa el texto es mayor, así que el corte llega antes: a 360-389 px las tres
   columnas ya no caben y la fecha se va debajo del concepto igual que a 320. */
@media (max-width:389px){
  body.easy .mia-panel .mia-pay{min-width:0}
  body.easy .mia-panel .mia-pay th.mia-d,
  body.easy .mia-panel .mia-pay td.mia-d{display:none}
  body.easy .mia-panel .mia-pay td.mia-c .mia-dsub{display:block}
}
.mia-panel .mia-pay{width:100%;min-width:min(100%,260px);border-collapse:collapse;font-size:16px;font-variant-numeric:tabular-nums}
.mia-panel .mia-pay th{font-size:14px;font-weight:600;color:var(--mia-muted);text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--gray-2,#e8eaed)}
.mia-panel .mia-pay td{padding:9px 10px 9px 0;border-bottom:1px solid var(--gray-1,#f4f5f7);vertical-align:top}
.mia-panel .mia-pay td.mia-n,.mia-panel .mia-pay th.mia-n{text-align:right;white-space:nowrap;padding-left:12px;padding-right:0}
.mia-panel .mia-pay td.mia-c{min-width:0;overflow-wrap:anywhere;word-break:break-word}
/* Anillo de foco propio en todos los mandos de Mia: no se hereda ni se
   depende del CSS de la página, que en varias no tiene ninguno. */
.mia-row .mia-go:focus-visible,
.mia-row .mia-aa:focus-visible,
.mia-panel .mia-close:focus-visible,
.mia-panel .mia-btn:focus-visible,
.mia-panel .mchip .mia-x:focus-visible,
.mia-panel .mia-vrow .mia-vmain:focus-visible{outline:2px solid #9e0c24;outline-offset:2px}
body.dark .mia-row .mia-go:focus-visible,
body.dark .mia-row .mia-aa:focus-visible,
body.dark .mia-panel .mia-close:focus-visible,
body.dark .mia-panel .mia-btn:focus-visible,
body.dark .mia-panel .mchip .mia-x:focus-visible,
body.dark .mia-panel .mia-vrow .mia-vmain:focus-visible{outline-color:#ff9fae}
.mia-panel .mia-btns{display:flex;flex-wrap:wrap;gap:8px}
.mia-panel .mia-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:auto;min-height:44px;padding:8px 16px;border-radius:8px;border:1.5px solid var(--gray-2,#e8eaed);background:#fff;color:var(--gray-5,#2d3142);font-family:Montserrat,sans-serif;font-size:14px;min-width:0;overflow-wrap:anywhere;font-weight:800;letter-spacing:.2px;cursor:pointer;text-decoration:none;text-transform:uppercase}
.mia-panel .mia-btn.mia-primary{background:var(--red,#C8102E);border-color:var(--red,#C8102E);color:#fff}
.mia-panel .mia-list{display:flex;flex-direction:column;gap:8px}
.mia-panel .mia-vrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:8px 12px;border:1px solid var(--gray-2,#e8eaed);border-radius:10px;background:#fff}
.mia-panel .mia-vrow .mia-vmain{flex:1 1 55%;min-width:0;overflow-wrap:anywhere;word-break:break-word;display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;min-height:44px;padding:0;border:none;background:none;text-align:left;font-family:inherit;font-size:15px;color:var(--gray-5,#2d3142);text-decoration:none;cursor:pointer}
.mia-panel .mia-vrow .mia-n{font-family:Montserrat,sans-serif;font-weight:800;font-size:16px;min-width:0;overflow-wrap:anywhere;word-break:break-word}
.mia-panel .mia-vrow .mia-m{font-size:16px;min-width:0;overflow-wrap:anywhere;word-break:break-word;color:var(--mia-muted)}
.mia-panel .mia-foot{font-size:13px;color:var(--mia-muted)}
@media (max-width:480px){
  .mia-panel .mia-vrow .mia-m{flex-basis:100%}
  .mia-panel .mia-vrow .mia-btn{flex:1 1 100%}
}

/* ── Modo noche. Las páginas hacen body.dark *{color:#fff!important}, así que
   todo color que no sea blanco necesita !important y más especificidad. ── */
body.dark .mia-row{background:#16161e;border-bottom-color:rgba(255,255,255,.10)}
body.dark .mia-field{background:#1e1e26;border-color:rgba(255,255,255,.16)}
body.dark .mia-field:focus-within{background:#252535;border-color:var(--red,#C8102E);outline-color:#ff9fae}
body.dark .mia-field input::placeholder{color:#a7adbb!important}
body.dark .mia-go{background:var(--red,#C8102E)}
body.dark .mia-aa{background:#1e1e26;border-color:rgba(255,255,255,.18);color:#c9cdd8!important}
body.dark .mia-aa.on{background:#f4f5f7;border-color:#f4f5f7;color:#16161e!important}
body.dark .mia-panel{background:#16161e;border-bottom-color:rgba(255,255,255,.16)}
/* Los colores claros se ponen aqui, no se heredan del body.dark *{color:#fff}
   de la pagina: hay paginas con modo noche y paginas sin el. */
body.dark .mia-field input,
body.dark .mia-panel,
body.dark .mia-panel .mia-top .mia-q b,
body.dark .mia-panel .mia-close,
body.dark .mia-panel .mia-kv .mia-v,
body.dark .mia-panel .mia-sec,
body.dark .mia-panel .mia-st,
body.dark .mia-panel .mia-pay td,
body.dark .mia-panel .mia-btn,
body.dark .mia-panel .mia-vrow .mia-vmain,
body.dark .mia-panel .mia-vrow .mia-n{color:#fff!important}
body.dark .mia-panel .mia-top .mia-q,
body.dark .mia-panel .mia-note,
body.dark .mia-panel .mia-foot,
body.dark .mia-panel .mia-kv .mia-k,
body.dark .mia-panel .mchips .mia-lb,
body.dark .mia-panel .mia-pay th,
body.dark .mia-panel .mia-vrow .mia-m{color:#c9cdd8!important}
body.dark .mia-panel .mia-close{background:#1e1e26;border-color:rgba(255,255,255,.20)}
body.dark .mia-panel .mcard{background:#1e1e26;border-color:rgba(255,255,255,.14);box-shadow:none}
body.dark .mia-panel .mia-sec{border-bottom-color:rgba(255,255,255,.18)}
body.dark .mia-panel .mia-st{background:#252535;border-color:rgba(255,255,255,.18)}
body.dark .mia-panel .mia-st.ok{background:rgba(30,158,78,.28);border-color:rgba(30,158,78,.5);color:#b6f2ce!important}
body.dark .mia-panel .mia-st.pend{background:rgba(224,123,0,.30);border-color:rgba(224,123,0,.5);color:#ffd9a3!important}
body.dark .mia-panel .mia-st.bad{background:rgba(200,16,46,.30);border-color:rgba(200,16,46,.5);color:#ffc2cb!important}
body.dark .mia-panel .mchip{background:rgba(200,16,46,.24);border-color:rgba(200,16,46,.5);color:#ffc2cb!important}
body.dark .mia-panel .mchip .mia-x i{background:rgba(255,255,255,.16);color:#fff!important}
body.dark .mia-panel .mia-btn{background:#252535;border-color:rgba(255,255,255,.20)}
body.dark .mia-panel .mia-btn.mia-primary{background:var(--red,#C8102E);border-color:var(--red,#C8102E)}
body.dark .mia-panel .mia-vrow{background:#252535;border-color:rgba(255,255,255,.14)}
body.dark .mia-panel .mia-pay td{border-bottom-color:rgba(255,255,255,.10)}
body.dark .mia-panel .mia-pay th{border-bottom-color:rgba(255,255,255,.18)}

/* ── Aa: texto más legible. Opt-in, apagado por defecto.
   SOLO afecta a lo de Mia. Ni una regla toca un elemento de la página: quien
   no usa a Mia no ve cambiar nada, y quien la usa tampoco ve moverse su
   cabecera ni sus filtros. ── */
body.easy .mia-row,
body.easy .mia-panel{font-family:'Atkinson Hyperlegible','Open Sans',sans-serif}
/* Con Aa TODO el texto de Mia sube: la pregunta, las notas, los valores de la
   ficha, la tabla de pagos, los nombres de la lista, sus datos, los botones y
   el titulo de la ficha. Ni una regla toca la pagina. */
body.easy .mia-field input{font-size:19px}
body.easy .mia-panel{font-size:18px}
body.easy .mia-panel .mia-note,
body.easy .mia-panel .mia-top .mia-q,
body.easy .mia-panel .mia-kv,
body.easy .mia-panel .mia-kv .mia-k,
body.easy .mia-panel .mia-kv .mia-v,
body.easy .mia-panel .mia-sec,
body.easy .mia-panel .mia-st,
body.easy .mia-panel .mia-pay,
body.easy .mia-panel .mia-pay td,
body.easy .mia-panel .mchip,
body.easy .mia-panel .mia-vrow,
body.easy .mia-panel .mia-vrow .mia-n,
body.easy .mia-panel .mia-vrow .mia-m,
body.easy .mia-panel .mia-btn,
body.easy .mia-panel .mia-foot{font-family:'Atkinson Hyperlegible','Open Sans',sans-serif}
body.easy .mia-panel .mia-note,
body.easy .mia-panel .mia-top .mia-q,
body.easy .mia-panel .mia-kv,
body.easy .mia-panel .mia-kv .mia-v,
body.easy .mia-panel .mia-pay,
body.easy .mia-panel .mia-pay td,
body.easy .mia-panel .mia-vrow .mia-n,
body.easy .mia-panel .mia-vrow .mia-m,
body.easy .mia-panel .mchip,
body.easy .mia-panel .mia-st{font-size:18px}
body.easy .mia-panel .mcard-h .mia-t{font-size:18px}
body.easy .mia-panel .mcard-h .mia-id{font-size:16px}
body.easy .mia-panel .mia-btn{font-size:16px}
body.easy .mia-panel .mia-sec{font-size:17px}
body.easy .mia-panel .mia-kv .mia-k,
body.easy .mia-panel .mchips .mia-lb,
body.easy .mia-panel .mia-pay th,
body.easy .mia-panel .mia-payhint{font-size:16px}
/* La fecha de debajo del concepto mide lo mismo que la columna a la que
   sustituye: 16 sin Aa, 18 con Aa. */
body.easy .mia-panel .mia-pay td.mia-c .mia-dsub{font-size:18px}
body.easy .mia-panel .mia-foot{font-size:15px}
body.easy .mia-row .mia-go{font-size:15px}
body.easy .mia-panel .mia-btn,
body.easy .mia-panel .mcard-h .mia-t,
body.easy .mia-go{text-transform:none;letter-spacing:0}
`;

/* ════════════════ ESTADO DEL MÓDULO ════════════════ */
let ROW=null, PANEL=null, BODY=null, INPUT=null, AABTN=null, ANCHOR=null;
let ST={ q:'' };
let USERS=null;         // mapa UserID → Name (solo como último recurso, para la ficha)
let downShown=false;

/* ════════════════ TEXTO MÁS LEGIBLE (Aa) ════════════════ */
let fontLoaded=false;
function loadEasyFont(){
  /* Una sola hoja de la fuente por página, aunque se encienda y se apague
     varias veces o el módulo se cargue dos veces. */
  if(fontLoaded||document.getElementById('miaEasyFont'))return;
  fontLoaded=true;
  const l=document.createElement('link');
  l.id='miaEasyFont';
  l.rel='stylesheet';
  l.href='https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap';
  document.head.appendChild(l);
}
/* Se escribe en el almacenamiento SOLO si el valor cambia: abrir una página
   con el Aa ya encendido no escribe nada. */
function setEasy(on){
  const v=!!on;
  document.body.classList.toggle('easy',v);
  if(AABTN){ AABTN.classList.toggle('on',v); AABTN.setAttribute('aria-pressed',v?'true':'false'); }
  if(v)loadEasyFont();
  try{
    const want=v?'1':'0';
    if(localStorage.getItem(K_EASY)!==want)localStorage.setItem(K_EASY,want);
  }catch(e){}
}
function easyOn(){ try{ return localStorage.getItem(K_EASY)==='1'; }catch(e){ return false; } }

/* ════════════════ MONTAJE ════════════════ */
function anchor(){
  return document.querySelector('nav.top-nav')
      || document.querySelector('nav.wp-nav')
      || document.querySelector('header')
      || document.querySelector('nav');
}
function buildRow(){
  const row=E('div','mia-row'); row.id='miaRow';
  const inn=E('div','mia-in');
  const mk=E('span'); mk.innerHTML=MARK; inn.appendChild(mk.firstChild);
  /* <label for>: el campo entero reenvia el toque al input, asi que la zona
     tactil es el rectangulo de 44 px que se ve, no solo el texto. */
  const field=E('label','mia-field');
  field.setAttribute('for','miaInput');
  const inp=document.createElement('input');
  inp.type='text'; inp.id='miaInput'; inp.autocomplete='off';
  inp.setAttribute('placeholder',T.ph); inp.setAttribute('aria-label',T.ph);
  inp.addEventListener('keydown',function(ev){
    if(ev.key==='Enter'){ ev.preventDefault(); onAsk(); }
  });
  field.appendChild(inp);
  /* El botón va FUERA del campo: los dos miden 44 px de alto y uno de 44
     dentro de otro de 44 no cabe. Lleva el texto y una flecha; el CSS enseña
     uno u otro según el ancho. La flecha es un SVG en línea, no un emoji: un
     emoji cambia de dibujo en cada sistema y no se puede colorear. */
  const go=E('button','mia-go'); go.type='button';
  go.appendChild(E('span','mia-go-t',T.go));
  const gi=E('span','mia-go-i');
  gi.innerHTML='<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" '
    +'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    +'<path d="M3.5 10h12"/><path d="M10.5 5l5 5-5 5"/></svg>';
  go.appendChild(gi);
  go.setAttribute('aria-label',T.go);
  go.title=T.go;
  go.addEventListener('click',onAsk);
  inn.appendChild(field); inn.appendChild(go);
  row.appendChild(inn);
  INPUT=inp;
  return row;
}
function buildPanel(){
  const p=E('div','mia-panel'); p.id='miaPanel';
  p.setAttribute('aria-live','polite');
  p.setAttribute('role','region');
  p.setAttribute('aria-label',T.panelLabel);
  const inn=E('div','mia-in'); inn.id='miaPanelIn';
  p.appendChild(inn); BODY=inn;
  return p;
}
function buildAa(){
  const b=E('button','mia-aa','Aa');
  b.type='button'; b.id='miaAa'; b.title=T.aa; b.setAttribute('aria-label',T.aa);
  b.setAttribute('aria-pressed','false');
  b.addEventListener('click',function(){ setEasy(!document.body.classList.contains('easy')); });
  return b;
}
/* El Aa vive SOLO en la fila de Mia, a 44x44 y a 8 px de lo de al lado. En la
   cabecera de la página no entra nunca: allí robaba sitio al título, movía los
   botones y en pantallas estrechas hacía crecer la cabecera. Con el botón
   dentro de la fila, la cabecera de cualquier página queda idéntica a como
   estaba y no hay nada que medir ni que recolocar al cambiar el tamaño. */
function placeAa(){
  AABTN=buildAa();
  AABTN.classList.add('mia-aa-row');
  const inn=ROW.querySelector('.mia-in');
  (inn||ROW).appendChild(AABTN);
}
/* Al retirar la fila se va todo lo de Mia: el campo, el panel y el botón Aa,
   que vive dentro de la fila. Como el Aa desaparece, body.easy se quita
   también —si no, la página se quedaría con el texto grande y sin botón para
   apagarlo—, pero la preferencia guardada NO se toca: en la próxima página con
   Mia vuelve encendido. */
function hideRow(keepPanel){
  if(AABTN&&AABTN.parentNode)AABTN.parentNode.removeChild(AABTN);
  AABTN=null;
  document.body.classList.remove('easy');
  if(ROW&&ROW.parentNode)ROW.parentNode.removeChild(ROW);
  ROW=null; INPUT=null;
  /* El panel solo se queda si tiene algo que enseñar (el aviso de caída).
     Un #miaPanel vacío no se deja en la página. */
  const keep=keepPanel&&PANEL&&PANEL.classList.contains('show')&&BODY&&BODY.childNodes.length>0;
  if(!keep){
    if(PANEL&&PANEL.parentNode)PANEL.parentNode.removeChild(PANEL);
    PANEL=null; BODY=null;
    unbindEsc();
  }
}

function mount(){
  if(!hasSession())return;
  if(miaOff())return;
  const a=anchor();
  if(!a||!a.parentNode)return;
  ANCHOR=a;

  const style=E('style'); style.id='miaStyles'; style.textContent=CSS;
  document.head.appendChild(style);

  ROW=buildRow();
  PANEL=buildPanel();
  a.parentNode.insertBefore(ROW,a.nextSibling);
  ROW.parentNode.insertBefore(PANEL,ROW.nextSibling);
  bindEsc();
  placeAa();

  if(easyOn())setEasy(true);
}

/* ════════════════ PANEL ════════════════ */
/* Escape cierra el panel desde cualquier parte de la pagina: un solo
   escuchador en document, puesto una vez al montar y quitado al soltar el
   panel. Va en fase de captura para que llegue aunque la pagina pare el
   evento antes de que suba, y solo hace algo con el panel abierto: con el
   panel cerrado no se toca el Escape de la pagina. */
let ESCH=null;
function bindEsc(){
  if(ESCH)return;
  ESCH=function(ev){
    if(ev.key!=='Escape'&&ev.key!=='Esc')return;
    if(!PANEL||!PANEL.classList.contains('show'))return;
    ev.stopPropagation();
    closePanel();
  };
  document.addEventListener('keydown',ESCH,true);
}
function unbindEsc(){
  if(!ESCH)return;
  document.removeEventListener('keydown',ESCH,true);
  ESCH=null;
}
function openPanel(){ if(PANEL)PANEL.classList.add('show'); }
function closePanel(){
  if(PANEL)PANEL.classList.remove('show');
  if(BODY)BODY.textContent='';
  /* Si la fila ya no está (Worker caído) el panel era lo último de Mia en la
     página: al cerrarlo se va el nodo, se va la hoja de estilos y se suelta el
     escuchador de Escape, que a partir de ahí es solo de la página. */
  if(!ROW){
    if(PANEL&&PANEL.parentNode)PANEL.parentNode.removeChild(PANEL);
    PANEL=null; BODY=null;
    const st=document.getElementById('miaStyles');
    if(st&&st.parentNode)st.parentNode.removeChild(st);
    /* La hoja de la fuente del Aa también se va: sin estilos de Mia ya no la
       usa nadie. Si Mia vuelve a montarse con el Aa encendido, loadEasyFont la
       pide otra vez, y como comprueba por id sigue habiendo una sola por
       carga de página. */
    const ff=document.getElementById('miaEasyFont');
    if(ff&&ff.parentNode)ff.parentNode.removeChild(ff);
    fontLoaded=false;
    unbindEsc();
  }
}
function clearPanel(){ if(BODY)BODY.textContent=''; }

function panelHead(){
  const top=E('div','mia-top');
  const mk=E('span'); mk.innerHTML=MARK; top.appendChild(mk.firstChild);
  const q=E('div','mia-q');
  q.appendChild(document.createTextNode(T.asked+' '));
  q.appendChild(E('b',null,ST.q));
  top.appendChild(q);
  const x=E('button','mia-close','✕');
  x.type='button'; x.title=T.close; x.setAttribute('aria-label',T.close);
  x.addEventListener('click',closePanel);
  top.appendChild(x);
  return top;
}
function say(node){
  /* El panel puede haberse ido entre la pregunta y la respuesta (Worker caído
     y el usuario cierra el aviso). Entonces no hay dónde escribir: se calla. */
  if(!BODY||!PANEL)return;
  clearPanel();
  BODY.appendChild(panelHead());
  if(node)BODY.appendChild(node);
  BODY.appendChild(E('div','mia-foot',T.onlyRead));
  openPanel();
}
function note(txt){ return E('div','mia-note',txt); }

/* ════════════════ CHIPS ════════════════ */
/* Los chips se construyen SIEMPRE con lo que ha llegado a la URL o a la
   consulta. Lo demás va a "No pude aplicar". */
const CHIP_LABELS = {
  code:'Reserva', guest:'Inquilino', villa:'Villa', check_in_from:'Desde', check_in_to:'Hasta',
  stay_on:'Está el', manager:'Manager', source:'Source', cleaner:'Limpieza', tipo:'Tipo',
  type:'Tipo', status:'Estado', user:'Usuario', from:'Desde', to:'Hasta',
  urgent:'Urgente', important:'Importante', pax:'Plazas', pool:'Piscina'
};
function chipText(k,v){
  const lbl=own(CHIP_LABELS,k)||k;
  if(k==='stay_on')return lbl+' '+fmtShort(v);
  if(v===true)return lbl;
  if(isDate(v))return lbl+': '+fmtDate(v);
  return lbl+': '+v;
}
function chipsBlock(chips,filters,onChange){
  const keys=Object.keys(chips||{}).filter(function(k){
    const v=chips[k];
    return v!==''&&v!=null&&v!==false&&!(Array.isArray(v)&&!v.length);
  });
  if(!keys.length)return null;
  const wrap=E('div','mchips');
  wrap.appendChild(E('span','mia-lb',T.filters));
  keys.forEach(function(k){
    const c=E('span','mchip');
    c.appendChild(document.createTextNode(chipText(k,chips[k])));
    const x=E('button','mia-x'); x.type='button';
    x.appendChild(E('i',null,'✕'));
    x.title=T.rmFilter; x.setAttribute('aria-label',T.rmFilter+' '+(own(CHIP_LABELS,k)||k));
    x.addEventListener('click',function(){ delete filters[k]; onChange(); });
    c.appendChild(x);
    wrap.appendChild(c);
  });
  return wrap;
}
function noApplyBlock(list){
  const l=(list||[]).filter(Boolean).map(String);
  if(!l.length)return null;
  const txt=l.join(', ');
  return note(T.noApply+' '+txt+(/[.!?]$/.test(txt)?'':'.'));
}
function btn(label,href,primary){
  const a=document.createElement('a');
  a.className='mia-btn'+(primary?' mia-primary':'');
  a.textContent=label;
  a.setAttribute('href',href);
  return a;
}

/* ════════════════ MAPAS DE LA PROPIA PÁGINA ════════════════ */
/* Nunca se descarga TaUsers para resolver un nombre: se usa el mapa que la
   página ya tiene cargado (entradas-equipo expone allUsersMap, managersMap y
   contactsMap como variables de script). Si no hay mapa, el nombre va a
   "No pude aplicar". */
function globalMap(name){
  try{ if(window[name])return window[name]; }catch(e){}
  try{ if(name==='allUsersMap'&&typeof allUsersMap!=='undefined')return allUsersMap; }catch(e){}
  try{ if(name==='managersMap'&&typeof managersMap!=='undefined')return managersMap; }catch(e){}
  try{ if(name==='contactsMap'&&typeof contactsMap!=='undefined')return contactsMap; }catch(e){}
  return null;
}
function mapPairs(m){
  const out=[];
  if(!m)return out;
  try{
    if(typeof m.forEach==='function'&&typeof m.get==='function'){
      m.forEach(function(v,k){ out.push([String(k),String(v==null?'':v)]); });
    }else if(typeof m==='object'){
      Object.keys(m).forEach(function(k){ out.push([String(k),String(m[k]==null?'':m[k])]); });
    }
  }catch(e){}
  return out;
}
/* Nombre → id de usuario. Fuentes, en este orden: los mapas que la propia
   página ya tiene cargados y, si no hay ninguno (tareas.html los guarda dentro
   de su IIFE), el mapa id→nombre que Mia carga de TaUsers con la misma llamada
   que hace la página.
   contactsMap NO entra: sus claves son ContactID numéricos de TaContacts, otra
   tabla; un contacto colándose como usuario o como manager daría un filtro
   falso con su chip.
   Se compara por PRINCIPIO DE PALABRA, sin acentos y en minúsculas: cada
   palabra de lo que ha dicho el usuario tiene que empezar alguna palabra del
   nombre del mapa. "Ana" no es "Mariana". El nombre completo exacto gana:
   "Ana Ruiz" es Ana Ruiz, no Ana Ruiz Pons. Si aun así coinciden dos personas
   no se resuelve ninguna: quien llama lo dice en "No pude aplicar". */
function nameWords(v){ return String(v==null?'':v).split(/[^a-z0-9]+/).filter(Boolean); }
function nameHit(name,qw){
  const parts=nameWords(name);
  for(let i=0;i<qw.length;i++){
    let ok=false;
    for(let j=0;j<parts.length&&!ok;j++)if(parts[j].indexOf(qw[i])===0)ok=true;
    if(!ok)return false;
  }
  return true;
}
function userPairs(){
  const out=[];
  const seen={};
  const maps=['allUsersMap','managersMap'];
  for(let i=0;i<maps.length;i++){
    const pairs=mapPairs(globalMap(maps[i]));
    for(let j=0;j<pairs.length;j++){
      const k=pairs[j][0];
      if(seen[k])continue;
      seen[k]=1; out.push(pairs[j]);
    }
  }
  if(!out.length&&USERS){
    USERS.forEach(function(v,k){ if(!seen[k]){ seen[k]=1; out.push([String(k),String(v==null?'':v)]); } });
  }
  return out;
}
function findUser(name){
  const raw=String(name==null?'':name).trim();
  if(!raw)return {id:'',many:false};
  const pairs0=userPairs();
  if(isUserId(raw)){
    /* Con el mapa cargado, un token de ocho caracteres solo es un id si el
       mapa lo conoce: "LIMPIEZ4" tiene la forma de un id pero es una palabra.
       Sin mapa no hay con qué comprobarlo y manda la forma. */
    if(!pairs0.length)return {id:raw.toUpperCase(),many:false};
    const up=raw.toUpperCase();
    for(let i=0;i<pairs0.length;i++){
      if(String(pairs0[i][0]).toUpperCase()===up)return {id:pairs0[i][0],many:false};
    }
    /* No está en el mapa: se sigue buscando como si fuera un nombre. */
  }
  const q=fold(raw);
  const qw=nameWords(q);
  if(!qw.length)return {id:'',many:false};
  const pairs=pairs0;
  const ids=[], exact=[];
  for(let j=0;j<pairs.length;j++){
    const k=pairs[j][0], v=fold(pairs[j][1]);
    if(!isUserId(k)||!v)continue;
    if(v===q){ if(exact.indexOf(k)<0)exact.push(k); }
    if(!nameHit(v,qw))continue;
    if(ids.indexOf(k)<0)ids.push(k);
  }
  if(exact.length===1)return {id:exact[0],many:false};
  if(!exact.length&&ids.length===1)return {id:ids[0],many:false};
  return {id:'',many:(exact.length||ids.length)>1};
}
function nameToId(name){ return findUser(name).id; }
/* id → nombre, del mismo mapa que ya tiene la página. */
function userName(id){
  const k=String(id==null?'':id).trim();
  if(!k)return '';
  const pairs=userPairs();
  for(let i=0;i<pairs.length;i++)if(String(pairs[i][0])===k)return pairs[i][1];
  return '';
}

/* ════════════════ CASPIO (lectura con el token del usuario) ════════════════ */
/* Toda respuesta pasa por aquí: los campos sensibles se borran nada más
   parsear, antes de que nada los pueda pintar o registrar.
   La lista sale de los nombres de campo del volcado del 2026-09-01: cajas de
   llaves y sus fotos, contraseñas y datos de wifi, códigos de alarma, notas y
   comentarios del keyholder, la caja fuerte, los datos de tarjeta, el token y
   los documentos de identidad. KeyHolder_person, KeyHolder_zone y Key_Holder
   NO entran: son el id de ocho caracteres de la persona, no un código. Las
   fotos de la llave del agua y los importes de tarjeta tampoco: no son
   secretos y la ficha los necesita. */
const SENSITIVE=/keybox|password|wifi|alarm|key_com|notas_keyholder|keyholdernotes|safe_box|card_|token_id|dni|passport|registrodepolicia|cuenta_bancaria|swift_bic|nif/i;
function stripSensitive(rows){
  for(let i=0;i<rows.length;i++){
    const r=rows[i]; if(!r||typeof r!=='object')continue;
    const ks=Object.keys(r);
    for(let j=0;j<ks.length;j++){ if(SENSITIVE.test(ks[j]))delete r[ks[j]]; }
  }
  return rows;
}
async function proxyGet(qs){
  const res=await fetch(Auth.url(PROXY+'?'+qs));
  const json=await res.json();
  const rows=stripSensitive(json.Result||json.result||[]);
  if(json.error)throw new Error(String(json.error));
  return rows;
}
/* Misma llamada que hace tareas.html en loadUsers() (línea 840) y otras
   dieciséis páginas de la intranet: action=data&table=TaUsers&limit=200, con el
   token del propio usuario. El proxy no admite elegir columnas —ninguna página
   le pasa nunca una lista de campos—, así que llegan las filas enteras: se les
   quitan los campos sensibles al recibirlas, se guarda solo id→nombre y las
   filas se sueltan. Una vez por carga de página, ni una petición más. */
let USERSP=null;
async function loadUsers(){
  if(USERSP)return USERSP;
  USERSP=(async function(){
    let m=null;
    try{
      const rows=await proxyGet('action=data&table=TaUsers&limit=200');
      m=new Map();
      rows.forEach(function(u){
        const id=String(u[U.id]||'').trim(), nm=String(u[U.name]||'').trim();
        if(id&&nm)m.set(id,nm);
      });
    }catch(e){ dbg('TaUsers ko'); }
    if(m){ USERS=m; return m; }
    /* Un fallo no se guarda: la siguiente pregunta lo vuelve a intentar una
       vez. Dentro de la misma pregunta solo se llama aquí una vez, así que no
       hay bucle de reintentos. */
    USERSP=null;
    return new Map();
  })();
  return USERSP;
}
/* Solo se baja el mapa si hace falta un nombre y la página no tiene el suyo
   (tareas.html guarda allUsersMap dentro de su IIFE, así que no se ve). */
async function ensureUsers(name){
  const raw=String(name==null?'':name).trim();
  if(!raw)return;
  /* También para un token con forma de id: con el mapa cargado se comprueba
     que existe de verdad, así "LIMPIEZ4" no acaba en u= como si fuera una
     persona. */
  if(userPairs().length)return;
  await loadUsers();
}

/* ════════════════ WHERE de reservas ════════════════ */
/* Mismos operadores y escapado que buildWhere() de entradas-equipo.
   OJO con la trampa de fechas: stay_on = Checkin <= día AND Checkout >= día. */
function phClean(f){
  return "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("+f+",' ',''),'+',''),'-',''),'.',''),'(',''),')','')";
}
function bookingsWhere(b){
  const parts=[];
  const code=(b.code||'').trim(), guest=(b.guest||'').trim(), villa=(b.villa||'').trim();
  /* Siempre, también con código: es la primera condición de buildWhere() en
     entradas-equipo, así que la ficha enseña lo mismo que la página. */
  parts.push(F.status+"<>'cancelled'");
  if(code)parts.push(F.confirmCode+" LIKE '%"+sqLike(code)+"%'");
  if(villa)parts.push(F.villaName+" LIKE '%"+sqLike(villa)+"%'");
  if(guest){
    const q=sqLike(guest);
    let c=F.guestName+" LIKE '%"+q+"%' OR "+F.guestEmail+" LIKE '%"+q+"%' OR "+F.secondEmail+" LIKE '%"+q+"%'";
    /* Teléfonos: misma cadena de REPLACE que entradas-equipo (línea ~1348) */
    const ph=guest.replace(/[\s+\-.()]/g,'');
    if(ph&&/^\d+$/.test(ph)){
      const p=sqLike(ph);
      c+=' OR '+phClean(F.guestPhone)+" LIKE '%"+p+"%' OR "+phClean(F.phoneArrival)+" LIKE '%"+p+"%'";
      if(ph.indexOf('00')===0&&ph.slice(2)){
        const p2=sqLike(ph.slice(2));
        c+=' OR '+phClean(F.guestPhone)+" LIKE '%"+p2+"%' OR "+phClean(F.phoneArrival)+" LIKE '%"+p2+"%'";
      }
    }
    const words=guest.split(/\s+/).filter(Boolean).slice(0,4);
    if(words.length>1){
      c+=' OR ('+words.map(function(w){ return F.guestName+" LIKE '%"+sqLike(w)+"%'"; }).join(' AND ')+')';
      c+=' OR ('+words.map(function(w){ return '('+F.fiscalName+" LIKE '%"+sqLike(w)+"%' OR "+F.fiscalSurname+" LIKE '%"+sqLike(w)+"%')"; }).join(' AND ')+')';
    }
    parts.push('('+c+')');
  }
  if(isDate(b.stay_on)){
    /* "quién está el 14" es la estancia entera; pero si la pregunta dice
       salida o entrada, manda el tipo: ese día se va o llega, no está. */
    if(b.tipo==='salida')parts.push('('+F.checkOut+">='"+b.stay_on+"T00:00:00' AND "+F.checkOut+"<='"+b.stay_on+"T23:59:59')");
    else if(b.tipo==='entrada')parts.push('('+F.checkIn+">='"+b.stay_on+"T00:00:00' AND "+F.checkIn+"<='"+b.stay_on+"T23:59:59')");
    else parts.push('('+F.checkIn+"<='"+b.stay_on+"T23:59:59' AND "+F.checkOut+">='"+b.stay_on+"T00:00:00')");
  }else{
    /* Misma condición que buildWhere() de entradas-equipo (línea 1348): la
       ventana vale para la ENTRADA o para la SALIDA. Con solo el check-in, una
       pregunta de salida ("quién se va el 6") no encontraba nada, y el Worker
       manda las salidas con la fecha en check_in_from/to a propósito. */
    const d=isDate(b.check_in_from)?b.check_in_from:'', h=isDate(b.check_in_to)?b.check_in_to:'';
    /* La página trae entradas Y salidas en la ventana y luego enseña una de
       las dos según tipo (renderCards, línea 1423). Mia hace lo mismo en la
       consulta: con tipo salida solo la salida, con tipo entrada solo la
       entrada. Si no, "quién se va el 6" traía también a los que llegaban. */
    const only=b.tipo==='salida'?'out':(b.tipo==='entrada'?'in':'');
    const inC=[], outC=[];
    if(d){ inC.push(F.checkIn+">='"+d+"T00:00:00'"); outC.push(F.checkOut+">='"+d+"T00:00:00'"); }
    if(h){ inC.push(F.checkIn+"<='"+h+"T23:59:59'"); outC.push(F.checkOut+"<='"+h+"T23:59:59'"); }
    if(inC.length){
      if(only==='in')parts.push('('+inC.join(' AND ')+')');
      else if(only==='out')parts.push('('+outC.join(' AND ')+')');
      else parts.push('(('+inC.join(' AND ')+') OR ('+outC.join(' AND ')+'))');
    }
  }
  const mgr=b.manager?nameToId(b.manager):'';
  if(mgr)parts.push(F.villaManager+"='"+sq(mgr)+"'");
  /* Source y limpieza NO entran aquí. Entradas no tiene parámetro para
     ninguno de los dos, así que el enlace no los lleva y el chip no los
     dice; si la consulta sí los aplicara, la ficha enseñaría menos reservas
     que el enlace del mismo panel. Los dos van a "No pude aplicar". */
  return parts.join(' AND ');
}
async function fetchBookings(b,limit,order){
  const where=bookingsWhere(b);
  if(!where)return null;
  let qs='action=view&view='+encodeURIComponent(VIEW_BOOKINGS)+'&where='+encodeURIComponent(where);
  if(order)qs+='&orderBy='+encodeURIComponent(order);
  qs+='&limit='+limit;
  return await proxyGet(qs);
}

/* ════════════════ FICHA DE ESTADO ════════════════ */
function statePill(label,val){
  const ok=isOk(val);
  const st=E('span','mia-st'+(ok===true?' ok':ok===false?' pend':''));
  st.textContent=(ok===true?'✓ ':'· ')+label;
  return st;
}
function payConcept(r){
  const out=[];
  PAY_CONCEPTS.forEach(function(p){ if(isOk(r[p[0]])===true)out.push(p[1]); });
  const st=r[PAY.status];
  let txt=out.length?out.join(' · '):'Pago';
  if(st)txt+=' — '+st;
  return txt;
}
function payTable(rows){
  const box=E('div');
  box.appendChild(E('div','mia-sec',T.payments));
  if(!rows.length){ box.appendChild(note('Sin líneas de pago.')); return box; }
  /* La fecha viaja dos veces: en su columna y, repetida, debajo del concepto.
     Por debajo de 360 px el CSS esconde la columna y enseña la de debajo, así
     que Concepto e Importe caben sin arrastrar nada. */
  let total=0, html='<tr><th class="mia-c">'+escapeHtml(T.concept)+'</th><th class="mia-d">'+escapeHtml(T.date)
    +'</th><th class="mia-n">'+escapeHtml(T.amount)+'</th></tr>';
  rows.forEach(function(r){
    const n=parseFloat(r[PAY.amount]); if(!isNaN(n))total+=n;
    const d=escapeHtml(fmtDate(r[PAY.date]));
    html+='<tr><td class="mia-c">'+escapeHtml(payConcept(r))+'<span class="mia-dsub">'+d+'</span></td>'
        +'<td class="mia-d">'+d+'</td>'
        +'<td class="mia-n">'+escapeHtml(fmtEUR(r[PAY.amount]))+'</td></tr>';
  });
  html+='<tr><td class="mia-c"><b>'+escapeHtml(T.total)+'</b></td><td class="mia-d"></td>'
      +'<td class="mia-n"><b>'+escapeHtml(fmtEUR(total))+'</b></td></tr>';
  const t=E('table','mia-pay'); t.innerHTML=html;
  const w=E('div','mia-payw'); w.appendChild(t);
  box.appendChild(w);
  const hint=E('div','mia-payhint',T.payScroll);
  box.appendChild(hint);
  /* La pista solo aparece si el carril de verdad se puede arrastrar. */
  setTimeout(function(){
    try{ if(w.scrollWidth>w.clientWidth+1)w.classList.add('mia-scrolls'); }catch(e){}
  },0);
  return box;
}
function kvRow(kv,k,v){ kv.appendChild(E('span','mia-k',k)); kv.appendChild(E('span','mia-v',v)); }

/* Enlace a Entradas para una reserva concreta: ventana de un día antes a un
   día después, para que la reserva caiga dentro pase lo que pase.
   Primero el código y solo si no hay, el nombre: el WHERE de inq de
   entradas-equipo mete el texto sin escapar, así que un apóstrofo en el
   nombre le rompe la consulta. El código es de Hostaway y no lo lleva. */
function entradasParamsFor(r){
  const code=String(g(r,'confirmCode')||'').trim();
  const guest=String(g(r,'guestName')||'').trim();
  const p={ desde:addDays(dOnly(g(r,'checkIn')),-1), hasta:addDays(dOnly(g(r,'checkOut')),1) };
  if(code)p.cod=code; else if(guest)p.inq=guest;
  return p;
}

async function renderState(r,ctx){
  const code=String(g(r,'confirmCode')||'');
  const villa=String(g(r,'villaName')||'—');
  const box=E('div');
  /* Los mismos chips que en la lista: si la pregunta llevaba tipo, villa o
     fechas, la ficha también lo dice y se pueden quitar. */
  if(ctx&&ctx.chips){
    const ch=chipsBlock(ctx.chips,ctx.filters,ctx.onChange);
    if(ch)box.appendChild(ch);
  }
  /* Lo que no se pudo aplicar se dice también en la ficha: source y limpieza
     no tienen filtro, y un nombre que no está en el mapa tampoco. */
  if(ctx&&ctx.no){
    const na=noApplyBlock(ctx.no);
    if(na)box.appendChild(na);
  }
  const card=E('div','mcard');
  const head=E('div','mcard-h');
  head.appendChild(E('span','mia-t',villa));
  if(code)head.appendChild(E('span','mia-id',code));
  card.appendChild(head);
  const body=E('div','mcard-b'); card.appendChild(body);

  /* Datos */
  const kv=E('div','mia-kv');
  const pax=(parseInt(g(r,'adults'),10)||0)+(parseInt(g(r,'children'),10)||0);
  const gline=[g(r,'guestName'),pax?pax+' pax':'',g(r,'portalName')].filter(Boolean).join(' · ');
  kvRow(kv,T.guest,gline||'—');
  const nights=g(r,'nights');
  kvRow(kv,T.dates,fmtDate(g(r,'checkIn'))+' → '+fmtDate(g(r,'checkOut'))+(nights?' · '+nights+' '+T.nights:''));
  const mgrId=String(g(r,'villaManager')||'').trim();
  if(mgrId){
    let nm='';
    const pairs=mapPairs(globalMap('allUsersMap')).concat(mapPairs(globalMap('managersMap')));
    for(let i=0;i<pairs.length&&!nm;i++)if(pairs[i][0]===mgrId)nm=pairs[i][1];
    if(!nm){ const users=await loadUsers(); nm=users.get(mgrId)||''; }   /* mismo mapa, una sola descarga */
    if(nm)kvRow(kv,T.vm,nm);   /* si no hay nombre, no se pinta el id a secas */
  }
  body.appendChild(kv);

  /* Estados */
  const secSt=E('div');
  secSt.appendChild(E('div','mia-sec',T.state));
  const sts=E('div','mia-states');
  const stName=String(g(r,'statusNameFormula')||g(r,'status')||'').trim();
  if(stName)sts.appendChild(E('span','mia-st'+(fold(stName).indexOf('cancel')>=0?' bad':''),'· '+stName));
  const ciRaw=g(r,'checkinPend');
  const ciPend=Number(ciRaw)===3;
  const ci=E('span','mia-st'+(ciPend?' pend':(isOk(ciRaw)===true?' ok':'')));
  ci.textContent=(ciPend?'· ':(isOk(ciRaw)===true?'✓ ':'· '))+'Check-in online';
  sts.appendChild(ci);
  sts.appendChild(statePill('WelcomePack',g(r,'wellcomePack')));
  sts.appendChild(statePill('Limpieza',g(r,'limpieza')));
  sts.appendChild(statePill('Ecotasa',g(r,'ecotasaCobrada')));
  sts.appendChild(statePill('Policía',g(r,'policeDone')));
  sts.appendChild(statePill('Depósito',g(r,'depositDone')));
  sts.appendChild(statePill('Cierre',g(r,'cierre')));
  secSt.appendChild(sts);
  body.appendChild(secSt);

  /* Pagos: solo para quien puede abrir cobros-inquilinos. Para el resto no
     hay hueco, ni aviso, ni consulta: la ficha no menciona los pagos. */
  const payBox=canSeePayments()?E('div'):null;
  if(payBox){ payBox.appendChild(note(T.loading)); body.appendChild(payBox); }

  /* Botones */
  const btns=E('div','mia-btns');
  btns.appendChild(btn(T.openEnt,link('entradas',entradasParamsFor(r)),true));
  if(code)btns.appendChild(btn(T.openNotes,link('notas',{TaBookings2021_FS_confirmation_code:code})));
  const vid=String(g(r,'villaId')||'').trim();
  if(isId(vid))btns.appendChild(btn(T.openVilla,link('villa',{villa_id:vid})));
  body.appendChild(btns);

  box.appendChild(card);
  say(box);

  if(!payBox)return;
  if(code){
    try{
      const rows=await proxyGet('action=view&view='+encodeURIComponent(VIEW_PAYMENTS)
        +'&where='+encodeURIComponent(PAY.code+"='"+sq(code)+"'")+'&limit=50');
      payBox.textContent='';
      payBox.appendChild(payTable(rows));
    }catch(e){
      payBox.textContent='';
      payBox.appendChild(note('No he podido leer los pagos.'));
    }
  }else{
    payBox.textContent='';
  }
}

/* Se han enseñado MAX_ROWS y hay más: se dice, se da el enlace que abre el
   resto en Entradas y se avisa de lo que ese enlace NO puede llevar. */
function moreBlock(box,plan,b){
  box.appendChild(note(T.more));
  if(b&&b.manager&&findUser(b.manager).id)box.appendChild(note(T.noMgrLink));
  /* Si lo único que llevaría el enlace son los parámetros vacíos, no lleva
     nada: abriría Entradas sin filtro y eso no es "ver el resto". */
  const real=Object.keys(plan.params||{}).filter(function(k){ return plan.params[k]!==EMPTY; });
  if(!real.length)return;
  const btns=E('div','mia-btns');
  btns.appendChild(btn(T.openEnt,link('entradas',plan.params)));
  box.appendChild(btns);
}

/* Fila de resultado: nombre + datos (abre la ficha) y un botón a la derecha */
function resultRow(r,extraLabel,extraHref){
  const row=E('div','mia-vrow');
  const main=E('button','mia-vmain'); main.type='button';
  main.appendChild(E('span','mia-n',String(g(r,'villaName')||'—')));
  main.appendChild(E('span','mia-m',String(g(r,'guestName')||'')+' · '
    +fmtDate(g(r,'checkIn'))+' → '+fmtDate(g(r,'checkOut'))));
  main.addEventListener('click',function(){ renderState(r); });
  row.appendChild(main);
  if(extraLabel&&extraHref)row.appendChild(btn(extraLabel,extraHref));
  return row;
}
function resultList(rows,extraLabel,hrefOf){
  const list=E('div','mia-list');
  rows.forEach(function(r){ list.appendChild(resultRow(r,extraLabel,hrefOf?hrefOf(r):'')); });
  return list;
}

/* ════════════════ RESERVAS ════════════════ */
/* Los parámetros que Entradas entiende de verdad (restoreFromURL: mgr, ci,
   wp, cierr, tipo, cod, villa, inq, desde, hasta). No hay parámetro de
   source ni de limpieza: esos van a "No pude aplicar". */
function bookingsPlan(b){
  const p={}, chips={}, no=[];
  if(b.code){ p.cod=b.code; chips.code=b.code; }
  if(b.guest){ p.inq=b.guest; chips.guest=b.guest; }
  if(b.villa){ p.villa=b.villa; chips.villa=b.villa; }
  if(isDate(b.stay_on)){
    /* Nunca una ventana de un día: Entradas cruza entradas Y salidas contra
       el rango, así que un huésped a mitad de estancia sería invisible. */
    p.desde=addDays(b.stay_on,-30); p.hasta=addDays(b.stay_on,30);
    chips.stay_on=b.stay_on;
  }else{
    if(isDate(b.check_in_from)){ p.desde=b.check_in_from; chips.check_in_from=b.check_in_from; }
    if(isDate(b.check_in_to)){ p.hasta=b.check_in_to; chips.check_in_to=b.check_in_to; }
  }
  /* Manager: se aplica en la CONSULTA, nunca en el enlace. entradas-equipo
     lee mgr de la URL y acto seguido applyUserPrefs (línea 1021) lo pisa con
     la preferencia guardada del usuario, así que el enlace mentiría. El chip
     se queda porque la ficha y la lista sí filtran por manager. */
  if(b.manager){
    const u=findUser(b.manager);
    /* El chip dice el nombre del mapa, igual que renderChips() de la página
       (allUsersMap.get(id)); si el mapa no tiene nombre, lo que escribió quien
       preguntó. */
    if(u.id)chips.manager=userName(u.id)||b.manager;
    else no.push('manager: '+b.manager+(u.many?' (varios)':''));
  }
  if(b.cleaner)no.push('limpieza: '+b.cleaner);
  if(b.source)no.push('source: '+b.source);
  if(['both','entrada','salida'].indexOf(b.tipo)>=0){ p.tipo=b.tipo; chips.tipo=b.tipo; }
  else if(b.tipo)no.push('tipo: '+b.tipo);
  /* Sin fechas en la pregunta, el enlace las lleva vacías a propósito: si no,
     entradas-equipo aplica la ventana guardada del usuario (línea 1031) y una
     reserva de noviembre no aparece. p.has('desde') le basta para no hacerlo. */
  if(p.desde===undefined&&p.hasta===undefined){ p.desde=EMPTY; p.hasta=EMPTY; }
  return {params:p,chips:chips,no:no};
}
function doBookingsLink(b,extraNo){   /* extraNo = data.unmatched */
  const render=function(){
    const plan=bookingsPlan(b); plan.no=plan.no.concat(extraNo||[]);
    const box=E('div');
    const chips=chipsBlock(plan.chips,b,render);
    if(chips)box.appendChild(chips);
    box.appendChild(note(T.usedHere));
    const na=noApplyBlock(plan.no);
    if(na)box.appendChild(na);
    const href=link('entradas',plan.params);
    const btns=E('div','mia-btns');
    if(curPage()===PAGES.entradas){
      const go=E('button','mia-btn mia-primary',T.openEnt); go.type='button';
      go.addEventListener('click',function(){ location.href=href; });
      btns.appendChild(go);
    }else{
      btns.appendChild(btn(T.openEnt,href,true));
    }
    box.appendChild(btns);
    say(box);
  };
  render();
}
async function doBookingsCard(b,extraNo){
  const plan=bookingsPlan(b); plan.no=plan.no.concat(extraNo||[]);
  /* Sin código: las más recientes primero, para que las cinco que se
     enseñan sean las útiles. */
  const order=(b.code&&String(b.code).trim())?'':F.checkIn+' DESC';
  let rows;
  try{ rows=await fetchBookings(b,MAX_ROWS,order); }
  catch(e){ say(note('No he podido leer la reserva.')); return; }
  if(rows===null){ say(note(T.noBooking)); return; }

  if(!rows.length){
    /* Sin resultados no se deja al usuario en un callejón: el mismo enlace
       de Entradas que llevaría el panel de lista, con lo que sí se pudo
       aplicar (código o inquilino, villa y fechas). */
    const box=E('div');
    const chips=chipsBlock(plan.chips,b,function(){ doBookingsCard(b,extraNo); });
    if(chips)box.appendChild(chips);
    box.appendChild(note(T.noBooking));
    const na=noApplyBlock(plan.no);
    if(na)box.appendChild(na);
    const btns=E('div','mia-btns');
    btns.appendChild(btn(T.openEnt,link('entradas',plan.params),true));
    box.appendChild(btns);
    say(box);
    return;
  }
  if(rows.length===1){
    await renderState(rows[0],{chips:plan.chips,no:plan.no,filters:b,onChange:function(){ doBookingsCard(b,extraNo); }});
    return;
  }

  const box=E('div');
  const chips=chipsBlock(plan.chips,b,function(){ doBookingsCard(b,extraNo); });
  if(chips)box.appendChild(chips);
  box.appendChild(note(T.many));
  box.appendChild(resultList(rows,T.openEnt,function(r){ return link('entradas',entradasParamsFor(r)); }));
  if(rows.length>=MAX_ROWS)moreBlock(box,plan,b);
  const na=noApplyBlock(plan.no);
  if(na)box.appendChild(na);
  say(box);
}
/* "quién está el 14" — nunca un enlace de un día. Se lista lo que devuelve
   la consulta de estancia; si la consulta falla, ventana de ±30 días. */
async function doBookingsStay(b,extraNo){
  const plan=bookingsPlan(b); plan.no=plan.no.concat(extraNo||[]);
  let rows;
  try{ rows=await fetchBookings(b,MAX_ROWS,F.checkIn+' DESC'); }
  catch(e){ doBookingsLink(b); return; }
  if(rows===null){ doBookingsLink(b); return; }
  if(rows.length===1){
    await renderState(rows[0],{chips:plan.chips,no:plan.no,filters:b,onChange:function(){ doBookings(b,false,extraNo); }});
    return;
  }

  const box=E('div');
  const chips=chipsBlock(plan.chips,b,function(){ doBookings(b,false,extraNo); });
  if(chips)box.appendChild(chips);
  box.appendChild(note(rows.length?T.many:T.noBooking));
  if(rows.length){
    box.appendChild(resultList(rows,T.openEnt,function(r){ return link('entradas',entradasParamsFor(r)); }));
    if(rows.length>=MAX_ROWS)moreBlock(box,plan,b);
  }
  const na=noApplyBlock(plan.no);
  if(na)box.appendChild(na);
  if(!rows.length){
    /* Ninguna reserva: queda la ventana de ±30 días, que es lo único que
       Entradas sabe entender de una pregunta de estancia. */
    const btns=E('div','mia-btns');
    btns.appendChild(btn(T.openEnt,link('entradas',plan.params),true));
    box.appendChild(btns);
  }
  say(box);
}
async function doBookings(b,card,extraNo){
  if(isDate(b.stay_on)){ await doBookingsStay(b,extraNo); return; }
  /* Con nombre, con código o con manager se consulta y se enseña la ficha o la
     lista: son las tres preguntas cuya respuesta el enlace no puede dar bien
     (el manager lo pisa la preferencia de la página, y sin fechas la ventana
     guardada esconde la reserva). */
  const named=(b.code&&String(b.code).trim())||(b.guest&&String(b.guest).trim());
  const mgr=b.manager?findUser(b.manager).id:'';
  if(card||named||mgr){ await doBookingsCard(b,extraNo); return; }
  doBookingsLink(b,extraNo);
}

/* ════════════════ NOTAS ════════════════ */
async function doNotes(n,extraNo){
  const code=String((n&&n.code)||'').trim();
  const guest=String((n&&n.guest)||'').trim();
  /* Un chip por cada condición aplicada de verdad, igual que en reservas. */
  const chips={};
  if(code)chips.code=code;
  if(guest)chips.guest=guest;
  const again=function(){ doNotes(n,extraNo); };
  const head=function(box){
    const c=chipsBlock(chips,n,again);
    if(c)box.appendChild(c);
  };
  if(code){
    const box=E('div');
    head(box);
    const naC=noApplyBlock(extraNo);
    if(naC)box.appendChild(naC);
    const btns=E('div','mia-btns');
    btns.appendChild(btn(T.openNotes,link('notas',{TaBookings2021_FS_confirmation_code:code}),true));
    box.appendChild(btns);
    say(box);
    return;
  }
  if(!guest){ say(note(T.noBooking)); return; }
  let rows;
  try{ rows=await fetchBookings({guest:guest},MAX_ROWS,F.checkIn+' DESC'); }
  catch(e){ say(note('No he podido leer la reserva.')); return; }
  const box=E('div');
  head(box);
  if(!rows||!rows.length){
    /* Sin reservas no hay notas que abrir: queda el enlace a Entradas con el
       nombre, que es lo único que se pudo aplicar. */
    box.appendChild(note(T.noBooking));
    const naZ=noApplyBlock(extraNo);
    if(naZ)box.appendChild(naZ);
    const btns=E('div','mia-btns');
    btns.appendChild(btn(T.openEnt,link('entradas',bookingsPlan({guest:guest}).params),true));
    box.appendChild(btns);
    say(box);
    return;
  }
  box.appendChild(note(T.many));
  box.appendChild(resultList(rows,T.notes,function(r){
    const c=String(g(r,'confirmCode')||'').trim();
    return c?link('notas',{TaBookings2021_FS_confirmation_code:c}):'';
  }));
  if(rows.length>=MAX_ROWS)moreBlock(box,bookingsPlan({guest:guest}),{guest:guest});
  const naL=noApplyBlock(extraNo);
  if(naL)box.appendChild(naL);
  say(box);
}

/* ════════════════ TAREAS ════════════════ */
function tasksPlan(t){
  const p={}, chips={}, no=[];
  if(t.villa){ p.vi=t.villa; chips.villa=t.villa; }
  if(t.status){
    const est=own(TASK_EST,fold(t.status));
    if(est){ p.est=est; chips.status=t.status; }
    else no.push('estado: '+t.status);   /* "en curso" no existe como filtro de URL */
  }
  if(t.type){
    const bt=own(TASK_BT,fold(t.type));
    if(bt){ p.bt=bt; chips.type=t.type; }
    else no.push('tipo: '+t.type);       /* tt es un id de catálogo: no se inventa */
  }
  /* u SIEMPRE va en la URL, aunque vaya vacío: tareas.html preselecciona al
     usuario que ha entrado (línea 871) y solo lo cambia si la URL trae u
     (línea 1585). Sin u=, "limpiezas pendientes" enseñaba solo las mías. */
  if(t.user){
    const u=findUser(t.user);
    if(u.id){ p.u=u.id; chips.user=t.user; }
    else { p.u=EMPTY; no.push('usuario: '+t.user+(u.many?' (varios)':'')); }
  }else{
    p.u=EMPTY;
  }
  if(isDate(t.from)){ p.fd=t.from; chips.from=t.from; }
  if(isDate(t.to)){ p.fh=t.to; chips.to=t.to; }
  if(t.urgent===true){ p.urg='1'; chips.urgent=true; }
  if(t.important===true){ p.imp='1'; chips.important=true; }
  return {params:p,chips:chips,no:no};
}
function doTasks(t,extraNo){
  const render=function(){
    const plan=tasksPlan(t); plan.no=plan.no.concat(extraNo||[]);
    const box=E('div');
    const chips=chipsBlock(plan.chips,t,render);
    if(chips)box.appendChild(chips);
    box.appendChild(note(T.usedHere));
    const na=noApplyBlock(plan.no);
    if(na)box.appendChild(na);
    const href=link('tareas',plan.params);
    const btns=E('div','mia-btns');
    if(curPage()===PAGES.tareas){
      const go=E('button','mia-btn mia-primary',T.openTar); go.type='button';
      go.addEventListener('click',function(){ location.href=href; });
      btns.appendChild(go);
    }else{
      btns.appendChild(btn(T.openTar,href,true));
    }
    box.appendChild(btns);
    say(box);
  };
  render();
}

/* ════════════════ OCUPACIÓN Y VILLAS ════════════════ */
/* Ocupación no admite ningún filtro por enlace: el enlace va sin parámetros,
   así que NO hay chips que enseñar —un chip diría un filtro que no existe—.
   Lo que se entiende se dice como instrucción ("abre la página y pon…") y lo
   que no (el texto suelto de other) va a "No pude aplicar". */
function doAvailability(a,extraNo){
  const box=E('div');
  const bits=[];
  if(isDate(a.from)||isDate(a.to))bits.push(fmtDate(a.from)+' → '+fmtDate(a.to));
  if(a.pax)bits.push(a.pax+' plazas');
  if(a.pool)bits.push('piscina');
  box.appendChild(note(T.ocuNote+' '+(bits.join(', ')||'—')));
  const na=noApplyBlock((Array.isArray(a.other)?a.other:[]).map(function(o){ return String(o==null?'':o); }).concat(extraNo||[]));
  if(na)box.appendChild(na);
  const btns=E('div','mia-btns');
  btns.appendChild(btn(T.openOcu,link('ocupacion',{}),true));
  box.appendChild(btns);
  say(box);
}
async function doVilla(v){
  const name=String((v&&v.name)||'').trim();
  if(!name){ say(note(T.noVilla)); return; }
  let rows;
  try{ rows=await proxyGet('action=data&table=TaVillas&limit=500'); }
  catch(e){ say(note('No he podido leer las villas.')); return; }
  const q=fold(name);
  const hits=rows.filter(function(r){
    const a=fold(r.Name_villa_para_inquilinos);
    const b=fold(r.Name);
    return (a&&a.indexOf(q)>=0)||(b&&b.indexOf(q)>=0);
  }).slice(0,10);

  if(!hits.length){ say(note(T.noVilla)); return; }
  const box=E('div');
  if(hits.length===1){
    const id=String(hits[0].villaid||'');
    box.appendChild(note(String(hits[0].Name_villa_para_inquilinos||hits[0].Name||name)));
    const btns=E('div','mia-btns');
    if(isId(id))btns.appendChild(btn(T.openVilla,link('villa',{villa_id:id}),true));
    box.appendChild(btns);
  }else{
    box.appendChild(note(T.many));
    const list=E('div','mia-list');
    hits.forEach(function(r){
      const id=String(r.villaid||'');
      const row=E('div','mia-vrow');
      const nm=String(r.Name_villa_para_inquilinos||r.Name||'—');
      /* Mismo criterio que con una sola villa: sin id numérico no hay enlace,
         se enseña el nombre y ya está. */
      if(isId(id)){
        const a=document.createElement('a');
        a.className='mia-vmain';
        a.setAttribute('href',link('villa',{villa_id:id}));
        a.appendChild(E('span','mia-n',nm));
        row.appendChild(a);
      }else{
        const d=E('div','mia-vmain');
        d.appendChild(E('span','mia-n',nm));
        row.appendChild(d);
      }
      list.appendChild(row);
    });
    box.appendChild(list);
  }
  say(box);
}
function doUnknown(data){
  const box=E('div');
  box.appendChild(note(T.unknown));
  const na=noApplyBlock((data&&Array.isArray(data.unmatched))?data.unmatched:[]);
  if(na)box.appendChild(na);
  say(box);
}

/* ════════════════ PREGUNTA ════════════════ */
/* Worker caído o apagado: un aviso y Mia se retira hasta la próxima sesión.
   El panel con el aviso se queda hasta que el usuario lo cierre; la fila
   desaparece y la página queda como si Mia no hubiera estado. */
/* off=true solo cuando el Worker dice enabled:false, que es la palanca de
   apagado. Un 500, un 404, un JSON roto o un fallo de red retiran a Mia de
   ESTA página —fila, panel, botón Aa y el texto grande— pero no marcan la
   sesión: la siguiente página vuelve a intentarlo una vez. */
function fail(off){
  if(!downShown){ downShown=true; say(note(T.down)); }
  if(off)setMiaOff();
  hideRow(true);
}
function kind(k){ const e=new Error(k); e.miaKind=k; return e; }
async function askWorker(q){
  const ctl=new AbortController();
  const to=setTimeout(function(){ ctl.abort(); },TIMEOUT_MS);
  let res;
  try{
    res=await fetch(MIA_WORKER_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+Auth.token()},
      body:JSON.stringify({ q:q, page:curPage(), today:todayISO() }),
      signal:ctl.signal
    });
  }catch(e){
    throw kind(e&&e.name==='AbortError'?'timeout':'red');
  }finally{ clearTimeout(to); }
  if(res.status===401)throw kind('401');
  if(res.status===429)throw kind('429');
  if(res.status===400)throw kind('400');
  if(!res.ok)throw kind('red');
  try{ return await res.json(); }
  catch(e){ throw kind('red'); }
}
async function onAsk(){
  if(!INPUT)return;
  const q=String(INPUT.value||'').trim().slice(0,300);
  if(!q)return;
  ST.q=q;
  say(note(T.loading));
  let data;
  try{ data=await askWorker(q); }
  catch(e){
    const k=e&&e.miaKind;
    /* La fila se queda: estos tres son problemas de un momento, no una
       caída, y culpar al usuario con "no he entendido" sería mentira. */
    if(k==='401'){ say(note(T.expired)); return; }
    if(k==='429'){ say(note(T.busyWait)); return; }
    if(k==='400'){ say(note(T.badQ)); return; }
    if(k==='timeout'){ say(note(T.busy)); return; }
    fail(false); return;   /* red o 5xx: se reintenta en la próxima página */
  }
  if(!data||typeof data!=='object'){ fail(false); return; }
  if(data.enabled===false){ fail(true); return; }   /* apagada a propósito: hasta la próxima sesión */
  if(data.error==='modelo'||data.error==='ocupado'){ say(note(T.busy)); return; }
  const target=String(data.target||'unknown');
  /* Lo que el Worker no supo mapear se dice SIEMPRE, en el camino que sea:
     antes solo salía en la respuesta "no he entendido". */
  const um=(Array.isArray(data.unmatched)?data.unmatched:[]).map(function(x){ return String(x==null?'':x).trim(); }).filter(Boolean);
  try{
    if(target==='bookings'){
      const b=Object.assign({},data.bookings||{});
      await ensureUsers(b.manager);
      const card=data.answer_card==='state'&&((b.code&&String(b.code).trim())||(b.guest&&String(b.guest).trim()));
      await doBookings(b,card,um);
    }
    else if(target==='tasks'){
      const t=Object.assign({},data.tasks||{});
      await ensureUsers(t.user);
      doTasks(t,um);
    }
    else if(target==='notes')await doNotes(Object.assign({},data.notes||{}),um);
    else if(target==='availability')doAvailability(Object.assign({},data.availability||{}),um);
    else if(target==='villa')await doVilla(data.villa||{});
    else doUnknown(data);
  }catch(e){ dbg('render ko'); say(note(T.unknown)); }
}

/* ════════════════ ARRANQUE ════════════════ */
function start(){ try{ mount(); }catch(e){ dbg('mount ko'); } }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

})();
