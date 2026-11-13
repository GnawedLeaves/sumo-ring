# Design system — "Handsome Frank" style

> Curator's atelier with living murals — a warm-paper gallery where illustrated worlds bloom against indigo frames.

Tokens are implemented in `src/app/globals.css` (Tailwind v4 `@theme`).

## Essentials

- **Canvas** cream `#f2ebe6`; cards white `#ffffff`; footer band indigo `#160572`.
- **Text** black `#000000`, secondary `#2c2c2c`, headlines indigo `#160572`.
- **Borders** 1–2px solid black hairlines — the "gallery frame" motif. Use a border, not a shadow, to separate things.
- **No elevation**: no shadows, no gradients, no overlays on imagery.
- **Radius**: pill buttons 30px; cards 10px; project cards / thumbnails / nav 0px.
- **Accents** (links, badges, icons only — never body text): teal `#24e3dc`, acid green `#24e34c`, crimson `#ea0706`, vermillion `#d64e2e`, daffodil `#f9e44d`, highlighter `#ffff00`.
- **Filled buttons** (pill): cobalt `#2544a0`, tangerine `#ff7701` (primary action), plum `#4b0f4d`, rose `#d98199`. No gray buttons.
- **Badges**: `#ffff00` background, black 12px bold text, no radius.

## Type

- **Display serif** (Millik → substitute **Fraunces**): hero/headlines, tight tracking (-0.05em at 88px → -0.018em at 20px), line-height 0.95–1.10.
- **Grotesque** (Klarheit → substitute **Inter**): nav, body, buttons, labels. Body 16px / 1.36.
- Scale: caption 12, body-sm 14, body 16, subheading 22, heading 32, heading-lg 54, display 88.
- Body text never below 14px. Left-align body; centre only display headlines and footer CTAs.

## Layout

- Max width 1200px; section gap 64–80px; card padding 20–24px; element gap 20px.
- 4-column grids on desktop with 20–24px gaps.
- Minimal nav: wordmark top-left, teal circular menu top-right.
- Rhythm: immersive hero → quiet cream section → bold colour block → indigo footer band.

## Components

- Full-bleed hero, editorial section headline (Fraunces 32–42px indigo, centred), portrait cards (square, no border/radius, name below), featured colour cards (flat colour + circular cutout), pill buttons, outlined links (coloured 2px underline), highlighter badges, crimson announcement banner, indigo footer band with tangerine pill.
- **Section tabs** (`.tab` in `globals.css`): text tabs on a 1px hairline row. Selected = bold, brand indigo, with a 2px brand underline; others regular weight in secondary ink. Driven by `aria-current` / `aria-pressed`.
