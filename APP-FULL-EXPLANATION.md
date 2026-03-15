# Silber Gestión — Documentación técnica completa

Documento de análisis y explicación del funcionamiento interno de la aplicación. **No se ha modificado ningún código.**

---

## 1. GENERAL OVERVIEW

### Purpose
**Silber Gestión** es una aplicación web de gestión financiera y de stock para un negocio (tienda/oficina). Permite registrar gastos e ingresos, gestionar clientes y deudas, controlar stock de productos (gramos B/V), hacer transferencias entre cuentas, cerrar el día y ver un dashboard con ingresos vs objetivo.

### Main workflow
1. **Login:** El usuario introduce usuario y contraseña (o Face ID/huella). Se valida contra la lista de usuarios con rol (MASTER/ADMIN) o contra la lista de gorriones (WORKER). La sesión se guarda en `localStorage` y opcionalmente se activa biometría.
2. **Dashboard:** Pantalla principal con donut (ingresos vs objetivo 500€), selector de período (día/semana/mes/año), máquina del tiempo (ver día anterior), resumen de gastos/ingresos/deuda y ranking de “equipo”.
3. **Registro de movimientos:** Desde Gastos o Ingresos se elige una categoría y se abre un modal para monto, cuenta, nota y (en recargas) gramos. Al guardar se actualizan cuentas, registros diarios, desgloses y, si aplica, stock.
4. **Clientes y deudas:** Se pueden dar de alta clientes (con límite de crédito, día de pago, producto). Las deudas pendientes y los pagos se registran en modales; la deuda se mantiene en `estado.clientes` y en un almacén aparte `db_deudas` (localStorage).
5. **Cierre del día:** Desde Oficina se abre el modal de cierre con resumen de efectivo, guardado, ventas B/V y neto estimado. Se puede confirmar cierre o registrar descuadre con nota.
6. **Persistencia:** Casi todo el estado se guarda en `localStorage` bajo la clave `silber_gestion_v2`. Opcionalmente las transacciones se envían también a Supabase (tabla `transacciones`).

---

## 2. USER ROLES

### Login system
- **Credenciales:** Usuario + contraseña. Opcionalmente Face ID/huella (WebAuthn) si ya se ha entrado alguna vez.
- **Fuentes de validación:**
  1. **USUARIOS** (en `state.js`): array con `username`, `password`, `role` (`'MASTER'` o `'ADMIN'`). Por defecto solo hay dos MASTER: Jefaza y Jefazo.
  2. **Gorriones** (localStorage `db_gorriones`): lista de trabajadores con `usuario`, `password`, `nombre`, `numero`, etc. Si el login coincide con un gorrión, se asigna rol **WORKER**.

- **Sesión guardada:** `sesionActual = { usuario, rol }`. Para WORKER que vienen de gorriones también se guardan `gorrionIdx`, `nombre`, `numero` para el botón “Mi contraseña” y el desglose de gastos por gorrión.
- **Helpers:** `esMaster()`, `esAdmin()`, `esWorker()`, `esJefe()` (= esMaster), `esGorrion()` (= esWorker).

### MASTER
- **Quiénes:** Jefaza y Jefazo (definidos en `USUARIOS` con `role: 'MASTER'`).
- **Qué pueden hacer:** Acceso completo. Ven todas las categorías (incluidas Recarga B/V), pueden registrar gastos e ingresos sin restricción, acceder a Oficina, deudas, pagos de deuda, cierre del día, biometría, cuentas, transferencias, stock, tabla de precios, alertas y configuración. No se oculta ninguna pantalla ni botón.

### ADMIN
- **Definición:** Usuarios en `USUARIOS` con `role: 'ADMIN'`. Por defecto no hay ninguno; se pueden añadir en el array.
- **Objetivo:** Permisos medios (gestión de transacciones y dashboard). En el código actual **no hay restricciones específicas para ADMIN**: se valida en login y en restauración de sesión, pero la lógica de pantallas usa `esJefe()` (MASTER) y `esGorrion()` (WORKER). Para restringir después se pueden usar `esAdmin()` en condiciones sin romper lo existente.

### WORKER
- **Quiénes:** Usuarios que entran por la lista de gorriones (localStorage `db_gorriones`) o, en teoría, usuarios en `USUARIOS` con `role: 'WORKER'` (no hay ninguno por defecto).
- **Restricciones actuales:**
  - En **Gastos:** no ven las categorías de tipo recarga (Recarga B, Recarga V); solo gastos normales. Además, para registrar un gasto deben adjuntar foto (obligatorio).
  - En **Ingresos:** se oculta el botón “Registrar Pago de Deuda”; solo ven “Registrar Deuda Pendiente”.
  - Se muestra el botón flotante “Mi contraseña” para cambiar la contraseña del gorrión.
