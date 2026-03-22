/* SILBER GESTIÓN — transacciones.js */

function guardarTransaccion() {
    var btn = document.getElementById('btn-guardar-transaccion');
    if (btn && btn.disabled) return;
    if (!estado || !estado.transaccionActual) { alert('Sesión de transacción inválida.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    try {
    var montoEl = document.getElementById('transaccion-monto');
    var monto = montoEl ? parseFloat(montoEl.value) : 0;
    var cuenta = document.getElementById('transaccion-cuenta') ? document.getElementById('transaccion-cuenta').value : 'efectivo';
    if (!monto || monto <= 0) {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
        alert('Por favor ingresa un monto válido');
        return;
    }
    var tipo = estado.transaccionActual.tipo;
    var categoria = estado.transaccionActual.categoria;

    if (typeof esGorrion === 'function' && esGorrion() && tipo === 'gasto' && !estado.fotoActual) {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
        alert('📷 Debes hacer foto del ticket para registrar el gasto');
        return;
    }

    const fechaHoy = fechaConOffset(0);
    if (!estado.registrosDiarios[fechaHoy]) estado.registrosDiarios[fechaHoy] = { gastos: 0, ingresos: 0 };

    var registradoPor = sesionActual ? sesionActual.usuario : '?';
    var horaActual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    var notaEl = document.getElementById('transaccion-nota');
    var nota = notaEl ? notaEl.value : '';
    var gramosEl = document.getElementById('transaccion-gramos');
    var gramos = gramosEl ? (parseFloat(gramosEl.value) || 0) : 0;

    // ── 1. ESTADO LOCAL (siempre; localStorage es la fuente de verdad si Supabase falla) ──
    if (tipo === 'gasto') {
        estado.cuentas[cuenta] = (estado.cuentas[cuenta] || 0) - monto;
        estado.registrosDiarios[fechaHoy].gastos += monto;

        // Registrar desglose de gastos
        if (!estado.gastosRegistros) estado.gastosRegistros = [];
        estado.gastosRegistros.push({
            id: Date.now() + Math.random(),
            fecha: fechaHoy, hora: horaActual,
            registradoPor, categoria: categoria.nombre,
            monto, cuenta, nota
        });

        if (esGorrion()) {
            if (!estado.gastosGorriones) estado.gastosGorriones = [];
            estado.gastosGorriones.push({
                fecha: fechaHoy, hora: horaActual,
                gorrion: sesionActual.usuario,
                numero: sesionActual.numero,
                categoria: categoria.nombre,
                monto, cuenta, nota,
                foto: estado.fotoActual || null
            });
        }

        if (categoria.esRecarga) {
            if (gramos > 0) {
                if (categoria.esRecarga === 'recargaB') estado.stockTotalB += gramos;
                else if (categoria.esRecarga === 'recargaV') estado.stockTotalV += gramos;
                const numStock = estado.listaStock.length + 1;
                const fechaCorta = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                estado.listaStock.push({ id: Date.now() + Math.random(), nombre: `Stock ${numStock} ${fechaCorta}`, fecha: fechaHoy, gramos, tipo: categoria.esRecarga, monto });
            }
            estado.stock[categoria.esRecarga] = (estado.stock[categoria.esRecarga] || 0) + monto;
        }
    } else {
        estado.cuentas[cuenta] = (estado.cuentas[cuenta] || 0) + monto;
        estado.registrosDiarios[fechaHoy].ingresos += monto;

        if (!estado.ingresosRegistros) estado.ingresosRegistros = [];
        estado.ingresosRegistros.push({
            id: Date.now() + Math.random(),
            fecha: fechaHoy, hora: horaActual,
            registradoPor, categoria: categoria.nombre,
            monto, cuenta, nota
        });

        const nombreCat = categoria.nombre;
        const sp = estado.stockProductos;
        if (sp && sp[nombreCat] && sp[nombreCat].precio > 0) {
            const prod = sp[nombreCat];
            const gramosVendidos = (monto / prod.precio) * prod.gramaje;
            prod.stock = Math.max(0, (prod.stock || 0) - gramosVendidos);
            const esV = nombreCat === 'Verde' || nombreCat.includes('Brócoli');
            if (esV) estado.stockTotalV = Math.max(0, (estado.stockTotalV || 0) - gramosVendidos);
            else     estado.stockTotalB = Math.max(0, (estado.stockTotalB || 0) - gramosVendidos);
        }
        // Ingresos directos de Recarga B / Recarga V: descontar gramos del stock total
        if (categoria.esRecarga && gramos > 0) {
            if (categoria.esRecarga === 'recargaB') estado.stockTotalB = Math.max(0, (estado.stockTotalB || 0) - gramos);
            else if (categoria.esRecarga === 'recargaV') estado.stockTotalV = Math.max(0, (estado.stockTotalV || 0) - gramos);
            // Guardar gramos en el registro para el cierre del día
        }
        // Guardar gramos vendidos en el registro de ingreso (para cierre diario)
        if (gramos > 0) {
            estado.ingresosRegistros[estado.ingresosRegistros.length - 1].gramos = gramos;
            estado.ingresosRegistros[estado.ingresosRegistros.length - 1].esRecarga = categoria.esRecarga || null;
        }
    }

    // ── 2. FINALIZAR ──
    actualizarSaldos();
    if (typeof dibujarDonut === 'function') dibujarDonut();
    renderizarDesgloseGastos();
    renderizarDesgloseIngresos();
    cerrarModalTransaccion();
    guardarEstado();
    if (typeof checkHighValue === 'function') checkHighValue(monto);
    var lastId = tipo === 'gasto' && estado.gastosRegistros && estado.gastosRegistros.length ? estado.gastosRegistros[estado.gastosRegistros.length - 1].id : (estado.ingresosRegistros && estado.ingresosRegistros.length ? estado.ingresosRegistros[estado.ingresosRegistros.length - 1].id : null);
    if (typeof recordTransactionCreated === 'function' && lastId) recordTransactionCreated(lastId);
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

    if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }

    // ── 3. SYNC SUPABASE (opcional; si falla, la app sigue con localStorage) ──
    if (typeof _supabase !== 'undefined' && _supabase) {
        _supabase.from('transacciones').insert([{ tipo: tipo, categoria: categoria.nombre, monto: monto, cuenta: cuenta, gramos: gramos, nota: nota, registrado_por: registradoPor }]).then(function() {}).catch(function(err) { console.warn('Supabase sync transacción:', err); });
    }
    } catch (err) {
        console.error('guardarTransaccion:', err);
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
}

let _filtroDeudas = 'todos';

// ===== DESGLOSE DIARIO =====
function renderizarDesgloseGastos() {
    const container = document.getElementById('desglose-gastos');
    if (!container) return;
    const hoy = new Date().toISOString().split('T')[0];
    const registros = (estado.gastosRegistros || []).filter(r => r.fecha === hoy);
    if (registros.length === 0) {
        container.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:12px 0;">Sin gastos registrados hoy</div>';
        return;
    }
    const total = registros.reduce((s, r) => s + r.monto, 0);
    container.innerHTML = '';
    const puedeBorrar = typeof esMaster === 'function' && esMaster();
    [...registros].reverse().forEach(r => {
        const idx = (estado.gastosRegistros || []).findIndex(x => x.id === r.id);
        const fila = document.createElement('div');
        fila.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:10px;margin-bottom:5px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.15);gap:8px;';
        const delBtn = puedeBorrar ? '<button onclick="eliminarGasto(' + idx + ', this)" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:5px 8px;cursor:pointer;color:#EF4444;display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>' : '';
        fila.innerHTML = `
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${r.categoria}</div>
                <div style="font-size:10px;color:var(--text-secondary);">${r.hora} · ${r.cuenta}${r.registradoPor ? ' · ' + r.registradoPor : ''}${r.nota ? ' · ' + r.nota : ''}</div>
            </div>
            <div style="font-size:14px;font-weight:900;color:#EF4444;white-space:nowrap;">-${r.monto.toFixed(2)}€</div>
            <button onclick="abrirEditGasto(${idx})" style="background:rgba(14,165,233,0.15);border:1px solid rgba(14,165,233,0.4);border-radius:8px;padding:5px 8px;font-size:14px;cursor:pointer;color:#0EA5E9;">✏️</button>
            ${delBtn}
        `;
        container.appendChild(fila);
    });
    const totFila = document.createElement('div');
    totFila.style.cssText = 'display:flex;justify-content:space-between;padding:8px 12px;border-radius:10px;margin-top:4px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);';
    totFila.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--text-secondary);letter-spacing:1px;">TOTAL HOY</div><div style="font-size:15px;font-weight:900;color:#EF4444;">-${total.toFixed(2)}€</div>`;
    container.appendChild(totFila);
}

