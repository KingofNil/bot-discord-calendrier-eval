const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const planning = require('../planning');
const evals = require('../evals');
const { short } = require('../utils/dates');
const { STYLES, evalEmbed } = require('../utils/evalStyle');

const filter = (items, query) => items.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
const truncate = (s, max) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eval')
    .setDescription('Gérer les évaluations (admin)')
    // Visible uniquement par ceux qui peuvent gérer le serveur (ajustable dans Paramètres > Intégrations)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('ajouter')
        .setDescription('Ajouter une évaluation sur une séance du planning')
        .addStringOption((o) =>
          o.setName('matiere').setDescription('Matière').setRequired(true).setAutocomplete(true)
        )
        .addStringOption((o) =>
          o.setName('seance').setDescription('Séance du planning').setRequired(true).setAutocomplete(true)
        )
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription("Type d'évaluation")
            .setRequired(true)
            .addChoices(...evals.TYPES.map((t) => ({ name: `${STYLES[t].emoji} ${t}`, value: t })))
        )
        .addStringOption((o) =>
          o.setName('titre').setDescription('Ex : "Partiel chapitres 1 à 4"').setRequired(true).setMaxLength(100)
        )
        .addStringOption((o) =>
          o.setName('details').setDescription('Infos complémentaires (documents autorisés, etc.)').setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('supprimer')
        .setDescription('Supprimer une évaluation')
        .addIntegerOption((o) =>
          o.setName('evaluation').setDescription('Évaluation à supprimer').setRequired(true).setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'matiere') {
      const choices = filter(planning.getMatieres(), focused.value).slice(0, 25);
      return interaction.respond(choices.map((m) => ({ name: truncate(m, 100), value: truncate(m, 100) })));
    }

    if (focused.name === 'seance') {
      const matiere = interaction.options.getString('matiere');
      const now = new Date();
      const sessions = planning
        .getSessions()
        .filter((s) => !s.allDay && s.end > now && (!matiere || s.matiereBase.slice(0, 100) === matiere))
        .filter((s) => short(s.start).includes(focused.value))
        .slice(0, 25);
      return interaction.respond(
        sessions.map((s) => ({
          name: truncate(`${short(s.start)}–${short(s.end).slice(-5)} · ${s.salle || '?'} · ${s.matiere}`, 100),
          value: s.uid,
        }))
      );
    }

    if (focused.name === 'evaluation') {
      const query = String(focused.value).toLowerCase();
      const choices = evals
        .upcoming()
        .filter((e) => `${e.matiere} ${e.titre}`.toLowerCase().includes(query))
        .slice(0, 25);
      return interaction.respond(
        choices.map((e) => ({ name: truncate(`#${e.id} · ${short(e.start)} · ${e.type} · ${e.titre}`, 100), value: e.id }))
      );
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ajouter') {
      const session = planning.getSession(interaction.options.getString('seance'));
      if (!session) {
        return interaction.reply({
          content: "Séance introuvable. Choisis une séance dans la liste proposée (après avoir choisi la matière).",
          flags: MessageFlags.Ephemeral,
        });
      }

      const evaluation = evals.add({
        session,
        type: interaction.options.getString('type'),
        titre: interaction.options.getString('titre'),
        description: interaction.options.getString('details'),
        createdBy: interaction.user.id,
      });

      const embed = evalEmbed(evaluation, { title: '✨ Nouvelle évaluation' }).setFooter({
        text: `Éval #${evaluation.id} · ajoutée par ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'supprimer') {
      const removed = evals.remove(interaction.options.getInteger('evaluation'));
      if (!removed) {
        return interaction.reply({ content: 'Évaluation introuvable.', flags: MessageFlags.Ephemeral });
      }
      const embed = evalEmbed(removed, { title: '🗑️ Supprimée' }).setColor(0x4e5058);
      embed.setDescription(`~~${removed.titre}~~ n'aura plus lieu (ou a été retirée du calendrier).`);
      return interaction.reply({ embeds: [embed] });
    }
  },
};
