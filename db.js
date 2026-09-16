const { Pool } = require('pg');
const dns = require('dns');

// IMPORTANTE: Fuerza resolución IPv4 primero para evitar errores EAI_AGAIN
// causados por fallos de DNS IPv6 en contenedores (Pxxl, Docker, etc.)
dns.setDefaultResultOrder('ipv4first');

let pool = null;
let dbConnected = false;
let poolInitialized = false;

// ===== RESOLUCIÓN DNS ROBUSTA =====
// Cache hostname -> IP resuelta para no repetir consultas DNS constantemente
const dnsCache = {};

// Lista de DNS públicos como respaldo en caso de que el DNS del contenedor falle
const PUBLIC_DNS_SERVERS = [
    ['8.8.8.8', '8.8.4.4'],        // Google
    ['1.1.1.1', '1.0.0.1'],        // Cloudflare
    ['208.67.222.222', '208.67.220.220'] // OpenDNS
];

// Genera variantes del hostname de Neon en caso de que el host exacto no resuelva
function getHostVariants(host) {
    const variants = [host];
    // Neon pooled format: ep-xxx-pooler.c-6.us-east-1.aws.neon.tech
    // 1) Quitar el segmento .c-<n> (compute id) del pooled host
    if (/\-pooler\.c-\d+\./.test(host)) {
        variants.push(host.replace(/\-pooler\.c-\d+\./, '-pooler.'));
    }
    // 2) Quitar '-pooler' del todo -> host directo del compute
    if (host.includes('-pooler')) {
        variants.push(host.replace('-pooler', ''));
    }
    return [...new Set(variants)];
}

// Resuelve un hostname usando varios DNS y devuelve la primera IP IPv4 válida
function resolveHost(host, cb) {
    if (dnsCache[host]) return cb(null, dnsCache[host], 4);

    const variants = getHostVariants(host);
    let variantIndex = 0;
    let serverIndex = 0;

    function tryNext() {
        if (variantIndex >= variants.length) {
            const err = new Error(`DNS resolution failed for ${host}`);
            err.code = 'EAI_AGAIN';
            return cb(err);
        }
        const currentHost = variants[variantIndex];

        if (serverIndex === 0) {
            // Primer intento con el DNS del sistema
            dns.lookup(currentHost, { family: 4 }, (err, address) => {
                if (!err && address) return success(currentHost, address);
                serverIndex = 1;
                tryNext();
            });
        } else {
            let found = false;
            let tries = 0;
            for (let s = serverIndex - 1; s < PUBLIC_DNS_SERVERS.length && !found; s++) {
                const servers = PUBLIC_DNS_SERVERS[s];
                const resolver = new dns.Resolver();
                try {
                    resolver.setServers(servers);
                    resolver.resolve4(currentHost, (err, addresses) => {
                        tries++;
                        if (!err && addresses && addresses.length) {
                            found = true;
                            return success(currentHost, addresses[0]);
                        }
                        if (tries >= (PUBLIC_DNS_SERVERS.length - (serverIndex - 1))) {
                            variantIndex++;
                            serverIndex = 0;
                            tryNext();
                        }
                    });
                } catch (e) {
                    tries++;
                    if (tries >= (PUBLIC_DNS_SERVERS.length - (serverIndex - 1))) {
                        variantIndex++;
                        serverIndex = 0;
                        tryNext();
                    }
                }
            }
        }
    }

    function success(hostUsed, address) {
        console.log(`[DB DNS] Resuelto ${host} -> ${address} (via ${hostUsed})`);
        dnsCache[host] = address;
        dnsCache[hostUsed] = address;
        cb(null, address, 4);
    }

    tryNext();
}

// Custom lookup compatible con pg: recibe (hostname, options, callback)
function customLookup(hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    resolveHost(hostname, callback);
}

function getPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL || 'postgresql://localhost/ecards_jm';

        const useSSL = connectionString.includes('neon') || process.env.NODE_ENV === 'production';

        pool = new Pool({
            connectionString,
            family: 4,
            lookup: customLookup, // Resolución DNS robusta con fallbacks
            ssl: useSSL ? {
                rejectUnauthorized: false,
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

        pool.on('remove', (client) => {
            console.log('[DB] Cliente removido del pool');
        });

        pool.on('error', (err) => {
            console.error('[DB ERROR] Pool error (non-fatal):', err.message);
            dbConnected = false;
        });

        // Al fallar la creación de clientes, recargar DNS cache para forzar nueva resolución
        pool.on('clientError', (err) => {
            console.error('[DB ERROR] clientError:', err.message, err.code);
        });
    }
    return pool;
}

// Refresca el pool de conexiones (útil tras fallos DNS sostenidos)
function resetPool() {
    dnsCache.length = 0;
    Object.keys(dnsCache).forEach(k => delete dnsCache[k]);
    if (pool) {
        pool.end().catch(() => {});
        pool = null;
        dbConnected = false;
    }
}

function isConnected() {
    return dbConnected;
}

module.exports = { getPool, isConnected, resetPool };