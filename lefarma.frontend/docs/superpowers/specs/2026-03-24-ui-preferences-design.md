# UI Preferences con Presets - Design Document

**Date:** 2026-03-24
**Status:** Approved
**Author:** Design validated with user

## Overview

Sistema de preferencias de interfaz con presets preconfigurados más configuración avanzada para personalización granular. Los usuarios pueden elegir entre 4 estilos predefinidos o ajustar manualmente cada aspecto de la UI.

## Goals

- Simplificar la configuración de UI con presets pre-hechos
- Permitir personalización avanzada para usuarios que necesitan control fino
- Persistir preferencias en localStorage (no backend sync)
- Integrarse con el sistema de tema existente (shadcn/ui + Tailwind)

## Non-Goals

- Sincronización entre dispositivos
- Configuración por backend/rol
- Perfiles de usuario en servidor

## Architecture

### Data Flow

```
User Action → Preset Selector / Advanced Config
              ↓
         ConfigStore (Zustand + persist)
              ↓
    CSS Variables + Component Props
              ↓
           UI Updates
```

### Components

1. **PresetSelector** - Grid de 4 cards con iconos
2. **AdvancedConfigUI** - Controles granulares (expandible)
3. **ConfigStore** - Estado persistido con Zustand
4. **CSS Variables** - Aplicación de visuales globales
5. **DataTable Integration** - Density y pageSize desde config

## Data Structure

### Types

```typescript
type UIPresetId = 'compacto' | 'estandar' | 'comodo' | 'accesibilidad';

interface VisualPreferences {
  densidad: 'compacto' | 'comodo';
  fontSize: 'small' | 'medium' | 'large';
  animations: boolean;
}

interface ComponentPreferences {
  tables: {
    density: 'compact' | 'standard' | 'comfortable';
    defaultPageSize: number;
  };
  sidebar: {
    defaultCollapsed: boolean;
  };
}

interface UIConfig {
  tema: 'light' | 'dark' | 'system';
  presetId: UIPresetId;
  visual: VisualPreferences;
  componentes: ComponentPreferences;
  notificaciones: { /* existing */ };
}
```

### Presets

| Preset | Densidad | Fuente | Animaciones | Tablas | Sidebar |
|--------|----------|--------|-------------|--------|---------|
| Compacto | compacto | small | true | compact, 50/page | colapsado |
| Estándar | comodo | medium | true | standard, 20/page | expandido |
| Cómodo | comodo | large | true | comfortable, 10/page | expandido |
| Accesibilidad | comodo | large | false | comfortable, 10/page | expandido |

## CSS Variables Integration

### Nuevas Variables

```css
:root {
  --font-scale: 1; /* 0.875 | 1 | 1.125 */
  --spacing-factor: 1; /* 0.75 | 1 */
  --transition-duration: 150ms; /* 0ms cuando animations: false */
}
```

### Application Function

```typescript
function applyVisualPreferences(visual: VisualPreferences) {
  const root = document.documentElement;

  // Font scale
  const fontScales = { small: 0.875, medium: 1, large: 1.125 };
  root.style.setProperty('--font-scale', fontScales[visual.fontSize].toString());

  // Spacing factor
  const spacingFactors = { compacto: 0.75, comodo: 1 };
  root.style.setProperty('--spacing-factor', spacingFactors[visual.densidad].toString());

  // Animations
  if (!visual.animations) {
    root.setAttribute('data-no-animations', 'true');
    root.style.setProperty('--transition-duration', '0ms');
  } else {
    root.removeAttribute('data-no-animations');
    root.style.removeProperty('--transition-duration');
  }
}
```

## Component Design

### PresetSelector UI

```
┌──────────────────────────────────────────────────────┐
│ PRECONFIGURACIÓN DE INTERFAZ                        │
├──────────────────────────────────────────────────────┤
│ Selecciona un estilo predefinido:                   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐│
│  │  🎯      │  │  📊      │  │  🛋️      │  │  ♿  ││
│  │COMPACTO  │  │ESTÁNDAR  │  │ CÓMODO   │  │ACC  ││
│  │Más datos │  │Balance   │  │Espacio   │  │Fácil ││
│  │por       │  │perfecto  │  │amplio    │  │leer ││
│  │pantalla  │  │          │  │          │  │      ││
│  └──────────┘  └──────────┘  └──────────┘  └──────┘│
│                                                      │
│  [ Mostrar Configuración Avanzada ▶ ]               │
└──────────────────────────────────────────────────────┘
```

### AdvancedConfigUI Sections

1. **Preferencias Visuales**
   - Densidad de Interfaz (Select)
   - Tamaño de Fuente (Select)
   - Animaciones (Switch)

2. **Componentes**
   - Densidad de Tablas (Button Group: Compact/Standard/Comfort)
   - Items por página (Slider: 5-100)
   - Sidebar (Select: Expandido/Colapsado)

3. **Reset**
   - Botón "Restablecer Valores por Defecto" → setPreset('estandar')

## Store Integration

### New Methods in ConfigStore

