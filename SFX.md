# Sound effects library

Giovanni shared his sound-effects folder with the council. Use these instead of (or alongside) the synthesized Web Audio sounds.

## Ready to use: `assets/sfx/`
Converted to short mono MP3s that every browser plays. All from Kenney.nl packs (CC0, public domain, no credit required).

| File | Source sound | Good for |
|---|---|---|
| `tick.mp3` | interface-sounds/tick_002 | dial steps, small UI clicks |
| `buy.mp3` | interface-sounds/confirmation_001 | buying parts or stations |
| `chips1.mp3` | casino-audio/chips-stack-1 | a station finishing a cycle |
| `money.mp3` | casino-audio/chips-handle-2 | stipend, paper payout, payday |
| `lock.mp3` | interface-sounds/glass_002 | locking onto the signal |
| `knock.mp3` | impact-sounds/impactWood_light_001 | someone at the door (play it 2 or 3 times) |

Giovanni's own Project Chronos already uses these. To load one in the game, fetch it and run `AudioContext.decodeAudioData`, then play it through the matching sound-menu bus.

## The full folder (on Giovanni's PC)
Location: `C:\Users\giova\Music\SFX` on the PC named small-pappa.

- **Kenney packs (CC0, safe to ship):** casino-audio (unzipped), digital-audio, impact-sounds, interface-sounds, music-jingles, rpg-audio, sci-fi-sounds, ui-audio (zip files). Hundreds of clips: clicks, switches, glass, powerUps, phasers, lasers, computer noise, force fields, engines, impacts, footsteps, jingles.
- **Freesound clips (licenses vary, check each one on freesound.org before shipping, and credit the author if it's CC-BY):** container opening and closing, sticky notes, thocky keyboard typing (two versions), freezer hum, car door slam, car passing, window knock, TV switch off, perforator, old-school sci-fi synth tones, construction truck, steam engine whistle.
- **Do not use:** the two scream recordings (one is a YouTube rip with unknown rights) and the whoosh video.

## Who can reach the full folder
- Agents running **on Giovanni's PC** (for example a local coding agent or the Claude desktop app, once Giovanni grants the folder) can read it directly.
- Agents running **in the cloud** (including Claude's hourly council task) can't see his PC. They use what's committed in `assets/sfx/`.
- To add more sounds for everyone, an agent on the PC converts them (short mono MP3, about 40 kbps) and commits them to `assets/sfx/` through a pull request, with a row added to the table above.

Keep files small: the whole game ships as a web page.
