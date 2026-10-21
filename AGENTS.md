# AGENTS.md — ecardsJM

Tarjetas de presentación digitales. Express + PostgreSQL (Neon en prod) + front HTML/CSS/JS plano.
**Sin build step, sin bundler, sin framework de front, sin tests, sin lint, sin CI.**

## Estructura real

- `server.js` — único entrypoint: API, estáticos, SSR de `/card/:id`, fallback SPA. Todo en un archivo.
- `db.js` — pool de Postgres + resolución DNS propia (ver "Trampas").
- `public/` — el front. `index.html` (landing), `login.html`, `dashboard.html`, `create-card.html` (editor), `view-card.html` (vista pública).
- `scripts/` — utilidades CLI (health-check, create-user, admin_utils, check_db). No son tests.

La lógica de cada página vive en un `<script>` **inline** dentro de su propio HTML.
`public/js/script.js` es **código muerto**: ningún HTML lo referencia (y usa otras claves de localStorage). No lo edites esperando efecto.

## Comandos

```bash
npm install
npm start          # = npm run dev = node server.js, escucha en 0.0.0.0:PORT
```

- **No existe `npm test`, ni lint, ni typecheck.** `npm test` falla. No inventes comandos de verificación.
- Verificación real: `curl http://localhost:3000/health` y `/ping` (responden sin BD).
- `node scripts/health-check.js` → valida env + conexión BD + lista tablas; sale con 0/1. Es el smoke test del repo.
- `node scripts/create-user.js <usuario> <password>` → crea usuario **admin + autorizado** (necesita BD accesible).
- `node scripts/admin_utils.js list|makeadmin <id>|delete <id>|reset|create <user> [pass] [isAdmin]`
- `node scripts/check_db.js` → columnas de la tabla `users`.
- `scripts/test.js` apunta al deployment viejo de Render (`ecardsjm.onrender.com`), no a localhost. No sirve para verificar cambios.

## Variables de entorno

- `.env` (gitignored) y, opcional, `.env.pxxl`. **Orden de carga en `server.js:2-10`: `.env` primero y luego `.env.pxxl` con `override: true`** → si existe `.env.pxxl`, sus valores ganan sobre `.env`.
- Necesarias: `DATABASE_URL`, `JWT_SECRET` (si falta JWT_SECRET usa el default inseguro `ecards_elite_secret_key_123`). `PORT` opcional (3000).
- SSL se activa solo si la URL contiene `neon` o `NODE_ENV=production`.
- Sin `DATABASE_URL`, el default es `postgresql://localhost/ecards_jm` (el `.env` local usa otro nombre de BD: `ecards_db`).

## Base de datos

- **No hay archivos de migración.** `initDB()` (`server.js:363`) crea las tablas al arrancar con `CREATE TABLE IF NOT EXISTS` y aplica `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para columnas nuevas.
- Para agregar un campo a una tarjeta hay que tocar **tres** sitios:
  1. el `CREATE TABLE` de `business_cards` (`server.js:389`),
  2. su `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (`server.js:404`),
  3. el array `allowedKeys` de `POST /api/cards` (`server.js:182`) — **si no, el campo se descarta silenciosamente**.
- Tablas: `users` (id SERIAL, username UNIQUE, password_hash, is_authorized, is_admin) y `business_cards` (`id` TEXT = slug generado por el cliente, `user_id` → users.id, columnas con guion entre comillas: `"first-name"`, `"last-name"`).
- `initDB()` corre **en background después de `listen`**: si la BD falla, el servidor sigue vivo y `/health` responde. Es deliberado (evita que la plataforma marque el deploy como unhealthy) — no lo bloquees ni lo reescribas.

## API (todo en `server.js`)

| Endpoint | Auth |
|---|---|
| `POST /api/auth/login` | público → JWT Bearer (15d) |
| `POST /api/auth/register` | **admin** (crea usuarios ya autorizados) |
| `GET /api/cards` | JWT (solo las del usuario) |
| `GET /api/cards/:id` | **público** |
| `POST /api/cards` | JWT — upsert por `id` (`ON CONFLICT (id) DO UPDATE`) |
| `DELETE /api/cards/:id` | JWT |
| `GET /api/showcase` | público — 4 tarjetas al azar para la landing |
| `GET /api/cards/:id/image` | público — devuelve `bg_image_path` (data URI base64) como imagen |
| `GET /card/:id` | público — SSR: lee `public/view-card.html` e inyecta meta OG/Twitter antes de `</head>` |

