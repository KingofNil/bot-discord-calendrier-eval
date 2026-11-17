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

// --global : enregistre les commandes sur tous les serveurs, même si GUILD_ID est renseigné
const global = process.argv.includes('--global') || !GUILD_ID;

(async () => {
  try {
    if (global) {
      const data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
      console.log(`${data.length} commande(s) enregistrée(s) globalement (jusqu'à 1 h de délai).`);
      // Évite les doublons sur le serveur de dev
      if (GUILD_ID) {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
        console.log(`Commandes propres au serveur ${GUILD_ID} supprimées.`);
      }
    } else {
      const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
      console.log(`${data.length} commande(s) enregistrée(s) sur le serveur ${GUILD_ID} uniquement.`);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
