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
//   · Add-only: no cambia ni una regla CSS de las páginas existentes.
//     El único ajuste es un style inline en los elementos sticky que
//     estaban a top:48px, para que bajen la altura de la fila.
//   · Nunca se pinta ni se registra el código de la caja de llaves:
//     todo campo *Keybox* se borra nada más recibir la respuesta.
//   · Todo valor que venga del Worker o de Caspio entra en el DOM por
//     textContent o por escapeHtml(). Nunca por innerHTML sin escapar.
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
const MIA_DEBUG = false;               // true solo para depurar en local

const PROXY          = 'https://caspio-proxy.jordi-89b.workers.dev';
const VIEW_BOOKINGS  = 'Vi_villas_and_bookings2021';
const VIEW_PAYMENTS  = 'Vi_bookingsall_and_paymen_editb';
const TIMEOUT_MS     = 12000;
const HEAD_H         = 48;             // alto de la cabecera de siempre
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
  openVilla :'Ver villa',
  openOcu   :'Abrir Ocupación',
  noApply   :'No pude aplicar:',
  down      :'Mia no está disponible ahora. Los filtros de siempre funcionan igual.',
  noBooking :'No encuentro esa reserva',
  noVilla   :'No encuentro esa villa',
  many      :'He encontrado varias reservas. Elige una:',
  unknown   :'No he entendido. Prueba con un nombre, un código de reserva, una villa o unas fechas.',
  ocuNote   :'Ocupación no admite filtros por enlace todavía. Abre la página y pon:',
  loading   :'Un momento…',
  close     :'Cerrar',
  guest     :'Huésped', dates:'Fechas', vm:'Villa manager', state:'Estado',
  payments  :'Pagos', concept:'Concepto', date:'Fecha', amount:'Importe', total:'Total',
  nights    :'noches'
};

