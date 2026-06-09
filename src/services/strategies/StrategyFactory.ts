import { ExerciseStrategy } from './ExerciseStrategy';
import { DefaultStrategy } from './DefaultStrategy';
import { SquatStrategy } from './SquatStrategy';
import { PushupStrategy } from './PushupStrategy';
import { JumpingJackStrategy } from './JumpingJackStrategy';
import { BicepCurlStrategy } from './BicepCurlStrategy';

export function getStrategy(configKey: string): ExerciseStrategy {
  if (/squat/i.test(configKey)) {
    return new SquatStrategy();
  }
  if (/pushup/i.test(configKey)) {
    return new PushupStrategy();
  }
  if (configKey === 'jumpingJack') {
    return new JumpingJackStrategy();
  }
  if (configKey === 'bicepCurl') {
    return new BicepCurlStrategy();
  }
  // Fallback for plank, lunge, chestPressPunches, etc.
  // We determine the primary joint for some specific ones that are not mapped above,
  // or we could use the fallback with joint 24.
  // Previously in exerciseEngine.ts:
  // plank: 24, lunge: 24, chestPressPunches: 15
  if (configKey === 'chestPressPunches') {
    return new DefaultStrategy(15);
  }
  return new DefaultStrategy(24);
}
