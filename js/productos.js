/* SILBER GESTIÓN — productos.js — Gestión de productos por gramos */

function getProductos() {
    return (estado.productos || []).filter(function(p) { return p.activo !== false; });
}

function getProductoById(id) {
    return (estado.productos || []).find(function(p) { return p.id === id; });
}

function recordStockMovement(productoIdOrName, tipo, cantidad_gramos, usuario) {
    if (!estado.stock_movements) estado.stock_movements = [];
    var ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
    estado.stock_movements.push({
        id: Date.now() + Math.random(),
        producto: productoIdOrName,
        tipo: tipo,
        cantidad_gramos: cantidad_gramos,
        usuario: usuario || (typeof sesionActual !== 'undefined' && sesionActual ? sesionActual.usuario : '?'),
        timestamp: ts
    });
    if (estado.stock_movements.length > 1000) estado.stock_movements = estado.stock_movements.slice(-800);
    guardarEstado();
}

function addProducto(nombre, precio_por_gramo, stock_inicial, stock_minimo) {
    if (!estado.productos) estado.productos = [];
    var id = Date.now() + Math.random();
    var created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    var p = {
        id: id,
        nombre: nombre,
        precio_por_gramo: parseFloat(precio_por_gramo) || 0,
        stock_gramos: parseFloat(stock_inicial) || 0,
        stock_minimo: parseFloat(stock_minimo) || 0,
        activo: true,
        created_at: created_at
    };
    estado.productos.push(p);
    guardarEstado();
    if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'PRODUCT_CREATED', details: 'Producto creado: ' + nombre });
    if (typeof _supabase !== 'undefined' && _supabase && !(typeof window !== 'undefined' && window.__silberTableSyncEnabled)) {
        try { _supabase.from('productos').insert(p).then(function() {}).catch(function(err) { if (console && console.warn) console.warn('[Supabase] productos insert:', err); }); } catch (e) {}
    }
    return p;
}

function updateProducto(id, data) {
    var p = getProductoById(id);
    if (!p) return;
    if (data.nombre != null) p.nombre = data.nombre;
    if (data.precio_por_gramo != null) p.precio_por_gramo = parseFloat(data.precio_por_gramo);
    if (data.stock_gramos != null && !isNaN(parseFloat(data.stock_gramos))) p.stock_gramos = parseFloat(data.stock_gramos);
    if (data.stock_minimo != null) p.stock_minimo = parseFloat(data.stock_minimo);
    guardarEstado();
    if (typeof _supabase !== 'undefined' && _supabase && !(typeof window !== 'undefined' && window.__silberTableSyncEnabled)) {
        try { _supabase.from('productos').upsert(p, { onConflict: 'id' }).then(function() {}).catch(function(err) { if (console && console.warn) console.warn('[Supabase] productos upsert:', err); }); } catch (e) {}
    }
}

function ajustarStock(productoId, cantidad_gramos, tipo) {
    var p = getProductoById(productoId);
    if (!p) return false;
    var nuevo = p.stock_gramos + cantidad_gramos;
    if (nuevo < 0) return false;
    p.stock_gramos = nuevo;
    recordStockMovement(p.id, tipo || 'ajuste', cantidad_gramos, typeof sesionActual !== 'undefined' && sesionActual ? sesionActual.usuario : '?');
    guardarEstado();
    if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'STOCK_ADJUSTMENT', details: 'Ajuste ' + (cantidad_gramos >= 0 ? '+' : '') + cantidad_gramos + 'g en ' + p.nombre });
    if (typeof _supabase !== 'undefined' && _supabase && !(typeof window !== 'undefined' && window.__silberTableSyncEnabled)) {
        try { _supabase.from('productos').update({ stock_gramos: p.stock_gramos }).eq('id', p.id).then(function() {}).catch(function(err) { if (console && console.warn) console.warn('[Supabase] productos update:', err); }); } catch (e) {}
    }
    return true;
}

function getGramosVendidosUltimosDias(productoId, dias) {
    var list = estado.stock_movements || [];
    var desde = new Date();
    desde.setDate(desde.getDate() - (dias || 7));
    var desdeStr = desde.toISOString().split('T')[0];
    return list.filter(function(m) {
        return m.tipo === 'venta' && (m.producto === productoId || m.producto === String(productoId)) && m.timestamp && m.timestamp.slice(0, 10) >= desdeStr;
    }).reduce(function(s, m) { return s + Math.abs(m.cantidad_gramos || 0); }, 0);
}

