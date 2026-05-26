/* eslint-env browser */
import './style.css';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
//   APP STATE & ROUTER
//   ═══════════════════════════════════════════════════════════════
const state = {
  currentScreen: '',
  timerInterval: null,
  workoutSeconds: 0,
  reps: 0,
  isRecording: false,
};

function navigate(hash) {
  if (state.currentScreen === hash) return;
  
  // Clean up current screen
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('active'));
  
  const target = document.querySelector(hash || '#welcome-screen');
  if (target) {
    target.classList.add('active');
    state.currentScreen = hash || '#welcome-screen';
    
    // Screen-specific initialization
    if (state.currentScreen === '#workout-screen') initWorkout();
    if (state.currentScreen === '#summary-screen') initSummary();
    if (state.currentScreen === '#replay-screen') initReplay();
  }
}

window.addEventListener('hashchange', () => navigate(window.location.hash));

// ═══════════════════════════════════════════════════════════════
//   SCREEN RENDERERS
//   ═══════════════════════════════════════════════════════════════

const app = document.querySelector('#app');

app.innerHTML = `
  <!-- ==========================================
       SCREEN 1 — WELCOME
       ========================================== -->
  <div id="welcome-screen" class="screen">
    <canvas class="particle-canvas" id="welcome-canvas"></canvas>
    <div class="holo-ring" style="width: 400px; height: 400px;"></div>
    <div class="holo-ring" style="width: 550px; height: 550px; animation-direction: reverse; animation-duration: 30s; opacity: 0.5;"></div>
    
    <div class="welcome-content animate-in">
      <h1 class="brand-title">SPECTRAX</h1>
      <p class="brand-subtitle text-glow">AI-Powered Fitness Tracking & Analysis</p>
      
      <a href="#camera-screen" class="btn-neon animate-in animate-delay-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4V8z"/></svg>
        Get Started
      </a>
      
      <p class="brand-tagline animate-in animate-delay-4">Precision performance for the next generation</p>
    </div>
  </div>

  <!-- ==========================================
       SCREEN 2 — CAMERA / SETUP
       ========================================== -->
  <div id="camera-screen" class="screen">
    <div class="welcome-content animate-in">
      <h2 class="text-glow" style="font-family: var(--font-heading); margin-bottom: 24px; color: var(--neon-cyan);">SYSTEM CALIBRATION</h2>
      
      <div class="camera-container">
        <!-- Simulated camera feed -->
        <div class="camera-feed"></div>
        <div class="scan-line"></div>
        
        <div class="corner-bracket tl"></div>
        <div class="corner-bracket tr"></div>
        <div class="corner-bracket bl"></div>
        <div class="corner-bracket br"></div>
        
        <div class="alignment-guide text-glow">
          <svg viewBox="0 0 100 200" fill="none" stroke="var(--neon-cyan)" stroke-width="2" stroke-dasharray="4 4">
            <ellipse cx="50" cy="30" rx="15" ry="20" />
            <path d="M50 50 L50 110 M20 70 L80 70 M20 70 L10 120 M80 70 L90 120 M50 110 L35 180 M50 110 L65 180" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      
      <p class="camera-instruction animate-in animate-delay-2">Position your full body within the frame</p>
      
      <div class="camera-actions animate-in animate-delay-3">
        <a href="#welcome-screen" class="btn-outline">Back</a>
        <a href="#workout-screen" class="btn-neon">Start Analysis</a>
      </div>
    </div>
  </div>

  <!-- ==========================================
       SCREEN 3 — LIVE WORKOUT
       ========================================== -->
  <div id="workout-screen" class="screen">
    <div class="workout-bg"></div>
    
    <div class="workout-top animate-in">
      <div class="glass exercise-panel">
        <div class="exercise-label">Current Exercise</div>
        <div class="exercise-name">Squats</div>
      </div>
      
      <div class="glass timer-panel">
        <div class="timer-label">Elapsed Time</div>
        <div class="timer-value" id="workout-timer">00:00</div>
      </div>
    </div>
    
    <div class="skeleton-area">
      <!-- SVG Skeleton -->
      <svg class="skeleton-svg" viewBox="0 0 100 150">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <!-- Lines -->
        <g id="skel-lines" stroke-width="3" stroke-linecap="round" filter="url(#glow)">
          <!-- Spine -->
          <line x1="50" y1="25" x2="50" y2="70" stroke="var(--neon-green)" />
          <!-- Shoulders -->
          <line x1="30" y1="35" x2="70" y2="35" stroke="var(--neon-green)" />
          <!-- Arms -->
          <line x1="30" y1="35" x2="20" y2="65" stroke="var(--neon-green)" id="arm-l" />
          <line x1="70" y1="35" x2="80" y2="65" stroke="var(--neon-green)" id="arm-r" />
          <!-- Hips -->
          <line x1="40" y1="70" x2="60" y2="70" stroke="var(--neon-green)" />
          <!-- Legs -->
          <line x1="40" y1="70" x2="35" y2="105" stroke="var(--neon-green)" id="leg-l-thigh" />
          <line x1="35" y1="105" x2="30" y2="140" stroke="var(--neon-green)" id="leg-l-calf" />
          
          <line x1="60" y1="70" x2="65" y2="105" stroke="var(--neon-green)" id="leg-r-thigh" />
          <line x1="65" y1="105" x2="70" y2="140" stroke="var(--neon-green)" id="leg-r-calf" />
        </g>
        
        <!-- Joints -->
        <g id="skel-joints" fill="#ffffff">
          <!-- Head -->
          <circle cx="50" cy="15" r="8" fill="var(--neon-cyan)" filter="url(#glow)"/>
          <!-- Joints -->
          <circle cx="50" cy="25" r="3" />
          <circle cx="30" cy="35" r="3" />
          <circle cx="70" cy="35" r="3" />
          <circle cx="20" cy="65" r="3" />
          <circle cx="80" cy="65" r="3" />
          <circle cx="40" cy="70" r="3" />
          <circle cx="60" cy="70" r="3" />
          <circle cx="35" cy="105" r="3" />
          <circle cx="65" cy="105" r="3" />
          <circle cx="30" cy="140" r="3" />
          <circle cx="70" cy="140" r="3" />
        </g>
      </svg>
    </div>
    
    <div class="workout-bottom animate-in animate-delay-2">
      <div class="rep-counter">
        <span class="rep-number" id="workout-reps">0</span>
        <span class="rep-label">Reps Completed</span>
      </div>
      
      <div class="feedback-row">
        <div class="glass glass-glow feedback-panel">
          <div class="feedback-text" id="live-feedback">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Perfect form. Keep it up.</span>
          </div>
        </div>
        
        <a href="#summary-screen" class="btn-neon root end-btn" style="background: var(--neon-red);">
          End Workout
        </a>
      </div>
    </div>
  </div>

  <!-- ==========================================
       SCREEN 4 — SUMMARY
       ========================================== -->
  <div id="summary-screen" class="screen">
    <div class="summary-header animate-in">
      <h2 class="summary-title">Workout Summary</h2>
      <p class="summary-sub">Session complete. Analyzing performance data...</p>
    </div>
    
    <div class="glass accuracy-ring-wrap animate-in animate-delay-1" style="padding: 30px; border-radius: 50%; width: 200px; height: 200px; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 40px rgba(168,85,247,0.15);">
      <div class="progress-ring-container">
        <svg width="160" height="160" viewBox="0 0 160 160" style="transform: rotate(-90deg);">
          <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="12" />
          <!-- Animated circle (stroke-dasharray = 2 * PI * 70 = 440) -->
          <circle id="accuracy-ring" cx="80" cy="80" r="70" fill="none" stroke="var(--neon-purple)" stroke-width="12" stroke-dasharray="440" stroke-dashoffset="440" stroke-linecap="round" style="transition: stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1);" />
        </svg>
        <div class="ring-label" style="font-size: 2.5rem; color: var(--neon-cyan);">
          <span id="summary-accuracy">0</span><span style="font-size: 1.2rem;">%</span>
        </div>
      </div>
    </div>
    
    <div class="stats-row animate-in animate-delay-2">
      <div class="glass stat-card">
        <div class="stat-icon">🔄</div>
        <div class="stat-value" id="summary-reps">12</div>
        <div class="stat-label">Total Reps</div>
      </div>
      <div class="glass stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-value" id="summary-time">02:45</div>
        <div class="stat-label">Duration</div>
      </div>
    </div>
    
    <div class="glass mistakes-card animate-in animate-delay-3">
      <div class="mistakes-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        Form Review Areas
      </div>
      
      <div class="mistake-item">
        <span class="mistake-time">00:42</span>
        <span>Knees caving inwards during descent</span>
      </div>
      <div class="mistake-item">
        <span class="mistake-time">01:15</span>
        <span>Rounding lower back at the bottom</span>
      </div>
      <div class="mistake-item">
        <span class="mistake-time">02:03</span>
        <span>Not hitting full depth on rep 8</span>
      </div>
    </div>
    
    <div class="summary-actions animate-in animate-delay-4">
      <a href="#welcome-screen" class="btn-outline">Start Again</a>
      <a href="#replay-screen" class="btn-neon purple">View 3D Replay</a>
    </div>
  </div>

  <!-- ==========================================
       SCREEN 5 — 3D REPLAY
       ========================================== -->
  <div id="replay-screen" class="screen">
    <div class="replay-header">
      <div class="replay-title text-glow">3D PERFORMANCE REVIEW</div>
      <a href="#summary-screen" class="btn-outline" style="padding: 8px 16px; font-size: 0.65rem;">Back</a>
    </div>
    
    <div class="replay-canvas-container" id="replay-canvas">
      <!-- Three.js renders here -->
    </div>
    
    <div class="glass replay-side-panel">
      <div class="side-panel-title">Frame-by-Frame Tracking</div>
      
      <div class="frame-feedback-item">
        <span class="frame-time">00:42</span>
        <span class="frame-msg">Right knee valgus detected. Lateral movement exceeds 5cm threshold.</span>
      </div>
      <div class="frame-feedback-item" style="border-left: 2px solid var(--neon-red); padding-left: 8px; background: rgba(255,59,92,0.05);">
        <span class="frame-time">01:15</span>
        <span class="frame-msg" style="color: var(--neon-red);">Lumbar flexion critical. Keep chest up.</span>
      </div>
      <div class="frame-feedback-item">
        <span class="frame-time">02:03</span>
        <span class="frame-msg">Hip crease above patella. Depth insufficient.</span>
      </div>
      <div class="frame-feedback-item">
        <span class="frame-time">02:30</span>
        <span class="frame-msg" style="color: var(--neon-green);">Excellent form correction on final reps.</span>
      </div>
    </div>
    
    <div class="replay-controls-bar">
      <input type="range" min="0" max="100" value="0" class="timeline-slider" id="replay-slider">
      <div class="control-buttons">
        <button class="ctrl-btn" id="btn-restart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button class="ctrl-btn play" id="btn-play">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9z"/></svg>
        </button>
        <button class="ctrl-btn" id="btn-next">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  </div>
`;

