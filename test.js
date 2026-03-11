const pool = require('./db');

async function probarConexion() {
  try {
    const resultado = await pool.query('SELECT NOW() as hora_actual');
    console.log('✅ CONEXIÓN EXITOSA');
    console.log('Hora del servidor:', resultado.rows[0].hora_actual);
  } catch (error) {
    console.log('❌ ERROR DE CONEXIÓN');
    console.log(error.message);
  } finally {
    await pool.end();
  }
}

probarConexion();