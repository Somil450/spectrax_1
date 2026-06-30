import React, { useState, useEffect } from "react";
import { ArrowLeft, Play, Volume2, VolumeX, CheckCircle, Flame, Dumbbell, Sparkles } from "lucide-react";
import { Replay3DModel } from "./Replay3DModel";
import { getExerciseFrames } from "../utils/mockExerciseFrames";
import { AVATAR_SKINS } from "../utils/avatarSkins";
import { exercises } from "../config/exercises";

interface TutorialsScreenProps {
  onBack: () => void;
  onStartTryMode: (exerciseKey: string) => void;
}

interface ProgressionItem {
  key: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  prerequisites?: string;
}

const PROGRESSIONS: ProgressionItem[] = [
  // Beginner
  { key: "squat", name: "Bodyweight Squats", level: "Beginner" },
  { key: "lunge", name: "Lunges", level: "Beginner", prerequisites: "Squat stability" },
  { key: "bicepCurl", name: "Bicep Curls", level: "Beginner" },
  // Intermediate
  { key: "pushup", name: "Push-Ups", level: "Intermediate", prerequisites: "Plank hold" },
  { key: "plank", name: "Plank", level: "Intermediate" },
  { key: "jumpingJack", name: "Jumping Jacks", level: "Intermediate" },
  // Advanced
  { key: "flutterKicks", name: "Flutter Kicks", level: "Advanced", prerequisites: "Core activation" }
];

const WARMUP_STRETCHES = [
  { name: "Neck Rolls", duration: "30s", instructions: "Slowly roll your neck in clockwise and counter-clockwise circles." },
  { name: "Shoulder Rotations", duration: "30s", instructions: "Rotate your shoulders backward and forward to open up the joints." },
  { name: "Dynamic Chest Stretch", duration: "45s", instructions: "Swing arms wide to stretch the chest and shoulders." },
  { name: "Hip Openers", duration: "45s", instructions: "Lift knees high and rotate outwards to warm up hips." }
];

const COOLDOWN_STRETCHES = [
  { name: "Child's Pose", duration: "60s", instructions: "Rest hips on heels, arms stretched out front on the floor." },
  { name: "Cobra Stretch", duration: "45s", instructions: "Lie flat on stomach and lift chest using hands to stretch abs." },
  { name: "Quadriceps Stretch", duration: "30s per leg", instructions: "Pull foot back towards glutes while standing upright." },
  { name: "Deep Breathing", duration: "60s", instructions: "Slow deep breaths in and out to lower heart rate." }
];

