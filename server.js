const express = require('express');
const cors = require('cors');
const pool = require('./db'); // Esta es la línea que querías agregar

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json({ limit: '50mb' })); // Aumentamos límite para base64 largos
app.use(cors());

// Servir archivos estáticos (Frontend)
app.use(express.static(__dirname));

// Pantalla principal del frontend (SPA fallback)
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

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

// --- BUSINESS LOGIC API (Tarjetas) ---

// Obtener todas las tarjetas
app.get('/api/cards', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM business_cards ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar tarjetas:', err);
    res.status(500).json({ error: 'DB_ERROR' });
  }
});

// Guardar o actualizar tarjeta
app.post('/api/cards', async (req, res) => {
  const data = req.body;
  // Validar que al menos tenga un nombre para identificarla
  if (!data['first-name'] && !data.name) return res.status(400).json({ error: 'NAME_REQUIRED' });

  // ONLY allow keys that exist in the database table
  const allowedKeys = [
      'id', 'first-name', 'last-name', 'name', 'title', 'email', 'phone', 
      'website', 'address', 'company', 'bio', 'facebook', 'instagram', 
      'linkedin', 'twitter', 'whatsapp', 'github', 'behance', 'youtube', 
      'tiktok', 'template_id', 'logo_path', 'profile_path', 'bg_image_path', 
      'font_file_path', 'custom_css', 'custom_fonts', 'bg_color', 'text_color', 'primary_color'
  ];

  /* Construir tabla limpia */
  const cleanData = {};
  
  // Frontend envia "job-title" y "description", la base de datos espera "title" y "bio"
  if (data['job-title']) cleanData['title'] = data['job-title'];
  if (data['title']) cleanData['title'] = data['title']; // si ya venía por name="title"
  if (data['description']) cleanData['bio'] = data['description'];
  if (data['bio']) cleanData['bio'] = data['bio'];
  
  for (const key in data) {
      // Evitar sobreescribir los mapeos anteriores si hay duplicados, y asegurar que es una columna permitida
      if (allowedKeys.includes(key) && key !== 'job-title' && key !== 'description') {
          cleanData[key] = data[key];
      }
  }

  try {
    const columns = Object.keys(cleanData);
    const values = Object.values(cleanData);
    
    if (columns.length === 0) return res.status(400).json({ error: 'NO_DATA' });

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    // Escapar nombres de columnas con comillas dobles para PostgreSQL y guiones
    const columnsString = columns.map(c => `"${c}"`).join(', ');

    // Intento de "Upsert" (Inserción o Actualización) - Basado en ID
    const query = `
      INSERT INTO business_cards (${columnsString})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET
      ${columns.map((col, i) => `"${col}" = EXCLUDED."${col}"`).join(', ')}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    res.json({ status: 'success', card: result.rows[0] });
  } catch (err) {
    console.error('Error al guardar tarjeta:', err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Obtener una tarjeta por ID
app.get('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM business_cards WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'MISSING' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener tarjeta:', err);
    res.status(500).json({ error: 'DB_ERROR' });
  }
});

// Eliminar una tarjeta
app.delete('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM business_cards WHERE id = $1', [id]);
    res.json({ status: 'success', message: 'Card deleted' });
  } catch (err) {
    console.error('Error al eliminar tarjeta:', err);
    res.status(500).json({ error: 'DB_ERROR' });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log('Base de datos PostgreSQL configurada correctamente');
});