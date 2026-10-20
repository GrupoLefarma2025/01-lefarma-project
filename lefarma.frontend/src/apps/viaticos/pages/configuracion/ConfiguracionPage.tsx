import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import {
  CONFIG_VIATICOS_DEFAULT,
  guardarConfigViaticos,
  leerConfigViaticos,
  type ConfigViaticos,
} from '../../services/configViaticos';

/** Pantalla de configuración del módulo de viáticos (se guarda en el navegador). */
export function ConfiguracionPage() {
  usePageTitle('Configuración de viáticos', 'Viáticos');
  const [config, setConfig] = useState<ConfigViaticos>(leerConfigViaticos);

  function guardar() {
    guardarConfigViaticos(config);
    toast.success('Configuración de viáticos guardada.');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de viáticos</CardTitle>
          <CardDescription>
            Tarifas de comida y horario con el que se sugiere transporte. Se guarda en este navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">Comidas</h2>
              <p className="text-xs text-muted-foreground">
                El asistente calcula por día: medio día o día completo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cfg-comida-media">Comida 1/2 día (MXN)</Label>
                <Input
                  id="cfg-comida-media"
                  inputMode="decimal"
                  value={config.comidaMedia}
                  onChange={(e) => setConfig({ ...config, comidaMedia: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfg-comida-completa">Comida día completo (MXN)</Label>
                <Input
                  id="cfg-comida-completa"
                  inputMode="decimal"
                  value={config.comidaCompleta}
                  onChange={(e) => setConfig({ ...config, comidaCompleta: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">Horario para sugerir transporte</h2>
              <p className="text-xs text-muted-foreground">Default: 07:00 a 18:30.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cfg-hora-entrada">Entrada</Label>
                <Input
                  id="cfg-hora-entrada"
                  type="time"
                  value={config.horaEntrada}
                  onChange={(e) => setConfig({ ...config, horaEntrada: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cfg-hora-salida">Salida</Label>
                <Input
                  id="cfg-hora-salida"
                  type="time"
                  value={config.horaSalida}
                  onChange={(e) => setConfig({ ...config, horaSalida: e.target.value })}
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfig(CONFIG_VIATICOS_DEFAULT)}>
              Restaurar defaults
            </Button>
            <Button type="button" onClick={guardar}>
              Guardar configuración
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
