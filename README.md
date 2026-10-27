# 📚 Bot Discord — Calendrier des évaluations

Bot Discord qui maintient le calendrier des évaluations d'une classe, synchronisé avec l'emploi du temps **Hyperplanning** (lien iCal).

- Les **admins** ajoutent les évaluations directement sur une séance du planning.
- Les **élèves** consultent les évaluations à venir et l'emploi du temps de la semaine, rendu en image.
- Si une séance est déplacée sur Hyperplanning, l'évaluation suit automatiquement.

## Commandes

| Commande | Accès | Description |
| --- | --- | --- |
| `/ping` | Tous | Vérifie que le bot répond (latence). |
| `/evals [matiere]` | Tous | Évaluations à venir : résumé, cartes détaillées des 3 prochaines, puis liste groupée par période. |
| `/calendrier [semaine]` | Tous | Image de l'emploi du temps de la semaine avec les évaluations mises en évidence. Boutons ◀️ 📍 ▶️ pour naviguer. |
| `/eval ajouter matiere seance type titre [details]` | Admin | Ajoute une évaluation sur une séance (matière et séance proposées en autocomplétion depuis le planning). |
| `/eval supprimer evaluation` | Admin | Supprime une évaluation. |

`/eval` est réservée par défaut aux membres ayant la permission **Gérer le serveur**. C'est modifiable dans *Paramètres du serveur → Intégrations*.

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
| `GUILD_ID` | *(optionnel)* Clic droit sur le serveur → *Copier l'identifiant* (mode développeur activé). Si renseigné, les commandes sont disponibles immédiatement sur ce serveur ; sinon elles sont globales (jusqu'à 1 h de délai). |
| `ICS_URL` | Hyperplanning → *Emploi du temps* → icône d'export iCal → copier le lien |

> ⚠️ Le lien iCal contient une clé d'accès personnelle : ne le partage pas et ne le commite pas (le `.env` est ignoré par git).

### Inviter le bot

Developer Portal → **OAuth2 → URL Generator** → cocher les scopes `bot` et `applications.commands`, puis ouvrir l'URL générée.

### Lancer

```bash
npm run deploy   # enregistre les slash commands (à refaire après chaque ajout/modification de commande)
npm start        # démarre le bot
```

## Fonctionnement

- Le planning est téléchargé au démarrage puis **toutes les 30 minutes**. En cas d'échec, le dernier planning chargé est conservé.
- Les évaluations sont stockées dans `data/evals.json` (créé automatiquement, ignoré par git). Chaque évaluation est liée à l'UID d'une séance Hyperplanning. Si la séance disparaît du planning, l'évaluation reste affichée avec un avertissement ⚠️.
- Les dates sont calculées dans le fuseau `Europe/Paris`. Dans les messages, elles utilisent les timestamps Discord, affichés dans le fuseau de chaque utilisateur.

## Structure

```
src/
  index.js              démarrage du bot, routage des commandes / autocomplétion / boutons
  deploy-commands.js    enregistrement des slash commands
  loadCommands.js       chargement automatique de src/commands
  planning.js           téléchargement et parsing de l'iCal Hyperplanning
  evals.js              stockage des évaluations (JSON)
  commands/             une commande par fichier (ping, eval, evals, calendrier)
  render/week.js        rendu de l'emploi du temps en image (@napi-rs/canvas)
  utils/                dates (fuseau Paris) et style des évaluations
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
