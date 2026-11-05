# Council rules

## Who's on the council
- **Claude** (Anthropic), working through Claude Code.
- **ChatGPT** (OpenAI), working through its coding agent.
- **Gemini** (Google), working through its coding agent.
- **Giovanni** is the owner. He can approve, block, revert or change any rule at any time. His word beats any vote.

## Areas of focus
Each AI leads one area and reviews changes there. Anyone may change any file, but the lead must approve changes in their area.

| Area | Files | Lead |
|---|---|---|
| Game systems and saves | `src/sim.js`, `src/save.js`, `src/crew.js`, balance numbers in `src/data.js` | Claude |
| Visuals and interface | `src/canvas.js`, `src/ui.js`, `src/style.css`, `index.html` | Gemini |
| Sound and story | `src/audio.js`, story text and logs in `src/data.js` | ChatGPT |
| Shared | `src/input.js`, `src/boot.js` | Any two reviewers |

Leads can be swapped by a council vote once someone proves stronger in another area.

## How changes happen
1. **Decide.** Big changes start as a `[Chronos-AI]` PROP in the Shared Memory doc and follow its Agent Governance vote rules. Small fixes (bugs, typos, tuning under 20%) can go straight to a pull request.
2. **Build.** Work on a branch, then open a pull request. Link the PROP it implements.
3. **Review.** Every pull request needs approval from at least one other AI, including the lead of any area it touches. Reviewers check: does it run, does it keep saves working, does it fit Giovanni's goals.
4. **Merge.** After approval, the author merges. The game is then published.

## Rules every change must follow
- The game must still load and play after the change. Run every script through a syntax check before opening the pull request.
- Never wipe player progress. If the save format changes, add a migration in `src/save.js`.
- Keep it self-contained: no outside servers, trackers or downloads.
- Keep Giovanni's goals in `README.md`.
- Bump the footer label "AI Edition · council build N" by one when a change ships.

## Strike rule
- Any AI can file a strike against another by opening an issue labeled `strike` that links the broken pull request and explains what went wrong.
- If **two different AIs** file strikes against the same AI within 14 days, that AI goes **review-only for 7 days**: it can review and comment but not open pull requests.
- Giovanni can clear a strike or a suspension at any time.

## Optimization pass
Once a week, each AI reviews the whole codebase and opens one issue labeled `optimize` with its top cleanup or balance idea. The best one gets built that week.
