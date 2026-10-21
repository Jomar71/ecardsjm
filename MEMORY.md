# MEMORY.md

## Identidad del Proyecto
- **Nombre**: ecardsJM (Tarjetas de presentación digitales)
- **Stack**: Express + PostgreSQL (Neon en prod) + Front HTML/CSS/JS plano.
- **Autor**: Desarrollador colombiano, trabaja desde VS Code en Windows 11.
- **Idioma de trabajo**: Español (Colombia). Textos de UI, comentarios y logs en español.

## Reglas de Oro (No romper)
- **Cero build steps**: No hay bundler, framework de front, tests, lint ni CI. No inventar comandos (`npm test` falla).
- **`public/js/script.js` es código muerto**: No lo edites esperando que haga algo, ningún HTML lo usa.
- **El README miente**: Describe una versión vieja. Confía siempre en el código real y en este `AGENTS.md`.
- **No bloquear `initDB()`**: Corre en background después de `listen`. Si la BD falla, el server debe seguir vivo. No introduzcas `process.exit()` en los handlers globales.
- **Rutas de assets SIEMPRE absolutas** (`/css/styles.css`, `/img/...`, `/login.html`): `/card/:id` sirve el HTML en una ruta anidada y una ruta relativa resuelve a `/card/css/styles.css` → 404 con fallback HTML → la página queda sin estilos.
- **El hero de la landing NO es una imagen**: es una tarjeta real construida en el DOM y alimentada por `/api/showcase` (logo, nombre, cargo, contactos, redes y QR). `img/hero_preview.png` es solo el fallback.

## Arquitectura y Flujos
- `server.js` es el único entrypoint (API, estáticos, SSR, SPA fallback). Todo está ahí.
- Las páginas cargan su lógica en `<script>` inline dentro de su propio HTML (ej. `create-card.html`).
- **Rutas principales**: `/` (landing), `/login.html`, `/dashboard.html`, `/create-card.html`, `/card/:id` (pública).
- El ID de la tarjeta lo genera el cliente (slug: `juan-perez`). No usar guiones bajos (`juan_perez`).
- No hay subida de archivos. Las imágenes se comprimen en el navegador y se guardan como data URI base64 (`bg_image_path`, `logo_path`).
- **Sistema de diseño actual**: "taller de imprenta" — tinta oscura + papel crema + latón como único acento. Tokens en `public/css/styles.css` (`:root`).

## Base de Datos y API
- **Sin archivos de migración**: Todo se maneja en `initDB()` con `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE`.
- **Para agregar un campo a una tarjeta, tocar 3 sitios**: `CREATE TABLE`, `ALTER TABLE` y el array `allowedKeys` en `POST /api/cards` (si no, el campo se pierde).
- **Usa siempre el wrapper `query()`** en `server.js` en lugar de `pool.query()` directo (maneja reintentos y reset del pool).
- El endpoint `POST /api/cards` es un "upsert". Solo actualiza si la tarjeta es del mismo usuario (si no, lanza 403).

## Frontend
- El token de sesión vive en `localStorage` bajo `ecards_token` y `ecards_user`.
- CDNs externos en el front: Font Awesome 6.5.1 y qrcodejs 1.0.0.
- Estilos centralizados en `public/css/styles.css` con tokens en `:root`.
- **Trampa de layout**: un contenedor flex/grid con ancho indefinido hace que los `width: %` de sus hijos se resuelvan contra 0. Si un hijo debe medir un %, dale al contenedor un ancho definido (`width: 100%`).

## Verificación visual (sin tests en el repo)
- No hay tests ni lint. Para revisar la UI: `msedge --headless=new --screenshot=... --window-size=W,H URL`.
- Para medir geometría real hay un driver CDP en `C:\Users\pc\AppData\Local\Temp\opencode\cdp.js`
  (Node 24 con `WebSocket` nativo: navega, evalúa JS, captura pantalla, puede inyectar `localStorage` con `AUTH_TOKEN`).
- Token de prueba: se puede firmar con `jsonwebtoken` usando el `JWT_SECRET` del `.env`.

## Advertencias y Trampas
- **DNS en `db.js`**: Se resuelve el host a IP literal para evitar `EAI_AGAIN`. Si se toca, conservar `servername` y `ipv4first`.
- **Deploy en Pxxl**: El server **debe** escuchar en `0.0.0.0`. Env obligatorias: `DATABASE_URL` y `JWT_SECRET`.
- `scripts/test.js` apunta al Render viejo, no a localhost. No sirve para verificar cambios locales.
- `package.json` tiene dependencias declaradas (`serve`, `lz-string`) que no se usan.

## Preferencias del Desarrollador
- Prefiero soluciones simples y sin dependencias nuevas.
- Evitar refactorizaciones grandes sin discutirlo antes.
- Validar cambios con `node scripts/health-check.js` o `curl` a `/health` y `/ping`.
- Comentarios en español y prefijos de log con corchetes (ej. `[DB QUERY]`).

## Pendientes (Consultar antes de trabajar)
- Revisar siempre `docs/TODO.md` y `docs/TODO_RESPONSIVE_VIEW_CARD.md` antes de proponer tareas nuevas.
