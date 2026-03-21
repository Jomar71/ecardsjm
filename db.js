const { Pool } = require('pg');

let pool = null;

function getPool() {
    if (!pool) {
        // Usar una cadena de conexión local por defecto si no hay DATABASE_URL
        const connectionString = process.env.DATABASE_URL || 'postgresql://localhost/ecards_jm';
        pool = new Pool({
            connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 15000,
            idleTimeoutMillis: 30000,
            max: 5
        });
        pool.on('error', (err) => {
            console.error('Pool error (non-fatal):', err.message);
            pool = null; // resetear para reconectar después
        });
    }
    return pool;
}

module.exports = { getPool };