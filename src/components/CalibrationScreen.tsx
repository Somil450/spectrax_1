import React, { useEffect, useRef, useState , useCallback } from 'react';
import { useCameraPose } from '../hooks/useCameraPose';
import { overlayRenderer } from '../services/overlayRenderer';
import { calibrationLogic, CalibrationResult } from '../services/calibrationLogic';
import { Camera, AlertCircle, Dumbbell, Hand } from 'lucide-react';
import { ExerciseConfig, exercises } from '../config/exercises';
import { bodyTypeEngine, BodyType, BodyTypeResult } from '../services/bodyTypeEngine';
import { gestureService, GestureResult } from '../services/gestureService';
import { useWorkoutHistory } from '../useWorkoutHistory';
import { cameraService } from "../services/cameraService";
import { poseService } from "../services/poseService";

interface CalibrationScreenProps {
  selectedExercise: ExerciseConfig;
  onSelectExercise: (key: string) => void;
  onNext: () => void;
  onBack: () => void;
  onBodyTypeDetected: (type: BodyType, factor: number) => void;
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
  
  // -- State variables --
  const { sessions, fetchHistory } = useWorkoutHistory();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const [result, setResult] = useState<CalibrationResult>({
    status: 'red',
    message: 'Initializing system...',
    isReady: false,
    visibleCount: 0,
    totalCount: 8,
    adaptiveFactor: 1.0,
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
    isSingleHandRaised: false,
    command: null,
    gestureConfidences: { START: 0, PAUSE: 0, STOP: 0 },
  });
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  
  const [hoveredExercise, setHoveredExercise] = useState<string | null>(null);
  
  const frameId = useRef<number>(0);
  const lastProcessTime = useRef<number>(0);
  const FPS_LIMIT = 15;
  const countdownIntervalRef = useRef<any>(null);


  const handleResults = useCallback((results: any) => {
    let adaptiveFactor = 1.0;
    
    if (results.poseLandmarks) {
      const bt = bodyTypeEngine.analyze(results.poseLandmarks);
      setBodyTypeRes(bt);
      adaptiveFactor = bt.adaptiveFactor;
      if (bt.bodyType !== 'scanning' && bt.confidence > 0.8) {
        onBodyTypeDetected(bt.bodyType, bt.adaptiveFactor);
      }

      const gesture = gestureService.analyze(results.poseLandmarks);
      setGestureResult(gesture);
    }

    const evaluation = calibrationLogic.evaluate(results, adaptiveFactor);
    setResult(evaluation);

    const primaryJoints = selectedExercise.joints?.flat() || [];
    overlayRenderer.draw(results, evaluation.status, primaryJoints);
  }, [onBodyTypeDetected, selectedExercise]);

  const handleCameraError = (err: any) => {
    const name = (err instanceof Error) ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || err.message === 'PERMISSION_DENIED') {
      setError('CAMERA_PERMISSION_DENIED');
    } else {
      let msg = "Something went wrong starting the camera. Try refreshing the page.";
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = "No camera found on this device. Plug in a webcam and try again.";
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        msg = "Your camera is being used by another app. Close it and try again.";
      }
      setError(msg);
    }
    setResult(prev => ({ ...prev, status: 'red', message: 'Sync failed' }));
  };

  const {
    videoRef,
    canvasRef,
    startSystem,
    stopSystem,
  } = useCameraPose({
    initialFpsLimit: 15,
    minFpsLimit: 8,
    fpsDecrementStep: 3,
    setupContext: true,
    onResults: handleResults,
    onCameraError: handleCameraError,
  });

  // ── ARIA Live Region State ────────────────────────────────────────────────────
  // One string that the hidden live region will announce to screen readers.
  // We update it from useEffect hooks below, each watching a specific thing.
  const [announcement, setAnnouncement] = useState('');

  // Refs to remember the previous values so we only announce when something
  // actually transitions (e.g., isReady going false → true), not on every frame.
  const prevIsReadyRef = useRef(false);
  const prevPoseLostRef = useRef(false);
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


  useEffect(() => {
    setResult(prev => ({ ...prev, message: 'Warming up AI Engine...' }));
    startSystem();

    return () => {
      stopSystem();
      bodyTypeEngine.reset();
      gestureService.reset();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [selectedExercise, onBodyTypeDetected, startSystem, stopSystem]);

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
      ecto: ['squat', 'pushup', 'bicepCurl', 'plank', 'jumpingJack', 'shoulderPress', 'chestPressPunches'],
      meso: ['pushup', 'squat', 'jumpingJack', 'bicepCurl', 'plank', 'shoulderPress', 'chestPressPunches'],
      endo: ['jumpingJack', 'squat', 'plank', 'pushup', 'bicepCurl', 'shoulderPress', 'chestPressPunches']
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
        
        {/* Silhouette Guide Overlay Removed as per user request */}
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
          <div className="calib-header">
            <div className="glass" style={{ padding: '12px', borderRadius: '12px' }}>
              <Camera color="var(--neon-cyan)" size={24} />
            </div>
            <div>
              <h2 className="calib-title">Camera Calibration</h2>
              <p className="calib-subtitle">Step into frame and hold still</p>
            </div>
          </div>

          <div className="glass calib-panel">
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
                        zIndex: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{ex.name.toUpperCase()}</span>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        opacity: 0.8,
                        background: selectedExercise.key === ex.key ? 'rgba(0,0,0,0.2)' : 'rgba(168, 85, 247, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {sessions.filter(s => s.exerciseType === ex.name).reduce((sum, s) => sum + s.totalReps, 0)} REPS
                      </span>
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

             {/* Total Reps Lifetime Stats - Small Section */}
             <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
               <div style={{ fontSize: '0.65rem', color: 'var(--neon-cyan)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', fontWeight: 600 }}>LIFETIME STATS</div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.values(exercises).map(ex => {
                    const reps = sessions.filter(s => s.exerciseType === ex.name).reduce((sum, s) => sum + s.totalReps, 0);
                    return (
                      <div key={`stat-${ex.key}`} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>{ex.name}</span>
                        <span style={{ color: reps > 0 ? 'var(--neon-purple)' : 'var(--text-dim)', fontWeight: 'bold' }}>{reps}</span>
                      </div>
                    );
                  })}
               </div>
             </div>
          </div>
        </div>

        {/* Center Feedback Area */}
        <div style={{ alignSelf: 'center', textAlign: 'center' }}>
          {error === 'CAMERA_PERMISSION_DENIED' ? (
            <div className="glass animate-in" style={{ padding: '32px 48px', border: '1px solid var(--neon-red)', background: 'rgba(255, 59, 92, 0.1)', maxWidth: '500px', pointerEvents: 'all' }}>
              <AlertCircle color="var(--neon-red)" size={48} style={{ marginBottom: '16px', margin: '0 auto' }} />
              <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--neon-red)', marginBottom: '8px' }}>CAMERA ACCESS DENIED</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>SpectraX requires camera access to track your body movements. Please enable permissions in your browser settings and refresh the page.</p>
              <button onClick={() => window.location.reload()} className="btn-outline" style={{ marginTop: '24px', borderColor: 'var(--neon-red)', color: 'var(--neon-red)' }}>RELOAD</button>
            </div>
          ) : error ? (
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