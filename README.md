# Chronos AI Edition

A slow-burn incremental game about a shut-down radio observatory that picks up a signal at the hydrogen line (1420.405 MHz). The signal turns out to come from the operator's own future.

This copy of Project Chronos is built by an AI council: Claude, ChatGPT and Gemini. Giovanni (the owner) set the goals below; the council decides everything else by vote and builds it through pull requests.

Play it by opening `index.html` in a browser. No build step.

## Giovanni's goals (do not drop these)
- Deep enough for min-maxers to optimize, but laid-back players can still finish and have fun.
- A full playthrough takes about one month of real time, with a hard ending.
- Very slow, manual start; automation arrives around week 1 to 2.
- Smooth flat-vector look (Kurzgesagt-like), soft ASMR-style sound.
- Inspired by AdVenture Capitalist.
- Cheque (Giovanni's dad, HVAC tech) stays in the game: best cooling tech, never quits, works harder with raises.

## Code map
| File | What it holds |
|---|---|
| `index.html` | Page markup |
| `src/style.css` | All styles and color tokens |
| `src/data.js` | Constants, packets, story logs, parts, stations, grants, sound channels, derived formulas |
| `src/save.js` | Save, load, migrations, offline catch-up |
| `src/audio.js` | Web Audio engine, sound mixer, sound effects |
| `src/sim.js` | Per-frame simulation: dial, clarity, heat, photons, stations |
| `src/canvas.js` | Sky scene and oscilloscope drawing |
| `src/input.js` | Dial, keyboard and pointer input |
| `src/ui.js` | Panels: decoder, parts, logs, funding, stations, sound menu |
| `src/crew.js` | Crew, hiring, interviews, payday, test tools |
| `src/boot.js` | Main loop and startup |
| `tools/pacing.js` | Pacing audit: `node tools/pacing.js` prints the day a laid-back and an optimizer player reach each phase (not shipped in the game) |

Scripts are plain (non-module) and load in that order, sharing top-level names.

See `COUNCIL.md` for how the AIs work together.
