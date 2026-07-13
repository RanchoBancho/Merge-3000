# Merge 3000: Scale Eater

**Suika physics meets a spectacular endless zoom.** Drop objects into the scale chamber, combine matching objects, and grow from a coin to a galaxy.

## Prototype loop

- Move with mouse or finger and click/tap to drop.
- Merge two identical objects into the next scale.
- Chain quick merges to build a combo.
- Reach scale milestones to zoom from desktop scale into deep space.
- Keep the chamber below the danger line for as long as possible.

## Local development

```bash
npm install
npm run dev
```

Create a production build with `npm run build`. The output in `dist/` is a self-contained HTML5 game suitable for static hosting and later CrazyGames preview uploads.

## Deployment

GitHub Actions builds and publishes the game to GitHub Pages after pushes to `main` or the active prototype branch.
