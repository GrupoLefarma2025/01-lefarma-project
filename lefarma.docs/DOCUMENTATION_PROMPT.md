# Prompt Maestro para Documentación de Módulos

Copia y pega este prompt cada vez que necesites documentar un nuevo módulo o actualizar uno existente. Sustituye `[NOMBRE_DEL_MODULO]` por el módulo objetivo (ej: "Gestión de Archivos", "Notificaciones", "Usuarios").

---

## Prompt:

> **Actúa como un experto en documentación técnica. Tu tarea es documentar el módulo de `[NOMBRE_DEL_MODULO]` en el proyecto Lefarma.**
>
> ### 🔍 Fase 1: Investigación
> 1. Analiza exhaustivamente el **Backend**: Busca la carpeta correspondiente en `lefarma.backend/src/Lefarma.API/Features/` para identificar Entidades, Servicios, DTOs y Controladores.
> 2. Analiza el **Frontend**: Busca en `lefarma.frontend/src/` (especialmente en `pages/`, `types/` y `store/`) para entender la interfaz y el manejo de estado.
> 3. Consulta la carpeta **`lefarma.docs/`**: Lee planes, specs o reportes previos sobre este módulo.
>
> ### 🔄 Fase 2: Verificación de Existencia
> Revisa la carpeta `lefarma.docs/articles/`. 
> - Si el módulo **ya tiene artículos**, aplica el **"Procedimiento de Actualización"** definido en los planes para no perder información previa.
> - Si **no existe**, crea los archivos desde cero.
>
> ### ✍️ Fase 3: Generación de Artículos (Formato HTML)
> Genera **dos artículos independientes** en formato HTML puro, listos para el editor TinyMCE:
>
> 1. **`articles/SYSTEM_[Nombre].html`**: Sigue el estándar de `SYSTEM_DOCUMENTATION_PLAN.md`. Incluye:
>    - Mapeo de archivos técnicos.
>    - Tablas de entidades y esquemas de base de datos.
>    - Detalle de DTOs y Endpoints de la API con ejemplos JSON.
>    - Snippets de código Backend (C#) y Frontend (TS).
>    - Placeholders de imagen `> 📸 [INSERTAR CAPTURA: ...]`
>
> 2. **`articles/USER_[Nombre].html`**: Sigue el estándar de `USER_DOCUMENTATION_PLAN.md`. Incluye:
>    - Ruta de navegación y propósito funcional.
>    - Guía de operación paso a paso (Crear, Editar, Eliminar).
>    - Diccionario de campos (qué significa cada dato en la pantalla).
>    - Sección de errores comunes y FAQs.
>    - Múltiples placeholders visuales `> 📸 [CAPTURAR PANTALLA: ...]`.
>
> ### 🚀 Fase 4: Finalización
> 1. Guarda ambos archivos en `lefarma.docs/articles/`.
> 2. Actualiza el índice en `lefarma.docs/README.md` añadiendo los nuevos artículos.
> 3. Si falta información que no pudiste encontrar en el código, añade la nota `> ⚠️ [PENDIENTE: ...]` para que el usuario la complete.

---

### ¿Cómo usar este prompt?
Simplemente dile al asistente:
`"Ejecuta el plan de documentación para el módulo de [Nombre del Módulo] usando el Prompt Maestro en DOCUMENTATION_PROMPT.md"`
