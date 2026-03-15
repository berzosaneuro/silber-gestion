# Refactor estructural — SILBER GESTIÓN

Refactor **solo estructural**: mismo diseño, misma UI, misma lógica. Solo se ha organizado el código en archivos separados.

---

## Nueva estructura de archivos

```
/Silber Gestion (o silber-gestion)
├── index.html          ← Solo HTML (sin <style> ni <script> inline)
├── logo.png
├── vercel.json
├── css/
│   └── styles.css      ← Todo el CSS extraído del <style>
└── js/
    ├── state.js        ← Estado global y localStorage
    ├── supabase.js     ← Conexión Supabase y carga de datos dashboard
    ├── dashboard.js    ← Donut, período, ranking, categorías, saldos
    ├── transacciones.js← Gastos/ingresos, transferencias, desgloses
    ├── clientes.js     ← Clientes, deudas, gorriones, db_deudas
    ├── ui.js           ← Navegación, modales, tabla precios, cierre día, biometría, borrado
    └── app.js          ← Inicialización, login, Face ID, PWA (manifest/service worker)
```

---

## Qué hay en cada archivo

### `css/styles.css`
- Variables CSS (`:root`), keyframes, estilos globales (html, body, scanlines, glow).
- Layout: `.app-container`, `.screen`, header, bottom-nav, back/menu.
- Componentes: donut, period selector, ranking, summary cards, categories, section cards, inputs, botones, modales, time machine, menu overlay, foto-preview, fab, cliente-card, historial, empty-state.
- Regla específica del login: `#screen-login input::placeholder`.

### `js/state.js`
- `STORAGE_KEY`, `cargarEstado()`, `guardarEstado()`.
- `estadoInicial`, carga desde localStorage, saneo de `historialPantallas` y `stockProductos`.
- Asignación de `estado.categoriasGastos` y `estado.categoriasIngresos`.
- Helpers: `fechaConOffset()`, `labelDia()`, `getDiaData()`.
- `USUARIOS_JEFE`, `sesionActual`.

### `js/supabase.js`
- `SUPABASE_URL`, `SUPABASE_KEY`, `_supabase` (inicialización condicional).
- `cargarDatosDashboard()`: select de transacciones del día y actualización de UI/donut.

### `js/dashboard.js`
- Máquina del tiempo: `cambiarDia()`, `actualizarTimeMachine()`.
- Donut: `dibujarDonut()`, `cambiarPeriodo()`.
- `renderizarRanking()`, `renderizarCategoriasGastos()`, `renderizarCategoriasIngresos()`.
- `procesarFoto()`, `abrirModalTransaccion()`, `cerrarModalTransaccion()`.
- `actualizarSaldos()` (saldos en pantalla, dash, y llamada a `cargarDatosDashboard()` si aplica).

### `js/transacciones.js`
- `guardarTransaccion()` (insert Supabase + estado local, gastos/ingresos, recargas, stock).
- `_filtroDeudas`, `renderizarDesgloseGastos()`, `renderizarDesgloseIngresos()`.
- `ejecutarTransferencia()`, `renderizarHistorialTransferencias()`, `editarReglasConsumo()`.
- Edición/eliminación de gastos e ingresos: `abrirEditGasto`, `guardarEditGasto`, `eliminarGasto`, idem ingresos.
- `guardarCosteB()`, `guardarCosteV()`.
- Variable `_editIdx` para edición de desglose.

### `js/clientes.js`
- Filtros deuda/oficina: `filtrarDeudas()`, `filtrarOficina()`, `renderizarOficina()`, `renderizarClientes()`.
- Modales cliente: `abrirModalNuevoCliente`, `cerrarModalNuevoCliente`, `guardarCliente()`.
- Detalle cliente: `abrirDetalleCliente`, `cerrarModalDetalleCliente`, `pagoTotal()`, `mostrarPagoParcial()`, `ejecutarPagoParcial()`.
- `cargarDbDeudas()`, `guardarDbDeudas()`, `altaClienteDeuda()`.
- Deuda pendiente/pagada: abrir/cerrar modales y `guardarDeudaPendiente()`, `guardarDeudaPagada()`.
- `cerrarSirena()`, `chequearRecordatorios()` (y `setTimeout`/`setInterval` de recordatorios).
- Gorriones: `cargarGorriones()`, `guardarGorriones()`, `generarCredenciales()`, `renderizarGorriones()`, modales y `guardarGorrion()`, ficha y `guardarCambiosGorrion()`, `eliminarGorrion()`.
- `llenarSelectProductos()`, `toggleProducto2Cliente()`, `toggleProducto2DP()`, `toggleProducto2Alta()`.
- Sirena crédito: `mostrarAumentarCredito()`, `confirmarAumentarCredito()`.

