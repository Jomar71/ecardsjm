# 🚀 Configuración de Pxxl para eCardsjm

## 📋 Requisitos

Tu servidor ahora está optimizado para Pxxl. Sigue estos pasos:

## 1️⃣ Verifica Variables de Entorno en Pxxl

En tu panel de Pxxl, asegúrate que estas variables estén configuradas:

```
DATABASE_URL = postgresql://usuario:contraseña@host.neon.tech/basedatos
JWT_SECRET = tu_clave_secreta_super_segura
PORT = (Pxxl lo proporciona automáticamente)
```

### ⚠️ Importante: DATABASE_URL

Si usas **Neon.tech** (recomendado), la URL es:
```
postgresql://usuario:contraseña@host.neon.tech/ecards_jm?sslmode=require
```

## 2️⃣ Verifica Localmente

Antes de deployar, prueba que todo funciona:

```bash
# 1. Instala dependencias
npm install

# 2. Configura tu DATABASE_URL (copia la de Pxxl)
export DATABASE_URL="tu_url_aqui"
export JWT_SECRET="tu_secreto_aqui"

# 3. Ejecuta health check
node health-check.js

# 4. Inicia servidor
npm start

# 5. En otra terminal, prueba endpoints:
curl http://localhost:3000/health
curl http://localhost:3000/ping
```

## 3️⃣ Troubleshooting - Si Pxxl dice "all_upstreams_unhealthy"

### ✅ Cambios que hemos hecho:
- ✅ Mejorado pool de conexiones DB
- ✅ Error handlers no crashean el servidor
- ✅ Health checks siempre responden rápido
- ✅ Mejor logging para diagnosticar

### 🔍 Si sigue sin funcionar:

1. **Verifica el log de Pxxl:**
   - Mira los logs en el dashboard de Pxxl
   - Busca `SERVIDOR INICIADO Y ESCUCHANDO`

2. **Verifica DATABASE_URL:**
   ```bash
   node health-check.js
   ```
   Debe decir: `✅ Conexión exitosa`

3. **Verifica que Puerto esté correcto:**
   - El servidor DEBE escuchar en: `0.0.0.0:PORT`
   - Pxxl proporciona PORT como variable de entorno

4. **Revisa errores de conexión:**
   - Si BD está en Neon.tech, verifica SSL esté habilitado
   - Si BD está local, asegúrate que sea accesible desde Pxxl

## 📝 Notas Importantes

- El servidor NO crashea si la BD no está disponible
- Los endpoints /health y /ping responden inmediatamente
- Todos los datos se guardan en la BD (PostgreSQL)
- El servidor intenta inicializar tablas automáticamente

## 🆘 Si necesitas ayuda

1. Revisa `/health`:
   ```bash
   curl https://ecardsjm.pxxl.click/health
   ```
   Debe retornar:
   ```json
   {
     "status": "ok",
     "dbConnected": true,
     "port": 3000,
     "timestamp": "2024-..."
   }
   ```

2. Revisa logs de Pxxl en el dashboard
3. Verifica que DATABASE_URL sea válida

¡Éxito! 🎉
