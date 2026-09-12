# Rediseño final de la vista “Selección y reparto”

## Objetivo

Rediseñar la vista de detalle de **Selección y reparto** en:

`lefarma.frontend/src/apps/educacion-medica/pages/planificacion/SeleccionMensualPage.tsx`

La pantalla debe reducir redundancia entre regiones, hospitales y mapa, y hacer evidente la jerarquía de negocio:

**Región → Equipo de pareo → Hospitales**

La interfaz debe ayudar al usuario a responder rápidamente:

1. ¿Qué regiones existen?
2. ¿Cuántos hospitales tiene cada región?
3. ¿Qué equipo tiene asignada cada región?
4. ¿Qué hospitales pertenecen a cada región?
5. ¿Qué regiones tienen problemas?
6. ¿La agrupación tiene sentido geográficamente?
7. ¿Qué falta antes de autorizar?

No agregar información de capacidad consumida/total. La capacidad seguirá validándose únicamente desde backend al asignar equipo.

---

# 1. Decisión principal de UX

La **vista primaria será la lista de regiones**.

La tabla plana actual de hospitales deja de ser una sección independiente.

El mapa se conserva como **vista secundaria de apoyo geográfico**, sincronizada con las regiones.

La estructura conceptual de la pantalla será:

```text
Selección
   ↓
Regiones
   ↓
Equipo responsable
   ↓
Hospitales
```

No deben existir tres vistas independientes mostrando prácticamente la misma información.

---

# 2. Layout general

Conservar la estructura superior existente:

```text
Resumen de selección

Acciones principales

Avisos / advertencias

Contenido de reparto
```

Rediseñar únicamente la zona de:

- regiones;
- hospitales;
- mapa.

En desktop utilizar una distribución de dos columnas:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Resumen                                                             │
└─────────────────────────────────────────────────────────────────────┘

[ Recalcular regiones ]                 [ Autorizar selección ]

Avisos / advertencias

┌───────────────────────────────────────┬─────────────────────────────┐
│ REGIONES                              │ MAPA                        │
│                                       │                             │
│ lista vertical de regiones            │ mapa sticky                  │
│                                       │                             │
│ Región → equipo → hospitales          │ apoyo geográfico             │
│                                       │                             │
└───────────────────────────────────────┴─────────────────────────────┘
```

Proporción recomendada:

```text
Regiones: 60–65%
Mapa:     35–40%
```

El mapa debe permanecer visible mediante `sticky` mientras el usuario recorre las regiones.

Ejemplo:

```tsx
className="lg:sticky lg:top-4"
```

En mobile/tablet:

```text
Regiones
↓
Mapa
```

No usar grid de 2–3 cards por fila para las regiones.

---

# 3. Sustituir las cards actuales por una lista de regiones tipo Accordion

Eliminar el layout actual:

```tsx
md:grid-cols-2 xl:grid-cols-3
```

Las regiones tienen alturas variables dependiendo de la cantidad de hospitales, por lo que el grid genera ruido visual y dificulta comparar regiones.

Usar una lista vertical mediante `Accordion`, `Collapsible` o equivalente de shadcn/ui.

Ejemplo visual:

```text
▼ CDMX NORTE                    6 hospitales
  Juan Pérez + Ana López

▶ CDMX CENTRO                   8 hospitales
  Pedro García + Laura Díaz

▶ TOLUCA                        3 hospitales   < 4 hospitales
  Sin equipo

▶ PUEBLA                        5 hospitales
  Luis Torres + María Ruiz
```

Cada región debe poder entenderse sin necesidad de expandirla.

---

# 4. Header de cada región

El encabezado de cada región debe mostrar:

```text
Nombre de región

Cantidad de hospitales

Equipo asignado / Sin equipo

Badge < 4 hospitales, cuando corresponda
```

Ejemplo:

```text
CDMX NORTE
6 hospitales
Juan Pérez + Ana López
```

Con advertencia:

```text
TOLUCA

3 hospitales        [ < 4 hospitales ]

