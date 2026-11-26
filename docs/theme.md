# The look of the front ends

Both React apps, `clients/admin` and `clients/dashboard`, start in the Trislab theme of `@trislabcompany/framework-ui`: dark slate, the orange accent, Inter and a radius of `0.75rem`, in light and dark. The theme is a set of CSS variables with the shadcn names (`--background`, `--foreground`, `--primary`, `--border`, `--ring`, `--radius`, …), listed in the package's README under "Theme". Tailwind's utilities read them (`bg-primary`, `text-muted-foreground`, `border-destructive/30`).

## The files of each app

They are loaded in this order by `src/styles/globals.css`:

| File | What it holds | Ownership |
| --- | --- | --- |
| `@trislabcompany/framework-ui/theme.css`, `fonts.css` | The Trislab theme and Inter, self-hosted | the framework's package |
| `src/styles/starter/theme.css` | The starter's additions on top of it: the shadows, the warm second accent (`--saffron`), the chart grid, two hover surfaces, and the accent palettes a user can choose. Derived from the theme's variables where it can be | `shared`: a template update merges its changes |
| `src/styles/theme.css` | The product's look: the variables it overrides, under `:root` (light) and `.dark` (dark) | `product`: a template update never changes it |
| `src/styles/globals.css` | Tailwind, the `@theme inline` block that turns the variables into utilities, and the layout. No colour | `shared` |

## Restyling a product

Change `src/styles/theme.css` of each app, and nothing else:

```css
:root { --primary: #2563eb; --primary-foreground: #ffffff; --primary-hover: #1d4ed8; --primary-text: #1d4ed8; --ring: #1d4ed8; }
.dark { --primary: #3b82f6; --primary-foreground: #0f172a; --primary-hover: #60a5fa; --primary-text: #60a5fa; --ring: #60a5fa; }
```

- Keep the contrast of WCAG 2 AA: every `--*-foreground` needs 4.5:1 on its colour, and `--primary-text` and `--muted-foreground` need it on `--background`, `--card` and `--muted`.
- For another font, set `--font-sans` in `theme.css` and remove the `fonts.css` import from `globals.css`.

## On top of the product's look

- **A user's accent** (dashboard, Settings → Appearance): "Default" is the product's own colour. A palette (rose, indigo, violet, sky, emerald, amber) or a custom hue puts the class `accent-<id>` on `<html>`, and `starter/theme.css` replaces `--primary`, `--ring` and the first chart colour below `<body>`. The choice is kept in the browser (`tl.accent`).
- **A user's font**: Inter by default; the others load from Google Fonts only when the user picks one.
- **A tenant's branding** (`/api/v1/tenants/theme`): the palette and brand assets a tenant admin (dashboard, Settings → Branding) or an operator (admin, a tenant's page) edits. It is stored and shown as a preview; the palette's default values in `src/api/tenants.ts` are the API's, kept as data.

## The checks

`bash scripts/test-clients.sh` (which `ci / ci` runs for an app a change affects) runs, for each app:

- `framework-ui-check-colors src` fails on a colour written into code: a hex value, a colour function (`rgb(`, `oklch(`, …) or Tailwind's palette (`bg-red-500`, `text-white`), in CSS or a script. A `theme.css` isn't checked. A colour that must stay fixed, such as a palette's swatch or data from the API, gets the comment `raw-color-allowed: <why>` on its line. A colour with transparency is the variable with an opacity, `bg-primary/10` in a class or `color-mix(in oklab, var(--primary) 10%, transparent)` in CSS.
- The Playwright test `tests/settings/appearance.spec.ts` checks that the dashboard starts in the Trislab theme and that a chosen accent replaces its primary colour.
