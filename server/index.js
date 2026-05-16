'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Error handling via try/catch dans chaque route

// ── Upload fichiers (multer mémoire → base64 en DB) ───────────
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/gif','image/webp',
      'application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Type de fichier non autorisé'));
  }
});
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'madrasatech-secret-2024-xK9mP2qR';

// ── PostgreSQL Railway ────────────────────────────────────────
const { Pool } = require('pg');
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('❌ DATABASE_URL manquante'); process.exit(1); }

const pgPool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  max: 10,
  connectionTimeoutMillis: 10000,
});
pgPool.on('error', e => console.error('PG error:', e.message));

let db;

// ── Adaptateur PostgreSQL ─────────────────────────────────────
function createPgDB(pool) {
  const pgify = (sql) => {
    let i = 0;
    return sql
      .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
      .replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO')
      .replace(/\?/g, () => `$${++i}`);
  };
  const clean = (args) => args.flat().map(p => p === undefined ? null : p);
  return {
    pragma: () => {},
    exec: (sql) => {
      // Fire and forget - handled by initDB directly
    },
    prepare: (sql) => ({
      run: async (...args) => {
        let q = pgify(sql);
        if (/^\s*INSERT/i.test(q) && !q.includes('RETURNING')) q += ' RETURNING id';
        try {
          const r = await pool.query(q, clean(args));
          return { lastInsertRowid: r.rows?.[0]?.id || null, changes: r.rowCount };
        } catch(e) {
          console.error('DB run error:', e.message.substring(0,100), '| SQL:', q.substring(0,80));
          throw e;
        }
      },
      get: async (...args) => {
        const q = pgify(sql);
        try {
          const r = await pool.query(q, clean(args));
          return r.rows[0];
        } catch(e) {
          console.error('DB get error:', e.message.substring(0,100), '| SQL:', q.substring(0,80));
          throw e;
        }
      },
      all: async (...args) => {
        const q = pgify(sql);
        try {
          const r = await pool.query(q, clean(args));
          return r.rows;
        } catch(e) {
          console.error('DB all error:', e.message.substring(0,100), '| SQL:', q.substring(0,80));
          throw e;
        }
      }
    })
  };
}


// ── Init DB et démarrage ─────────────────────────────────────
db = createPgDB(pgPool);

async function boot() {
  console.log('🔌 Connexion à PostgreSQL...');
  try {
    await pgPool.query('SELECT 1');
    console.log('✅ PostgreSQL Railway connecté');
  } catch(e) {
    console.error('❌ PostgreSQL connexion échouée:', e.message);
    process.exit(1);
  }
  try {
    await initDB();
    console.log('✅ Base de données initialisée');
  } catch(e) {
    console.error('❌ initDB error:', e.message);
    process.exit(1);
  }
  startServer();
}

boot();

