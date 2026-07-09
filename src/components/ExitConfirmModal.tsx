import React, { useEffect, useRef, useId } from 'react';

interface ExitConfirmModalProps {
  message: string;
  onStay: () => void;
  onExit: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({ message, onStay, onExit }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const onStayRef = useRef(onStay);
  onStayRef.current = onStay;
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stayButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onStayRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass"
        style={{ padding: '30px', width: '320px', maxWidth: '90vw', textAlign: 'center' }}
      >
        <h2 id={titleId}>Confirm Exit</h2>
        <p>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
          <button ref={stayButtonRef} className="btn-outline" onClick={onStay}>Stay</button>
          <button className="btn-neon" style={{ background: 'var(--neon-red)', color: '#fff' }} onClick={onExit}>Exit</button>
        </div>
      </div>
    </div>
  );
};

export default ExitConfirmModal;
