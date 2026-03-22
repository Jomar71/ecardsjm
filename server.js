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
    const result = await pool.query(text, params);
    return result;
}

// ===== AUTH MIDDLEWARE =====
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'TOKEN_REQUIRED' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'TOKEN_INVALID' });
        req.user = user;
        next();
    });
};

// ===== AUTH ENDPOINTS =====

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'FIELDS_REQUIRED' });
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, passwordHash]
        );
        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ status: 'success', user, token });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'USER_EXISTS' });
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'SERVER_ERROR', detail: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'INVALID_CREDENTIALS' });
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'INVALID_CREDENTIALS' });
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ status: 'success', user: { id: user.id, username: user.username }, token });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'SERVER_ERROR', detail: err.message });
    }
});

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
app.use(express.static(path.join(__dirname)));

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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
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