# Week 11 sound walkthrough

November 17, 2026. Design for review.

## Outcome

Keep the Week 11 landing page as the home for the composition, experiments, results and notebook. Add a separate walkthrough linked from the existing study section. A learner can follow one line at a time, see its effect on the score, and compare it by ear without leaving the walkthrough.

The initial route opens the first line of the baseline experiment. A learner should be able to reach the modulo rule, advance through steps 0, 1 and 8, see their actual start times, and tell why a note starts at 0 and 2 seconds. Repeat the same pattern of reading, checking and listening for the other two experiments.

## Approaches

| Approach | Tradeoff |
| --- | --- |
| Put the walkthrough at the center of the existing landing page | Makes study the default and changes the first screen and navigation for listeners. |
| Add a dedicated walkthrough | Gives the code, explanation and sound room to work together. Requires one clear entry link from the home page. **Selected by the user.** |
| Refresh the current six explanation cards | Keeps the work small. Still leaves the learner to infer the variables and the order of execution. |

Use the existing GitHub Pages site and its native browser stack. Add one entry link near Understand. Preserve existing anchors, downloads, audio-only performance, notebook fields and browser-local storage. Publish at the existing site after the implementation checks pass.

## Learner flow

The walkthrough at `walkthrough.html` opens with an experiment selector. Organize every line of the score-building code, alongside the core envelope and playback lines, into eight chapters. These cover time and pitch, creating the score, recording a note, finding its pitch, following the experiment rules, sorting the score, shaping a fade, and scheduling audio. The expanded prototype covers 80 real lines, including the score-building braces. The whole composer source is available in a separate expandable panel for reference.

On desktop, show a scrollable column of selectable, numbered source lines next to the explanation for the active line. Show the exact selected line, a one-sentence reading, a worked illustration with current values, a breakdown of each relevant token or argument, and a note about where the line fits in the program. Previous and Next cross chapter boundaries. A chapter selector lets a learner return directly to a topic. Keep explanatory text close to the active code on phones.

Use dedicated controls for two actions. **Next line** moves to the next explanation. **Try a step** changes the time slot being inspected within that explanation. The code line's position and the time slot are shown with separate labels. Changing the inspected time slot does not move the audio playhead. **Hear a preview** plays a short passage from the selected score with an explicit Stop control. The full 60-second version remains available in the lab.

The score strip uses the generated note events, displayed in rows for melody, bass and pulse. Timing and voice names are readable without color. The explanation gives the active line's condition or calculated value, while the strip shows every event at that slot. For example, rhythm slot 4 skips the melody rule and adds a pulse. Keep the inspected slot when changing lines within the same experiment. Reset it when changing experiments. Use selected examples at the first notes and section boundaries, with adjacent time slots available through labeled controls. On a phone, place the active code line, its explanation and buttons next to each other in the reading order, and collapse the full list behind a labeled control.

Use illustrations that fit the code, with labels and a textual result. For a loop or remainder test, show selectable beats with note markers and the worked condition. For `const time`, put separate calls side by side, including a slot with no call. Use named 15-second segments with actual event counts for section boundaries. Use a gain silhouette with attack and release times for the envelope. The audio-clock explanation shows the score offset and absolute scheduled start side by side. A selected slot also lists the actual note's voice, duration, pitch, gain and waveform from the score generator.

| Experiment | Guided code | Result to check | Preview |
| --- | --- | --- | --- |
| Repeating melody | `STEP`, the `for` header, the experiment condition, remainder test, `melody()`, the `add()` helper and `const time` | Slot 0 adds a note at 0s, slot 1 adds no note, slot 8 adds a note at 2s. `const time` belongs to each call to `add()`. | Opening 8 seconds. Hear the gaps between the notes. |
| Interlocking rhythm | `includes()` and the separate melody, bass and pulse rules | In the first two seconds, melody starts at 0, 0.75 and 1.50 seconds. Bass starts at 0. Pulse starts at 0 and 1. | Opening 8 seconds. Choose full mix, melody, bass or pulse. |
| Developed composition | `Math.floor(step / 60)`, the four section conditions, the pitch offset and the last tonic | 15-second sections contain 8, 34, 61 and 11 note starts. The last tonic runs from 59 to 60 seconds. Some sections start with a short rest because the rhythm uses the global step number. | Choose a named section's first 8 seconds or the ending at 58–60 seconds. Link to the whole piece. |

