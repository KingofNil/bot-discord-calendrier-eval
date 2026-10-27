const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Répond avec Pong ! et la latence du bot'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pong !', withResponse: true });
    const roundtrip = sent.resource.message.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(
      `🏓 Pong ! Latence : ${roundtrip} ms | WebSocket : ${interaction.client.ws.ping} ms`
    );
  },
};
