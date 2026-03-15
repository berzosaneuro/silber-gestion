# Auditoría técnica — SILBER GESTIÓN (index.html)

**Fecha:** Marzo 2026  
**Archivo:** `index.html` (~3.840 líneas)  
**Tipo:** SPA monolítica (HTML + CSS + JS en un solo archivo)

---

## 1. ARQUITECTURA GENERAL

### Tipo de aplicación
- **SPA (Single Page Application)** sin framework: una sola página HTML, varias “pantallas” (`<div class="screen">`) que se muestran/ocultan con la clase `active`.
- **PWA:** Service Worker en línea (Blob), manifest y favicon generados por JS. Cache `silber-gestion-v1`.
- **Despliegue:** pensada para Vercel; `vercel.json` redirige todas las rutas a `index.html`.

### Tecnologías
| Recurso | Uso |
|--------|-----|
| **Supabase JS v2** (CDN) | Backend opcional: tabla `transacciones` (insert + select). Si no se configuran URL/KEY, la app funciona solo con `localStorage`. |
| **Canvas 2D** | Gráfico donut del dashboard (ingresos vs objetivo). |
| **WebAuthn** | Face ID / huella para login y para confirmar borrados (biometría). |
| **localStorage** | Estado global (`silber_gestion_v2`), sesión (`silber_sesion_activa`), gorriones (`db_gorriones`), credenciales biométricas, etc. |
| **Google Fonts** | Inter (400, 600, 700, 900). |

### Organización del código
1. **&lt;head&gt;:** meta, fuentes, Supabase, **~350 líneas de CSS** en `<style>` (variables, layout, componentes, modales, animaciones).
2. **&lt;body&gt;:** contenedor fijo 428px, header, menú lateral (vacío de ítems), **múltiples `.screen`** y **múltiples modales** (overlay + contenido).
3. **&lt;script&gt;** (~2.300 líneas): estado global, helpers, Supabase, todas las funciones de UI y negocio, init en `DOMContentLoaded`, manifest/favicon/sw inyectados al final.

No hay carpetas ni módulos: todo vive en un único `index.html`.

---

## 2. CONEXIÓN CON SUPABASE

### Cómo se conecta
- Variables hardcodeadas: `SUPABASE_URL` y `SUPABASE_KEY` (por defecto `'TU_URL_DE_SUPABASE'` y `'TU_LLAVE_ANON_DE_SUPABASE'`).
- Si `SUPABASE_URL !== 'TU_URL_DE_SUPABASE'`, se crea el cliente: `supabase.createClient(SUPABASE_URL, SUPABASE_KEY)` y se guarda en `_supabase`.
- Si no se sustituyen, `_supabase` queda `null` y la app usa solo estado local + `localStorage`.

### Tablas que usa
- **`transacciones`** (única tabla referenciada):
  - **Insert:** al guardar una transacción (gasto/ingreso) se hace `.from('transacciones').insert([{ tipo, categoria, monto, cuenta, gramos, nota, registrado_por }])`.
  - **Select:** en `cargarDatosDashboard()` se hace `.from('transacciones').select('monto, tipo').gte('created_at', hoy+'T00:00:00Z').lt('created_at', hoy+'T23:59:59Z')` para el día actual.

No hay `update` ni `delete` contra Supabase. Clientes, deudas, gorriones, categorías, cuentas y stock viven solo en el objeto `estado` y en `localStorage`.

### Posibles errores o malas prácticas
- **Credenciales en claro:** URL y anon key en el propio HTML; si se sube a un repo público, quedan expuestas (aunque la anon key está pensada para uso público, conviene restringir por dominio en Supabase).
- **Sin RLS asumido:** no se ve lógica de filas por usuario/tenant; si en el futuro se usa RLS, habría que pasar usuario/jefe en las operaciones.
- **Solo transacciones del día en nube:** el dashboard “tira” de Supabase solo para hoy; la máquina del tiempo (día anterior) usa solo datos locales. Puede haber desfase si dos dispositivos escriben el mismo día.
- **Sin reintentos ni cola offline:** si `insert` falla, se muestra alert y no se guarda en remoto; el estado local sí se actualiza. No hay cola para reintentar luego.
- **Filtro de fecha:** uso de `.lt('created_at', hoy + 'T23:59:59Z')` puede excluir registros en zonas horarias no UTC; mejor usar el día siguiente en UTC o funciones de fecha del backend.

---

## 3. PANTALLAS Y MÓDULOS

Todas son `<div class="screen" id="screen-XXX">`; la visible es la que tiene `class="screen active"`.

