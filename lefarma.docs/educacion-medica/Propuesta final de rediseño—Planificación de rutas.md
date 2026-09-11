# Rediseño final — Página “Planificación de rutas”

## Archivo principal

`lefarma.frontend/src/apps/educacion-medica/pages/planificacion/RutasPage.tsx`

Stack:

- React 19
- Vite + TypeScript
- Tailwind
- shadcn/ui sobre Radix
- lucide-react
- sonner
- Leaflet mediante `HospitalesMap.tsx`

No agregar nuevas librerías.

No modificar backend ni contratos de API.

`npm run build` debe continuar correctamente.

---

# 1. Objetivo del rediseño

La pantalla debe funcionar como una **mesa de trabajo para calendarizar visitas**, no como una colección de cards de rutas.

La Selección Mensual ya resolvió:

```text
Hospital → Región → Equipo
```

En esta pantalla únicamente se debe resolver:

```text
Equipo → Día → Orden de visitas
```

El principio de negocio debe mantenerse visible:

> El sistema propone, el humano dispone.

La propuesta generada por el sistema siempre debe percibirse como un **draft editable**, nunca como una planificación definitiva hasta que el usuario confirme las rutas.

---

# 2. Jerarquía principal de la pantalla

La pantalla debe organizarse conceptualmente así:

```text
Selección autorizada
        ↓
Versión de planificación
        ↓
Equipo
        ↓
Semana
        ↓
Día
        ↓
Visitas
```

La vista primaria será:

**Equipo seleccionado → calendario de visitas**

No mostrar todas las rutas simultáneamente en un grid.

Eliminar como estructura principal:

```tsx
xl:grid-cols-2
```

de cards independientes por ruta.

---

# 3. Layout general

Usar esta estructura vertical:

```text
Breadcrumb / regreso

Header de planificación

Resumen global

Acciones principales

Avisos

Workspace maestro–detalle
```

Wireframe general:

```text
← Selección y reparto

PLANIFICACIÓN DE RUTAS                           [ DRAFT ]

Gerencia Centro · Vigencia 15 sep – 30 oct
Versión [ V3 · Draft ▾ ]

4 equipos · 27/31 planificadas · 4 sin planificar · 2 advertencias

[ Regenerar propuesta ]                         [ Confirmar rutas ]

⚠ Avisos de planificación

┌──────────────────────┬──────────────────────────────────────────────┐
│ EQUIPOS              │ CALENDARIO DEL EQUIPO                       │
│                      │                                              │
│ Equipo Norte         │ Equipo Norte                                 │
│ Equipo Centro        │ Juan Pérez + Ana López                       │
│ Equipo Sur           │                                              │
│ ...                  │ Sin planificar                               │
│                      │                                              │
│                      │ Semana 36                                    │
│                      │   Lunes                                      │
│                      │   Martes                                     │
│                      │   Miércoles                                  │
└──────────────────────┴──────────────────────────────────────────────┘
```

En desktop:

```text
Panel equipos: 280–320px
Calendario: resto del ancho
```

Ejemplo Tailwind:

```tsx
grid-cols-[300px_minmax(0,1fr)]
```

En pantallas pequeñas:

```text
Equipo activo
↓
Selector/lista de equipos
↓
Calendario
```

No intentar mantener dos columnas en mobile.

---

# 4. Encabezado

Reducir considerablemente el espacio usado actualmente.

Debe contener:

- breadcrumb para volver a Selección y reparto;
- título `Planificación de rutas`;
- estado de la versión;
- gerencia;
- vigencia;
- selector de versión.

Ejemplo:

```text
← Volver a Selección y reparto

Planificación de rutas                            [ DRAFT ]

Gerencia Centro · 15 sep – 30 oct
Versión [ V3 · Draft ▾ ]
```

No repetir información innecesariamente.

---

# 5. Selector de versiones

Eliminar el `<select>` HTML nativo.

Usar `Select` de shadcn/ui.

Las opciones deben mostrar tanto versión como estado:

```text
V3 · Draft
V2 · Archivada
V1 · Archivada
```

No usar únicamente:

```text
Versión 1
Versión 2
Versión 3
```