function predictStockDepletion(productoId) {
    var p = getProductoById(productoId);
    if (!p) return { dias_restantes: 0, consumo_medio: 0 };
    var gramos7 = getGramosVendidosUltimosDias(productoId, 7);
    var consumo_medio = gramos7 / 7;
    if (consumo_medio <= 0) return { dias_restantes: -1, consumo_medio: 0 };
    var dias_restantes = p.stock_gramos / consumo_medio;
    return { dias_restantes: dias_restantes, consumo_medio: consumo_medio };
}

function registrarVentaPorGramos(productoId, cantidad_gramos) {
    var p = getProductoById(productoId);
    if (!p) return { ok: false, msg: 'Producto no encontrado' };
    if (cantidad_gramos <= 0) return { ok: false, msg: 'Cantidad inválida' };
    if (p.stock_gramos < cantidad_gramos) return { ok: false, msg: 'Stock insuficiente' };
    var precio_total = cantidad_gramos * p.precio_por_gramo;
    p.stock_gramos -= cantidad_gramos;
    // Registrar venta también como ingreso financiero para mantener fuente única.
    if (typeof _silberRegistrarIngresoDeuda === 'function') {
        _silberRegistrarIngresoDeuda({
            monto: precio_total,
            cuenta: 'efectivo',
            nota: 'Venta gramos: ' + p.nombre,
            categoria: p.nombre
        });
    }
    recordStockMovement(p.id, 'venta', -cantidad_gramos, typeof sesionActual !== 'undefined' && sesionActual ? sesionActual.usuario : '?');
    guardarEstado();
    if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'PRODUCT_SOLD', user: sesionActual ? sesionActual.usuario : '?', details: 'Venta ' + cantidad_gramos + 'g de ' + p.nombre + ' — ' + precio_total.toFixed(2) + '€' });
    if (p.stock_gramos <= p.stock_minimo) {
        if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'LOW_STOCK_ALERT', details: 'Stock bajo: ' + p.nombre });
    }
    var pred = predictStockDepletion(productoId);
    if (pred.dias_restantes >= 0 && pred.dias_restantes < 5) {
        if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'STOCK_DEPLETION_WARNING', details: 'El stock de ' + p.nombre + ' podría agotarse en menos de 5 días' });
    }
    if (typeof _supabase !== 'undefined' && _supabase && !(typeof window !== 'undefined' && window.__silberTableSyncEnabled)) {
        try {
            _supabase.from('productos').update({ stock_gramos: p.stock_gramos }).eq('id', p.id).then(function() {}).catch(function() {});
            _supabase.from('stock_movements').insert({ producto: p.id, tipo: 'venta', cantidad_gramos: -cantidad_gramos, usuario: sesionActual ? sesionActual.usuario : '?', timestamp: new Date().toISOString().slice(0, 19) }).then(function() {}).catch(function(err) { if (console && console.warn) console.warn('[Supabase] stock_movements:', err); });
        } catch (e) {}
    }
    return { ok: true, precio_total: precio_total };
}

function getProductosStockBajo() {
    return getProductos().filter(function(p) { return p.stock_gramos <= p.stock_minimo; });
}

function getProductosAgotamientoProximo() {
    return getProductos().filter(function(p) {
        var pred = predictStockDepletion(p.id);
        return pred.dias_restantes >= 0 && pred.dias_restantes < 5;
    });
}

