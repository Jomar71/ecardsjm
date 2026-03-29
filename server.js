// ===== MANEJADORES GLOBALES (deben ir PRIMERO) =====
process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    // NO salimos del proceso — el servidor sigue vivo
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
});

// ===== IMPORTS =====
require('dotenv').config();

// Cargar variables de entorno específicas de PXXL si el archivo existe
const fs = require('fs');
const path = require('path');
const pxxlEnvPath = path.join(__dirname, '.env.pxxl');
if (fs.existsSync(pxxlEnvPath)) {
    require('dotenv').config({ path: pxxlEnvPath, override: true });
}

console.log("Database URL configured as:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'None');
console.log("JWT Secret configured:", process.env.JWT_SECRET ? 'Exists' : 'Missing');

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('./db');

// ===== CONFIG =====
const PORT = process.env.PORT || 8888;
const SECRET_KEY = process.env.JWT_SECRET || 'ecards_elite_secret_key_123';

// Capturar errores fatales para debugging en pxxl
process.on('uncaughtException', (err) => {
    console.error('❌ CRASH DETECTADO (Uncaught Exception):', err.stack || err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ CRASH DETECTADO (Unhandled Rejection):', reason);
    process.exit(1);
});

const app = express();
console.log(`[INIT] Servidor configurado en el puerto: ${PORT}`);

// ===== MIDDLEWARE =====
app.use(express.json({ limit: '10mb' }));

// Logger para diagnosticar bloqueos
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url} - Size: ${req.get('content-length') || '0'} bytes`);
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
app.get('/ping', (req, res) => res.send('pong'));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== HELPER: query con manejo de errores =====
async function query(text, params) {
    const pool = getPool();
    console.log(`[DB QUERY] Ejecutando: ${text.substring(0, 100)}...`);
    try {
        const result = await pool.query(text, params);
        console.log(`[DB RESULT] Filas afectadas/recuperadas: ${result.rowCount}`);
        return result;
    } catch (err) {
        console.error('[DB ERROR] Query fallida:', err.message);
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

// ===== STATIC FILES =====
// Esto debe ir ANTES de las rutas comodín (*) para que los archivos estáticos se sirvan correctamente
app.use(express.static(path.join(__dirname), { extensions: ['css', 'js', 'html', 'ico'], index: false }));  
app.get('/styles.css', (req, res) => res.type('text/css').sendFile(path.join(__dirname, 'styles.css')));
app.get('/script.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'script.js')));
app.get('/favicon.ico', (req, res) => res.sendStatus(204));

// ===== MANEJO DE RUTAS ESPECÍFICAS PARA TARJETAS PÚBLICAS =====
app.get('/card/:id', async (req, res) => {
    // Esta ruta redirige a index.html para que el cliente maneje la ruta
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/#/card/:id', async (req, res) => {
    // Esta ruta maneja directamente la ruta hash
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Manejo de todas las demás rutas (SPA - Single Page Application)
app.get('*', (req, res) => {
    // Verificar si es una solicitud de API
    if (req.url.startsWith('/api/') || req.url.startsWith('/health')) {
        // Si es una solicitud de API, devolver error 404 genérico
        return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    // Para cualquier otra ruta, enviar index.html permitiendo que el router del frontend (script.js) maneje la ruta
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== DB INITIALIZATION =====
async function initDB() {
    try {
        console.log('🔄 Inicializando base de datos...');
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_authorized BOOLEAN DEFAULT FALSE,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Migración: Asegurar que existan las nuevas columnas
        try {
            await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT FALSE`);
            await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`);
        } catch(e) { console.log("Users migration info:", e.message); }

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
        `);
        
        // Auto-migration for newly added columns if the table already existed earlier
        try {
            await query(`ALTER TABLE business_cards ADD COLUMN IF NOT EXISTS theme_selector TEXT`);
            await query(`ALTER TABLE business_cards ADD COLUMN IF NOT EXISTS profile_position TEXT`);
            await query(`ALTER TABLE business_cards ADD COLUMN IF NOT EXISTS font_family TEXT`);
        } catch(migrationErr) {
            console.error('Migration info:', migrationErr.message);
        }

        console.log('✅ Base de datos lista');
    } catch (err) {
        console.error('❌ Error inicializando DB (servidor sigue funcionando):', err.message);
    }
}

// ===== AUTH ENDPOINTS ACTUALIZADOS =====

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[AUTH] Registro solicitado para usuario: ${username}`);
    
    if (!username || !password) return res.status(400).json({ error: 'FIELDS_REQUIRED' });
    try {
        // Verificar si es el primer usuario
        const countResult = await query('SELECT COUNT(*) FROM users');
        const isFirstUser = parseInt(countResult.rows[0].count) === 0;
        
        console.log(`[AUTH] ¿Es primer usuario?: ${isFirstUser}`);
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Si es el primer usuario, se autoriza automáticamente y se hace admin
        const isAuthorized = isFirstUser;
        const isAdmin = isFirstUser;

        const result = await query(
            'INSERT INTO users (username, password_hash, is_authorized, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, username, is_authorized, is_admin',
            [username, passwordHash, isAuthorized, isAdmin]
        );
        const user = result.rows[0];
        
        console.log(`[AUTH] Usuario creado:`, user);
        
        if (!user.is_authorized) {
            console.log(`[AUTH] Usuario pendiente de autorización: ${user.username}`);
            return res.json({ status: 'pending', message: 'WAIT_FOR_APPROVAL', user });
        }

        const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, SECRET_KEY, { expiresIn: '15d' });
        console.log(`[AUTH] Registro exitoso para: ${user.username}`);
        res.json({ status: 'success', user, token });
    } catch (err) {
        if (err.code === '23505') {
            console.error(`[AUTH] Usuario ya existe: ${username}`);
            return res.status(400).json({ error: 'USER_EXISTS' });
        }
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'SERVER_ERROR', detail: err.message });
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

const isAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'ADMIN_REQUIRED' });
    }
    next();
};

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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`🚀 SERVIDOR LISTO Y ESCUCHANDO`);
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🔗 URL: ecardsjm.pxxl.click`);
    console.log(`===========================================`);
    // Init DB en background, NO bloquea el servidor
    initDB().catch(err => console.error('initDB failed:', err.message));
});