
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_EpcCn3vZrx8V@ep-broad-field-anwbfql7-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

async function run() {
    try {
        console.log('Connecting to neon db...');
        await pool.query('ALTER TABLE business_cards ADD COLUMN IF NOT EXISTS theme_selector TEXT');
        await pool.query('ALTER TABLE business_cards ADD COLUMN IF NOT EXISTS profile_position TEXT');
        await pool.query('ALTER TABLE business_cards ADD COLUMN IF NOT EXISTS font_family TEXT');
        console.log('Migration successful.');
        const res = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'business_cards\'');
        console.log('Columns in DB:', res.rows.map(r => r.column_name).join(', '));
    } catch(e) {
        console.error('Error:', e);
    } finally {
        pool.end();
    }
}
run();
