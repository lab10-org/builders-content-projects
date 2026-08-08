# Requirements — Reel Script Generation

**Status:** Draft
**Date:** 2026-08-06
**Author:** Lab10

## Introduction

Lab10 wants to grow on Instagram consistently and with content that adds value to
its followers. Today two things block that: collecting and studying the reels that
are working on reference accounts is slow, manual work, and turning those findings
into a script that sounds like the specific person who will record it costs human
time on every single piece.

This feature closes that loop end to end. Given one reference account (a *North
Star Account*) and one *actor*, the system pulls that account's best-performing
recent reels, listens to them, works out what each one is doing and for whom, and
writes a ready-to-record script for the chosen actor — delivered through a web page
where a Lab10 member starts the run and reads the results.

This is the first vertical slice: one account, three reels, one script each. It
deliberately covers the whole pipeline rather than one part of it in depth.

## Glossary

- **North Star Account** — a public Instagram account Lab10 uses as a content
  reference (e.g. `morningbrew`, `lab10.ai`).
- **Reel** — a short-form Instagram video.
- **Actor** — the Lab10 member who will record the script. Each actor has a written
  profile describing how they speak.
- **Actor profile** — a hand-written file capturing an actor's tone, verbal tics,
  topics they command, preferred format, and a few sample scripts of theirs.
- **Run** — one execution of the pipeline for a given account and actor.
- **Scan window** — how many of the account's most recent reels are inspected
  before ranking (default 20).
- **Analysis** — the LLM-produced summary of a reel: its objective, its highlights,
  and its target audience.
- **Script** — the generated text to be recorded, structured as hook, body, closing.

## Requirements

### Requirement 1 — Discover and rank an account's top reels

**User story:** As a Lab10 member, I want the system to surface the best-performing
recent reels of a reference account, so that I work from what actually resonated
rather than from whatever happened to be posted last.

**Acceptance criteria:**

1.1. WHEN a run starts for a given account THE SYSTEM SHALL retrieve, for that
     account's most recent reels within the scan window, at least the view count,
     like count and comment count of each.
1.2. THE SYSTEM SHALL rank the retrieved reels by view count in descending order
     and select the highest-ranked `top` reels.
1.3. WHEN two reels have the same view count THE SYSTEM SHALL preserve their
     original most-recent-first relative order.
1.4. IF the account has fewer reels than `top` THEN THE SYSTEM SHALL proceed with
     every reel available instead of failing.
1.5. IF the account does not exist, is not reachable, or has no reels THEN THE
     SYSTEM SHALL abort the run and report that no reels were found for that
     account.
1.6. THE SYSTEM SHALL assign each selected reel a rank starting at 1 and carry
     that rank through to the run's output.

### Requirement 2 — Retrieve what was said in a reel

**User story:** As a Lab10 member, I want each selected reel turned into a
transcript, so that the analysis is grounded in what was actually said rather than
in the caption alone.

**Acceptance criteria:**

2.1. WHEN a reel has been selected THE SYSTEM SHALL retrieve its caption, its video
     URL and its duration.
2.2. WHEN a reel's video URL has been retrieved THE SYSTEM SHALL download the video
     file.
2.3. WHEN a reel's video has been downloaded THE SYSTEM SHALL extract its audio
     track as mono 16 kHz MP3.
2.4. WHEN a reel's audio has been extracted THE SYSTEM SHALL transcribe it and
     store the resulting transcript text against that reel.
2.5. WHEN a reel's transcript has been stored THE SYSTEM SHALL delete that reel's
     downloaded video and extracted audio from local storage.
2.6. IF a reel's extracted audio exceeds the transcription provider's 25 MB limit
     THEN THE SYSTEM SHALL mark that reel as failed with reason "audio too large"
     without sending the transcription request.

### Requirement 3 — Analyze a reel

**User story:** As a Lab10 member, I want each reel broken down into what it was
trying to do and who it was for, so that I can judge whether the idea is worth
replicating before reading the script.

**Acceptance criteria:**

3.1. WHEN a reel's transcript is available THE SYSTEM SHALL produce an analysis of
     that reel containing its objective, its highlights, and its target audience,
     using both the reel's transcript and its caption as input.
3.2. THE SYSTEM SHALL reject any analysis response that does not conform to the
     analysis schema.
3.3. IF an analysis response is rejected THEN THE SYSTEM SHALL retry the analysis
     once.
3.4. IF the retried analysis response is also rejected THEN THE SYSTEM SHALL mark
     that reel as failed with reason "invalid analysis response".