- Los gastos que registran se guardan también en `estado.gastosGorriones` con su usuario, número y foto.

### Gorriones
- **Qué son:** Trabajadores/empleados que se dan de alta desde la pantalla Gorriones (Oficina → Gorriones). Se guardan en localStorage `db_gorriones` con: `numero`, `nombre`, `telefono`, `direccion`, `usuario`, `password` (generados automáticamente).
- **Relación con roles:** Al iniciar sesión con ese usuario/contraseña se asigna rol **WORKER** y se mantienen `gorrionIdx`, `nombre`, `numero` en la sesión para la UI y el desglose de gastos por gorrión.

---

## 3. MAIN MODULES

| Module | Description | Main file(s) |
|--------|-------------|--------------|
| **Dashboard** | Donut (ingresos vs objetivo 500€), período día/semana/mes/año, máquina del tiempo, resumen gastos/ingresos/deuda, ranking de equipo. | `dashboard.js` (dibujarDonut, cambiarPeriodo, cambiarDia, renderizarRanking, actualizarSaldos) |
| **Transactions (gastos/ingresos)** | Modal de transacción por categoría, guardado en estado + Supabase, desglose del día, editar/eliminar gasto o ingreso. | `transacciones.js` (guardarTransaccion, renderizarDesgloseGastos/Ingresos, abrirEditGasto/Ingreso, eliminarGasto/Ingreso); categorías y grid en `dashboard.js` (renderizarCategoriasGastos/Ingresos) |
| **Clients / deudas** | Alta de clientes (nombre, WhatsApp, límite, día pago, producto), lista con filtros (todos/pendientes/hoy), detalle cliente, deuda pendiente, pago de deuda, sirena por exceso de crédito. | `clientes.js` (guardarCliente, renderizarClientes, renderizarOficina, guardarDeudaPendiente, guardarDeudaPagada, altaClienteDeuda, confirmarAumentarCredito, etc.) |
| **Gorriones** | Lista de gorriones, alta, ficha (editar teléfono/contraseña), eliminar. | `clientes.js` (cargarGorriones, guardarGorriones, renderizarGorriones, guardarGorrion, guardarCambiosGorrion, eliminarGorrion); lista en localStorage `db_gorriones` |
| **Transfers** | Formulario origen/destino/monto entre efectivo, BBVA, caja, monedero; historial de movimientos. | `transacciones.js` (ejecutarTransferencia, renderizarHistorialTransferencias); saldos en `dashboard.js` (actualizarSaldos) |
| **Price table** | Tabla de productos con precio, gramaje, stock; botón editar abre modal para cambiar precio/gramaje/stock. | `ui.js` (renderizarTablaPrecios, abrirEditarProducto, guardarEditarProducto, renderizarListaStock); datos en `estado.stockProductos` |
| **Daily closing** | Modal con resumen: efectivo (ingresos - gastos), guardado, ventas B/V del día, stock restante, neto estimado; confirmar cierre o registrar descuadre con nota; historial de cierres. | `ui.js` (abrirCierreDia, revueltaDiaria, confirmarCierre, registrarDescuadre, _registrarEntradaCierre) |
| **Alerts** | Alertas de crédito: cuando un WORKER intenta registrar una deuda que supera el límite del cliente, se muestra la sirena y se guarda en `estado.alertasJefes`. Los jefes pueden ver la lista en “Alertas de Crédito”. | `clientes.js` (guardarDeudaPendiente cuando excede límite, abrirAlertasJefes en ui.js) |
| **PWA** | Manifest y favicon generados por JS, Service Worker en Blob para cache offline (`silber-gestion-v1`). | `app.js` (final del archivo: manifest, favicon, apple-touch-icon, registro del SW) |

---

## 4. TRANSACTION LOGIC

