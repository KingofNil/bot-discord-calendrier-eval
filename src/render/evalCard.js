const { createCanvas } = require('@napi-rs/canvas');
const { hm, countdown } = require('../utils/dates');
const { typeStyle } = require('../utils/evalStyle');
const { FONT, SCALE, COLORS, roundRect, wrap, fit, pill } = require('./common');

const TZ = 'Europe/Paris';
const fmt = (options) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...options });
const weekdayFmt = fmt({ weekday: 'long' });
const dayFmt = fmt({ day: 'numeric' });
const monthFmt = fmt({ month: 'long' });
const yearFmt = fmt({ year: 'numeric' });

const GREY = '#4e5058';

const BANNERS = {
  nouvelle: { text: 'NOUVELLE ÉVALUATION', color: COLORS.accent },
  rappel: { text: 'RAPPEL', color: '#f23f43' },
  supprimee: { text: 'ÉVALUATION SUPPRIMÉE', color: GREY },
};

// Couleur du compte à rebours selon l'urgence
function urgencyColor(start) {
  const days = (start - Date.now()) / 86_400_000;
  if (days <= 2) return '#f23f43';
  if (days <= 7) return '#f0883e';
  return GREY;
}

// Police en gras réduite jusqu'à ce que le texte tienne dans maxWidth
function shrinkFont(ctx, text, size, maxWidth) {
  do {
    ctx.font = `bold ${size}px ${FONT}`;
  } while (ctx.measureText(text).width > maxWidth && --size > 9);
}

const W = 900;
const PAD = 28; // marge intérieure du panneau
const DATE_W = 150;
const CONTENT_X = PAD + 16 + DATE_W + 28;
const CONTENT_W = W - CONTENT_X - PAD - 16;

/**
 * Carte image d'une évaluation.
 * variant : 'nouvelle' | 'rappel' | 'supprimee' | undefined
 * label   : texte ajouté au bandeau (ex. 'DANS 7 JOURS')
 */
