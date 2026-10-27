const { createCanvas } = require('@napi-rs/canvas');
const { ymd, hm, addDays, dayLabel } = require('../utils/dates');
const { typeStyle } = require('../utils/evalStyle');

const FONT = '"Segoe UI", Arial, sans-serif';
const SCALE = 2; // rendu net sur les écrans haute densité

const COLORS = {
  bg: '#1e1f22',
  panel: '#2b2d31',
  grid: '#3f4147',
  gridLight: '#35373c',
  text: '#f2f3f5',
  muted: '#949ba4',
  accent: '#5865f2',
  now: '#f23f43',
};

// Palette des matières (attribuée de façon stable via un hash du nom)
const PALETTE = ['#5865f2', '#3ba55c', '#faa61a', '#eb459e', '#00a8fc', '#9b59b6', '#1abc9c', '#e67e22', '#57f287', '#ed4245', '#f47fff', '#45ddc0'];

function colorFor(name) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const minutes = (date) => {
  const [h, m] = hm(date).split(':').map(Number);
  return h * 60 + m;
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Découpe un texte en lignes qui tiennent dans maxWidth (ellipse sur la dernière)
function wrap(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
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

  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

/**
 * Dessine la semaine qui commence au lundi `monday` (YYYY-MM-DD).
 * sessions : séances de la semaine ; evalsBySession : Map(uid -> évals)
 */
function renderWeek({ monday, sessions, evalsBySession }) {
  const today = ymd(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  // Samedi / dimanche affichés seulement s'ils contiennent des cours
  const visibleDays = days.filter((d, i) => i < 5 || sessions.some((s) => !s.allDay && ymd(s.start) === d));

  const timed = sessions.filter((s) => !s.allDay);
  const startHour = Math.min(8, ...timed.map((s) => Math.floor(minutes(s.start) / 60)));
  const endHour = Math.max(18, ...timed.map((s) => Math.ceil(minutes(s.end) / 60)));

  const timeColW = 56;
  const dayW = 210;
  const headerH = 56;
  const hourH = 64;
  const pad = 16;
  const width = pad * 2 + timeColW + dayW * visibleDays.length;
  const height = pad * 2 + headerH + hourH * (endHour - startHour);

  const canvas = createCanvas(width * SCALE, height * SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // Fond
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
  roundRect(ctx, pad / 2, pad / 2, width - pad, height - pad, 14);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();

  const gridX = pad + timeColW;
  const gridY = pad + headerH;
  const gridBottom = gridY + hourH * (endHour - startHour);
  const yFor = (min) => gridY + ((min - startHour * 60) / 60) * hourH;

  // Lignes des heures
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `12px ${FONT}`;
  for (let h = startHour; h <= endHour; h++) {
    const y = gridY + (h - startHour) * hourH;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gridX, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`${String(h).padStart(2, '0')}:00`, gridX - 10, y);

    if (h < endHour) {
      ctx.strokeStyle = COLORS.gridLight;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(gridX, y + hourH / 2);
      ctx.lineTo(width - pad, y + hourH / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  visibleDays.forEach((day, i) => {
    const x = gridX + i * dayW;
    const isToday = day === today;
    const daySessions = sessions.filter((s) => ymd(s.start) === day);
    const holiday = daySessions.find((s) => s.allDay);

    // Séparateur de colonne
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(x, gridY);
    ctx.lineTo(x, gridBottom);
    ctx.stroke();

    // En-tête du jour
    if (isToday) {
      roundRect(ctx, x + 6, pad + 2, dayW - 12, headerH - 8, 10);
      ctx.fillStyle = COLORS.accent;
      ctx.fill();
      ctx.fillStyle = 'rgba(88, 101, 242, 0.08)';
      ctx.fillRect(x, gridY, dayW, gridBottom - gridY);
    }
    const [weekday, ...rest] = dayLabel(day).split(' ');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(weekday.charAt(0).toUpperCase() + weekday.slice(1), x + dayW / 2, pad + 17);
    ctx.fillStyle = isToday ? COLORS.text : COLORS.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(rest.join(' '), x + dayW / 2, pad + 35);

    // Jour férié : colonne hachurée
    if (holiday) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, gridY, dayW, gridBottom - gridY);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 8;
      for (let k = -gridBottom; k < dayW + gridBottom; k += 24) {
        ctx.beginPath();
        ctx.moveTo(x + k, gridY);
        ctx.lineTo(x + k + (gridBottom - gridY), gridBottom);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = COLORS.muted;
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillText(holiday.matiere.toUpperCase(), x + dayW / 2, (gridY + gridBottom) / 2);
    }

    // Cours
    for (const s of daySessions.filter((d) => !d.allDay)) {
      const evs = evalsBySession.get(s.uid) || [];
      const top = yFor(minutes(s.start)) + 3;
      const h = yFor(minutes(s.end)) - top - 3;
      const bx = x + 6;
      const bw = dayW - 12;
      const color = evs.length ? typeStyle(evs[0].type).hex : colorFor(s.matiereBase);

      roundRect(ctx, bx, top, bw, h, 8);
      ctx.fillStyle = `${color}33`;
      ctx.fill();
      if (evs.length) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      // Barre de couleur à gauche
      ctx.save();
      roundRect(ctx, bx, top, bw, h, 8);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(bx, top, 5, h);
      ctx.restore();

      const tx = bx + 14;
      const tw = bw - 22;
      let ty = top + 10;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Badge éval
      if (evs.length) {
        const label = evs.length > 1 ? `${evs.length} ÉVALS` : typeStyle(evs[0].type).label.toUpperCase();
        ctx.font = `bold 11px ${FONT}`;
        const lw = ctx.measureText(label).width + 14;
        roundRect(ctx, tx, ty, lw, 18, 9);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, tx + 7, ty + 3);
        ty += 24;
      }

      const lineH = 17;
      const reserved = (evs.length === 1 ? 3 : 2) * 15 + 4; // (matière) + horaire + salle
      const maxLines = Math.max(1, Math.floor((top + h - ty - reserved) / lineH));
      const title = evs.length === 1 ? evs[0].titre : s.matiere;
      ctx.fillStyle = COLORS.text;
      ctx.font = `bold 14px ${FONT}`;
      for (const line of wrap(ctx, title, tw, maxLines)) {
        ctx.fillText(line, tx, ty);
        ty += lineH;
      }

      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = COLORS.muted;
      // Pour une éval, rappel de la matière sous le titre
      if (evs.length === 1 && ty + 14 <= top + h - 4) {
        ctx.font = `italic 12px ${FONT}`;
        ctx.fillText(wrap(ctx, s.matiere, tw, 1)[0], tx, ty + 2);
        ctx.font = `12px ${FONT}`;
        ty += 15;
      }
      if (ty + 14 <= top + h - 4) {
        ctx.fillText(`${hm(s.start)} – ${hm(s.end)}`, tx, ty + 2);
        ty += 15;
      }
      if (s.salle && ty + 14 <= top + h - 4) {
        ctx.fillText(wrap(ctx, `Salle ${s.salle}`, tw, 1)[0], tx, ty + 2);
      }
    }

    // Heure actuelle
    if (isToday) {
      const nowMin = minutes(new Date());
      if (nowMin >= startHour * 60 && nowMin <= endHour * 60) {
        const y = yFor(nowMin);
        ctx.strokeStyle = COLORS.now;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dayW, y);
        ctx.stroke();
        ctx.fillStyle = COLORS.now;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  return canvas.toBuffer('image/png');
}

module.exports = { renderWeek };
