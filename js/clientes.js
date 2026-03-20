/* SILBER GESTIÓN — clientes.js */

function filtrarDeudas(modo) {
    _filtroDeudas = modo;
    ['todos','pendientes','hoy'].forEach(f => {
        const btn = document.getElementById('filtro-' + f);
        if (btn) btn.className = 'btn btn-' + (f === modo ? 'primary' : 'secondary');
        if (btn) btn.style.cssText = 'flex:1;font-size:11px;padding:8px;';
    });
    renderizarClientes();
}

let _filtroOficina = 'todos';

function filtrarOficina(modo) {
    _filtroOficina = modo;
    ['todos','pendientes','hoy'].forEach(f => {
        const btn = document.getElementById('of-filtro-' + f);
        if (btn) btn.className = 'btn btn-' + (f === modo ? 'primary' : 'secondary');
        if (btn) btn.style.cssText = 'flex:1;font-size:11px;padding:8px;';
    });
    renderizarOficina();
}

function renderizarOficina() {
    const container = document.getElementById('oficina-clientes-list');
    if (!container) return;
    const diaHoy = new Date().getDate();
    const totalDeuda = estado.clientes.reduce((s, c) => s + (c.deuda || 0), 0);
    const cobrarHoy  = estado.clientes.filter(c => c.diaPago === diaHoy && c.deuda > 0).reduce((s, c) => s + c.deuda, 0);
    const el1 = document.getElementById('of-res-total');    if (el1) el1.textContent = totalDeuda.toFixed(0) + '€';
    const el2 = document.getElementById('of-res-clientes'); if (el2) el2.textContent = estado.clientes.filter(c => c.deuda > 0).length;
    const el3 = document.getElementById('of-res-hoy');      if (el3) el3.textContent = cobrarHoy.toFixed(0) + '€';
    let lista = [...estado.clientes];
    if (_filtroOficina === 'pendientes') lista = lista.filter(c => c.deuda > 0);
    if (_filtroOficina === 'hoy')        lista = lista.filter(c => c.diaPago === diaHoy && c.deuda > 0);
    if (lista.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">${_filtroOficina === 'hoy' ? 'Nadie cobra hoy' : 'No hay clientes'}</div></div>`;
        return;
    }
    container.innerHTML = '';
    lista.forEach(cliente => {
        const cobrarHoyCliente = cliente.diaPago === diaHoy && cliente.deuda > 0;
        const div = document.createElement('div');
        div.className = 'cliente-card';
        div.onclick = () => abrirDetalleCliente(cliente);
        div.innerHTML = `
            <div class="cliente-header">
                <div class="cliente-nombre">${cliente.nombre}${cobrarHoyCliente ? ' <span style="font-size:10px;background:rgba(245,158,11,0.2);color:#F59E0B;border:1px solid rgba(245,158,11,0.4);border-radius:6px;padding:2px 6px;font-weight:700;">HOY</span>' : ''}</div>
                <div class="cliente-deuda ${cliente.deuda > 0 ? 'negativa' : ''}">${(cliente.deuda || 0).toFixed(2)}€</div>
            </div>
            <div class="cliente-info">${cliente.whatsapp || ''} • Límite: ${cliente.limite || 0}€ • Día ${cliente.diaPago || '-'}</div>
        `;
        container.appendChild(div);
    });
}

