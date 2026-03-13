
const pool = require('./db');
async function check() {
    try {
        const res = await pool.query("SELECT * FROM business_cards");
        console.log("CARDS FOUND:", res.rows.length);
        res.rows.forEach(r => console.log("- ID:", r.id, "Name:", r['first-name']));
    } catch (e) {
        console.error("DB ERROR:", e.message);
    } finally {
        process.exit();
    }
}
check();