async function initDB() {
  // Create tables with PostgreSQL syntax
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
      nom TEXT NOT NULL, prenom TEXT NOT NULL,
      date_naissance TEXT, cin_parent TEXT, telephone TEXT, email TEXT,
      adresse TEXT, classe TEXT, niveau TEXT, genre TEXT DEFAULT 'M',
      photo TEXT, massar TEXT, date_inscription TEXT,
      statut TEXT DEFAULT 'actif', created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS classes (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      nom TEXT NOT NULL, niveau TEXT, annee_scolaire TEXT,
      max_eleves INTEGER DEFAULT 35, professeur_principal TEXT, salle TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS professeurs (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      nom TEXT NOT NULL, prenom TEXT NOT NULL, email TEXT, telephone TEXT,
      cin TEXT, matiere TEXT, type_contrat TEXT DEFAULT 'CDI',
      salaire DOUBLE PRECISION DEFAULT 0, date_recrutement TEXT,
      statut TEXT DEFAULT 'actif', created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, eleve_id INTEGER NOT NULL,
      matiere TEXT NOT NULL, note DOUBLE PRECISION NOT NULL,
      coefficient DOUBLE PRECISION DEFAULT 1, trimestre INTEGER DEFAULT 1,
      annee_scolaire TEXT, type_eval TEXT DEFAULT 'controle',
      date_eval TEXT, observations TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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
      montant DOUBLE PRECISION NOT NULL DEFAULT 0,
      montant_du DOUBLE PRECISION NOT NULL DEFAULT 0,
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
      date_publication TEXT, active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS depenses (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
      libelle TEXT NOT NULL, montant DOUBLE PRECISION NOT NULL DEFAULT 0,
      categorie TEXT DEFAULT 'autre', date_depense TEXT,
      fournisseur TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS devoirs (
      id SERIAL PRIMARY KEY, owner_id INTEGER NOT NULL,
      titre TEXT NOT NULL, description TEXT, matiere TEXT NOT NULL,
      classe TEXT, date_limite TEXT, type TEXT DEFAULT 'devoir',
      fichier_nom TEXT, fichier_data TEXT, fichier_type TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS rendus_devoirs (
      id SERIAL PRIMARY KEY, devoir_id INTEGER NOT NULL,
      eleve_user_id INTEGER NOT NULL, contenu TEXT,
      fichier_nom TEXT, fichier_data TEXT, fichier_type TEXT,
      statut TEXT DEFAULT 'rendu', note DOUBLE PRECISION,
      commentaire_prof TEXT, rendu_at TIMESTAMPTZ DEFAULT NOW()
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
  const adminCheck = await pgPool.query("SELECT id FROM users WHERE email=$1", ['admin@madrasatech.ma']);
  if (adminCheck.rows.length === 0) {
    const hash = bcrypt.hashSync('admin2024', 10);
    const r = await pgPool.query(
      "INSERT INTO users (nom,prenom,email,password,role,school,plan,is_demo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      ['Admin','MadrasaTech','admin@madrasatech.ma',hash,'superadmin','MadrasaTech Demo','pro',0]
    );
    const demoHash = bcrypt.hashSync('demo2024', 10);
    const r2 = await pgPool.query(
      "INSERT INTO users (nom,prenom,email,password,role,school,plan,is_demo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      ['Demo','Utilisateur','demo@madrasatech.ma',demoHash,'admin','Lycée Ibn Khaldoun','demo',1]
    );
    if (r2.rows[0]) await seedDemoData(r2.rows[0].id);
    console.log('✅ Comptes créés: admin@madrasatech.ma / admin2024');
  }
}


async function seedDemoData(userId) {
  // Classes
  const classes = ['1ère BAC A','1ère BAC B','2ème BAC SPC','2ème BAC SVT','3ème Collège','4ème Collège','5ème Primaire','6ème Primaire'];
  for (const c of classes) {
    const niveau = c.includes('BAC') ? 'lycee' : c.includes('Collège') ? 'college' : 'primaire';
    await db.prepare('INSERT INTO classes (user_id,nom,niveau,annee_scolaire,max_eleves) VALUES (?,?,?,?,?)').run(userId,c,niveau,'2024-2025',35);
  }

  // Professeurs
  const profs = [
    ['Alami','Mohamed','m.alami@ecole.ma','0661234567','Mathématiques'],
    ['Benali','Fatima','f.benali@ecole.ma','0662345678','Français'],
    ['Chakir','Youssef','y.chakir@ecole.ma','0663456789','Arabe'],
    ['Dahbi','Samira','s.dahbi@ecole.ma','0664567890','SVT'],
    ['Ezzaki','Omar','o.ezzaki@ecole.ma','0665678901','Physique'],
    ['Filali','Nadia','n.filali@ecole.ma','0666789012','Histoire-Géo'],
  ];
  for (const [nom,prenom,email,tel,mat] of profs) {
    await db.prepare('INSERT INTO professeurs (user_id,nom,prenom,email,telephone,matiere,salaire) VALUES (?,?,?,?,?,?,?)').run(userId,nom,prenom,email,tel,mat,6500);
  }

  // Élèves
  const prenomsM = ['Mohamed','Ahmed','Youssef','Omar','Khalid','Ibrahim','Hassan','Rachid','Amine','Saad'];
  const prenomsF = ['Fatima','Aicha','Meryem','Soukaina','Nour','Sara','Zineb','Houda','Laila','Rim'];
  const noms = ['Alaoui','Benali','Chakir','Dahbi','El Fassi','Filali','Guerraoui','Hamid','Idrissi','Jebari'];

  let eleves = [];
  for (let i = 0; i < 80; i++) {
    const isFemale = i % 3 === 0;
    const prenom = isFemale ? prenomsF[i % 10] : prenomsM[i % 10];
    const nom = noms[i % 10];
    const classe = classes[i % classes.length];
    const res = await db.prepare('INSERT INTO eleves (user_id,nom,prenom,classe,niveau,genre,telephone,massar,date_inscription) VALUES (?,?,?,?,?,?,?,?,?)').run(
      userId, nom, prenom, classe, 
      classe.includes('BAC')?'lycee':classe.includes('Collège')?'college':'primaire',
      isFemale?'F':'M',
      `066${String(i).padStart(7,'0')}`,
      `G${String(140000000+i)}`,
      '2024-09-01'
    );
    eleves.push(res.lastInsertRowid);
  }

  // Notes
  const matieres = ['Mathématiques','Français','Arabe','SVT','Physique','Histoire-Géo'];
  eleves.slice(0,30).forEach(eleveId => {
    matieres.forEach(mat => {
      [1,2,3].forEach(trim => {
        const note = Math.round((Math.random()*10 + 8) * 10) / 10;
        db.prepare('INSERT INTO notes (user_id,eleve_id,matiere,note,coefficient,trimestre,annee_scolaire) VALUES (?,?,?,?,?,?,?)').run(userId,eleveId,mat,note,2,trim,'2024-2025');
      });
    });
  });

  // Paiements
  const mois = ['Septembre','Octobre','Novembre','Décembre','Janvier','Février','Mars','Avril'];
  eleves.slice(0,20).forEach(eleveId => {
    mois.forEach((m, idx) => {
      const statut = idx < 5 ? 'paye' : idx < 6 ? 'partiel' : 'impaye';
      db.prepare('INSERT INTO paiements (user_id,eleve_id,mois,annee,montant,montant_du,statut,date_paiement,mode_paiement) VALUES (?,?,?,?,?,?,?,?,?)').run(
        userId,eleveId,m,2024,
        statut==='paye'?800:statut==='partiel'?400:0,
        800,statut,
        statut!=='impaye'?`2024-${String(idx+9).padStart(2,'0')}-05`:null,
        'especes'
      );
    });
  });

  // Absences
  eleves.slice(0,15).forEach(eleveId => {
    for(let d=1;d<=5;d++){
      db.prepare('INSERT INTO absences (user_id,eleve_id,date_absence,motif,justifiee,matiere) VALUES (?,?,?,?,?,?)').run(
        userId,eleveId,`2024-10-${String(d*3).padStart(2,'0')}`,
        d%2===0?'Maladie':'Sans motif',d%2,matieres[d%6]
      );
    }
  });

  // Emploi du temps
  const jours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const horaires = [['08:00','10:00'],['10:00','12:00'],['14:00','16:00'],['16:00','18:00']];
  ['1ère BAC A','2ème BAC SPC'].forEach(cls => {
    jours.forEach(jour => {
      horaires.forEach(([deb,fin], idx) => {
        db.prepare('INSERT INTO emploi_temps (user_id,classe,jour,heure_debut,heure_fin,matiere,professeur,salle) VALUES (?,?,?,?,?,?,?,?)').run(
          userId,cls,jour,deb,fin,matieres[idx%6],'Prof '+matieres[idx%6],'Salle '+(idx+1)
        );
      });
    });
  });

  // Annonces
  [
    ['Réunion Parents','Réunion parents d\'élèves le 15 novembre à 15h00 dans la salle de conférence.','parents','haute'],
    ['Examens Trimestriels','Les examens du 1er trimestre auront lieu du 20 au 25 novembre.','tous','haute'],
    ['Journée Sportive','La journée sportive annuelle est programmée pour le 10 décembre.','eleves','normale'],
    ['Conseil Pédagogique','Le prochain conseil pédagogique se tiendra le 5 décembre.','professeurs','normale'],
  ].forEach(([titre,contenu,cible,priorite]) => {
    db.prepare('INSERT INTO annonces (user_id,titre,contenu,cible,priorite) VALUES (?,?,?,?,?)').run(userId,titre,contenu,cible,priorite);
  });

  // Dépenses
  [
    ['Fournitures de bureau',1200,'fournitures','Papeleria'],
    ['Facture électricité',3500,'charges','ONE'],
    ['Entretien bâtiment',8000,'travaux','Entreprise Alami'],
    ['Livres pédagogiques',4500,'pedagogique','Librairie Al Manahel'],
    ['Salaires octobre',85000,'salaires','Masse salariale'],
  ].forEach(([lib,mont,cat,fourn]) => {
    db.prepare('INSERT INTO depenses (user_id,libelle,montant,categorie,fournisseur) VALUES (?,?,?,?,?)').run(userId,lib,mont,cat,fourn);
  });
}

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Auth Middleware ────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ','');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token');
    res.status(401).json({ error: 'Session expirée' });
  }
}

// ── AUTH ROUTES ────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

  await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, school: user.school, plan: user.plan, is_demo: user.is_demo }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: false, maxAge: 7*24*60*60*1000, sameSite: 'lax' });
  res.json({ ok: true, token, user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role, school: user.school, plan: user.plan, is_demo: user.is_demo } });
});