/* Marca de Mia (SVG en línea; no se usa <use> por el <base href> de varias páginas) */
const MARK = '<svg class="mk" viewBox="0 0 100 100" aria-hidden="true" focusable="false">'
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
/* Escape para valores dentro de un WHERE de Caspio (mismo criterio que las páginas) */
function sq(v){
  return String(v==null?'':v).replace(/[\x00-\x1f\x7f]/g,'').replace(/'/g,"''").slice(0,80);
}
function isDate(v){ return typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function isId(v){ return /^\d{1,12}$/.test(String(v==null?'':v).trim()); }
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

/* Enlaces: solo páginas de la lista blanca y parámetros codificados */
function link(page,params){
  const base=PAGES[page]; if(!base)return null;
  const qs=Object.keys(params||{})
    .filter(function(k){ const v=params[k]; return v!==''&&v!=null; })
    .map(function(k){ return encodeURIComponent(k)+'='+encodeURIComponent(params[k]); })
    .join('&');
  return qs?base+'?'+qs:base;
}
function curPage(){ return location.pathname.split('/').pop(); }

/* ════════════════ SESIÓN ════════════════ */
function hasSession(){
  try{
    if(typeof Auth==='undefined'||!Auth||!Auth.token)return false;
    if(!Auth.token())return false;
    const role=Auth.role?String(Auth.role()||''):'';
    return MIA_ALLOWED_ROLES.indexOf(role)>=0;
  }catch(e){ return false; }
}
function miaOff(){ try{ return sessionStorage.getItem(K_OFF)==='1'; }catch(e){ return false; } }
function setMiaOff(){ try{ sessionStorage.setItem(K_OFF,'1'); }catch(e){} }

/* ════════════════ CSS (solo lo nuevo — add-only) ════════════════ */
const CSS = `
.mia-row{position:sticky;top:${HEAD_H}px;z-index:250;background:#fff;border-bottom:1px solid var(--gray-2,#e8eaed);padding:6px 12px 5px}/* 40+11+1 = 52px de alto */
.mia-row .in{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:8px}
.mia-row .mk{width:30px;height:30px;flex-shrink:0}
.mia-field{flex:1;display:flex;align-items:center;gap:6px;height:40px;border:1.5px solid var(--gray-2,#e8eaed);border-radius:20px;padding:0 5px 0 14px;background:var(--gray-1,#f4f5f7)}
.mia-field:focus-within{border-color:var(--red,#C8102E);background:#fff}
.mia-field input{flex:1;border:none;background:transparent;font-family:inherit;font-size:15px;color:var(--gray-5,#2d3142);min-width:0;outline:none}
.mia-field input::placeholder{color:#6b7180}
.mia-go{height:30px;padding:0 12px;border:none;border-radius:15px;background:var(--red,#C8102E);color:#fff;font-family:Montserrat,sans-serif;font-size:11px;font-weight:800;letter-spacing:.4px;cursor:pointer;flex-shrink:0}
.mia-go:hover{background:var(--red-dark,#9e0c24)}
.aa-tog{font-family:'Atkinson Hyperlegible','Open Sans',sans-serif;background:var(--gray-1,#f4f5f7);border:1.5px solid var(--gray-2,#e8eaed);color:var(--gray-4,#7a8194);width:32px;height:32px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.aa-tog.on{background:var(--gray-5,#2d3142);border-color:var(--gray-5,#2d3142);color:#fff}

.mia-panel{display:none;background:#fff;border-bottom:2px solid var(--gray-2,#e8eaed);padding:12px 16px 14px;font-size:16px;line-height:1.5;--muted:#5c6273;color:var(--gray-5,#2d3142)}
.mia-panel.show{display:block}
.mia-panel .in{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.mia-top{display:flex;align-items:center;gap:8px}
.mia-top .mk{width:30px;height:30px;flex-shrink:0}
.mia-top .q{flex:1;font-size:15px;color:var(--muted)}
.mia-top .q b{color:var(--gray-5,#2d3142);font-weight:600}
.mia-close{width:44px;height:44px;border:1.5px solid var(--gray-2,#e8eaed);border-radius:50%;background:#fff;color:var(--muted);font-size:16px;cursor:pointer;flex-shrink:0}
.mchips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.mchips .lb{font-size:14px;font-weight:600;color:var(--muted)}
.mchip{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:var(--red,#C8102E);background:var(--red-light,#fce8eb);border:1.5px solid rgba(200,16,46,.25);border-radius:22px;padding:5px 5px 5px 12px;min-height:36px}
.mchip .x{width:26px;height:26px;border-radius:50%;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;background:rgba(200,16,46,.12);color:var(--red,#C8102E);font-size:11px;font-weight:900;line-height:1}
.mia-panel .note-line{font-size:15px;color:var(--muted);max-width:62ch}
.mcard{background:#fff;border:1px solid var(--gray-2,#e8eaed);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden}
.mcard-h{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--red,#C8102E);color:#fff}
.mcard-h .t{font-family:Montserrat,sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;flex:1;line-height:1.2}
.mcard-h .id{font-family:Montserrat,sans-serif;font-size:12px;font-weight:800;background:rgba(255,255,255,.2);padding:2px 8px;border-radius:20px;white-space:nowrap}
.mcard-b{padding:14px 14px 16px;display:flex;flex-direction:column;gap:12px}
.mia-panel .kv{display:grid;grid-template-columns:100px 1fr;gap:8px 12px;font-size:16px;line-height:1.5}
.mia-panel .kv .k{font-size:14px;font-weight:600;color:var(--muted);padding-top:2px}
.mia-panel .kv .v{color:var(--gray-5,#2d3142)}
.mia-panel .sec{font-size:15px;font-weight:600;color:var(--gray-5,#2d3142);padding-bottom:6px;border-bottom:1px solid var(--gray-2,#e8eaed);margin-bottom:8px}
.mia-panel .states{display:flex;flex-wrap:wrap;gap:6px}
.mia-panel .st{display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:600;border-radius:22px;padding:6px 12px;min-height:36px;border:1.5px solid var(--gray-2,#e8eaed);background:#fff;color:var(--gray-5,#2d3142)}
.mia-panel .st.ok{border-color:rgba(30,158,78,.35);background:var(--green-light,#e6f7ee);color:var(--green,#1e9e4e)}
.mia-panel .st.pend{border-color:rgba(224,123,0,.35);background:var(--orange-light,#fff4e0);color:var(--orange,#e07b00)}
.mia-panel .pay{width:100%;border-collapse:collapse;font-size:15px;font-variant-numeric:tabular-nums}
.mia-panel .pay th{font-size:14px;font-weight:600;color:var(--muted);text-align:left;padding:4px 0 6px;border-bottom:1px solid var(--gray-2,#e8eaed)}
.mia-panel .pay td{padding:9px 0;border-bottom:1px solid var(--gray-1,#f4f5f7);vertical-align:top}
.mia-panel .pay td.n{text-align:right;white-space:nowrap}
.mia-panel .btns{display:flex;flex-wrap:wrap;gap:8px}
.mia-panel .h-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:44px;padding:0 16px;border-radius:8px;border:1.5px solid var(--gray-2,#e8eaed);background:#fff;color:var(--gray-5,#2d3142);font-family:Montserrat,sans-serif;font-size:13px;font-weight:800;letter-spacing:.2px;cursor:pointer;text-decoration:none;text-transform:uppercase}
.mia-panel .h-btn.primary{background:var(--red,#C8102E);border-color:var(--red,#C8102E);color:#fff}
.mia-panel .villas{display:flex;flex-direction:column;gap:6px}
.mia-panel .vrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--gray-2,#e8eaed);border-radius:10px;background:#fff;text-align:left;width:100%;font-family:inherit;font-size:15px;cursor:pointer;min-height:44px}
.mia-panel .vrow .n{font-family:Montserrat,sans-serif;font-weight:800;font-size:15px;flex:1}
.mia-panel .vrow .m{font-size:14px;color:var(--muted)}
.mia-panel .foot{font-size:13px;color:var(--muted)}

/* ── Aa: texto más legible. Opt-in, apagado por defecto. ── */
body.easy{--gray-4:#5c6273;--gray-3:#a9afbb;font-family:'Atkinson Hyperlegible','Open Sans',sans-serif;font-size:16px}
body.easy .h-title{font-size:15px}
body.easy .h-count,body.easy .user-pill{font-size:13px}
body.easy .f-label,body.easy .pill-label,body.easy .date-box .lbl,body.easy .ilbl,body.easy .c-toggle,body.easy .tipo-badge,body.easy .ph-line .ph-tag,body.easy .villa-name,body.easy .bdg,body.easy .spill{text-transform:none;letter-spacing:0}
body.easy .f-label,body.easy .pill-label,body.easy .date-box .lbl,body.easy .ilbl{font-size:13px;font-weight:600;font-family:inherit}
body.easy .pill-opt,body.easy .btn-mas,body.easy .chip-filter,body.easy .bdg,body.easy .lnk,body.easy .act-chip,body.easy .ph-line,body.easy .villa-sub,body.easy .res-id,body.easy .spill,body.easy .c-toggle{font-size:13px}
body.easy .pill-opt{padding:6px 12px}
body.easy .staff-row,body.easy .irow,body.easy .ppill{font-size:15px}
body.easy .ival{font-weight:400}
body.easy .villa-name{font-size:16px;font-weight:800}
body.easy .date-box .val{font-size:17px}
body.easy .gname{font-size:17px}
body.easy .ph-line{font-family:inherit;font-weight:600}
body.easy .card{box-shadow:0 1px 4px rgba(0,0,0,.06);border:1px solid var(--gray-2,#e8eaed)}
body.easy .c-toggle{min-height:44px}
body.easy .act-chip{min-height:36px;padding:6px 12px}
body.easy .mia-field input{font-size:17px}
body.easy .mia-panel,body.easy .mia-panel .kv,body.easy .mia-panel .st,body.easy .mia-panel .pay,body.easy .mchip,body.easy .mia-panel .note-line{font-family:'Atkinson Hyperlegible','Open Sans',sans-serif}
body.easy .mia-panel{font-size:17px}
`;

/* ════════════════ ESTADO DEL MÓDULO ════════════════ */
let ROW=null, PANEL=null, BODY=null, INPUT=null, AABTN=null;
let ST={ q:'', data:null, filters:null, target:'unknown' };
let USERS=null;         // mapa UserID → Name (se pide una sola vez)
let downShown=false;

/* ════════════════ TEXTO MÁS LEGIBLE (Aa) ════════════════ */
let fontLoaded=false;
function loadEasyFont(){
  if(fontLoaded)return; fontLoaded=true;
  const l=document.createElement('link');
  l.rel='stylesheet';
  l.href='https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap';
  document.head.appendChild(l);
}
function setEasy(on){
  document.body.classList.toggle('easy',!!on);
  if(AABTN)AABTN.classList.toggle('on',!!on);
  if(on)loadEasyFont();
  try{ localStorage.setItem(K_EASY,on?'1':'0'); }catch(e){}
}
function easyOn(){ try{ return localStorage.getItem(K_EASY)==='1'; }catch(e){ return false; } }

/* ════════════════ SHIM DE STICKY ════════════════ */
/* Los elementos que estaban pegados a top:48px bajan la altura de la fila.
   Se hace con style inline: el CSS de las páginas no se toca. */
function shimSticky(){
  if(!ROW)return;
  const h=Math.round(ROW.getBoundingClientRect().height);
  if(!h)return;
  const top=(HEAD_H+h)+'px';
  const all=document.querySelectorAll('*');
  for(let i=0;i<all.length;i++){
    const el=all[i];
    if(el===ROW)continue;
    if(el.getAttribute('data-mia-shim')){ el.style.top=top; continue; }
    let cs;
    try{ cs=getComputedStyle(el); }catch(e){ continue; }
    if(cs.position!=='sticky')continue;
    if(cs.top!==HEAD_H+'px')continue;
    el.setAttribute('data-mia-shim','1');
    el.style.top=top;
  }
}

/* ════════════════ MONTAJE ════════════════ */
function anchor(){
  return document.querySelector('nav.top-nav')
      || document.querySelector('nav.wp-nav')
      || document.querySelector('header')
      || document.querySelector('nav');
}
function buildRow(){
  const row=E('div','mia-row'); row.id='miaRow';
  const inn=E('div','in');
  const mk=E('span'); mk.innerHTML=MARK; inn.appendChild(mk.firstChild);
  const field=E('div','mia-field');
  const inp=document.createElement('input');
  inp.type='text'; inp.id='miaInput'; inp.autocomplete='off';
  inp.setAttribute('placeholder',T.ph); inp.setAttribute('aria-label',T.ph);
  inp.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); onAsk(); } });
  const go=E('button','mia-go',T.go); go.type='button';
  go.addEventListener('click',onAsk);
  field.appendChild(inp); field.appendChild(go);
  inn.appendChild(field); row.appendChild(inn);
  INPUT=inp;
  return row;
}
function buildPanel(){
  const p=E('div','mia-panel'); p.id='miaPanel';
  const inn=E('div','in'); inn.id='miaPanelIn';
  p.appendChild(inn); BODY=inn;
  return p;
}
function buildAa(){
  const b=E('button','aa-tog','Aa');
  b.type='button'; b.id='miaAa'; b.title=T.aa; b.setAttribute('aria-label',T.aa);
  b.addEventListener('click',function(){ setEasy(!document.body.classList.contains('easy')); });
  return b;
}
function placeAa(a){
  AABTN=buildAa();
  const btns=document.querySelector('.nav-btns')||document.querySelector('.wp-nav-btns');
  if(btns){
    const menu=btns.querySelector('.nav-menu-btn,.wp-nav-menu,.nav-hamburger');
    if(menu)btns.insertBefore(AABTN,menu); else btns.appendChild(AABTN);
    return;
  }
  a.appendChild(AABTN);
}
function hideRow(keepPanel){
  if(ROW&&ROW.parentNode)ROW.parentNode.removeChild(ROW);
  ROW=null; INPUT=null;
  if(!keepPanel){
    if(PANEL&&PANEL.parentNode)PANEL.parentNode.removeChild(PANEL);
    PANEL=null; BODY=null;
  }
  /* Devolver los sticky a su sitio */
  const shimmed=document.querySelectorAll('[data-mia-shim]');
  for(let i=0;i<shimmed.length;i++){ shimmed[i].style.top=''; shimmed[i].removeAttribute('data-mia-shim'); }
}

