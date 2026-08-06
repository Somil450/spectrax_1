import { useEffect, useRef, useState } from 'react';

const LERP_CORE  = 0.2;
const LERP_HALO  = 0.1;
const MAX_SPARKS = 14;
const SPARK_LIFE = 500;

interface ThemePalette {
  core: string;
  halo: string;
  spark: string;
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

interface Spark {
  el: HTMLDivElement;
  x: number;
  y: number;
  dx: number;
  dy: number;
  born: number;
  alive: boolean;
}

export type CursorMode = 'default' | 'glow' | 'trail' | 'sparkle' | 'orbit';

export function CursorGlow() {
  const coreRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);

  const [currentMode, setCurrentMode] = useState<CursorMode>('sparkle');

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const core = coreRef.current;
    const halo = haloRef.current;
    const sparksContainer = sparksRef.current;
    const orbit = orbitRef.current;
    if (!core || !halo || !sparksContainer || !orbit) return;

    if (currentMode === 'default') {
      core.style.opacity = '0';
      halo.style.opacity = '0';
      orbit.style.opacity = '0';
      sparksContainer.style.opacity = '0';
      document.body.style.cursor = 'auto';
      return;
    } else {
      document.body.style.cursor = 'none';
      sparksContainer.style.opacity = '1';
    }

    let mouseX = -200, mouseY = -200;
    let coreX = -200, coreY = -200;
    let haloX = -200, haloY = -200;
    let isVisible = false;
    let rafId: number;
    let angleTheta = 0;

    const pool: Spark[] = Array.from({ length: MAX_SPARKS }, () => {
      const el = document.createElement('div');
      el.className = 'cursor-spark';
      sparksContainer.appendChild(el);
      return { el, x: 0, y: 0, dx: 0, dy: 0, born: 0, alive: false };
    });

    let lastSpawn = 0;

    function spawnParticle(x: number, y: number, palette: ThemePalette, mode: CursorMode) {
      const now = performance.now();
      const interval = mode === 'trail' ? 20 : 45;
      if (now - lastSpawn < interval) return;
      lastSpawn = now;

      const slot = pool.find(s => !s.alive);
      if (!slot) return;

      const angle = Math.random() * Math.PI * 2;
      const speed = mode === 'trail' ? 0.1 : (0.8 + Math.random() * 1.2);

      slot.x = x + (Math.random() - 0.5) * 6;
      slot.y = y + (Math.random() - 0.5) * 6;
      slot.dx = Math.cos(angle) * speed;
      slot.dy = Math.sin(angle) * speed;
      slot.born = now;
      slot.alive = true;

      const size = mode === 'trail' ? (4 + Math.random() * 3) : (2 + Math.random() * 2.5);
      slot.el.style.cssText = `
        width:${size}px;
        height:${size}px;
        background:${mode === 'trail' ? palette.halo : palette.spark};
        box-shadow:0 0 ${size * 2}px ${palette.spark};
        opacity:1;
        transform:translate3d(${slot.x}px,${slot.y}px,0) translate(-50%,-50%);
        border-radius: ${mode === 'trail' ? '30%' : '50%'};
      `;
    }

    function updateParticles(now: number) {
      for (const s of pool) {
        if (!s.alive) continue;
        const age = now - s.born;
        if (age >= SPARK_LIFE) {
          s.alive = false;
          s.el.style.opacity = '0';
          continue;
        }
        const progress = age / SPARK_LIFE;
        const opacity = 1 - progress;
        s.x += s.dx;
        s.y += s.dy;

        s.el.style.opacity = String(opacity.toFixed(3));
        s.el.style.transform = `translate3d(${s.x}px,${s.y}px,0) translate(-50%,-50%)`;
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) {
        isVisible = true;
      }
    };

    const onMouseLeave = () => {
      isVisible = false;
      core.style.opacity = '0';
      halo.style.opacity = '0';
      orbit.style.opacity = '0';
    };

    const tick = () => {
      const now = performance.now();

      coreX += (mouseX - coreX) * LERP_CORE;
      coreY += (mouseY - coreY) * LERP_CORE;
      haloX += (mouseX - haloX) * LERP_HALO;
      haloY += (mouseY - haloY) * LERP_HALO;

      const themeStyle = document.documentElement.getAttribute('data-theme-style') ?? 'cyber-dark';
      const p = getPalette(themeStyle);

      core.style.opacity = '0';
      halo.style.opacity = '0';
      orbit.style.opacity = '0';

      if (isVisible) {
        if (currentMode === 'glow') {
          core.style.opacity = String(p.coreOpacity);
          halo.style.opacity = String(p.haloOpacity);
          core.style.transform = `translate3d(${coreX}px,${coreY}px,0) translate(-50%,-50%)`;
          halo.style.transform = `translate3d(${haloX}px,${haloY}px,0) translate(-50%,-50%)`;
          core.style.background = `radial-gradient(circle, ${p.core} 0%, transparent 70%)`;
          halo.style.background = `radial-gradient(circle, ${p.halo} 0%, transparent 65%)`;
        } else if (currentMode === 'sparkle' || currentMode === 'trail') {
          core.style.opacity = String(p.coreOpacity * 0.8);
          core.style.transform = `translate3d(${coreX}px,${coreY}px,0) translate(-50%,-50%)`;
          core.style.background = p.core;
          
          const moving = Math.abs(mouseX - coreX) > 0.8 || Math.abs(mouseY - coreY) > 0.8;
          if (moving) {
            spawnParticle(coreX, coreY, p, currentMode);
          }
        } else if (currentMode === 'orbit') {
          angleTheta += 0.08;
          orbit.style.opacity = '1';
          core.style.opacity = String(p.coreOpacity);
          
          core.style.transform = `translate3d(${coreX}px,${coreY}px,0) translate(-50%,-50%)`;
          core.style.background = p.core;
          
          orbit.style.transform = `translate3d(${coreX}px, ${coreY}px, 0) rotate(${angleTheta}rad)`;
          orbit.style.border = `2px dotted ${p.core}`;
          orbit.style.boxShadow = `0 0 10px ${p.halo}`;
        }
      }

      updateParticles(now);
      rafId = requestAnimationFrame(tick);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    rafId = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.body.style.cursor = 'auto';
      cancelAnimationFrame(rafId);
      pool.forEach(s => s.el.remove());
    };
  }, [currentMode]);

  return (
    <>
      <div ref={haloRef} className="cursor-halo" aria-hidden="true" />
      <div ref={coreRef} className="cursor-core" aria-hidden="true" />
      <div ref={orbitRef} className="cursor-orbit" aria-hidden="true" />
      <div ref={sparksRef} className="cursor-sparks" aria-hidden="true" />

      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        background: 'rgba(10, 15, 30, 0.85)',
        border: '1px solid rgba(0, 240, 255, 0.3)',
        borderRadius: '8px',
        padding: '8px 12px',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}>
        <span style={{ opacity: 0.8, fontWeight: 500 }}>Cursor Style:</span>
        <select
          value={currentMode}
          onChange={(e) => setCurrentMode(e.target.value as CursorMode)}
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#00f0ff',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            borderRadius: '4px',
            padding: '4px 8px',
            outline: 'none',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          <option value="default">Default</option>
          <option value="sparkle">Sparkle Burst</option>
          <option value="glow">Glow Orb</option>
          <option value="trail">Smooth Trail</option>
          <option value="orbit">Orbit Ring</option>
        </select>
      </div>
    </>
  );
}