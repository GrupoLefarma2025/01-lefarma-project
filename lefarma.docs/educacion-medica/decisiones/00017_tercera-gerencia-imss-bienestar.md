---
fecha_creacion: 2026-10-23 10:00
fecha_modificacion: 2026-10-23 10:00
resumen: Agrega IMSS Bienestar como tercera gerencia del módulo, separada de IMSS y Descentralizado. Define el mapeo sugerido desde la jerarquía de genContactosCat (364=IMSS, 385=Bienestar, 370=ISSSTE), una pantalla de revisión con override por hospital y la fuente de verdad en hospital_extension.id_tipo_gerencia. Incluye regiones propias, variantes de workflow y el parámetro de alcance del hospital extraordinario (default SELECCION). Sustituye el alcance fijo de ADR-00011.
---

# ADR-00017 — Tercera gerencia IMSS Bienestar y clasificación de hospitales

## Status

Proposed

> **Decisiones confirmadas por el usuario (2026-10-23):**
> - Sí existe una tercera gerencia: **IMSS Bienestar**.
> - El mapeo debe investigarse en internet y en `genContactosCat`.
> - El alcance del hospital extraordinario debe quedar **parametrizado**; default `SELECCION`.
>
> **Supersede el alcance de ADR-00011**: la mecánica de visita/taller extraordinario se conserva, pero el universo de hospitales ya no es fijo “catálogo fuera de la selección”; se define por parámetro (`EJECUTIVO`, `GERENCIA`, `SELECCION`, `CATALOGO`). El ADR-00011 queda marcado `Superseded by ADR-00017` con nota de que su mecanismo sigue vigente.

## Índice

