import { IExercisePlugin } from './IExercisePlugin';

class ExercisePluginRegistry {
  private plugins = new Map<string, IExercisePlugin>();

  register(plugin: IExercisePlugin): void {
    if (this.plugins.has(plugin.configKey)) {
      console.warn(`Plugin already registered for configKey "${plugin.configKey}". Overwriting.`);
    }
    this.plugins.set(plugin.configKey, plugin);
  }

  get(configKey: string): IExercisePlugin {
    const plugin = this.plugins.get(configKey);
    if (plugin) return plugin;
    const fallback = this.plugins.get('default');
    if (fallback) return fallback;
    throw new Error(`No plugin registered for configKey "${configKey}" and no default plugin found.`);
  }

  getAll(): IExercisePlugin[] {
    return Array.from(this.plugins.values());
  }

  has(configKey: string): boolean {
    return this.plugins.has(configKey);
  }
}

export const exercisePluginRegistry = new ExercisePluginRegistry();
