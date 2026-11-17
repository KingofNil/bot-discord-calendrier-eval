const path = require('node:path');
const planning = require('./planning');
const { DATA_DIR, readJson, writeJson } = require('./store');
const { STYLES } = require('./utils/evalStyle');

// EVALS_FILE permet d'utiliser un autre fichier (tests)
const FILE = process.env.EVALS_FILE || path.join(DATA_DIR, 'evals.json');

const TYPES = Object.keys(STYLES);

// Format : { guilds: { [guildId]: { nextId, evals: [] } } }
function load() {
  const db = readJson(FILE, { guilds: {} });

  // Migration de l'ancien format mono-serveur { nextId, evals }
  if (Array.isArray(db.evals)) {
    const guildId = process.env.GUILD_ID || 'legacy';
    if (guildId === 'legacy' && db.evals.length) {
      console.warn('[AVERTISSEMENT] Anciennes évaluations trouvées sans GUILD_ID : elles sont mises de côté sous "legacy".');
    }
    const migrated = { guilds: { [guildId]: { nextId: db.nextId, evals: db.evals } } };
    writeJson(FILE, migrated);
    return migrated;
  }
  return db;
}

const save = (db) => writeJson(FILE, db);

function guildData(db, guildId) {
  if (!db.guilds[guildId]) db.guilds[guildId] = { nextId: 1, evals: [] };
  return db.guilds[guildId];
}

// Si la séance a été déplacée sur Hyperplanning, l'éval suit la séance
function resolve(guildId, evaluation) {
  const session = planning.getSession(guildId, evaluation.sessionUid);
  return {
    ...evaluation,
    start: new Date(session ? session.start : evaluation.start),
    end: new Date(session ? session.end : evaluation.end),
    salle: session ? session.salle : evaluation.salle,
    intervenant: session ? session.intervenant : null,
    orpheline: !session && planning.isLoaded(guildId),
  };
}

function add(guildId, { session, type, titre, description, createdBy }) {
  const db = load();
  const data = guildData(db, guildId);
  const evaluation = {
    id: data.nextId++,
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
  data.evals.push(evaluation);
  save(db);
  return resolve(guildId, evaluation);
}

function remove(guildId, id) {
  const db = load();
  const data = db.guilds[guildId];
  const index = data ? data.evals.findIndex((e) => e.id === id) : -1;
  if (index === -1) return null;
  const [removed] = data.evals.splice(index, 1);
  save(db);
  return resolve(guildId, removed);
}

function all(guildId) {
  const data = load().guilds[guildId];
  if (!data) return [];
  return data.evals.map((e) => resolve(guildId, e)).sort((a, b) => a.start - b.start);
}

// Évals pas encore terminées
const upcoming = (guildId) => all(guildId).filter((e) => e.end > new Date());

const findBySession = (guildId, uid) => all(guildId).filter((e) => e.sessionUid === uid);

module.exports = { TYPES, add, remove, all, upcoming, findBySession };
