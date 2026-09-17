# Propuesta de diseño — Educación Médica

## Objetivo

Homologar la experiencia de Educación Médica con el patrón visual y funcional utilizado actualmente en **Solicitudes de Personal (RH)** y, donde corresponda, con **Autorizaciones de Orden de Compra**, evitando que cada módulo implemente una variante distinta del mismo concepto de workflow.

La intención no es copiar literalmente toda la lógica de RH, sino conservar la misma base de diseño:

- Tabs visualmente consistentes.
- DataTable para listados.
- Acciones por fila mediante iconos + tooltip.
- Modales independientes por preocupación.
- Firma mediante formulario dinámico.
- Historial separado.
- Soporte de archivos/adjuntos.
- Mismo lenguaje visual para estados, filtros, encabezados y acciones.
- Las páginas especializadas siguen existiendo para el contexto completo del documento.

---

# 1. Bandeja de Autorizaciones de Educación Médica

Ruta actual:

`/educacion-medica/aprobaciones`

Debe evolucionar de la lista simple actual hacia el mismo patrón de bandeja utilizado en RH.

## 1.1 Estructura general

La página quedaría compuesta por:

1. Banner de firma digital, cuando corresponda.
2. Encabezado de página.
3. Tabs.
4. Tarjeta de filtros.
5. DataTable.
6. Modales independientes:
   - Detalle.
   - Firma.
   - Archivos.
   - Historial.

La estructura visual debe conservar la base de `SolicitudesPersonal.tsx`.

No crear una identidad visual diferente exclusivamente para Educación Médica.

---

# 2. Tabs

Mantener:

- **Pendientes**
- **Todos los documentos**

Pero utilizar exactamente el mismo lenguaje visual de los tabs de Solicitudes de Personal:

- mismo componente;
- mismos colores;
- mismos estados activo/inactivo;
- mismo espaciado;
- mismo estilo del contador.

Ejemplo conceptual:

`[ Pendientes 4 ]   [ Todos los documentos 38 ]`

No crear tabs personalizados únicamente para EM.

### Pendientes

Muestra documentos donde:

`esPendiente === true`

es decir, donde el usuario participa en el paso actual y tiene acciones disponibles.

### Todos los documentos

Muestra también:

- autorizados;
- confirmados;
- rechazados;
- cancelados;
- devueltos;
- documentos donde el usuario participó o que el endpoint permita visualizar.

El endpoint actual puede mantenerse:

`GET /educacion-medica/aprobaciones/documentos?filtro=pendientes|mios|todos`

---

# 3. Filtros

Utilizar la misma tarjeta visual de filtros de RH.

Primera versión:

- Buscar documento.
- Tipo.
- Estado.
- Etapa / paso actual.
- Fecha desde.
- Fecha hasta.

Botones:

- **Limpiar**
- **Buscar**

Aunque inicialmente algunos filtros puedan resolverse en frontend, visualmente debe quedar preparada la estructura para trasladarlos posteriormente al backend.

## Tipo

- Selección mensual.
- Rutas.

## Estado

Ejemplos:

- En autorización.
- Autorizada.
- Confirmada.
- Devuelta.
- Rechazada.
- Cancelada.

## Etapa

Ejemplos:

- Firma Gerencia General.
- Firma Gerente de Ventas.
- Revisión Coordinación Administrativa.
- Autorización Dirección Corporativa.

---

# 4. DataTable

Reutilizar:

`@/components/ui/data-table`

No mantener la lista basada únicamente en `divide-y`.

Una bandeja de autorizaciones debe permitir comparar muchos documentos rápidamente y el formato tabular escala considerablemente mejor.

## Columnas propuestas

### Documento

Campo principal.

Debe admitir título + información secundaria.

Ejemplos:

**Selección Sep 2026**  
Gerencia Cardiología

o

**Rutas · Versión 3**  
Selección Sep 2026

---

### Tipo

Badge discreto:

- Selección.
- Rutas.

No utilizar colores excesivamente fuertes.

---

### Solicitante

Nombre completo del usuario que inició/envió el documento.

---

### Fecha

Fecha de creación o, preferentemente, fecha de envío al workflow.

Debe definirse una sola convención para ambos tipos.

---

### Etapa actual