function renderProductos() {
    if (typeof esMaster !== 'function') return;
    if (!esMaster()) return;
    var container = document.getElementById('productos-table-body');
    if (!container) return;
    var list = getProductos();
    container.innerHTML = '';
    if (!list.length) {
        container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:16px;">No hay productos. Crea uno desde el botón superior.</td></tr>';
        return;
    }
    list.forEach(function(p) {
        var bajo = p.stock_gramos <= p.stock_minimo;
        var pred = predictStockDepletion(p.id);
        var agotamiento = pred.dias_restantes >= 0 && pred.dias_restantes < 5;
        var row = document.createElement('tr');
        row.style.cssText = bajo ? 'background:rgba(239,68,68,0.08);' : (agotamiento ? 'background:rgba(245,158,11,0.08);' : '');
        row.innerHTML = '<td>' + (p.nombre || '') + '</td>'
            + '<td>' + (p.precio_por_gramo != null ? p.precio_por_gramo.toFixed(2) : '0') + '€/g</td>'
            + '<td>' + (p.stock_gramos != null ? p.stock_gramos.toFixed(0) : '0') + ' g</td>'
            + '<td>' + (p.stock_minimo != null ? p.stock_minimo.toFixed(0) : '0') + ' g</td>'
            + '<td style="white-space:nowrap;">'
            + '<button type="button" class="btn btn-secondary" style="padding:4px 8px;font-size:11px;margin-right:4px;" onclick="abrirEditarProductoModal(' + p.id + ')">Editar</button>'
            + '<button type="button" class="btn btn-secondary" style="padding:4px 8px;font-size:11px;margin-right:4px;" onclick="abrirAjustarStockModal(' + p.id + ')">Ajustar stock</button>'
            + '<button type="button" class="btn btn-primary" style="padding:4px 8px;font-size:11px;" onclick="abrirVentaGramosModal(' + p.id + ')">Vender</button>'
            + '</td>';
        container.appendChild(row);
    });
}

var _productoEditId = null;

function abrirNuevoProductoModal() {
    _productoEditId = null;
    document.getElementById('form-producto-nombre').value = '';
    document.getElementById('form-producto-precio-gramo').value = '';
    document.getElementById('form-producto-stock-inicial').value = '';
    document.getElementById('form-producto-stock-minimo').value = '';
    document.getElementById('modalFormProducto').classList.add('active');
}

function abrirEditarProductoModal(id) {
    var p = getProductoById(id);
    if (!p) return;
    _productoEditId = id;
    document.getElementById('form-producto-nombre').value = p.nombre || '';
    document.getElementById('form-producto-precio-gramo').value = p.precio_por_gramo != null ? p.precio_por_gramo : '';
    document.getElementById('form-producto-stock-inicial').value = p.stock_gramos != null ? p.stock_gramos : '';
    document.getElementById('form-producto-stock-minimo').value = p.stock_minimo != null ? p.stock_minimo : '';
    document.getElementById('modalFormProducto').classList.add('active');
}

function guardarFormProducto() {
    var nombre = document.getElementById('form-producto-nombre').value.trim();
    var precio = parseFloat(document.getElementById('form-producto-precio-gramo').value);
    var stockInicial = parseFloat(document.getElementById('form-producto-stock-inicial').value);
    var stockMinimo = parseFloat(document.getElementById('form-producto-stock-minimo').value);
    if (!nombre) { alert('Nombre obligatorio'); return; }
    if (isNaN(precio) || precio < 0) { alert('Precio por gramo inválido'); return; }
    if (isNaN(stockMinimo) || stockMinimo < 0) { alert('Stock mínimo inválido'); return; }
    if (_productoEditId != null) {
        updateProducto(_productoEditId, { nombre: nombre, precio_por_gramo: precio, stock_minimo: stockMinimo });
        if (!isNaN(stockInicial) && stockInicial >= 0) {
            var p = getProductoById(_productoEditId);
            if (p && p.stock_gramos !== stockInicial) ajustarStock(_productoEditId, stockInicial - p.stock_gramos, 'ajuste');
        }
        document.getElementById('modalFormProducto').classList.remove('active');
        renderProductos();
        if (typeof renderDashboardProductosAlerta === 'function') renderDashboardProductosAlerta();
        return;
    }
    addProducto(nombre, precio, isNaN(stockInicial) ? 0 : stockInicial, stockMinimo);
    document.getElementById('modalFormProducto').classList.remove('active');
    renderProductos();
    if (typeof renderDashboardProductosAlerta === 'function') renderDashboardProductosAlerta();
}

function cerrarFormProducto() {
    document.getElementById('modalFormProducto').classList.remove('active');
}

var _productoAjusteId = null;

function abrirAjustarStockModal(id) {
    var p = getProductoById(id);
    if (!p) return;
    _productoAjusteId = id;
    document.getElementById('ajuste-producto-nombre').textContent = p.nombre;
    document.getElementById('ajuste-cantidad').value = '';
    document.getElementById('ajuste-tipo').value = 'ajuste';
    document.getElementById('modalAjustarStock').classList.add('active');
}

