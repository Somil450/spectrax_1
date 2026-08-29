const express = require('express');
const { createWorkout, listWorkouts, removeWorkout } = require('./workout.controller');

const router = express.Router();

router.post('/', createWorkout);
router.get('/:userId', listWorkouts);
router.delete('/:userId/:workoutId', removeWorkout);

module.exports = router;
