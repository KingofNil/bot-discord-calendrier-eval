const path = require('node:path');
const { DATA_DIR, readJson, writeJson } = require('./store');

// Configuration propre à chaque serveur Discord : { [guildId]: { icsUrl, updatedBy, updatedAt } }
const FILE = process.env.GUILDS_FILE || path.join(DATA_DIR, 'guilds.json');

const load = () => readJson(FILE, {});

const get = (guildId) => (guildId ? load()[guildId] || null : null);

function setIcsUrl(guildId, icsUrl, updatedBy) {
  const db = load();
  db[guildId] = { ...db[guildId], icsUrl, updatedBy, updatedAt: new Date().toISOString() };
  writeJson(FILE, db);
  return db[guildId];
}

// Liste des liens iCal utilisés (sans doublons : plusieurs serveurs peuvent partager le même planning)
const icsUrls = () => [...new Set(Object.values(load()).map((c) => c.icsUrl).filter(Boolean))];

module.exports = { get, setIcsUrl, icsUrls };
