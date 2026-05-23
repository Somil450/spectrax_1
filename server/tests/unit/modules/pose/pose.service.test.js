const { processPose } = require('../../../../src/modules/pose/pose.service');

function createLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
}

describe('pose.service', () => {
  it('processes a frame and preserves the payload shape', () => {
    const landmarks = createLandmarks();

    [11, 13, 15, 23, 25, 27].forEach((index) => {
      landmarks[index].visibility = 0.95;
    });

    landmarks[23] = { x: 0, y: 0, visibility: 0.95 };
    landmarks[25] = { x: 0, y: 1, visibility: 0.95 };
    landmarks[27] = { x: 1, y: 1, visibility: 0.95 };

    landmarks[11] = { x: 0, y: 0, visibility: 0.95 };
    landmarks[13] = { x: 0, y: 1, visibility: 0.95 };
    landmarks[15] = { x: 1, y: 1, visibility: 0.95 };

    expect(
      processPose({
        landmarks,
        timestamp: 123456,
        exercise: 'squat',
      })
    ).toEqual({
      timestamp: 123456,
      angles: {
        knee: 90,
        elbow: 90,
        shoulder: 90,
        bodyLine: 45,
        hipDepth: 100,
      },
      status: 'yellow',
      feedback: 'Keep your back straight',
      corrections: ['Keep your back straight'],
      exercise: 'squat',
    });
  });

  it('defaults the exercise to squat when omitted', () => {
    expect(
      processPose({
        landmarks: [],
        timestamp: 42,
      }).exercise
    ).toBe('squat');
  });
});
