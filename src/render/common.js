// Éléments partagés par les rendus canvas (thème sombre façon Discord)

// Pas d'emoji dans les images : le VPS n'a pas de police emoji
const FONT = '"Segoe UI", "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
const SCALE = 2; // rendu net sur les écrans haute densité

const COLORS = {
  bg: '#1e1f22',
  panel: '#2b2d31',
  panelLight: '#313338',
  grid: '#3f4147',
  gridLight: '#35373c',
  text: '#f2f3f5',
  muted: '#949ba4',
  accent: '#5865f2',
  now: '#f23f43',
  warning: '#f0b232',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Découpe un texte en lignes qui tiennent dans maxWidth (ellipse sur la dernière)
function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  // Mot trop long pour une ligne : on le coupe
  for (let i = 0; i < lines.length; i++) {
    while (lines[i].length > 1 && ctx.measureText(lines[i]).width > maxWidth) lines[i] = lines[i].slice(0, -1);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

// Texte tronqué sur une seule ligne
const fit = (ctx, text, maxWidth) => wrap(ctx, text, maxWidth, 1)[0] || '';

// Pastille arrondie avec texte ; renvoie sa largeur
function pill(ctx, x, y, text, { bg, color = '#ffffff', font = `bold 12px ${FONT}`, h = 22, padX = 10 } = {}) {
  ctx.font = font;
  const w = ctx.measureText(text).width + padX * 2;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  return w;
}

module.exports = { FONT, SCALE, COLORS, roundRect, wrap, fit, pill };
