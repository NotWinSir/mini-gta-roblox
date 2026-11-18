// The 2D HUD drawn over the WebGL canvas: rounded dark panels with bold outlined text —
// mission panel top-left, money and wanted stars top-right, a big speedometer bottom-right,
// a round minimap bottom-left, toasts and control hints along the bottom, plus the title
// and BUSTED overlays and the floating mission label projected from the 3D marker.
import { CARS, COLS, MAP, ROWS, TILE, VIEW, WORLD_H, WORLD_W } from './config.js';
import { buildingVariant } from './city.js';
import { BRICK_PALETTE } from './config.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function rgb(color, alpha = 1) {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function panel(ctx, x, y, w, h, alpha = 0.62) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fillStyle = `rgba(18,20,32,${alpha})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function outlineText(ctx, text, x, y, font, fill, align = 'left') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 4;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23e' : 'rgba(120,120,135,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawMinimap(ctx, state) {
  const cx = 102;
  const cy = VIEW.height - 102;
  const radius = 84;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(24,42,26,0.88)';
  ctx.fill();
  ctx.clip();
  const scale = 156 / WORLD_W;
  const ox = cx - (WORLD_W * scale) / 2;
  const oy = cy - (WORLD_H * scale) / 2;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = ox + c * TILE * scale;
      const y = oy + r * TILE * scale;
      const w = TILE * scale + 0.5;
      if (MAP[r][c] === '0') {
        ctx.fillStyle = 'rgba(120,120,132,0.95)';
      } else {
        ctx.fillStyle = rgb(BRICK_PALETTE[buildingVariant(c, r)], 0.85);
      }
      ctx.fillRect(x, y, w, w);
    }
  }
  const dot = (wx, wz, color, size) => {
    ctx.beginPath();
    ctx.arc(ox + wx * scale, oy + wz * scale, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const target = state.mission.stage === 0 ? state.mission.pickup : state.mission.drop;
  const pulse = 4 + Math.sin(state.frame / 8) * 1.2;
  dot(target.x, target.z, state.mission.stage === 0 ? '#ffd23e' : '#3df06a', pulse);
  for (const cop of state.police) dot(cop.x, cop.z, '#5b8cff', 3.4);
  // The player: a white arrow turned to the car's heading.
  const px = ox + state.carX * scale;
  const py = oy + state.carZ * scale;
  const rad = (state.angle * Math.PI) / 180;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rad);
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function drawHud(ctx, state, screen, markerInfo) {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  const car = CARS[state.carType];

  if (screen === 'play') {
    // Mission panel, top-left.
    const target = state.mission.stage === 0 ? state.mission.pickup : state.mission.drop;
    const distM = Math.round(Math.hypot(target.x - state.carX, target.z - state.carZ) / 8);
    panel(ctx, 10, 10, 302, 96);
    outlineText(ctx, state.mission.stage === 0 ? 'MISI: Ambil paket' : 'MISI: Antar paket', 24, 40, `bold 21px ${FONT}`, '#ffffff');
    outlineText(ctx, `Jarak ${distM} m  ·  ${car.name}`, 24, 66, `bold 16px ${FONT}`, '#ffd23e');
    ctx.beginPath();
    ctx.roundRect(24, 78, 220, 13, 6);
    ctx.fillStyle = 'rgba(90,20,20,0.9)';
    ctx.fill();
    const hpW = Math.max(0, (220 * state.health) / 100);
    if (hpW > 0) {
      ctx.beginPath();
      ctx.roundRect(24, 78, hpW, 13, 6);
      ctx.fillStyle = '#5ae65a';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(24, 78, 220, 13, 6);
    ctx.stroke();

    // Money, score and wanted stars, top-right.
    panel(ctx, VIEW.width - 252, 10, 242, 96);
    outlineText(ctx, `$${state.money}`, VIEW.width - 24, 44, `bold 26px ${FONT}`, '#3df06a', 'right');
    outlineText(ctx, `Skor ${state.score}`, VIEW.width - 24, 68, `bold 15px ${FONT}`, '#ffd23e', 'right');
    outlineText(ctx, 'WANTED', VIEW.width - 238, 96, `bold 14px ${FONT}`, '#ffffff');
    for (let i = 0; i < 5; i += 1) star(ctx, VIEW.width - 148 + i * 24, 88, 10, i < state.wanted);

    // Speedometer, bottom-right.
    panel(ctx, VIEW.width - 196, VIEW.height - 104, 186, 94);
    outlineText(ctx, `${Math.round(Math.abs(state.speed) * 12)}`, VIEW.width - 108, VIEW.height - 38, `bold 46px ${FONT}`, '#ffffff', 'right');
    outlineText(ctx, 'km/h', VIEW.width - 98, VIEW.height - 38, `bold 17px ${FONT}`, '#cfd4e0');
    outlineText(ctx, car.name, VIEW.width - 24, VIEW.height - 66, `bold 14px ${FONT}`, '#9fb4d8', 'right');

    drawMinimap(ctx, state);

    // The mission label floats over the 3D marker.
    if (markerInfo && markerInfo.markerScreen) {
      const label = state.mission.stage === 0 ? 'PAKET' : 'ANTAR';
      const color = state.mission.stage === 0 ? '#ffd23e' : '#3df06a';
      outlineText(ctx, label, markerInfo.markerScreen.x, markerInfo.markerScreen.y - 8, `bold 19px ${FONT}`, color, 'center');
    }

    // Toast, bottom-centre.
    if (state.toast.timer > 0) {
      ctx.font = `bold 20px ${FONT}`;
      const w = ctx.measureText(state.toast.text).width + 36;
      panel(ctx, VIEW.width / 2 - w / 2, VIEW.height - 148, w, 38, 0.72);
      outlineText(ctx, state.toast.text, VIEW.width / 2, VIEW.height - 122, `bold 20px ${FONT}`, '#ffffff', 'center');
    }

    // Control hints, bottom-centre.
    const hint = 'Panah/WASD: nyetir  |  C: ganti mobil  |  Tabrak pejalan kaki = wanted naik';
    ctx.font = `bold 15px ${FONT}`;
    const hw = ctx.measureText(hint).width + 28;
    panel(ctx, VIEW.width / 2 - hw / 2, VIEW.height - 42, hw, 32, 0.55);
    outlineText(ctx, hint, VIEW.width / 2, VIEW.height - 20, `bold 15px ${FONT}`, '#dfe3ec', 'center');
  }

  if (state.bustedTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.font = `bold 92px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.fillText('BUSTED!', VIEW.width / 2 + 4, VIEW.height / 2 + 4);
    ctx.fillStyle = '#ff3b30';
    ctx.fillText('BUSTED!', VIEW.width / 2, VIEW.height / 2);
  }

  if (screen === 'title') {
    ctx.fillStyle = 'rgba(16,10,28,0.42)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    outlineText(ctx, 'MINI GTA', VIEW.width / 2, 268, `bold 96px ${FONT}`, '#ffffff', 'center');
    outlineText(ctx, 'BLOX CITY 3D', VIEW.width / 2, 342, `bold 58px ${FONT}`, '#ffd23e', 'center');
    outlineText(ctx, 'Antar paket, hindari polisi, jangan sampai busted.', VIEW.width / 2, 396, `bold 21px ${FONT}`, '#e8e2f2', 'center');
    outlineText(ctx, 'Enter untuk mulai', VIEW.width / 2, 478, `bold 30px ${FONT}`, '#3df06a', 'center');
    outlineText(ctx, 'Panah/WASD: nyetir  ·  C: ganti mobil (Sedan / Sport / Truk)', VIEW.width / 2, 522, `bold 17px ${FONT}`, '#cfd4e0', 'center');
  }
}