### How transactions are saved
1. **Modal:** El usuario elige categoría (gasto o ingreso), introduce monto, cuenta (efectivo/bbva/caja/monedero), opcionalmente nota y, si aplica, gramos (recargas).
2. **Validación:** Monto > 0; si es WORKER y gasto, debe haber foto.
3. **Supabase (opcional):** Si `_supabase` está configurado, se hace `insert` en la tabla `transacciones` con tipo, categoria (nombre), monto, cuenta, gramos, nota, registrado_por. Si falla, se muestra alert y no se continúa (el estado local no se actualiza en ese caso).
4. **Estado local:**
   - **Gasto:** Se resta el monto de `estado.cuentas[cuenta]`, se suma a `estado.registrosDiarios[fechaHoy].gastos`, se añade un registro a `estado.gastosRegistros` (id, fecha, hora, registradoPor, categoria, monto, cuenta, nota). Si es recarga y hay gramos, se suma a `stockTotalB` o `stockTotalV` y se añade entrada a `estado.listaStock`; además `estado.stock[recargaB|recargaV]` acumula el monto. Si es WORKER, también se guarda en `estado.gastosGorriones` con foto.
   - **Ingreso:** Se suma el monto a la cuenta, a `registrosDiarios[fechaHoy].ingresos` y se añade registro a `estado.ingresosRegistros`. Si la categoría coincide con un producto de `stockProductos` (precio/gramaje), se calculan gramos vendidos y se restan de `prod.stock`, `stockTotalB` o `stockTotalV`. Si la categoría es Recarga B/V y hay gramos, se restan de `stockTotalB`/`stockTotalV` y se guardan en el último registro de ingresos (`gramos`, `esRecarga`).
5. **Persistencia:** Se llama `guardarEstado()` (localStorage `silber_gestion_v2`).

### Categories
- **Gastos:** `estado.categoriasGastos`. Cada categoría tiene nombre, color, icon (emoji o SVG), y opcionalmente `esRecarga: false | 'recargaB' | 'recargaV'`. Las de tipo recarga se ocultan a WORKER y muestran campo de gramos en el modal.
- **Ingresos:** `estado.categoriasIngresos`. Incluyen productos (Bolsa, Piedra 28, etc.) y categorías como Otros, Deuda, etc. Algunas tienen `esRecarga` para descontar gramos del stock total.
- Se gestionan en el “Gestor de categorías” (crear, editar, eliminar); se persisten dentro de `estado` en localStorage.

### How balances are calculated
- **Cuentas:** `estado.cuentas` tiene efectivo, bbva, caja, monedero. Cada transacción suma o resta del monto en la cuenta elegida. Las transferencias restan del origen y suman al destino. No hay recálculo desde cero; todo es acumulativo en memoria.
- **Dashboard (día):** Gastos e ingresos del día vienen de `estado.registrosDiarios[fecha]` (clave fecha ISO). Para semana/mes/año, `getDiaData()` recorre `registrosDiarios` y suma gastos/ingresos de las fechas en el rango.
- **Deuda total:** Suma de `c.deuda` de todos los `estado.clientes`.

### Donut and rankings
- **Donut:** En `dibujarDonut()` se usa `getDiaData(estado.diaOffset)` para obtener ingresos (y gastos) del día o del período. El objetivo fijo es 500€. Se dibuja un arco en canvas cuyo ángulo es `(ingresos / 500) * 360` (máximo 100%). Si hay Supabase y es “hoy”, `cargarDatosDashboard()` puede sobrescribir `registrosDiarios[hoy]` con datos de la nube y luego se redibuja el donut.
- **Ranking:** Es estático por ahora: se ordena `estado.trabajadores` por ventas y se muestra en la sección “Equipo”. Los valores (ventas, avatares) vienen del estado inicial o guardado; no se recalculan a partir de transacciones reales por trabajador.

---

## 5. PRODUCT / MATERIAL LOGIC

### Product table
- **Sí existe:** `estado.stockProductos` es un objeto cuya clave es el nombre del producto (ej. `'Bolsa'`, `'Piedra 28'`, `'Verde'`, `'Brócoli 3'`). Cada producto tiene `precio`, `gramaje`, `stock` (en gramos). Se edita desde la pantalla “Tabla de precios” (modal editar producto); `guardarEditarProducto()` actualiza ese objeto y recalcula `stockTotalB` y `stockTotalV` a partir de la suma de `stock` de cada producto (B = no Verde/Brócoli, V = Verde y Brócoli).

### Stock reduction on sale
- **Sí.** Al registrar un **ingreso** cuya categoría coincide con un producto en `stockProductos` (y tiene precio y gramaje):
  - Se calcula `gramosVendidos = (monto / precio) * gramaje`.
  - Se resta de `prod.stock`.
  - Según si el producto es “Verde” o “Brócoli” (V) o no (B), se resta de `estado.stockTotalV` o `estado.stockTotalB`.
