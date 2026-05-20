// components/AnomalyDetectionPanel.tsx — SpectraX Anomaly Detection Module (Issue #85)
// Drop this panel into your WorkoutSummary page or show it as a post-workout modal.

import React, { useState, useCallback } from 'react';
import {
  AlertTriangle, Activity, Search, Zap, Eye,
  TrendingUp, BarChart2, ChevronRight, Info, CheckCircle,
} from 'lucide-react';
import type { DetectionSummary, AnomalyResult, SimilarFrame, AnomalyAlgorithm } from '../types/anomaly';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ScoreBarProps {
  value: number;
  max?: number;
  danger?: boolean;
}
const ScoreBar: React.FC<ScoreBarProps> = ({ value, max = 4, danger }) => (
  <div style={{ height: 4, background: 'rgba(255,255,255,.1)', borderRadius: 2, overflow: 'hidden' }}>
    <div style={{
      height: '100%',
      width: `${Math.min(value / max * 100, 100)}%`,
      background: danger ? '#E24B4A' : '#378ADD',
      borderRadius: 2,
      transition: 'width .4s ease',
    }} />
  </div>
);

interface LabelBadgeProps { label: AnomalyResult['label'] }
const LabelBadge: React.FC<LabelBadgeProps> = ({ label }) => {
  const styles: Record<AnomalyResult['label'], React.CSSProperties> = {
    Anomaly:    { background: '#501313', color: '#F7C1C1' },
    Suspicious: { background: '#412402', color: '#FAC775' },
    Normal:     { background: '#173404', color: '#C0DD97' },
  };
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 4,
      fontWeight: 500, ...styles[label],
    }}>{label}</span>
  );
};

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export interface AnomalyDetectionPanelProps {
  /** Detection summary from useAnomalyDetection().runDetection() */
  summary: DetectionSummary;
  /** Called when user wants to search for frames similar to the selected one */
  onSimilarSearch?: (frameId: number) => SimilarFrame[];
  /** Algorithm switcher — if provided, shows algorithm tabs */
  onAlgorithmChange?: (algo: AnomalyAlgorithm) => void;
  /** Threshold control — if provided, shows threshold slider */
  onThresholdChange?: (threshold: number) => void;
  /** Optional class name for the outer container */
  className?: string;
}

const ALGORITHMS: { id: AnomalyAlgorithm; label: string; description: string }[] = [
  { id: 'zscore',    label: 'Z-Score',          description: 'Fast, great for stable sessions' },
  { id: 'mad',       label: 'Modified Z-Score',  description: 'Robust, handles noisy data well' },
  { id: 'isoforest', label: 'Isolation Forest',  description: 'ML-based, catches subtle patterns' },
];

const FEATURE_LABELS: Record<string, string> = {
  kneeLeft:         'Left knee',
  kneeRight:        'Right knee',
  elbowLeft:        'Left elbow',
  elbowRight:       'Right elbow',
  hipFlexion:       'Hip flexion',
  trunkLean:        'Trunk lean',
  shoulderSymmetry: 'Shoulder symmetry',
  wristHeight:      'Wrist height',
};