### `js/ui.js`
- Tabla precios y producto: `renderizarTablaPrecios()`, `abrirEditarProducto()`, `cerrarEditarProducto()`, `guardarEditarProducto()`, `eliminarFilaPrecio()`, `editarFilaPrecio()`, `renderizarListaStock()`.
- Navegación: `cambiarPantalla()`, `volverAtras()`, `toggleMenu()`, `cerrarMenu()`.
- Biometría oficina: `actualizarEstadoBiometria()`, `gestionarBiometria()`, `cerrarModalBiometria()`.
- Gestor categorías: `abrirGestorCategorias()`, `renderizarGestorLista()`, `crearCategoria()`, `abrirEditCategoria()`, `guardarEditCategoria()`, `eliminarCategoria()`.
- Borrado seguro: `handleDelete()`, `_cancelarDelete()`, `_ejecutarDelete()`, `_confirmarBorrado()`.
- Cierre del día: `abrirCierreDia()`, `revueltaDiaria()`, `mostrarNotaDescuadre()`, `cerrarCierreDia()`, `_registrarEntradaCierre()`, `confirmarCierre()`, `registrarDescuadre()`.
- `abrirModalCambiarPasswordGorrion()`, `ejecutarCambioPassGorrion()`, `abrirAlertasJefes()`.
- Edición desglose gasto/ingreso (abrir/guardar/eliminar) y `guardarCosteB`/`guardarCosteV` están en transacciones; los modales de confirmación y biometría en borrado están aquí.

### `js/app.js`
- Funciones de login: `intentarLogin()`, `entrarApp()`, `esJefe()`, `esGorrion()`, `aplicarModoSesion()`, `mostrarBotonCambiarPassword()`.
- `DOMContentLoaded`: restaurar sesión, `initCanvas()`, todos los `renderizar*` iniciales, reset diario, `setInterval` de cambio de día.
- Face ID / biometría: `autenticarBiometria()`, `loginFaceID()`, `_entrarConCreds()`, `activarBiometria()`, IIFE del botón Face ID.
- `chequearRecordatorios()` y sus `setTimeout`/`setInterval`.
- `window.addEventListener('resize', ...)` para el canvas donut.
- PWA: manifest (Blob), favicon, apple-touch-icon, Service Worker (cache `silber-gestion-v1`).

---

## Orden de carga en `index.html`

1. **CSS:** `<link rel="stylesheet" href="css/styles.css">`
2. **JS** (en este orden):
   - `js/state.js`
   - `js/supabase.js`
   - `js/dashboard.js`
   - `js/transacciones.js`
   - `js/clientes.js`
   - `js/ui.js`
   - `js/app.js`

El orden respeta dependencias: estado primero; luego Supabase; después módulos que usan estado y Supabase; al final la inicialización y login.

---

## Confirmación

- **Diseño:** Sin cambios. Todo el CSS está en `css/styles.css` con las mismas reglas.
- **UI:** Sin cambios. El HTML de `index.html` es el mismo; solo se quitaron los bloques `<style>` y `<script>` inline.
- **Funcionalidad:** Sin cambios. Mismas funciones y nombres; solo repartidas en archivos. Comportamiento (login, navegación, transacciones, clientes, cierre, PWA) se mantiene.
- **Nombres:** Se conservan nombres de funciones y variables en todo el proyecto.

Para probar: abrir `index.html` en el navegador (o desplegar en Vercel) y comprobar login, pantallas, gastos/ingresos, clientes, cierre del día y, si aplica, Supabase y PWA.
