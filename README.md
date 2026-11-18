# Week 11 · A minute, made by rules

[Open the lab](https://seathatflowsinourveins.github.io/week11-sound-lab/) · [Audio-only performance](https://seathatflowsinourveins.github.io/week11-sound-lab/performance.html)

[Open the line-by-line walkthrough](https://seathatflowsinourveins.github.io/week11-sound-lab/walkthrough.html). The separate study page pairs 80 real source lines with interactive score illustrations and short audio excerpts. It remembers the last lesson and line in this browser. A link to a specific line takes priority over that saved position.

Use **Try one change** to compare the original sound with one edited line. Play the same passage twice, inspect the melody starts or waveform, then open **Check what changed**. Both the reader and the guided listen use clips built from the displayed edit to the original composer.

Press **Play excerpt** to follow the **Live note manifest**. The clock, white note outlines, sounding voices and next starts follow the scheduled audio. Expand **Note schedule** for exact start and end times, pitch and waveform. **From code to sound** follows the original mix from slot to rule to stored start to sound. Choose a stage to stop there and read its code. Choose **Full score · 0–60s** to follow the entire piece.

A continuation of the Week 10 sound studio: three playable experiments, an original 60-second algorithmic composition, six plain-language code explanations, measured score/audio results, and a browser-local homework notebook. The class performance has no canvas or animated visualization.

[Design notes and repositories](https://seathatflowsinourveins.github.io/week11-sound-lab/design.html) maps each source to a live illustration and indexes every listening stop and code chapter. Build-time rendering uses the lesson manifest and original score counts.

## Acceptance

All three scores produce exactly 60 seconds of nonempty, unclipped PCM audio. Repeated generation produces the same event list and identical WAV bytes. The baseline and two revisions are playable independently. The final score changes across four 15-second sections and ends by 60 seconds. Stop, navigation and page hiding cancel playback, including a start still awaiting audio readiness. Native browser rendering is checked separately from PCM synthesis. Partner work, class-example observations, three timed listening notes and subjective judgments remain learner entries.

## Start

1. Listen to the final piece, then compare experiments 01, 02 and 03.
2. Choose each code rule under Understand. Read the code and its concrete example.
3. Review the measured results. The optional native browser check renders silently.
4. Complete the notebook with your partner, listening three times from the beginning.
5. Download the project kit or a complete p5 sketch, make your own revisions and save your sketch in your own account.
6. Export the CSV and blog draft, review them, and manually submit to the class destinations.

Notes are saved only in this browser. Export/import the notebook JSON to transfer devices. Import fills empty fields and keeps existing conflicting text. Invalid saved data is preserved; new notes remain in memory until exported. Nothing is uploaded by the notebook or submitted automatically. Google Fonts is an optional external request; system fonts work without it.

## Native development

Node 22 or later; no npm dependencies or install step.

```sh
npm test
npm run build
npm start
```

Open http://127.0.0.1:8761/. The build explicitly allows public assets and excludes private source captures, raw class worksheets and learner progress. It emits WAVs, complete single-file p5 sketches, score JSON, the ZIP, measured results, and a SHA-256 release manifest.

The main teaching site uses native HTML/CSS/JavaScript and Web Audio. Its downloadable p5 bridge pins p5 2.3.4 and calls noCanvas()/noLoop(). It does not require p5.sound. Each note has a short linear envelope; the composition uses fixed arrays and modulo arithmetic, with no random/noise calls. The native browser oscillator and ideal PCM renderer can have different samples, especially for triangle waves. Neither test stubs nor silent offline renders establish audible playback on every device.

See [sources and explicit version holds](SOURCES.md). This is an original teaching example. It supplies a working composition and revision history; it does not claim that a learner has completed collaboration, listening, posting or class submission.