- Si el ingreso es por categoría “Recarga B” o “Recarga V” y el usuario introduce gramos, se restan esos gramos directamente de `stockTotalB` o `stockTotalV` (stock total en gramos de material), y el registro de ingreso guarda `gramos` y `esRecarga` para el cierre del día.

### How quantities are tracked
- **Por producto:** `stockProductos[nombre].stock` en gramos; se actualiza al registrar ingresos por ese producto y al editar manualmente en la tabla de precios.
- **Totales por tipo B/V:** `stockTotalB` y `stockTotalV` (gramos). Suben al registrar **gastos** de tipo Recarga B/V con gramos (compra de material); bajan al registrar **ingresos** por productos B/V (venta) o por Recarga B/V con gramos (venta directa de gramos).
- **Lista de entradas:** `estado.listaStock` guarda cada “compra” de recarga (id, nombre, fecha, gramos, tipo recargaB/recargaV, monto) para historial; no se usa para descontar, solo para mostrar en pantalla Stock.

---

## 6. STOCK MANAGEMENT

### Where it is stored
- **En el estado global** (y en localStorage vía `guardarEstado()`):
  - `estado.stockProductos`: precio, gramaje, stock por producto.
  - `estado.stockTotalB`, `estado.stockTotalV`: totales en gramos (tipo B y V).
  - `estado.stock`: objeto con `recargaB` y `recargaV` que acumula **importe en euros** gastado en recargas (no gramos).
  - `estado.listaStock`: array de entradas de compra de recarga (para listado en pantalla Stock).
  - `estado.costePorGramoB`, `estado.costePorGramoV`: usados en cierre para calcular coste de gramos vendidos.

### How it is updated
- **Alta de stock (gasto Recarga B/V con gramos):** Aumentan `stockTotalB` o `stockTotalV` y se añade elemento a `listaStock`.
- **Venta (ingreso por producto de la tabla):** Se reduce `stockProductos[cat].stock` y `stockTotalB` o `stockTotalV`.
- **Venta directa Recarga B/V (ingreso con gramos):** Se reduce `stockTotalB` o `stockTotalV`; el registro de ingreso guarda gramos y esRecarga.
- **Edición manual en Tabla de precios:** Al guardar producto se actualiza `stockProductos` y se recalculan `stockTotalB` y `stockTotalV` como suma de los `stock` de cada producto (B o V). Esto puede **sobrescribir** los totales que venían de transacciones si no cuadran.

### Connection to transactions
- Gastos con categoría Recarga B/V y gramos incrementan stock total y lista.
- Ingresos con categoría = nombre de producto en `stockProductos` reducen stock del producto y totales B/V.
- Ingresos con categoría Recarga B/V y gramos reducen solo totales B/V y quedan registrados en el registro de ingreso para el cierre.

---

## 7. PRICE TABLE

- **Pantalla:** Tabla de precios (`screen-tabla-precios`). Muestra cada producto de `estado.stockProductos` con precio, gramaje, stock y botón editar.
- **Edición:** Modal con precio, gramaje y stock. Al guardar se actualiza `estado.stockProductos[cat]` y se recalculan `stockTotalB` y `stockTotalV` a partir de la suma de los `stock` de cada producto (B vs V).
- **Link to consumption:** Sí. Las categorías de **ingreso** que coinciden con el nombre de un producto en `stockProductos` (y tienen precio y gramaje) provocan el descuento automático de stock al registrar el ingreso. La tabla de precios es la fuente de verdad para precio, gramaje y stock por producto; los totales B/V se derivan de ahí al editar, y también se actualizan en cada transacción de ingreso/gasto de recarga.

---

## 8. WEEKLY OR PERIODIC INVENTORY

- **No hay inventario por semana o período** en el sentido de “conteo físico” o “ajuste por período”.
- **Lo que sí hay:**
  - **Selector de período en dashboard:** Día, Semana, Mes, Año. Solo cambia la **agregación** de gastos/ingresos para el donut y los totales mostrados; usa `registrosDiarios` y suma por rango de fechas. No hay pantalla de “inventario semanal”.
  - **Revuelta diaria:** Al cambiar el día (medianoche o al detectar nuevo día), se guarda un snapshot del día anterior en `estado.historialDias[diaAnterior]` (ingresos, gastos, ventasB, ventasV, stockB, stockV) para historial. No es un inventario periódico editable ni un reporte por semana.
- **Conclusión:** No existe un módulo de inventario semanal o por período; solo agregación de transacciones por período y snapshot del día anterior en `historialDias`.

---

## 9. DATABASE STRUCTURE

