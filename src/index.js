require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const { loadCommands } = require('./loadCommands');

const planning = require('./planning');
const guilds = require('./guilds');
const reminders = require('./reminders');

const { DISCORD_TOKEN, ICS_URL, GUILD_ID } = process.env;

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN doit être renseigné dans le fichier .env');
  process.exit(1);
}

// Migration de l'ancienne configuration mono-serveur (ICS_URL + GUILD_ID dans le .env)
if (ICS_URL && GUILD_ID && !guilds.get(GUILD_ID)) {
  guilds.setIcsUrl(GUILD_ID, ICS_URL, null);
  console.log(`Planning du .env associé au serveur ${GUILD_ID}.`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
for (const command of loadCommands()) {
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Connecté en tant que ${readyClient.user.tag} sur ${readyClient.guilds.cache.size} serveur(s)`);
  reminders.start(readyClient);
});

client.on(Events.GuildCreate, (guild) => {
  console.log(`Ajouté au serveur "${guild.name}" (${guild.id})`);
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
