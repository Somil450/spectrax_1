import React, { useEffect, useRef } from 'react';
import { Play, Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: { x: number; y: number; vx: number; vy: number; radius: number }[] = [];

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
        ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
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
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="screen-container welcome-screen" style={{
      justifyContent: 'center', alignItems: 'center', textAlign: 'center'
    }}>

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, opacity: 0.6 }} />

      <div className="animate-in" style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(0, 240, 255, 0.2)', background: 'rgba(0, 240, 255, 0.05)', marginBottom: '24px' }}>
          <Sparkles size={14} color="var(--neon-cyan)" />
          <span style={{ fontSize: '0.65rem', letterSpacing: '2px', color: 'var(--neon-cyan)', fontWeight: 700 }}>AI CALIBRATION SYSTEM 2.0</span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(3rem, 12vw, 6rem)', fontWeight: 900,
          letterSpacing: '12px', color: 'var(--neon-cyan)', textShadow: '0 0 30px rgba(0,240,255,0.7)',
          margin: '20px 0'
        }}>
          SPECTRAX
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', letterSpacing: '3px', fontWeight: 300, marginBottom: '48px' }}>
          Real-time Pose Tracking & Performance Analysis
        </p>

        <button onClick={onStart} className="btn-neon">
          INITIALIZE SYSTEM <Play size={18} fill="currentColor" />
        </button>
      </div>

      <div style={{ position: 'absolute', bottom: '40px', left: '0', right: '0', color: 'var(--text-dim)', fontSize: '0.7rem', letterSpacing: '4px', textTransform: 'uppercase' }}>
        Precision Performance Research Lab
      </div>
    </div>
  );
};
