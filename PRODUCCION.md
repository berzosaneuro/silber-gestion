# Silber Gestión (NEXUS ERP) — Preparación para producción

## ✅ Auditoría realizada

- **Roles:** JEFAZO, JEFAZA, WORKER (sin uso del nombre MASTER en lógica de permisos).
- **Jerarquía:** Jefazo (control total), Jefaza (administración), Worker (acceso limitado).
- **Persistencia:** localStorage como fuente de verdad; Supabase como sync opcional (si falla, la app sigue funcionando).
- **Alertas:** Si Jefaza realiza actividad sospechosa (muchas eliminaciones/ediciones), se registra `ADMIN_ACTIVITY_ALERT` y se notifica solo a Jefazo.

## Usuarios por defecto

| Usuario  | Contraseña | Rol     |
|----------|------------|---------|
| Jefazo   | 15031980   | JEFAZO  |
| Jefaza   | 03021987   | JEFAZA  |
| Workers  | (gorriones)| WORKER  |

## Permisos por rol

- **Jefazo:** Auditoría, configuración, coste por gramo, tabla de precios, eliminar transacciones, confirmar cierre con biometría, descuadre. Recibe todas las alertas (incluidas las de actividad de Jefaza).
- **Jefaza:** Transacciones, clientes, cierres de caja, gastos, rutas, métricas, timeline, productos. No puede: auditoría, configuración crítica, eliminar transacciones.
- **Worker:** Ventas del día, ruta de clientes (Google Maps), localización, ranking. Puede registrar ventas y gastos con foto de ticket. No ve: auditoría, métricas, configuración, usuarios.

## Despliegue (Vercel)

1. Variables de entorno (si usas Supabase): configurar en Vercel Dashboard o en `js/supabase.js`:
   - `SUPABASE_URL` / `SUPABASE_KEY` (sustituir placeholders en `supabase.js`).
2. La app es estática (HTML + JS + CSS). `vercel.json` ya redirige todo a `index.html` para SPA.
3. Comprobar que no haya errores en consola al cargar (login → dashboard → oficina).

## Comprobaciones pre-producción

- [ ] Login con Jefazo, Jefaza y un Worker (gorrión).
- [ ] Crear/editar/eliminar transacción (solo Jefazo puede eliminar).
- [ ] Cierre de caja (Jefazo y Jefaza).
- [ ] Ruta de clientes (Jefazo, Jefaza, Worker).
- [ ] Ranking de vendedores (todos).
- [ ] Worker: registrar gasto con foto de ticket.
- [ ] Si Jefaza edita/elimina varias transacciones, Jefazo recibe notificación.
