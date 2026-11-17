const path = require('node:path');
const guilds = require('./guilds');
const evals = require('./evals');
const { DATA_DIR, readJson, writeJson } = require('./store');
const { ymd, hm, addDays, parisDate, daysBetween } = require('./utils/dates');
const { typeStyle } = require('./utils/evalStyle');
const { cardFile } = require('./utils/evalCardFile');

// Rappels déjà envoyés : { [guildId]: { "evalId:jours": ISO } }
const FILE = process.env.REMINDERS_FILE || path.join(DATA_DIR, 'reminders.json');
const TICK_MS = 60 * 1000;
// Un rappel en retard de plus de 12 h (bot arrêté) est abandonné au lieu d'être envoyé
const GRACE_MS = 12 * 60 * 60 * 1000;

const key = (evaluation, days) => `${evaluation.id}:${days}`;

// Heure d'envoi du rappel « N jours avant » : N jours avant le jour de l'éval, à l'heure configurée (Paris)
const reminderTime = (evaluation, days, hour) => parisDate(addDays(ymd(evaluation.start), -days), hour);

/**
 * Rappels à envoyer maintenant pour un serveur.
 * Un rappel est dû si son heure est passée, que l'éval n'a pas commencé, et que l'heure
 * est postérieure à la création de l'éval et à l'ajout du délai (pas de rappel rétroactif).
 * Un rappel en retard de plus de GRACE_MS est abandonné. Si plusieurs délais sont dus à la fois,
 * seul le plus proche de l'éval est envoyé ; les autres sont simplement marqués comme faits.
 * Renvoie [{ evaluation, days, keys }] où keys = tout ce qu'il faut marquer comme envoyé.
 */
function computeDue(config, list, sent, now) {
  const due = [];
  for (const evaluation of list) {
    if (evaluation.start <= now) continue;
    const created = new Date(evaluation.createdAt || 0);

    const candidates = config.days
      .map((d) => ({ ...d, at: reminderTime(evaluation, d.days, config.hour) }))
      .filter(
        (d) =>
          d.at <= now &&
          d.at >= created &&
          d.at >= new Date(d.since || 0) &&
          !sent[key(evaluation, d.days)]
      );
    if (!candidates.length) continue;

    const keys = candidates.map((d) => key(evaluation, d.days));
    const fresh = candidates.filter((d) => now - d.at <= GRACE_MS);
    const closest = fresh.length ? fresh.reduce((a, b) => (a.days <= b.days ? a : b)) : null;
    due.push({ evaluation, days: closest?.days ?? null, keys });
  }
  return due;
}

function whenLabel(evaluation, now) {
  const n = daysBetween(ymd(now), ymd(evaluation.start));
  if (n <= 0) return { badge: "AUJOURD'HUI", text: "aujourd'hui" };
  if (n === 1) return { badge: 'DEMAIN', text: 'demain' };
  return { badge: `DANS ${n} JOURS`, text: `dans ${n} jours` };
}

async function send(client, channelId, evaluation, now) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error(`salon ${channelId} introuvable`);

  const when = whenLabel(evaluation, now);
  const { emoji } = typeStyle(evaluation.type);
  await channel.send({
    content: `@here 🔔 **Rappel** : ${emoji} **${evaluation.titre}** (${evaluation.matiere}) — ${when.text} à ${hm(evaluation.start)}`,
    files: [cardFile(evaluation, { variant: 'rappel', label: when.badge })],
    allowedMentions: { parse: ['everyone'] },
  });
}

let running = false;

async function tick(client, now = new Date()) {
  if (running) return;
  running = true;
  try {
    const sentDb = readJson(FILE, {});
    let changed = false;

    for (const [guildId, config] of guilds.all()) {
      const reminders = guilds.remindersOf(config);
      const list = evals.upcoming(guildId);
      const sent = sentDb[guildId] || {};

      // On oublie les rappels des évals terminées ou supprimées
      const alive = new Set(list.map((e) => String(e.id)));
      for (const k of Object.keys(sent)) {
        if (!alive.has(k.split(':')[0])) {
          delete sent[k];
          changed = true;
        }
      }

      if (reminders.channelId && reminders.days.length && client.guilds.cache.has(guildId)) {
        for (const { evaluation, days, keys } of computeDue(reminders, list, sent, now)) {
          // Marqué avant l'envoi : en cas d'erreur (permissions…), on ne spamme pas toutes les minutes
          for (const k of keys) sent[k] = now.toISOString();
          changed = true;
          if (days === null) {
            console.log(`Rappel(s) trop en retard abandonné(s) : éval #${evaluation.id} (serveur ${guildId})`);
            continue;
          }
          try {
            await send(client, reminders.channelId, evaluation, now);
            console.log(`Rappel J-${days} envoyé : éval #${evaluation.id} (serveur ${guildId})`);
          } catch (error) {
            console.error(`Rappel J-${days} de l'éval #${evaluation.id} (serveur ${guildId}) non envoyé :`, error.message);
          }
        }
      }

      if (Object.keys(sent).length) sentDb[guildId] = sent;
      else delete sentDb[guildId];
    }

    if (changed) writeJson(FILE, sentDb);
  } catch (error) {
    console.error('Erreur dans les rappels :', error);
  } finally {
    running = false;
  }
}

function start(client) {
  setInterval(() => tick(client), TICK_MS);
  return tick(client);
}

module.exports = { start, tick, computeDue, reminderTime };