function renderizarClientes() {
    const container = document.getElementById('clientes-list');
    const diaHoy = new Date().getDate();

    // Calcular resumen
    const totalDeuda = estado.clientes.reduce((s, c) => s + (c.deuda || 0), 0);
    const cobrarHoy  = estado.clientes.filter(c => c.diaPago === diaHoy && c.deuda > 0).reduce((s, c) => s + c.deuda, 0);
    const resCard = document.getElementById('deuda-resumen-card');
    if (resCard) {
        resCard.style.display = estado.clientes.length ? 'block' : 'none';
        const el = document.getElementById('res-total'); if (el) el.textContent = totalDeuda.toFixed(0) + '€';
        const el2 = document.getElementById('res-clientes'); if (el2) el2.textContent = estado.clientes.filter(c => c.deuda > 0).length;
        const el3 = document.getElementById('res-hoy'); if (el3) el3.textContent = cobrarHoy.toFixed(0) + '€';
    }

    // Filtrar
    let lista = [...estado.clientes];
    if (_filtroDeudas === 'pendientes') lista = lista.filter(c => c.deuda > 0);
    if (_filtroDeudas === 'hoy') lista = lista.filter(c => c.diaPago === diaHoy && c.deuda > 0);

    if (lista.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">${_filtroDeudas === 'hoy' ? 'Nadie cobra hoy' : 'No hay clientes'}</div></div>`;
        return;
    }
    container.innerHTML = '';
    lista.forEach(cliente => {
        const cobrarHoyCliente = cliente.diaPago === diaHoy && cliente.deuda > 0;
        const div = document.createElement('div');
        div.className = 'cliente-card';
        div.onclick = () => abrirDetalleCliente(cliente);
        div.innerHTML = `
            <div class="cliente-header">
                <div class="cliente-nombre">${cliente.nombre}${cobrarHoyCliente ? ' <span style="font-size:10px;background:rgba(245,158,11,0.2);color:#F59E0B;border:1px solid rgba(245,158,11,0.4);border-radius:6px;padding:2px 6px;font-weight:700;">HOY</span>' : ''}</div>
                <div class="cliente-deuda ${cliente.deuda > 0 ? 'negativa' : ''}">${(cliente.deuda || 0).toFixed(2)}€</div>
            </div>
            <div class="cliente-info">${cliente.whatsapp || ''} • Límite: ${cliente.limite || 0}€ • Día ${cliente.diaPago || '-'}</div>
        `;
        container.appendChild(div);
    });
}