| Pantalla | ID | Descripción breve |
|----------|-----|-------------------|
| **Login** | `screen-login` | Usuario/contraseña, botón Face ID/huella. Valida contra lista fija de jefes o lista de gorriones (localStorage). Al entrar guarda sesión y opcionalmente registra biometría. |
| **Dashboard** | `screen-dashboard` | Donut (ingresos vs objetivo 500€), selector Día/Semana/Mes/Año, máquina del tiempo (día anterior), resumen Gastos/Ingresos/Deuda, ranking de “equipo” (trabajadores). |
| **Gastos** | `screen-gastos` | Tabs Gastos/Ingresos, grid de categorías de gasto (por categoría se abre modal de transacción), desglose del día, botón “+” para gestor de categorías. |
| **Ingresos** | `screen-ingresos` | Mismo layout con categorías de ingreso, botones “Registrar Deuda Pendiente” y “Registrar Pago de Deuda”, desglose del día. |
| **Deuda** | `screen-deuda` | Botón a “Deuda por Oficina”, resumen total deuda/clientes/cobrar hoy, filtros Todos/Pendientes/Hoy, lista de clientes con deuda. FAB “+” para nuevo cliente. |
| **Oficina** | `screen-oficina` | Resumen deuda, botones deuda pendiente y pago de deuda, mismos filtros, lista “Clientes — Oficina”, enlace a Gorriones, sección Cierre del día, Biometría (2 slots), accesos rápidos (Cuentas, Transferencias, Stock, Alertas, Config). FAB “+” nuevo cliente. |
| **Gorriones** | `screen-gorriones` | Lista de gorriones (localStorage), botón “Dar de Alta Gorrión”. Modal ficha: editar teléfono/contraseña, eliminar. |
| **Cuentas** | `screen-cuentas` | Saldos de Efectivo, BBVA, Guardado, Monedero y total (solo lectura desde `estado.cuentas`). |
| **Transferencias** | `screen-transferencias` | Formulario origen/destino/monto entre las 4 cuentas; historial de movimientos (desde estado local). |
| **Stock** | `screen-stock` | Recarga B/V (totales en gramos), enlace a Tabla de precios, lista de entradas de stock, precios/coste por gramo B y V. |
| **Tabla de precios** | `screen-tabla-precios` | Tabla de productos (precio, gramaje, stock) con botón editar que abre modal. |
| **Config** | `screen-config` | Switches Notificaciones/Sonidos/Vibración (solo UI), código de sincronización fijo “ABC123”, botón “Modificar Precios/Gramajes” (va a tabla precios), bloque “Alta Cliente (Crédito)” con producto, límite, WhatsApp, día de pago. |

**Modales** (no son pantallas; se superponen): Deuda pendiente, Deuda pagada, Nuevo cliente, Detalle cliente, Cierre del día, Transacción (gasto/ingreso), Gestor categorías, Editar categoría, Editar gasto/ingreso, Nuevo gorrión, Ficha gorrión, Cambiar contraseña gorrión, Biometría, Confirmación borrado, Sirena (límite crédito excedido), Alertas jefes, Editar producto.

**Navegación:** Barra inferior (Inicio, Gastos, Ingresos, Oficina). Pantallas secundarias (Deuda, Gorriones, Cuentas, etc.) se abren desde Oficina o desde Dashboard; botón “Atrás” usa pila `estado.historialPantallas`.

---

## 4. FUNCIONES IMPORTANTES (resumido)

