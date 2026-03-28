require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pxxlEnvPath = path.join(__dirname, '.env.pxxl');
if (fs.existsSync(pxxlEnvPath)) {
    require('dotenv').config({ path: pxxlEnvPath, override: true });
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const command = process.argv[2];
const arg1 = process.argv[3];

(async () => {
    try {
        if (command === 'list') {
            const res = await pool.query('SELECT id, username, is_admin, is_authorized FROM users');
            console.table(res.rows);
        } else if (command === 'promote' && arg1) {
            const res = await pool.query('UPDATE users SET is_admin = true, is_authorized = true WHERE username = $1', [arg1]);
            console.log(`User ${arg1} promoted and authorized. Rows affected: ${res.rowCount}`);
        } else if (command === 'authorize' && arg1) {
            const res = await pool.query('UPDATE users SET is_authorized = true WHERE username = $1', [arg1]);
            console.log(`User ${arg1} authorized. Rows affected: ${res.rowCount}`);
        } else {
            console.log('Usage: node admin_utils.js [list|promote <username>|authorize <username>]');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
})();
