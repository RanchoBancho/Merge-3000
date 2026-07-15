# Merge 3000: Pressure Lane

An HTML5 physics-merge prototype built around aim, space pressure and recovery instead of click spam. Flick objects into a narrowing 2.5D lane, combine matching objects and use merge shockwaves to push the pile away from the exit gate.

## Prototype loop

- Press in the launcher area, drag toward the lane and release to shoot.
- Use the converging side rails for bank shots.
- Merge two matching objects into the next level.
- Every shot adds short-term pressure heat, while occupied area accelerates the physical wall advancing from the back.
- A merge frees area, cools the pressure and knocks both the wall and nearby objects back.
- Rescue objects from the red exit gate before its short grace timer expires.
- Reach higher pressure zones without any permanent world shrinking.

A plain click never fires. The visible next-three queue and paired spawn bag make aiming and planning useful while keeping late levels realistically reachable.

## Local development

```bash
npm install
npm run dev
```

Run the static checks and create a production build with:

```bash
npm run typecheck
npm run build
```

The output in `dist/` is a self-contained HTML5 game suitable for GitHub Pages, a CrazyGames preview upload and mobile browser testing.

## Deployment

GitHub Actions builds and publishes the game to GitHub Pages after pushes to `main` or `agent/scale-eater-prototype`. Both branches currently share the same Pages environment, so the most recent deployment owns the public preview URL.

## Current art scope

The original generated object chain remains intentionally in place as graybox art while the pressure-lane mechanic is evaluated. A consistent dessert evolution and its final discovery animations are the next art pass after the core loop proves fun.