porque el usuario necesita saber inmediatamente si una versión puede editarse.

Al seleccionar una versión archivada mostrar cerca del selector:

```text
ⓘ Estás viendo una versión archivada. Esta versión es de solo lectura.
```

---

# 6. Estados de edición

Mantener la regla existente:

```ts
editable =
  ruta.estado === "Draft" &&
  seleccion.estado === "Autorizada"
```

Cuando no sea editable:

deshabilitar:

- drag & drop;
- agregar visita;
- quitar visita;
- regenerar si no corresponde;
- cualquier modificación del calendario.

La navegación entre:

- equipos;
- semanas;
- días;
- versiones;
- mapa;

debe seguir funcionando.

---

# 7. Resumen global

Debajo del encabezado mostrar una línea compacta de estado.

Ejemplo:

```text
4 equipos · 27/31 visitas planificadas · 4 sin planificar · 2 advertencias
```

No usar cards KPI grandes.

El objetivo es responder rápidamente:

> ¿Qué tan completa está la planificación?

Usar información ya disponible en frontend.

---

# 8. Acciones principales

Evitar una fila de botones donde todos tengan la misma importancia.

En `Draft`:

```text
[ Regenerar propuesta ]                   [ Confirmar rutas ]
```

`Confirmar rutas` debe ser el único CTA visualmente dominante.

Usar:

```tsx
variant="default"
```

para confirmar.

Usar:

```tsx
variant="outline"
```

para regenerar.

En una versión Confirmada:

```text
[ Solicitar cambio ]
```

No mostrar controles de modificación.

---

# 9. Panel maestro de equipos

La columna izquierda representa los equipos.

No usar cards grandes independientes.

Usar una lista compacta seleccionable.

Ejemplo:

```text
EQUIPOS                                      4

[ Buscar equipo... ]

▌ Equipo Norte
   Juan Pérez + Ana López

   6 visitas
   Semana 6/8
   Foráneos 1/3

Equipo Centro
Pedro García + Laura Díaz

8 visitas
Semana 8/8
Foráneos 3/3

Equipo Sur
Luis + Andrea

7 visitas
Semana 7/8
Foráneos 4/3 ⚠
```

La selección activa debe usar:

- fondo `primary/5`;
- borde izquierdo `primary`;
- nombre del equipo en `primary`.

No pintar toda la fila en azul sólido.

---

# 10. Información del equipo seleccionado

Al seleccionar un equipo, el panel derecho debe comenzar con:

```text
Equipo Norte

Juan Pérez + Ana López

6 visitas planificadas · 2 sin planificar · 1/3 viajes foráneos
```

No repetir demasiados badges.

Usar texto compacto y badges únicamente donde agreguen información semántica.

---

# 11. Capacidad por equipo

Los límites deben continuar obteniéndose desde:

```ts
parametrosModulo.getAll()
```

Mantener defaults actuales:

```text
max_visitas_dia = 3
max_visitas_semana = 8
viajes_foraneos_mes = 3
```

No hardcodear los límites dentro de los componentes visuales.

---

# 12. Semáforo de capacidad

Mostrar capacidad en tres niveles:

```text
Normal
Lleno
Excedido
```

Ejemplo diario:

```text
2 / 3
3 / 3 · Lleno
4 / 3 · Excedido
```

Ejemplo semanal:

```text
Semana 36                         6 / 8
Semana 37                         8 / 8 · Lleno
Semana 38                         9 / 8 · Excedido
```

Regla visual:

```text
normal    → neutral / positivo discreto
lleno     → ámbar
excedido  → rojo
```

No usar rojo para una capacidad exactamente completa.

`3/3` es válido.

`4/3` es problema.

---

# 13. Calendario como vista principal

El calendario será la parte dominante de la pantalla.

Usar la semana como agrupador y el día como unidad de trabajo.

Ejemplo:

