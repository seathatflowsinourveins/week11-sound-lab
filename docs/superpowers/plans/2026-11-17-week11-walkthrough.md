# Week 11 Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Publish a separate Week 11 walkthrough with 80 source lines paired with interactive explanations and sound previews.

**Architecture:** Keep the existing landing page and composer. Serve the study page as static HTML, CSS and JavaScript with pinned explanations, a pure score/navigation model, and source data generated from the actual composer at build time. Use the existing sound transport through an excerpt adapter.

**Tech Stack:** Native HTML, CSS and JavaScript, Web Audio, Node 22+, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-17-week11-walkthrough-design.md`.

## Global constraints

- Keep the landing page, established anchors, browser-local notebook, audio-only performance, p5 2.3.4 and the 60-second exports.
- Limit the landing page edit to a link near Understand. Use the same GitHub Pages origin and project.
- Make desktop panels side by side and mobile panels readable in order. Show exact source and actual score data. Audio starts on request only.

## Review focus

- A missing onset leaves the local time absent, even when a prior note is sounding.
- Invalid URLs or storage values fall back to a valid position. Direct valid URLs win.
- An ending excerpt must reach the final tonic without replaying notes outside its range.
- Rapid navigation or hiding the page stops both running and pending excerpts.
- Tiny screens retain code, explanation and controls without page-level horizontal overflow.

### Task 1. Source, score and route model

Files: `walkthrough-data.js`, `walkthrough-model.js`, `walkthrough.test.cjs`.

- [ ] Verify that line 35, coverage of 27–73, distinct local time records, pause-free skipped steps, rhythm slot 4, the composed ending, and malformed saved links fail against the old release.
- [ ] Implement `inspectSlot(score, slot)`, `makeExcerpt(score, start, end, voice)`, `resolvePosition(hash, saved)` and `moveLine(position, direction)`. Use stable chapter and line identifiers.
- [ ] Verify targeted Node cases including the short final excerpt, note tails at boundaries, and complete source alignment.

### Task 2. Study page

Files: `walkthrough.html`, `walkthrough.css`, `walkthrough.js`.

- [ ] Adapt the approved preview layout and eight lesson chapters from the working mockup. Render actual local time, per-voice onset and segment bars, and the envelope illustration.
- [ ] Connect the same controls to the canonical route and browser-local saved position. Use delegated or stable controls and apply focus when browsing the lines.
- [ ] Wire the existing transport to excerpt objects. Preserve exact p5 bridge bytes. Verify ending, voice isolation, stop, resume and invalid route handling.
- [ ] Add each experiment's practice and p5 sketch link, and hand off to the existing homework notebook.

### Task 3. Package and publish

Files: `index.html`, `scripts/build.cjs`, `build.test.cjs`, `README.md`.

- [ ] Make an allowlisted, cache-versioned route. Generate the public source module byte-for-byte from composer.js and reject a stale authored line mapping.
- [ ] Add the single landing entry link. Verify local links, exact existing exports, manifest and legacy suite.
- [ ] Validate keyboard and narrow-width reading flow and browser audio state. Commit the checked revision, publish on GitHub Pages, and compare hosted assets to the manifest.
