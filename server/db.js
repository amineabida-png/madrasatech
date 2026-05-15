// ============================================================
// db.js — Couche base de données PostgreSQL (Neon)
// Compatible avec l'interface sql.js utilisée dans index.js
// ============================================================
'use strict';
const { Pool } = require('pg');

const NEON_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_xrWu6gFfXJ7p@ep-mute-feather-a4h45acd-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('PG pool error:', err.message));

// ── Convertir SQL SQLite → PostgreSQL ─────────────────────────
function convertSQL(sql) {
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bAUTOINCREMENT\b/gi, '')
    .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ DEFAULT NOW()')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ')
    .replace(/DEFAULT CURRENT_DATE/gi, "DEFAULT CURRENT_DATE")
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION')
    .replace(/\bINTEGER\b(?!\s+PRIMARY)/gi, 'INTEGER')
    .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
    .replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO')
    .replace(/\?/g, () => { params_i++; return `$${params_i}`; });
}

let params_i = 0;

function pgify(sql) {
  params_i = 0;
  return sql
    .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
    .replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO')
    .replace(/\?/g, () => `$${++params_i}`);
}

// ── Exécution synchrone simulée via callbacks ─────────────────
// On utilise des Promises stockées globalement pour les résoudre
// dans les routes Express (qui sont async)

// ── Interface compatible better-sqlite3 ──────────────────────
// IMPORTANT: toutes les routes Express doivent être async
// et utiliser await db.prepare(sql).get/all/run

function createDB() {
  return {
    // exec : pour CREATE TABLE etc (fire & forget)
    exec: (sql) => {
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      statements.forEach(stmt => {
        if (!stmt) return;
        // Convert SQLite → PG syntax
        let pgStmt = stmt
          .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
          .replace(/\bAUTOINCREMENT\b/gi, '')
          .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ DEFAULT NOW()')
          .replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ')
          .replace(/DEFAULT CURRENT_DATE\b/gi, 'DEFAULT CURRENT_DATE')
          .replace(/\bREAL\b/gi, 'DOUBLE PRECISION')
          .replace(/CHECK\([^)]+\)/gi, '')
          .replace(/FOREIGN KEY\([^)]+\)\s*REFERENCES[^\n]+/gi, '')
          .replace(/ON CONFLICT IGNORE/gi, 'ON CONFLICT DO NOTHING')
          .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
          .replace(/sqlite_master/gi, 'information_schema.tables')
          .replace(/PRAGMA[^\n]+/gi, 'SELECT 1');
        pool.query(pgStmt).catch(e => {
          if (!e.message.includes('already exists') && !e.message.includes('duplicate column'))
            console.error('DB exec:', e.message.substring(0, 100), '\nSQL:', pgStmt.substring(0, 80));
        });
      });
    },

    pragma: () => {},

    // prepare : retourne un objet avec run/get/all (tous async)
    prepare: (sql) => {
      return {
        run: async (...args) => {
          params_i = 0;
          let pgSql = sql
            .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
            .replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO')
            .replace(/\?/g, () => `$${++params_i}`);
          
          // Add RETURNING id for INSERT
          if (/^\s*INSERT/i.test(pgSql) && !pgSql.includes('RETURNING')) {
            pgSql += ' RETURNING id';
          }
          
          const params = args.flat().map(p => p === undefined ? null : p);
          try {
            const r = await pool.query(pgSql, params);
            const lastId = r.rows && r.rows[0] ? (r.rows[0].id || null) : null;
            return { lastInsertRowid: lastId, changes: r.rowCount || 0 };
          } catch(e) {
            console.error('DB run error:', e.message.substring(0,100));
            console.error('SQL:', pgSql.substring(0,100));
            console.error('Params:', params);
            throw e;
          }
        },

        get: async (...args) => {
          params_i = 0;
          const pgSql = sql.replace(/\?/g, () => `$${++params_i}`);
          const params = args.flat().map(p => p === undefined ? null : p);
          try {
            const r = await pool.query(pgSql, params);
            return r.rows[0] || undefined;
          } catch(e) {
            console.error('DB get error:', e.message.substring(0,100));
            console.error('SQL:', pgSql.substring(0,100));
            throw e;
          }
        },

        all: async (...args) => {
          params_i = 0;
          const pgSql = sql.replace(/\?/g, () => `$${++params_i}`);
          const params = args.flat().map(p => p === undefined ? null : p);
          try {
            const r = await pool.query(pgSql, params);
            return r.rows || [];
          } catch(e) {
            console.error('DB all error:', e.message.substring(0,100));
            console.error('SQL:', pgSql.substring(0,100));
            throw e;
          }
        }
      };
    }
  };
}

module.exports = { createDB, pool };