function abrirModalNuevoCliente() {
    ['cliente-nombre','cliente-whatsapp','cliente-limite'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('cliente-dia-pago').value = '';
    llenarSelectProductos('cliente-producto');
    llenarSelectProductos('cliente-producto2');
    document.getElementById('cliente-producto2-group').style.display = 'none';
    document.getElementById('btn-add-prod-cliente').textContent = '+ Añadir segundo producto';
    document.getElementById('modalNuevoCliente').classList.add('active');
    if (navigator.vibrate) navigator.vibrate(30);
}

function cerrarModalNuevoCliente() {
    var modal = document.getElementById('modalNuevoCliente');
    if (modal) modal.classList.remove('active');
    var btn = document.getElementById('btn-guardar-cliente');
    if (btn) { btn.disabled = false; btn.textContent = 'Crear Cliente'; }
}

function guardarCliente() {
    var btn = document.getElementById('btn-guardar-cliente');
    if (btn && btn.disabled) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Creando…'; }
    var nombreEl = document.getElementById('cliente-nombre');
    var whatsappEl = document.getElementById('cliente-whatsapp');
    var nombre = nombreEl ? nombreEl.value.trim() : '';
    var whatsapp = whatsappEl ? whatsappEl.value.trim() : '';
    var limiteEl = document.getElementById('cliente-limite');
    var diaPagoEl = document.getElementById('cliente-dia-pago');
    var limite = limiteEl ? parseFloat(limiteEl.value) : 0;
    var diaPago = diaPagoEl ? parseInt(diaPagoEl.value, 10) : 1;
    var prod1El = document.getElementById('cliente-producto');
    var prod1 = prod1El ? prod1El.value : '';
    var prod2el = document.getElementById('cliente-producto2');
    var prod2Group = document.getElementById('cliente-producto2-group');
    var prod2 = prod2el && prod2Group && prod2Group.style.display !== 'none' ? prod2el.value : '';
    var producto = prod2 ? prod1 + ' + ' + prod2 : prod1;
    if (!nombre || !whatsapp) {
        if (btn) { btn.disabled = false; btn.textContent = 'Crear Cliente'; }
        alert('Por favor completa los campos obligatorios');
        return;
    }
    var latEl = document.getElementById('cliente-lat');
    var lngEl = document.getElementById('cliente-lng');
    var lat = latEl && latEl.value ? parseFloat(latEl.value) : undefined;
    var lng = lngEl && lngEl.value ? parseFloat(lngEl.value) : undefined;
    var obj = { id: Date.now(), nombre, whatsapp, limite: limite || 0, diaPago: diaPago || 1, producto, deuda: 0, historial: [] };
    if (lat != null && !isNaN(lat)) obj.lat = lat;
    if (lng != null && !isNaN(lng)) obj.lng = lng;
    estado.clientes.push(obj);
    renderizarClientes();
    if (typeof actualizarSaldos === 'function') actualizarSaldos();
    cerrarModalNuevoCliente();
    guardarEstado();
    if (typeof syncClientsToSupabase === 'function') syncClientsToSupabase();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    if (btn) { btn.disabled = false; btn.textContent = 'Crear Cliente'; }
}

function abrirDetalleCliente(cliente) {
    estado.clienteActual = cliente;
    document.getElementById('detalle-cliente-nombre').textContent = cliente.nombre;
    document.getElementById('detalle-cliente-info').textContent = `${cliente.whatsapp} • Día ${cliente.diaPago}`;
    document.getElementById('detalle-cliente-deuda').textContent = cliente.deuda + '€';
    document.getElementById('detalle-cliente-limite').textContent = cliente.limite + '€';
    const historialContainer = document.getElementById('historial-cliente');
    if (cliente.historial.length === 0) {
        historialContainer.innerHTML = '<div class="empty-state-text">Sin movimientos</div>';
    } else {
        historialContainer.innerHTML = '';
        cliente.historial.forEach(mov => {
            const div = document.createElement('div');
            div.className = 'historial-item';
            div.innerHTML = `<div class="historial-header"><div class="historial-tipo">${mov.tipo}</div><div class="historial-fecha">${mov.fecha}</div></div><div class="historial-monto">${mov.monto > 0 ? '+' : ''}${mov.monto}€</div>`;
            historialContainer.appendChild(div);
        });
    }
    document.getElementById('pago-parcial-form').style.display = 'none';
    document.getElementById('modalDetalleCliente').classList.add('active');
    if (navigator.vibrate) navigator.vibrate(30);
}

function cerrarModalDetalleCliente() {
    document.getElementById('modalDetalleCliente').classList.remove('active');
    estado.clienteActual = null;
}

function pagoTotal() {
    if (!estado.clienteActual) return;
    if (confirm(`¿Saldar toda la deuda de ${estado.clienteActual.nombre}?`)) {
        const cliente = estado.clientes.find(c => c.id === estado.clienteActual.id);
        const deudaAnterior = cliente.deuda;
        cliente.deuda = 0;
        cliente.historial.unshift({ fecha: new Date().toISOString().split('T')[0], tipo: 'Pago Total', monto: -deudaAnterior, deudaTotal: 0 });
        renderizarClientes();
        actualizarSaldos();
        cerrarModalDetalleCliente();
        guardarEstado();
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    }
}

function mostrarPagoParcial() {
    document.getElementById('pago-parcial-form').style.display = 'block';
    document.getElementById('pago-parcial-monto').focus();
}

function ejecutarPagoParcial() {
    const monto = parseFloat(document.getElementById('pago-parcial-monto').value);
    if (!monto || monto <= 0) { alert('Ingresa un monto válido'); return; }
    if (monto > estado.clienteActual.deuda) { alert('El monto no puede ser mayor que la deuda'); return; }
    const cliente = estado.clientes.find(c => c.id === estado.clienteActual.id);
    cliente.deuda -= monto;
    cliente.historial.unshift({ fecha: new Date().toISOString().split('T')[0], tipo: 'Pago Parcial', monto: -monto, deudaTotal: cliente.deuda });
    renderizarClientes();
    actualizarSaldos();
    cerrarModalDetalleCliente();
    guardarEstado();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}

// ===== DB_DEUDAS =====
const DB_KEY = 'db_deudas';

function cargarDbDeudas() {
    try { const s = localStorage.getItem(DB_KEY); if (s) return JSON.parse(s); } catch(e) {}
    return { clientes: [], deudas: [], historial: [] };
}

function guardarDbDeudas(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(e) { console.warn('Error guardando db_deudas', e); }
}

// ===== ALTA CLIENTE =====
function altaClienteDeuda() {
    const nombre   = document.getElementById('alta-nombre').value.trim();
    const prod1    = document.getElementById('alta-producto').value;
    const prod2el  = document.getElementById('alta-producto2');
    const prod2    = prod2el && document.getElementById('alta-producto2-group').style.display !== 'none' ? prod2el.value : '';
    const producto = prod2 ? `${prod1} + ${prod2}` : prod1;
    const limite   = parseFloat(document.getElementById('alta-limite').value) || 0;
    const telefono = document.getElementById('alta-telefono').value.trim();
    const diaPago  = parseInt(document.getElementById('alta-dia-pago').value) || 1;
    if (!nombre) { alert('El nombre es obligatorio'); return; }
    const db = cargarDbDeudas();
    const id = Date.now();
    db.clientes.push({ id, nombre, producto, limite_credito: limite, telefono, dia_pago: diaPago });
    db.historial.push({ fecha: new Date().toISOString().split('T')[0], accion: 'alta cliente', detalles: { id, nombre } });
    guardarDbDeudas(db);
    // Sincronizar con estado.clientes para que aparezca en pantalla Deuda
    if (!estado.clientes.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
        estado.clientes.push({ id, nombre, whatsapp: telefono, limite, diaPago, producto, deuda: 0, historial: [] });
        guardarEstado();
        renderizarClientes();
    }
    const res = document.getElementById('alta-resultado');
    res.textContent = `✅ Cliente ID ${id} registrado correctamente.`;
    res.style.display = 'block';
    setTimeout(() => { res.style.display = 'none'; }, 3000);
    ['alta-nombre','alta-producto','alta-limite','alta-telefono'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('alta-dia-pago').value = '';
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

// ===== MODAL DEUDA PENDIENTE =====
function abrirModalDeudaPendiente() {
    const db = cargarDbDeudas();
    const sel = document.getElementById('dp-cliente');
    sel.innerHTML = '';
    const fuentes = db.clientes.length ? db.clientes : estado.clientes.map(c => ({ id: c.id, nombre: c.nombre }));
    if (!fuentes.length) { alert('No hay clientes registrados. Ve a Configuración > Alta Cliente.'); return; }
    fuentes.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nombre; sel.appendChild(o); });
    llenarSelectProductos('dp-producto');
    llenarSelectProductos('dp-producto2');
    document.getElementById('dp-producto2-group').style.display = 'none';
    document.getElementById('btn-add-prod-dp').textContent = '+ Añadir segundo producto';
    document.getElementById('dp-cantidad').value = '';
    document.getElementById('modalDeudaPendiente').classList.add('active');
}

function cerrarModalDeudaPendiente() {
    document.getElementById('modalDeudaPendiente').classList.remove('active');
}

function guardarDeudaPendiente() {
    const clienteId = parseInt(document.getElementById('dp-cliente').value);
    const prod1     = document.getElementById('dp-producto').value;
    const prod2el   = document.getElementById('dp-producto2');
    const prod2     = prod2el && document.getElementById('dp-producto2-group').style.display !== 'none' ? prod2el.value : '';
    const producto  = prod2 ? `${prod1} + ${prod2}` : prod1;
    const cantidad  = parseFloat(document.getElementById('dp-cantidad').value);
    const diaPago   = parseInt(document.getElementById('dp-dia').value);
    if (!producto || !cantidad || cantidad <= 0) { alert('Completa todos los campos'); return; }
    const db = cargarDbDeudas();
    // Buscar cliente en db o en estado
    const dbCliente = db.clientes.find(c => c.id === clienteId);
    const stCliente = estado.clientes.find(c => c.id === clienteId);
    const limite = dbCliente ? dbCliente.limite_credito : (stCliente ? stCliente.limite : 0);
    const nombre = dbCliente ? dbCliente.nombre : (stCliente ? stCliente.nombre : '');
    // Calcular deuda actual
    const deudaActual = db.deudas.filter(d => d.cliente_id === clienteId && !d.pagada).reduce((s, d) => s + d.cantidad, 0);
    if (limite > 0 && (deudaActual + cantidad) > limite) {
        const exceso = ((deudaActual + cantidad) - limite).toFixed(2);
        document.getElementById('sirena-mensaje').textContent = `${nombre} excede el crédito por ${exceso}€. Límite: ${limite}€ — Deuda actual: ${deudaActual}€ — Nueva: ${cantidad}€. OPERACIÓN RECHAZADA.`;
        document.getElementById('modalDeudaPendiente').classList.remove('active');
        document.getElementById('sirena-aumentar').style.display = 'none';
        document.getElementById('sirena-btn-aumentar').style.display = '';
        document.getElementById('sirena-nuevo-limite').value = limite;
        _sirenaClienteId = clienteId;
        // Si es gorrión, registrar alerta para jefes
        if (esGorrion()) {
            if (!estado.alertasJefes) estado.alertasJefes = [];
            const hora = new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
            estado.alertasJefes.push({
                fecha: new Date().toISOString().split('T')[0], hora,
                gorrion: sesionActual.usuario,
                cliente: nombre, exceso, limite, deudaActual, nueva: cantidad
            });
            guardarEstado();
        }
        document.getElementById('modalSirena').classList.add('active');
        if (navigator.vibrate) navigator.vibrate([100,50,100,50,100]);
        // Sonido sirena
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const dur = 1.2;
            [0, 0.4, 0.8].forEach(t => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, ctx.currentTime + t);
                osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + t + 0.2);
                osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + t + 0.35);
                gain.gain.setValueAtTime(0.3, ctx.currentTime + t);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + t + 0.38);
                osc.start(ctx.currentTime + t);
                osc.stop(ctx.currentTime + t + 0.4);
            });
        } catch(e) {}
        return;
    }
    const fecha = new Date().toISOString().split('T')[0];
    const id = Date.now();
    db.deudas.push({ id, cliente_id: clienteId, producto, cantidad, dia_pago: diaPago, fecha_creacion: fecha, pagada: false, historial_pagos: [] });
    db.historial.push({ fecha, accion: 'deuda pendiente', detalles: { cliente: nombre, producto, cantidad, dia_pago: diaPago } });
    guardarDbDeudas(db);
    // Actualizar deuda en estado.clientes
    if (stCliente) {
        stCliente.deuda = (stCliente.deuda || 0) + cantidad;
        stCliente.historial.unshift({ fecha, tipo: `Deuda ${producto}`, monto: cantidad, deudaTotal: stCliente.deuda });
        guardarEstado();
        renderizarClientes();
        actualizarSaldos();
    }
    cerrarModalDeudaPendiente();
    alert(`✅ Deuda de ${cantidad}€ registrada para ${nombre}`);
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

