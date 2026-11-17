const { SlashCommandBuilder, AttachmentBuilder, InteractionContextType } = require('discord.js');
const planning = require('../planning');
const evals = require('../evals');
const { ymd, mondayOf, addDays } = require('../utils/dates');
const { requirePlanning } = require('../utils/guard');
const { renderEvalList } = require('../render/evalList');

function weekGroup(start) {
  const day = ymd(start);
  if (day < mondayOf(1)) return 'Cette semaine';
  if (day < mondayOf(2)) return 'Semaine prochaine';
  if (day < addDays(mondayOf(0), 31)) return 'Ce mois-ci';
  return 'Plus tard';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evals')
    .setDescription('Voir les évaluations à venir')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('matiere').setDescription('Filtrer par matière').setAutocomplete(true)),

  async autocomplete(interaction) {
    const query = interaction.options.getFocused().toLowerCase();
    const matieres = planning.getMatieres(interaction.guildId).filter((m) => m.toLowerCase().includes(query));
    await interaction.respond(matieres.slice(0, 25).map((m) => ({ name: m.slice(0, 100), value: m.slice(0, 100) })));
  },

  async execute(interaction) {
    if (!(await requirePlanning(interaction))) return;
    const matiere = interaction.options.getString('matiere');
    const list = evals
      .upcoming(interaction.guildId)
      .filter((e) => !matiere || e.matiere.slice(0, 100) === matiere)
      .map((e) => ({ ...e, group: weekGroup(e.start) }));

    const image = new AttachmentBuilder(renderEvalList(list, { matiere }), { name: 'evaluations.png' });
    await interaction.reply({ files: [image] });
  },
};