export const AnomalyDetectionPanel: React.FC<AnomalyDetectionPanelProps> = ({
  summary,
  onSimilarSearch,
  onAlgorithmChange,
  onThresholdChange,
  className,
}) => {
  const [selectedFrame, setSelectedFrame] = useState<AnomalyResult | null>(null);
  const [simResults, setSimResults]       = useState<SimilarFrame[]>([]);
  const [simQuery, setSimQuery]           = useState<number | null>(null);
  const [activeTab, setActiveTab]         = useState<'flagged' | 'similarity'>('flagged');

  const { results, anomalyCount, summaryText, worstFrame, algorithm, threshold } = summary;

  const handleFrameClick = useCallback((result: AnomalyResult) => {
    setSelectedFrame(result);
    setSimResults([]);
    setSimQuery(null);
  }, []);

  const handleSimilarSearch = useCallback((frameId: number) => {
    if (!onSimilarSearch) return;
    const res = onSimilarSearch(frameId);
    setSimResults(res);
    setSimQuery(frameId);
    setActiveTab('similarity');
  }, [onSimilarSearch]);

  const flagged    = results.filter(r => r.isAnomaly);
  const suspicious = results.filter(r => r.label === 'Suspicious');
  const maxScore   = Math.max(...results.map(r => r.anomalyScore));
  const avgScore   = results.reduce((s, r) => s + r.anomalyScore, 0) / results.length;

  // Micro sparkline SVG (no heavy charting lib needed here)
  const chartH = 60, chartW = 360;
  const scoreMax = Math.max(maxScore * 1.1, threshold * 1.3);
  const sparkPath = results.map((r, i) => {
    const x = (i / (results.length - 1)) * chartW;
    const y = chartH - (r.anomalyScore / scoreMax) * chartH;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const threshY = chartH - (threshold / scoreMax) * chartH;

  return (
    <div className={className} style={{ fontFamily: 'inherit', color: '#e8e6de' }}>
      {/* --- Algorithm selector --- */}
      {onAlgorithmChange && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {ALGORITHMS.map(a => (
            <button
              key={a.id}
              title={a.description}
              onClick={() => onAlgorithmChange(a.id)}
              style={{
                fontSize: 12, padding: '4px 12px',
                borderRadius: 8, cursor: 'pointer',
                border: algorithm === a.id ? '1.5px solid #378ADD' : '0.5px solid rgba(255,255,255,.15)',
                background: algorithm === a.id ? 'rgba(55,138,221,.15)' : 'transparent',
                color: algorithm === a.id ? '#85B7EB' : 'rgba(255,255,255,.5)',
                transition: 'all .15s',
              }}
            >{a.label}</button>
          ))}
        </div>
      )}

      {/* --- Summary callout --- */}
      <div style={{
        padding: '10px 14px', borderRadius: 8, marginBottom: 16,
        borderLeft: `3px solid ${anomalyCount > 0 ? '#EF9F27' : '#1D9E75'}`,
        background: 'rgba(255,255,255,.04)',
        fontSize: 13, lineHeight: 1.5,
      }}>
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {anomalyCount > 0
            ? <AlertTriangle size={15} style={{ color: '#EF9F27', flexShrink: 0, marginTop: 2 }} />
            : <CheckCircle  size={15} style={{ color: '#1D9E75', flexShrink: 0, marginTop: 2 }} />
          }
          <span style={{ color: 'rgba(255,255,255,.8)' }}>{summaryText}</span>
        </span>
      </div>

      {/* --- Metrics --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Frames',       val: results.length,           icon: <Eye size={13}/>,         danger: false },
          { label: 'Anomalies',    val: anomalyCount,             icon: <AlertTriangle size={13}/>, danger: anomalyCount > 0 },
          { label: 'Suspicious',   val: suspicious.length,        icon: <TrendingUp size={13}/>,   danger: false },
          { label: 'Avg score',    val: avgScore.toFixed(2),      icon: <BarChart2 size={13}/>,    danger: false },
        ].map(({ label, val, icon, danger }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,.05)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ color: danger ? '#E24B4A' : 'rgba(255,255,255,.45)' }}>{icon}</span>
              {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: danger ? '#E24B4A' : '#e8e6de' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* --- Sparkline chart --- */}
      <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(255,255,255,.04)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Anomaly score timeline</span>
          {onThresholdChange && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
              Threshold
              <input
                type="range" min="0.5" max="4" step="0.1"
                defaultValue={threshold}
                onChange={e => onThresholdChange(parseFloat(e.target.value))}
                style={{ width: 80 }}
              />
              <span>{threshold.toFixed(1)}</span>
            </label>
          )}
        </div>
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + 10}`} style={{ display: 'block' }} role="img" aria-label={`Score timeline: ${anomalyCount} anomalies detected`}>
          {/* Threshold line */}
          <line x1={0} y1={threshY} x2={chartW} y2={threshY} stroke="#E24B4A" strokeDasharray="5 3" strokeWidth={1} opacity={0.6} />
          {/* Score area */}
          <path d={`${sparkPath} L${chartW},${chartH} L0,${chartH} Z`} fill="rgba(55,138,221,.12)" />
          <path d={sparkPath} fill="none" stroke="#378ADD" strokeWidth={1.5} />
          {/* Anomaly dots */}
          {results.filter(r => r.isAnomaly).map((r, i) => {
            const x = (r.frameId / (results.length - 1)) * chartW;
            const y = chartH - (r.anomalyScore / scoreMax) * chartH;
            return (
              <circle
                key={r.frameId} cx={x} cy={y} r={4}
                fill="#E24B4A" stroke="rgba(0,0,0,.4)" strokeWidth={1}
                style={{ cursor: 'pointer' }}
                onClick={() => handleFrameClick(r)}
              />
            );
          })}
        </svg>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
          Red dots = flagged frames · Click to inspect
        </p>
      </div>

      {/* --- Detail + lists --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Frame detail */}
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500 }}>
            {selectedFrame ? `Frame #${selectedFrame.frameId} · ${selectedFrame.timestamp.toFixed(1)}s` : 'Frame detail'}
          </p>

          {selectedFrame ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: 6, marginBottom: 10,
                background: selectedFrame.isAnomaly ? 'rgba(162,45,45,.2)' : 'rgba(29,158,117,.15)',
              }}>
                {selectedFrame.isAnomaly
                  ? <AlertTriangle size={14} style={{ color: '#E24B4A', flexShrink: 0 }}/>
                  : <Zap          size={14} style={{ color: '#1D9E75', flexShrink: 0 }}/>
                }
                <span style={{ fontSize: 12, color: selectedFrame.isAnomaly ? '#F09595' : '#97C459', flex: 1, lineHeight: 1.4 }}>
                  {selectedFrame.humanReadable}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: selectedFrame.isAnomaly ? '#E24B4A' : '#1D9E75' }}>
                  {selectedFrame.anomalyScore.toFixed(2)}
                </span>
              </div>

              {/* Per-joint scores */}
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: '0 0 8px' }}>
                Per-joint scores — higher means more unusual
              </p>
              {Object.entries(selectedFrame.featureScores).map(([k, score]) => {
                const hot = score > threshold * 0.75;
                return (
                  <div key={k} style={{ marginBottom: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 2 }}>
                      <span>{FEATURE_LABELS[k] ?? k}</span>
                      <span style={{ color: hot ? '#E24B4A' : 'rgba(255,255,255,.4)' }}>{score.toFixed(2)}</span>
                    </div>
                    <ScoreBar value={score} danger={hot} />
                  </div>
                );
              })}

              {onSimilarSearch && (
                <button
                  onClick={() => handleSimilarSearch(selectedFrame.frameId)}
                  style={{
                    width: '100%', marginTop: 12, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                    border: '0.5px solid rgba(255,255,255,.15)',
                    background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.6)',
                  }}
                >
                  <Search size={13}/> Find similar frames
                </button>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
              <Eye size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p style={{ margin: 0 }}>Click a red dot on the chart<br/>or a frame below to inspect</p>
            </div>
          )}
        </div>

        {/* Flagged / Similarity tabs */}
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 14px' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderRadius: 6, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,.1)' }}>
            {(['flagged', 'similarity'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, fontSize: 12, padding: '6px 0', cursor: 'pointer', border: 'none',
                  background: activeTab === tab ? 'rgba(255,255,255,.08)' : 'transparent',
                  color: activeTab === tab ? '#e8e6de' : 'rgba(255,255,255,.4)',
                }}
              >
                {tab === 'flagged' ? `⚠️ Flagged (${flagged.length})` : `🔍 Similar`}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {activeTab === 'flagged' ? (
              flagged.length === 0 ? (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textAlign: 'center', padding: '1.5rem 0' }}>
                  No anomalies at this threshold
                </p>
              ) : flagged.map(r => (
                <div
                  key={r.frameId}
                  onClick={() => handleFrameClick(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                    background: selectedFrame?.frameId === r.frameId ? 'rgba(255,255,255,.07)' : 'transparent',
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E24B4A', flexShrink: 0 }}/>
                  <span style={{ fontSize: 12, flex: 1 }}>Frame {r.frameId}</span>
                  <LabelBadge label={r.label} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#E24B4A' }}>{r.anomalyScore.toFixed(2)}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{r.timestamp.toFixed(1)}s</span>
                  <ChevronRight size={12} style={{ color: 'rgba(255,255,255,.25)' }}/>
                </div>
              ))
            ) : (
              simResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'rgba(255,255,255,.35)', fontSize: 13 }}>
                  <Search size={24} style={{ marginBottom: 8, opacity: 0.4 }}/>
                  <p style={{ margin: 0 }}>Select a frame and hit<br/>"Find similar frames"</p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '0 0 8px' }}>
                    Top matches for Frame {simQuery}
                  </p>
                  {simResults.map((sr, i) => {
                    const r = results.find(x => x.frameId === sr.frameId);
                    const simPct = Math.round(sr.similarity * 100);
                    return (
                      <div
                        key={sr.frameId}
                        onClick={() => r && handleFrameClick(r)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                          background: selectedFrame?.frameId === sr.frameId ? 'rgba(255,255,255,.07)' : 'transparent',
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', minWidth: 18 }}>#{i+1}</span>
                        <span style={{ fontSize: 12, flex: 1 }}>Frame {sr.frameId}</span>
                        {r?.isAnomaly && <LabelBadge label="Anomaly" />}
                        <div style={{ width: 50 }}>
                          <div style={{ height: 3, background: 'rgba(255,255,255,.1)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${simPct}%`, background: '#1D9E75' }}/>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#1D9E75', minWidth: 28, textAlign: 'right' }}>{simPct}%</span>
                      </div>
                    );
                  })}
                </>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnomalyDetectionPanel;