function renderizarDesgloseIngresos() {
    const container = document.getElementById('desglose-ingresos');
    if (!container) return;
    const hoy = new Date().toISOString().split('T')[0];
    const registros = (estado.ingresosRegistros || []).filter(r => r.fecha === hoy);
    if (registros.length === 0) {
        container.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:12px 0;">Sin ingresos registrados hoy</div>';
        return;
    }
    const total = registros.reduce((s, r) => s + r.monto, 0);
    container.innerHTML = '';
    const puedeBorrarIng = typeof esMaster === 'function' && esMaster();
    [...registros].reverse().forEach(r => {
        const idx = (estado.ingresosRegistros || []).findIndex(x => x.id === r.id);
        const fila = document.createElement('div');
        fila.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:10px;margin-bottom:5px;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.15);gap:8px;';
        const delBtnIng = puedeBorrarIng ? '<button onclick="eliminarIngreso(' + idx + ', this)" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:5px 8px;cursor:pointer;color:#EF4444;display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>' : '';
        fila.innerHTML = `
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${r.categoria}</div>
                <div style="font-size:10px;color:var(--text-secondary);">${r.hora} · ${r.cuenta}${r.registradoPor ? ' · ' + r.registradoPor : ''}${r.nota ? ' · ' + r.nota : ''}</div>
            </div>
            <div style="font-size:14px;font-weight:900;color:#10B981;white-space:nowrap;">+${r.monto.toFixed(2)}€</div>
            <button onclick="abrirEditIngreso(${idx})" style="background:rgba(14,165,233,0.15);border:1px solid rgba(14,165,233,0.4);border-radius:8px;padding:5px 8px;font-size:14px;cursor:pointer;color:#0EA5E9;">✏️</button>
            ${delBtnIng}
        `;
        container.appendChild(fila);
    });
    const totFila = document.createElement('div');
    totFila.style.cssText = 'display:flex;justify-content:space-between;padding:8px 12px;border-radius:10px;margin-top:4px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);';
    totFila.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--text-secondary);letter-spacing:1px;">TOTAL HOY</div><div style="font-size:15px;font-weight:900;color:#10B981;">+${total.toFixed(2)}€</div>`;
    container.appendChild(totFila);
}

