require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/ecards_jm',
    ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false
});

(async () => {
    try {
        console.log("Checking DB connection...");
        const res = await pool.query('SELECT current_user, now()');
        console.log("Connected as:", res.rows[0].current_user);

        console.log("Listing users...");
        const users = await pool.query('SELECT id, username, is_admin, is_authorized FROM users');
        console.table(users.rows);
    } catch (err) {
        console.error('ERROR:', err.message);
        if (err.message.includes('column "is_admin" does not exist')) {
            console.log("Attempting migration...");
            try {
                await pool.query('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT false');
                await pool.query('ALTER TABLE users ADD COLUMN is_authorized BOOLEAN DEFAULT false');
                console.log("Migration successful.");
            } catch (mErr) {
                console.error("Migration failed:", mErr.message);
            }
        }
    } finally {
        await pool.end();
    }
})();
