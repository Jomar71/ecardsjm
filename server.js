// ===== IMPORTS PRIMERO =====
require('dotenv').config();

// Cargar variables de entorno específicas de PXXL si el archivo existe
const fs = require('fs');
const path = require('path');
const pxxlEnvPath = path.join(__dirname, '.env.pxxl');
if (fs.existsSync(pxxlEnvPath)) {
    require('dotenv').config({ path: pxxlEnvPath, override: true });
}

console.log("🔧 [INIT] Database URL configured as:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'MISSING - CRITICAL!');
console.log("🔧 [INIT] JWT Secret configured:", process.env.JWT_SECRET ? 'Exists' : 'Missing');
console.log("🔧 [INIT] PORT from env:", process.env.PORT || 'Not set (will use 3000)');

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, isConnected } = require('./db');

// ===== CONFIG =====
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'ecards_elite_secret_key_123';

// ===== MANEJADORES GLOBALES (deben capturar PERO NO crashear el servidor) =====
process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err.message);
    console.error('Stack:', err.stack);
    // NO llamamos a process.exit() - el servidor sigue vivo
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
    // NO llamamos a process.exit() - el servidor sigue vivo
});

const app = express();
console.log(`\n🚀 [STARTUP] Servidor Express creado`);
console.log(`📍 [STARTUP] Escuchará en puerto: ${PORT}`);
console.log(`🌍 [STARTUP] Dirección: 0.0.0.0:${PORT}\n`);

// ===== MIDDLEWARE =====
app.use(express.json({ limit: '20mb' }));

// Logger para diagnosticar solicitudes
app.use((req, res, next) => {
    const contentLength = req.get('content-length') || '0';
    if (!req.url.includes('.css') && !req.url.includes('.js') && !req.url.includes('.ico')) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    
    // Si la solicitud es demasiado grande, avisar antes de procesar
    if (parseInt(contentLength) > 20 * 1024 * 1024) {
        console.warn(`[WARNING] Request exceeds 20MB: ${contentLength} bytes`);
    }
    next();
});

app.use(cors());

// ===== CACHE CONTROL MIDDLEWARE =====
app.use((req, res, next) => {
    // Evitar problemas de cacheo en dispositivos móviles
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// ===== HEALTH CHECK (responde inmediatamente, sin DB) =====
app.get('/ping', (req, res) => {
    res.send('pong');
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        dbConnected: isConnected(),
        port: PORT,
        timestamp: new Date().toISOString() 
    });
});

// ===== HELPER: query con manejo de errores y timeout =====
async function query(text, params, timeout = 30000) {
    const pool = getPool();
    const queryStart = Date.now();
    const shortQuery = text.substring(0, 100).replace(/\n/g, ' ');
    console.log(`[DB QUERY] ${shortQuery}...`);
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - queryStart;
        console.log(`[DB OK] ${result.rowCount} rows (${duration}ms)`);
        return result;
    } catch (err) {
        const duration = Date.now() - queryStart;
        console.error(`[DB ERROR] ${err.message} (${duration}ms)`);
        throw err;
    }
}

// ===== AUTH MIDDLEWARE =====
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'TOKEN_REQUIRED' });
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error('[AUTH ERROR] Token verification failed:', err.message);
            return res.status(403).json({ error: 'TOKEN_INVALID' });
        }
        req.user = user;
        next();
    });
};

// ===== AUTH ENDPOINTS =====

// Auth endpoints handled at the end of the file for better organization.

// ===== CARDS ENDPOINTS =====

app.get('/api/cards', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM business_cards WHERE user_id = $1 ORDER BY id DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get cards error:', err.message);
        res.status(500).json({ error: 'DB_ERROR', detail: err.message });
    }
});

app.get('/api/cards/:id', async (req, res) => {
    try {
        const result = await query('SELECT * FROM business_cards WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'CARD_NOT_FOUND' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get card error:', err.message);
        res.status(500).json({ error: 'DB_ERROR', detail: err.message });
    }
});