function mount(){
  if(!hasSession())return;
  if(miaOff())return;
  const a=anchor();
  if(!a||!a.parentNode)return;

  const style=E('style'); style.id='miaStyles'; style.textContent=CSS;
  document.head.appendChild(style);

  ROW=buildRow();
  PANEL=buildPanel();
  a.parentNode.insertBefore(ROW,a.nextSibling);
  ROW.parentNode.insertBefore(PANEL,ROW.nextSibling);
  placeAa(a);

  if(easyOn())setEasy(true);

  shimSticky();
  let rt=null;
  window.addEventListener('resize',function(){ clearTimeout(rt); rt=setTimeout(shimSticky,120); });
}

/* ════════════════ PANEL ════════════════ */
function openPanel(){ if(PANEL)PANEL.classList.add('show'); }
function closePanel(){ if(PANEL)PANEL.classList.remove('show'); if(BODY)BODY.textContent=''; }
function clearPanel(){ if(BODY)BODY.textContent=''; }

function panelHead(){
  const top=E('div','mia-top');
  const mk=E('span'); mk.innerHTML=MARK; top.appendChild(mk.firstChild);
  const q=E('div','q');
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
  clearPanel();
  BODY.appendChild(panelHead());
  if(node)BODY.appendChild(node);
  BODY.appendChild(E('div','foot',T.onlyRead));
  openPanel();
}
function note(txt){ return E('div','note-line',txt); }