Preview selection is independent of Next line and Try a step. A preview includes the note onsets within its labeled range and ends at the cutoff. A composition preview that opens at 45 seconds starts with Return's own events. The full playback retains the brief tail from the preceding section.

Expose the full relevant source around the curated steps. Put glossary terms where learners encounter them. When inspecting a skipped step, show that the note helper was never called and no local `time` was created. Any teaching grid that shows a candidate time for a skipped slot labels it as the grid time. Distinguish the quarter-second slot, the note duration and the audio sample rate.

Each experiment ends with an observation prompt and one specific change to try in its downloadable p5 sketch. The page routes learners to the existing notebook for the assignment. It links directly to the existing class spreadsheet and submission instructions from the notebook. Keep actual listening and partner observations in learner control.

Resume the last lesson and line on the same browser. Use a dedicated storage key and linkable lesson and line identifiers. A valid explicit link takes priority over the saved position. Unavailable browser storage still allows navigation and playback. Walkthrough progress never marks a notebook listening run complete.

## Visual direction

Use an annotated score as the main visual. A restrained dark ink surface, quiet timeline rails and one active-line accent connect the walkthrough to the lab. Give the musical data and code room to breathe. Use a readable text face for instruction and a distinct monospace face for code and times. Set colors and type through named CSS tokens. Each marker shows a real slot, voice or section. The larger layout pairs the lines with the current explanation. The compact layout keeps the explanation alongside the active line and puts the full list within reach.

Selected patterns come from the user's starred Diagram Design and UI/UX Pro Max, plus Bret Victor's Learnable Programming and the step controls in Python Tutor. Use Diagram Design's restraint for one relationship at a time. Use UI/UX Pro Max for readable states and touch controls. Use Learnable Programming to connect each instruction with a visible value or sound event. Use the Anthropic frontend design guidance as an independent reference for visual hierarchy, sentence case and purposeful motion. Use W3C reflow, native focus behavior and reduced-motion preferences for acceptance.

Hallmark's current skill limits redesign to an explicit invocation. Its checklist informed the comparison, and this design uses the project's own visual rules. Astryx is a React 19+ beta, while this page adds a small number of native controls. Stitch and Claude Design are alternate design workflows with additional service setup. Retain the existing no-install approach. No external evaluation script or installer is needed. Raw source captures and checkpoints live outside the publication tree.

## Implementation constraints and checks

- Add a static HTML, CSS and JavaScript walkthrough to the build allowlist. Keep the underlying score available via the existing composer API. Derive the displayed note starts and section counts from `makeScore()`. Any teaching evaluation uses constrained data and the actual score, with source excerpts checked against `composer.js`.
- Use the existing transport and audio clock. For a short preview, pass a bounded slice of the real score with note times shifted to the preview start. Generalize transport duration handling only as needed. Verify press Stop, experiment change, blur from page hiding, and resume rejection. Preserve the full-piece behavior and the exact three WAV outputs.
- Keep the pinned p5 2.3.4 bridge. npm latest is 2.4.0 at this checkpoint. The new page uses the existing native audio path. Recheck if the class runtime or bridge changes, or if a compatibility failure requires an update.
- Verify the selected explanation and its state stay synchronized through Previous, Next, direct line selection, jump links and reload. Examples include slots 0, 1, 8, 59 and 60, and an invalid route or saved position.
- Verify all 80 explained lines resolve to the matching source. For line 35, show local `time` as 0s at slot 0, absent at slot 1, and 2s at slot 8 in the opening experiment. For rhythm slot 4, show the melody condition failing and the pulse event in the score. At slot 236 in the composition, show the one-second 262 Hz note ending at 60s.
- Verify playback for all three experiments, the rhythm voice filters and the final tonic preview. Verify leaving or changing the experiment stops the clip. Check note starts, times and per-section counts against the existing score. A browser audio check validates scheduling and output separately from an ear test.
- Verify keyboard navigation, visible focus, touch controls, and no page-level horizontal overflow at 320px and 390px. Check desktop layout at 1280px. Respect reduced motion. Verify that the selected line and preview state make sense in the accessibility tree.
- Re-run all 18 baseline tests. Add checks for the new route, score previews and source alignment. Compare the exact baseline WAV hashes, p5 sketches and notebook compatibility. Verify final GitHub Actions and the served bytes after publication.

The current chat is running GPT-6.2 Sol. Use it for implementation and a separate design review if needed. Preserve the user's selected model, reasoning and permissions. The walkthrough uses deterministic code in the browser and needs no model service.
