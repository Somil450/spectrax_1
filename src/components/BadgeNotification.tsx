import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '../types/badge';
import { getBadgeIcon } from '../utils/badgeIcons';

interface BadgeNotificationProps {
  badge: Badge | null;
  onClose: () => void;
}

export const BadgeNotification: React.FC<BadgeNotificationProps> = ({ badge, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  // Ref prevents stale closure without adding onClose to effect deps,
  // which would restart the timer every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!badge) return;

    setIsVisible(true);

    // Both timers declared here so they can be cleaned up in the teardown.
    let innerTimer: ReturnType<typeof setTimeout>;
    const outerTimer = setTimeout(() => {
      setIsVisible(false);
      innerTimer = setTimeout(() => onCloseRef.current(), 350);
    }, 4500);

    return () => {
      clearTimeout(outerTimer);
      clearTimeout(innerTimer);
    };
  }, [badge]); // only re-run when a new badge arrives

  if (!badge && !isVisible) return null;

  const IconComponent = badge ? getBadgeIcon(badge.icon) : null;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onCloseRef.current(), 350);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '18px 20px',
        // Use the project's glass design system — NOT Tailwind
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--neon-yellow)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--glass-shadow), 0 0 28px rgba(255, 214, 0, 0.25)',
        maxWidth: '360px',
        width: 'calc(100vw - 56px)',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(72px)',
        transition: 'opacity 0.35s var(--ease-out), transform 0.35s var(--ease-out)',
        pointerEvents: isVisible ? 'all' : 'none',
      }}
    >
      {/* Icon circle */}
      <div style={{
        flexShrink: 0,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(255, 214, 0, 0.1)',
        border: '1px solid rgba(255, 214, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 12px rgba(255, 214, 0, 0.2)',
      }}>
        {IconComponent && <IconComponent size={22} color="var(--neon-yellow)" />}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '0.6rem',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: 'var(--neon-yellow)',
          fontWeight: 800,
          marginBottom: '4px',
        }}>
          🏆 Badge Unlocked!
        </p>
        <p style={{
          color: 'var(--text-primary)',
          fontWeight: 700,
          fontSize: '0.95rem',
          marginBottom: '3px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {badge?.title}
        </p>
        <p style={{
          color: 'var(--text-dim)',
          fontSize: '0.75rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {badge?.description}
        </p>
      </div>

      {/* Close */}
      <button
        onClick={handleClose}
        className="has-tooltip tooltip-top"
        data-tooltip="Dismiss"
        aria-label="Dismiss badge notification"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-dim)',
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
