const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const planning = require('../planning');

const NOT_CONFIGURED =
  "📭 Aucun planning n'est configuré sur ce serveur.\nUn admin doit d'abord le lier avec `/config planning lien:<lien iCal Hyperplanning>`.";

// Vérifie que le serveur a un planning ; sinon répond (en privé) et renvoie false
async function requirePlanning(interaction) {
  if (planning.isConfigured(interaction.guildId)) return true;
  await interaction.reply({ content: NOT_CONFIGURED, flags: MessageFlags.Ephemeral });
  return false;
}

// Admins du bot (BOT_ADMINS dans le .env, IDs séparés par des virgules) : autorisés sur tous les serveurs
const BOT_ADMINS = (process.env.BOT_ADMINS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const isAdmin = (interaction) =>
  BOT_ADMINS.includes(interaction.user.id) || Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));

// Vérifie que l'utilisateur peut gérer le bot ; sinon répond (en privé) et renvoie false
async function requireAdmin(interaction) {
  if (isAdmin(interaction)) return true;
  await interaction.reply({
    content: '🔒 Cette commande est réservée aux membres ayant la permission **Gérer le serveur**.',
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

module.exports = { requirePlanning, requireAdmin, isAdmin, NOT_CONFIGURED };