/* ════════════════ CHIPS ════════════════ */
/* Etiquetas de los filtros que Mia puede quitar */
const CHIP_LABELS = {
  code:'Reserva', guest:'Inquilino', villa:'Villa', check_in_from:'Desde', check_in_to:'Hasta',
  stay_on:'En estancia el', manager:'Manager', source:'Source', cleaner:'Limpieza', tipo:'Tipo',
  type:'Tipo', status:'Estado', user:'Usuario', from:'Desde', to:'Hasta',
  urgent:'Urgente', important:'Importante', pax:'Plazas', pool:'Piscina'
};
function chipText(k,v){
  const lbl=CHIP_LABELS[k]||k;
  if(v===true)return lbl;
  if(isDate(v))return lbl+': '+fmtDate(v);
  return lbl+': '+v;
}
function chipsBlock(filters,onChange){
  const keys=Object.keys(filters).filter(function(k){
    const v=filters[k];
    return v!==''&&v!=null&&v!==false&&!(Array.isArray(v)&&!v.length);
  });
  if(!keys.length)return null;
  const wrap=E('div','mchips');
  wrap.appendChild(E('span','lb',T.filters));
  keys.forEach(function(k){
    const c=E('span','mchip');
    c.appendChild(document.createTextNode(chipText(k,filters[k])));
    const x=E('button','x','✕');
    x.type='button'; x.title=T.close; x.setAttribute('aria-label',T.close+' '+(CHIP_LABELS[k]||k));
    x.addEventListener('click',function(){ delete filters[k]; onChange(); });
    c.appendChild(x);
    wrap.appendChild(c);
  });
  return wrap;
}
function btn(label,href,primary){
  const a=document.createElement('a');
  a.className='h-btn'+(primary?' primary':'');
  a.textContent=label;
  a.setAttribute('href',href);
  return a;
}

