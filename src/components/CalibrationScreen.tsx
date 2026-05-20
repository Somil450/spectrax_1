import React, { useEffect, useRef, useState } from 'react';
import { cameraService } from '../services/cameraService';
import { poseService } from '../services/poseService';
import { overlayRenderer } from '../services/overlayRenderer';
import { calibrationLogic, CalibrationResult } from '../services/calibrationLogic';
import { Camera, AlertCircle, Dumbbell, Hand } from 'lucide-react';
import { ExerciseConfig, exercises } from '../config/exercises';
import { bodyTypeEngine, BodyType, BodyTypeResult } from '../services/bodyTypeEngine';
import { gestureService, GestureResult } from '../services/gestureService';

interface CalibrationScreenProps {
  selectedExercise: ExerciseConfig;
  onSelectExercise: (key: string) => void;
  onNext: () => void;
  onBack: () => void;
  onBodyTypeDetected: (type: BodyType) => void;
}

// ── Visually-hidden style (sr-only) ──────────────────────────────────────────
// This CSS pattern hides an element from sighted users while keeping it fully
// available to screen readers. clip-path: inset(50%) is the modern replacement
// for the deprecated `clip: rect(...)` property.
const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
};

export const CalibrationScreen: React.FC<CalibrationScreenProps> = ({ 
  selectedExercise, onSelectExercise, onNext, onBack, onBodyTypeDetected
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // -- State variables --
  const [result, setResult] = useState<CalibrationResult>({
    status: 'red',
    message: 'Initializing system...',
    isReady: false,
    visibleCount: 0,
    totalCount: 8,
  });
  const [error, setError] = useState<string | null>(null);
  const [bodyTypeRes, setBodyTypeRes] = useState<BodyTypeResult | null>(null);
  const [gestureResult, setGestureResult] = useState<GestureResult>({
    isHandRaised: false,
    confidence: 0,
    leftWristAboveShoulder: false,
    rightWristAboveShoulder: false,
    isPoseLost: false,
    isThumbsUp: false,
    isCrossedArms: false,
  });
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  
  const [hoveredExercise, setHoveredExercise] = useState<string | null>(null);
  
  const frameId = useRef<number>(0);
  const lastProcessTime = useRef<number>(0);
  const FPS_LIMIT = 15;
  const countdownIntervalRef = useRef<any>(null);

  // ── ARIA Live Region State ────────────────────────────────────────────────────
  // One string that the hidden live region will announce to screen readers.
  // We update it from useEffect hooks below, each watching a specific thing.
  const [announcement, setAnnouncement] = useState('');

  // Refs to remember the previous values so we only announce when something
  // actually transitions (e.g., isReady going false → true), not on every frame.
  const prevIsReadyRef = useRef(false);
  const prevPoseLostRef = useRef(false);

  // ── Announce calibration status messages ──────────────────────────────────────
  // This runs whenever result.message changes to a new string.
  // React's dependency check means the same message repeated across pose frames
  // will NOT re-trigger this — only genuine new messages will.
  useEffect(() => {
    if (result.isReady && !prevIsReadyRef.current) {
      // Only announce "ready" once when we first become ready
      setAnnouncement('Calibration complete. Raise both hands above your shoulders to begin.');
      prevIsReadyRef.current = true;
    } else if (!result.isReady) {
      // Announce each new positioning instruction
      setAnnouncement(result.message);
      prevIsReadyRef.current = false;
    }
  }, [result.message, result.isReady]);

  // ── Announce pose lost / regained ─────────────────────────────────────────────
  // We track the previous isPoseLost value in a ref so we only announce on the
  // transition (lost → not lost, or not lost → lost), not repeatedly.
  useEffect(() => {
    if (gestureResult.isPoseLost && !prevPoseLostRef.current) {
      setAnnouncement('Pose lost. Please step back into the camera frame.');
    } else if (!gestureResult.isPoseLost && prevPoseLostRef.current) {
      setAnnouncement('Pose detected. Hold your position.');
    }
    prevPoseLostRef.current = gestureResult.isPoseLost;
  }, [gestureResult.isPoseLost]);

  // ── Announce countdown seconds ─────────────────────────────────────────────────
  // countdownSeconds changes once per second during the countdown, so this
  // effect naturally throttles itself — it won't flood the screen reader.
  useEffect(() => {
    if (countdownActive && countdownSeconds > 0) {
      setAnnouncement(`Starting in ${countdownSeconds}`);
    }
  }, [countdownSeconds, countdownActive]);

  // ── Announce camera errors ─────────────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      setAnnouncement('Camera error. Please verify camera access and refresh the page.');
    }
  }, [error]);


  useEffect(() => {
    let isMounted = true;

    const startSystem = async () => {
      if (!videoRef.current || !canvasRef.current) return;

      try {
        setResult(prev => ({ ...prev, message: 'Warming up AI Engine...' }));
        
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) overlayRenderer.setContext(ctx);

        await cameraService.startCamera(videoRef.current);
        
        poseService.onResults((results) => {
          if (!isMounted) return;
          const evaluation = calibrationLogic.evaluate(results);
          setResult(evaluation);
          
          if (results.poseLandmarks) {
            const bt = bodyTypeEngine.analyze(results.poseLandmarks);
            setBodyTypeRes(bt);
            if (bt.bodyType !== 'scanning' && bt.confidence > 0.8) {
              onBodyTypeDetected(bt.bodyType);
            }

            const gesture = gestureService.analyze(results.poseLandmarks);
            setGestureResult(gesture);
          }

          const primaryJoints = selectedExercise.joints?.flat() || [];
          overlayRenderer.draw(results, evaluation.status, primaryJoints);
        });

        const processLoop = (timestamp: number) => {
          if (!isMounted) return;
          const elapsed = timestamp - lastProcessTime.current;
          if (elapsed > (1000 / FPS_LIMIT)) {
            if (videoRef.current && videoRef.current.readyState >= 2 && !videoRef.current.paused) {
              poseService.send(videoRef.current);
            }
            lastProcessTime.current = timestamp;
          }
          frameId.current = requestAnimationFrame(processLoop);
        };
        frameId.current = requestAnimationFrame(processLoop);
      } catch (err) {
        if (isMounted) {
          setError("Hardware synchronization error. Verify camera and refresh.");
          setResult(prev => ({ ...prev, status: 'red', message: 'Sync failed' }));
        }
      }
    };

    startSystem();

    return () => {
      isMounted = false;
      cancelAnimationFrame(frameId.current);
      cameraService.stopCamera();
      bodyTypeEngine.reset();
      gestureService.reset();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [selectedExercise, onBodyTypeDetected]);

  useEffect(() => {
    const gestureTriggered = gestureResult.isHandRaised || gestureResult.isThumbsUp;
    if (gestureTriggered && result.isReady && !gestureResult.isPoseLost && !countdownActive) {
      setCountdownActive(true);
      setCountdownSeconds(3);
    } else if (!gestureTriggered || gestureResult.isPoseLost) {
      if (countdownActive) {
        setCountdownActive(false);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }
  }, [gestureResult.isHandRaised, gestureResult.isThumbsUp, result.isReady, gestureResult.isPoseLost, countdownActive]);

  useEffect(() => {
    if (countdownActive && countdownSeconds > 0) {
      countdownIntervalRef.current = window.setInterval(() => {
        setCountdownSeconds(prev => prev - 1);
      }, 1000);
      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    } else if (countdownActive && countdownSeconds === 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdownActive(false);
      onNext();
    }
  }, [countdownActive, countdownSeconds, onNext]);

  const statusColor = result.status === 'green' ? 'var(--neon-green)' : (result.status === 'yellow' ? 'var(--neon-yellow)' : 'var(--neon-red)');

  const getSortedExercises = () => {
    const all = Object.values(exercises);
    if (!bodyTypeRes || bodyTypeRes.bodyType === 'scanning') return all;
    
    const type = bodyTypeRes.bodyType;
    const orderMap: Record<string, string[]> = {
      ecto: ['squat', 'pushup', 'bicepCurl', 'plank', 'jumpingJack'],
      meso: ['pushup', 'squat', 'jumpingJack', 'bicepCurl', 'plank'],
      endo: ['jumpingJack', 'squat', 'plank', 'pushup', 'bicepCurl']
    };
    
    const order = orderMap[type] || [];
    return all.sort((a, b) => {
      const idxA = order.indexOf(a.key);
      const idxB = order.indexOf(b.key);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  };

  return (
    <div className="screen-container" style={{ background: 'var(--bg-primary)' }}>

      <div className="camera-viewport" style={{ 
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at center, #111a3d 0%, #0a0a1a 100%)'
      }}>
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, transform: 'scaleX(-1)' }} 
        />
        <canvas 
          ref={canvasRef} 
          width={1280}
          height={720}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', transform: 'scaleX(-1)' }} 
        />
        
        {/* Silhouette Guide Overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: result.isReady ? 0 : 0.4, transition: 'opacity 0.5s ease' }}>
          <svg viewBox="0 0 200 400" style={{ height: '85%', maxHeight: '650px', filter: 'drop-shadow(0 0 10px var(--neon-cyan))' }}>
            <circle cx="100" cy="50" r="25" fill="none" stroke="var(--neon-cyan)" strokeWidth="2.5" strokeDasharray="6,6" />
            <path d="M 60 95 C 100 80, 100 80, 140 95 L 130 200 L 140 370 L 115 370 L 100 230 L 85 370 L 60 370 L 70 200 Z" fill="none" stroke="var(--neon-cyan)" strokeWidth="2.5" strokeDasharray="6,6" strokeLinejoin="round" />
            <path d="M 60 95 L 35 180 M 140 95 L 165 180" fill="none" stroke="var(--neon-cyan)" strokeWidth="2.5" strokeDasharray="6,6" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/*
        ══════════════════════════════════════════════════════════
        ARIA LIVE REGION — Screen Reader Announcements
        ══════════════════════════════════════════════════════════

        IMPORTANT: This div must ALWAYS be in the DOM — never put it inside an
        `{condition && ...}` block. Screen readers register live regions when
        they first appear in the DOM. If this element is removed and re-added
        (because it was inside a conditional branch), the screen reader loses
        its reference to it and stops announcing updates.

        The `announcement` state is updated by the useEffect hooks above,
        each of which watches a specific meaningful event (calibration message,
        pose lost, countdown, error). They use prev-value refs to fire only
        on actual transitions — not on every pose frame.
      */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={srOnly}
      >
        {announcement}
      </div>

      <div className="ui-layer" style={{ position: 'relative', zIndex: 10, height: '100%', padding: '40px', pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* Header & Exercise Selector */}
        <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'all' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="glass" style={{ padding: '12px', borderRadius: '12px' }}>
              <Camera color="var(--neon-cyan)" size={24} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--neon-cyan)', fontSize: '1.2rem', letterSpacing: '2px' }}>SYSTEM CALIBRATION</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', letterSpacing: '1px' }}>VERSION 2.5.0 — MULTI-ENGINE ACTIVE</p>
            </div>
          </div>

          <div className="glass" style={{ padding: '16px', minWidth: '240px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Dumbbell size={14} color="var(--neon-purple)" />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '2px', textTransform: 'uppercase' }}>Select Exercise</span>
             </div>
             
             {/* Exercise Grid with Video Tooltips */}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {getSortedExercises().map((ex) => (
                  <div 
                    key={ex.key} 
                    style={{ position: 'relative' }}
                    onMouseEnter={() => setHoveredExercise(ex.key)}
                    onMouseLeave={() => setHoveredExercise(null)}
                  >
                    <button 
                      onClick={() => onSelectExercise(ex.key)}
                      style={{
                        background: selectedExercise.key === ex.key ? 'var(--neon-purple)' : 'transparent',
                        color: selectedExercise.key === ex.key ? '#fff' : 'var(--text-secondary)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.3s ease',
                        width: '100%',
                        position: 'relative',
                        zIndex: 2
                      }}
                    >
                      {ex.name.toUpperCase()}
                    </button>

                    {/* Video Overlay */}
                    { (hoveredExercise === ex.key || (selectedExercise.key === ex.key && hoveredExercise === null)) && ex.demoUrl && (
                      <div 
                        className="animate-in"
                        style={{
                          position: 'absolute',
                          right: '105%', // Pop out to the left
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '240px', /* <--- INCREASED SIZE HERE */
                          borderRadius: '12px', /* Slightly softer corners for larger video */
                          overflow: 'hidden',
                          border: '2px solid var(--neon-cyan)',
                          boxShadow: '0 0 25px rgba(0, 240, 255, 0.3)', /* Stronger glow */
                          backgroundColor: '#000',
                          zIndex: 20,
                          pointerEvents: 'none'
                        }}
                      >
                        <video 
                          src={ex.demoUrl} 
                          autoPlay 
                          loop 
                          muted 
                          playsInline 
                          style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Center Feedback Area */}
        <div style={{ alignSelf: 'center', textAlign: 'center' }}>
          {error ? (
            <div className="glass animate-in" style={{ padding: '32px 48px', border: '1px solid var(--neon-red)', background: 'rgba(255, 59, 92, 0.1)', maxWidth: '500px', pointerEvents: 'all' }}>
              <AlertCircle color="var(--neon-red)" size={48} style={{ marginBottom: '16px', margin: '0 auto' }} />
              <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--neon-red)', marginBottom: '8px' }}>HARDWARE SYNC FAILED</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>{error}</p>
              <button onClick={() => window.location.reload()} className="btn-outline" style={{ marginTop: '24px', borderColor: 'var(--neon-red)', color: 'var(--neon-red)' }}>REINITIALIZE</button>
            </div>
          ) : (
            <div className="glass animate-in" style={{ padding: '24px 40px', border: `1px solid ${statusColor}`, background: 'rgba(13, 17, 39, 0.9)', minWidth: '400px' }}>
               <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', color: statusColor, letterSpacing: '4px', textShadow: `0 0 15px ${statusColor}44` }}>
                {result.message.toUpperCase()}
               </p>
               <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', margin: '16px 0', position: 'relative', overflow: 'hidden', borderRadius: '2px' }}>
                  <div style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    width: `${result.isReady ? 100 : (result.totalCount > 0 ? (result.visibleCount / result.totalCount) * 100 : 0)}%`, 
                    background: statusColor, 
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease', 
                    boxShadow: `0 0 12px ${statusColor}` 
                  }} />
               </div>
               <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '2px' }}>
                 {result.isReady 
                   ? 'OPTIMAL POSITION ACHIEVED' 
                   : `ACQUIRING BODY LANDMARKS... (${result.visibleCount || 0}/${result.totalCount || 8})`}
               </p>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'all' }}>
          <button onClick={onBack} className="btn-outline">CANCEL</button>
          {countdownActive && countdownSeconds > 0 ? (
            <div className="glass" style={{ padding: '20px 40px', minWidth: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', border: '2px solid var(--neon-cyan)', background: 'rgba(0, 240, 255, 0.05)', boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--neon-cyan)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}>STARTING IN</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '4rem', color: 'var(--neon-cyan)', letterSpacing: '4px', textShadow: '0 0 20px rgba(0, 240, 255, 0.8)', animation: 'pulse 0.5s ease-in-out' }}>{countdownSeconds}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>KEEP POSITION STEADY</div>
            </div>
          ) : gestureResult.isPoseLost ? (
            <div className="glass" style={{ padding: '20px 40px', minWidth: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: '2px solid var(--neon-red)', background: 'rgba(255, 59, 92, 0.05)', boxShadow: '0 0 20px rgba(255, 59, 92, 0.3)' }}>
              <AlertCircle color="var(--neon-red)" size={32} />
              <div style={{ fontSize: '0.75rem', color: 'var(--neon-red)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}>POSE LOST</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Get back in frame and try again</div>
            </div>
          ) : result.isReady ? (
            <div className="glass" style={{ padding: '20px 40px', minWidth: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Hand color="var(--neon-purple)" size={28} style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>READY TO START</div>
                  <div style={{ color: 'var(--neon-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>RAISE HANDS OR THUMBS UP</div>
                </div>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>Lift both hands or give a thumbs up to begin analysis</div>
              {gestureResult.confidence > 0 && gestureResult.confidence < 1 && (
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${gestureResult.confidence * 100}%`, height: '100%', background: 'var(--neon-purple)', transition: 'width 0.3s ease', boxShadow: '0 0 10px var(--neon-purple)' }} />
                </div>
              )}
            </div>
          ) : (
            <div className="glass" style={{ padding: '20px 40px', minWidth: '350px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ position: 'relative', width: '12px', height: '12px' }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--neon-yellow)', boxShadow: `0 0 10px var(--neon-yellow)` }} />
              </div>
              <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{selectedExercise.name} mode</div>
                  {/*
                    NOTE: aria-live / role / aria-atomic have been removed from this
                    visible element. Announcements are now handled by the dedicated
                    hidden live region at the top of the JSX, which covers ALL states
                    (calibrating, ready, pose lost, countdown, error) — not just this one.
                  */}
                  <div style={{ color: 'var(--neon-yellow)', fontWeight: 700, fontSize: '0.85rem' }}>
                    {result.message}
                  </div>
              </div>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
        @keyframes radar-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.5); opacity: 0.3; }
          100% { transform: scale(2); opacity: 0; }
        }
        .radar-ping {
          position: relative;
        }
        .radar-ping::after {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: inherit;
          border-radius: 50%;
          animation: radar-pulse 2s infinite;
        }
        .radar-ping.loading::after {
          animation: radar-pulse 1s infinite;
        }
      `}</style>
    </div>
  );
};