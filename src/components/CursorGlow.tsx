import { useEffect, useRef } from 'react';

/**
 * CursorGlow — Subtle neon cursor orb + sparkle trail.
 *
 * Architecture:
 *  • One small core orb  (~28 px, sharp inner glow)
 *  • One soft halo ring  (~80 px, blurred outer bloom)
 *  • Up to MAX_SPARKS tiny sparkle dots that spawn on movement,
 *    fade out, and are recycled — no canvas, no extra libs.
 *
 * Performance:
 *  • Single rAF loop for everything.
 *  • All movement via transform: translate3d (GPU layer).
 *  • Sparks reuse pre-created DOM nodes (object pool).
 *  • Early-exit on touch / prefers-reduced-motion.
 */

// ── Tuning constants ──────────────────────────────────────────
const LERP_CORE  = 0.18;   // core orb follows cursor closely
const LERP_HALO  = 0.09;   // halo lags slightly behind
const MAX_SPARKS = 10;     // max live sparkle dots
const SPARK_LIFE = 600;    // ms a spark lives before fading out


// ── Theme palette ─────────────────────────────────────────────
interface ThemePalette {
  core: string;       // bright centre of orb
  halo: string;       // soft outer bloom
  spark: string;      // sparkle dot color
  coreOpacity: number;
  haloOpacity: number;
}

function getPalette(themeStyle: string): ThemePalette {
  switch (themeStyle) {
    case 'retro':
      return {
        core:        'rgba(255, 200, 50,  1)',
        halo:        'rgba(255, 120, 0,   0.55)',
        spark:       'rgba(255, 200, 50,  0.9)',
        coreOpacity: 0.92,
        haloOpacity: 0.38,
      };
    case 'light':
      return {
        core:        'rgba(120, 100, 255, 0.7)',
        halo:        'rgba(139, 92,  246, 0.22)',
        spark:       'rgba(120, 100, 255, 0.75)',
        coreOpacity: 0.65,
        haloOpacity: 0.22,
      };
    case 'cyber-dark':
    default:
      return {
        core:        'rgba(0,   240, 255, 1)',
        halo:        'rgba(0,   140, 220, 0.5)',
        spark:       'rgba(0,   240, 255, 0.95)',
        coreOpacity: 0.9,
        haloOpacity: 0.35,
      };
  }
}

// ── Spark pool entry ──────────────────────────────────────────
interface Spark {
  el: HTMLDivElement;
  x: number;
  y: number;
  dx: number;   // drift velocity x
  dy: number;   // drift velocity y
  born: number; // timestamp
  alive: boolean;
}