function ejecutarTransferencia() {
    const origen = document.getElementById('transfer-origen').value;
    const destino = document.getElementById('transfer-destino').value;
    const monto = parseFloat(document.getElementById('transfer-monto').value);
    if (origen === destino) { alert('La cuenta origen y destino no pueden ser iguales'); return; }
    if (!monto || monto <= 0) { alert('Ingresa un monto válido'); return; }
    if (estado.cuentas[origen] < monto) { alert('Saldo insuficiente en la cuenta origen'); return; }
    estado.cuentas[origen] -= monto;
    estado.cuentas[destino] += monto;
    // Guardar en historial
    if (!estado.historialTransferencias) estado.historialTransferencias = [];
    const fecha = new Date().toISOString().split('T')[0];
    const hora  = new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    estado.historialTransferencias.push({ id: Date.now() + Math.random(), fecha, hora, origen, destino, monto, registradoPor: sesionActual ? sesionActual.usuario : '?' });
    actualizarSaldos();
    document.getElementById('transfer-monto').value = '';
    guardarEstado();
    renderizarHistorialTransferencias();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}

function renderizarHistorialTransferencias() {
    const container = document.getElementById('historial-transferencias');
    if (!container) return;
    const lista = (estado.historialTransferencias || []);
    if (lista.length === 0) {
        container.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:12px 0;">Sin movimientos registrados</div>';
        return;
    }
    const iconoCuenta = c => ({ efectivo:'💵', bbva:'🏦', caja:'🗄️', monedero:'👛' }[c] || '💰');
    container.innerHTML = '';
    [...lista].reverse().forEach(t => {
        const fila = document.createElement('div');
        fila.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:10px;margin-bottom:5px;background:rgba(14,165,233,0.07);border:1px solid rgba(14,165,233,0.15);gap:8px;';
        fila.innerHTML = `
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${iconoCuenta(t.origen)} ${t.origen} → ${iconoCuenta(t.destino)} ${t.destino}</div>
                <div style="font-size:10px;color:var(--text-secondary);">${t.fecha} ${t.hora}${t.registradoPor ? ' · ' + t.registradoPor : ''}</div>
            </div>
            <div style="font-size:14px;font-weight:900;color:#0EA5E9;white-space:nowrap;">${t.monto.toFixed(2)}€</div>
        `;
        container.appendChild(fila);
    });
}

