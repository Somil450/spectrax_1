# 🎯 SpectraX - AI-Powered Fitness Tracker & Pose Visualization

<div align="center">

[![GSSoC 2026](https://img.shields.io/badge/GSSoC-2026-orange?style=for-the-badge)](https://gssoc.girlscript.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

*Advanced AI-driven fitness companion that tracks your workouts, analyzes form, and visualizes progress in 3D. Proudly participating in GirlScript Summer of Code 2026!*

[Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [Usage](#-usage) • [FAQ](FAQ.md) • [Contributing](#-contributing) • [License](#-license)

</div>

---

## 📖 Overview

**SpectraX** is a cutting-edge fitness application that uses **MediaPipe Pose Detection** and **Three.js** to provide real-time workout tracking and form analysis. It doesn't just track your body; it understands your movement, counts reps (like squats), detects mistakes, and provides immersive 3D visual feedback.

The project features a full-stack architecture with a React frontend and an Express/Socket.io backend for real-time data processing and cross-device synchronization.

---

## ✨ Features

- 🏋️ **Intelligent Rep Counting**: Automatically detects and counts exercises like squats, pushups, and more.
- 📐 **Form Analysis**: Real-time feedback on exercise posture and "rep scores" based on accuracy.
- 🎥 **3D Body Mapping**: Immersive 3D skeleton rendering with WebGL/Three.js.
- 🔍 **Auto-Exercise Detection**: Uses AI to detect which exercise you are performing without manual selection.
- 📊 **Workout Summary**: Detailed post-workout analytics including rep streaks, duration, and accuracy.
- 🔄 **Replay System**: Review your performance with our built-in replay feature.
- ⚡ **Real-Time Sync**: Low-latency communication between frontend and backend via WebSockets.

---

## 📸 Screenshots

### Welcome Screen
![Welcome Screen](assets/screenshots/01-welcome.png)
*The SpectraX landing page — initialize your session or view workout history.*

### Exercise Selection — Bodyweight Squats
![Squats](assets/screenshots/02-exercise-selection-squats.png)
*Select from 5 exercises. Live camera preview updates as you choose.*

### Exercise Selection — Bicep Curls
![Bicep Curls](assets/screenshots/04-exercise-selection-bicep-curls.png)
*Real-time pose detection ready for bicep curl tracking.*

### Exercise Selection — Plank
![Plank](assets/screenshots/03-exercise-selection-plank.png)
*Plank hold detection with live camera feed.*

### Exercise Selection — Push-Ups
![Push-Ups](assets/screenshots/05-exercise-selection-pushup.png)
*Push-up rep counting with form analysis.*

### Session History
![Session History](assets/screenshots/06-exercise-session-history.png)
*Review past workout sessions and track your progress over time.*

### Frontend
- **Framework**: [React 18](https://reactjs.org/)
- **State Management**: React Hooks & Context
- **3D Graphics**: [Three.js](https://threejs.org/)
- **AI/ML**: [MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose), Transformers.js
- **Icons**: [Lucide React](https://lucide.dev/)

### Backend
- **Server**: [Express.js](https://expressjs.com/)
- **Real-Time**: [Socket.io](https://socket.io/)
- **Language**: Node.js (CommonJS)

---

## 🛠️ Tech Stack

| Category | Technologies |
|----------|--------------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express.js, Socket.io |
| AI/ML | MediaPipe Pose, Transformers.js |
| 3D Rendering | Three.js, WebGL |
| State Management | React Context API |
| Icons | Lucide React |

---

## 🧠 How SpectraX Works

SpectraX uses computer vision and real-time pose estimation to analyze body movement during workouts.

### Workflow

1. 📷 Camera frames are captured in real time.
2. 🦴 MediaPipe Pose extracts 33 body landmarks.
3. 📐 Joint angles are calculated using landmark coordinates.
4. 🤖 AI logic detects the current exercise automatically.
5. 🔢 Rep counting algorithms track movement cycles.
6. 🎯 Form analysis evaluates posture accuracy.
7. 🎥 Three.js renders a live 3D body skeleton.
8. ⚡ Socket.io synchronizes workout data in real time.

This pipeline allows SpectraX to deliver immersive AI-powered fitness tracking directly in the browser.

---

## 📁 Project Structure

```bash
spectrax_1/
│── public/                 # Static assets
│── src/
│   ├── components/         # Reusable React components
│   ├── pages/              # Application pages
│   ├── hooks/              # Custom React hooks
│   ├── context/            # Global state/context
│   ├── utils/              # Helper functions
│   ├── services/           # API and socket services
│   └── styles/             # Styling files
│
│── server/                 # Express + Socket.io backend
│── assets/                 # Screenshots and media
│── README.md
│── package.json
```


## 🚀 Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Steps
1. **Clone the Repo**
   ```bash
   git clone https://github.com/Somil450/spectrax_1.git
   cd spectrax_1
   ```

2. **Setup Frontend**
   ```bash
   npm install
   ```

3. **Setup Backend**
   ```bash
   cd server
   npm install
   cd ..
   ```

---

## 🔐 Environment Variables

To run SpectraX locally, create environment variable files for both the frontend and backend.

### Frontend Environment Variables

Create a `.env` file in the root directory:

```env
VITE_BACKEND_URL=http://localhost:3001
```

### Backend Environment Variables

Create a `.env` file inside the `server/` directory:

```env
PORT=3001
```
> Never commit `.env` files to version control.

---

## 💻 Usage

1. **Start the Backend**
   ```bash
   cd server
   npm run dev
   ```
   *Server runs on `http://localhost:3001`*

2. **Start the Frontend** (In a new terminal)
   ```bash
   npm run dev
   ```
   *App runs on `http://localhost:5173`*

3. **Workout Flow**
   - **Welcome**: Choose your exercise or let SpectraX auto-detect.
   - **Calibration**: Align yourself with the camera for optimal tracking.
   - **Workout**: Start exercising! Watch your reps count up in real-time.
   - **Summary**: Review your stats and see where you can improve.

---

## 🏃 Supported Exercises

Currently supported exercises:

- ✅ Bodyweight Squats
- ✅ Push-Ups
- ✅ Plank
- ✅ Bicep Curls

### 🚧 Planned Exercises

- Lunges
- Jumping Jacks
- Shoulder Press
- Mountain Climbers
- Burpees

---

## 📊 Performance Metrics

| Metric | Approximate Value |
|--------|------------------|
| Pose Detection FPS | ~30 FPS |
| Rep Counting Accuracy | ~94% |
| Detection Latency | <100ms |
| Supported Resolution | 720p / 1080p |
| Pose Landmarks | 33 Keypoints |

> Performance may vary depending on device hardware and lighting conditions.

---

## 📱 Device Compatibility

| Platform | Support |
|----------|---------|
| Chrome (Desktop) | ✅ Supported |
| Edge | ✅ Supported |
| Firefox | ✅ Supported |
| Android Chrome | ✅ Supported |
| Safari | ⚠️ Experimental |

For best performance, use the latest version of Chrome with a stable internet connection.

---

## 🧪 Testing Instructions

### Run Lint Checks

```bash
npm run lint
```
---

## 🗺️ Roadmap

Planned future improvements for SpectraX:

- [ ] AI-based calorie estimation
- [ ] Multi-person pose tracking
- [ ] Voice-guided workout assistant
- [ ] Mobile application support
- [ ] Cloud workout history sync
- [ ] Workout recommendation engine
- [ ] User authentication system
- [ ] Advanced analytics dashboard

---

## 🤝 Contributing

SpectraX is a **GSSoC 2026** project and we welcome contributors of all levels!

1. Read our **[CONTRIBUTING.md](CONTRIBUTING.md)** for the rules of engagement.
2. Check the **[Issues](https://github.com/Somil450/spectrax_1/issues)** for `level1`, `level2`, or `level3` tasks.
3. Use the **[GSSoC Task Request Template](.github/ISSUE_TEMPLATE/gssoc_task.yml)** when proposing changes.

---

## 🔒 Privacy & Security

- Camera data is processed locally in the browser.
- SpectraX does not store raw video footage.
- Only workout analytics and session summaries may be saved.
- No personal biometric data is shared with third parties.

---

## 🌟 Why SpectraX?

SpectraX combines AI pose estimation, biomechanical analysis,
and immersive 3D rendering to create a next-generation browser-based
fitness experience.

Unlike traditional fitness trackers, SpectraX provides:
- real-time posture correction
- intelligent rep tracking
- exercise auto-detection
- interactive 3D body visualization

all directly from a webcam without external hardware.

---

## 📄 License

This project is licensed under the **MIT License**.

---

<div align="center">

**SpectraX** - The Future of AI Fitness.
Made with ❤️ by [Somil Jain](https://github.com/Somil450) and our amazing contributors.

</div>