1. [Decisión](#decisión)
2. [Contexto: IMSS vs IMSS Bienestar](#contexto-imss-vs-imss-bienestar)
3. [Cómo está hoy en Asokam y en el módulo](#cómo-está-hoy-en-asokam-y-en-el-módulo)
4. [Mapeo propuesto](#mapeo-propuesto)
5. [Regiones y workflows](#regiones-y-workflows)
6. [Hospital extraordinario parametrizado](#hospital-extraordinario-parametrizado)
7. [Fases](#fases)
8. [Validación contra la operación documentada](#validación-contra-la-operación-documentada)
9. [Consequences](#consequences)
10. [Anexo — Fuentes](#anexo--fuentes)

## Decisión

1. **Agregar `IMSS Bienestar` al catálogo `educacion_medica.tipo_gerencia`**, junto con `IMSS`, `Descentralizado` y `Privado`.
2. **Mapeo sugerido desde la jerarquía institucional de Asokam:**
   - `codigoContacto = 364` o `codigoContactoPrincipal = 364` → **IMSS**.
   - `codigoContacto = 385` o `codigoContactoPrincipal = 385` → **IMSS Bienestar**.
   - `codigoContacto = 370` o `codigoContactoPrincipal = 370` (ISSSTE) → **Descentralizado** (ISSSTE no es gerencia; ya está documentado).
   - `tipo = 'Privado'` → **Privado**.
   - Resto (Gobierno, sin clasificar) → **Descentralizado**.
3. **La fuente de verdad es `hospital_extension.id_tipo_gerencia`**, no la regla. El sistema **sugiere** con la jerarquía y el área **revisa/confirma** en una pantalla; el override manual manda.
4. **IMSS Bienestar tiene su propio juego de regiones/estados** (copia inicial de Descentralizado, ajustable), porque `regiones_cat` y `regiones_estados` son por gerencia.
5. **Workflows:** se agrega una tercera variante/mapping por gerencia para selección y matriz. Los participantes y pasos se configuran en el admin; no se hardcodean aquí.
6. **Hospital extraordinario:** el alcance se define por parámetro `alcance_hospital_extraordinario` con valores `EJECUTIVO`, `GERENCIA`, `SELECCION`, `CATALOGO`; default `SELECCION`.
   - `EJECUTIVO`: solo hospitales de la selección del propio ejecutivo.
   - `GERENCIA`: cualquier hospital de la selección de la gerencia.
   - `SELECCION`: cualquier hospital de la selección mensual.
   - `CATALOGO`: cualquier hospital del catálogo oficial (comportamiento histórico de ADR-00011).
7. **No se toca la selección firmada** para agregar un hospital extraordinario; el taller/visita se marca como no planificado y se audita.

## Contexto: IMSS vs IMSS Bienestar

### Definición oficial

- **IMSS ordinario**: régimen tradicional del Instituto Mexicano del Seguro Social; atiende a trabajadores asegurados y sus derechohabientes.
- **IMSS-Bienestar**: organismo público descentralizado creado por decreto publicado en el DOF el **31-08-2022** (Servicios de Salud del Instituto Mexicano del Seguro Social para el Bienestar), para brindar atención médica y hospitalaria gratuita a personas **sin afiliación a instituciones de seguridad social** en las entidades que transfirieron sus servicios de salud.
- **Cambio 2025:** el 1 de julio de 2025 se firmó el decreto de incorporación del Programa IMSS-Bienestar al Régimen Ordinario del IMSS; el OPD y su red transferida siguen existiendo. Para efectos comerciales, el módulo debe distinguir la gerencia **IMSS Bienestar** de la gerencia **IMSS**.
- Fuentes: `imssbienestar.gob.mx` (historia y operación), DOF 31-08-2022 (decreto de creación), comunicado IMSS del 1-07-2025 (integración del programa al régimen ordinario).

### Implicación para el módulo

No basta con “IMSS” como una sola gerencia: los hospitales transferidos a IMSS-Bienestar se comportan como una institución/gerencia distinta para la selección, la matriz y los indicadores. El módulo debe poder separarlos sin hardcodear nombres.

## Cómo está hoy en Asokam y en el módulo

- La vista `educacion_medica.vw_hospitales_clasificados` ya distingue:
  - `364` → `IMSS`
  - `385` → `Bienestar`
  - `370` → `ISSSTE`
  - `tipo = 'Gobierno'` → `Descentralizado`
  - `tipo = 'Privado'` → `Privado`
  - `tipo = 'Distribuidor'` → `Distribuidor`
  - resto → `Sin clasificar`
  (`lefarma.database/educacion-medica/0016_20261007-1200_educacion-medica_create-esquema-completo.lefarma.sql:1617-1619`)
- Pero `HospitalService.ClasificarTipoGerencia` manda **385 a Descentralizado**:
  ```csharp
  if (hospital.CodigoContacto == 364 || hospital.CodigoContactoPrincipal == 364)
      return "IMSS";
  return hospital.Tipo == "Privado" ? "Privado" : "Descentralizado";
  ```
  (`lefarma.backend/src/Lefarma.API/Features/EducacionMedica/HospitalService.cs:392-405`)
- El catálogo `tipo_gerencia` solo tiene `IMSS`, `Descentralizado`, `Privado` (`0003_20260806-1556_educacion-medica_create-tablas-operacionales.lefarma.sql:152-155`).
- El backfill de `hospital_extension.id_tipo_gerencia` (script 0030) usa la misma regla y manda 385 a Descentralizado (`0030_20261010-1200_educacion-medica_instalacion-limpia-catalogos.lefarma.sql:338`).

**Conclusión:** hoy IMSS Bienestar no es una gerencia; está diluido en Descentralizado. La vista ya tiene el dato de institución, pero la gerencia no lo refleja.

## Mapeo propuesto

### Regla sugerida

| Condición en `genContactosCat` | Gerencia sugerida |
|---|---|
| `codigoContacto = 364` o `codigoContactoPrincipal = 364` | IMSS |
| `codigoContacto = 385` o `codigoContactoPrincipal = 385` | IMSS Bienestar |
| `codigoContacto = 370` o `codigoContactoPrincipal = 370` | Descentralizado (ISSSTE no es gerencia) |
| `tipo = 'Privado'` | Privado |
| Resto | Descentralizado |

### Pantalla de revisión

- Nueva pantalla **Clasificación de gerencias** (o columna en Hospitales) con:
  - Hospital, CLUES, padre (`codigoContactoPrincipal`), institución (`vw_hospitales_clasificados.institucion`), gerencia sugerida, gerencia asignada, origen (`Sugerida`/`Manual`).
  - Filtros por gerencia sugerida/asignada, institución, estado, “sin clasificar”.
  - Acción individual y masiva para cambiar la gerencia.
  - Conteo de hospitales por gerencia y aviso de diferencias entre sugerida y asignada.
- La pantalla es la que resuelve excepciones (servicios estatales no transferidos, hospitales con CLUES de otra institución, etc.).

### Validación con `genContactosCat` / CLUES

Antes de ejecutar el backfill, correr en SSMS (read-only):

```sql
SELECT codigoContactoPrincipal, COUNT(*) AS unidades
FROM Asokam.dbo.genContactosCat
GROUP BY codigoContactoPrincipal
ORDER BY unidades DESC;

SELECT codigoContacto, nombreContacto, tipo, codigoContactoPrincipal, clues
FROM Asokam.dbo.genContactosCat
WHERE codigoContacto IN (364, 385)
   OR codigoContactoPrincipal IN (364, 385)
ORDER BY codigoContactoPrincipal, nombreContacto;
```

Revisar:

- Si `385` incluye secretarías estatales que no son IMSS-Bienestar, el padre no alcanza; usar el CLUES (catálogo DGIS, agosto 2026) o una lista curada.
- Si hay hospitales “BIENESTAR” colgados de `364`, revisar caso a caso.
- Si hay hospitales de IMSS-Bienestar con `codigoContactoPrincipal` distinto de 385, la pantalla de revisión los corrige.

## Regiones y workflows

### Regiones

- `regiones_cat` y `regiones_estados` son por gerencia (`id_tipo_gerencia`).
- Crear el tercer juego para IMSS Bienestar copiando el de Descentralizado:
  - `INSERT ... SELECT` de regiones con el nuevo `id_tipo_gerencia`.
  - `INSERT ... SELECT` de estados con el nuevo `id_tipo_gerencia`.
  - Ajustar nombres/estados según la operación de IMSS Bienestar.
- La pantalla `RegionesPage` ya muestra el catálogo por gerencia; agregar el filtro/columna de la tercera gerencia.

### Workflows

- Agregar la tercera variante por gerencia:
  - `EDUCACION_MEDICA_SELECCION` · “Selección mensual - IMSS Bienestar”.
  - `EDUCACION_MEDICA_MATRIZ` · “Matriz de talleres - IMSS Bienestar”.
  - El workflow de rutas se retira (ADR-00015/00018); no se crea variante de rutas.
- Mappings `TIPO_GERENCIA`: 1 = IMSS, 2 = Descentralizado, 3 = IMSS Bienestar.
- Participantes/pasos: se configuran en el admin; no se hardcodean. El `WorkflowService` debe mapear el id 3 a un nombre legible.

## Hospital extraordinario parametrizado

### Parámetro

`parametros_modulo`:

| Clave | Tipo | Default | Valores |
|---|---|---|---|
| `alcance_hospital_extraordinario` | enum | `SELECCION` | `EJECUTIVO`, `GERENCIA`, `SELECCION`, `CATALOGO` |

### Comportamiento

- **`EJECUTIVO`**: el hospital debe estar en `selecciones_mensuales_hospitales` y asignado al ejecutivo del taller (por región o por override). No se permite un hospital de otro ejecutivo.
- **`GERENCIA`**: el hospital debe estar en la selección de la misma gerencia.
- **`SELECCION`**: el hospital debe estar en cualquier selección mensual vigente.
- **`CATALOGO`**: el hospital puede ser cualquier contacto del catálogo oficial (comportamiento histórico de ADR-00011); `id_seleccion_hospital` puede ser NULL.

En todos los casos:

- Se exige **motivo** y se audita (`ajustes_post_cierre`/bitácora).
- Si el hospital está en la selección, el taller conserva `id_seleccion_hospital` y se marca `es_extraordinario = 1` (no planificado).
- Si el alcance es `CATALOGO` y el hospital no está en la selección, `id_seleccion_hospital = NULL`.
- El taller entra a la matriz de la gerencia correspondiente y cuenta para la meta/ranking como cualquier taller (salvo que el área decida excluirlo; parámetro futuro).

> **Decisión pendiente:** si el alcance es `EJECUTIVO` y el hospital está en la selección pero asignado a otro ejecutivo, ¿se permite? La propuesta es **no**; el ejecutivo debe pedir el cambio de dueño o usar el alcance superior.

## Fases

| Fase | Nombre | Qué contiene | Cómo se verifica |
|---|---|---|---|
| **0** | Validación | Consulta a `genContactosCat`; decisión 385 vs lista curada; revisión de regiones | Consulta ejecutada y decisión documentada |
| **1** | Base de datos | Script 0034: `tipo_gerencia`, regiones/estados, backfill, `alcance_hospital_extraordinario` | Script idempotente, `PARSEONLY`, conteos |
| **2** | Backend | `HospitalService` 385→IMSS Bienestar; `WorkflowService` id 3; filtros; extraordinario parametrizado | `dotnet test` |
| **3** | Frontend | Pantalla de revisión, filtros de tercera gerencia, selección/matriz | `npm run build`, `npm run lint` |
| **4** | Verificación | E2E con hospitales de las 3 gerencias; backfill; workflows | Prueba con datos reales |

## Validación contra la operación documentada

| Regla | Fuente documental (cita literal) | Cómo se implementa |
|---|---|---|
| La clasificación institucional ya existe | `lefarma.database/educacion-medica/0016_..._create-esquema-completo.lefarma.sql:1617-1619` — vista `vw_hospitales_clasificados` con `364=IMSS`, `385=Bienestar`, `370=ISSSTE` | Se reutiliza la vista; se agrega la gerencia IMSS Bienestar. |
| ISSSTE no es gerencia | `decisiones/00001_esquema-datos-educacion-medica.md:220` — *“ISSSTE NO es una gerencia — es un contacto institucional…”* | 370 se queda en Descentralizado; no se crea cuarta gerencia. |
| El hospital debe existir en el catálogo oficial | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-002 Base de Datos de Hospitales.md` — *“Formato para registrar la base de datos de hospitales del sistema público de salud que serán considerados para los Talleres Médicos en Hospitales.”* | El extraordinario sigue saliendo de un catálogo, no de texto libre; el alcance se parametriza. |
| Reagenda/reemplazo por imprevisto | `referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales.md` (nodo P2F) — *“EV: Notifica al GV para que reagende la visita para ofrecer el taller médico.”* | El taller no planificado cubre el imprevisto; se audita. |
| Agenda y hora | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — *“Las columnas S y D corresponden a Sábado y Domingo (días no laborables, sin registro de talleres).”* | El calendario sigue Lun–Vie. |

**Reglas de digitalización sin fuente en el papel** (interpretación/operación real):

- La tercera gerencia es una decisión organizacional del usuario (2026-10-23), no un dato de los instructivos.
- El mapeo 385 → IMSS Bienestar es una propuesta basada en la jerarquía de Asokam y la definición oficial; requiere validación con `genContactosCat`/CLUES.
- La pantalla de revisión y el override son decisiones de digitalización.
- El parámetro de alcance del extraordinario es una decisión de producto; el papel solo describe la reagenda.

## Consequences

**Positivas**

- IMSS Bienestar deja de mezclarse con Descentralizado; la selección, la matriz y los indicadores pueden segmentarse correctamente.
- El mapeo es revisable y no depende de una regla hardcodeada; las excepciones se corrigen en pantalla.
- El extraordinario se adapta a la operación sin recompilar: el área elige el alcance.
- La tercera gerencia usa el mismo motor de workflows; solo cambia el mapping.

**Negativas**

- Requiere backfill y revisión de datos; si 385 mezcla instituciones, el trabajo manual puede ser alto.
- Agrega un tercer juego de regiones/estados y variantes de workflow.
- La tercera gerencia afecta metas, matrices y reportes; hay que revisar los totales.
- El parámetro de extraordinario puede generar confusión si no se documenta el alcance en la UI.

**Neutras / seguimiento**

- El `tipo_gerencia` `Privado` se conserva; no se toca.
- La vista `vw_hospitales_clasificados.institucion` puede seguir diciendo “Bienestar”; la gerencia se llama “IMSS Bienestar” para evitar ambigüedad.
- Si en el futuro IMSS-Bienestar se integra completamente al régimen ordinario, el catálogo permite desactivar la gerencia sin romper datos históricos.

## Anexo — Fuentes

**Documentales (referencias del módulo):**

- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-002 Base de Datos de Hospitales.md` — catálogo oficial de hospitales.
- `referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales.md` — nodo P2F (reagenda).
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — agenda, días laborables.
- `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` — instituciones/gerencias y metas.

**Fuentes externas (definición oficial):**

- DOF, 31-08-2022 — decreto de creación de los Servicios de Salud del Instituto Mexicano del Seguro Social para el Bienestar (IMSS-Bienestar).
- `imssbienestar.gob.mx` — historia, operación y rede transferida.
- IMSS, comunicado 1-07-2025 — integración del Programa IMSS-Bienestar al Régimen Ordinario.

**Evidencia operativa (no son fuentes documentales formales):**

- `MODIFICADO CALENDARIO MENSUAL ESPECIALISTAS DE PRODUCTO 18102026.xlsx` — el calendario incluye instituciones como SSA, IMSS Bienestar, PEMEX e ISSSTE; confirma que la operación ya distingue instituciones.
- `PREVIO de MATRIZ SESIONES DESCENTRALIZADOS AGOSTO.PDF` — la matriz incluye la columna Institución con valores `SSA`, `IMSS Bienestar`, `PEMEX`, `CCINSHAE`.

**Planificación interna (no son fuentes documentales):**

- `reglas-negocio.md` §5.8 (clasificación por institución), §5.9 (zonas), §5.13 (extraordinarios) y §7.
- ADR-00001 (esquema, `tipo_gerencia`), ADR-00004 (regiones), ADR-00006 (workflows), ADR-00011 (extraordinarios), ADR-00015 (ruta por especialista), ADR-00018 (candado/solicitudes).
