import React, { useEffect, useRef, useState } from "react";
import { Play, Sparkles, History, Trophy } from "lucide-react";

interface WelcomeScreenProps {
  onStart: () => void;
  onViewHistory: () => void;
  onViewTrophies: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  onViewHistory,
  onViewTrophies,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = -((clientY - innerHeight / 2) / innerHeight) * 20;
    const y = ((clientX - innerWidth / 2) / innerWidth) * 20;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  useEffect(() => {
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
      for (let i = 0; i < 60; i++) {
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
      style={{
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, opacity: 0.6 }}
      />

      <div 
        className="animate-in" 
        style={{ 
          position: "relative", 
          zIndex: 10,
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: "transform 0.15s ease-out",
          transformStyle: "preserve-3d"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "20px",
            border: "1px solid rgba(0, 240, 255, 0.2)",
            background: "rgba(0, 240, 255, 0.05)",
            marginBottom: "24px",
          }}
        >
          <Sparkles size={14} color="var(--neon-cyan)" />
          <span
            style={{
              fontSize: "0.65rem",
              letterSpacing: "2px",
              color: "var(--neon-cyan)",
              fontWeight: 700,
            }}
          >
            AI CALIBRATION SYSTEM 2.0
          </span>
        </div>

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
          <button onClick={onStart} className="btn-neon" aria-label="Initialize System" tabIndex={0}>
            INITIALIZE SYSTEM <Play size={18} fill="currentColor" />
          </button>

          <button
            onClick={onViewHistory}
            aria-label="View Workout History"
            tabIndex={0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(0, 240, 255, 0.1)",
              border: "1.5px solid rgba(0, 240, 255, 0.4)",
              borderRadius: "14px",
              color: "var(--neon-cyan)",
              cursor: "pointer",
              padding: "12px 28px",
              fontSize: "0.75rem",
              letterSpacing: "2px",
              fontWeight: 700,
              transition: "all 0.3s ease",
              textTransform: "uppercase",
              boxShadow: "0 2px 8px rgba(0, 240, 255, 0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0, 240, 255, 0.2)";
              e.currentTarget.style.borderColor = "var(--neon-cyan)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(0, 240, 255, 0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0, 240, 255, 0.1)";
              e.currentTarget.style.borderColor = "rgba(0, 240, 255, 0.4)";
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(0, 240, 255, 0.15)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <History size={15} />
            VIEW HISTORY
          </button>

          <button
            onClick={onViewTrophies}
            aria-label="View Trophy Room"
            tabIndex={0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(255, 214, 0, 0.08)",
              border: "1.5px solid rgba(255, 214, 0, 0.35)",
              borderRadius: "14px",
              color: "var(--neon-yellow)",
              cursor: "pointer",
              padding: "12px 28px",
              fontSize: "0.75rem",
              letterSpacing: "2px",
              fontWeight: 700,
              transition: "all 0.3s ease",
              textTransform: "uppercase",
              boxShadow: "0 2px 8px rgba(255, 214, 0, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 214, 0, 0.15)";
              e.currentTarget.style.borderColor = "var(--neon-yellow)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(255, 214, 0, 0.25)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 214, 0, 0.08)";
              e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.35)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(255, 214, 0, 0.1)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <Trophy size={15} />
            TROPHY ROOM
          </button>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "40px",
          left: "0",
          right: "0",
          color: "var(--text-dim)",
          fontSize: "0.7rem",
          letterSpacing: "4px",
          textTransform: "uppercase",
        }}
      >
        Precision Performance Research Lab
      </div>
    </div>
  );
};