### localStorage
- **`silber_gestion_v2`:** Objeto `estado` completo (cuentas, registrosDiarios, gastosRegistros, ingresosRegistros, clientes, stockProductos, listaStock, stockTotalB/V, categorías, historialPantallas, trabajadores, etc.). Es la fuente principal de persistencia.
- **`silber_sesion_activa`:** Sesión actual (usuario, rol, y si aplica gorrionIdx, nombre, numero).
- **`db_gorriones`:** Array de gorriones (numero, nombre, telefono, direccion, usuario, password).
- **`db_deudas`:** Objeto con `clientes`, `deudas`, `historial` usado para deudas pendientes/pagadas y alta de cliente desde Config; se sincroniza con `estado.clientes` para la lista visible.
- **`silber_biometric_creds`:** Credenciales para Face ID (copia de sesión).
- **`silber_webauthn_id` / `silber_webauthn_id_2`:** IDs de credenciales WebAuthn para los dos slots de biometría.

### Supabase
- **Solo tabla `transacciones`:** Insert al guardar una transacción (tipo, categoria, monto, cuenta, gramos, nota, registrado_por). Select en `cargarDatosDashboard()` para el día actual (por `created_at`) para refrescar ingresos/gastos del día y el donut. No hay update/delete ni otras tablas (clientes, productos, stock, etc.) en Supabase.

### Objects used
- **Transacciones:** En estado: `gastosRegistros`, `ingresosRegistros` (arrays de registros con id, fecha, hora, categoria, monto, cuenta, nota, registradoPor; en ingresos puede haber gramos y esRecarga). Agregado por día: `registrosDiarios[fecha] = { gastos, ingresos }`.
- **Clientes:** `estado.clientes` (id, nombre, whatsapp, limite, diaPago, producto, deuda, historial). Paralelamente `db_deudas.clientes` y `db_deudas.deudas` para el flujo de deuda pendiente/pagada.
- **Productos:** `estado.stockProductos` (clave = nombre; valor = { precio, gramaje, stock }). Totales: `stockTotalB`, `stockTotalV`; lista de entradas: `listaStock`.

---

## 10. POTENTIAL LOGIC ISSUES

- **Stock deduction:**
  - Al **editar** un producto en la tabla de precios, `stockTotalB` y `stockTotalV` se recalculan como suma de los `stock` de cada producto. Si los totales se habían movido solo por transacciones (recargas con gramos, ventas), ese recálculo puede no coincidir con la realidad si hubo ingresos por “Recarga B/V” con gramos (que no tocan `stockProductos`, solo totales). Riesgo de desajuste entre totales y suma de productos.
  - No hay validación de stock negativo al registrar un ingreso por producto; se usa `Math.max(0, ...)` pero se puede vender más de lo que hay si hay errores de datos.

- **Transaction processing:**
  - Si Supabase falla en el insert, se muestra alert y se sale sin actualizar estado local; si Supabase tiene éxito pero `guardarEstado()` falla después, los datos quedan en memoria pero no en localStorage. No hay cola de reintento ni rollback explícito.
  - Al eliminar o editar un gasto/ingreso del desglose se actualizan cuentas y `registrosDiarios`, pero **no** se envía ningún update/delete a Supabase; la nube queda desincronizada.

- **Data synchronization:**
  - **Dos fuentes de clientes:** `estado.clientes` y `db_deudas.clientes` se mantienen en paralelo en varios puntos (alta cliente desde Config, deuda pendiente/pagada, sirena). Si una operación escribe en uno y no en el otro, pueden divergir.
  - **Dashboard y “máquina del tiempo”:** Solo el día actual se puede refrescar desde Supabase; los días anteriores usan solo `registrosDiarios` local. Varios dispositivos el mismo día pueden sobrescribirse al cargar desde Supabase.
  - **Gorriones:** Solo en localStorage; no hay sincronización con ningún backend. Cambios en un dispositivo no se ven en otro.

- **Ranking:** Los “trabajadores” y sus ventas son datos estáticos en estado; no se recalculan a partir de quién registró cada transacción (aunque `registradoPor` se guarda en los registros). El ranking no refleja ventas reales por usuario.

- **Cierre del día:** El neto se calcula como ingresos totales del día menos coste (gramos vendidos B/V × coste por gramo). Los gramos vendidos se derivan de ingresos con categoría en productos o con esRecarga+gramos. Si falta algún registro o hay categorías que no están en productos, el neto puede ser inexacto.

---

*Documento generado a partir del análisis del código del proyecto Silber Gestión. Solo documentación; no se ha modificado código.*
