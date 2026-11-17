// Configuration pm2 : pm2 startOrReload ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'bot-calendrier',
      script: 'src/index.js',
      cwd: __dirname, // dotenv lit le .env du dossier courant
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: '300M',
      time: true, // horodatage dans les logs
      env: { NODE_ENV: 'production' },
    },
  ],
};
