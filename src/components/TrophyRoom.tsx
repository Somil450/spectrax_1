import React from 'react';
import { ArrowLeft, Lock, Trophy } from 'lucide-react';
import { BADGES_CONFIG } from '../config/badges';
import { useBadges } from '../hooks/useBadges';
import { getBadgeIcon } from '../utils/badgeIcons';

interface TrophyRoomProps {
  onBack: () => void;
}

export const TrophyRoom: React.FC<TrophyRoomProps> = ({ onBack }) => {
  const { earnedIds, getUnlockDate } = useBadges();
  const unlockedCount = earnedIds.size;

  return (
    <div
      className="screen-container"
      style={{
        background: 'radial-gradient(ellipse at 50% 10%, #1a0e40 0%, var(--bg-primary) 65%)',
        padding: '40px 24px 60px',
        overflowY: 'auto',
        alignItems: 'center',
      }}
    >
      {/* ── Header ── */}
      <div
        className="animate-in"
        style={{
          width: '100%',
          maxWidth: '820px',
          display: 'flex',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <button
          onClick={onBack}
          className="btn-outline"
          style={{ padding: '8px 18px', fontSize: '0.7rem', letterSpacing: '1.5px', gap: '6px' }}
          aria-label="Go back"
        >
          <ArrowLeft size={13} /> BACK
        </button>

        <h1
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.3rem, 4vw, 1.9rem)',
            letterSpacing: '6px',
            textTransform: 'uppercase',
            color: 'var(--neon-yellow)',
            textShadow: '0 0 20px rgba(255, 214, 0, 0.55)',
          }}
        >
          Trophy Room
        </h1>

        {/* spacer so heading stays centred */}
        <div style={{ width: '80px' }} />
      </div>

      {/* ── Subtitle / progress ── */}
      <p
        className="animate-in"
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '0.65rem',
          letterSpacing: '2px',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          marginBottom: '40px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Trophy size={12} color="var(--neon-yellow)" />
        {unlockedCount} / {BADGES_CONFIG.length} Unlocked
      </p>

      {/* ── Badge grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '20px',
          width: '100%',
          maxWidth: '820px',
        }}
      >
        {BADGES_CONFIG.map(badge => {
          const isUnlocked     = earnedIds.has(badge.id);
          const unlockDate     = getUnlockDate(badge.id);
          const IconComponent  = getBadgeIcon(badge.icon);

          return (
            <div
              key={badge.id}
              className="glass"
              style={{
                padding: '28px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                border: isUnlocked
                  ? '1px solid rgba(255, 214, 0, 0.35)'
                  : '1px solid var(--glass-border)',
                boxShadow: isUnlocked
                  ? 'var(--glass-shadow), 0 0 22px rgba(255, 214, 0, 0.15)'
                  : 'var(--glass-shadow)',
                opacity: isUnlocked ? 1 : 0.5,
                filter: isUnlocked ? 'none' : 'grayscale(60%)',
                transition: 'transform 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out)',
              }}
              onMouseEnter={e => {
                if (isUnlocked) {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = 'var(--glass-shadow), 0 0 36px rgba(255, 214, 0, 0.3)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isUnlocked
                  ? 'var(--glass-shadow), 0 0 22px rgba(255, 214, 0, 0.15)'
                  : 'var(--glass-shadow)';
              }}
            >
              {/* Lock overlay for locked badges */}
              {!isUnlocked && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  color: 'var(--text-dim)',
                }}>
                  <Lock size={16} />
                </div>
              )}

              {/* Icon */}
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: isUnlocked
                  ? 'rgba(255, 214, 0, 0.08)'
                  : 'rgba(255,255,255,0.04)',
                border: isUnlocked
                  ? '1px solid rgba(255, 214, 0, 0.3)'
                  : '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                boxShadow: isUnlocked
                  ? '0 0 16px rgba(255, 214, 0, 0.2)'
                  : 'none',
              }}>
                <IconComponent
                  size={34}
                  color={isUnlocked ? 'var(--neon-yellow)' : 'var(--text-dim)'}
                  style={isUnlocked ? { filter: 'drop-shadow(0 0 6px rgba(255,214,0,0.5))' } : undefined}
                />
              </div>

              {/* Title */}
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.85rem',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: isUnlocked ? 'var(--text-primary)' : 'var(--text-dim)',
                marginBottom: '8px',
              }}>
                {badge.title}
              </h3>

              {/* Description */}
              <p style={{
                fontSize: '0.78rem',
                color: 'var(--text-dim)',
                lineHeight: 1.5,
                flexGrow: 1,
                marginBottom: '16px',
              }}>
                {badge.description}
              </p>

              {/* Status pill */}
              {isUnlocked ? (
                <span style={{
                  fontSize: '0.6rem',
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--neon-yellow)',
                  background: 'rgba(255, 214, 0, 0.1)',
                  border: '1px solid rgba(255, 214, 0, 0.25)',
                  borderRadius: '999px',
                  padding: '4px 12px',
                }}>
                  ✓ {unlockDate}
                </span>
              ) : (
                <span style={{
                  fontSize: '0.6rem',
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '999px',
                  padding: '4px 12px',
                }}>
                  Locked
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
