import { useConfigStore } from '@/store/configStore';
import { Target, BarChart3, Armchair, Accessibility } from 'lucide-react';
import type { UIPresetId } from '@/types/config.types';

const PRESET_OPTIONS = [
  { id: 'compacto' as const, name: 'Compacto', icon: Target, desc: 'Más datos por pantalla' },
  { id: 'estandar' as const, name: 'Estándar', icon: BarChart3, desc: 'Balance perfecto' },
  { id: 'comodo' as const, name: 'Cómodo', icon: Armchair, desc: 'Espacio amplio' },
  { id: 'accesibilidad' as const, name: 'Accesibilidad', icon: Accessibility, desc: 'Fácil de leer' },
];

export function PresetSelector() {
  const { ui, setPreset } = useConfigStore();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {PRESET_OPTIONS.map((preset) => {
        const Icon = preset.icon;
        return (
          <button
            key={preset.id}
            onClick={() => setPreset(preset.id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
              ui.presetId === preset.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50 hover:bg-muted'
            }`}
          >
            <Icon className="h-6 w-6" />
            <span className="text-sm font-medium">{preset.name}</span>
            <span className="text-xs text-muted-foreground text-center">
              {preset.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
