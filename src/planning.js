const ical = require('node-ical');

const REFRESH_MS = 30 * 60 * 1000;
const AUTONOMIE_PREFIX = 'Autonomie - ';

let sessions = [];
let lastUpdate = null;

// Les champs Hyperplanning peuvent être une chaîne ou { params, val }
const text = (value) => (value && typeof value === 'object' ? value.val : value || '');

function field(description, name) {
  const match = description.match(new RegExp(`${name} : (.*)`));
  return match ? match[1].trim() : null;
}

function toSession(event) {
  const description = text(event.description);
  const matiere = field(description, 'Matière') || text(event.summary);
  return {
    uid: event.uid,
    matiere,
    // Les séances "Autonomie - X" sont rattachées à la matière X
    matiereBase: matiere.startsWith(AUTONOMIE_PREFIX) ? matiere.slice(AUTONOMIE_PREFIX.length) : matiere,
    intervenant: field(description, 'Intervenant'),
    salle: field(description, 'Salle') || text(event.location) || null,
    type: field(description, 'Type'),
    allDay: event.datetype === 'date',
    start: new Date(event.start),
    end: new Date(event.end),
  };
}

async function refresh() {
  const res = await fetch(process.env.ICS_URL);
  if (!res.ok) throw new Error(`Hyperplanning a répondu ${res.status}`);

  const data = ical.sync.parseICS(await res.text());
  sessions = Object.values(data)
    .filter((e) => e.type === 'VEVENT')
    .map(toSession)
    .sort((a, b) => a.start - b.start);
  lastUpdate = new Date();
  console.log(`Planning mis à jour : ${sessions.length} séances.`);
}

// En cas d'échec on garde le planning précédent
async function safeRefresh() {
  try {
    await refresh();
  } catch (error) {
    console.error('Impossible de mettre à jour le planning :', error.message);
  }
}

function startAutoRefresh() {
  setInterval(safeRefresh, REFRESH_MS);
  return safeRefresh();
}

const getSessions = () => sessions;
const getSession = (uid) => sessions.find((s) => s.uid === uid);
const getLastUpdate = () => lastUpdate;

// Liste des matières (sans doublons "Autonomie" ni jours fériés)
function getMatieres() {
  return [...new Set(sessions.filter((s) => !s.allDay).map((s) => s.matiereBase))].sort((a, b) =>
    a.localeCompare(b, 'fr')
  );
}

module.exports = { startAutoRefresh, getSessions, getSession, getMatieres, getLastUpdate };
