import React, { useEffect, useRef, useState, useCallback } from "react";
import { tfjsPoseService } from "../../services/tfjs";
import { useSettings } from "../../context/SettingsContext";
import { ArrowLeft, Trophy, Users, ShieldAlert, Award } from "lucide-react";
import type { Pose } from "@tensorflow-models/pose-detection";

interface BattleModeProps {
  onBack: () => void;
}

const MOVE_JOINTS: Record<string, { a: number; b: number; c: number }> = {
  squat: { a: 11, b: 13, c: 15 }, // Hip, Knee, Ankle
  pushup: { a: 5, b: 7, c: 9 },   // Shoulder, Elbow, Wrist
};

function calculateJointAngle(pose: Pose, joints: { a: number; b: number; c: number }) {
  const kp = pose.keypoints;
  const a = kp[joints.a];
  const b = kp[joints.b];
  const c = kp[joints.c];
  if (!a || !b || !c || a.score === 0 || b.score === 0 || c.score === 0) return 0;
  
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);
  if (magAB < 1e-6 || magCB < 1e-6) return 0;
  const cos = dot / (magAB * magCB);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
}

export const BattleMode: React.FC<BattleModeProps> = ({ onBack }) => {
  const { settings } = useSettings();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [exercise, setExercise] = useState<"squat" | "pushup">("squat");
  const [matchState, setMatchState] = useState<"lobby" | "countdown" | "battle" | "finished">("lobby");
  const [countdown, setCountdown] = useState<number>(3);
  const [timer, setTimer] = useState<number>(30);
  
  const [p1Reps, setP1Reps] = useState<number>(0);
  const [p2Reps, setP2Reps] = useState<number>(0);
  const [winner, setWinner] = useState<string | null>(null);

  const p1Stage = useRef<"up" | "down">("up");
  const p2Stage = useRef<"up" | "down">("up");
  const requestRef = useRef<number | null>(null);

  // Setup Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access failed in BattleMode:", err);
    }
  };

  useEffect(() => {
    startCamera();
    tfjsPoseService.initMultiPose();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Multi-person rep counting loop
  const detectLoop = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.paused) {
      requestRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw video feed
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const poses = await tfjsPoseService.estimateMultiplePoses(video);
    
    // Filter high confidence poses
    const activePoses = poses.filter(p => p.score && p.score > 0.35);

    // Render Skeletons
    if (settings.showSkeleton) {
      activePoses.forEach(pose => {
        pose.keypoints.forEach(kp => {
          if (kp.score && kp.score > 0.4) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = "var(--neon-cyan, #00f0ff)";
            ctx.fill();
          }
        });
      });
    }

    if (matchState === "battle") {
      // Sort poses left-to-right (Player 1 is left, Player 2 is right)
      const sorted = [...activePoses].sort((a, b) => a.keypoints[0].x - b.keypoints[0].x);
      
      const p1 = sorted[0];
      const p2 = sorted[1];
      const jointInfo = MOVE_JOINTS[exercise];

      if (p1) {
        const p1Angle = calculateJointAngle(p1, jointInfo);
        if (p1Angle > 10 && p1Angle < 100 && p1Stage.current === "up") {
          p1Stage.current = "down";
        } else if (p1Angle > 145 && p1Stage.current === "down") {
          p1Stage.current = "up";
          setP1Reps(prev => prev + 1);
        }
      }

      if (p2) {
        const p2Angle = calculateJointAngle(p2, jointInfo);
        if (p2Angle > 10 && p2Angle < 100 && p2Stage.current === "up") {
          p2Stage.current = "down";
        } else if (p2Angle > 145 && p2Stage.current === "down") {
          p2Stage.current = "up";
          setP2Reps(prev => prev + 1);
        }
      }
    }

    requestRef.current = requestAnimationFrame(detectLoop);
  }, [matchState, exercise, settings.showSkeleton]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(detectLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [detectLoop]);

  // Timers and Match States
  useEffect(() => {
    if (matchState === "countdown") {
      const id = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(id);
            setMatchState("battle");
            setTimer(30);
            setP1Reps(0);
            setP2Reps(0);
            p1Stage.current = "up";
            p2Stage.current = "up";
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(id);
    }
  }, [matchState]);

  useEffect(() => {
    if (matchState === "battle") {
      const id = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(id);
            setMatchState("finished");
            // Determine Winner
            if (p1Reps > p2Reps) setWinner("PLAYER 1");
            else if (p2Reps > p1Reps) setWinner("PLAYER 2");
            else setWinner("TIE");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(id);
    }
  }, [matchState, p1Reps, p2Reps]);

  return (
    <div className="screen-container" style={{ background: "var(--bg-primary, #090d27)", display: "flex", flexDirection: "column", padding: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={onBack} className="btn-outline" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ArrowLeft size={16} /> Back
        </button>
        <h2 style={{ fontFamily: "var(--font-heading)", color: "var(--neon-purple)" }}>WORKOUT BATTLE</h2>
        <div style={{ width: "80px" }}></div>
      </div>

      <div style={{ display: "flex", gap: "20px", flex: 1, height: "100%" }}>
        {/* Play Space (Split view overlays) */}
        <div style={{ flex: 1, position: "relative", background: "#000", borderRadius: "16px", overflow: "hidden", display: "flex" }}>
          <video ref={videoRef} style={{ display: "none" }} />
          <canvas ref={canvasRef} width={640} height={480} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

          {/* Player 1 HUD */}
          <div style={{ position: "absolute", left: "20px", top: "20px", padding: "16px", borderRadius: "12px", background: "rgba(9, 13, 39, 0.75)", border: "1px solid var(--neon-cyan)", minWidth: "150px" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--neon-cyan)", fontWeight: "bold" }}>PLAYER 1 (LEFT)</div>
            <div style={{ fontSize: "2rem", fontWeight: "bold", fontFamily: "var(--font-heading)" }}>{p1Reps} reps</div>
          </div>

          {/* Player 2 HUD */}
          <div style={{ position: "absolute", right: "20px", top: "20px", padding: "16px", borderRadius: "12px", background: "rgba(9, 13, 39, 0.75)", border: "1px solid var(--neon-purple)", minWidth: "150px", textAlign: "right" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--neon-purple)", fontWeight: "bold" }}>PLAYER 2 (RIGHT)</div>
            <div style={{ fontSize: "2rem", fontWeight: "bold", fontFamily: "var(--font-heading)" }}>{p2Reps} reps</div>
          </div>

          {/* Match HUD / Overlays */}
          {matchState === "lobby" && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(9,13,39,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
              <Users size={64} style={{ color: "var(--neon-cyan)" }} />
              <h3>READY FOR BATTLE?</h3>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => setExercise("squat")} className={`btn-outline ${exercise === "squat" ? "active" : ""}`} style={{ borderColor: exercise === "squat" ? "var(--neon-cyan)" : "" }}>SQUAT</button>
                <button onClick={() => setExercise("pushup")} className={`btn-outline ${exercise === "pushup" ? "active" : ""}`} style={{ borderColor: exercise === "pushup" ? "var(--neon-cyan)" : "" }}>PUSH-UP</button>
              </div>
              <button onClick={() => setMatchState("countdown")} className="btn-neon" style={{ background: "var(--neon-green)", color: "#000", padding: "12px 32px", fontSize: "1rem", fontWeight: "bold" }}>START BATTLE</button>
            </div>
          )}

          {matchState === "countdown" && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(9,13,39,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--neon-cyan)", letterSpacing: "2px" }}>GET INTO POSITION</div>
              <div style={{ fontSize: "6rem", fontWeight: "bold", color: "var(--neon-cyan)", textShadow: "0 0 20px rgba(0, 240, 255, 0.8)" }}>{countdown}</div>
            </div>
          )}

          {matchState === "battle" && (
            <div style={{ position: "absolute", bottom: "30px", left: "50%", transform: "translateX(-50%)", padding: "12px 24px", borderRadius: "20px", background: "rgba(9,13,39,0.85)", border: "2px solid var(--neon-cyan)", fontSize: "1.5rem", fontWeight: "bold" }}>
              TIME LEFT: {timer}s
            </div>
          )}

          {matchState === "finished" && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(9,13,39,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
              <Trophy size={80} style={{ color: "var(--neon-yellow, #ffd700)", animation: "bounce 1.5s infinite" }} />
              <h2 style={{ fontFamily: "var(--font-heading)", letterSpacing: "4px" }}>MATCH FINISHED</h2>
              <div style={{ fontSize: "2rem", color: "var(--neon-green)", fontWeight: "bold" }}>
                {winner === "TIE" ? "IT'S A TIE!" : `${winner} WINS!`}
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button onClick={() => setMatchState("lobby")} className="btn-outline">LOBBY</button>
                <button onClick={() => setMatchState("countdown")} className="btn-neon" style={{ background: "var(--neon-cyan)", color: "#000" }}>REMATCH</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BattleMode;
