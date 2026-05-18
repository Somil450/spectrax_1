import React from 'react';
import { Camera, RefreshCw, Settings } from 'lucide-react';
import type { CameraErrorType } from '../services/cameraService';

interface CameraErrorStateProps {
  errorType: CameraErrorType;
  message: string;
  onRetry: () => void;
}

const INSTRUCTIONS: Record<CameraErrorType, string[]> = {
  denied: [
    'Click the camera icon in your browser address bar',
    'Set camera permission to "Allow"',
    'Refresh the page and try again',
  ],
  notFound: [
    'Connect a webcam or enable your built-in camera',
    'Close other apps that may be using the camera',
    'Check your device privacy settings',
  ],
  inUse: [
    'Close video calls or other apps using the webcam',
    'Wait a few seconds, then retry',
    'Restart your browser if the issue persists',
  ],
  insecure: [
    'Camera access requires HTTPS or localhost',
    'Open the app via https:// or http://localhost',
  ],
  unknown: [
    'Check that your camera is connected and enabled',
    'Try a different browser (Chrome or Edge recommended)',
    'Refresh the page and retry',
  ],
};

export const CameraErrorState: React.FC<CameraErrorStateProps> = ({
  errorType,
  message,
  onRetry,
}) => {
  const steps = INSTRUCTIONS[errorType];

  return (
    <div className="camera-error-state">
      <div className="camera-error-card">
        <div className="camera-error-icon">
          <Camera size={32} />
        </div>
        <h2>Camera Unavailable</h2>
        <p className="camera-error-message">{message}</p>

        <ul className="camera-error-steps">
          {steps.map((step) => (
            <li key={step}>
              <Settings size={14} />
              <span>{step}</span>
            </li>
          ))}
        </ul>

        <button type="button" className="camera-error-retry" onClick={onRetry}>
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>

      <style>{`
        .camera-error-state {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(8, 12, 20, 0.85);
          backdrop-filter: blur(8px);
          z-index: 30;
          padding: 24px;
        }
        .camera-error-card {
          max-width: 420px;
          width: 100%;
          background: var(--glass-bg, rgba(13, 17, 39, 0.9));
          border: 1px solid var(--glass-border, rgba(0, 240, 255, 0.2));
          border-radius: 16px;
          padding: 28px;
          text-align: center;
          box-shadow: var(--glass-shadow, 0 8px 32px rgba(0, 0, 0, 0.4));
        }
        .camera-error-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .camera-error-card h2 {
          font-family: var(--font-heading, 'Orbitron', sans-serif);
          color: var(--text-primary);
          font-size: 1.25rem;
          margin-bottom: 8px;
        }
        .camera-error-message {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .camera-error-steps {
          list-style: none;
          text-align: left;
          margin: 0 0 24px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .camera-error-steps li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.82rem;
          color: var(--text-dim);
        }
        .camera-error-steps li svg {
          flex-shrink: 0;
          margin-top: 2px;
          color: var(--neon-cyan, #00f0ff);
        }
        .camera-error-retry {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          border-radius: 10px;
          border: 1px solid var(--neon-cyan, #00f0ff);
          background: rgba(0, 240, 255, 0.1);
          color: var(--neon-cyan, #00f0ff);
          cursor: pointer;
          font-weight: 700;
          font-family: var(--font-heading, 'Orbitron', sans-serif);
          letter-spacing: 1px;
          transition: all 0.2s ease;
        }
        .camera-error-retry:hover {
          background: rgba(0, 240, 255, 0.2);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};