Nombre del paso actual.

Ejemplos:

- Gerencia General.
- Gerente de Ventas.
- Coordinación Administrativa.
- Dirección Corporativa.

Cuando sea responsabilidad del usuario actual se puede mostrar adicionalmente:

`Pendiente de tu firma`

como badge pequeño.

---

### Estado

Utilizar los badges y colores del sistema ya utilizados por RH.

Evitar crear una paleta exclusiva de Educación Médica.

---

### Acciones

Aquí Educación Médica debe seguir el patrón de RH:

**todas las acciones mediante botones-icono con tooltip.**

No utilizar un botón principal con texto como:

`Revisar y firmar`

ni botones grandes:

`Firmar | Devolver | Ver detalle`

La interacción debe sentirse igual que en `SolicitudesTable`.

---

# 5. Acciones por fila

Las acciones deben depender del documento y de las acciones devueltas por workflow.

Iconos sugeridos:

### Detalle

`Eye`

Tooltip:

**Ver detalle**

Siempre disponible cuando el usuario pueda consultar el documento.

---

### Firma

`PenLine`, `Signature` o equivalente.

Tooltip:

**Firmar / acciones disponibles**

Solo mostrar si:

`acciones.length > 0`

No representar cada transición del workflow como un icono independiente.

Al pulsarlo se abre el modal de Firma y dentro se muestran:

- Aprobar.
- Autorizar.
- Firmar.
- Devolver.
- Rechazar.
- Cancelar.

según corresponda.

Esto debe seguir el mismo patrón que RH.

---

### Archivos

`Paperclip`

Tooltip:

**Archivos**

Disponible aunque no tenga archivos, si el documento permite adjuntarlos.

---

### Historial

`History` o `Clock`

Tooltip:

**Historial**

Abre un modal independiente.

---

### Abrir documento

`ExternalLink`

Tooltip:

**Abrir documento**

Navega a la pantalla especializada.

Selección:

`/educacion-medica/seleccion?idSeleccion={id}`

Rutas:

ruta correspondiente a la versión/documento.

---

# 6. No utilizar un único modal

Modificar el enfoque actual.

El modal único que combina:

- Resumen.
- Acciones.
- Historial.

debe dividirse.

La razón principal es escalabilidad.

El historial puede crecer considerablemente y no debería ocupar espacio dentro del modal de revisión o firma.

La estructura debería seguir el patrón de RH:

## Modal Detalle

`size="full"` o un tamaño amplio consistente con RH.

Contenido:

- encabezado del documento;
- estado;
- resumen específico del tipo.

### Selección

- período;
- gerencia;
- vigencia;
- hospitales;
- regiones;
- locales;
- foráneos;
- firmas completadas.

### Rutas

- versión;
- selección relacionada;
- equipos;
- hospitales;
- visitas;
- locales;
- foráneas;
- estado de planificación.

Al final:

**Abrir documento completo**

para consultar el contexto especializado.

---

# 7. Modal de Firma

La firma debe dejar de ser únicamente:

`comentario + confirmar`

y utilizar el mismo concepto de formulario dinámico de RH.

Debe reutilizar o generalizar la arquitectura existente basada en:

- acción;
- configuración del workflow;
- campos dinámicos;
- comentario;
- adjuntos;
- requisitos de firma.

La intención es que Educación Médica pueda crecer sin modificar otra vez la UI cuando aparezca una acción con requisitos adicionales.

Ejemplo de configuración futura:

`requiere_comentario`

`requiere_adjunto`

`permite_adjunto`

`campos`

`requiere_firma`

---

# 8. WorkflowAccionModal

El componente actual puede evolucionar hacia algo más cercano a:

`WorkflowFirmaModal`

o convertirse en un componente transversal reutilizable.

Debe soportar:

- firma digital;
- comentario;
- comentario obligatorio según acción;
- campos dinámicos;
- adjuntos;
- validaciones configurables;
- acción seleccionada.

Ejemplo conceptual:

**Acción**

`Devolver`

**Motivo de devolución \***

`[ textarea ]`

**Documento de soporte**

`[ Adjuntar archivo ]`

`Cancelar       Confirmar devolución`

---

# 9. Acciones dentro del modal de firma

Mantener la convención visual usada en RH.

