/* SILBER GESTIÓN — metrics.js — Métricas del negocio desde transacciones */

function getBusinessMetrics() {
    var gastos = estado.gastosRegistros || [];
    var ingresos = estado.ingresosRegistros || [];
    var hoy = new Date().toISOString().split('T')[0];
    var now = new Date();

    function dateKey(d) { return d.toISOString().split('T')[0]; }
    function startOfWeek(d) { var x = new Date(d); x.setDate(x.getDate() - x.getDay() + 1); return dateKey(x); }
    function startOfMonth(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }

    var todayStart = dateKey(now);
    var weekStart = startOfWeek(now);
    var monthStart = startOfMonth(now);

    var ingHoy = 0, gasHoy = 0, countIngHoy = 0, countGasHoy = 0;
    var ingWeek = 0, gasWeek = 0, countIngWeek = 0, countGasWeek = 0;
    var ingMonth = 0, gasMonth = 0, countIngMonth = 0, countGasMonth = 0;
    var byCatIng = {}, byCatGas = {};

    ingresos.forEach(function(r) {
        var f = r.fecha || '';
        var m = r.monto || 0;
        byCatIng[r.categoria] = (byCatIng[r.categoria] || 0) + m;
        if (f === todayStart) { ingHoy += m; countIngHoy++; }
        if (f >= weekStart) { ingWeek += m; countIngWeek++; }
        if (f >= monthStart) { ingMonth += m; countIngMonth++; }
    });
    gastos.forEach(function(r) {
        var f = r.fecha || '';
        var m = r.monto || 0;
        byCatGas[r.categoria] = (byCatGas[r.categoria] || 0) + m;
        if (f === todayStart) { gasHoy += m; countGasHoy++; }
        if (f >= weekStart) { gasWeek += m; countGasWeek++; }
        if (f >= monthStart) { gasMonth += m; countGasMonth++; }
    });

    var totalTx = ingresos.length + gastos.length;
    var totalMonto = ingresos.reduce(function(s, r) { return s + (r.monto || 0); }, 0) + gastos.reduce(function(s, r) { return s + (r.monto || 0); }, 0);
    var avgTx = totalTx > 0 ? totalMonto / totalTx : 0;
    var daysWithData = {};
    ingresos.concat(gastos).forEach(function(r) { if (r.fecha) daysWithData[r.fecha] = true; });
    var numDays = Object.keys(daysWithData).length || 1;
    var txPerDay = totalTx / numDays;

    var topIng = Object.keys(byCatIng).map(function(c) { return { name: c, value: byCatIng[c] }; }).sort(function(a, b) { return b.value - a.value; }).slice(0, 5);
    var topGas = Object.keys(byCatGas).map(function(c) { return { name: c, value: byCatGas[c] }; }).sort(function(a, b) { return b.value - a.value; }).slice(0, 5);

    return {
        daily_income: ingHoy,
        daily_expenses: gasHoy,
        daily_profit: ingHoy - gasHoy,
        weekly_income: ingWeek,
        weekly_expenses: gasWeek,
        weekly_profit: ingWeek - gasWeek,
        monthly_income: ingMonth,
        monthly_expenses: gasMonth,
        monthly_profit: ingMonth - gasMonth,
        avg_transaction_value: avgTx,
        transactions_per_day: txPerDay,
        total_transactions: totalTx,
        top_income_categories: topIng,
        top_expense_categories: topGas
    };
}

function renderizarMetricas() {
    var container = document.getElementById('metricas-content');
    if (!container) return;
    if (typeof esMaster !== 'function' || !esMaster()) return;
    var m = getBusinessMetrics();
    container.innerHTML = ''
        + '<div class="section-card" style="margin-bottom:12px;"><div class="section-title">📅 Hoy</div>'
        + '<div class="stat-row"><span>Ingresos</span><strong style="color:#10B981;">+' + m.daily_income.toFixed(2) + '€</strong></div>'
        + '<div class="stat-row"><span>Gastos</span><strong style="color:#EF4444;">-' + m.daily_expenses.toFixed(2) + '€</strong></div>'
        + '<div class="stat-row"><span>Beneficio neto</span><strong style="color:' + (m.daily_profit >= 0 ? '#10B981' : '#EF4444') + ';">' + m.daily_profit.toFixed(2) + '€</strong></div></div>'
        + '<div class="section-card" style="margin-bottom:12px;"><div class="section-title">📆 Semana</div>'
        + '<div class="stat-row"><span>Ingresos</span><strong style="color:#10B981;">+' + m.weekly_income.toFixed(2) + '€</strong></div>'
        + '<div class="stat-row"><span>Gastos</span><strong style="color:#EF4444;">-' + m.weekly_expenses.toFixed(2) + '€</strong></div>'
        + '<div class="stat-row"><span>Beneficio</span><strong>' + m.weekly_profit.toFixed(2) + '€</strong></div></div>'
        + '<div class="section-card" style="margin-bottom:12px;"><div class="section-title">📊 Mes</div>'
        + '<div class="stat-row"><span>Ingresos</span><strong style="color:#10B981;">+' + m.monthly_income.toFixed(2) + '€</strong></div>'
        + '<div class="stat-row"><span>Gastos</span><strong style="color:#EF4444;">-' + m.monthly_expenses.toFixed(2) + '€</strong></div>'
        + '<div class="stat-row"><span>Beneficio</span><strong>' + m.monthly_profit.toFixed(2) + '€</strong></div></div>'
        + '<div class="section-card" style="margin-bottom:12px;"><div class="section-title">📈 Indicadores</div>'
        + '<div class="stat-row"><span>Valor medio transacción</span><strong>' + m.avg_transaction_value.toFixed(2) + '€</strong></div>'
        + '<div class="stat-row"><span>Transacciones por día</span><strong>' + m.transactions_per_day.toFixed(1) + '</strong></div></div>'
        + '<div class="section-card" style="margin-bottom:12px;"><div class="section-title">🏆 Top categorías ingresos</div>'
        + (m.top_income_categories.length ? m.top_income_categories.map(function(c) { return '<div class="stat-row"><span>' + c.name + '</span><strong style="color:#10B981;">' + c.value.toFixed(2) + '€</strong></div>'; }).join('') : '<p style="color:var(--text-secondary);font-size:12px;">Sin datos</p>')
        + '</div>'
        + '<div class="section-card"><div class="section-title">📉 Top categorías gastos</div>'
        + (m.top_expense_categories.length ? m.top_expense_categories.map(function(c) { return '<div class="stat-row"><span>' + c.name + '</span><strong style="color:#EF4444;">' + c.value.toFixed(2) + '€</strong></div>'; }).join('') : '<p style="color:var(--text-secondary);font-size:12px;">Sin datos</p>')
        + '</div>';
}
