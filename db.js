const { Pool } = require('pg');

let pool = null;

function getPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL no configurada');
        }
        pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
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