app.post('/api/auth/logout', async (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await db.prepare('SELECT id,nom,prenom,email,role,school,plan,is_demo,last_login FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

app.put('/api/auth/password', auth, async (req, res) => {
  const { current, nouveau } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current, user.password)) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(nouveau, 10), req.user.id);
  res.json({ ok: true });
});

app.put('/api/auth/school', auth, async (req, res) => {
  const { school } = req.body;
  await db.prepare('UPDATE users SET school = ? WHERE id = ?').run(school, req.user.id);
  res.json({ ok: true });
});

// ── ÉLÈVES ─────────────────────────────────────────────────────
app.get('/api/eleves', auth, async (req, res) => {
  const { classe, statut, search } = req.query;
  let q = 'SELECT * FROM eleves WHERE user_id = ?';
  const params = [req.user.id];
  if (classe) { q += ' AND classe = ?'; params.push(classe); }
  if (statut) { q += ' AND statut = ?'; params.push(statut); }
  if (search) { q += ' AND (nom LIKE ? OR prenom LIKE ? OR massar LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  q += ' ORDER BY nom, prenom';
  await res.json(await db.prepare(q).all(...params));
});

app.post('/api/eleves', auth, async (req, res) => {
  const { nom, prenom, date_naissance, cin_parent, telephone, email, adresse, classe, niveau, genre, massar } = req.body;
  const r = await db.prepare('INSERT INTO eleves (user_id,nom,prenom,date_naissance,cin_parent,telephone,email,adresse,classe,niveau,genre,massar) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(req.user.id,nom,prenom,date_naissance,cin_parent,telephone,email,adresse,classe,niveau,genre||'M',massar);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/eleves/:id', auth, async (req, res) => {
  const { nom, prenom, date_naissance, cin_parent, telephone, email, adresse, classe, niveau, genre, statut, massar } = req.body;
  await db.prepare('UPDATE eleves SET nom=?,prenom=?,date_naissance=?,cin_parent=?,telephone=?,email=?,adresse=?,classe=?,niveau=?,genre=?,statut=?,massar=? WHERE id=? AND user_id=?').run(nom,prenom,date_naissance,cin_parent,telephone,email,adresse,classe,niveau,genre,statut,massar,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/eleves/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM eleves WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/eleves/:id', auth, async (req, res) => {
  const eleve = await db.prepare('SELECT * FROM eleves WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!eleve) return res.status(404).json({ error: 'Élève introuvable' });
  const notes = await db.prepare('SELECT * FROM notes WHERE eleve_id=? AND user_id=?').all(req.params.id, req.user.id);
  const absences = await db.prepare('SELECT * FROM absences WHERE eleve_id=? AND user_id=?').all(req.params.id, req.user.id);
  const paiements = await db.prepare('SELECT * FROM paiements WHERE eleve_id=? AND user_id=?').all(req.params.id, req.user.id);
  res.json({ ...eleve, notes, absences, paiements });
});

// ── CLASSES ────────────────────────────────────────────────────
app.get('/api/classes', auth, async (req, res) => {
  const classes = await db.prepare('SELECT c.*, COUNT(e.id) as nb_eleves FROM classes c LEFT JOIN eleves e ON e.classe=c.nom AND e.user_id=c.user_id WHERE c.user_id=? GROUP BY c.id ORDER BY c.niveau,c.nom').all(req.user.id);
  res.json(classes);
});

app.post('/api/classes', auth, async (req, res) => {
  const { nom, niveau, annee_scolaire, max_eleves, professeur_principal, salle } = req.body;
  const r = await db.prepare('INSERT INTO classes (user_id,nom,niveau,annee_scolaire,max_eleves,professeur_principal,salle) VALUES (?,?,?,?,?,?,?)').run(req.user.id,nom,niveau,annee_scolaire||'2024-2025',max_eleves||35,professeur_principal,salle);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/classes/:id', auth, async (req, res) => {
  const { nom, niveau, annee_scolaire, max_eleves, professeur_principal, salle } = req.body;
  await db.prepare('UPDATE classes SET nom=?,niveau=?,annee_scolaire=?,max_eleves=?,professeur_principal=?,salle=? WHERE id=? AND user_id=?').run(nom,niveau,annee_scolaire,max_eleves,professeur_principal,salle,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/classes/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM classes WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── PROFESSEURS ────────────────────────────────────────────────
app.get('/api/professeurs', auth, async (req, res) => {
  await res.json(await db.prepare('SELECT * FROM professeurs WHERE user_id=? ORDER BY nom').all(req.user.id));
});

app.post('/api/professeurs', auth, async (req, res) => {
  const { nom, prenom, email, telephone, cin, matiere, type_contrat, salaire, date_recrutement } = req.body;
  const r = await db.prepare('INSERT INTO professeurs (user_id,nom,prenom,email,telephone,cin,matiere,type_contrat,salaire,date_recrutement) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.user.id,nom,prenom,email,telephone,cin,matiere,type_contrat||'CDI',salaire||0,date_recrutement||new Date().toISOString().split('T')[0]);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/professeurs/:id', auth, async (req, res) => {
  const { nom, prenom, email, telephone, cin, matiere, type_contrat, salaire, date_recrutement, statut } = req.body;
  await db.prepare('UPDATE professeurs SET nom=?,prenom=?,email=?,telephone=?,cin=?,matiere=?,type_contrat=?,salaire=?,date_recrutement=?,statut=? WHERE id=? AND user_id=?').run(nom,prenom,email,telephone,cin,matiere,type_contrat,salaire,date_recrutement,statut||'actif',req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/professeurs/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM professeurs WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── NOTES ──────────────────────────────────────────────────────
app.get('/api/notes', auth, async (req, res) => {
  const { eleve_id, classe, matiere, trimestre } = req.query;
  let q = `SELECT n.*, e.nom, e.prenom, e.classe FROM notes n JOIN eleves e ON e.id=n.eleve_id WHERE n.user_id=?`;
  const params = [req.user.id];
  if (eleve_id) { q+=' AND n.eleve_id=?'; params.push(eleve_id); }
  if (classe) { q+=' AND e.classe=?'; params.push(classe); }
  if (matiere) { q+=' AND n.matiere=?'; params.push(matiere); }
  if (trimestre) { q+=' AND n.trimestre=?'; params.push(trimestre); }
  q += ' ORDER BY e.nom,n.matiere,n.trimestre';
  await res.json(await db.prepare(q).all(...params));
});

app.post('/api/notes', auth, async (req, res) => {
  const { eleve_id, matiere, note, coefficient, trimestre, annee_scolaire, type_eval, date_eval, observations } = req.body;
  const r = await db.prepare('INSERT INTO notes (user_id,eleve_id,matiere,note,coefficient,trimestre,annee_scolaire,type_eval,date_eval,observations) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.user.id,eleve_id,matiere,note,coefficient||1,trimestre||1,annee_scolaire||'2024-2025',type_eval||'controle',date_eval||new Date().toISOString().split('T')[0],observations);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/notes/:id', auth, async (req, res) => {
  const { note, coefficient, observations } = req.body;
  await db.prepare('UPDATE notes SET note=?,coefficient=?,observations=? WHERE id=? AND user_id=?').run(note,coefficient,observations,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/notes/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM notes WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Bulletins — moyenne par élève/trimestre
app.get('/api/bulletins/:eleve_id/:trimestre', auth, async (req, res) => {
  const { eleve_id, trimestre } = req.params;
  const eleve = await db.prepare('SELECT * FROM eleves WHERE id=? AND user_id=?').get(eleve_id, req.user.id);
  if (!eleve) return res.status(404).json({ error: 'Élève introuvable' });
  const notes = await db.prepare('SELECT * FROM notes WHERE eleve_id=? AND trimestre=? AND user_id=?').all(eleve_id, trimestre, req.user.id);
  
  // Calcul moyennes par matière
  const parMatiere = {};
  notes.forEach(n => {
    if (!parMatiere[n.matiere]) parMatiere[n.matiere] = { notes:[], coef: n.coefficient };
    parMatiere[n.matiere].notes.push(n.note);
  });
  
  const matieres = Object.entries(parMatiere).map(([mat, data]) => {
    const moy = data.notes.reduce((a,b)=>a+b,0)/data.notes.length;
    return { matiere: mat, moyenne: Math.round(moy*100)/100, coefficient: data.coef, nb_notes: data.notes.length };
  });
  
  const totalPoints = matieres.reduce((a,m)=>a+m.moyenne*m.coefficient,0);
  const totalCoef = matieres.reduce((a,m)=>a+m.coefficient,0);
  const moyenneGenerale = totalCoef > 0 ? Math.round(totalPoints/totalCoef*100)/100 : 0;
  
  const mention = moyenneGenerale >= 16 ? 'Excellent' : moyenneGenerale >= 14 ? 'Très Bien' : moyenneGenerale >= 12 ? 'Bien' : moyenneGenerale >= 10 ? 'Passable' : 'Insuffisant';
  
  res.json({ eleve, trimestre: parseInt(trimestre), matieres, moyenneGenerale, mention, annee_scolaire: '2024-2025' });
});

// ── ABSENCES ───────────────────────────────────────────────────
app.get('/api/absences', auth, async (req, res) => {
  const { eleve_id, date_debut, date_fin, classe } = req.query;
  let q = `SELECT a.*, e.nom, e.prenom, e.classe FROM absences a JOIN eleves e ON e.id=a.eleve_id WHERE a.user_id=?`;
  const params = [req.user.id];
  if (eleve_id) { q+=' AND a.eleve_id=?'; params.push(eleve_id); }
  if (date_debut) { q+=' AND a.date_absence>=?'; params.push(date_debut); }
  if (date_fin) { q+=' AND a.date_absence<=?'; params.push(date_fin); }
  if (classe) { q+=' AND e.classe=?'; params.push(classe); }
  q += ' ORDER BY a.date_absence DESC';
  await res.json(await db.prepare(q).all(...params));
});

app.post('/api/absences', auth, async (req, res) => {
  const { eleve_id, date_absence, heure_debut, heure_fin, motif, justifiee, matiere } = req.body;
  const r = await db.prepare('INSERT INTO absences (user_id,eleve_id,date_absence,heure_debut,heure_fin,motif,justifiee,matiere) VALUES (?,?,?,?,?,?,?,?)').run(req.user.id,eleve_id,date_absence,heure_debut,heure_fin,motif,justifiee?1:0,matiere);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/absences/:id', auth, async (req, res) => {
  const { justifiee, motif } = req.body;
  await db.prepare('UPDATE absences SET justifiee=?,motif=? WHERE id=? AND user_id=?').run(justifiee?1:0,motif,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/absences/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM absences WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── PAIEMENTS ──────────────────────────────────────────────────
app.get('/api/paiements', auth, async (req, res) => {
  const { statut, mois, annee } = req.query;
  let q = `SELECT p.*, e.nom, e.prenom, e.classe FROM paiements p JOIN eleves e ON e.id=p.eleve_id WHERE p.user_id=?`;
  const params = [req.user.id];
  if (statut) { q+=' AND p.statut=?'; params.push(statut); }
  if (mois) { q+=' AND p.mois=?'; params.push(mois); }
  if (annee) { q+=' AND p.annee=?'; params.push(annee); }
  q += ' ORDER BY p.annee DESC, p.created_at DESC';
  await res.json(await db.prepare(q).all(...params));
});

app.post('/api/paiements', auth, async (req, res) => {
  const { eleve_id, mois, annee, montant, montant_du, mode_paiement, reference } = req.body;
  const statut = parseFloat(montant) >= parseFloat(montant_du) ? 'paye' : parseFloat(montant) > 0 ? 'partiel' : 'impaye';
  const r = await db.prepare('INSERT INTO paiements (user_id,eleve_id,mois,annee,montant,montant_du,statut,date_paiement,mode_paiement,reference) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.user.id,eleve_id,mois,annee,montant,montant_du,statut,montant>0?new Date().toISOString().split('T')[0]:null,mode_paiement||'especes',reference);
  res.json({ id: r.lastInsertRowid, statut });
});

app.put('/api/paiements/:id', auth, async (req, res) => {
  const { montant, mode_paiement, reference } = req.body;
  const paiement = await db.prepare('SELECT * FROM paiements WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!paiement) return res.status(404).json({ error: 'Introuvable' });
  const statut = parseFloat(montant) >= parseFloat(paiement.montant_du) ? 'paye' : parseFloat(montant) > 0 ? 'partiel' : 'impaye';
  await db.prepare('UPDATE paiements SET montant=?,statut=?,date_paiement=?,mode_paiement=?,reference=? WHERE id=? AND user_id=?').run(montant,statut,montant>0?new Date().toISOString().split('T')[0]:null,mode_paiement,reference,req.params.id,req.user.id);
  res.json({ ok: true, statut });
});

// ── EMPLOI DU TEMPS ────────────────────────────────────────────
app.get('/api/emploi-temps', auth, async (req, res) => {
  const { classe } = req.query;
  let q = 'SELECT * FROM emploi_temps WHERE user_id=?';
  const params = [req.user.id];
  if (classe) { q+=' AND classe=?'; params.push(classe); }
  q += ' ORDER BY CASE jour WHEN "Lundi" THEN 1 WHEN "Mardi" THEN 2 WHEN "Mercredi" THEN 3 WHEN "Jeudi" THEN 4 WHEN "Vendredi" THEN 5 WHEN "Samedi" THEN 6 END, heure_debut';
  await res.json(await db.prepare(q).all(...params));
});

app.post('/api/emploi-temps', auth, async (req, res) => {
  const { classe, jour, heure_debut, heure_fin, matiere, professeur, salle } = req.body;
  const r = await db.prepare('INSERT INTO emploi_temps (user_id,classe,jour,heure_debut,heure_fin,matiere,professeur,salle) VALUES (?,?,?,?,?,?,?,?)').run(req.user.id,classe,jour,heure_debut,heure_fin,matiere,professeur,salle);
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/emploi-temps/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM emploi_temps WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── ANNONCES ───────────────────────────────────────────────────
app.get('/api/annonces', auth, async (req, res) => {
  await res.json(await db.prepare('SELECT * FROM annonces WHERE user_id=? ORDER BY created_at DESC').all(req.user.id));
});

app.post('/api/annonces', auth, async (req, res) => {
  const { titre, contenu, cible, priorite } = req.body;
  const r = await db.prepare('INSERT INTO annonces (user_id,titre,contenu,cible,priorite) VALUES (?,?,?,?,?)').run(req.user.id,titre,contenu,cible||'tous',priorite||'normale');
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/annonces/:id', auth, async (req, res) => {
  const { titre, contenu, cible, priorite, active } = req.body;
  await db.prepare('UPDATE annonces SET titre=?,contenu=?,cible=?,priorite=?,active=? WHERE id=? AND user_id=?').run(titre,contenu,cible,priorite,active?1:0,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/annonces/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM annonces WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── DEPENSES ───────────────────────────────────────────────────
app.get('/api/depenses', auth, async (req, res) => {
  const { categorie, date_debut, date_fin } = req.query;
  let q = 'SELECT * FROM depenses WHERE user_id=?';
  const params = [req.user.id];
  if (categorie) { q+=' AND categorie=?'; params.push(categorie); }
  if (date_debut) { q+=' AND date_depense>=?'; params.push(date_debut); }
  if (date_fin) { q+=' AND date_depense<=?'; params.push(date_fin); }
  q += ' ORDER BY date_depense DESC';
  await res.json(await db.prepare(q).all(...params));
});

app.post('/api/depenses', auth, async (req, res) => {
  const { libelle, montant, categorie, date_depense, fournisseur, notes } = req.body;
  const r = await db.prepare('INSERT INTO depenses (user_id,libelle,montant,categorie,date_depense,fournisseur,notes) VALUES (?,?,?,?,?,?,?)').run(req.user.id,libelle,montant,categorie||'autre',date_depense||new Date().toISOString().split('T')[0],fournisseur,notes);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/depenses/:id', auth, async (req, res) => {
  const { libelle, montant, categorie, date_depense, fournisseur, notes } = req.body;
  await db.prepare('UPDATE depenses SET libelle=?,montant=?,categorie=?,date_depense=?,fournisseur=?,notes=? WHERE id=? AND user_id=?').run(libelle,montant,categorie,date_depense,fournisseur,notes,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/depenses/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM depenses WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── DIAGNOSTIC ───────────────────────────────────────────────
app.get('/api/debug', auth, async (req, res) => {
  const results = {};
  try {
    results.user_id = req.user.id;
    results.pg_test = (await pgPool.query('SELECT 1 as ok')).rows[0];
    results.tables = (await pgPool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
    results.eleves_count = (await pgPool.query('SELECT COUNT(*) n FROM eleves WHERE user_id=$1', [req.user.id])).rows[0];
    results.status = 'OK';
  } catch(e) {
    results.error = e.message;
  }
  res.json(results);
});

// ── STATISTIQUES DASHBOARD ─────────────────────────────────────
app.get('/api/stats', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const run = async (sql, p) => {
      try { return (await pgPool.query(sql, p)).rows[0] || {}; }
      catch(e) { console.error('stat:', e.message.substring(0,60)); return {}; }
    };
    const all = async (sql, p) => {
      try { return (await pgPool.query(sql, p)).rows; }
      catch(e) { return []; }
    };
    const N = (r, k='n') => parseInt(r[k]) || 0;
    const F = (r, k='n') => parseFloat(r[k]) || 0;

    const [e,c,p,rec,dep,imp,impT,abs,pn,pc] = await Promise.all([
      run('SELECT COUNT(*) n FROM eleves WHERE user_id=$1',[uid]),
      run('SELECT COUNT(*) n FROM classes WHERE user_id=$1',[uid]),
      run('SELECT COUNT(*) n FROM professeurs WHERE user_id=$1',[uid]),
      run('SELECT COALESCE(SUM(montant),0) n FROM paiements WHERE user_id=$1',[uid]),
      run('SELECT COALESCE(SUM(montant),0) n FROM depenses WHERE user_id=$1',[uid]),
      run('SELECT COUNT(*) n FROM paiements WHERE user_id=$1',[uid]),
      run('SELECT COALESCE(SUM(montant),0) n FROM paiements WHERE user_id=$1',[uid]),
      run('SELECT COUNT(*) n FROM absences WHERE user_id=$1',[uid]),
      all('SELECT COALESCE(niveau,$2) niveau, COUNT(*) nb FROM eleves WHERE user_id=$1 GROUP BY niveau',[uid,'autre']),
      all('SELECT COALESCE(classe,$2) classe, COUNT(*) nb FROM eleves WHERE user_id=$1 GROUP BY classe ORDER BY nb DESC LIMIT 10',[uid,'—']),
    ]);

    res.json({
      totalEleves:N(e), totalClasses:N(c), totalProfs:N(p),
      recettes:F(rec), depenses:F(dep),
      benefice:F(rec)-F(dep),
      impayesCount:N(imp), impayesTotal:F(impT),
      absAujourd:N(abs), totalAbsences:N(abs),
      parNiveau:pn, parClasse:pc
    });
  } catch(e) {
    console.error('stats fatal:', e.message);
    res.json({ totalEleves:0, totalClasses:0, totalProfs:0, recettes:0, depenses:0, benefice:0, impayesCount:0, impayesTotal:0, absAujourd:0, totalAbsences:0, parNiveau:[], parClasse:[] });
  }
});

// ── TÉLÉCHARGEMENT FICHIERS ──────────────────────────────────
app.get('/api/devoirs/:id/fichier', auth, async (req, res) => {
  const d = await db.prepare('SELECT fichier_nom,fichier_data,fichier_type FROM devoirs WHERE id=? AND owner_id=?').get(req.params.id, req.user.id);
  if (!d || !d.fichier_data) return res.status(404).json({ error: 'Aucun fichier' });
  const buf = Buffer.from(d.fichier_data, 'base64');
  res.set('Content-Type', d.fichier_type || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(d.fichier_nom)}"`);
  res.send(buf);
});

app.get('/api/rendus/:id/fichier', auth, async (req, res) => {
  const r = await db.prepare('SELECT fichier_nom,fichier_data,fichier_type FROM rendus_devoirs WHERE id=?').get(req.params.id);
  if (!r || !r.fichier_data) return res.status(404).json({ error: 'Aucun fichier' });
  const buf = Buffer.from(r.fichier_data, 'base64');
  res.set('Content-Type', r.fichier_type || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(r.fichier_nom)}"`);
  res.send(buf);
});

// ── CATCHALL → SPA ─────────────────────────────────────────────

// ── SUPER ADMIN ROUTES ────────────────────────────────────────
function isSuperAdmin(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Accès refusé' });
  next();
}

app.get('/api/superadmin/clients', auth, isSuperAdmin, async (req, res) => {
  const clients = await db.prepare('SELECT id, nom, prenom, email, school, plan, plan_expires, created_at, last_login, is_demo FROM users WHERE role != ? ORDER BY created_at DESC').all('superadmin');
  res.json(clients);
});

app.post('/api/superadmin/clients', auth, isSuperAdmin, async (req, res) => {
  const { school, email, password, plan } = req.body;
  if (!school || !email || !password) return res.status(400).json({ error: 'Champs requis manquants' });
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email déjà utilisé' });
  const hash = bcrypt.hashSync(password, 10);
  const expires = calcExpires(plan);
  await db.prepare('INSERT INTO users (nom, prenom, email, password, role, school, plan, plan_expires) VALUES (?,?,?,?,?,?,?,?)').run('Admin', school, email, hash, 'admin', school, 'pro', expires);
  res.json({ ok: true });
});

app.post('/api/superadmin/activate', auth, isSuperAdmin, async (req, res) => {
  const { user_id, duree } = req.body;
  const expires = calcExpires(duree);
  await db.prepare('UPDATE users SET plan_expires = ? WHERE id = ?').run(expires, user_id);
  res.json({ ok: true, expires });
});

app.delete('/api/superadmin/clients/:id', auth, isSuperAdmin, async (req, res) => {
  const id = req.params.id;
  await db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(id, 'superadmin');
  res.json({ ok: true });
});

app.put('/api/superadmin/clients/:id/password', auth, isSuperAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare('UPDATE users SET password = ? WHERE id = ? AND role != ?').run(hash, req.params.id, 'superadmin');
  res.json({ ok: true });
});

function calcExpires(duree) {
  if (duree === 'vie') return '9999-12-31';
  const now = new Date();
  if (duree === 'test') now.setHours(now.getHours() + 24);
  else if (duree === '30j') now.setDate(now.getDate() + 30);
  else if (duree === '1an') now.setFullYear(now.getFullYear() + 1);
  return now.toISOString().split('T')[0];
}



// ── LIMITES PAR RÔLE ──────────────────────────────────────────
const ROLE_LIMITS = {
  admin_ecole: 10,    // max 10 admins par école
  professeur: Infinity, // illimité
  parent: Infinity,     // illimité
};

// ── SCHOOL USERS ROUTES ───────────────────────────────────────
// GET — liste des utilisateurs de l'école
app.get('/api/school-users', auth, async (req, res) => {
  const users = await db.prepare(`
    SELECT id, nom, prenom, email, role, telephone, actif, created_at, last_login
    FROM school_users WHERE owner_id = ? ORDER BY role, nom
  `).all(req.user.id);
  
  // Compter par rôle
  const counts = { admin_ecole: 0, professeur: 0, parent: 0 };
  users.forEach(u => { if(counts[u.role] !== undefined) counts[u.role]++; });
  
  res.json({ users, counts, limits: { admin_ecole: 10, professeur: null, parent: null } });
});

// POST — créer un utilisateur
app.post('/api/school-users', auth, async (req, res) => {
  const { nom, prenom, email, password, role, telephone } = req.body;
  if (!nom || !prenom || !email || !password || !role)
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  if (!['admin_ecole','professeur','parent','eleve'].includes(role))
    return res.status(400).json({ error: 'Rôle invalide' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (6 min)' });

  // Vérifier limite admins (eleve/prof/parent = illimités)
  if (role === 'admin_ecole') {
    const count = await db.prepare('SELECT COUNT(*) as n FROM school_users WHERE owner_id=? AND role=? AND actif=1').get(req.user.id, 'admin_ecole');
    if (count.n >= 10)
      return res.status(400).json({ error: 'Limite atteinte : 10 administrateurs maximum par école' });
  }

  // Vérifier email unique
  const existing = await db.prepare('SELECT id FROM school_users WHERE email=?').get(email);
  if (existing) return res.status(400).json({ error: 'Cet email est déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  const { eleve_id } = req.body;
  const r = await db.prepare(`
    INSERT INTO school_users (owner_id, nom, prenom, email, password, role, telephone, eleve_id)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(req.user.id, nom, prenom, email, hash, role, telephone||'', eleve_id||null);
  res.json({ ok: true, id: r.lastInsertRowid });
});

// PUT — modifier un utilisateur
app.put('/api/school-users/:id', auth, async (req, res) => {
  const { nom, prenom, email, telephone, actif } = req.body;
  const su = await db.prepare('SELECT * FROM school_users WHERE id=? AND owner_id=?').get(req.params.id, req.user.id);
  if (!su) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  await db.prepare(`
    UPDATE school_users SET nom=?, prenom=?, email=?, telephone=?, actif=? WHERE id=? AND owner_id=?
  `).run(nom||su.nom, prenom||su.prenom, email||su.email, telephone||su.telephone, actif!==undefined?actif:su.actif, req.params.id, req.user.id);
  res.json({ ok: true });
});

// PUT — reset mot de passe
app.put('/api/school-users/:id/password', auth, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court' });
  const su = await db.prepare('SELECT id FROM school_users WHERE id=? AND owner_id=?').get(req.params.id, req.user.id);
  if (!su) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare('UPDATE school_users SET password=? WHERE id=? AND owner_id=?').run(hash, req.params.id, req.user.id);
  res.json({ ok: true });
});

// DELETE — supprimer un utilisateur
app.delete('/api/school-users/:id', auth, async (req, res) => {
  const su = await db.prepare('SELECT id FROM school_users WHERE id=? AND owner_id=?').get(req.params.id, req.user.id);
  if (!su) return res.status(404).json({ error: 'Non trouvé' });
  await db.prepare('DELETE FROM school_users WHERE id=? AND owner_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});


// ── DEVOIRS (admin/prof crée) ─────────────────────────────────
app.get('/api/devoirs', auth, async (req, res) => {
  const { classe } = req.query;
  let q = 'SELECT * FROM devoirs WHERE owner_id=?';
  const params = [req.user.id];
  if (classe) { q+=' AND classe=?'; params.push(classe); }
  q += ' ORDER BY date_limite ASC';
  await res.json(await db.prepare(q).all(...params));
});

app.post('/api/devoirs', auth, upload.single('fichier'), async (req, res) => {
  const { titre, description, matiere, classe, date_limite, type } = req.body;
  if (!titre||!matiere) return res.status(400).json({ error: 'Titre et matière requis' });
  const fichierNom  = req.file ? req.file.originalname : null;
  const fichierData = req.file ? req.file.buffer.toString('base64') : null;
  const fichierType = req.file ? req.file.mimetype : null;
  const r = await db.prepare(`INSERT INTO devoirs (owner_id,titre,description,matiere,classe,date_limite,type,fichier_nom,fichier_data,fichier_type) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, titre, description||'', matiere, classe||'', date_limite||'', type||'devoir', fichierNom, fichierData, fichierType);
  res.json({ ok:true, id:r.lastInsertRowid });
});

app.put('/api/devoirs/:id', auth, async (req, res) => {
  const { titre, description, matiere, classe, date_limite, type } = req.body;
  db.prepare(`UPDATE devoirs SET titre=?,description=?,matiere=?,classe=?,date_limite=?,type=? WHERE id=? AND owner_id=?`)
    .run(titre,description,matiere,classe,date_limite,type,req.params.id,req.user.id);
  res.json({ ok:true });
});

app.delete('/api/devoirs/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM devoirs WHERE id=? AND owner_id=?').run(req.params.id,req.user.id);
  res.json({ ok:true });
});

// ── RENDUS (élève soumet) ─────────────────────────────────────
// Admin/prof voit tous les rendus d'un devoir
app.get('/api/devoirs/:id/rendus', auth, async (req, res) => {
  const rendus = await db.prepare(`
    SELECT r.*, su.nom, su.prenom, su.email
    FROM rendus_devoirs r
    JOIN school_users su ON su.id = r.eleve_user_id
    WHERE r.devoir_id=?
    ORDER BY r.rendu_at DESC
  `).all(req.params.id);
  res.json(rendus);
});

// Élève soumet son rendu
app.post('/api/devoirs/:id/rendus', auth, async (req, res) => {
  const { contenu, fichier_nom, fichier_data } = req.body;
  // eleve_user_id = id dans school_users (le compte élève)
  const { eleve_user_id } = req.body;
  if (!eleve_user_id) return res.status(400).json({ error: 'eleve_user_id requis' });
  // Vérifier pas déjà rendu
  const existing = await db.prepare('SELECT id FROM rendus_devoirs WHERE devoir_id=? AND eleve_user_id=?').get(req.params.id, eleve_user_id);
  if (existing) {
    db.prepare('UPDATE rendus_devoirs SET contenu=?,fichier_nom=?,fichier_data=?,rendu_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(contenu||'',fichier_nom||'',fichier_data||'',existing.id);
    return res.json({ ok:true, updated:true });
  }
  db.prepare('INSERT INTO rendus_devoirs (devoir_id,eleve_user_id,contenu,fichier_nom,fichier_data) VALUES (?,?,?,?,?)')
    .run(req.params.id,eleve_user_id,contenu||'',fichier_nom||'',fichier_data||'');
  res.json({ ok:true });
});

// Prof corrige / note un rendu
app.put('/api/rendus/:id', auth, async (req, res) => {
  const { note, commentaire_prof, statut } = req.body;
  db.prepare('UPDATE rendus_devoirs SET note=?,commentaire_prof=?,statut=? WHERE id=?')
    .run(note,commentaire_prof||'',statut||'corrige',req.params.id);
  res.json({ ok:true });
});

// ── ESPACE ÉLÈVE — ses données ────────────────────────────────
// Élève voit ses notes (par eleve_id lié)
app.get('/api/eleve-space/notes', auth, async (req, res) => {
  const su = await db.prepare('SELECT eleve_id FROM school_users WHERE id=? AND role=?').get(req.user.id||req.body?.su_id, 'eleve');
  // Pour l'instant on filtre par email dans eleves
  const eleve = await db.prepare('SELECT * FROM eleves WHERE email=?').get(req.user.email||'');
  if (!eleve) return res.json([]);
  const notes = await db.prepare(`SELECT n.*,e.nom,e.prenom FROM notes n JOIN eleves e ON e.id=n.eleve_id WHERE n.eleve_id=? AND n.user_id=? ORDER BY n.trimestre,n.matiere`).all(eleve.id, eleve.user_id||0);
  res.json(notes);
});

app.get('/api/eleve-space/emploi', auth, async (req, res) => {
  const eleve = await db.prepare('SELECT * FROM eleves WHERE email=?').get(req.user.email||'');
  if (!eleve||!eleve.classe) return res.json([]);
  await res.json(await db.prepare('SELECT * FROM emploi_temps WHERE user_id=? AND classe=? ORDER BY jour,heure_debut').all(eleve.user_id||0, eleve.classe));
});

app.get('/api/eleve-space/devoirs', auth, async (req, res) => {
  const eleve = await db.prepare('SELECT * FROM eleves WHERE email=?').get(req.user.email||'');
  if (!eleve) return res.json([]);
  const devoirs = await db.prepare("SELECT * FROM devoirs WHERE (classe=? OR classe='' OR classe IS NULL) ORDER BY date_limite ASC").all(eleve.classe||"");
  // Enrichir avec statut rendu
  const suId = await db.prepare('SELECT id FROM school_users WHERE email=?').get(req.user.email||'');
  const enriched = [];
  for (const d of devoirs) {
    const rendu = suId ? await db.prepare('SELECT * FROM rendus_devoirs WHERE devoir_id=? AND eleve_user_id=?').get(d.id, suId.id) : null;
    enriched.push({ ...d, rendu });
  }
  res.json(enriched);
});

app.get('/api/eleve-space/absences', auth, async (req, res) => {
  const eleve = await db.prepare('SELECT * FROM eleves WHERE email=?').get(req.user.email||'');
  if (!eleve) return res.json([]);
  await res.json(await db.prepare('SELECT * FROM absences WHERE eleve_id=? ORDER BY date_absence DESC').all(eleve.id));
});


// ════════════════════════════════════════════════════════════════
// MESSAGERIE INTERNE
// ════════════════════════════════════════════════════════════════
app.get('/api/messages', auth, async (req, res) => {
  const { boite } = req.query;
  let msgs;
  if (boite === 'envoyes') {
    msgs = await db.prepare("SELECT * FROM messages WHERE owner_id=? AND from_id=? AND from_type=''admin'' ORDER BY created_at DESC").all(req.user.id, req.user.id);
  } else {
    msgs = await db.prepare('SELECT * FROM messages WHERE owner_id=? AND (to_id=? OR to_id IS NULL) ORDER BY lu ASC, created_at DESC').all(req.user.id, req.user.id);
  }
  res.json(msgs);
});

app.get('/api/messages/non-lus', auth, async (req, res) => {
  const count = await db.prepare('SELECT COUNT(*) as n FROM messages WHERE owner_id=? AND lu=0 AND (to_id=? OR to_id IS NULL)').get(req.user.id, req.user.id);
  res.json({ count: count.n });
});

app.post('/api/messages', auth, async (req, res) => {
  const { to_id, to_type, sujet, contenu, parent_id } = req.body;
  if (!sujet || !contenu) return res.status(400).json({ error: 'Sujet et contenu requis' });
  db.prepare('INSERT INTO messages (owner_id,from_id,from_type,to_id,to_type,sujet,contenu,parent_id) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.user.id, req.user.id, req.user.role||'admin', to_id||null, to_type||'tous', sujet, contenu, parent_id||null);
  res.json({ ok: true });
});

app.put('/api/messages/:id/lu', auth, async (req, res) => {
  await db.prepare('UPDATE messages SET lu=1 WHERE id=? AND owner_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/messages/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM messages WHERE id=? AND owner_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// CALENDRIER SCOLAIRE
// ════════════════════════════════════════════════════════════════
app.get('/api/calendrier', auth, async (req, res) => {
  const { mois, annee } = req.query;
  let q = 'SELECT * FROM calendrier WHERE owner_id=?';
  const params = [req.user.id];
  if (mois && annee) {
    q += ` AND (TO_CHAR(date_debut::date, 'YYYY-MM')=? OR TO_CHAR(date_fin::date, 'YYYY-MM')=?)`;
    const ym = `${annee}-${String(mois).padStart(2,'0')}`;
    params.push(ym, ym);
  }
  q += ' ORDER BY date_debut ASC';
  await res.json(await db.prepare(q).all(...params));
});

app.post('/api/calendrier', auth, async (req, res) => {
  const { titre, description, type, date_debut, date_fin, heure_debut, heure_fin, couleur, classes } = req.body;
  if (!titre || !date_debut) return res.status(400).json({ error: 'Titre et date requis' });
  const r = db.prepare('INSERT INTO calendrier (owner_id,titre,description,type,date_debut,date_fin,heure_debut,heure_fin,couleur,classes) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(req.user.id, titre, description||'', type||'evenement', date_debut, date_fin||date_debut, heure_debut||'', heure_fin||'', couleur||'#6366f1', classes||'');
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put('/api/calendrier/:id', auth, async (req, res) => {
  const { titre, description, type, date_debut, date_fin, heure_debut, heure_fin, couleur, classes } = req.body;
  db.prepare('UPDATE calendrier SET titre=?,description=?,type=?,date_debut=?,date_fin=?,heure_debut=?,heure_fin=?,couleur=?,classes=? WHERE id=? AND owner_id=?')
    .run(titre, description||'', type, date_debut, date_fin||date_debut, heure_debut||'', heure_fin||'', couleur||'#6366f1', classes||'', req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/calendrier/:id', auth, async (req, res) => {
  await db.prepare('DELETE FROM calendrier WHERE id=? AND owner_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// CERTIFICATS & DOCUMENTS
// ════════════════════════════════════════════════════════════════
app.get('/api/certificats/eleve/:id', auth, async (req, res) => {
  const eleve = await db.prepare('SELECT e.*, u.school FROM eleves e JOIN users u ON u.id=e.user_id WHERE e.id=? AND e.user_id=?').get(req.params.id, req.user.id);
  if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' });
  const user  = await db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  const notes = await db.prepare('SELECT * FROM notes WHERE eleve_id=? AND user_id=? ORDER BY trimestre,matiere').all(eleve.id, req.user.id);
  const paiements = await db.prepare('SELECT * FROM paiements WHERE eleve_id=? ORDER BY created_at DESC').all(eleve.id);
  const absences  = await db.prepare('SELECT COUNT(*) as n FROM absences WHERE eleve_id=?').get(eleve.id);
  res.json({ eleve, school: user, notes, paiements, absences: absences.n });
});

// ════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════
app.get('/api/notifications', auth, async (req, res) => {
  const notifs = await db.prepare('SELECT * FROM notifications WHERE owner_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json(notifs);
});

app.post('/api/notifications/envoyer', auth, async (req, res) => {
  const { destinataire, canal, objet, message, statut } = req.body;
  if (!destinataire || !canal || !objet || !message) return res.status(400).json({ error: 'Champs requis manquants' });
  db.prepare('INSERT INTO notifications (owner_id,destinataire,canal,objet,message,statut,envoye_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)')
    .run(req.user.id, destinataire, canal, objet, message, statut||'envoye');
  res.json({ ok: true });
});

app.post('/api/notifications/bulk', auth, async (req, res) => {
  const { cible, canal, objet, message } = req.body;
  if (!cible || !canal || !objet || !message) return res.status(400).json({ error: 'Champs requis' });
  // Récupérer les destinataires selon la cible
  let eleves = [];
  if (cible === 'tous' || cible === 'parents') {
    eleves = await db.prepare('SELECT nom,prenom,telephone,email FROM eleves WHERE user_id=?').all(req.user.id);
  }
  const count = eleves.length || 1;
  db.prepare('INSERT INTO notifications (owner_id,destinataire,canal,objet,message,statut,envoye_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)')
    .run(req.user.id, `${cible} (${count} destinataires)`, canal, objet, message, 'envoye');
  res.json({ ok: true, count });
});

// ── DEMANDES TEST ─────────────────────────────────────────────
// Public — pas besoin d'auth
app.post('/api/demandes-test', async (req, res) => {
  const { ecole, nom, prenom, telephone, email, ville, nb_eleves, message } = req.body;
  if (!ecole || !nom || !prenom || !telephone || !email)
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  try {
    await db.prepare(`INSERT INTO demandes_test (ecole,nom,prenom,telephone,email,ville,nb_eleves,message)
      VALUES (?,?,?,?,?,?,?,?)`).run(ecole, nom, prenom, telephone, email, ville||'', nb_eleves||'', message||'');
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Super admin — liste des demandes
app.get('/api/superadmin/demandes', auth, isSuperAdmin, async (req, res) => {
  const demandes = await db.prepare('SELECT * FROM demandes_test ORDER BY created_at DESC').all();
  res.json(demandes);
});

// Super admin — changer statut
app.put('/api/superadmin/demandes/:id', auth, isSuperAdmin, async (req, res) => {
  const { statut } = req.body;
  await db.prepare('UPDATE demandes_test SET statut=? WHERE id=?').run(statut, req.params.id);
  res.json({ ok: true });
});

// Super admin — supprimer demande
app.delete('/api/superadmin/demandes/:id', auth, isSuperAdmin, async (req, res) => {
  await db.prepare('DELETE FROM demandes_test WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index-landing.html'));
});
app.get('/app', async (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.get('*', async (req, res) => {
  // For API 404s return JSON, for others serve app
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route non trouvée' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

function startServer() {
  app.listen(PORT, () => {
    console.log(`✅ MadrasaTech démarré sur http://localhost:${PORT}`);
    console.log(`   Admin: admin@madrasatech.ma / admin2024`);
    console.log(`   Demo:  demo@madrasatech.ma  / demo2024`);
  });
}
