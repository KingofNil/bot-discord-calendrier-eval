// Tous les calculs de jours se font dans le fuseau de l'école
const TZ = 'Europe/Paris';

const ymdFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hmFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const shortFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });

// Date -> 'YYYY-MM-DD' (jour à Paris)
const ymd = (date) => ymdFormat.format(date);

// Date -> '08:30'
const hm = (date) => hmFormat.format(date);

// Date -> 'lun. 30/11 08:30'
const short = (date) => `${shortFormat.format(date)} ${hm(date)}`;

// Les helpers suivants manipulent des chaînes 'YYYY-MM-DD' sans fuseau
const ymdToDate = (s) => new Date(`${s}T12:00:00Z`);

function addDays(s, n) {
  const d = ymdToDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Lundi de la semaine courante (+ offset en semaines)
function mondayOf(offset = 0) {
  const today = ymd(new Date());
  const weekday = (ymdToDate(today).getUTCDay() + 6) % 7; // 0 = lundi
  return addDays(today, offset * 7 - weekday);
}

function dayLabel(s) {
  return ymdToDate(s).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
}

// Nombre de jours calendaires entre deux 'YYYY-MM-DD'
const daysBetween = (a, b) => Math.round((ymdToDate(b) - ymdToDate(a)) / 86_400_000);

// Écart (en minutes) entre l'heure de Paris et UTC à un instant donné
const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
});
function parisOffset(date) {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map(({ type, value }) => [type, Number(value)]));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
}

// 'YYYY-MM-DD' + 'HH:MM' (heure de Paris) -> Date (gère l'heure d'été)
function parisDate(day, time) {
  const guess = new Date(`${day}T${time}:00Z`);
  let date = new Date(guess.getTime() - parisOffset(guess) * 60_000);
  const offset = parisOffset(date);
  if (date.getTime() !== guess.getTime() - offset * 60_000) date = new Date(guess.getTime() - offset * 60_000);
  return date;
}

// 'Aujourd'hui', 'Demain', 'J-5'… (en jours calendaires, à Paris)
function countdown(start, now = new Date()) {
  const n = daysBetween(ymd(now), ymd(start));
  if (n < 0) return 'Passée';
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  return `J-${n}`;
}

// Timestamp Discord, affiché dans le fuseau de chaque utilisateur
const discordTs = (date, style = 'F') => `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;

module.exports = { ymd, hm, short, addDays, mondayOf, dayLabel, discordTs, daysBetween, parisDate, countdown };
