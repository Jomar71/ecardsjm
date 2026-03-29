require('dotenv').config();
const { getPool } = require('./db');
const bcrypt = require('bcryptjs');

async function listUsers() {
    const pool = getPool();
    try {
        const result = await pool.query('SELECT id, username, is_authorized, is_admin, created_at FROM users ORDER BY created_at DESC');
        console.log('Usuarios encontrados:', result.rows.length);
        result.rows.forEach(user => {
            console.log(`ID: ${user.id}, Usuario: ${user.username}, Autorizado: ${user.is_authorized}, Admin: ${user.is_admin}, Fecha: ${user.created_at}`);
        });
    } catch (err) {
        console.error('Error al listar usuarios:', err.message);
    }
}

async function makeUserAdmin(userId) {
    const pool = getPool();
    try {
        await pool.query('UPDATE users SET is_authorized = true, is_admin = true WHERE id = $1', [userId]);
        console.log(`Usuario con ID ${userId} ahora es administrador y está autorizado.`);
    } catch (err) {
        console.error('Error al actualizar usuario:', err.message);
    }
}

async function deleteUser(userId) {
    const pool = getPool();
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        console.log(`Usuario con ID ${userId} eliminado.`);
    } catch (err) {
        console.error('Error al eliminar usuario:', err.message);
    }
}

async function resetUsers() {
    const pool = getPool();
    try {
        await pool.query('DELETE FROM users;');
        console.log('Todos los usuarios eliminados.');
    } catch (err) {
        console.error('Error al eliminar usuarios:', err.message);
    }
}

async function createUser(username, password, isAdmin = false) {
    const pool = getPool();
    const passwordHash = await bcrypt.hash(password, 10);
    
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password_hash, is_authorized, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, username, is_authorized, is_admin',
            [username, passwordHash, true, isAdmin]
        );
        console.log(`Usuario ${username} creado con éxito. ID: ${result.rows[0].id}, Admin: ${result.rows[0].is_admin}`);
    } catch (err) {
        if (err.code === '23505') {
            console.log(`Usuario ${username} ya existe.`);
        } else {
            console.error('Error al crear usuario:', err.message);
        }
    }
}

async function runCommand() {
    const command = process.argv[2];
    const arg = process.argv[3];

    if (command === 'list') {
        await listUsers();
    } else if (command === 'makeadmin' && arg) {
        await makeUserAdmin(parseInt(arg));
    } else if (command === 'delete' && arg) {
        await deleteUser(parseInt(arg));
    } else if (command === 'reset') {
        await resetUsers();
    } else if (command === 'create' && arg) {
        const password = process.argv[4] || 'defaultPassword123!';
        const isAdmin = process.argv[5] === 'true';
        await createUser(arg, password, isAdmin);
    } else {
        console.log('Comandos disponibles:');
        console.log('  node admin_utils.js list                    - Listar usuarios');
        console.log('  node admin_utils.js makeadmin <userId>     - Convertir usuario en admin');
        console.log('  node admin_utils.js delete <userId>        - Eliminar usuario');
        console.log('  node admin_utils.js reset                  - Eliminar todos los usuarios');
        console.log('  node admin_utils.js create <username> [password] [isAdmin] - Crear usuario');
    }
}

runCommand().then(() => {
    // Finalizar conexiones de la base de datos
    process.exit(0);
});