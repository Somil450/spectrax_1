/**
 * ChestPressPunchesPlugin.test.ts
 *
 * Verifies the Resistance Band Chest Press / Punches exercise plugin
 * (issue #527) is registered and resolves through the strategy factory
 * instead of the previous DefaultStrategy special-case fallback.
 */

import { exercisePluginRegistry } from '../ExercisePluginRegistry';
import { ChestPressPunchesPlugin } from '../ChestPressPunchesPlugin';
import { getStrategy } from '../../../services/strategies/StrategyFactory';

describe('ChestPressPunchesPlugin', () => {
  it('registers itself under the chestPressPunches config key', () => {
    expect(exercisePluginRegistry.has('chestPressPunches')).toBe(true);
    expect(exercisePluginRegistry.get('chestPressPunches')).toBeInstanceOf(ChestPressPunchesPlugin);
  });

  it('exposes the correct exercise metadata', () => {
    const plugin = exercisePluginRegistry.get('chestPressPunches');
    expect(plugin.id).toBe('chestPressPunches');
    expect(plugin.configKey).toBe('chestPressPunches');
    expect(plugin.name).toBe('Resistance Band Chest Press / Punches');
    expect(plugin.description.length).toBeGreaterThan(0);
  });

  it('tracks the wrist as the primary joint (matches the former DefaultStrategy(15))', () => {
    expect(exercisePluginRegistry.get('chestPressPunches').getPrimaryJointIndex()).toBe(15);
  });

  it('getStrategy resolves the plugin, not the default fallback', () => {
    expect(getStrategy('chestPressPunches')).toBeInstanceOf(ChestPressPunchesPlugin);
  });

  it('other exercise keys still fall back to the default strategy', () => {
    const strategy = getStrategy('nonexistentExerciseKey');
    expect(strategy).not.toBeInstanceOf(ChestPressPunchesPlugin);
  });
});