Sin equipo
```

El nombre de equipo debe usar siempre:

```text
{nombreEjecutivo} + {nombreEspecialista}
```

Si no existe equipo:

```text
Sin equipo
```

No mostrar el algoritmo como información principal.

---

# 5. Contenido de una región expandida

Cuando la región se expanda debe mostrar:

```text
Equipo responsable

Hospitales

Acciones secundarias
```

Ejemplo:

```text
┌──────────────────────────────────────────────────────────────┐
│ CDMX NORTE                                     6 hospitales  │
│                                                              │
│ Equipo responsable                                           │
│ [ Juan Pérez + Ana López                               ▾ ]   │
│                                                              │
│ Hospital                   Ubicación        Score     Origen  │
│ Hospital ABC               CDMX               92      Sug.    │
│ Hospital DEF               CDMX               87      Sug.    │
│ Hospital GHI               Naucalpan           74      Manual  │
│ Hospital JKL               Tlalnepantla        69      Sug.    │
│                                                              │
│ Algoritmo: haversine-clustering                              │
│                                                              │
│ [ Dividir región ]                                           │
└──────────────────────────────────────────────────────────────┘
```

---

# 6. Integrar los hospitales dentro de la región

Eliminar la sección independiente:

```text
Hospitales de la selección (N)
```

La tabla plana actual deja de ser la interfaz principal.

Los hospitales deben mostrarse dentro de la región correspondiente.

Cada fila de hospital debe contener como máximo:

```text
Hospital

Entidad / Ciudad o Municipio

Score

Origen

Eliminar
```

No mostrar columna `Región`, porque el hospital ya está dentro de su región.

Ejemplo:

```text
Hospital                    Ubicación             Score    Origen        Acción

Hospital ABC                CDMX                     92    Sugerencia       🗑
Hospital DEF                CDMX                     84    Sugerencia       🗑
Hospital XYZ                Ecatepec                 71    Manual           🗑
```

Puede implementarse como tabla compacta, filas flexibles o una pequeña `DataTable`.

No se requiere:

- filtros;
- buscador;
- paginación;
- agrupamiento adicional.

---

# 7. Mover la acción “Eliminar hospital”

Actualmente eliminar un hospital únicamente existe en la tabla independiente.

Mover esta acción a la lista de hospitales dentro de cada región.

El botón mantiene:

```tsx
variant="ghost"
```

con icono `Trash`.

Debe respetar:

```tsx
disabled={!editable}
```

No agregar confirmación si actualmente la acción funciona sin confirmación.

Cuando al eliminar el último hospital el backend elimine la región, simplemente refrescar el estado correspondiente.

---

# 8. Select de equipo

El equipo responsable es una propiedad fundamental de la región.

Debe mostrarse dentro de la región expandida y estar visualmente cerca del encabezado.

Formato:

```text
Equipo responsable

[ Ejecutivo + Especialista ▼ ]
```

Opciones:

```text
Sin equipo
Ejecutivo A + Especialista A
Ejecutivo B + Especialista B
...
```

El `Select` solo debe estar habilitado cuando:

```tsx
editable === true
```

La capacidad del equipo continúa siendo responsabilidad del backend.

Si backend rechaza la asignación por capacidad, mostrar el error directamente debajo del `Select` de esa región.

Ejemplo:

```text
[ Juan Pérez + Ana López ▼ ]

⚠ El equipo no cuenta con capacidad suficiente.
  Déficit: 2 visitas.