function ejecutarAjusteStock() {
    if (_productoAjusteId == null) return;
    var cantidad = parseFloat(document.getElementById('ajuste-cantidad').value);
    var tipo = document.getElementById('ajuste-tipo').value || 'ajuste';
    if (isNaN(cantidad) || cantidad === 0) { alert('Indica cantidad (positiva para sumar, negativa para restar)'); return; }
    if (!ajustarStock(_productoAjusteId, cantidad, tipo)) { alert('No se puede restar más del stock actual'); return; }
    document.getElementById('modalAjustarStock').classList.remove('active');
    renderProductos();
    if (typeof renderDashboardProductosAlerta === 'function') renderDashboardProductosAlerta();
}

function cerrarAjustarStock() {
    document.getElementById('modalAjustarStock').classList.remove('active');
}

var _productoVentaId = null;

function abrirVentaGramosModal(id) {
    var p = getProductoById(id);
    if (!p) return;
    _productoVentaId = id;
    document.getElementById('venta-producto-nombre').textContent = p.nombre;
    document.getElementById('venta-precio-gramo').textContent = p.precio_por_gramo != null ? p.precio_por_gramo.toFixed(2) + '€/g' : '—';
    document.getElementById('venta-stock-actual').textContent = (p.stock_gramos != null ? p.stock_gramos.toFixed(0) : '0') + ' g';
    document.getElementById('venta-gramos').value = '';
    document.getElementById('venta-total').textContent = '0.00€';
    document.getElementById('venta-gramos').oninput = function() {
        var g = parseFloat(this.value) || 0;
        document.getElementById('venta-total').textContent = (g * p.precio_por_gramo).toFixed(2) + '€';
    };
    document.getElementById('modalVentaGramos').classList.add('active');
}

function ejecutarVentaGramos() {
    if (_productoVentaId == null) return;
    var cantidad = parseFloat(document.getElementById('venta-gramos').value);
    if (isNaN(cantidad) || cantidad <= 0) { alert('Indica cantidad en gramos'); return; }
    var r = registrarVentaPorGramos(_productoVentaId, cantidad);
    if (!r.ok) {
        alert(r.msg || 'Stock insuficiente');
        return;
    }
    document.getElementById('modalVentaGramos').classList.remove('active');
    renderProductos();
    if (typeof renderDashboardProductosAlerta === 'function') renderDashboardProductosAlerta();
    if (typeof actualizarSaldos === 'function') actualizarSaldos();
    alert('Venta registrada: ' + r.precio_total.toFixed(2) + '€');
}

function cerrarVentaGramos() {
    document.getElementById('modalVentaGramos').classList.remove('active');
}

function renderDashboardProductosAlerta() {
    var box = document.getElementById('dashboard-productos-alerta');
    var body = document.getElementById('dashboard-productos-alerta-body');
    if (!box) return;
    if (typeof esMaster !== 'function') { box.style.display = 'none'; return; }
    if (!esMaster()) { box.style.display = 'none'; return; }
    var bajos = getProductosStockBajo();
    var proximos = getProductosAgotamientoProximo().filter(function(p) { return !bajos.find(function(b) { return b.id === p.id; }); });
    if (bajos.length === 0 && proximos.length === 0) {
        box.style.display = 'none';
        if (body) body.innerHTML = '';
        return;
    }
    box.style.display = 'block';
    var html = '';
    if (bajos.length) {
        html += '<div style="font-size:11px;font-weight:700;color:#EF4444;margin-bottom:4px;">Stock bajo</div>';
        bajos.forEach(function(p) {
            html += '<div style="font-size:12px;color:var(--text-primary);">' + p.nombre + ' — ' + (p.stock_gramos || 0).toFixed(0) + ' g</div>';
        });
    }
    if (proximos.length) {
        html += '<div style="font-size:11px;font-weight:700;color:#F59E0B;margin-top:8px;margin-bottom:4px;">Se agotará pronto</div>';
        proximos.forEach(function(p) {
            var pred = predictStockDepletion(p.id);
            var dias = pred.dias_restantes >= 0 ? pred.dias_restantes.toFixed(0) : '?';
            html += '<div style="font-size:12px;color:var(--text-primary);">' + p.nombre + ' — ~' + dias + ' días</div>';
        });
    }
    if (body) body.innerHTML = html;
}
