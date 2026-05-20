/**
 * Single source of truth for badge icon names → Lucide components.
 * Import this instead of re-declaring iconMap in every component.
 */
import { Footprints, Dumbbell, Target, Flame, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const BADGE_ICON_MAP: Record<string, LucideIcon> = {
  Footprints,
  Dumbbell,
  Target,
  Flame,
  Moon,
};

/** Falls back to Target if icon name is unknown — never returns undefined */
export const getBadgeIcon = (iconName: string): LucideIcon =>
  BADGE_ICON_MAP[iconName] ?? Target;
