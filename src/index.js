require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const { loadCommands } = require('./loadCommands');

const planning = require('./planning');

const { DISCORD_TOKEN, ICS_URL } = process.env;

if (!DISCORD_TOKEN || !ICS_URL) {
  console.error('DISCORD_TOKEN et ICS_URL doivent être renseignés dans le fichier .env');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
for (const command of loadCommands()) {
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Connecté en tant que ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    try {
      await command?.autocomplete?.(interaction);
    } catch (error) {
      console.error(error);
    }
    return;
  }

  // Les boutons ont un customId de la forme "<commande>:<données>"
  if (interaction.isButton()) {
    const command = client.commands.get(interaction.customId.split(':')[0]);
    try {
      await command?.handleButton?.(interaction);
    } catch (error) {
      console.error(error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`Aucune commande "${interaction.commandName}" trouvée.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const payload = { content: 'Une erreur est survenue lors de l\'exécution de la commande.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

planning.startAutoRefresh().then(() => client.login(DISCORD_TOKEN));
