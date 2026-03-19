const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'ecards_elite_secret_key_123';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(express.static(__dirname));

// --- AUTH MIDDLEWARE ---
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

// --- AUTH ENDPOINTS ---

// Registro
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'FIELDS_REQUIRED' });

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, passwordHash]
        );
        
        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
        
        res.json({ status: 'success', user, token });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'USER_EXISTS' });
        console.error(err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'INVALID_CREDENTIALS' });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'INVALID_CREDENTIALS' });

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ 
            status: 'success', 
            user: { id: user.id, username: user.username }, 
            token 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// --- CARDS ENDPOINTS ---

// Obtener mis tarjetas (privado)
app.get('/api/cards', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM business_cards WHERE user_id = $1 ORDER BY id DESC', 
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB_ERROR' });
    }
});

// Obtener una tarjeta pública (no requiere auth si es por ID directo compartible)
// GET /api/cards/:id - Public Access
app.get('/api/cards/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM business_cards WHERE id = $1', [id]);
        const card = result.rows[0];
        
        if (!card) {
            return res.status(404).json({ error: 'CARD_NOT_FOUND' });
        }
        
        res.json(card);
    } catch (err) {
        res.status(500).json({ error: 'DB_ERROR' });
    }
});

// Guardar o actualizar tarjeta (privado)
app.post('/api/cards', authenticateToken, async (req, res) => {
    const data = req.body;
    if (!data.name && !data['first-name']) return res.status(400).json({ error: 'NAME_REQUIRED' });

    const allowedKeys = [
        'id', 'first-name', 'last-name', 'name', 'title', 'email', 'phone', 
        'website', 'address', 'company', 'bio', 'facebook', 'instagram', 
        'linkedin', 'twitter', 'whatsapp', 'github', 'behance', 'youtube', 
        'tiktok', 'template_id', 'logo_path', 'profile_path', 'bg_image_path', 
        'font_file_path', 'custom_css', 'custom_fonts', 'bg_color', 'text_color', 'primary_color'
    ];

    const cleanData = { user_id: req.user.id };
    
    // Mapeos del frontend
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

        const query = `
            INSERT INTO business_cards (${columnsString})
            VALUES (${placeholders})
            ON CONFLICT (id) DO UPDATE SET
            ${columns.filter(c => c !== 'id' && c !== 'user_id').map((col, i) => `"${col}" = EXCLUDED."${col}"`).join(', ')}
            WHERE business_cards.user_id = EXCLUDED.user_id OR business_cards.user_id IS NULL
            RETURNING *
        `;

        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'UNAUTHORIZED_CARD_UPDATE' });
        }
        res.json({ status: 'success', card: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Eliminar (privado)
app.delete('/api/cards/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM business_cards WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: 'DB_ERROR' });
    }
});

// --- DB INITIALIZATION ---
const initDB = async () => {
    try {
        // Tabla de usuarios
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de tarjetas (ajuste dinámico)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS business_cards (
                id TEXT PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                "first-name" TEXT,
                "last-name" TEXT,
                name TEXT,
                title TEXT,
                email TEXT,
                phone TEXT,
                website TEXT,
                address TEXT,
                company TEXT,
                bio TEXT,
                facebook TEXT,
                instagram TEXT,
                linkedin TEXT,
                twitter TEXT,
                whatsapp TEXT,
                github TEXT,
                behance TEXT,
                youtube TEXT,
                tiktok TEXT,
                template_id TEXT,
                logo_path TEXT,
                profile_path TEXT,
                bg_image_path TEXT,
                font_file_path TEXT,
                custom_css TEXT,
                custom_fonts TEXT,
                bg_color TEXT,
                text_color TEXT,
                primary_color TEXT
            );
        `);

        // Migración rápida: Añadir user_id si no existe (Postgres 9.4+)
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='business_cards' AND column_name='user_id') THEN
                    ALTER TABLE business_cards ADD COLUMN user_id INTEGER REFERENCES users(id);
                END IF;
            END $$;
        `);

        console.log("✅ Database initialized successfully");
    } catch (err) {
        console.error("❌ Failed to initialize database:", err);
    }
};

app.get('*', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

initDB().then(() => {
    app.listen(PORT, () => console.log(`🚀 Elite Server active on port ${PORT}`));
});