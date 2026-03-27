# Sistema de Filtros y Búsqueda para Tablas de Catálogos

**Fecha:** 2026-03-24
**Autor:** Claude Code
**Estado:** Aprobado para implementación

## Resumen

Sistema reutilizable de filtros y búsqueda para las 11 tablas de catálogos del frontend. Permite filtrado específico por columna, búsqueda general configurable, y persistencia de configuración por usuario.

## Alcance

Aplicable a 11 catálogos:
- empresas
- sucursales
- areas
- gastos
- medidas
- formas-pago
- centros-costo
- cuentas-contables
- estatus-orden
- proveedores
- regimenes-fiscales

## Arquitectura

### DataTable Extendido

El componente `DataTable` existente se extiende con nuevas props opcionales:

```typescript
<DataTable
  columns={columns}
  data={data}
  filterConfig={{
    tableId: 'empresas',
    searchableColumns: ['nombre', 'rfc', 'razonSocial'],
    defaultSearchColumns: ['nombre'],
  }}
/>
```

**Características:**
- `filterConfig` es opcional - sin él, la tabla funciona sin filtros (comportamiento actual)
- No breaking changes - tablas existentes siguen funcionando igual

### Componentes Principales

#### 1. FilterConfig (Botón ⚙️)

Panel de configuración con:
- **Checkboxes de búsqueda**: Columnas donde el buscador general busca
- **Checkboxes de visibilidad**: Columnas mostradas/ocultas
- **Botón "Restaurar defaults"**: Resetea configuración de esta tabla

#### 2. ActiveFiltersBar

Barra horizontal sobre la tabla que muestra:
- **Badges de filtros activos**: `Activo = Activo ×`, `Estado contiene "Jalisco" ×`
- **Tachecita (×)**: Remueve filtro individual
- **Badge "Limpiar todos"**: Remueve todos los filtros

#### 3. ColumnFilterPopover

Popover que se abre al hacer click en ícono de filtro del header de columna:
- **Texto**: contiene / exacta / empieza con / termina con
- **Número**: = / ≠ / > / < / entre
- **Booleano**: Todos / Activo / Inactivo (radio buttons)
- **Select Multi**: Checkboxes con opciones + Aplicar

## Tipos de Filtros por Tipo de Dato

### Texto
```
┌─────────────────────────────────┐
│ Filtro: Nombre                × │
│ ○ contiene  ○ exacta           │
│ ○ empieza con  ○ termina con   │
│                                 │
│ [valor...]                      │
│ [Aplicar]                       │
└─────────────────────────────────┘
```

### Número
```
┌─────────────────────────────────┐
│ Filtro: Empleados             × │
│ [=] valor                       │
│ ○ =  ○ ≠  ○ >  ○ <            │
│ ○ Entre [min] y [max]          │
│                                 │
│ [Aplicar]                       │
└─────────────────────────────────┘
```

### Booleano
```
┌─────────────────────────────────┐
│ Filtro: Activo                × │
│ ○ Todos                         │
│ ○ Activo                        │
│ ○ Inactivo                      │
└─────────────────────────────────┘
```

### Select Multi
```
┌─────────────────────────────────┐
│ Filtro: Estado                × │
│ ☑ Jalisco                      │
│ ☐ CDMX                         │
│ ☑ Monterrey                    │
│                                 │
│ [Aplicar] [Limpiar selección]   │
└─────────────────────────────────┘
```

## Configuración y Persistencia

### Estructura en localStorage

**Key**: `table-configs`

```typescript
interface TableConfig {
  tableId: string;           // ID único: 'empresas', 'proveedores', etc
  visibleColumns: string[];  // Columnas visibles
  searchColumns: string[];   // Columnas donde busca el buscador general
  lastFilters?: Record<string, any>; // Últimos filtros aplicados
}

// Array de configs
[
  {
    "tableId": "empresas",
    "visibleColumns": ["nombre", "rfc", "activo", "ubicacion"],
    "searchColumns": ["nombre", "rfc"],
    "lastFilters": { "activo": "activo" }
  },
  {
    "tableId": "proveedores",
    "visibleColumns": ["razonSocial", "rfc"],
    "searchColumns": ["razonSocial"],
    "lastFilters": {}
  }
]
```

### Lazy Initialization

- Solo se crea un entry cuando el usuario entra a la pantalla
- Configuración default se genera la primera vez
- No se crean entries para tablas no usadas

### Reset

- **Reset individual**: Botón "Restaurar defaults" en panel ⚙️ de cada tabla
- Solo afecta esa tabla, no las demás

## Header de Columna con Filtro

Cada columna tiene un ícono de filtro pequeño en el header:

```
┌────────────────────────────┐
│ Empresa 🔽               🔍 │  ← 👁️ (toggle visibilidad)  🔍 (filtro)
├────────────────────────────┤
```

- **🔍 en blanco**: Sin filtros
- **🔍 en azul**: Filtro activo en esta columna

## Flujo de Usuario Completo

### Escenario 1: Primera vez en catálogo

1. Usuario entra a `/catalogos/empresas`
2. Sistema crea config default:
   - Todas las columnas visibles
   - `defaultSearchColumns` marcadas
   - Sin filtros
3. Usuario ve tabla con buscador general y botón ⚙️

### Escenario 2: Aplicar filtro