/* ════════════════ CASPIO (lectura con el token del usuario) ════════════════ */
/* Toda respuesta pasa por aquí: los campos Keybox se borran nada más parsear. */
function stripKeybox(rows){
  for(let i=0;i<rows.length;i++){
    const r=rows[i]; if(!r||typeof r!=='object')continue;
    const ks=Object.keys(r);
    for(let j=0;j<ks.length;j++){ if(ks[j].toLowerCase().indexOf('keybox')>=0)delete r[ks[j]]; }
  }
  return rows;
}
async function proxyGet(qs){
  const res=await fetch(Auth.url(PROXY+'?'+qs));
  const json=await res.json();
  const rows=stripKeybox(json.Result||json.result||[]);
  if(json.error)throw new Error(String(json.error));
  return rows;
}
async function loadUsers(){
  if(USERS)return USERS;
  USERS=new Map();
  try{
    const rows=await proxyGet('action=data&table=TaUsers&limit=200');
    rows.forEach(function(u){ USERS.set(String(u[U.id]||''),String(u[U.name]||'')); });
  }catch(e){ dbg('TaUsers ko'); }
  return USERS;
}

/* ════════════════ WHERE de reservas ════════════════ */
/* Mismos operadores y escapado que buildWhere() de entradas-equipo.
   OJO con la trampa de fechas: stay_on = Checkin <= día AND Checkout >= día. */
function bookingsWhere(b){
  const parts=[];
  const code=(b.code||'').trim(), guest=(b.guest||'').trim(), villa=(b.villa||'').trim();
  if(!code)parts.push(F.status+"<>'cancelled'");
  if(code)parts.push(F.confirmCode+" LIKE '%"+sq(code)+"%'");
  if(villa)parts.push(F.villaName+" LIKE '%"+sq(villa)+"%'");
  if(guest){
    const q=sq(guest);
    let c=F.guestName+" LIKE '%"+q+"%' OR "+F.guestEmail+" LIKE '%"+q+"%' OR "+F.secondEmail+" LIKE '%"+q+"%'";
    const words=guest.split(/\s+/).filter(Boolean).slice(0,4);
    if(words.length>1){
      c+=' OR ('+words.map(function(w){ return F.guestName+" LIKE '%"+sq(w)+"%'"; }).join(' AND ')+')';
      c+=' OR ('+words.map(function(w){ return '('+F.fiscalName+" LIKE '%"+sq(w)+"%' OR "+F.fiscalSurname+" LIKE '%"+sq(w)+"%')"; }).join(' AND ')+')';
    }
    parts.push('('+c+')');
  }
  if(isDate(b.stay_on)){
    parts.push('('+F.checkIn+"<='"+b.stay_on+"T23:59:59' AND "+F.checkOut+">='"+b.stay_on+"T00:00:00')");
  }else{
    if(isDate(b.check_in_from))parts.push(F.checkIn+">='"+b.check_in_from+"T00:00:00'");
    if(isDate(b.check_in_to))parts.push(F.checkIn+"<='"+b.check_in_to+"T23:59:59'");
  }
  if(isId(b.manager))parts.push(F.villaManager+"='"+sq(b.manager)+"'");
  if(isId(b.cleaner))parts.push(F.cleaner+'='+sq(b.cleaner));
  if(b.source)parts.push(F.portalName+"='"+sq(b.source)+"'");
  return parts.join(' AND ');
}