```text
SEMANA 36                                      6 / 8

LUN 03 SEP                                     3 / 3 · Lleno
──────────────────────────────────────────────────────────────

⋮⋮   1   Hospital ABC
         Ciudad de México                      Foráneo

⋮⋮   2   Hospital DEF
         Naucalpan

⋮⋮   3   Hospital GHI
         Tlalnepantla


MAR 04 SEP                                     2 / 3
──────────────────────────────────────────────────────────────

⋮⋮   1   Hospital JKL
         Toluca

⋮⋮   2   Hospital MNO
         Metepec


MIÉ 05 SEP                                     0 / 3
──────────────────────────────────────────────────────────────

               Arrastra una visita aquí
```

Evitar demasiados bordes anidados.

La semana debe sentirse como agrupación visual, no como una Card grande conteniendo otras cards.

---

# 14. Cards / filas de visita

Cada visita debe tener una representación compacta.

Ejemplo:

```text
⋮⋮   2

Hospital General X
Toluca

[ Foráneo ]
```

Debe mostrar como mínimo:

- handle visual de drag;
- orden;
- hospital;
- ubicación si está disponible;
- badge `Foráneo` cuando corresponda.

Evitar información redundante del equipo o región dentro de cada visita si ya está implícita por el contexto.

---

# 15. Drag & drop

Mantener HTML5 Drag & Drop existente.

No agregar librerías nuevas.

Agregar feedback visual claro.

## Visita arrastrándose

Mientras una visita está siendo arrastrada:

```text
opacity reducida en origen
cursor grabbing
shadow en elemento arrastrado
```

Ejemplo:

```tsx
opacity-40
cursor-grabbing
```

---

# 16. Drop target

El día debe convertirse claramente en la zona de destino.

Al pasar sobre un día válido:

```text
┌──────────────────────────────────────────────┐
│ MAR 04 SEP                         2 / 3      │
│                                              │
│        Suelta aquí para mover la visita      │
│                                              │
└──────────────────────────────────────────────┘
```

Estilo sugerido:

```tsx
border-primary
bg-primary/5
ring-1
ring-primary/20
```

No resaltar toda la semana.

Solo el día actualmente candidato a recibir la visita.

---

# 17. Ghost y movimiento

No intentar implementar animaciones complejas tipo Trello.

Con HTML5 nativo basta con:

- opacidad del origen;
- cursor;
- destino resaltado;
- actualización posterior a respuesta backend;
- toast existente para éxito/error.

Priorizar robustez.

---

# 18. Hospitales sin planificar

Agregar una sección:

```text
Sin planificar
```

No utilizar la palabra `pool` en la interfaz.

Puede vivir al inicio del detalle del equipo.

Ejemplo:

```text
▼ Sin planificar                                      2

⋮⋮ Hospital ABC
    CDMX · Región Norte

⋮⋮ Hospital XYZ
    Naucalpan · Región Norte
```

Los hospitales deben ser arrastrables hacia un día cuando `editable === true`.

Usar:

```ts
agregarVisita({
  idSeleccionHospital,
  fechaVisita,
  orden
})
```

con el contrato existente.

---

# 19. “Quitar” visita

Cambiar el copy visual actual:

```text
Quitar
```

por:

```text
Mover a Sin planificar
```

o equivalente mediante icono + tooltip.

La acción no debe parecer una eliminación definitiva del hospital.

El usuario debe entender que:

```text
Calendario
   ↓
Sin planificar
```

El hospital continúa perteneciendo a la selección.

---

# 20. Relación calendario ↔ Sin planificar

La interacción mental debe ser:

```text
SIN PLANIFICAR
      ↕
     DÍA
      ↕
 OTRO DÍA
```

Esto convierte la pantalla en una herramienta consistente de reorganización.

---

# 21. Errores al agregar visita

Cuando backend rechace:

- cruce región → equipo;
- hospital sin región;
- hospital sin equipo;
- capacidad;
- cualquier otra regla;

mantener el toast existente.

Además, cuando el error corresponde a un hospital dentro de `Sin planificar`, mostrar el mensaje inline debajo del hospital.

Ejemplo:

```text
Hospital ABC
CDMX · Sin región

⚠ Este hospital no tiene una región asignada.

[ Ir a Selección y reparto ]
```

---

# 22. Avisos

Reemplazar la card de párrafos:

```text
⚠ mensaje
⚠ mensaje
⚠ mensaje
```

