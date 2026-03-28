# Estándar de Documentación para Usuarios Finales - Lefarma

Este documento define la estructura obligatoria para la creación de guías y manuales dirigidos a los **Usuarios Finales** del sistema Lefarma. El objetivo es proporcionar instrucciones claras, visuales y funcionales que no requieran conocimientos técnicos de programación.

---

## 📋 Estructura General

Toda documentación dirigida al usuario debe contener las siguientes secciones en este orden:

### 1. Título y Propósito (H1)
- Título amigable con un icono representativo.
- Párrafo breve que explique **para qué sirve** este módulo en el día a día del usuario.

### 2. ¿Cómo Acceder? (Ruta de Navegación)
- Descripción del camino a seguir en el menú principal.
- Ejemplo: `Menú Principal > Catálogos > Empresas`.
- Incluir una captura del menú resaltando la opción.

### 3. Descripción de la Interfaz (Overview)
- Explicación de las partes principales de la pantalla (Barra de búsqueda, Botón "Nuevo", Tabla de resultados, Filtros).
- Cada elemento debe estar numerado y referenciado a una captura de pantalla.

### 4. Guía de Operación (Paso a Paso)
Procedimientos comunes explicados de forma sencilla:
- **Crear un nuevo registro:** Pasos desde el clic inicial hasta el mensaje de éxito.
- **Editar información:** Cómo buscar y modificar un registro existente.
- **Eliminar/Desactivar:** Explicación del impacto de esta acción.

### 5. Guía de Campos (Formularios)
Tabla que explique qué información se debe ingresar en cada campo del formulario:
- **Campo:** Nombre de la etiqueta en la pantalla.
- **Descripción:** Qué dato debe ir ahí (ej: "Ingresar el RFC con homoclave").
- **Obligatorio:** Indicar con un ✅ o ❌ si el campo es requerido para guardar.

### 6. Mensajes y Validaciones
Explicación de los mensajes que el sistema puede mostrar:
- **Mensajes de Éxito:** Qué significa que el sistema diga "Guardado correctamente".
- **Errores Comunes:** Explicación de alertas como "El RFC ya existe" o "Campo requerido".
- Capturas de las alertas visuales.

### 7. Consejos y Buenas Prácticas
- Tips para usar mejor el módulo (ej: "Usa el filtro de búsqueda para encontrar registros rápidamente").
- Atajos de teclado o funciones especiales.

### 8. Preguntas Frecuentes (FAQ)
Mínimo 3 preguntas que un usuario real podría hacerse sobre el módulo.

---

## 🎨 Guía de Estilo y Formato (HTML RichText)

Para mantener la compatibilidad con el **Sistema de Ayuda**, el contenido debe entregarse en **HTML puro**:

- **Títulos:** `<h1>`, `<h2>`, `<h3>`.
- **Destacados:** Usar `<div style="padding: 15px; background-color: #f8f9fa; border-left: 5px solid #007bff; margin: 10px 0;">` para notas importantes o "Sabías que...".
- **Tablas:** Usar bordes simples y encabezados claros.
- **Iconos:** Integrar emojis o iconos estándar en los títulos.
- **Placeholders de Imagen (CRUCIAL):**
    - Debido a que esta guía es visual, se deben incluir múltiples placeholders:
    - `<p>> 📸 [CAPTURAR PANTALLA: Vista general del módulo]</p>`
    - `<p>> 📸 [CAPTURAR PANTALLA: Formulario de creación resaltando campos obligatorios]</p>`
    - `<p>> 📸 [CAPTURAR PANTALLA: Ejemplo de mensaje de error de validación]</p>`

---

## 🔄 Procedimiento de Actualización

Cuando se realicen cambios en la interfaz o flujos de usuario de un módulo ya documentado, se debe seguir este flujo:

1.  **Lectura del Existente:** Buscar y leer el manual de usuario en la carpeta `lefarma.docs/articles/`.
2.  **Detección de Cambios en UI:** 
    - Si se añadieron campos al formulario, actualizar la "Guía de Campos".
    - Si se cambió el menú o la forma de acceso, actualizar "¿Cómo Acceder?".
    - Si se añadieron nuevas acciones (ej: botones de "Aprobar", "Cancelar"), documentarlas en "Guía de Operación".
3.  **Actualización de Capturas:** Marcar con el placeholder `📸` cualquier sección donde el cambio visual sea evidente, para que el equipo tome nuevas capturas.
4.  **Nota de Versión:** Añadir al final del documento:
    - `<p><em>Guía actualizada el [FECHA] debido a cambios en la interfaz de usuario: [Breve descripción]</em></p>`

---

## 🔎 Fuentes de Información

Para generar esta documentación, se debe:
1.  **Explorar la Interfaz:** Acceder al módulo en el entorno de desarrollo y ver cómo interactúa el usuario.
2.  **Revisar Validadores:** Ver los mensajes de error definidos en el código (FluentValidation o Zod) para traducirlos a lenguaje ciudadano.
3.  **Consultar el Plan Técnico:** Basarse en el `SYSTEM_DOCUMENTATION_PLAN.md` para asegurar que los nombres de los campos coincidan con el negocio.

---
*Este plan de documentación para usuarios es el estándar oficial de Lefarma - Marzo 2026.*