// Legacy — sustituido por la tabla interactiva en screen-tabla-precios
function editarReglasConsumo() { cambiarPantalla('tabla-precios'); }

// ===== EDITAR / ELIMINAR DESGLOSE =====
let _editIdx = null;

function abrirEditGasto(idx) {
    const r = (estado.gastosRegistros || [])[idx];
    if (!r) return;
    _editIdx = idx;
    document.getElementById('edit-gasto-cuenta').value = r.cuenta || 'efectivo';
    document.getElementById('edit-gasto-monto').value  = r.monto;
    document.getElementById('modalEditGasto').classList.add('active');
}

function guardarEditGasto() {
    const r = (estado.gastosRegistros || [])[_editIdx];
    if (!r) return;
    const cuentaVieja = r.cuenta;
    const montoViejo  = r.monto;
    const cuentaNueva = document.getElementById('edit-gasto-cuenta').value;
    const montoNuevo  = parseFloat(document.getElementById('edit-gasto-monto').value);
    if (!montoNuevo || montoNuevo <= 0) { alert('Monto inválido'); return; }
    // Revertir saldo viejo y aplicar nuevo
    estado.cuentas[cuentaVieja] = (estado.cuentas[cuentaVieja] || 0) + montoViejo;
    estado.cuentas[cuentaNueva] = (estado.cuentas[cuentaNueva] || 0) - montoNuevo;
    // Revertir registrosDiarios
    const diaKey = r.fecha;
    if (estado.registrosDiarios[diaKey]) {
        estado.registrosDiarios[diaKey].gastos = Math.max(0, estado.registrosDiarios[diaKey].gastos - montoViejo + montoNuevo);
    }
    r.cuenta = cuentaNueva;
    r.monto  = montoNuevo;
    guardarEstado();
    actualizarSaldos();
    document.getElementById('modalEditGasto').classList.remove('active');
    renderizarDesgloseGastos();
    if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'EDIT_TRANSACTION', details: 'Editó gasto: ' + r.categoria + ' ' + montoNuevo.toFixed(2) + '€' });
    if (typeof recordTransactionEditOrDelete === 'function' && sesionActual) recordTransactionEditOrDelete(sesionActual.usuario, sesionActual.rol, 'edit', r.id);
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

function eliminarGasto(idx, btnEl) {
    if (typeof esMaster === 'function' && !esMaster()) {
        alert('Solo Jefazo / Jefaza pueden eliminar transacciones.');
        return;
    }
    const r = (estado.gastosRegistros || [])[idx];
    if (!r) return;
    _confirmarBorrado(btnEl, '¿Eliminar gasto "' + r.categoria + '" de ' + r.monto.toFixed(2) + '€?\n\nEsta acción no se puede deshacer.', function() {
        var ts = (r.fecha || '') + ' ' + (r.hora || '');
        if (typeof recordTransactionDeleted === 'function') recordTransactionDeleted(r.monto, r.categoria, ts, sesionActual ? sesionActual.usuario : '?', 'gasto');
        if (typeof recordTransactionEditOrDelete === 'function' && sesionActual) recordTransactionEditOrDelete(sesionActual.usuario, sesionActual.rol, 'delete', r.id);
        estado.cuentas[r.cuenta] = (estado.cuentas[r.cuenta] || 0) + r.monto;
        if (estado.registrosDiarios[r.fecha]) {
            estado.registrosDiarios[r.fecha].gastos = Math.max(0, estado.registrosDiarios[r.fecha].gastos - r.monto);
        }
        estado.gastosRegistros.splice(idx, 1);
        guardarEstado();
        actualizarSaldos();
        renderizarDesgloseGastos();
        if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'DELETE_TRANSACTION', details: 'Eliminó gasto #' + (r.id || idx) + ' ' + r.categoria + ' ' + r.monto.toFixed(2) + '€' });
        if (typeof notifyOtherMaster === 'function') notifyOtherMaster('Eliminó un gasto (' + r.categoria + ' ' + r.monto.toFixed(2) + '€)');
        if (navigator.vibrate) navigator.vibrate([30,50,30]);
    });
}

