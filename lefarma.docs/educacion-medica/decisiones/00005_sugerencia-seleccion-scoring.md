---
fecha_creacion: 2026-08-28 12:00
fecha_modificacion: 2026-09-09 12:00
resumen: Motor de priorización explicable para sugerir hospitales en la selección mensual. V1 implementa ranking mediante scoring configurable 0–100 con factores normalizados, agrupabilidad geográfica, calidad de datos, configuraciones versionadas y trazabilidad completa de cada ejecución. La estadística y los modelos predictivos quedan explícitamente fuera del alcance de este ADR, pero los datos necesarios para evaluarlos en el futuro se conservan desde V1.
---

# 00005 — Sugerencia de selección mensual con scoring explicable y trazable

## Status

Proposed

> Complementa al ADR-00004.
>
> ADR-00004 define qué ocurre **después de seleccionar los hospitales**: zonificación GPS, reparto zona → equipo y planificación de rutas.
>
> Este ADR define la etapa anterior: **cómo asistir al Gerente de Ventas para decidir qué hospitales conviene considerar dentro de un universo de miles de unidades médicas**.
>
> El clustering y la planificación de rutas del ADR-00004 no cambian.

> **Revisión 2026-09-09** — El ranking se **limita al Top N**: `ranking_ejecucion_hospitales` solo persiste los N mejores (antes: todos los candidatos evaluados); `cantidad_candidatos` conserva el tamaño del universo evaluado. El default de pre-marcado es **"lo que falta"**: los primeros `max(0, N − ya agregados)` quedan pre-seleccionados al abrir el modal. Consecuencias: `NoSugeridoSeleccionado` queda sin uso (decisión 23) y ya no es posible reconstruir qué ocupó las posiciones > N (tradeoff aceptado para controlar el volumen por ejecución). El CHECK de `decision` en BD conserva el valor sin migración. Detalles: decisiones 14 y 22, Fase 1, Fase 2 y Fase 3.

---

## Índice

