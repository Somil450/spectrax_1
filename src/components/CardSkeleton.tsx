import './CardSkeleton.css';

export const GridSkeleton = () => {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line" style={{ height: 20, width: '33%', marginBottom: 16 }} />
      <div className="skeleton-line" style={{ height: 16, width: '100%', marginBottom: 8 }} />
      <div className="skeleton-line" style={{ height: 16, width: '83%', marginBottom: 8 }} />
      <div className="skeleton-line" style={{ height: 16, width: '66%' }} />
    </div>
  );
};
