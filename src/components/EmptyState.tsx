import React from 'react';
import { Activity } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({ 
  title, 
  description, 
  icon = <Activity size={48} color="var(--neon-purple)" />, 
  actionText = "Start Workout", 
  onAction 
}: EmptyStateProps) {
  const handleAction = () => {
    onAction?.();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px dashed rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      margin: '20px 0'
    }}>
      <div style={{ marginBottom: '16px', opacity: 0.8 }}>
        {icon}
      </div>
      <h3 style={{ 
        fontFamily: 'var(--font-heading)', 
        color: 'var(--text-primary)', 
        fontSize: '1.2rem', 
        marginBottom: '8px' 
      }}>
        {title}
      </h3>
      <p style={{ 
        color: 'var(--text-secondary)', 
        fontSize: '0.9rem', 
        maxWidth: '400px', 
        lineHeight: 1.5,
        marginBottom: '24px'
      }}>
        {description}
      </p>
      <button 
        onClick={handleAction}
        className="btn-primary"
      >
        {actionText}
      </button>
    </div>
  );
}
