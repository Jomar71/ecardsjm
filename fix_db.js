require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Intentar cargar .env.pxxl si existe (parece que allí tienes la URL de Neon)
const pxxlEnvPath = path.join(__dirname, '.env.pxxl');
if (fs.existsSync(pxxlEnvPath)) {
    console.log("📝 Usando configuración de .env.pxxl...");
    require('dotenv').config({ path: pxxlEnvPath, override: true });
}

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost')) {
    console.error("❌ ERROR: No se encontró una URL de base de datos válida.");
    console.log("Tu DATABASE_URL actual es:", process.env.DATABASE_URL);
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log("🚀 Conectando a NEON...");
        const connTest = await pool.query('SELECT now()');
        console.log("✅ Conexión establecida:", connTest.rows[0].now);

        console.log("🔧 Aplicando cambios de esquema...");
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT false');
        
        console.log("✅ Columnas is_admin e is_authorized verificadas/creadas.");

        const res = await pool.query('SELECT id, username, is_admin, is_authorized FROM users');
        console.log("\n📊 Usuarios actuales en tu base de datos:");
        console.table(res.rows);

        if (res.rows.length === 0) {
            console.log("\n⚠️ La base de datos está vacía. El primer usuario que registres en la web será el Admin.");
        } else {
            console.log("\n💡 Para ser admin, recuerda registrarte o usar admin_utils.js.");
        }

    } catch (err) {
        console.error('❌ Error de base de datos:', err.message);
    } finally {
        await pool.end();
    }
})();
