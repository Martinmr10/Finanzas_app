(() => {
  'use strict';

  // ===================== Configuración =====================
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_KEY || cfg.SUPABASE_KEY.startsWith('PEGA')) {
    document.body.innerHTML =
      '<p style="padding:24px;font-family:system-ui">Falta configurar <code>config.js</code> con la URL y la clave pública de Supabase.</p>';
    return;
  }

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
  const TZ = 'America/Guayaquil';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
  const fDia = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  const fCorta = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, day: 'numeric', month: 'short' });
  const fHora = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  const fISO = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fCompleta = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, dateStyle: 'long', timeStyle: 'short' });

  // ===================== Utilidades =====================
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  const fmtMoney = (n) => money.format(Math.abs(Number(n) || 0));
  const fmtSigned = (n) => (Number(n) < 0 ? '−' : '') + fmtMoney(n);

  function hoy() {
    const [y, m, d] = fISO.format(new Date()).split('-').map(Number);
    return { y, m, d };
  }
  const mesKey = ({ y, m }) => `${y}-${pad(m)}-01`;
  const mesSiguiente = ({ y, m }) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 });
  const mesAnterior = ({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 });
  const nombreMes = ({ y, m }) => `${cap(MESES[m - 1])} ${y}`;
  const esMesActual = (mes) => mesKey(mes) === mesKey(hoy());

  function parseMonto(txt) {
    const limpio = String(txt).replace(/\s|\$/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d{1,2})?$/.test(limpio)) return NaN;
    return Math.round(parseFloat(limpio) * 100) / 100;
  }

  function fechaLocalAhora() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function saludo() {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()));
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  let toastTimer;
  function toast(msg, esError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('error', esError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function setBusy(btn, busy, texto) {
    if (!btn) return;
    if (busy) {
      btn.dataset.texto = btn.textContent;
      btn.textContent = texto;
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.texto || btn.textContent;
      btn.disabled = false;
    }
  }

  function mostrarError(form, msg) {
    const p = $('.form-error', form);
    if (!p) return;
    p.textContent = msg || '';
    p.hidden = !msg;
  }

  const cajaError = (msg) =>
    `<div class="error-box"><strong>No se pudieron cargar los datos.</strong><p class="hint">${esc(msg)}</p></div>`;

  // Guardar preferencias locales sin romper si el navegador lo bloquea
  const local = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

  // ===================== Estado =====================
  const state = {
    user: null,
    view: 'inicio',
    cuentas: [],
    categorias: [],
    mes: hoy(),
    filtro: 'todos',
    q: '',
    movs: new Map(),
    anMes: null,
    anCuenta: '',
  };

  // ===================== Guía de instalación (iPhone) =====================
  function htmlGuiaInstalar() {
    const ua = navigator.userAgent;
    const esIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const instalada = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (!esIOS || instalada || local.get('guia_instalar_cerrada')) return '';
    const enInstagram = /Instagram|FBAN|FBAV/.test(ua);
    const pasos = enInstagram
      ? '<li>Toca los tres puntos arriba a la derecha.</li><li>Elige «Abrir en el navegador».</li><li>Desde Safari, sigue los pasos para añadirla a tu pantalla de inicio.</li>'
      : '<li>Toca el botón Compartir de Safari.</li><li>Elige «Añadir a pantalla de inicio».</li><li>Abre la app desde el icono nuevo y entra con tu correo.</li>';
    return `<section class="guia">
      <h2>Instálala en tu iPhone</h2>
      <ol>${pasos}</ol>
      <button type="button" class="link" data-cerrar-guia>Ahora no</button>
    </section>`;
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cerrar-guia]');
    if (!b) return;
    local.set('guia_instalar_cerrada', '1');
    b.closest('.guia')?.remove();
  });

  // ===================== Login =====================
  let loginEmail = '';

  function mensajeAuth(error) {
    const m = (error?.message || '').toLowerCase();
    if (error?.status === 429 || m.includes('rate') || m.includes('seconds') || m.includes('segundos'))
      return 'Espera un minuto antes de pedir otro código.';
    if (m.includes('database error') || m.includes('no autorizado') || m.includes('not authorized') || m.includes('signups not allowed'))
      return 'Este correo no tiene acceso a la app.';
    if (m.includes('expired') || m.includes('invalid') || m.includes('token'))
      return 'El código no es válido o ya caducó. Pide uno nuevo.';
    return 'No se pudo completar: ' + (error?.message || 'error desconocido');
  }

  function errorLogin(msg) {
    const p = $('#login-error');
    p.textContent = msg || '';
    p.hidden = !msg;
  }

  function mostrarLogin() {
    $('#app').hidden = true;
    $('#pantalla-login').hidden = false;
    $('#login-instalar').innerHTML = htmlGuiaInstalar();
    $('#form-email').hidden = false;
    $('#form-codigo').hidden = true;
    errorLogin('');
  }

  $('#form-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorLogin('');
    const email = $('#login-email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorLogin('Escribe un correo válido.');
    const btn = $('button[type="submit"]', e.currentTarget);
    setBusy(btn, true, 'Enviando…');
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(btn, false);
    if (error) return errorLogin(mensajeAuth(error));
    loginEmail = email;
    $('#login-destino').textContent = email;
    $('#form-email').hidden = true;
    $('#form-codigo').hidden = false;
    $('#login-codigo').value = '';
    $('#login-codigo').focus();
  });

  $('#form-codigo').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorLogin('');
    const token = $('#login-codigo').value.replace(/\D/g, '');
    if (token.length !== 6) return errorLogin('Escribe los 6 dígitos del código.');
    const btn = $('button[type="submit"]', e.currentTarget);
    setBusy(btn, true, 'Comprobando…');
    const { error } = await sb.auth.verifyOtp({ email: loginEmail, token, type: 'email' });
    setBusy(btn, false);
    if (error) errorLogin(mensajeAuth(error));
    // Si sale bien, onAuthStateChange se encarga de entrar.
  });

  $('#login-otro').addEventListener('click', () => {
    $('#form-codigo').hidden = true;
    $('#form-email').hidden = false;
    errorLogin('');
    $('#login-email').focus();
  });

  sb.auth.onAuthStateChange((_evento, session) => {
    if (session?.user) {
      if (state.user?.id !== session.user.id) {
        state.user = session.user;
        // setTimeout evita llamar a Supabase dentro del propio callback de auth
        setTimeout(entrar, 0);
      }
    } else {
      state.user = null;
      mostrarLogin();
    }
  });

  // ===================== Entrada a la app =====================
  async function entrar() {
    $('#pantalla-login').hidden = true;
    $('#app').hidden = false;
    state.mes = hoy();
    const email = state.user?.email || '';
    $('#side-avatar').textContent = (email[0] || '?').toUpperCase();
    $('#side-nombre').textContent = cap(email.split('@')[0].replace(/[._-]+/g, ' '));
    $('#side-email').textContent = email;
    await cargarCatalogo();
    irA('inicio');

    // Accesos directos del icono en Android: ?nuevo=Gasto / ?nuevo=Ingreso
    const nuevo = new URLSearchParams(location.search).get('nuevo');
    if (nuevo === 'Gasto' || nuevo === 'Ingreso') {
      history.replaceState(null, '', location.pathname);
      abrirNuevo(nuevo);
    }
  }

  async function cargarCatalogo() {
    const [c, k] = await Promise.all([
      sb.from('cuentas').select('id,nombre,tipo,activa,orden,cupo,dia_corte,fecha_pago').order('orden').order('nombre'),
      sb.from('categorias').select('id,nombre,tipo,activa,orden,especial').order('orden').order('nombre'),
    ]);
    if (c.error || k.error) toast('No se pudieron cargar cuentas y categorías.', true);
    state.cuentas = c.data || [];
    state.categorias = k.data || [];
  }

  function irA(vista) {
    state.view = vista;
    $$('.vista').forEach((v) => { v.hidden = v.id !== `vista-${vista}`; });
    $$('.tabs [data-go], .side-nav [data-go]').forEach((b) => {
      if (b.dataset.go === vista) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    refrescar();
  }

  function refrescar() {
    if (!state.user) return;
    if (state.view === 'inicio') renderInicio();
    else if (state.view === 'movimientos') renderMovimientos();
    else if (state.view === 'analisis') renderAnalisis();
    else if (state.view === 'ajustes') renderAjustes();
  }

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) irA(go.dataset.go);
  });

  // Al volver a la app (por ejemplo, después de usar el atajo), recargar datos
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refrescar();
  });

  // ===================== Fila de movimiento =====================
  function estiloMov(m) {
    const monto = Number(m.monto);
    if (m.tipo === 'Pago') return { clase: 'pago', icono: '⇄', signo: '' };
    const clase = m.tipo === 'Gasto' ? 'gasto' : m.tipo === 'Ingreso' ? 'ingreso' : 'ajuste';
    const signo = m.tipo === 'Gasto' || monto < 0 ? '−' : '+';
    return { clase, icono: signo, signo };
  }

  function filaMov(m) {
    state.movs.set(String(m.id), m);
    const monto = Number(m.monto);
    const { clase, icono, signo } = estiloMov(m);
    const sub = m.tipo === 'Ajuste' ? `Ajuste en ${esc(m.cuenta)}`
      : m.tipo === 'Pago' ? `Pago de ${esc(m.cuenta_destino)} desde ${esc(m.cuenta)}`
      : `${esc(m.categoria)}, ${esc(m.cuenta)}`;
    const d = new Date(m.fecha);
    return `<li><button type="button" class="mov" data-mov="${esc(m.id)}">
      <span class="mov-sign ${clase}" aria-hidden="true">${icono}</span>
      <span class="mov-txt"><span class="mov-concepto">${esc(m.concepto)}</span><span class="mov-sub">${sub}</span></span>
      <span class="mov-der"><span class="mov-monto num ${clase}">${signo}${fmtMoney(monto)}</span><span class="mov-hora">${esc(fCorta.format(d))}, ${esc(fHora.format(d))}</span></span>
    </button></li>`;
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mov]');
    if (b) abrirDetalle(b.dataset.mov);
  });

  // ===================== Inicio =====================
  let seqInicio = 0;
  async function renderInicio() {
    const v = $('#vista-inicio');
    const mi = ++seqInicio;
    const mesHoy = hoy();

    const [r, s, u] = await Promise.all([
      sb.from('resumen_mensual').select('*').eq('mes', mesKey(mesHoy)).maybeSingle(),
      sb.from('saldos').select('*').order('orden'),
      sb.from('movimientos_detalle').select('*').order('fecha', { ascending: false }).limit(6),
    ]);
    if (mi !== seqInicio) return;
    const err = r.error || s.error || u.error;
    if (err) { v.innerHTML = cajaError(err.message); return; }

    const res = r.data || { ingresos: 0, gastos: 0, balance: 0, n_movimientos: 0 };
    const ing = Number(res.ingresos);
    const gas = Number(res.gastos);
    const total = ing + gas;
    const pIng = total > 0 ? (ing / total) * 100 : 0;
    const saldos = s.data || [];
    const patrimonio = saldos.reduce((a, x) => a + Number(x.saldo), 0);
    const activas = saldos.filter((x) => x.activa);
    const ultimos = u.data || [];

    const alertas = activas.filter((c) => c.tipo === 'credito').map((c) => {
      const f = infoFechas(c.cuenta_id, Number(c.utilizado));
      if (!f || f.dias == null || Number(c.utilizado) <= 0) return '';
      if (f.dias > 3 && f.dias >= 0) return '';
      const cuando = f.dias < 0 ? `venció el ${f.fecha}` : f.dias === 0 ? 'vence hoy' : f.dias === 1 ? 'vence mañana' : `vence el ${f.fecha}`;
      return `<div class="alerta" role="alert"><strong>Paga ${esc(c.nombre)}</strong>: ${esc(cuando)}. Debes ${fmtMoney(c.utilizado)}.</div>`;
    }).join('');

    v.innerHTML = `
      ${htmlGuiaInstalar()}
      ${alertas}
      <header class="top">
        <p class="top-sub">${esc(saludo())}</p>
        <h1>${esc(nombreMes(mesHoy))}</h1>
      </header>

      <div class="inicio-grid">
      <section class="hero a-hero" aria-label="Balance del mes">
        <p class="hero-label">Balance del mes</p>
        <p class="hero-num num">${fmtSigned(res.balance)}</p>
        <div class="split" aria-hidden="true">
          ${total > 0
            ? `<span class="split-ing" style="width:${pIng}%"></span><span class="split-gas" style="width:${100 - pIng}%"></span>`
            : ''}
        </div>
        <div class="hero-legend">
          <div><span><i class="dot dot-ing"></i>Ingresos</span><strong class="num">${fmtMoney(ing)}</strong></div>
          <div><span><i class="dot dot-gas"></i>Gastos</span><strong class="num">${fmtMoney(gas)}</strong></div>
        </div>
      </section>

      <section class="block a-cuentas">
        <div class="block-head">
          <h2>Tus cuentas</h2>
          <span class="total num ${patrimonio < 0 ? 'neg' : ''}">${fmtSigned(patrimonio)}</span>
        </div>
        <ul class="list">
          ${activas.map(filaCuentaInicio).join('')}
        </ul>
        ${patrimonio < 0 ? '<p class="hint">¿Saldo negativo? En Ajustes puedes indicar cuánto tienes hoy en cada cuenta.</p>' : ''}
      </section>

      <section class="block a-movs">
        <div class="block-head">
          <h2>Últimos movimientos</h2>
          ${ultimos.length ? '<button type="button" class="link" data-go="movimientos">Ver todos</button>' : ''}
        </div>
        ${ultimos.length
          ? `<ul class="list">${ultimos.map(filaMov).join('')}</ul>`
          : '<p class="vacio">Aún no hay movimientos. Registra el primero con el botón + o con el atajo del iPhone.</p>'}
      </section>
      </div>`;
  }

  // ---------- Fechas de la tarjeta ----------
  const fechaDe = ({ y, m, d }) => new Date(`${y}-${pad(m)}-${pad(d)}T12:00:00-05:00`);
  const ultimoDia = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const diasEntre = (a, b) => Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);

  function proximoCorte(dia) {
    const h = hoy();
    const esteMes = Math.min(dia, ultimoDia(h.y, h.m));
    if (h.d <= esteMes) return { y: h.y, m: h.m, d: esteMes };
    const sig = mesSiguiente(h);
    return { y: sig.y, m: sig.m, d: Math.min(dia, ultimoDia(sig.y, sig.m)) };
  }

  function infoFechas(cuentaId, deuda) {
    const cfgCuenta = state.cuentas.find((x) => x.id === Number(cuentaId));
    if (!cfgCuenta) return null;
    const partes = [];
    let urgente = false;
    let pagoTxt = null;
    if (cfgCuenta.dia_corte) partes.push(`Corte ${fCorta.format(fechaDe(proximoCorte(cfgCuenta.dia_corte)))}`);
    if (cfgCuenta.fecha_pago) {
      const [y, m, d] = cfgCuenta.fecha_pago.split('-').map(Number);
      const fp = { y, m, d };
      const dias = diasEntre(hoy(), fp);
      const fecha = fCorta.format(fechaDe(fp));
      if (dias < 0) pagoTxt = `La fecha de pago (${fecha}) ya pasó: actualízala`;
      else if (dias === 0) pagoTxt = `Hoy es el último día de pago`;
      else if (dias === 1) pagoTxt = `Pagar hasta mañana, ${fecha}`;
      else pagoTxt = `Pagar hasta el ${fecha} (en ${dias} días)`;
      urgente = deuda > 0 && dias <= 3;
      partes.push(pagoTxt);
      return { texto: partes.join('. '), urgente, dias, fecha };
    }
    return partes.length ? { texto: partes.join('. '), urgente: false, dias: null } : null;
  }

  function estadoTarjeta(c) {
    const saldo = Number(c.saldo);
    if (saldo < 0) return { texto: `Debes ${fmtMoney(-saldo)}`, clase: 'neg' };
    if (saldo > 0) return { texto: `Saldo a favor ${fmtMoney(saldo)}`, clase: 'ingreso' };
    return { texto: 'Sin deuda', clase: '' };
  }

  function filaCuentaInicio(c) {
    if (c.tipo === 'credito') {
      const sub = c.cupo == null
        ? 'Configura el cupo en Ajustes'
        : `Disponible ${fmtMoney(c.disponible)} de ${fmtMoney(c.cupo)}`;
      const f = infoFechas(c.cuenta_id, Number(c.utilizado));
      return `<li class="row">
        <span class="row-main">${esc(c.nombre)}<span class="row-sub num">${esc(sub)}</span>${f ? `<span class="row-sub ${f.urgente ? 'neg' : ''}">${esc(f.texto)}</span>` : ''}</span>
        <span class="num ${estadoTarjeta(c).clase}">${estadoTarjeta(c).texto}</span>
      </li>`;
    }
    return `<li class="row">
      <span class="row-main">${esc(c.nombre)}</span>
      <span class="num ${Number(c.saldo) < 0 ? 'neg' : ''}">${fmtSigned(c.saldo)}</span>
    </li>`;
  }

  // ===================== Movimientos =====================
  let seqMov = 0;
  let timerBusqueda;

  function montarMovimientos(v) {
    v.innerHTML = `
      <div class="mes-nav">
        <button type="button" class="icon-btn" id="mes-ant" aria-label="Mes anterior">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>
        </button>
        <h1 id="mes-titulo"></h1>
        <button type="button" class="icon-btn" id="mes-sig" aria-label="Mes siguiente">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </button>
      </div>
      <div class="buscar">
        <input id="mov-buscar" type="search" aria-label="Buscar movimientos" placeholder="Buscar por concepto, cuenta o categoría" autocomplete="off">
      </div>
      <div class="chips" role="group" aria-label="Filtrar">
        <button type="button" class="chip" data-filtro="todos" aria-pressed="true">Todos</button>
        <button type="button" class="chip" data-filtro="Gasto" aria-pressed="false">Gastos</button>
        <button type="button" class="chip" data-filtro="Ingreso" aria-pressed="false">Ingresos</button>
        <button type="button" class="chip" data-filtro="Pago" aria-pressed="false">Pagos de tarjeta</button>
        <button type="button" class="chip" data-filtro="Ajuste" aria-pressed="false">Ajustes</button>
      </div>
      <div id="mov-resumen" class="resumen-mov"></div>
      <div id="mov-lista"></div>`;

    $('#mes-ant', v).addEventListener('click', () => { state.mes = mesAnterior(state.mes); renderMovimientos(); });
    $('#mes-sig', v).addEventListener('click', () => {
      if (esMesActual(state.mes)) return;
      state.mes = mesSiguiente(state.mes);
      renderMovimientos();
    });
    $('#mov-buscar', v).addEventListener('input', (e) => {
      clearTimeout(timerBusqueda);
      timerBusqueda = setTimeout(() => { state.q = e.target.value; renderMovimientos(); }, 300);
    });
    $$('[data-filtro]', v).forEach((b) => b.addEventListener('click', () => {
      state.filtro = b.dataset.filtro;
      $$('[data-filtro]', v).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderMovimientos();
    }));
    v.dataset.montada = '1';
  }

  async function renderMovimientos() {
    const v = $('#vista-movimientos');
    if (!v.dataset.montada) montarMovimientos(v);
    const mi = ++seqMov;

    $('#mes-titulo').textContent = nombreMes(state.mes);
    $('#mes-sig').disabled = esMesActual(state.mes);

    let q = sb.from('movimientos_detalle').select('*')
      .gte('dia', mesKey(state.mes))
      .lt('dia', mesKey(mesSiguiente(state.mes)))
      .order('fecha', { ascending: false })
      .limit(500);
    if (state.filtro !== 'todos') q = q.eq('tipo', state.filtro);
    const termino = state.q.replace(/[%,()"*\\]/g, ' ').trim();
    if (termino) q = q.or(`concepto.ilike."%${termino}%",categoria.ilike."%${termino}%",cuenta.ilike."%${termino}%",cuenta_destino.ilike."%${termino}%"`);

    const { data, error } = await q;
    if (mi !== seqMov) return;
    const lista = $('#mov-lista');
    if (error) { lista.innerHTML = cajaError(error.message); $('#mov-resumen').innerHTML = ''; return; }

    const movs = data || [];
    const normales = movs.filter((m) => m.tipo === 'Ingreso' || m.tipo === 'Gasto');
    const ing = normales.filter((m) => m.tipo === 'Ingreso').reduce((a, m) => a + Number(m.monto), 0);
    const gas = normales.filter((m) => m.tipo === 'Gasto').reduce((a, m) => a + Number(m.monto), 0);

    $('#mov-resumen').innerHTML = `
      <span>${normales.length} ${normales.length === 1 ? 'movimiento' : 'movimientos'}</span>
      <span><strong class="num ingreso">+${fmtMoney(ing)}</strong>&nbsp;&nbsp;<strong class="num gasto">−${fmtMoney(gas)}</strong></span>`;

    if (!movs.length) {
      lista.innerHTML = `<p class="vacio">${termino || state.filtro !== 'todos'
        ? 'No hay movimientos que coincidan con la búsqueda.'
        : 'No hay movimientos en este mes.'}</p>`;
      return;
    }

    const porDia = new Map();
    movs.forEach((m) => {
      if (!porDia.has(m.dia)) porDia.set(m.dia, []);
      porDia.get(m.dia).push(m);
    });

    lista.innerHTML = [...porDia.entries()].map(([dia, items]) => {
      const neto = items.filter((m) => m.tipo === 'Ingreso' || m.tipo === 'Gasto')
        .reduce((a, m) => a + (m.tipo === 'Gasto' ? -Number(m.monto) : Number(m.monto)), 0);
      const etiqueta = cap(fDia.format(new Date(`${dia}T12:00:00-05:00`)));
      return `<section class="dia">
        <div class="dia-head"><span>${esc(etiqueta)}</span><span class="num">${fmtSigned(neto)}</span></div>
        <ul class="list">${items.map(filaMov).join('')}</ul>
      </section>`;
    }).join('');
  }

  // ===================== Análisis =====================
  let seqAn = 0;

  function opcionesMeses() {
    const lista = [];
    let m = hoy();
    for (let i = 0; i < 24; i++) { lista.push(m); m = mesAnterior(m); }
    return lista;
  }

  function montarAnalisis(v) {
    v.innerHTML = `
      <header class="top">
        <p class="top-sub">Tu dinero, con contexto</p>
        <h1>Análisis</h1>
      </header>
      <div class="filtros">
        <label class="field"><span>Periodo</span><select id="an-mes"></select></label>
        <label class="field"><span>Cuenta</span><select id="an-cuenta"></select></label>
      </div>
      <div id="an-contenido"></div>`;
    $('#an-mes', v).innerHTML = opcionesMeses().map((m, i) =>
      `<option value="${mesKey(m)}">${i === 0 ? `Mes actual (${nombreMes(m)})` : nombreMes(m)}</option>`).join('');
    $('#an-mes', v).addEventListener('change', (e) => { state.anMes = e.target.value; renderAnalisis(); });
    $('#an-cuenta', v).addEventListener('change', (e) => { state.anCuenta = e.target.value; renderAnalisis(); });
    v.addEventListener('click', (e) => {
      const b = e.target.closest('.cat-btn');
      if (b) toggleCategoria(b);
    });
    v.dataset.montada = '1';
  }

  function mesDeKey(key) {
    const [y, m] = key.split('-').map(Number);
    return { y, m };
  }

  async function renderAnalisis() {
    const v = $('#vista-analisis');
    if (!v.dataset.montada) montarAnalisis(v);
    const mi = ++seqAn;

    const selCuenta = $('#an-cuenta');
    selCuenta.innerHTML = '<option value="">Todas las cuentas</option>' +
      state.cuentas.map((c) => `<option value="${c.id}">${esc(c.nombre)}${c.activa ? '' : ' (inactiva)'}</option>`).join('');
    selCuenta.value = state.anCuenta || '';
    if (!state.anMes) state.anMes = mesKey(hoy());
    $('#an-mes').value = state.anMes;

    let q = sb.from('categorias_por_mes').select('*').eq('mes', state.anMes);
    if (state.anCuenta) q = q.eq('cuenta_id', Number(state.anCuenta));
    const { data, error } = await q;
    if (mi !== seqAn) return;
    const cont = $('#an-contenido');
    if (error) { cont.innerHTML = cajaError(error.message); return; }

    const filas = data || [];
    const suma = (tipo) => filas.filter((f) => f.tipo === tipo).reduce((a, f) => a + Number(f.total), 0);
    const ing = suma('Ingreso');
    const gas = suma('Gasto');
    const bal = ing - gas;
    const n = filas.reduce((a, f) => a + Number(f.n_movimientos), 0);
    const mayor = Math.max(ing, gas);

    const porCat = new Map();
    filas.filter((f) => f.tipo === 'Gasto').forEach((f) => {
      const x = porCat.get(f.categoria_id) || { id: f.categoria_id, nombre: f.categoria, total: 0, n: 0 };
      x.total += Number(f.total);
      x.n += Number(f.n_movimientos);
      porCat.set(f.categoria_id, x);
    });
    const cats = [...porCat.values()].sort((a, b) => b.total - a.total);
    const top = cats[0]?.total || 0;

    const cuentaNombre = state.cuentas.find((c) => String(c.id) === String(state.anCuenta))?.nombre;
    const estado = n === 0
      ? { frase: 'No hay movimientos en este periodo', badge: 'Sin datos', clase: '' }
      : bal >= 0
        ? { frase: 'Estás gastando menos de lo que ingresas', badge: 'Positivo', clase: 'badge-ok' }
        : { frase: 'Tus gastos superan tus ingresos', badge: 'A revisar', clase: 'badge-mal' };

    cont.innerHTML = `
      <section class="balance-card">
        <div class="balance-top">
          <div>
            <p class="eyebrow">Balance del periodo</p>
            <p class="balance-frase">${esc(estado.frase)}</p>
          </div>
          <span class="badge ${estado.clase}">${esc(estado.badge)}</span>
        </div>
        <p class="balance-num num ${bal < 0 ? 'neg' : bal > 0 ? 'ingreso' : ''}">${fmtSigned(bal)}</p>
        <p class="hint">Ingresos menos gastos${cuentaNombre ? ` en ${esc(cuentaNombre)}` : ''}, ${esc(nombreMes(mesDeKey(state.anMes)).toLowerCase())}</p>
        <div class="balance-partes">
          <div class="parte">
            <span class="parte-label"><i class="dot" style="background:var(--ingreso)"></i>Ingresos</span>
            <strong class="num">${fmtMoney(ing)}</strong>
            <span class="barra"><span class="barra-ing" style="width:${mayor ? (ing / mayor) * 100 : 0}%"></span></span>
          </div>
          <div class="parte">
            <span class="parte-label"><i class="dot" style="background:var(--gasto)"></i>Gastos</span>
            <strong class="num">${fmtMoney(gas)}</strong>
            <span class="barra"><span class="barra-gas" style="width:${mayor ? (gas / mayor) * 100 : 0}%"></span></span>
          </div>
        </div>
        <p class="hint">${n} ${n === 1 ? 'movimiento incluido' : 'movimientos incluidos'} en el cálculo. Los pagos de tarjeta y los ajustes no cuentan.</p>
      </section>

      <section class="block">
        <div class="block-head">
          <h2>Dónde se va tu dinero</h2>
          ${cats.length ? '<span class="hint" style="margin:0">Toca una categoría para ver sus gastos</span>' : ''}
        </div>
        ${cats.length
          ? `<ul class="list cats">${cats.map((c, i) => `
            <li>
              <button type="button" class="cat-btn" data-cat="${esc(c.id)}" aria-expanded="false">
                <span class="cat-rank">${i + 1}</span>
                <span class="cat-main">
                  <span class="cat-nombre">${esc(c.nombre)}</span>
                  <span class="cat-sub">${gas > 0 ? Math.round((c.total / gas) * 100) : 0}% del gasto, ${c.n} ${c.n === 1 ? 'movimiento' : 'movimientos'}</span>
                  <span class="barra"><span class="barra-gas" style="width:${top ? (c.total / top) * 100 : 0}%"></span></span>
                </span>
                <span class="cat-total num">${fmtMoney(c.total)}</span>
              </button>
              <div class="cat-detalle" hidden></div>
            </li>`).join('')}</ul>`
          : '<p class="vacio">No hay gastos en este periodo.</p>'}
      </section>`;
  }

  async function toggleCategoria(btn) {
    const detalle = btn.nextElementSibling;
    const abierto = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!abierto));
    detalle.hidden = abierto;
    if (abierto || detalle.dataset.cargado) return;

    detalle.innerHTML = '<p class="hint cat-cargando">Cargando…</p>';
    const mes = mesDeKey(state.anMes);
    let q = sb.from('movimientos_detalle').select('*')
      .eq('categoria_id', Number(btn.dataset.cat))
      .eq('tipo', 'Gasto')
      .gte('dia', mesKey(mes))
      .lt('dia', mesKey(mesSiguiente(mes)))
      .order('fecha', { ascending: false });
    if (state.anCuenta) q = q.eq('cuenta_id', Number(state.anCuenta));
    const { data, error } = await q;
    if (error) { detalle.innerHTML = cajaError(error.message); return; }
    detalle.innerHTML = `<ul class="list sub-list">${(data || []).map(filaMov).join('')}</ul>`;
    detalle.dataset.cargado = '1';
  }

  // ===================== Ajustes =====================
  let seqAj = 0;
  async function renderAjustes() {
    const v = $('#vista-ajustes');
    const mi = ++seqAj;
    const [s, t] = await Promise.all([
      sb.from('saldos').select('*').order('orden'),
      sb.from('tokens_atajo').select('id,nombre,sufijo,created_at,last_used_at').order('created_at'),
    ]);
    if (mi !== seqAj) return;
    const err = s.error || t.error;
    if (err) { v.innerHTML = cajaError(err.message); return; }

    const cuentas = (s.data || []).filter((c) => c.activa);
    const tokens = t.data || [];

    v.innerHTML = `
      <header class="top"><h1>Ajustes</h1></header>
      <p class="perfil">Sesión iniciada como <strong>${esc(state.user?.email)}</strong></p>

      <section class="block">
        <div class="block-head"><h2>Saldo de tus cuentas</h2></div>
        <ul class="list">
          ${cuentas.map(filaCuentaAjustes).join('')}
        </ul>
        <p class="hint">Si un saldo no coincide con la realidad, indica cuánto hay hoy (o cuánto debes en la tarjeta) y se registra la diferencia.</p>
      </section>

      <section class="block">
        <div class="block-head"><h2>Atajo del iPhone</h2></div>
        ${tokens.length
          ? `<ul class="list">${tokens.map((k) => `<li class="cuenta-row">
              <span class="row-main">${esc(k.nombre)}
                <span class="row-sub">Código •••${esc(k.sufijo)}, ${k.last_used_at ? 'último uso ' + esc(fCorta.format(new Date(k.last_used_at))) : 'sin usar todavía'}</span>
              </span>
              <button type="button" class="btn-small" data-desconectar="${esc(k.id)}" data-nombre="${esc(k.nombre)}">Desconectar</button>
            </li>`).join('')}</ul>`
          : '<p class="vacio">No tienes dispositivos conectados.</p>'}
        <button type="button" class="btn btn-ghost" id="btn-conectar">Conectar un iPhone</button>
      </section>

      <button type="button" class="btn btn-danger" id="btn-salir">Cerrar sesión</button>`;

    $('#btn-conectar', v).addEventListener('click', abrirToken);
    $('#btn-salir', v).addEventListener('click', async () => {
      await sb.auth.signOut();
      state.movs.clear();
    });
    $$('[data-fechas]', v).forEach((b) => b.addEventListener('click', () => abrirFechas(b.dataset.fechas, b.dataset.nombre)));
    $$('[data-ajustar]', v).forEach((b) => b.addEventListener('click', () =>
      abrirSaldo(b.dataset.ajustar, b.dataset.nombre, b.dataset.modo, b.dataset.actual)));
    $$('[data-desconectar]', v).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(`¿Desconectar «${b.dataset.nombre}»? Su atajo dejará de funcionar.`)) return;
      const { error } = await sb.from('tokens_atajo').delete().eq('id', b.dataset.desconectar);
      if (error) return toast('No se pudo desconectar: ' + error.message, true);
      toast('Dispositivo desconectado');
      renderAjustes();
    }));
  }

  function filaCuentaAjustes(c) {
    const id = esc(c.cuenta_id);
    const nombre = esc(c.nombre);
    if (c.tipo === 'credito') {
      const estado = estadoTarjeta(c).texto;
      const detalle = c.cupo == null
        ? `${estado}. Sin cupo configurado`
        : `Cupo ${fmtMoney(c.cupo)}. ${estado}. Disponible ${fmtMoney(c.disponible)}`;
      const f = infoFechas(c.cuenta_id, Number(c.utilizado));
      return `<li class="cuenta-row cuenta-credito">
        <span class="row-main">${nombre} <span class="etiqueta">Crédito</span>
          <span class="row-sub num">${esc(detalle)}</span>
          <span class="row-sub ${f?.urgente ? 'neg' : ''}">${esc(f ? f.texto : 'Sin fechas de corte y pago')}</span>
        </span>
        <span class="botones">
          <button type="button" class="btn-small" data-ajustar="${id}" data-nombre="${nombre}" data-modo="cupo" data-actual="${esc(c.cupo ?? '')}">Cupo</button>
          <button type="button" class="btn-small" data-ajustar="${id}" data-nombre="${nombre}" data-modo="deuda">Deuda</button>
          <button type="button" class="btn-small" data-fechas="${id}" data-nombre="${nombre}">Fechas</button>
        </span>
      </li>`;
    }
    return `<li class="cuenta-row">
      <span class="row-main">${nombre}<span class="row-sub num ${Number(c.saldo) < 0 ? 'neg' : ''}">${fmtSigned(c.saldo)}</span></span>
      <button type="button" class="btn-small" data-ajustar="${id}" data-nombre="${nombre}" data-modo="saldo">Actualizar</button>
    </li>`;
  }

  // ===================== Hojas: comportamiento común =====================
  $$('dialog.sheet').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-cerrar]')) d.close();
    });
  });

  // ===================== Hoja: nuevo movimiento =====================
  const formNuevo = $('#form-nuevo');

  function tipoNuevo() {
    return $('input[name="tipo"]:checked', formNuevo).value;
  }

  function categoriaElegida() {
    return state.categorias.find((c) => String(c.id) === $('#nuevo-categoria').value);
  }

  function llenarCuentas() {
    const esPago = categoriaElegida()?.especial === 'pago_tarjeta';
    const previa = $('#nuevo-cuenta').value;
    const cuentas = state.cuentas.filter((c) => c.activa && !(esPago && c.tipo === 'credito'));
    $('#nuevo-cuenta').innerHTML = cuentas.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
    if (cuentas.some((c) => String(c.id) === previa)) $('#nuevo-cuenta').value = previa;

    const aviso = $('#nuevo-aviso');
    aviso.hidden = !esPago;
    $('#nuevo-cuenta-label').textContent = esPago ? 'Pagar desde' : 'Cuenta';
    state.deudaTarjeta = null;
    if (esPago) mostrarDeudaTarjeta();
  }

  async function mostrarDeudaTarjeta() {
    const aviso = $('#nuevo-aviso');
    const tarjeta = state.cuentas.find((c) => c.activa && c.tipo === 'credito');
    if (!tarjeta) { aviso.textContent = 'No tienes una tarjeta de crédito registrada.'; return; }
    aviso.textContent = `Consultando la deuda de ${tarjeta.nombre}…`;
    const { data, error } = await sb.from('saldos').select('saldo').eq('cuenta_id', tarjeta.id).maybeSingle();
    if (categoriaElegida()?.especial !== 'pago_tarjeta') return;
    if (error || !data) {
      aviso.textContent = `Se descuenta de la cuenta elegida y baja la deuda de ${tarjeta.nombre}.`;
      return;
    }
    const saldo = Number(data.saldo);
    state.deudaTarjeta = Math.max(-saldo, 0);
    aviso.textContent = saldo < 0
      ? `Deuda actual de ${tarjeta.nombre}: ${fmtMoney(-saldo)}. El pago se descuenta de la cuenta elegida y no cuenta como gasto.`
      : `${tarjeta.nombre} no tiene deuda registrada${saldo > 0 ? ` (saldo a favor ${fmtMoney(saldo)})` : ''}. Si sí debes, primero actualiza la deuda en Ajustes.`;
  }

  function llenarSelects() {
    const tipo = tipoNuevo();
    const cats = state.categorias.filter((c) => c.activa && c.tipo === tipo);
    $('#nuevo-categoria').innerHTML = cats.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
    llenarCuentas();
  }

  function abrirNuevo(tipo = 'Gasto') {
    formNuevo.reset();
    $(`input[name="tipo"][value="${tipo}"]`, formNuevo).checked = true;
    llenarSelects();
    $('#nuevo-fecha').value = fechaLocalAhora();
    mostrarError(formNuevo, '');
    $('#sheet-nuevo').showModal();
    setTimeout(() => $('#nuevo-monto').focus(), 50);
  }

  $('#btn-nuevo').addEventListener('click', () => abrirNuevo('Gasto'));
  $('#btn-nuevo-side').addEventListener('click', () => abrirNuevo('Gasto'));
  $$('input[name="tipo"]', formNuevo).forEach((r) => r.addEventListener('change', llenarSelects));
  $('#nuevo-categoria').addEventListener('change', llenarCuentas);

  formNuevo.addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrarError(formNuevo, '');
    const tipo = tipoNuevo();
    const monto = parseMonto($('#nuevo-monto').value);
    const concepto = $('#nuevo-concepto').value.trim();
    const cuentaId = Number($('#nuevo-cuenta').value);
    const categoriaId = Number($('#nuevo-categoria').value);
    const fechaTxt = $('#nuevo-fecha').value;

    if (!(monto > 0)) return mostrarError(formNuevo, 'Escribe un monto mayor que 0, por ejemplo 12,50.');
    if (!concepto) return mostrarError(formNuevo, 'Escribe un concepto.');
    if (!cuentaId || !categoriaId) return mostrarError(formNuevo, 'Elige una cuenta y una categoría.');
    const fecha = fechaTxt ? new Date(fechaTxt) : new Date();
    if (isNaN(fecha)) return mostrarError(formNuevo, 'La fecha no es válida.');
    const pagoTarjeta = categoriaElegida()?.especial === 'pago_tarjeta';
    if (pagoTarjeta && state.deudaTarjeta != null && monto > state.deudaTarjeta) {
      const msg = state.deudaTarjeta === 0
        ? 'La tarjeta no tiene deuda registrada. Si pagas, quedará como saldo a favor. ¿Continuar?'
        : `Estás pagando ${fmtMoney(monto)} y la deuda registrada es ${fmtMoney(state.deudaTarjeta)}. ¿Continuar?`;
      if (!confirm(msg)) return;
    }

    const btn = $('button[type="submit"]', formNuevo);
    setBusy(btn, true, 'Guardando…');
    const { error } = await sb.from('movimientos').insert({
      fecha: fecha.toISOString(),
      concepto,
      monto,
      tipo,
      cuenta_id: cuentaId,
      categoria_id: categoriaId,
      origen: 'app',
    });
    setBusy(btn, false);
    if (error) return mostrarError(formNuevo, 'No se pudo guardar: ' + error.message);

    $('#sheet-nuevo').close();
    const esPago = categoriaElegida()?.especial === 'pago_tarjeta';
    toast(esPago ? `Pago de tarjeta de ${fmtMoney(monto)} registrado` : `${tipo} de ${fmtMoney(monto)} registrado`);
    refrescar();
  });

  // ===================== Hoja: detalle =====================
  function abrirDetalle(id) {
    const m = state.movs.get(String(id));
    if (!m) return;
    const monto = Number(m.monto);
    const { clase, signo } = estiloMov(m);
    const esPago = m.tipo === 'Pago';
    const origen = { app: 'Desde la app', atajo: 'Desde el atajo', ajuste: 'Ajuste de saldo' }[m.origen] || m.origen;

    $('#detalle-contenido').innerHTML = `
      <div class="sheet-head">
        <h2 id="detalle-titulo">${esc(m.concepto)}</h2>
        <button type="button" class="icon-btn" data-cerrar aria-label="Cerrar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <p class="detalle-monto num ${clase}">${signo}${fmtMoney(monto)}</p>
      <dl class="detalle-lista">
        <div><dt>Tipo</dt><dd>${esPago ? 'Pago de tarjeta' : esc(m.tipo)}</dd></div>
        ${m.categoria && !esPago ? `<div><dt>Categoría</dt><dd>${esc(m.categoria)}</dd></div>` : ''}
        <div><dt>${esPago ? 'Desde' : 'Cuenta'}</dt><dd>${esc(m.cuenta)}</dd></div>
        ${esPago ? `<div><dt>Tarjeta pagada</dt><dd>${esc(m.cuenta_destino)}</dd></div>` : ''}
        <div><dt>Fecha</dt><dd>${esc(fCompleta.format(new Date(m.fecha)))}</dd></div>
        <div><dt>Registrado</dt><dd>${esc(origen)}</dd></div>
      </dl>
      <button type="button" class="btn btn-danger" id="btn-eliminar">Eliminar movimiento</button>`;

    $('#btn-eliminar').addEventListener('click', async () => {
      if (!confirm('¿Eliminar este movimiento? No se puede deshacer.')) return;
      const { error } = await sb.from('movimientos').delete().eq('id', m.id);
      if (error) return toast('No se pudo eliminar: ' + error.message, true);
      $('#sheet-detalle').close();
      toast('Movimiento eliminado');
      refrescar();
    });
    $('#sheet-detalle').showModal();
  }

  // ===================== Hoja: ajustar saldo =====================
  const formSaldo = $('#form-saldo');
  let saldoCuentaId = null;
  let saldoModo = 'saldo';

  const TEXTOS_SALDO = {
    saldo: {
      titulo: 'Actualizar saldo',
      pregunta: (n) => `¿Cuánto hay ahora en ${n}?`,
      etiqueta: 'Saldo real hoy',
      ayuda: 'Se registra la diferencia como un ajuste. No cuenta como ingreso ni como gasto.',
    },
    deuda: {
      titulo: 'Actualizar deuda',
      pregunta: (n) => `¿Cuánto debes hoy en ${n}?`,
      etiqueta: 'Deuda actual',
      ayuda: 'Revisa tu estado de cuenta o la app del banco. Se registra la diferencia como un ajuste.',
    },
    cupo: {
      titulo: 'Cupo de la tarjeta',
      pregunta: (n) => `¿Cuál es el cupo total de ${n}?`,
      etiqueta: 'Cupo total',
      ayuda: 'Es el límite que te da el banco. El disponible se calcula restando lo que debes.',
    },
  };

  function abrirSaldo(cuentaId, nombre, modo = 'saldo', actual = '') {
    saldoCuentaId = Number(cuentaId);
    saldoModo = TEXTOS_SALDO[modo] ? modo : 'saldo';
    const t = TEXTOS_SALDO[saldoModo];
    formSaldo.reset();
    mostrarError(formSaldo, '');
    $('#saldo-titulo').textContent = t.titulo;
    $('#saldo-pregunta').textContent = t.pregunta(nombre);
    $('#saldo-etiqueta').textContent = t.etiqueta;
    $('#saldo-ayuda').textContent = t.ayuda;
    $('#saldo-monto').value = saldoModo === 'cupo' && actual ? String(actual).replace('.', ',') : '';
    $('#sheet-saldo').showModal();
    setTimeout(() => $('#saldo-monto').focus(), 50);
  }

  formSaldo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = parseMonto($('#saldo-monto').value);
    if (isNaN(valor)) return mostrarError(formSaldo, 'Escribe una cantidad, por ejemplo 150 o 42,30.');
    if ((saldoModo === 'cupo' || saldoModo === 'deuda') && valor < 0)
      return mostrarError(formSaldo, 'Escribe una cantidad positiva.');
    const btn = $('button[type="submit"]', formSaldo);
    setBusy(btn, true, 'Guardando…');

    if (saldoModo === 'cupo') {
      const { error } = await sb.from('cuentas').update({ cupo: valor }).eq('id', saldoCuentaId);
      setBusy(btn, false);
      if (error) return mostrarError(formSaldo, 'No se pudo guardar: ' + error.message);
      $('#sheet-saldo').close();
      toast(`Cupo actualizado a ${fmtMoney(valor)}`);
      await cargarCatalogo();
      refrescar();
      return;
    }

    // En una tarjeta, la deuda es un saldo negativo
    const real = saldoModo === 'deuda' ? -valor : valor;
    const { data, error } = await sb.rpc('ajustar_saldo', { p_cuenta_id: saldoCuentaId, p_monto_real: real });
    setBusy(btn, false);
    if (error) return mostrarError(formSaldo, 'No se pudo guardar: ' + error.message);
    $('#sheet-saldo').close();
    const dif = Number(data);
    toast(dif === 0 ? 'Ya coincidía, no hubo cambios'
      : saldoModo === 'deuda' ? `Deuda actualizada a ${fmtMoney(valor)}`
      : `Saldo actualizado (${dif > 0 ? '+' : '−'}${fmtMoney(dif)})`);
    refrescar();
  });

  // ===================== Hoja: fechas de la tarjeta =====================
  const formFechas = $('#form-fechas');
  let fechasCuentaId = null;
  const selCorte = $('#fechas-corte');
  selCorte.innerHTML = '<option value="">Sin configurar</option>' +
    Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">El ${i + 1} de cada mes</option>`).join('');

  function abrirFechas(cuentaId, nombre) {
    fechasCuentaId = Number(cuentaId);
    const c = state.cuentas.find((x) => x.id === fechasCuentaId) || {};
    mostrarError(formFechas, '');
    $('#fechas-titulo').textContent = `Fechas de ${nombre}`;
    selCorte.value = c.dia_corte ? String(c.dia_corte) : '';
    $('#fechas-pago').value = c.fecha_pago || '';
    $('#sheet-fechas').showModal();
  }

  formFechas.addEventListener('submit', async (e) => {
    e.preventDefault();
    const diaCorte = selCorte.value ? Number(selCorte.value) : null;
    const fechaPago = $('#fechas-pago').value || null;
    const btn = $('button[type="submit"]', formFechas);
    setBusy(btn, true, 'Guardando…');
    const { error } = await sb.from('cuentas').update({ dia_corte: diaCorte, fecha_pago: fechaPago }).eq('id', fechasCuentaId);
    setBusy(btn, false);
    if (error) return mostrarError(formFechas, 'No se pudo guardar: ' + error.message);
    $('#sheet-fechas').close();
    toast('Fechas guardadas');
    await cargarCatalogo();
    refrescar();
  });

  // ===================== Hoja: conectar iPhone =====================
  const formToken = $('#form-token');

  function abrirToken() {
    formToken.reset();
    formToken.hidden = false;
    $('#token-resultado').hidden = true;
    $('#token-codigo').textContent = '';
    mostrarError(formToken, '');
    $('#sheet-token').showModal();
  }

  formToken.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('#token-nombre').value.trim() || 'iPhone';
    const btn = $('button[type="submit"]', formToken);
    setBusy(btn, true, 'Creando…');
    const { data, error } = await sb.rpc('generar_token_atajo', { p_nombre: nombre });
    setBusy(btn, false);
    if (error) return mostrarError(formToken, 'No se pudo crear el código: ' + error.message);
    $('#token-codigo').textContent = data;
    formToken.hidden = true;
    $('#token-resultado').hidden = false;
  });

  $('#token-copiar').addEventListener('click', async () => {
    const codigo = $('#token-codigo').textContent;
    try {
      await navigator.clipboard.writeText(codigo);
      toast('Código copiado');
    } catch {
      toast('Mantén presionado el código para copiarlo', true);
    }
  });

  $('#sheet-token').addEventListener('close', () => {
    $('#token-codigo').textContent = '';
    if (state.view === 'ajustes') renderAjustes();
  });
})();
