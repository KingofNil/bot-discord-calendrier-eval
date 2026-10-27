require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./loadCommands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN et CLIENT_ID doivent être renseignés dans le fichier .env');
  process.exit(1);
}

const body = loadCommands().map((command) => command.data.toJSON());
const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    const data = await rest.put(route, { body });
    console.log(`${data.length} commande(s) enregistrée(s) ${GUILD_ID ? 'sur le serveur' : 'globalement'}.`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
