const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('⚠️ ADVERTENCIA: No se encontró DATABASE_URL. Las funciones de BD no estarán disponibles.');
}

const pool = new Pool({
  connectionString: connectionString || '',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

module.exports = pool;