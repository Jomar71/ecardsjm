const { Pool } = require('pg');

let pool = null;
let dbConnected = false;

function getPool() {
    if (!pool) {
        // Usar una cadena de conexión local por defecto si no hay DATABASE_URL
        const connectionString = process.env.DATABASE_URL || 'postgresql://localhost/ecards_jm';
        
        // Neon requiere SSL. Lo forzamos si la URL contiene 'neon' o si es producción.
        const useSSL = connectionString.includes('neon') || process.env.NODE_ENV === 'production';
        
        pool = new Pool({
            connectionString,
            ssl: useSSL ? { 
                rejectUnauthorized: false,
                // Agregar opciones específicas para Neon.tech
                sslmode: 'require',
                ca: process.env.DB_SSL_CA || undefined
            } : false,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
            max: 10,
            min: 2,
            statement_timeout: 30000
        });
        
        // Agregar listeners para eventos de conexión para diagnóstico
        pool.on('connect', (client) => {
            console.log('[DB] Cliente conectado a la base de datos');
            dbConnected = true;
        });
        
        pool.on('acquire', (client) => {
            console.log('[DB] Cliente adquirido del pool');
        });
        
        pool.on('remove', (client) => {
            console.log('[DB] Cliente removido del pool');
        });
        
        pool.on('error', (err) => {
            console.error('[DB ERROR] Pool error (non-fatal):', err.message);
            console.error('[DB ERROR] Detalles del error:', err.code);
            dbConnected = false;
        });
    }
    return pool;
}

function isConnected() {
    return dbConnected;
}

module.exports = { getPool, isConnected };