```

No mostrar capacidad consumida/total.

---

# 9. Algoritmo de la región

Información como:

```text
region-catalogo
haversine-clustering
```

es secundaria.

No debe competir visualmente con:

- nombre;
- hospital count;
- equipo;
- advertencias.

Mostrarla al final del contenido expandido con estilo discreto:

```text
Algoritmo: haversine-clustering
```

usando, por ejemplo:

```tsx
text-xs text-muted-foreground
```

---

# 10. Acción “Dividir región”

Mantener la funcionalidad existente.

Debe aparecer únicamente dentro de una región expandida.

Ubicarla al final del contenido:

```text
[ Dividir región ]
```

Estilo:

```tsx
variant="outline"
```

Debe respetar:

```tsx
disabled={!editable}
```

Mantener el modal actual con motivo obligatorio.

No colocar esta acción en el header principal de la región para evitar ruido visual.

---

# 11. Hospitales “Sin región”

No tratar “Sin región” como una región normal.

Crear una sección especial de advertencia dentro de la lista de regiones.

Ejemplo:

```text
┌─────────────────────────────────────────────────────┐
│ ⚠ Hospitales sin región                         2   │
│                                                     │
│ Hospital ABC                                        │
│ Hospital XYZ                                        │
│                                                     │
│ Estos hospitales todavía no pertenecen a ninguna   │
│ región.                                             │
│                                                     │
│ [ Recalcular regiones ]                             │
└─────────────────────────────────────────────────────┘
```

No mostrar:

```text
Equipo responsable
Dividir región
Algoritmo
```

porque todavía no existe una región sobre la cual aplicar esas acciones.

Mostrar únicamente:

- cantidad;
- hospitales;
- explicación;
- CTA `Recalcular regiones`.

El CTA debe respetar las mismas restricciones de edición.

---

# 12. Resumen del estado del reparto

Encima de la lista de regiones agregar una línea compacta de resumen.

Ejemplo:

```text
7 regiones · 38 hospitales · 6 con equipo asignado · 1 advertencia · 2 sin región
```

No usar cuatro o cinco cards KPI independientes.

Debe ser un resumen compacto para ayudar a evaluar rápidamente la completitud del reparto.

Valores calculables completamente desde:

```ts
detalle.regiones
detalle.hospitales
```

---

# 13. Mapa

Mantener `HospitalesMap.tsx`.

El mapa deja de ser una sección final independiente después de toda la información.

Debe aparecer al lado de las regiones en desktop.

El mapa sigue mostrando:

```text
Círculos = hospitales

Cuadrados = centroides
```

Mantener las coordenadas snapshot existentes:

```ts
latitudSnapshot
longitudSnapshot
```

y centroides:

```ts
centroLatitud
centroLongitud
```

---

# 14. Sincronización regiones ↔ mapa

Agregar interacción únicamente del lado del frontend.

No requiere cambios de backend.

Mantener estado local similar a:

```ts
selectedRegionId
hoveredRegionId
hoveredHospitalId
```

## Hover sobre región

Al hacer hover sobre una región:

```text
región
  ↓
resaltar hospitales de esa región en mapa
  ↓
reducir visualmente el protagonismo de las demás regiones
```

No ejecutar zoom automático con hover.

---

## Expandir / seleccionar región

Al abrir una región:

```text
región expandida
  ↓
región activa en mapa
```

Opcionalmente ejecutar `fitBounds()` con los hospitales de esa región.

El zoom debe ocurrir únicamente por acción deliberada del usuario, no continuamente durante hover.

---

## Hover sobre hospital

Al hacer hover sobre una fila:

```text
Hospital ABC
     ↓
resaltar su círculo correspondiente
```

---

## Click en hospital del mapa

Si la implementación actual del mapa permite eventos:

```text
click marker
     ↓
seleccionar región
     ↓
expandir región
     ↓
resaltar hospital
```

Si esto implica una refactorización desproporcionada de Leaflet, puede dejarse como mejora posterior.

Prioridad:

1. Región → mapa.
2. Hospital → mapa.
3. Mapa → región.

---

# 15. Leyenda del mapa

Simplificar la leyenda actual.

Usar:

```text
● Hospitales
■ Centro de región
```

No es necesario mantener el texto largo:

```text
Círculos: hospitales (coordenadas congeladas al agregarlos)...
```

La información de “coordenadas congeladas” es una consideración técnica, no una instrucción útil para el usuario final.

Si existe necesidad funcional de comunicarlo, moverla a tooltip o ayuda secundaria.

---

# 16. Estados de edición

Respetar completamente:

```ts
editable =
  estado === "Borrador" ||
  estado === "EnRevision"