// ===== MODAL DEUDA PAGADA =====
function abrirModalDeudaPagada() {
    const sel = document.getElementById('pago-cliente');
    sel.innerHTML = '';
    const db = cargarDbDeudas();
    const fuentes = db.clientes.length ? db.clientes : estado.clientes.map(c => ({ id: c.id, nombre: c.nombre }));
    if (!fuentes.length) { alert('No hay clientes registrados.'); return; }
    fuentes.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nombre; sel.appendChild(o); });
    document.getElementById('pago-cantidad').value = '';
    document.getElementById('modalDeudaPagada').classList.add('active');
}

function cerrarModalDeudaPagada() {
    document.getElementById('modalDeudaPagada').classList.remove('active');
}

function guardarDeudaPagada() {
    const clienteId = parseInt(document.getElementById('pago-cliente').value);
    const pagado    = parseFloat(document.getElementById('pago-cantidad').value);
    const cuenta    = document.getElementById('pago-cuenta').value;
    if (!pagado || pagado <= 0) { alert('Ingresa un monto válido'); return; }
    const db = cargarDbDeudas();
    const dbCliente = db.clientes.find(c => c.id === clienteId);
    const stCliente = estado.clientes.find(c => c.id === clienteId);
    const nombre = dbCliente ? dbCliente.nombre : (stCliente ? stCliente.nombre : '');
    // Pagar deudas de más antigua a más reciente
    const pendientes = db.deudas.filter(d => d.cliente_id === clienteId && !d.pagada).sort((a,b) => a.fecha_creacion.localeCompare(b.fecha_creacion));
    let restante = pagado;
    const fecha = new Date().toISOString().split('T')[0];
    pendientes.forEach(deuda => {
        if (restante <= 0) return;
        if (restante >= deuda.cantidad) {
            restante -= deuda.cantidad;
            deuda.historial_pagos.push({ fecha, monto: deuda.cantidad });
            deuda.pagada = true;
        } else {
            deuda.historial_pagos.push({ fecha, monto: restante });
            deuda.cantidad -= restante;
            restante = 0;
        }
    });
    db.historial.push({ fecha, accion: 'deuda pagada', detalles: { cliente: nombre, pagado, cuenta } });
    guardarDbDeudas(db);
    // Registrar ingreso y actualizar deuda en estado
    const fechaHoy = fechaConOffset(0);
    if (!estado.registrosDiarios[fechaHoy]) estado.registrosDiarios[fechaHoy] = { gastos: 0, ingresos: 0 };
    estado.registrosDiarios[fechaHoy].ingresos += pagado;
    estado.cuentas[cuenta] = (estado.cuentas[cuenta] || 0) + pagado;
    if (stCliente) {
        stCliente.deuda = Math.max(0, (stCliente.deuda || 0) - pagado);
        stCliente.historial.unshift({ fecha, tipo: 'Pago Deuda', monto: -pagado, deudaTotal: stCliente.deuda });
        guardarEstado();
        renderizarClientes();
    }
    actualizarSaldos();
    dibujarDonut();
    guardarEstado();
    cerrarModalDeudaPagada();
    const credito = restante > 0 ? ` (Crédito a favor: ${restante.toFixed(2)}€)` : '';
    alert(`✅ Pago de ${pagado}€ registrado para ${nombre}${credito}`);
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

function cerrarSirena() {
    document.getElementById('modalSirena').classList.remove('active');
}


function llenarSelectProductos(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    const op0 = document.createElement('option');
    op0.value = ''; op0.textContent = '— Seleccionar —';
    sel.appendChild(op0);
    estado.categoriasIngresos.forEach(cat => {
        const op = document.createElement('option');
        op.value = cat.nombre;
        op.textContent = cat.nombre;
        sel.appendChild(op);
    });
}

function toggleProducto2Cliente() {
    const g = document.getElementById('cliente-producto2-group');
    const btn = document.getElementById('btn-add-prod-cliente');
    const visible = g.style.display !== 'none';
    g.style.display = visible ? 'none' : 'block';
    btn.textContent = visible ? '+ Añadir segundo producto' : '✕ Quitar segundo producto';
}

function toggleProducto2DP() {
    const g = document.getElementById('dp-producto2-group');
    const btn = document.getElementById('btn-add-prod-dp');
    const visible = g.style.display !== 'none';
    g.style.display = visible ? 'none' : 'block';
    btn.textContent = visible ? '+ Añadir segundo producto' : '✕ Quitar segundo producto';
}

function toggleProducto2Alta() {
    const g = document.getElementById('alta-producto2-group');
    const btn = document.getElementById('btn-add-prod-alta');
    const visible = g.style.display !== 'none';
    g.style.display = visible ? 'none' : 'block';
    btn.textContent = visible ? '+ Añadir segundo producto' : '✕ Quitar segundo producto';
}

// ===== SIRENA AUMENTAR CRÉDITO =====
let _sirenaClienteId = null;

function mostrarAumentarCredito() {
    document.getElementById('sirena-aumentar').style.display = 'block';
    document.getElementById('sirena-btn-aumentar').style.display = 'none';
    document.getElementById('sirena-nuevo-limite').focus();
}

function confirmarAumentarCredito() {
    const nuevoLimite = parseFloat(document.getElementById('sirena-nuevo-limite').value);
    if (isNaN(nuevoLimite) || nuevoLimite <= 0) { alert('Introduce un límite válido'); return; }
    // Actualizar en estado.clientes
    if (_sirenaClienteId) {
        const stCli = estado.clientes.find(c => c.id === _sirenaClienteId);
        if (stCli) { stCli.limite = nuevoLimite; guardarEstado(); }
        // Actualizar en db_deudas
        const db = cargarDbDeudas();
        const dbCli = db.clientes.find(c => c.id === _sirenaClienteId);
        if (dbCli) { dbCli.limite_credito = nuevoLimite; guardarDbDeudas(db); }
    }
    cerrarSirena();
}

// ===== GORRIONES =====
function cargarGorriones() {
    try { const s = localStorage.getItem('db_gorriones'); if (s) return JSON.parse(s); } catch(e) {}
    return [];
}

function guardarGorriones(lista) {
    localStorage.setItem('db_gorriones', JSON.stringify(lista));
}

function generarCredenciales(nombre, numero) {
    const base = nombre.split(' ')[0].replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g,'');
    const usuario = `gorrion${numero}_${base.toLowerCase()}`;
    const password = `Gorrion${numero}${base}`;
    return { usuario, password };
}

