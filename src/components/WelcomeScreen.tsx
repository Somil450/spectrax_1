import React, { useEffect, useRef, useState } from "react";
import { Play, Sparkles, History, Trophy, User, Camera, Activity, BarChart3, Github, FileText, GitFork, Star } from "lucide-react";
import { getSavedUserWeight, saveUserWeight } from "../utils/calorieEstimator";
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

const STATS = [
  { value: "30+", label: "FPS tracking" },
  { value: "6", label: "exercises" },
  { value: "< 1s", label: "feedback lag" },
];

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
    String(getSavedUserWeight() ?? '')
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
      className="screen-container welcome-screen welcome-container"
      data-theme={isDarkMode ? "dark" : "light"}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Dark Mode Toggle (From your branch) */}
      <button
        className="dark-mode-toggle"
        onClick={toggleDarkMode}
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 50 }}
      >
        {isDarkMode ? "☀️" : "🌙"}
      </button>

      {/* Particle canvas & Orbs (Merged) */}
      <canvas ref={canvasRef} className="welcome-canvas particle-canvas" />
      <div className="welcome-orb welcome-orb--cyan" aria-hidden="true" />
      <div className="welcome-orb welcome-orb--purple" aria-hidden="true" />

        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(3.5rem, 14vw, 7rem)",
            fontWeight: 900,
            letterSpacing: "14px",
            color: "var(--neon-cyan)",
            textShadow:
              "0 0 20px rgba(0,240,255,0.8), 0 0 40px rgba(0,240,255,0.6), 0 0 60px rgba(0,240,255,0.4), 0 0 80px rgba(0,240,255,0.2)",
            margin: "20px 0",
            fontStyle: "normal",
            textTransform: "uppercase",
          }}
        >
          SPECTRAX
        </h1>

        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "1rem",
            letterSpacing: "3px",
            fontWeight: 300,
            marginBottom: "48px",
          }}
        >
          Real-time Pose Tracking & Performance Analysis
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <button onClick={onStart} className="btn-neon" tabIndex={0}>
            INITIALIZE SYSTEM <Play size={18} fill="currentColor" />
          </button>

          <button
            onClick={onViewHistory}
            tabIndex={0}
            style={{
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: "transform 0.15s ease-out",
            }}
          >
            <div className="welcome-eyebrow" aria-hidden="true">
              <span className="welcome-eyebrow__dot" />
              AI-Powered Fitness
            </div>

      <div
        style={{
          position: "absolute",
          bottom: "40px",
          left: "0",
          right: "0",
          color: "var(--text-secondary)",
          fontSize: "0.7rem",
          letterSpacing: "4px",
          textTransform: "uppercase",
          zIndex: 10,
        }}
      >
        Precision Performance Research Lab
      </div>
    </div>
  );
};

export default WelcomeScreen;