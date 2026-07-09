const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const WORKOUTS_FILE = path.join(__dirname, '../../sessions/workouts.json');

const WorkoutSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  exerciseType: { type: String, required: true },
  totalReps: { type: Number, required: true },
  accuracyScore: { type: Number, required: true },
  duration: { type: Number, required: true },
  timestamp: { type: Number, required: true, default: Date.now },
});

let WorkoutModel = null;
try {
  WorkoutModel = mongoose.model('Workout', WorkoutSchema);
} catch (e) {
  // Model already compiled or error
}

// Local File Helper Functions
function readLocalWorkouts() {
  if (!fs.existsSync(WORKOUTS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(WORKOUTS_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Failed to read local workouts file:', err);
    return [];
  }
}

function writeLocalWorkouts(workouts) {
  try {
    const dir = path.dirname(WORKOUTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(WORKOUTS_FILE, JSON.stringify(workouts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write local workouts file:', err);
  }
}

async function saveWorkout(data) {
  const isMongoConnected = mongoose.connection.readyState === 1;
  if (isMongoConnected && WorkoutModel) {
    const w = new WorkoutModel(data);
    return await w.save();
  } else {
    const local = readLocalWorkouts();
    const newWorkout = {
      _id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      ...data,
      timestamp: data.timestamp || Date.now(),
    };
    local.push(newWorkout);
    writeLocalWorkouts(local);
    return newWorkout;
  }
}

async function getWorkouts(userId) {
  const isMongoConnected = mongoose.connection.readyState === 1;
  if (isMongoConnected && WorkoutModel) {
    return await WorkoutModel.find({ userId }).sort({ timestamp: -1 });
  } else {
    const local = readLocalWorkouts();
    return local
      .filter((w) => w.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
}

async function deleteWorkout(userId, workoutId) {
  const isMongoConnected = mongoose.connection.readyState === 1;
  if (isMongoConnected && WorkoutModel) {
    return await WorkoutModel.deleteOne({ _id: workoutId, userId });
  } else {
    const local = readLocalWorkouts();
    const updated = local.filter((w) => !(w._id === workoutId && w.userId === userId));
    writeLocalWorkouts(updated);
    return { deletedCount: local.length - updated.length };
  }
}

module.exports = {
  WorkoutModel,
  saveWorkout,
  getWorkouts,
  deleteWorkout,
};
