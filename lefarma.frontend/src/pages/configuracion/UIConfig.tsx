import { useConfigStore } from '@/store/configStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon, Sun, Monitor } from 'lucide-react';

export function UIConfig() {
  const { ui, setTema } = useConfigStore();

  const handleTemaChange = (tema: 'light' | 'dark' | 'system') => {
    setTema(tema);
  };

  const getTemaIcon = (tema: 'light' | 'dark' | 'system') => {
    switch (tema) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuración de Tema */}
      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
          <CardDescription>Personaliza el tema visual de la aplicación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {(['light', 'dark', 'system'] as const).map((tema) => (
              <button
                key={tema}
                onClick={() => handleTemaChange(tema)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  ui.tema === tema
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                }`}
              >
                {getTemaIcon(tema)}
                <span className="text-sm font-medium capitalize">
                  {tema === 'system' ? 'Sistema' : tema === 'light' ? 'Claro' : 'Oscuro'}
                </span>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {ui.tema === 'system'
              ? 'La aplicación usará el tema de tu sistema operativo'
              : `Tema ${ui.tema === 'light' ? 'claro' : 'oscuro'} seleccionado`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