export function CursorGlow() {
  const coreRef  = useRef<HTMLDivElement>(null);
  const haloRef  = useRef<HTMLDivElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches)          return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const core   = coreRef.current;
    const halo   = haloRef.current;
    const sparksContainer = sparksRef.current;
    if (!core || !halo || !sparksContainer) return;

    // ── Positions ──────────────────────────────────────────────
    let mouseX = -200, mouseY = -200;
    let coreX  = -200, coreY  = -200;
    let haloX  = -200, haloY  = -200;
    let isVisible = false;
    let rafId: number;

    // ── Spark pool ─────────────────────────────────────────────
    const pool: Spark[] = Array.from({ length: MAX_SPARKS }, () => {
      const el = document.createElement('div');
      el.className = 'cursor-spark';
      sparksContainer.appendChild(el);
      return { el, x: 0, y: 0, dx: 0, dy: 0, born: 0, alive: false };
    });

    let lastSparkTime = 0;
    const SPARK_INTERVAL = 40; // ms between spark spawns while moving

    function spawnSpark(x: number, y: number, palette: ThemePalette) {
      const now = performance.now();
      if (now - lastSparkTime < SPARK_INTERVAL) return;
      lastSparkTime = now;

      const slot = pool.find(s => !s.alive);
      if (!slot) return;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 0.6;

      slot.x     = x + (Math.random() - 0.5) * 10;
      slot.y     = y + (Math.random() - 0.5) * 10;
      slot.dx    = Math.cos(angle) * speed;
      slot.dy    = Math.sin(angle) * speed;
      slot.born  = now;
      slot.alive = true;

      const size = 2 + Math.random() * 2.5; // 2–4.5 px
      slot.el.style.cssText = `
        width:${size}px;
        height:${size}px;
        background:${palette.spark};
        box-shadow:0 0 ${size * 2}px ${palette.spark};
        opacity:1;
        transform:translate3d(${slot.x}px,${slot.y}px,0) translate(-50%,-50%);
      `;
    }

    function updateSparks(now: number) {
      for (const s of pool) {
        if (!s.alive) continue;
        const age = now - s.born;
        if (age >= SPARK_LIFE) {
          s.alive = false;
          s.el.style.opacity = '0';
          continue;
        }
        const progress = age / SPARK_LIFE;          // 0 → 1
        const opacity  = 1 - progress;              // linear fade
        s.x += s.dx + (Math.random() - 0.5) * 0.3; // slight jitter
        s.y += s.dy + (Math.random() - 0.5) * 0.3;
        // drift outward
        s.x += s.dx * 0.15;
        s.y += s.dy * 0.15;

        s.el.style.opacity   = String(opacity.toFixed(3));
        s.el.style.transform = `translate3d(${s.x}px,${s.y}px,0) translate(-50%,-50%)`;
      }
    }

    // ── Mouse handlers ─────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) {
        isVisible = true;
        const p = getPalette(document.documentElement.getAttribute('data-theme-style') ?? 'cyber-dark');
        core.style.opacity = String(p.coreOpacity);
        halo.style.opacity = String(p.haloOpacity);
      }
    };

    const onMouseLeave = () => {
      isVisible = false;
      core.style.opacity = '0';
      halo.style.opacity = '0';
    };

    // ── rAF loop ───────────────────────────────────────────────
    const tick = () => {
      const now = performance.now();

      // Lerp positions
      coreX += (mouseX - coreX) * LERP_CORE;
      coreY += (mouseY - coreY) * LERP_CORE;
      haloX += (mouseX - haloX) * LERP_HALO;
      haloY += (mouseY - haloY) * LERP_HALO;

      core.style.transform = `translate3d(${coreX}px,${coreY}px,0) translate(-50%,-50%)`;
      halo.style.transform = `translate3d(${haloX}px,${haloY}px,0) translate(-50%,-50%)`;

      // Theme-aware gradient (re-read each frame for instant theme switch)
      const themeStyle = document.documentElement.getAttribute('data-theme-style') ?? 'cyber-dark';
      const p = getPalette(themeStyle);

      core.style.background = `radial-gradient(circle, ${p.core} 0%, transparent 70%)`;
      halo.style.background = `radial-gradient(circle, ${p.halo} 0%, transparent 65%)`;

      // Sparks — only spawn when cursor is moving
      const moving = Math.abs(mouseX - coreX) > 1.5 || Math.abs(mouseY - coreY) > 1.5;
      if (isVisible && moving) spawnSpark(coreX, coreY, p);
      updateSparks(now);

      rafId = requestAnimationFrame(tick);
    };

    document.addEventListener('mousemove',  onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    rafId = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('mousemove',  onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(rafId);
      // Clean up pooled DOM nodes
      pool.forEach(s => s.el.remove());
    };
  }, []);

  return (
    <>
      {/* Soft outer bloom — lags behind cursor */}
      <div ref={haloRef}  className="cursor-halo"  aria-hidden="true" />
      {/* Tight neon core — follows cursor closely */}
      <div ref={coreRef}  className="cursor-core"  aria-hidden="true" />
      {/* Sparkle container — dots injected by JS pool */}
      <div ref={sparksRef} className="cursor-sparks" aria-hidden="true" />
    </>
  );
}
