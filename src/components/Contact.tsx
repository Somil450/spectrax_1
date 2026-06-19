import React from 'react';

export const Contact: React.FC = () => {
  return (
    <div className="screen-container" style={{ padding: 28 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--neon-cyan)' }}>Contact Us</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          We&apos;d love to hear from you — feedback, bug reports, and feature
          requests help us improve SpectraX.
        </p>

        <div style={{ marginTop: 16 }}>
          <p style={{ color: 'var(--text-secondary)' }}><strong>Email:</strong> support@spectrax.example</p>
          <p style={{ color: 'var(--text-secondary)' }}><strong>Twitter:</strong> @spectrax_app</p>
        </div>

        <div style={{ marginTop: 22 }}>
          <form onSubmit={(e) => e.preventDefault()}>
            <label style={{ display: 'block', color: 'var(--text-dim)' }}>Message</label>
            <textarea style={{ width: '100%', minHeight: 120, marginTop: 8, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: 'var(--text-primary)' }} />
            <div style={{ marginTop: 12 }}>
              <button className="btn-neon" type="submit">Send Message</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;