```typescript
// Aplicar preset completo
setPreset: (presetId: UIPresetId) => {
  const preset = UI_PRESETS[presetId];
  set((state) => ({
    ui: {
      ...state.ui,
      presetId,
      visual: preset.config.visual,
      componentes: preset.config.componentes,
    },
  }));
  applyVisualPreferences(preset.config.visual);
}

// Actualizar preferencias visuales
updateVisualPreferences: (updates: Partial<VisualPreferences>) => {
  set((state) => ({
    ui: {
      ...state.ui,
      visual: { ...state.ui.visual, ...updates },
    },
  }));
  applyVisualPreferences({ ...get().ui.visual, ...updates });
}

// Actualizar configuración de componentes
updateComponentPreferences: (updates: Partial<ComponentPreferences>) => {
  set((state) => ({
    ui: {
      ...state.ui,
      componentes: { ...state.ui.componentes, ...updates },
    },
  }));
}
```

### Persist Configuration

```typescript
// En persist middleware - partialize function
partialize: (state) => ({
  ui: state.ui, // Ahora incluye presetId, visual, componentes
  perfil: state.perfil,
})
```

## Component Integration

### DataTable

```typescript
interface DataTableProps<TData> {
  // ... existing props
  density?: 'compact' | 'standard' | 'comfortable';
  pageSize?: number;
}

export function DataTable<TData>({ density, pageSize, ...props }: DataTableProps<TData>) {
  const { ui } = useConfigStore();

  // Usar config como fallback
  const tableDensity = density || ui.componentes.tables.density;
  const tablePageSize = pageSize || ui.componentes.tables.defaultPageSize;

  // Aplicar clases basadas en densidad
  const tableClassName = cn(
    tableDensity === 'compact' && 'data-table-compact',
    tableDensity === 'comfortable' && 'data-table-comfortable'
  );

  // ... rest of component
}
```

### CSS for Table Density

```css
/* Compact */
.data-table-compact tbody tr td {
  padding-top: calc(var(--spacing-factor) * 0.25rem);
  padding-bottom: calc(var(--spacing-factor) * 0.25rem);
}

/* Comfortable */
.data-table-comfortable tbody tr td {
  padding-top: calc(var(--spacing-factor) * 1rem);
  padding-bottom: calc(var(--spacing-factor) * 1rem);
}
```

### Sidebar

```typescript
export function Sidebar() {
  const { ui } = useConfigStore();
  const [isCollapsed, setIsCollapsed] = useState(
    ui.componentes.sidebar.defaultCollapsed
  );
  // ... rest of component
}
```

## Error Handling

- Invalid preset ID → Fallback to 'estandar'
- CSS variable not supported → Graceful degradation
- localStorage quota exceeded → Clear non-essential config

## Testing Strategy

1. **Unit Tests**
   - Preset application functions
   - CSS variable setters
   - Store methods (setPreset, update*)

2. **Integration Tests**
   - Preset selector → Store update → UI change
   - Advanced config → CSS variables → Visual changes
   - DataTable with config defaults

3. **Manual Browser Tests**
   - Select each preset → Verify UI changes
   - Advanced config overrides → Verify persistence
   - Reset button → Verify back to 'estandar'
   - localStorage persistence → Refresh page → Config maintained

## Implementation Phases

### Phase 1: Foundation
- [ ] Add types to `types/config.types.ts`
- [ ] Create `constants/uiPresets.ts`
- [ ] Expand `UIConfig` interface in store
- [ ] Implement `applyVisualPreferences` function

### Phase 2: Store Methods
- [ ] Add `setPreset` method
- [ ] Add `updateVisualPreferences` method
- [ ] Add `updateComponentPreferences` method
- [ ] Update persist partialize

### Phase 3: UI Components
- [ ] Create `PresetSelector` component
- [ ] Create `AdvancedConfigUI` component
- [ ] Integrate into `UIConfig.tsx`

### Phase 4: Component Integration
- [ ] Update `DataTable` with density prop
- [ ] Update `DataTable` with pageSize from config
- [ ] Update `Sidebar` with defaultCollapsed from config
- [ ] Add CSS classes for table density

### Phase 5: CSS Variables
- [ ] Add new CSS variables to `index.css`
- [ ] Add `[data-no-animations]` selector
- [ ] Add table density classes

### Phase 6: Testing
- [ ] Manual browser testing with Playwright
- [ ] Verify localStorage persistence
- [ ] Test all 4 presets
- [ ] Test advanced config overrides

## Files to Create

- `lefarma.frontend/src/constants/uiPresets.ts`
- `lefarma.frontend/src/components/config/AdvancedConfigUI.tsx`
- `lefarma.frontend/docs/superpowers/specs/2026-03-24-ui-preferences-design.md` (this file)

## Files to Modify

- `lefarma.frontend/src/types/config.types.ts`
- `lefarma.frontend/src/store/configStore.ts`
- `lefarma.frontend/src/pages/configuracion/UIConfig.tsx`
- `lefarma.frontend/src/components/ui/data-table.tsx`
- `lefarma.frontend/src/components/layout/Sidebar.tsx`
- `lefarma.frontend/src/index.css`

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| CSS variable conflicts | Namespace with `--ui-*` prefix |
| localStorage quota exceeded | Handle quota exceeded error, clear non-essential |
| Performance issues with live updates | Debounce CSS variable updates if needed |
| Backward compatibility | Default to 'estandar' preset for existing users |

## Future Enhancements

- Custom presets created by users
- Export/import config as JSON
- Per-page/component overrides
- Keyboard shortcuts for preset switching
