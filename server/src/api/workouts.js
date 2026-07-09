const express = require('express');
const router = express.Router();
const { saveWorkout, getWorkouts, deleteWorkout } = require('../models/Workout');

// Create Workout
router.post('/', async (req, res, next) => {
  try {
    const { userId, exerciseType, totalReps, accuracyScore, duration, timestamp } = req.body;
    if (!userId || !exerciseType) {
      return res.status(400).json({ error: 'userId and exerciseType are required' });
    }
    const saved = await saveWorkout({
      userId,
      exerciseType,
      totalReps: Number(totalReps || 0),
      accuracyScore: Number(accuracyScore || 0),
      duration: Number(duration || 0),
      timestamp: Number(timestamp || Date.now()),
    });
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// Get Workouts
router.get('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const list = await getWorkouts(userId);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// Delete Workout
router.delete('/:userId/:workoutId', async (req, res, next) => {
  try {
    const { userId, workoutId } = req.params;
    const result = await deleteWorkout(userId, workoutId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