/* ════════════════ FICHA DE ESTADO ════════════════ */
function statePill(label,val){
  const ok=isOk(val);
  const st=E('span','st'+(ok===true?' ok':ok===false?' pend':''));
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
  box.appendChild(E('div','sec',T.payments));
  if(!rows.length){ box.appendChild(note('Sin líneas de pago.')); return box; }
  let total=0, html='<tr><th>'+escapeHtml(T.concept)+'</th><th>'+escapeHtml(T.date)+'</th><th class="n">'+escapeHtml(T.amount)+'</th></tr>';
  rows.forEach(function(r){
    const n=parseFloat(r[PAY.amount]); if(!isNaN(n))total+=n;
    html+='<tr><td>'+escapeHtml(payConcept(r))+'</td><td>'+escapeHtml(fmtDate(r[PAY.date]))
        +'</td><td class="n">'+escapeHtml(fmtEUR(r[PAY.amount]))+'</td></tr>';
  });
  html+='<tr><td><b>'+escapeHtml(T.total)+'</b></td><td></td><td class="n"><b>'+escapeHtml(fmtEUR(total))+'</b></td></tr>';
  const t=E('table','pay'); t.innerHTML=html;
  box.appendChild(t);
  return box;
}
function kvRow(kv,k,v){ kv.appendChild(E('span','k',k)); kv.appendChild(E('span','v',v)); }