por componentes `Alert` consistentes.

Separar visualmente tres categorías.

## Acción requerida

```text
⚠ 2 hospitales no tienen equipo o región.

No pueden planificarse correctamente.

[ Ir a Selección y reparto ]
```

## Advertencia

```text
⚠ Equipo Norte supera el máximo mensual de viajes foráneos: 4/3.
```

## Información

```text
ⓘ Estás viendo una versión archivada.
```

No pintar todos los avisos como destructive.

---

# 23. Avisos accionables

Cuando un aviso esté relacionado con:

- falta de región;
- falta de equipo;

mostrar:

```text
[ Ir a Selección y reparto ]
```

El usuario no debe quedarse en una pantalla desde la cual no puede resolver el problema.

---

# 24. Estado vacío

No utilizar únicamente:

```text
No hay rutas.
```

Mostrar:

```text
No hay una propuesta de rutas para esta selección.

La selección está autorizada y contiene 28 hospitales.
Genera una propuesta inicial para comenzar a calendarizar las visitas.

[ Generar propuesta ]
```

Cuando exista un bloqueo:

```text
No se puede generar la propuesta.

3 hospitales no tienen región o equipo asignado.

[ Ir a Selección y reparto ]
```

El estado vacío siempre debe comunicar:

```text
qué ocurre
↓
por qué
↓
qué hacer
```

---

# 25. Mapa

No mostrar un mapa fijo como tercera columna.

La tarea principal de esta pantalla es temporal, no geográfica.

El mapa debe ser contextual al día.

Agregar en el header de un día con visitas:

```text
LUN 03 SEP                    3 / 3        [ Ver mapa ]
```

Al pulsar:

- abrir `Sheet`;
- o `Dialog` ancho;
- o panel expandible.

Reutilizar:

```text
HospitalesMap.tsx
```

Mostrar únicamente los hospitales correspondientes al día seleccionado cuando sea posible con la implementación existente.

No alterar backend.

---

# 26. Propósito del mapa

El mapa debe responder:

> ¿Tiene sentido el recorrido de este día?

No:

> ¿Dónde están todos los hospitales de toda la selección?

La segunda pregunta ya corresponde más a Selección y reparto.

---

# 27. Orden de visitas

Mostrar siempre el orden explícitamente:

```text
1
2
3
```

Cuando se mueva una visita a otro día con la lógica actual:

```text
orden = último
```

Mantener ese comportamiento.

No implementar reordenamiento interno sofisticado si actualmente no existe API/soporte suficiente.

---

# 28. Foráneos

Mostrar `Foráneo` como badge únicamente en las visitas donde:

```ts
esForanea === true
```

Mantener también contador mensual por equipo:

```text
Viajes foráneos 2 / 3
```

Si excede:

```text
Viajes foráneos 4 / 3 ⚠
```

El contador debe ser visible tanto en:

- panel del equipo;
- encabezado del detalle seleccionado.

No repetirlo dentro de cada sección semanal.

---

# 29. Helpers existentes

Reutilizar:

```ts
semanaIso
contarViajesForaneos
agruparPorDia
```

No reimplementar estas reglas innecesariamente.

---

# 30. Componentización recomendada

Evitar que `RutasPage.tsx` se convierta en un componente monolítico.

Separar, si resulta razonable, en componentes similares a:

```text
RutasPage.tsx

components/
  RutasHeader.tsx
  EquiposPanel.tsx
  EquipoResumen.tsx
  SemanaRuta.tsx
  DiaRuta.tsx
  VisitaRutaItem.tsx
  SinPlanificarPanel.tsx
  RutasAlerts.tsx
  RutaDiaMapModal.tsx
```

Los nombres son sugeridos.

No es obligatorio respetarlos exactamente.

Mantener requests y estado global en `RutasPage.tsx` si simplifica la arquitectura.

---

# 31. Estados visuales del equipo

El panel izquierdo debe permitir detectar problemas sin entrar a cada equipo.

Ejemplo normal:

```text
Equipo Norte
6 visitas · Semana 6/8 · Foráneos 1/3
```

Ejemplo lleno:

```text
Equipo Centro
8 visitas · Semana 8/8 · Foráneos 3/3
```

Ejemplo problemático:

```text
Equipo Sur
9 visitas · Semana 9/8 · Foráneos 4/3 ⚠
```

Usar rojo únicamente en las métricas excedidas.

No pintar todo el equipo en rojo.

---

# 32. No abusar de badges

No convertir cada número o label en badge.

Prioridad visual:

```text
Nombre
↓
Carga
↓
Problemas
```

Usar badges principalmente para:

- Draft;
- Confirmada;
- Archivada;
- Foráneo;
- Lleno;
- Excedido;
- avisos relevantes.

---

# 33. Vista Confirmada

Cuando la versión esté Confirmada:

```text
Planificación de rutas                      [ CONFIRMADA ]

Gerencia Centro · ...
Versión [ V3 · Confirmada ▾ ]

[ Solicitar cambio ]
```

El calendario sigue visible.

No mostrar affordances falsas de edición:

- no handles activos;
- no drop zones;
- no botones para mover;
- no eliminar/agregar.

Debe sentirse claramente de solo lectura.

---

# 34. Vista Archivada

Cuando esté Archivada:

```text
Planificación de rutas                      [ ARCHIVADA ]

ⓘ Estás viendo una versión histórica.
```

Todo en modo lectura.

El selector de versiones permanece disponible.

---

# 35. Flujo esperado del usuario

La interfaz debe acompañar este flujo:

```text
1. Selecciona versión.
2. Revisa resumen global.
3. Detecta equipos con problemas.
4. Selecciona un equipo.
5. Revisa hospitales sin planificar.
6. Revisa semana y carga.
7. Mueve visitas entre días.
8. Agrega hospitales sin planificar.
9. Revisa mapa si necesita validar recorrido.
10. Corrige advertencias.
11. Confirma rutas.
```

---

# 36. Wireframe final

```text
← Selección y reparto

PLANIFICACIÓN DE RUTAS                               [ DRAFT ]

Gerencia Centro · 15 sep – 30 oct
Versión [ V3 · Draft ▾ ]

4 equipos · 27/31 planificadas · 4 sin planificar · 2 advertencias

[ Regenerar propuesta ]                         [ Confirmar rutas ]

⚠ 2 hospitales requieren atención
  Falta región o equipo.                    [ Ir a Selección y reparto ]


┌──────────────────────┬──────────────────────────────────────────────┐
│ EQUIPOS              │ EQUIPO NORTE                                 │
│                      │ Juan Pérez + Ana López                       │
│ [ Buscar equipo... ] │                                              │
│                      │ 6 planificadas · 2 sin planificar            │
│ ▌Equipo Norte        │ Semana actual 6/8 · Foráneos 1/3            │
│ Juan + Ana           │                                              │
│ 6 visitas            │ ▼ SIN PLANIFICAR                         2   │
│ Semana 6/8           │                                              │
│ Foráneos 1/3         │ ⋮⋮ Hospital X                               │
│                      │     CDMX · Región Norte                      │
│ Equipo Centro        │                                              │
│ Pedro + Laura        │ ⋮⋮ Hospital Y                               │
│ 8 visitas            │     Naucalpan · Región Norte                │
│ Semana 8/8           │                                              │
│ Foráneos 3/3         │                                              │
│                      │ SEMANA 36                             6 / 8   │
│ Equipo Sur           │                                              │
│ Luis + Sofía         │ LUN 03 SEP                     3 / 3 · Lleno│
│ Semana 9/8 ⚠         │ ─────────────────────────────────────────── │
│ Foráneos 4/3 ⚠       │ ⋮⋮ 1  Hospital A                 Foráneo   │
│                      │        Ciudad de México                      │
│                      │                                              │
│                      │ ⋮⋮ 2  Hospital B                            │
│                      │        Naucalpan                             │
│                      │                                              │
│                      │ ⋮⋮ 3  Hospital C                            │
│                      │        Tlalnepantla                          │
│                      │                                  [ Ver mapa ]│
│                      │                                              │
│                      │ MAR 04 SEP                          2 / 3     │
│                      │ ─────────────────────────────────────────── │
│                      │ ⋮⋮ 1  Hospital D                            │
│                      │ ⋮⋮ 2  Hospital E                            │
│                      │                                              │
│                      │ MIÉ 05 SEP                          0 / 3     │
│                      │ ─────────────────────────────────────────── │
│                      │                                              │
│                      │        Arrastra una visita aquí              │
└──────────────────────┴──────────────────────────────────────────────┘
```