- [[#Status|Status]]
- [[#Contexto|Contexto]]
- [[#Decisión|Decisión]]
- [[#Principios de diseño|Principios de diseño]]
- [[#Motor de scoring V1|Motor de scoring V1]]
- [[#Factores V1|Factores V1]]
- [[#Trazabilidad del ranking|Trazabilidad del ranking]]
- [[#Configuración y versionado|Configuración y versionado]]
- [[#Fases|Fases]]
  - [[#Fase 0 — Decisiones de diseño|Fase 0 — Decisiones de diseño]]
  - [[#Fase 1 — Base de datos|Fase 1 — Base de datos]]
  - [[#Fase 2 — Backend|Fase 2 — Backend]]
  - [[#Fase 3 — Frontend|Fase 3 — Frontend]]
- [[#Evolución futura — fuera del alcance|Evolución futura — fuera del alcance]]
- [[#Validación contra la operación documentada|Validación contra la operación documentada]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

---

# Contexto

La selección mensual parte de un catálogo aproximado de **4,856 hospitales**, mientras que el Gerente de Ventas necesita seleccionar del orden de decenas o más de cien hospitales para el siguiente periodo.

La selección manual hospital por hospital no escala.

La operación documentada establece criterios cualitativos:

- priorizar hospitales por **valor de mercado**;
- considerar **ubicación geográfica**;
- preferir hospitales donde no se hayan realizado talleres recientemente;
- agrupar geográficamente para facilitar viajes posteriores.

Actualmente estos criterios dependen de revisión manual.

El sistema debe convertirlos en una **propuesta ordenada, explicable y editable**, manteniendo la decisión final en manos del usuario.

La regla general sigue siendo:

> **El sistema propone; el humano dispone.**

---

# Decisión

Se implementará un **motor de priorización de hospitales** basado en un **score configurable de 0 a 100**.

El score V1:

- ordena los hospitales candidatos;
- muestra por qué cada hospital obtuvo determinada prioridad;
- utiliza únicamente datos disponibles al momento de la selección;
- no selecciona hospitales automáticamente;
- no representa probabilidad estadística;
- no utiliza modelos predictivos;
- no modifica pesos automáticamente.

El flujo será:

```text
~4,856 hospitales
        │
        ▼
┌──────────────────────┐
│ Filtros elegibilidad │
└──────────────────────┘
        │
        ▼
Hospitales candidatos
        │
        ▼
┌──────────────────────┐
│ Factores de scoring  │
└──────────────────────┘
        │
        ▼
Normalización 0–100
        │
        ▼
Calidad de datos
        │
        ▼
Pesos efectivos
        │
        ▼
Score ponderado
        │
        ▼
Ranking 1..N
        │
        ▼
┌───────────────────────────┐
│ Selección asistida        │
│                           │
│ ✓ aceptar                 │
│ ✗ rechazar                │
│ + agregar manualmente     │
└───────────────────────────┘
        │
        ▼
Selección mensual
        │
        ▼
Zonificación GPS
        │
        ▼
Reparto → rutas
```

Cada ejecución del ranking queda persistida para poder reconstruir posteriormente:

- qué hospitales participaron;
- qué valores tenían sus factores;
- qué configuración se utilizó;
- qué score obtuvo cada hospital;
- qué posición ocupó;
- cuáles formaban parte del Top N sugerido;
- cuáles aceptó o rechazó el usuario;
- cuáles se incorporaron manualmente.

---

# Principios de diseño

## 1. Score de prioridad, no probabilidad

Un valor:

```text
87 / 100
```

significa:

> Este hospital resultó más prioritario que otros candidatos bajo la configuración utilizada en esta ejecución.

No significa:

```text
87 % de probabilidad de éxito
```

V1 no utilizará lenguaje probabilístico.

---

## 2. Ranking y scoring son conceptos diferentes

El **ranking** es el resultado visible:

```text
#1 Hospital A
#2 Hospital B
#3 Hospital C
...
```

El **scoring** es el método V1 utilizado para producir ese ranking:

```text
factores
   ↓
normalización
   ↓
pesos
   ↓
score
   ↓
orden
```

El concepto de ranking podrá mantenerse incluso si en el futuro cambia el método que calcula la prioridad.

---

## 3. Filtros ≠ scoring ≠ restricciones

### Filtros

Determinan si un hospital puede participar en el ranking.

Ejemplos:

- corresponde a la gerencia de la selección;
- está activo;
- no está ya agregado a la selección;
- cumple los requisitos mínimos definidos por el proceso.

Un filtro responde:

> ¿Este hospital puede competir?

No aporta ni resta puntos.

Los hospitales **sin coordenadas NO se excluyen**: participan en el ranking con el factor de agrupabilidad como dato no disponible (ver [[#12. Hospitales sin clasificación metropolitana o sin coordenadas|sección 12]]).

---

### Scoring

Ordena únicamente los candidatos elegibles.

Responde:

> Entre los hospitales que sí pueden participar, ¿cuáles conviene revisar primero?

---

### Restricciones posteriores

No forman parte del score.

Ejemplos:

- meta IMSS;
- meta descentralizados;
- capacidad de equipos;
- mínimo de hospitales por viaje foráneo;
- límite de viajes;
- zonificación GPS;
- planificación diaria y semanal.

Estas reglas se validan en las etapas correspondientes del ADR-00004.

---

# Motor de scoring V1

## 4. Todo factor produce un valor 0–100

Cada factor debe terminar generando:

```text
score_factor ∈ [0,100]
```

La estrategia utilizada puede variar.

Ejemplos:

```text
anestesias
→ percentil

quirófanos
→ percentil

recencia
→ función por tramos

agrupabilidad
→ función operacional
```

El motor de scoring no exige que todos los factores utilicen el mismo método.

La estrategia de cada factor se decide en **código** (el motor V1 no cambia de estrategia por configuración; la columna `tipo_normalizacion` es documental — ver [[#Fase 1 — Base de datos|Fase 1]]).

---

# Factores V1

## 5. Factores iniciales

Se utilizarán únicamente datos existentes y confiables.

| Grupo | Factor | Peso inicial | Normalización | Fuente |
|---|---|---:|---|---|
| Potencial hospitalario | `anestesias_totales` | 40 % | Percentil | `hospital_extension.anestesias_totales` (DECIMAL(18,2) NULL) |
| Potencial hospitalario | `numero_quirofanos` | 15 % | Percentil | `hospital_extension.numero_quirofanos` (INT NULL) |
| Cobertura | `recencia_seleccion` | 25 % | Función por tramos | historial de selecciones mensuales |
| Eficiencia geográfica | `agrupabilidad_geografica` | 20 % | Función geográfica | latitud/longitud + clasificación local/foránea |

Nota sobre la fuente: `hospital_extension` es una tabla **1:1** con el hospital (`UNIQUE (id_hospital)`; la columna `fecha` es el año de la base FOR-002, no un versionado). No hay que resolver "fila vigente": cada hospital tiene una sola extensión.

Los pesos son una **configuración inicial de negocio**.

No se presentan como resultado estadístico.

---

# Potencial hospitalario

## 6. Anestesias totales

`anestesias_totales` se utiliza como proxy disponible del potencial de mercado.

Los valores se normalizan mediante percentil dentro del conjunto candidato.

Ejemplo:

```text
Hospital       Anestesias      Score factor

A                  50              18
B                 180              43
C                 600              74
D                2200              97
```

El objetivo es:

- transformar valores a una escala común 0–100;
- evitar que los valores absolutos dominen la fórmula;
- reducir el efecto de hospitales extremadamente grandes.

Nota: `anestesias_totales` se recalcula cuando cambian los parámetros del año (`POST /parametros-anestesias/{anio}/recalcular`). Esto no compromete la reproducibilidad histórica: cada ejecución congela el valor crudo en `factores_json`.

---

## 7. Número de quirófanos

`numero_quirofanos` también se normaliza mediante percentil.

Representa capacidad quirúrgica estructural.

En V1 se mantiene como factor independiente de anestesias porque ambos criterios representan información operacionalmente entendible.

Si en el futuro se determina que ambos factores resultan redundantes, esa evaluación corresponderá a un ADR posterior.

---

# Cobertura

## 8. Recencia de selección

Mientras no exista histórico confiable de talleres realizados, se utilizará como proxy:

> tiempo desde la última aparición del hospital en una selección mensual anterior de la misma gerencia.

Escala inicial:

| Meses desde última selección | Score |
|---|---:|
| Nunca seleccionado | 100 |
| ≥ 12 | 90 |
| 6–11 | 70 |
| 3–5 | 40 |
| < 3 | 10 |

Definición operativa de la consulta:

- se consideran solo selecciones **anteriores a la actual** (fecha de reunión < fecha de reunión de la selección en curso);
- se consideran solo selecciones con `id_tipo_gerencia` igual a la gerencia de la selección en curso (selecciones sin gerencia no aportan al historial de ninguna gerencia).

Esta regla es temporal.

Cuando el módulo de talleres tenga histórico operativo suficiente podrá sustituirse por:

```text
días/meses desde último taller realizado
```

sin modificar la arquitectura general del motor.

---

# Eficiencia geográfica

## 9. Agrupabilidad geográfica

Se utilizará:

```text
agrupabilidad_geografica
```

en lugar de una densidad geográfica genérica.

La pregunta que debe responder el factor es:

> ¿Qué tan fácil es incorporar este hospital a un grupo geográfico operacionalmente conveniente?

Este factor conecta directamente la selección asistida con la zonificación posterior definida en ADR-00004.

Definición operativa de **vecino compatible**:

> otro candidato **con coordenadas**, a distancia Haversine ≤ `radio_km`, que comparte la **misma clasificación** `es_zona_metropolitana` que el hospital evaluado.

- Para un hospital **foráneo** (`es_zona_metropolitana = 0`): vecinos = otros candidatos foráneos. La regla del mínimo 4 hospitales aplica a viajes foráneos, por eso solo los foráneos cuentan.
- Para un hospital **local** (`es_zona_metropolitana = 1`): vecinos = otros candidatos locales; el conteo se normaliza por percentil a 0–100.

Cálculo: O(n²) sobre los candidatos con coordenadas (Haversine, helper existente). Con el filtro de gerencia el conjunto es de cientos; el costo es trivial y queda anotado por si el universo crece.

---

## 10. Hospitales foráneos

Para:

```text
es_zona_metropolitana = 0
```

la agrupabilidad prioriza la posibilidad de formar un grupo mínimo útil.

Ejemplo inicial:

| Vecinos compatibles dentro del radio | Hospitales potenciales del grupo | Score |
|---:|---:|---:|
| 0 | 1 | 0 |
| 1 | 2 | 25 |
| 2 | 3 | 50 |
| ≥3 | ≥4 | 100 |

La lógica refleja la regla:

```text
mínimo 4 hospitales por viaje foráneo
```

El radio utilizado se configura mediante `parametros_json` del factor.

Este radio es independiente del `radio_clustering_km` utilizado posteriormente para formar las zonas del ADR-00004.

---

## 11. Hospitales locales

Para:

```text
es_zona_metropolitana = 1
```

la agrupabilidad utiliza el conteo de vecinos compatibles (locales) dentro del radio configurado, normalizado por **percentil** a 0–100.

---

## 12. Hospitales sin clasificación metropolitana o sin coordenadas

### Sin clasificación (`es_zona_metropolitana = NULL`)

El hospital permanece visible.

La UI mostrará:

```text
⚠ Clasificación geográfica incompleta
```

Cuando una lógica necesite tratarlo como local o foráneo se utilizará el criterio conservador definido en ADR-00004.

### Sin coordenadas (latitud o longitud NULL)

No se excluye del ranking y **no** se le asigna agrupabilidad 0:

```text
agrupabilidad = dato no disponible
→ score neutral 50
→ dato_disponible = false
→ baja el porcentaje de completitud
→ advertencia visible
```

Ejemplo:

```text
Hospital X                 Score 76

⚠ Sin coordenadas
No fue posible calcular agrupabilidad geográfica.
Se utilizó valor neutral 50/100.
```

Esto es coherente con el principio [[#13. NULL no equivale a cero|NULL no equivale a cero]]: sin coordenadas no significa "sin vecinos".

---

# Datos incompletos

## 13. NULL no equivale a cero

Ejemplo:

```text
numero_quirofanos = NULL
```

significa:

> no conocemos el dato.

No significa:

> tiene cero quirófanos.

Por ello, V1 utilizará para factores cuantitativos:

```text
NULL → score neutral = 50
```

y conservará:

```text
dato_disponible = false
```

en el detalle del factor.

Regla complementaria para percentiles: los valores NULL **se excluyen del universo del percentil** (no participan con un 50 artificial; participarían y distorsionarían el ranking de los hospitales con dato). El neutral 50 aplica solo al hospital sin dato.

---

## 14. Calidad de datos

Cada hospital tendrá:

```text
porcentaje_completitud
```

Calculado como el porcentaje de **factores activos** con `dato_disponible = true` en esa ejecución.

Ejemplo:

```text
Hospital A

Prioridad:        88 / 100
Datos completos: 100 %
```

frente a:

```text
Hospital B

Prioridad:        85 / 100
Datos completos: 75 %

⚠ Número de quirófanos sin dato
```

La completitud:

- no modifica el score;
- no es un factor comercial;
- no representa confianza estadística;
- únicamente informa al usuario qué tan completos están los datos utilizados.

---

# Factores sin variabilidad

## 15. Un factor constante no debe consumir peso efectivo

Ejemplo:

En la primera ejecución:

```text
Hospital A → nunca seleccionado → 100
Hospital B → nunca seleccionado → 100
Hospital C → nunca seleccionado → 100
```

El factor:

```text
recencia_seleccion
```

no diferencia candidatos.

El motor detectará:

```text
min(score_factor) = max(score_factor)
```

y marcará:

```text
aplicado = false
motivo = "sin_variabilidad"
```

El peso será redistribuido proporcionalmente entre los demás factores aplicables.

Ejemplo:

Configuración:

```text
Anestesias      40
Quirófanos      15
Recencia        25
Agrupabilidad   20
               ───
               100
```

Si recencia no discrimina:

```text
Pesos efectivos

Anestesias      53.33 %
Quirófanos      20.00 %
Agrupabilidad   26.67 %
Recencia         0.00 %
```

Los pesos efectivos utilizados quedan persistidos en la ejecución.

Método de redondeo: la redistribución proporcional puede producir decimales que no sumen exactamente 100. El residuo se asigna al factor de **mayor peso efectivo** (método de residuo mayor), de modo que `Σ peso_efectivo = 100.00` exacto. Con test unitario que lo garantice.

---

# Fórmula

## 16. Score total

Para los factores aplicables:

```text
score_total =
    Σ(score_factor × peso_efectivo)
```

donde:

```text
Σ peso_efectivo = 1
```

Resultado:

```text
0 ≤ score_total ≤ 100
```

El resultado se redondea a dos decimales.

---

# Comparabilidad

## 17. El score es relativo a una ejecución

Los factores basados en percentiles dependen del universo candidato.

Por ejemplo:

```text
Hospital A
Septiembre → 88

Hospital A
Octubre → 74
```

no significa necesariamente que Hospital A haya empeorado.

Puede significar que el universo de candidatos cambió.

Por ello:

> Los scores son directamente comparables dentro de la misma ejecución y configuración. Las comparaciones históricas deben considerar el conjunto candidato y la versión utilizada.

---

# Configuración y versionado

## 18. Configuración administrativa

Los factores y pesos no son configurables por el usuario final.

La configuración corresponde a Administración.

El Gerente de Ventas consume la configuración activa en modo lectura.

Esto evita que diferentes usuarios produzcan rankings con criterios arbitrariamente distintos dentro del mismo proceso formal.

---

## 19. Configuraciones versionadas

Las configuraciones utilizadas quedan congeladas.

Ejemplo:

```text
General V1
Anestesias = 40 %
```

Si posteriormente se desea:

```text
Anestesias = 30 %
```

no se modifica V1.

Se crea:

```text
General V2
```

Ejemplo histórico:

```text
General V1
Inactiva
Vigente hasta 31/10/2026

General V2
Activa
Desde 01/11/2026
```

En V1 existe **una única configuración activa** en todo el sistema (índice único filtrado `WHERE activo = 1`). No hay perfiles de ranking: quedan como evolución futura.

---

## 20. Una configuración utilizada es inmutable

Después de haber producido al menos una ejecución no se podrá modificar:

- peso;
- factor;
- normalización;
- parámetros;
- estado del factor.

La acción administrativa será:

```text
[Crear nueva versión]
```

---

# Trazabilidad del ranking

## 21. Cada cálculo es una ejecución

El ranking no se entiende únicamente como una consulta temporal.

Cada vez que el usuario genera una propuesta se crea:

```text
ranking_ejecucion
```

Ejemplo:

```text
Ejecución #182

Selección:        Septiembre 2026
Configuración:    General V1
Algoritmo:        scoring-v1.0
Candidatos:       721
Cantidad pedida:   64
Fecha:            15/08/2026
```

La ejecución congela:

- selección mensual;
- configuración;
- versión del algoritmo;
- cantidad solicitada;
- número de candidatos;
- filtros;
- pesos efectivos;
- usuario;
- fecha.

---

## 22. Se persisten solo los Top N

`ranking_ejecucion_hospitales` contiene únicamente los N hospitales con mejor posición — los que el usuario puede aceptar o rechazar. El tamaño del universo evaluado queda registrado en `cantidad_candidatos` de la ejecución.

> *Revisión 2026-09-09:* la versión original persistía todos los candidatos evaluados para reconstruir "qué propuso el sistema y qué decidió el humano". Se limita al Top N para controlar el volumen por ejecución (cientos → N filas); se acepta perder la reconstrucción de las posiciones > N. Las decisiones históricas de los N persistidos se conservan igual.

Ejemplo:

| Posición | Hospital | Score | Decisión |
|---:|---|---:|---|
| 1 | Hospital A | 92 | Seleccionado |
| 2 | Hospital B | 89 | Seleccionado |
| 3 | Hospital C | 87 | Rechazado |
| 4 | Hospital D | 85 | Rechazado |

Esto permite reconstruir exactamente:

> qué propuso el sistema (los N) y qué decidió el humano sobre ellos.

---

## 23. Estados de decisión

V1 utilizará como mínimo:

```text
SugeridoSeleccionado
SugeridoRechazado
SinDecision
```

> ~~`NoSugeridoSeleccionado`~~ — deprecado en la revisión 2026-09-09: solo se persisten los Top N, por lo que toda alta desde el ranking es de hospitales sugeridos. El valor permanece en el CHECK de BD sin uso (no requiere migración).

Un motivo podrá añadirse posteriormente:

```text
motivo_decision
```

pero no será obligatorio en V1.

---

## 24. Hospital agregado completamente fuera del ranking

Si el usuario utiliza el flujo manual tradicional:

```text
[Agregar hospital]
```

y el hospital no proviene de ninguna ejecución:

```text
id_ranking_ejecucion = NULL
score_sugerencia = NULL
```

Esto es válido.

El sistema mantiene claramente diferenciados:

```text
alta asistida
vs.
alta manual
```

El "Origen" mostrado en la UI (Sugerencia / Manual) se deriva de `id_ranking_ejecucion IS NULL`; no requiere columna propia.

---

## 25. Múltiples ejecuciones: solo la última es interactiva

El usuario puede generar el ranking varias veces sobre la misma selección (p. ej. tras ajustar hospitales manualmente). Cada generación crea una **nueva** ejecución; ninguna se sobrescribe.

Reglas:

- **Solo la ejecución más reciente** de la selección acepta decisiones (aceptar/rechazar/agregar desde ranking). Las ejecuciones anteriores son **snapshots históricos de solo lectura**.
- Intentar registrar una decisión sobre una ejecución que no es la última → `409 Conflict`.
- Las decisiones registradas **nunca se revierten**: si un hospital aceptado se quita después de la selección (`quitarHospital`), la fila en `selecciones_mensuales_hospitales` se elimina, pero la decisión histórica de la ejecución se conserva tal como ocurrió. El estado actual de la selección se reconstruye mirando la selección, no la ejecución.

---

# Fases

| Fase | Nombre | Contenido |
|---|---|---|
| 0 | Planificación | ADR + tareas |
| 1 | Base de datos | Configuración + ejecución + detalle + vínculo con selección |
| 2 | Backend | Motor de scoring + endpoints + pruebas |
| 3 | Frontend | Selección asistida + explicación + configuración |

---

# Fase 0 — Decisiones de diseño

1. El resultado visible siempre es un ranking.
2. V1 genera el ranking mediante scoring.
3. El score no representa probabilidad.
4. Filtros, scoring y restricciones se mantienen separados.
5. Todo factor produce un valor normalizado 0–100.
6. V1 usa anestesias, quirófanos, recencia y agrupabilidad.
7. NULL representa dato desconocido; los NULL se excluyen del universo del percentil y reciben el neutral 50.
8. La calidad de datos se muestra pero no modifica el score.
9. Los factores sin variabilidad no consumen peso efectivo; el residuo de redondeo va al factor de mayor peso.
10. El score es relativo al universo candidato.
11. La agrupabilidad geográfica reemplaza densidad genérica; "vecino compatible" = mismo `es_zona_metropolitana` dentro del radio.
12. Configuraciones utilizadas son inmutables.
13. Cada ejecución del ranking queda persistida.
14. Se guardan solo los Top N candidatos (no todos los evaluados); `cantidad_candidatos` preserva el tamaño del universo.
15. Se registra la decisión humana.
16. La sugerencia nunca selecciona automáticamente.
17. Solo la última ejecución de una selección es interactiva; las anteriores son de solo lectura y sus decisiones nunca se revierten.
18. Hospitales sin coordenadas participan con agrupabilidad neutral (50) y advertencia; no se excluyen ni se penalizan con 0.

---

# Fase 1 — Base de datos

Script `0009_<timestamp>_educacion-medica_create-config-ranking-scoring.lefarma.sql` (formato de naming del módulo: `NNNN_YYYYMMDD-HHMM_educacion-medica_<nombre>.lefarma.sql`). Convenciones verificadas contra los scripts 0003/0006/0007: snake_case, `id_<tabla>` IDENTITY PK, guards idempotentes, `MS_Description` en tablas y columnas, FK físicas solo dentro de `educacion_medica` y lógicas hacia Asokam, auditoría completa solo en tablas madre.

## `config_ranking`

```text
id_configuracion        INT IDENTITY PK
nombre                  NVARCHAR(100) NOT NULL
version                 INT NOT NULL
activo                  BIT NOT NULL DEFAULT 0
fecha_vigencia_inicio   DATE NULL
fecha_vigencia_fin      DATE NULL
fecha_creacion          DATETIME2 NOT NULL
fecha_modificacion      DATETIME2 NOT NULL
id_usuario_creacion     INT NULL
id_usuario_modificacion INT NULL
```

Restricciones:

```text
CONSTRAINT UQ_config_ranking_nombre_version UNIQUE (nombre, version)
CREATE UNIQUE INDEX UX_config_ranking_activa ON (activo) WHERE activo = 1
```

En V1 existe una única configuración activa en el sistema (índice único filtrado — mismo patrón que `UX_equipos_pareo_*`). No hay columna de perfil: los perfiles de ranking quedan como evolución futura. Las columnas de vigencia se crean de camino; V1 usa solo `activo`.

Auditoría completa: es tabla madre.

## `config_ranking_factores`

```text
id_factor            INT IDENTITY PK
id_configuracion     INT NOT NULL  FK -> config_ranking (NO ACTION)
clave                VARCHAR(50) NOT NULL
grupo                VARCHAR(30) NULL
peso                 DECIMAL(5,2) NOT NULL  CHECK (peso >= 0)
activo               BIT NOT NULL DEFAULT 1
tipo_normalizacion   VARCHAR(30) NULL      -- documental en V1
parametros_json      NVARCHAR(MAX) NULL
```

Claves V1:

```text
anestesias_totales
numero_quirofanos
recencia_seleccion
agrupabilidad_geografica
```

Ejemplo de `parametros_json` (factor agrupabilidad):

```json
{
  "radio_km": 50
}
```

Restricciones:

```text
CONSTRAINT UQ_config_ranking_factores_config_clave UNIQUE (id_configuracion, clave)
```

— mismo patrón que `UQ_parametros_anestesias_anio_clave`.

`tipo_normalizacion` es **documental en V1**: el motor decide la estrategia de cada factor en código y la columna sirve para describir la intención de la configuración (percentil / tramos / funcion). No implica cambio de estrategia configurable.

Sin auditoría: es tabla hija; se borra físicamente junto a su configuración (patrón `programas_anuales_detalles`).

Los pesos activos configurados deben sumar:

```text
100 %
```

— validación de servicio en `PUT` (la BD no puede garantizarla por fila).

## `ranking_ejecuciones`

```text
id_ranking_ejecucion  INT IDENTITY PK
id_seleccion_mensual  INT NOT NULL  FK -> selecciones_mensuales (NO ACTION)
id_configuracion      INT NOT NULL  FK -> config_ranking (NO ACTION)
version_algoritmo     VARCHAR(20) NOT NULL
cantidad_solicitada   INT NOT NULL
cantidad_candidatos   INT NOT NULL
pesos_efectivos_json  NVARCHAR(MAX) NOT NULL
filtros_json          NVARCHAR(MAX) NULL
fecha_ejecucion       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
id_usuario_ejecucion  INT NULL            -- FK lógica -> app.Usuarios (Asokam)
```

```text
CREATE INDEX IX_ranking_ejecuciones_seleccion (id_seleccion_mensual, fecha_ejecucion DESC)
```

`id_seleccion_mensual` con **NO ACTION** (no CASCADE): la ejecución es un registro de auditoría; la aplicación no elimina selecciones, y si algún día se eliminan, el borrado debe ser una decisión explícita, no un efecto en cascada silencioso.

No se agrega `diagnostico_json` en V1.

## `ranking_ejecucion_hospitales`

```text
id_ejecucion_hospital   INT IDENTITY PK
id_ranking_ejecucion    INT NOT NULL  FK -> ranking_ejecuciones (CASCADE)
id_hospital             INT NOT NULL            -- FK lógica -> dbo.genContactosCat.codigoContacto
posicion                INT NOT NULL            -- 1..N dentro de la ejecución
score_total             DECIMAL(5,2) NOT NULL
porcentaje_completitud  DECIMAL(5,2) NOT NULL
es_top_sugerido         BIT NOT NULL
decision                VARCHAR(25) NOT NULL DEFAULT 'SinDecision'
factores_json           NVARCHAR(MAX) NOT NULL
```

Restricciones:

```text
CONSTRAINT UQ_ejecucion_hospital_unica UNIQUE (id_ranking_ejecucion, id_hospital)
CONSTRAINT CK_ejecucion_hospital_decision CHECK (decision IN
  ('SugeridoSeleccionado','SugeridoRechazado','NoSugeridoSeleccionado','SinDecision'))
CONSTRAINT DF_ejecucion_hospital_decision DEFAULT ('SinDecision')
CREATE INDEX IX_ejecucion_hospital_hospital (id_hospital)
```

`posicion` (y no `ranking`): `RANK` es palabra reservada ODBC y el identificador genera fricción en consultas y mapeo.

`es_top_sugerido` queda en `1` en todas las filas persistidas (solo se persisten los Top N); la columna se mantiene por compatibilidad y posible evolución futura.

Ejemplo de `factores_json`:

```json
[
  {
    "clave": "anestesias_totales",
    "valor_crudo": 1820.00,
    "score_factor": 91.4,
    "peso_configurado": 40,
    "peso_efectivo": 40,
    "puntos_aportados": 36.56,
    "dato_disponible": true,
    "aplicado": true
  },
  {
    "clave": "numero_quirofanos",
    "valor_crudo": null,
    "score_factor": 50,
    "peso_configurado": 15,
    "peso_efectivo": 15,
    "puntos_aportados": 7.50,
    "dato_disponible": false,
    "aplicado": true
  }
]
```

## ALTER `selecciones_mensuales_hospitales`

Agregar:

```text
id_ranking_ejecucion INT NULL   FK -> ranking_ejecuciones (NULL = alta manual)
score_sugerencia     DECIMAL(5,2) NULL
CONSTRAINT UQ_seleccion_hospital_unica UNIQUE (id_seleccion_mensual, id_hospital)
```

El vínculo permite identificar mediante qué ejecución fue agregado el hospital. `score_sugerencia` es derivable del join con `ranking_ejecucion_hospitales`, pero se denormaliza para la consulta del grid sin join adicional; no puede divergir porque la ejecución es inmutable.

El constraint `UQ_seleccion_hospital_unica` respalda el alta en lote a nivel BD (hoy la unicidad solo la garantiza el servicio). El script **debe verificar duplicados preexistentes** antes de crearlo y abortar con mensaje si existen (patrón de guards idempotentes del módulo).

No se duplica el detalle completo del score: vive en `ranking_ejecucion_hospitales`.

## Seed

```text
config_ranking: ('General', version 1, activo 1, vigencias NULL, id_usuario NULL)
config_ranking_factores:
  anestesias_totales        40  Potencial   percentil  {}
  numero_quirofanos         15  Potencial   percentil  {}
  recencia_seleccion        25  Cobertura   tramos     {}
  agrupabilidad_geografica  20  Geografia   funcion    {"radio_km": 50}
```

---

# Fase 2 — Backend

## `RankingHospitalesService`

Responsabilidades V1:

```text
1. Obtener candidatos (gerencia de la selección, activos, no ya agregados)
2. Aplicar filtros de elegibilidad
3. Obtener valores crudos (hospital_extension 1:1 + lat/long + historial de selecciones)
4. Calcular score 0–100 de cada factor
   - percentil excluyendo NULLs del universo
   - NULL → neutral 50 + dato_disponible = false
5. Evaluar completitud (% factores activos con dato)
6. Detectar factores sin variabilidad
7. Calcular pesos efectivos (redistribución + residuo mayor, Σ = 100.00 exacto)
8. Calcular score total
9. Ordenar determinísticamente
10. Persistir ejecución (Top N + factores; `cantidad_candidatos` conserva el universo evaluado)
11. Entregar ranking
```

No corresponde al servicio V1:

```text
✗ Pearson
✗ Spearman
✗ covarianza
✗ regresiones
✗ predicciones
✗ probabilidades
```

## Determinismo

Mismos:

```text
candidatos
+
configuración
+
versión del algoritmo
```

deben producir el mismo ranking.

El desempate final deberá ser explícito.

Ejemplo:

```text
score_total DESC,
id_hospital ASC
```

---

# Endpoint — generar ranking

```http
POST /api/educacion-medica/selecciones-mensuales/{id}/ranking/generar
```

Body:

```json
{
  "cantidad": 64
}
```

Validaciones:

- selección en estado `Borrador` o `EnRevision` (mismo guard que el alta manual);
- la selección tiene `id_tipo_gerencia` — si no, `409 Conflict`;
- configuración activa existe — si no, `409 Conflict` con mensaje claro.

Se utiliza `POST` porque la operación:

- ejecuta cálculo;
- crea historial;
- persiste una nueva ejecución.

Respuesta:

```text
id_ranking_ejecucion
configuracion
pesos_configurados
pesos_efectivos
cantidad_candidatos
ranking
```

---

# Endpoint — consultar ejecuciones

Última ejecución (la interactiva — para reabrir el modal):

```http
GET /api/educacion-medica/selecciones-mensuales/{id}/ranking
```

Ejecución histórica específica (solo lectura):

```http
GET /api/educacion-medica/selecciones-mensuales/{id}/ranking/{idRankingEjecucion}
```

Ninguna consulta recalcula scores.

---

# Endpoint — agregar hospitales en lote

```http
POST /api/educacion-medica/selecciones-mensuales/{id}/hospitales/lote
```

Ejemplo:

```json
{
  "id_ranking_ejecucion": 182,
  "hospitales": [
    { "id_hospital": 101 },
    { "id_hospital": 205, "producto_a_promocionar": "R-III" }
  ]
}
```

`producto_a_promocionar` es opcional por hospital (mismo comportamiento que el alta manual).

El backend:

1. valida estado editable de la selección;
2. valida que la ejecución indicada sea **la última** de la selección (`409 Conflict` si no);
3. valida hospitales (existencia, no duplicados en la selección — respaldado por `UQ_seleccion_hospital_unica`);
4. actualiza las decisiones correspondientes en la ejecución;
5. inserta los hospitales seleccionados replicando el snapshot del alta manual (región, entidad, ciudad/municipio, latitud/longitud snapshot, score_sugerencia, vínculo con la ejecución);
6. ejecuta todo dentro de una transacción (todo o nada).

---

# Alta fuera del Top N

Si un hospital pertenecía a la ejecución pero no al Top N:

```text
NoSugeridoSeleccionado
```

---

# Alta manual externa

Si fue agregado mediante el buscador manual y no pertenecía a una ejecución:

```text
id_ranking_ejecucion = NULL
score_sugerencia = NULL
```

---

# Configuración administrativa

## GET configuración

```http
GET /api/educacion-medica/config-ranking
```

Retorna:

- configuración activa;
- factores;
- pesos;
- normalización;
- parámetros;
- versiones anteriores.

## Crear nueva versión

```http
POST /api/educacion-medica/config-ranking/{id}/nueva-version
```

Copia la configuración existente y crea una versión editable.

## Editar configuración

```http
PUT /api/educacion-medica/config-ranking/{id}
```

Solo se permite si nunca ha sido utilizada por una ejecución.

Si ya fue utilizada:

```text
409 Conflict

"La configuración ya fue utilizada.
Cree una nueva versión para modificarla."
```

Validación de servicio: los pesos activos deben sumar 100 (± tolerancia 0); al menos un factor activo; claves conocidas por el motor.

---

# Permisos (patrón actual del módulo)

| Endpoint | Autorización |
|---|---|
| Generar/consultar ranking, lote, sugerencias | `[Authorize]` — mismo patrón del resto de `EducacionMedica` (la edición ya está regulada por estados de la selección) |
| `ConfigRankingController` (GET/PUT/nueva-version) | `[Authorize(Policy = "RequireAdministrator")]` — configuración administrativa (decisión 18) |

---

# Pruebas unitarias (xUnit + FluentAssertions)

## Normalización

- percentiles;
- empates;
- un candidato;
- valores extremos;
- NULL → 50;
- **NULLs excluidos del universo del percentil** (no distorsionan a los demás);
- factor constante.

## Pesos

- suma de pesos configurados = 100;
- factor activo/inactivo;
- factor sin variabilidad;
- redistribución proporcional;
- **residuo de redondeo asignado al factor de mayor peso; `Σ peso_efectivo = 100.00` exacto**;
- redondeo final del score.

## Recencia

- nunca seleccionado;
- ≥12 meses;
- 6–11;
- 3–5;
- <3;
- valores frontera;
- **excluye la selección en curso del historial**;
- selecciones sin gerencia no contaminan el historial.

## Agrupabilidad

- hospital local;
- hospital foráneo sin vecinos;
- 1 vecino;
- 2 vecinos;
- ≥3 vecinos;
- **vecino incompatible no cuenta** (foráneo no cuenta locales y viceversa);
- hospital sin clasificación;
- **hospital sin coordenadas → neutral 50 + dato_disponible = false**;
- radio configurable.

## Ranking

- score correcto;
- orden descendente;
- empate (`posicion` con desempate por id_hospital);
- determinismo;
- Top N (solo se persisten los N mejores; `es_top_sugerido = 1` en todas las filas);
- cantidad solicitada.

## Calidad de datos

- dato completo;
- factor NULL;
- porcentaje de completitud;
- NULL no se interpreta como cero.

## Persistencia

- crea ejecución;
- guarda todos los candidatos;
- factores persistidos;
- pesos efectivos persistidos;
- sugerido seleccionado;
- sugerido rechazado;
- ~~no sugerido seleccionado~~ (deprecado 2026-09-09);
- alta manual externa (NULLs).

## Ejecuciones múltiples

- segunda ejecución no sobrescribe la primera;
- **decisiones solo sobre la última ejecución; sobre una anterior → 409**;
- quitar hospital de la selección NO revierte la decisión histórica.

## Lote

- atomicidad;
- hospital duplicado (`UQ_seleccion_hospital_unica` + error de servicio amigable);
- rollback completo;
- vínculo con ejecución y score_sugerencia;
- snapshot de región/entidad/ciudad/lat/long replicado;
- producto opcional.

---

# Fase 3 — Frontend

## Selección mensual

Se mantiene:

```text
[Agregar hospital]
```

como flujo manual.

Se agrega:

```text
[Sugerir hospitales]
```

como flujo asistido.

---

# Modal — Selección asistida

Encabezado:

```text
Selección asistida

Configuración: General V1
Hospitales candidatos: 721
Cantidad sugerida: 64
```

Resumen:

```text
IMSS                 42
Descentralizados     22

Datos completos      91 %
```

Tabla:

```text
☑  #1   Hospital A                  92.4
☑  #2   Hospital B                  89.7
☐  #3   Hospital C                  87.2
...
```

El Top N aparece pre-marcado por defecto con **"lo que falta"**: los primeros `max(0, N − ya agregados en la selección)` quedan seleccionados, de modo que al aplicar la selección quede completa a N. El usuario puede:

```text
☑ seleccionar
☐ desmarcar
+ agregar otro candidato
```

Al reabrir el modal se carga la **última ejecución** (`GET .../ranking`); si existe, no se recalcula nada hasta que el usuario pida generar una nueva.

---

# Explicación del score

Cada hospital podrá desplegar:

```text
Hospital General X

Prioridad
92.4 / 100
```

Detalle:

```text
Potencial hospitalario
────────────────────────

Anestesias
Valor:       1,820
Score:       91.4
Peso:        40 %
Aporte:      +36.56


Quirófanos
Valor:       8
Score:       84
Peso:        15 %
Aporte:      +12.60


Cobertura
────────────────────────

Última selección:
Nunca seleccionado

Score:       100
Peso:        25 %
Aporte:      +25


Eficiencia geográfica
────────────────────────

3 hospitales compatibles cercanos

Score:       100
Peso:        20 %
Aporte:      +20
```

---

# Información incompleta

Ejemplo:

```text
⚠ Información incompleta

Número de quirófanos:
Sin dato

Se utilizó el valor neutral 50/100
para este factor.
```

Caso sin coordenadas:

```text
⚠ Sin coordenadas
No fue posible calcular agrupabilidad geográfica.
Se utilizó valor neutral 50/100.
```

---

# Factor no aplicado

Ejemplo:

```text
Recencia

No aplicada en esta ejecución.

Todos los candidatos obtuvieron
el mismo valor para este factor.

Peso configurado: 25 %
Peso efectivo:     0 %
```

---

# Tabla principal de hospitales seleccionados

Agregar columnas:

```text
Score    Origen
```

Ejemplo:

| Hospital | Institución | Entidad | Score | Origen |
|---|---|---|---:|---|
| Hospital A | IMSS | CDMX | 92.4 | Sugerencia |
| Hospital B | IMSS | Puebla | 89.7 | Sugerencia |
| Hospital X | DESC | Hidalgo | — | Manual |

`Origen` se deriva de `id_ranking_ejecucion` (NULL = Manual); no requiere dato adicional.

Tooltip o acción:

```text
[Ver por qué]
```

para hospitales provenientes de ranking (abre la explicación desde `ranking_ejecucion_hospitales` de su ejecución).

---

# Pantalla — Configuración del ranking

Ruta sugerida:

```text
/catalogos/config-ranking
```

Vista:

```text
Ranking de hospitales

Configuración activa:
General V1
```

Factores:

| Grupo | Factor | Peso | Estado |
|---|---|---:|---|
| Potencial | Anestesias | 40 % | Activo |
| Potencial | Quirófanos | 15 % | Activo |
| Cobertura | Recencia | 25 % | Activo |
| Geografía | Agrupabilidad | 20 % | Activo |
| | **Total** | **100 %** | |

Acciones:

```text
[Crear nueva versión]
[Ver versiones anteriores]
```

Una configuración histórica se muestra solamente en lectura.

---

# Evolución futura — fuera del alcance

V1 **no implementa estadística predictiva ni análisis estadístico para definir los pesos**.

Sin embargo, el diseño conserva deliberadamente:

```text
candidatos
factores
score
ranking
sugerido/no sugerido
seleccionado/rechazado
configuración
fecha
```

para que en el futuro pueda evaluarse si el método de scoring representa adecuadamente los resultados de negocio.

## Posibles factores futuros

Cuando existan fuentes confiables podrán agregarse, mediante nuevas versiones de configuración:

```text
compras_3m
compras_6m
compras_12m
crecimiento_compras
dias_desde_ultima_compra

visitas_3m
visitas_6m
visitas_12m
dias_desde_ultima_visita

talleres_12m
dias_desde_ultimo_taller
```

Agregar nuevos factores no implica reemplazar el ranking.

## Análisis estadístico futuro

Cuando exista histórico suficiente podrá elaborarse un ADR independiente para evaluar:

- relación entre factores;
- redundancia entre variables;
- correlaciones;
- multicolinealidad;
- relación entre score y resultados;
- recalibración de pesos.

La estadística podrá utilizarse para **mejorar el scoring existente** sin necesariamente sustituirlo.

## Modelos predictivos futuros

También podrá evaluarse, mediante otro ADR, la incorporación de:

- regresión;
- modelos tabulares;
- gradient boosting;
- learning-to-rank;
- probabilidades;
- valor esperado.

Estos modelos podrían:

```text
reemplazar
o
complementar
```

al scoring.

No existe una decisión tomada de migrar obligatoriamente hacia ellos.

## Otros evolución futura

- **Perfiles de ranking** (p. ej. "Recuperación", "Expansión"): requeriría columna `perfil` en `config_ranking` y varias configuraciones activas simultáneas; no documentado en la operación actual.
- **Universo objetivo anual** (FOR-002/FOR-003): restringir los candidatos a los hospitales objetivo del año (Pareto 70/30); hoy no existe como concepto digitalizado.
- **Recencia real de talleres**: cuando el módulo de talleres registre ejecución.

---

# Principio de evolución

El ranking se considera el concepto permanente.

El método que lo produce puede evolucionar:

```text
HOY
────────────────────────

Ranking
   ↑
Scoring experto


FUTURO POSIBLE
────────────────────────

Ranking
   ↑
Scoring calibrado con evidencia


FUTURO OPCIONAL
────────────────────────

Ranking
   ↑
Score híbrido / modelo predictivo
```

El scoring V1 puede mantenerse indefinidamente si demuestra ser suficiente para la operación.

---

# Validación contra la operación documentada

| Regla documentada | Implementación V1 |
|---|---|
| Priorizar hospitales por valor de mercado | Anestesias + quirófanos |
| Considerar ubicación geográfica | Agrupabilidad |
| Preferencia por hospitales sin talleres recientes | Recencia; V1 usa selección como proxy |
| Mínimo 4 hospitales en viaje foráneo | Factor de agrupabilidad (vecinos compatibles = foráneos dentro del radio) |
| Decisión final del GV | Ranking editable; nunca selección automática |
| Meta mensual | Restricción posterior, no factor del ranking |

Los siguientes elementos son decisiones propias de digitalización y no provienen literalmente del proceso en papel:

- score 0–100;
- pesos;
- percentiles;
- valor neutral para NULL;
- pesos efectivos;
- configuraciones versionadas;
- persistencia de ejecuciones;
- ranking histórico.

---

# Consequences

## Positivas

- La selección deja de depender de revisar manualmente miles de hospitales.
- El usuario entiende por qué un hospital aparece arriba.
- El sistema sigue sin tomar la decisión final.
- Los criterios pueden cambiar mediante configuración.
- Las configuraciones utilizadas quedan congeladas.
- El ranking puede reproducirse históricamente (Top N + valores crudos + pesos efectivos quedan persistidos; el universo evaluado queda como contador en `cantidad_candidatos`).
- Se conservan aceptados y rechazados.
- Los hospitales agregados manualmente siguen siendo válidos.
- NULL no penaliza automáticamente al hospital.
- La agrupabilidad conecta selección y rutas.
- La estructura permite incorporar nuevos factores sin rehacer el motor.
- Se captura desde V1 información útil para futuras mejoras.
- La unicidad de hospital por selección queda garantizada a nivel BD (respaldo del alta en lote).

## Negativas

- Se agregan varias tablas respecto a un scoring mínimo.
- Cada ejecución genera solo N registros (revisión 2026-09-09: antes eran todos los candidatos, cientos o miles); se pierde la reconstrucción de las posiciones > N.
- Calcular agrupabilidad es O(n²) sobre los candidatos con coordenadas; con el filtro de gerencia es trivial, pero queda anotado si el universo crece.
- Los pesos iniciales son decisiones de negocio.
- La recencia utiliza temporalmente selección como proxy.
- Un score alto con datos incompletos requiere interpretación.
- El score relativo por percentiles no es directamente comparable entre ejecuciones distintas.
- El versionado de configuraciones aumenta ligeramente la administración.
- El constraint `UQ_seleccion_hospital_unica` exige limpiar duplicados preexistentes si los hubiera (el script los detecta y aborta con mensaje).
- Las ejecuciones históricas persisten indefinidamente; no se contempla purga (volumen bajo: una ejecución ≈ cientos de filas).

## Neutras / seguimiento

- Reemplazar `recencia_seleccion` por recencia real de talleres cuando exista el histórico.
- Incorporar compras y visitas cuando exista fuente confiable.
- Evaluar estadística en ADR independiente.
- Evaluar recalibración de pesos sin sustituir necesariamente el scoring.
- Evaluar modelos predictivos solamente si aportan valor medible.
- El ranking permanece como mecanismo de presentación independientemente del motor futuro.
- `tipo_normalizacion` queda documental; si algún día las estrategias deben ser configurables, será ADR propio.

---

# Anexo — Fuentes

## Operación documental

- `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` (IDT-003)
  - priorización por valor de mercado;
  - ubicación geográfica;
  - preferencia por hospitales sin talleres en el año;
  - meta mensual (≥64 por gerencia).

- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos.md` (FOR-004)
  - selección por valor de mercado y ubicación geográfica;
  - agrupación por zonas;
  - mínimo de hospitales en viajes foráneos.

## Decisiones relacionadas

- ADR-00004 — reparto por zonas y planificación de rutas (clustering, snapshots, doble firma, sistema-propone/humano-dispone).
- ADR-00002 — parametrización y versionado de fórmulas (patrón de factores por fila + parámetros).
- `reglas-negocio.md` — reglas AS-IS/TO-BE de la selección mensual.

## Verificación técnica (2026-09-01)

Revisión del diseño contra el código y SQL reales del proyecto:

- `lefarma.database/educacion-medica/0003_..._create-tablas-operacionales.lefarma.sql` — `hospital_extension` 1:1 (`UNIQUE (id_hospital)`, 0003:241), `anestesias_totales DECIMAL(18,2)` (0003:227), `numero_quirofanos INT` (0003:226), `selecciones_mensuales` (`fecha_seleccion`, `id_tipo_gerencia` NULLable, 0003:847-848), `selecciones_mensuales_hospitales` sin constraint de unicidad (0003:995-1012).
- `lefarma.database/educacion-medica/0006_..._create-equipos-pareo-estados.lefarma.sql` — `es_zona_metropolitana BIT NULL` (0006:356-360), snapshots `DECIMAL(10,7)` (0006:287-296), índices únicos filtrados (0006:76-81).
- `lefarma.database/educacion-medica/0007_..._create-zonas-rutas.lefarma.sql` — convenciones de FK/índices (`UQ_rutas_visitas_hospital`, `IX_rutas_seleccion_version`).
- `Lefarma.API/Features/EducacionMedica/` — patrón `[Authorize]` plano, `haversine-greedy-v1` como precedente de `version_algoritmo`, patrón anidado `/rutas/generar` para los endpoints propuestos.
