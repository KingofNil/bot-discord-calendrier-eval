const {
  SlashCommandBuilder,
  MessageFlags,
  InteractionContextType,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const planning = require('../planning');
const guilds = require('../guilds');
const { hm, discordTs } = require('../utils/dates');
const { NOT_CONFIGURED, requireAdmin } = require('../utils/guard');

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });

// Masque la clé d'accès contenue dans le lien iCal
function maskUrl(url) {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname.length > 20 ? `${pathname.slice(0, 20)}…` : pathname}`;
  } catch {
    return '—';
  }
}

const daysLabel = (days) => (days % 7 === 0 ? `${days / 7} semaine${days > 7 ? 's' : ''}` : `${days} jour${days > 1 ? 's' : ''}`);

function remindersSummary(guildId) {
  const r = guilds.reminders(guildId);
  const delays = r.days.length ? r.days.map((d) => `**${daysLabel(d.days)}**`).join(', ') : 'aucun';
  return [
    `⏰ Délais : ${delays} avant l'éval, à **${r.hour}**`,
    `📢 Salon : ${r.channelId ? `<#${r.channelId}>` : 'non défini'}`,
    !r.channelId || !r.days.length ? '⚠️ Les rappels sont inactifs tant qu\'il manque un salon ou un délai.' : null,
  ]
    .filter(Boolean)
    .join('\n');
}

// Permissions dont le bot a besoin dans le salon des rappels
const REQUIRED = [
  [PermissionFlagsBits.ViewChannel, 'Voir le salon'],
  [PermissionFlagsBits.SendMessages, 'Envoyer des messages'],
  [PermissionFlagsBits.AttachFiles, 'Joindre des fichiers'],
  [PermissionFlagsBits.MentionEveryone, 'Mentionner @everyone, @here et tous les rôles'],
];

async function handleRappels(interaction, sub) {
  const { guildId } = interaction;

  if (sub === 'ajouter') {
    const days = interaction.options.getInteger('jours');
    const added = guilds.addReminder(guildId, days);
    const head = added
      ? `✅ Rappel ajouté : **${daysLabel(days)}** avant chaque évaluation.`
      : `ℹ️ Un rappel **${daysLabel(days)}** avant existe déjà.`;
    return interaction.reply(ephemeral(`${head}\n\n${remindersSummary(guildId)}`));
  }

  if (sub === 'supprimer') {
    const days = interaction.options.getInteger('jours');
    const removed = guilds.removeReminder(guildId, days);
    const head = removed ? `🗑️ Rappel **${daysLabel(days)}** avant supprimé.` : `❌ Aucun rappel **${daysLabel(days)}** avant.`;
    return interaction.reply(ephemeral(`${head}\n\n${remindersSummary(guildId)}`));
  }

  if (sub === 'salon') {
    const channel = interaction.options.getChannel('salon');
    const me = interaction.guild?.members.me;
    const perms = me ? channel.permissionsFor(me) : null;
    const missing = perms ? REQUIRED.filter(([flag]) => !perms.has(flag)).map(([, name]) => name) : [];

    guilds.setReminderChannel(guildId, channel.id);
    const warning = missing.length
      ? `\n\n⚠️ Il me manque des permissions dans ${channel} : **${missing.join('**, **')}**. Sans elles, les rappels ne partiront pas (ou sans @here).`
      : '';
    return interaction.reply(ephemeral(`✅ Les rappels seront envoyés dans ${channel}.${warning}\n\n${remindersSummary(guildId)}`));
  }

  if (sub === 'heure') {
    const match = interaction.options.getString('heure').trim().match(/^(\d{1,2})(?:[:hH](\d{2})?)?$/);
    const h = match ? Number(match[1]) : NaN;
    const m = match && match[2] ? Number(match[2]) : 0;
    if (!match || h > 23 || m > 59) return interaction.reply(ephemeral('❌ Heure invalide. Exemples : `18:00`, `8h30`, `20h`.'));

    const hour = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    guilds.setReminderHour(guildId, hour);
    return interaction.reply(ephemeral(`✅ Les rappels partiront à **${hour}** (heure de Paris).\n\n${remindersSummary(guildId)}`));
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurer le bot pour ce serveur')
    // /config planning et /config rappels sont réservés aux admins (vérifié dans execute), /config voir est accessible à tous
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName('planning')
        .setDescription('Lier ce serveur à un emploi du temps Hyperplanning (lien iCal) — admin')
        .addStringOption((o) =>
          o.setName('lien').setDescription("Lien d'export iCal Hyperplanning").setRequired(true).setMaxLength(1000)
        )
    )
    .addSubcommand((sub) => sub.setName('voir').setDescription('Voir la configuration actuelle'))
    .addSubcommandGroup((group) =>
      group
        .setName('rappels')
        .setDescription('Rappels automatiques avant les évaluations — admin')
        .addSubcommand((sub) =>
          sub
            .setName('ajouter')
            .setDescription('Ajouter un rappel N jours avant chaque évaluation')
            .addIntegerOption((o) =>
              o.setName('jours').setDescription('Nombre de jours avant (1 = la veille, 7 = 1 semaine)').setRequired(true).setMinValue(1).setMaxValue(60)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('supprimer')
            .setDescription('Supprimer un rappel')
            .addIntegerOption((o) =>
              o.setName('jours').setDescription('Rappel à supprimer').setRequired(true).setAutocomplete(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('salon')
            .setDescription('Salon où envoyer les rappels (avec @here)')
            .addChannelOption((o) =>
              o
                .setName('salon')
                .setDescription('Salon des rappels')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('heure')
            .setDescription('Heure d\'envoi des rappels (18:00 par défaut)')
            .addStringOption((o) => o.setName('heure').setDescription('Ex : 18:00, 8h30, 20h').setRequired(true).setMaxLength(5))
        )
    ),

  async autocomplete(interaction) {
    const r = guilds.reminders(interaction.guildId);
    await interaction.respond(r.days.map((d) => ({ name: `${daysLabel(d.days)} avant`, value: d.days })).slice(0, 25));
  },

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (group === 'rappels') {
      if (!(await requireAdmin(interaction))) return;
      return handleRappels(interaction, sub);
    }

    if (sub === 'planning') {
      if (!(await requireAdmin(interaction))) return;
      const lien = interaction.options.getString('lien').trim();
      if (!/^(https?|webcal):\/\//i.test(lien)) {
        return interaction.reply(ephemeral('❌ Le lien doit commencer par `https://` (ou `webcal://`).'));
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
      if (!config?.icsUrl) return interaction.reply(ephemeral(NOT_CONFIGURED));

      const updated = planning.getLastUpdate(interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('⚙️ Configuration du serveur')
        .addFields(
          { name: '🔗 Planning', value: `\`${maskUrl(config.icsUrl)}\`` },
          { name: '📚 Séances', value: String(planning.getSessions(interaction.guildId).length), inline: true },
          { name: '🔄 Dernière mise à jour', value: updated ? hm(updated) : 'échec du chargement', inline: true },
          {
            name: '👤 Configuré par',
            value: `${config.updatedBy ? `<@${config.updatedBy}>` : 'fichier .env'} ${discordTs(new Date(config.updatedAt), 'R')}`,
          },
          { name: '🔔 Rappels', value: remindersSummary(interaction.guildId) }
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
