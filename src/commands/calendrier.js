const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const planning = require('../planning');
const evals = require('../evals');
const { ymd, hm, addDays, mondayOf, dayLabel, discordTs } = require('../utils/dates');
const { typeStyle } = require('../utils/evalStyle');
const { renderWeek } = require('../render/week');

function buildWeek(offset) {
  const monday = mondayOf(offset);
  const sunday = addDays(monday, 6);
  const sessions = planning.getSessions().filter((s) => {
    const day = ymd(s.start);
    return day >= monday && day <= sunday;
  });

  const evalsBySession = new Map();
  for (const e of evals.all()) {
    if (!evalsBySession.has(e.sessionUid)) evalsBySession.set(e.sessionUid, []);
    evalsBySession.get(e.sessionUid).push(e);
  }
  const weekEvals = sessions.flatMap((s) => evalsBySession.get(s.uid) || []);

  const image = new AttachmentBuilder(renderWeek({ monday, sessions, evalsBySession }), { name: 'semaine.png' });

  const label = offset === 0 ? 'Cette semaine' : offset === 1 ? 'Semaine prochaine' : offset === -1 ? 'Semaine dernière' : null;
  const embed = new EmbedBuilder()
    .setColor(weekEvals.length ? typeStyle(weekEvals[0].type).color : 0x5865f2)
    .setTitle(`🗓️ ${label ? `${label} · ` : ''}du ${dayLabel(monday)} au ${dayLabel(sunday)}`)
    .setImage('attachment://semaine.png');

  if (weekEvals.length) {
    embed.setDescription(
      [
        `**${weekEvals.length} évaluation(s) cette semaine**`,
        ...weekEvals.map(
          (e) => `${typeStyle(e.type).emoji} ${discordTs(e.start, 'F')} · **${e.titre}** — ${e.matiere}${e.salle ? ` · 📍 ${e.salle}` : ''}`
        ),
      ]
        .join('\n')
        .slice(0, 4096)
    );
  } else {
    const nbCours = sessions.filter((s) => !s.allDay).length;
    embed.setDescription(nbCours ? `✅ Aucune évaluation · ${nbCours} cours` : '😴 Aucun cours cette semaine.');
  }
  const updated = planning.getLastUpdate();
  if (updated) embed.setFooter({ text: `Planning Hyperplanning · mis à jour à ${hm(updated)}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`calendrier:${offset - 1}`).setEmoji('◀️').setLabel('Précédente').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('calendrier:0:today')
      .setEmoji('📍')
      .setLabel("Aujourd'hui")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(offset === 0),
    new ButtonBuilder().setCustomId(`calendrier:${offset + 1}`).setEmoji('▶️').setLabel('Suivante').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row], files: [image] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calendrier')
    .setDescription('Afficher le planning de la semaine avec les évaluations')
    .addIntegerOption((o) =>
      o
        .setName('semaine')
        .setDescription('0 = cette semaine, 1 = semaine prochaine, -1 = semaine dernière…')
        .setMinValue(-52)
        .setMaxValue(52)
    ),

  buildWeek,

  async execute(interaction) {
    await interaction.reply(buildWeek(interaction.options.getInteger('semaine') ?? 0));
  },

  // customId : "calendrier:<offset>"
  async handleButton(interaction) {
    const offset = Number(interaction.customId.split(':')[1]);
    // attachments: [] remplace l'ancienne image au lieu de l'empiler
    await interaction.update({ ...buildWeek(offset), attachments: [] });
  },
};
