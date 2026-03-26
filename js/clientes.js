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
        const telefono = _silberGetClientPhone(cliente);
        const cobrarHoyCliente = cliente.diaPago === diaHoy && cliente.deuda > 0;
        const div = document.createElement('div');
        div.className = 'cliente-card';
        div.onclick = () => abrirDetalleCliente(cliente);
        div.innerHTML = `
            <div class="cliente-header">
                <div class="cliente-nombre">${cliente.nombre}${cobrarHoyCliente ? ' <span style="font-size:10px;background:rgba(245,158,11,0.2);color:#F59E0B;border:1px solid rgba(245,158,11,0.4);border-radius:6px;padding:2px 6px;font-weight:700;">HOY</span>' : ''}</div>
                <div class="cliente-deuda ${cliente.deuda > 0 ? 'negativa' : ''}">${(cliente.deuda || 0).toFixed(2)}€</div>
            </div>
            <div class="cliente-info">${telefono || 'Sin teléfono'} • Límite: ${cliente.limite || 0}€ • Día ${cliente.diaPago || '-'}</div>
            <button class="btn btn-secondary" style="margin-top:8px;padding:6px 10px;font-size:11px;" onclick="event.stopPropagation();enviarWhatsAppClientePorId('${String(cliente.id).replace(/'/g, "\\'")}')">WhatsApp</button>
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
        const telefono = _silberGetClientPhone(cliente);
        const cobrarHoyCliente = cliente.diaPago === diaHoy && cliente.deuda > 0;
        const div = document.createElement('div');
        div.className = 'cliente-card';
        div.onclick = () => abrirDetalleCliente(cliente);
        div.innerHTML = `
            <div class="cliente-header">
                <div class="cliente-nombre">${cliente.nombre}${cobrarHoyCliente ? ' <span style="font-size:10px;background:rgba(245,158,11,0.2);color:#F59E0B;border:1px solid rgba(245,158,11,0.4);border-radius:6px;padding:2px 6px;font-weight:700;">HOY</span>' : ''}</div>
                <div class="cliente-deuda ${cliente.deuda > 0 ? 'negativa' : ''}">${(cliente.deuda || 0).toFixed(2)}€</div>
            </div>
            <div class="cliente-info">${telefono || 'Sin teléfono'} • Límite: ${cliente.limite || 0}€ • Día ${cliente.diaPago || '-'}</div>
            <button class="btn btn-secondary" style="margin-top:8px;padding:6px 10px;font-size:11px;" onclick="event.stopPropagation();enviarWhatsAppClientePorId('${String(cliente.id).replace(/'/g, "\\'")}')">WhatsApp</button>
        `;
        container.appendChild(div);
    });
}

function _silberNormPhone(v) {
    return String(v || '')
        .trim()
        .replace(/[^\d+]/g, '')
        .replace(/(?!^)\+/g, '');
}

function _silberPhoneForWa(v) {
    return _silberNormPhone(v).replace(/\D/g, '');
}

function _silberPhoneIsValid(v) {
    var p = _silberNormPhone(v);
    if (!p) return true; // opcional
    return /^\+?\d{8,15}$/.test(p);
}

function _silberGetClientPhone(cliente) {
    if (!cliente) return '';
    return _silberNormPhone(cliente.telefono || cliente.whatsapp || '');
}

function _silberDebtForClient(cliente) {
    return Number((cliente && cliente.deuda) || 0) || 0;
}

function _silberBuildWhatsAppDebtMessage(cliente) {
    var nombre = (cliente && cliente.nombre) || 'cliente';
    var deuda = _silberDebtForClient(cliente).toFixed(2);
    return 'Hola ' + nombre + ', tienes una deuda pendiente de ' + deuda + '€. ¿Puedes revisarlo hoy?';
}

function _silberSyncClientDataEverywhere(cliente) {
    if (!cliente) return;
    var telefono = _silberGetClientPhone(cliente);
    cliente.telefono = telefono;
    cliente.whatsapp = telefono; // compatibilidad con lógica existente
    var db = cargarDbDeudas();
    var dbCli = (db.clientes || []).find(function(c) { return String(c.id) === String(cliente.id); });
    if (dbCli) {
        dbCli.nombre = cliente.nombre || dbCli.nombre || '';
        dbCli.telefono = telefono;
        dbCli.limite_credito = Number(cliente.limite) || 0;
        dbCli.dia_pago = Number(cliente.diaPago) || 1;
        dbCli.producto = cliente.producto || dbCli.producto || '';
    } else {
        db.clientes.push({
            id: cliente.id,
            nombre: cliente.nombre || '',
            producto: cliente.producto || '',
            limite_credito: Number(cliente.limite) || 0,
            telefono: telefono,
            dia_pago: Number(cliente.diaPago) || 1
        });
    }
    guardarDbDeudas(db);
    if (typeof syncClientsToSupabase === 'function') syncClientsToSupabase();
}

function _silberGetClienteByCurrent() {
    if (!estado.clienteActual) return null;
    return estado.clientes.find(function(c) { return String(c.id) === String(estado.clienteActual.id); }) || null;
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
    var telefono = _silberNormPhone(whatsappEl ? whatsappEl.value : '');
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
    if (!nombre) {
        if (btn) { btn.disabled = false; btn.textContent = 'Crear Cliente'; }
        alert('El nombre es obligatorio');
        return;
    }
    if (!_silberPhoneIsValid(telefono)) {
        if (btn) { btn.disabled = false; btn.textContent = 'Crear Cliente'; }
        alert('Teléfono inválido. Usa formato +346XXXXXXXX');
        return;
    }
    var dupTelefono = telefono ? (estado.clientes || []).find(function(c) {
        return _silberGetClientPhone(c) === telefono;
    }) : null;
    if (telefono && dupTelefono) {
        if (btn) { btn.disabled = false; btn.textContent = 'Crear Cliente'; }
        alert('Ya existe un cliente con ese teléfono.');
        return;
    }
    var latEl = document.getElementById('cliente-lat');
    var lngEl = document.getElementById('cliente-lng');
    var lat = latEl && latEl.value ? parseFloat(latEl.value) : undefined;
    var lng = lngEl && lngEl.value ? parseFloat(lngEl.value) : undefined;
    var obj = { id: Date.now(), nombre, telefono, whatsapp: telefono, limite: limite || 0, diaPago: diaPago || 1, producto, deuda: 0, historial: [] };
    if (lat != null && !isNaN(lat)) obj.lat = lat;
    if (lng != null && !isNaN(lng)) obj.lng = lng;
    estado.clientes.push(obj);
    renderizarClientes();
    if (typeof actualizarSaldos === 'function') actualizarSaldos();
    cerrarModalNuevoCliente();
    guardarEstado();
    _silberSyncClientDataEverywhere(obj);
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    if (btn) { btn.disabled = false; btn.textContent = 'Crear Cliente'; }
}

function abrirDetalleCliente(cliente) {
    estado.clienteActual = cliente;
    var telefono = _silberGetClientPhone(cliente);
    document.getElementById('detalle-cliente-nombre').textContent = cliente.nombre;
    document.getElementById('detalle-cliente-info').textContent = `${telefono || 'Sin teléfono'} • Día ${cliente.diaPago}`;
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

    // GPS: mostrar botón navegar solo si el cliente tiene coordenadas
    var btnNav = document.getElementById('btn-navegar-cliente');
    if (btnNav) btnNav.style.display = (cliente.lat && cliente.lng) ? 'flex' : 'none';

    // "He llegado": visible solo para workers (Gorriones)
    var btnLlegado = document.getElementById('btn-he-llegado');
    var gpsRow = document.getElementById('cliente-gps-row');
    var tieneGPS = !!(cliente.lat && cliente.lng);
    if (gpsRow) {
        // Mostrar la fila si: hay coords (para navegar) O es worker (para he llegado)
        var mostrarFila = tieneGPS || (typeof esWorker === 'function' && esWorker());
        gpsRow.style.display = mostrarFila ? 'flex' : 'none';
    }
    if (btnLlegado) {
        btnLlegado.style.display = (typeof esWorker === 'function' && esWorker()) ? 'flex' : 'none';
        btnLlegado.disabled = false;
        btnLlegado.textContent = '📍 He llegado';
    }

    // Historial de llegadas
    var llegadasSection = document.getElementById('llegadas-section');
    if (llegadasSection) {
        var hayLlegadas = (estado.llegadas || []).some(function(l) { return l.clienteId === cliente.id; });
        llegadasSection.style.display = (hayLlegadas || (typeof esWorker === 'function' && esWorker())) ? 'block' : 'none';
    }
    _renderizarLlegadasEnDetalle(cliente.id);

    var btnWA = document.getElementById('btn-whatsapp-cliente');
    if (btnWA) btnWA.style.display = 'flex';

    document.getElementById('modalDetalleCliente').classList.add('active');
    if (navigator.vibrate) navigator.vibrate(30);
}

function abrirEditarCliente() {
    if (typeof esMaster === 'function' && !esMaster()) {
        alert('Solo Jefazo / Jefaza pueden editar clientes.');
        return;
    }
    var c = _silberGetClienteByCurrent();
    if (!c) { alert('No hay cliente seleccionado'); return; }
    var nombre = prompt('Nombre del cliente:', c.nombre || '');
    if (nombre === null) return;
    nombre = nombre.trim();
    if (!nombre) { alert('El nombre no puede estar vacío.'); return; }
    var telefono = prompt('Teléfono del cliente (opcional):', _silberGetClientPhone(c));
    if (telefono === null) return;
    telefono = _silberNormPhone(telefono);
    if (!_silberPhoneIsValid(telefono)) { alert('Teléfono inválido. Usa formato +346XXXXXXXX'); return; }
    var limiteTxt = prompt('Límite de crédito (€):', String(Number(c.limite) || 0));
    if (limiteTxt === null) return;
    var limite = Number(limiteTxt);
    if (isNaN(limite) || limite < 0) { alert('Límite inválido.'); return; }
    var diaTxt = prompt('Día de pago (1-31):', String(Number(c.diaPago) || 1));
    if (diaTxt === null) return;
    var dia = parseInt(diaTxt, 10);
    if (!dia || dia < 1 || dia > 31) { alert('Día de pago inválido.'); return; }
    var producto = prompt('Producto (opcional):', c.producto || '');
    if (producto === null) return;
    c.nombre = nombre;
    var dupPhone = telefono ? (estado.clientes || []).find(function(x) { return x.id !== c.id && _silberGetClientPhone(x) === telefono; }) : null;
    if (telefono && dupPhone) { alert('Ya existe otro cliente con ese teléfono.'); return; }
    c.telefono = telefono;
    c.whatsapp = telefono;
    c.limite = limite;
    c.diaPago = dia;
    c.producto = (producto || '').trim();
    _silberSyncClientDataEverywhere(c);
    guardarEstado();
    renderizarClientes();
    if (typeof renderizarOficina === 'function') renderizarOficina();
    if (typeof actualizarSaldos === 'function') actualizarSaldos();
    abrirDetalleCliente(c);
    alert('✅ Cliente actualizado');
}

function eliminarClienteActual() {
    if (typeof esMaster === 'function' && !esMaster()) {
        alert('Solo Jefazo / Jefaza pueden eliminar clientes.');
        return;
    }
    var c = _silberGetClienteByCurrent();
    if (!c) return;
    if (!confirm('¿Eliminar cliente "' + c.nombre + '"? Esta acción no se puede deshacer.')) return;
    var db = cargarDbDeudas();
    db.clientes = (db.clientes || []).filter(function(x) { return String(x.id) !== String(c.id); });
    db.deudas = (db.deudas || []).filter(function(x) { return String(x.cliente_id) !== String(c.id); });
    db.historial = (db.historial || []);
    db.historial.push({
        fecha: new Date().toISOString().split('T')[0],
        accion: 'cliente eliminado',
        detalles: { id: c.id, nombre: c.nombre }
    });
    guardarDbDeudas(db);
    estado.clientes = (estado.clientes || []).filter(function(x) { return String(x.id) !== String(c.id); });
    guardarEstado();
    if (typeof syncClientsToSupabase === 'function') syncClientsToSupabase();
    cerrarModalDetalleCliente();
    renderizarClientes();
    if (typeof renderizarOficina === 'function') renderizarOficina();
    if (typeof actualizarSaldos === 'function') actualizarSaldos();
    alert('✅ Cliente eliminado');
}

function cerrarModalDetalleCliente() {
    document.getElementById('modalDetalleCliente').classList.remove('active');
    estado.clienteActual = null;
}

function pagoTotal() {
    if (!estado.clienteActual) return;
    var cliente = _silberGetClienteByCurrent();
    if (!cliente) { alert('Cliente no encontrado.'); return; }
    var deudaAnterior = Number(cliente.deuda) || 0;
    if (deudaAnterior <= 0) { alert('Este cliente no tiene deuda pendiente.'); return; }
    if (!confirm('¿Saldar toda la deuda de ' + cliente.nombre + '?')) return;
    var cuentaPagoTotal = 'efectivo';
    var ok = (typeof _silberRegistrarIngresoDeuda === 'function')
        ? _silberRegistrarIngresoDeuda({ monto: deudaAnterior, cuenta: cuentaPagoTotal, nota: 'Pago total deuda ' + cliente.nombre })
        : false;
    if (!ok) {
        alert('No se pudo registrar el pago total.');
        return;
    }
    cliente.deuda = 0;
    cliente.historial.unshift({ fecha: new Date().toISOString().split('T')[0], tipo: 'Pago Total', monto: -deudaAnterior, deudaTotal: 0 });
    var db = cargarDbDeudas();
    (db.deudas || []).forEach(function(d) {
        if (String(d.cliente_id) === String(cliente.id) && !d.pagada) {
            d.pagada = true;
            if (!Array.isArray(d.historial_pagos)) d.historial_pagos = [];
            d.historial_pagos.push({ fecha: new Date().toISOString().split('T')[0], monto: d.cantidad });
            d.cantidad = 0;
        }
    });
    guardarDbDeudas(db);
    _silberSyncClientDataEverywhere(cliente);
    guardarEstado();
    renderizarClientes();
    if (typeof renderizarOficina === 'function') renderizarOficina();
    actualizarSaldos();
    if (typeof dibujarDonut === 'function') dibujarDonut();
    cerrarModalDetalleCliente();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}

function mostrarPagoParcial() {
    document.getElementById('pago-parcial-form').style.display = 'block';
    document.getElementById('pago-parcial-monto').focus();
}

function ejecutarPagoParcial() {
    const monto = parseFloat(document.getElementById('pago-parcial-monto').value);
    if (!monto || monto <= 0) { alert('Ingresa un monto válido'); return; }
    const cliente = _silberGetClienteByCurrent();
    if (!cliente) { alert('Cliente no encontrado.'); return; }
    if (monto > cliente.deuda) { alert('El monto no puede ser mayor que la deuda'); return; }
    var cuentaPagoParcial = 'efectivo';
    var ok = (typeof _silberRegistrarIngresoDeuda === 'function')
        ? _silberRegistrarIngresoDeuda({ monto: monto, cuenta: cuentaPagoParcial, nota: 'Pago parcial deuda ' + cliente.nombre })
        : false;
    if (!ok) { alert('No se pudo registrar el pago parcial.'); return; }
    cliente.deuda -= monto;
    cliente.historial.unshift({ fecha: new Date().toISOString().split('T')[0], tipo: 'Pago Parcial', monto: -monto, deudaTotal: cliente.deuda });
    var restante = monto;
    var db = cargarDbDeudas();
    (db.deudas || []).filter(function(d) { return String(d.cliente_id) === String(cliente.id) && !d.pagada; })
        .sort(function(a, b) { return String(a.fecha_creacion || '').localeCompare(String(b.fecha_creacion || '')); })
        .forEach(function(d) {
            if (restante <= 0) return;
            if (!Array.isArray(d.historial_pagos)) d.historial_pagos = [];
            if (restante >= d.cantidad) {
                d.historial_pagos.push({ fecha: new Date().toISOString().split('T')[0], monto: d.cantidad });
                restante -= d.cantidad;
                d.cantidad = 0;
                d.pagada = true;
            } else {
                d.historial_pagos.push({ fecha: new Date().toISOString().split('T')[0], monto: restante });
                d.cantidad -= restante;
                restante = 0;
            }
        });
    guardarDbDeudas(db);
    _silberSyncClientDataEverywhere(cliente);
    renderizarClientes();
    if (typeof renderizarOficina === 'function') renderizarOficina();
    actualizarSaldos();
    if (typeof dibujarDonut === 'function') dibujarDonut();
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
    const telefono = _silberNormPhone(document.getElementById('alta-telefono').value);
    const diaPago  = parseInt(document.getElementById('alta-dia-pago').value) || 1;
    if (!nombre) { alert('El nombre es obligatorio'); return; }
    if (!_silberPhoneIsValid(telefono)) { alert('Teléfono inválido. Usa formato +346XXXXXXXX'); return; }
    const db = cargarDbDeudas();
    const id = Date.now();
    db.clientes.push({ id, nombre, producto, limite_credito: limite, telefono, dia_pago: diaPago });
    db.historial.push({ fecha: new Date().toISOString().split('T')[0], accion: 'alta cliente', detalles: { id, nombre } });
    guardarDbDeudas(db);
    // Sincronizar con estado.clientes para que aparezca en pantalla Deuda
    if (!estado.clientes.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
        var nuevoCli = { id, nombre, telefono: telefono, whatsapp: telefono, limite, diaPago, producto, deuda: 0, historial: [] };
        estado.clientes.push(nuevoCli);
        _silberSyncClientDataEverywhere(nuevoCli);
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
    const clienteId = String(document.getElementById('dp-cliente').value);
    const prod1     = document.getElementById('dp-producto').value;
    const prod2el   = document.getElementById('dp-producto2');
    const prod2     = prod2el && document.getElementById('dp-producto2-group').style.display !== 'none' ? prod2el.value : '';
    const producto  = prod2 ? `${prod1} + ${prod2}` : prod1;
    const cantidad  = parseFloat(document.getElementById('dp-cantidad').value);
    const diaPago   = parseInt(document.getElementById('dp-dia').value);
    if (!producto || !cantidad || cantidad <= 0) { alert('Completa todos los campos'); return; }
    const db = cargarDbDeudas();
    // Buscar cliente en db o en estado
    const dbCliente = db.clientes.find(c => String(c.id) === String(clienteId));
    const stCliente = estado.clientes.find(c => String(c.id) === String(clienteId));
    const limite = dbCliente ? dbCliente.limite_credito : (stCliente ? stCliente.limite : 0);
    const nombre = dbCliente ? dbCliente.nombre : (stCliente ? stCliente.nombre : '');
    // Calcular deuda actual
    const deudaActual = db.deudas.filter(d => String(d.cliente_id) === String(clienteId) && !d.pagada).reduce((s, d) => s + d.cantidad, 0);
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
    db.deudas.push({ id, cliente_id: Number(clienteId), producto, cantidad, dia_pago: diaPago, fecha_creacion: fecha, pagada: false, historial_pagos: [] });
    db.historial.push({ fecha, accion: 'deuda pendiente', detalles: { cliente: nombre, producto, cantidad, dia_pago: diaPago } });
    guardarDbDeudas(db);
    // Actualizar deuda en estado.clientes
    if (stCliente) {
        stCliente.deuda = (stCliente.deuda || 0) + cantidad;
        stCliente.historial.unshift({ fecha, tipo: `Deuda ${producto}`, monto: cantidad, deudaTotal: stCliente.deuda });
        _silberSyncClientDataEverywhere(stCliente);
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
    const clienteId = String(document.getElementById('pago-cliente').value);
    const pagado    = parseFloat(document.getElementById('pago-cantidad').value);
    const cuenta    = document.getElementById('pago-cuenta').value;
    if (!pagado || pagado <= 0) { alert('Ingresa un monto válido'); return; }
    const db = cargarDbDeudas();
    const dbCliente = db.clientes.find(c => String(c.id) === String(clienteId));
    const stCliente = estado.clientes.find(c => String(c.id) === String(clienteId));
    const nombre = dbCliente ? dbCliente.nombre : (stCliente ? stCliente.nombre : '');
    // Pagar deudas de más antigua a más reciente
    const pendientes = db.deudas.filter(d => String(d.cliente_id) === String(clienteId) && !d.pagada).sort((a,b) => a.fecha_creacion.localeCompare(b.fecha_creacion));
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
    if (typeof _silberRegistrarIngresoDeuda !== 'function') {
        alert('No se pudo registrar el ingreso de deuda.');
        return;
    }
    _silberRegistrarIngresoDeuda({ monto: pagado, cuenta: cuenta, nota: 'Pago deuda ' + nombre });
    if (stCliente) {
        stCliente.deuda = Math.max(0, (stCliente.deuda || 0) - pagado);
        stCliente.historial.unshift({ fecha, tipo: 'Pago Deuda', monto: -pagado, deudaTotal: stCliente.deuda });
        _silberSyncClientDataEverywhere(stCliente);
        guardarEstado();
        renderizarClientes();
    }
    if (typeof renderizarOficina === 'function') renderizarOficina();
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

function enviarWhatsAppClientePorId(clienteId) {
    var cliente = (estado.clientes || []).find(function(c) { return String(c.id) === String(clienteId); });
    if (!cliente) { alert('Cliente no encontrado'); return; }
    var phoneDigits = _silberPhoneForWa(cliente.telefono || cliente.whatsapp);
    if (!phoneDigits || phoneDigits.length < 8) {
        alert('Este cliente no tiene teléfono válido para WhatsApp');
        return;
    }
    var msg = _silberBuildWhatsAppDebtMessage(cliente);
    var url = 'https://wa.me/' + phoneDigits + '?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');
}

(function _silberMigrateTelefonosClientes() {
    var changed = false;
    (estado.clientes || []).forEach(function(c) {
        var tel = _silberGetClientPhone(c);
        if ((c.telefono || '') !== tel) { c.telefono = tel; changed = true; }
        if ((c.whatsapp || '') !== tel) { c.whatsapp = tel; changed = true; }
    });
    if (changed) guardarEstado();
})();

// ===== GEOLOCALIZACIÓN, GPS CAPTURE, "HE LLEGADO" Y GEOFENCE =====

var GEOFENCE_RADIO_METROS = 300; // metros de radio permitido para registrar llegada

/** Distancia en metros entre dos puntos (fórmula Haversine) */
function haversineMetros(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Captura GPS actual y rellena los campos lat/lng del formulario de nuevo cliente */
function captureGPSParaCliente() {
    var btn = document.getElementById('btn-capture-gps');
    if (btn) { btn.textContent = '📡 Obteniendo…'; btn.disabled = true; }
    if (!navigator.geolocation) {
        alert('Geolocalización no disponible en este dispositivo.');
        if (btn) { btn.textContent = '📍 Capturar GPS'; btn.disabled = false; }
        return;
    }
    navigator.geolocation.getCurrentPosition(function(pos) {
        var lat = pos.coords.latitude.toFixed(6);
        var lng = pos.coords.longitude.toFixed(6);
        var latEl = document.getElementById('cliente-lat');
        var lngEl = document.getElementById('cliente-lng');
        if (latEl) latEl.value = lat;
        if (lngEl) lngEl.value = lng;
        if (btn) { btn.textContent = '✅ GPS capturado'; btn.disabled = false; }
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
        setTimeout(function() { if (btn) btn.textContent = '📍 Capturar GPS'; }, 3000);
    }, function(err) {
        alert('No se pudo obtener la ubicación: ' + (err.message || 'Error'));
        if (btn) { btn.textContent = '📍 Capturar GPS'; btn.disabled = false; }
    }, { enableHighAccuracy: true, timeout: 12000 });
}

/** Abre Google Maps con navegación al cliente actual */
function navegarACliente() {
    var c = estado.clienteActual;
    if (!c) return;
    if (!c.lat || !c.lng) {
        alert('Este cliente no tiene coordenadas GPS.\nEdítalo y usa el botón "Capturar GPS" para añadir su ubicación.');
        return;
    }
    var url = 'https://www.google.com/maps/dir/?api=1&destination=' + c.lat + ',' + c.lng + '&travelmode=driving';
    window.open(url, '_blank');
}

/** Registra la llegada del trabajador al cliente con verificación de geofence */
function registrarLlegada() {
    var c = estado.clienteActual;
    if (!c) return;
    var btn = document.getElementById('btn-he-llegado');
    if (btn) { btn.disabled = true; btn.textContent = '📡 Verificando…'; }

    function _grabar(lat, lng, distancia, fueraDeZona, sinGPS) {
        var ahora = new Date();
        var entrada = {
            id: Date.now() + Math.random(),
            fecha: ahora.toISOString().split('T')[0],
            hora: ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            trabajador: sesionActual ? sesionActual.usuario : 'desconocido',
            clienteId: c.id,
            clienteNombre: c.nombre,
            lat: lat || null,
            lng: lng || null,
            distancia: distancia != null ? Math.round(distancia) : null,
            fueraDeZona: !!fueraDeZona,
            sinGPS: !!sinGPS
        };
        if (!estado.llegadas) estado.llegadas = [];
        estado.llegadas.unshift(entrada);
        guardarEstado();

        // Auditoría
        if (typeof activityLogAdd === 'function') {
            activityLogAdd({
                ts: ahora.toISOString(),
                usuario: entrada.trabajador,
                accion: 'LLEGADA_CLIENTE',
                detalle: 'Cliente: ' + c.nombre +
                    (distancia != null ? ' · ' + Math.round(distancia) + 'm' : '') +
                    (fueraDeZona ? ' ⚠️ FUERA DE ZONA' : '') +
                    (sinGPS ? ' ⚠️ SIN GPS' : '')
            });
        }

        if (btn) { btn.disabled = false; btn.textContent = '📍 He llegado'; }

        var msg = '✅ Llegada registrada\n' + entrada.hora + ' · ' + c.nombre;
        if (distancia != null) msg += '\nDistancia al cliente: ' + Math.round(distancia) + 'm';
        if (fueraDeZona) msg += '\n⚠️ Estás fuera del radio permitido (' + GEOFENCE_RADIO_METROS + 'm)';
        if (sinGPS) msg += '\n⚠️ Sin GPS — llegada registrada sin verificar posición';
        alert(msg);
        if (navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 30]);

        _renderizarLlegadasEnDetalle(c.id);
        var llegadasSection = document.getElementById('llegadas-section');
        if (llegadasSection) llegadasSection.style.display = 'block';
    }

    if (!navigator.geolocation) {
        _grabar(null, null, null, false, true);
        return;
    }
    navigator.geolocation.getCurrentPosition(function(pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var distancia = null;
        var fueraDeZona = false;
        if (c.lat && c.lng && !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng))) {
            distancia = haversineMetros(lat, lng, parseFloat(c.lat), parseFloat(c.lng));
            fueraDeZona = distancia > GEOFENCE_RADIO_METROS;
        }
        _grabar(lat, lng, distancia, fueraDeZona, false);
    }, function() {
        // GPS no disponible o denegado — registrar igualmente
        _grabar(null, null, null, false, true);
    }, { enableHighAccuracy: true, timeout: 8000 });
}

/** Renderiza el historial de llegadas de un cliente en el modal de detalle */
function _renderizarLlegadasEnDetalle(clienteId) {
    var container = document.getElementById('llegadas-cliente');
    if (!container) return;
    var llegadas = (estado.llegadas || []).filter(function(l) { return l.clienteId === clienteId; }).slice(0, 10);
    if (llegadas.length === 0) {
        container.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:6px 0;">Sin registros de llegada aún</div>';
        return;
    }
    container.innerHTML = llegadas.map(function(l) {
        var badge = '';
        if (l.fueraDeZona) badge = '<span style="font-size:10px;background:rgba(245,158,11,0.2);color:#F59E0B;border:1px solid rgba(245,158,11,0.4);border-radius:5px;padding:1px 6px;margin-left:5px;">FUERA ZONA</span>';
        else if (l.sinGPS) badge = '<span style="font-size:10px;background:rgba(100,116,139,0.2);color:#94A3B8;border:1px solid rgba(100,116,139,0.4);border-radius:5px;padding:1px 6px;margin-left:5px;">SIN GPS</span>';
        var dist = l.distancia != null ? '<span style="color:var(--text-secondary);">' + l.distancia + 'm</span>' : '';
        return '<div class="historial-item">' +
            '<div class="historial-header">' +
            '<div class="historial-tipo" style="font-size:12px;">📍 ' + (l.trabajador || '—') + badge + '</div>' +
            '<div class="historial-fecha">' + l.fecha + ' ' + l.hora + '</div>' +
            '</div>' +
            (dist ? '<div style="font-size:11px;padding:2px 0 0;">' + dist + '</div>' : '') +
            '</div>';
    }).join('');
}
