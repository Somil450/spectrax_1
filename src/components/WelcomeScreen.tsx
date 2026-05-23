import React, { useEffect, useRef, useState } from "react";
import { Play, History, Trophy } from "lucide-react";

interface WelcomeScreenProps {
  onStart: () => void;
  onViewHistory: () => void;
  onViewTrophies: () => void;
  leveling?: {
    xp: number;
    level: number;
    progress: number;
    nextLevelXp: number;
  };
}

const STATS = [
  { value: "30+", label: "FPS tracking" },
  { value: "6", label: "exercises" },
  { value: "< 1s", label: "feedback lag" },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  onViewHistory,
  onViewTrophies,
  leveling,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = -((clientY - innerHeight / 2) / innerHeight) * 14;
    const y = ((clientX - innerWidth / 2) / innerWidth) * 14;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: { x: number; y: number; vx: number; vy: number; radius: number }[] = [];

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      const count = window.innerWidth < 640 ? 30 : 60;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 1.5 + 0.5,
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 240, 255, 0.3)";
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.1 * (1 - dist / 150)})`;
            ctx.stroke();
          }
        }
      }
      animationId = requestAnimationFrame(animate);
    };

    init();
    animate();
    const handleResize = () => init();
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      className="screen-container welcome-screen"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="welcome-canvas" />

      {/* Decorative radial glow orbs */}
      <div className="welcome-orb welcome-orb--cyan" aria-hidden="true" />
      <div className="welcome-orb welcome-orb--purple" aria-hidden="true" />

      <div className="welcome-scroll-area">
        <div className="welcome-scroll-inner">
          {/* ── Hero ── */}
        <div
          className="welcome-hero animate-in"
          style={{
            transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: "transform 0.15s ease-out",
          }}
        >
          {/* Eyebrow */}
          <div className="welcome-eyebrow" aria-hidden="true">
            <span className="welcome-eyebrow__dot" />
            AI-Powered Fitness
          </div>

          {/* Wordmark */}
          <h1 className="welcome-wordmark">SPECTRAX</h1>

          {/* Tagline */}
          <p className="welcome-tagline">
            Train smarter. Every rep counts.
          </p>

          {/* Level bar — only when user has progress data */}
          {leveling && (
            <div className="welcome-level-bar">
              <div className="welcome-level-bar__header">
                <span className="welcome-level-bar__label">Level {leveling.level}</span>
                <span className="welcome-level-bar__xp">{leveling.xp} / {leveling.nextLevelXp} XP</span>
              </div>
              <div className="welcome-level-bar__track">
                <div
                  className="welcome-level-bar__fill"
                  style={{ width: `${leveling.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* CTA buttons */}
          <div className="welcome-actions">
            <button
              onClick={onStart}
              className="btn-neon welcome-btn-primary"
              aria-label="Start Training"
              tabIndex={0}
            >
              <Play size={16} fill="currentColor" />
              Start Training
            </button>

            <div className="welcome-btn-row">
              <button
                onClick={onViewHistory}
                className="welcome-btn-secondary welcome-btn-secondary--cyan"
                aria-label="View Workout History"
                tabIndex={0}
              >
                <History size={15} />
                History
              </button>

              <button
                onClick={onViewTrophies}
                className="welcome-btn-secondary welcome-btn-secondary--gold"
                aria-label="View Trophy Room"
                tabIndex={0}
              >
                <Trophy size={15} />
                Trophies
              </button>
            </div>
          </div>
        </div>

        {/* ── Stat strip ── */}
        <div className="welcome-stats">
          {STATS.map(({ value, label }, i) => (
            <React.Fragment key={label}>
              <div className="welcome-stat">
                <span className="welcome-stat__value">{value}</span>
                <span className="welcome-stat__label">{label}</span>
              </div>
              {i < STATS.length - 1 && (
                <div className="welcome-stat-divider" aria-hidden="true" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Footer ── */}
        <footer className="welcome-footer">
          Precision Performance Research Lab
        </footer>
        </div>{/* /welcome-scroll-inner */}
      </div>
    </div>
  );
};
