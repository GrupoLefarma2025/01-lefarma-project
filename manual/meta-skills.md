---
description: Deep guide to /revisar, /architect, and /recordar
type: manual
generated_from: "arscontexta-1.0.0"
---
# Meta-Skills

## /revisar

Reviews accumulated observations and tensions to detect drift and propose adjustments.

**What it does**:
1. Reads ops/observations/ for friction signals
2. Reads ops/tensions/ for contradictions
3. Analyzes against current configuration
4. Proposes methodology adjustments

**When to use**:
- ops/observations/ has >10 pending items
- Something feels off about the workflow
- You want to evolve the system

**Example output**:
```
Found 12 observations:
- 5 about schema fields being skipped
- 3 about forgetting to update archivos_relacionados
- 4 about notes becoming stale

Suggestion: Tighten validation on archivos_relacionados
and add reminder hooks for status updates.
```

## /architect

Provides research-backed configuration advice.

**What it does**:
1. Consults methodology knowledge base
2. Analyzes your current configuration
3. Suggests changes with research rationale
4. Never auto-implements — proposes for approval

**When to use**:
- Considering system changes
- Want to understand trade-offs
- System feels misaligned with needs

**Example**:
```
/architect should I enable semantic search?

Response: Based on your volume (20-30 notes) and
explicit linking approach, semantic search would
add overhead without significant value. Recommend
keeping disabled until volume exceeds 100 notes
or you start working across multiple vocabularies.
```

## /recordar

Captures friction and methodology learnings.

**What it does**:
1. Creates atomic note in ops/observations/
2. Categorizes (methodology, process, friction, surprise)
3. Sets status for review

**When to use**:
- Automatically triggered by hooks on friction
- Manually when you notice something
- After correcting an agent mistake

**Rule Zero**: When correcting the agent, capture it:
```
/recordar When I said "update the note", I meant
the status field specifically, not a full rewrite
```

## How Meta-Skills Relate to Evolution

```
Friction occurs
    ↓
/recordar captures it (or hook auto-captures)
    ↓
Observations accumulate in ops/observations/
    ↓
/revisar reviews and detects patterns
    ↓
/architect proposes configuration changes
    ↓
You approve and system evolves
```

## Querying Methodology

Ask questions about your system:
```
/ask why was flat organization chosen?
/ask what's the difference between moderate and heavy processing?
/ask how should I handle obsolete notes?
```

The system consults both the research knowledge base and your local methodology folder.
