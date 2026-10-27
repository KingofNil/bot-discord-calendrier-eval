const fs = require('node:fs');
const path = require('node:path');

// Charge tous les fichiers de src/commands qui exportent { data, execute }
function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commands = [];

  for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
      commands.push(command);
    } else {
      console.warn(`[AVERTISSEMENT] ${file} n'exporte pas "data" et "execute".`);
    }
  }

  return commands;
}

module.exports = { loadCommands };
