# Week 11 Sound Project

- Iteration 1: https://editor.p5js.org/monadlnomad/sketches/wVJAtbxKP
- Iteration 2: https://editor.p5js.org/monadlnomad/sketches/w9vW455uc
- Final (Code): https://editor.p5js.org/monadlnomad/sketches/W7y7amaHg
- Final (Fullscreen): https://editor.p5js.org/monadlnomad/full/W7y7amaHg

## What I Noticed in Class Examples

1. Pure `random()` jumps all over the place, while `noise()` feels smoother like a real tune (Melody Maker).
2. Simple notes sound way richer when they overlap and fade slowly (Harmony Maker).
3. Slow, steady timing changes keep a short piece interesting without extra instruments (Steve Reich - Drumming).

## My 3 Iterations

- **First:** Random pentatonic notes on a steady beat (`randomSeed(0)`). Simple, but gets flat and samey after 10s.
- **Second:** Added a 60-second `millis()` curve with a ~10s calm intro, faster `random()` middle, and ~10s calm outro, plus brief random rests (`noiseSeed(0)`).
- **Final:** Switched to a softer triangle wave, added a low bass that sometimes chimes high in the middle, and added `p5.Reverb`. Sounds warmer and echoing.

## 3 Timed Listens (Final)

- **Flow:** starts slow (1s) -> gets really fast and jumpy (25-35s) -> calms back down and fades out (50-60s).
- **Rhythm:** quick pause (2s) -> speeds up (10s) -> feels off-beat (30s) -> slows back down (50s).
- **Layers:** low bass comes in (2s) -> high chime pops out (20s) -> high notes overlap with reverb (31-41s).

## How I Worked

I did this solo since my partner wasn't in the group anymore, so I kept the code minimal and focused on how `noise()` and `random()` can shape a 60-second arc.

## Week 11 Wiki Link

```markdown
   * [Your Name] -- [Week 11 Blog](https://seathatflowsinourveins.github.io/week11-sound-lab/darkened-brass.html), [Randomness: Code](https://editor.p5js.org/monadlnomad/sketches/W7y7amaHg), [Randomness: Fullscreen](https://editor.p5js.org/monadlnomad/full/W7y7amaHg)
```