app.post('/api/cards', authenticateToken, async (req, res) => {
    const data = req.body;
    if (!data.name && !data['first-name']) return res.status(400).json({ error: 'NAME_REQUIRED' });

    const allowedKeys = [
        'id', 'first-name', 'last-name', 'name', 'title', 'email', 'phone',
        'website', 'address', 'company', 'bio', 'facebook', 'instagram',
        'linkedin', 'twitter', 'whatsapp', 'github', 'behance', 'youtube',
        'tiktok', 'template_id', 'logo_path', 'profile_path', 'bg_image_path',
        'font_file_path', 'custom_css', 'custom_fonts', 'bg_color', 'text_color', 'primary_color',
        'theme_selector', 'profile_position', 'font_family'
    ];

    const cleanData = { user_id: req.user.id };
    if (data['job-title']) cleanData['title'] = data['job-title'];
    if (data['title']) cleanData['title'] = data['title'];
    if (data['description']) cleanData['bio'] = data['description'];
    if (data['bio']) cleanData['bio'] = data['bio'];

    for (const key in data) {
        if (allowedKeys.includes(key) && key !== 'job-title' && key !== 'description') {
            cleanData[key] = data[key];
        }
    }

    try {
        const columns = Object.keys(cleanData);
        const values = Object.values(cleanData);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const columnsString = columns.map(c => `"${c}"`).join(', ');
        const updateSet = columns
            .filter(c => c !== 'id' && c !== 'user_id')
            .map(col => `"${col}" = EXCLUDED."${col}"`)
            .join(', ');

        const sql = `
            INSERT INTO business_cards (${columnsString})
            VALUES (${placeholders})
            ON CONFLICT (id) DO UPDATE SET ${updateSet}
            WHERE business_cards.user_id = EXCLUDED.user_id OR business_cards.user_id IS NULL
            RETURNING *
        `;

        const result = await query(sql, values);
        if (result.rows.length === 0) return res.status(403).json({ error: 'UNAUTHORIZED_CARD_UPDATE' });
        res.json({ status: 'success', card: result.rows[0] });
    } catch (err) {
        console.error('Save card error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/cards/:id', authenticateToken, async (req, res) => {
    try {
        await query('DELETE FROM business_cards WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ status: 'success' });
    } catch (err) {
        console.error('Delete card error:', err.message);
        res.status(500).json({ error: 'DB_ERROR' });
    }
});

// ===== ENDPOINT: IMAGEN DE TARJETA PARA OG:IMAGE =====
app.get('/api/cards/:id/image', async (req, res) => {
    try {
        const result = await query('SELECT bg_image_path FROM business_cards WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0 || !result.rows[0].bg_image_path) {
            return res.status(404).send('No image');
        }
        const raw = result.rows[0].bg_image_path;
        const base64Match = raw.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!base64Match) return res.status(400).send('Invalid image format');
        const ext = base64Match[1] === 'jpeg' ? 'jpeg' : base64Match[1];
        const buf = Buffer.from(base64Match[2], 'base64');
        res.set('Content-Type', `image/${ext}`);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(buf);
    } catch (err) {
        console.error('Image endpoint error:', err.message);
        res.status(500).send('Error');
    }
});

// ===== RUTA: PREVIEW DE TARJETA CON META TAGS OG (SSR) =====
app.get('/card/:id', async (req, res) => {
    try {
        const result = await query('SELECT id, name, bio, bg_image_path FROM business_cards WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Tarjeta no encontrada');
        }
        const card = result.rows[0];
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const cardUrl = `${baseUrl}/card/${card.id}`;
        const imageUrl = `${baseUrl}/api/cards/${card.id}/image`;
        const title = card.name ? `${card.name} - E-Card` : 'E-Card Compartida';
        const description = card.bio || `Tarjeta digital de ${card.name || 'E-Cards JM'}`;
        const hasImage = card.bg_image_path && card.bg_image_path.startsWith('data:image');

        let html = fs.readFileSync(path.join(__dirname, 'public', 'view-card.html'), 'utf8');

        const ogTags = `
    <title>${title}</title>
    <meta property="og:type" content="website">
    <meta property="og:url" content="${cardUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:site_name" content="E-Cards JM">
    ${hasImage ? `<meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="600">
    <meta property="og:image:height" content="1067">
    <meta property="og:image:type" content="image/jpeg">` : ''}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    ${hasImage ? `<meta name="twitter:image" content="${imageUrl}">` : ''}
    <meta name="description" content="${description}">`;

        html = html.replace(/<title>.*?<\/title>/s, '').replace(/<meta (?:property="og:[^"]*"|name="(?:twitter|description)[^"]*")[^>]*>\s*/g, '');
        html = html.replace('</head>', `${ogTags}\n</head>`);

        res.set('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        console.error('Card preview route error:', err.message);
        res.sendFile(path.join(__dirname, 'public', 'view-card.html'));
    }
});

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['css', 'js', 'html', 'ico'], index: 'index.html' }));
app.get('/favicon.ico', (req, res) => res.sendStatus(204));