async function renderState(r){
  const code=String(g(r,'confirmCode')||'');
  const villa=String(g(r,'villaName')||'—');
  const card=E('div','mcard');
  const head=E('div','mcard-h');
  head.appendChild(E('span','t',villa));
  if(code)head.appendChild(E('span','id',code));
  card.appendChild(head);
  const body=E('div','mcard-b'); card.appendChild(body);

  /* Datos */
  const kv=E('div','kv');
  const pax=(parseInt(g(r,'adults'),10)||0)+(parseInt(g(r,'children'),10)||0);
  const gline=[g(r,'guestName'),pax?pax+' pax':'',g(r,'portalName')].filter(Boolean).join(' · ');
  kvRow(kv,T.guest,gline||'—');
  const nights=g(r,'nights');
  kvRow(kv,T.dates,fmtDate(g(r,'checkIn'))+' → '+fmtDate(g(r,'checkOut'))+(nights?' · '+nights+' '+T.nights:''));
  const mgrId=String(g(r,'villaManager')||'').trim();
  if(mgrId){
    const users=await loadUsers();
    const nm=users.get(mgrId);
    if(nm)kvRow(kv,T.vm,nm);   /* si no hay nombre, no se pinta el id a secas */
  }
  body.appendChild(kv);

  /* Estados */
  const secSt=E('div');
  secSt.appendChild(E('div','sec',T.state));
  const sts=E('div','states');
  const stName=String(g(r,'statusNameFormula')||g(r,'status')||'').trim();
  if(stName)sts.appendChild(E('span','st','· '+stName));
  const ciRaw=g(r,'checkinPend');
  const ciPend=Number(ciRaw)===3;
  const ci=E('span','st'+(ciPend?' pend':(isOk(ciRaw)===true?' ok':'')));
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

  /* Pagos */
  const payBox=E('div');
  payBox.appendChild(note(T.loading));
  body.appendChild(payBox);

  /* Botones */
  const btns=E('div','btns');
  const guest=String(g(r,'guestName')||'').trim();
  const desde=addDays(dOnly(g(r,'checkIn')),-1);
  const hasta=addDays(dOnly(g(r,'checkOut')),1);
  const entParams={desde:desde,hasta:hasta};
  if(guest)entParams.inq=guest; else if(code)entParams.cod=code;
  btns.appendChild(btn(T.openEnt,link('entradas',entParams),true));
  if(code)btns.appendChild(btn(T.openNotes,link('notas',{TaBookings2021_FS_confirmation_code:code})));
  const vid=String(g(r,'villaId')||'').trim();
  if(isId(vid))btns.appendChild(btn(T.openVilla,link('villa',{villa_id:vid})));
  body.appendChild(btns);

  say(card);

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

/* ════════════════ OBJETIVOS ════════════════ */
async function doBookingsCard(b){
  const where=bookingsWhere(b);
  if(!where){ say(note(T.noBooking)); return; }
  let rows;
  try{
    rows=await proxyGet('action=view&view='+encodeURIComponent(VIEW_BOOKINGS)
      +'&where='+encodeURIComponent(where)+'&limit=5');
  }catch(e){ say(note('No he podido leer la reserva.')); return; }

  if(!rows.length){
    const box=E('div');
    box.appendChild(note(T.noBooking));
    const chips=chipsBlock(b,function(){ doBookingsCard(b); });
    if(chips)box.insertBefore(chips,box.firstChild);
    say(box);
    return;
  }
  if(rows.length===1){ await renderState(rows[0]); return; }

  const box=E('div');
  box.appendChild(note(T.many));
  const list=E('div','villas');
  rows.forEach(function(r){
    const row=E('button','vrow'); row.type='button';
    row.appendChild(E('span','n',String(g(r,'villaName')||'—')));
    row.appendChild(E('span','m',String(g(r,'guestName')||'')+' · '
      +fmtDate(g(r,'checkIn'))+' → '+fmtDate(g(r,'checkOut'))));
    row.addEventListener('click',function(){ renderState(r); });
    list.appendChild(row);
  });
  box.appendChild(list);
  say(box);
}

function bookingsParams(b){
  const p={};
  if(b.code)p.cod=b.code;
  if(b.guest)p.inq=b.guest;
  if(b.villa)p.villa=b.villa;
  if(isDate(b.stay_on)){ p.desde=b.stay_on; p.hasta=b.stay_on; }
  else{ if(isDate(b.check_in_from))p.desde=b.check_in_from; if(isDate(b.check_in_to))p.hasta=b.check_in_to; }
  if(isId(b.manager))p.mgr=b.manager;
  if(['all','pend'].indexOf(b.ci)>=0)p.ci=b.ci;
  if(['all','pending'].indexOf(b.wp)>=0)p.wp=b.wp;
  if(['all','pending'].indexOf(b.cierr)>=0)p.cierr=b.cierr;
  if(['both','entrada','salida'].indexOf(b.tipo)>=0)p.tipo=b.tipo;
  return p;
}
function doBookingsLink(b){
  const render=function(){
    const box=E('div');
    const chips=chipsBlock(b,render);
    if(chips)box.appendChild(chips);
    box.appendChild(note(T.usedHere));
    const href=link('entradas',bookingsParams(b));
    const btns=E('div','btns');
    if(curPage()===PAGES.entradas){
      const go=E('button','h-btn primary',T.openEnt); go.type='button';
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
function tasksParams(t){
  const p={};
  if(t.villa)p.vi=t.villa;
  if(t.type)p.tt=t.type;
  if(['all','pend','done'].indexOf(t.status)>=0)p.est=t.status;
  if(isId(t.user))p.u=t.user;
  if(isDate(t.from))p.fd=t.from;
  if(isDate(t.to))p.fh=t.to;
  return p;
}
function doTasks(t){
  const render=function(){
    const box=E('div');
    const chips=chipsBlock(t,render);
    if(chips)box.appendChild(chips);
    box.appendChild(note(T.usedHere));
    const href=link('tareas',tasksParams(t));
    const btns=E('div','btns');
    if(curPage()===PAGES.tareas){
      const go=E('button','h-btn primary',T.openTar); go.type='button';
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
function doAvailability(a){
  const render=function(){
    const box=E('div');
    const chips=chipsBlock(a,render);
    if(chips)box.appendChild(chips);
    const bits=[];
    if(isDate(a.from)||isDate(a.to))bits.push(fmtDate(a.from)+' → '+fmtDate(a.to));
    if(a.pax)bits.push(a.pax+' plazas');
    if(a.pool)bits.push('piscina');
    (Array.isArray(a.other)?a.other:[]).forEach(function(o){ if(o)bits.push(String(o)); });
    box.appendChild(note(T.ocuNote+' '+(bits.join(', ')||'—')));
    const btns=E('div','btns');
    btns.appendChild(btn(T.openOcu,link('ocupacion',{}),true));
    box.appendChild(btns);
    say(box);
  };
  render();
}
async function doVilla(v){
  const name=String((v&&v.name)||'').trim();
  if(!name){ say(note(T.noVilla)); return; }
  let rows;
  try{ rows=await proxyGet('action=data&table=TaVillas&limit=500'); }
  catch(e){ say(note('No he podido leer las villas.')); return; }
  const q=name.toLowerCase();
  const hits=rows.filter(function(r){
    const a=String(r.Name_villa_para_inquilinos||'').toLowerCase();
    const b=String(r.Name||'').toLowerCase();
    return (a&&a.indexOf(q)>=0)||(b&&b.indexOf(q)>=0);
  }).slice(0,10);

  if(!hits.length){ say(note(T.noVilla)); return; }
  const box=E('div');
  if(hits.length===1){
    const id=String(hits[0].villaid||'');
    box.appendChild(note(String(hits[0].Name_villa_para_inquilinos||hits[0].Name||name)));
    const btns=E('div','btns');
    if(isId(id))btns.appendChild(btn(T.openVilla,link('villa',{villa_id:id}),true));
    box.appendChild(btns);
  }else{
    box.appendChild(note(T.many));
    const list=E('div','villas');
    hits.forEach(function(r){
      const id=String(r.villaid||'');
      const a=document.createElement('a');
      a.className='vrow';
      a.setAttribute('href',link('villa',{villa_id:id})||'#');
      a.appendChild(E('span','n',String(r.Name_villa_para_inquilinos||r.Name||'—')));
      list.appendChild(a);
    });
    box.appendChild(list);
  }
  say(box);
}
function doUnknown(data){
  const box=E('div');
  box.appendChild(note(T.unknown));
  const um=(data&&Array.isArray(data.unmatched))?data.unmatched.filter(Boolean):[];
  if(um.length)box.appendChild(note(T.noApply+' '+um.map(String).join(', ')));
  say(box);
}

/* ════════════════ PREGUNTA ════════════════ */
/* Worker caido, lento o apagado: un aviso y Mia se retira hasta la proxima sesion.
   El panel con el aviso se queda hasta que el usuario lo cierre; la fila desaparece. */
function fail(){
  if(!downShown){ downShown=true; say(note(T.down)); }
  setMiaOff();
  hideRow(true);
}
async function askWorker(q){
  const ctl=new AbortController();
  const to=setTimeout(function(){ ctl.abort(); },TIMEOUT_MS);
  try{
    const res=await fetch(MIA_WORKER_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+Auth.token()},
      body:JSON.stringify({ q:q, page:curPage(), today:todayISO() }),
      signal:ctl.signal
    });
    if(!res.ok)throw new Error('HTTP '+res.status);
    return await res.json();
  }finally{ clearTimeout(to); }
}
async function onAsk(){
  if(!INPUT)return;
  const q=String(INPUT.value||'').trim().slice(0,300);
  if(!q)return;
  ST.q=q;
  say(note(T.loading));
  let data;
  try{ data=await askWorker(q); }
  catch(e){ dbg('worker ko'); fail(); return; }
  if(!data||typeof data!=='object'){ fail(); return; }
  if(data.enabled===false){ closePanel(); setMiaOff(); hideRow(false); return; }
  ST.data=data;
  const target=String(data.target||'unknown');
  try{
    if(target==='bookings'){
      const b=Object.assign({},data.bookings||{});
      const wantsCard=data.answer_card==='state'&&((b.code&&String(b.code).trim())||(b.guest&&String(b.guest).trim()));
      if(wantsCard)await doBookingsCard(b); else doBookingsLink(b);
    }
    else if(target==='tasks')doTasks(Object.assign({},data.tasks||{}));
    else if(target==='availability')doAvailability(Object.assign({},data.availability||{}));
    else if(target==='villa')await doVilla(data.villa||{});
    else doUnknown(data);
  }catch(e){ dbg('render ko'); say(note(T.unknown)); }
}

/* ════════════════ ARRANQUE ════════════════ */
function start(){ try{ mount(); }catch(e){ dbg('mount ko'); } }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();

})();
