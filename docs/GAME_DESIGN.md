# Merge 3000: Scale Eater — Game Design

## One-line pitch

A one-finger physics merge game where every major combination zooms the world out from a desktop to deep space.

## Core loop

1. Position the next object over the scale chamber.
2. Drop it and combine two matching objects.
3. Build fast merge combos for bonus score.
4. Reach a scale milestone and trigger a dramatic world zoom.
5. Keep the stack below the danger line.
6. Beat the local best score and highest discovered scale.

## Merge chain

Coin → Phone → Toaster → TV → Sofa → Car → House → Tower → City → Moon → Planet → Galaxy

## Prototype success criteria

- The first input is understood without a menu or written tutorial.
- A merge feels satisfying even with simple art.
- The first Scale Break is reachable during a normal first session.
- A player voluntarily restarts after game over.
- Desktop mouse and mobile touch feel equally natural.
- Initial production build remains comfortably below 20 MB.

## Scope boundaries for the first public build

Included:

- Physics drop and merge
- Score, combos and local best score
- Five scale stages
- Synthesized sound and code-generated art
- Responsive desktop/mobile browser layout
- Static web deployment

Deferred until the core loop is validated:

- CrazyGames ads and cloud save SDK
- Daily challenge seed and online leaderboard
- Additional themed merge chains
- Permanent unlock economy
- Native iOS and Android wrappers
- Final generated/illustrated production art

## Monetization direction

Monetization must stay outside active physics play. Candidate placements after Full Launch eligibility:

- Midgame ad only at a natural run boundary
- Rare rewarded continue after game over
- Optional reward multiplier or Gravity Pulse

The game must remain fully playable when ads are disabled or unavailable.

