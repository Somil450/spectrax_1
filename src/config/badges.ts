import { Badge } from '../types/badge';

export const BADGES_CONFIG: Badge[] = [
  {
    id: 'first_workout',
    title: 'First Steps',
    description: 'Completed your first tracked workout',
    icon: 'Footprints',
    criteriaType: 'workouts',
    targetValue: 1,
  },
  {
    id: 'century_squatter',
    title: 'Century Squatter',
    description: 'Performed 100 total reps of squats',
    icon: 'Dumbbell',
    criteriaType: 'reps',
    targetValue: 100,
  },
  {
    id: 'form_master',
    title: 'Form Master',
    description: 'Achieved a rep accuracy score above 90%',
    icon: 'Target',
    criteriaType: 'accuracy',
    targetValue: 90,
  },
  {
    id: 'streak_3',
    title: 'Streak Starter',
    description: 'Maintained a 3-day workout streak',
    icon: 'Flame',
    criteriaType: 'streak',
    targetValue: 3,
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Completed a workout past 10:00 PM',
    icon: 'Moon',
    criteriaType: 'time',
    targetValue: 22,
  }
];
