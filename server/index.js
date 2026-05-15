'use strict';
// Patch Express to handle async errors
const express = require('express');
const originalAppMethod = (method) => {
  const orig = express.application[method];
  if (orig) {
    express.application[method] = function(...args) {
      // Wrap last function argument to catch async errors
      const last = args[args.length - 1];
      if (typeof last === 'function') {
        const orig_fn = last;
        args[args.length - 1] = function(req, res, next) {
          const result = orig_fn(req, res, next);
          if (result && typeof result.catch === 'function') {
            result.catch(next);
          }
        };
      }
      return orig.call(this, ...args);
    };
  }
};
['get','post','put','delete','patch'].forEach(originalAppMethod);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'madrasatech-secret-2024-xK9mP2qR';

// ── Database ──────────────────────────────────────────────────
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'madrasatech.db');
let db;

// ── PostgreSQL via Neon ──────────────────────────────────────
const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_xrWu6gFfXJ7p@ep-mute-feather-a4h45acd-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 10,
});

pgPool.on('error', (err) => console.error('PG pool error:', err.message));

// Interface compatible : db.prepare(sql).run/get/all
// Toutes les routes sont async, donc on peut utiliser await
function createPgDB(pool) {
  function pgify(sql) {
    let i = 0;
    // Convert SQLite → PostgreSQL syntax
    return sql
      .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
      .replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO')
      .replace(/strftime\("%Y-%m",\s*([^)]+)\)/gi, "TO_CHAR($1, 'YYYY-MM')")
      .replace(/last_insert_rowid\(\)/gi, 'lastval()')
      .replace(/PRAGMA[^\n]+/gi, 'SELECT 1')
      .replace(/sqlite_master/gi, 'pg_tables')
      .replace(/\?/g, () => `$${++i}`);
  }

  function sanitize(args) {
    return args.flat().map(p => p === undefined ? null : p);
  }

  return {
    pragma: () => {},

    exec: (sql) => {
      // fire-and-forget for CREATE TABLE, ALTER TABLE
      const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
      stmts.forEach(stmt => {
        let pg = stmt
          .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
          .replace(/AUTOINCREMENT/gi, '')
          .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ DEFAULT NOW()')
          .replace(/DATETIME/gi, 'TIMESTAMPTZ')
          .replace(/DEFAULT CURRENT_DATE/gi, 'DEFAULT CURRENT_DATE')
          .replace(/REAL/g, 'DOUBLE PRECISION')
          .replace(/CHECK\([^)]+\)/gi, '')
          .replace(/FOREIGN KEY\([^)]+\)\s*REFERENCES[^\n,]+/gi, '')
          .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
          .replace(/PRAGMA[^\n]+/gi, '')
          .replace(/sqlite_master/gi, 'pg_tables');
        if (!pg.trim()) return;
        pool.query(pg).catch(e => {
          if (!e.message.includes('already exists') && 
              !e.message.includes('duplicate column') &&
              !e.message.includes('does not exist'))
            console.error('exec:', e.message.substring(0,100));
        });
      });
    },

    prepare: (sql) => {
      return {
        run: async (...args) => {
          const params = sanitize(args);
          let pgSql = pgify(sql);
          if (/^\s*INSERT/i.test(pgSql) && !pgSql.includes('RETURNING')) {
            pgSql += ' RETURNING id';
          }
          try {
            const r = await pool.query(pgSql, params);
            const lastId = r.rows?.[0]?.id || null;
            return { lastInsertRowid: lastId, changes: r.rowCount || 0 };
          } catch(e) {
            console.error('run:', e.message.substring(0,120));
            console.error('sql:', pgSql.substring(0,100));
            throw e;
          }
        },
        get: async (...args) => {
          const params = sanitize(args);
          const pgSql = pgify(sql);
          try {
            const r = await pool.query(pgSql, params);
            return r.rows[0] || undefined;
          } catch(e) {
            console.error('get:', e.message.substring(0,120));
            throw e;
          }
        },
        all: async (...args) => {
          const params = sanitize(args);
          const pgSql = pgify(sql);
          try {
            const r = await pool.query(pgSql, params);
            return r.rows || [];
          } catch(e) {
            console.error('all:', e.message.substring(0,120));
            throw e;
          }
        }
      };
    }
  };
}

db = createPgDB(pgPool);

// Test connection then init
pgPool.query('SELECT 1').then(() => {
  console.log('✅ PostgreSQL Neon connecté');
  initDB().then(() => startServer()).catch(e => {
    console.error('initDB error:', e.message);
    process.exit(1);
  });
}).catch(e => {
  console.error('❌ PostgreSQL connexion échouée:', e.message);
  process.exit(1);
});