```

Cuando `editable === false`:

deshabilitar:

- Select de equipo;
- Trash de hospital;
- Dividir región;
- Recalcular regiones;
- cualquier nueva acción de modificación.

La navegación, Accordion y mapa deben continuar funcionando.

---

# 17. Advertencia de mínimo de hospitales

La regla:

```text
mínimo 4 hospitales por región en viaje foráneo
```

continúa siendo informativa y no bloqueante.

Mostrar badge:

```text
< 4 hospitales
```

solo cuando:

```ts
advertenciaMinimo === true
```

No recalcular esta regla en frontend si backend ya devuelve `advertenciaMinimo`.

---

# 18. Comportamiento del Accordion

Por defecto:

- todas las regiones colapsadas;
- opcionalmente abrir automáticamente la primera región con problema.

Ejemplo de prioridad para expansión inicial:

```text
1. Región sin equipo.
2. Región con advertencia.
3. Primera región.
```

No expandir todas las regiones inicialmente.

Debe permitirse tener una o varias abiertas, según lo que simplifique la implementación.

No es obligatorio limitar el Accordion a una sola región.

---

# 19. Orden recomendado de las regiones

Mantener un orden estable.

Preferentemente:

```text
1. Regiones con problemas.
2. Regiones sin equipo.
3. Regiones completas.
```

Si cambiar el orden pudiera sorprender al usuario porque backend ya devuelve un orden determinado, conservar el orden original y comunicar los problemas únicamente mediante badges.

No introducir sorting complejo innecesario.

---

# 20. Flujo visual final

La página debe terminar conceptualmente así:

```text
┌─────────────────────────────────────────────────────────────┐
│ RESUMEN DE SELECCIÓN                                        │
│ 38 hospitales · Septiembre 2026 · En revisión              │
└─────────────────────────────────────────────────────────────┘

[ Recalcular regiones ]                 [ Autorizar selección ]

⚠ TOLUCA tiene menos de 4 hospitales
⚠ Existen 2 hospitales sin región

7 regiones · 38 hospitales · 6 con equipo · 1 advertencia

┌───────────────────────────────────────┬──────────────────────┐
│ REGIONES                              │ MAPA                 │
│                                       │                      │
│ ▼ CDMX NORTE            6 hospitales │     ○ ○              │
│   Juan Pérez + Ana López              │   ○  ■ ○             │
│                                       │                      │
│   Equipo responsable                  │                      │
│   [ Juan + Ana ▼ ]                    │                      │
│                                       │                      │
│   Hospital ABC       92 Sug.     🗑   │                      │
│   Hospital DEF       84 Sug.     🗑   │                      │
│   Hospital XYZ       71 Manual   🗑   │                      │
│                                       │                      │
│   Algoritmo: region-catalogo          │                      │
│   [ Dividir región ]                  │                      │
│                                       │                      │
│ ▶ CDMX CENTRO           8 hospitales │                      │
│   Pedro + Laura                       │                      │
│                                       │                      │
│ ▶ TOLUCA                3 hospitales │                      │
│   ⚠ < 4 hospitales                    │                      │
│   Sin equipo                          │                      │
│                                       │                      │
│ ⚠ SIN REGIÓN             2 hospitales│                      │
│   Hospital A                          │                      │
│   Hospital B                          │                      │
│   [ Recalcular regiones ]             │                      │
└───────────────────────────────────────┴──────────────────────┘
```

---

# 21. Qué se elimina

Eliminar como elementos independientes:

### Grid de cards de regiones

Reemplazarlo por:

```text
lista vertical / Accordion
```

### Tabla plana de todos los hospitales

Eliminar la sección:

```text
Hospitales de la selección (N)
```

Sus datos pasan dentro de cada región.

### Lista `<ul>` de hospitales dentro de cada card

Sustituirla por filas de hospital más completas, integrando:

```text
Hospital
Ubicación
Score
Origen
Trash
```

---

# 22. Qué se conserva

Conservar:

- terminología `Región`;
- `Recalcular regiones`;
- asignación mediante Select;
- validación de capacidad desde backend;
- `Dividir región`;
- modal de motivo obligatorio;
- `advertenciaMinimo`;
- `scoreSugerencia`;
- `origen`;
- eliminar hospital;
- mapa Leaflet;
- centroides;
- snapshot de coordenadas;
- estados `Borrador` / `EnRevision`;
- doble firma y autorización existentes.

---

# 23. Qué se modifica

Modificar:

```text
Cards
↓
Accordion de regiones
```

```text
Tabla global
↓
Hospitales dentro de cada región
```

```text
Mapa al final
↓
Mapa lateral sticky
```

```text
Tres vistas independientes
↓
Una vista principal + mapa complementario
```

---

# 24. Componentización recomendada

Evitar que `SeleccionMensualPage.tsx` crezca demasiado.

Extraer componentes cuando sea razonable.

Ejemplo:

```text
SeleccionMensualPage.tsx

