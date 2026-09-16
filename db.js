const { Pool } = require('pg');
const dns = require('dns');

// IMPORTANTE: Fuerza resolución IPv4 primero para evitar errores EAI_AGAIN
// causados por fallos de DNS IPv6 en contenedores (Pxxl, Docker, etc.)
dns.setDefaultResultOrder('ipv4first');

let pool = null;
let dbConnected = false;

// Cache hostname -> IP resuelta
const dnsCache = {};

// DNS públicos de respaldo: si el DNS del sistema falla (EAI_AGAIN),
// resolvemos directamente contra Google/Cloudflare/OpenDNS.
const PUBLIC_DNS_SERVERS = [
    ['8.8.8.8', '8.8.4.4'],            // Google
    ['1.1.1.1', '1.0.0.1'],            // Cloudflare
    ['208.67.222.222', '208.67.220.220'] // OpenDNS
];

function parseConnectionString(connStr) {
    const url = new URL(connStr);
    return {
        user: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
        host: url.hostname,
        port: parseInt(url.port || '5432', 10),
        database: decodeURIComponent(url.pathname.replace(/^\//, '')) || undefined
    };
}

// Resuelve un hostname a IP IPv4 usando el DNS del sistema y DNS públicos.
function resolveHostIPv4(host) {
    return new Promise((resolve, reject) => {
        if (dnsCache[host]) return resolve(dnsCache[host]);

        // 1) Intentar con el DNS del sistema
        dns.lookup(host, { family: 4 }, (err, address) => {
            if (!err && address) return finish(address, 'sistema');

            // 2) Probar con DNS públicos (vía Resolver, evita /etc/resolv.conf roto)
            let idx = 0;
            const next = () => {
                if (idx >= PUBLIC_DNS_SERVERS.length) {
                    const e = new Error(`[DB DNS] No se pudo resolver ${host} con ningún DNS`);
                    e.code = 'EAI_AGAIN';
                    return reject(e);
                }
                const servers = PUBLIC_DNS_SERVERS[idx++];
                const resolver = new dns.Resolver();
                try {
                    resolver.setServers(servers);
                    resolver.resolve4(host, (e2, addresses) => {
                        if (!e2 && addresses && addresses.length) return finish(addresses[0], `publico ${servers[0]}`);
                        next();
                    });
                } catch (e3) {
                    next();
                }
            };

            function finish(addr, via) {
                dnsCache[host] = addr;
                console.log(`[DB DNS] ${host} -> ${addr} (via ${via})`);
                resolve(addr);
            }

            next();
        });
    });
}

// Crea el Pool usando la IP directamente (evita el getaddrinfo de pg/Node).
async function createPool() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost/ecards_jm';
    const parts = parseConnectionString(connectionString);
    const useSSL = connectionString.includes('neon') || process.env.NODE_ENV === 'production';

    // Resolver a IP para saltarnos el DNS del contenedor
    let hostToUse = parts.host;
    try {
        hostToUse = await resolveHostIPv4(parts.host);
    } catch (e) {
        console.error(`${e.message} -> usando hostname original (${parts.host})`);
        hostToUse = parts.host;
    }

    // Si el host es una IP literal, listo; si no, es hostname (fallback).
    const isIP = require('net').isIP(hostToUse) !== 0;

    pool = new Pool({
        host: hostToUse,          // IP literal: Node OMITE DNS
        port: parts.port,
        user: parts.user,
        password: parts.password,
        database: parts.database,
        ssl: useSSL ? {
            rejectUnauthorized: false,
            servername: isIP ? parts.host : undefined, // SNI con el hostname real si usamos IP
            sslmode: 'require',
            ca: process.env.DB_SSL_CA || undefined
        } : false,
        connectionTimeoutMillis: 20000,
        idleTimeoutMillis: 30000,
        max: 10,
        min: 2,
        statement_timeout: 30000
    });

    pool.on('connect', (client) => {
        dbConnected = true;
        console.log('[DB] Cliente conectado a la base de datos');
    });

    pool.on('error', (err) => {
        console.error('[DB ERROR] Pool error (non-fatal):', err.code || err.message);
        if (err.code === 'EAI_AGAIN' || err.code === 'ENOTFOUND') {
            dnsCache.length = 0;
            Object.keys(dnsCache).forEach(k => delete dnsCache[k]);
        }
        dbConnected = false;
    });

    return pool;
}

async function getPool() {
    if (!pool) await createPool();
    return pool;
}

// Fuerza recreación del pool (tras fallos DNS sostenidos)
async function resetPool() {
    if (pool) {
        try { await pool.end(); } catch (e) {}
    }
    pool = null;
    dbConnected = false;
    Object.keys(dnsCache).forEach(k => delete dnsCache[k]);
}

function isConnected() {
    return dbConnected;
}

module.exports = { getPool, resetPool, isConnected };