function renderizarGorriones() {
    const lista = cargarGorriones();
    const container = document.getElementById('gorriones-list');
    if (!container) return;
    if (lista.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🐦</div><div class="empty-state-text">No hay gorriones registrados</div></div>';
        return;
    }
    container.innerHTML = '';
    lista.forEach((g, i) => {
        const div = document.createElement('div');
        div.className = 'cliente-card';
        div.onclick = () => abrirFichaGorrion(i);
        div.innerHTML = `
            <div class="cliente-header">
                <div class="cliente-nombre">🐦 Gorrión ${g.numero} — ${g.nombre}</div>
            </div>
            <div class="cliente-info">${g.telefono} • ${g.direccion}</div>
        `;
        container.appendChild(div);
    });
}

function abrirModalNuevoGorrion() {
    ['gorrion-nombre','gorrion-telefono','gorrion-direccion'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('modalNuevoGorrion').classList.add('active');
}

function cerrarModalNuevoGorrion() {
    document.getElementById('modalNuevoGorrion').classList.remove('active');
}

function guardarGorrion() {
    const nombre    = document.getElementById('gorrion-nombre').value.trim();
    const telefono  = document.getElementById('gorrion-telefono').value.trim();
    const direccion = document.getElementById('gorrion-direccion').value.trim();
    if (!nombre) { alert('El nombre es obligatorio'); return; }
    const lista  = cargarGorriones();
    const numero = lista.length + 1;
    const creds  = generarCredenciales(nombre, numero);
    lista.push({ numero, nombre, telefono, direccion, usuario: creds.usuario, password: creds.password });
    guardarGorriones(lista);
    cerrarModalNuevoGorrion();
    renderizarGorriones();
    alert(`✅ Gorrión ${numero} dado de alta\nUsuario: ${creds.usuario}\nContraseña: ${creds.password}`);
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

let _gorrionActualIdx = null;

function abrirFichaGorrion(idx) {
    const lista = cargarGorriones();
    const g = lista[idx];
    if (!g) return;
    _gorrionActualIdx = idx;
    document.getElementById('ficha-gorrion-titulo').textContent = `🐦 Gorrión ${g.numero} — ${g.nombre}`;
    document.getElementById('ficha-gorrion-id').textContent = `ID Gorrión ${g.numero}`;
    document.getElementById('ficha-gorrion-dir').textContent = g.direccion || '—';
    document.getElementById('ficha-gorrion-user').textContent = g.usuario;
    document.getElementById('ficha-gorrion-tel-edit').value = g.telefono || '';
    document.getElementById('ficha-gorrion-pass-edit').value = '';
    document.getElementById('modalFichaGorrion').classList.add('active');
}

function guardarCambiosGorrion() {
    if (_gorrionActualIdx === null) return;
    const lista = cargarGorriones();
    const g = lista[_gorrionActualIdx];
    const nuevoTel  = document.getElementById('ficha-gorrion-tel-edit').value.trim();
    const nuevoPass = document.getElementById('ficha-gorrion-pass-edit').value.trim();
    if (nuevoTel)  g.telefono = nuevoTel;
    if (nuevoPass) g.password = nuevoPass;
    guardarGorriones(lista);
    renderizarGorriones();
    cerrarFichaGorrion();
    alert('✅ Datos actualizados correctamente');
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

function cerrarFichaGorrion() {
    document.getElementById('modalFichaGorrion').classList.remove('active');
    _gorrionActualIdx = null;
}

function eliminarGorrion(btnEl) {
    if (_gorrionActualIdx === null) return;
    const lista = cargarGorriones();
    const g = lista[_gorrionActualIdx];
    _confirmarBorrado(btnEl, `¿Eliminar Gorrión ${g.numero} — ${g.nombre}?\n\nEsta acción no se puede deshacer.`, () => {
        lista.splice(_gorrionActualIdx, 1);
        lista.forEach((x, i) => { x.numero = i + 1; });
        guardarGorriones(lista);
        cerrarFichaGorrion();
        renderizarGorriones();
    });
}

// ——— Optimizar ruta de clientes (MASTER): Google Maps dir con lat,lng ———
var _rutaClientesSeleccionados = [];

function abrirModalRutaClientes() {
    if (typeof esMaster !== 'function' && typeof esWorker !== 'function') return;
    if (!esMaster() && !esWorker()) return;
    var conCoords = (estado.clientes || []).filter(function(c) { return c.lat != null && c.lng != null && !isNaN(c.lat) && !isNaN(c.lng); });
    var container = document.getElementById('ruta-clientes-list');
    var btnMaps = document.getElementById('btn-abrir-ruta-maps');
    if (!container) return;
    _rutaClientesSeleccionados = [];
    if (conCoords.length === 0) {
        container.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);">No hay clientes con coordenadas. Añade lat y lng a los clientes (en estado.clientes o desde Configuración).</p>';
        if (btnMaps) btnMaps.style.display = 'none';
    } else {
        container.innerHTML = '';
        conCoords.forEach(function(c) {
            var wrap = document.createElement('label');
            wrap.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.id = c.id;
            cb.addEventListener('change', function() {
                if (this.checked) _rutaClientesSeleccionados.push(c); else _rutaClientesSeleccionados = _rutaClientesSeleccionados.filter(function(x) { return x.id !== c.id; });
                if (btnMaps) btnMaps.style.display = _rutaClientesSeleccionados.length ? 'block' : 'none';
            });
            wrap.appendChild(cb);
            wrap.appendChild(document.createTextNode(c.nombre + ' (' + c.lat + ', ' + c.lng + ')'));
            container.appendChild(wrap);
        });
        if (btnMaps) btnMaps.style.display = 'none';
    }
    document.getElementById('modalRutaClientes').classList.add('active');
}

function cerrarModalRutaClientes() {
    document.getElementById('modalRutaClientes').classList.remove('active');
}

function abrirRutaEnGoogleMaps() {
    if (_rutaClientesSeleccionados.length === 0) return;
    var parts = _rutaClientesSeleccionados.map(function(c) { return c.lat + ',' + c.lng; });
    var url = 'https://www.google.com/maps/dir/' + parts.join('/');
    window.open(url, '_blank');
    cerrarModalRutaClientes();
}