function renderEvalCard(evaluation, { variant, label } = {}) {
  const removed = variant === 'supprimee';
  const style = typeStyle(evaluation.type);
  const color = removed ? GREY : style.hex;
  const banner = BANNERS[variant];

  // --- Mise en page (mesures avant de dessiner, pour connaître la hauteur) ---
  const measure = createCanvas(1, 1).getContext('2d');
  measure.font = `bold 30px ${FONT}`;
  const titleLines = wrap(measure, evaluation.titre, CONTENT_W, 2);
  measure.font = `15px ${FONT}`;
  const descLines = evaluation.description ? wrap(measure, evaluation.description, CONTENT_W - 32, 3) : [];

  const top = 16 + (banner ? 58 : 26);
  let contentH = 26 + 14 + titleLines.length * 38 + 6 + 22 + 22 + 50; // pastilles, titre, matière, infos
  if (descLines.length) contentH += 16 + descLines.length * 22 + 24;
  if (evaluation.orpheline) contentH += 16 + 36;
  const bodyH = Math.max(contentH, DATE_W + 20);
  const H = top + bodyH + 28 + 46 + 16;

  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // --- Fond ---
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 8, 8, W - 16, H - 16, 18);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();

  // Halo de couleur du type en haut à gauche
  ctx.save();
  roundRect(ctx, 8, 8, W - 16, H - 16, 18);
  ctx.clip();
  const glow = ctx.createRadialGradient(PAD + 90, top + 40, 10, PAD + 90, top + 40, 420);
  glow.addColorStop(0, `${color}40`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // --- Bandeau ---
  if (banner) {
    let x = PAD + 16;
    x += pill(ctx, x, 30, banner.text, { bg: banner.color, font: `bold 13px ${FONT}`, h: 26, padX: 12 }) + 8;
    if (label) pill(ctx, x, 30, label, { bg: COLORS.panelLight, color: COLORS.text, font: `bold 13px ${FONT}`, h: 26, padX: 12 });
  }
  // Compte à rebours en haut à droite (le rappel l'indique déjà dans le bandeau)
  if (!removed && !label) {
    const text = countdown(evaluation.start).toUpperCase();
    ctx.font = `bold 13px ${FONT}`;
    const w = ctx.measureText(text).width + 24;
    pill(ctx, W - PAD - 16 - w, banner ? 30 : 22, text, { bg: urgencyColor(evaluation.start), font: `bold 13px ${FONT}`, h: 26, padX: 12 });
  }

  // --- Bloc date ---
  const dx = PAD + 16;
  const dy = top + 4;
  const grad = ctx.createLinearGradient(dx, dy, dx + DATE_W, dy + DATE_W);
  grad.addColorStop(0, color);
  grad.addColorStop(1, `${color}aa`);
  roundRect(ctx, dx, dy, DATE_W, DATE_W, 20);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  shrinkFont(ctx, weekdayFmt.format(evaluation.start).toUpperCase(), 15, DATE_W - 20);
  ctx.fillText(weekdayFmt.format(evaluation.start).toUpperCase(), dx + DATE_W / 2, dy + 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText(dayFmt.format(evaluation.start), dx + DATE_W / 2, dy + 78);
  const monthText = `${monthFmt.format(evaluation.start).toUpperCase()} ${yearFmt.format(evaluation.start)}`;
  shrinkFont(ctx, monthText, 15, DATE_W - 20);
  ctx.fillText(monthText, dx + DATE_W / 2, dy + 126);

  // --- Contenu ---
  const x = CONTENT_X;
  let y = top;

  pill(ctx, x, y, evaluation.type.toUpperCase(), { bg: color, font: `bold 12px ${FONT}`, h: 26, padX: 12 });
  y += 26 + 14;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = removed ? COLORS.muted : COLORS.text;
  ctx.font = `bold 30px ${FONT}`;
  for (const line of titleLines) {
    ctx.fillText(line, x, y);
    if (removed) {
      const w = ctx.measureText(line).width;
      ctx.fillRect(x, y + 19, w, 3);
    }
    y += 38;
  }
  y += 6;

  ctx.fillStyle = COLORS.muted;
  ctx.font = `17px ${FONT}`;
  ctx.fillText(fit(ctx, evaluation.matiere, CONTENT_W), x, y);
  y += 22 + 22;

  // Infos : horaire / salle / intervenant
  const infos = [
    ['HORAIRE', `${hm(evaluation.start)} – ${hm(evaluation.end)}`],
    ['SALLE', evaluation.salle || '—'],
  ];
  if (evaluation.intervenant) infos.push(['INTERVENANT', evaluation.intervenant]);
  const colW = CONTENT_W / infos.length;
  infos.forEach(([name, value], i) => {
    const cx = x + i * colW;
    ctx.fillStyle = COLORS.muted;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText(name, cx, y);
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(fit(ctx, value, colW - 16), cx, y + 18);
  });
  y += 50;

  // Détails
  if (descLines.length) {
    y += 16;
    const h = descLines.length * 22 + 24;
    roundRect(ctx, x, y, CONTENT_W, h, 12);
    ctx.fillStyle = COLORS.panelLight;
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, CONTENT_W, h, 12);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 4, h);
    ctx.restore();
    ctx.fillStyle = '#dbdee1';
    ctx.font = `15px ${FONT}`;
    descLines.forEach((line, i) => ctx.fillText(line, x + 18, y + 12 + i * 22));
    y += h;
  }

  // Séance disparue du planning
  if (evaluation.orpheline) {
    y += 16;
    roundRect(ctx, x, y, CONTENT_W, 36, 10);
    ctx.fillStyle = `${COLORS.warning}26`;
    ctx.fill();
    ctx.fillStyle = COLORS.warning;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Séance introuvable dans le planning (déplacée ou supprimée ?)', x + 14, y + 19);
    ctx.textBaseline = 'top';
  }

  // --- Pied ---
  const fy = H - 16 - 34;
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(PAD + 16, fy - 12, W - 2 * (PAD + 16), 1);
  ctx.textBaseline = 'middle';
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'left';
  ctx.fillText('Calendrier des évaluations', PAD + 16, fy + 10);
  ctx.textAlign = 'right';
  ctx.fillText(`Éval #${evaluation.id}`, W - PAD - 16, fy + 10);

  return canvas.toBuffer('image/png');
}

module.exports = { renderEvalCard, urgencyColor };