// ═══════════════════════════════════════════════════════════════
//   LOGIC
//   ═══════════════════════════════════════════════════════════════

// --- Particles (Welcome Screen) ---
function initParticles() {
  const canvas = document.getElementById('welcome-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles = [];
  for (let i = 0; i < 70; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 1.5 + 0.5
    });
  }
  
  function animateParticles() {
    if (state.currentScreen !== '#welcome-screen' && state.currentScreen !== '') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.fill();
    });
    
    // Connect particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0, 240, 255, ${0.1 * (1 - dist/120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    
    requestAnimationFrame(animateParticles);
  }
  
  animateParticles();
  
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

// --- Live Workout ---
function initWorkout() {
  state.workoutSeconds = 0;
  state.reps = 0;
  
  const timerEl = document.getElementById('workout-timer');
  const repsEl = document.getElementById('workout-reps');
  const feedbackEl = document.getElementById('live-feedback');
  const legL = document.getElementById('leg-l-thigh');
  const legR = document.getElementById('leg-r-thigh');
  
  // Update UI loop
  state.timerInterval = setInterval(() => {
    state.workoutSeconds++;
    
    // Format mm:ss
    const m = Math.floor(state.workoutSeconds / 60).toString().padStart(2, '0');
    const s = (state.workoutSeconds % 60).toString().padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
    
    // Simulate reps every 4 seconds
    if (state.workoutSeconds % 4 === 0) {
      state.reps++;
      repsEl.textContent = state.reps;
      
      // Simulate form feedback logic
      if (state.reps === 3 || state.reps === 7) {
        feedbackEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--neon-yellow)" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                              <span style="color:var(--neon-yellow)">Knees caving inwards. Push out.</span>`;
        legL.setAttribute('stroke', 'var(--neon-yellow)');
        legR.setAttribute('stroke', 'var(--neon-yellow)');
      } else if (state.reps === 5) {
        feedbackEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--neon-red)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                              <span style="color:var(--neon-red)">Rounding lower back! Keep chest up.</span>`;
        legL.setAttribute('stroke', 'var(--neon-red)');
        legR.setAttribute('stroke', 'var(--neon-red)');
      } else {
        feedbackEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--neon-green)" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              <span style="color:var(--neon-green)">Perfect form. Keep it up.</span>`;
        legL.setAttribute('stroke', 'var(--neon-green)');
        legR.setAttribute('stroke', 'var(--neon-green)');
      }
    }
    
    // Animate skeleton slightly (simulate breathing/movement)
    const skel = document.querySelector('.skeleton-svg');
    skel.style.transform = `scale(${1 + Math.sin(state.workoutSeconds * 2) * 0.02})`;
    
  }, 1000);
}

