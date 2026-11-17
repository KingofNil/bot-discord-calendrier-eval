const { SlashCommandBuilder, MessageFlags, InteractionContextType, EmbedBuilder } = require('discord.js');
const planning = require('../planning');
const guilds = require('../guilds');
const { hm, discordTs } = require('../utils/dates');
const { NOT_CONFIGURED, requireAdmin } = require('../utils/guard');

// Masque la clé d'accès contenue dans le lien iCal
function maskUrl(url) {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname.length > 20 ? `${pathname.slice(0, 20)}…` : pathname}`;
  } catch {
    return '—';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurer le bot pour ce serveur')
    // /config planning est réservé aux admins (vérifié dans execute), /config voir est accessible à tous
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName('planning')
        .setDescription('Lier ce serveur à un emploi du temps Hyperplanning (lien iCal) — admin')
        .addStringOption((o) =>
          o.setName('lien').setDescription("Lien d'export iCal Hyperplanning").setRequired(true).setMaxLength(1000)
        )
    )
    .addSubcommand((sub) => sub.setName('voir').setDescription('Voir la configuration actuelle')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'planning') {
      if (!(await requireAdmin(interaction))) return;
      const lien = interaction.options.getString('lien').trim();
      if (!/^(https?|webcal):\/\//i.test(lien)) {
        return interaction.reply({ content: '❌ Le lien doit commencer par `https://` (ou `webcal://`).', flags: MessageFlags.Ephemeral });
      }
      const url = lien.replace(/^webcal:\/\//i, 'https://');

      // Le lien contient une clé personnelle : on répond toujours en privé
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let sessions;
      try {
        sessions = await planning.load(url);
      } catch (error) {
        return interaction.editReply(`❌ Impossible de charger ce planning : ${error.message}`);
      }
      if (!sessions.length) {
        return interaction.editReply('❌ Ce lien ne contient aucune séance. Vérifie que c\'est bien le lien d\'export iCal.');
      }

      guilds.setIcsUrl(interaction.guildId, url, interaction.user.id);
      return interaction.editReply(
        `✅ Planning lié à ce serveur : **${sessions.length} séances** chargées (${planning.getMatieres(interaction.guildId).length} matières).\nIl sera mis à jour automatiquement toutes les 30 minutes.`
      );
    }

    if (sub === 'voir') {
      const config = guilds.get(interaction.guildId);
      if (!config?.icsUrl) return interaction.reply({ content: NOT_CONFIGURED, flags: MessageFlags.Ephemeral });

      const updated = planning.getLastUpdate(interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('⚙️ Configuration du serveur')
        .addFields(
          { name: '🔗 Planning', value: `\`${maskUrl(config.icsUrl)}\`` },
          { name: '📚 Séances', value: String(planning.getSessions(interaction.guildId).length), inline: true },
          { name: '🔄 Dernière mise à jour', value: updated ? hm(updated) : 'échec du chargement', inline: true },
          { name: '👤 Configuré par', value: `<@${config.updatedBy}> ${discordTs(new Date(config.updatedAt), 'R')}` }
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