Por ejemplo:

- APROBAR / AUTORIZAR / FIRMAR → acción primaria.
- DEVOLVER → ámbar.
- RECHAZAR / CANCELAR → rojo.
- CERRAR → verde.

La bandeja solamente abre el modal.

La elección de la transición ocurre dentro del modal.

---

# 10. Adjuntos en Educación Médica

Se recomienda incorporarlos desde ahora.

Aunque actualmente EM no los utilice obligatoriamente, workflow ya está evolucionando hacia un patrón común en:

- CxP.
- RH.
- Educación Médica.

Debe contemplarse:

### Archivos del documento

Documentos informativos o soporte general.

### Archivos asociados a una acción

Por ejemplo:

- evidencia;
- justificación;
- documento de autorización;
- observación;
- soporte administrativo.

Idealmente el motor debería soportar:

`permite_adjunto`

y

`requiere_adjunto`

por acción o paso.

---

# 11. Modal de Archivos

Debe mantenerse separado.

Razones:

- puede acumular varios archivos;
- puede requerir preview;
- descarga;
- información de quién subió el archivo;
- fecha;
- tipo;
- eventualmente eliminación o reemplazo.

Patrón:

`SolicitudArchivosTab`

puede servir como referencia.

---

# 12. Modal de Historial

Debe ser completamente independiente.

No mantener `WorkflowHistorial` debajo del resumen.

El historial puede crecer a:

- decenas de eventos;
- devoluciones;
- reenvíos;
- firmas;
- cambios;
- comentarios;
- adjuntos;
- acciones automáticas.

Debe utilizar un timeline similar al de RH.

Separar conceptualmente:

## Flujo

Representa dónde está el documento.

Ejemplo:

`Creación`

↓

`Firma GV`

↓

`Revisión CA`

↓

`Autorización DC`

↓

`Confirmada`

## Bitácora

Representa lo que ocurrió.

Ejemplo:

`15/09/2026 13:42`

Juan Pérez  
**Aprobó**

Comentario: Correcto.

---

`14/09/2026 16:12`

María López  
**Devolvió**

Comentario: Revisar hospital asignado.

---

# 13. Consistencia visual con RH

Esta parte debe tratarse como requisito de diseño.

Educación Médica no debe tener una variante diferente para:

- tabs;
- filtros;
- DataTable;
- badges;
- iconos;
- tooltips;
- botones;
- diálogos;
- header cards;
- timelines.

Puede cambiar el contenido, pero no la gramática visual.

El usuario debería reconocer inmediatamente:

> Esta es otra bandeja del mismo sistema.

---

# 14. Selección Mensual también necesita rediseño de listado

La distribución actual de selecciones mediante tarjetas/listado horizontal o lateral:

`Selección 1 | Selección 2 | Selección 3`

puede funcionar con pocos registros, pero no debe utilizarse como listado histórico definitivo.

Cuando existan:

- múltiples meses;
- múltiples gerencias;
- varios estados;
- varias versiones;
- decenas o cientos de selecciones;

la navegación se degradará rápidamente.

## Recomendación

Separar:

**Listado de selecciones**

de:

**Detalle de una selección**

---

# 15. Nuevo listado de Selecciones Mensuales

Utilizar también `DataTable`.

Estructura:

`Selección Mensual`

`Gestiona las selecciones mensuales de hospitales para Educación Médica.`

`[ Crear selección ]`

Filtros:

- período;
- gerencia;
- estado;
- buscar.

Tabla:

| Selección | Gerencia | Período | Hospitales | Estado | Etapa | Creado por | Fecha | Acciones |
|---|---|---|---:|---|---|---|---|---|

Ejemplo:

**Septiembre 2026**  
Cardiología

`32`

`En autorización`

`Gerencia General`

`Laura Pérez`

`12 sep 2026`

Acciones mediante iconos.

---

# 16. Acciones del listado de Selección Mensual

Según estado:

### Ver

`Eye`

Abre el detalle.

### Editar

`Pencil`

Solo en Borrador y con las reglas actuales.

### Firma

`Signature`

Si el usuario tiene acciones disponibles.

### Historial

`History`

### Archivos

`Paperclip`

si se incorpora el soporte transversal.

