# SpectraX Design System

## Tokens

All design tokens are defined as CSS custom properties in `src/index.css` and scoped by theme via the `data-theme` and `data-theme-style` attributes on `<html>`.

### Theme Toggle

| Theme        | `data-theme`     | `data-theme-style` | Description                |
|--------------|------------------|---------------------|----------------------------|
| Cyber-Dark   | `dark`           | `cyber-dark`        | Default, neon-on-navy      |
| Light        | `light`          | `light`             | Professional slate tones   |
| Retro        | `dark`           | `retro`             | Phosphor-CRT amber/green   |

Managed by `src/context/ThemeContext.tsx`; persisted in `localStorage` under key `spectrax-theme`.

### Typography

| Token               | Value              | Usage                        |
|---------------------|--------------------|------------------------------|
| `--font-heading`    | `'Orbitron', sans-serif` | Headings, nav, badges   |
| `--font-body`       | `'Inter', sans-serif`    | Paragraphs, labels       |

Heading sizes use `clamp()` for responsive scaling:
- Wordmark: `clamp(2rem, 10vw, 5.5rem)`
- Section title: `clamp(1.6rem, 5vw, 2.8rem)`
- Card title: `1rem`

Body sizes: buttons `0.9rem`, subtitle `0.85rem`, labels `0.72rem`, capsules `0.65rem`.  
All text is `text-transform: uppercase` by default (futuristic aesthetic).

### Border Radius

| Token         | Value |
|---------------|-------|
| `--radius-sm` | 8px   |
| `--radius-md` | 14px  |
| `--radius-lg` | 22px  |
| `--radius-xl` | 32px  |
| Pills         | 999px |

### Transitions

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)
```

Applied globally to `background`, `color`, `border-color`, and `box-shadow` with a 0.35 s duration.

---

## Color Palette

### Cyber-Dark (default)

| Role               | Token              | Hex       |
|--------------------|--------------------|-----------|
| Background primary | `--bg-primary`     | `#0a0a1a` |
| Background secondary | `--bg-secondary` | `#0d1127` |
| Background tertiary | `--bg-tertiary`  | `#111633` |
| Primary accent     | `--neon-cyan`      | `#00f0ff` |
| Secondary accent   | `--neon-purple`    | `#a855f7` |
| Success            | `--neon-green`     | `#00ff88` |
| Warning            | `--neon-yellow`    | `#ffd600` |
| Error              | `--neon-red`       | `#ff3b5c` |
| Text primary       | `--text-primary`   | `#ffffff` |
| Text secondary     | `--text-secondary` | `rgba(232, 236, 244, 0.85)` |

### Light

| Role               | Token              | Hex       |
|--------------------|--------------------|-----------|
| Background primary | `--bg-primary`     | `#f4f7fb` |
| Background secondary | `--bg-secondary` | `#ffffff` |
| Primary accent     | `--neon-cyan`      | `#2563eb` |
| Text primary       | `--text-primary`   | `#0f172a` |

### Retro

| Role               | Token              | Hex       |
|--------------------|--------------------|-----------|
| Background primary | `--bg-primary`     | `#120e0a` |
| Primary accent     | `--neon-cyan`      | `#33ff33` (phosphor green) |
| Secondary accent   | `--neon-purple`    | `#ffb000` (warm amber) |
| Text primary       | `--text-primary`   | `#ffb000` |

---

## Glassmorphism

A core visual motif. The `.glass` class:

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--glass-shadow);
}
```

Variant: `.glass-glow` adds an extra neon box-shadow.

---

## Component Tokens

### Buttons

| Class         | Style                                              | Usage             |
|---------------|----------------------------------------------------|-------------------|
| `.btn-neon`   | `bg: var(--neon-cyan)`, pill, glow shadow          | Primary CTA       |
| `.btn-neon.purple` | `bg: var(--neon-purple)`                     | Secondary CTA     |
| `.btn-outline` | `bg: transparent`, `border: 1.5px solid`          | Ghost/outline     |
| `.btn-primary` | Gradient (`--neon-cyan` -> `--neon-purple`)        | Start workout     |

All buttons: `--font-heading`, `uppercase`, `letter-spacing: 2px`, `font-weight: 700`, padding `14px 36px`.

### Cards

- Glass card (`.glass`): translucent backdrop, subtle neon border, dark shadow
- Skeleton cards: `skeleton-pulse` animation
- Panels: `clamp(24px, 4vw, 40px)` inner padding

### NavBar

Sticky top, glass background, `justify-content: space-evenly`, icon + label per nav item.

---

## Animations

| Name            | Keyframes                                    | Used On                   |
|-----------------|----------------------------------------------|---------------------------|
| `fadeInUp`      | `opacity: 0→1`, `translateY(20px→0)`         | Screen entries            |
| `pulse`         | `scale(1 → 0.8 → 1)`                         | Indicators                |
| `spin`          | `rotate(0 → 360deg)`                         | Spinners                  |
| `skeleton-pulse`| `opacity: 0.2 ↔ 0.08`                       | Loading skeletons         |
| `titlePulse`    | text-shadow oscillation                      | Hero title                |

Delay classes: `.animate-delay-1` through `.animate-delay-5` (0.1 s increments each).

---

## Icons

[Lucide React](https://lucide.dev/icons/) v0.344+ via the `lucide-react` package. Import by name:

```tsx
import { Dumbbell, Sparkles, Target } from "lucide-react";
```

---

## CSS File Map

| File                                          | Scope                      |
|-----------------------------------------------|----------------------------|
| `src/index.css`                               | Global reset + all tokens  |
| `src/style.css`                               | Legacy global styles       |
| `src/styles/app.css`                          | App-level overrides        |
| `src/styles/WelcomeScreen.css`                | Welcome page               |
| `src/styles/NavBar.css`                       | Navigation bar             |
| `src/styles/auth.css`                         | Login / signup / profile   |
| `src/styles/FitnessCalculator.css`            | Fitness calculator page    |
| `src/components/*/*.css`                      | Co-located component styles|

---

## Adding a New Component

1. Choose or create a co-located CSS file.
2. Reference tokens via `var(--token-name)`.
3. Use the `.glass` class for containers.
4. Apply `.animate-in` with an optional `.animate-delay-N` for entry.
5. Use `--font-heading` for titles, `--font-body` for body text.
6. Wrap in `<PageErrorBoundary>` if async.
7. Test in all three themes.
