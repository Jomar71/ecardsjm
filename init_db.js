
const pool = require('./db');

async function initDB() {
    try {
        console.log("Iniciando creación de tabla...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS business_cards (
                id TEXT PRIMARY KEY,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Tabla 'business_cards' creada o ya existente.");
    } catch (err) {
        console.error("❌ Error creando tabla:", err.message);
    } finally {
        process.exit();
    }
}

initDB();
