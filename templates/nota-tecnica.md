---
_schema:
  entity_type: "nota-tecnica"
  applies_to: "notas-tecnicas/*.md"
  required:
    - descripción
    - temas
    - modulo
    - estado
  optional:
    - archivos_relacionados
    - decision_alternativa
  enums:
    estado:
      - activa
      - obsoleta
      - revisar
    modulo:
      - Catálogos
      - Auth
      - API
      - Frontend
      - Infra
  constraints:
    descripción:
      max_length: 200
      format: "Contexto de la decisión más allá del título"
    temas:
      format: "Array de wiki links a mapas de módulo"

# Campos de la nota
descripción: ""
temas:
  - "[[mapa-de-modulo]]"
estado: activa
modulo: ""
archivos_relacionados:
  - ""
decision_alternativa: ""
---

# {título proposicional}

## Contexto

{¿Qué problema resolvíamos? ¿Qué contexto llevó a esta decisión?}

## Decisión

{La decisión específica que tomamos}

## Razonamiento

{Por qué elegimos esta opción}

{Si aplica: decision_alternativa}
Consideramos también: {alternativa} pero descartamos porque {razón}.

## Implementación

{Cómo se implementa en el código}

---

Notas relacionadas:
- [[otra-nota]] -- contexto de relación

Temas:
- [[mapa-de-modulo]]
