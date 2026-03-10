---
description: Processing pipeline, maintenance cycle, and session rhythm
type: manual
generated_from: "arscontexta-1.0.0"
---
# Workflows

## The Processing Pipeline

### Phase 1: Documentar (Document)

**Input**: Technical decision, pattern discovery, or architectural choice

**Process**:
1. Create note with propositional title
2. Fill schema fields (modulo, archivos_relacionados, estado)
3. Write content explaining the decision
4. Add to relevant mapa de módulo

**Output**: Complete nota técnica ready for linking

### Phase 2: Enlazar (Connect)

**Input**: New or existing nota técnica

**Process**:
1. Find related notes by topic and module
2. Create wiki links between connected decisions
3. Update mapa de módulo with cross-references
4. Identify orphaned notes that need connections

**Output**: Interconnected knowledge graph

### Phase 3: Actualizar (Update)

**Input**: Notes marked as obsoleta or revisar

**Process**:
1. Verify archivos_relacionados still exist
2. Update content to reflect current code
3. Change estado to activa or keep as obsoleta
4. Propagate changes to related notes

**Output**: Documentation synchronized with code

### Phase 4: Validar (Validate)

**Input**: All notas técnicas

**Process**:
1. Check required schema fields
2. Verify wiki links resolve
3. Validate archivos_relacionados exist
4. Flag orphan notes

**Output**: Health report with issues to fix

## Session Rhythm

### Orient (Start of Session)

Claude reads:
- self/goals.md — what we're working on
- self/metodologia.md — how we work
- notas-tecnicas/ — current documentation state
- ops/reminders.md — pending actions

### Work (During Session)

Document decisions as they arise, connect to existing knowledge, update when code changes.

### Persist (End of Session)

Claude updates:
- self/goals.md with current state
- ops/sessions/ with session log
- ops/observations/ if any friction was noticed

## Maintenance Cycle

### Condition-Based Triggers

Maintenance runs when:
- Notes in estado:obsoleta > 0
- Orphan notes (no incoming links) > 5
- Dangling links detected > 3
- ops/observations/ > 10 items

### Manual Trigger

Run /revisar to force a maintenance review.