1. Usuario hace click en 🔍 de columna "Activo"
2. Se abre popover con opciones booleanas
3. Usuario selecciona "Activo"
4. Badge aparece: `Activo = Activo ×`
5. Tabla se filtra
6. Config se guarda en localStorage

### Escenario 3: Configurar búsqueda

1. Usuario hace click en ⚙️
2. Panel muestra:
   - Columnas de búsqueda: ☑ nombre ☑ rfc ☐ razonSocial
   - Columnas visibles: ☑ nombre ☑ rfc ☑ activo ☐ contacto
3. Usuario marca ☑ razonSocial
4. Usuario desmarca ☑ contacto
5. Usuario cierra panel
6. Config se guarda
7. Buscador general ahora busca en 3 columnas
8. Columna "contacto" se oculta

### Escenario 4: Remover filtro

1. Usuario hace click en × del badge `Activo = Activo`
2. Badge desaparece
3. Tabla se actualiza (muestra todos)
4. Config se guarda (lastFilters se limpia)

### Escenario 5: Reset

1. Usuario hace click en ⚙️
2. Usuario hace click en "Restaurar defaults"
3. Todos los filtros se remueven
4. Columnas vuelven a estado default
5. Búsqueda vuelve a defaultSearchColumns
6. Config se actualiza a valores default

## Hook: useTableFilters

Hook central para lógica de filtros:

```typescript
const {
  // Estado
  activeFilters,
  searchColumnIds,
  visibleColumnIds,

  // Acciones
  addFilter,
  removeFilter,
  clearAllFilters,
  setSearchColumns,
  setVisibleColumns,
  resetToDefaults,

  // Persistencia
  saveConfig,
  loadConfig,
} = useTableFilters({
  tableId: 'empresas',
  allColumns: empresasColumns,
  defaultSearchColumns: ['nombre'],
});
```

## Implementación por Archivo

### Nuevos Archivos

1. **`src/components/table/FilterConfig.tsx`**
   - Panel de configuración (botón ⚙️)
   - Checkboxes de búsqueda y visibilidad
   - Botón reset

2. **`src/components/table/ActiveFiltersBar.tsx`**
   - Barra de badges de filtros activos
   - Tachecitas para remover
   - Badge "Limpiar todos"

3. **`src/components/table/ColumnFilterPopover.tsx`**
   - Popover de filtros por columna
   - UI según tipo de dato

4. **`src/hooks/useTableFilters.ts`**
   - Lógica de filtros
   - Integración con localStorage
   - Métodos add/remove/clear

5. **`src/lib/tableConfigStorage.ts`**
   - `loadConfig(tableId)`
   - `saveConfig(tableId, config)`
   - `resetConfig(tableId)`
   - `createDefaultConfig(tableId, columns)`

### Archivos Modificados

1. **`src/components/ui/data-table.tsx`**
   - Agregar prop `filterConfig?: FilterConfig`
   - Integrar FilterConfig, ActiveFiltersBar, ColumnFilterPopover
   - Pasar filterConfig a useTableFilters
   - Renderizar condicionalmente si filterConfig existe

## Migración por Tabla

Para cada catálogo, agregar `filterConfig`:

```typescript
// ANTES
<DataTable columns={columns} data={empresas} />

// DESPUÉS
<DataTable
  columns={columns}
  data={empresas}
  filterConfig={{
    tableId: 'empresas',
    searchableColumns: ['nombre', 'rfc', 'razonSocial'],
    defaultSearchColumns: ['nombre'],
  }}
/>
```

**El orden sugerido de migración:**
1. empresas (prueba de concepto)
2. proveedores (segunda prueba)
3. resto de catálogos

## Consideraciones Técnicas

### TanStack Table
- Ya tiene `getFilteredRowModel()` - lo usaremos
- `columnFilters` para filtros específicos por columna
- `globalFilter` para buscador general

### Performance
- Filtrado en memoria (ya implementado con useMemo)
- No afecta paginación
- Config en localStorage es mínima (<5KB por tabla)

### Accessibility
- Iconos con aria-label
- Popovers con focus trapping
- Badges con role="button" + keyboard navigation

### Responsive
- Panel ⚙️ es un Dialog en móvil
- Badges pueden wrap en múltiples líneas
- FiltersBar puede ocultarse en móviles si hay muchos filtros

## Testing

### Pruebas Manuales
- [ ] Aplicar filtro de texto
- [ ] Aplicar filtro de número
- [ ] Aplicar filtro booleano
- [ ] Aplicar filtro multi-select
- [ ] Remover filtro individual
- [ ] Limpiar todos los filtros
- [ ] Configurar columnas de búsqueda
- [ ] Mostrar/ocultar columnas
- [ ] Reset a defaults
- [ ] Persistencia (recargar página)

### Pruebas por Catálogo
- [ ] empresas
- [ ] sucursales
- [ ] areas
- [ ] gastos
- [ ] medidas
- [ ] formas-pago
- [ ] centros-costo
- [ ] cuentas-contables
- [ ] estatus-orden
- [ ] proveedores
- [ ] regimenes-fiscales

## Métricas de Éxito

- ✅ Usuario puede filtrar cualquier columna por su tipo
- ✅ Usuario puede configurar columnas de búsqueda
- ✅ Usuario puede mostrar/ocultar columnas
- ✅ Configuración persiste entre sesiones
- ✅ Reset por tabla funciona independientemente
- ✅ No hay cambios breaking en tablas existentes
- ✅ Código reutilizable (DRY) en las 11 tablas