async function initDB() {
  // Create all tables
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, nom TEXT NOT NULL, prenom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      role TEXT DEFAULT 'admin', school TEXT DEFAULT 'Mon École',
      plan TEXT DEFAULT 'pro', plan_expires TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), last_login TIMESTAMPTZ, is_demo INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS school_users (
      id SERIAL PRIMARY KEY, owner_id INTEGER NOT NULL,
      nom TEXT NOT NULL, prenom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      role TEXT NOT NULL, telephone TEXT,
      actif INTEGER DEFAULT 1, eleve_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(), last_login TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS eleves (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      nom TEXT NOT NULL, prenom TEXT NOT NULL, date_naissance TEXT,
      cin_parent TEXT, telephone TEXT, email TEXT, adresse TEXT,
      classe TEXT, niveau TEXT, genre TEXT DEFAULT 'M', photo TEXT,
      massar TEXT, date_inscription TEXT DEFAULT CURRENT_DATE,
      statut TEXT DEFAULT 'actif', created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS classes (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      nom TEXT NOT NULL, niveau TEXT, annee_scolaire TEXT,
      max_eleves INTEGER DEFAULT 35, professeur_principal TEXT,
      salle TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS professeurs (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      nom TEXT NOT NULL, prenom TEXT NOT NULL, email TEXT, telephone TEXT,
      cin TEXT, matiere TEXT, type_contrat TEXT DEFAULT 'CDI',
      salaire DOUBLE PRECISION DEFAULT 0,
      date_recrutement TEXT DEFAULT CURRENT_DATE,
      statut TEXT DEFAULT 'actif', created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, eleve_id INTEGER NOT NULL,
      matiere TEXT NOT NULL, note DOUBLE PRECISION NOT NULL,
      coefficient DOUBLE PRECISION DEFAULT 1, trimestre INTEGER DEFAULT 1,
      annee_scolaire TEXT, type_eval TEXT DEFAULT 'controle',
      date_eval TEXT DEFAULT CURRENT_DATE, observations TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS absences (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, eleve_id INTEGER NOT NULL,
      date_absence TEXT NOT NULL, heure_debut TEXT, heure_fin TEXT,
      motif TEXT, justifiee INTEGER DEFAULT 0, matiere TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS paiements (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, eleve_id INTEGER NOT NULL,
      mois TEXT NOT NULL, annee INTEGER NOT NULL,
      montant DOUBLE PRECISION NOT NULL, montant_du DOUBLE PRECISION NOT NULL,
      statut TEXT DEFAULT 'impaye', date_paiement TEXT,
      mode_paiement TEXT DEFAULT 'especes', reference TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS emploi_temps (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      classe TEXT NOT NULL, jour TEXT NOT NULL,
      heure_debut TEXT NOT NULL, heure_fin TEXT NOT NULL,
      matiere TEXT NOT NULL, professeur TEXT, salle TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS annonces (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      titre TEXT NOT NULL, contenu TEXT NOT NULL,
      cible TEXT DEFAULT 'tous', priorite TEXT DEFAULT 'normale',
      date_publication TEXT DEFAULT CURRENT_DATE,
      active INTEGER DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS depenses (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      libelle TEXT NOT NULL, montant DOUBLE PRECISION NOT NULL,
      categorie TEXT DEFAULT 'autre', date_depense TEXT DEFAULT CURRENT_DATE,
      fournisseur TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS devoirs (
      id SERIAL PRIMARY KEY, owner_id INTEGER NOT NULL,
      titre TEXT NOT NULL, description TEXT, matiere TEXT NOT NULL,
      classe TEXT, date_limite TEXT, type TEXT DEFAULT 'devoir',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS rendus_devoirs (
      id SERIAL PRIMARY KEY, devoir_id INTEGER NOT NULL,
      eleve_user_id INTEGER NOT NULL, contenu TEXT, fichier_nom TEXT,
      fichier_data TEXT, statut TEXT DEFAULT 'rendu',
      note DOUBLE PRECISION, commentaire_prof TEXT,
      rendu_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY, owner_id INTEGER NOT NULL,
      from_id INTEGER NOT NULL, from_type TEXT NOT NULL,
      to_id INTEGER, to_type TEXT, sujet TEXT NOT NULL,
      contenu TEXT NOT NULL, lu INTEGER DEFAULT 0,
      parent_id INTEGER, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS calendrier (
      id SERIAL PRIMARY KEY, owner_id INTEGER NOT NULL,
      titre TEXT NOT NULL, description TEXT,
      type TEXT DEFAULT 'evenement', date_debut TEXT NOT NULL,
      date_fin TEXT, heure_debut TEXT, heure_fin TEXT,
      couleur TEXT DEFAULT '#6366f1', classes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY, owner_id INTEGER NOT NULL,
      destinataire TEXT NOT NULL, canal TEXT NOT NULL,
      objet TEXT NOT NULL, message TEXT NOT NULL,
      statut TEXT DEFAULT 'en_attente', envoye_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS sessions_demo (
      id SERIAL PRIMARY KEY, ip TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS demandes_test (
      id SERIAL PRIMARY KEY, ecole TEXT NOT NULL,
      nom TEXT NOT NULL, prenom TEXT NOT NULL,
      telephone TEXT NOT NULL, email TEXT NOT NULL,
      ville TEXT, nb_eleves TEXT, message TEXT,
      statut TEXT DEFAULT 'en_attente', created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];

  for (const sql of tables) {
    await pgPool.query(sql).catch(e => {
      if (!e.message.includes('already exists'))
        console.error('Table create error:', e.message.substring(0,80));
    });
  }

  // Seed admin
  const adminExists = await db.prepare('SELECT id FROM users WHERE email = $1').get('admin@madrasatech.ma');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin2024', 10);
    const r = await db.prepare('INSERT INTO users (nom,prenom,email,password,role,school,plan,is_demo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id')
      .run('Admin','MadrasaTech','admin@madrasatech.ma',hash,'superadmin','MadrasaTech Demo','pro',0);
    
    const demoHash = bcrypt.hashSync('demo2024', 10);
    const r2 = await db.prepare('INSERT INTO users (nom,prenom,email,password,role,school,plan,is_demo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id')
      .run('Demo','Utilisateur','demo@madrasatech.ma',demoHash,'admin','Lycée Ibn Khaldoun','demo',1);
    
    if (r2.lastInsertRowid) await seedDemoData(r2.lastInsertRowid);
    console.log('✅ Comptes admin et demo créés');
  }
}


