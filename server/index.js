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
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'madrasatech-secret-2024-xK9mP2qR';

// ── Database ──────────────────────────────────────────────────
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'madrasatech.db');
let db;

// Couche d'abstraction synchrone compatible better-sqlite3 et sql.js
function createSqlJsAdapter(sqlJsDb, filePath) {
  function saveDB() {
    const data = sqlJsDb.export();
    fs.writeFileSync(filePath, Buffer.from(data));
  }

  return {
    _sqljsdb: sqlJsDb,
    pragma: () => {},
    exec: (sql) => {
      sqlJsDb.run(sql);
      saveDB();
    },
    prepare: (sql) => {
      return {
        run: (...args) => {
          const stmt = sqlJsDb.prepare(sql);
          const params = args.flat();
          stmt.run(params);
          stmt.free();
          saveDB();
          const lastId = sqlJsDb.exec('SELECT last_insert_rowid()')[0];
          return { lastInsertRowid: lastId ? lastId.values[0][0] : null, changes: 1 };
        },
        get: (...args) => {
          const stmt = sqlJsDb.prepare(sql);
          const params = args.flat();
          stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            stmt.free();
            const obj = {};
            cols.forEach((c, i) => obj[c] = vals[i]);
            return obj;
          }
          stmt.free();
          return undefined;
        },
        all: (...args) => {
          const results = sqlJsDb.exec(sql, args.flat());
          if (!results.length) return [];
          const { columns, values } = results[0];
          return values.map(row => {
            const obj = {};
            columns.forEach((c, i) => obj[c] = row[i]);
            return obj;
          });
        }
      };
    }
  };
}

// sql.js uniquement (pur JS, pas de compilation native)
const initSqlJs = require('sql.js');
let dbReady = false;

