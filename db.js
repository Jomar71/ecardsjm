const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('⚠️ ERROR: No se encontró DATABASE_URL en el archivo .env');
  console.log('Asegurate de que tu archivo .env tenga la línea: DATABASE_URL=tu_link_de_neon');
} else {
  const host = connectionString.split('@')[1]?.split(/[/:?]/)[0];
  console.log(`🔌 Conectando a la nube: ${host}`);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false } // Forzar SSL para Neon
});

// Probar la conexión
pool.connect((err) => {
  if (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
  } else {
    console.log('✅ Conectado a PostgreSQL correctamente');
  }
});

module.exports = pool;