# UI context: Iris Chromatic Editorial Fintech

The approved visual identity. Don't replace it with a generic dashboard template. It should feel premium, minimal, editorial, calm, colorful but restrained, and trustworthy. Avoid excessive gradients, heavy shadows and unnecessary animation.

## Palette (`src/tokens.css`, matches the approved hex values exactly)

| Token | Hex | Role |
|---|---|---|
| `--color-plum` | #302D42 | Brand, primary text, sidebar, primary buttons |
| `--color-pearl` | #FAF9FC | Canvas background |
| `--color-periwinkle` | #E1DDFF | Soft surfaces, active nav, selection |
| `--color-orchid` | #C7A6EC | Secondary accent, spending |
| `--color-coral` | #FFB9B0 | Warm accent, income, danger surfaces |
| `--color-violet` | #7859BE | Interactive, focus, links |

In components, use the **semantic tokens** (`--text-*`, `--surface-*`, `--border-*`, `--chart-*`, `--nav-*`, `--button-*`, `--metric-*`) rather than the raw palette.

## Scales

- Type: `--type-caption` .6875rem · `--type-label` .75rem · `--type-body` .8125rem · `--type-input` .875rem · `--type-section` 1.125rem · `--type-page` and `--type-money` (clamp). Money uses tabular numerals.
- Space: `--space-1` to `--space-7` (.25rem → 3rem).
- Radius: `--radius-field` .8rem · `--radius-card` 1.5rem · `--radius-pill` 999px.
- Shadows: `--shadow-surface/control/primary/*-hover/nav/auth/inset/capsule`.
- Motion: `--motion-fast` 180ms, `--motion-ui` 240ms, `--ease-out`. Hover lift is 2px; press scale is .98; `prefers-reduced-motion` and `forced-colors` are supported.
- Layout: `--sidebar-width` 232px (80px under 1023px), `--content-width` 1360px. Breakpoints: 1199 / 1023 / 767 / 374px. Under 767px the sidebar becomes a floating bottom nav.

## Signature elements

Radial lavender, periwinkle, orchid and coral glow (`body::before`). A 12px micro-dot texture masked away from the center (`body::after`). Glossy primary buttons (#4B465F → Plum gradient with an inset highlight). Pill-shaped frosted secondary buttons. Opaque data cards. Glass only on the banner and the segmented control. Metric cards are tinted Coral (income), Orchid (spending), Periwinkle (cash flow) and white with a Plum dot (budget).

## CSS files

`tokens.css` (tokens only) → `style.css` (base, shell, dashboard, table) → `phase2.css` (auth, forms, upload) → `warranties.css` (warranty components; best token usage, use it as the model).

## Known inconsistencies (fix gradually and keep the look)

1. Headings use the same system sans as the UI (`--font-heading` = `--font-ui`). The "editorial" typography isn't really there yet.
2. About 11 hardcoded radii (5–28px) and raw pixel spacing in style.css and phase2.css; `h3` is a hardcoded 15px.
3. `backdrop-filter` on the opaque sidebar has no visible effect.
4. The month picker and "+ Add transaction" appear in the header on every tab, even where they don't apply.
5. Six-item mobile nav; the compact label "Cover" for Warranties is unclear.
6. Brand copy is inconsistent ("FinFlow AI", "SECURE CLOUD MVP" vs "PRIVATE CLOUD FINANCE"). "CLOUD CONNECTED" is hardcoded.
7. No reusable components (Button, Card, Metric, EmptyState, Field). No modals; uses `window.confirm`.
8. Typo: "Loading your account?" in main.jsx.

## Component notes

- **Password rules hint** (`.password-rules`, phase2.css, sign-up only): subtle surface, field radius, label-size text. Each rule shows ○ → ✓ in `--text-positive` when met, with an sr-only "(met)/(not yet met)" label. The input points to it via `aria-describedby`.

## Accessibility baseline (keep it)

Skip link, `aria-current` nav, labelled fields, `role="status"/"alert"` messages, 44px minimum touch targets, visible 3px focus rings, sr-only labels, and 16px inputs on mobile to prevent zoom.