function abrirEditIngreso(idx) {
    const r = (estado.ingresosRegistros || [])[idx];
    if (!r) return;
    _editIdx = idx;
    // Llenar select de categorías de ingresos
    const sel = document.getElementById('edit-ingreso-categoria');
    sel.innerHTML = '';
    estado.categoriasIngresos.forEach(cat => {
        const op = document.createElement('option');
        op.value = cat.nombre; op.textContent = cat.nombre;
        if (cat.nombre === r.categoria) op.selected = true;
        sel.appendChild(op);
    });
    document.getElementById('edit-ingreso-monto').value = r.monto;
    document.getElementById('modalEditIngreso').classList.add('active');
}

function guardarEditIngreso() {
    const r = (estado.ingresosRegistros || [])[_editIdx];
    if (!r) return;
    const cuentaVieja   = r.cuenta;
    const montoViejo    = r.monto;
    const catNueva      = document.getElementById('edit-ingreso-categoria').value;
    const montoNuevo    = parseFloat(document.getElementById('edit-ingreso-monto').value);
    if (!montoNuevo || montoNuevo <= 0) { alert('Monto inválido'); return; }
    // Revertir saldo y aplicar nuevo (misma cuenta)
    estado.cuentas[cuentaVieja] = (estado.cuentas[cuentaVieja] || 0) - montoViejo + montoNuevo;
    if (estado.registrosDiarios[r.fecha]) {
        estado.registrosDiarios[r.fecha].ingresos = Math.max(0, estado.registrosDiarios[r.fecha].ingresos - montoViejo + montoNuevo);
    }
    r.categoria = catNueva;
    r.monto     = montoNuevo;
    guardarEstado();
    actualizarSaldos();
    document.getElementById('modalEditIngreso').classList.remove('active');
    renderizarDesgloseIngresos();
    if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'EDIT_TRANSACTION', details: 'Editó ingreso: ' + catNueva + ' ' + montoNuevo.toFixed(2) + '€' });
    if (typeof recordTransactionEditOrDelete === 'function' && sesionActual) recordTransactionEditOrDelete(sesionActual.usuario, sesionActual.rol, 'edit', r.id);
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

function eliminarIngreso(idx, btnEl) {
    if (typeof esMaster === 'function' && !esMaster()) {
        alert('Solo Jefazo / Jefaza pueden eliminar transacciones.');
        return;
    }
    const r = (estado.ingresosRegistros || [])[idx];
    if (!r) return;
    _confirmarBorrado(btnEl, '¿Eliminar ingreso "' + r.categoria + '" de ' + r.monto.toFixed(2) + '€?\n\nEsta acción no se puede deshacer.', function() {
        var ts = (r.fecha || '') + ' ' + (r.hora || '');
        if (typeof recordTransactionDeleted === 'function') recordTransactionDeleted(r.monto, r.categoria, ts, sesionActual ? sesionActual.usuario : '?', 'ingreso');
        if (typeof recordTransactionEditOrDelete === 'function' && sesionActual) recordTransactionEditOrDelete(sesionActual.usuario, sesionActual.rol, 'delete', r.id);
        estado.cuentas[r.cuenta] = (estado.cuentas[r.cuenta] || 0) - r.monto;
        if (estado.registrosDiarios[r.fecha]) {
            estado.registrosDiarios[r.fecha].ingresos = Math.max(0, estado.registrosDiarios[r.fecha].ingresos - r.monto);
        }
        estado.ingresosRegistros.splice(idx, 1);
        guardarEstado();
        actualizarSaldos();
        renderizarDesgloseIngresos();
        if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'DELETE_TRANSACTION', details: 'Eliminó ingreso #' + (r.id || idx) + ' ' + r.categoria + ' ' + r.monto.toFixed(2) + '€' });
        if (typeof notifyOtherMaster === 'function') notifyOtherMaster('Eliminó un ingreso (' + r.categoria + ' ' + r.monto.toFixed(2) + '€)');
        if (navigator.vibrate) navigator.vibrate([30,50,30]);
    });
}

