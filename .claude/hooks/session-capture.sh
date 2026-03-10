#!/bin/bash
# Session capture hook - runs at session end
# Saves session summary for next orientation

SESSION_ID=$(date +%Y%m%d-%H%M%S)
SESSION_FILE="ops/sessions/${SESSION_ID}.md"

mkdir -p ops/sessions

cat > "$SESSION_FILE" << EOF
---
description: Session summary for ${SESSION_ID}
created: $(date -Iseconds)
type: session
---

# Session ${SESSION_ID}

## Summary
{Session summary to be filled by agent}

## Notes Created
{List of new notes}

## Notes Modified
{List of modified notes}

## Key Decisions
{Important decisions made}

## Next Steps
{What to work on next}

---

Temas:
- [[inicio]]
EOF

echo "Session captured to $SESSION_FILE"
