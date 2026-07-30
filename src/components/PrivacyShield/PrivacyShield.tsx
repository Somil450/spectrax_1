import React, { useState } from 'react';
import './PrivacyShield.css';

export const PrivacyShield: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="privacy-shield-container">
      <div className="privacy-shield-badge" onClick={() => setShowDetails(!showDetails)}>
        <span className="privacy-icon">🔒</span>
        <span className="privacy-text">100% On-Device AI Privacy</span>
        <span className="privacy-info-btn">ℹ️</span>
      </div>

      {showDetails && (
        <div className="privacy-modal-backdrop" onClick={() => setShowDetails(false)}>
          <div className="privacy-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-modal-header">
              <h3>🛡️ Zero-Cloud Video Privacy Commitment</h3>
              <button className="close-btn" onClick={() => setShowDetails(false)}>
                ✕
              </button>
            </div>

            <div className="privacy-modal-body">
              <p>
                At SpectraX, your camera privacy is our top priority. We use WebGL/WebGPU and TensorFlow.js to process all pose estimation AI models <strong>100% locally in your browser</strong>.
              </p>

              <ul className="privacy-checklist">
                <li>✅ <strong>Zero Frame Transmission:</strong> Your video feed never leaves your laptop/phone.</li>
                <li>✅ <strong>No Server Processing:</strong> Images are processed frame-by-frame in local browser memory and immediately discarded.</li>
                <li>✅ <strong>Strict Telemetry Auditing:</strong> Only numerical exercise metrics (e.g. rep counts, workout duration) are saved.</li>
              </ul>
            </div>

            <div className="privacy-modal-footer">
              <button className="got-it-btn" onClick={() => setShowDetails(false)}>
                Got it, stay private!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
