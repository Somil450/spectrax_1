const { generateFeedback } = require('../../../../src/modules/pose/feedback.service');

describe('feedback.service', () => {
  it('returns acquisition feedback when no angles are available', () => {
    expect(generateFeedback({}, 'squat')).toEqual({
      status: 'yellow',
      message: 'Acquiring pose...',
      corrections: [],
    });
  });

  it('returns green feedback for a clean squat frame', () => {
    expect(
      generateFeedback(
        { knee: 120, elbow: 90, shoulder: 10, bodyLine: 170, hipDepth: 40 },
        'squat'
      )
    ).toEqual({
      status: 'green',
      message: 'Good form ✅',
      corrections: [],
    });
  });

  it('returns prioritized corrections for a poor pushup frame', () => {
    expect(
      generateFeedback(
        { knee: 120, elbow: 170, shoulder: 40, bodyLine: 140, hipDepth: 30 },
        'pushup'
      )
    ).toEqual({
      status: 'red',
      message: 'Lower your chest to the ground',
      corrections: [
        'Lower your chest to the ground',
        'Keep your body in a straight line',
      ],
    });
  });
});
