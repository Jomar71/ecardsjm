
const pool = require('./db');
async function check() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("TABLES:", res.rows.map(r => r.table_name));
    } catch (e) {
        console.error("DB ERROR:", e.message);
    } finally {
        process.exit();
    }
}
check();