initSqlJs().then(SQL => {
  let sqlJsDb;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlJsDb = new SQL.Database(fileBuffer);
  } else {
    sqlJsDb = new SQL.Database();
  }
  db = createSqlJsAdapter(sqlJsDb, dbPath);
  console.log('✅ sql.js chargé');
  initDB();
  startServer();
}).catch(err => {
  console.error('Erreur sql.js:', err);
  process.exit(1);
});

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      school TEXT DEFAULT 'Mon École',
      plan TEXT DEFAULT 'pro',
      plan_expires TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_demo INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS eleves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      date_naissance TEXT,
      cin_parent TEXT,
      telephone TEXT,
      email TEXT,
      adresse TEXT,
      classe TEXT,
      niveau TEXT,
      genre TEXT DEFAULT 'M',
      photo TEXT,
      massar TEXT,
      date_inscription TEXT DEFAULT CURRENT_DATE,
      statut TEXT DEFAULT 'actif',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nom TEXT NOT NULL,
      niveau TEXT,
      annee_scolaire TEXT,
      max_eleves INTEGER DEFAULT 35,
      professeur_principal TEXT,
      salle TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS professeurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT,
      telephone TEXT,
      cin TEXT,
      matiere TEXT,
      type_contrat TEXT DEFAULT 'CDI',
      salaire REAL DEFAULT 0,
      date_recrutement TEXT DEFAULT CURRENT_DATE,
      statut TEXT DEFAULT 'actif',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      eleve_id INTEGER NOT NULL,
      matiere TEXT NOT NULL,
      note REAL NOT NULL,
      coefficient REAL DEFAULT 1,
      trimestre INTEGER DEFAULT 1,
      annee_scolaire TEXT,
      type_eval TEXT DEFAULT 'controle',
      date_eval TEXT DEFAULT CURRENT_DATE,
      observations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(eleve_id) REFERENCES eleves(id)
    );

    CREATE TABLE IF NOT EXISTS absences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      eleve_id INTEGER NOT NULL,
      date_absence TEXT NOT NULL,
      heure_debut TEXT,
      heure_fin TEXT,
      motif TEXT,
      justifiee INTEGER DEFAULT 0,
      matiere TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(eleve_id) REFERENCES eleves(id)
    );

    CREATE TABLE IF NOT EXISTS paiements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      eleve_id INTEGER NOT NULL,
      mois TEXT NOT NULL,
      annee INTEGER NOT NULL,
      montant REAL NOT NULL,
      montant_du REAL NOT NULL,
      statut TEXT DEFAULT 'impaye',
      date_paiement TEXT,
      mode_paiement TEXT DEFAULT 'especes',
      reference TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(eleve_id) REFERENCES eleves(id)
    );

    CREATE TABLE IF NOT EXISTS emploi_temps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      classe TEXT NOT NULL,
      jour TEXT NOT NULL,
      heure_debut TEXT NOT NULL,
      heure_fin TEXT NOT NULL,
      matiere TEXT NOT NULL,
      professeur TEXT,
      salle TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS annonces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      titre TEXT NOT NULL,
      contenu TEXT NOT NULL,
      cible TEXT DEFAULT 'tous',
      priorite TEXT DEFAULT 'normale',
      date_publication TEXT DEFAULT CURRENT_DATE,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS depenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      libelle TEXT NOT NULL,
      montant REAL NOT NULL,
      categorie TEXT DEFAULT 'autre',
      date_depense TEXT DEFAULT CURRENT_DATE,
      fournisseur TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions_demo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed admin par défaut
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@madrasatech.ma');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin2024', 10);
    db.prepare(`INSERT INTO users (nom,prenom,email,password,role,school,plan,is_demo)
      VALUES (?,?,?,?,?,?,?,?)`).run('Admin','MadrasaTech','admin@madrasatech.ma',hash,'superadmin','MadrasaTech Demo','pro',0);
    
    // Seed demo user
    const demoHash = bcrypt.hashSync('demo2024', 10);
    const demoId = db.prepare(`INSERT INTO users (nom,prenom,email,password,role,school,plan,is_demo)
      VALUES (?,?,?,?,?,?,?,?)`).run('Demo','Utilisateur','demo@madrasatech.ma',demoHash,'admin','Lycée Ibn Khaldoun','demo',1).lastInsertRowid;
    
    seedDemoData(demoId);
  }
}

function seedDemoData(userId) {
  // Classes
  const classes = ['1ère BAC A','1ère BAC B','2ème BAC SPC','2ème BAC SVT','3ème Collège','4ème Collège','5ème Primaire','6ème Primaire'];
  classes.forEach(c => {
    const niveau = c.includes('BAC') ? 'lycee' : c.includes('Collège') ? 'college' : 'primaire';
    db.prepare('INSERT OR IGNORE INTO classes (user_id,nom,niveau,annee_scolaire,max_eleves) VALUES (?,?,?,?,?)').run(userId,c,niveau,'2024-2025',35);
  });

  // Professeurs
  const profs = [
    ['Alami','Mohamed','m.alami@ecole.ma','0661234567','Mathématiques'],
    ['Benali','Fatima','f.benali@ecole.ma','0662345678','Français'],
    ['Chakir','Youssef','y.chakir@ecole.ma','0663456789','Arabe'],
    ['Dahbi','Samira','s.dahbi@ecole.ma','0664567890','SVT'],
    ['Ezzaki','Omar','o.ezzaki@ecole.ma','0665678901','Physique'],
    ['Filali','Nadia','n.filali@ecole.ma','0666789012','Histoire-Géo'],
  ];
  profs.forEach(([nom,prenom,email,tel,mat]) => {
    db.prepare('INSERT OR IGNORE INTO professeurs (user_id,nom,prenom,email,telephone,matiere,salaire) VALUES (?,?,?,?,?,?,?)').run(userId,nom,prenom,email,tel,mat,6500);
  });

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
    const res = db.prepare('INSERT INTO eleves (user_id,nom,prenom,classe,niveau,genre,telephone,massar,date_inscription) VALUES (?,?,?,?,?,?,?,?,?)').run(
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
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, school: user.school, plan: user.plan, is_demo: user.is_demo }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: false, maxAge: 7*24*60*60*1000, sameSite: 'lax' });
  res.json({ ok: true, token, user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role, school: user.school, plan: user.plan, is_demo: user.is_demo } });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT id,nom,prenom,email,role,school,plan,is_demo,last_login FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

