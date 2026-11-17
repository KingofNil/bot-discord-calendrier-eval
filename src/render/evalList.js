const { createCanvas } = require('@napi-rs/canvas');
const { hm, countdown } = require('../utils/dates');
const { STYLES, typeStyle } = require('../utils/evalStyle');
const { FONT, SCALE, COLORS, roundRect, fit, pill } = require('./common');
const { urgencyColor } = require('./evalCard');

const TZ = 'Europe/Paris';
const dayFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, month: 'short' });
const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'short' });

const W = 900;
const X = 36; // marge intérieure
const ROW_H = 74;
const GROUP_H = 40;
const MAX_ROWS = 12;

/**
 * Image de la liste des évaluations à venir.
 * items : évaluations triées, chacune avec un champ `group` (ex. 'Cette semaine')
 */
function renderEvalList(items, { matiere } = {}) {
  const shown = items.slice(0, MAX_ROWS);
  const groups = new Set(shown.map((e) => e.group)).size;
  const more = items.length - shown.length;

  const headerH = 130;
  const bodyH = shown.length ? shown.length * ROW_H + groups * GROUP_H : 140;
  const H = 8 + headerH + bodyH + (more > 0 ? 44 : 0) + 30 + 8;

  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 8, 8, W - 16, H - 16, 18);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();

  // Halo dans la couleur de la prochaine éval
  ctx.save();
  roundRect(ctx, 8, 8, W - 16, H - 16, 18);
  ctx.clip();
  const color = shown.length ? typeStyle(shown[0].type).hex : '#3ba55c';
  const glow = ctx.createRadialGradient(120, 40, 10, 120, 40, 520);
  glow.addColorStop(0, `${color}38`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // --- En-tête ---
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText('Évaluations à venir', X, 36);
  if (matiere) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `17px ${FONT}`;
    ctx.fillText(fit(ctx, matiere, W - 2 * X), X, 74);
  }

  // Compteurs par type
  let px = X;
  const py = matiere ? 100 : 84;
  if (items.length) {
    px += pill(ctx, px, py, `${items.length} ÉVALUATION${items.length > 1 ? 'S' : ''}`, { bg: COLORS.panelLight, color: COLORS.text, h: 26 }) + 8;
    for (const type of Object.keys(STYLES)) {
      const n = items.filter((e) => e.type === type).length;
      if (n) px += pill(ctx, px, py, `${n} ${STYLES[type].label.toUpperCase()}`, { bg: STYLES[type].hex, h: 26 }) + 8;
    }
  }

  let y = 8 + headerH + (matiere ? 16 : 0);

  // --- État vide ---
  if (!shown.length) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('Aucune évaluation prévue pour le moment', W / 2, y + 30);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `17px ${FONT}`;
    ctx.fillText('Profites-en !', W / 2, y + 68);
    return canvas.toBuffer('image/png');
  }

  // --- Lignes ---
  let currentGroup = null;
  for (const e of shown) {
    if (e.group !== currentGroup) {
      currentGroup = e.group;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.muted;
      ctx.font = `bold 13px ${FONT}`;
      const label = currentGroup.toUpperCase();
      ctx.fillText(label, X, y + GROUP_H / 2 + 4);
      const lw = ctx.measureText(label).width;
      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(X + lw + 12, y + GROUP_H / 2 + 4, W - 2 * X - lw - 12, 1);
      y += GROUP_H;
    }

    const style = typeStyle(e.type);
    const rowY = y + 4;
    const rowH = ROW_H - 8;
    roundRect(ctx, X, rowY, W - 2 * X, rowH, 14);
    ctx.fillStyle = COLORS.panelLight;
    ctx.fill();

    // Pastille date
    const dw = 58;
    roundRect(ctx, X + 6, rowY + 6, dw, rowH - 12, 10);
    ctx.fillStyle = style.hex;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold 10px ${FONT}`;
    ctx.fillText(weekdayFmt.format(e.start).replace('.', '').toUpperCase(), X + 6 + dw / 2, rowY + 17);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(dayFmt.format(e.start), X + 6 + dw / 2, rowY + rowH / 2 + 1);
    ctx.font = `bold 10px ${FONT}`;
    ctx.fillText(monthFmt.format(e.start).replace('.', '').toUpperCase(), X + 6 + dw / 2, rowY + rowH - 16);

    // Compte à rebours à droite
    const cd = countdown(e.start).toUpperCase();
    ctx.font = `bold 12px ${FONT}`;
    const cw = ctx.measureText(cd).width + 20;
    pill(ctx, W - X - 14 - cw, rowY + rowH / 2 - 12, cd, { bg: urgencyColor(e.start), h: 24 });

    // Titre + détails
    const tx = X + 6 + dw + 16;
    const tw = W - X - 14 - cw - 16 - tx;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillStyle = style.hex;
    const typeLabel = style.label.toUpperCase();
    ctx.fillText(typeLabel, tx, rowY + 11);
    const typeW = ctx.measureText(typeLabel).width;
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(fit(ctx, e.titre, tw - typeW - 10), tx + typeW + 10, rowY + 7);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `14px ${FONT}`;
    const details = [`${hm(e.start)} – ${hm(e.end)}`, e.salle, e.matiere].filter(Boolean).join('  ·  ');
    ctx.fillText(fit(ctx, details, tw), tx, rowY + 37);
    if (e.orpheline) {
      ctx.fillStyle = COLORS.warning;
      ctx.fillRect(X + W - 2 * X - 4, rowY + 10, 3, rowH - 20);
    }

    y += ROW_H;
  }

  if (more > 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`+ ${more} autre${more > 1 ? 's' : ''} — filtre par matière pour les voir`, W / 2, y + 24);
  }

  return canvas.toBuffer('image/png');
}

module.exports = { renderEvalList, MAX_ROWS };