components/
  RegionesPanel.tsx
  RegionAccordionItem.tsx
  RegionHospitalRow.tsx
  SinRegionPanel.tsx
  RepartoSummary.tsx
  HospitalesMap.tsx
```

No es obligatorio utilizar exactamente estos nombres.

La lógica de requests y estado principal puede permanecer en `SeleccionMensualPage.tsx`.

---

# 25. Datos disponibles

No hacer cambios de backend.

Usar únicamente:

```ts
detalle.hospitales[]
```

```ts
{
  idSeleccionHospital,
  idHospital,
  nombreHospital,
  entidadFederativa,
  ciudadMunicipio,
  idRegion,
  nombreRegion,
  scoreSugerencia,
  origen,
  latitudSnapshot,
  longitudSnapshot
}
```

```ts
detalle.regiones[]
```

```ts
{
  idRegion,
  nombre,
  centroLatitud,
  centroLongitud,
  cantidadHospitales,
  idEquipo,
  nombreEquipo,
  advertenciaMinimo,
  algoritmo
}
```

```ts
equipos[]
```

```ts
{
  idEquipo,
  nombreEjecutivo,
  nombreEspecialista
}
```

Agrupar hospitales client-side:

```ts
const hospitalesPorRegion = ...
```

usando:

```ts
hospital.idRegion
```

---

# 26. Criterios de aceptación

El rediseño se considera correcto si:

1. Ya no existe una tabla global duplicando los hospitales.

2. Cada hospital aparece dentro de su región.

3. La relación:

```text
Región → Equipo → Hospitales
```

se entiende visualmente sin tener que cruzar distintas secciones.

4. El usuario puede cambiar el equipo desde la propia región.

5. El usuario puede eliminar un hospital desde su propia región.

6. Se conserva la advertencia `< 4 hospitales`.

7. `Sin región` se presenta como un estado problemático y accionable.

8. El mapa permanece visible mientras se recorren las regiones en desktop.

9. Al seleccionar o interactuar con una región, el mapa puede identificar visualmente esa región.

10. No se requiere ningún cambio de backend.

11. Todas las acciones de modificación respetan `editable`.

12. La vista ocupa considerablemente menos scroll vertical que la implementación actual.

13. La información secundaria como `algoritmo` no domina visualmente la región.

14. El mapa es una ayuda geográfica y no una tercera representación independiente de la misma información.

15. La interfaz continúa funcionando correctamente aunque:

```text
una región tenga 1 hospital;
una región tenga muchos hospitales;
no haya equipo asignado;
haya hospitales sin región;
un hospital no tenga coordenadas;
la selección no sea editable.
```

---

# Principio de diseño a seguir

No diseñar esta pantalla como:

```text
Regiones

+

Hospitales

+

Mapa
```

Diseñarla como una sola herramienta de reparto:

```text
REGIÓN
   │
   ├── EQUIPO
   │
   └── HOSPITALES
          │
          └── representación geográfica en MAPA
```

El usuario debe trabajar principalmente desde las regiones.

El mapa debe ayudarle a validar visualmente las agrupaciones.

Los hospitales deben formar parte de su región y no vivir en una segunda representación global de la información.

Implementar el rediseño priorizando claridad, densidad de información y continuidad del flujo de trabajo sobre decoración visual.