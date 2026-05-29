import React, { useEffect, useRef, useState } from "react";
import { Play, Sparkles, History, Trophy, User, Camera, Activity, BarChart3, Github, FileText, GitFork, Star } from "lucide-react";
import { getSavedUserWeight, saveUserWeight } from "../utils/calorieEstimator";
import "../styles/WelcomeScreen.css";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { debounce } from "../utils/debounce";
import { useTheme } from "../context/ThemeContext";

const STATS = [
  { value: "30+", label: "FPS tracking" },
  { value: "6", label: "exercises" },
  { value: "< 1s", label: "feedback lag" },
];

interface WelcomeScreenProps {
  onStart: () => void;
  onViewHistory: () => void;
  onViewTrophies: () => void;
  onViewProfile?: () => void;
  onViewFitnessCalculator?: () => void;
  leveling?: {
    xp: number;
    level: number;
    progress: number;
    nextLevelXp: number;
  };
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  onViewHistory,
  onViewTrophies,
  leveling,
}) => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [userWeight, setUserWeight] = useState<string>(
    String(getSavedUserWeight() ?? "")
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile || prefersReducedMotion) return;
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
    if (prefersReducedMotion) return;
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
  }, [prefersReducedMotion]);

  return (
    <div
      className="welcome-container"
      data-theme={theme}
  data-theme-style={theme}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Particle canvas & Orbs */}
      <canvas ref={canvasRef} className="welcome-canvas particle-canvas" />
      <div className="welcome-orb welcome-orb--cyan" aria-hidden="true" />
      <div className="welcome-orb welcome-orb--purple" aria-hidden="true" />

      {/* Scrolling wrapper (From maintainer's branch) */}
      <div className="welcome-scroll-area">
        <div className="welcome-scroll-inner">
          
          {/* ── Hero Section (Maintainer's updated structure) ── */}
          <div
            className="welcome-hero animate-in"
            style={{
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: "transform 0.15s ease-out",
            }}
          >
            <div className="welcome-eyebrow" aria-hidden="true">
              <span className="welcome-eyebrow__dot" />
              AI-Powered Fitness
            </div>

            <h1 className="welcome-wordmark">SPECTRAX</h1>

            <p className="welcome-tagline">
              Train smarter. Every rep counts.
            </p>

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

{/* Weight input for calorie estimation */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "12px",
    background: "rgba(0,255,100,0.04)",
    border: "1px solid rgba(0,255,100,0.2)",
    borderRadius: "10px",
    padding: "10px 14px",
  }}
>
                  <span>⚖️</span>
                  <span style={{ fontSize:'0.7rem', color:'var(--neon-green)', letterSpacing:'1px', textTransform:'uppercase' }}>Weight:</span>
                  <input
                    type="number" min="30" max="200" placeholder="70"
                    value={userWeight}
                    aria-label="User weight in kilograms"
                    onChange={(e) => {
                      setUserWeight(e.target.value);
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 30 && val <= 200) saveUserWeight(val);
                    }}
                    style={{ background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:'1rem', fontWeight:700, width:'50px' }}
                  />
                  <span style={{ color:'var(--text-dim)', fontSize:'0.8rem' }}>kg</span>
                </div>

              </div>
            </div>

          {/* ── Stat strip (From maintainer's branch) ── */}
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

          {/* ── How it Works Section (From your branch) ── */}
          <div className="how-it-works-section" style={{ marginTop: '60px' }}>
            <div className="section-container">
              <div className="section-header">
                <div className="section-badge">
                  <Sparkles size={14} color="#00f0ff" />
                  <span>THE PROCESS</span>
                </div>
                <h2 className="section-title">How It Works</h2>
                <p className="section-description">
                  Four simple steps to transform your workout experience
                </p>
              </div>

              <div className="steps-grid">
                {[
                  { icon: User, title: "Welcome", desc: "Choose an exercise or let the AI auto-detect", step: "01", color: "#00f0ff" },
                  { icon: Camera, title: "Calibration", desc: "Align with the camera for optimal tracking", step: "02", color: "#00ffcc" },
                  { icon: Activity, title: "Workout", desc: "Start exercising with live real-time rep counting", step: "03", color: "#00f0ff" },
                  { icon: BarChart3, title: "Summary", desc: "Review detailed post-workout analytics and streaks", step: "04", color: "#00ffcc" },
                ].map((step, idx) => (
                  <div key={idx} className="step-card">
                    <div className="step-watermark" style={{ color: step.color }}>
                      {step.step}
                    </div>
                    <div className="step-icon-wrapper" style={{ borderColor: `${step.color}30` }}>
                      <step.icon size={32} color={step.color} />
                    </div>
                    <h3 className="step-title" style={{ color: step.color }}>
                      {step.title}
                    </h3>
                    <p className="step-description">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Footer Section (From your branch) ── */}
          <footer className="footer" style={{ marginTop: '60px' }}>
            <div className="footer-container">
              <div className="footer-grid">
                <div className="footer-column">
                  <h3 className="footer-brand-name">SPECTRAX</h3>
                  <p className="footer-brand-desc">
                    Precision Performance Research Lab.
                  </p>
                  <div className="footer-badge">
                    <GitFork size={12} color="#00f0ff" />
                    <span>GSSoC 2026</span>
                  </div>
                </div>

                <div className="footer-column">
                  <h4 className="footer-column-title">PRODUCT</h4>
                  <ul className="footer-links">
                    {["Features", "Usage", "API"].map((item) => (
                      <li key={item}>
                        <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{item}</a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="footer-column">
                  <h4 className="footer-column-title">RESOURCES</h4>
                  <ul className="footer-links">
                    <li>
                      <a href="https://github.com/Somil450/spectrax_1" className="footer-link">
                        <Github size={14} /> GitHub
                      </a>
                    </li>
                    <li>
                      <a href="https://github.com/Somil450/spectrax_1/blob/main/README.md" className="footer-link">
                        <FileText size={14} /> Documentation
                      </a>
                    </li>
                    <li>
                      <a href="https://github.com/Somil450/spectrax_1/discussions" className="footer-link">
                        <Star size={14} /> Community
                      </a>
                    </li>
                  </ul>
                </div>

                <div className="footer-column">
                  <h4 className="footer-column-title">LEGAL</h4>
                  <ul className="footer-links">
                    {["MIT License", "Privacy", "Terms"].map((item) => (
                      <li key={item}>
                        <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{item}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="footer-copyright">
                <p>© 2026 SpectraX. All rights reserved.</p>
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
