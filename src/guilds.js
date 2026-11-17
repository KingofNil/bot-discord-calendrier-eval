const path = require('node:path');
const { DATA_DIR, readJson, writeJson } = require('./store');

// Configuration propre à chaque serveur Discord :
// { [guildId]: { icsUrl, updatedBy, updatedAt, reminders: { days: [{ days, since }], hour, channelId } } }
const FILE = process.env.GUILDS_FILE || path.join(DATA_DIR, 'guilds.json');

const DEFAULT_HOUR = '18:00';

const load = () => readJson(FILE, {});

const get = (guildId) => (guildId ? load()[guildId] || null : null);

// Liste [guildId, config] de tous les serveurs configurés
const all = () => Object.entries(load());

function update(guildId, fn) {
  const db = load();
  db[guildId] = fn({ ...db[guildId] });
  writeJson(FILE, db);
  return db[guildId];
}

const setIcsUrl = (guildId, icsUrl, updatedBy) =>
  update(guildId, (c) => ({ ...c, icsUrl, updatedBy, updatedAt: new Date().toISOString() }));

// Liste des liens iCal utilisés (sans doublons : plusieurs serveurs peuvent partager le même planning)
const icsUrls = () => [...new Set(Object.values(load()).map((c) => c.icsUrl).filter(Boolean))];

// --- Rappels ---

function remindersOf(config) {
  const r = config?.reminders || {};
  return { days: r.days || [], hour: r.hour || DEFAULT_HOUR, channelId: r.channelId || null };
}

const reminders = (guildId) => remindersOf(get(guildId));

const updateReminders = (guildId, fn) =>
  remindersOf(update(guildId, (c) => ({ ...c, reminders: fn(remindersOf(c)) })));

// Ajoute un délai (en jours). `since` évite d'envoyer des rappels rétroactifs. Renvoie false s'il existait déjà.
function addReminder(guildId, days) {
  if (reminders(guildId).days.some((d) => d.days === days)) return false;
  updateReminders(guildId, (r) => ({
    ...r,
    days: [...r.days, { days, since: new Date().toISOString() }].sort((a, b) => b.days - a.days),
  }));
  return true;
}

function removeReminder(guildId, days) {
  if (!reminders(guildId).days.some((d) => d.days === days)) return false;
  updateReminders(guildId, (r) => ({ ...r, days: r.days.filter((d) => d.days !== days) }));
  return true;
}

const setReminderChannel = (guildId, channelId) => updateReminders(guildId, (r) => ({ ...r, channelId }));
const setReminderHour = (guildId, hour) => updateReminders(guildId, (r) => ({ ...r, hour }));

module.exports = {
  DEFAULT_HOUR,
  get,
  all,
  setIcsUrl,
  icsUrls,
  reminders,
  remindersOf,
  addReminder,
  removeReminder,
  setReminderChannel,
  setReminderHour,
};
