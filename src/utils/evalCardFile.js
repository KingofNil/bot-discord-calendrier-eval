const { AttachmentBuilder } = require('discord.js');
const { renderEvalCard } = require('../render/evalCard');

// Carte d'une évaluation, prête à joindre à un message
const cardFile = (evaluation, options) =>
  new AttachmentBuilder(renderEvalCard(evaluation, options), { name: `eval-${evaluation.id}.png` });

module.exports = { cardFile };
