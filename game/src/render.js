// NEON HARBOR — rendering: the city from above with shaded buildings,
// the Dockside container yards, day/night light, cars and the Harbor
// Hawk motorcycle, people, particles, and the full HUD: cash, health,
// wanted stars, the current weapon, mission objective, speed, clock,
// and a live minimap. Menus (title / pause / wasted / busted) are
// drawn here too.

import { WORLD_W, WORLD_H, BLOCK, ROAD_W, DISTRICTS, CAR_MODELS, WEAPONS, districtAt, clamp, lerp } from './config.js';
import { streetCenters, onRoad } from './city.js';
import { wantedFor } from './police.js';

export const SCREEN = { TITLE: 'title', PLAY: 'play', PAUSE: 'pause', OVER: 'over' };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();
  return {
    get w() { return W; }, get h() { return H; },
    ctx,
    resize,

    // ---- world ----
    drawWorld(state, cam) {
      const { city, fx, cars, peds, gang, player, wanted, clock } = state;
      const day = dayFactor(clock);
      ctx.fillStyle = '#1d2a24';
      ctx.fillRect(0, 0, W, H);
      const vx0 = cam.x - W / 2 / cam.zoom, vy0 = cam.y - H / 2 / cam.zoom;
      const vx1 = cam.x + W / 2 / cam.zoom, vy1 = cam.y + H / 2 / cam.zoom;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      // Ground: grass base, sand strip at the south, water at the far south.
      ctx.fillStyle = '#4a7a4a';
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.fillStyle = '#c9a86a';
      ctx.fillRect(0, 2750, WORLD_W, 330);
      ctx.fillStyle = '#2e6f9a';
      ctx.fillRect(0, 3080, WORLD_W, WORLD_H - 3080);
      // Harbour water on the east edge.
      ctx.fillStyle = '#2e6f9a';
      ctx.fillRect(WORLD_W - 40, 1200, 40, 1200);

      // District tint washes.
      for (const d of DISTRICTS) {
        ctx.fillStyle = d.tint + '22';
        ctx.fillRect(d.x, d.y, d.w, d.h);
      }
      // Parks.
      for (const p of city.parks) {
        ctx.fillStyle = '#3f8a4a';
        ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      }
      // Roads: asphalt with edge lines and centre dashes.
      ctx.fillStyle = '#33363d';
      const { xs, ys } = streetCenters();
      for (const cx of xs) ctx.fillRect(cx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
      for (const cy of ys) ctx.fillRect(0, cy - ROAD_W / 2, WORLD_W, ROAD_W);
      ctx.fillStyle = '#5a5e68';
      for (const cx of xs) ctx.fillRect(cx - ROAD_W / 2, 0, 6, WORLD_H);
      for (const cy of ys) ctx.fillRect(0, cy - ROAD_W / 2, WORLD_W, 6);
      // Centre dashes.
      ctx.fillStyle = 'rgba(216,200,74,0.7)';
      for (const cy of ys) {
        for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, cy - 2, 30, 4);
      }
      for (const cx of xs) {
        for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(cx - 2, y, 4, 30);
      }
      // Crosswalks at intersections.
      ctx.fillStyle = 'rgba(230,230,230,0.5)';
      for (const cx of xs) for (const cy of ys) {
        ctx.fillRect(cx - 30, cy - ROAD_W / 2, 60, 8);
        ctx.fillRect(cx - 30, cy + ROAD_W / 2 - 8, 60, 8);
      }
      // Pier.
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(city.pier.x - city.pier.w / 2, city.pier.y - city.pier.h / 2, city.pier.w, city.pier.h);
      ctx.fillStyle = '#8a6a3a';
      for (let y = city.pier.y - city.pier.h / 2; y < city.pier.y + city.pier.h / 2; y += 40) {
        ctx.fillRect(city.pier.x - city.pier.w / 2, y, city.pier.w, 4);
      }

      // Shipping containers in the Dockside yards.
      if (city.containers) {
        for (const cn of city.containers) {
          if (cn.x > vx1 || cn.x + cn.w < vx0 || cn.y > vy1 || cn.y + cn.h < vy0) continue;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(cn.x + 3, cn.y + 4, cn.w, cn.h);
          ctx.fillStyle = cn.color;
          ctx.fillRect(cn.x, cn.y, cn.w, cn.h);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          const ribs = Math.max(2, Math.floor(cn.w / 14));
          for (let r = 0; r < ribs; r++) ctx.fillRect(cn.x + 4 + r * 14, cn.y + 3, 3, cn.h - 6);
          if (cn.stacked) {
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(cn.x + 3, cn.y - 5, cn.w - 6, 5);
          }
        }
      }

      // Buildings: shaded footprint + raised roof for a 2.5D read.
      for (const b of city.buildings) {
        if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(b.x + 6, b.y + b.height * 0.5 + 4, b.w, b.h);
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = b.roof;
        ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
        // Roof details: AC units / skylights.
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.18, b.h * 0.2);
        ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, b.w * 0.16, b.h * 0.18);
        // Lit windows at night.
        if (day < 0.55) {
          ctx.fillStyle = 'rgba(255,214,120,0.85)';
          const n = b.windows;
          for (let i = 0; i < n; i++) {
            const wx = b.x + 10 + ((i * 37) % Math.max(20, b.w - 20));
            const wy = b.y + 10 + ((i * 53) % Math.max(20, b.h - 20));
            ctx.fillRect(wx, wy, 7, 9);
          }
        }
      }
      // Trees / palms.
      for (const t of city.trees) {
        if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
        ctx.fillStyle = t.palm ? '#2fae5a' : '#2a7a3a';
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.5, 0, Math.PI * 2); ctx.fill();
      }

      // Pickups.
      for (const pk of fx.pickups) {
        const bob = Math.sin((clock * 2 + pk.bob)) * 3;
        ctx.save();
        ctx.translate(pk.x, pk.y + bob);
        if (pk.kind === 'cash') { ctx.fillStyle = '#2fae5a'; ctx.fillRect(-9, -7, 18, 14); ctx.fillStyle = '#e8f5e9'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', 0, 4); }
        else if (pk.kind === 'health') { ctx.fillStyle = '#fff'; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = '#d83a3a'; ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4); }
        else if (pk.kind === 'weapon') { ctx.fillStyle = '#e8a23a'; ctx.fillRect(-11, -6, 22, 12); ctx.fillStyle = '#1a1a22'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SG', 0, 3); }
        else { ctx.fillStyle = '#f2c230'; ctx.fillRect(-8, -8, 16, 16); ctx.fillStyle = '#333'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('AMMO', 0, 3); }
        ctx.restore();
      }

      // Mission / job waypoint marker.
      const wp = state.waypoint;
      if (wp) {
        const pulse = 1 + Math.sin(clock * 5) * 0.12;
        ctx.save();
        ctx.translate(wp.x, wp.y);
        ctx.strokeStyle = '#ffd23a';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,210,58,0.25)';
        ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd23a';
        ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(10, -34); ctx.lineTo(-10, -34); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Vehicles (cars and bikes).
      for (const car of cars) {
        if (car.dead) continue;
        if (car.x < vx0 - 80 || car.x > vx1 + 80 || car.y < vy0 - 80 || car.y > vy1 + 80) continue;
        if (car.bike) drawBike(ctx, car, day);
        else drawCar(ctx, car, day);
      }
      // Gang members (the boss is bigger, gold, and named).
      for (const g of gang) {
        if (g.hp <= 0) continue;
        drawPerson(ctx, g.x, g.y, g.angle, g.walkPhase, g.shirt, '#222', true);
        if (g.boss) {
          ctx.fillStyle = '#e8b93a';
          ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('KESS', g.x, g.y - 22);
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(g.x - 16, g.y - 18, 32, 4);
          ctx.fillStyle = '#ff5a4a';
          ctx.fillRect(g.x - 16, g.y - 18, 32 * clamp(g.hp / g.maxHp, 0, 1), 4);
        }
      }
      // Pedestrians.
      for (const p of peds) {
        if (p.state === 'down') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(1.2);
          ctx.fillStyle = p.color; ctx.fillRect(-12, -5, 24, 10);
          ctx.restore();
          continue;
        }
        drawPerson(ctx, p.x, p.y, p.angle, p.walkPhase, p.color, '#2a2a2a', false);
      }
      // Cops on foot.
      for (const c of wanted.cops) {
        if (c.hp <= 0 || !c.onFoot) continue;
        drawPerson(ctx, c.x, c.y, c.angle, clock * 10, '#22304a', '#d8d8d8', true, true);
      }
      // Player.
      if (player.alive && !player.inCar) {
        drawPerson(ctx, player.x, player.y, player.aimAngle, player.walkPhase, '#e86aa8', '#1a1a22', false, false, true);
        // Aim line.
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(player.x + Math.cos(player.aimAngle) * 24, player.y + Math.sin(player.aimAngle) * 24);
        ctx.lineTo(player.x + Math.cos(player.aimAngle) * 52, player.y + Math.sin(player.aimAngle) * 52);
        ctx.stroke();
        if (player.muzzleT > 0) {
          ctx.fillStyle = '#ffd23a';
          ctx.beginPath();
          ctx.arc(player.x + Math.cos(player.aimAngle) * 26, player.y + Math.sin(player.aimAngle) * 26, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Bullets.
      ctx.fillStyle = '#ffe27a';
      for (const b of fx.bullets) {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
        ctx.fillRect(-7, -1.5, 14, 3);
        ctx.restore();
      }
      // Particles.
      for (const p of fx.particles) {
        const a = clamp(p.life / p.max, 0, 1);
        if (p.kind === 'fire') ctx.fillStyle = `rgba(255,${Math.floor(120 + 100 * a)},40,${a})`;
        else if (p.kind === 'smoke') ctx.fillStyle = `rgba(80,80,80,${a * 0.55})`;
        else if (p.kind === 'blood') ctx.fillStyle = `rgba(180,30,30,${a})`;
        else ctx.fillStyle = `rgba(255,220,120,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.kind === 'smoke' ? (1.6 - a * 0.6) : 1), 0, Math.PI * 2); ctx.fill();
      }
      // Floating text.
      ctx.textAlign = 'center';
      for (const f of fx.floaters) {
        ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
        ctx.fillStyle = f.color;
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      }
      // Headlight cones at night.
      if (day < 0.5) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const car of cars) {
          if (car.dead || Math.abs(car.speed) < 5) continue;
          const gx = car.x + Math.cos(car.angle) * car.len / 2;
          const gy = car.y + Math.sin(car.angle) * car.len / 2;
          const grad = ctx.createRadialGradient(gx, gy, 4, gx + Math.cos(car.angle) * 60, gy + Math.sin(car.angle) * 60, 90);
          grad.addColorStop(0, 'rgba(255,240,180,0.20)');
          grad.addColorStop(1, 'rgba(255,240,180,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(gx + Math.cos(car.angle) * 50, gy + Math.sin(car.angle) * 50, 85, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();

      // Night tint over everything.
      if (day < 0.85) {
        ctx.fillStyle = `rgba(8,12,40,${(0.85 - day) * 0.5})`;
        ctx.fillRect(0, 0, W, H);
      }
      // Damage vignette.
      if (player.health < 35 && player.alive) {
        const pulse = 0.25 + Math.sin(clock * 6) * 0.1;
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
        g.addColorStop(0, 'rgba(200,0,0,0)');
        g.addColorStop(1, `rgba(200,0,0,${pulse})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    },

    // ---- HUD ----
    drawHud(state) {
      const { player, wanted, cash, rep, clock } = state;
      const car = player.inCar;
      ctx.textAlign = 'left';
      // Top-left: cash + rep + district.
      ctx.fillStyle = 'rgba(10,14,24,0.72)';
      roundRect(ctx, 14, 14, 210, 64, 10); ctx.fill();
      ctx.fillStyle = '#7dff9a';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`$${cash.toLocaleString('en-US')}`, 28, 42);
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`REP ${rep}   •   ${districtAt(player.x, player.y)}`, 28, 64);
      // Wanted stars top-cent.
      const cx = W / 2;
      ctx.fillStyle = 'rgba(10,14,24,0.72)';
      roundRect(ctx, cx - 130, 14, 260, 44, 10); ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < wanted.stars ? '#ffd23a' : 'rgba(255,255,255,0.22)';
        ctx.fillText('★', cx - 88 + i * 44, 45);
      }
      ctx.fillStyle = wanted.stars > 0 ? '#ff6a5a' : '#9ad8ff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(wanted.stars > 0 ? wantedFor(wanted.stars).toUpperCase() : 'CLEAN', cx, 74);
      // Clock top-right: the day runs 06:00 (dawn) to 24:00 over 240 s.
      const dayT = (clock / 240) % 1;
      const hours = 6 + Math.floor(dayT * 18);
      const mins = Math.floor((dayT * 18 % 1) * 60);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(10,14,24,0.72)';
      roundRect(ctx, W - 150, 14, 136, 44, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`, W - 28, 44);
      // Mission objective banner.
      if (state.objective) {
        ctx.textAlign = 'center';
        const lines = wrapText(ctx, state.objective, 520, 'bold 15px sans-serif');
        const bh = 30 + lines.length * 20;
        ctx.fillStyle = 'rgba(10,14,24,0.78)';
        roundRect(ctx, cx - 300, 96, 600, bh, 10); ctx.fill();
        ctx.fillStyle = '#ffd23a';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(state.missionTitle ? `MISSION — ${state.missionTitle.toUpperCase()}` : 'PORT MERIDIAN', cx, 118);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px sans-serif';
        lines.forEach((l, i) => ctx.fillText(l, cx, 140 + i * 20));
        if (state.missionTimer != null) {
          ctx.fillStyle = state.missionTimer < 20 ? '#ff6a5a' : '#7dff9a';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText(`⏱ ${Math.ceil(state.missionTimer)}s`, cx, 140 + lines.length * 20);
        }
      }
      // Bottom-right: health + ammo / speed, and the weapon slots.
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(10,14,24,0.72)';
      roundRect(ctx, W - 254, H - 84, 240, 70, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(car ? car.name.toUpperCase() : 'ON FOOT', W - 240, H - 58);
      // Health bar.
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(W - 240, H - 48, 180, 10);
      ctx.fillStyle = player.health > 50 ? '#7dff9a' : player.health > 25 ? '#ffd23a' : '#ff5a4a';
      ctx.fillRect(W - 240, H - 48, 180 * clamp(player.health / 100, 0, 1), 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      if (car) {
        const kmh = Math.round(Math.abs(car.speed) * 0.55);
        ctx.fillText(`${kmh} km/h   •   ${car.bike ? 'BIKE' : 'CAR'} ${Math.max(0, Math.round(car.hp))}%`, W - 240, H - 24);
      } else {
        const w = WEAPONS[player.weapon];
        ctx.fillText(`${w.name.toUpperCase()}  •  AMMO ${player.ammo}${player.reloadT > 0 ? ' — RELOADING…' : ''}`, W - 240, H - 24);
      }
      // Weapon slots above the health box (only when both are owned).
      if (player.ownedWeapons.length > 1) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(10,14,24,0.72)';
        roundRect(ctx, W - 254, H - 118, 240, 26, 8); ctx.fill();
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = player.weapon === 'pistol' ? '#ffd23a' : 'rgba(255,255,255,0.6)';
        ctx.fillText('[1] PISTOL', W - 240, H - 100);
        ctx.fillStyle = player.weapon === 'scattergun' ? '#ffd23a' : 'rgba(255,255,255,0.6)';
        ctx.fillText('[2] SCATTERGUN', W - 140, H - 100);
      }
      // Controls hint, centred along the bottom edge.
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '12px sans-serif';
      ctx.fillText('WASD move/drive • E enter vehicle • Mouse aim, Click shoot • 1/2 weapons • Shift sprint • Space brake • Esc pause • M mute', W / 2, H - 12);
      // Toasts (centre, fading).
      if (state.toast && state.toastT > 0) {
        ctx.globalAlpha = clamp(state.toastT, 0, 1);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(10,14,24,0.85)';
        roundRect(ctx, cx - 260, H - 190, 520, 44, 10); ctx.fill();
        ctx.fillStyle = '#ffd23a';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(state.toast, cx, H - 162);
        ctx.globalAlpha = 1;
      }
      this.drawMinimap(state);
    },

    drawMinimap(state) {
      const size = 190;
      const mx = 14, my = H - size - 14;
      const scale = size / WORLD_W;
      ctx.save();
      ctx.beginPath(); ctx.arc(mx + size / 2, my + size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(16,24,20,0.9)';
      ctx.fillRect(mx, my, size, size);
      // Water + sand.
      ctx.fillStyle = '#2e6f9a'; ctx.fillRect(mx, my + size * 0.9, size, size * 0.1);
      ctx.fillStyle = '#c9a86a'; ctx.fillRect(mx, my + size * 0.81, size, size * 0.09);
      // Roads.
      ctx.strokeStyle = '#6a6e78'; ctx.lineWidth = 3;
      const { xs, ys } = streetCenters();
      for (const cx of xs) { ctx.beginPath(); ctx.moveTo(mx + cx * scale, my); ctx.lineTo(mx + cx * scale, my + size); ctx.stroke(); }
      for (const cy of ys) { ctx.beginPath(); ctx.moveTo(mx, my + cy * scale); ctx.lineTo(mx + size, my + cy * scale); ctx.stroke(); }
      // Buildings.
      ctx.fillStyle = 'rgba(180,190,210,0.5)';
      for (const b of state.city.buildings) ctx.fillRect(mx + b.x * scale, my + b.y * scale, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
      // Containers (Dockside shows as a coloured patch).
      if (state.city.containers) {
        ctx.fillStyle = 'rgba(184,74,42,0.7)';
        for (const cn of state.city.containers) ctx.fillRect(mx + cn.x * scale, my + cn.y * scale, Math.max(2, cn.w * scale), Math.max(2, cn.h * scale));
      }
      // Waypoint.
      if (state.waypoint) {
        ctx.fillStyle = '#ffd23a';
        ctx.beginPath(); ctx.arc(mx + state.waypoint.x * scale, my + state.waypoint.y * scale, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx + state.waypoint.x * scale, my + state.waypoint.y * scale, 10 + Math.sin(state.clock * 5) * 2, 0, Math.PI * 2); ctx.stroke();
      }
      // Cops.
      ctx.fillStyle = '#4ba3ff';
      for (const c of state.wanted.cops) {
        ctx.beginPath(); ctx.arc(mx + c.x * scale, my + c.y * scale, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      // Player arrow.
      const p = state.player;
      const px = mx + p.x * scale, py = my + p.y * scale;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.inCar ? p.inCar.angle : p.angle);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx + size / 2, my + size / 2, size / 2, 0, Math.PI * 2); ctx.stroke();
    },

    // ---- menus ----
    drawTitle(state, best) {
      // Backdrop: the city at dusk, dimmed.
      this.drawWorld({ ...state, waypoint: null }, { x: 1700, y: 1700, zoom: 0.22 });
      ctx.fillStyle = 'rgba(8,10,26,0.62)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('PORT MERIDIAN  •  A SUN-SOAKED OPEN WORLD', W / 2, H * 0.2);
      ctx.fillStyle = '#ff5a8a';
      ctx.font = 'bold 84px sans-serif';
      ctx.fillText('NEON', W / 2, H * 0.2 + 84);
      ctx.fillStyle = '#4bd8ff';
      ctx.font = 'bold 84px sans-serif';
      ctx.fillText('HARBOR', W / 2, H * 0.2 + 168);
      ctx.fillStyle = '#fff';
      ctx.font = '17px sans-serif';
      ctx.fillText('Rae Calloway came home to Port Meridian with nothing but a stolen past', W / 2, H * 0.2 + 208);
      ctx.fillText('and a fixer named Marisol Vega. Six jobs stand between her and freedom.', W / 2, H * 0.2 + 232);
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(state.hasSave ? '▶  CONTINUE  (Enter)' : '▶  NEW GAME  (Enter)', W / 2, H * 0.62);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '15px sans-serif';
      ctx.fillText('WASD move / drive   •   E steal & ride cars and bikes   •   Mouse aim, Click to shoot', W / 2, H * 0.68);
      ctx.fillText('Shift sprint   •   Space handbrake   •   1 / 2 switch weapons   •   Esc pause & save   •   M mute', W / 2, H * 0.71);
      ctx.fillText('Steal cars and bikes, outrun the Meridian PD, finish all six missions.', W / 2, H * 0.74);
      if (best > 0) {
        ctx.fillStyle = '#7dff9a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Best cash held: $${best.toLocaleString('en-US')}`, W / 2, H * 0.8);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '12px sans-serif';
      ctx.fillText('An original game. No real city, person or brand appears in it.', W / 2, H - 24);
    },

    drawPause(state) {
      ctx.fillStyle = 'rgba(8,10,26,0.72)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText('PAUSED', W / 2, H * 0.34);
      ctx.font = '17px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`Cash $${state.cash.toLocaleString('en-US')}  •  REP ${state.rep}  •  Missions done ${state.doneMissions.length}/6`, W / 2, H * 0.34 + 36);
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText('Enter — resume      S — save game      R — restart run      Q — quit to title', W / 2, H * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '14px sans-serif';
      ctx.fillText('Progress also autosaves after every finished mission.', W / 2, H * 0.5 + 30);
    },

    drawOver(state, reason) {
      ctx.fillStyle = 'rgba(20,4,8,0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = reason === 'busted' ? '#4ba3ff' : '#ff5a4a';
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText(reason === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H * 0.4);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText(reason === 'busted'
        ? 'Sgt. Brandt has you in cuffs. Marisol posts bail — but the heat stays.'
        : 'Rae goes down in the streets of Port Meridian. The city keeps moving.', W / 2, H * 0.4 + 40);
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(`Cash $${state.cash.toLocaleString('en-US')}  •  Missions ${state.doneMissions.length}/6   —   Enter to try again`, W / 2, H * 0.55);
    },
  };
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function wrapText(c, text, maxW, font) {
  c.font = font;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// 0 = deep night, 1 = midday. A full day is 240 s of play.
export function dayFactor(clock) {
  const t = (clock / 240) % 1;
  return clamp(0.35 + 0.65 * Math.sin(Math.PI * clamp(t, 0, 1)), 0.12, 1);
}

// A motorcycle: a narrow frame, two wheels, and a rider leaning into
// the turn. The lean comes from the bike's physics, so it reads as
// speed even in a still frame.
function drawBike(c, bike, day) {
  c.save();
  c.translate(bike.x, bike.y);
  c.rotate(bike.angle);
  // Shadow.
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(-bike.len / 2 + 3, -bike.w / 2 + 4, bike.len, bike.w);
  // Lean: the whole bike tilts sideways into the turn.
  c.rotate(bike.lean * 0.35);
  // Wheels.
  c.fillStyle = '#1a1a1a';
  c.beginPath(); c.arc(bike.len / 2 - 4, 0, 6, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(-bike.len / 2 + 4, 0, 6, 0, Math.PI * 2); c.fill();
  // Frame.
  c.fillStyle = bike.color;
  roundRect(c, -bike.len / 2, -5, bike.len, 10, 5); c.fill();
  // Tank + seat.
  c.fillStyle = 'rgba(20,24,34,0.9)';
  roundRect(c, -4, -6, 14, 12, 4); c.fill();
  // Rider: torso leaning forward over the tank.
  c.fillStyle = bike.police ? '#22304a' : '#e86aa8';
  roundRect(c, -10, -7, 12, 14, 5); c.fill();
  // Rider's head.
  c.fillStyle = '#e8b98a';
  c.beginPath(); c.arc(2, 0, 5, 0, Math.PI * 2); c.fill();
  c.fillStyle = bike.police ? '#22304a' : '#1a1a22';
  c.beginPath(); c.arc(2, 0, 5, Math.PI * 0.4, Math.PI * 1.6); c.fill();
  // Headlight.
  c.fillStyle = day < 0.5 ? '#fff6c0' : '#e8e8e8';
  c.fillRect(bike.len / 2 - 2, -2, 3, 4);
  // Police interceptor livery.
  if (bike.police) {
    const blink = Math.floor(Date.now() / 300) % 2 === 0;
    c.fillStyle = blink ? '#ff2a2a' : '#2a7aff';
    c.beginPath(); c.arc(-2, -7, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = blink ? '#2a7aff' : '#ff2a2a';
    c.beginPath(); c.arc(-2, 7, 3.5, 0, Math.PI * 2); c.fill();
  }
  // Damage smoke.
  if (bike.hp < 45) {
    c.fillStyle = 'rgba(90,90,90,0.6)';
    c.beginPath(); c.arc(-bike.len / 4, 0, 7 + Math.random() * 4, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function drawCar(c, car, day) {
  c.save();
  c.translate(car.x, car.y);
  c.rotate(car.angle);
  // Shadow.
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(-car.len / 2 + 3, -car.w / 2 + 4, car.len, car.w);
  // Body.
  c.fillStyle = car.color;
  roundRect(c, -car.len / 2, -car.w / 2, car.len, car.w, 8); c.fill();
  // Roof / cabin.
  c.fillStyle = 'rgba(20,24,34,0.85)';
  roundRect(c, -car.len * 0.22, -car.w / 2 + 4, car.len * 0.42, car.w - 8, 5); c.fill();
  // Windshield + rear window.
  c.fillStyle = 'rgba(160,210,240,0.75)';
  c.fillRect(car.len * 0.2, -car.w / 2 + 5, 4, car.w - 10);
  c.fillRect(-car.len * 0.24, -car.w / 2 + 5, 3, car.w - 10);
  // Headlights / taillights.
  c.fillStyle = day < 0.5 ? '#fff6c0' : '#e8e8e8';
  c.fillRect(car.len / 2 - 3, -car.w / 2 + 2, 3, 5);
  c.fillRect(car.len / 2 - 3, car.w / 2 - 7, 3, 5);
  c.fillStyle = '#d83a3a';
  c.fillRect(-car.len / 2, -car.w / 2 + 2, 3, 5);
  c.fillRect(-car.len / 2, car.w / 2 - 7, 3, 5);
  if (car.brakeLight) {
    c.fillStyle = '#ff2a2a';
    c.fillRect(-car.len / 2 - 1, -car.w / 2 + 1, 4, 6);
    c.fillRect(-car.len / 2 - 1, car.w / 2 - 7, 4, 6);
  }
  // Police livery.
  if (car.police) {
    c.fillStyle = '#fff';
    c.fillRect(-car.len * 0.1, -car.w / 2, car.len * 0.2, car.w);
    c.fillStyle = '#d83a3a';
    c.font = 'bold 8px sans-serif'; c.textAlign = 'center';
    c.fillText('PD', 0, 3);
    const blink = Math.floor(Date.now() / 300) % 2 === 0;
    c.fillStyle = blink ? '#ff2a2a' : '#2a7aff';
    c.beginPath(); c.arc(-6, -car.w / 2 + 2, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = blink ? '#2a7aff' : '#ff2a2a';
    c.beginPath(); c.arc(6, -car.w / 2 + 2, 4, 0, Math.PI * 2); c.fill();
  }
  // Taxi sign.
  if (car.name === 'Harbor Taxi') {
    c.fillStyle = '#fff';
    c.fillRect(-8, -car.w / 2 - 2, 16, 5);
    c.fillStyle = '#111';
    c.font = 'bold 5px sans-serif'; c.textAlign = 'center';
    c.fillText('TAXI', 0, -car.w / 2 + 2);
  }
  // Damage smoke.
  if (car.hp < 45) {
    c.fillStyle = 'rgba(90,90,90,0.6)';
    c.beginPath(); c.arc(-car.len / 4, 0, 7 + Math.random() * 4, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function drawPerson(c, x, y, angle, phase, shirt, pants, armed, isCop, isPlayer) {
  c.save();
  c.translate(x, y);
  // Shadow.
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath(); c.ellipse(1, 3, 11, 8, 0, 0, Math.PI * 2); c.fill();
  const bob = Math.sin(phase) * 1.5;
  // Legs (walk cycle).
  c.strokeStyle = pants;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(0, 2); c.lineTo(Math.cos(angle + Math.PI / 2) * 4 + Math.sin(phase) * 4, 8);
  c.moveTo(0, 2); c.lineTo(Math.cos(angle + Math.PI / 2) * -4 - Math.sin(phase) * 4, 8);
  c.stroke();
  // Body.
  c.rotate(angle);
  c.fillStyle = shirt;
  roundRect(c, -8, -7 + bob * 0.3, 16, 14, 6); c.fill();
  // Head.
  c.fillStyle = '#e8b98a';
  c.beginPath(); c.arc(6, 0, 6, 0, Math.PI * 2); c.fill();
  c.fillStyle = isPlayer ? '#e86aa8' : isCop ? '#22304a' : '#3a2a1a';
  c.beginPath(); c.arc(5, 0, 6, Math.PI * 0.4, Math.PI * 1.6); c.fill();
  // Gun in hand.
  if (armed || isPlayer) {
    c.fillStyle = '#222';
    c.fillRect(8, -2, 12, 3.5);
  }
  if (isCop) {
    c.fillStyle = '#ffd23a';
    c.font = 'bold 6px sans-serif'; c.textAlign = 'center';
    c.fillText('PD', -1, 2);
  }
  c.restore();
}
