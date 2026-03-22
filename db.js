const { Pool } = require('pg');

let pool = null;

function getPool() {
    if (!pool) {
        // Usar una cadena de conexión local por defecto si no hay DATABASE_URL
        const connectionString = process.env.DATABASE_URL || 'postgresql://localhost/ecards_jm';
        
        // Neon requiere SSL. Lo forzamos si la URL contiene 'neon' o si es producción.
        const useSSL = connectionString.includes('neon') || process.env.NODE_ENV === 'production';
        
        pool = new Pool({
            connectionString,
            ssl: useSSL ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 30000,
            idleTimeoutMillis: 60000,
            max: 2
        });
        pool.on('error', (err) => {
            console.error('Pool error (non-fatal):', err.message);
            pool = null; // resetear para reconectar después
        });
    }
    return pool;
}

module.exports = { getPool };