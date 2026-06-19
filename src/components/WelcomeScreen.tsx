import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Sparkles,
  History,
  Trophy,
  User,
  Camera,
  Activity,
  BarChart3,
  Github,
  FileText,
  GitFork,
  Star,
  Scale,
  Target,
} from "lucide-react";
import { getSavedUserWeight, saveUserWeight } from "../utils/calorieEstimator";
import { calculateBMI, bmiCategoryColor } from "../utils/fitnessCalculations";
import "../styles/WelcomeScreen.css";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useTheme } from "../context/ThemeContext";
import { debounce } from "../utils/debounce";

const STATS = [
  { value: "30+", label: "FPS tracking" },
  { value: "6", label: "exercises" },
  { value: "< 1s", label: "feedback lag" },
];

interface ActivePlan {
  id: string;
  goal: string;
  level: string;
  week: number;
  totalWeeks: number;
  progress: number;
  name: string;
}

interface WelcomeScreenProps {
  onStart: () => void;
  onViewHistory: () => void;
  onViewTrophies: () => void;
  onViewProfile?: () => void;
  onViewFitnessCalculator?: () => void;
  onViewWorkoutPlans: () => void;
  leveling?: {
    xp: number;
    level: number;
    progress: number;
    nextLevelXp: number;
  };
  pendingRecovery?: { stats: any; exerciseKey: string } | null;
  onApplyRecovery?: () => void;
  onDiscardRecovery?: () => void;
  activePlan?: ActivePlan | null;
  onStartWorkout?: (exerciseKey: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  onViewHistory,
  onViewTrophies,
  onViewFitnessCalculator,
  onViewWorkoutPlans,
  leveling,
  pendingRecovery,
  onApplyRecovery,
  onDiscardRecovery,
  activePlan,
  onStartWorkout,
}) => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [userWeight, setUserWeight] = useState<string>(
    String(getSavedUserWeight() ?? ""),
  );
  const [userHeight, setUserHeight] = useState<string>("");
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
    let particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }[] = [];

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
      data-theme={theme === "light" ? "light" : "dark"}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="welcome-canvas particle-canvas" />
      <div className="welcome-orb welcome-orb--cyan" aria-hidden="true" />
      <div className="welcome-orb welcome-orb--purple" aria-hidden="true" />

      <div className="welcome-scroll-area">
        <div className="welcome-scroll-inner">
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
            <p className="welcome-tagline">Train smarter. Every rep counts.</p>

            {leveling && (
              <div className="welcome-level-bar">
                <div className="welcome-level-bar__header">
                  <span className="welcome-level-bar__label">
                    Level {leveling.level}
                  </span>
                  <span className="welcome-level-bar__xp">
                    {leveling.xp} / {leveling.nextLevelXp} XP
                  </span>
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
                  onClick={onViewWorkoutPlans}
                  className="welcome-btn-secondary welcome-btn-secondary--purple"
                  aria-label="View Workout Plans"
                  tabIndex={0}
                >
                  <Target size={15} />
                  Plans
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
                {onViewFitnessCalculator && (
                  <button
                    onClick={onViewFitnessCalculator}
                    className="welcome-btn-secondary welcome-btn-secondary--green"
                    aria-label="View BMI Calculator"
                    tabIndex={0}
                  >
                    <Scale size={15} />
                    BMI
                  </button>
                )}
              </div>
            </div>

            {activePlan && (
              <div className="active-plan-card">
                <div className="active-plan-header">
                  <Target size={18} />
                  <span>Active Plan</span>
                </div>
                <div className="active-plan-content">
                  <div className="active-plan-info">
                    <div className="active-plan-name">{activePlan.name}</div>
                    <div className="active-plan-meta">
                      {activePlan.goal} • {activePlan.level}
                    </div>
                  </div>
                  <div className="active-plan-progress">
                    <div className="progress-text">
                      Week {activePlan.week} / {activePlan.totalWeeks} •{" "}
                      {activePlan.progress}%
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${activePlan.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  className="active-plan-continue-btn"
                  onClick={() => {
                    if (onStartWorkout) onStartWorkout("plan-workout");
                    else onStart();
                  }}
                >
                  Continue Plan
                </button>
              </div>
            )}

            {/* BMI Calculator Section */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginTop: "12px",
                background: "rgba(0,255,200,0.05)",
                border: "1px solid rgba(0,255,200,0.2)",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--neon-cyan)",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="200"
                    placeholder="70"
                    value={userWeight}
                    aria-label="User weight in kilograms"
                    onChange={(e) => {
                      setUserWeight(e.target.value);
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 30 && val <= 200)
                        saveUserWeight(val);
                    }}
                    style={{
                      background: "rgba(0,255,200,0.1)",
                      border: "1px solid rgba(0,255,200,0.3)",
                      outline: "none",
                      color: "#fff",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--neon-green)",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="250"
                    placeholder="175"
                    value={userHeight}
                    aria-label="User height in centimeters"
                    onChange={(e) => setUserHeight(e.target.value)}
                    style={{
                      background: "rgba(0,255,200,0.1)",
                      border: "1px solid rgba(0,255,200,0.3)",
                      outline: "none",
                      color: "#fff",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {userWeight &&
                userHeight &&
                (() => {
                  const weight = parseFloat(userWeight);
                  const height = parseFloat(userHeight);
                  if (
                    weight > 0 &&
                    height > 0 &&
                    weight >= 30 &&
                    weight <= 200 &&
                    height >= 100 &&
                    height <= 250
                  ) {
                    const bmiResult = calculateBMI(weight, height);
                    const categoryColor = bmiCategoryColor(bmiResult.category);
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px",
                          background: `${categoryColor}15`,
                          border: `1px solid ${categoryColor}40`,
                          borderRadius: "8px",
                          marginTop: "4px",
                        }}
                      >
                        <Scale size={18} style={{ color: categoryColor }} />
                        <div>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--text-dim)",
                              letterSpacing: "1px",
                              textTransform: "uppercase",
                            }}
                          >
                            BMI:
                          </span>
                          <span
                            style={{
                              fontSize: "1.2rem",
                              fontWeight: 700,
                              color: categoryColor,
                              marginLeft: "6px",
                            }}
                          >
                            {bmiResult.bmi}
                          </span>
                          <span
                            style={{
                              fontSize: "0.85rem",
                              color: categoryColor,
                              marginLeft: "10px",
                            }}
                          >
                            ({bmiResult.category})
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
            </div>
          </div>

          {pendingRecovery && (
            <div className="glass animate-in" style={{ margin: '20px auto', maxWidth: '500px', padding: '16px 20px', border: '1px solid var(--neon-yellow)', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--neon-yellow)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
                ⚡ Active Session Recovery
              </div>
              <div style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '12px' }}>
                {pendingRecovery.stats.exerciseName || 'Workout'} — {pendingRecovery.stats.totalReps} reps, {Math.round(pendingRecovery.stats.accuracy || 0)}% accuracy
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={() => onApplyRecovery?.()} className="btn-neon" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                  Resume Session
                </button>
                <button onClick={() => onDiscardRecovery?.()} className="btn-neon" style={{ padding: '8px 16px', fontSize: '0.8rem', background: 'transparent', borderColor: 'var(--neon-red)', color: 'var(--neon-red)' }}>
                  Discard
                </button>
              </div>
            </div>
          )}

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

          <div className="how-it-works-section" style={{ marginTop: "60px" }}>
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
                  {
                    icon: User,
                    title: "Welcome",
                    desc: "Choose an exercise or let the AI auto-detect",
                    step: "01",
                    color: "#00f0ff",
                  },
                  {
                    icon: Camera,
                    title: "Calibration",
                    desc: "Align with the camera for optimal tracking",
                    step: "02",
                    color: "#00ffcc",
                  },
                  {
                    icon: Activity,
                    title: "Workout",
                    desc: "Start exercising with live real-time rep counting",
                    step: "03",
                    color: "#00f0ff",
                  },
                  {
                    icon: BarChart3,
                    title: "Summary",
                    desc: "Review detailed post-workout analytics and streaks",
                    step: "04",
                    color: "#00ffcc",
                  },
                ].map((step, idx) => (
                  <div key={idx} className="step-card">
                    <div
                      className="step-watermark"
                      style={{ color: step.color }}
                    >
                      {step.step}
                    </div>
                    <div
                      className="step-icon-wrapper"
                      style={{ borderColor: `${step.color}30` }}
                    >
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

          <footer className="footer" style={{ marginTop: "60px" }}>
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
                        <a
                          href="#"
                          className="footer-link"
                          onClick={(e) => e.preventDefault()}
                        >
                          {item}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="footer-column">
                  <h4 className="footer-column-title">RESOURCES</h4>
                  <ul className="footer-links">
                    <li>
                      <a
                        href="https://github.com/Somil450/spectrax_1"
                        className="footer-link"
                      >
                        <Github size={14} /> GitHub
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://github.com/Somil450/spectrax_1/blob/main/README.md"
                        className="footer-link"
                      >
                        <FileText size={14} /> Documentation
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://github.com/Somil450/spectrax_1/discussions"
                        className="footer-link"
                      >
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
                        <a
                          href="#"
                          className="footer-link"
                          onClick={(e) => e.preventDefault()}
                        >
                          {item}
                        </a>
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
