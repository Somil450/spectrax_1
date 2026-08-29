const fs = require('fs');

vi.mock(
  'mongoose',
  () => {
    class Schema {}
    const connection = { readyState: 0 };
    return {
      __esModule: true,
      default: { Schema, model: vi.fn(), connection },
      Schema,
      model: vi.fn(),
      connection,
    };
  },
  { virtual: true },
);

const {
  saveWorkout,
  getWorkouts,
  deleteWorkout,
} = require('../../../src/models/Workout');

describe('Workout local file fallback', () => {
  beforeEach(() => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
      JSON.stringify([]),
    );
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue();
    vi.spyOn(fs.promises, 'writeFile').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends a workout to the local file when MongoDB is not connected', async () => {
    const workout = await saveWorkout({
      userId: 'user-1',
      exerciseType: 'squat',
      totalReps: 10,
      accuracyScore: 85,
      duration: 60,
    });

    expect(workout.userId).toBe('user-1');
    expect(workout._id).toBeTruthy();

    const [filePath, content] = fs.promises.writeFile.mock.calls[0];
    expect(filePath).toContain('workouts.json');
    const saved = JSON.parse(content);
    expect(saved).toHaveLength(1);
    expect(saved[0].exerciseType).toBe('squat');
  });

  it('filters workouts by userId and sorts by timestamp descending', async () => {
    fs.promises.readFile.mockResolvedValue(
      JSON.stringify([
        { _id: 'a', userId: 'user-2', timestamp: 100 },
        { _id: 'b', userId: 'user-1', timestamp: 300 },
        { _id: 'c', userId: 'user-1', timestamp: 200 },
      ]),
    );

    const list = await getWorkouts('user-1');

    expect(list.map((w) => w._id)).toEqual(['b', 'c']);
  });

  it('deletes a workout owned by the user and persists the updated list', async () => {
    fs.promises.readFile.mockResolvedValue(
      JSON.stringify([
        { _id: 'a', userId: 'user-1', timestamp: 100 },
        { _id: 'b', userId: 'user-1', timestamp: 200 },
        { _id: 'c', userId: 'user-2', timestamp: 300 },
      ]),
    );

    const result = await deleteWorkout('user-1', 'a');

    expect(result.deletedCount).toBe(1);
    const content = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
    expect(content.map((w) => w._id)).toEqual(['b', 'c']);
  });
});
