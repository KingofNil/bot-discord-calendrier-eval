const { EmbedBuilder } = require('discord.js');
const { hm, discordTs } = require('./dates');

// Apparence de chaque type d'évaluation
const STYLES = {
  Partiel: { emoji: '🔴', hex: '#ed4245', label: 'Partiel' },
  'Contrôle': { emoji: '🟠', hex: '#f0883e', label: 'Contrôle' },
  QCM: { emoji: '🟡', hex: '#e5b800', label: 'QCM' },
  'Oral / Soutenance': { emoji: '🟣', hex: '#9b59b6', label: 'Oral' },
  'Rendu de projet': { emoji: '🔵', hex: '#3498db', label: 'Rendu' },
  Autre: { emoji: '⚪', hex: '#99aab5', label: 'Éval' },
};

function typeStyle(type) {
  const style = STYLES[type] || STYLES.Autre;
  return { ...style, color: parseInt(style.hex.slice(1), 16) };
}

// Niveau d'urgence selon le temps restant
function urgency(start) {
  const days = (start - Date.now()) / 86_400_000;
  if (days < 0) return '⏳ En cours';
  if (days <= 2) return '🔥 Imminent';
  if (days <= 7) return '⏰ Cette semaine';
  if (days <= 14) return '📆 Dans 2 semaines';
  return null;
}

// Carte complète d'une évaluation
function evalEmbed(evaluation, { title } = {}) {
  const style = typeStyle(evaluation.type);
  const tag = urgency(evaluation.start);

  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setAuthor({ name: `${style.emoji} ${evaluation.type.toUpperCase()}  ·  ${evaluation.matiere}`.slice(0, 256) })
    .setTitle((title ? `${title} : ${evaluation.titre}` : evaluation.titre).slice(0, 256))
    .addFields(
      { name: '📅 Date', value: discordTs(evaluation.start, 'D'), inline: true },
      { name: '🕗 Horaire', value: `${hm(evaluation.start)} – ${hm(evaluation.end)}`, inline: true },
      { name: '📍 Salle', value: evaluation.salle || '—', inline: true }
    );

  const description = [];
  if (tag) description.push(`**${tag}** · ${discordTs(evaluation.start, 'R')}`);
  else description.push(discordTs(evaluation.start, 'R'));
  if (evaluation.description) description.push('', `>>> ${evaluation.description}`);
  embed.setDescription(description.join('\n'));

  if (evaluation.intervenant) embed.addFields({ name: '👤 Intervenant', value: evaluation.intervenant, inline: true });
  if (evaluation.orpheline) {
    embed.addFields({ name: '⚠️ Attention', value: 'Séance introuvable dans le planning (déplacée ou supprimée ?)' });
  }
  embed.setFooter({ text: `Éval #${evaluation.id}` });
  return embed;
}

module.exports = { STYLES, typeStyle, urgency, evalEmbed };