app.put('/api/auth/password', auth, (req, res) => {
  const { current, nouveau } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current, user.password)) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(nouveau, 10), req.user.id);
  res.json({ ok: true });
});

app.put('/api/auth/school', auth, (req, res) => {
  const { school } = req.body;
  db.prepare('UPDATE users SET school = ? WHERE id = ?').run(school, req.user.id);
  res.json({ ok: true });
});

// ── ÉLÈVES ─────────────────────────────────────────────────────
app.get('/api/eleves', auth, (req, res) => {
  const { classe, statut, search } = req.query;
  let q = 'SELECT * FROM eleves WHERE user_id = ?';
  const params = [req.user.id];
  if (classe) { q += ' AND classe = ?'; params.push(classe); }
  if (statut) { q += ' AND statut = ?'; params.push(statut); }
  if (search) { q += ' AND (nom LIKE ? OR prenom LIKE ? OR massar LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  q += ' ORDER BY nom, prenom';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/eleves', auth, (req, res) => {
  const { nom, prenom, date_naissance, cin_parent, telephone, email, adresse, classe, niveau, genre, massar } = req.body;
  const r = db.prepare('INSERT INTO eleves (user_id,nom,prenom,date_naissance,cin_parent,telephone,email,adresse,classe,niveau,genre,massar) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(req.user.id,nom,prenom,date_naissance,cin_parent,telephone,email,adresse,classe,niveau,genre||'M',massar);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/eleves/:id', auth, (req, res) => {
  const { nom, prenom, date_naissance, cin_parent, telephone, email, adresse, classe, niveau, genre, statut, massar } = req.body;
  db.prepare('UPDATE eleves SET nom=?,prenom=?,date_naissance=?,cin_parent=?,telephone=?,email=?,adresse=?,classe=?,niveau=?,genre=?,statut=?,massar=? WHERE id=? AND user_id=?').run(nom,prenom,date_naissance,cin_parent,telephone,email,adresse,classe,niveau,genre,statut,massar,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/eleves/:id', auth, (req, res) => {
  db.prepare('DELETE FROM eleves WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/eleves/:id', auth, (req, res) => {
  const eleve = db.prepare('SELECT * FROM eleves WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!eleve) return res.status(404).json({ error: 'Élève introuvable' });
  const notes = db.prepare('SELECT * FROM notes WHERE eleve_id=? AND user_id=?').all(req.params.id, req.user.id);
  const absences = db.prepare('SELECT * FROM absences WHERE eleve_id=? AND user_id=?').all(req.params.id, req.user.id);
  const paiements = db.prepare('SELECT * FROM paiements WHERE eleve_id=? AND user_id=?').all(req.params.id, req.user.id);
  res.json({ ...eleve, notes, absences, paiements });
});

// ── CLASSES ────────────────────────────────────────────────────
app.get('/api/classes', auth, (req, res) => {
  const classes = db.prepare('SELECT c.*, COUNT(e.id) as nb_eleves FROM classes c LEFT JOIN eleves e ON e.classe=c.nom AND e.user_id=c.user_id WHERE c.user_id=? GROUP BY c.id ORDER BY c.niveau,c.nom').all(req.user.id);
  res.json(classes);
});

app.post('/api/classes', auth, (req, res) => {
  const { nom, niveau, annee_scolaire, max_eleves, professeur_principal, salle } = req.body;
  const r = db.prepare('INSERT INTO classes (user_id,nom,niveau,annee_scolaire,max_eleves,professeur_principal,salle) VALUES (?,?,?,?,?,?,?)').run(req.user.id,nom,niveau,annee_scolaire||'2024-2025',max_eleves||35,professeur_principal,salle);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/classes/:id', auth, (req, res) => {
  const { nom, niveau, annee_scolaire, max_eleves, professeur_principal, salle } = req.body;
  db.prepare('UPDATE classes SET nom=?,niveau=?,annee_scolaire=?,max_eleves=?,professeur_principal=?,salle=? WHERE id=? AND user_id=?').run(nom,niveau,annee_scolaire,max_eleves,professeur_principal,salle,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/classes/:id', auth, (req, res) => {
  db.prepare('DELETE FROM classes WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── PROFESSEURS ────────────────────────────────────────────────
app.get('/api/professeurs', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM professeurs WHERE user_id=? ORDER BY nom').all(req.user.id));
});

app.post('/api/professeurs', auth, (req, res) => {
  const { nom, prenom, email, telephone, cin, matiere, type_contrat, salaire, date_recrutement } = req.body;
  const r = db.prepare('INSERT INTO professeurs (user_id,nom,prenom,email,telephone,cin,matiere,type_contrat,salaire,date_recrutement) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.user.id,nom,prenom,email,telephone,cin,matiere,type_contrat||'CDI',salaire||0,date_recrutement||new Date().toISOString().split('T')[0]);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/professeurs/:id', auth, (req, res) => {
  const { nom, prenom, email, telephone, cin, matiere, type_contrat, salaire, date_recrutement, statut } = req.body;
  db.prepare('UPDATE professeurs SET nom=?,prenom=?,email=?,telephone=?,cin=?,matiere=?,type_contrat=?,salaire=?,date_recrutement=?,statut=? WHERE id=? AND user_id=?').run(nom,prenom,email,telephone,cin,matiere,type_contrat,salaire,date_recrutement,statut||'actif',req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/professeurs/:id', auth, (req, res) => {
  db.prepare('DELETE FROM professeurs WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── NOTES ──────────────────────────────────────────────────────
app.get('/api/notes', auth, (req, res) => {
  const { eleve_id, classe, matiere, trimestre } = req.query;
  let q = `SELECT n.*, e.nom, e.prenom, e.classe FROM notes n JOIN eleves e ON e.id=n.eleve_id WHERE n.user_id=?`;
  const params = [req.user.id];
  if (eleve_id) { q+=' AND n.eleve_id=?'; params.push(eleve_id); }
  if (classe) { q+=' AND e.classe=?'; params.push(classe); }
  if (matiere) { q+=' AND n.matiere=?'; params.push(matiere); }
  if (trimestre) { q+=' AND n.trimestre=?'; params.push(trimestre); }
  q += ' ORDER BY e.nom,n.matiere,n.trimestre';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/notes', auth, (req, res) => {
  const { eleve_id, matiere, note, coefficient, trimestre, annee_scolaire, type_eval, date_eval, observations } = req.body;
  const r = db.prepare('INSERT INTO notes (user_id,eleve_id,matiere,note,coefficient,trimestre,annee_scolaire,type_eval,date_eval,observations) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.user.id,eleve_id,matiere,note,coefficient||1,trimestre||1,annee_scolaire||'2024-2025',type_eval||'controle',date_eval||new Date().toISOString().split('T')[0],observations);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/notes/:id', auth, (req, res) => {
  const { note, coefficient, observations } = req.body;
  db.prepare('UPDATE notes SET note=?,coefficient=?,observations=? WHERE id=? AND user_id=?').run(note,coefficient,observations,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/notes/:id', auth, (req, res) => {
  db.prepare('DELETE FROM notes WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Bulletins — moyenne par élève/trimestre
app.get('/api/bulletins/:eleve_id/:trimestre', auth, (req, res) => {
  const { eleve_id, trimestre } = req.params;
  const eleve = db.prepare('SELECT * FROM eleves WHERE id=? AND user_id=?').get(eleve_id, req.user.id);
  if (!eleve) return res.status(404).json({ error: 'Élève introuvable' });
  const notes = db.prepare('SELECT * FROM notes WHERE eleve_id=? AND trimestre=? AND user_id=?').all(eleve_id, trimestre, req.user.id);
  
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
app.get('/api/absences', auth, (req, res) => {
  const { eleve_id, date_debut, date_fin, classe } = req.query;
  let q = `SELECT a.*, e.nom, e.prenom, e.classe FROM absences a JOIN eleves e ON e.id=a.eleve_id WHERE a.user_id=?`;
  const params = [req.user.id];
  if (eleve_id) { q+=' AND a.eleve_id=?'; params.push(eleve_id); }
  if (date_debut) { q+=' AND a.date_absence>=?'; params.push(date_debut); }
  if (date_fin) { q+=' AND a.date_absence<=?'; params.push(date_fin); }
  if (classe) { q+=' AND e.classe=?'; params.push(classe); }
  q += ' ORDER BY a.date_absence DESC';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/absences', auth, (req, res) => {
  const { eleve_id, date_absence, heure_debut, heure_fin, motif, justifiee, matiere } = req.body;
  const r = db.prepare('INSERT INTO absences (user_id,eleve_id,date_absence,heure_debut,heure_fin,motif,justifiee,matiere) VALUES (?,?,?,?,?,?,?,?)').run(req.user.id,eleve_id,date_absence,heure_debut,heure_fin,motif,justifiee?1:0,matiere);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/absences/:id', auth, (req, res) => {
  const { justifiee, motif } = req.body;
  db.prepare('UPDATE absences SET justifiee=?,motif=? WHERE id=? AND user_id=?').run(justifiee?1:0,motif,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/absences/:id', auth, (req, res) => {
  db.prepare('DELETE FROM absences WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── PAIEMENTS ──────────────────────────────────────────────────
app.get('/api/paiements', auth, (req, res) => {
  const { statut, mois, annee } = req.query;
  let q = `SELECT p.*, e.nom, e.prenom, e.classe FROM paiements p JOIN eleves e ON e.id=p.eleve_id WHERE p.user_id=?`;
  const params = [req.user.id];
  if (statut) { q+=' AND p.statut=?'; params.push(statut); }
  if (mois) { q+=' AND p.mois=?'; params.push(mois); }
  if (annee) { q+=' AND p.annee=?'; params.push(annee); }
  q += ' ORDER BY p.annee DESC, p.created_at DESC';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/paiements', auth, (req, res) => {
  const { eleve_id, mois, annee, montant, montant_du, mode_paiement, reference } = req.body;
  const statut = parseFloat(montant) >= parseFloat(montant_du) ? 'paye' : parseFloat(montant) > 0 ? 'partiel' : 'impaye';
  const r = db.prepare('INSERT INTO paiements (user_id,eleve_id,mois,annee,montant,montant_du,statut,date_paiement,mode_paiement,reference) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.user.id,eleve_id,mois,annee,montant,montant_du,statut,montant>0?new Date().toISOString().split('T')[0]:null,mode_paiement||'especes',reference);
  res.json({ id: r.lastInsertRowid, statut });
});

app.put('/api/paiements/:id', auth, (req, res) => {
  const { montant, mode_paiement, reference } = req.body;
  const paiement = db.prepare('SELECT * FROM paiements WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!paiement) return res.status(404).json({ error: 'Introuvable' });
  const statut = parseFloat(montant) >= parseFloat(paiement.montant_du) ? 'paye' : parseFloat(montant) > 0 ? 'partiel' : 'impaye';
  db.prepare('UPDATE paiements SET montant=?,statut=?,date_paiement=?,mode_paiement=?,reference=? WHERE id=? AND user_id=?').run(montant,statut,montant>0?new Date().toISOString().split('T')[0]:null,mode_paiement,reference,req.params.id,req.user.id);
  res.json({ ok: true, statut });
});

// ── EMPLOI DU TEMPS ────────────────────────────────────────────
app.get('/api/emploi-temps', auth, (req, res) => {
  const { classe } = req.query;
  let q = 'SELECT * FROM emploi_temps WHERE user_id=?';
  const params = [req.user.id];
  if (classe) { q+=' AND classe=?'; params.push(classe); }
  q += ' ORDER BY CASE jour WHEN "Lundi" THEN 1 WHEN "Mardi" THEN 2 WHEN "Mercredi" THEN 3 WHEN "Jeudi" THEN 4 WHEN "Vendredi" THEN 5 WHEN "Samedi" THEN 6 END, heure_debut';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/emploi-temps', auth, (req, res) => {
  const { classe, jour, heure_debut, heure_fin, matiere, professeur, salle } = req.body;
  const r = db.prepare('INSERT INTO emploi_temps (user_id,classe,jour,heure_debut,heure_fin,matiere,professeur,salle) VALUES (?,?,?,?,?,?,?,?)').run(req.user.id,classe,jour,heure_debut,heure_fin,matiere,professeur,salle);
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/emploi-temps/:id', auth, (req, res) => {
  db.prepare('DELETE FROM emploi_temps WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── ANNONCES ───────────────────────────────────────────────────
app.get('/api/annonces', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM annonces WHERE user_id=? ORDER BY created_at DESC').all(req.user.id));
});

app.post('/api/annonces', auth, (req, res) => {
  const { titre, contenu, cible, priorite } = req.body;
  const r = db.prepare('INSERT INTO annonces (user_id,titre,contenu,cible,priorite) VALUES (?,?,?,?,?)').run(req.user.id,titre,contenu,cible||'tous',priorite||'normale');
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/annonces/:id', auth, (req, res) => {
  const { titre, contenu, cible, priorite, active } = req.body;
  db.prepare('UPDATE annonces SET titre=?,contenu=?,cible=?,priorite=?,active=? WHERE id=? AND user_id=?').run(titre,contenu,cible,priorite,active?1:0,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/annonces/:id', auth, (req, res) => {
  db.prepare('DELETE FROM annonces WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── DEPENSES ───────────────────────────────────────────────────
app.get('/api/depenses', auth, (req, res) => {
  const { categorie, date_debut, date_fin } = req.query;
  let q = 'SELECT * FROM depenses WHERE user_id=?';
  const params = [req.user.id];
  if (categorie) { q+=' AND categorie=?'; params.push(categorie); }
  if (date_debut) { q+=' AND date_depense>=?'; params.push(date_debut); }
  if (date_fin) { q+=' AND date_depense<=?'; params.push(date_fin); }
  q += ' ORDER BY date_depense DESC';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/depenses', auth, (req, res) => {
  const { libelle, montant, categorie, date_depense, fournisseur, notes } = req.body;
  const r = db.prepare('INSERT INTO depenses (user_id,libelle,montant,categorie,date_depense,fournisseur,notes) VALUES (?,?,?,?,?,?,?)').run(req.user.id,libelle,montant,categorie||'autre',date_depense||new Date().toISOString().split('T')[0],fournisseur,notes);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/depenses/:id', auth, (req, res) => {
  const { libelle, montant, categorie, date_depense, fournisseur, notes } = req.body;
  db.prepare('UPDATE depenses SET libelle=?,montant=?,categorie=?,date_depense=?,fournisseur=?,notes=? WHERE id=? AND user_id=?').run(libelle,montant,categorie,date_depense,fournisseur,notes,req.params.id,req.user.id);
  res.json({ ok: true });
});

app.delete('/api/depenses/:id', auth, (req, res) => {
  db.prepare('DELETE FROM depenses WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── STATISTIQUES DASHBOARD ─────────────────────────────────────
app.get('/api/stats', auth, (req, res) => {
  const uid = req.user.id;
  const totalEleves = db.prepare('SELECT COUNT(*) as n FROM eleves WHERE user_id=? AND statut="actif"').get(uid).n;
  const totalClasses = db.prepare('SELECT COUNT(*) as n FROM classes WHERE user_id=?').get(uid).n;
  const totalProfs = db.prepare('SELECT COUNT(*) as n FROM professeurs WHERE user_id=? AND statut="actif"').get(uid).n;
  const recettes = db.prepare('SELECT COALESCE(SUM(montant),0) as total FROM paiements WHERE user_id=? AND statut IN ("paye","partiel")').get(uid).total;
  const depenses = db.prepare('SELECT COALESCE(SUM(montant),0) as total FROM depenses WHERE user_id=?').get(uid).total;
  const impayesCount = db.prepare('SELECT COUNT(*) as n FROM paiements WHERE user_id=? AND statut="impaye"').get(uid).n;
  const impayesTotal = db.prepare('SELECT COALESCE(SUM(montant_du-montant),0) as total FROM paiements WHERE user_id=? AND statut IN ("impaye","partiel")').get(uid).total;
  const absAujourd = db.prepare('SELECT COUNT(*) as n FROM absences WHERE user_id=? AND date_absence=DATE("now")').get(uid).n;
  const totalAbsences = db.prepare('SELECT COUNT(*) as n FROM absences WHERE user_id=?').get(uid).n;
  const parNiveau = db.prepare('SELECT niveau, COUNT(*) as nb FROM eleves WHERE user_id=? AND statut="actif" GROUP BY niveau').all(uid);
  const parClasse = db.prepare('SELECT classe, COUNT(*) as nb FROM eleves WHERE user_id=? AND statut="actif" GROUP BY classe ORDER BY nb DESC LIMIT 10').all(uid);
  
  res.json({ totalEleves, totalClasses, totalProfs, recettes, depenses, benefice: recettes-depenses, impayesCount, impayesTotal, absAujourd, totalAbsences, parNiveau, parClasse });
});

// ── CATCHALL → SPA ─────────────────────────────────────────────

// ── SUPER ADMIN ROUTES ────────────────────────────────────────
function isSuperAdmin(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Accès refusé' });
  next();
}

app.get('/api/superadmin/clients', auth, isSuperAdmin, (req, res) => {
  const clients = db.prepare('SELECT id, nom, prenom, email, school, plan, plan_expires, created_at, last_login, is_demo FROM users WHERE role != ? ORDER BY created_at DESC').all('superadmin');
  res.json(clients);
});

app.post('/api/superadmin/clients', auth, isSuperAdmin, (req, res) => {
  const { school, email, password, plan } = req.body;
  if (!school || !email || !password) return res.status(400).json({ error: 'Champs requis manquants' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email déjà utilisé' });
  const hash = bcrypt.hashSync(password, 10);
  const expires = calcExpires(plan);
  db.prepare('INSERT INTO users (nom, prenom, email, password, role, school, plan, plan_expires) VALUES (?,?,?,?,?,?,?,?)').run('Admin', school, email, hash, 'admin', school, 'pro', expires);
  res.json({ ok: true });
});

app.post('/api/superadmin/activate', auth, isSuperAdmin, (req, res) => {
  const { user_id, duree } = req.body;
  const expires = calcExpires(duree);
  db.prepare('UPDATE users SET plan_expires = ? WHERE id = ?').run(expires, user_id);
  res.json({ ok: true, expires });
});

app.delete('/api/superadmin/clients/:id', auth, isSuperAdmin, (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(id, 'superadmin');
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

function startServer() {
  app.listen(PORT, () => {
    console.log(`✅ MadrasaTech démarré sur http://localhost:${PORT}`);
    console.log(`   Admin: admin@madrasatech.ma / admin2024`);
    console.log(`   Demo:  demo@madrasatech.ma  / demo2024`);
  });
}
