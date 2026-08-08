# Requirements — <Feature Name>

**Status:** Draft
**Date:** <YYYY-MM-DD>
**Author:** <name / team>

## Introduction

<One or two paragraphs describing the feature: what problem it solves, who
it's for, and the value it delivers. Keep it business-focused — the "what"
and "why", not the "how". The technical "how" belongs in design.md.>

## Glossary

<Optional. Define domain terms that appear in the requirements so every
acceptance criterion reads unambiguously. Remove this section if not needed.>

- **<Term>** — <definition>

## Requirements

<Each requirement is a user story plus a set of acceptance criteria written
in EARS notation. Number requirements (1, 2, 3…) and their criteria (1.1,
1.2…) so design.md and tasks can trace back to them.>

### Requirement 1 — <short title>

**User story:** As a <role>, I want <capability>, so that <benefit>.

**Acceptance criteria:**

1.1. WHEN <trigger event> THE SYSTEM SHALL <observable behavior>.
1.2. IF <precondition / error condition> THEN THE SYSTEM SHALL <response>.
1.3. WHILE <ongoing state> THE SYSTEM SHALL <behavior held during state>.
1.4. WHERE <optional feature / configuration is present> THE SYSTEM SHALL <behavior>.
1.5. THE SYSTEM SHALL <invariant that always holds>.

### Requirement 2 — <short title>

**User story:** As a <role>, I want <capability>, so that <benefit>.

**Acceptance criteria:**

2.1. WHEN <trigger> THE SYSTEM SHALL <behavior>.
2.2. IF <condition> THEN THE SYSTEM SHALL <behavior>.

<Add as many requirements as the feature needs. Prefer several small,
testable criteria over one broad sentence.>

## Out of scope

<Bullet list of things explicitly NOT part of this feature, so reviewers
know where the boundary is. This prevents scope creep and clarifies what a
later spec will cover.>

- <excluded item>

## Open questions

<Anything unresolved that needs a decision before or during design. Remove
if empty.>

- <question>