- **Estado y persistencia:** `cargarEstado()`, `guardarEstado()` — leen/escriben `estado` en `localStorage` bajo `STORAGE_KEY`.
- **Fechas:** `fechaConOffset(offset)`, `labelDia(offset)`, `getDiaData(offset)` — fechas relativas al día actual y datos agregados para donut/desglose.
- **Dashboard:** `dibujarDonut()`, `cambiarPeriodo()`, `cambiarDia()`, `renderizarRanking()`, `actualizarSaldos()`.
- **Transacciones:** `abrirModalTransaccion()`, `guardarTransaccion()` — validan monto, aplican a cuentas, registros diarios, stock (recargas/productos), insert en Supabase si hay cliente, guardan estado y foto (base64 en estado).
- **Desglose:** `renderizarDesgloseGastos()`, `renderizarDesgloseIngresos()` — listan registros del día con editar/eliminar.
- **Clientes y deudas:** `renderizarClientes()`, `filtrarDeudas()`, `guardarCliente()`, `guardarDeudaPendiente()`, `guardarDeudaPagada()`, `abrirDetalleCliente()`, `pagoTotal()`, `ejecutarPagoParcial()`; deudas en `estado.db` (deudas/clientes) + `localStorage` vía `cargarDbDeudas`/`guardarDbDeudas`.
- **Cierre del día:** `abrirCierreDia()`, `confirmarCierre()`, `mostrarNotaDescuadre()`, `registrarDescuadre()` — resumen efectivo/guardado, ventas recarga B/V, neto estimado.
- **Navegación:** `cambiarPantalla(pantalla)`, `volverAtras()` — gestionan `historialPantallas` y visibilidad de pantallas y botón atrás.
- **Login:** `intentarLogin()` — comprueba usuario/contraseña contra jefes o gorriones, llama `entrarApp()`, opcionalmente `activarBiometria()`. `loginFaceID()` usa credenciales guardadas + WebAuthn.
- **Biometría:** `autenticarBiometria()`, `gestionarBiometria(num)`, `actualizarEstadoBiometria()` — WebAuthn para login y para confirmar borrados.
- **Borrado seguro:** `handleDelete(btnEl, onConfirmado)`, `_ejecutarDelete()` — modal de confirmación y, si hay credenciales, comprobación biométrica antes de ejecutar callback.
- **Categorías:** `abrirGestorCategorias()`, `crearCategoria()`, `guardarEditCategoria()`, `eliminarCategoria()` — CRUD de categorías de gasto/ingreso en memoria y localStorage.
- **Gorriones:** `cargarGorriones()`, `guardarGorriones()`, `guardarGorrion()`, `guardarCambiosGorrion()`, `eliminarGorrion()` — todo en `localStorage` `db_gorriones`.
- **Supabase:** `guardarTransaccion()` hace el `insert`; `cargarDatosDashboard()` hace el `select` del día y actualiza `registrosDiarios` y donut.

---

## 5. FLUJO DE LA APLICACIÓN

1. **Entrada:** Se muestra `screen-login`. El usuario introduce usuario/contraseña (o Face ID si ya hay sesión guardada). `intentarLogin()` valida contra `USUARIOS_JEFE` o lista de gorriones; si es correcto, `sesionActual` se rellena y se llama `entrarApp()`.
2. **entrarApp():** Oculta login, muestra bottom nav, llama `aplicarModoSesion()` (si es gorrión oculta recargas y pago de deuda), guarda sesión en `localStorage` y opcionalmente registra biometría, luego `cambiarPantalla('dashboard')`.
3. **Carga de datos:** En `DOMContentLoaded` se restaura sesión (si hay `silber_sesion_activa`), se inicializa canvas donut, se llaman todos los `renderizar*` y `actualizarSaldos()`. Si hay Supabase y `diaOffset === 0`, se llama `cargarDatosDashboard()` para traer transacciones del día desde la nube.
4. **Navegación:** Al pulsar un ítem del nav o un enlace interno se llama `cambiarPantalla(id)`: se quita `active` a la pantalla actual, se añade a la nueva y se actualiza `estado.historialPantallas` y el título del header. “Atrás” hace `volverAtras()` y restaura la pantalla anterior desde la pila.
5. **Guardado:** Cualquier cambio de negocio (transacción, cliente, deuda, categoría, gorrión, etc.) actualiza el objeto `estado` y se llama `guardarEstado()`, que hace `localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))`. Además, en transacciones se hace `insert` en Supabase si `_supabase` está definido. Deudas/clientes se persisten con `guardarDbDeudas(estado.db)`; gorriones con `guardarGorriones(lista)`.

---

## 6. POSIBLES PROBLEMAS

- **Código duplicado:** Lógica de filtros (Todos/Pendientes/Hoy) y listados de clientes repetida entre Deuda y Oficina. Selectores de “Día de pago” (opciones 1–31) repetidos en varios modales. Estructura de modales muy similar (header, body, footer con dos botones).
- **Lógica confusa:** `estado.db` contiene `clientes`, `deudas`, `historial`; a la vez hay `estado.clientes` en el estado inicial. Hay que seguir el flujo para saber qué se usa (en el código actual los clientes/deudas vienen de `estado.db` cargado con `cargarDbDeudas()`). Migraciones y saneos al inicio (p. ej. `historialPantallas`, `stockProductos`) repartidos en el init.
- **Riesgos de seguridad:** Contraseñas de jefes en claro en el array `USUARIOS_JEFE`. Credenciales de gorriones y sesión en `localStorage` (accesibles por cualquier script en la misma origen). Supabase anon key en el HTML. Para producción, autenticación debería ir a un backend o Supabase Auth y no depender de listas en cliente.
- **Errores potenciales:** Si `guardarEstado()` falla (cuota localStorage, modo privado), no hay feedback ni reintento. En `guardarTransaccion()`, si el `insert` de Supabase falla se muestra alert y se sale sin revertir el estado local, dejando inconsistencia local/nube. Varios `document.getElementById(...)` sin comprobar null antes de usar (puede dar error si se cambia el DOM).
- **UX/robustez:** Pantalla de Oficina concentra demasiadas acciones y enlaces. El menú lateral (`menuOverlay`) está vacío de ítems. Si el usuario borra datos de `localStorage` a mano, la app puede quedar en estado raro hasta volver a login.

