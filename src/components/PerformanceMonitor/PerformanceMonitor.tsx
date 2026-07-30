import React, { useState, useEffect } from 'react';
import { tfjsPoseService, MemoryStats } from '../../services/tfjs';
import './PerformanceMonitor.css';

interface PerformanceMonitorProps {
  visible?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ visible = true }) => {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      try {
        const memoryInfo = tfjsPoseService.getMemoryInfo();
        setStats(memoryInfo);
      } catch (err) {
        console.error('Failed to query performance metrics:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible || !stats) return null;

  const getFpsClass = (fps: number) => {
    if (fps >= 30) return 'fps-good';
    if (fps >= 15) return 'fps-warning';
    return 'fps-danger';
  };

  const memoryMB = (stats.numBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className={`perf-monitor-card ${isMinimized ? 'minimized' : ''}`}>
      <div className="perf-header">
        <span className="perf-title">⚡ WebGL Performance Monitor</span>
        <button
          className="perf-toggle-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          aria-label="Toggle Monitor"
        >
          {isMinimized ? '+' : '−'}
        </button>
      </div>

      {!isMinimized && (
        <div className="perf-body">
          <div className="perf-stat-row">
            <span className="perf-label">FPS:</span>
            <span className={`perf-value ${getFpsClass(stats.fps)}`}>
              {stats.fps} FPS
            </span>
          </div>

          <div className="perf-stat-row">
            <span className="perf-label">Active Tensors:</span>
            <span className="perf-value">{stats.numTensors}</span>
          </div>

          <div className="perf-stat-row">
            <span className="perf-label">TFJS Memory:</span>
            <span className="perf-value">{memoryMB} MB</span>
          </div>

          {stats.jsHeapSizeMB !== undefined && (
            <div className="perf-stat-row">
              <span className="perf-label">JS Heap:</span>
              <span className="perf-value">{stats.jsHeapSizeMB} MB</span>
            </div>
          )}

          <div className="perf-stat-row">
            <span className="perf-label">Input Scale:</span>
            <span className={`perf-value ${stats.isThrottled ? 'scale-throttled' : ''}`}>
              {stats.resolutionScale}x {stats.isThrottled ? '(Dynamic Downscale)' : '(Native)'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
