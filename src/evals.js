const fs = require('node:fs');
const path = require('node:path');
const planning = require('./planning');
const { STYLES } = require('./utils/evalStyle');

// EVALS_FILE permet d'utiliser un autre fichier (tests)
const FILE = process.env.EVALS_FILE || path.join(__dirname, '..', 'data', 'evals.json');

const TYPES = Object.keys(STYLES);

function load() {
  if (!fs.existsSync(FILE)) return { nextId: 1, evals: [] };
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

// Si la séance a été déplacée sur Hyperplanning, l'éval suit la séance
function resolve(evaluation) {
  const session = planning.getSession(evaluation.sessionUid);
  return {
    ...evaluation,
    start: new Date(session ? session.start : evaluation.start),
    end: new Date(session ? session.end : evaluation.end),
    salle: session ? session.salle : evaluation.salle,
    intervenant: session ? session.intervenant : null,
    orpheline: !session,
  };
}

function add({ session, type, titre, description, createdBy }) {
  const db = load();
  const evaluation = {
    id: db.nextId++,
    sessionUid: session.uid,
    matiere: session.matiereBase,
    type,
    titre,
    description: description || null,
    start: session.start.toISOString(),
    end: session.end.toISOString(),
    salle: session.salle,
    createdBy,
    createdAt: new Date().toISOString(),
  };
  db.evals.push(evaluation);
  save(db);
  return resolve(evaluation);
}

function remove(id) {
  const db = load();
  const index = db.evals.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const [removed] = db.evals.splice(index, 1);
  save(db);
  return resolve(removed);
}

function all() {
  return load().evals.map(resolve).sort((a, b) => a.start - b.start);
}

// Évals pas encore terminées
const upcoming = () => all().filter((e) => e.end > new Date());

const findBySession = (uid) => all().filter((e) => e.sessionUid === uid);

module.exports = { TYPES, add, remove, all, upcoming, findBySession };
