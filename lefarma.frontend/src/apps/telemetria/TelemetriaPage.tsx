import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BotonesTab } from './components/BotonesTab';
import { ErroresNavegadorTab } from './components/ErroresNavegadorTab';
import { ErroresServidorTab } from './components/ErroresServidorTab';
import { MapaCalorTab } from './components/MapaCalorTab';
import { ResumenTab } from './components/ResumenTab';
import { OPCIONES_RANGO, fechaCorta, rangoDeDias } from './utils';

/**
 * Panel de observabilidad: lo que el navegador captura (errores, clics y
 * puntero) más los errores que ya guarda el servidor. Todo es de solo lectura.
 */
export function TelemetriaPage() {
  usePageTitle('Telemetría', 'Errores, clics y mapa de calor de la aplicación');

  const [dias, setDias] = useState(7);
  const rango = useMemo(() => rangoDeDias(dias), [dias]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#eb6c36]" />
          <div>
            <h1 className="text-lg font-semibold">Telemetría</h1>
            <p className="text-xs text-muted-foreground">
              Del {fechaCorta(rango.desde)} al {fechaCorta(rango.hasta)} · solo lectura
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Periodo</span>
          <Select value={String(dias)} onValueChange={(valor) => setDias(Number(valor))}>
            <SelectTrigger className="w-[130px]" aria-label="Periodo de la telemetría">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_RANGO.map((opcion) => (
                <SelectItem key={opcion.valor} value={String(opcion.valor)}>
                  {opcion.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="errores">Errores</TabsTrigger>
          <TabsTrigger value="botones">Botones</TabsTrigger>
          <TabsTrigger value="mapa-calor">Mapa de calor</TabsTrigger>
          <TabsTrigger value="servidor">Errores del servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <ResumenTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
        <TabsContent value="errores">
          <ErroresNavegadorTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
        <TabsContent value="botones">
          <BotonesTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
        <TabsContent value="mapa-calor">
          <MapaCalorTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
        <TabsContent value="servidor">
          <ErroresServidorTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
