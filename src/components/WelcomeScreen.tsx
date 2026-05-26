import React, { useEffect, useRef, useState } from "react";
import { Play, Sparkles, History, Trophy, User, Activity } from "lucide-react";
import { getSavedUserWeight } from "../utils/calorieEstimator";
import "../styles/WelcomeScreen.css";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

interface WelcomeScreenProps {
  onStart: () => void;
  onViewHistory: () => void;
  onViewTrophies: () => void;
  onViewProfile?: () => void;
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
  onViewProfile,
  leveling,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [userWeight, setUserWeight] = useState<string>(
    String(getSavedUserWeight() ?? "")
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

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
      data-theme={isDarkMode ? "dark" : "light"}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Dark Mode Toggle */}
      <button
        className="dark-mode-toggle"
        onClick={toggleDarkMode}
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDarkMode ? "☀️" : "🌙"}
      </button>

      {/* Particle canvas & Orbs */}
      <canvas ref={canvasRef} className="particle-canvas" />
      <div className="welcome-orb welcome-orb--cyan" aria-hidden="true" />
      <div className="welcome-orb welcome-orb--purple" aria-hidden="true" />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content animate-in">
          {/* Level Display */}
          {leveling && (
            <div className="level-display">
              <span className="level-label">LEVEL {leveling.level}</span>
              <div className="level-progress-bar">
                <div
                  className="level-progress-fill"
                  style={{ width: `${leveling.progress}%` }}
                />
              </div>
              <span className="level-xp">
                {leveling.xp} / {leveling.nextLevelXp} XP
              </span>
            </div>
          )}

          {/* Badge Eyebrow */}
          <div className="badge">
            <Sparkles size={14} color="var(--neon-cyan)" />
            <span>AI CALIBRATION SYSTEM 2.0</span>
          </div>

          {/* Main Title */}
          <h1 className="main-title">SPECTRAX</h1>

          {/* Subtitle */}
          <p className="subtitle">Real-time Pose Tracking & Performance Analysis</p>

          {/* Button Group */}
          <div className="button-group">
            <button onClick={onStart} className="btn-primary" tabIndex={0}>
              INITIALIZE SYSTEM <Play size={18} fill="currentColor" />
            </button>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
              <button
                onClick={onViewHistory}
                className="btn-secondary btn-cyan"
                tabIndex={0}
              >
                <History size={15} /> VIEW HISTORY
              </button>

              <button
                onClick={onViewTrophies}
                className="btn-secondary btn-gold"
                tabIndex={0}
              >
                <Trophy size={15} /> TROPHIES
              </button>

              {onViewProfile && (
                <button
                  onClick={onViewProfile}
                  className="btn-secondary btn-cyan"
                  tabIndex={0}
                  style={{ opacity: 0.85 }}
                >
                  <User size={15} /> PROFILE
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="section-container">
          <div className="section-header">
            <div className="section-badge">
              <span>HOW IT WORKS</span>
            </div>
            <h2 className="section-title">TRAIN WITH AI PRECISION</h2>
            <p className="section-description">
              SpectraX tracks your joints in real-time, helping you improve form, count reps automatically, and avoid injuries.
            </p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-watermark">01</span>
              <div className="step-icon-wrapper" style={{ borderColor: "var(--neon-cyan)" }}>
                <Activity size={24} color="var(--neon-cyan)" />
              </div>
              <h3 className="step-title">Position</h3>
              <p className="step-description">
                Calibrate your camera to detect key body markers accurately before starting your workout.
              </p>
            </div>

            <div className="step-card">
              <span className="step-watermark">02</span>
              <div className="step-icon-wrapper" style={{ borderColor: "var(--neon-cyan)" }}>
                <Play size={24} color="var(--neon-cyan)" />
              </div>
              <h3 className="step-title">Execute</h3>
              <p className="step-description">
                Perform your exercises. The AI counts reps and checks angles using low-latency model processing.
              </p>
            </div>

            <div className="step-card">
              <span className="step-watermark">03</span>
              <div className="step-icon-wrapper" style={{ borderColor: "var(--neon-yellow)" }}>
                <Trophy size={24} color="var(--neon-yellow)" />
              </div>
              <h3 className="step-title">Analyze</h3>
              <p className="step-description">
                Receive visual biomechanics logs, replay clips of your set, and level up your workout grade.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-copyright">
            Precision Performance Research Lab © {new Date().getFullYear()} — SpectraX AI Tracker
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WelcomeScreen;