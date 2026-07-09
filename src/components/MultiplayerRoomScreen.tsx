import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { Users, Video, Volume2, Trophy, ArrowLeft, Plus, LogIn, Play, Copy, Check } from "lucide-react";

interface Participant {
  socketId: string;
  name: string;
  reps: number;
  score: number;
  state: string;
}

interface MultiplayerRoomScreenProps {
  onBack: () => void;
  user: any;
}

export const MultiplayerRoomScreen: React.FC<MultiplayerRoomScreenProps> = ({ onBack, user }) => {
  const [socket, setSocket] = useState<any>(null);
  const [userName, setUserName] = useState(user?.displayName || "Athlete");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [gameMode, setGameMode] = useState<"race" | "endurance" | "battle">("battle");
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<"lobby" | "countdown" | "active" | "gameover">("lobby");
  const [countdown, setCountdown] = useState(5);
  const [winnerInfo, setWinnerInfo] = useState<{ winner: string; reason: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [myReps, setMyReps] = useState(0);
  const [myFormScore, setMyFormScore] = useState(100);

  // Simulated voice status
  const [voiceConnected, setVoiceConnected] = useState(false);

  useEffect(() => {
    // Connect to the socket server (falls back to local hostname)
    const socketUrl = window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin;
    const s = io(socketUrl);
    setSocket(s);

    s.on("room:created", ({ roomCode, participants }) => {
      setCurrentRoom(roomCode);
      setParticipants(participants);
      setIsHost(true);
      setGameState("lobby");
    });

    s.on("room:updated", ({ participants, mode }) => {
      setParticipants(participants);
      setGameMode(mode);
    });

    s.on("room:started", ({ mode }) => {
      setGameMode(mode);
      setGameState("countdown");
      setCountdown(5);
    });

    s.on("room:game-over", ({ winner, reason }) => {
      setGameState("gameover");
      setWinnerInfo({ winner, reason });
    });

    s.on("room:error", (msg) => {
      alert(msg);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (gameState !== "countdown") return;
    if (countdown === 0) {
      setGameState("active");
      setMyReps(0);
      setMyFormScore(100);
      return;
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [gameState, countdown]);

  // Simulate local reps increment for demonstration/battle testing
  useEffect(() => {
    if (gameState !== "active") return;
    const interval = setInterval(() => {
      setMyReps((prev) => {
        const next = prev + 1;
        // Broadcast stat changes
        socket?.emit("room:update-stats", {
          roomCode: currentRoom,
          reps: next,
          score: Math.floor(80 + Math.random() * 20),
          state: "active"
        });
        return next;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [gameState, currentRoom, socket]);

  const handleCreateRoom = () => {
    if (!userName.trim()) return;
    socket?.emit("room:create", { name: userName });
    setVoiceConnected(true);
  };

  const handleJoinRoom = () => {
    if (!userName.trim() || !roomCodeInput.trim()) return;
    socket?.emit("room:join", { roomCode: roomCodeInput.toUpperCase(), name: userName });
    setCurrentRoom(roomCodeInput.toUpperCase());
    setIsHost(false);
    setGameState("lobby");
    setVoiceConnected(true);
  };

  const handleStartGame = () => {
    if (!isHost || !currentRoom) return;
    socket?.emit("room:start-game", { roomCode: currentRoom, mode: gameMode });
  };

  const copyRoomCode = () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="screen-container" style={{ padding: "24px", color: "#fff", background: "#0a0a0c" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <button onClick={onBack} className="btn-glass" style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", padding: "8px 16px", borderRadius: "8px", color: "#fff", cursor: "pointer" }}>
          <ArrowLeft size={16} /> Back
        </button>
        <h2 style={{ fontFamily: "Orbitron", margin: 0, textShadow: "0 0 10px #00ffff" }}>Live Workout Rooms</h2>
        <div style={{ width: "80px" }} />
      </div>

      {!currentRoom ? (
        // Room Creation / Join Lobby Selection
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", maxWidth: "800px", margin: "40px auto" }}>
          <div className="card-glass" style={{ padding: "32px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px" }}>
            <h3 style={{ fontFamily: "Orbitron", display: "flex", alignItems: "center", gap: "8px", color: "#00ffff" }}><Plus size={20} /> Create Workout Room</h3>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>Start a real-time multiplayer workout session and invite friends to compete.</p>
            <div style={{ marginTop: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", color: "#00ff88" }}>YOUR NICKNAME</label>
              <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", outline: "none" }} />
            </div>
            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", color: "#00ff88" }}>CHOOSE MODE</label>
              <select value={gameMode} onChange={(e: any) => setGameMode(e.target.value)} style={{ width: "100%", padding: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", outline: "none" }}>
                <option value="battle">Form Battle (Highest Avg Score)</option>
                <option value="race">Race Mode (First to 50 Reps)</option>
                <option value="endurance">Endurance Mode (Survival)</option>
              </select>
            </div>
            <button onClick={handleCreateRoom} className="btn-neon" style={{ width: "100%", marginTop: "24px", padding: "12px", borderRadius: "8px", border: "none", background: "#00ff88", color: "#000", fontWeight: "bold", cursor: "pointer", boxShadow: "0 0 15px #00ff88" }}>
              Create Room
            </button>
          </div>

          <div className="card-glass" style={{ padding: "32px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px" }}>
            <h3 style={{ fontFamily: "Orbitron", display: "flex", alignItems: "center", gap: "8px", color: "#00ffff" }}><LogIn size={20} /> Join Workout Room</h3>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>Enter a shared room code to join an active workout session lobby.</p>
            <div style={{ marginTop: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", color: "#00ff88" }}>YOUR NICKNAME</label>
              <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", outline: "none" }} />
            </div>
            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", color: "#00ff88" }}>ROOM CODE</label>
              <input type="text" placeholder="E.G. AB42X" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value)} style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", outline: "none", textTransform: "uppercase" }} />
            </div>
            <button onClick={handleJoinRoom} className="btn-neon" style={{ width: "100%", marginTop: "56px", padding: "12px", borderRadius: "8px", border: "none", background: "#00ffff", color: "#000", fontWeight: "bold", cursor: "pointer", boxShadow: "0 0 15px #00ffff" }}>
              Join Session
            </button>
          </div>
        </div>
      ) : (
        // Room Session UI
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "24px" }}>
          {/* Main Area */}
          <div>
            {gameState === "lobby" && (
              <div className="card-glass" style={{ padding: "40px", textAlign: "center", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px" }}>
                <h3 style={{ fontFamily: "Orbitron", color: "#00ffff" }}>Lobby Status: Waiting for players...</h3>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.05)", padding: "12px 24px", borderRadius: "12px", marginTop: "16px" }}>
                  <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>Room Code:</span>
                  <strong style={{ fontSize: "20px", color: "#00ff88", fontFamily: "Orbitron" }}>{currentRoom}</strong>
                  <button onClick={copyRoomCode} style={{ background: "none", border: "none", color: copied ? "#00ff88" : "#fff", cursor: "pointer" }}>
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>

                <div style={{ marginTop: "32px" }}>
                  <h4>Active Mode: <span style={{ color: "#00ff88", textTransform: "uppercase" }}>{gameMode}</span></h4>
                  {isHost ? (
                    <button onClick={handleStartGame} className="btn-neon" style={{ padding: "14px 40px", fontSize: "16px", borderRadius: "8px", border: "none", background: "#00ff88", color: "#000", fontWeight: "bold", cursor: "pointer", boxShadow: "0 0 15px #00ff88", display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                      <Play size={18} /> Start Session
                    </button>
                  ) : (
                    <p style={{ color: "rgba(255,255,255,0.5)" }}>Only the room host can start the workout battle.</p>
                  )}
                </div>
              </div>
            )}

            {gameState === "countdown" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
                <h2 style={{ fontFamily: "Orbitron", fontSize: "24px", color: "rgba(255,255,255,0.8)" }}>Workout starting in...</h2>
                <div style={{ fontSize: "120px", fontFamily: "Orbitron", color: "#00ff88", textShadow: "0 0 30px #00ff88", fontWeight: "bold" }}>{countdown}</div>
              </div>
            )}

            {(gameState === "active" || gameState === "gameover") && (
              <div>
                {/* Live Participant Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                  {participants.map((p) => {
                    const isMe = p.socketId === socket?.id;
                    return (
                      <div key={p.socketId} className="card-glass" style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: `1px solid ${isMe ? "#00ff88" : "rgba(255,255,255,0.05)"}`, borderRadius: "12px", position: "relative" }}>
                        <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                          {isMe && <span style={{ background: "#00ff88", color: "#000", fontSize: "10px", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px" }}>YOU</span>}
                          <span style={{ color: "#00ffff", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}><Volume2 size={12} /> Live Voice</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#1a1a24", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
                            <Video size={24} style={{ color: "#00ff88" }} />
                          </div>
                          <div>
                            <h4 style={{ margin: "0 0 4px 0", fontFamily: "Orbitron" }}>{p.name}</h4>
                            <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
                              <span style={{ color: "rgba(255,255,255,0.6)" }}>Reps: <strong style={{ color: "#fff" }}>{isMe ? myReps : p.reps}</strong></span>
                              <span style={{ color: "rgba(255,255,255,0.6)" }}>Form Score: <strong style={{ color: "#00ff88" }}>{isMe ? myFormScore : p.score}%</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {gameState === "gameover" && winnerInfo && (
                  <div className="card-glass" style={{ padding: "24px", background: "rgba(255,51,102,0.1)", border: "1px solid #ff3366", borderRadius: "12px", textAlign: "center" }}>
                    <h3 style={{ color: "#ff3366", fontFamily: "Orbitron", display: "inline-flex", alignItems: "center", gap: "8px" }}><Trophy size={20} /> Game Over!</h3>
                    <p style={{ fontSize: "16px", margin: "8px 0" }}>Winner: <strong>{winnerInfo.winner}</strong></p>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>Reason: {winnerInfo.reason}</p>
                    <button onClick={() => setGameState("lobby")} className="btn-glass" style={{ marginTop: "16px", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 24px", color: "#fff", cursor: "pointer", borderRadius: "8px" }}>
                      Back to Lobby
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar / Leaderboard */}
          <div className="card-glass" style={{ padding: "20px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px" }}>
            <h3 style={{ fontFamily: "Orbitron", color: "#00ffff", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px", marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}><Trophy size={18} /> Leaderboard</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              {participants
                .slice()
                .sort((a, b) => b.reps - a.reps)
                .map((p, idx) => (
                  <div key={p.socketId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "14px" }}>
                    <span>{idx + 1}. {p.name}</span>
                    <strong style={{ color: "#00ff88" }}>{p.socketId === socket?.id ? myReps : p.reps} reps</strong>
                  </div>
                ))}
            </div>

            <div style={{ marginTop: "32px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "16px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#00ff88" }}>Room Information</h4>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", margin: "4px 0" }}>Participants: {participants.length}/6</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", margin: "4px 0" }}>Voice status: {voiceConnected ? "Connected" : "Disconnected"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiplayerRoomScreen;
