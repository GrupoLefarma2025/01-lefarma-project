# Estándar de Documentación de Módulos - Lefarma

Este documento define la estructura obligatoria que debe seguir la documentación de cualquier módulo o funcionalidad en Lefarma. Este estándar se aplica tanto a los archivos Markdown en `lefarma.docs/` como a los artículos creados en el **Sistema de Ayuda** de la aplicación.

## 📋 Estructura General

Toda documentación de módulo debe contener las siguientes secciones en este orden:

### 1. Título e Introducción
- Título con un icono representativo (H1).
- Párrafo breve que resuma la funcionalidad y el valor que aporta al sistema.

### 2. Listado de Sub-módulos o Componentes (Si aplica)
- Si el módulo contiene múltiples sub-elementos (ej: diferentes catálogos, diferentes canales de notificación), se debe incluir una lista o tabla resumen que los nombre a todos.

### 3. Ubicación de Archivos (File Structure)
Tablas que listen los archivos principales del módulo, divididas por:
- **Backend (.NET):** Entidades, DTOs, Servicios, Repositorios, Controllers.
- **Frontend (React):** Tipos, Servicios, Stores, Componentes, Páginas.

### 3. Propósito y Características
- Lista de objetivos del sistema (usando iconos).
- Lista de características técnicas y funcionales principales.

### 4. Entidades de Base de Datos
Tablas detalladas por cada entidad principal, incluyendo:
- **Propiedad:** Nombre en C#.
- **Tipo:** Tipo de dato SQL/C#.
- **Descripción:** Propósito del campo.
- **Validaciones:** Restricciones (si aplica).

### 5. DTOs (Data Transfer Objects)
Tablas de los objetos de entrada (Requests) y salida (Responses) de la API, detallando:
- Propiedades, tipos, y si son requeridos.

### 6. Endpoints de la API
Documentación detallada de cada ruta, incluyendo:
- Verbo HTTP y URL.
- Descripción de la acción.
- Parámetros de consulta (Query Params).
- Ejemplos de **Request Body** (JSON).
- Ejemplos de **Response** (JSON).

### 7. Guía de Uso: Backend
Ejemplos de código en C# sobre cómo:
- Inyectar el servicio del módulo.
- Consumir los métodos principales del servicio.

### 8. Guía de Uso: Frontend
Ejemplos de código en TypeScript/React sobre cómo:
- Usar el Store de Zustand.
- Consumir el servicio del módulo.
- Integrar componentes específicos en las vistas.

### 9. Metadatos y Enums
Tablas que describan tipos, estados, prioridades o categorías, incluyendo:
- Código/Valor.
- Descripción funcional.
- Comportamiento en la UI (colores, iconos).

### 10. Ejemplos Prácticos
Mínimo 3 ejemplos de casos de uso reales con fragmentos de código que demuestren la integración completa.

### 11. Configuración
Detalles de configuración necesarios en `appsettings.json`, variables de entorno o constantes del sistema.

---

## 🎨 Guía de Estilo y Formato (HTML RichText)

Para que la documentación sea compatible con el **Sistema de Ayuda** (editor TinyMCE), el resultado final de un artículo debe entregarse en **formato HTML puro**. No se debe usar sintaxis Markdown (`#`, `*`, `[]`) en el contenido final del artículo.

### Etiquetas Permitidas y Requeridas:
- **Títulos:** `<h1>`, `<h2>`, `<h3>` para jerarquías.
- **Separadores:** `<hr/>` entre secciones principales.
- **Énfasis:** `<strong>` para negritas, `<em>` para cursivas.
- **Listas:** `<ul>` y `<li>` para viñetas, `<ol>` y `<li>` para pasos numerados.
- **Tablas:** Estructura completa con `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`.
- **Código:** Bloques envueltos en `<pre><code>...</code></pre>`.
- **Párrafos:** Todo texto descriptivo debe ir dentro de `<p>`.

### Placeholders en HTML:
- **Imágenes:** `<p>> 📸 [INSERTAR CAPTURA: Descripción]</p>`
- **Pendientes:** `<p>> ⚠️ [PENDIENTE: Descripción. El usuario debe completar esto]</p>`

---

## 🔄 Procedimiento de Actualización

Cuando se realicen cambios en el código (Backend o Frontend) de un módulo ya documentado, se debe seguir este flujo de actualización:

1.  **Lectura del Existente:** Buscar y leer el artículo correspondiente en la carpeta `lefarma.docs/articles/`.
2.  **Detección de Impacto:** 
    - **Backend:** Si cambiaron las propiedades de una entidad o DTO, se deben actualizar las tablas correspondientes. Si cambió la firma de un método del servicio o un endpoint, actualizar las guías de uso y la sección de API.
    - **Frontend:** Si cambió la interfaz, los componentes o el store (Zustand), actualizar las guías de uso del frontend y los placeholders de imágenes.
3.  **Actualización Parcial:** No reescribir todo el artículo. Mantener la estructura original y solo modificar las celdas de las tablas o los bloques de código que cambiaron.
4.  **Verificación de Placeholders:** Si el cambio es visual, asegurarse de actualizar los placeholders de imágenes (`📸`) para que el equipo sepa que debe tomar nuevas capturas.
5.  **Nota de Versión:** Añadir al final del documento una línea de control:
    - `<p><em>Actualizado el [FECHA] por cambios en [Backend/Frontend/Ambos]: [Descripción breve del cambio]</em></p>`

---

## 🔎 Fuentes de Información para Documentar

Para documentar correctamente un módulo, se debe realizar un análisis exhaustivo de las siguientes fuentes en el repositorio:

1.  **Código Fuente Backend:** Analizar entidades en `Domain/`, contratos en `Domain/Interfaces/`, lógica de negocio en `Features/` y controladores.
2.  **Código Fuente Frontend:** Analizar tipos en `src/types/`, lógica de estado en `src/store/` y componentes visuales en `src/components/`.
3.  **Carpeta `lefarma.docs/`:** Consultar archivos existentes en esta carpeta, incluyendo planes de implementación (`plans/`), especificaciones técnicas (`specs/`) y reportes de validación (`reports/`).
4.  **Base de Datos:** Consultar scripts SQL en `lefarma.database/` y configuraciones de EF Core para asegurar que las tablas y tipos coincidan con la realidad.

---
*Este plan de documentación es el estándar oficial del proyecto Lefarma a partir de Marzo 2026.*
