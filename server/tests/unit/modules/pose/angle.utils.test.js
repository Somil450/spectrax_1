const {
  calculateAngle,
  computeAngles,
  getBestSide,
} = require('../../../../src/modules/pose/angle.utils');

function createLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
}

describe('angle.utils', () => {
  it('calculates a right angle', () => {
    const angle = calculateAngle(
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    );

    expect(angle).toBe(90);
  });

  it('selects the body side with higher average visibility', () => {
    const landmarks = createLandmarks();

    [11, 13, 15, 23, 25, 27].forEach((index) => {
      landmarks[index].visibility = 0.9;
    });

    [12, 14, 16, 24, 26, 28].forEach((index) => {
      landmarks[index].visibility = 0.2;
    });

    expect(getBestSide(landmarks)).toBe('left');
  });

  it('computes pose angles from the best visible side', () => {
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

    expect(computeAngles(landmarks)).toEqual({
      knee: 90,
      elbow: 90,
      shoulder: 90,
      bodyLine: 45,
      hipDepth: 100,
    });
  });
});
