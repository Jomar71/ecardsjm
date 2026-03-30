const { getPool } = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Cargar variables de entorno adicionales si existen
const fs = require('fs');
const path = require('path');
const pxxlEnvPath = path.join(__dirname, '.env.pxxl');
if (fs.existsSync(pxxlEnvPath)) {
    require('dotenv').config({ path: pxxlEnvPath, override: true });
}

async function createManualUser(username, password) {
    const pool = getPool();
    const hash = await bcrypt.hash(password, 10);
    
    try {
        const res = await pool.query(
            'INSERT INTO users (username, password_hash, is_authorized, is_admin) VALUES ($1, $2, $3, $4) RETURNING id',
            [username, hash, true, true]
        );
        console.log(`✅ Usuario '${username}' creado con ID: ${res.rows[0].id}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error al crear usuario:', err.message);
        process.exit(1);
    }
}

const u = process.argv[2];
const p = process.argv[3];

if (!u || !p) {
    console.log('Uso: node create-user.js <usuario> <password>');
    process.exit(1);
}

createManualUser(u, p);