---

## 7. COSAS QUE PARECEN INCOMPLETAS

- **Menú lateral:** `.menu-content` no tiene ítems; `toggleMenu()`/`cerrarMenu()` existen pero el menú no muestra enlaces (por ejemplo a las mismas pantallas que ya están en Oficina).
- **Sincronización:** El “Código de Sincronización” en Config está fijo “ABC123” y no se usa para nada. No hay flujo real de sincronización entre dispositivos ni uso de ese código.
- **Notificaciones/Sonidos/Vibración:** Los switches en Config no guardan preferencias ni se leen en ningún sitio; solo cambian de clase al pulsar.
- **Historial:** No hay pantalla dedicada “Historial” global; el historial aparece por cliente (detalle cliente) y en transferencias; los cierres del día tienen su propio bloque en el modal de cierre.
- **Supabase:** Solo transacciones; clientes, deudas, gorriones, categorías y stock no están en Supabase, así que en otro dispositivo o tras borrar localStorage no se recuperan.
- **PWA:** El icono del manifest sigue siendo “N” (por el nombre anterior NEXUS); la app ya se llama SILBER GESTIÓN pero el icono inline no se actualizó.
- **eliminarFilaPrecio / editarFilaPrecio:** Declaradas como `function eliminarFilaPrecio() {}` vacías; la edición de precios se hace desde la tabla con el modal “Editar Producto”.

---

## 8. MEJORAS RECOMENDADAS

1. **Separar en archivos:**  
   - `styles.css` (o varios por sección).  
   - `app.js` (o módulos por dominio: `auth.js`, `transacciones.js`, `clientes.js`, `supabase.js`, etc.).  
   - Cargar con `<link>` y `<script type="module">` (o un bundler si se quiere).

2. **Variables de entorno para Supabase:** No poner URL ni anon key en el HTML. Usar un build que inyecte env (por ejemplo en Vercel) o un único `config.js` que se excluya del repo y se genere en despliegue.

3. **Un solo estado y una sola fuente de verdad:** Unificar clientes/deudas en una estructura clara (por ejemplo todo bajo `estado.db` con `clientes`, `deudas`, `historial`) y documentar qué se persiste en localStorage y qué en Supabase.

4. **Sincronización con Supabase:** Subir también clientes, deudas y (si aplica) categorías/stock a Supabase con tablas y RLS, y al cargar la app intentar primero cargar desde Supabase y usar localStorage como caché o fallback.

5. **Login y permisos:** Mover comprobación de usuarios a backend o a Supabase Auth; no guardar contraseñas de jefes en el cliente. Mantener roles (jefe/gorrión) en el token o en una tabla de perfiles.

6. **Revisión de errores:** Comprobar existencia de nodos antes de usarlos, usar `try/catch` en `guardarEstado()` y mostrar mensaje si falla; en `guardarTransaccion()` decidir si en caso de fallo Supabase se revierte el estado local o se marca “pendiente de sincronizar”.

7. **Menú lateral:** Rellenar `menu-content` con enlaces a Dashboard, Gastos, Ingresos, Deuda, Oficina, Config, etc., reutilizando `cambiarPantalla()`.

8. **PWA:** Actualizar el icono del manifest y de los favicons para que usen “S” o el logo de Silber en lugar de “N”.

9. **Tests:** Añadir tests unitarios para funciones puras (fechas, cálculos de saldo, filtros) y de integración para flujos críticos (login, registrar transacción, guardar cliente).

10. **Código muerto:** Eliminar o implementar `eliminarFilaPrecio` y `editarFilaPrecio`; revisar si hay más funciones vacías o sin uso.

---

*Auditoría realizada sobre el archivo `index.html` del proyecto Silber Gestión. Para aplicar cambios, conviene hacer copia de seguridad y probar en entorno local antes de desplegar.*
