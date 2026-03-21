// ===== MANEJO DE RUTAS ESPECÍFICAS PARA TARJETAS PÚBLICAS =====
app.get('/card/:id', async (req, res) => {
    // Esta ruta redirige a index.html para que el cliente maneje la ruta
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/#/card/:id', async (req, res) => {
    // Esta ruta maneja directamente la ruta hash
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Manejo de todas las demás rutas
app.get('*', (req, res) => {
    // Verificar si es una solicitud de API
    if (req.url.startsWith('/api/') || req.url.startsWith('/health')) {
        // Si es una solicitud de API, devolver error 404 genérico
        return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    // Para cualquier otra ruta, enviar index.html
    res.sendFile(path.join(__dirname, 'index.html'));
});