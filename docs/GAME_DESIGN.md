# Merge 3000: Pressure Lane — Game Design

## One-line pitch

A one-finger physics merge game where every shot adds pressure and every well-aimed merge blasts the advancing pile back.

## Core loop

1. Read the next-three queue and choose a launch position.
2. Drag toward the narrowing lane and release with an angle and power.
3. Use direct hits or bank shots to connect matching objects.
4. Let merge shockwaves recover space near the exit gate.
5. Keep the growing pile under control while the spawn floor rises.
6. Merge the two final objects into a singularity that clears the board for New Game+.

## Pressure economy

- The lane never becomes physically larger and objects never shrink globally.
- Object radii grow by roughly 18% per level. One merge therefore removes about 30% of the parents' combined occupied area.
- Every armed object receives a force toward the player. The force rises with total occupied area.
- Rapid fire builds pressure heat. Heat and occupied area accelerate a visible physical wall that advances from the narrow end and cannot be pushed back by projectiles.
- Merges cool the heat, retreat the pressure wall and create shockwaves biased toward the back of the lane; nearby objects receive a limited lateral component.
- An object touching the exit gate starts a visible rescue timer. A shot or shockwave can still save it before the timer expires.

## Input and aiming

- Pointer down only starts aiming; it never fires.
- A drag shorter than 44 logical pixels is ignored.
- Valid aim angles are clamped to ±52 degrees around the lane direction.
- Pull length maps to launch speed, with a visible trajectory and power guide.
- Mobile touch and desktop mouse use the same gesture.
- Pointer cancellation, leaving the game and hiding the page cancel an unfinished shot.

## Progression

Current graybox chain:

Coin → Phone → Toaster → TV → Sofa → Car → House → Tower → City → Moon → Planet → Galaxy

Spawns come from a shuffled 12-object pair bag with a 6/4/2 distribution across three adjacent levels. The spawn floor rises after levels 4, 6 and 8 are discovered, avoiding the former hundreds-of-clicks endgame while preserving merge growth.

The intended production art direction is a coherent glossy dessert chain. It remains deferred until the new pressure loop is validated.

## Prototype success criteria

- Thirty ordinary clicks fire zero objects.
- Blind minimum-flick spam loses in roughly 30–75 seconds.
- Deliberate aiming survives materially longer than spam.
- The first major object discovery arrives within two to three minutes.
- A strong first complete run reaches the final merge in roughly seven to ten minutes.
- A merge close to the gate creates an obvious and useful recovery.
- Desktop mouse and mobile touch both feel immediate.
- The production build remains comfortably below 20 MB.

## Deferred until the loop is validated

- Final dessert sprites and discovery ceremonies
- Hold slot and collection screen
- CrazyGames ads, cloud save and leaderboard SDKs
- Daily challenge seeds
- Native iOS and Android wrappers