// ===== MANEJO DE RUTAS ESPECÍFICAS PARA TARJETAS PÚBLICAS =====
// La ruta /card/:id ya está definida arriba con SSR + OG meta tags

// Manejo de todas las demás rutas (SPA - Single Page Application)
app.get('*', (req, res) => {
    // Verificar si es una solicitud de API (solo para GETs)
    if (req.url.startsWith('/api/') || req.url.startsWith('/health')) {
        return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== GLOBAL ERROR HANDLER (El último middleware) =====
app.use((err, req, res, next) => {
    console.error('❌ GLOBAL ERROR:', err.message);
    
    // Capturar cualquier error que no sea JSON y forzar JSON
    const status = err.status || err.statusCode || 500;
    
    // Si es un error de Payload (imagen muy grande)
    if (err.type === 'entity.too.large' || status === 413) {
        return res.status(413).json({ 
            error: 'FILE_TOO_LARGE', 
            detail: 'La imagen o los datos exceden el límite permitido. Intenta con una imagen más pequeña.' 
        });
    }
    
    // Si es un error de JSON malformado
    if (err instanceof SyntaxError && status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'INVALID_JSON', detail: err.message });
    }

    res.status(status).json({ 
        error: err.name || 'SERVER_ERROR', 
        detail: err.message || 'Error interno del servidor',
        code: status
    });
});

// ===== DB INITIALIZATION =====
async function initDB() {
    try {
        console.log('🔄 Inicializando base de datos...');
        
        // Con timeout: si toma más de 15 segundos, loguear y continuar
        const initPromise = (async () => {
            await query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_authorized BOOLEAN DEFAULT FALSE,
                    is_admin BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, [], 15000);
            
            // Migración: Asegurar que existan las nuevas columnas
            try {
                await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT FALSE`, [], 10000);
                await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`, [], 10000);
            } catch(e) { 
                console.log("ℹ️  Users migration info:", e.message); 
            }

            await query(`
                CREATE TABLE IF NOT EXISTS business_cards (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    "first-name" TEXT, "last-name" TEXT, name TEXT, title TEXT,
                    email TEXT, phone TEXT, website TEXT, address TEXT, company TEXT,
                    bio TEXT, facebook TEXT, instagram TEXT, linkedin TEXT, twitter TEXT,
                    whatsapp TEXT, github TEXT, behance TEXT, youtube TEXT, tiktok TEXT,
                    template_id TEXT, logo_path TEXT, profile_path TEXT, bg_image_path TEXT,
                    font_file_path TEXT, custom_css TEXT, custom_fonts TEXT,
                    bg_color TEXT, text_color TEXT, primary_color TEXT,
                    theme_selector TEXT, profile_position TEXT, font_family TEXT
                )
            `, [], 15000);
            
            // Auto-migration for newly added columns
            try {
                await query(`ALTER TABLE business_cards ADD COLUMN IF NOT EXISTS theme_selector TEXT`, [], 10000);
                await query(`ALTER TABLE business_cards ADD COLUMN IF NOT EXISTS profile_position TEXT`, [], 10000);
                await query(`ALTER TABLE business_cards ADD COLUMN IF NOT EXISTS font_family TEXT`, [], 10000);
            } catch(migrationErr) {
                console.log("ℹ️  Business cards migration info:", migrationErr.message);
            }

            console.log('✅ Base de datos inicializada correctamente');
        })();
        
        // Esperar máximo 60 segundos antes de loguear advertencia
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                console.warn('⚠️  [TIMEOUT] initDB está demorando más de lo esperado (>60s)');
                resolve();
            }, 60000);
        });
        
        await Promise.race([initPromise, timeoutPromise]);
        
    } catch (err) {
        console.error('❌ Error inicializando DB:', err.message);
        console.error('ℹ️  El servidor continuará funcionando sin DB - solo servicios locales disponibles');
    }
}