---

# 37. Qué eliminar de la implementación visual actual

Eliminar como diseño principal:

### Grid de cards por ruta

```tsx
xl:grid-cols-2
```

Reemplazar por:

```text
panel maestro de equipos
+
detalle del equipo seleccionado
```

### `<select>` nativo de versiones

Reemplazar por:

```text
Select de shadcn/ui
```

### Texto “Quitar”

Reemplazar visualmente por:

```text
Mover a Sin planificar
```

### Avisos como párrafos sueltos

Reemplazar por:

```text
Alert semánticos y accionables
```

### Cajas punteadas permanentes para todos los días

Usar una estructura de día más limpia.

El borde destacado debe utilizarse principalmente como feedback durante drag & drop.

---

# 38. Qué conservar

Conservar sin cambios funcionales:

- API actual;
- `Ruta`;
- `RutaVisita`;
- `esForanea`;
- `idRegion`;
- `nombreEquipo`;
- estados `Draft`, `Confirmada`, `Cancelada`, `Archivada`;
- versionado;
- helpers existentes;
- Drag & Drop HTML5;
- validación backend;
- sonner;
- `parametrosModulo.getAll()`;
- defaults 3/8/3;
- `agregarVisita`;
- eliminación de visita;
- regeneración;
- confirmación;
- solicitar cambio;
- `HospitalesMap.tsx`;
- reglas ADR-00004.

---

# 39. Criterios de aceptación

El rediseño se considera correcto si:

1. Ya no se muestran todas las rutas como cards equivalentes en un grid.

2. Existe un panel izquierdo de equipos.

3. Al seleccionar un equipo, su calendario aparece en el panel derecho.

4. Las rutas están agrupadas visualmente por semana y día.

5. Cada día muestra su capacidad actual y límite.

6. Cada semana muestra su capacidad actual y límite.

7. El contador mensual de viajes foráneos es visible por equipo.

8. Los estados normal, lleno y excedido son visualmente distintos.

9. `3/3` no se presenta como error.

10. `4/3` sí se presenta como excedido.

11. Existe un área `Sin planificar`.

12. Los hospitales sin planificar pueden arrastrarse hacia un día cuando la versión es editable.

13. Una visita calendarizada puede volver a `Sin planificar`.

14. Los días muestran feedback visual durante drag & drop.

15. Los errores de backend continúan apareciendo mediante toast.

16. Los errores asociados a hospitales sin planificar pueden mostrarse también inline.

17. El selector de versiones usa shadcn/ui.

18. Las versiones Archivadas son claramente de solo lectura.

19. Las rutas Confirmadas son claramente de solo lectura.

20. Existe acceso contextual al mapa del día sin quitar espacio permanente al calendario.

21. Los avisos de falta de región/equipo ofrecen acceso a Selección y reparto.

22. El estado vacío explica el problema y ofrece una acción.

23. No se modifica ningún contrato de backend.

24. No se agrega ninguna librería nueva.

25. `npm run build` continúa verde.

---

# Principio de diseño

No diseñar esta pantalla como:

```text
Ruta A
Ruta B
Ruta C
Ruta D
```

Diseñarla como:

```text
EQUIPO
   │
   ├── SIN PLANIFICAR
   │
   └── SEMANA
          │
          ├── DÍA
          │    ├── Visita 1
          │    ├── Visita 2
          │    └── Visita 3
          │
          └── DÍA
               └── Visitas
```

La interfaz debe hacer evidente que el sistema genera una propuesta inicial, pero que el usuario tiene control sobre la calendarización antes de confirmar.

Priorizar:

**claridad operativa → capacidad visible → facilidad de reorganización → detección de problemas → estética.**