const ical = require('node-ical');
const guilds = require('./guilds');

const REFRESH_MS = 30 * 60 * 1000;
const AUTONOMIE_PREFIX = 'Autonomie - ';

// Un cache par lien iCal : url -> { sessions, lastUpdate }
const cache = new Map();

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

// Télécharge et met en cache un planning. Lève une erreur si le lien est invalide.
async function load(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Hyperplanning a répondu ${res.status}`);

  const data = ical.sync.parseICS(await res.text());
  const sessions = Object.values(data)
    .filter((e) => e.type === 'VEVENT')
    .map(toSession)
    .sort((a, b) => a.start - b.start);
  cache.set(url, { sessions, lastUpdate: new Date() });
  return sessions;
}

// En cas d'échec on garde le planning précédent
async function safeLoad(url) {
  try {
    const sessions = await load(url);
    console.log(`Planning mis à jour : ${sessions.length} séances.`);
  } catch (error) {
    console.error('Impossible de mettre à jour un planning :', error.message);
  }
}

async function refreshAll() {
  const urls = guilds.icsUrls();
  // On oublie les plannings qui ne sont plus utilisés par aucun serveur
  for (const url of cache.keys()) if (!urls.includes(url)) cache.delete(url);
  await Promise.all(urls.map(safeLoad));
}

function startAutoRefresh() {
  setInterval(refreshAll, REFRESH_MS);
  return refreshAll();
}

const entry = (guildId) => {
  const config = guilds.get(guildId);
  return config?.icsUrl ? cache.get(config.icsUrl) : undefined;
};

const isConfigured = (guildId) => Boolean(guilds.get(guildId)?.icsUrl);
// Le planning a été chargé au moins une fois (sinon on ne peut pas savoir si une séance a disparu)
const isLoaded = (guildId) => Boolean(entry(guildId));
const getSessions = (guildId) => entry(guildId)?.sessions || [];
const getSession = (guildId, uid) => getSessions(guildId).find((s) => s.uid === uid);
const getLastUpdate = (guildId) => entry(guildId)?.lastUpdate || null;

// Liste des matières (sans doublons "Autonomie" ni jours fériés)
function getMatieres(guildId) {
  return [...new Set(getSessions(guildId).filter((s) => !s.allDay).map((s) => s.matiereBase))].sort((a, b) =>
    a.localeCompare(b, 'fr')
  );
}

module.exports = {
  load,
  startAutoRefresh,
  isConfigured,
  isLoaded,
  getSessions,
  getSession,
  getMatieres,
  getLastUpdate,
};
