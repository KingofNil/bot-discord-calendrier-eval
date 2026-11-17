# 📚 Bot Discord — Calendrier des évaluations

Bot Discord qui maintient le calendrier des évaluations d'une classe, synchronisé avec l'emploi du temps **Hyperplanning** (lien iCal).

- Les **admins** ajoutent les évaluations directement sur une séance du planning.
- Les **élèves** consultent les évaluations à venir et l'emploi du temps de la semaine, rendu en image.
- Si une séance est déplacée sur Hyperplanning, l'évaluation suit automatiquement.
- **Multi-serveur** : chaque serveur Discord a son propre emploi du temps et ses propres évaluations.

## Commandes

| Commande | Accès | Description |
| --- | --- | --- |
| `/ping` | Tous | Vérifie que le bot répond (latence). |
| `/config planning lien` | Admin | Lie le serveur à un emploi du temps Hyperplanning (lien iCal). Le lien est vérifié avant d'être enregistré. |
| `/config voir` | Tous | Affiche la configuration du serveur (lien masqué, nombre de séances, dernière mise à jour). |
| `/evals [matiere]` | Tous | Évaluations à venir : résumé, cartes détaillées des 3 prochaines, puis liste groupée par période. |
| `/calendrier [semaine]` | Tous | Image de l'emploi du temps de la semaine avec les évaluations mises en évidence. Boutons ◀️ 📍 ▶️ pour naviguer. |
| `/eval ajouter matiere seance type titre [details]` | Tous | Ajoute une évaluation sur une séance (matière et séance proposées en autocomplétion depuis le planning). |
| `/eval supprimer evaluation` | Tous | Supprime une évaluation. |

Toutes les commandes sont accessibles à tous les membres, sauf `/config planning`, réservée aux membres ayant la permission **Gérer le serveur** et aux IDs listés dans `BOT_ADMINS` (autorisés sur tous les serveurs).

Types d'évaluation : 🔴 Partiel · 🟠 Contrôle · 🟡 QCM · 🟣 Oral / Soutenance · 🔵 Rendu de projet · ⚪ Autre

## Installation

Prérequis : **Node.js 22+**

```bash
git clone https://github.com/KingofNil/bot-discord-calendrier-eval.git
cd bot-discord-calendrier-eval
npm install
cp .env.example .env
```

Complète ensuite le fichier `.env` :

| Variable | Où la trouver |
| --- | --- |
| `DISCORD_TOKEN` | [Developer Portal](https://discord.com/developers/applications) → ton application → **Bot** → *Reset Token* |
| `CLIENT_ID` | Developer Portal → **General Information** → *Application ID* |
| `GUILD_ID` | *(optionnel, dev)* Clic droit sur le serveur → *Copier l'identifiant* (mode développeur activé). Si renseigné, `npm run deploy` enregistre les commandes uniquement sur ce serveur (disponibles immédiatement). Laisse-le vide pour un usage multi-serveur. |
| `ICS_URL` | *(optionnel, ancien mode)* Si `ICS_URL` et `GUILD_ID` sont renseignés, ce planning est associé automatiquement à ce serveur au démarrage. |
| `BOT_ADMINS` | *(optionnel)* IDs Discord (séparés par des virgules) autorisés à utiliser `/config planning` sur tous les serveurs. |

Le planning de chaque serveur se configure ensuite directement dans Discord avec `/config planning`, en collant le lien d'export iCal (Hyperplanning → *Emploi du temps* → icône d'export iCal).

> ⚠️ Le lien iCal contient une clé d'accès personnelle : la réponse de `/config` est privée et le lien est stocké dans `data/` (ignoré par git).

### Inviter le bot

Developer Portal → **OAuth2 → URL Generator** → cocher les scopes `bot` et `applications.commands`, puis ouvrir l'URL générée.

### Lancer

```bash
npm run deploy              # enregistre les slash commands (à refaire après chaque ajout/modification de commande)
npm run deploy -- --global  # force l'enregistrement global même si GUILD_ID est renseigné (et retire les doublons du serveur de dev)
npm start                   # démarre le bot
```

Puis, sur chaque serveur : `/config planning lien:<lien iCal>`.

## Déploiement sur un VPS

Le bot tourne avec [pm2](https://pm2.keymetrics.io) (`ecosystem.config.js`). À chaque push sur `main`, le workflow GitHub Actions `.github/workflows/deploy.yml` se connecte au VPS en SSH, récupère le code, installe les dépendances, enregistre les commandes et redémarre le bot.

Secrets à créer dans GitHub → *Settings → Secrets and variables → Actions* :

| Secret | Valeur |
| --- | --- |
| `VPS_HOST` | IP ou nom de domaine du VPS |
| `VPS_USER` | utilisateur SSH (ex. `half`) |
| `VPS_SSH_KEY` | clé privée SSH dont la clé publique est dans `~/.ssh/authorized_keys` du VPS |
| `VPS_PORT` | *(optionnel)* port SSH, 22 par défaut |

Le bot est attendu dans `~/bot-discord-calendrier-eval`, avec son `.env` et son dossier `data/` (jamais modifiés par le déploiement).

Commandes utiles sur le VPS : `pm2 logs bot-calendrier`, `pm2 restart bot-calendrier`, `pm2 status`.

## Fonctionnement

- La configuration de chaque serveur (lien iCal) est stockée dans `data/guilds.json`.
- Les plannings sont téléchargés au démarrage puis **toutes les 30 minutes** (une seule fois par lien, même s'il est partagé par plusieurs serveurs). En cas d'échec, le dernier planning chargé est conservé.
- Les évaluations sont stockées par serveur dans `data/evals.json` (créé automatiquement, ignoré par git), avec une numérotation propre à chaque serveur. Chaque évaluation est liée à l'UID d'une séance Hyperplanning. Si la séance disparaît du planning, l'évaluation reste affichée avec un avertissement ⚠️.
- L'ancien format mono-serveur de `data/evals.json` est migré automatiquement vers le serveur `GUILD_ID`.
- Les dates sont calculées dans le fuseau `Europe/Paris`. Dans les messages, elles utilisent les timestamps Discord, affichés dans le fuseau de chaque utilisateur.

## Structure

```
src/
  index.js              démarrage du bot, routage des commandes / autocomplétion / boutons
  deploy-commands.js    enregistrement des slash commands
  loadCommands.js       chargement automatique de src/commands
  planning.js           téléchargement et parsing des iCal Hyperplanning (cache par lien)
  guilds.js             configuration par serveur (lien iCal)
  evals.js              stockage des évaluations par serveur (JSON)
  store.js              lecture / écriture atomique des fichiers JSON
  commands/             une commande par fichier (ping, config, eval, evals, calendrier)
  render/week.js        rendu de l'emploi du temps en image (@napi-rs/canvas)
  utils/                dates (fuseau Paris), style des évaluations, vérification de la config
```

### Ajouter une commande

Crée un fichier dans `src/commands/` qui exporte :

```js
module.exports = {
  data: new SlashCommandBuilder().setName('nom').setDescription('...'),
  async execute(interaction) { /* ... */ },
  async autocomplete(interaction) { /* optionnel */ },
  async handleButton(interaction) { /* optionnel, customId "nom:..." */ },
};
```

puis lance `npm run deploy`.

## Stack

[discord.js](https://discord.js.org) v14 · [node-ical](https://github.com/jens-maus/node-ical) · [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) · dotenv
