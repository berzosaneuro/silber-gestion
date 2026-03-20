# Silber Gestión (NEXUS ERP)

Aplicación web de gestión financiera, ventas, clientes y stock. PWA lista para producción.

## Preparar repositorio para GitHub

Desde la raíz del proyecto:

```bash
git init
git add .
git commit -m "Production ready version"
```

Luego conecta con tu remoto y sube.

## Despliegue en Vercel

1. Conectar el repositorio a Vercel.
2. **Variables de entorno** (opcional, para Supabase): en el dashboard de Vercel, añadir:
   - `SILBER_SUPABASE_URL` = tu URL de proyecto Supabase
   - `SILBER_SUPABASE_KEY` = tu anon key de Supabase
3. Para que la app use estas variables en el cliente, hay que inyectarlas en `index.html` (por ejemplo con un build step que sustituya placeholders). Si no configuras Supabase, la app funciona al 100% con **localStorage**.
4. Deploy: la raíz del proyecto es la raíz del sitio; `vercel.json` ya redirige todas las rutas a `index.html` (SPA).

## Configuración Supabase (opcional)

Si quieres sync en la nube, edita `js/supabase.js` y sustituye:

- `TU_URL_DE_SUPABASE` → URL de tu proyecto Supabase
- `TU_LLAVE_ANON_DE_SUPABASE` → Anon key pública

O define antes de cargar la app (en `index.html`):

```html
<script>
  window.SILBER_SUPABASE_URL = 'https://xxx.supabase.co';
  window.SILBER_SUPABASE_KEY = 'tu-anon-key';
</script>
```

## Usuarios por defecto

| Usuario | Contraseña | Rol    |
|---------|------------|--------|
| Jefazo  | 15031980   | JEFAZO |
| Jefaza  | 03021987   | JEFAZA |

Workers (gorriones) se dan de alta desde la app.

**Seguridad:** Cambia estas contraseñas antes de usar en producción. Para no commitear credenciales reales, define `window.SILBER_USUARIOS` en `index.html` (antes de cargar los scripts) con tu lista de usuarios; la app usará esa variable en lugar de los valores por defecto.

## Requisitos

- Navegador moderno (localStorage, ES5+).
- Opcional: Supabase para sincronización en la nube.
