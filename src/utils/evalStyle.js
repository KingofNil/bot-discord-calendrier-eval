// Apparence de chaque type d'évaluation
const STYLES = {
  Partiel: { emoji: '🔴', hex: '#ed4245', label: 'Partiel' },
  'Contrôle': { emoji: '🟠', hex: '#f0883e', label: 'Contrôle' },
  QCM: { emoji: '🟡', hex: '#e5b800', label: 'QCM' },
  'Oral / Soutenance': { emoji: '🟣', hex: '#9b59b6', label: 'Oral' },
  'Rendu de projet': { emoji: '🔵', hex: '#3498db', label: 'Rendu' },
  Autre: { emoji: '⚪', hex: '#99aab5', label: 'Éval' },
};

function typeStyle(type) {
  const style = STYLES[type] || STYLES.Autre;
  return { ...style, color: parseInt(style.hex.slice(1), 16) };
}

module.exports = { STYLES, typeStyle };