### Requirement 4 — Generate a script in the actor's voice

**User story:** As a Lab10 member, I want the script written the way I actually
speak, so that I can record it without rewriting it first.

**Acceptance criteria:**

4.1. WHEN a reel's analysis is available THE SYSTEM SHALL generate a script for
     that reel composed of a hook, a body and a closing.
4.2. THE SYSTEM SHALL include the selected actor's profile in the input used to
     generate the script.
4.3. THE SYSTEM SHALL reject any script response that does not conform to the
     script schema.
4.4. IF a script response is rejected THEN THE SYSTEM SHALL retry the generation
     once, and IF the retry is also rejected THEN THE SYSTEM SHALL mark that reel
     as failed with reason "invalid script response".
4.5. IF the requested actor has no profile THEN THE SYSTEM SHALL abort the run,
     before retrieving any reel, and report that the actor is unknown.
4.6. THE SYSTEM SHALL generate every script in Spanish, regardless of the language
     spoken in the source reel.

### Requirement 5 — Drive a run from the web UI

**User story:** As a Lab10 member who does not live in a terminal, I want to start a
run from a page and watch it progress, so that I can get scripts without running
commands.

**Acceptance criteria:**

5.1. WHEN a user submits an account, an actor and a number of reels THE SYSTEM
     SHALL start a run and return a run identifier without waiting for the run to
     complete.
5.2. THE SYSTEM SHALL offer, as selectable actors, exactly those actors that have a
     profile.
5.3. WHILE a run is in progress THE SYSTEM SHALL report, for each selected reel,
     the pipeline step currently being executed for it.
5.4. WHEN a run has completed THE SYSTEM SHALL present, for each successful reel,
     its rank, its view/like/comment counts, its analysis and its script.
5.5. THE SYSTEM SHALL allow each generated script to be copied in a single action.
5.6. WHEN a reel has failed THE SYSTEM SHALL present that reel's failure reason in
     place of its analysis and script.
5.7. IF the status of an unknown run identifier is requested THEN THE SYSTEM SHALL
     respond with a "run not found" error.

### Requirement 6 — Survive the failure of a single reel

**User story:** As a Lab10 member, I want a run that hits a bad reel to still hand
me the other scripts, so that one broken video does not cost me the whole batch.

**Acceptance criteria:**

6.1. IF processing a reel fails at any step THEN THE SYSTEM SHALL mark only that
     reel as failed, recording the step that failed and the reason, and SHALL
     continue processing the remaining reels.
6.2. WHEN a run completes with at least one failed reel THE SYSTEM SHALL still
     deliver the results of every reel that succeeded.
6.3. THE SYSTEM SHALL process at most 3 reels concurrently.
6.4. WHEN a request to Instagram fails transiently THE SYSTEM SHALL retry it with
     exponential backoff before marking the reel as failed.

### Requirement 7 — Configuration and operational safety

**User story:** As the person operating the system, I want it to fail immediately
and legibly when it is misconfigured, so that I fix the cause instead of debugging
a half-finished run.

**Acceptance criteria:**

7.1. WHEN a run is requested THE SYSTEM SHALL verify that the Instagram session
     cookie and the OpenRouter API key are configured and that `ffmpeg` is
     available, before downloading any content.
7.2. IF any of those preconditions is unmet THEN THE SYSTEM SHALL abort the run and
     report which one is unmet.
7.3. IF Instagram rejects a request with HTTP 403 THEN THE SYSTEM SHALL abort the
     run and report that the Instagram session cookie has expired and must be
     rotated.
7.4. THE SYSTEM SHALL document, in the project README, that the Instagram session
     cookie must come from a disposable Instagram account and never from Lab10's
     own account.

## Out of scope

- **Comment analysis.** The chosen ingestion tool exposes the comment *count* but
  not the comment *text*; analyzing comments needs a second tool and lands in a
  later spec.
- **Multiple accounts per run.** One account per run; batching North Star Accounts
  comes later.
- **Automatically derived actor profiles.** Profiles are hand-written for now, not
  inferred from an actor's previous reels.
- **Persistence and history.** No database of past runs, no deduplication of reels
  already processed, no measurement of which script was actually used.
- **Scheduling.** Runs are started by a person, not on a cron.
- **Authentication.** The page is unauthenticated.
- **Durable run artifacts.** A run's results live only in the workflow engine's own
  record. Nothing is exported to disk or to a separate store.
- **Per-run language selection.** Scripts are always Spanish (criterion 4.6);
  choosing an output language per run is not offered.