export const TutorialsScreen: React.FC<TutorialsScreenProps> = ({ onBack, onStartTryMode }) => {
  const [selectedTab, setSelectedTab] = useState<"exercises" | "warmup" | "cooldown">("exercises");
  const [selectedLevel, setSelectedLevel] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");
  const [selectedExercise, setSelectedExercise] = useState<string>("squat");
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("spectrax.completedTutorials");
    if (saved) {
      try {
        setCompletedTutorials(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load completed tutorials", e);
      }
    }
  }, []);

  const toggleComplete = (key: string) => {
    const next = completedTutorials.includes(key)
      ? completedTutorials.filter(k => k !== key)
      : [...completedTutorials, key];
    setCompletedTutorials(next);
    localStorage.setItem("spectrax.completedTutorials", JSON.stringify(next));
  };

  const speakInstructions = (textList: string[]) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textList.join(". "));
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const currentExerciseConfig = exercises[selectedExercise] || exercises.squat;
  const frames = getExerciseFrames(selectedExercise);

  // Completion calculation
  const totalInLevel = PROGRESSIONS.filter(p => p.level === selectedLevel).length;
  const completedInLevel = PROGRESSIONS.filter(p => p.level === selectedLevel && completedTutorials.includes(p.key)).length;
  const levelProgressPercent = totalInLevel > 0 ? Math.round((completedInLevel / totalInLevel) * 100) : 0;

  return (
    <div className="screen-container" style={{ padding: 24, display: "flex", flexDirection: "column", height: "100vh", boxSizing: "border-box", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} className="btn-glass" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <h2 style={{ margin: 0, fontFamily: "var(--font-heading)", color: "var(--neon-cyan)" }}>
            Exercise Progression & Tutorials
          </h2>
        </div>
        
        {/* Navigation Tabs */}
        <div className="tab-group glass" style={{ display: "flex", gap: 8, padding: 4, borderRadius: 8 }}>
          {(["exercises", "warmup", "cooldown"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setSelectedTab(tab);
                if (typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }
              }}
              className={`btn-glass ${selectedTab === tab ? "active" : ""}`}
              style={{
                textTransform: "capitalize",
                padding: "6px 12px",
                borderColor: selectedTab === tab ? "var(--neon-cyan)" : "transparent"
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {selectedTab === "exercises" && (
        <div style={{ display: "flex", flex: 1, gap: 20, minHeight: 0 }}>
          {/* Sidebar */}
          <div style={{ width: "300px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", paddingRight: 8 }}>
            {/* Level Selector */}
            <div className="card-glass" style={{ padding: 16 }}>
              <h4 style={{ margin: "0 0 12px 0", color: "var(--neon-purple)" }}>Difficulty Level</h4>
              <div style={{ display: "flex", gap: 8 }}>
                {(["Beginner", "Intermediate", "Advanced"] as const).map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setSelectedLevel(lvl);
                      const firstOfLvl = PROGRESSIONS.find(p => p.level === lvl);
                      if (firstOfLvl) setSelectedExercise(firstOfLvl.key);
                    }}
                    className={`btn-glass ${selectedLevel === lvl ? "active" : ""}`}
                    style={{ flex: 1, padding: "6px 4px", fontSize: "11px", borderColor: selectedLevel === lvl ? "var(--neon-purple)" : "var(--glass-border)" }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-secondary)", marginBottom: 4 }}>
                  <span>Progression Progress</span>
                  <span>{completedInLevel}/{totalInLevel} Done ({levelProgressPercent}%)</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${levelProgressPercent}%`, height: "100%", background: "var(--neon-purple)", transition: "width 0.3s" }} />
                </div>
              </div>
            </div>

            {/* Exercise List */}
            <div className="card-glass" style={{ padding: 16, flex: 1 }}>
              <h4 style={{ margin: "0 0 12px 0", color: "var(--neon-green)" }}>Exercises</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PROGRESSIONS.filter(p => p.level === selectedLevel).map(item => {
                  const isDone = completedTutorials.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setSelectedExercise(item.key);
                        if (typeof window !== "undefined" && "speechSynthesis" in window) {
                          window.speechSynthesis.cancel();
                          setIsSpeaking(false);
                        }
                      }}
                      className={`btn-glass ${selectedExercise === item.key ? "active" : ""}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        textAlign: "left",
                        padding: "10px 12px",
                        borderColor: selectedExercise === item.key ? "var(--neon-green)" : "var(--glass-border)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isDone ? <CheckCircle size={14} color="#00ff88" /> : <Dumbbell size={14} color="var(--text-secondary)" />}
                        <span>{item.name}</span>
                      </div>
                      {item.prerequisites && (
                        <span style={{ fontSize: "9px", color: "var(--neon-purple)", opacity: 0.8 }}>
                          Req: {item.prerequisites}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Tutorial View */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card-glass" style={{ flex: 1, position: "relative", minHeight: "300px", borderRadius: 12, overflow: "hidden" }}>
              <Replay3DModel frames={frames} skin={AVATAR_SKINS.CYBERPUNK_NEON || "Cyberpunk Neon"} isPlaying={true} exerciseName={selectedExercise} />
              
              <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8 }}>
                <button
                  onClick={() => toggleComplete(selectedExercise)}
                  className="btn-glass"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: completedTutorials.includes(selectedExercise) ? "rgba(0, 255, 136, 0.15)" : "transparent",
                    borderColor: completedTutorials.includes(selectedExercise) ? "#00ff88" : "var(--glass-border)"
                  }}
                >
                  <CheckCircle size={14} color={completedTutorials.includes(selectedExercise) ? "#00ff88" : "var(--text-secondary)"} />
                  {completedTutorials.includes(selectedExercise) ? "Completed" : "Mark Complete"}
                </button>

                <button onClick={() => onStartTryMode(selectedExercise)} className="btn-neon welcome-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px" }}>
                  <Play size={14} fill="currentColor" /> Try Mode
                </button>
              </div>
            </div>

            {/* Form Cues & Mistakes */}
            <div style={{ display: "flex", gap: 20 }}>
              <div className="card-glass" style={{ flex: 1, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h4 style={{ margin: 0, color: "var(--neon-cyan)" }}>Key Form Cues</h4>
                  <button onClick={() => speakInstructions(currentExerciseConfig.guide?.instructions || [])} className="btn-glass" style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                    {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    {isSpeaking ? "Mute" : "Narrate"}
                  </button>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {(currentExerciseConfig.guide?.instructions || [
                    "Perform the movement slowly under full control.",
                    "Ensure you maintain proper spinal alignment."
                  ]).map((cue, idx) => (
                    <li key={idx}>{cue}</li>
                  ))}
                </ul>
              </div>

              <div className="card-glass" style={{ flex: 1, padding: 16 }}>
                <h4 style={{ margin: "0 0 12px 0", color: "rgba(255, 68, 68, 0.9)" }}>Common Mistakes</h4>
                <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {(currentExerciseConfig.guide?.commonMistakes || [
                    "Swinging body weight for momentum.",
                    "Reducing range of motion."
                  ]).map((mistake, idx) => (
                    <li key={idx} style={{ listStyleType: "circle" }}>{mistake}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 12, fontSize: "12px", color: "var(--text-secondary)" }}>
                  <strong>Target Muscles:</strong>{" "}
                  <span style={{ color: "var(--neon-green)" }}>
                    {(currentExerciseConfig.guide?.targetMuscles || ["General Fullbody"]).join(", ")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTab === "warmup" && (
        <div className="card-glass animate-in" style={{ padding: 24, flex: 1 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--neon-cyan)", margin: "0 0 20px 0" }}>
            <Flame size={20} color="var(--neon-cyan)" /> Pre-Workout Guided Warm-up Stretches
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {WARMUP_STRETCHES.map((stretch, idx) => (
              <div key={idx} className="card-glass" style={{ padding: 16, borderColor: "var(--neon-cyan)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, color: "white" }}>{stretch.name}</h4>
                  <span style={{ color: "var(--neon-cyan)", fontSize: "12px", fontWeight: "bold" }}>{stretch.duration}</span>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {stretch.instructions}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === "cooldown" && (
        <div className="card-glass animate-in" style={{ padding: 24, flex: 1 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--neon-purple)", margin: "0 0 20px 0" }}>
            <Flame size={20} color="var(--neon-purple)" /> Post-Workout Cooldown & Stretches
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {COOLDOWN_STRETCHES.map((stretch, idx) => (
              <div key={idx} className="card-glass" style={{ padding: 16, borderColor: "var(--neon-purple)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, color: "white" }}>{stretch.name}</h4>
                  <span style={{ color: "var(--neon-purple)", fontSize: "12px", fontWeight: "bold" }}>{stretch.duration}</span>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {stretch.instructions}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
