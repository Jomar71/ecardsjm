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

app.use(express.static(path.join(__dirname), { extensions: ['css', 'js', 'html', 'ico'], index: false }));

// Serve specific static files explicitly
app.get('/styles.css', (req, res) => {
    res.type('text/css').sendFile(path.join(__dirname, 'styles.css'));
});

app.get('/script.js', (req, res) => {
    res.type('application/javascript').sendFile(path.join(__dirname, 'script.js'));
});

app.get('/favicon.ico', (req, res) => {
    res.sendStatus(204);
});

// Ensure API routes are properly defined
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos' });
    }

    try {
        const user = await User.create({ username, password });
        res.status(201).json({ message: 'Usuario creado exitosamente', user });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos' });
    }

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'Inicio de sesión exitoso', token });
    } catch (error) {
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
