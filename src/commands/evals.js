const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const planning = require('../planning');
const evals = require('../evals');
const { discordTs, hm, ymd, mondayOf, addDays } = require('../utils/dates');
const { STYLES, typeStyle, evalEmbed } = require('../utils/evalStyle');

// Discord limite à 10 embeds par message : 1 résumé + 3 cartes détaillées
const DETAILED = 3;
const MAX_LIST = 25;

function weekGroup(start) {
  const day = ymd(start);
  if (day < mondayOf(1)) return 'Cette semaine';
  if (day < mondayOf(2)) return 'Semaine prochaine';
  if (day < addDays(mondayOf(0), 31)) return 'Ce mois-ci';
  return 'Plus tard';
}

function summaryEmbed(list, matiere) {
  const embed = new EmbedBuilder()
    .setColor(list.length ? typeStyle(list[0].type).color : 0x57f287)
    .setTitle(matiere ? `📚 Évaluations à venir · ${matiere}`.slice(0, 256) : '📚 Évaluations à venir');

  if (list.length === 0) {
    return embed.setDescription('Aucune évaluation prévue pour le moment. 🎉\nProfites-en !');
  }

  // Compteurs par type
  const counts = Object.keys(STYLES)
    .map((t) => [t, list.filter((e) => e.type === t).length])
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${STYLES[t].emoji} ${n} ${t}`);

  const next = list[0];
  const lines = [
    `**${list.length}** évaluation(s) · ${counts.join(' · ')}`,
    '',
    `➡️ Prochaine : **${next.titre}** ${discordTs(next.start, 'R')}`,
  ];
  embed.setDescription(lines.join('\n'));

  // Les autres évals, regroupées par période
  const rest = list.slice(DETAILED, MAX_LIST);
  const groups = new Map();
  for (const e of rest) {
    const g = weekGroup(e.start);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(e);
  }
  for (const [name, items] of groups) {
    const value = items
      .map((e) => `${typeStyle(e.type).emoji} ${discordTs(e.start, 'd')} · \`${hm(e.start)}\` **${e.titre}** — ${e.matiere}`)
      .join('\n');
    embed.addFields({ name: `🗓️ ${name}`, value: value.slice(0, 1024) });
  }
  if (list.length > MAX_LIST) {
    embed.setFooter({ text: `+ ${list.length - MAX_LIST} autre(s) — filtre par matière pour les voir` });
  }
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evals')
    .setDescription('Voir les évaluations à venir')
    .addStringOption((o) => o.setName('matiere').setDescription('Filtrer par matière').setAutocomplete(true)),

  async autocomplete(interaction) {
    const query = interaction.options.getFocused().toLowerCase();
    const matieres = planning.getMatieres().filter((m) => m.toLowerCase().includes(query));
    await interaction.respond(matieres.slice(0, 25).map((m) => ({ name: m.slice(0, 100), value: m.slice(0, 100) })));
  },

  async execute(interaction) {
    const matiere = interaction.options.getString('matiere');
    const list = evals.upcoming().filter((e) => !matiere || e.matiere.slice(0, 100) === matiere);

    // Les 3 prochaines en cartes détaillées, le reste en liste compacte
    const embeds = [summaryEmbed(list, matiere), ...list.slice(0, DETAILED).map((e) => evalEmbed(e))];
    await interaction.reply({ embeds });
  },
};