Errores de auth: 401 `TOKEN_REQUIRED`, 403 `TOKEN_INVALID`. Login de usuario no autorizado → 403 `USER_NOT_AUTHORIZED`.

## Frontend

- Token en `localStorage` bajo las claves **`ecards_token`** y **`ecards_user`** (`login.html:177`, `dashboard.html:276`, `create-card.html:315`).
- Rutas: `/` landing · `login.html` · `dashboard.html` · `create-card.html` (editor, `?edit=<id>`) · `/card/<id>` pública.
- **El id de la tarjeta lo genera el cliente**: `generateId(nombre)` → slug en minúsculas con guiones (`juan-perez`). El README dice `juan_perez`: está desactualizado.
- **No hay subida de archivos**: el navegador comprime la imagen (JPEG 0.7, máx 1200px, `compressImage` en `create-card.html:371`) y la guarda como **data URI base64** dentro de `bg_image_path` / `logo_path`. Límite de body: 20 MB.
- `public/css/styles.css` es la única hoja de estilos, con design tokens en `:root` (variables CSS) y utilidades `.glass`, `.section-spacing`, `.mockup-card`.
- CDN externos usados en `create-card.html` / `view-card.html`: Font Awesome 6.5.1 y **qrcodejs 1.0.0** (genera los QR; no hay QR en npm).

## Despliegue (Pxxl)

- `pxxl.config.json`: build `npm install`, run `node server.js`. `Procfile`: `web: node server.js`.
- Env obligatorias en la plataforma: `DATABASE_URL`, `JWT_SECRET` (`PORT` lo inyecta la plataforma).
- El servidor **debe** escuchar en `0.0.0.0` (ya lo hace) para que el health check de la plataforma no lo mate.
- Prod: https://ecardsjm.pxxl.click · `docs/PXXL-SETUP.md` tiene el checklist de deploy.

## Trampas

- **DNS en `db.js`**: resuelve el host a IPv4 (fallback a 8.8.8.8 / 1.1.1.1 / 208.67.222.222) y conecta **usando la IP literal** para esquivar `EAI_AGAIN` en contenedores. Si tocas la config de conexión, conserva `servername` con el hostname real (SNI/TLS) y el flag `ipv4first`.
- **Usa siempre el wrapper `query()`** (`server.js:88`) en vez de `pool.query()` directo: reintenta 3 veces solo errores transitorios (DNS/timeout/ECONNRESET) y hace `resetPool()` al agotar.
- Los handlers globales de `uncaughtException` / `unhandledRejection` **no** llaman `process.exit()`: el servidor sobrevive a propósito. No introduzcas un exit.
- `POST /api/cards` solo actualiza si la tarjeta existente pertenece al mismo usuario (`... WHERE business_cards.user_id = EXCLUDED.user_id OR business_cards.user_id IS NULL`); si no, 403 `UNAUTHORIZED_CARD_UPDATE`.
- `public/404.html` es un redirect de cliente para GitHub Pages; Express no lo usa — el catch-all `app.get('*')` sirve `public/index.html`.
- El `README.md` describe una versión vieja "frontend-only con localStorage". La app real es Express + Postgres + JWT: **confía en el código, no en el README**.
- `package.json` declara `serve` y `lz-string`, pero no se importan en ningún archivo.
- Estilo del código: indentación de **4 espacios**, CommonJS (`require`) en el back, `const`/arrow/template literals en el front. Comentarios, logs y textos de UI en **español**; los prefijos de log usan corchetes (`[DB QUERY]`, `[AUTH]`, `[INIT]`).
- `docs/TODO.md` y `docs/TODO_RESPONSIVE_VIEW_CARD.md` guardan pendientes del proyecto; léelos antes de proponer trabajo nuevo.

## Memoria - Al empezar, lee `MEMORY.md` para conocer el estado del proyecto y las decisiones tomadas. - Al terminar una tarea, actualízalo: estado actual, decisiones importantes (con su porqué) y errores a evitar. - Mantenlo breve (máximo ~50 líneas): resume o elimina lo que ya no aporte. - Si algo se convierte en una regla permanente, propón moverlo a `AGENTS.md` en lugar de dejarlo en la memoria. - No guardes nunca datos sensibles (claves, tokens, datos personales).