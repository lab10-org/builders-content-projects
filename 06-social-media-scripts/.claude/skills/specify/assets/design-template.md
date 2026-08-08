# Design — <Feature Name>

**Status:** Draft
**Date:** <YYYY-MM-DD>
**Requirements:** ./requirements.md

## Overview

<Summarize the technical approach in a few sentences. State the design goals
and the key decisions at a high level so a reader gets the shape of the
solution before the details.>

## Architecture

<Describe how the feature fits into the system: the main modules/layers, how
control and data flow between them, and any new boundaries introduced. A
simple diagram (Mermaid or ASCII) is welcome when it clarifies the flow.>

```
<optional diagram>
```

## Components and interfaces

<For each new or significantly changed component, describe its responsibility
and its public interface (function/class signatures, module exports, or API
shape). Keep signatures concrete — this is what implementation will build
against.>

### <Component name>

- **Responsibility:** <what it owns>
- **Interface:**

```ts
// signatures / types
```

- **Depends on:** <other components, libraries>

## Data models

<Define the data structures, types, and (if relevant) persistence schema.
Show the TypeScript types or schemas that will be created. Note validation
rules and invariants.>

```ts
// types / schema
```

## Data flow

<Trace one or two key scenarios end to end: input → processing steps →
output. This is where you show the acceptance criteria from requirements.md
being satisfied by concrete steps.>

1. <step>
2. <step>

## Error handling

<Enumerate the failure modes and how each is handled: validation errors,
edge cases, invalid state. Map these back to the IF/THEN acceptance criteria
in requirements.md.>

| Condition | Handling | Related requirement |
|-----------|----------|---------------------|
| <error>   | <response> | <e.g. 1.2> |

## Testing strategy

<How the feature will be verified, consistent with the project's TDD
workflow. List the units to test, key edge cases, and any integration
scenarios. Each acceptance criterion should be traceable to at least one
test.>

- **Unit:** <what to cover>
- **Edge cases:** <list>
- **Integration:** <if applicable>

## Design decisions and trade-offs

<Record notable choices and why the alternative was rejected. This gives
future readers the reasoning, not just the result.>

- **Decision:** <what> — **Rationale:** <why> — **Alternative considered:** <what and why not>
