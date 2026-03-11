const express = require('express');
const cors = require('cors');
const pool = require('./db'); // Esta es la línea que querías agregar

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());
app.use(cors({
  origin: ['http://127.0.0.1:5000', 'https://jomar71.github.io'],
  credentials: true
}));

// Ruta de ejemplo para probar la conexión a la base de datos
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as now');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error conectando a la base de datos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log('Base de datos PostgreSQL conectada correctamente');
});