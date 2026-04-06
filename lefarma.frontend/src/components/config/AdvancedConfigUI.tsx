import { useConfigStore } from '@/store/configStore';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export function AdvancedConfigUI() {
  const { ui, updateVisualPreferences, updateComponentPreferences, setPreset } = useConfigStore();

  return (
    <div className="space-y-6 pt-4">
      {/* Preferencias Visuales */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Preferencias Visuales</h3>

        {/* Densidad */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Densidad de Interfaz</Label>
            <p className="text-xs text-muted-foreground">
              Afecta espaciado y padding de elementos
            </p>
          </div>
          <Select
            value={ui.visual.densidad}
            onValueChange={(value: 'compacto' | 'comodo') =>
              updateVisualPreferences({ densidad: value })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compacto">Compacto</SelectItem>
              <SelectItem value="comodo">Cómodo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tamaño de Fuente */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Tamaño de Fuente</Label>
            <p className="text-xs text-muted-foreground">Escala base de tipografía</p>
          </div>
          <Select
            value={ui.visual.fontSize}
            onValueChange={(value: 'small' | 'medium' | 'large') =>
              updateVisualPreferences({ fontSize: value })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Pequeña</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="large">Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Animaciones */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Animaciones</Label>
            <p className="text-xs text-muted-foreground">
              Transiciones y efectos de movimiento
            </p>
          </div>
          <Switch
            checked={ui.visual.animations}
            onCheckedChange={(checked) => updateVisualPreferences({ animations: checked })}
          />
        </div>
      </div>

      {/* Configuración de Componentes */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-semibold">Componentes</h3>

        {/* Tablas */}
        <div className="space-y-3">
          <Label>Densidad de Tablas</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['compact', 'standard', 'comfortable'] as const).map((density) => (
              <button
                key={density}
                onClick={() =>
                  updateComponentPreferences({
                    tables: { ...ui.componentes.tables, density },
                  })
                }
                className={`px-3 py-2 text-sm rounded border-2 transition-all ${
                  ui.componentes.tables.density === density
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {density === 'compact' ? 'Compacta' : density === 'standard' ? 'Estándar' : 'Cómoda'}
              </button>
            ))}
          </div>
        </div>

        {/* Items por página */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Items por página (por defecto)</Label>
            <span className="text-sm font-medium text-primary">
              {ui.componentes.tables.defaultPageSize}
            </span>
          </div>
          <Slider
            value={[ui.componentes.tables.defaultPageSize]}
            onValueChange={([value]) =>
              updateComponentPreferences({
                tables: { ...ui.componentes.tables, defaultPageSize: value },
              })
            }
            min={5}
            max={100}
            step={5}
            className="w-full"
          />
        </div>

        {/* Sidebar */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Sidebar</Label>
            <p className="text-xs text-muted-foreground">
              Estado inicial al cargar la aplicación
            </p>
          </div>
          <Select
            value={ui.componentes.sidebar.defaultCollapsed ? 'colapsado' : 'expandido'}
            onValueChange={(value) =>
              updateComponentPreferences({
                sidebar: { defaultCollapsed: value === 'colapsado' },
              })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expandido">Expandido</SelectItem>
              <SelectItem value="colapsado">Colapsado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Botón Reset */}
      <div className="pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => setPreset('estandar')}
          className="w-full"
        >
          Restablecer Valores por Defecto
        </Button>
      </div>
    </div>
  );
}
