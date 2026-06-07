#!/usr/bin/env node

/**
 * Health Check Script para Diagnóstico Pxxl
 * Verifica que todas las configuraciones estén correctas
 * Uso: node health-check.js
 */

require('dotenv').config();
const { getPool, isConnected } = require('./db');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

console.log('\n' + '='.repeat(70));
console.log('🏥 HEALTH CHECK - Diagnóstico de Configuración');
console.log('='.repeat(70) + '\n');

// Verificar variables de entorno
console.log('📋 VARIABLES DE ENTORNO:');
console.log(`  ✅ PORT: ${PORT}`);
console.log(`  ${DATABASE_URL ? '✅' : '❌'} DATABASE_URL: ${DATABASE_URL ? DATABASE_URL.substring(0, 40) + '...' : 'NO CONFIGURADA'}`);
console.log(`  ${JWT_SECRET ? '✅' : '⚠️ '} JWT_SECRET: ${JWT_SECRET ? 'Configurada' : 'No configurada (usando default)'}`);

// Verificar que sea número válido
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    console.log(`  ❌ ERROR: PORT ${PORT} no es válido (debe ser 1-65535)\n`);
    process.exit(1);
}

// Test de conexión a BD
console.log('\n🔌 TEST DE CONEXIÓN A BASE DE DATOS:');

const testDB = async () => {
    try {
        const pool = getPool();
        console.log('  ⏳ Intentando conectar a BD...');
        
        const result = await pool.query('SELECT NOW()');
        console.log(`  ✅ Conexión exitosa`);
        console.log(`  ℹ️  Timestamp BD: ${result.rows[0].now}`);
        
        // Verificar tablas
        const tables = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log(`  ℹ️  Tablas existentes: ${tables.rowCount}`);
        if (tables.rowCount > 0) {
            tables.rows.forEach(row => {
                console.log(`     - ${row.table_name}`);
            });
        }
        
        await pool.end();
        return true;
    } catch (err) {
        console.log(`  ❌ Error de conexión: ${err.message}`);
        if (!DATABASE_URL) {
            console.log(`\n  💡 SOLUCIÓN: Configura DATABASE_URL`);
            console.log(`     export DATABASE_URL="postgresql://user:pass@localhost/ecards_jm"`);
        }
        return false;
    }
};

testDB().then(success => {
    console.log('\n' + '='.repeat(70));
    if (success) {
        console.log('✅ DIAGNÓSTICO EXITOSO - Tu servidor está listo para Pxxl');
    } else {
        console.log('⚠️  DIAGNÓSTICO CON ADVERTENCIAS - Ver configuración arriba');
    }
    console.log('='.repeat(70) + '\n');
    
    console.log('🚀 PRÓXIMOS PASOS:');
    console.log('  1. Asegúrate que DATABASE_URL sea válida');
    console.log('  2. Ejecuta: npm start');
    console.log('  3. Verifica: curl http://localhost:' + PORT + '/health');
    console.log('  4. Sube cambios a Pxxl\n');
    
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('\n❌ Error fatal:', err.message);
    process.exit(1);
});