// --- Summary ---
function initSummary() {
  const m = Math.floor(state.workoutSeconds / 60).toString().padStart(2, '0');
  const s = (state.workoutSeconds % 60).toString().padStart(2, '0');
  
  document.getElementById('summary-reps').textContent = state.reps || 12;
  document.getElementById('summary-time').textContent = state.workoutSeconds > 0 ? `${m}:${s}` : '02:45';
  
  // Animate accuracy ring
  setTimeout(() => {
    const accuracy = 92; // Simulated accuracy
    document.getElementById('summary-accuracy').textContent = accuracy;
    
    // total dash array length is 440
    const offset = 440 - (440 * accuracy) / 100;
    document.getElementById('accuracy-ring').style.strokeDashoffset = offset;
  }, 500);
}

// --- 3D Replay (Three.js) ---
let replayScene, replayCamera, replayRenderer;
let skeletonGroup;
let animationFrameId;

function initReplay() {
  const container = document.getElementById('replay-canvas');
  if (container.children.length > 0) return; // Already init
  
  replayScene = new THREE.Scene();
  replayScene.fog = new THREE.FogExp2(0x0a0a1a, 0.05);
  
  replayCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  replayCamera.position.set(0, 1.5, 4.5);
  
  replayRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  replayRenderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(replayRenderer.domElement);
  
  // Lighting
  const ambient = new THREE.AmbientLight(0x404040);
  replayScene.add(ambient);
  
  const neonCyanLight = new THREE.PointLight(0x00f0ff, 2, 10);
  neonCyanLight.position.set(-2, 3, 2);
  replayScene.add(neonCyanLight);
  
  const neonPurpleLight = new THREE.PointLight(0xa855f7, 2, 10);
  neonPurpleLight.position.set(2, -1, 2);
  replayScene.add(neonPurpleLight);
  
  // Grid floor
  const gridHelper = new THREE.GridHelper(10, 20, 0x00f0ff, 0x222244);
  gridHelper.position.y = -1;
  replayScene.add(gridHelper);
  
  // Build simple 3D Skeleton
  skeletonGroup = new THREE.Group();
  
  const materialJoint = new THREE.MeshStandardMaterial({ 
    color: 0x00f0ff, 
    emissive: 0x00f0ff, 
    emissiveIntensity: 0.5 
  });
  
  const materialBone = new THREE.MeshStandardMaterial({ 
    color: 0x00f0ff, 
    transparent: true, 
    opacity: 0.5 
  });
  
  const materialError = new THREE.MeshStandardMaterial({
    color: 0xff3b5c,
    emissive: 0xff3b5c,
    emissiveIntensity: 0.8
  });
  
  // Helper to create joints and bones
  const joints = {};
  function addJoint(name, x, y, z, isError=false) {
    const geo = new THREE.SphereGeometry(0.06, 16, 16);
    const mesh = new THREE.Mesh(geo, isError ? materialError : materialJoint);
    mesh.position.set(x, y, z);
    skeletonGroup.add(mesh);
    joints[name] = mesh;
  }
  
  function addBone(j1, j2) {
    const distance = joints[j1].position.distanceTo(joints[j2].position);
    const geo = new THREE.CylinderGeometry(0.02, 0.02, distance, 8);
    const mesh = new THREE.Mesh(geo, materialBone);
    
    // Position halfway
    mesh.position.copy(joints[j1].position).lerp(joints[j2].position, 0.5);
    
    // Rotation logic
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      joints[j2].position.clone().sub(joints[j1].position).normalize()
    );
    
    skeletonGroup.add(mesh);
  }
  
  // Positions approximate
  addJoint('head', 0, 1.7, 0);
  addJoint('neck', 0, 1.5, 0);
  addJoint('shoulderL', -0.3, 1.4, 0);
  addJoint('shoulderR', 0.3, 1.4, 0);
  addJoint('elbowL', -0.4, 1.1, 0.1);
  addJoint('elbowR', 0.4, 1.1, 0.1);
  addJoint('handL', -0.4, 0.8, 0.2);
  addJoint('handR', 0.4, 0.8, 0.2);
  
  addJoint('hipL', -0.2, 0.9, 0);
  addJoint('hipR', 0.2, 0.9, 0);
  addJoint('kneeL', -0.2, 0.4, 0.1, true); // Highlight knee as red
  addJoint('kneeR', 0.2, 0.4, 0.1);
  addJoint('footL', -0.2, 0, 0);
  addJoint('footR', 0.2, 0, 0);
  
  addBone('head', 'neck');
  addBone('neck', 'shoulderL');
  addBone('neck', 'shoulderR');
  addBone('shoulderL', 'elbowL');
  addBone('elbowL', 'handL');
  addBone('shoulderR', 'elbowR');
  addBone('elbowR', 'handR');
  addBone('neck', 'hipL');     // simple spine
  addBone('neck', 'hipR');     // simple spine
  addBone('hipL', 'hipR');
  addBone('hipL', 'kneeL');
  addBone('kneeL', 'footL');
  addBone('hipR', 'kneeR');
  addBone('kneeR', 'footR');
  
  skeletonGroup.position.y = -0.5;
  replayScene.add(skeletonGroup);
  
  // Animation loop
  let isPlaying = true;
  let time = 0;
  
  const playBtn = document.getElementById('btn-play');
  playBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playBtn.innerHTML = isPlaying ? 
      `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>` : 
      `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9z"/></svg>`;
  });
  
  const slider = document.getElementById('replay-slider');
  
  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    if (isPlaying) {
      time += 0.01;
      skeletonGroup.rotation.y = Math.sin(time) * 0.5; // slight rotation
      
      // Simulate squat motion
      const squatDepth = (Math.sin(time * 2) + 1) * 0.25; 
      skeletonGroup.position.y = -0.5 - squatDepth;
      
      joints['kneeL'].position.z = 0.1 + squatDepth;
      joints['kneeR'].position.z = 0.1 + squatDepth;
      
      // Update slider
      slider.value = (time * 10) % 100;
    }
    
    replayRenderer.render(replayScene, replayCamera);
  }
  
  animate();
  
  // Handle resize
  window.addEventListener('resize', () => {
    if (state.currentScreen !== '#replay-screen') return;
    replayCamera.aspect = container.clientWidth / container.clientHeight;
    replayCamera.updateProjectionMatrix();
    replayRenderer.setSize(container.clientWidth, container.clientHeight);
  });
}

// Boot
window.location.hash = '#welcome-screen';
initParticles();
navigate('#welcome-screen');