// ===== AUTH ENDPOINTS ACTUALIZADOS =====

// ===== ADMIN ENDPOINTS =====

const isAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'ADMIN_REQUIRED' });
    }
    next();
};

app.post('/api/auth/register', authenticateToken, isAdmin, async (req, res) => {
    const { username, password } = req.body;
    console.log(`[AUTH] Registro administrativo para usuario: ${username}`);
    
    if (!username || !password) return res.status(400).json({ error: 'FIELDS_REQUIRED' });
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Los usuarios creados por el admin están autorizados por defecto
        const result = await query(
            'INSERT INTO users (username, password_hash, is_authorized, is_admin) VALUES ($1, $2, $3, $4) RETURNING id',
            [username, passwordHash, true, false]
        );
        res.json({ status: 'success', user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'USER_EXISTS' });
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[AUTH] Login solicitado para usuario: ${username}`);
    
    try {
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            console.log(`[AUTH] Usuario no encontrado: ${username}`);
            return res.status(400).json({ error: 'INVALID_CREDENTIALS' });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            console.log(`[AUTH] Contraseña inválida para usuario: ${username}`);
            return res.status(400).json({ error: 'INVALID_CREDENTIALS' });
        }
        
        if (!user.is_authorized) {
            console.log(`[AUTH] Usuario no autorizado: ${username}`);
            return res.status(403).json({ error: 'USER_NOT_AUTHORIZED', message: 'Tu cuenta aún no ha sido autorizada por el administrador.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, SECRET_KEY, { expiresIn: '15d' });
        console.log(`[AUTH] Login exitoso para: ${user.username}`);
        res.json({ status: 'success', user: { id: user.id, username: user.username, is_admin: user.is_admin }, token });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'SERVER_ERROR', detail: err.message });
    }
});

// ===== ADMIN ENDPOINTS =====

// ===== ADMIN ENDPOINTS CONTINUED =====

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await query('SELECT id, username, is_authorized, is_admin, created_at FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'DB_ERROR' });
    }
});

app.post('/api/admin/users/:id/authorize', authenticateToken, isAdmin, async (req, res) => {
    const { is_authorized } = req.body;
    try {
        await query('UPDATE users SET is_authorized = $1 WHERE id = $2', [is_authorized, req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: 'DB_ERROR' });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        // No permitir que el admin se borre a sí mismo
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'CANNOT_DELETE_SELF' });
        }
        await query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: 'DB_ERROR' });
    }
});

// ===== START SERVER =====
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 SERVIDOR INICIADO Y ESCUCHANDO`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📍 Dirección:  0.0.0.0:${PORT}`);
    console.log(`🔗 URL Pública: https://ecardsjm.pxxl.click`);
    console.log(`✅ Health: http://localhost:${PORT}/health`);
    console.log(`✅ Ping:   http://localhost:${PORT}/ping`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Init DB en background, NO bloquea el servidor
    // El servidor ya está escuchando en este punto
    initDB().catch(err => {
        console.error('⚠️  [BACKGROUND] initDB error:', err.message);
    });
});

// Manejo de servidor crashes
server.on('error', (err) => {
    console.error('❌ [SERVER ERROR]', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Puerto ${PORT} está en uso. Usa un puerto diferente con: PORT=3001 node server.js`);
    }
});