### Más acciones

Opcionalmente `MoreHorizontal` únicamente si aparecen demasiadas operaciones secundarias.

---

# 17. Cómo abrir una selección

La selección deja de depender de una tarjeta lateral.

Debe poder abrirse directamente mediante:

`?idSeleccion=123`

o, todavía mejor a largo plazo:

`/educacion-medica/selecciones/123`

Si cambiar las rutas actuales implica demasiado esfuerzo, mantener temporalmente:

`/educacion-medica/seleccion?idSeleccion=123`

es perfectamente válido.

La página lee el ID y carga directamente esa selección.

---

# 18. Qué pasa con las acciones dentro de Selección Mensual

Se mantienen.

Esto no es duplicación problemática.

La bandeja responde:

> ¿Qué tengo pendiente de autorizar?

La página de Selección responde:

> ¿Qué contiene esta selección y cómo fue construida?

Por tanto, una selección puede firmarse desde:

- Bandeja de Autorizaciones.
- Página de la selección.

Ambas interfaces deben utilizar:

- el mismo endpoint de acciones;
- el mismo componente de firma;
- las mismas validaciones;
- el mismo historial;
- el mismo backend.

No implementar dos lógicas de workflow.

---

# 19. Estructura futura de Selección Mensual

La página podría evolucionar a:

`Selecciones mensuales`

`[Listado DataTable]`

Al abrir una:

`Selección Septiembre 2026`

`← Volver a selecciones`

`[En autorización]`

Acciones workflow

y debajo:

- resumen;
- hospitales;
- regiones;
- mapas;
- scoring;
- demás contexto especializado.

Esto escala considerablemente mejor que mantener un selector de muchas selecciones dentro de la misma pantalla.

---

# 20. Rutas

Aplicar el mismo principio.

Debe existir diferencia entre:

**Listado de versiones/rutas**

y:

**Editor/planificador de rutas**

Si actualmente una selección puede generar varias versiones, conviene que el usuario no dependa exclusivamente del calendario para encontrarlas.

Puede existir una DataTable sencilla de versiones:

| Versión | Selección | Estado | Equipos | Hospitales | Visitas | Fecha | Acciones |
|---|---|---|---:|---:|---:|---|---|

Al abrir una versión se entra al planificador/calendario existente.

El calendario sigue siendo la interfaz correcta para trabajar una ruta.

La tabla solamente sirve para encontrar y administrar versiones.

---

# 21. Patrón general resultante

El sistema quedaría conceptualmente así:

## Nivel 1 — Listado

DataTable.

Sirve para:

- encontrar;
- filtrar;
- comparar;
- seleccionar.

Aplica a:

- Solicitudes RH.
- Autorizaciones EM.
- Selecciones Mensuales.
- Versiones de Rutas.

---

## Nivel 2 — Modal operativo

Sirve para operaciones breves:

- detalle;
- firma;
- historial;
- archivos.

No sustituye las páginas especializadas.

---

## Nivel 3 — Página especializada

Sirve para contenido complejo.

### Selección Mensual

- hospitales;
- regiones;
- scoring;
- mapas;
- configuración.

### Rutas

- calendario;
- días;
- equipos;
- visitas;
- desplazamientos;
- hospitales;
- planificación.

---

# 22. Decisión de diseño

La Bandeja de Autorizaciones de Educación Médica debe adoptar el patrón base de Solicitudes de Personal:

**DataTable + acciones por iconos + modales independientes + firma dinámica + archivos + historial.**

No mantener:

- lista simple;
- acciones grandes de texto por fila;
- historial dentro del mismo modal de detalle;
- modal único para todas las preocupaciones.

El contenido especializado de Educación Médica continúa viviendo en Selección Mensual y Rutas.

A su vez, **Selección Mensual debe abandonar progresivamente el listado de selecciones mediante tarjetas/selector lateral como mecanismo principal**, ya que no escala a grandes volúmenes.

Debe evolucionar hacia:

**DataTable de selecciones → abrir selección → página especializada.**

Lo mismo puede aplicarse a las versiones de rutas:

**DataTable de versiones → abrir versión → calendario/planificador.**

La regla general del módulo debe ser:

> **Tabla para encontrar. Modal para operar. Página para trabajar.**