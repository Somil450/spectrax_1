import React from 'react';

export const About: React.FC = () => {
  return (
    <div className="screen-container" style={{ padding: 28 }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--neon-cyan)' }}>About SpectraX</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          SpectraX is an AI-powered fitness companion that provides real-time
          rep counting, form feedback, and progress tracking. Built with
          privacy-first principles and an emphasis on performance, SpectraX
          helps users train smarter by combining computer vision models with
          adaptive coaching.
        </p>

        <h3 style={{ marginTop: 18, color: 'var(--neon-purple)'}}>Our Mission</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          To make high-quality fitness coaching accessible to everyone through
          lightweight, on-device inference and delightful UX.
        </p>

        <h3 style={{ marginTop: 18, color: 'var(--neon-green)'}}>Team</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          A small team of engineers, researchers and designers building tools
          that help people move better. We welcome contributions and feedback.
        </p>
      </div>
    </div>
  );
};

export default About;
